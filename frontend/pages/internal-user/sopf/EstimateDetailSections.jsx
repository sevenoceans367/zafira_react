import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AddCircleButton, Button, DmyDateInput, useAlert } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import PortSearchSelect from '../period-contract/PortSearchSelect.jsx';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import VesselSearchSelect from './VesselSearchSelect.jsx';
import {
  BUNKER_ACTIVITY_GRADE_OPTIONS,
  BUNKER_ACTIVITY_OPTIONS,
  BUNKER_ACTIVITY_RATE_FIELD,
  FIXTURE_TYPE_OPTIONS,
  NSBG_OPTIONS,
  PASSAGE_TYPE_OPTIONS,
  SBG_OPTIONS,
  SPEED_DATA_OPTIONS,
  SPEED_TYPE_OPTIONS,
  CONSUMPTION_PORT_COLUMNS,
  CONSUMPTION_SPEED_COLUMNS,
  CONSUMPTION_OTHERS_COLUMNS,
  createEmptyBrokerRow,
  createEmptyBunkerActivityRow,
  createEmptyCargoRow,
  createEmptyHireRow,
  createEmptyOrcRow,
  createEmptyOtherIncomeRow,
  createEmptyPortLeg,
  createEmptyProfitSharingRow,
  createEmptySecaBunkerRow,
  getFixtureTypeLabel,
  seedPortLegsFromFirstCargo,
} from './estimateDetail.constants.js';
import { formatDemurrageCostField, calcSeaDays, calcSeaDaysWithSeca, pickPassageSpeedKnots, buildBunkerSummaryRows, calcDemurrageCommissionDisplay, resolveNrtFromGnrt, classifyBunkerGradeName, formatDemurrageLoadPortLabel, formatDemurrageDischargePortLabel, formatDays, formatDistance, syncPortstayFromPassageDates } from './estimateCalculations.js';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import RowRemoveButton from './RowRemoveButton.jsx';

import DistanceFetchModal from './DistanceFetchModal.jsx';
import TankerFreightModeSection from './TankerFreightModeSection.jsx';
import PortLaytimeSections from './PortLaytimeSections.jsx';
import EstimateResultsPanels from './EstimateResultsPanels.jsx';
import VesselItineraryModal from './VesselItineraryModal.jsx';
import { checkVoyageNoExists, fetchCanalOrcRates, searchEstimatePorts } from '../../../services/estimateDetail.js';
import { focusEstimateValidationField, getAddRowBlockMessage } from './estimateValidation.js';
import { sanitizeDecimalInput, sanitizeFieldDecimal, sanitizeEstimatePatch, ESTIMATE_DECIMAL_FIELDS } from './estimateInputSanitize.js';
import styles from './UpdateEstimatePage.module.css';

/** PHP addestimate.php — Voyage No allows a-z, 0-9, and hyphen only. */
function sanitizeVoyageNo(value) {
  return String(value || '').replace(/[^a-zA-Z0-9-]/g, '');
}

function BunkerPriceInput({ value, readOnly, onCommit }) {
  const [draft, setDraft] = useState(null);
  const editing = draft !== null;

  return (
    <input
      value={editing ? draft : (value || '')}
      readOnly={readOnly}
      placeholder="0.00"
      inputMode="decimal"
      autoComplete="off"
      onFocus={(e) => {
        setDraft(value || '');
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(sanitizeDecimalInput(e.target.value))}
      onBlur={() => {
        const raw = draft ?? '';
        setDraft(null);
        const cleaned = sanitizeDecimalInput(raw);
        const normalized = cleaned === '' || cleaned === '.'
          ? ''
          : Number.isFinite(Number(cleaned))
            ? Number(cleaned).toFixed(2)
            : '';
        if (String(normalized) !== String(value || '')) {
          onCommit(normalized);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function Field({ id, label, children, className = '' }) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export default function EstimateDetailSections({
  detail,
  form,
  readOnly = false,
  isAdd = false,
  voyageExcludeId = null,
  lookups = { cargos: [], bunkerGrades: [] },
  onFieldChange,
  onVesselSelect,
  onPeriodContractChange,
  onRecalc,
  onApplyPatch,
}) {
  const estimateType = Number(detail?.estimateType) || 2;
  const isTanker = estimateType === 2;
  const showLumpsum = estimateType !== 3;
  const editable = !readOnly;
  const alert = useAlert();
  const [searchParams] = useSearchParams();
  const [distanceLegId, setDistanceLegId] = useState(null);
  const [itineraryOpen, setItineraryOpen] = useState(false);

  // PHP updatecost_sheet_tci Passage & Ports → sof.php?comid=&page=
  const sofComId = searchParams.get('comid')
    || searchParams.get('comId')
    || detail?.comid
    || form?.comid
    || '';
  const sofPage = searchParams.get('page') || '1';
  const sofHref = sofComId
    ? appPath(
      `/internal-user/vc/ops/sof?comid=${encodeURIComponent(sofComId)}&page=${encodeURIComponent(sofPage)}`,
    )
    : '';

  const updateField = (key, value) => {
    const next = ESTIMATE_DECIMAL_FIELDS.has(key)
      ? sanitizeFieldDecimal(key, value)
      : value;
    onFieldChange?.(key, next);
  };

  const applyPatch = (patch) => {
    const cleanPatch = sanitizeEstimatePatch(patch);
    const touchesCargo = Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoRows')
      || Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoIds')
      || Object.prototype.hasOwnProperty.call(cleanPatch, 'lumpsumQty');
    if (touchesCargo && !Object.prototype.hasOwnProperty.call(cleanPatch, 'portLegs')) {
      const syncQty = Object.prototype.hasOwnProperty.call(cleanPatch, 'lumpsumQty');
      cleanPatch.portLegs = seedPortLegsFromFirstCargo(
        form.portLegs,
        cleanPatch.cargoRows || form.cargoRows,
        Object.prototype.hasOwnProperty.call(cleanPatch, 'lumpsumQty')
          ? cleanPatch.lumpsumQty
          : form.lumpsumQty,
        { syncQty },
      );
    }
    if (onApplyPatch) {
      onApplyPatch(cleanPatch);
      return;
    }
    Object.entries(cleanPatch || {}).forEach(([key, value]) => {
      if (onRecalc && Array.isArray(value)) onRecalc(key, value);
      else updateField(key, value);
    });
  };

  const resolveNrt = () => resolveNrtFromGnrt(form.nrt, form.gnrt);

  const openDistanceFetch = async (leg) => {
    if (!leg.fromPortId || !leg.toPortId) {
      await alert({
        title: 'Missing Information',
        message: 'Please select From Port and To Port',
        confirmLabel: 'OK',
      });
      return;
    }
    setDistanceLegId(leg.id);
  };

  const handleDistanceConfirm = async (legId, patch) => {
    const leg = (form.portLegs || []).find((row) => row.id === legId);
    if (!leg) return;

    const speed = pickPassageSpeedKnots(form, leg.passageType, leg.speedType);
    const seaDays = calcSeaDaysWithSeca(patch.distance, patch.secaDistance, speed, leg.seaMargin);
    const secaDays = calcSeaDays(patch.secaDistance, speed, leg.seaMargin);
    const totalDistance = Number(patch.distance) || 0;
    const secaDistance = Number(patch.secaDistance) || 0;
    const nonSecaDistance = Math.max(0, totalDistance - secaDistance);
    const nonSecaDays = Math.max(0, Number((seaDays - secaDays).toFixed(3)));

    const nextLegs = (form.portLegs || []).map((row) => (
      row.id === legId
        ? {
          ...row,
          distance: formatDistance(patch.distance) || '0.000',
          secaDistance: formatDistance(patch.secaDistance) || '0.000',
          nonSecaDistance: formatDistance(nonSecaDistance) || '0.000',
          navMethod: patch.navMethod || row.navMethod || '',
          seaDays: formatDays(seaDays),
          secaDays: formatDays(secaDays),
          nonSecaDays: formatDays(nonSecaDays),
        }
        : row
    ));

    let nextOrcs = form.orcRows || [];
    const canals = patch.canals || {};
    if (canals.turkish || canals.suez || canals.panama) {
      try {
        const rates = await fetchCanalOrcRates({
          turkish: canals.turkish,
          suez: canals.suez,
          panama: canals.panama,
          businessType: estimateType,
          nrt: resolveNrt(),
          dwt: form.dwtSummer || form.loadable || 0,
          passageType: leg.passageType,
          vesselType: form.vesselType,
          sdrToUsd: form.sdrToUsd || lookups.marketPrices?.sdrToUsd,
        });
        const portFlag = `${leg.fromPortId}_${leg.toPortId}`;
        const remaining = [...(form.orcRows || [])].filter((row) => row.costId || row.amount);
        let scnt = form.scnt || '';
        for (const canalRow of rates.rows || []) {
          if (canalRow.scnt != null && canalRow.scnt !== '') {
            scnt = String(canalRow.scnt);
          }
          const exists = remaining.some(
            (row) => String(row.costId) === String(canalRow.costId) && row.portFlag === portFlag,
          );
          if (exists) continue;
          remaining.push({
            ...createEmptyOrcRow(),
            costId: String(canalRow.costId),
            costName: canalRow.costName || '',
            amount: canalRow.amount || '0',
            portFlag,
          });
        }
        nextOrcs = remaining.length ? remaining : [createEmptyOrcRow()];
        applyPatch({
          portLegs: nextLegs,
          orcRows: nextOrcs,
          ...(rates.sdrToUsd ? { sdrToUsd: rates.sdrToUsd } : {}),
          ...(scnt ? { scnt } : {}),
        });
        return;
      } catch {
        // Keep distance even if canal rates fail.
      }
    }

    applyPatch({ portLegs: nextLegs, orcRows: nextOrcs });
  };

  const updateRow = (collection, id, patch) => {
    const cleanPatch = sanitizeEstimatePatch(patch);
    let rows = (form[collection] || []).map((row) => (
      String(row.id) === String(id) ? { ...row, ...cleanPatch } : row
    ));

    // Cargo Name / Qty → auto-fill Port Details Cargo + Qty (MT)
    if (
      collection === 'cargoRows'
      && (
        Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoMt')
        || Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoId')
      )
    ) {
      const syncQty = Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoMt');
      applyPatch({
        cargoRows: rows,
        portLegs: seedPortLegsFromFirstCargo(
          form.portLegs,
          rows,
          form.lumpsumQty,
          { syncQty },
        ),
      });
      return;
    }

    // Port date / portstay edits — mirror PHP calculatePortDates / getDepartureDate
    if (collection === 'portLegs') {
      const keys = Object.keys(cleanPatch || {});
      let scheduleMode = null;
      if (keys.includes('fromArrival')) scheduleMode = 'fromArrival';
      else if (keys.includes('fromDeparture')) scheduleMode = 'fromDeparture';
      else if (keys.includes('toArrival')) scheduleMode = 'toArrival';
      else if (keys.includes('toDeparture')) scheduleMode = 'toDeparture';
      else if (keys.includes('discPortWorkDays')) scheduleMode = 'portstayDp';
      else if (keys.includes('loadPortWorkDays')) scheduleMode = 'portstayLp';
      else if (
        keys.includes('loadPortIdleDays')
        || keys.includes('discPortIdleDays')
        || keys.includes('transitIdleDays')
        || keys.includes('chartererAccountDays')
      ) {
        // Keep typed Idle Days — do not re-run getIdleDaysByLaycan on each keystroke
        scheduleMode = 'idleManual';
      } else if (keys.includes('discPortTerms') || keys.includes('loadPortTerms')) {
        // Any Terms selection (PHP: if selLPTerms/selDPTerms): pull Portstay from Arrival/Departure.
        // Field stays editable only for D.A.P. (see PortLaytimeSections).
        const termsVal = keys.includes('discPortTerms')
          ? cleanPatch.discPortTerms
          : cleanPatch.loadPortTerms;
        if (String(termsVal || '').trim()) {
          scheduleMode = 'syncPortstayFromDates';
          const idx = rows.findIndex((row) => String(row.id) === String(id));
          if (idx >= 0) rows[idx] = syncPortstayFromPassageDates(rows[idx]);
        }
      } else if (
        keys.includes('demmDaysDp')
        || keys.includes('demmDaysLp')
        || keys.includes('demmRateDp')
        || keys.includes('demmRateLp')
      ) {
        // Keep typed Demm. Days/Rate — do not re-run putDaysToDemurrageDispatch
        scheduleMode = 'demurrageManual';
      }

      if (scheduleMode) {
        applyPatch({
          portLegs: rows,
          _portScheduleMode: scheduleMode,
          _portScheduleLegId: id,
        });
        return;
      }
    }

    if (onRecalc) {
      onRecalc(collection, rows);
    } else {
      updateField(collection, rows);
    }
  };

  const addRow = async (collection, factory, opts = {}) => {
    const blockMessage = getAddRowBlockMessage(collection, form[collection] || [], opts);
    if (blockMessage) {
      await alert({ title: 'Missing Information', message: blockMessage, confirmLabel: 'OK' });
      return;
    }

    if (collection === 'portLegs') {
      const prev = (form.portLegs || [])[(form.portLegs || []).length - 1];
      const next = factory();
      if (prev?.toPortId) {
        next.fromPortId = prev.toPortId;
        next.fromPortName = prev.toPortName || '';
      }
      const seeded = seedPortLegsFromFirstCargo(
        [next],
        form.cargoRows,
        form.lumpsumQty,
      )[0] || next;
      updateField(collection, [...(form.portLegs || []), seeded]);
      return;
    }
    updateField(collection, [...(form[collection] || []), factory()]);
  };

  const removeRow = (collection, id) => {
    const rows = (form[collection] || []).filter((row) => row.id !== id);
    if (!rows.length) return;
    if (onRecalc) {
      onRecalc(collection, rows);
    } else {
      updateField(collection, rows);
    }
  };

  const handleVoyageNoChange = (value) => {
    const next = sanitizeVoyageNo(value);
    updateField('voyageNo', next);
    if (isAdd) updateField('voyageName', next);
  };

  const handleVoyageNoBlur = async () => {
    if (readOnly) return;
    const voyageNo = String(form.voyageNo || '').trim();
    if (!voyageNo) return;
    try {
      const exists = await checkVoyageNoExists(voyageNo, { excludeId: voyageExcludeId });
      if (!exists) return;
      await alert({
        title: 'Alert',
        message: 'Voyage number already exists',
        confirmLabel: 'OK',
      });
      updateField('voyageNo', '');
      if (isAdd) updateField('voyageName', '');
      focusEstimateValidationField('voyageNo');
    } catch (err) {
      await alert({
        title: 'Error',
        message: err.message || 'Failed to check voyage number.',
        confirmLabel: 'OK',
      });
    }
  };

  const inputProps = (key, opts = {}) => {
    const decimal = opts.decimal ?? ESTIMATE_DECIMAL_FIELDS.has(key);
    return {
      id: key,
      value: form[key] ?? '',
      readOnly: opts.readOnly ?? readOnly,
      ...(decimal ? { inputMode: 'decimal', autoComplete: 'off' } : {}),
      onChange: (event) => {
        const value = decimal
          ? sanitizeFieldDecimal(key, event.target.value)
          : event.target.value;
        // Cargo Qty (MT) / lump-sum qty → seed Port Details Qty when empty
        if (key === 'lumpsumQty') {
          applyPatch({ lumpsumQty: value });
          return;
        }
        if (opts.recalc && onRecalc) {
          onRecalc(key, value);
        } else {
          updateField(key, value);
        }
      },
    };
  };

  const bunkerGradeName = (gradeId) => (
    (lookups.bunkerGrades || form._bunkerGrades || []).find((g) => String(g.id) === String(gradeId))?.name
    || gradeId
    || ''
  );

  // PHP Bunkers table: qty from consumption MT, price from SECA row (txtSECABunkerPrice / slave2 EST_PRICE).
  const bunkerSummaryRows = buildBunkerSummaryRows(form, bunkerGradeName);
  const {
    addressDemmComm,
    totalCommPercent,
    totalFreightComm,
    totalDemmComm,
  } = calcDemurrageCommissionDisplay(form);

  /** PHP txtSECABunkerPrice onKeyUp → getBunkerCalculation / getVoyageTime */
  const handleBunkerSummaryPriceChange = (grade, value) => {
    const classify = (gradeId) => {
      const key = classifyBunkerGradeName(bunkerGradeName(gradeId));
      return key === 'HSFO+SCRUBBER' ? 'HSFO' : key;
    };

    let matched = false;
    let nextSeca = (form.secaBunkerRows || []).map((row) => {
      if (classify(row.bunkerGradeId) !== grade) return row;
      matched = true;
      return { ...row, price: value };
    });

    if (!matched) {
      const gradeOpt = (lookups.bunkerGrades || form._bunkerGrades || []).find(
        (g) => classifyBunkerGradeName(g.name) === grade,
      );
      const bunkerType = grade === 'LSMGO' ? 'DO' : 'FO';
      const emptyIdx = nextSeca.findIndex((row) => (
        !row.bunkerGradeId
        && String(row.bunkerType || 'FO').toUpperCase() === bunkerType
      ));
      if (emptyIdx >= 0 && gradeOpt) {
        nextSeca = nextSeca.map((row, index) => (
          index === emptyIdx
            ? { ...row, bunkerGradeId: String(gradeOpt.id), price: value, bunkerType }
            : row
        ));
      } else if (gradeOpt) {
        nextSeca = [
          ...nextSeca,
          {
            ...createEmptySecaBunkerRow('SECA', bunkerType),
            bunkerGradeId: String(gradeOpt.id),
            price: value,
          },
        ];
      }
    }

    const nextBunker = (form.bunkerRows || []).map((row) => {
      if (String(row.identify || '').toUpperCase() === 'SUPPLY') return row;
      return classify(row.bunkerGradeId) === grade ? { ...row, price: value } : row;
    });

    applyPatch({
      secaBunkerRows: nextSeca,
      bunkerRows: nextBunker,
    });
  };

  return (
    <div className={styles.estimateForm}>
      <div className={styles.estimateMain}>
       <CollapsiblePanel title="Estimate Identifier" defaultOpen>
          <div className={styles.headerGrid}>
            <Field id="fixtureTypeId" label="Business Type">
              {readOnly ? (
                <input id="fixtureTypeId" value={getFixtureTypeLabel(form.fixtureTypeId)} readOnly />
              ) : (
                <select
                  id="fixtureTypeId"
                  value={String(form.fixtureTypeId ?? '')}
                  onChange={(e) => updateField('fixtureTypeId', e.target.value)}
                >
                  <option value="">Select from list</option>
                  {FIXTURE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              )}
            </Field>

            <Field id="vesselName" label="Vessel">
              {readOnly ? (
                <input id="vesselName" value={form.vesselName} readOnly />
              ) : (
                <VesselSearchSelect
                  value={form.vesselImoId}
                  label={form.vesselName}
                  onSelect={onVesselSelect}
                />
              )}
            </Field>

            <Field id="vesselType" label="Vessel Type">
              <input {...inputProps('vesselType')} />
            </Field>
            <Field id="flag" label="Flag">
              <input id="flag" value={form.flag} readOnly />
            </Field>
            <Field id="transDate" label="CP Date">
              {readOnly ? (
                <input id="transDate" value={form.cpDate || form.transDate || ''} readOnly />
              ) : (
                <DmyDateInput
                  allowClear={false}
                  id="transDate"
                  value={form.cpDate || form.transDate || ''}
                  onChange={(value) => applyPatch({
                    cpDate: value,
                    transDate: value,
                  })}
                />
              )}
            </Field>
            <Field id="voyageNo" label="Voyage No.">
              <input
                id="voyageNo"
                value={form.voyageNo}
                readOnly={readOnly}
                autoComplete="off"
                onChange={(e) => handleVoyageNoChange(e.target.value)}
                onBlur={handleVoyageNoBlur}
              />
            </Field>
            <Field id="voyageName" label="Sheet Name">
              <input {...inputProps('voyageName')} />
            </Field>
            <Field id="estimateType" label="Estimate Type">
              <input id="estimateType" value={detail.estimateTypeLabel} readOnly />
            </Field>
            <Field id="sdrToUsd" label="SDR Rate">
              <input {...inputProps('sdrToUsd', { recalc: true })} />
            </Field>
            <Field id="scnt" label="SCNT">
              <input id="scnt" value={form.scnt || ''} readOnly placeholder="0.00" />
            </Field>
            <Field id="laycanStart" label="Laycan Start">
              {readOnly ? (
                <input id="laycanStart" value={form.laycanStart || ''} readOnly />
              ) : (
                <DmyDateInput
                  allowClear={false}
                  id="laycanStart"
                  enableTime
                  value={form.laycanStart || ''}
                  onChange={(value) => applyPatch({
                    laycanStart: value,
                    _portScheduleMode: 'laycanOnly',
                  })}
                />
              )}
            </Field>
            <Field id="laycanEnd" label="Laycan End">
              {readOnly ? (
                <input id="laycanEnd" value={form.laycanEnd || ''} readOnly />
              ) : (
                <DmyDateInput
                  allowClear={false}
                  id="laycanEnd"
                  enableTime
                  value={form.laycanEnd || ''}
                  onChange={(value) => updateField('laycanEnd', value)}
                />
              )}
            </Field>
            <Field id="periodId" label="Period Contract">
              <select
                id="periodId"
                value={form.periodId || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const value = e.target.value;
                  updateField('periodId', value);
                  onPeriodContractChange?.(value);
                }}
              >
                <option value="">— Select —</option>
                {(lookups.periodContracts || []).map((row) => (
                  <option key={row.id} value={row.id}>{row.label || row.id}</option>
                ))}
              </select>
            </Field>
          </div>
      </CollapsiblePanel>

       <CollapsiblePanel title="Fixed Vessel Particulars" defaultOpen={false}>
          <div className={styles.headerGrid}>
            <Field id="dwtSummer" label="DWT (Summer)">
              <input {...inputProps('dwtSummer')} />
            </Field>
            <Field id="dwtTropical" label="DWT (Tropical)">
              <input {...inputProps('dwtTropical')} />
            </Field>
            <Field id="gnrt" label="GRT">
              <input {...inputProps('gnrt')} />
            </Field>
            <Field id="nrt" label="NRT">
              <input
                id="nrt"
                value={form.nrt || (form.gnrt ? (Number(String(form.gnrt).split('/')[0] || form.gnrt) * 0.7).toFixed(2) : '')}
                readOnly
              />
            </Field>
            <Field id="loa" label="LOA">
              <input {...inputProps('loa')} />
            </Field>
            <Field id="tpc" label="TPC">
              <input {...inputProps('tpc')} />
            </Field>
            <Field id="gear" label="Gear">
              <input {...inputProps('gear')} />
            </Field>
            <Field id="builtYear" label="Year Built">
              <input {...inputProps('builtYear')} />
            </Field>
            <Field id="beam" label="Beam">
              <input {...inputProps('beam')} />
            </Field>
            <Field id="loadable" label="Loadable">
              <input {...inputProps('loadable')} />
            </Field>
            <Field id="stowageFactor" label="Stowage Factor">
              <input {...inputProps('stowageFactor')} />
            </Field>
            <Field id="grainCap" label="Grain Cap">
              <input {...inputProps('grainCap')} />
            </Field>
            <Field id="baleCap" label="Bale Cap">
              <input {...inputProps('baleCap')} />
            </Field>
          </div>
      </CollapsiblePanel>

      
        <CollapsiblePanel
        title="Passage & Ports"
        defaultOpen
        actions={(
          <div className={styles.panelActionGroup}>
            {sofHref ? (
              <Button
                size="sm"
                variant="accent"
                label="SOF"
                ariaLabel="SOF"
                to={sofHref}
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              label="Itinerary"
              ariaLabel="Itinerary"
              onClick={() => setItineraryOpen(true)}
            />
          </div>
        )}
      >
        <div className={styles.portLegsStack}>
          {(form.portLegs || []).map((leg, legIndex) => {
            const isLastLeg = legIndex === (form.portLegs || []).length - 1;
            return (
            <div key={leg.id} className={styles.portLegCard}>
              <div className={styles.portLegGrid}>
                <div className={styles.portLegPorts}>
                  <table className={styles.portTable}>
                    <thead>
                      <tr>
                        <th className={styles.portIdxCol}>#</th>
                        <th>From Port</th>
                        <th>{legIndex > 0 ? 'Arrival' : null}</th>
                        <th>Departure</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={styles.portIdxCol}>
                          {editable
                            && (form.portLegs || []).length > 1
                            && isLastLeg ? (
                              <RowRemoveButton onClick={() => removeRow('portLegs', leg.id)} />
                            ) : (
                              <span>{legIndex + 1}</span>
                            )}
                        </td>
                        <td>
                          {readOnly ? (
                            leg.fromPortName || leg.fromPortId || '—'
                          ) : (
                            <PortSearchSelect
                              id={legIndex === 0 ? 'portFrom_0' : `portFrom_${legIndex}`}
                              value={leg.fromPortId}
                              label={leg.fromPortName}
                              searchPorts={searchEstimatePorts}
                              onChange={(portId, portName) => {
                                updateRow('portLegs', leg.id, {
                                  fromPortId: portId,
                                  fromPortName: portName,
                                });
                              }}
                            />
                          )}
                        </td>
                        <td>
                          {legIndex > 0 ? (
                            readOnly ? (
                              <input value={leg.fromArrival || ''} readOnly />
                            ) : (
                              <DmyDateInput
                                allowClear={false}
                                id={`fromArrival_${leg.id}`}
                                enableTime
                                className=""
                                value={leg.fromArrival || ''}
                                onChange={(value) => updateRow('portLegs', leg.id, { fromArrival: value })}
                              />
                            )
                          ) : null}
                        </td>
                        <td>
                          {readOnly ? (
                            <input value={leg.fromDeparture || ''} readOnly />
                          ) : (
                            <DmyDateInput
                              allowClear={false}
                              id={`fromDeparture_${leg.id}`}
                              enableTime
                              className=""
                              value={leg.fromDeparture || ''}
                              onChange={(value) => updateRow('portLegs', leg.id, { fromDeparture: value })}
                            />
                          )}
                        </td>
                      </tr>
                    </tbody>
                    <thead>
                      <tr>
                        <th />
                        <th>To Port</th>
                        <th>Arrival</th>
                        <th>Departure</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={styles.portIdxCol}>
                          {editable && isLastLeg ? (
                            <AddCircleButton
                              onClick={() => addRow('portLegs', createEmptyPortLeg)}
                            />
                          ) : null}
                        </td>
                        <td>
                          {readOnly ? (
                            leg.toPortName || leg.toPortId || '—'
                          ) : (
                            <PortSearchSelect
                              id={legIndex === 0 ? 'portTo_0' : `portTo_${legIndex}`}
                              value={leg.toPortId}
                              label={leg.toPortName}
                              searchPorts={searchEstimatePorts}
                              onChange={(portId, portName) => {
                                updateRow('portLegs', leg.id, {
                                  toPortId: portId,
                                  toPortName: portName,
                                });
                              }}
                            />
                          )}
                        </td>
                        <td>
                          {readOnly ? (
                            <input value={leg.toArrival || ''} readOnly />
                          ) : (
                            <DmyDateInput
                              allowClear={false}
                              id={`toArrival_${leg.id}`}
                              enableTime
                              className=""
                              value={leg.toArrival || ''}
                              onChange={(value) => updateRow('portLegs', leg.id, { toArrival: value })}
                            />
                          )}
                        </td>
                        <td>
                          {readOnly ? (
                            <input value={leg.toDeparture || ''} readOnly />
                          ) : (
                            <DmyDateInput
                              allowClear={false}
                              id={`toDeparture_${leg.id}`}
                              enableTime
                              className=""
                              value={leg.toDeparture || ''}
                              onChange={(value) => updateRow('portLegs', leg.id, { toDeparture: value })}
                            />
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className={styles.portLegMeta}>
                  <table className={styles.portTable}>
                    <thead>
                      <tr>
                        <th>Wx(%)</th>
                        <th>L/B</th>
                        <th>Speed Type</th>
                        {editable ? <th>Route</th> : null}
                        <th>Total Dist</th>
                        <th>Total Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <input
                            value={leg.seaMargin ?? '0'}
                            readOnly={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { seaMargin: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            id={legIndex === 0 ? 'portPassage_0' : `portPassage_${legIndex}`}
                            value={leg.passageType || ''}
                            disabled={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { passageType: e.target.value })}
                          >
                            {PASSAGE_TYPE_OPTIONS.map((o) => (
                              <option key={o.value || 'blank'} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            id={legIndex === 0 ? 'portSpeed_0' : `portSpeed_${legIndex}`}
                            value={leg.speedType}
                            disabled={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { speedType: e.target.value })}
                          >
                            {SPEED_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        {editable ? (
                          <td>
                            <button
                              type="button"
                              className={styles.fetchBtn}
                              onClick={() => openDistanceFetch(leg)}
                            >
                              Sync
                            </button>
                          </td>
                        ) : null}
                        <td>
                          <input
                            id={legIndex === 0 ? 'portDistance_0' : `portDistance_${legIndex}`}
                            value={leg.distance}
                            readOnly={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { distance: e.target.value })}
                          />
                        </td>
                        <td>
                          <input value={leg.seaDays || ''} readOnly />
                        </td>
                      </tr>
                    </tbody>
                    <thead>
                      <tr>
                        <th>BG</th>
                        <th>NSECA Dist</th>
                        <th>NSECA Days</th>
                        <th>BG</th>
                        <th>SECA Dist</th>
                        <th>SECA Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <select
                            value={leg.bgNonSeca || 'VLSFO'}
                            disabled={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { bgNonSeca: e.target.value })}
                          >
                            {NSBG_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input value={leg.nonSecaDistance || ''} readOnly />
                        </td>
                        <td>
                          <input value={leg.nonSecaDays || ''} readOnly />
                        </td>
                        <td>
                          <select
                            value={leg.bgSeca || 'LSMGO'}
                            disabled={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { bgSeca: e.target.value })}
                          >
                            {SBG_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={leg.secaDistance || ''}
                            readOnly={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { secaDistance: e.target.value })}
                          />
                        </td>
                        <td>
                          <input value={leg.secaDays || ''} readOnly />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Speed & Consumption" defaultOpen>
        {(() => {
          const speedDataType = form.speedDataType || 'full';
          const speedCols = CONSUMPTION_SPEED_COLUMNS[speedDataType] || CONSUMPTION_SPEED_COLUMNS.full;
          const ballastKey = speedDataType === 'service'
            ? 'bEcoSpeed1'
            : speedDataType === 'eco'
              ? 'bEcoSpeed2'
              : 'bFullSpeed';
          const ladenKey = speedDataType === 'service'
            ? 'lEcoSpeed1'
            : speedDataType === 'eco'
              ? 'lEcoSpeed2'
              : 'lFullSpeed';
          const foRows = (form.consumptionRows || []).filter((row) => row.identify === 'FO');
          const doRows = (form.consumptionRows || []).filter((row) => row.identify === 'DO');
          const gradeName = (id) => (
            (lookups.bunkerGrades || []).find((g) => String(g.id) === String(id))?.name || id || '—'
          );

          const renderConsTable = (title, rows, identify, columns) => {
            const dataCols = columns;
            return (
            <div className={styles.consBlock}>
              <div className={styles.consTitle}>{title}</div>
              <div className={styles.tableWrap}>
                <table className={styles.portTable}>
                  <thead>
                    <tr>
                      <th>Bunker</th>
                      {dataCols.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(rows.length ? rows : []).map((row) => (
                      <tr key={`${title}-${row.id}`}>
                        <td>
                          {readOnly ? (
                            gradeName(row.bunkerGradeId)
                          ) : (
                            <select
                              value={row.bunkerGradeId || ''}
                              onChange={(e) => updateRow('consumptionRows', row.id, {
                                bunkerGradeId: e.target.value,
                                identify,
                              })}
                            >
                              <option value="">Select</option>
                              {(lookups.bunkerGrades || []).map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        {dataCols.map((col) => (
                          <td key={col.key}>
                            <input
                              value={row[col.key] ?? ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => updateRow('consumptionRows', row.id, {
                                [col.key]: e.target.value,
                                identify,
                              })}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!rows.length ? (
                      <tr>
                        <td colSpan={1 + dataCols.length}>
                          No {identify} rows
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          );
          };

          const atSeaCols = [...speedCols, ...CONSUMPTION_PORT_COLUMNS];

          return (
            <>
              <div className={styles.speedDataBar}>
                <span className={styles.speedDataLabel}>Speed Data</span>
                <select
                  id="speedDataType"
                  value={speedDataType}
                  disabled={readOnly}
                  onChange={(e) => updateField('speedDataType', e.target.value)}
                >
                  {SPEED_DATA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <Field id={ballastKey} label="Ballast Speed (Knots)">
                  <input {...inputProps(ballastKey, { recalc: true })} placeholder="0.00" />
                </Field>
                <Field id={ladenKey} label="Laden Speed (Knots)">
                  <input {...inputProps(ladenKey, { recalc: true })} placeholder="0.00" />
                </Field>
              </div>
              {renderConsTable('FO Consp/day (MT) - At Sea / In Port (SECA & NON-SECA)', foRows, 'FO', atSeaCols)}
              {renderConsTable('DO Consp/day (MT) - At Sea / In Port (SECA & NON-SECA)', doRows, 'DO', atSeaCols)}
              {renderConsTable('FO Consp/day (MT) - Others (SECA & NON-SECA)', foRows, 'FO', CONSUMPTION_OTHERS_COLUMNS)}
              {renderConsTable('DO Consp/day (MT) - Others (SECA & NON-SECA)', doRows, 'DO', CONSUMPTION_OTHERS_COLUMNS)}
            </>
          );
        })()}
      </CollapsiblePanel>
      


      

      
        <CollapsiblePanel
        title="Cargo"
        defaultOpen
      >
        <div className={styles.headerGrid}>
          {!(isTanker && String(form.tankType || '1') === '2') ? (
          <Field id="cargoId_0" label="Cargo Name" className={styles.cargoMultiSelectField}>
            <div id="cargoId_0" className={styles.cargoMultiSelectWrap}>
              {(() => {
                const cargoLookup = (lookups.cargos || [])
                  .map((c) => ({
                    id: String(c.id ?? c.MATERIALID ?? ''),
                    name: String(c.name ?? c.MATERIAL_CODE_DESC ?? '').trim(),
                  }))
                  .filter((c) => c.id);

                const selectedCargoIds = (
                  (form.cargoIds || []).length
                    ? form.cargoIds
                    : (form.cargoRows || []).map((row) => row.cargoId)
                )
                  .map((id) => String(id || '').trim())
                  .filter((id) => id && id !== '0');

                const optionMap = new Map(
                  cargoLookup.map((c) => [c.id, { id: c.id, name: c.name || c.id }]),
                );
                for (const row of form.cargoRows || []) {
                  const id = String(row.cargoId || '').trim();
                  if (!id || id === '0') continue;
                  if (!optionMap.has(id)) {
                    optionMap.set(id, {
                      id,
                      name: row.cargoName || cargoLookup.find((c) => c.id === id)?.name || id,
                    });
                  } else if (!optionMap.get(id).name && row.cargoName) {
                    optionMap.set(id, { id, name: row.cargoName });
                  }
                }

                return (
              <CountryMultiSelect
                compact
                options={[...optionMap.values()]}
                value={selectedCargoIds}
                disabled={readOnly}
                placeholder="Choose cargo…"
                searchPlaceholder="Search cargo…"
                onChange={(selected) => {
                  const existingById = new Map(
                    (form.cargoRows || []).map((row) => [String(row.cargoId), row]),
                  );
                  const nextRows = selected.length
                    ? selected.map((cargoId) => {
                      const existing = existingById.get(String(cargoId));
                      const cargo = optionMap.get(String(cargoId))
                        || cargoLookup.find((c) => String(c.id) === String(cargoId));
                      if (existing) {
                        return {
                          ...existing,
                          cargoId: String(cargoId),
                          cargoName: cargo?.name || existing.cargoName || '',
                          status: 1,
                        };
                      }
                      return {
                        ...createEmptyCargoRow(1),
                        cargoId: String(cargoId),
                        cargoName: cargo?.name || '',
                      };
                    })
                    : [createEmptyCargoRow(1)];
                  applyPatch({
                    cargoRows: nextRows,
                    cargoIds: selected.map(String),
                  });
                }}
              />
                );
              })()}
            </div>
          </Field>
          ) : null}
          <Field id="charteringTeam" label="Chartering Team">
            <select
              id="charteringTeam"
              value={form.charteringTeam || ''}
              disabled={readOnly}
              onChange={(e) => updateField('charteringTeam', e.target.value)}
            >
              <option value="">— Select —</option>
              {(lookups.charteringTeams || []).map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </Field>
          <Field id="charteringPic" label="Chartering PIC">
            <select
              id="charteringPic"
              value={form.charteringPic || ''}
              disabled={readOnly}
              onChange={(e) => updateField('charteringPic', e.target.value)}
            >
              <option value="">— Select —</option>
              {(() => {
                const options = [...(lookups.charteringPics || [])];
                const id = form.charteringPic != null ? String(form.charteringPic) : '';
                if (id && !options.some((row) => String(row.id) === id)) {
                  options.unshift({ id, name: form.charteringPicName || id });
                }
                return options.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ));
              })()}
            </select>
          </Field>
          <Field id="freightGrossCargoHeader" label="Total Freight">
            <input id="freightGrossCargoHeader" value={form.freightGross || ''} readOnly />
          </Field>
        </div>

        {isTanker ? (
          <TankerFreightModeSection
            form={form}
            readOnly={readOnly}
            editable={editable}
            lookups={lookups}
            inputProps={inputProps}
            applyPatch={applyPatch}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
            onRecalc={onRecalc}
            updateField={updateField}
          />
        ) : (
          <>
            <h4 className={styles.subHeading}>Freight</h4>
            <div className={styles.headerGrid}>
              {showLumpsum ? (
                <>
                  <Field id="lumpsumQty" label="Lump Sum Qty">
                    <input {...inputProps('lumpsumQty', { recalc: true })} />
                  </Field>
                  <Field id="lumpsum" label="Lump Sum">
                    <input {...inputProps('lumpsum', { recalc: true })} />
                  </Field>
                </>
              ) : null}
              <Field id="marketRate" label="Market / Cargo Rate">
                <input {...inputProps('marketRate', { recalc: true })} />
              </Field>
              <Field id="freightGross" label="Gross Freight / Total Freight">
                <input {...inputProps('freightGross', { recalc: true })} />
              </Field>
            </div>
          </>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Commissions"
        defaultOpen
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th style={{ width: 56 }} />
                <th />
                <th>Percentage (%)</th>
                <th>Freight Comm.</th>
                <th>Demurrage Comm.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td />
                <td>ADCOM Freight</td>
                <td>
                  <input {...inputProps('addCommPercent', { recalc: true })} id="addCommPercentCargo" placeholder="0.00" />
                </td>
                <td>
                  <input id="addressCommAmtCargo" value={form.addressCommAmt || ''} readOnly placeholder="0.00" />
                </td>
                <td>
                  <input
                    id="addressDemmCommCargo"
                    value={addressDemmComm ? addressDemmComm.toFixed(2) : ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
              </tr>
              {(form.brokerRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    {editable ? (
                      <RowRemoveButton onClick={() => removeRow('brokerRows', row.id)} />
                    ) : null}
                  </td>
                  <td>Brokerage commission</td>
                  <td>
                    <input
                      value={row.percent || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      inputMode="decimal"
                      autoComplete="off"
                      onChange={(e) => updateRow('brokerRows', row.id, { percent: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={row.amount || ''} readOnly placeholder="0.00" />
                  </td>
                  <td>
                    <input value={row.demmPercent || ''} readOnly placeholder="0.00" />
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  {editable ? (
                    <AddCircleButton
                      onClick={() => addRow('brokerRows', createEmptyBrokerRow)}
                    />
                  ) : null}
                </td>
                <td>Total</td>
                <td>
                  <input
                    id="brokeragePercentCargo"
                    value={totalCommPercent ? totalCommPercent.toFixed(2) : ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
                <td>
                  <input
                    id="brokerageAmtCargo"
                    value={totalFreightComm ? totalFreightComm.toFixed(2) : ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
                <td>
                  <input
                    id="totalDemmCommCargo"
                    value={totalDemmComm ? totalDemmComm.toFixed(2) : ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

      <PortLaytimeSections
        form={form}
        readOnly={readOnly}
        lookups={lookups}
        updateRow={updateRow}
      />
{estimateType === 1 || estimateType === 2 ? (
        <CollapsiblePanel
          title="Additional Bunker Consumption"
          defaultOpen={false}
          actions={editable ? (
            <AddCircleButton
              onClick={() => addRow('bunkerActivityRows', () => createEmptyBunkerActivityRow({
                price: lookups.marketPrices?.vlsfo || '',
              }))}
            />
          ) : null}
        >
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 36 }} /> : null}
                  <th>Activity</th>
                  <th>Bunker Grade</th>
                  <th>Qty (MT)</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(form.bunkerActivityRows || []).map((row) => (
                  <tr key={row.id}>
                    {editable ? (
                      <td>
                        <RowRemoveButton onClick={() => removeRow('bunkerActivityRows', row.id)} />
                      </td>
                    ) : null}
                    <td>
                      <select
                        value={row.activity || 'Cold Wash'}
                        disabled={readOnly}
                        onChange={(e) => {
                          const activity = e.target.value;
                          const field = BUNKER_ACTIVITY_RATE_FIELD[activity];
                          const rates = form.variousBunkerRates || [];
                          const grade = String(row.bunkerGrade || '').toUpperCase();
                          const match = rates.find((r) => {
                            const name = String(r.bunkerName || '').toUpperCase();
                            return !grade || name.includes(grade) || grade.includes(name);
                          }) || rates[0];
                          const qtyFromRate = field && match?.[field] != null && match[field] !== ''
                            ? String(match[field])
                            : '';
                          updateRow('bunkerActivityRows', row.id, {
                            activity,
                            ...(qtyFromRate ? { qty: qtyFromRate } : {}),
                          });
                        }}
                      >
                        {BUNKER_ACTIVITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.bunkerGrade || 'VLSFO'}
                        disabled={readOnly}
                        onChange={(e) => {
                          const bunkerGrade = e.target.value;
                          const upper = String(bunkerGrade).toUpperCase();
                          let price = row.price;
                          if (upper.includes('LSMGO') || upper.includes('MGO')) {
                            price = lookups.marketPrices?.marineGasOil || price;
                          } else if (upper.includes('VLSFO')) {
                            price = lookups.marketPrices?.vlsfo || price;
                          }
                          const field = BUNKER_ACTIVITY_RATE_FIELD[row.activity];
                          const rates = form.variousBunkerRates || [];
                          const match = rates.find((r) => {
                            const name = String(r.bunkerName || '').toUpperCase();
                            return name.includes(upper) || upper.includes(name);
                          }) || rates[0];
                          const qtyFromRate = field && match?.[field] != null && match[field] !== ''
                            ? String(match[field])
                            : '';
                          updateRow('bunkerActivityRows', row.id, {
                            bunkerGrade,
                            price: price || '',
                            ...(qtyFromRate ? { qty: qtyFromRate } : {}),
                          });
                        }}
                      >
                        {BUNKER_ACTIVITY_GRADE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                        {(lookups.bunkerGrades || [])
                          .filter((g) => !BUNKER_ACTIVITY_GRADE_OPTIONS.some(
                            (o) => o.value.toUpperCase() === String(g.name || '').toUpperCase(),
                          ))
                          .map((g) => (
                            <option key={g.id} value={g.name}>{g.name}</option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={row.qty || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('bunkerActivityRows', row.id, { qty: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.price || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('bunkerActivityRows', row.id, { price: e.target.value })}
                      />
                    </td>
                    <td>
                      <input value={row.amount || ''} readOnly placeholder="0.00" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsiblePanel>
      ) : null}

      <CollapsiblePanel title="Demurrage Dispatch" defaultOpen={false}>
        <div className={styles.headerGrid} style={{ marginBottom: 8 }}>
          <Field id="timeAllowed" label="Time Allowed (hrs)">
            <input
              id="timeAllowed"
              value={form.timeAllowed || ''}
              readOnly={readOnly}
              placeholder="0.00"
              autoComplete="off"
              onChange={(e) => applyPatch({
                timeAllowed: e.target.value,
                _portScheduleMode: 'demurrageLaytime',
              })}
            />
          </Field>
          <Field id="demurrageBrokerPercent" label="Demm Comm (%)">
            <input
              id="demurrageBrokerPercent"
              value={form.demurrageBrokerPercent || ''}
              readOnly
            />
          </Field>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th style={{ width: '40%' }} />
                <th>Demm. Days</th>
                <th>Demm. Rate</th>
                <th>Estimated($)</th>
                <th>Actual($)</th>
                <th>Nett Value($)</th>
              </tr>
            </thead>
            <tbody>
              {(form.portLegs || []).flatMap((leg) => [
                <tr key={`${leg.id}-lp`}>
                  <td>{formatDemurrageLoadPortLabel(leg)}</td>
                  <td>
                    <input
                      value={leg.demmDaysLp || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => {
                        const demmDaysLp = e.target.value;
                        const ddcLpEst = formatDemurrageCostField(demmDaysLp, leg.demmRateLp);
                        updateRow('portLegs', leg.id, {
                          demmDaysLp,
                          ddcLpEst,
                          ddcLpReal: ddcLpEst,
                        });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.demmRateLp || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => {
                        const demmRateLp = e.target.value;
                        const ddcLpEst = formatDemurrageCostField(leg.demmDaysLp, demmRateLp);
                        updateRow('portLegs', leg.id, {
                          demmRateLp,
                          ddcLpEst,
                          ddcLpReal: ddcLpEst,
                        });
                      }}
                    />
                  </td>
                  <td>
                    <input value={leg.ddcLpEst || ''} readOnly placeholder="0.00" />
                  </td>
                  <td>
                    <input
                      value={leg.ddcLpReal || leg.ddcLpEst || ''}
                      readOnly
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <input value={leg.ddcLpNett || ''} readOnly placeholder="0.00" />
                  </td>
                </tr>,
                <tr key={`${leg.id}-dp`}>
                  <td>{formatDemurrageDischargePortLabel(leg)}</td>
                  <td>
                    <input
                      value={leg.demmDaysDp || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => {
                        const demmDaysDp = e.target.value;
                        const ddcDpEst = formatDemurrageCostField(demmDaysDp, leg.demmRateDp);
                        updateRow('portLegs', leg.id, {
                          demmDaysDp,
                          ddcDpEst,
                          ddcDpReal: ddcDpEst,
                        });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.demmRateDp || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => {
                        const demmRateDp = e.target.value;
                        const ddcDpEst = formatDemurrageCostField(leg.demmDaysDp, demmRateDp);
                        updateRow('portLegs', leg.id, {
                          demmRateDp,
                          ddcDpEst,
                          ddcDpReal: ddcDpEst,
                        });
                      }}
                    />
                  </td>
                  <td>
                    <input value={leg.ddcDpEst || ''} readOnly placeholder="0.00" />
                  </td>
                  <td>
                    <input
                      value={leg.ddcDpReal || leg.ddcDpEst || ''}
                      readOnly
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <input value={leg.ddcDpNett || ''} readOnly placeholder="0.00" />
                  </td>
                </tr>,
              ])}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} />
                <td className={styles.demurrageTotalLabel}>Total Nett Value($)</td>
                <td>
                  <input
                    id="demurrageNett"
                    value={form.demurrageNett || '0.00'}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CollapsiblePanel>

      
        <CollapsiblePanel
        title="Other Income"
        defaultOpen={false}
        actions={editable ? (
            <AddCircleButton
              onClick={() => addRow('otherIncomeRows', createEmptyOtherIncomeRow)}
            />
          ) : null}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                {editable ? <th style={{ width: 36 }} /> : null}
                <th>Description</th>
                <th>Amount</th>
                <th>Add Comm(%)</th>
                <th>Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {(form.otherIncomeRows || []).map((row) => (
                <tr key={row.id}>
                  {editable ? (
                    <td>
                      <RowRemoveButton onClick={() => removeRow('otherIncomeRows', row.id)} />
                    </td>
                  ) : null}
                  <td>
                    <input
                      value={row.description}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('otherIncomeRows', row.id, { description: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.amount}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('otherIncomeRows', row.id, { amount: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.addComm}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('otherIncomeRows', row.id, { addComm: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={row.netAmount} readOnly />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

      
        <CollapsiblePanel
        title="Bunkers"
        defaultOpen={false}
      >
        <div className={styles.tableWrap} style={{ marginBottom: 10 }}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Bunker Grade</th>
                <th>Qty. (MT)</th>
                <th>Actual Qty. (MT)</th>
                <th>Price (MT)</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {bunkerSummaryRows.length ? bunkerSummaryRows.map((row) => (
                <tr key={`summary-${row.grade}`}>
                  <td>{row.grade}</td>
                  <td><input value={row.qty || ''} readOnly placeholder="0.00" /></td>
                  <td><input value={row.actualQty || ''} readOnly placeholder="0.00" /></td>
                  <td>
                    <BunkerPriceInput
                      value={row.price || ''}
                      readOnly={readOnly}
                      onCommit={(next) => handleBunkerSummaryPriceChange(row.grade, next)}
                    />
                  </td>
                  <td><input value={row.amount || ''} readOnly placeholder="0.00" /></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className={styles.summaryEmptyCell}>No bunker summary available yet.</td>
                </tr>
              )}
              <tr>
                <td className={styles.summaryLabelCell}>Total Bunker Consumed - SECA/NON SECA</td>
                <td colSpan={4}>
                  <input value={form.totalBunkerCost || ''} readOnly placeholder="0.00" />
                </td>
              </tr>
              <tr>
                <td className={styles.summaryLabelCell}>CO2 Price / MT</td>
                <td>
                  <input
                    id="co2PriceInline"
                    value={form.co2Price || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    onChange={(e) => updateField('co2Price', e.target.value)}
                  />
                </td>
                <td className={styles.summaryLabelCell}>EUA Price / MT</td>
                <td>
                  <input
                    id="euaPriceInline"
                    value={form.euaPrice || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    onChange={(e) => updateField('euaPrice', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Vessel OPEX" defaultOpen={false}>
        <div className={styles.headerGrid}>
          <Field id="hireRate" label="Vessel OPEX">
            <input
              id="hireRate"
              value={form.hireRate || ''}
              readOnly={readOnly || estimateType === 3}
              inputMode="decimal"
              autoComplete="off"
              onChange={(e) => {
                const value = sanitizeFieldDecimal('hireRate', e.target.value);
                // Cleared field must stay empty; otherwise hire row rate re-seeds and inflates TCE wrongly when missing.
                applyPatch({
                  hireRate: value,
                  _hireRateCleared: value === '' || value == null,
                });
              }}
            />
          </Field>
          <Field id="addCommPercent" label="Add Comm (%)">
            <input
              id="addCommPercent"
              value={form.addCommPercent || ''}
              readOnly={readOnly}
              inputMode="decimal"
              autoComplete="off"
              onChange={(e) => {
                const value = sanitizeFieldDecimal('addCommPercent', e.target.value);
                // PHP setCveAmtInTcDet: dummyAdcom → txtHireargePercent
                applyPatch({ addCommPercent: value, hireagePercent: value });
              }}
            />
          </Field>
          <Field id="addressCommAmt" label="Add Comm Amt">
            <input id="addressCommAmt" value={form.addressCommAmt || ''} readOnly />
          </Field>
          <Field id="ballastBonus" label="Ballast Bonus">
            <input {...inputProps('ballastBonus', { recalc: true })} />
          </Field>
          <Field id="hireagePercent" label="Hireage Add Comm (%)">
            <input {...inputProps('hireagePercent', { recalc: true })} placeholder="0.00" />
          </Field>
          <Field id="hireageBroPercent" label="Hireage Brokerage (%)">
            <input {...inputProps('hireageBroPercent', { recalc: true })} placeholder="0.00" />
          </Field>
          <Field id="hireAmt" label="Hire Amt">
            <input
              id="hireAmt"
              value={form.hireAmt || ''}
              readOnly
              placeholder="0.00"
            />
          </Field>
          <Field id="lessOffHire" label="Less Off Hire">
            <input id="lessOffHire" value={form.lessOffHire || form.totalOffHireAmt || ''} readOnly placeholder="0.00" />
          </Field>
          <Field id="vesselDailyOps" label="Vessel Daily Ops">
            <input {...inputProps('vesselDailyOps', { recalc: true })} />
          </Field>
        </div>
        <div className={styles.headerGrid} style={{ marginTop: 8 }}>
          <Field id="cvePerMonth" label="CVE (/Month)">
            <input {...inputProps('cvePerMonth', { recalc: true })} />
          </Field>
          <Field id="cveAmt" label="CVE">
            <input id="cveAmt" value={form.cveAmt || ''} readOnly placeholder="0.00" />
          </Field>
          <Field id="offHireCve" label="CVE Off Hire (/Month)">
            <input {...inputProps('offHireCve', { recalc: true })} placeholder="0.00" />
          </Field>
          <Field id="offHireCveAmt" label="CVE Off Hire Amt">
            <input id="offHireCveAmt" value={form.offHireCveAmt || ''} readOnly placeholder="0.00" />
          </Field>
        </div>
      </CollapsiblePanel>


{estimateType === 3 ? (
        <CollapsiblePanel title="Dry Cargo — Floating / Fixed / Average" defaultOpen={false}>
            <div className={styles.headerGrid}>
              <Field id="gasBaltic" label="Baltic Rate">
                <input {...inputProps('gasBaltic', { recalc: true })} />
              </Field>
              <Field id="gasBaseRate" label="Base Rate">
                <input {...inputProps('gasBaseRate')} />
              </Field>
              <Field id="addnlPremium" label="Addnl Premium">
                <input {...inputProps('addnlPremium')} />
              </Field>
              <Field id="baseRateFloat" label="Base Float">
                <input {...inputProps('baseRateFloat')} />
              </Field>
              <Field id="baseRateFixed" label="Base Fixed">
                <input {...inputProps('baseRateFixed')} />
              </Field>
              <Field id="baseRateAverage" label="Base Average">
                <input {...inputProps('baseRateAverage')} />
              </Field>
              <Field id="grossFreightFloat" label="Gross Float">
                <input {...inputProps('grossFreightFloat')} />
              </Field>
              <Field id="grossFreightFixed" label="Gross Fixed">
                <input {...inputProps('grossFreightFixed')} />
              </Field>
              <Field id="grossFreightAverage" label="Gross Average">
                <input {...inputProps('grossFreightAverage')} />
              </Field>
              <Field id="netFreightFloat" label="Net Float">
                <input {...inputProps('netFreightFloat')} />
              </Field>
              <Field id="netFreightFixed" label="Net Fixed">
                <input {...inputProps('netFreightFixed')} />
              </Field>
              <Field id="netFreightAverage" label="Net Average">
                <input {...inputProps('netFreightAverage')} />
              </Field>
              <Field id="tceFloat" label="TCE Float">
                <input {...inputProps('tceFloat')} />
              </Field>
              <Field id="tceFixed" label="TCE Fixed">
                <input {...inputProps('tceFixed')} />
              </Field>
              <Field id="tceAverage" label="TCE Average">
                <input {...inputProps('tceAverage')} />
              </Field>
            </div>
        </CollapsiblePanel>
      ) : null}

      
      </div>

      <aside className={styles.estimateAside}>
        <div className={`${styles.estimateAsideInner} ${styles.resultsAside}`}>
          <EstimateResultsPanels
            form={form}
            readOnly={readOnly}
            complianceYear={lookups.complianceYear || new Date().getFullYear()}
            onFieldChange={onFieldChange}
            onRecalc={onRecalc}
          />
          <CollapsiblePanel
            title="Profit Sharing"
            defaultOpen={false}
            actions={editable ? (
              <AddCircleButton
                onClick={() => addRow('profitSharingRows', createEmptyProfitSharingRow)}
              />
            ) : null}
          >
            <div className={styles.tableWrap}>
              <table className={styles.portTable}>
                <thead>
                  <tr>
                    {editable ? <th style={{ width: 36 }} /> : null}
                    <th>Company</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {(form.profitSharingRows || []).map((row) => (
                    <tr key={row.id}>
                      {editable ? (
                        <td>
                          <RowRemoveButton onClick={() => removeRow('profitSharingRows', row.id)} />
                        </td>
                      ) : null}
                      <td>
                        <select
                          value={row.vendorId || ''}
                          disabled={readOnly}
                          onChange={(e) => updateRow('profitSharingRows', row.id, { vendorId: e.target.value })}
                        >
                          <option value="">— Select —</option>
                          {(lookups.ownBusiness || lookups.owners || []).map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={row.percentage || ''}
                          readOnly={readOnly}
                          placeholder="0.00"
                          onChange={(e) => updateRow('profitSharingRows', row.id, { percentage: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsiblePanel>
        </div>
      </aside>

      {editable ? (
        <DistanceFetchModal
          open={Boolean(distanceLegId)}
          leg={(form.portLegs || []).find((row) => row.id === distanceLegId) || null}
          onClose={() => setDistanceLegId(null)}
          onConfirm={handleDistanceConfirm}
        />
      ) : null}
      <VesselItineraryModal
        open={itineraryOpen}
        onClose={() => setItineraryOpen(false)}
        form={form}
      />
    </div>
  );
}


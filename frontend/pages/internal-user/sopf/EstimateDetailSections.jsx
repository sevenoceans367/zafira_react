import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AddCircleButton, AttachmentDropzone, Button, DmyDateInput, RowAddButton, RowDelButton, useAlert } from '@bainbridge/shared-ui';
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
  createDefaultOrcRow,
  createEmptyOtherIncomeRow,
  createEmptyPortLeg,
  createEmptyProfitSharingRow,
  createEmptyConsumptionRow,
  createEmptySecaBunkerRow,
  getFixtureTypeLabel,
  seedPortLegsFromFirstCargo,
} from './estimateDetail.constants.js';
import { formatDemurrageCostField, calcSeaDays, calcSeaDaysWithSeca, pickPassageSpeedKnots, buildBunkerSummaryRows, calcDemurrageCommissionDisplay, resolveNrtFromGnrt, classifyBunkerGradeName, formatDemurrageLoadPortLabel, formatDemurrageDischargePortLabel, formatDays, formatDistance, syncPortstayFromPassageDates } from './estimateCalculations.js';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import RowRemoveButton from './RowRemoveButton.jsx';

import DistanceFetchModal from './DistanceFetchModal.jsx';
import TankerFreightModeSection from './TankerFreightModeSection.jsx';
import { DryFreightModeSection, GasFreightModeSection } from './EstimateTypeCargoFreight.jsx';
import PortLaytimeSections from './PortLaytimeSections.jsx';
import EstimateResultsPanels from './EstimateResultsPanels.jsx';
import VesselItineraryModal from './VesselItineraryModal.jsx';
import HireDetailsModal from '../ops/voyage-financials/HireDetailsModal.jsx';
import { checkVoyageNoExists, fetchCanalOrcRates, searchEstimatePorts } from '../../../services/estimateDetail.js';
import { focusEstimateValidationField, getAddRowBlockMessage } from './estimateValidation.js';
import { sanitizeDecimalInput, sanitizeFieldDecimal, sanitizeEstimatePatch, ESTIMATE_DECIMAL_FIELDS } from './estimateInputSanitize.js';
import styles from './UpdateEstimatePage.module.css';
import WorksheetSelect, { gradeChipClass } from '../ops/voyage-financials/WorksheetSelect.jsx';
import voyStyles from '../ops/voyage-financials/CostSheetEstimatePage.module.css';

/** PHP addestimate.php — Voyage No allows a-z, 0-9, and hyphen only. */
function sanitizeVoyageNo(value) {
  return String(value || '').replace(/[^a-zA-Z0-9-]/g, '');
}

function BunkerPriceInput({ value, readOnly, onCommit }) {
  const [draft, setDraft] = useState(null);
  const editing = draft !== null;

  const commitPrice = (raw, { normalize = false } = {}) => {
    const cleaned = sanitizeDecimalInput(raw ?? '');
    const next = normalize
      ? (cleaned === '' || cleaned === '.'
        ? ''
        : Number.isFinite(Number(cleaned))
          ? Number(cleaned).toFixed(2)
          : '')
      : cleaned;
    if (String(next) !== String(value || '')) {
      onCommit(next);
    }
  };

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
      onChange={(e) => {
        const next = sanitizeDecimalInput(e.target.value);
        setDraft(next);
        commitPrice(next);
      }}
      onBlur={() => {
        const raw = draft ?? '';
        setDraft(null);
        commitPrice(raw, { normalize: true });
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

function PassagePlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function PassageTrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M6 7V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function KhakiRowActions({ onAdd, onRemove, removeDisabled = false }) {
  return (
    <div className={styles.khakiRowActions}>
      <RowAddButton title="Add" onClick={onAdd}>
        <PassagePlusIcon />
      </RowAddButton>
      <RowDelButton title="Remove" disabled={removeDisabled} onClick={onRemove}>
        <PassageTrashIcon />
      </RowDelButton>
    </div>
  );
}

function SecAddButton({ onClick, title = 'Add row' }) {
  return (
    <div className={styles.panelActionGroup}>
      <RowAddButton className={styles.secAddBtn} title={title} onClick={onClick}>
        <PassagePlusIcon />
      </RowAddButton>
    </div>
  );
}

function Field({ id, label, children, className = '', api = false, required = false }) {
  return (
    <div className={[
      styles.field,
      api ? styles.apiField : '',
      required ? styles.requiredField : '',
      className,
    ].filter(Boolean).join(' ')}>
      <label htmlFor={id}>
        {label}
      </label>
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
  variant = '',
}) {
  const estimateType = Number(detail?.estimateType) || 2;
  const isGas = estimateType === 1;
  const isTanker = estimateType === 2;
  const isDry = estimateType === 3;
  const isCoaSpot = String(form.coaSpot || '') === '2';
  const fixtureType = String(form.fixtureTypeId ?? '');
  // PHP makeFieldManD: hire table for TCIN/VCIN (1|2); Vessel Daily Ops for VCOUT (3)
  const showHireSection = fixtureType === '1' || fixtureType === '2';
  const showVesselDailyOps = fixtureType === '3';
  // PHP .tcin — Hire Details button only for TCIN-VCOUT
  const showHireDetailsButton = fixtureType === '1';
  // PHP updatecost_sheet_tci_in — VCIN-VCOUT opens the VC-In worksheet
  const showVcInButton = fixtureType === '2' && variant !== 'vc-in';
  const showIndexLinked = isDry && showHireSection;
  const editable = !readOnly;
  const alert = useAlert();
  const [searchParams] = useSearchParams();
  const [distanceLegId, setDistanceLegId] = useState(null);
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [hireDetailsOpen, setHireDetailsOpen] = useState(false);

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
  const estimateId = searchParams.get('id') || detail?.id || '';
  const estimateTypeParam = searchParams.get('estimatetype')
    || searchParams.get('selBType')
    || String(detail?.estimateType || estimateType || '2');
  const businessTypeParam = searchParams.get('selBType') || estimateTypeParam;
  const costSheetId = searchParams.get('cost_sheet_id') || searchParams.get('costSheetId') || '';
  const vcInHref = (() => {
    if (!showVcInButton) return '';
    if (Number(sofComId) > 0) {
      return appPath(
        `/internal-user/vc/ops/cost-sheet-in?comid=${encodeURIComponent(sofComId)}&page=${encodeURIComponent(sofPage)}${costSheetId ? `&cost_sheet_id=${encodeURIComponent(costSheetId)}` : ''}`,
      );
    }
    if (!estimateId) return '';
    const params = new URLSearchParams();
    params.set('id', estimateId);
    params.set('estimatetype', estimateTypeParam);
    params.set('selBType', businessTypeParam);
    params.set('variant', 'vc-in');
    const returnTo = searchParams.get('returnTo');
    if (returnTo) params.set('returnTo', returnTo);
    return appPath(`/internal-user/sopf/${readOnly ? 'viewestimate' : 'updateestimate'}?${params}`);
  })();

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
      || Object.prototype.hasOwnProperty.call(cleanPatch, 'lumpsumQty')
      || Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoQuantity');
    if (touchesCargo && !Object.prototype.hasOwnProperty.call(cleanPatch, 'portLegs')) {
      const syncQty = Object.prototype.hasOwnProperty.call(cleanPatch, 'lumpsumQty')
        || Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoQuantity');
      cleanPatch.portLegs = seedPortLegsFromFirstCargo(
        form.portLegs,
        cleanPatch.cargoRows || form.cargoRows,
        Object.prototype.hasOwnProperty.call(cleanPatch, 'lumpsumQty')
          ? cleanPatch.lumpsumQty
          : form.lumpsumQty,
        {
          syncQty,
          cargoQuantity: Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoQuantity')
            ? cleanPatch.cargoQuantity
            : form.cargoQuantity,
        },
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
        nextOrcs = remaining.length ? remaining : [createDefaultOrcRow(lookups.ownerCosts)];
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
    // Multiple: Qty syncs to sum of all Main Cargo Details Cargo (MT)
    if (
      collection === 'cargoRows'
      && (
        Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoMt')
        || Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoId')
      )
    ) {
      applyPatch({
        cargoRows: rows,
        portLegs: seedPortLegsFromFirstCargo(
          form.portLegs,
          rows,
          form.lumpsumQty,
          { syncQty: true, cargoQuantity: form.cargoQuantity },
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

      // Switching L/B → Laden: seed Port Details cargo + Qty (MT) if still empty
      if (keys.includes('passageType') && String(cleanPatch.passageType) === '2') {
        rows = seedPortLegsFromFirstCargo(rows, form.cargoRows, form.lumpsumQty, {
          cargoQuantity: form.cargoQuantity,
        });
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
      // PHP addPortRotationDetails: from_arrival / from_departure = previous to_departure
      if (prev?.toDeparture) {
        next.fromArrival = prev.toDeparture;
        next.fromDeparture = prev.toDeparture;
      }
      // Port Details LP/DP only list Laden (passageType=2). Carry L/B + cargo/qty
      // from the previous leg so a new leg appears with Cargo (MT) filled.
      if (prev?.passageType) next.passageType = prev.passageType;
      else if ((form.cargoRows || []).some((row) => String(row.cargoId || '').trim())) {
        next.passageType = '2';
      }
      if (prev?.lpCargoId) next.lpCargoId = prev.lpCargoId;
      if (prev?.dpCargoId) next.dpCargoId = prev.dpCargoId;
      if (prev?.loadQty) next.loadQty = prev.loadQty;
      if (prev?.dischargeQty) next.dischargeQty = prev.dischargeQty;
      const seeded = seedPortLegsFromFirstCargo(
        [next],
        form.cargoRows,
        form.lumpsumQty,
        { cargoQuantity: form.cargoQuantity },
      )[0] || next;
      const rows = [...(form.portLegs || []), seeded];
      applyPatch({
        portLegs: rows,
        _portScheduleMode: 'fromArrival',
        _portScheduleLegId: seeded.id,
      });
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
    const isReplicate = Boolean(isAdd && (form.replicateFrom || form.allowSameVoyage));
    try {
      const exists = await checkVoyageNoExists(voyageNo, {
        excludeId: voyageExcludeId,
        estimateNo: form.estimateNo || 1,
        allowSameVoyage: isReplicate || !isAdd,
      });
      if (!exists) return;
      await alert({
        title: 'Alert',
        message: isReplicate || !isAdd
          ? 'Voyage / estimate number combination already exists'
          : 'Voyage number already exists',
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
        // Cargo Qty (MT) / lump-sum qty → seed Port Details LP/DP Qty
        if (key === 'lumpsumQty') {
          applyPatch({ lumpsumQty: value });
          return;
        }
        // Single dry/gas QTY (MT) → same Port Details sync path as lumpsum qty
        if (key === 'cargoQuantity') {
          applyPatch({ cargoQuantity: value });
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
  const bunkerQtyTotal = bunkerSummaryRows.reduce((sum, row) => {
    const n = Number(row.qty);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
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
          <div className={`${styles.headerGrid} ${styles.headerGridIdent}`}>
            <Field id="fixtureTypeId" label="Contract Type">
              {readOnly ? (
                <input id="fixtureTypeId" value={getFixtureTypeLabel(form.fixtureTypeId)} readOnly />
              ) : (
                <WorksheetSelect
                  id="fixtureTypeId"
                  value={String(form.fixtureTypeId ?? '')}
                  placeholder="Select from list"
                  options={[
                    { value: '', label: 'Select from list' },
                    ...FIXTURE_TYPE_OPTIONS,
                  ]}
                  onChange={(value) => {
                    const patch = { fixtureTypeId: value };
                    // PHP makeFieldManD: VCOUT hides hire / clears index; TCIN/VCIN clear Vessel Daily Ops
                    if (value === '3') {
                      patch.chkHire = false;
                      patch.chkIndex = false;
                      patch.balticIndex = '';
                      patch.balticPercent = '100';
                      patch.balticRate = '';
                      patch.totalHireRate = '';
                    } else if (value === '1' || value === '2') {
                      patch.vesselDailyOps = '';
                    }
                    applyPatch(patch);
                  }}
                />
              )}
            </Field>

            <Field id="vesselName" label="Vessel" api className={styles.apiEditable}>
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

            <Field id="vesselType" label="Vessel Type" api>
              <input id="vesselType" value={form.vesselType || ''} readOnly />
            </Field>
            <Field id="flag" label="Flag" api>
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
            <Field id="voyageNo" label="Voyage No." required className={styles.voyageNoField}>
              <input
                id="voyageNo"
                value={form.voyageNo}
                readOnly={readOnly}
                autoComplete="off"
                onChange={(e) => handleVoyageNoChange(e.target.value)}
                onBlur={handleVoyageNoBlur}
              />
            </Field>
            <Field id="estimateNo" label="Estimate No." api>
              <input
                id="estimateNo"
                value={form.voyageNo
                  ? `Est${Number(form.estimateNo) > 0 ? Number(form.estimateNo) : 1}`
                  : ''}
                readOnly
                placeholder="Est1"
              />
            </Field>
            <Field id="estimateType" label="Trade Type" api>
              <input id="estimateType" value={detail.estimateTypeLabel} readOnly />
            </Field>
            <Field id="sdrToUsd" label="SDR Rate">
              <input {...inputProps('sdrToUsd', { recalc: true })} />
            </Field>
            <Field id="scnt" label="SCNT" api>
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
            <Field id="periodId" label="Link Period Contract">
              <WorksheetSelect
                id="periodId"
                value={form.periodId || ''}
                disabled={readOnly}
                placeholder="— Select —"
                options={[
                  { value: '', label: '— Select —' },
                  ...(lookups.periodContracts || []).map((row) => ({
                    value: row.id,
                    label: row.label || row.id,
                  })),
                ]}
                onChange={(value) => {
                  updateField('periodId', value);
                  onPeriodContractChange?.(value);
                }}
              />
            </Field>
            <Field id="charteringTeam" label="Chartering Team">
              <WorksheetSelect
                id="charteringTeam"
                value={form.charteringTeam || ''}
                disabled={readOnly}
                placeholder="— Select —"
                options={[
                  { value: '', label: '— Select —' },
                  ...(lookups.charteringTeams || []).map((row) => ({
                    value: row.id,
                    label: row.name,
                  })),
                ]}
                onChange={(value) => updateField('charteringTeam', value)}
              />
            </Field>
            <Field id="charteringPic" label="Chartering PIC">
              <WorksheetSelect
                id="charteringPic"
                value={form.charteringPic || ''}
                disabled={readOnly}
                placeholder="— Select —"
                options={[
                  { value: '', label: '— Select —' },
                  ...(() => {
                    const options = [...(lookups.charteringPics || [])];
                    const id = form.charteringPic != null ? String(form.charteringPic) : '';
                    if (id && !options.some((row) => String(row.id) === id)) {
                      options.unshift({ id, name: form.charteringPicName || id });
                    }
                    return options.map((row) => ({ value: row.id, label: row.name }));
                  })(),
                ]}
                onChange={(value) => updateField('charteringPic', value)}
              />
            </Field>
          </div>
      </CollapsiblePanel>

       <CollapsiblePanel title="Fixed Vessel Particulars" defaultOpen={false}>
          <div className={`${styles.headerGrid} ${styles.headerGridAuto}`}>
            <Field id="builtYear" label="Built Year" api className={styles.apiEditable}>
              <input {...inputProps('builtYear')} />
            </Field>
            <Field id="gnrt" label="GRT" api className={styles.apiEditable}>
              <input {...inputProps('gnrt')} />
            </Field>
            <Field id="nrt" label="NRT" api>
              <input
                id="nrt"
                value={form.nrt || (form.gnrt ? (Number(String(form.gnrt).split('/')[0] || form.gnrt) * 0.7).toFixed(2) : '')}
                readOnly
              />
            </Field>
            <Field id="loa" label="LOA (M)" api className={styles.apiEditable}>
              <input {...inputProps('loa')} />
            </Field>
            <Field id="beam" label="Beam (M)" api className={styles.apiEditable}>
              <input {...inputProps('beam')} />
            </Field>
            <Field id="dwtSummer" label="DWT (Summer)" api className={styles.apiEditable}>
              <input {...inputProps('dwtSummer')} />
            </Field>
            <Field id="dwtTropical" label="DWT (Tropical)" api className={styles.apiEditable}>
              <input {...inputProps('dwtTropical')} />
            </Field>
            <Field id="tpc" label="TPC" api className={styles.apiEditable}>
              <input {...inputProps('tpc')} />
            </Field>
            {!isTanker ? (
              <Field id="gear" label="Gear">
                <input {...inputProps('gear')} />
              </Field>
            ) : null}
            {!isTanker ? (
              <>
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
              </>
            ) : null}
          </div>
      </CollapsiblePanel>

      
        <CollapsiblePanel
        title="Passage & Ports"
        defaultOpen
        round
        className={voyStyles.roundSection}
        actions={(
          <div className={voyStyles.panelActionGroup}>
            {sofHref ? (
              <Link
                to={sofHref}
                className={`${voyStyles.panelActionBtn} ${voyStyles.panelActionBtnAccent}`}
                aria-label="SOF"
                title="Statement of Facts"
              >
                SOF
              </Link>
            ) : null}
            <button
              type="button"
              className={`${voyStyles.panelActionBtn} ${voyStyles.panelActionBtnOutline}`}
              aria-label="Itinerary"
              title="Itinerary"
              onClick={() => setItineraryOpen(true)}
            >
              Itinerary
            </button>
          </div>
        )}
      >
        <div className={voyStyles.portLegsStack}>
          {(form.portLegs || []).map((leg, legIndex) => {
            const isLastLeg = legIndex === (form.portLegs || []).length - 1;
            return (
            <div key={leg.id} className={voyStyles.portLegCard}>
              <table className={`${voyStyles.portTable} ${voyStyles.portLegConnected}`}>
                <colgroup>
                  <col className={voyStyles.portIdxCol} />
                  <col className={voyStyles.portCol} />
                  <col className={`${voyStyles.dateCol} ${styles.dateCol}`} />
                  <col className={`${voyStyles.dateCol} ${styles.dateCol}`} />
                  <col className={`${voyStyles.wxCol} ${styles.wxCol}`} />
                  <col className={`${voyStyles.lbCol} ${styles.lbCol}`} />
                  <col className={`${voyStyles.speedTypeCol} ${styles.speedTypeCol}`} />
                  <col className={`${voyStyles.routeCol} ${styles.routeCol}`} />
                  <col className={voyStyles.distCol} />
                  <col className={voyStyles.distCol} />
                </colgroup>
                <thead>
                  <tr>
                    <th className={voyStyles.portIdxCol}>#</th>
                    <th className={voyStyles.portCol}>From Port</th>
                    <th className={`${voyStyles.dateCol} ${styles.dateCol}`}>{legIndex > 0 ? 'Arrival' : ''}</th>
                    <th className={`${voyStyles.dateCol} ${styles.dateCol}`}>Departure</th>
                    <th className={`${voyStyles.wxCol} ${styles.wxCol}`}>Wx(%)</th>
                    <th className={`${voyStyles.lbCol} ${styles.lbCol}`}>L/B</th>
                    <th className={`${voyStyles.speedTypeCol} ${styles.speedTypeCol}`}>Speed Type</th>
                    <th className={`${voyStyles.routeCol} ${styles.routeCol}`}>Route</th>
                    <th className={voyStyles.distCol}>Total Dist</th>
                    <th className={voyStyles.distCol}>Total Days</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={voyStyles.portIdxCol}>
                      <span className={voyStyles.portIdxNum}>{legIndex + 1}</span>
                    </td>
                    <td className={voyStyles.portCol}>
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
                    <td className={`${voyStyles.dateCol} ${styles.dateCol}`}>
                      {legIndex > 0 ? (
                        readOnly ? (
                          <input value={leg.fromArrival || ''} readOnly />
                        ) : (
                          <DmyDateInput
                            id={`fromArrival_${leg.id}`}
                            enableTime
                            className=""
                            value={leg.fromArrival || ''}
                            onChange={(value) => updateRow('portLegs', leg.id, { fromArrival: value })}
                          />
                        )
                      ) : null}
                    </td>
                    <td className={`${voyStyles.dateCol} ${styles.dateCol}`}>
                      {readOnly ? (
                        <input value={leg.fromDeparture || ''} readOnly />
                      ) : (
                        <DmyDateInput
                          id={`fromDeparture_${leg.id}`}
                          enableTime
                          className=""
                          value={leg.fromDeparture || ''}
                          onChange={(value) => updateRow('portLegs', leg.id, { fromDeparture: value })}
                        />
                      )}
                    </td>
                    <td className={`${voyStyles.wxCol} ${styles.wxCol}`}>
                      <input
                        value={leg.seaMargin ?? ''}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('portLegs', leg.id, { seaMargin: e.target.value })}
                      />
                    </td>
                    <td className={`${voyStyles.lbCol} ${styles.lbCol}`}>
                      <WorksheetSelect
                        id={legIndex === 0 ? 'portPassage_0' : `portPassage_${legIndex}`}
                        value={leg.passageType}
                        disabled={readOnly}
                        options={PASSAGE_TYPE_OPTIONS}
                        onChange={(value) => updateRow('portLegs', leg.id, { passageType: value })}
                      />
                    </td>
                    <td className={`${voyStyles.speedTypeCol} ${styles.speedTypeCol}`}>
                      <WorksheetSelect
                        id={legIndex === 0 ? 'portSpeed_0' : `portSpeed_${legIndex}`}
                        value={leg.speedType}
                        disabled={readOnly}
                        options={SPEED_TYPE_OPTIONS}
                        onChange={(value) => updateRow('portLegs', leg.id, { speedType: value })}
                      />
                    </td>
                    <td className={`${voyStyles.routeCol} ${styles.routeCol}`}>
                      {editable ? (
                        <button
                          type="button"
                          className={voyStyles.fetchBtn}
                          onClick={() => openDistanceFetch(leg)}
                        >
                          Sync
                        </button>
                      ) : null}
                    </td>
                    <td className={voyStyles.distCol}>
                      <input
                        id={legIndex === 0 ? 'portDistance_0' : `portDistance_${legIndex}`}
                        value={leg.distance}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('portLegs', leg.id, { distance: e.target.value })}
                      />
                    </td>
                    <td className={voyStyles.distCol}>
                      <input value={leg.seaDays || ''} readOnly />
                    </td>
                  </tr>
                </tbody>
                <thead>
                  <tr>
                    <th className={voyStyles.portIdxCol} />
                    <th className={voyStyles.portCol}>To Port</th>
                    <th className={voyStyles.dateCol}>Arrival</th>
                    <th className={voyStyles.dateCol}>Departure</th>
                    <th className={voyStyles.bgCol}>BG</th>
                    <th className={voyStyles.nsecaCol}>NSECA Dist</th>
                    <th className={voyStyles.nsecaCol}>NSECA Days</th>
                    <th className={voyStyles.bgCol}>BG</th>
                    <th className={voyStyles.nsecaCol}>SECA Dist</th>
                    <th className={voyStyles.nsecaCol}>SECA Days</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={voyStyles.portIdxCol}>
                      {editable && isLastLeg ? (
                        <div className={voyStyles.portIdxActions}>
                          <RowAddButton
                            title="Add passage leg"
                            onClick={() => addRow('portLegs', createEmptyPortLeg)}
                          />
                          <RowDelButton
                            title="Delete leg"
                            onClick={() => removeRow('portLegs', leg.id)}
                            disabled={(form.portLegs || []).length <= 1}
                          />
                        </div>
                      ) : null}
                    </td>
                    <td className={voyStyles.portCol}>
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
                    <td className={voyStyles.dateCol}>
                      {readOnly ? (
                        <input value={leg.toArrival || ''} readOnly />
                      ) : (
                        <DmyDateInput
                          id={`toArrival_${leg.id}`}
                          enableTime
                          className=""
                          value={leg.toArrival || ''}
                          onChange={(value) => updateRow('portLegs', leg.id, { toArrival: value })}
                        />
                      )}
                    </td>
                    <td className={voyStyles.dateCol}>
                      {readOnly ? (
                        <input value={leg.toDeparture || ''} readOnly />
                      ) : (
                        <DmyDateInput
                          id={`toDeparture_${leg.id}`}
                          enableTime
                          className=""
                          value={leg.toDeparture || ''}
                          onChange={(value) => updateRow('portLegs', leg.id, { toDeparture: value })}
                        />
                      )}
                    </td>
                    <td className={voyStyles.bgCol}>
                      <WorksheetSelect
                        value={leg.bgNonSeca || 'VLSFO'}
                        gradeLabel={leg.bgNonSeca || 'VLSFO'}
                        disabled={readOnly}
                        options={NSBG_OPTIONS}
                        onChange={(value) => updateRow('portLegs', leg.id, { bgNonSeca: value })}
                      />
                    </td>
                    <td className={voyStyles.nsecaCol}>
                      <input value={leg.nonSecaDistance || ''} readOnly />
                    </td>
                    <td className={voyStyles.nsecaCol}>
                      <input value={leg.nonSecaDays || ''} readOnly />
                    </td>
                    <td className={voyStyles.bgCol}>
                      <WorksheetSelect
                        value={leg.bgSeca || 'LSMGO'}
                        gradeLabel={leg.bgSeca || 'LSMGO'}
                        disabled={readOnly}
                        options={SBG_OPTIONS}
                        onChange={(value) => updateRow('portLegs', leg.id, { bgSeca: value })}
                      />
                    </td>
                    <td className={voyStyles.nsecaCol}>
                      <input
                        value={leg.secaDistance || ''}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('portLegs', leg.id, { secaDistance: e.target.value })}
                      />
                    </td>
                    <td className={voyStyles.nsecaCol}>
                      <input value={leg.secaDays || ''} readOnly />
                    </td>
                  </tr>
                </tbody>
              </table>
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
          // Fresh Spot style: always keep editable FO + DO consumption rows available.
          const baseRows = form.consumptionRows || [];
          const hasFo = baseRows.some((row) => String(row.identify || 'FO').toUpperCase() === 'FO');
          const hasDo = baseRows.some((row) => String(row.identify || '').toUpperCase() === 'DO');
          const consumptionRows = (!hasFo || !hasDo)
            ? [
              ...baseRows,
              ...(!hasFo ? [createEmptyConsumptionRow('FO')] : []),
              ...(!hasDo ? [createEmptyConsumptionRow('DO')] : []),
            ]
            : baseRows;
          const foRows = consumptionRows.filter((row) => (
            String(row.identify || 'FO').toUpperCase() === 'FO'
          ));
          const doRows = consumptionRows.filter((row) => (
            String(row.identify || '').toUpperCase() === 'DO'
          ));
          const gradeName = (id) => (
            (lookups.bunkerGrades || []).find((g) => String(g.id) === String(id))?.name || id || '—'
          );

          const commitConsumptionPatch = (rowId, patch) => {
            const existingIds = new Set((form.consumptionRows || []).map((row) => row.id));
            if (existingIds.has(rowId)) {
              updateRow('consumptionRows', rowId, patch);
              return;
            }
            const nextRows = consumptionRows.map((row) => (
              row.id === rowId ? { ...row, ...patch } : row
            ));
            if (onRecalc) onRecalc('consumptionRows', nextRows);
            else applyPatch({ consumptionRows: nextRows });
          };

          const renderConsTable = (title, rows, identify, columns) => {
            const dataCols = columns;
            return (
            <div className={styles.consBlock}>
              <div className={styles.consTitle}>{title}</div>
              <div className={styles.tableWrap}>
                <table className={`${styles.portTable} ${styles.flushGrid} ${styles.conspTable}`}>
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
                            <span className={`${voyStyles.gradeChip} ${gradeChipClass(gradeName(row.bunkerGradeId))}`.trim()}>
                              {gradeName(row.bunkerGradeId)}
                            </span>
                          ) : (
                            <WorksheetSelect
                              value={row.bunkerGradeId || ''}
                              gradeLabel={gradeName(row.bunkerGradeId)}
                              placeholder="Select"
                              options={(lookups.bunkerGrades || []).map((g) => ({ value: String(g.id), label: g.name }))}
                              onChange={(value) => commitConsumptionPatch(row.id, {
                                bunkerGradeId: value,
                                identify,
                              })}
                            />
                          )}
                        </td>
                        {dataCols.map((col) => (
                          <td key={col.key}>
                            <input
                              value={row[col.key] ?? ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => commitConsumptionPatch(row.id, {
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
              <div className={`${styles.headerGrid} ${styles.gridF3}`}>
                <Field id="speedDataType" label="Speed Data">
                  <WorksheetSelect
                    id="speedDataType"
                    value={speedDataType}
                    disabled={readOnly}
                    options={SPEED_DATA_OPTIONS}
                    onChange={(value) => updateField('speedDataType', value)}
                  />
                </Field>
                <Field id={ballastKey} label="Ballast Speed (Knots)" api className={styles.apiEditable}>
                  <input {...inputProps(ballastKey, { recalc: true })} placeholder="0.00" />
                </Field>
                <Field id={ladenKey} label="Laden Speed (Knots)" api className={styles.apiEditable}>
                  <input {...inputProps(ladenKey, { recalc: true })} placeholder="0.00" />
                </Field>
              </div>
              <div className={styles.conspGroupHead}>At Sea / In Port (SECA & NON-SECA)</div>
              {renderConsTable('FO Consp/day (MT)', foRows, 'FO', atSeaCols)}
              {renderConsTable('DO Consp/day (MT)', doRows, 'DO', atSeaCols)}
              <div className={styles.conspGroupHead}>Others</div>
              {renderConsTable('FO Consp/day (MT)', foRows, 'FO', CONSUMPTION_OTHERS_COLUMNS)}
              {renderConsTable('DO Consp/day (MT)', doRows, 'DO', CONSUMPTION_OTHERS_COLUMNS)}
            </>
          );
        })()}
      </CollapsiblePanel>
      


      

      
        <CollapsiblePanel
        title="Cargo"
        defaultOpen
      >
        <div className={styles.cargoHeaderGrid}>
          {!(!isGas && String(form.tankType || '1') === '2') ? (
          <Field id="cargoId_0" label="Cargo Name" className={styles.cargoMultiSelectField}>
            <div id="cargoId_0" className={`${styles.cargoMultiSelectWrap} ${styles.cargoChipsOrange}`}>
              {(() => {
                const cargoLookup = (lookups.cargos || [])
                  .map((c) => ({
                    id: String(c.id ?? c.MATERIALID ?? ''),
                    name: String(c.name ?? c.MATERIAL_TYPE ?? '').trim(),
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
                chipTone="cargo"
                options={[...optionMap.values()]}
                value={selectedCargoIds}
                disabled={readOnly || isCoaSpot}
                placeholder="Choose cargo…"
                searchPlaceholder="Search cargo…"
                onChange={(selected) => {
                  if (isCoaSpot) return;
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
          <Field id="freightGrossCargoHeader" label="Total Freight">
            <input id="freightGrossCargoHeader" value={form.freightGross || ''} readOnly />
          </Field>
        </div>

        {isGas ? (
          <GasFreightModeSection
            form={form}
            readOnly={readOnly}
            inputProps={inputProps}
            applyPatch={applyPatch}
            onRecalc={onRecalc}
          />
        ) : null}
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
        ) : null}
        {isDry ? (
          <DryFreightModeSection
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
        ) : null}
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Commissions"
        defaultOpen
        bodyClassName={styles.panelBodyFlush}
        actions={editable ? (
          <SecAddButton onClick={() => addRow('brokerRows', createEmptyBrokerRow)} />
        ) : null}
      >
        <div className={styles.tableWrap}>
          <table className={`${styles.portTable} ${styles.flushGrid}`}>
            <thead>
              <tr>
                <th>Description</th>
                <th>Percentage (%)</th>
                <th>Freight Comm.</th>
                <th>Demurrage Comm.</th>
                {editable ? <th className={styles.stickyAct} /> : null}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.rowLabel}>ADCOM Freight</td>
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
                {editable ? <td className={styles.stickyAct} /> : null}
              </tr>
              {(form.brokerRows || []).map((row) => (
                <tr key={row.id}>
                  <td className={styles.rowLabel}>Brokerage commission</td>
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
                  {editable ? (
                    <td className={styles.stickyAct}>
                      <KhakiRowActions
                        onAdd={() => addRow('brokerRows', createEmptyBrokerRow)}
                        onRemove={() => removeRow('brokerRows', row.id)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.rowLabel}>Total</td>
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
                {editable ? <td className={styles.stickyAct} /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      </CollapsiblePanel>

      <PortLaytimeSections
        form={form}
        readOnly={readOnly}
        lookups={lookups}
        updateRow={updateRow}
        onApplyPatch={applyPatch}
      />

      <CollapsiblePanel
        title="OPEX"
        defaultOpen
        bodyClassName={styles.panelBodyFlush}
        actions={editable ? (
          <SecAddButton onClick={() => addRow('orcRows', () => createDefaultOrcRow(lookups.ownerCosts))} />
        ) : null}
      >
        <div className={styles.tableWrap}>
          <table className={`${styles.portTable} ${styles.flushGrid}`}>
            <thead>
              <tr>
                <th>Cost</th>
                <th>Amount</th>
                {editable ? <th className={styles.stickyAct} /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.orcRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    <WorksheetSelect
                      value={row.costId || ''}
                      disabled={readOnly}
                      placeholder="— Select —"
                      options={[
                        { value: '', label: '— Select —' },
                        ...(lookups.ownerCosts || []).map((cost) => ({
                          value: cost.id,
                          label: cost.name,
                        })),
                      ]}
                      onChange={(costId) => {
                        const match = (lookups.ownerCosts || []).find(
                          (c) => String(c.id) === String(costId),
                        );
                        updateRow('orcRows', row.id, {
                          costId,
                          costName: match?.name || '',
                        });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={row.amount || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      inputMode="decimal"
                      autoComplete="off"
                      onChange={(e) => updateRow('orcRows', row.id, { amount: e.target.value })}
                    />
                  </td>
                  {editable ? (
                    <td className={styles.stickyAct}>
                      <KhakiRowActions
                        onAdd={() => addRow('orcRows', () => createDefaultOrcRow(lookups.ownerCosts))}
                        onRemove={() => removeRow('orcRows', row.id)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.rowLabel}>Total</td>
                <td>
                  <input
                    id="totalOrcCost"
                    value={form.totalOrcCost || ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
                {editable ? <td className={styles.stickyAct} /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      </CollapsiblePanel>

{estimateType === 1 || estimateType === 2 ? (
        <CollapsiblePanel
          title="Additional Bunker Consumption"
          defaultOpen={false}
          bodyClassName={styles.panelBodyFlush}
          actions={editable ? (
            <SecAddButton
              onClick={() => addRow('bunkerActivityRows', () => createEmptyBunkerActivityRow({
                price: lookups.marketPrices?.vlsfo || '',
              }))}
            />
          ) : null}
        >
          <div className={styles.tableWrap}>
            <table className={`${styles.portTable} ${styles.flushGrid}`}>
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
                      <WorksheetSelect
                        value={row.activity || 'Cold Wash'}
                        disabled={readOnly}
                        options={BUNKER_ACTIVITY_OPTIONS}
                        onChange={(activity) => {
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
                      />
                    </td>
                    <td>
                      <WorksheetSelect
                        value={row.bunkerGrade || 'VLSFO'}
                        gradeLabel={row.bunkerGrade || 'VLSFO'}
                        disabled={readOnly}
                        options={[
                          ...BUNKER_ACTIVITY_GRADE_OPTIONS,
                          ...(lookups.bunkerGrades || [])
                            .filter((g) => !BUNKER_ACTIVITY_GRADE_OPTIONS.some(
                              (o) => o.value.toUpperCase() === String(g.name || '').toUpperCase(),
                            ))
                            .map((g) => ({ value: g.name, label: g.name })),
                        ]}
                        onChange={(bunkerGrade) => {
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
                      />
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

      <CollapsiblePanel title="Demurrage Dispatch" defaultOpen={false} bodyClassName={styles.panelBodyFlush}>
        <div className={`${styles.headerGrid} ${styles.flushPad}`} style={{ marginBottom: 8 }}>
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
          <table className={`${styles.portTable} ${styles.flushGrid}`}>
            <thead>
              <tr>
                <th style={{ width: '40%' }} />
                <th>Demm. Days</th>
                <th>Demm. Rate</th>
                <th>Estimated($)</th>
                <th>Actual($)</th>
                <th>Net Value($)</th>
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
                <td className={styles.demurrageTotalLabel}>Total Net Value($)</td>
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
        bodyClassName={styles.panelBodyFlush}
        actions={editable ? (
          <SecAddButton onClick={() => addRow('otherIncomeRows', createEmptyOtherIncomeRow)} />
        ) : null}
      >
        <div className={styles.tableWrap}>
          <table className={`${styles.portTable} ${styles.flushGrid}`}>
            <thead>
              <tr>
                <th>Description</th>
                <th>Amount</th>
                <th>Add Comm (%)</th>
                <th>Net Amount</th>
                {editable ? <th className={styles.stickyAct} /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.otherIncomeRows || []).map((row) => (
                <tr key={row.id}>
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
                  {editable ? (
                    <td className={styles.stickyAct}>
                      <KhakiRowActions
                        onAdd={() => addRow('otherIncomeRows', createEmptyOtherIncomeRow)}
                        onRemove={() => removeRow('otherIncomeRows', row.id)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className={styles.rowLabel}>Total</td>
                <td>
                  <input
                    value={form.totalOtherIncome || ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
                {editable ? <td className={styles.stickyAct} /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      </CollapsiblePanel>

      
        <CollapsiblePanel
        title="Bunkers"
        defaultOpen={false}
        bodyClassName={styles.panelBodyFlush}
      >
        <div className={styles.tableWrap}>
          <table className={`${styles.portTable} ${styles.flushGrid}`}>
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
                  <td>
                    <span className={`${voyStyles.gradeChip} ${gradeChipClass(row.grade)}`.trim()}>
                      {row.grade}
                    </span>
                  </td>
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
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.rowLabel}>Total Bunker Consumed — SECA / NON-SECA</td>
                <td>
                  <input value={Number(bunkerQtyTotal).toFixed(2)} readOnly placeholder="0.00" />
                </td>
                <td><input value="—" readOnly /></td>
                <td><input value="—" readOnly /></td>
                <td>
                  <input value={form.totalBunkerCost || ''} readOnly placeholder="0.00" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className={styles.bunkerPriceGrid}>
          <Field id="co2PriceInline" label="CO2 Price / MT">
            <input
              id="co2PriceInline"
              value={form.co2Price || ''}
              readOnly={readOnly}
              placeholder="0.00"
              onChange={(e) => updateField('co2Price', e.target.value)}
            />
          </Field>
          <Field id="euaPriceInline" label="EUA Price / MT">
            <input
              id="euaPriceInline"
              value={form.euaPrice || ''}
              readOnly={readOnly}
              placeholder="0.00"
              onChange={(e) => updateField('euaPrice', e.target.value)}
            />
          </Field>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title={showHireSection ? 'Hire / Vessel OPEX' : 'Vessel OPEX'}
        defaultOpen={false}
        bodyClassName={styles.panelBodyFlush}
        actions={(showHireDetailsButton || showVcInButton) ? (
          <div className={styles.panelActionGroup}>
            {showHireDetailsButton ? (
              <button
                type="button"
                className={voyStyles.tcInHireBtn}
                title="Full hire terms, delivery / re-delivery and CVE"
                onClick={() => setHireDetailsOpen(true)}
              >
                TC-in Hire
              </button>
            ) : null}
            {showVcInButton ? (
              vcInHref ? (
                <Link
                  id="vcInSheetBtn"
                  className={voyStyles.tcInHireBtn}
                  to={vcInHref}
                  title="Open VC-In worksheet"
                >
                  VC-In
                </Link>
              ) : (
                <button
                  type="button"
                  id="vcInSheetBtn"
                  className={voyStyles.tcInHireBtn}
                  disabled
                  title="Save the estimate first to open VC-In"
                >
                  VC-In
                </button>
              )
            ) : null}
          </div>
        ) : null}
      >
        <div className={styles.vesselOpexWrap}>
          {showHireSection ? (
            <>
              <div className={styles.tableWrap}>
                {showIndexLinked ? (
                  <table className={`${styles.portTable} ${styles.flushGrid} ${styles.vesselOpexHireTable}`}>
                    <thead>
                      <tr>
                        <th className={styles.vesselOpexColHire}>
                          Hire / Day ($)
                          <label className={styles.vesselOpexThCheck} htmlFor="chkHire">
                            <input
                              type="checkbox"
                              id="chkHire"
                              checked={!!form.chkHire}
                              disabled={readOnly}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                applyPatch(checked
                                  ? { chkHire: true }
                                  : { chkHire: false, hireRate: '', _hireRateCleared: true });
                              }}
                            />
                          </label>
                        </th>
                        <th className={styles.vesselOpexColIndex}>
                          Index Linked
                          <label className={styles.vesselOpexThCheck} htmlFor="chkIndex">
                            <input
                              type="checkbox"
                              id="chkIndex"
                              checked={!!form.chkIndex}
                              disabled={readOnly}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (!checked) {
                                  applyPatch({
                                    chkIndex: false,
                                    balticIndex: '',
                                    balticPercent: '100',
                                    balticRate: '',
                                    totalHireRate: '',
                                  });
                                  return;
                                }
                                applyPatch({ chkIndex: true, balticPercent: form.balticPercent || '100' });
                              }}
                            />
                          </label>
                        </th>
                        <th className={styles.vesselOpexColTotal}>Total Hire / Day ($)</th>
                        <th>Add Comm (%)</th>
                        <th>Brokerage (%)</th>
                        <th>BB ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <input
                            id="hireRate"
                            value={form.hireRate || ''}
                            readOnly={readOnly || !form.chkHire}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            onChange={(e) => {
                              const value = sanitizeFieldDecimal('hireRate', e.target.value);
                              applyPatch({
                                hireRate: value,
                                _hireRateCleared: value === '' || value == null,
                              });
                            }}
                          />
                        </td>
                        <td>
                          <div className={styles.vesselOpexIndexCell}>
                            <WorksheetSelect
                              id="balticIndex"
                              value={form.balticIndex || ''}
                              disabled={readOnly || !form.chkIndex}
                              placeholder="— Select route —"
                              options={[
                                { value: '', label: '— Select route —' },
                                ...(lookups.balticRoutes || []).map((row) => ({
                                  value: row.id,
                                  label: row.label || row.code || row.name,
                                })),
                              ]}
                              onChange={(value) => {
                                const match = (lookups.balticRoutes || []).find((row) => String(row.id) === String(value));
                                const daily = Number(match?.dailyRate) || 0;
                                const pct = Number(form.balticPercent) || 100;
                                const nextBalticRate = daily > 0 ? ((pct * daily) / 100).toFixed(2) : '';
                                applyPatch({ balticIndex: value, balticRate: nextBalticRate });
                              }}
                            />
                            <span className={styles.vesselOpexIndexPct}>%</span>
                            <input
                              id="balticPercent"
                              className={styles.vesselOpexIndexPctInput}
                              value={form.balticPercent || ''}
                              readOnly={readOnly || !form.chkIndex}
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="100"
                              title="Index percentage"
                              onChange={(e) => {
                                const value = sanitizeFieldDecimal('balticPercent', e.target.value);
                                const match = (lookups.balticRoutes || []).find(
                                  (row) => String(row.id) === String(form.balticIndex),
                                );
                                const daily = Number(match?.dailyRate) || 0;
                                const pct = Number(value) || 0;
                                const nextBalticRate = daily > 0 ? ((pct * daily) / 100).toFixed(2) : '';
                                applyPatch({ balticPercent: value, balticRate: nextBalticRate });
                              }}
                            />
                            <input
                              id="balticRate"
                              className={styles.vesselOpexIndexRate}
                              value={form.balticRate || ''}
                              readOnly
                              placeholder="0.00"
                              title="Calculated index rate"
                            />
                          </div>
                        </td>
                        <td>
                          <input id="totalHireRate" value={form.totalHireRate || ''} readOnly placeholder="0.00" />
                        </td>
                        <td>
                          {/* PHP dummyAdcom → txtHireargePercent only (not freight ADCOM) */}
                          <input
                            id="dummyAdcom"
                            value={form.hireagePercent || ''}
                            readOnly={readOnly}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            onChange={(e) => {
                              const value = sanitizeFieldDecimal('hireagePercent', e.target.value);
                              applyPatch({ hireagePercent: value });
                            }}
                          />
                        </td>
                        <td>
                          <input {...inputProps('hireageBroPercent', { recalc: true })} placeholder="0.00" />
                        </td>
                        <td>
                          <input {...inputProps('ballastBonus', { recalc: true })} placeholder="0.00" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <table className={`${styles.portTable} ${styles.flushGrid} ${styles.vesselOpexHireTable}`}>
                    <thead>
                      <tr>
                        <th>Hire / Day ($)</th>
                        <th>Add Comm (%)</th>
                        <th>Brokerage (%)</th>
                        <th>BB ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <input
                            id="hireRate"
                            value={form.hireRate || ''}
                            readOnly={readOnly}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            onChange={(e) => {
                              const value = sanitizeFieldDecimal('hireRate', e.target.value);
                              applyPatch({
                                hireRate: value,
                                _hireRateCleared: value === '' || value == null,
                              });
                            }}
                          />
                        </td>
                        <td>
                          {/* PHP dummyAdcom → txtHireargePercent only (not freight ADCOM) */}
                          <input
                            id="dummyAdcom"
                            value={form.hireagePercent || ''}
                            readOnly={readOnly}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            onChange={(e) => {
                              const value = sanitizeFieldDecimal('hireagePercent', e.target.value);
                              applyPatch({ hireagePercent: value });
                            }}
                          />
                        </td>
                        <td>
                          <input {...inputProps('hireageBroPercent', { recalc: true })} placeholder="0.00" />
                        </td>
                        <td>
                          <input {...inputProps('ballastBonus', { recalc: true })} placeholder="0.00" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
              <div className={styles.tableWrap}>
                <table className={`${styles.portTable} ${styles.flushGrid} ${styles.vesselOpexTotalsTable}`}>
                  <thead>
                    <tr>
                      <th>Add Comm Amt</th>
                      <th>Hireage Add Comm (%)</th>
                      <th>Hire Amt</th>
                      <th>Less Off Hire</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <input
                          id="hireagePercentAmt"
                          value={form.hireagePercentAmt || ''}
                          readOnly
                          placeholder="0.00"
                        />
                      </td>
                      <td>
                        <input {...inputProps('hireagePercent', { recalc: true })} placeholder="0.00" />
                      </td>
                      <td>
                        <input id="hireAmt" value={form.hireAmt || ''} readOnly placeholder="0.00" />
                      </td>
                      <td>
                        <input
                          id="lessOffHire"
                          value={form.lessOffHire || form.totalOffHireAmt || ''}
                          readOnly
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          <div className={styles.tableWrap}>
            <table className={`${styles.portTable} ${styles.flushGrid} ${styles.vesselOpexCveTable}`}>
              <tbody>
                <tr>
                  <td className={styles.vesselOpexLabelCell}>CVE (/Month)</td>
                  <td>
                    <input {...inputProps('cvePerMonth', { recalc: true })} placeholder="0.00" />
                  </td>
                  <td className={styles.vesselOpexLabelCell}>CVE ($)</td>
                  <td>
                    <input id="cveAmt" value={form.cveAmt || ''} readOnly placeholder="0.00" />
                  </td>
                  {showVesselDailyOps ? (
                    <>
                      <td className={styles.vesselOpexLabelCell}>Vessel Daily Ops</td>
                      <td>
                        <input {...inputProps('vesselDailyOps', { recalc: true })} placeholder="0.00" />
                      </td>
                    </>
                  ) : null}
                  {showHireSection ? (
                    <>
                      <td className={styles.vesselOpexLabelCell}>CVE Off Hire (/Month)</td>
                      <td>
                        <input {...inputProps('offHireCve', { recalc: true })} placeholder="0.00" />
                      </td>
                      <td className={styles.vesselOpexLabelCell}>CVE Off Hire Amt</td>
                      <td>
                        <input id="offHireCveAmt" value={form.offHireCveAmt || ''} readOnly placeholder="0.00" />
                      </td>
                    </>
                  ) : null}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Attachments" defaultOpen={false}>
        <AttachmentDropzone
          readOnly={!editable}
          files={form.attachmentFiles || []}
          existing={form.attachments || []}
          onAddFiles={(added) => {
            updateField('attachmentFiles', [...(form.attachmentFiles || []), ...added]);
          }}
          onRemoveFile={(index) => {
            updateField(
              'attachmentFiles',
              (form.attachmentFiles || []).filter((_, i) => i !== index),
            );
          }}
        />
      </CollapsiblePanel>

      
      </div>

      <aside className={styles.estimateAside}>
        <div className={`${styles.estimateAsideInner} ${styles.resultsAside}`}>
          <EstimateResultsPanels
            form={form}
            bunkerSummaryRows={bunkerSummaryRows}
            readOnly={readOnly}
            complianceYear={lookups.complianceYear || new Date().getFullYear()}
            onFieldChange={onFieldChange}
            onRecalc={onRecalc}
          />
          <CollapsiblePanel
            title="Profit Sharing"
            defaultOpen={false}
            className={styles.panelInverse}
            actions={editable ? (
              <AddCircleButton
                onClick={() => addRow('profitSharingRows', createEmptyProfitSharingRow)}
              />
            ) : null}
          >
            <div className={styles.tableWrap}>
              <table className={`${styles.portTable} ${styles.flushGrid}`}>
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
                        <WorksheetSelect
                          value={row.vendorId || ''}
                          disabled={readOnly}
                          placeholder="— Select —"
                          options={[
                            { value: '', label: '— Select —' },
                            ...(lookups.ownBusiness || lookups.owners || []).map((o) => ({
                              value: o.id,
                              label: o.name,
                            })),
                          ]}
                          onChange={(value) => updateRow('profitSharingRows', row.id, { vendorId: value })}
                        />
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
      <HireDetailsModal
        open={hireDetailsOpen}
        onClose={() => setHireDetailsOpen(false)}
        form={form}
        readOnly={readOnly}
        lookups={lookups}
        applyPatch={applyPatch}
      />
    </div>
  );
}


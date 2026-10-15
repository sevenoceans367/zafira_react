import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DmyDateInput, RowAddButton, RowDelButton, useAlert } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import PortSearchSelect from '../../period-contract/PortSearchSelect.jsx';
import CountryMultiSelect from '../../masters/port-cost-type/CountryMultiSelect.jsx';
import VesselSearchSelect from '../../sopf/VesselSearchSelect.jsx';
import {
  BUNKER_ACTIVITY_GRADE_OPTIONS,
  BUNKER_ACTIVITY_OPTIONS,
  BUNKER_ACTIVITY_RATE_FIELD,
  COA_SPOT_OPTIONS,
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
  createEmptyBunkerRow,
  createEmptyPortLeg,
  createEmptyProfitSharingRow,
  createEmptySecaBunkerRow,
  getFixtureTypeLabel,
  seedPortLegsFromFirstCargo,
} from '../../sopf/estimateDetail.constants.js';
import { formatDemurrageCostField, calcSeaDays, calcSeaDaysWithSeca, pickPassageSpeedKnots, buildBunkerSummaryRows, calcDemurrageCommissionDisplay, resolveNrtFromGnrt, classifyBunkerGradeName, formatDemurrageLoadPortLabel, formatDemurrageDischargePortLabel, formatDays, formatDistance, syncPortstayFromPassageDates } from '../../sopf/estimateCalculations.js';
import CollapsiblePanel from '../../sopf/CollapsiblePanel.jsx';
import DistanceFetchModal from '../../sopf/DistanceFetchModal.jsx';
import TankerFreightModeSection from '../../sopf/TankerFreightModeSection.jsx';
import { DryFreightModeSection, GasFreightModeSection } from '../../sopf/EstimateTypeCargoFreight.jsx';
import PortLaytimeSections from './CostSheetPortLaytimeSections.jsx';
import EstimateResultsPanels from '../../sopf/EstimateResultsPanels.jsx';
import VesselItineraryModal from '../../sopf/VesselItineraryModal.jsx';
import HireDetailsModal from './HireDetailsModal.jsx';
import BunkerFifoModal from './BunkerFifoModal.jsx';
import WorksheetSelect, { gradeChipClass } from './WorksheetSelect.jsx';
import { fetchCanalOrcRates, searchEstimatePorts } from '../../../../services/estimateDetail.js';
import { focusEstimateValidationField, getAddRowBlockMessage } from '../../sopf/estimateValidation.js';
import { sanitizeDecimalInput, sanitizeFieldDecimal, sanitizeEstimatePatch, ESTIMATE_DECIMAL_FIELDS } from '../../sopf/estimateInputSanitize.js';
import styles from './CostSheetEstimatePage.module.css';
import updateEstimateStyles from '../../sopf/UpdateEstimatePage.module.css';

/** Ports chosen in Passage & Ports (from/to on each leg) — Stemmed dropdown source of truth. */
function getPassagePorts(portLegs = []) {
  const ports = [];
  const seen = new Set();
  for (const leg of portLegs || []) {
    for (const [id, name] of [
      [leg.fromPortId, leg.fromPortName],
      [leg.toPortId, leg.toPortName],
    ]) {
      const portId = String(id || '').trim();
      if (!portId || seen.has(portId)) continue;
      seen.add(portId);
      ports.push({ id: portId, name: String(name || '').trim() || portId });
    }
  }
  return ports;
}

/** New Stemmed row: clone last SUPPLY stem; otherwise seed first passage port. */
function createStemRowFromLast(bunkerRows = [], passagePorts = []) {
  const next = createEmptyBunkerRow('SUPPLY');
  const stems = (bunkerRows || []).filter(
    (row) => String(row.identify || '').toUpperCase() === 'SUPPLY',
  );
  const last = stems[stems.length - 1];
  if (!last) {
    const firstPort = passagePorts[0];
    return {
      ...next,
      portId: firstPort?.id || '',
      portName: firstPort?.name || '',
    };
  }
  const { id: _ignoreId, ...fields } = last;
  return {
    ...next,
    ...fields,
    id: next.id,
    identify: 'SUPPLY',
  };
}

/** Same + / × layout as Add TC Recap → Bunkers. */
function KhakiRowActions({ onAdd, onRemove, canRemove = true, readOnly = false }) {
  if (readOnly) return null;
  return (
    <div className="rowActions">
      <RowAddButton title="Add row" onClick={onAdd} />
      <RowDelButton title="Delete row" onClick={onRemove} disabled={!canRemove} />
    </div>
  );
}

function BunkerPriceInput({ value, readOnly, onCommit }) {
  const [draft, setDraft] = useState(null);
  const editing = draft !== null;

  // PHP txtSECABunkerPrice onKeyUp — commit on each change so Amount recalculates live.
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
  const fixtureType = String(form.fixtureTypeId ?? '');
  // PHP makeFieldManD: hire table for TCIN/VCIN (1|2); Vessel Daily Ops for VCOUT (3)
  const showHireSection = fixtureType === '1' || fixtureType === '2';
  const showVesselDailyOps = fixtureType === '3';
  // PHP .tcin — Hire Details button only for TCIN-VCOUT
  const showHireDetailsButton = fixtureType === '1';
  // PHP updatecost_sheet_tci_in — VCIN-VCOUT opens the VC-In worksheet
  const showVcInButton = fixtureType === '2' && variant !== 'vc-in';
  const showCoaFields = String(form.coaSpot || '') === '2';
  const showIndexLinked = isDry && showHireSection;
  const editable = !readOnly;
  const alert = useAlert();
  const [searchParams] = useSearchParams();
  const [distanceLegId, setDistanceLegId] = useState(null);
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [hireDetailsOpen, setHireDetailsOpen] = useState(false);
  const [bunkerFifoOpen, setBunkerFifoOpen] = useState(false);

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
  const costSheetId = searchParams.get('cost_sheet_id') || searchParams.get('costSheetId') || '';
  const vcInHref = showVcInButton && sofComId
    ? appPath(
      `/internal-user/vc/ops/cost-sheet-in?comid=${encodeURIComponent(sofComId)}&page=${encodeURIComponent(sofPage)}${costSheetId ? `&cost_sheet_id=${encodeURIComponent(costSheetId)}` : ''}`,
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
    if (
      collection === 'cargoRows'
      && (
        Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoMt')
        || Object.prototype.hasOwnProperty.call(cleanPatch, 'cargoId')
      )
    ) {
      // Multiple: Qty syncs to sum of all Main Cargo Details Cargo (MT)
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

      // PHP setROB(id, fo|do): To Port departure ROB cascades to next leg From Port
      if (keys.includes('toRobFoDeparture') || keys.includes('toRobDoDeparture')) {
        const idx = rows.findIndex((row) => String(row.id) === String(id));
        if (idx >= 0 && idx < rows.length - 1) {
          const cur = rows[idx];
          const nxt = { ...rows[idx + 1] };
          if (keys.includes('toRobFoDeparture')) {
            nxt.fromRobFoArrival = cur.toRobFoDeparture ?? '';
            nxt.fromRobFoDeparture = cur.toRobFoDeparture ?? '';
          }
          if (keys.includes('toRobDoDeparture')) {
            nxt.fromRobDoArrival = cur.toRobDoDeparture ?? '';
            nxt.fromRobDoDeparture = cur.toRobDoDeparture ?? '';
          }
          rows[idx + 1] = nxt;
        }
      }
    }

    if (onRecalc) {
      onRecalc(collection, rows);
    } else {
      updateField(collection, rows);
    }
  };

  const addRow = async (collection, factory, opts = {}) => {
    if (!opts.skipBlock) {
      const blockMessage = getAddRowBlockMessage(collection, form[collection] || [], opts);
      if (blockMessage) {
        await alert({ title: 'Missing Information', message: blockMessage, confirmLabel: 'OK' });
        return;
      }
    }

    if (collection === 'portLegs') {
      const prev = (form.portLegs || [])[(form.portLegs || []).length - 1];
      const next = factory();
      if (prev?.toPortId) {
        next.fromPortId = prev.toPortId;
        next.fromPortName = prev.toPortName || '';
      }
      // PHP addPortRotationDetails: from_arrival / from_departure = previous to_departure
      // ROB is NOT copied on add (PHP leaves new-leg ROB blank; setROB only while typing).
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
      // Run date cascade so To Port dates follow when sea/portstay days exist
      applyPatch({
        portLegs: rows,
        _portScheduleMode: 'fromArrival',
        _portScheduleLegId: seeded.id,
      });
      return;
    }
    updateField(collection, [...(form[collection] || []), factory()]);
  };

  const removeRow = (collection, id, opts = {}) => {
    const rows = (form[collection] || []).filter((row) => row.id !== id);
    // Default: keep at least one row (legacy). Estimated & Consumed blank rows may clear fully.
    if (!rows.length && !opts.allowEmpty) return;
    if (onRecalc) {
      onRecalc(collection, rows);
    } else {
      updateField(collection, rows);
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

  // PHP updatecost_sheet_tci Bunkers: qty from voyage MT, actual qty from ROB + supplied, price from SECA EST_PRICE.
  const SUMMARY_BUNKER_GRADES = ['VLSFO', 'LSMGO', 'HSFO'];
  const classifySummaryGradeName = (name) => {
    const key = classifyBunkerGradeName(name);
    return key === 'HSFO+SCRUBBER' ? 'HSFO' : key;
  };
  const classifySummaryGradeId = (gradeId) => classifySummaryGradeName(bunkerGradeName(gradeId));

  const bunkerSummaryRows = buildBunkerSummaryRows(form, bunkerGradeName);
  const hiddenEstimatedGrades = new Set(
    (form.bunkerEstimatedHiddenGrades || []).map((g) => String(g)),
  );
  const {
    addressDemmComm,
    totalCommPercent,
    totalFreightComm,
    totalDemmComm,
  } = calcDemurrageCommissionDisplay(form);

  /** PHP txtSECABunkerPrice onKeyUp → getBunkerCalculation / getVoyageTime */
  const handleBunkerSummaryPriceChange = (grade, value) => {
    let matched = false;
    let nextSeca = (form.secaBunkerRows || []).map((row) => {
      if (classifySummaryGradeId(row.bunkerGradeId) !== grade) return row;
      matched = true;
      return { ...row, price: value };
    });

    if (!matched) {
      const gradeOpt = (lookups.bunkerGrades || form._bunkerGrades || []).find(
        (g) => classifySummaryGradeName(g.name) === grade,
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
      return classifySummaryGradeId(row.bunkerGradeId) === grade ? { ...row, price: value } : row;
    });

    applyPatch({
      secaBunkerRows: nextSeca,
      bunkerRows: nextBunker,
      // Editing a visible grade brings it back if it was previously removed.
      bunkerEstimatedHiddenGrades: (form.bunkerEstimatedHiddenGrades || []).filter((g) => g !== grade),
    });
  };

  /** null = use system/FIFO; string (incl. '') = user override. */
  const storedConsumed = (grade) => {
    if (!Object.prototype.hasOwnProperty.call(form.bunkerConsumedManual || {}, grade)) return null;
    return String(form.bunkerConsumedManual[grade] ?? '');
  };

  const bunkerDisplayRows = bunkerSummaryRows
    .filter((row) => !hiddenEstimatedGrades.has(row.grade))
    .map((row) => {
      // Qty. (MT) and Estimated (MT) were the same voyage estimate — keep one column.
      const estimated = row.qty || row.actualQty || '';
      const manual = storedConsumed(row.grade);
      const consumed = manual !== null ? manual : (row.actualQty || estimated || '');
      const price = Number(String(row.price || '').replace(/,/g, ''));
      const amountSource = manual !== null && manual !== '' ? manual : estimated;
      const amountQty = Number(String(amountSource || '').replace(/,/g, ''));
      const amount = Number.isFinite(price) && Number.isFinite(amountQty) && (price !== 0 || amountQty !== 0)
        ? (price * amountQty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';
      return { ...row, estimated, consumed, amount };
    });
  const bunkerDisplayTotal = bunkerDisplayRows.reduce((sum, row) => {
    const value = Number(String(row.amount || '').replace(/,/g, ''));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  /** Blank Estimated & Consumed rows (grade not chosen yet) — shown like the mockup entry row. */
  const blankEstimatedRows = (form.secaBunkerRows || []).filter((row) => (
    String(row.identify || '').toUpperCase() === 'NON_SECA'
    && !String(row.bunkerGradeId || '').trim()
  ));

  const visibleEstimatedGrades = new Set(bunkerDisplayRows.map((row) => row.grade));
  const availableEstimatedGrades = SUMMARY_BUNKER_GRADES.filter((g) => !visibleEstimatedGrades.has(g));

  const addEstimatedConsumedRow = async () => {
    if (blankEstimatedRows.length) {
      await alert({
        title: 'Missing Information',
        message: 'Please select a grade on the empty row first.',
        confirmLabel: 'OK',
      });
      return;
    }
    // Re-show a grade the user removed (keeps voyage estimate / ROB values).
    const hiddenList = form.bunkerEstimatedHiddenGrades || [];
    if (hiddenList.length) {
      const [restore, ...rest] = hiddenList;
      const hasSeca = (form.secaBunkerRows || []).some(
        (row) => classifySummaryGradeId(row.bunkerGradeId) === restore,
      );
      let nextSeca = form.secaBunkerRows || [];
      if (!hasSeca) {
        const gradeOpt = (lookups.bunkerGrades || form._bunkerGrades || []).find(
          (g) => classifySummaryGradeName(g.name) === restore,
        );
        if (gradeOpt) {
          nextSeca = [
            ...nextSeca,
            {
              ...createEmptySecaBunkerRow('NON_SECA', restore === 'LSMGO' ? 'DO' : 'FO'),
              bunkerGradeId: String(gradeOpt.id),
              qty: '0',
              actualQty: '0',
              price: '0.00',
            },
          ];
        }
      }
      applyPatch({
        bunkerEstimatedHiddenGrades: rest,
        ...(nextSeca !== form.secaBunkerRows ? { secaBunkerRows: nextSeca } : {}),
      });
      return;
    }
    if (!availableEstimatedGrades.length) {
      await alert({
        title: 'Alert',
        message: 'All bunker grades are already listed.',
        confirmLabel: 'OK',
      });
      return;
    }
    addRow('secaBunkerRows', () => createEmptySecaBunkerRow('NON_SECA', 'FO'), { skipBlock: true });
  };

  const removeEstimatedConsumedGrade = (grade) => {
    const nextHidden = [...new Set([...(form.bunkerEstimatedHiddenGrades || []), grade])];
    const nextManual = { ...(form.bunkerConsumedManual || {}) };
    delete nextManual[grade];

    // Drop zero-qty NON_SECA rows for this grade (user-added blanks). Keep SECA / voyage qty rows.
    const nextSeca = (form.secaBunkerRows || []).filter((row) => {
      const id = String(row.identify || '').toUpperCase().replace(/\s+/g, '_');
      const isNonSeca = id === 'NON_SECA' || id === 'NONSECA' || id === '2';
      if (!isNonSeca) return true;
      if (classifySummaryGradeId(row.bunkerGradeId) !== grade) return true;
      const qty = Number(String(row.qty || '').replace(/,/g, ''));
      return Number.isFinite(qty) && qty > 0;
    });

    applyPatch({
      bunkerEstimatedHiddenGrades: nextHidden,
      bunkerConsumedManual: nextManual,
      secaBunkerRows: nextSeca,
    });
  };

  const assignBlankEstimatedGrade = (rowId, gradeId) => {
    const grade = classifySummaryGradeId(gradeId);
    if (!grade) return;
    const nextSeca = (form.secaBunkerRows || []).map((row) => (
      String(row.id) === String(rowId)
        ? {
          ...row,
          bunkerGradeId: String(gradeId),
          bunkerType: grade === 'LSMGO' ? 'DO' : 'FO',
          // Seed zeros so buildBunkerSummaryRows keeps the grade visible after assign.
          qty: row.qty || '0',
          actualQty: row.actualQty || '0',
          price: row.price || '0.00',
        }
        : row
    ));
    applyPatch({
      secaBunkerRows: nextSeca,
      bunkerEstimatedHiddenGrades: (form.bunkerEstimatedHiddenGrades || []).filter((g) => g !== grade),
    });
  };

  const handleBunkerConsumedChange = (grade, raw) => {
    const value = sanitizeDecimalInput(raw ?? '');
    let matched = false;
    let nextSeca = (form.secaBunkerRows || []).map((row) => {
      if (classifySummaryGradeId(row.bunkerGradeId) !== grade) return row;
      matched = true;
      return { ...row, actualQty: value };
    });
    if (!matched) {
      const gradeOpt = (lookups.bunkerGrades || form._bunkerGrades || []).find(
        (g) => classifySummaryGradeName(g.name) === grade,
      );
      const bunkerType = grade === 'LSMGO' ? 'DO' : 'FO';
      if (gradeOpt) {
        nextSeca = [
          ...nextSeca,
          {
            ...createEmptySecaBunkerRow('NON_SECA', bunkerType),
            bunkerGradeId: String(gradeOpt.id),
            actualQty: value,
          },
        ];
      }
    }
    applyPatch({
      secaBunkerRows: nextSeca,
      bunkerConsumedManual: { ...(form.bunkerConsumedManual || {}), [grade]: value },
      bunkerEstimatedHiddenGrades: (form.bunkerEstimatedHiddenGrades || []).filter((g) => g !== grade),
    });
  };

  const consumedByGrade = Object.fromEntries(bunkerDisplayRows.map((row) => [row.grade, row.consumed]));
  const priceByGrade = Object.fromEntries(bunkerDisplayRows.map((row) => [row.grade, row.price]));
  const vendorName = (vendorId) => {
    const match = (lookups.owners || []).find(
      (vendor) => String(vendor.code || vendor.id) === String(vendorId),
    );
    return match?.name || '';
  };

  return (
    <div className={styles.estimateForm}>
      <div className={styles.estimateMain}>
       <CollapsiblePanel title="Estimate Identifier" defaultOpen round className={styles.roundSection}>
          <div className={styles.headerGrid}>
            <Field id="fixtureTypeId" label="Business Type">
              <input id="fixtureTypeId" value={getFixtureTypeLabel(form.fixtureTypeId)} readOnly />
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
                readOnly
                autoComplete="off"
              />
            </Field>
            <Field id="estimateNo" label="Estimate No.">
              <input
                id="estimateNo"
                value={form.voyageNo
                  ? `Est${Number(form.estimateNo) > 0 ? Number(form.estimateNo) : 1}`
                  : ''}
                readOnly
                placeholder="Est1"
              />
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
                  id="laycanEnd"
                  enableTime
                  value={form.laycanEnd || ''}
                  onChange={(value) => updateField('laycanEnd', value)}
                />
              )}
            </Field>
            <Field id="periodId" label="Period Contract">
              <WorksheetSelect
                id="periodId"
                value={form.periodId || ''}
                disabled={readOnly}
                options={(lookups.periodContracts || []).map((row) => ({
                  value: row.id,
                  label: row.label || row.id,
                }))}
                onChange={(value) => {
                  updateField('periodId', value);
                  onPeriodContractChange?.(value);
                }}
              />
            </Field>
            <Field id="openPort" label="Open Port">
              {readOnly ? (
                <input id="openPort" value={form.openPortName || form.openPort || ''} readOnly />
              ) : (
                <PortSearchSelect
                  id="openPort"
                  value={form.openPort}
                  label={form.openPortName}
                  searchPorts={searchEstimatePorts}
                  onChange={(portId, portName) => {
                    applyPatch({ openPort: portId, openPortName: portName });
                  }}
                />
              )}
            </Field>
            <Field id="zoneOpen" label="Zone Open">
              <WorksheetSelect
                id="zoneOpen"
                value={form.zoneOpen || ''}
                disabled={readOnly}
                options={(lookups.zones || []).map((row) => ({ value: row.id, label: row.name }))}
                onChange={(value) => updateField('zoneOpen', value)}
              />
            </Field>
            <Field id="fixtureBroker" label="Broker">
              <WorksheetSelect
                id="fixtureBroker"
                value={form.fixtureBroker || ''}
                disabled={readOnly}
                options={(lookups.fixtureBrokers || []).map((row) => ({ value: row.id, label: row.name }))}
                onChange={(value) => updateField('fixtureBroker', value)}
              />
            </Field>
            <Field id="coaSpot" label="COA / Spot">
              <WorksheetSelect
                id="coaSpot"
                value={form.coaSpot || ''}
                disabled={readOnly}
                options={COA_SPOT_OPTIONS}
                onChange={(value) => {
                  const patch = { coaSpot: value };
                  if (value !== '2') {
                    patch.coaNumber = '';
                    patch.coaNumberLabel = '';
                    patch.coaNumberLift = '';
                    patch.noOfShipment = '';
                  }
                  applyPatch(patch);
                }}
              />
            </Field>
            {showCoaFields ? (
              <>
                <Field id="coaNumber" label="COA Number">
                  <WorksheetSelect
                    id="coaNumber"
                    value={form.coaNumber || ''}
                    disabled={readOnly}
                    options={(lookups.coaContracts || []).map((row) => ({
                      value: row.id,
                      label: row.name || row.id,
                    }))}
                    onChange={(value) => {
                      const match = (lookups.coaContracts || []).find((row) => String(row.id) === String(value));
                      applyPatch({
                        coaNumber: value,
                        coaNumberLabel: match?.name || '',
                        coaNumberLift: match?.noOfShipment != null ? String(match.noOfShipment) : form.coaNumberLift || '',
                        noOfShipment: match?.noOfShipment != null ? String(match.noOfShipment) : form.noOfShipment || '',
                        fixtureBroker: match?.broker || form.fixtureBroker || '',
                        ownerId: match?.owner || form.ownerId || '',
                      });
                    }}
                  />
                </Field>
                <Field id="coaNumberLift" label="Number of Lift">
                  <input {...inputProps('coaNumberLift')} placeholder="Number of Lift" />
                </Field>
                <Field id="noOfShipment" label="Total No. of Shipments">
                  <input id="noOfShipment" value={form.noOfShipment || ''} readOnly />
                </Field>
              </>
            ) : null}
          </div>
      </CollapsiblePanel>

       <CollapsiblePanel title="Fixed Vessel Particulars" defaultOpen={false} round className={styles.roundSection}>
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
            {!isTanker ? (
              <Field id="gear" label="Gear">
                <input {...inputProps('gear')} />
              </Field>
            ) : null}
            <Field id="builtYear" label="Year Built">
              <input {...inputProps('builtYear')} />
            </Field>
            <Field id="beam" label="Beam">
              <input {...inputProps('beam')} />
            </Field>
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
        className={styles.roundSection}
        actions={(
          <div className={styles.panelActionGroup}>
            {sofHref ? (
              <Link
                to={sofHref}
                className={`${styles.panelActionBtn} ${styles.panelActionBtnAccent}`}
                aria-label="SOF"
                title="SOF"
              >
                SOF
              </Link>
            ) : null}
            <button
              type="button"
              className={`${styles.panelActionBtn} ${styles.panelActionBtnOutline}`}
              aria-label="Itinerary"
              title="Itinerary"
              onClick={() => setItineraryOpen(true)}
            >
              Itinerary
            </button>
          </div>
        )}
      >
        <div className={styles.portLegsStack}>
          {(form.portLegs || []).map((leg, legIndex) => {
            const isLastLeg = legIndex === (form.portLegs || []).length - 1;
            return (
            <div key={leg.id} className={styles.portLegCard}>
              <table className={`${styles.portTable} ${styles.portLegConnected}`}>
                <thead>
                  <tr>
                    <th className={styles.portIdxCol}>#</th>
                    <th>From Port</th>
                    <th>{legIndex > 0 ? 'Arrival' : ''}</th>
                    <th className={styles.robCol}>VLSFO ROB</th>
                    <th className={styles.robCol}>LSMGO ROB</th>
                    <th>Departure</th>
                    <th className={styles.robCol}>VLSFO ROB</th>
                    <th className={styles.robCol}>LSMGO ROB</th>
                    <th className={styles.wxCol}>Wx(%)</th>
                    <th className={styles.lbCol}>L/B</th>
                    <th className={styles.speedTypeCol}>Speed Type</th>
                    <th className={styles.routeCol}>Route</th>
                    <th>Total Dist</th>
                    <th>Total Days</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.portIdxCol}>
                      {editable && isLastLeg ? (
                        <div className="rowActions">
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
                            id={`fromArrival_${leg.id}`}
                            enableTime
                            className=""
                            value={leg.fromArrival || ''}
                            onChange={(value) => updateRow('portLegs', leg.id, { fromArrival: value })}
                          />
                        )
                      ) : null}
                    </td>
                    <td className={styles.robCol}>
                      <input
                        value={leg.fromRobFoArrival || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('portLegs', leg.id, { fromRobFoArrival: e.target.value })}
                      />
                    </td>
                    <td className={styles.robCol}>
                      <input
                        value={leg.fromRobDoArrival || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('portLegs', leg.id, { fromRobDoArrival: e.target.value })}
                      />
                    </td>
                    <td>
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
                    <td className={styles.robCol}>
                      <input
                        value={leg.fromRobFoDeparture || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('portLegs', leg.id, { fromRobFoDeparture: e.target.value })}
                      />
                    </td>
                    <td className={styles.robCol}>
                      <input
                        value={leg.fromRobDoDeparture || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('portLegs', leg.id, { fromRobDoDeparture: e.target.value })}
                      />
                    </td>
                    <td className={styles.wxCol}>
                      <input
                        value={leg.seaMargin ?? ''}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('portLegs', leg.id, { seaMargin: e.target.value })}
                      />
                    </td>
                    <td className={styles.lbCol}>
                      <WorksheetSelect
                        id={legIndex === 0 ? 'portPassage_0' : `portPassage_${legIndex}`}
                        value={leg.passageType}
                        disabled={readOnly}
                        options={PASSAGE_TYPE_OPTIONS}
                        onChange={(value) => updateRow('portLegs', leg.id, { passageType: value })}
                      />
                    </td>
                    <td className={styles.speedTypeCol}>
                      <WorksheetSelect
                        id={legIndex === 0 ? 'portSpeed_0' : `portSpeed_${legIndex}`}
                        value={leg.speedType}
                        disabled={readOnly}
                        options={SPEED_TYPE_OPTIONS}
                        onChange={(value) => updateRow('portLegs', leg.id, { speedType: value })}
                      />
                    </td>
                    <td className={styles.routeCol}>
                      {editable ? (
                        <button
                          type="button"
                          className={styles.fetchBtn}
                          onClick={() => openDistanceFetch(leg)}
                        >
                          Sync
                        </button>
                      ) : null}
                    </td>
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
                    <th />
                    <th>To Port</th>
                    <th>Arrival</th>
                    <th className={styles.robCol}>VLSFO ROB</th>
                    <th className={styles.robCol}>LSMGO ROB</th>
                    <th>Departure</th>
                    <th className={styles.robCol}>VLSFO ROB</th>
                    <th className={styles.robCol}>LSMGO ROB</th>
                    <th className={styles.bgCol}>BG</th>
                    <th className={styles.nsecaCol}>NSECA Dist</th>
                    <th className={styles.nsecaCol}>NSECA Days</th>
                    <th className={styles.bgCol}>BG</th>
                    <th className={styles.nsecaCol}>SECA Dist</th>
                    <th className={styles.nsecaCol}>SECA Days</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.portIdxCol} />
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
                          id={`toArrival_${leg.id}`}
                          enableTime
                          className=""
                          value={leg.toArrival || ''}
                          onChange={(value) => updateRow('portLegs', leg.id, { toArrival: value })}
                        />
                      )}
                    </td>
                    <td className={styles.robCol}>
                      <input
                        value={leg.toRobFoArrival || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('portLegs', leg.id, { toRobFoArrival: e.target.value })}
                      />
                    </td>
                    <td className={styles.robCol}>
                      <input
                        value={leg.toRobDoArrival || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('portLegs', leg.id, { toRobDoArrival: e.target.value })}
                      />
                    </td>
                    <td>
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
                    <td className={styles.robCol}>
                      <input
                        value={leg.toRobFoDeparture || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('portLegs', leg.id, { toRobFoDeparture: e.target.value })}
                      />
                    </td>
                    <td className={styles.robCol}>
                      <input
                        value={leg.toRobDoDeparture || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('portLegs', leg.id, { toRobDoDeparture: e.target.value })}
                      />
                    </td>
                    <td className={styles.bgCol}>
                      <WorksheetSelect
                        value={leg.bgNonSeca || 'VLSFO'}
                        gradeLabel={leg.bgNonSeca || 'VLSFO'}
                        disabled={readOnly}
                        options={NSBG_OPTIONS}
                        onChange={(value) => updateRow('portLegs', leg.id, { bgNonSeca: value })}
                      />
                    </td>
                    <td className={styles.nsecaCol}>
                      <input value={leg.nonSecaDistance || ''} readOnly />
                    </td>
                    <td className={styles.nsecaCol}>
                      <input value={leg.nonSecaDays || ''} readOnly />
                    </td>
                    <td className={styles.bgCol}>
                      <WorksheetSelect
                        value={leg.bgSeca || 'LSMGO'}
                        gradeLabel={leg.bgSeca || 'LSMGO'}
                        disabled={readOnly}
                        options={SBG_OPTIONS}
                        onChange={(value) => updateRow('portLegs', leg.id, { bgSeca: value })}
                      />
                    </td>
                    <td className={styles.nsecaCol}>
                      <input
                        value={leg.secaDistance || ''}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('portLegs', leg.id, { secaDistance: e.target.value })}
                      />
                    </td>
                    <td className={styles.nsecaCol}>
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

      <CollapsiblePanel title="Speed & Consumption" defaultOpen round className={styles.roundSection}>
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
          const foRows = (form.consumptionRows || []).filter((row) => (
            String(row.identify || 'FO').toUpperCase() === 'FO'
          ));
          const doRows = (form.consumptionRows || []).filter((row) => (
            String(row.identify || '').toUpperCase() === 'DO'
          ));
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
                            <span className={`${styles.gradeChip} ${gradeChipClass(gradeName(row.bunkerGradeId))}`.trim()}>
                              {gradeName(row.bunkerGradeId)}
                            </span>
                          ) : (
                            <WorksheetSelect
                              value={row.bunkerGradeId || ''}
                              gradeLabel={gradeName(row.bunkerGradeId)}
                              placeholder="Select"
                              options={(lookups.bunkerGrades || []).map((g) => ({ value: g.id, label: g.name }))}
                              onChange={(value) => updateRow('consumptionRows', row.id, {
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
                <WorksheetSelect
                  id="speedDataType"
                  value={speedDataType}
                  disabled={readOnly}
                  options={SPEED_DATA_OPTIONS}
                  onChange={(value) => updateField('speedDataType', value)}
                />
                <Field id={ballastKey} label="Ballast Speed (K)">
                  <input {...inputProps(ballastKey, { recalc: true })} placeholder="0.00" />
                </Field>
                <Field id={ladenKey} label="Laden Speed (K)">
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
        round
        className={styles.roundSection}
      >
        <div className={styles.headerGrid}>
          {!(!isGas && String(form.tankType || '1') === '2') ? (
          <Field id="cargoId_0" label="Cargo Name" className={styles.cargoMultiSelectField}>
            <div id="cargoId_0" className={styles.cargoMultiSelectWrap}>
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
                variant="card"
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
            <WorksheetSelect
              id="charteringTeam"
              value={form.charteringTeam || ''}
              disabled={readOnly}
              options={(lookups.charteringTeams || []).map((row) => ({ value: row.id, label: row.name }))}
              onChange={(value) => updateField('charteringTeam', value)}
            />
          </Field>
          <Field id="charteringPic" label="Chartering PIC">
            <WorksheetSelect
              id="charteringPic"
              value={form.charteringPic || ''}
              disabled={readOnly}
              options={(() => {
                const options = [...(lookups.charteringPics || [])];
                const id = form.charteringPic != null ? String(form.charteringPic) : '';
                if (id && !options.some((row) => String(row.id) === id)) {
                  options.unshift({ id, name: form.charteringPicName || id });
                }
                return options.map((row) => ({ value: row.id, label: row.name }));
              })()}
              onChange={(value) => updateField('charteringPic', value)}
            />
          </Field>
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
            SelectField={WorksheetSelect}
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
        round
        className={styles.roundSection}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th style={{ width: 64 }} />
                <th />
                <th>Percentage (%)</th>
                <th>Freight Comm.</th>
                <th>Demurrage Comm.</th>
                <th>Vendor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td />
                <td>ADCOM Freight</td>
                <td>
                  <input
                    {...inputProps('addCommPercent', {
                      recalc: true,
                      // PHP updatecost_sheet_tci: Address Commission % is read-only
                      readOnly: readOnly || Boolean(searchParams.get('cost_sheet_id')),
                    })}
                    id="addCommPercentCargo"
                    placeholder="0.00"
                  />
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
                <td />
              </tr>
              {(form.brokerRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    {editable ? (
                      <KhakiRowActions
                        onAdd={() => addRow('brokerRows', createEmptyBrokerRow)}
                        onRemove={() => removeRow('brokerRows', row.id)}
                        canRemove={(form.brokerRows || []).length > 1}
                      />
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
                      onChange={(e) => updateRow('brokerRows', row.id, {
                        percent: sanitizeDecimalInput(e.target.value),
                      })}
                    />
                  </td>
                  <td>
                    <input value={row.amount || ''} readOnly placeholder="0.00" />
                  </td>
                  <td>
                    <input value={row.demmPercent || ''} readOnly placeholder="0.00" />
                  </td>
                  <td>
                    <WorksheetSelect
                      value={row.vendorId || ''}
                      disabled={readOnly}
                      options={(lookups.owners || []).map((vendor) => ({ value: vendor.id, label: vendor.name }))}
                      onChange={(value) => updateRow('brokerRows', row.id, { vendorId: value })}
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td />
                <td>Total</td>
                <td>
                  <input
                    id="brokeragePercentCargo"
                    value={Number.isFinite(totalCommPercent) ? totalCommPercent.toFixed(2) : ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
                <td>
                  <input
                    id="brokerageAmtCargo"
                    value={Number.isFinite(totalFreightComm) ? totalFreightComm.toFixed(2) : ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
                <td>
                  <input
                    id="totalDemmCommCargo"
                    value={Number.isFinite(totalDemmComm) ? totalDemmComm.toFixed(2) : ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
                <td />
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

      <CollapsiblePanel
        title="OPEX"
        defaultOpen
        round
        className={styles.roundSection}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                {editable ? <th style={{ width: 64 }} /> : null}
                <th>Cost</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(form.orcRows || []).map((row) => (
                <tr key={row.id}>
                  {editable ? (
                    <td>
                      <KhakiRowActions
                        onAdd={() => addRow('orcRows', () => createDefaultOrcRow(lookups.ownerCosts))}
                        onRemove={() => removeRow('orcRows', row.id)}
                        canRemove={(form.orcRows || []).length > 1}
                      />
                    </td>
                  ) : null}
                  <td>
                    <WorksheetSelect
                      value={row.costId || ''}
                      disabled={readOnly}
                      options={(lookups.ownerCosts || []).map((cost) => ({ value: cost.id, label: cost.name }))}
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
                </tr>
              ))}
              <tr>
                <td colSpan={editable ? 2 : 1} />
                <td>
                  <input
                    id="totalOrcCost"
                    value={form.totalOrcCost || ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

{estimateType === 1 || estimateType === 2 ? (
        <CollapsiblePanel
          title="Additional Bunker Consumption"
          defaultOpen={false}
          round
          className={styles.roundSection}
        >
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 64 }} /> : null}
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
                        <KhakiRowActions
                          onAdd={() => addRow('bunkerActivityRows', () => createEmptyBunkerActivityRow({
                            price: lookups.marketPrices?.vlsfo || '',
                          }))}
                          onRemove={() => removeRow('bunkerActivityRows', row.id)}
                          canRemove={(form.bunkerActivityRows || []).length > 1}
                        />
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
                {editable && !(form.bunkerActivityRows || []).length ? (
                  <tr>
                    <td>
                      <div className="rowActions">
                        <RowAddButton
                          title="Add row"
                          onClick={() => addRow('bunkerActivityRows', () => createEmptyBunkerActivityRow({
                            price: lookups.marketPrices?.vlsfo || '',
                          }))}
                        />
                      </div>
                    </td>
                    <td colSpan={5} className={styles.summaryEmptyCell}>No bunker activities yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CollapsiblePanel>
      ) : null}

      <CollapsiblePanel title="Demurrage Dispatch" defaultOpen={false} round className={styles.roundSection}>
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
                <th>Net Value($)</th>
                <th>Vendor</th>
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
                  <td>
                    <WorksheetSelect
                      value={leg.ddcLpVendorId || ''}
                      disabled={readOnly}
                      options={(lookups.owners || []).map((vendor) => ({
                        value: vendor.code || vendor.id,
                        label: vendor.name,
                      }))}
                      onChange={(value) => updateRow('portLegs', leg.id, { ddcLpVendorId: value })}
                    />
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
                  <td>
                    <WorksheetSelect
                      value={leg.ddcDpVendorId || ''}
                      disabled={readOnly}
                      options={(lookups.owners || []).map((vendor) => ({
                        value: vendor.code || vendor.id,
                        label: vendor.name,
                      }))}
                      onChange={(value) => updateRow('portLegs', leg.id, { ddcDpVendorId: value })}
                    />
                  </td>
                </tr>,
              ])}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} />
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
        round
        className={styles.roundSection}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                {editable ? <th style={{ width: 64 }} /> : null}
                <th>Description</th>
                <th>Amount</th>
                <th>Add Comm(%)</th>
                <th>Net Amount</th>
                <th>Vendor</th>
              </tr>
            </thead>
            <tbody>
              {(form.otherIncomeRows || []).map((row) => (
                <tr key={row.id}>
                  {editable ? (
                    <td>
                      <KhakiRowActions
                        onAdd={() => addRow('otherIncomeRows', createEmptyOtherIncomeRow)}
                        onRemove={() => removeRow('otherIncomeRows', row.id)}
                        canRemove={(form.otherIncomeRows || []).length > 1}
                      />
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
                  <td>
                    <WorksheetSelect
                      value={row.vendorId || ''}
                      disabled={readOnly}
                      options={(lookups.owners || []).map((vendor) => ({
                        value: vendor.code || vendor.id,
                        label: vendor.name,
                      }))}
                      onChange={(value) => updateRow('otherIncomeRows', row.id, { vendorId: value })}
                    />
                  </td>
                </tr>
              ))}
              {editable && !(form.otherIncomeRows || []).length ? (
                <tr>
                  <td>
                    <div className="rowActions">
                      <RowAddButton
                        title="Add row"
                        onClick={() => addRow('otherIncomeRows', createEmptyOtherIncomeRow)}
                      />
                    </div>
                  </td>
                  <td colSpan={5} className={styles.summaryEmptyCell}>No other income rows yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

      
        <CollapsiblePanel
        title="Bunkers"
        defaultOpen={false}
        round
        className={styles.roundSection}
        actions={(
          <button
            type="button"
            className={styles.bunkerDetailsBtn}
            title="Full FIFO bunker calculations"
            onClick={() => setBunkerFifoOpen(true)}
          >
            Details
          </button>
        )}
      >
        <div className={styles.bunkerSubLabel}>Estimated &amp; Consumed</div>
        <div className={`${styles.tableWrap} ${styles.bunkerTableCard}`}>
          <table className={`${styles.portTable} ${styles.bunkerZebra}`}>
            <thead>
              <tr>
                {editable ? <th style={{ width: 64 }} /> : null}
                <th>Grade</th>
                <th>Estimated (MT)</th>
                <th>Actual Consumed (MT)</th>
                <th>Price ($/MT)</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {bunkerDisplayRows.length || blankEstimatedRows.length ? (
                <>
                  {bunkerDisplayRows.map((row) => (
                    <tr key={`summary-${row.grade}`}>
                      {editable ? (
                        <td>
                          <KhakiRowActions
                            readOnly={readOnly}
                            onAdd={addEstimatedConsumedRow}
                            onRemove={() => removeEstimatedConsumedGrade(row.grade)}
                          />
                        </td>
                      ) : null}
                      <td>
                        <span className={`${styles.gradeChip} ${gradeChipClass(row.grade)}`}>{row.grade}</span>
                      </td>
                      <td>
                        <input
                          className={styles.bunkerReadonly}
                          value={row.estimated || ''}
                          readOnly
                          placeholder="0.00"
                          title="System-computed from the voyage worksheet's ROB projection"
                        />
                      </td>
                      <td>
                        <div className={styles.consumedCell}>
                          <input
                            className={styles.bunkerLive}
                            value={row.consumed || ''}
                            readOnly={readOnly}
                            placeholder="0.00"
                            inputMode="decimal"
                            title="Comes from the ship's noon / departure / arrival reports. Opening ROB + Stemmed − Closing ROB."
                            onChange={(e) => handleBunkerConsumedChange(row.grade, e.target.value)}
                          />
                          <span className={styles.fifoTag} title="Live value from ship reports — oldest stock consumed first">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M21 12a9 9 0 1 1-2.6-6.4" />
                              <path d="M21 3v6h-6" />
                            </svg>
                            FIFO
                          </span>
                        </div>
                      </td>
                      <td>
                        <BunkerPriceInput
                          value={row.price || ''}
                          readOnly={readOnly}
                          onCommit={(next) => handleBunkerSummaryPriceChange(row.grade, next)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.bunkerReadonly}
                          value={row.amount || ''}
                          readOnly
                          placeholder="0.00"
                          title="Defaults to the FIFO-costed amount; changes if a manual price is entered"
                        />
                      </td>
                    </tr>
                  ))}
                  {blankEstimatedRows.map((row) => (
                    <tr key={`blank-est-${row.id}`}>
                      {editable ? (
                        <td>
                          <KhakiRowActions
                            readOnly={readOnly}
                            onAdd={addEstimatedConsumedRow}
                            onRemove={() => removeRow('secaBunkerRows', row.id, { allowEmpty: true })}
                          />
                        </td>
                      ) : null}
                      <td>
                        <WorksheetSelect
                          value={row.bunkerGradeId || ''}
                          gradeLabel={bunkerGradeName(row.bunkerGradeId)}
                          disabled={readOnly}
                          options={(lookups.bunkerGrades || [])
                            .filter((g) => {
                              const key = classifySummaryGradeName(g.name);
                              if (!key || !SUMMARY_BUNKER_GRADES.includes(key)) return false;
                              return availableEstimatedGrades.includes(key);
                            })
                            .map((g) => ({ value: g.id, label: g.name }))}
                          onChange={(value) => assignBlankEstimatedGrade(row.id, value)}
                        />
                      </td>
                      <td>
                        <input className={styles.bunkerReadonly} value="0.00" readOnly />
                      </td>
                      <td>
                        <input
                          className={styles.bunkerLive}
                          value={row.actualQty || ''}
                          readOnly={readOnly}
                          placeholder="0.00"
                          inputMode="decimal"
                          onChange={(e) => updateRow('secaBunkerRows', row.id, { actualQty: e.target.value })}
                        />
                      </td>
                      <td>
                        <BunkerPriceInput
                          value={row.price || ''}
                          readOnly={readOnly}
                          onCommit={(next) => updateRow('secaBunkerRows', row.id, { price: next })}
                        />
                      </td>
                      <td>
                        <input className={styles.bunkerReadonly} value="0.00" readOnly />
                      </td>
                    </tr>
                  ))}
                </>
              ) : (
                <tr>
                  <td colSpan={editable ? 6 : 5} className={styles.summaryEmptyCell}>
                    {editable ? (
                      <div className="rowActions">
                        <RowAddButton title="Add grade" onClick={addEstimatedConsumedRow} />
                      </div>
                    ) : (
                      'No bunker summary available yet.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.bunkerTotal}>
          <span>Total Bunker Consumed</span>
          <b>{bunkerDisplayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
        </div>

        <div className={styles.bunkerSubLabelStemmed}>Stemmed</div>
        <div className={`${styles.tableWrap} ${styles.bunkerTableCard}`}>
          <table className={`${styles.portTable} ${styles.bunkerZebra}`}>
            <thead>
              <tr>
                {editable ? <th style={{ width: 64 }} /> : null}
                <th>Grade</th>
                <th>Port</th>
                <th>Qty(MT)</th>
                <th>Price ($/MT)</th>
                <th>Amount</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              {(form.bunkerRows || [])
                .filter((row) => String(row.identify || '').toUpperCase() === 'SUPPLY')
                .map((row) => {
                  const passagePorts = getPassagePorts(form.portLegs);
                  const portInPassage = passagePorts.some((p) => p.id === String(row.portId || ''));
                  const gradeLabel = bunkerGradeName(row.bunkerGradeId) || '';
                  const addStemRow = () => {
                    addRow(
                      'bunkerRows',
                      () => createStemRowFromLast(form.bunkerRows, passagePorts),
                      { identify: 'SUPPLY' },
                    );
                  };
                  return (
                    <tr key={row.id}>
                      {editable ? (
                        <td>
                          <KhakiRowActions
                            readOnly={readOnly}
                            onAdd={addStemRow}
                            onRemove={() => removeRow('bunkerRows', row.id)}
                          />
                        </td>
                      ) : null}
                      <td>
                        <WorksheetSelect
                          value={row.bunkerGradeId || ''}
                          gradeLabel={gradeLabel}
                          disabled={readOnly}
                          options={(lookups.bunkerGrades || []).map((g) => ({ value: g.id, label: g.name }))}
                          onChange={(value) => updateRow('bunkerRows', row.id, { bunkerGradeId: value })}
                        />
                      </td>
                      <td>
                        <WorksheetSelect
                          value={portInPassage ? (row.portId || '') : ''}
                          disabled={readOnly || !passagePorts.length}
                          placeholder={passagePorts.length ? '— Select —' : 'Select ports in Passage & Ports'}
                          options={passagePorts.map((port) => ({ value: port.id, label: port.name }))}
                          onChange={(portId) => {
                            const match = passagePorts.find((p) => String(p.id) === String(portId));
                            updateRow('bunkerRows', row.id, {
                              portId: match ? String(match.id) : '',
                              portName: match?.name || '',
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          value={row.qty || ''}
                          readOnly={readOnly}
                          placeholder="0.00"
                          onChange={(e) => updateRow('bunkerRows', row.id, { qty: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          value={row.price || ''}
                          readOnly={readOnly}
                          placeholder="0.00"
                          onChange={(e) => updateRow('bunkerRows', row.id, { price: e.target.value })}
                        />
                      </td>
                      <td>
                        <input className={styles.bunkerReadonly} value={row.cost || ''} readOnly placeholder="0.00" />
                      </td>
                      <td>
                        <WorksheetSelect
                          value={row.vendorId || ''}
                          disabled={readOnly}
                          options={(lookups.owners || []).map((vendor) => ({
                            value: vendor.code || vendor.id,
                            label: vendor.name,
                          }))}
                          onChange={(value) => updateRow('bunkerRows', row.id, { vendorId: value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              {editable && !(form.bunkerRows || []).some((row) => String(row.identify || '').toUpperCase() === 'SUPPLY') ? (
                <tr>
                  <td>
                    <div className="rowActions">
                      <RowAddButton
                        title="Add stem"
                        onClick={() => {
                          addRow(
                            'bunkerRows',
                            () => createStemRowFromLast(
                              form.bunkerRows,
                              getPassagePorts(form.portLegs),
                            ),
                            { identify: 'SUPPLY' },
                          );
                        }}
                      />
                    </div>
                  </td>
                  <td colSpan={6} className={styles.summaryEmptyCell}>No stemmed bunkers yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title={showHireSection ? 'Hire / Vessel OPEX' : 'Vessel OPEX'}
        defaultOpen={false}
        round
        className={`${styles.roundSection} ${styles.opexFields}`}
        actions={showHireDetailsButton ? (
          <button
            type="button"
            className={styles.tcInHireBtn}
            title="Full hire terms, delivery / re-delivery and CVE"
            onClick={() => setHireDetailsOpen(true)}
          >
            TC-in Hire
          </button>
        ) : null}
      >
        {showHireSection ? (
          <div className={styles.headerGrid}>
            <Field id="hireRate" label={showIndexLinked ? 'Hire / Day ($)' : 'Hire / Day'}>
              <div className={styles.opexCheckRow}>
                {showIndexLinked ? (
                  <label className={styles.opexCheck} htmlFor="chkHire" title="Enable Hire / Day">
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
                ) : null}
                <input
                  id="hireRate"
                  value={form.hireRate || ''}
                  readOnly={readOnly || (isDry && !showIndexLinked) || (showIndexLinked && !form.chkHire)}
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(e) => {
                    const value = sanitizeFieldDecimal('hireRate', e.target.value);
                    applyPatch({
                      hireRate: value,
                      _hireRateCleared: value === '' || value == null,
                    });
                  }}
                />
              </div>
            </Field>
            {showIndexLinked ? (
              <>
                <Field id="chkIndex" label="Index Linked">
                  <label className={styles.opexCheck} htmlFor="chkIndex">
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
                    <span>Enable Baltic Index</span>
                  </label>
                </Field>
                <Field id="balticIndex" label="Baltic Index">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <WorksheetSelect
                      id="balticIndex"
                      value={form.balticIndex || ''}
                      disabled={readOnly || !form.chkIndex}
                      options={(lookups.balticRoutes || []).map((row) => ({
                        value: row.id,
                        label: row.label || row.code || row.name,
                      }))}
                      onChange={(value) => {
                        const match = (lookups.balticRoutes || []).find((row) => String(row.id) === String(value));
                        const daily = Number(match?.dailyRate) || 0;
                        const pct = Number(form.balticPercent) || 100;
                        const balticRate = daily > 0 ? ((pct * daily) / 100).toFixed(2) : '';
                        applyPatch({
                          balticIndex: value,
                          balticRate,
                        });
                      }}
                    />
                    <span>%</span>
                    <input
                      id="balticPercent"
                      value={form.balticPercent || ''}
                      readOnly={readOnly || !form.chkIndex}
                      inputMode="decimal"
                      autoComplete="off"
                      style={{ width: 56 }}
                      placeholder="100"
                      onChange={(e) => {
                        const value = sanitizeFieldDecimal('balticPercent', e.target.value);
                        const match = (lookups.balticRoutes || []).find(
                          (row) => String(row.id) === String(form.balticIndex),
                        );
                        const daily = Number(match?.dailyRate) || 0;
                        const pct = Number(value) || 0;
                        const balticRate = daily > 0 ? ((pct * daily) / 100).toFixed(2) : '';
                        applyPatch({ balticPercent: value, balticRate });
                      }}
                    />
                    <input
                      id="balticRate"
                      value={form.balticRate || ''}
                      readOnly
                      placeholder="0.00"
                      style={{ width: 90 }}
                    />
                  </div>
                </Field>
                <Field id="totalHireRate" label="Total Hire / Day ($)">
                  <input id="totalHireRate" value={form.totalHireRate || ''} readOnly placeholder="0.00" />
                </Field>
              </>
            ) : null}
            <Field id="dummyAdcom" label="Add Comm (%)">
              <input
                id="dummyAdcom"
                value={form.hireagePercent || ''}
                readOnly={readOnly}
                inputMode="decimal"
                autoComplete="off"
                onChange={(e) => {
                  const value = sanitizeFieldDecimal('hireagePercent', e.target.value);
                  // PHP setCveAmtInTcDet: dummyAdcom → txtHireargePercent only (not freight ADCOM)
                  applyPatch({ hireagePercent: value });
                }}
              />
            </Field>
            <Field id="hireagePercentAmt" label="Add Comm Amt">
              <input id="hireagePercentAmt" value={form.hireagePercentAmt || ''} readOnly />
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
            {showVcInButton ? (
              <Field id="hireDetailsBtn" label=" ">
                <div className={styles.hireBtnRow}>
                  <Link
                    id="vcInSheetBtn"
                    className={styles.hireDetailsBtn}
                    to={vcInHref}
                  >
                    VC-In
                  </Link>
                </div>
              </Field>
            ) : null}
          </div>
        ) : null}
        <div className={styles.headerGrid} style={{ marginTop: showHireSection ? 8 : 0 }}>
          <Field id="cvePerMonth" label="CVE (/Month)">
            <input {...inputProps('cvePerMonth', { recalc: true })} />
          </Field>
          <Field id="cveAmt" label="CVE">
            <input id="cveAmt" value={form.cveAmt || ''} readOnly placeholder="0.00" />
          </Field>
          <Field id="cveVendorId" label="CVE Vendor">
            <WorksheetSelect
              id="cveVendorId"
              value={form.cveVendorId || ''}
              disabled={readOnly}
              options={(lookups.owners || []).map((vendor) => ({
                value: vendor.code || vendor.id,
                label: vendor.name,
              }))}
              onChange={(value) => updateField('cveVendorId', value)}
            />
          </Field>
          {showVesselDailyOps ? (
            <Field id="vesselDailyOps" label="Vessel Daily Ops">
              <input {...inputProps('vesselDailyOps', { recalc: true })} />
            </Field>
          ) : null}
          {showHireSection ? (
            <>
              <Field id="offHireCve" label="CVE Off Hire (/Month)">
                <input {...inputProps('offHireCve', { recalc: true })} placeholder="0.00" />
              </Field>
              <Field id="offHireCveAmt" label="CVE Off Hire Amt">
                <input id="offHireCveAmt" value={form.offHireCveAmt || ''} readOnly placeholder="0.00" />
              </Field>
            </>
          ) : null}
        </div>
      </CollapsiblePanel>


{estimateType === 3 ? (
        <CollapsiblePanel title="Dry Cargo — Floating / Fixed / Average" defaultOpen={false} round className={styles.roundSection}>
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
        <div className={`${styles.estimateAsideInner} ${updateEstimateStyles.resultsAside}`}>
          <EstimateResultsPanels
            form={form}
            readOnly={readOnly}
            complianceYear={lookups.complianceYear || new Date().getFullYear()}
            onFieldChange={onFieldChange}
            onRecalc={onRecalc}
            round
          />
          <CollapsiblePanel
            title="Profit Sharing"
            defaultOpen={false}
            round
            className={styles.roundSection}
          >
            <div className={styles.tableWrap}>
              <table className={styles.portTable}>
                <thead>
                  <tr>
                    {editable ? <th style={{ width: 64 }} /> : null}
                    <th>Company</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {(form.profitSharingRows || []).map((row) => (
                    <tr key={row.id}>
                      {editable ? (
                        <td>
                          <KhakiRowActions
                            onAdd={() => addRow('profitSharingRows', createEmptyProfitSharingRow)}
                            onRemove={() => removeRow('profitSharingRows', row.id)}
                            canRemove={(form.profitSharingRows || []).length > 1}
                          />
                        </td>
                      ) : null}
                      <td>
                        <WorksheetSelect
                          value={row.vendorId || ''}
                          disabled={readOnly}
                          options={(lookups.ownBusiness || lookups.owners || []).map((o) => ({
                            value: o.id,
                            label: o.name,
                          }))}
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
                  {editable && !(form.profitSharingRows || []).length ? (
                    <tr>
                      <td>
                        <div className="rowActions">
                          <RowAddButton
                            title="Add row"
                            onClick={() => addRow('profitSharingRows', createEmptyProfitSharingRow)}
                          />
                        </div>
                      </td>
                      <td colSpan={2} className={styles.summaryEmptyCell}>No profit sharing rows yet.</td>
                    </tr>
                  ) : null}
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
      <BunkerFifoModal
        open={bunkerFifoOpen}
        onClose={() => setBunkerFifoOpen(false)}
        form={form}
        readOnly={readOnly}
        resolveGradeName={bunkerGradeName}
        consumedByGrade={consumedByGrade}
        priceByGrade={priceByGrade}
        summaryRows={bunkerDisplayRows}
        vendorName={vendorName}
        bunkerGrades={lookups.bunkerGrades || form._bunkerGrades || []}
        vendors={lookups.owners || []}
        voyageNo={form.voyageNo || ''}
        vesselName={form.vesselName || ''}
        charterer={(() => {
          const raw = form.charterer
            || form.lumpsumVendor
            || form.cargoRows?.[0]?.charterer
            || form.cargoRows?.[0]?.vendorId
            || '';
          if (!raw) return '';
          return vendorName(raw) || String(raw);
        })()}
        onApply={({ fifoTotal }) => {
          applyPatch({
            totalBunkerCost: fifoTotal ? fifoTotal.toFixed(2) : form.totalBunkerCost,
          });
        }}
        onUpdateStem={(rowId, patch) => {
          const current = (form.bunkerRows || []).find((row) => row.id === rowId) || {};
          const next = { ...current, ...patch };
          const qty = Number(String(next.qty ?? '').replace(/,/g, ''));
          const price = Number(String(next.price ?? '').replace(/,/g, ''));
          const addl = Number(String(next.addlCost ?? '').replace(/,/g, ''));
          const amount = (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0);
          updateRow('bunkerRows', rowId, {
            ...patch,
            cost: amount.toFixed(2),
            totalCost: (amount + (Number.isFinite(addl) ? addl : 0)).toFixed(2),
          });
        }}
        onUpdatePortLeg={(legId, patch) => updateRow('portLegs', legId, patch)}
        onAddStem={() => {
          addRow(
            'bunkerRows',
            () => createStemRowFromLast(
              form.bunkerRows,
              getPassagePorts(form.portLegs),
            ),
            { identify: 'SUPPLY' },
          );
        }}
        onRemoveStem={(rowId) => removeRow('bunkerRows', rowId)}
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


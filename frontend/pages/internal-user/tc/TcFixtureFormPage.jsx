import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AttachmentDropzone, CardSelect, DmyDateInput, LoadingOverlay, useAlert, useConfirm } from '@bainbridge/shared-ui';
import { appPath, attachmentUrl } from '@bainbridge/shared-routing';
import { getUser } from '@bainbridge/shared-auth';
import { useTcModule } from '../../../hooks/useTcModule.js';
import {
  calcTcTotals,
  createTcEstimate,
  daysBetween,
  downloadTcEstimatePdf,
  fetchNextTcEstimateNo,
  fetchPeriodTcInDetails,
  fetchTcBusinessTypes,
  fetchTcEstimate,
  fetchTcLookups,
  saveTcCalculation,
  updateTcEstimate,
} from '../../../services/tcEstimates.js';
import { fetchVesselEstimatePrefill } from '../../../services/estimateDetail.js';
import saveIcon from '../../../assets/Save.png';
import VesselSearchSelect from '../sopf/VesselSearchSelect.jsx';
import CollapsiblePanel from '../sopf/CollapsiblePanel.jsx';
import { focusEstimateValidationField } from '../sopf/estimateValidation.js';
import { getTcAddRowBlockMessage, validateTcRecapForm } from './tcRecapValidation.js';
import TcFormHeaderActions from './TcFormHeaderActions.jsx';
import TcInExpensesModal, {
  EMPTY_TC_IN_BUNKER,
  EMPTY_TC_IN_HIRE,
  EMPTY_TC_IN_OFF,
  calcTcInFinalHireage,
} from './TcInExpensesModal.jsx';
import styles from './TcPages.module.css';

function CancelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const EMPTY_BUNKER = { bunkerId: '', qty: '', price: '', amount: '', bunkerDate: '' };
const EMPTY_HIRE = { delDate: '', reDelDate: '', days: '', hireRate: '', amount: '', randomId: '' };
const EMPTY_OFF = {
  reason: '',
  from: '',
  to: '',
  days: '',
  hireRate: '',
  amount: '',
  vendorId: '',
  bunkers: [],
  bunkersOpen: false,
};
const EMPTY_OFF_BUNKER = { bunkerId: '', gradeName: '', qty: '', price: '', amount: '' };
const EMPTY_EXPENSE = {
  expenseTypeId: '',
  description: '',
  notes: '',
  addToTotal: false,
  amount: '',
  vendorId: '',
};
const EMPTY_ITIN_EXP = { expenseType: '', description: '', amount: '', notes: '' };
const EMPTY_ITINERARY = {
  from: { place: '', date: '', notes: '' },
  to: { place: '', date: '', notes: '' },
};
const CONTRACT_TYPE_OPTIONS = [
  { id: 'tcout', name: 'TC Out' },
  { id: 'tcinout', name: 'TC In/TC Out' },
];

function CircleAddIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CircleDelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SectionIcon({ children }) {
  return children;
}

const SECTION_ICONS = {
  identifiers: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <circle cx="8.5" cy="11" r="1.8" />
        <path d="M6 16c0-1.7 1.2-2.8 2.5-2.8s2.5 1.1 2.5 2.8" />
        <path d="M13.5 9.5h4M13.5 12.5h4" />
      </svg>
    </SectionIcon>
  ),
  cp: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 4.5h8v15l-2-1.3-2 1.3-2-1.3-2 1.3z" />
        <path d="M10 8h4M10 11h4M10 14h2.5" />
      </svg>
    </SectionIcon>
  ),
  vessel: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 16l1.5-6h13L20 16c-1 1.5-3 2.5-8 2.5S5 17.5 4 16z" />
        <path d="M9 10V5h6v5" />
      </svg>
    </SectionIcon>
  ),
  tcDetails: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </svg>
    </SectionIcon>
  ),
  preTc: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 18h16" />
        <path d="M6 18V9l6-4 6 4v9" />
        <path d="M10 18v-5h4v5" />
      </svg>
    </SectionIcon>
  ),
  expenses: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 3.5h10v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4z" />
        <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
      </svg>
    </SectionIcon>
  ),
  trip: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
        <path d="M3.5 9.5h17" />
        <path d="M8 3v3M16 3v3" />
        <path d="M8 13.5h2M8 17h2M14 13.5h2M14 17h2" />
      </svg>
    </SectionIcon>
  ),
  bunkers: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z" />
      </svg>
    </SectionIcon>
  ),
  terms: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M15 9l-2 5-5 2 2-5z" />
      </svg>
    </SectionIcon>
  ),
  docs: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 12.5V7a4 4 0 0 1 8 0v9a2.5 2.5 0 0 1-5 0V8.5" />
      </svg>
    </SectionIcon>
  ),
};

function ownerChipClass(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'owner') return `${styles.tableCardSelect} ${styles.chipOwnerWrap}`;
  if (v === 'charterer') return `${styles.tableCardSelect} ${styles.chipChartererWrap}`;
  return styles.tableCardSelect;
}

function gradeSelectClass(name) {
  const upper = String(name || '').toUpperCase();
  if (upper.includes('VLSFO')) return `${styles.tableCardSelect} ${styles.chipGradeVlsfo}`;
  if (upper.includes('LSMGO') || upper.includes('MGO') || upper.includes('MDO')) {
    return `${styles.tableCardSelect} ${styles.chipGradeLsmgo}`;
  }
  if (upper.includes('HSFLO')) return `${styles.tableCardSelect} ${styles.chipGradeHsflo}`;
  if (upper.includes('HSFO')) return `${styles.tableCardSelect} ${styles.chipGradeHsfo}`;
  if (upper.includes('SCRUB')) return `${styles.tableCardSelect} ${styles.chipGradeScrubber}`;
  return styles.tableCardSelect;
}

const OWNER_CHARTERER_OPTIONS = [
  { id: 'Owner', name: 'Owner' },
  { id: 'Charterer', name: 'Charterer' },
];

function TableCardSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select',
  disabled = false,
  className = '',
  id,
  ariaLabel,
}) {
  return (
    <div className={(className || styles.tableCardSelect).trim()}>
      <CardSelect
        id={id}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        align="start"
        ariaLabel={ariaLabel || placeholder}
        tone="muted"
      />
    </div>
  );
}

const ADDRESS_NOT_FOUND = 'address not found';

function resolveChartererAddress(lookups, chartererCode) {
  const code = String(chartererCode || '').trim();
  if (!code) return '';
  const match = (lookups?.charterers || []).find((opt) => String(opt.id) === code);
  const address = String(match?.address || '').trim();
  return address || ADDRESS_NOT_FOUND;
}

function ConnectIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function PeriodConnectSelect({
  options = [],
  value,
  onChange,
  disabled = false,
  placeholder = 'Select Contract',
}) {
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const normalized = options.map((opt) => ({
    id: String(opt.id ?? opt.value ?? ''),
    name: opt.name ?? opt.label ?? String(opt.id ?? ''),
  }));
  const valueId = value == null || value === '' ? '' : String(value);
  const selected = normalized.find((opt) => opt.id === valueId);
  const label = selected?.name || placeholder;

  const updateMenuPosition = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.max(rect.width, 200);
    let left = rect.left;
    left = Math.min(Math.max(8, left), window.innerWidth - width - 8);
    setMenuStyle({
      position: 'fixed',
      top: `${rect.bottom + 6}px`,
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: '260px',
      zIndex: 10050,
    });
  };

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }
    updateMenuPosition();
    const onDoc = (event) => {
      if (wrapRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onRepos = () => updateMenuPosition();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onRepos);
    window.addEventListener('scroll', onRepos, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onRepos);
      window.removeEventListener('scroll', onRepos, true);
    };
  }, [open]);

  const menu = open && menuStyle && typeof document !== 'undefined'
    ? createPortal(
      <div ref={menuRef} className={styles.connectMenu} style={menuStyle} role="listbox" aria-label="Period contracts">
        <button
          type="button"
          role="option"
          className={`${styles.connectMenuItem} ${!valueId ? styles.connectMenuItemSelected : ''}`.trim()}
          onClick={() => {
            setOpen(false);
            onChange?.('');
          }}
        >
          — None —
        </button>
        {normalized.map((opt) => (
          <button
            key={opt.id || '__empty'}
            type="button"
            role="option"
            aria-selected={opt.id === valueId}
            className={`${styles.connectMenuItem} ${opt.id === valueId ? styles.connectMenuItemSelected : ''}`.trim()}
            onClick={() => {
              setOpen(false);
              onChange?.(opt.id);
            }}
          >
            {opt.name}
          </button>
        ))}
      </div>,
      document.body,
    )
    : null;

  return (
    <div className={styles.connectField} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={styles.connectBtn}
        title="Opens a popup listing master system period contracts"
        aria-label="Link Period CTT"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <ConnectIcon />
        <span>{label}</span>
      </button>
      {menu}
    </div>
  );
}

function resolveHirePeriod(row = {}) {
  let days = Number(row.days) || 0;
  if (row.delDate && row.reDelDate) {
    days = daysBetween(row.reDelDate, row.delDate) || 0;
  }
  const hireRate = Number(row.hireRate) || 0;
  const amount = hireRate * days;
  return {
    ...row,
    days: days ? String(Number(days.toFixed(4))) : (row.days || ''),
    amount: amount ? amount.toFixed(2) : (days === 0 && hireRate === 0 ? '' : '0.00'),
  };
}

function resolveOffHire(row = {}) {
  let days = Number(row.days) || 0;
  if (row.from && row.to) {
    days = daysBetween(row.to, row.from) || days;
  }
  const hireRate = Number(row.hireRate) || 0;
  const amount = days * hireRate;
  return {
    ...row,
    days: days ? String(Number(days.toFixed(4))) : (row.days || ''),
    amount: amount ? amount.toFixed(2) : (row.amount || ''),
  };
}

function defaultOffHireBunkers(lookupsBunkers = []) {
  const preferred = ['VLSFO', 'LSMGO'];
  const rows = preferred.map((name) => {
    const match = (lookupsBunkers || []).find((b) => String(b.name || '').toUpperCase().includes(name));
    return {
      ...EMPTY_OFF_BUNKER,
      bunkerId: match ? String(match.id) : '',
      gradeName: match?.name || name,
    };
  });
  return rows.length ? rows : [{ ...EMPTY_OFF_BUNKER, gradeName: 'VLSFO' }];
}

function collectOffHireBunkers(offHires = []) {
  const nested = [];
  for (const row of offHires || []) {
    for (const b of row.bunkers || []) nested.push({ ...EMPTY_OFF_BUNKER, ...b });
  }
  return nested;
}

/** Prefer nested bunkers on each off-hire; fall back to legacy flat grid on first row. */
function mergeOffHiresForCalc(offHires, offHireBunkers) {
  const legacyBunkers = (offHireBunkers || [])
    .filter((row) => row.qty || row.price || row.bunkerId)
    .map((row) => ({
      bunkerId: row.bunkerId || '',
      gradeName: row.gradeName || '',
      qty: row.qty || '',
      price: row.price || '',
      amount: row.amount || '',
    }));
  const rows = (offHires?.length ? offHires : [{ ...EMPTY_OFF }]).map(resolveOffHire);
  return rows.map((row, index) => {
    const nested = (row.bunkers || []).filter((b) => b.qty || b.price || b.bunkerId);
    if (nested.length) return { ...row, bunkers: nested };
    if (index === 0 && legacyBunkers.length) return { ...row, bunkers: legacyBunkers };
    return { ...row, bunkers: nested };
  });
}

function emptyTcIn(detail = {}, calc = {}) {
  return {
    cpDate: calc.tcCpDate || detail.cpDate || '',
    contractRef: calc.tcCpNumber || detail.tcNo || '',
    deliveryPort: calc.tcDeliveryPort || detail.delRangePort || '',
    redeliveryPort: calc.tcRedeliveryPort || detail.reDelRange || '',
    hires: [{
      ...EMPTY_TC_IN_HIRE,
      deliveryDate: detail.delDate || '',
      redeliveryDate: detail.reDelDate || '',
      dailyHire: detail.hireFixPer || '',
      addCommPct: detail.addComm || '',
    }],
    deliveryBunkers: [{ ...EMPTY_TC_IN_BUNKER }],
    redeliveryBunkers: [{ ...EMPTY_TC_IN_BUNKER }],
    offHires: [{ ...EMPTY_TC_IN_OFF }],
    offHireCveMonth: calc.tcOffHireCveMonth || '',
    bunkerOnOwner: calc.tcBunkerOnOwner || '',
    ilohc: calc.tcIlohc || detail.ilohcUsd || '',
    awrpCost: calc.awrpCost || '',
    finalVendor: calc.tcFinalVendor || '',
    finalHireage: calc.tcFinalHireage || '0.00',
  };
}

function hasSavedTcInHires(tcIn) {
  return Boolean(tcIn?.hires?.some((row) => (
    (row.dailyHire != null && String(row.dailyHire).trim() !== '')
    || (row.deliveryDate != null && String(row.deliveryDate).trim() !== '')
    || (row.hireage != null && String(row.hireage).trim() !== '' && Number(row.hireage) !== 0)
  )));
}

function applyPeriodTcIn(baseTcIn, periodData) {
  if (!periodData) return baseTcIn;
  const hires = (periodData.hires || []).map((row) => ({ ...EMPTY_TC_IN_HIRE, ...row }));
  const deliveryBunkers = (periodData.deliveryBunkers || []).map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }));
  const redeliveryBunkers = (periodData.redeliveryBunkers || []).map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }));
  const offHires = (periodData.offHires || []).map((row) => ({ ...EMPTY_TC_IN_OFF, ...row }));
  return {
    ...baseTcIn,
    hires: hires.length ? hires : baseTcIn.hires,
    deliveryBunkers: deliveryBunkers.length ? deliveryBunkers : baseTcIn.deliveryBunkers,
    redeliveryBunkers: redeliveryBunkers.length ? redeliveryBunkers : baseTcIn.redeliveryBunkers,
    offHires: offHires.length ? offHires : baseTcIn.offHires,
    bunkerOnOwner: periodData.bunkerOnOwner || baseTcIn.bunkerOnOwner || '',
  };
}

function normalizeCapexFields(detail = {}) {
  const calc = detail.calc || {};
  const hirePeriods = detail.hirePeriods?.length
    ? detail.hirePeriods.map((row) => resolveHirePeriod({ ...EMPTY_HIRE, ...row }))
    : [{
      ...EMPTY_HIRE,
      delDate: detail.delDate || calc.delDate || '',
      reDelDate: detail.reDelDate || calc.reDelDate || '',
      days: detail.durFixPer || '',
      hireRate: detail.hireFixPer || '',
    }].map(resolveHirePeriod);
  const offHires = detail.offHires?.length
    ? detail.offHires.map((row) => resolveOffHire({
      ...EMPTY_OFF,
      ...row,
      bunkers: (row.bunkers || []).map((b) => ({ ...EMPTY_OFF_BUNKER, ...b })),
      bunkersOpen: Boolean((row.bunkers || []).some((b) => b.qty || b.price || b.bunkerId)),
    }))
    : [{ ...EMPTY_OFF }];
  const flatBunkers = collectOffHireBunkers(offHires);
  // Legacy: if bunkers lived only on a flat grid, attach to first reason
  if (flatBunkers.length && !(offHires[0]?.bunkers || []).length) {
    offHires[0] = {
      ...offHires[0],
      bunkers: flatBunkers,
      bunkersOpen: true,
    };
  }
  const contractType = detail.contractType
    || (detail.periodId ? 'tcinout' : 'tcout');
  return {
    contractType,
    itinerary: {
      from: { ...EMPTY_ITINERARY.from, ...(detail.itinerary?.from || {}) },
      to: { ...EMPTY_ITINERARY.to, ...(detail.itinerary?.to || {}) },
    },
    itineraryExpenses: detail.itineraryExpenses?.length
      ? detail.itineraryExpenses.map((row) => ({ ...EMPTY_ITIN_EXP, ...row }))
      : [{ ...EMPTY_ITIN_EXP }],
    hirePeriods,
    otherIncome: detail.otherIncome || [],
    otherExpenses: detail.otherExpenses?.length
      ? detail.otherExpenses.map((row) => ({ ...EMPTY_EXPENSE, ...row }))
      : [{ ...EMPTY_EXPENSE }],
    offHires,
    offHireBunkers: [],
    tcInExpenses: detail.tcInExpenses
      ? {
          ...emptyTcIn(detail, calc),
          ...detail.tcInExpenses,
          hires: detail.tcInExpenses.hires?.length
            ? detail.tcInExpenses.hires.map((row) => ({ ...EMPTY_TC_IN_HIRE, ...row }))
            : emptyTcIn(detail, calc).hires,
          deliveryBunkers: detail.tcInExpenses.deliveryBunkers?.length
            ? detail.tcInExpenses.deliveryBunkers.map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }))
            : [{ ...EMPTY_TC_IN_BUNKER }],
          redeliveryBunkers: detail.tcInExpenses.redeliveryBunkers?.length
            ? detail.tcInExpenses.redeliveryBunkers.map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }))
            : [{ ...EMPTY_TC_IN_BUNKER }],
          offHires: detail.tcInExpenses.offHires?.length
            ? detail.tcInExpenses.offHires.map((row) => ({ ...EMPTY_TC_IN_OFF, ...row }))
            : [{ ...EMPTY_TC_IN_OFF }],
        }
      : emptyTcIn(detail, calc),
  };
}

function updateRow(list, index, patch) {
  const next = [...list];
  next[index] = { ...next[index], ...patch };
  return next;
}

function emptyForm(businessTypeId = '2') {
  return {
    businessTypeId,
    contractType: 'tcout',
    fixtureType: '1',
    vesselImoId: '',
    vesselName: '',
    vesselType: '',
    flag: '',
    tcDate: '',
    tcNo: '',
    estimateNo: 1,
    cpDate: '',
    cpType: '',
    charterer: '',
    charOperation: '',
    charteringTeam: '7',
    charteringPic1: '',
    charteringPic2: '',
    lawArbit: '',
    charOperAdd: '',
    buildYard: '',
    yearBuild: '',
    flag1: '',
    portOfReg: '',
    imoNo: '',
    classId: '',
    lastSpSurvey: '',
    lastDd: '',
    ownersPi: '',
    mastersName: '',
    callSign: '',
    inmarsatTel: '',
    inmarsatMail: '',
    loa1: '',
    breadth: '',
    summerDwt: '',
    summerDraft: '',
    tpc1: '',
    grossTonn: '',
    netTonn: '',
    cargoTankCap: '',
    noOfGrades: '',
    cargoPumpCap: '',
    totalSbtCap: '',
    suezGrt: '',
    suezNrt: '',
    panamaNrt: '',
    grainCap: '',
    baleCap: '',
    cranes: '',
    grabs: '',
    keelTopMast: '',
    waterlineTopMast: '',
    delRangePort: '',
    durFixPer: '',
    tripTc: '',
    period: '',
    noOfTrip: '',
    delDate: '',
    reDelDate: '',
    durOptPer: '',
    commOptPer: '',
    laycanFrom: '',
    laycanTo: '',
    laycanNarr: '',
    reDelRange: '',
    hireFixPer: '',
    exchangeCurrency: 'USD',
    exchangeRate: '1',
    hireOptPer: '',
    fuelSpecs: '',
    cveMonth: '',
    ballastBonus: '',
    supercargoMeals: '',
    holdCleanInter: '',
    ilohcUsd: '',
    ilohcRemarks: '',
    broCommPayable: '',
    addComm: '',
    brokerComm: '',
    ownersBankDet: '',
    docCreatBy: '',
    additInform: '',
    attachments: [],
    attachmentFiles: [],
    windForce: '',
    speedLaden: '',
    speedBallast: '',
    cpSpeed: '',
    foConsLaden: '',
    doConsLaden: '',
    foConsBallast: '',
    doConsBallast: '',
    foConsLdg: '',
    doConsLdg: '',
    foConsDisch: '',
    doConsDisch: '',
    foConsIdle: '',
    doConsIdle: '',
    loadRate: '',
    dischRate: '',
    balticRoute: '',
    balticDate: '',
    balticRate: '',
    periodId: '',
    dwtSummerCp: '',
    dwtTropicalCp: '',
    grainCapCp: '',
    baleCapCp: '',
    sfCp: '',
    loadableCp: '',
    grtNrtCp: '',
    loaCp: '',
    gearCp: '',
    builtYearCp: '',
    beamCp: '',
    tpcCp: '',
    bFullSpeedCp: '',
    bEcoSpeed1Cp: '',
    bEcoSpeed2Cp: '',
    lFullSpeedCp: '',
    lEcoSpeed1Cp: '',
    lEcoSpeed2Cp: '',
    foConsumptions: [],
    doConsumptions: [],
    deliveryBunkers: [{ ...EMPTY_BUNKER }],
    redeliveryBunkers: [{ ...EMPTY_BUNKER }],
    calc: null,
    itinerary: {
      from: { ...EMPTY_ITINERARY.from },
      to: { ...EMPTY_ITINERARY.to },
    },
    itineraryExpenses: [{ ...EMPTY_ITIN_EXP }],
    hirePeriods: [{ ...EMPTY_HIRE }],
    otherIncome: [],
    otherExpenses: [{ ...EMPTY_EXPENSE }],
    offHires: [{ ...EMPTY_OFF }],
    offHireBunkers: [],
    tcInExpenses: emptyTcIn(),
  };
}

function Field({ label, children, className = '', id }) {
  return (
    <div className={`${styles.field} ${className}`.trim()} data-estimate-field-wrap={id || undefined}>
      <label htmlFor={id || undefined}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder = '',
  type = 'text',
  className = '',
  id,
}) {
  return (
    <Field label={label} className={className} id={id}>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={readOnly ? styles.inputReadonly : undefined}
      />
    </Field>
  );
}

function DateField({ label, value, onChange, enableTime = false, className = '', id }) {
  return (
    <Field label={label} className={className} id={id}>
      <DmyDateInput
        id={id}
        value={value || ''}
        onChange={onChange}
        enableTime={enableTime}
      />
    </Field>
  );
}

function bunkerAmount(qty, price) {
  const q = Number(qty);
  const p = Number(price);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return '';
  return (q * p).toFixed(2);
}

function sumBunkerAmounts(rows = []) {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0).toFixed(2);
}

function isSubCharterBusinessType(businessTypes, businessTypeId) {
  const match = (businessTypes || []).find((opt) => String(opt.id) === String(businessTypeId));
  const label = String(match?.name || match?.label || '').toLowerCase();
  return /in\s*\/?\s*out|sub[\s-]?charter/.test(label);
}

function formatResult(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function applyVesselPrefill(prev, prefill, vesselMeta = {}) {
  if (!prefill && !vesselMeta.id) return prev;
  return {
    ...prev,
    vesselImoId: String(prefill?.vesselImoId || vesselMeta.id || prev.vesselImoId),
    vesselName: prefill?.vesselName || vesselMeta.name || prev.vesselName,
    vesselType: prefill?.vesselType || prev.vesselType,
    flag: prefill?.flag || prev.flag,
    flag1: prefill?.flag || prev.flag1,
    imoNo: prefill?.imoNo || prev.imoNo,
    summerDwt: prefill?.dwtSummer || prev.summerDwt,
    dwtSummerCp: prefill?.dwtSummer || prev.dwtSummerCp,
    loa1: prefill?.loa || prev.loa1,
    breadth: prefill?.beam || prev.breadth,
    yearBuild: prefill?.builtYear || prev.yearBuild,
    grainCap: prefill?.grainCap || prev.grainCap,
    baleCap: prefill?.baleCap || prev.baleCap,
    grossTonn: prefill?.gnrt || prev.grossTonn,
    netTonn: prefill?.nrt || prev.netTonn,
    tpc1: prefill?.tpc || prev.tpc1,
    businessTypeId: prefill?.businessTypeId || vesselMeta.businessTypeId || prev.businessTypeId,
    bFullSpeedCp: prefill?.bFullSpeed || prev.bFullSpeedCp,
    lFullSpeedCp: prefill?.lFullSpeed || prev.lFullSpeedCp,
  };
}

/** TC Recap add/edit/view form (Spot-style LHS accordion + RHS results). */
export default function TcFixtureFormPage({
  mode = 'add',
  overrideTcOutId,
  backHref,
}) {
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
  const { tcPath } = useTcModule();
  const { tcOutId: paramTcOutId } = useParams();
  const tcOutId = overrideTcOutId || paramTcOutId;
  const [searchParams] = useSearchParams();
  const [lookups, setLookups] = useState(null);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [form, setForm] = useState(() => {
    const periodId = searchParams.get('periodId') || searchParams.get('periodid') || '';
    return {
      ...emptyForm(searchParams.get('selBType') || '2'),
      periodId,
      contractType: periodId ? 'tcinout' : 'tcout',
    };
  });
  const [loading, setLoading] = useState(mode !== 'add');
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [tcInOpen, setTcInOpen] = useState(false);

  const returnToRaw = searchParams.get('returnTo') || '';
  const returnTo = (() => {
    if (!returnToRaw) return '';
    try {
      const decoded = decodeURIComponent(returnToRaw);
      if (decoded.startsWith('/internal-user/')) return appPath(decoded);
    } catch {
      /* ignore bad returnTo */
    }
    return '';
  })();

  const readOnly = mode === 'view';
  const listHref = backHref || returnTo || tcPath();
  const isDry = String(form.businessTypeId) === '3';
  const showSubCharter = form.contractType === 'tcinout'
    || isSubCharterBusinessType(businessTypes, form.businessTypeId)
    || Boolean(form.periodId);

  const itineraryExpenseTotal = useMemo(
    () => (form.itineraryExpenses || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [form.itineraryExpenses],
  );

  const otherIncomeTotal = useMemo(
    () => (form.otherIncome || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [form.otherIncome],
  );

  const expensePartyTotals = useMemo(() => {
    const sumParty = (rows, partyKey, party) => (rows || []).reduce((sum, row) => {
      const type = String(row[partyKey] || '').toLowerCase();
      if (type !== party) return sum;
      return sum + (Number(row.amount) || 0);
    }, 0);

    // Pre-TC uses expenseType; TC Expenses uses notes for Owner/Charterer
    const itineraryOwners = sumParty(form.itineraryExpenses, 'expenseType', 'owner');
    const itineraryCharterers = sumParty(form.itineraryExpenses, 'expenseType', 'charterer');
    const tcOwners = sumParty(form.otherExpenses, 'notes', 'owner');
    const tcCharterers = sumParty(form.otherExpenses, 'notes', 'charterer');
    const tcAddToTotal = (form.otherExpenses || []).reduce((sum, row) => {
      if (row.addToTotal === false) return sum;
      return sum + (Number(row.amount) || 0);
    }, 0);

    return {
      refOwners: itineraryOwners + tcOwners,
      refCharterers: itineraryCharterers + tcCharterers,
      tcAddToTotal,
      preTcTotal: itineraryOwners + itineraryCharterers,
    };
  }, [form.itineraryExpenses, form.otherExpenses]);

  const hirePeriodTotals = useMemo(() => {
    const rows = (form.hirePeriods || []).map(resolveHirePeriod);
    const totalDays = rows.reduce((sum, row) => sum + (Number(row.days) || 0), 0);
    const totalAmt = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return {
      rows,
      totalDays: totalDays ? Number(totalDays.toFixed(4)) : 0,
      totalAmt: totalAmt.toFixed(2),
    };
  }, [form.hirePeriods]);

  const dailyHireUsd = useMemo(() => {
    if (hirePeriodTotals.rows[0]?.amount) return hirePeriodTotals.rows[0].amount;
    const hire = Number(form.hireFixPer) || 0;
    const days = Number(form.durFixPer) || 0;
    const rate = Number(form.exchangeRate);
    const exchange = Number.isFinite(rate) && rate !== 0 ? rate : 1;
    if (days > 0) return (hire * days * exchange).toFixed(2);
    return (hire * exchange).toFixed(2);
  }, [form.durFixPer, form.exchangeRate, form.hireFixPer, hirePeriodTotals.rows]);

  const tcInFinalHireage = useMemo(() => {
    if (!showSubCharter || !form.tcInExpenses) {
      return Number(form.calc?.tcFinalHireage) || 0;
    }
    const live = Number(calcTcInFinalHireage(form.tcInExpenses).finalHireage) || 0;
    return live || Number(form.calc?.tcFinalHireage) || 0;
  }, [form.tcInExpenses, form.calc?.tcFinalHireage, showSubCharter]);

  const tcResults = useMemo(() => {
    const calc = form.calc || {};
    const hire = Number(form.hireFixPer) || 0;
    const rate = Number(form.exchangeRate);
    const exchange = Number.isFinite(rate) && rate !== 0 ? rate : 1;
    const dailyGrossHire = calc.dailyGrossHire || String((hire * exchange).toFixed(2));

    const hirePeriods = (form.hirePeriods?.length ? form.hirePeriods : [{ ...EMPTY_HIRE }]).map((row) => {
      const resolved = resolveHirePeriod(row);
      if (Number(resolved.hireRate) || resolved.delDate || resolved.reDelDate) return resolved;
      // Seed empty trip row from TC Details hire / period
      return resolveHirePeriod({
        ...resolved,
        delDate: resolved.delDate || form.delDate || '',
        reDelDate: resolved.reDelDate || form.reDelDate || '',
        days: resolved.days || form.durFixPer || '',
        hireRate: resolved.hireRate || form.hireFixPer || dailyGrossHire || '',
      });
    });

    const voyageExp = expensePartyTotals.tcAddToTotal + tcInFinalHireage;
    const totals = calcTcTotals({
      ...calc,
      dailyGrossHire,
      tcDays: form.durFixPer || calc.tcDays || '',
      addCommPct: form.addComm ?? calc.addCommPct,
      brokerCommPct: form.brokerComm ?? calc.brokerCommPct,
      ballastBonus: form.ballastBonus ?? calc.ballastBonus ?? '',
      cveMonth: form.cveMonth ?? calc.cveMonth,
      ilohcAmt: form.ilohcUsd ?? calc.ilohcAmt,
      hirePeriods,
      deliveryBunkers: form.deliveryBunkers,
      redeliveryBunkers: form.redeliveryBunkers,
      offHires: mergeOffHiresForCalc(form.offHires, form.offHireBunkers),
      otherIncome: otherIncomeTotal,
      totalExp: voyageExp,
    });

    const totalRev = Number(totals.totalRev) || 0;
    const lessOffHire = Number(totals.lessOffHire) || 0;
    const nettTcRev = Number(totals.nettHireInvoice) || 0;
    const totalExp = voyageExp + itineraryExpenseTotal;
    // Voyage earn excludes Pre-TC; Adj line deducts Pre-TC from that profit
    const profit = Number(totals.voyageEarn) || (totalRev - voyageExp);
    const profitAdjPreTc = profit - itineraryExpenseTotal;

    return {
      totalRev: formatResult(totalRev),
      lessOffHire: formatResult(lessOffHire),
      nettTcRev: formatResult(nettTcRev),
      refCharterers: formatResult(expensePartyTotals.refCharterers),
      refOwners: formatResult(expensePartyTotals.refOwners),
      totalExp: formatResult(totalExp),
      profit: formatResult(profit),
      profitAdjPreTc: formatResult(profitAdjPreTc),
    };
  }, [
    form.calc,
    form.hireFixPer,
    form.exchangeRate,
    form.hirePeriods,
    form.delDate,
    form.reDelDate,
    form.durFixPer,
    form.addComm,
    form.brokerComm,
    form.ballastBonus,
    form.cveMonth,
    form.ilohcUsd,
    form.deliveryBunkers,
    form.redeliveryBunkers,
    form.offHires,
    form.offHireBunkers,
    otherIncomeTotal,
    expensePartyTotals,
    itineraryExpenseTotal,
    tcInFinalHireage,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, types] = await Promise.all([
          fetchTcLookups(),
          fetchTcBusinessTypes(form.businessTypeId),
        ]);
        if (cancelled) return;
        setLookups(data);
        setBusinessTypes(types?.businessTypes || types || []);
        setForm((prev) => {
          let next = prev;
          if (mode === 'add') {
            const sessionUser = getUser();
            const sessionId = sessionUser?.id != null ? String(sessionUser.id) : '';
            const pics = data?.charteringPics || [];
            const inList = sessionId && pics.some((pic) => String(pic.id) === sessionId);
            if (inList && !next.charteringPic1) {
              next = {
                ...next,
                charteringPic1: sessionId,
                charOperation: next.charOperation || sessionId,
              };
            }
          }
          if (next.charterer) {
            next = {
              ...next,
              charOperAdd: resolveChartererAddress(data, next.charterer),
            };
          }
          return next;
        });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load lookups.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load lookups once on mount
  }, []);

  useEffect(() => {
    if (mode !== 'add' || readOnly) return undefined;
    const tcNo = String(form.tcNo || '').trim();
    if (!tcNo) {
      setForm((prev) => (Number(prev.estimateNo) === 1 ? prev : { ...prev, estimateNo: 1 }));
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const nextNo = await fetchNextTcEstimateNo(tcNo);
        if (cancelled) return;
        const estimateNo = Number(nextNo) > 0 ? Number(nextNo) : 1;
        setForm((prev) => (Number(prev.estimateNo) === estimateNo ? prev : { ...prev, estimateNo }));
      } catch {
        if (!cancelled) {
          setForm((prev) => (Number(prev.estimateNo) === 1 ? prev : { ...prev, estimateNo: 1 }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [form.tcNo, mode, readOnly]);

  useEffect(() => {
    if (mode === 'add' || !tcOutId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const detail = await fetchTcEstimate(tcOutId);
        if (cancelled) return;
        setForm({
          ...emptyForm(detail.businessTypeId || '2'),
          ...detail,
          fixtureType: detail.fixtureType || '1',
          ballastBonus: detail.calc?.ballastBonus || detail.ballastBonus || '',
          attachments: (detail.attachments || []).map((item) => ({
            ...item,
            url: item.url || attachmentUrl(item.file),
          })),
          attachmentFiles: [],
          deliveryBunkers: detail.deliveryBunkers?.length ? detail.deliveryBunkers : [{ ...EMPTY_BUNKER }],
          redeliveryBunkers: detail.redeliveryBunkers?.length ? detail.redeliveryBunkers : [{ ...EMPTY_BUNKER }],
          foConsumptions: detail.foConsumptions || [],
          doConsumptions: detail.doConsumptions || [],
          calc: detail.calc || null,
          ...normalizeCapexFields(detail),
        });
        if (detail?.periodId && !hasSavedTcInHires(detail.tcInExpenses)) {
          try {
            const periodTcIn = await fetchPeriodTcInDetails(detail.periodId);
            if (!cancelled && periodTcIn) {
              setForm((prev) => ({
                ...prev,
                tcInExpenses: applyPeriodTcIn(prev.tcInExpenses, periodTcIn),
              }));
            }
          } catch {
            // Keep fixture-seeded TC In if period lookup fails.
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load TC Recap.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, tcOutId]);

  useEffect(() => {
    if (!lookups) return;
    setForm((prev) => {
      if (!prev.charterer) {
        return prev.charOperAdd ? { ...prev, charOperAdd: '' } : prev;
      }
      const nextAddress = resolveChartererAddress(lookups, prev.charterer);
      return prev.charOperAdd === nextAddress ? prev : { ...prev, charOperAdd: nextAddress };
    });
  }, [lookups, form.charterer]);

  const setField = (key, value) => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateBunker = (kind, index, key, value) => {
    if (readOnly) return;
    setForm((prev) => {
      const rows = [...(prev[kind] || [])];
      const next = { ...rows[index], [key]: value };
      if (key === 'qty' || key === 'price') {
        next.amount = bunkerAmount(key === 'qty' ? value : next.qty, key === 'price' ? value : next.price);
      }
      if (key === 'bunkerId') {
        const match = (lookups?.bunkers || []).find((opt) => String(opt.id) === String(value));
        next.gradeName = match?.name || '';
      }
      rows[index] = next;
      return { ...prev, [kind]: rows };
    });
  };

  const addBunker = async (kind) => {
    if (readOnly) return;
    const block = getTcAddRowBlockMessage(kind, form[kind] || []);
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    setForm((prev) => ({ ...prev, [kind]: [...(prev[kind] || []), { ...EMPTY_BUNKER }] }));
  };

  const removeBunker = (kind, index) => {
    if (readOnly) return;
    setForm((prev) => {
      const rows = [...(prev[kind] || [])];
      rows.splice(index, 1);
      return { ...prev, [kind]: rows.length ? rows : [{ ...EMPTY_BUNKER }] };
    });
  };

  const handleSelectVessel = async (vessel) => {
    if (readOnly) return;
    if (!vessel) {
      setForm((prev) => ({
        ...prev,
        vesselImoId: '',
        vesselName: '',
        vesselType: '',
        flag: '',
      }));
      return;
    }
    setForm((prev) => applyVesselPrefill(prev, null, {
      id: vessel.id || vessel.vesselImoId,
      name: vessel.name || vessel.vesselName,
      businessTypeId: vessel.businessTypeId,
    }));
    try {
      const prefill = await fetchVesselEstimatePrefill(vessel.id || vessel.vesselImoId);
      if (prefill) {
        setForm((prev) => applyVesselPrefill(prev, prefill, {
          id: vessel.id || vessel.vesselImoId,
          name: vessel.name || vessel.vesselName,
        }));
      }
    } catch {
      // Keep basic vessel identity if prefill fails.
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (readOnly) return;
    setError('');

    const validationError = validateTcRecapForm(form);
    if (validationError) {
      setError(validationError.message);
      await alert({
        title: 'Alert',
        message: validationError.message,
        confirmLabel: 'OK',
      });
      focusEstimateValidationField(validationError.fieldId);
      return;
    }

    const confirmed = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you have checked each entry ?',
      confirmLabel: 'Submit',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      const hirePeriods = (form.hirePeriods?.length ? form.hirePeriods : [{ ...EMPTY_HIRE }])
        .map(resolveHirePeriod);
      const firstHire = hirePeriods[0] || {};
      const offHires = mergeOffHiresForSave(form.offHires, form.offHireBunkers);
      const attachments = form.attachments || [];
      const attachmentFiles = form.attachmentFiles || [];
      const payload = {
        ...form,
        fixtureType: form.fixtureType || '1',
        delDate: firstHire.delDate || form.delDate,
        reDelDate: firstHire.reDelDate || form.reDelDate,
        durFixPer: firstHire.days || form.durFixPer,
        hireFixPer: firstHire.hireRate || form.hireFixPer,
        hirePeriods,
        offHires,
        otherExpenses: form.otherExpenses || [],
        keepAttachment: attachments.map((item) => item.file).filter(Boolean).join(','),
        keepAttachmentName: attachments.map((item) => item.name || item.file).filter(Boolean).join(','),
      };
      delete payload.attachmentFiles;
      delete payload.attachments;
      let savedId = tcOutId;
      if (mode === 'add') {
        const created = await createTcEstimate(payload, attachmentFiles);
        savedId = created.tcOutId;
      } else {
        await updateTcEstimate(tcOutId, payload, attachmentFiles);
      }

      // Capex/itinerary/tcIn persist only via calculate endpoint — merge existing calc children.
      let existing = null;
      try {
        existing = await fetchTcEstimate(savedId);
      } catch {
        existing = null;
      }
      await saveTcCalculation(savedId, {
        calc: {
          ...(existing?.calc || form.calc || {}),
          ballastBonus: form.ballastBonus ?? '',
          cveMonth: form.cveMonth ?? '',
          ilohcAmt: form.ilohcUsd ?? '',
          addCommPct: form.addComm ?? '',
          brokerCommPct: form.brokerComm ?? '',
          tcCpDate: form.tcInExpenses?.cpDate || '',
          tcCpNumber: form.tcInExpenses?.contractRef || form.tcNo || '',
          tcDeliveryPort: form.tcInExpenses?.deliveryPort || form.delRangePort || '',
          tcRedeliveryPort: form.tcInExpenses?.redeliveryPort || form.reDelRange || '',
          tcFinalVendor: form.tcInExpenses?.finalVendor || '',
          tcOffHireCveMonth: form.tcInExpenses?.offHireCveMonth || '',
          tcBunkerOnOwner: form.tcInExpenses?.bunkerOnOwner || '',
          tcIlohc: form.tcInExpenses?.ilohc || '',
          awrpCost: form.tcInExpenses?.awrpCost || '',
        },
        hirePeriods,
        otherIncome: form.otherIncome?.length ? form.otherIncome : (existing?.otherIncome || []),
        otherExpenses: form.otherExpenses?.length ? form.otherExpenses : (existing?.otherExpenses || []),
        offHires,
        itinerary: form.itinerary,
        itineraryExpenses: form.itineraryExpenses,
        tcInExpenses: form.tcInExpenses,
      });

      if (mode === 'add') {
        if (returnTo) {
          navigate(returnTo, { replace: true });
        } else {
          navigate(`${tcPath(`${savedId}/edit`)}?msg=0`);
        }
      } else {
        navigate(returnTo || `${tcPath()}?msg=0`);
      }
    } catch (err) {
      setError(err.message || 'Failed to save TC Recap.');
    } finally {
      setSaving(false);
    }
  };

  const patchItinerary = (side, key, value) => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      itinerary: {
        ...prev.itinerary,
        [side]: { ...prev.itinerary[side], [key]: value },
      },
    }));
  };

  const patchItinExpense = (index, patch) => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      itineraryExpenses: updateRow(prev.itineraryExpenses || [], index, patch),
    }));
  };

  const addItinExpense = async () => {
    if (readOnly) return;
    const block = getTcAddRowBlockMessage('itineraryExpenses', form.itineraryExpenses || []);
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    setForm((prev) => ({
      ...prev,
      itineraryExpenses: [...(prev.itineraryExpenses || []), { ...EMPTY_ITIN_EXP }],
    }));
  };

  const addHirePeriod = async () => {
    if (readOnly) return;
    const block = getTcAddRowBlockMessage('hirePeriods', form.hirePeriods || []);
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    setForm((prev) => ({
      ...prev,
      hirePeriods: [...(prev.hirePeriods || []), { ...EMPTY_HIRE }],
    }));
  };

  const addOffHire = async () => {
    if (readOnly) return;
    const block = getTcAddRowBlockMessage('offHires', form.offHires || []);
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    setForm((prev) => ({
      ...prev,
      offHires: [
        ...(prev.offHires || []),
        resolveOffHire({
          ...EMPTY_OFF,
          hireRate: prev.hireFixPer || '',
        }),
      ],
    }));
  };

  const syncFixtureFromHirePeriods = (periods) => {
    const first = resolveHirePeriod(periods[0] || {});
    return {
      delDate: first.delDate || '',
      reDelDate: first.reDelDate || '',
      durFixPer: first.days || '',
      hireFixPer: first.hireRate || '',
    };
  };

  const patchHirePeriod = (index, patch) => {
    if (readOnly) return;
    setForm((prev) => {
      const next = updateRow(prev.hirePeriods || [{ ...EMPTY_HIRE }], index, patch).map(resolveHirePeriod);
      return {
        ...prev,
        hirePeriods: next,
        ...syncFixtureFromHirePeriods(next),
      };
    });
  };

  const patchOffHire = (index, patch) => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      offHires: updateRow(prev.offHires || [{ ...EMPTY_OFF }], index, patch).map(resolveOffHire),
    }));
  };

  const patchOffHireNestedBunker = (offIndex, bunkerIndex, patch) => {
    if (readOnly) return;
    setForm((prev) => {
      const offHires = [...(prev.offHires || [{ ...EMPTY_OFF }])];
      const offRow = { ...offHires[offIndex] };
      const bunkers = updateRow(offRow.bunkers || [], bunkerIndex, patch).map((row) => {
        const qty = Number(row.qty) || 0;
        const price = Number(row.price) || 0;
        return { ...row, amount: (qty || price) ? (qty * price).toFixed(2) : '' };
      });
      offHires[offIndex] = resolveOffHire({ ...offRow, bunkers });
      return { ...prev, offHires };
    });
  };

  const addOffHireBunkers = (offIndex) => {
    if (readOnly) return;
    setForm((prev) => {
      const offHires = [...(prev.offHires || [{ ...EMPTY_OFF }])];
      const offRow = { ...offHires[offIndex] };
      const existing = offRow.bunkers || [];
      const nextBunkers = existing.length
        ? [...existing, { ...EMPTY_OFF_BUNKER }]
        : defaultOffHireBunkers(lookups?.bunkers);
      offHires[offIndex] = {
        ...offRow,
        bunkers: nextBunkers,
        bunkersOpen: true,
      };
      return { ...prev, offHires };
    });
  };

  const removeOffHireBunker = (offIndex, bunkerIndex) => {
    if (readOnly) return;
    setForm((prev) => {
      const offHires = [...(prev.offHires || [{ ...EMPTY_OFF }])];
      const offRow = { ...offHires[offIndex] };
      const bunkers = (offRow.bunkers || []).filter((_, i) => i !== bunkerIndex);
      offHires[offIndex] = {
        ...offRow,
        bunkers,
        bunkersOpen: bunkers.length > 0 ? offRow.bunkersOpen : false,
      };
      return { ...prev, offHires };
    });
  };

  const patchOtherExpense = (index, patch) => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      otherExpenses: updateRow(prev.otherExpenses || [{ ...EMPTY_EXPENSE }], index, patch),
    }));
  };

  const mergeOffHiresForSave = (offHires, offHireBunkers) => mergeOffHiresForCalc(offHires, offHireBunkers);

  const addOtherExpense = async () => {
    if (readOnly) return;
    const block = getTcAddRowBlockMessage('otherExpenses', form.otherExpenses || []);
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    setForm((prev) => ({
      ...prev,
      otherExpenses: [...(prev.otherExpenses || []), { ...EMPTY_EXPENSE }],
    }));
  };

  const removeItinExpense = (index) => {
    if (readOnly) return;
    setForm((prev) => {
      const rows = [...(prev.itineraryExpenses || [])];
      rows.splice(index, 1);
      return { ...prev, itineraryExpenses: rows.length ? rows : [{ ...EMPTY_ITIN_EXP }] };
    });
  };

  const handlePeriodChange = async (periodId) => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      periodId,
      contractType: periodId ? 'tcinout' : prev.contractType,
    }));
    if (!periodId || hasSavedTcInHires(form.tcInExpenses)) return;
    try {
      const periodTcIn = await fetchPeriodTcInDetails(periodId);
      if (periodTcIn) {
        setForm((prev) => ({
          ...prev,
          periodId,
          contractType: 'tcinout',
          tcInExpenses: applyPeriodTcIn(prev.tcInExpenses, periodTcIn),
        }));
      }
    } catch {
      // Ignore period TC In seed failures.
    }
  };

  const handleGeneratePdf = async () => {
    if (mode === 'add' || !tcOutId || pdfLoading) return;
    setPdfLoading(true);
    setError('');
    try {
      await downloadTcEstimatePdf(tcOutId);
    } catch (err) {
      setError(err.message || 'Failed to generate TC Recap PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const renderBunkerTable = (kind, labelNode) => (
    <div className={styles.bunkerBlock}>
      <div className={`${styles.subBlockLabel} ${kind === 'deliveryBunkers' ? `${styles.subBlockLabelFirst} ${styles.subBlockLabelPad}` : ''}`.trim()}>
        {labelNode}
      </div>
      <div className={styles.subsectionCard}>
      <div className={styles.miniTableWrap}>
        <table className={styles.miniTable}>
          <thead>
            <tr>
              <th>Bunker Grade</th>
              <th>Qty (MT)</th>
              <th>Price (/MT)</th>
              <th>Bunker Date</th>
              <th>Amount</th>
              <th style={{ width: 64 }} />
            </tr>
          </thead>
          <tbody>
            {(form[kind] || []).map((row, index) => {
              const gradeName = (lookups?.bunkers || []).find((opt) => String(opt.id) === String(row.bunkerId))?.name
                || row.gradeName
                || '';
              const bunkerIdPrefix = kind === 'deliveryBunkers' ? 'delBunker' : 'reDelBunker';
              return (
                <tr key={`${kind}-${index}`}>
                  <td>
                    <TableCardSelect
                      id={index === 0 ? bunkerIdPrefix + '_0' : undefined}
                      options={[
                        ...(lookups?.bunkers || []),
                        ...(row.bunkerId != null
                          && String(row.bunkerId).trim() !== ''
                          && !(lookups?.bunkers || []).some((opt) => String(opt.id) === String(row.bunkerId))
                          ? [{ id: String(row.bunkerId), name: gradeName || `Grade #${row.bunkerId}` }]
                          : []),
                      ]}
                      value={row.bunkerId != null ? String(row.bunkerId) : ''}
                      onChange={(v) => updateBunker(kind, index, 'bunkerId', v)}
                      disabled={readOnly}
                      className={gradeSelectClass(gradeName)}
                      placeholder="Select"
                      ariaLabel="Bunker grade"
                    />
                  </td>
                  <td>
                    <input
                      id={index === 0 ? `${bunkerIdPrefix}Qty_0` : undefined}
                      value={row.qty || ''}
                      onChange={(e) => updateBunker(kind, index, 'qty', e.target.value)}
                      placeholder="0.00"
                      readOnly={readOnly}
                      className={readOnly ? styles.inputReadonly : undefined}
                    />
                  </td>
                  <td>
                    <input
                      id={index === 0 ? `${bunkerIdPrefix}Price_0` : undefined}
                      value={row.price || ''}
                      onChange={(e) => updateBunker(kind, index, 'price', e.target.value)}
                      placeholder="0.00"
                      readOnly={readOnly}
                      className={readOnly ? styles.inputReadonly : undefined}
                    />
                  </td>
                  <td>
                    <DmyDateInput
                      id={index === 0 ? `${bunkerIdPrefix}Date_0` : undefined}
                      value={row.bunkerDate || ''}
                      onChange={(value) => updateBunker(kind, index, 'bunkerDate', value)}
                      disabled={readOnly}
                    />
                  </td>
                  <td>
                    <input value={row.amount || ''} readOnly className={styles.inputReadonly} placeholder="0.00" />
                  </td>
                  <td>
                    {!readOnly ? (
                      <div className={styles.rowIconActions}>
                        <button
                          type="button"
                          className={`${styles.circleBtn} ${styles.circleBtnAdd}`}
                          title="Add bunker row"
                          onClick={() => addBunker(kind)}
                        >
                          <CircleAddIcon />
                        </button>
                        <button
                          type="button"
                          className={`${styles.circleBtn} ${styles.circleBtnDel}`}
                          title="Delete row"
                          onClick={() => removeBunker(kind, index)}
                        >
                          <CircleDelIcon />
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right' }}>Total</td>
              <td>{sumBunkerAmounts(form[kind])}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      </div>
    </div>
  );

  const businessTypeOptions = (Array.isArray(businessTypes) ? businessTypes : []).map((opt) => ({
    id: String(opt.id),
    name: opt.name || opt.label || String(opt.id),
  }));
  const businessTypeLabel = businessTypeOptions.find((opt) => String(opt.id) === String(form.businessTypeId))?.name
    || (isDry ? 'Dry' : 'Tankers');

  return (
    <div className={`zafira-page ${styles.page}`}>
      <TcFormHeaderActions
        listHref={listHref}
        disabled={saving || loading}
        onGeneratePdf={mode !== 'add' ? handleGeneratePdf : undefined}
        pdfLoading={pdfLoading}
        showTcInRecap={showSubCharter && !readOnly}
        onTcInRecap={() => setTcInOpen(true)}
      />
      {loading ? <LoadingOverlay active label="Loading TC Recap…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <form onSubmit={handleSubmit}>
          <div className={`${styles.estLayout} ${readOnly ? styles.viewModeLock : ''}`.trim()}>
            <div className={styles.estLhs}>

              <CollapsiblePanel title="Recap Identifiers" defaultOpen className={styles.estCard} icon={SECTION_ICONS.identifiers}>
                <div className={`${styles.denseGrid} ${styles.dense7}`}>
                  <Field label="Contract Type">
                    <CardSelect
                      options={CONTRACT_TYPE_OPTIONS}
                      value={form.contractType || 'tcout'}
                      onChange={(v) => setField('contractType', v || 'tcout')}
                      placeholder="Select contract type"
                      ariaLabel="Contract type"
                      tone="default"
                    />
                    {showSubCharter ? (
                      <div className={styles.subCharterBadge} aria-live="polite">
                        ⚠ Sub-Charter
                      </div>
                    ) : null}
                  </Field>
                  <Field label="Business Type">
                    <input
                      value={businessTypeLabel}
                      readOnly
                      className={styles.inputReadonly}
                    />
                  </Field>
                  <Field label="Vessel">
                    {readOnly ? (
                      <input
                        id="vesselName"
                        value={form.vesselName || ''}
                        readOnly
                        className={styles.inputReadonly}
                      />
                    ) : (
                      <VesselSearchSelect
                        value={form.vesselImoId}
                        label={form.vesselName}
                        onSelect={handleSelectVessel}
                      />
                    )}
                  </Field>
                  <TextInput label="Vessel Type" value={form.vesselType} readOnly />
                  <DateField label="CP Date" value={form.cpDate} onChange={(v) => setField('cpDate', v)} />
                  <TextInput
                    id="tcNo"
                    label="TC No."
                    value={form.tcNo}
                    onChange={(v) => setField('tcNo', v)}
                    readOnly={mode === 'edit' || readOnly}
                  />
                  <TextInput
                    label="Est No."
                    value={`EST${Number(form.estimateNo) > 0 ? Number(form.estimateNo) : 1}`}
                    readOnly
                  />
                  <Field label="Chartering Team" id="charteringTeam">
                    <CardSelect
                      id="charteringTeam"
                      options={lookups?.charteringTeams || []}
                      value={form.charteringTeam}
                      onChange={(v) => setField('charteringTeam', v)}
                      placeholder="Select chartering team"
                      ariaLabel="Chartering team"
                    />
                  </Field>
                  <Field label="Chartering PIC" id="charteringPic1">
                    <CardSelect
                      id="charteringPic1"
                      options={lookups?.charteringPics || []}
                      value={form.charteringPic1}
                      onChange={(v) => {
                        if (readOnly) return;
                        setForm((prev) => ({
                          ...prev,
                          charteringPic1: v,
                          charOperation: v,
                        }));
                      }}
                      placeholder="Select PIC"
                      ariaLabel="Chartering PIC"
                    />
                  </Field>
                  <Field label="Ops PIC" className={styles.opsPicItem}>
                    <CardSelect
                      options={lookups?.charteringPics || []}
                      value={form.charOperation}
                      onChange={(v) => setField('charOperation', v)}
                      placeholder="Select Ops PIC"
                      ariaLabel="Ops PIC"
                    />
                  </Field>
                  <Field label="Link Period Contract" className={styles.lpcItem}>
                    <PeriodConnectSelect
                      options={lookups?.periodContracts || []}
                      value={form.periodId}
                      onChange={handlePeriodChange}
                      disabled={readOnly}
                      placeholder="Select Contract"
                    />
                  </Field>
                </div>
                <input type="hidden" value={form.fixtureType || '1'} readOnly />
              </CollapsiblePanel>
              <CollapsiblePanel title="CP Information" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.cp}>
                <div className={styles.cpInfoGrid}>
                  <Field label="CP Type" className={styles.cpNarrowItem}>
                    <CardSelect
                      options={lookups?.cpTypes || []}
                      value={form.cpType}
                      onChange={(v) => setField('cpType', v)}
                      placeholder="Select CP type"
                      ariaLabel="CP type"
                    />
                  </Field>
                  <Field label="Law / Arbitration" className={styles.cpNarrowItem}>
                    <CardSelect
                      options={lookups?.lawArbitration || []}
                      value={form.lawArbit}
                      onChange={(v) => setField('lawArbit', v)}
                      placeholder="Select"
                      ariaLabel="Law arbitration"
                    />
                  </Field>
                  <Field label="Charterers" id="charterer" className={styles.cpChartererItem}>
                    <CardSelect
                      id="charterer"
                      options={lookups?.charterers || []}
                      value={form.charterer}
                      onChange={(v) => {
                        if (readOnly) return;
                        setForm((prev) => ({
                          ...prev,
                          charterer: v,
                          charOperAdd: resolveChartererAddress(lookups, v),
                        }));
                      }}
                      placeholder="Select charterer"
                      ariaLabel="Charterer"
                    />
                  </Field>
                  <Field label="Charterers' Address" className={styles.cpAddressItem}>
                    <input
                      value={form.charOperAdd || ''}
                      readOnly
                      className={styles.inputReadonly}
                      placeholder="Display from Vendor"
                    />
                  </Field>
                </div>
              </CollapsiblePanel>
              <CollapsiblePanel title="Vessel Particulars" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.vessel}>
                <div className={`${styles.denseGrid} ${styles.dense9}`}>
                  <TextInput label="Master's Name" value={form.mastersName} onChange={(v) => setField('mastersName', v)} />
                  <TextInput label="Yard" value={form.buildYard} readOnly />
                  <TextInput label="Yr Blt" value={form.yearBuild} readOnly />
                  <TextInput label="Flag" value={form.flag1 || form.flag} readOnly />
                  <TextInput label="POR" value={form.portOfReg} readOnly />
                  <TextInput label="IMO" value={form.imoNo} readOnly />
                  <TextInput label="Class ID" value={form.classId} readOnly />
                  <TextInput label="Last SS" value={form.lastSpSurvey} readOnly />
                  <TextInput label="Last DD" value={form.lastDd} readOnly />
                  <TextInput label="Owners' P&I" value={form.ownersPi} readOnly />
                  <TextInput label="Call Sign" value={form.callSign} readOnly />
                  <TextInput label="Inmar Tel" value={form.inmarsatTel} readOnly />
                  <TextInput label="Inmar Email" value={form.inmarsatMail} readOnly />
                  <TextInput label="LOA" value={form.loa1} readOnly />
                  <TextInput label="BDTH" value={form.breadth} readOnly />
                  <TextInput label="S DWT" value={form.summerDwt} readOnly />
                  <TextInput label="S Draft" value={form.summerDraft} readOnly />
                  <TextInput label="TPC" value={form.tpc1} readOnly />
                  <TextInput label="Gross Tonnage" value={form.grossTonn} readOnly />
                  <TextInput label="Net Tonnage" value={form.netTonn} readOnly />
                  <TextInput label="Keel to Mast Top" value={form.keelTopMast} readOnly />
                  <TextInput label="WL to Mast Top" value={form.waterlineTopMast} readOnly />
                  {!isDry ? (
                    <>
                      <TextInput label="Cargo Tk Cap (CBM)" value={form.cargoTankCap} readOnly />
                      <TextInput label="No. of Grades" value={form.noOfGrades} readOnly />
                      <TextInput label="Cargo PP Cap" value={form.cargoPumpCap} readOnly />
                      <TextInput label="SBT Cap (CBM)" value={form.totalSbtCap} readOnly />
                    </>
                  ) : null}
                </div>
              </CollapsiblePanel>
              <CollapsiblePanel title="TC Details" defaultOpen className={styles.estCard} icon={SECTION_ICONS.tcDetails}>
                <div className={styles.tcDetailsGrid}>
                  <Field label="Laycan From/To" className={styles.laycanWide}>
                    <div className={styles.dateRangePair}>
                      <DmyDateInput
                        id="laycanFrom"
                        value={form.laycanFrom || ''}
                        onChange={(v) => setField('laycanFrom', v)}
                        enableTime
                        disabled={readOnly}
                      />
                      <DmyDateInput
                        id="laycanTo"
                        value={form.laycanTo || ''}
                        onChange={(v) => setField('laycanTo', v)}
                        enableTime
                        disabled={readOnly}
                      />
                    </div>
                  </Field>
                  <Field label="Hire Currency" id="exchangeCurrency">
                    <CardSelect
                      id="exchangeCurrency"
                      options={lookups?.currencies || []}
                      value={form.exchangeCurrency}
                      onChange={(v) => setField('exchangeCurrency', v)}
                      placeholder="Currency"
                      ariaLabel="Hire currency"
                    />
                  </Field>
                  <TextInput label="X-rate to USD" value={form.exchangeRate} onChange={(v) => setField('exchangeRate', v)} />
                  <TextInput id="delRangePort" label="Del Port/Range" value={form.delRangePort} onChange={(v) => setField('delRangePort', v)} />
                  <TextInput id="reDelRange" label="Re-Del Port/Range" value={form.reDelRange} onChange={(v) => setField('reDelRange', v)} />
                  <TextInput
                    id="ballastBonus"
                    label="Ballast Bonus ($)"
                    value={form.ballastBonus}
                    onChange={(v) => setField('ballastBonus', v)}
                  />
                  <TextInput label="CVE/Month ($)" value={form.cveMonth} onChange={(v) => setField('cveMonth', v)} />
                  <TextInput id="ilohcUsd" label="ILOHC" value={form.ilohcUsd} onChange={(v) => setField('ilohcUsd', v)} />
                  <TextInput label="AD Comm (%)" value={form.addComm} onChange={(v) => setField('addComm', v)} />
                  <TextInput label="Brokerage (%)" value={form.brokerComm} onChange={(v) => setField('brokerComm', v)} />
                  <Field label="Brokerage Paid By" id="broCommPayable">
                    <CardSelect
                      id="broCommPayable"
                      options={lookups?.payableBy || []}
                      value={form.broCommPayable}
                      onChange={(v) => setField('broCommPayable', v)}
                      placeholder="Select"
                      ariaLabel="Brokerage paid by"
                    />
                  </Field>
                </div>
              </CollapsiblePanel>
              <CollapsiblePanel title="Pre-TC Details" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.preTc}>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst} ${styles.subBlockLabelPad}`}>Itinerary</div>
                <div className={styles.itineraryGrid}>
                  <TextInput
                    label="From"
                    value={form.itinerary?.from?.place || ''}
                    onChange={(v) => patchItinerary('from', 'place', v)}
                  />
                  <DateField
                    label="Date/Time"
                    value={form.itinerary?.from?.date || ''}
                    onChange={(v) => patchItinerary('from', 'date', v)}
                  />
                  <Field label="Notes">
                    <textarea
                      value={form.itinerary?.from?.notes || ''}
                      onChange={(e) => patchItinerary('from', 'notes', e.target.value)}
                      placeholder="Notes..."
                      readOnly={readOnly}
                      className={readOnly ? styles.inputReadonly : undefined}
                      rows={2}
                    />
                  </Field>
                  <TextInput
                    label="To"
                    value={form.itinerary?.to?.place || ''}
                    onChange={(v) => patchItinerary('to', 'place', v)}
                  />
                  <DateField
                    label="Date/Time"
                    value={form.itinerary?.to?.date || ''}
                    onChange={(v) => patchItinerary('to', 'date', v)}
                  />
                  <Field label="Notes">
                    <textarea
                      value={form.itinerary?.to?.notes || ''}
                      onChange={(e) => patchItinerary('to', 'notes', e.target.value)}
                      placeholder="Notes..."
                      readOnly={readOnly}
                      className={readOnly ? styles.inputReadonly : undefined}
                      rows={2}
                    />
                  </Field>
                </div>

                <div className={styles.subBlockLabel}>Expenses</div>
                <div className={styles.subsectionCard}>
                <div className={styles.miniTableWrap}>
                <table className={styles.miniTable}>
                  <thead>
                    <tr>
                      <th>Expense Type</th>
                      <th>Expense Description</th>
                      <th>Amount (USD)</th>
                      <th>Notes</th>
                      <th style={{ width: 64 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {(form.itineraryExpenses || []).map((row, index) => (
                      <tr key={`itin-exp-${index}`}>
                        <td>
                          <TableCardSelect
                            options={OWNER_CHARTERER_OPTIONS}
                            value={row.expenseType || ''}
                            onChange={(v) => patchItinExpense(index, { expenseType: v })}
                            disabled={readOnly}
                            className={ownerChipClass(row.expenseType)}
                            placeholder="Select"
                            ariaLabel="Expense type"
                          />
                        </td>
                        <td>
                          <input
                            value={row.description || ''}
                            onChange={(e) => patchItinExpense(index, { description: e.target.value })}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                          />
                        </td>
                        <td>
                          <input
                            value={row.amount || ''}
                            onChange={(e) => patchItinExpense(index, { amount: e.target.value })}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                            placeholder="0.00"
                          />
                        </td>
                        <td>
                          <input
                            value={row.notes || ''}
                            onChange={(e) => patchItinExpense(index, { notes: e.target.value })}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                            placeholder="Notes"
                          />
                        </td>
                        <td>
                          {!readOnly ? (
                            <div className={styles.rowIconActions}>
                              <button
                                type="button"
                                className={`${styles.circleBtn} ${styles.circleBtnAdd}`}
                                title="Add expense"
                                onClick={addItinExpense}
                              >
                                <CircleAddIcon />
                              </button>
                              <button
                                type="button"
                                className={`${styles.circleBtn} ${styles.circleBtnDel}`}
                                title="Delete row"
                                onClick={() => removeItinExpense(index)}
                              >
                                <CircleDelIcon />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'right' }}>Total (USD)</td>
                      <td>{itineraryExpenseTotal.toFixed(2)}</td>
                      <td />
                      <td />
                    </tr>
                  </tfoot>
                </table>
                </div>
                </div>
              </CollapsiblePanel>
              <CollapsiblePanel title="TC Expenses" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.expenses}>
                <div className={`${styles.subsectionCard} ${styles.subsectionCardNoLabel}`}>
                <div className={styles.miniTableWrap}>
                  <table className={`${styles.miniTable} ${styles.miniTableCenter}`}>
                    <thead>
                      <tr>
                        <th>Expense Desc.</th>
                        <th>Expense Type</th>
                        <th>Notes</th>
                        <th>Add to TTL</th>
                        <th>Expense Amt</th>
                        <th>Vendor</th>
                        <th style={{ width: 64 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(form.otherExpenses?.length ? form.otherExpenses : [{ ...EMPTY_EXPENSE }]).map((row, index) => (
                        <tr key={`exp-${index}`}>
                          <td>
                            <TableCardSelect
                              options={lookups?.expenseTypes || []}
                              value={row.expenseTypeId || ''}
                              onChange={(v) => {
                                const match = (lookups?.expenseTypes || []).find((opt) => String(opt.id) === String(v));
                                patchOtherExpense(index, {
                                  expenseTypeId: v,
                                  description: match?.name || row.description || '',
                                });
                              }}
                              disabled={readOnly}
                              placeholder="Select from"
                              ariaLabel="Expense description"
                            />
                          </td>
                          <td>
                            <TableCardSelect
                              options={OWNER_CHARTERER_OPTIONS}
                              value={row.notes || ''}
                              onChange={(v) => {
                                const isOwner = String(v || '').toLowerCase() === 'owner';
                                patchOtherExpense(index, {
                                  notes: v,
                                  // Add to TTL only applies to Owner expenses
                                  addToTotal: isOwner,
                                });
                              }}
                              disabled={readOnly}
                              className={ownerChipClass(row.notes)}
                              placeholder="Select from"
                              ariaLabel="Expense type"
                            />
                          </td>
                          <td>
                            <input
                              value={row.description || ''}
                              onChange={(e) => patchOtherExpense(index, { description: e.target.value })}
                              placeholder="Expense Desc."
                              readOnly={readOnly}
                              className={readOnly ? styles.inputReadonly : undefined}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              className={styles.expenseChk}
                              checked={String(row.notes || '').toLowerCase() === 'owner' && row.addToTotal !== false}
                              onChange={(e) => patchOtherExpense(index, { addToTotal: e.target.checked })}
                              disabled={readOnly || String(row.notes || '').toLowerCase() !== 'owner'}
                              title={
                                String(row.notes || '').toLowerCase() === 'owner'
                                  ? 'Add to total'
                                  : 'Add to TTL is only available for Owner expenses'
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.amount || ''}
                              onChange={(e) => patchOtherExpense(index, { amount: e.target.value })}
                              placeholder="0.00"
                              readOnly={readOnly}
                              className={readOnly ? styles.inputReadonly : undefined}
                            />
                          </td>
                          <td>
                            <TableCardSelect
                              options={lookups?.vendors || []}
                              value={row.vendorId || ''}
                              onChange={(v) => patchOtherExpense(index, { vendorId: v })}
                              disabled={readOnly}
                              placeholder="Select from"
                              ariaLabel="Vendor"
                            />
                          </td>
                          <td>
                            {!readOnly ? (
                              <div className={styles.rowIconActions}>
                                <button
                                  type="button"
                                  className={`${styles.circleBtn} ${styles.circleBtnAdd}`}
                                  title="Add expense"
                                  onClick={addOtherExpense}
                                >
                                  <CircleAddIcon />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.circleBtn} ${styles.circleBtnDel}`}
                                  title="Delete row"
                                  onClick={() => setForm((prev) => ({
                                    ...prev,
                                    otherExpenses: (prev.otherExpenses || []).length > 1
                                      ? prev.otherExpenses.filter((_, i) => i !== index)
                                      : [{ ...EMPTY_EXPENSE }],
                                  }))}
                                >
                                  <CircleDelIcon />
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
                {showSubCharter ? (
                  <div className={`${styles.tcInButtonRow} ${styles.viewModeAllow}`}>
                    <button
                      type="button"
                      className={`${styles.addRowBtn} ${styles.addRowBtnSubCharter}`}
                      onClick={() => setTcInOpen(true)}
                    >
                      <CircleAddIcon />
                      Add Sub-Charter Expense
                    </button>
                  </div>
                ) : null}
              </CollapsiblePanel>
              <CollapsiblePanel title="Trip Details" defaultOpen className={styles.estCard} icon={SECTION_ICONS.trip}>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst} ${styles.subBlockLabelPad}`}>Trip Schedule</div>
                <div className={styles.subsectionCard}>
                <div className={styles.miniTableWrap}>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr>
                        <th>Del Date (From)</th>
                        <th>Del Date (To)</th>
                        <th>Days</th>
                        <th>Hire ($/day)</th>
                        <th>Hire Amt ($)</th>
                        <th style={{ width: 64 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(form.hirePeriods?.length ? form.hirePeriods : [{ ...EMPTY_HIRE }]).map((row, index) => {
                        const resolved = hirePeriodTotals.rows[index] || resolveHirePeriod(row);
                        return (
                          <tr key={`hire-${index}`}>
                            <td>
                              <DmyDateInput
                                id={index === 0 ? 'hireDelDate_0' : undefined}
                                value={row.delDate || ''}
                                onChange={(v) => patchHirePeriod(index, { delDate: v })}
                                enableTime
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <DmyDateInput
                                id={index === 0 ? 'hireReDelDate_0' : undefined}
                                value={row.reDelDate || ''}
                                onChange={(v) => patchHirePeriod(index, { reDelDate: v })}
                                enableTime
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <input
                                value={resolved.days || ''}
                                onChange={(e) => patchHirePeriod(index, { days: e.target.value })}
                                readOnly={readOnly || Boolean(row.delDate && row.reDelDate)}
                                className={(readOnly || (row.delDate && row.reDelDate)) ? styles.inputReadonly : undefined}
                                placeholder="0"
                              />
                            </td>
                            <td>
                              <input
                                id={index === 0 ? 'hireRate_0' : undefined}
                                value={row.hireRate || ''}
                                onChange={(e) => patchHirePeriod(index, { hireRate: e.target.value })}
                                readOnly={readOnly}
                                className={readOnly ? styles.inputReadonly : undefined}
                                placeholder="0.00"
                              />
                            </td>
                            <td>
                              <input value={resolved.amount || dailyHireUsd} readOnly className={styles.inputReadonly} placeholder="0.00" />
                            </td>
                            <td>
                              {!readOnly ? (
                                <div className={styles.rowIconActions}>
                                  <button
                                    type="button"
                                    className={`${styles.circleBtn} ${styles.circleBtnAdd}`}
                                    title="Add a new trip"
                                    onClick={addHirePeriod}
                                  >
                                    <CircleAddIcon />
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.circleBtn} ${styles.circleBtnDel}`}
                                    title="Delete row"
                                    onClick={() => setForm((prev) => {
                                      const next = (prev.hirePeriods || []).length > 1
                                        ? prev.hirePeriods.filter((_, i) => i !== index)
                                        : [{ ...EMPTY_HIRE }];
                                      return { ...prev, hirePeriods: next, ...syncFixtureFromHirePeriods(next) };
                                    })}
                                  >
                                    <CircleDelIcon />
                                  </button>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={{ textAlign: 'right' }}>Total</td>
                        <td>{hirePeriodTotals.totalDays || ''}</td>
                        <td />
                        <td>{hirePeriodTotals.totalAmt}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                </div>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelPad}`}>Off Hire</div>
                <div className={styles.offhireList}>
                  {(form.offHires?.length ? form.offHires : [{ ...EMPTY_OFF }]).map((row, index) => {
                    const resolved = resolveOffHire(row);
                    const showBunkers = row.bunkersOpen || (row.bunkers || []).length > 0;
                    return (
                      <div key={`off-${index}`} className={`${styles.offhireItem} ${styles.subsectionCard}`}>
                        <div className={styles.miniTableWrap}>
                          <table className={`${styles.miniTable} ${styles.offhireMain}`}>
                            <thead>
                              <tr>
                                <th>Reason</th>
                                <th>From → To</th>
                                <th>Days</th>
                                <th>Rate/Day</th>
                                <th>Vendor</th>
                                <th>Amount</th>
                                <th style={{ width: 44 }} />
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>
                                  <input
                                    value={row.reason || ''}
                                    onChange={(e) => patchOffHire(index, { reason: e.target.value })}
                                    placeholder="Description"
                                    readOnly={readOnly}
                                    className={readOnly ? styles.inputReadonly : undefined}
                                  />
                                </td>
                                <td>
                                  <div className={styles.offhireRange}>
                                    <DmyDateInput
                                      value={row.from || ''}
                                      onChange={(v) => patchOffHire(index, { from: v })}
                                      enableTime
                                      disabled={readOnly}
                                    />
                                    <DmyDateInput
                                      value={row.to || ''}
                                      onChange={(v) => patchOffHire(index, { to: v })}
                                      enableTime
                                      disabled={readOnly}
                                    />
                                  </div>
                                </td>
                                <td>
                                  <input
                                    value={resolved.days || ''}
                                    onChange={(e) => patchOffHire(index, { days: e.target.value })}
                                    readOnly={readOnly || Boolean(row.from && row.to)}
                                    className={(readOnly || (row.from && row.to)) ? styles.inputReadonly : undefined}
                                  />
                                </td>
                                <td>
                                  <input
                                    value={row.hireRate || ''}
                                    onChange={(e) => patchOffHire(index, { hireRate: e.target.value })}
                                    readOnly={readOnly}
                                    className={readOnly ? styles.inputReadonly : undefined}
                                  />
                                </td>
                                <td>
                                  <TableCardSelect
                                    options={lookups?.vendors || []}
                                    value={row.vendorId || ''}
                                    onChange={(v) => patchOffHire(index, { vendorId: v })}
                                    disabled={readOnly}
                                    placeholder="Select"
                                    ariaLabel="Off hire vendor"
                                  />
                                </td>
                                <td>
                                  <input
                                    value={resolved.amount || ''}
                                    readOnly
                                    className={styles.inputReadonly}
                                  />
                                </td>
                                <td>
                                  {!readOnly ? (
                                    <div className={styles.rowIconActions}>
                                      <button
                                        type="button"
                                        className={`${styles.circleBtn} ${styles.circleBtnDel}`}
                                        title="Delete this off-hire item"
                                        onClick={() => setForm((prev) => ({
                                          ...prev,
                                          offHires: (prev.offHires || []).length > 1
                                            ? prev.offHires.filter((_, i) => i !== index)
                                            : [{ ...EMPTY_OFF }],
                                        }))}
                                      >
                                        <CircleDelIcon />
                                      </button>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className={styles.offhireBunkers}>
                          {showBunkers ? (
                            <div className={styles.offhireBunkersInner}>
                              <table className={`${styles.miniTable} ${styles.offhireBunkerTable}`}>
                                <thead>
                                  <tr>
                                    <th>Grade</th>
                                    <th>Qty (MT)</th>
                                    <th>Price (/MT)</th>
                                    <th>Amt</th>
                                    <th style={{ width: 44 }} />
                                  </tr>
                                </thead>
                                <tbody>
                                  {(row.bunkers?.length ? row.bunkers : [{ ...EMPTY_OFF_BUNKER }]).map((bunker, bIndex) => {
                                    const gradeName = bunker.gradeName
                                      || (lookups?.bunkers || []).find((b) => String(b.id) === String(bunker.bunkerId))?.name
                                      || '';
                                    return (
                                      <tr key={`ohb-${index}-${bIndex}`}>
                                        <td>
                                          <TableCardSelect
                                            options={[
                                              ...(lookups?.bunkers || []),
                                              ...(bunker.bunkerId
                                                && !(lookups?.bunkers || []).some((b) => String(b.id) === String(bunker.bunkerId))
                                                ? [{ id: String(bunker.bunkerId), name: gradeName || `Grade #${bunker.bunkerId}` }]
                                                : []),
                                            ]}
                                            value={bunker.bunkerId || ''}
                                            onChange={(v) => {
                                              const match = (lookups?.bunkers || []).find((b) => String(b.id) === String(v));
                                              patchOffHireNestedBunker(index, bIndex, {
                                                bunkerId: v,
                                                gradeName: match?.name || '',
                                              });
                                            }}
                                            disabled={readOnly}
                                            className={gradeSelectClass(gradeName)}
                                            placeholder="Select"
                                            ariaLabel="Off hire bunker grade"
                                          />
                                        </td>
                                        <td>
                                          <input
                                            value={bunker.qty || ''}
                                            onChange={(e) => patchOffHireNestedBunker(index, bIndex, { qty: e.target.value })}
                                            readOnly={readOnly}
                                            className={readOnly ? styles.inputReadonly : undefined}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            value={bunker.price || ''}
                                            onChange={(e) => patchOffHireNestedBunker(index, bIndex, { price: e.target.value })}
                                            readOnly={readOnly}
                                            className={readOnly ? styles.inputReadonly : undefined}
                                          />
                                        </td>
                                        <td>
                                          <input value={bunker.amount || ''} readOnly className={styles.inputReadonly} />
                                        </td>
                                        <td>
                                          {!readOnly ? (
                                            <div className={styles.rowIconActions}>
                                              <button
                                                type="button"
                                                className={`${styles.circleBtn} ${styles.circleBtnDel}`}
                                                title="Delete bunker row"
                                                onClick={() => removeOffHireBunker(index, bIndex)}
                                              >
                                                <CircleDelIcon />
                                              </button>
                                            </div>
                                          ) : null}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                          {!readOnly ? (
                            <button
                              type="button"
                              className={`${styles.addRowBtn} ${styles.offhireAddBunkersBtn}`}
                              onClick={() => addOffHireBunkers(index)}
                            >
                              + Add Bunkers
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    className={styles.addRowBtn}
                    onClick={addOffHire}
                  >
                    + Add Reason
                  </button>
                ) : null}
              </CollapsiblePanel>
              <CollapsiblePanel title="Bunkers" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.bunkers}>
                {renderBunkerTable(
                  'deliveryBunkers',
                  <>Bunkers on <span className={styles.bgDirChip}>Delivery</span></>,
                )}
                {renderBunkerTable(
                  'redeliveryBunkers',
                  <>Bunkers on <span className={styles.bgDirChip}>Redelivery</span></>,
                )}
              </CollapsiblePanel>
              <CollapsiblePanel title="TC Terms for Voyage" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.terms}>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst}`}>Sea Passage</div>
                <div className={styles.denseGrid}>
                  <TextInput label="Wind Force" value={form.windForce} onChange={(v) => setField('windForce', v)} />
                  <TextInput label="Speed Laden (kts)" value={form.speedLaden} onChange={(v) => setField('speedLaden', v)} />
                  <TextInput label="Speed Ballast (kts)" value={form.speedBallast} onChange={(v) => setField('speedBallast', v)} />
                  <TextInput label="CP Speed" value={form.cpSpeed} onChange={(v) => setField('cpSpeed', v)} />
                  <TextInput label="FO Cons Laden (MT/day)" value={form.foConsLaden} onChange={(v) => setField('foConsLaden', v)} />
                  <TextInput label="DO Cons Laden (MT/day)" value={form.doConsLaden} onChange={(v) => setField('doConsLaden', v)} />
                  <TextInput label="FO Cons Ballast (MT/day)" value={form.foConsBallast} onChange={(v) => setField('foConsBallast', v)} />
                  <TextInput label="DO Cons Ballast (MT/day)" value={form.doConsBallast} onChange={(v) => setField('doConsBallast', v)} />
                </div>
                <div className={styles.subBlockLabel}>Port</div>
                <div className={styles.denseGrid}>
                  <TextInput label="FO Cons Ldg (MT/day)" value={form.foConsLdg} onChange={(v) => setField('foConsLdg', v)} />
                  <TextInput label="DO Cons Ldg (MT/day)" value={form.doConsLdg} onChange={(v) => setField('doConsLdg', v)} />
                  <TextInput label="FO Cons Disch (MT/day)" value={form.foConsDisch} onChange={(v) => setField('foConsDisch', v)} />
                  <TextInput label="DO Cons Disch (MT/day)" value={form.doConsDisch} onChange={(v) => setField('doConsDisch', v)} />
                  <TextInput label="FO Cons Idle (MT/day)" value={form.foConsIdle} onChange={(v) => setField('foConsIdle', v)} />
                  <TextInput label="DO Cons Idle (MT/day)" value={form.doConsIdle} onChange={(v) => setField('doConsIdle', v)} />
                  <TextInput label="Load Rate (MT/day)" value={form.loadRate} onChange={(v) => setField('loadRate', v)} />
                  <TextInput label="Disch Rate (MT/day)" value={form.dischRate} onChange={(v) => setField('dischRate', v)} />
                </div>
              </CollapsiblePanel>
              <CollapsiblePanel title="Additional Info & Documents" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.docs}>
                <div className={styles.docsSectionStack}>
                  <div className={styles.denseGrid}>
                    <Field label="More Info" className={styles.span2}>
                      <input
                        value={form.additInform || ''}
                        onChange={(e) => setField('additInform', e.target.value)}
                        placeholder="Description"
                        readOnly={readOnly}
                        className={readOnly ? styles.inputReadonly : undefined}
                      />
                    </Field>
                  </div>
                  <AttachmentDropzone
                    readOnly={readOnly}
                    files={form.attachmentFiles || []}
                    existing={(form.attachments || []).map((item) => ({
                      ...item,
                      url: item.url || attachmentUrl(item.file),
                    }))}
                    onAddFiles={(added) => {
                      setForm((prev) => ({
                        ...prev,
                        attachmentFiles: [...(prev.attachmentFiles || []), ...added],
                      }));
                    }}
                    onRemoveFile={(index) => {
                      setForm((prev) => ({
                        ...prev,
                        attachmentFiles: (prev.attachmentFiles || []).filter((_, i) => i !== index),
                      }));
                    }}
                    onRemoveExisting={(_item, index) => {
                      setForm((prev) => ({
                        ...prev,
                        attachments: (prev.attachments || []).filter((_, i) => i !== index),
                      }));
                    }}
                  />
                </div>
              </CollapsiblePanel>
            </div>

                        <aside className={styles.estRhs}>
              <div className={styles.resultsBlock}>
                <div className={styles.resultsHead}>Revenue</div>
                <div className={styles.resultsBody}>
                  <div className={`${styles.resRow} ${styles.resRowAccent}`}>
                    <span className={styles.resRowLabel}>Total Revenue</span>
                    <span className={styles.resRowVal}>{tcResults.totalRev}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Less - Off Hire (Incl. Bunkers)</span>
                    <span className={styles.resRowVal}>{tcResults.lessOffHire}</span>
                  </div>
                  <div className={`${styles.resRow} ${styles.resRowAccentOrange}`}>
                    <span className={styles.resRowLabel}>Net TC Rev</span>
                    <span className={styles.resRowVal}>{tcResults.nettTcRev}</span>
                  </div>
                </div>
              </div>

              <div className={styles.resultsBlock}>
                <div className={styles.resultsHead}>Expenses</div>
                <div className={styles.resultsBody}>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Charterer's Acc</span>
                    <span className={styles.resRowVal}>{tcResults.refCharterers}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Owner's Acc</span>
                    <span className={styles.resRowVal}>{tcResults.refOwners}</span>
                  </div>
                  <div className={`${styles.resRow} ${styles.resRowAccentOrange}`}>
                    <span className={styles.resRowLabel}>Total Exp (Incl. Pre TC)</span>
                    <span className={styles.resRowVal}>{tcResults.totalExp}</span>
                  </div>
                </div>
              </div>

              <div className={styles.resultsBlock}>
                <div className={styles.resultsHead}>P&amp;L</div>
                <div className={styles.resultsBody}>
                  <div className={`${styles.resRow} ${styles.resRowAccentOrange}`}>
                    <span className={styles.resRowLabel}>Total Profit</span>
                    <span className={styles.resRowVal}>{tcResults.profit}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Profit (Adj. Pre TC)</span>
                    <span className={styles.resRowVal}>{tcResults.profitAdjPreTc}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className={`${styles.formFooter} ${styles.viewModeAllow}`}>
            <Link
              to={listHref}
              className={styles.btnCancel}
              onClick={(e) => {
                if (saving) e.preventDefault();
              }}
            >
              <CancelIcon />
              Cancel
            </Link>
            {mode === 'edit' ? (
              <Link
                to={tcPath(`${tcOutId}/calculate`)}
                className={styles.btnCalculate}
                aria-disabled={saving || undefined}
              >
                Calculate
              </Link>
            ) : null}
            {!readOnly ? (
              <button type="submit" className={styles.btnSave} disabled={saving}>
                <img src={saveIcon} alt="" className={styles.btnSaveIcon} />
                {saving ? 'Saving…' : 'Save'}
              </button>
            ) : null}
          </div>
      </form>

      <TcInExpensesModal
        open={tcInOpen}
        value={form.tcInExpenses}
        detail={form}
        lookups={lookups}
        readOnly={readOnly}
        onClose={() => setTcInOpen(false)}
        onApply={(next) => {
          setForm((prev) => ({ ...prev, tcInExpenses: next }));
          setTcInOpen(false);
        }}
      />
    </div>
  );
}

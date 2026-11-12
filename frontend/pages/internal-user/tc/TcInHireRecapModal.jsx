import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AttachmentDropzone, CardSelect, DmyDateInput, LoadingOverlay, RowAddButton, RowActions, RowDelButton, useAlert,
} from '@bainbridge/shared-ui';
import { daysBetween, hasDateValue } from '../../../services/tcEstimates.js';
import { fetchTankerParticulars } from '../../../services/vesselTankerParticulars.js';
import VesselParticularsReadonlyContent from '../fleet/VesselParticularsReadonlyContent.jsx';
import {
  EMPTY_TC_IN_BUNKER,
  EMPTY_TC_IN_EXPENSE,
  EMPTY_TC_IN_HIRE,
  EMPTY_TC_IN_OFF,
  EMPTY_TC_IN_PERIOD,
  EMPTY_TC_IN_PRE_EXP,
  applyMatchedTripRatesToOffHires,
  bunkerAmount,
  buildTcInRecapDraft,
  calcTcInFinalHireage,
  calcTcInGrossHireExpense,
  copyDeliveryBunkersToRedelivery,
  emptyTcInPeriodExtension,
  hasSavedTcInRecap,
  matchedTripHireRateForOffHire,
  normalizeTcInTerms,
  resolveHireRow,
  syncPeriodOneToLegacy,
  tcInHiresAsTripPeriods,
} from './tcInRecapCalcs.js';
import { getTcAddRowBlockMessage } from './tcRecapValidation.js';
import TcPeriodBlock from './TcPeriodBlock.jsx';
import styles from './TcPages.module.css';

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SectionIcon({ children }) {
  return <span className={styles.tcinAccordIcon}>{children}</span>;
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
  tcDetails: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
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
  vessel: (
    <SectionIcon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 16l1.5-6h13L20 16c-1 1.5-3 2.5-8 2.5S5 17.5 4 16z" />
        <path d="M9 10V5h6v5" />
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

const EMPTY_PERIOD_HIRE = { delDate: '', reDelDate: '', days: '', hireRate: '', amount: '', randomId: '' };
const EMPTY_PERIOD_OFF = {
  reason: '', from: '', to: '', days: '', hireRate: '', amount: '', bunkers: [], bunkersOpen: false,
};
const EMPTY_OFF_BUNKER = { bunkerId: '', gradeName: '', qty: '', price: '', amount: '' };

function resolveHirePeriod(row = {}) {
  // Prefer stored days (editable in TC In popup); fall back to date span when blank.
  let days = Number(row.days) || 0;
  if (
    (row.days === '' || row.days == null)
    && hasDateValue(row.delDate)
    && hasDateValue(row.reDelDate)
  ) {
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

function resolveOffHirePeriod(row = {}) {
  // Prefer stored days (editable in TC In popup); fall back to date span when blank.
  let days = Number(row.days) || 0;
  if (
    (row.days === '' || row.days == null)
    && hasDateValue(row.from)
    && hasDateValue(row.to)
  ) {
    days = daysBetween(row.to, row.from) || 0;
  }
  const hireRate = Number(row.hireRate) || 0;
  const amount = days * hireRate;
  return {
    ...row,
    days: days ? String(Number(days.toFixed(4))) : (row.days || ''),
    amount: amount ? amount.toFixed(2) : (row.amount || ''),
  };
}

function summarizeHirePeriodRows(hirePeriods = []) {
  const rows = (hirePeriods?.length ? hirePeriods : [{ ...EMPTY_PERIOD_HIRE }]).map(resolveHirePeriod);
  const totalDays = rows.reduce((sum, row) => sum + (Number(row.days) || 0), 0);
  const totalAmt = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  return {
    rows,
    totalDays: totalDays ? Number(totalDays.toFixed(4)) : 0,
    totalAmt: totalAmt.toFixed(2),
  };
}

function summarizeOffHireRows(offHires = []) {
  const rows = (offHires?.length ? offHires : [{ ...EMPTY_PERIOD_OFF }]).map(resolveOffHirePeriod);
  const totalDays = rows.reduce((sum, row) => sum + (Number(row.days) || 0), 0);
  const totalAmt = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  return {
    rows,
    totalDays: totalDays ? Number(totalDays.toFixed(4)) : 0,
    totalAmt: totalAmt.toFixed(2),
  };
}

function sortBunkersVlsfoFirst(bunkers = []) {
  return [...(bunkers || [])].sort((a, b) => {
    const rank = (name) => {
      const u = String(name || '').toUpperCase();
      return u.includes('VLSFO') || (u.includes('VLS') && !u.includes('HSFO')) ? 0 : 1;
    };
    const d = rank(a.name) - rank(b.name);
    return d !== 0 ? d : String(a.name || '').localeCompare(String(b.name || ''));
  });
}

const GRADE_CHIP_PALETTE = [
  styles.chipGradeVlsfo,
  styles.chipGradeLsmgo,
  styles.chipGradeHsfo,
  styles.chipGradeHsflo,
  styles.chipGradeScrubber,
  styles.chipGradeAltGreen,
  styles.chipGradeAltOrange,
  styles.chipGradeAltCyan,
];

function hashGradeName(name) {
  const str = String(name || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function gradeSelectClass(name) {
  const upper = String(name || '').toUpperCase().replace(/\s+/g, '');
  if (!upper) return styles.tableCardSelect;
  if (upper.includes('VLSFO') || upper.includes('VLS')) {
    return `${styles.tableCardSelect} ${styles.chipGradeVlsfo}`;
  }
  if (upper.includes('LSMGO')) {
    return `${styles.tableCardSelect} ${styles.chipGradeLsmgo}`;
  }
  if (upper.includes('MGO') || upper.includes('MDO')) {
    return `${styles.tableCardSelect} ${styles.chipGradeHsflo}`;
  }
  if (upper.includes('SCRUB')) {
    return `${styles.tableCardSelect} ${styles.chipGradeScrubber}`;
  }
  if (upper.includes('HSFLO') || upper.includes('HSF-LO') || upper.includes('HSF_LO')) {
    return `${styles.tableCardSelect} ${styles.chipGradeHsflo}`;
  }
  if (upper.includes('HSFO') || upper.includes('IFO') || upper.includes('HFO')) {
    return `${styles.tableCardSelect} ${styles.chipGradeHsfo}`;
  }
  const chip = GRADE_CHIP_PALETTE[hashGradeName(upper) % GRADE_CHIP_PALETTE.length];
  return `${styles.tableCardSelect} ${chip}`;
}

function sumBunkerAmounts(rows = []) {
  const total = (rows || []).reduce((sum, row) => sum + (Number(row.amount) || (Number(row.qty) || 0) * (Number(row.price) || 0)), 0);
  return total.toFixed(2);
}

function TsecCard({ theme = 'navy', tab, className = '', children }) {
  const themeClass = theme === 'lblue'
    ? styles.tsecLblue
    : theme === 'mustard'
      ? styles.tsecMustard
      : theme === 'tcdLight'
        ? styles.tsecTcdLight
        : theme === 'tcdMid'
          ? styles.tsecTcdMid
          : styles.tsecNavy;
  const tabClass = theme === 'lblue'
    ? styles.tsecTabLblue
    : theme === 'mustard'
      ? styles.tsecTabMustard
      : theme === 'tcdLight'
        ? styles.tsecTabTcdLight
        : theme === 'tcdMid'
          ? styles.tsecTabTcdMid
          : styles.tsecTabNavy;
  return (
    <div className={`${styles.tsecCard} ${themeClass} ${className}`.trim()}>
      <span className={`${styles.tsecTab} ${tabClass}`}>{tab}</span>
      {children}
    </div>
  );
}

function hiresToPeriodRows(hires = []) {
  return (hires.length ? hires : [{ ...EMPTY_TC_IN_HIRE }]).map((h) => ({
    delDate: h.delDate || h.deliveryDate || '',
    reDelDate: h.reDelDate || h.redeliveryDate || '',
    days: h.days || h.voyageDays || '',
    hireRate: h.hireRate || h.dailyHire || '',
    amount: h.amount || h.hireage || '',
    randomId: h.randomId || '',
  }));
}

function mapHirePatchToTcIn(fields = {}) {
  const next = { ...fields };
  if ('delDate' in fields) next.deliveryDate = fields.delDate;
  if ('reDelDate' in fields) next.redeliveryDate = fields.reDelDate;
  if ('days' in fields) next.voyageDays = fields.days;
  if ('hireRate' in fields) next.dailyHire = fields.hireRate;
  if ('amount' in fields) next.hireage = fields.amount;
  return next;
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
  return rows.length ? rows : [{ ...EMPTY_OFF_BUNKER }];
}

const OWNER_COST_FALLBACK = [
  'Agency Fee', 'Port Dues', 'ILOHC', 'Insurance', 'Superintendence',
  'Off-Hire', 'Victualling', 'Communication', 'Drydocking', "Owner's P&I", 'Other',
].map((name) => ({ id: name, name }));

const ACCOUNT_OPTIONS = [
  { id: 'Owner', name: 'Owner' },
  { id: 'Charterer', name: 'Charterer' },
];

function ownerChipClass(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'owner') return `${styles.tableCardSelect} ${styles.chipOwnerWrap}`;
  if (v === 'charterer') return `${styles.tableCardSelect} ${styles.chipChartererWrap}`;
  return styles.tableCardSelect;
}

function TableCardSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select',
  disabled = false,
  className = '',
  ariaLabel,
}) {
  return (
    <div className={(className || styles.tableCardSelect).trim()}>
      <CardSelect
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

function Accordion({ title, icon, open = false, onToggle, children }) {
  return (
    <details
      className={styles.tcinAccord}
      open={open}
      onToggle={(e) => {
        // Keep React state as source of truth (avoid fighting native details).
        onToggle?.(e.currentTarget.open);
      }}
    >
      <summary className={styles.tcinAccordSummary}>
        <span className={styles.tcinAccordChev} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
        {icon || null}
        <span>{title}</span>
      </summary>
      <div className={styles.tcinAccordBody}>{children}</div>
    </details>
  );
}

const DEFAULT_OPEN_SECTIONS = {
  identifiers: true,
  cp: false,
  tcDetails: true,
  expenses: false,
  vessel: false,
  preTc: false,
  bunkers: false,
  terms: false,
  docs: false,
};

function Field({ label, children, wide, className = '' }) {
  return (
    <div className={`${styles.field} ${wide ? styles.tcinFieldWide : ''} ${className}`.trim()}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TcInHireRecapModal({
  open,
  value,
  detail,
  lookups,
  onClose,
  onApply,
  readOnly = false,
}) {
  const [draft, setDraft] = useState(null);
  const [openSections, setOpenSections] = useState(DEFAULT_OPEN_SECTIONS);
  const [vpModalOpen, setVpModalOpen] = useState(false);
  const [vpData, setVpData] = useState(null);
  const [vpLoading, setVpLoading] = useState(false);
  const [vpError, setVpError] = useState('');
  const alert = useAlert();

  const toggleSection = (key) => (nextOpen) => {
    setOpenSections((prev) => ({ ...prev, [key]: nextOpen }));
  };

  // Hydrate only when the modal opens. Rebuilding on every `detail`/`value` identity
  // change (e.g. alert open → parent re-render) was wiping in-progress edits.
  useEffect(() => {
    if (!open) {
      setDraft(null);
      setVpModalOpen(false);
      setVpData(null);
      setVpError('');
      return;
    }
    setDraft(buildTcInRecapDraft(detail || {}, value || null));
    setOpenSections({ ...DEFAULT_OPEN_SECTIONS });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: open-edge only
  }, [open]);

  const grossCalc = useMemo(() => calcTcInGrossHireExpense(draft || {}), [draft]);

  const vesselIdForVp = useMemo(() => String(
    detail?.vesselImoId
    || draft?.vesselParticulars?.vesselCode
    || detail?.vesselCode
    || '',
  ).trim(), [detail?.vesselImoId, detail?.vesselCode, draft?.vesselParticulars?.vesselCode]);

  useEffect(() => {
    if (!vpModalOpen) return undefined;
    if (!vesselIdForVp) {
      setVpData(null);
      setVpError('Select a vessel to load Operated Vessels particulars.');
      setVpLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setVpLoading(true);
      setVpError('');
      try {
        const response = await fetchTankerParticulars(vesselIdForVp);
        if (!cancelled) setVpData(response);
      } catch (err) {
        if (!cancelled) {
          setVpData(null);
          setVpError(err.message || 'Failed to load vessel particulars.');
        }
      } finally {
        if (!cancelled) setVpLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vpModalOpen, vesselIdForVp]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !draft) return null;

  const period = draft.periods?.[0] || { ...EMPTY_TC_IN_PERIOD };
  const isEdit = hasSavedTcInRecap(value);
  const title = readOnly
    ? 'View TC In Hire Recap'
    : (isEdit ? 'Edit TC In Hire Recap' : 'Add TC In Hire Recap');
  const vesselNameForVp = (
    detail?.vesselName
    || draft.identifiers?.vesselName
    || draft.vesselParticulars?.vesselName
    || 'VESSEL'
  );

  const patch = (fields) => setDraft((prev) => syncPeriodOneToLegacy({ ...prev, ...fields }));

  const patchIdentifiers = (fields) => setDraft((prev) => ({
    ...prev,
    identifiers: { ...(prev.identifiers || {}), ...fields },
  }));

  const patchCp = (fields) => setDraft((prev) => {
    const next = {
      ...prev,
      cp: { ...(prev.cp || {}), ...fields },
    };
    // Same as TC Out Charterer → expense Vendor: empty Customer rows inherit Head Owners.
    if (Object.prototype.hasOwnProperty.call(fields, 'headOwners')) {
      const headOwners = fields.headOwners || '';
      next.expenses = (prev.expenses || []).map((row) => (
        row.customer ? row : { ...row, customer: headOwners }
      ));
    }
    return next;
  });

  const headOwnerOptions = lookups?.vendors || lookups?.charterers || [];

  const patchExpense = (index, fields) => setDraft((prev) => {
    const expenses = [...(prev.expenses || [])];
    expenses[index] = { ...expenses[index], ...fields };
    return { ...prev, expenses };
  });

  const addExpenseRow = async () => {
    if (readOnly) return;
    const rows = draft?.expenses || [];
    const block = getTcAddRowBlockMessage('otherExpenses', rows.map((r) => ({
      expenseTypeId: r.description || '',
      amount: r.amount,
    })));
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    setDraft((prev) => ({
      ...prev,
      expenses: [
        ...(prev.expenses || []),
        { ...EMPTY_TC_IN_EXPENSE, customer: prev.cp?.headOwners || '' },
      ],
    }));
  };

  const patchTerms = (key, value) => setDraft((prev) => {
    const periods = [...(prev.periods || [{ ...EMPTY_TC_IN_PERIOD }])];
    const p0 = { ...(periods[0] || { ...EMPTY_TC_IN_PERIOD }) };
    p0.terms = normalizeTcInTerms({ ...(p0.terms || {}), [key]: value });
    periods[0] = p0;
    return syncPeriodOneToLegacy({ ...prev, terms: p0.terms, periods });
  });

  const patchHire = (index, fields) => setDraft((prev) => {
    const periods = [...(prev.periods || [{ ...EMPTY_TC_IN_PERIOD }])];
    const p0 = { ...(periods[0] || { ...EMPTY_TC_IN_PERIOD }) };
    const hires = [...(p0.hires || [])];
    // Only recompute Days from dates when a date field changes; otherwise keep user edits.
    const datesChanging = Object.prototype.hasOwnProperty.call(fields, 'delDate')
      || Object.prototype.hasOwnProperty.call(fields, 'reDelDate')
      || Object.prototype.hasOwnProperty.call(fields, 'deliveryDate')
      || Object.prototype.hasOwnProperty.call(fields, 'redeliveryDate');
    const rateChanging = Object.prototype.hasOwnProperty.call(fields, 'hireRate')
      || Object.prototype.hasOwnProperty.call(fields, 'dailyHire');
    hires[index] = resolveHireRow(
      { ...hires[index], ...mapHirePatchToTcIn(fields) },
      { keepDays: !datesChanging },
    );
    p0.hires = hires;
    // When trip dates/rates change, refresh Rate/Day on off-hire rows that fall inside a trip leg.
    if (datesChanging || rateChanging) {
      p0.offHires = applyMatchedTripRatesToOffHires(p0.offHires || [], hires);
    }
    periods[0] = p0;
    return syncPeriodOneToLegacy({
      ...prev,
      periods,
      hires,
      offHires: p0.offHires,
    });
  });

  const patchOff = (index, fields) => setDraft((prev) => {
    const periods = [...(prev.periods || [{ ...EMPTY_TC_IN_PERIOD }])];
    const p0 = { ...(periods[0] || { ...EMPTY_TC_IN_PERIOD }) };
    const rows = [...(p0.offHires || [])];
    const next = { ...rows[index], ...fields };
    const datesChanging = Object.prototype.hasOwnProperty.call(fields, 'from')
      || Object.prototype.hasOwnProperty.call(fields, 'to');
    let days = Number(next.days) || 0;
    if (datesChanging && hasDateValue(next.from) && hasDateValue(next.to)) {
      days = daysBetween(next.to, next.from) || days;
    }
    next.days = days ? String(Number(days.toFixed(4))) : (Object.prototype.hasOwnProperty.call(fields, 'days') ? String(next.days ?? '') : '');
    if (datesChanging && !Object.prototype.hasOwnProperty.call(fields, 'hireRate')) {
      const matched = matchedTripHireRateForOffHire({
        from: next.from,
        to: next.to,
        hirePeriods: tcInHiresAsTripPeriods(p0.hires || []),
      });
      if (matched != null) next.hireRate = matched;
    }
    next.amount = (days * (Number(next.hireRate) || 0)).toFixed(2);
    rows[index] = next;
    p0.offHires = rows;
    periods[0] = p0;
    return syncPeriodOneToLegacy({ ...prev, periods, offHires: rows });
  });

  const updateOffBunkers = (offIndex, mutator) => setDraft((prev) => {
    const periods = [...(prev.periods || [{ ...EMPTY_TC_IN_PERIOD }])];
    const p0 = { ...(periods[0] || { ...EMPTY_TC_IN_PERIOD }) };
    const rows = [...(p0.offHires || [])];
    const row = { ...rows[offIndex], bunkersOpen: true };
    const bunkers = mutator([...(row.bunkers || [])]);
    row.bunkers = bunkers;
    rows[offIndex] = row;
    p0.offHires = rows;
    periods[0] = p0;
    return syncPeriodOneToLegacy({ ...prev, periods, offHires: rows });
  });

  const patchOffBunker = (offIndex, bunkerIndex, fields) => updateOffBunkers(offIndex, (bunkers) => {
    const next = { ...bunkers[bunkerIndex], ...fields };
    next.amount = bunkerAmount(next);
    bunkers[bunkerIndex] = next;
    return bunkers;
  });

  const addOffBunkers = (offIndex) => updateOffBunkers(offIndex, (bunkers) => (
    [...bunkers, { ...EMPTY_TC_IN_BUNKER }]
  ));

  const removeOffBunker = (offIndex, bunkerIndex) => updateOffBunkers(offIndex, (bunkers) => (
    bunkers.length > 1
      ? bunkers.filter((_, i) => i !== bunkerIndex)
      : []
  ));

  const redeliveryBunkerDateFromDraft = (prev = {}) => {
    const hireRows = hiresToPeriodRows(prev.periods?.[0]?.hires || prev.hires || []);
    const last = hireRows[hireRows.length - 1];
    return last?.reDelDate || '';
  };

  /** Same as TC Out: editing Delivery also refreshes Redelivery from those lines. */
  const withRedeliveryCopiedFromDelivery = (prev, deliveryRows) => ({
    ...prev,
    deliveryBunkers: deliveryRows,
    redeliveryBunkers: copyDeliveryBunkersToRedelivery(
      deliveryRows,
      redeliveryBunkerDateFromDraft(prev),
    ),
  });

  const patchBunker = (kind, index, fields) => {
    if (readOnly) return;
    setDraft((prev) => {
      const rows = [...(prev[kind] || [])];
      const next = { ...rows[index], ...fields };
      if ('bunkerId' in fields) {
        const match = (lookups?.bunkers || []).find((b) => String(b.id) === String(fields.bunkerId));
        if (match?.name) next.gradeName = match.name;
      }
      next.amount = bunkerAmount(next);
      rows[index] = next;
      if (kind === 'deliveryBunkers') {
        return withRedeliveryCopiedFromDelivery(prev, rows);
      }
      return { ...prev, [kind]: rows };
    });
  };

  const addBunker = async (kind) => {
    if (readOnly) return;
    const hireRows = hiresToPeriodRows(draft?.periods?.[0]?.hires || draft?.hires || []);
    const defaultDate = kind === 'deliveryBunkers'
      ? (hireRows[0]?.delDate || '')
      : (hireRows[hireRows.length - 1]?.reDelDate || '');
    // UI shows bunkerDate || trip-schedule default; validate against the same coalesced value.
    const rowsForCheck = (draft?.[kind] || []).map((row, idx, list) => (
      idx === list.length - 1
        ? { ...row, bunkerDate: row.bunkerDate || defaultDate }
        : row
    ));
    const block = getTcAddRowBlockMessage(kind, rowsForCheck);
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    setDraft((prev) => {
      const rows = [...(prev[kind] || [])];
      // Persist the displayed default date onto the completed row before adding a blank one.
      if (rows.length) {
        const last = { ...rows[rows.length - 1] };
        if (!last.bunkerDate && defaultDate) last.bunkerDate = defaultDate;
        last.amount = bunkerAmount(last);
        rows[rows.length - 1] = last;
      }
      rows.push({ ...EMPTY_TC_IN_BUNKER });
      if (kind === 'deliveryBunkers') {
        return withRedeliveryCopiedFromDelivery(prev, rows);
      }
      return { ...prev, [kind]: rows };
    });
  };

  const removeBunker = (kind, index) => {
    if (readOnly) return;
    setDraft((prev) => {
      const rows = [...(prev[kind] || [])];
      rows.splice(index, 1);
      const nextRows = rows.length ? rows : [{ ...EMPTY_TC_IN_BUNKER }];
      if (kind === 'deliveryBunkers') {
        return withRedeliveryCopiedFromDelivery(prev, nextRows);
      }
      return { ...prev, [kind]: nextRows };
    });
  };

  const patchVp = (fields) => setDraft((prev) => ({
    ...prev,
    vesselParticulars: { ...(prev.vesselParticulars || {}), ...fields },
  }));

  const patchVoyage = (fields) => setDraft((prev) => ({
    ...prev,
    voyageTerms: { ...(prev.voyageTerms || {}), ...fields },
  }));

  /** Same as TC Out: append a blank Period N block (Terms + Trip + Off Hire). */
  const addPeriodExtension = () => {
    if (readOnly) return;
    setDraft((prev) => ({
      ...prev,
      periods: [...(prev.periods || [{ ...EMPTY_TC_IN_PERIOD }]), emptyTcInPeriodExtension()],
    }));
  };

  const removePeriodExtension = (extIndex) => {
    if (readOnly) return;
    setDraft((prev) => ({
      ...prev,
      periods: (prev.periods || []).filter((_, idx) => idx !== extIndex + 1),
    }));
  };

  const addHireRow = async (periodIndex = 0) => {
    if (readOnly) return;
    const periodRows = draft?.periods?.[periodIndex]?.hires || [];
    const mapped = hiresToPeriodRows(periodRows);
    // TC In leaves Hire ($/day) blank by design — only require dates before adding another leg.
    const last = mapped[mapped.length - 1] || {};
    const block = mapped.length
      && (!hasDateValue(last.delDate) || !hasDateValue(last.reDelDate))
      ? 'Please fill previous data'
      : null;
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    setDraft((prev) => {
      const periods = [...(prev.periods || [])];
      const p = { ...(periods[periodIndex] || emptyTcInPeriodExtension()) };
      p.hires = [...(p.hires || []), { ...EMPTY_TC_IN_HIRE }];
      periods[periodIndex] = p;
      if (periodIndex === 0) {
        return syncPeriodOneToLegacy({ ...prev, periods, hires: p.hires });
      }
      return { ...prev, periods };
    });
  };

  const addOffHireRow = async (periodIndex = 0) => {
    if (readOnly) return;
    const periodData = draft?.periods?.[periodIndex] || emptyTcInPeriodExtension();
    const block = getTcAddRowBlockMessage('offHires', periodData.offHires || []);
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    setDraft((prev) => {
      const periods = [...(prev.periods || [])];
      const p = { ...(periods[periodIndex] || emptyTcInPeriodExtension()) };
      const lastRate = p.offHires?.[p.offHires.length - 1]?.hireRate
        || p.hires?.[0]?.dailyHire
        || p.hires?.[0]?.hireRate
        || '';
      p.offHires = [...(p.offHires || []), {
        ...EMPTY_TC_IN_OFF,
        hireRate: lastRate,
        bunkers: [],
        bunkersOpen: false,
      }];
      periods[periodIndex] = p;
      if (periodIndex === 0) {
        return syncPeriodOneToLegacy({ ...prev, periods, offHires: p.offHires });
      }
      return { ...prev, periods };
    });
  };

  const handleApply = () => {
    const synced = syncPeriodOneToLegacy(draft);
    const final = calcTcInFinalHireage(synced);
    const gross = calcTcInGrossHireExpense(synced);
    // Persist new dropzone files as metadata in the TC In JSON snapshot (same UI as TC Out).
    const pendingDocs = (synced.attachmentFiles || []).map((f) => ({
      name: f?.name || 'Attachment',
      size: f?.size || 0,
      file: f?.name || '',
    }));
    const documents = [...(synced.documents || []), ...pendingDocs];
    onApply({
      ...synced,
      ...final,
      documents,
      attachmentFiles: [],
      finalHireage: final.finalHireage,
      offHireCveAmt: final.offHireCveAmt,
      lessOffHire: final.lessOffHire,
      grossHireExpense: gross.grossHireExpense,
      netHireExpense: gross.netHireExpense,
      recapVersion: 1,
    });
  };

  const ro = readOnly ? styles.inputReadonly : undefined;

  return (
    <>
    {createPortal(
    <div
      className={`${styles.modalBackdrop} ${styles.tcinRecapBackdrop}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tc-in-hire-recap-title"
    >
      <div className={`${styles.modal} ${styles.tcInRecapModal}`}>
        <div className={styles.thdHead}>
          <div className={styles.thdTitleWrap}>
            <div className={styles.thdTitleIco} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h13" />
                <path d="M12 4l4 4-4 4" />
                <path d="M21 16H8" />
                <path d="M12 20l-4-4 4-4" />
              </svg>
            </div>
            <div id="tc-in-hire-recap-title" className={styles.thdTitle}>{title}</div>
          </div>
          <button type="button" className={styles.thdClose} title="Close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className={`${styles.tcinRecapBody} ${readOnly ? styles.viewModeLock : ''}`.trim()}>
          <div className={styles.tcinRecapLhs}>
            <Accordion title="Recap Identifiers" open={openSections.identifiers} onToggle={toggleSection('identifiers')} icon={SECTION_ICONS.identifiers}>
              <div className={`${styles.denseGrid} ${styles.dense7}`}>
                <Field label="Contract Type">
                  <input className={styles.inputReadonly} readOnly value="TC In" />
                </Field>
                <Field label="Business Type">
                  <input className={styles.inputReadonly} readOnly value={draft.identifiers?.businessType || ''} />
                </Field>
                <Field label="Vessel">
                  <input
                    value={draft.identifiers?.vessel || ''}
                    onChange={(e) => patchIdentifiers({ vessel: e.target.value })}
                    readOnly={readOnly}
                    className={ro}
                    placeholder="Search vessel name or IMO"
                  />
                </Field>
                <Field label="Vessel Type">
                  <input className={styles.inputReadonly} readOnly value={draft.identifiers?.vesselType || ''} />
                </Field>
                <Field label="CP Date">
                  <DmyDateInput
                    value={draft.identifiers?.cpDate || ''}
                    onChange={(v) => {
                      patchIdentifiers({ cpDate: v });
                      patch({ cpDate: v });
                    }}
                    disabled={readOnly}
                  />
                </Field>
                <Field label="Chartering Team">
                  <CardSelect
                    options={lookups?.charteringTeams || []}
                    value={draft.identifiers?.charteringTeam || ''}
                    onChange={(v) => patchIdentifiers({ charteringTeam: v })}
                    placeholder="Select"
                    ariaLabel="Chartering Team"
                  />
                </Field>
                <Field label="Chartering PIC">
                  <CardSelect
                    options={lookups?.charteringPics || []}
                    value={draft.identifiers?.charteringPic || ''}
                    onChange={(v) => patchIdentifiers({
                      charteringPic: v,
                      ...(draft.identifiers?.opsPic ? {} : { opsPic: v }),
                    })}
                    placeholder="Select"
                    ariaLabel="Chartering PIC"
                  />
                </Field>
                <Field label="Ops PIC" className={styles.opsPicItem}>
                  <CardSelect
                    options={lookups?.charteringPics || []}
                    value={draft.identifiers?.opsPic || ''}
                    onChange={(v) => patchIdentifiers({ opsPic: v })}
                    placeholder="Select"
                    ariaLabel="Ops PIC"
                  />
                </Field>
              </div>
            </Accordion>

            <Accordion title="CP Information" open={openSections.cp} onToggle={toggleSection('cp')} icon={SECTION_ICONS.cp}>
              <div className={styles.tcinCpInfoGrid}>
                <Field label="CP Type">
                  <CardSelect
                    options={lookups?.cpTypes || []}
                    value={draft.cp?.cpType || ''}
                    onChange={(v) => patchCp({ cpType: v })}
                    placeholder="Select CP type"
                    ariaLabel="CP Type"
                  />
                </Field>
                <Field label="Law / Arbitration">
                  <CardSelect
                    options={lookups?.lawArbitration || []}
                    value={draft.cp?.lawArbit || ''}
                    onChange={(v) => patchCp({ lawArbit: v })}
                    placeholder="Select"
                    ariaLabel="Law arbitration"
                  />
                </Field>
                <Field label="Head Owners">
                  <CardSelect
                    options={headOwnerOptions}
                    value={draft.cp?.headOwners || ''}
                    onChange={(v) => {
                      const match = headOwnerOptions
                        .find((opt) => String(opt.id) === String(v) || String(opt.name) === String(v));
                      patchCp({
                        headOwners: v,
                        ...(match?.address ? { address: match.address } : { address: '' }),
                      });
                    }}
                    placeholder="Select head owner"
                    ariaLabel="Head owners"
                  />
                </Field>
                <Field label="Address">
                  <input
                    value={draft.cp?.address || ''}
                    readOnly
                    className={styles.inputReadonly}
                    placeholder=""
                  />
                </Field>
              </div>
            </Accordion>

            <Accordion title="TC Details" open={openSections.tcDetails} onToggle={toggleSection('tcDetails')} icon={SECTION_ICONS.tcDetails}>
              <div className={styles.tcdPeriods}>
                <TcPeriodBlock
                  isPrimary
                  variant="tcIn"
                  terms={normalizeTcInTerms(period.terms || {})}
                  onTermChange={patchTerms}
                  hirePeriods={hiresToPeriodRows(period.hires)}
                  hireTotals={summarizeHirePeriodRows(hiresToPeriodRows(period.hires))}
                  dailyHireFallback=""
                  onPatchHire={patchHire}
                  onAddHire={() => addHireRow(0)}
                  onRemoveHire={(index) => setDraft((prev) => {
                    const periods = [...(prev.periods || [])];
                    const p0 = { ...periods[0] };
                    const hires = (p0.hires || []).length > 1
                      ? p0.hires.filter((_, i) => i !== index)
                      : [{ ...EMPTY_TC_IN_HIRE }];
                    p0.hires = hires;
                    periods[0] = p0;
                    return syncPeriodOneToLegacy({ ...prev, periods, hires });
                  })}
                  offHires={period.offHires?.length ? period.offHires : [{ ...EMPTY_TC_IN_OFF }]}
                  offTotals={summarizeOffHireRows(period.offHires)}
                  onPatchOff={patchOff}
                  onAddOff={() => addOffHireRow(0)}
                  onRemoveOff={(index) => setDraft((prev) => {
                    const periods = [...(prev.periods || [])];
                    const p0 = { ...periods[0] };
                    const offHires = (p0.offHires || []).length > 1
                      ? p0.offHires.filter((_, i) => i !== index)
                      : [{ ...EMPTY_TC_IN_OFF }];
                    p0.offHires = offHires;
                    periods[0] = p0;
                    return syncPeriodOneToLegacy({ ...prev, periods, offHires });
                  })}
                  onPatchOffBunker={patchOffBunker}
                  onAddOffBunkers={(offIndex) => updateOffBunkers(offIndex, (bunkers) => {
                    if (bunkers.length) return [...bunkers, { ...EMPTY_OFF_BUNKER }];
                    return defaultOffHireBunkers(lookups?.bunkers);
                  })}
                  onRemoveOffBunker={removeOffBunker}
                  resolveHirePeriod={resolveHirePeriod}
                  resolveOffHire={resolveOffHirePeriod}
                  emptyHire={{ ...EMPTY_PERIOD_HIRE }}
                  emptyOff={{ ...EMPTY_PERIOD_OFF }}
                  emptyOffBunker={{ ...EMPTY_OFF_BUNKER }}
                  currencyOptions={lookups?.currencies || []}
                  payableByOptions={lookups?.payableBy?.length ? lookups.payableBy : ACCOUNT_OPTIONS}
                  vendorOptions={lookups?.charterers || lookups?.vendors || []}
                  bunkerOptions={lookups?.bunkers || []}
                  gradeSelectClass={gradeSelectClass}
                  sortBunkersVlsfoFirst={sortBunkersVlsfoFirst}
                  readOnly={readOnly}
                />
                {(draft.periods || []).slice(1).map((extPeriod, extIndex) => (
                  <TcPeriodBlock
                    key={`tc-in-ext-${extIndex}`}
                    variant="tcIn"
                    periodNumber={extIndex + 2}
                    onRemove={() => removePeriodExtension(extIndex)}
                    terms={normalizeTcInTerms(extPeriod.terms || {})}
                    onTermChange={(key, value) => setDraft((prev) => {
                      const periods = [...(prev.periods || [])];
                      const p = { ...periods[extIndex + 1] };
                      p.terms = normalizeTcInTerms({ ...(p.terms || {}), [key]: value });
                      periods[extIndex + 1] = p;
                      return { ...prev, periods };
                    })}
                    hirePeriods={hiresToPeriodRows(extPeriod.hires)}
                    hireTotals={summarizeHirePeriodRows(hiresToPeriodRows(extPeriod.hires))}
                    onPatchHire={(hireIndex, fields) => setDraft((prev) => {
                      const periods = [...(prev.periods || [])];
                      const p = { ...periods[extIndex + 1] };
                      const hires = [...(p.hires || [])];
                      const datesChanging = Object.prototype.hasOwnProperty.call(fields, 'delDate')
                        || Object.prototype.hasOwnProperty.call(fields, 'reDelDate')
                        || Object.prototype.hasOwnProperty.call(fields, 'deliveryDate')
                        || Object.prototype.hasOwnProperty.call(fields, 'redeliveryDate');
                      const rateChanging = Object.prototype.hasOwnProperty.call(fields, 'hireRate')
                        || Object.prototype.hasOwnProperty.call(fields, 'dailyHire');
                      hires[hireIndex] = resolveHireRow(
                        { ...hires[hireIndex], ...mapHirePatchToTcIn(fields) },
                        { keepDays: !datesChanging },
                      );
                      p.hires = hires;
                      if (datesChanging || rateChanging) {
                        p.offHires = applyMatchedTripRatesToOffHires(p.offHires || [], hires);
                      }
                      periods[extIndex + 1] = p;
                      return { ...prev, periods };
                    })}
                    onAddHire={() => addHireRow(extIndex + 1)}
                    onRemoveHire={(hireIndex) => setDraft((prev) => {
                      const periods = [...(prev.periods || [])];
                      const p = { ...periods[extIndex + 1] };
                      p.hires = (p.hires || []).length > 1
                        ? p.hires.filter((_, i) => i !== hireIndex)
                        : [{ ...EMPTY_TC_IN_HIRE }];
                      periods[extIndex + 1] = p;
                      return { ...prev, periods };
                    })}
                    offHires={extPeriod.offHires?.length ? extPeriod.offHires : [{ ...EMPTY_TC_IN_OFF }]}
                    offTotals={summarizeOffHireRows(extPeriod.offHires)}
                    onPatchOff={(offIndex, fields) => setDraft((prev) => {
                      const periods = [...(prev.periods || [])];
                      const p = { ...periods[extIndex + 1] };
                      const rows = [...(p.offHires || [])];
                      const next = { ...rows[offIndex], ...fields };
                      const datesChanging = Object.prototype.hasOwnProperty.call(fields, 'from')
                        || Object.prototype.hasOwnProperty.call(fields, 'to');
                      let days = Number(next.days) || 0;
                      if (datesChanging && hasDateValue(next.from) && hasDateValue(next.to)) {
                        days = daysBetween(next.to, next.from) || days;
                      }
                      next.days = days ? String(Number(days.toFixed(4))) : (Object.prototype.hasOwnProperty.call(fields, 'days') ? String(next.days ?? '') : '');
                      if (datesChanging && !Object.prototype.hasOwnProperty.call(fields, 'hireRate')) {
                        const matched = matchedTripHireRateForOffHire({
                          from: next.from,
                          to: next.to,
                          hirePeriods: tcInHiresAsTripPeriods(p.hires || []),
                        });
                        if (matched != null) next.hireRate = matched;
                      }
                      next.amount = (days * (Number(next.hireRate) || 0)).toFixed(2);
                      rows[offIndex] = next;
                      p.offHires = rows;
                      periods[extIndex + 1] = p;
                      return { ...prev, periods };
                    })}
                    onAddOff={() => addOffHireRow(extIndex + 1)}
                    onRemoveOff={(offIndex) => setDraft((prev) => {
                      const periods = [...(prev.periods || [])];
                      const p = { ...periods[extIndex + 1] };
                      p.offHires = (p.offHires || []).length > 1
                        ? p.offHires.filter((_, i) => i !== offIndex)
                        : [{ ...EMPTY_TC_IN_OFF }];
                      periods[extIndex + 1] = p;
                      return { ...prev, periods };
                    })}
                    onPatchOffBunker={(offIndex, bIndex, fields) => setDraft((prev) => {
                      const periods = [...(prev.periods || [])];
                      const p = { ...periods[extIndex + 1] };
                      const rows = [...(p.offHires || [])];
                      const row = { ...rows[offIndex] };
                      const bunkers = [...(row.bunkers || [])];
                      const next = { ...bunkers[bIndex], ...fields };
                      next.amount = bunkerAmount(next);
                      bunkers[bIndex] = next;
                      row.bunkers = bunkers;
                      rows[offIndex] = row;
                      p.offHires = rows;
                      periods[extIndex + 1] = p;
                      return { ...prev, periods };
                    })}
                    onAddOffBunkers={(offIndex) => setDraft((prev) => {
                      const periods = [...(prev.periods || [])];
                      const p = { ...periods[extIndex + 1] };
                      const rows = [...(p.offHires || [])];
                      const row = { ...rows[offIndex], bunkersOpen: true };
                      row.bunkers = defaultOffHireBunkers(lookups?.bunkers);
                      rows[offIndex] = row;
                      p.offHires = rows;
                      periods[extIndex + 1] = p;
                      return { ...prev, periods };
                    })}
                    onRemoveOffBunker={(offIndex, bIndex) => setDraft((prev) => {
                      const periods = [...(prev.periods || [])];
                      const p = { ...periods[extIndex + 1] };
                      const rows = [...(p.offHires || [])];
                      const row = { ...rows[offIndex] };
                      const bunkers = [...(row.bunkers || [])];
                      row.bunkers = bunkers.length > 1 ? bunkers.filter((_, i) => i !== bIndex) : [];
                      rows[offIndex] = row;
                      p.offHires = rows;
                      periods[extIndex + 1] = p;
                      return { ...prev, periods };
                    })}
                    resolveHirePeriod={resolveHirePeriod}
                    resolveOffHire={resolveOffHirePeriod}
                    emptyHire={{ ...EMPTY_PERIOD_HIRE }}
                    emptyOff={{ ...EMPTY_PERIOD_OFF }}
                    emptyOffBunker={{ ...EMPTY_OFF_BUNKER }}
                    currencyOptions={lookups?.currencies || []}
                    payableByOptions={lookups?.payableBy?.length ? lookups.payableBy : ACCOUNT_OPTIONS}
                    vendorOptions={lookups?.charterers || lookups?.vendors || []}
                    bunkerOptions={lookups?.bunkers || []}
                    gradeSelectClass={gradeSelectClass}
                    sortBunkersVlsfoFirst={sortBunkersVlsfoFirst}
                    readOnly={readOnly}
                  />
                ))}
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  className={`${styles.tsecAddBtn} ${styles.addPeriodBtn}`}
                  onClick={addPeriodExtension}
                >
                  <PlusIcon />
                  Add Period (Extension)
                </button>
              ) : null}
            </Accordion>

            <Accordion title="TC Expenses" open={openSections.expenses} onToggle={toggleSection('expenses')} icon={SECTION_ICONS.expenses}>
              <TsecCard theme="navy" tab="TC Expenses">
                <div className={styles.miniTableWrap}>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr>
                        <th>Expense Desc.</th>
                        <th>Account</th>
                        <th>Notes</th>
                        <th>Add to Total</th>
                        <th>Expense Amt</th>
                        <th>Customer</th>
                        <th style={{ width: 72 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.expenses || []).map((row, index) => {
                        const expenseDescOptions = (lookups?.ownerRelatedCosts || []).length
                          ? lookups.ownerRelatedCosts
                          : OWNER_COST_FALLBACK;
                        const descValue = row.description || '';
                        const descMatch = expenseDescOptions.find((opt) => (
                          String(opt.id) === String(descValue) || String(opt.name) === String(descValue)
                        ));
                        const descOptions = [
                          ...expenseDescOptions,
                          ...(descValue && !descMatch
                            ? [{ id: String(descValue), name: String(descValue) }]
                            : []),
                        ];
                        return (
                        <tr key={`tcin-exp-${index}`}>
                          <td>
                            <TableCardSelect
                              options={descOptions}
                              value={descMatch ? String(descMatch.id) : descValue}
                              onChange={(v) => setDraft((prev) => {
                                const expenses = [...(prev.expenses || [])];
                                const match = descOptions.find((opt) => String(opt.id) === String(v));
                                expenses[index] = {
                                  ...expenses[index],
                                  description: match?.name || v || '',
                                };
                                return { ...prev, expenses };
                              })}
                              disabled={readOnly}
                              placeholder="Select from"
                              ariaLabel="Expense description"
                            />
                          </td>
                          <td>
                            <TableCardSelect
                              options={ACCOUNT_OPTIONS}
                              value={row.account || ''}
                              onChange={(v) => {
                                // Same as TC Out: Owner auto-checks Add to Total; Charterer clears it.
                                const isOwner = String(v || '').toLowerCase() === 'owner';
                                patchExpense(index, {
                                  account: v || '',
                                  addToTotal: isOwner,
                                });
                              }}
                              disabled={readOnly}
                              className={ownerChipClass(row.account)}
                              placeholder="Select from"
                              ariaLabel="Account"
                            />
                          </td>
                          <td>
                            <input
                              value={row.notes || ''}
                              onChange={(e) => patchExpense(index, { notes: e.target.value })}
                              readOnly={readOnly}
                              className={ro}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              className={styles.expenseChk}
                              checked={row.addToTotal === true}
                              disabled={readOnly || String(row.account || '').toLowerCase() !== 'owner'}
                              title="Add to total"
                              onChange={(e) => patchExpense(index, { addToTotal: e.target.checked })}
                            />
                          </td>
                          <td>
                            <input
                              value={row.amount || ''}
                              onChange={(e) => patchExpense(index, { amount: e.target.value })}
                              readOnly={readOnly}
                              className={ro}
                              placeholder="0.00"
                            />
                          </td>
                          <td>
                            <TableCardSelect
                              options={headOwnerOptions}
                              value={row.customer || ''}
                              onChange={(v) => patchExpense(index, { customer: v })}
                              disabled={readOnly}
                              placeholder="Select from"
                              ariaLabel="Customer"
                            />
                          </td>
                          <td>
                            {!readOnly ? (
                              <RowActions>
                                <RowAddButton
                                  title="Add expense"
                                  onClick={addExpenseRow}
                                />
                                <RowDelButton
                                  title="Delete row"
                                  onClick={() => setDraft((prev) => ({
                                    ...prev,
                                    expenses: prev.expenses.length > 1
                                      ? prev.expenses.filter((_, i) => i !== index)
                                      : [{ ...EMPTY_TC_IN_EXPENSE, customer: prev.cp?.headOwners || '' }],
                                  }))}
                                />
                              </RowActions>
                            ) : null}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className={styles.tsecTotalRow}>
                  <span className={styles.tsecTotalLabel}>Total Expenses</span>
                  <span>${money(grossCalc.tcExpensesTotal)}</span>
                </div>
              </TsecCard>
            </Accordion>

            <Accordion title="Vessel Particulars" open={openSections.vessel} onToggle={toggleSection('vessel')} icon={SECTION_ICONS.vessel}>
              <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst}`}>Primary Data</div>
              <div className={`${styles.denseGrid} ${styles.dense9}`}>
                {(() => {
                  const vp = draft.vesselParticulars || {};
                  const mastersName = vp.mastersName || vp.masterName || '';
                  const vesselCode = vp.vesselCode || detail?.vesselImoId || detail?.vesselCode || '';
                  const primaryRows = [
                    { key: 'mastersName', label: "Master's Name", value: mastersName, editable: true },
                    { key: 'vesselCode', label: 'Vessel Code', value: vesselCode },
                    { key: 'imoNo', label: 'IMO Number', value: vp.imoNo || '' },
                    { key: 'yearBuild', label: 'Year Built', value: vp.yearBuild || '' },
                    { key: 'flag', label: 'Flag', value: vp.flag1 || vp.flag || '' },
                    { key: 'summerDwt', label: 'Summer DWT (MT)', value: vp.summerDwt || '' },
                    { key: 'summerDraft', label: 'Summer Draft (M)', value: vp.summerDraft || '' },
                    { key: 'loa1', label: 'LOA (M)', value: vp.loa1 || vp.loa || '' },
                    { key: 'breadth', label: 'Extreme Breadth (M)', value: vp.breadth || vp.extremeBreadth || '' },
                    { key: 'grossTonn', label: 'GRT', value: vp.grossTonn || vp.grt || '' },
                    { key: 'netTonn', label: 'NRT', value: vp.netTonn || vp.nrt || '' },
                  ];
                  return primaryRows.map((row) => {
                    const fieldReadOnly = row.editable ? readOnly : true;
                    return (
                      <Field key={row.key} label={row.label}>
                        <input
                          value={row.value}
                          onChange={row.editable ? (e) => {
                            const v = e.target.value;
                            patchVp({ mastersName: v, masterName: v });
                          } : undefined}
                          readOnly={fieldReadOnly}
                          className={fieldReadOnly ? styles.inputReadonly : undefined}
                        />
                      </Field>
                    );
                  });
                })()}
              </div>
              {String(detail?.businessTypeId) !== '3' ? (
                <>
                  <div className={`${styles.subBlockLabel} ${styles.subBlockLabelPadAbove}`}>Tanker Particulars</div>
                  <div className={`${styles.denseGrid} ${styles.dense9}`}>
                    {(() => {
                      const vp = draft.vesselParticulars || {};
                      const tankerRows = [
                        { key: 'cargoTankCap', label: 'Cargo Tank Capacity (CBM)', value: vp.cargoTankCap || vp.cargoTkCap || '' },
                        { key: 'noOfGrades', label: 'No. of Grades (Double V/V Seg)', value: vp.noOfGrades || '' },
                        { key: 'noOfCargoPumps', label: 'No. of Cargo Pump (Main)', value: vp.noOfCargoPumps || vp.noOfCargoPump || '' },
                        { key: 'totalSbtCap', label: 'Total SBT Capacity (CBM)', value: vp.totalSbtCap || vp.sbtCap || '' },
                        { key: 'cargoPumpCap', label: 'Cargo Pump Main Cap (CBM/HR)', value: vp.cargoPumpCap || vp.cargoPpCap || '' },
                      ];
                      return tankerRows.map((row) => (
                        <Field key={row.key} label={row.label}>
                          <input
                            value={row.value}
                            readOnly
                            className={styles.inputReadonly}
                          />
                        </Field>
                      ));
                    })()}
                  </div>
                </>
              ) : null}
              <button
                type="button"
                className={`${styles.connectBtn} ${styles.vpFullBtn} ${styles.viewModeAllow}`}
                title="Opens the full vessel particulars"
                onClick={() => setVpModalOpen(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}>
                  <rect x="4" y="4" width="16" height="16" rx="2.5" />
                  <path d="M4 9.5h16" />
                  <path d="M8 4v3M16 4v3" />
                </svg>
                <span>Full Vessel Particulars</span>
              </button>
            </Accordion>

            <Accordion title="Pre-TC Details" open={openSections.preTc} onToggle={toggleSection('preTc')} icon={SECTION_ICONS.preTc}>
              <TsecCard theme="lblue" tab="Itinerary">
                <div className={styles.tcinDenseGrid}>
                  <Field label="From">
                    <input
                      value={draft.preTc?.itinerary?.from?.place || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            from: { ...prev.preTc?.itinerary?.from, place: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="Date/Time">
                    <input
                      value={draft.preTc?.itinerary?.from?.dateTime || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            from: { ...prev.preTc?.itinerary?.from, dateTime: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="Notes">
                    <input
                      value={draft.preTc?.itinerary?.from?.notes || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            from: { ...prev.preTc?.itinerary?.from, notes: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="To">
                    <input
                      value={draft.preTc?.itinerary?.to?.place || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            to: { ...prev.preTc?.itinerary?.to, place: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="Date/Time">
                    <input
                      value={draft.preTc?.itinerary?.to?.dateTime || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            to: { ...prev.preTc?.itinerary?.to, dateTime: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="Notes">
                    <input
                      value={draft.preTc?.itinerary?.to?.notes || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            to: { ...prev.preTc?.itinerary?.to, notes: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                </div>
              </TsecCard>
              <TsecCard theme="navy" tab="Expenses">
                <div className={styles.miniTableWrap}>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr>
                        <th>Owner/Charterer</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Notes</th>
                        <th style={{ width: 72 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.preTc?.expenses || []).map((row, index) => {
                        const preDescOptions = (lookups?.ownerRelatedCosts || []).length
                          ? lookups.ownerRelatedCosts
                          : [
                            { id: 'Agency Fee', name: 'Agency Fee' },
                            { id: 'Survey Cost', name: 'Survey Cost' },
                          ];
                        const preDescValue = row.description || '';
                        const preDescMatch = preDescOptions.find((opt) => (
                          String(opt.id) === String(preDescValue) || String(opt.name) === String(preDescValue)
                        ));
                        return (
                        <tr key={`tcin-pre-${index}`}>
                          <td>
                            <TableCardSelect
                              options={ACCOUNT_OPTIONS}
                              value={row.ownerCharterer || ''}
                              onChange={(v) => setDraft((prev) => {
                                const expenses = [...(prev.preTc?.expenses || [])];
                                expenses[index] = { ...expenses[index], ownerCharterer: v || '' };
                                return { ...prev, preTc: { ...prev.preTc, expenses } };
                              })}
                              disabled={readOnly}
                              className={ownerChipClass(row.ownerCharterer)}
                              placeholder="Select"
                              ariaLabel="Owner or Charterer"
                            />
                          </td>
                          <td>
                            <TableCardSelect
                              options={preDescOptions}
                              value={preDescMatch ? String(preDescMatch.id) : preDescValue}
                              onChange={(v) => setDraft((prev) => {
                                const expenses = [...(prev.preTc?.expenses || [])];
                                const match = preDescOptions.find((opt) => String(opt.id) === String(v));
                                expenses[index] = {
                                  ...expenses[index],
                                  description: match?.name || v || '',
                                };
                                return { ...prev, preTc: { ...prev.preTc, expenses } };
                              })}
                              disabled={readOnly}
                              placeholder="Select from list"
                              ariaLabel="Pre-TC expense description"
                            />
                          </td>
                          <td>
                            <input
                              value={row.amount || ''}
                              onChange={(e) => setDraft((prev) => {
                                const expenses = [...(prev.preTc?.expenses || [])];
                                expenses[index] = { ...expenses[index], amount: e.target.value };
                                return { ...prev, preTc: { ...prev.preTc, expenses } };
                              })}
                              readOnly={readOnly}
                              className={ro}
                            />
                          </td>
                          <td>
                            <input
                              value={row.notes || ''}
                              onChange={(e) => setDraft((prev) => {
                                const expenses = [...(prev.preTc?.expenses || [])];
                                expenses[index] = { ...expenses[index], notes: e.target.value };
                                return { ...prev, preTc: { ...prev.preTc, expenses } };
                              })}
                              readOnly={readOnly}
                              className={ro}
                            />
                          </td>
                          <td>
                            {!readOnly ? (
                              <RowActions>
                                <RowAddButton
                                  title="Add expense"
                                  onClick={() => setDraft((prev) => ({
                                    ...prev,
                                    preTc: {
                                      ...prev.preTc,
                                      expenses: [...(prev.preTc?.expenses || []), { ...EMPTY_TC_IN_PRE_EXP }],
                                    },
                                  }))}
                                />
                                <RowDelButton
                                  title="Delete row"
                                  onClick={() => setDraft((prev) => ({
                                    ...prev,
                                    preTc: {
                                      ...prev.preTc,
                                      expenses: prev.preTc.expenses.length > 1
                                        ? prev.preTc.expenses.filter((_, i) => i !== index)
                                        : [{ ...EMPTY_TC_IN_PRE_EXP }],
                                    },
                                  }))}
                                />
                              </RowActions>
                            ) : null}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className={styles.tsecTotalRow}>
                  <span className={styles.tsecTotalLabel}>Total</span>
                  <span>${money(grossCalc.preTcTotal)}</span>
                </div>
              </TsecCard>
            </Accordion>

            <Accordion title="Bunkers" open={openSections.bunkers} onToggle={toggleSection('bunkers')} icon={SECTION_ICONS.bunkers}>
              <div className={styles.tcinBunkerStack}>
                {(['deliveryBunkers', 'redeliveryBunkers']).map((kind, kindIndex) => {
                  const dirLabel = kind === 'deliveryBunkers' ? 'Delivery' : 'Redelivery';
                  const hireRows = hiresToPeriodRows(period.hires);
                  const defaultBunkerDate = kind === 'deliveryBunkers'
                    ? (hireRows[0]?.delDate || '')
                    : (hireRows[hireRows.length - 1]?.reDelDate || '');
                  const rows = (draft[kind]?.length ? draft[kind] : [{ ...EMPTY_TC_IN_BUNKER }]);
                  return (
                    <TsecCard
                      key={kind}
                      theme="mustard"
                      className={kindIndex === 0 ? styles.tsecMustardFirst : ''}
                      tab={(
                        <>
                          Bunkers on
                          {' '}
                          <span className={styles.bgDirChip}>{dirLabel}</span>
                        </>
                      )}
                    >
                      <div
                        className={styles.fieldGrid}
                        style={{ '--cols': '1fr 0.8fr 0.9fr 1.1fr 1fr 64px', marginTop: 0 }}
                      >
                        <div className={styles.fgHead}>Bunker Grade</div>
                        <div className={styles.fgHead}>Qty (MT)</div>
                        <div className={styles.fgHead}>Price (/MT)</div>
                        <div className={styles.fgHead}>Bunker Date</div>
                        <div className={styles.fgHead}>Amount</div>
                        <div className={styles.fgHead} />
                        {rows.map((row, index) => {
                          const bunkerOptions = sortBunkersVlsfoFirst(lookups?.bunkers || []);
                          const gradeName = bunkerOptions.find((opt) => String(opt.id) === String(row.bunkerId))?.name
                            || row.gradeName
                            || '';
                          return (
                            <React.Fragment key={`${kind}-${index}`}>
                              <div className={styles.fgCell}>
                                <TableCardSelect
                                  options={[
                                    ...bunkerOptions,
                                    ...(row.bunkerId != null
                                      && String(row.bunkerId).trim() !== ''
                                      && !bunkerOptions.some((opt) => String(opt.id) === String(row.bunkerId))
                                      ? [{ id: String(row.bunkerId), name: gradeName || `Grade #${row.bunkerId}` }]
                                      : []),
                                  ]}
                                  value={row.bunkerId != null ? String(row.bunkerId) : ''}
                                  onChange={(v) => patchBunker(kind, index, { bunkerId: v })}
                                  disabled={readOnly}
                                  className={gradeSelectClass(gradeName)}
                                  placeholder="Select"
                                  ariaLabel="Bunker grade"
                                />
                              </div>
                              <div className={styles.fgCell}>
                                <input
                                  value={row.qty || ''}
                                  onChange={(e) => patchBunker(kind, index, { qty: e.target.value })}
                                  placeholder="0.00"
                                  readOnly={readOnly}
                                  className={readOnly ? styles.inputReadonly : undefined}
                                />
                              </div>
                              <div className={styles.fgCell}>
                                <input
                                  value={row.price || ''}
                                  onChange={(e) => patchBunker(kind, index, { price: e.target.value })}
                                  placeholder="0.00"
                                  readOnly={readOnly}
                                  className={readOnly ? styles.inputReadonly : undefined}
                                />
                              </div>
                              <div className={styles.fgCell}>
                                <DmyDateInput
                                  value={row.bunkerDate || defaultBunkerDate}
                                  onChange={(value) => patchBunker(kind, index, { bunkerDate: value })}
                                  disabled={readOnly}
                                />
                              </div>
                              <div className={styles.fgCell}>
                                <input value={row.amount || ''} readOnly className={styles.inputReadonly} placeholder="0.00" />
                              </div>
                              <div className={styles.fgCell}>
                                {!readOnly ? (
                                  <RowActions>
                                    <RowAddButton title="Add bunker row" onClick={() => addBunker(kind)} />
                                    <RowDelButton title="Delete row" onClick={() => removeBunker(kind, index)} />
                                  </RowActions>
                                ) : null}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <div className={styles.tsecTotalRow}>
                        <span className={styles.tsecTotalLabel}>Total</span>
                        <span>{sumBunkerAmounts(rows)}</span>
                      </div>
                    </TsecCard>
                  );
                })}
              </div>
            </Accordion>

            <Accordion title="TC Terms for Voyage" open={openSections.terms} onToggle={toggleSection('terms')} icon={SECTION_ICONS.terms}>
              <div className={styles.subBlockLabel}>Sea Passage</div>
              <div className={styles.tcinDenseGrid}>
                {[
                  ['windForce', 'Wind Force'],
                  ['speedLaden', 'Speed (L) (KTS)'],
                  ['speedBallast', 'Speed (B) (KTS)'],
                  ['cpSpeed', 'CP Speed'],
                  ['foConsLaden', 'FO Cons (L) (MT/DAY)'],
                  ['doConsLaden', 'DO Cons (L) (MT/DAY)'],
                  ['foConsBallast', 'FO Cons (B) (MT/DAY)'],
                  ['doConsBallast', 'DO Cons (B) (MT/DAY)'],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      value={draft.voyageTerms?.[key] || ''}
                      onChange={(e) => patchVoyage({ [key]: e.target.value })}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                ))}
              </div>
              <div className={styles.subBlockLabel}>Port</div>
              <div className={styles.tcinDenseGrid}>
                {[
                  ['foConsLdg', 'FO Cons Ldg (MT/day)'],
                  ['doConsLdg', 'DO Cons Ldg (MT/day)'],
                  ['foConsDisch', 'FO Cons Disch (MT/day)'],
                  ['doConsDisch', 'DO Cons Disch (MT/day)'],
                  ['foConsIdle', 'FO Cons Idle (MT/day)'],
                  ['doConsIdle', 'DO Cons Idle (MT/day)'],
                  ['loadRate', 'Load Rate (MT/day)'],
                  ['dischRate', 'Disch Rate (MT/day)'],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      value={draft.voyageTerms?.[key] || ''}
                      onChange={(e) => patchVoyage({ [key]: e.target.value })}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                ))}
              </div>
            </Accordion>

            <Accordion title="Additional Info & Documents" open={openSections.docs} onToggle={toggleSection('docs')} icon={SECTION_ICONS.docs}>
              <div className={styles.docsSectionStack}>
                <Field label="More Info" className={styles.moreInfoField}>
                  <textarea
                    value={draft.additionalInfo || ''}
                    onChange={(e) => patch({ additionalInfo: e.target.value })}
                    placeholder="Description"
                    readOnly={readOnly}
                    className={`${styles.moreInfoTextarea}${readOnly ? ` ${styles.inputReadonly}` : ''}`}
                    rows={4}
                  />
                </Field>
                <AttachmentDropzone
                  readOnly={readOnly}
                  files={draft.attachmentFiles || []}
                  existing={(draft.documents || []).map((item) => ({
                    ...item,
                    name: item.name || item.file || 'Attachment',
                    url: item.url || '',
                  }))}
                  onAddFiles={(added) => {
                    setDraft((prev) => ({
                      ...prev,
                      attachmentFiles: [...(prev.attachmentFiles || []), ...added],
                    }));
                  }}
                  onRemoveFile={(index) => {
                    setDraft((prev) => ({
                      ...prev,
                      attachmentFiles: (prev.attachmentFiles || []).filter((_, i) => i !== index),
                    }));
                  }}
                  onRemoveExisting={(_item, index) => {
                    setDraft((prev) => ({
                      ...prev,
                      documents: (prev.documents || []).filter((_, i) => i !== index),
                    }));
                  }}
                />
              </div>
            </Accordion>
          </div>

          <aside className={styles.tcinRecapRhs}>
            <details className={styles.tcinResBlock} open>
              <summary className={styles.tcinResHead}>
                <span>Hire Expense</span>
                <svg className={styles.tcinResChev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </summary>
              <div className={styles.tcinResBody}>
                <div className={`${styles.tcinResRow} ${styles.tcinResAccent}`}>
                  <span className={styles.tcinResLabel}>Total Hire Payable</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.totalHirePayable)}</span>
                </div>
                <div className={styles.tcinResRow}>
                  <span className={styles.tcinResLabel}>Less Off-Hire</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.lessOffHire)}</span>
                </div>
                <div className={styles.tcinResRow}>
                  <span className={styles.tcinResLabel}>Net TC Days</span>
                  <span className={styles.tcinResVal}>{grossCalc.netTcDays}</span>
                </div>
                <div className={styles.tcinResRow}>
                  <span className={styles.tcinResLabel}>Net Hire/Day</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.netHirePerDay)}</span>
                </div>
                <div className={`${styles.tcinResRow} ${styles.tcinResAccent}`}>
                  <span className={styles.tcinResLabel}>Gross Hire Expense</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.grossHireExpense)}</span>
                </div>
                <div className={`${styles.tcinResRow} ${styles.tcinResOrange}`}>
                  <span className={styles.tcinResLabel}>Net Hire Expense</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.netHireExpense)}</span>
                </div>
              </div>
            </details>
            <details className={styles.tcinResBlock} open>
              <summary className={styles.tcinResHead}>
                <span>Other Expenses</span>
                <svg className={styles.tcinResChev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </summary>
              <div className={styles.tcinResBody}>
                <div className={`${styles.tcinResRow} ${styles.tcinResAccent}`}>
                  <span className={styles.tcinResLabel}>Total Pre-TC Expenses</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.preTcTotal)}</span>
                </div>
                <div className={`${styles.tcinResRow} ${styles.tcinResOrange}`}>
                  <span className={styles.tcinResLabel}>Total TC Expenses</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.tcExpensesTotal)}</span>
                </div>
              </div>
            </details>
          </aside>
        </div>

        <div className={`${styles.thdFooter} ${styles.viewModeAllow}`}>
          <button type="button" className={styles.thdCloseBtn} onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly ? (
            <button type="button" className={styles.thdApplyBtn} onClick={handleApply}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <path d="M17 21v-8H7v8" />
                <path d="M7 3v5h8" />
              </svg>
              Save TC In Hire Recap
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )}
    {vpModalOpen && typeof document !== 'undefined'
      ? createPortal(
        <div
          className={`${styles.modalBackdrop} ${styles.vpNestedBackdrop}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tc-in-vp-modal-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setVpModalOpen(false);
          }}
        >
          <div className={styles.vpModal}>
            <div className={styles.thdHead}>
              <div className={styles.thdTitleWrap}>
                <div className={styles.thdTitleIco} aria-hidden="true">
                  {SECTION_ICONS.vessel}
                </div>
                <div>
                  <div id="tc-in-vp-modal-title" className={styles.thdTitle}>
                    {`Full Vessel Particulars - (${String(vesselNameForVp).toUpperCase()})`}
                  </div>
                  <div className={styles.thdSubtitle}>Same record as Operated Vessels</div>
                </div>
              </div>
              <button
                type="button"
                className={styles.thdClose}
                title="Close"
                onClick={() => setVpModalOpen(false)}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className={styles.vpModalBody}>
              {vpLoading ? (
                <LoadingOverlay active label="Loading vessel particulars…" />
              ) : null}
              {vpError ? <div className={styles.error}>{vpError}</div> : null}
              {!vpLoading && vpData ? (
                <VesselParticularsReadonlyContent
                  data={vpData}
                  vesselId={vesselIdForVp}
                  canUpload={!readOnly}
                  onRefresh={async () => {
                    if (!vesselIdForVp) return;
                    const response = await fetchTankerParticulars(vesselIdForVp);
                    setVpData(response);
                  }}
                />
              ) : null}
              {!vpLoading && !vpError && !vpData ? (
                <div className={styles.thdSubtitle}>No vessel particulars available.</div>
              ) : null}
            </div>
            <div className={styles.thdFooter}>
              <button type="button" className={styles.thdCloseBtn} onClick={() => setVpModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
      : null}
    </>
  );
}

export {
  EMPTY_TC_IN_BUNKER,
  EMPTY_TC_IN_HIRE,
  EMPTY_TC_IN_OFF,
  calcTcInFinalHireage,
  calcTcInGrossHireExpense,
  buildTcInRecapDraft,
};

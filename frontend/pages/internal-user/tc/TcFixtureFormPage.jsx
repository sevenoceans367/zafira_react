import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AttachmentDropzone, CardSelect, DmyDateInput, LoadingOverlay, RowAddButton, RowDelButton, useAlert, useConfirm } from '@bainbridge/shared-ui';
import { appPath, attachmentUrl } from '@bainbridge/shared-routing';
import { getUser } from '@bainbridge/shared-auth';
import { useTcModule } from '../../../hooks/useTcModule.js';
import { periodContractAppPath } from '../../../constants/periodContractModule.js';
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
  hasDateValue,
  hireRateForOffHireEvent,
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
import TcPeriodBlock from './TcPeriodBlock.jsx';
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
const EMPTY_INCOME = {
  accountType: 'Owner',
  description: '',
  amount: '',
};
const EMPTY_ITIN_EXP = { expenseType: '', expenseDescId: '', description: '', amount: '', notes: '' };
const EMPTY_ITINERARY = {
  from: { place: '', date: '', notes: '' },
  to: { place: '', date: '', notes: '' },
};

/** UI-only extension periods (Add Period); period 1 stays on top-level form fields. */
function emptyTcPeriodTerms() {
  return {
    laycanFrom: '',
    laycanTo: '',
    exchangeCurrency: 'USD',
    exchangeRate: '1',
    delRangePort: '',
    reDelRange: '',
    ballastBonus: '',
    cveMonth: '',
    ilohcUsd: '',
    addComm: '',
    brokerComm: '',
    broCommPayable: '',
  };
}

function emptyTcPeriodExtension() {
  return {
    terms: emptyTcPeriodTerms(),
    hirePeriods: [{ ...EMPTY_HIRE }],
    offHires: [{ ...EMPTY_OFF }],
  };
}

const CONTRACT_TYPE_OPTIONS = [
  { id: 'tcout', name: 'TC Out' },
  { id: 'tcinout', name: 'TC In/TC Out' },
];

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
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

/** HTML mockup grade chips + stable extras for other bunker_grade_master names. */
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
  if (upper.includes('LSMGO') || upper.includes('MGO') || upper.includes('MDO')) {
    return `${styles.tableCardSelect} ${styles.chipGradeLsmgo}`;
  }
  if (upper.includes('HSFLO') || upper.includes('HSF-LO') || upper.includes('HSF_LO')) {
    return `${styles.tableCardSelect} ${styles.chipGradeHsflo}`;
  }
  if (upper.includes('HSFO') || upper.includes('IFO') || upper.includes('HFO')) {
    return `${styles.tableCardSelect} ${styles.chipGradeHsfo}`;
  }
  if (upper.includes('SCRUB')) {
    return `${styles.tableCardSelect} ${styles.chipGradeScrubber}`;
  }
  const chip = GRADE_CHIP_PALETTE[hashGradeName(upper) % GRADE_CHIP_PALETTE.length];
  return `${styles.tableCardSelect} ${chip}`;
}

const OWNER_CHARTERER_OPTIONS = [
  { id: 'Owner', name: 'Owner' },
  { id: 'Charterer', name: 'Charterer' },
];

/** Active Chartering Team ids (legacy CHARTERING_PIC codes). */
const CHARTERING_TEAM_IDS = new Set(['6', '8', '4', '1']);

function normalizeCharteringTeam(value) {
  const id = value == null ? '' : String(value).trim();
  if (!id || id === '0' || !CHARTERING_TEAM_IDS.has(id)) return '';
  return id;
}

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

function formatPeriodSubtitle(opt = {}) {
  if (opt.subtitle) return opt.subtitle;
  return [opt.vesselName, opt.chartererName, opt.periodLabel, opt.dateSpan]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' · ');
}

function PeriodConnectSelect({
  options = [],
  value,
  onChange,
  disabled = false,
  placeholder = 'Select',
  charterers = [],
  addHref = '',
}) {
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [localRows, setLocalRows] = useState([]);
  const [draft, setDraft] = useState({
    ref: '',
    vessel: '',
    charterer: '',
    period: '',
  });
  const [pickedLocalId, setPickedLocalId] = useState('');

  const normalized = useMemo(() => {
    const fromLookups = (options || []).map((opt) => ({
      id: String(opt.id ?? opt.value ?? ''),
      name: opt.name ?? opt.label ?? String(opt.id ?? ''),
      subtitle: formatPeriodSubtitle(opt),
      local: false,
    }));
    return [...fromLookups, ...localRows];
  }, [options, localRows]);

  const valueId = value == null || value === '' ? '' : String(value);
  const selected = normalized.find((opt) => !opt.local && opt.id === valueId);
  const pickedLocal = normalized.find((opt) => opt.local && opt.id === pickedLocalId);
  const label = pickedLocal?.name || selected?.name || placeholder;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const closeModal = () => {
    setOpen(false);
    setAddOpen(false);
  };

  const selectRow = (opt) => {
    if (opt.local) {
      setPickedLocalId(opt.id);
      onChange?.('');
    } else {
      setPickedLocalId('');
      onChange?.(opt.id);
    }
    closeModal();
  };

  const clearSelection = () => {
    setPickedLocalId('');
    onChange?.('');
    closeModal();
  };

  const saveNewContract = () => {
    const ref = String(draft.ref || '').trim();
    if (!ref) return;
    const chartererName = (charterers || []).find((c) => String(c.id) === String(draft.charterer))?.name
      || draft.charterer
      || '';
    const subtitle = [draft.vessel, chartererName, draft.period]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' · ');
    const id = `local-${Date.now()}`;
    const row = { id, name: ref, subtitle, local: true };
    setLocalRows((prev) => [...prev, row]);
    setDraft({ ref: '', vessel: '', charterer: '', period: '' });
    setAddOpen(false);
    setPickedLocalId(id);
    onChange?.('');
    closeModal();
  };

  const modal = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        className={styles.modalBackdrop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lpc-modal-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}
      >
        <div className={`${styles.modal} ${styles.lpcModal}`}>
          <div className={styles.thdHead}>
            <div className={styles.thdTitleWrap}>
              <div className={styles.thdTitleIco} aria-hidden="true">
                <ConnectIcon />
              </div>
              <div>
                <div id="lpc-modal-title" className={styles.thdTitle}>Link Period Contract</div>
                <div className={styles.thdSubtitle}>
                  Select a period contract from the master system, or add a new one
                </div>
              </div>
            </div>
            <button type="button" className={styles.thdClose} title="Close" onClick={closeModal} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className={styles.lpcBody}>
            <div className={styles.lpcList}>
              {normalized.length === 0 ? (
                <div className={styles.lpcEmpty}>No period contracts found.</div>
              ) : normalized.map((opt) => {
                const isSelected = opt.local
                  ? opt.id === pickedLocalId
                  : Boolean(valueId) && opt.id === valueId && !pickedLocalId;
                return (
                  <div key={opt.id || opt.name} className={styles.lpcRow}>
                    <div className={styles.lpcRowMain}>
                      <div className={styles.lpcRowRef}>{opt.name}</div>
                      {opt.subtitle ? <div className={styles.lpcRowSub}>{opt.subtitle}</div> : null}
                    </div>
                    <button
                      type="button"
                      className={`${styles.lpcSelectBtn} ${isSelected ? styles.lpcSelectBtnSelected : ''}`.trim()}
                      onClick={() => selectRow(opt)}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className={`${styles.addRowBtn} ${styles.lpcAddToggle}`.trim()}
              onClick={() => setAddOpen((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add a New Period Contract
            </button>

            {addOpen ? (
              <div className={styles.lpcAddForm}>
                <div className={styles.thdStepSub}>
                  Not linking to an existing contract? Create one here — it&apos;ll appear in the list above and can be selected immediately.
                </div>
                <div className={styles.lpcAddGrid}>
                  <div className={styles.field}>
                    <label htmlFor="lpc-new-ref">Contract Ref.</label>
                    <input
                      id="lpc-new-ref"
                      value={draft.ref}
                      onChange={(e) => setDraft((prev) => ({ ...prev, ref: e.target.value }))}
                      placeholder="e.g. PCTT-2026-021"
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="lpc-new-vessel">Vessel</label>
                    <input
                      id="lpc-new-vessel"
                      value={draft.vessel}
                      onChange={(e) => setDraft((prev) => ({ ...prev, vessel: e.target.value }))}
                      placeholder="Vessel name"
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="lpc-new-charterer">Charterer</label>
                    <select
                      id="lpc-new-charterer"
                      value={draft.charterer}
                      onChange={(e) => setDraft((prev) => ({ ...prev, charterer: e.target.value }))}
                    >
                      <option value="">Select</option>
                      {(charterers || []).map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="lpc-new-period">Period</label>
                    <input
                      id="lpc-new-period"
                      value={draft.period}
                      onChange={(e) => setDraft((prev) => ({ ...prev, period: e.target.value }))}
                      placeholder="e.g. 12 mo"
                    />
                  </div>
                </div>
                <div className={styles.lpcAddActions}>
                  <button type="button" className={`${styles.thdApplyBtn} ${styles.lpcAddSave}`.trim()} onClick={saveNewContract}>
                    Save New Contract
                  </button>
                  {addHref ? (
                    <a className={styles.lpcAddFullLink} href={addHref} target="_blank" rel="noopener noreferrer">
                      Open full Period Contract form
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.thdFooter}>
            {(valueId || pickedLocalId) ? (
              <button type="button" className={styles.thdCloseBtn} onClick={clearSelection}>
                Clear
              </button>
            ) : null}
            <button type="button" className={styles.thdCloseBtn} onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className={styles.connectField}>
      <button
        type="button"
        className={styles.connectBtn}
        title="Opens a popup listing master system period contracts"
        aria-label="Link Period Contract"
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
        }}
      >
        <ConnectIcon />
        <span>{label}</span>
      </button>
      {modal}
    </div>
  );
}

function resolveHirePeriod(row = {}) {
  let days = Number(row.days) || 0;
  if (hasDateValue(row.delDate) && hasDateValue(row.reDelDate)) {
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
  if (hasDateValue(row.from) && hasDateValue(row.to)) {
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

function summarizeHirePeriodRows(hirePeriods = []) {
  const rows = (hirePeriods?.length ? hirePeriods : [{ ...EMPTY_HIRE }]).map(resolveHirePeriod);
  const totalDays = rows.reduce((sum, row) => sum + (Number(row.days) || 0), 0);
  const totalAmt = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  return {
    rows,
    totalDays: totalDays ? Number(totalDays.toFixed(4)) : 0,
    totalAmt: totalAmt.toFixed(2),
  };
}

function summarizeOffHireRows(offHires = []) {
  const rows = (offHires?.length ? offHires : [{ ...EMPTY_OFF }]).map(resolveOffHire);
  const totalDays = rows.reduce((sum, row) => sum + (Number(row.days) || 0), 0);
  const totalAmt = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  return {
    rows,
    totalDays: totalDays ? Number(totalDays.toFixed(4)) : 0,
    totalAmt: totalAmt.toFixed(2),
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
  }).filter((row) => row.bunkerId || row.gradeName);
  if (rows.length) return rows;
  const first = findVlsfoBunker(lookupsBunkers) || (lookupsBunkers || [])[0];
  if (first) {
    return [{ ...EMPTY_OFF_BUNKER, bunkerId: String(first.id), gradeName: first.name || '' }];
  }
  return [{ ...EMPTY_OFF_BUNKER }];
}

function isVlsfoName(name) {
  const upper = String(name || '').toUpperCase().replace(/\s+/g, '');
  return upper.includes('VLSFO') || (upper.includes('VLS') && !upper.includes('HSFO'));
}

function findVlsfoBunker(bunkers = []) {
  return (bunkers || []).find((b) => isVlsfoName(b.name)) || null;
}

/** VLSFO first in bunker grade dropdowns. */
function sortBunkersVlsfoFirst(bunkers = []) {
  return [...(bunkers || [])].sort((a, b) => {
    const aRank = isVlsfoName(a.name) ? 0 : 1;
    const bRank = isVlsfoName(b.name) ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function defaultBunkerRow(bunkers = []) {
  const vlsfo = findVlsfoBunker(bunkers);
  if (!vlsfo) return { ...EMPTY_BUNKER };
  return {
    ...EMPTY_BUNKER,
    bunkerId: String(vlsfo.id),
    gradeName: vlsfo.name || 'VLSFO',
  };
}

function seedEmptyBunkerRows(rows, bunkers) {
  const list = rows?.length ? rows : [{ ...EMPTY_BUNKER }];
  const fallback = defaultBunkerRow(bunkers);
  if (!fallback.bunkerId) return list;
  return list.map((row) => (
    String(row.bunkerId || '').trim()
      ? row
      : { ...row, bunkerId: fallback.bunkerId, gradeName: row.gradeName || fallback.gradeName }
  ));
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
  const defaultOffHireRate = detail.hireFixPer || calc.dailyGrossHire || '';
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
    otherIncome: detail.otherIncome?.length
      ? detail.otherIncome.map((row) => ({ ...EMPTY_INCOME, ...row }))
      : [{ ...EMPTY_INCOME }],
    otherExpenses: detail.otherExpenses?.length
      ? detail.otherExpenses.map((row) => ({ ...EMPTY_EXPENSE, ...row }))
      : [{ ...EMPTY_EXPENSE }],
    offHires: offHires.map((row) => (
      row.hireRate
        ? row
        : resolveOffHire({
          ...row,
          hireRate: hireRateForOffHireEvent({
            from: row.from,
            to: row.to,
            hirePeriods,
            fallback: defaultOffHireRate,
          }),
        })
    )),
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
    charteringTeam: '',
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
    noOfCargoPumps: '',
    cargoPumpCap: '',
    totalSbtCap: '',
    vesselCode: '',
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
    otherIncome: [{ ...EMPTY_INCOME }],
    otherExpenses: [{ ...EMPTY_EXPENSE }],
    offHires: [{ ...EMPTY_OFF }],
    offHireBunkers: [],
    tcPeriodExtensions: [],
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

function formatSignedResult(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  const abs = Math.abs(n).toFixed(2);
  if (n > 0) return `+${abs}`;
  if (n < 0) return `-${abs}`;
  return abs;
}

function applyVesselPrefill(prev, prefill, vesselMeta = {}) {
  if (!prefill && !vesselMeta.id) return prev;
  const flag = prefill?.flag || prev.flag;
  return {
    ...prev,
    vesselImoId: String(prefill?.vesselImoId || vesselMeta.id || prev.vesselImoId),
    vesselName: prefill?.vesselName || vesselMeta.name || prev.vesselName,
    vesselType: prefill?.vesselType || prev.vesselType,
    flag,
    flag1: prefill?.flag || prev.flag1 || flag,
    imoNo: prefill?.imoNo || prev.imoNo,
    summerDwt: prefill?.dwtSummer || prev.summerDwt,
    dwtSummerCp: prefill?.dwtSummer || prev.dwtSummerCp,
    summerDraft: prefill?.draft || prefill?.summerDraft || prev.summerDraft,
    loa1: prefill?.loa || prev.loa1,
    breadth: prefill?.beam || prev.breadth,
    yearBuild: prefill?.builtYear || prev.yearBuild,
    grainCap: prefill?.grainCap || prev.grainCap,
    baleCap: prefill?.baleCap || prev.baleCap,
    grossTonn: prefill?.gnrt || prev.grossTonn,
    netTonn: prefill?.nrt || prev.netTonn,
    tpc1: prefill?.tpc || prev.tpc1,
    vesselCode: prefill?.vesselCode
      || prev.vesselCode
      || String(prefill?.vesselImoId || vesselMeta.id || prev.vesselCode || ''),
    businessTypeId: prefill?.businessTypeId != null && prefill.businessTypeId !== ''
      ? String(prefill.businessTypeId)
      : (vesselMeta.businessTypeId || prev.businessTypeId),
    bFullSpeedCp: prefill?.bFullSpeed || prev.bFullSpeedCp,
    lFullSpeedCp: prefill?.lFullSpeed || prev.lFullSpeedCp,
    // Tanker / gas particulars
    cargoTankCap: prefill?.cargoTankCap ?? prev.cargoTankCap,
    noOfGrades: prefill?.noOfGrades ?? prev.noOfGrades,
    noOfCargoPumps: prefill?.noOfCargoPumps ?? prev.noOfCargoPumps,
    totalSbtCap: prefill?.totalSbtCap ?? prev.totalSbtCap,
    cargoPumpCap: prefill?.cargoPumpCap ?? prev.cargoPumpCap,
    // Full vessel particulars modal
    buildYard: prefill?.buildYard ?? prev.buildYard,
    classId: prefill?.classId ?? prev.classId,
    lastSpSurvey: prefill?.lastSpSurvey ?? prev.lastSpSurvey,
    lastDd: prefill?.lastDd ?? prev.lastDd,
    ownersPi: prefill?.ownersPi ?? prev.ownersPi,
    callSign: prefill?.callSign ?? prev.callSign,
    inmarsatTel: prefill?.inmarsatTel ?? prev.inmarsatTel,
    inmarsatMail: prefill?.inmarsatMail ?? prev.inmarsatMail,
    keelTopMast: prefill?.keelTopMast ?? prev.keelTopMast,
    waterlineTopMast: prefill?.waterlineTopMast ?? prev.waterlineTopMast,
    portOfReg: prefill?.portOfReg ?? prev.portOfReg,
  };
}

function clearVesselParticulars(prev) {
  return {
    ...prev,
    vesselImoId: '',
    vesselName: '',
    vesselType: '',
    flag: '',
    flag1: '',
    vesselCode: '',
    imoNo: '',
    yearBuild: '',
    summerDwt: '',
    summerDraft: '',
    loa1: '',
    breadth: '',
    grossTonn: '',
    netTonn: '',
    tpc1: '',
    grainCap: '',
    baleCap: '',
    cargoTankCap: '',
    noOfGrades: '',
    noOfCargoPumps: '',
    totalSbtCap: '',
    cargoPumpCap: '',
    buildYard: '',
    classId: '',
    lastSpSurvey: '',
    lastDd: '',
    ownersPi: '',
    callSign: '',
    inmarsatTel: '',
    inmarsatMail: '',
    keelTopMast: '',
    waterlineTopMast: '',
    portOfReg: '',
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
  const { module, tcPath } = useTcModule();
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
  const [vpModalOpen, setVpModalOpen] = useState(false);

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

  const otherIncomeChartererTotal = useMemo(
    () => (form.otherIncome || []).reduce((sum, row) => {
      if (String(row.accountType || 'Owner').toLowerCase() !== 'charterer') return sum;
      return sum + (Number(row.amount) || 0);
    }, 0),
    [form.otherIncome],
  );

  const otherIncomeOwnerTotal = useMemo(
    () => (form.otherIncome || []).reduce((sum, row) => {
      if (String(row.accountType || 'Owner').toLowerCase() !== 'owner') return sum;
      return sum + (Number(row.amount) || 0);
    }, 0),
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
    const tcOwners = sumParty(form.otherExpenses, 'notes', 'owner') + otherIncomeOwnerTotal;
    const tcCharterers = sumParty(form.otherExpenses, 'notes', 'charterer');
    const tcAddToTotal = (form.otherExpenses || []).reduce((sum, row) => {
      // PHP only includes rows where chkVal == 1 (Add to TTL).
      if (row.addToTotal !== true) return sum;
      return sum + (Number(row.amount) || 0);
    }, 0) + otherIncomeOwnerTotal;

    return {
      refOwners: itineraryOwners + tcOwners,
      refCharterers: itineraryCharterers + tcCharterers,
      tcAddToTotal,
      preTcTotal: itineraryOwners + itineraryCharterers,
    };
  }, [form.itineraryExpenses, form.otherExpenses, otherIncomeOwnerTotal]);

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

  const offHireTotals = useMemo(() => {
    const rows = (form.offHires || []).map(resolveOffHire);
    const totalDays = rows.reduce((sum, row) => sum + (Number(row.days) || 0), 0);
    const totalAmt = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return {
      rows,
      totalDays: totalDays ? Number(totalDays.toFixed(4)) : 0,
      totalAmt: totalAmt.toFixed(2),
    };
  }, [form.offHires]);

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
    // PHP Final TC In Hireage only applies when TC In section is in play.
    if (!showSubCharter) return 0;
    if (!form.tcInExpenses) {
      return Number(form.calc?.tcFinalHireage) || 0;
    }
    // Always trust the live TC In calc — including 0 (do not fall back to stale slave1).
    return Number(calcTcInFinalHireage(form.tcInExpenses).finalHireage) || 0;
  }, [form.tcInExpenses, form.calc?.tcFinalHireage, showSubCharter]);

  const tcResults = useMemo(() => {
    const calc = form.calc || {};
    const hire = Number(form.hireFixPer) || 0;
    const rate = Number(form.exchangeRate);
    const exchange = Number.isFinite(rate) && rate !== 0 ? rate : 1;
    const dailyGrossHire = calc.dailyGrossHire || String((hire * exchange).toFixed(2));
    const cveMonth = form.cveMonth ?? calc.cveMonth ?? '';

    const hirePeriods = (form.hirePeriods?.length ? form.hirePeriods : [{ ...EMPTY_HIRE }]).map((row) => {
      const resolved = resolveHirePeriod(row);
      const seeded = {
        ...resolved,
        delDate: hasDateValue(resolved.delDate) ? resolved.delDate : (form.delDate || ''),
        reDelDate: hasDateValue(resolved.reDelDate) ? resolved.reDelDate : (form.reDelDate || ''),
        days: Number(resolved.days) ? resolved.days : (form.durFixPer || resolved.days || ''),
        // Seed missing rate from Hire Fix (same field PHP schedule uses), not exchanged daily gross.
        hireRate: Number(resolved.hireRate) ? resolved.hireRate : (form.hireFixPer || ''),
      };
      if (
        seeded.delDate === resolved.delDate
        && seeded.reDelDate === resolved.reDelDate
        && seeded.days === resolved.days
        && seeded.hireRate === resolved.hireRate
      ) {
        return resolved;
      }
      return resolveHirePeriod(seeded);
    });

    // PHP Total Expenses = Add-to-TTL TC expenses + Final TC In Hireage (no Pre-TC).
    const voyageExp = expensePartyTotals.tcAddToTotal + tcInFinalHireage;
    const totals = calcTcTotals({
      ...calc,
      // Form bunker grids are source of truth — do not mix in stale HFO/MGO flat fields.
      delHfoMt: '',
      delHfoUsd: '',
      delMgoMt: '',
      delMgoUsd: '',
      reDelHfoMt: '',
      reDelHfoUsd: '',
      reDelMgoMt: '',
      reDelMgoUsd: '',
      dailyGrossHire,
      tcDays: form.durFixPer || calc.tcDays || '',
      addCommPct: form.addComm ?? calc.addCommPct,
      brokerCommPct: form.brokerComm ?? calc.brokerCommPct,
      ballastBonus: form.ballastBonus ?? calc.ballastBonus ?? '',
      cveMonth,
      // PHP empty CVE/month → 0; do not reuse stale CVE_EST from calc spread.
      cve: 0,
      ilohcAmt: form.ilohcUsd ?? calc.ilohcAmt,
      hirePeriods,
      deliveryBunkers: form.deliveryBunkers,
      redeliveryBunkers: form.redeliveryBunkers,
      offHires: mergeOffHiresForCalc(form.offHires, form.offHireBunkers),
      otherIncome: otherIncomeChartererTotal,
      totalExp: voyageExp,
    });

    const netRev = Number(totals.totalRev) || 0;
    const nettRev = Number(totals.nettRev) || 0;
    const lessOffHire = Number(totals.lessOffHire) || 0;
    // Waterfall display: Total Revenue → Less Off Hire → Net Revenue (= PHP totalRev)
    const grossRev = netRev + lessOffHire;
    const bunkerDiffAmt = Number(totals.bunkerDiffAmt) || 0;
    // PHP Total Expenses — excludes Pre-TC (shown only on Adj Profit).
    const totalExp = voyageExp;
    const voyageEarn = Number(totals.voyageEarn);
    // TC Earnings = Σ trip days × hire rate only (exclude ballast, CVE, etc.).
    const hireIncome = Number(totals.hireIncome) || 0;
    const tcEarnings = Number.isFinite(hireIncome) ? hireIncome : 0;
    // Voyage P&L still drives Adj. Pre TC and Daily P&L.
    const profit = Number.isFinite(voyageEarn) ? voyageEarn : (netRev - voyageExp);
    const profitAdjPreTc = profit - itineraryExpenseTotal;
    const utilisationDays = Number(totals.utilisationDays) || 0;
    const profitPerDay = utilisationDays
      ? (profit / utilisationDays).toFixed(2)
      : formatResult(0);

    const netTcDays = Number(totals.netTcDays ?? totals.utilisationDays) || 0;
    const netHirePerDay = Number(totals.netHirePerDay) || 0;

    return {
      nettRev: formatResult(nettRev),
      totalRev: formatResult(grossRev),
      lessOffHire: formatResult(lessOffHire),
      nettTcRev: formatResult(netRev),
      netTcDays: netTcDays ? String(Number(netTcDays.toFixed(4))) : '0',
      netHirePerDay: formatResult(netHirePerDay),
      bunkerDiffAmt: formatSignedResult(bunkerDiffAmt),
      refCharterers: formatResult(expensePartyTotals.refCharterers),
      refOwners: formatResult(expensePartyTotals.refOwners),
      totalExp: formatResult(totalExp),
      profit: formatResult(tcEarnings),
      profitAdjPreTc: formatResult(profitAdjPreTc),
      profitPerDay,
      utilisationDays: totals.utilisationDays || '0',
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
    otherIncomeChartererTotal,
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
          charteringTeam: normalizeCharteringTeam(detail.charteringTeam),
          ballastBonus: detail.calc?.ballastBonus || detail.ballastBonus || '',
          cveMonth: detail.calc?.cveMonth || detail.cveMonth || '',
          ilohcUsd: detail.ilohcUsd || detail.calc?.ilohcAmt || '',
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

  useEffect(() => {
    if (!lookups?.bunkers?.length || readOnly) return;
    setForm((prev) => {
      const nextDelivery = seedEmptyBunkerRows(prev.deliveryBunkers, lookups.bunkers);
      const nextRedelivery = seedEmptyBunkerRows(prev.redeliveryBunkers, lookups.bunkers);
      const deliveryChanged = nextDelivery !== prev.deliveryBunkers
        && JSON.stringify(nextDelivery) !== JSON.stringify(prev.deliveryBunkers);
      const redeliveryChanged = nextRedelivery !== prev.redeliveryBunkers
        && JSON.stringify(nextRedelivery) !== JSON.stringify(prev.redeliveryBunkers);
      if (!deliveryChanged && !redeliveryChanged) return prev;
      return {
        ...prev,
        deliveryBunkers: nextDelivery,
        redeliveryBunkers: nextRedelivery,
      };
    });
  }, [lookups, readOnly]);

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
    setForm((prev) => ({ ...prev, [kind]: [...(prev[kind] || []), defaultBunkerRow(lookups?.bunkers)] }));
  };

  const removeBunker = (kind, index) => {
    if (readOnly) return;
    setForm((prev) => {
      const rows = [...(prev[kind] || [])];
      rows.splice(index, 1);
      return { ...prev, [kind]: rows.length ? rows : [defaultBunkerRow(lookups?.bunkers)] };
    });
  };

  const handleSelectVessel = async (vessel) => {
    if (readOnly) return;
    if (!vessel) {
      setForm((prev) => clearVesselParticulars(prev));
      return;
    }
    const vesselId = vessel.id || vessel.vesselImoId;
    const vesselName = vessel.name || vessel.vesselName;
    setForm((prev) => applyVesselPrefill(
      clearVesselParticulars(prev),
      null,
      {
        id: vesselId,
        name: vesselName,
        businessTypeId: vessel.businessTypeId,
      },
    ));
    try {
      const prefill = await fetchVesselEstimatePrefill(vesselId);
      if (prefill) {
        setForm((prev) => applyVesselPrefill(prev, prefill, {
          id: vesselId,
          name: vesselName,
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
      if (String(validationError.fieldId || '').startsWith('tcIn')) {
        setTcInOpen(true);
        window.setTimeout(() => focusEstimateValidationField(validationError.fieldId), 50);
      } else {
        focusEstimateValidationField(validationError.fieldId);
      }
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
      delete payload.tcPeriodExtensions;
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
          totalExp: String(expensePartyTotals.tcAddToTotal + tcInFinalHireage),
          deliveryBunkers: form.deliveryBunkers,
          redeliveryBunkers: form.redeliveryBunkers,
          tcCpDate: form.tcInExpenses?.cpDate || '',
          tcCpNumber: form.tcInExpenses?.contractRef || form.tcNo || '',
          tcDeliveryPort: form.tcInExpenses?.deliveryPort || form.delRangePort || '',
          tcRedeliveryPort: form.tcInExpenses?.redeliveryPort || form.reDelRange || '',
          tcFinalVendor: form.tcInExpenses?.finalVendor || '',
          tcFinalHireage: showSubCharter ? String(tcInFinalHireage) : '0',
          tcOffHireCveMonth: form.tcInExpenses?.offHireCveMonth || '',
          tcBunkerOnOwner: form.tcInExpenses?.bunkerOnOwner || '',
          tcIlohc: form.tcInExpenses?.ilohc || '',
          awrpCost: form.tcInExpenses?.awrpCost || '',
        },
        hirePeriods,
        deliveryBunkers: form.deliveryBunkers,
        redeliveryBunkers: form.redeliveryBunkers,
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
          hireRate: hireRateForOffHireEvent({
            hirePeriods: prev.hirePeriods,
            fallback: prev.hireFixPer || '',
          }),
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
    setForm((prev) => {
      const current = (prev.offHires || [{ ...EMPTY_OFF }])[index] || { ...EMPTY_OFF };
      const nextPatch = { ...patch };
      const datesChanging = Object.prototype.hasOwnProperty.call(patch, 'from')
        || Object.prototype.hasOwnProperty.call(patch, 'to');
      if (datesChanging && !Object.prototype.hasOwnProperty.call(patch, 'hireRate')) {
        nextPatch.hireRate = hireRateForOffHireEvent({
          from: Object.prototype.hasOwnProperty.call(patch, 'from') ? patch.from : current.from,
          to: Object.prototype.hasOwnProperty.call(patch, 'to') ? patch.to : current.to,
          hirePeriods: prev.hirePeriods,
          fallback: prev.hireFixPer || '',
        });
      }
      return {
        ...prev,
        offHires: updateRow(prev.offHires || [{ ...EMPTY_OFF }], index, nextPatch).map(resolveOffHire),
      };
    });
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

  const patchExtension = (extIndex, updater) => {
    if (readOnly) return;
    setForm((prev) => {
      const list = [...(prev.tcPeriodExtensions || [])];
      const current = list[extIndex] || emptyTcPeriodExtension();
      list[extIndex] = updater(current);
      return { ...prev, tcPeriodExtensions: list };
    });
  };

  const addTcPeriodExtension = () => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      tcPeriodExtensions: [...(prev.tcPeriodExtensions || []), emptyTcPeriodExtension()],
    }));
  };

  const removeTcPeriodExtension = (extIndex) => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      tcPeriodExtensions: (prev.tcPeriodExtensions || []).filter((_, i) => i !== extIndex),
    }));
  };

  const patchExtensionTerm = (extIndex, key, value) => {
    patchExtension(extIndex, (period) => ({
      ...period,
      terms: { ...emptyTcPeriodTerms(), ...period.terms, [key]: value },
    }));
  };

  const patchExtensionHire = (extIndex, hireIndex, patch) => {
    patchExtension(extIndex, (period) => {
      const next = updateRow(period.hirePeriods || [{ ...EMPTY_HIRE }], hireIndex, patch).map(resolveHirePeriod);
      return { ...period, hirePeriods: next };
    });
  };

  const addExtensionHire = async (extIndex) => {
    if (readOnly) return;
    const rows = form.tcPeriodExtensions?.[extIndex]?.hirePeriods || [];
    const block = getTcAddRowBlockMessage('hirePeriods', rows);
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    patchExtension(extIndex, (period) => ({
      ...period,
      hirePeriods: [...(period.hirePeriods || []), { ...EMPTY_HIRE }],
    }));
  };

  const patchExtensionOffHire = (extIndex, offIndex, patch) => {
    patchExtension(extIndex, (period) => {
      const current = (period.offHires || [{ ...EMPTY_OFF }])[offIndex] || { ...EMPTY_OFF };
      const nextPatch = { ...patch };
      const datesChanging = Object.prototype.hasOwnProperty.call(patch, 'from')
        || Object.prototype.hasOwnProperty.call(patch, 'to');
      if (datesChanging && !Object.prototype.hasOwnProperty.call(patch, 'hireRate')) {
        nextPatch.hireRate = hireRateForOffHireEvent({
          from: Object.prototype.hasOwnProperty.call(patch, 'from') ? patch.from : current.from,
          to: Object.prototype.hasOwnProperty.call(patch, 'to') ? patch.to : current.to,
          hirePeriods: period.hirePeriods,
          fallback: '',
        });
      }
      return {
        ...period,
        offHires: updateRow(period.offHires || [{ ...EMPTY_OFF }], offIndex, nextPatch).map(resolveOffHire),
      };
    });
  };

  const addExtensionOffHire = async (extIndex) => {
    if (readOnly) return;
    const period = form.tcPeriodExtensions?.[extIndex] || emptyTcPeriodExtension();
    const block = getTcAddRowBlockMessage('offHires', period.offHires || []);
    if (block) {
      await alert({ title: 'Alert', message: block, confirmLabel: 'OK' });
      return;
    }
    patchExtension(extIndex, (p) => ({
      ...p,
      offHires: [
        ...(p.offHires || []),
        resolveOffHire({
          ...EMPTY_OFF,
          hireRate: hireRateForOffHireEvent({
            hirePeriods: p.hirePeriods,
            fallback: '',
          }),
        }),
      ],
    }));
  };

  const patchExtensionOffBunker = (extIndex, offIndex, bunkerIndex, patch) => {
    patchExtension(extIndex, (period) => {
      const offHires = [...(period.offHires || [{ ...EMPTY_OFF }])];
      const offRow = { ...offHires[offIndex] };
      const bunkers = updateRow(offRow.bunkers || [], bunkerIndex, patch).map((row) => {
        const qty = Number(row.qty) || 0;
        const price = Number(row.price) || 0;
        return { ...row, amount: (qty || price) ? (qty * price).toFixed(2) : '' };
      });
      offHires[offIndex] = resolveOffHire({ ...offRow, bunkers });
      return { ...period, offHires };
    });
  };

  const addExtensionOffBunkers = (extIndex, offIndex) => {
    patchExtension(extIndex, (period) => {
      const offHires = [...(period.offHires || [{ ...EMPTY_OFF }])];
      const offRow = { ...offHires[offIndex] };
      const existing = offRow.bunkers || [];
      const nextBunkers = existing.length
        ? [...existing, { ...EMPTY_OFF_BUNKER }]
        : defaultOffHireBunkers(lookups?.bunkers);
      offHires[offIndex] = { ...offRow, bunkers: nextBunkers, bunkersOpen: true };
      return { ...period, offHires };
    });
  };

  const removeExtensionOffBunker = (extIndex, offIndex, bunkerIndex) => {
    patchExtension(extIndex, (period) => {
      const offHires = [...(period.offHires || [{ ...EMPTY_OFF }])];
      const offRow = { ...offHires[offIndex] };
      const bunkers = (offRow.bunkers || []).filter((_, i) => i !== bunkerIndex);
      offHires[offIndex] = {
        ...offRow,
        bunkers,
        bunkersOpen: bunkers.length > 0 ? offRow.bunkersOpen : false,
      };
      return { ...period, offHires };
    });
  };

  const patchOtherExpense = (index, patch) => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      otherExpenses: updateRow(prev.otherExpenses || [{ ...EMPTY_EXPENSE }], index, patch),
    }));
  };

  const patchOtherIncome = (index, patch) => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      otherIncome: updateRow(prev.otherIncome || [{ ...EMPTY_INCOME }], index, patch),
    }));
  };

  const addOtherIncome = () => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      otherIncome: [...(prev.otherIncome || []), { ...EMPTY_INCOME }],
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

  const renderBunkerTable = (kind, dirLabel) => {
    const periods = hirePeriodTotals.rows?.length
      ? hirePeriodTotals.rows
      : (form.hirePeriods || []);
    const defaultBunkerDate = kind === 'deliveryBunkers'
      ? (periods[0]?.delDate || form.delDate || '')
      : (periods[periods.length - 1]?.reDelDate || form.reDelDate || '');
    const isFirst = kind === 'deliveryBunkers';

    return (
    <div className={styles.plainSubBlock}>
      <div className={`${styles.subBlockLabel}${isFirst ? ` ${styles.subBlockLabelFirst}` : ''}`}>
        Bunkers on
        {' '}
        {dirLabel}
      </div>
      <div
        className={styles.fieldGrid}
        style={{ '--cols': '1fr 0.8fr 0.9fr 1.1fr 1fr 64px' }}
      >
        <div className={styles.fgHead}>Bunker Grade</div>
        <div className={styles.fgHead}>Qty (MT)</div>
        <div className={styles.fgHead}>Price (/MT)</div>
        <div className={styles.fgHead}>Bunker Date</div>
        <div className={styles.fgHead}>Amount</div>
        <div className={styles.fgHead} />
        {(form[kind] || []).map((row, index) => {
          const bunkerOptions = sortBunkersVlsfoFirst(lookups?.bunkers || []);
          const gradeName = bunkerOptions.find((opt) => String(opt.id) === String(row.bunkerId))?.name
            || row.gradeName
            || '';
          const bunkerIdPrefix = kind === 'deliveryBunkers' ? 'delBunker' : 'reDelBunker';
          return (
            <React.Fragment key={`${kind}-${index}`}>
              <div className={styles.fgCell}>
                <TableCardSelect
                  id={index === 0 ? bunkerIdPrefix + '_0' : undefined}
                  options={[
                    ...bunkerOptions,
                    ...(row.bunkerId != null
                      && String(row.bunkerId).trim() !== ''
                      && !bunkerOptions.some((opt) => String(opt.id) === String(row.bunkerId))
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
              </div>
              <div className={styles.fgCell}>
                <input
                  id={index === 0 ? `${bunkerIdPrefix}Qty_0` : undefined}
                  value={row.qty || ''}
                  onChange={(e) => updateBunker(kind, index, 'qty', e.target.value)}
                  placeholder="0.00"
                  readOnly={readOnly}
                  className={readOnly ? styles.inputReadonly : undefined}
                />
              </div>
              <div className={styles.fgCell}>
                <input
                  id={index === 0 ? `${bunkerIdPrefix}Price_0` : undefined}
                  value={row.price || ''}
                  onChange={(e) => updateBunker(kind, index, 'price', e.target.value)}
                  placeholder="0.00"
                  readOnly={readOnly}
                  className={readOnly ? styles.inputReadonly : undefined}
                />
              </div>
              <div className={styles.fgCell}>
                <DmyDateInput
                  id={index === 0 ? `${bunkerIdPrefix}Date_0` : undefined}
                  value={row.bunkerDate || defaultBunkerDate}
                  onChange={(value) => updateBunker(kind, index, 'bunkerDate', value)}
                  disabled={readOnly}
                />
              </div>
              <div className={styles.fgCell}>
                <input value={row.amount || ''} readOnly className={styles.inputReadonly} placeholder="0.00" />
              </div>
              <div className={styles.fgCell}>
                {!readOnly ? (
                  <div className="rowActions">
                    <RowAddButton
                      title="Add bunker row"
                      onClick={() => addBunker(kind)}
                    />
                    <RowDelButton
                      title="Delete row"
                      onClick={() => removeBunker(kind, index)}
                    />
                  </div>
                ) : null}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className={styles.tsecTotalRow}>
        <span className={styles.tsecTotalLabel}>Total</span>
        <span>{sumBunkerAmounts(form[kind])}</span>
      </div>
    </div>
    );
  };

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
                  <Field label="Vessel *">
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
                    label="TC No. *"
                    value={form.tcNo}
                    onChange={(v) => setField('tcNo', v)}
                    readOnly={mode === 'edit' || readOnly}
                  />
                  <TextInput
                    label="Est No."
                    value={`EST${Number(form.estimateNo) > 0 ? Number(form.estimateNo) : 1}`}
                    readOnly
                  />
                  <Field label="Chartering Team *" id="charteringTeam">
                    <CardSelect
                      id="charteringTeam"
                      options={lookups?.charteringTeams || []}
                      value={normalizeCharteringTeam(form.charteringTeam)}
                      onChange={(v) => setField('charteringTeam', normalizeCharteringTeam(v))}
                      placeholder="Select chartering team"
                      ariaLabel="Chartering team"
                    />
                  </Field>
                  <Field label="Chartering PIC *" id="charteringPic1">
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
                      placeholder="Select"
                      charterers={lookups?.charterers || []}
                      addHref={periodContractAppPath(module, 'add')}
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
                  <Field label="Charterer" id="charterer" className={styles.cpChartererItem}>
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
                          otherExpenses: (prev.otherExpenses || []).map((row) => (
                            row.vendorId ? row : { ...row, vendorId: v || '' }
                          )),
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
              <CollapsiblePanel title="TC Details" defaultOpen className={styles.estCard} icon={SECTION_ICONS.tcDetails}>
                <div className={styles.tcdPeriods}>
                  <TcPeriodBlock
                    isPrimary
                    terms={{
                      laycanFrom: form.laycanFrom,
                      laycanTo: form.laycanTo,
                      exchangeCurrency: form.exchangeCurrency,
                      exchangeRate: form.exchangeRate,
                      delRangePort: form.delRangePort,
                      reDelRange: form.reDelRange,
                      ballastBonus: form.ballastBonus,
                      cveMonth: form.cveMonth,
                      ilohcUsd: form.ilohcUsd,
                      addComm: form.addComm,
                      brokerComm: form.brokerComm,
                      broCommPayable: form.broCommPayable,
                    }}
                    onTermChange={setField}
                    hirePeriods={form.hirePeriods}
                    hireTotals={hirePeriodTotals}
                    dailyHireFallback={dailyHireUsd}
                    onPatchHire={patchHirePeriod}
                    onAddHire={addHirePeriod}
                    onRemoveHire={(index) => setForm((prev) => {
                      const next = (prev.hirePeriods || []).length > 1
                        ? prev.hirePeriods.filter((_, i) => i !== index)
                        : [{ ...EMPTY_HIRE }];
                      return { ...prev, hirePeriods: next, ...syncFixtureFromHirePeriods(next) };
                    })}
                    offHires={form.offHires}
                    offTotals={offHireTotals}
                    onPatchOff={patchOffHire}
                    onAddOff={addOffHire}
                    onRemoveOff={(index) => setForm((prev) => ({
                      ...prev,
                      offHires: (prev.offHires || []).length > 1
                        ? prev.offHires.filter((_, i) => i !== index)
                        : [{ ...EMPTY_OFF }],
                    }))}
                    onPatchOffBunker={patchOffHireNestedBunker}
                    onAddOffBunkers={addOffHireBunkers}
                    onRemoveOffBunker={removeOffHireBunker}
                    resolveHirePeriod={resolveHirePeriod}
                    resolveOffHire={resolveOffHire}
                    emptyHire={{ ...EMPTY_HIRE }}
                    emptyOff={{ ...EMPTY_OFF }}
                    emptyOffBunker={{ ...EMPTY_OFF_BUNKER }}
                    currencyOptions={lookups?.currencies || []}
                    payableByOptions={lookups?.payableBy || []}
                    vendorOptions={lookups?.charterers || []}
                    bunkerOptions={lookups?.bunkers || []}
                    gradeSelectClass={gradeSelectClass}
                    sortBunkersVlsfoFirst={sortBunkersVlsfoFirst}
                    readOnly={readOnly}
                  />
                  {(form.tcPeriodExtensions || []).map((period, extIndex) => {
                    const hireTotalsExt = summarizeHirePeriodRows(period.hirePeriods);
                    const offTotalsExt = summarizeOffHireRows(period.offHires);
                    return (
                      <TcPeriodBlock
                        key={`tc-period-ext-${extIndex}`}
                        periodNumber={extIndex + 2}
                        onRemove={() => removeTcPeriodExtension(extIndex)}
                        terms={{ ...emptyTcPeriodTerms(), ...period.terms }}
                        onTermChange={(key, value) => patchExtensionTerm(extIndex, key, value)}
                        hirePeriods={period.hirePeriods}
                        hireTotals={hireTotalsExt}
                        onPatchHire={(hireIndex, patch) => patchExtensionHire(extIndex, hireIndex, patch)}
                        onAddHire={() => addExtensionHire(extIndex)}
                        onRemoveHire={(hireIndex) => patchExtension(extIndex, (p) => ({
                          ...p,
                          hirePeriods: (p.hirePeriods || []).length > 1
                            ? p.hirePeriods.filter((_, i) => i !== hireIndex)
                            : [{ ...EMPTY_HIRE }],
                        }))}
                        offHires={period.offHires}
                        offTotals={offTotalsExt}
                        onPatchOff={(offIndex, patch) => patchExtensionOffHire(extIndex, offIndex, patch)}
                        onAddOff={() => addExtensionOffHire(extIndex)}
                        onRemoveOff={(offIndex) => patchExtension(extIndex, (p) => ({
                          ...p,
                          offHires: (p.offHires || []).length > 1
                            ? p.offHires.filter((_, i) => i !== offIndex)
                            : [{ ...EMPTY_OFF }],
                        }))}
                        onPatchOffBunker={(offIndex, bIndex, patch) => patchExtensionOffBunker(extIndex, offIndex, bIndex, patch)}
                        onAddOffBunkers={(offIndex) => addExtensionOffBunkers(extIndex, offIndex)}
                        onRemoveOffBunker={(offIndex, bIndex) => removeExtensionOffBunker(extIndex, offIndex, bIndex)}
                        resolveHirePeriod={resolveHirePeriod}
                        resolveOffHire={resolveOffHire}
                        emptyHire={{ ...EMPTY_HIRE }}
                        emptyOff={{ ...EMPTY_OFF }}
                        emptyOffBunker={{ ...EMPTY_OFF_BUNKER }}
                        currencyOptions={lookups?.currencies || []}
                        payableByOptions={lookups?.payableBy || []}
                        vendorOptions={lookups?.charterers || []}
                        bunkerOptions={lookups?.bunkers || []}
                        gradeSelectClass={gradeSelectClass}
                        sortBunkersVlsfoFirst={sortBunkersVlsfoFirst}
                        readOnly={readOnly}
                      />
                    );
                  })}
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    className={`${styles.tsecAddBtn} ${styles.addPeriodBtn}`}
                    onClick={addTcPeriodExtension}
                  >
                    <PlusIcon />
                    Add Period (Extension)
                  </button>
                ) : null}
              </CollapsiblePanel>
              <CollapsiblePanel title="TC Expenses" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.expenses}>
                <TsecCard theme="navy" tab="TC Expenses">
                <div
                  className={styles.fieldGrid}
                  style={{ '--cols': '1.3fr 1fr 1.4fr 0.7fr 0.9fr 1fr 64px' }}
                >
                  <div className={styles.fgHead}>Expense Desc.</div>
                  <div className={styles.fgHead}>Account</div>
                  <div className={styles.fgHead}>Notes</div>
                  <div className={styles.fgHead}>Add to Total</div>
                  <div className={styles.fgHead}>Expense Amt</div>
                  <div className={styles.fgHead}>Vendor</div>
                  <div className={styles.fgHead} />
                  {(form.otherExpenses?.length ? form.otherExpenses : [{ ...EMPTY_EXPENSE }]).map((row, index) => {
                    const expenseDescOptions = lookups?.ownerRelatedCosts || [];
                    const storedExpenseId = String(row.expenseTypeId || '').trim();
                    const expenseDescValue = expenseDescOptions.find((opt) => String(opt.id) === storedExpenseId)?.id
                      || (storedExpenseId
                        ? storedExpenseId
                        : '');
                    return (
                    <React.Fragment key={`exp-${index}`}>
                      <div className={styles.fgCell}>
                        <TableCardSelect
                          options={[
                            ...expenseDescOptions,
                            ...(expenseDescValue
                              && !expenseDescOptions.some((opt) => String(opt.id) === String(expenseDescValue))
                              ? [{
                                id: String(expenseDescValue),
                                name: String(row.description || expenseDescValue),
                              }]
                              : []),
                          ]}
                          value={expenseDescValue ? String(expenseDescValue) : ''}
                          onChange={(v) => {
                            const match = expenseDescOptions.find((opt) => String(opt.id) === String(v));
                            patchOtherExpense(index, {
                              expenseTypeId: v,
                              // Keep Notes free-text; only seed it when empty.
                              description: row.description || match?.name || '',
                            });
                          }}
                          disabled={readOnly}
                          placeholder="Select from"
                          ariaLabel="Expense description"
                        />
                      </div>
                      <div className={styles.fgCell}>
                        <TableCardSelect
                          options={OWNER_CHARTERER_OPTIONS}
                          value={row.notes || ''}
                          onChange={(v) => {
                            const isOwner = String(v || '').toLowerCase() === 'owner';
                            patchOtherExpense(index, {
                              notes: v,
                              addToTotal: isOwner,
                            });
                          }}
                          disabled={readOnly}
                          className={ownerChipClass(row.notes)}
                          placeholder="Select from"
                          ariaLabel="Account"
                        />
                      </div>
                      <div className={styles.fgCell}>
                        <input
                          value={row.description || ''}
                          onChange={(e) => patchOtherExpense(index, { description: e.target.value })}
                          placeholder="Expense Desc."
                          readOnly={readOnly}
                          className={readOnly ? styles.inputReadonly : undefined}
                        />
                      </div>
                      <div className={styles.fgCell}>
                        <input
                          type="checkbox"
                          className={styles.expenseChk}
                          checked={row.addToTotal === true}
                          onChange={(e) => patchOtherExpense(index, { addToTotal: e.target.checked })}
                          disabled={readOnly || String(row.notes || '').toLowerCase() !== 'owner'}
                          title="Add to total"
                        />
                      </div>
                      <div className={styles.fgCell}>
                        <input
                          value={row.amount || ''}
                          onChange={(e) => patchOtherExpense(index, { amount: e.target.value })}
                          placeholder="0.00"
                          readOnly={readOnly}
                          className={readOnly ? styles.inputReadonly : undefined}
                        />
                      </div>
                      <div className={styles.fgCell}>
                        <TableCardSelect
                          options={lookups?.charterers || []}
                          value={row.vendorId || ''}
                          onChange={(v) => patchOtherExpense(index, { vendorId: v })}
                          disabled={readOnly}
                          placeholder="Select from"
                          ariaLabel="Vendor"
                        />
                      </div>
                      <div className={styles.fgCell}>
                        {!readOnly ? (
                          <div className="rowActions">
                            <RowAddButton
                              title="Add expense"
                              onClick={addOtherExpense}
                            />
                            <RowDelButton
                              title="Delete row"
                              onClick={() => setForm((prev) => ({
                                ...prev,
                                otherExpenses: (prev.otherExpenses || []).length > 1
                                  ? prev.otherExpenses.filter((_, i) => i !== index)
                                  : [{ ...EMPTY_EXPENSE }],
                              }))}
                            />
                          </div>
                        ) : null}
                      </div>
                    </React.Fragment>
                    );
                  })}
                </div>

                <div className={styles.oiSection}>
                  <div className={styles.oiChipRow}>
                    <span className={styles.oiChip}>Other Income</span>
                  </div>
                  <div className={styles.oiOutline}>
                    <div
                      className={styles.fieldGrid}
                      style={{ '--cols': '1fr 1.6fr 1fr 64px' }}
                    >
                      <div className={styles.fgHead}>Account</div>
                      <div className={styles.fgHead}>Description</div>
                      <div className={styles.fgHead}>Amount</div>
                      <div className={styles.fgHead} />
                      {(form.otherIncome?.length ? form.otherIncome : [{ ...EMPTY_INCOME }]).map((row, index) => (
                        <React.Fragment key={`oi-${index}`}>
                          <div className={styles.fgCell}>
                            <TableCardSelect
                              options={OWNER_CHARTERER_OPTIONS}
                              value={row.accountType || 'Owner'}
                              onChange={(v) => patchOtherIncome(index, { accountType: v || 'Owner' })}
                              disabled={readOnly}
                              className={ownerChipClass(row.accountType || 'Owner')}
                              placeholder="Select"
                              ariaLabel="Other income account"
                            />
                          </div>
                          <div className={styles.fgCell}>
                            <input
                              value={row.description || ''}
                              onChange={(e) => patchOtherIncome(index, { description: e.target.value })}
                              placeholder="Description"
                              readOnly={readOnly}
                              className={readOnly ? styles.inputReadonly : undefined}
                            />
                          </div>
                          <div className={styles.fgCell}>
                            <input
                              value={row.amount || ''}
                              onChange={(e) => patchOtherIncome(index, { amount: e.target.value })}
                              placeholder="0.00"
                              readOnly={readOnly}
                              className={readOnly ? styles.inputReadonly : undefined}
                            />
                          </div>
                          <div className={styles.fgCell}>
                            {!readOnly ? (
                              <div className="rowActions">
                                <RowAddButton
                                  title="Add other income"
                                  onClick={addOtherIncome}
                                />
                                <RowDelButton
                                  title="Delete row"
                                  onClick={() => setForm((prev) => ({
                                    ...prev,
                                    otherIncome: (prev.otherIncome || []).length > 1
                                      ? prev.otherIncome.filter((_, i) => i !== index)
                                      : [{ ...EMPTY_INCOME }],
                                  }))}
                                />
                              </div>
                            ) : null}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.tsecTotalRow}>
                  <span className={styles.tsecTotalLabel}>Total Expenses</span>
                  <span>{formatResult(expensePartyTotals.tcAddToTotal)}</span>
                </div>
                </TsecCard>
                {showSubCharter ? (
                  <div className={`${styles.tcInButtonRow} ${styles.viewModeAllow}`}>
                    <button
                      type="button"
                      className={`${styles.addRowBtn} ${styles.addRowBtnSubCharter}`}
                      onClick={() => setTcInOpen(true)}
                    >
                      <PlusIcon />
                      Add Sub-Charter Expense
                    </button>
                  </div>
                ) : null}
              </CollapsiblePanel>
              <CollapsiblePanel title="Vessel Particulars" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.vessel}>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst}`}>Primary Data</div>
                <div className={`${styles.denseGrid} ${styles.dense9}`}>
                  <TextInput label="Master's Name" value={form.mastersName} onChange={(v) => setField('mastersName', v)} />
                  <TextInput label="Vessel Code" value={form.vesselCode || form.vesselImoId || ''} readOnly />
                  <TextInput label="IMO Number" value={form.imoNo} readOnly />
                  <TextInput label="Year Built" value={form.yearBuild} readOnly />
                  <TextInput label="Flag" value={form.flag1 || form.flag} readOnly />
                  <TextInput label="Summer DWT (MT)" value={form.summerDwt} readOnly />
                  <TextInput label="Summer Draft (M)" value={form.summerDraft} readOnly />
                  <TextInput label="LOA (M)" value={form.loa1} readOnly />
                  <TextInput label="Extreme Breadth (M)" value={form.breadth} readOnly />
                  <TextInput label="GRT" value={form.grossTonn} readOnly />
                  <TextInput label="NRT" value={form.netTonn} readOnly />
                </div>
                {!isDry ? (
                  <>
                    <div className={`${styles.subBlockLabel} ${styles.subBlockLabelPadAbove}`}>Tanker Particulars</div>
                    <div className={`${styles.denseGrid} ${styles.dense9}`}>
                      <TextInput label="Cargo Tank Capacity (CBM)" value={form.cargoTankCap} readOnly />
                      <TextInput label="No. of Grades (Double V/V Seg)" value={form.noOfGrades} readOnly />
                      <TextInput label="No. of Cargo Pump (Main)" value={form.noOfCargoPumps} readOnly />
                      <TextInput label="Total SBT Capacity (CBM)" value={form.totalSbtCap} readOnly />
                      <TextInput label="Cargo Pump Main Cap (CBM/HR)" value={form.cargoPumpCap} readOnly />
                    </div>
                  </>
                ) : null}
                <button
                  type="button"
                  className={`${styles.connectBtn} ${styles.vpFullBtn}`}
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
              </CollapsiblePanel>
              <CollapsiblePanel title="Pre-TC Details" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.preTc}>
                <TsecCard theme="lblue" tab="Itinerary">
                <div className={styles.tsecItineraryGrid}>
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
                </TsecCard>

                <TsecCard theme="navy" tab="Expenses">
                <div
                  className={styles.fieldGrid}
                  style={{ '--cols': '1fr 1.3fr 0.9fr 1.4fr 64px' }}
                >
                  <div className={styles.fgHead}>Expense Type</div>
                  <div className={styles.fgHead}>Expense Description</div>
                  <div className={styles.fgHead}>Amount</div>
                  <div className={styles.fgHead}>Notes</div>
                  <div className={styles.fgHead} />
                  {(form.itineraryExpenses || []).map((row, index) => {
                      const expenseDescOptions = lookups?.ownerRelatedCosts || [];
                      const storedDesc = String(row.description || row.expenseDescId || '').trim();
                      const expenseDescValue = expenseDescOptions.find((opt) => String(opt.id) === storedDesc)?.id
                        || expenseDescOptions.find((opt) => opt.name === storedDesc)?.id
                        || storedDesc;
                      return (
                      <React.Fragment key={`itin-exp-${index}`}>
                        <div className={styles.fgCell}>
                          <TableCardSelect
                            options={OWNER_CHARTERER_OPTIONS}
                            value={row.expenseType || ''}
                            onChange={(v) => patchItinExpense(index, { expenseType: v })}
                            disabled={readOnly}
                            className={ownerChipClass(row.expenseType)}
                            placeholder="Select"
                            ariaLabel="Expense type"
                          />
                        </div>
                        <div className={styles.fgCell}>
                          <TableCardSelect
                            options={[
                              ...expenseDescOptions,
                              ...(expenseDescValue
                                && !expenseDescOptions.some((opt) => String(opt.id) === String(expenseDescValue))
                                ? [{ id: String(expenseDescValue), name: String(expenseDescValue) }]
                                : []),
                            ]}
                            value={expenseDescValue ? String(expenseDescValue) : ''}
                            onChange={(v) => {
                              patchItinExpense(index, {
                                expenseDescId: v,
                                description: v || '',
                              });
                            }}
                            disabled={readOnly}
                            placeholder="Select from list"
                            ariaLabel="Expense description"
                          />
                        </div>
                        <div className={styles.fgCell}>
                          <input
                            value={row.amount || ''}
                            onChange={(e) => patchItinExpense(index, { amount: e.target.value })}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                            placeholder="0.00"
                          />
                        </div>
                        <div className={styles.fgCell}>
                          <input
                            value={row.notes || ''}
                            onChange={(e) => patchItinExpense(index, { notes: e.target.value })}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                            placeholder="Notes"
                          />
                        </div>
                        <div className={styles.fgCell}>
                          {!readOnly ? (
                            <div className="rowActions">
                              <RowAddButton
                                title="Add expense"
                                onClick={addItinExpense}
                              />
                              <RowDelButton
                                title="Delete row"
                                onClick={() => removeItinExpense(index)}
                              />
                            </div>
                          ) : null}
                        </div>
                      </React.Fragment>
                      );
                  })}
                </div>
                <div className={styles.tsecTotalRow}>
                  <span className={styles.tsecTotalLabel}>Total</span>
                  <span>{itineraryExpenseTotal.toFixed(2)}</span>
                </div>
                </TsecCard>
              </CollapsiblePanel>
              <CollapsiblePanel title="Bunkers" defaultOpen={false} className={styles.estCard} icon={SECTION_ICONS.bunkers}>
                {renderBunkerTable('deliveryBunkers', 'Delivery')}
                {renderBunkerTable('redeliveryBunkers', 'Redelivery')}
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
                  <Field label="More Info" className={styles.moreInfoField}>
                    <textarea
                      value={form.additInform || ''}
                      onChange={(e) => setField('additInform', e.target.value)}
                      placeholder="Description"
                      readOnly={readOnly}
                      className={`${styles.moreInfoTextarea}${readOnly ? ` ${styles.inputReadonly}` : ''}`}
                      rows={4}
                    />
                  </Field>
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
              <CollapsiblePanel title="Revenue" defaultOpen className={styles.resultsBlock}>
                <div className={styles.resultsBody}>
                  <div className={`${styles.resRow} ${styles.resRowAccent}`}>
                    <span className={styles.resRowLabel}>Total Revenue</span>
                    <span className={styles.resRowVal}>{tcResults.totalRev}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Less Off Hire (incl bunkers)</span>
                    <span className={styles.resRowVal}>{tcResults.lessOffHire}</span>
                  </div>
                  <div className={`${styles.resRow} ${styles.resRowAccentOrange}`}>
                    <span className={styles.resRowLabel}>Net Revenue</span>
                    <span className={styles.resRowVal}>{tcResults.nettTcRev}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Net TC Days</span>
                    <span className={styles.resRowVal}>{tcResults.netTcDays}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Net Hire/Day</span>
                    <span className={styles.resRowVal}>{tcResults.netHirePerDay}</span>
                  </div>
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel title="Expenses" defaultOpen className={styles.resultsBlock}>
                <div className={styles.resultsBody}>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Ref Charterers</span>
                    <span className={styles.resRowVal}>{tcResults.refCharterers}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Ref Owners</span>
                    <span className={styles.resRowVal}>{tcResults.refOwners}</span>
                  </div>
                  <div className={`${styles.resRow} ${styles.resRowAccentOrange}`}>
                    <span className={styles.resRowLabel}>Total Expenses</span>
                    <span className={styles.resRowVal}>{tcResults.totalExp}</span>
                  </div>
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel title="P&L" defaultOpen className={styles.resultsBlock}>
                <div className={styles.resultsBody}>
                  <div className={`${styles.resRow} ${styles.resRowAccentOrange}`}>
                    <span className={styles.resRowLabel}>TC Earnings</span>
                    <span className={styles.resRowVal}>{tcResults.profit}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Bunker Differential</span>
                    <span className={styles.resRowVal}>{tcResults.bunkerDiffAmt}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>P&L (Adj. Pre TC)</span>
                    <span className={styles.resRowVal}>{tcResults.profitAdjPreTc}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Daily P&L</span>
                    <span className={styles.resRowVal}>{tcResults.profitPerDay}</span>
                  </div>
                </div>
              </CollapsiblePanel>
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

      {vpModalOpen && typeof document !== 'undefined'
        ? createPortal(
          <div
            className={styles.modalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vp-modal-title"
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
                    <div id="vp-modal-title" className={styles.thdTitle}>Full Vessel Particulars</div>
                    <div className={styles.thdSubtitle}>Complete vessel record from Operated Vessels</div>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.thdClose}
                  title="Close"
                  onClick={() => setVpModalOpen(false)}
                  aria-label="Close"
                >
                  <XIcon />
                </button>
              </div>
              <div className={styles.vpModalBody}>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst}`}>Identity & Survey</div>
                <div className={`${styles.denseGrid} ${styles.dense9}`}>
                  <TextInput
                    label="Master's Name"
                    value={form.mastersName}
                    onChange={(v) => setField('mastersName', v)}
                    readOnly={readOnly}
                  />
                  <TextInput label="Yard" value={form.buildYard} readOnly />
                  <TextInput label="Class ID" value={form.classId} readOnly />
                  <TextInput label="Last SS" value={form.lastSpSurvey} readOnly />
                  <TextInput label="Last DD" value={form.lastDd} readOnly />
                  <TextInput label="Owners' P&I" value={form.ownersPi} readOnly />
                </div>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelPadAbove}`}>Communications</div>
                <div className={`${styles.denseGrid} ${styles.dense9}`}>
                  <TextInput label="Call Sign" value={form.callSign} readOnly />
                  <TextInput label="Inmar Tel" value={form.inmarsatTel} readOnly />
                  <TextInput label="Inmar Email" value={form.inmarsatMail} readOnly />
                </div>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelPadAbove}`}>Dimensions</div>
                <div className={`${styles.denseGrid} ${styles.dense9}`}>
                  <TextInput label="LOA" value={form.loa1} readOnly />
                  <TextInput label="TPC" value={form.tpc1} readOnly />
                  <TextInput label="Keel to Mast Top" value={form.keelTopMast} readOnly />
                  <TextInput label="WL to Mast Top" value={form.waterlineTopMast} readOnly />
                </div>
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

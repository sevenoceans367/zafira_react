import React, { useEffect, useMemo, useRef, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DmyDateInput,
  LoadingOverlay,
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath, attachmentUrl } from '@bainbridge/shared-routing';
import { fetchLaytimeForm, openLaytime, saveLaytime } from '../../../services/opsVc.js';
import OpsVcLaytimeHeaderActions from './OpsVcLaytimeHeaderActions.jsx';
import { calcLaytimeAllowed, recomputePortDraft } from './laytimeCalculations.js';
import pageStyles from './OpsPages.module.css';
import sofStyles from './OpsVcSofPage.module.css';
import styles from './OpsVcLaytimePage.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

const FLASH = {
  0: { type: 'success', text: 'Laytime added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! this Laytime already exists for this port.' },
  2: { type: 'success', text: 'Laytime opened successfully.' },
};

function PortTypeIcon({ portType }) {
  if (portType === 'DP') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22V9" />
        <path d="M18 15l-6-6-6 6" />
        <path d="M4 4h16" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v13" />
      <path d="M6 9l6 6 6-6" />
      <path d="M4 20h16" />
    </svg>
  );
}

function AddRowButton({ onClick, disabled, label = 'Add' }) {
  if (disabled) return null;
  return (
    <button type="button" className={sofStyles.addRowBtn} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
      {label}
    </button>
  );
}

function PillOption({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      className={`${styles.ltPill} ${active ? styles.ltPillActive : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      <span className={styles.ltPillCheck} aria-hidden>
        {active ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </span>
      {children}
    </button>
  );
}

function SumIconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SumIconCash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function CalendarIco() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18" />
      <path d="M8 2.5v4" />
      <path d="M16 2.5v4" />
    </svg>
  );
}

/** Compact datetime field matching the Laytime mockup (calendar icon + dd-mm-yyyy HH:MM). */
function LtDateField({
  id,
  value,
  onChange,
  disabled,
  enableTime = true,
  className = '',
}) {
  const hasValue = Boolean(String(value || '').trim());
  return (
    <div
      className={`${styles.ltDateField} ${hasValue ? styles.ltDateFieldHasValue : ''} ${className}`.trim()}
    >
      <span className={styles.ltDateFieldIco}>
        <CalendarIco />
      </span>
      <DmyDateInput
        id={id}
        enableTime={enableTime}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={styles.ltDateFieldInput}
      />
    </div>
  );
}

function displayStoredFileName(stored) {
  const raw = String(stored || '').trim();
  const match = raw.match(/^\d+_(.+)$/);
  return match ? match[1] : raw;
}

const LAYTIME_MANDATORY_FIELDS = [
  { key: 'stowageQty', label: 'STOWAGE PLAN QUANTITY' },
  { key: 'vesselArrived', label: 'VESSEL ARRIVED' },
  { key: 'norTendered', label: 'NOR TENDERED' },
  { key: 'loadCommenced', label: 'LOAD/DISCH COMMENCED' },
  { key: 'loadCompleted', label: 'LOAD/DISCH COMPLETED' },
  { key: 'vesselSailed', label: 'VESSEL SAILED' },
];

function focusMandatoryField(fieldId) {
  if (!fieldId || typeof document === 'undefined') return false;

  const byId = document.getElementById(fieldId);
  const byData = document.querySelector(`[data-field="${CSS.escape(fieldId)}"]`);
  const byLabel = document.querySelector(`label[for="${CSS.escape(fieldId)}"]`);
  const container = byData
    || byId?.closest('[class*="field"]')
    || byLabel?.parentElement
    || byId;

  let focusable = null;
  if (byId && typeof byId.focus === 'function' && !byId.disabled) {
    focusable = byId;
  } else if (byData) {
    focusable = byData.querySelector(
      'button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
    );
  }
  if (!focusable && container) {
    focusable = container.querySelector(
      'button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
    );
  }

  const scrollTarget = focusable || container || byData || byId;
  if (!scrollTarget) return false;

  scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

  if (container?.classList && pageStyles.fieldHighlight) {
    container.classList.add(pageStyles.fieldHighlight);
    window.setTimeout(() => container.classList.remove(pageStyles.fieldHighlight), 2500);
  }

  const applyFocus = () => {
    const el = focusable || document.getElementById(fieldId);
    if (!el || typeof el.focus !== 'function') return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    if (typeof el.select === 'function' && el.tagName === 'INPUT') {
      try { el.select(); } catch { /* ignore */ }
    }
  };

  applyFocus();
  window.requestAnimationFrame(() => {
    applyFocus();
    window.setTimeout(applyFocus, 50);
    window.setTimeout(applyFocus, 150);
    window.setTimeout(applyFocus, 300);
  });
  return true;
}

async function alertThenFocus(alertFn, alertOpts, fieldId) {
  focusMandatoryField(fieldId);
  await alertFn(alertOpts);
  await new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        focusMandatoryField(fieldId);
        resolve();
      }, 80);
    });
  });
}

function emptyActivityRow(seedFrom = '') {
  return {
    activity: '',
    start: seedFrom,
    end: '',
    duration: '',
    // Simplified Activities UI hides LT Counts columns; default so used-time still computes.
    ltCounts: true,
    ltNoCounts: false,
    ltPartial: '100',
    cumulative: '',
    notes: '',
  };
}

function emptyDeductionRow() {
  return {
    activity: '',
    start: '',
    end: '',
    duration: '',
    ltPartial: '100',
    cumulative: '',
    notes: '',
  };
}

function normalizeApprovers(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === '') return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

function truthyFlag(value) {
  return value === true || value === 1 || value === '1';
}

function draftFromPort(port, rateUnit = 'days') {
  const draft = {
    terminal: port.terminal || '',
    stowageQty: port.stowageQty || '',
    vesselArrived: port.vesselArrived || '',
    norTendered: port.norTendered || '',
    norAccepted: port.norAccepted || '',
    startCounting: port.startCounting || '',
    pilotOnBoard: port.pilotOnBoard || '',
    loadCommenced: port.loadCommenced || '',
    loadCompleted: port.loadCompleted || '',
    vesselSailed: port.vesselSailed || '',
    laytimeApplicable: port.laytimeApplicable == null ? '1' : String(port.laytimeApplicable),
    portNameManual: port.portNameManual || '',
    detention: truthyFlag(port.detention),
    reversible: truthyFlag(port.reversible),
    loadedQty: port.loadedQty ?? '',
    loadedRate: port.loadedRate ?? '',
    turnTimeToAdd: port.turnTimeToAdd ?? '',
    laytimeAllowed: port.laytimeAllowed ?? '',
    actualLaytime: port.actualLaytime ?? '',
    actualLaytimeExtra: port.actualLaytimeExtra ?? '',
    turnTime: port.turnTime ?? '',
    timeToDemurrage: port.timeToDemurrage ?? '',
    demurrageRate: port.demurrageRate ?? '',
    ttlDemurrage: port.ttlDemurrage ?? '',
    ttlDemurrageManual: port.ttlDemurrageManual ?? '',
    timeToDespatch: port.timeToDespatch ?? '',
    despatchRate: port.despatchRate ?? '',
    ttlDespatch: port.ttlDespatch ?? '',
    ttlDespatchManual: port.ttlDespatchManual ?? '',
    totalDaysAtPort: port.totalDaysAtPort ?? '',
    loadedTerms: port.loadedTerms ?? '',
    remarks: port.remarks || '',
    entityRows: (port.entityRows || []).map((row) => ({ ...row })),
    activities: (port.activities?.length ? port.activities : [emptyActivityRow()])
      .map((row) => {
        const hasCountFlag = Boolean(row.ltCounts) || Boolean(row.ltNoCounts);
        return {
          activity: row.activity || '',
          start: row.start || '',
          end: row.end || '',
          duration: row.duration || '',
          ltCounts: hasCountFlag ? Boolean(row.ltCounts) : true,
          ltNoCounts: Boolean(row.ltNoCounts),
          ltPartial: row.ltPartial ?? (hasCountFlag && !row.ltCounts ? '' : '100'),
          cumulative: row.cumulative ?? '',
          notes: row.notes || '',
        };
      }),
    deductions: (port.deductions?.length ? port.deductions : [emptyDeductionRow()])
      .map((row) => ({
        activity: row.activity || '',
        start: row.start || '',
        end: row.end || '',
        duration: row.duration || '',
        ltPartial: row.ltPartial ?? '100',
        cumulative: row.cumulative ?? '',
        notes: row.notes || '',
      })),
    approvers: normalizeApprovers(port.approvers),
    keepFiles: [...(port.uploads || [])],
  };
  if (!String(draft.laytimeAllowed || '').trim()) {
    const allowed = calcLaytimeAllowed(
      draft.loadedQty,
      draft.loadedRate,
      draft.turnTimeToAdd,
      rateUnit,
    );
    if (allowed !== '') draft.laytimeAllowed = allowed;
  }
  return recomputePortDraft(draft, rateUnit);
}

/**
 * PHP laytime_calculation.php — Ops VC Laytime Calculations.
 * Mirrors OpsVcSofPage structure with port tabs, particulars, activities & deductions.
 */
export default function OpsVcLaytimePage() {
  const confirm = useConfirm();
  const alert = useAlert();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';
  const tabParam = Number(searchParams.get('tab') || searchParams.get('tabs') || 1);
  const flashMsg = searchParams.get('msg');
  const flash = useTimedFlash(flashMsg != null && flashMsg !== '' ? FLASH[Number(flashMsg)] : null);
  const [form, setForm] = useState(null);
  const [activeKey, setActiveKey] = useState('');
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingFilesByKey, setPendingFilesByKey] = useState({});
  const attachInputRef = useRef(null);

  const rateUnit = form?.rateUnit === 'hours' ? 'hours' : 'days';
  const unitLabel = rateUnit === 'hours' ? 'Hrs' : 'Days';
  const currency = form?.currency || 'USD';

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  const load = async (preferredKey = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLaytimeForm(comId);
      setForm(data);
      const unit = data.rateUnit === 'hours' ? 'hours' : 'days';
      const nextDrafts = {};
      (data.ports || []).forEach((port) => {
        nextDrafts[port.key] = draftFromPort(port, unit);
      });
      setDrafts(nextDrafts);
      const preferred = preferredKey
        || data.ports?.[Math.max(0, tabParam - 1)]?.key
        || data.ports?.[0]?.key
        || '';
      setActiveKey(preferred);
    } catch (err) {
      setForm(null);
      setError(err.message || 'Failed to load Laytime.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!comId) {
      setError('COMID is required.');
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comId]);

  const activePort = form?.ports?.find((port) => port.key === activeKey) || null;
  const draft = activeKey ? drafts[activeKey] : null;
  const pendingFiles = pendingFilesByKey[activeKey] || [];
  const locked = Boolean(activePort && !activePort.canEdit);
  const vesselParticulars = form?.vesselParticulars || {};
  const isLoadPort = activePort?.portType === 'LP';
  const qtyLabel = isLoadPort ? 'Load Qty (MT)' : 'Discharge Qty (MT)';
  const rateLabel = `Rate (${rateUnit === 'hours' ? 'MT/Hr' : 'MT/Day'})`;
  const approverOptions = form?.approverOptions || [];

  const patchDraft = (patch, { recompute = false, refreshAllowed = false } = {}) => {
    setDrafts((current) => {
      let base = { ...current[activeKey], ...patch };
      if (refreshAllowed) {
        const allowed = calcLaytimeAllowed(
          base.loadedQty,
          base.loadedRate,
          base.turnTimeToAdd,
          rateUnit,
        );
        if (allowed !== '') base = { ...base, laytimeAllowed: allowed };
      }
      return {
        ...current,
        [activeKey]: recompute || refreshAllowed ? recomputePortDraft(base, rateUnit) : base,
      };
    });
  };

  const updateListRow = (field, index, patch, recompute = false) => {
    const rows = [...(draft[field] || [])];
    rows[index] = { ...rows[index], ...patch };
    patchDraft({ [field]: rows }, { recompute });
  };

  const addListRow = (field, factory) => {
    patchDraft({ [field]: [...(draft[field] || []), factory()] });
  };

  const removeListRow = async (field, index, factory, keepMinOne = true) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to delete this entry permanently?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    const rows = (draft[field] || []).filter((_, i) => i !== index);
    const next = (rows.length || !keepMinOne) ? rows : [factory()];
    patchDraft({ [field]: next }, { recompute: field === 'activities' || field === 'deductions' });
  };

  const handleActivityDateChange = (index, key, value) => {
    updateListRow('activities', index, { [key]: value }, true);
  };

  const handleDeductionDateChange = (index, key, value) => {
    updateListRow('deductions', index, { [key]: value }, true);
  };

  const addActivityRow = () => {
    const rows = draft.activities || [];
    const seedFrom = rows.length ? (rows[rows.length - 1].end || '') : '';
    addListRow('activities', () => emptyActivityRow(seedFrom));
  };

  const setApprovers = (ids) => {
    patchDraft({ approvers: normalizeApprovers(ids) });
  };

  const addPendingFiles = (fileList) => {
    const next = Array.from(fileList || []).filter(Boolean);
    if (!next.length || !activeKey) return;
    setPendingFilesByKey((current) => ({
      ...current,
      [activeKey]: [...(current[activeKey] || []), ...next],
    }));
  };

  const removePendingFile = (index) => {
    if (!activeKey) return;
    setPendingFilesByKey((current) => ({
      ...current,
      [activeKey]: (current[activeKey] || []).filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (submitId) => {
    if (!activePort || !draft) return;

    const missingMandatory = LAYTIME_MANDATORY_FIELDS.filter(
      ({ key }) => !String(draft[key] || '').trim(),
    );
    if (missingMandatory.length) {
      await alertThenFocus(alert, {
        title: 'Alert',
        message: `Please fill the ${missingMandatory.map(({ label }) => label).join(', ')}.`,
      }, missingMandatory[0].key);
      return;
    }

    if (!draft.detention) {
      const qty = Number(draft.loadedQty);
      const rate = Number(draft.loadedRate);
      const missingQty = !String(draft.loadedQty || '').trim() || !(qty > 0);
      const missingRate = !String(draft.loadedRate || '').trim() || !(rate > 0);
      if (missingQty || missingRate) {
        await alertThenFocus(alert, {
          title: 'Alert',
          message: 'Please Check Load Rate Or Quantity',
        }, missingQty ? 'loadedQty' : 'loadedRate');
        return;
      }
    }

    if (submitId === 1 && !(draft.approvers || []).length) {
      await alertThenFocus(alert, {
        title: 'Alert',
        message: 'Please select Level 1 Approvers first.',
      }, 'approvers');
      return;
    }

    if (submitId > 0) {
      const ok = await confirm({
        title: 'Confirmation',
        message: 'Are you sure you want to Submit?',
        confirmLabel: submitId === 5 ? 'Close Laytime' : 'Submit',
      });
      if (!ok) return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await saveLaytime({
        comId,
        portType: activePort.portType,
        portId: activePort.portId,
        randomId: activePort.randomId,
        sofId: activePort.sofId,
        submitId,
        ...draft,
      }, pendingFiles);

      setPendingFilesByKey((current) => ({
        ...current,
        [activeKey]: [],
      }));

      if (result.closed) {
        navigate(`${backHref}?msg=3`);
        return;
      }

      const tabIndex = Math.max(1, (form.ports || []).findIndex((p) => p.key === activeKey) + 1);
      setSearchParams({
        comid: comId,
        page,
        tab: String(tabIndex),
        msg: String(result.msg ?? 0),
      });
      await load(activeKey);
    } catch (err) {
      setError(err.message || 'Failed to save Laytime.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = async () => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to open Laytime?. After submit laytime for all below ports will open.',
      confirmLabel: 'Open',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const result = await openLaytime({
        comId,
        portType: activePort.portType,
        portId: activePort.portId,
        randomId: activePort.randomId,
        laytimeId: activePort.laytimeId,
      });
      setSearchParams({
        comid: comId,
        page,
        tab: String(Math.max(1, (form.ports || []).findIndex((p) => p.key === activeKey) + 1)),
        msg: String(result.msg ?? 2),
      });
      await load(activeKey);
    } catch (err) {
      setError(err.message || 'Failed to open Laytime.');
    } finally {
      setSaving(false);
    }
  };

  const activityCount = (draft?.activities || []).filter((r) => String(r.activity || r.start || r.end || '').trim()).length
    || (draft?.activities || []).length;
  const deductionCount = (draft?.deductions || []).filter((r) => String(r.activity || r.start || r.end || '').trim()).length
    || (draft?.deductions || []).length;
  const cargoSummary = (form?.cargo || []).join(', ') || '—';
  const demVal = Number(draft?.timeToDemurrage) || 0;
  const desVal = Number(draft?.timeToDespatch) || 0;
  const showTimeSaved = desVal > demVal;
  const summarySub = activePort
    ? `${activePort.portName || '—'} · ${activePort.portType || ''}`
    : '';
  const unitShort = rateUnit === 'hours' ? 'hrs' : 'days';
  const docCount = (draft?.keepFiles || []).length + pendingFiles.length;

  const renderCircleDelete = (onClick) => {
    if (locked) return null;
    return (
      <button
        type="button"
        className={`${sofStyles.circleBtn} ${sofStyles.circleBtnDel}`}
        title="Remove row"
        onClick={onClick}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    );
  };

  return (
    <>
      <OpsVcLaytimeHeaderActions backHref={backHref} disabled={loading || saving} />

      <div className={`zafira-page ${pageStyles.page} ${styles.page}`}>
        {(loading || saving) ? (
          <LoadingOverlay active label={saving ? 'Saving Laytime…' : 'Loading Laytime…'} />
        ) : null}
        {flash ? (
          <div className={flash.type === 'error' ? pageStyles.error : pageStyles.flashSuccess}>{flash.text}</div>
        ) : null}
        {error ? <div className={pageStyles.error}>{error}</div> : null}

        {!loading && !form?.ports?.length ? (
          <div className={pageStyles.empty}>
            No load/discharge ports found on the cost sheet for Laytime.
          </div>
        ) : null}

        {form?.ports?.length ? (
          <>
            <div className={sofStyles.pageSubhead}>
              Laytime, demurrage and dispatch working for this voyage&apos;s port calls
              <span className={sofStyles.tagSoft}>LAYTIME</span>
            </div>

            {(form.voyageNo || form.vesselName) ? (
              <div className={sofStyles.voyChip}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="5" r="2.2" />
                  <path d="M12 7.2V21" />
                  <path d="M8 10h8" />
                  <path d="M4 13a8 8 0 0 0 16 0" />
                </svg>
                {form.voyageNo || '—'}
                {form.vesselName ? (
                  <>
                    <span className={sofStyles.vcSep}>·</span>
                    {form.vesselName}
                  </>
                ) : null}
              </div>
            ) : null}

            <div className={sofStyles.portTabs}>
              {form.ports.map((port) => (
                <button
                  key={port.key}
                  type="button"
                  className={port.key === activeKey ? `${sofStyles.portTab} ${sofStyles.portTabActive}` : sofStyles.portTab}
                  onClick={() => setActiveKey(port.key)}
                >
                  <span className={`${sofStyles.ptIco} ${port.portType === 'DP' ? styles.ptIcoDp : styles.ptIcoLp}`}>
                    <PortTypeIcon portType={port.portType} />
                  </span>
                  {port.tabLabel}
                </button>
              ))}
            </div>

            {activePort && draft ? (
              <div className={sofStyles.gprlLayout}>
                <div className={sofStyles.gprlMain}>
                  <div className={sofStyles.cfSection}>
                    <div className={`${sofStyles.cfSectionHead} ${sofStyles.cfSectionHeadNavy}`}>
                      <div className={sofStyles.cfSectionTitleWrap}>
                        <div className={`${sofStyles.sectionIco} ${sofStyles.sectionIcoNavy}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="4" y="3" width="16" height="18" rx="2" />
                            <path d="M8 7h8" />
                            <path d="M8 11h8" />
                            <path d="M8 15h5" />
                          </svg>
                        </div>
                        <div>
                          <div className={sofStyles.cfSectionTitle}>Details</div>
                          <div className={sofStyles.cfSectionSub}>Port, vessel and NOR identifying data</div>
                        </div>
                      </div>
                    </div>
                    <div className={sofStyles.pcGrid}>
                      <div className={sofStyles.pcCell}>
                        <span className={sofStyles.pcLabel}>Vessel</span>
                        <span className={sofStyles.pcVal}>{form.vesselName || vesselParticulars.vesselName || '—'}</span>
                      </div>
                      <div className={sofStyles.pcCell}>
                        <span className={sofStyles.pcLabel}>Port</span>
                        <span className={sofStyles.pcVal}>{activePort.portName || '—'}</span>
                      </div>
                      <div className={sofStyles.pcCell}>
                        <span className={sofStyles.pcLabel}>Voyage</span>
                        <span className={sofStyles.pcVal}>{form.voyageNo || '—'}</span>
                      </div>
                      <div className={sofStyles.pcCell}>
                        <span className={sofStyles.pcLabel}>Cargo</span>
                        <span className={sofStyles.pcVal}>{cargoSummary}</span>
                      </div>
                      <div className={sofStyles.pcCell} data-field="terminal">
                        <span className={sofStyles.pcLabel}>Terminal</span>
                        <input
                          id="terminal"
                          type="text"
                          value={draft.terminal}
                          onChange={(e) => patchDraft({ terminal: e.target.value })}
                          disabled={locked}
                          placeholder="Enter terminal here"
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="stowageQty">
                        <span className={sofStyles.pcLabel}>Stowage Qty</span>
                        <input
                          id="stowageQty"
                          type="text"
                          value={draft.stowageQty}
                          onChange={(e) => patchDraft({ stowageQty: e.target.value })}
                          disabled={locked}
                          placeholder="0.00"
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="norTendered">
                        <span className={sofStyles.pcLabel}>NOR Tendered</span>
                        <LtDateField
                          id="norTendered"
                          className={styles.pcDateWide}
                          value={draft.norTendered}
                          onChange={(v) => patchDraft({ norTendered: v })}
                          disabled={locked}
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="norAccepted">
                        <span className={sofStyles.pcLabel}>NOR Accepted</span>
                        <LtDateField
                          id="norAccepted"
                          className={styles.pcDateWide}
                          value={draft.norAccepted}
                          onChange={(v) => patchDraft({ norAccepted: v })}
                          disabled={locked}
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="startCounting">
                        <span className={sofStyles.pcLabel}>Laytime Commences</span>
                        <LtDateField
                          id="startCounting"
                          className={styles.pcDateWide}
                          value={draft.startCounting}
                          onChange={(v) => patchDraft({ startCounting: v })}
                          disabled={locked}
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="vesselArrived">
                        <span className={sofStyles.pcLabel}>Vessel Arrived</span>
                        <LtDateField
                          id="vesselArrived"
                          className={styles.pcDateWide}
                          value={draft.vesselArrived}
                          onChange={(v) => patchDraft({ vesselArrived: v })}
                          disabled={locked}
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="loadCommenced">
                        <span className={sofStyles.pcLabel}>Load/Disch Commenced</span>
                        <LtDateField
                          id="loadCommenced"
                          className={styles.pcDateWide}
                          value={draft.loadCommenced}
                          onChange={(v) => patchDraft({ loadCommenced: v })}
                          disabled={locked}
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="loadCompleted">
                        <span className={sofStyles.pcLabel}>Load/Disch Completed</span>
                        <LtDateField
                          id="loadCompleted"
                          className={styles.pcDateWide}
                          value={draft.loadCompleted}
                          onChange={(v) => patchDraft({ loadCompleted: v })}
                          disabled={locked}
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="vesselSailed">
                        <span className={sofStyles.pcLabel}>Vessel Sailed</span>
                        <LtDateField
                          id="vesselSailed"
                          className={styles.pcDateWide}
                          value={draft.vesselSailed}
                          onChange={(v) => patchDraft({ vesselSailed: v })}
                          disabled={locked}
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="loadedQty">
                        <span className={sofStyles.pcLabel}>{qtyLabel}</span>
                        <input
                          id="loadedQty"
                          type="text"
                          value={draft.loadedQty ?? ''}
                          onChange={(e) => patchDraft(
                            { loadedQty: e.target.value },
                            { recompute: true, refreshAllowed: true },
                          )}
                          disabled={locked}
                          placeholder="0.00"
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="loadedRate">
                        <span className={sofStyles.pcLabel}>{rateLabel}</span>
                        <input
                          id="loadedRate"
                          type="text"
                          value={draft.loadedRate ?? ''}
                          onChange={(e) => patchDraft(
                            { loadedRate: e.target.value },
                            { recompute: true, refreshAllowed: true },
                          )}
                          disabled={locked}
                          placeholder="0.00"
                        />
                      </div>
                      <div className={sofStyles.pcCell} data-field="turnTimeToAdd">
                        <span className={sofStyles.pcLabel}>Turn Time (To Add) Hours</span>
                        <input
                          id="turnTimeToAdd"
                          type="text"
                          value={draft.turnTimeToAdd ?? ''}
                          onChange={(e) => patchDraft(
                            { turnTimeToAdd: e.target.value },
                            { recompute: true, refreshAllowed: true },
                          )}
                          disabled={locked}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className={sofStyles.cfSection}>
                    <div className={`${sofStyles.cfSectionHead} ${styles.cfSectionHeadBlue}`}>
                      <div className={sofStyles.cfSectionTitleWrap}>
                        <div className={`${sofStyles.sectionIco} ${styles.sectionIcoBlue}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M4 6h10" />
                            <path d="M18 6h2" />
                            <path d="M4 12h4" />
                            <path d="M12 12h8" />
                            <path d="M4 18h13" />
                            <circle cx="17" cy="6" r="2" />
                            <circle cx="8" cy="12" r="2" />
                            <circle cx="19" cy="18" r="2" />
                          </svg>
                        </div>
                        <div>
                          <div className={sofStyles.cfSectionTitle}>Laytime Options</div>
                          <div className={sofStyles.cfSectionSub}>Applicable terms and multi-select options</div>
                        </div>
                      </div>
                    </div>
                    <div className={styles.ltBody}>
                      <div className={styles.ltOptionsRow}>
                        <div className={styles.ltOptItem}>
                          <label htmlFor="laytimeApplicable">Laytime Applicable</label>
                          <select
                            id="laytimeApplicable"
                            value={String(draft.laytimeApplicable ?? '1')}
                            onChange={(e) => patchDraft({ laytimeApplicable: e.target.value })}
                            disabled={locked}
                          >
                            <option value="1">Yes</option>
                            <option value="0">No</option>
                            <option value="2">N.A.</option>
                          </select>
                        </div>
                        <div className={`${styles.ltOptItem} ${styles.ltOptGrow}`}>
                          <label htmlFor="portNameManual">Port Name (Manual)</label>
                          <textarea
                            id="portNameManual"
                            rows={2}
                            value={draft.portNameManual}
                            onChange={(e) => patchDraft({ portNameManual: e.target.value })}
                            disabled={locked}
                            placeholder="Enter manual port name if different from CP nomination"
                          />
                        </div>
                        <div className={styles.ltOptItem}>
                          <label>Options</label>
                          <div className={styles.ltPillgroup}>
                            <PillOption
                              active={Boolean(draft.detention)}
                              disabled={locked}
                              onClick={() => patchDraft({ detention: !draft.detention })}
                            >
                              Detention
                            </PillOption>
                            <PillOption
                              active={Boolean(draft.reversible)}
                              disabled={locked}
                              onClick={() => patchDraft({ reversible: !draft.reversible })}
                            >
                              Reversible
                            </PillOption>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={sofStyles.cfSection} style={{ marginBottom: 0 }}>
                    <div className={styles.ltActdedGrid}>
                      <div className={`${styles.ltActdedCol} ${styles.ltActdedColLeft}`}>
                        <div className={`${sofStyles.cfSectionHead} ${sofStyles.cfSectionHeadOrange}`}>
                          <div className={sofStyles.cfSectionTitleWrap}>
                            <div className={`${sofStyles.sectionIco} ${sofStyles.sectionIcoOrange}`}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M3 12h4l2 6 4-14 2 8h6" />
                              </svg>
                            </div>
                            <div>
                              <div className={sofStyles.cfSectionTitle}>
                                Activities
                                <span className={styles.ltCountBadge}>{activityCount}</span>
                              </div>
                              <div className={sofStyles.cfSectionSub}>Laytime-counting events logged for this port call</div>
                            </div>
                          </div>
                        </div>
                        <div className={sofStyles.tableWrap}>
                          <table className={sofStyles.cfTable}>
                            <thead>
                              <tr>
                                <th style={{ width: 52 }} />
                                <th>Activity</th>
                                <th>Start</th>
                                <th>End</th>
                                <th>Duration</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(draft.activities || []).length ? (draft.activities || []).map((row, index) => (
                                <tr key={`act-${index}`}>
                                  <td style={{ width: 52 }}>
                                    <div className={styles.rowNumWrap}>
                                      <span className={`${styles.rowNum} ${styles.rowNumOrange}`}>{index + 1}</span>
                                      {renderCircleDelete(() => removeListRow('activities', index, emptyActivityRow))}
                                    </div>
                                  </td>
                                  <td>
                                    <input
                                      className={styles.cfInp}
                                      type="text"
                                      value={row.activity}
                                      onChange={(e) => updateListRow('activities', index, { activity: e.target.value })}
                                      disabled={locked}
                                      placeholder="Activity"
                                    />
                                  </td>
                                  <td>
                                    <LtDateField
                                      value={row.start}
                                      onChange={(v) => handleActivityDateChange(index, 'start', v)}
                                      disabled={locked}
                                    />
                                  </td>
                                  <td>
                                    <LtDateField
                                      value={row.end}
                                      onChange={(v) => handleActivityDateChange(index, 'end', v)}
                                      disabled={locked}
                                    />
                                  </td>
                                  <td>
                                    <input className={styles.cfInp} type="text" value={row.duration} disabled placeholder="Auto" />
                                  </td>
                                  <td>
                                    <textarea
                                      className={styles.ltNotesSm}
                                      value={row.notes}
                                      onChange={(e) => updateListRow('activities', index, { notes: e.target.value })}
                                      disabled={locked}
                                      placeholder="Notes"
                                    />
                                  </td>
                                </tr>
                              )) : (
                                <tr className={styles.cfEmptyRow}>
                                  <td colSpan={6}>No activities yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className={styles.addRowWrap}>
                          <AddRowButton label="Add Activity" onClick={addActivityRow} disabled={locked} />
                        </div>
                      </div>

                      <div className={styles.ltActdedCol}>
                        <div className={`${sofStyles.cfSectionHead} ${styles.cfSectionHeadPurple}`}>
                          <div className={sofStyles.cfSectionTitleWrap}>
                            <div className={`${sofStyles.sectionIco} ${styles.sectionIcoPurple}`}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                              </svg>
                            </div>
                            <div>
                              <div className={sofStyles.cfSectionTitle}>
                                Deductions
                                <span className={styles.ltCountBadge}>{deductionCount}</span>
                              </div>
                              <div className={sofStyles.cfSectionSub}>Time carved out of the activities log</div>
                            </div>
                          </div>
                        </div>
                        <div className={sofStyles.tableWrap}>
                          <table className={sofStyles.cfTable}>
                            <thead>
                              <tr>
                                <th style={{ width: 52 }} />
                                <th>Deduction</th>
                                <th>Start</th>
                                <th>End</th>
                                <th>Duration</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(draft.deductions || []).length ? (draft.deductions || []).map((row, index) => (
                                <tr key={`ded-${index}`}>
                                  <td style={{ width: 52 }}>
                                    <div className={styles.rowNumWrap}>
                                      <span className={`${styles.rowNum} ${styles.rowNumPurple}`}>{index + 1}</span>
                                      {renderCircleDelete(() => removeListRow('deductions', index, emptyDeductionRow))}
                                    </div>
                                  </td>
                                  <td>
                                    <input
                                      className={styles.cfInp}
                                      type="text"
                                      value={row.activity}
                                      onChange={(e) => updateListRow('deductions', index, { activity: e.target.value })}
                                      disabled={locked}
                                      placeholder="Deduction"
                                    />
                                  </td>
                                  <td>
                                    <LtDateField
                                      value={row.start}
                                      onChange={(v) => handleDeductionDateChange(index, 'start', v)}
                                      disabled={locked}
                                    />
                                  </td>
                                  <td>
                                    <LtDateField
                                      value={row.end}
                                      onChange={(v) => handleDeductionDateChange(index, 'end', v)}
                                      disabled={locked}
                                    />
                                  </td>
                                  <td>
                                    <input className={styles.cfInp} type="text" value={row.duration} disabled placeholder="Auto" />
                                  </td>
                                  <td>
                                    <textarea
                                      className={styles.ltNotesSm}
                                      value={row.notes}
                                      onChange={(e) => updateListRow('deductions', index, { notes: e.target.value })}
                                      disabled={locked}
                                      placeholder="Notes"
                                    />
                                  </td>
                                </tr>
                              )) : (
                                <tr className={styles.cfEmptyRow}>
                                  <td colSpan={6}>No deductions yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className={styles.addRowWrap}>
                          <AddRowButton
                            label="Add Deduction"
                            onClick={() => addListRow('deductions', emptyDeductionRow)}
                            disabled={locked}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.ltSide}>
                  <div className={styles.ltHighlightCard}>
                    <div className={styles.ltHlHead}>
                      <div className={styles.ltHlIco}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M4 19V5" />
                          <path d="M4 19h16" />
                          <path d="M8 15v-4" />
                          <path d="M12 15V7" />
                          <path d="M16 15v-6" />
                        </svg>
                      </div>
                      <div>
                        <div className={styles.ltHlTitle}>Summary</div>
                        <div className={styles.ltHlSub}>{summarySub}</div>
                      </div>
                    </div>
                    <div className={styles.ltHlBody}>
                      <div className={styles.ltSumItem}>
                        <span className={styles.ltSumIco}><SumIconClock /></span>
                        <div className={styles.ltSumText}>
                          <label>Laytime Allowed</label>
                          <div>
                            <span className={styles.ltSumVal}>{draft.laytimeAllowed || '—'}</span>
                            <span className={styles.ltSumUnit}>{unitShort}</span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.ltSumItem}>
                        <span className={styles.ltSumIco}><SumIconClock /></span>
                        <div className={styles.ltSumText}>
                          <label>Laytime Used</label>
                          <div>
                            <span className={styles.ltSumVal}>{draft.actualLaytime || '—'}</span>
                            <span className={styles.ltSumUnit}>{unitShort}</span>
                          </div>
                        </div>
                      </div>
                      {showTimeSaved ? (
                        <div className={`${styles.ltSumItem} ${styles.ltSumItemHi}`}>
                          <span className={styles.ltSumIco}><SumIconClock /></span>
                          <div className={styles.ltSumText}>
                            <label>Time Saved</label>
                            <div>
                              <span className={styles.ltSumVal}>{draft.timeToDespatch || '—'}</span>
                              <span className={styles.ltSumUnit}>{unitShort}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`${styles.ltSumItem} ${styles.ltSumItemNeg}`}>
                          <span className={styles.ltSumIco}><SumIconClock /></span>
                          <div className={styles.ltSumText}>
                            <label>Time (Lost)</label>
                            <div>
                              <span className={styles.ltSumVal}>{draft.timeToDemurrage || '—'}</span>
                              <span className={styles.ltSumUnit}>{unitShort}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className={styles.ltSumItem}>
                        <span className={styles.ltSumIco}><SumIconCash /></span>
                        <div className={styles.ltSumText}>
                          <label>Demurrage Rate</label>
                          <input
                            className={styles.ltSumInput}
                            type="text"
                            value={draft.demurrageRate ?? ''}
                            onChange={(e) => patchDraft({ demurrageRate: e.target.value }, { recompute: true })}
                            disabled={locked}
                            placeholder="0.00"
                            aria-label={`Demurrage Rate (${currency}/Day)`}
                          />
                          <span className={styles.ltSumUnit}>{currency}/day</span>
                        </div>
                      </div>
                      <div className={styles.ltSumItem}>
                        <span className={styles.ltSumIco}><SumIconCash /></span>
                        <div className={styles.ltSumText}>
                          <label>Dispatch Rate</label>
                          <input
                            className={styles.ltSumInput}
                            type="text"
                            value={draft.despatchRate ?? ''}
                            onChange={(e) => patchDraft({ despatchRate: e.target.value }, { recompute: true })}
                            disabled={locked}
                            placeholder="0.00"
                            aria-label={`Dispatch Rate (${currency}/Day)`}
                          />
                          <span className={styles.ltSumUnit}>{currency}/day</span>
                        </div>
                      </div>
                      {showTimeSaved ? (
                        <div className={`${styles.ltSumItem} ${styles.ltSumItemHi}`}>
                          <span className={styles.ltSumIco}><SumIconCash /></span>
                          <div className={styles.ltSumText}>
                            <label>Dispatch Payable</label>
                            <div>
                              <span className={styles.ltSumVal}>{draft.ttlDespatch || '—'}</span>
                              <span className={styles.ltSumUnit}>{currency}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`${styles.ltSumItem} ${styles.ltSumItemNeg}`}>
                          <span className={styles.ltSumIco}><SumIconCash /></span>
                          <div className={styles.ltSumText}>
                            <label>Demurrage Payable</label>
                            <div>
                              <span className={styles.ltSumVal}>{draft.ttlDemurrage || '—'}</span>
                              <span className={styles.ltSumUnit}>{currency}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={sofStyles.cfSection}>
                    <div className={`${sofStyles.cfSectionHead} ${styles.cfSectionHeadAmber}`}>
                      <div className={sofStyles.cfSectionTitleWrap}>
                        <div className={`${sofStyles.sectionIco} ${styles.sectionIcoAmber}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        </div>
                        <div className={sofStyles.cfSectionTitle} style={{ fontSize: 13.5 }}>Level 1 Approver</div>
                      </div>
                    </div>
                    <div className={styles.ltApprovalBody} data-field="approvers">
                      <label className={styles.ltApprovalLabel} htmlFor="approvers">Assign Approval Usernames</label>
                      {approverOptions.length ? (
                        <select
                          id="approvers"
                          className={styles.ltApprovalSelect}
                          multiple
                          disabled={locked}
                          value={draft.approvers || []}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                            setApprovers(selected);
                          }}
                        >
                          {approverOptions.map((opt) => {
                            const id = String(opt.id ?? opt.value ?? '');
                            const name = opt.name ?? opt.label ?? id;
                            return (
                              <option key={id} value={id}>{name}</option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          id="approvers"
                          className={styles.ltApprovalInput}
                          type="text"
                          value={(draft.approvers || []).join(', ')}
                          onChange={(e) => setApprovers(e.target.value)}
                          disabled={locked}
                          placeholder="e.g. jsmith, agupta"
                        />
                      )}
                      <span className={styles.ltApprovalHint}>(comma-separated)</span>
                    </div>
                  </div>

                  <div className={sofStyles.cfSection}>
                    <div className={`${sofStyles.cfSectionHead} ${sofStyles.cfSectionHeadGrey}`}>
                      <div className={sofStyles.cfSectionTitleWrap}>
                        <div className={`${sofStyles.sectionIco} ${styles.sectionIcoGrey}`} style={{ width: 28, height: 28, background: '#fff', border: '1px solid #dfe2e7' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                            <path d="M8 13h8" />
                            <path d="M8 17h6" />
                          </svg>
                        </div>
                        <div className={sofStyles.cfSectionTitle} style={{ fontSize: 13.5 }}>Remarks &amp; Documents</div>
                        {docCount ? <div className={sofStyles.sideCount}>{docCount}</div> : null}
                      </div>
                    </div>
                    <div className={styles.ltRemarksBody}>
                      <div className={styles.ltRemarksLeglabel}>{summarySub}</div>
                      <textarea
                        className={styles.ltRemarksBox}
                        rows={3}
                        value={draft.remarks}
                        onChange={(e) => patchDraft({ remarks: e.target.value })}
                        disabled={locked}
                        placeholder="Remarks for this port call…"
                      />

                      <div className={styles.ltDocsDivider}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <span>Documents</span>
                      </div>

                      {!locked ? (
                        <>
                          <input
                            ref={attachInputRef}
                            className={sofStyles.hiddenFileInput}
                            type="file"
                            multiple
                            onChange={(event) => {
                              addPendingFiles(event.target.files);
                              event.target.value = '';
                            }}
                          />
                          <div
                            className={sofStyles.dropzone}
                            role="button"
                            tabIndex={0}
                            onClick={() => attachInputRef.current?.click()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                attachInputRef.current?.click();
                              }
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              addPendingFiles(e.dataTransfer?.files);
                            }}
                          >
                            <div className={sofStyles.dropzoneIcon}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M12 16V4" />
                                <path d="M6 10l6-6 6 6" />
                                <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                              </svg>
                            </div>
                            <div className={sofStyles.dropzoneText}>
                              <b>Drag &amp; drop files here</b>, or click to browse
                            </div>
                          </div>
                        </>
                      ) : null}

                      {(draft.keepFiles || []).length || pendingFiles.length ? (
                        <div className={sofStyles.fileList}>
                          {(draft.keepFiles || []).map((file) => (
                            <div key={file} className={sofStyles.fileRow}>
                              <a
                                className={sofStyles.fileName}
                                href={attachmentUrl(file)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {displayStoredFileName(file)}
                              </a>
                              {renderCircleDelete(() => patchDraft({
                                keepFiles: draft.keepFiles.filter((name) => name !== file),
                              }))}
                            </div>
                          ))}
                          {pendingFiles.map((file, index) => (
                            <div key={`pending-${file.name}-${index}`} className={sofStyles.fileRow}>
                              <span className={sofStyles.fileName}>{file.name}</span>
                              <span className={sofStyles.filePending}>(pending)</span>
                              {renderCircleDelete(() => removePendingFile(index))}
                            </div>
                          ))}
                        </div>
                      ) : locked ? (
                        <div className={sofStyles.sideEmpty}>No documents uploaded yet.</div>
                      ) : null}
                    </div>
                  </div>

                  {!locked ? (
                    <>
                      <div className={styles.ltBtnRow}>
                        <button
                          type="button"
                          className={sofStyles.btnSaveOutline}
                          onClick={() => handleSubmit(0)}
                          disabled={saving}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <path d="M17 21v-8H7v8" />
                            <path d="M7 3v5h8" />
                          </svg>
                          Save
                        </button>
                        <button
                          type="button"
                          className={styles.btnSubmitClose}
                          onClick={() => handleSubmit(1)}
                          disabled={saving}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="m22 2-7 20-4-9-9-4Z" />
                            <path d="M22 2 11 13" />
                          </svg>
                          Submit
                        </button>
                      </div>
                      <button
                        type="button"
                        className={styles.btnCloseLaytime}
                        onClick={() => handleSubmit(5)}
                        disabled={saving}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                        </svg>
                        Close Laytime
                      </button>
                      <div className={sofStyles.gprlNote}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M12 9v4" />
                          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <path d="M12 17h.01" />
                        </svg>
                        Use &ldquo;Submit&rdquo; once laytime figures for every port call are finalised; &ldquo;Close Laytime&rdquo; locks the calculation entirely.
                      </div>
                    </>
                  ) : (
                    <>
                      <p className={styles.lockedNote}>This Laytime is locked / closed.</p>
                      {form?.canOpen ? (
                        <button
                          type="button"
                          className={styles.btnSubmitClose}
                          onClick={handleOpen}
                          disabled={saving}
                          style={{ width: '100%' }}
                        >
                          Open
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}

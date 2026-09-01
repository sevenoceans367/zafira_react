import React, { useEffect, useMemo, useRef, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  CardSelect,
  DmyDateInput,
  Field,
  LoadingOverlay,
  Textarea,
  TextInput,
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath, attachmentUrl } from '@bainbridge/shared-routing';
import { fetchLaytimeForm, openLaytime, saveLaytime } from '../../../services/opsVc.js';
import OpsVcLaytimeHeaderActions from './OpsVcLaytimeHeaderActions.jsx';
import { calcLaytimeAllowed, recomputePortDraft } from './laytimeCalculations.js';
import pageStyles from './OpsPages.module.css';
import layoutStyles from './OpsVcSofPage.module.css';

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

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LaytimeInfoPopup() {
  return (
    <div className={layoutStyles.infoPop}>
      <div className={layoutStyles.infoPopTitle}>How this page works</div>
      <ol className={layoutStyles.infoPopSteps}>
        <li>Complete the numbered <b>Particulars</b> for this port call.</li>
        <li>Enter laytime summary figures and record activities / deductions.</li>
        <li><b>Submit to edit</b> saves drafts; <b>Send for Approval</b> or <b>Submit &amp; Close</b> when ready.</li>
        <li>Attach supporting documents in the sidebar before submitting.</li>
      </ol>
    </div>
  );
}

function AddRowButton({ onClick, disabled }) {
  if (disabled) return null;
  return (
    <button type="button" className={layoutStyles.addRowBtn} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add
    </button>
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

function emptyEntityRow() {
  return { name: '', value: '' };
}

function emptyActivityRow(seedFrom = '') {
  return {
    activity: '',
    start: seedFrom,
    end: '',
    duration: '',
    ltCounts: false,
    ltNoCounts: false,
    ltPartial: '',
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
      .map((row) => ({
        activity: row.activity || '',
        start: row.start || '',
        end: row.end || '',
        duration: row.duration || '',
        ltCounts: Boolean(row.ltCounts),
        ltNoCounts: Boolean(row.ltNoCounts),
        ltPartial: row.ltPartial ?? '',
        cumulative: row.cumulative ?? '',
        notes: row.notes || '',
      })),
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

  const handleLtCountsChange = (index, checked) => {
    const patch = checked
      ? { ltCounts: true, ltNoCounts: false, ltPartial: '100' }
      : { ltCounts: false, ltPartial: '0' };
    updateListRow('activities', index, patch, true);
  };

  const handleLtNoCountsChange = (index, checked) => {
    const patch = checked
      ? { ltNoCounts: true, ltCounts: false, ltPartial: '0' }
      : { ltNoCounts: false, ltPartial: '100' };
    updateListRow('activities', index, patch, true);
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
        confirmLabel: submitId === 5 ? 'Submit & Close' : 'Submit',
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

  const summaryFields = [
    { key: 'loadedQty', label: qtyLabel, refreshAllowed: true },
    { key: 'loadedRate', label: rateLabel, refreshAllowed: true },
    { key: 'turnTimeToAdd', label: 'Turn Time (To Add) Hours', refreshAllowed: true },
    { key: 'laytimeAllowed', label: `Laytime Allowed (${unitLabel})`, recompute: true },
    { key: 'actualLaytime', label: `Actual Laytime (${unitLabel})`, readOnly: true },
    { key: 'turnTime', label: 'Turn Time' },
    { key: 'timeToDemurrage', label: `Time to demurrage (${unitLabel})`, readOnly: true },
    { key: 'demurrageRate', label: `Demurrage Rate (${currency}/Day)`, recompute: true },
    { key: 'ttlDemurrage', label: `TTL Demurrage (${currency})` },
    { key: 'ttlDemurrageManual', label: `Manual Demurrage (${currency})` },
    { key: 'timeToDespatch', label: `Time to despatch (${unitLabel})`, readOnly: true },
    { key: 'despatchRate', label: `Despatch Rate (${currency}/Day)`, recompute: true },
    { key: 'ttlDespatch', label: `TTL Despatch (${currency})` },
    { key: 'ttlDespatchManual', label: `Manual Despatch (${currency})` },
    { key: 'totalDaysAtPort', label: 'Total Days At Port' },
    { key: 'loadedTerms', label: 'Terms' },
  ];

  const particularDates = [
    ['terminal', 'PORT/TERMINAL/BERTH/ANCHORAGE', 'text'],
    ['stowageQty', 'STOWAGE PLAN QUANTITY (MT)', 'text'],
    ['vesselArrived', 'VESSEL ARRIVED', 'datetime'],
    ['norTendered', 'NOR TENDERED', 'datetime'],
    ['norAccepted', 'NOR ACCEPTED / VALIDATED', 'datetime'],
    ['startCounting', 'LAYTIME TO START COUNTING', 'datetime'],
    ['pilotOnBoard', 'PILOT ON BOARD / SAILING TIME', 'datetime'],
    ['loadCommenced', 'LOAD/DISCH COMMENCED', 'datetime'],
    ['loadCompleted', 'LOAD/DISCH COMPLETED', 'datetime'],
    ['vesselSailed', 'VESSEL SAILED', 'datetime'],
  ];

  return (
    <>
      <OpsVcLaytimeHeaderActions backHref={backHref} disabled={loading || saving} />

      <div className={`zafira-page ${pageStyles.page}`}>
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
            {(form?.message || form?.vesselName) ? (
              <div className={layoutStyles.voyChip}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="5" r="2.2" />
                  <path d="M12 7.2V21" />
                  <path d="M8 10h8" />
                  <path d="M4 13a8 8 0 0 0 16 0" />
                </svg>
                {form.message || '—'}
                {form.vesselName ? (
                  <>
                    <span className={layoutStyles.vcSep}>|</span>
                    {form.vesselName}
                  </>
                ) : null}
                {form.voyageNo ? (
                  <>
                    <span className={layoutStyles.vcSep}>|</span>
                    Voyage {form.voyageNo}
                  </>
                ) : null}
              </div>
            ) : null}

            <div className={layoutStyles.portTabs}>
              {form.ports.map((port) => (
                <button
                  key={port.key}
                  type="button"
                  className={port.key === activeKey ? `${layoutStyles.portTab} ${layoutStyles.portTabActive}` : layoutStyles.portTab}
                  onClick={() => setActiveKey(port.key)}
                >
                  <span className={layoutStyles.ptIco}>
                    <PortTypeIcon portType={port.portType} />
                  </span>
                  {port.tabLabel}
                </button>
              ))}
            </div>

            {activePort && draft ? (
              <div className={layoutStyles.gprlLayout}>
                <div className={layoutStyles.gprlMain}>
                  <div className={layoutStyles.formCard}>
                    <div className={layoutStyles.sectionBlock}>
                      <div className={layoutStyles.sectionHead}>
                        <div
                          className={`${layoutStyles.sectionIco} ${layoutStyles.sectionIcoNavy} ${layoutStyles.infoTrigger}`}
                          tabIndex={0}
                        >
                          <InfoIcon />
                          <LaytimeInfoPopup />
                        </div>
                        <div className={layoutStyles.sectionTitles}>
                          <div className={layoutStyles.sectionTitle}>Particulars</div>
                          <div className={layoutStyles.sectionSub}>Vessel and port call details</div>
                        </div>
                      </div>
                <div className={pageStyles.tableWrap}>
                  <table className={`zafira-data-table ${pageStyles.nestedTable}`}>
                    <tbody>
                      <tr>
                        <td width="4%">1.</td>
                        <td width="46%">NAME OF VESSEL</td>
                        <td width="50%">{vesselParticulars.vesselName || '—'}</td>
                      </tr>
                      <tr>
                        <td>2.</td>
                        <td>BUILT</td>
                        <td>{vesselParticulars.built || '—'}</td>
                      </tr>
                      <tr>
                        <td>3.</td>
                        <td>GRT/NRT</td>
                        <td>{vesselParticulars.grtNrt || '—'}</td>
                      </tr>
                      {particularDates.map(([key, label, kind], idx) => (
                        <tr key={key}>
                          <td>{4 + idx}.</td>
                          <td>{label}</td>
                          <td data-field={key}>
                            {kind === 'datetime' ? (
                              <DmyDateInput
                                id={key}
                                enableTime
                                value={draft[key]}
                                onChange={(v) => patchDraft({ [key]: v })}
                                disabled={locked}
                              />
                            ) : (
                              <TextInput
                                id={key}
                                value={draft[key]}
                                onChange={(e) => patchDraft({ [key]: e.target.value })}
                                disabled={locked}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                      {(draft.entityRows || []).map((row, index) => (
                        <tr key={`entity-${index}`}>
                          <td>{14 + index}.</td>
                          <td>
                            <TextInput
                              value={row.name}
                              onChange={(e) => updateListRow('entityRows', index, { name: e.target.value })}
                              disabled={locked}
                              placeholder="Enter text here……"
                            />
                          </td>
                          <td>
                            <div className={pageStyles.inlineFields}>
                              <DmyDateInput
                                enableTime
                                value={row.value}
                                onChange={(v) => updateListRow('entityRows', index, { value: v })}
                                disabled={locked}
                              />
                              {!locked ? (
                                <button
                                  type="button"
                                  className={pageStyles.dangerIcon}
                                  title="Delete"
                                  onClick={() => removeListRow('entityRows', index, emptyEntityRow, false)}
                                >
                                  <i className="bi bi-x-lg" aria-hidden />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!locked ? (
                  <AddRowButton onClick={() => addListRow('entityRows', emptyEntityRow)} disabled={locked} />
                ) : null}
                    </div>

                    <div className={layoutStyles.sectionBlock}>
                <h4 className={layoutStyles.blockTitle}>Laytime Options</h4>
                <div className={pageStyles.formGrid}>
                  <Field label="Laytime Applicable">
                    <CardSelect
                      value={draft.laytimeApplicable}
                      options={[
                        { id: '1', name: 'Yes' },
                        { id: '0', name: 'No' },
                      ]}
                      onChange={(v) => patchDraft({ laytimeApplicable: String(v) })}
                      disabled={locked}
                      align="start"
                      ariaLabel="Laytime Applicable"
                    />
                  </Field>
                  <Field label="Port Name (Manual)">
                    <Textarea
                      rows={2}
                      value={draft.portNameManual}
                      onChange={(e) => patchDraft({ portNameManual: e.target.value })}
                      disabled={locked}
                    />
                  </Field>
                  <label className={pageStyles.checkItem}>
                    <input
                      type="checkbox"
                      checked={Boolean(draft.detention)}
                      onChange={(e) => patchDraft({ detention: e.target.checked })}
                      disabled={locked}
                    />
                    <span>Detention</span>
                  </label>
                  <label className={pageStyles.checkItem}>
                    <input
                      type="checkbox"
                      checked={Boolean(draft.reversible)}
                      onChange={(e) => patchDraft({ reversible: e.target.checked })}
                      disabled={locked}
                    />
                    <span>Reversible</span>
                  </label>
                </div>
                    </div>

                    <div className={layoutStyles.sectionBlock}>
                <h4 className={layoutStyles.blockTitle}>Summary</h4>
                <div className={pageStyles.formGrid}>
                  <Field label="Nom ID">
                    <TextInput value={form.message || ''} disabled />
                  </Field>
                  {summaryFields.map((field) => (
                    <Field key={field.key} label={field.label} id={field.key}>
                      <div data-field={field.key}>
                        <TextInput
                          id={field.key}
                          value={draft[field.key] ?? ''}
                          onChange={(e) => patchDraft(
                            { [field.key]: e.target.value },
                            {
                              recompute: Boolean(field.recompute || field.refreshAllowed),
                              refreshAllowed: Boolean(field.refreshAllowed),
                            },
                          )}
                          disabled={locked || field.readOnly}
                        />
                      </div>
                    </Field>
                  ))}
                </div>
                    </div>

                    <div className={layoutStyles.sectionBlock}>
                <h4 className={layoutStyles.blockTitle}>Activities</h4>
                <div className={pageStyles.tableWrap}>
                  <table className={`zafira-data-table ${pageStyles.table}`}>
                    <thead>
                      <tr>
                        <th>Activity</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Duration</th>
                        <th>LT Counts</th>
                        <th>LT No Counts</th>
                        <th>LT Partial %</th>
                        <th>Cumulative</th>
                        <th>Notes</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.activities || []).map((row, index) => (
                        <tr key={`act-${index}`}>
                          <td>
                            <TextInput
                              value={row.activity}
                              onChange={(e) => updateListRow('activities', index, { activity: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <DmyDateInput
                              enableTime
                              value={row.start}
                              onChange={(v) => handleActivityDateChange(index, 'start', v)}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <DmyDateInput
                              enableTime
                              value={row.end}
                              onChange={(v) => handleActivityDateChange(index, 'end', v)}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <TextInput value={row.duration} disabled />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={Boolean(row.ltCounts)}
                              onChange={(e) => handleLtCountsChange(index, e.target.checked)}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={Boolean(row.ltNoCounts)}
                              onChange={(e) => handleLtNoCountsChange(index, e.target.checked)}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <TextInput
                              value={row.ltPartial}
                              onChange={(e) => updateListRow('activities', index, { ltPartial: e.target.value }, true)}
                              disabled={locked || row.ltNoCounts || !row.ltCounts}
                            />
                          </td>
                          <td>
                            <TextInput value={row.cumulative} disabled />
                          </td>
                          <td>
                            <Textarea
                              rows={1}
                              value={row.notes}
                              onChange={(e) => updateListRow('activities', index, { notes: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            {!locked ? (
                              <button
                                type="button"
                                className={pageStyles.dangerIcon}
                                title="Delete"
                                onClick={() => removeListRow('activities', index, emptyActivityRow)}
                              >
                                <i className="bi bi-x-lg" aria-hidden />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!locked ? (
                  <AddRowButton onClick={addActivityRow} disabled={locked} />
                ) : null}
                    </div>

                    <div className={layoutStyles.sectionBlock}>
                <h4 className={layoutStyles.blockTitle}>Deductions</h4>
                <div className={pageStyles.tableWrap}>
                  <table className={`zafira-data-table ${pageStyles.table}`}>
                    <thead>
                      <tr>
                        <th>Activity</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Duration</th>
                        <th>LT Partial %</th>
                        <th>Cumulative Duration</th>
                        <th>Notes</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.deductions || []).map((row, index) => (
                        <tr key={`ded-${index}`}>
                          <td>
                            <TextInput
                              value={row.activity}
                              onChange={(e) => updateListRow('deductions', index, { activity: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <DmyDateInput
                              enableTime
                              value={row.start}
                              onChange={(v) => handleDeductionDateChange(index, 'start', v)}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <DmyDateInput
                              enableTime
                              value={row.end}
                              onChange={(v) => handleDeductionDateChange(index, 'end', v)}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <TextInput value={row.duration} disabled />
                          </td>
                          <td>
                            <TextInput
                              value={row.ltPartial}
                              onChange={(e) => updateListRow('deductions', index, { ltPartial: e.target.value }, true)}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <TextInput value={row.cumulative} disabled />
                          </td>
                          <td>
                            <Textarea
                              rows={1}
                              value={row.notes}
                              onChange={(e) => updateListRow('deductions', index, { notes: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            {!locked ? (
                              <button
                                type="button"
                                className={pageStyles.dangerIcon}
                                title="Delete"
                                onClick={() => removeListRow('deductions', index, emptyDeductionRow)}
                              >
                                <i className="bi bi-x-lg" aria-hidden />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!locked ? (
                  <AddRowButton onClick={() => addListRow('deductions', emptyDeductionRow)} disabled={locked} />
                ) : null}
                    </div>

                    <div className={layoutStyles.sectionBlock}>
                <h4 className={layoutStyles.blockTitle}>Remarks</h4>
                <Textarea
                  rows={3}
                  value={draft.remarks}
                  onChange={(e) => patchDraft({ remarks: e.target.value })}
                  disabled={locked}
                />
                    </div>

                    <div className={layoutStyles.sectionBlock}>
                <h4 className={layoutStyles.blockTitle}>Level 1 Approver</h4>
                {approverOptions.length ? (
                  <Field label="Approvers" id="approvers">
                    <div data-field="approvers">
                      <select
                        id="approvers"
                        multiple
                        disabled={locked}
                        value={draft.approvers || []}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                          setApprovers(selected);
                        }}
                        style={{ minHeight: 96, width: '100%', maxWidth: 420 }}
                      >
                      {approverOptions.map((opt) => {
                        const id = String(opt.id ?? opt.value ?? '');
                        const name = opt.name ?? opt.label ?? id;
                        return (
                          <option key={id} value={id}>{name}</option>
                        );
                      })}
                      </select>
                    </div>
                  </Field>
                ) : (
                  <Field label="Approver IDs (comma-separated)" id="approvers">
                    <div data-field="approvers">
                      <TextInput
                        id="approvers"
                        value={(draft.approvers || []).join(', ')}
                        onChange={(e) => setApprovers(e.target.value)}
                        disabled={locked}
                        placeholder="e.g. 12, 34"
                      />
                    </div>
                  </Field>
                )}
                    </div>
                  </div>
                </div>

                <div className={layoutStyles.gprlSide}>
                  <div className={layoutStyles.sidePdf}>
                    <button
                      type="button"
                      className={layoutStyles.btnPdfOutline}
                      disabled
                      title="PDF generation is not migrated yet."
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
                        <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
                        <path d="M8 12h8" />
                        <path d="M8 15.5h8" />
                      </svg>
                      Generate PDF
                    </button>
                  </div>

                  <div className={layoutStyles.sideCard}>
                    <div className={layoutStyles.sideCardHead}>
                      <div className={layoutStyles.sideIco}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                      </div>
                      <div className={layoutStyles.sideTitle}>Documents</div>
                      <div className={layoutStyles.sideCount}>
                        {(draft.keepFiles || []).length + pendingFiles.length}
                      </div>
                    </div>
                    <div className={layoutStyles.sideCardBody}>
                      {(draft.keepFiles || []).length || pendingFiles.length ? (
                        <>
                          {(draft.keepFiles || []).map((file) => (
                            <div key={file} className={layoutStyles.docRow}>
                              <a
                                href={attachmentUrl(file)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {displayStoredFileName(file)}
                              </a>
                              {!locked ? (
                                <button
                                  type="button"
                                  className={pageStyles.dangerIcon}
                                  title="Remove from list"
                                  onClick={() => patchDraft({
                                    keepFiles: draft.keepFiles.filter((name) => name !== file),
                                  })}
                                >
                                  <i className="bi bi-x-lg" aria-hidden />
                                </button>
                              ) : null}
                            </div>
                          ))}
                          {pendingFiles.map((file, index) => (
                            <div key={`pending-${file.name}-${index}`} className={layoutStyles.docRow}>
                              <span>{file.name}</span>
                              <span className={pageStyles.muted}>(pending)</span>
                              {!locked ? (
                                <button
                                  type="button"
                                  className={pageStyles.dangerIcon}
                                  title="Remove"
                                  onClick={() => removePendingFile(index)}
                                >
                                  <i className="bi bi-x-lg" aria-hidden />
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className={layoutStyles.sideEmpty}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                          <div>No documents uploaded yet.</div>
                        </div>
                      )}
                      {!locked ? (
                        <div className={layoutStyles.attachRow}>
                          <input
                            ref={attachInputRef}
                            className={layoutStyles.hiddenFileInput}
                            type="file"
                            multiple
                            onChange={(event) => {
                              addPendingFiles(event.target.files);
                              event.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            className={layoutStyles.addRowBtn}
                            onClick={() => attachInputRef.current?.click()}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            Add Attachment
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!locked ? (
                    <div className={layoutStyles.gprlBottomActions}>
                      <div className={layoutStyles.gprlNote}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M12 9v4" />
                          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <path d="M12 17h.01" />
                        </svg>
                        Select approvers before sending for approval. Use Submit &amp; Close when the laytime is final.
                      </div>
                      <div className={layoutStyles.gprlFooterActions}>
                        <Button
                          type="button"
                          variant="saveOutline"
                          label="Submit to edit"
                          onClick={() => handleSubmit(0)}
                          disabled={saving}
                        />
                        <Button
                          type="button"
                          variant="saveOutline"
                          label="Send for Approval"
                          onClick={() => handleSubmit(1)}
                          disabled={saving}
                        />
                        <Button
                          type="button"
                          variant="submit"
                          label="Submit & Close"
                          onClick={() => handleSubmit(5)}
                          disabled={saving}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={layoutStyles.lockedNote}>This Laytime is locked / closed.</p>
                      {form?.canOpen ? (
                        <div className={layoutStyles.gprlFooterActions} style={{ marginTop: 12 }}>
                          <Button
                            type="button"
                            variant="submit"
                            label="Open"
                            onClick={handleOpen}
                            disabled={saving}
                          />
                        </div>
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  DmyDateInput,
  Field,
  LoadingOverlay,
  Textarea,
  TextInput,
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchSofForm, saveSof } from '../../../services/opsVc.js';
import OpsVcSofHeaderActions from './OpsVcSofHeaderActions.jsx';
import pageStyles from './OpsPages.module.css';
import styles from './OpsVcSofPage.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

const FLASH = {
  0: { type: 'success', text: 'SOF added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! this SOF already exists for this port.' },
};

/** Hidden until pre-arrival / daily-qty UI is ready for production. Data still loads and saves. */
const SHOW_PRE_ARRIVAL_AND_DAILY_QTY = false;

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

function SofInfoPopup() {
  return (
    <div className={styles.infoPop}>
      <div className={styles.infoPopTitle}>How this page works</div>
      <ol className={styles.infoPopSteps}>
        <li>Complete the numbered <b>Particulars</b> for this port call.</li>
        <li>Add BL, activity, key operations and cargo figures as they occur.</li>
        <li><b>Submit</b> saves your entries; <b>Submit &amp; Close</b> locks the SOF when sailing entries are complete.</li>
        <li>Attach supporting documents in the sidebar before submitting.</li>
      </ol>
    </div>
  );
}

function AddRowButton({ onClick, disabled }) {
  if (disabled) return null;
  return (
    <button type="button" className={styles.addRowBtn} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add
    </button>
  );
}

const SOF_MANDATORY_FIELDS = [
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

function isRobActivity(activity) {
  return activity === 'EOSP' || activity === 'Full away on passage';
}

function isRemarksCargoActivity(activity) {
  const name = String(activity || '').toLowerCase();
  return ![
    'cargo loaded',
    'bunkers taken',
    'tugs used arrival',
    'tugs used for shifting',
    'tugs used for departure',
    'arrival draft',
    'departure draft',
  ].includes(name);
}

function cargoLabelA(activity) {
  if (activity === 'Cargo Loaded') return "Ship's Figures";
  if (activity === 'Bunkers taken') return 'IFO';
  return 'F';
}

function cargoLabelB(activity) {
  if (activity === 'Cargo Loaded') return 'B/L Figures';
  if (activity === 'Bunkers taken') return 'MDO';
  return 'A';
}

function emptyKeyOp() {
  return {
    activity: '',
    activityDateTime: '',
    robIfo: '',
    robMdo: '',
    comments: '',
    tDefault: 0,
  };
}

function emptyCargoRow() {
  return {
    activity: '',
    shipFigure: '',
    blFigure: '',
    waterDensity: '',
    remarks: '',
    tDefault: 0,
  };
}

function emptyEntityRow() {
  return { name: '', value: '' };
}

function emptyBlRow() {
  return { blDate: '', cargo: '', blQty: '' };
}

function emptyActivityRow(seedFrom = '') {
  return {
    activity: '', from: seedFrom, to: '', duration: '', notes: '',
  };
}

function emptyDailyQtyRow() {
  return {
    date: '', engagementQty: '', loadLast: '', ttlLoad: '', balance: '', etcd: '',
  };
}

function emptyPreArrival() {
  return {
    cargoDecl: false,
    stowPlanQty: '',
    spDeptDraft: '',
    spArrDraft: '',
    eta30: '',
    eta25: '',
    eta20: '',
    eta15: '',
    eta10: '',
    eta7: '',
    eta5: '',
    eta3: '',
    eta2: '',
    eta1: '',
    actualArrival: '',
    norTendered: '',
  };
}

function parseDisplayDateTime(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '0', min = '0'] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
}

function computeDurationHours(fromStr, toStr) {
  const from = parseDisplayDateTime(fromStr);
  const to = parseDisplayDateTime(toStr);
  if (!from || !to) return '0.0';
  const diffMs = to.getTime() - from.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  return hours.toFixed(4);
}

function displayStoredFileName(stored) {
  const raw = String(stored || '').trim();
  const match = raw.match(/^\d+_(.+)$/);
  return match ? match[1] : raw;
}

function attachmentHref(stored) {
  const file = String(stored || '').trim();
  return file ? `/attachment/${encodeURIComponent(file)}` : '';
}

function draftFromPort(port) {
  return {
    terminal: port.terminal || '',
    stowageQty: port.stowageQty || '',
    vesselArrived: port.vesselArrived || '',
    norTendered: port.norTendered || '',
    pilotOnBoard: port.pilotOnBoard || '',
    loadCommenced: port.loadCommenced || '',
    loadCompleted: port.loadCompleted || '',
    vesselSailed: port.vesselSailed || '',
    agentRemarks: port.agentRemarks || '',
    entityRows: (port.entityRows || []).map((row) => ({ ...row })),
    blRows: (port.blRows?.length ? port.blRows : [emptyBlRow()]).map((row) => ({ ...row })),
    portActivities: (port.portActivities?.length ? port.portActivities : [emptyActivityRow()])
      .map((row) => ({ ...row })),
    preArrival: { ...emptyPreArrival(), ...(port.preArrival || {}) },
    dailyQty: (port.dailyQty?.length ? port.dailyQty : [emptyDailyQtyRow()]).map((row) => ({ ...row })),
    keyOperations: (port.keyOperations || []).map((row) => ({ ...row })),
    cargoRows: (port.cargoRows || []).map((row) => ({ ...row })),
    keepFiles: [...(port.uploads || [])],
  };
}

/**
 * PHP sof.php — Statement of Facts (Ops VC Calculations → SOF).
 * Ports classic dryout/sof.php numbered particulars (1-16+), BL table, activity-in-port,
 * agent's remarks, documents, pre-arrival & other, and daily qty — plus the newer
 * key operations / cargo figures sections already shipped in zafira_react/php/sof.php.
 * Uses shared internal-user layout (page header / breadcrumbs / sidebar).
 */
export default function OpsVcSofPage() {
  const confirm = useConfirm();
  const alert = useAlert();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';
  const tabParam = Number(searchParams.get('tabs') || searchParams.get('tab') || 1);
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

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  const load = async (preferredKey = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSofForm(comId);
      setForm(data);
      const nextDrafts = {};
      (data.ports || []).forEach((port) => {
        nextDrafts[port.key] = draftFromPort(port);
      });
      setDrafts(nextDrafts);
      setPendingFilesByKey({});
      const preferred = preferredKey
        || data.ports?.[Math.max(0, tabParam - 1)]?.key
        || data.ports?.[0]?.key
        || '';
      setActiveKey(preferred);
    } catch (err) {
      setForm(null);
      setError(err.message || 'Failed to load SOF.');
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

  const patchDraft = (patch) => {
    setDrafts((current) => ({
      ...current,
      [activeKey]: { ...current[activeKey], ...patch },
    }));
  };

  const updateListRow = (field, index, patch) => {
    const rows = [...(draft[field] || [])];
    rows[index] = { ...rows[index], ...patch };
    patchDraft({ [field]: rows });
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
    patchDraft({ [field]: (rows.length || !keepMinOne) ? rows : [factory()] });
  };

  const patchPreArrival = (patch) => {
    patchDraft({ preArrival: { ...draft.preArrival, ...patch } });
  };

  const handleActivityDateChange = (index, key, value) => {
    const row = draft.portActivities[index];
    const next = { ...row, [key]: value };
    next.duration = computeDurationHours(
      key === 'from' ? value : row.from,
      key === 'to' ? value : row.to,
    );
    updateListRow('portActivities', index, next);
  };

  const addActivityRow = () => {
    const rows = draft.portActivities || [];
    const seedFrom = rows.length ? (rows[rows.length - 1].to || '') : '';
    addListRow('portActivities', () => emptyActivityRow(seedFrom));
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

    const missing = SOF_MANDATORY_FIELDS.filter(
      ({ key }) => !String(draft[key] || '').trim(),
    );
    if (missing.length) {
      await alertThenFocus(alert, {
        title: 'Alert',
        message: `Please fill the ${missing.map(({ label }) => label).join(', ')}.`,
      }, missing[0].key);
      return;
    }

    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure all entries prior to sailing are made?',
      confirmLabel: submitId === 2 ? 'Submit & Close' : 'Submit',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const result = await saveSof({
        comId,
        portType: activePort.portType,
        portId: activePort.portId,
        randomId: activePort.randomId,
        submitId,
        terminal: draft.terminal,
        stowageQty: draft.stowageQty,
        vesselArrived: draft.vesselArrived,
        norTendered: draft.norTendered,
        pilotOnBoard: draft.pilotOnBoard,
        loadCommenced: draft.loadCommenced,
        loadCompleted: draft.loadCompleted,
        vesselSailed: draft.vesselSailed,
        agentRemarks: draft.agentRemarks,
        entityRows: draft.entityRows,
        blRows: draft.blRows,
        portActivities: draft.portActivities,
        preArrival: draft.preArrival,
        dailyQty: draft.dailyQty,
        keyOperations: draft.keyOperations,
        cargoRows: draft.cargoRows,
        keepFiles: draft.keepFiles,
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
        tabs: String(tabIndex),
        msg: String(result.msg ?? 0),
      });
      await load(activeKey);
    } catch (err) {
      setError(err.message || 'Failed to save SOF.');
    } finally {
      setSaving(false);
    }
  };

  const isLoadPort = activePort?.portType === 'LP';
  const isDischPort = activePort?.portType === 'DP';
  const preArrivalLabels = isLoadPort
    ? {
      decl: 'CARGO DECL.SIGN MASTER',
      qty: 'STOW PLAN QTY',
      draft1: 'SP DEP DRAFT',
      draft2: 'SP ARR DRAFT',
    }
    : {
      decl: 'BL MANIFEST',
      qty: 'BL QUANTITY',
      draft1: 'ARR DRAFT',
      draft2: 'DEP DRAFT',
    };

  // PHP sof.php numbers items dynamically: 16 fixed rows + entity rows, then
  // BL table / Activity in Port / Agent's remarks / Documents headings continue counting.
  const entityCount = draft?.entityRows?.length || 0;
  const numBl = 17 + entityCount;
  const numActivity = numBl + 1;
  const numRemarks = numActivity + 1;

  return (
    <>
      <OpsVcSofHeaderActions
        backHref={backHref}
        disabled={loading || saving}
      />

      <div className={`zafira-page ${pageStyles.page}`}>
        {(loading || saving) ? <LoadingOverlay active label={saving ? 'Saving SOF…' : 'Loading SOF…'} /> : null}
        {flash ? (
          <div className={flash.type === 'error' ? pageStyles.error : pageStyles.flashSuccess}>{flash.text}</div>
        ) : null}
        {error ? <div className={pageStyles.error}>{error}</div> : null}

        {!loading && !form?.ports?.length ? (
          <div className={pageStyles.empty}>
            No load/discharge/transit ports found on the cost sheet for SOF.
          </div>
        ) : null}

        {form?.ports?.length ? (
          <>
            {(form?.message || form?.vesselName) ? (
              <div className={styles.voyChip}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="5" r="2.2" />
                  <path d="M12 7.2V21" />
                  <path d="M8 10h8" />
                  <path d="M4 13a8 8 0 0 0 16 0" />
                </svg>
                {form.message || '—'}
                {form.vesselName ? (
                  <>
                    <span className={styles.vcSep}>·</span>
                    {form.vesselName}
                  </>
                ) : null}
              </div>
            ) : null}

            <div className={styles.portTabs}>
              {form.ports.map((port) => (
                <button
                  key={port.key}
                  type="button"
                  className={port.key === activeKey ? `${styles.portTab} ${styles.portTabActive}` : styles.portTab}
                  onClick={() => setActiveKey(port.key)}
                >
                  <span className={styles.ptIco}>
                    <PortTypeIcon portType={port.portType} />
                  </span>
                  {port.tabLabel}
                </button>
              ))}
            </div>

            {activePort && draft ? (
              <div className={styles.gprlLayout}>
                <div className={styles.gprlMain}>
                  <div className={styles.formCard}>
                    <div className={styles.sectionBlock}>
                      <div className={styles.sectionHead}>
                        <div
                          className={`${styles.sectionIco} ${styles.sectionIcoNavy} ${styles.infoTrigger}`}
                          tabIndex={0}
                        >
                          <InfoIcon />
                          <SofInfoPopup />
                        </div>
                        <div className={styles.sectionTitles}>
                          <div className={styles.sectionTitle}>Particulars</div>
                          <div className={styles.sectionSub}>Vessel and port call details</div>
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
                      <tr>
                        <td>4.</td>
                        <td>FLAG</td>
                        <td>{vesselParticulars.flag || '—'}</td>
                      </tr>
                      <tr>
                        <td>5.</td>
                        <td>DWT(s)</td>
                        <td>{vesselParticulars.dwt || '—'}</td>
                      </tr>
                      <tr>
                        <td>6.</td>
                        <td>LOA/BEAM</td>
                        <td>{vesselParticulars.loaBeam || '—'}</td>
                      </tr>
                      <tr>
                        <td>7.</td>
                        <td>{vesselParticulars.gearLabel || 'GEAR/GRABS'}</td>
                        <td>{vesselParticulars.gearValue || '—'}</td>
                      </tr>
                      <tr>
                        <td>8.</td>
                        <td>{vesselParticulars.hatchLabel || 'HATCH/HOLD'}</td>
                        <td>{vesselParticulars.hatchValue || '—'}</td>
                      </tr>
                      <tr>
                        <td>9.</td>
                        <td>PORT/TERMINAL/BERTH/ANCHORAGE</td>
                        <td>
                          <TextInput
                            value={draft.terminal}
                            onChange={(e) => patchDraft({ terminal: e.target.value })}
                            disabled={locked}
                            placeholder="Enter terminal here"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>10.</td>
                        <td>STOWAGE PLAN QUANTITY (MT)</td>
                        <td data-field="stowageQty">
                          <TextInput
                            id="stowageQty"
                            value={draft.stowageQty}
                            onChange={(e) => patchDraft({ stowageQty: e.target.value })}
                            disabled={locked}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>11.</td>
                        <td>VESSEL ARRIVED</td>
                        <td data-field="vesselArrived">
                          <DmyDateInput
                            id="vesselArrived"
                            enableTime
                            value={draft.vesselArrived}
                            onChange={(v) => patchDraft({ vesselArrived: v })}
                            disabled={locked}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>12.</td>
                        <td>NOR TENDERED</td>
                        <td data-field="norTendered">
                          <DmyDateInput
                            id="norTendered"
                            enableTime
                            value={draft.norTendered}
                            onChange={(v) => patchDraft({ norTendered: v })}
                            disabled={locked}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>13.</td>
                        <td>PILOT ON BOARD</td>
                        <td>
                          <DmyDateInput
                            enableTime
                            value={draft.pilotOnBoard}
                            onChange={(v) => patchDraft({ pilotOnBoard: v })}
                            disabled={locked}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>14.</td>
                        <td>LOAD/DISCH COMMENCED</td>
                        <td data-field="loadCommenced">
                          <DmyDateInput
                            id="loadCommenced"
                            enableTime
                            value={draft.loadCommenced}
                            onChange={(v) => patchDraft({ loadCommenced: v })}
                            disabled={locked}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>15.</td>
                        <td>LOAD/DISCH COMPLETED</td>
                        <td data-field="loadCompleted">
                          <DmyDateInput
                            id="loadCompleted"
                            enableTime
                            value={draft.loadCompleted}
                            onChange={(v) => patchDraft({ loadCompleted: v })}
                            disabled={locked}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td>16.</td>
                        <td>VESSEL SAILED</td>
                        <td data-field="vesselSailed">
                          <DmyDateInput
                            id="vesselSailed"
                            enableTime
                            value={draft.vesselSailed}
                            onChange={(v) => patchDraft({ vesselSailed: v })}
                            disabled={locked}
                          />
                        </td>
                      </tr>
                      {(draft.entityRows || []).map((row, index) => (
                        <tr key={`entity-${index}`}>
                          <td>{17 + index}.</td>
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
                              <TextInput
                                value={row.value}
                                onChange={(e) => updateListRow('entityRows', index, { value: e.target.value })}
                                disabled={locked}
                                placeholder="Enter text here……"
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

                    <div className={styles.sectionBlock}>
                {/* B. BL table */}
                <h4 className={styles.blockTitle}>{numBl}. Bill of Lading</h4>
                <div className={pageStyles.tableWrap}>
                  <table className={`zafira-data-table ${pageStyles.table}`}>
                    <thead>
                      <tr>
                        <th width="30%">BL Date</th>
                        <th width="30%">Cargo</th>
                        <th width="30%">BL Qty(MT)</th>
                        <th width="10%" />
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.blRows || []).map((row, index) => (
                        <tr key={`bl-${index}`}>
                          <td>
                            <DmyDateInput
                              value={row.blDate}
                              onChange={(v) => updateListRow('blRows', index, { blDate: v })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <TextInput
                              value={row.cargo}
                              onChange={(e) => updateListRow('blRows', index, { cargo: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <TextInput
                              value={row.blQty}
                              onChange={(e) => updateListRow('blRows', index, { blQty: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            {!locked ? (
                              <button
                                type="button"
                                className={pageStyles.dangerIcon}
                                title="Delete"
                                onClick={() => removeListRow('blRows', index, emptyBlRow)}
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
                  <AddRowButton onClick={() => addListRow('blRows', emptyBlRow)} disabled={locked} />
                ) : null}
                    </div>

                    <div className={styles.sectionBlock}>
                {/* C. Activity in Port */}
                <h4 className={styles.blockTitle}>
                  {numActivity}. Activity in Port
                </h4>
                <div className={pageStyles.tableWrap}>
                  <table className={`zafira-data-table ${pageStyles.table}`}>
                    <thead>
                      <tr>
                        <th width="20%">Activity</th>
                        <th width="18%">From</th>
                        <th width="18%">To</th>
                        <th width="10%">Duration</th>
                        <th width="29%">Remarks</th>
                        <th width="5%" />
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.portActivities || []).map((row, index) => (
                        <tr key={`activity-${index}`}>
                          <td>
                            <TextInput
                              value={row.activity}
                              onChange={(e) => updateListRow('portActivities', index, { activity: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <DmyDateInput
                              enableTime
                              value={row.from}
                              onChange={(v) => handleActivityDateChange(index, 'from', v)}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <DmyDateInput
                              enableTime
                              value={row.to}
                              onChange={(v) => handleActivityDateChange(index, 'to', v)}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <TextInput
                              value={row.duration}
                              onChange={(e) => updateListRow('portActivities', index, { duration: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <Textarea
                              rows={1}
                              value={row.notes}
                              onChange={(e) => updateListRow('portActivities', index, { notes: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            {!locked ? (
                              <button
                                type="button"
                                className={pageStyles.dangerIcon}
                                title="Delete"
                                onClick={() => removeListRow('portActivities', index, emptyActivityRow)}
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

                    <div className={styles.sectionBlock}>
                {/* H. Key operations (sof_slave_6) */}
                <h4 className={styles.blockTitle}>Key operations</h4>
                <div className={pageStyles.tableWrap}>
                  <table className={`zafira-data-table ${pageStyles.table}`}>
                    <thead>
                      <tr>
                        <th width="4%">#</th>
                        <th width="28%">Key operation</th>
                        <th width="18%">Date Time</th>
                        <th width="50%">Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.keyOperations || []).map((row, index) => (
                        <tr key={`kop-${index}`}>
                          <td>
                            {!locked ? (
                              <button
                                type="button"
                                className={pageStyles.dangerIcon}
                                title="Delete"
                                onClick={() => removeListRow('keyOperations', index, emptyKeyOp, false)}
                              >
                                <i className="bi bi-x-lg" aria-hidden />
                              </button>
                            ) : null}
                          </td>
                          <td>
                            <TextInput
                              value={row.activity}
                              onChange={(e) => updateListRow('keyOperations', index, { activity: e.target.value })}
                              disabled={locked || Number(row.tDefault) === 1}
                              placeholder="Enter text here……"
                            />
                          </td>
                          <td>
                            <DmyDateInput
                              enableTime
                              value={row.activityDateTime || ''}
                              onChange={(v) => updateListRow('keyOperations', index, { activityDateTime: v })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            {isRobActivity(row.activity) ? (
                              <div className={pageStyles.inlineFields}>
                                <label>
                                  ROB IFO
                                  <TextInput
                                    value={row.robIfo}
                                    onChange={(e) => updateListRow('keyOperations', index, { robIfo: e.target.value })}
                                    disabled={locked}
                                    placeholder="0.00"
                                  />
                                </label>
                                <label>
                                  ROB MDO
                                  <TextInput
                                    value={row.robMdo}
                                    onChange={(e) => updateListRow('keyOperations', index, { robMdo: e.target.value })}
                                    disabled={locked}
                                    placeholder="0.00"
                                  />
                                </label>
                              </div>
                            ) : (
                              <TextInput
                                value={row.comments}
                                onChange={(e) => updateListRow('keyOperations', index, { comments: e.target.value })}
                                disabled={locked}
                                placeholder="Comments here…."
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!locked ? (
                  <AddRowButton onClick={() => addListRow('keyOperations', emptyKeyOp)} disabled={locked} />
                ) : null}
                    </div>

                    <div className={styles.sectionBlock}>
                <h4 className={styles.blockTitle}>Cargo / figures</h4>
                <div className={pageStyles.tableWrap}>
                  <table className={`zafira-data-table ${pageStyles.table}`}>
                    <tbody>
                      {(draft.cargoRows || []).map((row, index) => (
                        <tr key={`cargo-${index}`}>
                          <td width="4%">
                            {!locked ? (
                              <button
                                type="button"
                                className={pageStyles.dangerIcon}
                                title="Delete"
                                onClick={() => removeListRow('cargoRows', index, emptyCargoRow, false)}
                              >
                                <i className="bi bi-x-lg" aria-hidden />
                              </button>
                            ) : null}
                          </td>
                          <td width="22%">
                            <TextInput
                              value={row.activity}
                              onChange={(e) => updateListRow('cargoRows', index, { activity: e.target.value })}
                              disabled={locked || Number(row.tDefault) === 1}
                              placeholder="Enter text here……"
                            />
                          </td>
                          {isRemarksCargoActivity(row.activity) ? (
                            <td colSpan={4}>
                              <TextInput
                                value={row.remarks}
                                onChange={(e) => updateListRow('cargoRows', index, { remarks: e.target.value })}
                                disabled={locked}
                                placeholder="Text here…….."
                              />
                            </td>
                          ) : (
                            <>
                              <td>
                                <Field label={cargoLabelA(row.activity)}>
                                  <TextInput
                                    value={row.shipFigure}
                                    onChange={(e) => updateListRow('cargoRows', index, { shipFigure: e.target.value })}
                                    disabled={locked}
                                    placeholder="0.00"
                                  />
                                </Field>
                              </td>
                              <td>
                                <Field label={cargoLabelB(row.activity)}>
                                  <TextInput
                                    value={row.blFigure}
                                    onChange={(e) => updateListRow('cargoRows', index, { blFigure: e.target.value })}
                                    disabled={locked}
                                    placeholder="0.00"
                                  />
                                </Field>
                              </td>
                              <td colSpan={2}>
                                {(row.activity === 'Arrival draft' || row.activity === 'Departure draft') ? (
                                  <Field label="Corresponding water density">
                                    <TextInput
                                      value={row.waterDensity}
                                      onChange={(e) => updateListRow('cargoRows', index, { waterDensity: e.target.value })}
                                      disabled={locked}
                                      placeholder="0.00"
                                    />
                                  </Field>
                                ) : null}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!locked ? (
                  <AddRowButton onClick={() => addListRow('cargoRows', emptyCargoRow)} disabled={locked} />
                ) : null}
                    </div>

                    <div className={styles.sectionBlock}>
                {/* D. Agent's remarks */}
                <h4 className={styles.blockTitle}>{numRemarks}. AGENT&apos;S REMARKS (If Any)</h4>
                <Textarea
                  rows={3}
                  value={draft.agentRemarks}
                  onChange={(e) => patchDraft({ agentRemarks: e.target.value })}
                  disabled={locked}
                />
                    </div>

                    {SHOW_PRE_ARRIVAL_AND_DAILY_QTY ? (
                    <>
                    <div className={styles.sectionBlock}>
                {/* F. Pre arrival & other */}
                <h4 className={styles.blockTitle}>PRE ARRIVAL &amp; OTHER</h4>
                <div className={pageStyles.section}>
                  <div className={pageStyles.checkGrid}>
                    <label className={pageStyles.checkItem}>
                      <input
                        type="checkbox"
                        checked={Boolean(draft.preArrival.cargoDecl)}
                        onChange={(e) => patchPreArrival({ cargoDecl: e.target.checked })}
                        disabled={locked}
                      />
                      <span>{preArrivalLabels.decl}</span>
                    </label>
                  </div>
                  <div className={pageStyles.formGrid} style={{ marginTop: 12 }}>
                    <Field label={preArrivalLabels.qty}>
                      <TextInput
                        value={draft.preArrival.stowPlanQty}
                        onChange={(e) => patchPreArrival({ stowPlanQty: e.target.value })}
                        disabled={locked}
                      />
                    </Field>
                    <Field label={preArrivalLabels.draft1}>
                      <TextInput
                        value={draft.preArrival.spDeptDraft}
                        onChange={(e) => patchPreArrival({ spDeptDraft: e.target.value })}
                        disabled={locked}
                      />
                    </Field>
                    <Field label={preArrivalLabels.draft2}>
                      <TextInput
                        value={draft.preArrival.spArrDraft}
                        onChange={(e) => patchPreArrival({ spArrDraft: e.target.value })}
                        disabled={locked}
                      />
                    </Field>
                  </div>
                  <div className={pageStyles.formGrid} style={{ marginTop: 12 }}>
                    {[
                      ['eta30', 'ETA 30 DAYS'],
                      ['eta25', 'ETA 25 DAYS'],
                      ['eta20', 'ETA 20 DAYS'],
                      ['eta15', 'ETA 15 DAYS'],
                      ['eta10', 'ETA 10 DAYS'],
                      ['eta7', 'ETA 7 DAYS'],
                      ['eta5', 'ETA 5 DAYS'],
                      ['eta3', 'ETA 3 DAYS'],
                      ['eta2', 'ETA 2 DAYS'],
                      ['eta1', 'ETA 1 DAYS'],
                      ['actualArrival', 'ACTUAL ARRIVAL'],
                      ['norTendered', 'NOR TENDERED'],
                    ].map(([key, label]) => (
                      <Field key={key} label={label}>
                        <DmyDateInput
                          enableTime
                          value={draft.preArrival[key]}
                          onChange={(v) => patchPreArrival({ [key]: v })}
                          disabled={locked}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
                    </div>

                    <div className={styles.sectionBlock}>
                {/* G. Daily qty */}
                <h4 className={styles.blockTitle}>DAILY QTY</h4>
                <div className={pageStyles.tableWrap}>
                  <table className={`zafira-data-table ${pageStyles.table}`}>
                    <thead>
                      <tr>
                        <th width="14%">Date (every N/N or on completion)</th>
                        <th width="16%">Total agreed qty (MT)</th>
                        {activePort.portType !== 'TP' ? (
                          <>
                            <th width="16%">{isDischPort ? 'Discharged' : 'Loaded'} last 24 hrs (MT)</th>
                            <th width="16%">Total {isDischPort ? 'discharged' : 'loaded'} this far (MT)</th>
                          </>
                        ) : null}
                        <th width="14%">Balance (MT)</th>
                        <th width="14%">ETC cargo / cargo completed</th>
                        <th width="4%" />
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.dailyQty || []).map((row, index) => (
                        <tr key={`daily-${index}`}>
                          <td>
                            <DmyDateInput
                              value={row.date}
                              onChange={(v) => updateListRow('dailyQty', index, { date: v })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <TextInput
                              value={row.engagementQty}
                              onChange={(e) => updateListRow('dailyQty', index, { engagementQty: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          {activePort.portType !== 'TP' ? (
                            <>
                              <td>
                                <TextInput
                                  value={row.loadLast}
                                  onChange={(e) => updateListRow('dailyQty', index, { loadLast: e.target.value })}
                                  disabled={locked}
                                />
                              </td>
                              <td>
                                <TextInput
                                  value={row.ttlLoad}
                                  onChange={(e) => updateListRow('dailyQty', index, { ttlLoad: e.target.value })}
                                  disabled={locked}
                                />
                              </td>
                            </>
                          ) : null}
                          <td>
                            <TextInput
                              value={row.balance}
                              onChange={(e) => updateListRow('dailyQty', index, { balance: e.target.value })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            <DmyDateInput
                              enableTime
                              value={row.etcd}
                              onChange={(v) => updateListRow('dailyQty', index, { etcd: v })}
                              disabled={locked}
                            />
                          </td>
                          <td>
                            {!locked ? (
                              <button
                                type="button"
                                className={pageStyles.dangerIcon}
                                title="Delete"
                                onClick={() => removeListRow('dailyQty', index, emptyDailyQtyRow)}
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
                  <AddRowButton onClick={() => addListRow('dailyQty', emptyDailyQtyRow)} disabled={locked} />
                ) : null}
                    </div>
                    </>
                    ) : null}
                  </div>
                </div>

                <div className={styles.gprlSide}>
                  <div className={styles.sidePdf}>
                    <button
                      type="button"
                      className={styles.btnPdfOutline}
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

                  <div className={styles.sideCard}>
                    <div className={styles.sideCardHead}>
                      <div className={styles.sideIco}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                      </div>
                      <div className={styles.sideTitle}>Documents</div>
                      <div className={styles.sideCount}>
                        {(draft.keepFiles || []).length + pendingFiles.length}
                      </div>
                    </div>
                    <div className={styles.sideCardBody}>
                      {(draft.keepFiles || []).length || pendingFiles.length ? (
                        <>
                          {(draft.keepFiles || []).map((file) => (
                            <div key={file} className={styles.docRow}>
                              <a
                                href={attachmentHref(file)}
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
                            <div key={`pending-${file.name}-${index}`} className={styles.docRow}>
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
                        <div className={styles.sideEmpty}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                          <div>No documents uploaded yet.</div>
                        </div>
                      )}
                      {!locked ? (
                        <div className={styles.attachRow}>
                          <input
                            ref={attachInputRef}
                            className={styles.hiddenFileInput}
                            type="file"
                            multiple
                            onChange={(event) => {
                              addPendingFiles(event.target.files);
                              event.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            className={styles.addRowBtn}
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
                    <div className={styles.gprlBottomActions}>
                      <div className={styles.gprlNote}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M12 9v4" />
                          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <path d="M12 17h.01" />
                        </svg>
                        Use &quot;Submit &amp; Close&quot; only when all entries prior to sailing are complete.
                      </div>
                      <div className={styles.gprlFooterActions}>
                        <Button
                          type="button"
                          variant="saveOutline"
                          label="Submit"
                          onClick={() => handleSubmit(1)}
                          disabled={saving}
                        />
                        <Button
                          type="button"
                          variant="submit"
                          label="Submit & Close"
                          onClick={() => handleSubmit(2)}
                          disabled={saving}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className={styles.lockedNote}>This SOF was closed and is read-only.</p>
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

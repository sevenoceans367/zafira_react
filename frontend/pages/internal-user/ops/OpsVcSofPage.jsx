import React, { useEffect, useMemo, useRef, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AttachmentDropzone,
  Button,
  CardSelect,
  DmyDateInput,
  LoadingOverlay,
  RowActions,
  RowAddButton,
  RowDelButton,
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath, attachmentUrl } from '@bainbridge/shared-routing';
import { fetchSofForm, saveSof } from '../../../services/opsVc.js';
import OpsVcSofHeaderActions from './OpsVcSofHeaderActions.jsx';
import OpsVcSofLegacyPage from './OpsVcSofLegacyPage.jsx';
import { getFixtureTypeLabel } from '../sopf/estimateDetail.constants.js';
import VoyageOpsHeading from './VoyageOpsHeading.jsx';
import { PortTabLabel } from './portTabLabel.jsx';
import { recomputePortDraft } from './laytimeCalculations.js';
import {
  DEFAULT_SOF_ROW_SIZE,
  SOF_ROW_SIZE_OPTIONS,
  buildSofSavePayload,
  computeActivityDurationHours,
  displayStoredFileName,
  draftFromPort,
  emptyKeyOp,
  emptyDeductionRow,
  emptyPortActivityRow,
  getCargoCardValues,
  isBlankKeyOp,
  insertDeductionRowAfter,
  isValidLtPartialPercent,
  pageForIndex,
  paginateRows,
  patchCargoCardField,
  removeDeductionRowAt,
} from './sofTankerHelpers.js';
import pageStyles from './OpsPages.module.css';
import styles from './OpsVcSofTanker.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

const FLASH = {
  0: { type: 'success', text: 'SOF added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! this SOF already exists for this port.' },
};

const RO_AUTO_FETCH_TITLE = 'Auto-fetch source not yet wired to SOF persistence.';
const DEDUCTIONS_LOCKED_TITLE = 'This Laytime record is closed. Reopen it in Laytime to edit deductions.';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PortTypeIcon({ portType }) {
  if (portType === 'DP') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 21V9" />
        <path d="M17 14l-5-5-5 5" />
        <path d="M4 5h16" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18" />
      <path d="M8 2.5v4" />
      <path d="M16 2.5v4" />
    </svg>
  );
}

function RangeArrowIcon() {
  return (
    <svg className={styles.dtRangeArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function recomputeSofActivityRows(port, rows) {
  const calculation = recomputePortDraft({
    laytimeAllowed: port?.laytimeAllowed || '',
    activities: rows.map((row) => ({
      activity: row.activity,
      start: '',
      end: '',
      duration: row.duration,
      ltCounts: Boolean(row.layTimeCount),
      ltNoCounts: Boolean(row.portTimeCount),
      ltPartial: row.ltPartial,
      notes: row.notes,
    })),
    deductions: [],
  }, port?.rateUnit || 'days');

  return rows.map((row, rowIndex) => ({
    ...row,
    cumulative: calculation.activities[rowIndex]?.cumulative || '0.0000',
  }));
}

function SofDateField({
  id,
  label,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select date & time',
  title,
}) {
  const hasValue = Boolean(String(value || '').trim());
  return (
    <div
      className={`${styles.sofDateField} ${hasValue ? styles.sofDateFieldHasValue : ''}`}
      title={title}
    >
      <span className={styles.sofDateFieldIco}>
        <CalendarIcon />
      </span>
      <DmyDateInput
        id={id}
        ariaLabel={label}
        enableTime
        strict24Hour
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={styles.sofDateFieldInput}
      />
    </div>
  );
}

/**
 * Statement of Facts (Internal Ops VC — Tanker layout).
 * Single-column flow: Identifiers → Key Operations → Activity (From/To) + Deductions
 * → Cargo → Remarks → Documents & Attachments, with sticky Save/Submit footer.
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
  const [keyOpsSearch, setKeyOpsSearch] = useState('');
  const [keyOpsRowSize, setKeyOpsRowSize] = useState(DEFAULT_SOF_ROW_SIZE);
  const [keyOpsPage, setKeyOpsPage] = useState(1);
  const skipKeyOpsPageResetRef = useRef(false);

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
        const portDraft = draftFromPort(port);
        portDraft.portActivities = recomputeSofActivityRows(port, portDraft.portActivities);
        nextDrafts[port.key] = portDraft;
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

  useEffect(() => {
    setKeyOpsSearch('');
    setKeyOpsPage(1);
  }, [activeKey]);

  useEffect(() => {
    if (skipKeyOpsPageResetRef.current) {
      skipKeyOpsPageResetRef.current = false;
      return;
    }
    setKeyOpsPage(1);
  }, [keyOpsSearch, keyOpsRowSize]);

  const keyOpsRows = draft?.keyOperations || [];
  const keyOpsTerm = keyOpsSearch.trim().toLowerCase();
  const filteredKeyOps = useMemo(() => {
    const indexed = keyOpsRows.map((row, index) => ({ row, index }));
    if (!keyOpsTerm) return indexed;
    return indexed.filter(({ row }) => String(row.activity || '').toLowerCase().includes(keyOpsTerm));
  }, [keyOpsRows, keyOpsTerm]);

  const paginatedKeyOps = useMemo(
    () => paginateRows(filteredKeyOps, keyOpsPage, keyOpsRowSize),
    [filteredKeyOps, keyOpsPage, keyOpsRowSize],
  );

  useEffect(() => {
    if (keyOpsPage !== paginatedKeyOps.safePage) {
      setKeyOpsPage(paginatedKeyOps.safePage);
    }
  }, [keyOpsPage, paginatedKeyOps.safePage]);

  const cargoValues = useMemo(
    () => getCargoCardValues(draft?.cargoRows),
    [draft?.cargoRows],
  );

  const patchDraft = (patch) => {
    setDrafts((current) => ({
      ...current,
      [activeKey]: { ...current[activeKey], ...patch },
    }));
  };

  const updateKeyOpRow = (index, patch) => {
    const rows = [...(draft?.keyOperations || [])];
    rows[index] = { ...rows[index], ...patch };
    patchDraft({ keyOperations: rows });
  };

  const addKeyOperationRow = async () => {
    const rows = draft?.keyOperations || [];
    const blankIndex = rows.findIndex(isBlankKeyOp);
    if (blankIndex >= 0) {
      if (keyOpsSearch) {
        skipKeyOpsPageResetRef.current = true;
        setKeyOpsSearch('');
      }
      setKeyOpsPage(pageForIndex(blankIndex, keyOpsRowSize));
      await alert({
        title: 'Alert',
        message: 'Please fill in the Key Operation name on the empty row before adding another.',
      });
      return;
    }

    const next = [...rows, emptyKeyOp()];
    const lastPage = Math.max(1, Math.ceil(next.length / keyOpsRowSize));
    if (keyOpsSearch) {
      skipKeyOpsPageResetRef.current = true;
      setKeyOpsSearch('');
    }
    patchDraft({ keyOperations: next });
    setKeyOpsPage(lastPage);
  };

  const removeKeyOpRow = async (index) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to delete this entry permanently?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    const rows = (draft?.keyOperations || []).filter((_, i) => i !== index);
    patchDraft({ keyOperations: rows });
  };

  const updatePortActivityRow = (index, patch) => {
    const rows = [...(draft?.portActivities || [])];
    const nextRow = { ...rows[index], ...patch };
    if ('from' in patch || 'to' in patch) {
      nextRow.duration = computeActivityDurationHours(nextRow.from, nextRow.to);
    }
    rows[index] = nextRow;
    patchDraft({ portActivities: recomputeSofActivityRows(activePort, rows) });
  };

  const insertPortActivityAfter = (index) => {
    const rows = [...(draft?.portActivities || [])];
    rows.splice(index + 1, 0, emptyPortActivityRow());
    patchDraft({ portActivities: rows });
  };

  const removePortActivityRow = async (index) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to delete this entry permanently?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    const rows = (draft?.portActivities || []).filter((_, i) => i !== index);
    patchDraft({ portActivities: rows.length ? rows : [emptyPortActivityRow()] });
  };

  const updateDeductionRow = (index, patch) => {
    const rows = [...(draft?.deductions || [])];
    rows[index] = { ...rows[index], ...patch };
    const recomputed = recomputePortDraft({ ...draft, deductions: rows }, form?.rateUnit || 'days');
    patchDraft({ deductions: recomputed.deductions });
  };

  const addDeductionAfter = (index) => {
    const rows = insertDeductionRowAfter(draft?.deductions || [], index);
    patchDraft({ deductions: rows });
  };

  const removeDeductionRow = async (index) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to delete this deduction permanently?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    const next = removeDeductionRowAt(draft?.deductions || [], index);
    const recomputed = recomputePortDraft({ ...draft, deductions: next }, form?.rateUnit || 'days');
    patchDraft({ deductions: recomputed.deductions });
  };

  const updateCargoField = (field, value) => {
    patchDraft({
      cargoRows: patchCargoCardField(draft?.cargoRows, field, value),
    });
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

    const ok = await confirm({
      title: 'Confirmation',
      message: submitId === 2
        ? 'Are you sure all entries prior to sailing are made? Submit will lock this SOF.'
        : 'Save this SOF as a draft?',
      confirmLabel: submitId === 2 ? 'Submit' : 'Save',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const payload = buildSofSavePayload({
        comId,
        activePort,
        draft,
        submitId,
      });
      const result = await saveSof(payload, pendingFiles);

      setPendingFilesByKey((current) => ({
        ...current,
        [activeKey]: [],
      }));

      if (result.closed) {
        const sep = backHref.includes('?') ? '&' : '?';
        navigate(`${backHref}${sep}msg=3`);
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

  // The redesigned layout is for tanker SOFs only. Keep the established editor
  // for Dry/Gas records, reusing the form data already fetched above.
  if (!loading && form && Number(form.estimateType) !== 2) {
    return <OpsVcSofLegacyPage initialForm={form} />;
  }

  const cargoSummary = (form?.cargo || []).join(', ') || '—';
  const worksheetHref = comId && form?.costSheetId
    ? appPath(`/internal-user/vc/ops/cost-sheet?comid=${encodeURIComponent(comId)}&cost_sheet_id=${encodeURIComponent(form.costSheetId)}&page=${encodeURIComponent(page || '1')}`)
    : '';
  const portActivities = draft?.portActivities?.length ? draft.portActivities : [emptyPortActivityRow()];
  const deductionRows = draft?.deductions?.length ? draft.deductions : [emptyDeductionRow()];
  const completedDeductions = deductionRows.filter((row) => row.start && row.end);
  const totalDeductionDuration = completedDeductions.reduce((sum, row) => sum + (Number(row.duration) || 0), 0);
  const totalNetDeductionDuration = completedDeductions.reduce((sum, row) => sum + (Number(row.cumulative) || 0), 0);
  const deductionsDisabled = locked || Boolean(activePort?.laytimeLocked);
  const deductionsDisabledTitle = activePort?.laytimeLocked ? DEDUCTIONS_LOCKED_TITLE : undefined;
  const activityDisabled = deductionsDisabled;

  return (
    <>
      <VoyageOpsHeading
        title="SOF"
        contractType={getFixtureTypeLabel(form?.fixtureTypeId)}
        voyageNo={form?.voyageNo || ''}
        vesselName={form?.vesselName || ''}
        worksheetHref={worksheetHref}
      />
      <OpsVcSofHeaderActions
        backHref={backHref}
        disabled={loading || saving}
      />

      <div className={`zafira-page ${pageStyles.page} ${styles.page}`}>
        {(loading || saving) ? <LoadingOverlay active label={saving ? 'Saving SOF…' : 'Loading SOF…'} /> : null}
        {flash ? (
          <div className={flash.type === 'error' ? styles.error : styles.flashSuccess}>{flash.text}</div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        {!loading && !form?.ports?.length ? (
          <div className={styles.empty}>
            No load/discharge/transit ports found on the cost sheet for SOF.
          </div>
        ) : null}

        {form?.ports?.length ? (
          <>
            <div className={styles.portTabs} role="group" aria-label="SOF port calls">
              {form.ports.map((port) => {
                const isActive = port.key === activeKey;
                const icoTone = port.portType === 'DP' ? styles.ptIcoDp : styles.ptIcoLp;
                return (
                  <button
                    key={port.key}
                    type="button"
                    className={isActive ? `${styles.portTab} ${styles.portTabActive}` : styles.portTab}
                    onClick={() => setActiveKey(port.key)}
                    aria-pressed={isActive}
                  >
                    <span className={`${styles.ptIco} ${icoTone}`}>
                      <PortTypeIcon portType={port.portType} />
                    </span>
                    <PortTabLabel label={port.tabLabel} />
                  </button>
                );
              })}
            </div>

            {activePort && draft ? (
              <>
                <div className={styles.sofMain}>
                  {/* ============ IDENTIFIERS ============ */}
                  <div className={styles.cfSection}>
                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadNavy}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoNavy}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="4" y="3" width="16" height="18" rx="2" />
                            <path d="M8 7h8" />
                            <path d="M8 11h8" />
                            <path d="M8 15h5" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.cfSectionTitle}>Identifiers</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.pcGrid}>
                      <div className={styles.pcCell}>
                        <span className={styles.pcLabel}>Vessel</span>
                        <span className={styles.pcVal}>{form.vesselName || '—'}</span>
                      </div>
                      <div className={styles.pcCell}>
                        <span className={styles.pcLabel}>Port</span>
                        <span className={styles.pcVal}>{activePort.portName || '—'}</span>
                      </div>
                      <div className={styles.pcCell}>
                        <span className={styles.pcLabel}>Voyage</span>
                        <span className={styles.pcVal}>{form.voyageNo || '—'}</span>
                      </div>
                      <div className={styles.pcCell}>
                        <span className={styles.pcLabel}>Operation</span>
                        <span className={styles.pcVal}>{activePort.operation || '—'}</span>
                      </div>
                      <div className={styles.pcCell}>
                        <span className={styles.pcLabel}>Cargo</span>
                        <span className={styles.pcVal}>{cargoSummary}</span>
                      </div>
                      <div className={styles.pcCell}>
                        <span className={styles.pcLabel}>Berth</span>
                        <input
                          type="text"
                          className={styles.pcBerthInput}
                          value={draft.terminal}
                          onChange={(e) => patchDraft({ terminal: e.target.value })}
                          disabled={locked}
                          placeholder="Jetty"
                          aria-label="Berth"
                        />
                      </div>
                    </div>

                    <div className={styles.idSubGrid}>
                      <div className={styles.idSubCell}>
                        <span className={styles.idSubLabel}>ROB VLSFO</span>
                        <span className={`${styles.roBox} ${styles.roBoxMuted}`} title={RO_AUTO_FETCH_TITLE}>—</span>
                      </div>
                      <div className={styles.idSubCell}>
                        <span className={styles.idSubLabel}>ROB LSMGO</span>
                        <span className={`${styles.roBox} ${styles.roBoxMuted}`} title={RO_AUTO_FETCH_TITLE}>—</span>
                      </div>
                      <div className={styles.idSubCell}>
                        <span className={styles.idSubLabel}>Draft Arr. (Fore / Aft)</span>
                        <span className={`${styles.roBox} ${styles.roBoxMuted}`} title={RO_AUTO_FETCH_TITLE}>—</span>
                      </div>
                      <div className={styles.idSubCell}>
                        <span className={styles.idSubLabel}>Draft Dep. (Fore / Aft)</span>
                        <span className={`${styles.roBox} ${styles.roBoxMuted}`} title={RO_AUTO_FETCH_TITLE}>—</span>
                      </div>
                    </div>
                  </div>

                  {/* ============ KEY OPERATIONS ============ */}
                  <div className={styles.cfSection}>
                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadOrange}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoOrange}`}>
                          <CalendarIcon />
                        </div>
                        <div>
                          <div className={styles.cfSectionTitle}>Key Operations</div>
                          <div className={styles.cfSectionSub}>Log each event as it happens</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.koToolbar}>
                      <div className={styles.searchBox}>
                        <SearchIcon />
                        <input
                          type="text"
                          value={keyOpsSearch}
                          onChange={(e) => setKeyOpsSearch(e.target.value)}
                          placeholder="Search"
                          aria-label="Search key operations"
                        />
                      </div>
                      <div className={styles.koToolbarRight}>
                        <div className={styles.koShowWrap}>
                          <span>Show</span>
                          <CardSelect
                            options={SOF_ROW_SIZE_OPTIONS.map((size) => ({ value: size, label: String(size) }))}
                            value={String(keyOpsRowSize)}
                            onChange={(value) => setKeyOpsRowSize(Number(value))}
                            ariaLabel="Key operations rows per page"
                          />
                        </div>
                        <div className={styles.koPager}>
                          <button
                            type="button"
                            className={styles.pagerBtn}
                            disabled={paginatedKeyOps.safePage <= 1}
                            onClick={() => setKeyOpsPage(paginatedKeyOps.safePage - 1)}
                            aria-label="Previous key operations page"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M15 6l-6 6 6 6" />
                            </svg>
                          </button>
                          <span className={styles.pagerChip}>
                            {paginatedKeyOps.safePage} / {paginatedKeyOps.totalPages}
                          </span>
                          <button
                            type="button"
                            className={styles.pagerBtn}
                            disabled={paginatedKeyOps.safePage >= paginatedKeyOps.totalPages}
                            onClick={() => setKeyOpsPage(paginatedKeyOps.safePage + 1)}
                            aria-label="Next key operations page"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          </button>
                        </div>
                        <span className={styles.koCount}>
                          {paginatedKeyOps.items.length} of {filteredKeyOps.length} shown
                        </span>
                      </div>
                    </div>

                    <div className={styles.tableWrap}>
                      <table className={styles.cfTable}>
                        <thead>
                          <tr>
                            <th style={{ width: 34 }} />
                            <th>Key Operation</th>
                            <th>Date / Time</th>
                            <th>ROB IFO</th>
                            <th>ROB MDO</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedKeyOps.items.length ? paginatedKeyOps.items.map(({ row, index }) => (
                            <tr key={`kop-${index}`}>
                              <td style={{ width: 34 }}>
                                {!locked ? (
                                  <RowDelButton
                                    title="Remove row"
                                    onClick={() => removeKeyOpRow(index)}
                                  />
                                ) : null}
                              </td>
                              <td className={styles.opNameCol}>
                                {Number(row.tDefault) === 1 ? (
                                  <span className={styles.opBadge}>{row.activity || '—'}</span>
                                ) : (
                                  <input
                                    className={styles.cfInp}
                                    type="text"
                                    value={row.activity}
                                    onChange={(e) => updateKeyOpRow(index, { activity: e.target.value })}
                                    disabled={locked}
                                    placeholder="New operation / delay"
                                    aria-label={`Key operation name, row ${index + 1}`}
                                  />
                                )}
                              </td>
                              <td className={styles.koDateCol}>
                                <div className={styles.dtRangeBox}>
                                  <SofDateField
                                    id={`sof-key-op-from-${activeKey}-${index}`}
                                    label={`Key operation start date and time, row ${index + 1}`}
                                    value={row.activityDateTime || ''}
                                    onChange={(v) => updateKeyOpRow(index, { activityDateTime: v })}
                                    disabled={locked}
                                    placeholder="Select date & time"
                                  />
                                  <RangeArrowIcon />
                                  <SofDateField
                                    id={`sof-key-op-to-${activeKey}-${index}`}
                                    label={`Key operation finish date and time, row ${index + 1}`}
                                    value={row.activityDateTimeTo || ''}
                                    onChange={(v) => updateKeyOpRow(index, { activityDateTimeTo: v })}
                                    disabled={locked}
                                    placeholder="Select date & time"
                                  />
                                </div>
                              </td>
                              <td>
                                <input
                                  className={styles.cfInp}
                                  type="text"
                                  inputMode="decimal"
                                  value={row.robIfo ?? ''}
                                  onChange={(e) => updateKeyOpRow(index, { robIfo: e.target.value })}
                                  disabled={locked}
                                  placeholder="0.00"
                                  aria-label={`ROB IFO, row ${index + 1}`}
                                />
                              </td>
                              <td>
                                <input
                                  className={styles.cfInp}
                                  type="text"
                                  inputMode="decimal"
                                  value={row.robMdo ?? ''}
                                  onChange={(e) => updateKeyOpRow(index, { robMdo: e.target.value })}
                                  disabled={locked}
                                  placeholder="0.00"
                                  aria-label={`ROB MDO, row ${index + 1}`}
                                />
                              </td>
                              <td>
                                <textarea
                                  className={styles.koNotes}
                                  value={row.comments || ''}
                                  onChange={(e) => updateKeyOpRow(index, { comments: e.target.value })}
                                  disabled={locked}
                                  placeholder="Notes"
                                  aria-label={`Key operation notes, row ${index + 1}`}
                                />
                              </td>
                            </tr>
                          )) : (
                            <tr className={styles.emptyTableRow}>
                              <td colSpan={6}>No key operations match your search.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {!locked ? (
                      <div className={styles.koFooter}>
                        <button
                          type="button"
                          className={styles.btnAddRowBlue}
                          onClick={addKeyOperationRow}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 5v14" />
                            <path d="M5 12h14" />
                          </svg>
                          Add
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* ============ ACTIVITY (FROM/TO) + DEDUCTIONS ============ */}
                  <div className={styles.cfSection}>
                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadTeal}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoTeal}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3.5 2" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.cfSectionTitle}>Activity (From/To)</div>
                          <div className={styles.cfSectionSub}>Laytime-counting activity for this port call</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.tableWrap}>
                      <table className={styles.cfTable}>
                        <thead>
                          <tr>
                            <th style={{ width: 62 }} />
                            <th>Activity in Port</th>
                            <th>Date / Time – Start</th>
                            <th>Date / Time – Finish</th>
                            <th>Duration (Hrs)</th>
                            <th>LT (C)</th>
                            <th>LT (NC)</th>
                            <th>LT (Partial %)</th>
                            <th>Cumulative Duration (Hrs)</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portActivities.map((row, index) => (
                            <tr key={`act-${index}`}>
                              <td>
                                <RowActions>
                                  <RowAddButton
                                    title="Add row"
                                    disabled={activityDisabled}
                                    onClick={() => insertPortActivityAfter(index)}
                                  />
                                  <RowDelButton
                                    title="Remove row"
                                    disabled={activityDisabled}
                                    onClick={() => removePortActivityRow(index)}
                                  />
                                </RowActions>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={styles.cfInp}
                                  value={row.activity}
                                  onChange={(e) => updatePortActivityRow(index, { activity: e.target.value })}
                                  disabled={activityDisabled}
                                  placeholder="Activity in port"
                                  aria-label={`Activity in port, row ${index + 1}`}
                                />
                              </td>
                              <td>
                                <SofDateField
                                  id={`sof-port-activity-from-${activeKey}-${index}`}
                                  label={`Activity start date and time, row ${index + 1}`}
                                  value={row.from}
                                  onChange={(v) => updatePortActivityRow(index, { from: v })}
                                  disabled={activityDisabled}
                                  placeholder="Select date & time"
                                />
                              </td>
                              <td>
                                <SofDateField
                                  id={`sof-port-activity-to-${activeKey}-${index}`}
                                  label={`Activity finish date and time, row ${index + 1}`}
                                  value={row.to}
                                  onChange={(v) => updatePortActivityRow(index, { to: v })}
                                  disabled={activityDisabled}
                                  placeholder="Select date & time"
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={`${styles.cfInp} ${styles.numSm}`}
                                  value={row.duration || '—'}
                                  placeholder="Auto"
                                  readOnly
                                  aria-label={`Activity duration hours, row ${index + 1}`}
                                />
                              </td>
                              <td className={styles.chkCell}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(row.layTimeCount)}
                                  onChange={(e) => updatePortActivityRow(index, { layTimeCount: e.target.checked })}
                                  disabled={activityDisabled}
                                  aria-label={`LT (C), row ${index + 1}`}
                                />
                              </td>
                              <td className={styles.chkCell}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(row.portTimeCount)}
                                  onChange={(e) => updatePortActivityRow(index, { portTimeCount: e.target.checked })}
                                  disabled={activityDisabled}
                                  aria-label={`LT (NC), row ${index + 1}`}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  className={`${styles.cfInp} ${styles.numSm}`}
                                  value={row.ltPartial ?? ''}
                                  placeholder="0"
                                  onChange={(e) => {
                                    if (isValidLtPartialPercent(e.target.value)) {
                                      updatePortActivityRow(index, { ltPartial: e.target.value });
                                    }
                                  }}
                                  disabled={activityDisabled}
                                  title={deductionsDisabledTitle}
                                  aria-label={`LT (Partial %), row ${index + 1}`}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={`${styles.cfInp} ${styles.numSm} ${styles.cumRo}`}
                                  value={row.cumulative || '0.0000'}
                                  readOnly
                                  aria-label={`Cumulative duration hours, row ${index + 1}`}
                                />
                              </td>
                              <td>
                                <textarea
                                  className={styles.ltNotesSm}
                                  value={row.notes}
                                  onChange={(e) => updatePortActivityRow(index, { notes: e.target.value })}
                                  disabled={activityDisabled}
                                  placeholder="Notes"
                                  aria-label={`Activity notes, row ${index + 1}`}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadOrange} ${styles.subBanner}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoOrange}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M8 12h8" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.cfSectionTitle}>Deductions</div>
                          <div className={styles.cfSectionSub}>Time excluded from laytime counting</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.tableWrap}>
                      <table className={styles.cfTable}>
                        <thead>
                          <tr>
                            <th style={{ width: 62 }} />
                            <th>Activity in Port</th>
                            <th>Date / Time – Start</th>
                            <th>Date / Time – Finish</th>
                            <th>Duration (Hrs)</th>
                            <th>LT (Partial %)</th>
                            <th>Net Duration (Hrs)</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deductionRows.map((row, index) => (
                            <tr key={`ded-${activeKey}-${index}`}>
                              <td>
                                <RowActions>
                                  <RowAddButton
                                    title="Add deduction row"
                                    aria-label="Add deduction row"
                                    onClick={() => addDeductionAfter(index)}
                                    disabled={deductionsDisabled}
                                  />
                                  <RowDelButton
                                    title="Remove deduction row"
                                    aria-label="Remove deduction row"
                                    onClick={() => removeDeductionRow(index)}
                                    disabled={deductionsDisabled}
                                  />
                                </RowActions>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={styles.cfInp}
                                  value={row.activity || ''}
                                  onChange={(e) => updateDeductionRow(index, { activity: e.target.value })}
                                  placeholder="Activity in port"
                                  disabled={deductionsDisabled}
                                  title={deductionsDisabledTitle}
                                  aria-label={`Deduction activity, row ${index + 1}`}
                                />
                              </td>
                              <td>
                                <SofDateField
                                  label={`Deduction start date and time, row ${index + 1}`}
                                  value={row.start || ''}
                                  onChange={(value) => updateDeductionRow(index, { start: value })}
                                  disabled={deductionsDisabled}
                                  placeholder="Select date & time"
                                  title={deductionsDisabledTitle}
                                />
                              </td>
                              <td>
                                <SofDateField
                                  label={`Deduction finish date and time, row ${index + 1}`}
                                  value={row.end || ''}
                                  onChange={(value) => updateDeductionRow(index, { end: value })}
                                  disabled={deductionsDisabled}
                                  placeholder="Select date & time"
                                  title={deductionsDisabledTitle}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={`${styles.cfInp} ${styles.numSm}`}
                                  value={row.start && row.end ? row.duration || '0.0' : '—'}
                                  placeholder="Auto"
                                  readOnly
                                  disabled={deductionsDisabled}
                                  title={deductionsDisabledTitle}
                                  aria-label={`Deduction duration hours, row ${index + 1}`}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  className={`${styles.cfInp} ${styles.numSm}`}
                                  value={row.ltPartial ?? ''}
                                  onChange={(e) => updateDeductionRow(index, { ltPartial: e.target.value })}
                                  placeholder="100"
                                  disabled={deductionsDisabled}
                                  title={deductionsDisabledTitle}
                                  aria-label={`Deduction partial percent, row ${index + 1}`}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={`${styles.cfInp} ${styles.numSm} ${styles.cumRo}`}
                                  value={row.start && row.end ? row.cumulative || '0.0000' : '—'}
                                  readOnly
                                  disabled={deductionsDisabled}
                                  title={deductionsDisabledTitle}
                                  aria-label={`Deduction net duration hours, row ${index + 1}`}
                                />
                              </td>
                              <td>
                                <textarea
                                  className={styles.ltNotesSm}
                                  value={row.notes || ''}
                                  onChange={(e) => updateDeductionRow(index, { notes: e.target.value })}
                                  placeholder="Notes"
                                  disabled={deductionsDisabled}
                                  title={deductionsDisabledTitle}
                                  aria-label={`Deduction notes, row ${index + 1}`}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className={styles.totalsRow}>
                            <td colSpan={4} style={{ textAlign: 'right' }}>Total</td>
                            <td>
                              <input
                                type="text"
                                className={styles.totalsRowInput}
                                value={completedDeductions.length ? totalDeductionDuration.toFixed(4) : '—'}
                                readOnly
                                aria-label="Total deduction duration"
                              />
                            </td>
                            <td />
                            <td>
                              <input
                                type="text"
                                className={styles.totalsRowInput}
                                value={completedDeductions.length ? totalNetDeductionDuration.toFixed(4) : '—'}
                                readOnly
                                aria-label="Total net deduction duration"
                              />
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* ============ CARGO ============ */}
                  <div className={styles.cfSection}>
                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadBlue}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoBlue}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <path d="M3.3 7 12 12l8.7-5" />
                            <path d="M12 22V12" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.cfSectionTitle}>Cargo</div>
                          <div className={styles.cfSectionSub}>Figures and letters of protest for this port call</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cargoGrid}>
                      <div className={styles.cargoCell}>
                        <label className={styles.cargoCellLabel} htmlFor="sof-ship-fig">Ship&rsquo;s Fig (MT)</label>
                        <input
                          id="sof-ship-fig"
                          type="text"
                          inputMode="decimal"
                          className={styles.cfNumInp}
                          value={cargoValues.shipFigure}
                          onChange={(e) => updateCargoField('shipFigure', e.target.value)}
                          disabled={locked}
                          placeholder="Numeric entry"
                        />
                      </div>
                      <div className={styles.cargoCell}>
                        <label className={styles.cargoCellLabel} htmlFor="sof-bl-fig">B/L Fig (MT)</label>
                        <input
                          id="sof-bl-fig"
                          type="text"
                          inputMode="decimal"
                          className={styles.cfNumInp}
                          value={cargoValues.blFigure}
                          onChange={(e) => updateCargoField('blFigure', e.target.value)}
                          disabled={locked}
                          placeholder="Numeric entry"
                        />
                      </div>
                      <div className={`${styles.cargoCell} ${styles.cargoCellLop}`}>
                        <label className={styles.cargoCellLabel} htmlFor="sof-lop-issued">LOPs Issued</label>
                        <input
                          id="sof-lop-issued"
                          type="text"
                          className={styles.cfTextInp}
                          value={cargoValues.lopIssued}
                          onChange={(e) => updateCargoField('lopIssued', e.target.value)}
                          disabled={locked}
                          placeholder="Text"
                        />
                      </div>
                      <div className={`${styles.cargoCell} ${styles.cargoCellLop}`}>
                        <label className={styles.cargoCellLabel} htmlFor="sof-lop-received">LOPs Received</label>
                        <input
                          id="sof-lop-received"
                          type="text"
                          className={styles.cfTextInp}
                          value={cargoValues.lopReceived}
                          onChange={(e) => updateCargoField('lopReceived', e.target.value)}
                          disabled={locked}
                          placeholder="Text"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ============ REMARKS ============ */}
                  <div className={styles.cfSection}>
                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadGrey}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoGrey}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.cfSectionTitle}>Remarks</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.remarksBody}>
                      <textarea
                        className={styles.remarksBox}
                        value={draft.agentRemarks}
                        onChange={(e) => patchDraft({ agentRemarks: e.target.value })}
                        disabled={locked}
                        placeholder="Additional remarks for this port call…"
                        aria-label="Remarks"
                      />
                    </div>
                  </div>

                  {/* ============ DOCUMENTS & ATTACHMENTS ============ */}
                  <div className={styles.cfSection}>
                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadFieldGrey}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoNavy}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                            <path d="M9 13h6" />
                            <path d="M9 17h6" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.cfSectionTitle}>Documents &amp; Attachments</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.docsBody}>
                      <AttachmentDropzone
                        readOnly={locked}
                        files={pendingFiles}
                        existing={(draft.keepFiles || []).map((file) => ({
                          key: file,
                          file,
                          name: displayStoredFileName(file),
                          url: attachmentUrl(file),
                        }))}
                        onAddFiles={addPendingFiles}
                        onRemoveFile={removePendingFile}
                        onRemoveExisting={(item) => patchDraft({
                          keepFiles: (draft.keepFiles || []).filter((name) => name !== item.file),
                        })}
                        emptyLabel="No documents uploaded yet."
                      />
                    </div>
                  </div>
                </div>

                {/* ============ STICKY FOOTER BAR ============ */}
                <div className={styles.sofFooterBar}>
                  {!locked ? (
                    <>
                      <div className={styles.sofFooterNote}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 9v4" />
                          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <path d="M12 17h.01" />
                        </svg>
                        Use &ldquo;Submit&rdquo; only when all entries prior to sailing are complete.
                      </div>
                      <div className={styles.sofFooterActions}>
                        <Button
                          type="button"
                          variant="saveOutline"
                          label="Save"
                          onClick={() => handleSubmit(1)}
                          disabled={saving}
                        />
                        <Button
                          type="button"
                          variant="submit"
                          label="Submit"
                          onClick={() => handleSubmit(2)}
                          disabled={saving}
                        />
                      </div>
                    </>
                  ) : (
                    <p className={styles.lockedNote}>This SOF has been closed. It is now read-only.</p>
                  )}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}

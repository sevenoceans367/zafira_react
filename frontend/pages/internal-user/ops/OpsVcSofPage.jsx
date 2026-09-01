import React, { useEffect, useMemo, useRef, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DmyDateInput,
  DownloadIcon,
  LoadingOverlay,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath, attachmentUrl } from '@bainbridge/shared-routing';
import { fetchSofForm, saveSof } from '../../../services/opsVc.js';
import OpsVcSofHeaderActions from './OpsVcSofHeaderActions.jsx';
import styles from './OpsVcSofPage.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

const FLASH = {
  0: { type: 'success', text: 'SOF added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! this SOF already exists for this port.' },
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

function SofInfoPopup() {
  return (
    <div className={styles.infoPop}>
      <div className={styles.infoPopTitle}>How this page works</div>
      <ol className={styles.infoPopSteps}>
        <li>Fill in the port header and <b>Key Operations</b> with From/To datetimes as events occur.</li>
        <li>Complete <b>Cargo / Figures</b> where applicable.</li>
        <li><b>Save</b> keeps a draft you can return to.</li>
        <li><b>Submit</b> locks the SOF once all entries prior to sailing are complete.</li>
        <li>Key Operations with From and To feed Laytime activities; timestamps also seed Laytime header fields.</li>
      </ol>
    </div>
  );
}

function AddRowButton({ onClick, disabled, label = 'Add' }) {
  if (disabled) return null;
  return (
    <button type="button" className={styles.addRowBtn} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
      {label}
    </button>
  );
}

function CircleDeleteButton({ onClick, disabled }) {
  if (disabled) return null;
  return (
    <button
      type="button"
      className={`${styles.circleBtn} ${styles.circleBtnDel}`}
      title="Remove row"
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M18 6 6 18" />
        <path d="M6 6l12 12" />
      </svg>
    </button>
  );
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

function isDraftCargoActivity(activity) {
  const name = String(activity || '').toLowerCase();
  return name === 'arrival draft' || name === 'departure draft';
}

function cargoActivityLabel(activity, portType) {
  if (activity === 'Cargo Loaded' && portType === 'DP') return 'Cargo Discharged';
  return activity || '';
}

function cargoFigureLabels(activity) {
  const name = String(activity || '');
  if (name === 'Cargo Loaded') return { col1: "Ship's Figures", col2: 'B/L Figures' };
  if (name === 'Bunkers taken' || name === 'Bunkers Taken') return { col1: 'IFO', col2: 'MDO' };
  return { col1: 'F', col2: 'A' };
}

function emptyKeyOp() {
  return {
    activity: '',
    activityDateTime: '',
    activityDateTimeTo: '',
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

function displayStoredFileName(stored) {
  const raw = String(stored || '').trim();
  const match = raw.match(/^\d+_(.+)$/);
  return match ? match[1] : raw;
}

function attachmentHref(stored) {
  return attachmentUrl(stored);
}

function draftFromPort(port) {
  return {
    terminal: port.terminal || '',
    keyOperations: (port.keyOperations || []).map((row) => ({ ...row })),
    cargoRows: (port.cargoRows || []).map((row) => ({ ...row })),
    keepFiles: [...(port.uploads || [])],
  };
}

/**
 * PHP sof.php — Statement of Facts (Ops VC).
 * Header summary, key operations (From/To), cargo figures, and documents.
 */
export default function OpsVcSofPage() {
  const confirm = useConfirm();
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
  const [dropActive, setDropActive] = useState(false);
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

  useEffect(() => {
    setKeyOpsSearch('');
  }, [activeKey]);

  const keyOpsRows = draft?.keyOperations || [];
  const keyOpsTerm = keyOpsSearch.trim().toLowerCase();
  const filteredKeyOps = useMemo(() => {
    if (!keyOpsTerm) {
      return keyOpsRows.map((row, index) => ({ row, index }));
    }
    return keyOpsRows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => String(row.activity || '').toLowerCase().includes(keyOpsTerm));
  }, [keyOpsRows, keyOpsTerm]);

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
      const result = await saveSof({
        comId,
        portType: activePort.portType,
        portId: activePort.portId,
        randomId: activePort.randomId,
        submitId,
        terminal: draft.terminal,
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

  const cargoSummary = (form?.cargo || []).join(', ') || '—';
  const voyLabelParts = [form?.voyageNo, form?.vesselName].filter(Boolean);
  const docCount = (draft?.keepFiles?.length || 0) + pendingFiles.length;

  return (
    <>
      <OpsVcSofHeaderActions
        backHref={backHref}
        disabled={loading || saving}
      />

      <div className={`zafira-page ${styles.page}`}>
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
            <div className={styles.pageSubhead}>
              Port operations log and cargo figures for this voyage
              <span className={styles.tagSoft}>SOF</span>
            </div>

            {voyLabelParts.length ? (
              <div className={styles.voyChip}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="5" r="2.2" />
                  <path d="M12 7.2V21" />
                  <path d="M8 10h8" />
                  <path d="M4 13a8 8 0 0 0 16 0" />
                </svg>
                {form.voyageNo || '—'}
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
                  <div className={styles.cfSection}>
                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadNavy}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div
                          className={`${styles.sectionIco} ${styles.sectionIcoNavy} ${styles.infoTrigger}`}
                          tabIndex={0}
                        >
                          <InfoIcon />
                          <SofInfoPopup />
                        </div>
                        <div>
                          <div className={styles.cfSectionTitle}>Port Call</div>
                          <div className={styles.cfSectionSub}>Vessel, voyage and terminal details</div>
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
                        <span className={styles.pcLabel}>Terminal</span>
                        <input
                          type="text"
                          value={draft.terminal}
                          onChange={(e) => patchDraft({ terminal: e.target.value })}
                          disabled={locked}
                          placeholder="Enter terminal here"
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.cfSection}>
                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadOrange}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoOrange}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="6" y="3.5" width="12" height="17" rx="2" />
                            <path d="M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" />
                            <path d="M9 12.5l2 2 4-4.5" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.cfSectionTitle}>Key Operations</div>
                          <div className={styles.cfSectionSub}>Log each event as it happens</div>
                        </div>
                      </div>
                      <div className={styles.cfFilterWrap}>
                        <div className={styles.cfFilterBox}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <circle cx="11" cy="11" r="7" />
                            <path d="m21 21-4.3-4.3" />
                          </svg>
                          <input
                            type="text"
                            value={keyOpsSearch}
                            onChange={(e) => setKeyOpsSearch(e.target.value)}
                            placeholder="Search"
                          />
                        </div>
                        <span className={styles.cfFilterCount}>
                          {filteredKeyOps.length} of {keyOpsRows.length} shown
                        </span>
                      </div>
                    </div>
                    <div className={styles.tableWrap}>
                      <table className={styles.cfTable}>
                        <thead>
                          <tr>
                            <th style={{ width: 34 }} />
                            <th>Key Operation</th>
                            <th>Date/Time From</th>
                            <th>Date/Time To</th>
                            <th colSpan={2}>Comments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredKeyOps.map(({ row, index }) => (
                            <tr key={`kop-${index}`}>
                              <td style={{ width: 34 }}>
                                <CircleDeleteButton
                                  disabled={locked}
                                  onClick={() => removeListRow('keyOperations', index, emptyKeyOp, false)}
                                />
                              </td>
                              <td className={styles.opName}>
                                {Number(row.tDefault) === 1 ? (
                                  row.activity || '—'
                                ) : (
                                  <input
                                    className={styles.cfInp}
                                    type="text"
                                    value={row.activity}
                                    onChange={(e) => updateListRow('keyOperations', index, { activity: e.target.value })}
                                    disabled={locked}
                                    placeholder="Enter text here……"
                                  />
                                )}
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
                                <DmyDateInput
                                  enableTime
                                  value={row.activityDateTimeTo || ''}
                                  onChange={(v) => updateListRow('keyOperations', index, { activityDateTimeTo: v })}
                                  disabled={locked}
                                />
                              </td>
                              {isRobActivity(row.activity) ? (
                                <td colSpan={2}>
                                  <div className={styles.cfRobPair}>
                                    <div className={styles.cfRob}>
                                      <label>ROB IFO</label>
                                      <input
                                        className={styles.cfInp}
                                        type="text"
                                        value={row.robIfo}
                                        onChange={(e) => updateListRow('keyOperations', index, { robIfo: e.target.value })}
                                        disabled={locked}
                                        placeholder="0.00"
                                      />
                                    </div>
                                    <div className={styles.cfRob}>
                                      <label>ROB MDO</label>
                                      <input
                                        className={styles.cfInp}
                                        type="text"
                                        value={row.robMdo}
                                        onChange={(e) => updateListRow('keyOperations', index, { robMdo: e.target.value })}
                                        disabled={locked}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                </td>
                              ) : (
                                <td colSpan={2}>
                                  <input
                                    className={styles.cfInp}
                                    type="text"
                                    value={row.comments}
                                    onChange={(e) => updateListRow('keyOperations', index, { comments: e.target.value })}
                                    disabled={locked}
                                    placeholder="Comments"
                                  />
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.tableFooter}>
                      <AddRowButton
                        label="Add Key Operation"
                        onClick={() => addListRow('keyOperations', emptyKeyOp)}
                        disabled={locked}
                      />
                    </div>
                  </div>

                  <div className={styles.cfSection}>
                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadTeal}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoTeal}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M12 2s6 6.9 6 11.2A6 6 0 0 1 6 13.2C6 8.9 12 2 12 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className={styles.cfSectionTitle}>Cargo / Figures</div>
                          <div className={styles.cfSectionSub}>Quantities, drafts and remarks for this port</div>
                        </div>
                      </div>
                    </div>
                    <div className={styles.tableWrap}>
                      <table className={styles.cfTable}>
                        <tbody>
                          {(draft.cargoRows || []).map((row, index) => {
                            const labels = cargoFigureLabels(row.activity);
                            const activityLabel = cargoActivityLabel(row.activity, activePort.portType);
                            return (
                              <tr key={`cargo-${index}`}>
                                <td style={{ width: 34 }}>
                                  <CircleDeleteButton
                                    disabled={locked}
                                    onClick={() => removeListRow('cargoRows', index, emptyCargoRow, false)}
                                  />
                                </td>
                                <td className={styles.cffRowLabel}>
                                  {Number(row.tDefault) === 1 ? (
                                    activityLabel || '—'
                                  ) : (
                                    <input
                                      className={styles.cfInp}
                                      type="text"
                                      value={row.activity}
                                      onChange={(e) => updateListRow('cargoRows', index, { activity: e.target.value })}
                                      disabled={locked}
                                      placeholder="Enter text here……"
                                    />
                                  )}
                                </td>
                                {isRemarksCargoActivity(row.activity) ? (
                                  <td colSpan={4}>
                                    <input
                                      className={styles.cfInp}
                                      type="text"
                                      value={row.remarks}
                                      onChange={(e) => updateListRow('cargoRows', index, { remarks: e.target.value })}
                                      disabled={locked}
                                      placeholder="Text here"
                                    />
                                  </td>
                                ) : (
                                  <td colSpan={4}>
                                    <div className={styles.cffPairRow}>
                                      <div className={styles.cffPair}>
                                        <label>{labels.col1}</label>
                                        <input
                                          className={styles.cfInp}
                                          type="text"
                                          value={row.shipFigure}
                                          onChange={(e) => updateListRow('cargoRows', index, { shipFigure: e.target.value })}
                                          disabled={locked}
                                          placeholder="0.00"
                                        />
                                      </div>
                                      <div className={styles.cffPair}>
                                        <label>{labels.col2}</label>
                                        <input
                                          className={styles.cfInp}
                                          type="text"
                                          value={row.blFigure}
                                          onChange={(e) => updateListRow('cargoRows', index, { blFigure: e.target.value })}
                                          disabled={locked}
                                          placeholder="0.00"
                                        />
                                      </div>
                                      {isDraftCargoActivity(row.activity) ? (
                                        <div className={styles.cffPair}>
                                          <label>Water Density</label>
                                          <input
                                            className={styles.cfInp}
                                            type="text"
                                            value={row.waterDensity}
                                            onChange={(e) => updateListRow('cargoRows', index, { waterDensity: e.target.value })}
                                            disabled={locked}
                                            placeholder="0.00"
                                          />
                                        </div>
                                      ) : null}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.tableFooter}>
                      <AddRowButton
                        label="Add Line"
                        onClick={() => addListRow('cargoRows', emptyCargoRow)}
                        disabled={locked}
                      />
                    </div>
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
                      <DownloadIcon />
                      PDF
                    </button>
                  </div>

                  <div className={styles.cfSection}>
                    <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadGrey}`}>
                      <div className={styles.cfSectionTitleWrap}>
                        <div className={`${styles.sectionIco} ${styles.sectionIcoNavy}`} style={{ width: 28, height: 28 }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                        </div>
                        <div className={styles.cfSectionTitle} style={{ fontSize: 13.5 }}>Documents</div>
                        {docCount ? <div className={styles.sideCount}>{docCount}</div> : null}
                      </div>
                    </div>
                    <div className={styles.sideCardBody}>
                      {!locked ? (
                        <>
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
                          <div
                            className={dropActive ? `${styles.dropzone} ${styles.dropzoneActive}` : styles.dropzone}
                            role="button"
                            tabIndex={0}
                            onClick={() => attachInputRef.current?.click()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                attachInputRef.current?.click();
                              }
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDropActive(true);
                            }}
                            onDragLeave={() => setDropActive(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDropActive(false);
                              addPendingFiles(e.dataTransfer?.files);
                            }}
                          >
                            <div className={styles.dropzoneIcon}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M12 16V4" />
                                <path d="M6 10l6-6 6 6" />
                                <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                              </svg>
                            </div>
                            <div className={styles.dropzoneText}>
                              <b>Drag &amp; drop files here</b>, or click to browse
                            </div>
                          </div>
                        </>
                      ) : null}

                      {(draft.keepFiles || []).length || pendingFiles.length ? (
                        <div className={styles.fileList}>
                          {(draft.keepFiles || []).map((file) => (
                            <div key={file} className={styles.fileRow}>
                              <a
                                className={styles.fileName}
                                href={attachmentHref(file)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {displayStoredFileName(file)}
                              </a>
                              <CircleDeleteButton
                                disabled={locked}
                                onClick={() => patchDraft({
                                  keepFiles: draft.keepFiles.filter((name) => name !== file),
                                })}
                              />
                            </div>
                          ))}
                          {pendingFiles.map((file, index) => (
                            <div key={`pending-${file.name}-${index}`} className={styles.fileRow}>
                              <span className={styles.fileName}>{file.name}</span>
                              <span className={styles.filePending}>(pending)</span>
                              <CircleDeleteButton
                                disabled={locked}
                                onClick={() => removePendingFile(index)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : locked ? (
                        <div className={styles.sideEmpty}>No documents uploaded yet.</div>
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
                        Use &quot;Submit&quot; only when all entries prior to sailing are complete.
                      </div>
                      <div className={styles.gprlFooterActions}>
                        <button
                          type="button"
                          className={styles.btnSaveOutline}
                          onClick={() => handleSubmit(1)}
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
                          onClick={() => handleSubmit(2)}
                          disabled={saving}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="m22 2-7 20-4-9-9-4Z" />
                            <path d="M22 2 11 13" />
                          </svg>
                          Submit
                        </button>
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

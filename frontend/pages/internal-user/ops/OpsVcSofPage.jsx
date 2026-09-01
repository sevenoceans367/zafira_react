import React, { useEffect, useMemo, useRef, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  DmyDateInput,
  LoadingOverlay,
  TextInput,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath, attachmentUrl } from '@bainbridge/shared-routing';
import { fetchSofForm, saveSof } from '../../../services/opsVc.js';
import OpsVcSofHeaderActions from './OpsVcSofHeaderActions.jsx';
import pageStyles from './OpsPages.module.css';
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
        <li>Fill in the port header and <b>Key operations</b> with From/To datetimes as events occur.</li>
        <li>Complete <b>Cargo / figures</b> where applicable.</li>
        <li><b>Submit</b> saves your entries; <b>Submit &amp; Close</b> locks the SOF when sailing entries are complete.</li>
        <li>Key operations with From and To feed Laytime activities; timestamps also seed Laytime header fields.</li>
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

function cargoFigureLabels(activity) {
  const name = String(activity || '');
  if (name === 'Cargo Loaded') return { col1: "Ship's Figures", col2: 'B/L Figures' };
  if (name === 'Bunkers taken') return { col1: 'IFO', col2: 'MDO' };
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
                          <div className={styles.sectionTitle}>Port call</div>
                          <div className={styles.sectionSub}>Vessel, voyage and terminal details</div>
                        </div>
                      </div>
                      <div className={pageStyles.tableWrap}>
                        <table className={`zafira-data-table ${pageStyles.nestedTable}`}>
                          <tbody>
                            <tr>
                              <td width="25%"><b>Vessel</b></td>
                              <td width="25%">{form.vesselName || '—'}</td>
                              <td width="25%"><b>Port</b></td>
                              <td width="25%">{activePort.portName || '—'}</td>
                            </tr>
                            <tr>
                              <td><b>Voyage</b></td>
                              <td>{form.voyageNo || '—'}</td>
                              <td><b>Operation</b></td>
                              <td>{activePort.operation || '—'}</td>
                            </tr>
                            <tr>
                              <td><b>Cargo</b></td>
                              <td>{cargoSummary}</td>
                              <td><b>Terminal</b></td>
                              <td>
                                <TextInput
                                  value={draft.terminal}
                                  onChange={(e) => patchDraft({ terminal: e.target.value })}
                                  disabled={locked}
                                  placeholder="Enter terminal here"
                                />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className={styles.sectionBlock}>
                      <h4 className={styles.blockTitle}>Key operations</h4>
                      <div className={pageStyles.tableWrap}>
                        <table className={`zafira-data-table ${pageStyles.table}`}>
                          <thead>
                            <tr>
                              <th width="4%">#</th>
                              <th width="24%">Key operation</th>
                              <th width="16%">Date Time From</th>
                              <th width="16%">Date Time To</th>
                              <th width="40%" colSpan={2}>Comments</th>
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
                                  <DmyDateInput
                                    enableTime
                                    value={row.activityDateTimeTo || ''}
                                    onChange={(v) => updateListRow('keyOperations', index, { activityDateTimeTo: v })}
                                    disabled={locked}
                                  />
                                </td>
                                {isRobActivity(row.activity) ? (
                                  <>
                                    <td width="20%">
                                      <label>
                                        ROB IFO
                                        <TextInput
                                          value={row.robIfo}
                                          onChange={(e) => updateListRow('keyOperations', index, { robIfo: e.target.value })}
                                          disabled={locked}
                                          placeholder="0.00"
                                        />
                                      </label>
                                    </td>
                                    <td width="20%">
                                      <label>
                                        ROB MDO
                                        <TextInput
                                          value={row.robMdo}
                                          onChange={(e) => updateListRow('keyOperations', index, { robMdo: e.target.value })}
                                          disabled={locked}
                                          placeholder="0.00"
                                        />
                                      </label>
                                    </td>
                                  </>
                                ) : (
                                  <td colSpan={2}>
                                    <TextInput
                                      value={row.comments}
                                      onChange={(e) => updateListRow('keyOperations', index, { comments: e.target.value })}
                                      disabled={locked}
                                      placeholder="Comments here…."
                                    />
                                  </td>
                                )}
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
                            {(draft.cargoRows || []).map((row, index) => {
                              const labels = cargoFigureLabels(row.activity);
                              return (
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
                                  <td width="26%">
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
                                        placeholder="Text here........"
                                      />
                                    </td>
                                  ) : (
                                    <>
                                      <td width="12%">{labels.col1}</td>
                                      <td width="16%">
                                        <TextInput
                                          value={row.shipFigure}
                                          onChange={(e) => updateListRow('cargoRows', index, { shipFigure: e.target.value })}
                                          disabled={locked}
                                          placeholder="0.00"
                                        />
                                      </td>
                                      <td width="12%">{labels.col2}</td>
                                      <td width="16%">
                                        <TextInput
                                          value={row.blFigure}
                                          onChange={(e) => updateListRow('cargoRows', index, { blFigure: e.target.value })}
                                          disabled={locked}
                                          placeholder="0.00"
                                        />
                                      </td>
                                      {isDraftCargoActivity(row.activity) ? (
                                        <>
                                          <td width="14%">Corresponding water density</td>
                                          <td width="16%">
                                            <TextInput
                                              value={row.waterDensity}
                                              onChange={(e) => updateListRow('cargoRows', index, { waterDensity: e.target.value })}
                                              disabled={locked}
                                              placeholder="0.00"
                                            />
                                          </td>
                                        </>
                                      ) : null}
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {!locked ? (
                        <AddRowButton onClick={() => addListRow('cargoRows', emptyCargoRow)} disabled={locked} />
                      ) : null}
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

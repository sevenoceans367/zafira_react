import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DmyDateInput,
  LoadingOverlay,
  useConfirm,
} from '@bainbridge/shared-ui';
import { attachmentUrl } from '@bainbridge/shared-routing';
import {
  fetchAgentSof,
  saveAgentPreArrival,
  saveAgentSof,
} from '../../services/agentPortal.js';
import styles from './AgentPortal.module.css';

const ETA_FIELDS = [
  { key: 'eta30', label: 'ETA 30 DAYS' },
  { key: 'eta25', label: 'ETA 25 DAYS' },
  { key: 'eta20', label: 'ETA 20 DAYS' },
  { key: 'eta15', label: 'ETA 15 DAYS' },
  { key: 'eta10', label: 'ETA 10 DAYS' },
  { key: 'eta7', label: 'ETA 7 DAYS' },
  { key: 'eta5', label: 'ETA 5 DAYS' },
  { key: 'eta3', label: 'ETA 3 DAYS' },
  { key: 'eta2', label: 'ETA 2 DAYS' },
  { key: 'eta1', label: 'ETA 1 DAYS' },
  { key: 'actualArrival', label: 'ACTUAL ARRIVAL' },
  { key: 'norTendered', label: 'NOR TENDERED' },
];

function emptyDailyQtyRow() {
  return {
    date: '',
    engagementQty: '',
    loadLast: '',
    ttlLoad: '',
    balance: '',
    etcd: '',
  };
}

function emptyBlRow() {
  return { blDate: '', cargo: '', blQty: '' };
}

function emptyActivityRow() {
  return { activity: '', from: '', to: '', duration: '', notes: '' };
}

function emptyEntityRow() {
  return { name: '', value: '' };
}

function calcDuration(from, to) {
  const parse = (raw) => {
    const match = String(raw || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{1,2})$/);
    if (!match) return null;
    const [, dd, mm, yyyy, hh, min] = match;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  };
  const a = parse(from);
  const b = parse(to);
  if (!a || !b) return '0.0';
  const hours = (b - a) / 3600000;
  if (!Number.isFinite(hours)) return '0.0';
  return hours.toFixed(4);
}

export default function AgentSofPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [tab, setTab] = useState('pre');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [form, setForm] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAgentSof();
      setForm({
        ...data,
        preArrival: { ...(data.preArrival || {}) },
        dailyQty: (data.dailyQty?.length ? data.dailyQty : [emptyDailyQtyRow()]).map((r) => ({ ...r })),
        entityRows: (data.entityRows || []).map((r) => ({ ...r })),
        blRows: (data.blRows?.length ? data.blRows : [emptyBlRow()]).map((r) => ({ ...r })),
        portActivities: (data.portActivities?.length ? data.portActivities : [emptyActivityRow()]).map((r) => ({ ...r })),
        uploads: [...(data.uploads || [])],
      });
      setPendingFiles([]);
    } catch (err) {
      setForm(null);
      setError(err.message || 'Failed to load SOF.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const locked = Boolean(form?.locked);
  const labels = form?.labels || {};
  const vessel = form?.vessel || {};

  const entityStartNo = useMemo(
    () => 16 + 1,
    [],
  );

  const updatePre = (key, value) => {
    setForm((prev) => (prev ? { ...prev, preArrival: { ...prev.preArrival, [key]: value } } : prev));
  };

  const updateDaily = (index, key, value) => {
    setForm((prev) => {
      if (!prev) return prev;
      const dailyQty = prev.dailyQty.map((row, i) => (i === index ? { ...row, [key]: value } : row));
      return { ...prev, dailyQty };
    });
  };

  const updateField = (key, value) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateEntity = (index, key, value) => {
    setForm((prev) => {
      if (!prev) return prev;
      const entityRows = prev.entityRows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
      return { ...prev, entityRows };
    });
  };

  const updateBl = (index, key, value) => {
    setForm((prev) => {
      if (!prev) return prev;
      const blRows = prev.blRows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
      return { ...prev, blRows };
    });
  };

  const updateActivity = (index, key, value) => {
    setForm((prev) => {
      if (!prev) return prev;
      const portActivities = prev.portActivities.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [key]: value };
        if (key === 'from' || key === 'to') {
          next.duration = calcDuration(
            key === 'from' ? value : next.from,
            key === 'to' ? value : next.to,
          );
        }
        return next;
      });
      return { ...prev, portActivities };
    });
  };

  const savePreArrival = async (close) => {
    if (!form) return;
    if (close && !String(form.preArrival?.norTendered || '').trim()) {
      setError('Please Fill NOR Tender.');
      return;
    }
    if (close) {
      const ok = await confirm({
        title: 'Close Pre Arrival',
        message: 'Are you sure to close Pre Arrival?',
        confirmLabel: 'Yes',
      });
      if (!ok) return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveAgentPreArrival({
        preArrival: form.preArrival,
        dailyQty: form.dailyQty,
        submitId: close ? 2 : 1,
      });
      setNotice('Pre Arrival & Other added/updated successfully.');
      await reload();
    } catch (err) {
      setError(err.message || 'Failed to save Pre Arrival.');
    } finally {
      setSaving(false);
    }
  };

  const saveSofMain = async (submitId) => {
    if (!form || locked) return;
    if (submitId === 2) {
      const ok = await confirm({
        title: 'Submit & Close SOF',
        message: 'Are you sure all entries prior to sailing are made?',
        confirmLabel: 'Yes',
      });
      if (!ok) return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await saveAgentSof({
        submitId,
        terminal: form.terminal,
        stowageQty: form.stowageQty,
        vesselArrived: form.vesselArrived,
        norTendered: form.norTendered,
        pilotOnBoard: form.pilotOnBoard,
        loadCommenced: form.loadCommenced,
        loadCompleted: form.loadCompleted,
        vesselSailed: form.vesselSailed,
        agentRemarks: form.agentRemarks,
        entityRows: form.entityRows,
        blRows: form.blRows,
        portActivities: form.portActivities,
        keepFiles: form.uploads || [],
      }, pendingFiles);
      setNotice(result.closed
        ? 'SOF submitted and closed successfully.'
        : 'SOF added/updated successfully.');
      if (result.closed) {
        navigate('/agent/', { replace: true });
        return;
      }
      await reload();
    } catch (err) {
      setError(err.message || 'Failed to save SOF.');
    } finally {
      setSaving(false);
    }
  };

  const removeUpload = async (name) => {
    const ok = await confirm({
      title: 'Remove attachment',
      message: 'Are you sure you want to delete this entry permanently?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setForm((prev) => (prev
      ? { ...prev, uploads: (prev.uploads || []).filter((f) => f !== name) }
      : prev));
  };

  return (
    <>
      {(loading || saving) ? <LoadingOverlay show fullScreen={false} /> : null}

      <div className={styles.pageHead}>
        <div className={styles.pageHeadLeft}>
          <div className={styles.pageHeadIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z" />
              <path d="M14 3v5h5" />
              <path d="M9 13h6" />
              <path d="M9 17h6" />
            </svg>
          </div>
          <div>
            <h1 className={styles.pageTitle}>Statement of Facts</h1>
            <div className={styles.pageSub}>{form?.title || 'Agent SOF'}</div>
          </div>
        </div>
        <div className={styles.controls}>
          <Link to="/agent/" className={`${styles.btnMini} ${styles.btnOutline}`}>
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className={styles.breadcrumb}>
        <Link to="/agent/">Home</Link>
        {' '}
        ›
        {' '}
        SOF
      </div>

      {error ? <div className={styles.formError}>{error}</div> : null}
      {notice ? <div className={styles.formNotice}>{notice}</div> : null}

      {!loading && form ? (
        <>
          <div className={styles.sofBanner}>
            Please fill up full SOF in Section 18, to tally with the Signed SOF
          </div>

          <div className={styles.sofTabs}>
            <button
              type="button"
              className={tab === 'pre' ? styles.sofTabActive : styles.sofTab}
              onClick={() => setTab('pre')}
            >
              Pre Arrival & Other
            </button>
            <button
              type="button"
              className={tab === 'sof' ? styles.sofTabActive : styles.sofTab}
              onClick={() => setTab('sof')}
            >
              {form.portType}
              {' - '}
              {form.portName}
            </button>
          </div>

          {tab === 'pre' ? (
            <div className={styles.formCard}>
              <table className={styles.sofKV}>
                <tbody>
                  <tr>
                    <td>VESSEL NAME</td>
                    <td>{vessel.vesselName || '—'}</td>
                  </tr>
                  <tr>
                    <td>NOMINATION ID</td>
                    <td>{form.nomId || '—'}</td>
                  </tr>
                  <tr>
                    <td>{labels.cargoDecl}</td>
                    <td>
                      <label className={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={Boolean(form.preArrival.cargoDecl)}
                          disabled={locked}
                          onChange={(e) => updatePre('cargoDecl', e.target.checked)}
                        />
                      </label>
                    </td>
                  </tr>
                  <tr>
                    <td>{labels.stowPlanQty}</td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={form.preArrival.stowPlanQty || ''}
                        disabled={locked}
                        onChange={(e) => updatePre('stowPlanQty', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>{labels.deptDraft}</td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={form.preArrival.spDeptDraft || ''}
                        disabled={locked}
                        onChange={(e) => updatePre('spDeptDraft', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>{labels.arrDraft}</td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={form.preArrival.spArrDraft || ''}
                        disabled={locked}
                        onChange={(e) => updatePre('spArrDraft', e.target.value)}
                      />
                    </td>
                  </tr>
                  {ETA_FIELDS.map((field) => (
                    <tr key={field.key}>
                      <td>{field.label}</td>
                      <td>
                        <DmyDateInput
                          enableTime
                          value={form.preArrival[field.key] || ''}
                          disabled={locked}
                          onChange={(value) => updatePre(field.key, value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 className={styles.sofSectionTitle}>DAILY QTY</h2>
              <div className={styles.tableWrap}>
                <table className={styles.grid}>
                  <thead>
                    <tr>
                      <th>DATE (EVERY N/N OR ON COMPLETION)</th>
                      <th>TOTAL AGREED QTY (MT)</th>
                      <th>{labels.loadLast}</th>
                      <th>{labels.ttlLoad}</th>
                      <th>BALANCE (MT)</th>
                      <th>ETC CARGO/CARGO COMPLETED</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {form.dailyQty.map((row, index) => (
                      <tr key={`daily-${index}`}>
                        <td>
                          <DmyDateInput
                            value={row.date || ''}
                            disabled={locked}
                            onChange={(value) => updateDaily(index, 'date', value)}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={row.engagementQty || ''}
                            disabled={locked}
                            onChange={(e) => updateDaily(index, 'engagementQty', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={row.loadLast || ''}
                            disabled={locked}
                            onChange={(e) => updateDaily(index, 'loadLast', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={row.ttlLoad || ''}
                            disabled={locked}
                            onChange={(e) => updateDaily(index, 'ttlLoad', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={row.balance || ''}
                            disabled={locked}
                            onChange={(e) => updateDaily(index, 'balance', e.target.value)}
                          />
                        </td>
                        <td>
                          <DmyDateInput
                            enableTime
                            value={row.etcd || ''}
                            disabled={locked}
                            onChange={(value) => updateDaily(index, 'etcd', value)}
                          />
                        </td>
                        <td>
                          {!locked && form.dailyQty.length > 1 ? (
                            <button
                              type="button"
                              className={styles.iconDanger}
                              onClick={() => setForm((prev) => (prev
                                ? { ...prev, dailyQty: prev.dailyQty.filter((_, i) => i !== index) }
                                : prev))}
                            >
                              ×
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!locked ? (
                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={`${styles.btnMini} ${styles.btnOutline}`}
                    onClick={() => setForm((prev) => (prev
                      ? { ...prev, dailyQty: [...prev.dailyQty, emptyDailyQtyRow()] }
                      : prev))}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnMini} ${styles.btnNavy}`}
                    onClick={() => savePreArrival(false)}
                  >
                    Submit
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnMini} ${styles.btnNavy}`}
                    onClick={() => savePreArrival(true)}
                  >
                    Submit & Close
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.formCard}>
              <div className={styles.sofNom}>
                Nom ID :&nbsp;
                <strong>{form.nomId || '—'}</strong>
              </div>

              <table className={styles.sofKV}>
                <tbody>
                  <tr>
                    <td>1. NAME OF VESSEL</td>
                    <td>{vessel.vesselName || '—'}</td>
                  </tr>
                  <tr>
                    <td>2. BUILT</td>
                    <td><input className={styles.cellInput} value={vessel.built || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>3. GRT/NRT</td>
                    <td><input className={styles.cellInput} value={vessel.grtNrt || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>4. FLAG</td>
                    <td><input className={styles.cellInput} value={vessel.flag || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>5. DWT(s)</td>
                    <td><input className={styles.cellInput} value={vessel.dwt || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>6. LOA/BEAM</td>
                    <td><input className={styles.cellInput} value={vessel.loaBeam || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>
                      7.
                      {' '}
                      {vessel.gearLabel || 'GEAR/GRABS'}
                    </td>
                    <td><input className={styles.cellInput} value={vessel.gearValue || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>
                      8.
                      {' '}
                      {vessel.hatchLabel || 'HATCH/HOLD'}
                    </td>
                    <td><input className={styles.cellInput} value={vessel.hatchValue || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>9. PORT/TERMINAL/BERTH/ANCHORAGE</td>
                    <td>
                      <input
                        className={styles.cellInputWide}
                        value={form.terminal || ''}
                        disabled={locked}
                        onChange={(e) => updateField('terminal', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>10. STOWAGE PLAN QUANTITY (MT)</td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={form.stowageQty || ''}
                        disabled={locked}
                        onChange={(e) => updateField('stowageQty', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>11. VESSEL ARRIVED</td>
                    <td>
                      <DmyDateInput
                        enableTime
                        value={form.vesselArrived || ''}
                        disabled={locked}
                        onChange={(value) => updateField('vesselArrived', value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>12. NOR TENDERED</td>
                    <td>
                      <DmyDateInput
                        enableTime
                        value={form.norTendered || ''}
                        disabled={locked}
                        onChange={(value) => updateField('norTendered', value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>13. PILOT ON BOARD</td>
                    <td>
                      <DmyDateInput
                        enableTime
                        value={form.pilotOnBoard || ''}
                        disabled={locked}
                        onChange={(value) => updateField('pilotOnBoard', value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>14. LOAD/DISCH COMMENCED</td>
                    <td>
                      <DmyDateInput
                        enableTime
                        value={form.loadCommenced || ''}
                        disabled={locked}
                        onChange={(value) => updateField('loadCommenced', value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>15. LOAD/DISCH COMPLETED</td>
                    <td>
                      <DmyDateInput
                        enableTime
                        value={form.loadCompleted || ''}
                        disabled={locked}
                        onChange={(value) => updateField('loadCompleted', value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>16. VESSEL SAILED</td>
                    <td>
                      <DmyDateInput
                        enableTime
                        value={form.vesselSailed || ''}
                        disabled={locked}
                        onChange={(value) => updateField('vesselSailed', value)}
                      />
                    </td>
                  </tr>
                  {form.entityRows.map((row, index) => (
                    <tr key={`ent-${index}`}>
                      <td>
                        {entityStartNo + index}
                        .
                        {' '}
                        <input
                          className={styles.cellInputWide}
                          value={row.name || ''}
                          disabled={locked}
                          placeholder="Custom field name"
                          onChange={(e) => updateEntity(index, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.cellInputWide}
                          value={row.value || ''}
                          disabled={locked}
                          onChange={(e) => updateEntity(index, 'value', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!locked ? (
                <button
                  type="button"
                  className={`${styles.btnMini} ${styles.btnOutline}`}
                  onClick={() => setForm((prev) => (prev
                    ? { ...prev, entityRows: [...prev.entityRows, emptyEntityRow()] }
                    : prev))}
                >
                  Add
                </button>
              ) : null}

              <h2 className={styles.sofSectionTitle}>
                {16 + form.entityRows.length + 1}
                . BL Date / Cargo / BL Qty
              </h2>
              <div className={styles.tableWrap}>
                <table className={styles.grid}>
                  <thead>
                    <tr>
                      <th>BL Date</th>
                      <th>Cargo</th>
                      <th>BL Qty(MT)</th>
                      <th>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.blRows.map((row, index) => (
                      <tr key={`bl-${index}`}>
                        <td>
                          <DmyDateInput
                            value={row.blDate || ''}
                            disabled={locked}
                            onChange={(value) => updateBl(index, 'blDate', value)}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={row.cargo || ''}
                            disabled={locked}
                            onChange={(e) => updateBl(index, 'cargo', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={row.blQty || ''}
                            disabled={locked}
                            onChange={(e) => updateBl(index, 'blQty', e.target.value)}
                          />
                        </td>
                        <td>
                          {!locked ? (
                            <button
                              type="button"
                              className={styles.iconDanger}
                              onClick={() => setForm((prev) => {
                                if (!prev) return prev;
                                const next = prev.blRows.filter((_, i) => i !== index);
                                return { ...prev, blRows: next.length ? next : [emptyBlRow()] };
                              })}
                            >
                              ×
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!locked ? (
                <button
                  type="button"
                  className={`${styles.btnMini} ${styles.btnOutline}`}
                  onClick={() => setForm((prev) => (prev
                    ? { ...prev, blRows: [...prev.blRows, emptyBlRow()] }
                    : prev))}
                >
                  Add
                </button>
              ) : null}

              <h2 className={styles.sofSectionTitle}>
                {16 + form.entityRows.length + 2}
                . Activity in Port
              </h2>
              <div className={styles.tableWrap}>
                <table className={styles.grid}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>ACTIVITY IN PORT</th>
                      <th>FROM</th>
                      <th>TO</th>
                      <th>DURATION</th>
                      <th>REMARKS</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {form.portActivities.map((row, index) => (
                      <tr key={`act-${index}`}>
                        <td>{index + 1}</td>
                        <td>
                          <input
                            className={styles.cellInputWide}
                            value={row.activity || ''}
                            disabled={locked}
                            onChange={(e) => updateActivity(index, 'activity', e.target.value)}
                          />
                        </td>
                        <td>
                          <DmyDateInput
                            enableTime
                            value={row.from || ''}
                            disabled={locked}
                            onChange={(value) => updateActivity(index, 'from', value)}
                          />
                        </td>
                        <td>
                          <DmyDateInput
                            enableTime
                            value={row.to || ''}
                            disabled={locked}
                            onChange={(value) => updateActivity(index, 'to', value)}
                          />
                        </td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={row.duration || ''}
                            disabled={locked}
                            onChange={(e) => updateActivity(index, 'duration', e.target.value)}
                          />
                        </td>
                        <td>
                          <textarea
                            className={styles.cellTextarea}
                            rows={2}
                            value={row.notes || ''}
                            disabled={locked}
                            onChange={(e) => updateActivity(index, 'notes', e.target.value)}
                          />
                        </td>
                        <td>
                          {!locked ? (
                            <button
                              type="button"
                              className={styles.iconDanger}
                              onClick={() => setForm((prev) => {
                                if (!prev) return prev;
                                const next = prev.portActivities.filter((_, i) => i !== index);
                                return {
                                  ...prev,
                                  portActivities: next.length ? next : [emptyActivityRow()],
                                };
                              })}
                            >
                              ×
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!locked ? (
                <button
                  type="button"
                  className={`${styles.btnMini} ${styles.btnOutline}`}
                  onClick={() => setForm((prev) => (prev
                    ? { ...prev, portActivities: [...prev.portActivities, emptyActivityRow()] }
                    : prev))}
                >
                  Add
                </button>
              ) : null}

              <h2 className={styles.sofSectionTitle}>
                {16 + form.entityRows.length + 3}
                . AGENT&apos;S REMARKS (If Any)
              </h2>
              <textarea
                className={styles.cellTextarea}
                rows={4}
                value={form.agentRemarks || ''}
                disabled={locked}
                onChange={(e) => updateField('agentRemarks', e.target.value)}
              />

              <h2 className={styles.sofSectionTitle}>
                {16 + form.entityRows.length + 4}
                . DOCUMENT&apos;S UPLOAD
              </h2>
              <div className={styles.uploadList}>
                {(form.uploads || []).map((file) => (
                  <div key={file} className={styles.uploadRow}>
                    <a href={attachmentUrl(file)} target="_blank" rel="noreferrer">
                      {file}
                    </a>
                    {!locked ? (
                      <button type="button" className={styles.iconDanger} onClick={() => removeUpload(file)}>
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
                {!locked ? (
                  <label className={styles.uploadBtn}>
                    Attachment
                    <input
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) setPendingFiles((prev) => [...prev, ...files]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                ) : null}
                {pendingFiles.length ? (
                  <div className={styles.fxHint}>
                    {pendingFiles.length}
                    {' '}
                    file(s) ready to upload
                  </div>
                ) : null}
                <div className={styles.fxHint}>(max upload size per file - 2 MB)</div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={`${styles.btnMini} ${styles.btnOutline}`}
                  onClick={() => setShowInstructions(true)}
                >
                  Instructions
                </button>
                {!locked ? (
                  <>
                    <button
                      type="button"
                      className={`${styles.btnMini} ${styles.btnNavy}`}
                      onClick={() => saveSofMain(1)}
                    >
                      Submit
                    </button>
                    <button
                      type="button"
                      className={`${styles.btnMini} ${styles.btnNavy}`}
                      onClick={() => saveSofMain(2)}
                    >
                      Submit & Close
                    </button>
                  </>
                ) : (
                  <span className={styles.formNotice}>This SOF is locked after Submit & Close.</span>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}

      {showInstructions ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setShowInstructions(false)}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-label="SOF Instructions"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <h3>INSTRUCTIONS</h3>
              <button type="button" className={styles.iconDanger} onClick={() => setShowInstructions(false)}>×</button>
            </div>
            <ol className={styles.instrList}>
              <li>Please fill in the item 10 - 16 without fail, for anchorage port.</li>
              <li>
                Activity in ports: All Activities in Port to be mentioned from vessel arrival,
                shifting, working, stoppages, including fields as mentioned in 10-16 above,
                till vessel sailing and clearing port.
              </li>
              <li>
                End of a day to be inserted as 00:00 hrs of new day.
                <br />
                eg. #1 : full day From : 11-Sep-2014 00:00 To : 12-Sep-2014 00:00
              </li>
              <li>
                Click &quot;Submit&quot; to save the form and once complete click
                &quot;Submit and Close&quot;. After &quot;Submit and Close&quot; the form is not editable.
              </li>
            </ol>
          </div>
        </div>
      ) : null}
    </>
  );
}

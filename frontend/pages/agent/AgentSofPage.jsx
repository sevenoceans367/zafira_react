import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DmyDateInput,
  HeaderFilterControls,
  LoadingOverlay,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath, attachmentUrl } from '@bainbridge/shared-routing';
import {
  fetchAgentSof,
  saveAgentPreArrival,
  saveAgentSof,
} from '../../services/agentPortal.js';
import PageHeaderActions from '../internal-user/PageHeaderActions.jsx';
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

  const portRole = String(form?.portType || '').toUpperCase() === 'DP' ? 'DP' : 'LP';

  return (
    <>
      {(loading || saving) ? <LoadingOverlay show fullScreen={false} /> : null}

      <PageHeaderActions deps={[]}>
        <HeaderFilterControls>
          <Button variant="secondary" label="Back to Dashboard" href={appPath('/agent/')} />
        </HeaderFilterControls>
      </PageHeaderActions>

      <div className={styles.sofMeta}>
        <div className={styles.sofMetaLeft}>
          <p className={styles.pageSubInline}>
            {vessel.vesselName || form?.title || 'Statement of Facts'}
          </p>
          <div className={styles.instrInfoWrap} tabIndex={0}>
            <button type="button" className={styles.instrInfoBtn} aria-label="Instructions">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </button>
            <div className={styles.instrPopover}>
              <div className={styles.instrPopoverTitle}>Instructions</div>
              <div className={styles.instrItem}>
                <b>A.</b>
                {' '}
                Items 10–16 must be filled in for the anchorage port too, in addition to the
                load/discharge port, whenever the vessel calls at anchorage before berthing.
              </div>
              <div className={styles.instrItem}>
                <b>B.</b>
                {' '}
                Log every port activity in the Activity in Port table below — gaps in the
                timeline will be queried by the office team during review.
              </div>
              <div className={styles.instrItem}>
                <b>C.</b>
                {' '}
                Times are logged on a 24-hour, end-of-day convention: e.g. an event at 23:59 on
                the 5th is logged as
                {' '}
                <b>05 2359</b>
                ; an event carrying past midnight into the 6th is logged against the
                {' '}
                <b>6th</b>
                , not the 5th; a full idle day with no activity is logged as
                {' '}
                <b>00:00–24:00</b>
                {' '}
                against that date.
              </div>
              <div className={styles.instrItem}>
                <b>D.</b>
                {' '}
                <b>Save</b>
                {' '}
                keeps the form editable so you can come back and finish it later.
                {' '}
                <b>Submit &amp; Close</b>
                {' '}
                sends it to the office team for review and locks the form — use it only once
                the call is fully complete.
              </div>
            </div>
          </div>
        </div>
        {form?.nomId ? (
          <span className={styles.sofVoyBadge}>
            Voy No.
            {' '}
            <b>{form.nomId}</b>
          </span>
        ) : null}
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
              Pre Arrival &amp; Others
            </button>
            <button
              type="button"
              className={tab === 'sof' ? styles.sofTabActive : styles.sofTab}
              onClick={() => setTab('sof')}
            >
              <span className={`${styles.lpdpChip} ${portRole === 'DP' ? styles.lpdpChipDp : styles.lpdpChipLp}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" />
                  <circle cx="12" cy="9" r="2.2" />
                </svg>
                {portRole}
              </span>
              {form.portName}
            </button>
          </div>

          {tab === 'pre' ? (
            <div className={styles.sofSection}>
              <div className={styles.sofSectionTitle}>Pre Arrival &amp; Others</div>
              <div className={styles.sofSectionSub}>Vessel particulars, ETA notices, and daily quantity log.</div>
              <table className={styles.sofKV}>
                <tbody>
                  <tr>
                    <td>Vessel Name</td>
                    <td>{vessel.vesselName || '—'}</td>
                  </tr>
                  <tr>
                    <td>Voy No.</td>
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
                <div className={styles.sofActionRow}>
                  <button
                    type="button"
                    className={`${styles.btnMini} ${styles.btnOutline}`}
                    onClick={() => setForm((prev) => (prev
                      ? { ...prev, dailyQty: [...prev.dailyQty, emptyDailyQtyRow()] }
                      : prev))}
                  >
                    + Add row
                  </button>
                  <button
                    type="button"
                    className={styles.btnOutlineLg}
                    onClick={() => savePreArrival(false)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                      <path d="M17 21v-8H7v8" />
                      <path d="M7 3v5h8" />
                    </svg>
                    Save
                  </button>
                  <button
                    type="button"
                    className={styles.btnNavyLg}
                    onClick={() => savePreArrival(true)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M22 2 11 13" />
                      <path d="M22 2 15 22l-4-9-9-4Z" />
                    </svg>
                    Submit &amp; Close
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.sofSection}>
              <div className={styles.sofSectionTitle}>
                {portRole === 'DP' ? 'Discharge Port' : 'Load Port'}
                {' — '}
                {form.portName}
              </div>
              <div className={styles.sofSectionSub}>Vessel particulars, port call times, B/L, and activity log.</div>
              <div className={styles.sofNom}>
                Voy No.&nbsp;
                <strong>{form.nomId || '—'}</strong>
              </div>

              <table className={styles.sofKV}>
                <tbody>
                  <tr>
                    <td>1. Name of Vessel</td>
                    <td>{vessel.vesselName || '—'}</td>
                  </tr>
                  <tr>
                    <td>2. Built</td>
                    <td><input className={styles.cellInput} value={vessel.built || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>3. GRT/NRT</td>
                    <td><input className={styles.cellInput} value={vessel.grtNrt || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>4. Flag</td>
                    <td><input className={styles.cellInput} value={vessel.flag || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>5. DWT(s)</td>
                    <td><input className={styles.cellInput} value={vessel.dwt || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>6. LOA/Beam</td>
                    <td><input className={styles.cellInput} value={vessel.loaBeam || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>
                      7.
                      {' '}
                      {vessel.gearLabel || 'Gear/Grabs'}
                    </td>
                    <td><input className={styles.cellInput} value={vessel.gearValue || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>
                      8.
                      {' '}
                      {vessel.hatchLabel || 'Hatch/Hold'}
                    </td>
                    <td><input className={styles.cellInput} value={vessel.hatchValue || ''} readOnly disabled /></td>
                  </tr>
                  <tr>
                    <td>9. Port/Terminal/Berth/Anchorage</td>
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
                    <td>10. Stowage Plan Quantity (MT)</td>
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

              <div className={styles.sofActionRow}>
                {!locked ? (
                  <>
                    <button
                      type="button"
                      className={styles.btnOutlineLg}
                      onClick={() => saveSofMain(1)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                        <path d="M17 21v-8H7v8" />
                        <path d="M7 3v5h8" />
                      </svg>
                      Save
                    </button>
                    <button
                      type="button"
                      className={styles.btnNavyLg}
                      onClick={() => saveSofMain(2)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M22 2 11 13" />
                        <path d="M22 2 15 22l-4-9-9-4Z" />
                      </svg>
                      Submit &amp; Close
                    </button>
                  </>
                ) : (
                  <span className={styles.formNotice}>This SOF is locked after Submit &amp; Close.</span>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}

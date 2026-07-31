import React, { useEffect, useMemo, useState } from 'react';
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
import { appPath } from '@bainbridge/shared-routing';
import { fetchLaytimeForm, openLaytime, saveLaytime } from '../../../services/opsVc.js';
import OpsVcLaytimeHeaderActions from './OpsVcLaytimeHeaderActions.jsx';
import { calcLaytimeAllowed, recomputePortDraft } from './laytimeCalculations.js';
import styles from './OpsPages.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

const FLASH = {
  0: { type: 'success', text: 'Laytime added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! this Laytime already exists for this port.' },
  2: { type: 'success', text: 'Laytime opened successfully.' },
};

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
  const flash = FLASH[Number(searchParams.get('msg'))];

  const [form, setForm] = useState(null);
  const [activeKey, setActiveKey] = useState('');
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (submitId) => {
    if (!activePort || !draft) return;

    if (!draft.detention) {
      const qty = Number(draft.loadedQty);
      const rate = Number(draft.loadedRate);
      if (!String(draft.loadedQty || '').trim() || !String(draft.loadedRate || '').trim()
        || !(qty > 0) || !(rate > 0)) {
        await alert({ title: 'Alert', message: 'Please Check Load Rate Or Quantity' });
        return;
      }
    }

    if (submitId === 1 && !(draft.approvers || []).length) {
      await alert({ title: 'Alert', message: 'Please select Level 1 Approvers first.' });
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
      });

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

      <div className={`zafira-page ${styles.page}`}>
        {(loading || saving) ? (
          <LoadingOverlay active label={saving ? 'Saving Laytime…' : 'Loading Laytime…'} />
        ) : null}
        {flash ? (
          <div className={flash.type === 'error' ? styles.error : styles.flashSuccess}>{flash.text}</div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <h3 className={styles.title}>Laytime</h3>
        {(form?.voyageNo || form?.vesselName) ? (
          <p className={styles.muted} style={{ marginTop: 0 }}>
            {form.vesselName || ''}
            {form.voyageNo ? ` · Voyage ${form.voyageNo}` : ''}
            {form.message ? ` · Nom ${form.message}` : ''}
          </p>
        ) : null}

        {!loading && !form?.ports?.length ? (
          <div className={styles.empty}>
            No load/discharge ports found on the cost sheet for Laytime.
          </div>
        ) : null}

        {form?.ports?.length ? (
          <>
            <div className={styles.tabs}>
              {form.ports.map((port) => (
                <button
                  key={port.key}
                  type="button"
                  className={port.key === activeKey ? styles.tabActive : styles.tab}
                  onClick={() => setActiveKey(port.key)}
                >
                  {port.tabLabel}
                </button>
              ))}
            </div>

            {activePort && draft ? (
              <div className={styles.letterPanel}>
                <div className={styles.tripHeader}>
                  <span />
                  <span className={styles.linkMuted} title="PDF generation is not migrated yet.">
                    <Button variant="outline" label="Generate PDF" disabled />
                  </span>
                </div>

                <h4 className={styles.sectionTitle}>Particulars</h4>
                <div className={styles.tableWrap}>
                  <table className={`zafira-data-table ${styles.nestedTable}`}>
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
                          <td>
                            {kind === 'datetime' ? (
                              <DmyDateInput
                                enableTime
                                value={draft[key]}
                                onChange={(v) => patchDraft({ [key]: v })}
                                disabled={locked}
                              />
                            ) : (
                              <TextInput
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
                            <div className={styles.inlineFields}>
                              <DmyDateInput
                                enableTime
                                value={row.value}
                                onChange={(v) => updateListRow('entityRows', index, { value: v })}
                                disabled={locked}
                              />
                              {!locked ? (
                                <button
                                  type="button"
                                  className={styles.dangerIcon}
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
                  <Button
                    variant="primary"
                    label="Add"
                    onClick={() => addListRow('entityRows', emptyEntityRow)}
                  />
                ) : null}

                <div className={styles.formGrid} style={{ marginTop: 16 }}>
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
                  <label className={styles.checkItem}>
                    <input
                      type="checkbox"
                      checked={Boolean(draft.detention)}
                      onChange={(e) => patchDraft({ detention: e.target.checked })}
                      disabled={locked}
                    />
                    <span>Detention</span>
                  </label>
                  <label className={styles.checkItem}>
                    <input
                      type="checkbox"
                      checked={Boolean(draft.reversible)}
                      onChange={(e) => patchDraft({ reversible: e.target.checked })}
                      disabled={locked}
                    />
                    <span>Reversible</span>
                  </label>
                </div>

                <h4 className={styles.sectionTitle}>Summary</h4>
                <div className={styles.formGrid}>
                  <Field label="Nom ID">
                    <TextInput value={form.message || ''} disabled />
                  </Field>
                  {summaryFields.map((field) => (
                    <Field key={field.key} label={field.label}>
                      <TextInput
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
                    </Field>
                  ))}
                </div>

                <h4 className={styles.sectionTitle}>Activities</h4>
                <div className={styles.tableWrap}>
                  <table className={`zafira-data-table ${styles.table}`}>
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
                                className={styles.dangerIcon}
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
                  <Button variant="primary" label="Add" onClick={addActivityRow} />
                ) : null}

                <h4 className={styles.sectionTitle}>Deductions</h4>
                <div className={styles.tableWrap}>
                  <table className={`zafira-data-table ${styles.table}`}>
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
                                className={styles.dangerIcon}
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
                  <Button
                    variant="primary"
                    label="Add"
                    onClick={() => addListRow('deductions', emptyDeductionRow)}
                  />
                ) : null}

                <h4 className={styles.sectionTitle}>Remarks</h4>
                <Textarea
                  rows={3}
                  value={draft.remarks}
                  onChange={(e) => patchDraft({ remarks: e.target.value })}
                  disabled={locked}
                />

                <h4 className={styles.sectionTitle}>Level 1 Approver</h4>
                {approverOptions.length ? (
                  <Field label="Approvers">
                    <select
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
                  </Field>
                ) : (
                  <Field label="Approver IDs (comma-separated)">
                    <TextInput
                      value={(draft.approvers || []).join(', ')}
                      onChange={(e) => setApprovers(e.target.value)}
                      disabled={locked}
                      placeholder="e.g. 12, 34"
                    />
                  </Field>
                )}

                <div className={styles.footerActions}>
                  {!locked ? (
                    <>
                      <Button
                        variant="primary"
                        label="Submit to edit"
                        onClick={() => handleSubmit(0)}
                        disabled={saving}
                      />
                      <Button
                        variant="primary"
                        label="Send for Approval"
                        onClick={() => handleSubmit(1)}
                        disabled={saving}
                      />
                      <Button
                        variant="primary"
                        label="Submit & Close"
                        onClick={() => handleSubmit(5)}
                        disabled={saving}
                      />
                    </>
                  ) : (
                    <p className={styles.muted}>This Laytime is locked / closed.</p>
                  )}
                  {locked && form?.canOpen ? (
                    <Button
                      variant="primary"
                      label="Open"
                      onClick={handleOpen}
                      disabled={saving}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}

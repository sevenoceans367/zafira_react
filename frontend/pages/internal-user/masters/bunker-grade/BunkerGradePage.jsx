import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlashState } from '../../../../hooks/useTimedFlash.js';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createBunkerGrade,
  fetchBunkerGrade,
  fetchBunkerGrades,
  updateBunkerGrade,
  updateBunkerGradeStatus,
} from '../../../../services/bunkerGrades.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './BunkerGradePage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Bunker Grade added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Bunker Grade.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const BUNKER_TYPES = [
  { id: 'IFO', label: 'FO' },
  { id: 'MDO', label: 'DO' },
  { id: 'MGO', label: 'GO' },
];

const EMPTY_FORM = {
  name: '',
  bunkerType: 'IFO',
  lcv: '',
  co2Fac: '',
  ch4Fac: '',
  n2oFac: '',
  co2Wt: '',
  penalty: '',
  intensity2025: '',
  intensity2026: '',
  intensity2027: '',
  intensity2028: '',
  intensity2029: '',
  ghg2025: '',
  ghg2026: '',
  ghg2027: '',
  ghg2028: '',
  ghg2029: '',
  rate2025: '',
  rate2026: '',
  rate2027: '',
  rate2028: '',
  rate2029: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

function Field({ label, name, value, onChange, required = false }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.input}
        type="text"
        name={name}
        value={value}
        required={required}
        onChange={(e) => onChange(name, e.target.value)}
      />
    </label>
  );
}

export default function BunkerGradePage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useFlashState();
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, ['name', 'bunkerType']),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBunkerGrades();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load bunker grade list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setView('form');
    setFlash(null);
    setError('');
  };

  const openEdit = async (id) => {
    setLoading(true);
    setError('');
    try {
      const record = await fetchBunkerGrade(id);
      setEditId(id);
      setForm({
        name: record.name || '',
        bunkerType: record.bunkerType || 'IFO',
        lcv: record.lcv || '',
        co2Fac: record.co2Fac || '',
        ch4Fac: record.ch4Fac || '',
        n2oFac: record.n2oFac || '',
        co2Wt: record.co2Wt || '',
        penalty: record.penalty || '',
        intensity2025: record.intensity2025 || '',
        intensity2026: record.intensity2026 || '',
        intensity2027: record.intensity2027 || '',
        intensity2028: record.intensity2028 || '',
        intensity2029: record.intensity2029 || '',
        ghg2025: record.ghg2025 || '',
        ghg2026: record.ghg2026 || '',
        ghg2027: record.ghg2027 || '',
        ghg2028: record.ghg2028 || '',
        ghg2029: record.ghg2029 || '',
        rate2025: record.rate2025 || '',
        rate2026: record.rate2026 || '',
        rate2027: record.rate2027 || '',
        rate2028: record.rate2028 || '',
        rate2029: record.rate2029 || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load bunker grade.');
    } finally {
      setLoading(false);
    }
  };

  const backToList = () => {
    setView('list');
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const handleStatusToggle = async (row, event) => {
    const nextChecked = event.target.checked;
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Do you want to change status?',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
    });
    if (!ok) {
      event.target.checked = !nextChecked;
      return;
    }
    try {
      const result = await updateBunkerGradeStatus(row.id, row.status);
      setFlash(FLASH_MESSAGES[result.msg ?? 2]);
      await loadList();
    } catch (err) {
      event.target.checked = !nextChecked;
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFlash(null);
    try {
      const result = editId
        ? await updateBunkerGrade(editId, form)
        : await createBunkerGrade(form);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save bunker grade.');
    } finally {
      setSaving(false);
    }
  };

  if (view === 'form') {
    return (
      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay active label="Loading…" /> : null}

        <div className={styles.formHeader}>
          <Button type="button" variant="outline" label="Back" onClick={backToList} disabled={saving} />
        </div>

{flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.text}
          </div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <h4 className={styles.sectionTitle}>Fuel Grade</h4>
          <div className={styles.grid}>
            <div className={styles.gridFull}>
              <Field label="Fuel Grade" name="name" value={form.name} onChange={setField} required />
            </div>

            <Field label="LCV (MJ/g)" name="lcv" value={form.lcv} onChange={setField} />
            <Field label="CO2 Factor" name="co2Fac" value={form.co2Fac} onChange={setField} />
            <Field label="CH4 Factor" name="ch4Fac" value={form.ch4Fac} onChange={setField} />
            <Field label="N2O Factor" name="n2oFac" value={form.n2oFac} onChange={setField} />
            <Field label="CO2 WtT" name="co2Wt" value={form.co2Wt} onChange={setField} />
            <Field label="Penalty ($/MT)" name="penalty" value={form.penalty} onChange={setField} />

            <Field
              label="GHG CO2 EU Intensity 2025 (gCO2eq/MJ)"
              name="intensity2025"
              value={form.intensity2025}
              onChange={setField}
            />
            <Field
              label="GHG CO2 EU Intensity 2026 (gCO2eq/MJ)"
              name="intensity2026"
              value={form.intensity2026}
              onChange={setField}
            />
            <Field
              label="GHG CO2 EU Intensity 2027 (gCO2eq/MJ)"
              name="intensity2027"
              value={form.intensity2027}
              onChange={setField}
            />
            <Field
              label="GHG CO2 EU Intensity 2028 (gCO2eq/MJ)"
              name="intensity2028"
              value={form.intensity2028}
              onChange={setField}
            />
            <Field
              label="GHG CO2 EU Intensity 2029 (gCO2eq/MJ)"
              name="intensity2029"
              value={form.intensity2029}
              onChange={setField}
            />

            <Field
              label="GHG CO2 EU Target 2025 (gCO2eq/MJ)"
              name="ghg2025"
              value={form.ghg2025}
              onChange={setField}
            />
            <Field
              label="GHG CO2 EU Target 2026 (gCO2eq/MJ)"
              name="ghg2026"
              value={form.ghg2026}
              onChange={setField}
            />
            <Field
              label="GHG CO2 EU Target 2027 (gCO2eq/MJ)"
              name="ghg2027"
              value={form.ghg2027}
              onChange={setField}
            />
            <Field
              label="GHG CO2 EU Target 2028 (gCO2eq/MJ)"
              name="ghg2028"
              value={form.ghg2028}
              onChange={setField}
            />
            <Field
              label="GHG CO2 EU Target 2029 (gCO2eq/MJ)"
              name="ghg2029"
              value={form.ghg2029}
              onChange={setField}
            />

            <Field label="EUA CO2 2025 (%)" name="rate2025" value={form.rate2025} onChange={setField} />
            <Field label="EUA CO2 2026 (%)" name="rate2026" value={form.rate2026} onChange={setField} />
            <Field label="EUA CO2 2027 (%)" name="rate2027" value={form.rate2027} onChange={setField} />
            <Field label="EUA CO2 2028 (%)" name="rate2028" value={form.rate2028} onChange={setField} />
            <Field label="EUA CO2 2029 (%)" name="rate2029" value={form.rate2029} onChange={setField} />

            <fieldset className={`${styles.field} ${styles.gridFull}`}>
              <legend className={styles.label}>Bunker Type</legend>
              <div className={styles.radioGroup}>
                {BUNKER_TYPES.map((type) => (
                  <label key={type.id} className={styles.radioOption}>
                    <input
                      type="radio"
                      name="bunkerType"
                      value={type.id}
                      checked={form.bunkerType === type.id}
                      onChange={(e) => setField('bunkerType', e.target.value)}
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className={styles.formActions}>
            <Button
              type="submit"
              variant="primary"
              label={saving ? 'Saving…' : 'Submit'}
              disabled={saving}
            />
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <MastersHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search bunker grades"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading bunker grades…" /> : null}

      {flash ? (
        <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
          {flash.text}
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.tableWrap}>
        <table className={`zafira-data-table ${styles.table}`}>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={4}>
                  No bunker grade records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.name || '—'}</td>
                <td>
                  <StatusToggle
                    checked={row.isActive}
                    onChange={(event) => handleStatusToggle(row, event)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.editButton}
                    title="Edit Details"
                    onClick={() => openEdit(row.id)}
                  >
                    <i className="bi bi-pencil-square" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

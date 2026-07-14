import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createEstimatedRatio,
  fetchEstimatedRatio,
  fetchEstimatedRatioLookups,
  fetchEstimatedRatios,
  updateEstimatedRatio,
  updateEstimatedRatioStatus,
} from '../../../../services/estimatedRatios.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './EstimatedRatioPage.module.css';

const FLASH_MESSAGES = {
  0: {
    type: 'success',
    text: 'Congratulations! Estimated PC/UMS/DWT Ratio added/updated successfully.',
  },
  1: {
    type: 'error',
    text: 'Sorry! there was an error while adding/updating Estimated PC/UMS/DWT Ratio.',
  },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  businessTypeId: '',
  vesselCategoryId: '',
  dwt: '',
  percent: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function EstimatedRatioPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ businessTypes: [], vesselCategories: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, [
      'businessTypeName',
      'vesselCategoryName',
      'dwt',
      'percent',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchEstimatedRatios();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load estimated ratio list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const data = await fetchEstimatedRatioLookups();
      setLookups({
        businessTypes: data.businessTypes ?? [],
        vesselCategories: data.vesselCategories ?? [],
      });
    } catch (err) {
      setError(err.message || 'Failed to load form lookups.');
    }
  }, []);

  useEffect(() => {
    loadList();
    loadLookups();
  }, [loadList, loadLookups]);

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
      const record = await fetchEstimatedRatio(id);
      setEditId(id);
      setForm({
        businessTypeId: record.businessTypeId || '',
        vesselCategoryId: record.vesselCategoryId || '',
        dwt: record.dwt || '',
        percent: record.percent || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load estimated ratio.');
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
      const result = await updateEstimatedRatioStatus(row.id, row.status);
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
        ? await updateEstimatedRatio(editId, form)
        : await createEstimatedRatio(form);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save estimated ratio.');
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
        <h3 className={styles.title}>
          {editId ? 'Edit Estimated PC/UMS/DWT Ratio' : 'Add Estimated PC/UMS/DWT Ratio'}
        </h3>

        {flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.text}
          </div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Business Type</span>
            <select
              className={styles.select}
              value={form.businessTypeId}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, businessTypeId: e.target.value }))}
            >
              <option value="">Select</option>
              {lookups.businessTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Vessel Category</span>
            <select
              className={styles.select}
              value={form.vesselCategoryId}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, vesselCategoryId: e.target.value }))}
            >
              <option value="">Select</option>
              {lookups.vesselCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>DWT</span>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              value={form.dwt}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, dwt: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Percent</span>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              value={form.percent}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, percent: e.target.value }))}
            />
          </label>

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
        searchPlaceholder="Search estimated ratios"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading estimated ratios…" /> : null}

      <h3 className={styles.title}>Estimated PC/UMS/DWT Ratio List</h3>

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
              <th>Business Type</th>
              <th>Vessel Category</th>
              <th>DWT</th>
              <th>Percent</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={7}>
                  No estimated ratio records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.businessTypeName || '—'}</td>
                <td>{row.vesselCategoryName || '—'}</td>
                <td>{row.dwt || '—'}</td>
                <td>{row.percent || '—'}</td>
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

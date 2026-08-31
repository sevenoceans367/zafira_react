import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlashState } from '../../../../hooks/useTimedFlash.js';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createPcftf,
  fetchPcftf,
  fetchPcftfList,
  fetchPcftfLookups,
  updatePcftf,
  updatePcftfStatus,
} from '../../../../services/pcftf.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './PcftfPage.module.css';

const FLASH_MESSAGES = {
  0: {
    type: 'success',
    text: 'Congratulations! Panama Canal Fixed Transit Fee added/updated successfully.',
  },
  1: {
    type: 'error',
    text: 'Sorry! there was an error while adding/updating Panama Canal Fixed Transit Fee.',
  },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  vesselCategoryId: '',
  lockUsed: '',
  fromDwt: '',
  toDwt: '',
  fee: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function PcftfPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ vesselCategories: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useFlashState();
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, [
      'vesselCategoryName',
      'lockUsed',
      'fromDwt',
      'toDwt',
      'fee',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPcftfList();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load Panama Canal Fixed Transit Fee list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const data = await fetchPcftfLookups();
      setLookups({ vesselCategories: data.vesselCategories ?? [] });
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
      const record = await fetchPcftf(id);
      setEditId(id);
      setForm({
        vesselCategoryId: record.vesselCategoryId || '',
        lockUsed: record.lockUsed || '',
        fromDwt: record.fromDwt || '',
        toDwt: record.toDwt || '',
        fee: record.fee || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load Panama Canal Fixed Transit Fee.');
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
      const result = await updatePcftfStatus(row.id, row.status);
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
        ? await updatePcftf(editId, form)
        : await createPcftf(form);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save Panama Canal Fixed Transit Fee.');
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
            <span className={styles.label}>Lock Used</span>
            <input
              className={styles.input}
              type="text"
              value={form.lockUsed}
              required
              placeholder="Enter lock used"
              onChange={(e) => setForm((prev) => ({ ...prev, lockUsed: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>From Range DWT (MT)</span>
            <input
              className={styles.input}
              type="number"
              step="any"
              value={form.fromDwt}
              required
              placeholder="Enter from range"
              onChange={(e) => setForm((prev) => ({ ...prev, fromDwt: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>To Range DWT (MT)</span>
            <input
              className={styles.input}
              type="number"
              step="any"
              value={form.toDwt}
              required
              placeholder="Enter to range"
              onChange={(e) => setForm((prev) => ({ ...prev, toDwt: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Fixed Transit Fee (Tanker &amp; Bulk) USD</span>
            <input
              className={styles.input}
              type="number"
              step="any"
              value={form.fee}
              required
              placeholder="Enter Rate"
              onChange={(e) => setForm((prev) => ({ ...prev, fee: e.target.value }))}
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
        searchPlaceholder="Search Panama Canal Fixed Transit Fee"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading Panama Canal Fixed Transit Fee…" /> : null}

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
              <th>Vessel Category</th>
              <th>Lock Used</th>
              <th>From Range DWT (MT)</th>
              <th>To Range DWT (MT)</th>
              <th>Fixed Transit Fee (USD)</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={8}>
                  No Panama Canal Fixed Transit Fee records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.vesselCategoryName || '—'}</td>
                <td>{row.lockUsed || '—'}</td>
                <td>{row.fromDwt || '—'}</td>
                <td>{row.toDwt || '—'}</td>
                <td>{row.fee || '—'}</td>
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

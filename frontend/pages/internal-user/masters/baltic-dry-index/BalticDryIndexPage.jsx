import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createBalticRoute,
  fetchBalticRoute,
  fetchBalticRoutes,
  updateBalticRoute,
  updateBalticRouteStatus,
} from '../../../../services/balticRoutes.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './BalticDryIndexPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Baltic Dry Index added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Baltic Dry Index.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  code: '',
  name: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function BalticDryIndexPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, ['code', 'name']),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBalticRoutes();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load Baltic Dry Index list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

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
      const record = await fetchBalticRoute(id);
      setEditId(id);
      setForm({
        code: record.code || '',
        name: record.name || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load Baltic Dry Index record.');
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
      const result = await updateBalticRouteStatus(row.id, row.status);
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
    const payload = {
      code: form.code,
      name: form.name,
    };
    try {
      const result = editId
        ? await updateBalticRoute(editId, payload)
        : await createBalticRoute(payload);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save Baltic Dry Index record.');
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
          {editId ? 'Edit Baltic Dry Index' : 'Add Baltic Dry Index'}
        </h3>

        {flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.text}
          </div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Baltic Route Code</span>
            <input
              className={styles.input}
              type="text"
              value={form.code}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Baltic Route Description</span>
            <input
              className={styles.input}
              type="text"
              value={form.name}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <div className={styles.formActions}>
            <Button
              type="submit"
              variant="primary"
              label={saving ? 'Saving…' : 'Save'}
              disabled={saving}
            />
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      {view === 'list' ? (
        <MastersHeaderActions
          search={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search Baltic Dry Index"
          onAdd={openAdd}
        />
      ) : null}

      {loading ? <LoadingOverlay active label="Loading Baltic Dry Index…" /> : null}

      <h3 className={styles.title}>Baltic Dry Index List</h3>

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
              <th>Baltic Route Code</th>
              <th>Baltic Route Description</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={5}>
                  No Baltic Dry Index records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.code || '—'}</td>
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

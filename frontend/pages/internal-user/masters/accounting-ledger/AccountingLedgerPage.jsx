import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createAccountingLedger,
  fetchAccountingLedger,
  fetchAccountingLedgerLookups,
  fetchAccountingLedgers,
  updateAccountingLedger,
  updateAccountingLedgerStatus,
} from '../../../../services/accountingLedgers.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './AccountingLedgerPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Accounting Ledger added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Accounting Ledger.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  name: '',
  groupId: '',
  code: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function AccountingLedgerPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ groups: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, [
      'name',
      'groupName',
      'code',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAccountingLedgers();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load Accounting Ledger list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const data = await fetchAccountingLedgerLookups();
      setLookups({ groups: data.groups ?? [] });
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
      const record = await fetchAccountingLedger(id);
      setEditId(id);
      setForm({
        name: record.name || '',
        groupId: record.groupId || '',
        code: record.code || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load Accounting Ledger.');
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
      const result = await updateAccountingLedgerStatus(row.id, row.status);
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
        ? await updateAccountingLedger(editId, form)
        : await createAccountingLedger(form);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save Accounting Ledger.');
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
          {editId ? 'Edit Accounting Ledger' : 'Add Accounting Ledger'}
        </h3>

        {flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.text}
          </div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Name</span>
            <input
              className={styles.input}
              type="text"
              value={form.name}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Group</span>
            <select
              className={styles.select}
              value={form.groupId}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, groupId: e.target.value }))}
            >
              <option value="">Select</option>
              {lookups.groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Code</span>
            <input
              className={styles.input}
              type="text"
              value={form.code}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
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
        searchPlaceholder="Search accounting ledgers"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading accounting ledgers…" /> : null}

      <h3 className={styles.title}>Accounting Ledger List</h3>

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
              <th>Group</th>
              <th>Code</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={6}>
                  No Accounting Ledger records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.name || '—'}</td>
                <td>{row.groupName || '—'}</td>
                <td>{row.code || '—'}</td>
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

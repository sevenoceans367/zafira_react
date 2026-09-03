import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlashState } from '../../../../hooks/useTimedFlash.js';
import { Button, LoadingOverlay, useConfirm, EditRecapIcon } from '@bainbridge/shared-ui';
import {
  createOwnerRelatedCost,
  fetchOwnerRelatedCost,
  fetchOwnerRelatedCosts,
  updateOwnerRelatedCost,
  updateOwnerRelatedCostStatus,
} from '../../../../services/ownerRelatedCosts.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './OwnerRelatedCostPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Owner Related Cost added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Owner Related Cost.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  name: '',
  rdoStatus: 1,
  expenseClassGroup: '',
  expenseClass: '',
  accountingType: '',
  postingType: '',
  conditionType: '',
  partnerNumber: '',
  currencyKey: '',
  taxCode: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function OwnerRelatedCostPage() {
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
    () => filterMasterRows(rows, searchInput, ['name']),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchOwnerRelatedCosts();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load owner related cost list.');
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
      const record = await fetchOwnerRelatedCost(id);
      setEditId(id);
      setForm({
        name: record.name || '',
        rdoStatus: Number(record.rdoStatus) === 2 ? 2 : 1,
        expenseClassGroup: record.expenseClassGroup || '',
        expenseClass: record.expenseClass || '',
        accountingType: record.accountingType || '',
        postingType: record.postingType || '',
        conditionType: record.conditionType || '',
        partnerNumber: record.partnerNumber || '',
        currencyKey: record.currencyKey || '',
        taxCode: record.taxCode || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load owner related cost.');
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
      const result = await updateOwnerRelatedCostStatus(row.id, row.status);
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
        ? await updateOwnerRelatedCost(editId, form)
        : await createOwnerRelatedCost(form);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save owner related cost.');
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
            <span className={styles.label}>Name</span>
            <input
              className={styles.input}
              type="text"
              value={form.name}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <fieldset className={styles.field}>
            <legend className={styles.label}>Status</legend>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="rdoStatus"
                  checked={form.rdoStatus === 1}
                  onChange={() => setForm((prev) => ({ ...prev, rdoStatus: 1 }))}
                />
                Add
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="rdoStatus"
                  checked={form.rdoStatus === 2}
                  onChange={() => setForm((prev) => ({ ...prev, rdoStatus: 2 }))}
                />
                Deduct
              </label>
            </div>
          </fieldset>

          <label className={styles.field}>
            <span className={styles.label}>Expense Class Group</span>
            <input
              className={styles.input}
              type="text"
              value={form.expenseClassGroup}
              onChange={(e) => setForm((prev) => ({ ...prev, expenseClassGroup: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Expense Class</span>
            <input
              className={styles.input}
              type="text"
              value={form.expenseClass}
              onChange={(e) => setForm((prev) => ({ ...prev, expenseClass: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Accounting Type for Expenses</span>
            <input
              className={styles.input}
              type="text"
              value={form.accountingType}
              onChange={(e) => setForm((prev) => ({ ...prev, accountingType: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Posting Type for Expenses</span>
            <input
              className={styles.input}
              type="text"
              value={form.postingType}
              onChange={(e) => setForm((prev) => ({ ...prev, postingType: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Condition Type</span>
            <input
              className={styles.input}
              type="text"
              value={form.conditionType}
              onChange={(e) => setForm((prev) => ({ ...prev, conditionType: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Partner Number</span>
            <input
              className={styles.input}
              type="text"
              value={form.partnerNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, partnerNumber: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Currency Key</span>
            <input
              className={styles.input}
              type="text"
              value={form.currencyKey}
              onChange={(e) => setForm((prev) => ({ ...prev, currencyKey: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Tax Code</span>
            <input
              className={styles.input}
              type="text"
              value={form.taxCode}
              onChange={(e) => setForm((prev) => ({ ...prev, taxCode: e.target.value }))}
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
      <MastersHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search owner related costs"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading owner related costs…" /> : null}

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
                  No owner related cost records found.
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
                    <EditRecapIcon size={16} />
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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createScnt,
  fetchScnt,
  fetchScntList,
  fetchScntLookups,
  updateScnt,
  updateScntStatus,
} from '../../../../services/scnt.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './ScntPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! SCNT added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating SCNT.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  businessTypeId: '',
  vesselTypeId: '',
  fromRange: '',
  toRange: '',
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

export default function ScntPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ businessTypes: [], vesselTypes: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const filteredVesselTypes = useMemo(() => {
    if (!form.businessTypeId) return [];
    return (lookups.vesselTypes || []).filter(
      (item) => String(item.businessTypeId) === String(form.businessTypeId),
    );
  }, [lookups.vesselTypes, form.businessTypeId]);

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, [
      'businessTypeName',
      'vesselTypeName',
      'fromRange',
      'toRange',
      'percent',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchScntList();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load SCNT list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const data = await fetchScntLookups();
      setLookups({
        businessTypes: data.businessTypes ?? [],
        vesselTypes: data.vesselTypes ?? [],
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
      const record = await fetchScnt(id);
      setEditId(id);
      setForm({
        businessTypeId: record.businessTypeId || '',
        vesselTypeId: record.vesselTypeId || '',
        fromRange: record.fromRange || '',
        toRange: record.toRange || '',
        percent: record.percent || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load SCNT.');
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
      const result = await updateScntStatus(row.id, row.status);
      setFlash(FLASH_MESSAGES[result.msg ?? 2]);
      await loadList();
    } catch (err) {
      event.target.checked = !nextChecked;
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (Number(form.toRange) < Number(form.fromRange)) {
      setError('To Range must be greater than or equal to From Range.');
      return;
    }
    setSaving(true);
    setError('');
    setFlash(null);
    try {
      const result = editId
        ? await updateScnt(editId, form)
        : await createScnt(form);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save SCNT.');
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
          {editId ? 'Edit SCNT as a % of DWT' : 'Add SCNT as a % of DWT'}
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
              onChange={(e) => setForm((prev) => ({
                ...prev,
                businessTypeId: e.target.value,
                vesselTypeId: '',
              }))}
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
            <span className={styles.label}>Vessel Type</span>
            <select
              className={styles.select}
              value={form.vesselTypeId}
              required
              disabled={!form.businessTypeId}
              onChange={(e) => setForm((prev) => ({ ...prev, vesselTypeId: e.target.value }))}
            >
              <option value="">Select</option>
              {filteredVesselTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>From Range</span>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              value={form.fromRange}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, fromRange: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>To Range</span>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              value={form.toRange}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, toRange: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Rate (Percent)</span>
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
        searchPlaceholder="Search SCNT"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading SCNT…" /> : null}

      <h3 className={styles.title}>SCNT as a % of DWT List</h3>

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
              <th>Vessel Type</th>
              <th>From</th>
              <th>To</th>
              <th>Rate</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={8}>
                  No SCNT records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.businessTypeName || '—'}</td>
                <td>{row.vesselTypeName || '—'}</td>
                <td>{row.fromRange || '—'}</td>
                <td>{row.toRange || '—'}</td>
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

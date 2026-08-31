import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlashState } from '../../../../hooks/useTimedFlash.js';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createSdrRate,
  fetchSdrRate,
  fetchSdrRateLookups,
  fetchSdrRates,
  updateSdrRate,
  updateSdrRateStatus,
} from '../../../../services/sdrRates.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './SdrRatesPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! SDR Rate added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating SDR Rate.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  businessTypeId: '',
  scntBracket: '',
  sdrToUse: '',
  sdrRateBallast: '',
  sdrRateLadenCrude: '',
  sdrRateLadenProducts: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function SdrRatesPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ businessTypes: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useFlashState();
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, [
      'businessTypeName',
      'scntBracket',
      'sdrToUse',
      'sdrRateBallast',
      'sdrRateLadenCrude',
      'sdrRateLadenProducts',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSdrRates();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load SDR Rate list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const data = await fetchSdrRateLookups();
      setLookups({ businessTypes: data.businessTypes ?? [] });
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
      const record = await fetchSdrRate(id);
      setEditId(id);
      setForm({
        businessTypeId: record.businessTypeId || '',
        scntBracket: record.scntBracket || '',
        sdrToUse: record.sdrToUse || '',
        sdrRateBallast: record.sdrRateBallast || '',
        sdrRateLadenCrude: record.sdrRateLadenCrude || '',
        sdrRateLadenProducts: record.sdrRateLadenProducts || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load SDR Rate.');
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
      const result = await updateSdrRateStatus(row.id, row.status);
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
        ? await updateSdrRate(editId, form)
        : await createSdrRate(form);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save SDR Rate.');
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
            <span className={styles.label}>SCNT Bracket</span>
            <input
              className={styles.input}
              type="text"
              value={form.scntBracket}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, scntBracket: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>SDR to Use</span>
            <input
              className={styles.input}
              type="text"
              value={form.sdrToUse}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, sdrToUse: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>SDR Rate Ballast</span>
            <input
              className={styles.input}
              type="text"
              value={form.sdrRateBallast}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, sdrRateBallast: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>SDR Rate Laden Crude</span>
            <input
              className={styles.input}
              type="text"
              value={form.sdrRateLadenCrude}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, sdrRateLadenCrude: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>SDR Rate Laden Products</span>
            <input
              className={styles.input}
              type="text"
              value={form.sdrRateLadenProducts}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, sdrRateLadenProducts: e.target.value }))}
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
        searchPlaceholder="Search SDR rates"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading SDR rates…" /> : null}

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
              <th>SCNT Bracket</th>
              <th>SDR to Use</th>
              <th>SDR Rate Ballast</th>
              <th>SDR Rate Laden Crude</th>
              <th>SDR Rate Laden Products</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={9}>
                  No SDR Rate records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.businessTypeName || '—'}</td>
                <td>{row.scntBracket || '—'}</td>
                <td>{row.sdrToUse || '—'}</td>
                <td>{row.sdrRateBallast || '—'}</td>
                <td>{row.sdrRateLadenCrude || '—'}</td>
                <td>{row.sdrRateLadenProducts || '—'}</td>
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

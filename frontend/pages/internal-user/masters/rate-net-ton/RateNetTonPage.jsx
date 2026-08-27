import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlashState } from '../../../../hooks/useTimedFlash.js';
import { Button, DmyDateInput, dmyToIso, isoToDmy, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createRateNetTon,
  fetchRateNetTon,
  fetchRateNetTonLookups,
  fetchRateNetTons,
  updateRateNetTon,
  updateRateNetTonStatus,
} from '../../../../services/rateNetTons.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './RateNetTonPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Rate Net Ton added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Rate Net Ton.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  fromPeriod: '',
  toPeriod: '',
  rate: '',
  businessTypeId: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function RateNetTonPage() {
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
      'periodLabel',
      'rate',
      'businessTypeName',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchRateNetTons();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load Rate Net Ton list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const data = await fetchRateNetTonLookups();
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
      const record = await fetchRateNetTon(id);
      setEditId(id);
      setForm({
        fromPeriod: isoToDmy(record.fromPeriod),
        toPeriod: isoToDmy(record.toPeriod),
        rate: record.rate || '',
        businessTypeId: record.businessTypeId || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load Rate Net Ton.');
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
      const result = await updateRateNetTonStatus(row.id, row.status);
      setFlash(FLASH_MESSAGES[result.msg ?? 2]);
      await loadList();
    } catch (err) {
      event.target.checked = !nextChecked;
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const fromIso = dmyToIso(form.fromPeriod);
    const toIso = dmyToIso(form.toPeriod);
    if (toIso && fromIso && toIso < fromIso) {
      setError('To Period must be on or after From Period.');
      return;
    }
    setSaving(true);
    setError('');
    setFlash(null);
    const payload = {
      fromPeriod: fromIso,
      toPeriod: toIso,
      rate: form.rate,
      businessTypeId: form.businessTypeId,
    };
    try {
      const result = editId
        ? await updateRateNetTon(editId, payload)
        : await createRateNetTon(payload);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save Rate Net Ton.');
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
          {editId ? 'Update Rate Net Ton' : 'Add New Rate Net Ton'}
        </h3>

        {flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.text}
          </div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>From Period</span>
            <DmyDateInput
              className={styles.input}
              value={form.fromPeriod}
              required
              onChange={(fromPeriod) => {
                setForm((prev) => {
                  const toIso = dmyToIso(prev.toPeriod);
                  const fromIso = dmyToIso(fromPeriod);
                  return {
                    ...prev,
                    fromPeriod,
                    toPeriod: toIso && fromIso && toIso < fromIso ? '' : prev.toPeriod,
                  };
                });
              }}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>To Period</span>
            <DmyDateInput
              className={styles.input}
              value={form.toPeriod}
              required
              onChange={(toPeriod) => setForm((prev) => ({ ...prev, toPeriod }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Rate per Net Ton(NRT) in USD</span>
            <input
              className={styles.input}
              type="text"
              inputMode="decimal"
              placeholder="Enter Rate"
              value={form.rate}
              required
              onChange={(e) => {
                const rate = e.target.value.replace(/[^0-9.]/g, '');
                setForm((prev) => ({ ...prev, rate }));
              }}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Business Type</span>
            <select
              className={styles.select}
              value={form.businessTypeId}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, businessTypeId: e.target.value }))}
            >
              <option value="">---Select Business Type---</option>
              {lookups.businessTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
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
        searchPlaceholder="Search rate net tons"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading rate net tons…" /> : null}

      <h3 className={styles.title}>Rate Net Ton List</h3>

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
              <th>Period</th>
              <th>Rate per Net Ton(NRT) in USD</th>
              <th>Business Type</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={6}>
                  No Rate Net Ton records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.periodLabel || '—'}</td>
                <td>{row.rate || '—'}</td>
                <td>{row.businessTypeName || '—'}</td>
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

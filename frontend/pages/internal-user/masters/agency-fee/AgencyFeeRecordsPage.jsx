import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlashState } from '../../../../hooks/useTimedFlash.js';
import { Button, DmyDateInput, isoToDmy, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import { getLegacyDryoutHref } from '@bainbridge/shared-routing';
import {
  createAgencyFeeRecord,
  fetchAgencyFeeLookups,
  fetchAgencyFeeRecord,
  fetchAgencyFeeRecords,
  updateAgencyFeeRecord,
  updateAgencyFeeRecordStatus,
} from '../../../../services/agencyFeeRecords.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import PortSearchField from './PortSearchField.jsx';
import styles from './AgencyFeeRecordsPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Agency Fee Record added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Agency Fee Record.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  date: '',
  vendorTypeId: '',
  agentId: '',
  portId: '',
  portLabel: '',
  fee: '',
  sundries: '',
  currencyId: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function AgencyFeeRecordsPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ vendorTypes: [], agents: [], currencies: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useFlashState();
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, [
      'agentName', 'portName', 'date', 'fee', 'sundries',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAgencyFeeRecords();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load agency fee records.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const data = await fetchAgencyFeeLookups();
      setLookups(data);
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
      const record = await fetchAgencyFeeRecord(id);
      setEditId(id);
      setForm({
        date: isoToDmy(record.dateValue || ''),
        vendorTypeId: record.vendorTypeId || '',
        agentId: record.agentId || '',
        portId: record.portId || '',
        portLabel: record.portName || '',
        fee: record.fee || '',
        sundries: record.sundries || '',
        currencyId: record.currencyId || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load agency fee record.');
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
      const result = await updateAgencyFeeRecordStatus(row.id, row.status);
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
      date: form.date,
      vendorTypeId: form.vendorTypeId,
      agentId: form.agentId,
      portId: form.portId,
      fee: form.fee,
      sundries: form.sundries,
      currencyId: form.currencyId,
    };
    try {
      const result = editId
        ? await updateAgencyFeeRecord(editId, payload)
        : await createAgencyFeeRecord(payload);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save agency fee record.');
    } finally {
      setSaving(false);
    }
  };

  const handleExcel = () => {
    window.location.href = getLegacyDryoutHref('allExcel.php?id=33');
  };

  if (view === 'form') {
    return (
      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay active label="Loading…" /> : null}
        <div className={styles.formHeader}>
          <Button type="button" variant="outline" label="Back" onClick={backToList} disabled={saving} />
        </div>
        <h3 className={styles.title}>{editId ? 'Edit Agency Fee Record' : 'Add Agency Fee Record'}</h3>

        {flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.text}
          </div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Date</span>
            <DmyDateInput
              className={styles.input}
              value={form.date}
              required
              onChange={(date) => setForm((prev) => ({ ...prev, date }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Vendor Type</span>
            <select
              className={styles.select}
              value={form.vendorTypeId}
              onChange={(e) => setForm((prev) => ({ ...prev, vendorTypeId: e.target.value }))}
            >
              <option value="">---Select from list---</option>
              {lookups.vendorTypes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Agent</span>
            <select
              className={styles.select}
              value={form.agentId}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, agentId: e.target.value }))}
            >
              <option value="">---Select from list---</option>
              {lookups.agents.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Port</span>
            <PortSearchField
              value={form.portId}
              label={form.portLabel}
              required
              onChange={(portId, portLabel) => {
                setForm((prev) => ({ ...prev, portId, portLabel }));
              }}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Fee</span>
            <input
              className={styles.input}
              type="text"
              value={form.fee}
              onChange={(e) => setForm((prev) => ({ ...prev, fee: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Sundries</span>
            <input
              className={styles.input}
              type="text"
              value={form.sundries}
              onChange={(e) => setForm((prev) => ({ ...prev, sundries: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Currency</span>
            <select
              className={styles.select}
              value={form.currencyId}
              onChange={(e) => setForm((prev) => ({ ...prev, currencyId: e.target.value }))}
            >
              <option value="">---Select from list---</option>
              {lookups.currencies.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <div className={styles.formActions}>
            <Button type="submit" variant="primary" label={saving ? 'Saving…' : 'Save'} disabled={saving} />
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
          searchPlaceholder="Search agency fee records"
          onAdd={openAdd}
          onExcel={handleExcel}
        />
      ) : null}

      {loading ? <LoadingOverlay active label="Loading agency fee records…" /> : null}

      <h3 className={styles.title}>Agency Fee Record List</h3>

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
              <th>Agent Name</th>
              <th>Port</th>
              <th>Date</th>
              <th>Fee</th>
              <th>Sundries</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={8}>
                  No agency fee records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.agentName || '—'}</td>
                <td>{row.portName || '—'}</td>
                <td>{row.date || '—'}</td>
                <td>{row.fee || '—'}</td>
                <td>{row.sundries || '—'}</td>
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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlashState } from '../../../../hooks/useTimedFlash.js';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createTerminal,
  fetchTerminal,
  fetchTerminals,
  updateTerminal,
  updateTerminalStatus,
} from '../../../../services/terminals.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import PortSearchField from '../agency-fee/PortSearchField.jsx';
import styles from './TerminalPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Terminal added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Terminal.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  name: '',
  portId: '',
  portLabel: '',
  portCode: '',
  description: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function TerminalPage() {
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
    () => filterMasterRows(rows, searchInput, [
      'name',
      'portName',
      'description',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTerminals();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load Terminal list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadPortCode = async (portId) => {
    if (!portId) return '';
    const params = new URLSearchParams({ portId: String(portId) });
    const response = await fetch(
      `/api/internal-user/masters/port-information/terminals?${params}`,
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to load port details.');
    }
    return data.portCode || '';
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
      const record = await fetchTerminal(id);
      setEditId(id);
      setForm({
        name: record.name || '',
        portId: record.portId || '',
        portLabel: record.portName || '',
        portCode: record.portCode || '',
        description: record.description || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load Terminal.');
    } finally {
      setLoading(false);
    }
  };

  const backToList = () => {
    setView('list');
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const handlePortChange = async (portId, portLabel) => {
    setForm((prev) => ({
      ...prev,
      portId: portId || '',
      portLabel: portLabel || '',
      portCode: '',
    }));
    if (!portId) return;
    try {
      const portCode = await loadPortCode(portId);
      setForm((prev) => ({ ...prev, portCode }));
    } catch (err) {
      setError(err.message || 'Failed to load port details.');
    }
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
      const result = await updateTerminalStatus(row.id, row.status);
      setFlash(FLASH_MESSAGES[result.msg ?? 2]);
      await loadList();
    } catch (err) {
      event.target.checked = !nextChecked;
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.portId && !form.portCode) {
      setError('Port is required.');
      return;
    }
    setSaving(true);
    setError('');
    setFlash(null);
    try {
      const payload = {
        name: form.name,
        portId: form.portId,
        portCode: form.portCode,
        description: form.description,
      };
      const result = editId
        ? await updateTerminal(editId, payload)
        : await createTerminal(payload);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save Terminal.');
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
          {editId ? 'Edit Terminal' : 'Add Terminal'}
        </h3>

        {flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.text}
          </div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Terminal Name</span>
            <input
              className={styles.input}
              type="text"
              value={form.name}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Port</span>
            <PortSearchField
              value={form.portId}
              label={form.portLabel}
              required
              onChange={handlePortChange}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Description</span>
            <textarea
              className={styles.textarea}
              value={form.description}
              rows={3}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
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
        searchPlaceholder="Search terminals"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading terminals…" /> : null}

      <h3 className={styles.title}>Terminal List</h3>

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
              <th>Terminal Name</th>
              <th>Port Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={6}>
                  No Terminal records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.name || '—'}</td>
                <td>{row.portName || '—'}</td>
                <td>{row.description || '—'}</td>
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

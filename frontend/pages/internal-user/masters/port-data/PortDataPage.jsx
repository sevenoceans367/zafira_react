import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlashState } from '../../../../hooks/useTimedFlash.js';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createPortData,
  deletePortData,
  fetchPortData,
  fetchPortDataList,
  fetchPortDataLookups,
  updatePortData,
} from '../../../../services/portData.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import PortSearchField from '../agency-fee/PortSearchField.jsx';
import CountryMultiSelect from '../port-cost-type/CountryMultiSelect.jsx';
import styles from './PortDataPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Port Data added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Port Data.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  portId: '',
  portLabel: '',
  terminalId: '',
  materialIds: [],
  remarks: '',
};

export default function PortDataPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ terminals: [], cargos: [] });
  const [lookupsReady, setLookupsReady] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [readonly, setReadonly] = useState({
    portName: '',
    terminalName: '',
    materialCodeDesc: '',
  });
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useFlashState();
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, [
      'portName',
      'terminalName',
      'materialCodeDesc',
      'remarks',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPortDataList();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load Port Data list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    if (lookupsReady) return;
    try {
      const data = await fetchPortDataLookups();
      setLookups({
        terminals: data.terminals ?? [],
        cargos: data.cargos ?? [],
      });
      setLookupsReady(true);
    } catch (err) {
      setError(err.message || 'Failed to load form lookups.');
    }
  }, [lookupsReady]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openAdd = async () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setReadonly({ portName: '', terminalName: '', materialCodeDesc: '' });
    setExistingAttachments([]);
    setFiles([]);
    setFlash(null);
    setError('');
    setView('form');
    await loadLookups();
  };

  const openEdit = async (id) => {
    setLoading(true);
    setError('');
    setFlash(null);
    try {
      await loadLookups();
      const record = await fetchPortData(id);
      setEditId(id);
      setForm({
        portId: record.portId || '',
        portLabel: record.portName || '',
        terminalId: record.terminalId || '',
        materialIds: record.materialIds ?? [],
        remarks: record.remarks || '',
      });
      setReadonly({
        portName: record.portName || '',
        terminalName: record.terminalName || '',
        materialCodeDesc: record.materialCodeDesc || '',
      });
      setExistingAttachments(record.attachments ?? []);
      setFiles([]);
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load Port Data record.');
    } finally {
      setLoading(false);
    }
  };

  const backToList = () => {
    setView('list');
    setEditId(null);
    setForm(EMPTY_FORM);
    setReadonly({ portName: '', terminalName: '', materialCodeDesc: '' });
    setExistingAttachments([]);
    setFiles([]);
    setError('');
  };

  const removeExistingAttachment = async (file) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to delete this upload permanently ?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    setExistingAttachments((prev) => prev.filter((item) => item.file !== file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!editId) {
      if (!form.portId || !form.terminalId) {
        setError('Port and Terminal are required.');
        return;
      }
      if (!form.materialIds.length) {
        setError('Please select at least one Cargo.');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      if (editId) {
        await updatePortData(
          editId,
          {
            remarks: form.remarks,
            keepUpload: existingAttachments.map((item) => item.file).join(','),
            keepUploadName: existingAttachments.map((item) => item.name).join(','),
          },
          files,
        );
      } else {
        await createPortData(form, files);
      }
      setFlash(FLASH_MESSAGES[0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      setExistingAttachments([]);
      setFiles([]);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save Port Data record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to delete this entry permanently?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      await deletePortData(row.id);
      setFlash(FLASH_MESSAGES[2]);
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to delete Port Data record.');
    } finally {
      setSaving(false);
    }
  };

  if (view === 'form') {
    return (
      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay active label="Loading…" /> : null}

        <div className={styles.formShell}>
          <div className={styles.formHeader}>
            <Button type="button" variant="outline" label="Back" onClick={backToList} disabled={saving} />
          </div>

          <h3 className={styles.title}>
            {editId ? 'Update Port Data' : 'Add Port Data'}
          </h3>
          {error ? <div className={styles.error}>{error}</div> : null}

          <form className={styles.form} onSubmit={handleSubmit}>
            {editId ? (
              <>
                <div className={styles.field}>
                  <span className={styles.label}>Port Name</span>
                  <div className={styles.readonlyValue}>{readonly.portName || '—'}</div>
                </div>
                <div className={styles.field}>
                  <span className={styles.label}>Terminal</span>
                  <div className={styles.readonlyValue}>{readonly.terminalName || '—'}</div>
                </div>
                <div className={styles.field}>
                  <span className={styles.label}>Cargo</span>
                  <div className={styles.readonlyValue}>{readonly.materialCodeDesc || '—'}</div>
                </div>
              </>
            ) : (
              <>
                <label className={styles.field}>
                  <span className={styles.label}>Port Name</span>
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
                  <span className={styles.label}>Terminal</span>
                  <select
                    className={styles.select}
                    value={form.terminalId}
                    required
                    onChange={(e) => setForm((prev) => ({ ...prev, terminalId: e.target.value }))}
                  >
                    <option value="">---Select from list---</option>
                    {lookups.terminals.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>

                <div className={styles.field}>
                  <span className={styles.label}>Cargo</span>
                  <CountryMultiSelect
                    options={lookups.cargos}
                    value={form.materialIds}
                    onChange={(materialIds) => setForm((prev) => ({ ...prev, materialIds }))}
                    placeholder="Choose a Cargo here…"
                    disabled={saving}
                  />
                </div>
              </>
            )}

            <label className={styles.field}>
              <span className={styles.label}>Remarks</span>
              <textarea
                className={styles.textarea}
                value={form.remarks}
                rows={3}
                placeholder="Remarks ..."
                onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
              />
            </label>

            {editId ? (
              <div className={styles.field}>
                <span className={styles.label}>Previous Attachments</span>
                {existingAttachments.length === 0 ? (
                  <span className={styles.muted}>None</span>
                ) : (
                  <div className={styles.attachmentList}>
                    {existingAttachments.map((item) => (
                      <div key={item.file} className={styles.attachmentRow}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.uploadLink}
                          title="Click to view file"
                        >
                          {item.name}
                        </a>
                        <button
                          type="button"
                          className={styles.removeButton}
                          title="Delete upload"
                          onClick={() => removeExistingAttachment(item.file)}
                        >
                          <i className="bi bi-x-lg" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <label className={styles.field}>
              <span className={styles.label}>Attachment</span>
              <input
                className={styles.input}
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
            </label>

            <div className={styles.formActions}>
              <Button type="submit" variant="primary" label={saving ? 'Please wait…' : 'Submit'} disabled={saving} />
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      <MastersHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search Port Data"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading Port Data…" /> : null}

      <h3 className={styles.title}>Port Data List</h3>

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
              <th className={styles.colIndex}>#</th>
              <th className={styles.colPort}>Port</th>
              <th className={styles.colTerminal}>Terminal</th>
              <th className={styles.colCargo}>Cargo</th>
              <th className={styles.colUpload}>Upload</th>
              <th className={styles.colDetails}>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={6}>
                  No Port Data found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td className={styles.colIndex}>{index + 1}.</td>
                <td className={styles.cellClamp}>{row.portName || '—'}</td>
                <td className={styles.cellClamp}>{row.terminalName || '—'}</td>
                <td className={styles.cellClamp}>{row.materialCodeDesc || '—'}</td>
                <td className={styles.colUpload}>
                  {(row.attachments ?? []).length === 0 ? '—' : null}
                  {(row.attachments ?? []).map((item) => (
                    <a
                      key={`${row.id}-${item.file}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.uploadLink}
                      title="Upload"
                    >
                      Upload
                    </a>
                  ))}
                </td>
                <td className={styles.colDetails}>
                  <button
                    type="button"
                    className={styles.editButton}
                    title="Edit Details"
                    onClick={() => openEdit(row.id)}
                  >
                    <i className="bi bi-pencil-square" aria-hidden />
                  </button>
                  <span className={styles.actionSep}>|</span>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    title="Delete Link"
                    onClick={() => handleDelete(row)}
                    disabled={saving}
                  >
                    <i className="bi bi-x-lg" aria-hidden />
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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createMsds,
  deleteMsds,
  fetchMsds,
  fetchMsdsList,
  fetchMsdsLookups,
  updateMsds,
} from '../../../../services/msds.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import PortSearchField from '../agency-fee/PortSearchField.jsx';
import styles from './MsdsPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Material Safety Data Sheet added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Material Safety Data Sheet.' },
  2: { type: 'success', text: 'Entry! Deleted successfully.' },
};

const EMPTY_FORM = {
  materialId: '',
  portId: '',
  portLabel: '',
  vendorId: '',
  remarks: '',
};

export default function MsdsPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ cargos: [], shippers: [] });
  const [lookupsReady, setLookupsReady] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, [
      'cargoName',
      'portName',
      'shipperName',
      'remarks',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchMsdsList();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load MSDS list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    if (lookupsReady) return;
    try {
      const data = await fetchMsdsLookups();
      setLookups({
        cargos: data.cargos ?? [],
        shippers: data.shippers ?? [],
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
      const record = await fetchMsds(id);
      setEditId(id);
      setForm({
        materialId: record.materialId || '',
        portId: record.portId || '',
        portLabel: record.portName || '',
        vendorId: record.vendorId || '',
        remarks: record.remarks || '',
      });
      setExistingAttachments(record.attachments ?? []);
      setFiles([]);
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load MSDS record.');
    } finally {
      setLoading(false);
    }
  };

  const backToList = () => {
    setView('list');
    setEditId(null);
    setForm(EMPTY_FORM);
    setExistingAttachments([]);
    setFiles([]);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.materialId || !form.portId || !form.vendorId) {
      setError('Cargo Name, Port, and Shipper are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await updateMsds(editId, form, files);
      } else {
        await createMsds(form, files);
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
      setError(err.message || 'Failed to save MSDS record.');
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
      await deleteMsds(row.id);
      setFlash(FLASH_MESSAGES[2]);
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to delete MSDS record.');
    } finally {
      setSaving(false);
    }
  };

  if (view === 'form') {
    return (
      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay active label="Loading…" /> : null}

        <div className={styles.formShell}>
          <div className={styles.formTopBar}>
            <Button type="button" variant="outline" label="Back" onClick={backToList} disabled={saving} />
          </div>

          <h3 className={styles.title}>
            {editId ? 'Update Material Safety Data Sheet' : 'Add New Material Safety Data Sheet'}
          </h3>
          {error ? <div className={styles.error}>{error}</div> : null}

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span className={styles.label}>Cargo Name</span>
              <select
                className={styles.select}
                value={form.materialId}
                required
                onChange={(e) => setForm((prev) => ({ ...prev, materialId: e.target.value }))}
              >
                <option value="">---select from list---</option>
                {lookups.cargos.map((item) => (
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
              <span className={styles.label}>Shipper</span>
              <select
                className={styles.select}
                value={form.vendorId}
                required
                onChange={(e) => setForm((prev) => ({ ...prev, vendorId: e.target.value }))}
              >
                <option value="">---select from list---</option>
                {lookups.shippers.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Remarks</span>
              <textarea
                className={styles.textarea}
                value={form.remarks}
                rows={3}
                placeholder="Description ..."
                onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
              />
            </label>

            {editId ? (
              <div className={styles.field}>
                <span className={styles.label}>Previous Upload</span>
                {existingAttachments.length === 0 ? (
                  <span className={styles.muted}>None</span>
                ) : (
                  <div className={styles.attachmentList}>
                    {existingAttachments.map((item) => (
                      <a
                        key={item.file}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.uploadLink}
                        title="View Previous Upload"
                      >
                        {item.name}
                      </a>
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
        searchPlaceholder="Search MSDS"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading Material Safety Data Sheets…" /> : null}

      <h3 className={styles.title}>Material Safety Data Sheets</h3>

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
              <th className={styles.colCargo}>Cargo</th>
              <th className={styles.colPort}>Port</th>
              <th className={styles.colShipper}>Shipper</th>
              <th className={styles.colUpload}>Upload</th>
              <th className={styles.colDetails}>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={6}>
                  No Material Safety Data Sheets found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td className={styles.colIndex}>{index + 1}.</td>
                <td className={styles.cellClamp}>{row.cargoName || '—'}</td>
                <td className={styles.cellClamp}>{row.portName || '—'}</td>
                <td className={styles.cellClamp}>{row.shipperName || '—'}</td>
                <td className={styles.colUpload}>
                  {(row.attachments ?? []).length === 0 ? '—' : null}
                  {(row.attachments ?? []).map((item) => (
                    <a
                      key={`${row.id}-${item.file}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.uploadLink}
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
                    title="Delete Details"
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

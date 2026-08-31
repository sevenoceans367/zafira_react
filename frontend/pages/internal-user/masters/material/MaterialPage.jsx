import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlashState } from '../../../../hooks/useTimedFlash.js';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import { getLegacyDryoutHref } from '@bainbridge/shared-routing';
import {
  createMaterial,
  fetchMaterial,
  fetchMaterials,
  updateMaterial,
  updateMaterialStatus,
} from '../../../../services/materials.js';
import { usePageHeaderHeading } from '../../PageHeaderContext.jsx';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './MaterialPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Cargo added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Cargo.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const MATERIAL_TYPES = [
  { id: '1', label: 'Gas' },
  { id: '2', label: 'Tanker' },
  { id: '3', label: 'Dry Cargo' },
];

const DRY_CARGO_TYPE_ID = '3';

const EMPTY_FORM = {
  materialName: '',
  materialTypeDesc: '',
  materialGroup: '',
  materialGroupDesc: '',
  materialCode: '',
  stowFacMMt: '',
  stowFacFtMt: '',
  materialCodeDesc: '',
  materialTypeId: '1',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function MaterialPage() {
  const confirm = useConfirm();
  const setHeading = usePageHeaderHeading();
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
      'materialName',
      'materialTypeLabel',
      'materialCode',
      'materialGroup',
    ]),
    [rows, searchInput],
  );

  const showStowageFactors = form.materialTypeId === DRY_CARGO_TYPE_ID;

  useEffect(() => {
    if (view === 'form') {
      setHeading({ title: editId ? 'Edit Cargo' : 'Add Cargo' });
    } else {
      setHeading(null);
    }
    return () => setHeading(null);
  }, [view, editId, setHeading]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchMaterials();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load material list.');
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
      const record = await fetchMaterial(id);
      setEditId(id);
      setForm({
        materialName: record.materialName || '',
        materialTypeDesc: record.materialTypeDesc || '',
        materialGroup: record.materialGroup || '',
        materialGroupDesc: record.materialGroupDesc || '',
        materialCode: record.materialCode || '',
        stowFacMMt: record.stowFacMMt || '',
        stowFacFtMt: record.stowFacFtMt || '',
        materialCodeDesc: record.materialCodeDesc || '',
        materialTypeId: record.materialTypeId || '1',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load material.');
    } finally {
      setLoading(false);
    }
  };

  const backToList = () => {
    setView('list');
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const handleExcel = () => {
    window.location.href = getLegacyDryoutHref('allExcel.php?id=20');
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
      const result = await updateMaterialStatus(row.id, row.status);
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
        ? await updateMaterial(editId, form)
        : await createMaterial(form);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save material.');
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
            <span className={styles.label}>Cargo Name</span>
            <input
              className={styles.input}
              type="text"
              value={form.materialName}
              required
              placeholder="Cargo Name"
              autoComplete="off"
              onChange={(e) => setForm((prev) => ({ ...prev, materialName: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Cargo Group</span>
            <input
              className={styles.input}
              type="text"
              value={form.materialGroup}
              placeholder="Cargo Group"
              autoComplete="off"
              onChange={(e) => setForm((prev) => ({ ...prev, materialGroup: e.target.value }))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Cargo Code</span>
            <input
              className={styles.input}
              type="text"
              value={form.materialCode}
              placeholder="Cargo Code"
              autoComplete="off"
              onChange={(e) => setForm((prev) => ({ ...prev, materialCode: e.target.value }))}
            />
          </label>

          {showStowageFactors ? (
            <>
              <label className={styles.field}>
                <span className={styles.label}>Stowage Factor (Cu. M / MT)</span>
                <input
                  className={styles.input}
                  type="text"
                  value={form.stowFacMMt}
                  placeholder="Stowage Factor(Cu. M / MT)"
                  autoComplete="off"
                  onChange={(e) => setForm((prev) => ({ ...prev, stowFacMMt: e.target.value }))}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Stowage Factor (Cu. Ft / MT)</span>
                <input
                  className={styles.input}
                  type="text"
                  value={form.stowFacFtMt}
                  placeholder="Stowage Factor(Cu. Ft / MT)"
                  autoComplete="off"
                  onChange={(e) => setForm((prev) => ({ ...prev, stowFacFtMt: e.target.value }))}
                />
              </label>
            </>
          ) : null}

          <label className={styles.field}>
            <span className={styles.label}>Cargo Description</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={form.materialCodeDesc}
              placeholder="Cargo Description ..."
              onChange={(e) => setForm((prev) => ({ ...prev, materialCodeDesc: e.target.value }))}
            />
          </label>

          <fieldset className={styles.field}>
            <legend className={styles.label}>Trade Type</legend>
            <div className={styles.radioGroup}>
              {MATERIAL_TYPES.map((item) => (
                <label key={item.id} className={styles.radioOption}>
                  <input
                    type="radio"
                    name="materialTypeId"
                    value={item.id}
                    checked={form.materialTypeId === item.id}
                    onChange={(e) => {
                      const materialTypeId = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        materialTypeId,
                        ...(materialTypeId === DRY_CARGO_TYPE_ID
                          ? {}
                          : { stowFacMMt: '', stowFacFtMt: '' }),
                      }));
                    }}
                  />
                  <strong>{item.label}</strong>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.formActions}>
            <Button
              type="submit"
              variant="submit"
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
        searchPlaceholder="Search cargo"
        onAdd={openAdd}
        onExcel={handleExcel}
      />

      {loading ? <LoadingOverlay active label="Loading cargo…" /> : null}

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
              <th>Cargo Name</th>
              <th>Trade Type</th>
              <th>Cargo Code</th>
              <th>Cargo Group</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={7}>
                  No cargo records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.materialName || '—'}</td>
                <td>{row.materialTypeLabel || '—'}</td>
                <td>{row.materialCode || '—'}</td>
                <td>{row.materialGroup || '—'}</td>
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

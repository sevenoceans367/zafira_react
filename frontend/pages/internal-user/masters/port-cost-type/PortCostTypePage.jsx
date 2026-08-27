import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlashState } from '../../../../hooks/useTimedFlash.js';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createPortCostTypes,
  fetchPortCostType,
  fetchPortCostTypeLookups,
  fetchPortCostTypes,
  updatePortCostType,
  updatePortCostTypeStatus,
} from '../../../../services/portCostTypes.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import CountryMultiSelect from './CountryMultiSelect.jsx';
import styles from './PortCostTypePage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Port Cost Type added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Port Cost Type.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  countryIds: [],
  names: [''],
  name: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

export default function PortCostTypePage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ countries: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useFlashState();
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, ['name', 'countryNames']),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPortCostTypes();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load port cost type list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const data = await fetchPortCostTypeLookups();
      setLookups({ countries: data.countries ?? [] });
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
    setForm({ ...EMPTY_FORM, names: [''], countryIds: [] });
    setView('form');
    setFlash(null);
    setError('');
  };

  const openEdit = async (id) => {
    setLoading(true);
    setError('');
    try {
      const record = await fetchPortCostType(id);
      setEditId(id);
      setForm({
        countryIds: (record.countryIds || []).map(String),
        names: [''],
        name: record.name || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load port cost type.');
    } finally {
      setLoading(false);
    }
  };

  const backToList = () => {
    setView('list');
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const handleCountryChange = (selected) => {
    setForm((prev) => ({ ...prev, countryIds: selected }));
  };

  const handleNameRowChange = (index, value) => {
    setForm((prev) => {
      const names = [...prev.names];
      names[index] = value;
      return { ...prev, names };
    });
  };

  const addNameRow = () => {
    setForm((prev) => ({ ...prev, names: [...prev.names, ''] }));
  };

  const removeNameRow = (index) => {
    setForm((prev) => {
      if (prev.names.length <= 1) return prev;
      return { ...prev, names: prev.names.filter((_, i) => i !== index) };
    });
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
      const result = await updatePortCostTypeStatus(row.id, row.status);
      setFlash(FLASH_MESSAGES[result.msg ?? 2]);
      await loadList();
    } catch (err) {
      event.target.checked = !nextChecked;
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.countryIds.length === 0) {
      setError('At least one country is required.');
      return;
    }
    if (!editId && !form.names.some((name) => String(name || '').trim())) {
      setError('Port Cost Type is required.');
      return;
    }
    setSaving(true);
    setError('');
    setFlash(null);
    try {
      const result = editId
        ? await updatePortCostType(editId, {
          name: form.name,
          countryIds: form.countryIds,
        })
        : await createPortCostTypes({
          names: form.names,
          countryIds: form.countryIds,
        });
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save port cost type.');
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
          {editId ? 'Update Port Cost Type' : 'Add Port Cost Type'}
        </h3>

        {flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.text}
          </div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <span className={styles.label}>Countries</span>
            <CountryMultiSelect
              options={lookups.countries}
              value={form.countryIds}
              onChange={handleCountryChange}
              placeholder="Choose countries…"
              disabled={saving}
            />
            <span className={styles.hint}>Select one or more countries. Each appears as a tag you can remove.</span>
          </div>

          {editId ? (
            <label className={styles.field}>
              <span className={styles.label}>Port Cost Type</span>
              <input
                className={styles.input}
                type="text"
                value={form.name}
                required
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </label>
          ) : (
            <div className={styles.field}>
              <span className={styles.label}>Port Cost Type</span>
              <div className={styles.nameRows}>
                {form.names.map((name, index) => (
                  <div key={`name-${index}`} className={styles.nameRow}>
                    <input
                      className={styles.input}
                      type="text"
                      value={name}
                      required={index === 0}
                      placeholder="Enter port cost type"
                      onChange={(e) => handleNameRowChange(index, e.target.value)}
                    />
                    {index === 0 ? (
                      <Button type="button" variant="primary" label="Add" onClick={addNameRow} />
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        label="Remove"
                        onClick={() => removeNameRow(index)}
                      />
                    )}
                  </div>
                ))}
              </div>
              <span className={styles.hint}>Use Add to create multiple port cost types with the same countries.</span>
            </div>
          )}

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
        searchPlaceholder="Search port cost types"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading port cost types…" /> : null}

      <h3 className={styles.title}>Port Cost Type List</h3>

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
              <th>Port Cost Type</th>
              <th>Countries</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={5}>
                  No port cost type records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.name || '—'}</td>
                <td>{row.countryNames || '—'}</td>
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

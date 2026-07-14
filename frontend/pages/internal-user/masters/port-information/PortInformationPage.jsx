import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import {
  createPortInformation,
  fetchPortInformation,
  fetchPortInformationList,
  fetchPortInformationLookups,
  fetchPortInformationTerminals,
  updatePortInformation,
  updatePortInformationStatus,
} from '../../../../services/portInformation.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import PortSearchField from '../agency-fee/PortSearchField.jsx';
import styles from './PortInformationPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Port Information added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Port Information.' },
  2: { type: 'success', text: 'Congratulations! Status changed successfully.' },
};

const EMPTY_FORM = {
  cargoId: '',
  portId: '',
  portLabel: '',
  portCode: '',
  terminalId: '',
  maxDraft: '',
  maxLoa: '',
  maxBeam: '',
  maxHeight: '',
  loadingMethod: '',
  displacement: '',
  craneOutReach: '',
  hatchDimension: '',
  loadingRateDay: '',
  dischRateDay: '',
  dwt: '',
  dcts: '',
  loader: '',
  remarks: '',
};

function StatusToggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider} />
    </label>
  );
}

function setField(setter, key) {
  return (event) => setter((prev) => ({ ...prev, [key]: event.target.value }));
}

export default function PortInformationPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ cargos: [], loaders: [] });
  const [terminals, setTerminals] = useState([]);
  const [lookupsReady, setLookupsReady] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [readonly, setReadonly] = useState({
    cargoName: '',
    portName: '',
    terminalName: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, [
      'portName',
      'cargoName',
      'terminalName',
      'remarks',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPortInformationList();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load Port Information list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    if (lookupsReady) return;
    try {
      const data = await fetchPortInformationLookups();
      setLookups({
        cargos: data.cargos ?? [],
        loaders: data.loaders ?? [],
      });
      setLookupsReady(true);
    } catch (err) {
      setError(err.message || 'Failed to load form lookups.');
    }
  }, [lookupsReady]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadTerminalsForPort = async (portId) => {
    if (!portId) {
      setTerminals([]);
      return '';
    }
    const data = await fetchPortInformationTerminals(portId);
    setTerminals(data.terminals ?? []);
    return data.portCode || '';
  };

  const openAdd = async () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setReadonly({ cargoName: '', portName: '', terminalName: '' });
    setTerminals([]);
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
      const record = await fetchPortInformation(id);
      setEditId(id);
      setForm({
        ...EMPTY_FORM,
        cargoId: record.cargoId || '',
        portCode: record.portCode || '',
        terminalId: record.terminalId || '',
        maxDraft: record.maxDraft || '',
        maxLoa: record.maxLoa || '',
        maxBeam: record.maxBeam || '',
        maxHeight: record.maxHeight || '',
        loadingMethod: record.loadingMethod || '',
        displacement: record.displacement || '',
        craneOutReach: record.craneOutReach || '',
        hatchDimension: record.hatchDimension || '',
        loadingRateDay: record.loadingRateDay || '',
        dischRateDay: record.dischRateDay || '',
        dwt: record.dwt || '',
        dcts: record.dcts || '',
        loader: record.loader || '',
        remarks: record.remarks || '',
      });
      setReadonly({
        cargoName: record.cargoName || '',
        portName: record.portName || '',
        terminalName: record.terminalName || '',
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load Port Information record.');
    } finally {
      setLoading(false);
    }
  };

  const backToList = () => {
    setView('list');
    setEditId(null);
    setForm(EMPTY_FORM);
    setReadonly({ cargoName: '', portName: '', terminalName: '' });
    setTerminals([]);
    setError('');
  };

  const handlePortChange = async (portId, portLabel) => {
    setForm((prev) => ({
      ...prev,
      portId,
      portLabel,
      portCode: '',
      terminalId: '',
    }));
    try {
      const portCode = await loadTerminalsForPort(portId);
      setForm((prev) => ({ ...prev, portCode }));
    } catch (err) {
      setTerminals([]);
      setError(err.message || 'Failed to load terminals for port.');
    }
  };

  const handleStatusToggle = async (row, event) => {
    const nextChecked = event.target.checked;
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Do you want to change status?',
      confirmLabel: 'Yes',
      cancelLabel: 'Cancel',
    });
    if (!ok) {
      event.target.checked = !nextChecked;
      return;
    }

    setSaving(true);
    setError('');
    try {
      await updatePortInformationStatus(row.id, row.status);
      setFlash(FLASH_MESSAGES[2]);
      await loadList();
    } catch (err) {
      event.target.checked = !nextChecked;
      setError(err.message || 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!editId) {
      if (!form.cargoId || !form.portCode || !form.terminalId) {
        setError('Cargo Name, Port Name, and Terminal are required.');
        return;
      }
    } else if (!form.loader) {
      setError('Loader (Y/N) is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editId) {
        await updatePortInformation(editId, form);
      } else {
        await createPortInformation(form);
      }
      setFlash(FLASH_MESSAGES[0]);
      setView('list');
      setEditId(null);
      setForm(EMPTY_FORM);
      setTerminals([]);
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save Port Information record.');
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
            {editId ? 'Update Port Information' : 'Add Port Information'}
          </h3>
          {error ? <div className={styles.error}>{error}</div> : null}

          <form className={styles.form} onSubmit={handleSubmit}>
            {editId ? (
              <>
                <div className={styles.field}>
                  <span className={styles.label}>Cargo Name</span>
                  <div className={styles.readonlyValue}>{readonly.cargoName || '—'}</div>
                </div>
                <div className={styles.field}>
                  <span className={styles.label}>Port Name</span>
                  <div className={styles.readonlyValue}>{readonly.portName || '—'}</div>
                </div>
                <div className={styles.field}>
                  <span className={styles.label}>Terminal</span>
                  <div className={styles.readonlyValue}>{readonly.terminalName || '—'}</div>
                </div>
              </>
            ) : (
              <>
                <label className={styles.field}>
                  <span className={styles.label}>Cargo Name</span>
                  <select
                    className={styles.select}
                    value={form.cargoId}
                    required
                    onChange={setField(setForm, 'cargoId')}
                  >
                    <option value="">---Select from list---</option>
                    {lookups.cargos.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Port Name</span>
                  <PortSearchField
                    value={form.portId}
                    label={form.portLabel}
                    required
                    onChange={handlePortChange}
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Terminal</span>
                  <select
                    className={styles.select}
                    value={form.terminalId}
                    required
                    disabled={!form.portCode}
                    onChange={setField(setForm, 'terminalId')}
                  >
                    <option value="">---Select from list---</option>
                    {terminals.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label className={styles.field}>
              <span className={styles.label}>Max Draft (M)</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={form.maxDraft}
                placeholder="Max Draft (M)"
                required={Boolean(editId)}
                onChange={setField(setForm, 'maxDraft')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Max LOA(M)</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={form.maxLoa}
                placeholder="Max LOA(M)"
                onChange={setField(setForm, 'maxLoa')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Max Beam(M)</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={form.maxBeam}
                placeholder="Max Beam(M)"
                onChange={setField(setForm, 'maxBeam')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Air Draft</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={form.maxHeight}
                placeholder="Air Draft"
                onChange={setField(setForm, 'maxHeight')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Loading Method</span>
              <textarea
                className={styles.textarea}
                value={form.loadingMethod}
                onChange={setField(setForm, 'loadingMethod')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Displacement (MT)</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={form.displacement}
                placeholder="Displacement (MT)"
                onChange={setField(setForm, 'displacement')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Crane out reach</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={form.craneOutReach}
                placeholder="Crane out reach"
                onChange={setField(setForm, 'craneOutReach')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Hatch Dimension</span>
              <input
                className={styles.input}
                type="text"
                value={form.hatchDimension}
                placeholder="Hatch Dimension"
                onChange={setField(setForm, 'hatchDimension')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Loading Rate ( MT/Day)</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={form.loadingRateDay}
                placeholder="Loading Rate ( MT/Day)"
                onChange={setField(setForm, 'loadingRateDay')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Disch Rate ( MT/Day)</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={form.dischRateDay}
                placeholder="Disch Rate ( MT/Day)"
                onChange={setField(setForm, 'dischRateDay')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>DWT ( MT )</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={form.dwt}
                placeholder="DWT ( MT )"
                onChange={setField(setForm, 'dwt')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Height of Conveyor (M)</span>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={form.dcts}
                placeholder="Height of Conveyor (M)"
                onChange={setField(setForm, 'dcts')}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Loader (Y/N)</span>
              <select
                className={styles.select}
                value={form.loader}
                required={Boolean(editId)}
                onChange={setField(setForm, 'loader')}
              >
                <option value="">---Select from list---</option>
                {lookups.loaders.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Remarks</span>
              <textarea
                className={styles.textarea}
                value={form.remarks}
                onChange={setField(setForm, 'remarks')}
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
        searchPlaceholder="Search Port Information"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading Port Information…" /> : null}

      <h3 className={styles.title}>Port Information List</h3>

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
              <th>Port Name</th>
              <th>Cargo Name</th>
              <th>Terminal</th>
              <th className={styles.colStatus}>Status</th>
              <th className={styles.colDetails}>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={6}>
                  No Port Information found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td className={styles.colIndex}>{index + 1}.</td>
                <td className={styles.cellClamp}>{row.portName || '—'}</td>
                <td className={styles.cellClamp}>{row.cargoName || '—'}</td>
                <td className={styles.cellClamp}>{row.terminalName || '—'}</td>
                <td className={styles.colStatus}>
                  <StatusToggle
                    checked={row.status === 1}
                    onChange={(event) => handleStatusToggle(row, event)}
                  />
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

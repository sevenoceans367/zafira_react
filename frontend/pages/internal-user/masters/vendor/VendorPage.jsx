import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import {
  createVendor,
  fetchVendor,
  fetchVendorLookups,
  fetchVendors,
  updateVendor,
} from '../../../../services/vendors.js';
import MastersHeaderActions from '../MastersHeaderActions.jsx';
import { filterMasterRows } from '../filterMasterRows.js';
import styles from './VendorPage.module.css';

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Vendor added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Vendor.' },
};

function emptyBankRow() {
  return {
    randomId: String(Math.floor(10000 + Math.random() * 90000)),
    name: '',
    address: '',
    accountNo: '',
    ibanNo: '',
    ibanRemarks: '',
    bankName: '',
    bankAddress: '',
    swiftCode: '',
    usCorrBank: '',
  };
}

const EMPTY_FORM = {
  vendorTypeId: '',
  name: '',
  shortName: '',
  code: '',
  vatNumber: '',
  street1: '',
  street2: '',
  city: '',
  country: '',
  postalCode: '',
  phone: '',
  fax: '',
  email: '',
  bankingDetails: '',
  footerDetails: '',
  bankRows: [emptyBankRow()],
};

function setField(setter, key) {
  return (event) => setter((prev) => ({ ...prev, [key]: event.target.value }));
}

export default function VendorPage() {
  const [view, setView] = useState('list');
  const [editId, setEditId] = useState(null);
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ vendorTypes: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const filteredRows = useMemo(
    () => filterMasterRows(rows, searchInput, [
      'vendorTypeName',
      'name',
      'shortName',
      'code',
      'accountNos',
      'slaveAddress',
      'ibanNos',
    ]),
    [rows, searchInput],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchVendors();
      setRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load Vendor list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const data = await fetchVendorLookups();
      setLookups({ vendorTypes: data.vendorTypes ?? [] });
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
    setForm({ ...EMPTY_FORM, bankRows: [emptyBankRow()] });
    setView('form');
    setFlash(null);
    setError('');
  };

  const openEdit = async (id) => {
    setLoading(true);
    setError('');
    try {
      const record = await fetchVendor(id);
      setEditId(id);
      setForm({
        vendorTypeId: record.vendorTypeId || '',
        name: record.name || '',
        shortName: record.shortName || '',
        code: record.code || '',
        vatNumber: record.vatNumber || '',
        street1: record.street1 || '',
        street2: record.street2 || '',
        city: record.city || '',
        country: record.country || '',
        postalCode: record.postalCode || '',
        phone: record.phone || '',
        fax: record.fax || '',
        email: record.email || '',
        bankingDetails: record.bankingDetails || '',
        footerDetails: record.footerDetails || '',
        bankRows: (record.bankRows && record.bankRows.length)
          ? record.bankRows.map((row) => ({
            randomId: row.randomId || String(Math.floor(10000 + Math.random() * 90000)),
            name: row.name || '',
            address: row.address || '',
            accountNo: row.accountNo || '',
            ibanNo: row.ibanNo || '',
            ibanRemarks: row.ibanRemarks || '',
            bankName: row.bankName || '',
            bankAddress: row.bankAddress || '',
            swiftCode: row.swiftCode || '',
            usCorrBank: row.usCorrBank || '',
          }))
          : [emptyBankRow()],
      });
      setView('form');
    } catch (err) {
      setError(err.message || 'Failed to load Vendor.');
    } finally {
      setLoading(false);
    }
  };

  const backToList = () => {
    setView('list');
    setEditId(null);
    setForm({ ...EMPTY_FORM, bankRows: [emptyBankRow()] });
  };

  const updateBankRow = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      bankRows: prev.bankRows.map((row, i) => (
        i === index ? { ...row, [key]: value } : row
      )),
    }));
  };

  const addBankRow = () => {
    setForm((prev) => ({
      ...prev,
      bankRows: [...prev.bankRows, emptyBankRow()],
    }));
  };

  const removeBankRow = (index) => {
    setForm((prev) => {
      const nextRows = prev.bankRows.filter((_, i) => i !== index);
      return {
        ...prev,
        bankRows: nextRows.length ? nextRows : [emptyBankRow()],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFlash(null);
    try {
      const payload = {
        ...form,
        bankRows: form.bankRows,
      };
      const result = editId
        ? await updateVendor(editId, payload)
        : await createVendor(payload);
      setFlash(FLASH_MESSAGES[result.msg ?? 0]);
      setView('list');
      setEditId(null);
      setForm({ ...EMPTY_FORM, bankRows: [emptyBankRow()] });
      await loadList();
    } catch (err) {
      setFlash(FLASH_MESSAGES[1]);
      setError(err.message || 'Failed to save Vendor.');
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
          {editId ? 'Edit Vendor' : 'Add Vendor'}
        </h3>

        {flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.text}
          </div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={`${styles.form} ${styles.formWide}`} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Vendor Type</span>
            <select
              className={styles.select}
              value={form.vendorTypeId}
              required
              onChange={setField(setForm, 'vendorTypeId')}
            >
              <option value="">Select</option>
              {lookups.vendorTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Name</span>
            <input
              className={styles.input}
              type="text"
              value={form.name}
              required
              onChange={setField(setForm, 'name')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Short Name</span>
            <input
              className={styles.input}
              type="text"
              value={form.shortName}
              required
              onChange={setField(setForm, 'shortName')}
            />
          </label>

          {editId ? (
            <div className={styles.field}>
              <span className={styles.label}>Code</span>
              <div className={styles.readonlyValue}>{form.code || '—'}</div>
            </div>
          ) : null}

          <label className={styles.field}>
            <span className={styles.label}>VAT Number</span>
            <input
              className={styles.input}
              type="text"
              value={form.vatNumber}
              onChange={setField(setForm, 'vatNumber')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Address 1</span>
            <input
              className={styles.input}
              type="text"
              value={form.street1}
              onChange={setField(setForm, 'street1')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Person Incharge</span>
            <input
              className={styles.input}
              type="text"
              value={form.street2}
              onChange={setField(setForm, 'street2')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>City</span>
            <input
              className={styles.input}
              type="text"
              value={form.city}
              onChange={setField(setForm, 'city')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Country</span>
            <input
              className={styles.input}
              type="text"
              value={form.country}
              onChange={setField(setForm, 'country')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Postal Code</span>
            <input
              className={styles.input}
              type="text"
              value={form.postalCode}
              onChange={setField(setForm, 'postalCode')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Phone</span>
            <input
              className={styles.input}
              type="text"
              value={form.phone}
              onChange={setField(setForm, 'phone')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Fax</span>
            <input
              className={styles.input}
              type="text"
              value={form.fax}
              onChange={setField(setForm, 'fax')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={setField(setForm, 'email')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Banking Details</span>
            <textarea
              className={styles.textarea}
              value={form.bankingDetails}
              rows={3}
              onChange={setField(setForm, 'bankingDetails')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Footer Details</span>
            <textarea
              className={styles.textarea}
              value={form.footerDetails}
              rows={3}
              onChange={setField(setForm, 'footerDetails')}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Bank Details</span>
            <div className={styles.tableWrap}>
              <table className={styles.bankTable}>
                <thead>
                  <tr>
                    <th>Beneficiary Name</th>
                    <th>Address</th>
                    <th>Account No</th>
                    <th>IBAN</th>
                    <th>IBAN Remarks</th>
                    <th>Bank Name</th>
                    <th>Bank Address</th>
                    <th>Swift</th>
                    <th>US Corr Bank</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {form.bankRows.map((row, index) => (
                    <tr key={row.randomId || index}>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={row.name}
                          onChange={(e) => updateBankRow(index, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={row.address}
                          onChange={(e) => updateBankRow(index, 'address', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={row.accountNo}
                          onChange={(e) => updateBankRow(index, 'accountNo', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={row.ibanNo}
                          onChange={(e) => updateBankRow(index, 'ibanNo', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={row.ibanRemarks}
                          onChange={(e) => updateBankRow(index, 'ibanRemarks', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={row.bankName}
                          onChange={(e) => updateBankRow(index, 'bankName', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={row.bankAddress}
                          onChange={(e) => updateBankRow(index, 'bankAddress', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={row.swiftCode}
                          onChange={(e) => updateBankRow(index, 'swiftCode', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          type="text"
                          value={row.usCorrBank}
                          onChange={(e) => updateBankRow(index, 'usCorrBank', e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.removeButton}
                          title="Remove row"
                          onClick={() => removeBankRow(index)}
                        >
                          <i className="bi bi-trash" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.bankActions}>
              <Button type="button" variant="outline" label="Add row" onClick={addBankRow} />
            </div>
          </div>

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
        searchPlaceholder="Search vendors"
        onAdd={openAdd}
      />

      {loading ? <LoadingOverlay active label="Loading vendors…" /> : null}

      <h3 className={styles.title}>Vendor List</h3>

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
              <th>Vendor Type</th>
              <th>Name</th>
              <th>Short Name</th>
              <th>Code</th>
              <th>Account No</th>
              <th>Address</th>
              <th>IBAN</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan={9}>
                  No Vendor records found.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}.</td>
                <td>{row.vendorTypeName || '—'}</td>
                <td>{row.name || '—'}</td>
                <td>{row.shortName || '—'}</td>
                <td>{row.code || '—'}</td>
                <td>{row.accountNos || '—'}</td>
                <td>{row.slaveAddress || '—'}</td>
                <td>{row.ibanNos || '—'}</td>
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

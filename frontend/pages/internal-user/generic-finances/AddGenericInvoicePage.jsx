import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  CardSelect,
  DmyDateInput,
  Field,
  LoadingOverlay,
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import {
  createGenericInvoice,
  fetchBankingDetail,
  fetchGenericInvoiceLookups,
  fetchVendorBanking,
} from '../../../services/genericFinances.js';
import styles from './AddGenericInvoicePage.module.css';

const EMPTY_LINE = () => ({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, description: '', amount: '' });

const EMPTY_FORM = {
  type: 'invoice',
  selFromOwner: '',
  selContractType: '',
  selVendor: '',
  txtContractDetails: '',
  selBType: '2',
  selIType: '',
  txtAttenName: '',
  txtInvoiceNo: '',
  txtInvoiceDate: '',
  txtDueDate: '',
  selExchangeCurrency: 'USD',
  txtPaymentTerms: '',
  txtDesc: '',
  selNOB: '',
  txtAmountDesc: '',
  txtMainAmount: '',
  payment_status: '',
  selApprovers: [],
};

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function FormSelect({ id, label, value, options, onChange, required = false }) {
  return (
    <Field id={id} label={required ? `${label} *` : label}>
      <div className={styles.cardSelect}>
        <CardSelect
          value={value || ''}
          options={options}
          placeholder="----Select From List----"
          ariaLabel={label}
          align="start"
          onChange={onChange}
        />
      </div>
    </Field>
  );
}

function BankingPanel({ detail }) {
  if (!detail) return null;
  return (
    <div className={styles.bankPanel}>
      <table>
        <tbody>
          <tr><td>Address</td><td>{detail.address || '—'}</td></tr>
          <tr><td>Beneficiary A/C No.</td><td>{detail.accountNo || '—'}</td></tr>
          <tr><td>Beneficiary Bank</td><td>{detail.bank || detail.name || '—'}</td></tr>
          <tr><td>Beneficiary Bank Address</td><td>{detail.bankAddress || '—'}</td></tr>
          <tr><td>Beneficiary Bank Swift Code</td><td>{detail.swiftCode || '—'}</td></tr>
          <tr><td>IBAN No.</td><td>{detail.ibanNo || '—'}</td></tr>
          <tr><td>FED ABA</td><td>{detail.fedAba || '—'}</td></tr>
          <tr className={styles.corrHead}><td colSpan={2}>CORRESPONDENT DETAILS</td></tr>
          <tr><td>Correspondent Bank Name</td><td>{detail.correspondentBankName || '—'}</td></tr>
          <tr><td>Correspondent Bank Address</td><td>{detail.correspondentBankAddress || '—'}</td></tr>
          <tr><td>Account Number</td><td>{detail.correspondentAccountNo || '—'}</td></tr>
          <tr><td>Swift Code</td><td>{detail.correspondentSwiftCode || '—'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export default function AddGenericInvoicePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alert = useAlert();
  const confirm = useConfirm();

  const listPath = appPath('/internal-user/vc/generic-finances');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookups, setLookups] = useState(null);
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    selBType: searchParams.get('selBType') || '2',
  }));
  const [addRows, setAddRows] = useState([EMPTY_LINE()]);
  const [subRows, setSubRows] = useState([EMPTY_LINE()]);
  const [files, setFiles] = useState([]);
  const [bankingOptions, setBankingOptions] = useState([]);
  const [bankingDetail, setBankingDetail] = useState(null);
  const [vendorBankMode, setVendorBankMode] = useState(false);

  const netAmount = useMemo(() => {
    const add = addRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const sub = subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    return (parseAmount(form.txtMainAmount) + add - sub).toFixed(2);
  }, [form.txtMainAmount, addRows, subRows]);

  const loadLookups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchGenericInvoiceLookups();
      setLookups(data.lookups || {});
      setBankingOptions(data.lookups?.bankingDetails || []);
      setVendorBankMode(false);
    } catch (err) {
      setError(err.message || 'Failed to load invoice form.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectedVendor = useMemo(() => {
    const vendors = lookups?.vendors || [];
    return vendors.find((row) => String(row.id) === String(form.selVendor));
  }, [lookups, form.selVendor]);

  const refreshBankingForVendor = useCallback(async (vendor, type, companyBanks) => {
    if (type !== 'payment' || !vendor?.vendorId) {
      setVendorBankMode(false);
      setBankingOptions(companyBanks || []);
      return;
    }
    try {
      const data = await fetchVendorBanking(vendor.vendorId);
      const rows = data.records || [];
      setVendorBankMode(true);
      setBankingOptions(rows.map((row) => ({
        id: row.id,
        name: row.name || row.bank || `Bank ${row.id}`,
        detail: row,
      })));
      setForm((current) => ({ ...current, selNOB: '' }));
      setBankingDetail(null);
    } catch {
      setVendorBankMode(false);
      setBankingOptions(companyBanks || []);
    }
  }, []);

  useEffect(() => {
    if (!lookups) return;
    refreshBankingForVendor(selectedVendor, form.type, lookups.bankingDetails || []);
  }, [lookups, selectedVendor, form.type, refreshBankingForVendor]);

  const handleBankingChange = async (value) => {
    updateField('selNOB', value);
    if (!value) {
      setBankingDetail(null);
      return;
    }
    if (vendorBankMode) {
      const option = bankingOptions.find((row) => String(row.id) === String(value));
      setBankingDetail(option?.detail || null);
      return;
    }
    try {
      const detail = await fetchBankingDetail(value);
      setBankingDetail(detail);
    } catch {
      setBankingDetail(null);
    }
  };

  const updateLine = (collection, setCollection, id, patch) => {
    setCollection((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addLine = (rows, setRows) => {
    const last = rows[rows.length - 1];
    if (!last || (!String(last.description || '').trim() && !String(last.amount || '').trim())) {
      return;
    }
    if (!String(last.description || '').trim() || !String(last.amount || '').trim()) {
      return;
    }
    setRows((current) => [...current, EMPTY_LINE()]);
  };

  const removeLine = async (rows, setRows, id) => {
    if (rows.length <= 1) {
      setRows([EMPTY_LINE()]);
      return;
    }
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to remove this entry permanently?',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const validateClient = async (status) => {
    const missing = [
      [form.selFromOwner, 'Invoicing Company'],
      [form.selVendor, 'To (Vendor)'],
      [form.txtContractDetails, 'Contract Details'],
      [form.selIType, 'Invoice Type'],
      [form.txtInvoiceNo, 'Invoice Number'],
      [form.txtInvoiceDate, 'Invoice Date'],
      [form.txtDueDate, 'Due Date'],
      [form.selExchangeCurrency, 'Working Currency'],
      [form.txtPaymentTerms, 'Payment Terms'],
      [form.txtDesc, 'Description'],
      [form.selNOB, 'Banking Details'],
      [form.txtAmountDesc, 'Amount Description'],
      [form.txtMainAmount, 'Main Amount'],
    ].find(([value]) => !String(value || '').trim());

    if (missing) {
      await alert({
        title: 'Missing Information',
        message: `Please fill ${missing[1]}.`,
        confirmLabel: 'OK',
      });
      return false;
    }

    if (Number(status) === 1 && !(form.selApprovers || []).length) {
      await alert({
        title: 'Missing Information',
        message: 'Please select Level 1 Approvers first.',
        confirmLabel: 'OK',
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (status) => {
    const ok = await validateClient(status);
    if (!ok) return;

    if (Number(status) !== 0) {
      const confirmed = await confirm({
        title: 'Confirmation',
        message: 'Are you sure you want to Submit?',
        confirmLabel: 'OK',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'selApprovers') return;
        payload.append(key, value ?? '');
      });
      payload.append('txtStatus', String(status));
      payload.append('txtNetAmtPayable', netAmount);
      payload.append('addRows', JSON.stringify(
        addRows
          .filter((row) => String(row.description || '').trim() || String(row.amount || '').trim())
          .map((row) => ({ description: row.description, amount: row.amount })),
      ));
      payload.append('subRows', JSON.stringify(
        subRows
          .filter((row) => String(row.description || '').trim() || String(row.amount || '').trim())
          .map((row) => ({ description: row.description, amount: row.amount })),
      ));
      (form.selApprovers || []).forEach((id) => payload.append('selApprovers', id));
      files.forEach((file) => payload.append('attach_file', file));

      await createGenericInvoice(payload);
      navigate(`${listPath}?msg=0&selBType=${encodeURIComponent(form.selBType || '2')}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to create invoice.');
      await alert({
        title: 'Error',
        message: err.message || 'Failed to create invoice.',
        confirmLabel: 'OK',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <LoadingOverlay show label="Loading…" />
      </div>
    );
  }

  const approvalStatus = lookups?.sendForApprovalStatus ?? 1;

  return (
    <div className={styles.page}>
      <LoadingOverlay show={saving} label="Saving…" />
      <div className={styles.toolbar}>
        <Button
          type="button"
          variant="outline"
          label="Back"
          onClick={() => navigate(listPath)}
        />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.topGrid}>
        <FormSelect
          id="gfType"
          label="Type"
          value={form.type}
          options={lookups?.typeOptions || []}
          onChange={(value) => updateField('type', value)}
        />
        <FormSelect
          id="gfOwner"
          label="Invoicing Company"
          required
          value={form.selFromOwner}
          options={lookups?.owners || []}
          onChange={(value) => updateField('selFromOwner', value)}
        />
        <FormSelect
          id="gfContractType"
          label="Contract Type"
          value={form.selContractType}
          options={lookups?.contractTypes || []}
          onChange={(value) => updateField('selContractType', value)}
        />
        <FormSelect
          id="gfVendor"
          label="To"
          required
          value={form.selVendor}
          options={lookups?.vendors || []}
          onChange={(value) => updateField('selVendor', value)}
        />
        <Field id="gfContractDetails" label="Contract Details *" className={styles.span2}>
          <textarea
            id="gfContractDetails"
            rows={3}
            value={form.txtContractDetails}
            onChange={(e) => updateField('txtContractDetails', e.target.value)}
            placeholder="Description"
          />
        </Field>
      </div>

      <div className={styles.split}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Invoice Details</h3>
          <div className={styles.sectionBody}>
            <div className={styles.fieldGrid}>
              <label htmlFor="gfBType">Business Type</label>
              <div className={styles.cardSelect}>
                <CardSelect
                  value={form.selBType}
                  options={lookups?.businessTypes || []}
                  ariaLabel="Business Type"
                  align="start"
                  onChange={(value) => updateField('selBType', value)}
                />
              </div>

              <label htmlFor="gfIType">Invoice Type *</label>
              <div className={styles.cardSelect}>
                <CardSelect
                  value={form.selIType}
                  options={lookups?.invoiceTypes || []}
                  placeholder="----Select From List----"
                  ariaLabel="Invoice Type"
                  align="start"
                  onChange={(value) => updateField('selIType', value)}
                />
              </div>

              <label htmlFor="gfAtten">Attn</label>
              <input
                id="gfAtten"
                value={form.txtAttenName}
                onChange={(e) => updateField('txtAttenName', e.target.value)}
                placeholder="Attn"
              />

              <label htmlFor="gfInvoiceNo">Invoice Number *</label>
              <input
                id="gfInvoiceNo"
                value={form.txtInvoiceNo}
                onChange={(e) => updateField('txtInvoiceNo', e.target.value)}
                placeholder="Invoice No."
              />

              <label htmlFor="gfInvoiceDate">Invoice Date *</label>
              <DmyDateInput
                id="gfInvoiceDate"
                value={form.txtInvoiceDate}
                onChange={(value) => updateField('txtInvoiceDate', value)}
              />

              <label htmlFor="gfDueDate">Due Date *</label>
              <DmyDateInput
                id="gfDueDate"
                value={form.txtDueDate}
                onChange={(value) => updateField('txtDueDate', value)}
              />

              <label htmlFor="gfCurrency">Working Currency *</label>
              <div className={styles.cardSelect}>
                <CardSelect
                  value={form.selExchangeCurrency}
                  options={lookups?.currencies || []}
                  ariaLabel="Working Currency"
                  align="start"
                  onChange={(value) => updateField('selExchangeCurrency', value)}
                />
              </div>

              <label htmlFor="gfPayTerms">Payment Terms *</label>
              <input
                id="gfPayTerms"
                value={form.txtPaymentTerms}
                onChange={(e) => updateField('txtPaymentTerms', e.target.value)}
                placeholder="Payment Terms"
              />

              <label htmlFor="gfDesc">Description *</label>
              <textarea
                id="gfDesc"
                rows={3}
                value={form.txtDesc}
                onChange={(e) => updateField('txtDesc', e.target.value)}
                placeholder="Description"
              />

              <label htmlFor="gfBank">Banking Details *</label>
              <div className={styles.cardSelect}>
                <CardSelect
                  value={form.selNOB}
                  options={bankingOptions}
                  placeholder="----Select From List----"
                  ariaLabel="Banking Details"
                  align="start"
                  onChange={handleBankingChange}
                />
              </div>

              <label htmlFor="gfAttach">Documents</label>
              <div>
                <input
                  id="gfAttach"
                  type="file"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                />
                {files.length ? (
                  <p className={styles.muted}>{files.length} file(s) selected</p>
                ) : null}
              </div>
            </div>
            <BankingPanel detail={bankingDetail} />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Amounts</h3>
          <div className={styles.sectionBody}>
            <table className={styles.amountTable}>
              <tbody>
                <tr>
                  <th>Description *</th>
                  <td>
                    <textarea
                      rows={3}
                      value={form.txtAmountDesc}
                      onChange={(e) => updateField('txtAmountDesc', e.target.value)}
                      placeholder="Description"
                    />
                  </td>
                  <td>
                    <input
                      value={form.txtMainAmount}
                      inputMode="decimal"
                      placeholder="Amount"
                      onChange={(e) => updateField('txtMainAmount', e.target.value)}
                    />
                  </td>
                </tr>
                <tr>
                  <th colSpan={3}>Other Add</th>
                </tr>
                {addRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        title="Remove"
                        aria-label="Remove add row"
                        onClick={() => removeLine(addRows, setAddRows, row.id)}
                      >
                        <i className="bi bi-trash3" aria-hidden />
                      </button>
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={row.description}
                        placeholder="Description..."
                        onChange={(e) => updateLine(addRows, setAddRows, row.id, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.amount}
                        inputMode="decimal"
                        placeholder="Amount"
                        onChange={(e) => updateLine(addRows, setAddRows, row.id, { amount: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}>
                    <Button type="button" variant="primary" label="Add" onClick={() => addLine(addRows, setAddRows)} />
                  </td>
                </tr>
                <tr>
                  <th colSpan={3}>Other Less</th>
                </tr>
                {subRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        title="Remove"
                        aria-label="Remove less row"
                        onClick={() => removeLine(subRows, setSubRows, row.id)}
                      >
                        <i className="bi bi-trash3" aria-hidden />
                      </button>
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={row.description}
                        placeholder="Description..."
                        onChange={(e) => updateLine(subRows, setSubRows, row.id, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.amount}
                        inputMode="decimal"
                        placeholder="Amount"
                        onChange={(e) => updateLine(subRows, setSubRows, row.id, { amount: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}>
                    <Button type="button" variant="primary" label="Add" onClick={() => addLine(subRows, setSubRows)} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={2}><strong>Total Amount Invoiced</strong></td>
                  <td>
                    <input value={netAmount} readOnly />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Invoice</h3>
        <div className={styles.sectionBody}>
          <div className={styles.paymentStatus}>
            <label>
              <input
                type="radio"
                name="payment_status"
                checked={form.payment_status === 'payment_hold'}
                onChange={() => updateField('payment_status', 'payment_hold')}
              />
              Invoice Hold
            </label>
            <label>
              <input
                type="radio"
                name="payment_status"
                checked={form.payment_status === 'payment_payable'}
                onChange={() => updateField('payment_status', 'payment_payable')}
              />
              Invoice Payable
            </label>
          </div>

          <div className={styles.approverRow}>
            <div>Level 1 Approver</div>
            <CountryMultiSelect
              options={lookups?.approvers || []}
              value={form.selApprovers}
              onChange={(value) => updateField('selApprovers', value)}
              placeholder="Choose Approver..."
              searchPlaceholder="Search approver…"
            />
          </div>
        </div>
      </section>

      <div className={styles.footer}>
        <Button
          type="button"
          variant="primary"
          label="Submit to edit"
          disabled={saving}
          onClick={() => handleSubmit(0)}
        />
        <Button
          type="button"
          variant="accent"
          label="Send for Approval"
          disabled={saving}
          onClick={() => handleSubmit(approvalStatus)}
        />
      </div>
    </div>
  );
}

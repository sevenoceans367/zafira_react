import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import OpsVcBackHeaderActions from '../ops/OpsVcBackHeaderActions.jsx';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import {
  createGenericInvoice,
  fetchBankingDetail,
  fetchGenericInvoice,
  fetchGenericInvoiceLookups,
  fetchVendorBanking,
  updateGenericInvoice,
} from '../../../services/genericFinances.js';
import styles from './AddGenericInvoicePage.module.css';

const INVOICE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <g transform="translate(3.5,2)">
      <path d="M11.2378,0.761771171 L4.5848,0.761771171 C2.5048,0.7538 0.7998,2.4118 0.7508,4.4908 L0.7508,15.2038 C0.7048,17.3168 2.3798,19.0678 4.4928,19.1148 C4.5238,19.1148 4.5538,19.1158 4.5848,19.1148 L12.5738,19.1148 C14.6678,19.0298 16.3178,17.2998 16.3029015,15.2038 L16.3029015,6.0378 L11.2378,0.761771171 Z" />
      <path d="M10.9751,0.75 L10.9751,3.659 C10.9751,5.079 12.1231,6.23 13.5431,6.234 L16.2981,6.234" />
      <line x1="10.7881" y1="13.3585" x2="5.3881" y2="13.3585" />
      <line x1="8.7432" y1="9.606" x2="5.3872" y2="9.606" />
    </g>
  </svg>
);

function PageHeading({ title }) {
  const setHeading = usePageHeaderHeading();
  useLayoutEffect(() => {
    setHeading({ title, icon: INVOICE_ICON });
  }, [setHeading, title]);
  useEffect(() => () => setHeading(null), [setHeading]);
  return null;
}

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
  payment_status: 'payment_payable',
  selApprovers: [],
};

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return parseAmount(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function InvoiceCard({ num, title, children }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardNum}>{num}</span>
          <div className={styles.cardTitle}>{title}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function FormSelect({ id, label, value, options, onChange, required = false, className = '' }) {
  return (
    <Field
      id={id}
      label={required ? (
        <>
          {label} <span className={styles.req}>*</span>
        </>
      ) : label}
      className={[styles.field, className].filter(Boolean).join(' ')}
    >
      <div className={styles.cardSelect}>
        <CardSelect
          value={value || ''}
          options={options}
          placeholder="Select from list"
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
          <tr className={styles.corrHead}><td colSpan={2}>Correspondent Details</td></tr>
          <tr><td>Correspondent Bank Name</td><td>{detail.correspondentBankName || '—'}</td></tr>
          <tr><td>Correspondent Bank Address</td><td>{detail.correspondentBankAddress || '—'}</td></tr>
          <tr><td>Account Number</td><td>{detail.correspondentAccountNo || '—'}</td></tr>
          <tr><td>Swift Code</td><td>{detail.correspondentSwiftCode || '—'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function AttachDropzone({ files, onFiles }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const selected = files?.length
    ? `${files.length} file(s) selected`
    : 'No documents attached yet';

  return (
    <div
      className={`${styles.dropzone} ${over ? styles.dropzoneOver : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onFiles(Array.from(event.dataTransfer.files || []));
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M21 12.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9.5" />
        <path d="M16 3l5 5-9 9H7v-5z" />
      </svg>
      <div className={styles.dzText}>
        Drag & drop files here, or{' '}
        <span
          className={styles.dzBrowse}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
          }}
        >
          browse
        </span>
      </div>
      <div className={styles.dzSub}>{selected}</div>
      <button type="button" className={styles.attachBtn} onClick={() => inputRef.current?.click()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M21 12.5l-8.4 8.4a5 5 0 0 1-7-7L14 5.5a3.5 3.5 0 0 1 5 5L10.5 19a2 2 0 0 1-3-3l7.7-7.7" />
        </svg>
        Attach
      </button>
      <input
        ref={inputRef}
        className={styles.hiddenFile}
        type="file"
        multiple
        onChange={(event) => onFiles(Array.from(event.target.files || []))}
      />
    </div>
  );
}

function AdjSide({ title, tag, tagClass, rows, onUpdate, onAdd, onRemove }) {
  return (
    <div className={styles.adjSide}>
      <div className={styles.adjLabel}>
        <span className={`${styles.adjTag} ${tagClass}`}>{tag}</span>
        {title}
      </div>
      <div className={styles.adjHead}>
        <span>Description</span>
        <span>Amount</span>
        <span />
      </div>
      {rows.map((row) => (
        <div key={row.id} className={styles.adjRow}>
          <input
            className={styles.input}
            value={row.description}
            placeholder="Description…"
            onChange={(e) => onUpdate(row.id, { description: e.target.value })}
          />
          <input
            className={styles.input}
            value={row.amount}
            inputMode="decimal"
            placeholder="Amount"
            onChange={(e) => onUpdate(row.id, { amount: e.target.value })}
          />
          <button
            type="button"
            className={styles.adjRowX}
            title="Remove"
            aria-label="Remove row"
            onClick={() => onRemove(row.id)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button type="button" className={styles.adjRowAdd} title="Add row" aria-label="Add row" onClick={onAdd}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

export default function AddGenericInvoicePage() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const [searchParams] = useSearchParams();
  const alert = useAlert();
  const confirm = useConfirm();
  const isEdit = Boolean(invoiceId);

  const listPath = appPath('/internal-user/vc/generic-finances');
  const pageTitle = isEdit ? 'Update Generic Invoice' : 'Add Generic Invoice';

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
  const [vendorBanks, setVendorBanks] = useState([]);
  const [bankingDetail, setBankingDetail] = useState(null);
  const [vendorBankMode, setVendorBankMode] = useState(false);

  const netAmount = useMemo(() => {
    const add = addRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const sub = subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    return (parseAmount(form.txtMainAmount) + add - sub).toFixed(2);
  }, [form.txtMainAmount, addRows, subRows]);

  const companyBanks = useMemo(
    () => (lookups?.bankingDetails || []).map((row) => ({
      id: String(row.id ?? row.BD_ID ?? ''),
      name: row.name || row.NAME || String(row.id ?? ''),
    })).filter((row) => row.id),
    [lookups],
  );

  const bankingOptions = useMemo(
    () => (vendorBankMode && vendorBanks.length ? vendorBanks : companyBanks),
    [vendorBankMode, vendorBanks, companyBanks],
  );

  const loadLookups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchGenericInvoiceLookups();
      const nextLookups = data.lookups || data || {};
      setLookups(nextLookups);
      setVendorBankMode(false);
      setVendorBanks([]);
      if (!invoiceId) return;

      const invoice = await fetchGenericInvoice(invoiceId);
      const nextForm = { ...EMPTY_FORM, ...(invoice.form || {}) };
      if (!nextForm.payment_status) nextForm.payment_status = 'payment_payable';
      setForm(nextForm);
      const mappedAdd = (invoice.addRows || []).map((row) => ({
        ...EMPTY_LINE(),
        description: row.description || '',
        amount: row.amount || '',
      }));
      const mappedSub = (invoice.subRows || []).map((row) => ({
        ...EMPTY_LINE(),
        description: row.description || '',
        amount: row.amount || '',
      }));
      setAddRows(mappedAdd.length ? [...mappedAdd, EMPTY_LINE()] : [EMPTY_LINE()]);
      setSubRows(mappedSub.length ? [...mappedSub, EMPTY_LINE()] : [EMPTY_LINE()]);
      if (nextForm.selNOB) {
        try {
          const detail = await fetchBankingDetail(nextForm.selNOB);
          setBankingDetail(detail);
        } catch {
          setBankingDetail(null);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load invoice form.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

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

  const refreshBankingForVendor = useCallback(async (vendor, type) => {
    if (String(type || '').toLowerCase() !== 'payment' || !vendor?.vendorId) {
      setVendorBankMode(false);
      setVendorBanks([]);
      return;
    }
    try {
      const data = await fetchVendorBanking(vendor.vendorId);
      const rows = data.records || data || [];
      const mapped = rows.map((row) => ({
        id: String(row.id),
        name: row.name || row.bank || `Bank ${row.id}`,
        detail: row,
      }));
      setVendorBankMode(true);
      setVendorBanks(mapped);
      setForm((current) => {
        const match = mapped.find((row) => String(row.id) === String(current.selNOB));
        if (match) {
          if (match.detail) setBankingDetail(match.detail);
          return current;
        }
        setBankingDetail(null);
        return { ...current, selNOB: '' };
      });
    } catch {
      setVendorBankMode(false);
      setVendorBanks([]);
    }
  }, []);

  useEffect(() => {
    if (!lookups) return;
    refreshBankingForVendor(selectedVendor, form.type);
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

  const updateLine = (setCollection, id, patch) => {
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

      if (isEdit) {
        await updateGenericInvoice(invoiceId, payload);
        navigate(`${listPath}?msg=4&selBType=${encodeURIComponent(form.selBType || '2')}`, { replace: true });
      } else {
        await createGenericInvoice(payload);
        navigate(`${listPath}?msg=0&selBType=${encodeURIComponent(form.selBType || '2')}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || (isEdit ? 'Failed to update invoice.' : 'Failed to create invoice.'));
      await alert({
        title: 'Error',
        message: err.message || (isEdit ? 'Failed to update invoice.' : 'Failed to create invoice.'),
        confirmLabel: 'OK',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <PageHeading title={pageTitle} />
        <OpsVcBackHeaderActions backHref={listPath} />
        <LoadingOverlay show label="Loading…" />
      </div>
    );
  }

  const approvalStatus = lookups?.sendForApprovalStatus ?? 1;
  const isHold = form.payment_status === 'payment_hold';

  return (
    <div className={styles.page}>
      <PageHeading title={pageTitle} />
      <OpsVcBackHeaderActions backHref={listPath} disabled={saving} />
      <LoadingOverlay show={saving} label="Saving…" />

      {error ? <div className={styles.error}>{error}</div> : null}

      <InvoiceCard num="1" title="Invoice Details">
        <div className={styles.grid4}>
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
        </div>
        <Field id="gfContractDetails" label={<>Contract Details <span className={styles.req}>*</span></>} className={`${styles.field} ${styles.mt14}`}>
          <textarea
            id="gfContractDetails"
            className={styles.textarea}
            rows={3}
            value={form.txtContractDetails}
            onChange={(e) => updateField('txtContractDetails', e.target.value)}
            placeholder="Description"
          />
        </Field>
      </InvoiceCard>

      <InvoiceCard num="2" title="Invoice & Payment Details">
        <div className={styles.grid4}>
          <FormSelect
            id="gfBType"
            label="Business Type"
            value={form.selBType}
            options={lookups?.businessTypes || []}
            onChange={(value) => updateField('selBType', value)}
          />
          <FormSelect
            id="gfIType"
            label="Invoice Type"
            required
            value={form.selIType}
            options={lookups?.invoiceTypes || []}
            onChange={(value) => updateField('selIType', value)}
          />
          <Field id="gfAtten" label="Attn" className={styles.field}>
            <input
              id="gfAtten"
              className={styles.input}
              value={form.txtAttenName}
              onChange={(e) => updateField('txtAttenName', e.target.value)}
              placeholder="Attn"
            />
          </Field>
          <Field id="gfInvoiceNo" label={<>Invoice Number <span className={styles.req}>*</span></>} className={styles.field}>
            <input
              id="gfInvoiceNo"
              className={styles.input}
              value={form.txtInvoiceNo}
              onChange={(e) => updateField('txtInvoiceNo', e.target.value)}
              placeholder="Invoice No."
            />
          </Field>
          <Field id="gfInvoiceDate" label={<>Invoice Date <span className={styles.req}>*</span></>} className={styles.field}>
            <DmyDateInput
              id="gfInvoiceDate"
              value={form.txtInvoiceDate}
              onChange={(value) => updateField('txtInvoiceDate', value)}
            />
          </Field>
          <Field id="gfDueDate" label={<>Due Date <span className={styles.req}>*</span></>} className={styles.field}>
            <DmyDateInput
              id="gfDueDate"
              value={form.txtDueDate}
              onChange={(value) => updateField('txtDueDate', value)}
            />
          </Field>
          <FormSelect
            id="gfCurrency"
            label="Working Currency"
            required
            value={form.selExchangeCurrency}
            options={lookups?.currencies || []}
            onChange={(value) => updateField('selExchangeCurrency', value)}
          />
          <Field id="gfPayTerms" label={<>Payment Terms <span className={styles.req}>*</span></>} className={styles.field}>
            <input
              id="gfPayTerms"
              className={styles.input}
              value={form.txtPaymentTerms}
              onChange={(e) => updateField('txtPaymentTerms', e.target.value)}
              placeholder="Payment Terms"
            />
          </Field>
          <FormSelect
            id="gfBank"
            label="Banking Details"
            required
            value={form.selNOB}
            options={bankingOptions}
            onChange={handleBankingChange}
          />
          <Field
            id="gfDesc"
            label={<>Description <span className={styles.req}>*</span></>}
            className={`${styles.field} ${styles.span3}`}
          >
            <textarea
              id="gfDesc"
              className={styles.textarea}
              style={{ minHeight: 38 }}
              rows={2}
              value={form.txtDesc}
              onChange={(e) => updateField('txtDesc', e.target.value)}
              placeholder="Description"
            />
          </Field>
        </div>
        <BankingPanel detail={bankingDetail} />
      </InvoiceCard>

      <InvoiceCard num="3" title="Amount">
        <div className={`${styles.grid2} ${styles.mb18}`}>
          <Field id="gfAmtDesc" label={<>Description <span className={styles.req}>*</span></>} className={styles.field}>
            <textarea
              id="gfAmtDesc"
              className={styles.textarea}
              style={{ minHeight: 38 }}
              rows={2}
              value={form.txtAmountDesc}
              onChange={(e) => updateField('txtAmountDesc', e.target.value)}
              placeholder="Description"
            />
          </Field>
          <Field id="gfMainAmt" label="Amount" className={styles.field}>
            <input
              id="gfMainAmt"
              className={styles.input}
              value={form.txtMainAmount}
              inputMode="decimal"
              placeholder="Amount"
              onChange={(e) => updateField('txtMainAmount', e.target.value)}
            />
          </Field>
        </div>

        <div className={styles.adjTwoCol}>
          <AdjSide
            title="Other Add"
            tag="Add"
            tagClass={styles.adjTagAdd}
            rows={addRows}
            onUpdate={(id, patch) => updateLine(setAddRows, id, patch)}
            onAdd={() => addLine(addRows, setAddRows)}
            onRemove={(id) => removeLine(addRows, setAddRows, id)}
          />
          <div className={styles.adjDivider} aria-hidden />
          <AdjSide
            title="Other Less"
            tag="Less"
            tagClass={styles.adjTagLess}
            rows={subRows}
            onUpdate={(id, patch) => updateLine(setSubRows, id, patch)}
            onAdd={() => addLine(subRows, setSubRows)}
            onRemove={(id) => removeLine(subRows, setSubRows, id)}
          />
        </div>

        <div className={styles.totalTile}>
          <div className={styles.ttLabel}>Total Invoiced</div>
          <div className={styles.ttValue}>{formatMoney(netAmount)}</div>
        </div>
      </InvoiceCard>

      <InvoiceCard num="4" title="Documents & Approval">
        <div className={styles.mb16}>
          <AttachDropzone files={files} onFiles={setFiles} />
        </div>
        <div className={`${styles.grid2} ${styles.mb16}`}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Invoice Status</span>
            <div className={`${styles.statusToggle} ${isHold ? styles.statusHold : ''}`}>
              <div className={styles.stThumb} />
              <button
                type="button"
                className={`${styles.stOpt} ${!isHold ? styles.stActive : ''}`}
                onClick={() => updateField('payment_status', 'payment_payable')}
              >
                Payable
              </button>
              <button
                type="button"
                className={`${styles.stOpt} ${isHold ? styles.stActive : ''}`}
                onClick={() => updateField('payment_status', 'payment_hold')}
              >
                On Hold
              </button>
            </div>
          </div>
          <Field id="gfApprover" label="Level 1 Approver" className={styles.field}>
            <CountryMultiSelect
              options={lookups?.approvers || []}
              value={form.selApprovers}
              onChange={(value) => updateField('selApprovers', value)}
              placeholder="Choose Approver…"
              searchPlaceholder="Search approver…"
            />
          </Field>
        </div>
        <div className={styles.actionRow}>
          <Button
            type="button"
            variant="outline"
            label="Save"
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
      </InvoiceCard>
    </div>
  );
}

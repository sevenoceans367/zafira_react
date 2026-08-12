import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import {
  cancelOtherInvoice,
  deleteOtherInvoice,
  downloadOtherInvoicePdf,
  fetchOtherInvoiceBanking,
  fetchOtherInvoiceForm,
  receiveOtherInvoicePayment,
  reopenOtherInvoice,
  saveOtherInvoice,
} from '../../../services/opsVc.js';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import styles from './OpsVcOtherInvoicePage.module.css';

const EMPTY_LINE = () => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  description: '',
  amount: '',
});

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function money2(value) {
  return Number(parseAmount(value).toFixed(2));
}

function strOrEmpty(value) {
  if (value == null) return '';
  return String(value).trim();
}

function withClientIds(rows, factory) {
  if (!Array.isArray(rows) || !rows.length) return [factory()];
  return rows.map((row) => ({
    ...factory(),
    ...row,
    id: row.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    description: strOrEmpty(row.description),
    amount: row.amount == null || row.amount === '' ? '' : String(row.amount),
  }));
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

function BankingPanel({ detail, cBankCheck, onCBankCheckChange }) {
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
          <tr className={styles.corrHead}>
            <td colSpan={2}>
              <label className={styles.corrCheck}>
                <input
                  type="checkbox"
                  checked={Boolean(cBankCheck)}
                  onChange={(event) => onCBankCheckChange?.(event.target.checked)}
                />
                CORRESPONDENT DETAILS
              </label>
            </td>
          </tr>
          {cBankCheck ? (
            <>
              <tr><td>Correspondent Bank Name</td><td>{detail.correspondentBankName || '—'}</td></tr>
              <tr><td>Correspondent Bank Address</td><td>{detail.correspondentBankAddress || '—'}</td></tr>
              <tr><td>Account Number</td><td>{detail.correspondentAccountNo || '—'}</td></tr>
              <tr><td>Swift Code</td><td>{detail.correspondentSwiftCode || '—'}</td></tr>
              {detail.ifsc ? <tr><td>IFSC</td><td>{detail.ifsc}</td></tr> : null}
            </>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ChecklistSection({ title, rows, onToggle }) {
  if (!rows?.length) return null;
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>
        <ul className={styles.checklist}>
          {rows.map((row) => {
            const key = row.id ?? row.randomId ?? `${row.port}-${row.portId}`;
            const label = row.portLabel || row.identityId || row.port || '—';
            return (
              <li key={key} className={styles.checklistItem}>
                <label className={styles.checklistMain}>
                  <input
                    type="checkbox"
                    checked={Boolean(row.checked)}
                    disabled={Boolean(row.disabled)}
                    onChange={() => onToggle(key)}
                  />
                  <span>{label}</span>
                </label>
                <span />
                <input
                  className={styles.input}
                  readOnly
                  value={money2(row.amount).toFixed(2)}
                  aria-label={`${label} amount`}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function PaymentModal({ invoice, onClose, onSubmit }) {
  const [amount, setAmount] = useState(invoice?.amount || '');
  const [paymentDate, setPaymentDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit({ amount, paymentDate, remarks });
    } catch (err) {
      setError(err.message || 'Failed to record payment.');
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Payment received"
        onClick={(event) => event.stopPropagation()}
      >
        <h4 className={styles.modalTitle}>
          Payment Received — {invoice?.invoiceNo || invoice?.invoiceId}
        </h4>
        {error ? <div className={styles.modalError}>{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <div className={styles.modalField}>
            <label htmlFor="oiPaymentAmount">Amount</label>
            <input
              id="oiPaymentAmount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
            />
          </div>
          <div className={styles.modalField}>
            <label htmlFor="oiPaymentDate">Payment Date</label>
            <DmyDateInput
              id="oiPaymentDate"
              value={paymentDate}
              onChange={setPaymentDate}
              required
            />
          </div>
          <div className={styles.modalField}>
            <label htmlFor="oiPaymentRemarks">Remarks</label>
            <textarea
              id="oiPaymentRemarks"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
          <div className={styles.modalActions}>
            <Button type="button" variant="outline" label="Cancel" onClick={onClose} />
            <Button type="submit" variant="primary" label={saving ? 'Saving…' : 'Submit'} disabled={saving} />
          </div>
        </form>
      </div>
    </div>
  );
}

function LineSection({ title, rows, onAdd, onRemove, onUpdate }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>
        <table className={styles.linesTable}>
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>Description</th>
              <th style={{ width: '18%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => onRemove(row.id)}
                    aria-label={`Remove ${title} row`}
                  >
                    ×
                  </button>
                </td>
                <td>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={row.description}
                    onChange={(event) => onUpdate(row.id, { description: event.target.value })}
                    placeholder="Description..."
                  />
                </td>
                <td>
                  <input
                    className={styles.input}
                    value={row.amount}
                    onChange={(event) => onUpdate(row.id, { amount: event.target.value })}
                    placeholder="Amount"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.lineActions}>
          <Button variant="outline" size="sm" label="Add row" onClick={onAdd} />
        </div>
      </div>
    </div>
  );
}

/**
 * React port of PHP invoice_others.php (Demurrage Invoice/Payment + Other Income Invoice).
 */
export default function OpsVcOtherInvoicePage() {
  const alert = useAlert();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();

  const id = searchParams.get('id') || '';
  const name = searchParams.get('name') || '';
  const amountTitle = searchParams.get('amountTitle') || searchParams.get('amounttitle') || '';
  const page = searchParams.get('page') || '1';
  const portType = searchParams.get('portType') || searchParams.get('porttype') || '';
  const randomId = searchParams.get('randomId') || searchParams.get('randomid') || '';
  const portId = searchParams.get('portId') || searchParams.get('portid') || '';
  const voyageNo = searchParams.get('voyageNo') || searchParams.get('voyage_no') || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState(null);
  const [form, setForm] = useState({});
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState(null);
  const [addRows, setAddRows] = useState([EMPTY_LINE()]);
  const [subRows, setSubRows] = useState([EMPTY_LINE()]);
  const [demRows, setDemRows] = useState([]);
  const [otherIncomeRows, setOtherIncomeRows] = useState([]);
  const [attachFiles, setAttachFiles] = useState([]);
  const [existingUpload, setExistingUpload] = useState('');
  const [existingUploadName, setExistingUploadName] = useState('');
  const [bankingDetail, setBankingDetail] = useState(null);
  const [cBankCheck, setCBankCheck] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const backHref = useMemo(() => {
    const comId = context?.comId || id.split(',')[0] || '';
    return appPath(
      `/internal-user/vc/ops/payment-grid?comid=${encodeURIComponent(comId)}&page=${encodeURIComponent(page)}`,
    );
  }, [context?.comId, id, page]);

  const ownerOptions = useMemo(
    () => (context?.owners || []).map((row) => ({ value: row.id, label: row.name })),
    [context?.owners],
  );
  const invTypeOptions = useMemo(
    () => (context?.invTypes || [
      { id: 'Interim', name: 'Interim' },
      { id: 'Final', name: 'Final' },
    ]).map((row) => ({ value: row.id, label: row.name })),
    [context?.invTypes],
  );
  const currencyOptions = useMemo(
    () => (context?.currencies || []).map((row) => ({ value: row.id, label: row.name })),
    [context?.currencies],
  );

  const netForBanking = useMemo(() => {
    const gross = parseAmount(form.grossAmt);
    const club = [...demRows, ...otherIncomeRows]
      .filter((row) => row.checked)
      .reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const addTotal = addRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const subTotal = subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    return money2(gross + club + addTotal - subTotal);
  }, [form.grossAmt, demRows, otherIncomeRows, addRows, subRows]);

  const bankingOptions = useMemo(() => {
    const useVendor = netForBanking < 0 && (context?.vendorBanking || []).length;
    const source = useVendor ? (context?.vendorBanking || []) : (context?.bankingDetails || []);
    return [
      { value: '', label: '----Select From List----' },
      ...source.map((row) => ({
        value: String(row.id),
        label: row.name || String(row.id),
      })),
    ];
  }, [context?.bankingDetails, context?.vendorBanking, netForBanking]);

  const auth = useMemo(() => {
    const fromCtx = context?.auth || {};
    return {
      creator: Boolean(fromCtx.creator ?? true),
      approver1: Boolean(fromCtx.approver1),
      approver2: Boolean(fromCtx.approver2),
      isMgmtUser: Boolean(fromCtx.isMgmtUser),
      sendForApprovalStatus: Number(
        fromCtx.sendForApprovalStatus
          ?? context?.sendForApprovalStatus
          ?? 1,
      ),
      hasApp1: Boolean(fromCtx.hasApp1 ?? true),
      hasApp2: Boolean(fromCtx.hasApp2),
    };
  }, [context]);

  const totals = useMemo(() => {
    const gross = parseAmount(form.grossAmt);
    const clubTotal = [...demRows, ...otherIncomeRows]
      .filter((row) => row.checked)
      .reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const addTotal = addRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const subTotal = subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const netPayable = money2(gross + clubTotal + addTotal - subTotal);

    const sgstAmount = money2((netPayable * parseAmount(form.sgstPercent)) / 100);
    const cgstAmount = money2((netPayable * parseAmount(form.cgstPercent)) / 100);
    const igstAmount = money2((netPayable * parseAmount(form.igstPercent)) / 100);
    const vatAmount = money2((netPayable * parseAmount(form.vatPercent)) / 100);

    let netPayableTax = netPayable;
    if (String(form.taxApplicable) === '1') {
      if (String(form.gstVat) === '1') {
        netPayableTax = money2(netPayable + sgstAmount + cgstAmount + igstAmount);
      } else {
        netPayableTax = money2(netPayable + vatAmount);
      }
    }

    const exchangeRate = parseAmount(form.exchangeRate);
    const exchanged = exchangeRate > 0 ? money2(netPayableTax * exchangeRate) : 0;

    return {
      clubTotal,
      netPayable,
      sgstAmount,
      cgstAmount,
      igstAmount,
      vatAmount,
      netPayableTax,
      exchanged,
    };
  }, [
    form.grossAmt,
    form.taxApplicable,
    form.gstVat,
    form.sgstPercent,
    form.cgstPercent,
    form.igstPercent,
    form.vatPercent,
    form.exchangeRate,
    addRows,
    subRows,
    demRows,
    otherIncomeRows,
  ]);

  const applyContext = useCallback((data) => {
    setContext(data);
    const current = data.currentRequest || data.currentInvoice || null;
    const defaults = { ...(data.defaults || {}) };
    const prefill = current
      ? {
          ...defaults,
          ...current,
          selApprovers: Array.isArray(current.selApprovers)
            ? current.selApprovers.map(String)
            : (defaults.selApprovers || []),
        }
      : { ...defaults, selApprovers: defaults.selApprovers || [] };

    setForm({
      shipOwner: strOrEmpty(prefill.shipOwner),
      invType: strOrEmpty(prefill.invType || 'Interim'),
      manualVendorName: strOrEmpty(prefill.manualVendorName),
      invoiceNo: strOrEmpty(prefill.invoiceNo),
      invoiceDate: strOrEmpty(prefill.invoiceDate),
      dueDate: strOrEmpty(prefill.dueDate),
      cpDate: strOrEmpty(prefill.cpDate),
      exchangeCurrency: strOrEmpty(prefill.exchangeCurrency || data.currency || 'USD'),
      exchangeRate: strOrEmpty(prefill.exchangeRate || '1'),
      exchangeDate: strOrEmpty(prefill.exchangeDate),
      paymentTerms: strOrEmpty(prefill.paymentTerms),
      remarks: strOrEmpty(prefill.remarks),
      atten: strOrEmpty(prefill.atten),
      grossAmt: strOrEmpty(prefill.grossAmt),
      taxApplicable: strOrEmpty(prefill.taxApplicable ?? '2'),
      gstVat: strOrEmpty(prefill.gstVat ?? '1'),
      sgstPercent: strOrEmpty(prefill.sgstPercent),
      cgstPercent: strOrEmpty(prefill.cgstPercent),
      igstPercent: strOrEmpty(prefill.igstPercent),
      vatPercent: strOrEmpty(prefill.vatPercent),
      paymentStatus: strOrEmpty(prefill.paymentStatus || 'payment_payable'),
      nob: strOrEmpty(prefill.nob),
      selApprovers: Array.isArray(prefill.selApprovers)
        ? prefill.selApprovers.map(String)
        : [],
    });

    setInvoiceId(strOrEmpty(current?.invoiceId));
    setInvoiceStatus(current?.status != null ? Number(current.status) : null);
    setExistingUpload(strOrEmpty(current?.upload || current?.existingUpload || defaults.upload));
    setExistingUploadName(strOrEmpty(current?.uploadName || current?.existingUploadName || defaults.uploadName));
    setAttachFiles([]);
    setBankingDetail(null);
    setCBankCheck(false);

    setAddRows(withClientIds(current?.addRows, EMPTY_LINE));
    setSubRows(withClientIds(current?.subRows, EMPTY_LINE));

    setDemRows((data.demurrageClubRows || []).map((row, index) => ({
      ...row,
      id: String(row.id ?? `dem-${index}`),
      checked: Boolean(row.checked),
      amount: row.amount ?? 0,
    })));
    setOtherIncomeRows((data.otherIncomeClubRows || []).map((row, index) => ({
      ...row,
      id: String(row.id ?? `oi-${index}`),
      checked: Boolean(row.checked),
      amount: row.amount ?? 0,
    })));
  }, []);

  useEffect(() => {
    if (!id) {
      setError('Invoice context id is required.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchOtherInvoiceForm({
          id,
          name,
          amountTitle,
          amounttitle: amountTitle,
          page,
          portType,
          porttype: portType,
          randomId,
          randomid: randomId,
          portId,
          portid: portId,
          voyageNo,
        });
        if (cancelled) return;
        applyContext(data);
      } catch (err) {
        if (!cancelled) {
          setContext(null);
          setError(err.message || 'Failed to load other invoice form.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, name, amountTitle, page, portType, randomId, portId, voyageNo, reloadToken, applyContext]);

  useEffect(() => {
    const bdId = form.nob;
    if (!bdId) {
      setBankingDetail(null);
      return;
    }
    const vendorHit = (context?.vendorBanking || []).find((row) => String(row.id) === String(bdId));
    if (vendorHit && netForBanking < 0) {
      setBankingDetail(vendorHit);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const detail = await fetchOtherInvoiceBanking(bdId);
        if (!cancelled) setBankingDetail(detail);
      } catch {
        if (!cancelled) setBankingDetail(null);
      }
    })();
    return () => { cancelled = true; };
  }, [form.nob, context?.vendorBanking, netForBanking]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateLine = (rows, setRows, lineId, patch) => {
    setRows(rows.map((row) => (row.id === lineId ? { ...row, ...patch } : row)));
  };

  const addLine = (rows, setRows, factory = EMPTY_LINE) => {
    const last = rows[rows.length - 1];
    if (last && !String(last.description || '').trim() && !String(last.amount || '').trim()) {
      return;
    }
    setRows([...rows, factory()]);
  };

  const removeLine = async (rows, setRows, lineId, factory = EMPTY_LINE) => {
    if (rows.length <= 1) {
      setRows([factory()]);
      return;
    }
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to remove this entry permanently?',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    setRows(rows.filter((row) => row.id !== lineId));
  };

  const toggleChecklist = (setter) => (rowId) => {
    setter((rows) => rows.map((row) => (
      String(row.id) === String(rowId) ? { ...row, checked: !row.checked } : row
    )));
  };

  const filterLineRows = (rows) => rows
    .filter((row) => String(row.description || '').trim() || String(row.amount || '').trim())
    .map((row) => ({
      description: row.description,
      amount: row.amount,
    }));

  const buildFormData = (status) => {
    const fd = new FormData();
    const append = (key, value) => {
      if (value == null) return;
      fd.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    };

    append('id', id);
    append('comId', context.comId);
    append('fcaId', context.fcaId);
    append('vendorId', context.vendorId);
    append('invType', form.invType || 'Interim');
    append('pType', context.pType || name);
    append('name', context.pType || name);
    append('amountTitle', context.amountTitle || amountTitle);
    append('page', page);
    append('portType', context.portType || portType);
    append('randomId', context.randomId || randomId);
    append('portId', context.portId || portId);
    append('cpDate', form.cpDate || context.cpDate);
    append('status', status);
    if (invoiceId) append('invoiceId', invoiceId);
    if (form.invoiceNo) append('draftInvoiceNo', form.invoiceNo);

    append('shipOwner', form.shipOwner);
    append('manualVendorName', form.manualVendorName);
    append('invoiceNo', form.invoiceNo);
    append('invoiceDate', form.invoiceDate);
    append('dueDate', form.dueDate);
    append('exchangeCurrency', form.exchangeCurrency);
    append('exchangeRate', form.exchangeRate);
    append('exchangeDate', form.exchangeDate);
    append('paymentTerms', form.paymentTerms);
    append('remarks', form.remarks);
    append('atten', form.atten);
    append('grossAmt', form.grossAmt);
    append('taxApplicable', form.taxApplicable);
    append('gstVat', form.gstVat);
    append('sgstPercent', form.sgstPercent);
    append('cgstPercent', form.cgstPercent);
    append('igstPercent', form.igstPercent);
    append('vatPercent', form.vatPercent);
    append('netPayable', totals.netPayable);
    append('netPayableTax', totals.netPayableTax);
    append('paymentStatus', form.paymentStatus);
    append('nob', form.nob);
    append('existingUpload', existingUpload);
    append('existingUploadName', existingUploadName);

    fd.append('selApprovers', JSON.stringify(form.selApprovers || []));
    fd.append('addRows', JSON.stringify(filterLineRows(addRows)));
    fd.append('subRows', JSON.stringify(filterLineRows(subRows)));
    fd.append('demurrageClubRows', JSON.stringify(
      demRows.filter((row) => row.checked).map((row) => ({
        id: row.id,
        port: row.port,
        portId: row.portId,
        portLabel: row.portLabel,
        randomId: row.randomId,
        vendorId: row.vendorId,
        amount: row.amount,
        checked: true,
      })),
    ));
    fd.append('otherIncomeClubRows', JSON.stringify(
      otherIncomeRows.filter((row) => row.checked).map((row) => ({
        id: row.id,
        identityId: row.identityId,
        randomId: row.randomId,
        vendorId: row.vendorId,
        amount: row.amount,
        checked: true,
      })),
    ));

    attachFiles.forEach((file) => {
      fd.append('attach_file', file);
    });

    return fd;
  };

  const validateClient = async (status) => {
    const missing = [
      [form.shipOwner, 'Invoicing Company'],
      [form.invType, 'Invoice Type'],
      [form.invoiceNo, 'Invoice Number'],
      [form.invoiceDate, 'Invoice Date'],
      [form.exchangeRate, 'Exchange Rate'],
      [form.exchangeCurrency, 'Exchange Currency'],
      [form.paymentTerms, 'Payment Terms'],
      [form.paymentStatus, 'Invoice Hold / Payable'],
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
      await saveOtherInvoice(buildFormData(status));
      await alert({
        title: 'Saved',
        message: Number(status) === 0
          ? 'Invoice saved as draft.'
          : 'Invoice submitted successfully.',
        confirmLabel: 'OK',
      });
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err.message || 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentSubmit = async (payload) => {
    await receiveOtherInvoicePayment(paymentInvoice.invoiceId, payload);
    setPaymentInvoice(null);
    await alert({
      title: 'Saved',
      message: 'Payment recorded successfully.',
      confirmLabel: 'OK',
    });
    setReloadToken((token) => token + 1);
  };

  const handleInvoiceAction = async (action, invoice) => {
    try {
      if (action === 'pdf') {
        await downloadOtherInvoicePdf(invoice.invoiceId);
        return;
      }
      if (action === 'payment') {
        setPaymentInvoice(invoice);
        return;
      }

      const messages = {
        cancel: 'Are you sure you want to cancel this invoice?',
        reopen: 'Are you sure you want to reopen this invoice?',
        delete: 'Are you sure you want to delete this invoice permanently?',
      };
      const confirmed = await confirm({
        title: 'Confirmation',
        message: messages[action] || 'Are you sure?',
        confirmLabel: 'OK',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;

      setSaving(true);
      if (action === 'cancel') await cancelOtherInvoice(invoice.invoiceId);
      if (action === 'reopen') await reopenOtherInvoice(invoice.invoiceId);
      if (action === 'delete') await deleteOtherInvoice(invoice.invoiceId);
      await alert({
        title: 'Done',
        message: 'Action completed successfully.',
        confirmLabel: 'OK',
      });
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!invoiceId) return;
    try {
      await downloadOtherInvoicePdf(invoiceId);
    } catch (err) {
      setError(err.message || 'Failed to generate PDF.');
    }
  };

  const taxEnabled = String(form.taxApplicable) === '1';
  const gstMode = String(form.gstVat) === '1';
  const status = invoiceStatus;
  const hasDraft = status != null && !Number.isNaN(status);
  const editableByCreator = !hasDraft || status === 0 || status === 2;

  const showCreatorActions = editableByCreator;
  const showApprover1Actions = auth.approver1 && hasDraft && (status === 1 || status === 4);
  const showApprover2Actions = auth.approver2 && hasDraft && status === 3;

  const approveStatusApp1 = auth.hasApp2 ? 3 : 5;
  const reviewStatusApp2 = auth.hasApp1 ? 4 : 2;

  const existingInvoices = context?.existingInvoices || [];
  const pageTitle = (context?.pType || name || 'Other Invoice').toUpperCase();
  const amountLabel = context?.amountTitle || amountTitle || 'Amount';
  const currencyLabel = context?.currency || form.exchangeCurrency || 'USD';

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? (
        <LoadingOverlay show label={saving ? 'Saving invoice…' : 'Loading invoice…'} />
      ) : null}

      <div className={styles.toolbar}>
        <Button variant="outline" label="Back" href={backHref} disabled={saving} />
        {invoiceId ? (
          <Button
            variant="outline"
            label="Generate PDF"
            onClick={handleGeneratePdf}
            disabled={loading || saving}
          />
        ) : null}
        {showCreatorActions ? (
          <>
            <Button
              variant="primary"
              label="Submit to edit"
              onClick={() => handleSubmit(0)}
              disabled={loading || saving || !context}
            />
            <Button
              variant="accent"
              label="Send for Approval"
              onClick={() => handleSubmit(auth.sendForApprovalStatus)}
              disabled={loading || saving || !context}
            />
          </>
        ) : null}
        {showApprover1Actions ? (
          <>
            <Button
              variant="primary"
              label="Send for Review"
              onClick={() => handleSubmit(2)}
              disabled={loading || saving || !context}
            />
            <Button
              variant="accent"
              label="Submit & Approve"
              onClick={() => handleSubmit(approveStatusApp1)}
              disabled={loading || saving || !context}
            />
          </>
        ) : null}
        {showApprover2Actions ? (
          <>
            <Button
              variant="primary"
              label="Send for Review"
              onClick={() => handleSubmit(reviewStatusApp2)}
              disabled={loading || saving || !context}
            />
            <Button
              variant="accent"
              label="Submit & Approve"
              onClick={() => handleSubmit(5)}
              disabled={loading || saving || !context}
            />
          </>
        ) : null}
      </div>

      <h2 className={styles.title}>
        {pageTitle}
        {hasDraft ? ` (Status ${status})` : ''}
      </h2>

      {error ? <div className={styles.error}>{error}</div> : null}

      {!loading && context ? (
        <>
          <div className={styles.infoGrid}>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Invoicing Company</p>
              <FormSelect
                id="shipOwner"
                label="Owner"
                required
                value={form.shipOwner}
                options={ownerOptions}
                onChange={(value) => updateField('shipOwner', value)}
              />
            </div>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>To</p>
              <p className={styles.metaLine}><strong>{context.vendorName || '—'}</strong></p>
              <p className={styles.metaLine}>{context.vendorAddress || '—'}</p>
            </div>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Freight Details</p>
              <p className={styles.metaLine}>Fixture Ref.: {context.voyageNo || '—'}</p>
              <p className={styles.metaLine}>Vessel: {context.vesselName || '—'}</p>
              <p className={styles.metaLine}>CP Date: {context.cpDate || '—'}</p>
              <p className={styles.metaLine}>Port of Loading: {context.loadPorts || '—'}</p>
              <p className={styles.metaLine}>Port of Discharging: {context.dischargePorts || '—'}</p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.span2}>
              <Field id="manualVendorName" label="Vendor (Manual)">
                <textarea
                  id="manualVendorName"
                  className={styles.textarea}
                  value={form.manualVendorName || ''}
                  onChange={(event) => updateField('manualVendorName', event.target.value)}
                />
              </Field>
            </div>

            <FormSelect
              id="invType"
              label="Invoice Type"
              required
              value={form.invType}
              options={invTypeOptions}
              onChange={(value) => updateField('invType', value)}
            />
            <Field id="atten" label="Attn">
              <input
                id="atten"
                className={styles.input}
                value={form.atten || ''}
                onChange={(event) => updateField('atten', event.target.value)}
              />
            </Field>
            <Field id="invoiceNo" label="Invoice Number *">
              <input
                id="invoiceNo"
                className={styles.input}
                value={form.invoiceNo || ''}
                onChange={(event) => updateField('invoiceNo', event.target.value)}
              />
            </Field>
            <Field id="invoiceDate" label="Invoice Date *">
              <DmyDateInput
                id="invoiceDate"
                value={form.invoiceDate || ''}
                onChange={(value) => updateField('invoiceDate', value)}
              />
            </Field>
            <Field id="dueDate" label="Due Date">
              <DmyDateInput
                id="dueDate"
                value={form.dueDate || ''}
                onChange={(value) => updateField('dueDate', value)}
              />
            </Field>
            <Field id="exchangeRate" label="Exchange Rate *">
              <input
                id="exchangeRate"
                className={styles.input}
                value={form.exchangeRate || ''}
                onChange={(event) => updateField('exchangeRate', event.target.value)}
              />
            </Field>
            <Field id="exchangeDate" label="Exchange Date">
              <DmyDateInput
                id="exchangeDate"
                value={form.exchangeDate || ''}
                onChange={(value) => updateField('exchangeDate', value)}
              />
            </Field>
            <FormSelect
              id="exchangeCurrency"
              label="Exchange To Currency"
              required
              value={form.exchangeCurrency}
              options={currencyOptions}
              onChange={(value) => updateField('exchangeCurrency', value)}
            />
            <Field id="paymentTerms" label="Payment Terms *">
              <input
                id="paymentTerms"
                className={styles.input}
                value={form.paymentTerms || ''}
                onChange={(event) => updateField('paymentTerms', event.target.value)}
              />
            </Field>

            <div className={styles.span2}>
              <FormSelect
                id="nob"
                label="Banking Details"
                value={form.nob}
                options={bankingOptions}
                onChange={(value) => updateField('nob', value)}
              />
              <BankingPanel
                detail={bankingDetail}
                cBankCheck={cBankCheck}
                onCBankCheckChange={setCBankCheck}
              />
            </div>

            <div className={styles.span2}>
              <Field id="attach_file" label="Documents">
                <input
                  id="attach_file"
                  type="file"
                  multiple
                  onChange={(event) => setAttachFiles(Array.from(event.target.files || []))}
                />
                {attachFiles.length ? (
                  <p className={styles.muted}>{attachFiles.length} file(s) selected</p>
                ) : null}
                {existingUploadName || existingUpload ? (
                  <p className={styles.muted}>
                    Existing: {existingUploadName || existingUpload}
                  </p>
                ) : null}
              </Field>
            </div>

            <div className={styles.span4}>
              <Field id="remarks" label="Description">
                <textarea
                  id="remarks"
                  className={styles.textarea}
                  value={form.remarks || ''}
                  onChange={(event) => updateField('remarks', event.target.value)}
                />
              </Field>
            </div>

            <div className={styles.span2}>
              <Field id="grossAmt" label={`${amountLabel} (${currencyLabel})`}>
                <input
                  id="grossAmt"
                  className={styles.input}
                  readOnly
                  value={form.grossAmt || ''}
                />
              </Field>
            </div>
          </div>

          <ChecklistSection
            title="Club Demurrage / Dispatch"
            rows={demRows}
            onToggle={toggleChecklist(setDemRows)}
          />

          <ChecklistSection
            title="Club Other Income"
            rows={otherIncomeRows}
            onToggle={toggleChecklist(setOtherIncomeRows)}
          />

          <LineSection
            title="Other Add"
            rows={addRows}
            onAdd={() => addLine(addRows, setAddRows)}
            onRemove={(lineId) => removeLine(addRows, setAddRows, lineId)}
            onUpdate={(lineId, patch) => updateLine(addRows, setAddRows, lineId, patch)}
          />

          <LineSection
            title="Other Less"
            rows={subRows}
            onAdd={() => addLine(subRows, setSubRows)}
            onRemove={(lineId) => removeLine(subRows, setSubRows, lineId)}
            onUpdate={(lineId, patch) => updateLine(subRows, setSubRows, lineId, patch)}
          />

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Tax / GST / VAT</h3>
            <div className={styles.sectionBody}>
              <div className={styles.radioRow}>
                <span>GST/VAT Applicable</span>
                <label>
                  <input
                    type="radio"
                    name="taxApplicable"
                    checked={String(form.taxApplicable) === '1'}
                    onChange={() => updateField('taxApplicable', '1')}
                  />
                  Yes
                </label>
                <label>
                  <input
                    type="radio"
                    name="taxApplicable"
                    checked={String(form.taxApplicable) === '2'}
                    onChange={() => updateField('taxApplicable', '2')}
                  />
                  No
                </label>
              </div>

              {taxEnabled ? (
                <>
                  <div className={styles.radioRow}>
                    <span>Type</span>
                    <label>
                      <input
                        type="radio"
                        name="gstVat"
                        checked={gstMode}
                        onChange={() => updateField('gstVat', '1')}
                      />
                      GST
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="gstVat"
                        checked={!gstMode}
                        onChange={() => updateField('gstVat', '2')}
                      />
                      VAT
                    </label>
                  </div>

                  {gstMode ? (
                    <div className={styles.taxGrid}>
                      <Field id="sgstPercent" label="SGST %">
                        <input
                          id="sgstPercent"
                          className={styles.input}
                          value={form.sgstPercent || ''}
                          onChange={(event) => updateField('sgstPercent', event.target.value)}
                        />
                      </Field>
                      <Field id="sgstAmount" label="SGST Amt">
                        <input className={styles.input} readOnly value={totals.sgstAmount.toFixed(2)} />
                      </Field>
                      <Field id="cgstPercent" label="CGST %">
                        <input
                          id="cgstPercent"
                          className={styles.input}
                          value={form.cgstPercent || ''}
                          onChange={(event) => updateField('cgstPercent', event.target.value)}
                        />
                      </Field>
                      <Field id="cgstAmount" label="CGST Amt">
                        <input className={styles.input} readOnly value={totals.cgstAmount.toFixed(2)} />
                      </Field>
                      <Field id="igstPercent" label="IGST %">
                        <input
                          id="igstPercent"
                          className={styles.input}
                          value={form.igstPercent || ''}
                          onChange={(event) => updateField('igstPercent', event.target.value)}
                        />
                      </Field>
                      <Field id="igstAmount" label="IGST Amt">
                        <input className={styles.input} readOnly value={totals.igstAmount.toFixed(2)} />
                      </Field>
                    </div>
                  ) : (
                    <div className={styles.taxGrid}>
                      <Field id="vatPercent" label="VAT %">
                        <input
                          id="vatPercent"
                          className={styles.input}
                          value={form.vatPercent || ''}
                          onChange={(event) => updateField('vatPercent', event.target.value)}
                        />
                      </Field>
                      <Field id="vatAmount" label="VAT Amt">
                        <input className={styles.input} readOnly value={totals.vatAmount.toFixed(2)} />
                      </Field>
                    </div>
                  )}
                </>
              ) : null}

              <div className={styles.totals}>
                <div>Amount Payable</div>
                <input className={styles.input} readOnly value={totals.netPayable.toFixed(2)} />
                <div>Amount Payable (After Tax)</div>
                <input className={styles.input} readOnly value={totals.netPayableTax.toFixed(2)} />
                {parseAmount(form.exchangeRate) > 0 ? (
                  <>
                    <div>Exchanged Amount</div>
                    <input className={styles.input} readOnly value={totals.exchanged.toFixed(2)} />
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Invoice</h3>
            <div className={styles.sectionBody}>
              <div className={styles.paymentStatus}>
                <label>
                  <input
                    type="radio"
                    name="payment_status"
                    checked={form.paymentStatus === 'payment_hold'}
                    onChange={() => updateField('paymentStatus', 'payment_hold')}
                  />
                  Invoice Hold
                </label>
                <label>
                  <input
                    type="radio"
                    name="payment_status"
                    checked={form.paymentStatus === 'payment_payable'}
                    onChange={() => updateField('paymentStatus', 'payment_payable')}
                  />
                  Invoice Payable
                </label>
              </div>

              <div className={styles.approverRow}>
                <div>Level 1 Approver</div>
                <CountryMultiSelect
                  options={context.approvers || []}
                  value={form.selApprovers || []}
                  onChange={(value) => updateField('selApprovers', value)}
                  placeholder="Choose Approver..."
                  searchPlaceholder="Search approver…"
                />
              </div>
            </div>
          </div>

          {existingInvoices.length ? (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Existing Invoices</h3>
              <div className={styles.sectionBody}>
                <div className={styles.tableWrap}>
                  <table className={styles.existingTable}>
                    <thead>
                      <tr>
                        <th>Fixture No.</th>
                        <th>Vessel</th>
                        <th>Invoice Type</th>
                        <th>Invoice No</th>
                        <th>Charterer</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingInvoices.map((row) => (
                        <tr key={row.invoiceId}>
                          <td>{row.voyageNo || '—'}</td>
                          <td>{row.vesselName || '—'}</td>
                          <td>{row.invoiceType || '—'}</td>
                          <td>{row.invoiceNo || '—'}</td>
                          <td>{row.chartererName || '—'}</td>
                          <td>{row.amount != null ? money2(row.amount).toFixed(2) : '—'}</td>
                          <td>{row.status === 8 ? 'Cancelled' : (row.status ?? '—')}</td>
                          <td>
                            <div className={styles.actionBtns}>
                              {row.canPdf !== false ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  label="PDF"
                                  onClick={() => handleInvoiceAction('pdf', row)}
                                />
                              ) : null}
                              {row.canReceivePayment ? (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  label="Payment"
                                  onClick={() => handleInvoiceAction('payment', row)}
                                />
                              ) : null}
                              {row.canCancel ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  label="Cancel"
                                  onClick={() => handleInvoiceAction('cancel', row)}
                                />
                              ) : null}
                              {row.canReopen ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  label="Open"
                                  onClick={() => handleInvoiceAction('reopen', row)}
                                />
                              ) : null}
                              {row.canDelete ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  label="Delete"
                                  onClick={() => handleInvoiceAction('delete', row)}
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {!loading && !context && !error ? (
        <div className={styles.error}>
          Unable to load invoice context.{' '}
          <Link to={backHref}>Back to Payment Grid</Link>
        </div>
      ) : null}

      {paymentInvoice ? (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSubmit={handlePaymentSubmit}
        />
      ) : null}
    </div>
  );
}

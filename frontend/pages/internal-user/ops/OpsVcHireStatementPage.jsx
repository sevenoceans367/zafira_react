import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  deleteHireStatement,
  downloadHireStatementPdf,
  fetchHireStatementForm,
  receiveHireStatementPayment,
  reopenHireStatement,
  saveHireStatement,
} from '../../../services/opsVc.js';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import styles from './OpsVcHireStatementPage.module.css';

const EMPTY_LINE = () => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  orcId: '',
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
    orcId: strOrEmpty(row.orcId),
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

function PaymentModal({ invoice, onClose, onSubmit }) {
  const [amount, setAmount] = useState(invoice?.amount != null ? String(invoice.amount) : '');
  const [date, setDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!(parseAmount(amount) > 0) || !date) {
      setError('Payment amount and date are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({ amount, paymentDate: date, remarks });
    } catch (err) {
      setError(err.message || 'Failed to record payment.');
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        <h3>Receive Payment — {invoice?.invoiceNo || invoice?.invoiceId}</h3>
        {error ? <div className={styles.error}>{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <div className={styles.modalField}>
            <label htmlFor="hirePayAmt">Amount</label>
            <input id="hirePayAmt" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className={styles.modalField}>
            <DmyDateInput id="hirePayDate" label="Date" value={date} onChange={setDate} required />
          </div>
          <div className={styles.modalField}>
            <label htmlFor="hirePayRemarks">Remarks</label>
            <textarea id="hirePayRemarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
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

/**
 * React port of PHP invoice_hire.php (Hire Statement).
 */
export default function OpsVcHireStatementPage() {
  const alert = useAlert();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();

  const comId = searchParams.get('comId') || searchParams.get('comid') || '';
  const page = searchParams.get('page') || '1';
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
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const backHref = useMemo(() => {
    const params = new URLSearchParams({
      comid: context?.comId || comId,
      page,
    });
    if (voyageNo || context?.voyageNo) params.set('voyageNo', voyageNo || context.voyageNo);
    return appPath(`/internal-user/vc/ops/payment-grid?${params.toString()}`);
  }, [comId, context?.comId, context?.voyageNo, page, voyageNo]);

  const typeOptions = useMemo(
    () => [
      { value: '', label: '----Select From List----' },
      ...(context?.invoiceTypes || []).map((row) => ({
        value: String(row.id),
        label: row.name || row.id,
      })),
    ],
    [context?.invoiceTypes],
  );
  const currencyOptions = useMemo(
    () => [
      { value: '', label: '----Select From List----' },
      ...(context?.currencies || []).map((row) => ({
        value: String(row.id),
        label: row.name || row.id,
      })),
    ],
    [context?.currencies],
  );
  const ownerOptions = useMemo(
    () => (context?.owners || []).map((row) => ({ value: row.id, label: row.name })),
    [context?.owners],
  );

  const applyContext = useCallback((data) => {
    setContext(data);
    const current = data.currentInvoice || null;
    const defaults = { ...(data.defaults || {}) };
    const prefill = current ? { ...defaults, ...current } : defaults;
    setInvoiceId(strOrEmpty(current?.invoiceId));
    setInvoiceStatus(current?.status != null ? Number(current.status) : null);
    setForm({
      invoiceType: strOrEmpty(prefill.invoiceType || 'Interim'),
      invoiceNo: strOrEmpty(prefill.invoiceNo),
      invoiceDate: strOrEmpty(prefill.invoiceDate),
      exchangeRate: strOrEmpty(prefill.exchangeRate || '1'),
      exchangeDate: strOrEmpty(prefill.exchangeDate),
      exchangeCurrency: strOrEmpty(prefill.exchangeCurrency || 'USD'),
      paymentTerms: strOrEmpty(prefill.paymentTerms),
      description: strOrEmpty(prefill.description),
      hireFrom: strOrEmpty(prefill.hireFrom),
      hireTo: strOrEmpty(prefill.hireTo),
      dailyHireRate: strOrEmpty(prefill.dailyHireRate),
      cve: strOrEmpty(prefill.cve),
      addCommPer: strOrEmpty(prefill.addCommPer),
      broCommPer: strOrEmpty(prefill.broCommPer),
      chkOffhire: Boolean(prefill.chkOffhire),
      chkDelivery: Boolean(prefill.chkDelivery),
      chkRedelivery: Boolean(prefill.chkRedelivery),
      chkBallastBonus: Boolean(prefill.chkBallastBonus),
      shipOwner: strOrEmpty(prefill.shipOwner),
      paymentStatus: strOrEmpty(prefill.paymentStatus || 'payment_payable'),
      selApprovers: Array.isArray(prefill.selApprovers) ? prefill.selApprovers.map(String) : [],
    });
    setAddRows(withClientIds(current?.addRows || prefill.addRows, EMPTY_LINE));
    setSubRows(withClientIds(current?.subRows || prefill.subRows, EMPTY_LINE));
  }, []);

  useEffect(() => {
    if (!comId) {
      setError('COMID is required.');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchHireStatementForm({ comId, page, voyageNo });
        if (!cancelled) applyContext(data);
      } catch (err) {
        if (!cancelled) {
          setContext(null);
          setError(err.message || 'Failed to load hire statement.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applyContext, comId, page, reloadToken, voyageNo]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const totals = useMemo(() => {
    const days = parseAmount(form.hireDays);
    const rate = parseAmount(form.dailyHireRate);
    const hireAmt = money2(days > 0 ? days * rate : parseAmount(context?.defaults?.hireAmt || 0));
    const cveAmt = money2(parseAmount(form.cve));
    const addTotal = addRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const subTotal = subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const addCommAmt = money2((hireAmt * parseAmount(form.addCommPer)) / 100);
    const broCommAmt = money2((hireAmt * parseAmount(form.broCommPer)) / 100);
    const finalAmt = money2(hireAmt + cveAmt + addTotal - subTotal - addCommAmt - broCommAmt);
    return { hireAmt, cveAmt, addCommAmt, broCommAmt, finalAmt };
  }, [addRows, context?.defaults?.hireAmt, form.broCommPer, form.addCommPer, form.cve, form.dailyHireRate, form.hireDays, subRows]);

  const auth = useMemo(() => {
    const fromCtx = context?.auth || {};
    return {
      creator: Boolean(fromCtx.creator ?? true),
      approver1: Boolean(fromCtx.approver1),
      approver2: Boolean(fromCtx.approver2),
      sendForApprovalStatus: Number(fromCtx.sendForApprovalStatus ?? 1),
      hasApp1: Boolean(fromCtx.hasApp1 ?? true),
      hasApp2: Boolean(fromCtx.hasApp2),
    };
  }, [context]);

  const handleSubmit = async (status) => {
    if (!form.invoiceNo || !form.invoiceDate) {
      setError('Invoice number and date are required.');
      return;
    }
    if (status === 1 && !(form.selApprovers || []).length) {
      setError('Please select Level 1 Approvers first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      const append = (key, value) => {
        if (value == null) return;
        fd.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      };
      append('comId', context.comId || comId);
      append('fcaId', context.fcaId);
      append('page', page);
      append('status', status);
      if (invoiceId) append('invoiceId', invoiceId);
      append('invoiceType', form.invoiceType);
      append('invoiceNo', form.invoiceNo);
      append('invoiceDate', form.invoiceDate);
      append('exchangeRate', form.exchangeRate);
      append('exchangeDate', form.exchangeDate);
      append('exchangeCurrency', form.exchangeCurrency);
      append('paymentTerms', form.paymentTerms);
      append('description', form.description);
      append('hireFrom', form.hireFrom);
      append('hireTo', form.hireTo);
      append('dailyHireRate', form.dailyHireRate);
      append('cve', form.cve);
      append('addCommPer', form.addCommPer);
      append('broCommPer', form.broCommPer);
      append('chkOffhire', form.chkOffhire);
      append('chkDelivery', form.chkDelivery);
      append('chkRedelivery', form.chkRedelivery);
      append('chkBallastBonus', form.chkBallastBonus);
      append('shipOwner', form.shipOwner);
      append('paymentStatus', form.paymentStatus);
      append('finalAmt', totals.finalAmt);
      append('hireAmt', totals.hireAmt);
      fd.append('selApprovers', JSON.stringify(form.selApprovers || []));
      fd.append('addRows', JSON.stringify(addRows));
      fd.append('subRows', JSON.stringify(subRows));
      await saveHireStatement(fd);
      await alert({ title: 'Saved', message: 'Hire statement saved successfully.', confirmLabel: 'OK' });
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err.message || 'Failed to save hire statement.');
    } finally {
      setSaving(false);
    }
  };

  const handleInvoiceAction = async (action, invoice) => {
    try {
      if (action === 'pdf') {
        await downloadHireStatementPdf(invoice.invoiceId);
        return;
      }
      if (action === 'payment') {
        setPaymentInvoice(invoice);
        return;
      }
      const messages = {
        reopen: 'Are you sure you want to reopen this hire statement?',
        delete: 'Are you sure you want to delete this hire statement permanently?',
      };
      const confirmed = await confirm({
        title: 'Confirmation',
        message: messages[action] || 'Are you sure?',
        confirmLabel: 'OK',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
      setSaving(true);
      if (action === 'reopen') await reopenHireStatement(invoice.invoiceId);
      if (action === 'delete') await deleteHireStatement(invoice.invoiceId);
      await alert({ title: 'Done', message: 'Action completed successfully.', confirmLabel: 'OK' });
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  };

  const status = invoiceStatus;
  const hasDraft = status != null && !Number.isNaN(status);
  const editableByCreator = !hasDraft || status === 0 || status === 2;
  const showApprover1Actions = auth.approver1 && hasDraft && (status === 1 || status === 4);
  const showApprover2Actions = auth.approver2 && hasDraft && status === 3;
  const approveStatusApp1 = auth.hasApp2 ? 3 : 5;
  const reviewStatusApp2 = auth.hasApp1 ? 4 : 2;
  const existingInvoices = context?.existingInvoices || [];

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? (
        <LoadingOverlay show label={saving ? 'Saving hire statement…' : 'Loading hire statement…'} />
      ) : null}

      <div className={styles.toolbar}>
        <Button variant="outline" label="Back" href={backHref} disabled={saving} />
        {editableByCreator ? (
          <>
            <Button variant="primary" label="Submit to edit" onClick={() => handleSubmit(0)} disabled={loading || saving || !context} />
            <Button variant="accent" label="Send for Approval" onClick={() => handleSubmit(auth.sendForApprovalStatus)} disabled={loading || saving || !context} />
          </>
        ) : null}
        {showApprover1Actions ? (
          <>
            <Button variant="primary" label="Send for Review" onClick={() => handleSubmit(2)} disabled={loading || saving || !context} />
            <Button variant="accent" label="Submit & Approve" onClick={() => handleSubmit(approveStatusApp1)} disabled={loading || saving || !context} />
          </>
        ) : null}
        {showApprover2Actions ? (
          <>
            <Button variant="primary" label="Send for Review" onClick={() => handleSubmit(reviewStatusApp2)} disabled={loading || saving || !context} />
            <Button variant="accent" label="Submit & Approve" onClick={() => handleSubmit(5)} disabled={loading || saving || !context} />
          </>
        ) : null}
        {invoiceId ? (
          <Button variant="outline" label="Generate PDF" onClick={() => handleInvoiceAction('pdf', { invoiceId })} disabled={loading || saving} />
        ) : null}
      </div>

      <h2 className={styles.title}>
        Hire Statement
        {hasDraft ? ` (Status ${status})` : ''}
      </h2>

      {error ? <div className={styles.error}>{error}</div> : null}

      {!loading && context ? (
        <>
          <div className={styles.infoGrid}>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Nomination</p>
              <p className={styles.metaLine}>Nom ID: {context.nomMessage || '—'}</p>
              <p className={styles.metaLine}>Vessel: {context.vesselName || '—'}</p>
              <p className={styles.metaLine}>Owner: {context.vendorName || '—'}</p>
            </div>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Voyage</p>
              <p className={styles.metaLine}>Voyage No: {context.voyageNo || voyageNo || '—'}</p>
              <p className={styles.metaLine}>TC No: {context.tcNo || '—'}</p>
              <p className={styles.metaLine}>CP Date: {context.cpDate || '—'}</p>
            </div>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Totals</p>
              <p className={styles.metaLine}>Hire Amt: {totals.hireAmt.toFixed(2)}</p>
              <p className={styles.metaLine}>CVE: {totals.cveAmt.toFixed(2)}</p>
              <p className={styles.metaLine}>Final Amt: {totals.finalAmt.toFixed(2)}</p>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Statement</h3>
            <div className={styles.sectionBody}>
              <div className={styles.formGrid}>
                <FormSelect id="invoiceType" label="Invoice Type" required value={form.invoiceType} options={typeOptions} onChange={(value) => updateField('invoiceType', value)} />
                <FormSelect id="shipOwner" label="Invoicing Company" value={form.shipOwner} options={[{ value: '', label: '----Select From List----' }, ...ownerOptions]} onChange={(value) => updateField('shipOwner', value)} />
                <Field id="invoiceNo" label="Invoice No *">
                  <input className={styles.input} value={form.invoiceNo || ''} onChange={(e) => updateField('invoiceNo', e.target.value)} />
                </Field>
                <DmyDateInput id="invoiceDate" label="Invoice Date *" value={form.invoiceDate || ''} onChange={(value) => updateField('invoiceDate', value)} />
                <FormSelect id="exchangeCurrency" label="Currency" value={form.exchangeCurrency} options={currencyOptions} onChange={(value) => updateField('exchangeCurrency', value)} />
                <Field id="exchangeRate" label="Exchange Rate">
                  <input className={styles.input} value={form.exchangeRate || ''} onChange={(e) => updateField('exchangeRate', e.target.value)} />
                </Field>
                <DmyDateInput id="exchangeDate" label="Exchange Date" value={form.exchangeDate || ''} onChange={(value) => updateField('exchangeDate', value)} />
                <Field id="dailyHireRate" label="Daily Hire Rate">
                  <input className={styles.input} value={form.dailyHireRate || ''} onChange={(e) => updateField('dailyHireRate', e.target.value)} />
                </Field>
                <Field id="cve" label="CVE / Month">
                  <input className={styles.input} value={form.cve || ''} onChange={(e) => updateField('cve', e.target.value)} />
                </Field>
                <Field id="addCommPer" label="Address Comm %">
                  <input className={styles.input} value={form.addCommPer || ''} onChange={(e) => updateField('addCommPer', e.target.value)} />
                </Field>
                <Field id="broCommPer" label="Broker Comm %">
                  <input className={styles.input} value={form.broCommPer || ''} onChange={(e) => updateField('broCommPer', e.target.value)} />
                </Field>
                <Field id="paymentTerms" label="Payment Terms">
                  <input className={styles.input} value={form.paymentTerms || ''} onChange={(e) => updateField('paymentTerms', e.target.value)} />
                </Field>
                <Field id="hireFrom" label="Hire From">
                  <input className={styles.input} value={form.hireFrom || ''} onChange={(e) => updateField('hireFrom', e.target.value)} placeholder="DD-MM-YYYY HH:mm" />
                </Field>
                <Field id="hireTo" label="Hire To">
                  <input className={styles.input} value={form.hireTo || ''} onChange={(e) => updateField('hireTo', e.target.value)} placeholder="DD-MM-YYYY HH:mm" />
                </Field>
              </div>
              <Field id="description" label="Description">
                <textarea className={styles.textarea} rows={3} value={form.description || ''} onChange={(e) => updateField('description', e.target.value)} />
              </Field>
              <div className={styles.checkRow}>
                <label><input type="checkbox" checked={Boolean(form.chkOffhire)} onChange={(e) => updateField('chkOffhire', e.target.checked)} /> Off Hire</label>
                <label><input type="checkbox" checked={Boolean(form.chkDelivery)} onChange={(e) => updateField('chkDelivery', e.target.checked)} /> Delivery Bunker</label>
                <label><input type="checkbox" checked={Boolean(form.chkRedelivery)} onChange={(e) => updateField('chkRedelivery', e.target.checked)} /> Re-delivery Bunker</label>
                <label><input type="checkbox" checked={Boolean(form.chkBallastBonus)} onChange={(e) => updateField('chkBallastBonus', e.target.checked)} /> Ballast Bonus</label>
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

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Additions</h3>
            <div className={styles.sectionBody}>
              {(addRows || []).map((row) => (
                <div key={row.id} className={styles.lineRow}>
                  <input className={styles.input} placeholder="Description" value={row.description} onChange={(e) => setAddRows((rows) => rows.map((item) => item.id === row.id ? { ...item, description: e.target.value } : item))} />
                  <input className={styles.input} placeholder="Amount" value={row.amount} onChange={(e) => setAddRows((rows) => rows.map((item) => item.id === row.id ? { ...item, amount: e.target.value } : item))} />
                  <Button size="sm" variant="outline" label="×" onClick={() => setAddRows((rows) => rows.filter((item) => item.id !== row.id))} />
                </div>
              ))}
              <Button size="sm" variant="outline" label="Add row" onClick={() => setAddRows((rows) => [...rows, EMPTY_LINE()])} />
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Deductions</h3>
            <div className={styles.sectionBody}>
              {(subRows || []).map((row) => (
                <div key={row.id} className={styles.lineRow}>
                  <input className={styles.input} placeholder="Description" value={row.description} onChange={(e) => setSubRows((rows) => rows.map((item) => item.id === row.id ? { ...item, description: e.target.value } : item))} />
                  <input className={styles.input} placeholder="Amount" value={row.amount} onChange={(e) => setSubRows((rows) => rows.map((item) => item.id === row.id ? { ...item, amount: e.target.value } : item))} />
                  <Button size="sm" variant="outline" label="×" onClick={() => setSubRows((rows) => rows.filter((item) => item.id !== row.id))} />
                </div>
              ))}
              <Button size="sm" variant="outline" label="Add row" onClick={() => setSubRows((rows) => [...rows, EMPTY_LINE()])} />
            </div>
          </div>

          {existingInvoices.length ? (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Existing Hire Statements</h3>
              <div className={styles.sectionBody}>
                <div className={styles.tableWrap}>
                  <table className={styles.existingTable}>
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingInvoices.map((row) => (
                        <tr key={row.invoiceId}>
                          <td>{row.invoiceNo || '—'}</td>
                          <td>{row.invoiceType || '—'}</td>
                          <td>{row.amount != null ? money2(row.amount).toFixed(2) : '—'}</td>
                          <td>{row.status ?? '—'}</td>
                          <td>
                            <div className={styles.actionBtns}>
                              {row.canPdf !== false ? <Button size="sm" variant="outline" label="PDF" onClick={() => handleInvoiceAction('pdf', row)} /> : null}
                              {row.canReceivePayment ? <Button size="sm" variant="primary" label="Payment" onClick={() => handleInvoiceAction('payment', row)} /> : null}
                              {row.canReopen ? <Button size="sm" variant="outline" label="Open" onClick={() => handleInvoiceAction('reopen', row)} /> : null}
                              {row.canDelete ? <Button size="sm" variant="danger" label="Delete" onClick={() => handleInvoiceAction('delete', row)} /> : null}
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

      {paymentInvoice ? (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSubmit={async (payload) => {
            await receiveHireStatementPayment(paymentInvoice.invoiceId, payload);
            setPaymentInvoice(null);
            await alert({ title: 'Saved', message: 'Payment recorded successfully.', confirmLabel: 'OK' });
            setReloadToken((token) => token + 1);
          }}
        />
      ) : null}
    </div>
  );
}

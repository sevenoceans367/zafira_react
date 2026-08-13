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
  cancelFreightInvoice,
  deleteFreightInvoice,
  downloadFreightInvoicePdf,
  fetchFreightInvoiceBanking,
  fetchFreightInvoiceForm,
  receiveFreightInvoicePayment,
  reopenFreightInvoice,
  saveFreightInvoice,
} from '../../../services/opsVc.js';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import styles from './OpsVcFreightInvoicePage.module.css';

const EMPTY_LINE = () => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  orcId: '',
  description: '',
  amount: '',
});

const EMPTY_ADJ_LINE = () => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  orcId: '',
  fixtureNo: '',
  vessel: '',
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
    fixtureNo: strOrEmpty(row.fixtureNo),
    vessel: strOrEmpty(row.vessel),
    description: strOrEmpty(row.description),
    amount: row.amount == null || row.amount === '' ? '' : String(row.amount),
  }));
}

function FormSelect({ id, label, value, options, onChange, required = false }) {
  return (
    <Field id={id} label={required ? `${label} *` : label}>
      <div className={styles.cardSelect} data-field={id}>
        <CardSelect
          id={id}
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

function focusMandatoryField(fieldId) {
  if (!fieldId || typeof document === 'undefined') return false;

  const byId = document.getElementById(fieldId);
  const byData = document.querySelector(`[data-field="${CSS.escape(fieldId)}"]`);
  const byLabel = document.querySelector(`label[for="${CSS.escape(fieldId)}"]`);
  const container = byData
    || byId?.closest('[class*="field"]')
    || byLabel?.parentElement
    || byId;

  let focusable = null;
  if (byId && typeof byId.focus === 'function' && !byId.disabled) {
    focusable = byId;
  } else if (byData) {
    focusable = byData.querySelector(
      'button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
    );
  }
  if (!focusable && container) {
    focusable = container.querySelector(
      'button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
    );
  }

  const scrollTarget = focusable || container || byData || byId;
  if (!scrollTarget) return false;

  scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

  if (container?.classList && styles.fieldHighlight) {
    container.classList.add(styles.fieldHighlight);
    window.setTimeout(() => container.classList.remove(styles.fieldHighlight), 2500);
  }

  const applyFocus = () => {
    const el = focusable || document.getElementById(fieldId);
    if (!el || typeof el.focus !== 'function') return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    if (typeof el.select === 'function' && el.tagName === 'INPUT') {
      try { el.select(); } catch { /* ignore */ }
    }
  };

  // Dialog OK / reflow can steal focus — retry a few times after paint.
  applyFocus();
  window.requestAnimationFrame(() => {
    applyFocus();
    window.setTimeout(applyFocus, 50);
    window.setTimeout(applyFocus, 150);
    window.setTimeout(applyFocus, 300);
  });
  return true;
}

async function alertThenFocus(alertFn, alertOpts, fieldId) {
  // Scroll/highlight first so the field is on-screen under the dialog.
  focusMandatoryField(fieldId);
  await alertFn(alertOpts);
  // Re-apply after dialog unmounts and returns focus to the toolbar button.
  await new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        focusMandatoryField(fieldId);
        resolve();
      }, 80);
    });
  });
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

function ChecklistSection({ title, rows, onToggle, onProrateToggle, kind }) {
  if (!rows?.length) return null;
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>
        <ul className={styles.checklist}>
          {rows.map((row) => {
            const key = row.id ?? row.randomId ?? `${row.port}-${row.portId}`;
            const label = kind === 'club'
              ? `${row.vendorName || '—'}${row.cargoName ? ` (${row.cargoName})` : ''}`
              : (row.portLabel || row.port || '—');
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
                {kind === 'dem' && row.showProrate ? (
                  <label className={styles.prorate}>
                    <input
                      type="checkbox"
                      checked={Boolean(row.prorate)}
                      onChange={() => onProrateToggle?.(key)}
                    />
                    Prorate
                  </label>
                ) : null}
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
            <label htmlFor="fiPaymentAmount">Amount</label>
            <input
              id="fiPaymentAmount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
            />
          </div>
          <div className={styles.modalField}>
            <label htmlFor="fiPaymentDate">Payment Date</label>
            <DmyDateInput
              id="fiPaymentDate"
              value={paymentDate}
              onChange={setPaymentDate}
              required
            />
          </div>
          <div className={styles.modalField}>
            <label htmlFor="fiPaymentRemarks">Remarks</label>
            <textarea
              id="fiPaymentRemarks"
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

function LineSection({
  title,
  rows,
  orcOptions,
  fixtureOptions = [],
  vesselOptions = [],
  onFixtureChange,
  onAdd,
  onRemove,
  onUpdate,
  adjustment = false,
}) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>
        <table className={styles.linesTable}>
          <thead>
            <tr>
              <th style={{ width: 44 }} />
              <th style={{ width: adjustment ? '16%' : '24%' }}>Cost type</th>
              {adjustment ? (
                <>
                  <th style={{ width: '16%' }}>Fixture no</th>
                  <th style={{ width: '16%' }}>Vessel</th>
                </>
              ) : null}
              <th>Description</th>
              <th style={{ width: '14%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    icon="trash"
                    ariaLabel={`Delete ${title} row`}
                    onClick={() => onRemove(row.id)}
                  />
                </td>
                <td>
                  <CardSelect
                    value={row.orcId || ''}
                    options={orcOptions}
                    placeholder="----Select----"
                    ariaLabel={`${title} cost type`}
                    align="start"
                    onChange={(value) => onUpdate(row.id, { orcId: value })}
                  />
                </td>
                {adjustment ? (
                  <>
                    <td>
                      <CardSelect
                        value={row.fixtureNo || ''}
                        options={fixtureOptions}
                        placeholder="----Select----"
                        ariaLabel={`${title} fixture`}
                        align="start"
                        onChange={(value) => onFixtureChange?.(row.id, value)}
                      />
                    </td>
                    <td>
                      <CardSelect
                        value={row.vessel || ''}
                        options={vesselOptions}
                        placeholder="----Select----"
                        ariaLabel={`${title} vessel`}
                        align="start"
                        onChange={(value) => onUpdate(row.id, { vessel: value })}
                      />
                    </td>
                  </>
                ) : null}
                <td>
                  <input
                    className={styles.input}
                    value={row.description}
                    onChange={(event) => onUpdate(row.id, { description: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={styles.input}
                    value={row.amount}
                    onChange={(event) => onUpdate(row.id, { amount: event.target.value })}
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
 * React port of PHP invoice.php create/edit form (Initial/Final freight invoice).
 */
export default function OpsVcFreightInvoicePage() {
  const alert = useAlert();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();

  const id = searchParams.get('id') || '';
  const name = searchParams.get('name') || 'Final Nett Freight';
  const page = searchParams.get('page') || '1';
  const invType = searchParams.get('invType') || searchParams.get('invtype') || 'Interim';
  const voyageNo = searchParams.get('voyageNo') || searchParams.get('voyage_no') || '';
  const vcIn = searchParams.get('vcIn') === '1' || searchParams.get('vcin') === '1';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState(null);
  const [form, setForm] = useState({});
  const [invoiceId, setInvoiceId] = useState('');
  const [draftInvoiceNo, setDraftInvoiceNo] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState(null);
  const [addRows, setAddRows] = useState([EMPTY_LINE()]);
  const [subRows, setSubRows] = useState([EMPTY_LINE()]);
  const [adjAddRows, setAdjAddRows] = useState([EMPTY_ADJ_LINE()]);
  const [adjSubRows, setAdjSubRows] = useState([EMPTY_ADJ_LINE()]);
  const [clubRows, setClubRows] = useState([]);
  const [demRows, setDemRows] = useState([]);
  const [daRows, setDaRows] = useState([]);
  const [attachFiles, setAttachFiles] = useState([]);
  const [existingUpload, setExistingUpload] = useState('');
  const [existingUploadName, setExistingUploadName] = useState('');
  const [bankingDetail, setBankingDetail] = useState(null);
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
  const orcOptions = useMemo(
    () => [
      { value: '', label: '----Select----' },
      ...(context?.orcOptions || []).map((row) => ({ value: row.id, label: row.name })),
    ],
    [context?.orcOptions],
  );
  const fixtureOptions = useMemo(
    () => [
      { value: '', label: '----Select----' },
      ...(context?.fixtures || []).map((row) => ({ value: row.id, label: row.name })),
    ],
    [context?.fixtures],
  );
  const vesselOptions = useMemo(
    () => [
      { value: '', label: '----Select----' },
      ...(context?.vessels || []).map((row) => ({ value: row.id, label: row.name })),
    ],
    [context?.vessels],
  );
  const bankingOptions = useMemo(
    () => [
      { value: '', label: '----Select From List----' },
      ...(context?.bankingDetails || []).map((row) => ({
        value: String(row.id),
        label: row.name || String(row.id),
      })),
    ],
    [context?.bankingDetails],
  );
  const currencyOptions = useMemo(
    () => [
      { value: '', label: '----Select From List----' },
      ...(context?.currencies || []).map((row) => ({
        value: row.id,
        label: row.name,
      })),
    ],
    [context?.currencies],
  );
  const invoiceTypeOptions = useMemo(
    () => [
      { value: '', label: '----Select From List----' },
      ...(context?.invoiceTypes || []).map((row) => ({
        value: row.id,
        label: row.name,
      })),
    ],
    [context?.invoiceTypes],
  );
  const currencyCode = form.exchangeCurrency || 'USD';
  const showNetDead = Boolean(context?.freightBreakdown?.showNetDead);
  const fixtureVesselMap = useMemo(() => {
    const map = new Map();
    (context?.fixtures || []).forEach((row) => {
      if (row.id) map.set(String(row.id), strOrEmpty(row.vesselId));
    });
    return map;
  }, [context?.fixtures]);

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

  const demCheckedTotal = useMemo(
    () => demRows.filter((row) => row.checked).reduce((sum, row) => sum + parseAmount(row.amount), 0),
    [demRows],
  );
  const daCheckedTotal = useMemo(
    () => daRows.filter((row) => row.checked).reduce((sum, row) => sum + parseAmount(row.amount), 0),
    [daRows],
  );

  const totals = useMemo(() => {
    const gross = parseAmount(form.grossFreight);
    const percentThereOff = parseAmount(form.percentThereOff);
    // PHP getAmountThereOff: txtNet = gross × % There Off / 100
    const freightDue = percentThereOff > 0
      ? money2((gross * percentThereOff) / 100)
      : 0;
    const addTotal = addRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const subTotal = subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const adjAddTotal = adjAddRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const adjSubTotal = adjSubRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    // PHP: brokerage / addcom on full gross only when % There Off > 0
    const brokerage = percentThereOff > 0
      ? money2((gross * parseAmount(form.brokeragePercent)) / 100)
      : 0;
    const addCom = percentThereOff > 0
      ? money2((gross * parseAmount(form.addComPercent)) / 100)
      : 0;
    const gstOnBrok = money2((brokerage * parseAmount(form.gstOnBrokPercent)) / 100);
    const netPayable = money2(
      freightDue
        + addTotal
        + adjAddTotal
        + demCheckedTotal
        - adjSubTotal
        - subTotal
        - brokerage
        - addCom
        - gstOnBrok
        - daCheckedTotal,
    );

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
      freightDue,
      brokerage,
      addCom,
      gstOnBrok,
      netPayable,
      sgstAmount,
      cgstAmount,
      igstAmount,
      vatAmount,
      netPayableTax,
      exchanged,
    };
  }, [
    form.grossFreight,
    form.percentThereOff,
    form.brokeragePercent,
    form.addComPercent,
    form.gstOnBrokPercent,
    form.taxApplicable,
    form.gstVat,
    form.sgstPercent,
    form.cgstPercent,
    form.igstPercent,
    form.vatPercent,
    form.exchangeRate,
    addRows,
    subRows,
    adjAddRows,
    adjSubRows,
    demCheckedTotal,
    daCheckedTotal,
  ]);

  const applyContext = useCallback((data) => {
    setContext(data);
    const current = data.currentInvoice || null;
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
      manualVendorName: strOrEmpty(prefill.manualVendorName),
      loadPortName: strOrEmpty(prefill.loadPortName ?? prefill.ports),
      dischargePortName: strOrEmpty(prefill.dischargePortName),
      blDate: strOrEmpty(prefill.blDate),
      blNo: strOrEmpty(prefill.blNo),
      flag: strOrEmpty(prefill.flag),
      imoNo: strOrEmpty(prefill.imoNo),
      blQuantity: strOrEmpty(prefill.blQuantity),
      freightRate: strOrEmpty(prefill.freightRate),
      invoiceType: strOrEmpty(prefill.invoiceType || data.invType),
      invoiceNo: strOrEmpty(prefill.invoiceNo),
      invoiceDate: strOrEmpty(prefill.invoiceDate),
      dueDate: strOrEmpty(prefill.dueDate),
      exchangeCurrency: strOrEmpty(prefill.exchangeCurrency || 'USD'),
      exchangeRate: strOrEmpty(prefill.exchangeRate),
      exchangeDate: strOrEmpty(prefill.exchangeDate),
      paymentTerms: strOrEmpty(prefill.paymentTerms),
      remarks: strOrEmpty(prefill.remarks),
      atten: strOrEmpty(prefill.atten),
      grossFreight: strOrEmpty(prefill.grossFreight),
      brokeragePercent: strOrEmpty(prefill.brokeragePercent ?? '0'),
      gstOnBrokPercent: strOrEmpty(prefill.gstOnBrokPercent ?? '0'),
      addComPercent: strOrEmpty(prefill.addComPercent ?? '0'),
      taxApplicable: strOrEmpty(prefill.taxApplicable ?? '2'),
      gstVat: strOrEmpty(prefill.gstVat ?? '1'),
      sgstPercent: strOrEmpty(prefill.sgstPercent),
      cgstPercent: strOrEmpty(prefill.cgstPercent),
      igstPercent: strOrEmpty(prefill.igstPercent),
      vatPercent: strOrEmpty(prefill.vatPercent),
      paymentStatus: strOrEmpty(prefill.paymentStatus || 'payment_payable'),
      nob: strOrEmpty(prefill.nob),
      cBankCheck: prefill.cBankCheck === true
        || prefill.cBankCheck === 'Yes'
        || prefill.cBankCheck === '1'
        || prefill.cBankCheck === 1,
      percentThereOff: strOrEmpty(prefill.percentThereOff),
      ffiSettlementDays: strOrEmpty(prefill.ffiSettlementDays),
      selApprovers: Array.isArray(prefill.selApprovers)
        ? prefill.selApprovers.map(String)
        : [],
    });

    setInvoiceId(strOrEmpty(current?.invoiceId));
    // PHP txtDNote1 — keep original MESSAGE key once set so renames still update the same draft
    setDraftInvoiceNo((prev) => (prev || strOrEmpty(current?.invoiceNo)));
    setInvoiceStatus(current?.status != null ? Number(current.status) : null);
    setExistingUpload(strOrEmpty(current?.upload || current?.existingUpload));
    setExistingUploadName(strOrEmpty(current?.uploadName || current?.existingUploadName));
    setAttachFiles([]);
    setBankingDetail(null);

    setAddRows(withClientIds(current?.addRows, EMPTY_LINE));
    setSubRows(withClientIds(current?.subRows, EMPTY_LINE));
    setAdjAddRows(withClientIds(current?.adjAddRows, EMPTY_ADJ_LINE));
    setAdjSubRows(withClientIds(current?.adjSubRows, EMPTY_ADJ_LINE));

    const clubChecked = new Set((current?.clubCheckedIds || []).map(String));
    const demChecked = new Set((current?.demCheckedIds || []).map(String));
    const daChecked = new Set((current?.daCheckedIds || []).map(String));

    setClubRows((data.clubCharterers || []).map((row, index) => {
      const rowId = String(row.id ?? row.randomId ?? index + 1);
      return {
        ...row,
        id: rowId,
        checked: row.checked != null ? Boolean(row.checked) : clubChecked.has(rowId),
        amount: row.amount ?? 0,
      };
    }));

    setDemRows((data.demurrageRows || []).map((row, index) => {
      const rowId = String(row.id ?? row.randomId ?? `dem-${index}`);
      return {
        ...row,
        id: rowId,
        checked: row.checked != null ? Boolean(row.checked) : demChecked.has(rowId),
        prorate: Boolean(row.prorate),
        showProrate: Boolean(row.showProrate),
        amount: row.amount ?? 0,
      };
    }));

    setDaRows((data.daRows || []).map((row, index) => {
      const rowId = String(row.id ?? row.randomId ?? `da-${index}`);
      return {
        ...row,
        id: rowId,
        checked: row.checked != null ? Boolean(row.checked) : daChecked.has(rowId),
        disabled: Boolean(row.disabled),
        amount: row.amount ?? 0,
      };
    }));
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
        const data = await fetchFreightInvoiceForm({
          id,
          name,
          invType,
          voyageNo,
          vcIn: vcIn ? '1' : undefined,
          invoiceId: invoiceId || undefined,
        });
        if (cancelled) return;
        applyContext(data);
      } catch (err) {
        if (!cancelled) {
          setContext(null);
          setError(err.message || 'Failed to load freight invoice form.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, name, invType, voyageNo, vcIn, reloadToken, applyContext]);

  useEffect(() => {
    const bdId = form.nob;
    if (!bdId) {
      setBankingDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const detail = await fetchFreightInvoiceBanking(bdId);
        if (!cancelled) setBankingDetail(detail);
      } catch {
        if (!cancelled) setBankingDetail(null);
      }
    })();
    return () => { cancelled = true; };
  }, [form.nob]);

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

  const onAdjFixtureChange = (rows, setRows, lineId, fixtureNo) => {
    const vessel = fixtureVesselMap.get(String(fixtureNo)) || '';
    updateLine(rows, setRows, lineId, { fixtureNo, vessel });
  };

  const toggleClub = (rowId) => {
    const target = clubRows.find((row) => String(row.id) === String(rowId));
    if (!target) return;
    const checked = !target.checked;
    const amount = parseAmount(target.amount);
    setClubRows((rows) => rows.map((row) => (
      String(row.id) === String(rowId) ? { ...row, checked } : row
    )));
    setForm((current) => {
      const gross = parseAmount(current.grossFreight);
      const nextGross = checked ? gross + amount : gross - amount;
      return { ...current, grossFreight: money2(nextGross).toFixed(2) };
    });
  };

  const toggleChecklist = (setter) => (rowId) => {
    setter((rows) => rows.map((row) => (
      String(row.id) === String(rowId) ? { ...row, checked: !row.checked } : row
    )));
  };

  const toggleDemProrate = (rowId) => {
    setDemRows((rows) => rows.map((row) => (
      String(row.id) === String(rowId) ? { ...row, prorate: !row.prorate } : row
    )));
  };

  const filterLineRows = (rows) => rows
    .filter((row) => String(row.description || '').trim() || String(row.amount || '').trim())
    .map((row) => ({
      orcId: row.orcId,
      description: row.description,
      amount: row.amount,
    }));

  const filterAdjRows = (rows) => rows
    .filter((row) => (
      String(row.description || '').trim()
      || String(row.amount || '').trim()
      || String(row.fixtureNo || '').trim()
    ))
    .map((row) => ({
      orcId: row.orcId,
      fixtureNo: row.fixtureNo,
      vessel: row.vessel,
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
    append('pageInvType', context.invType || invType);
    append('invType', context.invType || invType);
    append('invoiceType', form.invoiceType || context.invType || invType);
    append('pType', context.pType || name);
    if (vcIn || context.vcIn) append('vcIn', '1');
    append('cargoId', context.cargoId || '0');
    append('randomId', context.randomId || '0');
    append('cpDate', context.cpDate);
    append('status', status);
    if (invoiceId) append('invoiceId', invoiceId);
    if (draftInvoiceNo) append('draftInvoiceNo', draftInvoiceNo);

    append('shipOwner', form.shipOwner);
    append('manualVendorName', form.manualVendorName);
    append('loadPortName', form.loadPortName);
    append('dischargePortName', form.dischargePortName);
    append('blDate', form.blDate);
    append('blNo', form.blNo);
    append('flag', form.flag);
    append('imoNo', form.imoNo);
    append('blQuantity', form.blQuantity);
    append('freightRate', form.freightRate);
    append('invoiceNo', form.invoiceNo);
    append('invoiceDate', form.invoiceDate);
    append('dueDate', form.dueDate);
    append('exchangeCurrency', form.exchangeCurrency);
    append('exchangeRate', form.exchangeRate);
    append('exchangeDate', form.exchangeDate);
    append('paymentTerms', form.paymentTerms);
    append('remarks', form.remarks);
    append('atten', form.atten);
    append('grossFreight', form.grossFreight);
    append('percentThereOff', form.percentThereOff);
    append('ffiSettlementDays', form.ffiSettlementDays);
    append('netAmount', totals.freightDue.toFixed(2));
    append('brokeragePercent', form.brokeragePercent);
    append('brokerageAmt', totals.brokerage.toFixed(2));
    append('gstOnBrokPercent', form.gstOnBrokPercent);
    append('gstOnBrok', totals.gstOnBrok.toFixed(2));
    append('addComPercent', form.addComPercent);
    append('addComAmt', totals.addCom.toFixed(2));
    append('netPayable', totals.netPayable.toFixed(2));
    append('netPayableTax', totals.netPayableTax.toFixed(2));
    append('taxApplicable', form.taxApplicable);
    append('gstVat', form.gstVat);
    append('sgstPercent', form.sgstPercent);
    append('cgstPercent', form.cgstPercent);
    append('igstPercent', form.igstPercent);
    append('vatPercent', form.vatPercent);
    append('paymentStatus', form.paymentStatus);
    append('nob', form.nob);
    append('cBankCheck', form.cBankCheck ? 'Yes' : 'No');
    append('existingUpload', existingUpload);
    append('existingUploadName', existingUploadName);

    fd.append('selApprovers', JSON.stringify(form.selApprovers || []));
    fd.append('addRows', JSON.stringify(filterLineRows(addRows)));
    fd.append('subRows', JSON.stringify(filterLineRows(subRows)));
    fd.append('adjAddRows', JSON.stringify(filterAdjRows(adjAddRows)));
    fd.append('adjSubRows', JSON.stringify(filterAdjRows(adjSubRows)));
    fd.append('clubCharterers', JSON.stringify(clubRows.filter((row) => row.checked)));
    fd.append('demurrageRows', JSON.stringify(
      demRows.filter((row) => row.checked).map((row) => ({
        id: row.id,
        port: row.port,
        portId: row.portId,
        portLabel: row.portLabel,
        randomId: row.randomId,
        vendorId: row.vendorId,
        amount: row.amount,
        prorate: row.prorate ? 1 : 0,
      })),
    ));
    fd.append('daRows', JSON.stringify(
      daRows.filter((row) => row.checked).map((row) => ({
        id: row.id,
        port: row.port,
        portId: row.portId,
        portLabel: row.portLabel,
        randomId: row.randomId,
        vendorId: row.vendorId,
        amount: row.amount,
      })),
    ));

    attachFiles.forEach((file) => {
      fd.append('attach_file', file);
    });

    return fd;
  };

  const validateClient = async (status) => {
    const missing = [
      [form.shipOwner, 'Invoicing Company', 'shipOwner'],
      [form.invoiceType, 'Invoice Type', 'invoiceType'],
      [form.invoiceNo, 'Invoice Number', 'invoiceNo'],
      [form.invoiceDate, 'Invoice Date', 'invoiceDate'],
      [form.grossFreight, 'Gross Freight', 'grossFreight'],
      [form.percentThereOff, '% There Off', 'percentThereOff'],
      [form.paymentStatus, 'Invoice Hold / Payable', 'paymentStatus'],
    ].find(([value]) => !String(value || '').trim());

    if (missing) {
      const [, label, fieldId] = missing;
      await alertThenFocus(alert, {
        title: 'Missing Information',
        message: `Please fill ${label}.`,
        confirmLabel: 'OK',
      }, fieldId);
      return false;
    }

    const isSendForApproval = Number(status) === Number(auth.sendForApprovalStatus)
      || Number(status) === 1;
    if (isSendForApproval && !(form.selApprovers || []).length) {
      await alertThenFocus(alert, {
        title: 'Missing Information',
        message: 'Please select Level 1 Approvers first.',
        confirmLabel: 'OK',
      }, 'selApprovers');
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
      const result = await saveFreightInvoice(buildFormData(status));
      const savedId = result?.invoiceId != null ? String(result.invoiceId) : '';
      if (savedId) setInvoiceId(savedId);
      if (!draftInvoiceNo && form.invoiceNo) {
        setDraftInvoiceNo(String(form.invoiceNo).trim());
      }
      await alert({
        title: 'Saved',
        message: Number(status) === 0
          ? 'Freight invoice saved as draft.'
          : 'Freight invoice submitted successfully.',
        confirmLabel: 'OK',
      });
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err.message || 'Failed to save freight invoice.');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!invoiceId) return;
    try {
      await downloadFreightInvoicePdf(invoiceId);
    } catch (err) {
      setError(err.message || 'Failed to download freight invoice PDF.');
    }
  };

  const handlePaymentSubmit = async (payload) => {
    await receiveFreightInvoicePayment(paymentInvoice.invoiceId, payload);
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
        await downloadFreightInvoicePdf(invoice.invoiceId);
        return;
      }
      if (action === 'pdfAed') {
        await downloadFreightInvoicePdf(invoice.invoiceId, { aed: true });
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
      if (action === 'cancel') await cancelFreightInvoice(invoice.invoiceId);
      if (action === 'reopen') await reopenFreightInvoice(invoice.invoiceId);
      if (action === 'delete') await deleteFreightInvoice(invoice.invoiceId);
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

  const taxEnabled = String(form.taxApplicable) === '1';
  const gstMode = String(form.gstVat) === '1';
  const status = invoiceStatus;
  const hasDraft = status != null && !Number.isNaN(status);
  const editableByCreator = !hasDraft || status === 0 || status === 2;

  // Always show create/save actions on editable invoices (same as generic invoice).
  // Approval-matrix CRETR flag alone was hiding buttons for users without that bit.
  const showCreatorActions = editableByCreator;
  const showApprover1Actions = auth.approver1 && hasDraft && (status === 1 || status === 4);
  const showApprover2Actions = auth.approver2 && hasDraft && status === 3;

  const approveStatusApp1 = auth.hasApp2 ? 3 : 5;
  const reviewStatusApp2 = auth.hasApp1 ? 4 : 2;

  const existingInvoices = context?.existingInvoices || [];

  const actionToolbar = (
    <div className={styles.toolbar}>
      <Button variant="outline" label="Back" href={backHref} disabled={saving} />
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
      {invoiceId ? (
        <Button
          variant="outline"
          label="Generate PDF"
          icon="download"
          onClick={handleGeneratePdf}
          disabled={loading || saving}
        />
      ) : null}
    </div>
  );

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? (
        <LoadingOverlay show label={saving ? 'Saving invoice…' : 'Loading invoice…'} />
      ) : null}

      {actionToolbar}

      <h2 className={styles.title}>
        {vcIn || context?.vcIn ? 'VC-in Invoice Creation' : 'Freight Invoice Creation'}
        {invType ? ` — ${invType === 'Final' ? 'Final' : 'Initial'}` : ''}
        {hasDraft ? ` (Status ${status})` : ''}
      </h2>

      {error ? <div className={styles.error}>{error}</div> : null}

      {!loading && context ? (
        <>
          <div className={styles.infoGrid}>
            <div className={styles.panel}>
              <FormSelect
                id="shipOwner"
                label="Invoicing Company"
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
              {context.cargoName ? (
                <p className={styles.metaLine}>Cargo: {context.cargoName}</p>
              ) : null}
              <p className={styles.metaLine}>Port of Loading: {context.loadPorts || '—'}</p>
              <p className={styles.metaLine}>Port of Discharging: {context.dischargePorts || '—'}</p>
            </div>
          </div>

          <div className={styles.headerRow}>
            <Field id="manualVendorName" label="Vendor (Billing)">
              <textarea
                id="manualVendorName"
                className={styles.textarea}
                value={form.manualVendorName || ''}
                onChange={(event) => updateField('manualVendorName', event.target.value)}
              />
            </Field>
            <Field id="loadPortName" label="Port of Loading">
              <textarea
                id="loadPortName"
                className={styles.textarea}
                value={form.loadPortName || ''}
                onChange={(event) => updateField('loadPortName', event.target.value)}
              />
            </Field>
            <Field id="dischargePortName" label="Port of Discharging">
              <textarea
                id="dischargePortName"
                className={styles.textarea}
                value={form.dischargePortName || ''}
                onChange={(event) => updateField('dischargePortName', event.target.value)}
              />
            </Field>
          </div>

          <div className={styles.blRow}>
            <Field id="blDate" label="BL Date">
              <DmyDateInput
                id="blDate"
                value={form.blDate || ''}
                onChange={(value) => updateField('blDate', value)}
              />
            </Field>
            <Field id="blNo" label="BL No.">
              <input
                id="blNo"
                className={styles.input}
                value={form.blNo || ''}
                onChange={(event) => updateField('blNo', event.target.value)}
              />
            </Field>
            <Field id="flag" label="Flag">
              <input
                id="flag"
                className={styles.input}
                value={form.flag || ''}
                onChange={(event) => updateField('flag', event.target.value)}
              />
            </Field>
            <Field id="imoNo" label="IMO No.">
              <input
                id="imoNo"
                className={styles.input}
                value={form.imoNo || ''}
                onChange={(event) => updateField('imoNo', event.target.value)}
              />
            </Field>
          </div>

          <div className={styles.qtyRow}>
            <Field id="blQuantity" label="BL Quantity">
              <input
                id="blQuantity"
                className={styles.input}
                value={form.blQuantity || ''}
                onChange={(event) => updateField('blQuantity', event.target.value)}
              />
            </Field>
            <Field id="freightRate" label="Freight Rate">
              <input
                id="freightRate"
                className={styles.input}
                value={form.freightRate || ''}
                onChange={(event) => updateField('freightRate', event.target.value)}
              />
            </Field>
          </div>

          <div className={styles.mainSplit}>
            <div className={styles.leftCol}>
              <div className={styles.stackFields}>
                <FormSelect
                  id="invoiceType"
                  label="Invoice Type"
                  required
                  value={form.invoiceType}
                  options={invoiceTypeOptions}
                  onChange={(value) => updateField('invoiceType', value)}
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
                <Field id="exchangeRate" label="Exchange Rate">
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
                  value={form.exchangeCurrency}
                  options={currencyOptions}
                  onChange={(value) => updateField('exchangeCurrency', value)}
                />
                <Field id="paymentTerms" label="Payment Terms">
                  <input
                    id="paymentTerms"
                    className={styles.input}
                    value={form.paymentTerms || ''}
                    onChange={(event) => updateField('paymentTerms', event.target.value)}
                  />
                </Field>
                <Field id="ffiSettlementDays" label="FFI Settlement Days">
                  <input
                    id="ffiSettlementDays"
                    className={styles.input}
                    value={form.ffiSettlementDays || ''}
                    onChange={(event) => updateField('ffiSettlementDays', event.target.value)}
                    inputMode="numeric"
                  />
                </Field>
                <Field id="remarks" label="Description">
                  <textarea
                    id="remarks"
                    className={styles.textarea}
                    value={form.remarks || ''}
                    onChange={(event) => updateField('remarks', event.target.value)}
                  />
                </Field>
                <FormSelect
                  id="nob"
                  label="Banking Details"
                  value={form.nob}
                  options={bankingOptions}
                  onChange={(value) => updateField('nob', value)}
                />
                <BankingPanel
                  detail={bankingDetail}
                  cBankCheck={form.cBankCheck}
                  onCBankCheckChange={(checked) => updateField('cBankCheck', checked)}
                />
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
            </div>

            <div className={styles.rightCol}>
              <div className={styles.freightStack}>
                <ChecklistSection
                  title="Club Freight"
                  rows={clubRows}
                  kind="club"
                  onToggle={toggleClub}
                />

                <div className={styles.freightTrio}>
                  <Field id="grossFreight" label={`Gross Freight (${currencyCode}) *`}>
                    <input
                      id="grossFreight"
                      className={styles.input}
                      value={form.grossFreight || ''}
                      onChange={(event) => updateField('grossFreight', event.target.value)}
                      readOnly={Boolean(context?.freightBreakdown?.isDistributed)}
                    />
                  </Field>
                  <Field id="percentThereOff" label="% There Off *">
                    <input
                      id="percentThereOff"
                      className={styles.input}
                      style={{ textAlign: 'right' }}
                      value={form.percentThereOff || ''}
                      onChange={(event) => updateField('percentThereOff', event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </Field>
                  <Field id="freightDue" label="Freight Due">
                    <input
                      id="freightDue"
                      className={styles.input}
                      readOnly
                      value={totals.freightDue.toFixed(2)}
                    />
                  </Field>
                </div>

                <ChecklistSection
                  title="Demurrage / Dispatch"
                  rows={demRows}
                  kind="dem"
                  onToggle={toggleChecklist(setDemRows)}
                  onProrateToggle={toggleDemProrate}
                />

                <ChecklistSection
                  title="DA LP / DP / TP"
                  rows={daRows}
                  kind="da"
                  onToggle={toggleChecklist(setDaRows)}
                />

                {showNetDead ? (
                  <>
                    <Field id="netFreight" label={`Net Freight (${currencyCode})`}>
                      <input
                        className={styles.input}
                        readOnly
                        value={Number(context?.freightBreakdown?.netFreight || 0).toFixed(2)}
                      />
                    </Field>
                    <Field id="deadFreight" label={`Dead Freight (${currencyCode})`}>
                      <input
                        className={styles.input}
                        readOnly
                        value={Number(context?.freightBreakdown?.deadFreight || 0).toFixed(2)}
                      />
                    </Field>
                  </>
                ) : null}

                <LineSection
                  title="Add Adjustment"
                  rows={adjAddRows}
                  orcOptions={orcOptions}
                  fixtureOptions={fixtureOptions}
                  vesselOptions={vesselOptions}
                  onFixtureChange={(lineId, fixtureNo) => (
                    onAdjFixtureChange(adjAddRows, setAdjAddRows, lineId, fixtureNo)
                  )}
                  onAdd={() => addLine(adjAddRows, setAdjAddRows, EMPTY_ADJ_LINE)}
                  onRemove={(lineId) => removeLine(adjAddRows, setAdjAddRows, lineId, EMPTY_ADJ_LINE)}
                  onUpdate={(lineId, patch) => updateLine(adjAddRows, setAdjAddRows, lineId, patch)}
                  adjustment
                />

                <LineSection
                  title="Add"
                  rows={addRows}
                  orcOptions={orcOptions}
                  onAdd={() => addLine(addRows, setAddRows)}
                  onRemove={(lineId) => removeLine(addRows, setAddRows, lineId)}
                  onUpdate={(lineId, patch) => updateLine(addRows, setAddRows, lineId, patch)}
                />

                <LineSection
                  title="Less Adjustment"
                  rows={adjSubRows}
                  orcOptions={orcOptions}
                  fixtureOptions={fixtureOptions}
                  vesselOptions={vesselOptions}
                  onFixtureChange={(lineId, fixtureNo) => (
                    onAdjFixtureChange(adjSubRows, setAdjSubRows, lineId, fixtureNo)
                  )}
                  onAdd={() => addLine(adjSubRows, setAdjSubRows, EMPTY_ADJ_LINE)}
                  onRemove={(lineId) => removeLine(adjSubRows, setAdjSubRows, lineId, EMPTY_ADJ_LINE)}
                  onUpdate={(lineId, patch) => updateLine(adjSubRows, setAdjSubRows, lineId, patch)}
                  adjustment
                />

                <LineSection
                  title="Less"
                  rows={subRows}
                  orcOptions={orcOptions}
                  onAdd={() => addLine(subRows, setSubRows)}
                  onRemove={(lineId) => removeLine(subRows, setSubRows, lineId)}
                  onUpdate={(lineId, patch) => updateLine(subRows, setSubRows, lineId, patch)}
                />

                <div className={styles.freightPair}>
                  <Field id="brokeragePercent" label="Brokerage (%)">
                    <input
                      id="brokeragePercent"
                      className={styles.input}
                      value={form.brokeragePercent || ''}
                      onChange={(event) => updateField('brokeragePercent', event.target.value)}
                    />
                  </Field>
                  <Field id="brokerageAmt" label="Brokerage Amt">
                    <input className={styles.input} readOnly value={totals.brokerage.toFixed(2)} />
                  </Field>
                </div>
                <div className={styles.freightPair}>
                  <Field id="gstOnBrokPercent" label="GST on brokerage (%)">
                    <input
                      id="gstOnBrokPercent"
                      className={styles.input}
                      value={form.gstOnBrokPercent || ''}
                      onChange={(event) => updateField('gstOnBrokPercent', event.target.value)}
                    />
                  </Field>
                  <Field id="gstOnBrokAmt" label="GST on brokerage Amt">
                    <input className={styles.input} readOnly value={totals.gstOnBrok.toFixed(2)} />
                  </Field>
                </div>
                <div className={styles.freightPair}>
                  <Field id="addComPercent" label="Less Addcom">
                    <input
                      id="addComPercent"
                      className={styles.input}
                      value={form.addComPercent || ''}
                      onChange={(event) => updateField('addComPercent', event.target.value)}
                    />
                  </Field>
                  <Field id="addComAmt" label="Addcom Amt">
                    <input className={styles.input} readOnly value={totals.addCom.toFixed(2)} />
                  </Field>
                </div>
              </div>
            </div>
          </div>

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
                <div>
                  Exchange To Currency
                  {form.exchangeCurrency ? ` (${form.exchangeCurrency})` : ''}
                </div>
                <input
                  className={styles.input}
                  readOnly
                  value={
                    parseAmount(form.exchangeRate) > 0
                      ? totals.exchanged.toFixed(2)
                      : 'N.A'
                  }
                />
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Invoice</h3>
            <div className={styles.sectionBody}>
              <div className={styles.paymentStatus} data-field="paymentStatus" id="paymentStatus">
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

              <div className={styles.approverRow} data-field="selApprovers" id="selApprovers">
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
                        <th>Voyage</th>
                        <th>Vessel</th>
                        <th>Type</th>
                        <th>Invoice No</th>
                        <th>Charterer</th>
                        <th>Amount</th>
                        <th>Remarks</th>
                        <th>Status</th>
                        <th>Updated</th>
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
                          <td>{row.remarks || '—'}</td>
                          <td>{row.status ?? '—'}</td>
                          <td>
                            {[row.lastUpdatedBy, row.lastUpdatedAt].filter(Boolean).join(' — ') || '—'}
                          </td>
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
                              {row.canPdfAed ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  label="PDF-AED"
                                  onClick={() => handleInvoiceAction('pdfAed', row)}
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

          {actionToolbar}
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

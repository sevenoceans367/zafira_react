import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { notifyRecentWorkUpdated } from '../../../services/recentWork.js';
import { getUser } from '@bainbridge/shared-auth';
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
import OpsVcBackHeaderActions from './OpsVcBackHeaderActions.jsx';
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

function FormSelect({ id, label, value, options, onChange, required = false, className = '' }) {
  return (
    <Field
      id={id}
      label={required ? `${label} *` : label}
      className={[styles.field, className].filter(Boolean).join(' ')}
    >
      <div className={styles.cardSelect} data-field={id}>
        <CardSelect
          id={id}
          value={value || ''}
          options={options}
          placeholder="Select"
          ariaLabel={label}
          align="start"
          onChange={onChange}
        />
      </div>
    </Field>
  );
}

function InvoiceCard({ num, title, sub, children }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardNum}>{num}</span>
          <div className={styles.cardTitle}>
            {title}
            {sub ? <span className={styles.cardTitleSub}>{sub}</span> : null}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function splitLocChips(value) {
  return String(value || '')
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function AttachDropzone({ files, existingName, existingUpload, onFiles }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const selected = files?.length
    ? `${files.length} file(s) selected`
    : (existingName || existingUpload)
      ? `Existing: ${existingName || existingUpload}`
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
      <input
        id="attach_file"
        ref={inputRef}
        className={styles.hiddenFile}
        type="file"
        multiple
        onChange={(event) => onFiles(Array.from(event.target.files || []))}
      />
      <button
        type="button"
        className={styles.attachBtn}
        onClick={() => inputRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <path d="M21 12.5l-8.4 8.4a5 5 0 0 1-7-7L14 5.5a3.5 3.5 0 0 1 5 5L10.5 19a2 2 0 0 1-3-3l7.7-7.7" />
        </svg>
        Attach
      </button>
    </div>
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
    <div className={styles.adjBlock}>
      {title ? <div className={styles.adjSublabel}>{title}</div> : null}
      <div className={styles.grid2}>
        {rows.map((row) => {
          const key = row.id ?? row.randomId ?? `${row.port}-${row.portId}`;
          const label = kind === 'club'
            ? `${row.vendorName || '—'}${row.cargoName ? ` (${row.cargoName})` : ''}`
            : (row.portLabel || row.port || '—');
          return (
            <div key={key} className={styles.field}>
              <label className={styles.fieldCheck}>
                <input
                  type="checkbox"
                  checked={Boolean(row.checked)}
                  disabled={Boolean(row.disabled)}
                  onChange={() => onToggle(key)}
                />
                {label}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

function newPaymentRow(amount = '') {
  return {
    id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: '',
    remarks: '',
    amount: amount === '' || amount == null ? '' : money2(amount).toFixed(2),
  };
}

function PaymentModal({ invoice, onClose, onSubmit }) {
  const confirm = useConfirm();
  const invoiceAmount = money2(invoice?.amount);
  const existingRows = Array.isArray(invoice?.paymentRows) ? invoice.paymentRows : [];
  const [mainRemarks, setMainRemarks] = useState(strOrEmpty(invoice?.mainRemarks || invoice?.pRemarks));
  const [rows, setRows] = useState(() => (
    existingRows.length
      ? existingRows.map((row) => ({
          ...newPaymentRow(),
          date: strOrEmpty(row.date || row.paymentDate),
          remarks: strOrEmpty(row.remarks),
          amount: row.amount == null || row.amount === '' ? '' : money2(row.amount).toFixed(2),
        }))
      : [newPaymentRow(invoiceAmount)]
  ));
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isCredit = /credit/i.test(String(invoice?.invoiceType || ''));
  const receivedLabel = isCredit ? 'Payment Paid' : 'Payment Received';
  const totalReceived = money2(rows.reduce((sum, row) => sum + parseAmount(row.amount), 0));

  const updateRow = (id, patch) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleAddRow = () => {
    const last = rows[rows.length - 1];
    if (!last || !String(last.date || '').trim() || !(parseAmount(last.amount) > 0)) return;
    setRows((current) => [...current, newPaymentRow()]);
  };

  const handleRemoveRow = async (id) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to remove this entry permanently ?',
      confirmLabel: 'OK',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    setRows((current) => (current.length <= 1 ? [newPaymentRow()] : current.filter((row) => row.id !== id)));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validRow = rows.find((row) => String(row.date || '').trim() && parseAmount(row.amount) > 0);
    if (!validRow || !String(mainRemarks || '').trim()) {
      setError('Please fill the Payment Received & Date & Remarks');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('amount', String(totalReceived.toFixed(2)));
      fd.append('paymentDate', validRow.date);
      fd.append('remarks', mainRemarks);
      fd.append('txtP_Remarks', mainRemarks);
      fd.append('paymentRows', JSON.stringify(rows.map((row) => ({
        date: row.date,
        remarks: row.remarks,
        amount: row.amount,
      }))));
      files.forEach((file) => fd.append('mul_file', file));
      await onSubmit(fd);
    } catch (err) {
      setError(err.message || 'Failed to record payment.');
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.paymentModal}
        role="dialog"
        aria-modal="true"
        aria-label="Payment Receive"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.paymentClose} onClick={onClose} aria-label="Close">×</button>
        {error ? <div className={styles.modalError}>{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <div className={styles.paymentTop}>
            <div className={styles.paymentField}>
              <label htmlFor="fiInvoiceAmount">Invoice Amount</label>
              <input
                id="fiInvoiceAmount"
                className={styles.paymentReadonly}
                value={invoiceAmount.toFixed(2)}
                readOnly
              />
            </div>
            <div className={styles.paymentField}>
              <label htmlFor="fiMainRemarks">Main Remarks</label>
              <textarea
                id="fiMainRemarks"
                rows={2}
                placeholder="Remarks.."
                value={mainRemarks}
                onChange={(event) => setMainRemarks(event.target.value)}
              />
            </div>
          </div>

          <div className={styles.paymentTableWrap}>
            <table className={styles.paymentTable}>
              <thead>
                <tr>
                  <th style={{ width: 56 }}>#</th>
                  <th style={{ width: '22%' }}>Payment Date</th>
                  <th>Payment Remarks</th>
                  <th style={{ width: '22%' }}>{receivedLabel}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className={styles.paymentRemove}
                        onClick={() => handleRemoveRow(row.id)}
                        aria-label="Remove payment row"
                      >
                        ×
                      </button>
                    </td>
                    <td>
                      <DmyDateInput
                        id={`fiPayDate_${row.id}`}
                        value={row.date}
                        onChange={(value) => updateRow(row.id, { date: value })}
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        placeholder="Remarks.."
                        value={row.remarks}
                        onChange={(event) => updateRow(row.id, { remarks: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={row.amount}
                        onChange={(event) => updateRow(row.id, { amount: event.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    <Button type="button" variant="primary" size="sm" label="Add" onClick={handleAddRow} />
                  </td>
                  <td colSpan={2} className={styles.paymentTotalLabel}>Total Payment Received</td>
                  <td>
                    <input
                      className={styles.paymentReadonly}
                      value={totalReceived.toFixed(2)}
                      readOnly
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className={styles.paymentAttach}>
            <p className={styles.paymentAttachLabel}>Attachments</p>
            <label className={styles.paymentAttachBtn}>
              <i className="bi bi-paperclip" aria-hidden />
              Attachment
              <input
                type="file"
                multiple
                hidden
                onChange={(event) => {
                  setFiles(Array.from(event.target.files || []));
                }}
              />
            </label>
            {files.length ? (
              <ul className={styles.paymentFileList}>
                {files.map((file) => (
                  <li key={file.name}>{file.name}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className={styles.paymentFooter}>
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
  const rowClass = adjustment ? styles.adjGridAdj : styles.adjGridSimple;
  return (
    <div className={styles.adjBlock}>
      {title ? <div className={styles.adjSublabel}>{title}</div> : null}
      <div className={`${rowClass} ${styles.adjGridHead}`}>
        <span>{adjustment ? 'Cost Type' : 'Type'}</span>
        {adjustment ? <span>Fixture No</span> : null}
        {adjustment ? <span>Vessel</span> : null}
        <span>Description</span>
        <span>Amount</span>
        <span />
      </div>
      {rows.map((row) => (
        <div key={row.id} className={`${rowClass} ${styles.adjGridFields}`}>
          <div className={styles.cardSelect}>
            <CardSelect
              value={row.orcId || ''}
              options={orcOptions}
              placeholder="Select"
              ariaLabel={`${title} cost type`}
              align="start"
              onChange={(value) => onUpdate(row.id, { orcId: value })}
            />
          </div>
          {adjustment ? (
            <>
              <div className={styles.cardSelect}>
                <CardSelect
                  value={row.fixtureNo || ''}
                  options={fixtureOptions}
                  placeholder="Select"
                  ariaLabel={`${title} fixture`}
                  align="start"
                  onChange={(value) => onFixtureChange?.(row.id, value)}
                />
              </div>
              <div className={styles.cardSelect}>
                <CardSelect
                  value={row.vessel || ''}
                  options={vesselOptions}
                  placeholder="Select"
                  ariaLabel={`${title} vessel`}
                  align="start"
                  onChange={(value) => onUpdate(row.id, { vessel: value })}
                />
              </div>
            </>
          ) : null}
          <input
            className={styles.input}
            value={row.description}
            placeholder="Description…"
            onChange={(event) => onUpdate(row.id, { description: event.target.value })}
          />
          <input
            className={styles.input}
            value={row.amount}
            placeholder="Amount"
            onChange={(event) => onUpdate(row.id, { amount: event.target.value })}
          />
          <button
            type="button"
            className={styles.adjRowX}
            aria-label={`Delete ${title} row`}
            onClick={() => onRemove(row.id)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
      <div className={rowClass}>
        <span className={styles.adjGridAddSpacer} />
        <button
          type="button"
          className={styles.adjRowAdd}
          title="Add row"
          aria-label={`Add ${title} row`}
          onClick={onAdd}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
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
    const sessionUser = getUser();
    // PHP invoice.php: creator / App1 / App2 come only from approval_matrix
    // (INI_* for Initial, FINL_* for Final). USER_TYPE is not an approve role.
    return {
      creator: Boolean(fromCtx.creator),
      approver1: Boolean(fromCtx.approver1),
      approver2: Boolean(fromCtx.approver2),
      isMgmtUser: Boolean(fromCtx.isMgmtUser) || sessionUser?.userType === 'mgmt_user',
      userId: String(fromCtx.userId || sessionUser?.id || ''),
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
    // PHP only requires Level 1 Approvers when Send for Approval writes STATUS 1
    if (isSendForApproval && Number(status) === 1 && !(form.selApprovers || []).length) {
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
      notifyRecentWorkUpdated();
      const savedId = result?.invoiceId != null ? String(result.invoiceId) : '';
      const savedStatus = Number(result?.status);
      const approved = Number.isFinite(savedStatus) && savedStatus >= 5;

      // PHP: pending drafts (STATUS 1–4) stay on this form. Approved Final hides the
      // create form after reload (see showInvoiceForm / existing invoices).
      if (approved) {
        setInvoiceId('');
        setDraftInvoiceNo('');
        setInvoiceStatus(null);
      } else if (savedId) {
        setInvoiceId(savedId);
        if (!draftInvoiceNo && form.invoiceNo) {
          setDraftInvoiceNo(String(form.invoiceNo).trim());
        }
      }
      await alert({
        title: 'Saved',
        message: Number(status) === 0
          ? 'Freight invoice saved as draft.'
          : approved
            ? 'Freight invoice approved. It is listed under Existing Invoices.'
            : 'Freight invoice submitted for approval. Use Submit & Approve on this form to complete approval.',
        confirmLabel: 'OK',
      });
      setReloadToken((token) => token + 1);
      if (approved) {
        requestAnimationFrame(() => {
          document.getElementById('freight-existing-invoices')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
      }
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
      if (action === 'json') {
        const payload = JSON.stringify(invoice, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `invoice_${invoice.invoiceNo || invoice.invoiceId}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
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

  // PHP: Submit to edit / Send for Approval only when CRETR = 1 on the matching matrix.
  const showCreatorActions = Boolean(auth.creator) && editableByCreator;
  // PHP: Submit & Approve only when APP_1 / APP_2 = 1 (not USER_TYPE, not the picker).
  const statusNum = Number(status);
  const showApprover1Actions = auth.approver1 && hasDraft && (statusNum === 1 || statusNum === 4);
  const showApprover2Actions = auth.approver2 && hasDraft && statusNum === 3;

  const approveStatusApp1 = auth.hasApp2 ? 3 : 5;
  const reviewStatusApp2 = auth.hasApp1 ? 4 : 2;

  const existingInvoices = context?.existingInvoices || [];
  const isCoaVoyage = Boolean(context?.coaId) && String(context.coaId) !== '0';
  const hasApprovedFinal = existingInvoices.some((row) => (
    Number(row.status) === 5
    && /^final$/i.test(String(row.invoiceType || '').trim())
  ));
  // PHP invoice.php: $('#frm1').hide() when a STATUS=5 Final row exists and the voyage is not COA.
  const showInvoiceForm = isCoaVoyage || !hasApprovedFinal;

  const formActions = showInvoiceForm ? (
    <div className={styles.actionRow}>
      {showCreatorActions ? (
        <>
          <Button
            variant="outline"
            label="Save"
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
  ) : null;

  const pageTitleText = showInvoiceForm
    ? `${vcIn || context?.vcIn ? 'VC-in Invoice Creation' : 'Freight Invoice Creation'}${invType ? ` — ${invType === 'Final' ? 'Final' : 'Initial'}` : ''}${hasDraft ? ` (Status ${status})` : ''}`
    : `${vcIn || context?.vcIn ? 'VC-in Invoices' : 'Freight Invoices'}${invType ? ` — ${invType === 'Final' ? 'Final' : 'Initial'}` : ''}`;
  const loadChips = splitLocChips(context?.loadPorts);
  const dischargeChips = splitLocChips(context?.dischargePorts);

  return (
    <div className={`zafira-page ${styles.page}`}>
      <OpsVcBackHeaderActions backHref={backHref} disabled={saving} />
      {(loading || saving) ? (
        <LoadingOverlay show label={saving ? 'Saving invoice…' : 'Loading invoice…'} />
      ) : null}

      <div className={styles.pageHead}>
        <div className={styles.pageHeadTitleRow}>
          <div className={styles.pageHeadIcon} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <g transform="translate(3.5,2)">
                <path d="M11.2378,0.761771171 L4.5848,0.761771171 C2.5048,0.7538 0.7998,2.4118 0.7508,4.4908 L0.7508,15.2038 C0.7048,17.3168 2.3798,19.0678 4.4928,19.1148 C4.5238,19.1148 4.5538,19.1158 4.5848,19.1148 L12.5738,19.1148 C14.6678,19.0298 16.3178,17.2998 16.3029015,15.2038 L16.3029015,6.0378 L11.2378,0.761771171 Z" />
                <path d="M10.9751,0.75 L10.9751,3.659 C10.9751,5.079 12.1231,6.23 13.5431,6.234 L16.2981,6.234" />
                <line x1="10.7881" y1="13.3585" x2="5.3881" y2="13.3585" />
                <line x1="8.7432" y1="9.606" x2="5.3872" y2="9.606" />
              </g>
            </svg>
          </div>
          <h2 className={styles.pageTitle}>{pageTitleText}</h2>
        </div>
        <div className={styles.pageSub}>
          {context ? (
            <>
              <span>
                {context.voyageNo || '—'} · <b>{context.vesselName || '—'}</b>
                {context.cpDate ? <> · CP <b>{context.cpDate}</b></> : null}
              </span>
              {loadChips.map((port) => (
                <span key={`load-${port}`} className={styles.locChip}>{port}</span>
              ))}
              {loadChips.length > 0 && dischargeChips.length > 0 ? (
                <svg className={styles.locArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              ) : null}
              {dischargeChips.map((port) => (
                <span key={`dis-${port}`} className={styles.locChip}>{port}</span>
              ))}
            </>
          ) : null}
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {!loading && context ? (
        <>
          {showInvoiceForm ? (
          <>
          <InvoiceCard num="1" title="Invoice Details">
            <div className={styles.grid4}>
              <FormSelect
                id="shipOwner"
                label="Invoicing Company"
                required
                value={form.shipOwner}
                options={ownerOptions}
                onChange={(value) => updateField('shipOwner', value)}
              />
              <FormSelect
                id="invoiceType"
                label="Invoice Type"
                required
                value={form.invoiceType}
                options={invoiceTypeOptions}
                onChange={(value) => updateField('invoiceType', value)}
              />
              <Field id="invoiceNo" label="Invoice Number *" className={styles.field}>
                <input
                  id="invoiceNo"
                  className={styles.input}
                  value={form.invoiceNo || ''}
                  onChange={(event) => updateField('invoiceNo', event.target.value)}
                />
              </Field>
              <Field id="atten" label="Attn" className={styles.field}>
                <input
                  id="atten"
                  className={styles.input}
                  value={form.atten || ''}
                  onChange={(event) => updateField('atten', event.target.value)}
                />
              </Field>
              <Field id="invoiceDate" label="Invoice Date *" className={styles.field}>
                <DmyDateInput
                  id="invoiceDate"
                  value={form.invoiceDate || ''}
                  onChange={(value) => updateField('invoiceDate', value)}
                />
              </Field>
              <Field id="dueDate" label="Due Date" className={styles.field}>
                <DmyDateInput
                  id="dueDate"
                  value={form.dueDate || ''}
                  onChange={(value) => updateField('dueDate', value)}
                />
              </Field>
              <Field id="paymentTerms" label="Payment Terms" className={styles.field}>
                <input
                  id="paymentTerms"
                  className={styles.input}
                  value={form.paymentTerms || ''}
                  onChange={(event) => updateField('paymentTerms', event.target.value)}
                />
              </Field>
              <Field id="ffiSettlementDays" label="FFI Settlement Days" className={styles.field}>
                <input
                  id="ffiSettlementDays"
                  className={styles.input}
                  value={form.ffiSettlementDays || ''}
                  onChange={(event) => updateField('ffiSettlementDays', event.target.value)}
                  inputMode="numeric"
                />
              </Field>
              <FormSelect
                id="nob"
                label="Banking Details"
                className={styles.span2}
                value={form.nob}
                options={bankingOptions}
                onChange={(value) => updateField('nob', value)}
              />
              <BankingPanel
                detail={bankingDetail}
                cBankCheck={form.cBankCheck}
                onCBankCheckChange={(checked) => updateField('cBankCheck', checked)}
              />
            </div>
          </InvoiceCard>

          <InvoiceCard num="2" title="Freight Details">
            <div className={styles.grid4}>
              <Field id="vesselName" label="Vessel" className={`${styles.field} ${styles.readonly}`}>
                <input className={styles.input} readOnly value={context.vesselName || ''} />
              </Field>
              <Field id="fixtureRef" label="Fixture Ref." className={`${styles.field} ${styles.readonly}`}>
                <input className={styles.input} readOnly value={context.voyageNo || ''} />
              </Field>
              <Field id="cpDate" label="CP Date" className={`${styles.field} ${styles.readonly}`}>
                <input className={styles.input} readOnly value={context.cpDate || ''} />
              </Field>
              <Field id="cargoName" label="Cargo" className={`${styles.field} ${styles.readonly}`}>
                <input className={styles.input} readOnly value={context.cargoName || ''} />
              </Field>
            </div>
            <div className={`${styles.grid2} ${styles.mt14}`}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>To (Charterer)</label>
                <div className={styles.readonlyBlock}>
                  <div className={styles.rbName}>{context.vendorName || '—'}</div>
                  <div className={styles.rbAddress}>{context.vendorAddress || '—'}</div>
                </div>
              </div>
              <Field id="manualVendorName" label="Vendor (Billing)" className={styles.field}>
                <textarea
                  id="manualVendorName"
                  className={styles.textarea}
                  value={form.manualVendorName || ''}
                  onChange={(event) => updateField('manualVendorName', event.target.value)}
                />
              </Field>
            </div>
            <div className={`${styles.grid4} ${styles.mt14}`}>
              <Field id="blDate" label="BL Date" className={styles.field}>
                <DmyDateInput
                  id="blDate"
                  value={form.blDate || ''}
                  onChange={(value) => updateField('blDate', value)}
                />
              </Field>
              <Field id="blNo" label="BL No." className={styles.field}>
                <input
                  id="blNo"
                  className={styles.input}
                  value={form.blNo || ''}
                  onChange={(event) => updateField('blNo', event.target.value)}
                />
              </Field>
              <Field id="flag" label="Flag" className={styles.field}>
                <input
                  id="flag"
                  className={styles.input}
                  value={form.flag || ''}
                  onChange={(event) => updateField('flag', event.target.value)}
                />
              </Field>
              <Field id="imoNo" label="IMO No." className={styles.field}>
                <input
                  id="imoNo"
                  className={styles.input}
                  value={form.imoNo || ''}
                  onChange={(event) => updateField('imoNo', event.target.value)}
                />
              </Field>
            </div>
            <div className={`${styles.grid4} ${styles.mt14}`}>
              <div className={`${styles.field} ${styles.computed}`}>
                <label className={styles.fieldLabel} htmlFor="blQuantity">
                  BL Quantity<span className={styles.autoTag}>Auto</span>
                </label>
                <input
                  id="blQuantity"
                  className={styles.input}
                  value={form.blQuantity || ''}
                  onChange={(event) => updateField('blQuantity', event.target.value)}
                />
              </div>
              <Field id="freightRate" label="Freight Rate" className={styles.field}>
                <input
                  id="freightRate"
                  className={styles.input}
                  value={form.freightRate || ''}
                  onChange={(event) => updateField('freightRate', event.target.value)}
                />
              </Field>
              <Field id="loadPortName" label="Port of Loading" className={styles.field}>
                <textarea
                  id="loadPortName"
                  className={styles.textarea}
                  value={form.loadPortName || ''}
                  onChange={(event) => updateField('loadPortName', event.target.value)}
                />
              </Field>
              <Field id="dischargePortName" label="Port of Discharging" className={styles.field}>
                <textarea
                  id="dischargePortName"
                  className={styles.textarea}
                  value={form.dischargePortName || ''}
                  onChange={(event) => updateField('dischargePortName', event.target.value)}
                />
              </Field>
            </div>
          </InvoiceCard>

          <InvoiceCard num="3" title="Gross Freight & Adjustments">
            <ChecklistSection
              title="Club Freight"
              rows={clubRows}
              kind="club"
              onToggle={toggleClub}
            />
            <div className={`${styles.grid3} ${styles.mb18}`}>
              <Field id="grossFreight" label={`Gross Freight (${currencyCode}) *`} className={styles.field}>
                <input
                  id="grossFreight"
                  className={styles.input}
                  value={form.grossFreight || ''}
                  onChange={(event) => updateField('grossFreight', event.target.value)}
                  readOnly={Boolean(context?.freightBreakdown?.isDistributed)}
                />
              </Field>
              <Field id="percentThereOff" label="% Thereof *" className={styles.field}>
                <input
                  id="percentThereOff"
                  className={styles.input}
                  style={{ textAlign: 'right' }}
                  value={form.percentThereOff || ''}
                  onChange={(event) => updateField('percentThereOff', event.target.value)}
                  inputMode="decimal"
                  placeholder="%"
                />
              </Field>
              <Field id="freightDue" label="Amount" className={`${styles.field} ${styles.computed}`}>
                <input
                  id="freightDue"
                  className={styles.input}
                  readOnly
                  value={totals.freightDue.toFixed(2)}
                />
              </Field>
            </div>
            {showNetDead ? (
              <div className={`${styles.grid2} ${styles.mb18}`}>
                <Field id="netFreight" label={`Net Freight (${currencyCode})`} className={`${styles.field} ${styles.computed}`}>
                  <input
                    className={styles.input}
                    readOnly
                    value={Number(context?.freightBreakdown?.netFreight || 0).toFixed(2)}
                  />
                </Field>
                <Field id="deadFreight" label={`Dead Freight (${currencyCode})`} className={`${styles.field} ${styles.computed}`}>
                  <input
                    className={styles.input}
                    readOnly
                    value={Number(context?.freightBreakdown?.deadFreight || 0).toFixed(2)}
                  />
                </Field>
              </div>
            ) : null}

            <div className={styles.adjTwoCol}>
              <div className={styles.adjSide}>
                <div className={styles.adjLabel}><span className={`${styles.adjTag} ${styles.adjTagAdd}`}>Add</span>Adjustments</div>
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
                  title="Other Add"
                  rows={addRows}
                  orcOptions={orcOptions}
                  onAdd={() => addLine(addRows, setAddRows)}
                  onRemove={(lineId) => removeLine(addRows, setAddRows, lineId)}
                  onUpdate={(lineId, patch) => updateLine(addRows, setAddRows, lineId, patch)}
                />
              </div>

              <div className={styles.adjDivider} />

              <div className={styles.adjSide}>
                <div className={styles.adjLabel}><span className={`${styles.adjTag} ${styles.adjTagLess}`}>Less</span>Adjustments</div>
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
                <div className={styles.adjBlock}>
                  <div className={styles.adjSublabel}>Other Less</div>
                  <div className={`${styles.grid3} ${styles.mb14}`}>
                    <Field id="brokeragePercent" label="Brokerage (%)" className={styles.field}>
                      <input
                        id="brokeragePercent"
                        className={styles.input}
                        value={form.brokeragePercent || ''}
                        onChange={(event) => updateField('brokeragePercent', event.target.value)}
                      />
                    </Field>
                    <Field id="brokerageAmt" label="Amount" className={`${styles.field} ${styles.computed}`}>
                      <input className={styles.input} readOnly value={totals.brokerage.toFixed(2)} />
                    </Field>
                    <Field id="gstOnBrokPercent" label="GST on Brokerage (%)" className={styles.field}>
                      <input
                        id="gstOnBrokPercent"
                        className={styles.input}
                        value={form.gstOnBrokPercent || ''}
                        onChange={(event) => updateField('gstOnBrokPercent', event.target.value)}
                      />
                    </Field>
                  </div>
                  <div className={`${styles.grid3} ${styles.mb14}`}>
                    <Field id="gstOnBrokAmt" label="Amount" className={`${styles.field} ${styles.computed}`}>
                      <input className={styles.input} readOnly value={totals.gstOnBrok.toFixed(2)} />
                    </Field>
                    <Field id="addComPercent" label="Less Addcom" className={styles.field}>
                      <input
                        id="addComPercent"
                        className={styles.input}
                        value={form.addComPercent || ''}
                        onChange={(event) => updateField('addComPercent', event.target.value)}
                      />
                    </Field>
                    <Field id="addComAmt" label="Amount" className={`${styles.field} ${styles.computed}`}>
                      <input className={styles.input} readOnly value={totals.addCom.toFixed(2)} />
                    </Field>
                  </div>
                  <LineSection
                    title=""
                    rows={subRows}
                    orcOptions={orcOptions}
                    onAdd={() => addLine(subRows, setSubRows)}
                    onRemove={(lineId) => removeLine(subRows, setSubRows, lineId)}
                    onUpdate={(lineId, patch) => updateLine(subRows, setSubRows, lineId, patch)}
                  />
                </div>
              </div>
            </div>
          </InvoiceCard>

          <InvoiceCard num="4" title="Demurrage / Dispatch & DA">
            <ChecklistSection
              title="Demurrage / Dispatch"
              rows={demRows}
              kind="dem"
              onToggle={toggleChecklist(setDemRows)}
              onProrateToggle={toggleDemProrate}
            />
            <ChecklistSection
              title="DA (LP/DP/TP)"
              rows={daRows}
              kind="da"
              onToggle={toggleChecklist(setDaRows)}
            />
          </InvoiceCard>

          <InvoiceCard num="5" title="Exchange & Tax">
            <div className={`${styles.grid3} ${styles.mb14}`}>
              <Field id="exchangeRate" label="Exchange Rate" className={styles.field}>
                <input
                  id="exchangeRate"
                  className={styles.input}
                  value={form.exchangeRate || ''}
                  onChange={(event) => updateField('exchangeRate', event.target.value)}
                />
              </Field>
              <Field id="exchangeDate" label="Exchange Date" className={styles.field}>
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
            </div>
            <div className={`${styles.field} ${styles.mb14}`}>
              <label className={styles.fieldLabel}>Apply GST or VAT</label>
              <div className={styles.toggleRow}>
                <button
                  type="button"
                  className={`${styles.toggleSwitch} ${taxEnabled ? styles.toggleOn : ''}`}
                  aria-pressed={taxEnabled}
                  onClick={() => updateField('taxApplicable', taxEnabled ? '2' : '1')}
                >
                  <span className={styles.toggleKnob} />
                </button>
                <span className={styles.toggleText}>{taxEnabled ? 'Yes' : 'No'}</span>
                <div className={`${styles.segToggle} ${gstMode ? '' : styles.segPos2} ${taxEnabled ? '' : styles.segDisabled}`}>
                  <div className={styles.segThumb} />
                  <button
                    type="button"
                    className={`${styles.segOpt} ${gstMode ? styles.segActive : ''}`}
                    onClick={() => updateField('gstVat', '1')}
                    disabled={!taxEnabled}
                  >
                    GST
                  </button>
                  <button
                    type="button"
                    className={`${styles.segOpt} ${!gstMode ? styles.segActive : ''}`}
                    onClick={() => updateField('gstVat', '2')}
                    disabled={!taxEnabled}
                  >
                    VAT
                  </button>
                </div>
              </div>
            </div>
            {taxEnabled && gstMode ? (
              <div className={`${styles.grid3} ${styles.mb14}`}>
                <Field id="sgstPercent" label="SGST (%)" className={styles.field}>
                  <input
                    id="sgstPercent"
                    className={styles.input}
                    value={form.sgstPercent || ''}
                    onChange={(event) => updateField('sgstPercent', event.target.value)}
                  />
                </Field>
                <Field id="cgstPercent" label="CGST (%)" className={styles.field}>
                  <input
                    id="cgstPercent"
                    className={styles.input}
                    value={form.cgstPercent || ''}
                    onChange={(event) => updateField('cgstPercent', event.target.value)}
                  />
                </Field>
                <Field id="igstPercent" label="IGST (%)" className={styles.field}>
                  <input
                    id="igstPercent"
                    className={styles.input}
                    value={form.igstPercent || ''}
                    onChange={(event) => updateField('igstPercent', event.target.value)}
                  />
                </Field>
                <Field id="sgstAmount" label="SGST Amt" className={`${styles.field} ${styles.computed}`}>
                  <input className={styles.input} readOnly value={totals.sgstAmount.toFixed(2)} />
                </Field>
                <Field id="cgstAmount" label="CGST Amt" className={`${styles.field} ${styles.computed}`}>
                  <input className={styles.input} readOnly value={totals.cgstAmount.toFixed(2)} />
                </Field>
                <Field id="igstAmount" label="IGST Amt" className={`${styles.field} ${styles.computed}`}>
                  <input className={styles.input} readOnly value={totals.igstAmount.toFixed(2)} />
                </Field>
              </div>
            ) : null}
            {taxEnabled && !gstMode ? (
              <div className={`${styles.grid2} ${styles.mb14}`}>
                <Field id="vatPercent" label="VAT (%)" className={styles.field}>
                  <input
                    id="vatPercent"
                    className={styles.input}
                    value={form.vatPercent || ''}
                    onChange={(event) => updateField('vatPercent', event.target.value)}
                  />
                </Field>
                <Field id="vatAmount" label="VAT Amt" className={`${styles.field} ${styles.computed}`}>
                  <input className={styles.input} readOnly value={totals.vatAmount.toFixed(2)} />
                </Field>
              </div>
            ) : null}
            <Field id="remarks" label="Description" className={`${styles.field} ${styles.narrow}`}>
              <textarea
                id="remarks"
                className={styles.textarea}
                value={form.remarks || ''}
                onChange={(event) => updateField('remarks', event.target.value)}
              />
            </Field>
          </InvoiceCard>

          <InvoiceCard num="6" title="Payable Summary">
            <div className={styles.summaryTiles}>
              <div className={`${styles.summaryTile} ${styles.tileNavy}`}>
                <div className={styles.stLabel}>Amount Payable</div>
                <div className={styles.stValue}>{totals.netPayable.toFixed(2)}</div>
              </div>
              <div className={`${styles.summaryTile} ${styles.tileOrange}`}>
                <div className={styles.stLabel}>Amount Payable (After Tax)</div>
                <div className={styles.stValue}>{totals.netPayableTax.toFixed(2)}</div>
              </div>
              <div className={`${styles.summaryTile} ${styles.tileGrey}`}>
                <div className={styles.stLabel}>
                  Exchange To Currency
                  {form.exchangeCurrency ? ` (${form.exchangeCurrency})` : ''}
                </div>
                <div className={styles.stValue}>
                  {parseAmount(form.exchangeRate) > 0 ? totals.exchanged.toFixed(2) : '—'}
                </div>
              </div>
            </div>
          </InvoiceCard>

          <InvoiceCard num="7" title="Documents & Approval">
            <AttachDropzone
              files={attachFiles}
              existingName={existingUploadName}
              existingUpload={existingUpload}
              onFiles={setAttachFiles}
            />
            <div className={`${styles.field} ${styles.mb14}`} data-field="paymentStatus" id="paymentStatus">
              <label className={styles.fieldLabel}>Invoice Status</label>
              <div className={`${styles.statusToggle} ${form.paymentStatus === 'payment_hold' ? styles.statusHold : ''}`}>
                <div className={styles.stThumb} />
                <button
                  type="button"
                  className={`${styles.stOpt} ${form.paymentStatus === 'payment_payable' ? styles.stActive : ''}`}
                  onClick={() => updateField('paymentStatus', 'payment_payable')}
                >
                  Payable
                </button>
                <button
                  type="button"
                  className={`${styles.stOpt} ${form.paymentStatus === 'payment_hold' ? styles.stActive : ''}`}
                  onClick={() => updateField('paymentStatus', 'payment_hold')}
                >
                  On Hold
                </button>
              </div>
            </div>
            <div className={styles.approverRow} data-field="selApprovers" id="selApprovers">
              <div className={`${styles.field} ${styles.approverField}`}>
                <label className={styles.fieldLabel}>Level 1 Approver</label>
                <CountryMultiSelect
                  options={context.approvers || []}
                  value={form.selApprovers || []}
                  onChange={(value) => updateField('selApprovers', value)}
                  placeholder="Choose Approver..."
                  searchPlaceholder="Search approver…"
                />
              </div>
            </div>
            {formActions}
          </InvoiceCard>
          </>
          ) : (
            <p className={styles.listHint}>
              Invoice submitted. Approved and pending invoices for this fixture are listed below.
            </p>
          )}

          <InvoiceCard
            num="8"
            title="Invoice History"
            sub={context.voyageNo || context.vesselName
              ? `Ref. ${context.voyageNo || '—'} · ${context.vesselName || '—'}`
              : null}
          >
            <div className={styles.tableWrap} id="freight-existing-invoices">
              <table className={styles.existingTable}>
                    <thead>
                      <tr>
                        <th>Fixture No.</th>
                        <th>Vessel</th>
                        <th>Invoice Type</th>
                        <th>Invoice No.</th>
                        <th>Charterer</th>
                        <th>Amount</th>
                        <th>Invoice PDF</th>
                        <th>Cancel Invoice</th>
                        <th>Payment</th>
                        <th>Description</th>
                        <th>Open</th>
                        <th>Last Updated By/Time</th>
                        <th>Del</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={13} className={styles.emptyExisting}>
                            SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                          </td>
                        </tr>
                      ) : (
                        existingInvoices.map((row) => (
                          <tr key={row.invoiceId}>
                            <td>{row.voyageNo || '—'}</td>
                            <td>{row.vesselName || '—'}</td>
                            <td>{row.invoiceType || '—'}</td>
                            <td>{row.invoiceNo || '—'}</td>
                            <td>{row.chartererName || '—'}</td>
                            <td>{row.amount != null ? money2(row.amount).toFixed(2) : '—'}</td>
                            <td>
                              <div className={styles.pdfActions}>
                                {row.canPdf ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      icon="download"
                                      label="Generate PDF"
                                      onClick={() => handleInvoiceAction('pdf', row)}
                                    />
                                    {row.canJson !== false ? (
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        icon="download"
                                        label="Generate Json"
                                        onClick={() => handleInvoiceAction('json', row)}
                                      />
                                    ) : null}
                                    {row.canPdfAed ? (
                                      <Button
                                        size="sm"
                                        variant="accent"
                                        icon="download"
                                        label="Generate PDF-AED"
                                        onClick={() => handleInvoiceAction('pdfAed', row)}
                                      />
                                    ) : null}
                                  </>
                                ) : (
                                  <span className={styles.pendingActions}>Pending approval</span>
                                )}
                              </div>
                            </td>
                            <td>
                              {row.canCancel ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  label="Cancel"
                                  onClick={() => handleInvoiceAction('cancel', row)}
                                />
                              ) : row.isCancelled || Number(row.status) === 8 ? (
                                <span className={styles.cancelledLabel}>Cancelled</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              {row.canReceivePayment ? (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  label="Payment Received"
                                  onClick={() => handleInvoiceAction('payment', row)}
                                />
                              ) : Number(row.status) >= 5 && Number(row.status) !== 8 ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  label="Payment Received"
                                  disabled
                                />
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>{row.remarks || '—'}</td>
                            <td>
                              {row.canReopen ? (
                                <Button
                                  size="sm"
                                  variant="accent"
                                  label="Open"
                                  onClick={() => handleInvoiceAction('reopen', row)}
                                />
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              {[row.lastUpdatedBy, row.lastUpdatedAt].filter(Boolean).join('-') || '—'}
                            </td>
                            <td>
                              {row.canDelete ? (
                                <Button
                                  size="sm"
                                  variant="link"
                                  icon="trash"
                                  ariaLabel={`Delete ${row.invoiceNo || row.invoiceId}`}
                                  onClick={() => handleInvoiceAction('delete', row)}
                                />
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
          </InvoiceCard>
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

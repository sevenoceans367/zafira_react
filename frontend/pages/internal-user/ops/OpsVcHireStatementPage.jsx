import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  CardSelect,
  DmyDateInput,
  Field,
  LoadingOverlay,
  RowAddButton,
  RowDelButton,
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
import { notifyRecentWorkUpdated } from '../../../services/recentWork.js';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import OpsVcBackHeaderActions from './OpsVcBackHeaderActions.jsx';
import { formatLastUpdated } from './OpsVcGlanceUi.jsx';
import VoyageOpsHeading from './VoyageOpsHeading.jsx';
import docStyles from './OpsDocumentsPage.module.css';
import styles from './OpsVcHireStatementPage.module.css';

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20V4" />
      <path d="M5 11l7-7 7 7" />
    </svg>
  );
}

function moneyLabel(currency) {
  const code = String(currency || 'USD').toUpperCase();
  return code === 'USD' ? '$' : code;
}

function gradeChipClass(gradeName) {
  const text = String(gradeName || '').toUpperCase().replace(/\s+/g, '');
  if (text.includes('SCRUBBER')) return styles.gradeChipScrubber;
  if (text.includes('LSMGO')) return styles.gradeChipLsmgo;
  if (text.includes('MGO')) return styles.gradeChipMgo;
  if (text.includes('HSFO')) return styles.gradeChipHsfo;
  if (text.includes('VLSFO')) return styles.gradeChipVlsfo;
  return '';
}

function optionLabel(options, value) {
  const hit = (options || []).find((row) => String(row.value) === String(value));
  return hit?.label || '';
}

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

const EMPTY_BUNKER = () => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  bunkerId: '',
  qty: '',
  price: '',
  amount: '',
});

const EMPTY_OFFHIRE = (hireRate = '') => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  reason: '',
  offFrom: '',
  offTo: '',
  percent: '100',
  days: '',
  hireRate: hireRate === '' || hireRate == null ? '' : String(hireRate),
  amount: '',
});

const EMPTY_SURVEY = (description = '') => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  description,
  amount: '',
  chkOwnerAcc: false,
});

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function money2(value) {
  return Number(parseAmount(value).toFixed(2));
}

function days5(value) {
  return Number(parseAmount(value).toFixed(5));
}

function strOrEmpty(value) {
  if (value == null) return '';
  return String(value).trim();
}

function parseDmyDateTime(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T]+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '0', mi = '0'] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(fromStr, toStr) {
  const from = parseDmyDateTime(fromStr);
  const to = parseDmyDateTime(toStr);
  if (!from || !to) return 0;
  return Math.max(0, (to.getTime() - from.getTime()) / 86400000);
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
    bunkerId: strOrEmpty(row.bunkerId),
    description: strOrEmpty(row.description || row.reason),
    reason: strOrEmpty(row.reason),
    offFrom: strOrEmpty(row.offFrom),
    offTo: strOrEmpty(row.offTo),
    percent: row.percent == null || row.percent === '' ? '100' : String(row.percent),
    days: row.days == null || row.days === '' ? '' : String(row.days),
    hireRate: row.hireRate == null || row.hireRate === '' ? '' : String(row.hireRate),
    amount: row.amount == null || row.amount === '' ? '' : String(row.amount),
    qty: row.qty == null || row.qty === '' ? '' : String(row.qty),
    price: row.price == null || row.price === '' ? '' : String(row.price),
    chkOwnerAcc: Boolean(row.chkOwnerAcc),
  }));
}

function toSelectOptions(rows) {
  return [
    { value: '', label: 'Select' },
    ...(rows || []).map((row) => ({
      value: String(row.id ?? row.value ?? ''),
      label: row.name || row.label || String(row.id ?? ''),
    })),
  ];
}

function splitLocChips(value) {
  return String(value || '')
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split('/')[0].trim())
    .filter(Boolean);
}

function getScrollParent(node) {
  let current = node?.parentElement || null;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return current;
    }
    current = current.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function StatementCard({
  num,
  title,
  children,
  bodyClassName = '',
  headExtra = null,
  className = '',
  cardRef = null,
  hideHead = false,
}) {
  return (
    <section
      ref={cardRef}
      className={[styles.card, className].filter(Boolean).join(' ')}
    >
      {hideHead ? null : (
        <div className={styles.cardHead}>
          <span className={styles.cardNum}>{num}</span>
          <div className={styles.cardTitle}>{title}</div>
          {headExtra}
        </div>
      )}
      <div className={bodyClassName ? `${styles.cardBody} ${bodyClassName}` : styles.cardBody}>
        {children}
      </div>
    </section>
  );
}

function FormSelect({
  id,
  label,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
  className = '',
  hint = '',
}) {
  return (
    <Field
      id={id}
      label={required ? `${label} *` : label}
      className={[styles.field, className].filter(Boolean).join(' ')}
    >
      <div className={styles.cardSelect}>
        <CardSelect
          value={value || ''}
          options={options}
          placeholder="Select"
          ariaLabel={label}
          align="start"
          disabled={disabled}
          onChange={onChange}
        />
      </div>
      {hint ? <div className={styles.hint}>{hint}</div> : null}
    </Field>
  );
}

function OvalToggle({ on, onToggle, label, children }) {
  return (
    <div className={styles.ovalToggle}>
      <button
        type="button"
        className={`${styles.sw}${on ? ` ${styles.swOn}` : ''}`}
        onClick={onToggle}
        aria-pressed={on}
        aria-label={label}
      >
        <span className={styles.kb} />
      </button>
      <span className={styles.otLabel}>{label}</span>
      {children}
    </div>
  );
}

function openBlob(file, download = false) {
  const url = URL.createObjectURL(file);
  if (download) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name || 'attachment';
    anchor.click();
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function AttachDropzone({
  id = 'attach_file',
  files = [],
  existingName,
  existingUpload,
  onFiles,
  onRemoveFile,
  disabled = false,
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const existingHref = existingUpload && (
    String(existingUpload).startsWith('http')
    || String(existingUpload).startsWith('/')
  ) ? existingUpload : null;

  const pickFiles = (list) => {
    if (disabled) return;
    onFiles(Array.from(list || []));
  };

  return (
    <div className={styles.docsAttachWrap}>
      <input
        id={id}
        ref={inputRef}
        className={docStyles.hiddenFileInput}
        type="file"
        multiple
        disabled={disabled}
        onChange={(event) => {
          pickFiles(event.target.files);
          event.target.value = '';
        }}
      />
      {/* Same dropzone layout as Ops Documents page */}
      <div
        className={[
          docStyles.dropzone,
          over ? docStyles.dropzoneActive : '',
          disabled ? docStyles.dropzoneDisabled : '',
        ].filter(Boolean).join(' ')}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setOver(false);
          pickFiles(event.dataTransfer?.files);
        }}
      >
        <div className={docStyles.dropzoneIcon}>
          <UploadIcon />
        </div>
        <div className={docStyles.dropzoneText}>
          <b>Click to upload</b>
          {' '}
          or drag and drop
          <br />
          PDF, Word, Excel up to 20MB
        </div>
      </div>

      {(files.length || existingName || existingUpload) ? (
        <div className={styles.docLinks}>
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className={styles.docChip}>
              <svg className={styles.docChipIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
              <span className={styles.docChipName}>{file.name}</span>
              <span className={styles.docChipActs}>
                <button type="button" onClick={() => openBlob(file, false)}>View</button>
                <button type="button" onClick={() => openBlob(file, true)}>Download</button>
                {onRemoveFile ? (
                  <button type="button" onClick={() => onRemoveFile(index)}>Remove</button>
                ) : null}
              </span>
            </div>
          ))}
          {!files.length && (existingName || existingUpload) ? (
            <div className={styles.docChip}>
              <svg className={styles.docChipIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
              <span className={styles.docChipName}>{existingName || existingUpload}</span>
              {existingHref ? (
                <span className={styles.docChipActs}>
                  <a href={existingHref} target="_blank" rel="noreferrer">View</a>
                  <a href={existingHref} download>Download</a>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BankingRows({ detail, cBankCheck, onCBankCheckChange }) {
  return (
    <>
      <div className={styles.bankRows}>
        <div className={styles.bankRow}><span className={styles.bkLabel}>Address</span><span className={styles.bkVal}>{detail?.address || '—'}</span></div>
        <div className={styles.bankRow}><span className={styles.bkLabel}>Beneficiary A/C No.</span><span className={styles.bkVal}>{detail?.accountNo || '—'}</span></div>
        <div className={styles.bankRow}><span className={styles.bkLabel}>Beneficiary Bank</span><span className={styles.bkVal}>{detail?.bank || detail?.name || '—'}</span></div>
        <div className={styles.bankRow}><span className={styles.bkLabel}>Beneficiary Bank Address</span><span className={styles.bkVal}>{detail?.bankAddress || '—'}</span></div>
        <div className={styles.bankRow}><span className={styles.bkLabel}>Beneficiary Bank Swift Code</span><span className={styles.bkVal}>{detail?.swiftCode || '—'}</span></div>
        <div className={styles.bankRow}><span className={styles.bkLabel}>IBAN No.</span><span className={styles.bkVal}>{detail?.ibanNo || '—'}</span></div>
        <div className={styles.bankRow}><span className={styles.bkLabel}>FED ABA</span><span className={styles.bkVal}>{detail?.fedAba || '—'}</span></div>
      </div>
      <label className={styles.corrToggle}>
        <input
          type="checkbox"
          checked={Boolean(cBankCheck)}
          onChange={(event) => onCBankCheckChange?.(event.target.checked)}
        />
        Correspondent Details
      </label>
      {cBankCheck ? (
        <div className={styles.bankRows}>
          <div className={styles.bankRow}><span className={styles.bkLabel}>Correspondent Bank Name</span><span className={styles.bkVal}>{detail?.correspondentBankName || '—'}</span></div>
          <div className={styles.bankRow}><span className={styles.bkLabel}>Correspondent Bank Address</span><span className={styles.bkVal}>{detail?.correspondentBankAddress || '—'}</span></div>
          <div className={styles.bankRow}><span className={styles.bkLabel}>Account Number</span><span className={styles.bkVal}>{detail?.correspondentAccountNo || '—'}</span></div>
          <div className={styles.bankRow}><span className={styles.bkLabel}>Swift Code</span><span className={styles.bkVal}>{detail?.correspondentSwiftCode || '—'}</span></div>
        </div>
      ) : null}
    </>
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
  disabled = false,
}) {
  const colsClass = adjustment ? styles.colsAdjustment : styles.colsOthless;
  return (
    <>
      {title ? <div className={styles.subhead}>{title}</div> : null}
      <div className={`${styles.adjHead} ${colsClass}`}>
        <span>Cost Type</span>
        {adjustment ? (
          <>
            <span>Fixture No</span>
            <span>Vessel</span>
          </>
        ) : null}
        <span>Description</span>
        <span>Amount</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div key={row.id} className={`${styles.adjRow} ${colsClass}`}>
          <div className={styles.cardSelect}>
            <CardSelect
              value={row.orcId || ''}
              options={orcOptions}
              placeholder="Select"
              ariaLabel={`${title || 'Line'} cost type`}
              align="start"
              disabled={disabled}
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
                  ariaLabel={`${title || 'Line'} fixture`}
                  align="start"
                  disabled={disabled}
                  onChange={(value) => onFixtureChange?.(row.id, value)}
                />
              </div>
              <div className={styles.cardSelect}>
                <CardSelect
                  value={row.vessel || ''}
                  options={vesselOptions}
                  placeholder="Select"
                  ariaLabel={`${title || 'Line'} vessel`}
                  align="start"
                  disabled={disabled}
                  onChange={(value) => onUpdate(row.id, { vessel: value })}
                />
              </div>
            </>
          ) : null}
          <textarea
            className={`${styles.textarea} ${styles.textareaSmall}`}
            rows={2}
            placeholder="Description..."
            value={row.description}
            disabled={disabled}
            onChange={(event) => onUpdate(row.id, { description: event.target.value })}
          />
          <input
            className={styles.input}
            placeholder="0.00"
            value={row.amount}
            disabled={disabled}
            onChange={(event) => onUpdate(row.id, { amount: event.target.value })}
          />
          <div className={styles.rowActions}>
            <RowDelButton title="Remove row" onClick={() => onRemove(row.id)} disabled={disabled} />
            {index === rows.length - 1 ? (
              <RowAddButton title="Add row" onClick={onAdd} disabled={disabled} />
            ) : null}
          </div>
        </div>
      ))}
      {!rows.length ? (
        <button type="button" className={styles.addDashed} onClick={onAdd} disabled={disabled}>
          + Add row
        </button>
      ) : null}
    </>
  );
}

function BunkerSection({ rows, bunkerOptions, onAdd, onRemove, onUpdate, disabled = false }) {
  return (
    <div className={styles.checkPanel}>
      <div className={`${styles.adjHead} ${styles.colsBunker}`}>
        <span>Bunker Grade</span>
        <span>Qty (MT)</span>
        <span>Price ($)</span>
        <span>Amount ($)</span>
        <span />
      </div>
      {rows.map((row, index) => {
        const gradeLabel = optionLabel(bunkerOptions, row.bunkerId);
        const gradeClass = gradeChipClass(gradeLabel);
        return (
          <div key={row.id} className={`${styles.adjRow} ${styles.colsBunker}`}>
            <div className={`${styles.cardSelect} ${styles.gradeSelectWrap}${gradeClass ? ` ${gradeClass}` : ''}`}>
              <CardSelect
                value={row.bunkerId || ''}
                options={bunkerOptions}
                placeholder="Select"
                ariaLabel="Bunker grade"
                align="start"
                disabled={disabled}
                onChange={(value) => onUpdate(row.id, { bunkerId: value })}
              />
            </div>
            <input className={styles.input} value={row.qty} disabled={disabled} onChange={(event) => onUpdate(row.id, { qty: event.target.value })} />
            <input className={styles.input} value={row.price} disabled={disabled} onChange={(event) => onUpdate(row.id, { price: event.target.value })} />
            <input className={styles.input} readOnly value={money2(parseAmount(row.qty) * parseAmount(row.price)).toFixed(2)} />
            <div className={styles.rowActions}>
              <RowDelButton title="Remove row" onClick={() => onRemove(row.id)} disabled={disabled} />
              {index === rows.length - 1 ? (
                <RowAddButton title="Add row" onClick={onAdd} disabled={disabled} />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
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
            <label htmlFor="hirePayDate">Date</label>
            <DmyDateInput id="hirePayDate" value={date} onChange={setDate} required />
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

function updateRows(setter, id, patch) {
  setter((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
}

function removeOrKeep(setter, factory, id) {
  setter((rows) => (rows.length <= 1 ? [factory()] : rows.filter((row) => row.id !== id)));
}

/**
 * React port of PHP invoice_hire.php (Hire Statement Creation).
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
  const [hireDayRows, setHireDayRows] = useState([]);
  const [addRows, setAddRows] = useState([EMPTY_LINE()]);
  const [subRows, setSubRows] = useState([EMPTY_LINE()]);
  const [adjAddRows, setAdjAddRows] = useState([EMPTY_ADJ_LINE()]);
  const [adjSubRows, setAdjSubRows] = useState([EMPTY_ADJ_LINE()]);
  const [holdRows, setHoldRows] = useState([EMPTY_LINE()]);
  const [surveyRows, setSurveyRows] = useState([EMPTY_SURVEY('Joint On-Hire Survey'), EMPTY_SURVEY('Joint Off-Hire Survey')]);
  const [offhireRows, setOffhireRows] = useState([EMPTY_OFFHIRE()]);
  const [bunkerDelRows, setBunkerDelRows] = useState([EMPTY_BUNKER()]);
  const [bunkerRedelRows, setBunkerRedelRows] = useState([EMPTY_BUNKER()]);
  const [bunkerOverRows, setBunkerOverRows] = useState([EMPTY_BUNKER()]);
  const [attachFiles, setAttachFiles] = useState([]);
  const [cBankCheck, setCBankCheck] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [summaryStuck, setSummaryStuck] = useState(false);
  const summaryRef = useRef(null);
  const summaryHeadRef = useRef(null);

  const backHref = useMemo(() => {
    const params = new URLSearchParams({
      comid: context?.comId || comId,
      page,
    });
    if (voyageNo || context?.voyageNo) params.set('voyageNo', voyageNo || context.voyageNo);
    return appPath(`/internal-user/vc/ops/payment-grid?${params.toString()}`);
  }, [comId, context?.comId, context?.voyageNo, page, voyageNo]);

  const typeOptions = useMemo(() => toSelectOptions(context?.invoiceTypes), [context?.invoiceTypes]);
  const currencyOptions = useMemo(() => toSelectOptions(context?.currencies), [context?.currencies]);
  const ownerOptions = useMemo(() => toSelectOptions(context?.owners), [context?.owners]);
  const orcOptions = useMemo(() => toSelectOptions(context?.orcOptions), [context?.orcOptions]);
  const fixtureOptions = useMemo(() => toSelectOptions(context?.fixtures), [context?.fixtures]);
  const vesselOptions = useMemo(() => toSelectOptions(context?.vessels), [context?.vessels]);
  const bunkerOptions = useMemo(() => toSelectOptions(context?.bunkerGrades), [context?.bunkerGrades]);
  const fixtureVesselMap = useMemo(() => {
    const map = new Map();
    (context?.fixtures || []).forEach((row) => {
      map.set(String(row.id), row.vesselId || '');
    });
    return map;
  }, [context?.fixtures]);

  const bankingOptions = useMemo(() => {
    const vendor = context?.vendorBanking || [];
    if (vendor.length) return toSelectOptions(vendor);
    return toSelectOptions(context?.companyBankingDetails);
  }, [context?.companyBankingDetails, context?.vendorBanking]);

  const bankingDetail = useMemo(() => {
    const id = form.bankingId || form.bankingDetailId;
    return (context?.vendorBanking || []).find((row) => String(row.id) === String(id))
      || (context?.companyBankingDetails || []).find((row) => String(row.id) === String(id))
      || null;
  }, [context?.companyBankingDetails, context?.vendorBanking, form.bankingDetailId, form.bankingId]);

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
      chkOverconsp: Boolean(prefill.chkOverconsp),
      shipOwner: strOrEmpty(prefill.shipOwner),
      bankingId: strOrEmpty(prefill.bankingId),
      bankingDetailId: strOrEmpty(prefill.bankingDetailId),
      paymentStatus: strOrEmpty(prefill.paymentStatus || 'payment_payable'),
      selApprovers: Array.isArray(prefill.selApprovers) ? prefill.selApprovers.map(String) : [],
      upload: strOrEmpty(prefill.upload),
      uploadName: strOrEmpty(prefill.uploadName),
    });
    setHireDayRows((prefill.hireDayRows || data.hireDayRows || []).map((row) => ({
      ...row,
      id: row.id || row.randomId || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      hireFrom: strOrEmpty(row.hireFrom),
      hireTo: strOrEmpty(row.hireTo),
      utilisedDays: row.utilisedDays == null ? '' : String(row.utilisedDays),
      hireAmt: row.hireAmt == null ? '' : String(row.hireAmt),
    })));
    setAddRows(withClientIds(prefill.addRows, EMPTY_LINE));
    setSubRows(withClientIds(prefill.subRows, EMPTY_LINE));
    setAdjAddRows(withClientIds(prefill.adjAddRows, EMPTY_ADJ_LINE));
    setAdjSubRows(withClientIds(prefill.adjSubRows, EMPTY_ADJ_LINE));
    setHoldRows(withClientIds(prefill.holdRows, EMPTY_LINE));
    setSurveyRows(withClientIds(prefill.surveyRows, () => EMPTY_SURVEY()));
    setOffhireRows(withClientIds(prefill.offhireRows, () => EMPTY_OFFHIRE(prefill.dailyHireRate)));
    setBunkerDelRows(withClientIds(prefill.bunkerDelRows, EMPTY_BUNKER));
    setBunkerRedelRows(withClientIds(prefill.bunkerRedelRows, EMPTY_BUNKER));
    setBunkerOverRows(withClientIds(prefill.bunkerOverRows, EMPTY_BUNKER));
    setAttachFiles([]);
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

  const updateHireDay = (id, patch) => {
    setHireDayRows((rows) => rows.map((row) => {
      if (row.id !== id && row.randomId !== id) return row;
      const next = { ...row, ...patch };
      if (patch.hireFrom != null || patch.hireTo != null) {
        const utilised = daysBetween(next.hireFrom, next.hireTo);
        next.utilisedDays = String(days5(utilised));
        next.hireAmt = String(money2(utilised * parseAmount(next.dailyRate)));
      } else if (patch.utilisedDays != null) {
        next.hireAmt = String(money2(parseAmount(next.utilisedDays) * parseAmount(next.dailyRate)));
      }
      return next;
    }));
  };

  const updateOffhire = (id, patch) => {
    setOffhireRows((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, ...patch };
      if (patch.offFrom != null || patch.offTo != null) {
        next.days = String(days5(daysBetween(next.offFrom, next.offTo)));
      }
      const percent = parseAmount(next.percent) || 100;
      next.amount = String(money2(parseAmount(next.days) * parseAmount(next.hireRate) * (percent / 100)));
      return next;
    }));
  };

  const currency = form.exchangeCurrency || 'USD';
  const cur = moneyLabel(currency);
  const totals = useMemo(() => {
    const hireDays = days5(hireDayRows.reduce((sum, row) => sum + parseAmount(row.utilisedDays), 0));
    const hireAmt = money2(hireDayRows.reduce((sum, row) => sum + parseAmount(row.hireAmt), 0));
    const remainingDays = days5(hireDayRows.reduce((sum, row) => (
      sum + Math.max(0, parseAmount(row.remainingDays) - parseAmount(row.utilisedDays))
    ), 0));
    const cveAmt = money2(((parseAmount(form.cve) * 12) / 365) * hireDays);
    let grossHire = hireAmt;
    if (form.chkBallastBonus) grossHire = money2(grossHire + parseAmount(context?.ballastBonus));
    const addCommAmt = money2((grossHire * parseAmount(form.addCommPer)) / 100);
    const broCommAmt = money2((grossHire * parseAmount(form.broCommPer)) / 100);
    const addTotal = addRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const subTotal = subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const adjAdd = adjAddRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const adjSub = adjSubRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const holdTotal = holdRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const surveyAdd = surveyRows.filter((row) => row.chkOwnerAcc).reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const surveyLess = surveyRows.filter((row) => !row.chkOwnerAcc).reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const bunkerDel = form.chkDelivery
      ? bunkerDelRows.reduce((sum, row) => sum + money2(parseAmount(row.qty) * parseAmount(row.price)), 0)
      : 0;
    const bunkerRedel = form.chkRedelivery
      ? bunkerRedelRows.reduce((sum, row) => sum + money2(parseAmount(row.qty) * parseAmount(row.price)), 0)
      : 0;
    const bunkerOver = form.chkOverconsp
      ? bunkerOverRows.reduce((sum, row) => sum + money2(parseAmount(row.qty) * parseAmount(row.price)), 0)
      : 0;
    const offhireAmt = form.chkOffhire
      ? offhireRows.reduce((sum, row) => sum + parseAmount(row.amount), 0)
      : 0;
    const finalAmt = money2(
      grossHire + cveAmt + addTotal + adjAdd + holdTotal + surveyAdd + bunkerDel
      - addCommAmt - broCommAmt - subTotal - adjSub - surveyLess - bunkerRedel - bunkerOver - offhireAmt,
    );
    return {
      hireDays,
      hireAmt,
      remainingDays,
      cveAmt,
      addCommAmt,
      broCommAmt,
      finalAmt,
      ballastBonus: parseAmount(context?.ballastBonus),
    };
  }, [
    addRows, adjAddRows, adjSubRows, bunkerDelRows, bunkerOverRows, bunkerRedelRows,
    context?.ballastBonus, form.addCommPer, form.broCommPer, form.chkBallastBonus,
    form.chkDelivery, form.chkOffhire, form.chkOverconsp, form.chkRedelivery, form.cve,
    hireDayRows, holdRows, offhireRows, subRows, surveyRows,
  ]);

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
    if (!form.shipOwner) {
      setError('Creating Company is required.');
      return;
    }
    if (!form.invoiceNo || !form.invoiceDate) {
      setError('Hire statement number and date are required.');
      return;
    }
    if (!form.paymentTerms) {
      setError('Payment Terms are required.');
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
      append('periodId', context.periodId);
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
      append('hireFrom', hireDayRows[0]?.hireFrom || form.hireFrom);
      append('hireTo', hireDayRows[hireDayRows.length - 1]?.hireTo || form.hireTo);
      append('dailyHireRate', form.dailyHireRate);
      append('cve', form.cve);
      append('cveAmt', totals.cveAmt);
      append('addCommPer', form.addCommPer);
      append('addCommAmt', totals.addCommAmt);
      append('broCommPer', form.broCommPer);
      append('broCommAmt', totals.broCommAmt);
      append('chkOffhire', form.chkOffhire);
      append('chkDelivery', form.chkDelivery);
      append('chkRedelivery', form.chkRedelivery);
      append('chkBallastBonus', form.chkBallastBonus);
      append('chkOverconsp', form.chkOverconsp);
      append('ballastBonus', context?.ballastBonus);
      append('shipOwner', form.shipOwner);
      append('bankingId', form.bankingId);
      append('bankingDetailId', form.bankingDetailId);
      append('paymentStatus', form.paymentStatus);
      append('finalAmt', totals.finalAmt);
      append('hireAmt', totals.hireAmt);
      append('hireDays', totals.hireDays);
      append('existingUpload', form.upload);
      append('existingUploadName', form.uploadName);
      fd.append('selApprovers', JSON.stringify(form.selApprovers || []));
      fd.append('hireDayRows', JSON.stringify(hireDayRows));
      fd.append('addRows', JSON.stringify(addRows));
      fd.append('subRows', JSON.stringify(subRows));
      fd.append('adjAddRows', JSON.stringify(adjAddRows));
      fd.append('adjSubRows', JSON.stringify(adjSubRows));
      fd.append('holdRows', JSON.stringify(holdRows));
      fd.append('surveyRows', JSON.stringify(surveyRows));
      fd.append('offhireRows', JSON.stringify(offhireRows));
      fd.append('bunkerDelRows', JSON.stringify(bunkerDelRows.map((row) => ({
        ...row,
        amount: money2(parseAmount(row.qty) * parseAmount(row.price)),
      }))));
      fd.append('bunkerRedelRows', JSON.stringify(bunkerRedelRows.map((row) => ({
        ...row,
        amount: money2(parseAmount(row.qty) * parseAmount(row.price)),
      }))));
      fd.append('bunkerOverRows', JSON.stringify(bunkerOverRows.map((row) => ({
        ...row,
        amount: money2(parseAmount(row.qty) * parseAmount(row.price)),
      }))));
      attachFiles.forEach((file) => fd.append('attach_file', file));
      await saveHireStatement(fd);
      notifyRecentWorkUpdated();
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

  useEffect(() => {
    if (loading || !context) {
      setSummaryStuck(false);
      return undefined;
    }

    const el = summaryRef.current;
    const head = summaryHeadRef.current;
    if (!el || !head) return undefined;

    const root = getScrollParent(el);
    const rootIsDocument = root === document.scrollingElement || root === document.documentElement;
    const ioRoot = rootIsDocument ? null : root;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const floating = !entry.isIntersecting;
        setSummaryStuck((prev) => (prev === floating ? prev : floating));
      },
      { root: ioRoot, threshold: 0, rootMargin: '0px' },
    );
    observer.observe(head);

    return () => {
      observer.disconnect();
    };
  }, [loading, context]);

  const status = invoiceStatus;
  const hasDraft = status != null && !Number.isNaN(status);
  const editableByCreator = !hasDraft || status === 0 || status === 2;
  const showApprover1Actions = auth.approver1 && hasDraft && (status === 1 || status === 4);
  const showApprover2Actions = auth.approver2 && hasDraft && status === 3;
  const approveStatusApp1 = auth.hasApp2 ? 3 : 5;
  const reviewStatusApp2 = auth.hasApp1 ? 4 : 2;
  const existingInvoices = context?.existingInvoices || [];
  const hasLastUpdated = Boolean(context?.lastUpdatedBy || context?.lastUpdatedAt);

  const worksheetHref = useMemo(() => {
    const sheetId = context?.fcaId || form?.fcaId || '';
    const cid = context?.comId || comId;
    if (!cid || !sheetId) return '';
    return appPath(
      `/internal-user/vc/ops/cost-sheet?comid=${encodeURIComponent(cid)}&cost_sheet_id=${encodeURIComponent(sheetId)}&page=${encodeURIComponent(page || '1')}`,
    );
  }, [comId, context?.comId, context?.fcaId, form?.fcaId, page]);

  const loadChips = splitLocChips(context?.loadPorts);
  const dischargeChips = splitLocChips(context?.dischargePorts);
  const paymentPayable = form.paymentStatus !== 'payment_hold';
  const subRowsTotal = subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);

  const routePorts = [...loadChips, ...dischargeChips];
  const removeAttachFile = (index) => {
    setAttachFiles((current) => current.filter((_, i) => i !== index));
  };

  const footerActions = (
    <div className={styles.footerActions}>
      {editableByCreator ? (
        <>
          <Button variant="outline" label="Save" onClick={() => handleSubmit(0)} disabled={loading || saving || !context} />
          <Button
            variant="accent"
            label="Approve"
            icon="send"
            className={styles.sendApprovalBtn}
            onClick={() => handleSubmit(auth.sendForApprovalStatus)}
            disabled={loading || saving || !context}
          />
        </>
      ) : null}
      {showApprover1Actions ? (
        <>
          <Button variant="primary" label="Send for Review" icon="send" onClick={() => handleSubmit(2)} disabled={loading || saving || !context} />
          <Button variant="accent" label="Submit & Approve" icon="send" className={styles.sendApprovalBtn} onClick={() => handleSubmit(approveStatusApp1)} disabled={loading || saving || !context} />
        </>
      ) : null}
      {showApprover2Actions ? (
        <>
          <Button variant="primary" label="Send for Review" icon="send" onClick={() => handleSubmit(reviewStatusApp2)} disabled={loading || saving || !context} />
          <Button variant="accent" label="Submit & Approve" icon="send" className={styles.sendApprovalBtn} onClick={() => handleSubmit(5)} disabled={loading || saving || !context} />
        </>
      ) : null}
      {invoiceId ? (
        <button
          type="button"
          className={styles.downloadIconBtn}
          title="Download"
          aria-label="Download"
          onClick={() => handleInvoiceAction('pdf', { invoiceId })}
          disabled={loading || saving}
        >
          <DownloadIcon />
        </button>
      ) : null}
    </div>
  );

  return (
    <div className={`zafira-page ${styles.page}`}>
      <VoyageOpsHeading
        title={hasDraft ? `New Hire Statement (Status ${status})` : 'New Hire Statement'}
        voyageNo={context?.voyageNo || voyageNo || ''}
        vesselName={context?.vesselName || ''}
        worksheetHref={worksheetHref}
      />
      <OpsVcBackHeaderActions backHref={backHref} disabled={saving} />
      {(loading || saving) ? (
        <LoadingOverlay show label={saving ? 'Saving hire statement…' : 'Loading hire statement…'} />
      ) : null}

      {context ? (
        <div className={styles.pageHead}>
          <div className={styles.pageSub}>
            {context.cpDate ? <span>CP <b>{context.cpDate}</b></span> : null}
            {routePorts.map((port, index) => (
              <React.Fragment key={`${port}-${index}`}>
                {index > 0 ? (
                  <svg className={styles.locArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                    <path d="M5 12h14" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                ) : null}
                <span className={styles.locChip}>{port}</span>
              </React.Fragment>
            ))}
          </div>
          {hasLastUpdated ? (
            <div className={styles.opStamp}>
              <span className={styles.opName}>{context.lastUpdatedBy || '—'}</span>
              <span className={styles.opTime}>
                {formatLastUpdated(context.lastUpdatedAt)}
                <span className={styles.localTimeTag}>Local time</span>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <div className={styles.error}>{error}</div> : null}

      {!loading && context ? (
        <>
          <StatementCard num="1" title="Statement Details">
            <div className={styles.sdGrid}>
              <div className={styles.sdLeft}>
                <div className={styles.stripCard}>
                  <div className={styles.stripLabel}>Internal Company <span className={styles.req}>*</span></div>
                  <div className={styles.stripControl}>
                    <div className={styles.cardSelect}>
                      <CardSelect
                        value={form.shipOwner || ''}
                        options={ownerOptions}
                        placeholder="Select"
                        ariaLabel="Internal Company"
                        align="start"
                        disabled={!editableByCreator}
                        onChange={(value) => updateField('shipOwner', value)}
                      />
                    </div>
                  </div>
                </div>

                <div className={`${styles.stripCard} ${styles.bankStrip}`}>
                  <div className={styles.bankTop}>
                    <div className={styles.stripLabel}>Banking Details</div>
                    <div className={styles.stripControl}>
                      <div className={styles.cardSelect}>
                        <CardSelect
                          value={form.bankingId || form.bankingDetailId || ''}
                          options={bankingOptions}
                          placeholder="Select"
                          ariaLabel="Banking Details"
                          align="start"
                          disabled={!editableByCreator}
                          onChange={(value) => {
                            const vendorHit = (context?.vendorBanking || []).some((row) => String(row.id) === String(value));
                            updateField('bankingId', vendorHit ? value : '');
                            updateField('bankingDetailId', vendorHit ? '' : value);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <BankingRows
                    detail={bankingDetail}
                    cBankCheck={cBankCheck}
                    onCBankCheckChange={setCBankCheck}
                  />
                </div>
              </div>

              <div className={styles.sdRight}>
                <div className={styles.infoBox}>
                  <div className={styles.ibTitle}>To</div>
                  <div className={styles.ibName}>{context.vendorName || '—'}</div>
                  <div className={styles.ibSub}>{context.vendorAddress || '—'}</div>
                </div>

                <div className={styles.stripCard} style={{ alignItems: 'flex-start' }}>
                  <div style={{ width: '100%' }}>
                    <div className={styles.hireDetailsHead}>
                      <div className={styles.stripLabel}>Hire Details</div>
                      <span className={styles.pillNavy}>From Voyage</span>
                    </div>
                    <div className={styles.hdGrid}>
                      <div className={styles.hdRow}>
                        <span className={styles.hdLabel}>Voy No.</span>
                        <span className={styles.hdVal}>{context.voyageNo || '—'}</span>
                      </div>
                      <div className={styles.hdRow}>
                        <span className={styles.hdLabel}>Vessel</span>
                        <span className={styles.hdVal}>{context.vesselName || '—'}</span>
                      </div>
                      <div className={styles.hdRow}>
                        <span className={styles.hdLabel}>CP Date</span>
                        <span className={styles.hdVal}>{context.cpDate || '—'}</span>
                      </div>
                      <div className={styles.hdRow}>
                        <span className={styles.hdLabel}>TC No.</span>
                        <span className={styles.hdVal}>{context.tcNo || '—'}</span>
                      </div>
                      <div className={`${styles.hdRow} ${styles.hdRowFull}`}>
                        <span className={styles.hdLabel}>Loading Port</span>
                        <span className={styles.hdVal}>{context.loadPorts || '—'}</span>
                      </div>
                      <div className={`${styles.hdRow} ${styles.hdRowFull}`}>
                        <span className={styles.hdLabel}>Discharge Port</span>
                        <span className={styles.hdVal}>{context.dischargePorts || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </StatementCard>

          <StatementCard num="2" title="Statement & Hire Details">
            <div className={styles.s2Grid}>
              <div className={styles.s2Fields}>
                <div className={`${styles.grid2} ${styles.compact}`}>
                  <FormSelect
                    id="invoiceType"
                    label="Statement Type"
                    required
                    value={form.invoiceType}
                    options={typeOptions}
                    disabled={!editableByCreator}
                    onChange={(value) => updateField('invoiceType', value)}
                  />
                  <Field id="invoiceNo" label="Statement No. *" className={styles.field}>
                    <input className={styles.input} value={form.invoiceNo || ''} onChange={(e) => updateField('invoiceNo', e.target.value)} disabled={!editableByCreator} />
                  </Field>
                  <Field id="invoiceDate" label="Date" className={styles.field}>
                    <DmyDateInput
                      id="invoiceDate"
                      value={form.invoiceDate || ''}
                      onChange={(value) => updateField('invoiceDate', value)}
                      disabled={!editableByCreator}
                    />
                  </Field>
                  <Field id="paymentTerms" label="Payment Terms *" className={styles.field}>
                    <input className={styles.input} value={form.paymentTerms || ''} onChange={(e) => updateField('paymentTerms', e.target.value)} disabled={!editableByCreator} placeholder="e.g. Immediate" />
                  </Field>
                  <Field id="exchangeRate" label="X-Rate" className={styles.field}>
                    <input className={styles.input} value={form.exchangeRate || ''} onChange={(e) => updateField('exchangeRate', e.target.value)} disabled={!editableByCreator} />
                  </Field>
                  <Field id="exchangeDate" label="Exchange Date" className={styles.field}>
                    <DmyDateInput
                      id="exchangeDate"
                      value={form.exchangeDate || ''}
                      onChange={(value) => updateField('exchangeDate', value)}
                      disabled={!editableByCreator}
                    />
                  </Field>
                  <FormSelect
                    id="exchangeCurrency"
                    label="Exchange To Currency"
                    value={form.exchangeCurrency}
                    options={currencyOptions}
                    disabled={!editableByCreator}
                    onChange={(value) => updateField('exchangeCurrency', value)}
                  />
                  <Field id="remainingDays" label="Remaining Days to Statement" className={styles.field}>
                    <input className={styles.input} readOnly value={totals.remainingDays || ''} />
                  </Field>
                  <Field
                    id="deliveryPortDate"
                    label={<>Delivery Port / Date <span className={styles.pillTeal}>TC-In</span></>}
                    className={styles.field}
                  >
                    <div className={styles.readonlyBox}>
                      {[context.deliveryPort, context.deliveryDate].filter(Boolean).join(' / ') || '— / —'}
                    </div>
                  </Field>
                  <Field
                    id="redeliveryPortDate"
                    label={<>Re-Delivery Port / Date <span className={styles.pillTeal}>TC-In</span></>}
                    className={styles.field}
                  >
                    <div className={styles.readonlyBox}>
                      {[context.redeliveryPort, context.redeliveryDate].filter(Boolean).join(' / ') || '— / —'}
                    </div>
                  </Field>
                </div>
                <Field id="description" label="Description" className={[styles.field, styles.compact].filter(Boolean).join(" ")}>
                  <textarea className={`${styles.textarea} ${styles.textareaSmall}`} rows={3} placeholder="As per CP" value={form.description || ''} onChange={(e) => updateField('description', e.target.value)} disabled={!editableByCreator} />
                </Field>
              </div>

              <div className={styles.docsCol}>
                <div className={styles.docLabel}>Documents</div>
                <AttachDropzone
                  id="attach_file_details"
                  files={attachFiles}
                  existingName={form.uploadName}
                  existingUpload={form.upload}
                  onFiles={setAttachFiles}
                  onRemoveFile={removeAttachFile}
                  disabled={!editableByCreator}
                />
              </div>
            </div>
          </StatementCard>

          <StatementCard num="3" title="Hire Calculations">
            <div className={styles.s3StatsRow}>
              <Field id="finalHireage" label={`Final Hire-Age (${cur})`} className={[styles.field, styles.compact].filter(Boolean).join(' ')}>
                <input className={styles.input} readOnly value={money2(context.finalHireage).toFixed(2)} />
              </Field>
              <Field id="estHireDays" label="Total Voy Days (Sea + Port)" className={[styles.field, styles.compact].filter(Boolean).join(' ')}>
                <input className={styles.input} readOnly value={context.estHireDays || ''} />
              </Field>
              <Field id="balanceDays" label="Balance Days" className={[styles.field, styles.compact].filter(Boolean).join(' ')}>
                <input className={styles.input} readOnly value={hireDayRows[0]?.remainingDays ?? totals.remainingDays ?? ''} />
              </Field>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.hireDaysTable}>
                <thead>
                  <tr>
                    <th style={{ width: '18%' }}>Rate ({cur}/Day)</th>
                    <th style={{ width: '22%' }}>From</th>
                    <th style={{ width: '22%' }}>To</th>
                    <th style={{ width: '16%' }}>Net Days</th>
                    <th style={{ width: '22%' }}>Amount ({cur})</th>
                  </tr>
                </thead>
                  <tbody>
                    {hireDayRows.map((row) => (
                      <tr key={row.id || row.randomId}>
                        <td><input className={styles.input} readOnly value={row.dailyRate ?? ''} /></td>
                        <td className={styles.dateCell}>
                          <DmyDateInput
                            id={`hireFrom_${row.id || row.randomId}`}
                            enableTime
                            className={styles.input}
                            value={row.hireFrom || ''}
                            disabled
                          />
                        </td>
                        <td className={styles.dateCell}>
                          <DmyDateInput
                            id={`hireTo_${row.id || row.randomId}`}
                            enableTime
                            className={styles.input}
                            value={row.hireTo || ''}
                            disabled={!editableByCreator}
                            onChange={(value) => updateHireDay(row.id || row.randomId, { hireTo: value })}
                          />
                        </td>
                        <td><input className={styles.input} readOnly value={row.utilisedDays || ''} /></td>
                        <td><input className={styles.input} readOnly value={money2(row.hireAmt).toFixed(2)} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className={styles.totalStrip}>
              <span className={styles.tsl}>Total hire amount</span>
              <span className={styles.tsv}>{cur} {totals.hireAmt.toFixed(2)}</span>
            </div>
          </StatementCard>

          <StatementCard num="4" title="Adjustments">
            <LineSection
              title="Add Adjustment"
              rows={adjAddRows}
              orcOptions={orcOptions}
              fixtureOptions={fixtureOptions}
              vesselOptions={vesselOptions}
              adjustment
              disabled={!editableByCreator}
              onFixtureChange={(id, fixtureNo) => updateRows(setAdjAddRows, id, {
                fixtureNo,
                vessel: fixtureVesselMap.get(String(fixtureNo)) || '',
              })}
              onAdd={() => setAdjAddRows((rows) => [...rows, EMPTY_ADJ_LINE()])}
              onRemove={(id) => removeOrKeep(setAdjAddRows, EMPTY_ADJ_LINE, id)}
              onUpdate={(id, patch) => updateRows(setAdjAddRows, id, patch)}
            />

            <div className={styles.inlineHeadRow}>
              <OvalToggle
                on={Boolean(form.chkBallastBonus)}
                onToggle={() => updateField('chkBallastBonus', !form.chkBallastBonus)}
                label={`Ballast Bonus (${cur})`}
              >
                <input
                  className={styles.input}
                  readOnly
                  disabled={!form.chkBallastBonus}
                  value={form.chkBallastBonus ? totals.ballastBonus.toFixed(2) : ''}
                  placeholder="0.00"
                />
              </OvalToggle>
            </div>

            <div className={styles.subhead}>
              CVE & Other Adjustments <span className={styles.subheadTag}>From Contract</span>
            </div>
            <div className={`${styles.adjHead} ${styles.colsCve}`}>
              <span>Cost Type</span>
              <span>Fixture No</span>
              <span>Vessel</span>
              <span>Description</span>
              <span>Amount</span>
            </div>
            <div className={`${styles.adjRow} ${styles.colsCve}`}>
              <input className={styles.input} readOnly value="CVE" />
              <input className={styles.input} readOnly value={context.voyageNo || ''} />
              <input className={styles.input} readOnly value={context.vesselName || ''} />
              <input className={styles.input} readOnly value={form.cve ? `CVE ${form.cve}` : 'Cargo Value Element, per CP'} />
              <input className={styles.input} readOnly value={totals.cveAmt.toFixed(2)} />
            </div>

            <LineSection
              title="Previous Adjustments"
              rows={adjSubRows}
              orcOptions={orcOptions}
              fixtureOptions={fixtureOptions}
              vesselOptions={vesselOptions}
              adjustment
              disabled={!editableByCreator}
              onFixtureChange={(id, fixtureNo) => updateRows(setAdjSubRows, id, {
                fixtureNo,
                vessel: fixtureVesselMap.get(String(fixtureNo)) || '',
              })}
              onAdd={() => setAdjSubRows((rows) => [...rows, EMPTY_ADJ_LINE()])}
              onRemove={(id) => removeOrKeep(setAdjSubRows, EMPTY_ADJ_LINE, id)}
              onUpdate={(id, patch) => updateRows(setAdjSubRows, id, patch)}
            />

            <div className={styles.subhead}>Other Less</div>
            <div className={styles.grid2}>
              <Field id="addCommPer" label="Add Comm. (%)" className={styles.field}>
                <input className={styles.input} readOnly value={form.addCommPer || ''} />
              </Field>
              <Field id="addCommAmt" label="Amount" className={styles.field}>
                <input className={styles.input} readOnly value={totals.addCommAmt.toFixed(2)} />
              </Field>
              <Field id="broCommPer" label="Brokerage (%)" className={styles.field}>
                <input className={styles.input} readOnly value={form.broCommPer || ''} />
              </Field>
              <Field id="broCommAmt" label="Amount" className={styles.field}>
                <input className={styles.input} readOnly value={totals.broCommAmt.toFixed(2)} />
              </Field>
            </div>

            <LineSection
              title="Other Less Rows"
              rows={subRows}
              orcOptions={orcOptions}
              disabled={!editableByCreator}
              onAdd={() => setSubRows((rows) => [...rows, EMPTY_LINE()])}
              onRemove={(id) => removeOrKeep(setSubRows, EMPTY_LINE, id)}
              onUpdate={(id, patch) => updateRows(setSubRows, id, patch)}
            />

            <LineSection
              title="Other Add Rows"
              rows={addRows}
              orcOptions={orcOptions}
              disabled={!editableByCreator}
              onAdd={() => setAddRows((rows) => [...rows, EMPTY_LINE()])}
              onRemove={(id) => removeOrKeep(setAddRows, EMPTY_LINE, id)}
              onUpdate={(id, patch) => updateRows(setAddRows, id, patch)}
            />

            <div className={styles.totalStrip}>
              <span className={styles.tsl}>Total Commission %</span>
              <span className={styles.tsv}>{(parseAmount(form.addCommPer) + parseAmount(form.broCommPer)).toFixed(2)}%</span>
              <span className={styles.tsl}>Total Amount</span>
              <span className={styles.tsv}>{cur} {(totals.addCommAmt + totals.broCommAmt + subRowsTotal).toFixed(2)}</span>
            </div>
          </StatementCard>

          <StatementCard num="5" title="Additional Charges">
            <div className={styles.checkList}>
              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={Boolean(form.chkDelivery)}
                  disabled={!editableByCreator}
                  onChange={(event) => updateField('chkDelivery', event.target.checked)}
                />
                <span>Delivery Bunkers</span>
              </label>
              {form.chkDelivery ? (
                <BunkerSection
                  rows={bunkerDelRows}
                  bunkerOptions={bunkerOptions}
                  disabled={!editableByCreator}
                  onAdd={() => setBunkerDelRows((rows) => [...rows, EMPTY_BUNKER()])}
                  onRemove={(id) => removeOrKeep(setBunkerDelRows, EMPTY_BUNKER, id)}
                  onUpdate={(id, patch) => updateRows(setBunkerDelRows, id, patch)}
                />
              ) : null}

              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={Boolean(form.chkRedelivery)}
                  disabled={!editableByCreator}
                  onChange={(event) => updateField('chkRedelivery', event.target.checked)}
                />
                <span>Re-Delivery Bunkers</span>
              </label>
              {form.chkRedelivery ? (
                <BunkerSection
                  rows={bunkerRedelRows}
                  bunkerOptions={bunkerOptions}
                  disabled={!editableByCreator}
                  onAdd={() => setBunkerRedelRows((rows) => [...rows, EMPTY_BUNKER()])}
                  onRemove={(id) => removeOrKeep(setBunkerRedelRows, EMPTY_BUNKER, id)}
                  onUpdate={(id, patch) => updateRows(setBunkerRedelRows, id, patch)}
                />
              ) : null}

              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={Boolean(form.chkOffhire)}
                  disabled={!editableByCreator}
                  onChange={(event) => updateField('chkOffhire', event.target.checked)}
                />
                <span>Off-Hire ({cur})</span>
              </label>
              {form.chkOffhire ? (
                <div className={styles.checkPanel}>
                  <div className={styles.offhireHead}>
                    <span>Reason</span>
                    <span>From</span>
                    <span>To</span>
                    <span>%</span>
                    <span>Days</span>
                    <span>Hire/Day</span>
                    <span>Amount</span>
                    <span />
                  </div>
                  {offhireRows.map((row, index) => (
                    <div key={row.id} className={styles.offhireRow}>
                      <textarea
                        className={`${styles.textarea} ${styles.textareaSmall}`}
                        placeholder="Off hire reason..."
                        value={row.reason || row.description || ''}
                        disabled={!editableByCreator}
                        onChange={(event) => updateOffhire(row.id, { reason: event.target.value })}
                      />
                      <div className={styles.dateCell}>
                        <DmyDateInput
                          id={`offFrom_${row.id}`}
                          enableTime
                          className={styles.input}
                          value={row.offFrom || ''}
                          disabled={!editableByCreator}
                          onChange={(value) => updateOffhire(row.id, { offFrom: value })}
                        />
                      </div>
                      <div className={styles.dateCell}>
                        <DmyDateInput
                          id={`offTo_${row.id}`}
                          enableTime
                          className={styles.input}
                          value={row.offTo || ''}
                          disabled={!editableByCreator}
                          onChange={(value) => updateOffhire(row.id, { offTo: value })}
                        />
                      </div>
                      <input className={styles.input} value={row.percent || ''} disabled={!editableByCreator} onChange={(event) => updateOffhire(row.id, { percent: event.target.value })} />
                      <input className={styles.input} value={row.days || ''} disabled={!editableByCreator} onChange={(event) => updateOffhire(row.id, { days: event.target.value })} />
                      <input className={styles.input} value={row.hireRate || ''} disabled={!editableByCreator} onChange={(event) => updateOffhire(row.id, { hireRate: event.target.value })} />
                      <input className={styles.input} readOnly value={money2(row.amount).toFixed(2)} />
                      <div className={styles.rowActions}>
                        <RowDelButton title="Remove row" onClick={() => removeOrKeep(setOffhireRows, () => EMPTY_OFFHIRE(form.dailyHireRate), row.id)} disabled={!editableByCreator} />
                        {index === offhireRows.length - 1 ? (
                          <RowAddButton title="Add row" onClick={() => setOffhireRows((rows) => [...rows, EMPTY_OFFHIRE(form.dailyHireRate)])} disabled={!editableByCreator} />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <label className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={Boolean(form.chkOverconsp)}
                  disabled={!editableByCreator}
                  onChange={(event) => updateField('chkOverconsp', event.target.checked)}
                />
                <span>Additional Bunker Consp. (Wx Routing)</span>
              </label>
              {form.chkOverconsp ? (
                <BunkerSection
                  rows={bunkerOverRows}
                  bunkerOptions={bunkerOptions}
                  disabled={!editableByCreator}
                  onAdd={() => setBunkerOverRows((rows) => [...rows, EMPTY_BUNKER()])}
                  onRemove={(id) => removeOrKeep(setBunkerOverRows, EMPTY_BUNKER, id)}
                  onUpdate={(id, patch) => updateRows(setBunkerOverRows, id, patch)}
                />
              ) : null}
            </div>

            <div className={styles.holdSurveyGrid}>
              <div className={styles.holdSurveyCol}>
                <div className={styles.subhead}>Hold Cleaning</div>
                {holdRows.map((row, index) => (
                  <div key={row.id} className={styles.surveyRow}>
                    <textarea
                      className={styles.textarea}
                      rows={1}
                      placeholder="Description..."
                      value={row.description}
                      disabled={!editableByCreator}
                      onChange={(event) => updateRows(setHoldRows, row.id, { description: event.target.value })}
                    />
                    <input
                      className={`${styles.input} ${styles.surveyAmt}`}
                      placeholder="0.00"
                      value={row.amount}
                      disabled={!editableByCreator}
                      onChange={(event) => updateRows(setHoldRows, row.id, { amount: event.target.value })}
                    />
                    <div className={styles.rowActions}>
                      <RowDelButton title="Remove row" onClick={() => removeOrKeep(setHoldRows, EMPTY_LINE, row.id)} disabled={!editableByCreator} />
                      {index === holdRows.length - 1 ? (
                        <RowAddButton title="Add row" onClick={() => setHoldRows((rows) => [...rows, EMPTY_LINE()])} disabled={!editableByCreator} />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.holdSurveyCol}>
                <div className={styles.subhead}>On / Off Hire Survey</div>
                {surveyRows.map((row, index) => (
                  <div key={row.id} className={styles.surveyRow}>
                    <textarea
                      className={styles.textarea}
                      rows={1}
                      placeholder="Description..."
                      value={row.description}
                      disabled={!editableByCreator}
                      onChange={(event) => updateRows(setSurveyRows, row.id, { description: event.target.value })}
                    />
                    <label className={styles.ownerChk}>
                      <input
                        type="checkbox"
                        checked={Boolean(row.chkOwnerAcc)}
                        disabled={!editableByCreator}
                        onChange={(event) => updateRows(setSurveyRows, row.id, { chkOwnerAcc: event.target.checked })}
                      />
                      Owner&apos;s Account
                    </label>
                    <input
                      className={`${styles.input} ${styles.surveyAmt}`}
                      placeholder="0.00"
                      value={row.amount}
                      disabled={!editableByCreator}
                      onChange={(event) => updateRows(setSurveyRows, row.id, { amount: event.target.value })}
                    />
                    <div className={styles.rowActions}>
                      <RowDelButton title="Remove row" onClick={() => removeOrKeep(setSurveyRows, () => EMPTY_SURVEY(), row.id)} disabled={!editableByCreator} />
                      {index === surveyRows.length - 1 ? (
                        <RowAddButton title="Add row" onClick={() => setSurveyRows((rows) => [...rows, EMPTY_SURVEY()])} disabled={!editableByCreator} />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </StatementCard>

          {/* Title scrolls away; sticky bar is tiles-only (same pattern as Freight Invoice). */}
          <div ref={summaryHeadRef} className={styles.payableSummaryInPlaceHead}>
            <span className={styles.cardNum}>6</span>
            <div className={styles.cardTitle}>Payables Summary</div>
          </div>
          <StatementCard
            hideHead
            cardRef={summaryRef}
            className={[
              styles.stickyPayableSummary,
              summaryStuck ? styles.stickyPayableSummaryStuck : '',
            ].filter(Boolean).join(' ')}
            bodyClassName={styles.stickyPayableBody}
          >
            <div className={styles.summaryTiles}>
              <div className={`${styles.tile} ${styles.tileNavy}`}>
                <div className={styles.tlLabel}>Total Hire Amount ({cur})</div>
                <div className={styles.tlVal}>{totals.finalAmt.toFixed(2)}</div>
              </div>
              <div className={`${styles.tile} ${styles.tilePeach}`}>
                <div className={styles.tlLabel}>Balance ({cur})</div>
                <div className={styles.tlVal}>{totals.finalAmt.toFixed(2)}</div>
              </div>
            </div>
          </StatementCard>

          <StatementCard num="7" title="Additional Documents & Approvals">
            <div className={styles.docsApprovalGrid}>
              <div className={styles.docsApprovalLeft}>
                <div className={styles.docLabel}>Documents</div>
                <AttachDropzone
                  id="attach_file_approval"
                  files={attachFiles}
                  existingName={form.uploadName}
                  existingUpload={form.upload}
                  onFiles={setAttachFiles}
                  onRemoveFile={removeAttachFile}
                  disabled={!editableByCreator}
                />
              </div>
              <div className={styles.docsApprovalRight}>
                <div>
                  <div className={styles.frLabel}>Payment Status</div>
                  <OvalToggle
                    on={paymentPayable}
                    onToggle={() => updateField('paymentStatus', paymentPayable ? 'payment_hold' : 'payment_payable')}
                    label={paymentPayable ? 'Payable' : 'Hold'}
                  />
                </div>
                <div className={`${styles.field} ${styles.approverField}`}>
                  <label className={styles.fieldLabel}>Assign an Approver</label>
                  <CountryMultiSelect
                    options={context.approvers || []}
                    value={form.selApprovers || []}
                    onChange={(value) => updateField('selApprovers', value)}
                    placeholder="Choose Approver..."
                    searchPlaceholder="Search approver…"
                  />
                </div>
                {footerActions}
              </div>
            </div>
          </StatementCard>

          <StatementCard num="8" title="Statement History" bodyClassName={styles.historyBody}>
            <div className={styles.tableWrap}>
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fixture No</th>
                    <th>Statement Type</th>
                    <th>Statement Date</th>
                    <th>Statement No.</th>
                    <th>Hire From – To</th>
                    <th>Days</th>
                    <th>Amount ({cur})</th>
                    <th>Actions</th>
                    <th>Payment Actioned</th>
                    <th>Attach.</th>
                    <th>Open</th>
                    <th>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {existingInvoices.length ? existingInvoices.map((row, index) => (
                    <tr key={row.invoiceId}>
                      <td>{index + 1}.</td>
                      <td style={{ fontWeight: 700, color: 'var(--hs-text-dark)' }}>{row.fixtureNo || context.voyageNo || '—'}</td>
                      <td>{row.invoiceType || '—'}</td>
                      <td>{row.invoiceDate || '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--hs-text-dark)' }}>{row.invoiceNo || '—'}</td>
                      <td>{[row.hireFrom, row.hireTo].filter(Boolean).join(' – ') || '—'}</td>
                      <td>{row.hireDays ?? '—'}</td>
                      <td>{row.amount != null ? money2(row.amount).toFixed(2) : '—'}</td>
                      <td>
                        <div className={styles.histActions}>
                          {row.canPdf !== false ? (
                            <Button size="sm" variant="outline" label="PDF" onClick={() => handleInvoiceAction('pdf', row)} />
                          ) : null}
                          {row.canReceivePayment ? (
                            <Button size="sm" variant="primary" label="Payment" onClick={() => handleInvoiceAction('payment', row)} />
                          ) : null}
                        </div>
                      </td>
                      <td>{[row.lastUpdatedBy, row.lastUpdatedAt].filter(Boolean).join(' / ') || <span className={styles.muted} style={{ fontStyle: 'italic' }}>Pending</span>}</td>
                      <td>{row.uploadName || row.upload || '—'}</td>
                      <td>
                        {row.canReopen ? (
                          <Button size="sm" variant="outline" label="Open" onClick={() => handleInvoiceAction('reopen', row)} />
                        ) : '—'}
                      </td>
                      <td>
                        {row.canDelete ? (
                          <button type="button" className={styles.binBtn} title="Delete" onClick={() => handleInvoiceAction('delete', row)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
                            </svg>
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={13} className={styles.historyEmpty}>No records available on this file.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </StatementCard>
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

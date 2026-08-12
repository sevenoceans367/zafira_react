import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  deleteRequestPortCost,
  downloadRequestPortCostPdf,
  fetchRequestPortCostForm,
  fetchRequestPortCostVendorBanking,
  receiveRequestPortCostPayment,
  reopenRequestPortCost,
  saveRequestPortCost,
} from '../../../services/opsVc.js';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import styles from './OpsVcRequestPortCostPage.module.css';

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

function PaymentModal({ request, onClose, onSubmit }) {
  const [amount, setAmount] = useState(request?.amount || request?.requestedToPay || '');
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
          Payment Received — {request?.paymentNo || request?.reqId}
        </h4>
        {error ? <div className={styles.modalError}>{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <div className={styles.modalField}>
            <label htmlFor="rpcPaymentAmount">Amount</label>
            <input
              id="rpcPaymentAmount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
            />
          </div>
          <div className={styles.modalField}>
            <label htmlFor="rpcPaymentDate">Payment Date</label>
            <DmyDateInput
              id="rpcPaymentDate"
              value={paymentDate}
              onChange={setPaymentDate}
              required
            />
          </div>
          <div className={styles.modalField}>
            <label htmlFor="rpcPaymentRemarks">Remarks</label>
            <textarea
              id="rpcPaymentRemarks"
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
              <th style={{ width: 36 }} />
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
 * React port of PHP request_port_cost.php (Operational Costs / Others payment).
 */
export default function OpsVcRequestPortCostPage() {
  const alert = useAlert();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();

  const id = searchParams.get('id') || '';
  const name = searchParams.get('name') || '';
  const page = searchParams.get('page') || '1';
  const voyageNo = searchParams.get('voyageNo') || searchParams.get('voyage_no') || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState(null);
  const [form, setForm] = useState({});
  const [reqId, setReqId] = useState('');
  const [requestStatus, setRequestStatus] = useState(null);
  const [addRows, setAddRows] = useState([EMPTY_LINE()]);
  const [subRows, setSubRows] = useState([EMPTY_LINE()]);
  const [adjAddRows, setAdjAddRows] = useState([EMPTY_ADJ_LINE()]);
  const [adjSubRows, setAdjSubRows] = useState([EMPTY_ADJ_LINE()]);
  const [attachFiles, setAttachFiles] = useState([]);
  const [existingUpload, setExistingUpload] = useState('');
  const [existingUploadName, setExistingUploadName] = useState('');
  const [vendorBanking, setVendorBanking] = useState([]);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestedDirtyRef = useRef(false);

  const backHref = useMemo(() => {
    const comId = context?.comId || id.split(',')[4] || id.split(',')[0] || '';
    const params = new URLSearchParams({ comid: comId, page });
    if (voyageNo || context?.voyageNo) {
      params.set('voyageNo', voyageNo || context.voyageNo);
    }
    return appPath(`/internal-user/vc/ops/payment-grid?${params.toString()}`);
  }, [context?.comId, context?.voyageNo, id, page, voyageNo]);

  const accountTypeOptions = useMemo(() => {
    const rows = context?.accountTypes || [
      { id: 'Interim', name: 'Interim' },
      { id: 'Final', name: 'Final' },
    ];
    return [
      { value: '', label: '----Select From List----' },
      ...rows.map((row) => ({
        value: String(row.id ?? row.value ?? row),
        label: row.name || row.label || String(row.id ?? row.value ?? row),
      })),
    ];
  }, [context?.accountTypes]);

  const currencyOptions = useMemo(() => {
    const rows = context?.currencies || [];
    return [
      { value: '', label: '----Select From List----' },
      ...rows.map((row) => ({
        value: String(row.id ?? row.code ?? row.value ?? row),
        label: row.name || row.label || String(row.id ?? row.code ?? row.value ?? row),
      })),
    ];
  }, [context?.currencies]);

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
      ...(vendorBanking.length ? vendorBanking : (context?.vendorBanking || [])).map((row) => ({
        value: String(row.id),
        label: row.name || String(row.id),
      })),
    ],
    [context?.vendorBanking, vendorBanking],
  );
  const fixtureVesselMap = useMemo(() => {
    const map = new Map();
    (context?.fixtures || []).forEach((row) => {
      if (row.id) map.set(String(row.id), strOrEmpty(row.vesselId));
    });
    return map;
  }, [context?.fixtures]);

  const bankingDetail = useMemo(() => {
    const list = vendorBanking.length ? vendorBanking : (context?.vendorBanking || []);
    const selected = list.find((row) => String(row.id) === String(form.bankingId || ''));
    return selected || null;
  }, [context?.vendorBanking, form.bankingId, vendorBanking]);

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

  const paidSummary = context?.paidSummary || {};
  const outstandingAmount = parseAmount(
    paidSummary.outstandingAmount
      ?? context?.outstandingAmount
      ?? form.vendorInvoiceAmount,
  );
  const totalPaid = parseAmount(paidSummary.totalPaid ?? paidSummary.amountPaid ?? 0);
  const balance = paidSummary.balance != null
    ? parseAmount(paidSummary.balance)
    : money2(outstandingAmount - totalPaid);
  const paidLines = Array.isArray(paidSummary.paidLines) ? paidSummary.paidLines : [];

  const totals = useMemo(() => {
    const addTotal = addRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const lessTotal = subRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const adjAddTotal = adjAddRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const adjLessTotal = adjSubRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
    const net = money2(balance + addTotal + adjAddTotal - lessTotal - adjLessTotal);
    const exchanged = parseAmount(form.exchangeRate) > 0
      ? money2(parseAmount(form.requestedToPay) * parseAmount(form.exchangeRate))
      : 0;
    return {
      addTotal: money2(addTotal),
      lessTotal: money2(lessTotal),
      adjAddTotal: money2(adjAddTotal),
      adjLessTotal: money2(adjLessTotal),
      net,
      exchanged,
    };
  }, [
    addRows,
    subRows,
    adjAddRows,
    adjSubRows,
    balance,
    form.exchangeRate,
    form.requestedToPay,
  ]);

  const voyageHint = useMemo(() => {
    const voy = String(voyageNo || context?.voyageNo || '');
    if (voy.startsWith('U')) return 'Payment From DUBAI A/C';
    if (voy.startsWith('S')) return 'Payment From SINGAPORE A/C';
    return '';
  }, [context?.voyageNo, voyageNo]);

  const costDesc = context?.costDesc || name || '—';

  const applyContext = useCallback((data) => {
    setContext(data);
    const current = data.currentRequest || null;
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

    const bankingList = Array.isArray(data.vendorBanking) ? data.vendorBanking : [];
    setVendorBanking(bankingList);

    const invoiceAmt = strOrEmpty(
      prefill.vendorInvoiceAmount
        ?? prefill.invoiceAmt
        ?? data.outstandingAmount
        ?? defaults.vendorInvoiceAmount,
    );

    setForm({
      accountType: strOrEmpty(prefill.accountType || defaults.accountType),
      paymentNo: strOrEmpty(prefill.paymentNo),
      date: strOrEmpty(prefill.date),
      bankingId: strOrEmpty(prefill.bankingId || prefill.nob || prefill.vendorSlaveId),
      cBankCheck: prefill.cBankCheck === true
        || prefill.cBankCheck === 'Yes'
        || prefill.cBankCheck === '1'
        || prefill.cBankCheck === 1,
      vendorInvoiceAmount: invoiceAmt,
      invoiceDate: strOrEmpty(prefill.invoiceDate),
      remarks: strOrEmpty(prefill.remarks),
      exchangeRate: strOrEmpty(prefill.exchangeRate),
      exchangeDate: strOrEmpty(prefill.exchangeDate),
      exchangeCurrency: strOrEmpty(prefill.exchangeCurrency),
      paymentStatus: strOrEmpty(prefill.paymentStatus || 'payment_payable'),
      requestedToPay: strOrEmpty(prefill.requestedToPay ?? prefill.reqToPay),
      selApprovers: Array.isArray(prefill.selApprovers)
        ? prefill.selApprovers.map(String)
        : [],
    });

    requestedDirtyRef.current = Boolean(
      strOrEmpty(prefill.requestedToPay ?? prefill.reqToPay),
    );

    setReqId(strOrEmpty(current?.reqId || current?.requestId));
    setRequestStatus(current?.status != null ? Number(current.status) : null);
    setExistingUpload(strOrEmpty(current?.upload || current?.existingUpload));
    setExistingUploadName(strOrEmpty(current?.uploadName || current?.existingUploadName));
    setAttachFiles([]);

    setAddRows(withClientIds(current?.addRows, EMPTY_LINE));
    setSubRows(withClientIds(current?.subRows || current?.lessRows, EMPTY_LINE));
    setAdjAddRows(withClientIds(current?.adjAddRows, EMPTY_ADJ_LINE));
    setAdjSubRows(withClientIds(current?.adjSubRows || current?.adjLessRows, EMPTY_ADJ_LINE));
  }, []);

  useEffect(() => {
    if (!id) {
      setError('Payment context id is required.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchRequestPortCostForm({
          id,
          name,
          page,
          voyageNo,
        });
        if (cancelled) return;
        applyContext(data);
      } catch (err) {
        if (!cancelled) {
          setContext(null);
          setError(err.message || 'Failed to load operational costs payment form.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, name, page, voyageNo, reloadToken, applyContext]);

  useEffect(() => {
    const vendorId = context?.vendorId;
    if (!vendorId) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await fetchRequestPortCostVendorBanking(vendorId);
        if (cancelled) return;
        const list = Array.isArray(detail)
          ? detail
          : (detail?.vendorBanking || detail?.bankingDetails || detail?.banks || []);
        if (list.length) setVendorBanking(list);
      } catch {
        // Keep banking list from form context when refresh fails.
      }
    })();
    return () => { cancelled = true; };
  }, [context?.vendorId]);

  useEffect(() => {
    if (requestedDirtyRef.current) return;
    setForm((current) => {
      const next = totals.net.toFixed(2);
      if (String(current.requestedToPay || '') === next) return current;
      return { ...current, requestedToPay: next };
    });
  }, [totals.net]);

  const updateField = (key, value) => {
    if (key === 'requestedToPay') requestedDirtyRef.current = true;
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
    append('name', name || costDesc);
    append('page', page);
    append('voyageNo', voyageNo || context?.voyageNo || '');
    append('comId', context?.comId);
    append('fcaId', context?.fcaId);
    append('vendorId', context?.vendorId);
    append('gradeId', context?.gradeId);
    append('nameId', context?.nameId);
    append('costName', context?.costName || context?.requestName);
    append('cpDate', context?.cpDate);
    append('status', status);
    if (reqId) append('reqId', reqId);

    append('accountType', form.accountType);
    append('paymentNo', form.paymentNo);
    append('date', form.date);
    append('bankingId', form.bankingId);
    append('cBankCheck', form.cBankCheck ? 'Yes' : '');
    append('vendorInvoiceAmount', form.vendorInvoiceAmount);
    append('invoiceDate', form.invoiceDate);
    append('remarks', form.remarks);
    append('exchangeRate', form.exchangeRate);
    append('exchangeDate', form.exchangeDate);
    append('exchangeCurrency', form.exchangeCurrency);
    append('paymentStatus', form.paymentStatus);
    append('requestedToPay', form.requestedToPay);
    append('netPayable', totals.net.toFixed(2));
    append('balanceOutstanding', balance.toFixed(2));
    append('totalPayable', outstandingAmount.toFixed(2));
    append('existingUpload', existingUpload);
    append('existingUploadName', existingUploadName);

    fd.append('selApprovers', JSON.stringify(form.selApprovers || []));
    fd.append('addRows', JSON.stringify(filterLineRows(addRows)));
    fd.append('subRows', JSON.stringify(filterLineRows(subRows)));
    fd.append('adjAddRows', JSON.stringify(filterAdjRows(adjAddRows)));
    fd.append('adjSubRows', JSON.stringify(filterAdjRows(adjSubRows)));

    attachFiles.forEach((file) => {
      fd.append('attach_file', file);
    });

    return fd;
  };

  const validateClient = async (status) => {
    const missing = [
      [form.paymentNo, 'Payment No/Description'],
      [form.date, 'Date'],
      [form.requestedToPay, 'Requested To Pay/Recover'],
      [form.paymentStatus, 'Accrual / Payable'],
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
      await saveRequestPortCost(buildFormData(status));
      await alert({
        title: 'Saved',
        message: Number(status) === 0
          ? 'Payment request saved as draft.'
          : 'Payment request submitted successfully.',
        confirmLabel: 'OK',
      });
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err.message || 'Failed to save payment request.');
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentSubmit = async (payload) => {
    await receiveRequestPortCostPayment(paymentRequest.reqId, payload);
    setPaymentRequest(null);
    await alert({
      title: 'Saved',
      message: 'Payment recorded successfully.',
      confirmLabel: 'OK',
    });
    setReloadToken((token) => token + 1);
  };

  const handleRequestAction = async (action, request) => {
    try {
      if (action === 'pdf') {
        await downloadRequestPortCostPdf(request.reqId);
        return;
      }
      if (action === 'payment') {
        setPaymentRequest(request);
        return;
      }

      const messages = {
        reopen: 'Are you sure you want to reopen this request?',
        delete: 'Are you sure you want to delete this request permanently?',
      };
      const confirmed = await confirm({
        title: 'Confirmation',
        message: messages[action] || 'Are you sure?',
        confirmLabel: 'OK',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;

      setSaving(true);
      if (action === 'reopen') await reopenRequestPortCost(request.reqId);
      if (action === 'delete') await deleteRequestPortCost(request.reqId);
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

  const status = requestStatus;
  const hasDraft = status != null && !Number.isNaN(status);
  const editableByCreator = !hasDraft || status === 0 || status === 2;
  const showCreatorActions = editableByCreator;
  const showApprover1Actions = auth.approver1 && hasDraft && (status === 1 || status === 4);
  const showApprover2Actions = auth.approver2 && hasDraft && status === 3;
  const approveStatusApp1 = auth.hasApp2 ? 3 : 5;
  const reviewStatusApp2 = auth.hasApp1 ? 4 : 2;

  const existingRequests = context?.existingRequests || [];
  const totalPayableDisplay = form.vendorInvoiceAmount !== '' && form.vendorInvoiceAmount != null
    ? money2(form.vendorInvoiceAmount).toFixed(2)
    : outstandingAmount.toFixed(2);

  return (
    <div className={`zafira-page ${styles.page}`}>
      {(loading || saving) ? (
        <LoadingOverlay show label={saving ? 'Saving payment…' : 'Loading payment…'} />
      ) : null}

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
        {reqId ? (
          <Button
            variant="outline"
            label="Generate PDF"
            onClick={() => handleRequestAction('pdf', { reqId })}
            disabled={loading || saving}
          />
        ) : null}
      </div>

      <h2 className={styles.title}>
        Account {context?.requestName || context?.costName || 'Operational Costs'}
        {': '}
        {costDesc}
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
              <p className={styles.metaLine}>Vendor: {context.vendorName || '—'}</p>
            </div>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Voyage</p>
              <p className={styles.metaLine}>Voyage No: {context.voyageNo || voyageNo || '—'}</p>
              <p className={styles.metaLine}>CP Date: {context.cpDate || '—'}</p>
              <p className={styles.metaLine}>Cost Type Desc: {costDesc}</p>
            </div>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Outstanding</p>
              <p className={styles.metaLine}>
                Total Payable: {outstandingAmount.toFixed(2)}
              </p>
              <p className={styles.metaLine}>
                Amount Paid: {totalPaid.toFixed(2)}
              </p>
              <p className={styles.metaLine}>
                Balance: {balance.toFixed(2)}
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <FormSelect
              id="accountType"
              label="Account Type"
              value={form.accountType}
              options={accountTypeOptions}
              onChange={(value) => updateField('accountType', value)}
            />
            <Field id="paymentNo" label="Payment No/Description *">
              <input
                id="paymentNo"
                className={styles.input}
                value={form.paymentNo || ''}
                onChange={(event) => updateField('paymentNo', event.target.value)}
              />
            </Field>
            <Field id="cpDateDisplay" label="CP Date">
              <input
                id="cpDateDisplay"
                className={styles.input}
                readOnly
                value={context.cpDate || ''}
              />
            </Field>
            <Field id="date" label="Date *">
              <DmyDateInput
                id="date"
                value={form.date || ''}
                onChange={(value) => updateField('date', value)}
              />
            </Field>

            <Field id="nomMessage" label="Nom ID">
              <input id="nomMessage" className={styles.input} readOnly value={context.nomMessage || ''} />
            </Field>
            <Field id="vesselName" label="Vessel">
              <input id="vesselName" className={styles.input} readOnly value={context.vesselName || ''} />
            </Field>
            <Field id="vendorName" label="Vendor">
              <input id="vendorName" className={styles.input} readOnly value={context.vendorName || ''} />
            </Field>
            <div>
              <FormSelect
                id="bankingId"
                label="Banking Details"
                value={form.bankingId}
                options={bankingOptions}
                onChange={(value) => updateField('bankingId', value)}
              />
              <BankingPanel
                detail={bankingDetail}
                cBankCheck={form.cBankCheck}
                onCBankCheckChange={(checked) => updateField('cBankCheck', checked)}
              />
            </div>

            <Field id="costDesc" label="Cost Type Desc">
              <input id="costDesc" className={styles.input} readOnly value={costDesc} />
            </Field>
            <Field id="vendorInvoiceAmount" label="Vendor Invoice Amount">
              <input
                id="vendorInvoiceAmount"
                className={styles.input}
                value={form.vendorInvoiceAmount || ''}
                onChange={(event) => updateField('vendorInvoiceAmount', event.target.value)}
              />
            </Field>
            <Field id="invoiceDate" label="Invoice Date">
              <DmyDateInput
                id="invoiceDate"
                value={form.invoiceDate || ''}
                onChange={(value) => updateField('invoiceDate', value)}
              />
            </Field>
            <Field id="remarks" label="Remarks">
              <textarea
                id="remarks"
                className={styles.textarea}
                value={form.remarks || ''}
                onChange={(event) => updateField('remarks', event.target.value)}
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
          </div>

          {voyageHint ? <div className={styles.hint}>{voyageHint}</div> : null}

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Account Details</h3>
            <div className={styles.sectionBody}>
              <div className={styles.totals}>
                <div>Total Payable</div>
                <input className={styles.input} readOnly value={totalPayableDisplay} />
                {paidLines.length ? paidLines.map((line) => (
                  <React.Fragment key={line.reqId || line.paymentNo || line.label}>
                    <div>Amount Paid {line.paymentNo || ''}</div>
                    <input
                      className={styles.input}
                      readOnly
                      value={money2(line.amount || line.pAmt).toFixed(2)}
                    />
                  </React.Fragment>
                )) : (
                  <>
                    <div>Amount Paid</div>
                    <input className={styles.input} readOnly value={totalPaid.toFixed(2)} />
                  </>
                )}
                <div>Balance Outstanding</div>
                <input className={styles.input} readOnly value={balance.toFixed(2)} />
              </div>
            </div>
          </div>

          <LineSection
            title="Add Adjustment"
            rows={adjAddRows}
            orcOptions={orcOptions}
            fixtureOptions={fixtureOptions}
            vesselOptions={vesselOptions}
            adjustment
            onFixtureChange={(lineId, fixtureNo) => onAdjFixtureChange(adjAddRows, setAdjAddRows, lineId, fixtureNo)}
            onAdd={() => addLine(adjAddRows, setAdjAddRows, EMPTY_ADJ_LINE)}
            onRemove={(lineId) => removeLine(adjAddRows, setAdjAddRows, lineId, EMPTY_ADJ_LINE)}
            onUpdate={(lineId, patch) => updateLine(adjAddRows, setAdjAddRows, lineId, patch)}
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
            adjustment
            onFixtureChange={(lineId, fixtureNo) => onAdjFixtureChange(adjSubRows, setAdjSubRows, lineId, fixtureNo)}
            onAdd={() => addLine(adjSubRows, setAdjSubRows, EMPTY_ADJ_LINE)}
            onRemove={(lineId) => removeLine(adjSubRows, setAdjSubRows, lineId, EMPTY_ADJ_LINE)}
            onUpdate={(lineId, patch) => updateLine(adjSubRows, setAdjSubRows, lineId, patch)}
          />

          <LineSection
            title="Less"
            rows={subRows}
            orcOptions={orcOptions}
            onAdd={() => addLine(subRows, setSubRows)}
            onRemove={(lineId) => removeLine(subRows, setSubRows, lineId)}
            onUpdate={(lineId, patch) => updateLine(subRows, setSubRows, lineId, patch)}
          />

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Net Payable</h3>
            <div className={styles.sectionBody}>
              <div className={styles.totals}>
                <div>Net Payable</div>
                <input className={styles.input} readOnly value={totals.net.toFixed(2)} />
                <div>Requested To Pay/Recover *</div>
                <input
                  className={styles.input}
                  value={form.requestedToPay || ''}
                  onChange={(event) => updateField('requestedToPay', event.target.value)}
                />
                {form.exchangeCurrency && parseAmount(form.exchangeRate) > 0 ? (
                  <>
                    <div>Exchange To Currency ({form.exchangeCurrency})</div>
                    <input className={styles.input} readOnly value={totals.exchanged.toFixed(2)} />
                  </>
                ) : null}
              </div>

              <div className={styles.formGrid} style={{ marginTop: 12, marginBottom: 0 }}>
                <div className={styles.span2}>
                  <Field id="attach_file" label="Attachments">
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

              <div className={styles.paymentStatus}>
                <label>
                  <input
                    type="radio"
                    name="payment_status"
                    checked={form.paymentStatus === 'payment_hold'}
                    onChange={() => updateField('paymentStatus', 'payment_hold')}
                  />
                  Payment Hold (Accrual)
                </label>
                <label>
                  <input
                    type="radio"
                    name="payment_status"
                    checked={form.paymentStatus === 'payment_payable'}
                    onChange={() => updateField('paymentStatus', 'payment_payable')}
                  />
                  Payment Payable
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

          {existingRequests.length ? (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Existing Requests</h3>
              <div className={styles.sectionBody}>
                <div className={styles.tableWrap}>
                  <table className={styles.existingTable}>
                    <thead>
                      <tr>
                        <th>Fixture No</th>
                        <th>Vessel</th>
                        <th>Cost Type</th>
                        <th>Cost Desc.</th>
                        <th>SOA Id</th>
                        <th>Account Type</th>
                        <th>Amount</th>
                        <th>Payment No.</th>
                        <th>Date</th>
                        <th>Vendor</th>
                        <th>Creator</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingRequests.map((row) => (
                        <tr key={row.reqId}>
                          <td>
                            {row.fixtureNo || row.voyageNo || context.voyageNo || '—'}
                            {row.paymentStatus === 'payment_hold' && !(row.fixtureNo || '').includes('Accrual')
                              ? ' (Accrual)'
                              : ''}
                          </td>
                          <td>{row.vesselName || context.vesselName || '—'}</td>
                          <td>{row.costType || row.costName || context.requestName || context.costName || '—'}</td>
                          <td>{row.costDesc || costDesc}</td>
                          <td>{row.soaNo || '—'}</td>
                          <td>{row.accountType || '—'}</td>
                          <td>
                            {row.requestedToPay != null || row.amount != null
                              ? money2(row.requestedToPay ?? row.amount).toFixed(2)
                              : '—'}
                          </td>
                          <td>{row.paymentNo || '—'}</td>
                          <td>{row.date || '—'}</td>
                          <td>{row.vendorName || context.vendorName || '—'}</td>
                          <td>{row.creatorName || row.creator || '—'}</td>
                          <td>
                            <div className={styles.actionBtns}>
                              {row.canPdf !== false ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  label="PDF"
                                  onClick={() => handleRequestAction('pdf', row)}
                                />
                              ) : null}
                              {row.canReceivePayment || row.canPayment ? (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  label="Payment"
                                  onClick={() => handleRequestAction('payment', row)}
                                />
                              ) : null}
                              {row.canReopen ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  label="Open"
                                  onClick={() => handleRequestAction('reopen', row)}
                                />
                              ) : null}
                              {row.canDelete ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  label="Delete"
                                  onClick={() => handleRequestAction('delete', row)}
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

      {paymentRequest ? (
        <PaymentModal
          request={paymentRequest}
          onClose={() => setPaymentRequest(null)}
          onSubmit={handlePaymentSubmit}
        />
      ) : null}
    </div>
  );
}

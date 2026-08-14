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
import { notifyRecentWorkUpdated } from '../../../services/recentWork.js';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import styles from './OpsVcHireStatementPage.module.css';

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
    amount: row.amount == null || row.amount === '' ? '' : String(row.amount),
    qty: row.qty == null || row.qty === '' ? '' : String(row.qty),
    price: row.price == null || row.price === '' ? '' : String(row.price),
    chkOwnerAcc: Boolean(row.chkOwnerAcc),
  }));
}

function toSelectOptions(rows) {
  return [
    { value: '', label: '----Select From List----' },
    ...(rows || []).map((row) => ({
      value: String(row.id ?? row.value ?? ''),
      label: row.name || row.label || String(row.id ?? ''),
    })),
  ];
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
            </>
          ) : null}
        </tbody>
      </table>
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
        <div className={styles.tableWrap}>
        <table className={styles.linesTable}>
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th style={{ width: adjustment ? '18%' : '24%' }}>Cost type</th>
              {adjustment ? (
                <>
                  <th style={{ width: '16%' }}>Fixture no</th>
                  <th style={{ width: '16%' }}>Vessel</th>
                </>
              ) : null}
              <th>Description</th>
              <th style={{ width: 96 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button type="button" className={styles.removeBtn} onClick={() => onRemove(row.id)} aria-label={`Remove ${title} row`}>×</button>
                </td>
                <td>
                  <div className={styles.cardSelect}>
                    <CardSelect
                      value={row.orcId || ''}
                      options={orcOptions}
                      placeholder="----Select----"
                      ariaLabel={`${title} cost type`}
                      align="start"
                      onChange={(value) => onUpdate(row.id, { orcId: value })}
                    />
                  </div>
                </td>
                {adjustment ? (
                  <>
                    <td>
                      <div className={styles.cardSelect}>
                        <CardSelect
                          value={row.fixtureNo || ''}
                          options={fixtureOptions}
                          placeholder="----Select----"
                          ariaLabel={`${title} fixture`}
                          align="start"
                          onChange={(value) => onFixtureChange?.(row.id, value)}
                        />
                      </div>
                    </td>
                    <td>
                      <div className={styles.cardSelect}>
                        <CardSelect
                          value={row.vessel || ''}
                          options={vesselOptions}
                          placeholder="----Select----"
                          ariaLabel={`${title} vessel`}
                          align="start"
                          onChange={(value) => onUpdate(row.id, { vessel: value })}
                        />
                      </div>
                    </td>
                  </>
                ) : null}
                <td>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    placeholder="Description..."
                    value={row.description}
                    onChange={(event) => onUpdate(row.id, { description: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={styles.input}
                    placeholder="Amount"
                    value={row.amount}
                    onChange={(event) => onUpdate(row.id, { amount: event.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className={styles.lineActions}>
          <Button variant="outline" size="sm" label="Add" onClick={onAdd} />
        </div>
      </div>
    </div>
  );
}

function BunkerSection({ title, rows, bunkerOptions, onAdd, onRemove, onUpdate }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>
        <div className={styles.tableWrap}>
        <table className={styles.bunkerTable}>
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>Bunker Grade</th>
              <th style={{ width: '18%' }}>Qty(MT)</th>
              <th style={{ width: '18%' }}>Price</th>
              <th style={{ width: '18%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button type="button" className={styles.removeBtn} onClick={() => onRemove(row.id)} aria-label={`Remove ${title} row`}>×</button>
                </td>
                <td>
                  <div className={styles.cardSelect}>
                    <CardSelect
                      value={row.bunkerId || ''}
                      options={bunkerOptions}
                      placeholder="----Select----"
                      ariaLabel={`${title} grade`}
                      align="start"
                      onChange={(value) => onUpdate(row.id, { bunkerId: value })}
                    />
                  </div>
                </td>
                <td>
                  <input className={styles.input} value={row.qty} onChange={(event) => onUpdate(row.id, { qty: event.target.value })} />
                </td>
                <td>
                  <input className={styles.input} value={row.price} onChange={(event) => onUpdate(row.id, { price: event.target.value })} />
                </td>
                <td>
                  <input className={styles.input} readOnly value={money2(parseAmount(row.qty) * parseAmount(row.price)).toFixed(2)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className={styles.lineActions}>
          <Button variant="outline" size="sm" label="Add" onClick={onAdd} />
        </div>
      </div>
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
      const utilised = daysBetween(next.hireFrom, next.hireTo);
      if (patch.hireFrom != null || patch.hireTo != null) {
        next.utilisedDays = utilised ? String(days5(utilised)) : next.utilisedDays;
        next.hireAmt = String(money2(parseAmount(next.utilisedDays) * parseAmount(next.dailyRate)));
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
        const days = daysBetween(next.offFrom, next.offTo);
        if (days) next.days = String(days5(days));
      }
      const percent = parseAmount(next.percent) || 100;
      next.amount = String(money2(parseAmount(next.days) * parseAmount(next.hireRate) * (percent / 100)));
      return next;
    }));
  };

  const currency = form.exchangeCurrency || 'USD';
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

  const status = invoiceStatus;
  const hasDraft = status != null && !Number.isNaN(status);
  const editableByCreator = !hasDraft || status === 0 || status === 2;
  const showApprover1Actions = auth.approver1 && hasDraft && (status === 1 || status === 4);
  const showApprover2Actions = auth.approver2 && hasDraft && status === 3;
  const approveStatusApp1 = auth.hasApp2 ? 3 : 5;
  const reviewStatusApp2 = auth.hasApp1 ? 4 : 2;
  const existingInvoices = context?.existingInvoices || [];
  const lastUpdated = context?.lastUpdatedBy
    ? `${context.lastUpdatedBy}${context.lastUpdatedAt ? ` - ${context.lastUpdatedAt}` : ''}`
    : '';

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
        Hire Statement Creation
        {hasDraft ? ` (Status ${status})` : ''}
      </h2>

      {error ? <div className={styles.error}>{error}</div> : null}

      {!loading && context ? (
        <>
          {lastUpdated ? (
            <p className={styles.lastUpdated}>(LAST UPDATED BY/TIME) {lastUpdated}</p>
          ) : null}

          <div className={styles.infoGrid}>
            <div className={styles.panel}>
              <FormSelect
                id="shipOwner"
                label="Creating Company"
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
              <FormSelect
                id="bankingId"
                label="Banking Details"
                value={form.bankingId || form.bankingDetailId}
                options={bankingOptions}
                onChange={(value) => {
                  const vendorHit = (context?.vendorBanking || []).some((row) => String(row.id) === String(value));
                  updateField('bankingId', vendorHit ? value : '');
                  updateField('bankingDetailId', vendorHit ? '' : value);
                }}
              />
              <BankingPanel
                detail={bankingDetail}
                cBankCheck={cBankCheck}
                onCBankCheckChange={setCBankCheck}
              />
            </div>
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Hire Details</p>
              <p className={styles.metaLine}>Nom ID :- {context.nomMessage || '—'}</p>
              <p className={styles.metaLine}>Vessel :- {context.vesselName || '—'}</p>
              <p className={styles.metaLine}>CP Date :- {context.cpDate || '—'}</p>
              <p className={styles.metaLine}>TC No. :- {context.tcNo || '—'}</p>
              <p className={styles.metaLine}>Loading Port :- {context.loadPorts || '—'}</p>
              <p className={styles.metaLine}>Discharging Port :- {context.dischargePorts || '—'}</p>
            </div>
          </div>

          <div className={styles.mainSplit}>
            <div className={styles.leftCol}>
              <div className={styles.stackFields}>
                <FormSelect id="invoiceType" label="Statement Type" required value={form.invoiceType} options={typeOptions} onChange={(value) => updateField('invoiceType', value)} />
                <Field id="invoiceNo" label="Hire Statement Number *">
                  <input className={styles.input} value={form.invoiceNo || ''} onChange={(e) => updateField('invoiceNo', e.target.value)} />
                </Field>
                <DmyDateInput id="invoiceDate" label="Hire Statement Date *" value={form.invoiceDate || ''} onChange={(value) => updateField('invoiceDate', value)} />
                <Field id="exchangeRate" label="Exchange Rate">
                  <input className={styles.input} value={form.exchangeRate || ''} onChange={(e) => updateField('exchangeRate', e.target.value)} />
                </Field>
                <DmyDateInput id="exchangeDate" label="Exchange Date" value={form.exchangeDate || ''} onChange={(value) => updateField('exchangeDate', value)} />
                <FormSelect id="exchangeCurrency" label="Exchange To Currency" value={form.exchangeCurrency} options={currencyOptions} onChange={(value) => updateField('exchangeCurrency', value)} />
                <Field id="remainingDays" label="Remaining Days to Statement">
                  <input className={styles.input} readOnly value={totals.remainingDays || ''} />
                </Field>
                <Field id="paymentTerms" label="Payment Terms *">
                  <input className={styles.input} value={form.paymentTerms || ''} onChange={(e) => updateField('paymentTerms', e.target.value)} />
                </Field>
                <Field id="description" label="Description">
                  <textarea className={styles.textarea} rows={3} value={form.description || ''} onChange={(e) => updateField('description', e.target.value)} />
                </Field>
                <Field id="deliveryPortDate" label="Delivery Port/Date">
                  <div className={styles.readonlyValue}>
                    {[context.deliveryPort, context.deliveryDate].filter(Boolean).join(' / ') || '—'}
                  </div>
                </Field>
                <Field id="redeliveryPortDate" label="Re Delivery Port/Date">
                  <div className={styles.readonlyValue}>
                    {[context.redeliveryPort, context.redeliveryDate].filter(Boolean).join(' / ') || '—'}
                  </div>
                </Field>
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
                  {form.uploadName || form.upload ? (
                    <p className={styles.muted}>Existing: {form.uploadName || form.upload}</p>
                  ) : null}
                </Field>
              </div>
            </div>

            <div className={styles.rightCol}>
              <div className={styles.freightStack}>
                <Field id="finalHireage" label={`Final Hire-age (${currency})`}>
                  <input className={styles.input} readOnly value={money2(context.finalHireage).toFixed(2)} />
                </Field>
                <Field id="estHireDays" label="Total Voyage Days (Sea & Port)">
                  <input className={styles.input} readOnly value={context.estHireDays || ''} />
                </Field>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Hire Days</h3>
                  <div className={styles.sectionBody}>
                    <div className={styles.tableWrap}>
                      <table className={styles.hireDaysTable}>
                        <thead>
                          <tr>
                            <th style={{ width: '11%' }}>TTL days</th>
                            <th style={{ width: '11%' }}>Bal Days</th>
                            <th style={{ width: '13%' }}>Hire(USD/Day)</th>
                            <th style={{ width: '18%' }}>Hire From</th>
                            <th style={{ width: '18%' }}>Hire To</th>
                            <th style={{ width: '12%' }}>Hire Day</th>
                            <th style={{ width: '17%' }}>Hire(USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hireDayRows.map((row) => (
                            <tr key={row.id || row.randomId}>
                              <td><input className={styles.input} readOnly value={row.totalDays ?? ''} /></td>
                              <td><input className={styles.input} readOnly value={row.remainingDays ?? ''} /></td>
                              <td><input className={styles.input} readOnly value={row.dailyRate ?? ''} /></td>
                              <td>
                                <input
                                  className={styles.input}
                                  readOnly
                                  value={row.hireFrom || ''}
                                  placeholder="dd-mm-yyyy hh:mm"
                                />
                              </td>
                              <td>
                                <input
                                  className={styles.input}
                                  value={row.hireTo || ''}
                                  placeholder="dd-mm-yyyy hh:mm"
                                  onChange={(event) => updateHireDay(row.id || row.randomId, { hireTo: event.target.value })}
                                />
                              </td>
                              <td><input className={styles.input} readOnly value={row.utilisedDays || ''} /></td>
                              <td><input className={styles.input} readOnly value={money2(row.hireAmt).toFixed(2)} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <Field id="grossHire" label={`Gross Hire for this Invoice (${currency})`}>
                  <input className={styles.input} readOnly value={totals.hireAmt.toFixed(2)} />
                </Field>

                <LineSection
                  title="Add Adjustment"
                  rows={adjAddRows}
                  orcOptions={orcOptions}
                  fixtureOptions={fixtureOptions}
                  vesselOptions={vesselOptions}
                  adjustment
                  onFixtureChange={(id, fixtureNo) => updateRows(setAdjAddRows, id, {
                    fixtureNo,
                    vessel: fixtureVesselMap.get(String(fixtureNo)) || '',
                  })}
                  onAdd={() => setAdjAddRows((rows) => [...rows, EMPTY_ADJ_LINE()])}
                  onRemove={(id) => removeOrKeep(setAdjAddRows, EMPTY_ADJ_LINE, id)}
                  onUpdate={(id, patch) => updateRows(setAdjAddRows, id, patch)}
                />

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Other Add</h3>
                  <div className={styles.sectionBody}>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(form.chkBallastBonus)}
                        onChange={(event) => updateField('chkBallastBonus', event.target.checked)}
                      />
                      Ballast Bonus ({currency})
                    </label>
                    {form.chkBallastBonus ? (
                      <Field id="ballastBonusAmt" label={`Ballast Bonus (${currency})`}>
                        <input className={styles.input} readOnly value={totals.ballastBonus.toFixed(2)} />
                      </Field>
                    ) : null}
                    <div className={styles.freightPair}>
                      <Field id="cve" label={`CVE (${currency})`}>
                        <input className={styles.input} readOnly value={form.cve || ''} />
                      </Field>
                      <Field id="cveAmt" label="CVE Amount">
                        <input className={styles.input} readOnly value={totals.cveAmt.toFixed(2)} />
                      </Field>
                    </div>
                  </div>
                </div>

                <LineSection
                  title="Other Add rows"
                  rows={addRows}
                  orcOptions={orcOptions}
                  onAdd={() => setAddRows((rows) => [...rows, EMPTY_LINE()])}
                  onRemove={(id) => removeOrKeep(setAddRows, EMPTY_LINE, id)}
                  onUpdate={(id, patch) => updateRows(setAddRows, id, patch)}
                />

                <LineSection
                  title="Less Adjustment"
                  rows={adjSubRows}
                  orcOptions={orcOptions}
                  fixtureOptions={fixtureOptions}
                  vesselOptions={vesselOptions}
                  adjustment
                  onFixtureChange={(id, fixtureNo) => updateRows(setAdjSubRows, id, {
                    fixtureNo,
                    vessel: fixtureVesselMap.get(String(fixtureNo)) || '',
                  })}
                  onAdd={() => setAdjSubRows((rows) => [...rows, EMPTY_ADJ_LINE()])}
                  onRemove={(id) => removeOrKeep(setAdjSubRows, EMPTY_ADJ_LINE, id)}
                  onUpdate={(id, patch) => updateRows(setAdjSubRows, id, patch)}
                />

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Other Less</h3>
                  <div className={styles.sectionBody}>
                    <div className={styles.freightPair}>
                      <Field id="addCommPer" label="Address Commission (%)">
                        <input className={styles.input} readOnly value={form.addCommPer || ''} />
                      </Field>
                      <Field id="addCommAmt" label="Amount">
                        <input className={styles.input} readOnly value={totals.addCommAmt.toFixed(2)} />
                      </Field>
                    </div>
                    <div className={styles.freightPair}>
                      <Field id="broCommPer" label="Broker Commission (%)">
                        <input className={styles.input} readOnly value={form.broCommPer || ''} />
                      </Field>
                      <Field id="broCommAmt" label="Amount">
                        <input className={styles.input} readOnly value={totals.broCommAmt.toFixed(2)} />
                      </Field>
                    </div>
                  </div>
                </div>

                <LineSection
                  title="Other Less rows"
                  rows={subRows}
                  orcOptions={orcOptions}
                  onAdd={() => setSubRows((rows) => [...rows, EMPTY_LINE()])}
                  onRemove={(id) => removeOrKeep(setSubRows, EMPTY_LINE, id)}
                  onUpdate={(id, patch) => updateRows(setSubRows, id, patch)}
                />

                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.chkDelivery)}
                    onChange={(event) => updateField('chkDelivery', event.target.checked)}
                  />
                  Delivery Bunkers
                </label>
                {form.chkDelivery ? (
                  <BunkerSection
                    title="Delivery Bunkers"
                    rows={bunkerDelRows}
                    bunkerOptions={bunkerOptions}
                    onAdd={() => setBunkerDelRows((rows) => [...rows, EMPTY_BUNKER()])}
                    onRemove={(id) => removeOrKeep(setBunkerDelRows, EMPTY_BUNKER, id)}
                    onUpdate={(id, patch) => updateRows(setBunkerDelRows, id, patch)}
                  />
                ) : null}

                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.chkRedelivery)}
                    onChange={(event) => updateField('chkRedelivery', event.target.checked)}
                  />
                  Re-Delivery Bunkers
                </label>
                {form.chkRedelivery ? (
                  <BunkerSection
                    title="Re-Delivery Bunkers"
                    rows={bunkerRedelRows}
                    bunkerOptions={bunkerOptions}
                    onAdd={() => setBunkerRedelRows((rows) => [...rows, EMPTY_BUNKER()])}
                    onRemove={(id) => removeOrKeep(setBunkerRedelRows, EMPTY_BUNKER, id)}
                    onUpdate={(id, patch) => updateRows(setBunkerRedelRows, id, patch)}
                  />
                ) : null}

                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.chkOffhire)}
                    onChange={(event) => updateField('chkOffhire', event.target.checked)}
                  />
                  Off-hire ({currency})
                </label>
                {form.chkOffhire ? (
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Off-hire</h3>
                    <div className={styles.sectionBody}>
                      <div className={styles.tableWrap}>
                        <table className={styles.hireDaysTable}>
                          <thead>
                            <tr>
                              <th style={{ width: 32 }} />
                              <th>Reason</th>
                              <th style={{ width: '16%' }}>From</th>
                              <th style={{ width: '16%' }}>To</th>
                              <th style={{ width: '8%' }}>%</th>
                              <th style={{ width: '10%' }}>Days</th>
                              <th style={{ width: '12%' }}>Hire/Day</th>
                              <th style={{ width: '12%' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {offhireRows.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <button type="button" className={styles.removeBtn} onClick={() => removeOrKeep(setOffhireRows, () => EMPTY_OFFHIRE(form.dailyHireRate), row.id)}>×</button>
                                </td>
                                <td>
                                  <textarea className={styles.textarea} rows={2} value={row.reason || row.description || ''} onChange={(event) => updateOffhire(row.id, { reason: event.target.value })} />
                                </td>
                                <td>
                                  <input className={styles.input} placeholder="dd-mm-yyyy HH:MM" value={row.offFrom || ''} onChange={(event) => updateOffhire(row.id, { offFrom: event.target.value })} />
                                </td>
                                <td>
                                  <input className={styles.input} placeholder="dd-mm-yyyy HH:MM" value={row.offTo || ''} onChange={(event) => updateOffhire(row.id, { offTo: event.target.value })} />
                                </td>
                                <td>
                                  <input className={styles.input} value={row.percent || ''} onChange={(event) => updateOffhire(row.id, { percent: event.target.value })} />
                                </td>
                                <td>
                                  <input className={styles.input} value={row.days || ''} onChange={(event) => updateOffhire(row.id, { days: event.target.value })} />
                                </td>
                                <td>
                                  <input className={styles.input} value={row.hireRate || ''} onChange={(event) => updateOffhire(row.id, { hireRate: event.target.value })} />
                                </td>
                                <td>
                                  <input className={styles.input} readOnly value={money2(row.amount).toFixed(2)} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className={styles.lineActions}>
                        <Button variant="outline" size="sm" label="Add Off-Hire" onClick={() => setOffhireRows((rows) => [...rows, EMPTY_OFFHIRE(form.dailyHireRate)])} />
                      </div>
                    </div>
                  </div>
                ) : null}

                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.chkOverconsp)}
                    onChange={(event) => updateField('chkOverconsp', event.target.checked)}
                  />
                  Bunker Over Consumption as per Weather Routing
                </label>
                {form.chkOverconsp ? (
                  <BunkerSection
                    title="Bunker Over Consumption"
                    rows={bunkerOverRows}
                    bunkerOptions={bunkerOptions}
                    onAdd={() => setBunkerOverRows((rows) => [...rows, EMPTY_BUNKER()])}
                    onRemove={(id) => removeOrKeep(setBunkerOverRows, EMPTY_BUNKER, id)}
                    onUpdate={(id, patch) => updateRows(setBunkerOverRows, id, patch)}
                  />
                ) : null}

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Hold Cleaning</h3>
                  <div className={styles.sectionBody}>
                    {holdRows.map((row) => (
                      <div key={row.id} className={styles.lineRow}>
                        <textarea className={styles.textarea} rows={2} placeholder="Description..." value={row.description} onChange={(event) => updateRows(setHoldRows, row.id, { description: event.target.value })} />
                        <input className={styles.input} placeholder="Amount" value={row.amount} onChange={(event) => updateRows(setHoldRows, row.id, { amount: event.target.value })} />
                        <button type="button" className={styles.removeBtn} onClick={() => removeOrKeep(setHoldRows, EMPTY_LINE, row.id)}>×</button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" label="Add New" onClick={() => setHoldRows((rows) => [...rows, EMPTY_LINE()])} />
                  </div>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>On/Off hire survey</h3>
                  <div className={styles.sectionBody}>
                    {surveyRows.map((row) => (
                      <div key={row.id} className={styles.surveyRow}>
                        <textarea className={styles.textarea} rows={2} placeholder="Description..." value={row.description} onChange={(event) => updateRows(setSurveyRows, row.id, { description: event.target.value })} />
                        <label className={styles.surveyCheck}>
                          <input
                            type="checkbox"
                            checked={Boolean(row.chkOwnerAcc)}
                            onChange={(event) => updateRows(setSurveyRows, row.id, { chkOwnerAcc: event.target.checked })}
                          />
                          On Owner&apos;s Account
                        </label>
                        <input className={styles.input} placeholder="Amount" value={row.amount} onChange={(event) => updateRows(setSurveyRows, row.id, { amount: event.target.value })} />
                        <button type="button" className={styles.removeBtn} onClick={() => removeOrKeep(setSurveyRows, () => EMPTY_SURVEY(), row.id)}>×</button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" label="Add New" onClick={() => setSurveyRows((rows) => [...rows, EMPTY_SURVEY()])} />
                  </div>
                </div>

                <div className={styles.totals}>
                  <div>Total Hire for this Inv ({currency})</div>
                  <input className={styles.input} readOnly value={totals.finalAmt.toFixed(2)} />
                </div>

                <div className={styles.paymentStatus}>
                  <label>
                    <input
                      type="radio"
                      name="hirePaymentStatus"
                      checked={form.paymentStatus === 'payment_hold'}
                      onChange={() => updateField('paymentStatus', 'payment_hold')}
                    />
                    Payment Hold
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="hirePaymentStatus"
                      checked={form.paymentStatus !== 'payment_hold'}
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
          </div>

          {existingInvoices.length ? (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Existing Hire Statements</h3>
              <div className={styles.sectionBody}>
                <div className={styles.tableWrap}>
                  <table className={styles.existingTable}>
                    <thead>
                      <tr>
                        <th>Fixture No</th>
                        <th>Statement Type</th>
                        <th>Hire Statement Date</th>
                        <th>Hire Statement No.</th>
                        <th>Hire From - To</th>
                        <th>Hire Days</th>
                        <th>Amount</th>
                        <th>PDF</th>
                        <th>Payment</th>
                        <th>Last Updated By/Time</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingInvoices.map((row) => (
                        <tr key={row.invoiceId}>
                          <td>{row.fixtureNo || context.voyageNo || '—'}</td>
                          <td>{row.invoiceType || '—'}</td>
                          <td>{row.invoiceDate || '—'}</td>
                          <td>{row.invoiceNo || '—'}</td>
                          <td>{[row.hireFrom, row.hireTo].filter(Boolean).join(' - ') || '—'}</td>
                          <td>{row.hireDays ?? '—'}</td>
                          <td>{row.amount != null ? money2(row.amount).toFixed(2) : '—'}</td>
                          <td>
                            {row.canPdf !== false ? <Button size="sm" variant="outline" label="PDF" onClick={() => handleInvoiceAction('pdf', row)} /> : null}
                          </td>
                          <td>
                            {row.canReceivePayment ? <Button size="sm" variant="primary" label="Payment" onClick={() => handleInvoiceAction('payment', row)} /> : '—'}
                          </td>
                          <td>{[row.lastUpdatedBy, row.lastUpdatedAt].filter(Boolean).join(' / ') || '—'}</td>
                          <td>
                            <div className={styles.actionBtns}>
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

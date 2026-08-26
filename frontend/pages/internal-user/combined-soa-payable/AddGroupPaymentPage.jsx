import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CardSelect,
  DmyDateInput,
  LoadingOverlay,
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import saveIcon from '../../../assets/Save.png';
import { groupPaymentsAppPath } from '../../../constants/combinedSoaPayablePageHeaders.js';
import {
  createGroupPayment,
  createGroupPaymentTc,
  fetchGroupPaymentCostLines,
  fetchGroupPaymentLookups,
} from '../../../services/combinedSoaPayable.js';
import {
  fetchBankingDetail,
  fetchGenericInvoiceLookups,
  fetchVendorBanking,
} from '../../../services/genericFinances.js';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import styles from './AddGroupPaymentPage.module.css';

const SPOT_COST_TYPES = [
  { id: '', name: 'Select' },
  { id: 'Bunkers Nett Supply', name: 'Bunkers Nett Supply' },
  { id: 'Operational Costs (Others)', name: 'Operational Costs (Others)' },
  { id: 'Operational Costs', name: 'Operational Costs' },
  { id: 'Owners Side brokerage', name: 'Owners Side brokerage' },
  { id: 'Load Port Costs', name: 'Load Port Costs' },
  { id: 'Discharge Port Costs', name: 'Discharge Port Costs' },
  { id: 'OPA FEE', name: 'OPA FEE' },
  { id: 'Agency', name: 'Agency' },
  { id: 'Insurance', name: 'Insurance' },
  { id: 'Other', name: 'Other' },
];

const TC_COST_TYPES = [
  { id: '', name: 'Select' },
  { id: 'Hire', name: 'Hire' },
  { id: 'Off Hire', name: 'Off Hire' },
  { id: 'Owners Expenses', name: 'Owners Expenses' },
  { id: 'Agency', name: 'Agency' },
  { id: 'Insurance', name: 'Insurance' },
  { id: 'Other', name: 'Other' },
];

const CONTRACT_OPTIONS = [
  { id: 'spot', name: 'Spot' },
  { id: 'tc', name: 'TC' },
];

const GROUP_PAYMENTS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 15h3" />
  </svg>
);

function emptyLine(overrides = {}) {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    selected: false,
    voyageNo: '',
    vessel: '',
    costDesc: '',
    costType: '',
    vendorInvAmt: '',
    vendorInvDate: '',
    paymentNo: '',
    estimated: '',
    actual: '',
    remarks: '',
    attachName: '',
    ...overrides,
  };
}

function lineFromApi(row) {
  return emptyLine({
    id: String(row.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    selected: Boolean(row.selected),
    voyageNo: row.voyageNo || '',
    vessel: row.vessel || '',
    costDesc: row.costDesc || '',
    costType: row.costType || '',
    estimated: row.estimated != null ? String(row.estimated) : '',
    actual: row.actual != null ? String(row.actual) : '',
  });
}

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(value) {
  return parseAmount(value).toFixed(2);
}

function yearOptions() {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2].map((y) => ({ id: String(y), name: String(y) }));
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
        </tbody>
      </table>
    </div>
  );
}

function AddGroupPaymentHeading({ isTc }) {
  const setHeading = usePageHeaderHeading();
  useLayoutEffect(() => {
    setHeading({
      title: isTc ? 'Add Payment (TC)' : 'Add Payment',
      icon: GROUP_PAYMENTS_ICON,
    });
  }, [setHeading, isTc]);
  useEffect(() => () => setHeading(null), [setHeading]);
  return null;
}

export default function AddGroupPaymentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const alert = useAlert();
  const confirm = useConfirm();
  const fileInputRef = useRef(null);
  const listPath = groupPaymentsAppPath();

  const initialContract = searchParams.get('contractType') === 'tc' ? 'tc' : 'spot';
  const initialYear = searchParams.get('year') && searchParams.get('year') !== 'all'
    ? searchParams.get('year')
    : String(new Date().getFullYear());

  const [loading, setLoading] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookups, setLookups] = useState({ vendors: [], currencies: [] });
  const [vendorBanks, setVendorBanks] = useState([]);
  const [bankingDetail, setBankingDetail] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [lines, setLines] = useState(() => [emptyLine({ selected: true })]);
  const [form, setForm] = useState({
    selVendor: '',
    contractType: initialContract,
    year: initialYear,
    paymentDate: '',
    exchangeCurrency: 'USD',
    exchangeDate: '',
    exchangeRate: '1',
    bankingId: '',
    remarks: '',
  });

  const isTc = form.contractType === 'tc';
  const years = useMemo(() => yearOptions(), []);
  const costTypeOptions = isTc ? TC_COST_TYPES : SPOT_COST_TYPES;
  const exchangeRate = parseAmount(form.exchangeRate) || 1;

  const totals = useMemo(() => {
    let estimated = 0;
    let actual = 0;
    let exchange = 0;
    lines.forEach((line) => {
      if (!line.selected) return;
      estimated += parseAmount(line.estimated);
      const act = parseAmount(line.actual);
      actual += act;
      exchange += act * exchangeRate;
    });
    return { estimated, actual, exchange };
  }, [lines, exchangeRate]);

  const bankingOptions = useMemo(
    () => vendorBanks.map((row) => ({
      id: String(row.id),
      name: row.name || row.label || String(row.id),
    })),
    [vendorBanks],
  );

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateLine = (id, patch) => {
    setLines((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeLine = (id) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine({ selected: true })]);
  };

  const handleContractTypeChange = (value) => {
    const next = value === 'tc' ? 'tc' : 'spot';
    updateField('contractType', next);
    const params = new URLSearchParams(searchParams);
    if (next === 'tc') params.set('contractType', 'tc');
    else params.delete('contractType');
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchGroupPaymentLookups();
        if (cancelled) return;
        let vendors = data.vendors || [];
        let currencies = data.currencies || [{ id: 'USD', name: 'United States Dollar' }];
        if (!vendors.length) {
          try {
            const gf = await fetchGenericInvoiceLookups();
            vendors = gf.vendors || [];
            if (gf.currencies?.length) currencies = gf.currencies;
          } catch {
            // Keep mock/empty vendors if Generic Finances lookups are unavailable.
          }
        }
        setLookups({ vendors, currencies });
        if (currencies.length && !currencies.some((c) => String(c.id) === 'USD')) {
          updateField('exchangeCurrency', String(currencies[0].id));
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load payment form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.selVendor) {
        setVendorBanks([]);
        setBankingDetail(null);
        setForm((prev) => (prev.bankingId ? { ...prev, bankingId: '' } : prev));
        setLines([emptyLine({ selected: true })]);
        return;
      }

      setLoadingLines(true);
      try {
        const data = await fetchGroupPaymentCostLines({
          selVendor: form.selVendor,
          selYear: isTc ? undefined : form.year,
          contractType: form.contractType,
        });
        if (cancelled) return;

        const records = data.records || [];
        setLines(records.length ? records.map(lineFromApi) : [emptyLine({ selected: true })]);

        if (Array.isArray(data.banking) && data.banking.length) {
          const mapped = data.banking.map((row) => ({
            id: String(row.id),
            name: row.name || row.bank || `Bank ${row.id}`,
            detail: row,
          }));
          setVendorBanks(mapped);
          setBankingDetail(null);
          setForm((prev) => (prev.bankingId ? { ...prev, bankingId: '' } : prev));
        } else {
          const vendor = lookups.vendors.find((row) => String(row.id) === String(form.selVendor));
          const vendorKey = vendor?.vendorId || form.selVendor;
          try {
            const bankData = await fetchVendorBanking(vendorKey);
            if (cancelled) return;
            const rows = bankData.records || bankData.banks || bankData || [];
            const list = (Array.isArray(rows) ? rows : []).map((row) => ({
              id: String(row.id),
              name: row.name || row.bank || `Bank ${row.id}`,
              detail: row,
            }));
            setVendorBanks(list);
          } catch {
            if (!cancelled) setVendorBanks([]);
          }
          setBankingDetail(null);
          setForm((prev) => (prev.bankingId ? { ...prev, bankingId: '' } : prev));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load voyage cost lines.');
          setLines([emptyLine({ selected: true })]);
        }
      } finally {
        if (!cancelled) setLoadingLines(false);
      }
    })();
    return () => { cancelled = true; };
  }, [form.selVendor, form.year, form.contractType, isTc, lookups.vendors]);

  const handleBankingChange = useCallback(async (value) => {
    setForm((prev) => ({ ...prev, bankingId: value }));
    if (!value) {
      setBankingDetail(null);
      return;
    }
    const local = vendorBanks.find((row) => String(row.id) === String(value));
    if (local?.detail) {
      setBankingDetail(local.detail);
      return;
    }
    try {
      const detail = await fetchBankingDetail(value);
      setBankingDetail(detail?.detail || detail);
    } catch {
      setBankingDetail(null);
    }
  }, [vendorBanks]);

  const onFilesPicked = (list) => {
    const next = Array.from(list || []);
    if (!next.length) return;
    setFiles((prev) => [...prev, ...next]);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.selVendor) {
      await alert({ title: 'Vendor required', message: 'Please select a vendor.', confirmLabel: 'OK' });
      return;
    }
    if (!form.paymentDate) {
      await alert({ title: 'Payment date required', message: 'Please enter Payment/SOA Date.', confirmLabel: 'OK' });
      return;
    }
    if (!form.bankingId) {
      await alert({ title: 'Banking required', message: 'Please select Banking Details.', confirmLabel: 'OK' });
      return;
    }
    const selected = lines.filter((line) => line.selected);
    if (!selected.length) {
      await alert({ title: 'Cost lines', message: 'Please select at least one cost line.', confirmLabel: 'OK' });
      return;
    }
    const incomplete = selected.find((line) => !String(line.paymentNo || '').trim()
      || !String(line.actual || '').trim()
      || !String(line.remarks || '').trim());
    if (incomplete) {
      await alert({
        title: 'Required fields',
        message: 'Selected cost lines need Payment No, Actual Amount, and Remarks.',
        confirmLabel: 'OK',
      });
      return;
    }

    const ok = await confirm({
      title: 'Confirmation',
      message: isTc
        ? 'Are you sure you want to create Combined SOA Payable (TC)?'
        : 'Are you sure you want to create Combined SOA Payable?',
      confirmLabel: 'Create',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const body = new FormData();
      body.append('selVendor', form.selVendor);
      body.append('contractType', form.contractType);
      if (!isTc) body.append('selYear', form.year);
      body.append('txtPaymentDate', form.paymentDate);
      body.append('selExchangeCurrency', form.exchangeCurrency);
      body.append('txtExchangeDate', form.exchangeDate);
      body.append('txtExchangeRate', form.exchangeRate);
      body.append('selBankingDetails', form.bankingId);
      body.append('txtRemarks', form.remarks);
      body.append('lines', JSON.stringify(selected.map((line) => ({
        voyageNo: line.voyageNo,
        vessel: line.vessel,
        costDesc: line.costDesc,
        costType: line.costType,
        vendorInvAmt: line.vendorInvAmt,
        vendorInvDate: line.vendorInvDate,
        paymentNo: line.paymentNo,
        estimated: line.estimated,
        actual: line.actual,
        exchange: formatAmount(parseAmount(line.actual) * exchangeRate),
        remarks: line.remarks,
      }))));
      files.forEach((file) => body.append('attachments', file));

      if (isTc) await createGroupPaymentTc(body);
      else await createGroupPayment(body);

      const qs = new URLSearchParams({ msg: '0' });
      if (isTc) qs.set('contractType', 'tc');
      navigate(`${listPath}?${qs.toString()}`);
    } catch (err) {
      setError(err.message || 'Failed to save group payment.');
    } finally {
      setSaving(false);
    }
  };

  const backPath = isTc ? `${listPath}?contractType=tc` : listPath;

  return (
    <>
      <AddGroupPaymentHeading isTc={isTc} />
      <div className={`zafira-page ${styles.page}`}>
        {loading || loadingLines ? (
          <LoadingOverlay active label={loadingLines ? 'Loading cost lines…' : 'Loading Add Payment…'} />
        ) : null}

        <div className={styles.toolbar}>
          <Link to={backPath} className={styles.btnBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </Link>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <form onSubmit={handleSave}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardNum}>1</span>
              <h2 className={styles.cardTitle}>Payment Details{isTc ? ' (TC)' : ''}</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.grid4}>
                <div className={styles.field}>
                  <label>Vendor <span className={styles.req}>*</span></label>
                  <div className={styles.cardSelect}>
                    <CardSelect
                      value={form.selVendor}
                      options={lookups.vendors}
                      placeholder="---Select from list---"
                      ariaLabel="Vendor"
                      align="start"
                      onChange={(value) => updateField('selVendor', value)}
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Contract Type <span className={styles.req}>*</span></label>
                  <div className={styles.cardSelect}>
                    <CardSelect
                      value={form.contractType}
                      options={CONTRACT_OPTIONS}
                      ariaLabel="Contract Type"
                      align="start"
                      onChange={handleContractTypeChange}
                    />
                  </div>
                </div>
                {!isTc ? (
                  <div className={styles.field}>
                    <label>Year</label>
                    <div className={styles.cardSelect}>
                      <CardSelect
                        value={form.year}
                        options={years}
                        ariaLabel="Year"
                        align="start"
                        onChange={(value) => updateField('year', value)}
                      />
                    </div>
                  </div>
                ) : null}
                <div className={styles.field}>
                  <label htmlFor="gpPaymentDate">Payment/SOA Date <span className={styles.req}>*</span></label>
                  <DmyDateInput
                    id="gpPaymentDate"
                    value={form.paymentDate}
                    onChange={(value) => updateField('paymentDate', value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>Exchange Currency</label>
                  <div className={styles.cardSelect}>
                    <CardSelect
                      value={form.exchangeCurrency}
                      options={lookups.currencies}
                      ariaLabel="Exchange Currency"
                      align="start"
                      onChange={(value) => updateField('exchangeCurrency', value)}
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="gpExchDate">Exchange Date</label>
                  <DmyDateInput
                    id="gpExchDate"
                    value={form.exchangeDate}
                    onChange={(value) => updateField('exchangeDate', value)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="gpExchRate">Exchange Rate</label>
                  <input
                    id="gpExchRate"
                    value={form.exchangeRate}
                    inputMode="decimal"
                    onChange={(e) => updateField('exchangeRate', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>Banking Details <span className={styles.req}>*</span></label>
                  <div className={styles.cardSelect}>
                    <CardSelect
                      value={form.bankingId}
                      options={bankingOptions}
                      placeholder="---Select from list---"
                      ariaLabel="Banking Details"
                      align="start"
                      onChange={handleBankingChange}
                    />
                  </div>
                </div>
              </div>
              <BankingPanel detail={bankingDetail} />
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardNum}>2</span>
              <h2 className={styles.cardTitle}>Voyage Cost Lines{isTc ? ' (TC)' : ''}</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.costWrap}>
                <table className={styles.costTable}>
                  <thead>
                    <tr>
                      <th className={styles.checkCell} />
                      <th>Voy No</th>
                      <th>Vessel</th>
                      <th>Cost Desc.</th>
                      <th>Cost Type</th>
                      <th>Vendor Inv Amt</th>
                      <th>Vendor Inv Date</th>
                      <th>Payment No</th>
                      <th>Estimated (USD)</th>
                      <th>Actual (USD)</th>
                      <th>EX ({form.exchangeCurrency || 'USD'})</th>
                      <th>Remarks</th>
                      <th className={styles.stickyAttach} title="Attachment">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M21 12.5l-8.4 8.4a5 5 0 0 1-7-7L14 5.5a3.5 3.5 0 0 1 5 5L10.5 19a2 2 0 0 1-3-3l7.7-7.7" />
                        </svg>
                      </th>
                      <th className={styles.stickyDel} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const exAmt = formatAmount(parseAmount(line.actual) * exchangeRate);
                      return (
                        <tr key={line.id}>
                          <td className={styles.checkCell}>
                            <input
                              type="checkbox"
                              checked={line.selected}
                              onChange={(e) => updateLine(line.id, { selected: e.target.checked })}
                              aria-label="Select cost line"
                            />
                          </td>
                          <td>
                            <input
                              value={line.voyageNo}
                              placeholder="Voyage No"
                              onChange={(e) => updateLine(line.id, { voyageNo: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              value={line.vessel}
                              placeholder="Vessel Name"
                              onChange={(e) => updateLine(line.id, { vessel: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              value={line.costDesc}
                              placeholder="Cost Desc"
                              onChange={(e) => updateLine(line.id, { costDesc: e.target.value })}
                            />
                          </td>
                          <td>
                            <select
                              value={line.costType}
                              onChange={(e) => updateLine(line.id, { costType: e.target.value })}
                            >
                              {costTypeOptions.map((opt) => (
                                <option key={opt.id || 'blank'} value={opt.id}>{opt.name}</option>
                              ))}
                              {line.costType && !costTypeOptions.some((opt) => opt.id === line.costType) ? (
                                <option value={line.costType}>{line.costType}</option>
                              ) : null}
                            </select>
                          </td>
                          <td>
                            <input
                              value={line.vendorInvAmt}
                              placeholder="0.00"
                              inputMode="decimal"
                              onChange={(e) => updateLine(line.id, {
                                vendorInvAmt: e.target.value,
                                actual: e.target.value || line.actual,
                              })}
                            />
                          </td>
                          <td>
                            <DmyDateInput
                              value={line.vendorInvDate}
                              onChange={(value) => updateLine(line.id, { vendorInvDate: value })}
                            />
                          </td>
                          <td>
                            <input
                              value={line.paymentNo}
                              placeholder="Payment No"
                              onChange={(e) => updateLine(line.id, { paymentNo: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              value={line.estimated}
                              placeholder="0.00"
                              inputMode="decimal"
                              onChange={(e) => updateLine(line.id, { estimated: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              value={line.actual}
                              placeholder="0.00"
                              inputMode="decimal"
                              onChange={(e) => updateLine(line.id, { actual: e.target.value })}
                            />
                          </td>
                          <td>
                            <input value={exAmt} readOnly tabIndex={-1} />
                          </td>
                          <td>
                            <input
                              value={line.remarks}
                              placeholder="Remarks"
                              onChange={(e) => updateLine(line.id, { remarks: e.target.value })}
                            />
                          </td>
                          <td className={styles.stickyAttach}>
                            <label className={styles.attachBtn} title={line.attachName || 'Attach file'}>
                              <input
                                type="file"
                                hidden
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  updateLine(line.id, { attachName: file?.name || '' });
                                  e.target.value = '';
                                }}
                              />
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                                <path d="M21 12.5l-8.4 8.4a5 5 0 0 1-7-7L14 5.5a3.5 3.5 0 0 1 5 5L10.5 19a2 2 0 0 1-3-3l7.7-7.7" />
                              </svg>
                            </label>
                          </td>
                          <td className={styles.stickyDel}>
                            <button
                              type="button"
                              className={styles.rowDel}
                              title="Remove row"
                              aria-label="Remove cost line"
                              onClick={() => removeLine(line.id)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                                <path d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'right' }}>Total</td>
                      <td className={styles.numCell}>{formatAmount(totals.estimated)}</td>
                      <td className={styles.numCell}>{formatAmount(totals.actual)}</td>
                      <td className={styles.numCell}>{formatAmount(totals.exchange)}</td>
                      <td />
                      <td className={styles.stickyAttach} />
                      <td className={styles.stickyDel} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <button type="button" className={styles.addRow} onClick={addLine}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Cost Line
              </button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardNum}>3</span>
              <h2 className={styles.cardTitle}>Attachments &amp; Remarks</h2>
            </div>
            <div className={styles.cardBody}>
              <div
                className={`${styles.dropzone}${dragOver ? ` ${styles.dropzoneDrag}` : ''}`}
                onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  onFilesPicked(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M21 12.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9.5" />
                  <path d="M16 3l5 5-9 9H7v-5z" />
                </svg>
                <div className={styles.dzText}>
                  Drag &amp; drop files here, or <b>browse</b>
                </div>
                <div className={styles.dzSub}>
                  {files.length ? `${files.length} file(s) attached` : 'No documents attached yet'}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    onFilesPicked(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
              {files.length ? (
                <ul className={styles.fileList}>
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.field}>
                <label htmlFor="gpRemarks">Remarks</label>
                <textarea
                  id="gpRemarks"
                  value={form.remarks}
                  placeholder="Remarks"
                  onChange={(e) => updateField('remarks', e.target.value)}
                />
              </div>
              <div className={styles.actionRow}>
                <Link to={backPath} className={styles.btnCancel}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                  Cancel
                </Link>
                <button type="submit" className={styles.btnSave} disabled={saving || loading || loadingLines}>
                  <img src={saveIcon} alt="" className={styles.btnSaveIcon} />
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </section>
        </form>
      </div>
    </>
  );
}

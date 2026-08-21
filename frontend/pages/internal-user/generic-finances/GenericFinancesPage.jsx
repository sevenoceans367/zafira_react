import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  DmyDateInput,
  LoadingOverlay,
  StatusBadge,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath, getLegacyDryoutHref } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import {
  cancelGenericFinanceInvoice,
  fetchGenericFinanceBusinessTypes,
  fetchGenericFinanceYears,
  fetchGenericFinancesList,
  receiveGenericFinancePayment,
} from '../../../services/genericFinances.js';
import GenericFinancesHeaderActions from './GenericFinancesHeaderActions.jsx';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import SopfPagination from '../sopf/SopfPagination.jsx';
import ScrollableTable, { DEFAULT_PAGE_SIZE } from '../sopf/ScrollableTable.jsx';
import styles from './GenericFinancesPage.module.css';

const GENERIC_FINANCES_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <g transform="translate(3.5,2)">
      <path d="M11.2378,0.761771171 L4.5848,0.761771171 C2.5048,0.7538 0.7998,2.4118 0.7508,4.4908 L0.7508,15.2038 C0.7048,17.3168 2.3798,19.0678 4.4928,19.1148 C4.5238,19.1148 4.5538,19.1158 4.5848,19.1148 L12.5738,19.1148 C14.6678,19.0298 16.3178,17.2998 16.3029015,15.2038 L16.3029015,6.0378 L11.2378,0.761771171 Z" />
      <path d="M10.9751,0.75 L10.9751,3.659 C10.9751,5.079 12.1231,6.23 13.5431,6.234 L16.2981,6.234" />
      <line x1="10.7881" y1="13.3585" x2="5.3881" y2="13.3585" />
      <line x1="8.7432" y1="9.606" x2="5.3872" y2="9.606" />
    </g>
  </svg>
);

const DEFAULT_BUSINESS_TYPES = [
  { id: '2', name: 'Tankers' },
  { id: '3', name: 'Dry' },
  { id: '1', name: 'Gas' },
];

function defaultYearOptions(selectedYear) {
  const current = String(new Date().getFullYear());
  const selected = String(selectedYear || current);
  const years = [current, String(Number(current) - 1), String(Number(current) - 2)];
  if (!years.includes(selected)) years.unshift(selected);
  return [...new Set(years)].map((value) => ({ id: value, name: value }));
}

const FLASH = {
  0: { type: 'success', text: 'Record successfully added.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Generic Finances.' },
  2: { type: 'success', text: 'Payment received successfully.' },
  3: { type: 'success', text: 'Invoice cancelled successfully.' },
  4: { type: 'success', text: 'Record successfully updated.' },
};

function statusVariant(tone) {
  if (tone === 'success') return 'success';
  if (tone === 'info') return 'neutral';
  if (tone === 'danger') return 'warning';
  return 'warning';
}

function GenericFinancesHeading() {
  const setHeading = usePageHeaderHeading();
  useLayoutEffect(() => {
    setHeading({ title: 'Generic Finances', icon: GENERIC_FINANCES_ICON });
  }, [setHeading]);
  useEffect(() => () => setHeading(null), [setHeading]);
  return null;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3h9l5 5v13H6z" />
      <path d="M15 3v5h5" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function LegacyIconLink({ href, title, children, className }) {
  if (!href) return null;
  return (
    <a
      className={className || styles.iconBtn}
      href={getLegacyDryoutHref(href)}
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={title}
    >
      {children}
    </a>
  );
}

function PaymentModal({ invoice, onClose, onSubmit }) {
  const [amount, setAmount] = useState(invoice?.netAmount || invoice?.amount || '');
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
            <label htmlFor="gfPaymentAmount">Amount</label>
            <input
              id="gfPaymentAmount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
            />
          </div>
          <div className={styles.modalField}>
            <label htmlFor="gfPaymentDate">Payment Date</label>
            <DmyDateInput
              id="gfPaymentDate"
              value={paymentDate}
              onChange={setPaymentDate}
              required
            />
          </div>
          <div className={styles.modalField}>
            <label htmlFor="gfPaymentRemarks">Remarks</label>
            <textarea
              id="gfPaymentRemarks"
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

export default function GenericFinancesPage() {
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || 'all');
  const [year, setYear] = useState(searchParams.get('selYear') || String(new Date().getFullYear()));
  const [businessTypes, setBusinessTypes] = useState(DEFAULT_BUSINESS_TYPES);
  const [years, setYears] = useState(() => defaultYearOptions(searchParams.get('selYear')));
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flash = FLASH[Number(searchParams.get('msg'))];

  const updateQuery = useCallback((patch) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(patch).forEach(([key, value]) => {
        if (value == null || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleBusinessTypeChange = useCallback((value) => {
    setBusinessType(value);
    updateQuery({ selBType: value, msg: '' });
  }, [updateQuery]);

  const handleYearChange = useCallback((value) => {
    setYear(value);
    updateQuery({ selYear: value, msg: '' });
  }, [updateQuery]);

  const loadLookups = useCallback(async () => {
    try {
      const [types, yearOptions] = await Promise.all([
        fetchGenericFinanceBusinessTypes(businessType),
        fetchGenericFinanceYears(),
      ]);
      if (Array.isArray(types) && types.length) setBusinessTypes(types);
      if (Array.isArray(yearOptions) && yearOptions.length) setYears(yearOptions);
    } catch {
      // Keep seeded defaults so header filters stay visible.
    }
  }, [businessType]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchGenericFinancesList({
        search: debouncedSearch,
        page,
        pageSize,
        selBType: businessType,
        selYear: year,
      });
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
      setCanCreate(Boolean(data.canCreate));
    } catch (err) {
      setError(err.message || 'Failed to load Generic Finances.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, pageSize, year]);

  useEffect(() => { loadLookups(); }, [loadLookups]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [businessType, debouncedSearch, year, pageSize]);

  const handleCancel = async (row) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure to cancel this invoice permanently?',
      confirmLabel: 'Cancel Invoice',
    });
    if (!ok) return;
    try {
      await cancelGenericFinanceInvoice(row.invoiceId);
      updateQuery({ msg: 3 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to cancel invoice.');
    }
  };

  const handlePaymentSubmit = async (payload) => {
    await receiveGenericFinancePayment(paymentInvoice.invoiceId, payload);
    setPaymentInvoice(null);
    updateQuery({ msg: 2 });
    load();
  };

  return (
    <>
      <GenericFinancesHeading />
      <GenericFinancesHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={handleBusinessTypeChange}
        years={years}
        year={year}
        onYearChange={handleYearChange}
        canCreate={canCreate}
      />

      <div className={`zafira-page ${styles.page}`}>
      {loading ? <LoadingOverlay active label="Loading Generic Finances…" /> : null}

      {flash ? (
        <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
          <span>{flash.text}</span>
          <button
            type="button"
            className={styles.toastClose}
            aria-label="Close"
            onClick={() => updateQuery({ msg: '' })}
          >
            ×
          </button>
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <ScrollableTable
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        footer={(
          <SopfPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        )}
      >
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>#</th>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>TXN Type</th>
                <th>Amount</th>
                <th>Net Amount</th>
                <th>PIC</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={10} className={styles.emptyCell}>
                    No matching records
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.invoiceId}>
                  <td className={styles.numCell}>{row.index}</td>
                  <td className={styles.invoiceNo}>{row.invoiceNo || '—'}</td>
                  <td>{row.invoiceDate || '—'}</td>
                  <td>{row.vendor || '—'}</td>
                  <td>{row.invoiceType || row.recordType || '—'}</td>
                  <td className={styles.amountCell}>{row.amount || '—'}</td>
                  <td className={styles.amountCell}>{row.netAmount || '—'}</td>
                  <td>{row.creator || '—'}</td>
                  <td>
                    <StatusBadge variant={statusVariant(row.statusTone)}>
                      {row.statusLabel || '—'}
                    </StatusBadge>
                  </td>
                  <td className={styles.detailsCell}>
                    {row.canEdit ? (
                      <Link
                        className={styles.iconBtn}
                        to={appPath(`/internal-user/vc/generic-finances/${row.invoiceId}/edit`)}
                        title="Edit Details"
                        aria-label="Edit Details"
                      >
                        <PencilIcon />
                      </Link>
                    ) : null}
                    <LegacyIconLink href={row.pdfHref} title="PDF">
                      <PdfIcon />
                    </LegacyIconLink>
                    {row.canReceivePayment ? (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Payment Received"
                        aria-label="Payment Received"
                        onClick={() => setPaymentInvoice(row)}
                      >
                        <CashIcon />
                      </button>
                    ) : null}
                    {row.canCancel ? (
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        title="Cancel Invoice"
                        aria-label="Cancel Invoice"
                        onClick={() => handleCancel(row)}
                      >
                        <CloseIcon />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </ScrollableTable>

      {paymentInvoice ? (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSubmit={handlePaymentSubmit}
        />
      ) : null}
      </div>
    </>
  );
}

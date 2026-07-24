import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  DmyDateInput,
  LoadingOverlay,
  StatusBadge,
  useConfirm,
} from '@bainbridge/shared-ui';
import { getLegacyDryoutHref } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import {
  cancelGenericFinanceInvoice,
  fetchGenericFinanceBusinessTypes,
  fetchGenericFinanceYears,
  fetchGenericFinancesList,
  receiveGenericFinancePayment,
} from '../../../services/genericFinances.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import GenericFinancesHeaderActions from './GenericFinancesHeaderActions.jsx';
import styles from './GenericFinancesPage.module.css';

const PAGE_SIZE = 50;

const DEFAULT_BUSINESS_TYPES = [
  { id: '3', name: 'Dry' },
  { id: '2', name: 'Tankers' },
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
  0: { type: 'success', text: 'Generic Finances added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Generic Finances.' },
  2: { type: 'success', text: 'Payment received successfully.' },
  3: { type: 'success', text: 'Invoice Cancelled successfully.' },
};

function statusVariant(tone) {
  if (tone === 'success') return 'success';
  if (tone === 'info') return 'info';
  if (tone === 'danger') return 'warning';
  return 'warning';
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
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '3');
  const [year, setYear] = useState(searchParams.get('selYear') || String(new Date().getFullYear()));
  const [businessTypes, setBusinessTypes] = useState(DEFAULT_BUSINESS_TYPES);
  const [years, setYears] = useState(() => defaultYearOptions(searchParams.get('selYear')));
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
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
        pageSize: PAGE_SIZE,
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
  }, [businessType, debouncedSearch, page, year]);

  useEffect(() => { loadLookups(); }, [loadLookups]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [businessType, debouncedSearch, year]);

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
      {loading ? <LoadingOverlay active label="Loading GENERIC FINANCES…" /> : null}

      {flash ? (
        <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
          {flash.type === 'success' ? 'Success! ' : 'Error! '}
          {flash.text}
          <button
            type="button"
            style={{ marginLeft: 12, border: 'none', background: 'transparent', cursor: 'pointer' }}
            aria-label="Close"
            onClick={() => updateQuery({ msg: '' })}
          >
            ×
          </button>
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Invoice No</th>
              <th>Invoice Date</th>
              <th>Vendor</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Net Amount</th>
              <th>Creator</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={10} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.invoiceId}>
                <td>{row.index}</td>
                <td>{row.invoiceNo || '—'}</td>
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
                    <LegacyIconLink href={row.editHref} title="Edit Details">
                      <i className="bi bi-pencil-square" aria-hidden />
                    </LegacyIconLink>
                  ) : null}
                  <LegacyIconLink href={row.pdfHref} title="PDF">
                    <i className="bi bi-file-earmark-pdf" aria-hidden />
                  </LegacyIconLink>
                  {row.canReceivePayment ? (
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Payment Received"
                      aria-label="Payment Received"
                      onClick={() => setPaymentInvoice(row)}
                    >
                      <i className="bi bi-cash-coin" aria-hidden />
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
                      <i className="bi bi-x-circle" aria-hidden />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SopfPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

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

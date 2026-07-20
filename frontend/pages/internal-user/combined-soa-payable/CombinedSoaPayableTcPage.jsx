import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { getLegacyDryoutHref } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchCombinedSoaPayableTcList } from '../../../services/combinedSoaPayable.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import CombinedSoaPayableHeaderActions from './CombinedSoaPayableHeaderActions.jsx';
import styles from './CombinedSoaPayablePage.module.css';

const PAGE_SIZE = 50;

const FLASH = {
  0: { type: 'success', text: 'Combined SOA Payable added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Combined SOA Payable.' },
  2: { type: 'success', text: 'Combined SOA Payable delete successfully.' },
};

function statusClass(tone) {
  const base = styles.statusBadge;
  if (tone === 'warning') return `${base} ${styles.statusWarning}`;
  if (tone === 'success') return `${base} ${styles.statusSuccess}`;
  return `${base} ${styles.statusDanger}`;
}

function LegacyLink({ href, children, className, title }) {
  if (!href) return '—';
  return (
    <a
      className={className || styles.link}
      href={getLegacyDryoutHref(href)}
      target="_blank"
      rel="noreferrer"
      title={title}
    >
      {children}
    </a>
  );
}

export default function CombinedSoaPayableTcPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flash = FLASH[Number(searchParams.get('msg'))];

  const updateQuery = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCombinedSoaPayableTcList({
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      });
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
      setCanCreate(Boolean(data.canCreate));
    } catch (err) {
      setError(err.message || 'Failed to load Combined SOA Payable TC.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  return (
    <>
      <CombinedSoaPayableHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
      />

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay active label="Loading Combined SOA Payable TC…" /> : null}

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

        <h3 className={styles.title}>Combined SOA Payable TC</h3>

        <div className={styles.toolbar}>
          {canCreate ? (
            <a href={getLegacyDryoutHref('addcombinedpayablesoa_tc.php')} className={styles.addLink}>
              <Button variant="primary" label="Add New" />
            </a>
          ) : null}
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>SOA ID</th>
                <th>SOA Date</th>
                <th>Vendor</th>
                <th>SOA Amount</th>
                <th>Creator</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.soaId}>
                  <td>{row.index}</td>
                  <td>{row.soaNo || '—'}</td>
                  <td>{row.soaDate || '—'}</td>
                  <td>{row.vendor || '—'}</td>
                  <td className={styles.amountCell}>{row.soaAmount || '—'}</td>
                  <td>{row.creator || '—'}</td>
                  <td>
                    <span className={statusClass(row.statusTone)}>
                      {row.statusLabel || '—'}
                    </span>
                  </td>
                  <td className={styles.detailsCell}>
                    <LegacyLink href={row.editHref} className={styles.editIcon} title="Edit Details">
                      <i className="bi bi-pencil-square" aria-hidden />
                    </LegacyLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SopfPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </>
  );
}

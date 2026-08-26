import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingOverlay, StatusBadge } from '@bainbridge/shared-ui';
import { getLegacyDryoutHref } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { groupPaymentsAddAppPath } from '../../../constants/combinedSoaPayablePageHeaders.js';
import {
  fetchCombinedSoaPayableList,
  fetchCombinedSoaPayableTcList,
} from '../../../services/combinedSoaPayable.js';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import SopfPagination from '../sopf/SopfPagination.jsx';
import ScrollableTable, { DEFAULT_PAGE_SIZE } from '../sopf/ScrollableTable.jsx';
import CombinedSoaPayableHeaderActions from './CombinedSoaPayableHeaderActions.jsx';
import styles from './CombinedSoaPayablePage.module.css';

const FLASH = {
  0: { type: 'success', text: 'Group payment added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Group Payments.' },
  2: { type: 'success', text: 'Group payment deleted successfully.' },
};

const GROUP_PAYMENTS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 15h3" />
  </svg>
);

function statusVariant(tone) {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  return 'warning';
}

function parseContractType(value) {
  if (value === 'spot' || value === 'tc') return value;
  return 'all';
}

function yearFromSoaDate(soaDate) {
  const parts = String(soaDate || '').split('-');
  if (parts.length === 3 && parts[2]?.length === 4) return parts[2];
  return '';
}

function defaultYearOptions() {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2].map((value) => ({
    id: String(value),
    name: String(value),
  }));
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

function GroupPaymentsHeading() {
  const setHeading = usePageHeaderHeading();
  useLayoutEffect(() => {
    setHeading({ title: 'Group Payments', icon: GROUP_PAYMENTS_ICON });
  }, [setHeading]);
  useEffect(() => () => setHeading(null), [setHeading]);
  return null;
}

function tagRows(records, tradeType) {
  return (records || []).map((row) => ({
    ...row,
    tradeType,
    rowKey: `${tradeType}-${row.soaId}`,
  }));
}

export default function CombinedSoaPayablePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [contractType, setContractType] = useState(() => parseContractType(searchParams.get('contractType')));
  const [year, setYear] = useState(() => searchParams.get('year') || 'all');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flash = FLASH[Number(searchParams.get('msg'))];
  const yearOptions = useMemo(() => defaultYearOptions(), []);

  const updateQuery = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '' || value === 'all') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const handleContractTypeChange = (next) => {
    const value = parseContractType(next);
    setContractType(value);
    updateQuery({ contractType: value === 'all' ? '' : value });
  };

  const handleYearChange = (next) => {
    const value = next || 'all';
    setYear(value);
    updateQuery({ year: value === 'all' ? '' : value });
  };

  const addPath = groupPaymentsAddAppPath({
    contractType: contractType === 'all' ? 'spot' : contractType,
    year: year === 'all' ? '' : year,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fetchAll = contractType === 'all';
      const requests = [];
      if (contractType === 'all' || contractType === 'spot') {
        requests.push(
          fetchCombinedSoaPayableList({
            search: debouncedSearch,
            page: fetchAll ? 1 : page,
            pageSize: fetchAll ? 500 : pageSize,
          }).then((data) => ({ ...data, tradeType: 'Spot' })),
        );
      }
      if (contractType === 'all' || contractType === 'tc') {
        requests.push(
          fetchCombinedSoaPayableTcList({
            search: debouncedSearch,
            page: fetchAll ? 1 : page,
            pageSize: fetchAll ? 500 : pageSize,
          }).then((data) => ({ ...data, tradeType: 'TC' })),
        );
      }

      const results = await Promise.all(requests);
      let merged = results.flatMap((result) => tagRows(result.records, result.tradeType));
      if (year !== 'all') {
        merged = merged.filter((row) => yearFromSoaDate(row.soaDate) === String(year));
      }

      if (fetchAll || year !== 'all') {
        const start = (page - 1) * pageSize;
        setTotal(merged.length);
        setRows(merged.slice(start, start + pageSize).map((row, index) => ({
          ...row,
          index: start + index + 1,
        })));
      } else {
        const [only] = results;
        setTotal(only?.recordsTotal || 0);
        setRows(tagRows(only?.records || [], only?.tradeType).map((row, index) => ({
          ...row,
          index: ((page - 1) * pageSize) + index + 1,
        })));
      }

      setCanCreate(results.some((result) => result.canCreate));
    } catch (err) {
      setError(err.message || 'Failed to load Group Payments.');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [contractType, debouncedSearch, page, pageSize, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, pageSize, contractType, year]);

  return (
    <>
      <GroupPaymentsHeading />
      <CombinedSoaPayableHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        contractType={contractType}
        onContractTypeChange={handleContractTypeChange}
        year={year}
        onYearChange={handleYearChange}
        yearOptions={yearOptions}
        canCreate={canCreate}
        addPath={addPath}
      />

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay active label="Loading Group Payments…" /> : null}

        {flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.type === 'success' ? 'Success! ' : 'Error! '}
            {flash.text}
            <button
              type="button"
              className={styles.flashClose}
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
          footer={<SopfPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>SOA No.</th>
                <th>Trade Type</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>PIC</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={9} className={styles.emptyCell}>
                    No group payments for the selected filters.
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.rowKey || row.soaId}>
                  <td>{row.index}</td>
                  <td>{row.soaNo || '—'}</td>
                  <td>
                    <span className={`${styles.tradeChip} ${row.tradeType === 'TC' ? styles.tradeTc : styles.tradeSpot}`}>
                      {row.tradeType || '—'}
                    </span>
                  </td>
                  <td>{row.soaDate || '—'}</td>
                  <td>{row.vendor || '—'}</td>
                  <td className={styles.amountCell}>{row.soaAmount || '—'}</td>
                  <td>{row.creator || '—'}</td>
                  <td>
                    <StatusBadge variant={statusVariant(row.statusTone)}>
                      {row.statusLabel || '—'}
                    </StatusBadge>
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
        </ScrollableTable>
      </div>
    </>
  );
}

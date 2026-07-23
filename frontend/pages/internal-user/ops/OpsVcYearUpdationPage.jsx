import React, { useCallback, useEffect, useState } from 'react';
import {
  DmyDateInput,
  LoadingOverlay,
} from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchYearUpdation, updateYearAddOnDate } from '../../../services/opsVc.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import OpsVcListHeaderActions from './OpsVcListHeaderActions.jsx';
import styles from './OpsPages.module.css';

const PAGE_SIZE = 50;

export default function OpsVcYearUpdationPage() {
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchYearUpdation({
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      });
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
    } catch (err) {
      setError(err.message || 'Failed to load Year Updation.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const handleDateChange = async (row, value) => {
    setRows((prev) => prev.map((item) => (
      String(item.comId) === String(row.comId)
        ? { ...item, addOnDate: value }
        : item
    )));
    if (!value || value === row.date) return;

    setSavingId(String(row.comId));
    setError('');
    setFlash('');
    try {
      const result = await updateYearAddOnDate(row.comId, value);
      setRows((prev) => prev.map((item) => (
        String(item.comId) === String(row.comId)
          ? {
            ...item,
            date: result.addOnDate || value,
            addOnDate: result.addOnDate || value,
          }
          : item
      )));
      setFlash(`Add On Date updated for voyage ${row.voyageNo || row.comId}.`);
    } catch (err) {
      setError(err.message || 'Failed to update Add On Date.');
      setRows((prev) => prev.map((item) => (
        String(item.comId) === String(row.comId)
          ? { ...item, addOnDate: row.date }
          : item
      )));
    } finally {
      setSavingId('');
    }
  };

  return (
    <>
      <OpsVcListHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search voyage no, vessel…"
      />

      <div className={`zafira-page ${styles.page}`}>
      {loading || savingId ? <LoadingOverlay active label={savingId ? 'Saving…' : 'Loading Year Updation…'} /> : null}
      {flash ? <div className={styles.flashSuccess}>{flash}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>Year Updation</h3>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr. No</th>
              <th>Voyage No.</th>
              <th>Vessel</th>
              <th>CP Date</th>
              <th>Date</th>
              <th>Add On Date</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={`${row.comId}-${row.voyageNo}`}>
                <td>{row.index}.</td>
                <td>{row.voyageNo || '—'}</td>
                <td>{row.vesselName || '—'}</td>
                <td>{row.cpDate || '—'}</td>
                <td>{row.date || '—'}</td>
                <td>
                  <DmyDateInput
                    value={row.addOnDate || ''}
                    onChange={(value) => handleDateChange(row, value)}
                    disabled={Boolean(savingId)}
                  />
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

import React, { useCallback, useEffect, useState } from 'react';
import { Button, DmyDateInput, LoadingOverlay } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchYearUpdationTc, updateTcUpdateOnDate } from '../../../services/opsTc.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import OpsTcInOpsGlanceHeaderActions from './OpsTcInOpsGlanceHeaderActions.jsx';
import styles from './OpsPages.module.css';

const PAGE_SIZE = 50;

export default function OpsTcYearUpdationPage() {
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
      const data = await fetchYearUpdationTc({
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      });
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
    } catch (err) {
      setError(err.message || 'Failed to load Year Updation TC.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const handleDateChange = async (row, value) => {
    setRows((prev) => prev.map((item) => (
      String(item.comId) === String(row.comId)
        ? { ...item, updateYear: value }
        : item
    )));
    if (!value || value === row.year) return;

    setSavingId(String(row.comId));
    setError('');
    setFlash('');
    try {
      const result = await updateTcUpdateOnDate(row.comId, value);
      setRows((prev) => prev.map((item) => (
        String(item.comId) === String(row.comId)
          ? {
            ...item,
            year: result.year || value,
            updateYear: result.updateYear || value,
          }
          : item
      )));
      setFlash(`Year updated for TC ${row.tcNo || row.comId}.`);
    } catch (err) {
      setError(err.message || 'Failed to update year.');
      setRows((prev) => prev.map((item) => (
        String(item.comId) === String(row.comId)
          ? { ...item, updateYear: row.year }
          : item
      )));
    } finally {
      setSavingId('');
    }
  };

  return (
    <>
      <OpsTcInOpsGlanceHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
      />

      <div className={`zafira-page ${styles.page}`}>
        {loading || savingId ? (
          <LoadingOverlay active label={savingId ? 'Saving…' : 'Loading Year Updation TC…'} />
        ) : null}
        {flash ? <div className={styles.flashSuccess}>{flash}</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <h3 className={styles.title}>Year Updation-TC</h3>

        <div className={styles.toolbar}>
          <div className={styles.toolbarActions}>
            <Button variant="primary" label="Load" onClick={load} disabled={loading} />
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Sr. No</th>
                <th>TC No.</th>
                <th>Vessel</th>
                <th>CP Date</th>
                <th>Year</th>
                <th>Update Year</th>
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
                <tr key={`${row.comId}-${row.tcNo}`}>
                  <td>{row.index}.</td>
                  <td>{row.tcNo || '—'}</td>
                  <td>{row.vesselName || '—'}</td>
                  <td>{row.cpDate || '—'}</td>
                  <td>{row.year || '—'}</td>
                  <td>
                    <DmyDateInput
                      value={row.updateYear || ''}
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

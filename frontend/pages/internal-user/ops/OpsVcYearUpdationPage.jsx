import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DmyDateInput, LoadingOverlay } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchYearUpdation, updateYearAddOnDate } from '../../../services/opsVc.js';
import OpsVcListHeaderActions from './OpsVcListHeaderActions.jsx';
import {
  DEFAULT_PAGE_SIZE,
  OpsVcGlanceHeader,
  OpsVcGlanceTable,
} from './OpsVcGlanceUi.jsx';
import pageStyles from './OpsPages.module.css';
import styles from './OpsVcInOpsGlancePage.module.css';

const CARDS = [
  { key: 'trades', title: 'Voyages', variant: 'fin', icon: 'trades' },
  { key: 'vessels', title: 'Vessels', variant: 'count', icon: 'vessels' },
  { key: 'worksheets', title: 'Dates set', variant: 'fin', icon: 'worksheets' },
  { key: 'alerts', title: 'Dates pending', variant: 'count', icon: 'alerts' },
];

function yearStats(rows, total) {
  const uniqueVessels = new Set(rows.map((row) => row.vesselName).filter(Boolean)).size;
  const dated = rows.filter((row) => row.addOnDate).length;
  const pending = rows.filter((row) => !row.addOnDate).length;
  return { trades: total, vessels: uniqueVessels, worksheets: dated, alerts: pending };
}

export default function OpsVcYearUpdationPage() {
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
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
        pageSize,
      });
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
    } catch (err) {
      setError(err.message || 'Failed to load Year Updation.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, pageSize]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, pageSize]);

  const stats = useMemo(() => yearStats(rows, total), [rows, total]);

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

      <div className={`zafira-page ${pageStyles.page}`}>
        {loading || savingId ? (
          <LoadingOverlay active label={savingId ? 'Saving…' : 'Loading Year Updation…'} />
        ) : null}
        {flash ? <div className={pageStyles.flashSuccess}>{flash}</div> : null}
        {error ? <div className={pageStyles.error}>{error}</div> : null}

        <OpsVcGlanceHeader
          title="Year Updation"
          stats={stats}
          cards={CARDS}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          showingLabel={`Showing ${rows.length} of ${total} voyages`}
        />

        <OpsVcGlanceTable compact page={page} pageSize={pageSize} total={total} onPageChange={setPage}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
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
            ) : rows.map((row, index) => (
              <tr key={`${row.comId}-${row.voyageNo}`}>
                <td className={styles.itemCell}>{(page - 1) * pageSize + index + 1}.</td>
                <td>
                  <span className={styles.primary}>{row.voyageNo || '—'}</span>
                </td>
                <td>
                  <span className={styles.primary}>{row.vesselName || '—'}</span>
                </td>
                <td>{row.cpDate || '—'}</td>
                <td>{row.date || '—'}</td>
                <td className={styles.dateCell}>
                  <DmyDateInput
                    value={row.addOnDate || ''}
                    onChange={(value) => handleDateChange(row, value)}
                    disabled={Boolean(savingId)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </OpsVcGlanceTable>
      </div>
    </>
  );
}

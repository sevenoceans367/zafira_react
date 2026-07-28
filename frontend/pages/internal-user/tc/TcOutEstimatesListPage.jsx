import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import {
  deleteTcEstimate,
  fetchTcBusinessTypes,
  fetchTcEstimates,
} from '../../../services/tcEstimates.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import TcDecisionChartModal from './TcDecisionChartModal.jsx';
import TcListHeaderActions from './TcListHeaderActions.jsx';
import styles from './TcPages.module.css';

const PAGE_SIZE = 10;
const DEFAULT_BUSINESS_TYPE = '2';

const FLASH = {
  0: { type: 'success', text: 'TC Out Estimate saved successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while saving TC Out Estimate.' },
  2: { type: 'success', text: 'TC Out Estimate deleted successfully.' },
  3: { type: 'success', text: 'Final TC Out Estimate sent to Decision Chart successfully.' },
};

export default function TcOutEstimatesListPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const businessType = searchParams.get('selBType') || DEFAULT_BUSINESS_TYPE;
  const periodFrom = searchParams.get('periodFrom') || '';
  const periodTo = searchParams.get('periodTo') || '';
  const flash = FLASH[Number(searchParams.get('msg'))];

  const updateQuery = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [types, data] = await Promise.all([
        fetchTcBusinessTypes(businessType),
        fetchTcEstimates({
          selBType: businessType,
          periodFrom,
          periodTo,
          search: debouncedSearch,
          page,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setBusinessTypes(types);
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
      setSelectedIds([]);
    } catch (err) {
      setError(err.message || 'Failed to load TC Out Estimates.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, periodFrom, periodTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, businessType, periodFrom, periodTo]);

  const comparableIds = rows.filter((row) => row.canCompare).map((row) => String(row.tcOutId));
  const allComparableSelected = comparableIds.length > 0
    && comparableIds.every((id) => selectedIds.includes(id));

  const toggleAll = () => {
    setSelectedIds(allComparableSelected ? [] : comparableIds);
  };

  const toggleOne = (row) => {
    if (!row.canCompare) return;
    const id = String(row.tcOutId);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete TC Out Estimate',
      message: `Delete ${row.tcNo || row.tcOutId}? This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await deleteTcEstimate(row.tcOutId);
      updateQuery({ msg: 2 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to delete estimate.');
    }
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      <TcListHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={(value) => updateQuery({ selBType: value })}
        periodFrom={periodFrom}
        periodTo={periodTo}
        onPeriodChange={({ from, to }) => updateQuery({ periodFrom: from || '', periodTo: to || '' })}
      />

      {loading ? <LoadingOverlay active label="Loading TC Out Estimates…" /> : null}
      {flash ? (
        <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
          {flash.text}
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>TC Out Estimates</h3>

      <div className={styles.toolbar}>
        <div className={styles.toolbarActions}>
          <Button
            label="Add Fixture Note"
            onClick={() => navigate(appPath(`/internal-user/vc/tc/add?selBType=${businessType}`))}
          />
          <Button
            variant="outline"
            label="Decision Chart"
            disabled={selectedIds.length < 1}
            onClick={() => setCompareOpen(true)}
          />
          <Button
            variant="outline"
            label="Decision Chart List"
            onClick={() => navigate(appPath('/internal-user/vc/decision-chart-tc'))}
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Vessel</th>
              <th>Vessel Type</th>
              <th>TC No.</th>
              <th>CP Date</th>
              <th>DWT</th>
              <th>Del Port</th>
              <th>Re Del Port</th>
              <th>TC Days</th>
              <th>Daily Gross Hire(USD)</th>
              <th>Total Rev(USD)</th>
              <th className={styles.center}>
                Select All
                <br />
                <input
                  type="checkbox"
                  checked={allComparableSelected}
                  onChange={toggleAll}
                  disabled={!comparableIds.length}
                />
              </th>
              <th className={styles.center}>Fixture Note</th>
              <th className={styles.center}>Estimate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tcOutId}>
                <td>{row.index}</td>
                <td>{row.vesselName}</td>
                <td>{row.vesselType}</td>
                <td>{row.tcNo}</td>
                <td>{row.cpDate}</td>
                <td>{row.dwt}</td>
                <td>{row.delPort}</td>
                <td>{row.reDelPort}</td>
                <td>{row.tcDays}</td>
                <td>{row.dailyGrossHire}</td>
                <td>{row.totalRev}</td>
                <td className={styles.center}>
                  {row.sentToDecisionChart ? (
                    <span className={styles.muted}>Sent to Decision Chart</span>
                  ) : row.canCompare ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(row.tcOutId))}
                      onChange={() => toggleOne(row)}
                    />
                  ) : (
                    <span className={styles.muted}>{row.compareLabel || 'Create Estimate'}</span>
                  )}
                </td>
                <td className={styles.center}>
                  <div className={styles.actions}>
                    <Link to={appPath(`/internal-user/vc/tc/${row.tcOutId}/edit`)} title="Edit Details">
                      Edit
                    </Link>
                    <button
                      type="button"
                      className={`${styles.linkBtn} ${styles.linkBtnDanger}`}
                      onClick={() => handleDelete(row)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
                <td className={styles.center}>
                  {row.sentToDecisionChart ? (
                    <Link to={appPath(`/internal-user/vc/tc/${row.tcOutId}/view`)} title="View Estimate">
                      View
                    </Link>
                  ) : (
                    <Link to={appPath(`/internal-user/vc/tc/${row.tcOutId}/calculate`)} title="Edit TC Estimate">
                      Calculate
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={14} className={styles.center}>No TC Out Estimates found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SopfPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      <TcDecisionChartModal
        open={compareOpen}
        ids={selectedIds}
        onClose={() => setCompareOpen(false)}
        onSubmitted={() => {
          setCompareOpen(false);
          updateQuery({ msg: 3 });
          navigate(appPath('/internal-user/vc/decision-chart-tc?msg=3'));
        }}
      />
    </div>
  );
}

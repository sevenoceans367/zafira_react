import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, PeriodCardPicker, useConfirm } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import { fetchCoaOpsVoyages, moveVoyageToPostOps } from '../../../services/coas.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import CoaCardSelect from './CoaCardSelect.jsx';
import styles from './CoaPages.module.css';

const PAGE_SIZE = 10;

export default function CoaOpsListPage({ status = '1', title = 'COA - In Ops' }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '3');
  const [periodFrom, setPeriodFrom] = useState(searchParams.get('fromDate') || '');
  const [periodTo, setPeriodTo] = useState(searchParams.get('toDate') || '');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [types, data] = await Promise.all([
        fetchVcBusinessTypes(businessType),
        fetchCoaOpsVoyages({
          selBType: businessType,
          status,
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          fromDate: periodFrom,
          toDate: periodTo,
        }),
      ]);
      setBusinessTypes(types);
      setRows(data.records ?? []);
      setTotal(data.recordsTotal ?? 0);
    } catch (err) {
      setError(err.message || 'Failed to load COA operations.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, periodFrom, periodTo, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, businessType, periodFrom, periodTo, status]);

  const handleMove = async (row) => {
    const ok = await confirm({
      title: 'Move to Post Ops',
      message: `Move voyage ${row.voyageNo} to Post Ops?`,
      confirmLabel: 'Move',
    });
    if (!ok) return;
    try {
      await moveVoyageToPostOps(row.comId);
      load();
    } catch (err) {
      setError(err.message || 'Failed to move voyage.');
    }
  };

  return (
    <div className={`zafira-page ${styles.page}`}>
      {loading ? <LoadingOverlay active label="Loading COA operations…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>{title}</h3>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <div className={styles.filterField}>
            <label>Business Type</label>
            <CoaCardSelect
              label="Business Type"
              value={businessType}
              options={businessTypes}
              includeEmpty={false}
              onChange={(value) => {
                setBusinessType(value);
                const next = new URLSearchParams(searchParams);
                next.set('selBType', value);
                setSearchParams(next, { replace: true });
              }}
            />
          </div>
          <div className={`${styles.filterField} ${styles.periodFilter}`}>
            <PeriodCardPicker
              from={periodFrom}
              to={periodTo}
              onChange={({ from, to }) => {
                setPeriodFrom(from || '');
                setPeriodTo(to || '');
              }}
              label="Select Period"
              align="start"
            />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="ops-search">Search</label>
            <input
              id="ops-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Voyage, vessel, COA…"
            />
          </div>
        </div>
        <div className={styles.toolbarActions}>
          <Button variant="primary" label="Load" onClick={load} disabled={loading} />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Vessel</th>
              <th>COA ID / No.</th>
              <th>Voyage No.</th>
              <th>CP Date</th>
              <th>LP/DP</th>
              <th>Duration</th>
              <th>Cargo Qty</th>
              <th>TCE</th>
              <th>P/L</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={`${row.comId}-${row.fcaId}`}>
                <td>{row.index}</td>
                <td>{row.vesselName}</td>
                <td>{`${row.coaIdentity} / ${row.coaNo}`}</td>
                <td>{row.voyageNo}</td>
                <td>{row.cpDate}</td>
                <td>{row.ports}</td>
                <td>{row.duration}</td>
                <td>{row.cargoQty}</td>
                <td>{row.tce}</td>
                <td>{row.profitLoss}</td>
                <td><span className={styles.statusOps}>{row.status}</span></td>
                <td className={styles.actionCell}>
                  <Link
                    className={styles.actionIcon}
                    to={`/internal-user/sopf/viewestimate?id=${row.fcaId}`}
                    title="View estimate"
                  >
                    <i className="bi bi-eye" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    className={styles.actionIcon}
                    title="Edit estimate"
                    onClick={() => navigate(`/internal-user/sopf/updateestimate?id=${row.fcaId}`)}
                  >
                    <i className="bi bi-pencil-square" aria-hidden />
                  </button>
                  {row.canMoveToPostOps ? (
                    <button
                      type="button"
                      className={styles.actionIcon}
                      title="Move to Post Ops"
                      onClick={() => handleMove(row)}
                    >
                      <i className="bi bi-arrow-right-circle" aria-hidden />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SopfPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import { deleteCargoRelet, fetchCargoRelets } from '../../../services/coas.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import CoaListHeaderActions from './CoaListHeaderActions.jsx';
import styles from './CoaPages.module.css';

const PAGE_SIZE = 10;

export default function CargoReletListPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const coaId = searchParams.get('coaId') || '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [types, data] = await Promise.all([
        fetchVcBusinessTypes(businessType),
        fetchCargoRelets({
          selBType: businessType,
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          coaId,
        }),
      ]);
      setBusinessTypes(types);
      setRows(data.records ?? []);
      setTotal(data.recordsTotal ?? 0);
    } catch (err) {
      setError(err.message || 'Failed to load cargo relets.');
    } finally {
      setLoading(false);
    }
  }, [businessType, coaId, debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, businessType, coaId]);

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete Cargo Relet',
      message: `Delete relet ${row.reletNo}?`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteCargoRelet(row.fcaId);
      load();
    } catch (err) {
      setError(err.message || 'Failed to delete cargo relet.');
    }
  };

  return (
    <>
      <CoaListHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Relet no, COA…"
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={(value) => {
          setBusinessType(value);
          const next = new URLSearchParams(searchParams);
          next.set('selBType', value);
          setSearchParams(next, { replace: true });
        }}
        primaryAction={{
          label: 'Add New Cargo Relet',
          onClick: () => navigate(
            `/internal-user/vc/coas/cargo-relet/add?selBType=${businessType}${coaId ? `&coaId=${coaId}` : ''}`,
          ),
        }}
      />

      <div className={`zafira-page ${styles.page}`}>
      <LoadingOverlay show={loading} fullScreen={false} label="Loading cargo relets…" />
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>COA - Cargo Relet</h3>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>COA ID / No.</th>
              <th>Relet No.</th>
              <th>COA Date</th>
              <th>Cargo Quantity(MT)</th>
              <th>LP/DP</th>
              <th>Frt-IN /MT</th>
              <th>Frt-IN</th>
              <th>FO Surcharge</th>
              <th>Frt-OUT /MT</th>
              <th>Frt-OUT</th>
              <th>Profit</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={13} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.fcaId}>
                <td>{row.index}</td>
                <td>{`${row.coaIdentity} / ${row.coaNo}`}</td>
                <td>{row.reletNo}</td>
                <td>{row.coaDate}</td>
                <td>{row.cargoQty}</td>
                <td>{row.ports}</td>
                <td>{row.freightInPerMt}</td>
                <td>{row.freightInAmt}</td>
                <td>{row.foSurcharge}</td>
                <td>{row.freightOutPerMt}</td>
                <td>{row.freightOutAmt}</td>
                <td>{row.profit}</td>
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className={styles.actionIcon}
                    title="Edit"
                    onClick={() => navigate(`/internal-user/vc/coas/cargo-relet/${row.fcaId}`)}
                  >
                    <i className="bi bi-pencil-square" aria-hidden />
                  </button>
                  {row.canDelete ? (
                    <button
                      type="button"
                      className={`${styles.actionIcon} ${styles.actionDanger}`}
                      title="Delete"
                      onClick={() => handleDelete(row)}
                    >
                      <i className="bi bi-trash" aria-hidden />
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
    </>
  );
}

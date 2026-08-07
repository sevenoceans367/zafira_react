import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import {
  cancelCoa,
  fetchCoaNominations,
  fetchRunningCoas,
} from '../../../services/coas.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import CoaListHeaderActions from './CoaListHeaderActions.jsx';
import styles from './CoaPages.module.css';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { id: '1', name: 'Active' },
  { id: '2', name: 'Cancelled' },
  { id: 'all', name: 'All' },
];

const FLASH = {
  0: { type: 'success', text: 'COA saved successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while saving COA.' },
  2: { type: 'success', text: 'COA cancelled successfully.' },
};

export default function RunningCoasListPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [status, setStatus] = useState(searchParams.get('status') || '1');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flash = FLASH[Number(searchParams.get('msg'))];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [types, data] = await Promise.all([
        fetchVcBusinessTypes(businessType),
        fetchRunningCoas({
          selBType: businessType,
          status,
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
        }),
      ]);
      setBusinessTypes(types);
      setRows(data.records ?? []);
      setTotal(data.recordsTotal ?? 0);
    } catch (err) {
      setError(err.message || 'Failed to load running COAs.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, businessType, status]);

  const updateQuery = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  const handleCancel = async (row) => {
    const ok = await confirm({
      title: 'Cancel COA',
      message: `Cancel ${row.coaIdentity}? This cannot be undone.`,
      confirmLabel: 'Cancel COA',
    });
    if (!ok) return;
    const remarks = window.prompt('Cancellation remarks (optional):', '') ?? '';
    try {
      await cancelCoa(row.coaId, remarks);
      updateQuery({ msg: 2 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to cancel COA.');
    }
  };

  const openNominations = async (row) => {
    setModal({ loading: true, title: `${row.coaIdentity} - Nominations`, voyages: [], relets: [] });
    try {
      const data = await fetchCoaNominations(row.coaId);
      setModal({
        loading: false,
        title: `${data.coaLabel} - Nominations`,
        voyages: data.voyages || [],
        relets: data.relets || [],
        coaId: row.coaId,
      });
    } catch (err) {
      setModal(null);
      setError(err.message || 'Failed to load nominations.');
    }
  };

  return (
    <>
      <CoaListHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="COA ID, route, cargo…"
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={(value) => {
          setBusinessType(value);
          updateQuery({ selBType: value });
        }}
        statusOptions={STATUS_OPTIONS}
        status={status}
        onStatusChange={(value) => {
          setStatus(value);
          updateQuery({ status: value });
        }}
        primaryAction={{
          label: 'Add New COA',
          onClick: () => navigate(`/internal-user/vc/coas/running/add?selBType=${businessType}`),
        }}
      />

      <div className={`zafira-page ${styles.page}`}>
      <LoadingOverlay show={loading} fullScreen={false} label="Loading running COAs…" />
      {flash ? (
        <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
          {flash.text}
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>Running COAs</h3>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>COA Route</th>
              <th>COA ID</th>
              <th>COA No.</th>
              <th>COA Date</th>
              <th>Vessel Type</th>
              <th>Charterer</th>
              <th>Cargo</th>
              <th>Min Qty(MT)</th>
              <th>Duration</th>
              <th>Total Shipments</th>
              <th>Shipments Performed</th>
              <th>Balance Cargo(MT)</th>
              <th>Status</th>
              <th>Nominate</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={16} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.coaId}>
                <td>{row.index}</td>
                <td>{row.coaRoute}</td>
                <td>{row.coaIdentity}</td>
                <td>{row.coaNo}</td>
                <td>{row.coaDate}</td>
                <td>{row.vesselType}</td>
                <td>{row.charterer}</td>
                <td>{row.cargo}</td>
                <td>{row.minQty}</td>
                <td>{row.duration}</td>
                <td>{row.totalShipments}</td>
                <td>{row.shipmentsPerformed}</td>
                <td>{row.balanceCargo}</td>
                <td>
                  <span className={row.status === 'Active' ? styles.statusActive : styles.statusCancelled}>
                    {row.status}
                  </span>
                </td>
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className={styles.actionIcon}
                    title="Nominate / Details"
                    onClick={() => openNominations(row)}
                  >
                    <i className="bi bi-send" aria-hidden />
                  </button>
                </td>
                <td className={styles.actionCell}>
                  <button
                    type="button"
                    className={styles.actionIcon}
                    title="Edit"
                    onClick={() => navigate(`/internal-user/vc/coas/running/${row.coaId}`)}
                  >
                    <i className="bi bi-pencil-square" aria-hidden />
                  </button>
                  {row.canCancel ? (
                    <button
                      type="button"
                      className={`${styles.actionIcon} ${styles.actionDanger}`}
                      title="Cancel COA"
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

      {modal ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setModal(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>{modal.title}</h4>
              <Button variant="close" size="sm" label="Close" onClick={() => setModal(null)} />
            </div>
            {modal.loading ? <p>Loading…</p> : (
              <div className={styles.splitPanels}>
                <div>
                  <div className={styles.sectionTitle}>Voyages</div>
                  <div className={styles.toolbarActions} style={{ marginBottom: 8 }}>
                    <Button
                      variant="primary"
                      size="sm"
                      label="Add New Voyage"
                      onClick={() => navigate(`/internal-user/sopf/addestimate?coaid=${modal.coaId}&selBType=${businessType}`)}
                    />
                  </div>
                  <table className={styles.nestedTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Vessel</th>
                        <th>Voyage</th>
                        <th>CP Date</th>
                        <th>TCE</th>
                        <th>P/L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(modal.voyages || []).length === 0 ? (
                        <tr><td colSpan={6} className={styles.emptyCell}>No voyages</td></tr>
                      ) : modal.voyages.map((row) => (
                        <tr key={row.comId}>
                          <td>{row.index}</td>
                          <td>{row.vesselName}</td>
                          <td>
                            <Link to={`/internal-user/sopf/viewestimate?id=${row.fcaId}`}>
                              {row.voyageNo}
                            </Link>
                          </td>
                          <td>{row.cpDate}</td>
                          <td>{row.tce}</td>
                          <td>{row.profitLoss}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className={styles.sectionTitle}>Cargo Relets</div>
                  <div className={styles.toolbarActions} style={{ marginBottom: 8 }}>
                    <Button
                      variant="warning"
                      size="sm"
                      label="Add New Cargo Relet"
                      onClick={() => navigate(`/internal-user/vc/coas/cargo-relet/add?coaId=${modal.coaId}&selBType=${businessType}`)}
                    />
                  </div>
                  <table className={styles.nestedTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Relet No.</th>
                        <th>Qty</th>
                        <th>Frt-IN</th>
                        <th>Frt-OUT</th>
                        <th>Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(modal.relets || []).length === 0 ? (
                        <tr><td colSpan={6} className={styles.emptyCell}>No cargo relets</td></tr>
                      ) : modal.relets.map((row) => (
                        <tr key={row.fcaId}>
                          <td>{row.index}</td>
                          <td>
                            <Link to={`/internal-user/vc/coas/cargo-relet/${row.fcaId}`}>
                              {row.reletNo}
                            </Link>
                          </td>
                          <td>{row.cargoQty}</td>
                          <td>{row.freightInAmt}</td>
                          <td>{row.freightOutAmt}</td>
                          <td>{row.profit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
}

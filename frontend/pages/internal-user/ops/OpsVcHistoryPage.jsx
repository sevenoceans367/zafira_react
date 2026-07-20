import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import { fetchHistoryAtGlance } from '../../../services/opsVc.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import CoaCardSelect from '../coa/CoaCardSelect.jsx';
import styles from './OpsPages.module.css';

const PAGE_SIZE = 50;
const PAGE_CONTEXT = 3;
const FLASH = {
  0: { type: 'success', text: 'Vessels in History added/updated successfully.' },
  2: { type: 'success', text: 'Status changed successfully.' },
};

export default function OpsVcHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '3');
  const [searchInput, setSearchInput] = useState(searchParams.get('voy_no') || '');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
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
      const [types, data] = await Promise.all([
        fetchVcBusinessTypes(businessType),
        fetchHistoryAtGlance({
          selBType: businessType,
          search: debouncedSearch,
          page,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setBusinessTypes(types);
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
    } catch (err) {
      setError(err.message || 'Failed to load Vessels in History.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [businessType, debouncedSearch]);

  return (
    <div className={`zafira-page ${styles.page}`}>
      {loading ? <LoadingOverlay active label="Loading Vessels in History…" /> : null}
      {flash ? <div className={styles.flashSuccess}>{flash.text}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>Vessels in History - VC</h3>

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
                updateQuery({ selBType: value, msg: '' });
              }}
            />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="ops-vc-history-search">Search</label>
            <input
              id="ops-vc-history-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nom ID, voyage, vessel…"
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
              <th>VF<br />View</th>
              <th>Business Type /<br />Nom ID / Voyage No.</th>
              <th>Material<br />Name</th>
              <th>Vessel</th>
              <th>CP<br />Date</th>
              <th>Voyage<br />Financials</th>
              <th>FDA</th>
              <th>Calculations</th>
              <th>Payment /<br />Invoice</th>
              <th>Operator</th>
              <th>Chartering<br />PIC</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={12} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.comId}>
                <td className={styles.actionsCell}>
                  <Link to={appPath(`/internal-user/sopf/viewestimate?id=${row.fcaId}&rttype=4`)}>FVF</Link>
                  <span className={styles.muted}> | </span>
                  <a href={`/api/internal-user/sopf/estimate/${encodeURIComponent(row.fcaId)}/pdf`} title="Download PDF">
                    <i className="bi bi-download" aria-hidden />
                  </a>
                  <div className={styles.muted}>Docs</div>
                </td>
                <td className={styles.wrapCell}>
                  {row.businessType || '—'}
                  <br />
                  <br />
                  {row.message}
                  <br />
                  {row.voyageNo || '—'}
                  <div>
                    {row.vesselImoNo ? (
                      <Link
                        to={appPath(`/internal-user/vc/ops/voyage-report?vesselimono=${encodeURIComponent(row.vesselImoNo)}&comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}&type=VC`)}
                      >
                        Voyage Report
                      </Link>
                    ) : (
                      <span className={styles.linkMuted}>Voyage Report</span>
                    )}
                  </div>
                </td>
                <td className={styles.wrapCell}>{row.materialName || '—'}</td>
                <td className={row.isPeriod ? styles.periodVessel : undefined}>
                  {row.vesselName || '—'}
                  <br />
                  {row.vesselType || '—'}
                </td>
                <td>
                  {row.cpDate || '—'}
                  <br />
                  {row.ownBusiness || ''}
                </td>
                <td className={styles.actionsCell}>
                  {(row.costSheets || []).map((sheet) => (
                    <div key={sheet.id}>{sheet.name}</div>
                  ))}
                  {!row.costSheets?.length ? <span className={styles.muted}>—</span> : null}
                </td>
                <td><span className={styles.linkMuted}>FDA</span></td>
                <td className={styles.actionsCell}>
                  <div><span className={styles.linkMuted}>Laytime</span></div>
                  <div><span className={styles.linkMuted}>Bunkers</span></div>
                  <div><span className={styles.linkMuted}>SOA</span></div>
                </td>
                <td className={styles.actionsCell}>
                  <div><span className={styles.linkMuted}>View</span></div>
                  <div><span className={styles.linkMuted}>P &amp; I Club Declaration</span></div>
                </td>
                <td>{row.operatorName || '—'}</td>
                <td>{row.charteringTeam || '—'}</td>
                <td>{row.statusLabel || 'History'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SopfPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}

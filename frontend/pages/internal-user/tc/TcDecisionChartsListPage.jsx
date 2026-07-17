import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, PageHeaderSearch, HeaderFilterControls } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchTcDecisionCharts } from '../../../services/tcEstimates.js';
import PageHeaderActions from '../PageHeaderActions.jsx';
import SopfPagination from '../sopf/SopfPagination.jsx';
import styles from './TcPages.module.css';

const PAGE_SIZE = 10;

const FLASH = {
  3: { type: 'success', text: 'Final TC Out Estimate sent to Decision Chart successfully.' },
};

export default function TcDecisionChartsListPage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flash = FLASH[Number(searchParams.get('msg'))];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTcDecisionCharts({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
      });
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
    } catch (err) {
      setError(err.message || 'Failed to load decision charts.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  return (
    <div className={`zafira-page ${styles.page}`}>
      <PageHeaderActions deps={[searchInput]}>
        <HeaderFilterControls>
          <PageHeaderSearch value={searchInput} onChange={setSearchInput} placeholder="Search charts" />
          <Button variant="outline" label="Back" href={appPath('/internal-user/vc/tc')} />
        </HeaderFilterControls>
      </PageHeaderActions>

      {loading ? <LoadingOverlay active label="Loading decision charts…" /> : null}
      {flash ? <div className={styles.flashSuccess}>{flash.text}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>TC Decision Charts</h3>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Decision Chart</th>
              <th>Chart No.</th>
              <th>TC No.</th>
              <th>Vessel</th>
              <th>Del Port/Redel Port</th>
              <th>Add On Date</th>
              <th>Added By</th>
              <th className={styles.center}>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.message}-${row.messageNo}-${row.tcOutId}`}>
                <td>{row.index}</td>
                <td>{row.message}</td>
                <td>{row.messageNo}</td>
                <td>{row.tcNo}</td>
                <td>{row.vesselName}</td>
                <td>{row.ports}</td>
                <td>{row.addOnDate}</td>
                <td>{row.addedBy}</td>
                <td className={styles.center}>
                  <Link to={appPath(`/internal-user/vc/tc/${row.tcOutId}/view`)}>View</Link>
                </td>
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={9} className={styles.center}>No decision charts found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SopfPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}

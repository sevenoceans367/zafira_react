import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchSoaReport } from '../../../services/opsVc.js';
import OpsVcSoaReportHeaderActions from './OpsVcSoaReportHeaderActions.jsx';
import styles from './OpsPages.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

function SoaTable({ section }) {
  if (!section) return null;
  const labels = section.labels || {};
  const blocks = section.blocks || [];

  return (
    <div className={styles.tableWrap} style={{ maxHeight: 'none', marginBottom: 20 }}>
      <table className={`zafira-data-table ${styles.nestedTable}`}>
        <thead>
          <tr>
            <th colSpan={5} width="60%" />
            <th width="10%">{labels.estimated || 'Estimated (USD)'}</th>
            <th width="10%">{labels.colB}</th>
            <th width="10%">{labels.colC}</th>
            <th width="10%" style={{ color: '#b42318' }}>{labels.balance || 'Balance (USD)'}</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <React.Fragment key={block.key}>
              {(block.rows || []).map((row, index) => {
                if (row.isHeader) {
                  return (
                    <tr key={`${block.key}-h-${index}`}>
                      <th colSpan={9}><strong>{row.title}</strong></th>
                    </tr>
                  );
                }
                const cells = row.cells || [];
                return (
                  <tr key={`${block.key}-r-${index}`}>
                    <td>{row.strong ? <strong>{cells[0] || ''}</strong> : (cells[0] || '')}</td>
                    <td>{cells[1] || ''}</td>
                    <td>{cells[2] || ''}</td>
                    <td>{cells[3] || ''}</td>
                    <td>{cells[4] || ''}</td>
                    <td>{row.estimated || ''}</td>
                    <td>{row.colB || ''}</td>
                    <td>{row.colC || ''}</td>
                    <td style={row.balanceRed ? { color: '#b42318' } : undefined}>
                      {row.balance || ''}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
          <tr>
            <td colSpan={5}><strong>TOTAL</strong></td>
            <td><strong>{section.totals?.estimated || ''}</strong></td>
            <td><strong>{section.totals?.colB || ''}</strong></td>
            <td><strong>{section.totals?.colC || ''}</strong></td>
            <td style={{ color: '#b42318' }}>
              <strong>{section.totals?.balance || ''}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * PHP soa_report.php — Consolidated Statement of Accounts (SOA text).
 */
export default function OpsVcSoaReportPage() {
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!comId) {
        setError('COMID is required.');
        setData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const result = await fetchSoaReport(comId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err.message || 'Failed to load SOA report.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [comId]);

  return (
    <div className={`zafira-page ${styles.page}`}>
      <OpsVcSoaReportHeaderActions
        backHref={backHref}
        comId={comId}
        disabled={loading}
      />
      {loading ? <LoadingOverlay active label="Loading SOA report…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      {data ? (
        <>
          <h3 className={styles.title}>{data.title || 'CONSOLIDATED STATEMENT OF ACCOUNTS - VC/COA'}</h3>

          <div className={styles.formGrid} style={{ marginBottom: 16 }}>
            <div><strong>Vessel :</strong>&nbsp;&nbsp;{data.vesselName || '—'}</div>
            <div><strong>Nom ID :</strong>&nbsp;&nbsp;{data.message || '—'}</div>
            <div><strong>Voy No. :</strong>&nbsp;&nbsp;{data.voyageNo || '—'}</div>
            <div><strong>CP Date :</strong>&nbsp;&nbsp;{data.cpDate || '—'}</div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>RECEIVABLES</h4>
            <SoaTable section={data.receivables} />
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>PAYABLES</h4>
            <SoaTable section={data.payables} />
          </div>
        </>
      ) : null}

      {!loading && !error && !data ? (
        <div className={styles.empty}>No SOA report data available.</div>
      ) : null}
    </div>
  );
}

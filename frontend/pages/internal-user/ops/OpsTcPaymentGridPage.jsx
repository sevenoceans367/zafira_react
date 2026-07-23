import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchPaymentGridTc } from '../../../services/opsTc.js';
import OpsTcPaymentGridHeaderActions from './OpsTcPaymentGridHeaderActions.jsx';
import styles from './OpsPages.module.css';

/** PHP payment_grid_tc.php page=1|2|3 → In Ops / Post Ops / History */
const BACK_PATHS = {
  1: '/internal-user/vc/ops-tc/in-ops-glance',
  2: '/internal-user/vc/ops-tc/post-ops',
  3: '/internal-user/vc/ops-tc/history',
};

const VARIANT_CLASS = {
  info: styles.btnInfo,
  warning: styles.btnWarning,
  danger: styles.btnDanger,
};

function ActionButtons({ actions }) {
  if (!actions?.length) return null;
  return (
    <div className={styles.actionsCell}>
      {actions.map((action) => (
        <button
          key={`${action.key}-${action.label}-${action.vendorId || ''}-${action.invType || ''}`}
          type="button"
          className={`${styles.actionBtn} ${VARIANT_CLASS[action.variant] || styles.btnInfo}`}
          disabled={!action.enabled || !action.migrated}
          title={
            !action.migrated
              ? 'Invoice / payment form is not migrated yet'
              : action.label
          }
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

/**
 * PHP payment_grid_tc.php — Payment / Invoice Grid for Ops TC.
 * Opened from In Ops / Post Ops / History “View” under Payment / Invoices.
 */
export default function OpsTcPaymentGridPage() {
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
    if (!comId) {
      setError('COMID is required.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await fetchPaymentGridTc(comId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err.message || 'Failed to load payment / invoice grid.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [comId]);

  return (
    <>
      <OpsTcPaymentGridHeaderActions backHref={backHref} disabled={loading} />

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay active label="Loading Payment / Invoice Grid…" /> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <h3 className={styles.title}>
          Payment / Invoice Grid
          {data?.vesselName ? ` : ${data.vesselName}` : ''}
        </h3>

        {data?.tcNo ? (
          <p className={styles.muted} style={{ marginTop: 0 }}>
            TC No. {data.tcNo}
          </p>
        ) : null}

        {!loading && !error && data && !data.trips?.length ? (
          <div className={styles.empty}>
            No trip / period rows found for this nomination.
            {' '}
            <Link to={backHref}>Back</Link>
          </div>
        ) : null}

        {(data?.trips || []).map((trip) => (
          <div key={trip.slave1Id} className={styles.letterPanel} style={{ marginBottom: '1rem' }}>
            <h4 className={styles.sectionTitle}>{trip.periodLabel}</h4>
            <div className={styles.tableWrap}>
              <table className={`zafira-data-table ${styles.table}`}>
                <thead>
                  <tr>
                    <th width="15%">Name</th>
                    <th width="15%">Description</th>
                    <th width="20%">Vendor</th>
                    <th width="20%">&nbsp;</th>
                    <th width="15%">Total Payment made</th>
                    <th width="15%">Last Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(trip.lines || []).map((line) => (
                    <tr key={line.key}>
                      <td><strong>{line.name}</strong></td>
                      <td>{line.description || '—'}</td>
                      <td>{line.vendorName || '—'}</td>
                      <td><ActionButtons actions={line.actions} /></td>
                      <td>{line.totalPaid || ''}</td>
                      <td>{line.lastPaidDate || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

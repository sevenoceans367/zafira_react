import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchPaymentGridVc } from '../../../services/opsVc.js';
import OpsVcPaymentGridHeaderActions from './OpsVcPaymentGridHeaderActions.jsx';
import styles from './OpsPages.module.css';

/** PHP payment_grid.php page=1|2|3 → In Ops / Post Ops / History */
const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/post-ops',
  3: '/internal-user/vc/ops/history',
};

const VARIANT_CLASS = {
  info: styles.btnInfo,
  warning: styles.btnWarning,
  danger: styles.btnDanger,
};

function ActionButtons({ actions, badges }) {
  if (!actions?.length && !badges?.length) return null;
  return (
    <div className={styles.actionsCell}>
      {(badges || []).map((item) => (
        <span key={item.label} className={styles.badgeWarning}>{item.label}</span>
      ))}
      {(actions || []).map((action) => (
        <button
          key={`${action.key}-${action.label}-${action.vendorId || ''}`}
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

function SectionTable({ section }) {
  const showPayments = Boolean(section.columns?.showPayments);
  const showVoyageId = Boolean(section.columns?.showVoyageId);
  const lines = section.lines || [];

  if (!lines.length) {
    return (
      <div className={styles.letterPanel} style={{ marginBottom: '1rem' }}>
        <h4 className={styles.sectionTitle}>{section.periodLabel}</h4>
        <p className={styles.muted} style={{ margin: '0.5rem 0 0' }}>No rows.</p>
      </div>
    );
  }

  return (
    <div className={styles.letterPanel} style={{ marginBottom: '1rem' }}>
      <h4 className={styles.sectionTitle}>{section.periodLabel}</h4>
      <div className={styles.tableWrap}>
        <table className={`zafira-data-table ${styles.table}`}>
          <thead>
            <tr>
              <th width={showPayments ? '30%' : '45%'}>Name</th>
              <th width={showPayments ? '20%' : '25%'}>Vendor</th>
              <th width={showPayments ? '20%' : '30%'}>&nbsp;</th>
              {showPayments ? <th width="10%">Total Payment made</th> : null}
              {showPayments ? <th width="10%">Last Paid Date</th> : null}
              {showVoyageId ? <th width="10%">Voyage Id</th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((row) => {
              if (row.isGroupHeader) {
                const colSpan = 3 + (showPayments ? 2 : 0) + (showVoyageId ? 1 : 0);
                return (
                  <tr key={row.key}>
                    <td colSpan={colSpan}>
                      <strong>{row.name}</strong>
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={row.key}
                  style={row.highlight ? { color: '#c0392b' } : undefined}
                >
                  <td><strong>{row.name}</strong></td>
                  <td>{row.vendorName || ''}</td>
                  <td><ActionButtons actions={row.actions} badges={row.badges} /></td>
                  {showPayments ? <td>{row.totalPaid || ''}</td> : null}
                  {showPayments ? <td>{row.lastPaidDate || ''}</td> : null}
                  {showVoyageId ? <td>{row.voyageId || ''}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * PHP payment_grid.php — Payment / Invoice Grid for Ops VC.
 * Opened from In Ops / Post Ops / History “View” under Payment / Invoices.
 */
export default function OpsVcPaymentGridPage() {
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
        const result = await fetchPaymentGridVc(comId);
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
      <OpsVcPaymentGridHeaderActions backHref={backHref} disabled={loading} />

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay active label="Loading Payment / Invoice Grid…" /> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <h3 className={styles.title}>
          Payment / Invoice Grid
          {data?.vesselName ? ` : ${data.vesselName}` : ''}
        </h3>

        {!loading && !error && data && !(data.sections || []).some((s) => s.lines?.length) ? (
          <div className={styles.empty}>
            No payment / invoice rows found for this nomination.
            {' '}
            <Link to={backHref}>Back</Link>
          </div>
        ) : null}

        {(data?.sections || []).map((section) => (
          <SectionTable key={section.key} section={section} />
        ))}
      </div>
    </>
  );
}

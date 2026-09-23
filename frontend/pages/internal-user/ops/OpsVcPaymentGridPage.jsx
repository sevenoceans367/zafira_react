import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchPaymentGridVc } from '../../../services/opsVc.js';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import OpsVcPaymentGridHeaderActions from './OpsVcPaymentGridHeaderActions.jsx';
import styles from './OpsVcPaymentGridPage.module.css';

/** PHP payment_grid.php page=1|2|3 → In Ops / Post Ops / History */
const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

const PILL_VARIANT = {
  info: styles.miniPillBlue,
  warning: styles.miniPillOrange,
  danger: styles.miniPillRed,
};

const GRID_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

function PaymentGridHeading({ vesselName, voyageNo }) {
  const setHeading = usePageHeaderHeading();
  const subParts = [];
  if (vesselName) subParts.push(vesselName);
  if (voyageNo) subParts.push(`Voy. ${voyageNo}`);
  const subtitle = subParts.join(' · ');

  useEffect(() => {
    setHeading({
      title: (
        <span className={styles.headerTitleStack}>
          Payment / Invoice Grid
          {subtitle ? <span className={styles.titleMuted}>{subtitle}</span> : null}
        </span>
      ),
      icon: GRID_ICON,
    });
  }, [setHeading, subtitle]);

  useEffect(() => () => setHeading(null), [setHeading]);
  return null;
}

function dash(value) {
  const text = value == null ? '' : String(value).trim();
  return text || '—';
}

function lineCountLabel(count) {
  if (!count) return ' · No rows';
  return ` · ${count} line item${count === 1 ? '' : 's'}`;
}

function ActionButtons({ actions, badges, onAction }) {
  if (!actions?.length && !badges?.length) return null;

  return (
    <div className={styles.pillRow}>
      {(badges || []).map((item) => (
        <span key={item.label} className={`${styles.miniPill} ${styles.miniPillBadge}`}>
          {item.label}
        </span>
      ))}
      {(actions || []).map((action) => {
        const canOpen = Boolean(action.enabled && action.migrated && action.href);
        return (
          <button
            key={`${action.key}-${action.label}-${action.href || action.vendorId || ''}`}
            type="button"
            className={`${styles.miniPill} ${PILL_VARIANT[action.variant] || styles.miniPillBlue}`}
            disabled={!canOpen}
            title={
              canOpen
                ? action.label
                : (!action.migrated
                  ? 'Invoice / payment form is not migrated yet'
                  : action.label)
            }
            onClick={() => onAction?.(action)}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionCard({ section, index, onAction }) {
  const showPayments = Boolean(section.columns?.showPayments);
  const showVoyageId = Boolean(section.columns?.showVoyageId);
  const lines = section.lines || [];
  const count = lines.filter((row) => !row.isGroupHeader).length;

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardNum}>{index}</span>
          <div className={styles.cardTitle}>
            {section.periodLabel}
            <span className={styles.cardTitleSub}>{lineCountLabel(count)}</span>
          </div>
        </div>
      </div>

      {!count ? (
        <p className={styles.emptyNote}>No rows.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Vendor</th>
                <th aria-label="Actions" />
                {showPayments ? <th>Total Payment Made</th> : null}
                {showPayments ? <th>Last Paid Date</th> : null}
                {showVoyageId ? <th>Voyage ID</th> : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((row) => {
                if (row.isGroupHeader) {
                  const colSpan = 3 + (showPayments ? 2 : 0) + (showVoyageId ? 1 : 0);
                  return (
                    <tr key={row.key} className={styles.groupHeader}>
                      <td colSpan={colSpan}>{row.name}</td>
                    </tr>
                  );
                }
                return (
                  <tr
                    key={row.key}
                    className={row.highlight ? styles.tableRowHighlight : undefined}
                  >
                    <td className={styles.cellStrong}>{row.name}</td>
                    <td className={row.vendorName ? undefined : styles.cellMuted}>
                      {dash(row.vendorName)}
                    </td>
                    <td>
                      <ActionButtons
                        actions={row.actions}
                        badges={row.badges}
                        onAction={onAction}
                      />
                    </td>
                    {showPayments ? (
                      <td className={row.totalPaid ? undefined : styles.cellMuted}>
                        {dash(row.totalPaid)}
                      </td>
                    ) : null}
                    {showPayments ? (
                      <td className={row.lastPaidDate ? undefined : styles.cellMuted}>
                        {dash(row.lastPaidDate)}
                      </td>
                    ) : null}
                    {showVoyageId ? (
                      <td className={row.voyageId ? undefined : styles.cellMuted}>
                        {dash(row.voyageId)}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * PHP payment_grid.php — Payment / Invoice Grid for Ops VC.
 * Opened from In Ops / Post Ops / History “View” under Payment / Invoices.
 */
export default function OpsVcPaymentGridPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid')
    || searchParams.get('comId')
    || searchParams.get('COMID')
    || '';
  const page = searchParams.get('page') || '1';
  const voyageNoParam = searchParams.get('voyage_no') || searchParams.get('voyageNo') || '';

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
        const result = await fetchPaymentGridVc(comId, { page, voyageNo: voyageNoParam });
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
  }, [comId, page, voyageNoParam]);

  const handleAction = (action) => {
    if (!action?.href) return;
    if (action.href.startsWith('/')) {
      navigate(appPath(action.href));
      return;
    }
    navigate(appPath(`/${action.href.replace(/^\.?\//, '')}`));
  };

  const vesselName = data?.vesselName || '';
  const voyageNo = data?.voyageNo || voyageNoParam || '';
  const sections = data?.sections || [];

  return (
    <>
      <PaymentGridHeading vesselName={vesselName} voyageNo={voyageNo} />
      <OpsVcPaymentGridHeaderActions backHref={backHref} disabled={loading} />

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay show label="Loading Payment / Invoice Grid…" /> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        {!loading && !error && data && !sections.length ? (
          <div className={styles.empty}>
            No payment / invoice sections found for this nomination.
            {' '}
            <Link to={backHref}>Back</Link>
          </div>
        ) : null}

        {sections.map((section, index) => (
          <SectionCard
            key={section.key || section.periodLabel || index}
            section={section}
            index={index + 1}
            onAction={handleAction}
          />
        ))}
      </div>
    </>
  );
}

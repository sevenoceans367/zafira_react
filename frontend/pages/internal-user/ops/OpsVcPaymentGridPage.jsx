import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchPaymentGridVc } from '../../../services/opsVc.js';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import OpsVcPaymentGridHeaderActions from './OpsVcPaymentGridHeaderActions.jsx';
import {
  buildWaterfallSegments,
  deriveStatus,
  formatMoney,
  groupPaymentGridSections,
  pillToneClass,
  restyleActionLabel,
} from './opsVcPaymentGridModel.js';
import styles from './OpsVcPaymentGridPage.module.css';

/** PHP payment_grid.php page=1|2|3 → In Ops / Post Ops / History */
const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

const ANCHOR_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="5" r="3" />
    <path d="M12 22V8" />
    <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
  </svg>
);

function StatusChip({ tone, label }) {
  if (!label) return null;
  const toneClass = tone === 'good'
    ? styles.statusGood
    : tone === 'warn'
      ? styles.statusWarn
      : styles.statusPending;
  return (
    <span className={`${styles.statusChip} ${toneClass}`}>
      {tone === 'good' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : tone === 'warn' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      )}
      {label}
    </span>
  );
}

function PaymentGridHeading({ voyageNo, vesselName }) {
  const setHeading = usePageHeaderHeading();
  useEffect(() => {
    const hasVoyage = Boolean(voyageNo || vesselName);
    setHeading({
      title: (
        <span className={styles.headerTitleStack}>
          <span className={styles.headerTitleText}>Contract Finance</span>
          {hasVoyage ? (
            <span className={styles.headerVoyageChip}>
              {ANCHOR_ICON}
              {voyageNo ? `VOY ${voyageNo}` : 'VOY —'}
              {vesselName ? (
                <>
                  <span className={styles.vcSep}>·</span>
                  {vesselName}
                </>
              ) : null}
            </span>
          ) : null}
        </span>
      ),
    });
  }, [setHeading, voyageNo, vesselName]);
  useEffect(() => () => setHeading(null), [setHeading]);
  return null;
}

function dash(value) {
  const text = value == null ? '' : String(value).trim();
  return text || '—';
}

function ActionButtons({ actions, badges, kind, onAction }) {
  const list = actions || [];
  if (!list.length && !badges?.length) return null;
  return (
    <div className={styles.pillRow}>
      {(badges || []).map((item) => (
        <span key={item.label} className={`${styles.miniPill} ${styles.miniPillBadge}`}>
          {item.label}
        </span>
      ))}
      {list.map((action) => {
        const canOpen = Boolean(action.enabled && action.migrated && action.href);
        const label = restyleActionLabel(action.label, kind);
        return (
          <button
            key={`${action.key}-${action.label}-${action.href || action.vendorId || ''}`}
            type="button"
            className={`${styles.miniPill} ${pillToneClass(kind, action, styles)}`}
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
            {label}
          </button>
        );
      })}
    </div>
  );
}

function TotalChips({ chips }) {
  if (!chips?.length) return null;
  return (
    <div className={styles.sectionTotals}>
      {chips.map((chip) => (
        <div
          key={chip.label}
          className={`${styles.totalChip} ${chip.tone === 'good' ? styles.totalGood : styles.totalWarn}`}
        >
          <span className={styles.tcLabel}>{chip.label}</span>
          <span className={styles.tcValue}>{chip.value}</span>
        </div>
      ))}
    </div>
  );
}

function FinanceSectionCard({
  title,
  kind,
  iconClass,
  icon,
  bucket,
  columns,
  onAction,
  flashKey,
}) {
  const count = bucket.count;
  const settledLabel = kind === 'income' ? 'Collected' : 'Paid';
  const chips = [];
  if (bucket.settled > 0 || bucket.hasAmounts) {
    chips.push({
      label: settledLabel,
      value: formatMoney(bucket.settled) || '$0',
      tone: 'good',
    });
  }
  if (bucket.outstanding > 0 || (bucket.hasAmounts && bucket.openCount > 0)) {
    chips.push({
      label: 'Outstanding',
      value: formatMoney(bucket.outstanding) || '$0',
      tone: 'warn',
    });
  }

  const showDate = Boolean(columns?.showDate);
  const amountHeader = kind === 'income' ? 'Net Amount ($)' : 'Amount ($)';

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <span className={`${styles.cardNum} ${iconClass}`}>{icon}</span>
          <div className={styles.cardTitle}>
            {title}
            <span className={styles.cardTitleSub}>
              {count ? ` · ${count} item${count === 1 ? '' : 's'}` : ' · No rows'}
            </span>
          </div>
        </div>
        <TotalChips chips={chips} />
      </div>

      {!count ? (
        <p className={styles.emptyNote}>No rows.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{kind === 'income' ? 'Income Type' : 'Expense Type'}</th>
                <th>Customer</th>
                <th>{kind === 'income' ? 'Invoice' : 'Payment'}</th>
                <th>{amountHeader}</th>
                {showDate ? <th>Date Paid</th> : null}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bucket.lines.map((row) => {
                if (row.isGroupHeader) {
                  const colSpan = 4 + (showDate ? 1 : 0) + 1;
                  return (
                    <tr key={row.key} className={styles.groupHeader}>
                      <td colSpan={colSpan}>{row.name}</td>
                    </tr>
                  );
                }
                const rowKind = row.lineKind || kind;
                const status = deriveStatus(row, rowKind);
                const amountText = formatMoney(row.amountValue)
                  || formatMoney(row.netAmount)
                  || formatMoney(row.amount)
                  || formatMoney(row.totalPaid);
                return (
                  <tr
                    key={row.key}
                    id={`cf-row-${row.key}`}
                    className={[
                      row.highlight ? styles.tableRowHighlight : '',
                      flashKey === row.key ? styles.rowFlash : '',
                    ].filter(Boolean).join(' ') || undefined}
                  >
                    <td className={styles.cellStrong}>{row.name}</td>
                    <td className={row.vendorName ? undefined : styles.cellMuted}>
                      {dash(row.vendorName)}
                    </td>
                    <td>
                      <ActionButtons
                        actions={row.displayActions ?? row.actions}
                        badges={row.badges}
                        kind={rowKind}
                        onAction={onAction}
                      />
                    </td>
                    <td className={amountText ? undefined : styles.cellMuted}>
                      {dash(amountText)}
                    </td>
                    {showDate ? (
                      <td className={row.lastPaidDate ? undefined : styles.cellMuted}>
                        {dash(row.lastPaidDate)}
                      </td>
                    ) : null}
                    <td>
                      <StatusChip tone={status.tone} label={status.label} />
                    </td>
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

const WF_KIND_CLASS = {
  income: styles.wfIncome,
  expense: styles.wfExpense,
  hire: styles.wfHire,
  net: styles.wfNet,
};

function WaterfallCard({ segments, onSegmentClick }) {
  const [tip, setTip] = useState(null);

  const showTip = (seg, x, y) => {
    setTip({
      x,
      y,
      value: formatMoney(seg.amount, { signed: seg.kind === 'net' }) || String(seg.amount ?? ''),
      label: seg.status ? `${seg.label} · ${seg.status}` : seg.label,
    });
  };

  const renderTrack = (segs) => (
    <div className={styles.wfTrack}>
      {segs.map((seg) => (
        <div
          key={seg.id}
          className={`${styles.wfSeg} ${WF_KIND_CLASS[seg.kind] || ''}`}
          style={{ flexBasis: seg.basis }}
          role={seg.clickable === false ? undefined : 'button'}
          tabIndex={seg.clickable === false ? undefined : 0}
          onMouseMove={(e) => showTip(seg, e.clientX + 14, e.clientY + 14)}
          onMouseLeave={() => setTip(null)}
          onFocus={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            showTip(seg, r.left, r.bottom + 8);
          }}
          onBlur={() => setTip(null)}
          onClick={() => {
            if (seg.clickable === false) return;
            onSegmentClick?.(seg.id);
          }}
          onKeyDown={(e) => {
            if (seg.clickable === false) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSegmentClick?.(seg.id);
            }
          }}
        />
      ))}
    </div>
  );

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <span className={`${styles.cardNum} ${styles.cardNumTeal}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 2.5v4.3" />
              <path d="M9.3 4.8L12 6.8l2.7-2" />
              <rect x="3.2" y="9" width="17.6" height="10.5" rx="2.2" />
            </svg>
          </span>
          <div className={styles.cardTitle}>Income vs Expenses</div>
        </div>
      </div>
      {!segments.hasData ? (
        <p className={styles.emptyNote}>Amount breakdown appears when line amounts are available.</p>
      ) : (
        <>
          <div className={styles.wfLegend}>
            <span className={styles.lgItem}><span className={`${styles.lgSwatch} ${styles.lgIncome}`} />Income</span>
            <span className={styles.lgItem}><span className={`${styles.lgSwatch} ${styles.lgExpense}`} />Expenses</span>
            <span className={styles.lgItem}><span className={`${styles.lgSwatch} ${styles.lgHire}`} />Hire</span>
            <span className={styles.lgItem}><span className={`${styles.lgSwatch} ${styles.lgNet}`} />Net Result</span>
          </div>
          <div className={styles.wfRow}>
            <span className={styles.wfRowLabel}>Income</span>
            {renderTrack(segments.income)}
          </div>
          <div className={styles.wfRow}>
            <span className={styles.wfRowLabel}>Expenses</span>
            {renderTrack(segments.expenses)}
          </div>
        </>
      )}
      {tip ? (
        <div className={styles.wfTooltip} style={{ left: tip.x, top: tip.y }}>
          <span className={styles.wtValue}>{tip.value}</span>
          <span className={styles.wtLabel}>{tip.label}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * PHP payment_grid.php — Contract Finance for Ops VC.
 * Opened from In Ops / Post Ops / History F&A chip under Contract Finance.
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
  const [flashKey, setFlashKey] = useState('');
  const flashTimer = useRef(null);

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  const cashHref = useMemo(() => {
    if (!comId) return '';
    const params = new URLSearchParams();
    params.set('comid', comId);
    params.set('page', String(page || '1'));
    if (voyageNoParam) params.set('voyage_no', voyageNoParam);
    return appPath(`/internal-user/vc/ops/soa-report?${params.toString()}`);
  }, [comId, page, voyageNoParam]);

  useEffect(() => {
    if (!comId) {
      setError('COMID is required.');
      setLoading(false);
      return undefined;
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

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

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

  const model = useMemo(() => groupPaymentGridSections(sections), [sections]);
  const waterfall = useMemo(() => buildWaterfallSegments(model), [model]);

  const handleSegmentClick = (rowKey) => {
    const el = document.getElementById(`cf-row-${rowKey}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashKey(rowKey);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashKey(''), 1100);
  };

  const kpis = model.kpis;
  const incomeStatus = kpis.incomeOpen ? { label: 'Outstanding', tone: 'warn' } : { label: 'Collected', tone: 'good' };
  const expenseStatus = kpis.expenseOpen ? { label: 'Due Soon', tone: 'warn' } : { label: 'Paid', tone: 'good' };
  const netPos = kpis.net >= 0;

  const incomeIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 2.5v4.3" />
      <path d="M9.3 4.8L12 6.8l2.7-2" />
      <rect x="3.2" y="9" width="17.6" height="10.5" rx="2.2" />
    </svg>
  );
  const expenseIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M18.5 8.5A8 8 0 1 1 12.3 4" />
      <path d="M15.5 4h4v4" />
      <path d="M12 8.3v7.4" />
    </svg>
  );

  return (
    <>
      <PaymentGridHeading voyageNo={voyageNo} vesselName={vesselName} />
      <OpsVcPaymentGridHeaderActions
        backHref={backHref}
        cashHref={cashHref}
        disabled={loading}
      />

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay show label="Loading Contract Finance…" /> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        {!loading && !error && data ? (
          <>
            <div className={styles.summaryTiles}>
              <div className={`${styles.summaryTile} ${styles.tileTeal}`}>
                <div className={styles.stHead}>
                  <span className={styles.stIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 4v16" />
                      <path d="M17 15l-5 5-5-5" />
                    </svg>
                  </span>
                  <span className={styles.stLabel}>Total Income</span>
                </div>
                <div className={styles.stValue}>{formatMoney(kpis.incomeTotal) || '$0'}</div>
                <div className={styles.stSub}>{kpis.incomeCount} item{kpis.incomeCount === 1 ? '' : 's'}</div>
                <StatusChip {...incomeStatus} />
              </div>

              <div className={`${styles.summaryTile} ${styles.tileOrange}`}>
                <div className={styles.stHead}>
                  <span className={styles.stIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 20V4" />
                      <path d="M7 9l5-5 5 5" />
                    </svg>
                  </span>
                  <span className={styles.stLabel}>Total Expenses</span>
                </div>
                <div className={styles.stValue}>{formatMoney(kpis.expenseTotal) || '$0'}</div>
                <div className={styles.stSub}>
                  {model.expenses.count} item{model.expenses.count === 1 ? '' : 's'}
                  {model.hireage.count
                    ? ` (incl. ${model.hireage.count} hire)`
                    : ''}
                </div>
                <StatusChip {...expenseStatus} />
              </div>

              <div className={`${styles.summaryTile} ${netPos ? styles.tileNetPos : styles.tileNetNeg}`}>
                <div className={styles.stHead}>
                  <span className={styles.stIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4 15l5-5 4 4 7-8" />
                      <path d="M15 6h5v5" />
                    </svg>
                  </span>
                  <span className={styles.stLabel}>Net Result</span>
                </div>
                <div className={styles.stValue}>{formatMoney(kpis.net, { signed: true }) || '$0'}</div>
              </div>

              <div className={`${styles.summaryTile} ${styles.tileNavy}`}>
                <div className={styles.stHead}>
                  <span className={styles.stIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4.5 16a8 8 0 1 1 15 0" />
                      <path d="M12 13l3.2-3.2" />
                      <circle cx="12" cy="13" r="1.1" fill="currentColor" stroke="none" />
                    </svg>
                  </span>
                  <span className={styles.stLabel}>TCE</span>
                </div>
                <div className={styles.stValue}>—</div>
                <div className={styles.stSub}>Voyage days not available yet</div>
              </div>
            </div>

            <WaterfallCard segments={waterfall} onSegmentClick={handleSegmentClick} />

            <FinanceSectionCard
              title="Income"
              kind="income"
              iconClass={styles.cardNumTeal}
              icon={incomeIcon}
              bucket={model.income}
              columns={{ showDate: false }}
              onAction={handleAction}
              flashKey={flashKey}
            />
            <FinanceSectionCard
              title="Expenses"
              kind="expense"
              iconClass={styles.cardNumOrange}
              icon={expenseIcon}
              bucket={model.expenses.table}
              columns={{ showDate: true }}
              onAction={handleAction}
              flashKey={flashKey}
            />
          </>
        ) : null}

        {!loading && !error && data && !sections.length ? (
          <div className={styles.empty}>
            No payment / invoice sections found for this nomination.
            {' '}
            <Link to={backHref}>Back</Link>
          </div>
        ) : null}
      </div>
    </>
  );
}

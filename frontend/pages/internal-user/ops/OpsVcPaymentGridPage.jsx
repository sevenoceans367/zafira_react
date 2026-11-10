import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchPaymentGridVc } from '../../../services/opsVc.js';
import { getFixtureTypeLabel } from '../sopf/estimateDetail.constants.js';
import OpsVcPaymentGridHeaderActions from './OpsVcPaymentGridHeaderActions.jsx';
import VoyageOpsHeading from './VoyageOpsHeading.jsx';
import {
  buildWaterfallSegments,
  buildWaterfallSegmentsVcIn,
  deriveStatus,
  formatMoney,
  groupPaymentGridSections,
  groupPaymentGridSectionsVcIn,
  isVcInFixtureTypeId,
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
            className={`${styles.miniPill} ${pillToneClass(kind, { ...action, label }, styles)}`}
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
  labels = {},
}) {
  const count = bucket.count;
  const settledLabel = labels.settled
    || (kind === 'income' ? 'Collected' : 'Paid');
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
  const typeHeader = labels.typeHeader
    || (kind === 'income' ? 'Income Type' : 'Expense Type');
  const partyHeader = labels.partyHeader || 'Customer';
  const actionHeader = labels.actionHeader
    || (kind === 'income' ? 'Invoice' : 'Payment');
  const amountHeader = labels.amountHeader
    || (kind === 'income' ? 'Net Amount ($)' : 'Amount ($)');

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
                <th>{typeHeader}</th>
                <th>{partyHeader}</th>
                <th>{actionHeader}</th>
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
  others: styles.wfOthers,
  hire: styles.wfHire,
  net: styles.wfNet,
};

function WaterfallCard({ segments, onSegmentClick, mode = 'spot' }) {
  const [tip, setTip] = useState(null);
  const isVcIn = mode === 'vcin';

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
      {(segs || []).map((seg) => (
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
          <span className={`${styles.cardNum} ${isVcIn ? styles.cardNumOrange : styles.cardNumTeal}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M12 2.5v4.3" />
              <path d="M9.3 4.8L12 6.8l2.7-2" />
              <rect x="3.2" y="9" width="17.6" height="10.5" rx="2.2" />
            </svg>
          </span>
          <div className={styles.cardTitle}>
            {isVcIn ? 'Freight & Demurrage Expenses vs Others' : 'Income vs Expenses'}
          </div>
        </div>
      </div>
      {!segments.hasData ? (
        <p className={styles.emptyNote}>Amount breakdown appears when line amounts are available.</p>
      ) : isVcIn ? (
        <>
          <div className={styles.wfLegend}>
            <span className={styles.lgItem}>
              <span className={`${styles.lgSwatch} ${styles.lgExpense}`} />
              Freight &amp; Demurrage
            </span>
            <span className={styles.lgItem}>
              <span className={`${styles.lgSwatch} ${styles.lgOthers}`} />
              Others
            </span>
          </div>
          <div className={styles.wfRow}>
            <span className={styles.wfRowLabel}>Freight &amp; Dem.</span>
            {renderTrack(segments.freight)}
          </div>
          <div className={styles.wfRow}>
            <span className={styles.wfRowLabel}>Others</span>
            {renderTrack(segments.others)}
          </div>
        </>
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
  const costSheetId = data?.costSheetId || '';
  const sections = data?.sections || [];
  const isVcIn = isVcInFixtureTypeId(data?.fixtureTypeId);
  const contractType = getFixtureTypeLabel(data?.fixtureTypeId);
  const financeBreadcrumbs = useMemo(() => ([
    { label: 'SOC', href: appPath('/internal-user/vc') },
    { label: 'Spot Ops', href: appPath('/internal-user/vc/ops/in-ops-glance') },
    { label: 'Contract Finance' },
  ]), []);
  const paymentsCrumb = contractType ? `${contractType} Payments` : 'Payments';
  const worksheetHref = comId && costSheetId
    ? appPath(`/internal-user/vc/ops/cost-sheet?comid=${encodeURIComponent(comId)}&cost_sheet_id=${encodeURIComponent(costSheetId)}&page=${encodeURIComponent(page || '1')}`)
    : '';

  const model = useMemo(() => (
    isVcIn
      ? groupPaymentGridSectionsVcIn(sections, { totalDays: data?.totalDays })
      : groupPaymentGridSections(sections, { totalDays: data?.totalDays })
  ), [sections, isVcIn, data?.totalDays]);

  const waterfall = useMemo(() => (
    isVcIn ? buildWaterfallSegmentsVcIn(model) : buildWaterfallSegments(model)
  ), [model, isVcIn]);

  const handleSegmentClick = (rowKey) => {
    const el = document.getElementById(`cf-row-${rowKey}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashKey(rowKey);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashKey(''), 1100);
  };

  const kpis = model.kpis;
  const netPos = Number(kpis.net) >= 0;
  const hireCount = Number(kpis.hireCount) || 0;
  const expenseOnlyCount = Number(kpis.expenseOnlyCount) || 0;
  const expenseSub = hireCount > 0
    ? `${expenseOnlyCount} expense${expenseOnlyCount === 1 ? '' : 's'} + ${hireCount} hire item${hireCount === 1 ? '' : 's'}`
    : `${Number(kpis.expenseCount) || 0} expense${(Number(kpis.expenseCount) || 0) === 1 ? '' : 's'}`;
  const incomeSub = `${Number(kpis.incomeCount) || 0} line item${(Number(kpis.incomeCount) || 0) === 1 ? '' : 's'}`;
  const tceValue = kpis.tce != null
    ? `${formatMoney(kpis.tce) || '$0'}/day`
    : '—';

  const summaryTiles = (
    <div className={styles.summaryTiles}>
      <div className={`${styles.summaryTile} ${styles.tileTeal}`}>
        <div className={styles.stHead}>
          <span className={styles.stIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v16" />
              <path d="M17 15l-5 5-5-5" />
            </svg>
          </span>
          <span className={styles.stLabel}>Total Income</span>
        </div>
        <div className={styles.stValue}>{formatMoney(kpis.incomeTotal) || '$0'}</div>
        <div className={styles.stSub}>{incomeSub}</div>
      </div>

      <div className={`${styles.summaryTile} ${styles.tileOrange}`}>
        <div className={styles.stHead}>
          <span className={styles.stIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20V4" />
              <path d="M7 9l5-5 5 5" />
            </svg>
          </span>
          <span className={styles.stLabel}>Total Expenses</span>
        </div>
        <div className={styles.stValue}>{formatMoney(kpis.expenseTotal) || '$0'}</div>
        <div className={styles.stSub}>{expenseSub}</div>
      </div>

      <div className={`${styles.summaryTile} ${netPos ? styles.tileNetPos : styles.tileNetNeg}`}>
        <div className={styles.stHead}>
          <span className={styles.stIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 15l5-5 4 4 7-8" />
              <path d="M15 6h5v5" />
            </svg>
          </span>
          <span className={styles.stLabel}>Net Result</span>
        </div>
        <div className={styles.stValue}>{formatMoney(kpis.net, { signed: true }) || '$0'}</div>
        <div className={styles.stSub}>Income − Expenses (incl. Hire)</div>
      </div>

      <div className={`${styles.summaryTile} ${styles.tileNavy}`}>
        <div className={styles.stHead}>
          <span className={styles.stIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.5 16a8 8 0 1 1 15 0" />
              <path d="M12 13l3.2-3.2" />
              <circle cx="12" cy="13" r="1.1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className={styles.stLabel}>TCE</span>
        </div>
        <div className={styles.stValue}>{tceValue}</div>
      </div>
    </div>
  );

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

  const vcinExpenseLabels = {
    settled: 'Paid',
    typeHeader: 'Expense Type',
    partyHeader: 'Customer',
    actionHeader: 'Payment',
    amountHeader: 'Amount ($)',
  };

  return (
    <>
      <VoyageOpsHeading
        title="Contract Finance"
        contractType={contractType}
        voyageNo={voyageNo}
        vesselName={vesselName}
        worksheetHref={worksheetHref}
        breadcrumbs={financeBreadcrumbs}
        currentPage={paymentsCrumb}
      />
      <OpsVcPaymentGridHeaderActions
        backHref={backHref}
        cashHref={cashHref}
        disabled={loading}
      />

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay show label="Loading Contract Finance…" /> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        {!loading && !error && data ? (
          isVcIn ? (
            <>
              {summaryTiles}

              <WaterfallCard
                mode="vcin"
                segments={waterfall}
                onSegmentClick={handleSegmentClick}
              />

              <FinanceSectionCard
                title="Freight & Demurrage Expenses"
                kind="expense"
                iconClass={styles.cardNumOrange}
                icon={expenseIcon}
                bucket={model.freightDem}
                columns={{ showDate: false }}
                labels={vcinExpenseLabels}
                onAction={handleAction}
                flashKey={flashKey}
              />
              <FinanceSectionCard
                title="Others"
                kind="expense"
                iconClass={styles.cardNumOrange}
                icon={expenseIcon}
                bucket={model.others}
                columns={{ showDate: true }}
                labels={vcinExpenseLabels}
                onAction={handleAction}
                flashKey={flashKey}
              />
            </>
          ) : (
            <>
              {summaryTiles}

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
          )
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

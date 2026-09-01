import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchSoaReport } from '../../../services/opsVc.js';
import OpsVcSoaReportHeaderActions from './OpsVcSoaReportHeaderActions.jsx';
import styles from './OpsVcSoaReportPage.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

function parseMoney(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function formatUsd(value) {
  const n = typeof value === 'number' ? value : parseMoney(value);
  if (n == null) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCell(value) {
  if (value == null || value === '') return '—';
  return String(value);
}

function balanceKind(balance, { balanceRed } = {}) {
  const n = parseMoney(balance);
  if (n == null || (n === 0 && !balanceRed && (balance === '' || balance == null))) {
    return 'settled';
  }
  if (n === 0) return 'settled';
  if (n > 0 || balanceRed) return 'owed';
  return 'credit';
}

function BalanceFlag({ balance, balanceRed = false, withLabel = false }) {
  if (balance == null || balance === '') {
    return <span className={styles.balFlagSettled}>—</span>;
  }
  const kind = balanceKind(balance, { balanceRed });
  const className = [
    styles.balFlag,
    kind === 'owed' ? styles.balFlagOwed : null,
    kind === 'settled' ? styles.balFlagSettled : null,
    kind === 'credit' ? styles.balFlagCredit : null,
  ].filter(Boolean).join(' ');

  const label = kind === 'owed' ? 'Outstanding' : kind === 'credit' ? 'Credit' : 'No Activity';

  return (
    <span className={className}>
      {kind === 'owed' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      ) : kind === 'credit' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M6 12h12" />
        </svg>
      )}
      {formatCell(balance)}
      {withLabel ? ` · ${label}` : null}
    </span>
  );
}

function TrendBadge({ kind, label }) {
  const className = [
    styles.cfTrend,
    kind === 'owed' ? styles.cfTrendOwed : null,
    kind === 'settled' ? styles.cfTrendSettled : null,
    kind === 'credit' ? styles.cfTrendCredit : null,
  ].filter(Boolean).join(' ');

  return (
    <span className={className}>
      {kind === 'owed' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      ) : kind === 'credit' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M6 12h12" />
        </svg>
      )}
      {label}
    </span>
  );
}

/** Pair label/value cells into a Basis / Rate string. */
function formatBasis(cells) {
  const rest = (cells || []).slice(1).map((c) => String(c ?? '').trim()).filter(Boolean);
  if (!rest.length) return '';

  const parts = [];
  for (let i = 0; i < rest.length; i += 1) {
    const cur = rest[i];
    const next = rest[i + 1];
    const curIsLabel = next != null
      && !/^[\d.,+\-]+$/.test(cur)
      && (/rate|qty|days|demm|comm|grade|mt|%|lump/i.test(cur) || /^[\d.,+\-]+/.test(next));
    if (curIsLabel) {
      parts.push(`${cur} ${next}`);
      i += 1;
    } else {
      parts.push(cur);
    }
  }
  return parts.join(' · ');
}

function mapLineRow(row) {
  const cells = (row.cells || []).map((c) => String(c ?? '').trim());
  const hasAmounts = Boolean(row.estimated || row.colB || row.colC || row.balance);
  const firstEmpty = !cells[0];
  const trailingLabel = cells[4] || '';
  const isSubtotal = Boolean(row.strong)
    || (firstEmpty && hasAmounts)
    || (firstEmpty && trailingLabel);

  let description = cells[0];
  let basis = formatBasis(cells);

  if (!description && trailingLabel) {
    description = trailingLabel;
    basis = cells.slice(1, 4).filter(Boolean).join(' · ');
  }

  if (isSubtotal && !description) {
    description = 'Subtotal';
    basis = '';
  }

  // Freight qty row → read as freight line item
  if (/^qty$/i.test(cells[0] || '')) {
    description = 'Freight';
    const qty = cells[1] ? `Qty ${cells[1]}` : 'Qty';
    const level = cells[2] || '';
    const rate = cells[3] || '';
    basis = [qty, level && rate ? `${level} ${rate}` : level || rate].filter(Boolean).join(' · ');
  }

  return {
    type: isSubtotal ? 'subtotal' : 'line',
    description: description || '—',
    basis,
    estimated: row.estimated,
    colB: row.colB,
    colC: row.colC,
    balance: row.balance,
    balanceRed: Boolean(row.balanceRed),
  };
}

function sectionHasActivity(section) {
  const bal = parseMoney(section?.totals?.balance) || 0;
  const colB = parseMoney(section?.totals?.colB) || 0;
  const colC = parseMoney(section?.totals?.colC) || 0;
  const est = parseMoney(section?.totals?.estimated) || 0;
  return bal !== 0 || colB !== 0 || colC !== 0 || est !== 0;
}

function collectionPct(section) {
  const invoiced = parseMoney(section?.totals?.colB) || 0;
  const received = parseMoney(section?.totals?.colC) || 0;
  if (invoiced <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((received / invoiced) * 100)));
}

function buildKpis(receivables, payables) {
  const recvBal = parseMoney(receivables?.totals?.balance) || 0;
  const payBal = parseMoney(payables?.totals?.balance) || 0;
  const recvInvoiced = parseMoney(receivables?.totals?.colB) || 0;
  const recvReceived = parseMoney(receivables?.totals?.colC) || 0;
  const payPo = parseMoney(payables?.totals?.colB) || 0;
  const payPaid = parseMoney(payables?.totals?.colC) || 0;
  const net = recvBal - payBal;

  const recvActive = sectionHasActivity(receivables);
  const payActive = sectionHasActivity(payables);

  return {
    receivables: {
      value: recvBal,
      sub: recvActive
        ? `${formatUsd(recvReceived)} received of ${formatUsd(recvInvoiced)} invoiced`
        : 'No receivables activity yet',
      trend: recvBal > 0 ? 'owed' : recvActive ? 'settled' : 'settled',
      trendLabel: recvBal > 0 ? 'Outstanding' : recvActive ? 'Settled' : 'No Activity',
    },
    payables: {
      value: payBal,
      sub: payActive
        ? `${formatUsd(payPaid)} paid of ${formatUsd(payPo)} PO made`
        : 'No purchase orders raised yet',
      trend: payBal > 0 ? 'owed' : 'settled',
      trendLabel: payBal > 0 ? 'Outstanding' : 'No Activity',
    },
    net: {
      value: net,
      sub: 'Receivables balance less Payables balance',
      trend: net > 0 ? 'credit' : net < 0 ? 'owed' : 'settled',
      trendLabel: net > 0 ? 'In Our Favor' : net < 0 ? 'We Owe' : 'Settled',
    },
  };
}

function SoaSectionTable({ section, variant }) {
  if (!section) return null;
  const labels = section.labels || {};
  const blocks = section.blocks || [];
  const pct = collectionPct(section);
  const active = sectionHasActivity(section);
  const isReceivable = variant === 'receivable';

  return (
    <div className={styles.cfSection}>
      <div className={`${styles.cfSectionHead} ${isReceivable ? styles.cfSectionHeadReceivable : styles.cfSectionHeadPayable}`}>
        <div className={styles.cfSectionTitleWrap}>
          <div className={`${styles.sectionIco} ${isReceivable ? styles.sectionIcoTeal : styles.sectionIcoOrange}`}>
            {isReceivable ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3v12" />
                <path d="M7 10l5 5 5-5" />
                <path d="M4 19h16" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 21V9" />
                <path d="M17 14l-5-5-5 5" />
                <path d="M4 5h16" />
              </svg>
            )}
          </div>
          <div>
            <div className={styles.cfSectionTitle}>{isReceivable ? 'Receivables' : 'Payables'}</div>
            <div className={styles.cfSectionSub}>
              {isReceivable ? 'Money owed to us for this voyage' : 'Money owed by us for this voyage'}
            </div>
          </div>
        </div>
        {active ? (
          <div className={styles.cfProgressWrap}>
            <div className={styles.cfProgress}>
              <div
                className={`${styles.cfProgressFill} ${isReceivable ? styles.cfProgressFillReceivable : styles.cfProgressFillPayable}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={styles.cfProgressLabel}>
              {pct}% {isReceivable ? 'Collected' : 'Paid'}
            </span>
          </div>
        ) : (
          <span className={styles.cfNoflow}>
            {isReceivable ? 'No collections yet' : 'No obligations raised yet'}
          </span>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.cfTable}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Basis / Rate</th>
              <th className={styles.num}>{labels.estimated || 'Estimated (USD)'}</th>
              <th className={styles.num}>{labels.colB || (isReceivable ? 'Invoiced (USD)' : 'PO Made (USD)')}</th>
              <th className={styles.num}>{labels.colC || (isReceivable ? 'Received (USD)' : 'Paid (USD)')}</th>
              <th className={styles.num}>{labels.balance || 'Balance (USD)'}</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => {
              const rows = block.rows || [];
              const dataRows = rows.filter((r) => !r.isHeader);
              const onlyEmpty = dataRows.length === 0;

              return (
                <React.Fragment key={block.key}>
                  {rows.map((row, index) => {
                    if (row.isHeader) {
                      return (
                        <tr key={`${block.key}-h-${index}`} className={styles.grpRow}>
                          <td colSpan={6}>{row.title}</td>
                        </tr>
                      );
                    }
                    const mapped = mapLineRow(row);
                    return (
                      <tr
                        key={`${block.key}-r-${index}`}
                        className={mapped.type === 'subtotal' ? styles.cfSubRow : undefined}
                      >
                        <td className={styles.desc}>{mapped.description}</td>
                        <td className={styles.basis}>{mapped.basis || ''}</td>
                        <td className={styles.num}>{formatCell(mapped.estimated)}</td>
                        <td className={styles.num}>{formatCell(mapped.colB)}</td>
                        <td className={styles.num}>{formatCell(mapped.colC)}</td>
                        <td className={styles.num}>
                          {mapped.balance || mapped.type === 'subtotal' ? (
                            <BalanceFlag balance={mapped.balance || '0.00'} balanceRed={mapped.balanceRed} />
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {onlyEmpty ? (
                    <tr className={styles.cfEmptyRow}>
                      <td colSpan={6}>No entries recorded</td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
            <tr className={styles.cfTotalRow}>
              <td className={styles.totLabel} colSpan={2}>Total</td>
              <td className={styles.num}>{formatCell(section.totals?.estimated)}</td>
              <td className={styles.num}>{formatCell(section.totals?.colB)}</td>
              <td className={styles.num}>{formatCell(section.totals?.colC)}</td>
              <td className={styles.num}>
                <BalanceFlag
                  balance={section.totals?.balance || '0.00'}
                  balanceRed
                  withLabel
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Spot Ops Cashflow — Consolidated Statement of Accounts (legacy soa_report.php).
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

  const kpis = useMemo(
    () => (data ? buildKpis(data.receivables, data.payables) : null),
    [data],
  );

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
          setError(err.message || 'Failed to load Cashflow report.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [comId]);

  const voyLabel = [data?.voyageNo, data?.vesselName].filter(Boolean).join(' · ') || '—';

  return (
    <div className={`zafira-page ${styles.page}`}>
      <OpsVcSoaReportHeaderActions
        backHref={backHref}
        comId={comId}
        disabled={loading}
      />
      {loading ? <LoadingOverlay active label="Loading Cashflow…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      {data ? (
        <>
          <div className={styles.pageSubhead}>
            Consolidated statement of accounts
            <span className={styles.tagSoft}>VC / COA</span>
          </div>

          <div className={styles.voyidCard}>
            <div className={styles.voyidLeft}>
              <div className={styles.voyChip}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="5" r="2.2" />
                  <path d="M12 7.2V21" />
                  <path d="M8 10h8" />
                  <path d="M4 13a8 8 0 0 0 16 0" />
                </svg>
                {voyLabel.includes(' · ') ? (
                  <>
                    {data.voyageNo || '—'}
                    <span className={styles.vcSep}>·</span>
                    {data.vesselName || '—'}
                  </>
                ) : (
                  voyLabel
                )}
              </div>
            </div>
            <div className={styles.voyidSpecs}>
              <div className={styles.voyidSpec}>
                <label>CP Date</label>
                <span className={styles.val}>{data.cpDate || '—'}</span>
              </div>
            </div>
          </div>

          {kpis ? (
            <div className={styles.cfKpiGrid}>
              <div className={`${styles.cfKpi} ${styles.cfKpiReceivable}`}>
                <div className={styles.cfKpiLabel}>
                  <span className={styles.cfKpiIco}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 3v12" />
                      <path d="M7 10l5 5 5-5" />
                      <path d="M4 19h16" />
                    </svg>
                  </span>
                  Receivables Balance
                </div>
                <div className={styles.cfKpiValue}>{formatUsd(kpis.receivables.value)}</div>
                <div className={styles.cfKpiSub}>{kpis.receivables.sub}</div>
                <TrendBadge kind={kpis.receivables.trend} label={kpis.receivables.trendLabel} />
              </div>

              <div className={`${styles.cfKpi} ${styles.cfKpiPayable}`}>
                <div className={styles.cfKpiLabel}>
                  <span className={styles.cfKpiIco}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 21V9" />
                      <path d="M17 14l-5-5-5 5" />
                      <path d="M4 5h16" />
                    </svg>
                  </span>
                  Payables Balance
                </div>
                <div className={styles.cfKpiValue}>{formatUsd(kpis.payables.value)}</div>
                <div className={styles.cfKpiSub}>{kpis.payables.sub}</div>
                <TrendBadge kind={kpis.payables.trend} label={kpis.payables.trendLabel} />
              </div>

              <div className={`${styles.cfKpi} ${styles.cfKpiNet}`}>
                <div className={styles.cfKpiLabel}>
                  <span className={styles.cfKpiIco}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 17l6-6 4 4 8-8" />
                      <path d="M15 7h6v6" />
                    </svg>
                  </span>
                  Net Position
                </div>
                <div className={styles.cfKpiValue}>{formatUsd(kpis.net.value)}</div>
                <div className={styles.cfKpiSub}>{kpis.net.sub}</div>
                <TrendBadge kind={kpis.net.trend} label={kpis.net.trendLabel} />
              </div>
            </div>
          ) : null}

          <SoaSectionTable section={data.receivables} variant="receivable" />
          <SoaSectionTable section={data.payables} variant="payable" />
        </>
      ) : null}

      {!loading && !error && !data ? (
        <div className={styles.empty}>No Cashflow data available.</div>
      ) : null}
    </div>
  );
}

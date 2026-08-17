import React, { useMemo, useState } from 'react';
import { DEMO_BADGE, REVENUE_BY_TYPE, REVENUE_DRILL, TYPE_MIX } from './dashboardDemoData.js';
import styles from './VcDashboardPage.module.css';

function DemoBadge() {
  return <span className={styles.demoBadge}>{DEMO_BADGE}</span>;
}

export function ChartCard({ title, sub, children, actions = null, className = '' }) {
  return (
    <div className={`${styles.card} ${className}`.trim()}>
      <div className={styles.cardHead}>
        <div>
          <h4 className={styles.cardTitle}>
            {title}
            {sub ? <span className={styles.cardSub}>{sub}</span> : null}
          </h4>
        </div>
        <div className={styles.cardHeadRight}>
          {actions}
          <DemoBadge />
        </div>
      </div>
      {children}
    </div>
  );
}

export function SparklineSummaryCard({ label, count, valueLabel, marginPct, tone, series, color }) {
  const path = useMemo(() => {
    if (!series?.length) return '';
    const max = Math.max(...series, 1);
    const w = 160;
    const h = 54;
    return series
      .map((v, i) => {
        const x = (i / (series.length - 1)) * w;
        const y = h - (v / max) * (h - 6) - 2;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [series]);

  return (
    <article className={`${styles.sparkCard} ${styles.sparkCardTall} ${styles[tone]}`}>
      <div className={styles.sparkChartWrap} aria-hidden>
        <svg viewBox="0 0 160 54" preserveAspectRatio="none">
          <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        </svg>
      </div>
      <div className={styles.sparkHead}>
        <span className={styles.sparkLabel}>{label}</span>
        <span className={styles.sparkDelta}>↑ {marginPct}%</span>
      </div>
      <div className={styles.sparkValue}>{count}</div>
      <p className={styles.sparkSub}>
        Value placed <b>{valueLabel}</b>
      </p>
      <DemoBadge />
    </article>
  );
}

export function VerticalBars({ data, colors }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className={styles.barchart}>
      {data.map((d, i) => (
        <div key={d.n} className={styles.barCol}>
          <div className={styles.barVal}>{d.v}</div>
          <div
            className={styles.bar}
            style={{
              height: `${Math.max((d.v / max) * 100, 4)}%`,
              background: colors[i % colors.length],
            }}
            title={`${d.n}: ${d.v}`}
          />
          <div className={styles.barLabel}>{d.n}</div>
        </div>
      ))}
    </div>
  );
}

export function HorizontalBars({ data, colors, valueFmt = (v) => String(v) }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className={styles.hbarchart}>
      {data.map((d, i) => (
        <div key={d.n} className={styles.hbarRow}>
          <div className={styles.hbarLabel}>{d.n}</div>
          <div className={styles.hbarTrack}>
            <div
              className={styles.hbarFill}
              style={{
                width: `${Math.max((d.v / max) * 100, 4)}%`,
                background: d.c || colors?.[i % colors.length] || '#274670',
              }}
            />
          </div>
          <div className={styles.hbarValue}>{valueFmt(d.v)}</div>
        </div>
      ))}
    </div>
  );
}

export function PieLegend({ data, colors, valueFmt = (v) => String(v) }) {
  const total = data.reduce((s, d) => s + d.v, 0) || 1;
  let cum = 0;
  const stops = data.map((d, i) => {
    const start = (cum / total) * 100;
    cum += d.v;
    const end = (cum / total) * 100;
    return `${colors[i % colors.length]} ${start}% ${end}%`;
  });

  return (
    <div className={styles.pieBlock}>
      <div
        className={styles.pie}
        style={{ background: `conic-gradient(${stops.join(',')})` }}
        aria-hidden
      />
      <ul className={styles.pieLegend}>
        {data.map((d, i) => (
          <li key={d.n}>
            <span style={{ background: colors[i % colors.length] }} />
            <em>{d.n}</em>
            <b>{valueFmt(d.v)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FleetMixBar({ owned, charteredIn }) {
  return (
    <div className={styles.fleetMix}>
      <div className={styles.fleetMixLabel}>
        <span>Fleet Composition</span>
        <span>{owned}% Owned · {charteredIn}% Chartered-in</span>
      </div>
      <div className={styles.fleetMixTrack}>
        <div style={{ width: `${owned}%`, background: 'var(--dash-navy)' }} />
        <div style={{ width: `${charteredIn}%`, background: 'var(--dash-blue)' }} />
      </div>
    </div>
  );
}

export function PaceCard({ item }) {
  const delta = item.qtyLiftedPct - item.timeElapsedPct;
  const ahead = delta >= 0;
  return (
    <div className={styles.paceCard}>
      <div className={styles.paceTop}>
        <div>
          <span className={styles.paceId}>{item.id}</span>
          {item.no ? <span className={styles.paceMeta}>COA No. {item.no} · {item.charterer}</span> : null}
        </div>
        <DemoBadge />
      </div>
      <div className={styles.routeChips}>
        <span>{item.from}</span>
        <i className="bi bi-arrow-right" aria-hidden />
        <span>{item.to}</span>
      </div>
      {!item.no ? <p className={styles.paceCharterer}>{item.charterer}</p> : null}
      <div className={styles.paceMeters}>
        <div>
          <div className={styles.paceMeterLabel}>
            Quantity Lifted <b>{item.qtyLiftedPct}%</b>
          </div>
          <div className={styles.paceTrack}>
            <div className={styles.paceFillPurple} style={{ width: `${item.qtyLiftedPct}%` }} />
          </div>
          <div className={styles.paceHint}>{item.lifted} lifted · {item.balance} balance</div>
        </div>
        <div>
          <div className={styles.paceMeterLabel}>
            Contract Duration Elapsed <b>{item.timeElapsedPct}%</b>
          </div>
          <div className={styles.paceTrack}>
            <div className={styles.paceFillMuted} style={{ width: `${item.timeElapsedPct}%` }} />
          </div>
        </div>
      </div>
      <span className={`${styles.paceStatus} ${ahead ? styles.paceAhead : styles.paceBehind}`}>
        {ahead ? '↑' : '↓'} {Math.abs(delta)} pts {ahead ? 'ahead of' : 'behind'} pace
      </span>
    </div>
  );
}

export function PeriodPaceCard({ item }) {
  return (
    <div className={styles.paceCard}>
      <div className={styles.paceTop}>
        <div>
          <span className={styles.periodId}>{item.id}</span>
          <span className={styles.paceMeta}>{item.vessel} · {item.charterer}</span>
        </div>
        <div className={styles.cardHeadRight}>
          <span className={`${styles.periodStatusChip} ${item.status === 'onhire' ? styles.onhire : styles.upcoming}`}>
            {item.status === 'onhire' ? 'On Hire' : 'Not Yet Commenced'}
          </span>
          <DemoBadge />
        </div>
      </div>
      <div className={styles.paceMeters}>
        <div>
          <div className={styles.paceMeterLabel}>
            Days Elapsed <b>{item.pct}% · {item.performed}/{item.total} days</b>
          </div>
          <div className={styles.paceTrack}>
            <div className={styles.paceFillBlue} style={{ width: `${item.pct}%` }} />
          </div>
        </div>
      </div>
      <p className={styles.drillHint}>{item.note}</p>
    </div>
  );
}

export function PipelineList({ items }) {
  return (
    <div className={styles.pipelineList}>
      {items.map((d) => {
        const cls = d.days <= 30 ? 'urgent' : d.days <= 60 ? 'soon' : 'ok';
        const color = d.days <= 30 ? '#C22A20' : d.days <= 60 ? '#B8791A' : '#0B7A28';
        const pos = Math.min((d.days / 90) * 100, 100);
        return (
          <div key={d.vessel} className={styles.pipelineRow}>
            <div className={styles.pipelineVessel}>{d.vessel}</div>
            <div className={styles.pipelineTrack}>
              <div className={styles.pipelineMarker} style={{ left: `${pos}%`, background: color }} />
            </div>
            <div className={`${styles.pipelineDays} ${styles[cls]}`}>{d.days} days</div>
          </div>
        );
      })}
    </div>
  );
}

export function OffHirePanel({ records }) {
  return (
    <div className={styles.recordsStack}>
      {records.map((r) => (
        <div key={r.id} className={styles.contractRecord}>
          <div className={styles.recordHead}>
            <span className={styles.recordId}>{r.id}</span>
            <span className={styles.recordVessel}>{r.vessel}</span>
            <span className={styles.recordCharterer}>· {r.charterer}</span>
          </div>
          <div className={styles.offhireSummary}>
            <div className={`${styles.offhireStat} ${styles.on}`}>
              <div className={styles.ot}>On-Hire</div>
              <div className={styles.ov}>{r.onHireDays} days</div>
              <div className={styles.ol}>{r.onHireEarned} earned</div>
            </div>
            <div className={`${styles.offhireStat} ${styles.off}`}>
              <div className={styles.ot}>Off-Hire</div>
              <div className={styles.ov}>{r.offHireDays} days</div>
              <div className={styles.ol}>{r.offHireForegone} foregone</div>
            </div>
          </div>
          <HorizontalBars data={r.reasons} valueFmt={(v) => `${v}d`} />
        </div>
      ))}
    </div>
  );
}

export function HireDuePanel({ records }) {
  return (
    <div className={styles.recordsStack}>
      {records.map((r) => (
        <div key={r.id} className={styles.contractRecord}>
          <div className={styles.recordHead}>
            <span className={styles.recordId}>{r.id}</span>
            <span className={styles.recordVessel}>{r.vessel}</span>
            <span className={styles.recordCharterer}>· {r.charterer}</span>
          </div>
          <div className={styles.segBarRow}>
            <div className={styles.segBarLabel}>
              <span>Days Performed</span>
              <b>{r.totalDays} days · ${r.dailyRate.toLocaleString()}/day</b>
            </div>
            <div className={styles.segBarTrack}>
              <div
                style={{ width: `${(r.receivedDays / r.totalDays) * 100}%`, background: 'var(--dash-blue)' }}
                title={`Received: ${r.receivedDays} days`}
              />
              <div
                style={{ width: `${(r.overdueDays / r.totalDays) * 100}%`, background: '#B8791A' }}
                title={`Overdue: ${r.overdueDays} days`}
              />
            </div>
          </div>
          <div className={styles.hireValueStats}>
            <div className={`${styles.hvStat} ${styles.received}`}>
              <div className={styles.hvNum}>{r.receivedValue}</div>
              <div className={styles.hvLbl}>Received</div>
            </div>
            <div className={`${styles.hvStat} ${styles.overdue}`}>
              <div className={styles.hvNum}>{r.overdueValue}</div>
              <div className={styles.hvLbl}>Overdue</div>
            </div>
          </div>
        </div>
      ))}
      <div className={styles.segBarLegend}>
        <span><i style={{ background: 'var(--dash-blue)' }} />Received</span>
        <span><i style={{ background: '#B8791A' }} />Overdue</span>
      </div>
    </div>
  );
}

export function MarkToMarketCard({ data }) {
  const pct = data.deltaPct ?? Math.abs((((data.market - data.locked) / data.locked) * 100)).toFixed(1);
  return (
    <div className={styles.mtmCard}>
      <div className={styles.cardHead}>
        <h4 className={styles.cardTitle}>
          Mark-to-Market
          <span className={styles.cardSub}>Locked hire vs. current TCE benchmark</span>
        </h4>
        <DemoBadge />
      </div>
      <p className={styles.mtmContractLine}>
        {data.vessel} · {data.contract}{data.charterer ? ` · ${data.charterer}` : ''}
      </p>
      <div className={styles.mtmRow}>
        <div className={styles.mtmBox}>
          <span>Locked Hire Rate</span>
          <b>${data.locked.toLocaleString()}</b>
        </div>
        <div className={`${styles.mtmDelta} ${data.favorable ? styles.mtmUp : styles.mtmDown}`}>
          <div>{data.favorable ? '↑' : '↓'} {pct}%</div>
          <em>{data.favorable ? 'Favorable' : 'Unfavorable'}</em>
        </div>
        <div className={styles.mtmBox}>
          <span>Current Market TCE / Day</span>
          <b>${data.market.toLocaleString()}</b>
        </div>
      </div>
    </div>
  );
}

const MIX_ICONS = {
  Spot: (
    <svg viewBox="0 0 24 24" aria-hidden><path d="M13 2 4 14h6l-1 8 10-13h-6z" fill="currentColor" stroke="none" /></svg>
  ),
  TC: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  ),
  COA: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  Periods: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" />
    </svg>
  ),
};

const KPI_ICONS = {
  Fixed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="2 18 9 11 13 15 21 6" /><polyline points="15 6 21 6 21 12" />
    </svg>
  ),
  'In Progress': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 2.5a3.7 3.7 0 0 1 3.7 3.7c0 2.3-3.7 6.4-3.7 6.4s-3.7-4.1-3.7-6.4A3.7 3.7 0 0 1 18 2.5z" />
      <circle cx="18" cy="6.2" r="1.4" />
      <path d="M7 9.5a4.6 4.6 0 0 1 4.6 4.6c0 3-4.6 8.4-4.6 8.4s-4.6-5.4-4.6-8.4A4.6 4.6 0 0 1 7 9.5z" />
      <circle cx="7" cy="14.1" r="1.8" />
    </svg>
  ),
  Completed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8.68945 12.535L11.0595 14.908L15.8095 10.162" />
      <path d="M15.847 21.4947C20.014 20.6867 21.5 18.0977 21.5 12.5347C21.5 5.59767 19.19 3.28467 12.25 3.28467C5.31 3.28467 3 5.59767 3 12.5347C3 19.4717 5.31 21.7847 12.25 21.7847" />
    </svg>
  ),
};

const ATTENTION_ICONS = {
  urgent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  ),
  soon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2h9l3 3v17H6z" /><path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
};

export function ChipToggle({ options, value, onChange }) {
  return (
    <div className={styles.chipToggle}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={value === opt.id ? styles.chipToggleActive : undefined}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function AllKpiTile({ label, count, valueLabel, marginPct, tone }) {
  return (
    <article className={`${styles.kpiTile} ${styles[tone]}`}>
      <div className={styles.kpiHead}>
        <div className={styles.kpiHeadLeft}>
          <span className={styles.kpiIcon}>{KPI_ICONS[label]}</span>
          <span className={styles.kpiLabel}>{label}</span>
        </div>
        <span className={styles.kpiDelta}>↑ {marginPct}% margin</span>
      </div>
      <div className={styles.kpiValue}>{count}</div>
      <p className={styles.kpiSub}>
        <b>{valueLabel}</b> value · Spot + TC + COA + Periods
      </p>
      <span className={styles.kpiBadge}>{DEMO_BADGE}</span>
    </article>
  );
}

export function ContractMixPanel({ items = TYPE_MIX }) {
  const [mode, setMode] = useState('count');
  const primary = items.map((d) => ({
    ...d,
    display: mode === 'value' ? d.revenue : d.v,
  }));
  const max = Math.max(...primary.map((d) => d.display), 1);

  return (
    <ChartCard
      title="Contract Mix"
      sub="Spot + TC + COA + Periods"
      actions={(
        <ChipToggle
          value={mode}
          onChange={setMode}
          options={[
            { id: 'count', label: 'Contracts' },
            { id: 'value', label: 'Revenue' },
          ]}
        />
      )}
    >
      <div className={styles.mixPanel}>
        {primary.map((d) => (
          <div
            key={d.n}
            className={styles.mixBarCol}
            title={`${d.n}: ${mode === 'value' ? `${d.v} trades` : `${d.revenue} mil`}`}
          >
            <div
              className={styles.mixBar}
              style={{
                height: `${Math.max((d.display / max) * 100, 8)}%`,
                background: `linear-gradient(180deg, ${d.c}CC 0%, ${d.c} 100%)`,
                boxShadow: `0 0 10px ${d.c}33`,
              }}
            />
            <span className={styles.mixBarLabel}>{d.n}</span>
          </div>
        ))}
      </div>
      <div className={styles.mixChipRow}>
        {primary.map((d) => (
          <div key={d.n} className={styles.mixChip}>
            <div className={styles.mixChipHead}>
              <div className={styles.mixChipIcon} style={{ background: d.c }}>{MIX_ICONS[d.n]}</div>
              <div className={styles.mixChipName}>{d.n}</div>
            </div>
            <div className={styles.mixChipValue}>{mode === 'value' ? `${d.revenue} mil` : d.v}</div>
            <div className={styles.mixChipBarTrack}>
              <div className={styles.mixChipBarFill} style={{ width: `${(d.display / max) * 100}%`, background: d.c }} />
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export function RevenueByContractCard() {
  const [rtype, setRtype] = useState('all');
  const data = rtype === 'all' ? REVENUE_BY_TYPE : REVENUE_DRILL[rtype];
  const sub = rtype === 'all'
    ? 'In-progress + completed value, all types'
    : `${rtype} · by ${rtype === 'COA' || rtype === 'Periods' ? 'contract' : 'office'}`;

  return (
    <ChartCard
      title="Revenue Realised by Contract"
      sub={sub}
      actions={(
        <ChipToggle
          value={rtype}
          onChange={setRtype}
          options={[
            { id: 'all', label: 'All Types' },
            { id: 'Spot', label: 'Spot' },
            { id: 'TC', label: 'TC' },
            { id: 'COA', label: 'COA' },
            { id: 'Periods', label: 'Periods' },
          ]}
        />
      )}
    >
      <HorizontalBars data={data} valueFmt={(v) => `${v} mil`} />
    </ChartCard>
  );
}

export function AttentionList({ items }) {
  return (
    <ul className={styles.attentionList}>
      {items.map((it) => (
        <li key={it.title} className={styles.attentionRow}>
          <span className={styles.attentionIcon} style={{ background: `${it.color}1F`, color: it.color }}>
            {ATTENTION_ICONS[it.sev] || ATTENTION_ICONS.review}
          </span>
          <div className={styles.attentionBody}>
            <strong>{it.title}</strong>
            <em>{it.meta}</em>
          </div>
          <span className={styles.attentionChip} style={{ color: it.color, background: `${it.color}1F` }}>
            {it.type} · {it.chip}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function QuarterlyAreaChart({ data }) {
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const w = 900;
  const h = 190;
  const pad = 34;
  const padBottom = 26;
  const padTop = 16;
  const maxV = Math.max(...data.map((d) => d.v), 1);
  const niceMax = Math.ceil(maxV / 5) * 5;
  const stepX = (w - 2 * pad) / (quarters.length - 1);
  const xFor = (q) => pad + quarters.indexOf(q) * stepX;
  const yFor = (v) => h - padBottom - (v / niceMax) * (h - padTop - padBottom);
  const pts = data.map((d) => [xFor(d.n), yFor(d.v)]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - padBottom} L${pts[0][0].toFixed(1)},${h - padBottom} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className={styles.linechartWrap}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={styles.linechartSvg}>
        <defs>
          <linearGradient id="allRevenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8A93A2" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#8A93A2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((f) => {
          const y = h - padBottom - f * (h - padTop - padBottom);
          const val = Math.round(niceMax * f);
          return (
            <g key={f}>
              <line x1={pad} y1={y} x2={w - pad + 8} y2={y} stroke="#E4E6E9" strokeWidth="1" strokeDasharray="3,4" />
              <text x={pad - 8} y={y + 3} fontSize="10" fill="#8A93A0" textAnchor="end">{val}</text>
            </g>
          );
        })}
        <path d={area} fill="url(#allRevenueFill)" />
        <path d={line} fill="none" stroke="#274670" strokeWidth="2.5" strokeLinecap="round" />
        {pts.map((p) => (
          <circle key={p.join(',')} cx={p[0]} cy={p[1]} r="4.5" fill="#274670" stroke="#fff" strokeWidth="1.5" />
        ))}
        {quarters.map((q, i) => (
          <text key={q} x={pad + i * stepX} y={h - 8} fontSize="11" fill="#8A93A0" textAnchor="middle">{q}</text>
        ))}
      </svg>
      <div className={styles.segBarLegend}>
        <span><i style={{ background: '#274670' }} />Quarterly revenue (YTD)</span>
      </div>
    </div>
  );
}

export function ActivityBadge({ status, label }) {
  return (
    <span className={`${styles.activityBadge} ${styles[status] || ''}`}>
      <span className={styles.activityDot} />
      {label}
    </span>
  );
}

export function SopFCta() {
  return (
    <div className={styles.sopfCta}>
      <span>
        Live Dashboard - Vessels on Water
        <i className="bi bi-box-arrow-up-right" aria-hidden />
      </span>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CardSelect, HeaderFilterControls, LoadingOverlay, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import { fetchReport, fetchReportFilterOptions } from '../../../services/reports.js';
import { downloadReportExcel } from './reportExports.js';
import styles from './PlAtAGlancePage.module.css';

const PAGE_SIZE = 10;
const CURRENT_YEAR = String(new Date().getFullYear());

const TYPE_OPTIONS = [
  { id: 'all', name: 'All Types' },
  { id: 'spot', name: 'Spot' },
  { id: 'tc', name: 'TC' },
];

const PERIOD_OPTIONS = [
  { id: 'full', name: 'Full Year' },
  { id: 'q1', name: 'Q1' },
  { id: 'q2', name: 'Q2' },
  { id: 'q3', name: 'Q3' },
  { id: 'q4', name: 'Q4' },
];

const BIZ_OPTIONS = [
  { id: '', name: 'All Types' },
  { id: '3', name: 'Dry' },
  { id: '2', name: 'Tankers' },
  { id: '1', name: 'Gas' },
];

const COLUMN_DEFS = [
  { key: 'vessel', label: 'Vessel', defaultOn: true },
  { key: 'dwt', label: 'DWT', defaultOn: true },
  { key: 'cargoMt', label: 'Cargo MT', defaultOn: true },
  { key: 'owner', label: 'Owner', defaultOn: true },
  { key: 'charterer', label: 'Charterer', defaultOn: true },
  { key: 'chrtPic', label: 'CHRT PIC', defaultOn: true },
  { key: 'opsPic', label: 'OPS PIC', defaultOn: true },
  { key: 'cpDate', label: 'CP Date', defaultOn: true },
  { key: 'eta', label: 'ETA / ETC', defaultOn: false },
  { key: 'revenue', label: 'Revenue', defaultOn: true },
  { key: 'costs', label: 'Costs', defaultOn: true },
  { key: 'net', label: 'Net P&L', defaultOn: true },
  { key: 'margin', label: 'Margin %', defaultOn: true },
  { key: 'status', label: 'Status', defaultOn: true },
];

function defaultColumnState() {
  const next = {};
  COLUMN_DEFS.forEach((c) => { next[c.key] = c.defaultOn; });
  return next;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Full USD figure (no currency symbol). */
function fmtFull(amount) {
  const full = Math.round(toNumber(amount));
  const sign = full < 0 ? '-' : '';
  return `${sign}${Math.abs(full).toLocaleString('en-US')}`;
}

/** Compact M/K for KPI cards / split legend (no currency). */
function fmtCardAbbrev(amount) {
  const n = toNumber(amount);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs === 0) return '0';
  if (abs >= 1e6) {
    return `${sign}${(abs / 1e6).toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}M`;
  }
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3).toLocaleString('en-US')}K`;
  return `${sign}${Math.round(abs).toLocaleString('en-US')}`;
}

function resolveNet(row, type, revenue, costs) {
  const raw = type === 'tc'
    ? (row.finalPl != null && row.finalPl !== '' ? row.finalPl : row.tcEarnings)
    : row.finalPl;
  if (raw != null && raw !== '') return toNumber(raw);
  return +(revenue - costs).toFixed(2);
}

function mapApiRow(row, type) {
  const revenue = toNumber(row.revenue);
  const costs = toNumber(row.costs);
  const net = resolveNet(row, type, revenue, costs);
  const margin = revenue ? +((net / revenue) * 100).toFixed(1) : 0;
  return {
    id: String(row.voyageNo || row.id || `${type}-${row.srNo}`),
    type,
    vessel: row.vesselName || '—',
    charterer: row.charterer || '—',
    cpDate: row.cpDate || '—',
    eta: row.eta || '—',
    chrtPic: row.chrtPic || row.team1 || row.team || row.pic1 || '—',
    opsPic: row.opsPic || row.pic1 || row.pic2 || '—',
    biz: row.biz || '',
    year: row.year != null ? Number(row.year) : null,
    q: row.q || '',
    revenue,
    costs,
    net: +net.toFixed(2),
    margin,
    status: row.status || 'Estimated',
    dwt: toNumber(row.dwt),
    cargoMt: toNumber(row.cargoMt),
    owner: row.owner || row.ownerName || '—',
  };
}

function IconArrowUp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 4l7 8h-5v8h-4v-8H5z" />
    </svg>
  );
}

function IconArrowDown() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 20l-7-8h5V4h4v8h5z" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function renderCell(key, row) {
  switch (key) {
    case 'vessel':
      return row.vessel;
    case 'dwt':
      return row.dwt ? `${row.dwt.toLocaleString('en-US')} MT` : '—';
    case 'cargoMt':
      return row.cargoMt ? `${row.cargoMt.toLocaleString('en-US')} MT` : '—';
    case 'owner':
      return <span className={styles.trunc} title={row.owner}>{row.owner}</span>;
    case 'charterer':
      return <span className={styles.trunc} title={row.charterer}>{row.charterer}</span>;
    case 'chrtPic':
      return row.chrtPic;
    case 'opsPic':
      return row.opsPic;
    case 'cpDate':
      return row.cpDate;
    case 'eta':
      return row.eta;
    case 'revenue':
      return fmtFull(row.revenue);
    case 'costs':
      return fmtFull(row.costs);
    case 'net':
      return (
        <span className={row.net >= 0 ? styles.netPos : styles.netNeg}>{fmtFull(row.net)}</span>
      );
    case 'margin':
      return `${row.margin.toFixed(1)}%`;
    case 'status':
      return (
        <span className={`${styles.statusPill} ${row.status === 'Actual' ? styles.statusActual : styles.statusEstimated}`}>
          {row.status}
        </span>
      );
    default:
      return '—';
  }
}

const NUMERIC_KEYS = new Set(['dwt', 'cargoMt', 'cpDate', 'eta', 'revenue', 'costs', 'net', 'margin']);

export default function PlAtAGlancePage() {
  const setHeading = usePageHeaderHeading();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(CURRENT_YEAR);
  const [periodFilter, setPeriodFilter] = useState('full');
  const [bizFilter, setBizFilter] = useState('3');
  const [yearOptions, setYearOptions] = useState([
    { id: CURRENT_YEAR, name: CURRENT_YEAR },
    { id: String(Number(CURRENT_YEAR) - 1), name: String(Number(CURRENT_YEAR) - 1) },
  ]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [columnState, setColumnState] = useState(defaultColumnState);
  const [exportOpen, setExportOpen] = useState(false);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [toast, setToast] = useState('');
  const exportRef = useRef(null);
  const colPickerRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    setHeading({
      title: (
        <span>
          P&L
          <span className={styles.titleMuted}> - Spot & TC</span>
        </span>
      ),
    });
    return () => setHeading(null);
  }, [setHeading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetchReportFilterOptions();
        if (cancelled) return;
        const years = (meta.years || []).filter((y) => y.id);
        if (years.length) setYearOptions(years);
      } catch {
        // Keep local year fallbacks.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!yearFilter) {
        setRows([]);
        setError('Please select a year.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await fetchReport('pl-at-a-glance-vc-tc', {
          selYear: yearFilter,
          selBType: bizFilter,
        });
        if (cancelled) return;
        const mapped = [
          ...(data.recordsVc || []).map((row) => mapApiRow(row, 'spot')),
          ...(data.recordsTc || []).map((row) => mapApiRow(row, 'tc')),
        ];
        setRows(mapped);
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setError(err.message || 'Failed to load P&L report.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [yearFilter, bizFilter]);

  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((c) => columnState[c.key]),
    [columnState],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (periodFilter !== 'full' && r.q !== periodFilter) return false;
      if (q) {
        const hay = `${r.id} ${r.vessel} ${r.charterer} ${r.owner}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, typeFilter, periodFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, yearFilter, periodFilter, bizFilter]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
      if (colPickerRef.current && !colPickerRef.current.contains(e.target)) setColPickerOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const kpis = useMemo(() => {
    let totalRevenue = 0;
    let totalCosts = 0;
    let spotNet = 0;
    let tcNet = 0;
    filteredRows.forEach((r) => {
      totalRevenue += r.revenue;
      totalCosts += r.costs;
      if (r.type === 'spot') spotNet += r.net;
      else tcNet += r.net;
    });
    const totalNet = +(spotNet + tcNet).toFixed(2);
    const avgMargin = totalRevenue ? (totalNet / totalRevenue) * 100 : 0;
    const totalPnlSplit = Math.abs(spotNet) + Math.abs(tcNet);
    const spotPct = totalPnlSplit > 0 ? (Math.abs(spotNet) / totalPnlSplit) * 100 : 50;
    const tcPct = 100 - spotPct;
    return {
      totalRevenue,
      totalCosts,
      totalNet,
      avgMargin,
      spotNet,
      tcNet,
      spotPct,
      tcPct,
      costOfRev: totalRevenue ? (totalCosts / totalRevenue) * 100 : 0,
    };
  }, [filteredRows]);

  const fromIdx = filteredRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const toIdx = Math.min(safePage * PAGE_SIZE, filteredRows.length);
  const tableMinWidth = Math.max(760, (visibleColumns.length + 2) * 128);

  const exportColumns = useMemo(() => ([
    { key: 'id', label: 'Voy No.' },
    { key: 'type', label: 'Type' },
    ...visibleColumns.map((col) => ({ key: col.key, label: col.label })),
  ]), [visibleColumns]);

  const handleExport = (format) => {
    if (!filteredRows.length) {
      showToast('No records to export for the current filters.');
      setExportOpen(false);
      return;
    }
    if (format === 'Excel' || format === 'CSV') {
      downloadReportExcel('pl-at-a-glance-spot-tc', exportColumns, filteredRows);
      showToast(`Downloaded ${filteredRows.length} record${filteredRows.length === 1 ? '' : 's'} as Excel.`);
    } else if (format === 'PDF') {
      showToast('PDF export is available from other report pages — use Excel for this grid.');
    } else {
      showToast(`Prepared ${filteredRows.length} record${filteredRows.length === 1 ? '' : 's'} for email attach — download Excel and attach manually.`);
    }
    setExportOpen(false);
  };

  return (
    <>
      <PageHeaderActions deps={[search, typeFilter, yearFilter, periodFilter, bizFilter]}>
        <HeaderFilterControls>
          <PageHeaderSearch
            value={search}
            onChange={setSearch}
            placeholder="Search"
          />
          <CardSelect
            options={TYPE_OPTIONS}
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="Contract type"
            ariaLabel="Contract type"
          />
          <CardSelect
            options={yearOptions}
            value={yearFilter}
            onChange={setYearFilter}
            placeholder="Year"
            ariaLabel="Year"
          />
          <CardSelect
            options={PERIOD_OPTIONS}
            value={periodFilter}
            onChange={setPeriodFilter}
            placeholder="Period"
            ariaLabel="Period"
          />
          <CardSelect
            options={BIZ_OPTIONS}
            value={bizFilter}
            onChange={setBizFilter}
            placeholder="Business type"
            ariaLabel="Business type"
          />
        </HeaderFilterControls>
      </PageHeaderActions>

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay active label="Loading P&L - Spot & TC…" /> : null}
        {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

        <div className={styles.hcardGrid}>
          <div className={`${styles.hcard} ${styles.hcardRev}`}>
            <div className={styles.hcardHead}>
              <div className={styles.hcardIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v18" />
                  <path d="M16.5 7.5c0-2-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.3 9 2 9 6.3 0 2-2 3.2-4.5 3.2s-4.5-1-4.5-3" />
                </svg>
              </div>
              <div className={`${styles.hcardDelta} ${styles.hcardDeltaUp}`}>
                <IconArrowUp />
                {filteredRows.length} contracts
              </div>
            </div>
            <span className={styles.hcardLabel}>Total Revenue</span>
            <div className={styles.hcardValue}>{fmtCardAbbrev(kpis.totalRevenue)}</div>
          </div>

          <div className={`${styles.hcard} ${styles.hcardCost}`}>
            <div className={styles.hcardHead}>
              <div className={styles.hcardIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M3 11h18M8 7V5h8v2" />
                </svg>
              </div>
              <div className={`${styles.hcardDelta} ${styles.hcardDeltaUp}`}>
                <IconArrowUp />
                {kpis.costOfRev.toFixed(1)}% of rev.
              </div>
            </div>
            <span className={styles.hcardLabel}>Total Costs</span>
            <div className={styles.hcardValue}>{fmtCardAbbrev(kpis.totalCosts)}</div>
          </div>

          <div className={`${styles.hcard} ${styles.hcardPnl}`}>
            <div className={styles.hcardHead}>
              <div className={styles.hcardIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12.5l2.5 2.5L16 9.5" />
                </svg>
              </div>
              <div className={`${styles.hcardDelta} ${kpis.totalNet >= 0 ? styles.hcardDeltaUp : styles.hcardDeltaDown}`}>
                {kpis.totalNet >= 0 ? <IconArrowUp /> : <IconArrowDown />}
                {Math.abs(kpis.avgMargin).toFixed(1)}%
              </div>
            </div>
            <span className={styles.hcardLabel}>Net P&amp;L</span>
            <div className={styles.hcardValue}>{fmtCardAbbrev(kpis.totalNet)}</div>
          </div>

          <div className={`${styles.hcard} ${styles.hcardMargin}`}>
            <div className={styles.hcardHead}>
              <div className={styles.hcardIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 11.5a8.38 8.38 0 0 1-3.8 7 8.5 8.5 0 0 1-9.8 0 8.38 8.38 0 0 1-3.8-7 8.5 8.5 0 0 1 3.8-7 8.38 8.38 0 0 1 9.8 0 8.5 8.5 0 0 1 3.8 7z" />
                  <path d="M12 7v5l3.5 2" />
                </svg>
              </div>
              <div className={`${styles.hcardDelta} ${styles.hcardDeltaUp}`}>
                <IconArrowUp />
                target 25%
              </div>
            </div>
            <span className={styles.hcardLabel}>Avg Margin</span>
            <div className={styles.hcardValue}>{kpis.avgMargin.toFixed(1)}%</div>
          </div>
        </div>

        <div className={styles.splitCard}>
          <div className={styles.splitHead}>
            <div className={styles.splitTitle}>Net Contribution: Spot vs TC</div>
          </div>
          <div className={styles.splitBarTrack}>
            <div className={`${styles.splitBarSeg} ${styles.splitBarSpot}`} style={{ width: `${kpis.spotPct.toFixed(1)}%` }} />
            <div className={`${styles.splitBarSeg} ${styles.splitBarTc}`} style={{ width: `${kpis.tcPct.toFixed(1)}%` }} />
          </div>
          <div className={styles.splitLegend}>
            <span>
              <span className={styles.sw} style={{ background: '#f4652c' }} />
              Spot (Voyage Charter)
              <b>{fmtCardAbbrev(kpis.spotNet)} ({kpis.spotPct.toFixed(0)}%)</b>
            </span>
            <span>
              <span className={styles.sw} style={{ background: '#14919b' }} />
              TC (Time Charter)
              <b>{fmtCardAbbrev(kpis.tcNet)} ({kpis.tcPct.toFixed(0)}%)</b>
            </span>
          </div>
        </div>

        <ScrollableTable
          toolbarStart={(
            <>
              <div className={styles.exportMenu} ref={exportRef}>
                <button
                  type="button"
                  className={styles.iconOnlyBtn}
                  title="Export this report"
                  aria-label="Export this report"
                  aria-expanded={exportOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setColPickerOpen(false);
                    setExportOpen((v) => !v);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.9" />
                    <circle cx="12" cy="12" r="1.9" />
                    <circle cx="12" cy="19" r="1.9" />
                  </svg>
                </button>
                {exportOpen ? (
                  <div className={styles.exportMenuList}>
                    <div className={styles.exportMenuTitle}>Export this report</div>
                    {[
                      { format: 'Excel', label: 'Download as Excel' },
                      { format: 'CSV', label: 'Download as CSV' },
                      { format: 'PDF', label: 'Download as PDF' },
                      { format: 'Email', label: 'Attach to Email' },
                    ].map((item) => (
                      <button
                        key={item.format}
                        type="button"
                        className={styles.exportMenuItem}
                        onClick={() => handleExport(item.format)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className={styles.colPicker} ref={colPickerRef}>
                <button
                  type="button"
                  className={styles.footerBtn}
                  aria-expanded={colPickerOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExportOpen(false);
                    setColPickerOpen((v) => !v);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M9 4v16M15 4v16" />
                  </svg>
                  <span>Columns ({visibleColumns.length + 1})</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 11, height: 11 }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {colPickerOpen ? (
                  <div className={styles.colPickerMenu}>
                    <div className={styles.colPickerMenuTitle}>Choose the fields to show in this report</div>
                    <div className={styles.colPickerListWrap}>
                      {COLUMN_DEFS.map((col) => (
                        <label key={col.key} className={styles.colPickerItem}>
                          <input
                            type="checkbox"
                            checked={!!columnState[col.key]}
                            onChange={(e) => {
                              setColumnState((prev) => ({ ...prev, [col.key]: e.target.checked }));
                            }}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                    <div className={styles.colPickerMenuFooter}>
                      <button
                        type="button"
                        className={styles.colPickerReset}
                        onClick={() => setColumnState(defaultColumnState())}
                      >
                        Reset to default
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
          toolbarRight={(
            <>Showing {filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}</>
          )}
          footer={(
            <div className={styles.pagerBar}>
              <span>
                {filteredRows.length
                  ? `Showing ${fromIdx}–${toIdx} of ${filteredRows.length} entries`
                  : 'Showing 0 of 0 entries'}
              </span>
              <div className={styles.pager}>
                <button
                  type="button"
                  className={styles.pgArrow}
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <IconChevronLeft />
                </button>
                <span className={styles.pgNum}>{safePage}</span>
                <button
                  type="button"
                  className={styles.pgArrow}
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <IconChevronRight />
                </button>
              </div>
            </div>
          )}
        >
          <table className={styles.grid} style={{ minWidth: tableMinWidth }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Voy No.</th>
                {visibleColumns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? pageRows.map((r, i) => {
                const rowNum = (safePage - 1) * PAGE_SIZE + i + 1;
                const accent = r.type === 'spot' ? '#f4652c' : '#14919b';
                return (
                  <tr key={`${r.type}-${r.id}-${rowNum}`}>
                    <td className={styles.accentCell} style={{ borderLeftColor: accent }}>{rowNum}</td>
                    <td>
                      <div className={styles.contractCell}>
                        <span className={styles.cellId}>{r.id}</span>
                        <span className={`${styles.typeChip} ${r.type === 'spot' ? styles.typeChipSpot : styles.typeChipTc}`}>
                          {r.type}
                        </span>
                      </div>
                    </td>
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={NUMERIC_KEYS.has(col.key) ? styles.cellNum : undefined}
                      >
                        {renderCell(col.key, r)}
                      </td>
                    ))}
                  </tr>
                );
              }) : (
                <tr className={styles.emptyRow}>
                  <td colSpan={visibleColumns.length + 2}>
                    {loading
                      ? 'Loading…'
                      : `No Spot/TC fixtures for ${bizFilter === '3' ? 'Dry' : bizFilter === '2' ? 'Tankers' : bizFilter === '1' ? 'Gas' : 'this business'} in ${yearFilter}${periodFilter !== 'full' ? ` / ${periodFilter.toUpperCase()}` : ''}. Try another year or All Types.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>

      {toast ? (
        <div className={`${styles.pnlToast} ${styles.pnlToastShow}`} role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import styles from './PlAtAGlancePage.module.css';

const PAGE_SIZE = 10;

const TYPE_OPTIONS = [
  { id: 'all', name: 'All Types' },
  { id: 'spot', name: 'Spot' },
  { id: 'tc', name: 'TC' },
];

const YEAR_OPTIONS = [
  { id: 'all', name: 'All Years' },
  { id: '2026', name: '2026' },
  { id: '2025', name: '2025' },
];

const PERIOD_OPTIONS = [
  { id: 'full', name: 'Full Year' },
  { id: 'q1', name: 'Q1' },
  { id: 'q2', name: 'Q2' },
  { id: 'q3', name: 'Q3' },
  { id: 'q4', name: 'Q4' },
];

const BIZ_OPTIONS = [
  { id: 'all', name: 'All Types' },
  { id: 'Tanker', name: 'Tankers' },
  { id: 'Dry Cargo', name: 'Dry' },
  { id: 'Gas', name: 'Gas' },
];

const VESSEL_INFO = {
  'NEW INTEGRITY': { dwt: 50296, owner: 'Seven Seas Tankers Ltd' },
  'OCEAN PRIDE': { dwt: 52454, owner: 'Meridian Marine Holdings' },
  'SLF TRINITY': { dwt: 74999, owner: 'Blue Horizon Shipowners' },
  ANTARES: { dwt: 39460, owner: 'Atlas Maritime Corp' },
  POLYAIGOS: { dwt: 61200, owner: 'Neptune Ship Management' },
  'NORDIC STAR': { dwt: 47850, owner: 'Helios Tanker Holdings' },
  'PACIFIC GLORY': { dwt: 55600, owner: 'Continental Marine Owners' },
  'ARCADIA SUN': { dwt: 42300, owner: 'Trident Shipowning Ltd' },
  'HELLESPONT PRIDE': { dwt: 68900, owner: 'Solaris Maritime Holdings' },
  'ORION TRADER': { dwt: 36700, owner: 'Zafira Vessel Holdings' },
  'CRIMSON HORIZON': { dwt: 73400, owner: 'Orient Fleet Owners' },
};

const RAW_PNL_ROWS = [
  { id: 'SPOT-2601', type: 'spot', vessel: 'NEW INTEGRITY', charterer: 'Zafira Shipping & Trading', cpDate: '10-Jan-2026', eta: '16-Jan-2026', chrtPic: 'R. Sharma', opsPic: 'L. Ferreira', biz: 'Tanker', year: 2026, q: 'q1', revenue: 4.8, costs: 3.1 },
  { id: 'SPOT-2602', type: 'spot', vessel: 'OCEAN PRIDE', charterer: 'Orient Bulk Pte Ltd', cpDate: '18-Jan-2026', eta: '24-Jan-2026', chrtPic: 'T. Lindqvist', opsPic: 'D. Novak', biz: 'Tanker', year: 2026, q: 'q1', revenue: 2.6, costs: 1.9 },
  { id: 'COA-014-2026-S3', type: 'spot', vessel: 'SLF TRINITY', charterer: 'Zafira Shipping & Trading', cpDate: '03-Feb-2026', eta: '10-Feb-2026', chrtPic: 'A. Ibrahim', opsPic: 'K. Tanaka', biz: 'Tanker', year: 2026, q: 'q1', revenue: 5.4, costs: 3.6 },
  { id: 'SPOT-2609', type: 'spot', vessel: 'ANTARES', charterer: 'Nordic Tankers AS', cpDate: '27-Feb-2026', eta: '05-Mar-2026', chrtPic: 'M. Chen', opsPic: 'P. Andersen', biz: 'Tanker', year: 2026, q: 'q1', revenue: 3.2, costs: 2.4 },
  { id: 'SPOT-2614', type: 'spot', vessel: 'POLYAIGOS', charterer: 'Continental Petroleum Traders', cpDate: '14-Apr-2026', eta: '21-Apr-2026', chrtPic: 'J. Okafor', opsPic: 'N. Osei', biz: 'Tanker', year: 2026, q: 'q2', revenue: 6.1, costs: 4.0 },
  { id: 'COA-021-2026-S5', type: 'spot', vessel: 'NORDIC STAR', charterer: 'BlueWave Commodities', cpDate: '27-Apr-2026', eta: '04-May-2026', chrtPic: 'S. Kapoor', opsPic: 'V. Petrova', biz: 'Tanker', year: 2026, q: 'q2', revenue: 3.9, costs: 2.7 },
  { id: 'SPOT-2622', type: 'spot', vessel: 'PACIFIC GLORY', charterer: 'Falcon Tankers Pte Ltd', cpDate: '06-Jun-2026', eta: '13-Jun-2026', chrtPic: 'R. Sharma', opsPic: 'L. Ferreira', biz: 'Tanker', year: 2026, q: 'q2', revenue: 2.1, costs: 1.7 },
  { id: 'SPOT-2631', type: 'spot', vessel: 'ARCADIA SUN', charterer: 'Meridian Chartering Ltd', cpDate: '04-Jul-2026', eta: '11-Jul-2026', chrtPic: 'T. Lindqvist', opsPic: 'D. Novak', biz: 'Tanker', year: 2026, q: 'q3', revenue: 4.4, costs: 3.0 },
  { id: 'SPOT-2638', type: 'spot', vessel: 'HELLESPONT PRIDE', charterer: 'Trident Energy Marine', cpDate: '16-Aug-2026', eta: '23-Aug-2026', chrtPic: 'A. Ibrahim', opsPic: 'K. Tanaka', biz: 'Tanker', year: 2026, q: 'q3', revenue: 3.6, costs: 2.6 },
  { id: 'SPOT-2645', type: 'spot', vessel: 'ORION TRADER', charterer: 'Solaris Bulk Carriers', cpDate: '30-Sep-2026', eta: '07-Oct-2026', chrtPic: 'M. Chen', opsPic: 'P. Andersen', biz: 'Tanker', year: 2026, q: 'q4', revenue: 5.0, costs: 3.3 },
  { id: 'TC-2603', type: 'tc', vessel: 'NEW INTEGRITY', charterer: 'Helios Marine Chartering', cpDate: '15-Jan-2026', eta: '—', chrtPic: 'J. Okafor', opsPic: 'N. Osei', biz: 'Tanker', year: 2026, q: 'q1', revenue: 7.8, costs: 5.9 },
  { id: 'TC-2607', type: 'tc', vessel: 'OCEAN PRIDE', charterer: 'Arcadia Shipping Group', cpDate: '28-Jan-2026', eta: '—', chrtPic: 'S. Kapoor', opsPic: 'V. Petrova', biz: 'Tanker', year: 2026, q: 'q1', revenue: 4.5, costs: 3.4 },
  { id: 'TC-2611', type: 'tc', vessel: 'CRIMSON HORIZON', charterer: 'Continental Petroleum Traders', cpDate: '12-Feb-2026', eta: '—', chrtPic: 'R. Sharma', opsPic: 'L. Ferreira', biz: 'Tanker', year: 2026, q: 'q1', revenue: 8.2, costs: 6.1 },
  { id: 'TC-2616', type: 'tc', vessel: 'SLF TRINITY', charterer: 'Nordic Tankers AS', cpDate: '25-Mar-2026', eta: '—', chrtPic: 'T. Lindqvist', opsPic: 'D. Novak', biz: 'Tanker', year: 2026, q: 'q2', revenue: 3.0, costs: 2.3 },
  { id: 'TC-2624', type: 'tc', vessel: 'ANTARES', charterer: 'BlueWave Commodities', cpDate: '15-Apr-2026', eta: '—', chrtPic: 'A. Ibrahim', opsPic: 'K. Tanaka', biz: 'Tanker', year: 2026, q: 'q2', revenue: 7.1, costs: 5.3 },
  { id: 'TC-2629', type: 'tc', vessel: 'POLYAIGOS', charterer: 'Meridian Chartering Ltd', cpDate: '30-May-2026', eta: '—', chrtPic: 'M. Chen', opsPic: 'P. Andersen', biz: 'Tanker', year: 2026, q: 'q2', revenue: 4.0, costs: 3.0 },
  { id: 'TC-2636', type: 'tc', vessel: 'NORDIC STAR', charterer: 'Falcon Tankers Pte Ltd', cpDate: '18-Jul-2026', eta: '—', chrtPic: 'J. Okafor', opsPic: 'N. Osei', biz: 'Tanker', year: 2026, q: 'q3', revenue: 5.9, costs: 4.4 },
  { id: 'TC-2643', type: 'tc', vessel: 'PACIFIC GLORY', charterer: 'Trident Energy Marine', cpDate: '02-Sep-2026', eta: '—', chrtPic: 'S. Kapoor', opsPic: 'V. Petrova', biz: 'Tanker', year: 2026, q: 'q3', revenue: 8.5, costs: 6.2 },
];

const ELAPSED_QUARTERS = { q1: true, q2: true, q3: true, q4: false };

const PNL_ROWS = RAW_PNL_ROWS.map((r) => {
  const net = +(r.revenue - r.costs).toFixed(2);
  const margin = r.revenue ? +((net / r.revenue) * 100).toFixed(1) : 0;
  const vi = VESSEL_INFO[r.vessel] || { dwt: 0, owner: '—' };
  return {
    ...r,
    net,
    margin,
    status: ELAPSED_QUARTERS[r.q] ? 'Actual' : 'Estimated',
    dwt: vi.dwt,
    owner: vi.owner,
  };
});

const COLUMN_DEFS = [
  { key: 'vessel', label: 'Vessel', defaultOn: true },
  { key: 'dwt', label: 'DWT', defaultOn: true },
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

/** Full figure from millions (no currency symbol). */
function fmtFull(millions) {
  const full = Math.round(millions * 1e6);
  const sign = full < 0 ? '-' : '';
  return `${sign}${Math.abs(full).toLocaleString('en-US')}`;
}

/** Compact M/K for KPI cards / split legend (no currency). */
function fmtCardAbbrev(millions) {
  const abs = Math.abs(millions);
  const sign = millions < 0 ? '-' : '';
  if (abs === 0) return '0.0M';
  if (abs < 1) return `${sign}${Math.round(abs * 1000).toLocaleString('en-US')}K`;
  return `${sign}${abs.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
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

const NUMERIC_KEYS = new Set(['dwt', 'cpDate', 'eta', 'revenue', 'costs', 'net', 'margin']);

export default function PlAtAGlancePage() {
  const setHeading = usePageHeaderHeading();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('2026');
  const [periodFilter, setPeriodFilter] = useState('full');
  const [bizFilter, setBizFilter] = useState('Tanker');
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
          <span className={styles.titleMuted}> - At a Glance</span>
        </span>
      ),
    });
    return () => setHeading(null);
  }, [setHeading]);

  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((c) => columnState[c.key]),
    [columnState],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PNL_ROWS.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (periodFilter !== 'full' && r.q !== periodFilter) return false;
      if (yearFilter !== 'all' && String(r.year) !== yearFilter) return false;
      if (bizFilter !== 'all' && r.biz !== bizFilter) return false;
      if (q) {
        const hay = `${r.id} ${r.vessel} ${r.charterer} ${r.owner}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, typeFilter, yearFilter, periodFilter, bizFilter]);

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
    const totalNet = +(totalRevenue - totalCosts).toFixed(2);
    const avgMargin = totalRevenue ? (totalNet / totalRevenue) * 100 : 0;
    const totalPnlSplit = spotNet + tcNet;
    const spotPct = totalPnlSplit > 0 ? (spotNet / totalPnlSplit) * 100 : 50;
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

  const handleExport = (format) => {
    const action = format === 'Email'
      ? `Attaching a ${filteredRows.length}-record report`
      : `Downloading as ${format}`;
    showToast(
      `${action} — Voy No. + ${visibleColumns.length} selected field${visibleColumns.length === 1 ? '' : 's'} for ${filteredRows.length} record${filteredRows.length === 1 ? '' : 's'} — illustrative only in this mockup.`,
    );
    setExportOpen(false);
  };

  return (
    <>
      <PageHeaderActions deps={[search, typeFilter, yearFilter, periodFilter, bizFilter]}>
        <HeaderFilterControls>
          <PageHeaderSearch
            value={search}
            onChange={setSearch}
            placeholder="Search vessel / charterer / contract no."
          />
          <CardSelect
            options={TYPE_OPTIONS}
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="Contract type"
            ariaLabel="Contract type"
          />
          <CardSelect
            options={YEAR_OPTIONS}
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
                  <tr key={r.id}>
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
                  <td colSpan={visibleColumns.length + 2}>No contracts match the current filters.</td>
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

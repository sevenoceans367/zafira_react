import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import {
  CardSelect,
  HeaderFilterControls,
  PageHeaderSearch,
  PeriodCardPicker,
} from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import { reportAppPath } from '../../../constants/reportsMenu.js';
import styles from './AgingReportPage.module.css';

const PAGE_SIZE = 10;

const TRADE_OPTIONS = [
  { id: 'all', name: 'All Trades' },
  { id: 'spot', name: 'Spot' },
  { id: 'tc', name: 'TC' },
  { id: 'coa', name: 'COA' },
  { id: 'period', name: 'Period' },
  { id: 'relet', name: 'Cargo Relet' },
];

const DAYS_OPTIONS = [
  { id: 'all', name: 'All Open' },
  { id: '0-30', name: '0 - 30 Days' },
  { id: '31-60', name: '31 - 60 Days' },
  { id: '61-90', name: '61 - 90 Days' },
  { id: '90+', name: '90+ Days' },
];

const BIZ_OPTIONS = [
  { id: 'all', name: 'All Business Types' },
  { id: 'Tanker', name: 'Tankers' },
  { id: 'Dry Cargo', name: 'Dry' },
  { id: 'Gas', name: 'Gas' },
];

const CHIP_CLASS = {
  spot: styles.typeChipSpot,
  tc: styles.typeChipTc,
  coa: styles.typeChipCoa,
  period: styles.typeChipPeriod,
  relet: styles.typeChipRelet,
};

const CHIP_LABEL = {
  spot: 'SPOT',
  tc: 'TC',
  coa: 'COA',
  period: 'PERIOD',
  relet: 'RELET',
};

const ACCENT = {
  spot: '#f4652c',
  tc: '#14919b',
  coa: '#6c47ff',
  period: '#3b82f6',
  relet: '#5b6472',
};

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const AR_ROWS_RAW = [
  { customer: 'Zafira Shipping & Trading', contractType: 'spot', biz: 'Tanker', voyageNo: 'SPOT-2601', vessel: 'NEW INTEGRITY', cpDate: '10-Jan-2026', docType: 'Freight', docNo: 'INV-10041', docDate: '15-Jun-2026', amtIn: 480000, amtOut: 355000, delayDays: 96, status: 'Open' },
  { customer: 'Orient Bulk Pte Ltd', contractType: 'spot', biz: 'Tanker', voyageNo: 'SPOT-2602', masterContract: 'COA-088-2026', vessel: 'OCEAN PRIDE', cpDate: '18-Jan-2026', docType: 'Freight', docNo: 'INV-10052', docDate: '24-Jul-2026', amtIn: 260000, amtOut: 180000, delayDays: 57, status: 'Open' },
  { customer: 'Continental Grain Traders', contractType: 'coa', biz: 'Dry Cargo', voyageNo: 'COA-088-2026-L2', vessel: 'NORD PIONEER', cpDate: '02-Aug-2026', docType: 'Freight', docNo: 'INV-20031', docDate: '05-Aug-2026', amtIn: 610000, amtOut: 400000, delayDays: 45, status: 'Open' },
  { customer: 'Zafira Grain Trading', contractType: 'coa', biz: 'Dry Cargo', voyageNo: 'COA-091-2026-L5', vessel: 'CORAL ISLAND', cpDate: '14-Aug-2026', docType: 'Freight', docNo: 'INV-20044', docDate: '20-Aug-2026', amtIn: 395000, amtOut: 300000, delayDays: 30, status: 'Open' },
  { customer: 'Helios Gas Chartering', contractType: 'tc', biz: 'Gas', voyageNo: 'TC-3311', vessel: 'GAS PIONEER', cpDate: '—', docType: 'Hire', docNo: 'INV-30015', docDate: '02-Sep-2026', amtIn: 260000, amtOut: 200000, delayDays: 17, status: 'Open' },
  { customer: 'Trident Gas Chartering', contractType: 'tc', biz: 'Gas', voyageNo: 'TC-3298', vessel: 'POLAR MIST', cpDate: '—', docType: 'Hire', docNo: 'INV-30022', docDate: '01-Jul-2026', amtIn: 410000, amtOut: 260000, delayDays: 80, status: 'Open' },
  { customer: 'Continental Petroleum Traders', contractType: 'tc', biz: 'Tanker', voyageNo: 'TC-2611', vessel: 'CRIMSON HORIZON', cpDate: '12-Feb-2026', docType: 'Hire', docNo: 'INV-10077', docDate: '12-Feb-2026', amtIn: 820000, amtOut: 500000, delayDays: 219, status: 'Open' },
  { customer: 'Nordic Tankers AS', contractType: 'spot', biz: 'Tanker', voyageNo: 'SPOT-2609', vessel: 'ANTARES', cpDate: '27-Feb-2026', docType: 'Freight', docNo: 'INV-10088', docDate: '27-Feb-2026', amtIn: 320000, amtOut: 320000, delayDays: 0, status: 'Closed' },
  { customer: 'Orient Bulk Traders', contractType: 'coa', biz: 'Dry Cargo', voyageNo: 'COA-072-2026-D9', vessel: 'SILVER HORIZON', cpDate: '23-Sep-2026', docType: 'Freight', docNo: 'INV-20058', docDate: '12-Sep-2026', amtIn: 580000, amtOut: 535000, delayDays: 7, status: 'Open' },
  { customer: 'BlueWave Gas Trading', contractType: 'tc', biz: 'Gas', voyageNo: 'TC-3345', vessel: 'ARCTIC FLAME', cpDate: '—', docType: 'Hire', docNo: 'INV-30037', docDate: '15-Aug-2026', amtIn: 195000, amtOut: 140000, delayDays: 35, status: 'Open' },
  { customer: 'Falcon Tankers Pte Ltd', contractType: 'spot', biz: 'Tanker', voyageNo: 'SPOT-2622', vessel: 'PACIFIC GLORY', cpDate: '06-Jun-2026', docType: 'Freight', docNo: 'INV-10095', docDate: '06-Jun-2026', amtIn: 210000, amtOut: 210000, delayDays: 0, status: 'Closed' },
  { customer: 'Meridian Chartering Ltd', contractType: 'coa', biz: 'Dry Cargo', voyageNo: 'COA-065-2026-D3', vessel: 'EASTERN GLORY', cpDate: '18-Aug-2026', docType: 'Freight', docNo: 'INV-20066', docDate: '18-Aug-2026', amtIn: 600000, amtOut: 425000, delayDays: 32, status: 'Open' },
  { customer: 'Falcon Gas Chartering', contractType: 'tc', biz: 'Gas', voyageNo: 'TC-3210', vessel: 'NORTHERN COMET', cpDate: '—', docType: 'Hire', docNo: 'INV-30049', docDate: '17-Sep-2026', amtIn: 195000, amtOut: 174000, delayDays: 2, status: 'Open' },
  { customer: 'Solaris Bulk Carriers', contractType: 'spot', biz: 'Tanker', voyageNo: 'SPOT-2645', vessel: 'ORION TRADER', cpDate: '30-May-2026', docType: 'Freight', docNo: 'INV-10102', docDate: '30-May-2026', amtIn: 500000, amtOut: 225000, delayDays: 112, status: 'Open' },
  { customer: 'Trident Energy Marine', contractType: 'period', biz: 'Tanker', voyageNo: 'PERIOD-2026-04', vessel: 'STELLAR HORIZON', cpDate: '04-Apr-2026', docType: 'Hire', docNo: 'INV-40010', docDate: '10-Aug-2026', amtIn: 900000, amtOut: 700000, delayDays: 40, status: 'Open' },
  { customer: 'Orient Bulk Pte Ltd', contractType: 'relet', biz: 'Tanker', voyageNo: 'RELET-4401', masterContract: 'PERIOD-2026-04', vessel: 'CRIMSON HORIZON', cpDate: '12-Sep-2026', docType: 'Freight', docNo: 'INV-40025', docDate: '14-Sep-2026', amtIn: 150000, amtOut: 60000, delayDays: 5, status: 'Open' },
];

const AP_ROWS_RAW = [
  { customer: 'Aegean Bunkering DMCC', contractType: 'spot', biz: 'Tanker', voyageNo: 'SPOT-2601', vessel: 'NEW INTEGRITY', cpDate: '10-Jan-2026', docType: 'Bunkers', docNo: 'BILL-10041', docDate: '15-Jun-2026', amtIn: 480000, amtOut: 355000, delayDays: 96, status: 'Open' },
  { customer: 'World Fuel Services', contractType: 'spot', biz: 'Tanker', voyageNo: 'SPOT-2602', masterContract: 'COA-088-2026', vessel: 'OCEAN PRIDE', cpDate: '18-Jan-2026', docType: 'Port DA', docNo: 'BILL-10052', docDate: '24-Jul-2026', amtIn: 260000, amtOut: 180000, delayDays: 57, status: 'Open' },
  { customer: 'Wilhelmsen Ships Service', contractType: 'coa', biz: 'Dry Cargo', voyageNo: 'COA-088-2026-L2', vessel: 'NORD PIONEER', cpDate: '02-Aug-2026', docType: 'Port DA', docNo: 'BILL-20031', docDate: '05-Aug-2026', amtIn: 610000, amtOut: 400000, delayDays: 45, status: 'Open' },
  { customer: 'GAC Shipping', contractType: 'coa', biz: 'Dry Cargo', voyageNo: 'COA-091-2026-L5', vessel: 'CORAL ISLAND', cpDate: '14-Aug-2026', docType: 'Bunkers', docNo: 'BILL-20044', docDate: '20-Aug-2026', amtIn: 395000, amtOut: 300000, delayDays: 30, status: 'Open' },
  { customer: 'Monjasa A/S', contractType: 'tc', biz: 'Gas', voyageNo: 'TC-3311', vessel: 'GAS PIONEER', cpDate: '—', docType: 'Management Fee', docNo: 'BILL-30015', docDate: '02-Sep-2026', amtIn: 260000, amtOut: 200000, delayDays: 17, status: 'Open' },
  { customer: 'Peninsula Petroleum', contractType: 'tc', biz: 'Gas', voyageNo: 'TC-3298', vessel: 'POLAR MIST', cpDate: '—', docType: 'Bunkers', docNo: 'BILL-30022', docDate: '01-Jul-2026', amtIn: 410000, amtOut: 260000, delayDays: 80, status: 'Open' },
  { customer: 'V.Group Ship Management', contractType: 'tc', biz: 'Tanker', voyageNo: 'TC-2611', vessel: 'CRIMSON HORIZON', cpDate: '12-Feb-2026', docType: 'Management Fee', docNo: 'BILL-10077', docDate: '12-Feb-2026', amtIn: 820000, amtOut: 500000, delayDays: 219, status: 'Open' },
  { customer: 'Inchcape Shipping Services', contractType: 'spot', biz: 'Tanker', voyageNo: 'SPOT-2609', vessel: 'ANTARES', cpDate: '27-Feb-2026', docType: 'Port DA', docNo: 'BILL-10088', docDate: '27-Feb-2026', amtIn: 320000, amtOut: 320000, delayDays: 0, status: 'Closed' },
  { customer: 'Sinotrans Shipping', contractType: 'coa', biz: 'Dry Cargo', voyageNo: 'COA-072-2026-D9', vessel: 'SILVER HORIZON', cpDate: '23-Sep-2026', docType: 'Port DA', docNo: 'BILL-20058', docDate: '12-Sep-2026', amtIn: 580000, amtOut: 535000, delayDays: 7, status: 'Open' },
  { customer: 'Bomin Bunker Oil', contractType: 'tc', biz: 'Gas', voyageNo: 'TC-3345', vessel: 'ARCTIC FLAME', cpDate: '—', docType: 'Bunkers', docNo: 'BILL-30037', docDate: '15-Aug-2026', amtIn: 195000, amtOut: 140000, delayDays: 35, status: 'Open' },
  { customer: 'Vopak Terminals', contractType: 'spot', biz: 'Tanker', voyageNo: 'SPOT-2622', vessel: 'PACIFIC GLORY', cpDate: '06-Jun-2026', docType: 'Port DA', docNo: 'BILL-10095', docDate: '06-Jun-2026', amtIn: 210000, amtOut: 210000, delayDays: 0, status: 'Closed' },
  { customer: 'Global Ports Holding', contractType: 'coa', biz: 'Dry Cargo', voyageNo: 'COA-065-2026-D3', vessel: 'EASTERN GLORY', cpDate: '18-Aug-2026', docType: 'Port DA', docNo: 'BILL-20066', docDate: '18-Aug-2026', amtIn: 600000, amtOut: 425000, delayDays: 32, status: 'Open' },
  { customer: 'Korea Marine Agency', contractType: 'tc', biz: 'Gas', voyageNo: 'TC-3210', vessel: 'NORTHERN COMET', cpDate: '—', docType: 'Management Fee', docNo: 'BILL-30049', docDate: '17-Sep-2026', amtIn: 195000, amtOut: 174000, delayDays: 2, status: 'Open' },
  { customer: 'Busan Port Services', contractType: 'spot', biz: 'Tanker', voyageNo: 'SPOT-2645', vessel: 'ORION TRADER', cpDate: '30-May-2026', docType: 'Bunkers', docNo: 'BILL-10102', docDate: '30-May-2026', amtIn: 500000, amtOut: 225000, delayDays: 112, status: 'Open' },
  { customer: 'Trident Ship Management', contractType: 'period', biz: 'Tanker', voyageNo: 'PERIOD-2026-04', vessel: 'STELLAR HORIZON', cpDate: '04-Apr-2026', docType: 'Management Fee', docNo: 'BILL-40010', docDate: '10-Aug-2026', amtIn: 900000, amtOut: 700000, delayDays: 40, status: 'Open' },
  { customer: 'GAC Shipping', contractType: 'relet', biz: 'Tanker', voyageNo: 'RELET-4401', masterContract: 'PERIOD-2026-04', vessel: 'CRIMSON HORIZON', cpDate: '12-Sep-2026', docType: 'Port DA', docNo: 'BILL-40025', docDate: '14-Sep-2026', amtIn: 150000, amtOut: 60000, delayDays: 5, status: 'Open' },
];

function parseLegacyDate(str) {
  if (!str || str === '—') return null;
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(str);
  if (!m) return null;
  const mi = MONTH_NAMES.indexOf(m[2].toLowerCase());
  if (mi === -1) return null;
  return new Date(+m[3], mi, +m[1]);
}

function parseDmy(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function enrichRows(raw, partyKey) {
  return raw.map((r) => ({
    ...r,
    party: r[partyKey],
    diff: r.amtIn - r.amtOut,
    docDateObj: parseLegacyDate(r.docDate),
  }));
}

const AR_ROWS = enrichRows(AR_ROWS_RAW, 'customer');
const AP_ROWS = enrichRows(AP_ROWS_RAW, 'customer');

function bucketOf(days) {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

function bucketClass(bucket) {
  if (bucket === '0-30') return styles.bucketB0;
  if (bucket === '31-60') return styles.bucketB1;
  if (bucket === '61-90') return styles.bucketB2;
  return styles.bucketB3;
}

function fmt(n) {
  return n.toLocaleString('en-US');
}

function getColumnDefs(mode) {
  const isAr = mode === 'receivables';
  return [
    { key: 'voyageNo', label: 'Voyage No.', defaultOn: true },
    { key: 'vessel', label: 'Vessel', defaultOn: true },
    { key: 'cpDate', label: 'CP Date', defaultOn: false },
    { key: 'docType', label: isAr ? 'Invoice Type' : 'Bill Type', defaultOn: false },
    { key: 'docNo', label: isAr ? 'Invoice No.' : 'Bill No.', defaultOn: false },
    { key: 'docDate', label: isAr ? 'Invoice Date' : 'Bill Date', defaultOn: false },
    { key: 'amtIn', label: isAr ? 'Amount Invoiced' : 'Amount Billed', defaultOn: true },
    { key: 'amtOut', label: isAr ? 'Amount Received' : 'Amount Paid', defaultOn: true },
    { key: 'diff', label: 'Difference', defaultOn: true },
    { key: 'delayDays', label: 'Delay (Days)', defaultOn: true },
    { key: 'status', label: 'Status', defaultOn: true },
  ];
}

function defaultColumnState(columnDefs) {
  const next = {};
  columnDefs.forEach((c) => { next[c.key] = c.defaultOn; });
  return next;
}

const NUMERIC_KEYS = new Set(['voyageNo', 'cpDate', 'docNo', 'docDate', 'amtIn', 'amtOut', 'diff', 'delayDays']);

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

function CrossNavLink({ to, label }) {
  return (
    <Link to={appPath(to)} className={styles.crossNavBtn}>
      {label}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h13" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

function renderCell(key, row) {
  switch (key) {
    case 'voyageNo':
      return (
        <div className={styles.voyageCell}>
          <span>{row.voyageNo}</span>
          {row.masterContract ? (
            <span className={styles.masterLine}>Master: {row.masterContract}</span>
          ) : null}
        </div>
      );
    case 'vessel':
      return row.vessel;
    case 'cpDate':
      return row.cpDate === '—' ? <span className={styles.dash}>—</span> : row.cpDate;
    case 'docType':
      return row.docType;
    case 'docNo':
      return row.docNo;
    case 'docDate':
      return row.docDate;
    case 'amtIn':
      return fmt(row.amtIn);
    case 'amtOut':
      return fmt(row.amtOut);
    case 'diff':
      return (
        <span className={row.diff > 0 ? styles.netNeg : undefined}>{fmt(row.diff)}</span>
      );
    case 'delayDays': {
      const bucket = bucketOf(row.delayDays);
      return (
        <span className={`${styles.bucketPill} ${bucketClass(bucket)}`}>
          {row.delayDays}d
        </span>
      );
    }
    case 'status':
      return (
        <span className={`${styles.statusPill} ${row.status === 'Open' ? styles.statusOpen : styles.statusClosed}`}>
          {row.status}
        </span>
      );
    default:
      return '—';
  }
}

/**
 * Shared Aging Report page for Receivables and Payables mock layouts.
 * @param {'receivables' | 'payables'} mode
 */
export default function AgingReportPage({ mode = 'receivables' }) {
  const isAr = mode === 'receivables';
  const columnDefs = useMemo(() => getColumnDefs(mode), [mode]);
  const rows = isAr ? AR_ROWS : AP_ROWS;
  const partyLabel = 'Customer';
  const partyAllLabel = 'All Customers';
  const searchPlaceholder = 'Search';
  const emptyMessage = isAr
    ? 'No invoices match the current filters.'
    : 'No bills match the current filters.';
  const crossNav = isAr
    ? { to: reportAppPath('accounts', 'aging-report-payable'), label: 'Go to Payables' }
    : { to: reportAppPath('accounts', 'aging-report-receivables'), label: 'Go to Receivables' };
  const mutedTitle = isAr ? ' Receivables' : ' Payables';

  const setHeading = usePageHeaderHeading();
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState('all');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [bizFilter, setBizFilter] = useState('all');
  const [tradeFilter, setTradeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [columnState, setColumnState] = useState(() => defaultColumnState(getColumnDefs(mode)));
  const [exportOpen, setExportOpen] = useState(false);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [toast, setToast] = useState('');
  const exportRef = useRef(null);
  const colPickerRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    setColumnState(defaultColumnState(columnDefs));
    setPartyFilter('all');
    setDaysFilter('all');
    setPeriodFrom('');
    setPeriodTo('');
    setBizFilter('all');
    setTradeFilter('all');
    setSearch('');
    setPage(1);
  }, [mode, columnDefs]);

  useEffect(() => {
    setHeading({
      title: (
        <span>
          Aging Report
          <span className={styles.titleMuted}>{mutedTitle}</span>
        </span>
      ),
      stacked: true,
    });
    return () => setHeading(null);
  }, [setHeading, mutedTitle]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) setExportOpen(false);
      if (colPickerRef.current && !colPickerRef.current.contains(event.target)) setColPickerOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const partyOptions = useMemo(() => {
    const names = [];
    rows.forEach((r) => {
      if (!names.includes(r.party)) names.push(r.party);
    });
    names.sort();
    return [{ id: 'all', name: partyAllLabel }, ...names.map((n) => ({ id: n, name: n }))];
  }, [rows, partyAllLabel]);

  const visibleColumns = useMemo(
    () => columnDefs.filter((c) => columnState[c.key]),
    [columnDefs, columnState],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rangeStart = parseDmy(periodFrom);
    const rangeEnd = parseDmy(periodTo);
    return rows.filter((r) => {
      if (partyFilter !== 'all' && r.party !== partyFilter) return false;
      if (daysFilter !== 'all' && bucketOf(r.delayDays) !== daysFilter) return false;
      if (bizFilter !== 'all' && r.biz !== bizFilter) return false;
      if (tradeFilter !== 'all' && r.contractType !== tradeFilter) return false;
      if (rangeStart && rangeEnd && r.docDateObj) {
        if (r.docDateObj < rangeStart || r.docDateObj > rangeEnd) return false;
      }
      if (query) {
        const hay = `${r.party} ${r.vessel} ${r.voyageNo} ${r.docNo} ${r.masterContract || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [rows, search, partyFilter, daysFilter, bizFilter, tradeFilter, periodFrom, periodTo]);

  useEffect(() => {
    setPage(1);
  }, [search, partyFilter, daysFilter, bizFilter, tradeFilter, periodFrom, periodTo, mode]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE) || 1);
  const safePage = Math.min(page, totalPages);
  const fromIdx = filteredRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const toIdx = Math.min(safePage * PAGE_SIZE, filteredRows.length);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const tableMinWidth = Math.max(760, (visibleColumns.length + 2) * 128);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };

  const handleExport = (format) => {
    const noun = isAr ? 'invoice' : 'bill';
    const action = format === 'Email'
      ? `Attaching a ${filteredRows.length}-record report`
      : `Downloading as ${format}`;
    showToast(
      `${action} — ${partyLabel} + ${visibleColumns.length} selected field${visibleColumns.length === 1 ? '' : 's'} for ${filteredRows.length} ${noun}${filteredRows.length === 1 ? '' : 's'} — illustrative only in this mockup.`,
    );
    setExportOpen(false);
  };

  return (
    <>
      <PageHeaderActions deps={[search, partyFilter, daysFilter, periodFrom, periodTo, bizFilter, tradeFilter, crossNav.to, crossNav.label]}>
        <div className={styles.headerFiltersRow}>
          <div className={styles.headerFiltersMain}>
            <HeaderFilterControls align="start">
              <PageHeaderSearch
                value={search}
                onChange={setSearch}
                placeholder={searchPlaceholder}
              />
              <PeriodCardPicker
                from={periodFrom}
                to={periodTo}
                onChange={({ from, to }) => {
                  setPeriodFrom(from || '');
                  setPeriodTo(to || '');
                }}
                label="Select Period"
                title="Select Period"
                subtitle="Read the full fiscal year, or narrow to a portion of the calendar"
              />
              <CardSelect
                options={DAYS_OPTIONS}
                value={daysFilter}
                onChange={setDaysFilter}
                placeholder="Accounting Period"
                ariaLabel="Accounting Period"
              />
              <CardSelect
                options={partyOptions}
                value={partyFilter}
                onChange={setPartyFilter}
                placeholder={partyLabel}
                ariaLabel={partyLabel}
              />
              <CardSelect
                options={BIZ_OPTIONS}
                value={bizFilter}
                onChange={setBizFilter}
                placeholder="Business type"
                ariaLabel="Business type"
              />
              <CardSelect
                options={TRADE_OPTIONS}
                value={tradeFilter}
                onChange={setTradeFilter}
                placeholder="Trade type"
                ariaLabel="Trade type"
              />
            </HeaderFilterControls>
          </div>
          <CrossNavLink to={crossNav.to} label={crossNav.label} />
        </div>
      </PageHeaderActions>

      <div className={`zafira-page ${styles.page}`}>
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
                      {columnDefs.map((col) => (
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
                        onClick={() => setColumnState(defaultColumnState(columnDefs))}
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
                <th>{partyLabel} / Trade Type</th>
                {visibleColumns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? pageRows.map((r, i) => {
                const rowNum = (safePage - 1) * PAGE_SIZE + i + 1;
                const accent = ACCENT[r.contractType] || ACCENT.relet;
                return (
                  <tr key={`${r.docNo}-${r.voyageNo}`}>
                    <td className={styles.accentCell} style={{ borderLeftColor: accent }}>
                      {rowNum}.
                    </td>
                    <td>
                      <div className={styles.partyCell}>
                        <span className={styles.cellId}>
                          <span className={styles.trunc} title={r.party}>{r.party}</span>
                        </span>
                        <span className={`${styles.typeChip} ${CHIP_CLASS[r.contractType] || styles.typeChipRelet}`}>
                          {CHIP_LABEL[r.contractType] || String(r.contractType).toUpperCase()}
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
                  <td colSpan={visibleColumns.length + 2}>{emptyMessage}</td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>

      {toast ? (
        <div className={`${styles.toast} ${styles.toastShow}`} role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}

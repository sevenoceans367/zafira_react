import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ActionButtonStack,
  DownloadIcon,
  LoadingOverlay,
  EditRecapIcon,
  SecondaryActionButton,
  SendToOpsButton,
  useConfirm,
} from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { useCargoReletModule } from '../../../hooks/useCargoReletModule.js';
import {
  advanceStandaloneCargoReletOps,
  fetchStandaloneCargoRelets,
  sendStandaloneCargoReletToOps,
} from '../../../services/cargoRelets.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import CargoReletHeaderActions from './CargoReletHeaderActions.jsx';
import styles from './CargoReletListPage.module.css';

const EXPORT_PAGE_SIZE = 5000;

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  return [
    { id: 'all', name: 'All Years' },
    { id: String(current), name: String(current) },
    { id: String(current - 1), name: String(current - 1) },
  ];
})();

const BUSINESS_TABS = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const OPS_TABS = [
  { id: 'ops', label: 'In Ops' },
  { id: 'history', label: 'History' },
];

function liveValue(value) {
  if (value == null) return '—';
  const text = String(value).trim();
  return text === '' ? '—' : text;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TabIcon({ id }) {
  if (id === 'completed' || id === 'history') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9.5" />
      </svg>
    );
  }
  if (id === 'cancelled') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
      </svg>
    );
  }
  if (id === 'ops') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 16l1.5-6h13L20 16c-1 1.5-3 2.5-8 2.5S5 17.5 4 16z" />
        <path d="M9 10V5h6v5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HighlightIcon({ name }) {
  if (name === 'revenue' || name === 'wave') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12h4l2 7 4-14 2 7h6" />
      </svg>
    );
  }
  if (name === 'qty' || name === 'cargo') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v18" />
        <path d="M16.5 7.5c0-2-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.3 9 2 9 6.3 0 2-2 3.2-4.5 3.2s-4.5-1-4.5-3" />
      </svg>
    );
  }
  if (name === 'balance') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 14l1.3-5.2A2 2 0 0 1 8.2 7.3h7.6a2 2 0 0 1 1.9 1.5L19 14" />
        <path d="M12 3v4.3" />
        <path d="M12 3.5l3 1.2-3 1.1z" fill="currentColor" stroke="none" />
        <path d="M3 17.5c1.4 1 3 1 4.4 0 1.4-1 3-1 4.4 0 1.4 1 3 1 4.4 0" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v13" />
      <path d="M8 10h8" />
      <path d="M5 14a7 7 0 0 0 14 0" />
    </svg>
  );
}

function parseBusinessStatus(value) {
  if (value === 'completed' || value === 'cancelled') return value;
  return 'active';
}

function parseOpsStatus(value) {
  // Post Ops removed — legacy ?status=postops opens History
  if (value === 'history' || value === 'postops' || value === 'post-ops') return 'history';
  return 'ops';
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (text.includes(',') || text.includes('"')) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename, headers, rows) {
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ];
  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportColumns(isOps) {
  const cols = [
    { key: '#', get: (row) => row.index },
    { key: 'Relet No.', get: (row) => row.reletNo },
    { key: 'Vessel', get: (row) => row.vesselName },
    { key: 'Date', get: (row) => row.transDate || row.coaDate },
    { key: 'Charterer', get: (row) => row.charterer },
    { key: 'Cargo', get: (row) => row.cargo },
    { key: 'LP/DP', get: (row) => row.ports },
    { key: 'QTY (MT)', get: (row) => row.cargoQty },
    { key: 'Frt-In ($/MT)', get: (row) => row.freightInPerMt },
    { key: 'Frt-In', get: (row) => row.freightInAmt },
    { key: 'FO Surcharge', get: (row) => row.foSurcharge },
    { key: 'Frt-Out ($/MT)', get: (row) => row.freightOutPerMt },
    { key: 'Frt-Out', get: (row) => row.freightOutAmt },
    { key: 'P&L', get: (row) => row.profit },
  ];
  if (!isOps) cols.push({ key: 'Sent to Ops', get: (row) => (row.sentToOps || row.fixed ? 'Yes' : 'No') });
  return cols;
}

function mapExportRows(records, isOps) {
  const cols = exportColumns(isOps);
  return (records || []).map((row) => {
    const out = {};
    cols.forEach((col) => {
      out[col.key] = col.get(row) ?? '';
    });
    return out;
  });
}

function openPdfPrintWindow(title, headers, rows) {
  const win = window.open('', '_blank');
  if (!win) return;
  const head = headers.map((h) => `<th>${String(h).replace(/</g, '&lt;')}</th>`).join('');
  const body = rows.map((row) => (
    `<tr>${headers.map((h) => `<td>${String(row[h] ?? '').replace(/</g, '&lt;')}</td>`).join('')}</tr>`
  )).join('');
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#1b2430}
      h1{font-size:18px;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #dfe2e7;padding:6px 8px;text-align:left}
      th{background:#fafbfc;text-transform:uppercase;font-size:10px;color:#5b6472}
    </style></head><body>
    <h1>${title}</h1>
    <table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}">No records</td></tr>`}</tbody></table>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  win.document.close();
}

export default function CargoReletListPage({ variant = 'business' }) {
  const isOps = variant === 'ops';
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { cargoReletAddPath, cargoReletEditPath } = useCargoReletModule();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = isOps ? OPS_TABS : BUSINESS_TABS;
  const [activeTab, setActiveTab] = useState(
    isOps ? parseOpsStatus(searchParams.get('status')) : parseBusinessStatus(searchParams.get('status')),
  );
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [year, setYear] = useState(searchParams.get('selYear') || (isOps ? String(new Date().getFullYear()) : 'all'));
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ count: 0, revenue: 0, qty: 0 });
  const [tabCounts, setTabCounts] = useState({});
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 10);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [loading, setLoading] = useState(true);
  const [advancingId, setAdvancingId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState('');
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const updateQuery = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([key, value]) => {
        if (value == null || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const types = await fetchVcBusinessTypes(businessType);
        if (!cancelled) setBusinessTypes(types);
      } catch {
        if (!cancelled) setBusinessTypes([]);
      }
    })();
    return () => { cancelled = true; };
  }, [businessType]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const listParams = {
        selBType: businessType,
        page,
        pageSize,
        search: debouncedSearch,
        status: activeTab,
        view: isOps ? 'ops' : 'business',
        ...(isOps ? { selYear: year === 'all' ? '' : year } : {}),
      };
      const data = await fetchStandaloneCargoRelets(listParams);
      setRows(data.records || []);
      setRecordsTotal(Number(data.recordsTotal || 0));

      const all = await fetchStandaloneCargoRelets({
        selBType: businessType,
        page: 1,
        pageSize: 500,
        search: debouncedSearch,
        view: isOps ? 'ops' : 'business',
        status: isOps ? '' : undefined,
        ...(isOps ? { selYear: year === 'all' ? '' : year } : {}),
      });
      const allRows = all.records || [];
      const revenue = allRows.reduce((sum, row) => sum + (Number(String(row.profit ?? '').replace(/,/g, '')) || 0), 0);
      const qty = allRows.reduce((sum, row) => sum + (Number(String(row.cargoQty ?? '').replace(/,/g, '')) || 0), 0);
      setStats({ count: allRows.length, revenue, qty });

      if (isOps) {
        setTabCounts({
          ops: allRows.filter((r) => r.opsStage === 'ops' || (!r.opsStage && r.fixed && Number(r.finalStatus || 0) <= 1 && r.updateStatus !== 3)).length,
          history: allRows.filter((r) => r.opsStage === 'history' || Number(r.finalStatus) >= 2).length,
        });
      } else {
        setTabCounts({
          active: allRows.filter((r) => r.updateStatus !== 3).length,
          completed: 0,
          cancelled: allRows.filter((r) => r.updateStatus === 3).length,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load cargo relets.');
      setRows([]);
      setRecordsTotal(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab, businessType, debouncedSearch, isOps, page, pageSize, year]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    updateQuery({
      status: activeTab,
      selBType: businessType,
      page: String(page),
      pageSize: String(pageSize),
      search: debouncedSearch || undefined,
      ...(isOps ? { selYear: year === 'all' ? undefined : year } : {}),
    });
  }, [activeTab, businessType, debouncedSearch, isOps, page, pageSize, updateQuery, year]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const fetchExportRows = useCallback(async () => {
    const data = await fetchStandaloneCargoRelets({
      selBType: businessType,
      page: 1,
      pageSize: EXPORT_PAGE_SIZE,
      search: debouncedSearch,
      status: activeTab,
      view: isOps ? 'ops' : 'business',
      ...(isOps ? { selYear: year === 'all' ? '' : year } : {}),
    });
    return mapExportRows(data.records || [], isOps);
  }, [activeTab, businessType, debouncedSearch, isOps, year]);

  const handleAdvanceOps = async (row) => {
    const nextLabel = row.nextLabel || 'History';
    const ok = await confirm({
      title: `Move to ${nextLabel}`,
      message: `Move ${row.reletNo || 'this cargo relet'} to ${nextLabel}?`,
      confirmLabel: 'Move',
    });
    if (!ok) return;
    setAdvancingId(row.fcaId);
    setError('');
    try {
      await advanceStandaloneCargoReletOps(row.fcaId);
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to advance cargo relet.');
    } finally {
      setAdvancingId(null);
    }
  };

  const handleReplicate = (row) => {
    navigate(
      `${cargoReletAddPath}?replicateFrom=${encodeURIComponent(row.fcaId)}&selBType=${encodeURIComponent(businessType)}`,
    );
  };

  const handleSendToOps = async (row) => {
    if (!row?.fcaId || sendingId) return;
    const ok = await confirm({
      title: 'Send to Operations',
      message: `Are you sure you want to send ${row.reletNo || 'this cargo relet'} to Ops?`,
      confirmLabel: 'Send to Ops',
      cancelLabel: 'Cancel',
      confirmVariant: 'accent',
    });
    if (!ok) return;
    setSendingId(row.fcaId);
    setError('');
    try {
      await sendStandaloneCargoReletToOps(row.fcaId);
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to send cargo relet to Ops.');
    } finally {
      setSendingId(null);
    }
  };

  const handleDownloadExcel = async () => {
    setMenuOpen(false);
    try {
      const exportRows = await fetchExportRows();
      const headers = exportColumns(isOps).map((col) => col.key);
      downloadCsv(`cargo-relets-${activeTab}.csv`, headers, exportRows);
    } catch (err) {
      setError(err.message || 'Failed to download Excel.');
    }
  };

  const handleDownloadPdf = async () => {
    setMenuOpen(false);
    try {
      const exportRows = await fetchExportRows();
      const headers = exportColumns(isOps).map((col) => col.key);
      openPdfPrintWindow(`Cargo Relets — ${activeTab}`, headers, exportRows);
    } catch (err) {
      setError(err.message || 'Failed to download PDF.');
    }
  };

  const handleEmail = async () => {
    setMenuOpen(false);
    try {
      const exportRows = await fetchExportRows();
      const headers = exportColumns(isOps).map((col) => col.key);
      const lines = [
        headers.join('\t'),
        ...exportRows.map((row) => headers.map((header) => String(row[header] ?? '')).join('\t')),
      ];
      const fullBody = `Cargo Relets (${activeTab}) — ${exportRows.length} record(s)\n\n${lines.join('\n')}`;
      // mailto URLs have practical length limits across clients
      const maxBody = 1800;
      const body = fullBody.length > maxBody
        ? `${fullBody.slice(0, maxBody)}\n\n…(truncated; use Download as Excel for the full list)`
        : fullBody;
      window.location.href = `mailto:?subject=${encodeURIComponent(`Cargo Relets — ${activeTab}`)}&body=${encodeURIComponent(body)}`;
    } catch (err) {
      setError(err.message || 'Failed to prepare email.');
    }
  };

  const highlights = useMemo(() => {
    if (isOps) {
      return [
        { key: 'revenue', label: 'Ops Revenue (YTD)', value: stats.revenue.toLocaleString(), tone: 'red', icon: 'revenue' },
        { key: 'ops', label: 'In Ops', value: String(tabCounts.ops ?? 0), tone: 'cnt', icon: 'count' },
        { key: 'hist', label: 'Completed (History)', value: String(tabCounts.history ?? 0), tone: 'cnt', icon: 'count' },
      ];
    }
    return [
      { key: 'qty', label: 'Cargo on Relets (MT)', value: stats.qty.toLocaleString(), tone: 'red', icon: 'cargo' },
      { key: 'active', label: 'Active Relets', value: String(tabCounts.active ?? stats.count), tone: 'cnt', icon: 'count' },
      { key: 'revenue', label: 'Relet Revenue (YTD)', value: stats.revenue.toLocaleString(), tone: 'red', icon: 'wave' },
      { key: 'balance', label: 'Total Balance Qty (MT)', value: stats.qty.toLocaleString(), tone: 'cnt', icon: 'balance' },
    ];
  }, [isOps, stats, tabCounts]);

  const emptyMessage = isOps
    ? 'No cargo relet ops records match this filter.'
    : 'No cargo relets match this filter.';

  const colSpan = isOps ? 16 : 16;

  return (
    <div className={`zafira-page ${styles.page}`}>
      <CargoReletHeaderActions
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={(value) => {
          setBusinessType(value || '2');
          setPage(1);
        }}
        {...(isOps ? {
          yearOptions: YEAR_OPTIONS,
          year,
          onYearChange: (value) => {
            setYear(value || 'all');
            setPage(1);
          },
        } : {})}
      />
      {error ? <div className={styles.error}>{error}</div> : null}
      <LoadingOverlay show={loading} label={isOps ? 'Loading Cargo Relet Ops…' : 'Loading Cargo Relets…'} />

      <div className={styles.hcardGrid}>
        {highlights.map((card) => (
          <div
            key={card.key}
            className={`${styles.hcard} ${card.tone === 'red' ? styles.hcardRed : styles.hcardCnt}`}
          >
            <div className={styles.hcardHead}>
              <div className={styles.hcardIcon}>
                <HighlightIcon name={card.icon} />
              </div>
            </div>
            <span className={styles.hcardLabel}>{card.label}</span>
            <p className={styles.hcardValue}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className={styles.statusTabs} role="tablist" aria-label={isOps ? 'Ops status' : 'Relet status'}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.statusTab} ${activeTab === tab.id ? styles.statusTabActive : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
          >
            <TabIcon id={tab.id} />
            <span>{tab.label}</span>
            <span className={styles.tabCount}>{tabCounts[tab.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <ScrollableTable
        flushTop
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        toolbarStart={(
          !isOps ? (
            <div className={styles.menuWrap} ref={menuRef}>
              <button
                type="button"
                className={styles.btnMore}
                aria-label="More options"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                title="Download"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>
              {menuOpen ? (
                <div className={styles.menuDropdown} role="menu">
                  <button type="button" role="menuitem" className={styles.menuItem} onClick={handleDownloadExcel}>
                    <span className={styles.menuIcon} aria-hidden>
                      <DownloadIcon size={16} title="" />
                    </span>
                    Download as Excel
                  </button>
                  <button type="button" role="menuitem" className={styles.menuItem} onClick={handleDownloadPdf}>
                    <span className={styles.menuIcon} aria-hidden>
                      <DownloadIcon size={16} title="" />
                    </span>
                    Download as PDF
                  </button>
                  <button type="button" role="menuitem" className={styles.menuItem} onClick={handleEmail}>
                    <span className={styles.menuIcon} aria-hidden>
                      <DownloadIcon size={16} title="" />
                    </span>
                    Email
                  </button>
                </div>
              ) : null}
            </div>
          ) : null
        )}
        toolbarLeft={(
          !isOps ? (
            <button
              type="button"
              className={styles.btnAdd}
              onClick={() => navigate(`${cargoReletAddPath}?selBType=${businessType}`)}
            >
              <PlusIcon />
              Add
            </button>
          ) : null
        )}
        footer={<SopfPagination page={page} pageSize={pageSize} total={recordsTotal} onPageChange={setPage} />}
      >
        <table className={styles.grid}>
          <thead>
            <tr>
              <th>#</th>
              <th>Relet No.</th>
              <th>Vessel</th>
              <th>Date</th>
              <th>Charterer</th>
              <th>Cargo</th>
              <th>LP/DP</th>
              <th>QTY (MT)</th>
              <th>Frt-In ($/MT)</th>
              <th>Frt-In</th>
              <th>FO Surcharge</th>
              <th>Frt-Out ($/MT)</th>
              <th>Frt-Out</th>
              <th>P&amp;L</th>
              {!isOps ? <th>Actions</th> : null}
              <th>Edit</th>
              {isOps ? <th>Next</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className={styles.emptyCell}>{emptyMessage}</td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.fcaId}>
                <td className={styles.accentCell}>{row.index}</td>
                <td>{liveValue(row.reletNo)}</td>
                <td>{liveValue(row.vesselName)}</td>
                <td>{liveValue(row.transDate || row.coaDate)}</td>
                <td>{liveValue(row.charterer)}</td>
                <td>{liveValue(row.cargo)}</td>
                <td title={liveValue(row.ports)}>{liveValue(row.ports)}</td>
                <td>{liveValue(row.cargoQty)}</td>
                <td>{liveValue(row.freightInPerMt)}</td>
                <td>{liveValue(row.freightInAmt)}</td>
                <td>{liveValue(row.foSurcharge)}</td>
                <td>{liveValue(row.freightOutPerMt)}</td>
                <td>{liveValue(row.freightOutAmt)}</td>
                <td>{liveValue(row.profit)}</td>
                {!isOps ? (
                  <td>
                    <ActionButtonStack className={styles.rowActions}>
                      <SecondaryActionButton
                        label="Replicate"
                        className={`${styles.pillAction} ${styles.pillReplicate}`}
                        onClick={() => handleReplicate(row)}
                        ariaLabel={`Replicate ${row.reletNo || row.fcaId}`}
                      />
                      {row.canSendToOps ? (
                        <SendToOpsButton
                          className={`${styles.pillAction} ${styles.pillSendOps}`}
                          onClick={() => handleSendToOps(row)}
                          disabled={sendingId === row.fcaId}
                          ariaLabel={`Send to Ops ${row.reletNo || row.fcaId}`}
                        />
                      ) : row.sentToOps || row.fixed ? (
                        <span className={styles.sentLabel}>Sent to Ops</span>
                      ) : null}
                    </ActionButtonStack>
                  </td>
                ) : null}
                <td>
                  <Link className={styles.iconBtn} to={cargoReletEditPath(row.fcaId)} title="Edit Cargo Relet">
                    <EditRecapIcon size={16} />
                  </Link>
                </td>
                {isOps ? (
                  <td>
                    {row.canAdvanceOps && row.nextLabel ? (
                      <button
                        type="button"
                        className={styles.pillNext}
                        disabled={advancingId === row.fcaId}
                        onClick={() => handleAdvanceOps(row)}
                      >
                        {row.nextLabel}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14" />
                          <path d="M13 6l6 6-6 6" />
                        </svg>
                      </button>
                    ) : (
                      <span className={styles.dash}>—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  );
}

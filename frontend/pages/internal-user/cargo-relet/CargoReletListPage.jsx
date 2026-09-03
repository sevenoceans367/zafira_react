import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay, EditRecapIcon } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { useCargoReletModule } from '../../../hooks/useCargoReletModule.js';
import { fetchStandaloneCargoRelets } from '../../../services/cargoRelets.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import CargoReletHeaderActions from './CargoReletHeaderActions.jsx';
import styles from './CargoReletListPage.module.css';

const BUSINESS_TABS = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const OPS_TABS = [
  { id: 'ops', label: 'In Ops' },
  { id: 'postops', label: 'Post Ops' },
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

function StatusBadge({ status }) {
  const key = String(status || '').toLowerCase();
  let className = styles.statusDraft;
  if (key.includes('cancel')) className = styles.statusCancelled;
  else if (key.includes('complete')) className = styles.statusCompleted;
  else if (key.includes('active')) className = styles.statusActive;
  return <span className={className}>{status || '—'}</span>;
}

function parseBusinessStatus(value) {
  if (value === 'completed' || value === 'cancelled') return value;
  return 'active';
}

function parseOpsStatus(value) {
  if (value === 'postops' || value === 'history') return value;
  return 'ops';
}

export default function CargoReletListPage({ variant = 'business' }) {
  const isOps = variant === 'ops';
  const navigate = useNavigate();
  const { cargoReletAddPath, cargoReletEditPath } = useCargoReletModule();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = isOps ? OPS_TABS : BUSINESS_TABS;
  const [activeTab, setActiveTab] = useState(
    isOps ? parseOpsStatus(searchParams.get('status')) : parseBusinessStatus(searchParams.get('status')),
  );
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ count: 0, revenue: 0, qty: 0 });
  const [tabCounts, setTabCounts] = useState({});
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 10);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recordsTotal, setRecordsTotal] = useState(0);

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
      const data = await fetchStandaloneCargoRelets({
        selBType: businessType,
        page,
        pageSize,
        search: debouncedSearch,
        status: activeTab,
        view: isOps ? 'ops' : 'business',
      });
      setRows(data.records || []);
      setRecordsTotal(Number(data.recordsTotal || 0));

      const all = await fetchStandaloneCargoRelets({
        selBType: businessType,
        page: 1,
        pageSize: 500,
        search: debouncedSearch,
        view: isOps ? 'ops' : 'business',
      });
      const allRows = all.records || [];
      const revenue = allRows.reduce((sum, row) => sum + (Number(String(row.profit ?? '').replace(/,/g, '')) || 0), 0);
      const qty = allRows.reduce((sum, row) => sum + (Number(String(row.cargoQty ?? '').replace(/,/g, '')) || 0), 0);
      setStats({ count: allRows.length, revenue, qty });

      if (isOps) {
        setTabCounts({
          ops: allRows.filter((r) => r.fixed && r.updateStatus !== 3).length,
          postops: 0,
          history: allRows.filter((r) => r.updateStatus === 3).length,
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
  }, [activeTab, businessType, debouncedSearch, isOps, page, pageSize]);

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
    });
  }, [activeTab, businessType, debouncedSearch, page, pageSize, updateQuery]);

  const highlights = useMemo(() => {
    if (isOps) {
      return [
        { key: 'revenue', label: 'Ops Revenue (YTD)', value: stats.revenue.toLocaleString(), tone: 'red', icon: 'revenue' },
        { key: 'ops', label: 'In Ops', value: String(tabCounts.ops ?? 0), tone: 'cnt', icon: 'count' },
        { key: 'post', label: 'Post Ops', value: String(tabCounts.postops ?? 0), tone: 'cnt', icon: 'count' },
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
        toolbarLeft={(
          !isOps ? (
            <button
              type="button"
              className={styles.btnAdd}
              onClick={() => navigate(cargoReletAddPath)}
            >
              <PlusIcon />
              Add New Cargo Relet
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
              {!isOps ? <th>Status</th> : null}
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
                {!isOps ? <td><StatusBadge status={row.status} /></td> : null}
                <td>
                  <Link className={styles.iconBtn} to={cargoReletEditPath(row.fcaId)} title="Edit Cargo Relet">
                    <EditRecapIcon size={16} />
                  </Link>
                </td>
                {isOps ? <td>—</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  );
}

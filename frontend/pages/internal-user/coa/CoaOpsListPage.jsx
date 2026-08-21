import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay, useConfirm, CardSelect } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { useCoaModule } from '../../../hooks/useCoaModule.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import {
  fetchCargoRelets,
  fetchCoaOpsVoyages,
  moveVoyageToPostOps,
} from '../../../services/coas.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import CoaListHeaderActions from './CoaListHeaderActions.jsx';
import styles from './CoaOpsPage.module.css';

const OPS_TABS = [
  { id: 'ops', label: 'In Ops' },
  { id: 'postops', label: 'Post Ops' },
  { id: 'history', label: 'History' },
];

const TRADE_TYPES = [
  { id: 'spot', label: 'Spot', color: '#e67e22' },
  { id: 'relet', label: 'Cargo Relet', color: '#7c5cff' },
];

function parseTab(value) {
  if (value === 'postops' || value === '2') return 'postops';
  if (value === 'history') return 'history';
  return 'ops';
}

function parseTradeType(value) {
  return value === 'relet' || value === 'cargo-relet' ? 'relet' : 'spot';
}

function statusForTab(tab) {
  if (tab === 'postops') return '2';
  return '1';
}

function liveValue(value) {
  if (value == null) return '—';
  const text = String(value).trim();
  return text === '' ? '—' : text;
}

function formatMoney(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function yearFromDate(value) {
  const text = String(value || '');
  const match = text.match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

function TabIcon({ id }) {
  if (id === 'postops') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9.5" />
      </svg>
    );
  }
  if (id === 'history') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 16l1.5-6h13L20 16c-1 1.5-3 2.5-8 2.5S5 17.5 4 16z" />
      <path d="M9 10V5h6v5" />
    </svg>
  );
}

function HighlightIcon({ name }) {
  if (name === 'ops') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v13" />
        <path d="M8 10h8" />
        <path d="M5 14a7 7 0 0 0 14 0" />
      </svg>
    );
  }
  if (name === 'postops') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12h4l2 7 4-14 2 7h6" />
      </svg>
    );
  }
  if (name === 'history') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18" />
      <path d="M16.5 7.5c0-2-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.3 9 2 9 6.3 0 2-2 3.2-4.5 3.2s-4.5-1-4.5-3" />
    </svg>
  );
}

export default function CoaOpsListPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { coaPath } = useCoaModule();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [tradeType, setTradeType] = useState(parseTradeType(searchParams.get('tradeType')));
  const [statusTab, setStatusTab] = useState(parseTab(searchParams.get('tab')));
  const [yearFilter, setYearFilter] = useState(searchParams.get('year') || 'all');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ ops: 0, postops: 0, history: 0, revenue: 0 });
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const isRelet = tradeType === 'relet';
  const isHistoryTab = statusTab === 'history';

  const updateQuery = useCallback((patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '' || value === 'all' || (key === 'tab' && value === 'ops') || (key === 'tradeType' && value === 'spot')) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [
      { id: 'all', name: 'All Years' },
      { id: String(current), name: String(current) },
      { id: String(current - 1), name: String(current - 1) },
      { id: String(current - 2), name: String(current - 2) },
    ];
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      if (isRelet) {
        const data = await fetchCargoRelets({
          selBType: businessType,
          page: 1,
          pageSize: 200,
          search: debouncedSearch,
        });
        const all = (data.records ?? []).filter((row) => {
          if (yearFilter === 'all') return true;
          return yearFromDate(row.coaDate) === Number(yearFilter);
        });
        // FIXED=1 means submitted to ops (PHP finalize), not "closed/history".
        const submitted = all.filter((row) => row.fixed);
        const revenue = submitted.reduce((sum, row) => sum + (Number(String(row.profit ?? '').replace(/,/g, '')) || 0), 0);
        setCounts({
          ops: all.length,
          postops: 0,
          history: 0,
          revenue,
        });
        return;
      }

      const [inOps, postOps] = await Promise.all([
        fetchCoaOpsVoyages({
          selBType: businessType,
          status: '1',
          page: 1,
          pageSize: 200,
          search: debouncedSearch,
        }),
        fetchCoaOpsVoyages({
          selBType: businessType,
          status: '2',
          page: 1,
          pageSize: 200,
          search: debouncedSearch,
        }),
      ]);
      const filterYear = (list) => (list.records ?? []).filter((row) => {
        if (yearFilter === 'all') return true;
        return yearFromDate(row.cpDate) === Number(yearFilter);
      });
      const opsRows = filterYear(inOps);
      const postRows = filterYear(postOps);
      const revenue = [...opsRows, ...postRows].reduce(
        (sum, row) => sum + (Number(String(row.profitLoss ?? '').replace(/,/g, '')) || 0),
        0,
      );
      setCounts({
        ops: opsRows.length,
        postops: postRows.length,
        history: 0,
        revenue,
      });
    } catch {
      // keep previous counts on soft failure
    }
  }, [businessType, debouncedSearch, isRelet, yearFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const types = await fetchVcBusinessTypes(businessType);
      setBusinessTypes(types);

      if (isRelet) {
        // Cargo relets: In Ops lists working sheets (draft + submitted).
        // History/Post Ops are spot-voyage stages — empty for relets.
        if (statusTab === 'postops' || statusTab === 'history') {
          setRows([]);
          setTotal(0);
          return;
        }
        const data = await fetchCargoRelets({
          selBType: businessType,
          page: 1,
          pageSize: 200,
          search: debouncedSearch,
        });
        const filtered = (data.records ?? []).filter((row) => {
          if (yearFilter !== 'all' && yearFromDate(row.coaDate) !== Number(yearFilter)) return false;
          return true;
        });
        const start = (page - 1) * pageSize;
        setTotal(filtered.length);
        setRows(filtered.slice(start, start + pageSize).map((row, index) => ({
          ...row,
          index: start + index + 1,
        })));
        return;
      }

      if (isHistoryTab) {
        setRows([]);
        setTotal(0);
        return;
      }

      const data = await fetchCoaOpsVoyages({
        selBType: businessType,
        status: statusForTab(statusTab),
        page: 1,
        pageSize: 200,
        search: debouncedSearch,
      });
      const filtered = (data.records ?? []).filter((row) => {
        if (yearFilter === 'all') return true;
        return yearFromDate(row.cpDate) === Number(yearFilter);
      });
      const start = (page - 1) * pageSize;
      setTotal(filtered.length);
      setRows(filtered.slice(start, start + pageSize).map((row, index) => ({
        ...row,
        index: start + index + 1,
      })));
    } catch (err) {
      setError(err.message || 'Failed to load COA operations.');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    businessType,
    debouncedSearch,
    isHistoryTab,
    isRelet,
    page,
    pageSize,
    statusTab,
    yearFilter,
  ]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { setPage(1); }, [debouncedSearch, businessType, statusTab, tradeType, yearFilter, pageSize]);

  const handleMove = async (row) => {
    const nextLabel = statusTab === 'ops' ? 'Post Ops' : 'History';
    const ok = await confirm({
      title: `Move to ${nextLabel}`,
      message: `Move voyage ${row.voyageNo} to ${nextLabel}?`,
      confirmLabel: 'Move',
    });
    if (!ok) return;
    if (statusTab !== 'ops') {
      setError('History moves are not available yet.');
      return;
    }
    try {
      await moveVoyageToPostOps(row.comId);
      load();
      loadCounts();
    } catch (err) {
      setError(err.message || 'Failed to move voyage.');
    }
  };

  const cards = [
    { title: 'Ops Revenue (YTD)', value: formatMoney(counts.revenue), variant: 'fin', icon: 'revenue' },
    { title: 'In Ops', value: String(counts.ops), variant: 'cnt', icon: 'ops' },
    { title: 'Post Ops', value: String(counts.postops), variant: 'fin', icon: 'postops' },
    { title: 'Completed (History)', value: String(counts.history), variant: 'cnt', icon: 'history' },
  ];

  const showingLabel = total === 0
    ? 'Showing 0 records'
    : `Showing ${Math.min((page - 1) * pageSize + 1, total)} to ${Math.min(page * pageSize, total)} of ${total} entries`;

  const emptyMessage = isRelet && statusTab === 'postops'
    ? 'Cargo relets skip Post Ops — complete a relet from In Ops to move it to History.'
    : isHistoryTab && !isRelet
      ? 'No completed history voyages yet.'
      : 'SORRY CURRENTLY THERE ARE ZERO(0) RECORDS';

  const tradeMeta = TRADE_TYPES.find((item) => item.id === tradeType) || TRADE_TYPES[0];

  return (
    <>
      <CoaListHeaderActions
        search={searchInput}
        onSearchChange={(value) => {
          setSearchInput(value);
          updateQuery({ q: value || null });
        }}
        searchPlaceholder="Search vessel / COA"
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={(value) => {
          setBusinessType(value);
          updateQuery({ selBType: value });
        }}
        extra={(
          <>
            <CardSelect
              options={TRADE_TYPES.map((item) => ({ id: item.id, name: item.label }))}
              value={tradeType}
              leadingDot={tradeMeta.color}
              tone="muted"
              ariaLabel="Contract trade type"
              placeholder="Trade type"
              onChange={(value) => {
                const next = parseTradeType(value);
                setTradeType(next);
                if (next === 'relet' && statusTab === 'postops') setStatusTab('ops');
                updateQuery({
                  tradeType: next,
                  tab: next === 'relet' && statusTab === 'postops' ? 'ops' : statusTab,
                });
              }}
            />
            <CardSelect
              options={yearOptions}
              value={yearFilter}
              tone="muted"
              ariaLabel="Year"
              placeholder="All Years"
              onChange={(value) => {
                const next = value || 'all';
                setYearFilter(next);
                updateQuery({ year: next });
              }}
            />
          </>
        )}
        extraKey={`${tradeType}|${yearFilter}|${statusTab}`}
      />

      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay show={loading} fullScreen={false} label="Loading COA operations…" />
        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.hcardGrid}>
          {cards.map((card) => (
            <article
              key={card.title}
              className={`${styles.hcard} ${card.variant === 'cnt' ? styles.hcardCnt : styles.hcardFin}`}
            >
              <div className={styles.hcardHead}>
                <div className={styles.hcardIcon}>
                  <HighlightIcon name={card.icon} />
                </div>
              </div>
              <span className={styles.hcardLabel}>{card.title}</span>
              <div className={styles.hcardValue}>{card.value}</div>
            </article>
          ))}
        </div>

        <div className={styles.statusTabs} role="tablist" aria-label="Ops status">
          {OPS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusTab === tab.id}
              className={`${styles.statusTab} ${statusTab === tab.id ? styles.statusTabActive : ''}`}
              onClick={() => {
                setStatusTab(tab.id);
                updateQuery({ tab: tab.id });
              }}
            >
              <TabIcon id={tab.id} />
              {tab.label}
              <span className={styles.tabCount}>{counts[tab.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <ScrollableTable
          flushTop
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          toolbarRight={showingLabel}
          footer={<SopfPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />}
        >
          {isRelet ? (
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Relet No.</th>
                  <th>Date</th>
                  <th>QTY (MT)</th>
                  <th>LP/DP</th>
                  <th>Frt-In ($/MT)</th>
                  <th>Frt-In</th>
                  <th>FO Surcharge</th>
                  <th>Frt-Out ($/MT)</th>
                  <th>Frt-Out</th>
                  <th>Profit</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className={styles.emptyCell}>{emptyMessage}</td>
                  </tr>
                ) : rows.map((row) => (
                  <tr key={row.fcaId}>
                    <td className={`${styles.accentCell} ${styles.accentRelet}`}>{row.index}</td>
                    <td>
                      <div className={styles.opsCell}>
                        <span className={styles.coaNo}>{liveValue(row.coaIdentity || row.coaNo)}</span>
                        <span className={styles.subNo}>{liveValue(row.reletNo)}</span>
                        <span className={`${styles.typeChip} ${styles.typeChipRelet}`}>Cargo Relet</span>
                      </div>
                    </td>
                    <td>{liveValue(row.coaDate)}</td>
                    <td className={styles.cellNum}>{liveValue(row.cargoQty)}</td>
                    <td>{liveValue(row.ports)}</td>
                    <td className={styles.cellNum}>{liveValue(row.freightInPerMt)}</td>
                    <td className={styles.cellNum}>{liveValue(row.freightInAmt)}</td>
                    <td className={styles.cellNum}>{liveValue(row.foSurcharge)}</td>
                    <td className={styles.cellNum}>{liveValue(row.freightOutPerMt)}</td>
                    <td className={styles.cellNum}>{liveValue(row.freightOutAmt)}</td>
                    <td className={styles.cellNum}>{liveValue(row.profit)}</td>
                    <td>
                      <span className={`${styles.statusPill} ${row.fixed ? styles.statusActive : styles.statusDraft}`}>
                        {row.fixed ? 'Ops' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      <Link className={styles.iconBtn} to={coaPath(`cargo-relet/${row.fcaId}`)} title="Open relet">
                        <i className="bi bi-pencil-square" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Voy No.</th>
                  <th>CP Date</th>
                  <th>Vessel</th>
                  <th>LP / DP</th>
                  <th>QTY (MT)</th>
                  <th>TCE</th>
                  <th>P/L</th>
                  <th>Status</th>
                  <th>Worksheet</th>
                  <th>Next</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className={styles.emptyCell}>{emptyMessage}</td>
                  </tr>
                ) : rows.map((row) => (
                  <tr key={`${row.comId}-${row.fcaId}`}>
                    <td className={`${styles.accentCell} ${styles.accentSpot}`}>{row.index}</td>
                    <td>
                      <div className={styles.opsCell}>
                        <span className={styles.coaNo}>{liveValue(row.coaIdentity || row.coaNo)}</span>
                        <span className={styles.subNo}>{liveValue(row.voyageNo)}</span>
                        <span className={`${styles.typeChip} ${styles.typeChipSpot}`}>Spot</span>
                      </div>
                    </td>
                    <td>{liveValue(row.cpDate)}</td>
                    <td>{liveValue(row.vesselName)}</td>
                    <td>{liveValue(row.ports)}</td>
                    <td className={styles.cellNum}>{liveValue(row.cargoQty)}</td>
                    <td className={styles.cellNum}>{liveValue(row.tce)}</td>
                    <td className={styles.cellNum}>{liveValue(row.profitLoss)}</td>
                    <td>
                      <span className={`${styles.statusPill} ${styles.statusActive}`}>{liveValue(row.status)}</span>
                    </td>
                    <td>
                      <div className={styles.iconBtnRow}>
                        <Link
                          className={styles.iconBtn}
                          to={`/internal-user/sopf/viewestimate?id=${row.fcaId}`}
                          title="View estimate"
                        >
                          <i className="bi bi-eye" aria-hidden />
                        </Link>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Edit estimate"
                          onClick={() => navigate(`/internal-user/sopf/updateestimate?id=${row.fcaId}`)}
                        >
                          <i className="bi bi-pencil-square" aria-hidden />
                        </button>
                      </div>
                    </td>
                    <td>
                      {row.canMoveToPostOps ? (
                        <button type="button" className={styles.pillNext} onClick={() => handleMove(row)}>
                          Post Ops
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14" />
                            <path d="M13 6l6 6-6 6" />
                          </svg>
                        </button>
                      ) : (
                        <span className={styles.dash}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ScrollableTable>
      </div>
    </>
  );
}

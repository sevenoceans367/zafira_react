import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { useTcModule } from '../../../hooks/useTcModule.js';
import {
  deleteTcEstimate,
  fetchTcBusinessTypes,
  fetchTcEstimates,
} from '../../../services/tcEstimates.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import TcDecisionChartModal from './TcDecisionChartModal.jsx';
import TcListHeaderActions from './TcListHeaderActions.jsx';
import styles from './TcBusinessPage.module.css';

const PAGE_SIZE = 10;
const DEFAULT_BUSINESS_TYPE = '2';

const FLASH = {
  0: { type: 'success', text: 'TC Out Estimate saved successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while saving TC Out Estimate.' },
  2: { type: 'success', text: 'TC Out Estimate deleted successfully.' },
  3: { type: 'success', text: 'Final TC Out Estimate sent to Decision Chart successfully.' },
};

function formatOpenTrade(value) {
  const amount = Number(value) || 0;
  if (amount >= 1000) {
    return `$${(amount / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function liveValue(value) {
  if (value == null) return '—';
  const text = String(value).trim();
  return text === '' ? '—' : text;
}

function HighlightIcon({ name }) {
  if (name === 'open') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v18" />
        <path d="M16.5 7.5c0-2-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.3 9 2 9 6.3 0 2-2 3.2-4.5 3.2s-4.5-1-4.5-3" />
      </svg>
    );
  }
  if (name === 'subs') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v13" />
        <path d="M8 10h8" />
        <path d="M5 14a7 7 0 0 0 14 0" />
      </svg>
    );
  }
  if (name === 'ops') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12h4l2 7 4-14 2 7h6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 14l1.3-5.2A2 2 0 0 1 8.2 7.3h7.6a2 2 0 0 1 1.9 1.5L19 14" />
      <path d="M12 3v4.3" />
      <path d="M12 3.5l3 1.2-3 1.1z" fill="currentColor" stroke="none" />
      <path d="M3 17.5c1.4 1 3 1 4.4 0 1.4-1 3-1 4.4 0 1.4 1 3 1 4.4 0 1.4-1 3-1 4.4 0" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3h9l5 5v13H6z" />
      <path d="M15 3v5h5" />
    </svg>
  );
}

export default function TcOutEstimatesListPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { tcPath } = useTcModule();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    openTrade: 0,
    vesselsInSubs: 0,
    tradesInOperations: 0,
    vesselsOnWater: 0,
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const businessType = searchParams.get('selBType') || DEFAULT_BUSINESS_TYPE;
  const periodFrom = searchParams.get('periodFrom') || '';
  const periodTo = searchParams.get('periodTo') || '';
  const flashMsg = searchParams.get('msg');
  const flash = flashMsg != null && flashMsg !== '' ? FLASH[Number(flashMsg)] : null;

  const updateQuery = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [types, data] = await Promise.all([
        fetchTcBusinessTypes(businessType),
        fetchTcEstimates({
          selBType: businessType,
          periodFrom,
          periodTo,
          search: debouncedSearch,
          page,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setBusinessTypes(types);
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
      setStats(data.stats ?? {
        openTrade: 0,
        vesselsInSubs: 0,
        tradesInOperations: 0,
        vesselsOnWater: 0,
      });
      setSelectedIds([]);
    } catch (err) {
      setError(err.message || 'Failed to load TC Out Estimates.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, periodFrom, periodTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, businessType, periodFrom, periodTo]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('msg');
        return next;
      }, { replace: true });
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [flash, setSearchParams]);

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

  const comparableIds = rows.filter((row) => row.canCompare).map((row) => String(row.tcOutId));
  const allComparableSelected = comparableIds.length > 0
    && comparableIds.every((id) => selectedIds.includes(id));
  const sensitivityEnabled = selectedIds.length > 0;

  const toggleAll = () => {
    setSelectedIds(allComparableSelected ? [] : comparableIds);
  };

  const toggleOne = (row) => {
    if (!row.canCompare) return;
    const id = String(row.tcOutId);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete TC Out Estimate',
      message: `Delete ${row.tcNo || row.tcOutId}? This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await deleteTcEstimate(row.tcOutId);
      updateQuery({ msg: 2 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to delete estimate.');
    }
  };

  const openDecisionChart = (ids = selectedIds) => {
    const next = ids.map(String);
    if (!next.length) return;
    setMenuOpen(false);
    setCompareIds(next);
    setCompareOpen(true);
  };

  const cards = [
    { key: 'open', title: 'Open Trades', value: formatOpenTrade(stats.openTrade), variant: 'fin' },
    { key: 'subs', title: 'Vessels in Subs', value: stats.vesselsInSubs ?? 0, variant: 'cnt' },
    { key: 'ops', title: 'Trades in Operations', value: formatOpenTrade(stats.tradesInOperations), variant: 'fin' },
    { key: 'water', title: 'Vessels on Water', value: stats.vesselsOnWater ?? 0, variant: 'cnt' },
  ];

  return (
    <div className={`zafira-page ${styles.page}`}>
      <TcListHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={(value) => updateQuery({ selBType: value })}
        periodFrom={periodFrom}
        periodTo={periodTo}
        onPeriodChange={({ from, to }) => updateQuery({ periodFrom: from || '', periodTo: to || '' })}
      />

      {loading ? <LoadingOverlay active label="Loading Time Charter Business…" /> : null}
      {flash ? (
        <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
          {flash.text}
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.hcardGrid}>
        {cards.map((card) => (
          <article
            key={card.key}
            className={`${styles.hcard} ${card.variant === 'cnt' ? styles.hcardCnt : styles.hcardFin}`}
          >
            <div className={styles.hcardHead}>
              <div className={styles.hcardIcon}>
                <HighlightIcon name={card.key} />
              </div>
            </div>
            <span className={styles.hcardLabel}>{card.title}</span>
            <div className={styles.hcardValue}>{card.value}</div>
          </article>
        ))}
      </div>

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.btnAdd}
          onClick={() => navigate(`${tcPath('add')}?selBType=${businessType}`)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add
        </button>
        <button
          type="button"
          className={`${styles.btnSensitivity} ${sensitivityEnabled ? styles.btnSensitivityEnabled : ''}`}
          disabled={!sensitivityEnabled}
          title={sensitivityEnabled ? 'Open Decision Chart for selected estimates' : 'Select a row to enable'}
          onClick={() => openDecisionChart()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19V5" />
            <path d="M8 19v-7" />
            <path d="M12 19V9" />
            <path d="M16 19v-4" />
            <path d="M20 19V6" />
          </svg>
          Sensitivity Analysis
        </button>
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.btnMore}
            aria-label="More options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
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
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                disabled={!sensitivityEnabled}
                onClick={() => openDecisionChart()}
              >
                Decision Chart
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  navigate(tcPath('decision-charts'));
                }}
              >
                Decision Chart List
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Vessel</th>
                <th>TC No.</th>
                <th>CP Date</th>
                <th>DWT</th>
                <th>Del-Redel</th>
                <th>TC Days</th>
                <th>Hire In</th>
                <th>Hire Out</th>
                <th>Total Rev</th>
                <th className={styles.compareHeader}>
                  <DocIcon />
                  <input
                    type="checkbox"
                    checked={allComparableSelected}
                    onChange={toggleAll}
                    disabled={!comparableIds.length}
                    aria-label="Select all comparable estimates"
                  />
                </th>
                <th>TC Recap</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.tcOutId}>
                  <td className={styles.cellItem}>{row.index}.</td>
                  <td className={styles.cellVessel}>{liveValue(row.vesselName)}</td>
                  <td className={styles.cellNum}>{liveValue(row.tcNo)}</td>
                  <td className={styles.cellNum}>{liveValue(row.cpDate)}</td>
                  <td className={styles.cellNum}>{liveValue(row.dwt)}</td>
                  <td className={styles.cellRoute}>{liveValue(row.delRedel || [row.delPort, row.reDelPort].filter(Boolean).join(' - '))}</td>
                  <td className={styles.cellNum}>{liveValue(row.tcDays)}</td>
                  <td className={styles.cellNum}>{liveValue(row.hireIn)}</td>
                  <td className={styles.cellNum}>{liveValue(row.hireOut || row.dailyGrossHire)}</td>
                  <td className={styles.cellNum}>{liveValue(row.totalRev)}</td>
                  <td>
                    {row.sentToDecisionChart ? (
                      <span className={styles.sentLabel}>Sent</span>
                    ) : row.canCompare ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(String(row.tcOutId))}
                        onChange={() => toggleOne(row)}
                        aria-label={`Select ${row.tcNo || row.vesselName}`}
                      />
                    ) : (
                      <span className={styles.sentLabel}>{row.compareLabel || '—'}</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      {row.canCompare ? (
                        <button
                          type="button"
                          className={`${styles.pillAction} ${styles.pillSendOps}`}
                          onClick={() => openDecisionChart([row.tcOutId])}
                        >
                          Send to Ops
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className={styles.iconPair}>
                      <Link
                        className={styles.iconBtn}
                        to={tcPath(`${row.tcOutId}/edit`)}
                        title="Edit fixture note"
                      >
                        <DocIcon />
                      </Link>
                      {row.sentToDecisionChart ? (
                        <Link
                          className={styles.iconBtn}
                          to={tcPath(`${row.tcOutId}/view`)}
                          title="View estimate"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </Link>
                      ) : (
                        <Link
                          className={styles.iconBtn}
                          to={tcPath(`${row.tcOutId}/calculate`)}
                          title="Calculate estimate"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <rect x="4" y="3" width="16" height="18" rx="2" />
                            <path d="M8 7h8M8 12h8M8 17h5" />
                          </svg>
                        </Link>
                      )}
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconDanger}`}
                        title="Delete"
                        onClick={() => handleDelete(row)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path d="M4 7h16" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M6 7l1 14h10l1-14" />
                          <path d="M9 7V4h6v3" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={13} className={styles.empty}>No TC Out Estimates found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <SopfPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      <TcDecisionChartModal
        open={compareOpen}
        ids={compareIds}
        onClose={() => setCompareOpen(false)}
        onSubmitted={() => {
          setCompareOpen(false);
          updateQuery({ msg: 3 });
          navigate(`${tcPath('decision-charts')}?msg=3`);
        }}
      />
    </div>
  );
}

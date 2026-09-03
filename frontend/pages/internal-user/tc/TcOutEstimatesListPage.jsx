import React, { useCallback, useEffect, useMemo, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ActionButtonStack,
  EditRecapIcon,
  LoadingOverlay,
  SecondaryActionButton,
  SendToOpsButton,
  useConfirm,
} from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { useTcModule } from '../../../hooks/useTcModule.js';
import {
  fetchTcBusinessTypes,
  fetchTcEstimates,
  sendTcEstimatesToOps,
} from '../../../services/tcEstimates.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import TcListHeaderActions from './TcListHeaderActions.jsx';
import styles from './TcBusinessPage.module.css';

const DEFAULT_BUSINESS_TYPE = '2';

const STATUS_TABS = [
  { id: 'active', label: 'Active' },
  { id: 'activeInOps', label: 'Performing' },
];

const FLASH = {
  0: { type: 'success', text: 'TC Out Estimate saved successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while saving TC Out Estimate.' },
  2: { type: 'success', text: 'TC Out Estimate deleted successfully.' },
  3: { type: 'success', text: 'TC Out Estimate sent to TC Ops successfully.' },
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

function isInOps(row) {
  return Boolean(row.sentToDecisionChart);
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

function TabIcon({ id }) {
  if (id === 'activeInOps') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9.5" />
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

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function stageForRow(row) {
  const raw = String(row.opsStage || row.stage || '').toLowerCase();
  if (raw.includes('post')) return 'postops';
  return 'ops';
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
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const businessType = searchParams.get('selBType') || DEFAULT_BUSINESS_TYPE;
  const periodFrom = searchParams.get('periodFrom') || '';
  const periodTo = searchParams.get('periodTo') || '';
  const statusTab = searchParams.get('status') === 'activeInOps' ? 'activeInOps' : 'active';
  const flashMsg = searchParams.get('msg');
  const flash = useTimedFlash(flashMsg != null && flashMsg !== '' ? FLASH[Number(flashMsg)] : null);

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
          pageSize,
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
    } catch (err) {
      setError(err.message || 'Failed to load TC Out Estimates.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, pageSize, periodFrom, periodTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, businessType, periodFrom, periodTo, pageSize, statusTab]);

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

  const activeRows = useMemo(() => rows.filter((row) => !isInOps(row)), [rows]);
  const opsRows = useMemo(() => rows.filter((row) => isInOps(row)), [rows]);
  const visibleRows = statusTab === 'activeInOps' ? opsRows : activeRows;

  const handleSendToOps = async (ids = []) => {
    const next = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!next.length || sending) return;

    const ok = await confirm({
      title: 'Send to Operations',
      message: next.length === 1
        ? 'Are you sure you want to send this TC estimate to TC Ops?'
        : `Are you sure you want to send ${next.length} TC estimates to TC Ops?`,
      confirmLabel: 'Send to Ops',
      cancelLabel: 'Cancel',
      confirmVariant: 'accent',
    });
    if (!ok) return;

    setSending(true);
    setError('');
    try {
      await sendTcEstimatesToOps(next);
      updateQuery({ msg: 3, status: 'activeInOps' });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to send TC estimate to Ops.');
    } finally {
      setSending(false);
    }
  };

  const handleReplicate = (row) => {
    navigate(
      `${tcPath('add')}?replicateFrom=${encodeURIComponent(row.tcOutId)}&selBType=${encodeURIComponent(businessType)}`,
    );
  };

  const cards = [
    { key: 'open', title: 'Open Trades', value: formatOpenTrade(stats.openTrade), variant: 'fin' },
    { key: 'subs', title: 'Vessels on Subs', value: stats.vesselsInSubs ?? 0, variant: 'cnt' },
    { key: 'ops', title: 'Trades in Operations', value: formatOpenTrade(stats.tradesInOperations), variant: 'fin' },
    { key: 'water', title: 'Vessels on Water', value: stats.vesselsOnWater ?? 0, variant: 'cnt' },
  ];

  const toolbarActions = statusTab === 'active' ? (
    <div className={styles.toolbarActions}>
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
    </div>
  ) : (
    <div className={styles.viewOnlyNoteInline}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      View only — fixtures already sent to Ops
    </div>
  );

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

      {loading || sending ? (
        <LoadingOverlay
          show
          label={sending ? 'Sending to TC Ops…' : 'Loading Time Charter Business…'}
        />
      ) : null}
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

      <div className={styles.statusTabs} role="tablist" aria-label="TC Business status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={statusTab === tab.id}
            className={`${styles.statusTab} ${statusTab === tab.id ? styles.statusTabActive : ''}`}
            onClick={() => {
              updateQuery({ status: tab.id === 'active' ? '' : tab.id });
            }}
          >
            <TabIcon id={tab.id} />
            {tab.label}
          </button>
        ))}
      </div>

      <ScrollableTable
        flushTop
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        toolbarStart={null}
        toolbarLeft={toolbarActions}
        footer={(
          <SopfPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        )}
      >
        {statusTab === 'active' ? (
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
                <th>TC Recap</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={row.tcOutId}>
                  <td className={styles.cellItem}>{(page - 1) * pageSize + index + 1}.</td>
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
                    <ActionButtonStack className={styles.rowActions}>
                      <SecondaryActionButton
                        label="Replicate"
                        className={`${styles.pillAction} ${styles.pillReplicate}`}
                        onClick={() => handleReplicate(row)}
                      />
                      {row.canCompare ? (
                        <SendToOpsButton
                          className={`${styles.pillAction} ${styles.pillSendOps}`}
                          onClick={() => handleSendToOps([row.tcOutId])}
                          disabled={sending}
                        />
                      ) : null}
                    </ActionButtonStack>
                  </td>
                  <td>
                    <Link
                      className={styles.iconBtn}
                      to={tcPath(`${row.tcOutId}/edit`)}
                      title="Edit TC Recap"
                    >
                      <EditRecapIcon size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
              {!visibleRows.length && !loading ? (
                <tr>
                  <td colSpan={12} className={styles.empty}>No active TC recaps found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : (
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
                <th>Stage</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const stage = stageForRow(row);
                return (
                  <tr key={row.tcOutId}>
                    <td className={styles.cellItem}>{(page - 1) * pageSize + index + 1}.</td>
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
                      <span className={`${styles.stageChip} ${stage === 'postops' ? styles.stagePostOps : styles.stageOps}`}>
                        {stage === 'postops' ? 'Post Ops' : 'Ops'}
                      </span>
                    </td>
                    <td>
                      <Link
                        className={styles.iconBtn}
                        to={tcPath(`${row.tcOutId}/view`)}
                        title="View TC Recap"
                      >
                        <EyeIcon />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!visibleRows.length && !loading ? (
                <tr>
                  <td colSpan={12} className={styles.empty}>No Performing fixtures yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </ScrollableTable>
    </div>
  );
}

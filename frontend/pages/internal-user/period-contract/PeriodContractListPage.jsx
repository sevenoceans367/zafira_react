import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, CardSelect, LoadingOverlay } from '@bainbridge/shared-ui';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { usePeriodContractModule } from '../../../hooks/usePeriodContractModule.js';
import { periodContractBasePath } from '../../../constants/periodContractModule.js';
import { tcAppPath } from '../../../constants/tcModule.js';
import {
  fetchPeriodContractList,
  fetchPeriodNominations,
} from '../../../services/periodContracts.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import PeriodContractHeaderActions from './PeriodContractHeaderActions.jsx';
import legacyStyles from './PeriodContractListPage.module.css';
import styles from './PeriodBusinessPage.module.css';

const SHOW_OPTIONS = [5, 10, 25];
const EXPORT_PAGE_SIZE = 5000;

const FLASH_MESSAGES = {
  0: { type: 'success', text: 'Congratulations! Period Contract added/updated successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while adding/updating Period Contract.' },
  2: { type: 'success', text: 'Congratulations! Period Contract delete successfully.' },
};

const LEGACY_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
];

const SOPF_TABS = [
  { id: 'open', label: 'Active' },
  { id: 'closed', label: 'Completed' },
];

function liveValue(value) {
  if (value == null) return '—';
  const text = String(value).trim();
  return text === '' ? '—' : text;
}

function formatDaysPart(value) {
  if (value == null || String(value).trim() === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toFixed(2);
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
      <path d="M3 17.5c1.4 1 3 1 4.4 0 1.4-1 3-1 4.4 0 1.4 1 3 1 4.4 0" />
    </svg>
  );
}

function TabIcon({ id }) {
  if (id === 'closed') {
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
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

function MultilineCell({ value, className }) {
  const text = liveValue(value);
  if (text === '—') return <span className={styles.cellBlank}>—</span>;
  return <span className={className}>{text}</span>;
}

function StatusBadge({ status }) {
  const isOpen = String(status).toLowerCase().includes('open');
  return (
    <span className={isOpen ? legacyStyles.statusOpen : legacyStyles.statusClosed}>
      {status}
    </span>
  );
}

function parseListStatus(value) {
  if (value === 'closed' || value === 'completed' || value === '2') return 'closed';
  return 'open';
}

export default function PeriodContractListPage() {
  const navigate = useNavigate();
  const { module } = usePeriodContractModule();
  const isSopf = module === 'sopf';
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(parseListStatus(searchParams.get('status')));
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    openTrades: 0,
    vesselsOnSubs: 0,
    tradesInOperations: 0,
    vesselsOnWater: 0,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [linkKind, setLinkKind] = useState('all');
  const [spotFilter, setSpotFilter] = useState('all');
  const [tcFilter, setTcFilter] = useState('all');
  const [spotShow, setSpotShow] = useState(10);
  const [tcShow, setTcShow] = useState(10);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const openedLinkFromQuery = useRef(false);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const periodFrom = searchParams.get('periodFrom') || '';
  const periodTo = searchParams.get('periodTo') || '';
  const flashMsg = searchParams.get('msg');
  const flash = useTimedFlash(flashMsg != null ? FLASH_MESSAGES[Number(flashMsg)] : null);
  const tcHost = module === 'sopf' ? 'sopf' : 'vc';
  const listPath = periodContractBasePath(module);

  const updateQuery = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  const loadBusinessTypes = useCallback(async (selectedId) => {
    const types = await fetchVcBusinessTypes(selectedId);
    setBusinessTypes(types);
  }, []);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPeriodContractList({
        selBType: businessType,
        status: activeTab,
        page,
        pageSize,
        search: debouncedSearch,
        periodFrom: isSopf ? periodFrom : '',
        periodTo: isSopf ? periodTo : '',
      });
      setRows(data.records ?? []);
      setTotal(data.recordsTotal ?? 0);
      setStats(data.stats ?? {
        openTrades: 0,
        vesselsOnSubs: 0,
        tradesInOperations: 0,
        vesselsOnWater: 0,
      });
    } catch (err) {
      setError(err.message || 'Failed to load period contract list.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, businessType, debouncedSearch, isSopf, page, pageSize, periodFrom, periodTo]);

  useEffect(() => {
    loadBusinessTypes(businessType);
  }, [businessType, loadBusinessTypes]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, businessType, activeTab, periodFrom, periodTo, pageSize]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => updateQuery({}), 4000);
    return () => window.clearTimeout(timer);
  }, [flash]);

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

  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    if (!modal) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal, closeModal]);

  const handleBusinessTypeChange = (value) => {
    setBusinessType(value);
    updateQuery({ selBType: value || '' });
  };

  const openNominations = useCallback(async (row, { allowAdd }) => {
    setLinkKind('all');
    setSpotFilter('all');
    setTcFilter('all');
    setSpotShow(10);
    setTcShow(10);
    setModal({
      loading: true,
      allowAdd,
      periodId: row.periodId,
      contractNo: row.contractNo,
      voyages: [],
      tcEstimates: [],
    });
    try {
      const data = await fetchPeriodNominations(row.periodId, { selBType: businessType });
      setModal({
        loading: false,
        allowAdd,
        periodId: row.periodId,
        contractNo: data.contractNo || row.contractNo,
        voyages: data.voyages || [],
        tcEstimates: data.tcEstimates || [],
      });
    } catch (err) {
      setModal(null);
      setError(err.message || 'Failed to load period nominations.');
    }
  }, [businessType]);

  // Re-open Link Spot/TC after returning from Add Spot / Add TC
  useEffect(() => {
    if (openedLinkFromQuery.current || loading) return;
    if (searchParams.get('openLink') !== '1') return;
    const linkPeriodId = searchParams.get('periodId') || searchParams.get('periodid');
    if (!linkPeriodId) return;

    openedLinkFromQuery.current = true;
    const row = rows.find((item) => String(item.periodId) === String(linkPeriodId))
      || { periodId: linkPeriodId, contractNo: '' };
    openNominations(row, { allowAdd: activeTab === 'open' });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('openLink');
      next.delete('periodId');
      next.delete('periodid');
      return next;
    }, { replace: true });
  }, [activeTab, loading, openNominations, rows, searchParams, setSearchParams]);

  const handleDownloadExcel = async () => {
    setMenuOpen(false);
    try {
      const data = await fetchPeriodContractList({
        selBType: businessType,
        status: activeTab,
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
        search: debouncedSearch,
        periodFrom: isSopf ? periodFrom : '',
        periodTo: isSopf ? periodTo : '',
      });
      const exportRows = (data.records || []).map((row) => ({
        '#': row.index,
        'Contract No.': row.contractNo,
        'Contract Date': row.contractDate,
        Vessel: row.vesselName,
        'Vessel Type': row.vesselType,
        DWT: row.dwt,
        'Initial Hire': row.initialHire,
        Status: row.status,
        'Business Account': row.ownBusinessAccount,
        'Re-Del Date (Min)': row.reDelMinDate,
        'Re-Del Date (Max)': row.reDelMaxDate,
        'Days (Total / Perf. / Bal.)': `${formatDaysPart(row.totalDays)} / ${formatDaysPart(row.performedDays)} / ${formatDaysPart(row.balanceDays)}`,
        Remarks: row.remarks,
        'Bunker Opening': row.bunkerOpening,
        'Bunker Closing': row.bunkerClosing,
      }));
      downloadCsv(
        `period-business-${activeTab}.csv`,
        [
          '#', 'Contract No.', 'Contract Date', 'Vessel', 'Vessel Type', 'DWT', 'Initial Hire',
          'Status', 'Business Account', 'Re-Del Date (Min)', 'Re-Del Date (Max)',
          'Days (Total / Perf. / Bal.)', 'Remarks', 'Bunker Opening', 'Bunker Closing',
        ],
        exportRows,
      );
    } catch (err) {
      setError(err.message || 'Failed to download period contracts.');
    }
  };

  const visibleVoyages = useMemo(() => {
    const voyages = modal?.voyages || [];
    const filtered = spotFilter === 'all'
      ? voyages
      : voyages.filter((row) => row.vesselName === spotFilter);
    return filtered.slice(0, spotShow);
  }, [modal, spotFilter, spotShow]);

  const visibleTcs = useMemo(() => {
    const tcs = modal?.tcEstimates || [];
    const filtered = tcFilter === 'all'
      ? tcs
      : tcs.filter((row) => row.tcNo === tcFilter);
    return filtered.slice(0, tcShow);
  }, [modal, tcFilter, tcShow]);

  const vesselOptions = useMemo(() => (
    [...new Set((modal?.voyages || []).map((row) => row.vesselName).filter(Boolean))]
  ), [modal]);

  const tcOptions = useMemo(() => (
    [...new Set((modal?.tcEstimates || []).map((row) => row.tcNo).filter(Boolean))]
  ), [modal]);

  const cards = [
    { key: 'open', title: 'Open Trades', value: stats.openTrades ?? 0, variant: 'fin' },
    { key: 'subs', title: 'Vessels on Subs', value: stats.vesselsOnSubs ?? 0, variant: 'cnt' },
    { key: 'ops', title: 'Trades in Operations', value: stats.tradesInOperations ?? 0, variant: 'fin' },
    { key: 'water', title: 'Vessels on Water', value: stats.vesselsOnWater ?? 0, variant: 'cnt' },
  ];

  const linkReturnTo = encodeURIComponent(
    `${listPath}?selBType=${businessType}&status=${activeTab === 'closed' ? 'completed' : 'active'}&openLink=1&periodId=${modal?.periodId || ''}`,
  );
  const addSpotHref = `/internal-user/sopf/addestimate?periodid=${encodeURIComponent(modal?.periodId || '')}&selBType=${encodeURIComponent(businessType)}&estimatetype=${encodeURIComponent(businessType)}&returnTo=${linkReturnTo}`;
  const addTcHref = `${tcAppPath(tcHost, 'add')}?periodId=${encodeURIComponent(modal?.periodId || '')}&selBType=${encodeURIComponent(businessType)}&returnTo=${linkReturnTo}`;
  const editHref = (periodId) => `/internal-user/${module}/period-contracts/edit/${periodId}`;

  const headerActions = (
    <PeriodContractHeaderActions
      search={searchInput}
      onSearchChange={setSearchInput}
      businessTypes={businessTypes}
      businessType={businessType}
      onBusinessTypeChange={handleBusinessTypeChange}
      periodFrom={isSopf ? periodFrom : undefined}
      periodTo={isSopf ? periodTo : undefined}
      onPeriodChange={isSopf
        ? ({ from, to }) => updateQuery({ periodFrom: from || '', periodTo: to || '' })
        : undefined}
    />
  );

  if (!isSopf) {
    return (
      <div className={`zafira-page ${legacyStyles.page}`}>
        {headerActions}
        {loading ? <LoadingOverlay show label="Loading period contracts…" /> : null}
        {flash ? (
          <div className={flash.type === 'success' ? legacyStyles.flashSuccess : legacyStyles.flashError}>
            {flash.text}
          </div>
        ) : null}
        {error ? <div className={legacyStyles.error}>{error}</div> : null}
        <h3 className={legacyStyles.title}>Period</h3>
        <div className={legacyStyles.tabs}>
          {LEGACY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? legacyStyles.tabActive : legacyStyles.tab}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className={legacyStyles.toolbar}>
          <div className={legacyStyles.toolbarActions}>
            {activeTab !== 'closed' ? (
              <Button
                variant="add"
                label="Add New"
                onClick={() => navigate(`/internal-user/${module}/period-contracts/add`)}
              />
            ) : null}
          </div>
        </div>
        <ScrollableTable
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          footer={<SopfPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />}
        >
          <table className={legacyStyles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Contract ID</th>
                <th>Contract No.</th>
                <th>Contract Date</th>
                <th>Vessel Name</th>
                <th>Vessel Type</th>
                <th>Dead weight</th>
                <th>Initial hire</th>
                <th>Own Business Account</th>
                <th>Re-Del Date (Min)</th>
                <th>Re-Del Date (Max)</th>
                <th>Total / Performed / Balance Days</th>
                <th>Remarks</th>
                <th>Bunker Opening Balance</th>
                <th>Bunker Closing Balance</th>
                <th>Status</th>
                <th>{activeTab === 'open' ? 'Nominate' : 'View Voyage'}</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={18} className={legacyStyles.emptyCell}>
                    SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.periodId}>
                  <td>{row.index}</td>
                  <td>{row.contractId}</td>
                  <td>{row.contractNo}</td>
                  <td>{row.contractDate}</td>
                  <td>{row.vesselName}</td>
                  <td>{row.vesselType}</td>
                  <td>{row.dwt}</td>
                  <td>{row.initialHire}</td>
                  <td>{row.ownBusinessAccount}</td>
                  <td>{row.reDelMinDate}</td>
                  <td>{row.reDelMaxDate}</td>
                  <td>{`${row.totalDays} / ${row.performedDays} / ${row.balanceDays}`}</td>
                  <td><span className={legacyStyles.multiline}>{row.remarks || '—'}</span></td>
                  <td><span className={legacyStyles.multiline}>{row.bunkerOpening || '—'}</span></td>
                  <td><span className={legacyStyles.multiline}>{row.bunkerClosing || '—'}</span></td>
                  <td><StatusBadge status={row.status} /></td>
                  <td className={legacyStyles.actionCell}>
                    <button
                      type="button"
                      className={legacyStyles.actionIcon}
                      title={activeTab === 'open' ? 'Nominate' : 'View Voyage'}
                      aria-label={activeTab === 'open' ? 'Nominate' : 'View Voyage'}
                      onClick={() => openNominations(row, { allowAdd: activeTab === 'open' })}
                    >
                      <i className={`bi ${activeTab === 'open' ? 'bi-send' : 'bi-eye'}`} aria-hidden />
                    </button>
                  </td>
                  <td className={legacyStyles.actionCell}>
                    <button
                      type="button"
                      className={legacyStyles.actionIcon}
                      title="Edit Details"
                      aria-label="Edit Details"
                      onClick={() => navigate(editHref(row.periodId))}
                    >
                      <i className="bi bi-pencil-square" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
        {modal ? (
          <div className={legacyStyles.modalBackdrop} role="presentation" onClick={closeModal}>
            <div
              className={legacyStyles.modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="period-nominations-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={legacyStyles.modalHeader}>
                <h4 id="period-nominations-title">
                  {modal.allowAdd ? 'Period Contract Nominations' : 'Period Contract Voyages'}
                  {modal.contractNo ? ` — ${modal.contractNo}` : ''}
                </h4>
                <Button variant="close" size="sm" label="Close" onClick={closeModal} />
              </div>
              {modal.loading ? (
                <p className={legacyStyles.modalLoading}>Please wait…</p>
              ) : (
                <div className={legacyStyles.modalBody}>
                  <div className={legacyStyles.modalSection}>
                    <div className={legacyStyles.modalSectionHeader}>
                      <strong>Voyages</strong>
                      {modal.allowAdd ? (
                        <Button
                          variant="accent"
                          size="sm"
                          label="Add New Voyage Estimate"
                          onClick={() => navigate(addSpotHref)}
                        />
                      ) : null}
                    </div>
                    <div className={legacyStyles.nestedTableWrap}>
                      <table className={legacyStyles.nestedTable}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Vessel Name</th>
                            <th>Voyage No.</th>
                            <th>CP Date</th>
                            <th>DWT</th>
                            <th>LP/DP</th>
                            <th>Duration</th>
                            <th>Cargo Quantity</th>
                            <th>NET TCE</th>
                            <th>FVF Sheet</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(modal.voyages || []).length === 0 ? (
                            <tr><td colSpan={10} className={legacyStyles.emptyCell}>No voyages</td></tr>
                          ) : modal.voyages.map((voyage) => (
                            <tr key={voyage.fcaId}>
                              <td>{voyage.index}</td>
                              <td>{voyage.vesselName}</td>
                              <td>{voyage.voyageNo}</td>
                              <td>{voyage.cpDate}</td>
                              <td>{voyage.dwt}</td>
                              <td>{voyage.lpDp}</td>
                              <td>{voyage.duration}</td>
                              <td>{voyage.cargoQuantity}</td>
                              <td>{voyage.netTce}</td>
                              <td>
                                <Link
                                  to={`/internal-user/sopf/viewestimate?id=${encodeURIComponent(voyage.fcaId)}&estimatetype=${encodeURIComponent(businessType)}&selBType=${encodeURIComponent(businessType)}&returnTo=${encodeURIComponent(listPath)}`}
                                  title="FVF Sheet"
                                >
                                  <i className="bi bi-file-earmark-text" aria-hidden />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className={legacyStyles.modalSection}>
                    <div className={legacyStyles.modalSectionHeader}>
                      <strong>TC Estimates</strong>
                      {modal.allowAdd ? (
                        <Button
                          variant="primary"
                          size="sm"
                          label="Add New TC Estimate"
                          onClick={() => navigate(addTcHref)}
                        />
                      ) : null}
                    </div>
                    <div className={legacyStyles.nestedTableWrap}>
                      <table className={legacyStyles.nestedTable}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Vessel</th>
                            <th>TC No.</th>
                            <th>CP Date</th>
                            <th>DWT</th>
                            <th>Del Port</th>
                            <th>Re Del Port</th>
                            <th>TC Days</th>
                            <th>Daily Gross Hire</th>
                            <th>FVF Sheet</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(modal.tcEstimates || []).length === 0 ? (
                            <tr><td colSpan={10} className={legacyStyles.emptyCell}>No TC estimates</td></tr>
                          ) : modal.tcEstimates.map((tc) => (
                            <tr key={tc.tcOutId}>
                              <td>{tc.index}</td>
                              <td>{tc.vesselName}</td>
                              <td>{tc.tcNo}</td>
                              <td>{tc.cpDate}</td>
                              <td>{tc.dwt}</td>
                              <td>{tc.delPort}</td>
                              <td>{tc.reDelPort}</td>
                              <td>{tc.tcDays}</td>
                              <td>{tc.dailyGrossHire}</td>
                              <td>
                                <Link to={tcAppPath(tcHost, `${tc.tcOutId}/view`)} title="FVF Sheet">
                                  <i className="bi bi-file-earmark-text" aria-hidden />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}`}>
      {headerActions}
      {loading ? <LoadingOverlay show label="Loading Period Business…" /> : null}
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

      <div className={styles.statusTabs} role="tablist" aria-label="Period status">
        {SOPF_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.statusTab} ${activeTab === tab.id ? styles.statusTabActive : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              updateQuery({ status: tab.id === 'closed' ? 'completed' : 'active' });
            }}
          >
            <TabIcon id={tab.id} />
            {tab.label}
          </button>
        ))}
      </div>

      <ScrollableTable
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        toolbarLeft={(
          <>
            {activeTab !== 'closed' ? (
              <button
                type="button"
                className={styles.btnAdd}
                onClick={() => navigate(`/internal-user/${module}/period-contracts/add`)}
              >
                <PlusIcon />
                Add New
              </button>
            ) : null}
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
                  <button type="button" role="menuitem" className={styles.menuItem} onClick={handleDownloadExcel}>
                    Download Excel
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
        footer={<SopfPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />}
      >
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>#</th>
                <th>Contract No.</th>
                <th>Contract Date</th>
                <th>Vessel</th>
                <th>DWT</th>
                <th>Initial Hire</th>
                <th>Status</th>
                <th>Business Account</th>
                <th>Re-Del Date (Min)</th>
                <th>Re-Del Date (Max)</th>
                <th>Days (Total / Perf. / Bal.)</th>
                <th>Remarks</th>
                <th>Bunker Opening</th>
                <th>Bunker Closing</th>
                <th>Recap</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={16} className={styles.emptyCell}>
                    SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.periodId}>
                  <td className={styles.cellItem}>{row.index}.</td>
                  <td>
                    <div className={styles.cttCell}>
                      <span className={styles.cttId}>{liveValue(row.contractNo)}</span>
                      <button
                        type="button"
                        className={styles.pillAction}
                        onClick={() => openNominations(row, { allowAdd: activeTab === 'open' })}
                      >
                        Link SPOT/TC
                      </button>
                    </div>
                  </td>
                  <td className={styles.cellNum}>{liveValue(row.contractDate)}</td>
                  <td>
                    <div className={styles.cellVessel}>{liveValue(row.vesselName)}</div>
                    {row.vesselType ? <div className={styles.cellVtype}>{row.vesselType}</div> : null}
                  </td>
                  <td className={styles.cellNum}>{liveValue(row.dwt)}</td>
                  <td className={styles.cellNum}>{liveValue(row.initialHire)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${activeTab === 'closed' ? styles.statusCompleted : ''}`}>
                      {activeTab === 'closed' ? 'Completed' : 'On Subs'}
                    </span>
                  </td>
                  <td>{liveValue(row.ownBusinessAccount)}</td>
                  <td className={styles.cellNum}>{liveValue(row.reDelMinDate)}</td>
                  <td className={styles.cellNum}>{liveValue(row.reDelMaxDate)}</td>
                  <td className={styles.cellDays}>
                    {`${formatDaysPart(row.totalDays)} / ${formatDaysPart(row.performedDays)} / ${formatDaysPart(row.balanceDays)}`}
                  </td>
                  <td>
                    {row.remarks ? (
                      <span className={styles.trunc} title={row.remarks}>{row.remarks}</span>
                    ) : (
                      <span className={styles.cellBlank}>—</span>
                    )}
                  </td>
                  <td className={styles.cellWrap}>
                    <MultilineCell value={row.bunkerOpening} />
                  </td>
                  <td className={styles.cellWrap}>
                    <MultilineCell value={row.bunkerClosing} />
                  </td>
                  <td>
                    <Link className={styles.iconBtn} to={editHref(row.periodId)} title="Recap">
                      <PencilIcon />
                    </Link>
                  </td>
                  <td>
                    <Link className={styles.iconBtn} to={editHref(row.periodId)} title="Details">
                      <DocIcon />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </ScrollableTable>

      {modal ? (
        <div className={styles.modalScrim} role="presentation" onClick={closeModal}>
          <div
            className={styles.assignModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="period-linked-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.amHead}>
              <div className={styles.amTitleRow}>
                <span id="period-linked-title" className={styles.amTitle}>Period Business - Linked Contracts</span>
                {modal.contractNo ? <span className={styles.cttChip}>{modal.contractNo}</span> : null}
              </div>
              <div className={styles.amHeadRight}>
                <CardSelect
                  options={[
                    { id: 'all', name: 'All' },
                    { id: 'spot', name: 'Spot' },
                    { id: 'tc', name: 'TC' },
                  ]}
                  value={linkKind}
                  tone="muted"
                  ariaLabel="Filter linked contracts"
                  placeholder="All"
                  onChange={(value) => setLinkKind(value || 'all')}
                />
                <button type="button" className={styles.btnClose} aria-label="Close" onClick={closeModal}>
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className={styles.amBody}>
              {modal.loading ? (
                <p className={styles.amLoading}>Loading…</p>
              ) : (
                <>
                  {linkKind !== 'tc' ? (
                    <section className={styles.amSection}>
                      <div className={styles.amSectionHead}>
                        <span className={`${styles.amSectionTitle} ${styles.spotTitle}`}>Spot</span>
                        <div className={styles.amSectionControls}>
                          <CardSelect
                            options={[
                              { id: 'all', name: 'All vessels' },
                              ...vesselOptions.map((name) => ({ id: name, name })),
                            ]}
                            value={spotFilter}
                            tone="muted"
                            ariaLabel="Filter vessels"
                            placeholder="All vessels"
                            onChange={(value) => setSpotFilter(value || 'all')}
                          />
                          <CardSelect
                            options={SHOW_OPTIONS.map((size) => ({
                              id: String(size),
                              name: `Show ${size}`,
                            }))}
                            value={String(spotShow)}
                            tone="muted"
                            ariaLabel="Spot rows to show"
                            placeholder="Show 10"
                            onChange={(value) => setSpotShow(Number(value) || 10)}
                          />
                          <button
                            type="button"
                            className={`${styles.btnAddTrade} ${styles.btnAddSpot}`}
                            disabled={!modal.allowAdd}
                            title={modal.allowAdd ? 'Add Spot' : 'Not available for completed contracts'}
                            onClick={() => navigate(addSpotHref)}
                          >
                            <PlusIcon />
                            Add
                          </button>
                        </div>
                      </div>
                      <div className={styles.tableWrap}>
                        <table className={styles.mini}>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Vessel</th>
                              <th>Voy</th>
                              <th>CP Date</th>
                              <th>DWT</th>
                              <th>LP/DP</th>
                              <th>Days</th>
                              <th>QTY</th>
                              <th>TC</th>
                              <th>Fixture</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleVoyages.length === 0 ? (
                              <tr>
                                <td colSpan={10} className={styles.amEmptyNote}>No voyages</td>
                              </tr>
                            ) : visibleVoyages.map((voyage) => (
                              <tr key={voyage.fcaId}>
                                <td>{voyage.index}.</td>
                                <td className={styles.cellVessel}>{liveValue(voyage.vesselName)}</td>
                                <td>{liveValue(voyage.voyageNo)}</td>
                                <td>{liveValue(voyage.cpDate)}</td>
                                <td>{liveValue(voyage.dwt)}</td>
                                <td>
                                  <span className={styles.trunc} title={voyage.lpDp}>{liveValue(voyage.lpDp)}</span>
                                </td>
                                <td>{liveValue(voyage.duration)}</td>
                                <td>{liveValue(voyage.cargoQuantity)}</td>
                                <td>{liveValue(voyage.netTce)}</td>
                                <td>
                                  <Link
                                    className={styles.iconBtn}
                                    to={`/internal-user/sopf/viewestimate?id=${encodeURIComponent(voyage.fcaId)}&estimatetype=${encodeURIComponent(businessType)}&selBType=${encodeURIComponent(businessType)}&returnTo=${encodeURIComponent(listPath)}`}
                                    title="Fixture"
                                  >
                                    <DocIcon />
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}

                  {linkKind !== 'spot' ? (
                    <section className={styles.amSection}>
                      <div className={styles.amSectionHead}>
                        <span className={`${styles.amSectionTitle} ${styles.tcTitle}`}>TC</span>
                        <div className={styles.amSectionControls}>
                          <CardSelect
                            options={[
                              { id: 'all', name: 'All TC' },
                              ...tcOptions.map((name) => ({ id: name, name })),
                            ]}
                            value={tcFilter}
                            tone="muted"
                            ariaLabel="Filter TC"
                            placeholder="All TC"
                            onChange={(value) => setTcFilter(value || 'all')}
                          />
                          <CardSelect
                            options={SHOW_OPTIONS.map((size) => ({
                              id: String(size),
                              name: `Show ${size}`,
                            }))}
                            value={String(tcShow)}
                            tone="muted"
                            ariaLabel="TC rows to show"
                            placeholder="Show 10"
                            onChange={(value) => setTcShow(Number(value) || 10)}
                          />
                          <button
                            type="button"
                            className={`${styles.btnAddTrade} ${styles.btnAddTc}`}
                            disabled={!modal.allowAdd}
                            title={modal.allowAdd ? 'Add TC' : 'Not available for completed contracts'}
                            onClick={() => navigate(addTcHref)}
                          >
                            <PlusIcon />
                            Add
                          </button>
                        </div>
                      </div>
                      <div className={styles.tableWrap}>
                        <table className={styles.mini}>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Vessel</th>
                              <th>TC</th>
                              <th>CP Date</th>
                              <th>DWT</th>
                              <th>Del</th>
                              <th>Redel</th>
                              <th>Days</th>
                              <th>Hire In</th>
                              <th>Hire Out</th>
                              <th>Fixture</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleTcs.length === 0 ? (
                              <tr>
                                <td colSpan={11} className={styles.amEmptyNote}>No TC estimates</td>
                              </tr>
                            ) : visibleTcs.map((tc) => (
                              <tr key={tc.tcOutId}>
                                <td>{tc.index}.</td>
                                <td className={styles.cellVessel}>{liveValue(tc.vesselName)}</td>
                                <td>{liveValue(tc.tcNo)}</td>
                                <td>{liveValue(tc.cpDate)}</td>
                                <td>{liveValue(tc.dwt)}</td>
                                <td>
                                  <span className={styles.trunc} title={tc.delPort}>{liveValue(tc.delPort)}</span>
                                </td>
                                <td>
                                  <span className={styles.trunc} title={tc.reDelPort}>{liveValue(tc.reDelPort)}</span>
                                </td>
                                <td>{liveValue(tc.tcDays)}</td>
                                <td className={styles.cellNum}>{liveValue(tc.hireIn)}</td>
                                <td className={styles.cellNum}>{liveValue(tc.hireOut || tc.dailyGrossHire)}</td>
                                <td>
                                  <Link
                                    className={styles.iconBtn}
                                    to={tcAppPath(tcHost, `${tc.tcOutId}/view`)}
                                    title="Fixture"
                                  >
                                    <DocIcon />
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

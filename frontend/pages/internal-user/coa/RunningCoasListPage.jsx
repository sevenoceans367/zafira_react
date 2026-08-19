import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import { useCoaModule } from '../../../hooks/useCoaModule.js';
import {
  cancelCoa,
  fetchCoaNominations,
  fetchRunningCoas,
} from '../../../services/coas.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import CoaListHeaderActions from './CoaListHeaderActions.jsx';
import styles from './RunningCoasPage.module.css';

const PAGE_SIZE = 50;
const FETCH_PAGE_SIZE = 200;
const SHOW_OPTIONS = [5, 10, 25];

const FLASH = {
  0: { type: 'success', text: 'COA saved successfully.' },
  1: { type: 'error', text: 'Sorry! there was an error while saving COA.' },
  2: { type: 'success', text: 'COA cancelled successfully.' },
};

const STATUS_TABS = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function parseMt(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatMillMt(value) {
  return `${(parseMt(value) / 1e6).toFixed(2)}M`;
}

function liveValue(value) {
  if (value == null) return '—';
  const text = String(value).trim();
  return text === '' ? '—' : text;
}

function isCompleted(row) {
  const total = Number(row.totalShipments) || 0;
  const performed = Number(row.shipmentsPerformed) || 0;
  return String(row.status).toLowerCase() === 'active' && total > 0 && performed >= total;
}

function rowTab(row) {
  if (String(row.status).toLowerCase() === 'cancelled') return 'cancelled';
  if (isCompleted(row)) return 'completed';
  return 'active';
}

function parseStatusTab(value) {
  if (value === '2' || value === 'cancelled') return 'cancelled';
  if (value === 'completed') return 'completed';
  return 'active';
}

function HighlightIcon({ name }) {
  if (name === 'cargo') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v18" />
        <path d="M16.5 7.5c0-2-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.3 9 2 9 6.3 0 2-2 3.2-4.5 3.2s-4.5-1-4.5-3" />
      </svg>
    );
  }
  if (name === 'coas') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v13" />
        <path d="M8 10h8" />
        <path d="M5 14a7 7 0 0 0 14 0" />
      </svg>
    );
  }
  if (name === 'revenue') {
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
  if (id === 'completed') {
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

function RecapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3h9l5 5v13H6z" />
      <path d="M15 3v5h5" />
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

function RowsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
      <rect x="3.5" y="10.5" width="17" height="4" rx="1" />
      <rect x="3.5" y="16.5" width="17" height="4" rx="1" />
    </svg>
  );
}

function statusBadgeClass(tab) {
  if (tab === 'completed') return `${styles.statusBadge} ${styles.statusCompleted}`;
  if (tab === 'cancelled') return `${styles.statusBadge} ${styles.statusCancelled}`;
  return styles.statusBadge;
}

function statusLabel(tab) {
  if (tab === 'completed') return 'Completed';
  if (tab === 'cancelled') return 'Cancelled';
  return 'Active';
}

export default function RunningCoasListPage() {
  const navigate = useNavigate();
  const { coaPath } = useCoaModule();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [statusTab, setStatusTab] = useState(parseStatusTab(searchParams.get('status')));
  const [allRows, setAllRows] = useState([]);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [spotFilter, setSpotFilter] = useState('all');
  const [reletFilter, setReletFilter] = useState('all');
  const [spotShow, setSpotShow] = useState(10);
  const [reletShow, setReletShow] = useState(10);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flashMsg = searchParams.get('msg');
  const flash = flashMsg != null && flashMsg !== '' ? FLASH[Number(flashMsg)] : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [types, data] = await Promise.all([
        fetchVcBusinessTypes(businessType),
        fetchRunningCoas({
          selBType: businessType,
          status: 'all',
          page: 1,
          pageSize: FETCH_PAGE_SIZE,
          search: debouncedSearch,
        }),
      ]);
      setBusinessTypes(types);
      setAllRows(data.records ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load running COAs.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, businessType, statusTab]);

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

  const updateQuery = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  const cards = useMemo(() => {
    const activeRows = allRows.filter((row) => rowTab(row) === 'active');
    const cargoOnSubs = activeRows.reduce((sum, row) => sum + parseMt(row.minQty), 0);
    const balanceCargo = allRows.reduce((sum, row) => sum + parseMt(row.balanceCargo), 0);
    return [
      { title: 'Cargo on Subs (Mill MT)', value: formatMillMt(cargoOnSubs), variant: 'fin', icon: 'cargo' },
      { title: 'COAs on Subs', value: String(activeRows.length), variant: 'cnt', icon: 'coas' },
      { title: 'COA Revenue (YTD)', value: '—', variant: 'fin', icon: 'revenue' },
      { title: 'Total Balance Cargo (Mill MT)', value: formatMillMt(balanceCargo), variant: 'cnt', icon: 'balance' },
    ];
  }, [allRows]);

  const filteredRows = useMemo(
    () => allRows.filter((row) => rowTab(row) === statusTab),
    [allRows, statusTab],
  );

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const showingLabel = `Showing ${filteredRows.length} ${statusTab} COA${filteredRows.length === 1 ? '' : 's'}`;

  const handleCancel = async (row) => {
    const ok = await confirm({
      title: 'Cancel COA',
      message: `Cancel ${row.coaIdentity || row.coaNo}? This cannot be undone.`,
      confirmLabel: 'Cancel COA',
    });
    if (!ok) return;
    const remarks = window.prompt('Cancellation remarks (optional):', '') ?? '';
    try {
      await cancelCoa(row.coaId, remarks);
      updateQuery({ msg: 2 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to cancel COA.');
    }
  };

  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    if (!modal) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal, closeModal]);

  const openNominations = async (row) => {
    const tab = rowTab(row);
    const chip = row.coaNo || row.coaIdentity || '';
    setModal({
      loading: true,
      chip,
      cancelled: tab === 'cancelled',
      coaId: row.coaId,
      voyages: [],
      relets: [],
    });
    setSpotFilter('all');
    setReletFilter('all');
    setSpotShow(10);
    setReletShow(10);
    try {
      const data = await fetchCoaNominations(row.coaId);
      setModal({
        loading: false,
        chip: data.coaLabel || chip,
        cancelled: tab === 'cancelled',
        coaId: row.coaId,
        voyages: data.voyages || [],
        relets: data.relets || [],
      });
    } catch (err) {
      setModal(null);
      setError(err.message || 'Failed to load nominations.');
    }
  };

  const visibleVoyages = useMemo(() => {
    const voyages = modal?.voyages || [];
    const filtered = spotFilter === 'all'
      ? voyages
      : voyages.filter((row) => row.vesselName === spotFilter);
    return filtered.slice(0, spotShow);
  }, [modal, spotFilter, spotShow]);

  const visibleRelets = useMemo(() => {
    const relets = modal?.relets || [];
    const filtered = reletFilter === 'all'
      ? relets
      : relets.filter((row) => row.reletNo === reletFilter);
    return filtered.slice(0, reletShow);
  }, [modal, reletFilter, reletShow]);

  const vesselOptions = useMemo(() => {
    const names = [...new Set((modal?.voyages || []).map((row) => row.vesselName).filter(Boolean))];
    return names;
  }, [modal]);

  const reletOptions = useMemo(() => {
    const names = [...new Set((modal?.relets || []).map((row) => row.reletNo).filter(Boolean))];
    return names;
  }, [modal]);

  return (
    <>
      <CoaListHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search"
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={(value) => {
          setBusinessType(value);
          updateQuery({ selBType: value });
        }}
      />

      <div className={`zafira-page ${styles.page}`}>
        <LoadingOverlay show={loading} fullScreen={false} label="Loading running COAs…" />
        {flash ? (
          <div className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}>
            {flash.text}
          </div>
        ) : null}
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

        <div className={styles.statusTabs} role="tablist" aria-label="COA status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusTab === tab.id}
              className={`${styles.statusTab} ${statusTab === tab.id ? styles.statusTabActive : ''}`}
              onClick={() => {
                setStatusTab(tab.id);
                updateQuery({ status: tab.id });
              }}
            >
              <TabIcon id={tab.id} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.actionRow}>
          <div className={styles.actionRowLeft}>
            <button
              type="button"
              className={styles.btnAdd}
              onClick={() => navigate(`${coaPath('running/add')}?selBType=${businessType}`)}
            >
              <PlusIcon />
              Add New
            </button>
          </div>
          <div className={styles.actionRowRight}>{showingLabel}</div>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>No.</th>
                  <th>Route</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Vessel Type</th>
                  <th>Charterer</th>
                  <th>Cargo</th>
                  <th>QTY (MT)</th>
                  <th>Dur</th>
                  <th>Total Shipments</th>
                  <th>Performed Shipments</th>
                  <th>Bal Cargo (MT)</th>
                  <th>Recap</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className={styles.emptyCell}>
                      SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                    </td>
                  </tr>
                ) : pageRows.map((row, index) => {
                  const tab = rowTab(row);
                  const coaNo = row.coaNo || row.coaIdentity;
                  return (
                    <tr key={row.coaId}>
                      <td>{(page - 1) * PAGE_SIZE + index + 1}.</td>
                      <td>
                        <div className={styles.coaCell}>
                          <span className={styles.coaId}>{liveValue(coaNo)}</span>
                          <button
                            type="button"
                            className={styles.pillAction}
                            onClick={() => openNominations(row)}
                          >
                            Assign Spot/Relet
                          </button>
                        </div>
                      </td>
                      <td>{liveValue(row.coaRoute)}</td>
                      <td className={styles.cellNum}>{liveValue(row.coaDate)}</td>
                      <td>
                        <span className={statusBadgeClass(tab)}>{statusLabel(tab)}</span>
                      </td>
                      <td>{liveValue(row.vesselType)}</td>
                      <td>{liveValue(row.charterer)}</td>
                      <td>{liveValue(row.cargo)}</td>
                      <td className={styles.cellNum}>{liveValue(row.minQty)}</td>
                      <td>{liveValue(row.duration)}</td>
                      <td className={styles.cellNum}>{liveValue(row.totalShipments)}</td>
                      <td className={styles.cellNum}>{liveValue(row.shipmentsPerformed)}</td>
                      <td className={styles.cellNum}>{liveValue(row.balanceCargo)}</td>
                      <td>
                        <div className={styles.recapCell}>
                          <Link
                            className={styles.iconBtn}
                            to={coaPath(`running/${row.coaId}`)}
                            title="Recap"
                          >
                            <RecapIcon />
                          </Link>
                          {row.canCancel ? (
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconDanger}`}
                              title="Cancel COA"
                              onClick={() => handleCancel(row)}
                            >
                              <i className="bi bi-x-circle" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.tableFooter}>
            <SopfPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={filteredRows.length}
              onPageChange={setPage}
            />
          </div>
        </div>

        {modal ? createPortal(
          <div className={styles.modalScrim} role="presentation" onClick={closeModal}>
            <div
              className={styles.assignModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="coa-shipment-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.amHead}>
                <div className={styles.amTitleRow}>
                  <span id="coa-shipment-title" className={styles.amTitle}>Shipment Details</span>
                  {modal.chip ? <span className={styles.cttChip}>{modal.chip}</span> : null}
                  <span className={styles.usdChip}>All values in USD</span>
                </div>
                <button type="button" className={styles.btnClose} aria-label="Close" onClick={closeModal}>
                  <CloseIcon />
                </button>
              </div>
              <div className={styles.amBody}>
                {modal.loading ? (
                  <p className={styles.amLoading}>Loading…</p>
                ) : (
                  <>
                    <section className={styles.amSection}>
                      <div className={styles.amSectionHead}>
                        <div className={styles.amSectionTitleWrap}>
                          <svg className={`${styles.amSectionIcon} ${styles.spotIcon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3.5 2" />
                          </svg>
                          <span className={`${styles.amSectionTitle} ${styles.spotTitle}`}>Spot Voyages</span>
                        </div>
                        <div className={styles.amSectionControls}>
                          <select
                            className={styles.amSelect}
                            value={spotFilter}
                            aria-label="Filter vessels"
                            onChange={(event) => setSpotFilter(event.target.value)}
                          >
                            <option value="all">All vessels</option>
                            {vesselOptions.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          <div className={styles.amShowCtrl}>
                            <RowsIcon />
                            <select
                              className={styles.amSelect}
                              value={spotShow}
                              aria-label="Spot voyages to show"
                              onChange={(event) => setSpotShow(Number(event.target.value))}
                            >
                              {SHOW_OPTIONS.map((size) => (
                                <option key={size} value={size}>Show {size}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            className={`${styles.btnAddTrade} ${styles.btnAddSpot}`}
                            disabled={modal.cancelled}
                            title={modal.cancelled ? 'Not available — this COA is cancelled' : 'Add Spot Voyage'}
                            onClick={() => navigate(`${coaPath('cargo-relet/add')}?coaId=${modal.coaId}&selBType=${businessType}&from=running`)}
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
                              <th>COA</th>
                              <th>Voy</th>
                              <th>Date</th>
                              <th>DWT</th>
                              <th>LPDP</th>
                              <th>Dur</th>
                              <th>Qty (MT)</th>
                              <th>TCE</th>
                              <th>Hire</th>
                              <th>P&amp;L</th>
                              <th>Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleVoyages.length === 0 ? (
                              <tr>
                                <td colSpan={13} className={styles.amEmptyNote}>No spot voyages match this filter.</td>
                              </tr>
                            ) : visibleVoyages.map((row, index) => (
                              <tr key={row.comId || row.fcaId || index}>
                                <td>{index + 1}.</td>
                                <td>
                                  <div className={styles.vesselName}>{liveValue(row.vesselName)}</div>
                                  <div className={styles.vesselType}>{liveValue(row.vesselType)}</div>
                                </td>
                                <td>{liveValue(row.coaNo)}</td>
                                <td>{liveValue(row.voyageNo)}</td>
                                <td className={styles.cellNum}>{liveValue(row.cpDate)}</td>
                                <td className={styles.cellNum}>{liveValue(row.dwt)}</td>
                                <td>
                                  <span className={styles.trunc} title={liveValue(row.lpdp)}>{liveValue(row.lpdp)}</span>
                                </td>
                                <td className={styles.cellNum}>{liveValue(row.duration)}</td>
                                <td className={styles.cellNum}>{liveValue(row.cargoQty)}</td>
                                <td className={styles.cellNum}>{liveValue(row.tce)}</td>
                                <td className={styles.cellNum}>{liveValue(row.hire)}</td>
                                <td className={styles.cellNum}>{liveValue(row.profitLoss)}</td>
                                <td>
                                  {row.fcaId ? (
                                    <Link
                                      className={styles.iconBtn}
                                      to={appPath(`/internal-user/sopf/viewestimate?id=${row.fcaId}`)}
                                      title="Details"
                                    >
                                      <RecapIcon />
                                    </Link>
                                  ) : (
                                    <span className={styles.iconBtn} aria-hidden><RecapIcon /></span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className={styles.amSection}>
                      <div className={styles.amSectionHead}>
                        <div className={styles.amSectionTitleWrap}>
                          <svg className={`${styles.amSectionIcon} ${styles.reletIcon}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="16 3 21 3 21 8" />
                            <line x1="4" y1="20" x2="21" y2="3" />
                            <polyline points="21 16 21 21 16 21" />
                            <line x1="15" y1="15" x2="21" y2="21" />
                            <line x1="4" y1="4" x2="9" y2="9" />
                          </svg>
                          <span className={`${styles.amSectionTitle} ${styles.reletTitle}`}>Cargo Relets</span>
                        </div>
                        <div className={styles.amSectionControls}>
                          <select
                            className={styles.amSelect}
                            value={reletFilter}
                            aria-label="Filter relets"
                            onChange={(event) => setReletFilter(event.target.value)}
                          >
                            <option value="all">All relets</option>
                            {reletOptions.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          <div className={styles.amShowCtrl}>
                            <RowsIcon />
                            <select
                              className={styles.amSelect}
                              value={reletShow}
                              aria-label="Cargo relets to show"
                              onChange={(event) => setReletShow(Number(event.target.value))}
                            >
                              {SHOW_OPTIONS.map((size) => (
                                <option key={size} value={size}>Show {size}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            className={`${styles.btnAddTrade} ${styles.btnAddRelet}`}
                            disabled={modal.cancelled}
                            title={modal.cancelled ? 'Not available — this COA is cancelled' : 'Add Cargo Relet'}
                            onClick={() => navigate(`${coaPath('cargo-relet/add')}?coaId=${modal.coaId}&selBType=${businessType}&from=running`)}
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
                              <th>COA</th>
                              <th>Relet No.</th>
                              <th>Date</th>
                              <th>Qty (MT)</th>
                              <th>LPDP</th>
                              <th>Frt-In ($/MT)</th>
                              <th>Frt-In</th>
                              <th>FO Surcharge</th>
                              <th>Frt-Out ($/MT)</th>
                              <th>Frt-Out</th>
                              <th>P&amp;L</th>
                              <th>Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRelets.length === 0 ? (
                              <tr>
                                <td colSpan={13} className={styles.amEmptyNote}>No cargo relets match this filter.</td>
                              </tr>
                            ) : visibleRelets.map((row, index) => (
                              <tr key={row.fcaId || index}>
                                <td>{index + 1}.</td>
                                <td>{liveValue(row.coaNo)}</td>
                                <td>{liveValue(row.reletNo)}</td>
                                <td className={styles.cellNum}>{liveValue(row.date)}</td>
                                <td className={styles.cellNum}>{liveValue(row.cargoQty)}</td>
                                <td>
                                  <span className={styles.trunc} title={liveValue(row.lpdp)}>{liveValue(row.lpdp)}</span>
                                </td>
                                <td className={styles.cellNum}>{liveValue(row.freightInPerMt)}</td>
                                <td className={styles.cellNum}>{liveValue(row.freightInAmt)}</td>
                                <td className={styles.cellNum}>{liveValue(row.foSurcharge)}</td>
                                <td className={styles.cellNum}>{liveValue(row.freightOutPerMt)}</td>
                                <td className={styles.cellNum}>{liveValue(row.freightOutAmt)}</td>
                                <td className={styles.cellNum}>{liveValue(row.profit)}</td>
                                <td>
                                  {row.fcaId ? (
                                    <Link
                                      className={styles.iconBtn}
                                      to={coaPath(`cargo-relet/${row.fcaId}`)}
                                      title="Details"
                                    >
                                      <RecapIcon />
                                    </Link>
                                  ) : (
                                    <span className={styles.iconBtn} aria-hidden><RecapIcon /></span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        ) : null}
      </div>
    </>
  );
}

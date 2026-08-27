import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoadingOverlay, useConfirm } from '@bainbridge/shared-ui';
import { getLegacyDryoutHref } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import {
  fetchTodoList,
  holdTodoPayment,
  inactiveTodoAlert,
  unholdTodoPayment,
  updateTodoAlRem,
} from '../../../services/todoList.js';
import { downloadReportExcel, downloadReportPdf } from '../reports/reportExports.js';
import ToDoListHeaderActions from './ToDoListHeaderActions.jsx';
import { enrichTodoRow, EXPORT_FIELDS } from './todoListDisplay.js';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import styles from './ToDoListPage.module.css';

const EMPTY_FILTER = { businessType: 'all', voyageType: 'all', vessel: '' };

const TABS = [
  { id: 'hold', label: 'On Hold' },
  { id: 'payable', label: 'In Process' },
];

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ProcessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.4082 21L10.418 20.9951" />
      <path d="M15.0469 20.6173L15.0528 20.6074" />
      <path d="M5.78715 18.6621L5.78125 18.6719" />
      <path d="M18.9062 17.9854L18.9122 17.9756" />
      <path d="M8.95219 3.38379L8.94629 3.39363" />
      <path d="M5.09379 6.01465L5.08789 6.02449" />
      <path d="M18.2119 5.33796L18.2178 5.32812" />
      <path d="M13.5919 3L13.582 3.00492" />
      <path d="M20.7295 9.17292L20.7354 9.16309" />
      <path d="M3.02543 10.2061L3.01953 10.2159" />
      <path d="M3.27153 14.8281L3.26562 14.838" />
      <path d="M20.9746 13.793L20.9805 13.7832" />
    </svg>
  );
}

function StatusIcon({ kind }) {
  if (kind === 'approval') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9L2.8 17a1.5 1.5 0 0 0 1.3 2.2h15.8a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0z" />
      </svg>
    );
  }
  if (kind === 'draft') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 12h6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="translate(4.5,2.5)">
        <path d="M11.9242,3.062 C11.3072,1.28 9.6142,0 7.6222,0 C5.1092,-0.01 3.0632,2.018 3.0522,4.531 L3.0522,4.551 L3.0522,6.698" />
        <path d="M11.433,18.5 L3.792,18.5 C1.698,18.5 0,16.802 0,14.707 L0,10.419 C0,8.324 1.698,6.626 3.792,6.626 L11.433,6.626 C13.527,6.626 15.225,8.324 15.225,10.419 L15.225,14.707 C15.225,16.802 13.527,18.5 11.433,18.5 Z" />
        <line x1="7.6127" y1="11.453" x2="7.6127" y2="13.675" />
      </g>
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="translate(3.5,2)">
        <path d="M11.238 0.762 L4.585 0.762 C2.505 0.754 0.8 2.412 0.751 4.491 L0.751 15.204 C0.705 17.317 2.38 19.068 4.493 19.115 C4.524 19.115 4.554 19.116 4.585 19.115 L12.574 19.115 C14.668 19.03 16.318 17.3 16.303 15.204 L16.303 6.038 L11.238 0.762 Z" />
        <path d="M10.975 0.75 L10.975 3.659 C10.975 5.079 12.123 6.23 13.543 6.234 L16.298 6.234" />
        <line x1="10.788" y1="13.359" x2="5.388" y2="13.359" />
        <line x1="8.743" y1="9.606" x2="5.387" y2="9.606" />
      </g>
    </svg>
  );
}

function statusBoxClass(kind) {
  if (kind === 'approval') return styles.statusApproval;
  if (kind === 'draft') return styles.statusDraft;
  return styles.statusPending;
}

export default function ToDoListPage() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('hold');
  const [accountType, setAccountType] = useState('');
  const [moneyType, setMoneyType] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState([]);
  const [tabCounts, setTabCounts] = useState({ hold: 0, payable: 0 });
  const [paymentUnlock, setPaymentUnlock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alRemDrafts, setAlRemDrafts] = useState({});
  const [filterDraft, setFilterDraft] = useState(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_FILTER);
  const [txnType, setTxnType] = useState('all');
  const [showCount, setShowCount] = useState(10);
  const [runFlash, setRunFlash] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFields, setExportFields] = useState(() => EXPORT_FIELDS.map((field) => field.key));
  const alRemTimers = useRef({});
  const downloadRef = useRef(null);

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const loadList = useCallback(async ({ flash = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTodoList({
        tab: activeTab,
        accountType,
        search: debouncedSearch,
      });
      setRows(data.records ?? []);
      setPaymentUnlock(Boolean(data.paymentUnlock));
      setTabCounts((prev) => ({ ...prev, [activeTab]: data.recordsTotal ?? (data.records ?? []).length }));
      const drafts = {};
      for (const row of data.records ?? []) {
        drafts[row.alertId] = row.alRem ?? '';
      }
      setAlRemDrafts(drafts);
      if (flash) {
        setRunFlash(true);
        window.setTimeout(() => setRunFlash(false), 1600);
      }
    } catch (err) {
      setError(err.message || 'Failed to load financial transactions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, accountType, debouncedSearch]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    let cancelled = false;
    fetchTodoList({ tab: 'payable' }).then((data) => {
      if (!cancelled) {
        setTabCounts((prev) => ({
          ...prev,
          payable: data.recordsTotal ?? (data.records ?? []).length,
        }));
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    Object.values(alRemTimers.current).forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!downloadOpen) return undefined;
    const handleClick = (event) => {
      if (downloadRef.current?.contains(event.target)) return;
      setDownloadOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [downloadOpen]);

  const enrichedRows = useMemo(() => rows.map(enrichTodoRow), [rows]);

  const vesselOptions = useMemo(() => (
    [...new Set(enrichedRows.map((row) => row.vessel).filter(Boolean))].sort()
  ), [enrichedRows]);

  const txnTypeOptions = useMemo(() => (
    [...new Set(enrichedRows.map((row) => row.formName).filter(Boolean))].sort()
  ), [enrichedRows]);

  const matchedRows = useMemo(() => (
    enrichedRows.filter((row) => {
      if (moneyType && row.moneyType !== moneyType) return false;
      if (txnType !== 'all' && row.formName !== txnType) return false;
      if (appliedFilter.businessType !== 'all' && row.cargoClass && row.cargoClass !== appliedFilter.businessType) {
        return false;
      }
      if (appliedFilter.voyageType !== 'all' && row.voyType !== appliedFilter.voyageType) return false;
      if (appliedFilter.vessel && row.vessel !== appliedFilter.vessel) return false;
      return true;
    })
  ), [enrichedRows, moneyType, txnType, appliedFilter]);

  const visibleRows = matchedRows.slice(0, showCount);
  const filterActive = appliedFilter.businessType !== 'all'
    || appliedFilter.voyageType !== 'all'
    || Boolean(appliedFilter.vessel);

  const handleInactive = async (row) => {
    const ok = await confirm({
      title: 'Are you sure?',
      message: "You won't be able to revert this!",
      confirmLabel: 'Yes, Inactive it!',
      cancelLabel: 'Cancel',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    try {
      await inactiveTodoAlert(row.alertId);
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to inactive alert.');
    }
  };

  const handleHold = async (row) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to hold this payment?',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
      confirmVariant: 'accent',
    });
    if (!ok) return;
    try {
      await holdTodoPayment({ identify: row.identify, identifyId: row.identifyId });
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to hold payment.');
    }
  };

  const handleUnhold = async (row) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to unhold this payment?',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
      confirmVariant: 'accent',
    });
    if (!ok) return;
    try {
      await unholdTodoPayment({ identify: row.identify, identifyId: row.identifyId });
      await loadList();
    } catch (err) {
      setError(err.message || 'Failed to unhold payment.');
    }
  };

  const handleAlRemChange = (row, value) => {
    setAlRemDrafts((prev) => ({ ...prev, [row.alertId]: value }));
    const key = row.alertId;
    if (alRemTimers.current[key]) clearTimeout(alRemTimers.current[key]);
    alRemTimers.current[key] = setTimeout(async () => {
      try {
        await updateTodoAlRem({
          identify: row.identify,
          identifyId: row.identifyId,
          value,
        });
      } catch (err) {
        setError(err.message || 'Failed to update accruals.');
      }
    }, 500);
  };

  const exportColumns = EXPORT_FIELDS.filter((field) => exportFields.includes(field.key));

  const handleExcel = () => {
    downloadReportExcel('Financial Transactions', exportColumns, matchedRows);
    setExportOpen(false);
  };

  const handlePdf = async () => {
    setDownloadOpen(false);
    try {
      await downloadReportPdf({
        title: 'Financial Transactions',
        filename: 'Financial Transactions',
        columns: EXPORT_FIELDS,
        rows: matchedRows,
      });
    } catch (err) {
      setError(err.message || 'Failed to generate PDF.');
    }
  };

  const openWorkingDoc = (row) => {
    const href = row?.docsHref || row?.editHref;
    if (!href) return;
    window.open(getLegacyDryoutHref(href), '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <ToDoListHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        accountType={accountType}
        onAccountTypeChange={setAccountType}
        moneyType={moneyType}
        onMoneyTypeChange={setMoneyType}
        filterDraft={filterDraft}
        onFilterDraftChange={setFilterDraft}
        onFilterApply={() => setAppliedFilter(filterDraft)}
        onFilterClear={() => {
          setFilterDraft(EMPTY_FILTER);
          setAppliedFilter(EMPTY_FILTER);
        }}
        filterActive={filterActive}
        vesselOptions={vesselOptions}
        onRun={() => loadList({ flash: true })}
        runFlash={runFlash}
      />

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay show label="Loading financial transactions…" fullScreen={false} /> : null}

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.statusTabs} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.statusTab} ${activeTab === tab.id ? styles.statusTabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.id === 'hold' ? <LockIcon /> : <ProcessIcon />}
              {tab.label}
              <span className={styles.tabCount}>{tabCounts[tab.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <ScrollableTable
          flushTop
          pageSize={showCount}
          onPageSizeChange={setShowCount}
          pageSizeOptions={[10, 20, 30]}
          toolbarLeft={(
            <div className={styles.menuWrap} ref={downloadRef}>
              <button
                className={styles.btnDownload}
                type="button"
                title="Download"
                aria-expanded={downloadOpen}
                onClick={() => setDownloadOpen((open) => !open)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.9" />
                  <circle cx="12" cy="12" r="1.9" />
                  <circle cx="12" cy="19" r="1.9" />
                </svg>
              </button>
              {downloadOpen ? (
                <div className={styles.downloadMenu}>
                  <button type="button" onClick={handlePdf}>Download as PDF</button>
                  <button
                    type="button"
                    onClick={() => {
                      setDownloadOpen(false);
                      setExportOpen(true);
                    }}
                  >
                    Download as Excel…
                  </button>
                </div>
              ) : null}
            </div>
          )}
          toolbarAfterScroll={<span className={styles.usdChip}>USD</span>}
          toolbarRight={(
            <span>Showing {visibleRows.length} of {matchedRows.length} transactions</span>
          )}
        >
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Vessel</th>
                  <th>Voyage No</th>
                  <th>TXN Type</th>
                  <th>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      TXN No.
                      <span className={styles.thFilterWrap}>
                        <select
                          className={styles.thFilter}
                          title="Filter by transaction type"
                          value={txnType}
                          onChange={(event) => setTxnType(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <option value="all">All</option>
                          {txnTypeOptions.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        <svg className={styles.thFilterChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </span>
                  </th>
                  <th>Stage</th>
                  <th>Amount</th>
                  <th className={styles.colTight}>Activity</th>
                  <th>PIC</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th className={styles.colTight}>Deactivate</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && !loading ? (
                  <tr>
                    <td className={styles.emptyNote} colSpan={14}>
                      No matching transactions on this tab.
                    </td>
                  </tr>
                ) : null}
                {visibleRows.map((row, idx) => (
                  <tr
                    key={row.alertId}
                    className={styles.dataRow}
                    onClick={() => setDetailRow(row)}
                  >
                    <td
                      className={styles.accentCell}
                      style={{ borderLeftColor: row.moneyType === 'receivable' ? '#14919b' : '#f4652c' }}
                    >
                      {idx + 1}
                    </td>
                    <td>{row.displayDate}</td>
                    <td className={styles.cellVessel}>{row.vessel || '—'}</td>
                    <td className={styles.cellVoy}>{row.voyageNo || '—'}</td>
                    <td>{row.formName || '—'}</td>
                    <td>
                      <div className={styles.txnCell}>
                        <div className={styles.txnNoRow}>
                          <span className={styles.txnNo}>{row.invoiceNo || '—'}</span>
                          {row.docsHref ? (
                            <button
                              className={styles.docBtn}
                              type="button"
                              title="Open document"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDetailRow(row);
                              }}
                            >
                              <DocIcon />
                            </button>
                          ) : null}
                        </div>
                        <span className={`${styles.typeChip} ${row.moneyType === 'receivable' ? styles.typeReceivable : styles.typePayable}`}>
                          {row.moneyTypeLabel}
                        </span>
                      </div>
                    </td>
                    <td>{row.statement}</td>
                    <td className={`${styles.cellNum} ${Number(row.amount) < 0 ? styles.cellNumNeg : ''}`}>
                      {row.amountLabel}
                    </td>
                    <td className={styles.colTight} onClick={(event) => event.stopPropagation()}>
                      {activeTab === 'hold' ? (
                        <button
                          className={`${styles.btnActivity} ${styles.btnRelease}`}
                          type="button"
                          disabled={!paymentUnlock || !row.canUnhold}
                          onClick={() => handleUnhold(row)}
                        >
                          <UnlockIcon />
                          Release
                        </button>
                      ) : (
                        <button
                          className={`${styles.btnActivity} ${styles.btnHold}`}
                          type="button"
                          disabled={!paymentUnlock || !row.canHold}
                          onClick={() => handleHold(row)}
                        >
                          <LockIcon />
                          Hold
                        </button>
                      )}
                    </td>
                    <td>{row.holdBy || <span className={styles.cellBlank}>—</span>}</td>
                    <td>
                      <span className={styles.truncCustomer} title={row.vendor || ''}>
                        {row.vendor || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBox} ${statusBoxClass(row.statusBox)}`}>
                        <StatusIcon kind={row.statusBox} />
                        {row.statusShort}
                      </span>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <input
                        className={styles.accrualInput}
                        type="text"
                        value={alRemDrafts[row.alertId] ?? ''}
                        placeholder="—"
                        onChange={(event) => handleAlRemChange(row, event.target.value)}
                      />
                    </td>
                    <td className={styles.colTight} onClick={(event) => event.stopPropagation()}>
                      <button
                        className={styles.btnDeactivate}
                        type="button"
                        title="Deactivate"
                        onClick={() => handleInactive(row)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="9.5" />
                          <path d="M9 9l6 6M15 9l-6 6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </ScrollableTable>
      </div>

      {detailRow ? createPortal(
        <>
          <div className={styles.modalScrim} onClick={() => setDetailRow(null)} />
          <div className={styles.detailModal} role="dialog" aria-modal="true" aria-labelledby="ft-detail-title">
            <div className={styles.dmHead}>
              <div className={styles.dmTitleRow}>
                <span className={styles.dmTitle} id="ft-detail-title">Transaction Details</span>
                <span className={`${styles.typeChip} ${detailRow.moneyType === 'receivable' ? styles.typeReceivable : styles.typePayable}`}>
                  {detailRow.moneyTypeLabel}
                </span>
              </div>
              <button className={styles.btnClose} type="button" onClick={() => setDetailRow(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className={styles.dmBody}>
              <div className={styles.dmGrid}>
                <div className={styles.dmField}><label>Vessel</label><div className={styles.dmVal}>{detailRow.vessel || '—'}</div></div>
                <div className={styles.dmField}><label>Voyage No</label><div className={styles.dmVal}>{detailRow.voyageNo || '—'}</div></div>
                <div className={styles.dmField}><label>TXN Type</label><div className={styles.dmVal}>{detailRow.formName || '—'}</div></div>
                <div className={styles.dmField}><label>TXN No.</label><div className={styles.dmVal}>{detailRow.invoiceNo || '—'}</div></div>
                <div className={styles.dmField}><label>Stage</label><div className={styles.dmVal}>{detailRow.statement}</div></div>
                <div className={styles.dmField}><label>Amount</label><div className={`${styles.dmVal} ${styles.dmMoney}`}>{detailRow.amountLabel}</div></div>
                <div className={styles.dmField}><label>Desk</label><div className={styles.dmVal}>{detailRow.desk || '—'}</div></div>
                <div className={styles.dmField}><label>PIC</label><div className={styles.dmVal}>{detailRow.holdBy || '—'}</div></div>
                <div className={styles.dmField}><label>Customer</label><div className={styles.dmVal}>{detailRow.vendor || '—'}</div></div>
                <div className={styles.dmField}><label>Date</label><div className={styles.dmVal}>{detailRow.displayDate}</div></div>
                <div className={`${styles.dmField} ${styles.dmFull}`}>
                  <label>Status</label>
                  <div className={styles.dmVal}>{detailRow.statusShort}</div>
                </div>
              </div>
              <div className={styles.dmFooter}>
                {detailRow.docsHref || detailRow.editHref ? (
                  <button
                    className={styles.btnWorkingDoc}
                    type="button"
                    onClick={() => openWorkingDoc(detailRow)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                      <path d="M14 3v5h5" />
                    </svg>
                    Working Document
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </>,
        document.body,
      ) : null}

      {exportOpen ? createPortal(
        <>
          <div className={styles.modalScrim} onClick={() => setExportOpen(false)} />
          <div className={styles.exportModal} role="dialog" aria-modal="true" aria-labelledby="ft-export-title">
            <div className={styles.dmHead}>
              <span className={styles.dmTitle} id="ft-export-title">Export to Excel</span>
              <button className={styles.btnClose} type="button" onClick={() => setExportOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className={styles.exportBody}>
              <p>Choose which fields to include in the exported file.</p>
              <div className={styles.exportFields}>
                {EXPORT_FIELDS.map((field) => (
                  <label key={field.key} className={styles.exportField}>
                    <input
                      type="checkbox"
                      checked={exportFields.includes(field.key)}
                      onChange={() => {
                        setExportFields((prev) => (
                          prev.includes(field.key)
                            ? prev.filter((key) => key !== field.key)
                            : [...prev, field.key]
                        ));
                      }}
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.exportFooter}>
              <button
                className={styles.exportSelectAll}
                type="button"
                onClick={() => {
                  setExportFields((prev) => (
                    prev.length === EXPORT_FIELDS.length ? [] : EXPORT_FIELDS.map((field) => field.key)
                  ));
                }}
              >
                {exportFields.length === EXPORT_FIELDS.length ? 'Deselect All' : 'Select All'}
              </button>
              <div className={styles.exportFooterBtns}>
                <button className={`${styles.exportBtn} ${styles.exportBtnOutline}`} type="button" onClick={() => setExportOpen(false)}>
                  Cancel
                </button>
                <button className={`${styles.exportBtn} ${styles.exportBtnNavy}`} type="button" onClick={handleExcel}>
                  Export
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body,
      ) : null}
    </>
  );
}

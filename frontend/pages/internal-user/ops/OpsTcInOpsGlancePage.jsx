import React, { useCallback, useEffect, useMemo, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  EditRecapIcon,
  FilterField,
  LoadingOverlay,
  TextInput,
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { getUser } from '@bainbridge/shared-auth';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import {
  createOpsTcCostSheet,
  deactivateOpsTcEntry,
  fetchHistoryAtGlanceTc,
  fetchInOpsAtGlanceTc,
  fetchOpsTcOperators,
  fetchOpsTcYears,
  fetchPostOpsAtGlanceTc,
  moveOpsTcToHistory,
  moveOpsTcToPostOps,
  updateOpsTcOperator,
} from '../../../services/opsTc.js';
import CoaCardSelect from '../coa/CoaCardSelect.jsx';
import OpsTcCompareSheetsModal from './OpsTcCompareSheetsModal.jsx';
import OpsVoyageStatusModal, { VoyageStatusButton } from './OpsVoyageStatusModal.jsx';
import OpsTcInOpsGlanceHeaderActions from './OpsTcInOpsGlanceHeaderActions.jsx';
import OpsTcStatusTabs, { parseOpsTcTab } from './OpsTcStatusTabs.jsx';
import OpsVcWorksheetStack from './OpsVcWorksheetStack.jsx';
import {
  ArrowIcon,
  ChipLink,
  CompareIcon,
  DEFAULT_PAGE_SIZE,
  EyeIcon,
  OpsVcGlanceTable,
  formatLastUpdated,
} from './OpsVcGlanceUi.jsx';
import pageStyles from './OpsPages.module.css';
import styles from './OpsVcInOpsGlancePage.module.css';

const FLASH = {
  0: { type: 'success', text: 'TC Ops updated successfully.' },
  6: { type: 'success', text: 'Nomination sent to "Post Ops".' },
  3: { type: 'success', text: 'Nomination sent to "History".' },
  2: { type: 'success', text: 'Status changed successfully.' },
  4: { type: 'success', text: 'New sheet added successfully.' },
};

const WIDGET_ICONS = {
  fixtures: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2 7 4-14 2 7h6" />
    </svg>
  ),
  vessels: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v13" />
      <path d="M8 10h8" />
      <path d="M5 14a7 7 0 0 0 14 0" />
    </svg>
  ),
  financials: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3h9l5 5v13H6z" />
      <path d="M15 3v5h5" />
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 17h.01" />
    </svg>
  ),
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function pageContextForTab(tab) {
  if (tab === 'post-ops') return 2;
  if (tab === 'history') return 3;
  return 1;
}

function currentUserOperator(operators = []) {
  const user = getUser();
  const userId = user?.id != null ? String(user.id) : '';
  if (!userId) return { id: '', name: user?.name || '' };
  const match = operators.find((opt) => String(opt.id) === userId);
  return {
    id: match ? String(match.id) : userId,
    name: match?.name || user?.name || '',
  };
}

function resolveOperator(row, operators = []) {
  if (row?.operatorId) {
    return {
      id: String(row.operatorId),
      name: row.operatorName
        || operators.find((opt) => String(opt.id) === String(row.operatorId))?.name
        || '',
    };
  }
  return currentUserOperator(operators);
}

function tcGlanceStats(rows, total) {
  const uniqueVessels = new Set(rows.map((row) => row.vesselName).filter(Boolean)).size;
  const financials = rows.filter((row) => (row.costSheets || []).length > 0).length;
  const alerts = rows.filter((row) => row.alertLabel).length;
  return { fixtures: total, vessels: uniqueVessels, financials, alerts };
}

function fixtureHref(row) {
  if (!row?.tcOutId) return null;
  return appPath(`/internal-user/vc/tc/${encodeURIComponent(row.tcOutId)}/calculate?mode=view&from=ops-tc`);
}

function buildWidgetItems(kind, rows) {
  if (kind === 'fixtures') {
    return rows.map((row) => ({
      key: row.comId,
      id: row.message || row.tcNo || '—',
      detail: [row.vesselName, row.charterer].filter(Boolean).join(' · ') || '—',
      due: row.cpDate ? `CP ${row.cpDate}` : '—',
      href: fixtureHref(row),
    }));
  }
  if (kind === 'vessels') {
    return rows.map((row) => ({
      key: row.comId,
      id: row.message || row.tcNo || '—',
      detail: [row.vesselName, row.vesselType].filter(Boolean).join(' · ') || '—',
      due: row.delPort ? `Del ${row.delPort}` : '—',
      href: fixtureHref(row),
    }));
  }
  if (kind === 'financials') {
    return rows
      .filter((row) => (row.costSheets || []).length > 0)
      .map((row) => {
        const sheetNames = (row.costSheets || []).map((sheet) => sheet.name).filter(Boolean).join(', ');
        return {
          key: row.comId,
          id: row.message || row.tcNo || '—',
          detail: [row.vesselName, sheetNames].filter(Boolean).join(' · ') || '—',
          due: 'TC Financials',
          href: fixtureHref(row),
        };
      });
  }
  return rows
    .filter((row) => row.alertLabel)
    .map((row) => ({
      key: row.comId,
      id: row.message || row.tcNo || '—',
      detail: [row.vesselName, row.alertLabel].filter(Boolean).join(' · ') || '—',
      due: row.cpDate ? `Since ${row.cpDate}` : '—',
      href: fixtureHref(row),
    }));
}

const WIDGETS = [
  {
    key: 'fixtures',
    title: 'Fixtures in TC Ops',
    subtitle: (count) => `${count} TC fixture${count === 1 ? '' : 's'} currently active`,
    variant: 'finTeal',
  },
  {
    key: 'vessels',
    title: 'Vessels in TC Ops',
    subtitle: (count) => `${count} vessel${count === 1 ? '' : 's'} on active TC fixtures`,
    variant: 'cnt',
  },
  {
    key: 'financials',
    title: 'TC Financials',
    subtitle: (count) => `${count} fixture${count === 1 ? '' : 's'} with a TC financials sheet raised`,
    variant: 'finTeal',
  },
  {
    key: 'alerts',
    title: 'Alerts',
    subtitle: (count) => `${count} fixture${count === 1 ? '' : 's'} with an open alert`,
    variant: 'cnt',
  },
];

function delReDelLines(row) {
  const del = row.delPort || '';
  const reDel = row.reDelPort || '';
  const lines = [];
  if (del || row.cpDate) {
    lines.push(`Del – ${del || '—'}${row.cpDate ? ` · ${row.cpDate}` : ''}`);
  }
  if (reDel || row.reDelDate) {
    lines.push(`Re-Del – ${reDel || '—'}${row.reDelDate ? ` · ${row.reDelDate}` : ''}`);
  }
  if (!lines.length && row.ports) {
    return String(row.ports).split(/\s*\/\s*/).filter(Boolean);
  }
  return lines;
}

export default function OpsTcInOpsGlancePage() {
  const confirm = useConfirm();
  const alert = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusTab, setStatusTab] = useState(() => parseOpsTcTab(searchParams.get('tab')));
  const [businessTypes, setBusinessTypes] = useState([]);
  const [years, setYears] = useState([]);
  const [operators, setOperators] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [year, setYear] = useState(searchParams.get('selYear') || String(new Date().getFullYear()));
  const [searchInput, setSearchInput] = useState(searchParams.get('voy_no') || '');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [canEditOperator, setCanEditOperator] = useState(false);
  const [canCompareSheets, setCanCompareSheets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheetModal, setSheetModal] = useState({ open: false, comId: '', sheetName: '' });
  const [compareModal, setCompareModal] = useState({ open: false, comId: '' });
  const [voyageStatusRow, setVoyageStatusRow] = useState(null);
  const [widgetModal, setWidgetModal] = useState(null);
  const [savingSheet, setSavingSheet] = useState(false);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flashMsg = searchParams.get('msg');
  const flash = useTimedFlash(flashMsg != null && flashMsg !== '' ? FLASH[Number(flashMsg)] : null);
  const stats = useMemo(() => tcGlanceStats(rows, total), [rows, total]);
  const pageContext = pageContextForTab(statusTab);
  const isHistory = statusTab === 'history';
  const isPostOps = statusTab === 'post-ops';
  const lastColumnLabel = isHistory ? 'Status' : (isPostOps ? 'History' : 'Next');
  const activeWidget = WIDGETS.find((widget) => widget.key === widgetModal) || null;
  const widgetItems = useMemo(
    () => (widgetModal ? buildWidgetItems(widgetModal, rows) : []),
    [widgetModal, rows],
  );

  const updateQuery = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    setStatusTab(parseOpsTcTab(searchParams.get('tab')));
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fetchRows = statusTab === 'post-ops'
        ? fetchPostOpsAtGlanceTc
        : statusTab === 'history'
          ? fetchHistoryAtGlanceTc
          : fetchInOpsAtGlanceTc;
      const [types, yearOptions, operatorOptions, data] = await Promise.all([
        fetchVcBusinessTypes(businessType),
        fetchOpsTcYears(),
        fetchOpsTcOperators(),
        fetchRows({
          selBType: businessType,
          selYear: year,
          search: debouncedSearch,
          page,
          pageSize,
        }),
      ]);
      setBusinessTypes(types);
      setYears(yearOptions);
      setOperators(Array.isArray(operatorOptions) ? operatorOptions : []);
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
      const loggedInIsMgmt = getUser()?.userType === 'mgmt_user';
      setCanEditOperator(!isHistory && (loggedInIsMgmt || Boolean(data.canEditOperator)));
      setCanCompareSheets(Boolean(data.canCompareSheets));
    } catch (err) {
      setError(err.message || 'Failed to load TC Ops.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, isHistory, page, pageSize, statusTab, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [businessType, debouncedSearch, statusTab, year, pageSize]);

  const handleOperatorChange = async (row, operatorId) => {
    try {
      await updateOpsTcOperator(row.comId, operatorId);
      setRows((prev) => prev.map((item) => (
        String(item.comId) === String(row.comId)
          ? {
            ...item,
            operatorId,
            operatorName: operators.find((opt) => String(opt.id) === String(operatorId))?.name || '',
          }
          : item
      )));
    } catch (err) {
      setError(err.message || 'Failed to update operator.');
    }
  };

  const handleDeactivate = async (row) => {
    const ok = await confirm({
      title: 'Deactivate Nom ID',
      message: `Are you sure to de-activate Nom ID ${row.message}?`,
      confirmLabel: 'Deactivate',
    });
    if (!ok) return;
    try {
      await deactivateOpsTcEntry(row.comId);
      updateQuery({ msg: 2 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to deactivate nomination.');
    }
  };

  const handlePostOps = async (row) => {
    const ok = await confirm({
      title: 'Push to Post Ops',
      message: `Request to kindly review the operational costs and proceed accordingly.\n\nAre you sure to send Nom ID ${row.message} to Post Ops?`,
      confirmLabel: 'Post Ops',
    });
    if (!ok) return;
    try {
      await moveOpsTcToPostOps(row.comId);
      updateQuery({ msg: 6 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to move nomination to Post Ops.');
    }
  };

  const handleHistory = async (row) => {
    const ok = await confirm({
      title: 'Push to History',
      message: `Are you sure to send Nom ID ${row.message} to history?`,
      confirmLabel: 'History',
    });
    if (!ok) return;
    try {
      await moveOpsTcToHistory(row.comId);
      updateQuery({ msg: 3 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to move nomination to History.');
    }
  };

  const handleAddSheetClick = async (row) => {
    if (!row.canAddCostSheet) {
      await alert({
        title: 'Alert',
        message: 'Please make sure the last TC Sheet is Submit to Close',
        confirmLabel: 'OK',
      });
      return;
    }
    setSheetModal({ open: true, comId: row.comId, sheetName: '' });
  };

  const handleCreateSheet = async () => {
    const sheetName = String(sheetModal.sheetName || '').trim();
    if (!sheetName) {
      await alert({
        title: 'Alert',
        message: 'Please fill the file name',
        confirmLabel: 'OK',
      });
      return;
    }
    setSavingSheet(true);
    setError('');
    try {
      await createOpsTcCostSheet(sheetModal.comId, sheetName);
      setSheetModal({ open: false, comId: '', sheetName: '' });
      updateQuery({ msg: 4 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to create TC cost sheet.');
    } finally {
      setSavingSheet(false);
    }
  };

  const costSheetPath = (row, sheet) => (
    appPath(`/internal-user/vc/ops-tc/cost-sheet?comid=${encodeURIComponent(row.comId)}&cost_sheet_id=${encodeURIComponent(sheet.id)}&page=${pageContext}`)
  );

  return (
    <>
      <OpsTcInOpsGlanceHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search Voy No, vessel..."
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={(value) => {
          setBusinessType(value);
          updateQuery({ selBType: value, msg: '' });
        }}
        years={years}
        year={year}
        onYearChange={(value) => {
          setYear(value);
          updateQuery({ selYear: value, msg: '' });
        }}
      />

      <div className={`zafira-page ${pageStyles.page}`}>
        {loading || savingSheet ? (
          <LoadingOverlay show={loading || savingSheet} label={savingSheet ? 'Creating sheet…' : 'Loading TC Ops…'} fullScreen={false} />
        ) : null}
        {flash ? <div className={pageStyles.flashSuccess}>{flash.text}</div> : null}
        {error ? <div className={pageStyles.error}>{error}</div> : null}

        <div className={styles.widgetRow}>
          {WIDGETS.map((widget) => {
            const count = stats[widget.key] ?? 0;
            const variantClass = widget.variant === 'finTeal'
              ? styles.taskWidgetFinTeal
              : styles.taskWidgetCnt;
            return (
              <button
                key={widget.key}
                type="button"
                className={`${styles.taskWidget} ${variantClass}`}
                onClick={() => setWidgetModal(widget.key)}
              >
                <span className={styles.twIcon}>{WIDGET_ICONS[widget.key]}</span>
                <span className={styles.twBody}>
                  <span className={styles.twCount}>{count}</span>
                  <span className={styles.twLabel}>{widget.title}</span>
                </span>
              </button>
            );
          })}
        </div>

        <OpsTcStatusTabs />

        <OpsVcGlanceTable
          flushTop
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          showingLabel={`Showing ${rows.length} of ${total} operations`}
        >
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>TC Number</th>
              <th>Vessel</th>
              <th>CP Date</th>
              <th>Operator</th>
              <th>Charterer</th>
              <th>Worksheet</th>
              <th className={styles.iconTh} title="Compare worksheets"><CompareIcon /></th>
              <th>Del / Re-Del</th>
              <th>CHRT DESK</th>
              <th>Agency Letters</th>
              <th>Fin.</th>
              <th style={{ textAlign: 'center' }}>TC Recap</th>
              <th>Status</th>
              <th>{lastColumnLabel}</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={15} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row, index) => {
              const sheets = row.costSheets || [];
              const canCompare = canCompareSheets && sheets.length > 0;
              const operator = resolveOperator(row, operators);
              const routeLines = delReDelLines(row);
              return (
                <tr key={row.comId}>
                  <td className={styles.itemCell}>{(page - 1) * pageSize + index + 1}.</td>
                  <td>
                    <div className={styles.opsCell}>
                      <span className={styles.primary}>
                        <Link
                          to={appPath(`/internal-user/vc/tc/${encodeURIComponent(row.tcOutId)}/calculate?mode=view&from=ops-tc`)}
                          title="View TC estimate"
                        >
                          {row.tcNo || '—'}
                        </Link>
                        <VoyageStatusButton
                          enabled={sheets.length > 0}
                          onClick={() => setVoyageStatusRow(row)}
                        />
                      </span>
                      <span className={styles.sub}>
                        {row.message ? `Nom ID ${row.message}` : '—'}
                      </span>
                    </div>
                  </td>
                  <td className={row.isPeriod ? styles.periodVessel : undefined}>
                    <div className={styles.opsCell}>
                      <span className={styles.primary}>{row.vesselName || '—'}</span>
                      <span className={styles.sub}>{row.vesselType || '—'}</span>
                      {!isHistory && row.canDeactivate ? (
                        <div className={styles.vesselDocs}>
                          <Button
                            variant="link"
                            size="sm"
                            icon="trash"
                            className={`${styles.deleteIconBtn} ${styles.deleteIconDanger}`}
                            onClick={() => handleDeactivate(row)}
                            ariaLabel="Deactivate entry"
                          />
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className={styles.opsCell}>
                      <span className={styles.cpDate} title={row.cpDate || ''}>{row.cpDate || '—'}</span>
                      <span className={styles.sub}>
                        TC Days: {row.hireDays || '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.opCell}>
                      {canEditOperator ? (
                        <div className={`${pageStyles.operatorSelect} ${styles.opSelect}`}>
                          <CoaCardSelect
                            label="Operator"
                            value={operator.id}
                            options={operators}
                            placeholder="---Select from list---"
                            onChange={(value) => handleOperatorChange(row, value)}
                          />
                        </div>
                      ) : (
                        <span className={styles.primary}>{operator.name || '—'}</span>
                      )}
                      <div className={styles.opStamp}>
                        <span className={styles.opName}>{row.lastUpdatedBy || operator.name || '—'}</span>
                        <span className={styles.opTime}>{formatLastUpdated(row.lastUpdatedAt)}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.trunc} title={row.charterer || ''}>{row.charterer || '—'}</span>
                  </td>
                  <td>
                    {isHistory ? (
                      sheets.length ? (
                        <div className={styles.chipStack}>
                          {sheets.map((sheet) => (
                            <ChipLink key={sheet.id} to={costSheetPath(row, sheet)}>
                              {sheet.name}
                            </ChipLink>
                          ))}
                        </div>
                      ) : (
                        <span className={styles.muted}>No worksheets yet</span>
                      )
                    ) : (
                      <OpsVcWorksheetStack
                        sheets={sheets}
                        sheetHref={(sheet) => costSheetPath(row, sheet)}
                        onAdd={() => handleAddSheetClick(row)}
                      />
                    )}
                  </td>
                  <td>
                    <div className={styles.docCenter}>
                      <button
                        type="button"
                        className={`${styles.cmpBtn} ${canCompare ? '' : styles.cmpBtnDisabled}`}
                        title={canCompare ? 'Compare worksheets' : 'No worksheets yet'}
                        disabled={!canCompare}
                        onClick={() => canCompare && setCompareModal({ open: true, comId: row.comId })}
                      >
                        <CompareIcon />
                      </button>
                    </div>
                  </td>
                  <td>
                    {routeLines.length ? (
                      <div className={styles.route} title={row.ports || ''}>
                        {routeLines.map((line) => <span key={line}>{line}</span>)}
                      </div>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={styles.trunc} title={row.charteringTeam || ''}>{row.charteringTeam || '—'}</span>
                  </td>
                  <td>
                    <div className={styles.chipStack}>
                      <ChipLink
                        to={appPath(`/internal-user/vc/ops-tc/agency-letter?comid=${encodeURIComponent(row.comId)}&page=${pageContext}`)}
                      >
                        Generate Agency Letter
                      </ChipLink>
                    </div>
                  </td>
                  <td>
                    <Link
                      className={styles.iconBtn}
                      to={appPath(`/internal-user/vc/ops-tc/payment-grid?comid=${encodeURIComponent(row.comId)}&page=${pageContext}`)}
                      title="View Financials"
                    >
                      <EyeIcon />
                    </Link>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Link
                      className={styles.iconBtn}
                      to={appPath(`/internal-user/vc/tc/${encodeURIComponent(row.tcOutId)}/edit`)}
                      title="Edit TC Recap"
                    >
                      <EditRecapIcon size={18} />
                    </Link>
                  </td>
                  <td>
                    <div className={styles.alertStack}>
                      <span className={styles.muted}>—</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.nextActions}>
                      {isHistory ? (
                        <span className={styles.statusChip}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          {row.statusLabel || 'History'}
                        </span>
                      ) : isPostOps ? (
                        row.canMoveToHistory ? (
                          <button
                            type="button"
                            className={`${styles.pillAction} ${styles.pillActionNavy}`}
                            onClick={() => handleHistory(row)}
                          >
                            History
                            <ArrowIcon />
                          </button>
                        ) : null
                      ) : (
                        row.canMoveToPostOps ? (
                          <button type="button" className={styles.pillAction} onClick={() => handlePostOps(row)}>
                            Post Ops
                            <ArrowIcon />
                          </button>
                        ) : null
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </OpsVcGlanceTable>

        {sheetModal.open ? (
          <div className={pageStyles.modalBackdrop} role="dialog" aria-modal="true">
            <div className={pageStyles.modal}>
              <div className={pageStyles.modalHeader}>
                <h4>Add TC Sheet</h4>
                <button
                  type="button"
                  className={pageStyles.dangerIcon}
                  onClick={() => setSheetModal({ open: false, comId: '', sheetName: '' })}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p className={pageStyles.muted}>
                In the Ops side, enter any desired TC Sheet Name. This is then also possible after every Submit to Close.
              </p>
              <FilterField id="ops-tc-sheet-name" label="TC Sheet Name">
                <TextInput
                  id="ops-tc-sheet-name"
                  value={sheetModal.sheetName}
                  onChange={(e) => setSheetModal((prev) => ({ ...prev, sheetName: e.target.value }))}
                  placeholder="TC Sheet Name"
                />
              </FilterField>
              <div className={pageStyles.toolbarActions} style={{ marginTop: 12 }}>
                <Button label={savingSheet ? 'Submitting…' : 'Submit'} onClick={handleCreateSheet} disabled={savingSheet} />
                <Button
                  variant="outline"
                  label="Cancel"
                  onClick={() => setSheetModal({ open: false, comId: '', sheetName: '' })}
                  disabled={savingSheet}
                />
              </div>
            </div>
          </div>
        ) : null}

        {activeWidget ? (
          <div
            className={styles.widgetOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tc-ops-widget-title"
            onClick={() => setWidgetModal(null)}
          >
            <div
              className={styles.widgetModal}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.widgetModalHead}>
                <div className={styles.widgetModalTitleWrap}>
                  <div
                    className={`${styles.widgetModalIco} ${
                      activeWidget.variant === 'finTeal' ? styles.widgetModalIcoTeal : ''
                    }`}
                  >
                    {WIDGET_ICONS[activeWidget.key]}
                  </div>
                  <div>
                    <div id="tc-ops-widget-title" className={styles.widgetModalTitle}>
                      {activeWidget.title}
                    </div>
                    <div className={styles.widgetModalSubtitle}>
                      {activeWidget.subtitle(widgetItems.length)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.widgetClose}
                  onClick={() => setWidgetModal(null)}
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className={styles.widgetModalBody}>
                {widgetItems.length ? (
                  <div className={styles.widgetList}>
                    {widgetItems.map((item) => (
                      item.href ? (
                        <Link
                          key={item.key}
                          className={styles.widgetListItem}
                          to={item.href}
                          onClick={() => setWidgetModal(null)}
                        >
                          <span className={styles.wliId}>{item.id}</span>
                          <span className={styles.wliDetail}>{item.detail}</span>
                          <span className={styles.wliDue}>{item.due}</span>
                        </Link>
                      ) : (
                        <div key={item.key} className={styles.widgetListItem}>
                          <span className={styles.wliId}>{item.id}</span>
                          <span className={styles.wliDetail}>{item.detail}</span>
                          <span className={styles.wliDue}>{item.due}</span>
                        </div>
                      )
                    ))}
                  </div>
                ) : (
                  <div className={styles.widgetEmpty}>No matching fixtures on this page.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <OpsTcCompareSheetsModal
          open={compareModal.open}
          comId={compareModal.comId}
          onClose={() => setCompareModal({ open: false, comId: '' })}
        />
        <OpsVoyageStatusModal
          open={Boolean(voyageStatusRow)}
          row={voyageStatusRow}
          mode="tc"
          pageContext={pageContext}
          onClose={() => setVoyageStatusRow(null)}
        />
      </div>
    </>
  );
}

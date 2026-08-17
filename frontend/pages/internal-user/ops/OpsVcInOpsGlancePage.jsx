import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  FilterField,
  LoadingOverlay,
  SummaryCard,
  SummaryCardGrid,
  TextInput,
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { getUser } from '@bainbridge/shared-auth';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import {
  createOpsVcCostSheet,
  deactivateOpsVcEntry,
  fetchInOpsAtGlance,
  fetchOpsVcOperators,
  fetchOpsVcYears,
  moveOpsVcToPostOps,
  updateOpsVcCostSheetLayout,
  updateOpsVcOperator,
} from '../../../services/opsVc.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import CoaCardSelect from '../coa/CoaCardSelect.jsx';
import OpsVcListHeaderActions from './OpsVcListHeaderActions.jsx';
import OpsVcCompareSheetsModal from './OpsVcCompareSheetsModal.jsx';
import OpsVcWorksheetStack from './OpsVcWorksheetStack.jsx';
import pageStyles from './OpsPages.module.css';
import styles from './OpsVcInOpsGlancePage.module.css';

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 50;
const FLASH = {
  6: { type: 'success', text: 'Nomination sent to "Post Ops".' },
  3: { type: 'success', text: 'Status changed successfully.' },
  4: { type: 'success', text: 'New sheet added successfully.' },
};

const STAT_ICONS = {
  trades: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2 7 4-14 2 7h6" />
    </svg>
  ),
  vessels: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 14l1.3-5.2A2 2 0 0 1 8.2 7.3h7.6a2 2 0 0 1 1.9 1.5L19 14" />
      <path d="M12 3v4.3" />
      <path d="M12 3.5l3 1.2-3 1.1z" fill="currentColor" stroke="none" />
      <path d="M3 17.5c1.4 1 3 1 4.4 0 1.4-1 3-1 4.4 0 1.4 1 3 1 4.4 0 1.4-1 3-1 4.4 0" />
    </svg>
  ),
  worksheets: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
      <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
      <path d="M8 12h8" />
      <path d="M8 15.5h8" />
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

function DocFileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
      <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
      <path d="M8 12h8" />
      <path d="M8 15.5h8" />
      <path d="M8 19h3" />
    </svg>
  );
}

function DocDownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

function DocReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </svg>
  );
}

function DocFolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9z" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h10" />
      <path d="M10 5l3 3-3 3" />
      <path d="M21 16H11" />
      <path d="M14 19l-3-3 3-3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function portLines(ports) {
  if (!ports) return [];
  return String(ports).split('\n').map((line) => line.trim()).filter(Boolean);
}

function alertLabels(row) {
  const labels = [];
  if (row.paymentNotReceived) labels.push('Payment not Received');
  if (row.paymentNotPaid) labels.push('Payment not Paid');
  return labels;
}

function formatLastUpdated(value) {
  if (!value) return 'Not yet updated';
  return String(value).replace(/\s+/, ' · ');
}

export default function OpsVcInOpsGlancePage() {
  const confirm = useConfirm();
  const alert = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [years, setYears] = useState([]);
  const [operators, setOperators] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [year, setYear] = useState(searchParams.get('selYear') || String(new Date().getFullYear()));
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [canEditOperator, setCanEditOperator] = useState(false);
  const [canCompareSheets, setCanCompareSheets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSheet, setSavingSheet] = useState(false);
  const [error, setError] = useState('');
  const [sheetModal, setSheetModal] = useState({ open: false, comId: '', sheetName: '' });
  const [compareModal, setCompareModal] = useState({ open: false, comId: '' });
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flash = FLASH[Number(searchParams.get('msg'))];

  const updateQuery = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [types, yearOptions, operatorOptions, data] = await Promise.all([
        fetchVcBusinessTypes(businessType),
        fetchOpsVcYears(),
        fetchOpsVcOperators(),
        fetchInOpsAtGlance({
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
      setCanEditOperator(loggedInIsMgmt || Boolean(data.canEditOperator));
      setCanCompareSheets(Boolean(data.canCompareSheets));
    } catch (err) {
      setError(err.message || 'Failed to load In Ops at a glance.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, pageSize, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [businessType, debouncedSearch, year, pageSize]);

  const stats = useMemo(() => {
    const uniqueVessels = new Set(rows.map((row) => row.vesselName).filter(Boolean)).size;
    const worksheets = rows.reduce((sum, row) => sum + (row.costSheets?.length || 0), 0);
    const alerts = rows.reduce((sum, row) => sum + alertLabels(row).length, 0);
    return {
      trades: total,
      vessels: uniqueVessels,
      worksheets,
      alerts,
    };
  }, [rows, total]);

  const handleOperatorChange = async (row, operatorId) => {
    try {
      await updateOpsVcOperator(row.comId, operatorId);
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
      await deactivateOpsVcEntry(row.comId);
      updateQuery({ msg: 3 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to deactivate voyage.');
    }
  };

  const handlePostOps = async (row) => {
    const ok = await confirm({
      title: 'Push to Post Ops',
      message: `Are you sure to send Nom ID ${row.message} to Post Ops?`,
      confirmLabel: 'Post Ops',
    });
    if (!ok) return;
    try {
      await moveOpsVcToPostOps(row.comId);
      updateQuery({ msg: 6 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to move voyage to Post Ops.');
    }
  };

  const handleAddSheetClick = async (row) => {
    if (!row.canAddCostSheet) {
      await alert({
        title: 'Alert',
        message: 'Please make sure the last Voyage Financials is Submit to Close',
        confirmLabel: 'OK',
      });
      return;
    }
    setSheetModal({ open: true, comId: row.comId, sheetName: '' });
  };

  const handleWorksheetLayoutChange = async (row, sheets) => {
    const previous = row.costSheets || [];
    setRows((prev) => prev.map((item) => (
      String(item.comId) === String(row.comId) ? { ...item, costSheets: sheets } : item
    )));
    try {
      await updateOpsVcCostSheetLayout(row.comId, sheets.map((sheet) => ({
        id: sheet.id,
        pinned: Boolean(sheet.pinned),
        sortOrder: sheet.sortOrder,
      })));
    } catch (err) {
      setRows((prev) => prev.map((item) => (
        String(item.comId) === String(row.comId) ? { ...item, costSheets: previous } : item
      )));
      setError(err.message || 'Failed to update worksheet layout.');
    }
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
      await createOpsVcCostSheet(sheetModal.comId, sheetName);
      setSheetModal({ open: false, comId: '', sheetName: '' });
      updateQuery({ msg: 4 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to create Voyage Financials sheet.');
    } finally {
      setSavingSheet(false);
    }
  };

  const costSheetPath = (row, sheet) => (
    appPath(`/internal-user/vc/ops/cost-sheet?comid=${encodeURIComponent(row.comId)}&cost_sheet_id=${encodeURIComponent(sheet.id)}&page=1`)
  );

  return (
    <>
      <OpsVcListHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search Voy No, vessel…"
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
          <LoadingOverlay active label={savingSheet ? 'Creating sheet…' : 'Loading In Ops at a glance…'} />
        ) : null}
        {flash ? <div className={pageStyles.flashSuccess}>{flash.text}</div> : null}
        {error ? <div className={pageStyles.error}>{error}</div> : null}

        <h2 className={styles.pageTitle}>Spot Operations</h2>

        <SummaryCardGrid>
          <SummaryCard title="Trades in Operations" value={stats.trades} variant="fin" icon={STAT_ICONS.trades} />
          <SummaryCard title="Vessels in Operations" value={stats.vessels} variant="count" icon={STAT_ICONS.vessels} />
          <SummaryCard title="Worksheets" value={stats.worksheets} variant="fin" icon={STAT_ICONS.worksheets} />
          <SummaryCard title="Alerts" value={stats.alerts} variant="count" icon={STAT_ICONS.alerts} />
        </SummaryCardGrid>

        <div className={styles.actionRow}>
          <div className={styles.actionRowLeft}>
            <select
              className={styles.rowsSelect}
              value={pageSize}
              aria-label="Rows per page"
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          </div>
          <div className={styles.actionRowRight}>
            Showing {rows.length} of {total} operations
          </div>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Voy No.</th>
                  <th>CP Date</th>
                  <th>Vessel</th>
                  <th>Operator</th>
                  <th className={styles.iconTh}>Voy Docs</th>
                  <th>Cargo</th>
                  <th>LP / DP</th>
                  <th>CHRT DESK</th>
                  <th>Charterer</th>
                  <th>Worksheet</th>
                  <th className={styles.iconTh} title="Compare Working Sheets"><CompareIcon /></th>
                  <th>Port Letters</th>
                  <th>Disbursements</th>
                  <th>Port Activity</th>
                  <th>Calculations</th>
                  <th>Fin.</th>
                  <th>Alerts</th>
                  <th>Next</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length && !loading ? (
                  <tr>
                    <td colSpan={19} className={styles.emptyCell}>
                      SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                    </td>
                  </tr>
                ) : rows.map((row, index) => {
                  const sheets = row.costSheets || [];
                  const alerts = alertLabels(row);
                  const canCompare = canCompareSheets && sheets.length > 0;
                  const voyageReportHref = row.vesselImoNo
                    ? appPath(`/internal-user/vc/ops/voyage-report?vesselimono=${encodeURIComponent(row.vesselImoNo)}&comid=${encodeURIComponent(row.comId)}&page=1&type=VC&selYear=${encodeURIComponent(year)}`)
                    : '';
                  return (
                    <tr key={row.comId}>
                      <td className={styles.itemCell}>{(page - 1) * pageSize + index + 1}.</td>
                      <td>
                        <div className={styles.opsCell}>
                          <span className={styles.primary}>{row.voyageNo || '—'}</span>
                          <span className={styles.sub}>{row.message || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.opsCell}>
                          <span className={styles.primary}>{row.cpDate || '—'}</span>
                          <span className={styles.sub}>{row.ownBusiness || row.businessType || '—'}</span>
                        </div>
                      </td>
                      <td className={row.isPeriod ? styles.periodVessel : undefined}>
                        <div className={styles.opsCell}>
                          <span className={styles.primary}>{row.vesselName || '—'}</span>
                          <span className={styles.sub}>{row.vesselType || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.opCell}>
                          {canEditOperator ? (
                            <div className={`${pageStyles.operatorSelect} ${styles.opSelect}`}>
                              <CoaCardSelect
                                label="Operator"
                                value={row.operatorId || ''}
                                options={operators}
                                placeholder="---Select from list---"
                                onChange={(value) => handleOperatorChange(row, value)}
                              />
                            </div>
                          ) : (
                            <span className={styles.primary}>{row.operatorName || '—'}</span>
                          )}
                          <div className={styles.opStamp}>
                            {row.lastUpdatedBy ? <span className={styles.opName}>{row.lastUpdatedBy}</span> : null}
                            <span className={styles.opTime}>{formatLastUpdated(row.lastUpdatedAt)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.docCenter}>
                          <div className={styles.docGroup}>
                            <Link
                              className={styles.docBtn}
                              to={appPath(`/internal-user/sopf/viewestimate?id=${row.fcaId}&rttype=1`)}
                              title="View FVF (Finalised Voyage Fixture)"
                            >
                              <DocFileIcon />
                            </Link>
                            <a
                              className={styles.docBtn}
                              href={`/api/internal-user/sopf/estimate/${encodeURIComponent(row.fcaId)}/pdf`}
                              title="Download Voyage Docs"
                            >
                              <DocDownloadIcon />
                            </a>
                            {voyageReportHref ? (
                              <Link className={styles.docBtn} to={voyageReportHref} title="Voyage Report">
                                <DocReportIcon />
                              </Link>
                            ) : (
                              <span className={`${styles.docBtn} ${styles.docBtnDisabled}`} title="Voyage Report">
                                <DocReportIcon />
                              </span>
                            )}
                            <Link
                              className={styles.docBtn}
                              to={appPath(`/internal-user/vc/ops/documents?comid=${encodeURIComponent(row.comId)}&page=1`)}
                              title="Documents"
                            >
                              <DocFolderIcon />
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.trunc} title={row.materialName || ''}>{row.materialName || '—'}</span>
                      </td>
                      <td>
                        {portLines(row.ports).length ? (
                          <div className={styles.route}>
                            {portLines(row.ports).map((line) => <span key={line}>{line}</span>)}
                          </div>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={styles.trunc} title={row.charteringTeam || ''}>{row.charteringTeam || '—'}</span>
                      </td>
                      <td>
                        <span className={styles.trunc} title={row.charterer || ''}>{row.charterer || '—'}</span>
                      </td>
                      <td>
                        <OpsVcWorksheetStack
                          sheets={sheets}
                          sheetHref={(sheet) => costSheetPath(row, sheet)}
                          onAdd={() => handleAddSheetClick(row)}
                          onLayoutChange={(nextSheets) => handleWorksheetLayoutChange(row, nextSheets)}
                        />
                      </td>
                      <td>
                        <div className={styles.docCenter}>
                          <button
                            type="button"
                            className={`${styles.cmpBtn} ${canCompare ? '' : styles.cmpBtnDisabled}`}
                            title={canCompare ? 'Compare Working Sheets' : 'No worksheet yet'}
                            disabled={!canCompare}
                            onClick={() => canCompare && setCompareModal({ open: true, comId: row.comId })}
                          >
                            <CompareIcon />
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className={styles.chipStack}>
                          <Link
                            className={styles.chipLink}
                            to={appPath(`/internal-user/vc/ops/agency-letter?comid=${encodeURIComponent(row.comId)}&tab=1&page=1`)}
                          >
                            Port Letters
                          </Link>
                        </div>
                      </td>
                      <td>
                        <div className={styles.chipStack}>
                          <Link
                            className={styles.chipLink}
                            to={appPath(`/internal-user/vc/ops/pda-fda?comid=${encodeURIComponent(row.comId)}&page=1`)}
                          >
                            Disbursements
                          </Link>
                        </div>
                      </td>
                      <td>
                        <div className={styles.chipStack}>
                          <Link
                            className={styles.chipLink}
                            to={appPath(`/internal-user/vc/ops/sof?comid=${encodeURIComponent(row.comId)}&page=1`)}
                          >
                            SOF
                          </Link>
                          <Link
                            className={styles.chipLink}
                            to={appPath(`/internal-user/vc/ops/laytime?comid=${encodeURIComponent(row.comId)}&page=1`)}
                          >
                            Laytime
                          </Link>
                        </div>
                      </td>
                      <td>
                        <div className={styles.chipStack}>
                          <Link
                            className={styles.chipLink}
                            to={appPath(`/internal-user/vc/ops/bunker?comid=${encodeURIComponent(row.comId)}&page=1`)}
                          >
                            Bunkers
                          </Link>
                          <Link
                            className={styles.chipLink}
                            to={appPath(`/internal-user/vc/ops/soa-report?comid=${encodeURIComponent(row.comId)}&page=1`)}
                          >
                            Cashflow
                          </Link>
                        </div>
                      </td>
                      <td>
                        <Link
                          className={styles.iconBtn}
                          to={appPath(`/internal-user/vc/ops/payment-grid?comid=${encodeURIComponent(row.comId)}&page=1`)}
                          title="View Financials"
                        >
                          <EyeIcon />
                        </Link>
                      </td>
                      <td>
                        <div className={styles.alertStack}>
                          {alerts.map((label) => (
                            <span key={label} className={styles.alertPill}>
                              <AlertIcon />
                              {label}
                            </span>
                          ))}
                          {!alerts.length ? <span className={styles.muted}>—</span> : null}
                          {row.canDeactivate ? (
                            <button
                              type="button"
                              className={styles.deactivateBtn}
                              title="Deactivate entry"
                              onClick={() => handleDeactivate(row)}
                            >
                              <i className="bi bi-trash" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {row.canMoveToPostOps ? (
                          <button type="button" className={styles.pillAction} onClick={() => handlePostOps(row)}>
                            Post Ops
                            <ArrowIcon />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.tableFooter}>
            <SopfPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        </div>

        {sheetModal.open ? (
          <div className={pageStyles.modalBackdrop} role="dialog" aria-modal="true">
            <div className={pageStyles.modal}>
              <div className={pageStyles.modalHeader}>
                <h4>Add Voyage Financials</h4>
                <button
                  type="button"
                  className={pageStyles.dangerIcon}
                  onClick={() => setSheetModal({ open: false, comId: '', sheetName: '' })}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p className={pageStyles.muted}>Please enter Voyage Financials Name and Submit</p>
              <FilterField id="ops-vc-sheet-name" label="Voyage Financials Name">
                <TextInput
                  id="ops-vc-sheet-name"
                  value={sheetModal.sheetName}
                  onChange={(e) => setSheetModal((prev) => ({ ...prev, sheetName: e.target.value }))}
                  placeholder="Voyage Financials Name"
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

        <OpsVcCompareSheetsModal
          open={compareModal.open}
          comId={compareModal.comId}
          onClose={() => setCompareModal({ open: false, comId: '' })}
        />
      </div>
    </>
  );
}

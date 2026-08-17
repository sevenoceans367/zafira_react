import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
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
  createOpsVcCostSheet,
  deactivateOpsVcEntry,
  fetchOpsVcOperators,
  fetchOpsVcYears,
  fetchPostOpsAtGlance,
  moveOpsVcToHistory,
  updateOpsVcCostSheetLayout,
  updateOpsVcOperator,
} from '../../../services/opsVc.js';
import CoaCardSelect from '../coa/CoaCardSelect.jsx';
import OpsVcListHeaderActions from './OpsVcListHeaderActions.jsx';
import OpsVcCompareSheetsModal from './OpsVcCompareSheetsModal.jsx';
import OpsVcWorksheetStack from './OpsVcWorksheetStack.jsx';
import {
  AlertIcon,
  ArrowIcon,
  ChipLink,
  CompareIcon,
  DEFAULT_PAGE_SIZE,
  EyeIcon,
  OpsVcGlanceHeader,
  OpsVcGlanceTable,
  VoyDocsCell,
  alertLabels,
  formatLastUpdated,
  glanceStats,
  portLines,
} from './OpsVcGlanceUi.jsx';
import pageStyles from './OpsPages.module.css';
import styles from './OpsVcInOpsGlancePage.module.css';

const PAGE_CONTEXT = 2;
const FLASH = {
  3: { type: 'success', text: 'Nomination sent to "History".' },
  2: { type: 'success', text: 'Status changed successfully.' },
  0: { type: 'success', text: 'In Post Ops at a glance added/updated successfully.' },
  4: { type: 'success', text: 'New sheet added successfully.' },
};

const CARDS = [
  { key: 'trades', title: 'Trades in Post Ops', variant: 'fin', icon: 'trades' },
  { key: 'vessels', title: 'Vessels in Post Ops', variant: 'count', icon: 'vessels' },
  { key: 'worksheets', title: 'Worksheets', variant: 'fin', icon: 'worksheets' },
  { key: 'alerts', title: 'Alerts', variant: 'count', icon: 'alerts' },
];

export default function OpsVcPostOpsPage() {
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
        fetchPostOpsAtGlance({
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
      setError(err.message || 'Failed to load Post Ops at a glance.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, pageSize, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [businessType, debouncedSearch, year, pageSize]);

  const stats = useMemo(() => glanceStats(rows, total), [rows, total]);

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
      updateQuery({ msg: 2 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to deactivate voyage.');
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
      await moveOpsVcToHistory(row.comId);
      updateQuery({ msg: 3 });
      load();
    } catch (err) {
      setError(err.message || 'Failed to move voyage to History.');
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
    appPath(`/internal-user/vc/ops/cost-sheet?comid=${encodeURIComponent(row.comId)}&cost_sheet_id=${encodeURIComponent(sheet.id)}&page=${PAGE_CONTEXT}`)
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
          <LoadingOverlay active label={savingSheet ? 'Creating sheet…' : 'Loading Post Ops at a glance…'} />
        ) : null}
        {flash ? <div className={pageStyles.flashSuccess}>{flash.text}</div> : null}
        {error ? <div className={pageStyles.error}>{error}</div> : null}

        <OpsVcGlanceHeader
          title="Post Ops"
          stats={stats}
          cards={CARDS}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          showingLabel={`Showing ${rows.length} of ${total} operations`}
        />

        <OpsVcGlanceTable page={page} pageSize={pageSize} total={total} onPageChange={setPage}>
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
                ? appPath(`/internal-user/vc/ops/voyage-report?vesselimono=${encodeURIComponent(row.vesselImoNo)}&comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}&type=VC&selYear=${encodeURIComponent(year)}`)
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
                    <VoyDocsCell
                      fcaId={row.fcaId}
                      rttype={3}
                      voyageReportHref={voyageReportHref}
                      documentsHref={appPath(`/internal-user/vc/ops/documents?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                    />
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
                      <ChipLink to={appPath(`/internal-user/vc/ops/agency-letter?comid=${encodeURIComponent(row.comId)}&tab=1&page=${PAGE_CONTEXT}`)}>
                        Port Letters
                      </ChipLink>
                    </div>
                  </td>
                  <td>
                    <div className={styles.chipStack}>
                      <ChipLink to={appPath(`/internal-user/vc/ops/pda-fda?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}>
                        Disbursements
                      </ChipLink>
                    </div>
                  </td>
                  <td>
                    <div className={styles.chipStack}>
                      <ChipLink to={appPath(`/internal-user/vc/ops/sof?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}>SOF</ChipLink>
                      <ChipLink to={appPath(`/internal-user/vc/ops/laytime?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}>Laytime</ChipLink>
                    </div>
                  </td>
                  <td>
                    <div className={styles.chipStack}>
                      <ChipLink to={appPath(`/internal-user/vc/ops/bunker?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}>Bunkers</ChipLink>
                      <ChipLink to={appPath(`/internal-user/vc/ops/soa-report?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}>Cashflow</ChipLink>
                    </div>
                  </td>
                  <td>
                    <Link
                      className={styles.iconBtn}
                      to={appPath(`/internal-user/vc/ops/payment-grid?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
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
                    {row.canMoveToHistory ? (
                      <button type="button" className={styles.pillAction} onClick={() => handleHistory(row)}>
                        History
                        <ArrowIcon />
                      </button>
                    ) : null}
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
              <FilterField id="ops-vc-post-sheet-name" label="Voyage Financials Name">
                <TextInput
                  id="ops-vc-post-sheet-name"
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

import React, { useCallback, useEffect, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import {
  fetchHistoryAtGlance,
  updateOpsVcCostSheetLayout,
} from '../../../services/opsVc.js';
import OpsVcListHeaderActions from './OpsVcListHeaderActions.jsx';
import OpsVcWorksheetStack from './OpsVcWorksheetStack.jsx';
import OpsVoyageStatusModal, { VoyageStatusButton } from './OpsVoyageStatusModal.jsx';
import {
  AlertIcon,
  ChipLink,
  DEFAULT_PAGE_SIZE,
  EyeIcon,
  OpsVcGlanceTable,
  VoyDocsCell,
  alertLabels,
  formatLastUpdated,
  portLines,
} from './OpsVcGlanceUi.jsx';
import OpsVcTaskWidgets from './OpsVcTaskWidgets.jsx';
import OpsVcStatusTabs from './OpsVcStatusTabs.jsx';
import pageStyles from './OpsPages.module.css';
import styles from './OpsVcInOpsGlancePage.module.css';

const PAGE_CONTEXT = 3;
const FLASH = {
  0: { type: 'success', text: 'Vessels in History added/updated successfully.' },
  2: { type: 'success', text: 'Status changed successfully.' },
};

export default function OpsVcHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [searchInput, setSearchInput] = useState(searchParams.get('voy_no') || '');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voyageStatusRow, setVoyageStatusRow] = useState(null);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const flashMsg = searchParams.get('msg');
  const flash = useTimedFlash(flashMsg != null && flashMsg !== '' ? FLASH[Number(flashMsg)] : null);
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
      const [types, data] = await Promise.all([
        fetchVcBusinessTypes(businessType),
        fetchHistoryAtGlance({
          selBType: businessType,
          search: debouncedSearch,
          page,
          pageSize,
        }),
      ]);
      setBusinessTypes(types);
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
    } catch (err) {
      setError(err.message || 'Failed to load Vessels in History.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, pageSize]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [businessType, debouncedSearch, pageSize]);

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
      />

      <div className={`zafira-page ${pageStyles.page}`}>
        {loading ? <LoadingOverlay active label="Loading Vessels in History…" /> : null}
        {flash ? <div className={pageStyles.flashSuccess}>{flash.text}</div> : null}
        {error ? <div className={pageStyles.error}>{error}</div> : null}

        <OpsVcTaskWidgets rows={rows} pageContext={PAGE_CONTEXT} />

        <OpsVcStatusTabs />

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
              <th>Voy No.</th>
              <th>CP Date</th>
              <th>Vessel</th>
              <th>Operator</th>
              <th>Cargo</th>
              <th>Worksheet</th>
              <th>LP / DP</th>
              <th>CHRT DESK</th>
              <th>Charterer</th>
              <th>Voyage Letters</th>
              <th>Disbursements</th>
              <th>Port Activity</th>
              <th>Calculations</th>
              <th>Fin.</th>
              <th>Alerts</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={17} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row, index) => {
              const sheets = row.costSheets || [];
              const alerts = alertLabels(row);
              const hasWorksheet = sheets.length > 0;
              const voyageReportHref = row.vesselImoNo
                ? appPath(`/internal-user/vc/ops/voyage-report?vesselimono=${encodeURIComponent(row.vesselImoNo)}&comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}&type=VC`)
                : '';
              return (
                <tr key={row.comId}>
                  <td className={styles.itemCell}>{(page - 1) * pageSize + index + 1}.</td>
                  <td>
                    <div className={styles.opsCell}>
                      <span className={styles.primary}>
                        <span>{row.voyageNo || '—'}</span>
                        <VoyageStatusButton
                          enabled={hasWorksheet}
                          onClick={() => setVoyageStatusRow(row)}
                        />
                      </span>
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
                      <VoyDocsCell
                        className={styles.vesselDocs}
                        fcaId={row.fcaId}
                        rttype={4}
                        voyageReportHref={voyageReportHref}
                        documentsHref={appPath(`/internal-user/vc/ops/documents?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                      />
                    </div>
                  </td>
                  <td>
                    <div className={styles.opCell}>
                      <span className={styles.primary}>{row.operatorName || '—'}</span>
                      <div className={styles.opStamp}>
                        {row.lastUpdatedBy ? <span className={styles.opName}>{row.lastUpdatedBy}</span> : null}
                        <span className={styles.opTime}>{formatLastUpdated(row.lastUpdatedAt)}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.trunc} title={row.materialName || ''}>{row.materialName || '—'}</span>
                  </td>
                  <td>
                    <OpsVcWorksheetStack
                      sheets={sheets}
                      sheetHref={(sheet) => costSheetPath(row, sheet)}
                      onLayoutChange={(nextSheets) => handleWorksheetLayoutChange(row, nextSheets)}
                    />
                  </td>
                  <td>
                    {portLines(row.ports).length ? (
                      <div className={styles.route} title={row.ports || ''}>
                        {portLines(row.ports).map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
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
                    <div className={styles.chipStack}>
                      <ChipLink to={appPath(`/internal-user/vc/ops/agency-letter?comid=${encodeURIComponent(row.comId)}&tab=1&page=${PAGE_CONTEXT}`)}>
                        Voyage Letters
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
                      <ChipLink
                        to={appPath(`/internal-user/vc/ops/sof?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                        disabled={!hasWorksheet}
                      >
                        SOF
                      </ChipLink>
                      <ChipLink
                        to={appPath(`/internal-user/vc/ops/laytime?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                        disabled={!hasWorksheet}
                      >
                        Laytime
                      </ChipLink>
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
                    </div>
                  </td>
                  <td>
                    <span className={styles.statusPill}>{row.statusLabel || 'History'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </OpsVcGlanceTable>

        <OpsVoyageStatusModal
          open={Boolean(voyageStatusRow)}
          row={voyageStatusRow}
          mode="vc"
          pageContext={PAGE_CONTEXT}
          onClose={() => setVoyageStatusRow(null)}
        />
      </div>
    </>
  );
}

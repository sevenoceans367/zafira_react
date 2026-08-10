import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  DownloadIcon,
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
  updateOpsVcOperator,
} from '../../../services/opsVc.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import CoaCardSelect from '../coa/CoaCardSelect.jsx';
import OpsVcListHeaderActions from './OpsVcListHeaderActions.jsx';
import OpsVcCompareSheetsModal from './OpsVcCompareSheetsModal.jsx';
import styles from './OpsPages.module.css';

const PAGE_SIZE = 50;
const PAGE_CONTEXT = 2;
const FLASH = {
  3: { type: 'success', text: 'Nomination sent to "History".' },
  2: { type: 'success', text: 'Status changed successfully.' },
  0: { type: 'success', text: 'In Post Ops at a glance added/updated successfully.' },
  4: { type: 'success', text: 'New sheet added successfully.' },
};

function Multiline({ value }) {
  if (!value) return '—';
  return String(value).split('\n').map((line, index) => (
    <span key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </span>
  ));
}

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
          pageSize: PAGE_SIZE,
        }),
      ]);
      setBusinessTypes(types);
      setYears(yearOptions);
      setOperators(Array.isArray(operatorOptions) ? operatorOptions : []);
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
      // PHP: $_SESSION['iutype'] == 'mgmt_user' shows operator <select>
      const loggedInIsMgmt = getUser()?.userType === 'mgmt_user';
      setCanEditOperator(loggedInIsMgmt || Boolean(data.canEditOperator));
      setCanCompareSheets(Boolean(data.canCompareSheets));
    } catch (err) {
      setError(err.message || 'Failed to load Post Ops at a glance.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [businessType, debouncedSearch, year]);

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

  return (
    <>
      <OpsVcListHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
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

      <div className={`zafira-page ${styles.page}`}>
      {loading || savingSheet ? (
        <LoadingOverlay active label={savingSheet ? 'Creating sheet…' : 'Loading Post Ops at a glance…'} />
      ) : null}
      {flash ? <div className={styles.flashSuccess}>{flash.text}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>In Post Ops at a glance - VC</h3>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>FVF /<br />Voyage Docs</th>
              <th>Nom ID /<br />Voyage No.</th>
              <th>Business<br />Type</th>
              <th>Material<br />Name</th>
              <th>Vessel</th>
              <th>LP/DP</th>
              <th>Charterer</th>
              <th>CP<br />Date</th>
              <th>Voyage<br />Financials</th>
              <th>PDA<br />Request</th>
              <th>PDA/<br />FDA</th>
              <th>Calculations</th>
              <th>Payment<br />Grid</th>
              <th className={styles.alertsCell}>Deactivate</th>
              <th>Operator</th>
              <th>Last Updated<br />By/Time</th>
              <th>Chartering<br />Team</th>
              <th>Complete</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && !loading ? (
              <tr>
                <td colSpan={18} className={styles.emptyCell}>
                  SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.comId}>
                <td className={styles.actionsCell}>
                  <Link to={appPath(`/internal-user/sopf/viewestimate?id=${row.fcaId}&rttype=3`)}>FVF</Link>
                  <span className={styles.muted}> | </span>
                  <a href={`/api/internal-user/sopf/estimate/${encodeURIComponent(row.fcaId)}/pdf`} title="Download PDF">
                    <DownloadIcon size={16} title="" />
                  </a>
                  <div>
                    <Link
                      to={appPath(`/internal-user/vc/ops/documents?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                      title="Click me"
                    >
                      Docs
                    </Link>
                  </div>
                </td>
                <td>
                  {row.message}
                  <br />
                  {row.voyageNo || '—'}
                  <div>
                    {row.vesselImoNo ? (
                      <Link
                        to={appPath(`/internal-user/vc/ops/voyage-report?vesselimono=${encodeURIComponent(row.vesselImoNo)}&comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}&type=VC&selYear=${encodeURIComponent(year)}`)}
                      >
                        Voyage Report
                      </Link>
                    ) : (
                      <span className={styles.linkMuted}>Voyage Report</span>
                    )}
                  </div>
                </td>
                <td>{row.businessType || '—'}</td>
                <td className={styles.wrapCell}>{row.materialName || '—'}</td>
                <td className={row.isPeriod ? styles.periodVessel : undefined}>
                  {row.vesselName || '—'}
                  <br />
                  {row.vesselType || '—'}
                </td>
                <td className={styles.wrapCell}><Multiline value={row.ports} /></td>
                <td className={styles.wrapCell}>{row.charterer || '—'}</td>
                <td>
                  {row.cpDate || '—'}
                  <br />
                  {row.ownBusiness || ''}
                </td>
                <td className={styles.actionsCell}>
                  {(row.costSheets || []).map((sheet) => (
                    <div key={sheet.id}>
                      <Link
                        to={appPath(`/internal-user/vc/ops/cost-sheet?comid=${encodeURIComponent(row.comId)}&cost_sheet_id=${encodeURIComponent(sheet.id)}&page=${PAGE_CONTEXT}`)}
                      >
                        {sheet.name}
                      </Link>
                    </div>
                  ))}
                  <div>
                    <Button
                      size="sm"
                      label="A"
                      title="Add New CS"
                      onClick={() => handleAddSheetClick(row)}
                    />
                  </div>
                </td>
                <td>
                  <Link
                    to={appPath(`/internal-user/vc/ops/agency-letter?comid=${encodeURIComponent(row.comId)}&tab=1&page=${PAGE_CONTEXT}`)}
                  >
                    Generate Port Related Letters
                  </Link>
                </td>
                <td>
                  <Link
                    to={appPath(`/internal-user/vc/ops/pda-fda?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                  >
                    PDA/FDA
                  </Link>
                </td>
                <td className={styles.actionsCell}>
                  <div>
                    <Link
                      className={styles.opsViewLink}
                      to={appPath(`/internal-user/vc/ops/sof?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                    >
                      SOF
                    </Link>
                  </div>
                  <div>
                    <Link
                      className={styles.opsViewLink}
                      to={appPath(`/internal-user/vc/ops/laytime?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                    >
                      Laytime
                    </Link>
                  </div>
                  <div>
                    <Link
                      className={styles.opsViewLink}
                      to={appPath(`/internal-user/vc/ops/bunker?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                    >
                      Bunkers
                    </Link>
                  </div>
                  <div>
                    <Link
                      className={styles.opsViewLink}
                      to={appPath(`/internal-user/vc/ops/soa-report?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                    >
                      SOA
                    </Link>
                  </div>
                </td>
                <td>
                  <Link
                    className={styles.opsViewLink}
                    to={appPath(`/internal-user/vc/ops/payment-grid?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                  >
                    <strong>View</strong>
                  </Link>
                </td>
                <td className={`${styles.actionsCell} ${styles.alertsCell}`}>
                  {row.canDeactivate ? (
                    <div className={styles.alertsBin}>
                      <button type="button" className={styles.dangerIcon} title="Deactivate entry" onClick={() => handleDeactivate(row)}>
                        <i className="bi bi-trash" aria-hidden />
                      </button>
                    </div>
                  ) : null}
                  {canCompareSheets ? (
                    <div>
                      <Button
                        size="sm"
                        label="Compare Sheets"
                        title="Compare Sheets"
                        onClick={() => setCompareModal({ open: true, comId: row.comId })}
                      />
                    </div>
                  ) : null}
                </td>
                <td>
                  {canEditOperator ? (
                    <div className={styles.operatorSelect}>
                      <CoaCardSelect
                        label="Operator"
                        value={row.operatorId || ''}
                        options={operators}
                        placeholder="---Select from list---"
                        onChange={(value) => handleOperatorChange(row, value)}
                      />
                    </div>
                  ) : (row.operatorName || '—')}
                </td>
                <td>
                  {row.lastUpdatedBy || '—'}
                  {row.lastUpdatedAt ? (
                    <>
                      <br />
                      {row.lastUpdatedAt}
                    </>
                  ) : null}
                </td>
                <td>{row.charteringTeam || '—'}</td>
                <td>
                  {row.canMoveToHistory ? (
                    <Button size="sm" label="History" onClick={() => handleHistory(row)} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SopfPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {sheetModal.open ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h4>Add Voyage Financials</h4>
              <button
                type="button"
                className={styles.dangerIcon}
                onClick={() => setSheetModal({ open: false, comId: '', sheetName: '' })}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className={styles.muted}>Please enter Voyage Financials Name and Submit</p>
            <FilterField id="ops-vc-post-sheet-name" label="Voyage Financials Name">
              <TextInput
                id="ops-vc-post-sheet-name"
                value={sheetModal.sheetName}
                onChange={(e) => setSheetModal((prev) => ({ ...prev, sheetName: e.target.value }))}
                placeholder="Voyage Financials Name"
              />
            </FilterField>
            <div className={styles.toolbarActions} style={{ marginTop: 12 }}>
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

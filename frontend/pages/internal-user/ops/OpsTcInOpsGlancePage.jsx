import React, { useCallback, useEffect, useState } from 'react';
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
  createOpsTcCostSheet,
  deactivateOpsTcEntry,
  fetchInOpsAtGlanceTc,
  fetchOpsTcOperators,
  fetchOpsTcYears,
  moveOpsTcToPostOps,
  updateOpsTcOperator,
} from '../../../services/opsTc.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import CoaCardSelect from '../coa/CoaCardSelect.jsx';
import OpsTcCompareSheetsModal from './OpsTcCompareSheetsModal.jsx';
import OpsTcInOpsGlanceHeaderActions from './OpsTcInOpsGlanceHeaderActions.jsx';
import styles from './OpsPages.module.css';

const PAGE_SIZE = 50;
const FLASH = {
  0: { type: 'success', text: 'In Ops at a glance added/updated successfully.' },
  6: { type: 'success', text: 'Nomination sent to "Post Ops".' },
  3: { type: 'success', text: 'Status changed successfully.' },
  4: { type: 'success', text: 'New sheet added successfully.' },
};

export default function OpsTcInOpsGlancePage() {
  const confirm = useConfirm();
  const alert = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [years, setYears] = useState([]);
  const [operators, setOperators] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '2');
  const [year, setYear] = useState(searchParams.get('selYear') || String(new Date().getFullYear()));
  const [searchInput, setSearchInput] = useState(searchParams.get('voy_no') || '');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [canEditOperator, setCanEditOperator] = useState(false);
  const [canCompareSheets, setCanCompareSheets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheetModal, setSheetModal] = useState({ open: false, comId: '', sheetName: '' });
  const [compareModal, setCompareModal] = useState({ open: false, comId: '' });
  const [savingSheet, setSavingSheet] = useState(false);
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
        fetchOpsTcYears(),
        fetchOpsTcOperators(),
        fetchInOpsAtGlanceTc({
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
      const loggedInIsMgmt = getUser()?.userType === 'mgmt_user';
      setCanEditOperator(loggedInIsMgmt || Boolean(data.canEditOperator));
      setCanCompareSheets(Boolean(data.canCompareSheets));
    } catch (err) {
      setError(err.message || 'Failed to load In Ops at a glance TC.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [businessType, debouncedSearch, year]);

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
      updateQuery({ msg: 3 });
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

  return (
    <>
      <OpsTcInOpsGlanceHeaderActions
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
          <LoadingOverlay active label={savingSheet ? 'Creating sheet…' : 'Loading In Ops at a glance TC…'} />
        ) : null}
        {flash ? <div className={styles.flashSuccess}>{flash.text}</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <h3 className={styles.title}>In Ops at a glance - TC</h3>

        <div className={`${styles.tableWrap} ${styles.wideTableWrap}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Final TC Est /<br />Docs</th>
                <th>Nom ID /<br />TC No.</th>
                <th>Business<br />Type</th>
                <th>Vessel</th>
                <th>Charterer</th>
                <th>CP<br />Date</th>
                <th>Port Del /<br />Port Re-Del</th>
                <th>Checklist</th>
                <th>TC days /<br />Fixture Note</th>
                <th>TC<br />Financials</th>
                <th>Agency<br />Letters</th>
                <th>Payment /<br />Invoices</th>
                <th className={styles.alertsCell}>De-activate /<br />Compare</th>
                <th>Operator</th>
                <th>Re-Del<br />Date</th>
                <th>Chartering<br />Team</th>
                <th>Change TC<br />Status</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={17} className={styles.emptyCell}>
                    SORRY CURRENTLY THERE ARE ZERO(0) RECORDS
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.comId}>
                  <td className={styles.actionsCell}>
                    <Link
                      to={appPath(`/internal-user/vc/tc/${encodeURIComponent(row.tcOutId)}/calculate?mode=view&from=ops-tc`)}
                    >
                      TC
                    </Link>
                    <div>
                      <Link
                        to={appPath(`/internal-user/vc/ops-tc/documents?comid=${encodeURIComponent(row.comId)}&page=1`)}
                        title="Click me"
                      >
                        Docs
                      </Link>
                    </div>
                  </td>
                  <td>
                    {row.message || '—'}
                    <br />
                    <span className={styles.alertText}>{row.tcNo || '—'}</span>
                  </td>
                  <td>{row.businessType || '—'}</td>
                  <td className={row.isPeriod ? styles.periodVessel : undefined}>
                    {row.vesselName || '—'}
                    <br />
                    {row.vesselType || '—'}
                  </td>
                  <td className={styles.wrapCell}>{row.charterer || '—'}</td>
                  <td>{row.cpDate || '—'}</td>
                  <td className={styles.wrapCell}>{row.ports || '—'}</td>
                  <td>
                    <Link
                      to={appPath(`/internal-user/vc/ops-tc/checklist?comid=${encodeURIComponent(row.comId)}&page=1`)}
                      style={{ color: '#b42318' }}
                    >
                      Check List
                    </Link>
                  </td>
                  <td>
                    {row.hireDays || '—'}
                    <br />
                    <Link
                      to={appPath(`/internal-user/vc/ops-tc/fixture-note?comid=${encodeURIComponent(row.comId)}&page=1`)}
                    >
                      Fixture Note
                    </Link>
                  </td>
                  <td className={styles.actionsCell}>
                    {(row.costSheets || []).map((sheet) => (
                      <div key={sheet.id}>
                        <Link
                          to={appPath(`/internal-user/vc/ops-tc/cost-sheet?comid=${encodeURIComponent(row.comId)}&cost_sheet_id=${encodeURIComponent(sheet.id)}&page=1`)}
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
                      to={appPath(`/internal-user/vc/ops-tc/agency-letter?comid=${encodeURIComponent(row.comId)}&page=1`)}
                    >
                      Generate Agency Letter
                    </Link>
                  </td>
                  <td>
                    <Link
                      className={styles.opsViewLink}
                      to={appPath(`/internal-user/vc/ops-tc/payment-grid?comid=${encodeURIComponent(row.comId)}&page=1`)}
                      title="Payment / Invoice Grid"
                    >
                      <strong>View</strong>
                    </Link>
                  </td>
                  <td className={`${styles.actionsCell} ${styles.alertsCell}`}>
                    {row.canDeactivate ? (
                      <div className={styles.alertsBin}>
                        <button
                          type="button"
                          className={styles.dangerIcon}
                          title="Deactivate entry"
                          onClick={() => handleDeactivate(row)}
                        >
                          <i className="bi bi-trash" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                    {canCompareSheets ? (
                      <div>
                        <Button
                          size="sm"
                          label="Compare"
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
                  <td>{row.reDelDate || '—'}</td>
                  <td>{row.charteringTeam || '—'}</td>
                  <td>
                    {row.canMoveToPostOps ? (
                      <Button size="sm" label="Post Ops" onClick={() => handlePostOps(row)} />
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
                <h4>Add TC Sheet</h4>
                <button
                  type="button"
                  className={styles.dangerIcon}
                  onClick={() => setSheetModal({ open: false, comId: '', sheetName: '' })}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p className={styles.muted}>
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

        <OpsTcCompareSheetsModal
          open={compareModal.open}
          comId={compareModal.comId}
          onClose={() => setCompareModal({ open: false, comId: '' })}
        />
      </div>
    </>
  );
}

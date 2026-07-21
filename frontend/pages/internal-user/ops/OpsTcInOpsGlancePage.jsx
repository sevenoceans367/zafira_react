import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  FilterBar,
  FilterField,
  LoadingOverlay,
  Select,
  TextInput,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [years, setYears] = useState([]);
  const [operators, setOperators] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '3');
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
      setOperators(operatorOptions);
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
      // PHP: $_SESSION['iutype'] == 'mgmt_user' shows operator <select>
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

  const handleCreateSheet = async () => {
    const sheetName = String(sheetModal.sheetName || '').trim();
    if (!sheetName) {
      setError('TC Sheet Name is required.');
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
      />

      <div className={`zafira-page ${styles.page}`}>
      {loading || savingSheet ? (
        <LoadingOverlay active label={savingSheet ? 'Creating sheet…' : 'Loading In Ops at a glance TC…'} />
      ) : null}
      {flash ? <div className={styles.flashSuccess}>{flash.text}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <h3 className={styles.title}>In Ops at a glance - TC</h3>

      <FilterBar
        actions={<Button variant="primary" label="Load" onClick={load} disabled={loading} />}
      >
        <FilterField label="Business Type">
          <CoaCardSelect
            label="Business Type"
            value={businessType}
            options={businessTypes}
            includeEmpty={false}
            onChange={(value) => {
              setBusinessType(value);
              updateQuery({ selBType: value, msg: '' });
            }}
          />
        </FilterField>
        <FilterField label="Year">
          <CoaCardSelect
            label="Year"
            value={year}
            options={years}
            includeEmpty={false}
            onChange={(value) => {
              setYear(value);
              updateQuery({ selYear: value, msg: '' });
            }}
          />
        </FilterField>
      </FilterBar>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Final TC Est / Docs</th>
              <th>Nom ID / TC No.</th>
              <th>Business Type</th>
              <th>Vessel</th>
              <th>Charterer</th>
              <th>CP Date</th>
              <th>Port Del / Port Re-Del</th>
              <th>Checklist</th>
              <th>TC days / Fixture Note</th>
              <th>TC Financials</th>
              <th>Agency Letters</th>
              <th>Payment / Invoices</th>
              <th>De-activate / Compare</th>
              <th>Operator</th>
              <th>Re-Del Date</th>
              <th>Chartering Team</th>
              <th>Change TC Status</th>
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
                  <div className={styles.muted}>Docs</div>
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
                  {!row.costSheets?.length ? <span className={styles.muted}>—</span> : null}
                  {row.canAddCostSheet ? (
                    <Button
                      size="sm"
                      label="A"
                      title="Add New CS"
                      onClick={() => setSheetModal({ open: true, comId: row.comId, sheetName: '' })}
                    />
                  ) : null}
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
                    to={appPath(`/internal-user/vc/ops-tc/payment-grid?comid=${encodeURIComponent(row.comId)}&page=1`)}
                  >
                    View
                  </Link>
                </td>
                <td className={styles.actionsCell}>
                  {row.canDeactivate ? (
                    <button
                      type="button"
                      className={styles.dangerIcon}
                      title="Deactivate entry"
                      onClick={() => handleDeactivate(row)}
                    >
                      <i className="bi bi-x-lg" aria-hidden />
                    </button>
                  ) : null}
                  {canCompareSheets ? (
                    <Button
                      size="sm"
                      label="Compare"
                      title="Compare Sheets"
                      onClick={() => setCompareModal({ open: true, comId: row.comId })}
                    />
                  ) : null}
                </td>
                <td>
                  {canEditOperator ? (
                    <Select
                      value={row.operatorId || ''}
                      onChange={(e) => handleOperatorChange(row, e.target.value)}
                    >
                      <option value="">---Select from list---</option>
                      {operators.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </Select>
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

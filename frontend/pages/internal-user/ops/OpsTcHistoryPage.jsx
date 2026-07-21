import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  FilterBar,
  FilterField,
  LoadingOverlay,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import useDebouncedValue from '../../../hooks/useDebouncedValue.js';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import { fetchHistoryAtGlanceTc, fetchOpsTcYears } from '../../../services/opsTc.js';
import SopfPagination from '../sopf/SopfPagination.jsx';
import CoaCardSelect from '../coa/CoaCardSelect.jsx';
import OpsTcCompareSheetsModal from './OpsTcCompareSheetsModal.jsx';
import OpsTcInOpsGlanceHeaderActions from './OpsTcInOpsGlanceHeaderActions.jsx';
import styles from './OpsPages.module.css';

const PAGE_SIZE = 50;
const PAGE_CONTEXT = 3;
const FLASH = {
  0: { type: 'success', text: 'Vessels in History added/updated successfully.' },
  2: { type: 'success', text: 'Status changed successfully.' },
};

export default function OpsTcHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [years, setYears] = useState([]);
  const [businessType, setBusinessType] = useState(searchParams.get('selBType') || '3');
  const [year, setYear] = useState(searchParams.get('selYear') || String(new Date().getFullYear()));
  const [searchInput, setSearchInput] = useState(searchParams.get('voy_no') || '');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      const [types, yearOptions, data] = await Promise.all([
        fetchVcBusinessTypes(businessType),
        fetchOpsTcYears(),
        fetchHistoryAtGlanceTc({
          selBType: businessType,
          selYear: year,
          search: debouncedSearch,
          page,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setBusinessTypes(types);
      setYears(yearOptions);
      setRows(data.records || []);
      setTotal(data.recordsTotal || 0);
    } catch (err) {
      setError(err.message || 'Failed to load Vessels in History TC.');
    } finally {
      setLoading(false);
    }
  }, [businessType, debouncedSearch, page, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [businessType, debouncedSearch, year]);

  return (
    <>
      <OpsTcInOpsGlanceHeaderActions
        search={searchInput}
        onSearchChange={setSearchInput}
      />

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay active label="Loading Vessels in History TC…" /> : null}
        {flash ? <div className={styles.flashSuccess}>{flash.text}</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <h3 className={styles.title}>Vessels in History - TC</h3>

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
              options={years}
              value={year}
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
                <th>CP Date</th>
                <th>Port Del / Port Re-Del</th>
                <th>Checklist</th>
                <th>TC days</th>
                <th>TC Financials</th>
                <th>Agency Letters</th>
                <th>Payment / Invoices</th>
                <th>Compare</th>
                <th>Chartering PIC</th>
                <th>Re-Del Date</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={14} className={styles.emptyCell}>
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
                  <td>{row.cpDate || '—'}</td>
                  <td className={styles.wrapCell}>{row.ports || '—'}</td>
                  <td>
                    <Link
                      to={appPath(`/internal-user/vc/ops-tc/checklist?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                      style={{ color: '#b42318' }}
                    >
                      Check List
                    </Link>
                  </td>
                  <td>{row.hireDays || '—'}</td>
                  <td className={styles.actionsCell}>
                    {(row.costSheets || []).map((sheet) => (
                      <div key={sheet.id}>
                        <Link
                          to={appPath(`/internal-user/vc/ops-tc/cost-sheet?comid=${encodeURIComponent(row.comId)}&cost_sheet_id=${encodeURIComponent(sheet.id)}&page=${PAGE_CONTEXT}`)}
                        >
                          {sheet.name}
                        </Link>
                      </div>
                    ))}
                    {!row.costSheets?.length ? <span className={styles.muted}>—</span> : null}
                  </td>
                  <td>
                    <Link
                      to={appPath(`/internal-user/vc/ops-tc/agency-letter?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                    >
                      Generate Agency Letter
                    </Link>
                  </td>
                  <td>
                    <Link
                      to={appPath(`/internal-user/vc/ops-tc/payment-grid?comid=${encodeURIComponent(row.comId)}&page=${PAGE_CONTEXT}`)}
                    >
                      View
                    </Link>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      label="Compare"
                      title="Compare Sheets"
                      onClick={() => setCompareModal({ open: true, comId: row.comId })}
                    />
                  </td>
                  <td>{row.charteringTeam || '—'}</td>
                  <td>{row.reDelDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SopfPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

        <OpsTcCompareSheetsModal
          open={compareModal.open}
          comId={compareModal.comId}
          onClose={() => setCompareModal({ open: false, comId: '' })}
        />
      </div>
    </>
  );
}

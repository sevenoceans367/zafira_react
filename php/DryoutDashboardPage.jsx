import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { appPath } from '@bainbridge/shared-routing';
import { LoadingOverlay, DmyDateInput, defaultDashboardFromDate, defaultDashboardToDate, Button } from '@bainbridge/shared-ui';
import {
  fetchCoaList,
  fetchCoaShipments,
  fetchPeriodsList,
  fetchTcDashboard,
  fetchVcDashboard,
} from '../../services/dryoutService';
import DryoutPagination from '../_shared/DryoutPagination';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDryoutSession } from './DryoutSessionContext';
import DryoutHeaderSearch from './DryoutHeaderSearch';
import styles from './DryoutDashboard.module.css';

const TABS = [
  { id: 'vc', label: 'VC Business' },
  { id: 'tc', label: 'TC Business' },
  { id: 'coa', label: 'COAs' },
  { id: 'periods', label: 'Periods' },
];

const COMMERCIAL_SUMMARY_CARDS = [
  {
    key: 'vc',
    title: 'VC Business',
    value: 'Voyage',
    className: styles.summaryCardGradient,
  },
  {
    key: 'tc',
    title: 'TC Business',
    value: 'Time',
    className: styles.summaryCardPlain,
  },
  {
    key: 'coa',
    title: 'COAs',
    value: 'Contracts',
    className: styles.summaryCardGradient,
  },
  {
    key: 'periods',
    title: 'Periods',
    value: 'Planning',
    className: styles.summaryCardPlain,
  },
];

const COA_COLUMNS = [
  'COA Route',
  'COA ID',
  'COA No.',
  'COA Date',
  'Vessel Type',
  'Charterer',
  'Cargo',
  'Min Qty(MT)',
  'Duration',
  'Total Shipments',
  'Shipments Performed',
  'Balance Cargo(MT)',
  'Details',
];

const PERIOD_COLUMNS = [
  'Contract ID',
  'Contract No.',
  'Contract Date',
  'Vessel Name',
  'Own Business Account',
  'Working Currency',
  'Total Days/ Performed Days /Balance Days',
  'Total Shipment(VC)',
  'Total Shipment(TC)',
];

const filterRowsBySearch = (rows, searchTerm, fields) => {
  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term || !rows?.length) return rows || [];
  return rows.filter((row) =>
    fields.some((field) => String(row[field] ?? '').toLowerCase().includes(term)),
  );
};

const paginateClientRows = (rows, page, pageSize) => {
  const list = rows || [];
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return list.slice(start, start + pageSize);
};

const TAB_LOADING_LABELS = {
  vc: 'Loading VC dashboard...',
  tc: 'Loading TC dashboard...',
  coa: 'Loading COA list...',
  periods: 'Loading periods list...',
};

const BusinessFilters = ({
  businessTypes,
  businessTypeId,
  onBusinessTypeChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onLoad,
  showDates = true,
}) => (
  <div className={styles.filters}>
    <div>
      <label className="form-label">Business Type</label>
      <select
        className="form-select form-select-sm"
        value={businessTypeId}
        onChange={(e) => onBusinessTypeChange(e.target.value)}
      >
        <option value="">---Select Business Type---</option>
        {businessTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
    {showDates && (
      <>
        <div>
          <label className="form-label">From Date</label>
          <DmyDateInput
            size="sm"
            value={fromDate}
            onChange={onFromDateChange}
          />
        </div>
        <div>
          <label className="form-label">To Date</label>
          <DmyDateInput
            size="sm"
            value={toDate}
            onChange={onToDateChange}
          />
        </div>
      </>
    )}
    <div>
      <label className="form-label">&nbsp;</label>
      <Button variant="outline" label="Load" size="sm" className="d-block" onClick={onLoad} />
    </div>
  </div>
);

const SimpleChart = ({ rows }) => {
  if (!rows?.length) {
    return <p className="text-muted text-center">No chart data.</p>;
  }
  const max = Math.max(...rows.flatMap((r) => [r.fixture, r.Interim, r.completion, 1]));
  const scale = (v) => `${Math.max(4, (Number(v) / max) * 150)}px`;

  return (
    <div>
      <div className={styles.legend}>
        <span className={styles.legendFixture}>Fixture</span>
        <span className={styles.legendInterim}>Interim</span>
        <span className={styles.legendCompletion}>Completion</span>
      </div>
      <div className={styles.chartWrap}>
        {rows.map((row, idx) => (
          <div key={`${row.vessel}-${idx}`} className={styles.chartBarGroup}>
            <div className={styles.chartBars}>
              <div className={styles.barFixture} style={{ height: scale(row.fixture) }} title={`Fixture: ${row.fixture}`} />
              <div className={styles.barInterim} style={{ height: scale(row.Interim) }} title={`Interim: ${row.Interim}`} />
              <div className={styles.barCompletion} style={{ height: scale(row.completion) }} title={`Completion: ${row.completion}`} />
            </div>
            <div className={styles.chartLabel}>{row.vessel || row.TCno || '—'}</div>
          </div>
        ))}
      </div>
      <p className="text-center text-muted" style={{ fontSize: 11 }}>
        USD &apos;000
      </p>
    </div>
  );
};

const DryoutDashboardPage = () => {
  const { session, error: sessionError } = useDryoutSession();
  const [activeTab, setActiveTab] = useState('vc');
  const [error, setError] = useState('');

  const defaultDateRange = {
    fromDate: defaultDashboardFromDate(),
    toDate: defaultDashboardToDate(),
  };

  const [vcFilter, setVcFilter] = useState({ businessTypeId: '3', ...defaultDateRange });
  const [tcFilter, setTcFilter] = useState({ businessTypeId: '3', ...defaultDateRange });
  const [coaFilter, setCoaFilter] = useState({ businessTypeId: '3', ...defaultDateRange });
  const [periodFilter, setPeriodFilter] = useState({ businessTypeId: '3' });

  const [vcData, setVcData] = useState(null);
  const [tcData, setTcData] = useState(null);
  const [coaRows, setCoaRows] = useState([]);
  const [coaTotal, setCoaTotal] = useState(0);
  const [coaPage, setCoaPage] = useState(1);
  const [periodRows, setPeriodRows] = useState([]);
  const [periodTotal, setPeriodTotal] = useState(0);
  const [periodPage, setPeriodPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);
  const [vcSearch, setVcSearch] = useState('');
  const [tcSearch, setTcSearch] = useState('');
  const [coaSearch, setCoaSearch] = useState('');
  const [periodSearch, setPeriodSearch] = useState('');
  const [vcPage, setVcPage] = useState(1);
  const [vcVesselPage, setVcVesselPage] = useState(1);
  const [vcFreightPage, setVcFreightPage] = useState(1);
  const [tcPage, setTcPage] = useState(1);
  const [tcHirePage, setTcHirePage] = useState(1);
  const [tcOtherPage, setTcOtherPage] = useState(1);
  const [vcPageSize, setVcPageSize] = useState(10);
  const [tcPageSize, setTcPageSize] = useState(10);
  const debouncedVcSearch = useDebouncedValue(vcSearch.trim());
  const debouncedTcSearch = useDebouncedValue(tcSearch.trim());
  const debouncedCoaSearch = useDebouncedValue(coaSearch.trim());
  const debouncedPeriodSearch = useDebouncedValue(periodSearch.trim());
  const [loading, setLoading] = useState({ vc: false, tc: false, coa: false, periods: false });
  const [tabLoaded, setTabLoaded] = useState({});

  const [modal, setModal] = useState(null);

  const isMgmtUser = session?.isMgmtUser ?? false;

  const loadSession = useCallback(async () => {
    if (!session) return null;
    const defaultId = String(session.defaultBusinessTypeId || 3);
    setVcFilter((f) => ({ ...f, businessTypeId: f.businessTypeId || defaultId }));
    setTcFilter((f) => ({ ...f, businessTypeId: f.businessTypeId || defaultId }));
    setCoaFilter((f) => ({ ...f, businessTypeId: f.businessTypeId || defaultId }));
    setPeriodFilter((f) => ({ ...f, businessTypeId: f.businessTypeId || defaultId }));
    return session;
  }, [session]);

  const loadVc = useCallback(async () => {
    setLoading((l) => ({ ...l, vc: true }));
    try {
      setVcPage(1);
      setVcVesselPage(1);
      setVcFreightPage(1);
      setVcData(await fetchVcDashboard(vcFilter));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading((l) => ({ ...l, vc: false }));
    }
  }, [vcFilter]);

  const loadTc = useCallback(async () => {
    setLoading((l) => ({ ...l, tc: true }));
    try {
      setTcData(await fetchTcDashboard(tcFilter));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading((l) => ({ ...l, tc: false }));
    }
  }, [tcFilter]);

  const loadCoa = useCallback(async (page = 1, searchTerm = debouncedCoaSearch) => {
    setLoading((l) => ({ ...l, coa: true }));
    try {
      const data = await fetchCoaList({
        start: (page - 1) * listPageSize,
        length: listPageSize,
        draw: 1,
        businesstype: coaFilter.businessTypeId,
        txtFromDate: coaFilter.fromDate,
        txtToDate: coaFilter.toDate,
        search: { value: searchTerm },
      });
      setCoaRows(data.records || []);
      setCoaTotal(data.recordsFiltered ?? data.recordsTotal ?? 0);
      setCoaPage(page);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading((l) => ({ ...l, coa: false }));
    }
  }, [coaFilter, listPageSize, debouncedCoaSearch]);

  const loadPeriods = useCallback(async (page = 1, searchTerm = debouncedPeriodSearch) => {
    setLoading((l) => ({ ...l, periods: true }));
    try {
      const data = await fetchPeriodsList({
        start: (page - 1) * listPageSize,
        length: listPageSize,
        draw: 1,
        businesstype: periodFilter.businessTypeId,
        search: { value: searchTerm },
      });
      setPeriodRows(data.records || []);
      setPeriodTotal(data.recordsFiltered ?? data.recordsTotal ?? 0);
      setPeriodPage(page);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading((l) => ({ ...l, periods: false }));
    }
  }, [periodFilter, listPageSize, debouncedPeriodSearch]);

  const loadTab = useCallback(
    (tabId) => {
      switch (tabId) {
        case 'vc':
          return loadVc();
        case 'tc':
          return loadTc();
        case 'coa':
          return loadCoa(1);
        case 'periods':
          return loadPeriods(1);
        default:
          return Promise.resolve();
      }
    },
    [loadVc, loadTc, loadCoa, loadPeriods],
  );

  const refreshActiveTab = useCallback(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  useEffect(() => {
    if (!session) return;
    loadSession().catch((err) => setError(err.message));
  }, [session, loadSession]);

  useEffect(() => {
    if (!session || tabLoaded[activeTab]) return;
    loadTab(activeTab);
    setTabLoaded((prev) => ({ ...prev, [activeTab]: true }));
  }, [session, activeTab, tabLoaded, loadTab]);

  useEffect(() => {
    if (!session) return;
    const timer = setInterval(refreshActiveTab, 60000);
    return () => clearInterval(timer);
  }, [session, refreshActiveTab]);

  useEffect(() => {
    if (tabLoaded.coa) loadCoa(1);
  }, [debouncedCoaSearch, listPageSize]);

  useEffect(() => {
    if (tabLoaded.periods) loadPeriods(1);
  }, [debouncedPeriodSearch, listPageSize]);

  useEffect(() => {
    setVcPage(1);
    setVcVesselPage(1);
    setVcFreightPage(1);
  }, [debouncedVcSearch, vcPageSize]);

  useEffect(() => {
    setTcPage(1);
    setTcHirePage(1);
    setTcOtherPage(1);
  }, [debouncedTcSearch, tcPageSize]);

  const filteredVcCompletionRows = useMemo(
    () => filterRowsBySearch(vcData?.completionRows, debouncedVcSearch, [
      'vessel', 'voyageno', 'cpdate', 'voyage', 'delredeldate',
    ]),
    [vcData?.completionRows, debouncedVcSearch],
  );
  const filteredVcFreightRows = useMemo(
    () => filterRowsBySearch(vcData?.freightRows, debouncedVcSearch, [
      'voyage', 'vessel', 'charterer', 'freight', 'freight1',
    ]),
    [vcData?.freightRows, debouncedVcSearch],
  );
  const filteredVcVesselRows = useMemo(
    () => filterRowsBySearch(vcData?.vesselRows, debouncedVcSearch, [
      'vessel', 'voyageno', 'fixture', 'Interim', 'completion',
    ]),
    [vcData?.vesselRows, debouncedVcSearch],
  );
  const vcCompletionPageRows = useMemo(
    () => paginateClientRows(filteredVcCompletionRows, vcPage, vcPageSize),
    [filteredVcCompletionRows, vcPage, vcPageSize],
  );
  const vcVesselPageRows = useMemo(
    () => paginateClientRows(filteredVcVesselRows, vcVesselPage, vcPageSize),
    [filteredVcVesselRows, vcVesselPage, vcPageSize],
  );
  const vcFreightPageRows = useMemo(
    () => paginateClientRows(filteredVcFreightRows, vcFreightPage, vcPageSize),
    [filteredVcFreightRows, vcFreightPage, vcPageSize],
  );
  const vcFreightTotalPages = Math.max(1, Math.ceil(filteredVcFreightRows.length / vcPageSize));
  const vcFreightSafePage = Math.min(Math.max(vcFreightPage, 1), vcFreightTotalPages);
  const vcFreightLastPage = vcFreightSafePage >= vcFreightTotalPages;

  const filteredTcCompletionRows = useMemo(
    () => filterRowsBySearch(tcData?.completionRows, debouncedTcSearch, [
      'TCno', 'vessel', 'cp_date', 'cpdate', 'delredeldate',
    ]),
    [tcData?.completionRows, debouncedTcSearch],
  );
  const filteredTcHireRows = useMemo(
    () => filterRowsBySearch(tcData?.hireRows, debouncedTcSearch, [
      'TCno', 'vessel', 'customer', 'amount',
    ]),
    [tcData?.hireRows, debouncedTcSearch],
  );
  const filteredTcOtherRows = useMemo(
    () => filterRowsBySearch(tcData?.otherInvoiceRows, debouncedTcSearch, [
      'TCno', 'vessel', 'shortdesc', 'amount',
    ]),
    [tcData?.otherInvoiceRows, debouncedTcSearch],
  );
  const filteredTcVesselRows = useMemo(
    () => filterRowsBySearch(tcData?.vesselRows, debouncedTcSearch, [
      'TCno', 'vessel', 'fixture', 'Interim', 'completion',
    ]),
    [tcData?.vesselRows, debouncedTcSearch],
  );
  const tcCompletionPageRows = useMemo(
    () => paginateClientRows(filteredTcCompletionRows, tcPage, tcPageSize),
    [filteredTcCompletionRows, tcPage, tcPageSize],
  );
  const tcHirePageRows = useMemo(
    () => paginateClientRows(filteredTcHireRows, tcHirePage, tcPageSize),
    [filteredTcHireRows, tcHirePage, tcPageSize],
  );
  const tcOtherPageRows = useMemo(
    () => paginateClientRows(filteredTcOtherRows, tcOtherPage, tcPageSize),
    [filteredTcOtherRows, tcOtherPage, tcPageSize],
  );
  const tcHireLastPage = tcHirePage >= Math.max(1, Math.ceil(filteredTcHireRows.length / tcPageSize));
  const tcOtherLastPage = tcOtherPage >= Math.max(1, Math.ceil(filteredTcOtherRows.length / tcPageSize));

  const showLoadingOverlay = loading.vc || loading.tc || loading.coa || loading.periods;
  const loadingOverlayLabel = useMemo(() => {
    const activeKey = Object.keys(TAB_LOADING_LABELS).find((key) => loading[key]);
    return activeKey ? TAB_LOADING_LABELS[activeKey] : 'Loading...';
  }, [loading]);

  const openCoaModal = async (coaId) => {
    try {
      const data = await fetchCoaShipments(coaId);
      setModal({ title: `COA ${coaId} — Performed Shipments`, data });
    } catch (err) {
      setError(err.message);
    }
  };

  const renderVcTab = () => (
    <div className={styles.tabPanel}>
      <BusinessFilters
        businessTypes={session?.businessTypes || []}
        businessTypeId={vcFilter.businessTypeId}
        onBusinessTypeChange={(v) => setVcFilter((f) => ({ ...f, businessTypeId: v }))}
        fromDate={vcFilter.fromDate}
        toDate={vcFilter.toDate}
        onFromDateChange={(v) => setVcFilter((f) => ({ ...f, fromDate: v }))}
        onToDateChange={(v) => setVcFilter((f) => ({ ...f, toDate: v }))}
        onLoad={loadVc}
      />
      <h3 className={styles.sectionTitle}>Dashboard</h3>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Vessels</th>
              <th>Voyage No.</th>
              <th>CP date</th>
              <th>Voyage</th>
              <th>Delivery - Re-Delivery</th>
            </tr>
          </thead>
          <tbody>
            {vcCompletionPageRows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted">
                  {debouncedVcSearch ? 'No records match your search.' : 'No records found.'}
                </td>
              </tr>
            )}
            {vcCompletionPageRows.map((row, i) => (
              <tr key={i}>
                <td>{row.vessel}</td>
                <td>{row.voyageno}</td>
                <td>{row.cpdate}</td>
                <td>{row.voyage}</td>
                <td>{row.delredeldate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DryoutPagination
        page={vcPage}
        pageSize={vcPageSize}
        total={filteredVcCompletionRows.length}
        onPageChange={setVcPage}
        onPageSizeChange={setVcPageSize}
        label="records"
      />
      {isMgmtUser && (
        <div className="row" style={{ marginTop: 16 }}>
          <div className="col-md-6">
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Vessels</th>
                    <th>Fixture</th>
                    <th>Interim</th>
                    <th>Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {vcVesselPageRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted">
                        {debouncedVcSearch ? 'No records match your search.' : 'No records found.'}
                      </td>
                    </tr>
                  )}
                  {vcVesselPageRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        {row.vessel} ({row.voyageno})
                      </td>
                      <td>{row.fixture}</td>
                      <td>{row.Interim}</td>
                      <td>{row.completion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DryoutPagination
              page={vcVesselPage}
              pageSize={vcPageSize}
              total={filteredVcVesselRows.length}
              onPageChange={setVcVesselPage}
              onPageSizeChange={setVcPageSize}
              label="vessel records"
            />
          </div>
          <div className="col-md-6">
            <SimpleChart rows={filterRowsBySearch(vcData?.chartRows, debouncedVcSearch, ['vessel', 'TCno'])} />
          </div>
        </div>
      )}
      <h3 className={styles.sectionTitle}>UNSETTLED FREIGHT</h3>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Voyage No</th>
              <th>Vessels</th>
              <th>Customer</th>
              <th>Initial Freight (USD)</th>
              <th>Final Freight (USD)</th>
            </tr>
          </thead>
          <tbody>
            {vcFreightPageRows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted">
                  {debouncedVcSearch ? 'No records match your search.' : 'No records found.'}
                </td>
              </tr>
            )}
            {vcFreightPageRows.map((row, i) => (
              <tr key={i}>
                <td>{row.voyage}</td>
                <td>{row.vessel}</td>
                <td>{row.charterer}</td>
                <td>{row.freight}</td>
                <td>{row.freight1}</td>
              </tr>
            ))}
            {vcFreightLastPage && filteredVcFreightRows.length > 0 && (
              <tr className={styles.totalRow}>
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{vcData?.freightTotalInitial}</strong>
                </td>
                <td>
                  <strong>{vcData?.freightTotalFinal}</strong>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <DryoutPagination
        page={vcFreightSafePage}
        pageSize={vcPageSize}
        total={filteredVcFreightRows.length}
        onPageChange={setVcFreightPage}
        onPageSizeChange={setVcPageSize}
        label="freight records"
      />
    </div>
  );

  const renderTcTab = () => (
    <div className={styles.tabPanel}>
      <BusinessFilters
        businessTypes={session?.businessTypes || []}
        businessTypeId={tcFilter.businessTypeId}
        onBusinessTypeChange={(v) => setTcFilter((f) => ({ ...f, businessTypeId: v }))}
        fromDate={tcFilter.fromDate}
        toDate={tcFilter.toDate}
        onFromDateChange={(v) => setTcFilter((f) => ({ ...f, fromDate: v }))}
        onToDateChange={(v) => setTcFilter((f) => ({ ...f, toDate: v }))}
        onLoad={loadTc}
      />
      <h3 className={styles.sectionTitle}>Dashboard</h3>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>TC No.</th>
              <th>Vessels</th>
              <th>CP date</th>
              <th>Delivery - Re-Delivery</th>
            </tr>
          </thead>
          <tbody>
            {tcCompletionPageRows.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted">
                  {debouncedTcSearch ? 'No records match your search.' : 'No records found.'}
                </td>
              </tr>
            )}
            {tcCompletionPageRows.map((row, i) => (
              <tr key={i}>
                <td>{row.TCno}</td>
                <td>{row.vessel}</td>
                <td>{row.cp_date || row.cpdate}</td>
                <td>{row.delredeldate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DryoutPagination
        page={tcPage}
        pageSize={tcPageSize}
        total={filteredTcCompletionRows.length}
        onPageChange={setTcPage}
        onPageSizeChange={setTcPageSize}
        label="records"
      />
      {isMgmtUser && (
        <div className="row" style={{ marginTop: 16 }}>
          <div className="col-md-6">
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>TC No.</th>
                    <th>Vessels</th>
                    <th>Fixture</th>
                    <th>Interim</th>
                    <th>Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTcVesselRows.map((row, i) => (
                    <tr key={i}>
                      <td>{row.TCno}</td>
                      <td>{row.vessel}</td>
                      <td>{row.fixture}</td>
                      <td>{row.Interim}</td>
                      <td>{row.completion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="col-md-6">
            <SimpleChart rows={filterRowsBySearch(tcData?.chartRows, debouncedTcSearch, ['vessel', 'TCno'])} />
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 16 }}>
        <div className="col-md-6">
          <h3 className={styles.sectionTitle}>Receivables</h3>
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>TC No.</th>
                  <th>Vessels</th>
                  <th>Customer</th>
                  <th>Amount (USD)</th>
                </tr>
              </thead>
              <tbody>
                {tcHirePageRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      {debouncedTcSearch ? 'No records match your search.' : 'No records found.'}
                    </td>
                  </tr>
                )}
                {tcHirePageRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.TCno}</td>
                    <td>{row.vessel}</td>
                    <td>{row.customer}</td>
                    <td>{row.amount}</td>
                  </tr>
                ))}
                {tcHireLastPage && filteredTcHireRows.length > 0 && (
                  <tr className={styles.totalRow}>
                    <td colSpan={3}>
                      <strong>Total</strong>
                    </td>
                    <td>
                      <strong>{tcData?.hireTotal}</strong>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <DryoutPagination
            page={tcHirePage}
            pageSize={tcPageSize}
            total={filteredTcHireRows.length}
            onPageChange={setTcHirePage}
            onPageSizeChange={setTcPageSize}
            label="receivables"
          />
        </div>
        <div className="col-md-6">
          <h3 className={styles.sectionTitle}>Other Receivables</h3>
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>TC No.</th>
                  <th>Vessels</th>
                  <th>Other Invoice Type</th>
                  <th>Amount (USD)</th>
                </tr>
              </thead>
              <tbody>
                {tcOtherPageRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      {debouncedTcSearch ? 'No records match your search.' : 'No records found.'}
                    </td>
                  </tr>
                )}
                {tcOtherPageRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.TCno}</td>
                    <td>{row.vessel}</td>
                    <td>{row.shortdesc}</td>
                    <td>{row.amount}</td>
                  </tr>
                ))}
                {tcOtherLastPage && filteredTcOtherRows.length > 0 && (
                  <tr className={styles.totalRow}>
                    <td colSpan={3}>
                      <strong>Total</strong>
                    </td>
                    <td>
                      <strong>{tcData?.otherInvoiceTotal}</strong>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <DryoutPagination
            page={tcOtherPage}
            pageSize={tcPageSize}
            total={filteredTcOtherRows.length}
            onPageChange={setTcOtherPage}
            onPageSizeChange={setTcPageSize}
            label="other receivables"
          />
        </div>
      </div>
    </div>
  );

  const renderCoaTab = () => (
    <div className={styles.tabPanel}>
      <BusinessFilters
        businessTypes={session?.businessTypes || []}
        businessTypeId={coaFilter.businessTypeId}
        onBusinessTypeChange={(v) => setCoaFilter((f) => ({ ...f, businessTypeId: v }))}
        fromDate={coaFilter.fromDate}
        toDate={coaFilter.toDate}
        onFromDateChange={(v) => setCoaFilter((f) => ({ ...f, fromDate: v }))}
        onToDateChange={(v) => setCoaFilter((f) => ({ ...f, toDate: v }))}
        onLoad={() => loadCoa(1)}
      />
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>#</th>
              {COA_COLUMNS.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coaRows.length === 0 && (
              <tr>
                <td colSpan={COA_COLUMNS.length + 1} className="text-center text-muted">
                  {debouncedCoaSearch
                    ? 'No COAs match your search.'
                    : 'SORRY CURRENTLY THERE ARE ZERO(0) RECORDS'}
                </td>
              </tr>
            )}
            {coaRows.map((row, i) => (
              <tr key={i}>
                <td>{row.col1}</td>
                <td>{row.col2}</td>
                <td>{row.col3}</td>
                <td>{row.col4}</td>
                <td>{row.col5}</td>
                <td>{row.col6}</td>
                <td>{row.col7}</td>
                <td>{row.col8}</td>
                <td>{row.col9}</td>
                <td>{row.col10}</td>
                <td>{row.col11}</td>
                <td>{row.col12}</td>
                <td>{row.col13}</td>
                <td>
                  {row.coaId ? (
                    <Button
                      label="Details"
                      variant="info"
                      size="sm"
                      onClick={() => openCoaModal(row.coaId)}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DryoutPagination
        page={coaPage}
        pageSize={listPageSize}
        total={coaTotal}
        onPageChange={loadCoa}
        onPageSizeChange={setListPageSize}
        label="COAs"
      />
    </div>
  );

  const renderPeriodsTab = () => (
    <div className={styles.tabPanel}>
      <BusinessFilters
        businessTypes={session?.businessTypes || []}
        businessTypeId={periodFilter.businessTypeId}
        onBusinessTypeChange={(v) => setPeriodFilter((f) => ({ ...f, businessTypeId: v }))}
        showDates={false}
        onLoad={() => loadPeriods(1)}
      />
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>#</th>
              {PERIOD_COLUMNS.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodRows.length === 0 && (
              <tr>
                <td colSpan={PERIOD_COLUMNS.length + 1} className="text-center text-muted">
                  {debouncedPeriodSearch
                    ? 'No periods match your search.'
                    : 'SORRY CURRENTLY THERE ARE ZERO(0) RECORDS'}
                </td>
              </tr>
            )}
            {periodRows.map((row, i) => (
              <tr key={i}>
                <td>{row.col1}</td>
                <td>{row.col2}</td>
                <td>{row.col3}</td>
                <td>{row.col4}</td>
                <td>{row.col5}</td>
                <td>{row.col6}</td>
                <td>{row.col7}</td>
                <td>{row.col12}</td>
                <td>{row.col9}</td>
                <td>{row.col10}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DryoutPagination
        page={periodPage}
        pageSize={listPageSize}
        total={periodTotal}
        onPageChange={loadPeriods}
        onPageSizeChange={setListPageSize}
        label="periods"
      />
    </div>
  );

  const dashboardHeaderSearch = useMemo(() => {
    switch (activeTab) {
      case 'vc':
        return {
          value: vcSearch,
          onChange: setVcSearch,
          placeholder: 'Search vessel, voyage, customer...',
        };
      case 'tc':
        return {
          value: tcSearch,
          onChange: setTcSearch,
          placeholder: 'Search TC no., vessel, customer...',
        };
      case 'coa':
        return {
          value: coaSearch,
          onChange: setCoaSearch,
          placeholder: 'Search route, COA ID, charterer, cargo...',
        };
      case 'periods':
        return {
          value: periodSearch,
          onChange: setPeriodSearch,
          placeholder: 'Search contract ID, vessel, account...',
        };
      default:
        return null;
    }
  }, [activeTab, vcSearch, tcSearch, coaSearch, periodSearch]);

  return (
    <>
      <LoadingOverlay show={showLoadingOverlay} label={loadingOverlayLabel} />
      {dashboardHeaderSearch && (
        <DryoutHeaderSearch
          value={dashboardHeaderSearch.value}
          onChange={dashboardHeaderSearch.onChange}
          placeholder={dashboardHeaderSearch.placeholder}
        />
      )}
      {(error || sessionError) && (
        <div className="alert alert-danger" style={{ margin: '12px 20px 0' }}>
          {error || sessionError}
        </div>
      )}
      <div className={styles.summaryGrid}>
        {COMMERCIAL_SUMMARY_CARDS.map((card) => (
          <div key={card.key} className={`${styles.summaryCard} ${card.className}`}>
            <p className={styles.summaryLabel}>{card.title}</p>
            <h3 className={styles.summaryValue}>{card.value}</h3>
          </div>
        ))}
      </div>
      <div className={styles.tabsCard}>
        <ul className={styles.tabNav}>
          {TABS.map((tab) => (
            <li key={tab.id}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
        {activeTab === 'vc' && renderVcTab()}
        {activeTab === 'tc' && renderTcTab()}
        {activeTab === 'coa' && renderCoaTab()}
        {activeTab === 'periods' && renderPeriodsTab()}
      </div>

      {modal && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setModal(null)}>
          <div
            className={styles.modalDialog}
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <strong>
                <i className="bi bi-file-text" /> {modal.title}
              </strong>
              <button type="button" className="btn-close" onClick={() => setModal(null)} />
            </div>
            <div className={styles.modalBody}>
              {modal.data?.currency && (
                <p className="text-muted" style={{ marginBottom: 12 }}>
                  Currency: {modal.data.currency}
                </p>
              )}
              <h5 style={{ color: '#3c8dbc' }}>Voyage</h5>
              {(modal.data?.voyages?.length ?? 0) === 0 ? (
                <p className="text-muted">No performed voyage records.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Nom Date</th>
                        <th>COA ID / Voy No</th>
                        <th>Voy Starts</th>
                        <th>Voy Ends</th>
                        <th>LP/DP</th>
                        <th>Cargo (CBM)</th>
                        <th>Cargo (MT)</th>
                        <th>Freight</th>
                        <th>Voy Earnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modal.data.voyages.map((row, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{row.nomDate}</td>
                          <td style={{ whiteSpace: 'pre-line' }}>{row.coaIdVoyNo}</td>
                          <td>{row.voyStarts}</td>
                          <td>{row.voyEnds}</td>
                          <td>{row.lpDp}</td>
                          <td style={{ whiteSpace: 'pre-line' }}>{row.cargoCbm}</td>
                          <td style={{ whiteSpace: 'pre-line' }}>{row.cargoMt}</td>
                          <td style={{ whiteSpace: 'pre-line' }}>{row.freight}</td>
                          <td>{row.voyageEarnings}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <h5 style={{ color: '#3c8dbc', marginTop: 16 }}>Cargo Relets</h5>
              {(modal.data?.cargoRelets?.length ?? 0) === 0 ? (
                <p className="text-muted">No cargo relet records.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>COA ID / No.</th>
                        <th>Relet No.</th>
                        <th>COA Date</th>
                        <th>Cargo Qty (MT)</th>
                        <th>LP/DP</th>
                        <th>Frt-IN</th>
                        <th>Frt-OUT</th>
                        <th>Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modal.data.cargoRelets.map((row, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>{row.coaIdNo}</td>
                          <td>{row.reletNo}</td>
                          <td>{row.coaDate}</td>
                          <td>{row.cargoQty}</td>
                          <td>{row.lpDp}</td>
                          <td>
                            {row.freightInRate} / {row.freightInAmt}
                          </td>
                          <td>
                            {row.freightOutRate} / {row.freightOutAmt}
                          </td>
                          <td>{row.profit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DryoutDashboardPage;

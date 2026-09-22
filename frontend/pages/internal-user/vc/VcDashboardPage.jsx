import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import SopfPagination from '../sopf/SopfPagination.jsx';
import ScrollableTable from '../sopf/ScrollableTable.jsx';
import {
  fetchCoaList,
  fetchCoaShipments,
  fetchPeriodList,
  fetchTcBusinessDashboard,
  fetchVcBusinessTypes,
  fetchVcDashboardMeta,
} from '../../../services/vcDashboard.js';
import VcDashboardHeaderActions from './VcDashboardHeaderActions.jsx';
import {
  ALL_KPI,
  ATTENTION_ITEMS,
  AVG_HIRE_BY_TYPE,
  CARGO_BREAKDOWN,
  CARGO_CATEGORY_COLORS,
  CARGO_OFFICE,
  CHARTERERS,
  CHARTERERS_TC,
  CHARTERER_SHADES,
  DESK_OFFICE_TC,
  DESK_OFFICE_VC,
  FLEET_MIX,
  MARK_TO_MARKET,
  OFFICE_SHADES,
  OWNER_SHADES,
  OWNERS_OPERATOR,
  OWNERS_OWNER,
  OWNERS_TC_OPERATOR,
  OWNERS_TC_OWNER,
  PERIOD_CARDS,
  PERIOD_RECORDS,
  PERFORMING_TC,
  PERFORMING_VC,
  PIPELINE,
  COA_PACE,
  QUARTER_TRADES,
  RECEIVABLE_VS_INVOICED,
  REVENUE_QUARTERLY,
  TC_SPARK,
  TC_VESSEL_SHADES,
  VC_SPARK,
  VC_VESSEL_SHADES,
  VESSEL_TYPE_TC,
  VESSEL_TYPE_VC,
  ZONES_TC,
  ZONES_VC,
} from './dashboardDemoData.js';
import {
  ActivityBadge,
  AllKpiTile,
  AttentionList,
  ChartCard,
  ContractMixPanel,
  FleetMixBar,
  HireDuePanel,
  HorizontalBars,
  MarkToMarketCard,
  OffHirePanel,
  PaceCard,
  PeriodPaceCard,
  PieLegend,
  PipelineList,
  QuarterlyAreaChart,
  RevenueByContractCard,
  SopFCta,
  SparklineSummaryCard,
  VerticalBars,
} from './DashboardDemoCharts.jsx';
import styles from './VcDashboardPage.module.css';

const TABS = [
  { id: 'vc', label: 'Spot', toneClass: 'tabVc' },
  { id: 'tc', label: 'TC', toneClass: 'tabTc' },
  { id: 'coas', label: 'COAs', toneClass: 'tabCoas' },
  { id: 'periods', label: 'Periods', toneClass: 'tabPeriods' },
  { id: 'all', label: 'All Contracts', toneClass: 'tabNavy' },
];

function SectionHead({ title, showUsd = false }) {
  return (
    <div className={styles.secHead}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {showUsd ? <span className={styles.usdTag}>Values in USD (mil)</span> : null}
    </div>
  );
}

const SPOT_DEMO_PERFORMING = PERFORMING_VC.map((row, index) => ({
  ...row,
  id: `demo-vc-${index}`,
}));

const TC_DEMO_PERFORMING = PERFORMING_TC.map((row, index) => ({
  ...row,
  id: `demo-tc-${index}`,
}));

const ALL_DEMO_PERFORMING = [
  ...SPOT_DEMO_PERFORMING,
  ...TC_DEMO_PERFORMING.map((row, index) => ({
    ...row,
    id: `demo-all-tc-${index}`,
    voy: row.tcNo || row.voy,
  })),
];

const PAGE_SIZE = 10;

function DataTable({
  columns,
  rows,
  emptyMessage = 'No records found.',
  footer = null,
  pageSize = null,
  onPageSizeChange = null,
}) {
  const table = (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} className={column.className}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className={styles.emptyCell}>{emptyMessage}</td>
          </tr>
        ) : rows.map((row) => (
          <tr key={row.id}>
            {columns.map((column) => (
              <td key={column.key} className={column.className}>
                {column.render ? column.render(row) : row[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (footer) {
    return (
      <ScrollableTable
        footer={footer}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
      >
        {table}
      </ScrollableTable>
    );
  }

  return (
    <div className={styles.tableWrap}>
      {table}
    </div>
  );
}

function PerformingVesselsCard({ title = 'Performing Vessels', rows, columns, loading }) {
  return (
    <ChartCard title={title}>
      <DataTable
        columns={columns}
        rows={rows}
        emptyMessage={loading ? 'Loading…' : 'No vessels in ops.'}
      />
      <p className={styles.drillHint}>
        Activity Status is sourced from Daily Positions Report triggers.
      </p>
    </ChartCard>
  );
}

function activityCell(row) {
  if (!row.statusLabel || row.statusLabel === '—') return '—';
  return <ActivityBadge status={row.status} label={row.statusLabel} />;
}

function vesselCell(row) {
  const label = row.vessel || '—';
  if (!row.checklistHref) return label;
  return <Link to={appPath(row.checklistHref)}>{label}</Link>;
}

const PERFORMING_ALL_COLUMNS = [
  { key: 'vessel', label: 'Vessels', render: vesselCell },
  { key: 'voy', label: 'Voy No.' },
  { key: 'cpDate', label: 'CP Date' },
  { key: 'status', label: 'Activity Status', render: activityCell },
  { key: 'route', label: 'Delivery – Re-delivery' },
];

const PERFORMING_VC_COLUMNS = PERFORMING_ALL_COLUMNS;

const PERFORMING_TC_COLUMNS = [
  { key: 'tcNo', label: 'TC No.' },
  { key: 'vessel', label: 'Vessels', render: vesselCell },
  { key: 'cpDate', label: 'CP Date' },
  { key: 'status', label: 'Activity Status', render: activityCell },
  { key: 'route', label: 'Delivery – Re-delivery' },
];

function CoaShipmentsModal({ open, title, rows, loading, onClose }) {
  if (!open) return null;

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coa-shipments-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h4 id="coa-shipments-title">
            <i className="bi bi-file-text" aria-hidden /> {title}
          </h4>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          {loading ? <LoadingOverlay active label="Loading shipments…" /> : null}
          <DataTable
            columns={[
              { key: 'index', label: '#' },
              { key: 'vesselName', label: 'Vessel Name/Type', render: (row) => `${row.vesselName} / ${row.vesselType}` },
              { key: 'coaIdentity', label: 'COA ID/NO', render: (row) => `${row.coaIdentity} / ${row.voyageNo}` },
              { key: 'cpDate', label: 'CP Date' },
              { key: 'ports', label: 'LP/DP' },
              { key: 'duration', label: 'Duration' },
              { key: 'cargoQty', label: 'Cargo Qty' },
              { key: 'tce', label: 'TCE' },
              { key: 'profitLoss', label: 'P/L' },
            ]}
            rows={rows.map((row) => ({ ...row, id: row.index }))}
            emptyMessage="SORRY CURRENTLY THERE ARE ZERO(0) RECORDS"
          />
        </div>
      </div>
    </div>
  );
}

export default function VcDashboardPage() {
  const [activeTab, setActiveTab] = useState('vc');
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState('2');
  const [icpMode, setIcpMode] = useState('mixed');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(50000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tcData, setTcData] = useState(null);
  const [coaRows, setCoaRows] = useState([]);
  const [coaTotal, setCoaTotal] = useState(0);
  const [coaPage, setCoaPage] = useState(1);
  const [coaPageSize, setCoaPageSize] = useState(PAGE_SIZE);
  const [periodRows, setPeriodRows] = useState([]);
  const [periodTotal, setPeriodTotal] = useState(0);
  const [periodPage, setPeriodPage] = useState(1);
  const [periodPageSize, setPeriodPageSize] = useState(PAGE_SIZE);

  const [coaModalOpen, setCoaModalOpen] = useState(false);
  const [coaModalTitle, setCoaModalTitle] = useState('');
  const [coaModalRows, setCoaModalRows] = useState([]);
  const [coaModalLoading, setCoaModalLoading] = useState(false);

  const loadBusinessTypes = useCallback(async (selectedId) => {
    const types = await fetchVcBusinessTypes(selectedId);
    setBusinessTypes(types);
  }, []);

  const loadTc = useCallback(async () => {
    const data = await fetchTcBusinessDashboard({
      selBType: businessType,
      fromDate: periodFrom,
      toDate: periodTo,
    });
    setTcData(data);
  }, [businessType, periodFrom, periodTo]);

  const loadCoas = useCallback(async () => {
    const listData = await fetchCoaList({
      selBType: businessType,
      fromDate: periodFrom,
      toDate: periodTo,
      page: coaPage,
      pageSize: coaPageSize,
    });
    setCoaRows(listData.records ?? []);
    setCoaTotal(listData.recordsTotal ?? 0);
  }, [businessType, periodFrom, periodTo, coaPage, coaPageSize]);

  const loadPeriods = useCallback(async () => {
    const data = await fetchPeriodList({
      selBType: businessType,
      page: periodPage,
      pageSize: periodPageSize,
    });
    setPeriodRows(data.records ?? []);
    setPeriodTotal(data.recordsTotal ?? 0);
  }, [businessType, periodPage, periodPageSize]);

  const loadActiveTab = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      switch (activeTab) {
        case 'vc':
          break;
        case 'tc':
          await loadTc();
          break;
        case 'coas':
          await loadCoas();
          break;
        case 'periods':
          await loadPeriods();
          break;
        case 'all':
          await Promise.all([loadTc(), loadCoas(), loadPeriods()]);
          break;
        default:
          break;
      }
    } catch (err) {
      setError(err.message || 'Failed to load commercial performance.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadTc, loadCoas, loadPeriods]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadTc(), loadCoas(), loadPeriods()]);
    } catch (err) {
      setError(err.message || 'Failed to load commercial performance.');
    } finally {
      setLoading(false);
    }
  }, [loadTc, loadCoas, loadPeriods]);

  useEffect(() => {
    (async () => {
      try {
        const meta = await fetchVcDashboardMeta();
        setRefreshIntervalMs(meta.refreshIntervalMs ?? 50000);
        const defaultType = meta.defaultBusinessType || '2';
        setBusinessType(defaultType);
        await loadBusinessTypes(defaultType);
      } catch (err) {
        setError(err.message || 'Failed to initialize commercial performance.');
      }
    })();
  }, [loadBusinessTypes]);

  useEffect(() => {
    loadActiveTab();
  }, [loadActiveTab]);

  useEffect(() => {
    setCoaPage(1);
  }, [coaPageSize]);

  useEffect(() => {
    setPeriodPage(1);
  }, [periodPageSize]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadAll();
    }, refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [loadAll, refreshIntervalMs]);

  const handleBusinessTypeChange = useCallback(async (value) => {
    setBusinessType(value);
    await loadBusinessTypes(value);
  }, [loadBusinessTypes]);

  const handlePeriodChange = useCallback(({ from, to }) => {
    setPeriodFrom(from || '');
    setPeriodTo(to || '');
  }, []);

  const openCoaDetails = async (coaId, coaIdentity) => {
    setCoaModalOpen(true);
    setCoaModalTitle(`${coaIdentity} - Performed Shipments`);
    setCoaModalLoading(true);
    setCoaModalRows([]);
    try {
      const data = await fetchCoaShipments(coaId);
      setCoaModalTitle(data.coaLabel || `${coaIdentity} - Performed Shipments`);
      setCoaModalRows(data.rows ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load COA shipments.');
      setCoaModalOpen(false);
    } finally {
      setCoaModalLoading(false);
    }
  };

  const hireColumns = [
    { key: 'tcNo', label: 'TC No.' },
    { key: 'vessel', label: 'Vessels' },
    { key: 'customer', label: 'Customer' },
    { key: 'amount', label: 'Amount (USD)' },
  ];

  const otherColumns = [
    { key: 'tcNo', label: 'TC No.' },
    { key: 'vessel', label: 'Vessels' },
    { key: 'otherInvoiceType', label: 'Other Invoice Type' },
    { key: 'amount', label: 'Amount (USD)' },
  ];

  const coaColumns = [
    { key: 'index', label: '#' },
    { key: 'coaRoute', label: 'Route' },
    { key: 'coaNo', label: 'COA No.' },
    { key: 'coaDate', label: 'COA Date' },
    { key: 'charterer', label: 'Charterer' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'minQty', label: 'Min Qty (MT)' },
    { key: 'duration', label: 'Duration' },
    { key: 'totalShipments', label: 'Total Shipments' },
    { key: 'shipmentsPerformed', label: 'Shipments Performed' },
    { key: 'balanceCargo', label: 'Balance Cargo (MT)' },
    {
      key: 'details',
      label: 'Details',
      render: (row) => (
        <button
          type="button"
          className={styles.pillDetails}
          onClick={() => openCoaDetails(row.coaId, row.coaIdentity)}
        >
          Details
        </button>
      ),
    },
  ];

  const periodColumns = [
    { key: 'index', label: '#' },
    { key: 'contractNo', label: 'Contract No.' },
    { key: 'contractDate', label: 'Contract Date' },
    { key: 'vesselName', label: 'Vessel' },
    { key: 'ownBusinessAccount', label: 'Own Business Account' },
    { key: 'workingCurrency', label: 'Working Currency' },
    {
      key: 'days',
      label: 'Total / Performed / Balance Days',
      render: (row) => `${row.totalDays} / ${row.performedDays} / ${row.balanceDays}`,
    },
    { key: 'vcShipments', label: 'Total Shipment (Spot)' },
    { key: 'tcShipments', label: 'Total Shipment (TC)' },
  ];

  const isOwnerIcp = icpMode === 'owner';
  const spotOwnersTitle = icpMode === 'operator'
    ? 'Business with Top Owners'
    : 'Business with Top Third-Party Owners (Chartered-In)';
  const spotOwnersData = icpMode === 'operator' ? OWNERS_OPERATOR : OWNERS_OWNER;
  const tcOwnersData = icpMode === 'operator' ? OWNERS_TC_OPERATOR : OWNERS_TC_OWNER;
  const showFleetMix = icpMode === 'mixed';

  return (
    <>
      <VcDashboardHeaderActions
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={handleBusinessTypeChange}
        icpMode={icpMode}
        onIcpModeChange={setIcpMode}
        periodFrom={periodFrom}
        periodTo={periodTo}
        onPeriodChange={handlePeriodChange}
        showPeriod={activeTab === 'vc' || activeTab === 'tc' || activeTab === 'coas' || activeTab === 'all'}
      />

      <div className={`zafira-page ${styles.page}`}>
      {loading ? <LoadingOverlay active label="Loading commercial performance…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.tabs} role="tablist">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${isActive ? styles.tabActive : styles.tab} ${styles[tab.toneClass]}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={styles.tabDot} aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className={styles.tabPanel}>
        {activeTab === 'vc' ? (
          <>
            <section className={styles.secBlock}>
              <SectionHead title="Spot Business Overview" showUsd />
              <div className={styles.sparkRow}>
                {VC_SPARK.map((card) => (
                  <SparklineSummaryCard key={card.label} {...card} />
                ))}
              </div>
              <div className={styles.shellGrid}>
                <ChartCard title="Trades by Chartering Desk" sub="By office · YTD">
                  <VerticalBars data={DESK_OFFICE_VC} colors={OFFICE_SHADES} />
                </ChartCard>
                <ChartCard title="Trades by Vessel Type" sub="YTD">
                  <VerticalBars data={VESSEL_TYPE_VC} colors={VC_VESSEL_SHADES} />
                </ChartCard>
                <ChartCard title="Cargo Handled" sub="YTD · Metric Tons">
                  <PieLegend data={CARGO_OFFICE} colors={OFFICE_SHADES} valueFmt={(v) => `${v.toLocaleString()} MT`} />
                </ChartCard>
                <ChartCard title="Cargo Traded Breakdown" sub="By category · YTD · Metric Tons">
                  <PieLegend data={CARGO_BREAKDOWN} colors={CARGO_CATEGORY_COLORS} valueFmt={(v) => `${v.toLocaleString()} MT`} />
                </ChartCard>
              </div>
              <div className={styles.shellStack}>
                <ChartCard title="Trades per Quarter" sub="Calendar year, Q1–Q4">
                  <VerticalBars data={QUARTER_TRADES} colors={['#274670', '#3E5F8F', '#8FA1C2', '#C5CEDB']} />
                </ChartCard>
              </div>
              <div className={`${styles.shellGrid}${isOwnerIcp ? ` ${styles.shellGridSingle}` : ''}`}>
                {isOwnerIcp ? null : (
                  <ChartCard title={spotOwnersTitle} sub="YTD · USD (millions)">
                    <HorizontalBars data={spotOwnersData} colors={OWNER_SHADES} valueFmt={(v) => `${v.toFixed(1)} mil`} />
                    {showFleetMix ? (
                      <FleetMixBar owned={FLEET_MIX.owned} charteredIn={FLEET_MIX.charteredIn} />
                    ) : null}
                  </ChartCard>
                )}
                <ChartCard title="Business with Top Cargo Owners" sub="Billed-to party · YTD · USD (millions)">
                  <HorizontalBars data={CHARTERERS} colors={CHARTERER_SHADES} valueFmt={(v) => `${v.toFixed(1)} mil`} />
                </ChartCard>
              </div>
              <ChartCard title="Vessel Redelivery Zones" sub="YTD · open positions">
                <HorizontalBars data={ZONES_VC} />
                <SopFCta />
              </ChartCard>
              <PerformingVesselsCard
                rows={SPOT_DEMO_PERFORMING}
                columns={PERFORMING_VC_COLUMNS}
                loading={false}
              />
            </section>
          </>
        ) : null}

        {activeTab === 'tc' ? (
          <>
            <section className={styles.secBlock}>
              <SectionHead title="TC Business Overview" showUsd />
              <div className={styles.sparkRow}>
                {TC_SPARK.map((card) => (
                  <SparklineSummaryCard key={card.label} {...card} />
                ))}
              </div>
              <div className={styles.shellGrid}>
                <ChartCard title="Trades by Chartering Desk" sub="By office · TC · YTD">
                  <VerticalBars data={DESK_OFFICE_TC} colors={OFFICE_SHADES} />
                </ChartCard>
                <ChartCard title="Trades by Vessel Type" sub="TC · YTD">
                  <VerticalBars data={VESSEL_TYPE_TC} colors={TC_VESSEL_SHADES} />
                </ChartCard>
              </div>
              <div className={styles.shellStack}>
                <ChartCard title="Average Hire by Vessel Type" sub="TC · YTD · not cut by office — mixes tanker classes otherwise">
                  <HorizontalBars data={AVG_HIRE_BY_TYPE} valueFmt={(v) => `$${v.toLocaleString('en-US')}/day`} />
                </ChartCard>
              </div>
              <div className={`${styles.shellGrid}${isOwnerIcp ? ` ${styles.shellGridSingle}` : ''}`}>
                {isOwnerIcp ? null : (
                  <ChartCard title="Chartered-In Business" sub="TC · YTD · USD (millions)">
                    <HorizontalBars data={tcOwnersData} colors={OWNER_SHADES} valueFmt={(v) => `${v.toFixed(1)} mil`} />
                    {showFleetMix ? (
                      <FleetMixBar owned={FLEET_MIX.owned} charteredIn={FLEET_MIX.charteredIn} />
                    ) : null}
                  </ChartCard>
                )}
                <ChartCard title="Chartered-Out Business" sub="TC · YTD · USD (millions)">
                  <HorizontalBars data={CHARTERERS_TC} colors={CHARTERER_SHADES} valueFmt={(v) => `${v.toFixed(1)} mil`} />
                </ChartCard>
              </div>
              <ChartCard title="Vessel Redelivery Zones" sub="TC · YTD">
                <HorizontalBars data={ZONES_TC} />
                <SopFCta />
              </ChartCard>
              <PerformingVesselsCard
                rows={TC_DEMO_PERFORMING}
                columns={PERFORMING_TC_COLUMNS}
                loading={false}
              />
            </section>

            <section className={styles.secBlock}>
              <SectionHead title="Receivables" showUsd />
              <div className={styles.splitPanel}>
                <div className={styles.card}>
                  <h4 className={styles.cardTitle}>Receivables (Hire)</h4>
                  <DataTable
                    columns={hireColumns}
                    rows={[
                      ...(tcData?.hireRows ?? []).map((row, index) => ({
                        ...row,
                        id: `hire-${index}`,
                      })),
                      ...(tcData?.hireRows?.length
                        ? [{
                          id: 'hire-total',
                          tcNo: '',
                          vessel: '',
                          customer: 'Total',
                          amount: tcData.hireTotal ?? '',
                        }]
                        : []),
                    ]}
                  />
                </div>
                <div className={styles.card}>
                  <h4 className={styles.cardTitle}>Receivables (Other)</h4>
                  <DataTable
                    columns={otherColumns}
                    rows={[
                      ...(tcData?.otherRows ?? []).map((row, index) => ({
                        ...row,
                        id: `other-${index}`,
                      })),
                      ...(tcData?.otherRows?.length
                        ? [{
                          id: 'other-total',
                          tcNo: '',
                          vessel: '',
                          otherInvoiceType: 'Total',
                          amount: tcData.otherTotal ?? '',
                        }]
                        : []),
                    ]}
                  />
                </div>
              </div>
            </section>
          </>
        ) : null}

        {activeTab === 'coas' ? (
          <section className={styles.secBlock}>
            <SectionHead title="COA Business Overview" showUsd />
            <div className={styles.shellGrid}>
              {COA_PACE.map((item) => (
                <PaceCard key={item.id} item={item} />
              ))}
            </div>
            <SectionHead title="Contracts" />
            <DataTable
              columns={coaColumns}
              rows={coaRows.map((row) => ({ ...row, id: row.coaId }))}
              emptyMessage="SORRY CURRENTLY THERE ARE ZERO(0) RECORDS"
              pageSize={coaPageSize}
              onPageSizeChange={setCoaPageSize}
              footer={(
                <SopfPagination
                  page={coaPage}
                  pageSize={coaPageSize}
                  total={coaTotal}
                  onPageChange={setCoaPage}
                />
              )}
            />
          </section>
        ) : null}

        {activeTab === 'periods' ? (
          <section className={styles.secBlock}>
            <SectionHead title="Period Business Overview" showUsd />
            <div className={styles.shellGrid}>
              {PERIOD_CARDS.map((item) => (
                <PeriodPaceCard key={item.id} item={item} />
              ))}
            </div>
            <div className={styles.shellStack}>
              <ChartCard title="Redelivery & Option Pipeline" sub="Next 90 days">
                <PipelineList items={PIPELINE} />
              </ChartCard>
            </div>
            <div className={styles.shellGrid}>
              <ChartCard title="On-Hire vs. Off-Hire" sub="Days & USD impact by reason, per period contract">
                <OffHirePanel records={PERIOD_RECORDS} />
              </ChartCard>
              <ChartCard title="Revenue Due vs Received" sub="Days performed, with value impact">
                <HireDuePanel records={PERIOD_RECORDS} />
              </ChartCard>
            </div>
            <div className={styles.shellStack}>
              <MarkToMarketCard data={MARK_TO_MARKET} />
            </div>
            <SectionHead title="Contracts" />
            <DataTable
              columns={periodColumns}
              rows={periodRows.map((row) => ({ ...row, id: row.periodId }))}
              emptyMessage="SORRY CURRENTLY THERE ARE ZERO(0) RECORDS"
              pageSize={periodPageSize}
              onPageSizeChange={setPeriodPageSize}
              footer={(
                <SopfPagination
                  page={periodPage}
                  pageSize={periodPageSize}
                  total={periodTotal}
                  onPageChange={setPeriodPage}
                />
              )}
            />
          </section>
        ) : null}

        {activeTab === 'all' ? (
          <>
            <section className={styles.secBlock}>
              <SectionHead title="All Contracts Overview" showUsd />
              <div className={styles.sparkRow}>
                {ALL_KPI.map((card) => (
                  <AllKpiTile key={card.label} {...card} />
                ))}
              </div>
            </section>
            <section className={styles.secBlock}>
              <ContractMixPanel />
            </section>
            <section className={styles.secBlock}>
              <RevenueByContractCard />
            </section>
            <section className={styles.secBlock}>
              <ChartCard title="Needs Attention">
                <AttentionList items={ATTENTION_ITEMS} />
              </ChartCard>
            </section>
            <section className={styles.secBlock}>
              <PerformingVesselsCard
                title="Performing Vessels (All)"
                rows={ALL_DEMO_PERFORMING}
                columns={PERFORMING_ALL_COLUMNS}
                loading={false}
              />
            </section>
            <section className={styles.secBlock}>
              <ChartCard title="Receivable vs Invoiced" sub="USD (millions)">
                <HorizontalBars data={RECEIVABLE_VS_INVOICED} valueFmt={(v) => `${v.toFixed(1)} mil`} />
              </ChartCard>
            </section>
            <section className={styles.secBlock}>
              <ChartCard title="Total Trade Revenue" sub="Completed trades · USD (millions) · Quarterly YTD">
                <QuarterlyAreaChart data={REVENUE_QUARTERLY} />
              </ChartCard>
            </section>
          </>
        ) : null}
      </div>

      <CoaShipmentsModal
        open={coaModalOpen}
        title={coaModalTitle}
        rows={coaModalRows}
        loading={coaModalLoading}
        onClose={() => setCoaModalOpen(false)}
      />
      </div>
    </>
  );
}

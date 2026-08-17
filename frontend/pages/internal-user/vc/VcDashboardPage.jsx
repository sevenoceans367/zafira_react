import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, LoadingOverlay } from '@bainbridge/shared-ui';
import { getUser } from '@bainbridge/shared-auth';
import SopfPagination from '../sopf/SopfPagination.jsx';
import {
  fetchCoaList,
  fetchCoaShipments,
  fetchPeriodList,
  fetchTcBusinessDashboard,
  fetchVcBusinessDashboard,
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
  COA_PACE,
  DESK_OFFICE_TC,
  DESK_OFFICE_VC,
  FLEET_MIX,
  MARK_TO_MARKET,
  OFFICE_SHADES,
  OWNER_SHADES,
  OWNERS_OPERATOR,
  OWNERS_TC,
  PERFORMING_TC,
  PERFORMING_VC,
  PERIOD_CARDS,
  PERIOD_RECORDS,
  PIPELINE,
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
  { id: 'vc', label: 'VC Business', toneClass: 'tabVc' },
  { id: 'tc', label: 'TC Business', toneClass: 'tabTc' },
  { id: 'coas', label: 'COAs', toneClass: 'tabCoas' },
  { id: 'periods', label: 'Periods', toneClass: 'tabPeriods' },
  { id: 'all', label: 'All Contracts', toneClass: 'tabNavy' },
];

function SectionHead({ title, showUsd = false }) {
  return (
    <div className={styles.secHead}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {showUsd ? <span className={styles.usdTag}>Values in USD</span> : null}
    </div>
  );
}

const PAGE_SIZE = 10;
const CHART_COLORS = {
  fixture: '#86a948',
  interim: '#999898',
  completion: '#367fa9',
};

function DataTable({ columns, rows, emptyMessage = 'No records found.' }) {
  return (
    <div className={styles.tableWrap}>
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
    </div>
  );
}

function FixtureChart({ rows, categoryKey = 'vessel' }) {
  const maxValue = useMemo(() => {
    const values = rows.flatMap((row) => [
      Number(row.fixtureValue || 0),
      Number(row.interimValue || 0),
      Number(row.completionValue || 0),
    ]);
    return Math.max(...values, 1);
  }, [rows]);

  if (!rows.length) {
    return <p className={styles.chartEmpty}>No chart data available.</p>;
  }

  return (
    <div className={styles.chartPanel}>
      <div className={styles.chartLegend}>
        <span><i className={styles.legendSwatch} style={{ background: CHART_COLORS.fixture }} /> Fixture</span>
        <span><i className={styles.legendSwatch} style={{ background: CHART_COLORS.interim }} /> Interim</span>
        <span><i className={styles.legendSwatch} style={{ background: CHART_COLORS.completion }} /> Completion</span>
        <span className={styles.chartAxisLabel}>USD &apos;000</span>
      </div>
      <div className={styles.chartScroll}>
        <div className={styles.chartGrid}>
          {rows.map((row) => {
            const label = row[categoryKey] || row.vessel || row.tcNo;
            return (
              <div key={`${label}-${row.voyageNo || row.tcNo || ''}`} className={styles.chartGroup}>
                <div className={styles.chartBars}>
                  {[
                    { key: 'fixture', field: 'fixtureValue' },
                    { key: 'interim', field: 'interimValue' },
                    { key: 'completion', field: 'completionValue' },
                  ].map((bar) => {
                    const value = Number(row[bar.field] || 0);
                    const height = value > 0 ? `${(value / maxValue) * 100}%` : '0';
                    return (
                      <div key={bar.key} className={styles.chartBarWrap} title={`${bar.key}: ${value}`}>
                        <div
                          className={styles.chartBar}
                          style={{ height, background: CHART_COLORS[bar.key] }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className={styles.chartLabel}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  const user = getUser();
  const isMgmtUser = user?.userType === 'mgmt_user';

  const [activeTab, setActiveTab] = useState('vc');
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState('2');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(50000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [vcData, setVcData] = useState(null);
  const [tcData, setTcData] = useState(null);
  const [coaRows, setCoaRows] = useState([]);
  const [coaTotal, setCoaTotal] = useState(0);
  const [coaPage, setCoaPage] = useState(1);
  const [periodRows, setPeriodRows] = useState([]);
  const [periodTotal, setPeriodTotal] = useState(0);
  const [periodPage, setPeriodPage] = useState(1);

  const [coaModalOpen, setCoaModalOpen] = useState(false);
  const [coaModalTitle, setCoaModalTitle] = useState('');
  const [coaModalRows, setCoaModalRows] = useState([]);
  const [coaModalLoading, setCoaModalLoading] = useState(false);

  const loadBusinessTypes = useCallback(async (selectedId) => {
    const types = await fetchVcBusinessTypes(selectedId);
    setBusinessTypes(types);
  }, []);

  const loadVc = useCallback(async () => {
    const data = await fetchVcBusinessDashboard({
      selBType: businessType,
      fromDate: periodFrom,
      toDate: periodTo,
    });
    setVcData(data);
  }, [businessType, periodFrom, periodTo]);

  const loadTc = useCallback(async () => {
    const data = await fetchTcBusinessDashboard({
      selBType: businessType,
      fromDate: periodFrom,
      toDate: periodTo,
    });
    setTcData(data);
  }, [businessType, periodFrom, periodTo]);

  const loadCoas = useCallback(async () => {
    const data = await fetchCoaList({
      selBType: businessType,
      fromDate: periodFrom,
      toDate: periodTo,
      page: coaPage,
      pageSize: PAGE_SIZE,
    });
    setCoaRows(data.records ?? []);
    setCoaTotal(data.recordsTotal ?? 0);
  }, [businessType, periodFrom, periodTo, coaPage]);

  const loadPeriods = useCallback(async () => {
    const data = await fetchPeriodList({
      selBType: businessType,
      page: periodPage,
      pageSize: PAGE_SIZE,
    });
    setPeriodRows(data.records ?? []);
    setPeriodTotal(data.recordsTotal ?? 0);
  }, [businessType, periodPage]);

  const loadActiveTab = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      switch (activeTab) {
        case 'vc':
          await loadVc();
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
          await Promise.all([loadVc(), loadTc(), loadCoas(), loadPeriods()]);
          break;
        default:
          break;
      }
    } catch (err) {
      setError(err.message || 'Failed to load commercial performance.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadVc, loadTc, loadCoas, loadPeriods]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadVc(), loadTc(), loadCoas(), loadPeriods()]);
    } catch (err) {
      setError(err.message || 'Failed to load commercial performance.');
    } finally {
      setLoading(false);
    }
  }, [loadVc, loadTc, loadCoas, loadPeriods]);

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

  const vcCompletedColumns = [
    { key: 'vessel', label: 'Vessels' },
    { key: 'voyageNo', label: 'Voyage No.' },
    { key: 'cpDate', label: 'CP date' },
    { key: 'voyage', label: 'Voyage' },
    { key: 'deliveryRedelivery', label: 'Delivery - Re-Delivery' },
  ];

  const vcFixtureColumns = [
    { key: 'vessel', label: 'Vessels', render: (row) => `${row.vessel} (${row.voyageNo})` },
    { key: 'fixture', label: 'Fixture' },
    { key: 'interim', label: 'Interim' },
    { key: 'completion', label: 'Completion' },
  ];

  const freightColumns = [
    { key: 'voyage', label: 'Voyage No' },
    { key: 'vessel', label: 'Vessels' },
    { key: 'charterer', label: 'Customer' },
    { key: 'initialFreight', label: 'Initial Freight (USD)' },
    { key: 'finalFreight', label: 'Final Freight (USD)' },
  ];

  const tcCompletedColumns = [
    { key: 'tcNo', label: 'TC No.' },
    { key: 'vessel', label: 'Vessels' },
    { key: 'cpDate', label: 'CP date' },
    { key: 'deliveryRedelivery', label: 'Delivery - Re-Delivery' },
  ];

  const tcFixtureColumns = [
    { key: 'tcNo', label: 'TC No.' },
    { key: 'vessel', label: 'Vessels' },
    { key: 'fixture', label: 'Fixture' },
    { key: 'interim', label: 'Interim' },
    { key: 'completion', label: 'Completion' },
  ];

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
    { key: 'coaRoute', label: 'COA Route' },
    { key: 'coaIdentity', label: 'COA ID' },
    { key: 'coaNo', label: 'COA No.' },
    { key: 'coaDate', label: 'COA Date' },
    { key: 'vesselType', label: 'Vessel Type' },
    { key: 'charterer', label: 'Charterer' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'minQty', label: 'Min Qty(MT)' },
    { key: 'duration', label: 'Duration' },
    { key: 'totalShipments', label: 'Total Shipments' },
    { key: 'shipmentsPerformed', label: 'Shipments Performed' },
    { key: 'balanceCargo', label: 'Balance Cargo(MT)' },
    {
      key: 'details',
      label: 'Details',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          label="Details"
          onClick={() => openCoaDetails(row.coaId, row.coaIdentity)}
        />
      ),
    },
  ];

  const periodColumns = [
    { key: 'index', label: '#' },
    { key: 'contractId', label: 'Contract ID' },
    { key: 'contractNo', label: 'Contract No.' },
    { key: 'contractDate', label: 'Contract Date' },
    { key: 'vesselName', label: 'Vessel Name' },
    { key: 'ownBusinessAccount', label: 'Own Business Account' },
    { key: 'workingCurrency', label: 'Working Currency' },
    {
      key: 'days',
      label: 'Total / Performed / Balance Days',
      render: (row) => `${row.totalDays} / ${row.performedDays} / ${row.balanceDays}`,
    },
    { key: 'vcShipments', label: 'Total Shipment (VC)' },
    { key: 'tcShipments', label: 'Total Shipment (TC)' },
  ];

  return (
    <>
      <VcDashboardHeaderActions
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={handleBusinessTypeChange}
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
            <h3 className={styles.sectionTitle}>Dashboard</h3>
            <DataTable
              columns={vcCompletedColumns}
              rows={(vcData?.completedRows ?? []).map((row, index) => ({
                ...row,
                id: `${row.voyageNo}-${index}`,
              }))}
            />

            {isMgmtUser ? (
              <section className={styles.secBlock}>
                <SectionHead title="Fixtures" showUsd />
                <div className={styles.splitPanel}>
                  <div className={styles.card}>
                    <h4 className={styles.cardTitle}>Fixture detail</h4>
                    <DataTable
                      columns={vcFixtureColumns}
                      rows={(vcData?.chartRows ?? []).map((row, index) => ({
                        ...row,
                        id: `${row.voyageNo}-${index}`,
                      }))}
                    />
                  </div>
                  <div className={styles.card}>
                    <h4 className={styles.cardTitle}>Fixture chart</h4>
                    <FixtureChart rows={vcData?.chartRows ?? []} />
                  </div>
                </div>
              </section>
            ) : null}

            <section className={styles.secBlock}>
              <SectionHead title="Unsettled Freight" showUsd />
              <div className={styles.card}>
                <DataTable
                  columns={freightColumns}
                  rows={[
                    ...(vcData?.freightRows ?? []).map((row, index) => ({
                      ...row,
                      id: `freight-${index}`,
                    })),
                    ...(vcData?.freightRows?.length
                      ? [{
                        id: 'freight-total',
                        voyage: '',
                        vessel: '',
                        charterer: 'Total',
                        initialFreight: vcData.freightTotals?.initial ?? '',
                        finalFreight: vcData.freightTotals?.final ?? '',
                      }]
                      : []),
                  ]}
                />
              </div>
            </section>
          </>
        ) : null}

        {activeTab === 'tc' ? (
          <>
            <h3 className={styles.sectionTitle}>Dashboard</h3>
            <DataTable
              columns={tcCompletedColumns}
              rows={(tcData?.completedRows ?? []).map((row, index) => ({
                ...row,
                id: `${row.tcNo}-${index}`,
              }))}
            />

            {isMgmtUser ? (
              <section className={styles.secBlock}>
                <SectionHead title="Fixtures" showUsd />
                <div className={styles.splitPanel}>
                  <div className={styles.card}>
                    <h4 className={styles.cardTitle}>Fixture detail</h4>
                    <DataTable
                      columns={tcFixtureColumns}
                      rows={(tcData?.chartRows ?? []).map((row, index) => ({
                        ...row,
                        id: `${row.tcNo}-${index}`,
                      }))}
                    />
                  </div>
                  <div className={styles.card}>
                    <h4 className={styles.cardTitle}>Fixture chart</h4>
                    <FixtureChart rows={tcData?.chartRows ?? []} categoryKey="vessel" />
                  </div>
                </div>
              </section>
            ) : null}

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
            <div className={styles.card}>
              <DataTable
                columns={coaColumns}
                rows={coaRows.map((row) => ({ ...row, id: row.coaId }))}
                emptyMessage="SORRY CURRENTLY THERE ARE ZERO(0) RECORDS"
              />
              <SopfPagination
                page={coaPage}
                pageSize={PAGE_SIZE}
                total={coaTotal}
                onPageChange={setCoaPage}
              />
            </div>
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
              <ChartCard title="Redelivery & Option Pipeline" sub="Next 90 days · sample">
                <PipelineList items={PIPELINE} />
              </ChartCard>
            </div>
            <div className={styles.shellGrid}>
              <ChartCard title="On-Hire vs. Off-Hire" sub="Days & USD impact by reason · sample">
                <OffHirePanel records={PERIOD_RECORDS} />
              </ChartCard>
              <ChartCard title="Revenue Due vs Received" sub="Days performed, with value impact · sample">
                <HireDuePanel records={PERIOD_RECORDS} />
              </ChartCard>
            </div>
            <div className={styles.shellStack}>
              <MarkToMarketCard data={MARK_TO_MARKET} />
            </div>
            <SectionHead title="Contracts" />
            <div className={styles.card}>
              <DataTable
                columns={periodColumns}
                rows={periodRows.map((row) => ({ ...row, id: row.periodId }))}
                emptyMessage="SORRY CURRENTLY THERE ARE ZERO(0) RECORDS"
              />
              <SopfPagination
                page={periodPage}
                pageSize={PAGE_SIZE}
                total={periodTotal}
                onPageChange={setPeriodPage}
              />
            </div>
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

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ActionButtonStack,
  Button,
  LoadingOverlay,
  SecondaryActionButton,
  SendToOpsButton,
  SummaryCard,
  SummaryCardGrid,
  useConfirm,
  useAlert,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  deleteEstimate,
  fetchBusinessTypes,
  fetchDecisionChart,
  fetchEstimateList,
  fetchSensitivityAnalysis,
  sendEstimateToOps,
  submitDecisionChart,
} from '../../../services/estimateList.js';
import { CompareIcon } from '../ops/OpsVcGlanceUi.jsx';
import EstimateListHeaderActions from './EstimateListHeaderActions.jsx';
import EstimateListTableToolbar from './EstimateListTableToolbar.jsx';
import SensitivityAnalysisModal from './SensitivityAnalysisModal.jsx';
import SopfPagination from './SopfPagination.jsx';
import ScrollableTable from './ScrollableTable.jsx';
import {
  buildEstimateListEmailUrl,
  buildEstimateListPdfUrl,
  downloadEstimateListCsv,
} from './estimateListExports.js';
import styles from './EstimateListPage.module.css';

const MSG_COPY = {
  0: { type: 'success', text: 'Congratulations! VC Estimates added/updated successfully.' },
  1: { type: 'danger', text: 'Sorry! there was an error while adding/updating VC Estimates.' },
  2: { type: 'success', text: 'Congratulations! VC Estimates delete successfully.' },
  3: { type: 'success', text: 'Congratulations! Final VC Estimates added successfully.' },
};

function formatOpenTrade(value) {
  const amount = Number(value) || 0;
  if (amount >= 1000) {
    return `$${(amount / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STAT_ICONS = {
  openTrade: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18" />
      <path d="M16.5 7.5c0-2-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.3 9 2 9 6.3 0 2-2 3.2-4.5 3.2s-4.5-1-4.5-3" />
    </svg>
  ),
  vesselsInSubs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v13" />
      <path d="M8 10h8" />
      <path d="M5 14a7 7 0 0 0 14 0" />
    </svg>
  ),
  tradesInOperations: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2 7 4-14 2 7h6" />
    </svg>
  ),
  vesselsOnWater: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 14l1.3-5.2A2 2 0 0 1 8.2 7.3h7.6a2 2 0 0 1 1.9 1.5L19 14" />
      <path d="M12 3v4.3" />
      <path d="M12 3.5l3 1.2-3 1.1z" fill="currentColor" stroke="none" />
      <path d="M3 17.5c1.4 1 3 1 4.4 0 1.4-1 3-1 4.4 0 1.4 1 3 1 4.4 0 1.4-1 3-1 4.4 0" />
    </svg>
  ),
};

const STAT_CARDS = [
  { key: 'openTrade', label: 'Open Trades', variant: 'fin', formatValue: formatOpenTrade },
  { key: 'vesselsInSubs', label: 'Vessels in Subs', variant: 'count' },
  {
    key: 'tradesInOperations',
    label: 'Trades in Operations',
    variant: 'fin',
    formatValue: formatOpenTrade,
  },
  { key: 'vesselsOnWater', label: 'Vessels on Water', variant: 'count' },
];

/** Gas=1, Tanker=2, Dry Cargo=3 — legacy PHP default is Tanker */
const DEFAULT_BUSINESS_TYPE = '2';

function TruncatedText({ text, maxLength = 10 }) {
  const value = String(text ?? '');
  if (value.length <= maxLength) return value;

  return (
    <span title={value} className={styles.truncatedText}>
      {value.slice(0, maxLength)}…
    </span>
  );
}

export default function EstimateListPage() {
  const confirm = useConfirm();
  const alert = useAlert();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    openTrade: 0,
    vesselsInSubs: 0,
    tradesInOperations: 0,
    vesselsOnWater: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [fixtures, setFixtures] = useState([]);
  const [chartSelection, setChartSelection] = useState({ id: '', remarks: '' });
  const [saModalOpen, setSaModalOpen] = useState(false);
  const [saModalLoading, setSaModalLoading] = useState(false);
  const [saData, setSaData] = useState({ columns: [], sections: [] });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const selBTypeInUrl = searchParams.get('selBType');
  const businessType = selBTypeInUrl && selBTypeInUrl !== '' ? selBTypeInUrl : DEFAULT_BUSINESS_TYPE;
  const estimateType = Number(
    searchParams.get('estimatetype')
      || (selBTypeInUrl === null ? DEFAULT_BUSINESS_TYPE : selBTypeInUrl)
      || DEFAULT_BUSINESS_TYPE,
  );
  const flashMsg = searchParams.get('msg');
  const flash = flashMsg != null ? MSG_COPY[Number(flashMsg)] : null;
  const periodFrom = searchParams.get('periodFrom') ?? '';
  const periodTo = searchParams.get('periodTo') ?? '';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [types, list] = await Promise.all([
        fetchBusinessTypes(businessType),
        fetchEstimateList({
          estimateType,
          businessType,
          periodFrom,
          periodTo,
        }),
      ]);
      setBusinessTypes(types);
      setRows(list.rows);
      setStats(list.stats ?? {
        openTrade: 0,
        vesselsInSubs: 0,
        tradesInOperations: 0,
        vesselsOnWater: 0,
      });
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  }, [estimateType, businessType, periodFrom, periodTo]);

  const openDecisionChart = useCallback(async (ids) => {
    if (!ids.length) {
      await alert({
        title: 'Missing Information',
        message: 'Please select at least one checkbox',
        confirmLabel: 'OK',
      });
      return;
    }

    setModalOpen(true);
    setModalLoading(true);
    setChartSelection({ id: '', remarks: '' });
    try {
      const data = await fetchDecisionChart(ids);
      setFixtures(data.fixtures);
    } finally {
      setModalLoading(false);
    }
  }, [alert]);

  useEffect(() => {
    const current = searchParams.get('selBType');
    if (!current || current === '') {
      const next = new URLSearchParams(searchParams);
      next.set('selBType', DEFAULT_BUSINESS_TYPE);
      next.set('estimatetype', DEFAULT_BUSINESS_TYPE);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [search, businessType, periodFrom, periodTo, pageSize]);

  useEffect(() => {
    const ids = searchParams.get('ids');
    if (ids) {
      openDecisionChart(ids.split(',').filter(Boolean));
    }
    // Deep-link only on initial mount (legacy PHP ?ids= parity)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null) next.delete(key);
      else next.set(key, String(value));
    });
    if (updates.selBType !== undefined) {
      next.set('estimatetype', String(updates.selBType));
    }
    // Keep intentional flash messages; clear only when filters/pagination change.
    if (!Object.prototype.hasOwnProperty.call(updates, 'msg')) {
      next.delete('msg');
    }
    setSearchParams(next, { replace: true });
  };

  const handleSendToOps = async (id, sheetName) => {
    const ok = await confirm({
      title: 'Send to Operations',
      message: `Are you sure you want to send "${sheetName || 'this estimate'}" to Operations?`,
      confirmLabel: 'Send to Ops',
      cancelLabel: 'Cancel',
      confirmVariant: 'accent',
    });
    if (!ok) return;

    try {
      await sendEstimateToOps(id);
      updateParams({ msg: 3 });
      await loadData();
    } catch (error) {
      await alert({
        title: 'Error',
        message: error?.message || 'Unable to send this estimate to Operations.',
        confirmLabel: 'OK',
      });
    }
  };

  const filteredRows = rows.filter((row) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return [
      row.vesselDisplay,
      row.vesselName,
      row.vesselType,
      row.voyageNo,
      row.voyageLabel,
      row.estimateNo,
      row.sheetName,
      row.charteringPic,
      row.lpDp,
    ].some((value) => String(value ?? '').toLowerCase().includes(query));
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const allSelected =
    pagedRows.length > 0
    && pagedRows.every((row) => selectedIds.includes(row.id));

  const toggleAll = () => {
    if (allSelected) {
      const pageIds = new Set(pagedRows.map((row) => row.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pagedRows.forEach((row) => next.add(row.id));
      return [...next];
    });
  };

  const toggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to delete this entry permanently?',
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
    });
    if (!ok) return;

    await deleteEstimate(id);
    updateParams({ msg: 2 });
    await loadData();
  };

  const handleReplicate = async (id) => {
    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to replicate this estimate?',
      confirmLabel: 'Replicate',
      confirmVariant: 'primary',
    });
    if (!ok) return;

    navigate(
      appPath(
        `/internal-user/sopf/addestimate?replicateFrom=${encodeURIComponent(id)}&estimatetype=${estimateType}&selBType=${businessType}`,
      ),
    );
  };

  const handleSubmitDecisionChart = async () => {
    if (!chartSelection.id || !chartSelection.remarks.trim()) {
      await alert({
        title: 'Missing Information',
        message: 'Please select one Fixture and fill remarks',
        confirmLabel: 'OK',
      });
      return;
    }

    await submitDecisionChart({ selection: chartSelection });
    setModalOpen(false);
    updateParams({ msg: 3 });
    await loadData();
  };

  const handleDownloadCsv = async () => {
    if (!filteredRows.length) {
      await alert({
        title: 'Notice',
        message: 'No data available to download.',
        confirmLabel: 'OK',
      });
      return;
    }
    downloadEstimateListCsv(filteredRows);
  };

  const handleDownloadPdf = () => {
    window.open(buildEstimateListPdfUrl({ estimateType, businessType }), '_blank');
  };

  const handleEmailAttachment = () => {
    window.open(buildEstimateListEmailUrl({ estimateType, businessType }), '_blank');
  };

  const handleSensitivityAnalysis = async () => {
    if (!selectedIds.length) {
      await alert({
        title: 'Missing Information',
        message: 'Please select at least one checkbox',
        confirmLabel: 'OK',
      });
      return;
    }

    setSaModalOpen(true);
    setSaModalLoading(true);
    setSaData({ columns: [], sections: [] });
    try {
      const data = await fetchSensitivityAnalysis(selectedIds, businessType);
      setSaData(data);
    } catch (error) {
      await alert({
        title: 'Error',
        message: error.message || 'Failed to load sensitivity analysis.',
        confirmLabel: 'OK',
      });
      setSaModalOpen(false);
    } finally {
      setSaModalLoading(false);
    }
  };

  return (
    <>
      <EstimateListHeaderActions
        search={search}
        onSearchChange={setSearch}
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={(value) => updateParams({ selBType: value })}
        periodFrom={periodFrom}
        periodTo={periodTo}
        onPeriodChange={({ from, to }) => updateParams({ periodFrom: from || null, periodTo: to || null })}
      />

      <div className="zafira-page">
        {flash ? (
          <div
            className={flash.type === 'success' ? styles.flashSuccess : styles.flashError}
            role="alert"
          >
            <strong>{flash.type === 'success' ? 'Success!' : 'Error!'}</strong> {flash.text}
            <button
              type="button"
              className={styles.flashClose}
              aria-label="Close"
              onClick={() => updateParams({ msg: null })}
            >
              ×
            </button>
          </div>
        ) : null}

        <SummaryCardGrid>
          {STAT_CARDS.map((card) => (
            <SummaryCard
              key={card.key}
              title={card.label}
              value={
                card.formatValue
                  ? card.formatValue(stats[card.key])
                  : (stats[card.key] ?? 0)
              }
              variant={card.variant}
              icon={STAT_ICONS[card.key]}
            />
          ))}
        </SummaryCardGrid>

        <ScrollableTable
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          toolbarLeft={(
            <EstimateListTableToolbar
              addHref={`/internal-user/sopf/addestimate?estimatetype=${estimateType}&selBType=${businessType}`}
              onSensitivityAnalysis={handleSensitivityAnalysis}
              sensitivityDisabled={selectedIds.length === 0}
              onDownloadCsv={handleDownloadCsv}
              onDownloadPdf={handleDownloadPdf}
              onEmailAttachment={handleEmailAttachment}
            />
          )}
          footer={(
            <SopfPagination
              page={safePage}
              pageSize={pageSize}
              total={filteredRows.length}
              onPageChange={setPage}
            />
          )}
        >
            <table className={styles.grid} id="fce_list">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Vessel</th>
                  <th>Voyage</th>
                  <th>CP Date</th>
                  <th>DWT</th>
                  <th>LP - DP</th>
                  <th>Voy Days</th>
                  <th>Cargo</th>
                  <th>TCE</th>
                  <th>P&L</th>
                  <th aria-label="Actions" />
                  <th className={styles.compareHeader} title="Compare">
                    <CompareIcon />
                    <input
                      type="checkbox"
                      className={styles.compareCheckbox}
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} className={styles.empty}>
                      Loading estimates...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className={styles.empty}>
                      No open trades for the selected business type.
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className={styles.empty}>
                      No estimates match your search.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.isBenchmark ? styles.benchmarkRow : undefined}
                    >
                      <td className={styles.cellItem}>{row.rowNum}.</td>
                      <td className={styles.cellVessel}>{row.vesselName}</td>
                      <td className={styles.cellNum}>
                        {row.voyageLabel || (row.voyageNo
                          ? `${row.voyageNo}-Est${row.estimateNo || 1}`
                          : '—')}
                      </td>
                      <td className={styles.cellNum}>{row.cpDate}</td>
                      <td className={styles.cellNum}>{row.dwt}</td>
                      <td className={styles.cellRoute}>
                        <TruncatedText text={row.lpDp} />
                      </td>
                      <td className={styles.cellNum}>{row.duration}</td>
                      <td className={styles.cellNum}>{row.cargoQuantity}</td>
                      <td className={styles.cellNum}>{row.tce}</td>
                      <td className={styles.cellNum}>{row.profitLoss}</td>
                      <td>
                        <div className={styles.actionStack}>
                          <ActionButtonStack>
                            <SecondaryActionButton
                              onClick={() => handleReplicate(row.id)}
                              ariaLabel={`Replicate ${row.sheetName}`}
                            />
                            {row.selectable ? (
                              <SendToOpsButton
                                type="button"
                                onClick={() => handleSendToOps(row.id, row.sheetName)}
                                ariaLabel={`Send to Ops ${row.sheetName}`}
                              />
                            ) : row.sendToOpsDisabled || row.voyageLocked ? (
                              <span className={styles.sentSiblingHint} title="Another estimate for this voyage was sent to Ops">
                                Locked
                              </span>
                            ) : null}
                          </ActionButtonStack>
                        </div>
                      </td>
                      <td className={styles.center}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.sheetName}`}
                        />
                      </td>
                      <td>
                        <div className={styles.iconPair}>
                          {row.selectable ? (
                            <>
                              <Button
                                variant="link"
                                size="sm"
                                icon="pencil"
                                className={`${styles.iconBtn} ${styles.iconMuted}`}
                                href={`/internal-user/sopf/updateestimate?id=${row.id}&estimatetype=${estimateType}&selBType=${businessType}`}
                                ariaLabel={`Edit ${row.sheetName}`}
                              />
                              <Button
                                variant="link"
                                size="sm"
                                icon="trash"
                                className={`${styles.iconBtn} ${styles.iconDanger}`}
                                onClick={() => handleDelete(row.id)}
                                ariaLabel={`Delete ${row.sheetName}`}
                              />
                            </>
                          ) : (
                            <Button
                              variant="link"
                              size="sm"
                              icon="file-earmark"
                              className={`${styles.iconBtn} ${styles.iconMuted}`}
                              href={`/internal-user/sopf/viewestimate?id=${row.id}&estimatetype=${estimateType}&selBType=${businessType}`}
                              ariaLabel={`View ${row.sheetName}`}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </ScrollableTable>
      </div>

      {modalOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setModalOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-chart-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h4 id="decision-chart-title">
                <i className="bi bi-file-text" /> Decision Chart
              </h4>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setModalOpen(false)}
              />
            </div>

            <div className={styles.modalBody}>
              {modalLoading ? (
                <p className={styles.modalLoading}>Please wait...</p>
              ) : (
                <div className="zafira-table-wrap">
                  <table className="zafira-data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Vessel Name</th>
                        <th>Estimate No.</th>
                        <th>DWT</th>
                        <th>Freight</th>
                        <th>Delivery Port</th>
                        <th>LP - DP</th>
                        <th>Duration</th>
                        <th>Cargo Quantity</th>
                        <th>Daily Net TCE</th>
                        <th>P&L</th>
                        <th>Remarks</th>
                        <th>Select</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixtures.map((fixture) => (
                        <tr key={fixture.id}>
                          <td>{fixture.rowNum}.</td>
                          <td>{fixture.vesselName}</td>
                          <td>
                            {fixture.sheetName
                              || (fixture.voyageNo
                                ? `${fixture.voyageNo}-Est${fixture.estimateNo || 1}`
                                : '—')}
                          </td>
                          <td>{fixture.dwt}</td>
                          <td>{fixture.freight}</td>
                          <td>{fixture.deliveryPort}</td>
                          <td><TruncatedText text={fixture.lpDp} /></td>
                          <td>{fixture.duration}</td>
                          <td>{fixture.cargoQuantity}</td>
                          <td>{fixture.dailyNetTce}</td>
                          <td>{fixture.profitLoss}</td>
                          <td>
                            <textarea
                              className="form-control"
                              rows={3}
                              value={
                                chartSelection.id === fixture.id ? chartSelection.remarks : ''
                              }
                              disabled={chartSelection.id !== fixture.id}
                              onChange={(event) =>
                                setChartSelection({ id: fixture.id, remarks: event.target.value })
                              }
                              placeholder="Remarks ..."
                            />
                          </td>
                          <td>
                            <input
                              type="radio"
                              name="fixture"
                              checked={chartSelection.id === fixture.id}
                              onChange={() =>
                                setChartSelection((prev) => ({ ...prev, id: fixture.id }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <Button variant="secondary" label="Cancel" onClick={() => setModalOpen(false)} />
              <Button
                variant="primary"
                label="Submit"
                onClick={handleSubmitDecisionChart}
                disabled={modalLoading}
              />
            </div>
          </div>
        </div>
      ) : null}

      <SensitivityAnalysisModal
        open={saModalOpen}
        loading={saModalLoading}
        data={saData}
        businessType={businessType}
        onClose={() => setSaModalOpen(false)}
      />

      <LoadingOverlay show={loading && !modalOpen && !saModalOpen} label="Loading estimates..." />
    </>
  );
}

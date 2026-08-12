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
import compareHeaderIcon from '../../../assets/compare_3.svg';
import EstimateListHeaderActions from './EstimateListHeaderActions.jsx';
import EstimateListTableToolbar from './EstimateListTableToolbar.jsx';
import SensitivityAnalysisModal from './SensitivityAnalysisModal.jsx';
import SopfPagination from './SopfPagination.jsx';
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
    return `${(amount / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K $`;
  }
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

const STAT_CARDS = [
  { key: 'openTrade', label: 'Open Trades', variant: 'gradient', formatValue: formatOpenTrade },
  { key: 'vesselsInSubs', label: 'Vessels in Subs', variant: 'plain' },
  {
    key: 'tradesInOperations',
    label: 'Trades in Operations',
    variant: 'gradient',
    formatValue: formatOpenTrade,
  },
  { key: 'vesselsOnWater', label: 'Vessels on Water', variant: 'plain' },
];

/** Gas=1, Tanker=2, Dry Cargo=3 — legacy PHP default is Tanker */
const DEFAULT_BUSINESS_TYPE = '2';
const PAGE_SIZE = 10;

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
  }, [search, businessType, periodFrom, periodTo]);

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
      row.sheetName,
      row.charteringPic,
      row.lpDp,
    ].some((value) => String(value ?? '').toLowerCase().includes(query));
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
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
            />
          ))}
        </SummaryCardGrid>

        <div className="zafira-card">
          <div className="zafira-card-body">
            <EstimateListTableToolbar
                  addHref={`/internal-user/sopf/addestimate?estimatetype=${estimateType}&selBType=${businessType}`}
                  onSensitivityAnalysis={handleSensitivityAnalysis}
                  sensitivityDisabled={selectedIds.length === 0}
                  onDownloadCsv={handleDownloadCsv}
                  onDownloadPdf={handleDownloadPdf}
                  onEmailAttachment={handleEmailAttachment}
                />
                <div className="zafira-table-wrap">
                <table className="zafira-data-table" id="fce_list">
                  <thead>
                    <tr>
                      <th className={styles.itemColumn}>Item</th>
                      <th className={styles.vesselColumn}>Vessel</th>
                      <th className={styles.voyageColumn}>VOY NO</th>
                      <th>CP Date</th>
                      <th>DWT</th>
                      <th>LP - DP</th>
                      <th>Voy Days</th>
                      <th className={styles.cargoQtyColumn}>Cargo</th>
                      <th className={styles.tceColumn}>TCE</th>
                      <th className={styles.pnlColumn}>P&L</th>
                      <th className={styles.actionColumn}>Replicate</th>
                      <th className={styles.compareColumn}>
                        <div className={styles.compareHeader}>
                          <img
                            src={compareHeaderIcon}
                            alt="Compare"
                            title="Compare"
                            className={styles.compareHeaderIcon}
                          />
                          <input
                            type="checkbox"
                            className={styles.compareCheckbox}
                            checked={allSelected}
                            onChange={toggleAll}
                            aria-label="Select all"
                          />
                        </div>
                      </th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={13} className={styles.emptyState}>
                          Loading estimates...
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={13} className={styles.emptyState}>
                          No estimates found for the selected business type.
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={13} className={styles.emptyState}>
                          No estimates match your search.
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((row) => (
                        <tr
                          key={row.id}
                          className={row.isBenchmark ? styles.benchmarkRow : undefined}
                        >
                          <td>{row.rowNum}.</td>
                          <td className={styles.vesselColumn}>{row.vesselName}</td>
                          <td className={styles.voyageColumn}>{row.voyageNo || '—'}</td>
                          <td>{row.cpDate}</td>
                          <td>{row.dwt}</td>
                          <td><TruncatedText text={row.lpDp} /></td>
                          <td>{row.duration}</td>
                          <td className={styles.cargoQtyColumn}>{row.cargoQuantity}</td>
                          <td className={styles.tceColumn}>{row.tce}</td>
                          <td>{row.profitLoss}</td>
                          <td className={styles.actionCell}>
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
                              ) : null}
                            </ActionButtonStack>
                          </td>
                          <td className={styles.selectCell}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={() => toggleRow(row.id)}
                              aria-label={`Select ${row.sheetName}`}
                            />
                          </td>
                          <td className={styles.actions}>
                            <div className={styles.rowActions}>
                              {row.selectable ? (
                                <>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    icon="pencil"
                                    className={`${styles.rowActionBtn} ${styles.rowActionEdit}`}
                                    href={`/internal-user/sopf/updateestimate?id=${row.id}&estimatetype=${estimateType}&selBType=${businessType}`}
                                    ariaLabel={`Edit ${row.sheetName}`}
                                  />
                                  <Button
                                    variant="link"
                                    size="sm"
                                    icon="trash"
                                    className={`${styles.rowActionBtn} ${styles.rowActionDelete}`}
                                    onClick={() => handleDelete(row.id)}
                                    ariaLabel={`Delete ${row.sheetName}`}
                                  />
                                </>
                              ) : (
                                <Button
                                  variant="link"
                                  size="sm"
                                  icon="file-earmark"
                                  className={`${styles.rowActionBtn} ${styles.rowActionView}`}
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
                </div>
                <SopfPagination
                  page={safePage}
                  pageSize={PAGE_SIZE}
                  total={filteredRows.length}
                  onPageChange={setPage}
                />
          </div>
        </div>
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
                        <th>Sheet Name</th>
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
                          <td>{fixture.sheetName}</td>
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

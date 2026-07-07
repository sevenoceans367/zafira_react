import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  LoadingOverlay,
  SummaryCard,
  SummaryCardGrid,
  useConfirm,
} from '@bainbridge/shared-ui';
import {
  deleteEstimate,
  fetchBusinessTypes,
  fetchDecisionChart,
  fetchEstimateList,
  replicateEstimate,
  submitDecisionChart,
} from '../../../services/estimateList.js';
import EstimateListHeaderActions from './EstimateListHeaderActions.jsx';
import EstimateListTableToolbar from './EstimateListTableToolbar.jsx';
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
  { key: 'openTrade', label: 'Open Trade', variant: 'gradient', formatValue: formatOpenTrade },
  { key: 'draft', label: 'Available', variant: 'plain' },
  { key: 'benchmark', label: 'Benchmark', variant: 'gradient' },
  { key: 'sentToChart', label: 'In Decision Chart', variant: 'plain' },
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ openTrade: 0, total: 0, draft: 0, benchmark: 0, sentToChart: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [fixtures, setFixtures] = useState([]);
  const [chartSelection, setChartSelection] = useState({ id: '', remarks: '' });
  const [search, setSearch] = useState('');

  const selBTypeInUrl = searchParams.get('selBType');
  const businessType = selBTypeInUrl && selBTypeInUrl !== '' ? selBTypeInUrl : DEFAULT_BUSINESS_TYPE;
  const estimateType = Number(
    searchParams.get('estimatetype')
      || (selBTypeInUrl === null ? DEFAULT_BUSINESS_TYPE : selBTypeInUrl)
      || DEFAULT_BUSINESS_TYPE,
  );
  const flashMsg = searchParams.get('msg');
  const flash = flashMsg != null ? MSG_COPY[Number(flashMsg)] : null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [types, list] = await Promise.all([
        fetchBusinessTypes(businessType),
        fetchEstimateList({ estimateType, businessType }),
      ]);
      setBusinessTypes(types);
      setRows(list.rows);
      setStats(list.stats ?? { openTrade: 0, total: 0, draft: 0, benchmark: 0, sentToChart: 0 });
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  }, [estimateType, businessType]);

  const openDecisionChart = useCallback(async (ids) => {
    if (!ids.length) {
      window.alert('Please select at least one checkbox');
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
  }, []);

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
    next.delete('msg');
    setSearchParams(next, { replace: true });
  };

  const handleSendToOps = (id) => {
    openDecisionChart([id]);
  };

  const selectableRows = rows.filter((row) => row.selectable);
  const filteredRows = rows.filter((row) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return [
      row.vesselDisplay,
      row.sheetName,
      row.businessType,
      row.charteringPic,
      row.lpDp,
    ].some((value) => String(value ?? '').toLowerCase().includes(query));
  });
  const allSelected =
    selectableRows.length > 0 && selectedIds.length === selectableRows.length;

  const toggleAll = () => {
    setSelectedIds(
      allSelected ? [] : selectableRows.map((row) => row.id),
    );
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

    await replicateEstimate(id);
    updateParams({ msg: 0 });
    await loadData();
  };

  const handleSubmitDecisionChart = async () => {
    if (!chartSelection.id || !chartSelection.remarks.trim()) {
      window.alert('Please select one Fixture and fill remarks');
      return;
    }

    await submitDecisionChart({ selection: chartSelection });
    setModalOpen(false);
    updateParams({ msg: 3 });
    await loadData();
  };

  const handleDownloadCsv = () => {
    if (!filteredRows.length) {
      window.alert('No data available to download.');
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

  const handleSensitivityAnalysis = () => {
    window.alert('Sensitivity Analysis — connect this to your analysis screen when ready.');
  };

  return (
    <>
      <EstimateListHeaderActions
        search={search}
        onSearchChange={setSearch}
        businessTypes={businessTypes}
        businessType={businessType}
        onBusinessTypeChange={(value) => updateParams({ selBType: value })}
      />

      <div className="zafira-page">
        {flash ? (
          <div className={`alert alert-${flash.type} alert-dismissible`} role="alert">
            <strong>{flash.type === 'success' ? 'Success!' : 'Error!'}</strong> {flash.text}
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => updateParams({ msg: null })}
            />
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
                  addHref={`/internal-user/sopf/addestimate?estimatetype=${estimateType}`}
                  onSensitivityAnalysis={handleSensitivityAnalysis}
                  onDownloadCsv={handleDownloadCsv}
                  onDownloadPdf={handleDownloadPdf}
                  onEmailAttachment={handleEmailAttachment}
                />
                <div className="zafira-table-wrap">
                <table className="zafira-data-table" id="fce_list">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Vessel Name/Type</th>
                      <th>Business Type</th>
                      <th>CP Date</th>
                      <th>DWT</th>
                      <th>LP/DP</th>
                      <th>Duration</th>
                      <th>Cargo Quantity</th>
                      <th>TCE</th>
                      <th>P/L</th>
                      <th>
                        Compare
                        <br />
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          aria-label="Select all"
                        />
                      </th>
                      <th>Replicate</th>
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
                      filteredRows.map((row) => (
                        <tr
                          key={row.id}
                          className={row.isBenchmark ? styles.benchmarkRow : undefined}
                        >
                          <td>{row.rowNum}.</td>
                          <td>{row.vesselDisplay}</td>
                          <td>{row.businessType}</td>
                          <td>{row.cpDate}</td>
                          <td>{row.dwt}</td>
                          <td><TruncatedText text={row.lpDp} /></td>
                          <td>{row.duration}</td>
                          <td>{row.cargoQuantity}</td>
                          <td>{row.tce}</td>
                          <td>{row.profitLoss}</td>
                          <td className={styles.selectCell}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={() => toggleRow(row.id)}
                              aria-label={`Select ${row.sheetName}`}
                            />
                          </td>
                          <td className={styles.replicateCell}>
                            <div className={styles.replicateActions}>
                              <Button
                                variant="outline"
                                size="sm"
                                label="Replicate"
                                className={styles.replicateActionBtn}
                                onClick={() => handleReplicate(row.id)}
                                ariaLabel={`Replicate ${row.sheetName}`}
                              />
                              <Button
                                variant="outlineAccent"
                                size="sm"
                                label="Send to Ops"
                                className={styles.replicateActionBtn}
                                onClick={() => handleSendToOps(row.id)}
                                ariaLabel={`Send to Ops ${row.sheetName}`}
                              />
                            </div>
                          </td>
                          <td className={styles.actions}>
                            <div className={styles.rowActions}>
                              <Button
                                variant="outlineAccent"
                                size="sm"
                                icon="pencil"
                                className={styles.rowActionBtn}
                                href={`/internal-user/sopf/updateestimate?id=${row.id}&estimatetype=${estimateType}&selBType=${businessType}`}
                                ariaLabel={`Edit ${row.sheetName}`}
                              />
                              <Button
                                variant="outlineAccent"
                                size="sm"
                                icon="trash"
                                className={styles.rowActionBtn}
                                onClick={() => handleDelete(row.id)}
                                ariaLabel={`Delete ${row.sheetName}`}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
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
                        <th>LP/DP</th>
                        <th>Duration</th>
                        <th>Cargo Quantity</th>
                        <th>Daily Net TCE</th>
                        <th>P/L</th>
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

      <LoadingOverlay show={loading && !modalOpen} label="Loading estimates..." />
    </>
  );
}

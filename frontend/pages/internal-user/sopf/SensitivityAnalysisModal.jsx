import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@bainbridge/shared-ui';
import { updateSensitivityEstimate, downloadSensitivityAnalysisPdf } from '../../../services/estimateList.js';
import {
  buildColumnState,
  buildUpdatePayload,
  calculateColumnMetrics,
  calculateFreightAdjustmentAmount,
  calculateRatesFromFlatRate,
  formatAddComm,
  formatAmount,
  toNumber,
} from './sensitivityAnalysisCalculations.js';
import styles from './SensitivityAnalysisModal.module.css';

function InputCell({ value, onChange, readOnly = false }) {
  return (
    <input
      className={styles.input}
      value={value ?? ''}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ResultCell({ value }) {
  return <span className={styles.resultValue}>{value === '' ? '' : formatAmount(value)}</span>;
}

function BunkerResultCell({ estMt, estPrice, estCost }) {
  if (!toNumber(estPrice)) return null;
  return (
    <span className={styles.resultValue}>
      {formatAmount(estMt)}
      {' / '}
      {formatAmount(estPrice)}
      {' / '}
      {formatAmount(estCost)}
    </span>
  );
}

export default function SensitivityAnalysisModal({
  open,
  loading,
  data,
  businessType,
  onClose,
}) {
  const printRef = useRef(null);
  const [columns, setColumns] = useState([]);
  const [bunkerGrades, setBunkerGrades] = useState([]);
  const [updatingId, setUpdatingId] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!data?.columns?.length) {
      setColumns([]);
      setBunkerGrades([]);
      return;
    }
    setColumns(data.columns.map((column) => buildColumnState(column)));
    setBunkerGrades(data.bunkerGrades ?? []);
  }, [data]);

  const resolvedBusinessType = data?.businessType ?? businessType ?? '2';
  const isTanker = String(resolvedBusinessType) === '2';

  const metricsById = useMemo(() => {
    const map = {};
    for (const column of columns) {
      map[column.id] = calculateColumnMetrics(column, resolvedBusinessType);
    }
    return map;
  }, [columns, resolvedBusinessType]);

  const updateColumn = (columnId, updater) => {
    setColumns((current) => current.map((column) => (
      column.id === columnId ? updater(column) : column
    )));
  };

  const handleMinFlatRateChange = (columnId, adjustmentKey, value) => {
    updateColumn(columnId, (column) => ({
      ...column,
      freightAdjustments: column.freightAdjustments.map((item) => {
        if (item.key !== adjustmentKey) return item;
        const minFlatRate = toNumber(value);
        return {
          ...item,
          minFlatRate,
          overageFlatRate: calculateRatesFromFlatRate(minFlatRate),
        };
      }),
    }));
  };

  const handleMinWSRateChange = (columnId, adjustmentKey, value) => {
    updateColumn(columnId, (column) => ({
      ...column,
      freightAdjustments: column.freightAdjustments.map((item) => (
        item.key === adjustmentKey
          ? { ...item, minWSRate: toNumber(value), overageWSRate: toNumber(value) }
          : item
      )),
    }));
  };

  const handleAdjustmentChange = (columnId, adjustmentKey, field, value) => {
    updateColumn(columnId, (column) => ({
      ...column,
      freightAdjustments: column.freightAdjustments.map((item) => (
        item.key === adjustmentKey ? { ...item, [field]: value } : item
      )),
    }));
  };

  const handlePortChange = (columnId, collection, portKey, value) => {
    updateColumn(columnId, (column) => ({
      ...column,
      [collection]: column[collection].map((port) => (
        port.key === portKey ? { ...port, cost: value } : port
      )),
    }));
  };

  const handleBunkerPriceChange = (columnId, grade, value) => {
    updateColumn(columnId, (column) => ({
      ...column,
      bunkerExpenses: column.bunkerExpenses.map((item) => (
        item.grade === grade ? { ...item, estPrice: value } : item
      )),
    }));
  };

  const handleHireChange = (columnId, value) => {
    updateColumn(columnId, (column) => ({
      ...column,
      hire: { ...column.hire, rate: value },
    }));
  };

  const handleUpdateEstimate = async (columnId) => {
    const column = columns.find((item) => item.id === columnId);
    if (!column) return;

    const metrics = metricsById[columnId];
    setUpdatingId(columnId);
    try {
      await updateSensitivityEstimate(columnId, buildUpdatePayload(column, metrics));
      window.alert('Estimate updated successfully.');
    } catch (error) {
      window.alert(error.message || 'Failed to update estimate.');
    } finally {
      setUpdatingId('');
    }
  };

  const handleGeneratePdf = async () => {
    if (!columns.length || pdfLoading) return;
    setPdfLoading(true);
    try {
      await downloadSensitivityAnalysisPdf({
        businessType: resolvedBusinessType,
        bunkerGrades,
        columns: columns.map((column) => ({
          ...column,
          metrics: metricsById[column.id] || {},
        })),
      });
    } catch (error) {
      window.alert(error.message || 'Failed to generate PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (!open) return null;

  const colspan = columns.length + 1;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sensitivity-analysis-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h4 id="sensitivity-analysis-title">
            <i className="bi bi-graph-up" /> Sensitivity Analysis
          </h4>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={onClose}
          />
        </div>

        <div className={styles.body}>
          {loading ? (
            <p className={styles.loading}>Please wait...</p>
          ) : (
            <>
              <div className={styles.toolbar}>
                <Button
                  variant="accent"
                  label={pdfLoading ? 'Generating PDF…' : 'Generate PDF'}
                  onClick={handleGeneratePdf}
                  disabled={pdfLoading || !columns.length}
                />
              </div>

              <div ref={printRef} className={`zafira-table-wrap ${styles.printArea}`}>
                <table className={`zafira-data-table ${styles.table}`} id="compareDiv">
                  <thead>
                    <tr>
                      <td colSpan={colspan} className={styles.titleRow}>
                        <h3 className={styles.title}>Sensitivity Analysis</h3>
                      </td>
                    </tr>

                    <tr>
                      <th className={styles.metricCol}>Vessel</th>
                      {columns.map((column) => (
                        <td key={`${column.id}-vessel`} className={styles.headerCell}>
                          {column.vesselName}
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <th className={styles.metricCol}>Voyage No./Parameters</th>
                      {columns.map((column) => (
                        <td key={`${column.id}-voyage`} className={styles.headerCell}>
                          {column.voyageNo}
                        </td>
                      ))}
                    </tr>

                    <tr className={styles.sectionRow}>
                      <td colSpan={colspan}>Cargo Type</td>
                    </tr>
                    <tr>
                      <td className={styles.metricCell} />
                      {columns.map((column) => (
                        <td key={`${column.id}-cargo`} className={styles.headerCell}>
                          {column.cargoType}
                        </td>
                      ))}
                    </tr>

                    <tr className={styles.sectionRow}>
                      <td colSpan={colspan}>Sensitivity Analysis</td>
                    </tr>

                    {isTanker ? (
                      <>
                        <tr className={styles.inputRow}>
                          <td className={styles.metricCell}>Min Cargo</td>
                          {columns.map((column) => (
                            <td key={`${column.id}-min`} className={styles.inputCell}>
                              {column.freightAdjustments.map((item, index) => (
                                <div key={item.key} className={styles.inputStack}>
                                  {index > 0 ? <hr className={styles.divider} /> : null}
                                  <label>Qty</label>
                                  <InputCell
                                    value={item.minCargoQty}
                                    onChange={(value) => handleAdjustmentChange(column.id, item.key, 'minCargoQty', value)}
                                  />
                                  <label>Flat Rate</label>
                                  <InputCell
                                    value={item.minFlatRate}
                                    onChange={(value) => handleMinFlatRateChange(column.id, item.key, value)}
                                  />
                                  <label>WS</label>
                                  <InputCell
                                    value={item.minWSRate}
                                    onChange={(value) => handleMinWSRateChange(column.id, item.key, value)}
                                  />
                                  <label>Amount</label>
                                  <InputCell
                                    value={formatAmount(
                                      calculateFreightAdjustmentAmount(
                                        item.minCargoQty,
                                        item.minFlatRate,
                                        item.minWSRate,
                                      ),
                                    )}
                                    readOnly
                                  />
                                </div>
                              ))}
                            </td>
                          ))}
                        </tr>

                        <tr className={styles.inputRow}>
                          <td className={styles.metricCell}>Overage</td>
                          {columns.map((column) => (
                            <td key={`${column.id}-overage`} className={styles.inputCell}>
                              {column.freightAdjustments.map((item, index) => (
                                <div key={item.key} className={styles.inputStack}>
                                  {index > 0 ? <hr className={styles.divider} /> : null}
                                  <label>Qty</label>
                                  <InputCell
                                    value={item.overageQty}
                                    onChange={(value) => handleAdjustmentChange(column.id, item.key, 'overageQty', value)}
                                  />
                                  <label>Flat Rate</label>
                                  <InputCell
                                    value={item.overageFlatRate}
                                    onChange={(value) => handleAdjustmentChange(column.id, item.key, 'overageFlatRate', value)}
                                  />
                                  <label>WS</label>
                                  <InputCell
                                    value={item.overageWSRate}
                                    onChange={(value) => handleAdjustmentChange(column.id, item.key, 'overageWSRate', value)}
                                  />
                                  <label>Amount</label>
                                  <InputCell
                                    value={formatAmount(
                                      calculateFreightAdjustmentAmount(
                                        item.overageQty,
                                        item.overageFlatRate,
                                        item.overageWSRate,
                                      ),
                                    )}
                                    readOnly
                                  />
                                </div>
                              ))}
                            </td>
                          ))}
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr className={styles.inputRow}>
                          <td className={styles.metricCell}>Freight / MT</td>
                          {columns.map((column) => (
                            <td key={`${column.id}-freight`} className={styles.inputCell}>
                              {!column.chkLumpSum ? (
                                <InputCell
                                  value={column.freight}
                                  onChange={(value) => updateColumn(column.id, (current) => ({ ...current, freight: value }))}
                                />
                              ) : null}
                            </td>
                          ))}
                        </tr>
                        <tr className={styles.inputRow}>
                          <td className={styles.metricCell}>QTY (MT)</td>
                          {columns.map((column) => (
                            <td key={`${column.id}-qty`} className={styles.inputCell}>
                              {!column.chkLumpSum ? (
                                <InputCell
                                  value={column.qty}
                                  onChange={(value) => updateColumn(column.id, (current) => ({ ...current, qty: value }))}
                                />
                              ) : null}
                            </td>
                          ))}
                        </tr>
                      </>
                    )}

                    <tr className={styles.inputRow}>
                      <td className={styles.metricCell}>Lumpsum</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-lumpsum`} className={styles.inputCell}>
                          {column.chkLumpSum ? (
                            <InputCell
                              value={column.lumpsumAmt}
                              onChange={(value) => updateColumn(column.id, (current) => ({ ...current, lumpsumAmt: value }))}
                            />
                          ) : null}
                        </td>
                      ))}
                    </tr>

                    <tr className={styles.inputRow}>
                      <td className={styles.metricCell}>Loading Port</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-load`} className={styles.inputCell}>
                          {column.loadPorts.map((port) => (
                            <div key={port.key} className={styles.inputStack}>
                              <label>{port.portName}</label>
                              <InputCell
                                value={port.cost}
                                onChange={(value) => handlePortChange(column.id, 'loadPorts', port.key, value)}
                              />
                            </div>
                          ))}
                        </td>
                      ))}
                    </tr>

                    <tr className={styles.inputRow}>
                      <td className={styles.metricCell}>Discharge Port</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-disc`} className={styles.inputCell}>
                          {column.discPorts.map((port) => (
                            <div key={port.key} className={styles.inputStack}>
                              <label>{port.portName}</label>
                              <InputCell
                                value={port.cost}
                                onChange={(value) => handlePortChange(column.id, 'discPorts', port.key, value)}
                              />
                            </div>
                          ))}
                        </td>
                      ))}
                    </tr>

                    <tr className={styles.inputRow}>
                      <td className={styles.metricCell}>Transit Port</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-transit`} className={styles.inputCell}>
                          {column.transitPorts.length
                            ? column.transitPorts.map((port) => (
                              <div key={port.key} className={styles.inputStack}>
                                <label>{port.portName}</label>
                                <InputCell
                                  value={port.cost}
                                  onChange={(value) => handlePortChange(column.id, 'transitPorts', port.key, value)}
                                />
                              </div>
                            ))
                            : null}
                        </td>
                      ))}
                    </tr>

                    <tr className={styles.inputRow}>
                      <td className={styles.metricCell}>Bunkering Port</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-bunkering`} className={styles.inputCell}>
                          {column.bunkeringPorts.length
                            ? column.bunkeringPorts.map((port) => (
                              <div key={port.key} className={styles.inputStack}>
                                <label>{port.portName}</label>
                                <InputCell
                                  value={port.cost}
                                  onChange={(value) => handlePortChange(column.id, 'bunkeringPorts', port.key, value)}
                                />
                              </div>
                            ))
                            : null}
                        </td>
                      ))}
                    </tr>

                    {bunkerGrades.map((grade) => (
                      <tr key={grade} className={styles.inputRow}>
                        <td className={styles.metricCell}>
                          {grade}
                          {' '}
                          <em className={styles.subLabel}>(PRICE/MT)</em>
                        </td>
                        {columns.map((column) => {
                          const bunker = column.bunkerExpenses.find((item) => item.grade === grade);
                          return (
                            <td key={`${column.id}-${grade}`} className={styles.inputCell}>
                              {bunker && toNumber(bunker.estPrice) ? (
                                <InputCell
                                  value={bunker.estPrice}
                                  onChange={(value) => handleBunkerPriceChange(column.id, grade, value)}
                                />
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    <tr className={styles.inputRow}>
                      <td className={styles.metricCell}>Hire / Day</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-hire`} className={styles.inputCell}>
                          <InputCell
                            value={column.hire.rate}
                            onChange={(value) => handleHireChange(column.id, value)}
                          />
                        </td>
                      ))}
                    </tr>

                    <tr className={styles.sectionRow}>
                      <td colSpan={colspan}>Revenue</td>
                    </tr>
                    <tr>
                      <td className={styles.metricCell}>Gross freight</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-gross`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.grossFreight} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}>Brokerage</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-brokerage`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.brokerageAmt} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}>Add Comm</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-addcomm`} className={styles.resultCell}>
                          {formatAddComm(column.addCommPer, metricsById[column.id]?.addressCommAmt)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}>Other Income</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-other`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.otherIncome} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}><strong>Net Receivable</strong></td>
                      {columns.map((column) => (
                        <td key={`${column.id}-netrecv`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.netReceivable} />
                        </td>
                      ))}
                    </tr>

                    <tr className={styles.sectionRow}>
                      <td colSpan={colspan}>Expenses - Cargo</td>
                    </tr>
                    <tr>
                      <td className={styles.metricCell}>Loading Port</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-load-total`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.loadPortCost} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}>Discharge Port</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-disc-total`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.discPortCost} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}>Transit Port</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-transit-total`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.transitPortCost} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}>Bunkering Port</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-bunkering-total`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.bunkeringPortCost} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}>Operational Cost</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-ops`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.operationalCost} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}><strong>Total Expenses - Cargo</strong></td>
                      {columns.map((column) => (
                        <td key={`${column.id}-total-exp`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.totalExpense} />
                        </td>
                      ))}
                    </tr>

                    <tr className={styles.sectionRow}>
                      <td colSpan={colspan}>Bunker Expenses (Qty / Price / Amount)</td>
                    </tr>
                    {bunkerGrades.map((grade) => (
                      <tr key={`result-${grade}`}>
                        <td className={styles.metricCell}>{grade}</td>
                        {columns.map((column) => {
                          const bunker = metricsById[column.id]?.bunkerExpenses
                            ?.find((item) => item.grade === grade);
                          return (
                            <td key={`${column.id}-bunker-${grade}`} className={styles.resultCell}>
                              <BunkerResultCell
                                estMt={bunker?.estMt}
                                estPrice={bunker?.estPrice}
                                estCost={bunker?.estCost}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr>
                      <td className={styles.metricCell}><strong>Total Bunker Expense</strong></td>
                      {columns.map((column) => (
                        <td key={`${column.id}-total-bunker`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.totalBunkerExpense} />
                        </td>
                      ))}
                    </tr>

                    <tr className={styles.sectionRow}>
                      <td colSpan={colspan}>Hireage</td>
                    </tr>
                    <tr>
                      <td className={styles.metricCell}>Estimated Hire</td>
                      {columns.map((column) => (
                        <td key={`${column.id}-est-hire`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.estimatedHire} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}><strong>Net Daily Profit (TCE)</strong></td>
                      {columns.map((column) => (
                        <td key={`${column.id}-daily`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.nettDailyProfit} />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className={styles.metricCell}><strong>P/L</strong></td>
                      {columns.map((column) => (
                        <td key={`${column.id}-pl`} className={styles.resultCell}>
                          <ResultCell value={metricsById[column.id]?.profitLoss} />
                        </td>
                      ))}
                    </tr>
                  </thead>
                </table>

                <table className={`zafira-data-table ${styles.updateTable}`}>
                  <tbody>
                    <tr>
                      <td className={styles.metricCol} />
                      {columns.map((column) => (
                        <td key={`${column.id}-update`} className={styles.updateCell}>
                          <Button
                            variant="accent"
                            label={updatingId === column.id ? 'Updating...' : 'Update Estimate'}
                            onClick={() => handleUpdateEstimate(column.id)}
                            disabled={Boolean(updatingId)}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

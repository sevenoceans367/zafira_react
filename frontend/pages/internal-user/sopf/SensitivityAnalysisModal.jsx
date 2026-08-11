import React, { useEffect, useMemo, useState } from 'react';
import { Button, useAlert } from '@bainbridge/shared-ui';
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

function SoMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="19" fill="#fff" stroke="#274670" strokeWidth="2" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="#F4652C" strokeWidth="2.5" />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontWeight="700"
        fontSize="18"
        fill="#274670"
      >
        S
      </text>
    </svg>
  );
}

function formatMoney(value, digits = 0) {
  const num = toNumber(value);
  return num.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

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

function SectionLabel({ children }) {
  return (
    <p className={styles.sectionLabel}>
      <span className={styles.dot} />
      {children}
    </p>
  );
}

function GroupHeader({ label, colCount }) {
  return (
    <div className={`${styles.row} ${styles.groupHeader}`}>
      <div className={styles.labelCell}>{label}</div>
      {Array.from({ length: colCount }).map((_, index) => (
        <div key={index} className={`${styles.colCell} ${styles.spacer}`} />
      ))}
    </div>
  );
}

function DisplayRow({
  label,
  values,
  variant = '',
  emptyDash = true,
}) {
  return (
    <div className={`${styles.row} ${variant ? styles[variant] : ''}`.trim()}>
      <div className={styles.labelCell}>{label}</div>
      {values.map((value, index) => {
        const empty = value === undefined || value === null || value === '';
        return (
          <div
            key={index}
            className={`${styles.colCell} ${empty && emptyDash ? styles.colCellEmpty : ''}`.trim()}
          >
            {empty ? (emptyDash ? '—' : '') : value}
          </div>
        );
      })}
    </div>
  );
}

function EditableRow({
  label,
  columns,
  variant = '',
  renderCell,
}) {
  return (
    <div className={`${styles.row} ${variant ? styles[variant] : ''}`.trim()}>
      <div className={styles.labelCell}>{label}</div>
      {columns.map((column) => (
        <div key={column.id} className={styles.colCell}>
          {renderCell(column)}
        </div>
      ))}
    </div>
  );
}

export default function SensitivityAnalysisModal({
  open,
  loading,
  data,
  businessType,
  onClose,
}) {
  const alert = useAlert();
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
  const tradeLabel = isTanker ? 'Tankers' : 'Dry Bulk';

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
      await alert({
        title: 'Success',
        message: 'Estimate updated successfully.',
        confirmLabel: 'OK',
      });
    } catch (error) {
      await alert({
        title: 'Error',
        message: error.message || 'Failed to update estimate.',
        confirmLabel: 'OK',
      });
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
        tradeLabel,
        calculatedAt: new Date().toISOString(),
        columns: columns.map((column) => ({
          ...column,
          metrics: metricsById[column.id] || {},
        })),
      });
    } catch (error) {
      await alert({
        title: 'Error',
        message: error.message || 'Failed to generate PDF.',
        confirmLabel: 'OK',
      });
    } finally {
      setPdfLoading(false);
    }
  };

  if (!open) return null;

  const colCount = Math.max(columns.length, 1);
  const calculatedLabel = new Date().toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const renderAdjustmentInputs = (column, field, onChangeFactory, readOnlyFactory) => {
    const items = column.freightAdjustments?.length
      ? column.freightAdjustments
      : [{ key: 'empty' }];
    return items.map((item, index) => (
      <div key={item.key || index} className={styles.stackItem}>
        {index > 0 ? <hr className={styles.stackDivider} /> : null}
        {item.key === 'empty' ? (
          <span className={styles.colCellEmpty}>—</span>
        ) : (
          <InputCell
            value={
              readOnlyFactory
                ? readOnlyFactory(item)
                : item[field]
            }
            readOnly={Boolean(readOnlyFactory)}
            onChange={(value) => onChangeFactory(column.id, item.key, value)}
          />
        )}
      </div>
    ));
  };

  const renderPortInputs = (column, collection) => {
    const ports = column[collection] || [];
    if (!ports.length) return <span className={styles.colCellEmpty}>—</span>;
    return ports.map((port, index) => (
      <div key={port.key} className={styles.stackItem}>
        {index > 0 ? <hr className={styles.stackDivider} /> : null}
        {port.portName ? <span className={styles.portNameTiny}>{port.portName}</span> : null}
        <InputCell
          value={port.cost}
          onChange={(value) => handlePortChange(column.id, collection, port.key, value)}
        />
      </div>
    ));
  };

  const portNameNote = (collection) => {
    const names = columns
      .flatMap((column) => (column[collection] || []).map((port) => port.portName).filter(Boolean));
    const unique = [...new Set(names)];
    if (!unique.length) return null;
    return (
      <div className={`${styles.row} ${styles.portNote}`}>
        <div className={styles.labelCell}>{unique.join(' / ')}</div>
        {columns.map((column) => (
          <div key={column.id} className={`${styles.colCell} ${styles.spacer}`} />
        ))}
      </div>
    );
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sensitivity-analysis-title"
        style={{ '--cols': colCount }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.chrome}>
          <h4 id="sensitivity-analysis-title" className={styles.chromeTitle}>
            <i className="bi bi-graph-up" /> Sensitivity Analysis
          </h4>
          <div className={styles.chromeActions}>
            <Button
              variant="accent"
              label={pdfLoading ? 'Generating PDF…' : 'Generate PDF'}
              onClick={handleGeneratePdf}
              disabled={pdfLoading || !columns.length}
            />
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
        </div>

        <div className={styles.body}>
          {loading ? (
            <p className={styles.loading}>Please wait...</p>
          ) : (
            <div className={styles.doc}>
              <div className={styles.docInner}>
                <div className={styles.docHeader}>
                  <div>
                    <p className={styles.eyebrow}>Seven Oceans PreFixture Platform</p>
                    <h1 className={styles.docTitle}>Estimate - Sensitivity Analysis</h1>
                  </div>
                  <div className={styles.soLogo}>
                    <SoMark className={styles.soLogoMark} />
                    <div className={styles.soLogoWord}>
                      <b>SEVEN</b>
                      <span>OCEANS</span>
                    </div>
                  </div>
                </div>
                <hr className={styles.headerRule} />

                <div className={styles.overview}>
                  <div className={styles.overviewLabel}>
                    Voyage Comparison
                    <span className={styles.tradeBadge}>{tradeLabel}</span>
                  </div>
                  <div className={styles.overviewBody}>
                    <div className={`${styles.gridRow} ${styles.voyagecard}`}>
                      <div className={styles.labelCell}>Quick&nbsp;Read</div>
                      {columns.map((column, index) => {
                        const metrics = metricsById[column.id] || {};
                        const tce = toNumber(metrics.nettDailyProfit);
                        const pnl = toNumber(metrics.profitLoss);
                        return (
                          <div
                            key={column.id}
                            className={`${styles.colCell} ${index % 2 === 0 ? styles.voy0 : styles.voy1}`}
                          >
                            <span className={styles.voyChip}>
                              Voy
                              {' '}
                              {column.voyageNo || '—'}
                            </span>
                            <div className={styles.vessel}>{column.vesselName || '—'}</div>
                            <div className={styles.qrChipsWrap}>
                              <div className={styles.qrChips}>
                                <div className={`${styles.qrChip} ${tce >= 0 ? styles.qrPos : styles.qrNeg}`}>
                                  <div className={styles.qrLabel}>TCE</div>
                                  <div className={styles.qrValue}>
                                    $
                                    {formatMoney(tce, 0)}
                                  </div>
                                </div>
                                <div className={`${styles.qrChip} ${pnl >= 0 ? styles.qrPos : styles.qrNeg}`}>
                                  <div className={styles.qrLabel}>P&amp;L</div>
                                  <div className={styles.qrValue}>
                                    $
                                    {formatMoney(pnl, 0)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className={`${styles.section} ${styles.themeNavy}`}>
                  <SectionLabel>Vessel OPEX</SectionLabel>

                  {isTanker ? (
                    <>
                      <GroupHeader label="Min Cargo" colCount={colCount} />
                      <EditableRow
                        label="Qty"
                        columns={columns}
                        variant="sub"
                        renderCell={(column) => renderAdjustmentInputs(
                          column,
                          'minCargoQty',
                          (id, key, value) => handleAdjustmentChange(id, key, 'minCargoQty', value),
                        )}
                      />
                      <EditableRow
                        label="Flat Rate"
                        columns={columns}
                        variant="sub"
                        renderCell={(column) => renderAdjustmentInputs(
                          column,
                          'minFlatRate',
                          handleMinFlatRateChange,
                        )}
                      />
                      <EditableRow
                        label="WS"
                        columns={columns}
                        variant="sub"
                        renderCell={(column) => renderAdjustmentInputs(
                          column,
                          'minWSRate',
                          handleMinWSRateChange,
                        )}
                      />

                      <GroupHeader label="Overage" colCount={colCount} />
                      <EditableRow
                        label="Qty"
                        columns={columns}
                        variant="sub"
                        renderCell={(column) => renderAdjustmentInputs(
                          column,
                          'overageQty',
                          (id, key, value) => handleAdjustmentChange(id, key, 'overageQty', value),
                        )}
                      />
                      <EditableRow
                        label="Flat Rate"
                        columns={columns}
                        variant="sub"
                        renderCell={(column) => renderAdjustmentInputs(
                          column,
                          'overageFlatRate',
                          (id, key, value) => handleAdjustmentChange(id, key, 'overageFlatRate', value),
                        )}
                      />
                      <EditableRow
                        label="WS"
                        columns={columns}
                        variant="sub"
                        renderCell={(column) => renderAdjustmentInputs(
                          column,
                          'overageWSRate',
                          (id, key, value) => handleAdjustmentChange(id, key, 'overageWSRate', value),
                        )}
                      />
                      <EditableRow
                        label="Amount"
                        columns={columns}
                        variant="amt"
                        renderCell={(column) => renderAdjustmentInputs(
                          column,
                          'overageAmt',
                          () => {},
                          (item) => formatAmount(
                            calculateFreightAdjustmentAmount(
                              item.overageQty,
                              item.overageFlatRate,
                              item.overageWSRate,
                            ),
                          ),
                        )}
                      />
                    </>
                  ) : (
                    <>
                      <EditableRow
                        label="Freight / MT"
                        columns={columns}
                        renderCell={(column) => (
                          column.chkLumpSum ? (
                            <span className={styles.colCellEmpty}>—</span>
                          ) : (
                            <InputCell
                              value={column.freight}
                              onChange={(value) => updateColumn(column.id, (current) => ({
                                ...current,
                                freight: value,
                              }))}
                            />
                          )
                        )}
                      />
                      <EditableRow
                        label="QTY (MT)"
                        columns={columns}
                        renderCell={(column) => (
                          column.chkLumpSum ? (
                            <span className={styles.colCellEmpty}>—</span>
                          ) : (
                            <InputCell
                              value={column.qty}
                              onChange={(value) => updateColumn(column.id, (current) => ({
                                ...current,
                                qty: value,
                              }))}
                            />
                          )
                        )}
                      />
                    </>
                  )}

                  <EditableRow
                    label="Lumpsum"
                    columns={columns}
                    renderCell={(column) => (
                      column.chkLumpSum ? (
                        <InputCell
                          value={column.lumpsumAmt}
                          onChange={(value) => updateColumn(column.id, (current) => ({
                            ...current,
                            lumpsumAmt: value,
                          }))}
                        />
                      ) : (
                        <span className={styles.colCellEmpty}>—</span>
                      )
                    )}
                  />

                  <EditableRow
                    label="Loading Port"
                    columns={columns}
                    renderCell={(column) => renderPortInputs(column, 'loadPorts')}
                  />
                  {portNameNote('loadPorts')}

                  <EditableRow
                    label="Discharge Port"
                    columns={columns}
                    renderCell={(column) => renderPortInputs(column, 'discPorts')}
                  />
                  {portNameNote('discPorts')}

                  <EditableRow
                    label="Transit Port"
                    columns={columns}
                    renderCell={(column) => renderPortInputs(column, 'transitPorts')}
                  />
                  <EditableRow
                    label="Bunkering Port"
                    columns={columns}
                    renderCell={(column) => renderPortInputs(column, 'bunkeringPorts')}
                  />

                  {bunkerGrades.map((grade) => (
                    <EditableRow
                      key={`price-${grade}`}
                      label={`${grade} (Price/MT)`}
                      columns={columns}
                      renderCell={(column) => {
                        const bunker = column.bunkerExpenses.find((item) => item.grade === grade);
                        if (!bunker || !toNumber(bunker.estPrice)) {
                          return <span className={styles.colCellEmpty}>—</span>;
                        }
                        return (
                          <InputCell
                            value={bunker.estPrice}
                            onChange={(value) => handleBunkerPriceChange(column.id, grade, value)}
                          />
                        );
                      }}
                    />
                  ))}

                  <EditableRow
                    label="Hire/Day ($)"
                    columns={columns}
                    variant="highlight"
                    renderCell={(column) => (
                      <InputCell
                        value={column.hire?.rate}
                        onChange={(value) => handleHireChange(column.id, value)}
                      />
                    )}
                  />
                </div>

                <div className={`${styles.section} ${styles.themeOrange}`}>
                  <SectionLabel>Revenue</SectionLabel>
                  <DisplayRow
                    label="Gross Freight"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.grossFreight))}
                  />
                  <DisplayRow
                    label="Brokerage"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.brokerageAmt))}
                  />
                  <DisplayRow
                    label="Add Comm"
                    values={columns.map((column) => formatAddComm(
                      column.addCommPer,
                      metricsById[column.id]?.addressCommAmt,
                    ))}
                  />
                  <DisplayRow
                    label="Other Income"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.otherIncome))}
                  />
                  <DisplayRow
                    label="Net Receivable"
                    variant="subtotal"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.netReceivable))}
                  />
                </div>

                <div className={`${styles.section} ${styles.themeBlue}`}>
                  <SectionLabel>Cargo Expenses</SectionLabel>
                  <DisplayRow
                    label="Loading Port"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.loadPortCost))}
                  />
                  <DisplayRow
                    label="Discharge Port"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.discPortCost))}
                  />
                  <DisplayRow
                    label="Transit Port"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.transitPortCost))}
                  />
                  <DisplayRow
                    label="Bunkering Port"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.bunkeringPortCost))}
                  />
                  <DisplayRow
                    label="Operational Cost"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.operationalCost))}
                  />
                  <DisplayRow
                    label="Total Cargo Expense"
                    variant="subtotal"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.totalExpense))}
                  />
                </div>

                <div className={`${styles.section} ${styles.themePurple}`}>
                  <SectionLabel>Bunker Expenses</SectionLabel>
                  <p className={styles.sectionCaption}>Qty / Price / Amount</p>
                  {bunkerGrades.map((grade) => (
                    <React.Fragment key={`bunker-${grade}`}>
                      <GroupHeader label={grade} colCount={colCount} />
                      <DisplayRow
                        label="Qty"
                        variant="sub"
                        values={columns.map((column) => {
                          const bunker = metricsById[column.id]?.bunkerExpenses
                            ?.find((item) => item.grade === grade);
                          return toNumber(bunker?.estPrice) ? formatAmount(bunker?.estMt) : '';
                        })}
                      />
                      <DisplayRow
                        label="Price"
                        variant="sub"
                        values={columns.map((column) => {
                          const bunker = metricsById[column.id]?.bunkerExpenses
                            ?.find((item) => item.grade === grade);
                          return toNumber(bunker?.estPrice) ? formatAmount(bunker?.estPrice) : '';
                        })}
                      />
                      <DisplayRow
                        label="Amount"
                        variant="amt"
                        values={columns.map((column) => {
                          const bunker = metricsById[column.id]?.bunkerExpenses
                            ?.find((item) => item.grade === grade);
                          return toNumber(bunker?.estPrice) ? formatAmount(bunker?.estCost) : '';
                        })}
                      />
                    </React.Fragment>
                  ))}
                  <DisplayRow
                    label="Total Bunker Expense"
                    variant="subtotal"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.totalBunkerExpense))}
                  />
                </div>

                <div className={`${styles.section} ${styles.themeBrown}`}>
                  <SectionLabel>Hireage</SectionLabel>
                  <DisplayRow
                    label="Estimated Hire"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.estimatedHire))}
                  />
                </div>

                <div className={styles.results}>
                  <div className={styles.resultsLabel}>Results</div>
                  <div className={styles.resultsBody}>
                    <div className={styles.resultsRow}>
                      <div className={styles.labelCell}>TCE&nbsp;$</div>
                      {columns.map((column) => {
                        const tce = toNumber(metricsById[column.id]?.nettDailyProfit);
                        return (
                          <div
                            key={`${column.id}-tce`}
                            className={`${styles.colCell} ${tce >= 0 ? styles.rcPos : styles.rcNeg}`}
                          >
                            {formatMoney(tce, 2)}
                          </div>
                        );
                      })}
                    </div>
                    <div className={styles.resultsRow}>
                      <div className={styles.labelCell}>P&amp;L&nbsp;$</div>
                      {columns.map((column) => {
                        const pnl = toNumber(metricsById[column.id]?.profitLoss);
                        return (
                          <div
                            key={`${column.id}-pnl`}
                            className={`${styles.colCell} ${pnl >= 0 ? styles.rcPos : styles.rcNeg}`}
                          >
                            {formatMoney(pnl, 2)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className={`${styles.gridRow} ${styles.updateRow}`}>
                  <div className={styles.labelCell} />
                  {columns.map((column) => (
                    <div key={`${column.id}-update`} className={styles.colCell}>
                      <Button
                        variant="accent"
                        size="sm"
                        label={updatingId === column.id ? 'Updating...' : 'Update Estimate'}
                        onClick={() => handleUpdateEstimate(column.id)}
                        disabled={Boolean(updatingId)}
                      />
                    </div>
                  ))}
                </div>

                <div className={styles.footer}>
                  <div className={styles.footerLeft}>
                    Calculated
                    {' '}
                    <b>{calculatedLabel}</b>
                    {' '}
                    — Zafira Shipping &amp; Trading SA
                  </div>
                  <div className={styles.footerRight}>
                    <div className={styles.analysed}>
                      Analysed by
                      {' '}
                      <b>Seven Oceans</b>
                      <br />
                      For more information visit
                      {' '}
                      <a href="https://www.sevenoceans.world" target="_blank" rel="noreferrer">
                        www.sevenoceans.world
                      </a>
                    </div>
                    <SoMark className={styles.miniLogo} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

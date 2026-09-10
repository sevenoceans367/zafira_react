import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAlert, useConfirm } from '@bainbridge/shared-ui';
import { updateSensitivityEstimate, downloadSensitivityAnalysisPdf, sendEstimateToOps } from '../../../services/estimateList.js';
import {
  buildColumnState,
  buildUpdatePayload,
  calculateColumnMetrics,
  calculateRatesFromFlatRate,
  formatAddComm,
  formatAmount,
  formatComma,
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

function clubTransitBunkeringPorts(column) {
  const ports = [
    ...(column.transitPorts || []).map((port) => ({ ...port, collection: 'transitPorts' })),
    ...(column.bunkeringPorts || []).map((port) => ({ ...port, collection: 'bunkeringPorts' })),
  ];
  const groups = [];
  const indexByKey = new Map();
  ports.forEach((port) => {
    const key = String(port.portId || port.portName || port.key || '').trim().toLowerCase();
    if (!key) {
      groups.push({
        key: `solo-${port.collection}-${port.key}`,
        portName: port.portName || '',
        cost: toNumber(port.cost),
        members: [port],
      });
      return;
    }
    if (indexByKey.has(key)) {
      const group = groups[indexByKey.get(key)];
      group.cost += toNumber(port.cost);
      group.members.push(port);
      if (!group.portName && port.portName) group.portName = port.portName;
      return;
    }
    indexByKey.set(key, groups.length);
    groups.push({
      key,
      portName: port.portName || '',
      cost: toNumber(port.cost),
      members: [port],
    });
  });
  return groups;
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function buildSensiRows(kind, column, metrics) {
  const days = Math.max(toNumber(column.hire?.totalDays), 1);
  const baseTce = toNumber(metrics?.nettDailyProfit);
  const bunker = (column.bunkerExpenses || []).find((item) => /vlsfo/i.test(item.grade || ''));
  const adjustment = column.freightAdjustments?.[0] || {};

  if (kind === 'ws') {
    const base = toNumber(adjustment.minWSRate);
    const baseFreight = toNumber(metrics?.grossFreight);
    return Array.from({ length: 11 }, (_, index) => {
      const step = index - 5;
      const x = base + step * 5;
      const freight = base ? baseFreight * (x / base) : baseFreight;
      return { x, tce: baseTce + ((freight - baseFreight) / days), base: step === 0 };
    });
  }

  if (kind === 'lumpsum') {
    const base = toNumber(column.lumpsumAmt);
    // Range ±$5,000 in $1,000 steps (11 points).
    return Array.from({ length: 11 }, (_, index) => {
      const step = index - 5;
      return { x: base + step * 1000, tce: baseTce + ((step * 1000) / days), base: step === 0 };
    });
  }

  const base = toNumber(bunker?.estPrice);
  const qty = toNumber(bunker?.estMt);
  return Array.from({ length: 11 }, (_, index) => {
    const step = index - 5;
    const x = base + step * 10;
    return { x, tce: baseTce - ((qty * step * 10) / days), base: step === 0 };
  });
}

function SensiChart({ rows, color, xLabel, formatX, onTip, onMove, onHide }) {
  if (!rows.length) return null;
  const xs = rows.map((row) => row.x);
  const tces = rows.map((row) => row.tce);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const padY = Math.max(20, (Math.max(...tces) - Math.min(...tces)) * 0.15);
  const y0 = Math.min(...tces) - padY;
  const y1 = Math.max(...tces) + padY;
  const xPx0 = 54;
  const xPx1 = 590;
  const yPx0 = 250;
  const yPx1 = 20;
  const xScale = (xPx1 - xPx0) / ((x1 - x0) || 1);
  const yScale = (yPx1 - yPx0) / ((y1 - y0) || 1);
  const px = (value) => (xPx0 + (value - x0) * xScale).toFixed(1);
  const py = (value) => (yPx0 + (value - y0) * yScale).toFixed(1);
  const pathD = rows.map((row, index) => `${index === 0 ? 'M' : 'L'}${px(row.x)},${py(row.tce)}`).join(' ');
  const gridVals = Array.from({ length: 5 }, (_, index) => y0 + ((y1 - y0) * index) / 4);

  return (
    <svg viewBox="0 0 640 300" width="100%" style={{ maxWidth: 600 }} role="img" aria-label="TCE impact chart">
      {gridVals.map((value) => (
        <g key={value}>
          <line x1={xPx0} y1={py(value)} x2={xPx1} y2={py(value)} stroke="#ECEEF2" strokeWidth="1" />
          <text x={xPx0 - 8} y={Number(py(value)) + 3} textAnchor="end" fontSize="9" fill="#8A93A0">
            {Math.round(value).toLocaleString()}
          </text>
        </g>
      ))}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" />
      {rows.map((row) => (
        <circle
          key={`${row.x}-${row.tce}`}
          cx={px(row.x)}
          cy={py(row.tce)}
          r={row.base ? 5 : 3.5}
          fill={row.base ? '#F4652C' : color}
          stroke="#fff"
          strokeWidth="1.5"
          style={{ cursor: 'pointer' }}
          onMouseEnter={(event) => onTip?.(event, `${formatX(row.x)} → TCE $${Math.round(row.tce).toLocaleString()}/d`)}
          onMouseMove={onMove}
          onMouseLeave={onHide}
        />
      ))}
      {rows.map((row) => (
        <text key={`x-${row.x}`} x={px(row.x)} y={yPx0 + 16} textAnchor="middle" fontSize="8.5" fill="#8A93A0">
          {Number.isInteger(row.x) ? row.x : row.x.toFixed(1)}
        </text>
      ))}
      <text x={(xPx0 + xPx1) / 2} y="292" textAnchor="middle" fontSize="10" fontWeight="700" fill="#57626F">
        {xLabel}
      </text>
      <text x="10" y="14" fontSize="10" fontWeight="700" fill="#57626F">TCE ($/d)</text>
    </svg>
  );
}

function FieldStatus({ status }) {
  if (status !== 'saving' && status !== 'saved') return null;
  return (
    <span className={`${styles.fieldStatus} ${status === 'saved' ? styles.fieldStatusSaved : styles.fieldStatusSaving}`}>
      {status === 'saved' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
          <path d="M21 12a9 9 0 1 1-9-9" />
        </svg>
      )}
    </span>
  );
}

function InputCell({ value, onChange, readOnly = false, disabled = false, status = '' }) {
  return (
    <span className={styles.inputWrap}>
      <input
        className={styles.input}
        value={value ?? ''}
        readOnly={readOnly || disabled}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldStatus status={status} />
    </span>
  );
}

function SensiLink({ title, onClick }) {
  return (
    <button type="button" className={styles.sensiLink} title={title} onClick={onClick}>
      <ChartIcon />
    </button>
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

function GroupHeader({ label, columns = [], colCount, isLocked }) {
  const count = columns.length || colCount;
  return (
    <div className={`${styles.row} ${styles.groupHeader}`}>
      <div className={styles.labelCell}>{label}</div>
      {Array.from({ length: count }).map((_, index) => {
        const column = columns[index];
        const locked = column && isLocked?.(column);
        return (
          <div
            key={column?.id ?? index}
            className={`${styles.colCell} ${styles.spacer} ${locked ? styles.colLocked : ''}`.trim()}
          />
        );
      })}
    </div>
  );
}

function DisplayRow({
  label,
  values,
  columns = [],
  variant = '',
  emptyDash = true,
  isLocked,
}) {
  return (
    <div className={`${styles.row} ${variant ? styles[variant] : ''}`.trim()}>
      <div className={styles.labelCell}>{label}</div>
      {values.map((value, index) => {
        const empty = value === undefined || value === null || value === '';
        const locked = columns[index] && isLocked?.(columns[index]);
        return (
          <div
            key={columns[index]?.id ?? index}
            className={`${styles.colCell} ${empty && emptyDash ? styles.colCellEmpty : ''} ${locked ? styles.colLocked : ''}`.trim()}
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
  isLocked,
}) {
  return (
    <div className={`${styles.row} ${variant ? styles[variant] : ''}`.trim()}>
      <div className={styles.labelCell}>{label}</div>
      {columns.map((column) => (
        <div key={column.id} className={`${styles.colCell} ${isLocked?.(column) ? styles.colLocked : ''}`.trim()}>
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
  onSent,
}) {
  const alert = useAlert();
  const confirm = useConfirm();
  const [columns, setColumns] = useState([]);
  const [bunkerGrades, setBunkerGrades] = useState([]);
  const [updatingId, setUpdatingId] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sentIds, setSentIds] = useState(() => new Set());
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [sensiModal, setSensiModal] = useState(null);
  const [fieldStatus, setFieldStatus] = useState({});
  const [chartTip, setChartTip] = useState(null);
  const downloadRef = useRef(null);
  const columnsRef = useRef([]);
  const metricsRef = useRef({});
  const saveTimers = useRef({});

  useEffect(() => {
    if (!data?.columns?.length) {
      setColumns([]);
      setBunkerGrades([]);
      return;
    }
    setColumns(data.columns.slice(0, 5).map((column) => buildColumnState(column)));
    setBunkerGrades(data.bunkerGrades ?? []);
  }, [data]);

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(0);
    setSentIds(new Set());
    setDownloadOpen(false);
    setSensiModal(null);
    setFieldStatus({});
    setChartTip(null);
  }, [open]);

  useEffect(() => {
    if (!downloadOpen) return undefined;
    const onPointerDown = (event) => {
      if (!downloadRef.current?.contains(event.target)) setDownloadOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [downloadOpen]);

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach((timer) => clearTimeout(timer));
  }, []);

  const resolvedBusinessType = data?.businessType ?? businessType ?? '2';
  const isTanker = String(resolvedBusinessType) === '2';
  const tradeLabel = isTanker ? 'Tankers' : 'Dry Bulk';

  const statusFor = (columnId, fieldKey) => fieldStatus[`${columnId}:${fieldKey}`] || '';

  const queueSave = (columnId, fieldKey) => {
    const column = columnsRef.current.find((item) => String(item.id) === String(columnId));
    if (sentIds.has(String(columnId)) || column?.sentToOps) return;
    const statusKey = `${columnId}:${fieldKey}`;
    setFieldStatus((current) => ({ ...current, [statusKey]: 'saving' }));
    clearTimeout(saveTimers.current[columnId]);
    saveTimers.current[columnId] = setTimeout(async () => {
      const column = columnsRef.current.find((item) => item.id === columnId);
      const metrics = metricsRef.current[columnId];
      if (!column || !metrics) return;
      try {
        await updateSensitivityEstimate(columnId, buildUpdatePayload(column, metrics));
        setFieldStatus((current) => ({ ...current, [statusKey]: 'saved' }));
      } catch (error) {
        setFieldStatus((current) => {
          const next = { ...current };
          delete next[statusKey];
          return next;
        });
        await alert({
          title: 'Error',
          message: error.message || 'Failed to save estimate.',
          confirmLabel: 'OK',
        });
      }
    }, 450);
  };

  const metricsById = useMemo(() => {
    const map = {};
    for (const column of columns) {
      map[column.id] = calculateColumnMetrics(column, resolvedBusinessType);
    }
    return map;
  }, [columns, resolvedBusinessType]);

  columnsRef.current = columns;
  metricsRef.current = metricsById;

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
    queueSave(columnId, `${adjustmentKey}:minFlatRate`);
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
    queueSave(columnId, `${adjustmentKey}:minWSRate`);
  };

  const handleAdjustmentChange = (columnId, adjustmentKey, field, value) => {
    updateColumn(columnId, (column) => ({
      ...column,
      freightAdjustments: column.freightAdjustments.map((item) => (
        item.key === adjustmentKey ? { ...item, [field]: value } : item
      )),
    }));
    queueSave(columnId, `${adjustmentKey}:${field}`);
  };

  const handlePortChange = (columnId, collection, portKey, value) => {
    updateColumn(columnId, (column) => ({
      ...column,
      [collection]: column[collection].map((port) => (
        port.key === portKey ? { ...port, cost: value } : port
      )),
    }));
    queueSave(columnId, `${collection}:${portKey}`);
  };

  const handleClubbedPortChange = (columnId, members, value) => {
    updateColumn(columnId, (column) => {
      const next = { ...column };
      members.forEach((member, index) => {
        const list = [...(next[member.collection] || [])];
        const idx = list.findIndex((port) => port.key === member.key);
        if (idx < 0) return;
        list[idx] = {
          ...list[idx],
          cost: index === 0 ? value : 0,
        };
        next[member.collection] = list;
      });
      return next;
    });
    const first = members[0];
    if (first) queueSave(columnId, `${first.collection}:${first.key}`);
  };

  const handleBunkerPriceChange = (columnId, grade, value) => {
    updateColumn(columnId, (column) => ({
      ...column,
      bunkerExpenses: column.bunkerExpenses.map((item) => (
        item.grade === grade ? { ...item, estPrice: value } : item
      )),
    }));
    queueSave(columnId, `bunker:${grade}`);
  };

  const handleHireChange = (columnId, value) => {
    updateColumn(columnId, (column) => ({
      ...column,
      hire: { ...column.hire, rate: value },
    }));
    queueSave(columnId, 'hire');
  };

  const handleUpdateEstimate = async (columnId) => {
    const column = columns.find((item) => item.id === columnId);
    if (!column) return false;

    const metrics = metricsById[columnId];
    setUpdatingId(columnId);
    try {
      await updateSensitivityEstimate(columnId, buildUpdatePayload(column, metrics));
      return true;
    } catch (error) {
      await alert({
        title: 'Error',
        message: error.message || 'Failed to update estimate.',
        confirmLabel: 'OK',
      });
      return false;
    } finally {
      setUpdatingId('');
    }
  };

  const handleSendToOps = async () => {
    const column = columns[selectedIndex];
    if (!column || sentIds.has(String(column.id)) || column.sentToOps || updatingId) return;

    const label = column.vesselName || column.voyageNo || 'this estimate';
    const ok = await confirm({
      title: 'Send to Operations',
      message: `Are you sure you want to send "${label}" to Operations?`,
      confirmLabel: 'Send to Ops',
      cancelLabel: 'Cancel',
      confirmVariant: 'accent',
    });
    if (!ok) return;

    clearTimeout(saveTimers.current[column.id]);
    const saved = await handleUpdateEstimate(column.id);
    if (!saved) return;

    try {
      await sendEstimateToOps(column.id);
      setSentIds((current) => new Set([...current, String(column.id)]));
      setColumns((current) => current.map((item) => (
        String(item.id) === String(column.id) ? { ...item, sentToOps: true } : item
      )));
      onSent?.(column.id);
    } catch (error) {
      await alert({
        title: 'Error',
        message: error?.message || 'Unable to send this estimate to Operations.',
        confirmLabel: 'OK',
      });
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
  const selectedColumn = columns[selectedIndex] || columns[0];
  const isColumnSent = (column) => Boolean(column) && (sentIds.has(String(column.id)) || Boolean(column.sentToOps));
  const selectedSent = selectedColumn ? isColumnSent(selectedColumn) : false;
  const grades = bunkerGrades.length
    ? bunkerGrades
    : [...new Set(columns.flatMap((column) => (column.bunkerExpenses || []).map((item) => item.grade)).filter(Boolean))];

  const bunkerFor = (column, grade) => (
    (column.bunkerExpenses || []).find((item) => item.grade === grade)
  );
  const isVlsfo = (grade) => /vlsfo/i.test(grade || '');

  const openSensi = (column, kind) => {
    if (isColumnSent(column)) return;
    setSensiModal({
      kind,
      columnId: column.id,
      vessel: column.vesselName || 'Voyage',
    });
  };

  const sensiColumn = sensiModal
    ? columns.find((column) => column.id === sensiModal.columnId)
    : null;
  const sensiRows = sensiColumn
    ? buildSensiRows(sensiModal.kind, sensiColumn, metricsById[sensiColumn.id])
    : [];
  const sensiTitle = sensiModal?.kind === 'ws'
    ? `World Scale Price Sensitivity — ${sensiModal.vessel}`
    : sensiModal?.kind === 'lumpsum'
      ? `Lump Sum Sensitivity — ${sensiModal.vessel}`
      : `VLSFO Price Sensitivity — ${sensiModal?.vessel || ''}`;
  const sensiKind = sensiModal?.kind || 'vlsfo';
  const sensiColor = sensiKind === 'vlsfo' ? '#A9740B' : '#274670';
  const sensiHead = sensiKind === 'ws'
    ? 'WS'
    : sensiKind === 'lumpsum'
      ? 'Lump Sum $'
      : 'VLSFO $/t';
  const sensiXLabel = sensiKind === 'ws'
    ? 'World Scale (points)'
    : sensiKind === 'lumpsum'
      ? 'Lump Sum ($)'
      : 'VLSFO Price ($/t)';
  const sensiBaseValue = sensiColumn
    ? (sensiKind === 'ws'
      ? toNumber(sensiColumn.freightAdjustments?.[0]?.minWSRate)
      : sensiKind === 'lumpsum'
        ? toNumber(sensiColumn.lumpsumAmt)
        : toNumber((sensiColumn.bunkerExpenses || []).find((item) => /vlsfo/i.test(item.grade || ''))?.estPrice))
    : 0;
  const sensiBaseTce = sensiColumn ? toNumber(metricsById[sensiColumn.id]?.nettDailyProfit) : 0;
  const sensiSummary = sensiKind === 'ws'
    ? `Base: WS ${sensiBaseValue.toFixed(2)} → TCE $${Math.round(sensiBaseTce).toLocaleString()}/d. Range ±25 points in 5-point steps.`
    : sensiKind === 'lumpsum'
      ? `Base: $${formatComma(sensiBaseValue, 2)} lump sum → TCE $${Math.round(sensiBaseTce).toLocaleString()}/d. Range ±$5,000 in $1,000 steps.`
      : `Base: $${sensiBaseValue.toFixed(2)}/t VLSFO → TCE $${Math.round(sensiBaseTce).toLocaleString()}/d. Range ±$50/t in $10 steps.`;
  const formatSensiX = (value) => (
    sensiKind === 'ws'
      ? Number(value).toFixed(1)
      : sensiKind === 'lumpsum'
        ? `$${formatComma(value, 2)}`
        : `$${Number(value).toFixed(2)}`
  );

  const renderAdjustmentInputs = (column, field, onChangeFactory, readOnlyFactory, disableLumpsum = false) => {
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
            disabled={(disableLumpsum && column.chkLumpSum) || isColumnSent(column)}
            status={statusFor(column.id, `${item.key}:${field}`)}
            onChange={(value) => onChangeFactory(column.id, item.key, value)}
          />
        )}
      </div>
    ));
  };

  const renderPortInputs = (column, collection) => {
    const ports = column[collection] || [];
    const locked = isColumnSent(column);
    if (!ports.length) return <span className={styles.colCellEmpty}>—</span>;
    return ports.map((port, index) => (
      <div key={port.key} className={styles.stackItem}>
        {index > 0 ? <hr className={styles.stackDivider} /> : null}
        {port.portName ? <span className={styles.portNameTiny}>{port.portName}</span> : null}
        <InputCell
          value={port.cost}
          disabled={locked}
          status={locked ? '' : statusFor(column.id, `${collection}:${port.key}`)}
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
          <div key={column.id} className={`${styles.colCell} ${styles.spacer} ${isColumnSent(column) ? styles.colLocked : ''}`.trim()} />
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
        data-cols={colCount}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.chrome}>
          <h2 id="sensitivity-analysis-title" className={styles.chromeTitle}>
            <svg className={styles.headerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            Estimate - Sensitivity Analysis
          </h2>
          <div className={styles.chromeActions}>
            <div className={styles.downloadWrap} ref={downloadRef}>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Download"
                aria-expanded={downloadOpen}
                onClick={() => setDownloadOpen((current) => !current)}
                disabled={pdfLoading || !columns.length}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v12" />
                  <path d="M7 11l5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
              </button>
              {downloadOpen ? (
                <div className={styles.downloadMenu} role="menu">
                  <button type="button" role="menuitem" onClick={() => { setDownloadOpen(false); handleGeneratePdf(); }}>
                    Download PDF
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setDownloadOpen(false); handleGeneratePdf(); }}>
                    Email PDF
                  </button>
                </div>
              ) : null}
            </div>
            <button type="button" className={`${styles.iconBtn} ${styles.iconBtnClose}`} aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 5l14 14" />
                <path d="M19 5L5 19" />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {loading ? (
            <p className={styles.loading}>Please wait...</p>
          ) : (
            <div className={styles.doc}>
              <div className={styles.docInner}>
                <div className={styles.overview}>
                  <div className={styles.overviewLabel}>
                    <div className={styles.overviewLabelLeft}>Voyage Comparison</div>
                    <div className={styles.overviewActions}>
                      <span className={styles.selectedHint}>
                        Selected:
                        {' '}
                        {selectedColumn?.vesselName || '—'}
                      </span>
                      <button
                        type="button"
                        className={styles.sendOpsBtn}
                        onClick={handleSendToOps}
                        disabled={!selectedColumn || selectedSent || Boolean(updatingId)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12h13" />
                          <path d="M13 6l6 6-6 6" />
                        </svg>
                        {selectedSent ? 'Sent' : updatingId === selectedColumn?.id ? 'Sending…' : 'Send to Ops'}
                      </button>
                    </div>
                  </div>
                  <div className={styles.overviewBody}>
                    <div className={`${styles.gridRow} ${styles.voyagecard}`}>
                      <div className={styles.labelCell} />
                      {columns.map((column, index) => {
                        const metrics = metricsById[column.id] || {};
                        const tce = toNumber(metrics.nettDailyProfit);
                        const pnl = toNumber(metrics.profitLoss);
                        const sent = isColumnSent(column);
                        const selected = index === selectedIndex && !sent;
                        return (
                          <button
                            key={column.id}
                            type="button"
                            className={[
                              styles.colCell,
                              index % 2 === 0 ? styles.voy0 : styles.voy1,
                              selected ? styles.selected : '',
                              sent ? styles.sent : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => {
                              if (!sent) setSelectedIndex(index);
                            }}
                          >
                            <div className={styles.vessel}>{column.vesselName || '—'}</div>
                            <div className={styles.voyEstLine}>
                              {column.voyageNo || '—'}
                              <span className={styles.sep}>·</span>
                              {`EST-${column.id}`}
                            </div>
                            <div className={`${styles.cardMetrics} ${colCount >= 5 ? styles.cardMetricsCompact : ''}`.trim()}>
                              <span className={`${styles.resultsPill} ${index % 2 === 0 ? styles.pillVoy0 : styles.pillVoy1}`}>
                                <span className={styles.rpLabel}>TCE</span>
                                <span className={`${styles.rpValue} ${tce >= 0 ? styles.rcPos : styles.rcNeg}`}>
                                  $
                                  {formatMoney(tce, 0)}
                                </span>
                              </span>
                              <span className={`${styles.resultsPill} ${index % 2 === 0 ? styles.pillVoy0 : styles.pillVoy1}`}>
                                <span className={styles.rpLabel}>P&amp;L</span>
                                <span className={`${styles.rpValue} ${pnl >= 0 ? styles.rcPos : styles.rcNeg}`}>
                                  $
                                  {formatMoney(pnl, 0)}
                                </span>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className={`${styles.section} ${styles.themeNavy}`}>
                  <SectionLabel>Freight Calculations</SectionLabel>

                  {isTanker ? (
                    <>
                      <GroupHeader label="Min Cargo" columns={columns} colCount={colCount} isLocked={isColumnSent} />
                      <EditableRow
                        label="Qty"
                        columns={columns}
                        isLocked={isColumnSent}
                        variant="sub"
                        renderCell={(column) => renderAdjustmentInputs(
                          column,
                          'minCargoQty',
                          (id, key, value) => handleAdjustmentChange(id, key, 'minCargoQty', value),
                          undefined,
                          true,
                        )}
                      />
                      <EditableRow
                        label="Flat Rate"
                        columns={columns}
                        isLocked={isColumnSent}
                        variant="sub"
                        renderCell={(column) => (
                          column.chkLumpSum ? (
                            <InputCell value="" disabled onChange={() => {}} />
                          ) : (
                            renderAdjustmentInputs(
                              column,
                              'minFlatRate',
                              handleMinFlatRateChange,
                            )
                          )
                        )}
                      />
                      <EditableRow
                        label="WS"
                        columns={columns}
                        isLocked={isColumnSent}
                        variant="sub"
                        renderCell={(column) => {
                          if (column.chkLumpSum) {
                            return <InputCell value="" disabled onChange={() => {}} />;
                          }
                          const item = column.freightAdjustments?.[0];
                          if (!item) return <span className={styles.colCellEmpty}>—</span>;
                          return (
                            <div className={styles.withLink}>
                              <InputCell
                                value={item.minWSRate}
                                disabled={isColumnSent(column)}
                                status={isColumnSent(column) ? '' : statusFor(column.id, `${item.key}:minWSRate`)}
                                onChange={(value) => handleMinWSRateChange(column.id, item.key, value)}
                              />
                              {isColumnSent(column) ? null : (
                                <SensiLink
                                  title="View World Scale price sensitivity for this voyage"
                                  onClick={() => openSensi(column, 'ws')}
                                />
                              )}
                            </div>
                          );
                        }}
                      />

                      <GroupHeader label="Overage" columns={columns} colCount={colCount} isLocked={isColumnSent} />
                      <EditableRow
                        label="Qty"
                        columns={columns}
                        isLocked={isColumnSent}
                        variant="sub"
                        renderCell={(column) => renderAdjustmentInputs(
                          column,
                          'overageQty',
                          (id, key, value) => handleAdjustmentChange(id, key, 'overageQty', value),
                          undefined,
                          true,
                        )}
                      />
                      <EditableRow
                        label="Flat Rate"
                        columns={columns}
                        isLocked={isColumnSent}
                        variant="sub"
                        renderCell={(column) => (
                          column.chkLumpSum ? (
                            <InputCell value="" disabled onChange={() => {}} />
                          ) : (
                            renderAdjustmentInputs(
                              column,
                              'overageFlatRate',
                              (id, key, value) => handleAdjustmentChange(id, key, 'overageFlatRate', value),
                            )
                          )
                        )}
                      />
                      <EditableRow
                        label="WS"
                        columns={columns}
                        isLocked={isColumnSent}
                        variant="sub"
                        renderCell={(column) => (
                          column.chkLumpSum ? (
                            <InputCell value="" disabled onChange={() => {}} />
                          ) : (
                            renderAdjustmentInputs(
                              column,
                              'overageWSRate',
                              (id, key, value) => handleAdjustmentChange(id, key, 'overageWSRate', value),
                            )
                          )
                        )}
                      />
                    </>
                  ) : (
                    <>
                      <EditableRow
                        label="Freight / MT"
                        columns={columns}
                        isLocked={isColumnSent}
                        renderCell={(column) => (
                          column.chkLumpSum ? (
                            <span className={styles.colCellEmpty}>—</span>
                          ) : (
                            <InputCell
                              value={column.freight}
                              disabled={isColumnSent(column)}
                              status={isColumnSent(column) ? '' : statusFor(column.id, 'freight')}
                              onChange={(value) => {
                                updateColumn(column.id, (current) => ({
                                  ...current,
                                  freight: value,
                                }));
                                queueSave(column.id, 'freight');
                              }}
                            />
                          )
                        )}
                      />
                      <EditableRow
                        label="QTY (MT)"
                        columns={columns}
                        isLocked={isColumnSent}
                        renderCell={(column) => (
                          <InputCell
                            value={column.qty}
                            disabled={column.chkLumpSum || isColumnSent(column)}
                            status={isColumnSent(column) || column.chkLumpSum ? '' : statusFor(column.id, 'qty')}
                            onChange={(value) => {
                              updateColumn(column.id, (current) => ({
                                ...current,
                                qty: value,
                              }));
                              queueSave(column.id, 'qty');
                            }}
                          />
                        )}
                      />
                    </>
                  )}

                  <EditableRow
                    label="Lumpsum"
                    columns={columns}
                        isLocked={isColumnSent}
                    variant="sub"
                    renderCell={(column) => (
                      column.chkLumpSum ? (
                        <div className={styles.withLink}>
                          <InputCell
                            value={column.lumpsumAmt}
                            disabled={isColumnSent(column)}
                            status={isColumnSent(column) ? '' : statusFor(column.id, 'lumpsum')}
                            onChange={(value) => {
                              updateColumn(column.id, (current) => ({
                                ...current,
                                lumpsumAmt: value,
                              }));
                              queueSave(column.id, 'lumpsum');
                            }}
                          />
                          {isColumnSent(column) ? null : (
                            <SensiLink
                              title="View Lump Sum sensitivity for this voyage"
                              onClick={() => openSensi(column, 'lumpsum')}
                            />
                          )}
                        </div>
                      ) : (
                        <InputCell value="" disabled onChange={() => {}} />
                      )
                    )}
                  />
                </div>

                <div className={`${styles.section} ${styles.themePurple}`}>
                  <SectionLabel>Hireage / Vessel Opex</SectionLabel>
                  <EditableRow
                    label="Hire / Day ($)"
                    columns={columns}
                        isLocked={isColumnSent}
                    renderCell={(column) => (
                      <InputCell
                        value={column.hire?.rate}
                        disabled={isColumnSent(column)}
                        status={isColumnSent(column) ? '' : statusFor(column.id, 'hire')}
                        onChange={(value) => handleHireChange(column.id, value)}
                      />
                    )}
                  />
                  <DisplayRow
                    label="Voyage Days"
                    columns={columns}
                    isLocked={isColumnSent}
                    values={columns.map((column) => (
                      toNumber(column.hire?.totalDays) ? formatAmount(column.hire.totalDays) : ''
                    ))}
                  />
                  <DisplayRow
                    label="Net Hireage"
                    variant="subtotal"
                    columns={columns}
                    isLocked={isColumnSent}
                    values={columns.map((column) => {
                      const total = metricsById[column.id]?.netHireage;
                      return toNumber(total) ? formatAmount(total) : '';
                    })}
                  />
                </div>

                <div className={`${styles.section} ${styles.themeOrange}`}>
                  <SectionLabel>Revenue</SectionLabel>
                  <DisplayRow
                    label="Gross Freight"
                    columns={columns}
                    isLocked={isColumnSent}
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.grossFreight))}
                  />
                  <DisplayRow
                    label="Brokerage"
                    columns={columns}
                    isLocked={isColumnSent}
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.brokerageAmt))}
                  />
                  <DisplayRow
                    label="Add Comm"
                    columns={columns}
                    isLocked={isColumnSent}
                    values={columns.map((column) => formatAddComm(
                      column.addCommPer,
                      metricsById[column.id]?.addressCommAmt,
                    ))}
                  />
                  <DisplayRow
                    label="Other Income"
                    columns={columns}
                    isLocked={isColumnSent}
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.otherIncome))}
                  />
                  <DisplayRow
                    label="Net Receivable"
                    columns={columns}
                    isLocked={isColumnSent}
                    variant="subtotal"
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.netReceivable))}
                  />
                </div>

                <div className={`${styles.section} ${styles.themeBlue}`}>
                  <SectionLabel>OPEX (Sans Brokerage)</SectionLabel>
                  <EditableRow
                    label="Loading Port"
                    columns={columns}
                        isLocked={isColumnSent}
                    renderCell={(column) => renderPortInputs(column, 'loadPorts')}
                  />
                  <EditableRow
                    label="Discharge Port"
                    columns={columns}
                        isLocked={isColumnSent}
                    renderCell={(column) => renderPortInputs(column, 'discPorts')}
                  />
                  <EditableRow
                    label="Transit / Bunkering Port"
                    columns={columns}
                        isLocked={isColumnSent}
                    renderCell={(column) => {
                      const groups = clubTransitBunkeringPorts(column);
                      if (!groups.length) return <span className={styles.colCellEmpty}>—</span>;
                      return groups.map((group, index) => (
                        <div key={group.key} className={styles.stackItem}>
                          {index > 0 ? <hr className={styles.stackDivider} /> : null}
                          {group.portName ? <span className={styles.portNameTiny}>{group.portName}</span> : null}
                          <InputCell
                            value={group.cost || ''}
                            disabled={isColumnSent(column)}
                            status={isColumnSent(column) ? '' : statusFor(column.id, `club:${group.key}`)}
                            onChange={(value) => handleClubbedPortChange(column.id, group.members, value)}
                          />
                        </div>
                      ));
                    }}
                  />
                  <EditableRow
                    label="Total OPEX"
                    columns={columns}
                        isLocked={isColumnSent}
                    renderCell={(column) => (
                      <InputCell
                        value={column.operationalCost}
                        disabled={isColumnSent(column)}
                        status={isColumnSent(column) ? '' : statusFor(column.id, 'opex')}
                        onChange={(value) => {
                          updateColumn(column.id, (current) => ({
                            ...current,
                            operationalCost: value,
                          }));
                          queueSave(column.id, 'opex');
                        }}
                      />
                    )}
                  />
                  <DisplayRow
                    label="Total"
                    variant="subtotal"
                    columns={columns}
                    isLocked={isColumnSent}
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.totalExpense))}
                  />
                </div>

                <div className={`${styles.section} ${styles.themeBrown}`}>
                  <SectionLabel>Bunker Expenses</SectionLabel>
                  {grades.map((grade) => {
                    const vlsfo = isVlsfo(grade);
                    return (
                      <React.Fragment key={`bunker-${grade}`}>
                        <GroupHeader label={grade} columns={columns} colCount={colCount} isLocked={isColumnSent} />
                        <DisplayRow
                          label="Qty"
                          columns={columns}
                          isLocked={isColumnSent}
                          variant="sub"
                          values={columns.map((column) => {
                            const bunker = bunkerFor(column, grade);
                            return bunker ? formatAmount(bunker.estMt) : '';
                          })}
                        />
                        {vlsfo ? (
                          <EditableRow
                            label="Price"
                            columns={columns}
                        isLocked={isColumnSent}
                            variant="sub"
                            renderCell={(column) => {
                              const bunker = bunkerFor(column, grade);
                              if (!bunker) return <span className={styles.colCellEmpty}>—</span>;
                              return (
                                <div className={styles.withLink}>
                                  <InputCell
                                    value={bunker.estPrice}
                                    disabled={isColumnSent(column)}
                                    status={isColumnSent(column) ? '' : statusFor(column.id, `bunker:${grade}`)}
                                    onChange={(value) => handleBunkerPriceChange(column.id, grade, value)}
                                  />
                                  {isColumnSent(column) ? null : (
                                    <SensiLink
                                      title="View VLSFO price sensitivity for this voyage"
                                      onClick={() => openSensi(column, 'vlsfo')}
                                    />
                                  )}
                                </div>
                              );
                            }}
                          />
                        ) : (
                          <EditableRow
                            label="Price"
                            columns={columns}
                        isLocked={isColumnSent}
                            variant="sub"
                            renderCell={(column) => {
                              const bunker = bunkerFor(column, grade);
                              if (!bunker) return <span className={styles.colCellEmpty}>—</span>;
                              return (
                                <InputCell
                                  value={bunker.estPrice}
                                  disabled={isColumnSent(column)}
                                  status={isColumnSent(column) ? '' : statusFor(column.id, `bunker:${grade}`)}
                                  onChange={(value) => handleBunkerPriceChange(column.id, grade, value)}
                                />
                              );
                            }}
                          />
                        )}
                        <DisplayRow
                          label="Amount"
                          columns={columns}
                          isLocked={isColumnSent}
                          variant="amt"
                          values={columns.map((column) => {
                            const bunker = metricsById[column.id]?.bunkerExpenses
                              ?.find((item) => item.grade === grade);
                            return bunker ? formatAmount(bunker.estCost) : '';
                          })}
                        />
                      </React.Fragment>
                    );
                  })}
                  <DisplayRow
                    label="Total"
                    variant="subtotal"
                    columns={columns}
                    isLocked={isColumnSent}
                    values={columns.map((column) => formatAmount(metricsById[column.id]?.totalBunkerExpense))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {sensiModal && sensiColumn ? (
        <div
          className={styles.sensiOverlay}
          role="presentation"
          onClick={(event) => {
            event.stopPropagation();
            setSensiModal(null);
          }}
        >
          <div
            className={styles.sensiModal}
            role="dialog"
            aria-modal="true"
            aria-label={sensiTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.sensiHead} style={{ background: sensiColor }}>
              <h3>
                <span className={styles.sensiHeadIcon}><ChartIcon /></span>
                {sensiTitle}
              </h3>
              <button type="button" className={`${styles.iconBtn} ${styles.iconBtnClose}`} aria-label="Close" onClick={() => { setSensiModal(null); setChartTip(null); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 5l14 14" />
                  <path d="M19 5L5 19" />
                </svg>
              </button>
            </div>
            <div className={styles.sensiBody}>
              <div>
                <p className={styles.sensiSummary}>{sensiSummary}</p>
                <table className={styles.sensiTable} style={{ '--sensi-color': sensiColor }}>
                  <thead>
                    <tr>
                      <th>{sensiHead}</th>
                      <th>TCE $/d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensiRows.map((row) => (
                      <tr key={`${row.x}-${row.tce}`} className={row.base ? styles.sensiBase : ''}>
                        <td>{formatSensiX(row.x)}</td>
                        <td>{`$${formatMoney(row.tce, 0)}/d`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.sensiChartWrap}>
                <p className={styles.sensiChartTitle}>TCE impact across range</p>
                <SensiChart
                  rows={sensiRows}
                  color={sensiColor}
                  xLabel={sensiXLabel}
                  formatX={formatSensiX}
                  onTip={(event, text) => setChartTip({ text, x: event.clientX + 14, y: event.clientY - 12 })}
                  onMove={(event) => setChartTip((current) => (current ? { ...current, x: event.clientX + 14, y: event.clientY - 12 } : current))}
                  onHide={() => setChartTip(null)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {chartTip ? (
        <div className={styles.chartTooltip} style={{ left: chartTip.x, top: chartTip.y }}>
          {chartTip.text}
        </div>
      ) : null}
    </div>
  );
}

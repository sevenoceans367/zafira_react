export const BUSINESS_TYPES = [
  { id: '1', name: 'Gas' },
  { id: '2', name: 'Tanker' },
  { id: '3', name: 'Dry Cargo' },
];

export const ESTIMATE_TYPE_LABELS = {
  1: 'Gas',
  2: 'Tanker',
  3: 'Dry Cargo',
};

export function formatDateDMY(value) {
  if (!value) return '';
  if (value instanceof Date) {
    const d = String(value.getDate()).padStart(2, '0');
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const y = value.getFullYear();
    return `${d}-${m}-${y}`;
  }
  const str = String(value);
  if (str.includes('T')) {
    return formatDateDMY(new Date(str));
  }
  const [y, m, d] = str.split(/[-/]/);
  if (y && m && d) return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  return str;
}

export function getCargoQuantity(row) {
  if (row.estimateType === 1) return row.gasQuantity;
  if (row.estimateType === 2) return row.tankQuantity;
  if (row.qtyTypeRadio === 1) return row.quantity;
  return row.slave7SumQty ?? 0;
}

export function getFreightLabel(row) {
  if (row.estimateType === 1) {
    return row.gasMarket === 1
      ? `Base Freight ${row.gasBaseRate}`
      : `Lumpsum ${row.gasLumsum}`;
  }
  if (row.estimateType === 2) {
    if (row.tankerRadioSingleDis === 1) {
      return row.chkLumpsum === 1 ? `Lumpsum ${row.lumpsumAmt}` : `WS ${row.minWs}`;
    }
    return `Lumpsum ${row.slave10Sum ?? 0}`;
  }
  if (row.qtyTypeRadio === 1) return String(row.freightGross);
  return String(row.slave7SumFreight ?? 0);
}

export function resolvePorts(fcaId, portLegs = {}) {
  const legs = portLegs[fcaId] ?? portLegs[String(fcaId)] ?? {
    load: [],
    discharge: [],
    ballast: [],
  };
  return {
    loadPorts: legs.load,
    dischargePorts: legs.discharge,
    ballastPorts: legs.ballast,
    lpDp: `${legs.load.join(', ')} / ${legs.discharge.join(', ')}`.trim(),
    deliveryPort: legs.ballast.join(', '),
  };
}

export function mapListRow(row, index, portLegs = {}) {
  const ports = resolvePorts(row.fcaId, portLegs);
  const sentToDecisionChart = Boolean(row.comid);

  return {
    id: row.fcaId,
    rowNum: index + 1,
    vesselName: row.vesselName,
    vesselType: row.vesselType,
    vesselDisplay: `${row.vesselName}/ ${row.vesselType}`,
    businessType: ESTIMATE_TYPE_LABELS[row.estimateType],
    estimateType: row.estimateType,
    sheetName: row.voyageName,
    cpDate: formatDateDMY(row.transDate),
    dwt: row.dwt,
    loadPorts: ports.loadPorts,
    dischargePorts: ports.dischargePorts,
    lpDp: ports.lpDp,
    duration: row.totalDays,
    cargoQuantity: getCargoQuantity(row),
    tce: row.dailyEarning,
    dailyTimeCharter: row.dailyVesselOperationExp,
    profitLoss: row.profitLoss,
    charteringPic: row.charteringPicName,
    selectable: !sentToDecisionChart,
    sentToDecisionChart,
    isBenchmark: row.ifBenchmark === 1,
    comid: row.comid || null,
  };
}

export function mapCompareRow(row, index, portLegs = {}) {
  const ports = resolvePorts(row.fcaId, portLegs);
  const dailyNetTce =
    row.totalDays > 0 ? Number((row.profitLoss / row.totalDays).toFixed(2)) : 0;

  return {
    id: row.fcaId,
    rowNum: index + 1,
    vesselName: row.vesselName,
    sheetName: row.voyageName,
    dwt: row.dwt,
    freight: getFreightLabel(row),
    deliveryPort: ports.deliveryPort,
    lpDp: ports.lpDp,
    duration: row.totalDays,
    cargoQuantity: getCargoQuantity(row),
    dailyNetTce,
    profitLoss: row.profitLoss,
  };
}

export const BUSINESS_TYPES = [
  { id: '3', name: 'Dry' },
  { id: '2', name: 'Tankers' },
  { id: '1', name: 'Gas' },
];

export const ESTIMATE_TYPE_LABELS = {
  1: 'Gas',
  2: 'Tankers',
  3: 'Dry',
};

export function formatDateDMY(value) {
  if (!value) return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()) || value.getFullYear() < 1971) return '';
    const d = String(value.getDate()).padStart(2, '0');
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const y = value.getFullYear();
    return `${d}-${m}-${y}`;
  }

  const str = String(value).trim();
  if (!str || str.startsWith('0000-00-00') || str.startsWith('1970-01-01')) return '';
  if (/^0?1[-/]0?1[-/]1970\b/.test(str)) return '';

  // ISO with T
  if (str.includes('T')) {
    return formatDateDMY(new Date(str));
  }

  // MySQL DATETIME: YYYY-MM-DD[ HH:MM[:SS[.mmm]]]
  const wall = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[\sT].*)?$/);
  if (wall) {
    const [, y, m, d] = wall;
    if (Number(y) < 1971) return '';
    return `${d}-${m}-${y}`;
  }

  // Already dd-mm-yyyy (optional time)
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+.*)?$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    if (Number(y) < 1971) return '';
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }

  return str;
}

/** Parse dd-mm-yyyy or yyyy-mm-dd into yyyy-mm-dd for SQL comparisons. */
export function parsePeriodDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  const dmy = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

export function isDateWithinPeriod(value, periodFrom, periodTo) {
  const from = parsePeriodDate(periodFrom);
  const to = parsePeriodDate(periodTo);
  if (!from && !to) return true;

  const date = parsePeriodDate(formatDateDMY(value));
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
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

export function getTce(row) {
  const dailyEarning = Number(row.dailyEarning);
  if (Number.isFinite(dailyEarning) && dailyEarning !== 0) {
    return dailyEarning;
  }

  const netDailyEarning = Number(row.netDailyEarning);
  if (Number.isFinite(netDailyEarning) && netDailyEarning !== 0) {
    return netDailyEarning;
  }

  const profitLoss = Number(row.profitLoss);
  const totalDays = Number(row.totalDays);
  if (totalDays > 0 && Number.isFinite(profitLoss)) {
    return Number((profitLoss / totalDays).toFixed(2));
  }

  return '';
}

export function mapListRow(row, index, portLegs = {}) {
  const ports = resolvePorts(row.fcaId, portLegs);
  const sentToDecisionChart = Boolean(row.comid);

  return {
    id: row.fcaId,
    rowNum: index + 1,
    vesselName: row.vesselName,
    vesselType: row.vesselType,
    voyageNo: row.voyageNo || '',
    vesselDisplay: [
      `${row.vesselName || ''}/ ${row.vesselType || ''}`.trim(),
      row.voyageNo ? String(row.voyageNo) : '',
    ].filter(Boolean).join(' / '),
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
    tce: getTce(row),
    dailyTimeCharter: row.dailyVesselOperationExp,
    profitLoss: row.profitLoss,
    charteringPic: row.charteringPicName,
    selectable: !sentToDecisionChart,
    sentToDecisionChart,
    sentToOps: sentToDecisionChart,
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

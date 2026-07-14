import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { ESTIMATE_TYPE_LABELS, formatDateDMY } from './estimateListMappers.js';

function toDbDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const [d, m, y] = str.split(/[-/]/);
  if (d && m && y) {
    return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
}

function toDbDateTime(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str.startsWith('0000-00-00')) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const datePart = str.slice(0, 10);
    const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const [, h, mi, s = '00'] = timeMatch;
      return `${datePart} ${h.padStart(2, '0')}:${mi}:${String(s).padStart(2, '0')}`;
    }
    return `${datePart} 00:00:00`;
  }
  const m = str.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    const [, d, mo, y, h = '00', mi = '00', s = '00'] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')} ${String(h).padStart(2, '0')}:${mi}:${String(s).padStart(2, '0')}`;
  }
  return str;
}

function formatDateTimeDMY(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (!str || str.startsWith('0000-00-00')) return '';
  const dt = value instanceof Date ? value : new Date(str.includes('T') ? str : str.replace(' ', 'T'));
  if (Number.isNaN(dt.getTime())) return str;
  const d = String(dt.getDate()).padStart(2, '0');
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const y = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${d}-${m}-${y} ${hh}:${mm}`;
}

function numOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function randomId() {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

function mapPortLeg(row, index) {
  return {
    id: row.RANDOMID ?? row.FCA_SLAVEID ?? row.FCA_SLVID ?? `${row.FCAID}-${index}`,
    fromPortId: row.FROM_PORT,
    toPortId: row.TO_PORT,
    fromPortName: row.FROM_PORT_NAME ?? '',
    toPortName: row.TO_PORT_NAME ?? '',
    passageType: row.PASSAGE_TYPE,
    speedType: row.SPEED_TYPE,
    loadQty: row.LOAD_PORT_QTY,
    dischargeQty: row.DISC_PORT_QTY,
    distance: row.DISTANCE ?? '',
    seaDays: row.TOTAL_VOYAGE_DAYS ?? row.SEA_DAYS ?? '',
    seaMargin: row.MARGIN_DISTANCE ?? '5',
    fromArrival: row.FROMARRIVAL ? formatDateTimeDMY(row.FROMARRIVAL) : '',
    fromDeparture: row.FROMDEPARTURE ? formatDateTimeDMY(row.FROMDEPARTURE) : '',
    toArrival: row.TOARRIVAL ? formatDateTimeDMY(row.TOARRIVAL) : '',
    toDeparture: row.TODEPARTURE ? formatDateTimeDMY(row.TODEPARTURE) : '',
    loadPortCost: row.LOAD_PORT_COST ?? '',
    discPortCost: row.DISC_PORT_COST ?? '',
    loadPortRate: row.LOAD_PORT_RATE ?? '',
    discPortRate: row.DISC_PORT_RATE ?? '',
    loadPortTerms: row.LOAD_PORT_TERMS != null ? String(row.LOAD_PORT_TERMS) : '1',
    discPortTerms: row.DISC_PORT_TERMS != null ? String(row.DISC_PORT_TERMS) : '1',
    loadPortWorkDays: row.LOAD_PORT_WORK_DAYS ?? '',
    discPortWorkDays: row.DISC_PORT_WORK_DAYS ?? '',
    loadPortIdleDays: row.LOAD_PORT_IDEAL_DAYS ?? '',
    discPortIdleDays: row.DISC_PORT_IDEAL_DATE ?? '',
    transitIdleDays: row.TRANSIT_PORT_IDLE_DAYS ?? '',
    secaDistance: row.SECA_DISTANCE ?? '',
    nonSecaDistance: row.NON_SECA_DISTANCE ?? '',
    secaDays: row.SECA_DAYS ?? '',
    transitPortCost: row.TRANSIT_PORT_COST ?? '',
    ddcLpEst: row.DDCLP_ESTCOST ?? '',
    ddcDpEst: row.DDCDP_ESTCOST ?? '',
    ddcLpReal: row.DDCLP_REALCOST ?? '',
    ddcDpReal: row.DDCDP_REALCOST ?? '',
    ddcLpNett: row.DDCLP_NETCOST ?? '',
    ddcDpNett: row.DDCDP_NETCOST ?? '',
    demmDaysLp: row.DEMMDAYSLP ?? '',
    demmRateLp: row.DEMMRATELP ?? '',
    demmDaysDp: row.DEMMDAYSDP ?? '',
    demmRateDp: row.DEMMRATEDP ?? '',
    chkLpSeca: Number(row.CHK_LP_SECA) === 1,
    chkDpSeca: Number(row.CHK_DP_SECA) === 1,
  };
}

function mapProfitSharingRow(row, index) {
  return {
    id: row.RANDOMID ?? `ps-${row.FCAID}-${index}`,
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
    percentage: row.PERCENTAGE != null ? String(row.PERCENTAGE) : '',
  };
}

function mapBrokerRow(row, index) {
  return {
    id: row.RANDOMID ?? `brk-${row.FCAID}-${index}`,
    percent: row.BROKAGE_PERCENT ?? '',
    amount: row.BROKAGE_AMT ?? '',
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
    demmPercent: '',
  };
}

function mapBunkerActivityRow(row, index) {
  return {
    id: row.RANDOMID ?? `bact-${row.FCAID}-${index}`,
    activity: row.ACTIVITY ?? 'Cold Wash',
    bunkerGrade: row.BUNKERGRADE ?? 'VLSFO',
    qty: row.QUANTITY ?? '',
    price: row.PRICE ?? '',
    amount: row.AMOUNT ?? '',
  };
}

function mapCargoRow(row, index) {
  return {
    id: row.RANDOMID ?? `cargo-${row.FCAID}-${index}`,
    cargoId: row.CARGOID != null ? String(row.CARGOID) : '',
    cargoName: row.CARGO_NAME ?? '',
    cargoCbm: row.CARGO_CBM ?? '',
    cargoMt: row.CARGO_MT ?? '',
    rateUsdMt: row.RATE_USD_MT ?? '',
    amountUsd: row.AMOUNT_USD ?? '',
    charterer: row.SHIPPER_CHARTER ?? '',
    demAmt: row.DEM_AMT ?? '',
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
    status: row.STATUS ?? 1,
  };
}

function mapBunkerRow(row, index) {
  return {
    id: `bunker-${row.FCAID}-${index}`,
    bunkerGradeId: row.BUNKERGRADEID != null ? String(row.BUNKERGRADEID) : '',
    qty: row.QTY ?? '',
    price: row.PRICE ?? '',
    cost: row.COST ?? '',
    identify: row.IDENTIFY || 'CONSUMPTION',
  };
}

function mapOrcRow(row, index) {
  return {
    id: row.RANDOMID ?? `orc-${row.FCAID}-${index}`,
    costId: row.IDENTY_ID != null ? String(row.IDENTY_ID) : '',
    costName: row.COST_NAME ?? '',
    amount: row.RAW_AMOUNT ?? '',
    amountMt: row.COST_MT ?? '',
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
  };
}

function mapOtherIncomeRow(row, index) {
  return {
    id: row.RANDOMID ?? `oi-${row.FCAID}-${index}`,
    description: row.IDENTY_ID ?? '',
    amount: row.COST ?? '',
    addComm: row.ADDCOMM ?? '',
    netAmount: row.RAW_AMOUNT ?? '',
    vendorId: row.VENDORID != null ? String(row.VENDORID) : '',
  };
}

function mapHireRow(row, index) {
  return {
    id: row.RANDOMID ?? `hire-${row.FCAID}-${index}`,
    hireFrom: row.HIRE_FROM ? formatDateDMY(row.HIRE_FROM) : '',
    hireTo: row.HIRE_TO ? formatDateDMY(row.HIRE_TO) : '',
    hireDays: row.HIRE_DAYS ?? '',
    hireRate: row.HIRE_RATE ?? '',
    hireAmt: row.HIRE_AMT ?? '',
  };
}

function mapSecaBunkerRow(row, index) {
  return {
    id: `seca-${row.FCAID}-${index}`,
    bunkerGradeId: row.BUNKERGRADEID != null ? String(row.BUNKERGRADEID) : '',
    qty: row.EST_MT ?? '',
    price: row.EST_PRICE ?? '',
    cost: row.EST_COST ?? '',
    identify: row.IDENTIFY || 'SECA',
    bunkerType: row.BUNKER_TYPE || 'FO',
    calc: Number(row.CHK_IF_CAL) !== 0,
  };
}

function mapFreightQtyRow(row, index) {
  return {
    id: row.RANDOMID ?? `fq-${row.FCAID}-${index}`,
    vendorId: row.QTY_VENDORID != null ? String(row.QTY_VENDORID) : '',
    agreedGrossFreight: row.AGREED_GROSS_FREIGHT ?? '',
    quantity: row.QUANTITY ?? '',
    grossFreight: row.GROSS_FREIGHT ?? '',
    brokeragePercent: row.BROKERAGE ?? '',
    netBrokerage: row.NET_BROKERAGE ?? '',
    netFreight: row.NET_FREIGHT ?? '',
    netFreightPerMt: row.NET_FREIGHT_PERMT ?? '',
    currencyId: row.CURRENCYID != null ? String(row.CURRENCYID) : '',
    localAgreedFreight: row.AGREED_GROSS_FREIGHT_LOCAL ?? '',
    exchangeRate: row.EXCHANGE_RATE ?? '',
    cargoId: row.CARGO != null ? String(row.CARGO) : '',
  };
}

function mapTankerWsRow(row, index) {
  return {
    id: `ws-${row.FCAID}-${index}`,
    freightSpecs: row.FREIGHT_SPECS ?? '',
    customerId: row.CUSTOMER != null ? String(row.CUSTOMER) : '',
    minCargoQty: row.MIN_CARGO_QTY ?? '',
    oveCargoQty: row.OVE_CARGO_QTY ?? '',
    minFlatRate: row.MIN_FLAT_RATE ?? '',
    oveFlatRate: row.OVE_FLAT_RATE ?? '',
    minWs: row.MIN_WS ?? '',
    oveWs: row.OVE_WS ?? '',
    minDisLeg: row.MIN_DIS_LEG ?? '',
    oveDisLeg: row.OVE_DIS_LEG ?? '',
    minDistance: row.MIN_DISTANCE ?? '',
    oveDistance: row.OVE_DISTANCE ?? '',
    minAmount: row.MIN_AMOUNT ?? '',
    oveAmount: row.OVE_AMOUNT ?? '',
    totalQty: row.TOTAL_QTY ?? '',
    totalAmount: row.TOTAL_AMOUNT ?? '',
  };
}

function mapOffHireRow(row, bunkers = [], index = 0) {
  return {
    id: row.RANDOMID ?? `off-${row.FCAID}-${index}`,
    slave14Id: row.FCA_SLAVE14ID,
    reason: row.OFF_REASON ?? '',
    from: row.OFF_FROM ? formatDateDMY(row.OFF_FROM) : '',
    to: row.OFF_TO ? formatDateDMY(row.OFF_TO) : '',
    days: row.OFF_DAYS ?? '',
    rate: row.HIRE_RATE ?? '',
    amount: row.OFF_HIRE ?? '',
    bunkers: bunkers.map((b, i) => ({
      id: `offb-${b.FCA_SLAVE15ID || i}`,
      bunkerGradeId: b.BUNKERID != null ? String(b.BUNKERID) : '',
      qty: b.BUNKERQTY ?? '',
      price: b.BUNKERPRICE ?? '',
      amount: b.BUNKERAMT ?? '',
      calc: Number(b.CHECK_BUNKER_CAL) !== 0,
    })),
  };
}

function mapPassageLocationRow(row, index) {
  return {
    id: `loc-${row.FCAID}-${index}`,
    fromLocation: row.LOCATION_FROM ?? '',
    toLocation: row.LOCATION_TO ?? '',
    passageType: row.PASSAGE_TYPE != null ? String(row.PASSAGE_TYPE) : '1',
    speedType: row.SPEED_TYPE != null ? String(row.SPEED_TYPE) : '1',
    distance: row.DISTANCE ?? '',
  };
}

function mapConsumptionRow(row, index) {
  return {
    id: `cons-${row.FCAID}-${index}`,
    identify: row.IDENTIFY || 'FO',
    bunkerGradeId: row.BUNKERID != null ? String(row.BUNKERID) : '',
    balSecaFs: row.FO_BALAST_ATSEA_SECA_CONSP_FS ?? '',
    ladSecaFs: row.FO_LADEN_ATSEA_SECA_CONSP_FS ?? '',
    balNonSecaFs: row.FO_BALAST_ATSEA_NONSECA_CONSP_FS ?? '',
    ladNonSecaFs: row.FO_LADEN_ATSEA_NONSECA_CONSP_FS ?? '',
    balSecaSs: row.FO_BALAST_ATSEA_SECA_CONSP_SS ?? '',
    ladSecaSs: row.FO_LADEN_ATSEA_SECA_CONSP_SS ?? '',
    balNonSecaSs: row.FO_BALAST_ATSEA_NONSECA_CONSP_SS ?? '',
    ladNonSecaSs: row.FO_LADEN_ATSEA_NONSECA_CONSP_SS ?? '',
    inPortSecaWorking: row.FO_INPORT_SECA_CONSP_WORKING ?? '',
    inPortNonSecaWorking: row.FO_INPORT_NONSECA_CONSP_WORKING ?? '',
    inPortSecaIdle: row.FO_INPORT_SECA_CONSP_IDLE ?? '',
    inPortNonSecaIdle: row.FO_INPORT_NONSECA_CONSP_IDLE ?? '',
  };
}

function mapInvoiceRow(row, index) {
  return {
    id: `inv-${row.FCAID}-${index}`,
    invoiceId: row.INVOICEID != null ? String(row.INVOICEID) : '',
  };
}

function mapDeliveryBunkerRow(row, index) {
  return {
    id: `delb-${row.FCAID}-${index}`,
    bunkerGradeId: row.BUNKERID != null ? String(row.BUNKERID) : '',
    qty: row.QTY ?? '',
    price: row.PRICE ?? '',
    amount: row.AMOUNT ?? '',
    bunkerDate: row.BUNKER_DATE ? formatDateDMY(row.BUNKER_DATE) : '',
    identity: row.IDENTITY || 'DEL',
  };
}

function mapDisponentRow(row, index) {
  return {
    id: `disp-${row.FCAID}-${index}`,
    name: row.DISPONENT_OWNER ?? '',
  };
}

function mapVoyageEventRow(row, index) {
  return {
    id: `evt-${row.FCAID}-${index}`,
    details: row.EVENT_DETAILS ?? '',
    eventDate: row.EVENT_DATE ? formatDateDMY(row.EVENT_DATE) : '',
  };
}

function parseAttachments(upload, uploadName) {
  const files = String(upload || '').split(',').map((s) => s.trim()).filter(Boolean);
  const names = String(uploadName || '').split(',').map((s) => s.trim());
  return files.map((file, i) => ({
    file,
    name: names[i] || file,
    url: `/attachment/${file}`,
  }));
}

function mapEstimateDetail(
  master,
  portLegs = [],
  cargoRows = [],
  bunkerRows = [],
  brokerageRows = [],
  orcRows = [],
  otherIncomeRows = [],
  hireRows = [],
  secaBunkerRows = [],
  freightQtyRows = [],
  tankerWsRows = [],
  offHireRows = [],
  passageLocations = [],
  consumptionRows = [],
  invoiceRows = [],
  deliveryBunkerRows = [],
  redeliveryBunkerRows = [],
  disponentRows = [],
  voyageEventRows = [],
  bunkerActivityRows = [],
  profitSharingRows = [],
) {
  const estimateType = Number(master.ESTIMATE_TYPE);
  const mappedCargos = cargoRows.map((row, index) => mapCargoRow(row, index));
  const brokerRows = (Array.isArray(brokerageRows) ? brokerageRows : (brokerageRows ? [brokerageRows] : []))
    .map((row, index) => mapBrokerRow(row, index));
  const firstBroker = brokerRows[0] || null;
  const etsFlags = (voyageEventRows || []).find(
    (row) => row.EUETSADDTOF != null || row.FUELEUADDTOF != null,
  ) || {};
  return {
    id: String(master.FCAID),
    periodId: master.PERIODID != null ? String(master.PERIODID) : '',
    fixtureTypeId: Number(master.FIXTURETYPEID) || null,
    estimateType,
    estimateTypeLabel: ESTIMATE_TYPE_LABELS[estimateType] ?? '',
    vesselImoId: master.VESSEL_IMO_ID,
    vesselName: master.VESSEL_NAME ?? '',
    imoNo: master.IMO_NO ?? '',
    vesselType: master.VESSEL_TYPE ?? '',
    flag: master.FLAG ?? '',
    transDate: formatDateDMY(master.TRANS_DATE),
    voyageNo: master.VOYAGE_NO ?? '',
    voyageName: master.VOYAGE_NAME ?? '',
    dwtSummer: master.DWT_SUMMER ?? master.VESSEL_DWT ?? '',
    dwtTropical: master.DWT_TOPICAL ?? '',
    gnrt: master.GNRT ?? '',
    nrt: master.GNRT ? Number((Number(master.GNRT) * 0.7).toFixed(2)) : '',
    loa: master.LOA ?? '',
    tpc: master.TPC ?? '',
    gear: master.GEAR ?? '',
    builtYear: master.BUILD_YEAR ?? master.BUILT_YEAR ?? '',
    beam: master.BEAM ?? '',
    loadable: master.LODABLE ?? master.LOADABLE ?? '',
    stowageFactor: master.SF ?? master.STOWAGE_FACTOR ?? '',
    grainCap: master.GRAIN_CAP ?? '',
    baleCap: master.BALE_CAP ?? '',
    bFullSpeed: master.BFULLSPEED ?? '',
    bEcoSpeed1: master.BECOSPEED1 ?? '',
    bEcoSpeed2: master.BECOSPEED2 ?? '',
    lFullSpeed: master.LFULLSPEED ?? '',
    lEcoSpeed1: master.LECOSPEED1 ?? '',
    lEcoSpeed2: master.LECOSPEED2 ?? '',
    bFoFullSpeed: master.BFOFULLSPEED ?? '',
    lFoFullSpeed: master.LFOFULLSPEED ?? '',
    bDoFullSpeed: master.BDOFULLSPEED ?? '',
    lDoFullSpeed: master.LDOFULLSPEED ?? '',
    pIfoFullSpeed: master.PIFOFULLSPEED ?? '',
    pWfoFullSpeed: master.PWFOFULLSPEED ?? '',
    pIdoFullSpeed: master.PIDOFULLSPEED ?? '',
    pWdoFullSpeed: master.PWDOFULLSPEED ?? '',
    totalDays: master.TOTAL_DAYS ?? '',
    totalDistance: master.TOTAL_DISTANCE ?? '',
    cargoQuantity: master.QUANTITY ?? master.TANK_QUANTITY ?? master.GAS_QUANTITY ?? '',
    dailyEarning: master.DAILY_EARNING ?? '',
    dailyVesselOperationExp: master.DAILY_VESSEL_OPERATION_EXP ?? '',
    vesselDailyOps: master.DAILY_VESSEL_OPERATION_EXP ?? master.VESSELDAILYOPS ?? '',
    profitLoss: master.PROFIT_LOSS ?? '',
    freightGross: master.FREIGHT_GROSS ?? '',
    revenue: master.REVENUES_FREIGHT ?? master.REVENUE ?? master.FREIGHT_GROSS ?? '',
    voyageEarnings: master.VOYAGE_EARNING ?? master.VOYAGE_EARNINGS ?? '',
    totalBunkerCost: master.BUNKER_EXPENSES ?? master.TOTAL_BUNKER_COST ?? '',
    totalPortCost: master.PORT_EXPENSES ?? master.TOTAL_PORT_COST ?? '',
    hireRate: master.HIRE_RATE ?? '',
    hireAmt: master.HIREAGE_AMT ?? master.HIRE_AMT ?? '',
    brokeragePercent: firstBroker?.percent
      ?? master.BROKERAGE_PER ?? master.BROKERAGE_PERCENT ?? '',
    brokerageAmt: firstBroker?.amount ?? master.BROKERAGE_AMT ?? '',
    brokerRows,
    cvePerMonth: master.CVE_AMT ?? '',
    cveAmt: master.CVE_TOTALAMT ?? '',
    ballastBonus: master.BALLAST_BONUS ?? '',
    lumpsum: master.LUMPSUMAMT ?? master.LUMSUM ?? master.LUMPSUM ?? '',
    lumpsumQty: master.WS_QTY ?? master.LUMPSUM_QTY ?? '',
    marketRate: master.CARGO_RATE ?? master.MARKET_RATE ?? '',
    tankerFreightRate: master.CARGO_RATE ?? master.MARKET_RATE ?? '',
    tankType: master.TANKER_RADIO_SINGLE_DIS != null
      ? String(master.TANKER_RADIO_SINGLE_DIS)
      : '1',
    addCommPercent: master.ADDRESS_COMMISSION_PER ?? master.ADD_COMM ?? '',
    addressCommAmt: master.ADDRESS_COMMISSION_AMT ?? '',
    co2Price: master.CO2PRICE ?? '',
    euaPrice: master.EUAPRICE ?? '',
    sdrToUsd: master.SDR_TO_USD ?? '',
    scnt: '',
    timeAllowed: master.TIMEALLOWED ?? master.WORKING_DAYS ?? '',
    laycanStart: master.LAYCAN_START_DATE ? formatDateTimeDMY(master.LAYCAN_START_DATE) : '',
    laycanEnd: master.LAYCAN_FINISH_DATE ? formatDateTimeDMY(master.LAYCAN_FINISH_DATE) : '',
    euEtsAddToFreight: Number(etsFlags.EUETSADDTOF) === 1,
    fuelEuAddToFreight: Number(etsFlags.FUELEUADDTOF) === 1,
    gasBaltic: master.GAS_BALTIC ?? '',
    gasBaseRate: master.GAS_BASE_RATE ?? '',
    addnlPremium: master.ADDNL_PRENIUM ?? '',
    baseRateFloat: master.BASERATE_FLOAT ?? '',
    baseRateFixed: master.BASERATE_FIXED ?? '',
    baseRateAverage: master.BASERATE_AVERAGE ?? '',
    grossFreightFloat: master.GROSS_FREIGHT_FLOAT ?? '',
    grossFreightFixed: master.GROSS_FREIGHT_FIXED ?? '',
    grossFreightAverage: master.GROSS_FREIGHT_AVERAGE ?? '',
    netFreightFloat: master.NETFREIGHT_FLOAT ?? '',
    netFreightFixed: master.NETFREIGHT_FIXED ?? '',
    netFreightAverage: master.NETFREIGHT_AVERAGE ?? '',
    tceFloat: master.TCEEARNING_FLOAT ?? '',
    tceFixed: master.TCEEARNING_FIXED ?? '',
    tceAverage: master.TCEEARNING_AVERAGE ?? '',
    notes: master.REMARKS ?? '',
    ownerId: master.OWNER != null ? String(master.OWNER) : '',
    disponentOwner: master.DISPONENT_OWNER ?? '',
    attachments: parseAttachments(master.ATTACHMENT, master.ATTACHMENT_NAME),
    charteringTeam: '7',
    charteringPic: master.CHARTERING_PIC != null ? String(master.CHARTERING_PIC) : '',
    charteringPicName: master.CHARTERING_PIC_NAME ?? '',
    comid: master.COMID || null,
    fixed: Number(master.FIXED) === 1,
    portLegs: portLegs.map((row, index) => mapPortLeg(row, index)),
    cargoRows: mappedCargos.filter((row) => Number(row.status) === 1 || !row.status),
    overageCargoRows: mappedCargos.filter((row) => Number(row.status) === 2),
    deadfreightCargoRows: mappedCargos.filter((row) => Number(row.status) === 3),
    bunkerRows: bunkerRows.map((row, index) => mapBunkerRow(row, index)),
    bunkerActivityRows: bunkerActivityRows.map((row, index) => mapBunkerActivityRow(row, index)),
    orcRows: orcRows.map((row, index) => mapOrcRow(row, index)),
    otherIncomeRows: otherIncomeRows.map((row, index) => mapOtherIncomeRow(row, index)),
    hireRows: hireRows.map((row, index) => mapHireRow(row, index)),
    secaBunkerRows: secaBunkerRows.map((row, index) => mapSecaBunkerRow(row, index)),
    freightQtyRows: freightQtyRows.map((row, index) => mapFreightQtyRow(row, index)),
    tankerWsRows: tankerWsRows.map((row, index) => mapTankerWsRow(row, index)),
    offHireRows,
    passageLocations: passageLocations.map((row, index) => mapPassageLocationRow(row, index)),
    consumptionRows: consumptionRows.map((row, index) => mapConsumptionRow(row, index)),
    invoiceRows: invoiceRows.map((row, index) => mapInvoiceRow(row, index)),
    deliveryBunkerRows: deliveryBunkerRows.map((row, index) => mapDeliveryBunkerRow(row, index)),
    redeliveryBunkerRows: redeliveryBunkerRows.map((row, index) => mapDeliveryBunkerRow(row, index)),
    disponentRows: disponentRows.length
      ? disponentRows.map((row, index) => mapDisponentRow(row, index))
      : (master.DISPONENT_OWNER
        ? [{ id: 'disp-master', name: master.DISPONENT_OWNER }]
        : []),
    voyageEventRows: voyageEventRows
      .filter((row) => row.EVENT_DETAILS || row.EVENT_DATE)
      .map((row, index) => mapVoyageEventRow(row, index)),
    profitSharingRows: profitSharingRows.map((row, index) => mapProfitSharingRow(row, index)),
  };
}

const HEADER_UPDATE_FIELDS = {
  fixtureTypeId: 'FIXTURETYPEID',
  vesselType: 'VESSEL_TYPE',
  flag: 'FLAG',
  transDate: 'TRANS_DATE',
  voyageNo: 'VOYAGE_NO',
  voyageName: 'VOYAGE_NAME',
  dwtSummer: 'DWT_SUMMER',
  gnrt: 'GNRT',
};

export async function dbGetEstimateLookups(estimateType = 2) {
  const pool = getPool();
  const type = Number(estimateType) || 2;

  const [cargos] = await pool.query(
    `SELECT MATERIALID AS id, MATERIAL_CODE_DESC AS name
     FROM cargo_master
     WHERE STATUS = 1
       AND (MATERIAL_TYPEID = ? OR MATERIAL_TYPEID IS NULL OR MATERIAL_TYPEID = '')
     ORDER BY MATERIAL_CODE_DESC
     LIMIT 500`,
    [type],
  );

  let cargoRows = cargos;
  if (!cargoRows.length) {
    const [allCargos] = await pool.query(
      `SELECT MATERIALID AS id, MATERIAL_CODE_DESC AS name
       FROM cargo_master
       WHERE STATUS = 1
       ORDER BY MATERIAL_CODE_DESC
       LIMIT 500`,
    );
    cargoRows = allCargos;
  }

  const [bunkerGrades] = await pool.query(
    `SELECT BUNKERGRADEID AS id, NAME AS name, BUNKERTYPE,
            CO2_FAC, PENALITY, INTENSITY_2026, GHG_2026, RATE_2026,
            INTENSITY_2025, GHG_2025, RATE_2025
     FROM bunker_grade_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  const [ownerCosts] = await pool.query(
    `SELECT OWNER_RCOSTID AS id, NAME AS name
     FROM owner_related_cost_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  const [owners] = await pool.query(
    `SELECT VENDORID AS id, NAME, CODE
     FROM vendor_master
     WHERE STATUS = 1
       AND MCOMPANYID = ?
     ORDER BY NAME
     LIMIT 500`,
    [appContext.companyId],
  );

  const [ownBusiness] = await pool.query(
    `SELECT VENDORID AS id, NAME, CODE
     FROM vendor_master
     WHERE STATUS = 1
       AND VENDOR_TYPEID = 11
       AND MCOMPANYID = ?
     ORDER BY NAME
     LIMIT 500`,
    [appContext.companyId],
  );

  const [charteringPics] = await pool.query(
    `SELECT LOGINID AS id, CONTACT_PERSON AS name
     FROM login
     WHERE STATUS = 1
       AND USER_TYPE IN ('internal_user', 'mgmt_user')
       AND LOGINID != 126
     ORDER BY CONTACT_PERSON`,
  );

  const [periodContracts] = await pool.query(
    `SELECT PERIODID AS id, CONTRACT_ID, CONTRACT_NO
     FROM period_contract_master
     WHERE MODULEID = ?
       AND MCOMPANYID = ?
     ORDER BY CONTRACT_DATE DESC
     LIMIT 500`,
    [appContext.moduleId, appContext.companyId],
  );

  const year = new Date().getFullYear();
  const intensityKey = `INTENSITY_${year}`;
  const ghgKey = `GHG_${year}`;
  const rateKey = `RATE_${year}`;

  const complianceFactors = { HSFO: null, VLSFO: null, LSMGO: null };
  for (const row of bunkerGrades) {
    const name = String(row.name || '').toUpperCase();
    let key = null;
    if (name.includes('HSFO')) key = 'HSFO';
    else if (name.includes('VLSFO') || name.includes('VLFO')) key = 'VLSFO';
    else if (name.includes('LSMGO') || name === 'MGO' || name.includes('MGO')) key = 'LSMGO';
    if (!key || complianceFactors[key]) continue;
    complianceFactors[key] = {
      co2Fac: Number(row.CO2_FAC) || 0,
      penalty: Number(row.PENALITY) || 0,
      intensity: Number(row[intensityKey] ?? row.INTENSITY_2026 ?? row.INTENSITY_2025) || 0,
      ghgRate: Number(row[ghgKey] ?? row.GHG_2026 ?? row.GHG_2025) || 0,
      euaCo2Rate: Number(row[rateKey] ?? row.RATE_2026 ?? row.RATE_2025) || 0,
    };
  }

  const mapVendor = (row) => ({
    id: String(row.id),
    name: `${row.NAME ?? ''} ( ${row.CODE ?? ''} )`,
  });

  return {
    cargos: cargoRows.map((row) => ({ id: String(row.id), name: row.name ?? '' })),
    bunkerGrades: bunkerGrades.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
      bunkerType: row.BUNKERTYPE ?? '',
    })),
    ownerCosts: ownerCosts.map((row) => ({ id: String(row.id), name: row.name ?? '' })),
    owners: owners.map(mapVendor),
    ownBusiness: (ownBusiness.length ? ownBusiness : owners).map(mapVendor),
    charteringTeams: [{ id: '7', name: 'Zafira' }],
    charteringPics: charteringPics.map((row) => ({
      id: String(row.id),
      name: row.name ?? '',
    })),
    periodContracts: periodContracts.map((row) => ({
      id: String(row.id),
      label: `${row.CONTRACT_ID || ''}${row.CONTRACT_NO ? ` (${row.CONTRACT_NO})` : ''}`.trim(),
    })),
    complianceFactors,
    complianceYear: year,
    marketPrices: {
      vlsfo: process.env.OIL_PRICE_VLSFO || '',
      marineGasOil: process.env.OIL_PRICE_MGO || '',
      euaPrice: (() => {
        const euCarbon = Number(process.env.EUA_CARBON_EUR) || 0;
        const euToUsd = Number(process.env.EUA_TO_USD) || Number(process.env.EUR_USD) || 0;
        if (euCarbon && euToUsd) return String(Math.round(euCarbon * euToUsd * 100) / 100);
        return process.env.EUA_PRICE_USD || '';
      })(),
      sdrToUsd: process.env.SDR_TO_USD || '1.35',
    },
  };
}

export async function dbGetPeriodPrefill(periodId) {
  const pool = getPool();
  const id = String(periodId || '').trim();
  if (!id) return null;

  const [[period]] = await pool.query(
    `SELECT PERIODID, BROKERAGE, ADD_COMM, VESSEL_IMO_ID, HIRE
     FROM period_contract_master
     WHERE PERIODID = ?
     LIMIT 1`,
    [id],
  );
  if (!period) return null;

  let vesselName = '';
  if (period.VESSEL_IMO_ID) {
    const [[vessel]] = await pool.query(
      `SELECT VESSEL_NAME FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? LIMIT 1`,
      [period.VESSEL_IMO_ID],
    );
    vesselName = vessel?.VESSEL_NAME || '';
  }

  const [hireRows] = await pool.query(
    `SELECT HIRE_FROM, HIRE_TO, HIRE_RATE, HIRE_DAYS
     FROM period_contract_master_slave4
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  );

  const [bunkerRows] = await pool.query(
    `SELECT BUNKERGRADEID, BUNKER_DATE, BUNKER_QTY, BUNKER_AMT, BUNKER_PRICE, IDENTITY
     FROM period_contract_master_slave1
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  );

  const [offHireRows] = await pool.query(
    `SELECT PERIOD_SLAVEID, OFF_HIRE_REASON, OFF_HIRE_FROM, OFF_HIRE_TO,
            OFF_HIRE_DAYS, OFF_HIRE_RATE, OFF_HIRE_AMT
     FROM period_contract_master_slave2
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  );

  const offHireDetails = [];
  for (const row of offHireRows) {
    const [bunkers] = await pool.query(
      `SELECT BUNKERGRADEID, BUNKER_QTY, BUNKER_PRICE, BUNKER_AMT, CHK_OWNER_ACCOUNT
       FROM period_contract_master_slave21
       WHERE PERIODID = ? AND PERIOD_SLAVEID = ?`,
      [id, row.PERIOD_SLAVEID],
    );
    offHireDetails.push({
      reason: row.OFF_HIRE_REASON || '',
      from: formatPeriodDateTime(row.OFF_HIRE_FROM),
      to: formatPeriodDateTime(row.OFF_HIRE_TO),
      days: row.OFF_HIRE_DAYS != null ? String(row.OFF_HIRE_DAYS) : '',
      rate: row.OFF_HIRE_RATE != null ? String(row.OFF_HIRE_RATE) : '',
      amount: row.OFF_HIRE_AMT != null ? String(row.OFF_HIRE_AMT) : '',
      bunkers: bunkers.map((b) => ({
        bunkerGradeId: b.BUNKERGRADEID != null ? String(b.BUNKERGRADEID) : '',
        qty: b.BUNKER_QTY != null ? String(b.BUNKER_QTY) : '',
        price: b.BUNKER_PRICE != null ? String(b.BUNKER_PRICE) : '',
        amount: b.BUNKER_AMT != null ? String(b.BUNKER_AMT) : '',
        calc: String(b.CHK_OWNER_ACCOUNT) === '1',
      })),
    });
  }

  const firstHire = hireRows[0];
  return {
    periodId: id,
    vesselImoId: period.VESSEL_IMO_ID != null ? String(period.VESSEL_IMO_ID) : '',
    vesselName,
    brokeragePercent: period.BROKERAGE != null ? String(period.BROKERAGE) : '',
    addCommPercent: period.ADD_COMM != null ? String(period.ADD_COMM) : '',
    hireRate: firstHire?.HIRE_RATE != null
      ? String(firstHire.HIRE_RATE)
      : (period.HIRE != null ? String(period.HIRE) : ''),
    hireRows: hireRows.map((row) => ({
      hireFrom: formatPeriodDateTime(row.HIRE_FROM),
      hireTo: formatPeriodDateTime(row.HIRE_TO),
      hireDays: row.HIRE_DAYS != null ? String(row.HIRE_DAYS) : '',
      hireRate: row.HIRE_RATE != null ? String(row.HIRE_RATE) : '',
      hireAmt: '',
    })),
    deliveryBunkerRows: bunkerRows
      .filter((row) => String(row.IDENTITY || '').toUpperCase() === 'DEL')
      .map((row) => ({
        bunkerGradeId: row.BUNKERGRADEID != null ? String(row.BUNKERGRADEID) : '',
        bunkerDate: formatPeriodDate(row.BUNKER_DATE),
        qty: row.BUNKER_QTY != null ? String(row.BUNKER_QTY) : '',
        price: row.BUNKER_PRICE != null ? String(row.BUNKER_PRICE) : '',
        amount: row.BUNKER_AMT != null ? String(row.BUNKER_AMT) : '',
        identity: 'DEL',
      })),
    redeliveryBunkerRows: bunkerRows
      .filter((row) => String(row.IDENTITY || '').toUpperCase() === 'REDEL')
      .map((row) => ({
        bunkerGradeId: row.BUNKERGRADEID != null ? String(row.BUNKERGRADEID) : '',
        bunkerDate: formatPeriodDate(row.BUNKER_DATE),
        qty: row.BUNKER_QTY != null ? String(row.BUNKER_QTY) : '',
        price: row.BUNKER_PRICE != null ? String(row.BUNKER_PRICE) : '',
        amount: row.BUNKER_AMT != null ? String(row.BUNKER_AMT) : '',
        identity: 'REDEL',
      })),
    offHireRows: offHireDetails,
  };
}

function formatPeriodDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1972) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatPeriodDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1972) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export async function dbGetEstimateDetail(id) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT m.*, v.VESSEL_NAME, v.IMO_NO, v.DWT AS VESSEL_DWT,
            l.CONTACT_PERSON AS CHARTERING_PIC_NAME
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN login l ON l.LOGINID = m.CHARTERING_PIC
     WHERE m.FCAID = ?
       AND m.MODULEID = ?
       AND m.MCOMPANYID = ?`,
    [id, appContext.moduleId, appContext.companyId],
  );

  if (!rows.length) return null;

  const [legs] = await pool.query(
    `SELECT s.*,
            fp.PortName AS FROM_PORT_NAME,
            tp.PortName AS TO_PORT_NAME
     FROM freight_cost_estimete_slave1 s
     LEFT JOIN port_master fp ON fp.PortId = s.FROM_PORT
     LEFT JOIN port_master tp ON tp.PortId = s.TO_PORT
     WHERE s.FCAID = ?
     ORDER BY s.FCA_SLAVEID ASC`,
    [id],
  );

  const [cargos] = await pool.query(
    `SELECT s.*, cm.MATERIAL_CODE_DESC AS CARGO_NAME
     FROM freight_cost_estimete_slave10 s
     LEFT JOIN cargo_master cm ON cm.MATERIALID = s.CARGOID
     WHERE s.FCAID = ?
     ORDER BY s.STATUS ASC`,
    [id],
  );

  const [bunkers] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave8 WHERE FCAID = ?`,
    [id],
  );

  const [brokerageRows] = await pool.query(
    `SELECT BROKAGE_PERCENT, BROKAGE_AMT, VENDORID, RANDOMID, FCAID
     FROM freight_cost_estimete_slave4
     WHERE FCAID = ?`,
    [id],
  );

  const [orcRows] = await pool.query(
    `SELECT s.*, o.NAME AS COST_NAME
     FROM freight_cost_estimete_slave3 s
     LEFT JOIN owner_related_cost_master o ON o.OWNER_RCOSTID = s.IDENTY_ID
     WHERE s.FCAID = ?
       AND s.IDENTIFY = 'ORC'`,
    [id],
  );

  const [otherIncomeRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave3
     WHERE FCAID = ?
       AND IDENTIFY = 'OTHERINCOME'`,
    [id],
  );

  const [hireRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave17 WHERE FCAID = ?`,
    [id],
  );

  const [secaBunkerRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave2 WHERE FCAID = ?`,
    [id],
  );

  const [freightQtyRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave7 WHERE FCAID = ?`,
    [id],
  );

  const [tankerWsRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave12 WHERE FCAID = ?`,
    [id],
  );

  const [offHireMasterRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave14 WHERE FCAID = ?`,
    [id],
  );

  const [offHireBunkerRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave15 WHERE FCAID = ?`,
    [id],
  );

  const offHireRows = offHireMasterRows.map((row, index) => {
    const bunkers = offHireBunkerRows.filter(
      (b) => String(b.FCA_SLAVE14ID) === String(row.FCA_SLAVE14ID),
    );
    return mapOffHireRow(row, bunkers, index);
  });

  const [passageLocations] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave6 WHERE FCAID = ?`,
    [id],
  );

  const [consumptionRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave16 WHERE FCAID = ?`,
    [id],
  );

  const [invoiceRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave11 WHERE FCAID = ?`,
    [id],
  );

  const [deliveryAll] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave13 WHERE FCAID = ?`,
    [id],
  );
  const deliveryBunkerRows = deliveryAll.filter((row) => row.IDENTITY === 'DEL');
  const redeliveryBunkerRows = deliveryAll.filter((row) => row.IDENTITY === 'REDEL');

  const [disponentRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave5 WHERE FCAID = ?`,
    [id],
  );

  const [voyageEventRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave18 WHERE FCAID = ?`,
    [id],
  );

  let bunkerActivityRows = [];
  try {
    const [activityRows] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave19 WHERE FCAID = ?`,
      [id],
    );
    bunkerActivityRows = activityRows;
  } catch {
    bunkerActivityRows = [];
  }

  let profitSharingRows = [];
  try {
    const [psRows] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave20 WHERE FCAID = ?`,
      [id],
    );
    profitSharingRows = psRows;
  } catch {
    profitSharingRows = [];
  }

  return mapEstimateDetail(
    rows[0],
    legs,
    cargos,
    bunkers,
    brokerageRows,
    orcRows,
    otherIncomeRows,
    hireRows,
    secaBunkerRows,
    freightQtyRows,
    tankerWsRows,
    offHireRows,
    passageLocations,
    consumptionRows,
    invoiceRows,
    deliveryBunkerRows,
    redeliveryBunkerRows,
    disponentRows,
    voyageEventRows,
    bunkerActivityRows,
    profitSharingRows,
  );
}

export async function dbSearchVessels(query) {
  const term = String(query || '').trim();
  if (term.length < 2) return [];

  const pool = getPool();
  const like = `%${term}%`;
  const [rows] = await pool.query(
    `SELECT VESSEL_IMO_ID, VESSEL_NAME, IMO_NO, DWT, VESSEL_TYPE, FLAG, LOA, GRT_NRT
     FROM vessel_imo_master
     WHERE VESSEL_NAME LIKE ? OR IMO_NO LIKE ?
     ORDER BY VESSEL_NAME
     LIMIT 25`,
    [like, like],
  );

  return rows.map((row) => ({
    id: String(row.VESSEL_IMO_ID),
    name: `${row.VESSEL_NAME ?? ''} (${row.IMO_NO ?? ''})`.trim(),
    vesselName: row.VESSEL_NAME ?? '',
    imoNo: row.IMO_NO ?? '',
    dwt: row.DWT ?? '',
    vesselType: row.VESSEL_TYPE ?? '',
    flag: row.FLAG ?? '',
    loa: row.LOA ?? '',
    gnrt: row.GRT_NRT ?? '',
  }));
}

function strOrEmpty(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Prefill estimate header / speed / consumption from fleet vessel + commercial parameters.
 * Mirrors PHP options.php?id=42 used by addestimate.php getData().
 */
export async function dbGetVesselEstimatePrefill(vesselId) {
  const pool = getPool();
  const id = String(vesselId || '').trim();
  if (!id) return null;

  const [vesselRows] = await pool.query(
    `SELECT vim.VESSEL_IMO_ID, vim.VESSEL_NAME, vim.IMO_NO, vim.DWT, vim.VESSEL_TYPE,
            vim.BUSINESSTYPEID, vim.FLAG, vim.SHIP_FLAG, vim.LOA, vim.EXT_BREADTH,
            vim.GRT_NRT, vim.NRT, vim.YEARBUILT, vim.CARGO_GEAR, vim.GRAIN, vim.BALE,
            vim.DRAFTM, vt.VesselType AS vesselTypeName, cm.COUNTRY_NAME AS flagName
     FROM vessel_imo_master vim
     LEFT JOIN vessel_type_master vt ON vt.VesselTypeId = vim.VESSEL_TYPE
     LEFT JOIN country_master cm ON cm.COUNTRYID = vim.FLAG
     WHERE vim.VESSEL_IMO_ID = ?
     LIMIT 1`,
    [id],
  );
  const vessel = vesselRows[0];
  if (!vessel) return null;

  const businessTypeId = Number(vessel.BUSINESSTYPEID) || 2;

  let tpc = '';
  let dwtTropical = '';
  if (businessTypeId === 3) {
    const [dryRows] = await pool.query(
      `SELECT TPC_MT, TROPICAL_1, SUMMER_3
       FROM vessel_master_1
       WHERE VESSEL_IMO_ID = ?
       LIMIT 1`,
      [id],
    );
    tpc = strOrEmpty(dryRows[0]?.TPC_MT || dryRows[0]?.SUMMER_3);
    dwtTropical = strOrEmpty(dryRows[0]?.TROPICAL_1);
  } else {
    const [tankerRows] = await pool.query(
      `SELECT TPC_SUMMER
       FROM vessel_master_tankers
       WHERE VESSEL_IMO_ID = ?
       LIMIT 1`,
      [id],
    );
    tpc = strOrEmpty(tankerRows[0]?.TPC_SUMMER);
  }

  const [paramRows] = await pool.query(
    `SELECT *
     FROM vessel_commercial_parameters
     WHERE VESSEL_IMO_ID = ? AND MODULEID = ?
     LIMIT 1`,
    [id, appContext.moduleId],
  );
  const param = paramRows[0] || null;
  const commercialParameterId = param?.COMMERCIAL_PARAMETERID || null;

  let atSea = [];
  let inPort = [];
  let various = [];
  if (commercialParameterId) {
    const [slaveRows] = await pool.query(
      `SELECT *
       FROM vessel_commercial_parameters_slave1
       WHERE COMMERCIAL_PARAMETERID = ?
       ORDER BY BUNKERID, FO_TYPE, ZONE`,
      [commercialParameterId],
    );
    atSea = slaveRows.filter((row) => row.FO_TYPE === 'AT SEA');
    inPort = slaveRows.filter((row) => row.FO_TYPE === 'IN PORT');
    various = slaveRows.filter((row) => row.FO_TYPE === 'VARIOUS');
  }

  const variousBunkerIds = [...new Set(various.map((row) => row.BUNKERID).filter(Boolean))];
  let bunkerNameById = {};
  if (variousBunkerIds.length) {
    const [gradeRows] = await pool.query(
      `SELECT BUNKERGRADEID, NAME FROM bunker_grade_master WHERE BUNKERGRADEID IN (?)`,
      [variousBunkerIds],
    );
    bunkerNameById = Object.fromEntries(
      gradeRows.map((row) => [String(row.BUNKERGRADEID), row.NAME || '']),
    );
  }

  const pickVarious = (row, secaField, nonSecaField) => {
    const isSeca = String(row.ZONE || '').toLowerCase() === 'seca';
    return strOrEmpty(isSeca ? row[secaField] : row[nonSecaField]);
  };

  const variousBunkerRates = various.map((row) => ({
    bunkerId: row.BUNKERID != null ? String(row.BUNKERID) : '',
    bunkerName: bunkerNameById[String(row.BUNKERID)] || '',
    zone: row.ZONE || 'Non Seca',
    coldWash: pickVarious(row, 'FO_OTHER_SECA_CONSP_TK', 'FO_OTHER_NONSECA_CONSP_TK'),
    hotWash: pickVarious(row, 'FO_OTHER_SECA_CONSP_INERT', 'FO_OTHER_NONSECA_CONSP_INERT'),
    inertGasFree: pickVarious(row, 'FO_OTHER_SECA_CONSP_GF', 'FO_OTHER_NONSECA_CONSP_GF'),
    purgeGasFree: pickVarious(row, 'FO_OTHER_SECA_CONSP_HEAT', 'FO_OTHER_NONSECA_CONSP_HEAT'),
    heatingMaintain: strOrEmpty(row.FO_OTHER_SECA_CONSP_HEAT_1),
    heatingRaise: strOrEmpty(row.FO_OTHER_NONSECA_CONSP_HEAT_1),
  }));

  // Merge Non-Seca + Seca AT SEA / IN PORT by bunker+identify (PHP laden_balast_consp + working_idle_consp).
  const bunkerKeys = new Map();
  for (const row of [...atSea, ...inPort]) {
    const key = `${row.BUNKERID || ''}|${row.IDENTIFY || 'FO'}`;
    if (!bunkerKeys.has(key)) {
      bunkerKeys.set(key, {
        bunkerGradeId: row.BUNKERID != null ? String(row.BUNKERID) : '',
        identify: row.IDENTIFY || 'FO',
        balSecaFs: '',
        ladSecaFs: '',
        balNonSecaFs: '',
        ladNonSecaFs: '',
        balSecaSs: '',
        ladSecaSs: '',
        balNonSecaSs: '',
        ladNonSecaSs: '',
        inPortSecaWorking: '',
        inPortNonSecaWorking: '',
        inPortSecaIdle: '',
        inPortNonSecaIdle: '',
      });
    }
    const target = bunkerKeys.get(key);
    const isSeca = String(row.ZONE || '').toLowerCase() === 'seca';
    if (row.FO_TYPE === 'AT SEA') {
      if (isSeca) {
        target.balSecaFs = strOrEmpty(row.FO_BALAST_ATSEA_SECA_CONSP_FS);
        target.ladSecaFs = strOrEmpty(row.FO_LADEN_ATSEA_SECA_CONSP_FS);
        target.balSecaSs = strOrEmpty(row.FO_BALAST_ATSEA_SECA_CONSP_SS);
        target.ladSecaSs = strOrEmpty(row.FO_LADEN_ATSEA_SECA_CONSP_SS);
      } else {
        target.balNonSecaFs = strOrEmpty(row.FO_BALAST_ATSEA_NONSECA_CONSP_FS);
        target.ladNonSecaFs = strOrEmpty(row.FO_LADEN_ATSEA_NONSECA_CONSP_FS);
        target.balNonSecaSs = strOrEmpty(row.FO_BALAST_ATSEA_NONSECA_CONSP_SS);
        target.ladNonSecaSs = strOrEmpty(row.FO_LADEN_ATSEA_NONSECA_CONSP_SS);
      }
    }
    if (row.FO_TYPE === 'IN PORT') {
      if (isSeca) {
        target.inPortSecaWorking = strOrEmpty(
          row.FO_INPORT_SECA_CONSP_WORKING_LP || row.FO_INPORT_SECA_CONSP_WORKING,
        );
        target.inPortSecaIdle = strOrEmpty(
          row.FO_INPORT_SECA_CONSP_IDLE_BALLAST || row.FO_INPORT_SECA_CONSP_IDLE,
        );
      } else {
        target.inPortNonSecaWorking = strOrEmpty(
          row.FO_INPORT_NONSECA_CONSP_WORKING_LP || row.FO_INPORT_NONSECA_CONSP_WORKING,
        );
        target.inPortNonSecaIdle = strOrEmpty(
          row.FO_INPORT_NONSECA_CONSP_IDLE_BALLAST || row.FO_INPORT_NONSECA_CONSP_IDLE,
        );
      }
    }
  }

  const consumptionRows = [...bunkerKeys.values()].map((row, index) => ({
    id: `cons-prefill-${index}`,
    ...row,
  }));

  const foRow = consumptionRows.find((row) => row.identify === 'FO') || consumptionRows[0] || null;
  const doRow = consumptionRows.find((row) => row.identify === 'DO') || null;

  let gnrt = strOrEmpty(vessel.GRT_NRT);
  let nrt = strOrEmpty(vessel.NRT);
  if (!nrt && gnrt.includes('/')) {
    const parts = gnrt.split('/');
    gnrt = strOrEmpty(parts[0]);
    nrt = strOrEmpty(parts[1]);
  } else if (!nrt && gnrt) {
    const g = Number(String(gnrt).replace(/,/g, ''));
    if (Number.isFinite(g) && g > 0) nrt = String(Math.round(g * 0.7 * 100) / 100);
  }

  const flag = strOrEmpty(vessel.flagName || vessel.SHIP_FLAG || vessel.FLAG);

  // Last estimate To-Port → seed From Port of first leg (PHP options.php?id=42)
  const [lastLegRows] = await pool.query(
    `SELECT a.TO_PORT AS toPort,
            CONCAT(COALESCE(c.PortName, ''), ' (', COALESCE(c.COUNTRY_KEY, ''), ')') AS toPortName,
            a.TODEPARTURE AS lastDepartureDate
     FROM freight_cost_estimete_slave1 a
     INNER JOIN freight_cost_estimete_master b ON b.FCAID = a.FCAID
     LEFT JOIN port_master c ON c.PortId = a.TO_PORT
     WHERE b.VESSEL_IMO_ID = ?
       AND b.SHEET_NO IS NOT NULL
       AND a.TO_PORT IS NOT NULL
       AND a.TO_PORT <> ''
     ORDER BY a.FCA_SLAVEID DESC
     LIMIT 1`,
    [id],
  );
  const lastLeg = lastLegRows[0] || null;
  let lastDepartureDate = '';
  if (lastLeg?.lastDepartureDate) {
    const d = new Date(lastLeg.lastDepartureDate);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1971) {
      const pad = (n) => String(n).padStart(2, '0');
      lastDepartureDate = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  return {
    vesselImoId: String(vessel.VESSEL_IMO_ID),
    vesselName: strOrEmpty(vessel.VESSEL_NAME),
    imoNo: strOrEmpty(vessel.IMO_NO),
    vesselType: strOrEmpty(vessel.vesselTypeName)
      || (vessel.VESSEL_TYPE && Number(vessel.VESSEL_TYPE) !== 0 ? String(vessel.VESSEL_TYPE) : ''),
    vesselTypeId: strOrEmpty(vessel.VESSEL_TYPE),
    businessTypeId,
    flag,
    dwtSummer: strOrEmpty(vessel.DWT),
    dwtTropical,
    gnrt,
    nrt,
    loa: strOrEmpty(vessel.LOA),
    beam: strOrEmpty(vessel.EXT_BREADTH),
    gear: strOrEmpty(vessel.CARGO_GEAR),
    builtYear: strOrEmpty(vessel.YEARBUILT),
    tpc,
    grainCap: strOrEmpty(vessel.GRAIN),
    baleCap: strOrEmpty(vessel.BALE),
    loadable: strOrEmpty(vessel.DWT),
    hasCommercialParameters: Boolean(param),
    toPort: lastLeg?.toPort != null ? String(lastLeg.toPort) : '',
    toPortName: lastLeg?.toPortName && lastLeg.toPortName !== ' ()' ? String(lastLeg.toPortName) : '',
    lastDepartureDate,

    // Speeds from vessel_commercial_parameters (PHP bfs/bes1/lfs/les1)
    bFullSpeed: strOrEmpty(param?.B_FULL_SPEED),
    bEcoSpeed1: strOrEmpty(param?.B_ECO_SPEED1),
    bEcoSpeed2: strOrEmpty(param?.B_ECO_SPEED2),
    lFullSpeed: strOrEmpty(param?.L_FULL_SPEED),
    lEcoSpeed1: strOrEmpty(param?.L_ECO_SPEED1),
    lEcoSpeed2: strOrEmpty(param?.L_ECO_SPEED2),

    // Simplified Speed/Consumption scalars (Non-SECA full-speed FO/DO + in-port)
    bFoFullSpeed: strOrEmpty(foRow?.balNonSecaFs),
    lFoFullSpeed: strOrEmpty(foRow?.ladNonSecaFs),
    bDoFullSpeed: strOrEmpty(doRow?.balNonSecaFs),
    lDoFullSpeed: strOrEmpty(doRow?.ladNonSecaFs),
    pIfoFullSpeed: strOrEmpty(foRow?.inPortNonSecaIdle),
    pWfoFullSpeed: strOrEmpty(foRow?.inPortNonSecaWorking),
    pIdoFullSpeed: strOrEmpty(doRow?.inPortNonSecaIdle),
    pWdoFullSpeed: strOrEmpty(doRow?.inPortNonSecaWorking),

    consumptionRows,

    // Bunkers Various rates (Cold/Hot Wash etc.) from commercial parameters
    variousBunkerRates,
  };
}

export async function dbCreateEstimateDetail(payload, upload = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const transDate = toDbDate(payload.transDate) || new Date().toISOString().slice(0, 10);
  const estimateType = Number(payload.estimateType) || 2;
  const now = new Date();
  const attachment = upload.attachment || '';
  const attachmentName = upload.attachmentName || '';

  try {
    await connection.beginTransaction();

    const quantity = numOrNull(payload.cargoQuantity);
    const [result] = await connection.query(
      `INSERT INTO freight_cost_estimete_master (
        FIXTURETYPEID, TRANS_DATE, MODULEID, MCOMPANYID, ADDED_BY, ADD_ON_DATE,
        VESSEL_IMO_ID, VESSEL_TYPE, FLAG, VOYAGE_NO, VOYAGE_NAME,
        DWT_SUMMER, DWT_TOPICAL, GNRT, LOA, TPC, ESTIMATE_TYPE, FIXED, CP_DATE,
        GROSS_BREAKDOWN, BREAKDOWN_MT, SEL_BUSI_TYPE, PERIODID,
        QUANTITY, TOTAL_DAYS, TOTAL_DISTANCE, DAILY_EARNING, PROFIT_LOSS, FREIGHT_GROSS,
        BFULLSPEED, LFULLSPEED, LUMSUM, LUMPSUMAMT, WS_QTY,
        BUNKER_EXPENSES, PORT_EXPENSES, REVENUES_FREIGHT, VOYAGE_EARNING,
        CVE_TOTALAMT, BALLAST_BONUS, HIREAGE_AMT, BROKERAGE_PER, BROKERAGE_AMT,
        ADDRESS_COMMISSION_PER, REMARKS, OWNER, DISPONENT_OWNER,
        ATTACHMENT, ATTACHMENT_NAME
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', ?, 0, 0, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        payload.fixtureTypeId,
        transDate,
        appContext.moduleId,
        appContext.companyId,
        appContext.userId,
        now,
        payload.vesselImoId,
        payload.vesselType || null,
        payload.flag || null,
        payload.voyageNo || null,
        payload.voyageName || null,
        payload.dwtSummer || null,
        payload.dwtTropical || null,
        payload.gnrt || null,
        payload.loa || null,
        payload.tpc || null,
        estimateType,
        transDate,
        estimateType,
        payload.periodId || null,
        quantity,
        numOrNull(payload.totalDays),
        numOrNull(payload.totalDistance),
        numOrNull(payload.dailyEarning),
        numOrNull(payload.profitLoss),
        numOrNull(payload.freightGross),
        numOrNull(payload.bFullSpeed),
        numOrNull(payload.lFullSpeed),
        numOrNull(payload.lumpsum),
        numOrNull(payload.lumpsum),
        numOrNull(payload.lumpsumQty),
        numOrNull(payload.totalBunkerCost),
        numOrNull(payload.totalPortCost),
        numOrNull(payload.revenue),
        numOrNull(payload.voyageEarnings),
        numOrNull(payload.cveAmt),
        numOrNull(payload.ballastBonus),
        numOrNull(payload.hireAmt),
        numOrNull(payload.brokeragePercent),
        numOrNull(payload.brokerageAmt),
        numOrNull(payload.addCommPercent),
        payload.notes || null,
        payload.ownerId || null,
        payload.disponentOwner || null,
        attachment || null,
        attachmentName || null,
      ],
    );

    const fcaId = result.insertId;
    await updateMasterEstimateFields(connection, fcaId, payload, {
      attachment,
      attachmentName,
      includeAttachment: Boolean(attachment),
    });
    await insertEstimateSlaves(connection, fcaId, payload);

    await connection.commit();
    return { msg: 0, id: String(fcaId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const ESTIMATE_SLAVE_DELETE_ORDER = [
  'freight_cost_estimete_slave15',
  'freight_cost_estimete_slave1',
  'freight_cost_estimete_slave2',
  'freight_cost_estimete_slave3',
  'freight_cost_estimete_slave4',
  'freight_cost_estimete_slave5',
  'freight_cost_estimete_slave6',
  'freight_cost_estimete_slave7',
  'freight_cost_estimete_slave8',
  'freight_cost_estimete_slave10',
  'freight_cost_estimete_slave11',
  'freight_cost_estimete_slave12',
  'freight_cost_estimete_slave13',
  'freight_cost_estimete_slave14',
  'freight_cost_estimete_slave16',
  'freight_cost_estimete_slave17',
  'freight_cost_estimete_slave18',
  'freight_cost_estimete_slave19',
  'freight_cost_estimete_slave20',
];

async function deleteEstimateSlaves(connection, fcaId) {
  for (const table of ESTIMATE_SLAVE_DELETE_ORDER) {
    try {
      await connection.query(`DELETE FROM ${table} WHERE FCAID = ?`, [fcaId]);
    } catch {
      // Some slave tables (e.g. slave19) may not exist on older schemas.
    }
  }
}

async function updateMasterEstimateFields(connection, fcaId, payload, opts = {}) {
  const sets = [
    'FIXTURETYPEID = ?',
    'TRANS_DATE = ?',
    'VESSEL_IMO_ID = ?',
    'VESSEL_TYPE = ?',
    'FLAG = ?',
    'VOYAGE_NO = ?',
    'VOYAGE_NAME = ?',
    'DWT_SUMMER = ?',
    'DWT_TOPICAL = ?',
    'GNRT = ?',
    'LOA = ?',
    'TPC = ?',
    'GEAR = ?',
    'BUILD_YEAR = ?',
    'BEAM = ?',
    'LODABLE = ?',
    'SF = ?',
    'GRAIN_CAP = ?',
    'BALE_CAP = ?',
    'BFULLSPEED = ?',
    'BECOSPEED1 = ?',
    'BECOSPEED2 = ?',
    'LFULLSPEED = ?',
    'LECOSPEED1 = ?',
    'LECOSPEED2 = ?',
    'BFOFULLSPEED = ?',
    'LFOFULLSPEED = ?',
    'BDOFULLSPEED = ?',
    'LDOFULLSPEED = ?',
    'PIFOFULLSPEED = ?',
    'PWFOFULLSPEED = ?',
    'PIDOFULLSPEED = ?',
    'PWDOFULLSPEED = ?',
    'QUANTITY = ?',
    'TOTAL_DAYS = ?',
    'TOTAL_DISTANCE = ?',
    'DAILY_EARNING = ?',
    'PROFIT_LOSS = ?',
    'FREIGHT_GROSS = ?',
    'LUMSUM = ?',
    'LUMPSUMAMT = ?',
    'WS_QTY = ?',
    'BUNKER_EXPENSES = ?',
    'PORT_EXPENSES = ?',
    'REVENUES_FREIGHT = ?',
    'VOYAGE_EARNING = ?',
    'CVE_AMT = ?',
    'CVE_TOTALAMT = ?',
    'BALLAST_BONUS = ?',
    'HIREAGE_AMT = ?',
    'BROKERAGE_PER = ?',
    'BROKERAGE_AMT = ?',
    'ADDRESS_COMMISSION_PER = ?',
    'ADDRESS_COMMISSION_AMT = ?',
    'CARGO_RATE = ?',
    'DAILY_VESSEL_OPERATION_EXP = ?',
    'LAYCAN_START_DATE = ?',
    'LAYCAN_FINISH_DATE = ?',
    'WORKING_DAYS = ?',
    'PERIODID = ?',
    'CHARTERING_PIC = ?',
    'TANKER_RADIO_SINGLE_DIS = ?',
    'REMARKS = ?',
    'OWNER = ?',
    'DISPONENT_OWNER = ?',
    'GAS_BALTIC = ?',
    'GAS_BASE_RATE = ?',
    'ADDNL_PRENIUM = ?',
    'BASERATE_FLOAT = ?',
    'BASERATE_FIXED = ?',
    'BASERATE_AVERAGE = ?',
    'GROSS_FREIGHT_FLOAT = ?',
    'GROSS_FREIGHT_FIXED = ?',
    'GROSS_FREIGHT_AVERAGE = ?',
    'NETFREIGHT_FLOAT = ?',
    'NETFREIGHT_FIXED = ?',
    'NETFREIGHT_AVERAGE = ?',
    'TCEEARNING_FLOAT = ?',
    'TCEEARNING_FIXED = ?',
    'TCEEARNING_AVERAGE = ?',
  ];

  const values = [
    payload.fixtureTypeId || null,
    toDbDate(payload.transDate),
    payload.vesselImoId || null,
    payload.vesselType || null,
    payload.flag || null,
    payload.voyageNo || null,
    payload.voyageName || null,
    payload.dwtSummer || null,
    payload.dwtTropical || null,
    payload.gnrt || null,
    payload.loa || null,
    payload.tpc || null,
    payload.gear || null,
    payload.builtYear || null,
    payload.beam || null,
    payload.loadable || null,
    payload.stowageFactor || null,
    payload.grainCap || null,
    payload.baleCap || null,
    numOrNull(payload.bFullSpeed),
    numOrNull(payload.bEcoSpeed1),
    numOrNull(payload.bEcoSpeed2),
    numOrNull(payload.lFullSpeed),
    numOrNull(payload.lEcoSpeed1),
    numOrNull(payload.lEcoSpeed2),
    numOrNull(payload.bFoFullSpeed),
    numOrNull(payload.lFoFullSpeed),
    numOrNull(payload.bDoFullSpeed),
    numOrNull(payload.lDoFullSpeed),
    numOrNull(payload.pIfoFullSpeed),
    numOrNull(payload.pWfoFullSpeed),
    numOrNull(payload.pIdoFullSpeed),
    numOrNull(payload.pWdoFullSpeed),
    numOrNull(payload.cargoQuantity),
    numOrNull(payload.totalDays),
    numOrNull(payload.totalDistance),
    numOrNull(payload.dailyEarning),
    numOrNull(payload.profitLoss),
    numOrNull(payload.freightGross),
    numOrNull(payload.lumpsum),
    numOrNull(payload.lumpsum),
    numOrNull(payload.lumpsumQty),
    numOrNull(payload.totalBunkerCost),
    numOrNull(payload.totalPortCost),
    numOrNull(payload.revenue),
    numOrNull(payload.voyageEarnings),
    numOrNull(payload.cvePerMonth),
    numOrNull(payload.cveAmt),
    numOrNull(payload.ballastBonus),
    numOrNull(payload.hireAmt),
    numOrNull(payload.brokeragePercent),
    numOrNull(payload.brokerageAmt),
    numOrNull(payload.addCommPercent),
    numOrNull(payload.addressCommAmt),
    numOrNull(payload.tankerFreightRate || payload.marketRate),
    numOrNull(payload.vesselDailyOps),
    toDbDateTime(payload.laycanStart),
    toDbDateTime(payload.laycanEnd),
    numOrNull(payload.timeAllowed),
    payload.periodId || null,
    payload.charteringPic || null,
    payload.tankType != null && payload.tankType !== '' ? Number(payload.tankType) : 1,
    payload.notes || null,
    payload.ownerId || null,
    payload.disponentOwner
      || (payload.disponentRows || []).map((r) => r.name).filter(Boolean).join(', ')
      || null,
    numOrNull(payload.gasBaltic),
    numOrNull(payload.gasBaseRate),
    numOrNull(payload.addnlPremium),
    numOrNull(payload.baseRateFloat),
    numOrNull(payload.baseRateFixed),
    numOrNull(payload.baseRateAverage),
    numOrNull(payload.grossFreightFloat),
    numOrNull(payload.grossFreightFixed),
    numOrNull(payload.grossFreightAverage),
    numOrNull(payload.netFreightFloat),
    numOrNull(payload.netFreightFixed),
    numOrNull(payload.netFreightAverage),
    numOrNull(payload.tceFloat),
    numOrNull(payload.tceFixed),
    numOrNull(payload.tceAverage),
  ];

  if (opts.includeAttachment) {
    sets.push('ATTACHMENT = ?', 'ATTACHMENT_NAME = ?');
    values.push(opts.attachment || null, opts.attachmentName || null);
  }

  values.push(fcaId, appContext.moduleId, appContext.companyId);

  await connection.query(
    `UPDATE freight_cost_estimete_master
     SET ${sets.join(', ')}
     WHERE FCAID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
    values,
  );
}

async function insertEstimateSlaves(connection, fcaId, payload) {
  for (const leg of payload.portLegs || []) {
    if (!leg.fromPortId && !leg.toPortId) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave1 (
        FCAID, FROM_PORT, TO_PORT, PASSAGE_TYPE, SPEED_TYPE, DISTANCE,
        MARGIN_DISTANCE, FROMARRIVAL, FROMDEPARTURE, TOARRIVAL, TODEPARTURE,
        LOAD_PORT_QTY, DISC_PORT_QTY, LOAD_PORT_COST, DISC_PORT_COST,
        LOAD_PORT_RATE, DISC_PORT_RATE, LOAD_PORT_TERMS, DISC_PORT_TERMS,
        LOAD_PORT_WORK_DAYS, DISC_PORT_WORK_DAYS, LOAD_PORT_IDEAL_DAYS, DISC_PORT_IDEAL_DATE,
        TRANSIT_PORT_IDLE_DAYS, TOTAL_VOYAGE_DAYS, RANDOMID,
        SECA_DISTANCE, SECA_DAYS, TRANSIT_PORT_COST, DDCLP_ESTCOST, DDCDP_ESTCOST,
        DDCLP_REALCOST, DDCDP_REALCOST, DDCLP_NETCOST, DDCDP_NETCOST,
        DEMMDAYSLP, DEMMRATELP, DEMMDAYSDP, DEMMRATEDP,
        CHK_LP_SECA, CHK_DP_SECA
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        leg.fromPortId || null,
        leg.toPortId || null,
        leg.passageType || null,
        leg.speedType || null,
        numOrNull(leg.distance),
        numOrNull(leg.seaMargin != null && leg.seaMargin !== '' ? leg.seaMargin : 5),
        toDbDateTime(leg.fromArrival),
        toDbDateTime(leg.fromDeparture),
        toDbDateTime(leg.toArrival),
        toDbDateTime(leg.toDeparture),
        numOrNull(leg.loadQty),
        numOrNull(leg.dischargeQty),
        numOrNull(leg.loadPortCost),
        numOrNull(leg.discPortCost),
        numOrNull(leg.loadPortRate),
        numOrNull(leg.discPortRate),
        numOrNull(leg.loadPortTerms),
        numOrNull(leg.discPortTerms),
        numOrNull(leg.loadPortWorkDays),
        numOrNull(leg.discPortWorkDays),
        numOrNull(leg.loadPortIdleDays),
        numOrNull(leg.discPortIdleDays),
        numOrNull(leg.transitIdleDays),
        numOrNull(leg.seaDays),
        randomId(),
        numOrNull(leg.secaDistance),
        numOrNull(leg.secaDays),
        numOrNull(leg.transitPortCost),
        numOrNull(leg.ddcLpEst),
        numOrNull(leg.ddcDpEst),
        numOrNull(leg.ddcLpReal != null && leg.ddcLpReal !== '' ? leg.ddcLpReal : leg.ddcLpEst),
        numOrNull(leg.ddcDpReal != null && leg.ddcDpReal !== '' ? leg.ddcDpReal : leg.ddcDpEst),
        numOrNull(leg.ddcLpNett),
        numOrNull(leg.ddcDpNett),
        numOrNull(leg.demmDaysLp),
        numOrNull(leg.demmRateLp),
        numOrNull(leg.demmDaysDp),
        numOrNull(leg.demmRateDp),
        leg.chkLpSeca ? 1 : 0,
        leg.chkDpSeca ? 1 : 0,
      ],
    );
  }

  const allCargos = [
    ...(payload.cargoRows || []).map((row) => ({ ...row, status: row.status || 1 })),
    ...(payload.overageCargoRows || []).map((row) => ({ ...row, status: 2 })),
    ...(payload.deadfreightCargoRows || []).map((row) => ({ ...row, status: 3 })),
  ];

  for (const cargo of allCargos) {
    if (!cargo.cargoId && !cargo.cargoMt) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave10 (
        FCAID, SHIPPER_CHARTER, CARGO_CBM, CARGO_MT, RATE_USD_MT, AMOUNT_USD,
        STATUS, CARGOID, RANDOMID, DEM_AMT, VENDORID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        cargo.charterer || null,
        numOrNull(cargo.cargoCbm),
        numOrNull(cargo.cargoMt),
        numOrNull(cargo.rateUsdMt),
        numOrNull(cargo.amountUsd),
        cargo.status || 1,
        cargo.cargoId || null,
        randomId(),
        numOrNull(cargo.demAmt),
        cargo.vendorId || null,
      ],
    );
  }

  for (const bunker of payload.bunkerRows || []) {
    if (!bunker.bunkerGradeId && !bunker.qty) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave8 (
        FCAID, BUNKERGRADEID, COST, COST_MT, QTY, PRICE, IDENTIFY
      ) VALUES (?, ?, ?, '0.00', ?, ?, ?)`,
      [
        fcaId,
        bunker.bunkerGradeId || null,
        numOrNull(bunker.cost),
        numOrNull(bunker.qty),
        numOrNull(bunker.price),
        bunker.identify || 'CONSUMPTION',
      ],
    );
  }

  for (const row of payload.bunkerActivityRows || []) {
    if (!row.qty && !row.amount && !row.activity) continue;
    try {
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave19 (
          FCAID, ACTIVITY, BUNKERGRADE, QUANTITY, PRICE, AMOUNT
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          fcaId,
          row.activity || null,
          row.bunkerGrade || null,
          numOrNull(row.qty),
          numOrNull(row.price),
          numOrNull(row.amount),
        ],
      );
    } catch {
      // slave19 may be absent on older schemas
    }
  }

  for (const row of payload.profitSharingRows || []) {
    if (!row.vendorId && !row.percentage) continue;
    try {
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave20 (
          FCAID, VENDORID, PERCENTAGE
        ) VALUES (?, ?, ?)`,
        [
          fcaId,
          row.vendorId || null,
          numOrNull(row.percentage),
        ],
      );
    } catch {
      // slave20 may be absent on older schemas
    }
  }

  const brokerRows = (payload.brokerRows && payload.brokerRows.length)
    ? payload.brokerRows
    : ((payload.brokeragePercent || payload.brokerageAmt)
      ? [{ percent: payload.brokeragePercent, amount: payload.brokerageAmt, vendorId: '' }]
      : []);
  for (const broker of brokerRows) {
    if (!broker.percent && !broker.amount) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave4 (
        FCAID, BROKAGE_PERCENT, BROKAGE_AMT, VENDORID
      ) VALUES (?, ?, ?, ?)`,
      [
        fcaId,
        numOrNull(broker.percent),
        numOrNull(broker.amount),
        broker.vendorId || null,
      ],
    );
  }

  for (const orc of payload.orcRows || []) {
    if (!orc.costId && !orc.amount) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave3 (
        FCAID, IDENTY_ID, IDENTIFY, RAW_AMOUNT, COST_MT, VENDORID, RANDOMID
      ) VALUES (?, ?, 'ORC', ?, ?, ?, ?)`,
      [
        fcaId,
        orc.costId || null,
        numOrNull(orc.amount),
        numOrNull(orc.amountMt),
        orc.vendorId || null,
        randomId(),
      ],
    );
  }

  for (const income of payload.otherIncomeRows || []) {
    if (!income.description && !income.amount) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave3 (
        FCAID, IDENTY_ID, IDENTIFY, COST, ADDCOMM, RAW_AMOUNT, VENDORID, RANDOMID
      ) VALUES (?, ?, 'OTHERINCOME', ?, ?, ?, ?, ?)`,
      [
        fcaId,
        income.description || null,
        numOrNull(income.amount),
        numOrNull(income.addComm),
        numOrNull(income.netAmount),
        income.vendorId || null,
        randomId(),
      ],
    );
  }

  for (const hire of payload.hireRows || []) {
    if (!hire.hireDays && !hire.hireRate && !hire.hireAmt) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave17 (
        FCAID, HIRE_FROM, HIRE_TO, HIRE_DAYS, HIRE_RATE, HIRE_AMT, RANDOMID
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        toDbDate(hire.hireFrom) || '1970-01-01',
        toDbDate(hire.hireTo) || '1970-01-01',
        numOrNull(hire.hireDays),
        numOrNull(hire.hireRate),
        numOrNull(hire.hireAmt),
        randomId(),
      ],
    );
  }

  for (const seca of payload.secaBunkerRows || []) {
    if (!seca.bunkerGradeId && !seca.qty) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave2 (
        FCAID, BUNKERGRADEID, EST_MT, EST_PRICE, EST_COST, IDENTIFY, CHK_IF_CAL, BUNKER_TYPE
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        seca.bunkerGradeId || null,
        numOrNull(seca.qty),
        numOrNull(seca.price),
        numOrNull(seca.cost),
        seca.identify || 'SECA',
        seca.calc === false ? 0 : 1,
        seca.bunkerType || 'FO',
      ],
    );
  }

  for (const row of payload.consumptionRows || []) {
    if (!row.bunkerGradeId && !row.balSecaFs && !row.ladSecaFs) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave16 (
        FCAID, BUNKERID, IDENTIFY,
        FO_BALAST_ATSEA_SECA_CONSP_FS, FO_LADEN_ATSEA_SECA_CONSP_FS,
        FO_BALAST_ATSEA_NONSECA_CONSP_FS, FO_LADEN_ATSEA_NONSECA_CONSP_FS,
        FO_BALAST_ATSEA_SECA_CONSP_SS, FO_LADEN_ATSEA_SECA_CONSP_SS,
        FO_BALAST_ATSEA_NONSECA_CONSP_SS, FO_LADEN_ATSEA_NONSECA_CONSP_SS,
        FO_INPORT_SECA_CONSP_WORKING, FO_INPORT_NONSECA_CONSP_WORKING,
        FO_INPORT_SECA_CONSP_IDLE, FO_INPORT_NONSECA_CONSP_IDLE
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        row.bunkerGradeId || null,
        row.identify || 'FO',
        numOrNull(row.balSecaFs),
        numOrNull(row.ladSecaFs),
        numOrNull(row.balNonSecaFs),
        numOrNull(row.ladNonSecaFs),
        numOrNull(row.balSecaSs),
        numOrNull(row.ladSecaSs),
        numOrNull(row.balNonSecaSs),
        numOrNull(row.ladNonSecaSs),
        numOrNull(row.inPortSecaWorking),
        numOrNull(row.inPortNonSecaWorking),
        numOrNull(row.inPortSecaIdle),
        numOrNull(row.inPortNonSecaIdle),
      ],
    );
  }

  for (const loc of payload.passageLocations || []) {
    if (!loc.fromLocation && !loc.toLocation) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave6 (
        FCAID, LOCATION_FROM, LOCATION_TO, PASSAGE_TYPE, SPEED_TYPE, DISTANCE
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        loc.fromLocation || null,
        loc.toLocation || null,
        loc.passageType || null,
        loc.speedType || null,
        numOrNull(loc.distance),
      ],
    );
  }

  for (const fq of payload.freightQtyRows || []) {
    if (!fq.vendorId && !fq.quantity && !fq.agreedGrossFreight) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave7 (
        FCAID, QTY_VENDORID, AGREED_GROSS_FREIGHT, QUANTITY, GROSS_FREIGHT,
        BROKERAGE, NET_BROKERAGE, NET_FREIGHT, NET_FREIGHT_PERMT,
        CURRENCYID, AGREED_GROSS_FREIGHT_LOCAL, EXCHANGE_RATE, CARGO, RANDOMID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        fq.vendorId || null,
        numOrNull(fq.agreedGrossFreight),
        numOrNull(fq.quantity),
        numOrNull(fq.grossFreight),
        numOrNull(fq.brokeragePercent),
        numOrNull(fq.netBrokerage),
        numOrNull(fq.netFreight),
        numOrNull(fq.netFreightPerMt),
        fq.currencyId || null,
        numOrNull(fq.localAgreedFreight),
        numOrNull(fq.exchangeRate),
        fq.cargoId || null,
        randomId(),
      ],
    );
  }

  for (const inv of payload.invoiceRows || []) {
    if (!inv.invoiceId) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave11 (INVOICEID, FCAID) VALUES (?, ?)`,
      [String(inv.invoiceId).trim(), fcaId],
    );
  }

  for (const ws of payload.tankerWsRows || []) {
    if (!ws.freightSpecs && !ws.minCargoQty && !ws.totalAmount) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave12 (
        FCAID, FREIGHT_SPECS, CUSTOMER, MIN_CARGO_QTY, OVE_CARGO_QTY,
        MIN_FLAT_RATE, OVE_FLAT_RATE, MIN_WS, OVE_WS, MIN_DIS_LEG, OVE_DIS_LEG,
        MIN_DISTANCE, OVE_DISTANCE, MIN_AMOUNT, OVE_AMOUNT, TOTAL_QTY, TOTAL_AMOUNT
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        ws.freightSpecs || null,
        ws.customerId || null,
        numOrNull(ws.minCargoQty),
        numOrNull(ws.oveCargoQty),
        numOrNull(ws.minFlatRate),
        numOrNull(ws.oveFlatRate),
        numOrNull(ws.minWs),
        numOrNull(ws.oveWs),
        numOrNull(ws.minDisLeg),
        numOrNull(ws.oveDisLeg),
        numOrNull(ws.minDistance),
        numOrNull(ws.oveDistance),
        numOrNull(ws.minAmount),
        numOrNull(ws.oveAmount),
        numOrNull(ws.totalQty),
        numOrNull(ws.totalAmount),
      ],
    );
  }

  for (const off of payload.offHireRows || []) {
    if (!off.reason && !off.days && !off.amount) continue;
    const [offResult] = await connection.query(
      `INSERT INTO freight_cost_estimete_slave14 (
        FCAID, OFF_REASON, OFF_FROM, OFF_TO, OFF_DAYS, HIRE_RATE, OFF_HIRE, RANDOMID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fcaId,
        off.reason || null,
        toDbDate(off.from) || '1970-01-01',
        toDbDate(off.to) || '1970-01-01',
        numOrNull(off.days),
        numOrNull(off.rate),
        numOrNull(off.amount),
        randomId(),
      ],
    );
    const slave14Id = offResult.insertId;
    for (const bunker of off.bunkers || []) {
      if (!bunker.bunkerGradeId && !bunker.qty && !bunker.amount) continue;
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave15 (
          FCA_SLAVE14ID, FCAID, BUNKERID, BUNKERQTY, BUNKERPRICE, BUNKERAMT, CHECK_BUNKER_CAL
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          slave14Id,
          fcaId,
          bunker.bunkerGradeId || null,
          numOrNull(bunker.qty),
          numOrNull(bunker.price),
          numOrNull(bunker.amount),
          bunker.calc === false ? 0 : 1,
        ],
      );
    }
  }

  for (const row of payload.deliveryBunkerRows || []) {
    if (!row.bunkerGradeId && !row.qty) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave13 (
        FCAID, BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY
      ) VALUES (?, ?, ?, ?, ?, ?, 'DEL')`,
      [
        fcaId,
        row.bunkerGradeId || null,
        numOrNull(row.amount),
        toDbDate(row.bunkerDate) || '1970-01-01',
        numOrNull(row.qty),
        numOrNull(row.price),
      ],
    );
  }

  for (const row of payload.redeliveryBunkerRows || []) {
    if (!row.bunkerGradeId && !row.qty) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave13 (
        FCAID, BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY
      ) VALUES (?, ?, ?, ?, ?, ?, 'REDEL')`,
      [
        fcaId,
        row.bunkerGradeId || null,
        numOrNull(row.amount),
        toDbDate(row.bunkerDate) || '1970-01-01',
        numOrNull(row.qty),
        numOrNull(row.price),
      ],
    );
  }

  for (const row of payload.disponentRows || []) {
    if (!row.name) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave5 (FCAID, DISPONENT_OWNER) VALUES (?, ?)`,
      [fcaId, row.name],
    );
  }

  for (const row of payload.voyageEventRows || []) {
    if (!row.details && !row.eventDate) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimete_slave18 (FCAID, EVENT_DETAILS, EVENT_DATE)
       VALUES (?, ?, ?)`,
      [fcaId, row.details || null, toDbDate(row.eventDate) || '1970-01-01'],
    );
  }

  try {
    const [[existingEvent]] = await connection.query(
      `SELECT FCAID FROM freight_cost_estimete_slave18 WHERE FCAID = ? LIMIT 1`,
      [fcaId],
    );
    if (existingEvent) {
      await connection.query(
        `UPDATE freight_cost_estimete_slave18
         SET EUETSADDTOF = ?, FUELEUADDTOF = ?
         WHERE FCAID = ?`,
        [
          payload.euEtsAddToFreight ? 1 : 0,
          payload.fuelEuAddToFreight ? 1 : 0,
          fcaId,
        ],
      );
    } else if (payload.euEtsAddToFreight || payload.fuelEuAddToFreight) {
      await connection.query(
        `INSERT INTO freight_cost_estimete_slave18 (
          FCAID, EVENT_DETAILS, EVENT_DATE, EUETSADDTOF, FUELEUADDTOF
        ) VALUES (?, NULL, '1970-01-01', ?, ?)`,
        [
          fcaId,
          payload.euEtsAddToFreight ? 1 : 0,
          payload.fuelEuAddToFreight ? 1 : 0,
        ],
      );
    }
  } catch {
    // Optional EU ETS / FuelEU columns may be absent on older schemas.
  }
}

export async function dbUpdateEstimateDetail(id, payload, upload = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const fcaId = Number(id);
  const hasNewAttachment = Boolean(upload.attachment);

  try {
    await connection.beginTransaction();

    const [[existing]] = await connection.query(
      `SELECT FCAID, ATTACHMENT, ATTACHMENT_NAME
       FROM freight_cost_estimete_master
       WHERE FCAID = ? AND MODULEID = ? AND MCOMPANYID = ?
       LIMIT 1`,
      [fcaId, appContext.moduleId, appContext.companyId],
    );
    if (!existing) {
      await connection.rollback();
      return null;
    }

    let attachment = existing.ATTACHMENT || '';
    let attachmentName = existing.ATTACHMENT_NAME || '';
    if (hasNewAttachment) {
      const prevFiles = String(attachment || '').split(',').map((s) => s.trim()).filter(Boolean);
      const prevNames = String(attachmentName || '').split(',').map((s) => s.trim()).filter(Boolean);
      const nextFiles = String(upload.attachment || '').split(',').map((s) => s.trim()).filter(Boolean);
      const nextNames = String(upload.attachmentName || '').split(',').map((s) => s.trim()).filter(Boolean);
      attachment = [...prevFiles, ...nextFiles].join(',');
      attachmentName = [...prevNames, ...nextNames].join(',');
    }

    await updateMasterEstimateFields(connection, fcaId, payload, {
      attachment,
      attachmentName,
      includeAttachment: hasNewAttachment,
    });
    await deleteEstimateSlaves(connection, fcaId);
    await insertEstimateSlaves(connection, fcaId, payload);

    await connection.commit();
    return { msg: 0, id: String(fcaId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

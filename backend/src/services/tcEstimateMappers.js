import { formatDateDMY, parsePeriodDate } from './estimateListMappers.js';

export { formatDateDMY, parsePeriodDate };

export const TC_BUSINESS_TYPES = [
  { id: '3', name: 'Dry' },
  { id: '2', name: 'Tankers' },
  { id: '1', name: 'Gas' },
];

export function nullIfEmpty(value) {
  if (value == null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

export function toDbDate(value, withTime = false) {
  if (!value) return withTime ? '1970-01-01 08:00:00' : '1970-01-01';
  const str = String(value).trim();
  const dmyTime = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (dmyTime) {
    const [, day, month, year, hh = '08', mm = '00'] = dmyTime;
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return withTime ? `${date} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00` : date;
  }
  const parsed = parsePeriodDate(value);
  if (!parsed) return withTime ? '1970-01-01 08:00:00' : '1970-01-01';
  if (!withTime) return parsed;
  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (timeMatch) {
    return `${parsed} ${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
  }
  return `${parsed} 08:00:00`;
}

/** Format DB datetime as dd-mm-yyyy HH:mm (legacy calc page). */
export function formatDateTimeDMY(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const str = String(value);
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return formatDateDMY(value);
    const [, y, mo, d, hh, mm] = m;
    if (hh != null) return `${d}-${mo}-${y} ${hh}:${mm}`;
    return `${d}-${mo}-${y}`;
  }
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}-${m}-${y} ${hh}:${mm}`;
}

/** Parse dd-mm-yyyy [HH:mm] or ISO into Date. */
export function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  const dmy = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (dmy) {
    const [, day, month, year, hh = '0', mm = '0'] = dmy;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hh),
      Number(mm),
      0,
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(str);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

/** PHP getTimeDiff(end, start) — fractional days. */
export function daysBetween(endValue, startValue) {
  const end = parseDateTime(endValue);
  const start = parseDateTime(startValue);
  if (!end || !start) return 0;
  return (end.getTime() - start.getTime()) / 86400000;
}

export function formatNumber(value, decimals = 2) {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  return num.toFixed(decimals);
}

export function dailyGrossHire(hireFixPer, exchangeRate) {
  const rate = Number(exchangeRate);
  const exchange = Number.isFinite(rate) && rate !== 0 ? rate : 1;
  return formatNumber(Number(hireFixPer || 0) * exchange);
}

export function mapTcListRow(row, index = 0) {
  const exchangeRate = Number(row.EXCHANGE_RATE);
  const hasRevenue = Number(row.TOTAL_REV_EST || 0) > 0;
  const sentToChart = row.COMID != null && String(row.COMID).trim() !== '';
  return {
    index: index + 1,
    tcOutId: row.TCOUTID,
    vesselName: row.VESSEL_NAME ?? '',
    vesselType: row.VESSEL_TYPE ?? '',
    tcNo: row.TC_NO ?? '',
    cpDate: formatDateDMY(row.CP_DATE1),
    dwt: row.DWT_SUMMER_CP ?? '',
    delPort: row.DEL_RANGE_PORT ?? '',
    reDelPort: row.RE_DEL_RANGE ?? '',
    tcDays: row.TC_DAYS_EST != null ? String(row.TC_DAYS_EST) : '',
    dailyGrossHire: dailyGrossHire(row.HIRE_FIX_PER, exchangeRate),
    totalRev: row.TOTAL_REV_EST != null ? String(row.TOTAL_REV_EST) : '',
    comId: row.COMID != null ? String(row.COMID) : '',
    sentToDecisionChart: sentToChart,
    canCompare: !sentToChart && hasRevenue,
    compareLabel: sentToChart
      ? 'Sent to Decision Chart'
      : hasRevenue
        ? ''
        : 'Create Estimate',
  };
}

export function mapTcDetail(row, extras = {}) {
  if (!row) return null;
  return {
    tcOutId: row.TCOUTID,
    businessTypeId: row.ESTIMATE_TYPE != null ? String(row.ESTIMATE_TYPE) : '3',
    fixtureType: row.FIXTURE_TYPE != null ? String(row.FIXTURE_TYPE) : '',
    vesselImoId: row.VESSEL_IMO_ID != null ? String(row.VESSEL_IMO_ID) : '',
    vesselType: row.VESSEL_TYPE ?? '',
    flag: row.FLAG ?? '',
    tcDate: formatDateDMY(row.TC_DATE),
    tcNo: row.TC_NO ?? '',
    cpDate: formatDateDMY(row.CP_DATE1),
    cpType: row.SEL_CP_TYPE != null ? String(row.SEL_CP_TYPE) : '',
    charterer: row.SEL_CHARTERER != null ? String(row.SEL_CHARTERER) : '',
    charOperation: row.SEL_CHAR_OPER != null ? String(row.SEL_CHAR_OPER) : '',
    charteringTeam: row.CHARTERING_PIC != null && String(row.CHARTERING_PIC) !== '0'
      ? String(row.CHARTERING_PIC)
      : '7',
    charteringPic1: row.CHARTERING_PIC_1 != null && String(row.CHARTERING_PIC_1) !== '0'
      ? String(row.CHARTERING_PIC_1)
      : '',
    charteringPic2: row.CHARTERING_PIC_2 != null && String(row.CHARTERING_PIC_2) !== '0'
      ? String(row.CHARTERING_PIC_2)
      : '',
    lawArbit: row.LAW_ARBITRA != null ? String(row.LAW_ARBITRA) : '',
    charOperAdd: row.CHAR_OPER_ADD ?? '',
    buildYard: row.BUILD_YARD ?? '',
    yearBuild: row.BUILT_YEAR1 ?? '',
    flag1: row.FLAG_1 ?? '',
    portOfReg: row.PORT_OF_REG ?? '',
    imoNo: row.IMO_NO ?? '',
    classId: row.CLASS_ID ?? '',
    lastSpSurvey: formatDateDMY(row.LAST_SP_SURVEY),
    lastDd: formatDateDMY(row.LAST_DD),
    ownersPi: row.OWNERS_PI ?? '',
    mastersName: row.MASTERS_NAME ?? '',
    callSign: row.CALL_SIGN ?? '',
    inmarsatTel: row.INMARSAT_TEL ?? '',
    inmarsatMail: row.INMARSAT_MAIL ?? '',
    loa1: row.LOA1 != null ? String(row.LOA1) : '',
    breadth: row.BREADTH != null ? String(row.BREADTH) : '',
    summerDwt: row.SUMMER_DWT != null ? String(row.SUMMER_DWT) : '',
    summerDraft: row.SUMMER_DRAFT != null ? String(row.SUMMER_DRAFT) : '',
    tpc1: row.TPC1 != null ? String(row.TPC1) : '',
    grossTonn: row.GROSS_TONN != null ? String(row.GROSS_TONN) : '',
    netTonn: row.NET_TONN != null ? String(row.NET_TONN) : '',
    cargoTankCap: row.CARGO_TANK_CAP != null ? String(row.CARGO_TANK_CAP) : '',
    noOfGrades: row.NO_OF_GRADES != null ? String(row.NO_OF_GRADES) : '',
    cargoPumpCap: row.CARGO_PUMP_CAP != null ? String(row.CARGO_PUMP_CAP) : '',
    totalSbtCap: row.TOTAL_SBT_CAP != null ? String(row.TOTAL_SBT_CAP) : '',
    suezGrt: row.SUEZ_GRT != null ? String(row.SUEZ_GRT) : '',
    suezNrt: row.SUEZ_NRT != null ? String(row.SUEZ_NRT) : '',
    panamaNrt: row.PANAMA_NRT != null ? String(row.PANAMA_NRT) : '',
    grainCap: row.GRAIN_CAP1 != null ? String(row.GRAIN_CAP1) : '',
    baleCap: row.BALE_CAP1 != null ? String(row.BALE_CAP1) : '',
    cranes: row.CRANES ?? '',
    grabs: row.GRABS ?? '',
    keelTopMast: row.KEEL_TOP_MAST != null ? String(row.KEEL_TOP_MAST) : '',
    waterlineTopMast: row.WTR_TOP_MAST_FB != null ? String(row.WTR_TOP_MAST_FB) : '',
    delRangePort: row.DEL_RANGE_PORT ?? '',
    durFixPer: row.DUR_FIX_PER != null ? String(row.DUR_FIX_PER) : '',
    tripTc: row.TRIP_TC != null ? String(row.TRIP_TC) : '',
    period: row.PERIOD != null ? String(row.PERIOD) : '',
    noOfTrip: row.NO_OF_TRIP != null ? String(row.NO_OF_TRIP) : '',
    delDate: formatDateDMY(row.DEL_DATE),
    reDelDate: formatDateDMY(row.RE_DEL_DATE),
    durOptPer: row.DUR_OPT_PER != null ? String(row.DUR_OPT_PER) : '',
    commOptPer: row.COMM_OPT_PER != null ? String(row.COMM_OPT_PER) : '',
    laycanFrom: formatDateDMY(row.LAYCAN_FROM),
    laycanTo: formatDateDMY(row.LAYCAN_TO),
    laycanNarr: row.LAYCAN_NARR ?? '',
    reDelRange: row.RE_DEL_RANGE ?? '',
    hireFixPer: row.HIRE_FIX_PER != null ? String(row.HIRE_FIX_PER) : '',
    exchangeCurrency: row.EXCHANGE_CURRENCY || 'USD',
    exchangeRate: row.EXCHANGE_RATE != null ? String(row.EXCHANGE_RATE) : '1',
    hireOptPer: row.HIRE_OPT_PER != null ? String(row.HIRE_OPT_PER) : '',
    fuelSpecs: row.FUEL_SPECS ?? '',
    cveMonth: row.CVE_MONTH != null ? String(row.CVE_MONTH) : '',
    supercargoMeals: row.SUP_CARGO_MEAL ?? '',
    holdCleanInter: row.HOLD_CLEAN_INTER ?? '',
    ilohcUsd: row.ILOHC_USD != null ? String(row.ILOHC_USD) : '',
    ilohcRemarks: row.ILOHC_REMARKS ?? '',
    broCommPayable: row.BRO_COMM_PAYABLE ?? '',
    addComm: row.ADD_COMM != null ? String(row.ADD_COMM) : '',
    brokerComm: row.BROKER_COMM != null ? String(row.BROKER_COMM) : '',
    ownersBankDet: row.OWNERS_BANK_DET ?? '',
    docCreatBy: row.DOC_CREAT_BY ?? '',
    additInform: row.ADDIT_INFORM ?? '',
    dwtSummerCp: row.DWT_SUMMER_CP != null ? String(row.DWT_SUMMER_CP) : '',
    dwtTropicalCp: row.DWT_TROPICAL_CP != null ? String(row.DWT_TROPICAL_CP) : '',
    grainCapCp: row.GRAIN_CAP_CP != null ? String(row.GRAIN_CAP_CP) : '',
    baleCapCp: row.BALE_CAP_CP != null ? String(row.BALE_CAP_CP) : '',
    sfCp: row.SF_CP != null ? String(row.SF_CP) : '',
    loadableCp: row.LOADABLE_CP != null ? String(row.LOADABLE_CP) : '',
    grtNrtCp: row.GRT_NRT_CP ?? '',
    loaCp: row.LOA_CP != null ? String(row.LOA_CP) : '',
    gearCp: row.GEAR_CP ?? '',
    builtYearCp: row.BUILT_YEAR_CP ?? '',
    beamCp: row.BEAM_CP != null ? String(row.BEAM_CP) : '',
    tpcCp: row.TPC_CP != null ? String(row.TPC_CP) : '',
    bFullSpeedCp: row.B_FULL_SPEED_CP != null ? String(row.B_FULL_SPEED_CP) : '',
    bEcoSpeed1Cp: row.B_ECO_SPEED1_CP != null ? String(row.B_ECO_SPEED1_CP) : '',
    bEcoSpeed2Cp: row.B_ECO_SPEED2_CP != null ? String(row.B_ECO_SPEED2_CP) : '',
    lFullSpeedCp: row.L_FULL_SPEED_CP != null ? String(row.L_FULL_SPEED_CP) : '',
    lEcoSpeed1Cp: row.L_ECO_SPEED1_CP != null ? String(row.L_ECO_SPEED1_CP) : '',
    lEcoSpeed2Cp: row.L_ECO_SPEED2_CP != null ? String(row.L_ECO_SPEED2_CP) : '',
    windForce: row.WIND_FORCE_TCCP != null ? String(row.WIND_FORCE_TCCP) : '',
    speedLaden: row.SPD_LADEN_TCCP != null ? String(row.SPD_LADEN_TCCP) : '',
    speedBallast: row.SPD_BLST_TCCP != null ? String(row.SPD_BLST_TCCP) : '',
    cpSpeed: row.CP_SPD_TCCP != null ? String(row.CP_SPD_TCCP) : '',
    foConsLaden: row.FO_CONS_LDN_TCCP != null ? String(row.FO_CONS_LDN_TCCP) : '',
    doConsLaden: row.DO_CONS_LDN_TCCP != null ? String(row.DO_CONS_LDN_TCCP) : '',
    foConsBallast: row.FO_CONS_BLST_TCCP != null ? String(row.FO_CONS_BLST_TCCP) : '',
    doConsBallast: row.DO_CONS_BLST_TCCP != null ? String(row.DO_CONS_BLST_TCCP) : '',
    foConsLdg: row.FO_CONS_LDN2_TCCP != null ? String(row.FO_CONS_LDN2_TCCP) : '',
    doConsLdg: row.DO_CONS_LDN2_TCCP != null ? String(row.DO_CONS_LDN2_TCCP) : '',
    foConsDisch: row.FO_CONS_DISH_TCCP != null ? String(row.FO_CONS_DISH_TCCP) : '',
    doConsDisch: row.DO_CONS_DISH_TCCP != null ? String(row.DO_CONS_DISH_TCCP) : '',
    foConsIdle: row.FO_CONS_IDLE_TCCP != null ? String(row.FO_CONS_IDLE_TCCP) : '',
    doConsIdle: row.DO_CONS_IDLE_TCCP != null ? String(row.DO_CONS_IDLE_TCCP) : '',
    loadRate: row.LODE_RATE_TCCP != null ? String(row.LODE_RATE_TCCP) : '',
    dischRate: row.DISH_RATE_TCCP != null ? String(row.DISH_RATE_TCCP) : '',
    balticRoute: row.BALTIC_ROUTE != null ? String(row.BALTIC_ROUTE) : '',
    balticDate: formatDateDMY(row.BALTIC_DATE),
    balticRate: row.BALTIC_RATE != null ? String(row.BALTIC_RATE) : '',
    periodId: row.PERIODID != null ? String(row.PERIODID) : '',
    comId: row.COMID != null ? String(row.COMID) : '',
    vesselName: extras.vesselName || row.VESSEL_NAME || '',
    deliveryBunkers: extras.deliveryBunkers || [],
    redeliveryBunkers: extras.redeliveryBunkers || [],
    foConsumptions: extras.foConsumptions || [],
    doConsumptions: extras.doConsumptions || [],
    calc: extras.calc || null,
    otherIncome: extras.otherIncome || [],
    otherExpenses: extras.otherExpenses || [],
    offHires: extras.offHires || [],
    hirePeriods: extras.hirePeriods || [],
    itinerary: extras.itinerary || { from: {}, to: {} },
    itineraryExpenses: extras.itineraryExpenses || [],
    tcInExpenses: extras.tcInExpenses || null,
  };
}

export function mapCalcRow(row) {
  if (!row) {
    return {
      tripTc: '',
      period: '',
      noOfTrip: '',
      cpDate: '',
      cpType: '',
      charterers: '',
      delDate: '',
      reDelDate: '',
      delHfoMt: '',
      delHfoUsd: '',
      delMgoMt: '',
      delMgoUsd: '',
      reDelHfoMt: '',
      reDelHfoUsd: '',
      reDelMgoMt: '',
      reDelMgoUsd: '',
      delHfoAmt: '',
      delMdoAmt: '',
      reDelHfoAmt: '',
      reDelMdoAmt: '',
      bunkerDiffAmt: '',
      tcDays: '',
      utilisationDays: '',
      dailyGrossHire: '',
      addCommPct: '',
      addCommAmt: '',
      brokerCommPct: '',
      brokerCommAmt: '',
      nettHire: '',
      nettRev: '',
      lessOffHire: '',
      cve: '',
      otherIncome: '',
      totalRev: '',
      totalExp: '',
      voyageEarn: '',
      profitPerDay: '',
      exchangeCurrency: 'USD',
      exchangeRate: '1',
      tcDeliveryPort: '',
      tcRedeliveryPort: '',
      tcCpNumber: '',
      ballastBonus: '',
      cveMonth: '',
      ilohcAmt: '',
      nettHireInvoice: '',
      hireIncome: '',
      tcCpDate: '',
      tcFinalHireage: '',
      tcFinalVendor: '',
      tcOffHireCveMonth: '',
      tcOffHireCveAmt: '',
      tcBunkerOnOwner: '',
      tcLessOffHire: '',
      tcIlohc: '',
      awrpCost: '',
    };
  }
  return {
    slave1Id: row.TC_SLAVE1ID,
    tripTc: row.TRIP_TC_EST != null ? String(row.TRIP_TC_EST) : '',
    period: row.PERIOD_TC_EST != null ? String(row.PERIOD_TC_EST) : '',
    noOfTrip: row.NO_OF_TRIP_EST != null ? String(row.NO_OF_TRIP_EST) : '',
    cpDate: formatDateDMY(row.CP_DATE_EST),
    cpType: row.CP_TYPE_EST != null ? String(row.CP_TYPE_EST) : '',
    charterers: row.CHARTERERS_EST != null ? String(row.CHARTERERS_EST) : '',
    delDate: formatDateTimeDMY(row.DEL_DATE_EST) || formatDateDMY(row.DEL_DATE_EST),
    reDelDate: formatDateTimeDMY(row.REDEL_DATE_EST) || formatDateDMY(row.REDEL_DATE_EST),
    delHfoMt: row.DEL_HFO_MT_EST != null ? String(row.DEL_HFO_MT_EST) : '',
    delHfoUsd: row.DEL_HFO_USD_EST != null ? String(row.DEL_HFO_USD_EST) : '',
    delMgoMt: row.DEL_MGO_MT_EST != null ? String(row.DEL_MGO_MT_EST) : '',
    delMgoUsd: row.DEL_MGO_USD_EST != null ? String(row.DEL_MGO_USD_EST) : '',
    reDelHfoMt: row.REDEL_HFO_MT_EST != null ? String(row.REDEL_HFO_MT_EST) : '',
    reDelHfoUsd: row.REDEL_HFO_USD_EST != null ? String(row.REDEL_HFO_USD_EST) : '',
    reDelMgoMt: row.REDEL_MGO_MT_EST != null ? String(row.REDEL_MGO_MT_EST) : '',
    reDelMgoUsd: row.REDEL_MGO_USD_EST != null ? String(row.REDEL_MGO_USD_EST) : '',
    delHfoAmt: row.DEL_HFO_AMT != null ? String(row.DEL_HFO_AMT) : '',
    delMdoAmt: row.DEL_MDO_AMT != null ? String(row.DEL_MDO_AMT) : '',
    reDelHfoAmt: row.REDEL_HFO_AMT != null ? String(row.REDEL_HFO_AMT) : '',
    reDelMdoAmt: row.REDEL_MDO_AMT != null ? String(row.REDEL_MDO_AMT) : '',
    bunkerDiffAmt: row.BUNKER_DIFF_AMT != null ? String(row.BUNKER_DIFF_AMT) : '',
    tcDays: row.TC_DAYS_EST != null ? String(row.TC_DAYS_EST) : '',
    utilisationDays: row.UTILISATION_DAY_EST != null ? String(row.UTILISATION_DAY_EST) : '',
    dailyGrossHire: row.DAILY_GROSS_HIRE_EST != null ? String(row.DAILY_GROSS_HIRE_EST) : '',
    addCommPct: row.ADD_COMM_EST != null ? String(row.ADD_COMM_EST) : '',
    addCommAmt: row.ADD_COMM_CAL_EST != null ? String(row.ADD_COMM_CAL_EST) : '',
    brokerCommPct: row.BROKER_COMM_EST != null ? String(row.BROKER_COMM_EST) : '',
    brokerCommAmt: row.BROKER_COMM_CAL_EST != null ? String(row.BROKER_COMM_CAL_EST) : '',
    nettHire: row.NETT_HIRE_EST != null ? String(row.NETT_HIRE_EST) : '',
    nettRev: row.NETT_REV_EST != null ? String(row.NETT_REV_EST) : '',
    lessOffHire: row.LESS_OFF_HIRE_EST != null ? String(row.LESS_OFF_HIRE_EST) : '',
    cve: row.CVE_EST != null ? String(row.CVE_EST) : '',
    cveMonth: row.CVE_MONTH != null ? String(row.CVE_MONTH) : '',
    otherIncome: row.OTHER_INCOME_EST != null ? String(row.OTHER_INCOME_EST) : '',
    totalRev: row.TOTAL_REV_EST != null ? String(row.TOTAL_REV_EST) : '',
    totalExp: row.TOTAL_EXP_EST != null ? String(row.TOTAL_EXP_EST) : '',
    voyageEarn: row.VOYAGE_EARN_EST != null ? String(row.VOYAGE_EARN_EST) : '',
    profitPerDay: row.PROFIT_PER_DAY_EST != null ? String(row.PROFIT_PER_DAY_EST) : '',
    exchangeCurrency: row.EXCHANGE_CURRENCY || 'USD',
    exchangeRate: row.EXCHANGE_RATE != null ? String(row.EXCHANGE_RATE) : '1',
    tcDeliveryPort: row.TC_PORT_DELIVERY ?? '',
    tcRedeliveryPort: row.TC_PORT_REDELIVERY ?? '',
    tcCpNumber: row.TC_CP_NUMBER ?? '',
    ballastBonus: row.BALLAST_BONUS_AMT != null ? String(row.BALLAST_BONUS_AMT) : '',
    nettHireInvoice: row.NET_HIRE_AMT != null ? String(row.NET_HIRE_AMT) : '',
    tcCpDate: formatDateDMY(row.TC_CP_DATE),
    tcFinalHireage: row.TC_FINAL_HIERAGE != null ? String(row.TC_FINAL_HIERAGE) : '',
    tcFinalVendor: row.TC_FINAL_HIERAGE_VENDOR != null ? String(row.TC_FINAL_HIERAGE_VENDOR) : '',
    tcOffHireCveMonth: row.TC_CVE_MONTH_OFFHIRE != null ? String(row.TC_CVE_MONTH_OFFHIRE) : '',
    tcOffHireCveAmt: row.TC_CVE_AMOUNT_OFFHIRE != null ? String(row.TC_CVE_AMOUNT_OFFHIRE) : '',
    tcBunkerOnOwner: row.TC_BUNKERS_ON_OWNER != null ? String(row.TC_BUNKERS_ON_OWNER) : '',
    tcLessOffHire: row.TC_OFF_HIRE != null ? String(row.TC_OFF_HIRE) : '',
    tcIlohc: row.TXT_ILOHC_TC != null ? String(row.TXT_ILOHC_TC) : '',
    awrpCost: row.AWRPCOST != null ? String(row.AWRPCOST) : '',
    ilohcAmt: '',
    hireIncome: '',
  };
}

function bunkerGridTotal(rows = []) {
  return rows.reduce((sum, row) => {
    const qty = Number(row.qty);
    const price = Number(row.price);
    const amount = Number(row.amount);
    if (Number.isFinite(amount) && amount !== 0 && (!Number.isFinite(qty) || !Number.isFinite(price))) {
      return sum + amount;
    }
    const q = Number.isFinite(qty) ? qty : 0;
    const p = Number.isFinite(price) ? price : 0;
    return sum + (q * p);
  }, 0);
}

/** True when bunker grid has real qty/price/amount (not an empty placeholder row). */
function hasBunkerGridData(rows = []) {
  return Array.isArray(rows) && rows.some((row) => {
    const qty = Number(row.qty);
    const price = Number(row.price);
    const amount = Number(row.amount);
    return (Number.isFinite(qty) && qty !== 0)
      || (Number.isFinite(price) && price !== 0)
      || (Number.isFinite(amount) && amount !== 0)
      || (row.bunkerId != null && String(row.bunkerId).trim() !== '');
  });
}

function offHireBunkerTotal(row = {}) {
  const bunkers = Array.isArray(row.bunkers) ? row.bunkers : [];
  return bunkers.reduce((sum, bunker) => {
    const qty = Number(bunker.qty);
    const price = Number(bunker.price);
    return sum + ((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0));
  }, 0);
}

/**
 * P&L helpers aligned with php/updatetcestimatecal.php getFinalCalculation.
 * Hire income from hirePeriods (or dailyGrossHire × tcDays fallback).
 * Bunker diff = delivery total − redelivery total.
 * CVE amount = (cveMonth / 30) × utilisationDays when cveMonth is set.
 */
export function calcTcTotals(input = {}) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  let hireIncome = 0;
  let tcDays = 0;
  const hirePeriods = Array.isArray(input.hirePeriods) ? input.hirePeriods : [];
  const resolvedPeriods = hirePeriods.map((period) => {
    // PHP getFinalCalculation always recomputes TC days from del/redel dates when present.
    let days = num(period.days);
    if (period.delDate && period.reDelDate) {
      days = daysBetween(period.reDelDate, period.delDate);
    }
    const hireRate = num(period.hireRate);
    const amount = hireRate * days;
    hireIncome += amount;
    tcDays += days;
    return {
      ...period,
      days: days ? days.toFixed(4) : (days === 0 && period.delDate && period.reDelDate ? '0.0000' : ''),
      amount: amount.toFixed(2),
    };
  });

  if (!hirePeriods.length) {
    tcDays = num(input.tcDays);
    hireIncome = num(input.dailyGrossHire) * tcDays;
  }

  const ballastBonus = num(input.ballastBonus ?? input.ballastBonusAmt);
  const commissionBase = hireIncome + ballastBonus;
  const addCommPct = num(input.addCommPct);
  const brokerCommPct = num(input.brokerCommPct);
  const addCommAmt = (commissionBase * addCommPct) / 100;
  const brokerCommAmt = (commissionBase * brokerCommPct) / 100;
  const nettHire = hireIncome - addCommAmt - brokerCommAmt;
  const nettRev = hireIncome + ballastBonus - addCommAmt - brokerCommAmt;

  let delTotal = 0;
  let reDelTotal = 0;
  const delHfoAmt = num(input.delHfoMt) * num(input.delHfoUsd);
  const delMdoAmt = num(input.delMgoMt) * num(input.delMgoUsd);
  const reDelHfoAmt = num(input.reDelHfoMt) * num(input.reDelHfoUsd);
  const reDelMdoAmt = num(input.reDelMgoMt) * num(input.reDelMgoUsd);
  if (hasBunkerGridData(input.deliveryBunkers)) {
    delTotal = bunkerGridTotal(input.deliveryBunkers);
  } else {
    delTotal = delHfoAmt + delMdoAmt;
  }
  if (hasBunkerGridData(input.redeliveryBunkers)) {
    reDelTotal = bunkerGridTotal(input.redeliveryBunkers);
  } else {
    reDelTotal = reDelHfoAmt + reDelMdoAmt;
  }
  const bunkerDiffAmt = delTotal - reDelTotal;

  let offHireDays = 0;
  let lessOffHire = num(input.lessOffHire);
  const offHires = Array.isArray(input.offHires) ? input.offHires : [];
  if (offHires.length) {
    lessOffHire = 0;
    for (const row of offHires) {
      let days = num(row.days);
      const hasFrom = row.from != null && String(row.from).trim() !== '';
      // PHP only advances utilisation off-hire days when From is filled; amount still uses days×rate.
      if (hasFrom && row.to) {
        days = daysBetween(row.to, row.from);
      }
      if (hasFrom) {
        offHireDays += days;
      }
      lessOffHire += days * num(row.hireRate) + offHireBunkerTotal(row);
    }
  }

  const utilisationDays = tcDays - offHireDays;
  const hasCveMonth = input.cveMonth != null && String(input.cveMonth).trim() !== '';
  const cveMonth = num(input.cveMonth);
  const cve = hasCveMonth
    ? (cveMonth / 30) * utilisationDays
    : num(input.cve);
  const otherIncome = num(input.otherIncome);
  const ilohcAmt = num(input.ilohcAmt ?? input.ilohcUsd);
  const nettHireInvoice = nettRev - lessOffHire + cve + bunkerDiffAmt + ilohcAmt;
  const totalRev = nettHireInvoice + otherIncome;
  const totalExp = num(input.totalExp);
  const voyageEarn = totalRev - totalExp;
  const profitPerDay = utilisationDays ? voyageEarn / utilisationDays : 0;

  return {
    hirePeriods: resolvedPeriods,
    hireIncome: hireIncome.toFixed(2),
    tcDays: String(Number(tcDays.toFixed(4))),
    utilisationDays: String(Number(utilisationDays.toFixed(4))),
    delHfoAmt: delHfoAmt.toFixed(2),
    delMdoAmt: delMdoAmt.toFixed(2),
    reDelHfoAmt: reDelHfoAmt.toFixed(2),
    reDelMdoAmt: reDelMdoAmt.toFixed(2),
    delBunkerTotal: delTotal.toFixed(2),
    reDelBunkerTotal: reDelTotal.toFixed(2),
    bunkerDiffAmt: bunkerDiffAmt.toFixed(2),
    addCommAmt: addCommAmt.toFixed(2),
    brokerCommAmt: brokerCommAmt.toFixed(2),
    nettHire: nettHire.toFixed(2),
    nettRev: nettRev.toFixed(2),
    lessOffHire: lessOffHire.toFixed(2),
    cve: cve.toFixed(2),
    cveMonth: hasCveMonth ? String(input.cveMonth) : '',
    ballastBonus: ballastBonus.toFixed(2),
    ilohcAmt: ilohcAmt.toFixed(2),
    nettHireInvoice: nettHireInvoice.toFixed(2),
    totalRev: totalRev.toFixed(2),
    voyageEarn: voyageEarn.toFixed(2),
    profitPerDay: profitPerDay.toFixed(2),
  };
}

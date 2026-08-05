import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

const BUSINESS_TYPE_NAMES = {
  1: 'Gas',
  2: 'Tanker',
  3: 'Dry Cargo',
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmt(value, digits = 2) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(digits);
}

function blankDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted === '01-01-1970') return '';
  return formatted;
}

function buildRow(label, values, { section = '' } = {}) {
  const nums = values.map((v) => num(v));
  const first = nums[0] || 0;
  const last = nums.length ? nums[nums.length - 1] : 0;
  const difference = last - first;
  return {
    label,
    section,
    link: '',
    values: values.map((v) => (v == null || v === '' ? '' : fmt(v))),
    difference: fmt(difference),
    differenceTone: difference < 0 ? 'negative' : (difference > 0 ? 'positive' : 'neutral'),
    progressive: 'N/A',
  };
}

async function sumSlave1Field(pool, fcaId, field) {
  const [[row]] = await pool.query(
    `SELECT SUM(${field}) AS total FROM freight_cost_estimete_slave1 WHERE FCAID = ?`,
    [fcaId],
  ).catch(() => [[{ total: 0 }]]);
  return num(row?.total);
}

async function sumDemurrage(pool, fcaId) {
  const [lp] = await pool.query(
    `SELECT DDCLP_NETCOST AS amt FROM freight_cost_estimete_slave1 WHERE FCAID = ?`,
    [fcaId],
  ).catch(() => [[]]);
  const [dp] = await pool.query(
    `SELECT DDCDP_NETCOST AS amt FROM freight_cost_estimete_slave1 WHERE FCAID = ?`,
    [fcaId],
  ).catch(() => [[]]);
  let dem = 0;
  let dis = 0;
  for (const row of lp || []) {
    const amt = num(row.amt);
    if (amt > 0) dem += amt;
    if (amt < 0) dis += amt;
  }
  for (const row of dp || []) {
    const amt = num(row.amt);
    if (amt > 0) dem += amt;
    if (amt < 0) dis += amt;
  }
  return { demurrage: dem, dispatch: dis };
}

async function sumBrokerage(pool, fcaId) {
  const [[row]] = await pool.query(
    `SELECT SUM(BROKAGE_AMT) AS total FROM freight_cost_estimete_slave4 WHERE FCAID = ?`,
    [fcaId],
  ).catch(() => [[{ total: 0 }]]);
  return num(row?.total);
}

/**
 * PHP options.php getCompareSheetData (id=131) — VC voyage cost-sheet comparison.
 */
export async function dbGetCompareSheetsVc(comId) {
  const pool = getPool();
  const safeComId = Number(comId);
  if (!safeComId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const [masters] = await pool.query(
    `SELECT m.*, vim.VESSEL_NAME
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.COMID = ?
     ORDER BY m.FCAID ASC`,
    [safeComId],
  );

  if (!masters.length) {
    const error = new Error('No Voyage Financials sheets found for this nomination.');
    error.status = 404;
    throw error;
  }

  const primary = masters[masters.length - 1];
  const sheets = [];
  for (const master of masters) {
    let sheetName = 'FVF';
    if (master.SHEET_NO) {
      const [[sheet]] = await pool.query(
        `SELECT SHEET_NAME FROM cost_sheet_name_master WHERE COST_SHEETID = ? LIMIT 1`,
        [master.SHEET_NO],
      ).catch(() => [[null]]);
      sheetName = sheet?.SHEET_NAME || `Sheet ${master.SHEET_NO}`;
    }
    sheets.push({
      fcaId: String(master.FCAID),
      sheetNo: master.SHEET_NO != null ? String(master.SHEET_NO) : '',
      name: sheetName,
      isFvf: !master.SHEET_NO,
      isFixture: !master.SHEET_NO,
    });
  }

  const metrics = [];
  for (const master of masters) {
    const fcaId = master.FCAID;
    const { demurrage, dispatch } = await sumDemurrage(pool, fcaId);
    const loadPort = await sumSlave1Field(pool, fcaId, 'LOAD_PORT_COST');
    const discPort = await sumSlave1Field(pool, fcaId, 'DISC_PORT_COST');
    const transitPort = await sumSlave1Field(pool, fcaId, 'TRANSIT_PORT_COST');
    const brokerage = await sumBrokerage(pool, fcaId);
    const freight = num(master.REVENUES_FREIGHT);
    const cve = num(master.CVE_AMT || master.CVE_TOTALAMT);
    const addressComm = num(master.ADDRESS_COMMISSION_AMT);
    const bunker = num(master.BUNKER_EXPENSES || master.TOTAL_BUNKER_COST);
    const orc = num(master.TOTAL_ORC_EXP_AMT);
    const ballastBonus = num(master.BALLAST_BONUS);
    const hireage = num(master.FINAL_HIERAGE_AMOUNT || master.HIREAGE_NETT_AMT || master.HIDDEN_HIRAGE);
    const vesselDailyOps = num(master.DAILY_VESSEL_OPERATION_EXP);
    const totalRevenue = demurrage + dispatch + freight;
    const expenseCargo = loadPort + discPort + transitPort + orc + cve + addressComm + brokerage;
    const navExpenses = expenseCargo + bunker;
    const expenseShip = vesselDailyOps + hireage + ballastBonus;

    metrics.push({
      cargoType: BUSINESS_TYPE_NAMES[Number(master.ESTIMATE_TYPE)] || '',
      demurrage,
      dispatch,
      finalNettFreight: freight,
      totalRevenue,
      loadPort,
      discPort,
      transitPort,
      orc,
      cve,
      addressComm,
      brokerage,
      expenseCargo,
      ladenDist: num(master.LADEN_DIST),
      ballastDist: num(master.BALLAST_DIST),
      totalDist: num(master.TOTAL_DISTANCE),
      ladenDays: num(master.LADEN_DAYS),
      ballastDays: num(master.BALLAST_DAYS),
      totalSeaDays: num(master.TOTAL_PASSAGE_DAYS),
      idleDays: num(master.IDEAL_DAYS),
      workDays: num(master.WORKING_DAYS),
      totalDays: num(master.TOTAL_DAYS),
      foConsp: num(master.FO_CONSP),
      doConsp: num(master.DO_CONSP),
      bunker,
      navExpenses,
      vesselDailyOps,
      hireage,
      ballastBonus,
      expenseShip,
      dailyEarning: num(master.DAILY_EARNING || master.NET_DAILY_EARNING),
      netDailyProfit: num(master.NET_DAILY_PROFIT),
      profitLoss: num(master.PROFIT_LOSS || master.ACTUAL_PL),
    });
  }

  const pick = (key) => metrics.map((m) => m[key]);
  const rows = [
    buildRow('Cargo Type', pick('cargoType').map((v) => v || ''), { section: 'Cargo Type' }),
    buildRow('Demurrage', pick('demurrage'), { section: 'Revenue' }),
    buildRow('Dispatch', pick('dispatch'), { section: 'Revenue' }),
    buildRow('Final Nett Freight', pick('finalNettFreight'), { section: 'Revenue' }),
    buildRow('Total Revenue', pick('totalRevenue'), { section: 'Revenue' }),
    buildRow('Loading Port', pick('loadPort'), { section: 'Expenses - Cargo' }),
    buildRow('Discharge Port', pick('discPort'), { section: 'Expenses - Cargo' }),
    buildRow('Bunker / Transit Port', pick('transitPort'), { section: 'Expenses - Cargo' }),
    buildRow('Owner Related Costs', pick('orc'), { section: 'Expenses - Cargo' }),
    buildRow('CVE', pick('cve'), { section: 'Expenses - Cargo' }),
    buildRow('Address Commission', pick('addressComm'), { section: 'Expenses - Cargo' }),
    buildRow('Brokerage Commission', pick('brokerage'), { section: 'Expenses - Cargo' }),
    buildRow('Total Expense - Cargo', pick('expenseCargo'), { section: 'Expenses - Cargo' }),
    buildRow('Laden Dist', pick('ladenDist'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('Ballast Dist', pick('ballastDist'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('Total Dist', pick('totalDist'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('Laden Days', pick('ladenDays'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('Ballast Days', pick('ballastDays'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('Total Sea Days', pick('totalSeaDays'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('Port Idle Days', pick('idleDays'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('Port Work Days', pick('workDays'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('Total Days', pick('totalDays'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('FO Consp (MT)', pick('foConsp'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('DO Consp (MT)', pick('doConsp'), { section: 'Totals (Dist / Days / Consp)' }),
    buildRow('Total Bunker Expense', pick('bunker'), { section: 'Bunker Expenses' }),
    buildRow('Navigation Expenses', pick('navExpenses'), { section: 'Bunker Expenses' }),
    buildRow('Vessel Daily Ops', pick('vesselDailyOps'), { section: 'Expense - Ship' }),
    buildRow('Hireage', pick('hireage'), { section: 'Expense - Ship' }),
    buildRow('Ballast Bonus', pick('ballastBonus'), { section: 'Expense - Ship' }),
    buildRow('Total Expense - Ship', pick('expenseShip'), { section: 'Expense - Ship' }),
    buildRow('Daily Earnings / TCE', pick('dailyEarning'), { section: 'Results' }),
    buildRow('Nett Daily Profit', pick('netDailyProfit'), { section: 'Results' }),
    buildRow('P/L', pick('profitLoss'), { section: 'Results' }),
  ];

  // Fix cargo type row formatting (not numeric)
  rows[0] = {
    ...rows[0],
    values: pick('cargoType').map((v) => v || ''),
    difference: '',
    differenceTone: 'neutral',
  };

  const pls = pick('profitLoss');
  const plDifference = num(pls[pls.length - 1]) - num(pls[0]);

  return {
    comId: String(safeComId),
    header: {
      vesselName: primary.VESSEL_NAME || '',
      vesselType: primary.VESSEL_TYPE || '',
      flag: primary.FLAG || '',
      fixtureDate: blankDate(primary.TRANS_DATE),
      voyageNo: primary.VOYAGE_NO || '',
      voyageName: primary.VOYAGE_NAME || '',
      dwtSummer: primary.DWT_SUMMER != null ? String(primary.DWT_SUMMER) : '',
      dwtTropical: primary.DWT_TOPICAL != null ? String(primary.DWT_TOPICAL) : '',
    },
    sheets,
    rows,
    plDifference: fmt(plDifference),
    actualPl: fmt(num(pls[pls.length - 1]) - plDifference),
  };
}

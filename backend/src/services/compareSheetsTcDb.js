import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

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

async function sumSlave1(pool, tcOutId, field) {
  const [[row]] = await pool.query(
    `SELECT SUM(${field}) AS total
     FROM chartering_tc_estimate_slave1
     WHERE TCOUTID = ?`,
    [tcOutId],
  ).catch(() => [[{ total: 0 }]]);
  return num(row?.total);
}

async function sumSlave8Hire(pool, tcOutId) {
  const [[row]] = await pool.query(
    `SELECT SUM(s8.HIRE_AMT) AS total
     FROM chartering_estimate_tc_slave8 s8
     INNER JOIN chartering_tc_estimate_slave1 s1 ON s1.TC_SLAVE1ID = s8.TC_SLAVE1ID
     WHERE s1.TCOUTID = ?`,
    [tcOutId],
  ).catch(() => [[{ total: 0 }]]);
  return num(row?.total);
}

async function sumOtherExpenses(pool, tcOutId) {
  const [[row]] = await pool.query(
    `SELECT SUM(s2.OTHER_AMT) AS total
     FROM chartering_estimate_tc_slave2 s2
     INNER JOIN chartering_tc_estimate_slave1 s1 ON s1.TC_SLAVE1ID = s2.TC_SLAVE1ID
     WHERE s1.TCOUTID = ? AND s2.STATUS = 2`,
    [tcOutId],
  ).catch(() => [[{ total: 0 }]]);
  return num(row?.total);
}

async function latestHireInvoiceAmt(pool, comId) {
  const [[row]] = await pool.query(
    `SELECT HIRE_INV_AMT
     FROM invoice_tchire_master
     WHERE COMID = ?
     ORDER BY INVOICEID DESC
     LIMIT 1`,
    [comId],
  ).catch(() => [[null]]);
  return num(row?.HIRE_INV_AMT);
}

async function paidOtherExpenses(pool, comId) {
  const [[pay]] = await pool.query(
    `SELECT SUM(P_AMT) AS total
     FROM payment_tcother_master
     WHERE COMID = ?
       AND (INV_IDENTITY = 'Other Payment' OR INV_IDENTITY = 'Brokers Commission')
       AND (PAYMENT_STATUS IS NULL OR PAYMENT_STATUS != 'payment_hold')`,
    [comId],
  ).catch(() => [[{ total: 0 }]]);
  const [[req]] = await pool.query(
    `SELECT SUM(P_AMT) AS total FROM request_mastertc WHERE COMID = ?`,
    [comId],
  ).catch(() => [[{ total: 0 }]]);
  const [[hold]] = await pool.query(
    `SELECT SUM(FINAL_AMOUNT) AS total
     FROM payment_tcother_master
     WHERE COMID = ?
       AND (INV_IDENTITY = 'Other Payment' OR INV_IDENTITY = 'Brokers Commission')
       AND STATUS = 5 AND PAYMENT_STATUS = 'payment_hold'`,
    [comId],
  ).catch(() => [[{ total: 0 }]]);
  return num(pay?.total) + num(req?.total) + num(hold?.total);
}

async function paidHireExpense(pool, comId) {
  const [[row]] = await pool.query(
    `SELECT SUM(P_AMT) AS total
     FROM invoice_hiretc_master
     WHERE COMID = ? AND INVOICE_TYPE != 'PFHS'`,
    [comId],
  ).catch(() => [[{ total: 0 }]]);
  const [[acc]] = await pool.query(
    `SELECT SUM(BALANCE_TO_OWNER) AS total
     FROM invoice_hiretc_master
     WHERE COMID = ? AND INVOICE_TYPE = 'Accrual'`,
    [comId],
  ).catch(() => [[{ total: 0 }]]);
  return num(row?.total) + num(acc?.total);
}

function buildRow(label, values, { section = '', link = '' } = {}) {
  const nums = values.map((v) => (v === '' || v == null ? null : num(v)));
  const first = nums.find((v) => v != null) ?? 0;
  const last = [...nums].reverse().find((v) => v != null) ?? first;
  const difference = last - first;
  return {
    label,
    section,
    link,
    values: values.map((v) => (v === '' || v == null ? '' : fmt(v))),
    difference: fmt(difference),
    differenceTone: difference < 0 ? 'negative' : (difference > 0 ? 'positive' : 'neutral'),
    progressive: 'N/A',
  };
}

export async function dbGetCompareSheetsTc(comId) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const [[header]] = await pool.query(
    `SELECT m.TC_DATE, m.TC_NO, m.CP_DATE1, m.SUMMER_DWT, m.VESSEL_IMO_ID, m.VESSEL_TYPE, vim.VESSEL_NAME
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.COMID = c.COMID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.COMID = ? AND c.MODULEID = ? AND c.MCOMPANYID = ?
     ORDER BY m.TCOUTID DESC
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
  );

  if (!header) {
    const error = new Error('TC nomination not found.');
    error.status = 404;
    throw error;
  }

  // TC master has TOTAL_DAYS / TOTAL_EARNING; P/L lives on slave1 (VOYAGE_EARN_EST / PROFIT_PER_DAY_EST),
  // not freight_cost_estimete_master.PROFIT_LOSS / NET_DAILY_PROFIT.
  const [masters] = await pool.query(
    `SELECT m.TCOUTID, m.SHEET_NO, m.TOTAL_DAYS, m.TOTAL_EARNING
     FROM chartering_estimate_tc_master m
     WHERE m.COMID = ? AND m.MODULEID = ?
     ORDER BY m.TCOUTID ASC`,
    [comId, MODULE_ID],
  );

  if (!masters.length) {
    const error = new Error('No TC sheets found for this nomination.');
    error.status = 404;
    throw error;
  }

  const sheets = [];
  for (const master of masters) {
    let sheetName = 'Fixture TC';
    if (master.SHEET_NO) {
      const [[sheet]] = await pool.query(
        `SELECT SHEET_NAME FROM cost_sheettc_name_master WHERE COST_SHEETID = ? LIMIT 1`,
        [master.SHEET_NO],
      ).catch(() => [[null]]);
      sheetName = sheet?.SHEET_NAME || `Sheet ${master.SHEET_NO}`;
    }
    sheets.push({
      tcOutId: String(master.TCOUTID),
      sheetNo: master.SHEET_NO != null ? String(master.SHEET_NO) : '',
      name: sheetName,
      isFixture: !master.SHEET_NO,
    });
  }

  const metrics = [];
  for (const master of masters) {
    const tcOutId = master.TCOUTID;
    const isFixture = !master.SHEET_NO;
    const grossHire = isFixture
      ? await sumSlave8Hire(pool, tcOutId)
      : await latestHireInvoiceAmt(pool, comId);
    const otherExp = isFixture
      ? await sumOtherExpenses(pool, tcOutId)
      : await paidOtherExpenses(pool, comId);
    const netHireage = isFixture
      ? await sumSlave1(pool, tcOutId, 'TC_FINAL_HIERAGE')
      : await paidHireExpense(pool, comId);

    const tcEarnings = await sumSlave1(pool, tcOutId, 'VOYAGE_EARN_EST');
    const profitPerDay = await sumSlave1(pool, tcOutId, 'PROFIT_PER_DAY_EST');

    metrics.push({
      dailyGrossHire: await sumSlave1(pool, tcOutId, 'DAILY_GROSS_HIRE_EST'),
      grossHire,
      addComm: await sumSlave1(pool, tcOutId, 'ADD_COMM_CAL_EST'),
      brokerComm: await sumSlave1(pool, tcOutId, 'BROKER_COMM_CAL_EST'),
      nettHire: await sumSlave1(pool, tcOutId, 'NETT_HIRE_EST'),
      otherExpenses: otherExp,
      netHireage,
      totalExpenses: otherExp + netHireage,
      tcEarnings,
      profitPerDay,
      // TC has no master PROFIT_LOSS / NET_DAILY_PROFIT — use slave1 aggregates (legacy compare sheet).
      netDailyProfit: profitPerDay,
      profitLoss: tcEarnings,
    });
  }

  const pick = (key) => metrics.map((m) => m[key]);

  const rows = [
    buildRow('Daily Gross Hire(USD/Day)', pick('dailyGrossHire'), { section: 'REVENUE' }),
    buildRow('Gross Hire', pick('grossHire'), { section: 'REVENUE' }),
    buildRow('Add Comm(USD)', pick('addComm'), { section: 'REVENUE' }),
    buildRow("Broker's Comm(USD)", pick('brokerComm'), { section: 'REVENUE' }),
    buildRow('Nett Hire(USD/day)', pick('nettHire'), { section: 'REVENUE' }),
    buildRow('Other expenses(USD)', pick('otherExpenses'), { section: 'EXPENSES' }),
    buildRow('Nett Hireage', pick('netHireage'), { section: 'EXPENSES' }),
    buildRow('Total Expenses(USD)', pick('totalExpenses'), { section: 'EXPENSES' }),
    buildRow('TC Earnings(USD)', pick('tcEarnings'), { section: 'RESULTS' }),
    buildRow('Profit/Day(USD)', pick('profitPerDay'), { section: 'RESULTS' }),
    buildRow('Nett Daily Profit', pick('netDailyProfit'), { section: 'RESULTS' }),
    buildRow('P/L', pick('profitLoss'), { section: 'RESULTS' }),
  ];

  const plDiff = num(metrics[metrics.length - 1]?.profitLoss) - num(metrics[0]?.profitLoss);

  return {
    comId: String(comId),
    header: {
      vesselName: header.VESSEL_NAME || '',
      vesselType: header.VESSEL_TYPE || '',
      dwtSummer: header.SUMMER_DWT != null ? String(header.SUMMER_DWT) : '',
      fixtureDate: blankDate(header.TC_DATE),
      cpDate: blankDate(header.CP_DATE1),
      tcNo: header.TC_NO || '',
    },
    sheets,
    rows,
    plDifference: fmt(plDiff),
    actualPl: fmt(num(metrics[metrics.length - 1]?.profitLoss) - plDiff),
  };
}

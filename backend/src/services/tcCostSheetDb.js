import { appContext } from '../config.js';
import { getPool } from '../db.js';
import {
  formatDateDMY,
  formatDateTimeDMY,
  mapCalcRow,
  nullIfEmpty,
  toDbDate,
} from './tcEstimateMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function bunkerIdentity(row = {}) {
  return String(row.IDENTITY ?? row.IDENTIFY ?? row.identity ?? '').trim().toUpperCase();
}

function mapBunkerRow(row) {
  return {
    bunkerId: row.BUNKERID != null ? String(row.BUNKERID) : '',
    amount: row.AMOUNT != null ? String(row.AMOUNT) : '',
    bunkerDate: formatDateDMY(row.BUNKER_DATE),
    qty: row.QTY != null ? String(row.QTY) : '',
    price: row.PRICE != null ? String(row.PRICE) : '',
    identity: bunkerIdentity(row),
  };
}

function randomId() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

async function loadSheetName(pool, comId, costSheetId) {
  const [[row]] = await pool.query(
    `SELECT SHEET_NAME
     FROM cost_sheettc_name_master
     WHERE COST_SHEETID = ? AND COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [costSheetId, comId, MODULE_ID, COMPANY_ID],
  );
  return row?.SHEET_NAME || '';
}

async function loadOperator(pool, comId) {
  const [[row]] = await pool.query(
    `SELECT OPERATOR FROM chartering_estimate_tc_compare
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
  ).catch(() => [[null]]);
  return row?.OPERATOR != null ? String(row.OPERATOR) : '';
}

async function loadChartererName(pool, code) {
  if (!code) return '';
  const [[row]] = await pool.query(
    `SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1`,
    [code],
  ).catch(() => [[null]]);
  return row?.NAME || '';
}

async function loadCpTypeName(pool, id) {
  if (!id) return '';
  const [[row]] = await pool.query(
    `SELECT CONTRACT_TYPE FROM contract_type_master WHERE CONTRACTTYPEID = ? LIMIT 1`,
    [id],
  ).catch(() => [[null]]);
  return row?.CONTRACT_TYPE || '';
}

async function loadTripExtras(pool, slave1Id) {
  const empty = {
    otherIncome: [],
    otherExpenses: [],
    offHires: [],
    deliveryBunkers: [],
    redeliveryBunkers: [],
    hirePeriods: [],
  };
  if (!slave1Id) return empty;

  const [incomeRows] = await pool.query(
    `SELECT DESCRIPTION, OTHER_AMT FROM chartering_estimate_tc_slave2
     WHERE TC_SLAVE1ID = ? AND STATUS = 1`,
    [slave1Id],
  ).catch(() => [[]]);
  const [expenseRows] = await pool.query(
    `SELECT EXPENSETYPEID, DESCRIPTION, CHK_ADDTTL, OTHER_AMT FROM chartering_estimate_tc_slave2
     WHERE TC_SLAVE1ID = ? AND STATUS = 2`,
    [slave1Id],
  ).catch(() => [[]]);
  const [offHireRows] = await pool.query(
    `SELECT OFF_REASON, OFF_FROM, OFF_TO, OFF_DAYS, HIRE_RATE, OFF_HIRE
     FROM chartering_estimate_tc_slave3 WHERE TC_SLAVE1ID = ?`,
    [slave1Id],
  ).catch(() => [[]]);
  const [bunkerRows] = await pool.query(
    `SELECT BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY
     FROM chartering_estimate_tc_slave5 WHERE TC_SLAVE1ID = ?`,
    [slave1Id],
  ).catch(() => [[]]);

  let hirePeriods = [];
  try {
    const [periodRows] = await pool.query(
      `SELECT DEL_DATE, RE_DEL_DATE, HIRE_DAYS, HIRE_RATE, HIRE_AMT, RANDOMID
       FROM chartering_estimate_tc_slave8 WHERE TC_SLAVE1ID = ?`,
      [slave1Id],
    );
    hirePeriods = periodRows.map((r) => ({
      delDate: formatDateTimeDMY(r.DEL_DATE),
      reDelDate: formatDateTimeDMY(r.RE_DEL_DATE),
      days: r.HIRE_DAYS != null ? String(r.HIRE_DAYS) : '',
      hireRate: r.HIRE_RATE != null ? String(r.HIRE_RATE) : '',
      amount: r.HIRE_AMT != null ? String(r.HIRE_AMT) : '',
      randomId: r.RANDOMID != null ? String(r.RANDOMID) : '',
    }));
  } catch {
    hirePeriods = [];
  }

  return {
    otherIncome: incomeRows.map((r) => ({
      description: r.DESCRIPTION ?? '',
      amount: r.OTHER_AMT != null ? String(r.OTHER_AMT) : '',
    })),
    otherExpenses: expenseRows.map((r) => ({
      expenseTypeId: r.EXPENSETYPEID != null ? String(r.EXPENSETYPEID) : '',
      description: r.DESCRIPTION ?? '',
      addToTotal: Number(r.CHK_ADDTTL || 0) === 1,
      amount: r.OTHER_AMT != null ? String(r.OTHER_AMT) : '',
    })),
    offHires: offHireRows.map((r) => ({
      reason: r.OFF_REASON ?? '',
      from: formatDateTimeDMY(r.OFF_FROM) || formatDateDMY(r.OFF_FROM),
      to: formatDateTimeDMY(r.OFF_TO) || formatDateDMY(r.OFF_TO),
      days: r.OFF_DAYS != null ? String(r.OFF_DAYS) : '',
      hireRate: r.HIRE_RATE != null ? String(r.HIRE_RATE) : '',
      amount: r.OFF_HIRE != null ? String(r.OFF_HIRE) : '',
    })),
    deliveryBunkers: bunkerRows.filter((r) => bunkerIdentity(r) === 'DEL').map(mapBunkerRow),
    redeliveryBunkers: bunkerRows.filter((r) => bunkerIdentity(r) === 'REDEL').map(mapBunkerRow),
    hirePeriods,
  };
}

async function loadTrips(pool, tcOutId) {
  const [rows] = await pool.query(
    `SELECT * FROM chartering_tc_estimate_slave1 WHERE TCOUTID = ? ORDER BY TC_SLAVE1ID ASC`,
    [tcOutId],
  );
  const trips = [];
  for (const row of rows) {
    const calc = mapCalcRow(row);
    const extras = await loadTripExtras(pool, row.TC_SLAVE1ID);
    if (!extras.hirePeriods.length && (calc.delDate || calc.reDelDate || calc.dailyGrossHire)) {
      const rate = Number(calc.dailyGrossHire) || 0;
      const exchange = Number(calc.exchangeRate);
      const ex = Number.isFinite(exchange) && exchange !== 0 ? exchange : 1;
      extras.hirePeriods = [{
        delDate: calc.delDate || '',
        reDelDate: calc.reDelDate || '',
        days: calc.tcDays || '',
        hireRate: (rate * ex).toFixed(2),
        amount: '',
        randomId: row.RANDOMID != null ? String(row.RANDOMID) : randomId(),
      }];
    }
    trips.push({
      ...calc,
      randomId: row.RANDOMID != null ? String(row.RANDOMID) : '',
      ...extras,
    });
  }
  return trips;
}

async function mapHeader(pool, master, comId) {
  let vesselName = '';
  if (master.VESSEL_IMO_ID) {
    const [[vessel]] = await pool.query(
      `SELECT VESSEL_NAME FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? LIMIT 1`,
      [master.VESSEL_IMO_ID],
    ).catch(() => [[null]]);
    vesselName = vessel?.VESSEL_NAME || '';
  }
  const [chartererName, cpTypeName, operatorId] = await Promise.all([
    loadChartererName(pool, master.SEL_CHARTERER),
    loadCpTypeName(pool, master.SEL_CP_TYPE),
    loadOperator(pool, comId),
  ]);
  return {
    tcOutId: master.TCOUTID,
    comId: master.COMID != null ? String(master.COMID) : String(comId),
    vesselImoId: master.VESSEL_IMO_ID != null ? String(master.VESSEL_IMO_ID) : '',
    vesselName,
    vesselType: master.VESSEL_TYPE ?? '',
    flag: master.FLAG ?? '',
    tcDate: formatDateDMY(master.TC_DATE),
    tcNo: master.TC_NO ?? '',
    cpDate: formatDateDMY(master.CP_DATE1),
    cpType: master.SEL_CP_TYPE != null ? String(master.SEL_CP_TYPE) : '',
    cpTypeName,
    charterer: master.SEL_CHARTERER != null ? String(master.SEL_CHARTERER) : '',
    chartererName,
    tripTc: master.TRIP_TC != null ? String(master.TRIP_TC) : '',
    period: master.PERIOD != null ? String(master.PERIOD) : '',
    noOfTrip: master.NO_OF_TRIP != null ? String(master.NO_OF_TRIP) : '',
    periodId: master.PERIODID != null ? String(master.PERIODID) : '',
    totalDays: master.TOTAL_DAYS != null ? String(master.TOTAL_DAYS) : '',
    totalEarning: master.TOTAL_EARNING != null ? String(master.TOTAL_EARNING) : '',
    finalStatus: master.FINAL_STATUS != null ? Number(master.FINAL_STATUS) : 0,
    operatorId,
    hireFixPer: master.HIRE_FIX_PER != null ? String(master.HIRE_FIX_PER) : '',
    addComm: master.ADD_COMM != null ? String(master.ADD_COMM) : '',
    brokerComm: master.BROKER_COMM != null ? String(master.BROKER_COMM) : '',
    exchangeRate: master.EXCHANGE_RATE != null ? String(master.EXCHANGE_RATE) : '1',
    cveMonth: master.CVE_MONTH != null ? String(master.CVE_MONTH) : '',
  };
}

async function findSheetMaster(pool, comId, costSheetId) {
  const [[row]] = await pool.query(
    `SELECT * FROM chartering_estimate_tc_master
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND SHEET_NO = ?
     ORDER BY TCOUTID DESC
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, costSheetId],
  );
  return row || null;
}

async function findLatestMaster(pool, comId) {
  const [[row]] = await pool.query(
    `SELECT * FROM chartering_estimate_tc_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY TCOUTID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  );
  return row || null;
}

/** GET cost sheet — mode create | edit | closed. */
export async function dbGetTcCostSheet(comId, costSheetId) {
  if (!comId || !costSheetId) {
    const error = new Error('COMID and cost sheet id are required.');
    error.status = 400;
    throw error;
  }
  const pool = getPool();
  const sheetName = await loadSheetName(pool, comId, costSheetId);
  const sheetMaster = await findSheetMaster(pool, comId, costSheetId);

  let mode = 'create';
  let master = null;
  if (sheetMaster) {
    mode = Number(sheetMaster.FINAL_STATUS) === 1 ? 'closed' : 'edit';
    master = sheetMaster;
  } else {
    master = await findLatestMaster(pool, comId);
    if (!master) {
      const error = new Error('TC estimate not found for this nomination.');
      error.status = 404;
      throw error;
    }
  }

  const header = await mapHeader(pool, master, comId);
  const trips = await loadTrips(pool, master.TCOUTID);

  let periodContracts = [];
  try {
    const [rows] = await pool.query(
      `SELECT PERIODID AS id, PERIOD_NAME AS name
       FROM period_contract_master
       WHERE MODULEID = ? AND MCOMPANYID = ? AND STATUS = 1
       ORDER BY PERIOD_NAME`,
      [MODULE_ID, COMPANY_ID],
    );
    periodContracts = rows.map((r) => ({ id: String(r.id), name: r.name }));
  } catch {
    periodContracts = [];
  }

  let bunkers = [];
  try {
    const [rows] = await pool.query(
      `SELECT BUNKERGRADEID AS id, NAME AS name FROM bunker_grade_master
       WHERE MODULEID = ? AND MCOMPANYID = ? ORDER BY NAME`,
      [MODULE_ID, COMPANY_ID],
    );
    bunkers = rows.map((r) => ({ id: String(r.id), name: r.name }));
  } catch {
    bunkers = [];
  }

  let expenseTypes = [];
  try {
    const [rows] = await pool.query(
      `SELECT EXPENSETYPEID AS id, EXPENSE_TYPE AS name FROM expense_type_master
       WHERE MODULEID = ? AND MCOMPANYID = ? ORDER BY EXPENSE_TYPE`,
      [MODULE_ID, COMPANY_ID],
    );
    expenseTypes = rows.map((r) => ({ id: String(r.id), name: r.name }));
  } catch {
    expenseTypes = [];
  }

  return {
    mode,
    sheetName,
    costSheetId: String(costSheetId),
    comId: String(comId),
    sourceTcOutId: mode === 'create' ? master.TCOUTID : null,
    tcOutId: mode === 'create' ? null : master.TCOUTID,
    header,
    trips: trips.length ? trips : [emptyTrip(header)],
    lookups: { periodContracts, bunkers, expenseTypes },
  };
}

function emptyTrip(header = {}) {
  return {
    slave1Id: '',
    randomId: randomId(),
    delDate: '',
    reDelDate: '',
    tcDays: '',
    utilisationDays: '',
    dailyGrossHire: header.hireFixPer || '',
    exchangeCurrency: 'USD',
    exchangeRate: header.exchangeRate || '1',
    addCommPct: header.addComm || '',
    addCommAmt: '',
    brokerCommPct: header.brokerComm || '',
    brokerCommAmt: '',
    nettHire: '',
    nettRev: '',
    lessOffHire: '',
    cve: '',
    cveMonth: header.cveMonth || '',
    otherIncome: [],
    otherIncomeTotal: '',
    totalRev: '',
    totalExp: '',
    voyageEarn: '',
    profitPerDay: '',
    ballastBonus: '',
    bunkerDiffAmt: '',
    hirePeriods: [{ delDate: '', reDelDate: '', days: '', hireRate: '', amount: '', randomId: randomId() }],
    deliveryBunkers: [{ bunkerId: '', qty: '', price: '', amount: '', bunkerDate: '' }],
    redeliveryBunkers: [{ bunkerId: '', qty: '', price: '', amount: '', bunkerDate: '' }],
    offHires: [],
    otherExpenses: [],
  };
}

async function replaceTripChildren(connection, slave1Id, trip = {}) {
  await connection.query('DELETE FROM chartering_estimate_tc_slave2 WHERE TC_SLAVE1ID = ?', [slave1Id]);
  await connection.query('DELETE FROM chartering_estimate_tc_slave3 WHERE TC_SLAVE1ID = ?', [slave1Id]);
  await connection.query('DELETE FROM chartering_estimate_tc_slave5 WHERE TC_SLAVE1ID = ?', [slave1Id]);
  await connection.query('DELETE FROM chartering_estimate_tc_slave8 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});

  for (const row of trip.otherIncome || []) {
    if (!row.amount && !row.description) continue;
    await connection.query(
      `INSERT INTO chartering_estimate_tc_slave2
       (TC_SLAVE1ID, DESCRIPTION, OTHER_AMT, STATUS) VALUES (?, ?, ?, 1)`,
      [slave1Id, nullIfEmpty(row.description), nullIfEmpty(row.amount)],
    );
  }
  for (const row of trip.otherExpenses || []) {
    if (!row.amount && !row.description && !row.expenseTypeId) continue;
    await connection.query(
      `INSERT INTO chartering_estimate_tc_slave2
       (TC_SLAVE1ID, EXPENSETYPEID, DESCRIPTION, CHK_ADDTTL, OTHER_AMT, STATUS)
       VALUES (?, ?, ?, ?, ?, 2)`,
      [
        slave1Id,
        nullIfEmpty(row.expenseTypeId),
        nullIfEmpty(row.description),
        row.addToTotal ? 1 : 0,
        nullIfEmpty(row.amount),
      ],
    );
  }
  for (const row of trip.offHires || []) {
    if (!row.reason && !row.amount && !row.from && !row.to) continue;
    await connection.query(
      `INSERT INTO chartering_estimate_tc_slave3
       (TC_SLAVE1ID, OFF_REASON, OFF_FROM, OFF_TO, OFF_DAYS, HIRE_RATE, OFF_HIRE)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        slave1Id,
        nullIfEmpty(row.reason),
        toDbDate(row.from, true),
        toDbDate(row.to, true),
        nullIfEmpty(row.days),
        nullIfEmpty(row.hireRate),
        nullIfEmpty(row.amount),
      ],
    );
  }

  const bunkers = [
    ...(trip.deliveryBunkers || []).map((r) => ({ ...r, identity: 'DEL' })),
    ...(trip.redeliveryBunkers || []).map((r) => ({ ...r, identity: 'REDEL' })),
  ];
  for (const row of bunkers) {
    if (!row.bunkerId && !row.qty) continue;
    const amount = row.amount != null && row.amount !== ''
      ? row.amount
      : String((Number(row.qty) || 0) * (Number(row.price) || 0));
    await connection.query(
      `INSERT INTO chartering_estimate_tc_slave5
       (TC_SLAVE1ID, BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        slave1Id,
        nullIfEmpty(row.bunkerId),
        nullIfEmpty(amount),
        toDbDate(row.bunkerDate),
        nullIfEmpty(row.qty),
        nullIfEmpty(row.price),
        row.identity,
      ],
    );
  }

  for (const row of trip.hirePeriods || []) {
    if (!row.delDate && !row.reDelDate && !row.hireRate && !row.days) continue;
    try {
      await connection.query(
        `INSERT INTO chartering_estimate_tc_slave8
         (TC_SLAVE1ID, DEL_DATE, RE_DEL_DATE, HIRE_DAYS, HIRE_RATE, HIRE_AMT, RANDOMID)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          slave1Id,
          toDbDate(row.delDate, true),
          toDbDate(row.reDelDate, true),
          nullIfEmpty(row.days),
          nullIfEmpty(row.hireRate),
          nullIfEmpty(row.amount),
          nullIfEmpty(row.randomId) || randomId(),
        ],
      );
    } catch {
      break;
    }
  }
}

function tripSlave1Fields(trip, header = {}) {
  const firstHire = (trip.hirePeriods || [])[0] || {};
  return {
    TRIP_TC_EST: nullIfEmpty(header.tripTc),
    PERIOD_TC_EST: nullIfEmpty(header.period),
    NO_OF_TRIP_EST: nullIfEmpty(header.noOfTrip),
    DEL_DATE_EST: toDbDate(firstHire.delDate || trip.delDate, true),
    REDEL_DATE_EST: toDbDate(firstHire.reDelDate || trip.reDelDate, true),
    TC_DAYS_EST: nullIfEmpty(firstHire.days || trip.tcDays),
    UTILISATION_DAY_EST: nullIfEmpty(trip.utilisationDays),
    DAILY_GROSS_HIRE_EST: nullIfEmpty(trip.dailyGrossHire),
    EXCHANGE_CURRENCY: nullIfEmpty(trip.exchangeCurrency) || 'USD',
    EXCHANGE_RATE: nullIfEmpty(trip.exchangeRate) || '1',
    ADD_COMM_EST: nullIfEmpty(trip.addCommPct),
    ADD_COMM_CAL_EST: nullIfEmpty(trip.addCommAmt),
    BROKER_COMM_EST: nullIfEmpty(trip.brokerCommPct),
    BROKER_COMM_CAL_EST: nullIfEmpty(trip.brokerCommAmt),
    NETT_HIRE_EST: nullIfEmpty(trip.nettHire),
    NETT_REV_EST: nullIfEmpty(trip.nettRev),
    LESS_OFF_HIRE_EST: nullIfEmpty(trip.lessOffHire),
    CVE_EST: nullIfEmpty(trip.cve),
    CVE_MONTH: nullIfEmpty(trip.cveMonth),
    OTHER_INCOME_EST: nullIfEmpty(trip.otherIncomeTotal || sumAmounts(trip.otherIncome)),
    TOTAL_REV_EST: nullIfEmpty(trip.totalRev),
    TOTAL_EXP_EST: nullIfEmpty(trip.totalExp),
    VOYAGE_EARN_EST: nullIfEmpty(trip.voyageEarn),
    PROFIT_PER_DAY_EST: nullIfEmpty(trip.profitPerDay),
    BUNKER_DIFF_AMT: nullIfEmpty(trip.bunkerDiffAmt),
    BALLAST_BONUS_AMT: nullIfEmpty(trip.ballastBonus),
    RANDOMID: nullIfEmpty(trip.randomId) || randomId(),
  };
}

function sumAmounts(rows = []) {
  const total = (rows || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  return total ? total.toFixed(2) : '';
}

async function upsertTrip(connection, tcOutId, trip, header) {
  let fields = tripSlave1Fields(trip, header);
  let slave1Id = trip.slave1Id ? Number(trip.slave1Id) : null;

  if (slave1Id) {
    const [[existing]] = await connection.query(
      `SELECT TC_SLAVE1ID FROM chartering_tc_estimate_slave1
       WHERE TC_SLAVE1ID = ? AND TCOUTID = ? LIMIT 1`,
      [slave1Id, tcOutId],
    );
    if (!existing) slave1Id = null;
  }

  async function write(fieldMap) {
    const cols = Object.keys(fieldMap);
    try {
      if (!slave1Id) {
        const [result] = await connection.query(
          `INSERT INTO chartering_tc_estimate_slave1
           (TCOUTID, UPDATE_ON_DATE, ${cols.join(', ')})
           VALUES (?, NOW(), ${cols.map(() => '?').join(', ')})`,
          [tcOutId, ...Object.values(fieldMap)],
        );
        slave1Id = result.insertId;
      } else {
        const sets = cols.map((col) => `${col} = ?`).join(', ');
        await connection.query(
          `UPDATE chartering_tc_estimate_slave1
           SET ${sets}, UPDATE_ON_DATE = NOW()
           WHERE TC_SLAVE1ID = ? AND TCOUTID = ?`,
          [...Object.values(fieldMap), slave1Id, tcOutId],
        );
      }
    } catch (error) {
      const msg = String(error?.message || '');
      const unknown = msg.match(/Unknown column '([^']+)'/i);
      if (unknown && fieldMap[unknown[1]] !== undefined) {
        const next = { ...fieldMap };
        delete next[unknown[1]];
        return write(next);
      }
      throw error;
    }
  }

  await write(fields);
  await replaceTripChildren(connection, slave1Id, trip);
  return slave1Id;
}

async function cloneMasterRow(connection, source, overrides = {}) {
  const skip = new Set(['TCOUTID']);
  const payload = {};
  for (const [key, value] of Object.entries(source)) {
    if (skip.has(key)) continue;
    payload[key] = value;
  }
  Object.assign(payload, overrides);
  const cols = Object.keys(payload);
  const [result] = await connection.query(
    `INSERT INTO chartering_estimate_tc_master (${cols.join(', ')})
     VALUES (${cols.map(() => '?').join(', ')})`,
    Object.values(payload),
  );
  return result.insertId;
}

/** POST create or update cost sheet. */
export async function dbSaveTcCostSheet(comId, costSheetId, body = {}) {
  if (!comId || !costSheetId) {
    const error = new Error('COMID and cost sheet id are required.');
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await findSheetMaster(connection, comId, costSheetId);
    if (existing && Number(existing.FINAL_STATUS) === 1) {
      const error = new Error('This cost sheet is closed and cannot be edited.');
      error.status = 400;
      throw error;
    }

    const header = body.header || {};
    const trips = Array.isArray(body.trips) ? body.trips : [];
    const finalStatus = body.finalStatus != null ? Number(body.finalStatus) : 0;
    const totalDays = nullIfEmpty(header.totalDays);
    const totalEarning = nullIfEmpty(header.totalEarning);

    let tcOutId;

    if (!existing) {
      const source = await findLatestMaster(connection, comId);
      if (!source) {
        const error = new Error('TC estimate not found for this nomination.');
        error.status = 404;
        throw error;
      }

      tcOutId = await cloneMasterRow(connection, source, {
        SHEET_NO: costSheetId,
        FIXED: 1,
        FINAL_STATUS: finalStatus,
        FINAL_DATETIME: new Date(),
        TRIP_TC: nullIfEmpty(header.tripTc),
        PERIOD: nullIfEmpty(header.period),
        NO_OF_TRIP: nullIfEmpty(header.noOfTrip),
        PERIODID: nullIfEmpty(header.periodId),
        TOTAL_DAYS: totalDays,
        TOTAL_EARNING: totalEarning,
        UPDATE_ON_DATE: new Date(),
      });

      const [bunkerRows] = await connection.query(
        `SELECT BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY
         FROM chartering_estimate_tc_slave4 WHERE TCOUTID = ?`,
        [source.TCOUTID],
      ).catch(() => [[]]);
      for (const row of bunkerRows) {
        await connection.query(
          `INSERT INTO chartering_estimate_tc_slave4
           (TCOUTID, BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            tcOutId,
            row.BUNKERID,
            row.AMOUNT,
            row.BUNKER_DATE,
            row.QTY,
            row.PRICE,
            row.IDENTITY,
          ],
        );
      }

      for (const trip of trips) {
        await upsertTrip(connection, tcOutId, { ...trip, slave1Id: null }, header);
      }
    } else {
      tcOutId = existing.TCOUTID;
      await connection.query(
        `UPDATE chartering_estimate_tc_master
         SET FINAL_DATETIME = NOW(),
             TRIP_TC = ?,
             PERIOD = ?,
             NO_OF_TRIP = ?,
             PERIODID = ?,
             FINAL_STATUS = ?,
             FIXED = 1,
             TOTAL_DAYS = ?,
             TOTAL_EARNING = ?,
             UPDATE_ON_DATE = NOW()
         WHERE TCOUTID = ? AND COMID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
        [
          nullIfEmpty(header.tripTc),
          nullIfEmpty(header.period),
          nullIfEmpty(header.noOfTrip),
          nullIfEmpty(header.periodId),
          finalStatus,
          totalDays,
          totalEarning,
          tcOutId,
          comId,
          MODULE_ID,
          COMPANY_ID,
        ],
      );

      const keepIds = [];
      for (const trip of trips) {
        const slave1Id = await upsertTrip(connection, tcOutId, trip, header);
        keepIds.push(slave1Id);
      }

      if (keepIds.length) {
        const placeholders = keepIds.map(() => '?').join(',');
        const [oldRows] = await connection.query(
          `SELECT TC_SLAVE1ID FROM chartering_tc_estimate_slave1
           WHERE TCOUTID = ? AND TC_SLAVE1ID NOT IN (${placeholders})`,
          [tcOutId, ...keepIds],
        );
        for (const row of oldRows) {
          await replaceTripChildren(connection, row.TC_SLAVE1ID, {});
          await connection.query(
            'DELETE FROM chartering_tc_estimate_slave1 WHERE TC_SLAVE1ID = ?',
            [row.TC_SLAVE1ID],
          );
        }
      }
    }

    await connection.commit();
    return { msg: 0, tcOutId, costSheetId: String(costSheetId), comId: String(comId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

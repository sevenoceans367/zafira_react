import { getPool } from '../db.js';
import {
  formatDateDMY,
  formatDateTimeYMDHM,
  formatDateYMD,
  parseDMYDate,
  parseDMYDateTime,
} from '../utils/periodContractDates.js';
import { attachmentPublicUrl } from '../utils/attachmentUrl.js';

function nullOrNumber(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function nullOrString(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function toSqlDate(value) {
  const date = parseDMYDate(value);
  return date ? formatDateYMD(date) : null;
}

function toSqlDateTime(value) {
  const date = parseDMYDateTime(value);
  return date ? formatDateTimeYMDHM(date) : null;
}

function asString(value) {
  if (value == null) return '';
  return String(value);
}

function formatOutDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1972) return '';
  return formatDateDMY(d);
}

function formatOutDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1972) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${formatDateDMY(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseAttachments(attachment, attachmentName) {
  const files = String(attachment || '').split(',').map((part) => part.trim()).filter(Boolean);
  const names = String(attachmentName || '').split(',').map((part) => part.trim()).filter(Boolean);
  return files.map((file, index) => ({
    file,
    name: names[index] || file,
    url: attachmentPublicUrl(file),
  }));
}

async function getPortLabel(pool, portId) {
  if (!portId) return '';
  const [[row]] = await pool.query(
    `SELECT PortName, PortCode, COUNTRY_KEY
     FROM port_master
     WHERE PortId = ?
     LIMIT 1`,
    [portId],
  );
  if (!row) return '';
  return `${row.PortName} (${row.COUNTRY_KEY || row.PortCode || ''})`;
}

async function insertSlaves(connection, periodId, payload) {
  for (const row of payload.deliveryNotices || []) {
    if (!row.notice || !row.dateTime) continue;
    const noticeDate = toSqlDate(row.dateTime) || '1970-01-01';
    await connection.query(
      `INSERT INTO period_contract_master_slave3 (PERIODID, DELIVERY_NOTICES, DELIVERY_DATE_TIME)
       VALUES (?, ?, ?)`,
      [periodId, row.notice, noticeDate],
    );
  }

  for (const offHire of payload.offHires || []) {
    if (!offHire.reason) continue;

    const offFrom = toSqlDateTime(offHire.from) || '1970-01-01 08:00:00';
    const offTo = toSqlDateTime(offHire.to) || '1970-01-01 08:00:00';

    const [offResult] = await connection.query(
      `INSERT INTO period_contract_master_slave2 (
        PERIODID, OFF_REASON, OFF_FROM, OFF_TO,
        OFF_HIRE_DAYS, HIRE_RATE, OFF_HIRE
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        periodId,
        offHire.reason,
        offFrom,
        offTo,
        nullOrNumber(offHire.days),
        nullOrNumber(offHire.rate),
        nullOrNumber(offHire.amount),
      ],
    );

    const offHireId = offResult.insertId;

    for (const bunker of offHire.bunkers || []) {
      if (!bunker.gradeId || bunker.amount == null || bunker.amount === '') continue;
      await connection.query(
        `INSERT INTO period_contract_master_slave21 (
          PERIOD_SLAVEID, PERIODID, BUNKERID, BUNKERQTY, BUNKERPRICE, BUNKERAMT, CHK_OWNER_ACCOUNT
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          offHireId,
          periodId,
          nullOrNumber(bunker.gradeId),
          nullOrNumber(bunker.qty),
          nullOrNumber(bunker.price),
          nullOrNumber(bunker.amount),
          bunker.ownerAccount ? 1 : 0,
        ],
      );
    }
  }

  for (const hire of payload.hireRates || []) {
    if (!hire.hireFrom || !hire.hireTo) continue;
    const hireFrom = toSqlDateTime(hire.hireFrom) || '1970-01-01 08:00:00';
    const hireTo = toSqlDateTime(hire.hireTo) || '1970-01-01 08:00:00';
    await connection.query(
      `INSERT INTO period_contract_master_slave4 (
        PERIODID, REMARKS, HIRE_FROM, HIRE_TO, HIRE_DAYS, HIRE_RATE
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        periodId,
        nullOrString(hire.remarks),
        hireFrom,
        hireTo,
        nullOrNumber(hire.hireDays),
        nullOrNumber(hire.hireRate),
      ],
    );
  }

  for (const bunker of payload.deliveryBunkers || []) {
    if (!bunker.gradeId || !bunker.qty) continue;
    const bunkerDate = toSqlDate(bunker.date) || '1970-01-01';
    await connection.query(
      `INSERT INTO period_contract_master_slave1 (
        PERIODID, BUNKERGRADEID, BUNKER_AMT, BUNKER_DATE, BUNKER_QTY, BUNKER_PRICE, IDENTITY
      ) VALUES (?, ?, ?, ?, ?, ?, 'DEL')`,
      [
        periodId,
        nullOrNumber(bunker.gradeId),
        nullOrNumber(bunker.amount),
        bunkerDate,
        nullOrNumber(bunker.qty),
        nullOrNumber(bunker.price),
      ],
    );
  }

  for (const bunker of payload.redeliveryBunkers || []) {
    if (!bunker.gradeId || !bunker.qty) continue;
    const bunkerDate = toSqlDate(bunker.date) || '1970-01-01';
    await connection.query(
      `INSERT INTO period_contract_master_slave1 (
        PERIODID, BUNKERGRADEID, BUNKER_AMT, BUNKER_DATE, BUNKER_QTY, BUNKER_PRICE, IDENTITY
      ) VALUES (?, ?, ?, ?, ?, ?, 'REDEL')`,
      [
        periodId,
        nullOrNumber(bunker.gradeId),
        nullOrNumber(bunker.amount),
        bunkerDate,
        nullOrNumber(bunker.qty),
        nullOrNumber(bunker.price),
      ],
    );
  }
}

export async function dbGetPeriodContractById(periodId) {
  const pool = getPool();
  const id = Number(periodId);
  if (!id) return null;

  const [[master]] = await pool.query(
    `SELECT * FROM period_contract_master WHERE PERIODID = ? LIMIT 1`,
    [id],
  );
  if (!master) return null;

  const [delPortLabel, reDelPortLabel] = await Promise.all([
    getPortLabel(pool, master.DEL_PORT),
    getPortLabel(pool, master.RE_DEL_PORT),
  ]);

  const [noticeRows] = await pool.query(
    `SELECT DELIVERY_NOTICES, DELIVERY_DATE_TIME
     FROM period_contract_master_slave3
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  );

  const [hireRows] = await pool.query(
    `SELECT REMARKS, HIRE_FROM, HIRE_TO, HIRE_DAYS, HIRE_RATE
     FROM period_contract_master_slave4
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  );

  const [bunkerRows] = await pool.query(
    `SELECT BUNKERGRADEID, BUNKER_AMT, BUNKER_DATE, BUNKER_QTY, BUNKER_PRICE, IDENTITY
     FROM period_contract_master_slave1
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  );

  const [offHireRows] = await pool.query(
    `SELECT PERIOD_SLAVEID, OFF_REASON, OFF_FROM, OFF_TO,
            OFF_HIRE_DAYS, HIRE_RATE, OFF_HIRE
     FROM period_contract_master_slave2
     WHERE PERIODID = ?
     ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  );

  const offHires = [];
  for (const row of offHireRows) {
    const [bunkers] = await pool.query(
      `SELECT BUNKERID, BUNKERQTY, BUNKERPRICE, BUNKERAMT, CHK_OWNER_ACCOUNT
       FROM period_contract_master_slave21
       WHERE PERIODID = ? AND PERIOD_SLAVEID = ?
       ORDER BY PERIOD_SUB_SLAVEID ASC`,
      [id, row.PERIOD_SLAVEID],
    );
    offHires.push({
      reason: asString(row.OFF_REASON),
      from: formatOutDateTime(row.OFF_FROM),
      to: formatOutDateTime(row.OFF_TO),
      days: row.OFF_HIRE_DAYS != null ? asString(row.OFF_HIRE_DAYS) : '',
      rate: row.HIRE_RATE != null ? asString(row.HIRE_RATE) : '',
      amount: row.OFF_HIRE != null ? asString(row.OFF_HIRE) : '',
      bunkers: bunkers.map((bunker) => ({
        gradeId: bunker.BUNKERID != null ? asString(bunker.BUNKERID) : '',
        qty: bunker.BUNKERQTY != null ? asString(bunker.BUNKERQTY) : '',
        price: bunker.BUNKERPRICE != null ? asString(bunker.BUNKERPRICE) : '',
        amount: bunker.BUNKERAMT != null ? asString(bunker.BUNKERAMT) : '',
        ownerAccount: String(bunker.CHK_OWNER_ACCOUNT) === '1',
      })),
    });
  }

  const mapBunker = (row) => ({
    gradeId: row.BUNKERGRADEID != null ? asString(row.BUNKERGRADEID) : '',
    qty: row.BUNKER_QTY != null ? asString(row.BUNKER_QTY) : '',
    date: formatOutDate(row.BUNKER_DATE),
    price: row.BUNKER_PRICE != null ? asString(row.BUNKER_PRICE) : '',
    amount: row.BUNKER_AMT != null ? asString(row.BUNKER_AMT) : '',
  });

  const aboutDaysMin = master.ABOUT_DAYS_MIN != null && master.ABOUT_DAYS_MIN !== ''
    ? asString(master.ABOUT_DAYS_MIN)
    : (master.ABOUT_DAYS != null ? asString(master.ABOUT_DAYS) : '');

  return {
    periodId: id,
    updateStatus: asString(master.UPDATE_STATUS || '1'),
    contractId: asString(master.CONTRACT_ID),
    contractNo: asString(master.CONTRACT_NO),
    contractDate: formatOutDate(master.CONTRACT_DATE),
    ownBusinessAccount: asString(master.OWN_BUSINESS_ACCOUNT),
    businessType: asString(master.BUSINESSTYPE),
    vesselType: asString(master.VESSEL_TYPE),
    vesselImoId: master.VESSEL_IMO_ID != null ? asString(master.VESSEL_IMO_ID) : '',
    currency: asString(master.WORKING_CURRENCY),
    owner: asString(master.OWNER),
    disOwner: asString(master.DIS_OWNER),
    manager: asString(master.MANAGER_NAME),
    broker: asString(master.BROKER),
    brokerage: master.BROKERAGE != null ? asString(master.BROKERAGE) : '',
    hire: master.HIRE != null ? asString(master.HIRE) : '',
    addComm: master.ADD_COMM != null ? asString(master.ADD_COMM) : '',
    hireRemarks: asString(master.HIRE_REMARKS),
    laycanStart: formatOutDate(master.LAYCAN_START_DATE),
    laycanEnd: formatOutDate(master.LAYCAN_END_DATE),
    delPort: master.DEL_PORT != null ? asString(master.DEL_PORT) : '',
    delPortLabel,
    deliveryDate: formatOutDate(master.DELIVERY_DATE),
    periodType: asString(master.PERIOD_TYPE),
    periodMin: master.PERIOD_MIN != null ? asString(master.PERIOD_MIN) : '',
    periodMax: master.PERIOD_MAX != null ? asString(master.PERIOD_MAX) : '',
    aboutDaysMin,
    aboutDaysMax: master.ABOUT_DAYS_MAX != null ? asString(master.ABOUT_DAYS_MAX) : '',
    reDelMinDate: formatOutDate(master.RE_DEL_MIN_DATE),
    reDelMaxDate: formatOutDate(master.RE_DEL_MAX_DATE),
    reDelPort: master.RE_DEL_PORT != null ? asString(master.RE_DEL_PORT) : '',
    reDelPortLabel,
    redelRange: asString(master.REDEL_RANGE),
    voyageDaysPerformed: formatOutDate(master.VOY_FIX_TILL),
    tradeExclusions: asString(master.TRADE_EXCLUSIONS),
    cargoExclusions: asString(master.CARGO_EXCLUSIONS),
    intermediateHoldCleaning: asString(master.INTERMEDIATE_HOLD_CLEANING),
    remarks: asString(master.REMARKS),
    dirtiesAllowed: master.DIRTIES_ALLOWED != null ? asString(master.DIRTIES_ALLOWED) : '',
    dirtiesDone: asString(master.DIRTIES_DONE),
    dirtiesRemaining: asString(master.DIRTIES_REMAINING),
    holdCleaningMaterial: asString(master.HOLD_CLEANING_MATERIAL),
    addnlPremiumHra: asString(master.ADDNL_PREM_HRA),
    ilohc: asString(master.ILOHC),
    legDetails: asString(master.LEG_DETAILS),
    monthDays: master.DAYS_MONTH != null ? asString(master.DAYS_MONTH) : '',
    attachments: parseAttachments(master.ATTACHMENT, master.ATTACHMENT_NAME),
    deliveryNotices: noticeRows.map((row) => ({
      notice: asString(row.DELIVERY_NOTICES),
      dateTime: formatOutDate(row.DELIVERY_DATE_TIME),
    })),
    hireRates: hireRows.map((row) => ({
      hireFrom: formatOutDateTime(row.HIRE_FROM),
      hireTo: formatOutDateTime(row.HIRE_TO),
      hireDays: row.HIRE_DAYS != null ? asString(row.HIRE_DAYS) : '',
      hireRate: row.HIRE_RATE != null ? asString(row.HIRE_RATE) : '',
      remarks: asString(row.REMARKS),
    })),
    deliveryBunkers: bunkerRows
      .filter((row) => String(row.IDENTITY || '').toUpperCase() === 'DEL')
      .map(mapBunker),
    redeliveryBunkers: bunkerRows
      .filter((row) => String(row.IDENTITY || '').toUpperCase() === 'REDEL')
      .map(mapBunker),
    offHires,
  };
}

export async function dbUpdatePeriodContract(periodId, payload, attachments = {}) {
  const pool = getPool();
  const id = Number(periodId);
  if (!id) throw new Error('Invalid period contract id.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[existing]] = await connection.query(
      `SELECT PERIODID, UPDATE_STATUS FROM period_contract_master WHERE PERIODID = ? LIMIT 1`,
      [id],
    );
    if (!existing) {
      throw new Error('Period contract not found.');
    }
    if (Number(existing.UPDATE_STATUS) > 1) {
      throw new Error('Closed period contracts cannot be edited.');
    }

    const contractDate = toSqlDate(payload.contractDate);
    const laycanStart = toSqlDate(payload.laycanStart);
    const laycanEnd = toSqlDate(payload.laycanEnd);
    const deliveryDate = toSqlDate(payload.deliveryDate);
    const reDelMinDate = toSqlDate(payload.reDelMinDate);
    const reDelMaxDate = toSqlDate(payload.reDelMaxDate);
    const voyFixTill = toSqlDate(payload.voyageDaysPerformed);

    await connection.query(
      `UPDATE period_contract_master SET
        CONTRACT_NO = ?, CONTRACT_DATE = ?, OWN_BUSINESS_ACCOUNT = ?,
        BUSINESSTYPE = ?, VESSEL_TYPE = ?, VESSEL_IMO_ID = ?, OWNER = ?, DIS_OWNER = ?,
        MANAGER_NAME = ?, BROKER = ?, BROKERAGE = ?, HIRE = ?, HIRE_REMARKS = ?,
        WORKING_CURRENCY = ?, LAYCAN_START_DATE = ?, LAYCAN_END_DATE = ?, DEL_PORT = ?,
        DELIVERY_DATE = ?, ADD_COMM = ?, PERIOD_TYPE = ?, PERIOD_MIN = ?, PERIOD_MAX = ?,
        RE_DEL_MIN_DATE = ?, RE_DEL_PORT = ?, TRADE_EXCLUSIONS = ?, CARGO_EXCLUSIONS = ?,
        INTERMEDIATE_HOLD_CLEANING = ?, REMARKS = ?, DIRTIES_ALLOWED = ?, DIRTIES_DONE = ?,
        DIRTIES_REMAINING = ?, HOLD_CLEANING_MATERIAL = ?, ADDNL_PREM_HRA = ?, ILOHC = ?,
        LEG_DETAILS = ?, UPDATE_STATUS = ?, ATTACHMENT = ?, ATTACHMENT_NAME = ?,
        DAYS_MONTH = ?, ABOUT_DAYS = ?, RE_DEL_MAX_DATE = ?, REDEL_RANGE = ?,
        ABOUT_DAYS_MIN = ?, ABOUT_DAYS_MAX = ?, VOY_FIX_TILL = ?
       WHERE PERIODID = ?`,
      [
        payload.contractNo,
        contractDate,
        payload.ownBusinessAccount,
        payload.businessType,
        payload.vesselType,
        nullOrNumber(payload.vesselImoId),
        payload.owner,
        payload.disOwner,
        payload.manager,
        payload.broker,
        nullOrNumber(payload.brokerage),
        nullOrNumber(payload.hire),
        nullOrString(payload.hireRemarks),
        payload.currency,
        laycanStart,
        laycanEnd,
        payload.delPort,
        deliveryDate,
        nullOrNumber(payload.addComm),
        payload.periodType,
        nullOrNumber(payload.periodMin),
        nullOrNumber(payload.periodMax),
        reDelMinDate,
        payload.reDelPort,
        nullOrString(payload.tradeExclusions),
        nullOrString(payload.cargoExclusions),
        nullOrString(payload.intermediateHoldCleaning),
        nullOrString(payload.remarks),
        nullOrNumber(payload.dirtiesAllowed),
        nullOrString(payload.dirtiesDone),
        nullOrString(payload.dirtiesRemaining),
        nullOrString(payload.holdCleaningMaterial),
        nullOrString(payload.addnlPremiumHra),
        nullOrString(payload.ilohc),
        nullOrString(payload.legDetails),
        String(payload.updateStatus || '1'),
        attachments.attachment || '',
        attachments.attachmentName || '',
        nullOrNumber(payload.monthDays),
        nullOrNumber(payload.aboutDaysMin),
        reDelMaxDate,
        nullOrString(payload.redelRange),
        nullOrNumber(payload.aboutDaysMin),
        nullOrNumber(payload.aboutDaysMax),
        voyFixTill,
        id,
      ],
    );

    await connection.query(
      `DELETE FROM period_contract_master_slave21 WHERE PERIODID = ?`,
      [id],
    );
    await connection.query(
      `DELETE FROM period_contract_master_slave2 WHERE PERIODID = ?`,
      [id],
    );
    await connection.query(
      `DELETE FROM period_contract_master_slave3 WHERE PERIODID = ?`,
      [id],
    );
    await connection.query(
      `DELETE FROM period_contract_master_slave4 WHERE PERIODID = ?`,
      [id],
    );
    await connection.query(
      `DELETE FROM period_contract_master_slave1 WHERE PERIODID = ?`,
      [id],
    );

    await insertSlaves(connection, id, payload);
    await connection.commit();

    return {
      periodId: id,
      contractId: payload.contractId,
      msg: 0,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

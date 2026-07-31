import { appContext } from '../config.js';
import { getPool } from '../db.js';
import {
  formatDateTimeYMDHM,
  formatDateYMD,
  parseDMYDate,
  parseDMYDateTime,
} from '../utils/periodContractDates.js';

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

function extractMessageNo(contractId) {
  const parts = String(contractId || '').split('-');
  return parts[1] || null;
}

export async function dbCreatePeriodContract(payload, attachments = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const messageNo = extractMessageNo(payload.contractId);
    const contractDate = toSqlDate(payload.contractDate);
    const laycanStart = toSqlDate(payload.laycanStart);
    const laycanEnd = toSqlDate(payload.laycanEnd);
    const deliveryDate = toSqlDate(payload.deliveryDate);
    const reDelMinDate = toSqlDate(payload.reDelMinDate);
    const reDelMaxDate = toSqlDate(payload.reDelMaxDate);

    const [masterResult] = await connection.query(
      `INSERT INTO period_contract_master (
        MESSAGE_NO, CONTRACT_ID, CONTRACT_NO, CONTRACT_DATE, OWN_BUSINESS_ACCOUNT,
        BUSINESSTYPE, VESSEL_TYPE, VESSEL_IMO_ID, OWNER, DIS_OWNER, MANAGER_NAME,
        BROKER, BROKERAGE, HIRE, HIRE_REMARKS, WORKING_CURRENCY,
        LAYCAN_START_DATE, LAYCAN_END_DATE, DEL_PORT, DELIVERY_DATE, ADD_COMM,
        PERIOD_TYPE, PERIOD_MIN, PERIOD_MAX, RE_DEL_MIN_DATE, RE_DEL_PORT,
        TRADE_EXCLUSIONS, CARGO_EXCLUSIONS, INTERMEDIATE_HOLD_CLEANING, REMARKS,
        DIRTIES_ALLOWED, DIRTIES_DONE, DIRTIES_REMAINING, HOLD_CLEANING_MATERIAL,
        ADDNL_PREM_HRA, ILOHC, LEG_DETAILS, UPDATE_STATUS, ATTACHMENT, ATTACHMENT_NAME,
        MODULEID, MCOMPANYID, LOGINID, DAYS_MONTH, ABOUT_DAYS, RE_DEL_MAX_DATE, REDEL_RANGE
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        messageNo,
        payload.contractId,
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
        appContext.moduleId,
        appContext.companyId,
        appContext.userId,
        nullOrNumber(payload.monthDays),
        nullOrNumber(payload.aboutDaysMin),
        reDelMaxDate,
        nullOrString(payload.redelRange),
      ],
    );

    const periodId = masterResult.insertId;

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

    await connection.commit();

    return {
      periodId,
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

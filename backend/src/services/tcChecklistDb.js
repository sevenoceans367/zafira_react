import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

const EMPTY_DT = '1970-01-01 00:00:00';
const EMPTY_D = '1970-01-01';

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateTimeDMY(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (date.getFullYear() <= 1970) return '';
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateOnlyDMY(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted === '01-01-1970') return '';
  return formatted;
}

function parseDateTimeToDb(value, { dateOnly = false } = {}) {
  const str = String(value || '').trim();
  if (!str) return dateOnly ? EMPTY_D : EMPTY_DT;

  const withTime = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (withTime) {
    const [, d, m, y, hh = '0', mm = '0'] = withTime;
    if (dateOnly) return `${y}-${pad(m)}-${pad(d)}`;
    return `${y}-${pad(m)}-${pad(d)} ${pad(hh)}:${pad(mm)}:00`;
  }

  const iso = new Date(str);
  if (!Number.isNaN(iso.getTime())) {
    if (dateOnly) {
      return `${iso.getFullYear()}-${pad(iso.getMonth() + 1)}-${pad(iso.getDate())}`;
    }
    return `${iso.getFullYear()}-${pad(iso.getMonth() + 1)}-${pad(iso.getDate())} ${pad(iso.getHours())}:${pad(iso.getMinutes())}:00`;
  }

  return dateOnly ? EMPTY_D : EMPTY_DT;
}

function checkboxValue(value) {
  return value === true || value === 1 || value === '1' ? '1' : null;
}

function isChecked(value) {
  return value === 1 || value === '1' || value === true;
}

async function loadFixtureHeader(pool, comId) {
  const [[latest]] = await pool.query(
    `SELECT TCOUTID
     FROM chartering_estimate_tc_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY TCOUTID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  );
  if (!latest?.TCOUTID) {
    const error = new Error('TC estimate not found for this nomination.');
    error.status = 404;
    throw error;
  }

  const [[master]] = await pool.query(
    `SELECT
        m.TCOUTID,
        m.TC_NO,
        m.VESSEL_IMO_ID,
        m.CP_DATE1,
        m.SEL_CHARTERER,
        m.BUILT_YEAR1,
        m.SUMMER_DWT,
        m.SUMMER_DRAFT,
        m.DEL_RANGE_PORT,
        m.RE_DEL_RANGE,
        m.LAYCAN_FROM,
        m.LAYCAN_TO,
        v.VESSEL_NAME,
        v.BUSINESSTYPEID,
        v.P_I,
        v.GRT_NRT,
        v.NRT,
        charterer.NAME AS CHARTERER_NAME,
        pni.NAME AS VESSEL_PNI_NAME
     FROM chartering_estimate_tc_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN vendor_master charterer ON charterer.CODE = m.SEL_CHARTERER
     LEFT JOIN vendor_master pni ON pni.CODE = v.P_I
     WHERE m.TCOUTID = ?
     LIMIT 1`,
    [latest.TCOUTID],
  );

  let tpc = '';
  if (master?.VESSEL_IMO_ID) {
    if (Number(master.BUSINESSTYPEID) === 3) {
      const [[row]] = await pool.query(
        'SELECT SUMMER_3 AS tpc FROM vessel_master_1 WHERE VESSEL_IMO_ID = ? LIMIT 1',
        [master.VESSEL_IMO_ID],
      ).catch(() => [[null]]);
      tpc = row?.tpc ?? '';
    } else {
      const [[row]] = await pool.query(
        'SELECT TPC_SUMMER AS tpc FROM vessel_master_tankers WHERE VESSEL_IMO_ID = ? LIMIT 1',
        [master.VESSEL_IMO_ID],
      ).catch(() => [[null]]);
      tpc = row?.tpc ?? '';
    }
  }

  const [[delSlave]] = await pool.query(
    `SELECT DEL_DATE_EST, DEL_HFO_MT_EST, DEL_MGO_MT_EST
     FROM chartering_tc_estimate_slave1
     WHERE TCOUTID = ?
     ORDER BY TC_SLAVE1ID ASC
     LIMIT 1`,
    [latest.TCOUTID],
  ).catch(() => [[null]]);

  const [[reDelSlave]] = await pool.query(
    `SELECT REDEL_DATE_EST, REDEL_HFO_MT_EST, REDEL_MGO_MT_EST
     FROM chartering_tc_estimate_slave1
     WHERE TCOUTID = ?
     ORDER BY TC_SLAVE1ID DESC
     LIMIT 1`,
    [latest.TCOUTID],
  ).catch(() => [[null]]);

  return {
    tcOutId: latest.TCOUTID,
    tcNo: master?.TC_NO || '',
    vesselName: master?.VESSEL_NAME || '',
    cpDate: formatDateOnlyDMY(master?.CP_DATE1),
    charterer: master?.CHARTERER_NAME || '',
    built: master?.BUILT_YEAR1 || '',
    deadweight: master?.SUMMER_DWT || '',
    draft: master?.SUMMER_DRAFT || '',
    grtNrt: [master?.GRT_NRT, master?.NRT].filter((v) => v != null && String(v) !== '').join('/') || '',
    tpc: tpc || '',
    vesselPni: master?.VESSEL_PNI_NAME || '',
    delRangePort: master?.DEL_RANGE_PORT || '',
    reDelRange: master?.RE_DEL_RANGE || '',
    estimateLaycanFrom: formatDateTimeDMY(master?.LAYCAN_FROM),
    estimateLaycanTo: formatDateTimeDMY(master?.LAYCAN_TO),
    delDateEst: formatDateOnlyDMY(delSlave?.DEL_DATE_EST),
    reDelDateEst: formatDateOnlyDMY(reDelSlave?.REDEL_DATE_EST),
  };
}

function mapChecklistRow(row, fixture) {
  const hasRow = Boolean(row?.CHKLISTTC_ID);
  return {
    checklistId: row?.CHKLISTTC_ID || null,
    checks: {
      reg: isChecked(row?.REG),
      class: isChecked(row?.CLASS),
      pni: isChecked(row?.PNI),
      ism: isChecked(row?.ISM),
      doc: isChecked(row?.DOC),
      itc: isChecked(row?.ITC),
      isps: isChecked(row?.ISPS),
      ll: isChecked(row?.LL),
      bq: isChecked(row?.BQ),
      hm: isChecked(row?.H_M),
      seaWeb: isChecked(row?.SEA_WEB),
      cargoDeclMaster: isChecked(row?.CARGODECL_MASTER),
      reqDocsSentToIns: isChecked(row?.REQDOCSSENTTOINS),
    },
    chartererPni: row?.CHARTERER_PNI != null ? String(row.CHARTERER_PNI) : '',
    lastPortAgent: row?.LASTPORTAGENT || '',
    laycanFrom: formatDateTimeDMY(row?.LAYCAN_FROM) || fixture.estimateLaycanFrom || '',
    laycanTo: formatDateTimeDMY(row?.LAYCAN_TO) || fixture.estimateLaycanTo || '',
    draftResAsPerCp: row?.DRFTRESASPERCP || '',
    loadRateCp: row?.LOAD_RATE_CP || '',
    dischargeRateCp: row?.DIS_RATE_CP || '',
    delivery: {
      actualArrivalText: hasRow ? (row.DEL_ARRI_TEXT || '') : 'ACTUAL ARRIVAL',
      actualArrivalDate: formatDateTimeDMY(row?.DEL_ARRI_DATA),
      norTenderedText: hasRow ? (row.DEL_NORTEN_TEXT || '') : 'NOR TENDERED',
      norTenderedDate: formatDateTimeDMY(row?.DEL_NORTEN_DATA),
      placePortText: hasRow ? (row.DEL_PORT_TEXT || '') : 'DELIVERY PLACE/PORT',
      placePortData: fixture.delRangePort || '',
      foDoText: hasRow ? (row.DEL_FO_DO_TEXT || '') : 'DELIVERY FO/DO (MT)',
      foDoData: row?.DEL_FO_DO_DATA || '',
      dateTimeText: hasRow ? (row.DEL_DATETIM_TXT || '') : 'DELIVERY DATE/TIME',
      dateTimeData: fixture.delDateEst || '',
    },
    redelivery: {
      actualArrivalText: hasRow ? (row.RDEL_ARRI_TEXT || '') : 'ACTUAL ARRIVAL',
      actualArrivalDate: formatDateTimeDMY(row?.RDEL_ARRI_DATA),
      norTenderedText: hasRow ? (row.RDEL_NORTEN_TEXT || '') : 'NOR TENDERED',
      norTenderedDate: formatDateTimeDMY(row?.RDEL_NORTEN_DATE),
      placePortText: hasRow ? (row.RDEL_PORT_TEXT || '') : 'RE-DELIVERY PLACE/PORT',
      placePortData: fixture.reDelRange || '',
      foDoText: hasRow ? (row.RDEL_FO_DO_TEXT || '') : 'RE-DELIVERY FO/DO (MT)',
      foDoData: row?.RDEL_FO_DO_DATA || '',
      dateTimeText: hasRow ? (row.RDEL_DATETIM_TXT || '') : 'RE-DELIVERY DATE/TIME',
      dateTimeData: fixture.reDelDateEst || '',
    },
    remarks: row?.REMARKS || '',
  };
}

export async function dbGetTcChecklist(comId) {
  if (!comId) {
    const error = new Error('comId is required.');
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const fixture = await loadFixtureHeader(pool, comId);

  const [[checklist]] = await pool.query(
    `SELECT * FROM check_list_tc
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
  );

  let deliveryEtas = [{ text: '', date: '' }];
  let redeliveryEtas = [{ text: '', date: '' }];
  if (checklist?.CHKLISTTC_ID) {
    const [etaRows] = await pool.query(
      `SELECT ETA_NOTICES_TEXT, ETA_NOTICES_DATA, STATUS
       FROM check_list_tc_s1
       WHERE CHKLISTTC_ID = ?
       ORDER BY STATUS, UPDATE_ON_DATE`,
      [checklist.CHKLISTTC_ID],
    );
    const del = etaRows
      .filter((row) => Number(row.STATUS) === 1)
      .map((row) => ({
        text: row.ETA_NOTICES_TEXT || '',
        date: formatDateTimeDMY(row.ETA_NOTICES_DATA),
      }));
    const redel = etaRows
      .filter((row) => Number(row.STATUS) === 2)
      .map((row) => ({
        text: row.ETA_NOTICES_TEXT || '',
        date: formatDateTimeDMY(row.ETA_NOTICES_DATA),
      }));
    if (del.length) deliveryEtas = del;
    if (redel.length) redeliveryEtas = redel;
  }

  const [pniVendors] = await pool.query(
    `SELECT CODE AS id, CONCAT(NAME, ' ( ', CODE, ' )') AS name
     FROM vendor_master
     WHERE STATUS = 1 AND MCOMPANYID = ? AND VENDOR_TYPEID = 17
     ORDER BY NAME`,
    [COMPANY_ID],
  ).catch(() => [[]]);

  const form = mapChecklistRow(checklist || {}, fixture);
  form.deliveryEtas = deliveryEtas;
  form.redeliveryEtas = redeliveryEtas;

  return {
    comId,
    fixture,
    form,
    pniVendors: (pniVendors || []).map((row) => ({ id: String(row.id), name: row.name })),
  };
}

export async function dbSaveTcChecklist(comId, payload = {}) {
  if (!comId) {
    const error = new Error('comId is required.');
    error.status = 400;
    throw error;
  }

  const checks = payload.checks || {};
  const delivery = payload.delivery || {};
  const redelivery = payload.redelivery || {};
  const deliveryEtas = Array.isArray(payload.deliveryEtas) ? payload.deliveryEtas : [];
  const redeliveryEtas = Array.isArray(payload.redeliveryEtas) ? payload.redeliveryEtas : [];

  if (!String(payload.lastPortAgent || '').trim()) {
    const error = new Error('Last Port Agent is required.');
    error.status = 400;
    throw error;
  }
  if (!String(payload.chartererPni || '').trim()) {
    const error = new Error('Charterers PNI is required.');
    error.status = 400;
    throw error;
  }
  if (!String(payload.laycanFrom || '').trim() || !String(payload.laycanTo || '').trim()) {
    const error = new Error('Laycan From and Laycan To are required.');
    error.status = 400;
    throw error;
  }
  if (!String(payload.remarks || '').trim()) {
    const error = new Error('Remarks are required.');
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const fields = {
      REG: checkboxValue(checks.reg),
      CLASS: checkboxValue(checks.class),
      PNI: checkboxValue(checks.pni),
      ISM: checkboxValue(checks.ism),
      DOC: checkboxValue(checks.doc),
      ITC: checkboxValue(checks.itc),
      ISPS: checkboxValue(checks.isps),
      LL: checkboxValue(checks.ll),
      BQ: checkboxValue(checks.bq),
      H_M: checkboxValue(checks.hm),
      SEA_WEB: checkboxValue(checks.seaWeb),
      CARGODECL_MASTER: checkboxValue(checks.cargoDeclMaster),
      REQDOCSSENTTOINS: checkboxValue(checks.reqDocsSentToIns),
      CHARTERER_PNI: String(payload.chartererPni || '').trim() || null,
      LASTPORTAGENT: String(payload.lastPortAgent || '').trim() || null,
      LAYCAN_FROM: parseDateTimeToDb(payload.laycanFrom),
      LAYCAN_TO: parseDateTimeToDb(payload.laycanTo),
      DRFTRESASPERCP: String(payload.draftResAsPerCp || '').trim(),
      LOAD_RATE_CP: String(payload.loadRateCp || '').trim(),
      DIS_RATE_CP: String(payload.dischargeRateCp || '').trim(),
      DEL_ARRI_TEXT: String(delivery.actualArrivalText || '').trim() || null,
      DEL_ARRI_DATA: parseDateTimeToDb(delivery.actualArrivalDate),
      DEL_NORTEN_TEXT: String(delivery.norTenderedText || '').trim() || null,
      DEL_NORTEN_DATA: parseDateTimeToDb(delivery.norTenderedDate),
      DEL_PORT_TEXT: String(delivery.placePortText || '').trim() || null,
      DEL_PORT_DATA: String(delivery.placePortData || '').trim(),
      DEL_FO_DO_TEXT: String(delivery.foDoText || '').trim() || null,
      DEL_FO_DO_DATA: String(delivery.foDoData || '').trim(),
      DEL_DATETIM_TXT: String(delivery.dateTimeText || '').trim() || null,
      DEL_DATETIM_DATA: parseDateTimeToDb(delivery.dateTimeData, { dateOnly: true }),
      RDEL_ARRI_TEXT: String(redelivery.actualArrivalText || '').trim() || null,
      RDEL_ARRI_DATA: parseDateTimeToDb(redelivery.actualArrivalDate),
      RDEL_NORTEN_TEXT: String(redelivery.norTenderedText || '').trim() || null,
      RDEL_NORTEN_DATE: parseDateTimeToDb(redelivery.norTenderedDate),
      RDEL_PORT_TEXT: String(redelivery.placePortText || '').trim() || null,
      RDEL_PORT_DATA: String(redelivery.placePortData || '').trim(),
      RDEL_FO_DO_TEXT: String(redelivery.foDoText || '').trim() || null,
      RDEL_FO_DO_DATA: String(redelivery.foDoData || '').trim(),
      RDEL_DATETIM_TXT: String(redelivery.dateTimeText || '').trim() || null,
      RDEL_DATETIM_DATA: parseDateTimeToDb(redelivery.dateTimeData, { dateOnly: true }),
      REMARKS: String(payload.remarks || '').trim(),
    };

    const [[existing]] = await connection.query(
      `SELECT CHKLISTTC_ID FROM check_list_tc
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
       LIMIT 1`,
      [comId, MODULE_ID, COMPANY_ID],
    );

    let checklistId = existing?.CHKLISTTC_ID;
    if (checklistId) {
      await connection.query(
        `UPDATE check_list_tc SET
          REG=?, CLASS=?, PNI=?, ISM=?, DOC=?, ITC=?, ISPS=?, LL=?, BQ=?, H_M=?, SEA_WEB=?,
          CARGODECL_MASTER=?, REQDOCSSENTTOINS=?, CHARTERER_PNI=?, LASTPORTAGENT=?,
          LAYCAN_FROM=?, LAYCAN_TO=?, DRFTRESASPERCP=?, LOAD_RATE_CP=?, DIS_RATE_CP=?,
          DEL_ARRI_TEXT=?, DEL_ARRI_DATA=?, DEL_NORTEN_TEXT=?, DEL_NORTEN_DATA=?,
          DEL_PORT_TEXT=?, DEL_PORT_DATA=?, DEL_FO_DO_TEXT=?, DEL_FO_DO_DATA=?,
          DEL_DATETIM_TXT=?, DEL_DATETIM_DATA=?,
          RDEL_ARRI_TEXT=?, RDEL_ARRI_DATA=?, RDEL_NORTEN_TEXT=?, RDEL_NORTEN_DATE=?,
          RDEL_PORT_TEXT=?, RDEL_PORT_DATA=?, RDEL_FO_DO_TEXT=?, RDEL_FO_DO_DATA=?,
          RDEL_DATETIM_TXT=?, RDEL_DATETIM_DATA=?, REMARKS=?, UPDATE_ON_DATE=NOW()
         WHERE CHKLISTTC_ID=?`,
        [
          fields.REG, fields.CLASS, fields.PNI, fields.ISM, fields.DOC, fields.ITC, fields.ISPS,
          fields.LL, fields.BQ, fields.H_M, fields.SEA_WEB, fields.CARGODECL_MASTER, fields.REQDOCSSENTTOINS,
          fields.CHARTERER_PNI, fields.LASTPORTAGENT, fields.LAYCAN_FROM, fields.LAYCAN_TO,
          fields.DRFTRESASPERCP, fields.LOAD_RATE_CP, fields.DIS_RATE_CP,
          fields.DEL_ARRI_TEXT, fields.DEL_ARRI_DATA, fields.DEL_NORTEN_TEXT, fields.DEL_NORTEN_DATA,
          fields.DEL_PORT_TEXT, fields.DEL_PORT_DATA, fields.DEL_FO_DO_TEXT, fields.DEL_FO_DO_DATA,
          fields.DEL_DATETIM_TXT, fields.DEL_DATETIM_DATA,
          fields.RDEL_ARRI_TEXT, fields.RDEL_ARRI_DATA, fields.RDEL_NORTEN_TEXT, fields.RDEL_NORTEN_DATE,
          fields.RDEL_PORT_TEXT, fields.RDEL_PORT_DATA, fields.RDEL_FO_DO_TEXT, fields.RDEL_FO_DO_DATA,
          fields.RDEL_DATETIM_TXT, fields.RDEL_DATETIM_DATA, fields.REMARKS, checklistId,
        ],
      );
      await connection.query('DELETE FROM check_list_tc_s1 WHERE CHKLISTTC_ID = ?', [checklistId]);
    } else {
      const [insertResult] = await connection.query(
        `INSERT INTO check_list_tc (
          COMID, MODULEID, MCOMPANYID, REG, CLASS, PNI, ISM, DOC, ITC, ISPS, LL, BQ, H_M, SEA_WEB,
          CARGODECL_MASTER, REQDOCSSENTTOINS, CHARTERER_PNI, LASTPORTAGENT, LAYCAN_FROM, LAYCAN_TO,
          DRFTRESASPERCP, LOAD_RATE_CP, DIS_RATE_CP,
          DEL_ARRI_TEXT, DEL_ARRI_DATA, DEL_NORTEN_TEXT, DEL_NORTEN_DATA, DEL_PORT_TEXT, DEL_PORT_DATA,
          DEL_FO_DO_TEXT, DEL_FO_DO_DATA, DEL_DATETIM_TXT, DEL_DATETIM_DATA,
          RDEL_ARRI_TEXT, RDEL_ARRI_DATA, RDEL_NORTEN_TEXT, RDEL_NORTEN_DATE, RDEL_PORT_TEXT, RDEL_PORT_DATA,
          RDEL_FO_DO_TEXT, RDEL_FO_DO_DATA, RDEL_DATETIM_TXT, RDEL_DATETIM_DATA, REMARKS, ADD_ON_DATE
        ) VALUES (
          ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW()
        )`,
        [
          comId, MODULE_ID, COMPANY_ID,
          fields.REG, fields.CLASS, fields.PNI, fields.ISM, fields.DOC, fields.ITC, fields.ISPS,
          fields.LL, fields.BQ, fields.H_M, fields.SEA_WEB, fields.CARGODECL_MASTER, fields.REQDOCSSENTTOINS,
          fields.CHARTERER_PNI, fields.LASTPORTAGENT, fields.LAYCAN_FROM, fields.LAYCAN_TO,
          fields.DRFTRESASPERCP, fields.LOAD_RATE_CP, fields.DIS_RATE_CP,
          fields.DEL_ARRI_TEXT, fields.DEL_ARRI_DATA, fields.DEL_NORTEN_TEXT, fields.DEL_NORTEN_DATA,
          fields.DEL_PORT_TEXT, fields.DEL_PORT_DATA, fields.DEL_FO_DO_TEXT, fields.DEL_FO_DO_DATA,
          fields.DEL_DATETIM_TXT, fields.DEL_DATETIM_DATA,
          fields.RDEL_ARRI_TEXT, fields.RDEL_ARRI_DATA, fields.RDEL_NORTEN_TEXT, fields.RDEL_NORTEN_DATE,
          fields.RDEL_PORT_TEXT, fields.RDEL_PORT_DATA, fields.RDEL_FO_DO_TEXT, fields.RDEL_FO_DO_DATA,
          fields.RDEL_DATETIM_TXT, fields.RDEL_DATETIM_DATA, fields.REMARKS,
        ],
      );
      checklistId = insertResult.insertId;
    }

    const insertEta = async (rows, status) => {
      for (const row of rows) {
        if (!String(row?.date || '').trim()) continue;
        await connection.query(
          `INSERT INTO check_list_tc_s1
           (CHKLISTTC_ID, ETA_NOTICES_TEXT, ETA_NOTICES_DATA, STATUS, UPDATE_ON_DATE)
           VALUES (?, ?, ?, ?, NOW())`,
          [checklistId, String(row.text || '').trim(), parseDateTimeToDb(row.date), status],
        );
      }
    };

    await insertEta(deliveryEtas, 1);
    await insertEta(redeliveryEtas, 2);

    await connection.commit();
    return { msg: 0, checklistId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

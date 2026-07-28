import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY, parsePeriodDate } from './estimateListMappers.js';

const COA_MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;

let coaMasterColumnsPromise = null;
let coaMasterLifecycleReady = false;

async function getCoaMasterColumns(pool) {
  if (!coaMasterColumnsPromise) {
    coaMasterColumnsPromise = pool.query('SHOW COLUMNS FROM coa_master')
      .then(([rows]) => new Set(rows.map((row) => row.Field)));
  }
  return coaMasterColumnsPromise;
}

/**
 * Older DBs may lack STATUS / CANCEL_REMARKS on coa_master even though legacy PHP uses them.
 * Add them once so running/cancelled filters and cancel workflow match PHP.
 */
async function ensureCoaMasterLifecycleColumns(pool) {
  const columns = await getCoaMasterColumns(pool);
  if (coaMasterLifecycleReady) return columns;
  try {
    if (!columns.has('STATUS')) {
      await pool.query(
        `ALTER TABLE coa_master
         ADD COLUMN STATUS TINYINT NOT NULL DEFAULT 1`,
      );
      columns.add('STATUS');
    }
    if (!columns.has('CANCEL_REMARKS')) {
      await pool.query(
        `ALTER TABLE coa_master
         ADD COLUMN CANCEL_REMARKS TEXT NULL`,
      );
      columns.add('CANCEL_REMARKS');
    }
  } catch (error) {
    console.warn('[coaDb] Could not add coa_master lifecycle columns:', error.message);
  }
  coaMasterLifecycleReady = true;
  return columns;
}

function nullIfEmpty(value) {
  if (value == null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function toDbDate(value) {
  if (!value) return '1970-01-01';
  return parsePeriodDate(value) || '1970-01-01';
}

function formatNumber(value, decimals = 2) {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  return num.toFixed(decimals);
}

async function getLatestFcaId(pool, comid) {
  const [rows] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ? ORDER BY FCAID DESC LIMIT 1`,
    [comid],
  );
  return rows[0]?.FCAID ?? null;
}

async function getPortShortName(pool, portId) {
  if (!portId) return '';
  const [rows] = await pool.query(
    'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
    [portId],
  );
  const name = rows[0]?.PortName ?? '';
  return name.split('/')[0] ?? name;
}

async function sumCargoMtForCoa(pool, row) {
  let cargoMt = 0;
  if (row.COMID_VC) {
    for (const comid of String(row.COMID_VC).split(',').filter(Boolean)) {
      const fcaId = await getLatestFcaId(pool, comid);
      if (!fcaId) continue;
      const [[sumRow]] = await pool.query(
        `SELECT SUM(CARGO_MT) AS SUM FROM freight_cost_estimete_slave10
         WHERE FCAID = ? AND STATUS != 3`,
        [fcaId],
      );
      cargoMt += Number(sumRow?.SUM || 0);
    }
  }
  if (row.COMID_RELET) {
    for (const comid of String(row.COMID_RELET).split(',').filter(Boolean)) {
      const [[fcaRow]] = await pool.query(
        `SELECT FCAID FROM cargo_relet_estimate_masster
         INNER JOIN cargo_relet_estimate_compare c ON c.FCAID = cargo_relet_estimate_masster.FCAID
         WHERE c.COMID = ? ORDER BY cargo_relet_estimate_masster.FCAID DESC LIMIT 1`,
        [comid],
      );
      if (!fcaRow?.FCAID) continue;
      const [[sumRow]] = await pool.query(
        `SELECT SUM(CARGO_QMT_MT) AS SUM FROM cargo_relet_estimate_masster WHERE FCAID = ?`,
        [fcaRow.FCAID],
      );
      cargoMt += Number(sumRow?.SUM || 0);
    }
  }
  return cargoMt;
}

function mapCoaDetail(row, exclusions = []) {
  return {
    coaId: row.COAID,
    coaIdentity: row.COA_ID ?? '',
    coaNo: row.COA_NO ?? '',
    coaDate: formatDateDMY(row.COA_DATE),
    charterer: row.CHARTERER != null ? String(row.CHARTERER) : '',
    owner: row.OWNER != null ? String(row.OWNER) : '',
    coaRoute: row.COA_ROUTE != null ? String(row.COA_ROUTE) : '',
    totalShipments: row.TOTAL_SHIPMENTS != null ? String(row.TOTAL_SHIPMENTS) : '',
    broker: row.BROKER != null ? String(row.BROKER) : '',
    vesselType: row.VESSEL_TYPE != null ? String(row.VESSEL_TYPE) : '',
    loadOptions: row.LOAD_OPTIONS != null ? String(row.LOAD_OPTIONS) : '',
    cargo: row.CARGO != null ? String(row.CARGO) : '',
    tolerance: row.TOLERANCE ?? '',
    coaNotice: row.COA_NOTICE ?? '',
    minGuaranteedQty: row.MIN_GUARANTEED_QTY != null ? String(row.MIN_GUARANTEED_QTY) : '',
    lpEtaNotices: row.LP_ETA_NOTICES ?? '',
    vesselSubstitute: row.VESSEL_SUBSTITUTE != null ? String(row.VESSEL_SUBSTITUTE) : '',
    duration: row.COA_DURATION ?? '',
    startDate: formatDateDMY(row.START_DATE),
    endDate: formatDateDMY(row.END_DATE),
    freightDetails: row.FREIGHT_DETAILS ?? '',
    lpDetails: row.LP_DETAILS ?? '',
    dpDetails: row.DP_DETAILS ?? '',
    demmLaytime: row.DEMM_LAYTIME ?? '',
    remarks: row.REMARKS ?? '',
    updateStatus: row.UPDATE_STATUS != null ? String(row.UPDATE_STATUS) : '1',
    attachment: row.ATTACHMENT ?? '',
    attachmentName: row.ATTACHMENT_NAME ?? '',
    currency: row.CURRENCY || 'USD',
    businessTypeId: row.BUSINESSTYPEID != null ? String(row.BUSINESSTYPEID) : '3',
    foPrice: row.FO_PRICE != null ? String(row.FO_PRICE) : '',
    bafAmt: row.BAF_AMT != null ? String(row.BAF_AMT) : '',
    status: row.STATUS != null ? Number(row.STATUS) : 1,
    cancelRemarks: row.CANCEL_REMARKS ?? '',
    exclusions,
  };
}

export async function dbGetCoaLookups() {
  const pool = getPool();

  const [routes] = await pool.query(
    `SELECT COAROUTEID AS id, COAROUTE_NAME AS name
     FROM coaroute_master WHERE STATUS = 1 ORDER BY COAROUTE_NAME`,
  );
  const [loadOptions] = await pool.query(
    `SELECT LOADOPTIONSID AS id, LOADOPTION_NAME AS name
     FROM loadoption_master WHERE STATUS = 1 ORDER BY LOADOPTION_NAME`,
  );
  const [vesselTypes] = await pool.query(
    `SELECT VesselTypeId AS id, VesselType AS name, BusinessType AS businessTypeId
     FROM vessel_type_master ORDER BY VesselType`,
  );
  const [cargos] = await pool.query(
    `SELECT MATERIALID AS id,
            CONCAT(MATERIAL_CODE_DESC, '(', MATERIAL_CODE, ')') AS name
     FROM cargo_master
     WHERE STATUS = 1 AND MCOMPANYID = ?
     ORDER BY MATERIAL_CODE_DESC`,
    [appContext.companyId],
  );
  const [charterers] = await pool.query(
    `SELECT CODE AS id, CONCAT(NAME, ' (', CODE, ')') AS name
     FROM vendor_master
     WHERE STATUS = 1 AND VENDOR_TYPEID IN (1, 2, 3, 11) AND MCOMPANYID = ?
     ORDER BY NAME`,
    [appContext.companyId],
  );
  const [owners] = await pool.query(
    `SELECT CODE AS id, CONCAT(NAME, ' (', CODE, ')') AS name
     FROM vendor_master
     WHERE STATUS = 1 AND VENDOR_TYPEID IN (11) AND MCOMPANYID = ?
     ORDER BY NAME`,
    [appContext.companyId],
  );
  const [brokers] = await pool.query(
    `SELECT CODE AS id, CONCAT(NAME, ' (', CODE, ')') AS name
     FROM vendor_master
     WHERE STATUS = 1 AND VENDOR_TYPEID IN (12) AND MCOMPANYID = ?
     ORDER BY NAME`,
    [appContext.companyId],
  );
  const [vessels] = await pool.query(
    `SELECT VESSEL_IMO_ID AS id, VESSEL_NAME AS name, BUSINESSTYPEID AS businessTypeId
     FROM vessel_imo_master
     WHERE MCOMPANYID = ?
     ORDER BY VESSEL_NAME`,
    [appContext.companyId],
  );

  const [[nextRow]] = await pool.query(
    `SELECT (MAX(MESSAGE_NO) + 1) AS nextNo
     FROM coa_master WHERE MODULEID = ? AND MCOMPANYID = ?`,
    [COA_MODULE_ID, appContext.companyId],
  );
  const messageNo = nextRow?.nextNo || 1;
  const padded = String(messageNo).padStart(3, '0');
  const year = new Date().getFullYear();

  return {
    nextCoaId: `COA-${padded}-${year}`,
    messageNo: String(messageNo),
    currencies: [
      { id: 'USD', name: 'USD' },
      { id: 'EURO', name: 'EURO' },
      { id: 'GBP', name: 'GBP' },
      { id: 'AED', name: 'AED' },
      { id: 'INR', name: 'INR' },
      { id: 'JPY', name: 'JPY' },
    ],
    vesselSubstitutes: [
      { id: '1', name: 'Yes' },
      { id: '2', name: 'No' },
    ],
    routes: routes.map((r) => ({ id: String(r.id), name: r.name })),
    loadOptions: loadOptions.map((r) => ({ id: String(r.id), name: r.name })),
    vesselTypes: vesselTypes.map((r) => ({
      id: String(r.id),
      name: r.name,
      businessTypeId: r.businessTypeId != null ? String(r.businessTypeId) : '',
    })),
    cargos: cargos.map((r) => ({ id: String(r.id), name: r.name })),
    charterers: charterers.map((r) => ({ id: String(r.id), name: r.name })),
    owners: owners.map((r) => ({ id: String(r.id), name: r.name })),
    brokers: brokers.map((r) => ({ id: String(r.id), name: r.name })),
    vessels: vessels.map((r) => ({
      id: String(r.id),
      name: r.name,
      businessTypeId: r.businessTypeId != null ? String(r.businessTypeId) : '',
    })),
  };
}

export async function dbListRunningCoas({
  selBType,
  page = 1,
  pageSize = 10,
  search = '',
  status = '1',
} = {}) {
  const pool = getPool();
  const columns = await ensureCoaMasterLifecycleColumns(pool);
  const hasStatus = columns.has('STATUS');
  const hasCancelRemarks = columns.has('CANCEL_REMARKS');
  const businessType = selBType || '2';
  const offset = (Math.max(1, page) - 1) * pageSize;
  const coaStatus = status === 'all' ? null : (status || '1');

  const conditions = ['m.MCOMPANYID = ?', 'm.MODULEID = ?', 'm.BUSINESSTYPEID = ?'];
  const params = [appContext.companyId, COA_MODULE_ID, businessType];
  if (hasStatus && coaStatus != null) {
    conditions.push('m.STATUS = ?');
    params.push(coaStatus);
  }
  if (search) {
    conditions.push(`(
      m.COA_ID LIKE ? OR m.COA_NO LIKE ? OR route.COAROUTE_NAME LIKE ?
      OR charterer.NAME LIKE ? OR cargo.MATERIAL_CODE_DESC LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }

  const where = conditions.join(' AND ');
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM coa_master m
     LEFT JOIN coaroute_master route ON route.COAROUTEID = m.COA_ROUTE
     LEFT JOIN vendor_master charterer ON charterer.CODE = m.CHARTERER
     LEFT JOIN cargo_master cargo ON cargo.MATERIALID = m.CARGO
     WHERE ${where}`,
    params,
  );

  const statusSelect = hasStatus ? 'm.STATUS' : '1 AS STATUS';
  const cancelSelect = hasCancelRemarks ? 'm.CANCEL_REMARKS' : "'' AS CANCEL_REMARKS";

  const [rows] = await pool.query(
    `SELECT m.COAID, m.COA_ID, m.COA_NO, m.COA_DATE, m.COA_DURATION, m.MIN_GUARANTEED_QTY,
            m.TOTAL_SHIPMENTS, ${statusSelect}, m.UPDATE_STATUS, ${cancelSelect},
            route.COAROUTE_NAME AS COA_ROUTE,
            vt.VesselType AS VESSEL_TYPE,
            CONCAT(charterer.NAME, '(', charterer.CODE, ')') AS CHARTERER,
            CONCAT(cargo.MATERIAL_CODE_DESC, '(', cargo.MATERIAL_CODE, ')') AS CARGO,
            (SELECT COUNT(*) FROM freight_cost_estimate_compare c WHERE c.COAAID = m.COAID) AS LEGS_VC,
            (SELECT COUNT(*) FROM cargo_relet_estimate_compare c WHERE c.COAAID = m.COAID) AS LEGS_RELET,
            (SELECT GROUP_CONCAT(COMID) FROM freight_cost_estimate_compare c WHERE c.COAAID = m.COAID) AS COMID_VC,
            (SELECT GROUP_CONCAT(COMID) FROM cargo_relet_estimate_compare c WHERE c.COAAID = m.COAID) AS COMID_RELET
     FROM coa_master m
     LEFT JOIN coaroute_master route ON route.COAROUTEID = m.COA_ROUTE
     LEFT JOIN vessel_type_master vt ON vt.VesselTypeId = m.VESSEL_TYPE
     LEFT JOIN vendor_master charterer ON charterer.CODE = m.CHARTERER
     LEFT JOIN cargo_master cargo ON cargo.MATERIALID = m.CARGO
     WHERE ${where}
     ORDER BY m.COA_DATE DESC, m.COAID DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const records = [];
  let index = offset;
  for (const row of rows) {
    index += 1;
    const cargoMt = await sumCargoMtForCoa(pool, row);
    const performed = Number(row.LEGS_VC || 0) + Number(row.LEGS_RELET || 0);
    records.push({
      index,
      coaId: row.COAID,
      coaRoute: row.COA_ROUTE ?? '',
      coaIdentity: row.COA_ID ?? '',
      coaNo: row.COA_NO ?? '',
      coaDate: formatDateDMY(row.COA_DATE),
      vesselType: row.VESSEL_TYPE ?? '',
      charterer: row.CHARTERER ?? '',
      cargo: row.CARGO ?? '',
      minQty: row.MIN_GUARANTEED_QTY ?? '',
      duration: row.COA_DURATION ?? '',
      totalShipments: row.TOTAL_SHIPMENTS ?? '',
      shipmentsPerformed: performed,
      balanceCargo: formatNumber(Number(row.MIN_GUARANTEED_QTY || 0) - cargoMt),
      status: Number(row.STATUS) === 1 ? 'Active' : 'Cancelled',
      updateStatus: row.UPDATE_STATUS != null ? Number(row.UPDATE_STATUS) : 0,
      canCancel: Number(row.STATUS) === 1 && performed === 0 && Number(row.UPDATE_STATUS || 0) <= 1,
      cancelRemarks: row.CANCEL_REMARKS ?? '',
    });
  }

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    page,
    pageSize,
  };
}

export async function dbGetCoa(coaId) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT * FROM coa_master
     WHERE COAID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [coaId, COA_MODULE_ID, appContext.companyId],
  );
  if (!row) return null;

  const [exclusions] = await pool.query(
    `SELECT MIN_GUARANTEED AS minGuaranteed, EX_PORT AS exPort
     FROM coa_master_s1 WHERE COAID = ? AND STATUS = 1`,
    [coaId],
  );

  const [remarks] = await pool.query(
    `SELECT \`DATE\` AS remarkDate, REMARK AS remarks
     FROM coa_monthly_remark
     WHERE COAID = ? AND MODULEID = ? AND MCOMPANYID = ?
     ORDER BY \`DATE\``,
    [coaId, COA_MODULE_ID, appContext.companyId],
  );

  return {
    ...mapCoaDetail(row, exclusions.map((e) => ({
      minGuaranteed: e.minGuaranteed != null ? String(e.minGuaranteed) : '',
      exPort: e.exPort != null ? String(e.exPort) : '',
    }))),
    monthlyRemarks: remarks.map((r) => ({
      remarkDate: formatDateDMY(r.remarkDate),
      remarks: r.remarks ?? '',
    })),
  };
}

export async function dbCreateCoa(payload) {
  const pool = getPool();
  const columns = await ensureCoaMasterLifecycleColumns(pool);
  const hasStatus = columns.has('STATUS');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const messageNo = String(payload.messageNo || '').trim()
      || String(payload.coaIdentity || '').split('-')[1]
      || '1';

    const insertCols = `
        COA_ID, MODULEID, MCOMPANYID, COA_DATE, CHARTERER, OWNER, COA_NO, COA_ROUTE,
        TOTAL_SHIPMENTS, BROKER, VESSEL_TYPE, LOAD_OPTIONS, CARGO, TOLERANCE, COA_NOTICE,
        MIN_GUARANTEED_QTY, LP_ETA_NOTICES, VESSEL_SUBSTITUTE, COA_DURATION, START_DATE, END_DATE,
        FREIGHT_DETAILS, LP_DETAILS, DP_DETAILS, DEMM_LAYTIME, REMARKS, UPDATE_STATUS,
        ATTACHMENT, ATTACHMENT_NAME, ADD_ON_DATE, MESSAGE_NO, CURRENCY, BUSINESSTYPEID,
        FO_PRICE, BAF_AMT${hasStatus ? ', STATUS' : ''}`;
    const insertPlaceholders = `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?${hasStatus ? ', 1' : ''}`;

    const [result] = await connection.query(
      `INSERT INTO coa_master (${insertCols}) VALUES (${insertPlaceholders})`,
      [
        nullIfEmpty(payload.coaIdentity),
        COA_MODULE_ID,
        appContext.companyId,
        toDbDate(payload.coaDate),
        nullIfEmpty(payload.charterer),
        nullIfEmpty(payload.owner),
        nullIfEmpty(payload.coaNo),
        nullIfEmpty(payload.coaRoute),
        nullIfEmpty(payload.totalShipments),
        nullIfEmpty(payload.broker),
        nullIfEmpty(payload.vesselType),
        nullIfEmpty(payload.loadOptions),
        nullIfEmpty(payload.cargo),
        nullIfEmpty(payload.tolerance),
        nullIfEmpty(payload.coaNotice),
        nullIfEmpty(payload.minGuaranteedQty),
        nullIfEmpty(payload.lpEtaNotices),
        nullIfEmpty(payload.vesselSubstitute),
        nullIfEmpty(payload.duration),
        toDbDate(payload.startDate),
        toDbDate(payload.endDate),
        nullIfEmpty(payload.freightDetails),
        nullIfEmpty(payload.lpDetails),
        nullIfEmpty(payload.dpDetails),
        nullIfEmpty(payload.demmLaytime),
        nullIfEmpty(payload.remarks),
        nullIfEmpty(payload.updateStatus) || '1',
        nullIfEmpty(payload.attachment),
        nullIfEmpty(payload.attachmentName),
        messageNo,
        nullIfEmpty(payload.currency) || 'USD',
        nullIfEmpty(payload.businessTypeId) || '2',
        nullIfEmpty(payload.foPrice),
        nullIfEmpty(payload.bafAmt),
      ],
    );

    const coaId = result.insertId;
    for (const exclusion of payload.exclusions || []) {
      if (!exclusion?.minGuaranteed && !exclusion?.exPort) continue;
      await connection.query(
        `INSERT INTO coa_master_s1 (COAID, MIN_GUARANTEED, EX_PORT, STATUS, ADD_ON_DATE)
         VALUES (?, ?, ?, 1, NOW())`,
        [coaId, nullIfEmpty(exclusion.minGuaranteed), nullIfEmpty(exclusion.exPort)],
      );
    }

    await connection.query(
      `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
       VALUES (?, 'COA Record added successfully.', NOW())`,
      [appContext.userId],
    );

    await connection.commit();
    return { msg: 0, coaId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbUpdateCoa(coaId, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE coa_master SET
        COA_ID = ?, COA_DATE = ?, CHARTERER = ?, OWNER = ?, COA_NO = ?, COA_ROUTE = ?,
        TOTAL_SHIPMENTS = ?, BROKER = ?, VESSEL_TYPE = ?, LOAD_OPTIONS = ?, CARGO = ?,
        TOLERANCE = ?, COA_NOTICE = ?, MIN_GUARANTEED_QTY = ?, LP_ETA_NOTICES = ?,
        VESSEL_SUBSTITUTE = ?, COA_DURATION = ?, START_DATE = ?, END_DATE = ?,
        FREIGHT_DETAILS = ?, LP_DETAILS = ?, DP_DETAILS = ?, DEMM_LAYTIME = ?, REMARKS = ?,
        ATTACHMENT = ?, ATTACHMENT_NAME = ?, CURRENCY = ?, BUSINESSTYPEID = ?,
        UPDATE_STATUS = ?, FO_PRICE = ?, BAF_AMT = ?, UPDATE_ON_DATE = NOW()
       WHERE COAID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [
        nullIfEmpty(payload.coaIdentity),
        toDbDate(payload.coaDate),
        nullIfEmpty(payload.charterer),
        nullIfEmpty(payload.owner),
        nullIfEmpty(payload.coaNo),
        nullIfEmpty(payload.coaRoute),
        nullIfEmpty(payload.totalShipments),
        nullIfEmpty(payload.broker),
        nullIfEmpty(payload.vesselType),
        nullIfEmpty(payload.loadOptions),
        nullIfEmpty(payload.cargo),
        nullIfEmpty(payload.tolerance),
        nullIfEmpty(payload.coaNotice),
        nullIfEmpty(payload.minGuaranteedQty),
        nullIfEmpty(payload.lpEtaNotices),
        nullIfEmpty(payload.vesselSubstitute),
        nullIfEmpty(payload.duration),
        toDbDate(payload.startDate),
        toDbDate(payload.endDate),
        nullIfEmpty(payload.freightDetails),
        nullIfEmpty(payload.lpDetails),
        nullIfEmpty(payload.dpDetails),
        nullIfEmpty(payload.demmLaytime),
        nullIfEmpty(payload.remarks),
        nullIfEmpty(payload.attachment),
        nullIfEmpty(payload.attachmentName),
        nullIfEmpty(payload.currency) || 'USD',
        nullIfEmpty(payload.businessTypeId) || '2',
        nullIfEmpty(payload.updateStatus) || '1',
        nullIfEmpty(payload.foPrice),
        nullIfEmpty(payload.bafAmt),
        coaId,
        COA_MODULE_ID,
        appContext.companyId,
      ],
    );
    if (!result.affectedRows) throw new Error('COA not found.');

    await connection.query('DELETE FROM coa_master_s1 WHERE COAID = ?', [coaId]);
    for (const exclusion of payload.exclusions || []) {
      if (!exclusion?.minGuaranteed && !exclusion?.exPort) continue;
      await connection.query(
        `INSERT INTO coa_master_s1 (COAID, MIN_GUARANTEED, EX_PORT, STATUS, ADD_ON_DATE)
         VALUES (?, ?, ?, 1, NOW())`,
        [coaId, nullIfEmpty(exclusion.minGuaranteed), nullIfEmpty(exclusion.exPort)],
      );
    }

    await connection.query(
      `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
       VALUES (?, 'COA Record updated successfully.', NOW())`,
      [appContext.userId],
    );

    await connection.commit();
    return { msg: 0, coaId: Number(coaId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbCancelCoa(coaId, remarks) {
  const pool = getPool();
  const columns = await ensureCoaMasterLifecycleColumns(pool);
  if (!columns.has('STATUS')) {
    throw new Error('COA cancel requires coa_master.STATUS column. Please add STATUS and CANCEL_REMARKS to match legacy schema.');
  }
  const [[row]] = await pool.query(
    `SELECT COAID,
            (SELECT COUNT(*) FROM freight_cost_estimate_compare c WHERE c.COAAID = coa_master.COAID)
              + (SELECT COUNT(*) FROM cargo_relet_estimate_compare c WHERE c.COAAID = coa_master.COAID) AS PERFORMED
     FROM coa_master
     WHERE COAID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS = 1
     LIMIT 1`,
    [coaId, COA_MODULE_ID, appContext.companyId],
  );
  if (!row) throw new Error('COA not found or already cancelled.');
  if (Number(row.PERFORMED) > 0) {
    throw new Error('Cannot cancel COA with performed shipments.');
  }

  if (columns.has('CANCEL_REMARKS')) {
    await pool.query(
      `UPDATE coa_master
       SET CANCEL_REMARKS = ?, STATUS = '2', UPDATE_ON_DATE = NOW()
       WHERE COAID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [nullIfEmpty(remarks) || '', coaId, COA_MODULE_ID, appContext.companyId],
    );
  } else {
    await pool.query(
      `UPDATE coa_master
       SET STATUS = '2', UPDATE_ON_DATE = NOW()
       WHERE COAID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [coaId, COA_MODULE_ID, appContext.companyId],
    );
  }
  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'COA cancelled successfully.', NOW())`,
    [appContext.userId],
  );
  return { msg: 0 };
}

export async function dbSaveMonthlyRemarks(coaId, remarks = []) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM coa_monthly_remark
       WHERE COAID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [coaId, COA_MODULE_ID, appContext.companyId],
    );
    for (const item of remarks) {
      if (!item?.remarkDate && !item?.remarks) continue;
      await connection.query(
        `INSERT INTO coa_monthly_remark (COAID, MODULEID, MCOMPANYID, \`DATE\`, REMARK)
         VALUES (?, ?, ?, ?, ?)`,
        [
          coaId,
          COA_MODULE_ID,
          appContext.companyId,
          toDbDate(item.remarkDate),
          nullIfEmpty(item.remarks) || '',
        ],
      );
    }
    await connection.commit();
    return { msg: 0 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbListCargoRelets({
  selBType,
  page = 1,
  pageSize = 10,
  search = '',
  coaId,
} = {}) {
  const pool = getPool();
  const businessType = selBType || '2';
  const offset = (Math.max(1, page) - 1) * pageSize;

  const conditions = [
    'r.MODULEID = ?',
    'r.MCOMPANYID = ?',
    'r.BUSINESSTYPEID = ?',
    'r.SHEET_NO IS NULL',
  ];
  const params = [COA_MODULE_ID, appContext.companyId, businessType];
  if (coaId) {
    conditions.push('r.COAID = ?');
    params.push(coaId);
  }
  if (search) {
    conditions.push(`(
      r.CARGO_RELET_NO LIKE ? OR c.COA_ID LIKE ? OR c.COA_NO LIKE ?
      OR r.CARGO_RELET_NAME LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  const where = conditions.join(' AND ');

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM cargo_relet_estimate_masster r
     LEFT JOIN coa_master c ON c.COAID = r.COAID
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT r.FCAID, r.COAID, r.CARGO_RELET_NO, r.CARGO_QMT_MT, r.FREIGHT_USD, r.FREIGHT_AMT,
            r.BUNKER_SURCHARGE_AMT, r.TOTAL_AMT, r.PROFIT, r.FREIGHT_USD_OUT, r.FREIGHT_AMT_OUT,
            r.FIXED, r.COMID, r.UPDATE_STATUS, r.TRANS_DATE,
            c.COA_ID, c.COA_NO, c.COA_DATE, c.CURRENCY
     FROM cargo_relet_estimate_masster r
     LEFT JOIN coa_master c ON c.COAID = r.COAID
     WHERE ${where}
     ORDER BY r.FCAID DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const records = [];
  let index = offset;
  for (const row of rows) {
    index += 1;
    const [ports] = await pool.query(
      `SELECT PORTID, PORT_TYPE FROM cargo_relet_estimate_slave2
       WHERE FCAID = ? AND IDENTIFY = 'IN'`,
      [row.FCAID],
    );
    const load = [];
    const discharge = [];
    for (const port of ports) {
      const name = await getPortShortName(pool, port.PORTID);
      if (port.PORT_TYPE === 'LP') load.push(name);
      if (port.PORT_TYPE === 'DP') discharge.push(name);
    }

    records.push({
      index,
      fcaId: row.FCAID,
      coaId: row.COAID,
      coaIdentity: row.COA_ID ?? '',
      coaNo: row.COA_NO ?? '',
      reletNo: row.CARGO_RELET_NO ?? '',
      coaDate: formatDateDMY(row.COA_DATE),
      cargoQty: row.CARGO_QMT_MT ?? '',
      ports: `${load.filter(Boolean).join(', ')} / ${discharge.filter(Boolean).join(', ')}`,
      freightInPerMt: row.FREIGHT_USD ?? '',
      freightInAmt: row.FREIGHT_AMT ?? '',
      foSurcharge: row.BUNKER_SURCHARGE_AMT ?? '',
      freightOutPerMt: row.FREIGHT_USD_OUT ?? '',
      freightOutAmt: row.FREIGHT_AMT_OUT ?? '',
      profit: row.PROFIT ?? '',
      currency: row.CURRENCY || 'USD',
      fixed: Number(row.FIXED) === 1,
      updateStatus: row.UPDATE_STATUS != null ? Number(row.UPDATE_STATUS) : 0,
      canDelete: Number(row.FIXED) !== 1,
    });
  }

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    page,
    pageSize,
  };
}

function mapReletDetail(row, parties = [], ports = []) {
  return {
    fcaId: row.FCAID,
    coaId: row.COAID != null ? String(row.COAID) : '',
    openCargoId: row.OPEN_CARGOID != null ? String(row.OPEN_CARGOID) : '',
    updateStatus: row.UPDATE_STATUS != null ? String(row.UPDATE_STATUS) : '1',
    vesselImoId: row.VESSEL_IMO_ID != null ? String(row.VESSEL_IMO_ID) : '',
    transDate: formatDateDMY(row.TRANS_DATE),
    reletNo: row.CARGO_RELET_NO ?? '',
    reletName: row.CARGO_RELET_NAME ?? '',
    vesselType: row.VESSEL_TYPE ?? '',
    cargoQty: row.CARGO_QMT_MT != null ? String(row.CARGO_QMT_MT) : '',
    freightUsd: row.FREIGHT_USD != null ? String(row.FREIGHT_USD) : '',
    bafUsd: row.BAF_USD != null ? String(row.BAF_USD) : '',
    freightFrom: formatDateDMY(row.FREIGHT_FDATE),
    freightTo: formatDateDMY(row.FREIGHT_TDATE),
    addCom: row.ADD_COM != null ? String(row.ADD_COM) : '',
    brokerage: row.BROKERAGE != null ? String(row.BROKERAGE) : '',
    demRate: row.DEM_RATE != null ? String(row.DEM_RATE) : '',
    desRate: row.DES_RATE != null ? String(row.DES_RATE) : '',
    contractFoPrice: row.CONTRACT_FO_PRICE != null ? String(row.CONTRACT_FO_PRICE) : '',
    currentFoPrice: row.CURRENT_FO_PRICE != null ? String(row.CURRENT_FO_PRICE) : '',
    freightUsdOut: row.FREIGHT_USD_OUT != null ? String(row.FREIGHT_USD_OUT) : '',
    bafUsdOut: row.BAF_USD_OUT != null ? String(row.BAF_USD_OUT) : '',
    freightFromOut: formatDateDMY(row.FREIGHT_FDATE_OUT),
    freightToOut: formatDateDMY(row.FREIGHT_TDATE_OUT),
    addComOut: row.ADD_COM_OUT != null ? String(row.ADD_COM_OUT) : '',
    brokerageOut: row.BROKERAGE_OUT != null ? String(row.BROKERAGE_OUT) : '',
    demRateOut: row.DEM_RATE_OUT != null ? String(row.DEM_RATE_OUT) : '',
    desRateOut: row.DES_RATE_OUT != null ? String(row.DES_RATE_OUT) : '',
    paymentClause: row.PAYMENT_CLAUSE ?? '',
    bunkerClause: row.BUNKER_CLAUSE ?? '',
    paymentClauseOut: row.PAYMENT_CLAUSE_OUT ?? '',
    bunkerClauseOut: row.BUNKER_CLAUSE_OUT ?? '',
    freightAmt: row.FREIGHT_AMT != null ? String(row.FREIGHT_AMT) : '',
    bunkerSurchargeAmt: row.BUNKER_SURCHARGE_AMT != null ? String(row.BUNKER_SURCHARGE_AMT) : '',
    demmurageAmt: row.DEMMURAGE_AMT != null ? String(row.DEMMURAGE_AMT) : '',
    despatchAmt: row.DESPATCH_AMT != null ? String(row.DESPATCH_AMT) : '',
    addCommAmt: row.ADD_COMM_AMT != null ? String(row.ADD_COMM_AMT) : '',
    brokerageAmt: row.BROKERAGE_AMT != null ? String(row.BROKERAGE_AMT) : '',
    totalAmt: row.TOTAL_AMT != null ? String(row.TOTAL_AMT) : '',
    profit: row.PROFIT != null ? String(row.PROFIT) : '',
    freightAmtOut: row.FREIGHT_AMT_OUT != null ? String(row.FREIGHT_AMT_OUT) : '',
    bunkerSurchargeAmtOut: row.BUNKER_SURCHARGE_AMT_OUT != null ? String(row.BUNKER_SURCHARGE_AMT_OUT) : '',
    demmurageAmtOut: row.DEMMURAGE_AMT_OUT != null ? String(row.DEMMURAGE_AMT_OUT) : '',
    despatchAmtOut: row.DESPATCH_AMT_OUT != null ? String(row.DESPATCH_AMT_OUT) : '',
    addCommAmtOut: row.ADD_COMM_AMT_OUT != null ? String(row.ADD_COMM_AMT_OUT) : '',
    brokerageAmtOut: row.BROKERAGE_AMT_OUT != null ? String(row.BROKERAGE_AMT_OUT) : '',
    totalAmtOut: row.TOTAL_AMT_OUT != null ? String(row.TOTAL_AMT_OUT) : '',
    coaRef: row.COA_REF ?? '',
    loadportAgent: row.LOADPORT_AGENT != null ? String(row.LOADPORT_AGENT) : '',
    loadportRemarks: row.LOADPORT_REMARKS ?? '',
    disportAgent: row.DISPORT_AGENT != null ? String(row.DISPORT_AGENT) : '',
    disportRemarks: row.DISPORT_REMARKS ?? '',
    notices: row.NOTICES ?? '',
    dA: row.D_A ?? '',
    extraInsurance: row.EXTRA_INSURANCE ?? '',
    minTerm: row.MIN_TERM ?? '',
    spclComments: row.SPCL_COMMENTS ?? '',
    nomProc: row.NOM_PROC ?? '',
    coaRefOut: row.COA_REF_OUT ?? '',
    loadportAgentOut: row.LOADPORT_AGENT_OUT != null ? String(row.LOADPORT_AGENT_OUT) : '',
    loadportRemarksOut: row.LOADPORT_REMARKS_OUT ?? '',
    disportAgentOut: row.DISPORT_AGENT_OUT != null ? String(row.DISPORT_AGENT_OUT) : '',
    disportRemarksOut: row.DISPORT_REMARKS_OUT ?? '',
    noticesOut: row.NOTICES_OUT ?? '',
    dAOut: row.D_A_OUT ?? '',
    extraInsuranceOut: row.EXTRA_INSURANCE_OUT ?? '',
    minTermOut: row.MIN_TERM_OUT ?? '',
    spclCommentsOut: row.SPCL_COMMENTS_OUT ?? '',
    nomProcOut: row.NOM_PROC_OUT ?? '',
    businessTypeId: row.BUSINESSTYPEID != null ? String(row.BUSINESSTYPEID) : '3',
    fixed: Number(row.FIXED) === 1,
    partiesIn: parties.filter((p) => p.identify === 'IN'),
    partiesOut: parties.filter((p) => p.identify === 'OUT'),
    loadPortsIn: ports.filter((p) => p.identify === 'IN' && p.portType === 'LP'),
    dischargePortsIn: ports.filter((p) => p.identify === 'IN' && p.portType === 'DP'),
    loadPortsOut: ports.filter((p) => p.identify === 'OUT' && p.portType === 'LP'),
    dischargePortsOut: ports.filter((p) => p.identify === 'OUT' && p.portType === 'DP'),
  };
}

export async function dbGetCargoRelet(fcaId) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT * FROM cargo_relet_estimate_masster
     WHERE FCAID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [fcaId, COA_MODULE_ID, appContext.companyId],
  );
  if (!row) return null;

  const [partyRows] = await pool.query(
    `SELECT CHARTERER AS charterer, OWNER AS owner, BROKER AS broker, IDENTIFY AS identify
     FROM cargo_relet_estimate_slave1 WHERE FCAID = ?`,
    [fcaId],
  );
  const [portRows] = await pool.query(
    `SELECT PORTID AS portId, COMMENTS AS comments, PORT_TYPE AS portType, IDENTIFY AS identify
     FROM cargo_relet_estimate_slave2 WHERE FCAID = ?`,
    [fcaId],
  );

  return mapReletDetail(
    row,
    partyRows.map((p) => ({
      charterer: p.charterer != null ? String(p.charterer) : '',
      owner: p.owner != null ? String(p.owner) : '',
      broker: p.broker != null ? String(p.broker) : '',
      identify: p.identify,
    })),
    portRows.map((p) => ({
      portId: p.portId != null ? String(p.portId) : '',
      comments: p.comments ?? '',
      portType: p.portType,
      identify: p.identify,
    })),
  );
}

async function replaceReletChildren(connection, fcaId, payload) {
  await connection.query('DELETE FROM cargo_relet_estimate_slave1 WHERE FCAID = ?', [fcaId]);
  await connection.query('DELETE FROM cargo_relet_estimate_slave2 WHERE FCAID = ?', [fcaId]);

  const insertParty = async (party, identify) => {
    if (!party?.charterer && !party?.owner && !party?.broker) return;
    await connection.query(
      `INSERT INTO cargo_relet_estimate_slave1 (FCAID, CHARTERER, OWNER, BROKER, IDENTIFY)
       VALUES (?, ?, ?, ?, ?)`,
      [
        fcaId,
        nullIfEmpty(party.charterer),
        nullIfEmpty(party.owner),
        nullIfEmpty(party.broker),
        identify,
      ],
    );
  };
  const insertPort = async (port, portType, identify) => {
    if (!port?.portId) return;
    await connection.query(
      `INSERT INTO cargo_relet_estimate_slave2 (FCAID, PORTID, COMMENTS, PORT_TYPE, IDENTIFY)
       VALUES (?, ?, ?, ?, ?)`,
      [fcaId, nullIfEmpty(port.portId), nullIfEmpty(port.comments), portType, identify],
    );
  };

  for (const party of payload.partiesIn || []) await insertParty(party, 'IN');
  for (const party of payload.partiesOut || []) await insertParty(party, 'OUT');
  for (const port of payload.loadPortsIn || []) await insertPort(port, 'LP', 'IN');
  for (const port of payload.dischargePortsIn || []) await insertPort(port, 'DP', 'IN');
  for (const port of payload.loadPortsOut || []) await insertPort(port, 'LP', 'OUT');
  for (const port of payload.dischargePortsOut || []) await insertPort(port, 'DP', 'OUT');
}

function reletMasterValues(payload, includeMeta = false) {
  const values = [
    nullIfEmpty(payload.coaId),
    nullIfEmpty(payload.updateStatus) || '1',
    nullIfEmpty(payload.openCargoId),
    nullIfEmpty(payload.vesselImoId),
    toDbDate(payload.transDate),
    nullIfEmpty(payload.reletNo),
    nullIfEmpty(payload.reletName),
    nullIfEmpty(payload.vesselType),
    nullIfEmpty(payload.cargoQty),
    nullIfEmpty(payload.freightUsd),
    nullIfEmpty(payload.bafUsd),
    toDbDate(payload.freightFrom),
    toDbDate(payload.freightTo),
    nullIfEmpty(payload.addCom),
    nullIfEmpty(payload.brokerage),
    nullIfEmpty(payload.demRate),
    nullIfEmpty(payload.desRate),
    nullIfEmpty(payload.contractFoPrice),
    nullIfEmpty(payload.currentFoPrice),
    nullIfEmpty(payload.freightUsdOut),
    nullIfEmpty(payload.bafUsdOut),
    toDbDate(payload.freightFromOut),
    toDbDate(payload.freightToOut),
    nullIfEmpty(payload.addComOut),
    nullIfEmpty(payload.brokerageOut),
    nullIfEmpty(payload.demRateOut),
    nullIfEmpty(payload.desRateOut),
    nullIfEmpty(payload.paymentClause),
    nullIfEmpty(payload.bunkerClause),
    nullIfEmpty(payload.paymentClauseOut),
    nullIfEmpty(payload.bunkerClauseOut),
    nullIfEmpty(payload.freightAmt),
    nullIfEmpty(payload.bunkerSurchargeAmt),
    nullIfEmpty(payload.demmurageAmt),
    nullIfEmpty(payload.despatchAmt),
    nullIfEmpty(payload.addCommAmt),
    nullIfEmpty(payload.brokerageAmt),
    nullIfEmpty(payload.totalAmt),
    nullIfEmpty(payload.profit),
    nullIfEmpty(payload.freightAmtOut),
    nullIfEmpty(payload.bunkerSurchargeAmtOut),
    nullIfEmpty(payload.demmurageAmtOut),
    nullIfEmpty(payload.despatchAmtOut),
    nullIfEmpty(payload.addCommAmtOut),
    nullIfEmpty(payload.brokerageAmtOut),
    nullIfEmpty(payload.totalAmtOut),
    nullIfEmpty(payload.coaRef),
    nullIfEmpty(payload.loadportAgent),
    nullIfEmpty(payload.loadportRemarks),
    nullIfEmpty(payload.disportAgent),
    nullIfEmpty(payload.disportRemarks),
    nullIfEmpty(payload.notices),
    nullIfEmpty(payload.dA),
    nullIfEmpty(payload.extraInsurance),
    nullIfEmpty(payload.minTerm),
    nullIfEmpty(payload.spclComments),
    nullIfEmpty(payload.nomProc),
    nullIfEmpty(payload.coaRefOut),
    nullIfEmpty(payload.loadportAgentOut),
    nullIfEmpty(payload.loadportRemarksOut),
    nullIfEmpty(payload.disportAgentOut),
    nullIfEmpty(payload.disportRemarksOut),
    nullIfEmpty(payload.noticesOut),
    nullIfEmpty(payload.dAOut),
    nullIfEmpty(payload.extraInsuranceOut),
    nullIfEmpty(payload.minTermOut),
    nullIfEmpty(payload.spclCommentsOut),
    nullIfEmpty(payload.nomProcOut),
    nullIfEmpty(payload.businessTypeId) || '2',
  ];
  if (includeMeta) {
    values.splice(3, 0, COA_MODULE_ID, appContext.companyId);
  }
  return values;
}

export async function dbCreateCargoRelet(payload) {
  if (!payload.coaId) throw new Error('COA is required for cargo relet.');
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO cargo_relet_estimate_masster (
        COAID, UPDATE_STATUS, OPEN_CARGOID, MODULEID, MCOMPANYID, ADDONDATE, VESSEL_IMO_ID,
        TRANS_DATE, CARGO_RELET_NO, CARGO_RELET_NAME, VESSEL_TYPE, CARGO_QMT_MT, FREIGHT_USD,
        BAF_USD, FREIGHT_FDATE, FREIGHT_TDATE, ADD_COM, BROKERAGE, DEM_RATE, DES_RATE,
        CONTRACT_FO_PRICE, CURRENT_FO_PRICE, FREIGHT_USD_OUT, BAF_USD_OUT, FREIGHT_FDATE_OUT,
        FREIGHT_TDATE_OUT, ADD_COM_OUT, BROKERAGE_OUT, DEM_RATE_OUT, DES_RATE_OUT,
        PAYMENT_CLAUSE, BUNKER_CLAUSE, PAYMENT_CLAUSE_OUT, BUNKER_CLAUSE_OUT, FREIGHT_AMT,
        BUNKER_SURCHARGE_AMT, DEMMURAGE_AMT, DESPATCH_AMT, ADD_COMM_AMT, BROKERAGE_AMT,
        TOTAL_AMT, PROFIT, FREIGHT_AMT_OUT, BUNKER_SURCHARGE_AMT_OUT, DEMMURAGE_AMT_OUT,
        DESPATCH_AMT_OUT, ADD_COMM_AMT_OUT, BROKERAGE_AMT_OUT, TOTAL_AMT_OUT, COA_REF,
        LOADPORT_AGENT, LOADPORT_REMARKS, DISPORT_AGENT, DISPORT_REMARKS, NOTICES, D_A,
        EXTRA_INSURANCE, MIN_TERM, SPCL_COMMENTS, NOM_PROC, COA_REF_OUT, LOADPORT_AGENT_OUT,
        LOADPORT_REMARKS_OUT, DISPORT_AGENT_OUT, DISPORT_REMARKS_OUT, NOTICES_OUT, D_A_OUT,
        EXTRA_INSURANCE_OUT, MIN_TERM_OUT, SPCL_COMMENTS_OUT, NOM_PROC_OUT, BUSINESSTYPEID,
        FINAL_STATUS, FIXED
      ) VALUES (
        ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0
      )`,
      reletMasterValues(payload, true),
    );
    const fcaId = result.insertId;
    await replaceReletChildren(connection, fcaId, payload);
    await finalizeCargoReletCompare(connection, fcaId, payload);
    await connection.query(
      `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
       VALUES (?, 'COA Cargo Relet added successfully.', NOW())`,
      [appContext.userId],
    );
    await connection.commit();
    return { msg: 0, fcaId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function finalizeCargoReletCompare(connection, fcaId, payload) {
  // Legacy: txtStatus == 2 creates cargo_relet_estimate_compare with COAAID and fixes the relet.
  if (String(payload.updateStatus) !== '2') return;
  const coaId = nullIfEmpty(payload.coaId);
  if (!coaId) throw new Error('COA is required to submit cargo relet.');

  const [[existing]] = await connection.query(
    `SELECT COMID, FIXED FROM cargo_relet_estimate_masster WHERE FCAID = ? LIMIT 1`,
    [fcaId],
  );
  if (existing && Number(existing.FIXED) === 1) return;

  const year = new Date().getFullYear();
  const [maxRows] = await connection.query(
    `SELECT (MAX(MESSAGE_NO) + 1) AS MESSAGE_NO
     FROM cargo_relet_estimate_compare
     WHERE YEAR(ADD_ON_DATE) = ? AND MCOMPANYID = ? AND COAAID IS NOT NULL`,
    [year, appContext.companyId],
  );
  let messageNo = maxRows[0]?.MESSAGE_NO;
  if (!messageNo) messageNo = 1;
  const padded = String(messageNo).padStart(3, '0');
  const message = `${String(year).slice(-2)}-${padded}`;

  const [compareResult] = await connection.query(
    `INSERT INTO cargo_relet_estimate_compare
      (FCAID, FINAL_ID, MESSAGE_NO, USERID, ADD_ON_DATE, MESSAGE, MODULEID, MCOMPANYID, COAAID)
     VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
    [
      fcaId,
      fcaId,
      padded,
      appContext.userId,
      message,
      COA_MODULE_ID,
      appContext.companyId,
      coaId,
    ],
  );

  await connection.query(
    `UPDATE cargo_relet_estimate_masster
     SET COMID = ?, FIXED = 1, FINAL_DATETIME = NOW(), FINAL_STATUS = 1, UPDATE_STATUS = 2
     WHERE FCAID = ?`,
    [compareResult.insertId, fcaId],
  );
}

export async function dbUpdateCargoRelet(fcaId, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE cargo_relet_estimate_masster SET
        COAID = ?, UPDATE_STATUS = ?, OPEN_CARGOID = ?, VESSEL_IMO_ID = ?, TRANS_DATE = ?,
        CARGO_RELET_NO = ?, CARGO_RELET_NAME = ?, VESSEL_TYPE = ?, CARGO_QMT_MT = ?,
        FREIGHT_USD = ?, BAF_USD = ?, FREIGHT_FDATE = ?, FREIGHT_TDATE = ?, ADD_COM = ?,
        BROKERAGE = ?, DEM_RATE = ?, DES_RATE = ?, CONTRACT_FO_PRICE = ?, CURRENT_FO_PRICE = ?,
        FREIGHT_USD_OUT = ?, BAF_USD_OUT = ?, FREIGHT_FDATE_OUT = ?, FREIGHT_TDATE_OUT = ?,
        ADD_COM_OUT = ?, BROKERAGE_OUT = ?, DEM_RATE_OUT = ?, DES_RATE_OUT = ?,
        PAYMENT_CLAUSE = ?, BUNKER_CLAUSE = ?, PAYMENT_CLAUSE_OUT = ?, BUNKER_CLAUSE_OUT = ?,
        FREIGHT_AMT = ?, BUNKER_SURCHARGE_AMT = ?, DEMMURAGE_AMT = ?, DESPATCH_AMT = ?,
        ADD_COMM_AMT = ?, BROKERAGE_AMT = ?, TOTAL_AMT = ?, PROFIT = ?, FREIGHT_AMT_OUT = ?,
        BUNKER_SURCHARGE_AMT_OUT = ?, DEMMURAGE_AMT_OUT = ?, DESPATCH_AMT_OUT = ?,
        ADD_COMM_AMT_OUT = ?, BROKERAGE_AMT_OUT = ?, TOTAL_AMT_OUT = ?, COA_REF = ?,
        LOADPORT_AGENT = ?, LOADPORT_REMARKS = ?, DISPORT_AGENT = ?, DISPORT_REMARKS = ?,
        NOTICES = ?, D_A = ?, EXTRA_INSURANCE = ?, MIN_TERM = ?, SPCL_COMMENTS = ?, NOM_PROC = ?,
        COA_REF_OUT = ?, LOADPORT_AGENT_OUT = ?, LOADPORT_REMARKS_OUT = ?, DISPORT_AGENT_OUT = ?,
        DISPORT_REMARKS_OUT = ?, NOTICES_OUT = ?, D_A_OUT = ?, EXTRA_INSURANCE_OUT = ?,
        MIN_TERM_OUT = ?, SPCL_COMMENTS_OUT = ?, NOM_PROC_OUT = ?, BUSINESSTYPEID = ?
       WHERE FCAID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [...reletMasterValues(payload, false), fcaId, COA_MODULE_ID, appContext.companyId],
    );
    if (!result.affectedRows) throw new Error('Cargo relet not found.');
    await replaceReletChildren(connection, fcaId, payload);
    await finalizeCargoReletCompare(connection, fcaId, payload);
    await connection.query(
      `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
       VALUES (?, 'COA Cargo Relet updated successfully.', NOW())`,
      [appContext.userId],
    );
    await connection.commit();
    return { msg: 0, fcaId: Number(fcaId) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbDeleteCargoRelet(fcaId) {
  const pool = getPool();
  const [[row]] = await pool.query(
    `SELECT FIXED FROM cargo_relet_estimate_masster
     WHERE FCAID = ? AND MODULEID = ? AND MCOMPANYID = ? LIMIT 1`,
    [fcaId, COA_MODULE_ID, appContext.companyId],
  );
  if (!row) throw new Error('Cargo relet not found.');
  if (Number(row.FIXED) === 1) throw new Error('Cannot delete a fixed cargo relet.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM cargo_relet_estimate_slave1 WHERE FCAID = ?', [fcaId]);
    await connection.query('DELETE FROM cargo_relet_estimate_slave2 WHERE FCAID = ?', [fcaId]);
    await connection.query(
      `DELETE FROM cargo_relet_estimate_masster
       WHERE FCAID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [fcaId, COA_MODULE_ID, appContext.companyId],
    );
    await connection.query(
      `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
       VALUES (?, 'COA Cargo Relet deleted successfully.', NOW())`,
      [appContext.userId],
    );
    await connection.commit();
    return { msg: 0 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbListCoaOpsVoyages({
  selBType,
  status = '1',
  page = 1,
  pageSize = 10,
  search = '',
  fromDate,
  toDate,
} = {}) {
  const pool = getPool();
  const businessType = selBType || '2';
  const opsStatus = String(status) === '2' ? '2' : '1';
  const offset = (Math.max(1, page) - 1) * pageSize;

  const conditions = [
    'c.MODULEID = ?',
    'c.MCOMPANYID = ?',
    "c.FINAL_ID != ''",
    'm.FIXED = 1',
    'c.STATUS = ?',
    'm.ESTIMATE_TYPE = ?',
    'c.COAAID IS NOT NULL',
  ];
  const params = [COA_MODULE_ID, appContext.companyId, opsStatus, businessType];

  if (fromDate && toDate) {
    conditions.push('DATE(m.TRANS_DATE) >= ? AND DATE(m.TRANS_DATE) <= ?');
    params.push(parsePeriodDate(fromDate), parsePeriodDate(toDate));
  }
  if (search) {
    conditions.push(`(
      m.VOYAGE_NO LIKE ? OR c.MESSAGE LIKE ? OR coa.COA_ID LIKE ?
      OR vim.VESSEL_NAME LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.join(' AND ');
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN coa_master coa ON coa.COAID = c.COAAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT c.COMID, c.COAAID, c.MESSAGE, c.STATUS, c.FCAID,
            m.VESSEL_IMO_ID, m.VOYAGE_NO, m.TRANS_DATE, m.TOTAL_DAYS,
            m.DAILY_EARNING, m.PROFIT_LOSS, m.VESSEL_TYPE,
            coa.COA_ID, coa.COA_NO, vim.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN coa_master coa ON coa.COAID = c.COAAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE ${where}
     ORDER BY DATE(m.TRANS_DATE) DESC, c.COMID DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const records = [];
  let index = offset;
  for (const row of rows) {
    index += 1;
    const fcaId = await getLatestFcaId(pool, row.COMID);
    const [legs] = fcaId
      ? await pool.query(
        `SELECT FROM_PORT, TO_PORT, LOAD_PORT_QTY, DISC_PORT_QTY
         FROM freight_cost_estimete_slave1 WHERE FCAID = ?`,
        [fcaId],
      )
      : [[]];
    const load = [];
    const discharge = [];
    for (const leg of legs) {
      if (Number(leg.LOAD_PORT_QTY) > 0) load.push(await getPortShortName(pool, leg.FROM_PORT));
      if (Number(leg.DISC_PORT_QTY) > 0) discharge.push(await getPortShortName(pool, leg.TO_PORT));
    }
    const [[qtyRow]] = fcaId
      ? await pool.query(
        `SELECT SUM(CARGO_MT) AS SUM FROM freight_cost_estimete_slave10
         WHERE FCAID = ? AND STATUS != 3`,
        [fcaId],
      )
      : [[{ SUM: null }]];

    records.push({
      index,
      comId: row.COMID,
      fcaId: fcaId || row.FCAID,
      coaId: row.COAAID,
      coaIdentity: row.COA_ID ?? '',
      coaNo: row.COA_NO ?? '',
      voyageNo: row.VOYAGE_NO ?? '',
      vesselName: row.VESSEL_NAME ?? '',
      vesselType: row.VESSEL_TYPE ?? '',
      cpDate: formatDateDMY(row.TRANS_DATE),
      ports: `${load.filter(Boolean).join(', ')} / ${discharge.filter(Boolean).join(', ')}`,
      duration: row.TOTAL_DAYS ?? '',
      cargoQty: qtyRow?.SUM ?? '',
      tce: row.DAILY_EARNING ?? '',
      profitLoss: row.PROFIT_LOSS ?? '',
      message: row.MESSAGE ?? '',
      status: opsStatus === '1' ? 'In Ops' : 'Post Ops',
      statusCode: Number(opsStatus),
      canMoveToPostOps: opsStatus === '1',
    });
  }

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    page,
    pageSize,
  };
}

export async function dbMoveVoyageToPostOps(comId) {
  const pool = getPool();
  const [result] = await pool.query(
    `UPDATE freight_cost_estimate_compare
     SET STATUS = 2
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
       AND STATUS = 1 AND COAAID IS NOT NULL`,
    [comId, COA_MODULE_ID, appContext.companyId],
  );
  if (!result.affectedRows) {
    throw new Error('Voyage not found or already in Post Ops.');
  }
  await pool.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, 'COA voyage moved to Post Ops.', NOW())`,
    [appContext.userId],
  );
  return { msg: 0 };
}

export async function dbGetCoaNominations(coaId) {
  const pool = getPool();
  const [[coa]] = await pool.query(
    'SELECT COA_ID, COA_NO, CURRENCY FROM coa_master WHERE COAID = ? LIMIT 1',
    [coaId],
  );
  if (!coa) return { coaLabel: '', currency: '', voyages: [], relets: [] };

  const [voyageRows] = await pool.query(
    `SELECT c.COMID, c.MESSAGE, m.VESSEL_IMO_ID, m.VOYAGE_NO, m.TRANS_DATE,
            m.TOTAL_DAYS, m.DAILY_EARNING, m.PROFIT_LOSS, m.VESSEL_TYPE, m.FCAID,
            vim.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.COAAID = ? AND c.FINAL_ID != '' AND m.FIXED = 1
     ORDER BY DATE(m.TRANS_DATE) DESC`,
    [coaId],
  );

  const [reletRows] = await pool.query(
    `SELECT r.FCAID, r.CARGO_RELET_NO, r.CARGO_QMT_MT, r.FREIGHT_USD, r.FREIGHT_AMT,
            r.BUNKER_SURCHARGE_AMT, r.FREIGHT_USD_OUT, r.FREIGHT_AMT_OUT, r.PROFIT, r.FIXED
     FROM cargo_relet_estimate_masster r
     WHERE r.COAID = ? AND r.MODULEID = ? AND r.MCOMPANYID = ? AND r.SHEET_NO IS NULL
     ORDER BY r.FCAID DESC`,
    [coaId, COA_MODULE_ID, appContext.companyId],
  );

  return {
    coaLabel: `${coa.COA_ID} / ${coa.COA_NO}`,
    currency: coa.CURRENCY || 'USD',
    voyages: voyageRows.map((row, i) => ({
      index: i + 1,
      comId: row.COMID,
      fcaId: row.FCAID,
      vesselName: row.VESSEL_NAME ?? '',
      voyageNo: row.VOYAGE_NO ?? '',
      cpDate: formatDateDMY(row.TRANS_DATE),
      duration: row.TOTAL_DAYS ?? '',
      tce: row.DAILY_EARNING ?? '',
      profitLoss: row.PROFIT_LOSS ?? '',
      message: row.MESSAGE ?? '',
    })),
    relets: reletRows.map((row, i) => ({
      index: i + 1,
      fcaId: row.FCAID,
      reletNo: row.CARGO_RELET_NO ?? '',
      cargoQty: row.CARGO_QMT_MT ?? '',
      freightInPerMt: row.FREIGHT_USD ?? '',
      freightInAmt: row.FREIGHT_AMT ?? '',
      foSurcharge: row.BUNKER_SURCHARGE_AMT ?? '',
      freightOutPerMt: row.FREIGHT_USD_OUT ?? '',
      freightOutAmt: row.FREIGHT_AMT_OUT ?? '',
      profit: row.PROFIT ?? '',
      fixed: Number(row.FIXED) === 1,
    })),
  };
}

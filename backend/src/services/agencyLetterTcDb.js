import { appContext } from '../config.js';
import { getPool } from '../db.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function blankDate(value) {
  if (!value) return '';
  const str = String(value);
  if (str.includes('1970-01-01')) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (date.getFullYear() === 1970 && date.getMonth() === 0 && date.getDate() === 1) {
    return '';
  }
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

function formatListDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = String(date.getDate()).padStart(2, '0');
  return `${d}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function parseDmyDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '1970-01-01';
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (!match) {
    const fallback = new Date(raw);
    if (Number.isNaN(fallback.getTime())) return '1970-01-01';
    return fallback.toISOString().slice(0, 10);
  }
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function agentLine(row) {
  if (!row) return '';
  const name = row.NAME || '';
  const attn = row.STREET_2 || '';
  const email = row.EMAILID || '';
  return `${name} /att. ${attn} (${email})`;
}

function shipOwnerLine(row) {
  if (!row) return '';
  return `${row.NAME || ''}, ${row.STREET_1 || ''}`;
}

async function getMaxAgencyNumberTc(connection) {
  const [[row]] = await connection.query(
    'SELECT MAX(USERNAMEID) + 1 AS USERNAMEID FROM generate_agency_letter_tc',
  );
  let empcode = row?.USERNAMEID;
  if (empcode == null) return '001';
  empcode = String(empcode);
  while (empcode.length < 3) empcode = `0${empcode}`;
  return empcode;
}

async function dbGetAgencyLetterTcLookups(pool) {
  const [[agents], [shipOwners], [ports], [purposes]] = await Promise.all([
    pool.query(
      `SELECT CODE AS id, NAME AS name, STREET_1, STREET_2, EMAILID
       FROM vendor_master
       WHERE STATUS = 1 AND MCOMPANYID = ?
       ORDER BY NAME
       LIMIT 2000`,
      [COMPANY_ID],
    ).catch(() => [[]]),
    pool.query(
      `SELECT CODE AS id, NAME AS name, STREET_1, STREET_2, EMAILID
       FROM vendor_master
       WHERE STATUS = 1 AND VENDOR_TYPEID = 11 AND MCOMPANYID = ?
       ORDER BY NAME`,
      [COMPANY_ID],
    ).catch(() => [[]]),
    pool.query(
      `SELECT PortId AS id, PortName AS name
       FROM port_master
       ORDER BY PortName
       LIMIT 2000`,
    ).catch(() => [[]]),
    pool.query(
      `SELECT PORT_CALLID AS id, NAME AS name
       FROM port_call_purpose_master
       WHERE STATUS = 1
       ORDER BY NAME`,
    ).catch(() => [[]]),
  ]);

  return {
    agents: (agents || []).map((row) => ({
      id: String(row.id),
      name: `${row.name || ''} ( ${row.id} )`,
      detail: agentLine(row),
    })),
    shipOwners: (shipOwners || []).map((row) => ({
      id: String(row.id),
      name: `${row.name || ''} ( ${row.id} )`,
      detail: shipOwnerLine(row),
    })),
    ports: (ports || []).map((row) => ({ id: String(row.id), name: row.name || '' })),
    purposes: (purposes || []).map((row) => ({ id: String(row.id), name: row.name || '' })),
  };
}

export async function dbGetAgencyLetterTcForm(comId) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const [[master]] = await pool.query(
    `SELECT m.TCOUTID, m.TC_NO, m.VESSEL_IMO_ID, m.MASTERS_NAME, vim.VESSEL_NAME
     FROM chartering_estimate_tc_master m
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.COMID = ? AND m.MODULEID = ? AND m.MCOMPANYID = ?
     ORDER BY m.TCOUTID DESC
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
  );

  if (!master?.TCOUTID) {
    const error = new Error('TC estimate not found for this nomination.');
    error.status = 404;
    throw error;
  }

  const [[compare]] = await pool.query(
    `SELECT MESSAGE
     FROM chartering_estimate_tc_compare
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
  );

  const [[draft]] = await pool.query(
    `SELECT *
     FROM generate_agency_letter_tc
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS = 1
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
  );

  const [records] = await pool.query(
    `SELECT g.*,
            pm.PortName AS PORT_NAME,
            pp.NAME AS PURPOSE_NAME,
            vm.NAME AS AGENT_NAME
     FROM generate_agency_letter_tc g
     LEFT JOIN port_master pm ON pm.PortId = g.PORT_OF_CALL
     LEFT JOIN port_call_purpose_master pp ON pp.PORT_CALLID = g.PURPOSE_OF_CALL
     LEFT JOIN vendor_master vm ON vm.CODE = g.VENDORID AND vm.MCOMPANYID = g.MCOMPANYID
     WHERE g.COMID = ? AND g.MODULEID = ? AND g.MCOMPANYID = ? AND g.STATUS >= 1
     ORDER BY g.GEN_AGENCY_TC_ID`,
    [comId, MODULE_ID, COMPANY_ID],
  );

  const lookups = await dbGetAgencyLetterTcLookups(pool);
  const vesselName = master.VESSEL_NAME || '';

  return {
    comId: String(comId),
    tcOutId: String(master.TCOUTID),
    tcNo: master.TC_NO || '',
    nomId: compare?.MESSAGE || '',
    vesselName,
    mastersNameDefault: master.MASTERS_NAME || '',
    draft: draft
      ? {
        genAgencyTcId: String(draft.GEN_AGENCY_TC_ID),
        date: blankDate(draft.DATE),
        vesselName: draft.VSL_DETAILS || vesselName,
        vendorId: draft.VENDORID != null ? String(draft.VENDORID) : '',
        portOfCall: draft.PORT_OF_CALL != null ? String(draft.PORT_OF_CALL) : '',
        purposeOfCall: draft.PURPOSE_OF_CALL != null ? String(draft.PURPOSE_OF_CALL) : '',
        mastersName: draft.TERMO_OF_TOLERANCE || '',
        shipOwner: draft.SHIP_OWNER != null ? String(draft.SHIP_OWNER) : '',
        mainDescription: draft.MAIN_DESCRIPTION || '',
        status: Number(draft.STATUS) || 1,
      }
      : null,
    records: (records || []).map((row, index) => ({
      index: index + 1,
      genAgencyTcId: String(row.GEN_AGENCY_TC_ID),
      date: formatListDate(row.DATE),
      portName: row.PORT_NAME || '',
      purposeName: row.PURPOSE_NAME || '',
      agentName: row.AGENT_NAME || '',
      status: Number(row.STATUS) || 0,
    })),
    lookups,
  };
}

export async function dbSaveAgencyLetterTc(payload = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const comId = payload.comId;
    const genAgencyTcId = payload.genAgencyTcId || '';
    const status = Number(payload.updateStatus) === 2 ? 2 : 1;
    const date = parseDmyDate(payload.date);
    const vesselName = String(payload.vesselName || '').trim();
    const vendorId = String(payload.vendorId || '').trim();
    const portOfCall = String(payload.portOfCall || '').trim();
    const purposeOfCall = String(payload.purposeOfCall || '').trim();
    const mastersName = String(payload.mastersName || '').trim();
    const shipOwner = String(payload.shipOwner || '').trim();
    const mainDescription = String(payload.mainDescription || '')
      .replace(/…/g, '...')
      .replace(/[”“]/g, '"')
      .replace(/[’‘]/g, "'")
      .trim();

    if (!comId) {
      const error = new Error('COMID is required.');
      error.status = 400;
      throw error;
    }
    if (!payload.date || !vendorId || !portOfCall || !purposeOfCall || !mastersName || !shipOwner || !mainDescription) {
      const error = new Error('Please fill all required fields.');
      error.status = 400;
      throw error;
    }

    await connection.beginTransaction();

    const [openRows] = await connection.query(
      `SELECT GEN_AGENCY_TC_ID
       FROM generate_agency_letter_tc
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ? AND STATUS = 1
       LIMIT 1`,
      [comId, MODULE_ID, COMPANY_ID],
    );

    const usernameId = await getMaxAgencyNumberTc(connection);
    let savedId = genAgencyTcId;

    if (!openRows.length) {
      const [result] = await connection.query(
        `INSERT INTO generate_agency_letter_tc (
           COMID, MODULEID, MCOMPANYID, DATE, VSL_DETAILS, VENDORID, PORT_OF_CALL,
           PURPOSE_OF_CALL, TERMO_OF_TOLERANCE, USERNAMEID, STATUS, SHIP_OWNER,
           MAIN_DESCRIPTION, LOGINID
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          comId, MODULE_ID, COMPANY_ID, date, vesselName, vendorId, portOfCall,
          purposeOfCall, mastersName, usernameId, status, shipOwner,
          mainDescription, appContext.userId,
        ],
      );
      savedId = result.insertId;
    } else if (genAgencyTcId) {
      await connection.query(
        `UPDATE generate_agency_letter_tc SET
           DATE = ?, VSL_DETAILS = ?, VENDORID = ?, PORT_OF_CALL = ?, PURPOSE_OF_CALL = ?,
           TERMO_OF_TOLERANCE = ?, USERNAMEID = ?, STATUS = ?, SHIP_OWNER = ?, MAIN_DESCRIPTION = ?
         WHERE GEN_AGENCY_TC_ID = ? AND COMID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
        [
          date, vesselName, vendorId, portOfCall, purposeOfCall,
          mastersName, usernameId, status, shipOwner, mainDescription,
          genAgencyTcId, comId, MODULE_ID, COMPANY_ID,
        ],
      );
      savedId = genAgencyTcId;
    } else {
      await connection.rollback();
      return { msg: 1 };
    }

    await connection.commit();
    return { msg: 0, genAgencyTcId: savedId, updateStatus: status };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function dbDeleteAgencyLetterTc(genAgencyTcId) {
  const pool = getPool();
  if (!genAgencyTcId) {
    const error = new Error('Agency letter id is required.');
    error.status = 400;
    throw error;
  }
  const [result] = await pool.query(
    `DELETE FROM generate_agency_letter_tc WHERE GEN_AGENCY_TC_ID = ?`,
    [genAgencyTcId],
  );
  if (!result.affectedRows) {
    const error = new Error('Agency letter not found.');
    error.status = 404;
    throw error;
  }
  return { msg: 0 };
}

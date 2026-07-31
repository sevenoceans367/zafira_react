import { appContext } from '../config.js';
import { getPool } from '../db.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

const ACCOUNT_OF_OPTIONS = [
  { id: 'Owner', name: 'Owner' },
  { id: 'Charterer', name: 'Charterer' },
];

function blankDateTime(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.startsWith('0000-00-00') || raw.includes('1970-01-01')) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) {
    const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmy) return raw.trim();
    return '';
  }
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${d}-${m}-${y} ${hh}:${mm}:${ss}`;
}

function parseDmyDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) {
    const fallback = new Date(raw);
    if (Number.isNaN(fallback.getTime())) return null;
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')} ${String(fallback.getHours()).padStart(2, '0')}:${String(fallback.getMinutes()).padStart(2, '0')}:${String(fallback.getSeconds()).padStart(2, '0')}`;
  }
  const [, dd, mm, yyyy, hh = '00', min = '00', sec = '00'] = match;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function str(value) {
  if (value == null) return '';
  return String(value);
}

function strOrNull(value) {
  const s = String(value ?? '').trim();
  return s === '' ? null : s;
}

function numOrNull(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptyBunkerRow() {
  return {
    bunkerId: '',
    robSosp: '',
    qtyStemmed: '',
    supplyPrice: '',
    addCost: '',
    effectivePrice: '',
    stemmedValue: '',
    remarks: '',
    accountOf: '',
  };
}

function mapSlave2Row(row) {
  return {
    bunkerId: row?.BUNKERID != null ? str(row.BUNKERID) : '',
    robSosp: row?.ROB_SOSP != null ? str(row.ROB_SOSP) : '',
    qtyStemmed: row?.STEEMED_QTY != null ? str(row.STEEMED_QTY) : '',
    supplyPrice: row?.SUPPLY_PRICE != null ? str(row.SUPPLY_PRICE) : '',
    addCost: row?.ADDNL_COST != null ? str(row.ADDNL_COST) : '',
    effectivePrice: row?.EFFECTIVE_PRICE != null ? str(row.EFFECTIVE_PRICE) : '',
    stemmedValue: row?.STEEMED_VALUE != null ? str(row.STEEMED_VALUE) : '',
    remarks: str(row?.REMARKS),
    accountOf: str(row?.ONACCOUNT_OF),
  };
}

async function getPortName(pool, portId) {
  if (!portId) return '';
  const [[row]] = await pool.query(
    `SELECT PortName, COUNTRY_KEY FROM port_master WHERE PortId = ? LIMIT 1`,
    [portId],
  ).catch(() => [[null]]);
  if (!row?.PortName) return '';
  return row.COUNTRY_KEY ? `${row.PortName} (${row.COUNTRY_KEY})` : row.PortName;
}

export async function getLatestCostSheetId(pool, comId) {
  const [[row]] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  ).catch(() => [[null]]);
  if (row?.FCAID) return row.FCAID;

  const [[fallback]] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId],
  ).catch(() => [[null]]);
  return fallback?.FCAID || null;
}

async function getVendorName(pool, code) {
  if (!code) return '';
  const [[row]] = await pool.query(
    `SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1`,
    [code],
  ).catch(() => [[null]]);
  return row?.NAME || '';
}

async function loadGrades(pool, types) {
  const typeList = Array.isArray(types) ? types : [types];
  const placeholders = typeList.map(() => '?').join(',');
  try {
    const [rows] = await pool.query(
      `SELECT BUNKERGRADEID AS id, NAME AS name
       FROM bunker_grade_master
       WHERE STATUS = 1 AND BUNKERTYPE IN (${placeholders})
         AND MODULEID = ? AND MCOMPANYID = ?
       ORDER BY NAME`,
      [...typeList, MODULE_ID, COMPANY_ID],
    );
    if (rows?.length) {
      return rows.map((row) => ({ id: str(row.id), name: str(row.name) }));
    }
  } catch {
    // fall through without module/company filter
  }

  const [rows] = await pool.query(
    `SELECT BUNKERGRADEID AS id, NAME AS name
     FROM bunker_grade_master
     WHERE STATUS = 1 AND BUNKERTYPE IN (${placeholders})
     ORDER BY NAME`,
    typeList,
  ).catch(() => [[]]);

  return (rows || []).map((row) => ({ id: str(row.id), name: str(row.name) }));
}

function hasPortId(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return s !== '' && s !== '0';
}

/**
 * PHP bunker_calculation.php: every FROM_PORT + last leg TO_PORT (no TBN filter).
 */
async function loadVoyagePorts(pool, fcaId) {
  if (!fcaId) return [];
  const [legs] = await pool.query(
    `SELECT FROM_PORT, TO_PORT, RANDOMID
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?
     ORDER BY FCA_SLAVEID ASC`,
    [fcaId],
  ).catch(() => [[]]);

  const ports = [];
  const legsArr = legs || [];
  for (let i = 0; i < legsArr.length; i += 1) {
    const leg = legsArr[i];
    if (hasPortId(leg.FROM_PORT)) {
      const fromName = await getPortName(pool, leg.FROM_PORT);
      ports.push({
        portId: str(leg.FROM_PORT),
        randomId: str(leg.RANDOMID || ''),
        portName: fromName || str(leg.FROM_PORT),
      });
    }
    // Last leg only: append TO_PORT (matches PHP arr_ports).
    if (i === legsArr.length - 1 && hasPortId(leg.TO_PORT)) {
      const toName = await getPortName(pool, leg.TO_PORT);
      ports.push({
        portId: str(leg.TO_PORT),
        randomId: str(leg.RANDOMID || ''),
        portName: toName || str(leg.TO_PORT),
      });
    }
  }
  return ports;
}

async function loadExistingComparePorts(pool, comId) {
  const [rows] = await pool.query(
    `SELECT PORTID, RANDOMID, COM_SLAVEID, ROB_DATE
     FROM freight_cost_estimate_compare_slave
     WHERE COMID = ?
     ORDER BY COM_SLAVEID ASC`,
    [comId],
  ).catch(() => [[]]);

  const ports = [];
  for (const row of rows || []) {
    if (!hasPortId(row.PORTID)) continue;
    const portName = await getPortName(pool, row.PORTID);
    ports.push({
      portId: str(row.PORTID),
      randomId: str(row.RANDOMID || ''),
      portName: portName || str(row.PORTID),
      comSlaveId: str(row.COM_SLAVEID),
      sospDate: blankDateTime(row.ROB_DATE),
    });
  }
  return ports;
}

async function ensureCompareSlave(pool, comId, portId, randomId) {
  const [[existing]] = await pool.query(
    `SELECT COM_SLAVEID, ROB_DATE
     FROM freight_cost_estimate_compare_slave
     WHERE COMID = ? AND PORTID = ? AND RANDOMID = ?
     LIMIT 1`,
    [comId, portId, randomId],
  ).catch(() => [[null]]);

  if (existing?.COM_SLAVEID) {
    return {
      comSlaveId: str(existing.COM_SLAVEID),
      sospDate: blankDateTime(existing.ROB_DATE),
    };
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO freight_cost_estimate_compare_slave (COMID, PORTID, RANDOMID, ROB_DATE)
       VALUES (?, ?, ?, NULL)`,
      [comId, portId, randomId],
    );
    return {
      comSlaveId: result?.insertId != null ? str(result.insertId) : '',
      sospDate: '',
    };
  } catch {
    // Still show the port UI even if slave insert fails (e.g. permissions).
    return { comSlaveId: '', sospDate: '' };
  }
}

async function loadSlave2Rows(pool, comId, comSlaveId, bunkerType) {
  if (!comSlaveId) return [emptyBunkerRow()];
  const [rows] = await pool.query(
    `SELECT * FROM freight_cost_estimate_compare_slave2
     WHERE COMID = ? AND COM_SLAVEID = ? AND BUNKER_TYPE = ?`,
    [comId, comSlaveId, bunkerType],
  ).catch(() => [[]]);

  if (!rows?.length) return [emptyBunkerRow()];
  return rows.map(mapSlave2Row);
}

async function resolvePrevComId(pool, comId, vesselImoId, addOnDate, requestPrevComId, storedPrevComId) {
  if (requestPrevComId) return str(requestPrevComId);
  if (storedPrevComId) return str(storedPrevComId);
  if (!vesselImoId || !addOnDate) return '';

  const [[row]] = await pool.query(
    `SELECT c.COMID
     FROM freight_cost_estimate_compare c
     WHERE c.COMID != ?
       AND (
         SELECT m.VESSEL_IMO_ID FROM freight_cost_estimete_master m
         WHERE m.COMID = c.COMID LIMIT 1
       ) = ?
       AND (
         SELECT m2.FIXED FROM freight_cost_estimete_master m2
         WHERE m2.COMID = c.COMID LIMIT 1
       ) = 1
       AND c.ADD_ON_DATE < ?
       AND c.MCOMPANYID = ?
     ORDER BY c.ADD_ON_DATE DESC
     LIMIT 1`,
    [comId, vesselImoId, addOnDate, COMPANY_ID],
  ).catch(() => [[null]]);

  return row?.COMID != null ? str(row.COMID) : '';
}

async function loadPrevVoyageOptions(pool, comId, vesselImoId) {
  if (!vesselImoId) return [];
  const [rows] = await pool.query(
    `SELECT c.COMID AS id, c.MESSAGE AS name
     FROM freight_cost_estimate_compare c
     WHERE c.COMID != ?
       AND c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND (
         SELECT m.VESSEL_IMO_ID FROM freight_cost_estimete_master m
         WHERE m.COMID = c.COMID LIMIT 1
       ) = ?
     ORDER BY c.ADD_ON_DATE DESC`,
    [comId, MODULE_ID, COMPANY_ID, vesselImoId],
  ).catch(() => [[]]);

  return (rows || []).map((row) => ({
    id: str(row.id),
    name: str(row.name || row.id),
  }));
}

async function loadPreviousPortSosp(pool, comId, prevComId, grades) {
  let prevSlaveId = null;
  if (prevComId) {
    const [[prevPort]] = await pool.query(
      `SELECT COM_SLAVEID
       FROM freight_cost_estimate_compare_slave
       WHERE COMID = ?
       ORDER BY COM_SLAVEID DESC
       LIMIT 1`,
      [prevComId],
    ).catch(() => [[null]]);
    prevSlaveId = prevPort?.COM_SLAVEID || null;
  }

  const results = [];
  for (const grade of grades) {
    let qty = '';
    let value = '';
    let calDesc = '';

    if (prevComId && prevSlaveId) {
      const [[fromPrev]] = await pool.query(
        `SELECT s2.ROB_SOSP,
                (
                  SELECT s3.SOSP_VALUE
                  FROM freight_cost_estimate_compare_slave3 s3
                  WHERE s3.BUNKERID = s2.BUNKERID AND s3.COMID = s2.COMID
                  LIMIT 1
                ) AS BUNKER_PRICE,
                (
                  SELECT s3.CAL_DESC
                  FROM freight_cost_estimate_compare_slave3 s3
                  WHERE s3.BUNKERID = s2.BUNKERID AND s3.COMID = s2.COMID
                  LIMIT 1
                ) AS CAL_DESC
         FROM freight_cost_estimate_compare_slave2 s2
         WHERE s2.COMID = ? AND s2.BUNKERID = ? AND s2.COM_SLAVEID = ?
         LIMIT 1`,
        [prevComId, grade.id, prevSlaveId],
      ).catch(() => [[null]]);

      if (fromPrev) {
        qty = fromPrev.ROB_SOSP != null ? str(fromPrev.ROB_SOSP) : '';
        value = fromPrev.BUNKER_PRICE != null ? str(fromPrev.BUNKER_PRICE) : '';
        calDesc = str(fromPrev.CAL_DESC);
      }
    }

    if (!qty && !value && !calDesc) {
      const [[fromSlave5]] = await pool.query(
        `SELECT ROB_SOSP, BUNKER_PRICE, CAL_DESC
         FROM freight_cost_estimate_compare_slave5
         WHERE COMID = ? AND BUNKERID = ?
         LIMIT 1`,
        [comId, grade.id],
      ).catch(() => [[null]]);
      if (fromSlave5) {
        qty = fromSlave5.ROB_SOSP != null ? str(fromSlave5.ROB_SOSP) : '';
        value = fromSlave5.BUNKER_PRICE != null ? str(fromSlave5.BUNKER_PRICE) : '';
        calDesc = str(fromSlave5.CAL_DESC);
      }
    }

    results.push({
      bunkerId: grade.id,
      name: grade.name,
      qty,
      value,
      calDesc,
    });
  }
  return results;
}

async function loadSospResults(pool, comId, bunkerType, gradeNameById) {
  const [rows] = await pool.query(
    `SELECT BUNKERID, SOSP_VALUE, CAL_DESC
     FROM freight_cost_estimate_compare_slave3
     WHERE COMID = ? AND BUNKER_TYPE = ?`,
    [comId, bunkerType],
  ).catch(() => [[]]);

  return (rows || []).map((row) => {
    const bunkerId = str(row.BUNKERID);
    return {
      bunkerId,
      name: gradeNameById.get(bunkerId) || '',
      value: row.SOSP_VALUE != null ? str(row.SOSP_VALUE) : '',
      calDesc: str(row.CAL_DESC),
    };
  });
}

async function loadConsumed(pool, comId, bunkerType, consumedOn, gradeNameById) {
  const [rows] = await pool.query(
    `SELECT BUNKERID, QTY_USER, USED_AMT
     FROM freight_cost_estimate_compare_slave4
     WHERE COMID = ? AND BUNKER_TYPE = ? AND CONSUMEDON = ?`,
    [comId, bunkerType, consumedOn],
  ).catch(() => [[]]);

  return (rows || []).map((row) => {
    const bunkerId = str(row.BUNKERID);
    return {
      bunkerId,
      name: gradeNameById.get(bunkerId) || '',
      qty: row.QTY_USER != null ? str(row.QTY_USER) : '',
      value: row.USED_AMT != null ? str(row.USED_AMT) : '',
    };
  });
}

async function replaceSlave2(connection, comId, comSlaveId, bunkerType, rows) {
  await connection.query(
    `DELETE FROM freight_cost_estimate_compare_slave2
     WHERE COMID = ? AND COM_SLAVEID = ? AND BUNKER_TYPE = ?`,
    [comId, comSlaveId, bunkerType],
  );

  for (const row of rows || []) {
    const bunkerId = strOrNull(row.bunkerId);
    if (!bunkerId) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimate_compare_slave2
        (COMID, COM_SLAVEID, BUNKER_TYPE, BUNKERID, ROB_SOSP, STEEMED_QTY,
         SUPPLY_PRICE, ADDNL_COST, EFFECTIVE_PRICE, STEEMED_VALUE, REMARKS, ONACCOUNT_OF)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        comId,
        comSlaveId,
        bunkerType,
        bunkerId,
        numOrNull(row.robSosp),
        numOrNull(row.qtyStemmed),
        numOrNull(row.supplyPrice),
        numOrNull(row.addCost),
        numOrNull(row.effectivePrice),
        numOrNull(row.stemmedValue),
        str(row.remarks),
        str(row.accountOf),
      ],
    );
  }
}

async function replaceSlave3(connection, comId, sospResults) {
  await connection.query(
    `DELETE FROM freight_cost_estimate_compare_slave3 WHERE COMID = ?`,
    [comId],
  );

  const groups = [
    { type: 'FO', rows: sospResults?.fo || [] },
    { type: 'DO', rows: sospResults?.do || [] },
  ];

  for (const group of groups) {
    for (const row of group.rows) {
      const bunkerId = strOrNull(row.bunkerId);
      if (!bunkerId) continue;
      await connection.query(
        `INSERT INTO freight_cost_estimate_compare_slave3
          (COMID, BUNKER_TYPE, BUNKERID, SOSP_VALUE, CAL_DESC)
         VALUES (?, ?, ?, ?, ?)`,
        [comId, group.type, bunkerId, numOrNull(row.value), str(row.calDesc)],
      );
    }
  }
}

async function replaceSlave4(connection, comId, consumedCharterer, consumedOwner) {
  await connection.query(
    `DELETE FROM freight_cost_estimate_compare_slave4 WHERE COMID = ?`,
    [comId],
  );

  const batches = [
    { consumedOn: 'CHARTERER', bunkerType: 'FO', rows: consumedCharterer?.fo || [] },
    { consumedOn: 'CHARTERER', bunkerType: 'DO', rows: consumedCharterer?.do || [] },
    { consumedOn: 'OWNER', bunkerType: 'FO', rows: consumedOwner?.fo || [] },
    { consumedOn: 'OWNER', bunkerType: 'DO', rows: consumedOwner?.do || [] },
  ];

  for (const batch of batches) {
    for (const row of batch.rows) {
      const bunkerId = strOrNull(row.bunkerId);
      if (!bunkerId) continue;
      await connection.query(
        `INSERT INTO freight_cost_estimate_compare_slave4
          (COMID, BUNKER_TYPE, BUNKERID, CONSUMEDON, QTY_USER, USED_AMT)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          comId,
          batch.bunkerType,
          bunkerId,
          batch.consumedOn,
          numOrNull(row.qty),
          numOrNull(row.value),
        ],
      );
    }
  }
}

async function upsertSlave5(connection, comId, previousFo, previousDo) {
  await connection.query(
    `DELETE FROM freight_cost_estimate_compare_slave5 WHERE COMID = ?`,
    [comId],
  );

  const rows = [...(previousFo || []), ...(previousDo || [])];
  for (const row of rows) {
    const bunkerId = strOrNull(row.bunkerId);
    if (!bunkerId) continue;
    await connection.query(
      `INSERT INTO freight_cost_estimate_compare_slave5
        (COMID, BUNKERID, ROB_SOSP, BUNKER_PRICE, CAL_DESC)
       VALUES (?, ?, ?, ?, ?)`,
      [
        comId,
        bunkerId,
        numOrNull(row.qty),
        numOrNull(row.value),
        str(row.calDesc),
      ],
    );
  }
}

/**
 * PHP bunker_calculation.php — Ops VC bunker form load.
 */
export async function dbGetBunkerForm(comId, prevComIdOverride) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const [[compare]] = await pool.query(
    `SELECT c.COMID, c.MESSAGE, c.FCAID, c.PREVCOMID, c.ADD_ON_DATE,
            m.VESSEL_IMO_ID, m.VOYAGE_NO, m.FGFF_VENDORID,
            vim.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.COMID = ? AND c.MODULEID = ?
     LIMIT 1`,
    [comId, MODULE_ID],
  );

  if (!compare?.COMID) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
  }

  const fcaId = (await getLatestCostSheetId(pool, comId)) || compare.FCAID;
  let vesselImoId = compare.VESSEL_IMO_ID;
  let voyageNo = compare.VOYAGE_NO || '';
  let vesselName = compare.VESSEL_NAME || '';
  let vendorCode = compare.FGFF_VENDORID;

  if (fcaId) {
    const [[master]] = await pool.query(
      `SELECT VOYAGE_NO, VESSEL_IMO_ID, FGFF_VENDORID
       FROM freight_cost_estimete_master
       WHERE FCAID = ?
       LIMIT 1`,
      [fcaId],
    ).catch(() => [[null]]);
    if (master) {
      voyageNo = master.VOYAGE_NO || voyageNo;
      vesselImoId = master.VESSEL_IMO_ID || vesselImoId;
      vendorCode = master.FGFF_VENDORID || vendorCode;
      if (!vesselName && vesselImoId) {
        const [[vim]] = await pool.query(
          `SELECT VESSEL_NAME FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? LIMIT 1`,
          [vesselImoId],
        ).catch(() => [[null]]);
        vesselName = vim?.VESSEL_NAME || '';
      }
    }
  }

  const charterer = await getVendorName(pool, vendorCode);

  const prevComId = await resolvePrevComId(
    pool,
    comId,
    vesselImoId,
    compare.ADD_ON_DATE,
    prevComIdOverride,
    compare.PREVCOMID,
  );
  const prevVoyageOptions = await loadPrevVoyageOptions(pool, comId, vesselImoId);

  const foGrades = await loadGrades(pool, ['IFO']);
  const doGrades = await loadGrades(pool, ['MDO', 'MGO']);
  const gradeNameById = new Map(
    [...foGrades, ...doGrades].map((g) => [g.id, g.name]),
  );

  const previousFo = await loadPreviousPortSosp(pool, comId, prevComId, foGrades);
  const previousDo = await loadPreviousPortSosp(pool, comId, prevComId, doGrades);

  let voyagePorts = fcaId ? await loadVoyagePorts(pool, fcaId) : [];
  if (!voyagePorts.length && compare.FCAID && String(compare.FCAID) !== String(fcaId || '')) {
    voyagePorts = await loadVoyagePorts(pool, compare.FCAID);
  }
  // Fallback: ports already saved on this nomination (compare_slave).
  if (!voyagePorts.length) {
    voyagePorts = await loadExistingComparePorts(pool, comId);
  }

  const ports = [];
  for (const port of voyagePorts) {
    const slave = port.comSlaveId
      ? { comSlaveId: port.comSlaveId, sospDate: port.sospDate || '' }
      : await ensureCompareSlave(pool, comId, port.portId, port.randomId);
    const foRows = await loadSlave2Rows(pool, comId, slave.comSlaveId, 'FO');
    const doRows = await loadSlave2Rows(pool, comId, slave.comSlaveId, 'DO');
    ports.push({
      key: `${port.portId}-${port.randomId || ports.length}`,
      portId: port.portId,
      randomId: port.randomId,
      portName: port.portName,
      comSlaveId: slave.comSlaveId,
      sospDate: slave.sospDate,
      foRows,
      doRows,
    });
  }

  const sospResults = {
    fo: await loadSospResults(pool, comId, 'FO', gradeNameById),
    do: await loadSospResults(pool, comId, 'DO', gradeNameById),
  };

  const consumedCharterer = {
    fo: await loadConsumed(pool, comId, 'FO', 'CHARTERER', gradeNameById),
    do: await loadConsumed(pool, comId, 'DO', 'CHARTERER', gradeNameById),
  };
  const consumedOwner = {
    fo: await loadConsumed(pool, comId, 'FO', 'OWNER', gradeNameById),
    do: await loadConsumed(pool, comId, 'DO', 'OWNER', gradeNameById),
  };

  return {
    comId: str(comId),
    fcaId: fcaId != null ? str(fcaId) : '',
    voyageNo: str(voyageNo),
    vesselName: str(vesselName),
    message: str(compare.MESSAGE),
    charterer,
    currency: 'USD',
    prevComId,
    prevVoyageOptions,
    previousFo,
    previousDo,
    ports,
    sospResults,
    consumedCharterer,
    consumedOwner,
    lookups: {
      foGrades,
      doGrades,
      accountOfOptions: ACCOUNT_OF_OPTIONS,
    },
  };
}

/**
 * Reverse of PHP updationBunkerRecords() — persist bunker calculation payload.
 */
export async function dbSaveBunker(payload = {}) {
  const pool = getPool();
  const comId = payload.comId || payload.comid;
  const status = Number(payload.status ?? 0);
  const prevComId = strOrNull(payload.prevComId ?? payload.prevcomid);

  if (!comId) {
    const error = new Error('comId is required.');
    error.status = 400;
    throw error;
  }

  const [[compare]] = await pool.query(
    `SELECT COMID FROM freight_cost_estimate_compare
     WHERE COMID = ? AND MODULEID = ?
     LIMIT 1`,
    [comId, MODULE_ID],
  );

  if (!compare?.COMID) {
    const error = new Error('VC nomination not found.');
    error.status = 404;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE freight_cost_estimate_compare
       SET PREVCOMID = ?
       WHERE COMID = ? AND MODULEID = ?`,
      [prevComId, comId, MODULE_ID],
    );

    for (const port of payload.ports || []) {
      const portId = str(port.portId);
      const randomId = str(port.randomId);
      if (!portId || !randomId) continue;

      const robDate = parseDmyDateTime(port.sospDate);

      const [[existing]] = await connection.query(
        `SELECT COM_SLAVEID
         FROM freight_cost_estimate_compare_slave
         WHERE COMID = ? AND PORTID = ? AND RANDOMID = ?
         LIMIT 1`,
        [comId, portId, randomId],
      );

      let comSlaveId = existing?.COM_SLAVEID;
      if (comSlaveId) {
        await connection.query(
          `UPDATE freight_cost_estimate_compare_slave
           SET ROB_DATE = ?
           WHERE COM_SLAVEID = ?`,
          [robDate, comSlaveId],
        );
      } else {
        const [inserted] = await connection.query(
          `INSERT INTO freight_cost_estimate_compare_slave (COMID, PORTID, RANDOMID, ROB_DATE)
           VALUES (?, ?, ?, ?)`,
          [comId, portId, randomId, robDate],
        );
        comSlaveId = inserted.insertId;
      }

      await replaceSlave2(connection, comId, comSlaveId, 'FO', port.foRows);
      await replaceSlave2(connection, comId, comSlaveId, 'DO', port.doRows);
    }

    await replaceSlave3(connection, comId, payload.sospResults);
    await replaceSlave4(connection, comId, payload.consumedCharterer, payload.consumedOwner);
    await upsertSlave5(connection, comId, payload.previousFo, payload.previousDo);

    await connection.commit();
    return { msg: 0, closed: status === 1 };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

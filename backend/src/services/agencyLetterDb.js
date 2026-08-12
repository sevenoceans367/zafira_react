import { appContext } from '../config.js';
import { getPool } from '../db.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function blankDate(value, withTime = false) {
  if (!value) return '';
  const str = String(value);
  if (str.includes('1970-01-01')) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (
    date.getFullYear() === 1970
    && date.getMonth() === 0
    && date.getDate() === 1
  ) {
    return '';
  }
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  if (!withTime) return `${d}-${m}-${y}`;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}-${m}-${y} ${hh}:${mm}`;
}

function parseDmyDate(value, withTime = false) {
  const raw = String(value || '').trim();
  if (!raw) return withTime ? '1970-01-01 08:00:00' : '1970-01-01';
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (!match) {
    const fallback = new Date(raw);
    if (Number.isNaN(fallback.getTime())) return withTime ? '1970-01-01 08:00:00' : '1970-01-01';
    return withTime
      ? fallback.toISOString().slice(0, 16).replace('T', ' ')
      : fallback.toISOString().slice(0, 10);
  }
  const [, dd, mm, yyyy, hh = '08', min = '00'] = match;
  const datePart = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  return withTime ? `${datePart} ${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}:00` : datePart;
}

function padAgencyNumber(value) {
  if (value == null || value === '') return '001';
  let code = String(value);
  while (code.length < 3) code = `0${code}`;
  return code;
}

function storedPortType(portType) {
  return String(portType || '').slice(0, 2);
}

/** PHP LPDP_*: Yes when port is OPA (LPOPA/DPOPA), otherwise No / blank. */
function resolveLpDpFlag(portType, payload = {}) {
  if (payload.lpDp != null && String(payload.lpDp).trim() !== '') {
    return String(payload.lpDp).trim();
  }
  const type = String(portType || '').toUpperCase();
  if (type.includes('OPA')) return 'Yes';
  return 'No';
}

let agencyLetterColumnsPromise = null;
async function getAgencyLetterColumns(connection) {
  if (!agencyLetterColumnsPromise) {
    agencyLetterColumnsPromise = connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'generate_agency_letter'`,
    ).then(([rows]) => new Set(rows.map((row) => String(row.COLUMN_NAME || '').toUpperCase())))
      .catch((err) => {
        agencyLetterColumnsPromise = null;
        throw err;
      });
  }
  return agencyLetterColumnsPromise;
}

async function agencyLetterHasColumn(connection, columnName) {
  const cols = await getAgencyLetterColumns(connection);
  return cols.has(String(columnName || '').toUpperCase());
}

function hasValue(value) {
  if (value == null) return false;
  const str = String(value).trim();
  return str !== '' && str.toLowerCase() !== 'null';
}

async function getPortName(pool, portId) {
  if (!portId) return '';
  const [[row]] = await pool.query(
    'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
    [portId],
  );
  return row?.PortName || '';
}

async function countAgentLegs(pool, fcaId) {
  if (!fcaId) return 0;
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?
       AND (
         NULLIF(TRIM(PORT_COSTLP_VENDOR), '') IS NOT NULL
         OR NULLIF(TRIM(PORT_COSTDP_VENDOR), '') IS NOT NULL
         OR NULLIF(TRIM(PORT_COSTTP_VENDOR), '') IS NOT NULL
         OR NULLIF(TRIM(LP_OPA_VENDOR), '') IS NOT NULL
         OR NULLIF(TRIM(DP_OPA_VENDOR), '') IS NOT NULL
       )`,
    [fcaId],
  ).catch(async () => {
    const [[fallback]] = await pool.query(
      `SELECT COUNT(*) AS total FROM freight_cost_estimete_slave1 WHERE FCAID = ?`,
      [fcaId],
    );
    return [[fallback]];
  });
  return Number(row?.total || 0);
}

async function getLatestCostSheetId(pool, comId) {
  const candidates = [];

  const [[compare]] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimate_compare
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
     ORDER BY COMID DESC
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
  ).catch(() => [[null]]);
  if (compare?.FCAID) candidates.push(compare.FCAID);

  const [[byModule]] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  ).catch(() => [[null]]);
  if (byModule?.FCAID) candidates.push(byModule.FCAID);

  const [[withSheet]] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ? AND SHEET_NO IS NOT NULL
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId],
  ).catch(() => [[null]]);
  if (withSheet?.FCAID) candidates.push(withSheet.FCAID);

  const [[anyLatest]] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId],
  ).catch(() => [[null]]);
  if (anyLatest?.FCAID) candidates.push(anyLatest.FCAID);

  const unique = [...new Set(candidates.filter(Boolean).map((id) => String(id)))];
  if (!unique.length) return null;

  let best = unique[0];
  let bestScore = -1;
  for (const fcaId of unique) {
    const score = await countAgentLegs(pool, fcaId);
    if (score > bestScore) {
      bestScore = score;
      best = fcaId;
    }
  }
  return best;
}

async function getVendorByCode(pool, code) {
  if (!code) return null;
  const [[row]] = await pool.query(
    `SELECT CODE, NAME, STREET_2, EMAILID
     FROM vendor_master
     WHERE CODE = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [code, COMPANY_ID],
  );
  return row || null;
}

async function getMaxAgencyNumber(pool) {
  const [[row]] = await pool.query(
    'SELECT MAX(USERNAMEID) + 1 AS USERNAMEID FROM generate_agency_letter',
  );
  return padAgencyNumber(row?.USERNAMEID);
}

async function getCompanyShortName(pool) {
  const [[row]] = await pool.query(
    'SELECT SHORT_NAME FROM main_company WHERE MCOMPANYID = ? LIMIT 1',
    [COMPANY_ID],
  );
  return row?.SHORT_NAME || '';
}

async function getCargoDefaults(pool, comId, costSheetId) {
  let cargoDefault = '';
  let toleranceDefault = '';
  try {
    const [[sheet]] = await pool.query(
      `SELECT OPEN_CARGOID FROM freight_cost_estimete_master WHERE FCAID = ? LIMIT 1`,
      [costSheetId],
    );
    const openCargoId = sheet?.OPEN_CARGOID;
    if (!openCargoId) return { cargoDefault, toleranceDefault };

    const [[openCargo]] = await pool.query(
      `SELECT CARGO, TOLERANCE FROM open_cargo_master
       WHERE OPEN_CARGOID = ? AND MODULEID = ? AND MCOMPANYID = ?
       LIMIT 1`,
      [openCargoId, MODULE_ID, COMPANY_ID],
    );
    toleranceDefault = openCargo?.TOLERANCE || '';
    const cargoIds = String(openCargo?.CARGO || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (cargoIds.length) {
      const placeholders = cargoIds.map(() => '?').join(',');
      const [materials] = await pool.query(
        `SELECT MATERIAL_TYPE FROM cargo_master WHERE MATERIALID IN (${placeholders})`,
        cargoIds,
      );
      cargoDefault = materials.map((row) => row.MATERIAL_TYPE).filter(Boolean).join(', ');
    }
  } catch {
    // optional defaults
  }
  return { cargoDefault, toleranceDefault };
}

async function getEtaFixture(pool, comId, portType, portId, randomId) {
  try {
    const type = storedPortType(portType);
    if (type !== 'LP' && type !== 'DP') return '';
    const [rows] = await pool.query(
      `SELECT ENTITY_VALUE FROM checklist_loadport
       WHERE MODULEID = ? AND MCOMPANYID = ? AND COMID = ?
         AND ENTITY_NAME IN (
           'ETA 30 DAYS','ETA 25 DAYS','ETA 20 DAYS','ETA 15 DAYS','ETA 10 DAYS',
           'ETA 7 DAYS','ETA 5 DAYS','ETA 3 DAYS','ETA 2 DAYS','ETA 1 DAY'
         )
         AND PORT = ? AND PORTID = ? AND RANDOMID = ?
         ${type === 'DP' ? "AND ENTITY_VALUE != ''" : ''}
       ORDER BY CHKLIST_LPID DESC
       LIMIT 1`,
      [MODULE_ID, COMPANY_ID, comId, type, portId, randomId],
    );
    return blankDate(rows[0]?.ENTITY_VALUE, true);
  } catch {
    return '';
  }
}

async function loadLetterForPort(pool, { comId, portType, portId, randomId }) {
  const port = String(portType || '');
  const stored = storedPortType(port);
  const [rows] = await pool.query(
    `SELECT * FROM generate_agency_letter
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
       AND PORT IN (?, ?) AND PORTID = ? AND RANDOMID = ?
     ORDER BY GEN_AGENCY_ID DESC
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID, port, stored, portId, randomId],
  );
  const letter = rows[0] || null;
  if (!letter) return { letter: null, entities: [], bunkers: [], records: [] };

  const [entities] = await pool.query(
    `SELECT ENTITY AS entity, ENTITY_NAME AS name, EMAILID AS email
     FROM generate_agency_letter_slave1
     WHERE GEN_AGENCY_ID = ?`,
    [letter.GEN_AGENCY_ID],
  );
  const [bunkers] = await pool.query(
    `SELECT GRADE AS grade, SUPPLIER AS supplier, PHYSICAL AS physical,
            QUANTITY AS quantity, BUNKERPORT AS bunkerPort
     FROM generate_agency_letter_slave2
     WHERE GEN_AGENCY_ID = ?`,
    [letter.GEN_AGENCY_ID],
  );

  const [allRows] = await pool.query(
    `SELECT g.*, cm.COUNTRY_NAME AS countryName, pm.PortName AS portName, vm.NAME AS vendorName
     FROM generate_agency_letter g
     LEFT JOIN country_master cm ON cm.COUNTRYID = g.COUNTRY_ID
     LEFT JOIN port_master pm ON pm.PortId = g.PORTID
     LEFT JOIN vendor_master vm ON vm.CODE = g.VENDORID AND vm.MCOMPANYID = g.MCOMPANYID
     WHERE g.COMID = ? AND g.MODULEID = ? AND g.MCOMPANYID = ?
       AND g.PORT IN (?, ?) AND g.PORTID = ? AND g.RANDOMID = ?
     ORDER BY g.GEN_AGENCY_ID`,
    [comId, MODULE_ID, COMPANY_ID, port, stored, portId, randomId],
  );

  return {
    letter: {
      genAgencyId: letter.GEN_AGENCY_ID,
      date: blankDate(letter.DATE),
      qty: letter.QTY ?? '',
      countryId: letter.COUNTRY_ID != null ? String(letter.COUNTRY_ID) : '',
      countryName: '',
      username: letter.USERNAME ?? '',
      password: letter.PASSWORD ?? '',
      etaDate1: blankDate(letter.ETA_DATE1, true),
      masterName: letter.TERMO_OF_TOLERANCE ?? '',
      cargoDetails: letter.CARGO_PACKING_DESC ?? '',
      tolerance: letter.TOLERANCE_PERCENT_SUB ?? '',
      shipOwner: letter.SHIP_OWNER != null ? String(letter.SHIP_OWNER) : '',
      etaDate: blankDate(letter.ETA_DATE, true),
      bunkerSurveyor: letter.BUNKER_SURVEYOR ?? '',
      bunkerSurveyorCom: letter.BUNKER_SURVEYORCOM ?? '',
      status: Number(letter.STATUS || 0),
      vendorId: letter.VENDORID ?? '',
    },
    entities: entities.map((row) => ({
      entity: row.entity != null ? String(row.entity) : '',
      name: row.name ?? '',
      email: row.email ?? '',
    })),
    bunkers: bunkers.map((row) => ({
      bunkerPort: row.bunkerPort != null ? String(row.bunkerPort) : '',
      grade: row.grade ?? '',
      supplier: row.supplier ?? '',
      physical: row.physical ?? '',
      quantity: row.quantity ?? '',
    })),
    records: await Promise.all(allRows.map(async (row, index) => {
      let countryName = row.countryName || '';
      if (!countryName && row.COUNTRY_ID) {
        const [[c]] = await pool.query(
          'SELECT COUNTRY_NAME FROM country_master WHERE COUNTRYID = ? LIMIT 1',
          [row.COUNTRY_ID],
        );
        countryName = c?.COUNTRY_NAME || '';
      }
      return {
        index: index + 1,
        genAgencyId: row.GEN_AGENCY_ID,
        countryName,
        portName: row.portName || '',
        cargoDetails: row.CARGO_PACKING_DESC ?? '',
        agentName: row.vendorName || '',
        date: blankDate(row.DATE),
        username: row.USERNAME ?? '',
        password: row.PASSWORD ?? '',
        portType: row.PORT ?? '',
        vendorId: row.VENDORID ?? '',
        randomId: row.RANDOMID ?? '',
        portId: row.PORTID ?? '',
      };
    })),
  };
}

export async function dbGetAgencyLetterLookups() {
  const pool = getPool();
  const [entityTypes] = await pool.query(
    `SELECT VENDOR_TYPEID AS id, NAME AS name
     FROM vendor_type_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  ).catch(() => [[]]);
  const [countries] = await pool.query(
    `SELECT COUNTRYID AS id, COUNTRY_NAME AS name
     FROM country_master
     WHERE STATUS = 1
     ORDER BY COUNTRY_NAME`,
  ).catch(() => [[]]);
  const [shipOwners] = await pool.query(
    `SELECT CODE AS id, NAME AS name
     FROM vendor_master
     WHERE STATUS = 1 AND VENDOR_TYPEID = 11 AND MCOMPANYID = ?
     ORDER BY NAME`,
    [COMPANY_ID],
  ).catch(() => [[]]);
  const [ports] = await pool.query(
    `SELECT PortCode AS id, PortName AS name
     FROM port_master
     WHERE STATUS = 1
     ORDER BY PortName
     LIMIT 2000`,
  ).catch(() => [[]]);

  return {
    entityTypes: (entityTypes || []).map((row) => ({ id: String(row.id), name: row.name || '' })),
    countries: (countries || []).map((row) => ({ id: String(row.id), name: row.name || '' })),
    shipOwners: (shipOwners || []).map((row) => ({
      id: String(row.id),
      name: `${row.name || ''} (${row.id})`,
    })),
    ports: (ports || []).map((row) => ({ id: String(row.id), name: row.name || '' })),
  };
}

export async function dbGetAgencyLetterForm(comId) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const costSheetId = await getLatestCostSheetId(pool, comId);
  if (!costSheetId) {
    const error = new Error('No cost sheet found for this voyage.');
    error.status = 404;
    throw error;
  }

  const [[compare]] = await pool.query(
    `SELECT MESSAGE FROM freight_cost_estimate_compare
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
  );

  const [[sheet]] = await pool.query(
    `SELECT m.FCAID, m.VESSEL_IMO_ID, vim.VESSEL_NAME
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.FCAID = ?
     LIMIT 1`,
    [costSheetId],
  );

  let legs = [];
  try {
    const [rows] = await pool.query(
      `SELECT FROM_PORT, TO_PORT, RANDOMID, DP_OPA_VENDOR, LP_OPA_VENDOR,
              LOAD_PORT_QTY, DISC_PORT_QTY, PORT_COSTLP_VENDOR, PORT_COSTDP_VENDOR,
              PORT_COSTTP_VENDOR, PASSAGE_TYPE
       FROM freight_cost_estimete_slave1
       WHERE FCAID = ?
       ORDER BY FCA_SLAVEID ASC`,
      [costSheetId],
    );
    legs = rows;
  } catch {
    const [rows] = await pool.query(
      `SELECT FROM_PORT, TO_PORT, RANDOMID,
              LOAD_PORT_QTY, DISC_PORT_QTY, PORT_COSTLP_VENDOR, PORT_COSTDP_VENDOR,
              PORT_COSTTP_VENDOR
       FROM freight_cost_estimete_slave1
       WHERE FCAID = ?
       ORDER BY FCA_SLAVEID ASC`,
      [costSheetId],
    );
    legs = rows.map((row) => ({ ...row, LP_OPA_VENDOR: '', DP_OPA_VENDOR: '', PASSAGE_TYPE: null }));
  }

  const { cargoDefault, toleranceDefault } = await getCargoDefaults(pool, comId, costSheetId);
  const agencyNumber = await getMaxAgencyNumber(pool);
  const shortName = await getCompanyShortName(pool);
  const lookups = await dbGetAgencyLetterLookups();

  const ports = [];
  for (const leg of legs) {
    const fromName = await getPortName(pool, leg.FROM_PORT);
    if (String(fromName || '').trim().toUpperCase() === 'TBN') continue;

    const candidates = [];
    if (hasValue(leg.PORT_COSTLP_VENDOR)) {
      candidates.push({
        portType: 'LP',
        portId: leg.FROM_PORT,
        randomId: leg.RANDOMID,
        qty: leg.LOAD_PORT_QTY ?? '',
        agentCode: String(leg.PORT_COSTLP_VENDOR).trim(),
      });
    }
    if (hasValue(leg.PORT_COSTDP_VENDOR)) {
      candidates.push({
        portType: 'DP',
        portId: leg.TO_PORT,
        randomId: leg.RANDOMID,
        qty: leg.DISC_PORT_QTY ?? '',
        agentCode: String(leg.PORT_COSTDP_VENDOR).trim(),
      });
    }
    if (hasValue(leg.LP_OPA_VENDOR)) {
      candidates.push({
        portType: 'LPOPA',
        portId: leg.FROM_PORT,
        randomId: leg.RANDOMID,
        qty: leg.LOAD_PORT_QTY ?? '',
        agentCode: String(leg.LP_OPA_VENDOR).trim(),
      });
    }
    if (hasValue(leg.DP_OPA_VENDOR)) {
      candidates.push({
        portType: 'DPOPA',
        portId: leg.TO_PORT,
        randomId: leg.RANDOMID,
        qty: leg.DISC_PORT_QTY ?? '',
        agentCode: String(leg.DP_OPA_VENDOR).trim(),
      });
    }
    if (hasValue(leg.PORT_COSTTP_VENDOR)) {
      candidates.push({
        portType: 'TP',
        portId: leg.FROM_PORT,
        randomId: leg.RANDOMID,
        qty: 0,
        agentCode: String(leg.PORT_COSTTP_VENDOR).trim(),
      });
    }

    // Fallback: show LP/DP tabs from quantities when agent vendors are blank.
    if (!candidates.length) {
      if (Number(leg.LOAD_PORT_QTY) > 0 && leg.FROM_PORT) {
        candidates.push({
          portType: 'LP',
          portId: leg.FROM_PORT,
          randomId: leg.RANDOMID,
          qty: leg.LOAD_PORT_QTY ?? '',
          agentCode: '',
        });
      }
      if (Number(leg.DISC_PORT_QTY) > 0 && leg.TO_PORT) {
        candidates.push({
          portType: 'DP',
          portId: leg.TO_PORT,
          randomId: leg.RANDOMID,
          qty: leg.DISC_PORT_QTY ?? '',
          agentCode: '',
        });
      }
    }

    // Last resort: any non-TBN load/discharge port on the leg.
    if (!candidates.length) {
      if (leg.FROM_PORT) {
        candidates.push({
          portType: 'LP',
          portId: leg.FROM_PORT,
          randomId: leg.RANDOMID || `${leg.FROM_PORT}`,
          qty: leg.LOAD_PORT_QTY ?? '',
          agentCode: '',
        });
      }
      if (leg.TO_PORT && String(leg.TO_PORT) !== String(leg.FROM_PORT)) {
        candidates.push({
          portType: 'DP',
          portId: leg.TO_PORT,
          randomId: leg.RANDOMID || `${leg.TO_PORT}`,
          qty: leg.DISC_PORT_QTY ?? '',
          agentCode: '',
        });
      }
    }

    for (const candidate of candidates) {
      const portName = await getPortName(pool, candidate.portId);
      const vendor = await getVendorByCode(pool, candidate.agentCode);
      const detail = await loadLetterForPort(pool, {
        comId,
        portType: candidate.portType,
        portId: candidate.portId,
        randomId: candidate.randomId,
      });
      const etaFixture = await getEtaFixture(
        pool,
        comId,
        candidate.portType,
        candidate.portId,
        candidate.randomId,
      );
      const defaultUsername = `${shortName}/${agencyNumber}/${candidate.randomId}`;

      ports.push({
        key: `${candidate.portType}-${candidate.portId}-${candidate.randomId}`,
        tabLabel: `${candidate.portType}-${portName || candidate.portId}`,
        portType: candidate.portType,
        portId: String(candidate.portId ?? ''),
        portName,
        randomId: String(candidate.randomId ?? ''),
        agentCode: String(candidate.agentCode ?? ''),
        agentName: vendor
          ? `${vendor.NAME} (${vendor.CODE})`
          : (candidate.agentCode ? String(candidate.agentCode) : 'No agent on cost sheet'),
        qty: candidate.qty != null ? String(candidate.qty) : '',
        defaultEntityName: vendor?.STREET_2 || '',
        defaultEntityEmail: vendor?.EMAILID || '',
        etaFixture,
        defaultUsername,
        letter: detail.letter,
        entities: detail.entities.length
          ? detail.entities
          : [{ entity: '2', name: vendor?.STREET_2 || '', email: vendor?.EMAILID || '' }],
        bunkers: detail.bunkers.length
          ? detail.bunkers
          : [{ bunkerPort: '', grade: '', supplier: '', physical: '', quantity: '' }],
        records: detail.records,
        locked: Number(detail.letter?.status) === 2,
      });
    }
  }

  return {
    comId: String(comId),
    costSheetId: String(costSheetId),
    nomId: compare?.MESSAGE || '',
    vesselName: sheet?.VESSEL_NAME || '',
    cargoDefault,
    toleranceDefault,
    agencyNumber,
    legsCount: legs.length,
    ports,
    lookups,
  };
}

export async function dbSaveAgencyLetter(payload = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const comId = payload.comId;
    const portType = String(payload.portType || '');
    const port = storedPortType(portType);
    const portId = payload.portId;
    const randomId = payload.randomId;
    const vendorId = payload.vendorId;
    const username = String(payload.username || '').trim();
    const submitId = Number(payload.submitId) === 2 ? 2 : 1;
    const genAgencyId = payload.genAgencyId || null;

    if (!comId || !port || !portId || !randomId || !vendorId) {
      const error = new Error('Missing required port / agent details.');
      error.status = 400;
      throw error;
    }
    if (!payload.etaDate1) {
      const error = new Error('Please add ETA Date.');
      error.status = 400;
      throw error;
    }
    if (!payload.countryId) {
      const error = new Error('Please add country for this port.');
      error.status = 400;
      throw error;
    }

    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT GEN_AGENCY_ID FROM generate_agency_letter
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
         AND PORT = ? AND PORTID = ? AND VENDORID = ?
         AND RANDOMID = ? AND USERNAME = ?`,
      [comId, MODULE_ID, COMPANY_ID, port, portId, vendorId, randomId, username],
    );

    const date = parseDmyDate(payload.date, false);
    const etaDate1 = parseDmyDate(payload.etaDate1, true);
    const etaDate = parseDmyDate(payload.etaDate, true);
    const entities = Array.isArray(payload.entities) ? payload.entities : [];
    const bunkers = Array.isArray(payload.bunkers) ? payload.bunkers : [];

    let savedId = genAgencyId;

    if (!existing.length) {
      const usernameId = await getMaxAgencyNumber(connection);
      const includeLpDp = await agencyLetterHasColumn(connection, 'LP_DP');
      const lpDpValue = resolveLpDpFlag(portType, payload);
      const insertCols = [
        'COMID', 'MODULEID', 'MCOMPANYID', 'PORT', 'PORTID', 'DATE', 'VENDORID', 'KIND_ATTN_TO',
        'USERNAMEID', 'USERNAME', 'PASSWORD', 'QTY', 'COUNTRY_ID', 'VSL_CONTACT_DETAILS', 'VSL_DETAILS',
        'VSL_ABOUT', 'SHIP_OWNER', 'BS_SUPPLIER', 'BS_PHYSICAL', 'BS_FUEL_GR_SP', 'BS_QUANTITY',
        'BS_DOLOR_APP', 'BA_ABOUT', 'BA_HSFO_QTY', 'BA_SUPPLIER_T_B_AD', 'BA_NECESSARY_GUID',
        'BS_BUNKERING_PORT', 'TERMO_OF_TOLERANCE', 'CARGO_PACKING_DESC', 'TOLERANCE_PERCENT_SUB',
        'TOLERANCE_PERCENT_ADD', 'RANDOMID', 'STATUS', 'ETA_DATE', 'BUNKER_SURVEYOR',
        'BUNKER_SURVEYORCOM', 'LOGINID', 'ETA_DATE1',
        ...(includeLpDp ? ['LP_DP'] : []),
      ];
      const insertVals = [
        comId, MODULE_ID, COMPANY_ID, port, portId, date, vendorId, '',
        usernameId, username, payload.password || '', payload.qty || null, payload.countryId || '', '', '',
        '', payload.shipOwner || null, '', '', '', '',
        '', '', '', '', '',
        '', payload.masterName || '', payload.cargoDetails || '', payload.tolerance || '',
        '', randomId, submitId, etaDate, payload.bunkerSurveyor || '',
        payload.bunkerSurveyorCom || '', appContext.userId, etaDate1,
        ...(includeLpDp ? [lpDpValue] : []),
      ];
      const [result] = await connection.query(
        `INSERT INTO generate_agency_letter (${insertCols.join(', ')})
         VALUES (${insertCols.map(() => '?').join(', ')})`,
        insertVals,
      );
      savedId = result.insertId;
    } else if (genAgencyId) {
      const includeLpDp = await agencyLetterHasColumn(connection, 'LP_DP');
      const lpDpValue = resolveLpDpFlag(portType, payload);
      await connection.query(
        `UPDATE generate_agency_letter SET
           DATE = ?, VENDORID = ?, USERNAME = ?, PASSWORD = ?, QTY = ?, COUNTRY_ID = ?,
           SHIP_OWNER = ?, TERMO_OF_TOLERANCE = ?, CARGO_PACKING_DESC = ?,
           TOLERANCE_PERCENT_SUB = ?, RANDOMID = ?, STATUS = ?, ETA_DATE = ?,
           BUNKER_SURVEYOR = ?, BUNKER_SURVEYORCOM = ?, ETA_DATE1 = ?
           ${includeLpDp ? ', LP_DP = ?' : ''}
         WHERE GEN_AGENCY_ID = ? AND COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
           AND PORT = ? AND PORTID = ? AND VENDORID = ?`,
        [
          date, vendorId, username, payload.password || '', payload.qty || null, payload.countryId || '',
          payload.shipOwner || null, payload.masterName || '', payload.cargoDetails || '',
          payload.tolerance || '', randomId, submitId, etaDate,
          payload.bunkerSurveyor || '', payload.bunkerSurveyorCom || '', etaDate1,
          ...(includeLpDp ? [lpDpValue] : []),
          genAgencyId, comId, MODULE_ID, COMPANY_ID,
          port, portId, vendorId,
        ],
      );
      await connection.query('DELETE FROM generate_agency_letter_slave1 WHERE GEN_AGENCY_ID = ?', [genAgencyId]);
      await connection.query('DELETE FROM generate_agency_letter_slave2 WHERE GEN_AGENCY_ID = ?', [genAgencyId]);
      savedId = genAgencyId;
    } else {
      const error = new Error('This agent already exists for this port.');
      error.status = 409;
      error.msg = 1;
      throw error;
    }

    for (const entity of entities) {
      if (!entity?.entity || !entity?.name || !entity?.email) continue;
      await connection.query(
        `INSERT INTO generate_agency_letter_slave1 (GEN_AGENCY_ID, ENTITY, ENTITY_NAME, EMAILID)
         VALUES (?, ?, ?, ?)`,
        [savedId, entity.entity, entity.name, entity.email],
      );
    }

    for (const bunker of bunkers) {
      if (!bunker?.grade || !bunker?.supplier || !bunker?.physical || !bunker?.quantity) continue;
      await connection.query(
        `INSERT INTO generate_agency_letter_slave2
           (GEN_AGENCY_ID, GRADE, SUPPLIER, PHYSICAL, QUANTITY, BUNKERPORT)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [savedId, bunker.grade, bunker.supplier, bunker.physical, bunker.quantity, bunker.bunkerPort || ''],
      );
    }

    await connection.commit();
    return { msg: 0, genAgencyId: savedId, submitId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbDeleteAgencyLetter(genAgencyId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let lpCostId = null;
    try {
      const [[row]] = await connection.query(
        'SELECT LP_COST_ID FROM loadport_cost_master WHERE GEN_AGENCY_ID = ? LIMIT 1',
        [genAgencyId],
      );
      lpCostId = row?.LP_COST_ID || null;
    } catch {
      lpCostId = null;
    }

    await connection.query('DELETE FROM generate_agency_letter_slave1 WHERE GEN_AGENCY_ID = ?', [genAgencyId]);
    await connection.query('DELETE FROM generate_agency_letter_slave2 WHERE GEN_AGENCY_ID = ?', [genAgencyId]);
    const [result] = await connection.query(
      'DELETE FROM generate_agency_letter WHERE GEN_AGENCY_ID = ?',
      [genAgencyId],
    );
    if (lpCostId) {
      await connection.query('DELETE FROM loadport_cost_slave WHERE LP_COST_ID = ?', [lpCostId]).catch(() => {});
      await connection.query('DELETE FROM loadport_cost_master WHERE LP_COST_ID = ?', [lpCostId]).catch(() => {});
    }
    if (!result.affectedRows) {
      const error = new Error('Agency letter not found.');
      error.status = 404;
      throw error;
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

/**
 * PHP getPortNameBasedOnCode: PortCode → "PortName(Country)".
 * React UI may store PortId — accept either.
 */
async function resolveBunkerPortLabel(pool, bunkerPort) {
  if (bunkerPort == null || bunkerPort === '') return '';
  const key = String(bunkerPort);
  const sql = `
    SELECT pm.PortName AS portName, cm.COUNTRY_NAME AS countryName
    FROM port_master pm
    LEFT JOIN country_master cm ON cm.COUNTRYID = pm.COUNTRY_NAME
    WHERE pm.PortCode = ? OR pm.PortId = ?
    LIMIT 1`;
  const [[row]] = await pool.query(sql, [key, key]).catch(() => [[null]]);
  if (!row?.portName) return key;
  return row.countryName ? `${row.portName}(${row.countryName})` : row.portName;
}

/**
 * Data for port-related letter PDFs (legacy allPdf.php id 2 / 51 / 63 / 65).
 */
export async function dbGetAgencyLetterForPdf(genAgencyId, opts = {}) {
  const pool = getPool();
  const id = Number(genAgencyId);
  if (!Number.isFinite(id) || id <= 0) {
    const error = new Error('Agency letter id is required.');
    error.status = 400;
    throw error;
  }

  const [[letter]] = await pool.query(
    `SELECT * FROM generate_agency_letter WHERE GEN_AGENCY_ID = ? LIMIT 1`,
    [id],
  );
  if (!letter) {
    const error = new Error('Agency letter not found.');
    error.status = 404;
    throw error;
  }

  const agentCode = opts.agentCode || letter.VENDORID;
  const [[agent]] = await pool.query(
    `SELECT NAME, STREET_1, STREET_2, PHONE, EMAILID FROM vendor_master
     WHERE CODE = ? AND MCOMPANYID = ? LIMIT 1`,
    [agentCode, letter.MCOMPANYID || COMPANY_ID],
  ).catch(() => [[null]]);

  const [[port]] = await pool.query(
    `SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1`,
    [letter.PORTID],
  ).catch(() => [[null]]);

  const [[company]] = await pool.query(
    `SELECT COMPANY_NAME, ADDRESS, PHONE_NO, EMAIL_ID, WEBSITE
     FROM company_master WHERE COMPANYID = ? LIMIT 1`,
    [letter.MCOMPANYID || COMPANY_ID],
  ).catch(async () => {
    const [[fallback]] = await pool.query(
      `SELECT COMPANY_NAME, ADDRESS, PHONE_NO, EMAIL_ID
       FROM company_master WHERE COMPANYID = ? LIMIT 1`,
      [letter.MCOMPANYID || COMPANY_ID],
    ).catch(() => [[null]]);
    return [[fallback]];
  });

  const [[user]] = await pool.query(
    `SELECT CONTACT_PERSON, ADDRESS, PHONE_NO, EMAILID, MCOMPANYID
     FROM user_master WHERE USERID = ? LIMIT 1`,
    [letter.LOGINID],
  ).catch(() => [[null]]);

  let shipOwner = null;
  if (letter.SHIP_OWNER) {
    const [[row]] = await pool.query(
      `SELECT NAME, STREET_1, STREET_2, PHONE, EMAILID FROM vendor_master
       WHERE CODE = ? AND MCOMPANYID = ? LIMIT 1`,
      [letter.SHIP_OWNER, letter.MCOMPANYID || COMPANY_ID],
    ).catch(() => [[null]]);
    shipOwner = row || null;
  }

  const [entities] = await pool.query(
    `SELECT ENTITY, ENTITY_NAME, EMAILID
     FROM generate_agency_letter_slave1
     WHERE GEN_AGENCY_ID = ?
     ORDER BY SLAVEID ASC`,
    [id],
  ).catch(() => [[]]);

  const [bunkers] = await pool.query(
    `SELECT GRADE, SUPPLIER, PHYSICAL, QUANTITY, BUNKERPORT
     FROM generate_agency_letter_slave2
     WHERE GEN_AGENCY_ID = ?
     ORDER BY SLAVEID ASC`,
    [id],
  ).catch(() => [[]]);

  const bunkerRows = await Promise.all((bunkers || []).map(async (row) => ({
    grade: row.GRADE ?? '',
    supplier: row.SUPPLIER ?? '',
    physical: row.PHYSICAL ?? '',
    quantity: row.QUANTITY ?? '',
    bunkerPort: await resolveBunkerPortLabel(pool, row.BUNKERPORT),
  })));

  const bunkeringPort = bunkerRows.find((row) => row.bunkerPort)?.bunkerPort
    || (port?.PortName || '')
    || '';

  const [[compare]] = await pool.query(
    `SELECT MESSAGE, VESSEL_IMO_ID, CARGO_ID, MATERIALID, QTY_VENDORID
     FROM freight_cost_estimate_compare
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [letter.COMID, letter.MODULEID || MODULE_ID, letter.MCOMPANYID || COMPANY_ID],
  ).catch(() => [[null]]);

  let vesselImoId = compare?.VESSEL_IMO_ID;
  let cargoIdFallback = compare?.CARGO_ID || '';
  if (!vesselImoId) {
    const costSheetId = await getLatestCostSheetId(pool, letter.COMID).catch(() => null);
    if (costSheetId) {
      const [[sheet]] = await pool.query(
        `SELECT VESSEL_IMO_ID, CARGO_ID FROM freight_cost_estimete_master WHERE FCAID = ? LIMIT 1`,
        [costSheetId],
      ).catch(() => [[null]]);
      vesselImoId = sheet?.VESSEL_IMO_ID || vesselImoId;
      if (!cargoIdFallback && sheet?.CARGO_ID) cargoIdFallback = sheet.CARGO_ID;
    }
  }

  let vesselName = '';
  let vessel = {
    flag: '',
    classSoc: '',
    yearBuilt: '',
    builtWhere: '',
    imoNo: '',
    portOfRegistry: '',
    dwt: '',
    displacement: '',
    draft: '',
    tpc: '',
    cargoTankCapacity: '',
    cargoPumps: '',
    noOfGrades: '',
    grain: '',
    noh: '',
    noha: '',
    grt: '',
    nrt: '',
    panamaGt: '',
    suezGt: '',
    loa: '',
    lbp: '',
    breadth: '',
    depth: '',
    callSign: '',
    email: '',
    phone: '',
    telex: '',
    fax: '',
    businessTypeId: '',
  };
  if (vesselImoId) {
    const [[vim]] = await pool.query(
      `SELECT * FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? LIMIT 1`,
      [vesselImoId],
    ).catch(() => [[null]]);
    vesselName = vim?.VESSEL_NAME || '';
    const businessTypeId = vim?.BUSINESSTYPEID != null ? String(vim.BUSINESSTYPEID) : '';
    const [[flagRow]] = await pool.query(
      'SELECT COUNTRY_NAME FROM country_master WHERE COUNTRYID = ? LIMIT 1',
      [vim?.FLAG],
    ).catch(() => [[null]]);
    let classSoc = '';
    if (vim?.CLA_SOC_ID) {
      const [[cls]] = await pool.query(
        'SELECT NAME FROM classification_soc_master WHERE CLA_SOC_ID = ? LIMIT 1',
        [vim.CLA_SOC_ID],
      ).catch(() => [[null]]);
      classSoc = cls?.NAME || '';
    }
    const [[vm1]] = await pool.query(
      'SELECT * FROM vessel_master_1 WHERE VESSEL_IMO_ID = ? LIMIT 1',
      [vesselImoId],
    ).catch(() => [[null]]);
    const [[vmt]] = await pool.query(
      'SELECT * FROM vessel_master_tankers WHERE VESSEL_IMO_ID = ? LIMIT 1',
      [vesselImoId],
    ).catch(() => [[null]]);
    const [[vm6]] = await pool.query(
      'SELECT * FROM vessel_master_6 WHERE VESSEL_IMO_ID = ? LIMIT 1',
      [vesselImoId],
    ).catch(() => [[null]]);

    let portOfRegistry = '';
    const registryPortId = businessTypeId === '1' || businessTypeId === '2'
      ? (vmt?.REGISTRY_PORT || vm1?.PORT_ID)
      : (vm1?.PORT_ID || vmt?.REGISTRY_PORT);
    if (registryPortId) {
      const [[rp]] = await pool.query(
        'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
        [registryPortId],
      ).catch(() => [[null]]);
      portOfRegistry = rp?.PortName || '';
    }

    let builtCountry = '';
    if (vm1?.COUNTRY_ID) {
      const [[bc]] = await pool.query(
        'SELECT COUNTRY_NAME FROM country_master WHERE COUNTRYID = ? LIMIT 1',
        [vm1.COUNTRY_ID],
      ).catch(() => [[null]]);
      builtCountry = bc?.COUNTRY_NAME || '';
    }

    const isTankerOrGas = businessTypeId === '1' || businessTypeId === '2';
    const callSign = isTankerOrGas ? (vmt?.CALL_SIGN || '') : (vm6?.CALL_SIGN || vm1?.CALL_SIGN || '');
    const email = isTankerOrGas
      ? (vmt?.EMAIL_ADDRESS || '')
      : (vm6?.EMAIL_ADDRESS || vm1?.EMAIL_ADDRESS || '');
    const phone = isTankerOrGas ? (vmt?.PHONE_NO || '') : (vm6?.PHONE_NO || vm1?.PHONE_NO || '');
    const telex = isTankerOrGas
      ? (vmt?.TELEX_NO || '')
      : (vm6?.TELEX_NUMBER || vm1?.TELEX_NUMBER || '');
    const fax = isTankerOrGas ? (vmt?.FAXNO || '') : (vm6?.FAX_NUMBER || vm1?.FAX_NUMBER || '');
    const mmsi = isTankerOrGas ? (vmt?.MMSI_NUMBER || '') : (vm6?.MMSI_NUMBER || '');
    const inmarsat = isTankerOrGas ? (vmt?.INMARSAT_NUMBER || '') : (vm6?.INMARSAT_NUMBER || '');

    vessel = {
      flag: flagRow?.COUNTRY_NAME || '',
      classSoc,
      yearBuilt: vim?.YEARBUILT ?? '',
      // PHP: YEARBUILT/COUNTRY/YARD (always three slash-separated parts)
      builtWhere: [
        String(builtCountry || '').toUpperCase(),
        String(vm1?.YARD_NAME || '').toUpperCase(),
      ].join('/'),
      imoNo: vim?.IMO_NO ?? '',
      portOfRegistry,
      dwt: vim?.DWT ?? '',
      displacement: vm1?.DISPLACEMENT ?? '',
      draft: vim?.DRAFTM ?? '',
      tpc: vm1?.SUMMER_3 ?? '',
      cargoTankCapacity: businessTypeId === '1'
        ? (vim?.GAS_TANK_CAPACITY ?? '')
        : (vim?.TANKER_CAPACITY ?? ''),
      cargoPumps: vim?.TANKER_CARGO_PUMP ?? '',
      noOfGrades: vim?.NO_OF_GRADE ?? '',
      grain: vim?.GRAIN ?? '',
      noh: vim?.NOH ?? '',
      noha: vim?.NOHA ?? '',
      grt: vim?.GRT_NRT ?? '',
      nrt: vim?.NRT ?? '',
      panamaGt: vm1?.GT_PANAMA ?? '',
      suezGt: vm1?.GT_SUEZ ?? '',
      loa: vim?.LOA ?? '',
      lbp: vm1?.LBW ?? '',
      breadth: vim?.EXT_BREADTH ?? '',
      depth: vm1?.DEPTH_MODULE ?? '',
      callSign,
      email,
      phone,
      telex,
      fax,
      mmsi,
      inmarsat,
      businessTypeId,
    };
  }

  let cargoName = '';
  const cargoIds = String(cargoIdFallback || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (cargoIds.length) {
    const placeholders = cargoIds.map(() => '?').join(',');
    const [materials] = await pool.query(
      `SELECT MATERIAL_TYPE FROM cargo_master WHERE MATERIALID IN (${placeholders})`,
      cargoIds,
    ).catch(() => [[]]);
    cargoName = (materials || []).map((row) => row.MATERIAL_TYPE).filter(Boolean).join(', ');
  }

  const agentAddressLines = String(agent?.STREET_1 || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    genAgencyId: id,
    comId: letter.COMID,
    portType: opts.portType || letter.PORT || '',
    portId: letter.PORTID,
    portName: port?.PortName || opts.portName || '',
    bunkeringPort,
    agentCode,
    agentName: agent?.NAME || '',
    agentEmail: agent?.EMAILID || '',
    agentAddressLines,
    agentStreet2: agent?.STREET_2 || '',
    username: letter.USERNAME ?? '',
    password: letter.PASSWORD ?? '',
    qty: letter.QTY ?? '',
    cargoName,
    cargoDetails: letter.CARGO_PACKING_DESC ?? '',
    tolerance: letter.TOLERANCE_PERCENT_SUB ?? '',
    masterName: letter.TERMO_OF_TOLERANCE ?? '',
    etaDate1: blankDate(letter.ETA_DATE1, true),
    etaDate: blankDate(letter.ETA_DATE, true) || '00:00',
    date: blankDate(letter.DATE),
    vesselName,
    vessel,
    nomId: compare?.MESSAGE || '',
    companyName: company?.COMPANY_NAME || '',
    companyAddress: company?.ADDRESS || '',
    companyPhone: company?.PHONE_NO || '',
    companyEmail: company?.EMAIL_ID || '',
    companyWebsite: company?.WEBSITE || process.env.COMPANY_WEBSITE || 'www.zafirast.com',
    agentLoginUrl: process.env.AGENT_LOGIN_URL
      || 'https://zafira.sevenoceans.net.in/login',
    contactPerson: user?.CONTACT_PERSON || '',
    contactAddress: user?.ADDRESS || '',
    contactPhone: user?.PHONE_NO || '',
    contactEmail: user?.EMAILID || '',
    shipOwnerName: shipOwner?.NAME || '',
    shipOwnerAddress: shipOwner?.STREET_1 || '',
    shipOwnerPerson: shipOwner?.STREET_2 || '',
    shipOwnerPhone: shipOwner?.PHONE || '',
    shipOwnerEmail: shipOwner?.EMAILID || '',
    bunkerSurveyor: letter.BUNKER_SURVEYOR ?? '',
    bunkerSurveyorCom: letter.BUNKER_SURVEYORCOM ?? '',
    entities: (entities || []).map((row) => ({
      entity: row.ENTITY != null ? String(row.ENTITY) : '',
      name: row.ENTITY_NAME ?? '',
      email: row.EMAILID ?? '',
    })),
    bunkers: bunkerRows,
  };
}

import { getPool } from '../db.js';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function shortPortName(name) {
  const text = String(name || '').trim();
  if (!text) return '';
  const first = text.split('/')[0].trim();
  return first || text;
}

function mapInitialStatus(status) {
  const s = num(status, -1);
  if (s < 0) return 'notstarted';
  if (s <= 1) return 'draft';
  if (s === 2) return 'submitted';
  return 'approved';
}

function mapFdaStatus(status) {
  const s = num(status, -1);
  if (s < 2) return 'notstarted';
  if (s === 2) return 'draft';
  if (s === 3) return 'submitted';
  return 'approved';
}

function mapSofStatus(submitId) {
  if (submitId == null || submitId === '') return 'notstarted';
  const s = num(submitId, -1);
  if (s < 0) return 'notstarted';
  if (s <= 1) return 'draft';
  if (s === 2) return 'submitted';
  return 'approved';
}

async function loadAgentSof(pool, letter) {
  const port = String(letter.PORT || '');
  const [[row]] = await pool.query(
    `SELECT SOFID, SUBMITID
     FROM sof_master
     WHERE COMID = ?
       AND LOGIN = 'AGENT'
       AND PORT = ?
       AND PORTID = ?
       AND RANDOMID = ?
     ORDER BY SOFID DESC
     LIMIT 1`,
    [letter.COMID, port, letter.PORTID, letter.RANDOMID],
  ).catch(() => [[null]]);
  return row || null;
}

async function resolveCountryId(pool, letter) {
  if (letter.COUNTRY_ID) return String(letter.COUNTRY_ID);

  const [[port]] = await pool.query(
    `SELECT COUNTRY_KEY, COUNTRY_NAME FROM port_master WHERE PortId = ? LIMIT 1`,
    [letter.PORTID],
  ).catch(() => [[null]]);

  // Legacy: port_master.COUNTRY_NAME often stores numeric COUNTRYID.
  const storedId = String(port?.COUNTRY_NAME || '').trim();
  if (storedId && /^\d+$/.test(storedId)) return storedId;

  const key = String(port?.COUNTRY_KEY || '').trim();
  if (key && /^\d+$/.test(key)) return key;

  if (key) {
    // Try common ISO / code columns; ignore missing-column errors.
    const attempts = [
      ['SELECT COUNTRYID FROM country_master WHERE COUNTRY_CODE = ? LIMIT 1', [key]],
      ['SELECT COUNTRYID FROM country_master WHERE COUNTRY_KEY = ? LIMIT 1', [key]],
      ['SELECT COUNTRYID FROM country_master WHERE ISO_CODE = ? LIMIT 1', [key]],
      ['SELECT COUNTRYID FROM country_master WHERE COUNTRY_NAME = ? LIMIT 1', [key]],
      ['SELECT COUNTRYID FROM country_master WHERE COUNTRY_NAME LIKE ? LIMIT 1', [`%${key}%`]],
    ];
    for (const [sql, params] of attempts) {
      const [[row]] = await pool.query(sql, params).catch(() => [[null]]);
      if (row?.COUNTRYID) return String(row.COUNTRYID);
    }
  }

  return '';
}

async function loadCostTypesForCountry(pool, countryId) {
  const [rows] = await pool.query(
    `SELECT PC_TYPE_ID, NAME, COUNTRY_IDS
     FROM port_cost_type_master
     WHERE STATUS = 1
     ORDER BY NAME`,
  );

  if (!countryId) {
    // Prefer broadly applicable types when country is unknown.
    const broad = rows.filter((row) => {
      const ids = String(row.COUNTRY_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
      return ids.length >= 50;
    });
    return (broad.length ? broad : rows.slice(0, 40)).map((row) => ({
      pcTypeId: row.PC_TYPE_ID,
      name: row.NAME || '',
    }));
  }

  const matched = rows.filter((row) => {
    const ids = String(row.COUNTRY_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) return true;
    return ids.includes(String(countryId));
  });

  return matched.map((row) => ({
    pcTypeId: row.PC_TYPE_ID,
    name: row.NAME || '',
  }));
}

async function loadLetterContext(pool, genAgencyId) {
  const id = Number(genAgencyId);
  if (!Number.isFinite(id) || id <= 0) {
    const error = new Error('Agent session is missing an agency letter.');
    error.status = 400;
    throw error;
  }

  const [[letter]] = await pool.query(
    `SELECT * FROM generate_agency_letter WHERE GEN_AGENCY_ID = ? LIMIT 1`,
    [id],
  );
  if (!letter) {
    const error = new Error('Agency letter not found for this agent session.');
    error.status = 404;
    throw error;
  }

  const [[compare]] = await pool.query(
    `SELECT c.FCAID, m.VOYAGE_NO, m.VESSEL_IMO_ID, v.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     LEFT JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.COMID = ?
     ORDER BY c.FCAID DESC
     LIMIT 1`,
    [letter.COMID],
  ).catch(() => [[null]]);

  let voyage = compare || null;
  if (!String(voyage?.VOYAGE_NO || '').trim()) {
    const [[latest]] = await pool.query(
      `SELECT f.VOYAGE_NO, f.FCAID, f.VESSEL_IMO_ID, v.VESSEL_NAME
       FROM freight_cost_estimete_master f
       LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = f.VESSEL_IMO_ID
       WHERE f.COMID = ?
       ORDER BY f.FCAID DESC
       LIMIT 1`,
      [letter.COMID],
    ).catch(() => [[null]]);
    if (latest) {
      voyage = {
        ...(voyage || {}),
        ...latest,
        VOYAGE_NO: latest.VOYAGE_NO || voyage?.VOYAGE_NO,
        VESSEL_NAME: voyage?.VESSEL_NAME || latest.VESSEL_NAME,
        FCAID: voyage?.FCAID || latest.FCAID,
      };
    }
  }

  const [[port]] = await pool.query(
    `SELECT PortName, COUNTRY_KEY, COUNTRY_NAME FROM port_master WHERE PortId = ? LIMIT 1`,
    [letter.PORTID],
  ).catch(() => [[null]]);

  const [[vendor]] = await pool.query(
    `SELECT NAME, STREET_2 FROM vendor_master
     WHERE CODE = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [letter.VENDORID, letter.MCOMPANYID],
  ).catch(() => [[null]]);

  const [[cost]] = await pool.query(
    `SELECT * FROM loadport_cost_master WHERE GEN_AGENCY_ID = ? LIMIT 1`,
    [id],
  ).catch(() => [[null]]);

  return { letter, voyage, port, vendor, cost };
}

/**
 * Dashboard rows for the logged-in agent letter (legacy PHP index.php — one voyage).
 */
export async function dbGetAgentDashboard(agentUser) {
  const pool = getPool();
  const genAgencyId = agentUser?.genAgencyId ?? agentUser?.id;
  const { letter, voyage, port, vendor, cost } = await loadLetterContext(pool, genAgencyId);
  const sof = await loadAgentSof(pool, letter);

  const status = cost ? num(cost.STATUS, 0) : -1;
  const portLabel = shortPortName(port?.PortName) || `Port ${letter.PORTID || ''}`;

  return {
    agent: {
      genAgencyId: letter.GEN_AGENCY_ID,
      username: letter.USERNAME || agentUser?.username || '',
      organisation: vendor?.NAME || agentUser?.organisation || 'Agent Company',
      contactPerson: vendor?.STREET_2 || agentUser?.name || '',
      vendorId: letter.VENDORID || '',
    },
    voyages: [
      {
        id: voyage?.VOYAGE_NO || `COM-${letter.COMID}`,
        genAgencyId: letter.GEN_AGENCY_ID,
        comId: letter.COMID,
        vessel: voyage?.VESSEL_NAME || '—',
        ports: [portLabel],
        portType: letter.PORT || '',
        portId: letter.PORTID != null ? String(letter.PORTID) : '',
        randomId: letter.RANDOMID != null ? String(letter.RANDOMID) : '',
        initial: mapInitialStatus(status),
        fda: mapFdaStatus(status),
        sof: mapSofStatus(sof?.SUBMITID),
        sofId: sof?.SOFID ?? null,
        contact: vendor?.STREET_2 || vendor?.NAME || '',
        lpCostId: cost?.LP_COST_ID ?? null,
        costStatus: cost ? num(cost.STATUS, 0) : null,
        year: cost?.DATE
          ? new Date(cost.DATE).getFullYear()
          : letter.DATE
            ? new Date(letter.DATE).getFullYear()
            : new Date().getFullYear(),
      },
    ],
  };
}

/**
 * Initial PDA / FDA port-cost sheet for the agent letter.
 * mode: 'pda' | 'fda'
 */
export async function dbGetAgentPortCost(agentUser, mode = 'pda') {
  const pool = getPool();
  const isFda = String(mode).toLowerCase() === 'fda';
  const genAgencyId = agentUser?.genAgencyId ?? agentUser?.id;
  const { letter, voyage, port, vendor, cost } = await loadLetterContext(pool, genAgencyId);

  const status = cost ? num(cost.STATUS, 0) : -1;
  if (isFda && status < 2) {
    const error = new Error('FDA is available only after Initial PDA is submitted.');
    error.status = 403;
    throw error;
  }

  const countryId = await resolveCountryId(pool, letter);
  let costTypes = await loadCostTypesForCountry(pool, countryId);

  let lines = [];
  if (cost?.LP_COST_ID) {
    const [slaveRows] = await pool.query(
      `SELECT s.*, t.NAME AS TYPE_NAME
       FROM loadport_cost_slave s
       LEFT JOIN port_cost_type_master t ON t.PC_TYPE_ID = s.PC_TYPE_ID
       WHERE s.LP_COST_ID = ?
       ORDER BY s.LP_COST_SLAVEID`,
      [cost.LP_COST_ID],
    );
    lines = slaveRows.map((row) => ({
      slaveId: row.LP_COST_SLAVEID,
      pcTypeId: row.PC_TYPE_ID,
      name: row.TYPE_NAME || row.PORT_COST_DESC || `Cost #${row.PC_TYPE_ID}`,
      description: row.PORT_COST_DESC || '',
      estimatedLc: money(row.ESTMD_COST_LC),
      estimatedUsd: money(row.ESTMD_COST_USD),
      actualLc: money(row.ACTUAL_COST_LC),
      actualUsd: money(row.ACTUAL_COST_USD),
      remarksAgent: row.REMARKS_AGENTS || '',
      remarksOperator: row.REMARKS_OPERATOR || '',
    }));

    // Ensure saved types remain visible even if country filter misses them.
    const known = new Set(costTypes.map((t) => Number(t.pcTypeId)));
    for (const line of lines) {
      if (!known.has(Number(line.pcTypeId))) {
        costTypes.push({ pcTypeId: line.pcTypeId, name: line.name });
        known.add(Number(line.pcTypeId));
      }
    }
  }

  // Merge template types with saved values.
  const byType = new Map(lines.map((line) => [Number(line.pcTypeId), line]));
  const mergedLines = costTypes.map((type) => {
    const existing = byType.get(Number(type.pcTypeId));
    if (existing) return { ...existing, name: type.name || existing.name };
    return {
      slaveId: null,
      pcTypeId: type.pcTypeId,
      name: type.name,
      description: '',
      estimatedLc: 0,
      estimatedUsd: 0,
      actualLc: 0,
      actualUsd: 0,
      remarksAgent: '',
      remarksOperator: '',
    };
  });

  const portLabel = shortPortName(port?.PortName) || `Port ${letter.PORTID || ''}`;
  const lockedInitial = status >= 2;
  const lockedFda = status >= 3;
  const readOnly = isFda ? lockedFda : lockedInitial;

  return {
    mode: isFda ? 'fda' : 'pda',
    genAgencyId: letter.GEN_AGENCY_ID,
    lpCostId: cost?.LP_COST_ID ?? null,
    status: status < 0 ? null : status,
    initialStatus: mapInitialStatus(status),
    fdaStatus: mapFdaStatus(status),
    readOnly,
    canSubmit: !readOnly,
    voyage: {
      id: voyage?.VOYAGE_NO || `COM-${letter.COMID}`,
      vessel: voyage?.VESSEL_NAME || '—',
      comId: letter.COMID,
      port: portLabel,
      portType: letter.PORT || '',
      portId: letter.PORTID != null ? String(letter.PORTID) : '',
    },
    agent: {
      organisation: vendor?.NAME || agentUser?.organisation || '',
      contactPerson: vendor?.STREET_2 || agentUser?.name || '',
      vendorId: letter.VENDORID || '',
    },
    header: {
      date: cost?.DATE
        ? String(cost.DATE).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      rdoExchange: cost ? num(cost.RDO_EXCHANGE, 0) : 0,
      exchangeRate: cost ? num(cost.EXCHANGE_RATE, 1) : 1,
      finalExchangeRate: cost ? num(cost.FINAL_EXCHANGE_RATE, 0) : 0,
      localCurrency: cost?.LOCAL_CURRENCY || 'USD',
      bankDetails: cost?.BANK_DETAILS || '',
      preparedBy: cost?.PREPARED_BY || '',
      authorizedBy: cost?.AUTHORIZED_BY || '',
      agentRemarks: cost?.AGENT_REMARKS || '',
      operatorRemarks: cost?.OPERATOR_REMARKS || '',
      totalEstimatedLc: money(cost?.TTL_ESTMD_COST_LC),
      totalEstimatedUsd: money(cost?.TTL_ESTMD_COST_USD),
      totalActualLc: money(cost?.TTL_ACTUAL_COST_LC),
      totalActualUsd: money(cost?.TTL_ACTUAL_COST_USD),
      advanceRequested1: num(cost?.ADV_REQUESTED_1, 0),
      advanceRequested2: num(cost?.ADV_REQUESTED_2, 0),
    },
    lines: mergedLines,
    countryId,
  };
}

function computeTotals(lines, exchangeRate, isFda) {
  const rate = exchangeRate > 0 ? exchangeRate : 1;
  let totalEstimatedLc = 0;
  let totalEstimatedUsd = 0;
  let totalActualLc = 0;
  let totalActualUsd = 0;

  const normalized = lines.map((line) => {
    const estimatedLc = money(line.estimatedLc);
    const estimatedUsd = money(line.estimatedUsd ?? estimatedLc / rate);
    const actualLc = money(line.actualLc);
    const actualUsd = money(line.actualUsd ?? (isFda ? actualLc / rate : 0));
    totalEstimatedLc += estimatedLc;
    totalEstimatedUsd += estimatedUsd;
    totalActualLc += actualLc;
    totalActualUsd += actualUsd;
    return {
      pcTypeId: Number(line.pcTypeId),
      description: String(line.description || '').slice(0, 2000),
      estimatedLc,
      estimatedUsd,
      actualLc,
      actualUsd,
      remarksAgent: String(line.remarksAgent || '').slice(0, 4000),
    };
  });

  return {
    lines: normalized,
    totalEstimatedLc: money(totalEstimatedLc),
    totalEstimatedUsd: money(totalEstimatedUsd),
    totalActualLc: money(totalActualLc),
    totalActualUsd: money(totalActualUsd),
  };
}

/**
 * Save Initial PDA (draft/submit) or FDA (draft/submit).
 * action: 'draft' | 'submit'
 */
export async function dbSaveAgentPortCost(agentUser, payload = {}) {
  const pool = getPool();
  const mode = String(payload.mode || 'pda').toLowerCase() === 'fda' ? 'fda' : 'pda';
  const isFda = mode === 'fda';
  const action = String(payload.action || 'draft').toLowerCase() === 'submit' ? 'submit' : 'draft';
  const genAgencyId = agentUser?.genAgencyId ?? agentUser?.id;
  const { letter, cost } = await loadLetterContext(pool, genAgencyId);

  const currentStatus = cost ? num(cost.STATUS, 0) : -1;
  if (isFda && currentStatus < 2) {
    const error = new Error('FDA is available only after Initial PDA is submitted.');
    error.status = 403;
    throw error;
  }
  if (!isFda && currentStatus >= 2 && action === 'draft') {
    // Allow edits only before submit; after submit Initial PDA is locked.
    const error = new Error('Initial PDA is already submitted and cannot be edited.');
    error.status = 403;
    throw error;
  }
  if (!isFda && currentStatus >= 2 && action === 'submit') {
    const error = new Error('Initial PDA is already submitted.');
    error.status = 403;
    throw error;
  }
  if (isFda && currentStatus >= 3) {
    const error = new Error('FDA is already submitted and cannot be edited.');
    error.status = 403;
    throw error;
  }

  const header = payload.header || {};
  const exchangeRate = num(header.exchangeRate, cost ? num(cost.EXCHANGE_RATE, 1) : 1) || 1;
  const incomingLines = Array.isArray(payload.lines) ? payload.lines : [];
  const totals = computeTotals(incomingLines, exchangeRate, isFda);

  let nextStatus;
  if (!isFda) {
    nextStatus = action === 'submit' ? 2 : 1;
  } else if (action === 'submit') {
    nextStatus = 3;
  } else {
    nextStatus = Math.max(currentStatus, 2);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let lpCostId = cost?.LP_COST_ID || null;
    const dateValue = header.date || new Date().toISOString().slice(0, 10);
    const masterFields = {
      DATE: dateValue,
      EXCHANGE_RATE: exchangeRate,
      FINAL_EXCHANGE_RATE: num(header.finalExchangeRate, exchangeRate),
      TTL_ESTMD_COST_LC: totals.totalEstimatedLc,
      TTL_ESTMD_COST_USD: totals.totalEstimatedUsd,
      TTL_ACTUAL_COST_LC: totals.totalActualLc,
      TTL_ACTUAL_COST_USD: totals.totalActualUsd,
      ADV_REQUESTED_1: num(header.advanceRequested1, 0),
      ADV_REQUESTED_2: num(header.advanceRequested2, 0),
      BANK_DETAILS: String(header.bankDetails || ''),
      PREPARED_BY: String(header.preparedBy || ''),
      AUTHORIZED_BY: String(header.authorizedBy || ''),
      RDO_EXCHANGE: num(header.rdoExchange, 0) ? 1 : 0,
      AGENT_REMARKS: String(header.agentRemarks || ''),
      LOCAL_CURRENCY: String(header.localCurrency || 'USD').slice(0, 45),
      STATUS: nextStatus,
      SUBMITID: action === 'submit' ? 1 : num(cost?.SUBMITID, 0),
    };

    if (lpCostId) {
      await connection.query(
        `UPDATE loadport_cost_master SET
           DATE = ?, EXCHANGE_RATE = ?, FINAL_EXCHANGE_RATE = ?,
           TTL_ESTMD_COST_LC = ?, TTL_ESTMD_COST_USD = ?,
           TTL_ACTUAL_COST_LC = ?, TTL_ACTUAL_COST_USD = ?,
           ADV_REQUESTED_1 = ?, ADV_REQUESTED_2 = ?,
           BANK_DETAILS = ?, PREPARED_BY = ?, AUTHORIZED_BY = ?,
           RDO_EXCHANGE = ?, AGENT_REMARKS = ?, LOCAL_CURRENCY = ?,
           STATUS = ?, SUBMITID = ?
         WHERE LP_COST_ID = ? AND GEN_AGENCY_ID = ?`,
        [
          masterFields.DATE,
          masterFields.EXCHANGE_RATE,
          masterFields.FINAL_EXCHANGE_RATE,
          masterFields.TTL_ESTMD_COST_LC,
          masterFields.TTL_ESTMD_COST_USD,
          masterFields.TTL_ACTUAL_COST_LC,
          masterFields.TTL_ACTUAL_COST_USD,
          masterFields.ADV_REQUESTED_1,
          masterFields.ADV_REQUESTED_2,
          masterFields.BANK_DETAILS,
          masterFields.PREPARED_BY,
          masterFields.AUTHORIZED_BY,
          masterFields.RDO_EXCHANGE,
          masterFields.AGENT_REMARKS,
          masterFields.LOCAL_CURRENCY,
          masterFields.STATUS,
          masterFields.SUBMITID,
          lpCostId,
          letter.GEN_AGENCY_ID,
        ],
      );
      await connection.query('DELETE FROM loadport_cost_slave WHERE LP_COST_ID = ?', [lpCostId]);
    } else {
      const [insertResult] = await connection.query(
        `INSERT INTO loadport_cost_master (
           GEN_AGENCY_ID, DATE, EXCHANGE_RATE, FINAL_EXCHANGE_RATE,
           TTL_ESTMD_COST_LC, TTL_ESTMD_COST_USD, TTL_ACTUAL_COST_LC, TTL_ACTUAL_COST_USD,
           ADV_REQUESTED_1, ADV_REQUESTED_2, BANK_DETAILS, PREPARED_BY, AUTHORIZED_BY,
           STATUS, SUBMITID, RDO_EXCHANGE, AGENT_REMARKS, COMID, PORTID, PORT, RANDOMID,
           MODULEID, MCOMPANYID, LOCAL_CURRENCY
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          letter.GEN_AGENCY_ID,
          masterFields.DATE,
          masterFields.EXCHANGE_RATE,
          masterFields.FINAL_EXCHANGE_RATE,
          masterFields.TTL_ESTMD_COST_LC,
          masterFields.TTL_ESTMD_COST_USD,
          masterFields.TTL_ACTUAL_COST_LC,
          masterFields.TTL_ACTUAL_COST_USD,
          masterFields.ADV_REQUESTED_1,
          masterFields.ADV_REQUESTED_2,
          masterFields.BANK_DETAILS,
          masterFields.PREPARED_BY,
          masterFields.AUTHORIZED_BY,
          masterFields.STATUS,
          masterFields.SUBMITID,
          masterFields.RDO_EXCHANGE,
          masterFields.AGENT_REMARKS,
          letter.COMID,
          letter.PORTID,
          letter.PORT,
          letter.RANDOMID,
          letter.MODULEID,
          letter.MCOMPANYID,
          masterFields.LOCAL_CURRENCY,
        ],
      );
      lpCostId = insertResult.insertId;
    }

    for (const line of totals.lines) {
      if (!line.pcTypeId) continue;
      const hasValue = line.estimatedLc || line.estimatedUsd || line.actualLc || line.actualUsd || line.remarksAgent;
      if (!hasValue && !isFda) continue;
      if (!hasValue && isFda) continue;

      await connection.query(
        `INSERT INTO loadport_cost_slave (
           LP_COST_ID, PC_TYPE_ID, ESTMD_COST_LC, ESTMD_COST_USD,
           ACTUAL_COST_LC, ACTUAL_COST_USD, REMARKS_AGENTS, PORT_COST_DESC
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lpCostId,
          line.pcTypeId,
          line.estimatedLc,
          line.estimatedUsd,
          line.actualLc,
          line.actualUsd,
          line.remarksAgent,
          line.description,
        ],
      );
    }

    await connection.commit();
    return {
      ok: true,
      mode,
      action,
      lpCostId,
      status: nextStatus,
      initialStatus: mapInitialStatus(nextStatus),
      fdaStatus: mapFdaStatus(nextStatus),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

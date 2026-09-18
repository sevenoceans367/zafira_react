import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { dbGetAgencyLetterForm } from './agencyLetterDb.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

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
  return text.split('/')[0].trim() || text;
}

function formatDisplayDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    const text = String(value).trim();
    return text.length >= 10 ? text.slice(0, 10) : text;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function mapPdaStatus(status, officeApproved) {
  const s = num(status, -1);
  if (s < 0) return 'notstarted';
  if (s <= 1) return 'draft';
  if (officeApproved || s > 2) return 'approved';
  return 'submitted';
}

function mapFdaStatus(status) {
  const s = num(status, -1);
  if (s < 2) return 'notstarted';
  if (s === 2) return 'draft';
  if (s === 3) return 'submitted';
  return 'approved';
}

function tabDot(pdaStatus, fdaStatus, nominated) {
  if (!nominated) return 'none';
  if (pdaStatus === 'approved' && (fdaStatus === 'approved' || fdaStatus === 'submitted')) return 'done';
  if (pdaStatus === 'submitted' || fdaStatus === 'submitted') return 'review';
  if (pdaStatus === 'draft' || fdaStatus === 'draft') return 'wait';
  if (pdaStatus === 'approved') return 'done';
  return 'none';
}

function isOfficeApproved(authorizedBy) {
  return /^APPROVED\b/i.test(String(authorizedBy || '').trim());
}

async function loadVoyageMeta(pool, comId) {
  // Prefer the latest named Voyage Worksheet estimate (SHEET_NO = COST_SHEETID),
  // same source as Ops glance / cost-sheet — not compare/agency-letter FCAID.
  const [[namedSheet]] = await pool.query(
    `SELECT m.COST_SHEETID, m.SHEET_NAME,
            e.FCAID, e.VOYAGE_NO, e.VESSEL_IMO_ID, v.VESSEL_NAME
     FROM cost_sheet_name_master m
     LEFT JOIN freight_cost_estimete_master e
       ON e.FCAID = (
         SELECT MAX(e2.FCAID)
         FROM freight_cost_estimete_master e2
         WHERE e2.COMID = m.COMID AND e2.SHEET_NO = m.COST_SHEETID
       )
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = e.VESSEL_IMO_ID
     WHERE m.COMID = ? AND m.MODULEID = ? AND m.MCOMPANYID = ?
     ORDER BY m.COST_SHEETID DESC
     LIMIT 1`,
    [comId, MODULE_ID, COMPANY_ID],
  ).catch(() => [[null]]);

  if (namedSheet?.COST_SHEETID) {
    let voyageNo = String(namedSheet.VOYAGE_NO || '').trim();
    let vesselName = String(namedSheet.VESSEL_NAME || '').trim();
    let fcaId = namedSheet.FCAID != null ? String(namedSheet.FCAID) : '';

    // Worksheet row exists but estimate not created yet — try estimate by SHEET_NO only.
    if ((!voyageNo || !vesselName) && !namedSheet.FCAID) {
      const [[bySheet]] = await pool.query(
        `SELECT e.FCAID, e.VOYAGE_NO, v.VESSEL_NAME
         FROM freight_cost_estimete_master e
         LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = e.VESSEL_IMO_ID
         WHERE e.COMID = ? AND e.SHEET_NO = ?
         ORDER BY e.FCAID DESC
         LIMIT 1`,
        [comId, namedSheet.COST_SHEETID],
      ).catch(() => [[null]]);
      if (bySheet) {
        voyageNo = voyageNo || String(bySheet.VOYAGE_NO || '').trim();
        vesselName = vesselName || String(bySheet.VESSEL_NAME || '').trim();
        fcaId = fcaId || (bySheet.FCAID != null ? String(bySheet.FCAID) : '');
      }
    }

    return {
      voyageNo,
      vesselName,
      costSheetId: String(namedSheet.COST_SHEETID),
      worksheetName: String(namedSheet.SHEET_NAME || '').trim() || `Sheet ${namedSheet.COST_SHEETID}`,
      fcaId,
    };
  }

  // No named worksheet — last resort from estimate with SHEET_NO, then any latest estimate.
  const [[withSheet]] = await pool.query(
    `SELECT e.FCAID, e.VOYAGE_NO, e.SHEET_NO, n.SHEET_NAME, v.VESSEL_NAME
     FROM freight_cost_estimete_master e
     LEFT JOIN cost_sheet_name_master n ON n.COST_SHEETID = e.SHEET_NO
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = e.VESSEL_IMO_ID
     WHERE e.COMID = ? AND e.SHEET_NO IS NOT NULL
     ORDER BY e.FCAID DESC
     LIMIT 1`,
    [comId],
  ).catch(() => [[null]]);

  if (withSheet) {
    return {
      voyageNo: String(withSheet.VOYAGE_NO || '').trim(),
      vesselName: String(withSheet.VESSEL_NAME || '').trim(),
      costSheetId: withSheet.SHEET_NO != null ? String(withSheet.SHEET_NO) : '',
      worksheetName: String(withSheet.SHEET_NAME || '').trim()
        || (withSheet.SHEET_NO != null ? `Sheet ${withSheet.SHEET_NO}` : ''),
      fcaId: withSheet.FCAID != null ? String(withSheet.FCAID) : '',
    };
  }

  const [[latest]] = await pool.query(
    `SELECT e.FCAID, e.VOYAGE_NO, v.VESSEL_NAME
     FROM freight_cost_estimete_master e
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = e.VESSEL_IMO_ID
     WHERE e.COMID = ?
     ORDER BY e.FCAID DESC
     LIMIT 1`,
    [comId],
  ).catch(() => [[null]]);

  return {
    voyageNo: String(latest?.VOYAGE_NO || '').trim(),
    vesselName: String(latest?.VESSEL_NAME || '').trim(),
    costSheetId: '',
    worksheetName: '',
    fcaId: latest?.FCAID != null ? String(latest.FCAID) : '',
  };
}

async function loadCostBundle(pool, genAgencyId) {
  if (!genAgencyId) return null;
  const [[cost]] = await pool.query(
    `SELECT * FROM loadport_cost_master WHERE GEN_AGENCY_ID = ? LIMIT 1`,
    [genAgencyId],
  ).catch(() => [[null]]);
  if (!cost) return null;

  const [slaveRows] = await pool.query(
    `SELECT s.*, t.NAME AS TYPE_NAME
     FROM loadport_cost_slave s
     LEFT JOIN port_cost_type_master t ON t.PC_TYPE_ID = s.PC_TYPE_ID
     WHERE s.LP_COST_ID = ?
     ORDER BY s.LP_COST_SLAVEID`,
    [cost.LP_COST_ID],
  ).catch(() => [[]]);

  const lines = (slaveRows || [])
    .filter((row) => (
      money(row.ESTMD_COST_LC)
      || money(row.ESTMD_COST_USD)
      || money(row.ACTUAL_COST_LC)
      || money(row.ACTUAL_COST_USD)
    ))
    .map((row) => ({
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

  return { cost, lines };
}

async function lookupCountryNameById(pool, countryId) {
  if (!countryId) return '';
  const [[c]] = await pool.query(
    'SELECT COUNTRY_NAME FROM country_master WHERE COUNTRYID = ? LIMIT 1',
    [countryId],
  ).catch(() => [[null]]);
  return String(c?.COUNTRY_NAME || '').trim();
}

/** Resolve full country name — never leave ISO keys like ARE as the display value. */
async function loadPortCountry(pool, portId, countryId) {
  const [[port]] = await pool.query(
    `SELECT PortName, COUNTRY_KEY, COUNTRY_NAME FROM port_master WHERE PortId = ? LIMIT 1`,
    [portId],
  ).catch(() => [[null]]);

  let countryName = await lookupCountryNameById(pool, countryId);

  if (!countryName) {
    // Legacy: port_master.COUNTRY_NAME often stores numeric COUNTRYID.
    const stored = String(port?.COUNTRY_NAME || '').trim();
    if (stored && /^\d+$/.test(stored)) {
      countryName = await lookupCountryNameById(pool, stored);
    } else if (stored && stored.length > 3) {
      // Already a full name in some datasets.
      countryName = stored;
    }
  }

  if (!countryName) {
    const key = String(port?.COUNTRY_KEY || '').trim();
    if (key && /^\d+$/.test(key)) {
      countryName = await lookupCountryNameById(pool, key);
    } else if (key) {
      const attempts = [
        ['SELECT COUNTRY_NAME FROM country_master WHERE COUNTRY_CODE = ? LIMIT 1', [key]],
        ['SELECT COUNTRY_NAME FROM country_master WHERE COUNTRY_KEY = ? LIMIT 1', [key]],
        ['SELECT COUNTRY_NAME FROM country_master WHERE ISO_CODE = ? LIMIT 1', [key]],
        ['SELECT COUNTRY_NAME FROM country_master WHERE COUNTRY_NAME = ? LIMIT 1', [key]],
        ['SELECT COUNTRY_NAME FROM country_master WHERE COUNTRY_NAME LIKE ? LIMIT 1', [`%${key}%`]],
      ];
      for (const [sql, params] of attempts) {
        const [[row]] = await pool.query(sql, params).catch(() => [[null]]);
        if (row?.COUNTRY_NAME) {
          countryName = String(row.COUNTRY_NAME).trim();
          break;
        }
      }
    }
  }

  return {
    portName: shortPortName(port?.PortName) || '',
    country: countryName || '—',
  };
}

function buildPortPayload(base, costBundle, voyageMeta) {
  const nominated = Number(base.letter?.status) === 2;
  const genAgencyId = base.letter?.genAgencyId || null;
  const cost = costBundle?.cost || null;
  const lines = costBundle?.lines || [];
  const status = cost ? num(cost.STATUS, 0) : -1;
  const officeApproved = isOfficeApproved(cost?.AUTHORIZED_BY);
  const pdaStatus = nominated ? mapPdaStatus(status, officeApproved) : 'notstarted';
  const fdaStatus = nominated ? mapFdaStatus(status) : 'notstarted';
  const localCurrency = cost?.LOCAL_CURRENCY || 'USD';
  const exchangeRate = cost ? num(cost.EXCHANGE_RATE, 1) : 1;
  const estimatedUsd = money(cost?.TTL_ESTMD_COST_USD);
  const estimatedLc = money(cost?.TTL_ESTMD_COST_LC);
  const actualUsd = money(cost?.TTL_ACTUAL_COST_USD);
  const actualLc = money(cost?.TTL_ACTUAL_COST_LC);
  const dateLabel = formatDisplayDate(cost?.DATE || base.letter?.date);

  return {
    key: base.key,
    tabLabel: base.tabLabel,
    portType: base.portType,
    portId: base.portId,
    portName: base.portName || '',
    randomId: base.randomId,
    agentName: base.agentName || '',
    agentCode: base.agentCode || '',
    nominated,
    genAgencyId,
    lpCostId: cost?.LP_COST_ID ?? null,
    costStatus: status < 0 ? null : status,
    country: base.country || '—',
    localCurrency,
    exchangeRate,
    date: dateLabel,
    voyageNo: voyageMeta.voyageNo,
    vesselName: voyageMeta.vesselName,
    pda: {
      status: pdaStatus,
      estimatedUsd,
      estimatedLc,
      meta: pdaStatus === 'notstarted'
        ? 'No PDA submitted yet'
        : pdaStatus === 'draft'
          ? 'Draft in progress with agent'
          : pdaStatus === 'submitted'
            ? `Submitted ${dateLabel || '—'} · awaiting office review`
            : `Approved${dateLabel ? ` · ${dateLabel}` : ''}`,
      canReview: pdaStatus === 'submitted',
      canViewBreakdown: Boolean(lines.length) && pdaStatus !== 'notstarted',
    },
    fda: {
      status: fdaStatus,
      estimatedUsd,
      estimatedLc,
      actualUsd,
      actualLc,
      varianceUsd: money(actualUsd - estimatedUsd),
      varianceLc: money(actualLc - estimatedLc),
      meta: fdaStatus === 'notstarted'
        ? (pdaStatus === 'approved' || pdaStatus === 'submitted'
          ? 'Available once PDA is approved'
          : 'Available once PDA is approved')
        : fdaStatus === 'draft'
          ? 'Draft in progress with agent'
          : fdaStatus === 'submitted'
            ? `Submitted ${dateLabel || '—'} · awaiting office review`
            : `Approved${dateLabel ? ` · ${dateLabel}` : ''}`,
      canReview: fdaStatus === 'submitted',
      canViewBreakdown: Boolean(lines.length) && fdaStatus !== 'notstarted' && pdaStatus !== 'notstarted',
    },
    tabDot: tabDot(pdaStatus, fdaStatus, nominated),
    header: {
      bankDetails: cost?.BANK_DETAILS || '',
      preparedBy: cost?.PREPARED_BY || '',
      authorizedBy: cost?.AUTHORIZED_BY || '',
      agentRemarks: cost?.AGENT_REMARKS || '',
      operatorRemarks: cost?.OPERATOR_REMARKS || '',
    },
    lines,
  };
}

export async function dbGetOpsPdaFda(comId) {
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const form = await dbGetAgencyLetterForm(comId);
  const voyageMeta = await loadVoyageMeta(pool, comId);
  // Vessel / voyage no must come from the Voyage Worksheet estimate — not agency-letter compare.
  const vesselName = voyageMeta.vesselName || '';
  const voyageNo = voyageMeta.voyageNo || '';

  const ports = [];
  for (const port of form.ports || []) {
    const genAgencyId = port.letter?.genAgencyId || null;
    const costBundle = nominatedBundle(port) ? await loadCostBundle(pool, genAgencyId) : null;
    const countryInfo = await loadPortCountry(pool, port.portId, port.letter?.countryId);
    ports.push(buildPortPayload(
      {
        ...port,
        portName: shortPortName(port.portName) || countryInfo.portName || port.portId,
        country: countryInfo.country,
      },
      costBundle,
      { voyageNo, vesselName },
    ));
  }

  return {
    comId: String(comId),
    // Prefer named sheet COST_SHEETID (for /ops/cost-sheet); do not use agency letter FCAID.
    costSheetId: voyageMeta.costSheetId || '',
    nomId: voyageNo || form.nomId || '',
    voyageNo,
    vesselName,
    worksheetName: voyageMeta.worksheetName || '',
    fcaId: voyageMeta.fcaId,
    legsCount: form.legsCount,
    ports,
  };
}

function nominatedBundle(port) {
  return Number(port?.letter?.status) === 2 && port?.letter?.genAgencyId;
}

export async function dbReviewOpsPdaFda({ comId, genAgencyId, action, mode, operatorRemarks }) {
  if (!comId || !genAgencyId) {
    const error = new Error('COMID and agency letter are required.');
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const [[letter]] = await pool.query(
    `SELECT GEN_AGENCY_ID, COMID FROM generate_agency_letter WHERE GEN_AGENCY_ID = ? LIMIT 1`,
    [genAgencyId],
  );
  if (!letter || String(letter.COMID) !== String(comId)) {
    const error = new Error('Agency letter not found for this voyage.');
    error.status = 404;
    throw error;
  }

  const [[cost]] = await pool.query(
    `SELECT LP_COST_ID, STATUS, AUTHORIZED_BY, OPERATOR_REMARKS
     FROM loadport_cost_master WHERE GEN_AGENCY_ID = ? LIMIT 1`,
    [genAgencyId],
  );
  if (!cost) {
    const error = new Error('No PDA/FDA submission found for this port.');
    error.status = 404;
    throw error;
  }

  const reviewAction = String(action || '').toLowerCase();
  const kind = String(mode || 'pda').toLowerCase() === 'fda' ? 'fda' : 'pda';
  const remarks = String(operatorRemarks || '').trim();
  const status = num(cost.STATUS, 0);

  if (reviewAction === 'approve') {
    if (kind === 'pda' && status < 2) {
      const error = new Error('PDA must be submitted before it can be approved.');
      error.status = 400;
      throw error;
    }
    if (kind === 'fda' && status < 3) {
      const error = new Error('FDA must be submitted before it can be approved.');
      error.status = 400;
      throw error;
    }
    const stamp = `APPROVED ${new Date().toISOString().slice(0, 10)}${remarks ? ` — ${remarks}` : ''}`;
    await pool.query(
      `UPDATE loadport_cost_master SET AUTHORIZED_BY = ? WHERE LP_COST_ID = ?`,
      [stamp.slice(0, 250), cost.LP_COST_ID],
    );
    if (remarks) {
      // Prefer OPERATOR_REMARKS when the column exists; ignore unknown-column errors.
      await pool.query(
        `UPDATE loadport_cost_master SET OPERATOR_REMARKS = ? WHERE LP_COST_ID = ?`,
        [remarks.slice(0, 4000), cost.LP_COST_ID],
      ).catch(() => null);
    }
    if (kind === 'fda' && status === 3) {
      await pool.query(
        `UPDATE loadport_cost_master SET STATUS = 4 WHERE LP_COST_ID = ?`,
        [cost.LP_COST_ID],
      );
    }
  } else if (reviewAction === 'query') {
    if (!remarks) {
      const error = new Error('Please enter a query note for the agent.');
      error.status = 400;
      throw error;
    }
    const note = `[Query ${new Date().toISOString().slice(0, 10)}] ${remarks}`;
    const merged = [cost.OPERATOR_REMARKS, note].filter(Boolean).join('\n');
    const updated = await pool.query(
      `UPDATE loadport_cost_master SET OPERATOR_REMARKS = ? WHERE LP_COST_ID = ?`,
      [merged.slice(0, 4000), cost.LP_COST_ID],
    ).then(() => true).catch(() => false);
    if (!updated) {
      // Fallback: stamp the query on AUTHORIZED_BY when OPERATOR_REMARKS is unavailable.
      await pool.query(
        `UPDATE loadport_cost_master SET AUTHORIZED_BY = ? WHERE LP_COST_ID = ?`,
        [note.slice(0, 250), cost.LP_COST_ID],
      );
    }
  } else if (reviewAction === 'remarks') {
    const updated = await pool.query(
      `UPDATE loadport_cost_master SET OPERATOR_REMARKS = ? WHERE LP_COST_ID = ?`,
      [remarks.slice(0, 4000), cost.LP_COST_ID],
    ).then(() => true).catch(() => false);
    if (!updated && remarks) {
      await pool.query(
        `UPDATE loadport_cost_master SET AUTHORIZED_BY = ? WHERE LP_COST_ID = ?`,
        [String(cost.AUTHORIZED_BY || remarks).slice(0, 250), cost.LP_COST_ID],
      );
    }
  } else {
    const error = new Error('Unknown review action.');
    error.status = 400;
    throw error;
  }

  return dbGetOpsPdaFda(comId);
}

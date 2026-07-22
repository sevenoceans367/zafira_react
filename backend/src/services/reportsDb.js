import { appContext, isDbConfigured, isMgmtUser } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY, parsePeriodDate } from './estimateListMappers.js';
import { dbListOpsVcYears, dbListVoyageReports } from './opsVcDb.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function shortPortName(name) {
  return String(name || '').split(' / ')[0] || '';
}

function safeDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted === '01-01-1970' || formatted.startsWith('01-01-1970')) return '';
  return formatted;
}

function parseDmyToTime(value) {
  const iso = parsePeriodDate(value);
  if (!iso) return null;
  const time = Date.parse(`${iso}T00:00:00`);
  return Number.isNaN(time) ? null : time;
}

async function getCompanyName(pool) {
  const [[row]] = await pool.query(
    'SELECT COMPANY_NAME FROM company_master WHERE COMPANYID = ? LIMIT 1',
    [COMPANY_ID],
  );
  return row?.COMPANY_NAME || '';
}

async function portNamesForFca(pool, fcaId) {
  const [rows] = await pool.query(
    `SELECT FROM_PORT, TO_PORT, LOAD_PORT_QTY, DISC_PORT_QTY
     FROM freight_cost_estimete_slave1
     WHERE FCAID = ?`,
    [fcaId],
  );
  const loadIds = [];
  const discIds = [];
  rows.forEach((row) => {
    if (Number(row.LOAD_PORT_QTY) > 0 && row.FROM_PORT) loadIds.push(row.FROM_PORT);
    if (Number(row.DISC_PORT_QTY) > 0 && row.TO_PORT) discIds.push(row.TO_PORT);
  });
  const resolve = async (ids) => {
    if (!ids.length) return '';
    const placeholders = ids.map(() => '?').join(',');
    const [ports] = await pool.query(
      `SELECT PortId, PortName FROM port_master WHERE PortId IN (${placeholders})`,
      ids,
    );
    const map = new Map(ports.map((p) => [String(p.PortId), shortPortName(p.PortName)]));
    return ids.map((id) => map.get(String(id)) || '').filter(Boolean).join(', ');
  };
  return {
    loadPort: await resolve(loadIds),
    dischargePort: await resolve(discIds),
  };
}

async function brokerNamesForFca(pool, fcaId) {
  const [rows] = await pool.query(
    `SELECT v.NAME AS name
     FROM freight_cost_estimete_slave4 s
     LEFT JOIN vendor_master v ON v.CODE = s.VENDORID
     WHERE s.FCAID = ?`,
    [fcaId],
  );
  return rows.map((r) => r.name).filter(Boolean).join(', ');
}

async function freightAndQty(pool, master) {
  const estimateType = Number(master.ESTIMATE_TYPE);
  let quantity = 0;
  let freight = 0;

  if (estimateType === 1) {
    quantity = Number(master.GAS_QUANTITY) || 0;
    if (master.GAS_MARKET) {
      freight = quantity;
    } else {
      freight = Number(
        ((Number(master.GAS_BALTIC) || 0) + (Number(master.ADDNL_PRENIUM) || 0)) * quantity,
      );
    }
  } else if (estimateType === 2) {
    quantity = Number(master.TANK_QUANTITY) || 0;
    if (Number(master.TANKER_RADIO_SINGLE_DIS) === 1) {
      if (Number(master.CHK_LUMPSUM) === 1) {
        freight = Number(master.LUMPSUMAMT) || 0;
      } else {
        const [[sum]] = await pool.query(
          'SELECT SUM(TOTAL_AMOUNT) AS sum1 FROM freight_cost_estimete_slave12 WHERE FCAID = ?',
          [master.FCAID],
        );
        freight = Number(sum?.sum1) || 0;
      }
    } else {
      const [[sum]] = await pool.query(
        'SELECT SUM(AMOUNT_USD) AS sum1 FROM freight_cost_estimete_slave10 WHERE FCAID = ?',
        [master.FCAID],
      );
      freight = Number(sum?.sum1) || 0;
    }
  } else if (Number(master.QTY_TYPE_RADIO) === 1) {
    quantity = Number(master.QUANTITY) || 0;
    freight = Number(master.NET_PAYABLE) || 0;
  } else {
    const [[sum]] = await pool.query(
      'SELECT SUM(QUANTITY) AS sum, SUM(NET_FREIGHT) AS sum2 FROM freight_cost_estimete_slave7 WHERE FCAID = ?',
      [master.FCAID],
    );
    quantity = Number(sum?.sum) || 0;
    freight = Number(sum?.sum2) || 0;
  }

  return {
    quantity: quantity ? String(quantity) : '',
    freight: freight ? Number(freight).toFixed(2) : '0.00',
  };
}

export async function dbReportFilterOptions() {
  const years = isDbConfigured()
    ? await dbListOpsVcYears()
    : [
      { id: String(new Date().getFullYear()), name: String(new Date().getFullYear()) },
      { id: String(new Date().getFullYear() - 1), name: String(new Date().getFullYear() - 1) },
    ];
  return {
    businessTypes: [
      { id: '', name: 'All' },
      { id: '3', name: 'Dry' },
      { id: '2', name: 'Tankers' },
      { id: '1', name: 'Gas' },
    ],
    years,
    teams: [
      { id: '', name: 'All' },
      { id: '7', name: 'Zafira' },
    ],
    isMgmtUser: isMgmtUser(),
  };
}

/** Empty / All → no ESTIMATE_TYPE filter (matches PHP getBusinessTypeList1 empty option). */
function estimateTypeFilter(selBType, alias = 'm') {
  const value = String(selBType || '').trim();
  if (!value) return { sql: '', params: [] };
  return { sql: ` AND ${alias}.ESTIMATE_TYPE = ? `, params: [value] };
}

export async function dbSpotFixturesReport(filters = {}) {
  const pool = getPool();
  const fromMs = parseDmyToTime(filters.dateFrom);
  const toMs = parseDmyToTime(filters.dateTo);
  const typeFilter = estimateTypeFilter(filters.selBType);
  const companyName = await getCompanyName(pool);

  const [rows] = await pool.query(
    `SELECT c.COMID, c.MESSAGE, m.FCAID, m.VESSEL_IMO_ID, m.COA_SPOT, m.TRANS_DATE,
            m.ESTIMATE_TYPE, m.VESSEL_TYPE, m.GAS_QUANTITY, m.GAS_MARKET, m.GAS_BALTIC,
            m.ADDNL_PRENIUM, m.TANK_QUANTITY, m.TANKER_RADIO_SINGLE_DIS, m.CHK_LUMPSUM,
            m.LUMPSUMAMT, m.QTY_TYPE_RADIO, m.QUANTITY, m.NET_PAYABLE, m.VOYAGE_NAME,
            v.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND c.STATUS = 1
       AND m.COA_SPOT = 1
       ${typeFilter.sql}
     ORDER BY m.FCAID DESC`,
    [MODULE_ID, COMPANY_ID, ...typeFilter.params],
  );

  const records = [];
  let srNo = 0;
  for (const row of rows) {
    const cpMs = row.TRANS_DATE ? new Date(row.TRANS_DATE).getTime() : null;
    if (fromMs != null && (cpMs == null || cpMs < fromMs)) continue;
    if (toMs != null && (cpMs == null || cpMs > toMs + 86400000 - 1)) continue;

    const ports = await portNamesForFca(pool, row.FCAID);
    const broker = await brokerNamesForFca(pool, row.FCAID);
    const { quantity, freight } = await freightAndQty(pool, row);
    srNo += 1;
    records.push({
      id: row.COMID,
      srNo,
      nomId: row.MESSAGE || row.VOYAGE_NAME || '',
      vesselName: row.VESSEL_NAME || '',
      cpDate: safeDate(row.TRANS_DATE),
      owner: companyName,
      broker,
      vesselType: row.VESSEL_TYPE || '',
      contractQty: quantity,
      loadPort: ports.loadPort,
      dischargePort: ports.dischargePort,
      freight,
    });
  }

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

async function plBoundsForCom(pool, comId) {
  const [sheets] = await pool.query(
    `SELECT ACTUAL_PL
     FROM freight_cost_estimete_master
     WHERE COMID = ? AND SHEET_NO IS NOT NULL AND SHEET_NO != ''
     ORDER BY SHEET_NO ASC`,
    [comId],
  );
  if (!sheets.length) return { first: '', last: '' };
  return {
    first: sheets[0]?.ACTUAL_PL ?? '',
    last: sheets.length > 1 ? sheets[sheets.length - 1]?.ACTUAL_PL ?? '' : '',
  };
}

async function chartererForMaster(pool, master) {
  if (Number(master.ESTIMATE_TYPE) === 3 && Number(master.QTY_TYPE_RADIO) === 2) {
    const [rows] = await pool.query(
      `SELECT v.NAME AS name
       FROM freight_cost_estimete_slave7 s
       LEFT JOIN vendor_master v ON v.CODE = s.QTY_VENDORID
       WHERE s.FCAID = ?
       GROUP BY s.QTY_VENDORID`,
      [master.FCAID],
    );
    return rows.map((r) => r.name).filter(Boolean).join(',');
  }
  if (!master.FGFF_VENDORID) return '';
  const [[vendor]] = await pool.query(
    'SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1',
    [master.FGFF_VENDORID],
  );
  return vendor?.NAME || '';
}

async function cargoName(pool, cargoId) {
  if (!cargoId) return '';
  const ids = String(cargoId).split(',').map((x) => x.trim()).filter(Boolean);
  if (!ids.length) return '';
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT MATERIAL_TYPE FROM cargo_master WHERE MATERIALID IN (${placeholders})`,
    ids,
  );
  return rows.map((r) => r.MATERIAL_TYPE).filter(Boolean).join(', ');
}

export async function dbCharteringRegisterReport(filters = {}, { detailed = false } = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const typeFilter = estimateTypeFilter(filters.selBType);
  const selCOASpot = String(filters.selCOASpot || '1');
  const companyName = await getCompanyName(pool);
  const coaClause = selCOASpot === '2'
    ? 'AND c.COAAID IS NOT NULL'
    : 'AND c.COAAID IS NULL';

  const [rows] = await pool.query(
    `SELECT c.COMID, c.MESSAGE, c.COAAID,
            (SELECT CONTACT_PERSON FROM login WHERE LOGINID = c.USERID) AS CHARTERINGUSER,
            (SELECT CONTACT_PERSON FROM login WHERE LOGINID = c.OPERATOR) AS OPSUSER,
            m.FCAID, m.VESSEL_IMO_ID, m.ESTIMATE_TYPE, m.CARGO_ID, m.CP_DATE, m.TRANS_DATE,
            m.DWT_SUMMER, m.QTY_TYPE_RADIO, m.VOYAGE_NO, m.VOYAGE_NAME, m.REVENUES_FREIGHT,
            m.FGFF_VENDORID, v.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND c.STATUS IN (1, 2)
       AND m.TRANS_DATE >= ?
       AND m.TRANS_DATE <= ?
       ${typeFilter.sql}
       ${coaClause}
     GROUP BY c.COMID
     ORDER BY m.TRANS_DATE DESC`,
    [MODULE_ID, COMPANY_ID, from, to, ...typeFilter.params],
  );

  const records = [];
  let srNo = 0;
  for (const row of rows) {
    srNo += 1;
    const pl = await plBoundsForCom(pool, row.COMID);
    const charterer = await chartererForMaster(pool, row);
    const cargo = await cargoName(pool, row.CARGO_ID);
    let voyageLabel = `${row.VOYAGE_NO || ''}/${row.VOYAGE_NAME || ''}`;
    if (selCOASpot === '2' && row.COAAID) {
      const [[coa]] = await pool.query(
        'SELECT COA_ID FROM coa_master WHERE COAAID = ? LIMIT 1',
        [row.COAAID],
      );
      voyageLabel = `${row.VOYAGE_NO || ''}/${coa?.COA_ID || row.COAAID}`;
    }

    const base = {
      id: row.COMID,
      srNo,
      nomId: row.MESSAGE || '',
      vesselName: row.VESSEL_NAME || '',
      cpic: row.CHARTERINGUSER || '',
      opsPic: row.OPSUSER || '',
      dwt: row.DWT_SUMMER ?? '',
      cpDate: safeDate(row.TRANS_DATE || row.CP_DATE),
      ownerName: companyName,
      charterer,
      fixtureDate: safeDate(row.TRANS_DATE),
      revenue: row.REVENUES_FREIGHT ?? '',
      initialPl: pl.first,
      finalPl: pl.last,
      remarks: '',
    };

    if (detailed) {
      records.push({
        ...base,
        voyageNo: row.VOYAGE_NO || '',
      });
    } else {
      records.push({
        ...base,
        voyage: voyageLabel,
        cargoName: cargo,
      });
    }
  }

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbCharteringRegisterTcReport(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const typeFilter = estimateTypeFilter(filters.selBType);

  const [rows] = await pool.query(
    `SELECT c.COMID, c.MESSAGE, m.TCOUTID, m.TC_NO, m.VESSEL_IMO_ID, m.CP_DATE1,
            m.SUMMER_DWT, m.SEL_CHARTERER, m.DEL_RANGE_PORT, m.RE_DEL_RANGE,
            m.DEL_DATE, m.RE_DEL_DATE, m.TC_DATE,
            v.VESSEL_NAME, vend.NAME AS CHARTERER_NAME,
            (SELECT SUM(TOTAL_REV_EST) FROM chartering_tc_estimate_slave1 s WHERE s.TCOUTID = m.TCOUTID) AS TOTAL_REV,
            (SELECT SUM(TOTAL_EXP_EST) FROM chartering_tc_estimate_slave1 s WHERE s.TCOUTID = m.TCOUTID) AS TOTAL_EXP,
            (SELECT SUM(VOYAGE_EARN_EST) FROM chartering_tc_estimate_slave1 s WHERE s.TCOUTID = m.TCOUTID) AS TC_EARNINGS,
            (SELECT SUM(NET_HIREAGE) FROM chartering_tc_estimate_slave1 s WHERE s.TCOUTID = m.TCOUTID) AS TC_IN_HIRE,
            (SELECT PROFIT_PER_DAY_EST FROM chartering_tc_estimate_slave1 s WHERE s.TCOUTID = m.TCOUTID ORDER BY s.TC_SLAVE1ID DESC LIMIT 1) AS PROFIT_PER_DAY
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN vendor_master vend ON vend.CODE = m.SEL_CHARTERER
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND c.STATUS IN (1, 2, 4)
       AND m.TC_DATE >= ?
       AND m.TC_DATE <= ?
       ${typeFilter.sql}
       AND m.SHEET_NO IS NULL
       AND c.COMID > 0
     ORDER BY m.TC_DATE DESC`,
    [MODULE_ID, COMPANY_ID, from, to, ...typeFilter.params],
  );

  return {
    records: rows.map((row, index) => {
      const totalRev = Number(row.TOTAL_REV) || 0;
      const totalExp = Number(row.TOTAL_EXP) || 0;
      const tcInHire = Number(row.TC_IN_HIRE) || 0;
      const otherExp = Math.max(totalExp - tcInHire, 0);
      return {
        id: row.COMID || row.TCOUTID,
        srNo: index + 1,
        nomId: row.MESSAGE || '',
        tcNo: row.TC_NO || '',
        vesselName: row.VESSEL_NAME || '',
        dwt: row.SUMMER_DWT ?? '',
        cpDate: safeDate(row.CP_DATE1),
        charterer: row.CHARTERER_NAME || '',
        ports: [row.DEL_RANGE_PORT, row.RE_DEL_RANGE].filter(Boolean).join(' / '),
        dates: [safeDate(row.DEL_DATE), safeDate(row.RE_DEL_DATE)].filter(Boolean).join(' / '),
        totalRev: totalRev ? totalRev.toFixed(2) : '',
        otherExp: otherExp ? otherExp.toFixed(2) : '',
        tcInHire: tcInHire ? tcInHire.toFixed(2) : '',
        totalExp: totalExp ? totalExp.toFixed(2) : '',
        tcEarnings: row.TC_EARNINGS != null ? Number(row.TC_EARNINGS).toFixed(2) : '',
        profitPerDay: row.PROFIT_PER_DAY != null ? Number(row.PROFIT_PER_DAY).toFixed(2) : '',
      };
    }),
    recordsTotal: rows.length,
    isMgmtUser: isMgmtUser(),
  };
}

export async function dbVesselOpenPositionReport(filters = {}) {
  const pool = getPool();
  const selBType = String(filters.selBType || '').trim();
  const vesselTypeSql = selBType ? ' AND v.BUSINESSTYPEID = ? ' : '';
  const vesselParams = selBType ? [COMPANY_ID, selBType] : [COMPANY_ID];

  const [vessels] = await pool.query(
    `SELECT v.VESSEL_IMO_ID, v.VESSEL_NAME, v.BUSINESSTYPEID,
            (SELECT VesselType FROM vessel_type_master WHERE VesselTypeId = v.VESSEL_TYPE) AS VESSEL_TYPE
     FROM vessel_imo_master v
     WHERE v.MCOMPANYID = ?
       ${vesselTypeSql}`,
    vesselParams,
  );

  const records = [];
  let srNo = 0;
  for (const vessel of vessels) {
    const [[vc]] = await pool.query(
      `SELECT m.COMID, m.FCAID, m.OPEN_CARGOID,
              (SELECT TO_PORT FROM freight_cost_estimete_slave1 s
               WHERE s.FCAID = m.FCAID AND s.DISC_PORT_QTY > 0
               ORDER BY s.FCA_SLAVEID DESC LIMIT 1) AS LAST_DIS_PORT,
              (SELECT DISC_PORT_QTY FROM freight_cost_estimete_slave1 s
               WHERE s.FCAID = m.FCAID AND s.DISC_PORT_QTY > 0
               ORDER BY s.FCA_SLAVEID DESC LIMIT 1) AS LAST_DISC_PORT_QTY
       FROM freight_cost_estimete_master m
       WHERE m.VESSEL_IMO_ID = ? AND m.MCOMPANYID = ?
       ORDER BY m.FCAID DESC
       LIMIT 1`,
      [vessel.VESSEL_IMO_ID, COMPANY_ID],
    );

    const [[tc]] = await pool.query(
      `SELECT m.COMID, m.TCOUTID, m.RE_DEL_RANGE,
              (SELECT REDEL_DATE_EST FROM chartering_tc_estimate_slave1 s
               WHERE s.TCOUTID = m.TCOUTID
               ORDER BY s.TC_SLAVE1ID DESC LIMIT 1) AS LAST_REDEL_DATE_EST
       FROM chartering_estimate_tc_master m
       WHERE m.VESSEL_IMO_ID = ? AND m.MCOMPANYID = ?
       ORDER BY m.TCOUTID DESC
       LIMIT 1`,
      [vessel.VESSEL_IMO_ID, COMPANY_ID],
    );

    let openVc = '';
    if (vc?.COMID) {
      try {
        if (vc.LAST_DIS_PORT) {
          const [[sailed]] = await pool.query(
            `SELECT CPD.ACTUAL_DATE
             FROM checklist_port_data CPD
             INNER JOIN checklist_master CM ON CM.CHECKLIST_ID = CPD.CHECKLIST_ID
             WHERE CM.COMID = ?
               AND CPD.PORT_TYPE = 'DP'
               AND CPD.PORT_ID = ?
               AND CPD.EVENT_NAME IN ('VESSEL SAILED', 'ETC/D')
             ORDER BY FIELD(CPD.EVENT_NAME, 'VESSEL SAILED', 'ETC/D')
             LIMIT 1`,
            [vc.COMID, vc.LAST_DIS_PORT],
          );
          openVc = safeDate(sailed?.ACTUAL_DATE);
        }
      } catch {
        openVc = '';
      }
      if (!openVc) {
        const [[master]] = await pool.query(
          `SELECT TRANS_DATE, CP_DATE FROM freight_cost_estimete_master
           WHERE COMID = ? ORDER BY FCAID DESC LIMIT 1`,
          [vc.COMID],
        );
        openVc = safeDate(master?.TRANS_DATE || master?.CP_DATE);
      }
    }
    const openTc = safeDate(tc?.LAST_REDEL_DATE_EST);
    if (!openVc && !openTc) continue;

    let lastBusiness = 'TC';
    let lastPort = tc?.RE_DEL_RANGE || '';
    let dateOpen = openTc;
    let lastCargo = '';
    let lastCargoSize = '';

    const preferVc = openVc && (!openTc || Date.parse(openVc.split('-').reverse().join('-')) >= Date.parse(openTc.split('-').reverse().join('-')));
    if (preferVc || (openVc && !openTc)) {
      lastBusiness = 'Voyage';
      dateOpen = openVc;
      if (vc?.LAST_DIS_PORT) {
        const [[port]] = await pool.query(
          'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
          [vc.LAST_DIS_PORT],
        );
        lastPort = shortPortName(port?.PortName);
      }
      lastCargoSize = vc?.LAST_DISC_PORT_QTY != null ? `${vc.LAST_DISC_PORT_QTY} MT` : '';
      if (vc?.OPEN_CARGOID) {
        const [[cargo]] = await pool.query(
          `SELECT (SELECT MATERIAL_TYPE FROM cargo_master WHERE MATERIALID = o.CARGO) AS name
           FROM open_cargo_master o WHERE o.OPEN_CARGOID = ? LIMIT 1`,
          [vc.OPEN_CARGOID],
        );
        lastCargo = cargo?.name || '';
      }
    }

    srNo += 1;
    records.push({
      id: vessel.VESSEL_IMO_ID,
      srNo,
      vesselName: vessel.VESSEL_NAME || '',
      vesselType: vessel.VESSEL_TYPE || '',
      lastBusiness,
      lastPort,
      dateOpen,
      lastCargo,
      lastCargoSize,
    });
  }

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbTcEarningReport(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const typeFilter = estimateTypeFilter(filters.selBType);

  const [rows] = await pool.query(
    `SELECT c.COMID, m.FCAID, m.VESSEL_IMO_ID, m.VOYAGE_NO, m.TRANS_DATE,
            m.TC_HIRE_DAYS, m.PROFIT_LOSS, m.DAILY_VESSEL_OPERATION_EXP, v.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND c.STATUS IN (1, 2, 3, 4, 5, 6)
       AND m.TRANS_DATE >= ?
       AND m.TRANS_DATE <= ?
       ${typeFilter.sql}
     GROUP BY c.COMID
     ORDER BY m.TRANS_DATE DESC`,
    [MODULE_ID, COMPANY_ID, from, to, ...typeFilter.params],
  );

  return {
    records: rows.map((row, index) => {
      const days = Number(row.TC_HIRE_DAYS) || 0;
      const pl = Number(row.PROFIT_LOSS) || 0;
      const hire = Number(row.DAILY_VESSEL_OPERATION_EXP) || 0;
      const earning = days ? hire + pl / days : hire;
      return {
        id: row.COMID,
        srNo: index + 1,
        cpDate: safeDate(row.TRANS_DATE),
        voyageNo: row.VOYAGE_NO || '',
        vesselName: row.VESSEL_NAME || '',
        tcDays: days || '',
        pl: row.PROFIT_LOSS ?? '',
        hirePerDay: row.DAILY_VESSEL_OPERATION_EXP ?? '',
        tcEarning: Number(earning).toFixed(2),
      };
    }),
    recordsTotal: rows.length,
    isMgmtUser: isMgmtUser(),
  };
}

export async function dbVesselTcPerfAgainstBaltic() {
  const pool = getPool();
  const companyName = await getCompanyName(pool);

  const [rows] = await pool.query(
    `SELECT m.TC_NO, m.CP_DATE1, m.VESSEL_IMO_ID, m.SEL_CHARTERER, m.DEL_DATE, m.RE_DEL_DATE,
            m.DEL_RANGE_PORT, m.RE_DEL_RANGE, m.HIRE_FIX_PER, m.EXCHANGE_RATE, m.BALTIC_ROUTE,
            m.BALTIC_DATE, m.BALTIC_RATE,
            (SELECT CONCAT(CODE, ' - ', NAME) FROM baltic_master WHERE BALTICID = m.BALTIC_ROUTE) AS BALTIC_ROUTENAME,
            v.VESSEL_NAME, vend.NAME AS CHARTERER_NAME
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     LEFT JOIN vendor_master vend ON vend.CODE = m.SEL_CHARTERER
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND c.STATUS IN (1, 2, 3)
     ORDER BY m.CP_DATE1 DESC`,
    [MODULE_ID, COMPANY_ID],
  );

  return {
    records: rows.map((row, index) => {
      const dailyHire = Number(row.HIRE_FIX_PER || 0) * Number(row.EXCHANGE_RATE || 0);
      const baltic = Number(row.BALTIC_RATE) || 0;
      const diff = baltic - dailyHire;
      const diffPct = baltic ? (diff / baltic) * 100 : 0;
      return {
        id: `${row.TC_NO}-${index}`,
        srNo: index + 1,
        tcNo: row.TC_NO || '',
        cpDate: safeDate(row.CP_DATE1),
        vesselName: row.VESSEL_NAME || '',
        charterer: row.CHARTERER_NAME || '',
        owner: companyName,
        delDate: safeDate(row.DEL_DATE),
        reDelDate: safeDate(row.RE_DEL_DATE),
        delPort: row.DEL_RANGE_PORT || '',
        reDelPort: row.RE_DEL_RANGE || '',
        dailyHire: dailyHire.toFixed(2),
        balticRoute: row.BALTIC_ROUTENAME || '',
        balticDate: safeDate(row.BALTIC_DATE),
        balticValue: row.BALTIC_RATE ?? '',
        tceDiff: diff.toFixed(2),
        tceDiffPct: diffPct.toFixed(2),
      };
    }),
    recordsTotal: rows.length,
    isMgmtUser: isMgmtUser(),
  };
}

export async function dbDaTrackerChartering(filters = {}) {
  const pool = getPool();
  const year = filters.selYear || String(new Date().getFullYear());
  const typeFilter = estimateTypeFilter(filters.selBType);
  const agent = String(filters.selAgent || '').trim();
  const portId = String(filters.selPort || '').trim();
  const costType = String(filters.selCostType || '').trim();

  const costTypeToPort = {
    'Load Port Costs': 'LP',
    'Discharge Port Costs': 'DP',
    'Transit Port Costs': 'TP',
  };
  const portCode = costTypeToPort[costType] || '';

  const extraSql = [];
  const extraParams = [];
  if (portId) {
    extraSql.push(' AND lp.PORTID = ? ');
    extraParams.push(portId);
  }
  if (portCode) {
    extraSql.push(' AND lp.PORT = ? ');
    extraParams.push(portCode);
  }
  if (agent) {
    extraSql.push(` AND EXISTS (
      SELECT 1 FROM vendor_slave vs
      WHERE vs.VENDOR_SLAVEID = lp.VENDOR_SLAVEID AND vs.VENDORID = ?
    ) `);
    extraParams.push(agent);
  }

  let rows = [];
  try {
    const [result] = await pool.query(
      `SELECT c.MESSAGE AS fixtureNo, v.VESSEL_NAME, m.CP_DATE, m.TRANS_DATE, m.CARGO_ID,
              lp.PORT, lp.PORTID,
              (SELECT CONTACT_PERSON FROM login WHERE LOGINID = c.USERID) AS chtgPic,
              (SELECT CONTACT_PERSON FROM login WHERE LOGINID = c.OPERATOR) AS opcPic,
              (SELECT PortName FROM port_master WHERE PortId = lp.PORTID LIMIT 1) AS portName,
              (SELECT vm.NAME
               FROM vendor_slave vs
               INNER JOIN vendor_master vm ON vm.CODE = vs.VENDORID
               WHERE vs.VENDOR_SLAVEID = lp.VENDOR_SLAVEID
               LIMIT 1) AS vendorName
       FROM loadport_cost_master lp
       INNER JOIN freight_cost_estimate_compare c
         ON c.COMID = lp.COMID
        AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
       LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
       WHERE c.MODULEID = ?
         AND c.MCOMPANYID = ?
         AND m.FIXED = 1
         AND YEAR(COALESCE(lp.DATE, m.ADD_ON_DATE, m.TRANS_DATE, m.CP_DATE)) = ?
         ${typeFilter.sql}
         ${extraSql.join('')}
       ORDER BY m.TRANS_DATE DESC, lp.LP_COST_ID DESC
       LIMIT 2000`,
      [MODULE_ID, COMPANY_ID, year, ...typeFilter.params, ...extraParams],
    );
    rows = result;
  } catch {
    return { records: [], recordsTotal: 0, isMgmtUser: isMgmtUser() };
  }

  const portToLabel = {
    LP: 'Load Port Costs',
    DP: 'Discharge Port Costs',
    TP: 'Transit Port Costs',
  };

  const records = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    records.push({
      id: `${row.fixtureNo}-${i}`,
      srNo: i + 1,
      fixtureNo: row.fixtureNo || '',
      vesselName: row.VESSEL_NAME || '',
      cpDate: safeDate(row.CP_DATE || row.TRANS_DATE),
      chtgPic: row.chtgPic || '',
      opcPic: row.opcPic || '',
      cargoType: await cargoName(pool, row.CARGO_ID),
      portName: shortPortName(row.portName) || row.PORT || '',
      costType: costType || portToLabel[String(row.PORT || '').toUpperCase()] || '',
      portCostVendor: row.vendorName || '',
    });
  }

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

const APPROVAL_STATUS_LABELS = {
  0: 'Submit to Edit',
  1: 'Level 1 Approval Pending',
  2: 'Sent for Review To Creator',
  3: 'Level 2 Approval Pending',
  4: 'Sent for Review To Approver 1',
};

async function approvalRowsFromTable(pool, {
  table,
  idColumn,
  formLabel,
  identify,
  messageColumn = 'MESSAGE',
  vendorColumn = 'VENDOR',
  comIdColumn = 'COMID',
}) {
  const [rows] = await pool.query(
    `SELECT * FROM ${table} WHERE STATUS > 0 AND STATUS < 5 ORDER BY ${idColumn} DESC LIMIT 500`,
  );
  const out = [];
  for (const row of rows) {
    const [[alert]] = await pool.query(
      `SELECT REDIRECTTO FROM alert_master
       WHERE IDENTIFY = ? AND IDENTIFYID = ?
       ORDER BY ALERTID DESC LIMIT 1`,
      [identify, row[idColumn]],
    );
    let voyageNo = '';
    if (row[comIdColumn]) {
      const [[voy]] = await pool.query(
        `SELECT VOYAGE_NO FROM freight_cost_estimete_master
         WHERE COMID = ? ORDER BY FCAID DESC LIMIT 1`,
        [row[comIdColumn]],
      );
      voyageNo = voy?.VOYAGE_NO || '';
    }
    let vendorName = '';
    if (row[vendorColumn]) {
      const [[vendor]] = await pool.query(
        'SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1',
        [row[vendorColumn]],
      );
      vendorName = vendor?.NAME || '';
    }
    const typePrefix = row.I_TYPE ? `${String(row.I_TYPE)} ` : '';
    out.push({
      formName: `${typePrefix}${formLabel}`.trim(),
      invoiceNo: row[messageColumn] || '',
      voyageNo,
      vendorName,
      status: APPROVAL_STATUS_LABELS[Number(row.STATUS)] || `Status ${row.STATUS}`,
      pendingWith: '',
      editLink: alert?.REDIRECTTO || '',
    });
  }
  return out;
}

export async function dbApprovalStatusReport() {
  const pool = getPool();
  const sections = [
    {
      table: 'freight_invoice_master',
      idColumn: 'INVOICEID',
      formLabel: 'Freight Invoice',
      identify: 'FREIGHT INVOICE',
    },
    {
      table: 'other_invoice_master',
      idColumn: 'INVOICEID',
      formLabel: 'Other Invoice',
      identify: 'OTHER INVOICE',
    },
    {
      table: 'loadport_cost_master',
      idColumn: 'LP_COST_ID',
      formLabel: 'Port Cost',
      identify: 'PORT COST',
    },
  ];

  const records = [];
  for (const section of sections) {
    try {
      const rows = await approvalRowsFromTable(pool, section);
      rows.forEach((row) => {
        records.push({
          id: `${section.table}-${records.length + 1}`,
          srNo: records.length + 1,
          ...row,
        });
      });
    } catch {
      // table may not exist in some environments — skip
    }
  }

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbVoyageReportFleet(filters = {}) {
  const vesselImoNo = filters.vesselImoNo || '';
  const comId = filters.comId || '';
  if (!vesselImoNo) {
    return { records: [], recordsTotal: 0, isMgmtUser: isMgmtUser() };
  }
  const data = await dbListVoyageReports({
    vesselImoNo,
    comId,
  });
  const list = Array.isArray(data) ? data : (data.records || []);
  const records = list.map((row, index) => ({
    ...row,
    index: row.index ?? index + 1,
  }));
  return {
    records,
    recordsTotal: records.length,
    isMgmtUser: isMgmtUser(),
  };
}

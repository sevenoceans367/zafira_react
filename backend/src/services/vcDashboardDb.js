import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY, parsePeriodDate } from './estimateListMappers.js';

const VC_MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || '6';

function defaultDateRange(fromDate, toDate) {
  const to = toDate ? parsePeriodDate(toDate) : new Date().toISOString().slice(0, 10);
  if (fromDate) {
    return { from: parsePeriodDate(fromDate), to };
  }
  const from = new Date();
  from.setMonth(from.getMonth() - 3);
  return { from: from.toISOString().slice(0, 10), to };
}

function formatNumber(value, decimals = 2) {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  return num.toFixed(decimals);
}

function formatDeliveryDate(value) {
  if (!value) return '';
  const dmy = formatDateDMY(value);
  return dmy === '01-01-1970' ? '' : dmy;
}

async function getVesselName(pool, imoId) {
  if (!imoId) return '';
  const [rows] = await pool.query(
    'SELECT VESSEL_NAME FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? LIMIT 1',
    [imoId],
  );
  return rows[0]?.VESSEL_NAME ?? '';
}

async function getVendorName(pool, code) {
  if (!code) return '';
  const [rows] = await pool.query(
    'SELECT NAME, CODE FROM vendor_master WHERE CODE = ? LIMIT 1',
    [code],
  );
  const row = rows[0];
  if (!row) return String(code);
  return row.CODE ? `${row.NAME}(${row.CODE})` : row.NAME;
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

async function getLoadDischargePorts(pool, fcaId) {
  const [legs] = await pool.query(
    `SELECT FROM_PORT, TO_PORT, LOAD_PORT_QTY, DISC_PORT_QTY
     FROM freight_cost_estimete_slave1 WHERE FCAID = ?`,
    [fcaId],
  );
  const load = [];
  const discharge = [];
  for (const leg of legs) {
    if (Number(leg.LOAD_PORT_QTY) > 0) {
      load.push(await getPortShortName(pool, leg.FROM_PORT));
    }
    if (Number(leg.DISC_PORT_QTY) > 0) {
      discharge.push(await getPortShortName(pool, leg.TO_PORT));
    }
  }
  return {
    load: load.filter(Boolean).join(', '),
    discharge: discharge.filter(Boolean).join(', '),
  };
}

async function getLatestFcaId(pool, comid) {
  const [rows] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ? ORDER BY FCAID DESC LIMIT 1`,
    [comid],
  );
  return rows[0]?.FCAID ?? null;
}

export async function dbGetVcDashboard({ selBType, fromDate, toDate }) {
  const pool = getPool();
  const { from, to } = defaultDateRange(fromDate, toDate);
  const businessType = selBType || '2';

  const [rows] = await pool.query(
    `SELECT c.COMID, m.VESSEL_IMO_ID, m.VOYAGE_NO, m.TRANS_DATE, m.PERIODID
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     WHERE c.MODULEID = ? AND c.MCOMPANYID = ?
       AND c.FINAL_ID != '' AND m.FIXED = 1 AND c.STATUS IN (1)
       AND m.ESTIMATE_TYPE = ?
     ORDER BY DATE(m.FINAL_DATETIME) DESC`,
    [VC_MODULE_ID, appContext.companyId, businessType],
  );

  const chartRows = [];
  const completedRows = [];
  const freightRows = [];
  let freightInitialTotal = 0;
  let freightFinalTotal = 0;

  for (const row of rows) {
    const comid = row.COMID;

    const [[fixtureRow]] = await pool.query(
      `SELECT PROFIT_LOSS FROM freight_cost_estimete_master
       WHERE COMID = ? AND SHEET_NO IS NOT NULL ORDER BY FCAID ASC LIMIT 1`,
      [comid],
    );
    const freightgross = fixtureRow?.PROFIT_LOSS != null
      ? Number(fixtureRow.PROFIT_LOSS) / 1000
      : null;

    const [[interimRow]] = await pool.query(
      `SELECT PROFIT_LOSS FROM freight_cost_estimete_master
       WHERE COMID = ? AND SHEET_NO IS NOT NULL ORDER BY FCAID ASC LIMIT 1 OFFSET 1`,
      [comid],
    );
    const interim = interimRow?.PROFIT_LOSS != null
      ? Number(interimRow.PROFIT_LOSS) / 1000
      : null;

    const [[completionMaster]] = await pool.query(
      `SELECT PROFIT_LOSS, FCAID, TC_DELIVERY_DATE, TC_RE_DELIVERY_DATE
       FROM freight_cost_estimete_master
       WHERE COMID = ? AND SHEET_NO IS NOT NULL ORDER BY FCAID DESC LIMIT 1`,
      [comid],
    );

    const [[paidSum]] = await pool.query(
      `SELECT SUM(P_AMT) AS SUM FROM freight_invoice_master
       WHERE COMID = ? AND DATE(DATE) >= ? AND DATE(DATE) <= ? AND STATUS <= 5`,
      [comid, from, to],
    );

    let completion = null;
    if (Number(paidSum?.SUM) > 0 && completionMaster?.PROFIT_LOSS != null) {
      completion = Number(completionMaster.PROFIT_LOSS) / 1000;
    }

    const [[interimInv]] = await pool.query(
      `SELECT SUM(P_AMT) AS SUM, SUM(NET_PAYABLE_TAX) AS SUM2, I_TYPE
       FROM freight_invoice_master
       WHERE COMID = ? AND DATE(DATE) >= ? AND DATE(DATE) <= ?
         AND STATUS = 5 AND I_TYPE = 'Interim'`,
      [comid, from, to],
    );

    const [[finalInv]] = await pool.query(
      `SELECT SUM(P_AMT) AS SUM, SUM(NET_PAYABLE_TAX) AS SUM2, I_TYPE
       FROM freight_invoice_master
       WHERE COMID = ? AND DATE(DATE) >= ? AND DATE(DATE) <= ?
         AND STATUS = 5 AND I_TYPE = 'Final'`,
      [comid, from, to],
    );

    let freightamt = 0;
    let freightamt1 = 0;
    if (interimInv?.I_TYPE === 'Interim' && finalInv?.I_TYPE === 'Final') {
      freightamt = 0;
      freightamt1 = (Number(finalInv.SUM2 || 0) - Number(finalInv.SUM || 0))
        + (Number(interimInv.SUM2 || 0) - Number(interimInv.SUM || 0));
    } else {
      freightamt = Number(interimInv?.SUM2 || 0) - Number(interimInv?.SUM || 0);
      freightamt1 = Number(finalInv?.SUM2 || 0) - Number(finalInv?.SUM || 0);
    }

    if (freightamt > 1000 || freightamt1 > 1000) {
      const [vendors] = await pool.query(
        `SELECT DISTINCT VENDOR FROM freight_invoice_master
         WHERE COMID = ? AND DATE(DATE) >= ? AND DATE(DATE) <= ?
           AND STATUS = 5 AND I_TYPE IN ('Interim', 'Final')`,
        [comid, from, to],
      );
      const chartererNames = [];
      for (const vendor of vendors) {
        chartererNames.push(await getVendorName(pool, vendor.VENDOR));
      }
      freightInitialTotal += freightamt;
      freightFinalTotal += freightamt1;
      freightRows.push({
        voyage: row.VOYAGE_NO,
        vessel: await getVesselName(pool, row.VESSEL_IMO_ID),
        charterer: chartererNames.join(', '),
        initialFreight: formatNumber(freightamt),
        finalFreight: formatNumber(freightamt1),
      });
    }

    const [[hireCount]] = await pool.query(
      `SELECT COUNT(*) AS count FROM invoice_hire_master
       WHERE COMID = ? AND INVOICE_TYPE = 'Final'`,
      [comid],
    );

    if (Number(hireCount?.count) === 0 && completionMaster?.FCAID) {
      const ports = await getLoadDischargePorts(pool, completionMaster.FCAID);
      const vesselName = await getVesselName(pool, row.VESSEL_IMO_ID);
      const delivery = formatDeliveryDate(completionMaster.TC_DELIVERY_DATE);
      const redelivery = formatDeliveryDate(completionMaster.TC_RE_DELIVERY_DATE);
      const cpDate = formatDateDMY(row.TRANS_DATE);
      const cpTimestamp = row.TRANS_DATE ? new Date(row.TRANS_DATE).getTime() : 0;

      const chartItem = {
        vessel: vesselName,
        voyageNo: row.VOYAGE_NO,
        fixture: formatNumber(freightgross),
        interim: formatNumber(interim),
        completion: formatNumber(completion),
        fixtureValue: freightgross ?? 0,
        interimValue: interim ?? 0,
        completionValue: completion ?? 0,
      };
      chartRows.push(chartItem);

      completedRows.push({
        vessel: vesselName,
        voyageNo: row.VOYAGE_NO,
        cpDate,
        cpDateSort: cpTimestamp,
        voyage: `${ports.load.toUpperCase()} / ${ports.discharge.toUpperCase()}`,
        deliveryRedelivery: [delivery, redelivery].filter(Boolean).join(' - '),
        fixture: chartItem.fixture,
        interim: chartItem.interim,
        completion: chartItem.completion,
      });
    }
  }

  completedRows.sort((a, b) => b.cpDateSort - a.cpDateSort);

  let overview = { onSubs: 0, inProgress: 0, completed: 0 };
  try {
    overview = await dbGetSpotBusinessOverview({ selBType: businessType, fromDate, toDate });
  } catch (error) {
    console.error(error);
  }

  return {
    recordCount: rows.length,
    chartRows,
    completedRows,
    freightRows,
    freightTotals: {
      initial: formatNumber(freightInitialTotal),
      final: formatNumber(freightFinalTotal),
    },
    overview,
  };
}

/**
 * Spot Business Overview counts (voyage counts, not invented USD).
 * On Subs: SOPF estimate grid rows that still have Replicate + Send to Ops (no COMID).
 * In Progress: Ops VC In Ops (STATUS=1) + Post Ops (STATUS=2).
 * Completed: Ops VC History (STATUS 3 or 4).
 */
export async function dbGetSpotBusinessOverview({ selBType, fromDate, toDate } = {}) {
  const pool = getPool();
  const businessType = selBType || '2';
  const moduleId = VC_MODULE_ID;
  const companyId = appContext.companyId;
  const from = fromDate ? parsePeriodDate(fromDate) : null;
  const to = toDate ? parsePeriodDate(toDate) : null;

  const subsParams = [moduleId, companyId, businessType];
  let subsPeriod = '';
  if (from) {
    subsPeriod += ' AND DATE(m.TRANS_DATE) >= ?';
    subsParams.push(from);
  }
  if (to) {
    subsPeriod += ' AND DATE(m.TRANS_DATE) <= ?';
    subsParams.push(to);
  }

  const [[subsRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM freight_cost_estimete_master m
     WHERE m.MODULEID = ?
       AND m.MCOMPANYID = ?
       AND m.ESTIMATE_TYPE = ?
       AND m.COAID IS NULL
       AND m.FIXED = 0
       AND (m.COMID IS NULL OR m.COMID = '' OR m.COMID = 0)
       ${subsPeriod}`,
    subsParams,
  );

  const opsParams = [moduleId, companyId, businessType];
  const [[opsRow]] = await pool.query(
    `SELECT
       SUM(CASE WHEN c.STATUS IN (1, 2) THEN 1 ELSE 0 END) AS inProgress,
       SUM(CASE WHEN c.STATUS IN (3, 4) THEN 1 ELSE 0 END) AS completed
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND m.ESTIMATE_TYPE = ?
       AND c.COAAID IS NULL
       AND c.STATUS IN (1, 2, 3, 4)`,
    opsParams,
  );

  return {
    onSubs: Number(subsRow?.total || 0),
    inProgress: Number(opsRow?.inProgress || 0),
    completed: Number(opsRow?.completed || 0),
  };
}

export async function dbGetTcDashboard({ selBType, fromDate, toDate }) {
  const pool = getPool();
  const { from, to } = defaultDateRange(fromDate, toDate);
  const businessType = selBType || '2';

  const [rows] = await pool.query(
    `SELECT c.COMID, m.VESSEL_IMO_ID, m.DEL_DATE, m.RE_DEL_DATE, m.CP_DATE1,
            m.TC_NO, c.MESSAGE
     FROM chartering_estimate_tc_compare c
     INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
     WHERE c.MODULEID = ? AND c.MCOMPANYID = ?
       AND c.FINAL_ID != '' AND m.FIXED = 1 AND m.ESTIMATE_TYPE = ?
       AND c.STATUS IN (1)
     ORDER BY DATE(m.FINAL_DATETIME) DESC`,
    [VC_MODULE_ID, appContext.companyId, businessType],
  );

  const chartRows = [];
  const completedRows = [];
  const hireRows = [];
  const otherRows = [];
  let hireTotal = 0;
  let otherTotal = 0;

  for (const row of rows) {
    const comid = row.COMID;

    const [[fixtureRow]] = await pool.query(
      `SELECT (SELECT SUM(VOYAGE_EARN_EST) FROM chartering_tc_estimate_slave1 s
               WHERE s.TCOUTID = m.TCOUTID) AS EARNING
       FROM chartering_estimate_tc_master m
       WHERE m.COMID = ? AND m.SHEET_NO IS NULL ORDER BY m.TCOUTID ASC LIMIT 1`,
      [comid],
    );
    const freightgross = fixtureRow?.EARNING != null ? Number(fixtureRow.EARNING) / 1000 : null;

    const [[interimRow]] = await pool.query(
      `SELECT (SELECT SUM(VOYAGE_EARN_EST) FROM chartering_tc_estimate_slave1 s
               WHERE s.TCOUTID = m.TCOUTID) AS EARNING
       FROM chartering_estimate_tc_master m
       WHERE m.COMID = ? AND m.SHEET_NO IS NOT NULL AND m.FINAL_STATUS = 1 LIMIT 1`,
      [comid],
    );
    const interim = interimRow?.EARNING != null ? Number(interimRow.EARNING) / 1000 : null;

    const [[completionRow]] = await pool.query(
      `SELECT (SELECT SUM(VOYAGE_EARN_EST) FROM chartering_tc_estimate_slave1 s
               WHERE s.TCOUTID = m.TCOUTID) AS EARNING,
              (SELECT SUM(NET_HIRE_AMT) FROM chartering_tc_estimate_slave1 s
               WHERE s.TCOUTID = m.TCOUTID) AS NET_HIRE_AMT
       FROM chartering_estimate_tc_master m
       WHERE m.COMID = ? AND m.SHEET_NO IS NOT NULL ORDER BY m.TCOUTID DESC LIMIT 1`,
      [comid],
    );

    const [[paidSum]] = await pool.query(
      `SELECT SUM(P_AMT) AS SUM FROM invoice_tchire_master
       WHERE COMID = ? AND DATE(INVOICE_DATE) >= ? AND DATE(INVOICE_DATE) <= ? AND STATUS <= 5`,
      [comid, from, to],
    );

    let completion = null;
    if (Number(paidSum?.SUM) === Number(completionRow?.NET_HIRE_AMT)
      && completionRow?.EARNING != null) {
      completion = Number(completionRow.EARNING) / 1000;
    }

    const [otherInvoices] = await pool.query(
      `SELECT P_AMT, FINAL_AMOUNT, SHORT_DESC FROM invoice_tcother_master
       WHERE COMID = ? AND STATUS <= 5
         AND DATE(INVOICE_DATE) >= ? AND DATE(INVOICE_DATE) <= ?`,
      [comid, from, to],
    );
    for (const inv of otherInvoices) {
      const otherinv = Number(inv.FINAL_AMOUNT || 0) - Number(inv.P_AMT || 0);
      if (otherinv > 1000) {
        otherTotal += otherinv;
        otherRows.push({
          tcNo: row.TC_NO,
          vessel: `${await getVesselName(pool, row.VESSEL_IMO_ID)}(${row.MESSAGE || ''})`,
          otherInvoiceType: inv.SHORT_DESC,
          amount: formatNumber(otherinv),
        });
      }
    }

    const [hireInvoices] = await pool.query(
      `SELECT P_AMT, NET_PAYABLE_TAX, RANDOMID, HIRE_DAYS, OLD_EXCHANGE_RATE
       FROM invoice_tchire_master
       WHERE COMID = ? AND STATUS = 5
         AND (INVOICE_TYPE != 'PFHS' OR INVOICE_TYPE != 'FHS-2')
         AND DATE(INVOICE_DATE) >= ? AND DATE(INVOICE_DATE) <= ?`,
      [comid, from, to],
    );

    for (const inv of hireInvoices) {
      const rate = Number(inv.OLD_EXCHANGE_RATE) !== 0
        ? Number(inv.OLD_EXCHANGE_RATE)
        : 1;
      const hireamt = (rate * Number(inv.NET_PAYABLE_TAX || 0)) - (rate * Number(inv.P_AMT || 0));
      if (hireamt > 100) {
        hireTotal += hireamt;
        const [[vendorRow]] = await pool.query(
          `SELECT TTL_REV_VENDOR FROM chartering_tc_estimate_slave1 s
           INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = s.TCOUTID
           WHERE m.COMID = ? AND s.RANDOMID = ?
           ORDER BY m.TCOUTID DESC LIMIT 1`,
          [comid, inv.RANDOMID],
        );
        hireRows.push({
          tcNo: row.TC_NO,
          vessel: `${await getVesselName(pool, row.VESSEL_IMO_ID)}(${row.TC_NO})`,
          customer: await getVendorName(pool, vendorRow?.TTL_REV_VENDOR),
          amount: formatNumber(hireamt),
        });
      }
    }

    const [[hireCount]] = await pool.query(
      `SELECT COUNT(*) AS count FROM invoice_hiretc_master
       WHERE COMID = ? AND INVOICE_TYPE = 'Final'`,
      [comid],
    );

    if (Number(hireCount?.count) === 0) {
      const delivery = formatDeliveryDate(row.DEL_DATE);
      const redelivery = formatDeliveryDate(row.RE_DEL_DATE);
      const vesselName = await getVesselName(pool, row.VESSEL_IMO_ID);
      const cpDate = formatDateDMY(row.CP_DATE1);
      const cpTimestamp = row.CP_DATE1 ? new Date(row.CP_DATE1).getTime() : 0;

      chartRows.push({
        tcNo: row.TC_NO,
        vessel: vesselName,
        fixture: formatNumber(freightgross),
        interim: formatNumber(interim),
        completion: formatNumber(completion),
        fixtureValue: freightgross ?? 0,
        interimValue: interim ?? 0,
        completionValue: completion ?? 0,
      });

      completedRows.push({
        tcNo: row.TC_NO,
        vessel: vesselName,
        cpDate,
        cpDateSort: cpTimestamp,
        deliveryRedelivery: [delivery, redelivery].filter(Boolean).join(' - '),
        fixture: formatNumber(freightgross),
        interim: formatNumber(interim),
        completion: formatNumber(completion),
      });
    }
  }

  completedRows.sort((a, b) => b.cpDateSort - a.cpDateSort);

  return {
    recordCount: rows.length,
    chartRows,
    completedRows,
    hireRows,
    otherRows,
    hireTotal: formatNumber(hireTotal),
    otherTotal: formatNumber(otherTotal),
  };
}

export async function dbGetCoaList({
  selBType,
  fromDate,
  toDate,
  page = 1,
  pageSize = 10,
  search = '',
  sortColumn = 1,
  sortDir = 'desc',
}) {
  const pool = getPool();
  const businessType = selBType || '2';
  const offset = (Math.max(1, page) - 1) * pageSize;
  const sortColumns = [
    'COAID', 'COA_ROUTE', 'COA_ID', 'COA_NO', 'COA_DATE', 'VESSEL_TYPE',
    'CHARTERER', 'CARGO', 'MIN_GUARANTEED_QTY', 'COA_DURATION',
    'TOTAL_SHIPMENTS', 'LEGS',
  ];
  const orderCol = sortColumns[sortColumn] || 'COAID';
  const orderDir = sortDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['MCOMPANYID = ?', 'BUSINESSTYPEID = ?'];
  const params = [appContext.companyId, businessType];

  if (fromDate && toDate) {
    conditions.push('COA_DATE >= ? AND COA_DATE <= ?');
    params.push(parsePeriodDate(fromDate), parsePeriodDate(toDate));
  }

  if (search) {
    conditions.push(`(
      COA_ROUTE LIKE ? OR COA_ID LIKE ? OR COA_NO LIKE ? OR CHARTERER LIKE ?
      OR CARGO LIKE ? OR VESSEL_TYPE LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  const where = conditions.join(' AND ');

  const baseSelect = `
    SELECT COAID, COA_ID, COA_NO, COA_DATE, COA_DURATION, MIN_GUARANTEED_QTY, TOTAL_SHIPMENTS,
           (SELECT COAROUTE_NAME FROM coaroute_master WHERE coaroute_master.COAROUTEID = coa_master.COA_ROUTE) AS COA_ROUTE,
           (SELECT VesselType FROM vessel_type_master WHERE vessel_type_master.VesselTypeId = coa_master.VESSEL_TYPE) AS VESSEL_TYPE,
           (SELECT CONCAT(NAME, '(', CODE, ')') FROM vendor_master WHERE vendor_master.CODE = coa_master.CHARTERER) AS CHARTERER,
           (SELECT CONCAT(MATERIAL_CODE_DESC, '(', MATERIAL_CODE, ')') FROM cargo_master WHERE cargo_master.MATERIALID = coa_master.CARGO) AS CARGO,
           (SELECT COUNT(*) FROM freight_cost_estimate_compare WHERE freight_cost_estimate_compare.COAAID = coa_master.COAID) AS LEGS_VC,
           (SELECT COUNT(*) FROM cargo_relet_estimate_compare WHERE cargo_relet_estimate_compare.COAAID = coa_master.COAID) AS LEGS_RELET,
           (SELECT GROUP_CONCAT(COMID) FROM freight_cost_estimate_compare WHERE freight_cost_estimate_compare.COAAID = coa_master.COAID) AS COMID_VC,
           (SELECT GROUP_CONCAT(COMID) FROM cargo_relet_estimate_compare WHERE cargo_relet_estimate_compare.COAAID = coa_master.COAID) AS COMID_RELET
    FROM coa_master
    WHERE ${where}`;

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM coa_master WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `${baseSelect} ORDER BY ${orderCol} ${orderDir} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const records = [];
  let index = offset;
  for (const row of rows) {
    index += 1;
    let cargoMt = 0;
    if (row.COMID_VC) {
      for (const comid of String(row.COMID_VC).split(',')) {
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
      for (const comid of String(row.COMID_RELET).split(',')) {
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
      shipmentsPerformed: Number(row.LEGS_VC || 0) + Number(row.LEGS_RELET || 0),
      balanceCargo: formatNumber(Number(row.MIN_GUARANTEED_QTY || 0) - cargoMt),
    });
  }

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    page,
    pageSize,
  };
}

export async function dbGetPeriodList({
  selBType,
  page = 1,
  pageSize = 10,
  search = '',
  sortColumn = 1,
  sortDir = 'desc',
}) {
  const pool = getPool();
  const businessType = selBType || '2';
  const offset = (Math.max(1, page) - 1) * pageSize;
  const sortColumns = [
    'PERIODID', 'CONTRACT_ID', 'CONTRACT_NO', 'CONTRACT_DATE',
    'VESSEL_IMO_ID', 'OWN_BUSINESS_ACCOUNT', 'WORKING_CURRENCY',
  ];
  const orderCol = sortColumns[sortColumn] || 'PERIODID';
  const orderDir = sortDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['MCOMPANYID = ?', 'BUSINESSTYPE = ?'];
  const params = [appContext.companyId, businessType];

  if (search) {
    conditions.push(`(
      CONTRACT_ID LIKE ? OR CONTRACT_NO LIKE ? OR CONTRACT_DATE LIKE ?
      OR OWN_BUSINESS_ACCOUNT LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.join(' AND ');

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM period_contract_master WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT PERIODID, CONTRACT_ID, CONTRACT_NO, CONTRACT_DATE, DELIVERY_DATE, RE_DEL_MAX_DATE,
            WORKING_CURRENCY,
            (SELECT VESSEL_NAME FROM vessel_imo_master WHERE vessel_imo_master.VESSEL_IMO_ID = period_contract_master.VESSEL_IMO_ID) AS VESSEL_NAME,
            (SELECT CONCAT(NAME, '(', CODE, ')') FROM vendor_master WHERE vendor_master.CODE = period_contract_master.OWN_BUSINESS_ACCOUNT) AS OWN_BUSINESS_ACCOUNT
     FROM period_contract_master
     WHERE ${where}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const records = [];
  let index = offset;
  for (const row of rows) {
    index += 1;
    const totalDays = row.DELIVERY_DATE && row.RE_DEL_MAX_DATE
      ? (new Date(row.RE_DEL_MAX_DATE) - new Date(row.DELIVERY_DATE)) / (1000 * 60 * 60 * 24)
      : 0;

    let performedDays = 0;

    const [tcRows] = await pool.query(
      `SELECT (SELECT TCOUTID FROM chartering_estimate_tc_master m
               WHERE m.COMID = c.COMID ORDER BY m.TCOUTID DESC LIMIT 1) AS TCOUTID
       FROM chartering_estimate_tc_compare c
       INNER JOIN chartering_estimate_tc_master m ON m.COMID = c.COMID
       WHERE m.PERIODID = ? AND c.FINAL_ID != '' AND m.FIXED = 1
       GROUP BY m.COMID`,
      [row.PERIODID],
    );
    for (const tc of tcRows) {
      if (!tc.TCOUTID) continue;
      const [[sumRow]] = await pool.query(
        `SELECT SUM(TC_DAYS_EST) AS SUM FROM chartering_tc_estimate_slave1 WHERE TCOUTID = ?`,
        [tc.TCOUTID],
      );
      performedDays += Number(sumRow?.SUM || 0);
    }

    const [vcRows] = await pool.query(
      `SELECT (SELECT TOTAL_DAYS FROM freight_cost_estimete_master m
               WHERE m.COMID = c.COMID ORDER BY m.FCAID DESC LIMIT 1) AS TOTAL_DAYS
       FROM freight_cost_estimate_compare c
       INNER JOIN freight_cost_estimete_master m ON m.COMID = c.COMID
       WHERE m.PERIODID = ? AND c.FINAL_ID != '' AND m.FIXED = 1
       GROUP BY m.COMID`,
      [row.PERIODID],
    );
    for (const vc of vcRows) {
      performedDays += Number(vc.TOTAL_DAYS || 0);
    }

    const [[vcShipCount]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM freight_cost_estimate_compare c
       INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
       WHERE c.MODULEID = ? AND c.MCOMPANYID = ? AND c.FINAL_ID != ''
         AND m.FIXED = 1 AND m.ESTIMATE_TYPE = ? AND m.PERIODID = ?`,
      [VC_MODULE_ID, appContext.companyId, businessType, row.PERIODID],
    );

    const [[tcShipCount]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM chartering_estimate_tc_compare c
       INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
       WHERE c.MODULEID = ? AND c.MCOMPANYID = ? AND c.FINAL_ID != ''
         AND m.FIXED = 1 AND m.PERIODID = ?`,
      [VC_MODULE_ID, appContext.companyId, row.PERIODID],
    );

    records.push({
      index,
      periodId: row.PERIODID,
      contractId: row.CONTRACT_ID ?? '',
      contractNo: row.CONTRACT_NO ?? '',
      contractDate: formatDateDMY(row.CONTRACT_DATE),
      vesselName: row.VESSEL_NAME ?? '',
      ownBusinessAccount: row.OWN_BUSINESS_ACCOUNT ?? '',
      workingCurrency: row.WORKING_CURRENCY ?? '',
      totalDays: formatNumber(totalDays, 5),
      performedDays: String(performedDays),
      balanceDays: formatNumber(totalDays - performedDays, 5),
      vcShipments: Number(vcShipCount?.total || 0),
      tcShipments: Number(tcShipCount?.total || 0),
    });
  }

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    page,
    pageSize,
  };
}

export async function dbGetCoaShipments(coaId) {
  const pool = getPool();
  const [[coa]] = await pool.query(
    'SELECT COA_ID, COA_NO, CURRENCY FROM coa_master WHERE COAID = ? LIMIT 1',
    [coaId],
  );
  if (!coa) return { coaLabel: '', currency: '', rows: [] };

  const [rows] = await pool.query(
    `SELECT c.COMID, c.MESSAGE, m.VESSEL_IMO_ID, m.VOYAGE_NO, m.TRANS_DATE,
            m.TOTAL_DAYS, m.DAILY_EARNING, m.PROFIT_LOSS, m.VESSEL_TYPE
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     WHERE c.FINAL_ID != '' AND m.FIXED = 1 AND c.COAAID = ?
     ORDER BY DATE(m.TRANS_DATE) DESC`,
    [coaId],
  );

  const shipments = [];
  let index = 0;
  for (const row of rows) {
    index += 1;
    const fcaId = await getLatestFcaId(pool, row.COMID);
    const ports = fcaId ? await getLoadDischargePorts(pool, fcaId) : { load: '', discharge: '' };
    const [[qtyRow]] = fcaId
      ? await pool.query(
        `SELECT SUM(CARGO_MT) AS SUM FROM freight_cost_estimete_slave10
         WHERE FCAID = ? AND STATUS != 3`,
        [fcaId],
      )
      : [[{ SUM: null }]];

    shipments.push({
      index,
      vesselName: await getVesselName(pool, row.VESSEL_IMO_ID),
      vesselType: row.VESSEL_TYPE ?? '',
      coaIdentity: coa.COA_ID ?? '',
      voyageNo: row.VOYAGE_NO ?? '',
      cpDate: formatDateDMY(row.TRANS_DATE),
      ports: `${ports.load} / ${ports.discharge}`,
      duration: row.TOTAL_DAYS ?? '',
      cargoQty: qtyRow?.SUM ?? '',
      tce: row.DAILY_EARNING ?? '',
      profitLoss: row.PROFIT_LOSS ?? '',
      message: row.MESSAGE ?? '',
    });
  }

  return {
    coaLabel: `${coa.COA_ID} - Performed Shipments`,
    currency: coa.CURRENCY ?? 'USD',
    rows: shipments,
  };
}

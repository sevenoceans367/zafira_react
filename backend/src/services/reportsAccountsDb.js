import { appContext, isMgmtUser } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY, parsePeriodDate } from './estimateListMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function safeDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted.startsWith('01-01-1970')) return '';
  return formatted;
}

function estimateTypeFilter(selBType, alias = 'm') {
  const value = String(selBType || '').trim();
  if (!value) return { sql: '', params: [] };
  return { sql: ` AND ${alias}.ESTIMATE_TYPE = ? `, params: [value] };
}

function coaSpotClause(selCOASpot, masterAlias = 'm', compareAlias = 'c') {
  // PHP sometimes uses master.COAID; compare uses COAAID — support both patterns via compare
  if (String(selCOASpot) === '2') return ` AND ${compareAlias}.COAAID IS NOT NULL `;
  if (String(selCOASpot) === '1') return ` AND ${compareAlias}.COAAID IS NULL `;
  return '';
}

function agingDateRange(selDateType) {
  const type = String(selDateType || '1');
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  };
  if (type === '2') return { mode: 'between', from: iso(daysAgo(30)), to: iso(today) };
  if (type === '3') return { mode: 'between', from: iso(daysAgo(60)), to: iso(daysAgo(30)) };
  if (type === '4') return { mode: 'between', from: iso(daysAgo(90)), to: iso(daysAgo(60)) };
  if (type === '5') return { mode: 'before', from: iso(daysAgo(90)) };
  return { mode: 'all' };
}

function delayDays(invoiceDate) {
  if (!invoiceDate) return '';
  const t = new Date(invoiceDate).getTime();
  if (Number.isNaN(t)) return '';
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

async function vendorName(pool, code) {
  if (!code) return '';
  const [[row]] = await pool.query(
    'SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1',
    [code],
  );
  return row?.NAME || '';
}

async function companyName(pool) {
  const [[row]] = await pool.query(
    'SELECT COMPANY_NAME FROM company_master WHERE COMPANYID = ? LIMIT 1',
    [COMPANY_ID],
  );
  return row?.COMPANY_NAME || '';
}

async function listVcVoyages(pool, { selBType, selCOASpot } = {}) {
  const typeFilter = estimateTypeFilter(selBType);
  const [rows] = await pool.query(
    `SELECT c.COMID, c.MESSAGE, c.COAAID, c.STATUS,
            m.FCAID, m.VESSEL_IMO_ID, m.TRANS_DATE, m.CP_DATE, m.VOYAGE_NO, m.VOYAGE_NAME,
            m.ESTIMATE_TYPE, m.QUANTITY, m.GAS_QUANTITY, m.TANK_QUANTITY, m.QTY_TYPE_RADIO,
            m.REVENUES_FREIGHT, m.ACTUAL_PL, m.DAILY_EARNING, m.VOYAGE_EARNING,
            m.BUNKER_EXPENSES, m.PORT_EXPENSES, m.CARGO_ID, m.BL_DATE,
            v.VESSEL_NAME
     FROM freight_cost_estimate_compare c
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       AND c.STATUS IN (1, 2)
       ${typeFilter.sql}
       ${coaSpotClause(selCOASpot)}
     GROUP BY c.COMID
     ORDER BY c.COMID DESC`,
    [MODULE_ID, COMPANY_ID, ...typeFilter.params],
  );
  return rows;
}

export async function dbAccountsFilterExtras() {
  return {
    daySelections: [
      { id: '1', name: 'All' },
      { id: '2', name: '0 - 30 Days' },
      { id: '3', name: '30 - 60 Days' },
      { id: '4', name: '60 - 90 Days' },
      { id: '5', name: '> 90 Days' },
    ],
    spotCoaTcOptions: [
      { id: '1', name: 'Spot' },
      { id: '2', name: 'COA' },
      { id: '3', name: 'TC' },
    ],
    amountTypes: [
      { id: '1', name: 'ETA' },
      { id: '2', name: 'ETC/D' },
    ],
    shipmentDateTypes: [
      { id: '1', name: 'BL Date' },
      { id: '2', name: 'Financial Year (CP Date)' },
    ],
  };
}

export async function dbAgingPayableReport(filters = {}) {
  const pool = getPool();
  const voyages = await listVcVoyages(pool, {
    selBType: filters.selBType,
    selCOASpot: filters.selCOASpot || '1',
  });
  const range = agingDateRange(filters.selDateType);
  const vendor = String(filters.selVendor || '').trim();
  const coaLabel = String(filters.selCOASpot) === '2' ? 'COA' : 'Spot';
  const records = [];
  let srNo = 0;

  for (const voy of voyages) {
    const params = [voy.COMID];
    let sql = `SELECT REQ_ID, VENDOR, NAME, PAYMENT_NO, INVOICE_DATE, P_DATE, NET_AMT, P_AMT, NAME_ID
               FROM request_master WHERE COMID = ?`;
    if (vendor) {
      sql += ' AND VENDOR = ?';
      params.push(vendor);
    }
    if (range.mode === 'between') {
      sql += ' AND INVOICE_DATE BETWEEN ? AND ?';
      params.push(range.from, range.to);
    } else if (range.mode === 'before') {
      sql += ' AND INVOICE_DATE < ?';
      params.push(range.from);
    }
    const [reqs] = await pool.query(sql, params);
    for (const req of reqs) {
      const invoiced = Number(req.NET_AMT) || 0;
      const paid = Number(req.P_AMT) || 0;
      srNo += 1;
      records.push({
        id: `${voy.COMID}-${req.REQ_ID}`,
        srNo,
        vendor: await vendorName(pool, req.VENDOR),
        coaSpot: coaLabel,
        nomId: `${voy.MESSAGE || ''}/${voy.VOYAGE_NO || ''}`,
        vesselName: voy.VESSEL_NAME || '',
        cpDate: safeDate(voy.TRANS_DATE || voy.CP_DATE),
        costType: req.NAME || '',
        paymentNo: req.PAYMENT_NO || '',
        invoiceDate: safeDate(req.INVOICE_DATE),
        paymentDate: safeDate(req.P_DATE),
        amountInvoiced: invoiced ? invoiced.toFixed(2) : '',
        amountPaid: paid ? paid.toFixed(2) : '',
        difference: (invoiced - paid).toFixed(2),
        delayDays: delayDays(req.INVOICE_DATE),
      });
    }
  }

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbAgingReceivablesReport(filters = {}) {
  const pool = getPool();
  const spotCoa = String(filters.selSpotCOA || filters.selCOASpot || '1');
  const range = agingDateRange(filters.selDateType);
  const vendor = String(filters.selVendor || '').trim();
  const records = [];
  let srNo = 0;

  if (spotCoa === '3') {
    const [rows] = await pool.query(
      `SELECT c.COMID, c.MESSAGE, m.TC_NO, m.CP_DATE1, v.VESSEL_NAME
       FROM chartering_estimate_tc_compare c
       INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
       LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
       WHERE c.MODULEID = ? AND c.MCOMPANYID = ?
         AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
         AND m.FIXED = 1 AND c.STATUS IN (1, 2)
       GROUP BY c.COMID
       ORDER BY c.COMID DESC`,
      [MODULE_ID, COMPANY_ID],
    );
    for (const voy of rows) {
      const params = [voy.COMID];
      let sql = `SELECT INVOICEID, INVOICE_NO, INVOICE_DATE, NET_PAYABLE_TAX, P_AMT, STATUS
                 FROM invoice_tchire_master WHERE COMID = ?`;
      if (range.mode === 'between') {
        sql += ' AND INVOICE_DATE BETWEEN ? AND ?';
        params.push(range.from, range.to);
      } else if (range.mode === 'before') {
        sql += ' AND INVOICE_DATE < ?';
        params.push(range.from);
      }
      try {
        const [invoices] = await pool.query(sql, params);
        for (const inv of invoices) {
          const invoiced = Number(inv.NET_PAYABLE_TAX) || 0;
          const received = Number(inv.P_AMT) || 0;
          const diff = invoiced - received;
          srNo += 1;
          records.push({
            id: `tc-${voy.COMID}-${inv.INVOICEID}`,
            srNo,
            client: '',
            spotCoaTc: 'TC',
            nomId: `${voy.MESSAGE || ''}/${voy.TC_NO || ''}`,
            vesselName: voy.VESSEL_NAME || '',
            cpDate: safeDate(voy.CP_DATE1),
            invoiceType: 'TC Hire',
            invoiceNo: inv.INVOICE_NO || '',
            invoiceDate: safeDate(inv.INVOICE_DATE),
            amountInvoiced: invoiced ? invoiced.toFixed(2) : '',
            amountReceived: received ? received.toFixed(2) : '',
            difference: diff.toFixed(2),
            delayDays: delayDays(inv.INVOICE_DATE),
            openClosed: Math.abs(diff) < 1 ? 'Closed' : 'Open',
          });
        }
      } catch {
        // table may be missing
      }
    }
  } else {
    const voyages = await listVcVoyages(pool, {
      selBType: filters.selBType,
      selCOASpot: spotCoa,
    });
    for (const voy of voyages) {
      const params = [voy.COMID];
      let sql = `SELECT INVOICEID, MESSAGE, DATE, NET_AMOUNT, NET_PAYABLE_TAX, P_AMT, VENDOR, I_TYPE, STATUS
                 FROM freight_invoice_master WHERE COMID = ?`;
      if (vendor) {
        sql += ' AND VENDOR = ?';
        params.push(vendor);
      }
      if (range.mode === 'between') {
        sql += ' AND DATE BETWEEN ? AND ?';
        params.push(range.from, range.to);
      } else if (range.mode === 'before') {
        sql += ' AND DATE < ?';
        params.push(range.from);
      }
      const [invoices] = await pool.query(sql, params);
      for (const inv of invoices) {
        const invoiced = Number(inv.NET_PAYABLE_TAX || inv.NET_AMOUNT) || 0;
        const received = Number(inv.P_AMT) || 0;
        const diff = invoiced - received;
        srNo += 1;
        records.push({
          id: `vc-${voy.COMID}-${inv.INVOICEID}`,
          srNo,
          client: await vendorName(pool, inv.VENDOR),
          spotCoaTc: String(spotCoa) === '2' ? 'COA' : 'Spot',
          nomId: `${voy.MESSAGE || ''}/${voy.VOYAGE_NO || ''}`,
          vesselName: voy.VESSEL_NAME || '',
          cpDate: safeDate(voy.TRANS_DATE || voy.CP_DATE),
          invoiceType: inv.I_TYPE || 'Freight',
          invoiceNo: inv.MESSAGE || '',
          invoiceDate: safeDate(inv.DATE),
          amountInvoiced: invoiced ? invoiced.toFixed(2) : '',
          amountReceived: received ? received.toFixed(2) : '',
          difference: diff.toFixed(2),
          delayDays: delayDays(inv.DATE),
          openClosed: Math.abs(diff) < 1 ? 'Closed' : 'Open',
        });
      }
    }
  }

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbPayableReceivablesReport(filters = {}) {
  const pool = getPool();
  const vendor = String(filters.selVendor || '').trim();
  if (!vendor) {
    const error = new Error('Please select Vendor/Client.');
    error.status = 400;
    throw error;
  }
  const spotCoa = String(filters.selSpotCOA || filters.selCOASpot || '1');
  const voyageFilter = String(filters.selVoyageNo || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x && x !== 'null');

  const records = [];
  let srNo = 0;
  const clientLabel = await vendorName(pool, vendor);

  if (spotCoa === '3') {
    const [voyages] = await pool.query(
      `SELECT c.COMID, c.MESSAGE, m.TC_NO AS VOYAGE_NO, v.VESSEL_NAME
       FROM chartering_estimate_tc_compare c
       INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
       LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
       WHERE c.MODULEID = ? AND c.MCOMPANYID = ?
         AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
         AND m.FIXED = 1 AND c.STATUS IN (1, 2)
       GROUP BY c.COMID
       ORDER BY c.COMID DESC`,
      [MODULE_ID, COMPANY_ID],
    );
    const list = voyageFilter.length
      ? voyages.filter((v) => voyageFilter.includes(String(v.COMID)))
      : voyages;
    for (const voy of list) {
      const [[recv]] = await pool.query(
        `SELECT COALESCE(SUM(COALESCE(NET_PAYABLE_TAX, 0)), 0) AS invoiced,
                COALESCE(SUM(COALESCE(P_AMT, 0)), 0) AS received
         FROM invoice_tchire_master WHERE COMID = ?`,
        [voy.COMID],
      ).catch(() => [[{ invoiced: 0, received: 0 }]]);
      const [[pay]] = await pool.query(
        `SELECT COALESCE(SUM(COALESCE(NET_AMT, 0)), 0) AS advice,
                COALESCE(SUM(COALESCE(P_AMT, 0)), 0) AS paid
         FROM request_mastertc WHERE COMID = ? AND VENDOR = ?`,
        [voy.COMID, vendor],
      ).catch(() => [[{ advice: 0, paid: 0 }]]);
      const invoiced = Number(recv?.invoiced) || 0;
      const received = Number(recv?.received) || 0;
      const advice = Number(pay?.advice) || 0;
      const paid = Number(pay?.paid) || 0;
      if (!invoiced && !received && !advice && !paid) continue;
      srNo += 1;
      records.push({
        id: voy.COMID,
        srNo,
        client: clientLabel,
        spotCoaTc: 'TC',
        nomId: `${voy.MESSAGE || ''}/${voy.VOYAGE_NO || ''}`,
        vesselName: voy.VESSEL_NAME || '',
        amountInvoiced: invoiced.toFixed(2),
        amountReceived: received.toFixed(2),
        recvDifference: (invoiced - received).toFixed(2),
        paymentAdvice: advice.toFixed(2),
        amountPaid: paid.toFixed(2),
        payDifference: (advice - paid).toFixed(2),
      });
    }
  } else {
    const voyages = await listVcVoyages(pool, {
      selBType: filters.selBType,
      selCOASpot: spotCoa,
    });
    const list = voyageFilter.length
      ? voyages.filter((v) => voyageFilter.includes(String(v.COMID)))
      : voyages;

    for (const voy of list) {
      const [[recv]] = await pool.query(
        `SELECT COALESCE(SUM(COALESCE(NET_PAYABLE_TAX, NET_AMOUNT)), 0) AS invoiced,
                COALESCE(SUM(COALESCE(P_AMT, 0)), 0) AS received
         FROM freight_invoice_master
         WHERE COMID = ? AND VENDOR = ?`,
        [voy.COMID, vendor],
      );
      const [[pay]] = await pool.query(
        `SELECT COALESCE(SUM(COALESCE(NET_AMT, 0)), 0) AS advice,
                COALESCE(SUM(COALESCE(P_AMT, 0)), 0) AS paid
         FROM request_master
         WHERE COMID = ? AND VENDOR = ?`,
        [voy.COMID, vendor],
      );
      const invoiced = Number(recv?.invoiced) || 0;
      const received = Number(recv?.received) || 0;
      const advice = Number(pay?.advice) || 0;
      const paid = Number(pay?.paid) || 0;
      if (!invoiced && !received && !advice && !paid) continue;
      srNo += 1;
      records.push({
        id: voy.COMID,
        srNo,
        client: clientLabel,
        spotCoaTc: String(spotCoa) === '2' ? 'COA' : 'Spot',
        nomId: `${voy.MESSAGE || ''}/${voy.VOYAGE_NO || ''}`,
        vesselName: voy.VESSEL_NAME || '',
        amountInvoiced: invoiced.toFixed(2),
        amountReceived: received.toFixed(2),
        recvDifference: (invoiced - received).toFixed(2),
        paymentAdvice: advice.toFixed(2),
        amountPaid: paid.toFixed(2),
        payDifference: (advice - paid).toFixed(2),
      });
    }
  }

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbProfitabilityReport(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const fromMs = from ? Date.parse(`${from}T00:00:00`) : null;
  const toMs = to ? Date.parse(`${to}T23:59:59`) : null;
  const voyages = await listVcVoyages(pool, {
    selBType: filters.selBType,
    selCOASpot: filters.selCOASpot || '1',
  });
  const records = [];
  let srNo = 0;
  for (const voy of voyages) {
    const cpMs = voy.TRANS_DATE ? new Date(voy.TRANS_DATE).getTime() : null;
    if (fromMs != null && (cpMs == null || cpMs < fromMs)) continue;
    if (toMs != null && (cpMs == null || cpMs > toMs)) continue;

    let qty = 0;
    if (Number(voy.ESTIMATE_TYPE) === 1) qty = Number(voy.GAS_QUANTITY) || 0;
    else if (Number(voy.ESTIMATE_TYPE) === 2) qty = Number(voy.TANK_QUANTITY) || 0;
    else if (Number(voy.QTY_TYPE_RADIO) === 1) qty = Number(voy.QUANTITY) || 0;
    else {
      const [[sum]] = await pool.query(
        'SELECT SUM(QUANTITY) AS sum FROM freight_cost_estimete_slave7 WHERE FCAID = ?',
        [voy.FCAID],
      );
      qty = Number(sum?.sum) || 0;
    }

    const earnings = Number(voy.REVENUES_FREIGHT || voy.VOYAGE_EARNING) || 0;
    const expense = (Number(voy.BUNKER_EXPENSES) || 0) + (Number(voy.PORT_EXPENSES) || 0);
    const net = Number(voy.ACTUAL_PL) || (earnings - expense);
    srNo += 1;
    records.push({
      id: voy.COMID,
      srNo,
      nomId: voy.MESSAGE || '',
      vesselName: voy.VESSEL_NAME || '',
      coaSpotVoyage: `${voy.COAAID ? 'COA' : 'Spot'}/${voy.VOYAGE_NO || ''}`,
      cpDate: safeDate(voy.TRANS_DATE || voy.CP_DATE),
      status: Number(voy.STATUS) === 1 ? 'In Ops' : 'Post Ops',
      totalQty: qty || '',
      earnings: earnings ? earnings.toFixed(2) : '',
      expense: expense ? expense.toFixed(2) : '',
      netEarnings: net ? Number(net).toFixed(2) : '',
    });
  }
  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbProjectedCashFlowReport(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const days = Number(filters.txtDays) || 0;
  const typeFilter = estimateTypeFilter(filters.selBType);

  const params = [MODULE_ID, COMPANY_ID, ...typeFilter.params];
  let dateSql = '';
  if (from && to) {
    // Project due date ≈ invoice/cp date + days
    dateSql = ` AND DATE_ADD(COALESCE(r.INVOICE_DATE, m.TRANS_DATE), INTERVAL ? DAY) BETWEEN ? AND ? `;
    params.push(days, from, to);
  }

  const [rows] = await pool.query(
    `SELECT r.REQ_ID, r.COMID, r.TTL_OUTSTANDINGS, r.BAL_OUTSTANDINGS, r.REQ_TO_PAY, r.P_AMT,
            r.INVOICE_DATE, c.MESSAGE, m.TRANS_DATE, m.CARGO_ID, v.VESSEL_NAME,
            (SELECT MATERIAL_TYPE FROM cargo_master cm WHERE cm.MATERIALID = m.CARGO_ID LIMIT 1) AS cargoName
     FROM request_master r
     INNER JOIN freight_cost_estimate_compare c ON c.COMID = r.COMID
     INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE c.MODULEID = ?
       AND c.MCOMPANYID = ?
       AND c.FINAL_ID IS NOT NULL AND c.FINAL_ID != ''
       AND m.FIXED = 1
       ${typeFilter.sql}
       ${dateSql}
     GROUP BY r.REQ_ID
     ORDER BY r.INVOICE_DATE DESC
     LIMIT 2000`,
    params,
  );

  const records = rows.map((row, index) => {
    const outstanding = Number(row.TTL_OUTSTANDINGS || row.BAL_OUTSTANDINGS) || 0;
    const payments = Number(row.P_AMT) || 0;
    const baseDate = row.INVOICE_DATE || row.TRANS_DATE;
    let dueDate = '';
    if (baseDate) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + days);
      dueDate = safeDate(d);
    }
    return {
      id: row.REQ_ID,
      srNo: index + 1,
      nomId: row.MESSAGE || '',
      materialName: row.cargoName || '',
      vesselName: row.VESSEL_NAME || '',
      totalOutstanding: outstanding ? outstanding.toFixed(2) : '',
      payments: payments ? payments.toFixed(2) : '',
      balanceOutstanding: (outstanding - payments).toFixed(2),
      lpDate: safeDate(baseDate),
      dueDate,
    };
  });

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbShipmentRegisterReport(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const dateType = String(filters.selDateType || '2');
  const owner = await companyName(pool);
  const voyages = await listVcVoyages(pool, { selBType: filters.selBType });
  const fromMs = from ? Date.parse(`${from}T00:00:00`) : null;
  const toMs = to ? Date.parse(`${to}T23:59:59`) : null;

  const records = [];
  for (const voy of voyages) {
    const dateValue = dateType === '1' ? voy.BL_DATE : voy.TRANS_DATE;
    const ms = dateValue ? new Date(dateValue).getTime() : null;
    if (fromMs != null && (ms == null || ms < fromMs)) continue;
    if (toMs != null && (ms == null || ms > toMs)) continue;

    let qty = Number(voy.QUANTITY || voy.TANK_QUANTITY || voy.GAS_QUANTITY) || 0;
    if (!qty && Number(voy.QTY_TYPE_RADIO) !== 1) {
      const [[sum]] = await pool.query(
        'SELECT SUM(QUANTITY) AS sum FROM freight_cost_estimete_slave7 WHERE FCAID = ?',
        [voy.FCAID],
      );
      qty = Number(sum?.sum) || 0;
    }

    let fromPort = '';
    let toPort = '';
    try {
      const [ports] = await pool.query(
        `SELECT
           (SELECT PortName FROM port_master WHERE PortId = s.FROM_PORT LIMIT 1) AS fp,
           (SELECT PortName FROM port_master WHERE PortId = s.TO_PORT LIMIT 1) AS tp
         FROM freight_cost_estimete_slave1 s WHERE s.FCAID = ? LIMIT 1`,
        [voy.FCAID],
      );
      fromPort = String(ports[0]?.fp || '').split(' / ')[0];
      toPort = String(ports[0]?.tp || '').split(' / ')[0];
    } catch {
      fromPort = '';
      toPort = '';
    }

    let broker = '';
    try {
      const [brokers] = await pool.query(
        `SELECT v.NAME AS name
         FROM freight_cost_estimete_slave4 s
         LEFT JOIN vendor_master v ON v.CODE = s.VENDORID
         WHERE s.FCAID = ?`,
        [voy.FCAID],
      );
      broker = brokers.map((b) => b.name).filter(Boolean).join(', ');
    } catch {
      broker = '';
    }

    let cargo = '';
    if (voy.CARGO_ID) {
      const [[c]] = await pool.query(
        'SELECT MATERIAL_TYPE FROM cargo_master WHERE MATERIALID = ? LIMIT 1',
        [String(voy.CARGO_ID).split(',')[0]],
      );
      cargo = c?.MATERIAL_TYPE || '';
    }

    const earnings = Number(voy.REVENUES_FREIGHT || voy.VOYAGE_EARNING) || 0;
    const bunker = Number(voy.BUNKER_EXPENSES) || 0;
    const portExp = Number(voy.PORT_EXPENSES) || 0;
    records.push({
      id: voy.COMID,
      nomId: voy.MESSAGE || '',
      vesselName: voy.VESSEL_NAME || '',
      cpDate: safeDate(voy.TRANS_DATE),
      owner,
      broker,
      materialDesc: cargo,
      lastUpdatedFreight: earnings ? earnings.toFixed(2) : '',
      fromPort,
      toPort,
      blDate: safeDate(voy.BL_DATE),
      qty: qty || '',
      operationalExpenses: '',
      portExpenses: portExp ? portExp.toFixed(2) : '',
      bunkerExpenses: bunker ? bunker.toFixed(2) : '',
      voyageEarnings: earnings ? earnings.toFixed(2) : '',
      dailyEarnings: voy.DAILY_EARNING ?? '',
      voyageEarningsDem: earnings ? earnings.toFixed(2) : '',
      nettDailyProfit: voy.DAILY_EARNING ?? '',
      pl: voy.ACTUAL_PL ?? '',
    });
  }

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

export async function dbPaymentActionedReport(filters = {}) {
  const pool = getPool();
  const from = parsePeriodDate(filters.dateFrom);
  const to = parsePeriodDate(filters.dateTo);
  const typeFilter = estimateTypeFilter(filters.selBType);
  const records = [];

  const sources = [
    {
      sql: `SELECT r.REQ_ID AS id, r.COMID, r.P_DATE, r.P_AMT AS amount, r.VENDOR, r.NAME AS paymentType,
                   m.VOYAGE_NO, v.VESSEL_NAME
            FROM request_master r
            INNER JOIN freight_cost_estimate_compare c ON c.COMID = r.COMID
            INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
            LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
            WHERE c.MODULEID = ? AND c.MCOMPANYID = ?
              AND r.P_DATE BETWEEN ? AND ?
              AND r.P_AMT IS NOT NULL AND r.P_AMT != 0
              ${typeFilter.sql}
            GROUP BY r.REQ_ID`,
      params: [MODULE_ID, COMPANY_ID, from, to, ...typeFilter.params],
      label: (row) => row.paymentType || 'Payment Request',
    },
    {
      sql: `SELECT r.REQ_ID AS id, r.COMID, r.P_DATE, r.P_AMT AS amount, r.VENDOR, r.NAME AS paymentType,
                   m.TC_NO AS VOYAGE_NO, v.VESSEL_NAME
            FROM request_mastertc r
            INNER JOIN chartering_estimate_tc_compare c ON c.COMID = r.COMID
            INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
            LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
            WHERE c.MODULEID = ? AND c.MCOMPANYID = ?
              AND r.P_DATE BETWEEN ? AND ?
              AND r.P_AMT IS NOT NULL AND r.P_AMT != 0
            GROUP BY r.REQ_ID`,
      params: [MODULE_ID, COMPANY_ID, from, to],
      label: (row) => row.paymentType || 'TC Payment Request',
    },
    {
      sql: `SELECT i.INVOICEID AS id, i.COMID, i.P_DATE, i.P_AMT AS amount, i.SHIP_OWNER AS VENDOR,
                   'Hire Statement' AS paymentType, m.VOYAGE_NO, v.VESSEL_NAME
            FROM invoice_hire_master i
            INNER JOIN freight_cost_estimate_compare c ON c.COMID = i.COMID
            INNER JOIN freight_cost_estimete_master m ON m.FCAID = c.FCAID
            LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
            WHERE c.MODULEID = ? AND c.MCOMPANYID = ?
              AND i.P_DATE BETWEEN ? AND ?
              AND i.P_AMT IS NOT NULL AND i.P_AMT != 0
              ${typeFilter.sql}
            GROUP BY i.INVOICEID`,
      params: [MODULE_ID, COMPANY_ID, from, to, ...typeFilter.params],
      label: () => 'Hire Statement',
    },
    {
      sql: `SELECT i.INVOICEID AS id, i.COMID, i.P_DATE, i.P_AMT AS amount, i.SHIP_OWNER AS VENDOR,
                   'TC Hire Statement' AS paymentType, m.TC_NO AS VOYAGE_NO, v.VESSEL_NAME
            FROM invoice_hiretc_master i
            INNER JOIN chartering_estimate_tc_compare c ON c.COMID = i.COMID
            INNER JOIN chartering_estimate_tc_master m ON m.TCOUTID = c.TCOUTID
            LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
            WHERE c.MODULEID = ? AND c.MCOMPANYID = ?
              AND i.P_DATE BETWEEN ? AND ?
              AND i.P_AMT IS NOT NULL AND i.P_AMT != 0
            GROUP BY i.INVOICEID`,
      params: [MODULE_ID, COMPANY_ID, from, to],
      label: () => 'TC Hire Statement',
    },
  ];

  for (const source of sources) {
    try {
      const [rows] = await pool.query(source.sql, source.params);
      for (const row of rows) {
        records.push({
          id: `${source.label(row)}-${row.id}`,
          voyageNo: row.VOYAGE_NO || '',
          vesselName: row.VESSEL_NAME || '',
          vendorName: await vendorName(pool, row.VENDOR),
          paymentType: source.label(row),
          paymentDate: safeDate(row.P_DATE),
          amount: row.amount != null ? Number(row.amount).toFixed(2) : '',
        });
      }
    } catch {
      // skip missing tables
    }
  }

  records.sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)));
  records.forEach((row, index) => {
    row.srNo = index + 1;
  });

  return { records, recordsTotal: records.length, isMgmtUser: isMgmtUser() };
}

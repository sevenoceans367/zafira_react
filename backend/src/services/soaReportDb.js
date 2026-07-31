import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function str(value) {
  if (value == null) return '';
  return String(value);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return str(value);
  return n.toFixed(2);
}

function isNullishFlag(value) {
  return value == null || value === '' || String(value).toLowerCase() === 'null';
}

function blankCpDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted === '01-01-1970') return '';
  return formatted;
}

function rowCells(cells, estimated = '', colB = '', colC = '', balance = '', opts = {}) {
  return {
    cells: [...cells, '', '', '', '', ''].slice(0, 5).map((c) => (c == null ? '' : String(c))),
    estimated: estimated === '' ? '' : money(estimated),
    colB: colB === '' ? '' : money(colB),
    colC: colC === '' ? '' : money(colC),
    balance: balance === '' ? '' : money(balance),
    balanceRed: Boolean(opts.balanceRed),
    strong: Boolean(opts.strong),
  };
}

function headerRow(title) {
  return { isHeader: true, title: String(title || '') };
}

function pushTotal(sums, estimated, colB, colC, balance) {
  sums.estimated.push(num(estimated));
  sums.colB.push(num(colB));
  sums.colC.push(num(colC));
  sums.balance.push(num(balance));
}

function sumArr(arr) {
  return arr.reduce((a, b) => a + num(b), 0);
}

async function getPortName(pool, portId) {
  if (!portId) return '';
  // Match PHP getPortNameBasedOnID used in SOA invoice P_TYPE titles.
  const [[row]] = await pool.query(
    `SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1`,
    [portId],
  ).catch(() => [[null]]);
  return row?.PortName || str(portId);
}

async function getVendorName(pool, code) {
  if (!code) return '';
  const [[row]] = await pool.query(
    `SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1`,
    [code],
  ).catch(() => [[null]]);
  return row?.NAME || '';
}

async function getBunkerGradeName(pool, id) {
  if (!id) return '';
  const [[row]] = await pool.query(
    `SELECT NAME FROM bunker_grade_master WHERE BUNKERGRADEID = ? LIMIT 1`,
    [id],
  ).catch(() => [[null]]);
  return row?.NAME || str(id);
}

async function getLatestCostSheetId(pool, comId) {
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

async function sumOtherInvoice(pool, comId, vendorId, invTitle) {
  const [[row]] = await pool.query(
    `SELECT SUM(NET_PAYABLE) AS sum1, SUM(P_AMT) AS sum2
     FROM other_invoice_master
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
       AND VENDOR = ? AND P_TYPE = ? AND STATUS <= 5`,
    [comId, MODULE_ID, COMPANY_ID, vendorId, invTitle],
  ).catch(() => [[null]]);
  return { invoiced: num(row?.sum1), received: num(row?.sum2) };
}

async function sumRequest(pool, comId, name, nameId, gradeId, vendorId) {
  const [[row]] = await pool.query(
    `SELECT SUM(REQ_TO_PAY) AS sum1, SUM(P_AMT) AS sum2
     FROM request_master
     WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
       AND NAME = ? AND NAME_ID = ? AND GRADEID = ? AND VENDOR = ?`,
    [comId, MODULE_ID, COMPANY_ID, name, nameId, gradeId, vendorId],
  ).catch(() => [[null]]);
  return { poMade: num(row?.sum1), paid: num(row?.sum2) };
}

/**
 * Freight qty / rate label / rates / estimated amount — mirrors PHP soa_report.php.
 */
async function resolveFreightMeta(pool, comId, compare, master, fcaId) {
  let quantity = 0;
  let freight = 0;
  const freightRates = [];
  let freightLevel = '';

  const coaId = master.COAID || compare.COAID;
  const estimateType = Number(compare.ESTIMATE_TYPE ?? master.ESTIMATE_TYPE);

  if (coaId) {
    freightLevel = 'Freight Rate';
    const [rows] = await pool.query(
      `SELECT CARGO_MT, CARGO_CBM, RATE_USD_MT, AMOUNT_USD
       FROM freight_cost_estimete_slave10
       WHERE FCAID = ? AND STATUS IN (1, 2)`,
      [fcaId],
    ).catch(() => [[]]);
    for (const row of rows || []) {
      freight += num(row.AMOUNT_USD);
      freightRates.push(str(row.RATE_USD_MT));
      if (estimateType === 1 || estimateType === 2) {
        quantity += num(row.CARGO_CBM);
      } else {
        quantity += num(row.CARGO_MT);
      }
    }
    return { quantity, freight, freightRates, freightLevel };
  }

  if (estimateType === 1) {
    quantity = num(compare.GAS_QUANTITY ?? master.GAS_QUANTITY);
    if (Number(compare.GAS_MARKET ?? master.GAS_MARKET) === 1) {
      freightLevel = 'Base Freight';
      freightRates.push(str(compare.GAS_BASE_RATE ?? master.GAS_BASE_RATE));
    } else {
      freightLevel = 'Lump-sum  (USD)';
      freightRates.push(str(compare.GAS_LUMSUM ?? master.GAS_LUMSUM));
    }
    freight = num(master.FREIGHT_GROSS ?? master.REVENUES_FREIGHT ?? compare.FREIGHT_GROSS);
    return { quantity, freight, freightRates, freightLevel };
  }

  if (estimateType === 2) {
    quantity = num(compare.TANK_QUANTITY ?? master.TANK_QUANTITY);
    if (Number(master.TANKER_RADIO_SINGLE_DIS) === 1) {
      if (Number(compare.CHK_LUMPSUM ?? master.CHK_LUMPSUM) === 1) {
        freightLevel = 'Lump-sum  (USD)';
        const lump = num(compare.LUMPSUMAMT ?? master.LUMPSUMAMT);
        freightRates.push(str(lump));
        freight += lump;
      } else {
        freightLevel = 'WS';
        const compareFca = compare.FCAID || fcaId;
        const [[ws]] = await pool.query(
          `SELECT MIN_WS, TOTAL_AMOUNT FROM freight_cost_estimete_slave12 WHERE FCAID = ? LIMIT 1`,
          [compareFca],
        ).catch(() => [[null]]);
        freightRates.push(str(ws?.MIN_WS ?? ''));
        freight += num(ws?.TOTAL_AMOUNT);
      }
    } else {
      freightLevel = 'Freight';
      const compareFca = compare.FCAID || fcaId;
      const [rows] = await pool.query(
        `SELECT AMOUNT_USD, RATE_USD_MT, STATUS FROM freight_cost_estimete_slave10 WHERE FCAID = ?`,
        [compareFca],
      ).catch(() => [[]]);
      for (const row of rows || []) {
        if (Number(row.STATUS) === 1 || Number(row.STATUS) === 2) {
          freightRates.push(str(row.RATE_USD_MT));
        }
        freight += num(row.AMOUNT_USD);
      }
    }
    return { quantity, freight, freightRates, freightLevel };
  }

  freightLevel = 'Freight Rate';
  if (Number(compare.QTY_TYPE_RADIO ?? master.QTY_TYPE_RADIO) === 1) {
    quantity = num(compare.QUANTITY ?? master.QUANTITY);
    freightRates.push(str(master.CARGO_RATE ?? master.MARKET_RATE ?? compare.CARGO_RATE ?? ''));
    freight += num(compare.TOTAL_PREIGHT_ADJ ?? master.TOTAL_PREIGHT_ADJ ?? master.FREIGHT_GROSS);
  } else {
    const compareFca = compare.FCAID || fcaId;
    const [rows] = await pool.query(
      `SELECT QUANTITY, GROSS_FREIGHT, AGREED_GROSS_FREIGHT, NET_FREIGHT
       FROM freight_cost_estimete_slave7 WHERE FCAID = ?`,
      [compareFca],
    ).catch(() => [[]]);
    for (const row of rows || []) {
      quantity += num(row.QUANTITY);
      const rate = num(row.AGREED_GROSS_FREIGHT) || num(row.NET_FREIGHT);
      freightRates.push(rate ? rate.toFixed(2) : '');
      freight += num(row.GROSS_FREIGHT);
    }
  }
  return { quantity, freight, freightRates, freightLevel };
}

/**
 * PHP soa_report.php — Consolidated Statement of Accounts (VC/COA) text view.
 */
export async function dbGetSoaReport(comId) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const [[compare]] = await pool.query(
    `SELECT c.*, m.VOYAGE_NO AS MASTER_VOYAGE_NO, m.VESSEL_IMO_ID AS MASTER_VESSEL_IMO_ID,
            m.CP_DATE AS MASTER_CP_DATE, vim.VESSEL_NAME
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
  const [[master]] = await pool.query(
    `SELECT * FROM freight_cost_estimete_master WHERE FCAID = ? LIMIT 1`,
    [fcaId],
  ).catch(() => [[null]]);

  if (!master) {
    const error = new Error('Voyage financial sheet not found for this nomination.');
    error.status = 404;
    throw error;
  }

  let vesselName = compare.VESSEL_NAME || '';
  if (!vesselName && master.VESSEL_IMO_ID) {
    const [[vim]] = await pool.query(
      `SELECT VESSEL_NAME FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? LIMIT 1`,
      [master.VESSEL_IMO_ID],
    ).catch(() => [[null]]);
    vesselName = vim?.VESSEL_NAME || '';
  }

  const voyageNo = master.VOYAGE_NO || compare.MASTER_VOYAGE_NO || '';
  const cpDate = blankCpDate(master.CP_DATE || compare.MASTER_CP_DATE || compare.CP_DATE);
  const { quantity, freight, freightRates, freightLevel } = await resolveFreightMeta(
    pool,
    comId,
    compare,
    master,
    fcaId,
  );

  const addCommPct = master.ADDRESS_COMMISSION_PER ?? master.ADD_COMM ?? '';
  const addCommAmt = num(master.ADDRESS_COMMISSION_AMT);

  // ── RECEIVABLES ──────────────────────────────────────────────────
  const recvSums = { estimated: [], colB: [], colC: [], balance: [] };
  const recvBlocks = [];

  // FREIGHT
  {
    const [[inv]] = await pool.query(
      `SELECT SUM(NET_PAYABLE) AS sum1, SUM(ADDCOM_AMOUNT) AS sum2, SUM(P_AMT) AS sum3
       FROM freight_invoice_master
       WHERE COMID = ? AND STATUS <= 5`,
      [comId],
    ).catch(() => [[null]]);
    const sum1 = num(inv?.sum1);
    const sum2 = num(inv?.sum2);
    const sum3 = num(inv?.sum3);
    const netEst = freight - addCommAmt;
    const bal = sum1 - sum3;

    const rows = [
      headerRow('FREIGHT'),
      rowCells(
        ['Qty', quantity || '', freightLevel, freightRates.filter(Boolean).join(',')],
        freight,
        '',
        '',
        '',
      ),
      rowCells(['Add Comm.%', addCommPct, '', ''], addCommAmt, sum2, '', ''),
      rowCells(['', '', '', ''], netEst, sum1, sum3, bal, { balanceRed: true }),
    ];
    pushTotal(recvSums, netEst, sum1, sum3, bal);
    recvBlocks.push({ key: 'freight', rows });
  }

  // DEMURRAGE LP / DP
  {
    const [legs] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave1 WHERE FCAID = ? ORDER BY FCA_SLAVEID`,
      [fcaId],
    ).catch(() => [[]]);

    for (const leg of legs || []) {
      if (isNullishFlag(leg.IS_SHOW_DDCLP)) {
        const portName = await getPortName(pool, leg.FROM_PORT);
        const [[lay]] = await pool.query(
          `SELECT TIME_TO_DEMURRAGE, TIME_TO_DESPATCH, DEMURRAGE_RATE, DESPATCH_RATE
           FROM laytime_master
           WHERE COMID = ? AND PORT = 'LP' AND PORTID = ? AND RANDOMID = ? AND REVERSIBLE != 1
           LIMIT 1`,
          [comId, leg.FROM_PORT, leg.RANDOMID],
        ).catch(() => [[null]]);

        const invTitle = `Demurrage/Dispatch Invoice for Load Port ${portName}`;
        const sums = await sumOtherInvoice(pool, comId, leg.DDCLP_VENDOR, invTitle);
        const real = num(leg.DDCLP_REALCOST);
        const commPct = num(leg.DDCLP_COMM);
        const commAmt = (real * commPct) / 100;
        const net = num(leg.DDCLP_NETCOST);
        const bal = sums.invoiced - sums.received;
        const timeOn = lay && num(lay.TIME_TO_DEMURRAGE) > 0
          ? str(lay.TIME_TO_DEMURRAGE)
          : lay
            ? `-${str(lay.TIME_TO_DESPATCH)}`
            : '';
        const rate = lay && num(lay.TIME_TO_DEMURRAGE) > 0
          ? str(lay.DEMURRAGE_RATE)
          : str(lay?.DESPATCH_RATE || '');

        recvBlocks.push({
          key: `dem-lp-${leg.FROM_PORT}-${leg.RANDOMID}`,
          rows: [
            headerRow(`DEMURRAGE - LOAD PORT ${String(portName).toUpperCase()}`),
            rowCells(['Time on demm', timeOn, 'Demm/Des Rate', rate], real, '', '', ''),
            rowCells(['Add Comm.%', leg.DDCLP_COMM ?? '', '', ''], commAmt, '', '', ''),
            rowCells(['', '', '', ''], net, sums.invoiced, sums.received, bal, { balanceRed: true }),
          ],
        });
        pushTotal(recvSums, net, sums.invoiced, sums.received, bal);
      }

      if (isNullishFlag(leg.IS_SHOW_DDCDP)) {
        const portName = await getPortName(pool, leg.TO_PORT);
        const [[lay]] = await pool.query(
          `SELECT TIME_TO_DEMURRAGE, TIME_TO_DESPATCH, DEMURRAGE_RATE, DESPATCH_RATE
           FROM laytime_master
           WHERE COMID = ? AND PORT = 'DP' AND PORTID = ? AND RANDOMID = ? AND REVERSIBLE != 1
           LIMIT 1`,
          [comId, leg.TO_PORT, leg.RANDOMID],
        ).catch(() => [[null]]);

        const invTitle = `Demurrage/Dispatch Invoice for Discharge Port ${portName}`;
        const sums = await sumOtherInvoice(pool, comId, leg.DDCDP_VENDOR, invTitle);
        const real = num(leg.DDCDP_REALCOST);
        const commPct = num(leg.DDCDP_COMM);
        const commAmt = (real * commPct) / 100;
        const net = num(leg.DDCDP_NETCOST);
        const bal = sums.invoiced - sums.received;
        const timeOn = lay && num(lay.TIME_TO_DEMURRAGE) > 0
          ? str(lay.TIME_TO_DEMURRAGE)
          : lay
            ? `-${str(lay.TIME_TO_DESPATCH)}`
            : '';
        const rate = lay && num(lay.TIME_TO_DEMURRAGE) > 0
          ? str(lay.DEMURRAGE_RATE)
          : str(lay?.DESPATCH_RATE || '');

        recvBlocks.push({
          key: `dem-dp-${leg.TO_PORT}-${leg.RANDOMID}`,
          rows: [
            headerRow(`DEMURRAGE - DISCHARGE PORT ${String(portName).toUpperCase()}`),
            rowCells(['Time on demm', timeOn, 'Demm/Des Rate', rate], real, '', '', ''),
            rowCells(['Add Comm.%', leg.DDCDP_COMM ?? '', '', ''], commAmt, '', '', ''),
            rowCells(['', '', '', ''], net, sums.invoiced, sums.received, bal, { balanceRed: true }),
          ],
        });
        pushTotal(recvSums, net, sums.invoiced, sums.received, bal);
      }
    }
  }

  // OTHER INCOME
  {
    const oiRows = [headerRow('OTHER INCOME')];
    const [rows] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave3
       WHERE FCAID = ? AND IDENTIFY = 'OTHERINCOME' AND RAW_AMOUNT > 0`,
      [fcaId],
    ).catch(() => [[]]);

    for (const qrow of rows || []) {
      const vendorName = await getVendorName(pool, qrow.VENDORID);
      if (!vendorName) continue;
      const invTitle = `Other Income Invoice for ${qrow.IDENTY_ID}`;
      const sums = await sumOtherInvoice(pool, comId, qrow.VENDORID, invTitle);
      const est = num(qrow.RAW_AMOUNT);
      const bal = sums.invoiced - sums.received;
      oiRows.push(rowCells(
        [str(qrow.IDENTY_ID), '', '', ''],
        est,
        sums.invoiced,
        sums.received,
        bal,
        { balanceRed: true },
      ));
      pushTotal(recvSums, est, sums.invoiced, sums.received, bal);
    }
    recvBlocks.push({ key: 'other-income', rows: oiRows });
  }

  const receivables = {
    labels: {
      estimated: 'Estimated (USD)',
      colB: 'Invoiced (USD)',
      colC: 'Received (USD)',
      balance: 'Balance (USD)',
    },
    blocks: recvBlocks,
    totals: {
      estimated: money(sumArr(recvSums.estimated)),
      colB: money(sumArr(recvSums.colB)),
      colC: money(sumArr(recvSums.colC)),
      balance: money(sumArr(recvSums.balance)),
    },
  };

  // ── PAYABLES ─────────────────────────────────────────────────────
  const paySums = { estimated: [], colB: [], colC: [], balance: [] };
  const payBlocks = [];

  // BUNKERS
  {
    const bunkerRows = [headerRow('BUNKERS')];
    const [rows] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave8 WHERE FCAID = ?`,
      [fcaId],
    ).catch(() => [[]]);

    for (const qrow of rows || []) {
      const vendorName = await getVendorName(pool, qrow.VENDORID);
      if (!vendorName) continue;
      const gradeName = await getBunkerGradeName(pool, qrow.BUNKERGRADEID);
      const sums = await sumRequest(
        pool,
        comId,
        'Bunkers Nett Supply',
        '2',
        qrow.BUNKERGRADEID,
        qrow.VENDORID,
      );
      const est = num(qrow.COST);
      const bal = sums.poMade - sums.paid;
      bunkerRows.push(rowCells(
        ['Grade', gradeName, 'Qty(MT)', qrow.QTY ?? ''],
        est,
        sums.poMade,
        sums.paid,
        bal,
        { balanceRed: true },
      ));
      pushTotal(paySums, est, sums.poMade, sums.paid, bal);
    }
    payBlocks.push({ key: 'bunkers', rows: bunkerRows });
  }

  // OPERATIONAL COST
  {
    const opRows = [headerRow('OPERATIONAL COST')];

    const [brokerRows] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave4 WHERE FCAID = ?`,
      [fcaId],
    ).catch(() => [[]]);
    for (const qrow of brokerRows || []) {
      const vendorName = await getVendorName(pool, qrow.VENDORID);
      if (!vendorName) continue;
      const sums = await sumRequest(
        pool,
        comId,
        'Operational Costs (Others)',
        '3',
        '0',
        qrow.VENDORID,
      );
      const est = num(qrow.BROKAGE_AMT);
      const bal = sums.poMade - sums.paid;
      opRows.push(rowCells(
        ['Brokerage Commission', qrow.BROKAGE_AMT ?? '', '', ''],
        est,
        sums.poMade,
        sums.paid,
        bal,
        { balanceRed: true },
      ));
      pushTotal(paySums, est, sums.poMade, sums.paid, bal);
    }

    const [orcRows] = await pool.query(
      `SELECT s.*, o.NAME AS COSTNAME
       FROM freight_cost_estimete_slave3 s
       LEFT JOIN owner_related_cost_master o ON o.OWNER_RCOSTID = s.IDENTY_ID
       WHERE s.FCAID = ? AND s.IDENTIFY = 'ORC'`,
      [fcaId],
    ).catch(() => [[]]);

    let orcIndex = 0;
    for (const qrow of orcRows || []) {
      orcIndex += 1;
      const vendorName = await getVendorName(pool, qrow.VENDORID);
      if (!vendorName) continue;
      const sums = await sumRequest(
        pool,
        comId,
        'Operational Costs',
        '3',
        String(orcIndex),
        qrow.VENDORID,
      );
      const est = num(qrow.RAW_AMOUNT);
      const bal = sums.poMade - sums.paid;
      opRows.push(rowCells(
        [qrow.COSTNAME || str(qrow.IDENTY_ID), qrow.RAW_AMOUNT ?? '', '', ''],
        est,
        sums.poMade,
        sums.paid,
        bal,
        { balanceRed: true },
      ));
      pushTotal(paySums, est, sums.poMade, sums.paid, bal);
    }
    payBlocks.push({ key: 'ops-cost', rows: opRows });
  }

  // PORT COSTS
  {
    const portRows = [headerRow('PORT COSTS')];
    const [legs] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave1 WHERE FCAID = ? ORDER BY FCA_SLAVEID`,
      [fcaId],
    ).catch(() => [[]]);

    for (const qrow of legs || []) {
      if (num(qrow.LOAD_PORT_COST) > 0) {
        const portName = await getPortName(pool, qrow.FROM_PORT);
        const sums = await sumRequest(
          pool,
          comId,
          'Load Port Costs',
          '5',
          qrow.FROM_PORT,
          qrow.PORT_COSTLP_VENDOR,
        );
        const est = num(qrow.LOAD_PORT_COST);
        const bal = sums.poMade - sums.paid;
        portRows.push(rowCells(
          [`LP - ${portName}`, qrow.LOAD_PORT_COST ?? '', '', ''],
          est,
          sums.poMade,
          sums.paid,
          bal,
          { balanceRed: true },
        ));
        pushTotal(paySums, est, sums.poMade, sums.paid, bal);
      }
      if (num(qrow.DISC_PORT_COST) > 0) {
        const portName = await getPortName(pool, qrow.TO_PORT);
        const sums = await sumRequest(
          pool,
          comId,
          'Discharge Port Costs',
          '5',
          qrow.TO_PORT,
          qrow.PORT_COSTDP_VENDOR,
        );
        const est = num(qrow.DISC_PORT_COST);
        const bal = sums.poMade - sums.paid;
        portRows.push(rowCells(
          [`DP - ${portName}`, qrow.DISC_PORT_COST ?? '', '', ''],
          est,
          sums.poMade,
          sums.paid,
          bal,
          { balanceRed: true },
        ));
        pushTotal(paySums, est, sums.poMade, sums.paid, bal);
      }
      if (num(qrow.TRANSIT_PORT_COST) > 0) {
        const portName = await getPortName(pool, qrow.FROM_PORT);
        const sums = await sumRequest(
          pool,
          comId,
          'Transit Port Costs',
          '5',
          qrow.FROM_PORT,
          qrow.PORT_COSTTP_VENDOR,
        );
        const est = num(qrow.TRANSIT_PORT_COST);
        const bal = sums.poMade - sums.paid;
        portRows.push(rowCells(
          [`TP - ${portName}`, qrow.TRANSIT_PORT_COST ?? '', '', ''],
          est,
          sums.poMade,
          sums.paid,
          bal,
          { balanceRed: true },
        ));
        pushTotal(paySums, est, sums.poMade, sums.paid, bal);
      }
    }
    payBlocks.push({ key: 'port-costs', rows: portRows });
  }

  // HIRE COSTS
  {
    const dailyHire = master.HIRE_RATE ?? '';
    const days = master.TOTAL_DAYS ?? '';
    const hireGross = num(master.HIREAGE_AMT ?? master.HIRE_AMT);
    const hireAddPct = master.HIREAGE_PERCENT ?? '';
    const hireAddAmt = num(hireAddPct) && hireGross
      ? (hireGross * num(hireAddPct)) / 100
      : 0;
    // PHP getFun236 — nett hire after address commission when available
    const totalHire = master.NET_HIREAGE != null && master.NET_HIREAGE !== ''
      ? num(master.NET_HIREAGE)
      : hireGross - hireAddAmt;

    const hireRows = [
      headerRow('HIRE COSTS'),
      rowCells(['Daily Hire', dailyHire, 'Days', days], hireGross, '', '', ''),
      rowCells(['Add Comm.%', hireAddPct, '', ''], hireAddAmt, '', '', ''),
    ];

    const [hireInvoices] = await pool.query(
      `SELECT FINAL_AMT, ADD_COMM_AMT, P_AMT, INVOICE_TYPE, INVOICE_NO
       FROM invoice_hire_master
       WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [comId, MODULE_ID, COMPANY_ID],
    ).catch(() => [[]]);

    let hirePo = 0;
    let hirePaid = 0;
    let m = 0;
    for (const inv of hireInvoices || []) {
      m += 1;
      const finalAmt = num(inv.FINAL_AMT);
      const paid = num(inv.P_AMT);
      hirePo += finalAmt;
      hirePaid += paid;
      hireRows.push(rowCells(
        [`${m}. ${inv.INVOICE_NO || ''} (${inv.INVOICE_TYPE || ''})`, '', '', ''],
        '',
        finalAmt,
        paid,
        finalAmt - paid,
        { balanceRed: true, strong: true },
      ));
    }

    const hireBal = hirePo - hirePaid;
    hireRows.push(rowCells(
      ['', '', '', '', 'Total Hire'],
      totalHire,
      hirePo,
      hirePaid,
      hireBal,
      { balanceRed: true },
    ));
    pushTotal(paySums, totalHire, hirePo, hirePaid, hireBal);
    payBlocks.push({ key: 'hire', rows: hireRows });
  }

  const payables = {
    labels: {
      estimated: 'Estimated (USD)',
      colB: 'PO Made (USD)',
      colC: 'Paid (USD)',
      balance: 'Balance (USD)',
    },
    blocks: payBlocks,
    totals: {
      estimated: money(sumArr(paySums.estimated)),
      colB: money(sumArr(paySums.colB)),
      colC: money(sumArr(paySums.colC)),
      balance: money(sumArr(paySums.balance)),
    },
  };

  return {
    comId: str(comId),
    fcaId: fcaId != null ? str(fcaId) : '',
    vesselName: str(vesselName),
    message: str(compare.MESSAGE),
    voyageNo: str(voyageNo),
    cpDate: str(cpDate),
    currency: 'USD',
    title: 'CONSOLIDATED STATEMENT OF ACCOUNTS - VC/COA',
    receivables,
    payables,
  };
}

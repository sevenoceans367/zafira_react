import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateTimeDMY(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) return '';
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function blankPaymentDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted === '01-01-1970') return '';
  return formatted;
}

function money(value) {
  if (value == null || value === '') return '';
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : String(value);
}

async function getVendorName(pool, code) {
  if (!code) return '';
  const [[row]] = await pool.query(
    `SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1`,
    [code],
  ).catch(() => [[null]]);
  return row?.NAME || '';
}

async function getExpenseTypeName(pool, id) {
  if (!id) return '';
  const [[row]] = await pool.query(
    `SELECT EXPENSE_TYPE FROM expense_type_master WHERE EXPENSETYPEID = ? LIMIT 1`,
    [id],
  ).catch(() => [[null]]);
  return row?.EXPENSE_TYPE || '';
}

async function getOwnerRelatedName(pool, id) {
  if (!id) return '';
  const [[row]] = await pool.query(
    `SELECT NAME FROM owner_related_cost_master WHERE OWNER_RCOSTID = ? LIMIT 1`,
    [id],
  ).catch(() => [[null]]);
  return row?.NAME || String(id);
}

async function getPaymentSummary(pool, sql, params) {
  try {
    const [[row]] = await pool.query(sql, params);
    return {
      totalPaid: money(row?.P_AMT),
      lastPaidDate: blankPaymentDate(row?.P_DATE),
    };
  } catch {
    return { totalPaid: '', lastPaidDate: '' };
  }
}

async function getUserAuthorities(pool) {
  const fields = [
    'HIRE_INVOICE_CHK_CRETR',
    'HIRE_INVOICE_CHK_APP_1',
    'HIRE_INVOICE_CHK_APP_2',
    'HIRE_STSTMENT_CHK_CRETR',
    'HIRE_STSTMENT_CHK_APP_1',
    'HIRE_STSTMENT_CHK_APP_2',
    'HIRE_STSTMENT_CHK_ACC',
  ];
  try {
    const [[row]] = await pool.query(
      `SELECT ${fields.join(', ')}
       FROM approval_matrix
       WHERE MCOMPANYID = ? AND LOGINID = ?
       LIMIT 1`,
      [COMPANY_ID, appContext.userId],
    );
    const flag = (key) => Number(row?.[key]) === 1;
    return {
      canHireInvoice: flag('HIRE_INVOICE_CHK_CRETR')
        || flag('HIRE_INVOICE_CHK_APP_1')
        || flag('HIRE_INVOICE_CHK_APP_2'),
      canHireStatement: flag('HIRE_STSTMENT_CHK_CRETR')
        || flag('HIRE_STSTMENT_CHK_APP_1')
        || flag('HIRE_STSTMENT_CHK_APP_2')
        || flag('HIRE_STSTMENT_CHK_ACC'),
    };
  } catch {
    return { canHireInvoice: true, canHireStatement: true };
  }
}

async function hasNegativeHirePayable(pool, comId) {
  try {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS CNT
       FROM invoice_tchire_master
       WHERE COMID = ? AND NET_PAYABLE_TAX < 0`,
      [comId],
    );
    return Number(row?.CNT) > 0;
  } catch {
    return false;
  }
}

function action(key, label, variant, enabled, params = {}) {
  return {
    key,
    label,
    variant,
    enabled: Boolean(enabled),
    migrated: false,
    ...params,
  };
}

export async function dbGetPaymentGridTc(comId) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }

  const [[master]] = await pool.query(
    `SELECT m.TCOUTID, m.TC_NO, m.VESSEL_IMO_ID, vim.VESSEL_NAME
     FROM chartering_estimate_tc_master m
     LEFT JOIN vessel_imo_master vim ON vim.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.COMID = ? AND m.MODULEID = ?
     ORDER BY m.TCOUTID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  );

  if (!master?.TCOUTID) {
    const error = new Error('TC estimate not found for this nomination.');
    error.status = 404;
    throw error;
  }

  const authorities = await getUserAuthorities(pool);
  const showHirePaymentAdvice = await hasNegativeHirePayable(pool, comId);

  const [slave1Rows] = await pool.query(
    `SELECT *
     FROM chartering_tc_estimate_slave1
     WHERE TCOUTID = ?
     ORDER BY TC_SLAVE1ID ASC`,
    [master.TCOUTID],
  );

  const trips = [];
  let tripIndex = 0;

  for (const trip of slave1Rows || []) {
    tripIndex += 1;
    const slave1Id = trip.TC_SLAVE1ID;
    const randomId = trip.RANDOMID != null ? String(trip.RANDOMID) : '';

    const [periodRows] = await pool.query(
      `SELECT DEL_DATE, RE_DEL_DATE
       FROM chartering_estimate_tc_slave8
       WHERE TC_SLAVE1ID = ?`,
      [slave1Id],
    ).catch(() => [[]]);

    const period = periodRows?.[0];
    const periodLabel = period
      ? `Trip/Period ${tripIndex} (${formatDateTimeDMY(period.DEL_DATE)} To ${formatDateTimeDMY(period.RE_DEL_DATE)})`
      : `Trip/Period ${tripIndex}`;

    const lines = [];

    // Hire Income
    {
      const vendorId = trip.TTL_REV_VENDOR != null ? String(trip.TTL_REV_VENDOR) : '';
      const vendorName = await getVendorName(pool, vendorId);
      const pay = await getPaymentSummary(
        pool,
        `SELECT SUM(P_AMT) AS P_AMT, P_DATE
         FROM invoice_tchire_master
         WHERE COMID = ?
         ORDER BY INVOICEID DESC`,
        [comId],
      );
      const actions = [];
      if (vendorName) {
        if (authorities.canHireInvoice) {
          actions.push(action('hireInvoice', 'Hire Invoice', 'info', true, {
            randomId, vendorId,
          }));
        }
        if (showHirePaymentAdvice) {
          actions.push(action('paymentAdvice', 'Payment Advice', 'warning', true, {
            randomId,
            vendorId,
            amount: '0',
            desc: 'Hire Income',
            invType: 'Hire Income Payment',
          }));
        }
      }
      lines.push({
        key: `hire-income-${slave1Id}`,
        name: 'Hire Income',
        description: 'Hire Invoice',
        vendorId,
        vendorName,
        totalPaid: pay.totalPaid,
        lastPaidDate: pay.lastPaidDate,
        actions,
      });
    }

    // Address Commission
    {
      const vendorId = trip.ADD_COMM_VENDOR != null ? String(trip.ADD_COMM_VENDOR) : '';
      const vendorName = await getVendorName(pool, vendorId);
      const pct = trip.ADD_COMM_EST != null ? String(trip.ADD_COMM_EST) : '';
      const amount = trip.ADD_COMM_CAL_EST != null ? String(trip.ADD_COMM_CAL_EST) : '';
      const desc = `Add Comm(${pct}%)`;
      const pay = await getPaymentSummary(
        pool,
        `SELECT SUM(P_AMT) AS P_AMT, P_DATE
         FROM invoice_tcother_master
         WHERE COMID = ? AND INV_IDENTITY = 'Address Commission Invoice'
         ORDER BY INVOICEID DESC`,
        [comId],
      );
      const actions = [];
      if (vendorName) {
        actions.push(action('otherInvoice', 'Add Comm Invoice', 'info', true, {
          randomId, vendorId, amount, desc, invType: 'Address Commission Invoice',
        }));
      }
      lines.push({
        key: `add-comm-${slave1Id}`,
        name: 'Address Commission',
        description: desc,
        vendorId,
        vendorName,
        totalPaid: pay.totalPaid,
        lastPaidDate: pay.lastPaidDate,
        actions,
      });
    }

    // Charterers side Broker Comm
    {
      const vendorId = trip.BROKER_COMM_VENDOR != null ? String(trip.BROKER_COMM_VENDOR) : '';
      const vendorName = await getVendorName(pool, vendorId);
      const pct = trip.BROKER_COMM_EST != null ? String(trip.BROKER_COMM_EST) : '';
      const amount = trip.BROKER_COMM_CAL_EST != null ? String(trip.BROKER_COMM_CAL_EST) : '';
      const desc = `Brokers Comm(${pct}%)`;
      const pay = await getPaymentSummary(
        pool,
        `SELECT SUM(P_AMT) AS P_AMT, P_DATE
         FROM payment_tcother_master
         WHERE COMID = ? AND INV_IDENTITY = 'Brokers Commission'
         ORDER BY PAYMENTID DESC`,
        [comId],
      );
      const actions = [];
      if (vendorName) {
        actions.push(action('otherInvoice', "Broker's Comm Invoice", 'info', true, {
          randomId, vendorId, amount, desc, invType: 'Brokers Commission Invoice',
        }));
        actions.push(action('paymentAdvice', 'Payment Advice', 'warning', true, {
          randomId, vendorId, amount, desc, invType: 'Brokers Commission',
        }));
      }
      lines.push({
        key: `broker-comm-${slave1Id}`,
        name: 'Charterers side Broker Comm',
        description: `Charterers side Broker(${pct}%)`,
        vendorId,
        vendorName,
        totalPaid: pay.totalPaid,
        lastPaidDate: pay.lastPaidDate,
        actions,
      });
    }

    // Owners side Brokerage commission (chartering_tc_estimate_slave2)
    {
      const [ownerBrokers] = await pool.query(
        `SELECT *
         FROM chartering_tc_estimate_slave2
         WHERE TC_SLAVE1ID = ?`,
        [slave1Id],
      ).catch(() => [[]]);

      for (const row of ownerBrokers || []) {
        const vendorId = row.BRO_COMM_VENDOR != null ? String(row.BRO_COMM_VENDOR) : '';
        const vendorName = await getVendorName(pool, vendorId);
        if (!vendorName) continue;
        const pct = row.BROKERAGE_COMM != null ? String(row.BROKERAGE_COMM) : '';
        const amount = row.BROKERAGE_COMM_AMT != null ? String(row.BROKERAGE_COMM_AMT) : '';
        const rowRandomId = row.RANDOMID != null ? String(row.RANDOMID) : randomId;
        const desc = `Owner side Brokers Comm(${pct}%)`;
        const pay = await getPaymentSummary(
          pool,
          `SELECT SUM(P_AMT) AS P_AMT, P_DATE
           FROM payment_tcother_master
           WHERE COMID = ? AND INV_IDENTITY = 'Owner side Broker'
           ORDER BY PAYMENTID DESC`,
          [comId],
        );
        lines.push({
          key: `owner-broker-${slave1Id}-${row.TC_SLAVE2ID || row.RANDOMID || pct}`,
          name: 'Owners side Brokerage commission',
          description: `Owners side Brokerage commission(%)(${pct}%)`,
          vendorId,
          vendorName,
          totalPaid: pay.totalPaid,
          lastPaidDate: pay.lastPaidDate,
          actions: [
            action('otherInvoice', 'Invoice', 'info', true, {
              randomId: rowRandomId, vendorId, amount, desc, invType: 'Owner side Broker',
            }),
            action('paymentAdvice', 'Payment Advice', 'warning', true, {
              randomId: rowRandomId, vendorId, amount, desc, invType: 'Owner side Broker',
            }),
          ],
        });
      }
    }

    // Other Income (STATUS=1)
    {
      const [incomeRows] = await pool.query(
        `SELECT DESCRIPTION, OTHER_AMT, OTHER_EXP_VENDOR
         FROM chartering_estimate_tc_slave2
         WHERE STATUS = 1 AND TC_SLAVE1ID = ?`,
        [slave1Id],
      ).catch(() => [[]]);

      for (const [idx, row] of (incomeRows || []).entries()) {
        const vendorId = row.OTHER_EXP_VENDOR != null ? String(row.OTHER_EXP_VENDOR) : '';
        const vendorName = await getVendorName(pool, vendorId);
        const desc = row.DESCRIPTION || '';
        const amount = row.OTHER_AMT != null ? String(row.OTHER_AMT) : '';
        const actions = [];
        if (vendorName) {
          actions.push(action('otherInvoice', 'Invoice', 'info', true, {
            randomId, vendorId, amount, desc, invType: 'Other Income Invoice',
          }));
          actions.push(action('paymentAdvice', 'Payment Advice', 'warning', false));
        }
        lines.push({
          key: `other-income-${slave1Id}-${idx}`,
          name: 'Other Income',
          description: desc,
          vendorId,
          vendorName,
          totalPaid: '',
          lastPaidDate: '',
          actions,
        });
      }
    }

    // Other Expense (STATUS=2)
    {
      const [expenseRows] = await pool.query(
        `SELECT EXPENSETYPEID, DESCRIPTION, OTHER_AMT, OTHER_EXP_VENDOR
         FROM chartering_estimate_tc_slave2
         WHERE STATUS = 2 AND TC_SLAVE1ID = ?`,
        [slave1Id],
      ).catch(() => [[]]);

      for (const [idx, row] of (expenseRows || []).entries()) {
        const vendorId = row.OTHER_EXP_VENDOR != null ? String(row.OTHER_EXP_VENDOR) : '';
        const vendorName = await getVendorName(pool, vendorId);
        const expenseName = await getExpenseTypeName(pool, row.EXPENSETYPEID);
        const ownerName = await getOwnerRelatedName(pool, row.DESCRIPTION);
        const desc = `${expenseName} (${ownerName})`;
        const amount = row.OTHER_AMT != null ? String(row.OTHER_AMT) : '';
        const descId = row.DESCRIPTION != null ? String(row.DESCRIPTION) : '';

        let totalPaid = '';
        let lastPaidDate = '';
        if (vendorId) {
          const pay = await getPaymentSummary(
            pool,
            `SELECT SUM(P_AMT) AS P_AMT, P_DATE
             FROM payment_tcother_master
             WHERE COMID = ? AND INV_IDENTITY = 'Other Payment'
               AND RANDOMID = ? AND VENDOR = ?
             ORDER BY PAYMENTID DESC`,
            [comId, randomId, vendorId],
          );
          const req = await getPaymentSummary(
            pool,
            `SELECT SUM(P_AMT) AS P_AMT, P_DATE
             FROM request_mastertc
             WHERE COMID = ? AND VENDOR = ?
             ORDER BY REQ_ID DESC`,
            [comId, vendorId],
          );
          const sum = (Number(pay.totalPaid) || 0) + (Number(req.totalPaid) || 0);
          totalPaid = sum ? String(sum) : (pay.totalPaid || req.totalPaid || '');
          lastPaidDate = pay.lastPaidDate || req.lastPaidDate || '';
        }

        const actions = [];
        if (vendorName) {
          actions.push(action('otherInvoice', 'Invoice', 'info', true, {
            randomId, vendorId, amount, desc, invType: 'Other Expense Invoice',
          }));
          actions.push(action('paymentAdvice', 'Payment Advice', 'warning', true, {
            randomId, vendorId, amount, desc, invType: 'Other Payment', descId,
          }));
        }

        lines.push({
          key: `other-expense-${slave1Id}-${idx}`,
          name: 'Other Expense',
          description: desc,
          vendorId,
          vendorName,
          totalPaid,
          lastPaidDate,
          actions,
        });
      }
    }

    // Hire Expense
    {
      const vendorId = trip.TC_FINAL_HIERAGE_VENDOR != null
        ? String(trip.TC_FINAL_HIERAGE_VENDOR)
        : '';
      const vendorName = await getVendorName(pool, vendorId);
      const pay = await getPaymentSummary(
        pool,
        `SELECT SUM(P_AMT) AS P_AMT, P_DATE
         FROM invoice_hiretc_master
         WHERE COMID = ?
         ORDER BY INVOICEID DESC`,
        [comId],
      );
      const actions = [];
      if (vendorName && authorities.canHireStatement) {
        actions.push(action('hireStatement', 'Hire Statement', 'danger', true, {
          randomId, vendorId,
        }));
      }
      lines.push({
        key: `hire-expense-${slave1Id}`,
        name: 'Hire Expense',
        description: 'Hireage Invoice',
        vendorId,
        vendorName,
        totalPaid: pay.totalPaid,
        lastPaidDate: pay.lastPaidDate,
        actions,
      });
    }

    trips.push({
      tripIndex,
      slave1Id: String(slave1Id),
      randomId,
      periodLabel,
      lines,
    });
  }

  return {
    comId: String(comId),
    tcOutId: String(master.TCOUTID),
    tcNo: master.TC_NO || '',
    vesselName: master.VESSEL_NAME || '',
    trips,
  };
}

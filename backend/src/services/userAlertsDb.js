import { getPool } from '../db.js';

const HOLD_STATUS_TABLE = {
  'HIRE STATEMENT': { table: 'invoice_hire_master', idCol: 'INVOICEID' },
  PAYMENT: { table: 'request_master', idCol: 'REQ_ID' },
  'TC HIRE STATEMENT': { table: 'invoice_hiretc_master', idCol: 'INVOICEID' },
  'COMBINED SOA PAYABLE': { table: 'combined_soa_payable_master', idCol: 'SOAID' },
  'COMBINED SOA PAYABLE TC': { table: 'combined_soa_payable_master_tc', idCol: 'SOAID' },
  'FREIGHT INVOICE': { table: 'freight_invoice_master', idCol: 'INVOICEID' },
  'FREIGHT PAYMENT': { table: 'freight_invoice_master', idCol: 'INVOICEID' },
  'OTHER INVOICE': { table: 'other_invoice_master', idCol: 'INVOICEID' },
  FDA: { table: 'loadport_cost_master', idCol: 'LP_COST_ID' },
  'HIRE INVOICE': { table: 'invoice_tchire_master', idCol: 'INVOICEID' },
  'OTHER TC PAYMENT': { table: 'payment_tcother_master', idCol: 'PAYMENTID' },
  'GENERIC INVOICE': { table: 'generic_invoice_master', idCol: 'INVOICEID' },
};

const PHP_TO_REACT = {
  'invoice.php': '/internal-user/vc/ops/freight-invoice',
  'other_invoice.php': '/internal-user/vc/ops/other-invoice',
  'hire_statement.php': '/internal-user/vc/ops/hire-statement',
  'hirestatement.php': '/internal-user/vc/ops/hire-statement',
  'request.php': '/internal-user/vc/ops/request-port-cost',
  'request_port_cost.php': '/internal-user/vc/ops/request-port-cost',
  'generic_invoice.php': '/internal-user/vc/generic-finances/add',
  'add_generic_invoice.php': '/internal-user/vc/generic-finances/add',
  'payment_grid.php': '/internal-user/vc/ops/payment-grid',
  'clubbed_invoice.php': '/internal-user/vc/ops/clubbed-invoice',
  'todo_list.php': '/internal-user/vc/todo-list',
};

function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 1971) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d} ${months[date.getMonth()]} ${date.getFullYear()} ${hh}:${mm}`;
}

function isHoldStatus(status) {
  return String(status || '').trim() === 'payment_hold';
}

function mapRedirectToReact(redirectTo, alertId) {
  const raw = String(redirectTo || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, 'http://local.invalid/');
    const file = (url.pathname.split('/').pop() || '').toLowerCase();
    const params = url.searchParams;
    if (alertId && !params.get('alertid')) params.set('alertid', String(alertId));
    if (params.has('invtype') && !params.has('invType')) {
      params.set('invType', params.get('invtype'));
    }
    if (file === 'updateginvoice.php') {
      const invoiceId = params.get('id') || params.get('invoiceId');
      if (invoiceId) {
        return `/internal-user/vc/generic-finances/${encodeURIComponent(invoiceId)}/edit`;
      }
    }
    const qs = params.toString();
    const reactPath = PHP_TO_REACT[file];
    if (reactPath) return qs ? `${reactPath}?${qs}` : reactPath;
    if (raw.startsWith('/internal-user/')) {
      return qs ? `${url.pathname}?${qs}` : url.pathname;
    }
  } catch {
    /* keep original */
  }
  const joiner = raw.includes('?') ? '&' : '?';
  return alertId ? `${raw}${joiner}alertid=${encodeURIComponent(alertId)}` : raw;
}

async function paymentStatusFor(pool, identify, identifyId) {
  const spec = HOLD_STATUS_TABLE[identify];
  if (!spec || identifyId == null || identifyId === '') return null;
  try {
    const [[row]] = await pool.query(
      `SELECT PAYMENT_STATUS AS status FROM ${spec.table} WHERE ${spec.idCol} = ? LIMIT 1`,
      [identifyId],
    );
    return row ? row.status : null;
  } catch {
    return null;
  }
}

function mapAlert(row) {
  const alertId = row.ALERTID;
  return {
    alertId,
    title: row.IDENTIFY || 'Notification',
    message: row.COMMENTS || '',
    datetime: formatDateTime(row.ADDONDATE),
    identify: row.IDENTIFY || '',
    identifyId: row.IDENTIFYID != null ? String(row.IDENTIFYID) : '',
    href: mapRedirectToReact(row.REDIRECTTO, alertId),
  };
}

export async function dbListUserAlerts(userId) {
  if (userId == null || userId === '') {
    return { alerts: [], holds: [] };
  }
  const pool = getPool();
  if (!pool) return { alerts: [], holds: [] };

  const [rows] = await pool.query(
    `SELECT ALERTID, REDIRECTTO, COMMENTS, IDENTIFYID, ADDONDATE, IDENTIFY
     FROM alert_master
     WHERE CAST(SENDTO AS CHAR) = CAST(? AS CHAR)
       AND SHOW_STATUS = 1
     ORDER BY ADDONDATE DESC
     LIMIT 80`,
    [userId],
  );

  const alerts = [];
  const holds = [];
  for (const row of rows || []) {
    const identify = String(row.IDENTIFY || '');
    const mapped = mapAlert(row);
    if (!HOLD_STATUS_TABLE[identify]) {
      alerts.push(mapped);
      continue;
    }
    const status = await paymentStatusFor(pool, identify, row.IDENTIFYID);
    if (isHoldStatus(status)) holds.push(mapped);
    else alerts.push(mapped);
  }

  return { alerts, holds };
}

export async function dbListRecentWork(userId) {
  const loginId = userId == null || userId === '' ? '' : String(userId);
  if (!loginId) return [];
  const pool = getPool();
  if (!pool) return [];

  const mapRows = (rows) => (rows || [])
    .map((row) => ({
      work: String(row.WORK || row.work || '').trim(),
      datetime: formatDateTime(row.WORK_DATE || row.datetime),
    }))
    .filter((row) => row.work);

  try {
    const [rows] = await pool.query(
      `SELECT WORK, WORK_DATE
       FROM recent_work_master
       WHERE CAST(LOGINID AS CHAR) = CAST(? AS CHAR)
       ORDER BY RECENT_WORKID DESC
       LIMIT 10`,
      [loginId],
    );
    return mapRows(rows);
  } catch (error) {
    try {
      const [rows] = await pool.query(
        `SELECT WORK, WORK_DATE
         FROM recent_work_master
         WHERE CAST(LOGINID AS CHAR) = CAST(? AS CHAR)
         ORDER BY WORK_DATE DESC
         LIMIT 10`,
        [loginId],
      );
      return mapRows(rows);
    } catch (fallbackError) {
      console.error('dbListRecentWork failed:', fallbackError?.message || error?.message);
      return [];
    }
  }
}

export async function dbLogRecentWork(userId, work, poolOrConn = getPool()) {
  const loginId = userId == null || userId === '' ? '' : String(userId);
  const message = String(work || '').trim();
  if (!loginId || !message || !poolOrConn) return;
  await poolOrConn.query(
    `INSERT INTO recent_work_master (LOGINID, WORK, WORK_DATE)
     VALUES (?, ?, NOW())`,
    [loginId, message],
  ).catch((error) => {
    console.error('dbLogRecentWork failed:', error?.message);
  });
}

export async function dbDismissUserAlert(userId, alertId) {
  if (userId == null || !alertId) return { ok: false };
  const pool = getPool();
  if (!pool) return { ok: false };
  const [result] = await pool.query(
    `UPDATE alert_master
     SET SHOW_STATUS = 0
     WHERE ALERTID = ?
       AND CAST(SENDTO AS CHAR) = CAST(? AS CHAR)`,
    [alertId, userId],
  );
  return { ok: Number(result?.affectedRows || 0) > 0 };
}

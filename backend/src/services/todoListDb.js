import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const HOLDABLE_IDENTIFY = new Set([
  'HIRE STATEMENT',
  'PAYMENT',
  'TC HIRE STATEMENT',
  'COMBINED SOA PAYABLE',
  'COMBINED SOA PAYABLE TC',
  'FREIGHT INVOICE',
  'OTHER INVOICE',
  'FDA',
  'HIRE INVOICE',
  'OTHER TC PAYMENT',
  'GENERIC INVOICE',
]);

const HOLD_STATUS_TABLE = {
  'HIRE STATEMENT': { table: 'invoice_hire_master', idCol: 'INVOICEID' },
  PAYMENT: { table: 'request_master', idCol: 'REQ_ID' },
  'TC HIRE STATEMENT': { table: 'invoice_hiretc_master', idCol: 'INVOICEID' },
  'COMBINED SOA PAYABLE': { table: 'combined_soa_payable_master', idCol: 'SOAID' },
  'COMBINED SOA PAYABLE TC': { table: 'combined_soa_payable_master_tc', idCol: 'SOAID' },
  'FREIGHT INVOICE': { table: 'freight_invoice_master', idCol: 'INVOICEID' },
  'OTHER INVOICE': { table: 'other_invoice_master', idCol: 'INVOICEID' },
  FDA: { table: 'loadport_cost_master', idCol: 'LP_COST_ID' },
  'HIRE INVOICE': { table: 'invoice_tchire_master', idCol: 'INVOICEID' },
  'OTHER TC PAYMENT': { table: 'payment_tcother_master', idCol: 'PAYMENTID' },
  'GENERIC INVOICE': { table: 'generic_invoice_master', idCol: 'INVOICEID' },
};

function matchesAccountType(voyageNo, accountType) {
  const value = String(voyageNo || '');
  if (!accountType || accountType === '0') return true;
  if (accountType === 'Singapore') {
    return value.startsWith('S') || value.startsWith('TS');
  }
  if (accountType === 'Dubai') {
    return value.startsWith('U') || value.startsWith('TU');
  }
  return true;
}

function isPayableStatus(status) {
  return status == null || status === '' || status === 0 || status === '0' || status === 'payment_payable';
}

function isHoldStatus(status) {
  return status === 'payment_hold';
}

function daysSince(dateValue) {
  if (!dateValue) return 0;
  const start = new Date(dateValue);
  if (Number.isNaN(start.getTime())) return 0;
  const diff = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function statusMeta(statusCode, addonDate) {
  const days = daysSince(addonDate);
  const code = Number(statusCode);
  if (code === 0) return { statusCode: code, statusLabel: 'Submit to Edit', statusTone: 'info' };
  if (code === 1) return { statusCode: code, statusLabel: `Level 1 Approval Pending Since ${days} Days`, statusTone: 'danger' };
  if (code === 2) return { statusCode: code, statusLabel: `Sent for Review To Creator Since ${days} Days`, statusTone: 'warning' };
  if (code === 3) return { statusCode: code, statusLabel: `Level 2 Approval Pending Since ${days} Days`, statusTone: 'danger' };
  if (code === 4) return { statusCode: code, statusLabel: `Sent for Review To Approver 1 Since ${days} Days`, statusTone: 'danger' };
  return { statusCode: code, statusLabel: `Payment Received/Paid Pending Since ${days} Days`, statusTone: 'warning' };
}

async function getVendorName(pool, code) {
  if (!code) return '';
  const [[row]] = await pool.query(
    'SELECT CONCAT(NAME, \' (\', CODE, \')\') AS name FROM vendor_master WHERE CODE = ? LIMIT 1',
    [code],
  );
  return row?.name ?? String(code);
}

async function getUserName(pool, loginId) {
  if (!loginId) return '';
  const [[row]] = await pool.query(
    'SELECT CONTACT_PERSON AS name FROM login WHERE LOGINID = ? LIMIT 1',
    [loginId],
  );
  return row?.name ?? '';
}

async function getVcMeta(pool, comid) {
  if (!comid) return { voyageNo: '', vesselName: '', vesselImoId: null };
  const [[row]] = await pool.query(
    `SELECT m.VOYAGE_NO, m.VESSEL_IMO_ID, v.VESSEL_NAME, m.DTCVENDORID
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.COMID = ?
     ORDER BY m.FCAID DESC
     LIMIT 1`,
    [comid],
  );
  return {
    voyageNo: row?.VOYAGE_NO ?? '',
    vesselName: row?.VESSEL_NAME ?? '',
    vesselImoId: row?.VESSEL_IMO_ID ?? null,
    dtcVendorId: row?.DTCVENDORID ?? '',
  };
}

async function getTcMeta(pool, comid) {
  if (!comid) return { voyageNo: '', vesselName: '', vesselImoId: null, tcoutId: null };
  const [[row]] = await pool.query(
    `SELECT m.TC_NO, m.VESSEL_IMO_ID, m.TCOUTID, v.VESSEL_NAME
     FROM chartering_estimate_tc_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.COMID = ?
     ORDER BY m.TCOUTID DESC
     LIMIT 1`,
    [comid],
  );
  return {
    voyageNo: row?.TC_NO ?? '',
    vesselName: row?.VESSEL_NAME ?? '',
    vesselImoId: row?.VESSEL_IMO_ID ?? null,
    tcoutId: row?.TCOUTID ?? null,
  };
}

async function getPaymentUnlock(pool) {
  const [[row]] = await pool.query(
    'SELECT PAYMENT_UNLOCK FROM approval_matrix WHERE LOGINID = ? LIMIT 1',
    [appContext.userId],
  );
  return Number(row?.PAYMENT_UNLOCK) === 1;
}

async function resolveIdentifyDetails(pool, alert, mode) {
  const identify = alert.IDENTIFY;
  const id = alert.IDENTIFYID;

  if (identify === 'FREIGHT INVOICE') {
    const [[row]] = await pool.query(
      `SELECT COMID, INVOICEID, MESSAGE, VENDOR, STATUS, I_TYPE, PAYMENT_STATUS
       FROM freight_invoice_master WHERE INVOICEID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getVcMeta(pool, row.COMID);
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: `${row.I_TYPE || ''} Freight Invoice`.trim(),
      invoiceNo: row.MESSAGE ?? '',
      payType: mode === 'hold' ? 'HOLD' : 'Payable',
      vendorCode: row.VENDOR,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
    };
  }

  if (identify === 'FREIGHT PAYMENT') {
    const [[row]] = await pool.query(
      `SELECT COMID, INVOICEID, MESSAGE, VENDOR, STATUS, I_TYPE, PAYMENT_STATUS
       FROM freight_invoice_in_master WHERE INVOICEID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getVcMeta(pool, row.COMID);
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: `${row.I_TYPE || ''}FREIGHT PAYMENT`,
      invoiceNo: row.MESSAGE ?? '',
      payType: mode === 'hold' ? 'HOLD' : 'Receivable',
      vendorCode: row.VENDOR,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
    };
  }

  if (identify === 'GENERIC INVOICE') {
    const [[row]] = await pool.query(
      'SELECT * FROM generic_invoice_master WHERE INVOICEID = ? LIMIT 1',
      [id],
    );
    if (!row) return null;
    return {
      comid: row.COMID,
      voyageNo: row.INVOICE_NO ?? '',
      vesselName: 'GENERIC INVOICE',
      formName: `${row.I_TYPE || ''} Generic Invoice`.trim(),
      invoiceNo: row.REMARKS ?? '',
      payType: mode === 'hold' ? 'HOLD' : (row.TYPE === 'payment' ? 'Payable' : 'Receivable'),
      vendorCode: row.VENDOR,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
    };
  }

  if (identify === 'OTHER INVOICE') {
    const [[row]] = await pool.query(
      `SELECT COMID, INVOICEID, MESSAGE, VENDOR, STATUS, P_TYPE, PAYMENT_STATUS
       FROM other_invoice_master WHERE INVOICEID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getVcMeta(pool, row.COMID);
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: row.P_TYPE || 'Other Invoice',
      invoiceNo: row.MESSAGE ?? '',
      payType: mode === 'hold' ? 'HOLD' : 'Receivable',
      vendorCode: row.VENDOR,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
    };
  }

  if (identify === 'HIRE STATEMENT') {
    const [[row]] = await pool.query(
      `SELECT COMID, INVOICEID, INVOICE_NO, INVOICE_TYPE, PAYMENT_STATUS, STATUS
       FROM invoice_hire_master WHERE INVOICEID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getVcMeta(pool, row.COMID);
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: 'Hire Statement',
      invoiceNo: row.INVOICE_NO ?? '',
      payType: mode === 'hold' ? 'HOLD' : 'Payable',
      vendorCode: meta.dtcVendorId,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
      invoiceType: row.INVOICE_TYPE ?? '',
    };
  }

  if (identify === 'PAYMENT') {
    const [[row]] = await pool.query(
      `SELECT COMID, REQ_ID, PAYMENT_NO, VENDOR, STATUS, NAME, PAYMENT_STATUS
       FROM request_master WHERE REQ_ID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getVcMeta(pool, row.COMID);
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: row.NAME || 'Payment',
      invoiceNo: row.PAYMENT_NO ?? '',
      payType: mode === 'hold' ? 'HOLD' : 'PAYABLE',
      vendorCode: row.VENDOR,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
    };
  }

  if (identify === 'FDA') {
    const [[row]] = await pool.query(
      `SELECT COMID, LP_COST_ID, SUBMITID, PORT, PORTID, RANDOMID, PAYMENT_STATUS
       FROM loadport_cost_master WHERE LP_COST_ID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getVcMeta(pool, row.COMID);
    const [[port]] = await pool.query(
      'SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1',
      [row.PORTID],
    );
    let vendorCode = '';
    const [[fca]] = await pool.query(
      `SELECT FCAID FROM freight_cost_estimete_master WHERE COMID = ? ORDER BY FCAID DESC LIMIT 1`,
      [row.COMID],
    );
    if (fca?.FCAID) {
      const [[slave]] = await pool.query(
        `SELECT PORT_COSTLP_VENDOR, PORT_COSTDP_VENDOR, PORT_COSTTP_VENDOR
         FROM freight_cost_estimete_slave1 WHERE FCAID = ? AND RANDOMID = ? LIMIT 1`,
        [fca.FCAID, row.RANDOMID],
      );
      if (row.PORT === 'LP') vendorCode = slave?.PORT_COSTLP_VENDOR ?? '';
      if (row.PORT === 'DP') vendorCode = slave?.PORT_COSTDP_VENDOR ?? '';
      if (row.PORT === 'TP') vendorCode = slave?.PORT_COSTTP_VENDOR ?? '';
    }
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: 'FDA',
      invoiceNo: `${row.PORT || ''} - ${port?.PortName || row.PORTID || ''}`.trim(),
      payType: mode === 'hold' ? 'HOLD' : 'Payable',
      vendorCode,
      status: row.SUBMITID,
      paymentStatus: row.PAYMENT_STATUS,
    };
  }

  if (identify === 'HIRE INVOICE') {
    const [[row]] = await pool.query(
      `SELECT COMID, INVOICEID, INVOICE_NO, RANDOMID, STATUS, INVOICE_TYPE, PAYMENT_STATUS
       FROM invoice_tchire_master WHERE INVOICEID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getTcMeta(pool, row.COMID);
    let vendorCode = '';
    if (meta.tcoutId) {
      const [[slave]] = await pool.query(
        `SELECT TTL_REV_VENDOR FROM chartering_tc_estimate_slave1
         WHERE TCOUTID = ? AND RANDOMID = ? LIMIT 1`,
        [meta.tcoutId, row.RANDOMID],
      );
      vendorCode = slave?.TTL_REV_VENDOR ?? '';
    }
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: `${String(row.INVOICE_TYPE || '').replace(/\b\w/g, (c) => c.toUpperCase())} TC Hire Invoice`.trim(),
      invoiceNo: row.INVOICE_NO ?? '',
      payType: mode === 'hold' ? 'HOLD' : 'Receivable',
      vendorCode,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
      invoiceType: row.INVOICE_TYPE ?? '',
    };
  }

  if (identify === 'TC HIRE STATEMENT') {
    const [[row]] = await pool.query(
      `SELECT COMID, INVOICEID, INVOICE_NO, RANDOMID, STATUS, INVOICE_TYPE, PAYMENT_STATUS
       FROM invoice_hiretc_master WHERE INVOICEID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getTcMeta(pool, row.COMID);
    let vendorCode = '';
    if (meta.tcoutId) {
      const [[slave]] = await pool.query(
        `SELECT TC_FINAL_HIERAGE_VENDOR FROM chartering_tc_estimate_slave1
         WHERE TCOUTID = ? AND RANDOMID = ? LIMIT 1`,
        [meta.tcoutId, row.RANDOMID],
      );
      vendorCode = slave?.TC_FINAL_HIERAGE_VENDOR ?? '';
    }
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: `${row.INVOICE_TYPE || ''} TC Hire Statement`.trim(),
      invoiceNo: row.INVOICE_NO ?? '',
      payType: mode === 'hold' ? 'HOLD' : 'Payable',
      vendorCode,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
      invoiceType: row.INVOICE_TYPE ?? '',
    };
  }

  if (identify === 'OTHER TC PAYMENT') {
    const [[row]] = await pool.query(
      `SELECT PAYMENTID, COMID, INVOICE_NO, RANDOMID, STATUS, VENDOR, SHORT_DESC, PAYMENT_STATUS
       FROM payment_tcother_master WHERE PAYMENTID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getTcMeta(pool, row.COMID);
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: 'Other TC Payment',
      invoiceNo: row.INVOICE_NO ?? '',
      payType: mode === 'hold' ? 'HOLD' : 'Payable',
      vendorCode: row.VENDOR,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
    };
  }

  if (identify === 'OTHER TC INVOICE') {
    const [[row]] = await pool.query(
      `SELECT COMID, INVOICEID, MESSAGE, VENDOR, STATUS, SHORT_DESC, PAYMENT_STATUS
       FROM invoice_tcother_master WHERE INVOICEID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getTcMeta(pool, row.COMID);
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: row.SHORT_DESC || 'Other TC Invoice',
      invoiceNo: row.MESSAGE ?? '',
      payType: mode === 'hold' ? 'HOLD' : 'Receivable',
      vendorCode: row.VENDOR,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
    };
  }

  if (identify === 'LAYTIME') {
    const [[row]] = await pool.query(
      `SELECT COMID, LAYTIME_ID, STATUS, PAYMENT_STATUS
       FROM laytime_master WHERE LAYTIME_ID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = await getVcMeta(pool, row.COMID);
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: 'LAYTIME',
      invoiceNo: '',
      payType: mode === 'hold' ? 'HOLD' : 'Receivable',
      vendorCode: '',
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
    };
  }

  if (identify === 'COMBINED SOA PAYABLE' || identify === 'COMBINED SOA PAYABLE TC') {
    const table = identify === 'COMBINED SOA PAYABLE TC'
      ? 'combined_soa_payable_master_tc'
      : 'combined_soa_payable_master';
    const [[row]] = await pool.query(
      `SELECT SOAID, COMID, SOA_NO, VENDOR, STATUS, PAYMENT_STATUS
       FROM ${table} WHERE SOAID = ? LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const meta = identify.includes('TC')
      ? await getTcMeta(pool, row.COMID)
      : await getVcMeta(pool, row.COMID);
    return {
      comid: row.COMID,
      voyageNo: meta.voyageNo,
      vesselName: meta.vesselName,
      formName: identify,
      invoiceNo: row.SOA_NO ?? '',
      payType: mode === 'hold' ? 'HOLD' : 'Payable',
      vendorCode: row.VENDOR,
      status: row.STATUS,
      paymentStatus: row.PAYMENT_STATUS,
    };
  }

  return null;
}

function buildEditHref(alert, comid) {
  if (alert.REDIRECTTO) {
    const base = String(alert.REDIRECTTO);
    const joiner = base.includes('?') ? '&' : '?';
    return `${base}${joiner}alertid=${alert.ALERTID}`;
  }
  return `payment_grid.php?comid=${comid || ''}&alertid=${alert.ALERTID}`;
}

async function buildTodoRecords({ mode, accountType, search = '' }) {
  const pool = getPool();
  const paymentUnlock = await getPaymentUnlock(pool);
  const [alerts] = await pool.query(
    `SELECT ALERTID, IDENTIFY, IDENTIFYID, ADDONDATE, REDIRECTTO, ALTERED_BY, AL_REM
     FROM alert_master
     WHERE SHOW_STATUS = 1 AND SENDTO = ?
     ORDER BY ADDONDATE DESC`,
    [appContext.userId],
  );

  const records = [];
  let index = 0;

  for (const alert of alerts) {
    const details = await resolveIdentifyDetails(pool, alert, mode);
    if (!details) continue;

    const isAccrual = String(details.invoiceType || '').toLowerCase() === 'accrual';
    if (mode === 'hold') {
      if (!isHoldStatus(details.paymentStatus) && !isAccrual) continue;
    } else if (isHoldStatus(details.paymentStatus) || isAccrual || !isPayableStatus(details.paymentStatus)) {
      continue;
    }

    if (!matchesAccountType(details.voyageNo, accountType)) continue;

    const vendor = await getVendorName(pool, details.vendorCode);
    const holdBy = await getUserName(pool, alert.ALTERED_BY);
    const status = statusMeta(details.status, alert.ADDONDATE);
    const haystack = [
      details.vesselName,
      details.voyageNo,
      details.formName,
      details.invoiceNo,
      details.payType,
      vendor,
      holdBy,
      status.statusLabel,
    ].join(' ').toLowerCase();

    if (search && !haystack.includes(String(search).toLowerCase())) continue;

    index += 1;
    records.push({
      index,
      alertId: alert.ALERTID,
      identify: alert.IDENTIFY,
      identifyId: alert.IDENTIFYID,
      comid: details.comid,
      vessel: details.vesselName,
      voyageNo: details.voyageNo,
      formName: details.formName,
      invoiceNo: details.invoiceNo,
      payType: details.payType,
      holdBy,
      vendor,
      ...status,
      date: formatDateDMY(alert.ADDONDATE),
      docsHref: details.comid ? `documents.php?comid=${details.comid}&page=1` : '',
      editHref: buildEditHref(alert, details.comid),
      alRem: alert.AL_REM ?? '',
      paymentUnlock,
      canHold: paymentUnlock && mode === 'payable' && HOLDABLE_IDENTIFY.has(alert.IDENTIFY),
      canUnhold: paymentUnlock && mode === 'hold' && HOLDABLE_IDENTIFY.has(alert.IDENTIFY),
    });
  }

  return {
    records,
    recordsTotal: records.length,
    paymentUnlock,
    accountType: accountType || '',
    mode,
  };
}

export async function dbGetTodoList({ tab = 'hold', accountType = '', search = '' } = {}) {
  const mode = tab === 'payable' ? 'payable' : 'hold';
  return buildTodoRecords({ mode, accountType, search });
}

export async function dbInactiveTodoAlert(alertId) {
  const pool = getPool();
  const [result] = await pool.query(
    'UPDATE alert_master SET SHOW_STATUS = 0 WHERE ALERTID = ? AND SENDTO = ?',
    [alertId, appContext.userId],
  );
  if (!result.affectedRows) throw new Error('Alert not found.');
  return { msg: 0 };
}

export async function dbUpdateTodoAlRem({ identify, identifyId, value }) {
  const pool = getPool();
  const [result] = await pool.query(
    'UPDATE alert_master SET AL_REM = ? WHERE IDENTIFYID = ? AND IDENTIFY = ?',
    [value ?? '', identifyId, identify],
  );
  if (!result.affectedRows) throw new Error('Alert not found.');
  return { msg: 0 };
}

export async function dbSetTodoPaymentStatus({ identify, identifyId, status }) {
  const mapping = HOLD_STATUS_TABLE[identify];
  if (!mapping) throw new Error('Unsupported payment type.');

  const pool = getPool();
  await pool.query(
    'UPDATE alert_master SET ALTERED_BY = ? WHERE IDENTIFYID = ?',
    [appContext.userId, identifyId],
  );
  const [result] = await pool.query(
    `UPDATE ${mapping.table} SET PAYMENT_STATUS = ? WHERE ${mapping.idCol} = ?`,
    [status, identifyId],
  );
  if (!result.affectedRows) throw new Error('Payment record not found.');
  return { msg: 0 };
}

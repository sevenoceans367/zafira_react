import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

const STATUS_LABELS = {
  0: 'Submit to Edit',
  1: 'Level 1 Approval Pending',
  2: 'Sent for Review To Creator',
  3: 'Level 2 Approval Pending',
  4: 'Sent for Review To Approver 1',
  5: 'Pending for Payment',
};

const VARIANTS = {
  vc: {
    masterTable: 'combined_soa_payable_master',
    requestTable: 'request_master',
    editHref: (soaId) => `updatecombinedpayablesoa.php?id=${soaId}`,
  },
  tc: {
    masterTable: 'combined_soa_payable_master_tc',
    requestTable: 'request_mastertc',
    editHref: (soaId) => `updatecombinedpayablesoa_tc.php?id=${soaId}`,
  },
};

function resolveVariant(variant = 'vc') {
  return VARIANTS[variant] || VARIANTS.vc;
}

export function mapCombinedSoaPayableStatus(status) {
  const code = Number(status);
  const label = STATUS_LABELS[code] || 'Paid';
  let tone = 'success';
  if (label === 'Level 1 Approval Pending' || label === 'Level 2 Approval Pending') {
    tone = 'warning';
  } else if (label !== 'Paid') {
    tone = 'danger';
  }
  return { statusCode: code, statusLabel: label, statusTone: tone };
}

function formatSoaDate(value) {
  const formatted = formatDateDMY(value);
  if (!formatted || formatted === '01-01-1970') return '';
  return formatted;
}

export async function dbGetCombinedSoaPayableCreatorAccess(userId = appContext.userId) {
  const pool = getPool();
  try {
    const [[row]] = await pool.query(
      `SELECT SOA_CHK_CRETR
       FROM approval_matrix
       WHERE MCOMPANYID = ? AND LOGINID = ?
       LIMIT 1`,
      [COMPANY_ID, userId],
    );
    return Number(row?.SOA_CHK_CRETR) === 1;
  } catch {
    return true;
  }
}

export async function dbListCombinedSoaPayable({
  search = '',
  page = 1,
  pageSize = 50,
  variant = 'vc',
} = {}) {
  const config = resolveVariant(variant);
  const pool = getPool();
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Math.min(200, Number(pageSize) || 50));
  const offset = (safePage - 1) * safeSize;

  const conditions = ['1=1'];
  const params = [];

  if (search) {
    const like = `%${String(search).trim()}%`;
    conditions.push(`(
      m.SOA_NO LIKE ?
      OR DATE_FORMAT(m.SOA_DATE, '%d-%m-%Y') LIKE ?
      OR vm.NAME LIKE ?
      OR CAST(IFNULL(amt.SOA_AMOUNT, 0) AS CHAR) LIKE ?
      OR creator.CONTACT_PERSON LIKE ?
      OR CASE
        WHEN m.STATUS = 0 THEN 'Submit to Edit'
        WHEN m.STATUS = 1 THEN 'Level 1 Approval Pending'
        WHEN m.STATUS = 2 THEN 'Sent for Review To Creator'
        WHEN m.STATUS = 3 THEN 'Level 2 Approval Pending'
        WHEN m.STATUS = 4 THEN 'Sent for Review To Approver 1'
        WHEN m.STATUS = 5 THEN 'Pending for Payment'
        ELSE 'Paid'
      END LIKE ?
    )`);
    params.push(like, like, like, like, like, like);
  }

  const where = conditions.join(' AND ');

  const baseFrom = `
    FROM ${config.masterTable} m
    LEFT JOIN vendor_master vm ON vm.CODE = m.VENDOR
    LEFT JOIN login creator ON creator.LOGINID = m.CREATOR
    LEFT JOIN (
      SELECT SOAID, SUM(TTL_OUTSTANDINGS) AS SOA_AMOUNT
      FROM ${config.requestTable}
      GROUP BY SOAID
    ) amt ON amt.SOAID = m.SOAID
  `;

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total ${baseFrom} WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
        m.SOAID,
        m.SOA_NO,
        m.SOA_DATE,
        m.STATUS,
        m.VENDOR,
        vm.NAME AS VENDOR_NAME,
        creator.CONTACT_PERSON AS CREATOR_NAME,
        amt.SOA_AMOUNT
     ${baseFrom}
     WHERE ${where}
     ORDER BY m.SOAID DESC
     LIMIT ? OFFSET ?`,
    [...params, safeSize, offset],
  );

  const records = rows.map((row, index) => {
    const status = mapCombinedSoaPayableStatus(row.STATUS);
    return {
      index: offset + index + 1,
      soaId: row.SOAID,
      soaNo: row.SOA_NO ?? '',
      soaDate: formatSoaDate(row.SOA_DATE),
      vendor: row.VENDOR_NAME ?? '',
      soaAmount: row.SOA_AMOUNT != null ? String(row.SOA_AMOUNT) : '',
      creator: row.CREATOR_NAME ?? '',
      statusCode: status.statusCode,
      statusLabel: status.statusLabel,
      statusTone: status.statusTone,
      editHref: config.editHref(row.SOAID),
    };
  });

  return {
    records,
    recordsTotal: Number(countRow?.total || 0),
    page: safePage,
    pageSize: safeSize,
  };
}

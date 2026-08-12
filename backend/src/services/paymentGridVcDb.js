import { appContext } from '../config.js';
import { getPool } from '../db.js';
import { formatDateDMY } from './estimateListMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;

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

function str(value) {
  if (value == null || value === '') return '';
  return String(value);
}

function isNullishFlag(value) {
  return value == null || value === '' || String(value).toLowerCase() === 'null';
}

function money2(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

function joinInvoiceId(parts) {
  return parts.map((part) => (part == null || part === '' ? '0' : String(part))).join(',');
}

/** React freight invoice page for Initial/Final actions. */
function freightInvoiceHref({
  invoiceId,
  name,
  page = '1',
  invType,
  voyageNo = '',
  vcIn = false,
}) {
  const params = new URLSearchParams();
  params.set('id', invoiceId);
  params.set('name', name);
  params.set('page', String(page || '1'));
  params.set('invType', invType);
  if (voyageNo) params.set('voyageNo', String(voyageNo));
  if (vcIn) params.set('vcIn', '1');
  return `/internal-user/vc/ops/freight-invoice?${params.toString()}`;
}

function otherInvoiceHref({
  id,
  name,
  amountTitle = '',
  page = '1',
  voyageNo = '',
  portType = '',
  randomId = '',
  portId = '',
}) {
  const params = new URLSearchParams();
  params.set('id', id);
  params.set('name', name);
  params.set('page', String(page || '1'));
  if (amountTitle) params.set('amountTitle', amountTitle);
  if (portType) params.set('portType', portType);
  if (randomId) params.set('randomId', String(randomId));
  if (portId) params.set('portId', String(portId));
  if (voyageNo) params.set('voyageNo', String(voyageNo));
  return `/internal-user/vc/ops/other-invoice?${params.toString()}`;
}

function hireStatementHref({ comId, page = '1', voyageNo = '' }) {
  const params = new URLSearchParams();
  params.set('comId', comId);
  params.set('page', String(page || '1'));
  if (voyageNo) params.set('voyageNo', String(voyageNo));
  return `/internal-user/vc/ops/hire-statement?${params.toString()}`;
}

function clubbedInvoiceHref({
  invoiceId,
  name,
  page = '1',
  invType = 'Final',
  voyageNo = '',
}) {
  const params = new URLSearchParams();
  params.set('id', invoiceId);
  params.set('name', name);
  params.set('page', String(page || '1'));
  params.set('invType', invType);
  if (voyageNo) params.set('voyageNo', String(voyageNo));
  return `/internal-user/vc/ops/clubbed-invoice?${params.toString()}`;
}

function clubbedHireHref({ comId, page = '1', voyageNo = '' }) {
  const params = new URLSearchParams();
  params.set('comId', comId);
  params.set('page', String(page || '1'));
  if (voyageNo) params.set('voyageNo', String(voyageNo));
  return `/internal-user/vc/ops/clubbed-hire?${params.toString()}`;
}

/** React Operational Costs (Others) payment page. */
function requestPortCostHref({
  id,
  name,
  page = '1',
  voyageNo = '',
}) {
  const params = new URLSearchParams();
  params.set('id', id);
  params.set('name', name);
  params.set('page', String(page || '1'));
  if (voyageNo) params.set('voyageNo', String(voyageNo));
  return `/internal-user/vc/ops/request-port-cost?${params.toString()}`;
}

function freightInvoiceActions({ invoiceId, name, page, voyageNo }) {
  return [
    action('initialInvoice', 'Initial Invoice', 'warning', true, {
      href: freightInvoiceHref({
        invoiceId,
        name,
        page,
        invType: 'Interim',
        voyageNo,
      }),
    }),
    action('finalInvoice', 'Final Invoice', 'info', true, {
      href: freightInvoiceHref({
        invoiceId,
        name,
        page,
        invType: 'Final',
        voyageNo,
      }),
    }),
  ];
}

function action(key, label, variant, enabled = true, params = {}) {
  const { migrated, href, ...rest } = params;
  return {
    key,
    label,
    variant,
    enabled: Boolean(enabled),
    href: href || '',
    migrated: migrated != null ? Boolean(migrated) : Boolean(href),
    ...rest,
  };
}

function badge(label, tone = 'warning') {
  return { label, tone };
}

function line(partial) {
  return {
    key: partial.key,
    name: partial.name || '',
    description: partial.description || '',
    vendorId: partial.vendorId || '',
    vendorName: partial.vendorName || '',
    totalPaid: partial.totalPaid ?? '',
    lastPaidDate: partial.lastPaidDate ?? '',
    voyageId: partial.voyageId ?? '',
    actions: partial.actions || [],
    badges: partial.badges || [],
    highlight: Boolean(partial.highlight),
    isGroupHeader: Boolean(partial.isGroupHeader),
  };
}

async function getVendorName(pool, code) {
  if (!code) return '';
  const [[row]] = await pool.query(
    `SELECT NAME FROM vendor_master WHERE CODE = ? LIMIT 1`,
    [code],
  ).catch(() => [[null]]);
  return row?.NAME || '';
}

async function getPortName(pool, portId) {
  if (!portId) return '';
  const [[row]] = await pool.query(
    `SELECT PortName FROM port_master WHERE PortId = ? LIMIT 1`,
    [portId],
  ).catch(() => [[null]]);
  return row?.PortName || '';
}

async function getBunkerGradeName(pool, id) {
  if (!id) return '';
  const [[row]] = await pool.query(
    `SELECT NAME FROM bunker_grade_master
     WHERE BUNKERGRADEID = ? AND MODULEID = ? AND MCOMPANYID = ?
     LIMIT 1`,
    [id, MODULE_ID, COMPANY_ID],
  ).catch(() => [[null]]);
  return row?.NAME || '';
}

async function getOwnerRelatedName(pool, id) {
  if (!id) return '';
  const [[row]] = await pool.query(
    `SELECT NAME FROM owner_related_cost_master WHERE OWNER_RCOSTID = ? LIMIT 1`,
    [id],
  ).catch(() => [[null]]);
  return row?.NAME || String(id);
}

async function getCargoNames(pool, cargoId) {
  if (!cargoId) return '';
  const ids = String(cargoId)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== '0');
  if (!ids.length) return '';
  try {
    const [rows] = await pool.query(
      `SELECT MATERIAL_CODE_DESC AS name FROM cargo_master WHERE MATERIALID IN (?)`,
      [ids],
    );
    return rows.map((r) => r.name).filter(Boolean).join(', ');
  } catch {
    return '';
  }
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

async function countQuery(pool, sql, params) {
  try {
    const [[row]] = await pool.query(sql, params);
    return Number(row?.count ?? row?.CNT ?? 0);
  } catch {
    return 0;
  }
}

/**
 * PHP payment_grid.php — Payment / Invoice Grid for Ops VC (COMID keyed).
 * Mirrors Freight / Demurrage / Other Income / Bunkers / Ops Costs / Port Costs / Hireage.
 */
export async function dbGetPaymentGridVc(comId, options = {}) {
  const pool = getPool();
  if (!comId) {
    const error = new Error('COMID is required.');
    error.status = 400;
    throw error;
  }
  const page = String(options.page || '1');
  const voyageNoOpt = str(options.voyageNo || '');

  const [[compare]] = await pool.query(
    `SELECT c.*, m.VOYAGE_NO AS MASTER_VOYAGE_NO, m.VESSEL_IMO_ID AS MASTER_VESSEL_IMO_ID,
            vim.VESSEL_NAME
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

  // PHP getLatestCostSheetID — latest FCAID for COMID (no SHEET_NO filter)
  const [[latest]] = await pool.query(
    `SELECT FCAID FROM freight_cost_estimete_master
     WHERE COMID = ? AND MODULEID = ?
     ORDER BY FCAID DESC
     LIMIT 1`,
    [comId, MODULE_ID],
  );

  const fcaId = latest?.FCAID || compare.FCAID;
  const [[master]] = await pool.query(
    `SELECT * FROM freight_cost_estimete_master WHERE FCAID = ? LIMIT 1`,
    [fcaId],
  );

  if (!master) {
    const error = new Error('Voyage financial sheet not found for this nomination.');
    error.status = 404;
    throw error;
  }

  const voyageNo = voyageNoOpt || master.VOYAGE_NO || compare.MASTER_VOYAGE_NO || compare.MESSAGE || '';
  const vesselName = compare.VESSEL_NAME || '';
  const estimateType = Number(master.ESTIMATE_TYPE);
  const tankerSingle = Number(master.TANKER_RADIO_SINGLE_DIS);
  const chkLumpsum = Number(master.CHK_LUMPSUM) === 1;
  const qtyTypeRadio = Number(master.QTY_TYPE_RADIO);

  const sections = [];

  // ── Freight Details ──────────────────────────────────────────────
  {
    const freightLines = [];

    if (estimateType === 2) {
      if (tankerSingle === 1) {
        if (chkLumpsum) {
          const vendorId = str(master.LUMP_VENDOR);
          const vendorName = await getVendorName(pool, vendorId);
          const invoiceId = joinInvoiceId([
            comId,
            fcaId,
            vendorId,
            money2(master.LUMPSUMAMT),
            0,
            master.QUANTITY ?? master.TANK_QUANTITY ?? 0,
            0,
            0,
            0,
          ]);
          freightLines.push(line({
            key: 'freight-lumpsum',
            name: 'Final Nett Freight',
            vendorId,
            vendorName,
            actions: vendorName
              ? freightInvoiceActions({
                invoiceId,
                name: 'Final Nett Freight',
                page,
                voyageNo,
              })
              : [],
          }));
        } else {
          const [rows] = await pool.query(
            `SELECT * FROM freight_cost_estimete_slave12
             WHERE FCAID = ? AND CUSTOMER IS NOT NULL AND CUSTOMER != ''`,
            [fcaId],
          ).catch(() => [[]]);
          for (const [idx, row] of (rows || []).entries()) {
            const vendorId = str(row.CUSTOMER);
            const vendorName = await getVendorName(pool, vendorId);
            const invoiceId = joinInvoiceId([
              comId,
              fcaId,
              vendorId,
              money2(row.TOTAL_AMOUNT),
              0,
              row.TOTAL_QTY ?? 0,
              0,
              0,
              0,
            ]);
            freightLines.push(line({
              key: `freight-ws-${idx}`,
              name: 'Final Nett Freight',
              vendorId,
              vendorName,
              actions: vendorName
                ? freightInvoiceActions({
                  invoiceId,
                  name: 'Final Nett Freight',
                  page,
                  voyageNo,
                })
                : [],
            }));
          }
        }
      } else {
        for (const status of [1, 2, 3]) {
          const labelPrefix = status === 1
            ? 'Main Cargo Freight Details'
            : status === 2
              ? 'Overage Cargo Freight Details'
              : 'Dead Freight Details';
          const nameSuffix = status === 1
            ? 'Main Cargo Freight'
            : status === 2
              ? 'Overage Cargo Freight'
              : 'Dead Freight';
          const invoiceName = `Final Nett ${nameSuffix}`;
          const [rows] = await pool.query(
            `SELECT * FROM freight_cost_estimete_slave10
             WHERE FCAID = ? AND SHIPPER_CHARTER IS NOT NULL AND SHIPPER_CHARTER != '' AND STATUS = ?`,
            [fcaId, status],
          ).catch(() => [[]]);
          if (!rows?.length) continue;
          freightLines.push(line({
            key: `freight-hdr-${status}`,
            name: labelPrefix,
            isGroupHeader: true,
          }));
          for (const [idx, row] of rows.entries()) {
            const vendorId = str(row.SHIPPER_CHARTER);
            const vendorName = await getVendorName(pool, vendorId);
            const cargoName = await getCargoNames(pool, row.CARGOID);
            const clubbed = await countQuery(
              pool,
              `SELECT COUNT(*) AS count
               FROM freight_invoice_slave1 s
               INNER JOIN freight_invoice_master m ON m.INVOICEID = s.INVOICEID
               WHERE s.VENDOR = ? AND m.COMID = ? AND s.CARGO = ? AND s.RANDOMID = ?`,
              [vendorId, comId, row.CARGOID, row.RANDOMID],
            );
            const actions = [];
            const badges = [];
            if (vendorName) {
              const invoiceId = status === 1
                ? joinInvoiceId([
                  comId,
                  fcaId,
                  vendorId,
                  money2(row.AMOUNT_USD),
                  0,
                  row.CARGO_MT ?? 0,
                  row.CARGOID ?? 0,
                  0,
                  0,
                  row.RANDOMID ?? 0,
                  row.FCA_SLAVE10ID ?? 0,
                ])
                : joinInvoiceId([
                  comId,
                  fcaId,
                  vendorId,
                  money2(row.AMOUNT_USD),
                  0,
                  row.CARGO_MT ?? 0,
                  0,
                  0,
                  0,
                  row.RANDOMID ?? 0,
                  row.FCA_SLAVE10ID ?? 0,
                ]);
              if (clubbed === 0) {
                actions.push(...freightInvoiceActions({
                  invoiceId,
                  name: invoiceName,
                  page,
                  voyageNo,
                }));
              } else {
                actions.push(action('invoiceClubbed', 'Invoice Clubbed', 'info', true, {
                  href: clubbedInvoiceHref({
                    invoiceId,
                    name: invoiceName,
                    page,
                    invType: 'Final',
                    voyageNo,
                  }),
                }));
              }
            }
            freightLines.push(line({
              key: `freight-cargo-${status}-${idx}`,
              name: cargoName
                ? `Final Nett Freight (${cargoName})`
                : `Final Nett Freight (${nameSuffix})`,
              vendorId,
              vendorName,
              actions,
              badges,
            }));
          }
        }
      }
    } else if (qtyTypeRadio === 1) {
      const vendorId = str(compare.FGFF_VENDORID || master.FGFF_VENDORID);
      const vendorName = await getVendorName(pool, vendorId);
      const actions = [];
      if (vendorName) {
        const invoiceId = joinInvoiceId([
          comId,
          fcaId,
          vendorId,
          compare.TOTAL_PREIGHT_ADJ ?? master.TOTAL_PREIGHT_ADJ ?? 0,
          compare.BROKERAGE_PER ?? master.BROKERAGE_PER ?? 0,
          master.QUANTITY ?? 0,
          master.CARGO ?? master.CARGOID ?? 0,
          master.AGREED_GROSS_FREIGHT_LOCAL ?? master.FREIGHT_GROSS ?? 0,
          master.EXCHANGE_RATE ?? 0,
        ]);
        actions.push(...freightInvoiceActions({
          invoiceId,
          name: 'Final Nett Freight',
          page,
          voyageNo,
        }));
        const [[neg]] = await pool.query(
          `SELECT INVOICEID, NET_PAYABLE_TAX
           FROM freight_invoice_master
           WHERE COMID = ? AND MODULEID = ? AND MCOMPANYID = ?
             AND VENDOR = ? AND NET_PAYABLE_TAX < 0 AND STATUS <= 5
           ORDER BY INVOICEID ASC
           LIMIT 1`,
          [comId, MODULE_ID, COMPANY_ID, vendorId],
        ).catch(() => [[null]]);
        if (neg) {
          actions.push(action('freightPayment', 'Payment', 'warning', true, {
            href: requestPortCostHref({
              id: joinInvoiceId([
                6,
                'Final Settlement',
                neg.INVOICEID,
                vendorId,
                comId,
                Math.abs(Number(neg.NET_PAYABLE_TAX) || 0),
                'Freight',
                12345,
              ]),
              name: 'Freight',
              page,
              voyageNo,
            }),
          }));
        }
      }
      freightLines.push(line({
        key: 'freight-single',
        name: 'Final Nett Freight',
        vendorId,
        vendorName,
        actions,
      }));
    } else {
      const [rows] = await pool.query(
        `SELECT * FROM freight_cost_estimete_slave7
         WHERE FCAID = ? AND QTY_VENDORID IS NOT NULL AND QTY_VENDORID != ''`,
        [fcaId],
      ).catch(() => [[]]);
      for (const [idx, row] of (rows || []).entries()) {
        const vendorId = str(row.QTY_VENDORID);
        const vendorName = await getVendorName(pool, vendorId);
        const clubbed = await countQuery(
          pool,
          `SELECT COUNT(*) AS count
           FROM freight_invoice_slave1 s
           INNER JOIN freight_invoice_master m ON m.INVOICEID = s.INVOICEID
           WHERE s.VENDOR = ? AND m.COMID = ? AND s.CARGO = ? AND s.RANDOMID = ?`,
          [vendorId, comId, row.CARGO, row.RANDOMID],
        );
        const [[neg]] = await pool.query(
          `SELECT INVOICEID, NET_PAYABLE_TAX, STATUS
           FROM freight_invoice_master
           WHERE COMID = ? AND VENDOR = ? AND NET_PAYABLE_TAX < 0 AND STATUS <= 5
           ORDER BY INVOICEID ASC
           LIMIT 1`,
          [comId, vendorId],
        ).catch(() => [[null]]);
        const actions = [];
        const badges = [];
        if (vendorName) {
          const invoiceId = joinInvoiceId([
            comId,
            fcaId,
            vendorId,
            row.GROSS_FREIGHT ?? 0,
            row.BROKERAGE ?? 0,
            row.QUANTITY ?? 0,
            row.CARGO ?? 0,
            row.AGREED_GROSS_FREIGHT_LOCAL ?? 0,
            row.EXCHANGE_RATE ?? 0,
            row.RANDOMID ?? 0,
            row.FCA_SLAVE7ID ?? 0,
          ]);
          if (clubbed === 0 || (neg && Number(neg.STATUS) < 5)) {
            actions.push(...freightInvoiceActions({
              invoiceId,
              name: 'Final Nett Freight',
              page,
              voyageNo,
            }));
            if (neg) {
              actions.push(action('freightPayment', 'Payment', 'warning', true, {
                href: requestPortCostHref({
                  id: joinInvoiceId([
                    6,
                    'Final Settlement',
                    neg.INVOICEID,
                    vendorId,
                    comId,
                    Math.abs(Number(neg.NET_PAYABLE_TAX) || 0),
                    'Freight',
                    row.RANDOMID || 12345,
                  ]),
                  name: 'Freight',
                  page,
                  voyageNo,
                }),
              }));
            }
          } else {
            actions.push(action('invoiceClubbed', 'Invoice Clubbed', 'info', true, {
              href: clubbedInvoiceHref({
                invoiceId,
                name: 'Final Nett Freight',
                page,
                invType: 'Final',
                voyageNo,
              }),
            }));
          }
        }
        freightLines.push(line({
          key: `freight-qty-${idx}`,
          name: 'Final Nett Freight',
          vendorId,
          vendorName,
          actions,
          badges,
        }));
      }
    }

    // VC-In freight payment rows (PHP freight_cost_estimete_in_master)
    const [[vcIn]] = await pool.query(
      `SELECT * FROM freight_cost_estimete_in_master WHERE COMID = ? LIMIT 1`,
      [comId],
    ).catch(() => [[null]]);
    if (vcIn?.FGFF_VENDORID || vcIn?.LUMP_VENDOR) {
      const vendorId = str(vcIn.FGFF_VENDORID || vcIn.LUMP_VENDOR);
      const vendorName = await getVendorName(pool, vendorId);
      const actions = [];
      if (vendorName) {
        const vcInInvoiceId = joinInvoiceId([
          comId,
          vcIn.FCAID || fcaId,
          vendorId,
          vcIn.TOTAL_PREIGHT_ADJ ?? vcIn.LUMPSUMAMT ?? 0,
          vcIn.BROKERAGE_PER ?? 0,
          vcIn.QUANTITY ?? 0,
          0,
          vcIn.FREIGHT_GROSS ?? 0,
          vcIn.EXCHANGE_RATE ?? 0,
        ]);
        actions.push(action('vcInInitial', 'VC in Initial', 'warning', true, {
          href: freightInvoiceHref({
            invoiceId: vcInInvoiceId,
            name: 'VC In Payment',
            page,
            invType: 'Interim',
            voyageNo,
            vcIn: true,
          }),
        }));
        actions.push(action('vcInFinal', 'VC in Final', 'info', true, {
          href: freightInvoiceHref({
            invoiceId: vcInInvoiceId,
            name: 'VC In Payment',
            page,
            invType: 'Final',
            voyageNo,
            vcIn: true,
          }),
        }));
        actions.push(action('vcInPayment', 'VC in Payment', 'warning', true, {
          href: requestPortCostHref({
            id: joinInvoiceId([
              6,
              'Final_Settlement_VC_IN',
              4500,
              vendorId,
              comId,
              Math.abs(Number(vcIn.NET_PAYABLE_TAX) || 0),
              'Freight',
              12345,
            ]),
            name: 'Freight',
            page,
            voyageNo,
          }),
        }));
      }
      freightLines.push(line({
        key: 'freight-vcin',
        name: 'Final Nett Freight',
        vendorId,
        vendorName,
        actions,
      }));
    }

    sections.push({
      key: 'freight',
      periodLabel: 'Freight Details',
      columns: { showPayments: false, showVoyageId: false },
      lines: freightLines,
    });
  }

  // ── Demurrage Dispatch Ship Owner ────────────────────────────────
  {
    const demLines = [];
    const [legs] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave1 WHERE FCAID = ? ORDER BY FCA_SLAVEID`,
      [fcaId],
    ).catch(() => [[]]);

    for (const [idx, leg] of (legs || []).entries()) {
      if (isNullishFlag(leg.IS_SHOW_DDCLP)) {
        const vendorId = str(leg.DDCLP_VENDOR);
        const vendorName = await getVendorName(pool, vendorId);
        const portName = await getPortName(pool, leg.FROM_PORT);
        const clubbedFreight = await countQuery(
          pool,
          `SELECT COUNT(*) AS count
           FROM freight_invoice_slave3 s
           INNER JOIN freight_invoice_master m ON m.INVOICEID = s.INVOICEID
           WHERE s.VENDORID = ? AND m.COMID = ? AND s.RANDOMID = ?
             AND s.PORT = 'LP' AND s.PORTID = ?`,
          [vendorId, comId, leg.RANDOMID, leg.FROM_PORT],
        );
        const clubbedOther = await countQuery(
          pool,
          `SELECT COUNT(*) AS count
           FROM other_invoice_slave1 s
           INNER JOIN other_invoice_master m ON m.INVOICEID = s.INVOICEID
           WHERE s.VENDORID = ? AND m.COMID = ? AND s.RANDOMID = ?
             AND s.PORT = 'LP' AND s.PORTID = ?`,
          [vendorId, comId, leg.RANDOMID, leg.FROM_PORT],
        );
        const actions = [];
        const badges = [];
        if (vendorId) {
          if (clubbedFreight === 0 && clubbedOther === 0) {
            const isPayment = Number(leg.DDCDP_NETCOST) < 0;
            actions.push(action(
              isPayment ? 'demurragePayment' : 'demurrageInvoice',
              isPayment ? 'Payment' : 'Invoice',
              isPayment ? 'warning' : 'info',
              true,
              {
                href: otherInvoiceHref({
                  id: joinInvoiceId([comId, fcaId, vendorId, leg.DDCLP_NETCOST, 'Demurrage/Dispatch(LP)']),
                  name: `Demurrage/Dispatch Invoice for Load Port ${portName}`,
                  amountTitle: `Load Port ${portName}`,
                  page,
                  voyageNo,
                  portType: 'LP',
                  randomId: leg.RANDOMID,
                  portId: leg.FROM_PORT,
                }),
              },
            ));
          } else {
            actions.push(action('invoiceClubbed', 'Invoice Clubbed', 'warning', true, {
              href: clubbedInvoiceHref({
                invoiceId: joinInvoiceId([comId, fcaId, vendorId, leg.DDCLP_NETCOST, 'Demurrage/Dispatch(LP)']),
                name: `Demurrage/Dispatch Invoice for Load Port ${portName}`,
                page,
                invType: 'Final',
                voyageNo,
              }),
            }));
          }
        }
        demLines.push(line({
          key: `dem-lp-${idx}`,
          name: `Load Port ${portName}`,
          vendorId,
          vendorName,
          actions,
          badges,
        }));
      }

      if (isNullishFlag(leg.IS_SHOW_DDCDP)) {
        const vendorId = str(leg.DDCDP_VENDOR);
        const vendorName = await getVendorName(pool, vendorId);
        const portName = await getPortName(pool, leg.TO_PORT);
        const clubbedFreight = await countQuery(
          pool,
          `SELECT COUNT(*) AS count
           FROM freight_invoice_slave3 s
           INNER JOIN freight_invoice_master m ON m.INVOICEID = s.INVOICEID
           WHERE s.VENDORID = ? AND m.COMID = ? AND s.RANDOMID = ?
             AND s.PORT = 'DP' AND s.PORTID = ?`,
          [vendorId, comId, leg.RANDOMID, leg.TO_PORT],
        );
        const clubbedOther = await countQuery(
          pool,
          `SELECT COUNT(*) AS count
           FROM other_invoice_slave1 s
           INNER JOIN other_invoice_master m ON m.INVOICEID = s.INVOICEID
           WHERE s.VENDORID = ? AND m.COMID = ? AND s.RANDOMID = ?
             AND s.PORT = 'DP' AND s.PORTID = ?`,
          [vendorId, comId, leg.RANDOMID, leg.TO_PORT],
        );
        const actions = [];
        const badges = [];
        if (vendorId) {
          if (clubbedFreight === 0 && clubbedOther === 0) {
            const isPayment = Number(leg.DDCLP_NETCOST) < 0;
            actions.push(action(
              isPayment ? 'demurragePayment' : 'demurrageInvoice',
              isPayment ? 'Payment' : 'Invoice',
              isPayment ? 'warning' : 'info',
              true,
              {
                href: otherInvoiceHref({
                  id: joinInvoiceId([comId, fcaId, vendorId, leg.DDCDP_NETCOST, 'Demurrage/Dispatch(DP)']),
                  name: `Demurrage/Dispatch Invoice for Discharge Port ${portName}`,
                  amountTitle: `Discharge Port ${portName}`,
                  page,
                  voyageNo,
                  portType: 'DP',
                  randomId: leg.RANDOMID,
                  portId: leg.TO_PORT,
                }),
              },
            ));
          } else {
            actions.push(action('invoiceClubbed', 'Invoice Clubbed', 'warning', true, {
              href: clubbedInvoiceHref({
                invoiceId: joinInvoiceId([comId, fcaId, vendorId, leg.DDCDP_NETCOST, 'Demurrage/Dispatch(DP)']),
                name: `Demurrage/Dispatch Invoice for Discharge Port ${portName}`,
                page,
                invType: 'Final',
                voyageNo,
              }),
            }));
          }
        }
        demLines.push(line({
          key: `dem-dp-${idx}`,
          name: `Discharge Port ${portName}`,
          vendorId,
          vendorName,
          actions,
          badges,
        }));
      }
    }

    sections.push({
      key: 'demurrage',
      periodLabel: 'Demurrage Dispatch Ship Owner',
      columns: { showPayments: false, showVoyageId: false },
      lines: demLines,
    });
  }

  // ── Other Income ─────────────────────────────────────────────────
  {
    const oiLines = [];
    const [rows] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave3
       WHERE FCAID = ? AND IDENTIFY = 'OTHERINCOME' AND RAW_AMOUNT > 0`,
      [fcaId],
    ).catch(() => [[]]);
    for (const [idx, row] of (rows || []).entries()) {
      const vendorId = str(row.VENDORID);
      const vendorName = await getVendorName(pool, vendorId);
      const clubbed = await countQuery(
        pool,
        `SELECT COUNT(*) AS count
         FROM other_invoice_slave1 s
         INNER JOIN other_invoice_master m ON m.INVOICEID = s.INVOICEID
         WHERE s.VENDORID = ? AND m.COMID = ? AND s.RANDOMID = ?`,
        [vendorId, comId, row.RANDOMID],
      );
      const actions = [];
      const badges = [];
      if (vendorName) {
        if (clubbed > 0) {
          actions.push(action('invoiceClubbed', 'Invoice Clubbed', 'warning', true, {
            href: clubbedInvoiceHref({
              invoiceId: joinInvoiceId([comId, fcaId, vendorId, row.RAW_AMOUNT, 'Other Income']),
              name: `Other Income Invoice for ${row.IDENTY_ID || ''}`,
              page,
              invType: 'Final',
              voyageNo,
            }),
          }));
        } else {
          actions.push(action('otherIncomeInvoice', 'Invoice', 'info', true, {
            href: otherInvoiceHref({
              id: joinInvoiceId([comId, fcaId, vendorId, row.RAW_AMOUNT, 'Other Income']),
              name: `Other Income Invoice for ${row.IDENTY_ID || ''}`,
              amountTitle: str(row.IDENTY_ID),
              page,
              voyageNo,
              randomId: row.RANDOMID,
            }),
          }));
        }
      }
      oiLines.push(line({
        key: `oi-${idx}`,
        name: str(row.IDENTY_ID) || 'Other Income',
        vendorId,
        vendorName,
        actions,
        badges,
      }));
    }
    sections.push({
      key: 'other-income',
      periodLabel: 'Other Income',
      columns: { showPayments: false, showVoyageId: false },
      lines: oiLines,
    });
  }

  // ── Bunkers Nett Supply ──────────────────────────────────────────
  {
    const bunkerLines = [];
    const [rows] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave8
       WHERE FCAID = ? AND IDENTIFY = 'SUPPLY'`,
      [fcaId],
    ).catch(() => [[]]);
    for (const [idx, row] of (rows || []).entries()) {
      const vendorId = str(row.VENDORID);
      const vendorName = await getVendorName(pool, vendorId);
      const gradeName = await getBunkerGradeName(pool, row.BUNKERGRADEID);
      const pay = await getPaymentSummary(
        pool,
        `SELECT SUM(P_AMT) AS P_AMT, MAX(P_DATE) AS P_DATE
         FROM request_master
         WHERE COST_DESC = ? AND COMID = ? AND VENDOR = ?`,
        [`${gradeName} Nett`, comId, vendorId],
      );
      const actions = [];
      if (vendorName) {
        actions.push(action('bunkerPayment', 'Payment', 'warning', true, {
          href: requestPortCostHref({
            id: joinInvoiceId([
              2,
              'Bunkers Nett Supply',
              row.BUNKERGRADEID,
              vendorId,
              comId,
              row.COST,
            ]),
            name: `${gradeName} Nett`,
            page,
            voyageNo,
          }),
        }));
      }
      bunkerLines.push(line({
        key: `bunker-${idx}`,
        name: `${gradeName} Nett`,
        vendorId,
        vendorName,
        totalPaid: pay.totalPaid,
        lastPaidDate: pay.lastPaidDate,
        voyageId: pay.totalPaid && Number(pay.totalPaid) > 0 ? voyageNo : '',
        actions,
      }));
    }
    sections.push({
      key: 'bunkers',
      periodLabel: 'Bunkers Nett Supply',
      columns: { showPayments: true, showVoyageId: true },
      lines: bunkerLines,
    });
  }

  // ── Operational Costs (Others) ───────────────────────────────────
  {
    const opLines = [];

    // Brokerage from slave4 (PHP uses slave4, not slave9)
    const [brokerRows] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave4 WHERE FCAID = ?`,
      [fcaId],
    ).catch(() => [[]]);
    for (const [idx, row] of (brokerRows || []).entries()) {
      const vendorId = str(row.VENDORID);
      const vendorName = await getVendorName(pool, vendorId);
      const pay = await getPaymentSummary(
        pool,
        `SELECT SUM(P_AMT) AS P_AMT, MAX(P_DATE) AS P_DATE
         FROM request_master
         WHERE COST_DESC = 'Brokerage Commission' AND VENDOR = ? AND COMID = ?`,
        [vendorId, comId],
      );
      const actions = [];
      if (vendorName) {
        const paymentId = joinInvoiceId([
          3,
          'Operational Costs (Others)',
          0,
          vendorId,
          comId,
          row.BROKAGE_AMT,
        ]);
        actions.push(action('brokerPayment', 'Payment', 'warning', true, {
          href: requestPortCostHref({
            id: paymentId,
            name: 'Brokerage Commission',
            page,
            voyageNo,
          }),
        }));
      }
      opLines.push(line({
        key: `broker-${idx}`,
        name: 'Brokerage Commission (%)',
        vendorId,
        vendorName,
        totalPaid: pay.totalPaid,
        lastPaidDate: pay.lastPaidDate,
        voyageId: pay.totalPaid && Number(pay.totalPaid) > 0 ? voyageNo : '',
        actions,
      }));
    }

    // ORC rows
    const [orcRows] = await pool.query(
      `SELECT s.*, o.NAME AS COST_NAME
       FROM freight_cost_estimete_slave3 s
       LEFT JOIN owner_related_cost_master o ON o.OWNER_RCOSTID = s.IDENTY_ID
       WHERE s.FCAID = ? AND s.IDENTIFY = 'ORC'`,
      [fcaId],
    ).catch(() => [[]]);
    for (const [idx, row] of (orcRows || []).entries()) {
      // PHP skips IDENTY_ID=24 when DE0051 payment already exists (ops section)
      if (String(row.IDENTY_ID) === '24') {
        const skip = await countQuery(
          pool,
          `SELECT COUNT(*) AS count FROM request_master
           WHERE COMID = ? AND NAME = 'Operational Costs' AND NAME_ID = '3'
             AND GRADEID = ? AND VENDOR = ? AND ACC_L_CODE = 'DE0051'`,
          [comId, row.RANDOMID, row.VENDORID],
        );
        if (skip > 0) continue;
      }
      const vendorId = str(row.VENDORID);
      const vendorName = await getVendorName(pool, vendorId);
      const costName = row.COST_NAME || await getOwnerRelatedName(pool, row.IDENTY_ID);
      const clubbed = await countQuery(
        pool,
        `SELECT COUNT(*) AS count
         FROM invoice_hire_slave5 s
         INNER JOIN invoice_hire_master m ON m.INVOICEID = s.INVOICEID
         WHERE s.VENDORID = ? AND m.COMID = ?
           AND s.IDENTITYID = ? AND s.RANDOMID = ?`,
        [vendorId, comId, row.IDENTY_ID, row.RANDOMID],
      );
      const pay = await getPaymentSummary(
        pool,
        `SELECT SUM(P_AMT) AS P_AMT, MAX(P_DATE) AS P_DATE
         FROM request_master
         WHERE COST_DESC = ? AND COMID = ? AND GRADEID = ? AND VENDOR = ?`,
        [costName, comId, row.RANDOMID, vendorId],
      );
      const actions = [];
      if (vendorName) {
        if (clubbed === 0) {
          const paymentId = joinInvoiceId([
            3,
            'Operational Costs',
            row.RANDOMID,
            vendorId,
            comId,
            row.RAW_AMOUNT,
          ]);
          actions.push(action('orcPayment', 'Payment', 'warning', true, {
            href: requestPortCostHref({
              id: paymentId,
              name: costName,
              page,
              voyageNo,
            }),
          }));
        } else {
          actions.push(action('paymentClubbed', 'Payment Clubbed', 'danger', true, {
            href: clubbedHireHref({ comId, page, voyageNo }),
          }));
        }
      }
      opLines.push(line({
        key: `orc-${idx}`,
        name: costName,
        vendorId,
        vendorName,
        totalPaid: pay.totalPaid,
        lastPaidDate: pay.lastPaidDate,
        voyageId: pay.totalPaid && Number(pay.totalPaid) > 0 ? voyageNo : '',
        actions,
        highlight: String(row.IDENTY_ID) === '35',
      }));
    }

    sections.push({
      key: 'ops-costs',
      periodLabel: 'Operational Costs (Others)',
      columns: { showPayments: true, showVoyageId: true },
      lines: opLines,
    });
  }

  // ── Port Costs ───────────────────────────────────────────────────
  {
    const portLines = [];
    const [legs] = await pool.query(
      `SELECT * FROM freight_cost_estimete_slave1 WHERE FCAID = ? ORDER BY FCA_SLAVEID`,
      [fcaId],
    ).catch(() => [[]]);

    for (const [idx, leg] of (legs || []).entries()) {
      const pushPortLine = async ({
        key,
        name,
        requestName,
        displayName,
        vendorId,
        portId,
        randomId,
        daPort,
        amount,
        portKind,
      }) => {
        const vendorName = await getVendorName(pool, vendorId);
        const pay = await getPaymentSummary(
          pool,
          `SELECT SUM(P_AMT) AS P_AMT, MAX(P_DATE) AS P_DATE
           FROM request_master
           WHERE GRADEID = ? AND NAME = ? AND COMID = ? AND VENDOR = ?`,
          [portId, requestName, comId, vendorId],
        );
        const daClubbed = daPort
          ? await countQuery(
            pool,
            `SELECT COUNT(*) AS count FROM freight_invoice_slave_da
             WHERE PORTID = ? AND RANDOMID = ? AND PORT = ? AND VENDORID = ?`,
            [portId, randomId, daPort, vendorId],
          )
          : 0;
        const actions = [];
        const badges = [];
        if (vendorName) {
          if (daClubbed > 0) badges.push(badge('Payment Clubbed'));
          else {
            actions.push(action('portPayment', 'Payment', 'warning', true, {
              href: requestPortCostHref({
                id: joinInvoiceId([
                  5,
                  requestName,
                  portId,
                  vendorId,
                  comId,
                  amount || 0,
                  portKind,
                  randomId,
                ]),
                name: displayName || name,
                page,
                voyageNo,
              }),
            }));
          }
        }
        portLines.push(line({
          key,
          name,
          vendorId: str(vendorId),
          vendorName,
          totalPaid: pay.totalPaid,
          lastPaidDate: pay.lastPaidDate,
          voyageId: pay.totalPaid && Number(pay.totalPaid) > 0 ? voyageNo : '',
          actions,
          badges,
        }));
      };

      if (Number(leg.LOAD_PORT_COST) > 0) {
        const portName = await getPortName(pool, leg.FROM_PORT);
        await pushPortLine({
          key: `port-lp-${idx}`,
          name: `Load Port ${portName}`,
          requestName: 'Load Port Costs',
          displayName: `Load Port  ${portName}`,
          vendorId: leg.PORT_COSTLP_VENDOR,
          portId: leg.FROM_PORT,
          randomId: leg.RANDOMID,
          daPort: 'LP',
          amount: leg.LOAD_PORT_COST,
          portKind: 'Load',
        });
      }

      if (leg.LP_OPA_VENDOR) {
        const portName = await getPortName(pool, leg.FROM_PORT);
        await pushPortLine({
          key: `port-lp-opa-${idx}`,
          name: `OPA ${portName}`,
          requestName: 'OPA FEE',
          displayName: `OPA FEE ${portName}`,
          vendorId: leg.LP_OPA_VENDOR,
          portId: leg.FROM_PORT,
          randomId: leg.RANDOMID,
          daPort: null,
          amount: 0,
          portKind: 'OPA',
        });
      }

      if (Number(leg.DISC_PORT_COST) > 0) {
        const portName = await getPortName(pool, leg.TO_PORT);
        await pushPortLine({
          key: `port-dp-${idx}`,
          name: `Discharge Port ${portName}`,
          requestName: 'Discharge Port Costs',
          displayName: `Discharge Port  ${portName}`,
          vendorId: leg.PORT_COSTDP_VENDOR,
          portId: leg.TO_PORT,
          randomId: leg.RANDOMID,
          daPort: 'DP',
          amount: leg.DISC_PORT_COST,
          portKind: 'Discharge',
        });
      }

      if (leg.DP_OPA_VENDOR) {
        const portName = await getPortName(pool, leg.TO_PORT);
        await pushPortLine({
          key: `port-dp-opa-${idx}`,
          name: `OPA ${portName}`,
          requestName: 'OPA FEE',
          displayName: `OPA FEE ${portName}`,
          vendorId: leg.DP_OPA_VENDOR,
          portId: leg.TO_PORT,
          randomId: leg.RANDOMID,
          daPort: null,
          amount: 0,
          portKind: 'OPA',
        });
      }

      if (Number(leg.TRANSIT_PORT_COST) > 0) {
        const isBunker = String(leg.CHK_MAND || '') === 'BP';
        const portName = await getPortName(pool, leg.FROM_PORT);
        await pushPortLine({
          key: `port-tp-${idx}`,
          name: isBunker ? `Bunkering Port ${portName}` : `Transit Port ${portName}`,
          requestName: isBunker ? 'Bunkering Port Costs' : 'Transit Port Costs',
          displayName: isBunker ? `Bunkering Port ${portName}` : `Transit Port ${portName}`,
          vendorId: leg.PORT_COSTTP_VENDOR,
          portId: leg.FROM_PORT,
          randomId: leg.RANDOMID,
          daPort: 'TP',
          amount: leg.TRANSIT_PORT_COST,
          portKind: isBunker ? 'Bunkering' : 'Transit',
        });
      }
    }

    sections.push({
      key: 'port-costs',
      periodLabel: 'Port Costs',
      columns: { showPayments: true, showVoyageId: true },
      lines: portLines,
    });
  }

  // ── Hireage ──────────────────────────────────────────────────────
  {
    const hireLines = [];
    const dtcVendorId = str(compare.DTCVENDORID || master.DTCVENDORID || master.OWNER);
    const dtcVendorName = await getVendorName(pool, dtcVendorId);
    const hirePay = await getPaymentSummary(
      pool,
      `SELECT SUM(P_AMT) AS P_AMT,
              (SELECT P_DATE FROM invoice_hire_master
               WHERE COMID = ? AND P_DATE IS NOT NULL
               ORDER BY P_DATE DESC LIMIT 1) AS P_DATE
       FROM invoice_hire_master
       WHERE COMID = ?`,
      [comId, comId],
    );
    const hireActions = [];
    if (dtcVendorName) {
      hireActions.push(action('hireStatement', 'Hire Statement', 'danger', true, {
        href: hireStatementHref({ comId, page, voyageNo }),
      }));
    }
    hireLines.push(line({
      key: 'hire',
      name: 'Hire',
      vendorId: dtcVendorId,
      vendorName: dtcVendorName,
      totalPaid: hirePay.totalPaid,
      lastPaidDate: hirePay.lastPaidDate,
      actions: hireActions,
    }));

    // Special ORC IDENTY_ID=24 shown again under Hireage when DE0051 exists
    const [orc24] = await pool.query(
      `SELECT s.*, o.NAME AS COST_NAME
       FROM freight_cost_estimete_slave3 s
       LEFT JOIN owner_related_cost_master o ON o.OWNER_RCOSTID = s.IDENTY_ID
       WHERE s.FCAID = ? AND s.IDENTIFY = 'ORC' AND s.IDENTY_ID = '24'`,
      [fcaId],
    ).catch(() => [[]]);
    for (const [idx, row] of (orc24 || []).entries()) {
      const hasDe0051 = await countQuery(
        pool,
        `SELECT COUNT(*) AS count FROM request_master
         WHERE COMID = ? AND NAME = 'Operational Costs' AND NAME_ID = '3'
           AND GRADEID = ? AND VENDOR = ? AND ACC_L_CODE = 'DE0051'`,
        [comId, row.RANDOMID, row.VENDORID],
      );
      if (!hasDe0051) continue;
      const vendorId = str(row.VENDORID);
      const vendorName = await getVendorName(pool, vendorId);
      const costName = row.COST_NAME || await getOwnerRelatedName(pool, row.IDENTY_ID);
      const clubbed = await countQuery(
        pool,
        `SELECT COUNT(*) AS count
         FROM invoice_hire_slave5 s
         INNER JOIN invoice_hire_master m ON m.INVOICEID = s.INVOICEID
         WHERE s.VENDORID = ? AND m.COMID = ?
           AND s.IDENTITYID = ? AND s.RANDOMID = ?`,
        [vendorId, comId, row.IDENTY_ID, row.RANDOMID],
      );
      const pay = await getPaymentSummary(
        pool,
        `SELECT SUM(P_AMT) AS P_AMT, MAX(P_DATE) AS P_DATE
         FROM request_master
         WHERE COST_DESC = ? AND COMID = ?`,
        [costName, comId],
      );
      const actions = [];
      if (vendorName) {
        if (clubbed === 0) {
          const paymentId = joinInvoiceId([
            3,
            'Operational Costs',
            row.RANDOMID,
            vendorId,
            comId,
            row.RAW_AMOUNT,
          ]);
          actions.push(action('orcPayment', 'Payment', 'warning', true, {
            href: requestPortCostHref({
              id: paymentId,
              name: costName,
              page,
              voyageNo,
            }),
          }));
        } else {
          actions.push(action('paymentClubbed', 'Payment Clubbed', 'danger', true, {
            href: clubbedHireHref({ comId, page, voyageNo }),
          }));
        }
      }
      hireLines.push(line({
        key: `hire-orc24-${idx}`,
        name: costName,
        vendorId,
        vendorName,
        totalPaid: pay.totalPaid,
        lastPaidDate: pay.lastPaidDate,
        actions,
      }));
    }

    const ownersBrokerVendor = str(compare.SEL_BROK_VEN);
    const ownersBrokerName = await getVendorName(pool, ownersBrokerVendor);
    const ownersBrokerPay = await getPaymentSummary(
      pool,
      `SELECT SUM(P_AMT) AS P_AMT, MAX(P_DATE) AS P_DATE
       FROM request_master
       WHERE COST_DESC = 'Owners Side brokerage' AND COMID = ?`,
      [comId],
    );
    const ownersBrokerActions = [];
    if (ownersBrokerName) {
      ownersBrokerActions.push(action('ownersBrokerPayment', 'Payment', 'warning', true, {
        href: requestPortCostHref({
          id: joinInvoiceId([
            13,
            'Owners Side brokerage',
            1771,
            ownersBrokerVendor,
            comId,
            compare.HIERAGE_BROKER_AMT || master.HIERAGE_BROKER_AMT || 0,
          ]),
          name: 'Owners Side brokerage',
          page,
          voyageNo,
        }),
      }));
    }
    hireLines.push(line({
      key: 'owners-broker',
      name: 'Owners Side brokerage',
      vendorId: ownersBrokerVendor,
      vendorName: ownersBrokerName,
      totalPaid: ownersBrokerPay.totalPaid,
      lastPaidDate: ownersBrokerPay.lastPaidDate,
      actions: ownersBrokerActions,
      highlight: true,
    }));

    sections.push({
      key: 'hireage',
      periodLabel: 'Hireage',
      columns: { showPayments: true, showVoyageId: false },
      lines: hireLines,
    });
  }

  return {
    comId: String(comId),
    fcaId: String(fcaId),
    voyageNo,
    message: compare.MESSAGE || '',
    vesselName: vesselName || '',
    sections,
  };
}

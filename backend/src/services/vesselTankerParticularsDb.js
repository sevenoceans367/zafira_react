import { getPool } from '../db.js';
import { appContext } from '../config.js';
import {
  TANKER_COLUMN_TO_REQUEST,
  TANKER_DATE_FIELDS,
  TANKER_RADIO_FIELDS,
  TANKER_SELECT_FIELDS,
} from './tankerParticularsFieldMap.js';
import { attachmentPublicUrl } from '../utils/attachmentUrl.js';

function formatDmyDate(value) {
  if (!value || value === '0000-00-00' || value === '1970-01-01') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function parseAttachmentList(upload, uploadName) {
  const files = String(upload || '').split(',').map((part) => part.trim()).filter(Boolean);
  const names = String(uploadName || '').split(',').map((part) => part.trim()).filter(Boolean);
  return files.map((file, index) => ({
    file,
    name: names[index] || file,
    url: attachmentPublicUrl(file),
  }));
}

function mapParticularsRow(row = {}) {
  const fields = {};
  Object.entries(TANKER_COLUMN_TO_REQUEST).forEach(([column, key]) => {
    let value = row[column];
    if (value == null) value = '';
    if (TANKER_DATE_FIELDS.has(key)) {
      fields[key] = formatDmyDate(value);
      return;
    }
    if (TANKER_RADIO_FIELDS.has(key)) {
      fields[key] = value === '' || value == null ? '1' : String(value);
      return;
    }
    if (TANKER_SELECT_FIELDS.has(key)) {
      fields[key] = value === '' || value == null ? '' : String(value);
      return;
    }
    fields[key] = String(value);
  });
  return fields;
}

function mapLookupRows(rows = []) {
  return rows.map((row) => ({ id: String(row.id), name: row.name }));
}

async function queryCertificateLookups(pool) {
  try {
    const [rows] = await pool.query(
      `SELECT CERTIFICATEID AS id, CERTIFICATE AS name
       FROM certificate_master
       WHERE STATUS = 1
       ORDER BY CERTIFICATE`,
    );
    return mapLookupRows(rows);
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return [];
    throw error;
  }
}

export async function dbGetTankerParticularsLookups() {
  const pool = getPool();
  const [ports, countries, classSocieties, certificates] = await Promise.all([
    pool.query(
      `SELECT PortId AS id, PortName AS name
       FROM port_master
       WHERE STATUS = 1
       ORDER BY PortName`,
    ),
    pool.query(
      `SELECT COUNTRYID AS id, COUNTRY_NAME AS name
       FROM country_master
       WHERE STATUS = 1
       ORDER BY COUNTRY_NAME`,
    ),
    pool.query(
      `SELECT CLA_SOC_ID AS id, NAME AS name
       FROM classification_soc_master
       WHERE STATUS = 1
       ORDER BY NAME`,
    ),
    queryCertificateLookups(pool),
  ]);

  return {
    ports: mapLookupRows(ports[0]),
    countries: mapLookupRows(countries[0]),
    classSocieties: mapLookupRows(classSocieties[0]),
    certificates,
  };
}

export async function dbGetTankerParticulars(vesselId) {
  const pool = getPool();
  const [vesselRows] = await pool.query(
    `SELECT vim.VESSEL_IMO_ID,
            vim.VESSEL_NAME,
            vim.IMO_NO,
            vim.FLAG,
            vim.LOA,
            vim.VESSEL_TYPE,
            vim.CLA_SOC_ID,
            vtm.VesselType AS vessel_type_name,
            cm.COUNTRY_NAME AS flag_name
     FROM vessel_imo_master vim
     LEFT JOIN vessel_type_master vtm ON vtm.VesselTypeId = vim.VESSEL_TYPE
     LEFT JOIN country_master cm ON cm.COUNTRYID = vim.FLAG
     WHERE vim.VESSEL_IMO_ID = ? AND vim.MCOMPANYID = ?
     LIMIT 1`,
    [vesselId, appContext.companyId],
  );

  const vesselRow = vesselRows[0];
  if (!vesselRow) return null;

  const [particularRows] = await pool.query(
    'SELECT * FROM vessel_master_tankers WHERE VESSEL_IMO_ID = ? LIMIT 1',
    [vesselId],
  );

  const [certificateRows] = await pool.query(
    `SELECT CERTIFICATE_ID,
            DATE_ISSUE,
            DATE_LAST,
            DATE_EXPIRY,
            UPLOAD,
            UPLOAD_NANE
     FROM vessel_master_tankers_slave
     WHERE VESSEL_IMO_ID = ?
     ORDER BY CERTIFICATE_ID`,
    [vesselId],
  );

  const lookups = await dbGetTankerParticularsLookups();
  const certificateNameById = new Map(
    lookups.certificates.map((item) => [item.id, item.name]),
  );
  const fields = mapParticularsRow(particularRows[0] ?? {});

  fields.txtVName = vesselRow.VESSEL_NAME ?? '';
  fields.txtIMONumber = vesselRow.IMO_NO ?? '';
  fields.txtLOA = vesselRow.LOA ?? fields.txtLOA ?? '';
  fields.selFlag = String(vesselRow.FLAG ?? '');
  fields.selCLASS_SOC = String(vesselRow.CLA_SOC_ID ?? '');
  fields.txtTypeOfVessel = vesselRow.vessel_type_name ?? '';

  return {
    vessel: {
      id: vesselRow.VESSEL_IMO_ID,
      name: vesselRow.VESSEL_NAME ?? '',
      imoNo: vesselRow.IMO_NO ?? '',
      flagName: vesselRow.flag_name ?? '',
    },
    updateOnDate: formatDmyDate(particularRows[0]?.UPDATEONDATE),
    fields,
    certificates: certificateRows.map((row, index) => {
      const certificateId = String(row.CERTIFICATE_ID ?? '');
      return {
        id: index + 1,
        certificateId,
        certificateName: certificateNameById.get(certificateId) || certificateId || '—',
        dateIssue: formatDmyDate(row.DATE_ISSUE),
        dateLastAnnual: formatDmyDate(row.DATE_LAST),
        dateExpiry: formatDmyDate(row.DATE_EXPIRY),
        attachments: parseAttachmentList(row.UPLOAD, row.UPLOAD_NANE),
      };
    }),
    lookups,
  };
}

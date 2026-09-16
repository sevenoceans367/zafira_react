import { getPool } from '../db.js';
import { isDbConfigured } from '../config.js';

export async function dbAuthenticateUser(username, password) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT LOGINID, USERNAME, CONTACT_PERSON, USER_TYPE, MCOMPANYID
     FROM login
     WHERE USERNAME = ?
       AND PASSWORD = ?
       AND STATUS = 1
       AND USER_TYPE IN ('internal_user', 'mgmt_user', 'rm_user')
     LIMIT 1`,
    [username.trim(), password],
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    id: row.LOGINID != null ? String(row.LOGINID) : '',
    username: row.USERNAME,
    name: row.CONTACT_PERSON || row.USERNAME,
    userType: row.USER_TYPE,
    companyId: row.MCOMPANYID,
    sopfUser: true,
    rmUser: row.USER_TYPE === 'rm_user',
  };
}

/**
 * Third-party agent portal auth — credentials from generate_agency_letter
 * (legacy checklogin_agent.php / PDA letter username + password).
 */
export async function dbAuthenticateAgent(username, password) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT g.GEN_AGENCY_ID, g.USERNAME, g.COMID, g.MCOMPANYID, g.VENDORID,
            g.PORTID, g.PORT, g.RANDOMID, g.MODULEID,
            vm.NAME AS vendorName, vm.STREET_2 AS contactPerson
     FROM generate_agency_letter g
     LEFT JOIN vendor_master vm
       ON vm.CODE = g.VENDORID AND vm.MCOMPANYID = g.MCOMPANYID
     WHERE g.USERNAME = ?
       AND g.PASSWORD = ?
       AND TRIM(IFNULL(g.USERNAME, '')) <> ''
       AND TRIM(IFNULL(g.PASSWORD, '')) <> ''
     ORDER BY g.GEN_AGENCY_ID DESC
     LIMIT 1`,
    [username.trim(), password],
  );

  if (!rows.length) return null;

  const row = rows[0];
  const orgName = String(row.vendorName || '').trim();
  const contact = String(row.contactPerson || '').trim();

  return {
    id: row.GEN_AGENCY_ID != null ? String(row.GEN_AGENCY_ID) : '',
    username: row.USERNAME,
    name: contact || orgName || row.USERNAME,
    organisation: orgName || 'Agent Company',
    userType: 'agent',
    companyId: row.MCOMPANYID,
    comId: row.COMID,
    moduleId: row.MODULEID,
    genAgencyId: row.GEN_AGENCY_ID,
    vendorId: row.VENDORID ?? '',
    portId: row.PORTID != null ? String(row.PORTID) : '',
    portType: row.PORT ?? '',
    randomId: row.RANDOMID != null ? String(row.RANDOMID) : '',
    sopfUser: false,
    rmUser: false,
  };
}

export function isAuthDbAvailable() {
  return isDbConfigured();
}

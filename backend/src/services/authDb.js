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
    id: row.LOGINID,
    username: row.USERNAME,
    name: row.CONTACT_PERSON || row.USERNAME,
    userType: row.USER_TYPE,
    companyId: row.MCOMPANYID,
    sopfUser: true,
    rmUser: row.USER_TYPE === 'rm_user',
  };
}

export function isAuthDbAvailable() {
  return isDbConfigured();
}

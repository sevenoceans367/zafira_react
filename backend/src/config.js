/**
 * Database settings — mirrors PHP clsSettings / funConnect()
 *
 * PHP                    →  .env
 * $admin_site            →  DB_HOST
 * $admin_sitedatabase    →  DB_NAME
 * $admin_siteuser        →  DB_USER
 * $admin_sitepass        →  DB_PASSWORD
 */
export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
};

/** Session equivalents used in PHP queries ($_SESSION moduleid, company, uid) */
export const appContext = {
  moduleId: process.env.MODULE_ID || '1',
  companyId: process.env.COMPANY_ID || '1',
  userId: process.env.USER_ID || '1',
  userName: process.env.USER_NAME || 'Internal User',
  userType: process.env.USER_TYPE || 'user',
};

export function isMgmtUser() {
  return appContext.userType === 'mgmt_user';
}

/** PHP $_SESSION['COM_SH'] — company compare-sheets feature flag. */
export function compareSheetsEnabled() {
  const flag = process.env.COM_SH;
  if (flag === '0' || flag === 'false') return false;
  if (flag === '1' || flag === 'true') return true;
  return true;
}

export function isDbConfigured() {
  return Boolean(dbConfig.host && dbConfig.database && dbConfig.user);
}

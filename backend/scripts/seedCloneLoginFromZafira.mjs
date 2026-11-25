/**
 * Clone-only: copy login table DDL + support user from zafira → zafira_tc_contract_clone.
 * Read-only against zafira; writes only the clone.
 */
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';

const src = await mysql.createConnection({ host, port, user, password, database: 'zafira' });
const dst = await mysql.createConnection({
  host,
  port,
  user,
  password,
  database: 'zafira_tc_contract_clone',
});

const [[srcDb]] = await src.query('SELECT DATABASE() AS d');
const [[dstDb]] = await dst.query('SELECT DATABASE() AS d');
if (srcDb.d !== 'zafira') throw new Error(`refusing src ${srcDb.d}`);
if (dstDb.d !== 'zafira_tc_contract_clone') throw new Error(`refusing dst ${dstDb.d}`);

const [tables] = await dst.query(`SHOW TABLES LIKE 'login'`);
if (!tables.length) {
  const [[create]] = await src.query('SHOW CREATE TABLE login');
  const ddl = create['Create Table'];
  await dst.query(ddl);
  console.log('created login table on clone');
}

const [cols] = await dst.query('SHOW COLUMNS FROM login');
const colNames = cols.map((c) => c.Field);
const [srcRows] = await src.query(
  `SELECT * FROM login WHERE USERNAME = ? LIMIT 1`,
  ['support'],
);
if (!srcRows.length) throw new Error('support user not found on zafira.login');

const row = srcRows[0];
const placeholders = colNames.map(() => '?').join(', ');
const values = colNames.map((name) => row[name] ?? null);
await dst.query(`DELETE FROM login WHERE USERNAME = ?`, ['support']);
await dst.query(
  `INSERT INTO login (${colNames.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
  values,
);
console.log('seeded support user on clone', {
  id: row.LOGINID,
  type: row.USER_TYPE,
  status: row.STATUS,
});

await src.end();
await dst.end();

import 'dotenv/config';
import { getPool } from '../src/db.js';

const pool = getPool();
for (const table of ['support_ticket', 'support_ticket_reply']) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table],
  );
  console.log(`\n${table}:`);
  console.table(cols);
  const [sample] = await pool.query(`SELECT * FROM \`${table}\` ORDER BY 1 DESC LIMIT 3`);
  console.log('sample:', sample);
}
process.exit(0);

import 'dotenv/config';
import { getPool } from '../src/db.js';

const pool = getPool();
const [cols] = await pool.query(
  `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'freight_cost_estimete_master'
   ORDER BY ORDINAL_POSITION`,
);
const required = cols.filter((c) => c.IS_NULLABLE === 'NO' && c.COLUMN_DEFAULT === null && c.COLUMN_NAME !== 'FCAID');
console.table(required);
process.exit(0);

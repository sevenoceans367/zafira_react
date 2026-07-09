import 'dotenv/config';
import { getPool } from '../src/db.js';

const pool = getPool();
const [cols] = await pool.query(
  `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vessel_imo_master'
   ORDER BY ORDINAL_POSITION`,
);
console.log(cols.map((c) => c.COLUMN_NAME).join(', '));
process.exit(0);

import 'dotenv/config';
import { getPool } from '../src/db.js';

const pool = getPool();
const [rows] = await pool.query(
  `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE '%ticket%'`,
);
console.table(rows);
process.exit(0);

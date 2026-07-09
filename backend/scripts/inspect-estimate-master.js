import 'dotenv/config';
import { getPool } from '../src/db.js';

const pool = getPool();
const [cols] = await pool.query(
  `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'freight_cost_estimete_master'
   ORDER BY ORDINAL_POSITION`,
);
console.log('master columns:', cols.map((c) => c.COLUMN_NAME).join(', '));

const [vessels] = await pool.query(
  `SELECT VESSEL_IMO_ID, VESSEL_NAME, IMO_NO, DWT, VESSEL_TYPE, FLAG
   FROM vessel_imo_master LIMIT 3`,
);
console.table(vessels);
process.exit(0);

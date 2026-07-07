import 'dotenv/config';
import { getPool } from '../src/db.js';

const pool = getPool();

const [total] = await pool.query(
  'SELECT COUNT(*) AS c FROM freight_cost_estimete_master',
);
console.log('Total rows in freight_cost_estimete_master:', total[0].c);

const [byModule] = await pool.query(`
  SELECT MODULEID, MCOMPANYID, ESTIMATE_TYPE, COUNT(*) AS c
  FROM freight_cost_estimete_master
  GROUP BY MODULEID, MCOMPANYID, ESTIMATE_TYPE
  ORDER BY c DESC
  LIMIT 20
`);
console.log('\nBy MODULEID / MCOMPANYID / ESTIMATE_TYPE:');
console.table(byModule);

const [sample] = await pool.query(`
  SELECT FCAID, MODULEID, MCOMPANYID, ESTIMATE_TYPE, COAID, FIXED, COMID, VOYAGE_NAME
  FROM freight_cost_estimete_master
  ORDER BY FCAID DESC
  LIMIT 5
`);
console.log('\nLatest 5 rows:');
console.table(sample);

for (const type of ['1', '2', '3']) {
  const [filtered] = await pool.query(
    `SELECT COUNT(*) AS c FROM freight_cost_estimete_master
     WHERE MODULEID = ? AND MCOMPANYID = ? AND ESTIMATE_TYPE = ?
       AND COAID IS NULL AND FIXED = 0`,
    [process.env.MODULE_ID || '1', process.env.COMPANY_ID || '1', type],
  );
  console.log(`Filtered (module=${process.env.MODULE_ID}, company=${process.env.COMPANY_ID}, type=${type}):`, filtered[0].c);
}

// Try without module/company filter
const [noFilter] = await pool.query(`
  SELECT COUNT(*) AS c FROM freight_cost_estimete_master
  WHERE ESTIMATE_TYPE = '1' AND COAID IS NULL AND FIXED = 0
`);
console.log('\nWithout module/company filter (type=1):', noFilter[0].c);

const [correctFilter] = await pool.query(
  `SELECT COUNT(*) AS c FROM freight_cost_estimete_master
   WHERE MODULEID = '6' AND MCOMPANYID = '1' AND ESTIMATE_TYPE = '2'
     AND COAID IS NULL AND FIXED = '0'`,
);
console.log('\nWith MODULEID=6, type=2 (Tanker), FIXED=0:', correctFilter[0].c);

const [rows] = await pool.query(
  `SELECT FCAID, COMID, FIXED, VOYAGE_NAME FROM freight_cost_estimete_master
   WHERE MODULEID = '6' AND MCOMPANYID = '1' AND ESTIMATE_TYPE = '2'
     AND COAID IS NULL AND FIXED = '0'`,
);
console.table(rows);

process.exit(0);

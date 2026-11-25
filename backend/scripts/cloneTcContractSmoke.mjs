/**
 * Clone-only smoke for CONTRACT_TYPE / dormant Hire Recap parity.
 * Usage (from backend/):
 *   node scripts/cloneTcContractSmoke.mjs
 * Forces DB_NAME=zafira_tc_contract_clone after dotenv.
 */
import dotenv from 'dotenv';
dotenv.config();
process.env.DB_NAME = 'zafira_tc_contract_clone';

const { getPool } = await import('../src/db.js');
const { dbConfig } = await import('../src/config.js');
const {
  resetTcContractTypeMigrationStateForTests,
  runTcContractTypeMigration,
} = await import('../src/migrations/tcContractTypeMigration.js');
const {
  dbSaveTcCalculation,
  dbGetTcEstimate,
  dbUpdateTcEstimate,
} = await import('../src/services/tcEstimateDb.js');
const { computeTcInFinalHireage } = await import('../src/services/tcEstimateMappers.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(actual, expected, msg) {
  if (String(actual) === String(expected)) return;
  const aNum = Number(actual);
  const eNum = Number(expected);
  if (Number.isFinite(aNum) && Number.isFinite(eNum) && aNum === eNum) return;
  throw new Error(`${msg}: expected ${expected}, got ${actual}`);
}

resetTcContractTypeMigrationStateForTests('pending');
const pool = getPool();
const [[meta]] = await pool.query('SELECT DATABASE() AS db, VERSION() AS ver');
console.log('target', meta, 'config', dbConfig.database);
assert(meta.db === 'zafira_tc_contract_clone', `refusing DB ${meta.db}`);

const mig = await runTcContractTypeMigration(pool);
assert(mig.ok, `migration failed: ${mig.detail}`);
console.log('migration', mig);

const [rows] = await pool.query(`
  SELECT m.TCOUTID, m.CONTRACT_TYPE, m.MODULEID, m.MCOMPANYID,
         LEFT(m.TC_IN_RECAP_JSON, 120) AS json_head,
         s1.TC_SLAVE1ID, s1.TC_FINAL_HIERAGE
  FROM chartering_estimate_tc_master m
  LEFT JOIN chartering_tc_estimate_slave1 s1 ON s1.TCOUTID = m.TCOUTID
  ORDER BY m.TCOUTID
  LIMIT 10
`);
console.log('rows', rows);

const rich = rows.find((r) => r.CONTRACT_TYPE === 'tcinout') || rows[0];
assert(rich?.TCOUTID, 'need at least one TC master row on clone');
const tcOutId = rich.TCOUTID;

// Internally consistent fixture: nett 290000 + bunker 1000 + ILOHC 50 = 291050
const dormantPayload = {
  recapProvenance: 'edited',
  finalHireage: '291050.00', // must match computeTcInFinalHireage (not a mismatched scalar)
  finalVendor: 'SMOKE-VENDOR',
  hires: [{
    randomId: 'smoke1',
    deliveryDate: '01-01-2026 08:00',
    redeliveryDate: '31-01-2026 08:00',
    dailyHire: '10000',
    hireage: '300000',
    nettHireage: '290000',
    voyageDays: '30',
    cveAmt: '0',
  }],
  deliveryBunkers: [{ bunkerId: '1', qty: '10', price: '100', amount: '1000' }],
  redeliveryBunkers: [],
  offHires: [],
  ilohc: '50',
  awrpCost: '0',
};
const expectedHireage = computeTcInFinalHireage(dormantPayload).finalHireage;
assertEq(expectedHireage, '291050.00', 'fixture must match computeTcInFinalHireage');
assertEq(dormantPayload.finalHireage, expectedHireage, 'scalar must match components');

const expectedActiveTotalExp = 40 + 291050; // add-to-TTL expense + active hireage

// Snapshot master fields for stale-update proof
const [[masterBefore]] = await pool.query(
  `SELECT TC_NO, CONTRACT_TYPE FROM chartering_estimate_tc_master WHERE TCOUTID = ?`,
  [tcOutId],
);

// 1) Activate tcinout with full recap
let r = await dbSaveTcCalculation(tcOutId, {
  contractType: 'tcinout',
  baseContractType: rich.CONTRACT_TYPE || 'tcout',
  calc: { totalExp: String(expectedActiveTotalExp), otherIncome: 0 },
  otherIncome: [{ accountType: 'Charterer', description: 'smoke income', amount: '25' }],
  otherExpenses: [{ description: 'smoke exp', amount: '40', addToTotal: true }],
  tcInExpenses: dormantPayload,
  hirePeriods: [{
    delDate: '01-01-2026 08:00',
    reDelDate: '11-01-2026 08:00',
    hireRate: '10000',
  }],
});
assert(r?.contractType === 'tcinout', 'expected tcinout after activate');
assertEq(r.calc?.tcFinalHireage, expectedHireage, 'activate hireage');
assertEq(Number(r.calc?.totalExp), expectedActiveTotalExp, 'activate totalExp');
console.log('activate', { hireage: r.calc?.tcFinalHireage, totalExp: r.calc?.totalExp });

let detail = await dbGetTcEstimate(tcOutId);
assert(detail.contractType === 'tcinout', 'detail tcinout');
assertEq(detail.calc?.tcFinalHireage, expectedHireage, 'detail hireage');

const [[s1]] = await pool.query(
  `SELECT TC_SLAVE1ID, TC_FINAL_HIERAGE FROM chartering_tc_estimate_slave1 WHERE TCOUTID = ?`,
  [tcOutId],
);
assert(s1?.TC_SLAVE1ID, 'slave1 row required');
assertEq(Number(s1.TC_FINAL_HIERAGE), Number(expectedHireage), 'physical slave1 hireage');

const [hireRows] = await pool.query(
  `SELECT RANDOMID, NET_HIERAGE FROM chartering_tc_estimate_slave2 WHERE TC_SLAVE1ID = ?`,
  [s1.TC_SLAVE1ID],
);
assert(hireRows.length >= 1, 'physical TC In hire row (slave2)');
assertEq(Number(hireRows[0].NET_HIERAGE), 290000, 'physical nett hireage');

const [bunkerRows] = await pool.query(
  `SELECT * FROM chartering_tc_estimate_slave3 WHERE TC_SLAVE1ID = ?`,
  [s1.TC_SLAVE1ID],
);
assert(bunkerRows.length >= 1, 'physical TC In bunker row (slave3)');

const [incRows] = await pool.query(
  `SELECT DESCRIPTION, OTHER_AMT, STATUS FROM chartering_estimate_tc_slave2
   WHERE TC_SLAVE1ID = ? AND STATUS = 1`,
  [s1.TC_SLAVE1ID],
);
assert(incRows.some((row) => String(row.DESCRIPTION) === 'smoke income'), 'income STATUS=1 row');

const [expRows] = await pool.query(
  `SELECT DESCRIPTION, OTHER_AMT, STATUS FROM chartering_estimate_tc_slave2
   WHERE TC_SLAVE1ID = ? AND STATUS = 2`,
  [s1.TC_SLAVE1ID],
);
assert(expRows.some((row) => String(row.DESCRIPTION) === 'smoke exp'), 'expense STATUS=2 row');

// 2) Deactivate to tcout — keep JSON, hireage 0, children cleared
r = await dbSaveTcCalculation(tcOutId, {
  contractType: 'tcout',
  baseContractType: 'tcinout',
  calc: { totalExp: '40', tcFinalHireage: '0' },
  otherExpenses: [{ description: 'smoke exp', amount: '40', addToTotal: true }],
  otherIncome: [{ accountType: 'Charterer', description: 'smoke income', amount: '25' }],
  tcInExpenses: dormantPayload,
  hirePeriods: [{
    delDate: '01-01-2026 08:00',
    reDelDate: '11-01-2026 08:00',
    hireRate: '10000',
  }],
});
assert(r?.contractType === 'tcout', 'expected tcout');
assertEq(r.calc?.tcFinalHireage, '0', 'dormant hireage');
assertEq(Number(r.calc?.totalExp), 40, 'dormant totalExp (expense only)');
const [[jsonRow]] = await pool.query(
  'SELECT TC_IN_RECAP_JSON AS j, CONTRACT_TYPE AS mode FROM chartering_estimate_tc_master WHERE TCOUTID = ?',
  [tcOutId],
);
assert(jsonRow.mode === 'tcout', 'stored mode tcout');
assert(String(jsonRow.j || '').includes(expectedHireage), 'dormant JSON retained exact hireage');
assert(String(jsonRow.j || '').includes('SMOKE-VENDOR'), 'dormant JSON retained vendor');
const [hiresAfterOut] = await pool.query(
  `SELECT 1 FROM chartering_tc_estimate_slave2 WHERE TC_SLAVE1ID = ?`,
  [s1.TC_SLAVE1ID],
);
assert(hiresAfterOut.length === 0, 'TC In hire children cleared under tcout');
console.log('deactivate ok', { mode: jsonRow.mode });

// 3) Repeated TC Out WITHOUT tcInExpenses — must not wipe JSON
r = await dbSaveTcCalculation(tcOutId, {
  contractType: 'tcout',
  baseContractType: 'tcout',
  calc: { totalExp: '40', tcFinalHireage: '0' },
  otherExpenses: [{ description: 'smoke exp', amount: '40', addToTotal: true }],
  hirePeriods: [{
    delDate: '01-01-2026 08:00',
    reDelDate: '11-01-2026 08:00',
    hireRate: '10000',
  }],
});
const [[jsonRow2]] = await pool.query(
  'SELECT TC_IN_RECAP_JSON AS j FROM chartering_estimate_tc_master WHERE TCOUTID = ?',
  [tcOutId],
);
assert(String(jsonRow2.j || '').includes(expectedHireage), 'repeated tcout must preserve dormant JSON');
assert(String(jsonRow2.j || '').includes('SMOKE-VENDOR'), 'vendor metadata preserved');
console.log('repeated tcout preserve ok');

// 4) Restore tcinout with OMITTED tcInExpenses — rebuild from JSON + physical rows
r = await dbSaveTcCalculation(tcOutId, {
  contractType: 'tcinout',
  baseContractType: 'tcout',
  calc: { totalExp: String(expectedActiveTotalExp) },
  otherExpenses: [{ description: 'smoke exp', amount: '40', addToTotal: true }],
  hirePeriods: [{
    delDate: '01-01-2026 08:00',
    reDelDate: '11-01-2026 08:00',
    hireRate: '10000',
  }],
});
assert(r?.contractType === 'tcinout', 'restored tcinout');
assertEq(r.calc?.tcFinalHireage, expectedHireage, 'restored hireage');
detail = await dbGetTcEstimate(tcOutId);
assert((detail.tcInExpenses?.hires || []).length >= 1, 'detail hires present');
const [hiresRestored] = await pool.query(
  `SELECT RANDOMID, NET_HIERAGE FROM chartering_tc_estimate_slave2 WHERE TC_SLAVE1ID = ?`,
  [s1.TC_SLAVE1ID],
);
assert(hiresRestored.length >= 1, 'physical hire rows restored');
assertEq(Number(hiresRestored[0].NET_HIERAGE), 290000, 'restored physical nett');
const [bunkersRestored] = await pool.query(
  `SELECT 1 AS ok FROM chartering_tc_estimate_slave3 WHERE TC_SLAVE1ID = ?`,
  [s1.TC_SLAVE1ID],
);
assert(bunkersRestored.length >= 1, 'physical bunker rows restored');
console.log('restore omitted payload ok', {
  hireage: r.calc?.tcFinalHireage,
  physicalHires: hiresRestored.length,
});

// 5) Stale calc 409
let threw = false;
try {
  await dbSaveTcCalculation(tcOutId, {
    contractType: 'tcout',
    baseContractType: 'tcout', // DB is tcinout now
    calc: {},
  });
} catch (err) {
  threw = err.status === 409;
  console.log('stale calc 409', err.message);
}
assert(threw, 'expected 409 stale baseContractType on calculate');

// 6) Stale fixture master update 409 — master must remain unchanged
const markerNo = `SMOKE-STALE-${Date.now()}`;
let fixtureThrew = false;
try {
  await dbUpdateTcEstimate(tcOutId, {
    baseContractType: 'tcout', // stale vs current tcinout
    tcNo: markerNo,
    deliveryBunkers: [{ bunkerId: '99', qty: '1', price: '1', amount: '1' }],
  });
} catch (err) {
  fixtureThrew = err.status === 409;
  console.log('stale fixture 409', err.message);
}
assert(fixtureThrew, 'expected 409 stale baseContractType on fixture update');
const [[masterAfter]] = await pool.query(
  `SELECT TC_NO, CONTRACT_TYPE FROM chartering_estimate_tc_master WHERE TCOUTID = ?`,
  [tcOutId],
);
assertEq(masterAfter.TC_NO, masterBefore.TC_NO, 'stale fixture must not mutate TC_NO');
assert(String(masterAfter.TC_NO) !== markerNo, 'stale fixture must not apply marker TC_NO');
assertEq(masterAfter.CONTRACT_TYPE, 'tcinout', 'mode unchanged after rejected fixture save');

console.log('CLONE_SMOKE_PASS');
await pool.end();
process.exit(0);

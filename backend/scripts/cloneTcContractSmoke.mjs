/**
 * Clone-only smoke for CONTRACT_TYPE / dormant Hire Recap.
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
const { dbSaveTcCalculation, dbGetTcEstimate } = await import('../src/services/tcEstimateDb.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
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

const dormantPayload = {
  recapProvenance: 'edited',
  finalHireage: '3568500',
  finalVendor: 'SMOKE-VENDOR',
  hires: [{
    randomId: 'smoke1',
    deliveryDate: '01-01-2026 08:00',
    redeliveryDate: '31-01-2026 08:00',
    dailyHire: '10000',
    hireage: '300000',
    nettHireage: '290000',
    voyageDays: '30',
  }],
  deliveryBunkers: [{ bunkerId: '1', qty: '10', price: '100', amount: '1000' }],
  redeliveryBunkers: [],
  offHires: [],
  ilohc: '50',
  awrpCost: '0',
};

// 1) Activate tcinout with full recap
let r = await dbSaveTcCalculation(tcOutId, {
  contractType: 'tcinout',
  baseContractType: rich.CONTRACT_TYPE || 'tcout',
  calc: { totalExp: '100', otherIncome: 0 },
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
console.log('activate', { hireage: r.calc?.tcFinalHireage, totalExp: r.calc?.totalExp });

let detail = await dbGetTcEstimate(tcOutId);
assert(detail.contractType === 'tcinout', 'detail tcinout');
assert(Number(detail.calc?.tcFinalHireage) > 0 || Number(detail.tcInExpenses?.finalHireage) > 0, 'active hireage present');

// 2) Deactivate to tcout — should keep JSON, hireage 0
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
assert(String(r.calc?.tcFinalHireage) === '0', `dormant hireage should be 0 got ${r.calc?.tcFinalHireage}`);
detail = await dbGetTcEstimate(tcOutId);
const [[jsonRow]] = await pool.query(
  'SELECT TC_IN_RECAP_JSON AS j, CONTRACT_TYPE AS mode FROM chartering_estimate_tc_master WHERE TCOUTID = ?',
  [tcOutId],
);
assert(jsonRow.mode === 'tcout', 'stored mode tcout');
assert(String(jsonRow.j || '').includes('3568500'), 'dormant JSON retained finalHireage');
console.log('deactivate ok', { mode: jsonRow.mode, jsonHasHireage: String(jsonRow.j).includes('3568500') });

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
assert(String(jsonRow2.j || '').includes('3568500'), 'repeated tcout must preserve dormant JSON');
assert(String(jsonRow2.j || '').includes('SMOKE-VENDOR'), 'vendor metadata preserved');
console.log('repeated tcout preserve ok');

// 4) Restore tcinout with OMITTED tcInExpenses — rebuild from JSON
r = await dbSaveTcCalculation(tcOutId, {
  contractType: 'tcinout',
  baseContractType: 'tcout',
  calc: { totalExp: '40' },
  otherExpenses: [{ description: 'smoke exp', amount: '40', addToTotal: true }],
  hirePeriods: [{
    delDate: '01-01-2026 08:00',
    reDelDate: '11-01-2026 08:00',
    hireRate: '10000',
  }],
});
assert(r?.contractType === 'tcinout', 'restored tcinout');
assert(Number(r.calc?.tcFinalHireage) === 3568500, `restored hireage expected 3568500 got ${r.calc?.tcFinalHireage}`);
detail = await dbGetTcEstimate(tcOutId);
assert((detail.tcInExpenses?.hires || []).length >= 1, 'relational hires restored');
console.log('restore omitted payload ok', {
  hireage: r.calc?.tcFinalHireage,
  hires: detail.tcInExpenses?.hires?.length,
});

// 5) Stale mode 409
let threw = false;
try {
  await dbSaveTcCalculation(tcOutId, {
    contractType: 'tcout',
    baseContractType: 'tcout', // DB is tcinout now
    calc: {},
  });
} catch (err) {
  threw = err.status === 409;
  console.log('stale 409', err.message);
}
assert(threw, 'expected 409 stale baseContractType');

console.log('CLONE_SMOKE_PASS');
await pool.end();
process.exit(0);

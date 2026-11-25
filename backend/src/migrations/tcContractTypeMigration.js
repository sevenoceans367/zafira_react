/**
 * Versioned CONTRACT_TYPE migration for chartering_estimate_tc_master.
 *
 * - Not invoked from ordinary list/read paths.
 * - Idempotent; uses GET_LOCK to serialize concurrent runners.
 * - Backfill is conservative: relational TC In children and nonzero hireage
 *   count as tcinout even without PERIODID/JSON; ambiguous rows stay NULL
 *   for explicit review (legacy inference still applies on read).
 */
import { getPool } from '../db.js';

export const TC_CONTRACT_TYPE_MIGRATION_VERSION = 1;
const LOCK_NAME = 'zafira_tc_contract_type_mig_v1';
const LOCK_TIMEOUT_SEC = 30;

let migrationState = 'pending'; // pending | ready | failed

export function getTcContractTypeMigrationState() {
  return migrationState;
}

export function isTcContractTypeSchemaReady() {
  return migrationState === 'ready';
}

async function columnExists(pool, column) {
  const [cols] = await pool.query(
    `SHOW COLUMNS FROM chartering_estimate_tc_master LIKE ?`,
    [column],
  );
  return cols.length > 0;
}

async function ensureMetaTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS zafira_schema_migrations (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      version INT NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes VARCHAR(255) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function alreadyApplied(pool) {
  try {
    const [[row]] = await pool.query(
      `SELECT version FROM zafira_schema_migrations WHERE id = 'tc_contract_type' LIMIT 1`,
    );
    return Number(row?.version || 0) >= TC_CONTRACT_TYPE_MIGRATION_VERSION;
  } catch {
    return false;
  }
}

/**
 * Conservative backfill: only classify clear cases; leave NULL when ambiguous.
 * Read path falls back to PERIODID/JSON inference for NULL.
 */
async function backfillContractType(pool) {
  // Clear tcinout: nonzero period, non-empty JSON, or existing TC In hire children / hireage.
  await pool.query(`
    UPDATE chartering_estimate_tc_master m
    SET CONTRACT_TYPE = 'tcinout'
    WHERE m.CONTRACT_TYPE IS NULL
      AND (
        (m.PERIODID IS NOT NULL AND TRIM(CAST(m.PERIODID AS CHAR)) NOT IN ('', '0'))
        OR (m.TC_IN_RECAP_JSON IS NOT NULL AND TRIM(m.TC_IN_RECAP_JSON) NOT IN ('', 'null', '{}'))
        OR EXISTS (
          SELECT 1 FROM chartering_tc_estimate_slave1 s1
          WHERE s1.TCOUTID = m.TCOUTID
            AND (
              (s1.TC_FINAL_HIERAGE IS NOT NULL AND s1.TC_FINAL_HIERAGE <> 0)
              OR EXISTS (
                SELECT 1 FROM chartering_tc_estimate_slave2 s2
                WHERE s2.TC_SLAVE1ID = s1.TC_SLAVE1ID
              )
            )
        )
      )
  `);

  // Clear tcout: no period, no JSON, no TC In hireage/children.
  await pool.query(`
    UPDATE chartering_estimate_tc_master m
    SET CONTRACT_TYPE = 'tcout'
    WHERE m.CONTRACT_TYPE IS NULL
      AND (m.PERIODID IS NULL OR TRIM(CAST(m.PERIODID AS CHAR)) IN ('', '0'))
      AND (m.TC_IN_RECAP_JSON IS NULL OR TRIM(m.TC_IN_RECAP_JSON) IN ('', 'null', '{}'))
      AND NOT EXISTS (
        SELECT 1 FROM chartering_tc_estimate_slave1 s1
        WHERE s1.TCOUTID = m.TCOUTID
          AND (
            (s1.TC_FINAL_HIERAGE IS NOT NULL AND s1.TC_FINAL_HIERAGE <> 0)
            OR EXISTS (
              SELECT 1 FROM chartering_tc_estimate_slave2 s2
              WHERE s2.TC_SLAVE1ID = s1.TC_SLAVE1ID
            )
          )
      )
  `);
}

/**
 * Run once at process boot (or explicit CLI). Safe to call repeatedly.
 * @returns {{ ok: boolean, state: string, detail?: string }}
 */
export async function runTcContractTypeMigration(pool = getPool()) {
  if (migrationState === 'ready') {
    return { ok: true, state: migrationState };
  }

  let lockAcquired = false;
  try {
    const [[lockRow]] = await pool.query(`SELECT GET_LOCK(?, ?) AS got`, [LOCK_NAME, LOCK_TIMEOUT_SEC]);
    lockAcquired = Number(lockRow?.got) === 1;
    if (!lockAcquired) {
      migrationState = 'failed';
      return { ok: false, state: migrationState, detail: 'Could not acquire migration lock' };
    }

    await ensureMetaTable(pool);

    if (await alreadyApplied(pool) && await columnExists(pool, 'CONTRACT_TYPE')) {
      migrationState = 'ready';
      return { ok: true, state: migrationState, detail: 'already applied' };
    }

    if (!(await columnExists(pool, 'CONTRACT_TYPE'))) {
      await pool.query(
        `ALTER TABLE chartering_estimate_tc_master
         ADD COLUMN CONTRACT_TYPE VARCHAR(16) NULL`,
      );
    }

    await backfillContractType(pool);

    await pool.query(
      `INSERT INTO zafira_schema_migrations (id, version, notes)
       VALUES ('tc_contract_type', ?, ?)
       ON DUPLICATE KEY UPDATE version = VALUES(version), applied_at = CURRENT_TIMESTAMP, notes = VALUES(notes)`,
      [TC_CONTRACT_TYPE_MIGRATION_VERSION, 'CONTRACT_TYPE column + conservative backfill'],
    );

    migrationState = 'ready';
    return { ok: true, state: migrationState };
  } catch (error) {
    migrationState = 'failed';
    console.error('[tcContractTypeMigration] failed:', error.message);
    return { ok: false, state: migrationState, detail: error.message };
  } finally {
    if (lockAcquired) {
      try {
        await pool.query(`SELECT RELEASE_LOCK(?)`, [LOCK_NAME]);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Read-only probe — never runs DDL. */
export async function probeTcContractTypeColumn(pool = getPool()) {
  try {
    const exists = await columnExists(pool, 'CONTRACT_TYPE');
    if (exists) migrationState = 'ready';
    return exists;
  } catch {
    return false;
  }
}

/** Require schema for writes; attempt migration once if pending. */
export async function requireTcContractTypeSchema(pool = getPool()) {
  if (migrationState === 'ready') return true;
  const probed = await probeTcContractTypeColumn(pool);
  if (probed) return true;
  const result = await runTcContractTypeMigration(pool);
  if (!result.ok) {
    const err = new Error(
      `CONTRACT_TYPE schema unavailable: ${result.detail || 'migration failed'}. Refusing contract-mode write.`,
    );
    err.status = 503;
    throw err;
  }
  return true;
}

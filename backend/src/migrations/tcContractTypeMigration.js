/**
 * Versioned CONTRACT_TYPE (+ TC_IN_RECAP_JSON dependency) migration.
 *
 * - Boot-only (not from ordinary write/request paths).
 * - Idempotent; GET_LOCK on one dedicated connection (session-scoped).
 * - Ready only when ledger + CONTRACT_TYPE + TC_IN_RECAP_JSON are verified.
 * - Backfill is conservative: malformed/placeholder JSON stays NULL (ambiguous).
 */
import { getPool } from '../db.js';

export const TC_CONTRACT_TYPE_MIGRATION_VERSION = 2;
const LOCK_NAME = 'zafira_tc_contract_type_mig_v1';
const LOCK_TIMEOUT_SEC = 30;

let migrationState = 'pending'; // pending | ready | failed

export function getTcContractTypeMigrationState() {
  return migrationState;
}

export function isTcContractTypeSchemaReady() {
  return migrationState === 'ready';
}

/** Test-only: reset in-memory gate between cases. */
export function resetTcContractTypeMigrationStateForTests(next = 'pending') {
  migrationState = next;
}

async function columnExists(conn, column) {
  const [cols] = await conn.query(
    `SHOW COLUMNS FROM chartering_estimate_tc_master LIKE ?`,
    [column],
  );
  return cols.length > 0;
}

async function ensureMetaTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS zafira_schema_migrations (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      version INT NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes VARCHAR(255) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function alreadyApplied(conn) {
  try {
    const [[row]] = await conn.query(
      `SELECT version FROM zafira_schema_migrations WHERE id = 'tc_contract_type' LIMIT 1`,
    );
    return Number(row?.version || 0) >= TC_CONTRACT_TYPE_MIGRATION_VERSION;
  } catch {
    return false;
  }
}

async function ensureLongtextColumn(conn, column) {
  if (await columnExists(conn, column)) return;
  await conn.query(
    `ALTER TABLE chartering_estimate_tc_master
     ADD COLUMN \`${column}\` LONGTEXT NULL`,
  );
}

/** True when parsed Hire Recap JSON has a recoverable TC In signal (Node-side; no JSON_VALID). */
function jsonRecapHasTcInSignal(raw) {
  if (raw == null) return false;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === 'null' || trimmed === '{}' || trimmed === '[]') return false;
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(trimmed) : raw;
  } catch {
    return false; // malformed → ambiguous, leave NULL
  }
  if (!parsed || typeof parsed !== 'object') return false;
  const fh = parsed.finalHireage;
  if (fh != null && String(fh).trim() !== '' && String(fh).trim() !== 'null') return true;
  if (Array.isArray(parsed.hires) && parsed.hires.length > 0) return true;
  if (Array.isArray(parsed.offHires) && parsed.offHires.length > 0) return true;
  if (Array.isArray(parsed.deliveryBunkers) && parsed.deliveryBunkers.length > 0) return true;
  if (Array.isArray(parsed.redeliveryBunkers) && parsed.redeliveryBunkers.length > 0) return true;
  return false;
}

/**
 * Conservative backfill: clear tcinout / tcout only; leave NULL when ambiguous.
 * JSON classification is done in Node (MySQL 5.5/MariaDB without JSON_VALID).
 * Malformed or placeholder-only JSON does NOT count as TC In.
 */
async function backfillContractType(conn) {
  // Clear tcinout from period / relational signals (no JSON functions required).
  await conn.query(`
    UPDATE chartering_estimate_tc_master m
    SET CONTRACT_TYPE = 'tcinout'
    WHERE m.CONTRACT_TYPE IS NULL
      AND (
        (m.PERIODID IS NOT NULL AND TRIM(CAST(m.PERIODID AS CHAR)) NOT IN ('', '0'))
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

  // JSON signal rows — parse in Node so malformed stays NULL on older servers.
  const [jsonCandidates] = await conn.query(`
    SELECT TCOUTID, TC_IN_RECAP_JSON
    FROM chartering_estimate_tc_master
    WHERE CONTRACT_TYPE IS NULL
      AND TC_IN_RECAP_JSON IS NOT NULL
      AND TRIM(TC_IN_RECAP_JSON) NOT IN ('', 'null', '{}', '[]')
  `);
  for (const row of jsonCandidates) {
    if (!jsonRecapHasTcInSignal(row.TC_IN_RECAP_JSON)) continue;
    await conn.query(
      `UPDATE chartering_estimate_tc_master
       SET CONTRACT_TYPE = 'tcinout'
       WHERE TCOUTID = ? AND CONTRACT_TYPE IS NULL`,
      [row.TCOUTID],
    );
  }

  // Clear tcout only when no period, no nonempty JSON blob, no relational hireage/children.
  // Nonempty malformed JSON remains NULL (ambiguous quarantine).
  await conn.query(`
    UPDATE chartering_estimate_tc_master m
    SET CONTRACT_TYPE = 'tcout'
    WHERE m.CONTRACT_TYPE IS NULL
      AND (m.PERIODID IS NULL OR TRIM(CAST(m.PERIODID AS CHAR)) IN ('', '0'))
      AND (
        m.TC_IN_RECAP_JSON IS NULL
        OR TRIM(m.TC_IN_RECAP_JSON) IN ('', 'null', '{}', '[]')
      )
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

async function releaseLock(conn) {
  const [[row]] = await conn.query(`SELECT RELEASE_LOCK(?) AS released`, [LOCK_NAME]);
  return Number(row?.released) === 1;
}

async function schemaPostconditionsMet(conn) {
  return (await alreadyApplied(conn))
    && (await columnExists(conn, 'CONTRACT_TYPE'))
    && (await columnExists(conn, 'TC_IN_RECAP_JSON'));
}

/**
 * Run once at process boot. Safe to call repeatedly.
 * Holds GET_LOCK / DDL / backfill / RELEASE_LOCK on one dedicated connection.
 * On unlock failure, destroys the connection instead of returning it to the pool.
 * @returns {{ ok: boolean, state: string, detail?: string }}
 */
export async function runTcContractTypeMigration(pool = getPool()) {
  if (migrationState === 'ready') {
    return { ok: true, state: migrationState };
  }

  const connection = await pool.getConnection();
  let lockAcquired = false;
  let unlockOk = true;
  try {
    const [[lockRow]] = await connection.query(
      `SELECT GET_LOCK(?, ?) AS got`,
      [LOCK_NAME, LOCK_TIMEOUT_SEC],
    );
    lockAcquired = Number(lockRow?.got) === 1;
    if (!lockAcquired) {
      migrationState = 'failed';
      return { ok: false, state: migrationState, detail: 'Could not acquire migration lock' };
    }

    await ensureMetaTable(connection);

    // JSON dependency before backfill / writes. No unrelated income schema here —
    // Legacy STATUS=1 otherIncome remains undifferentiated revenue.
    await ensureLongtextColumn(connection, 'TC_IN_RECAP_JSON');

    if (await schemaPostconditionsMet(connection)
      && (await alreadyApplied(connection))) {
      migrationState = 'ready';
      return { ok: true, state: migrationState, detail: 'already applied' };
    }

    if (!(await columnExists(connection, 'CONTRACT_TYPE'))) {
      await connection.query(
        `ALTER TABLE chartering_estimate_tc_master
         ADD COLUMN CONTRACT_TYPE VARCHAR(16) NULL`,
      );
    }

    await backfillContractType(connection);

    await connection.query(
      `INSERT INTO zafira_schema_migrations (id, version, notes)
       VALUES ('tc_contract_type', ?, ?)
       ON DUPLICATE KEY UPDATE version = VALUES(version), applied_at = CURRENT_TIMESTAMP, notes = VALUES(notes)`,
      [
        TC_CONTRACT_TYPE_MIGRATION_VERSION,
        'CONTRACT_TYPE + TC_IN_RECAP_JSON + conservative backfill',
      ],
    );

    if (!(await schemaPostconditionsMet(connection))) {
      migrationState = 'failed';
      return {
        ok: false,
        state: migrationState,
        detail: 'Migration postconditions failed (ledger or required columns missing)',
      };
    }

    migrationState = 'ready';
    return { ok: true, state: migrationState };
  } catch (error) {
    migrationState = 'failed';
    console.error('[tcContractTypeMigration] failed:', error.message);
    return { ok: false, state: migrationState, detail: error.message };
  } finally {
    if (lockAcquired) {
      try {
        unlockOk = await releaseLock(connection);
      } catch {
        unlockOk = false;
      }
    }
    if (!unlockOk) {
      try {
        connection.destroy();
      } catch {
        /* ignore */
      }
    } else {
      connection.release();
    }
  }
}

/**
 * Read-only probe — never runs DDL and never marks migration ready.
 */
export async function probeTcContractTypeColumn(pool = getPool()) {
  try {
    return await columnExists(pool, 'CONTRACT_TYPE');
  } catch {
    return false;
  }
}

export async function verifyTcContractTypeMigrationApplied(pool = getPool()) {
  try {
    return await schemaPostconditionsMet(pool);
  } catch {
    return false;
  }
}

/**
 * Require schema for writes. Never runs DDL from request paths.
 * Boot must have completed the versioned migration.
 */
export async function requireTcContractTypeSchema(pool = getPool()) {
  if (migrationState === 'ready') return true;
  if (migrationState === 'failed') {
    const err = new Error(
      'CONTRACT_TYPE schema unavailable: migration failed at boot. Refusing contract-mode write.',
    );
    err.status = 503;
    throw err;
  }

  if (await verifyTcContractTypeMigrationApplied(pool)) {
    migrationState = 'ready';
    return true;
  }

  const err = new Error(
    'CONTRACT_TYPE schema unavailable: boot migration not applied. Refusing contract-mode write.',
  );
  err.status = 503;
  throw err;
}

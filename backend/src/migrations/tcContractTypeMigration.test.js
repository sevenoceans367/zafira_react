import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTcContractTypeMigrationState,
  probeTcContractTypeColumn,
  requireTcContractTypeSchema,
  resetTcContractTypeMigrationStateForTests,
  runTcContractTypeMigration,
  verifyTcContractTypeMigrationApplied,
} from './tcContractTypeMigration.js';

function makeFakePool({ column = false, ledgerVersion = 0, lockGot = 1 } = {}) {
  const state = { column, ledgerVersion, lockGot };
  const sessions = [];
  const pool = {
    async getConnection() {
      const conn = {
        id: sessions.length + 1,
        released: false,
        async query(sql, params = []) {
          const text = String(sql);
          if (/GET_LOCK/i.test(text)) return [[{ got: state.lockGot }]];
          if (/RELEASE_LOCK/i.test(text)) return [[{ released: 1 }]];
          if (/SHOW COLUMNS/i.test(text)) return [state.column ? [{ Field: 'CONTRACT_TYPE' }] : []];
          if (/CREATE TABLE IF NOT EXISTS zafira_schema_migrations/i.test(text)) return [{ affectedRows: 0 }];
          if (/FROM zafira_schema_migrations/i.test(text)) {
            return [state.ledgerVersion ? [{ version: state.ledgerVersion }] : []];
          }
          if (/ALTER TABLE/i.test(text)) {
            state.column = true;
            return [{ affectedRows: 0 }];
          }
          if (/UPDATE chartering_estimate_tc_master/i.test(text)) return [{ affectedRows: 0 }];
          if (/INSERT INTO zafira_schema_migrations/i.test(text)) {
            state.ledgerVersion = Number(params[0]) || 1;
            return [{ affectedRows: 1 }];
          }
          return [[]];
        },
        release() {
          this.released = true;
        },
      };
      sessions.push(conn);
      return conn;
    },
    async query(sql, params) {
      // Pool-level query used only by probe/verify helpers.
      const conn = await this.getConnection();
      try {
        return await conn.query(sql, params);
      } finally {
        conn.release();
      }
    },
    sessions,
  };
  return pool;
}

describe('tcContractTypeMigration', () => {
  it('probe never marks migration ready from column existence alone', async () => {
    resetTcContractTypeMigrationStateForTests('pending');
    const pool = makeFakePool({ column: true, ledgerVersion: 0 });
    assert.equal(await probeTcContractTypeColumn(pool), true);
    assert.equal(getTcContractTypeMigrationState(), 'pending');
    assert.equal(await verifyTcContractTypeMigrationApplied(pool), false);
  });

  it('runs GET_LOCK / work / RELEASE_LOCK on one dedicated connection', async () => {
    resetTcContractTypeMigrationStateForTests('pending');
    const pool = makeFakePool({ column: false, ledgerVersion: 0 });
    const result = await runTcContractTypeMigration(pool);
    assert.equal(result.ok, true);
    assert.equal(getTcContractTypeMigrationState(), 'ready');
    assert.equal(pool.sessions.length, 1);
    assert.equal(pool.sessions[0].released, true);
  });

  it('requireTcContractTypeSchema refuses when lock cannot be acquired', async () => {
    resetTcContractTypeMigrationStateForTests('pending');
    const pool = makeFakePool({ column: false, ledgerVersion: 0, lockGot: 0 });
    await assert.rejects(
      () => requireTcContractTypeSchema(pool),
      (err) => err.status === 503,
    );
    assert.equal(getTcContractTypeMigrationState(), 'failed');
  });

  it('marks ready when ledger + column already verified without rewriting', async () => {
    resetTcContractTypeMigrationStateForTests('pending');
    const pool = makeFakePool({ column: true, ledgerVersion: 1 });
    assert.equal(await requireTcContractTypeSchema(pool), true);
    assert.equal(getTcContractTypeMigrationState(), 'ready');
  });
});

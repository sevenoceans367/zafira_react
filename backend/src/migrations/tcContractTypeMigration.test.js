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

function makeFakePool({
  contractType = false,
  tcInRecapJson = false,
  ledgerVersion = 0,
  lockGot = 1,
  releaseOk = 1,
} = {}) {
  const state = { contractType, tcInRecapJson, ledgerVersion, lockGot, releaseOk, destroyed: false };
  const sessions = [];
  const pool = {
    async getConnection() {
      const conn = {
        id: sessions.length + 1,
        released: false,
        destroyed: false,
        async query(sql, params = []) {
          const text = String(sql);
          if (/GET_LOCK/i.test(text)) return [[{ got: state.lockGot }]];
          if (/RELEASE_LOCK/i.test(text)) return [[{ released: state.releaseOk }]];
          if (/SHOW COLUMNS/i.test(text)) {
            const col = String(params[0] || '');
            if (col === 'CONTRACT_TYPE') return [state.contractType ? [{ Field: 'CONTRACT_TYPE' }] : []];
            if (col === 'TC_IN_RECAP_JSON') return [state.tcInRecapJson ? [{ Field: 'TC_IN_RECAP_JSON' }] : []];
            return [[]];
          }
          if (/CREATE TABLE IF NOT EXISTS zafira_schema_migrations/i.test(text)) return [{ affectedRows: 0 }];
          if (/FROM zafira_schema_migrations/i.test(text)) {
            return [state.ledgerVersion ? [{ version: state.ledgerVersion }] : []];
          }
          if (/ALTER TABLE/i.test(text)) {
            if (/TC_IN_RECAP_JSON/i.test(text)) state.tcInRecapJson = true;
            if (/CONTRACT_TYPE/i.test(text)) state.contractType = true;
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
        destroy() {
          this.destroyed = true;
          state.destroyed = true;
        },
      };
      sessions.push(conn);
      return conn;
    },
    async query(sql, params) {
      const conn = await this.getConnection();
      try {
        return await conn.query(sql, params);
      } finally {
        conn.release();
      }
    },
    sessions,
    state,
  };
  return pool;
}

describe('tcContractTypeMigration', () => {
  it('probe never marks migration ready from column existence alone', async () => {
    resetTcContractTypeMigrationStateForTests('pending');
    const pool = makeFakePool({ contractType: true, tcInRecapJson: true, ledgerVersion: 0 });
    assert.equal(await probeTcContractTypeColumn(pool), true);
    assert.equal(getTcContractTypeMigrationState(), 'pending');
    assert.equal(await verifyTcContractTypeMigrationApplied(pool), false);
  });

  it('runs GET_LOCK / work / RELEASE_LOCK on one dedicated connection and adds JSON dep', async () => {
    resetTcContractTypeMigrationStateForTests('pending');
    const pool = makeFakePool({ contractType: false, tcInRecapJson: false, ledgerVersion: 0 });
    const result = await runTcContractTypeMigration(pool);
    assert.equal(result.ok, true);
    assert.equal(getTcContractTypeMigrationState(), 'ready');
    assert.equal(pool.sessions.length, 1);
    assert.equal(pool.sessions[0].released, true);
    assert.equal(pool.state.tcInRecapJson, true);
    assert.equal(pool.state.contractType, true);
  });

  it('destroys the connection when RELEASE_LOCK fails', async () => {
    resetTcContractTypeMigrationStateForTests('pending');
    const pool = makeFakePool({
      contractType: true,
      tcInRecapJson: true,
      ledgerVersion: 1,
      releaseOk: 0,
    });
    const result = await runTcContractTypeMigration(pool);
    assert.equal(result.ok, true);
    assert.equal(pool.state.destroyed, true);
    assert.equal(pool.sessions[0].destroyed, true);
  });

  it('requireTcContractTypeSchema refuses without running DDL from writes', async () => {
    resetTcContractTypeMigrationStateForTests('pending');
    const pool = makeFakePool({ contractType: false, tcInRecapJson: false, ledgerVersion: 0 });
    await assert.rejects(
      () => requireTcContractTypeSchema(pool),
      (err) => err.status === 503,
    );
    assert.equal(getTcContractTypeMigrationState(), 'pending');
    assert.equal(pool.state.contractType, false);
  });

  it('marks ready when ledger + both columns already verified', async () => {
    resetTcContractTypeMigrationStateForTests('pending');
    const pool = makeFakePool({ contractType: true, tcInRecapJson: true, ledgerVersion: 1 });
    assert.equal(await requireTcContractTypeSchema(pool), true);
    assert.equal(getTcContractTypeMigrationState(), 'ready');
  });
});

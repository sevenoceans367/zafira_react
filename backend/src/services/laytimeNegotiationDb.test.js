import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertLaytimeSaveVersion, laytimeSaveVersion, loadLaytimeNegotiations, prepareLaytimeNegotiations, saveLaytimeNegotiations } from './laytimeNegotiationDb.js';

const dialogue = { entity: 'OWNER', date: '29-02-2028 13:45', reason: 'Berth wait', agreedDemm: '', status: 'ON_HOLD', notes: '' };

test('rejects stale port saves after master, SOF or child changes', async () => {
  const record = { LAYTIME_ID: '8', TTL_DEMURRAGE: '10.00' };
  const rows = new Map([
    ['laytime_slave', [{ NOTES: 'Original activity' }]],
    ['laytime_slave1', [{ NOTES: 'Original deduction' }]],
    ['laytime_slave2', [{ ENTITY_NAME: 'All Clear', ENTITY_VALUE: null }]],
  ]);
  const db = { async query(sql, params) {
    assert.deepEqual(params, ['8']);
    return [rows.get(sql.split(' ')[3])];
  } };
  const inputs = { sofId: 1, carry: {} };
  const version = await laytimeSaveVersion(db, record, inputs);
  await assertLaytimeSaveVersion(db, version, record, inputs);
  await assert.rejects(assertLaytimeSaveVersion(db, version, { ...record, TTL_DEMURRAGE: '20.00' }, inputs), { status: 409 });
  await assert.rejects(assertLaytimeSaveVersion(db, version, record, { ...inputs, sofId: 2 }), { status: 409 });
  for (const [table, original] of rows) {
    rows.set(table, []);
    await assert.rejects(assertLaytimeSaveVersion(db, version, record, inputs), { status: 409 });
    rows.set(table, original);
  }
});
const saved = (id, sortOrder = 0) => ({ id, sortOrder, ...dialogue, date: dialogue.date,
  sqlDate: '2028-02-29 13:45:00', agreedDemm: null, currencyCode: 'USD', notes: null });

function fakeDb(rows = []) {
  const writes = [];
  return { writes, async query(sql, params) {
    if (sql.startsWith('SELECT')) return [rows];
    writes.push({ op: sql.split(' ')[0], params });
    return [{ affectedRows: 1 }];
  } };
}

test('prepares exact amounts, a blank pending amount, zero completion and skips a blank placeholder', async () => {
  const { version } = await loadLaytimeNegotiations(fakeDb(), null);
  const draft = prepareLaytimeNegotiations({ version, deletedIds: [], rows: [
    dialogue, { ...dialogue, agreedDemm: '0', status: 'COMPLETED' },
    { ...dialogue, agreedDemm: '9,999,999,999,999,999.99' },
    { ...dialogue, date: '', reason: '' },
  ] });
  assert.deepEqual(draft.rows.map((r) => r.agreedDemm), [null, '0.00', '9999999999999999.99']);
  assert.equal(draft.rows[0].sqlDate, '2028-02-29 13:45:00');
});

test('rejects invalid values, duplicate IDs and invalid BIGINT identities', async () => {
  const { version } = await loadLaytimeNegotiations(fakeDb(), null);
  for (const row of [
    { date: '29-02-2026 01:00' }, { date: '29-02-2028 24:00' }, { date: '29-02-2028 junk' },
    { reason: ' ' }, { agreedDemm: '12,34' }, { agreedDemm: '1.001' },
    { agreedDemm: '10000000000000000' }, { status: 'COMPLETED' },
    { status: 'OPEN' }, { entity: 'AGENT' }, { currencyCode: 'EUR' }, { id: '9223372036854775808' },
  ]) {
    assert.throws(() => prepareLaytimeNegotiations({ version, rows: [{ ...dialogue, ...row }], deletedIds: [] }),
      { status: 400 }, JSON.stringify(row));
  }
  assert.throws(() => prepareLaytimeNegotiations({ version, rows: [{ ...dialogue, id: '5' }], deletedIds: ['5'] }), { status: 400 });
});

test('writes only changes, enforcing ownership, explicitly deleted IDs and stable row order', async () => {
  const db = fakeDb([saved('1'), saved('2', 1), saved('3', 2)]);
  const { version, rows } = await loadLaytimeNegotiations(db, '8');
  const prepare = (rows, deletedIds = []) => prepareLaytimeNegotiations({ version, rows, deletedIds });
  await saveLaytimeNegotiations(db, '8', 7, prepare(rows));
  assert.deepEqual(db.writes, []);
  await assert.rejects(saveLaytimeNegotiations(db, '8', 7, prepare(rows.slice(1))), { status: 400 });
  await assert.rejects(saveLaytimeNegotiations(db, '8', 7, prepare(rows.slice(1), ['99'])), { status: 400 });
  assert.deepEqual(db.writes, []);
  await saveLaytimeNegotiations(db, '8', 7, prepare([rows[0], { ...rows[2], notes: 'Updated' }, dialogue], ['2']));
  assert.deepEqual(db.writes.map((w) => w.op), ['DELETE', 'UPDATE', 'INSERT']);
  assert.deepEqual(db.writes[0].params, ['8', '2']);
  assert.deepEqual(db.writes[1].params.slice(-4), [1, 7, '8', '3']);
  assert.deepEqual(db.writes[2].params.slice(-2), [2, 7]);
});

test('rejects a stale snapshot even when the stored update has the same timestamp', async () => {
  const original = fakeDb([saved('1')]);
  const { version, rows } = await loadLaytimeNegotiations(original, '8');
  const changed = fakeDb([{ ...saved('1'), reason: 'Edited elsewhere' }]);
  await assert.rejects(saveLaytimeNegotiations(changed, '8', 7,
    prepareLaytimeNegotiations({ version, rows, deletedIds: [] })), { status: 409 });
  assert.deepEqual(changed.writes, []);
});

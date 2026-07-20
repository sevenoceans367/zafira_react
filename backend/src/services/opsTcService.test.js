import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetOpsTcMockForTests,
  createOpsTcCostSheet,
  deactivateOpsTcEntry,
  finaliseVoyageFixturesTc,
  listFinalisedVoyageFixturesTc,
  listHistoryAtGlanceTc,
  listInOpsAtGlanceTc,
  listPostOpsAtGlanceTc,
  listYearUpdationTc,
  moveOpsTcToHistory,
  moveOpsTcToPostOps,
  updateOpsTcOperator,
  updateTcUpdateOnDate,
} from './opsTcService.js';

describe('opsTcService finalised fixtures', () => {
  beforeEach(() => {
    __resetOpsTcMockForTests();
  });

  it('lists finalised voyage fixtures TC rows', async () => {
    const data = await listFinalisedVoyageFixturesTc({});
    assert.equal(data.recordsTotal, 2);
    assert.equal(data.records[0].tcNo, 'TC-2401');
    assert.equal(data.records[0].canFinalise, true);
    assert.equal(data.records[1].statusLabel, 'Finalised');
  });

  it('finalises selected fixtures with operators', async () => {
    const result = await finaliseVoyageFixturesTc([
      { tcOutId: 501, comId: 9001, operatorId: '2' },
    ]);
    assert.equal(result.msg, 1);
    const after = await listFinalisedVoyageFixturesTc({});
    const row = after.records.find((item) => item.tcOutId === 501);
    assert.equal(row.fixed, true);
    assert.equal(row.statusLabel, 'Finalised');
    assert.equal(row.canFinalise, false);
    assert.equal(row.operatorId, '2');
  });

  it('rejects finalise without selection', async () => {
    await assert.rejects(
      () => finaliseVoyageFixturesTc([]),
      /at least one Fixture/i,
    );
  });

  it('rejects finalise without operator', async () => {
    await assert.rejects(
      () => finaliseVoyageFixturesTc([{ tcOutId: 501, comId: 9001, operatorId: '' }]),
      /Operator/i,
    );
  });
});

describe('opsTcService in ops glance', () => {
  beforeEach(() => {
    __resetOpsTcMockForTests();
  });

  it('lists in-ops TC rows', async () => {
    const data = await listInOpsAtGlanceTc({ selBType: '3', selYear: '2026' });
    assert.equal(data.recordsTotal, 1);
    assert.equal(data.records[0].tcNo, 'TC-2601');
    assert.equal(data.records[0].canMoveToPostOps, true);
  });

  it('updates operator and moves to post ops', async () => {
    await updateOpsTcOperator(9101, '2');
    const moved = await moveOpsTcToPostOps(9101);
    assert.equal(moved.msg, 6);
    const after = await listInOpsAtGlanceTc({});
    assert.equal(after.recordsTotal, 0);
  });

  it('deactivates an in-ops entry', async () => {
    const result = await deactivateOpsTcEntry(9101);
    assert.equal(result.msg, 3);
    const after = await listInOpsAtGlanceTc({});
    assert.equal(after.recordsTotal, 0);
  });

  it('creates a TC cost sheet name', async () => {
    const result = await createOpsTcCostSheet(9101, 'Ops Sheet 1');
    assert.equal(result.msg, 4);
    const data = await listInOpsAtGlanceTc({});
    assert.ok(data.records[0].costSheets.some((sheet) => sheet.name === 'Ops Sheet 1'));
  });

  it('lists post-ops TC rows', async () => {
    const data = await listPostOpsAtGlanceTc({ selBType: '3', selYear: '2026' });
    assert.equal(data.recordsTotal, 1);
    assert.equal(data.records[0].canMoveToHistory, true);
  });

  it('moves post-ops entry to history', async () => {
    await moveOpsTcToPostOps(9101);
    const moved = await moveOpsTcToHistory(9101);
    assert.equal(moved.msg, 3);
    const postOps = await listPostOpsAtGlanceTc({});
    assert.equal(postOps.recordsTotal, 1);
    const history = await listHistoryAtGlanceTc({});
    assert.equal(history.recordsTotal, 2);
  });

  it('lists year updation rows and updates year', async () => {
    const data = await listYearUpdationTc({});
    assert.equal(data.recordsTotal, 1);
    const result = await updateTcUpdateOnDate(9401, '01-06-2026');
    assert.equal(result.updateYear, '01-06-2026');
  });
});

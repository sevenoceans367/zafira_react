import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetOpsVcMockForTests,
  createOpsVcCostSheet,
  deactivateOpsVcEntry,
  listHistoryAtGlance,
  listInOpsAtGlance,
  listPostOpsAtGlance,
  listVoyageReports,
  listYearUpdation,
  moveOpsVcToHistory,
  moveOpsVcToPostOps,
  updateOpsVcOperator,
  updateYearAddOnDate,
  updateOpsVcCostSheetLayout,
} from './opsVcService.js';

describe('opsVcService mock lifecycle', () => {
  beforeEach(() => {
    __resetOpsVcMockForTests();
  });

  it('lists in-ops glance rows for the selected year', async () => {
    const data = await listInOpsAtGlance({ selBType: '3', selYear: '2026' });
    assert.equal(data.recordsTotal, 1);
    assert.equal(data.records[0].voyageNo, 'V-2401');
  });

  it('lists post-ops glance rows for the selected year', async () => {
    const data = await listPostOpsAtGlance({ selBType: '3', selYear: '2026' });
    assert.equal(data.recordsTotal, 1);
    assert.equal(data.records[0].voyageNo, 'V-2402');
    assert.equal(data.records[0].canMoveToHistory, true);
  });

  it('lists history rows without year filter', async () => {
    const data = await listHistoryAtGlance({ selBType: '3' });
    assert.equal(data.recordsTotal, 1);
    assert.equal(data.records[0].voyageNo, 'V-2310');
    assert.equal(data.records[0].statusLabel, 'History');
  });

  it('lists and updates year updation rows', async () => {
    const data = await listYearUpdation({});
    assert.equal(data.recordsTotal, 2);
    const updated = await updateYearAddOnDate(1001, '01-03-2026');
    assert.equal(updated.msg, 0);
    assert.equal(updated.addOnDate, '01-03-2026');
    const after = await listYearUpdation({});
    assert.equal(after.records.find((row) => row.comId === 1001).addOnDate, '01-03-2026');
  });

  it('updates operator and moves voyage to post ops', async () => {
    await updateOpsVcOperator(1001, '2');
    const moved = await moveOpsVcToPostOps(1001);
    assert.equal(moved.msg, 6);
    const inOps = await listInOpsAtGlance({ selYear: '2026' });
    assert.equal(inOps.recordsTotal, 0);
    const postOps = await listPostOpsAtGlance({ selYear: '2026' });
    assert.equal(postOps.recordsTotal, 2);
  });

  it('moves post-ops voyage to history', async () => {
    const moved = await moveOpsVcToHistory(1002);
    assert.equal(moved.msg, 3);
    const postOps = await listPostOpsAtGlance({ selYear: '2026' });
    assert.equal(postOps.recordsTotal, 0);
    const history = await listHistoryAtGlance({ selBType: '3' });
    assert.equal(history.recordsTotal, 2);
  });

  it('deactivates a voyage entry', async () => {
    const result = await deactivateOpsVcEntry(1001);
    assert.equal(result.msg, 6);
    const data = await listInOpsAtGlance({ selYear: '2026' });
    assert.equal(data.recordsTotal, 0);
    const history = await listHistoryAtGlance({ selBType: '3' });
    assert.equal(history.recordsTotal, 2);
  });

  it('lists voyage reports for a vessel IMO', async () => {
    const data = await listVoyageReports({ vesselImoNo: '9123456', comId: 1001 });
    assert.equal(data.recordsTotal, 1);
    assert.equal(data.records[0].reportTitle, 'Noon Report');
    assert.equal(data.vesselImoNo, '9123456');
  });

  it('pins a worksheet and keeps it first after reorder', async () => {
    await createOpsVcCostSheet(1001, 'Rev 2');
    await updateOpsVcCostSheetLayout(1001, [
      { id: 12, pinned: false, sortOrder: 0 },
      { id: 11, pinned: true, sortOrder: 1 },
    ]);
    const data = await listInOpsAtGlance({ selYear: '2026' });
    assert.equal(data.records[0].costSheets[0].id, 11);
    assert.equal(data.records[0].costSheets[0].pinned, true);
    assert.equal(data.records[0].costSheets[1].id, 12);
    assert.equal(data.records[0].costSheets[1].pinned, false);
  });
});

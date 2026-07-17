import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelCoa,
  createCargoRelet,
  createCoa,
  getCoaLookups,
  getCoaNominations,
  listCargoRelets,
  listCoaOpsVoyages,
  listRunningCoas,
  moveVoyageToPostOps,
} from './coaService.js';

describe('coaService mock lifecycle', () => {
  it('returns COA lookups in mock mode', async () => {
    const lookups = await getCoaLookups();
    assert.ok(lookups.nextCoaId);
    assert.ok(Array.isArray(lookups.routes));
    assert.ok(Array.isArray(lookups.vesselTypes));
  });

  it('lists running COAs with pagination metadata', async () => {
    const data = await listRunningCoas({ selBType: '3', page: 1, pageSize: 10, status: '1' });
    assert.equal(data.page, 1);
    assert.ok(data.recordsTotal >= 1);
    assert.equal(data.records[0].status, 'Active');
    assert.ok(data.records[0].coaId);
  });

  it('creates and cancels a COA in mock mode', async () => {
    const created = await createCoa({
      coaIdentity: 'COA-TEST',
      coaNo: '2026/99',
      businessTypeId: '3',
    });
    assert.equal(created.msg, 0);
    assert.ok(created.coaId);

    const cancelled = await cancelCoa(created.coaId, 'test cancel');
    assert.equal(cancelled.msg, 0);
  });

  it('returns nominations for voyages and relets', async () => {
    const data = await getCoaNominations(1);
    assert.ok(data.coaLabel);
    assert.ok(Array.isArray(data.voyages));
    assert.ok(Array.isArray(data.relets));
  });

  it('lists cargo relets and supports create', async () => {
    const list = await listCargoRelets({ selBType: '3', page: 1, pageSize: 10 });
    assert.ok(list.records.length >= 1);
    const created = await createCargoRelet({ coaId: '1', reletNo: 'CR-TEST', updateStatus: '1' });
    assert.equal(created.msg, 0);
    assert.ok(created.fcaId);
  });

  it('filters ops voyages by In Ops vs Post Ops status', async () => {
    const inOps = await listCoaOpsVoyages({ status: '1', page: 1 });
    assert.equal(inOps.records[0].statusCode, 1);
    assert.equal(inOps.records[0].canMoveToPostOps, true);
    assert.equal(inOps.records[0].status, 'In Ops');

    const postOps = await listCoaOpsVoyages({ status: '2', page: 1 });
    assert.equal(postOps.records[0].statusCode, 2);
    assert.equal(postOps.records[0].canMoveToPostOps, false);
    assert.equal(postOps.records[0].status, 'Post Ops');
  });

  it('moves voyage to post ops in mock mode', async () => {
    const result = await moveVoyageToPostOps(501);
    assert.equal(result.msg, 0);
  });
});

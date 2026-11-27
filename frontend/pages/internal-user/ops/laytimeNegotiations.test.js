import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatNegotiationTotal, negotiationSaveFields, readNegotiationCents } from './laytimeNegotiations.js';
import { filterRowsByQuery } from './laytimeTankerHelpers.js';
import { paginateRows } from './sofTankerHelpers.js';

test('keeps decimal totals exact and declines mixed currencies', () => {
  const rows = [
    { agreedDemm: '9,999,999,999,999,999.99', status: 'UNDER_NEGO' },
    { agreedDemm: '0.02', status: 'COMPLETED' },
    { agreedDemm: '0' }, { agreedDemm: '' },
  ];
  assert.equal(formatNegotiationTotal(rows), '10,000,000,000,000,000.01');
  assert.equal(formatNegotiationTotal([...rows, { agreedDemm: '1', currencyCode: 'EUR' }]), '—');
  assert.equal(formatNegotiationTotal([...rows, { agreedDemm: '10.001' }]), '—');
  assert.equal(readNegotiationCents('10.001'), null);
  assert.equal(readNegotiationCents('10000000000000000'), null);
  assert.equal(readNegotiationCents('0'), 0n);
});

test('a filtered page does not narrow the total or save payload', () => {
  const rows = [
    { id: '10', reason: 'Visible', agreedDemm: '1.01' },
    { id: '11', reason: 'Hidden', agreedDemm: '2.01' },
    { draftKey: 'new-1', reason: 'Visible', agreedDemm: '3.01' },
  ];
  const page = paginateRows(filterRowsByQuery(rows, 'Visible', ['reason']), 1, 1);
  assert.equal(page.items.length, 1);
  const draft = { version: 'snapshot', rows, deletedIds: ['12'], dirty: true };
  assert.equal(formatNegotiationTotal(rows), '6.03');
  const { negotiations } = negotiationSaveFields(draft);
  assert.equal(negotiations.rows.length, 3);
  assert.equal(negotiations.rows[1].id, '11');
  assert.equal('draftKey' in negotiations.rows[2], false);
  assert.deepEqual(negotiations.deletedIds, ['12']);
  assert.deepEqual(negotiationSaveFields({ ...draft, dirty: false }), {});
  assert.deepEqual(negotiationSaveFields(undefined), {});
});

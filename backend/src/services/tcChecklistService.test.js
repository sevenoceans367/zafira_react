import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetTcChecklistMockForTests,
  getTcChecklist,
  saveTcChecklist,
} from './tcChecklistService.js';

describe('tcChecklistService', () => {
  beforeEach(() => {
    __resetTcChecklistMockForTests();
  });

  it('loads checklist fixture and form', async () => {
    const data = await getTcChecklist(9101);
    assert.equal(data.fixture.tcNo, 'TC-2601');
    assert.equal(data.form.delivery.placePortData, 'Singapore');
    assert.ok(data.pniVendors.length >= 1);
  });

  it('saves checklist details', async () => {
    const result = await saveTcChecklist(9101, {
      checks: { reg: true, class: true },
      chartererPni: 'PNI1',
      lastPortAgent: 'Agent A',
      laycanFrom: '10-01-2026 08:00',
      laycanTo: '20-01-2026 18:00',
      draftResAsPerCp: '12.4',
      loadRateCp: '10000',
      dischargeRateCp: '8000',
      deliveryEtas: [{ text: 'ETA 5 DAYS', date: '10-01-2026 10:00' }],
      redeliveryEtas: [{ text: 'ETA 3 DAYS', date: '25-02-2026 12:00' }],
      delivery: {
        actualArrivalText: 'ACTUAL ARRIVAL',
        actualArrivalDate: '15-01-2026 06:00',
        norTenderedText: 'NOR TENDERED',
        norTenderedDate: '15-01-2026 07:00',
        placePortText: 'DELIVERY PLACE/PORT',
        placePortData: 'Singapore',
        foDoText: 'DELIVERY FO/DO (MT)',
        foDoData: '100/20',
        dateTimeText: 'DELIVERY DATE/TIME',
        dateTimeData: '15-01-2026',
      },
      redelivery: {
        actualArrivalText: 'ACTUAL ARRIVAL',
        actualArrivalDate: '01-03-2026 06:00',
        norTenderedText: 'NOR TENDERED',
        norTenderedDate: '01-03-2026 07:00',
        placePortText: 'RE-DELIVERY PLACE/PORT',
        placePortData: 'Mundra',
        foDoText: 'RE-DELIVERY FO/DO (MT)',
        foDoData: '80/15',
        dateTimeText: 'RE-DELIVERY DATE/TIME',
        dateTimeData: '01-03-2026',
      },
      remarks: 'Checklist complete',
    });
    assert.equal(result.msg, 0);
    const after = await getTcChecklist(9101);
    assert.equal(after.form.checks.reg, true);
    assert.equal(after.form.lastPortAgent, 'Agent A');
    assert.equal(after.form.remarks, 'Checklist complete');
    assert.equal(after.form.deliveryEtas[0].text, 'ETA 5 DAYS');
  });

  it('rejects save without required fields', async () => {
    await assert.rejects(
      () => saveTcChecklist(9101, { remarks: '' }),
      /required/i,
    );
  });
});

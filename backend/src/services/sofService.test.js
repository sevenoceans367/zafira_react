import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { isDbConfigured } from '../config.js';
import {
  DEFAULT_KEY_OPERATIONS,
  numOrNull,
  resolveSofSavePlan,
  validateSofActivityPartialPercentages,
} from './sofDb.js';
import { __resetSofMockForTests, getSofForm, saveSof } from './sofService.js';

describe('sofDb resolveSofSavePlan data-preservation contract', () => {
  it('parses properly grouped cargo figures and rejects malformed comma values', () => {
    assert.equal(numOrNull('50,000'), 50000);
    assert.equal(numOrNull('1,234.5'), 1234.5);
    assert.equal(numOrNull('1,2'), null);
  });

  it('validates SOF Activity LT partial percentages at the service boundary', () => {
    assert.doesNotThrow(() => validateSofActivityPartialPercentages([
      { ltPartial: '' }, { ltPartial: '0' }, { ltPartial: '55' }, { ltPartial: '100' },
    ]));
    for (const ltPartial of ['-1', '101', '25.5', 'invalid']) {
      assert.throws(
        () => validateSofActivityPartialPercentages([{ ltPartial }]),
        { status: 400, message: 'LT (Partial %) must be a whole percentage from 0 to 100.' },
      );
    }
  });

  it('preserves existing master fields and skips child replacements when omitted', () => {
    const existing = {
      TERMINAL: 'Jetty 3',
      VA_1: '25000',
      VAPS_1: '01-03-2026 08:00',
      NT_1: '01-03-2026 09:00',
      PBFB_1: '01-03-2026 10:00',
      LC: '01-03-2026 12:00',
      LC1: '02-03-2026 18:00',
      VS: '03-03-2026 06:00',
      SHIPPER_REMARKS: 'Existing master remarks',
      UPLOAD: '101_sof.pdf',
    };

    const plan = resolveSofSavePlan({
      comId: '8',
      portType: 'LP',
      portId: '10',
      randomId: '101',
      submitId: 1,
    }, existing);

    assert.equal(plan.master.terminal, 'Jetty 3');
    assert.equal(plan.master.stowageQty, '25000');
    assert.equal(plan.master.vesselArrived, '01-03-2026 08:00');
    assert.equal(plan.master.norTendered, '01-03-2026 09:00');
    assert.equal(plan.master.pilotOnBoard, '01-03-2026 10:00');
    assert.equal(plan.master.loadCommenced, '01-03-2026 12:00');
    assert.equal(plan.master.loadCompleted, '02-03-2026 18:00');
    assert.equal(plan.master.vesselSailed, '03-03-2026 06:00');
    assert.equal(plan.master.agentRemarks, 'Existing master remarks');
    assert.equal(plan.master.upload, '101_sof.pdf');

    assert.equal(plan.replaceKeyOperations, false);
    assert.equal(plan.replaceCargoRows, false);
    assert.equal(plan.replaceEntityRows, false);
    assert.equal(plan.replaceBlRows, false);
    assert.equal(plan.replacePortActivities, false);
    assert.equal(plan.upsertPreArrival, false);
    assert.equal(plan.replaceDailyQty, false);
  });

  it('updates explicitly supplied fields and derives master milestones from canonical keyOperations', () => {
    const existing = {
      TERMINAL: 'Old Berth',
      SHIPPER_REMARKS: 'Old remarks',
      UPLOAD: '101_old.pdf',
    };

    const plan = resolveSofSavePlan({
      terminal: 'Jetty B',
      agentRemarks: 'Updated port remarks',
      keepFiles: ['101_old.pdf', '102_new.pdf'],
      keyOperations: [
        { activity: 'EOSP', activityDateTime: '10-04-2026 07:30', tDefault: 1 },
        { activity: 'NOR tendered', activityDateTime: '10-04-2026 08:00', tDefault: 1 },
        { activity: 'Full away on passage', activityDateTime: '12-04-2026 19:00', tDefault: 1 },
      ],
      cargoRows: [
        { activity: 'Cargo Loaded', shipFigure: '31000', blFigure: '30950', tDefault: 1 },
      ],
      portActivities: [
        { activity: 'Loading', from: '10-04-2026 10:00', to: '10-04-2026 14:30', duration: '4.5', notes: 'OK' },
      ],
    }, existing);

    assert.equal(plan.master.terminal, 'Jetty B');
    assert.equal(plan.master.agentRemarks, 'Updated port remarks');
    assert.equal(plan.master.stowageQty, '31000');
    assert.equal(plan.master.vesselArrived, '10-04-2026 07:30');
    assert.equal(plan.master.norTendered, '10-04-2026 08:00');
    assert.equal(plan.master.vesselSailed, '12-04-2026 19:00');
    assert.equal(plan.master.upload, '101_old.pdf,102_new.pdf');

    assert.equal(plan.replaceKeyOperations, true);
    assert.equal(plan.replaceCargoRows, true);
    assert.equal(plan.replacePortActivities, true);
    assert.equal(plan.replaceEntityRows, false);
    assert.equal(plan.replaceBlRows, false);
    assert.equal(plan.upsertPreArrival, false);
    assert.equal(plan.replaceDailyQty, false);
  });

  it('appends multipart files when keepFiles was omitted without dropping existing names', () => {
    const plan = resolveSofSavePlan({
      appendFiles: ['102_new.pdf'],
    }, { UPLOAD: '101_old.pdf' });

    assert.equal(plan.master.upload, '101_old.pdf,102_new.pdf');
  });

  it('preserves canonical Key Operation default names needed by Laytime and Voyage Status', () => {
    for (const required of [
      'EOSP',
      'NOR tendered',
      'Pilot on board',
      'Commenced cargo operations',
      'Completed cargo operations',
      'Full away on passage',
    ]) {
      assert.ok(
        DEFAULT_KEY_OPERATIONS.includes(required),
        `Expected DEFAULT_KEY_OPERATIONS to include "${required}"`,
      );
    }
  });
});

describe('sofService mock persistence preservation', { skip: isDbConfigured() }, () => {
  beforeEach(() => {
    __resetSofMockForTests();
  });

  it('preserves agentRemarks and child collections when partial save omits them', async () => {
    await saveSof({
      comId: '8',
      portType: 'LP',
      portId: '10',
      randomId: '101',
      submitId: 1,
      terminal: 'Jetty 1',
      agentRemarks: 'Keep these remarks',
      entityRows: [{ name: 'Surveyor', value: 'SGS' }],
      blRows: [{ blDate: '02-01-2026', cargo: 'WHEAT', blQty: '12000' }],
      portActivities: [{ activity: 'Loading', from: '01-01-2026 10:00', to: '01-01-2026 12:00', duration: '2.0', notes: 'Clean' }],
    });

    await saveSof({
      comId: '8',
      portType: 'LP',
      portId: '10',
      randomId: '101',
      submitId: 1,
      terminal: 'Jetty 2',
    });

    const form = await getSofForm('8');
    const port = form.ports[0];
    assert.equal(port.terminal, 'Jetty 2');
    assert.equal(port.agentRemarks, 'Keep these remarks');
    assert.deepEqual(port.entityRows, [{ name: 'Surveyor', value: 'SGS' }]);
    assert.deepEqual(port.blRows, [{ blDate: '02-01-2026', cargo: 'WHEAT', blQty: '12000' }]);
    assert.equal(port.portActivities.length, 1);
    assert.equal(port.portActivities[0].activity, 'Loading');
  });

  it('rejects invalid LT partial percentages before mock persistence', async () => {
    await assert.rejects(
      saveSof({
        comId: '8', portType: 'LP', portId: '10', randomId: '101',
        portActivities: [{ activity: 'Loading', ltPartial: '101' }],
      }),
      { status: 400, message: 'LT (Partial %) must be a whole percentage from 0 to 100.' },
    );
  });
});

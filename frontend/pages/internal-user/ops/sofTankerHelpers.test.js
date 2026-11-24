import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recomputePortDraft } from './laytimeCalculations.js';
import {
  DEFAULT_SOF_ROW_SIZE,
  buildSofSavePayload,
  coalesceActivityCumulative,
  computeActivityDurationHours,
  displayActivityCumulative,
  draftFromPort,
  emptyDeductionRow,
  getCargoCardValues,
  insertDeductionRowAfter,
  isValidLtPartialPercent,
  paginateRows,
  patchCargoCardField,
  removeDeductionRowAt,
} from './sofTankerHelpers.js';

describe('sofTankerHelpers', () => {
  it('defaults Key Operations page size to 5', () => {
    assert.equal(DEFAULT_SOF_ROW_SIZE, 5);
  });

  it('computes valid activity duration and leaves reversed or incomplete ranges blank', () => {
    assert.equal(computeActivityDurationHours('10-05-2026 08:00', '10-05-2026 10:30'), '2.5');
    assert.equal(computeActivityDurationHours('10-05-2026 12:00', '10-05-2026 10:00'), '');
    assert.equal(computeActivityDurationHours('10-05-2026 08:00', ''), '');
  });

  it('accepts only whole LT partial percentages from 0 to 100', () => {
    for (const value of ['', '0', '35', '100']) {
      assert.equal(isValidLtPartialPercent(value), true, `Expected ${value} to be valid`);
    }
    for (const value of ['-1', '101', '12.5', 'abc']) {
      assert.equal(isValidLtPartialPercent(value), false, `Expected ${value} to be invalid`);
    }
  });

  it('maps and updates Cargo card fields while preserving all other sof_slave_7 rows', () => {
    const initial = [
      { activity: 'Cargo Loaded', shipFigure: '31000', blFigure: '30900', waterDensity: '', remarks: '', tDefault: 1 },
      { activity: 'Bunkers taken', shipFigure: '450', blFigure: '80', waterDensity: '', remarks: '', tDefault: 1 },
      { activity: 'Arrival draft', shipFigure: '10.5', blFigure: '10.8', waterDensity: '1.025', remarks: '', tDefault: 1 },
      { activity: 'Remarks/delays/interuptions', shipFigure: '', blFigure: '', waterDensity: '', remarks: 'Legacy delay note', tDefault: 1 },
      { activity: 'Lop Issued (Pls specify)', shipFigure: '', blFigure: '', waterDensity: '', remarks: 'Shore delay', tDefault: 1 },
      { activity: 'Lop received (Pls Specify)', shipFigure: '', blFigure: '', waterDensity: '', remarks: 'None', tDefault: 1 },
    ];

    assert.deepEqual(getCargoCardValues(initial), {
      shipFigure: '31000',
      blFigure: '30900',
      lopIssued: 'Shore delay',
      lopReceived: 'None',
    });

    let next = patchCargoCardField(initial, 'shipFigure', '31500');
    next = patchCargoCardField(next, 'blFigure', '31450');
    next = patchCargoCardField(next, 'lopIssued', 'Slow pumping');
    next = patchCargoCardField(next, 'lopReceived', 'Temperature protest');

    assert.equal(next.length, initial.length);
    assert.deepEqual(getCargoCardValues(next), {
      shipFigure: '31500',
      blFigure: '31450',
      lopIssued: 'Slow pumping',
      lopReceived: 'Temperature protest',
    });
    assert.equal(next.find((r) => r.activity === 'Bunkers taken').shipFigure, '450');
    assert.equal(next.find((r) => r.activity === 'Arrival draft').waterDensity, '1.025');
    assert.equal(next.find((r) => r.activity === 'Remarks/delays/interuptions').remarks, 'Legacy delay note');
  });

  it('saves layout-owned values and omits hidden child collections from the payload', () => {
    const port = {
      key: 'LP-10-101',
      portType: 'LP',
      portId: '10',
      randomId: '101',
      terminal: 'Jetty A',
      agentRemarks: 'Terminal restriction noted',
      uploads: ['170000_sof.pdf'],
      keyOperations: [
        { activity: 'EOSP', activityDateTime: '01-05-2026 06:00', activityDateTimeTo: '01-05-2026 06:15', robIfo: '1200.50', robMdo: '120.25', comments: 'Arrived', tDefault: 1 },
      ],
      cargoRows: [
        { activity: 'Cargo Loaded', shipFigure: '30000', blFigure: '29980', waterDensity: '', remarks: '', tDefault: 1 },
        { activity: 'Departure draft', shipFigure: '12.0', blFigure: '12.2', waterDensity: '1.025', remarks: '', tDefault: 1 },
      ],
      portActivities: [
        { activity: 'Hose connection', from: '01-05-2026 08:00', to: '01-05-2026 09:30', duration: '1.5', notes: '2x12"' },
      ],
      entityRows: [{ name: 'Agent', value: 'Seven Seas' }],
      blRows: [{ blDate: '02-05-2026', cargo: 'ULSD', blQty: '29980' }],
      preArrival: { cargoDecl: true, stowPlanQty: '30000' },
      dailyQty: [{ date: '01-05-2026', engagementQty: '30000', loadLast: '15000', ttlLoad: '15000', balance: '15000', etcd: '' }],
    };

    const draft = draftFromPort(port);
    const payload = buildSofSavePayload({
      comId: '42',
      activePort: port,
      draft,
      submitId: 1,
    });

    assert.equal(payload.terminal, 'Jetty A');
    assert.equal(payload.agentRemarks, 'Terminal restriction noted');
    assert.deepEqual(payload.keepFiles, ['170000_sof.pdf']);
    assert.equal(payload.keyOperations[0].robIfo, '1200.50');
    assert.equal(payload.keyOperations[0].robMdo, '120.25');
    assert.equal(payload.keyOperations[0].activityDateTimeTo, '01-05-2026 06:15');
    assert.equal(payload.cargoRows.length, 2);
    assert.equal(Object.hasOwn(payload, 'portActivities'), false);
    assert.equal(Object.hasOwn(payload, 'entityRows'), false);
    assert.equal(Object.hasOwn(payload, 'blRows'), false);
    assert.equal(Object.hasOwn(payload, 'preArrival'), false);
    assert.equal(Object.hasOwn(payload, 'dailyQty'), false);
  });

  it('clamps pagination safely when rows shrink', () => {
    const page = paginateRows([1, 2, 3], 4, 5);
    assert.equal(page.safePage, 1);
    assert.equal(page.totalPages, 1);
    assert.deepEqual(page.items, [1, 2, 3]);
  });

  it('adds a visible row when deductions start empty and removes rows without leaving the table empty', () => {
    const twoRows = insertDeductionRowAfter([], 0);
    assert.equal(twoRows.length, 2);
    assert.deepEqual(twoRows[0], emptyDeductionRow());
    assert.deepEqual(twoRows[1], emptyDeductionRow());

    const oneRow = removeDeductionRowAt(twoRows, 0);
    assert.equal(oneRow.length, 1);
    assert.deepEqual(oneRow[0], emptyDeductionRow());

    const fallbackRow = removeDeductionRowAt(oneRow, 0);
    assert.deepEqual(fallbackRow, []);
  });

  it('round-trips Laytime-linked Activity fields in the SOF draft and save payload', () => {
    const port = {
      key: 'LP-10-101',
      portType: 'LP',
      portId: '10',
      randomId: '101',
      portActivities: [{
        activity: 'Loading', from: '10-04-2026 10:00', to: '10-04-2026 12:00',
        duration: '2.0', layTimeCount: true, portTimeCount: false,
        ltPartial: '75', cumulative: '4.9375', laytimeActivityId: '37', notes: 'First hold',
      }],
    };
    const draft = draftFromPort(port);
    draft.portActivities[0] = { ...draft.portActivities[0], ltPartial: '50' };
    const payload = buildSofSavePayload({ comId: '42', activePort: port, draft, submitId: 1 });
    assert.equal(payload.portActivities[0].ltPartial, '50');
    assert.equal(payload.portActivities[0].laytimeActivityId, '37');
    assert.equal(payload.portActivities[0].cumulative, '4.9375');
    assert.equal(payload.portActivities[0].layTimeCount, true);
    assert.equal(payload.portActivities[0].portTimeCount, false);
  });

  it('uses Laytime remaining-allowance cumulative values for SOF activities in hours', () => {
    // Tanker Legacy Fun158=1|2: divider=1 → remaining hours, not days.
    const result = recomputePortDraft({
      laytimeAllowed: '48',
      activities: [
        { duration: '12', ltCounts: true, ltPartial: '50' },
        { duration: '12', ltCounts: true, ltPartial: '100' },
        { duration: '8', ltCounts: false, ltPartial: '100' },
      ],
      deductions: [],
    }, 'hours');

    // 48 - 6 = 42; 48 - (6+12) = 30; NC → 0.00
    assert.deepEqual(result.activities.map((row) => row.cumulative), ['42.0000', '30.0000', '0.00']);
  });

  it('leaves cumulative blank when Laytime Allowed is unknown; computes hours when known', () => {
    // Blank/null allowance is unknown — do not invent 0 - weighted as a balance.
    const blankAllowed = recomputePortDraft({
      laytimeAllowed: '',
      activities: [{ duration: '246.0', ltCounts: true, ltPartial: '25' }],
      deductions: [],
    }, 'hours');
    assert.equal(blankAllowed.activities[0].cumulative, '');

    const explicitZero = recomputePortDraft({
      laytimeAllowed: '0',
      activities: [{ duration: '246.0', ltCounts: true, ltPartial: '25' }],
      deductions: [],
    }, 'hours');
    assert.equal(explicitZero.activities[0].cumulative, '-61.5000');

    const withAllowance = recomputePortDraft({
      laytimeAllowed: '72',
      activities: [{ duration: '246.0', ltCounts: true, ltPartial: '25' }],
      deductions: [],
    }, 'hours');
    // 72 - 61.5 = 10.5 remaining hours
    assert.equal(withAllowance.activities[0].cumulative, '10.5000');
  });

  it('converts zero-actual despatch money through the hours divider (USD/day)', () => {
    const hourly = recomputePortDraft({
      laytimeAllowed: '108',
      demurrageRate: '0',
      despatchRate: '1000',
      activities: [],
      deductions: [],
    }, 'hours');
    // 108h / 24 * 1000 = 4500 (not 108000)
    assert.equal(hourly.ttlDespatch, '4500.00');

    const daily = recomputePortDraft({
      laytimeAllowed: '2',
      demurrageRate: '0',
      despatchRate: '1000',
      activities: [],
      deductions: [],
    }, 'days');
    assert.equal(daily.ttlDespatch, '2000.00');
  });

  it('maps Tanker hours acceptance table for LP-Balongan 108h / 24h Activity', () => {
    // Same shape sofDb returns for estimateType=2 (rateUnit hours, allowed 108).
    const cases = [
      [{ duration: '24.0', ltCounts: true, ltPartial: '100' }, '84.0000'],
      [{ duration: '24.0', ltCounts: true, ltPartial: '50' }, '96.0000'],
      [{ duration: '24.0', ltCounts: true, ltPartial: '25' }, '102.0000'],
      [{ duration: '24.0', ltCounts: true, ltPartial: '0' }, '108.0000'],
      [{ duration: '24.0', ltCounts: false, ltPartial: '0' }, '0.00'],
    ];
    for (const [activity, want] of cases) {
      const result = recomputePortDraft({
        laytimeAllowed: '108',
        activities: [activity],
        deductions: [],
      }, 'hours');
      assert.equal(result.activities[0].cumulative, want);
    }
    // Stale day-mode divider reproduces the 107.7500 screenshot (vite→Desktop :3000).
    const stale = recomputePortDraft({
      laytimeAllowed: '108',
      activities: [{ duration: '24.0', ltCounts: true, ltPartial: '25' }],
      deductions: [],
    }, 'days');
    assert.equal(stale.activities[0].cumulative, '107.7500');
  });

  it('preserves blank cumulative through display/coalesce (no fictitious zero)', () => {
    const timedUnknown = recomputePortDraft({
      laytimeAllowed: '',
      activities: [{ duration: '24', ltCounts: true, ltPartial: '100' }],
      deductions: [],
    }, 'hours');
    assert.equal(timedUnknown.activities[0].cumulative, '');
    assert.equal(coalesceActivityCumulative(timedUnknown.activities[0].cumulative), '');
    assert.equal(displayActivityCumulative(timedUnknown.activities[0].cumulative), '—');

    const explicitZeroAllowed = recomputePortDraft({
      laytimeAllowed: '0',
      activities: [{ duration: '24', ltCounts: true, ltPartial: '100' }],
      deductions: [],
    }, 'hours');
    assert.equal(explicitZeroAllowed.activities[0].cumulative, '-24.0000');
    assert.equal(coalesceActivityCumulative(explicitZeroAllowed.activities[0].cumulative), '-24.0000');

    const nc = recomputePortDraft({
      laytimeAllowed: '48',
      activities: [{ duration: '24', ltCounts: false, ltPartial: '100' }],
      deductions: [],
    }, 'hours');
    assert.equal(nc.activities[0].cumulative, '0.00');
    assert.equal(displayActivityCumulative(nc.activities[0].cumulative), '0.00');

    // Missing computed value still defaults; intentional blank does not.
    assert.equal(coalesceActivityCumulative(undefined), '0.0000');
    assert.equal(coalesceActivityCumulative(''), '');
  });

});

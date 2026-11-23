import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SOF_ROW_SIZE,
  buildSofSavePayload,
  computeActivityDurationHours,
  draftFromPort,
  getCargoCardValues,
  paginateRows,
  patchCargoCardField,
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
        { activity: 'EOSP', activityDateTime: '01-05-2026 06:00', activityDateTimeTo: '', robIfo: '1200.50', robMdo: '120.25', comments: 'Arrived', tDefault: 1 },
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
    assert.equal(payload.cargoRows.length, 2);
    assert.equal(payload.portActivities[0].activity, 'Hose connection');
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

});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recomputeSofActivityRows } from './sofTankerHelpers.js';

describe('Scenario B — multi-row Activity with estimate-seeded 108h', () => {
  const port = { laytimeAllowed: '108', rateUnit: 'hours' };

  function row({ activity, from, to, duration, counting, partial }) {
    return {
      activity,
      from,
      to,
      duration,
      layTimeCount: counting,
      portTimeCount: !counting,
      ltPartial: String(partial),
      cumulative: '',
      notes: '',
    };
  }

  it('recalculates downstream when middle row toggles C/100 → C/50 → NC and after delete', () => {
    let rows = [
      row({
        activity: 'R1', from: '01-01-2024 00:00', to: '02-01-2024 00:00',
        duration: '24.0000', counting: true, partial: 100,
      }),
      row({
        activity: 'R2', from: '02-01-2024 00:00', to: '02-01-2024 12:00',
        duration: '12.0000', counting: false, partial: 0,
      }),
      row({
        activity: 'R3', from: '03-01-2024 00:00', to: '04-01-2024 00:00',
        duration: '24.0000', counting: true, partial: 50,
      }),
    ];

    let out = recomputeSofActivityRows(port, rows);
    assert.deepEqual(out.map((r) => r.cumulative), ['84.0000', '0.00', '72.0000']);

    rows[1] = { ...rows[1], layTimeCount: true, portTimeCount: false, ltPartial: '100' };
    out = recomputeSofActivityRows(port, rows);
    assert.deepEqual(out.map((r) => r.cumulative), ['84.0000', '72.0000', '60.0000']);

    rows[1] = { ...rows[1], ltPartial: '50' };
    out = recomputeSofActivityRows(port, rows);
    assert.deepEqual(out.map((r) => r.cumulative), ['84.0000', '78.0000', '66.0000']);

    rows[1] = { ...rows[1], layTimeCount: false, portTimeCount: true, ltPartial: '0' };
    out = recomputeSofActivityRows(port, rows);
    assert.deepEqual(out.map((r) => r.cumulative), ['84.0000', '0.00', '72.0000']);

    out = recomputeSofActivityRows(port, [rows[1], rows[2]]);
    assert.deepEqual(out.map((r) => r.cumulative), ['0.00', '96.0000']);
  });
});

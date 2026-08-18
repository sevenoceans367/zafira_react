import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveTcChecklist, deriveVcChecklist } from './opsChecklist.js';

describe('opsChecklist derive', () => {
  it('returns — when only fixture/laycan exist', () => {
    const result = deriveVcChecklist({
      fixture: { at: '11-02-2026', done: true },
      laycan: { at: '01-03-2026 – 05-03-2026', done: true },
    });
    assert.equal(result.statusLabel, '—');
    assert.equal(result.status, '');
    assert.equal(result.wipId, 'arrivalLoad');
  });

  it('uses Loading while cargo ops have started and not finished', () => {
    const result = deriveVcChecklist({
      fixture: { at: '11-02-2026', done: true },
      arrivalLoad: { at: '01-03-2026 06:00', done: true },
      norLoad: { at: '01-03-2026 07:00', done: true },
      loading: { at: '01-03-2026 08:00', started: true, done: false },
    });
    assert.equal(result.status, 'loading');
    assert.equal(result.statusLabel, 'Loading');
    assert.equal(result.wipId, 'loading');
  });

  it('keeps At Sea after sailed load until discharge arrival', () => {
    const result = deriveVcChecklist({
      fixture: { at: '11-02-2026', done: true },
      arrivalLoad: { at: '01-03-2026', done: true },
      norLoad: { at: '01-03-2026', done: true },
      loading: { at: '02-03-2026', started: true, done: true },
      sailedLoad: { at: '03-03-2026', done: true },
    });
    assert.equal(result.status, 'sea');
    assert.equal(result.statusLabel, 'At Sea');
    assert.equal(result.wipId, 'arrivalDisch');
  });

  it('skips optional bunkering when it has no data', () => {
    const result = deriveVcChecklist({
      fixture: { at: '11-02-2026', done: true },
      sailedLoad: { at: '03-03-2026', done: true },
    });
    assert.equal(result.steps.find((step) => step.id === 'bunkering').optional, true);
    assert.equal(result.statusLabel, 'At Sea');
  });

  it('uses On Hire for TC after delivery and before redelivery', () => {
    const result = deriveTcChecklist({
      fixture: { at: '06-01-2026', done: true },
      arrivalDel: { at: '10-01-2026', done: true },
      norDel: { at: '10-01-2026', done: true },
      delivery: { at: '10-01-2026', done: true },
      performing: { at: '10-01-2026', started: true, done: true },
    });
    assert.equal(result.status, 'sea');
    assert.equal(result.statusLabel, 'On Hire');
    assert.equal(result.wipId, 'arrivalRedel');
  });
});

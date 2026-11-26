import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blankDateTime } from './laytimeDb.js';

describe('laytimeDb blankDateTime', () => {
  it('preserves DMY date and time strings before native date parsing', () => {
    assert.equal(blankDateTime('04-06-2026 08:00'), '04-06-2026 08:00');
    assert.equal(blankDateTime('10-04-2026 07:30'), '10-04-2026 07:30');
    assert.equal(blankDateTime('4-6-2026 8:05'), '04-06-2026 08:05');
  });
});

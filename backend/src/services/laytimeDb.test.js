import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blankDateTime, normalizeKeepAttachments } from './laytimeDb.js';

describe('laytimeDb blankDateTime', () => {
  it('preserves DMY date and time strings before native date parsing', () => {
    assert.equal(blankDateTime('04-06-2026 08:00'), '04-06-2026 08:00');
    assert.equal(blankDateTime('10-04-2026 07:30'), '10-04-2026 07:30');
    assert.equal(blankDateTime('4-6-2026 8:05'), '04-06-2026 08:05');
  });
});

describe('laytimeDb normalizeKeepAttachments', () => {
  it('unwraps filenames and names from strings and objects', () => {
    assert.deepEqual(normalizeKeepAttachments([{ file: '101_a.pdf', name: 'A.pdf' }, '102_b.pdf']), {
      files: ['101_a.pdf', '102_b.pdf'], names: ['A.pdf', '102_b.pdf'],
    });
  });
});

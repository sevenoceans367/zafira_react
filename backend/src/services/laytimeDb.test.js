import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blankDateTime, normalizeKeepAttachments, resolvePortSofId, resolvePortRandomId, loadActivities, loadEntityRows, upsertLaytimeMaster } from './laytimeDb.js';

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

describe('laytimeDb SOF links and strict-mode SQL', () => {
  it('prefers the port-matched SOF and rejects zero as a link', () => {
    assert.equal(resolvePortSofId({ SOF_LOADPORTID: 11 }, { SOFID: 22 }), 22);
    assert.equal(resolvePortSofId({ SOF_LOADPORTID: 11 }, null), 11);
    assert.equal(resolvePortSofId({ SOF_LOADPORTID: '0' }, null), null);
  });
  it('uses sof_slave rows when no Laytime master exists', async () => {
    const pool = { async query(sql) {
      if (sql.includes('FROM sof_slave ')) return [[{ ACTIVITYID: 'Loading cargo', START_DATETIME: new Date(2026, 3, 10, 8), FINISH_DATETIME: new Date(2026, 3, 10, 14), DURATION: '6', LAY_TIME_COUNT: 1, PORT_TIME_COUNT: 0 }]];
      return [[]];
    } };
    const rows = await loadActivities(pool, null, 55);
    assert.equal(rows[0].activity, 'Loading cargo');
    assert.equal(rows[0].sofLoadPortId, '55');
  });
  it('does not compare DATETIME columns directly to strings', async () => {
    const queries = [];
    await loadEntityRows({ async query(sql) { queries.push(sql); return [[]]; } }, null, 55);
    const q = queries.find((sql) => sql.includes('sof_slave_6'));
    assert.ok(q);
    assert.doesNotMatch(q, /ACTIVITYDATETIMETO\s*=\s*''/i);
    assert.doesNotMatch(q, /ACTIVITYDATETIME\s*!=\s*'0000-00-00/i);
  });
});

describe('port RANDOMID normalization', () => {
  it('preserves zero and falls back only for null or blank values', () => {
    assert.equal(resolvePortRandomId(0, 10), '0');
    assert.equal(resolvePortRandomId('0', 10), '0');
    assert.equal(resolvePortRandomId(null, 10), '10');
    assert.equal(resolvePortRandomId(' ', 10), '10');
  });
});

describe('upsertLaytimeMaster schema fallback', () => {
  it('rethrows data errors instead of retrying a reduced insert/update', async () => {
    let calls = 0;
    const error = Object.assign(new Error('invalid value'), { code: 'ER_BAD_NULL_ERROR' });
    const connection = { async query() { calls += 1; throw error; } };
    await assert.rejects(upsertLaytimeMaster(connection, {
      existing: { LAYTIME_ID: 1 }, comId: 1, portType: 'LP', portId: 2, randomId: 0, submitId: 0, sofId: null,
      fields: {}, attachments: '', attachmentNames: '',
    }), { code: 'ER_BAD_NULL_ERROR' });
    assert.equal(calls, 1);
  });
});

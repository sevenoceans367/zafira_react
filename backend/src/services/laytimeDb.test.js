import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blankDateTime, normalizeKeepAttachments, resolvePortSofId, resolvePortRandomId, loadActivities, loadEntityRows, loadPortTabs as loadLaytimePortTabs, upsertLaytimeMaster } from './laytimeDb.js';
import { loadPortTabs as loadSofPortTabs } from './sofDb.js';

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

describe('SOF port tab rules', () => {
  it('includes independent non-TBN ports across passage types and uses FROM_PORT for TP', async () => {
    const ports = { 1: 'TBN', 10: 'ROTTERDAM', 20: 'SINGAPORE', 30: 'SUEZ' };
    const legs = [
      { FROM_PORT: 10, TO_PORT: 20, RANDOMID: 0, PASSAGE_TYPE: 1, LOAD_PORT_QTY: 50000, DISC_PORT_QTY: 50000, LOAD_PORT_COST: 0, DISC_PORT_COST: 0, TRANSIT_PORT_COST: 0 },
      { FROM_PORT: 1, TO_PORT: 20, RANDOMID: null, PASSAGE_TYPE: 2, LOAD_PORT_QTY: 0, DISC_PORT_QTY: 20000, PORT_COSTDP_VENDOR: 'V1', LOAD_PORT_COST: 0, DISC_PORT_COST: 1000, TRANSIT_PORT_COST: 0 },
      { FROM_PORT: 30, TO_PORT: 20, RANDOMID: 99, PASSAGE_TYPE: 2, LOAD_PORT_QTY: 0, DISC_PORT_QTY: 0, PORT_COSTTP_VENDOR: 'VTP', LOAD_PORT_COST: 0, DISC_PORT_COST: 0, TRANSIT_PORT_COST: 500 },
    ];
    const pool = { async query(sql, params) {
      if (sql.includes('freight_cost_estimete_slave1')) return [legs];
      if (sql.includes('FROM port_master')) return [[{ PortName: ports[params[0]], COUNTRY_KEY: '' }]];
      return [[]];
    } };
    const tabs = await loadSofPortTabs(pool, 100);
    const sofKeys = tabs.filter((tab) => tab.portType !== 'TP').map((tab) => `${tab.portType}-${tab.portId}-${tab.randomId}`);
    const laytimeTabs = await loadLaytimePortTabs(pool, 100);
    assert.deepEqual(sofKeys, ['LP-10-0', 'DP-20-0', 'DP-20-20', 'LP-30-99', 'DP-20-99']);
    assert.deepEqual(laytimeTabs.map((tab) => `${tab.portType}-${tab.portId}-${tab.randomId}`), sofKeys);
    assert.equal(tabs.find((tab) => tab.portType === 'TP')?.portId, '30');
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

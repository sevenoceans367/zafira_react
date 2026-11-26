import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blankDateTime, normalizeKeepAttachments, resolvePortSofId, resolvePortRandomId, loadActivities, loadEntityRows, loadPortTabs as loadLaytimePortTabs, mapMasterFields, deriveMilestonesFromSofRows, loadSofDerivedMilestones, upsertLaytimeMaster, replaceActivities, replaceDeductions } from './laytimeDb.js';
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
  it('falls through an empty legacy SOF table to tanker range activities', async () => {
    const queries = [];
    const pool = { async query(sql) {
      queries.push(sql);
      if (sql.includes('FROM sof_slave_6')) return [[{
        ACTIVITY: 'Loading cargo', ACTIVITYDATETIME: new Date(2026, 3, 10, 8),
        ACTIVITYDATETIMETO: new Date(2026, 3, 10, 14),
      }]];
      return [[]];
    } };
    const rows = await loadActivities(pool, null, 4, { tanker: true, hasSofRange: true });
    assert.equal(rows[0].activity, 'Loading cargo');
    assert.equal(rows[0].sofLoadPortId, '4');
    assert.ok(queries.some((sql) => sql.includes('FROM sof_slave_6')));
  });
  it('falls back to SOF activities for a Dry Laytime master with no saved activities', async () => {
    const queries = [];
    const pool = { async query(sql) {
      queries.push(sql);
      if (sql.includes('FROM sof_slave ')) return [[{
        ACTIVITYID: 'Loading cargo', START_DATETIME: new Date(2026, 3, 10, 8),
        FINISH_DATETIME: new Date(2026, 3, 10, 14), DURATION: '6',
        LAY_TIME_COUNT: 1, PORT_TIME_COUNT: 0,
      }]];
      return [[]];
    } };
    const rows = await loadActivities(pool, 44, 55, { isDry: true });
    assert.equal(rows[0].activity, 'Loading cargo');
    assert.ok(queries.some((sql) => sql.includes('FROM sof_slave ') && sql.includes("GROUP_NAME = '1'")));
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

describe('Laytime activity and deduction schema fallback', () => {
  const activity = [{ activity: 'Loading', duration: '2', start: '', end: '', notes: '' }];
  const deduction = [{ activity: 'Rain', duration: '2', start: '', end: '', notes: '' }];

  for (const [name, replace, rows] of [
    ['activities', replaceActivities, activity],
    ['deductions', replaceDeductions, deduction],
  ]) {
    it(`rethrows non-schema SQL errors for ${name}`, async () => {
      const sqlError = Object.assign(new Error('permission denied'), { code: 'ER_ACCESS_DENIED_ERROR' });
      let inserts = 0;
      const connection = { async query(sql) {
        if (/^INSERT/i.test(sql.trim())) {
          inserts += 1;
          throw sqlError;
        }
        return [[]];
      } };
      await assert.rejects(replace(connection, 1, rows), (err) => err === sqlError);
      assert.equal(inserts, 1);
    });

    it(`uses reduced columns only for ER_BAD_FIELD_ERROR in ${name}`, async () => {
      const calls = [];
      const connection = { async query(sql) {
        calls.push(sql);
        if (calls.length === 2) throw Object.assign(new Error('unknown column'), { code: 'ER_BAD_FIELD_ERROR' });
        return [[]];
      } };
      await replace(connection, 1, rows);
      assert.equal(calls.length, 3);
      assert.match(calls[2], /ACTIVITYID, START_DATETIME, FINISH_DATETIME, DURATION, NOTES/);
    });
  }
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
  it('only emits laden LP/DP legs, retains saved tabs, and uses FROM_PORT for TP', async () => {
    const ports = { 1: 'TBN', 10: 'ROTTERDAM', 20: 'SINGAPORE', 30: 'SUEZ' };
    const legs = [
      { FROM_PORT: 10, TO_PORT: 20, RANDOMID: 0, PASSAGE_TYPE: 1, LOAD_PORT_QTY: 50000, DISC_PORT_QTY: 50000, LOAD_PORT_COST: 0, DISC_PORT_COST: 0, TRANSIT_PORT_COST: 0 },
      { FROM_PORT: 1, TO_PORT: 20, RANDOMID: null, PASSAGE_TYPE: 2, LOAD_PORT_QTY: 0, DISC_PORT_QTY: 20000, PORT_COSTDP_VENDOR: 'V1', LOAD_PORT_COST: 0, DISC_PORT_COST: 1000, DEMMRATEDP: 35000, TRANSIT_PORT_COST: 0 },
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
    assert.deepEqual(sofKeys, ['DP-20-20']);
    assert.deepEqual(laytimeTabs.map((tab) => `${tab.portType}-${tab.portId}-${tab.randomId}`), ['DP-20-20', 'TP-30-99']);
    assert.equal(tabs.find((tab) => tab.portType === 'TP')?.portId, '30');
    assert.equal(laytimeTabs.find((tab) => tab.portType === 'DP')?.defaults.demurrageRate, '35000');
  });

  it('retains previously saved tabs and their zero RANDOMID', async () => {
    const ports = { 40: 'HAMBURG' };
    const pool = { async query(sql, params) {
      if (sql.includes('freight_cost_estimete_slave1')) return [[]];
      if (sql.includes('FROM port_master')) return [[{ PortName: ports[params[0]], COUNTRY_KEY: '' }]];
      if (sql.includes('FROM laytime_master')) return [[{ PORT: 'LP', PORTID: 40, RANDOMID: 0 }]];
      if (sql.includes('FROM sof_master')) return [[{ PORT: 'DP', PORTID: 40, RANDOMID: 0 }]];
      return [[]];
    } };
    const laytimeTabs = await loadLaytimePortTabs(pool, 100, 12);
    assert.deepEqual(laytimeTabs.map((tab) => `${tab.portType}-${tab.portId}-${tab.randomId}`), ['LP-40-0', 'DP-40-0']);
    const sofTabs = await loadSofPortTabs(pool, 100, 12);
    assert.deepEqual(sofTabs.map((tab) => `${tab.portType}-${tab.portId}-${tab.randomId}`), ['DP-40-0']);
  });

  it('does not use ballast legs for uncosted LP/DP fallback when laden legs exist', async () => {
    const ports = { 10: 'ROTTERDAM', 20: 'SINGAPORE' };
    const legs = [
      { FROM_PORT: 10, TO_PORT: 20, RANDOMID: 0, PASSAGE_TYPE: 1, LOAD_PORT_QTY: 50000, DISC_PORT_QTY: 50000, LOAD_PORT_COST: 100, DISC_PORT_COST: 200 },
      { FROM_PORT: 10, TO_PORT: 20, RANDOMID: 7, PASSAGE_TYPE: 2, LOAD_PORT_QTY: 100, DISC_PORT_QTY: 0, LOAD_PORT_COST: 0, DISC_PORT_COST: 0 },
    ];
    const pool = { async query(sql, params) {
      if (sql.includes('freight_cost_estimete_slave1')) return [legs];
      if (sql.includes('FROM port_master')) return [[{ PortName: ports[params[0]], COUNTRY_KEY: '' }]];
      return [[]];
    } };
    assert.deepEqual((await loadLaytimePortTabs(pool, 100)).map((tab) => `${tab.portType}-${tab.portId}-${tab.randomId}`), ['LP-10-7']);
  });

  it('retries the cost-sheet query without demurrage columns on older schemas', async () => {
    const calls = [];
    const pool = { async query(sql) {
      calls.push(sql);
      if (sql.includes('DEMMRATELP')) throw Object.assign(new Error('unknown column'), { code: 'ER_BAD_FIELD_ERROR' });
      if (sql.includes('freight_cost_estimete_slave1')) return [[{
        FROM_PORT: 10, TO_PORT: 20, RANDOMID: 4, PASSAGE_TYPE: 2, LOAD_PORT_QTY: 1,
      }]];
      if (sql.includes('FROM port_master')) return [[{ PortName: 'ROTTERDAM', COUNTRY_KEY: '' }]];
      return [[]];
    } };
    const tabs = await loadLaytimePortTabs(pool, 100);
    assert.equal(calls.filter((sql) => sql.includes('freight_cost_estimete_slave1')).length, 2);
    assert.equal(tabs[0].defaults.demurrageRate, '');
  });
});

describe('SOF derived Laytime master defaults', () => {
  const keyRows = [
    { ACTIVITY: 'EOSP', ACTIVITYDATETIME: new Date(2026, 3, 10, 7, 30) },
    { ACTIVITY: 'NOR tendered', ACTIVITYDATETIME: new Date(2026, 3, 10, 8) },
    { ACTIVITY: 'Pilot onboard', ACTIVITYDATETIME: new Date(2026, 3, 10, 9) },
    { ACTIVITY: 'Commenced cargo operations', ACTIVITYDATETIME: new Date(2026, 3, 10, 10) },
    { ACTIVITY: 'Completed cargo operations', ACTIVITYDATETIME: new Date(2026, 3, 10, 18) },
    { ACTIVITY: 'FAOP', ACTIVITYDATETIME: new Date(2026, 3, 12, 19) },
  ];
  const cargoRows = [{ ACTIVITY: 'Cargo Loaded', SHIPFIGURE: '31000', BLFIGURE: '30950' }];

  it('derives all milestones and stowage from SOF child rows', () => {
    assert.deepEqual(deriveMilestonesFromSofRows(keyRows, cargoRows), {
      vesselArrived: '10-04-2026 07:30', norTendered: '10-04-2026 08:00',
      pilotOnBoard: '10-04-2026 09:00', loadCommenced: '10-04-2026 10:00',
      loadCompleted: '10-04-2026 18:00', vesselSailed: '12-04-2026 19:00', stowageQty: '31000',
    });
    assert.equal(deriveMilestonesFromSofRows([
      { ACTIVITY: 'Pilot on board', ACTIVITYDATETIME: '0000-00-00 00:00:00' },
      { ACTIVITY: 'Pilot onboard', ACTIVITYDATETIME: new Date(2026, 3, 10, 9) },
    ], [{ ACTIVITY: 'Cargo discharged', SHIPFIGURE: '0', BLFIGURE: '24500' }]).pilotOnBoard, '');
    assert.equal(deriveMilestonesFromSofRows([], [
      { ACTIVITY: 'Cargo discharged', SHIPFIGURE: '0', BLFIGURE: '24500' },
    ]).stowageQty, '24500');
    assert.equal(deriveMilestonesFromSofRows([], [
      { ACTIVITY: 'Cargo Loaded', SHIPFIGURE: '0', BLFIGURE: '' },
      { ACTIVITY: 'Cargo Discharged', SHIPFIGURE: '27500', BLFIGURE: '27000' },
    ]).stowageQty, '27500');
  });

  it('fills blank saved Laytime fields from SOF/derived values without changing nonblank values', () => {
    const derived = deriveMilestonesFromSofRows(keyRows, cargoRows);
    const filled = mapMasterFields({
      TERMINAL: '', STOWAGE_QTY: '', VESSEL_ARRIVED: '0000-00-00 00:00:00', NOR_TENDERED: '',
      PILOT_ON_BOARD: '', LOAD_DIS_COMMENCED: '', LOAD_DIS_COMPLETED: '', VESSEL_SAILED: '', DEMURRAGE_RATE: '',
    }, { TERMINAL: '', VA_1: '', VAPS_1: '0', NT_1: '', PBFB_1: '', LC: '', LC1: '', VS: '' },
    { demurrageRate: '' }, derived);
    assert.deepEqual(
      ['stowageQty','vesselArrived','norTendered','pilotOnBoard','loadCommenced','loadCompleted','vesselSailed'].map((key) => filled[key]),
      ['31000','10-04-2026 07:30','10-04-2026 08:00','10-04-2026 09:00','10-04-2026 10:00','10-04-2026 18:00','12-04-2026 19:00'],
    );
    assert.equal(filled.demurrageRate, '');

    const saved = mapMasterFields({
      TERMINAL: 'Saved Terminal', STOWAGE_QTY: '222', VESSEL_ARRIVED: '11-04-2026 05:00',
      NOR_TENDERED: '11-04-2026 06:00', PILOT_ON_BOARD: '11-04-2026 07:00',
      LOAD_DIS_COMMENCED: '11-04-2026 08:00', LOAD_DIS_COMPLETED: '11-04-2026 16:00',
      VESSEL_SAILED: '12-04-2026 20:00', DEMURRAGE_RATE: '123',
    }, { TERMINAL: 'SOF terminal', VA_1: '999', VAPS_1: '0' }, { demurrageRate: '40000' }, derived);
    assert.deepEqual(
      ['terminal','stowageQty','vesselArrived','norTendered','pilotOnBoard','loadCommenced','loadCompleted','vesselSailed','demurrageRate'].map((k) => saved[k]),
      ['Saved Terminal','222','11-04-2026 05:00','11-04-2026 06:00','11-04-2026 07:00','11-04-2026 08:00','11-04-2026 16:00','12-04-2026 20:00','123'],
    );
  });

  it('loads milestones and cargo rows from both SOF child tables', async () => {
    const seen = [];
    const pool = { async query(sql) {
      seen.push(sql);
      if (sql.includes('sof_slave_6')) return [keyRows];
      if (sql.includes('sof_slave_7')) return [cargoRows];
      return [[]];
    } };
    assert.deepEqual(await loadSofDerivedMilestones(pool, 55), deriveMilestonesFromSofRows(keyRows, cargoRows));
    assert.match(seen[0], /ORDER BY SLAVEID ASC/i);
    assert.match(seen[1], /ORDER BY SLAVEID ASC/i);
  });
});

describe('Laytime rate defaults', () => {
  it('uses cost-sheet demurrage and loaded rates when no Laytime row or SOF skeleton has blank rates', () => {
    const missing = mapMasterFields(null, null, { demurrageRate: '40000', loadedRate: '12000' });
    const sofSkeleton = mapMasterFields(
      { DEMURRAGE_RATE: null, LOADED_RATE: null },
      null,
      { demurrageRate: '40000', loadedRate: '12000' },
    );
    const saved = mapMasterFields(
      { DEMURRAGE_RATE: '123', LOADED_RATE: '8500' },
      null,
      { demurrageRate: '40000', loadedRate: '12000' },
    );
    const explicitZero = mapMasterFields(
      { DEMURRAGE_RATE: '0', LOADED_RATE: '0' },
      null,
      { demurrageRate: '40000', loadedRate: '12000' },
    );
    assert.equal(missing.demurrageRate, '40000');
    assert.equal(missing.loadedRate, '12000');
    assert.equal(sofSkeleton.demurrageRate, '40000');
    assert.equal(sofSkeleton.loadedRate, '12000');
    assert.equal(saved.demurrageRate, '123');
    assert.equal(saved.loadedRate, '8500');
    assert.equal(explicitZero.demurrageRate, '0');
    assert.equal(explicitZero.loadedRate, '0');
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

describe('Dry Laytime editor entity wiring', () => {
  it('loads sof_slave_3 named entity dates when usesEditor is enabled for Dry ports', async () => {
    const pool = {
      async query(sql) {
        if (sql.includes('laytime_slave2')) return [[]];
        if (sql.includes('sof_slave_6')) return [[]];
        if (sql.includes('sof_slave_3')) {
          return [[{ ENTITY_NAME: 'All Clear', ENTITY_VALUE: '2026-06-15 14:30:00' }]];
        }
        return [[]];
      },
    };
    const rows = await loadEntityRows(pool, 10, 55, { usesEditor: true, hasSofRange: true });
    assert.deepEqual(rows, [{ name: 'All Clear', value: '15-06-2026 14:30' }]);
  });
});

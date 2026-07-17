import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetTcMockStoreForTests,
  createTcEstimate,
  deleteTcEstimate,
  getTcCompareEstimates,
  getTcEstimate,
  getTcLookups,
  listTcDecisionCharts,
  listTcEstimates,
  saveTcCalculation,
  submitTcDecisionChart,
  updateTcEstimate,
} from './tcEstimateService.js';

describe('tcEstimateService mock lifecycle', () => {
  beforeEach(() => {
    __resetTcMockStoreForTests();
  });

  it('returns lookups and lists Dry business type by default', async () => {
    const lookups = await getTcLookups();
    assert.ok(Array.isArray(lookups.vessels));
    assert.ok(lookups.vessels.length >= 1);

    const list = await listTcEstimates({ selBType: '3', page: 1, pageSize: 10 });
    assert.equal(list.businessType, '3');
    assert.ok(list.recordsTotal >= 1);
    assert.equal(list.records[0].vesselName, 'Atlantic Star');
    assert.equal(list.records[0].canCompare, true);
  });

  it('supports create, update, calculate, compare, finalize, and delete', async () => {
    const created = await createTcEstimate({
      businessTypeId: '3',
      vesselImoId: '100',
      vesselType: 'Capesize',
      tcNo: 'TC-TEST-99',
      cpDate: '20-01-2026',
      delRangePort: 'Singapore',
      reDelRange: 'Qingdao',
      hireFixPer: '12000',
      exchangeRate: '1',
      addComm: '1',
      brokerComm: '1',
      period: '20',
    });
    assert.equal(created.msg, 0);
    assert.ok(created.tcOutId);

    const updated = await updateTcEstimate(created.tcOutId, {
      tcNo: 'TC-TEST-99A',
      hireFixPer: '12500',
      vesselImoId: '100',
      delRangePort: 'Singapore',
      reDelRange: 'Qingdao',
      foConsLdg: '2.5',
      doConsIdle: '0.5',
      broCommPayable: 'Charterer',
      addComm: '1.25',
      brokerComm: '1.25',
      balticRate: '11.2',
    });
    assert.equal(updated.msg, 0);

    const detailBeforeCalc = await getTcEstimate(created.tcOutId);
    assert.equal(detailBeforeCalc.tcNo, 'TC-TEST-99A');
    assert.equal(detailBeforeCalc.hireFixPer, '12500');
    assert.equal(detailBeforeCalc.foConsLdg, '2.5');
    assert.equal(detailBeforeCalc.doConsIdle, '0.5');
    assert.equal(detailBeforeCalc.broCommPayable, 'Charterer');
    assert.equal(detailBeforeCalc.balticRate, '11.2');
    assert.ok(detailBeforeCalc.vesselName);

    const calc = await saveTcCalculation(created.tcOutId, {
      calc: {
        tcDays: '20',
        utilisationDays: '20',
        dailyGrossHire: '12500',
        addCommPct: '1',
        brokerCommPct: '1',
        cve: '500',
        lessOffHire: '0',
        otherIncome: '0',
        totalExp: '10000',
        delHfoMt: '100',
        delHfoUsd: '400',
        delMgoMt: '10',
        delMgoUsd: '700',
        reDelHfoMt: '80',
        reDelHfoUsd: '410',
        reDelMgoMt: '8',
        reDelMgoUsd: '710',
      },
      otherIncome: [],
      otherExpenses: [{ description: 'Agency', amount: '10000', addToTotal: true }],
      offHires: [],
    });
    assert.equal(calc.msg, 0);
    assert.ok(Number(calc.calc.totalRev) > 0);

    const list = await listTcEstimates({ selBType: '3', search: 'TC-TEST-99A' });
    const row = list.records.find((r) => String(r.tcOutId) === String(created.tcOutId));
    assert.ok(row);
    assert.equal(row.canCompare, true);

    const compare = await getTcCompareEstimates([created.tcOutId, 2001]);
    assert.ok(compare.count >= 1);

    const submitted = await submitTcDecisionChart({
      finalId: created.tcOutId,
      candidates: [
        { tcOutId: created.tcOutId, remarks: 'Preferred' },
        { tcOutId: 2001, remarks: 'Backup' },
      ],
    });
    assert.equal(submitted.msg, 0);
    assert.ok(submitted.message);

    const after = await getTcEstimate(created.tcOutId);
    assert.ok(after.comId);

    const charts = await listTcDecisionCharts({ page: 1, pageSize: 10 });
    assert.ok(charts.recordsTotal >= 1);
    assert.equal(String(charts.records[0].tcOutId), String(created.tcOutId));

    const deleted = await deleteTcEstimate(created.tcOutId);
    assert.equal(deleted.msg, 2);
    const missing = await getTcEstimate(created.tcOutId);
    assert.equal(missing, null);
  });

  it('requires final selection for decision chart submit', async () => {
    await assert.rejects(
      () => submitTcDecisionChart({ candidates: [{ tcOutId: 2001 }] }),
      /Final selection/,
    );
  });
});

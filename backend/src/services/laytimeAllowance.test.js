import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isExplicitLaytimeAllowance,
  normalizeEstimateTimeAllowed,
  resolveContractualLaytimeAllowance,
} from './laytimeAllowance.js';

describe('normalizeEstimateTimeAllowed', () => {
  it('keeps TIMEALLOWED only and never promotes WORKING_DAYS', () => {
    assert.equal(normalizeEstimateTimeAllowed({ TIMEALLOWED: 108, WORKING_DAYS: 5.59 }), '108');
    assert.equal(normalizeEstimateTimeAllowed({ TIMEALLOWED: '108.00', WORKING_DAYS: '3.500' }), '108.00');
    assert.equal(normalizeEstimateTimeAllowed({ TIMEALLOWED: null, WORKING_DAYS: '3.500' }), '');
    assert.equal(normalizeEstimateTimeAllowed({ TIMEALLOWED: '', WORKING_DAYS: 3.5 }), '');
    assert.equal(normalizeEstimateTimeAllowed(null), '');
  });
});

describe('isExplicitLaytimeAllowance', () => {
  it('treats numeric zero as an explicit override and blank/null as missing', () => {
    assert.equal(isExplicitLaytimeAllowance(0), true);
    assert.equal(isExplicitLaytimeAllowance('0'), true);
    assert.equal(isExplicitLaytimeAllowance('0.00'), true);
    assert.equal(isExplicitLaytimeAllowance('108'), true);
    assert.equal(isExplicitLaytimeAllowance(''), false);
    assert.equal(isExplicitLaytimeAllowance('   '), false);
    assert.equal(isExplicitLaytimeAllowance(null), false);
    assert.equal(isExplicitLaytimeAllowance(undefined), false);
  });
});

describe('resolveContractualLaytimeAllowance', () => {
  it('returns unknown for transit ports even when estimate TIMEALLOWED exists', () => {
    const result = resolveContractualLaytimeAllowance({
      portType: 'TP',
      savedLaytimeAllowed: null,
      estimateTimeAllowed: '108',
    });
    assert.equal(result.value, '');
    assert.equal(result.source, 'transit');
  });

  it('prefers saved LAYTIME_ALLOWED including explicit zero over estimate TIMEALLOWED', () => {
    assert.deepEqual(
      resolveContractualLaytimeAllowance({
        portType: 'LP',
        savedLaytimeAllowed: '84.0000',
        estimateTimeAllowed: '108',
      }),
      { value: '84.0000', source: 'laytime_master' },
    );
    assert.deepEqual(
      resolveContractualLaytimeAllowance({
        portType: 'DP',
        savedLaytimeAllowed: '0',
        estimateTimeAllowed: '108',
      }),
      { value: '0', source: 'laytime_master' },
    );
  });

  it('falls back to estimate TIMEALLOWED when no master or incomplete blank allowance', () => {
    assert.deepEqual(
      resolveContractualLaytimeAllowance({
        portType: 'LP',
        savedLaytimeAllowed: null,
        estimateTimeAllowed: '108.00',
      }),
      { value: '108.00', source: 'estimate_timeallowed' },
    );
    assert.deepEqual(
      resolveContractualLaytimeAllowance({
        portType: 'DP',
        savedLaytimeAllowed: '',
        estimateTimeAllowed: '108',
        hasLaytimeMaster: true,
      }),
      { value: '108', source: 'estimate_timeallowed' },
    );
  });

  it('keeps unknown when both saved allowance and TIMEALLOWED are absent', () => {
    assert.deepEqual(
      resolveContractualLaytimeAllowance({
        portType: 'LP',
        savedLaytimeAllowed: null,
        estimateTimeAllowed: '',
      }),
      { value: '', source: 'unknown' },
    );
  });

  it('seeds each eligible LP/DP with the full voyage TIMEALLOWED (Legacy $la Fun285 path)', () => {
    const estimate = '108';
    const ports = ['LP', 'DP', 'DP'].map((portType) => resolveContractualLaytimeAllowance({
      portType,
      savedLaytimeAllowed: '',
      estimateTimeAllowed: estimate,
    }));
    assert.deepEqual(ports.map((p) => p.value), ['108', '108', '108']);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADCOM_COMM_TYPE,
  BROKERAGE_COMM_TYPE,
  assignCargoCommissions,
  createEmptyCargoRow,
} from './estimateDetail.constants.js';

describe('assignCargoCommissions', () => {
  it('keeps commissions empty on edit when slave4 has no rows', () => {
    const cargo = [{ ...createEmptyCargoRow(1), commissions: [] }];
    const { cargoRows } = assignCargoCommissions(
      cargo,
      [],
      [],
      [],
      { id: '123', addCommPercent: '3.75', addressCommAmt: '9000', brokeragePercent: '1.25' },
    );
    assert.equal(cargoRows[0].commissions.length, 0);
  });

  it('restores linked slave4 commission rows on edit', () => {
    const cargo = [{ ...createEmptyCargoRow(1), id: 'cargo-1', commissions: [] }];
    const { cargoRows } = assignCargoCommissions(
      cargo,
      [],
      [],
      [{
        id: 'brk-1',
        cargoLineId: 'cargo-1',
        commType: ADCOM_COMM_TYPE,
        percent: '3.75',
        amount: '100',
        vendorId: '',
      }],
      { id: '123' },
    );
    assert.equal(cargoRows[0].commissions.length, 1);
    assert.equal(cargoRows[0].commissions[0].percent, '3.75');
  });

  it('seeds default ADCOM + Brokerage on new Add Estimate', () => {
    const { cargoRows } = assignCargoCommissions([], [], [], [], {});
    assert.equal(cargoRows[0].commissions.length, 2);
    assert.equal(cargoRows[0].commissions[0].commType, ADCOM_COMM_TYPE);
    assert.equal(cargoRows[0].commissions[1].commType, BROKERAGE_COMM_TYPE);
  });
});

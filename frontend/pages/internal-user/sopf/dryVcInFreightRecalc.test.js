import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyEstimateCalculations } from './estimateCalculations.js';
import {
  ADCOM_COMM_TYPE,
  BROKERAGE_COMM_TYPE,
  ensureStandardCargoCommissions,
} from './estimateDetail.constants.js';

function dryVcInBase(overrides = {}) {
  return {
    estimateType: 3,
    fixtureTypeId: '4',
    dryMarket: '1',
    tankType: '1',
    tankerFreightRate: '25',
    marketRate: '',
    cargoQuantity: '10000',
    freightGross: '250000',
    revenue: '250000',
    cargoRows: [{ id: '1', cargoMt: '', rateUsdMt: '', amountUsd: '', commissions: [] }],
    portLegs: [],
    orcRows: [],
    otherIncomeRows: [],
    commissionRows: [],
    opexRows: [],
    bunkerRows: [],
    secaBunkerRows: [],
    freightQtyRows: [],
    worldscaleRows: [],
    ...overrides,
  };
}

describe('dry VCIN freight recalc', () => {
  it('uses tankerFreightRate when marketRate is empty (single)', () => {
    const next = applyEstimateCalculations(
      dryVcInBase({ cargoQuantity: '20000' }),
      {},
    );
    assert.equal(next.freightGross, '500000');
    assert.equal(next.revenue, '500000');
  });

  it('does not keep loaded freightGross when live single calc is zero', () => {
    const next = applyEstimateCalculations(
      dryVcInBase({
        tankerFreightRate: '0',
        marketRate: '0',
        cargoQuantity: '20000',
        freightGross: '250000',
      }),
      {},
    );
    assert.equal(next.freightGross, '');
    assert.equal(next.revenue, '');
  });

  it('recomputes multiple cargo MT×rate into Freight Results revenue', () => {
    const next = applyEstimateCalculations(
      dryVcInBase({
        tankType: '2',
        freightGross: '999999',
        cargoRows: [{
          id: '1',
          cargoMt: '2000',
          rateUsdMt: '50',
          amountUsd: '',
          commissions: [],
        }],
      }),
      {},
    );
    assert.equal(next.freightGross, '100000');
    assert.equal(next.revenue, '100000');
  });

  it('does not keep loaded freightGross when multiple cargo amounts are empty', () => {
    const next = applyEstimateCalculations(
      dryVcInBase({
        tankType: '2',
        freightGross: '999999',
        cargoRows: [{ id: '1', cargoMt: '', rateUsdMt: '', amountUsd: '', commissions: [] }],
      }),
      {},
    );
    assert.equal(next.freightGross, '');
  });

  it('subtracts address and brokerage commission from Final Net Freight / revenue', () => {
    const next = applyEstimateCalculations(
      dryVcInBase({
        cargoRows: [{
          id: '1',
          cargoMt: '',
          rateUsdMt: '',
          amountUsd: '',
          commissions: ensureStandardCargoCommissions([
            { id: 'c1', commType: ADCOM_COMM_TYPE, percent: '3.75', amount: '', vendorId: '' },
            { id: 'c2', commType: BROKERAGE_COMM_TYPE, percent: '1.25', amount: '', vendorId: '' },
          ]),
        }],
      }),
      {},
    );
    // 250000 − 3.75% − 1.25% = 237500
    assert.equal(next.freightGross, '250000');
    assert.equal(next.addressCommAmt, '9375.00');
    assert.equal(next.brokerageAmt, '3125.00');
    assert.equal(next.revenue, '237500');
    // Brokerage still shows under Operational Expenses (display), already in revenue
    assert.equal(next.operationalExpenses, '3125');
  });
});

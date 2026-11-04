import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCargoQtyDwtToRecalc,
  capCargoQtyFormPatch,
  capCargoQtyRowPatch,
  capQtyToDwt,
  cargoQtyDwtViolation,
  vesselDwtMt,
} from './cargoQtyDwtLimit.js';

describe('cargoQtyDwtLimit', () => {
  it('reads Summer DWT then Loadable', () => {
    assert.equal(vesselDwtMt({ dwtSummer: '85,000', loadable: '1' }), 85000);
    assert.equal(vesselDwtMt({ dwtSummer: '', loadable: '72000' }), 72000);
    assert.equal(vesselDwtMt({}), 0);
  });

  it('does not silently rewrite typed qty against DWT', () => {
    assert.equal(capQtyToDwt('90000', 85000), '90000');
    assert.equal(capQtyToDwt('85000', 85000), '85000');
    assert.equal(capQtyToDwt('12.5', 85000), '12.5');
    assert.equal(capQtyToDwt('', 85000), '');
  });

  it('leaves lumpsum and cargo quantity patches unchanged', () => {
    const next = capCargoQtyFormPatch(
      { lumpsumQty: '90000', cargoQuantity: '88000' },
      { dwtSummer: '85000' },
    );
    assert.equal(next.lumpsumQty, '90000');
    assert.equal(next.cargoQuantity, '88000');
  });

  it('leaves cargo row patches unchanged', () => {
    const form = {
      dwtSummer: '100',
      cargoRows: [
        { id: 'a', cargoMt: '60' },
        { id: 'b', cargoMt: '20' },
      ],
      overageCargoRows: [{ id: 'o', cargoMt: '10' }],
    };
    const next = capCargoQtyRowPatch('cargoRows', 'b', { cargoMt: '50' }, form);
    assert.equal(next.cargoMt, '50');
  });

  it('leaves World Scale overage patches unchanged', () => {
    const form = {
      dwtSummer: '100',
      tankerWsRows: [{ id: 'ws1', minCargoQty: '80', oveCargoQty: '10' }],
    };
    const next = capCargoQtyRowPatch('tankerWsRows', 'ws1', { oveCargoQty: '40' }, form);
    assert.equal(next.oveCargoQty, '40');
  });

  it('leaves tanker WS rows unchanged on recalc', () => {
    const form = {
      dwtSummer: '100',
      tankerWsRows: [{ id: 'ws1', minCargoQty: '80', oveCargoQty: '10' }],
    };
    const over = applyCargoQtyDwtToRecalc(
      'tankerWsRows',
      [{ id: 'ws1', minCargoQty: '80', oveCargoQty: '40' }],
      form,
    );
    assert.equal(over[0].oveCargoQty, '40');
  });

  it('flags submit when cargo qty is above DWT and includes the limit', () => {
    const err = cargoQtyDwtViolation({
      estimateType: 2,
      tankType: '1',
      chkLumpsum: true,
      lumpsumQty: '90000',
      dwtSummer: '85000',
    });
    assert.equal(err.message, 'Cargo qty cannot be more than DWT (85000)');
    assert.equal(err.fieldId, 'lumpsumQty');
  });

  it('flags dry cargoQuantity above vessel DWT (50000 vs 5845 case)', () => {
    const err = cargoQtyDwtViolation({
      estimateType: 3,
      cargoQuantity: '50000',
      dwtSummer: '5845',
    });
    assert.equal(err.message, 'Cargo qty cannot be more than DWT (5845)');
    assert.equal(err.fieldId, 'cargoQuantityDry');
  });
});

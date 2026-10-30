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

  it('caps a qty that is more than DWT and leaves equal or smaller values', () => {
    assert.equal(capQtyToDwt('90000', 85000), '85000');
    assert.equal(capQtyToDwt('85000', 85000), '85000');
    assert.equal(capQtyToDwt('12.5', 85000), '12.5');
    assert.equal(capQtyToDwt('', 85000), '');
  });

  it('caps lumpsum and cargo quantity on a form patch', () => {
    const next = capCargoQtyFormPatch(
      { lumpsumQty: '90000', cargoQuantity: '88000' },
      { dwtSummer: '85000' },
    );
    assert.equal(next.lumpsumQty, '85000');
    assert.equal(next.cargoQuantity, '85000');
  });

  it('caps the edited cargo row so main + overage stay within DWT', () => {
    const form = {
      dwtSummer: '100',
      cargoRows: [
        { id: 'a', cargoMt: '60' },
        { id: 'b', cargoMt: '20' },
      ],
      overageCargoRows: [{ id: 'o', cargoMt: '10' }],
    };
    const next = capCargoQtyRowPatch('cargoRows', 'b', { cargoMt: '50' }, form);
    assert.equal(next.cargoMt, '30');
  });

  it('caps World Scale overage against remaining DWT after min qty', () => {
    const form = {
      dwtSummer: '100',
      tankerWsRows: [{ id: 'ws1', minCargoQty: '80', oveCargoQty: '10' }],
    };
    const next = capCargoQtyRowPatch('tankerWsRows', 'ws1', { oveCargoQty: '40' }, form);
    assert.equal(next.oveCargoQty, '20');
  });

  it('caps tanker WS rows on recalc when min + overage exceed DWT', () => {
    const form = {
      dwtSummer: '100',
      tankerWsRows: [{ id: 'ws1', minCargoQty: '80', oveCargoQty: '10' }],
    };
    const rows = applyCargoQtyDwtToRecalc(
      'tankerWsRows',
      [{ id: 'ws1', minCargoQty: '90', oveCargoQty: '10' }],
      form,
    );
    assert.equal(rows[0].minCargoQty, '90');
    assert.equal(rows[0].oveCargoQty, '10');
    const over = applyCargoQtyDwtToRecalc(
      'tankerWsRows',
      [{ id: 'ws1', minCargoQty: '80', oveCargoQty: '40' }],
      form,
    );
    assert.equal(over[0].oveCargoQty, '20');
  });

  it('flags submit when cargo qty is above DWT', () => {
    const err = cargoQtyDwtViolation({
      estimateType: 2,
      tankType: '1',
      chkLumpsum: true,
      lumpsumQty: '90000',
      dwtSummer: '85000',
    });
    assert.equal(err.message, 'Cargo qty cannot be more than DWT');
    assert.equal(err.fieldId, 'lumpsumQty');
  });
});

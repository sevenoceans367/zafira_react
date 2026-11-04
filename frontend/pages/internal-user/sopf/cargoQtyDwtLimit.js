function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Summer DWT, falling back to Loadable when Summer is empty. */
export function vesselDwtMt(form) {
  const summer = num(form?.dwtSummer);
  if (summer > 0) return summer;
  const loadable = num(form?.loadable);
  return loadable > 0 ? loadable : 0;
}

/**
 * Soft input rewrite removed: typed cargo qty must stay as entered.
 * Over-DWT is caught on submit via cargoQtyDwtViolation.
 */
export function capQtyToDwt(raw, _max) {
  return raw;
}

function sumCargoMt(rows, exceptId) {
  return (rows || []).reduce((sum, row) => {
    if (exceptId != null && String(row.id) === String(exceptId)) return sum;
    return sum + num(row.cargoMt);
  }, 0);
}

export function capTankerWsRows(rows, _dwt, _prevRows = []) {
  return rows;
}

export function capCargoQtyFormPatch(patch, _form) {
  return patch;
}

export function capCargoQtyRowPatch(_collection, _id, patch, _form) {
  return patch;
}

export function applyCargoQtyDwtToRecalc(_key, value, _form) {
  return value;
}

function firstCargoMtFieldId(rows) {
  const row = (rows || []).find((item) => num(item.cargoMt) > 0) || (rows || [])[0];
  return row ? `cargoMt_${row.id}` : 'cargoId_0';
}

/** First cargo-qty vs DWT failure, or null. */
export function cargoQtyDwtViolation(form = {}) {
  const dwt = vesselDwtMt(form);
  if (!(dwt > 0)) return null;

  const message = `Cargo qty cannot be more than DWT (${dwt})`;
  const estimateType = Number(form.estimateType) || 2;
  const tankType = String(form.tankType || '1');
  const chkLumpsum = form.chkLumpsum != null ? !!form.chkLumpsum : true;

  if (estimateType === 2 && tankType === '2') {
    const total = sumCargoMt(form.cargoRows) + sumCargoMt(form.overageCargoRows);
    if (total > dwt) {
      return { message, fieldId: firstCargoMtFieldId(form.cargoRows) };
    }
    return null;
  }

  if (estimateType === 2 && !chkLumpsum) {
    const row = (form.tankerWsRows || [])[0] || {};
    if (num(row.minCargoQty) + num(row.oveCargoQty) > dwt) {
      return { message, fieldId: 'minCargoQty_0' };
    }
    return null;
  }

  if (num(form.lumpsumQty) > dwt) {
    return { message, fieldId: 'lumpsumQty' };
  }
  if (num(form.cargoQuantity) > dwt) {
    return {
      message,
      fieldId: estimateType === 1 ? 'cargoQuantityGas' : 'cargoQuantityDry',
    };
  }
  return null;
}

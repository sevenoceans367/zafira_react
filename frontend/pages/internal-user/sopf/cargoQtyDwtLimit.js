import { sanitizeFieldDecimal } from './estimateInputSanitize.js';

const CARGO_QTY_FORM_KEYS = new Set(['lumpsumQty', 'cargoQuantity']);
const CARGO_MT_COLLECTIONS = new Set(['cargoRows', 'overageCargoRows', 'deadfreightCargoRows']);
const POOLED_CARGO_MT_COLLECTIONS = new Set(['cargoRows', 'overageCargoRows']);

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

export function capQtyToDwt(raw, max) {
  if (!(max > 0) || raw == null || String(raw).trim() === '') return raw;
  const n = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= max) return raw;
  return sanitizeFieldDecimal('lumpsumQty', String(max));
}

function sumCargoMt(rows, exceptId) {
  return (rows || []).reduce((sum, row) => {
    if (exceptId != null && String(row.id) === String(exceptId)) return sum;
    return sum + num(row.cargoMt);
  }, 0);
}

export function capTankerWsRows(rows, dwt, prevRows = []) {
  if (!(dwt > 0)) return rows;
  return (rows || []).map((row) => {
    const prev = (prevRows || []).find((item) => String(item.id) === String(row.id)) || {};
    let minQty = row.minCargoQty;
    let oveQty = row.oveCargoQty;
    const minN = num(minQty);
    const oveN = num(oveQty);
    if (minN + oveN <= dwt) return row;

    const minChanged = String(minQty ?? '') !== String(prev.minCargoQty ?? '');
    const oveChanged = String(oveQty ?? '') !== String(prev.oveCargoQty ?? '');
    if (minChanged && !oveChanged) {
      minQty = capQtyToDwt(minQty, Math.max(0, dwt - oveN));
    } else if (oveChanged && !minChanged) {
      oveQty = capQtyToDwt(oveQty, Math.max(0, dwt - minN));
    } else {
      minQty = capQtyToDwt(minQty, dwt);
      oveQty = capQtyToDwt(oveQty, Math.max(0, dwt - num(minQty)));
    }
    return { ...row, minCargoQty: minQty, oveCargoQty: oveQty };
  });
}

export function capCargoQtyFormPatch(patch, form) {
  const dwt = vesselDwtMt(form);
  if (!(dwt > 0) || !patch || typeof patch !== 'object') return patch;
  const next = { ...patch };
  for (const key of CARGO_QTY_FORM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      next[key] = capQtyToDwt(next[key], dwt);
    }
  }
  if (Array.isArray(next.tankerWsRows)) {
    next.tankerWsRows = capTankerWsRows(next.tankerWsRows, dwt, form.tankerWsRows);
  }
  for (const collection of CARGO_MT_COLLECTIONS) {
    if (!Array.isArray(next[collection])) continue;
    next[collection] = next[collection].map((row) => {
      const capped = capQtyToDwt(row.cargoMt, dwt);
      return capped === row.cargoMt ? row : { ...row, cargoMt: capped };
    });
  }
  return next;
}

export function capCargoQtyRowPatch(collection, id, patch, form) {
  const dwt = vesselDwtMt(form);
  if (!(dwt > 0) || !patch) return patch;
  const next = { ...patch };

  if (CARGO_MT_COLLECTIONS.has(collection) && Object.prototype.hasOwnProperty.call(next, 'cargoMt')) {
    let max = dwt;
    if (POOLED_CARGO_MT_COLLECTIONS.has(collection)) {
      const used = sumCargoMt(form.cargoRows, collection === 'cargoRows' ? id : null)
        + sumCargoMt(form.overageCargoRows, collection === 'overageCargoRows' ? id : null);
      max = Math.max(0, dwt - used);
    }
    next.cargoMt = capQtyToDwt(next.cargoMt, max);
  }

  if (collection === 'tankerWsRows') {
    const row = (form.tankerWsRows || []).find((item) => String(item.id) === String(id)) || {};
    const minQty = Object.prototype.hasOwnProperty.call(next, 'minCargoQty')
      ? next.minCargoQty
      : row.minCargoQty;
    const oveQty = Object.prototype.hasOwnProperty.call(next, 'oveCargoQty')
      ? next.oveCargoQty
      : row.oveCargoQty;
    if (Object.prototype.hasOwnProperty.call(next, 'minCargoQty')) {
      next.minCargoQty = capQtyToDwt(minQty, Math.max(0, dwt - num(oveQty)));
    }
    if (Object.prototype.hasOwnProperty.call(next, 'oveCargoQty')) {
      const minAfter = Object.prototype.hasOwnProperty.call(next, 'minCargoQty')
        ? next.minCargoQty
        : minQty;
      next.oveCargoQty = capQtyToDwt(oveQty, Math.max(0, dwt - num(minAfter)));
    }
  }

  return next;
}

export function applyCargoQtyDwtToRecalc(key, value, form) {
  const dwt = vesselDwtMt(form);
  if (!(dwt > 0)) return value;
  if (key === 'lumpsumQty' || key === 'cargoQuantity') {
    return capQtyToDwt(value, dwt);
  }
  if (key === 'tankerWsRows') {
    return capTankerWsRows(value, dwt, form.tankerWsRows);
  }
  if (CARGO_MT_COLLECTIONS.has(key) && Array.isArray(value)) {
    return value.map((row) => {
      const capped = capQtyToDwt(row.cargoMt, dwt);
      return capped === row.cargoMt ? row : { ...row, cargoMt: capped };
    });
  }
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

  const message = 'Cargo qty cannot be more than DWT';
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

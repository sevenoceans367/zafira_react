/** Port of PHP addestimate.php setCalForCargoCalLoad / setBlQuant. */

export const WATER_DENSITY_OPTIONS = [
  { value: '1.025', label: 'SW-1.025' },
  { value: '1.020', label: '1.020' },
  { value: '1.015', label: '1.015' },
  { value: '1.010', label: '1.010' },
  { value: '1.005', label: '1.005' },
  { value: '1.000', label: 'FW-1.000' },
];

/** 1 cubic metre ≈ 35.3147 cubic feet (PHP stowage Cu.M ↔ Cu.Ft). */
export const CU_M_TO_CU_FT = 35.3147;

function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Number(num(value).toFixed(2));
}

export function cuMToCuFt(cuM) {
  const n = num(cuM);
  if (!(n > 0)) return '';
  return round2(n * CU_M_TO_CU_FT).toFixed(2);
}

export function cuFtToCuM(cuFt) {
  const n = num(cuFt);
  if (!(n > 0)) return '';
  return round2(n / CU_M_TO_CU_FT).toFixed(2);
}

/**
 * @param {object} input
 * @param {'draft'|'stowage'} input.mode
 * @returns {{ draftM: string, observedDraft: string, observedDwt: string, cargoLoadable: string }}
 */
export function computeCargoLoadable(input = {}) {
  const portMaxDraft = num(input.portMaxDraft);
  const summerDraft = num(input.summerDraft);
  const summerDwt = num(input.summerDwt);
  const tpc = num(input.tpc);
  const constantMt = num(input.constantMt);
  const bunkersMt = num(input.bunkersMt);
  const fwMt = num(input.fwMt);
  const cubicCap = num(input.cubicCap);
  const stowageCuM = num(input.stowageCuM);
  const waterDensity = num(input.waterDensity) || 1.025;

  const limitingDraft = portMaxDraft > 0 && summerDraft > 0
    ? Math.min(portMaxDraft, summerDraft)
    : (portMaxDraft || summerDraft || 0);
  const draftM = limitingDraft ? String(round2(limitingDraft)) : '0.00';
  const observedDraft = draftM;

  if (input.mode === 'stowage') {
    const cargoLoadable = stowageCuM > 0 ? round2(cubicCap / stowageCuM) : 0;
    const observedDwt = round2(cargoLoadable + constantMt + bunkersMt + fwMt);
    return {
      draftM,
      observedDraft,
      observedDwt: Number.isFinite(observedDwt) ? observedDwt.toFixed(2) : '0.00',
      cargoLoadable: Number.isFinite(cargoLoadable) && cargoLoadable > 0
        ? cargoLoadable.toFixed(2)
        : '0.00',
    };
  }

  // Via Draft (PHP default)
  let sinkage = summerDraft;
  let sinkageBi = portMaxDraft;
  if (portMaxDraft > 0 && summerDraft > 0 && portMaxDraft < summerDraft) {
    sinkage = portMaxDraft;
    sinkageBi = summerDraft;
  }
  const sinkageThus = (sinkageBi - sinkage) * 100;
  const ttlLessCargo = tpc * sinkageThus;

  let cargoLoadable;
  let observedDwt;
  if (Math.abs(waterDensity - 1.025) < 0.0001) {
    cargoLoadable = summerDwt - constantMt - bunkersMt - fwMt - ttlLessCargo;
    observedDwt = summerDwt - ttlLessCargo;
  } else {
    const mul = waterDensity / 1.025;
    cargoLoadable = (summerDwt - constantMt - bunkersMt - fwMt - ttlLessCargo) * mul;
    observedDwt = (summerDwt - ttlLessCargo) * mul;
  }

  return {
    draftM,
    observedDraft,
    observedDwt: Number.isFinite(observedDwt) ? round2(observedDwt).toFixed(2) : '0.00',
    cargoLoadable: Number.isFinite(cargoLoadable) ? round2(cargoLoadable).toFixed(2) : '0.00',
  };
}

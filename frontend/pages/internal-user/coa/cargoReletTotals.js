function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return num(value).toFixed(2);
}

/**
 * Commercial totals for COA cargo relet (IN vs OUT).
 * Mirrors php/addcoacargorelet.php getCalculation().
 */
export function calcCargoReletTotals(form) {
  const qty = num(form.cargoQty);

  const freightAmt = qty * num(form.freightUsd);
  const addCommAmt = (freightAmt * num(form.addCom)) / 100;
  const brokerageAmt = (freightAmt * num(form.brokerage)) / 100;
  const bunkerSurchargeAmt = qty
    * (num(form.currentFoPrice) - num(form.contractFoPrice))
    * num(form.bafUsd);
  const totalAmt = freightAmt
    + bunkerSurchargeAmt
    - addCommAmt
    - brokerageAmt
    + num(form.demmurageAmt)
    - num(form.despatchAmt);

  const freightAmtOut = qty * num(form.freightUsdOut);
  const addCommAmtOut = (freightAmtOut * num(form.addComOut)) / 100;
  const brokerageAmtOut = (freightAmtOut * num(form.brokerageOut)) / 100;
  const totalAmtOut = freightAmtOut
    - addCommAmtOut
    - brokerageAmtOut
    + num(form.demmurageAmtOut)
    - num(form.despatchAmtOut);

  return {
    freightAmt: money(freightAmt),
    addCommAmt: money(addCommAmt),
    brokerageAmt: money(brokerageAmt),
    bunkerSurchargeAmt: money(bunkerSurchargeAmt),
    totalAmt: money(totalAmt),
    freightAmtOut: money(freightAmtOut),
    addCommAmtOut: money(addCommAmtOut),
    brokerageAmtOut: money(brokerageAmtOut),
    totalAmtOut: money(totalAmtOut),
    profit: money(totalAmt - totalAmtOut),
  };
}

/**
 * Planned cargo intake — php/addcoacargorelet.php getIntakeCalculation().
 */
export function calcCargoIntake(form) {
  const allowedDraftM = num(form.allowedDraftM);
  if (!allowedDraftM) {
    return {
      cargoIntakeMt: '0',
      cargoQty: form.plannedCargoQty || form.cargoQty || '',
    };
  }
  const draftDiffMt = (num(form.summerDraftM) - allowedDraftM) * 100;
  const dwtDiffMt = draftDiffMt * num(form.tpcMt);
  const intake = num(form.summerDwtMt)
    - dwtDiffMt
    - num(form.bunkerRobMt)
    - num(form.constantsMt);
  const cargoIntakeMt = Number.isFinite(intake) ? intake.toFixed(4) : '0';
  return { cargoIntakeMt, cargoQty: cargoIntakeMt };
}

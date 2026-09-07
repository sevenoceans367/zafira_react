function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return num(value).toFixed(2);
}

/**
 * Standalone Cargo Relet live calc — mirrors php/New_Standalone_Cargo_Relet.html.
 * Bunker Diff / Bnkr Surcharge / Effective Frt are $/MT; Gross/Nett are amounts.
 */
export function calcStandaloneCargoReletTotals(form) {
  const qty = num(form.cargoQty);
  const bunkerDiff = num(form.currentFoPrice) - num(form.contractFoPrice);

  const bunkerSurIn = bunkerDiff * num(form.bafUsd);
  const effFrtIn = num(form.freightUsd) + bunkerSurIn;
  const grossRev = qty * effFrtIn;
  const ttlComm = grossRev * ((num(form.addCom) + num(form.brokerage)) / 100);
  const nettRev = grossRev - ttlComm;

  const bunkerSurOut = bunkerDiff * num(form.bafUsdOut);
  const effFrtOut = num(form.freightUsdOut) + bunkerSurOut;
  const grossExp = qty * effFrtOut;
  const addCommAmtOut = grossExp * (num(form.addComOut) / 100);
  const brokerageAmtOut = grossExp * (num(form.brokerageOut) / 100);
  const nettExp = grossExp - addCommAmtOut - brokerageAmtOut;

  return {
    bunkerDiff: money(bunkerDiff),
    bunkerSurchargeAmt: money(bunkerSurIn),
    effectiveFrt: money(effFrtIn),
    freightAmt: money(grossRev),
    addCommAmt: money(ttlComm),
    brokerageAmt: money(0),
    totalAmt: money(nettRev),
    bunkerSurchargeAmtOut: money(bunkerSurOut),
    effectiveFrtOut: money(effFrtOut),
    freightAmtOut: money(grossExp),
    addCommAmtOut: money(addCommAmtOut),
    brokerageAmtOut: money(brokerageAmtOut),
    totalAmtOut: money(nettExp),
    profit: money(nettRev - nettExp),
  };
}

/**
 * Commercial totals for COA cargo relet (IN vs OUT).
 * Mirrors php/addcoacargorelet.php getCalculation().
 * Pass `{ standalone: true }` for the New Standalone Cargo Relet model.
 */
export function calcCargoReletTotals(form, options = {}) {
  if (options.standalone) return calcStandaloneCargoReletTotals(form);

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

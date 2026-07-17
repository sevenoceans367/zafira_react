function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Commercial totals for COA cargo relet (IN vs OUT).
 * Profit = total IN − total OUT.
 */
export function calcCargoReletTotals(form) {
  const freightAmt = num(form.cargoQty) * num(form.freightUsd);
  const freightAmtOut = num(form.cargoQty) * num(form.freightUsdOut);
  const bunker = num(form.bunkerSurchargeAmt);
  const bunkerOut = num(form.bunkerSurchargeAmtOut);
  const totalIn = freightAmt + bunker + num(form.demmurageAmt) - num(form.despatchAmt)
    - num(form.addCommAmt) - num(form.brokerageAmt);
  const totalOut = freightAmtOut + bunkerOut + num(form.demmurageAmtOut) - num(form.despatchAmtOut)
    - num(form.addCommAmtOut) - num(form.brokerageAmtOut);
  return {
    freightAmt: freightAmt ? freightAmt.toFixed(2) : form.freightAmt || '',
    freightAmtOut: freightAmtOut ? freightAmtOut.toFixed(2) : form.freightAmtOut || '',
    totalAmt: totalIn ? totalIn.toFixed(2) : form.totalAmt || '',
    totalAmtOut: totalOut ? totalOut.toFixed(2) : form.totalAmtOut || '',
    profit: (totalIn - totalOut).toFixed(2),
  };
}

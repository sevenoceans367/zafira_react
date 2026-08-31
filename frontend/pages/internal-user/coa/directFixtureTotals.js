function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return num(value).toFixed(2);
}

/**
 * Single-leg Direct Fixture totals (mockup New_Direct_Fixture.html).
 * Bnkr Surcharge = FO Price × BAF (product, not a cargo-relet FO diff).
 * Nett Revenue = Gross Revenue − Ttl Comm (no counter-leg Profit/Loss).
 */
export function calcDirectFixtureTotals(form = {}) {
  const qty = num(form.cargoQty);
  const frtRate = num(form.freightUsd);
  const baf = num(form.bafUsd);
  const foPrice = num(form.foPrice);
  const addCommPct = num(form.addCom);
  const brokeragePct = num(form.brokerage);

  const bunkerSurchargePerMt = foPrice * baf;
  const effectiveFrt = frtRate + bunkerSurchargePerMt;
  const grossRevenue = qty * effectiveFrt;
  const ttlComm = grossRevenue * ((addCommPct + brokeragePct) / 100);
  const nettRevenue = grossRevenue - ttlComm;

  return {
    bunkerSurchargePerMt: money(bunkerSurchargePerMt),
    effectiveFrt: money(effectiveFrt),
    grossRevenue: money(grossRevenue),
    ttlComm: money(ttlComm),
    nettRevenue: money(nettRevenue),
  };
}

import React from 'react';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import { sanitizeFieldDecimal, ESTIMATE_DECIMAL_FIELDS } from './estimateInputSanitize.js';
import styles from './UpdateEstimatePage.module.css';

function formatResult(value, empty = false) {
  if (empty) return '—';
  const text = value == null || value === '' ? '0.00' : String(value);
  return text;
}

function Row({ label, value, accent, empty = false, sub = false }) {
  return (
    <div className={`${styles.rrow} ${sub ? styles.rrowSub : ''}`}>
      <span className={`${styles.rl} ${accent ? styles.resultAccent : ''}`}>{label}</span>
      <span className={`${styles.rv} ${styles.rvNotch} ${accent ? styles.rvHl : ''}`}>
        {formatResult(value, empty)}
      </span>
    </div>
  );
}

function parseBunkerPrice(value) {
  const n = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function hasBunkerGradePrice(bunkerSummaryRows, grade) {
  const row = (bunkerSummaryRows || []).find((item) => item.grade === grade);
  return parseBunkerPrice(row?.price) > 0;
}

function hasAnyBunkerGradePrice(bunkerSummaryRows) {
  return (bunkerSummaryRows || []).some((row) => parseBunkerPrice(row.price) > 0);
}

function joinPenalty(penalty, perMt) {
  const left = penalty == null || penalty === '' ? '0.00' : String(penalty);
  const right = perMt == null || perMt === '' ? '0' : String(perMt);
  return `${left} / ${right}`;
}

export default function EstimateResultsPanels({
  form,
  bunkerSummaryRows = [],
  readOnly = false,
  complianceYear = new Date().getFullYear(),
  onFieldChange,
  onRecalc,
  round = true,
}) {
  const editable = !readOnly;

  const setField = (key, value) => {
    const next = ESTIMATE_DECIMAL_FIELDS.has(key)
      ? sanitizeFieldDecimal(key, value)
      : value;
    if (onRecalc) onRecalc(key, next);
    else onFieldChange?.(key, next);
  };

  const hsfoPriced = hasBunkerGradePrice(bunkerSummaryRows, 'HSFO');
  const vlsfoPriced = hasBunkerGradePrice(bunkerSummaryRows, 'VLSFO');
  const lsmgoPriced = hasBunkerGradePrice(bunkerSummaryRows, 'LSMGO');
  const showBunkerTotalCost = hasAnyBunkerGradePrice(bunkerSummaryRows);

  return (
    <>
      <CollapsiblePanel title="Freight Results" defaultOpen round={round} className={styles.panelInverse}>
        <div className={styles.rcardBody}>
          <Row label="Demurrage Revenue" value={form.demurrageRevenue} />
          <Row label="Revenue (Final Net Freight)" value={form.revenue} />
          <Row label="Operational Expenses" value={form.operationalExpenses} />
          <Row label="Port Expenses" value={form.totalPortCost} />
          <Row label="Bunker Expenses" value={form.totalBunkerCost} />
          <Row label="Net Daily TCE" value={form.nettDailyTce} accent />
          <Row label="Voyage Earnings" value={form.voyageEarnings} />
          <Row label="Net Hireage" value={form.netHireage} />
          <Row label="P&L" value={form.profitLoss} accent />

          <div className={styles.distDaysGrid}>
            <div className={styles.distDaysCol}>
              <div className={styles.distDaysColHead}>Distance</div>
              <Row sub label="Total Dist" value={form.totalDistance || '0.00'} />
              <Row sub label="Ballast Dist" value={form.ballastDist || '0.00'} />
              <Row sub label="Laden Dist" value={form.ladenDist || '0.00'} />
            </div>
            <div className={styles.distDaysCol}>
              <div className={styles.distDaysColHead}>Days</div>
              <Row sub label="Total Days" value={form.totalDays || '0.00'} />
              <Row sub label="Total Sea Days" value={form.totalSeaDays || '0.000'} />
              <Row sub label="Ballast Days" value={form.ballastDays || '0.000'} />
              <Row sub label="Laden Days" value={form.ladenDays || '0.000'} />
              <Row sub label="Total Portstay Days" value={form.portStayDays || '0.000'} />
              <Row sub label="Total Port Idle Days" value={form.portIdleDays || '0.000'} />
            </div>
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Bunker Results" defaultOpen={false} round={round} className={styles.panelInverse}>
        <div className={styles.rcardBody}>
          <Row label="Total HSFO (MT)" value={form.hsfoMt} empty={!hsfoPriced} />
          <Row label="EU ETS/Fuel EU HSFO (MT)" value={form.etsHsfoMt} empty={!hsfoPriced} />
          <Row label="Total VLSFO (MT)" value={form.vlsfoMt} empty={!vlsfoPriced} />
          <Row label="EU ETS/Fuel EU VLSFO (MT)" value={form.etsVlsfoMt} empty={!vlsfoPriced} />
          <Row label="Total LSMGO (MT)" value={form.lsmgoMt} empty={!lsmgoPriced} />
          <Row label="EU ETS/Fuel EU LSMGO (MT)" value={form.etsLsmgoMt} empty={!lsmgoPriced} />
          <Row
            label="Total Cost"
            value={form.bunkerResultsCost}
            accent
            empty={!showBunkerTotalCost}
          />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Compliance Results"
        defaultOpen={false}
        round={round}
        className={`${styles.panelInverse} ${styles.compliancePanel}`}
      >
        {editable ? (
          <div className={styles.complInputs}>
            <div className={styles.field}>
              <label htmlFor="co2Price">CO2 Price / MT</label>
              <input
                id="co2Price"
                value={form.co2Price || ''}
                readOnly={readOnly}
                placeholder="0.00"
                onChange={(e) => setField('co2Price', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="euaPrice">EUA Price / MT</label>
              <input
                id="euaPrice"
                value={form.euaPrice || ''}
                readOnly={readOnly}
                placeholder="0.00"
                onChange={(e) => setField('euaPrice', e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className={styles.complInputs}>
            <Row label="CO2 Price / MT" value={form.co2Price || '0.00'} />
            <Row label="EUA Price / MT" value={form.euaPrice || '0.00'} />
          </div>
        )}

        <div className={`${styles.complBand} ${styles.complBandEts}`}>
          <div className={styles.complBandTitle}>EU ETS</div>
          <Row label="EEOI (gCO2 / tnm)" value={form.eeoi} />
          <Row label="CII (gCO2 / dwtnm)" value={form.cii} />
          <Row label="EEOI (CO2MT)" value={form.eeoiCo2} />
          <Row label="Total CO2 (MT)" value={form.co2mt} />
          <Row label="Total CO2 Cost" value={form.co2Cost} />
          <Row label={`EUA CO2 ${complianceYear} (MT)`} value={form.euaCo2mt} />
          <Row label={`EUA CO2 ${complianceYear} Cost`} value={form.euaCo2Usd} />
          {editable ? (
            <label className={styles.complToggle}>
              <span className={styles.complToggleSwitch}>
                <input
                  type="checkbox"
                  checked={!!form.euEtsAddToFreight}
                  onChange={(e) => setField('euEtsAddToFreight', e.target.checked)}
                />
                <span className={styles.complToggleSlider} aria-hidden />
              </span>
              Add to freight cost
            </label>
          ) : null}
        </div>

        <div className={`${styles.complBand} ${styles.complBandFueleu}`}>
          <div className={styles.complBandTitle}>Fuel EU</div>
          <Row label={`HSFO GHG Intensity ${complianceYear} (gCO2eq/MJ)`} value={form.hsfoIntensity} />
          <Row label={`Target ${complianceYear}`} value={form.hsfoTarget} />
          <Row label={`VLSFO GHG Intensity ${complianceYear} (gCO2eq/MJ)`} value={form.vlsfoIntensity} />
          <Row label={`Target ${complianceYear}`} value={form.vlsfoTarget} />
          <Row label={`LSMGO GHG Intensity ${complianceYear} (gCO2eq/MJ)`} value={form.lsmgoIntensity} />
          <Row label={`Target ${complianceYear}`} value={form.lsmgoTarget} />
          <Row label="HSFO Penalty / Per MT" value={joinPenalty(form.hsfoPenalty, form.hsfoPenaltyPerMt)} />
          <Row label="VLSFO Penalty / Per MT" value={joinPenalty(form.vlsfoPenalty, form.vlsfoPenaltyPerMt)} />
          <Row label="LSMGO Penalty / Per MT" value={joinPenalty(form.lsmgoPenalty, form.lsmgoPenaltyPerMt)} />
          <Row label="Total Carbon Cost" value={form.totalCarbonCost} accent />
          {editable ? (
            <label className={styles.complToggle}>
              <span className={styles.complToggleSwitch}>
                <input
                  type="checkbox"
                  checked={!!form.fuelEuAddToFreight}
                  onChange={(e) => setField('fuelEuAddToFreight', e.target.checked)}
                />
                <span className={styles.complToggleSlider} aria-hidden />
              </span>
              Add to freight cost
            </label>
          ) : null}
        </div>
      </CollapsiblePanel>
    </>
  );
}

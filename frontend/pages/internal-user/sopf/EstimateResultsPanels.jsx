import React from 'react';
import { Button } from '@bainbridge/shared-ui';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import { sanitizeFieldDecimal, ESTIMATE_DECIMAL_FIELDS } from './estimateInputSanitize.js';
import styles from './UpdateEstimatePage.module.css';

function Row({ label, value, accent }) {
  return (
    <div className={styles.resultCell}>
      <span className={accent ? styles.resultAccent : undefined}>{label}</span>
      <input value={value || '0.00'} readOnly />
    </div>
  );
}

export default function EstimateResultsPanels({
  form,
  readOnly = false,
  complianceYear = new Date().getFullYear(),
  onFieldChange,
  onRecalc,
}) {
  const editable = !readOnly;

  const setField = (key, value) => {
    const next = ESTIMATE_DECIMAL_FIELDS.has(key)
      ? sanitizeFieldDecimal(key, value)
      : value;
    if (onRecalc) onRecalc(key, next);
    else onFieldChange?.(key, next);
  };

  return (
    <>
      <CollapsiblePanel title="Freight Results" defaultOpen className={styles.panelInverse}>
        <div className={styles.resultsGrid}>
          <Row label="Demurrage Revenue" value={form.demurrageRevenue} />
          <Row label="Revenue (Final Net Freight)" value={form.revenue} />
          <Row label="Operational Expenses" value={form.operationalExpenses} />
          <Row label="Port Expenses" value={form.totalPortCost} />
          <Row label="Bunker Expenses" value={form.totalBunkerCost} />
          <Row label="Net Daily TCE" value={form.nettDailyTce} accent />
          <Row label="Voyage Earnings" value={form.voyageEarnings} />
          <Row label="Net Hireage" value={form.netHireage} />
          <Row label="P&L" value={form.profitLoss} accent />
        </div>

        <div className={styles.distDaysGrid}>
          <div className={styles.distDaysCol}>
            <div><span>Total Dist</span><strong>{form.totalDistance || '0.00'}</strong></div>
            <div><span>Ballast Dist</span><strong>{form.ballastDist || '0.00'}</strong></div>
            <div><span>Laden Dist</span><strong>{form.ladenDist || '0.00'}</strong></div>
          </div>
          <div className={styles.distDaysCol}>
            <div><span>Total Days</span><strong>{form.totalDays || '0.00'}</strong></div>
            <div><span>Total Sea Days</span><strong>{form.totalSeaDays || '0.000'}</strong></div>
            <div><span>Ballast Days</span><strong>{form.ballastDays || '0.000'}</strong></div>
            <div><span>Laden Days</span><strong>{form.ladenDays || '0.000'}</strong></div>
            <div><span>Total Portstay Days</span><strong>{form.portStayDays || '0.000'}</strong></div>
            <div><span>Total Port Idle Days</span><strong>{form.portIdleDays || '0.000'}</strong></div>
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Bunker Results" defaultOpen={false} className={styles.panelInverse}>
        <div className={styles.resultsGrid}>
          <Row label="Total HSFO (MT)" value={form.hsfoMt} />
          <Row label="EU ETS/Fuel EU HSFO (MT)" value={form.etsHsfoMt} />
          <Row label="Total VLSFO (MT)" value={form.vlsfoMt} />
          <Row label="EU ETS/Fuel EU VLSFO (MT)" value={form.etsVlsfoMt} />
          <Row label="Total LSMGO (MT)" value={form.lsmgoMt} />
          <Row label="EU ETS/Fuel EU LSMGO (MT)" value={form.etsLsmgoMt} />
          <Row label="Total Cost" value={form.bunkerResultsCost} accent />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Compliance Results"
        defaultOpen={false}
        className={`${styles.panelInverse} ${styles.compliancePanel}`}
      >
        {editable ? (
          <div className={styles.compliancePriceRow}>
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
            <Button
              type="button"
              variant="sensitivity"
              size="sm"
              label="Run"
              className={styles.complianceRunBtn}
              onClick={() => onRecalc?.()}
            />
          </div>
        ) : (
          <div className={styles.distGrid} style={{ marginBottom: 12 }}>
            <div><span>CO2 Price</span><strong>{form.co2Price || '0.00'}</strong></div>
            <div><span>EUA Price</span><strong>{form.euaPrice || '0.00'}</strong></div>
          </div>
        )}

        <h4 className={styles.subHeading}>EU ETS</h4>
        <div className={styles.resultsGrid}>
          <Row label="EEOI (gCO2 / tnm)" value={form.eeoi} />
          <Row label="CII (gCO2 / dwtnm)" value={form.cii} />
          <Row label="EEOI CO2(MT)" value={form.eeoiCo2} />
          <Row label="Total CO2(MT)" value={form.co2mt} />
          <Row label="Total CO2 Cost" value={form.co2Cost} />
          <Row label={`EUA CO2 ${complianceYear}(MT)`} value={form.euaCo2mt} />
          <Row label={`EUA CO2 ${complianceYear} Cost`} value={form.euaCo2Usd} />
        </div>
        {editable ? (
          <label className={styles.checkRow}>
            Add to freight cost
            <input
              type="checkbox"
              checked={!!form.euEtsAddToFreight}
              onChange={(e) => setField('euEtsAddToFreight', e.target.checked)}
            />
          </label>
        ) : null}

        <h4 className={styles.subHeading}>Fuel EU</h4>
        <div className={styles.resultsGrid}>
          <Row label={`HSFO GHG Intensity ${complianceYear}(gCO2eq/MJ)`} value={form.hsfoIntensity} />
          <Row label={`Target ${complianceYear}`} value={form.hsfoTarget} />
          <Row label={`VLSFO GHG Intensity ${complianceYear}(gCO2eq/MJ)`} value={form.vlsfoIntensity} />
          <Row label={`Target ${complianceYear}`} value={form.vlsfoTarget} />
          <Row label={`LSMGO GHG Intensity ${complianceYear}(gCO2eq/MJ)`} value={form.lsmgoIntensity} />
          <Row label={`Target ${complianceYear}`} value={form.lsmgoTarget} />
          <Row label="HSFO Penalty" value={form.hsfoPenalty} />
          <Row label="Per MT" value={form.hsfoPenaltyPerMt} />
          <Row label="VLSFO Penalty" value={form.vlsfoPenalty} />
          <Row label="Per MT" value={form.vlsfoPenaltyPerMt} />
          <Row label="LSMGO Penalty" value={form.lsmgoPenalty} />
          <Row label="Per MT" value={form.lsmgoPenaltyPerMt} />
          <Row label="Total Carbon cost" value={form.totalCarbonCost} accent />
        </div>
        {editable ? (
          <label className={styles.checkRow}>
            Add to freight cost
            <input
              type="checkbox"
              checked={!!form.fuelEuAddToFreight}
              onChange={(e) => setField('fuelEuAddToFreight', e.target.checked)}
            />
          </label>
        ) : null}
      </CollapsiblePanel>
    </>
  );
}

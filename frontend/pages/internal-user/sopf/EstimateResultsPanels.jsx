import React from 'react';
import { Button } from '@bainbridge/shared-ui';
import CollapsiblePanel from './CollapsiblePanel.jsx';
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
    if (onRecalc) onRecalc(key, value);
    else onFieldChange?.(key, value);
  };

  return (
    <>
      <CollapsiblePanel title="CO₂ / EUA Prices" defaultOpen>
        <div className={styles.headerGrid}>
          <div className={styles.field}>
            <label htmlFor="co2Price">CO2 Price ($/MT)</label>
            <input
              id="co2Price"
              value={form.co2Price || ''}
              readOnly={readOnly}
              placeholder="0.00"
              onChange={(e) => setField('co2Price', e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="euaPrice">EUA Price ($/MT)</label>
            <input
              id="euaPrice"
              value={form.euaPrice || ''}
              readOnly={readOnly}
              placeholder="0.00"
              onChange={(e) => setField('euaPrice', e.target.value)}
            />
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Results" defaultOpen>
        <div className={styles.resultsGrid}>
          <Row label="Demurrage Revenue" value={form.demurrageRevenue} />
          <Row label="Revenue (Final Nett Freight)" value={form.revenue} />
          <Row label="Operational Expenses" value={form.operationalExpenses} />
          <Row label="Port Expenses" value={form.totalPortCost} />
          <Row label="Bunker Expenses" value={form.totalBunkerCost} />
          <Row label="Nett Daily TCE" value={form.nettDailyTce} accent />
          <Row label="Voyage Earnings" value={form.voyageEarnings} />
          <Row label="Net Hireage" value={form.netHireage} />
          <Row label="P/L" value={form.profitLoss} />
        </div>

        <div className={styles.distGrid}>
          <div><span>Laden Dist</span><strong>{form.ladenDist || '0'}</strong></div>
          <div><span>Ballast Dist</span><strong>{form.ballastDist || '0'}</strong></div>
          <div><span>Total Dist</span><strong>{form.totalDistance || '0'}</strong></div>
          <div><span>Laden Days</span><strong>{form.ladenDays || '0.000'}</strong></div>
          <div><span>Ballast Days</span><strong>{form.ballastDays || '0.000'}</strong></div>
          <div><span>Total Sea Days</span><strong>{form.totalSeaDays || '0.000'}</strong></div>
          <div><span>Ttl Port Idle Days</span><strong>{form.portIdleDays || '0'}</strong></div>
          <div><span>Ttl Portstay Days</span><strong>{form.portStayDays || '0'}</strong></div>
          <div><span>Total Days</span><strong>{form.totalDays || '0.00'}</strong></div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Bunker Results">
        <div className={styles.resultsGrid}>
          <Row label="Total HSFO (MT)" value={form.hsfoMt} />
          <Row label="EU ETS/Fuel EU HSFO (MT)" value={form.etsHsfoMt} />
          <Row label="Total VLSFO (MT)" value={form.vlsfoMt} />
          <Row label="EU ETS/Fuel EU VLSFO (MT)" value={form.etsVlsfoMt} />
          <Row label="Total LSMGO (MT)" value={form.lsmgoMt} />
          <Row label="EU ETS/Fuel EU LSMGO (MT)" value={form.etsLsmgoMt} />
          <Row label="Total Cost (USD)" value={form.bunkerResultsCost} accent />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Compliance Results">
        <h4 className={styles.subHeading}>EU ETS</h4>
        <div className={styles.resultsGrid}>
          <Row label="EEOI (gCO2 / tnm)" value={form.eeoi} />
          <Row label="CII (gCO2 / dwtnm)" value={form.cii} />
          <Row label="EEOI CO2(MT)" value={form.eeoiCo2} />
          <Row label="Total CO2(MT)" value={form.co2mt} />
          <Row label="Total CO2 Cost(USD)" value={form.co2Cost} />
          <Row label={`EUA CO2 ${complianceYear}(MT)`} value={form.euaCo2mt} />
          <Row label={`EUA CO2 ${complianceYear} Cost(USD)`} value={form.euaCo2Usd} />
        </div>
        {editable ? (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!form.euEtsAddToFreight}
              onChange={(e) => setField('euEtsAddToFreight', e.target.checked)}
            />
            Add to freight cost
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
          <Row label="HSFO Penalty ($)" value={form.hsfoPenalty} />
          <Row label="$/MT" value={form.hsfoPenaltyPerMt} />
          <Row label="VLSFO Penalty ($)" value={form.vlsfoPenalty} />
          <Row label="$/MT" value={form.vlsfoPenaltyPerMt} />
          <Row label="LSMGO Penalty ($)" value={form.lsmgoPenalty} />
          <Row label="$/MT" value={form.lsmgoPenaltyPerMt} />
          <Row label="Total Carbon cost" value={form.totalCarbonCost} accent />
        </div>
        {editable ? (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!form.fuelEuAddToFreight}
              onChange={(e) => setField('fuelEuAddToFreight', e.target.checked)}
            />
            Add to freight cost
          </label>
        ) : null}

        {editable ? (
          <div className={styles.recalcBar}>
            <Button type="button" variant="outline" label="Recalculate" onClick={() => onRecalc?.()} />
          </div>
        ) : null}
      </CollapsiblePanel>
    </>
  );
}

import React from 'react';
import { Button, DmyDateInput } from '@bainbridge/shared-ui';
import PortSearchSelect from '../period-contract/PortSearchSelect.jsx';
import VesselSearchSelect from './VesselSearchSelect.jsx';
import {
  BUNKER_IDENTIFY_OPTIONS,
  FIXTURE_TYPE_OPTIONS,
  PASSAGE_TYPE_OPTIONS,
  SPEED_TYPE_OPTIONS,
  createEmptyBunkerRow,
  createEmptyCargoRow,
  createEmptyPortLeg,
  getFixtureTypeLabel,
} from './estimateDetail.constants.js';
import styles from './UpdateEstimatePage.module.css';

function Field({ id, label, children }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export default function EstimateDetailSections({
  detail,
  form,
  readOnly = false,
  isAdd = false,
  lookups = { cargos: [], bunkerGrades: [] },
  onFieldChange,
  onVesselSelect,
  onRecalc,
}) {
  const estimateType = Number(detail?.estimateType) || 2;
  const showLumpsum = estimateType !== 3;
  const editable = !readOnly;

  const updateField = (key, value) => {
    onFieldChange?.(key, value);
  };

  const updateRow = (collection, id, patch) => {
    const rows = (form[collection] || []).map((row) => (
      row.id === id ? { ...row, ...patch } : row
    ));
    if (onRecalc) {
      onRecalc(collection, rows);
    } else {
      updateField(collection, rows);
    }
  };

  const addRow = (collection, factory) => {
    updateField(collection, [...(form[collection] || []), factory()]);
  };

  const removeRow = (collection, id) => {
    const rows = (form[collection] || []).filter((row) => row.id !== id);
    if (!rows.length) return;
    if (onRecalc) {
      onRecalc(collection, rows);
    } else {
      updateField(collection, rows);
    }
  };

  const handleVoyageNoChange = (value) => {
    updateField('voyageNo', value);
    if (isAdd) updateField('voyageName', value);
  };

  const inputProps = (key, opts = {}) => ({
    id: key,
    value: form[key] ?? '',
    readOnly: opts.readOnly ?? readOnly,
    onChange: (event) => {
      const value = event.target.value;
      if (opts.recalc && onRecalc) {
        onRecalc(key, value);
      } else {
        updateField(key, value);
      }
    },
  });

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>Estimate Header</div>
        <div className={styles.panelBody}>
          <div className={styles.headerGrid}>
            <Field id="fixtureTypeId" label="Business Type">
              {readOnly ? (
                <input id="fixtureTypeId" value={getFixtureTypeLabel(form.fixtureTypeId)} readOnly />
              ) : (
                <select
                  id="fixtureTypeId"
                  value={form.fixtureTypeId}
                  onChange={(e) => updateField('fixtureTypeId', e.target.value)}
                >
                  <option value="">Select from list</option>
                  {FIXTURE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              )}
            </Field>

            <Field id="vesselName" label="Vessel">
              {isAdd ? (
                <VesselSearchSelect
                  value={form.vesselImoId}
                  label={form.vesselName}
                  onSelect={onVesselSelect}
                />
              ) : (
                <input id="vesselName" value={form.vesselName} readOnly />
              )}
            </Field>

            <Field id="vesselType" label="Vessel Type">
              <input {...inputProps('vesselType')} />
            </Field>
            <Field id="flag" label="Flag">
              <input id="flag" value={form.flag} readOnly />
            </Field>
            <Field id="transDate" label="CP Date">
              {readOnly ? (
                <input id="transDate" value={form.transDate} readOnly />
              ) : (
                <DmyDateInput
                  id="transDate"
                  value={form.transDate}
                  onChange={(value) => updateField('transDate', value)}
                />
              )}
            </Field>
            <Field id="voyageNo" label="Voyage No.">
              <input
                id="voyageNo"
                value={form.voyageNo}
                readOnly={!isAdd}
                onChange={(e) => handleVoyageNoChange(e.target.value)}
              />
            </Field>
            <Field id="voyageName" label="Sheet Name">
              <input {...inputProps('voyageName')} />
            </Field>
            <Field id="estimateType" label="Estimate Type">
              <input id="estimateType" value={detail.estimateTypeLabel} readOnly />
            </Field>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>Vessel Particulars</div>
        <div className={styles.panelBody}>
          <div className={styles.headerGrid}>
            <Field id="dwtSummer" label="DWT (Summer)">
              <input {...inputProps('dwtSummer', { readOnly: readOnly || !isAdd })} />
            </Field>
            <Field id="dwtTropical" label="DWT (Tropical)">
              <input {...inputProps('dwtTropical')} />
            </Field>
            <Field id="gnrt" label="GRT">
              <input {...inputProps('gnrt')} />
            </Field>
            <Field id="nrt" label="NRT">
              <input
                id="nrt"
                value={form.gnrt ? (Number(form.gnrt) * 0.7).toFixed(2) : ''}
                readOnly
              />
            </Field>
            <Field id="loa" label="LOA">
              <input {...inputProps('loa', { readOnly: readOnly || !isAdd })} />
            </Field>
            <Field id="tpc" label="TPC">
              <input {...inputProps('tpc')} />
            </Field>
            <Field id="gear" label="Gear">
              <input {...inputProps('gear')} />
            </Field>
            <Field id="builtYear" label="Built Year">
              <input {...inputProps('builtYear')} />
            </Field>
            <Field id="beam" label="Beam">
              <input {...inputProps('beam')} />
            </Field>
            <Field id="loadable" label="Loadable">
              <input {...inputProps('loadable')} />
            </Field>
            <Field id="stowageFactor" label="Stowage Factor">
              <input {...inputProps('stowageFactor')} />
            </Field>
            <Field id="grainCap" label="Grain Cap">
              <input {...inputProps('grainCap')} />
            </Field>
            <Field id="baleCap" label="Bale Cap">
              <input {...inputProps('baleCap')} />
            </Field>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>Speed / Consumption</div>
        <div className={styles.panelBody}>
          <div className={styles.headerGrid}>
            <Field id="bFullSpeed" label="Ballast Full Speed">
              <input {...inputProps('bFullSpeed', { recalc: true })} />
            </Field>
            <Field id="bEcoSpeed1" label="Ballast Eco Speed">
              <input {...inputProps('bEcoSpeed1', { recalc: true })} />
            </Field>
            <Field id="lFullSpeed" label="Laden Full Speed">
              <input {...inputProps('lFullSpeed', { recalc: true })} />
            </Field>
            <Field id="lEcoSpeed1" label="Laden Eco Speed">
              <input {...inputProps('lEcoSpeed1', { recalc: true })} />
            </Field>
            <Field id="bFoFullSpeed" label="Ballast FO Cons (Full)">
              <input {...inputProps('bFoFullSpeed')} />
            </Field>
            <Field id="lFoFullSpeed" label="Laden FO Cons (Full)">
              <input {...inputProps('lFoFullSpeed')} />
            </Field>
            <Field id="bDoFullSpeed" label="Ballast DO Cons (Full)">
              <input {...inputProps('bDoFullSpeed')} />
            </Field>
            <Field id="lDoFullSpeed" label="Laden DO Cons (Full)">
              <input {...inputProps('lDoFullSpeed')} />
            </Field>
            <Field id="pIfoFullSpeed" label="In-Port Idle FO">
              <input {...inputProps('pIfoFullSpeed')} />
            </Field>
            <Field id="pWfoFullSpeed" label="In-Port Working FO">
              <input {...inputProps('pWfoFullSpeed')} />
            </Field>
            <Field id="pIdoFullSpeed" label="In-Port Idle DO">
              <input {...inputProps('pIdoFullSpeed')} />
            </Field>
            <Field id="pWdoFullSpeed" label="In-Port Working DO">
              <input {...inputProps('pWdoFullSpeed')} />
            </Field>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Cargo</span>
          {editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Cargo"
              onClick={() => addRow('cargoRows', createEmptyCargoRow)}
            />
          ) : null}
        </div>
        <div className={`${styles.panelBody} ${styles.tableWrap}`}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Cargo</th>
                <th>CBM</th>
                <th>MT</th>
                <th>Rate USD/MT</th>
                <th>Amount USD</th>
                <th>Charterer</th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.cargoRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    {readOnly ? (
                      row.cargoName || row.cargoId || '—'
                    ) : (
                      <select
                        value={row.cargoId}
                        onChange={(e) => {
                          const cargo = lookups.cargos.find((c) => String(c.id) === e.target.value);
                          updateRow('cargoRows', row.id, {
                            cargoId: e.target.value,
                            cargoName: cargo?.name || '',
                          });
                        }}
                      >
                        <option value="">Select cargo</option>
                        {lookups.cargos.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <input
                      value={row.cargoCbm}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('cargoRows', row.id, { cargoCbm: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.cargoMt}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('cargoRows', row.id, { cargoMt: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.rateUsdMt}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('cargoRows', row.id, { rateUsdMt: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.amountUsd}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('cargoRows', row.id, { amountUsd: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.charterer}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('cargoRows', row.id, { charterer: e.target.value })}
                    />
                  </td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        onClick={() => removeRow('cargoRows', row.id)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Port Route</span>
          {editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Leg"
              onClick={() => addRow('portLegs', createEmptyPortLeg)}
            />
          ) : null}
        </div>
        <div className={`${styles.panelBody} ${styles.tableWrap}`}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Passage</th>
                <th>Speed</th>
                <th>Distance</th>
                <th>Sea Days</th>
                <th>Load Qty</th>
                <th>Disc Qty</th>
                <th>LP Cost</th>
                <th>DP Cost</th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.portLegs || []).map((leg) => (
                <tr key={leg.id}>
                  <td>
                    {readOnly ? (
                      leg.fromPortName || leg.fromPortId || '—'
                    ) : (
                      <PortSearchSelect
                        value={leg.fromPortId}
                        label={leg.fromPortName}
                        onChange={(portId, portName) => {
                          updateRow('portLegs', leg.id, {
                            fromPortId: portId,
                            fromPortName: portName,
                          });
                        }}
                      />
                    )}
                  </td>
                  <td>
                    {readOnly ? (
                      leg.toPortName || leg.toPortId || '—'
                    ) : (
                      <PortSearchSelect
                        value={leg.toPortId}
                        label={leg.toPortName}
                        onChange={(portId, portName) => {
                          updateRow('portLegs', leg.id, {
                            toPortId: portId,
                            toPortName: portName,
                          });
                        }}
                      />
                    )}
                  </td>
                  <td>
                    <select
                      value={leg.passageType}
                      disabled={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { passageType: e.target.value })}
                    >
                      {PASSAGE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={leg.speedType}
                      disabled={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { speedType: e.target.value })}
                    >
                      {SPEED_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={leg.distance}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { distance: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.seaDays}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { seaDays: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.loadQty}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { loadQty: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.dischargeQty}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { dischargeQty: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.loadPortCost}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { loadPortCost: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.discPortCost}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { discPortCost: e.target.value })}
                    />
                  </td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        onClick={() => removeRow('portLegs', leg.id)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Bunkers</span>
          {editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Bunker"
              onClick={() => addRow('bunkerRows', () => createEmptyBunkerRow('CONSUMPTION'))}
            />
          ) : null}
        </div>
        <div className={`${styles.panelBody} ${styles.tableWrap}`}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Grade</th>
                <th>Qty (MT)</th>
                <th>Price</th>
                <th>Cost</th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.bunkerRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    <select
                      value={row.identify}
                      disabled={readOnly}
                      onChange={(e) => updateRow('bunkerRows', row.id, { identify: e.target.value })}
                    >
                      {BUNKER_IDENTIFY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {readOnly ? (
                      lookups.bunkerGrades.find((g) => String(g.id) === String(row.bunkerGradeId))?.name
                      || row.bunkerGradeId
                      || '—'
                    ) : (
                      <select
                        value={row.bunkerGradeId}
                        onChange={(e) => updateRow('bunkerRows', row.id, { bunkerGradeId: e.target.value })}
                      >
                        <option value="">Select grade</option>
                        {lookups.bunkerGrades.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <input
                      value={row.qty}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('bunkerRows', row.id, { qty: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.price}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('bunkerRows', row.id, { price: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={row.cost} readOnly />
                  </td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        onClick={() => removeRow('bunkerRows', row.id)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>Freight / Hire / Commissions</div>
        <div className={styles.panelBody}>
          <div className={styles.headerGrid}>
            {showLumpsum ? (
              <>
                <Field id="lumpsumQty" label="Lump Sum Qty">
                  <input {...inputProps('lumpsumQty', { recalc: true })} />
                </Field>
                <Field id="lumpsum" label="Lump Sum">
                  <input {...inputProps('lumpsum', { recalc: true })} />
                </Field>
              </>
            ) : null}
            <Field id="marketRate" label="Market / TCPD Rate">
              <input {...inputProps('marketRate')} />
            </Field>
            <Field id="freightGross" label="Gross Freight">
              <input {...inputProps('freightGross', { recalc: true })} />
            </Field>
            <Field id="brokeragePercent" label="Brokerage %">
              <input {...inputProps('brokeragePercent', { recalc: true })} />
            </Field>
            <Field id="brokerageAmt" label="Brokerage Amt">
              <input {...inputProps('brokerageAmt')} />
            </Field>
            <Field id="addCommPercent" label="Add Comm %">
              <input {...inputProps('addCommPercent')} />
            </Field>
            <Field id="hireRate" label="Hire Rate">
              <input
                {...inputProps('hireRate', {
                  recalc: true,
                  readOnly: readOnly || estimateType === 3,
                })}
              />
            </Field>
            <Field id="hireAmt" label="Hire Amt">
              <input {...inputProps('hireAmt')} />
            </Field>
            <Field id="cveAmt" label="CVE Amt">
              <input {...inputProps('cveAmt', { recalc: true })} />
            </Field>
            <Field id="ballastBonus" label="Ballast Bonus">
              <input {...inputProps('ballastBonus', { recalc: true })} />
            </Field>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>Voyage Financials : Results</div>
        <div className={styles.panelBody}>
          <div className={styles.metricsGrid}>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Total Distance</p>
              <p className={styles.metricValue}>{form.totalDistance || '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Duration (Days)</p>
              <p className={styles.metricValue}>{form.totalDays || '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Cargo Qty</p>
              <p className={styles.metricValue}>{form.cargoQuantity || '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Bunker Cost</p>
              <p className={styles.metricValue}>{form.totalBunkerCost || '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Port Cost</p>
              <p className={styles.metricValue}>{form.totalPortCost || '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Revenue</p>
              <p className={styles.metricValue}>{form.revenue || '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Voyage Earnings</p>
              <p className={styles.metricValue}>{form.voyageEarnings || '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>TCE / Day</p>
              <p className={styles.metricValue}>{form.dailyEarning || '—'}</p>
            </div>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>P/L</p>
              <p className={styles.metricValue}>{form.profitLoss || '—'}</p>
            </div>
          </div>
          {editable ? (
            <div className={styles.recalcBar}>
              <Button type="button" variant="outline" label="Recalculate" onClick={() => onRecalc?.()} />
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}


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
  createEmptyHireRow,
  createEmptyOrcRow,
  createEmptyOtherIncomeRow,
  createEmptyPortLeg,
  getFixtureTypeLabel,
} from './estimateDetail.constants.js';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import EstimateAdvancedSections from './EstimateAdvancedSections.jsx';
import EstimateResultsPanels from './EstimateResultsPanels.jsx';
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
    <div className={styles.estimateForm}>
      <div className={styles.estimateMain}>
<CollapsiblePanel title="Estimate Header" defaultOpen>
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
      </CollapsiblePanel>

<CollapsiblePanel title="Vessel Particulars" defaultOpen>
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
      </CollapsiblePanel>

<CollapsiblePanel
        title="Passage & Ports"
        defaultOpen
        actions={editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Leg"
              onClick={() => addRow('portLegs', createEmptyPortLeg)}
            />
          ) : null}
      >
        <div className={styles.tableWrap}>
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
                <th>Transit</th>
                <th>SECA Dist</th>
                <th>DDC LP</th>
                <th>DDC DP</th>
                <th>LP SECA</th>
                <th>DP SECA</th>
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
                  <td>
                    <input
                      value={leg.transitPortCost || ''}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { transitPortCost: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.secaDistance || ''}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { secaDistance: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.ddcLpEst || ''}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { ddcLpEst: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.ddcDpEst || ''}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { ddcDpEst: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!leg.chkLpSeca}
                      disabled={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { chkLpSeca: e.target.checked })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!leg.chkDpSeca}
                      disabled={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { chkDpSeca: e.target.checked })}
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
      </CollapsiblePanel>

<CollapsiblePanel title="Speed / Consumption">
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
      </CollapsiblePanel>

<CollapsiblePanel
        title="Cargo"
        defaultOpen
        actions={editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Cargo"
              onClick={() => addRow('cargoRows', createEmptyCargoRow)}
            />
          ) : null}
      >
        <div className={styles.tableWrap}>
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
      </CollapsiblePanel>

<CollapsiblePanel
        title="Overage Cargo"
        actions={editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Overage"
              onClick={() => addRow('overageCargoRows', () => createEmptyCargoRow(2))}
            />
          ) : null}
      >
        <div className={styles.tableWrap}>
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
              {(form.overageCargoRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    {readOnly ? (row.cargoName || row.cargoId || '—') : (
                      <select
                        value={row.cargoId}
                        onChange={(e) => {
                          const cargo = lookups.cargos.find((c) => String(c.id) === e.target.value);
                          updateRow('overageCargoRows', row.id, {
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
                    <input value={row.cargoCbm} readOnly={readOnly} onChange={(e) => updateRow('overageCargoRows', row.id, { cargoCbm: e.target.value })} />
                  </td>
                  <td>
                    <input value={row.cargoMt} readOnly={readOnly} onChange={(e) => updateRow('overageCargoRows', row.id, { cargoMt: e.target.value })} />
                  </td>
                  <td>
                    <input value={row.rateUsdMt} readOnly={readOnly} onChange={(e) => updateRow('overageCargoRows', row.id, { rateUsdMt: e.target.value })} />
                  </td>
                  <td>
                    <input value={row.amountUsd} readOnly={readOnly} onChange={(e) => updateRow('overageCargoRows', row.id, { amountUsd: e.target.value })} />
                  </td>
                  <td>
                    <input value={row.charterer} readOnly={readOnly} onChange={(e) => updateRow('overageCargoRows', row.id, { charterer: e.target.value })} />
                  </td>
                  {editable ? (
                    <td>
                      <button type="button" className={styles.rowRemove} onClick={() => removeRow('overageCargoRows', row.id)} title="Remove">×</button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

<CollapsiblePanel
        title="Deadfreight Cargo"
        actions={editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Deadfreight"
              onClick={() => addRow('deadfreightCargoRows', () => createEmptyCargoRow(3))}
            />
          ) : null}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Cargo</th>
                <th>CBM</th>
                <th>MT</th>
                <th>Rate USD/MT</th>
                <th>Amount USD</th>
                <th>Charterer</th>
                <th>Vendor</th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.deadfreightCargoRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    {readOnly ? (row.cargoName || row.cargoId || '—') : (
                      <select
                        value={row.cargoId}
                        onChange={(e) => {
                          const cargo = lookups.cargos.find((c) => String(c.id) === e.target.value);
                          updateRow('deadfreightCargoRows', row.id, {
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
                    <input value={row.cargoCbm} readOnly={readOnly} onChange={(e) => updateRow('deadfreightCargoRows', row.id, { cargoCbm: e.target.value })} />
                  </td>
                  <td>
                    <input value={row.cargoMt} readOnly={readOnly} onChange={(e) => updateRow('deadfreightCargoRows', row.id, { cargoMt: e.target.value })} />
                  </td>
                  <td>
                    <input value={row.rateUsdMt} readOnly={readOnly} onChange={(e) => updateRow('deadfreightCargoRows', row.id, { rateUsdMt: e.target.value })} />
                  </td>
                  <td>
                    <input value={row.amountUsd} readOnly={readOnly} onChange={(e) => updateRow('deadfreightCargoRows', row.id, { amountUsd: e.target.value })} />
                  </td>
                  <td>
                    <input value={row.charterer} readOnly={readOnly} onChange={(e) => updateRow('deadfreightCargoRows', row.id, { charterer: e.target.value })} />
                  </td>
                  <td>
                    <select
                      value={row.vendorId || ''}
                      disabled={readOnly}
                      onChange={(e) => updateRow('deadfreightCargoRows', row.id, { vendorId: e.target.value })}
                    >
                      <option value="">Select</option>
                      {(lookups.owners || []).map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </td>
                  {editable ? (
                    <td>
                      <button type="button" className={styles.rowRemove} onClick={() => removeRow('deadfreightCargoRows', row.id)} title="Remove">×</button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>


      <CollapsiblePanel title="Demurrage Dispatch" defaultOpen>
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Port Leg</th>
                <th>Load Est ($)</th>
                <th>Disc Est ($)</th>
              </tr>
            </thead>
            <tbody>
              {(form.portLegs || []).map((leg, index) => (
                <tr key={leg.id}>
                  <td>
                    {leg.fromPortName || 'From'}
                    {' → '}
                    {leg.toPortName || 'To'}
                    {index === 0 ? ' (LP/DP)' : ''}
                  </td>
                  <td>
                    <input
                      value={leg.ddcLpEst || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => updateRow('portLegs', leg.id, { ddcLpEst: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.ddcDpEst || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => updateRow('portLegs', leg.id, { ddcDpEst: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.headerGrid} style={{ marginTop: 8 }}>
          <Field id="demurrageRevenue" label="Total Demurrage Revenue">
            <input id="demurrageRevenue" value={form.demurrageRevenue || '0.00'} readOnly />
          </Field>
        </div>
      </CollapsiblePanel>

<CollapsiblePanel
        title="Other Income"
        actions={editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Income"
              onClick={() => addRow('otherIncomeRows', createEmptyOtherIncomeRow)}
            />
          ) : null}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Description</th>
                <th>Amount</th>
                <th>Add Comm</th>
                <th>Net Amount</th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.otherIncomeRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      value={row.description}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('otherIncomeRows', row.id, { description: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.amount}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('otherIncomeRows', row.id, { amount: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.addComm}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('otherIncomeRows', row.id, { addComm: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={row.netAmount} readOnly />
                  </td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        onClick={() => removeRow('otherIncomeRows', row.id)}
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
      </CollapsiblePanel>

<CollapsiblePanel
        title="Bunkers"
        defaultOpen
        actions={editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Bunker"
              onClick={() => addRow('bunkerRows', () => createEmptyBunkerRow('CONSUMPTION'))}
            />
          ) : null}
      >
        <div className={styles.tableWrap}>
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
      </CollapsiblePanel>


      <CollapsiblePanel title="Hire / Vessel Daily Ops" defaultOpen>
        <div className={styles.headerGrid}>
          <Field id="hireRate" label="Hire / Day ($)">
            <input
              {...inputProps('hireRate', {
                recalc: true,
                readOnly: readOnly || estimateType === 3,
              })}
            />
          </Field>
          <Field id="addCommPercent" label="Add Comm (%)">
            <input {...inputProps('addCommPercent')} />
          </Field>
          <Field id="brokeragePercent" label="Brokerage (%)">
            <input {...inputProps('brokeragePercent', { recalc: true })} />
          </Field>
          <Field id="ballastBonus" label="BB ($)">
            <input {...inputProps('ballastBonus', { recalc: true })} />
          </Field>
          <Field id="hireAmt" label="Hire Amt">
            <input {...inputProps('hireAmt')} />
          </Field>
          <Field id="cveAmt" label="CVE ($)">
            <input {...inputProps('cveAmt', { recalc: true })} />
          </Field>
          <Field id="vesselDailyOps" label="Vessel Daily Ops ($)">
            <input {...inputProps('vesselDailyOps', { recalc: true })} />
          </Field>
        </div>
      </CollapsiblePanel>

<CollapsiblePanel
        title="TC Hire Periods"
        actions={editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Period"
              onClick={() => addRow('hireRows', createEmptyHireRow)}
            />
          ) : null}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Rate/Day</th>
                <th>Hire Amt</th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.hireRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      value={row.hireFrom}
                      readOnly={readOnly}
                      placeholder="dd-mm-yyyy"
                      onChange={(e) => updateRow('hireRows', row.id, { hireFrom: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.hireTo}
                      readOnly={readOnly}
                      placeholder="dd-mm-yyyy"
                      onChange={(e) => updateRow('hireRows', row.id, { hireTo: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.hireDays}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('hireRows', row.id, { hireDays: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={row.hireRate}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('hireRows', row.id, { hireRate: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={row.hireAmt} readOnly />
                  </td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        onClick={() => removeRow('hireRows', row.id)}
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
      </CollapsiblePanel>

<CollapsiblePanel
        title="Owner Related Costs"
        actions={editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Cost"
              onClick={() => addRow('orcRows', createEmptyOrcRow)}
            />
          ) : null}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Cost Type</th>
                <th>Amount</th>
                <th>Amt / MT</th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.orcRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    {readOnly ? (
                      row.costName || row.costId || '—'
                    ) : (
                      <select
                        value={row.costId}
                        onChange={(e) => {
                          const cost = (lookups.ownerCosts || []).find(
                            (c) => String(c.id) === e.target.value,
                          );
                          updateRow('orcRows', row.id, {
                            costId: e.target.value,
                            costName: cost?.name || '',
                          });
                        }}
                      >
                        <option value="">Select cost</option>
                        {(lookups.ownerCosts || []).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <input
                      value={row.amount}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('orcRows', row.id, { amount: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={row.amountMt} readOnly />
                  </td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        onClick={() => removeRow('orcRows', row.id)}
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
      </CollapsiblePanel>

<EstimateAdvancedSections
        form={form}
        readOnly={readOnly}
        estimateType={estimateType}
        lookups={lookups}
        onFieldChange={onFieldChange}
        onRecalc={onRecalc}
      />

{estimateType === 3 ? (
        <CollapsiblePanel title="Dry Cargo — Floating / Fixed / Average">
            <div className={styles.headerGrid}>
              <Field id="gasBaltic" label="Baltic Rate">
                <input {...inputProps('gasBaltic', { recalc: true })} />
              </Field>
              <Field id="gasBaseRate" label="Base Rate">
                <input {...inputProps('gasBaseRate')} />
              </Field>
              <Field id="addnlPremium" label="Addnl Premium">
                <input {...inputProps('addnlPremium')} />
              </Field>
              <Field id="baseRateFloat" label="Base Float">
                <input {...inputProps('baseRateFloat')} />
              </Field>
              <Field id="baseRateFixed" label="Base Fixed">
                <input {...inputProps('baseRateFixed')} />
              </Field>
              <Field id="baseRateAverage" label="Base Average">
                <input {...inputProps('baseRateAverage')} />
              </Field>
              <Field id="grossFreightFloat" label="Gross Float">
                <input {...inputProps('grossFreightFloat')} />
              </Field>
              <Field id="grossFreightFixed" label="Gross Fixed">
                <input {...inputProps('grossFreightFixed')} />
              </Field>
              <Field id="grossFreightAverage" label="Gross Average">
                <input {...inputProps('grossFreightAverage')} />
              </Field>
              <Field id="netFreightFloat" label="Net Float">
                <input {...inputProps('netFreightFloat')} />
              </Field>
              <Field id="netFreightFixed" label="Net Fixed">
                <input {...inputProps('netFreightFixed')} />
              </Field>
              <Field id="netFreightAverage" label="Net Average">
                <input {...inputProps('netFreightAverage')} />
              </Field>
              <Field id="tceFloat" label="TCE Float">
                <input {...inputProps('tceFloat')} />
              </Field>
              <Field id="tceFixed" label="TCE Fixed">
                <input {...inputProps('tceFixed')} />
              </Field>
              <Field id="tceAverage" label="TCE Average">
                <input {...inputProps('tceAverage')} />
              </Field>
            </div>
        </CollapsiblePanel>
      ) : null}

      <CollapsiblePanel title="Freight / Commissions" defaultOpen>
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
            <Field id="brokerageAmt" label="Brokerage Amt">
              <input {...inputProps('brokerageAmt')} />
            </Field>
          </div>
      </CollapsiblePanel>

<CollapsiblePanel title="Notes / Owner / Attachment" defaultOpen>
          <div className={styles.headerGrid}>
            <Field id="notes" label="Remarks">
              <textarea
                id="notes"
                className={styles.textarea}
                value={form.notes || ''}
                readOnly={readOnly}
                rows={3}
                placeholder="Remarks ..."
                onChange={(e) => updateField('notes', e.target.value)}
              />
            </Field>
            <Field id="ownerId" label="Owner">
              {readOnly ? (
                <input
                  id="ownerId"
                  value={
                    (lookups.owners || []).find((o) => String(o.id) === String(form.ownerId))?.name
                    || form.ownerId
                    || '—'
                  }
                  readOnly
                />
              ) : (
                <select
                  id="ownerId"
                  value={form.ownerId || ''}
                  onChange={(e) => updateField('ownerId', e.target.value)}
                >
                  <option value="">Select owner</option>
                  {(lookups.owners || []).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field id="disponentOwner" label="Disponent Owner">
              <input {...inputProps('disponentOwner')} />
            </Field>
            {editable ? (
              <Field id="attachments" label="Attachment">
                <input
                  id="attachments"
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    updateField('attachmentFiles', files);
                  }}
                />
              </Field>
            ) : null}
            {(form.attachments || []).length ? (
              <div className={styles.field}>
                <span className={styles.labelLike}>Previous uploads</span>
                <div className={styles.attachmentList}>
                  {form.attachments.map((item) => (
                    <a
                      key={item.file || item.url}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.uploadLink}
                    >
                      {item.name || item.file}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
      </CollapsiblePanel>
      </div>

      <aside className={styles.estimateAside}>
        <div className={styles.estimateAsideInner}>
          <EstimateResultsPanels
            form={form}
            readOnly={readOnly}
            complianceYear={lookups.complianceYear || new Date().getFullYear()}
            onFieldChange={onFieldChange}
            onRecalc={onRecalc}
          />
        </div>
      </aside>
    </div>
  );
}


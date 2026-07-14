import React, { useState } from 'react';
import { Button, DmyDateInput } from '@bainbridge/shared-ui';
import PortSearchSelect from '../period-contract/PortSearchSelect.jsx';
import VesselSearchSelect from './VesselSearchSelect.jsx';
import {
  BUNKER_ACTIVITY_GRADE_OPTIONS,
  BUNKER_ACTIVITY_OPTIONS,
  BUNKER_ACTIVITY_RATE_FIELD,
  BUNKER_IDENTIFY_OPTIONS,
  FIXTURE_TYPE_OPTIONS,
  LAYTIME_TERM_OPTIONS,
  PASSAGE_TYPE_OPTIONS,
  SPEED_TYPE_OPTIONS,
  createEmptyBrokerRow,
  createEmptyBunkerActivityRow,
  createEmptyBunkerRow,
  createEmptyCargoRow,
  createEmptyHireRow,
  createEmptyOrcRow,
  createEmptyOtherIncomeRow,
  createEmptyPortLeg,
  createEmptyProfitSharingRow,
  getFixtureTypeLabel,
} from './estimateDetail.constants.js';
import { calcDemurrageEst, calcLaytimeWorkingDays, calcSeaDays } from './estimateCalculations.js';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import DistanceFetchModal from './DistanceFetchModal.jsx';
import EstimateAdvancedSections from './EstimateAdvancedSections.jsx';
import EstimateResultsPanels from './EstimateResultsPanels.jsx';
import VesselItineraryModal from './VesselItineraryModal.jsx';
import { fetchCanalOrcRates, searchEstimatePorts } from '../../../services/estimateDetail.js';
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
  onPeriodContractChange,
  onRecalc,
  onApplyPatch,
}) {
  const estimateType = Number(detail?.estimateType) || 2;
  const showLumpsum = estimateType !== 3;
  const editable = !readOnly;
  const [distanceLegId, setDistanceLegId] = useState(null);
  const [itineraryOpen, setItineraryOpen] = useState(false);

  const updateField = (key, value) => {
    onFieldChange?.(key, value);
  };

  const applyPatch = (patch) => {
    if (onApplyPatch) {
      onApplyPatch(patch);
      return;
    }
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (onRecalc && Array.isArray(value)) onRecalc(key, value);
      else updateField(key, value);
    });
  };

  const resolveNrt = () => {
    const explicit = Number(String(form.nrt || '').replace(/,/g, ''));
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const gnrt = String(form.gnrt || '');
    if (gnrt.includes('/')) {
      const part = Number(String(gnrt.split('/')[1] || '').replace(/,/g, ''));
      if (Number.isFinite(part) && part > 0) return part;
    }
    const g = Number(gnrt.replace(/,/g, ''));
    if (Number.isFinite(g) && g > 0) return Math.round(g * 0.7 * 100) / 100;
    return 0;
  };

  const openDistanceFetch = (leg) => {
    if (!leg.fromPortId || !leg.toPortId) {
      window.alert('Please select From Port and To Port');
      return;
    }
    setDistanceLegId(leg.id);
  };

  const handleDistanceConfirm = async (legId, patch) => {
    const leg = (form.portLegs || []).find((row) => row.id === legId);
    if (!leg) return;

    const isLaden = String(leg.passageType) === '2';
    const isEco = String(leg.speedType) === '2';
    const ballastFull = form.bFullSpeed || form.bEcoSpeed1 || 12;
    const ballastEco = form.bEcoSpeed1 || ballastFull;
    const ladenFull = form.lFullSpeed || form.lEcoSpeed1 || ballastFull;
    const ladenEco = form.lEcoSpeed1 || ladenFull;
    const speed = isLaden
      ? (isEco ? ladenEco : ladenFull)
      : (isEco ? ballastEco : ballastFull);
    const seaDays = calcSeaDays(patch.distance, speed, leg.seaMargin);
    const totalDistance = Number(patch.distance) || 0;
    const secaDistance = Number(patch.secaDistance) || 0;
    const nonSecaDistance = Math.max(0, totalDistance - secaDistance);

    const nextLegs = (form.portLegs || []).map((row) => (
      row.id === legId
        ? {
          ...row,
          distance: patch.distance,
          secaDistance: patch.secaDistance,
          nonSecaDistance: String(Number(nonSecaDistance.toFixed(3))),
          navMethod: patch.navMethod || row.navMethod || '',
          seaDays: seaDays ? String(seaDays) : '',
        }
        : row
    ));

    let nextOrcs = form.orcRows || [];
    const canals = patch.canals || {};
    if (canals.turkish || canals.suez || canals.panama) {
      try {
        const rates = await fetchCanalOrcRates({
          turkish: canals.turkish,
          suez: canals.suez,
          panama: canals.panama,
          businessType: estimateType,
          nrt: resolveNrt(),
          dwt: form.dwtSummer || form.loadable || 0,
          passageType: leg.passageType,
          vesselType: form.vesselType,
          sdrToUsd: form.sdrToUsd || lookups.marketPrices?.sdrToUsd,
        });
        const portFlag = `${leg.fromPortId}_${leg.toPortId}`;
        const remaining = [...(form.orcRows || [])].filter((row) => row.costId || row.amount);
        let scnt = form.scnt || '';
        for (const canalRow of rates.rows || []) {
          if (canalRow.scnt != null && canalRow.scnt !== '') {
            scnt = String(canalRow.scnt);
          }
          const exists = remaining.some(
            (row) => String(row.costId) === String(canalRow.costId) && row.portFlag === portFlag,
          );
          if (exists) continue;
          remaining.push({
            ...createEmptyOrcRow(),
            costId: String(canalRow.costId),
            costName: canalRow.costName || '',
            amount: canalRow.amount || '0',
            portFlag,
          });
        }
        nextOrcs = remaining.length ? remaining : [createEmptyOrcRow()];
        applyPatch({
          portLegs: nextLegs,
          orcRows: nextOrcs,
          ...(rates.sdrToUsd ? { sdrToUsd: rates.sdrToUsd } : {}),
          ...(scnt ? { scnt } : {}),
        });
        return;
      } catch {
        // Keep distance even if canal rates fail.
      }
    }

    applyPatch({ portLegs: nextLegs, orcRows: nextOrcs });
  };

  const updateRow = (collection, id, patch) => {
    const rows = (form[collection] || []).map((row) => (
      row.id === id ? { ...row, ...patch } : row
    ));

    // Cargo qty → seed load/disc qty on first empty legs (PHP QMT linking)
    if (collection === 'cargoRows' && Object.prototype.hasOwnProperty.call(patch, 'cargoMt')) {
      const cargoQty = String(patch.cargoMt ?? '');
      const portLegs = (form.portLegs || []).map((leg, index) => {
        if (!cargoQty) return leg;
        if (index === 0 && !leg.loadQty) {
          return { ...leg, loadQty: cargoQty };
        }
        if (!leg.dischargeQty && String(leg.passageType) === '2') {
          return { ...leg, dischargeQty: cargoQty };
        }
        return leg;
      });
      applyPatch({ cargoRows: rows, portLegs });
      return;
    }

    if (onRecalc) {
      onRecalc(collection, rows);
    } else {
      updateField(collection, rows);
    }
  };

  const addRow = (collection, factory) => {
    if (collection === 'portLegs') {
      const prev = (form.portLegs || [])[(form.portLegs || []).length - 1];
      const next = factory();
      if (prev?.toPortId) {
        next.fromPortId = prev.toPortId;
        next.fromPortName = prev.toPortName || '';
      }
      const cargoQty = (form.cargoRows || []).find((r) => r.cargoMt)?.cargoMt || '';
      if (cargoQty && String(next.passageType) === '2' && !next.loadQty) {
        next.loadQty = String(cargoQty);
      }
      updateField(collection, [...(form.portLegs || []), next]);
      return;
    }
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
            <Field id="sdrToUsd" label="SDR to USD">
              <input {...inputProps('sdrToUsd', { recalc: true })} />
            </Field>
            <Field id="scnt" label="SCNT">
              <input id="scnt" value={form.scnt || ''} readOnly placeholder="0.00" />
            </Field>
            <Field id="laycanStart" label="Laycan Start">
              <input
                {...inputProps('laycanStart')}
                placeholder="dd-mm-yyyy HH:MM"
              />
            </Field>
            <Field id="laycanEnd" label="Laycan End">
              <input
                {...inputProps('laycanEnd')}
                placeholder="dd-mm-yyyy HH:MM"
              />
            </Field>
            <Field id="periodId" label="Period Contract">
              <select
                id="periodId"
                value={form.periodId || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const value = e.target.value;
                  updateField('periodId', value);
                  onPeriodContractChange?.(value);
                }}
              >
                <option value="">— Select —</option>
                {(lookups.periodContracts || []).map((row) => (
                  <option key={row.id} value={row.id}>{row.label || row.id}</option>
                ))}
              </select>
            </Field>
            <Field id="charteringTeam" label="Chartering Team">
              <select
                id="charteringTeam"
                value={form.charteringTeam || ''}
                disabled={readOnly}
                onChange={(e) => updateField('charteringTeam', e.target.value)}
              >
                <option value="">— Select —</option>
                {(lookups.charteringTeams || []).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </Field>
            <Field id="charteringPic" label="Chartering PIC">
              <select
                id="charteringPic"
                value={form.charteringPic || ''}
                disabled={readOnly}
                onChange={(e) => updateField('charteringPic', e.target.value)}
              >
                <option value="">— Select —</option>
                {(lookups.charteringPics || []).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
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
                value={form.nrt || (form.gnrt ? (Number(String(form.gnrt).split('/')[0] || form.gnrt) * 0.7).toFixed(2) : '')}
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
        actions={(
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="button"
              variant="outline"
              label="Itinerary"
              onClick={() => setItineraryOpen(true)}
            />
            {editable ? (
              <Button
                type="button"
                variant="outline"
                label="Add Leg"
                onClick={() => addRow('portLegs', createEmptyPortLeg)}
              />
            ) : null}
          </div>
        )}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Passage</th>
                <th>Speed</th>
                {editable ? <th>Fetch</th> : null}
                <th>Distance</th>
                <th>Wx %</th>
                <th>Sea Days</th>
                <th>From Arr</th>
                <th>From Dep</th>
                <th>To Arr</th>
                <th>To Dep</th>
                <th>Load Qty</th>
                <th>Disc Qty</th>
                <th>LP Cost</th>
                <th>DP Cost</th>
                <th>Transit</th>
                <th>SECA Dist</th>
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
                        searchPorts={searchEstimatePorts}
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
                        searchPorts={searchEstimatePorts}
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
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className={styles.fetchBtn}
                        onClick={() => openDistanceFetch(leg)}
                      >
                        Fetch
                      </button>
                    </td>
                  ) : null}
                  <td>
                    <input
                      value={leg.distance}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { distance: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.seaMargin ?? '5'}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { seaMargin: e.target.value })}
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
                      value={leg.fromArrival || ''}
                      readOnly={readOnly}
                      placeholder="dd-mm-yyyy HH:MM"
                      onChange={(e) => updateRow('portLegs', leg.id, { fromArrival: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.fromDeparture || ''}
                      readOnly={readOnly}
                      placeholder="dd-mm-yyyy HH:MM"
                      onChange={(e) => updateRow('portLegs', leg.id, { fromDeparture: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.toArrival || ''}
                      readOnly={readOnly}
                      placeholder="dd-mm-yyyy HH:MM"
                      onChange={(e) => updateRow('portLegs', leg.id, { toArrival: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.toDeparture || ''}
                      readOnly={readOnly}
                      placeholder="dd-mm-yyyy HH:MM"
                      onChange={(e) => updateRow('portLegs', leg.id, { toDeparture: e.target.value })}
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

      <CollapsiblePanel title="Port Laytime (LP / DP)" defaultOpen>
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Leg</th>
                <th>LP Rate</th>
                <th>LP Terms</th>
                <th>LP Work</th>
                <th>LP Idle</th>
                <th>DP Rate</th>
                <th>DP Terms</th>
                <th>DP Work</th>
                <th>DP Idle</th>
                <th>Transit Idle</th>
                <th>Port Stay</th>
              </tr>
            </thead>
            <tbody>
              {(form.portLegs || []).map((leg, index) => (
                <tr key={`lay-${leg.id}`}>
                  <td>
                    {leg.fromPortName || 'From'}
                    {' → '}
                    {leg.toPortName || 'To'}
                    {index === 0 ? ' #1' : ` #${index + 1}`}
                  </td>
                  <td>
                    <input
                      value={leg.loadPortRate || ''}
                      readOnly={readOnly}
                      onChange={(e) => {
                        const loadPortRate = e.target.value;
                        const loadPortWorkDays = String(leg.loadPortTerms) === '4'
                          ? leg.loadPortWorkDays
                          : String(calcLaytimeWorkingDays(leg.loadQty, loadPortRate, leg.loadPortTerms) || '');
                        updateRow('portLegs', leg.id, { loadPortRate, loadPortWorkDays });
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={leg.loadPortTerms || '1'}
                      disabled={readOnly}
                      onChange={(e) => {
                        const loadPortTerms = e.target.value;
                        const loadPortWorkDays = loadPortTerms === '4'
                          ? leg.loadPortWorkDays
                          : String(calcLaytimeWorkingDays(leg.loadQty, leg.loadPortRate, loadPortTerms) || '');
                        updateRow('portLegs', leg.id, { loadPortTerms, loadPortWorkDays });
                      }}
                    >
                      {LAYTIME_TERM_OPTIONS.map((o) => (
                        <option key={`lp-${o.value || 'x'}`} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={leg.loadPortWorkDays || ''}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { loadPortWorkDays: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.loadPortIdleDays || ''}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { loadPortIdleDays: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.discPortRate || ''}
                      readOnly={readOnly}
                      onChange={(e) => {
                        const discPortRate = e.target.value;
                        const discPortWorkDays = String(leg.discPortTerms) === '4'
                          ? leg.discPortWorkDays
                          : String(calcLaytimeWorkingDays(leg.dischargeQty, discPortRate, leg.discPortTerms) || '');
                        updateRow('portLegs', leg.id, { discPortRate, discPortWorkDays });
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={leg.discPortTerms || '1'}
                      disabled={readOnly}
                      onChange={(e) => {
                        const discPortTerms = e.target.value;
                        const discPortWorkDays = discPortTerms === '4'
                          ? leg.discPortWorkDays
                          : String(calcLaytimeWorkingDays(leg.dischargeQty, leg.discPortRate, discPortTerms) || '');
                        updateRow('portLegs', leg.id, { discPortTerms, discPortWorkDays });
                      }}
                    >
                      {LAYTIME_TERM_OPTIONS.map((o) => (
                        <option key={`dp-${o.value || 'x'}`} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={leg.discPortWorkDays || ''}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { discPortWorkDays: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.discPortIdleDays || ''}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { discPortIdleDays: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.transitIdleDays || ''}
                      readOnly={readOnly}
                      onChange={(e) => updateRow('portLegs', leg.id, { transitIdleDays: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={leg.portStayDays || ''} readOnly />
                  </td>
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
            <Field id="bEcoSpeed2" label="Ballast Eco Speed 2">
              <input {...inputProps('bEcoSpeed2', { recalc: true })} />
            </Field>
            <Field id="lFullSpeed" label="Laden Full Speed">
              <input {...inputProps('lFullSpeed', { recalc: true })} />
            </Field>
            <Field id="lEcoSpeed1" label="Laden Eco Speed">
              <input {...inputProps('lEcoSpeed1', { recalc: true })} />
            </Field>
            <Field id="lEcoSpeed2" label="Laden Eco Speed 2">
              <input {...inputProps('lEcoSpeed2', { recalc: true })} />
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
        <div className={styles.headerGrid} style={{ marginBottom: 8 }}>
          <Field id="timeAllowed" label="Time Allowed (Days)">
            <input
              {...inputProps('timeAllowed', { recalc: true })}
              placeholder="0.00"
            />
          </Field>
          <Field id="demurrageBrokerPercent" label="Demm Comm (%)">
            <input
              id="demurrageBrokerPercent"
              value={form.demurrageBrokerPercent || ''}
              readOnly
            />
          </Field>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Port Leg</th>
                <th>LP Days</th>
                <th>LP Rate</th>
                <th>LP Est ($)</th>
                <th>LP Actual ($)</th>
                <th>LP Nett ($)</th>
                <th>DP Days</th>
                <th>DP Rate</th>
                <th>DP Est ($)</th>
                <th>DP Actual ($)</th>
                <th>DP Nett ($)</th>
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
                      value={leg.demmDaysLp || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => {
                        const demmDaysLp = e.target.value;
                        const ddcLpEst = String(calcDemurrageEst(demmDaysLp, leg.demmRateLp) || '');
                        updateRow('portLegs', leg.id, { demmDaysLp, ddcLpEst, ddcLpReal: ddcLpEst });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.demmRateLp || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => {
                        const demmRateLp = e.target.value;
                        const ddcLpEst = String(calcDemurrageEst(leg.demmDaysLp, demmRateLp) || '');
                        updateRow('portLegs', leg.id, { demmRateLp, ddcLpEst, ddcLpReal: ddcLpEst });
                      }}
                    />
                  </td>
                  <td>
                    <input value={leg.ddcLpEst || ''} readOnly placeholder="0.00" />
                  </td>
                  <td>
                    <input
                      value={leg.ddcLpReal || leg.ddcLpEst || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => updateRow('portLegs', leg.id, { ddcLpReal: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={leg.ddcLpNett || ''} readOnly placeholder="0.00" />
                  </td>
                  <td>
                    <input
                      value={leg.demmDaysDp || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => {
                        const demmDaysDp = e.target.value;
                        const ddcDpEst = String(calcDemurrageEst(demmDaysDp, leg.demmRateDp) || '');
                        updateRow('portLegs', leg.id, { demmDaysDp, ddcDpEst, ddcDpReal: ddcDpEst });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={leg.demmRateDp || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => {
                        const demmRateDp = e.target.value;
                        const ddcDpEst = String(calcDemurrageEst(leg.demmDaysDp, demmRateDp) || '');
                        updateRow('portLegs', leg.id, { demmRateDp, ddcDpEst, ddcDpReal: ddcDpEst });
                      }}
                    />
                  </td>
                  <td>
                    <input value={leg.ddcDpEst || ''} readOnly placeholder="0.00" />
                  </td>
                  <td>
                    <input
                      value={leg.ddcDpReal || leg.ddcDpEst || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => updateRow('portLegs', leg.id, { ddcDpReal: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={leg.ddcDpNett || ''} readOnly placeholder="0.00" />
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
          <Field id="demurrageBrokerAmt" label="Demm Brokerage Amt">
            <input id="demurrageBrokerAmt" value={form.demurrageBrokerAmt || '0.00'} readOnly />
          </Field>
          <Field id="demurrageNett" label="Demm Nett">
            <input id="demurrageNett" value={form.demurrageNett || '0.00'} readOnly />
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

      {estimateType === 1 || estimateType === 2 ? (
        <CollapsiblePanel
          title="Bunker Activity"
          defaultOpen
          actions={editable ? (
            <Button
              type="button"
              variant="outline"
              label="Add Activity"
              onClick={() => addRow('bunkerActivityRows', () => createEmptyBunkerActivityRow({
                price: lookups.marketPrices?.vlsfo || '',
              }))}
            />
          ) : null}
        >
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Bunker Grade</th>
                  <th>Qty. (MT)</th>
                  <th>Price (USD)</th>
                  <th>Amount (USD)</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {(form.bunkerActivityRows || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <select
                        value={row.activity || 'Cold Wash'}
                        disabled={readOnly}
                        onChange={(e) => {
                          const activity = e.target.value;
                          const field = BUNKER_ACTIVITY_RATE_FIELD[activity];
                          const rates = form.variousBunkerRates || [];
                          const grade = String(row.bunkerGrade || '').toUpperCase();
                          const match = rates.find((r) => {
                            const name = String(r.bunkerName || '').toUpperCase();
                            return !grade || name.includes(grade) || grade.includes(name);
                          }) || rates[0];
                          const qtyFromRate = field && match?.[field] != null && match[field] !== ''
                            ? String(match[field])
                            : '';
                          updateRow('bunkerActivityRows', row.id, {
                            activity,
                            ...(qtyFromRate ? { qty: qtyFromRate } : {}),
                          });
                        }}
                      >
                        {BUNKER_ACTIVITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.bunkerGrade || 'VLSFO'}
                        disabled={readOnly}
                        onChange={(e) => {
                          const bunkerGrade = e.target.value;
                          const upper = String(bunkerGrade).toUpperCase();
                          let price = row.price;
                          if (upper.includes('LSMGO') || upper.includes('MGO')) {
                            price = lookups.marketPrices?.marineGasOil || price;
                          } else if (upper.includes('VLSFO')) {
                            price = lookups.marketPrices?.vlsfo || price;
                          }
                          const field = BUNKER_ACTIVITY_RATE_FIELD[row.activity];
                          const rates = form.variousBunkerRates || [];
                          const match = rates.find((r) => {
                            const name = String(r.bunkerName || '').toUpperCase();
                            return name.includes(upper) || upper.includes(name);
                          }) || rates[0];
                          const qtyFromRate = field && match?.[field] != null && match[field] !== ''
                            ? String(match[field])
                            : '';
                          updateRow('bunkerActivityRows', row.id, {
                            bunkerGrade,
                            price: price || '',
                            ...(qtyFromRate ? { qty: qtyFromRate } : {}),
                          });
                        }}
                      >
                        {BUNKER_ACTIVITY_GRADE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                        {(lookups.bunkerGrades || [])
                          .filter((g) => !BUNKER_ACTIVITY_GRADE_OPTIONS.some(
                            (o) => o.value.toUpperCase() === String(g.name || '').toUpperCase(),
                          ))
                          .map((g) => (
                            <option key={g.id} value={g.name}>{g.name}</option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={row.qty || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('bunkerActivityRows', row.id, { qty: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.price || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => updateRow('bunkerActivityRows', row.id, { price: e.target.value })}
                      />
                    </td>
                    <td>
                      <input value={row.amount || ''} readOnly placeholder="0.00" />
                    </td>
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          onClick={() => removeRow('bunkerActivityRows', row.id)}
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
      ) : null}

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
            <input {...inputProps('addCommPercent', { recalc: true })} />
          </Field>
          <Field id="addressCommAmt" label="Add Comm Amt">
            <input id="addressCommAmt" value={form.addressCommAmt || ''} readOnly />
          </Field>
          <Field id="ballastBonus" label="BB ($)">
            <input {...inputProps('ballastBonus', { recalc: true })} />
          </Field>
          <Field id="hireAmt" label="Hire Amt">
            <input {...inputProps('hireAmt')} />
          </Field>
          <Field id="cvePerMonth" label="CVE (/Month)">
            <input {...inputProps('cvePerMonth', { recalc: true })} />
          </Field>
          <Field id="cveAmt" label="CVE ($)">
            <input id="cveAmt" value={form.cveAmt || ''} readOnly placeholder="0.00" />
          </Field>
          <Field id="vesselDailyOps" label="Vessel Daily Ops ($)">
            <input {...inputProps('vesselDailyOps', { recalc: true })} />
          </Field>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Brokerage Commission"
        defaultOpen
        actions={editable ? (
          <Button
            type="button"
            variant="outline"
            label="Add Broker"
            onClick={() => addRow('brokerRows', createEmptyBrokerRow)}
          />
        ) : null}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>%</th>
                <th>Amt</th>
                <th>Demm Comm Amt</th>
                <th>Vendor</th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.brokerRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      value={row.percent || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => updateRow('brokerRows', row.id, { percent: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={row.amount || ''} readOnly placeholder="0.00" />
                  </td>
                  <td>
                    <input value={row.demmPercent || ''} readOnly placeholder="0.00" />
                  </td>
                  <td>
                    {readOnly ? (
                      <input
                        value={
                          (lookups.owners || []).find((o) => String(o.id) === String(row.vendorId))?.name
                          || row.vendorId
                          || '—'
                        }
                        readOnly
                      />
                    ) : (
                      <select
                        value={row.vendorId || ''}
                        onChange={(e) => updateRow('brokerRows', row.id, { vendorId: e.target.value })}
                      >
                        <option value="">—</option>
                        {(lookups.owners || []).map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        onClick={() => removeRow('brokerRows', row.id)}
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
        <div className={styles.headerGrid} style={{ marginTop: 8 }}>
          <Field id="brokeragePercent" label="Total Brokerage (%)">
            <input id="brokeragePercent" value={form.brokeragePercent || ''} readOnly />
          </Field>
          <Field id="brokerageAmt" label="Total Brokerage Amt">
            <input id="brokerageAmt" value={form.brokerageAmt || ''} readOnly />
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
        onApplyPatch={onApplyPatch}
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
            <Field id="marketRate" label="Market / Cargo Rate">
              <input {...inputProps('marketRate', { recalc: true })} />
            </Field>
            <Field id="freightGross" label="Gross Freight">
              <input {...inputProps('freightGross', { recalc: true })} />
            </Field>
            <Field id="addressCommAmtFreight" label="Address Comm Amt">
              <input id="addressCommAmtFreight" value={form.addressCommAmt || ''} readOnly />
            </Field>
            <Field id="brokerageAmtFreight" label="Brokerage Amt">
              <input id="brokerageAmtFreight" value={form.brokerageAmt || ''} readOnly />
            </Field>
          </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Profit Sharing"
        defaultOpen
        actions={editable ? (
          <Button
            type="button"
            variant="outline"
            label="Add"
            onClick={() => addRow('profitSharingRows', createEmptyProfitSharingRow)}
          />
        ) : null}
      >
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Percentage</th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {(form.profitSharingRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    <select
                      value={row.vendorId || ''}
                      disabled={readOnly}
                      onChange={(e) => updateRow('profitSharingRows', row.id, { vendorId: e.target.value })}
                    >
                      <option value="">— Select —</option>
                      {(lookups.ownBusiness || lookups.owners || []).map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={row.percentage || ''}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(e) => updateRow('profitSharingRows', row.id, { percentage: e.target.value })}
                    />
                  </td>
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className={styles.rowRemove}
                        onClick={() => removeRow('profitSharingRows', row.id)}
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

      {editable ? (
        <DistanceFetchModal
          open={Boolean(distanceLegId)}
          leg={(form.portLegs || []).find((row) => row.id === distanceLegId) || null}
          onClose={() => setDistanceLegId(null)}
          onConfirm={handleDistanceConfirm}
        />
      ) : null}
      <VesselItineraryModal
        open={itineraryOpen}
        onClose={() => setItineraryOpen(false)}
        form={form}
      />
    </div>
  );
}


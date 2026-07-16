import React, { useState } from 'react';
import { Button, DmyDateInput, useAlert } from '@bainbridge/shared-ui';
import PortSearchSelect from '../period-contract/PortSearchSelect.jsx';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import VesselSearchSelect from './VesselSearchSelect.jsx';
import {
  BUNKER_ACTIVITY_GRADE_OPTIONS,
  BUNKER_ACTIVITY_OPTIONS,
  BUNKER_ACTIVITY_RATE_FIELD,
  FIXTURE_TYPE_OPTIONS,
  NSBG_OPTIONS,
  PASSAGE_TYPE_OPTIONS,
  SBG_OPTIONS,
  SPEED_DATA_OPTIONS,
  SPEED_TYPE_OPTIONS,
  CONSUMPTION_PORT_COLUMNS,
  CONSUMPTION_SPEED_COLUMNS,
  createEmptyBrokerRow,
  createEmptyBunkerActivityRow,
  createEmptyCargoRow,
  createEmptyConsumptionRow,
  createEmptyHireRow,
  createEmptyOrcRow,
  createEmptyOtherIncomeRow,
  createEmptyPortLeg,
  createEmptyProfitSharingRow,
  getFixtureTypeLabel,
} from './estimateDetail.constants.js';
import { calcDemurrageEst, calcSeaDays, calcSeaDaysWithSeca, pickPassageSpeedKnots, buildBunkerSummaryRows, calcDemurrageCommissionDisplay, resolveNrtFromGnrt } from './estimateCalculations.js';
import { NAVIGATION_METHOD_OPTIONS } from './distanceFetch.constants.js';
import CollapsiblePanel from './CollapsiblePanel.jsx';

import DistanceFetchModal from './DistanceFetchModal.jsx';
import TankerFreightModeSection from './TankerFreightModeSection.jsx';
import PortLaytimeSections from './PortLaytimeSections.jsx';
import EstimateResultsPanels from './EstimateResultsPanels.jsx';
import VesselItineraryModal from './VesselItineraryModal.jsx';
import { fetchCanalOrcRates, searchEstimatePorts } from '../../../services/estimateDetail.js';
import { getAddRowBlockMessage } from './estimateValidation.js';
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
  const isTanker = estimateType === 2;
  const showLumpsum = estimateType !== 3;
  const editable = !readOnly;
  const alert = useAlert();
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

  const resolveNrt = () => resolveNrtFromGnrt(form.nrt, form.gnrt);

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

    const speed = pickPassageSpeedKnots(form, leg.passageType, leg.speedType);
    const seaDays = calcSeaDaysWithSeca(patch.distance, patch.secaDistance, speed, leg.seaMargin);
    const secaDays = calcSeaDays(patch.secaDistance, speed, leg.seaMargin);
    const totalDistance = Number(patch.distance) || 0;
    const secaDistance = Number(patch.secaDistance) || 0;
    const nonSecaDistance = Math.max(0, totalDistance - secaDistance);
    const nonSecaDays = Math.max(0, Number((seaDays - secaDays).toFixed(3)));

    const nextLegs = (form.portLegs || []).map((row) => (
      row.id === legId
        ? {
          ...row,
          distance: patch.distance,
          secaDistance: patch.secaDistance,
          nonSecaDistance: String(Number(nonSecaDistance.toFixed(3))),
          navMethod: patch.navMethod || row.navMethod || '',
          seaDays: seaDays ? String(seaDays) : '',
          secaDays: secaDays ? String(secaDays) : '',
          nonSecaDays: nonSecaDays ? String(nonSecaDays) : '',
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

    // Port date edits — mirror PHP calculatePortDates(type, subType, row)
    if (collection === 'portLegs') {
      const keys = Object.keys(patch || {});
      let scheduleMode = null;
      if (keys.includes('fromArrival')) scheduleMode = 'fromArrival';
      else if (keys.includes('fromDeparture')) scheduleMode = 'fromDeparture';
      else if (keys.includes('toArrival')) scheduleMode = 'toArrival';
      else if (keys.includes('toDeparture')) scheduleMode = 'toDeparture';

      if (scheduleMode) {
        applyPatch({
          portLegs: rows,
          _portScheduleMode: scheduleMode,
          _portScheduleLegId: id,
        });
        return;
      }
    }

    if (onRecalc) {
      onRecalc(collection, rows);
    } else {
      updateField(collection, rows);
    }
  };

  const addRow = async (collection, factory, opts = {}) => {
    const blockMessage = getAddRowBlockMessage(collection, form[collection] || [], opts);
    if (blockMessage) {
      await alert({ title: 'Alert', message: blockMessage, confirmLabel: 'OK' });
      return;
    }

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

  const bunkerGradeName = (gradeId) => (
    (lookups.bunkerGrades || form._bunkerGrades || []).find((g) => String(g.id) === String(gradeId))?.name
    || gradeId
    || ''
  );

  // PHP Bunkers table: qty from consumption MT, price from SECA row (txtSECABunkerPrice / slave2 EST_PRICE).
  const bunkerSummaryRows = buildBunkerSummaryRows(form, bunkerGradeName);
  const { addressDemmComm, totalDemmComm } = calcDemurrageCommissionDisplay(form);

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
                  value={String(form.fixtureTypeId ?? '')}
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
              {readOnly ? (
                <input id="vesselName" value={form.vesselName} readOnly />
              ) : (
                <VesselSearchSelect
                  value={form.vesselImoId}
                  label={form.vesselName}
                  onSelect={onVesselSelect}
                />
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
              {readOnly ? (
                <input id="laycanStart" value={form.laycanStart || ''} readOnly />
              ) : (
                <DmyDateInput
                  id="laycanStart"
                  enableTime
                  value={form.laycanStart || ''}
                  onChange={(value) => applyPatch({
                    laycanStart: value,
                    _portScheduleMode: 'laycanOnly',
                  })}
                />
              )}
            </Field>
            <Field id="laycanEnd" label="Laycan End">
              {readOnly ? (
                <input id="laycanEnd" value={form.laycanEnd || ''} readOnly />
              ) : (
                <DmyDateInput
                  id="laycanEnd"
                  enableTime
                  value={form.laycanEnd || ''}
                  onChange={(value) => updateField('laycanEnd', value)}
                />
              )}
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
          </div>
      </CollapsiblePanel>

       <CollapsiblePanel title="Vessel Particulars" defaultOpen={false}>
          <div className={styles.headerGrid}>
            <Field id="dwtSummer" label="DWT (Summer)">
              <input {...inputProps('dwtSummer')} />
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
              <input {...inputProps('loa')} />
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
          </div>
        )}
      >
        <div className={styles.portLegsStack}>
          {(form.portLegs || []).map((leg, legIndex) => (
            <div key={leg.id} className={styles.portLegCard}>
              <div className={styles.portLegGrid}>
                <div className={styles.portLegPorts}>
                  <table className={styles.portTable}>
                    <thead>
                      <tr>
                        <th className={styles.portIdxCol}>#</th>
                        <th>From Port</th>
                        <th>Arrival</th>
                        <th>Departure</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={styles.portIdxCol}>
                          {editable && (form.portLegs || []).length > 1 ? (
                            <button
                              type="button"
                              className={styles.rowRemove}
                              onClick={() => removeRow('portLegs', leg.id)}
                              title="Remove"
                            >
                              ×
                            </button>
                          ) : (
                            <span>{legIndex + 1}</span>
                          )}
                        </td>
                        <td>
                          {readOnly ? (
                            leg.fromPortName || leg.fromPortId || '—'
                          ) : (
                            <PortSearchSelect
                              id={legIndex === 0 ? 'portFrom_0' : `portFrom_${legIndex}`}
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
                            <input value={leg.fromArrival || ''} readOnly />
                          ) : (
                            <DmyDateInput
                              id={`fromArrival_${leg.id}`}
                              enableTime
                              className=""
                              value={leg.fromArrival || ''}
                              onChange={(value) => updateRow('portLegs', leg.id, { fromArrival: value })}
                            />
                          )}
                        </td>
                        <td>
                          {readOnly ? (
                            <input value={leg.fromDeparture || ''} readOnly />
                          ) : (
                            <DmyDateInput
                              id={`fromDeparture_${leg.id}`}
                              enableTime
                              className=""
                              value={leg.fromDeparture || ''}
                              onChange={(value) => updateRow('portLegs', leg.id, { fromDeparture: value })}
                            />
                          )}
                        </td>
                      </tr>
                    </tbody>
                    <thead>
                      <tr>
                        <th />
                        <th>To Port</th>
                        <th>Arrival</th>
                        <th>Departure</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td />
                        <td>
                          {readOnly ? (
                            leg.toPortName || leg.toPortId || '—'
                          ) : (
                            <PortSearchSelect
                              id={legIndex === 0 ? 'portTo_0' : `portTo_${legIndex}`}
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
                          {readOnly ? (
                            <input value={leg.toArrival || ''} readOnly />
                          ) : (
                            <DmyDateInput
                              id={`toArrival_${leg.id}`}
                              enableTime
                              className=""
                              value={leg.toArrival || ''}
                              onChange={(value) => updateRow('portLegs', leg.id, { toArrival: value })}
                            />
                          )}
                        </td>
                        <td>
                          {readOnly ? (
                            <input value={leg.toDeparture || ''} readOnly />
                          ) : (
                            <DmyDateInput
                              id={`toDeparture_${leg.id}`}
                              enableTime
                              className=""
                              value={leg.toDeparture || ''}
                              onChange={(value) => updateRow('portLegs', leg.id, { toDeparture: value })}
                            />
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className={styles.portLegMeta}>
                  <table className={styles.portTable}>
                    <thead>
                      <tr>
                        <th>Wx(%)</th>
                        <th>L/B</th>
                        <th>Speed Type</th>
                        {editable ? <th>Fetch</th> : null}
                        <th>Total Dist</th>
                        <th>Total Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <input
                            value={leg.seaMargin ?? '0'}
                            readOnly={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { seaMargin: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            id={legIndex === 0 ? 'portPassage_0' : `portPassage_${legIndex}`}
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
                            id={legIndex === 0 ? 'portSpeed_0' : `portSpeed_${legIndex}`}
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
                            id={legIndex === 0 ? 'portDistance_0' : `portDistance_${legIndex}`}
                            value={leg.distance}
                            readOnly={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { distance: e.target.value })}
                          />
                        </td>
                        <td>
                          <input value={leg.seaDays || ''} readOnly />
                        </td>
                      </tr>
                    </tbody>
                    <thead>
                      <tr>
                        <th>BG</th>
                        <th>NSECA Dist</th>
                        <th>NSECA Days</th>
                        <th>BG</th>
                        <th>SECA Dist</th>
                        <th>SECA Days</th>
                        <th>Navigation</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <select
                            value={leg.bgNonSeca || 'VLSFO'}
                            disabled={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { bgNonSeca: e.target.value })}
                          >
                            {NSBG_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input value={leg.nonSecaDistance || ''} readOnly />
                        </td>
                        <td>
                          <input value={leg.nonSecaDays || ''} readOnly />
                        </td>
                        <td>
                          <select
                            value={leg.bgSeca || 'LSMGO'}
                            disabled={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { bgSeca: e.target.value })}
                          >
                            {SBG_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={leg.secaDistance || ''}
                            readOnly={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { secaDistance: e.target.value })}
                          />
                        </td>
                        <td>
                          <input value={leg.secaDays || ''} readOnly />
                        </td>
                        <td>
                          <select
                            id={legIndex === 0 ? 'portNav_0' : `portNav_${legIndex}`}
                            value={leg.navMethod || ''}
                            disabled={readOnly}
                            onChange={(e) => updateRow('portLegs', leg.id, { navMethod: e.target.value })}
                          >
                            {NAVIGATION_METHOD_OPTIONS.map((o) => (
                              <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
        {editable ? (
          <div className={styles.portAddRow}>
            <Button
              type="button"
              variant="outline"
              label="Add"
              onClick={() => addRow('portLegs', createEmptyPortLeg)}
            />
          </div>
        ) : null}
      </CollapsiblePanel>

      <CollapsiblePanel title="Speed / Consumption" defaultOpen={false}>
        {(() => {
          const speedDataType = form.speedDataType || 'full';
          const speedCols = CONSUMPTION_SPEED_COLUMNS[speedDataType] || CONSUMPTION_SPEED_COLUMNS.full;
          const ballastKey = speedDataType === 'service'
            ? 'bEcoSpeed1'
            : speedDataType === 'eco'
              ? 'bEcoSpeed2'
              : 'bFullSpeed';
          const ladenKey = speedDataType === 'service'
            ? 'lEcoSpeed1'
            : speedDataType === 'eco'
              ? 'lEcoSpeed2'
              : 'lFullSpeed';
          const foRows = (form.consumptionRows || []).filter((row) => row.identify === 'FO');
          const doRows = (form.consumptionRows || []).filter((row) => row.identify === 'DO');
          const gradeName = (id) => (
            (lookups.bunkerGrades || []).find((g) => String(g.id) === String(id))?.name || id || '—'
          );

          const renderConsTable = (title, rows, identify) => {
            const dataCols = [...speedCols, ...CONSUMPTION_PORT_COLUMNS];
            return (
            <div className={styles.consBlock}>
              <div className={styles.consTitle}>{title}</div>
              <div className={styles.tableWrap}>
                <table className={styles.portTable}>
                  <thead>
                    <tr>
                      <th>Bunker</th>
                      {dataCols.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                      {editable ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(rows.length ? rows : []).map((row) => (
                      <tr key={`${title}-${row.id}`}>
                        <td>
                          {readOnly ? (
                            gradeName(row.bunkerGradeId)
                          ) : (
                            <select
                              value={row.bunkerGradeId || ''}
                              onChange={(e) => updateRow('consumptionRows', row.id, {
                                bunkerGradeId: e.target.value,
                                identify,
                              })}
                            >
                              <option value="">Select</option>
                              {(lookups.bunkerGrades || []).map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        {dataCols.map((col) => (
                          <td key={col.key}>
                            <input
                              value={row[col.key] ?? ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => updateRow('consumptionRows', row.id, {
                                [col.key]: e.target.value,
                                identify,
                              })}
                            />
                          </td>
                        ))}
                        {editable ? (
                          <td>
                            <button
                              type="button"
                              className={styles.rowRemove}
                              title="Remove"
                              onClick={() => removeRow('consumptionRows', row.id)}
                            >
                              ×
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {!rows.length ? (
                      <tr>
                        <td colSpan={1 + dataCols.length + (editable ? 1 : 0)}>
                          No {identify} rows
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {editable ? (
                <button
                  type="button"
                  className={styles.addRowBtn}
                  onClick={() => addRow('consumptionRows', () => createEmptyConsumptionRow(identify), { identify })}
                >
                  + Add {identify}
                </button>
              ) : null}
            </div>
          );
          };

          return (
            <>
              <div className={styles.speedDataBar}>
                <span className={styles.speedDataLabel}>Speed Data</span>
                <select
                  id="speedDataType"
                  value={speedDataType}
                  disabled={readOnly}
                  onChange={(e) => updateField('speedDataType', e.target.value)}
                >
                  {SPEED_DATA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <Field id={ballastKey} label="Ballast Speed (Knots)">
                  <input {...inputProps(ballastKey, { recalc: true })} placeholder="0.00" />
                </Field>
                <Field id={ladenKey} label="Laden Speed (Knots)">
                  <input {...inputProps(ladenKey, { recalc: true })} placeholder="0.00" />
                </Field>
              </div>
              {renderConsTable('FO Consp/day(MT) - At Sea', foRows, 'FO')}
              {renderConsTable('DO Consp/day(MT) - At Sea', doRows, 'DO')}
            </>
          );
        })()}
      </CollapsiblePanel>
      


      

      
        <CollapsiblePanel
        title="Cargo"
        defaultOpen
      >
        <div className={styles.headerGrid}>
          {!(isTanker && String(form.tankType || '1') === '2') ? (
          <Field id="cargoId_0" label="Cargo Name">
            <div id="cargoId_0" className={styles.compactSelectWrap}>
              {(() => {
                const cargoLookup = (lookups.cargos || [])
                  .map((c) => ({
                    id: String(c.id ?? c.MATERIALID ?? ''),
                    name: String(c.name ?? c.MATERIAL_CODE_DESC ?? '').trim(),
                  }))
                  .filter((c) => c.id);

                const selectedCargoIds = (
                  (form.cargoIds || []).length
                    ? form.cargoIds
                    : (form.cargoRows || []).map((row) => row.cargoId)
                )
                  .map((id) => String(id || '').trim())
                  .filter((id) => id && id !== '0');

                const optionMap = new Map(
                  cargoLookup.map((c) => [c.id, { id: c.id, name: c.name || c.id }]),
                );
                for (const row of form.cargoRows || []) {
                  const id = String(row.cargoId || '').trim();
                  if (!id || id === '0') continue;
                  if (!optionMap.has(id)) {
                    optionMap.set(id, {
                      id,
                      name: row.cargoName || cargoLookup.find((c) => c.id === id)?.name || id,
                    });
                  } else if (!optionMap.get(id).name && row.cargoName) {
                    optionMap.set(id, { id, name: row.cargoName });
                  }
                }

                return (
              <CountryMultiSelect
                compact
                options={[...optionMap.values()]}
                value={selectedCargoIds}
                disabled={readOnly}
                placeholder="Choose cargo…"
                searchPlaceholder="Search cargo…"
                onChange={(selected) => {
                  const existingById = new Map(
                    (form.cargoRows || []).map((row) => [String(row.cargoId), row]),
                  );
                  const nextRows = selected.length
                    ? selected.map((cargoId) => {
                      const existing = existingById.get(String(cargoId));
                      const cargo = optionMap.get(String(cargoId))
                        || cargoLookup.find((c) => String(c.id) === String(cargoId));
                      if (existing) {
                        return {
                          ...existing,
                          cargoId: String(cargoId),
                          cargoName: cargo?.name || existing.cargoName || '',
                          status: 1,
                        };
                      }
                      return {
                        ...createEmptyCargoRow(1),
                        cargoId: String(cargoId),
                        cargoName: cargo?.name || '',
                      };
                    })
                    : [createEmptyCargoRow(1)];
                  applyPatch({
                    cargoRows: nextRows,
                    cargoIds: selected.map(String),
                  });
                }}
              />
                );
              })()}
            </div>
          </Field>
          ) : null}
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
              {(() => {
                const options = [...(lookups.charteringPics || [])];
                const id = form.charteringPic != null ? String(form.charteringPic) : '';
                if (id && !options.some((row) => String(row.id) === id)) {
                  options.unshift({ id, name: form.charteringPicName || id });
                }
                return options.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ));
              })()}
            </select>
          </Field>
          <Field id="freightGrossCargoHeader" label="Total Freight">
            <input id="freightGrossCargoHeader" value={form.freightGross || ''} readOnly />
          </Field>
        </div>

        {isTanker ? (
          <TankerFreightModeSection
            form={form}
            readOnly={readOnly}
            editable={editable}
            lookups={lookups}
            inputProps={inputProps}
            applyPatch={applyPatch}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
            onRecalc={onRecalc}
            updateField={updateField}
          />
        ) : (
          <>
            <h4 className={styles.subHeading}>Freight</h4>
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
              <Field id="freightGross" label="Gross Freight / Total Freight">
                <input {...inputProps('freightGross', { recalc: true })} />
              </Field>
            </div>
          </>
        )}

        <h4 className={styles.subHeading}>Commissions</h4>
        <div className={styles.tableWrap}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th style={{ width: 56 }} />
                <th />
                <th>Freight</th>
                <th>Freight Comm.</th>
                <th>Demurrage Comm.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td />
                <td>Address Commission (Freight)</td>
                <td>
                  <input {...inputProps('addCommPercent', { recalc: true })} id="addCommPercentCargo" placeholder="0.00" />
                </td>
                <td>
                  <input id="addressCommAmtCargo" value={form.addressCommAmt || ''} readOnly placeholder="0.00" />
                </td>
                <td>
                  <input
                    id="addressDemmCommCargo"
                    value={addressDemmComm ? addressDemmComm.toFixed(2) : ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
              </tr>
              {(form.brokerRows || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    {editable ? (
                      <button
                        type="button"
                        className={styles.rowRemove}
                        onClick={() => removeRow('brokerRows', row.id)}
                        title="Remove"
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                  <td>Charterers side Brokerage commission (%)</td>
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
                </tr>
              ))}
              <tr>
                <td>
                  {editable ? (
                    <Button
                      type="button"
                      variant="outline"
                      label="Add"
                      onClick={() => addRow('brokerRows', createEmptyBrokerRow)}
                    />
                  ) : null}
                </td>
                <td>Total Brokerage Commission (%)</td>
                <td>
                  <input id="brokeragePercentCargo" value={form.brokeragePercent || ''} readOnly placeholder="0.00" />
                </td>
                <td>
                  <input id="brokerageAmtCargo" value={form.brokerageAmt || ''} readOnly placeholder="0.00" />
                </td>
                <td>
                  <input
                    id="totalDemmCommCargo"
                    value={totalDemmComm ? totalDemmComm.toFixed(2) : ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

      <PortLaytimeSections
        form={form}
        readOnly={readOnly}
        lookups={lookups}
        updateRow={updateRow}
      />
{estimateType === 1 || estimateType === 2 ? (
        <CollapsiblePanel
          title="Bunker Activity"
          defaultOpen={false}
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

      <CollapsiblePanel title="Demurrage Dispatch" defaultOpen={false}>
        <div className={styles.headerGrid} style={{ marginBottom: 8 }}>
          <Field id="timeAllowed" label="Time Allowed (hrs)">
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
        defaultOpen={false}
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
        defaultOpen={false}
      >
        <div className={styles.tableWrap} style={{ marginBottom: 10 }}>
          <table className={styles.portTable}>
            <thead>
              <tr>
                <th>Bunker Grade</th>
                <th>Qty. (MT)</th>
                <th>Price (MT)</th>
                <th>Amount($)</th>
              </tr>
            </thead>
            <tbody>
              {bunkerSummaryRows.length ? bunkerSummaryRows.map((row) => (
                <tr key={`summary-${row.grade}`}>
                  <td>{row.grade}</td>
                  <td><input value={row.qty || ''} readOnly placeholder="0.00" /></td>
                  <td><input value={row.price || ''} readOnly placeholder="0.00" /></td>
                  <td><input value={row.amount || ''} readOnly placeholder="0.00" /></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className={styles.summaryEmptyCell}>No bunker summary available yet.</td>
                </tr>
              )}
              <tr>
                <td className={styles.summaryLabelCell}>Total Bunker Consumed - SECA/NON SECA</td>
                <td colSpan={3}>
                  <input value={form.totalBunkerCost || ''} readOnly placeholder="0.00" />
                </td>
              </tr>
              <tr>
                <td className={styles.summaryLabelCell}>CO2 Price($/MT)</td>
                <td>
                  <input
                    id="co2PriceInline"
                    value={form.co2Price || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    onChange={(e) => updateField('co2Price', e.target.value)}
                  />
                </td>
                <td className={styles.summaryLabelCell}>EUA Price($/MT)</td>
                <td>
                  <input
                    id="euaPriceInline"
                    value={form.euaPrice || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    onChange={(e) => updateField('euaPrice', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Hire / Vessel Daily Ops" defaultOpen={false}>
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
          <Field id="offHireCve" label="CVE Off Hire (/Month)">
            <input {...inputProps('offHireCve', { recalc: true })} placeholder="0.00" />
          </Field>
          <Field id="offHireCveAmt" label="CVE Off Hire Amt">
            <input id="offHireCveAmt" value={form.offHireCveAmt || ''} readOnly placeholder="0.00" />
          </Field>
          <Field id="lessOffHire" label="Less Off Hire">
            <input id="lessOffHire" value={form.lessOffHire || form.totalOffHireAmt || ''} readOnly placeholder="0.00" />
          </Field>
          <Field id="vesselDailyOps" label="Vessel Daily Ops ($)">
            <input {...inputProps('vesselDailyOps', { recalc: true })} />
          </Field>
        </div>
      </CollapsiblePanel>


      <CollapsiblePanel
        title="Profit Sharing"
        defaultOpen={false}
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
{estimateType === 3 ? (
        <CollapsiblePanel title="Dry Cargo — Floating / Fixed / Average" defaultOpen={false}>
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


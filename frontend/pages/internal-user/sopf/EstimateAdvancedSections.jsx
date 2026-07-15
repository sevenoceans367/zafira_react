import React from 'react';
import { DmyDateInput, useAlert } from '@bainbridge/shared-ui';
import { searchEstimatePorts } from '../../../services/estimateDetail.js';
import WsPortMultiSelect from './WsPortMultiSelect.jsx';
import {
  BUNKER_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  PASSAGE_TYPE_OPTIONS,
  SECA_IDENTIFY_OPTIONS,
  SPEED_TYPE_OPTIONS,
  createEmptyDeliveryBunkerRow,
  createEmptyFreightQtyRow,
  createEmptyInvoiceRow,
  createEmptyOffHireRow,
  createEmptyPassageLocationRow,
  createEmptySecaBunkerRow,
  createEmptyTankerWsRow,
  createEmptyDisponentRow,
  createEmptyVoyageEventRow,
} from './estimateDetail.constants.js';
import { getAddRowBlockMessage } from './estimateValidation.js';
import styles from './UpdateEstimatePage.module.css';

function newBunkerId() {
  return `offb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function EstimateAdvancedSections({
  form,
  readOnly = false,
  estimateType = 2,
  lookups = { cargos: [], bunkerGrades: [], owners: [] },
  onFieldChange,
  onRecalc,
  onApplyPatch,
}) {
  const editable = !readOnly;
  const isTanker = Number(estimateType) === 2;
  const alert = useAlert();

  const updateField = (key, value) => {
    onFieldChange?.(key, value);
  };

  const applyPatch = (patch) => {
    if (onApplyPatch) {
      onApplyPatch(patch);
      return;
    }
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (onRecalc) onRecalc(key, value);
      else updateField(key, value);
    });
  };

  const updateRow = (collection, id, patch) => {
    const rows = (form[collection] || []).map((row) => (
      row.id === id ? { ...row, ...patch } : row
    ));
    if (onRecalc) onRecalc(collection, rows);
    else updateField(collection, rows);
  };

  const addRow = async (collection, factory, opts = {}) => {
    const blockMessage = getAddRowBlockMessage(collection, form[collection] || [], opts);
    if (blockMessage) {
      await alert({ title: 'Alert', message: blockMessage, confirmLabel: 'OK' });
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

  const updateTankerWsRow = (id, patch) => {
    const rows = (form.tankerWsRows || []).map((row) => (
      row.id === id ? { ...row, ...patch } : row
    ));
    const masterPatch = {};
    const first = rows[0];
    if (
      first?.id === id
      && ('wsFromPortId' in patch || 'wsToPortId' in patch)
    ) {
      masterPatch.tankWsFrom = first.wsFromPortId || '';
      masterPatch.tankWsTo = first.wsToPortId || '';
    }
    if (onRecalc) {
      onRecalc('tankerWsRows', rows);
      if ('tankWsFrom' in masterPatch) onRecalc('tankWsFrom', masterPatch.tankWsFrom);
      if ('tankWsTo' in masterPatch) onRecalc('tankWsTo', masterPatch.tankWsTo);
      return;
    }
    applyPatch({ tankerWsRows: rows, ...masterPatch });
  };

  const handleTankerWsFieldChange = (row, key, value) => {
    const patch = { [key]: value };
    if (key === 'minFlatRate' && value) {
      const half = Number(String(value).replace(/,/g, ''));
      if (Number.isFinite(half)) patch.oveFlatRate = String(Math.round((half / 2) * 100) / 100);
    }
    if (key === 'minWs' && value) {
      patch.oveWs = value;
    }
    updateTankerWsRow(row.id, patch);
  };

  const addTankerWsRow = async () => {
    const blockMessage = getAddRowBlockMessage('tankerWsRows', form.tankerWsRows || []);
    if (blockMessage) {
      await alert({ title: 'Alert', message: blockMessage, confirmLabel: 'OK' });
      return;
    }
    const row = createEmptyTankerWsRow();
    const distance = form.totalDistance != null ? String(form.totalDistance) : '';
    if (distance) {
      row.minDistance = distance;
      row.oveDistance = distance;
    }
    const rows = [...(form.tankerWsRows || []), row];
    if (onRecalc) onRecalc('tankerWsRows', rows);
    else updateField('tankerWsRows', rows);
  };

  const updateOffHireBunker = (offId, bunkerId, patch) => {
    const rows = (form.offHireRows || []).map((row) => {
      if (row.id !== offId) return row;
      return {
        ...row,
        bunkers: (row.bunkers || []).map((b) => (
          b.id === bunkerId ? { ...b, ...patch } : b
        )),
      };
    });
    if (onRecalc) onRecalc('offHireRows', rows);
    else updateField('offHireRows', rows);
  };

  const addOffHireBunker = async (offId) => {
    const offRow = (form.offHireRows || []).find((row) => row.id === offId);
    const bunkers = offRow?.bunkers || [];
    const last = bunkers[bunkers.length - 1];
    if (last && (!String(last.bunkerGradeId || '').trim() || !String(last.qty || '').trim())) {
      await alert({ title: 'Alert', message: 'Please fill previous data', confirmLabel: 'OK' });
      return;
    }
    const rows = (form.offHireRows || []).map((row) => {
      if (row.id !== offId) return row;
      return {
        ...row,
        bunkers: [
          ...(row.bunkers || []),
          {
            id: newBunkerId(),
            bunkerGradeId: '',
            qty: '',
            price: '',
            amount: '',
            calc: true,
          },
        ],
      };
    });
    updateField('offHireRows', rows);
  };

  const removeOffHireBunker = (offId, bunkerId) => {
    const rows = (form.offHireRows || []).map((row) => {
      if (row.id !== offId) return row;
      const bunkers = (row.bunkers || []).filter((b) => b.id !== bunkerId);
      return {
        ...row,
        bunkers: bunkers.length ? bunkers : [{
          id: newBunkerId(),
          bunkerGradeId: '',
          qty: '',
          price: '',
          amount: '',
          calc: true,
        }],
      };
    });
    if (onRecalc) onRecalc('offHireRows', rows);
    else updateField('offHireRows', rows);
  };

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>SECA / NON-SECA Bunker Estimate</span>
          {editable ? (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => addRow('secaBunkerRows', () => createEmptySecaBunkerRow('SECA', 'FO'))}
            >
              + Add
            </button>
          ) : null}
        </div>
        <div className={styles.panelBody}>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Type</th>
                  <th>Grade</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Cost</th>
                  <th>Calc</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {(form.secaBunkerRows || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <select
                        value={row.identify}
                        disabled={readOnly}
                        onChange={(e) => updateRow('secaBunkerRows', row.id, { identify: e.target.value })}
                      >
                        {SECA_IDENTIFY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.bunkerType}
                        disabled={readOnly}
                        onChange={(e) => updateRow('secaBunkerRows', row.id, { bunkerType: e.target.value })}
                      >
                        {BUNKER_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.bunkerGradeId}
                        disabled={readOnly}
                        onChange={(e) => updateRow('secaBunkerRows', row.id, { bunkerGradeId: e.target.value })}
                      >
                        <option value="">Select grade</option>
                        {(lookups.bunkerGrades || []).map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={row.qty}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('secaBunkerRows', row.id, { qty: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.price}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('secaBunkerRows', row.id, { price: e.target.value })}
                      />
                    </td>
                    <td><input value={row.cost} readOnly /></td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!row.calc}
                        disabled={readOnly}
                        onChange={(e) => updateRow('secaBunkerRows', row.id, { calc: e.target.checked })}
                      />
                    </td>
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          onClick={() => removeRow('secaBunkerRows', row.id)}
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
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Passage Locations</span>
          {editable ? (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => addRow('passageLocations', createEmptyPassageLocationRow)}
            >
              + Add
            </button>
          ) : null}
        </div>
        <div className={styles.panelBody}>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Passage</th>
                  <th>Speed</th>
                  <th>Distance</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {(form.passageLocations || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        value={row.fromLocation}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('passageLocations', row.id, { fromLocation: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.toLocation}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('passageLocations', row.id, { toLocation: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={row.passageType}
                        disabled={readOnly}
                        onChange={(e) => updateRow('passageLocations', row.id, { passageType: e.target.value })}
                      >
                        {PASSAGE_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.speedType}
                        disabled={readOnly}
                        onChange={(e) => updateRow('passageLocations', row.id, { speedType: e.target.value })}
                      >
                        {SPEED_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={row.distance}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('passageLocations', row.id, { distance: e.target.value })}
                      />
                    </td>
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          onClick={() => removeRow('passageLocations', row.id)}
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
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Freight Quantity / Vendors</span>
          {editable ? (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => addRow('freightQtyRows', createEmptyFreightQtyRow)}
            >
              + Add
            </button>
          ) : null}
        </div>
        <div className={styles.panelBody}>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Cargo</th>
                  <th>Agreed Freight</th>
                  <th>Qty</th>
                  <th>Gross Freight</th>
                  <th>Brkg %</th>
                  <th>Net Brkg</th>
                  <th>Net Freight</th>
                  <th>Net / MT</th>
                  <th>Currency</th>
                  <th>Local Agreed</th>
                  <th>FX Rate</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {(form.freightQtyRows || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <select
                        value={row.vendorId}
                        disabled={readOnly}
                        onChange={(e) => updateRow('freightQtyRows', row.id, { vendorId: e.target.value })}
                      >
                        <option value="">Select</option>
                        {(lookups.owners || []).map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.cargoId}
                        disabled={readOnly}
                        onChange={(e) => updateRow('freightQtyRows', row.id, { cargoId: e.target.value })}
                      >
                        <option value="">Select</option>
                        {(lookups.cargos || []).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={row.agreedGrossFreight}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('freightQtyRows', row.id, { agreedGrossFreight: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.quantity}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('freightQtyRows', row.id, { quantity: e.target.value })}
                      />
                    </td>
                    <td><input value={row.grossFreight} readOnly /></td>
                    <td>
                      <input
                        value={row.brokeragePercent}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('freightQtyRows', row.id, { brokeragePercent: e.target.value })}
                      />
                    </td>
                    <td><input value={row.netBrokerage} readOnly /></td>
                    <td><input value={row.netFreight} readOnly /></td>
                    <td><input value={row.netFreightPerMt} readOnly /></td>
                    <td>
                      <select
                        value={row.currencyId}
                        disabled={readOnly}
                        onChange={(e) => updateRow('freightQtyRows', row.id, { currencyId: e.target.value })}
                      >
                        <option value="">Select</option>
                        {CURRENCY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={row.localAgreedFreight}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('freightQtyRows', row.id, { localAgreedFreight: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.exchangeRate}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('freightQtyRows', row.id, { exchangeRate: e.target.value })}
                      />
                    </td>
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          onClick={() => removeRow('freightQtyRows', row.id)}
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
        </div>
      </section>

      {isTanker ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Tanker Freight Mode</span>
          </div>
          <div className={styles.panelBody}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="radio"
                  name="tankType"
                  value="1"
                  checked={String(form.tankType || '1') === '1'}
                  disabled={readOnly}
                  onChange={() => applyPatch({ tankType: '1' })}
                />
                <strong>Single</strong>
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="radio"
                  name="tankType"
                  value="2"
                  checked={String(form.tankType || '1') === '2'}
                  disabled={readOnly}
                  onChange={() => applyPatch({ tankType: '2' })}
                />
                <strong>Distributed</strong>
              </label>
              {String(form.tankType || '1') === '1' ? (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  Freight Rate
                  <input
                    value={form.tankerFreightRate || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    onChange={(e) => {
                      const value = e.target.value;
                      applyPatch({ tankerFreightRate: value, marketRate: value });
                    }}
                  />
                </label>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {isTanker && String(form.tankType || '1') === '1' ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Tanker WS Freight Specs</span>
            {editable ? (
              <button
                type="button"
                className={styles.addRowBtn}
                onClick={addTankerWsRow}
              >
                + Add
              </button>
            ) : null}
          </div>
          <div className={styles.panelBody}>
            <div className={styles.tableWrap}>
              <table className={styles.portTable}>
                <thead>
                  <tr>
                    <th>Freight Specs</th>
                    <th>Customer</th>
                    <th>Min Qty</th>
                    <th>Ove Qty</th>
                    <th>Min Flat</th>
                    <th>Ove Flat</th>
                    <th>Min WS</th>
                    <th>Ove WS</th>
                    <th>Min Dis Leg</th>
                    <th>Ove Dis Leg</th>
                    <th>Min Total Dist</th>
                    <th>Ove Total Dist</th>
                    <th>Min Amt</th>
                    <th>Ove Amt</th>
                    <th>Total Qty</th>
                    <th>Total Amt</th>
                    {editable ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {(form.tankerWsRows || []).map((row, rowIndex) => (
                    <React.Fragment key={row.id}>
                      <tr className={styles.tankerWsPortRow}>
                        <td colSpan={editable ? 17 : 16}>
                          <div className={styles.wsPortCombo}>
                            <span className={styles.wsPortComboLabel}>WS Port(s) Combo</span>
                            <div className={styles.wsPortComboField}>
                              <span>From</span>
                              <WsPortMultiSelect
                                id={`wsFromPort_${rowIndex}`}
                                value={row.wsFromPortId}
                                label={row.wsFromPortName}
                                readOnly={readOnly}
                                searchPorts={searchEstimatePorts}
                                onChange={(portIds, portNames) => {
                                  updateTankerWsRow(row.id, {
                                    wsFromPortId: portIds,
                                    wsFromPortName: portNames,
                                  });
                                }}
                              />
                            </div>
                            <div className={styles.wsPortComboField}>
                              <span>To</span>
                              <WsPortMultiSelect
                                id={`wsToPort_${rowIndex}`}
                                value={row.wsToPortId}
                                label={row.wsToPortName}
                                readOnly={readOnly}
                                searchPorts={searchEstimatePorts}
                                onChange={(portIds, portNames) => {
                                  updateTankerWsRow(row.id, {
                                    wsToPortId: portIds,
                                    wsToPortName: portNames,
                                  });
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <input
                            value={row.freightSpecs}
                            readOnly={readOnly}
                            onChange={(e) => handleTankerWsFieldChange(row, 'freightSpecs', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            value={row.customerId}
                            disabled={readOnly}
                            onChange={(e) => handleTankerWsFieldChange(row, 'customerId', e.target.value)}
                          >
                            <option value="">Select</option>
                            {(lookups.owners || []).map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </td>
                        {[
                          'minCargoQty', 'oveCargoQty', 'minFlatRate', 'oveFlatRate',
                          'minWs', 'oveWs', 'minDisLeg', 'oveDisLeg', 'minDistance', 'oveDistance',
                        ].map((key) => (
                          <td key={key}>
                            <input
                              value={row[key]}
                              readOnly={readOnly}
                              onChange={(e) => handleTankerWsFieldChange(row, key, e.target.value)}
                            />
                          </td>
                        ))}
                        <td><input value={row.minAmount} readOnly /></td>
                        <td><input value={row.oveAmount} readOnly /></td>
                        <td><input value={row.totalQty} readOnly /></td>
                        <td><input value={row.totalAmount} readOnly /></td>
                        {editable ? (
                          <td>
                            <button
                              type="button"
                              className={styles.rowRemove}
                              onClick={() => removeRow('tankerWsRows', row.id)}
                              title="Remove"
                            >
                              ×
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Off-Hire</span>
          {editable ? (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => addRow('offHireRows', createEmptyOffHireRow)}
            >
              + Add
            </button>
          ) : null}
        </div>
        <div className={styles.panelBody}>
          {(form.offHireRows || []).map((row) => (
            <div key={row.id} className={styles.nestedBlock}>
              <div className={styles.tableWrap}>
                <table className={styles.portTable}>
                  <thead>
                    <tr>
                      <th>Reason</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Days</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      {editable ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <input
                          value={row.reason}
                          readOnly={readOnly}
                          onChange={(e) => updateRow('offHireRows', row.id, { reason: e.target.value })}
                        />
                      </td>
                      <td>
                        {readOnly ? (
                          <input value={row.from || ''} readOnly />
                        ) : (
                          <DmyDateInput
                            id={`offHireFrom_${row.id}`}
                            enableTime
                            className=""
                            value={row.from || ''}
                            onChange={(value) => updateRow('offHireRows', row.id, { from: value })}
                          />
                        )}
                      </td>
                      <td>
                        {readOnly ? (
                          <input value={row.to || ''} readOnly />
                        ) : (
                          <DmyDateInput
                            id={`offHireTo_${row.id}`}
                            enableTime
                            className=""
                            value={row.to || ''}
                            onChange={(value) => updateRow('offHireRows', row.id, { to: value })}
                          />
                        )}
                      </td>
                      <td>
                        <input
                          value={row.days}
                          readOnly={readOnly}
                          onChange={(e) => updateRow('offHireRows', row.id, { days: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          value={row.rate}
                          readOnly={readOnly}
                          onChange={(e) => updateRow('offHireRows', row.id, { rate: e.target.value })}
                        />
                      </td>
                      <td><input value={row.amount} readOnly /></td>
                      {editable ? (
                        <td>
                          <button
                            type="button"
                            className={styles.rowRemove}
                            onClick={() => removeRow('offHireRows', row.id)}
                            title="Remove"
                          >
                            ×
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className={styles.nestedHeader}>
                <span>Off-hire bunkers</span>
                {editable ? (
                  <button
                    type="button"
                    className={styles.addRowBtn}
                    onClick={() => addOffHireBunker(row.id)}
                  >
                    + Bunker
                  </button>
                ) : null}
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.portTable}>
                  <thead>
                    <tr>
                      <th>Grade</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Amount</th>
                      <th>Calc</th>
                      {editable ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(row.bunkers || []).map((b) => (
                      <tr key={b.id}>
                        <td>
                          <select
                            value={b.bunkerGradeId}
                            disabled={readOnly}
                            onChange={(e) => updateOffHireBunker(row.id, b.id, { bunkerGradeId: e.target.value })}
                          >
                            <option value="">Select</option>
                            {(lookups.bunkerGrades || []).map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={b.qty}
                            readOnly={readOnly}
                            onChange={(e) => updateOffHireBunker(row.id, b.id, { qty: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            value={b.price}
                            readOnly={readOnly}
                            onChange={(e) => updateOffHireBunker(row.id, b.id, { price: e.target.value })}
                          />
                        </td>
                        <td><input value={b.amount} readOnly /></td>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!b.calc}
                            disabled={readOnly}
                            onChange={(e) => updateOffHireBunker(row.id, b.id, { calc: e.target.checked })}
                          />
                        </td>
                        {editable ? (
                          <td>
                            <button
                              type="button"
                              className={styles.rowRemove}
                              onClick={() => removeOffHireBunker(row.id, b.id)}
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
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Delivery Bunkers</span>
          {editable ? (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => addRow('deliveryBunkerRows', () => createEmptyDeliveryBunkerRow('DEL'))}
            >
              + Add
            </button>
          ) : null}
        </div>
        <div className={styles.panelBody}>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Date</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {(form.deliveryBunkerRows || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <select
                        value={row.bunkerGradeId}
                        disabled={readOnly}
                        onChange={(e) => updateRow('deliveryBunkerRows', row.id, { bunkerGradeId: e.target.value })}
                      >
                        <option value="">Select</option>
                        {(lookups.bunkerGrades || []).map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {readOnly ? (
                        <input value={row.bunkerDate || ''} readOnly />
                      ) : (
                        <DmyDateInput
                          id={`delBunDate_${row.id}`}
                          className=""
                          value={row.bunkerDate || ''}
                          onChange={(value) => updateRow('deliveryBunkerRows', row.id, { bunkerDate: value })}
                        />
                      )}
                    </td>
                    <td>
                      <input
                        value={row.qty}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('deliveryBunkerRows', row.id, { qty: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.price}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('deliveryBunkerRows', row.id, { price: e.target.value })}
                      />
                    </td>
                    <td><input value={row.amount} readOnly /></td>
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          onClick={() => removeRow('deliveryBunkerRows', row.id)}
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
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Redelivery Bunkers</span>
          {editable ? (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => addRow('redeliveryBunkerRows', () => createEmptyDeliveryBunkerRow('REDEL'))}
            >
              + Add
            </button>
          ) : null}
        </div>
        <div className={styles.panelBody}>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Date</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {(form.redeliveryBunkerRows || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <select
                        value={row.bunkerGradeId}
                        disabled={readOnly}
                        onChange={(e) => updateRow('redeliveryBunkerRows', row.id, { bunkerGradeId: e.target.value })}
                      >
                        <option value="">Select</option>
                        {(lookups.bunkerGrades || []).map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {readOnly ? (
                        <input value={row.bunkerDate || ''} readOnly />
                      ) : (
                        <DmyDateInput
                          id={`reDelBunDate_${row.id}`}
                          className=""
                          value={row.bunkerDate || ''}
                          onChange={(value) => updateRow('redeliveryBunkerRows', row.id, { bunkerDate: value })}
                        />
                      )}
                    </td>
                    <td>
                      <input
                        value={row.qty}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('redeliveryBunkerRows', row.id, { qty: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.price}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('redeliveryBunkerRows', row.id, { price: e.target.value })}
                      />
                    </td>
                    <td><input value={row.amount} readOnly /></td>
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          onClick={() => removeRow('redeliveryBunkerRows', row.id)}
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
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Linked Invoices</span>
          {editable ? (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => addRow('invoiceRows', createEmptyInvoiceRow)}
            >
              + Add
            </button>
          ) : null}
        </div>
        <div className={styles.panelBody}>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {(form.invoiceRows || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        value={row.invoiceId}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('invoiceRows', row.id, { invoiceId: e.target.value })}
                      />
                    </td>
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          onClick={() => removeRow('invoiceRows', row.id)}
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
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Disponent Owners</span>
          {editable ? (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => addRow('disponentRows', createEmptyDisponentRow)}
            >
              + Add
            </button>
          ) : null}
        </div>
        <div className={styles.panelBody}>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Disponent Owner</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {(form.disponentRows || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        value={row.name}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('disponentRows', row.id, { name: e.target.value })}
                      />
                    </td>
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          onClick={() => removeRow('disponentRows', row.id)}
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
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Voyage Events</span>
          {editable ? (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => addRow('voyageEventRows', createEmptyVoyageEventRow)}
            >
              + Add
            </button>
          ) : null}
        </div>
        <div className={styles.panelBody}>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Event Details</th>
                  <th>Date</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {(form.voyageEventRows || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        value={row.details}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('voyageEventRows', row.id, { details: e.target.value })}
                      />
                    </td>
                    <td>
                      {readOnly ? (
                        <input value={row.eventDate || ''} readOnly />
                      ) : (
                        <DmyDateInput
                          id={`voyageEventDate_${row.id}`}
                          className=""
                          value={row.eventDate || ''}
                          onChange={(value) => updateRow('voyageEventRows', row.id, { eventDate: value })}
                        />
                      )}
                    </td>
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          onClick={() => removeRow('voyageEventRows', row.id)}
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
        </div>
      </section>
    </>
  );
}

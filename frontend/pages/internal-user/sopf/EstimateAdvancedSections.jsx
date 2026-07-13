import React from 'react';
import {
  BUNKER_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  PASSAGE_TYPE_OPTIONS,
  SECA_IDENTIFY_OPTIONS,
  SPEED_TYPE_OPTIONS,
  createEmptyConsumptionRow,
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
}) {
  const editable = !readOnly;
  const isTanker = Number(estimateType) === 2;

  const updateField = (key, value) => {
    onFieldChange?.(key, value);
  };

  const updateRow = (collection, id, patch) => {
    const rows = (form[collection] || []).map((row) => (
      row.id === id ? { ...row, ...patch } : row
    ));
    if (onRecalc) onRecalc(collection, rows);
    else updateField(collection, rows);
  };

  const addRow = (collection, factory) => {
    updateField(collection, [...(form[collection] || []), factory()]);
  };

  const removeRow = (collection, id) => {
    const rows = (form[collection] || []).filter((row) => row.id !== id);
    if (!rows.length) return;
    if (onRecalc) onRecalc(collection, rows);
    else updateField(collection, rows);
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

  const addOffHireBunker = (offId) => {
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
          <span>FO / DO Consumption Matrix</span>
          {editable ? (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() => addRow('consumptionRows', () => createEmptyConsumptionRow('FO'))}
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
                  <th>FO/DO</th>
                  <th>Grade</th>
                  <th>Bal SECA FS</th>
                  <th>Lad SECA FS</th>
                  <th>Bal Non FS</th>
                  <th>Lad Non FS</th>
                  <th>Bal SECA SS</th>
                  <th>Lad SECA SS</th>
                  <th>Inport SECA W</th>
                  <th>Inport Non W</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {(form.consumptionRows || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <select
                        value={row.identify}
                        disabled={readOnly}
                        onChange={(e) => updateRow('consumptionRows', row.id, { identify: e.target.value })}
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
                        onChange={(e) => updateRow('consumptionRows', row.id, { bunkerGradeId: e.target.value })}
                      >
                        <option value="">Select</option>
                        {(lookups.bunkerGrades || []).map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </td>
                    {[
                      'balSecaFs', 'ladSecaFs', 'balNonSecaFs', 'ladNonSecaFs',
                      'balSecaSs', 'ladSecaSs', 'inPortSecaWorking', 'inPortNonSecaWorking',
                    ].map((key) => (
                      <td key={key}>
                        <input
                          value={row[key]}
                          readOnly={readOnly}
                          onChange={(e) => updateRow('consumptionRows', row.id, { [key]: e.target.value })}
                        />
                      </td>
                    ))}
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className={styles.rowRemove}
                          onClick={() => removeRow('consumptionRows', row.id)}
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
            <span>Tanker WS Freight Specs</span>
            {editable ? (
              <button
                type="button"
                className={styles.addRowBtn}
                onClick={() => addRow('tankerWsRows', createEmptyTankerWsRow)}
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
                    <th>Min Dist</th>
                    <th>Ove Dist</th>
                    <th>Min Amt</th>
                    <th>Ove Amt</th>
                    <th>Total Qty</th>
                    <th>Total Amt</th>
                    {editable ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {(form.tankerWsRows || []).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          value={row.freightSpecs}
                          readOnly={readOnly}
                          onChange={(e) => updateRow('tankerWsRows', row.id, { freightSpecs: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          value={row.customerId}
                          disabled={readOnly}
                          onChange={(e) => updateRow('tankerWsRows', row.id, { customerId: e.target.value })}
                        >
                          <option value="">Select</option>
                          {(lookups.owners || []).map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </td>
                      {[
                        'minCargoQty', 'oveCargoQty', 'minFlatRate', 'oveFlatRate',
                        'minWs', 'oveWs', 'minDistance', 'oveDistance',
                      ].map((key) => (
                        <td key={key}>
                          <input
                            value={row[key]}
                            readOnly={readOnly}
                            onChange={(e) => updateRow('tankerWsRows', row.id, { [key]: e.target.value })}
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
                        <input
                          value={row.from}
                          readOnly={readOnly}
                          onChange={(e) => updateRow('offHireRows', row.id, { from: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          value={row.to}
                          readOnly={readOnly}
                          onChange={(e) => updateRow('offHireRows', row.id, { to: e.target.value })}
                        />
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
                      <input
                        value={row.bunkerDate}
                        readOnly={readOnly}
                        placeholder="dd-mm-yyyy"
                        onChange={(e) => updateRow('deliveryBunkerRows', row.id, { bunkerDate: e.target.value })}
                      />
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
                      <input
                        value={row.bunkerDate}
                        readOnly={readOnly}
                        placeholder="dd-mm-yyyy"
                        onChange={(e) => updateRow('redeliveryBunkerRows', row.id, { bunkerDate: e.target.value })}
                      />
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
                      <input
                        value={row.eventDate}
                        readOnly={readOnly}
                        placeholder="dd-mm-yyyy"
                        onChange={(e) => updateRow('voyageEventRows', row.id, { eventDate: e.target.value })}
                      />
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

import React from 'react';
import { Button, DmyDateInput, useAlert } from '@bainbridge/shared-ui';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import RowRemoveButton from './RowRemoveButton.jsx';
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
      <CollapsiblePanel title="SECA / NON-SECA Bunker Estimate" defaultOpen={false} actions={editable ? (<Button type="button" variant="outline" size="sm" label="+ Add" onClick={() => addRow('secaBunkerRows', () => createEmptySecaBunkerRow('SECA', 'FO'))} />) : null}>
<div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 36 }} /> : null}
                  <th>Zone</th>
                  <th>Type</th>
                  <th>Grade</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Cost</th>
                  <th>Calc</th>
                </tr>
              </thead>
              <tbody>
                {(form.secaBunkerRows || []).map((row) => (
                  <tr key={row.id}>
                    {editable ? (
                      <td>
                        <RowRemoveButton onClick={() => removeRow('secaBunkerRows', row.id)} />
                      </td>
                    ) : null}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
</CollapsiblePanel>

      <CollapsiblePanel title="Passage Locations" defaultOpen={false} actions={editable ? (<Button type="button" variant="outline" size="sm" label="+ Add" onClick={() => addRow('passageLocations', createEmptyPassageLocationRow)} />) : null}>
<div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 36 }} /> : null}
                  <th>From</th>
                  <th>To</th>
                  <th>Passage</th>
                  <th>Speed</th>
                  <th>Distance</th>
                </tr>
              </thead>
              <tbody>
                {(form.passageLocations || []).map((row) => (
                  <tr key={row.id}>
                    {editable ? (
                      <td>
                        <RowRemoveButton onClick={() => removeRow('passageLocations', row.id)} />
                      </td>
                    ) : null}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
</CollapsiblePanel>

      <CollapsiblePanel title="Freight Quantity / Vendors" defaultOpen={false} actions={editable ? (<Button type="button" variant="outline" size="sm" label="+ Add" onClick={() => addRow('freightQtyRows', createEmptyFreightQtyRow)} />) : null}>
<div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 36 }} /> : null}
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
                </tr>
              </thead>
              <tbody>
                {(form.freightQtyRows || []).map((row) => (
                  <tr key={row.id}>
                    {editable ? (
                      <td>
                        <RowRemoveButton onClick={() => removeRow('freightQtyRows', row.id)} />
                      </td>
                    ) : null}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
</CollapsiblePanel>

      <CollapsiblePanel title="Off-Hire" defaultOpen={false} actions={editable ? (<Button type="button" variant="outline" size="sm" label="+ Add" onClick={() => addRow('offHireRows', createEmptyOffHireRow)} />) : null}>
{(form.offHireRows || []).map((row) => (
            <div key={row.id} className={styles.nestedBlock}>
              <div className={styles.tableWrap}>
                <table className={styles.portTable}>
                  <thead>
                    <tr>
                      {editable ? <th style={{ width: 36 }} /> : null}
                      <th>Reason</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Days</th>
                      <th>Rate</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {editable ? (
                        <td>
                          <RowRemoveButton onClick={() => removeRow('offHireRows', row.id)} />
                        </td>
                      ) : null}
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
                      {editable ? <th style={{ width: 36 }} /> : null}
                      <th>Grade</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Amount</th>
                      <th>Calc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(row.bunkers || []).map((b) => (
                      <tr key={b.id}>
                        {editable ? (
                          <td>
                            <RowRemoveButton onClick={() => removeOffHireBunker(row.id, b.id)} />
                          </td>
                        ) : null}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
</CollapsiblePanel>

      <CollapsiblePanel title="Delivery Bunkers" defaultOpen={false} actions={editable ? (<Button type="button" variant="outline" size="sm" label="+ Add" onClick={() => addRow('deliveryBunkerRows', () => createEmptyDeliveryBunkerRow('DEL'))} />) : null}>
<div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 36 }} /> : null}
                  <th>Grade</th>
                  <th>Date</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(form.deliveryBunkerRows || []).map((row) => (
                  <tr key={row.id}>
                    {editable ? (
                      <td>
                        <RowRemoveButton onClick={() => removeRow('deliveryBunkerRows', row.id)} />
                      </td>
                    ) : null}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
</CollapsiblePanel>

      <CollapsiblePanel title="Redelivery Bunkers" defaultOpen={false} actions={editable ? (<Button type="button" variant="outline" size="sm" label="+ Add" onClick={() => addRow('redeliveryBunkerRows', () => createEmptyDeliveryBunkerRow('REDEL'))} />) : null}>
<div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 36 }} /> : null}
                  <th>Grade</th>
                  <th>Date</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(form.redeliveryBunkerRows || []).map((row) => (
                  <tr key={row.id}>
                    {editable ? (
                      <td>
                        <RowRemoveButton onClick={() => removeRow('redeliveryBunkerRows', row.id)} />
                      </td>
                    ) : null}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
</CollapsiblePanel>

      <CollapsiblePanel title="Linked Invoices" defaultOpen={false} actions={editable ? (<Button type="button" variant="outline" size="sm" label="+ Add" onClick={() => addRow('invoiceRows', createEmptyInvoiceRow)} />) : null}>
<div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 36 }} /> : null}
                  <th>Invoice ID</th>
                </tr>
              </thead>
              <tbody>
                {(form.invoiceRows || []).map((row) => (
                  <tr key={row.id}>
                    {editable ? (
                      <td>
                        <RowRemoveButton onClick={() => removeRow('invoiceRows', row.id)} />
                      </td>
                    ) : null}
                    <td>
                      <input
                        value={row.invoiceId}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('invoiceRows', row.id, { invoiceId: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
</CollapsiblePanel>

      <CollapsiblePanel title="Disponent Owners" defaultOpen={false} actions={editable ? (<Button type="button" variant="outline" size="sm" label="+ Add" onClick={() => addRow('disponentRows', createEmptyDisponentRow)} />) : null}>
<div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 36 }} /> : null}
                  <th>Disponent Owner</th>
                </tr>
              </thead>
              <tbody>
                {(form.disponentRows || []).map((row) => (
                  <tr key={row.id}>
                    {editable ? (
                      <td>
                        <RowRemoveButton onClick={() => removeRow('disponentRows', row.id)} />
                      </td>
                    ) : null}
                    <td>
                      <input
                        value={row.name}
                        readOnly={readOnly}
                        onChange={(e) => updateRow('disponentRows', row.id, { name: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
</CollapsiblePanel>

      <CollapsiblePanel title="Voyage Events" defaultOpen={false} actions={editable ? (<Button type="button" variant="outline" size="sm" label="+ Add" onClick={() => addRow('voyageEventRows', createEmptyVoyageEventRow)} />) : null}>
<div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 36 }} /> : null}
                  <th>Event Details</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(form.voyageEventRows || []).map((row) => (
                  <tr key={row.id}>
                    {editable ? (
                      <td>
                        <RowRemoveButton onClick={() => removeRow('voyageEventRows', row.id)} />
                      </td>
                    ) : null}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
</CollapsiblePanel>
    </>
  );
}

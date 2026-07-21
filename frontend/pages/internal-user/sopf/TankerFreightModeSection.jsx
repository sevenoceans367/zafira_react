import React from 'react';
import { Button, useAlert } from '@bainbridge/shared-ui';
import { searchEstimatePorts } from '../../../services/estimateDetail.js';
import WsPortMultiSelect from './WsPortMultiSelect.jsx';
import {
  createEmptyCargoRow,
  createEmptyTankerWsRow,
} from './estimateDetail.constants.js';
import { getAddRowBlockMessage } from './estimateValidation.js';
import RowRemoveButton from './RowRemoveButton.jsx';
import styles from './UpdateEstimatePage.module.css';

function Field({ id, label, children }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function sumCargoRows(rows = []) {
  return rows.reduce(
    (acc, row) => ({
      cbm: acc.cbm + (Number(String(row.cargoCbm || '').replace(/,/g, '')) || 0),
      mt: acc.mt + (Number(String(row.cargoMt || '').replace(/,/g, '')) || 0),
      amount: acc.amount + (Number(String(row.amountUsd || '').replace(/,/g, '')) || 0),
    }),
    { cbm: 0, mt: 0, amount: 0 },
  );
}

function CargoDetailsTable({
  title,
  collection,
  rows,
  readOnly,
  editable,
  lookups,
  updateRow,
  addRow,
  removeRow,
  createRow,
  addLabel = '+',
}) {
  const totals = sumCargoRows(rows);

  return (
    <div className={styles.nestedBlock}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong>{title}</strong>
        {editable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            label={addLabel}
            ariaLabel="Add"
            onClick={() => addRow(collection, createRow)}
          />
        ) : null}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.portTable}>
          <thead>
            <tr>
              {editable ? <th style={{ width: 36 }} /> : null}
              <th>Shipper/Charterer</th>
              <th>Cargo</th>
              <th>Cargo (CBM)</th>
              <th>Cargo (MT)</th>
              <th>Rate / MT</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {editable ? (
                  <td>
                    <RowRemoveButton onClick={() => removeRow(collection, row.id)} />
                  </td>
                ) : null}
                <td>
                  <select
                    value={row.charterer || row.vendorId || ''}
                    disabled={readOnly}
                    onChange={(e) => updateRow(collection, row.id, {
                      charterer: e.target.value,
                      vendorId: e.target.value,
                    })}
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
                    onChange={(e) => {
                      const cargo = (lookups.cargos || []).find(
                        (c) => String(c.id) === String(e.target.value),
                      );
                      updateRow(collection, row.id, {
                        cargoId: e.target.value,
                        cargoName: cargo?.name || '',
                      });
                    }}
                  >
                    <option value="">Select</option>
                    {(lookups.cargos || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={row.cargoCbm || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    onChange={(e) => updateRow(collection, row.id, { cargoCbm: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={row.cargoMt || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    onChange={(e) => updateRow(collection, row.id, { cargoMt: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={row.rateUsdMt || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    onChange={(e) => updateRow(collection, row.id, { rateUsdMt: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={row.amountUsd !== '' && row.amountUsd != null ? row.amountUsd : ''}
                    readOnly
                    placeholder="0.00"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={editable ? 3 : 2}><strong>Total</strong></td>
              <td>{totals.cbm.toFixed(2)}</td>
              <td>{totals.mt.toFixed(2)}</td>
              <td />
              <td>{totals.amount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function TankerFreightModeSection({
  form,
  readOnly = false,
  editable = true,
  lookups = { cargos: [], owners: [] },
  inputProps,
  applyPatch,
  updateRow,
  addRow,
  removeRow,
  onRecalc,
  updateField,
}) {
  const alert = useAlert();
  const tankType = String(form.tankType || '1');
  const chkLumpsum = !!form.chkLumpsum;
  const isSingle = tankType === '1';
  const isDistributed = tankType === '2';

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

  const handleChkLumpsumChange = (checked) => {
    const patch = { chkLumpsum: checked };
    if (checked) {
      patch.tankType = '1';
    }
    applyPatch(patch);
  };

  const showRadioDiv = !chkLumpsum;
  const showSingleSection = isSingle || chkLumpsum;
  const showDistributedSection = isDistributed && !chkLumpsum;

  return (
    <>
      <h4 className={styles.subHeading}>Tanker Freight Mode</h4>
      {showRadioDiv ? (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="radio"
              name="tankType"
              value="1"
              checked={isSingle}
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
              checked={isDistributed}
              disabled={readOnly}
              onChange={() => applyPatch({ tankType: '2', chkLumpsum: false })}
            />
            <strong>Distributed</strong>
          </label>
          {isDistributed ? (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              Freight Rate / MT
              <input
                id="tankerFreightRate"
                value={form.tankerFreightRate || ''}
                readOnly={readOnly}
                placeholder="0.00"
                onChange={(e) => {
                  const value = e.target.value;
                  if (onRecalc) {
                    onRecalc('tankerFreightRate', value);
                    onRecalc('marketRate', value);
                    return;
                  }
                  applyPatch({ tankerFreightRate: value, marketRate: value });
                }}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {showSingleSection ? (
        <div className={styles.nestedBlock}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input
              type="checkbox"
              id="chkLumpsum"
              checked={chkLumpsum}
              disabled={readOnly}
              onChange={(e) => handleChkLumpsumChange(e.target.checked)}
            />
            <strong>Lump-sum</strong>
          </label>

          {chkLumpsum ? (
            <div className={styles.headerGrid}>
              <Field id="lumpsumQty" label="Cargo Qty (MT)">
                <input {...inputProps('lumpsumQty', { recalc: true })} />
              </Field>
              <Field id="lumpsum" label="Amount">
                <input {...inputProps('lumpsum', { recalc: true })} />
              </Field>
              <Field id="lumpsumVendor" label="Shipper/Charterer">
                <select
                  id="lumpsumVendor"
                  name="lumpsumVendor"
                  value={form.lumpsumVendor || ''}
                  disabled={readOnly}
                  onChange={(e) => updateField('lumpsumVendor', e.target.value)}
                >
                  <option value="">— Select —</option>
                  {(() => {
                    const options = [...(lookups.owners || [])];
                    const selected = form.lumpsumVendor != null ? String(form.lumpsumVendor) : '';
                    if (
                      selected
                      && !options.some((v) => String(v.code || v.id) === selected)
                    ) {
                      options.unshift({ id: selected, code: selected, name: selected });
                    }
                    return options.map((v) => {
                      const optionValue = String(v.code || v.id || '');
                      return (
                        <option key={optionValue || v.id} value={optionValue}>
                          {v.name}
                        </option>
                      );
                    });
                  })()}
                </select>
              </Field>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <strong>Freight Adjustment</strong>
                {editable ? (
                  <Button type="button" variant="outline" size="sm" label="+" ariaLabel="Add" onClick={addTankerWsRow} />
                ) : null}
              </div>
              {(form.tankerWsRows || []).map((row, rowIndex) => (
                <div key={row.id} className={styles.tankerWsBlock}>
                  <div className={styles.wsPortCombo}>
                    <span className={styles.wsPortComboLabel}>WS Port(s) Combo</span>
                    <div className={styles.wsPortComboField}>
                      <label htmlFor={`wsFromPort_${rowIndex}`}>From</label>
                      <WsPortMultiSelect
                        id={`wsFromPort_${rowIndex}`}
                        value={row.wsFromPortId}
                        label={row.wsFromPortName}
                        readOnly={readOnly}
                        placeholder="Choose Port…"
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
                      <label htmlFor={`wsToPort_${rowIndex}`}>To</label>
                      <WsPortMultiSelect
                        id={`wsToPort_${rowIndex}`}
                        value={row.wsToPortId}
                        label={row.wsToPortName}
                        readOnly={readOnly}
                        placeholder="Choose Port…"
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

                  <div className={styles.tableWrap}>
                    <table className={styles.portTable}>
                      <thead>
                        <tr>
                          <th style={{ width: 36 }} />
                          <th />
                          <th />
                          <th>Flat Rate</th>
                          <th>WS</th>
                          <th>Amount</th>
                          <th>Customer</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            {editable ? (
                              <RowRemoveButton onClick={() => removeRow('tankerWsRows', row.id)} />
                            ) : null}
                          </td>
                          <th scope="row" className={styles.tankerWsRowLabel}>Min Cargo Qty</th>
                          <td>
                            <input
                              id={`minCargoQty_${rowIndex}`}
                              name="minCargoQty"
                              value={row.minCargoQty || ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => handleTankerWsFieldChange(row, 'minCargoQty', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              id={`minFlatRate_${rowIndex}`}
                              name="minFlatRate"
                              value={row.minFlatRate || ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => handleTankerWsFieldChange(row, 'minFlatRate', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              id={`minWs_${rowIndex}`}
                              name="minWs"
                              value={row.minWs || ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => handleTankerWsFieldChange(row, 'minWs', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              id={`minAmount_${rowIndex}`}
                              name="minAmount"
                              value={row.minAmount || ''}
                              readOnly
                              placeholder="0.00"
                            />
                          </td>
                          <td>
                            <select
                              id={`tankCustomer_${rowIndex}`}
                              name="customerId"
                              value={row.customerId || ''}
                              disabled={readOnly}
                              onChange={(e) => handleTankerWsFieldChange(row, 'customerId', e.target.value)}
                            >
                              <option value="">Select</option>
                              {(lookups.owners || []).map((v) => {
                                const optionValue = String(v.code || v.id || '');
                                return (
                                  <option key={optionValue || v.id} value={optionValue}>
                                    {v.name}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                        </tr>
                        <tr>
                          <td />
                          <th scope="row" className={styles.tankerWsRowLabel}>Overage Qty</th>
                          <td>
                            <input
                              id={`oveCargoQty_${rowIndex}`}
                              name="oveCargoQty"
                              value={row.oveCargoQty || ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => handleTankerWsFieldChange(row, 'oveCargoQty', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              id={`oveFlatRate_${rowIndex}`}
                              name="oveFlatRate"
                              value={row.oveFlatRate || ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => handleTankerWsFieldChange(row, 'oveFlatRate', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              id={`oveWs_${rowIndex}`}
                              name="oveWs"
                              value={row.oveWs || ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => handleTankerWsFieldChange(row, 'oveWs', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              id={`oveAmount_${rowIndex}`}
                              name="oveAmount"
                              value={row.oveAmount || ''}
                              readOnly
                              placeholder="0.00"
                            />
                          </td>
                          <td />
                        </tr>
                        <tr>
                          <td />
                          <th scope="row" className={styles.tankerWsRowLabel}>Total Cargo Qty</th>
                          <td>
                            <input
                              id={`totalQty_${rowIndex}`}
                              name="totalQty"
                              value={row.totalQty || ''}
                              readOnly
                              placeholder="0.00"
                            />
                          </td>
                          <td />
                          <td />
                          <td>
                            <input
                              id={`totalAmount_${rowIndex}`}
                              name="totalAmount"
                              value={row.totalAmount || ''}
                              readOnly
                              placeholder="0.00"
                            />
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}

      {showDistributedSection ? (
        <>
          <CargoDetailsTable
            title="Main Cargo Details"
            collection="cargoRows"
            rows={form.cargoRows || []}
            readOnly={readOnly}
            editable={editable}
            lookups={lookups}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
            createRow={() => createEmptyCargoRow(1)}
          />
          <CargoDetailsTable
            title="Overage"
            collection="overageCargoRows"
            rows={form.overageCargoRows || []}
            readOnly={readOnly}
            editable={editable}
            lookups={lookups}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
            createRow={() => createEmptyCargoRow(2)}
            addLabel="+"
          />
          <CargoDetailsTable
            title="Dead-freight"
            collection="deadfreightCargoRows"
            rows={form.deadfreightCargoRows || []}
            readOnly={readOnly}
            editable={editable}
            lookups={lookups}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
            createRow={() => createEmptyCargoRow(3)}
            addLabel="+"
          />
        </>
      ) : null}
    </>
  );
}

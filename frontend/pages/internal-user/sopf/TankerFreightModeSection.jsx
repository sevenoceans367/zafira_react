import React from 'react';
import { RowAddButton, RowDelButton, useAlert } from '@bainbridge/shared-ui';
import { searchEstimatePorts } from '../../../services/estimateDetail.js';
import WsPortMultiSelect from './WsPortMultiSelect.jsx';
import {
  createEmptyCargoRow,
  createEmptyTankerWsRow,
} from './estimateDetail.constants.js';
import { getAddRowBlockMessage } from './estimateValidation.js';
import { sanitizeFieldDecimal, sanitizeEstimatePatch, ESTIMATE_DECIMAL_FIELDS } from './estimateInputSanitize.js';
import WorksheetSelect from '../ops/voyage-financials/WorksheetSelect.jsx';
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

export function CargoDetailsTable({
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
  SelectField = WorksheetSelect,
}) {
  const totals = sumCargoRows(rows);

  return (
    <div className={styles.nestedBlock}>
      <div className={styles.consTitle}>{title}</div>
      <div className={styles.tableWrap}>
        <table className={`${styles.portTable} ${styles.flushGrid}`}>
          <thead>
            <tr>
              {editable ? <th style={{ width: 64 }} /> : null}
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
                    <div className="rowActions">
                      <RowAddButton
                        title="Add row"
                        onClick={() => addRow(collection, createRow)}
                      />
                      <RowDelButton
                        title="Delete row"
                        onClick={() => removeRow(collection, row.id)}
                        disabled={rows.length <= 1}
                      />
                    </div>
                  </td>
                ) : null}
                <td>
                  <SelectField
                    ariaLabel="Shipper/Charterer"
                    placeholder="— Select —"
                    value={String(row.charterer || row.vendorId || '')}
                    disabled={readOnly}
                    options={[
                      { id: '', name: '— Select —' },
                      ...(lookups.owners || []).map((v) => ({ id: String(v.id), name: v.name })),
                    ]}
                    onChange={(value) => updateRow(collection, row.id, {
                      charterer: value,
                      vendorId: value,
                    })}
                  />
                </td>
                <td>
                  <SelectField
                    ariaLabel="Cargo"
                    placeholder="— Select —"
                    value={String(row.cargoId ?? '')}
                    disabled={readOnly}
                    options={[
                      { id: '', name: '— Select —' },
                      ...(lookups.cargos || []).map((c) => ({ id: String(c.id), name: c.name })),
                    ]}
                    onChange={(value) => {
                      const cargo = (lookups.cargos || []).find((c) => String(c.id) === String(value));
                      updateRow(collection, row.id, { cargoId: value, cargoName: cargo?.name || '' });
                    }}
                  />
                </td>
                <td>
                  <input
                    value={row.cargoCbm || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    inputMode="decimal"
                    onChange={(e) => updateRow(collection, row.id, { cargoCbm: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={row.cargoMt || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    inputMode="decimal"
                    onChange={(e) => updateRow(collection, row.id, { cargoMt: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={row.rateUsdMt || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    inputMode="decimal"
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
            {editable && !rows.length ? (
              <tr>
                <td>
                  <div className="rowActions">
                    <RowAddButton title="Add row" onClick={() => addRow(collection, createRow)} />
                  </div>
                </td>
                <td colSpan={6}>No cargo rows yet.</td>
              </tr>
            ) : null}
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
  SelectField = WorksheetSelect,
}) {
  const alert = useAlert();
  const vendorOptions = (selected) => {
    const options = [...(lookups.owners || [])];
    const current = selected != null ? String(selected) : '';
    if (current && !options.some((v) => String(v.code || v.id) === current)) {
      options.unshift({ id: current, code: current, name: current });
    }
    return options.map((v) => ({ id: String(v.code || v.id || ''), name: v.name }));
  };
  const isCoaSpot = String(form.coaSpot || '') === '2';
  const tankType = isCoaSpot ? '1' : String(form.tankType || '1');
  const chkLumpsum = isCoaSpot ? true : (form.chkLumpsum != null ? !!form.chkLumpsum : true);
  const isSingle = tankType === '1';
  const isDistributed = tankType === '2';
  // Spot voyage inside COA: only Single Lift + Lump Sum.
  const cargoTypeLocked = isCoaSpot;
  const calcMethodLocked = isCoaSpot || isDistributed;

  const updateTankerWsRow = (id, patch) => {
    const cleanPatch = sanitizeEstimatePatch(patch);
    const rows = (form.tankerWsRows || []).map((row) => (
      row.id === id ? { ...row, ...cleanPatch } : row
    ));
    const masterPatch = {};
    const first = rows[0];
    if (
      first?.id === id
      && ('wsFromPortId' in cleanPatch || 'wsToPortId' in cleanPatch)
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
    const nextValue = ESTIMATE_DECIMAL_FIELDS.has(key)
      ? sanitizeFieldDecimal(key, value)
      : value;
    const patch = { [key]: nextValue };
    if (key === 'minFlatRate' && nextValue) {
      const half = Number(String(nextValue).replace(/,/g, ''));
      if (Number.isFinite(half)) patch.oveFlatRate = String(Math.round((half / 2) * 100) / 100);
    }
    if (key === 'minWs' && nextValue) {
      patch.oveWs = nextValue;
    }
    updateTankerWsRow(row.id, patch);
  };

  const addTankerWsRow = async () => {
    const blockMessage = getAddRowBlockMessage('tankerWsRows', form.tankerWsRows || []);
    if (blockMessage) {
      await alert({ title: 'Missing Information', message: blockMessage, confirmLabel: 'OK' });
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

  const setCargoType = (nextType) => {
    if (isCoaSpot) return;
    if (nextType === '2') {
      applyPatch({ tankType: '2', chkLumpsum: false });
      return;
    }
    applyPatch({ tankType: '1' });
  };

  const setCalculationMethod = (method) => {
    if (isCoaSpot) return;
    handleChkLumpsumChange(method === 'lumpsum');
  };

  const showSingleSection = isSingle || chkLumpsum;
  const showDistributedSection = isDistributed && !chkLumpsum;

  return (
    <>
      <div className={styles.tankerModeControls}>
        <div className={styles.tankerModeRow}>
          <span className={styles.tankerModeLabel}>1. Cargo Type</span>
          <div className={`${styles.segmented} ${cargoTypeLocked ? styles.segmentedDisabled : ''}`.trim()} role="group" aria-label="Cargo type">
            <button
              type="button"
              className={`${styles.segmentedBtn} ${isSingle ? styles.segmentedBtnActive : ''}`}
              disabled={readOnly || cargoTypeLocked}
              aria-pressed={isSingle}
              title={cargoTypeLocked ? 'Spot voyage inside COA uses Single Lift only' : undefined}
              onClick={() => setCargoType('1')}
            >
              Single Lift
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn} ${isDistributed ? styles.segmentedBtnActive : ''}`}
              disabled={readOnly || cargoTypeLocked}
              aria-pressed={isDistributed}
              title={cargoTypeLocked ? 'Spot voyage inside COA uses Single Lift only' : undefined}
              onClick={() => setCargoType('2')}
            >
              Multiple
            </button>
          </div>
        </div>

        <div className={styles.tankerModeRow}>
          <span className={styles.tankerModeLabel}>2. Calculation Method</span>
          <div className={`${styles.segmented} ${calcMethodLocked ? styles.segmentedDisabled : ''}`.trim()} role="group" aria-label="Calculation method">
            <button
              type="button"
              className={`${styles.segmentedBtn} ${!isDistributed && chkLumpsum ? styles.segmentedBtnActive : ''}`.trim()}
              disabled={readOnly || calcMethodLocked}
              title={
                isCoaSpot
                  ? 'Spot voyage inside COA uses Lump Sum only'
                  : (isDistributed ? 'Calculation method is only available for Single cargo type' : undefined)
              }
              aria-pressed={!isDistributed && chkLumpsum}
              onClick={() => setCalculationMethod('lumpsum')}
            >
              Lump Sum
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn} ${!isDistributed && !chkLumpsum ? styles.segmentedBtnActive : ''}`.trim()}
              disabled={readOnly || calcMethodLocked}
              title={
                isCoaSpot
                  ? 'Spot voyage inside COA uses Lump Sum only'
                  : (isDistributed ? 'Calculation method is only available for Single cargo type' : undefined)
              }
              aria-pressed={!isDistributed && !chkLumpsum}
              onClick={() => setCalculationMethod('worldscale')}
            >
              World Scale
            </button>
          </div>
        </div>
      </div>

      {showSingleSection ? (
        <div className={styles.nestedBlock}>
          {chkLumpsum ? (
            <div className={`${styles.headerGrid} ${styles.gridF3}`}>
              <Field id="lumpsumQty" label="Cargo Qty (MT)">
                <input {...inputProps('lumpsumQty', { recalc: true })} />
              </Field>
              <Field id="lumpsum" label="Amount">
                <input {...inputProps('lumpsum', { recalc: true })} />
              </Field>
              <Field id="lumpsumVendor" label="Shipper/Charterer">
                <SelectField
                  id="lumpsumVendor"
                  ariaLabel="Shipper/Charterer"
                  placeholder="— Select —"
                  value={String(form.lumpsumVendor || '')}
                  disabled={readOnly}
                  options={[{ id: '', name: '— Select —' }, ...vendorOptions(form.lumpsumVendor)]}
                  onChange={(value) => updateField('lumpsumVendor', value)}
                />
              </Field>
            </div>
          ) : (
            <>
              <div className={styles.conspGroupHead}>Freight Adjustment</div>
              {(form.tankerWsRows || []).map((row, rowIndex) => (
                <div key={row.id} className={styles.tankerWsBlock}>
                  <div className={styles.wsPortCombo}>
                    <span className={styles.wsPortComboLabel}>WS Port(s) Combo</span>
                    <div className={styles.wsPortComboField}>
                      <label htmlFor={`wsFromPort_${rowIndex}`}>WS Port(s) Combo — From</label>
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
                      <label htmlFor={`wsToPort_${rowIndex}`}>WS Port(s) Combo — To</label>
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
                    <table className={`${styles.portTable} ${styles.flushGrid}`}>
                      <thead>
                        <tr>
                          <th style={{ width: 64 }} />
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
                              <div className="rowActions">
                                <RowAddButton title="Add row" onClick={addTankerWsRow} />
                                <RowDelButton
                                  title="Delete row"
                                  onClick={() => removeRow('tankerWsRows', row.id)}
                                  disabled={(form.tankerWsRows || []).length <= 1}
                                />
                              </div>
                            ) : null}
                          </td>
                          <th scope="row" className={`${styles.tankerWsRowLabel} ${styles.rowLabel}`}>Min Cargo Qty</th>
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
                            <SelectField
                              id={`tankCustomer_${rowIndex}`}
                              ariaLabel="Customer"
                              placeholder="— Select —"
                              value={String(row.customerId || '')}
                              disabled={readOnly}
                              options={[{ id: '', name: '— Select —' }, ...vendorOptions(row.customerId)]}
                              onChange={(value) => handleTankerWsFieldChange(row, 'customerId', value)}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td />
                          <th scope="row" className={`${styles.tankerWsRowLabel} ${styles.rowLabel}`}>Overage Qty</th>
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
                          <th scope="row" className={`${styles.tankerWsRowLabel} ${styles.rowLabel}`}>Total Cargo Qty</th>
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
            SelectField={SelectField}
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
            SelectField={SelectField}
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
            SelectField={SelectField}
          />
        </>
      ) : null}
    </>
  );
}

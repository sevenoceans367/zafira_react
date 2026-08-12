import React from 'react';
import { AddCircleButton, useAlert } from '@bainbridge/shared-ui';
import {
  CURRENCY_OPTIONS,
  createEmptyCargoRow,
  createEmptyFreightQtyRow,
} from './estimateDetail.constants.js';
import { getAddRowBlockMessage } from './estimateValidation.js';
import { sanitizeFieldDecimal } from './estimateInputSanitize.js';
import { CargoDetailsTable } from './TankerFreightModeSection.jsx';
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

/** PHP distypeDiv1 — Gas: Market (Base Freight) vs Lumpsum + Quantity. */
export function GasFreightModeSection({
  form,
  readOnly = false,
  inputProps,
  applyPatch,
  onRecalc,
}) {
  const gasMarket = String(form.gasMarket || '1');
  const isBaseFreight = gasMarket !== '2';

  const setGasMarket = (next) => {
    const patch = { gasMarket: String(next) };
    if (String(next) === '2') {
      patch.gasBaseRate = '';
    } else {
      patch.gasLumsum = '';
      patch.lumpsum = '';
    }
    applyPatch(patch);
  };

  return (
    <>
      <h4 className={styles.subHeading}>Gas Freight</h4>
      <div className={styles.tankerModeControls}>
        <div className={styles.tankerModeRow}>
          <span className={styles.tankerModeLabel}>CALCULATION METHOD:</span>
          <div className={styles.segmented} role="group" aria-label="Gas freight method">
            <button
              type="button"
              className={`${styles.segmentedBtn} ${isBaseFreight ? styles.segmentedBtnActive : ''}`}
              disabled={readOnly}
              aria-pressed={isBaseFreight}
              onClick={() => setGasMarket('1')}
            >
              Market — Base Freight
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn} ${!isBaseFreight ? styles.segmentedBtnActive : ''}`}
              disabled={readOnly}
              aria-pressed={!isBaseFreight}
              onClick={() => setGasMarket('2')}
            >
              Lumpsum
            </button>
          </div>
        </div>
      </div>

      <div className={styles.headerGrid}>
        {isBaseFreight ? (
          <Field id="gasBaseRate" label="Base Freight (USD/MT)">
            <input {...inputProps('gasBaseRate', { recalc: true })} placeholder="0.00" />
          </Field>
        ) : (
          <Field id="gasLumsum" label="Lumpsum (USD)">
            <input
              id="gasLumsum"
              value={form.gasLumsum || form.lumpsum || ''}
              readOnly={readOnly}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              onChange={(e) => {
                const value = sanitizeFieldDecimal('gasLumsum', e.target.value);
                if (onRecalc) {
                  onRecalc('gasLumsum', value);
                  onRecalc('lumpsum', value);
                  return;
                }
                applyPatch({ gasLumsum: value, lumpsum: value });
              }}
            />
          </Field>
        )}
        <Field id="cargoQuantityGas" label="Quantity (MT)">
          <input {...inputProps('cargoQuantity', { recalc: true })} id="cargoQuantityGas" placeholder="0.00" />
        </Field>
        <Field id="freightGrossGas" label="Gross Freight / Total Freight">
          <input id="freightGrossGas" value={form.freightGross || ''} readOnly placeholder="0.00" />
        </Field>
      </div>
    </>
  );
}

/**
 * PHP Dry Cargo (distypeDiv2 + distypeDiv3):
 * - Single (rdoTankType=1): freight qty vendors + Market Freight/$MT or LS
 * - Multiple / Distributed (rdoTankType=2): Main / Overage / Deadfreight cargo tables
 */
export function DryFreightModeSection({
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
}) {
  const alert = useAlert();
  const tankType = String(form.tankType || '1');
  const isSingle = tankType !== '2';
  const isMultiple = tankType === '2';
  const dryMarket = String(form.dryMarket || '1');
  const isFreightRate = dryMarket !== '2';
  const freightQtyTotalMt = (form.freightQtyRows || []).reduce(
    (sum, row) => sum + (Number(String(row.quantity || '').replace(/,/g, '')) || 0),
    0,
  );

  const setCargoType = (nextType) => {
    if (String(nextType) === '2') {
      applyPatch({ tankType: '2', chkLumpsum: false });
      return;
    }
    applyPatch({ tankType: '1' });
  };

  const setDryMarket = (next) => {
    const patch = { dryMarket: String(next) };
    if (String(next) === '2') {
      patch.marketRate = '';
    } else {
      patch.lumpsum = '';
    }
    applyPatch(patch);
  };

  const addFreightQtyRow = async () => {
    const blockMessage = getAddRowBlockMessage('freightQtyRows', form.freightQtyRows || []);
    if (blockMessage) {
      await alert({ title: 'Missing Information', message: blockMessage, confirmLabel: 'OK' });
      return;
    }
    addRow('freightQtyRows', createEmptyFreightQtyRow);
  };

  return (
    <>
      <h4 className={styles.subHeading}>Dry Cargo Freight</h4>
      <div className={styles.tankerModeControls}>
        <div className={styles.tankerModeRow}>
          <span className={styles.tankerModeLabel}>CARGO TYPE:</span>
          <div className={styles.segmented} role="group" aria-label="Dry cargo type">
            <button
              type="button"
              className={`${styles.segmentedBtn} ${isSingle ? styles.segmentedBtnActive : ''}`}
              disabled={readOnly}
              aria-pressed={isSingle}
              onClick={() => setCargoType('1')}
            >
              Single
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn} ${isMultiple ? styles.segmentedBtnActive : ''}`}
              disabled={readOnly}
              aria-pressed={isMultiple}
              onClick={() => setCargoType('2')}
            >
              Multiple
            </button>
          </div>
          {isMultiple ? (
            <label className={styles.tankerRateField} htmlFor="tankerFreightRateDry">
              Freight Rate / MT
              <input
                id="tankerFreightRateDry"
                value={form.tankerFreightRate || form.marketRate || ''}
                readOnly={readOnly}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
                onChange={(e) => {
                  const value = sanitizeFieldDecimal('tankerFreightRate', e.target.value);
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
      </div>

      {isMultiple ? (
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
          />
          <CargoDetailsTable
            title="Deadfreight"
            collection="deadfreightCargoRows"
            rows={form.deadfreightCargoRows || []}
            readOnly={readOnly}
            editable={editable}
            lookups={lookups}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
            createRow={() => createEmptyCargoRow(3)}
          />
          <div className={styles.headerGrid}>
            <Field id="freightGrossDryMulti" label="Total Freight">
              <input id="freightGrossDryMulti" value={form.freightGross || ''} readOnly placeholder="0.00" />
            </Field>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <strong className={styles.tankerSectionTitle}>Freight Quantity / Vendors</strong>
            {editable ? <AddCircleButton onClick={addFreightQtyRow} /> : null}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  {editable ? <th style={{ width: 36 }} /> : null}
                  <th>Customer</th>
                  <th>Cargo</th>
                  <th>Agreed Gross Freight (Local/MT)</th>
                  <th>Currency</th>
                  <th>Exchange Rate</th>
                  <th>Agreed Gross Freight (USD/MT)</th>
                  <th>Quantity (MT)</th>
                  <th>Gross Freight (USD)</th>
                  <th>Final Net Freight (USD)</th>
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
                        value={row.vendorId || ''}
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
                        value={row.cargoId || ''}
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
                        value={row.localAgreedFreight || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        inputMode="decimal"
                        onChange={(e) => updateRow('freightQtyRows', row.id, {
                          localAgreedFreight: sanitizeFieldDecimal('localAgreedFreight', e.target.value),
                        })}
                      />
                    </td>
                    <td>
                      <select
                        value={row.currencyId || ''}
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
                        value={row.exchangeRate || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        inputMode="decimal"
                        onChange={(e) => updateRow('freightQtyRows', row.id, {
                          exchangeRate: sanitizeFieldDecimal('exchangeRate', e.target.value),
                        })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.agreedGrossFreight || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        inputMode="decimal"
                        onChange={(e) => {
                          const agreedGrossFreight = sanitizeFieldDecimal('agreedGrossFreight', e.target.value);
                          if (onRecalc) {
                            const rows = (form.freightQtyRows || []).map((r) => (
                              r.id === row.id ? { ...r, agreedGrossFreight } : r
                            ));
                            onRecalc('freightQtyRows', rows);
                            return;
                          }
                          updateRow('freightQtyRows', row.id, { agreedGrossFreight });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        value={row.quantity || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        inputMode="decimal"
                        onChange={(e) => {
                          const quantity = sanitizeFieldDecimal('quantity', e.target.value);
                          if (onRecalc) {
                            const rows = (form.freightQtyRows || []).map((r) => (
                              r.id === row.id ? { ...r, quantity } : r
                            ));
                            onRecalc('freightQtyRows', rows);
                            return;
                          }
                          updateRow('freightQtyRows', row.id, { quantity });
                        }}
                      />
                    </td>
                    <td>
                      <input value={row.grossFreight || ''} readOnly placeholder="0.00" />
                    </td>
                    <td>
                      <input value={row.netFreight || ''} readOnly placeholder="0.00" />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={editable ? 8 : 7}><strong>Total</strong></td>
                  <td>{freightQtyTotalMt ? freightQtyTotalMt.toFixed(2) : ''}</td>
                  <td>{form.totalFreightQty || ''}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className={styles.tankerModeControls} style={{ marginTop: 12 }}>
            <div className={styles.tankerModeRow}>
              <span className={styles.tankerModeLabel}>MARKET:</span>
              <div className={styles.segmented} role="group" aria-label="Dry market method">
                <button
                  type="button"
                  className={`${styles.segmentedBtn} ${isFreightRate ? styles.segmentedBtnActive : ''}`}
                  disabled={readOnly}
                  aria-pressed={isFreightRate}
                  onClick={() => setDryMarket('1')}
                >
                  Freight ($/MT)
                </button>
                <button
                  type="button"
                  className={`${styles.segmentedBtn} ${!isFreightRate ? styles.segmentedBtnActive : ''}`}
                  disabled={readOnly}
                  aria-pressed={!isFreightRate}
                  onClick={() => setDryMarket('2')}
                >
                  LS ($)
                </button>
              </div>
            </div>
          </div>

          <div className={styles.headerGrid}>
            {isFreightRate ? (
              <Field id="marketRateDry" label="Freight ($/MT)">
                <input {...inputProps('marketRate', { recalc: true })} id="marketRateDry" placeholder="0.00" />
              </Field>
            ) : (
              <Field id="lumpsumDry" label="LS ($)">
                <input {...inputProps('lumpsum', { recalc: true })} id="lumpsumDry" placeholder="0.00" />
              </Field>
            )}
            <Field id="cargoQuantityDry" label="QTY (MT)">
              <input {...inputProps('cargoQuantity', { recalc: true })} id="cargoQuantityDry" placeholder="0.00" />
            </Field>
            {isFreightRate ? (
              <Field id="dfQty" label="DF Qty (MT)">
                <input {...inputProps('dfQty', { recalc: true })} placeholder="0.00" />
              </Field>
            ) : null}
            <Field id="freightGrossDry" label="Gross Freight">
              <input id="freightGrossDry" value={form.dryGrossFreight || form.freightGross || ''} readOnly placeholder="0.00" />
            </Field>
            <Field id="deadFreightAmt" label="Dead Freight">
              <input id="deadFreightAmt" value={form.deadFreightAmt || ''} readOnly placeholder="0.00" />
            </Field>
            <Field id="freightGrossDryTotal" label="Total Freight">
              <input id="freightGrossDryTotal" value={form.freightGross || ''} readOnly placeholder="0.00" />
            </Field>
          </div>
        </>
      )}
    </>
  );
}

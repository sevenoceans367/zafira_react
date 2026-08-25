import React from 'react';
import {
  createEmptyCargoRow,
} from './estimateDetail.constants.js';
import { sanitizeFieldDecimal } from './estimateInputSanitize.js';
import { CargoDetailsTable } from './TankerFreightModeSection.jsx';
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
  const gasMarket = String(form.gasMarket || '2');
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
 * PHP Dry Cargo:
 * - Single: Market Freight/$MT or LS (+ qty / DF)
 * - Multiple / Distributed: Main / Overage / Deadfreight cargo tables
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
  const tankType = String(form.tankType || '1');
  const isSingle = tankType !== '2';
  const isMultiple = tankType === '2';
  const dryMarket = String(form.dryMarket || '1');
  const isFreightRate = dryMarket !== '2';

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
      // LS mode — clear both rate fields so submit does not keep stale CARGO_RATE
      patch.marketRate = '';
      patch.tankerFreightRate = '';
    } else {
      patch.lumpsum = '';
    }
    applyPatch(patch);
  };

  const setDryFreightRate = (raw) => {
    const value = sanitizeFieldDecimal('marketRate', raw);
    applyPatch({ marketRate: value, tankerFreightRate: value });
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
          <div className={styles.tankerModeControls}>
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
                <input
                  id="marketRateDry"
                  value={form.marketRate || ''}
                  readOnly={readOnly}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(e) => setDryFreightRate(e.target.value)}
                />
              </Field>
            ) : (
              <Field id="lumpsumDry" label="LS ($)">
                <input
                  id="lumpsumDry"
                  value={form.lumpsum || ''}
                  readOnly={readOnly}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(e) => {
                    const value = sanitizeFieldDecimal('lumpsum', e.target.value);
                    if (onRecalc) {
                      onRecalc('lumpsum', value);
                      return;
                    }
                    applyPatch({ lumpsum: value });
                  }}
                />
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

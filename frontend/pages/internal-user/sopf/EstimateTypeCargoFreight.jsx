import React from 'react';
import {
  createEmptyCargoRow,
} from './estimateDetail.constants.js';
import { sanitizeFieldDecimal } from './estimateInputSanitize.js';
import { CargoDetailsTable } from './TankerFreightModeSection.jsx';
import { SingleCargoCommission } from './CargoCommissionBlock.jsx';
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

/** PHP distypeDiv1 — Gas: Market (Base Freight) vs Lumpsum + Quantity. */
export function GasFreightModeSection({
  form,
  readOnly = false,
  editable = true,
  lookups = { owners: [] },
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
      <div className={styles.tankerModeControls}>
        <div className={styles.tankerModeRow}>
          <span className={styles.tankerModeLabel}>Calculation Method</span>
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
      <SingleCargoCommission
        form={form}
        readOnly={readOnly}
        editable={editable}
        lookups={lookups}
        applyPatch={applyPatch}
        onRecalc={onRecalc}
      />
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
  updateField,
}) {
  const tankType = String(form.tankType || '1');
  const isSingle = tankType !== '2';
  const isMultiple = tankType === '2';
  const dryMarket = String(form.dryMarket || '1');
  const isFreightRate = dryMarket !== '2';

  const setLumpsumVendor = (value) => {
    if (updateField) updateField('lumpsumVendor', value);
    else applyPatch({ lumpsumVendor: value });
  };

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

  const shipperOptions = (() => {
    const options = [...(lookups.owners || [])];
    const selected = form.lumpsumVendor != null ? String(form.lumpsumVendor) : '';
    if (selected && !options.some((v) => String(v.code || v.id) === selected)) {
      options.unshift({ id: selected, code: selected, name: selected });
    }
    return [
      { value: '', label: '— Select —' },
      ...options.map((v) => ({
        value: String(v.code || v.id || ''),
        label: v.name,
      })),
    ];
  })();

  const freightRateValue = form.tankerFreightRate || form.marketRate || '';

  return (
    <>
      <div className={`${styles.tankerModeControls} ${styles.tankerModeControlsInline}`}>
        <div className={styles.tankerModeRow}>
          <span className={styles.tankerModeLabel}>1. Cargo Type</span>
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
        </div>
        <div className={styles.tankerModeRow}>
          <span className={styles.tankerModeLabel}>2. Calculation Method</span>
          <div className={`${styles.segmented} ${isMultiple ? styles.segmentedDisabled : ''}`.trim()} role="group" aria-label="Dry market method">
            <button
              type="button"
              className={`${styles.segmentedBtn} ${!isMultiple && isFreightRate ? styles.segmentedBtnActive : ''}`.trim()}
              disabled={readOnly || isMultiple}
              aria-pressed={!isMultiple && isFreightRate}
              title={isMultiple ? 'Calculation method is only available for Single cargo type' : undefined}
              onClick={() => setDryMarket('1')}
            >
              Freight ($/MT)
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn} ${!isMultiple && !isFreightRate ? styles.segmentedBtnActive : ''}`.trim()}
              disabled={readOnly || isMultiple}
              aria-pressed={!isMultiple && !isFreightRate}
              title={isMultiple ? 'Calculation method is only available for Single cargo type' : undefined}
              onClick={() => setDryMarket('2')}
            >
              Lump Sum ($)
            </button>
          </div>
        </div>
        {isSingle ? (
          <div className={styles.tankerModeRow}>
            <span className={styles.tankerModeLabel}>Shipper/Charterer</span>
            <div className={styles.tankerModeSelect}>
              <WorksheetSelect
                id="lumpsumVendorDry"
                ariaLabel="Shipper/Charterer"
                value={form.lumpsumVendor || ''}
                disabled={readOnly}
                placeholder="— Select —"
                options={shipperOptions}
                onChange={(value) => setLumpsumVendor(value)}
              />
            </div>
          </div>
        ) : (
          <div className={styles.tankerModeRow}>
            <span className={styles.tankerModeLabel}>Total Freight</span>
            <input
              id="freightGrossDryMultiple"
              className={styles.tankerModeInput}
              value={form.freightGross || ''}
              readOnly
              placeholder="0.00"
            />
          </div>
        )}
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
            SelectField={WorksheetSelect}
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
            SelectField={WorksheetSelect}
            collapsible
            defaultOpen={false}
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
            SelectField={WorksheetSelect}
            collapsible
            defaultOpen={false}
          />
        </>
      ) : (
        <>
          <div className={`${styles.headerGrid} ${styles.drySingleFields}`}>
            {isFreightRate ? (
              <Field id="tankerFreightRateDry" label="Freight ($/MT)">
                <input
                  id="tankerFreightRateDry"
                  value={freightRateValue}
                  readOnly={readOnly}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(e) => setDryFreightRate(e.target.value)}
                />
              </Field>
            ) : (
              <Field id="lumpsumDry" label="Lump Sum ($)">
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
              <Field id="dfQty" label="Dead freight QTY (MT)">
                <input {...inputProps('dfQty', { recalc: true })} placeholder="0.00" />
              </Field>
            ) : null}
            <Field id="freightGrossDry" label="Gross Freight">
              <input id="freightGrossDry" value={form.dryGrossFreight || form.freightGross || ''} readOnly placeholder="0.00" />
            </Field>
            {isFreightRate ? (
              <Field id="deadFreightAmt" label="Dead Freight">
                <input id="deadFreightAmt" value={form.deadFreightAmt || ''} readOnly placeholder="0.00" />
              </Field>
            ) : null}
            <Field id="freightGrossDryTotal" label="Total Freight">
              <input id="freightGrossDryTotal" value={form.freightGross || ''} readOnly placeholder="0.00" />
            </Field>
          </div>
          <SingleCargoCommission
            form={form}
            readOnly={readOnly}
            editable={editable}
            lookups={lookups}
            applyPatch={applyPatch}
            onRecalc={onRecalc}
          />
        </>
      )}
    </>
  );
}

import React, { useMemo, useState } from 'react';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import {
  LAYTIME_TERM_OPTIONS,
  PORT_BUNKER_GRADE_OPTIONS,
  PORT_FUNCTION_OPTIONS,
  normalizeCargoId,
} from './estimateDetail.constants.js';
import { formatIdleDays, getLaytimeRateUnitLabel } from './estimateCalculations.js';
import { sanitizeDecimalInput } from './estimateInputSanitize.js';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import CargoLoadableModal from './CargoLoadableModal.jsx';
import styles from './UpdateEstimatePage.module.css';

/** Calculator glyph for Cargo Loadable (stroke uses currentColor). */
function LoadableCalcIcon() {
  return (
    <svg
      className={styles.qtyCalcIcon}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="7" y="5.5" width="10" height="3.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="13" r="1.1" fill="currentColor" />
      <circle cx="12" cy="13" r="1.1" fill="currentColor" />
      <circle cx="15.5" cy="13" r="1.1" fill="currentColor" />
      <circle cx="8.5" cy="17" r="1.1" fill="currentColor" />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" />
      <circle cx="15.5" cy="17" r="1.1" fill="currentColor" />
    </svg>
  );
}

const BUNKER_GRADE_LOOKUP = PORT_BUNKER_GRADE_OPTIONS.map((option) => ({
  id: option.value,
  name: option.label,
}));

function shortPortName(name) {
  if (!name) return '—';
  const part = String(name).split(' / ')[0]?.trim();
  return part || name;
}

function buildCargoOptions(cargoRows = [], cargos = []) {
  const cargoName = (id, fallback = '') => (
    cargos.find((item) => String(item.id) === String(id))?.name
    || fallback
    || id
    || 'Cargo'
  );

  // Options = cargos currently chosen in Cargo Name (dynamic with panel)
  const seen = new Set();
  const fromSelected = [];
  for (const row of cargoRows || []) {
    const cargoId = normalizeCargoId(row.cargoId);
    if (!cargoId || seen.has(cargoId)) continue;
    seen.add(cargoId);
    fromSelected.push({
      id: cargoId,
      label: cargoName(cargoId, row.cargoName),
      mt: row.cargoMt || '',
    });
  }

  return fromSelected;
}

/** Ensure select value exists in options (avoids browser showing raw "0"). */
function resolveCargoSelectValue(rawId, options) {
  const id = normalizeCargoId(rawId);
  if (!id) return '';
  return options.some((item) => String(item.id) === id) ? id : '';
}

/** Show stored Portstay Days (synced from Passage dates or qty/rate calc). Editable only for DAP. */
function displayWorkDays(leg, side) {
  const stored = side === 'load' ? leg.loadPortWorkDays : leg.discPortWorkDays;
  return stored || '';
}

function DecimalInput({
  value,
  readOnly,
  placeholder = '0.00',
  maxDecimals = 2,
  onChange,
  onBlur,
  ...rest
}) {
  return (
    <input
      value={value || ''}
      readOnly={readOnly}
      placeholder={placeholder}
      inputMode="decimal"
      autoComplete="off"
      onChange={(e) => onChange(sanitizeDecimalInput(e.target.value, { maxDecimals }))}
      onBlur={onBlur}
      {...rest}
    />
  );
}

function commitIdleDays(patchLeg, legId, key, value) {
  patchLeg(legId, { [key]: formatIdleDays(value) });
}

function BunkerGradeSelect({ value, disabled, onChange }) {
  return (
    <CountryMultiSelect
      compact
      options={BUNKER_GRADE_LOOKUP}
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      placeholder="Grades…"
      searchPlaceholder="Search…"
      disabled={disabled}
    />
  );
}

export default function PortLaytimeSections({
  form,
  readOnly = false,
  lookups = { cargos: [] },
  updateRow,
  onApplyPatch,
}) {
  const [loadableOpen, setLoadableOpen] = useState(false);
  const [loadableCtx, setLoadableCtx] = useState({ portName: '', cargoName: '', side: 'lp' });
  const legs = form.portLegs || [];
  const estimateType = Number(form.estimateType) || 2;
  const isTanker = estimateType === 2;
  const rateUnitLabel = getLaytimeRateUnitLabel(estimateType);
  const cargoOptions = useMemo(
    () => buildCargoOptions(form.cargoRows, lookups.cargos),
    [form.cargoRows, lookups.cargos],
  );

  const openLoadableForLeg = (leg, side) => {
    const cargoId = side === 'lp' ? leg.lpCargoId : leg.dpCargoId;
    const fromOptions = cargoOptions.find((item) => String(item.id) === normalizeCargoId(cargoId));
    const cargoRow = (form.cargoRows || []).find(
      (row) => normalizeCargoId(row.cargoId) === normalizeCargoId(cargoId),
    );
    const cargoName = fromOptions?.label
      || cargoRow?.cargoName
      || (lookups.cargos || []).find((c) => String(c.id) === normalizeCargoId(cargoId))?.name
      || '';
    const portName = side === 'lp'
      ? (leg.fromPortName || leg.fromPortId || '')
      : (leg.toPortName || leg.toPortId || '');
    setLoadableCtx({ portName, cargoName, side });
    setLoadableOpen(true);
  };

  // L/B: Laden (2) → LP + DP; Ballast stays off LP/DP.
  // TP/BP is independent of L/B and always lists every leg.
  const ladenLegs = useMemo(
    () => legs.filter((leg) => String(leg.passageType) === '2'),
    [legs],
  );

  if (!legs.length) {
    return (
      <CollapsiblePanel title="Port Details" defaultOpen>
        <p className={styles.hintText}>Add a passage leg to configure load, discharge, and transit port details.</p>
      </CollapsiblePanel>
    );
  }

  const patchLeg = (legId, patch) => {
    updateRow('portLegs', legId, patch);
  };

  const applyLoadableQty = (qty) => {
    const nextLegs = (form.portLegs || []).map((leg) => {
      if (String(leg.passageType) !== '2') return leg;
      return { ...leg, loadQty: qty, dischargeQty: qty };
    });
    const cargoRows = form.cargoRows || [];
    const nextCargoRows = cargoRows.length === 1
      ? [{ ...cargoRows[0], cargoMt: qty }]
      : cargoRows;
    if (onApplyPatch) {
      onApplyPatch({
        portLegs: nextLegs,
        cargoQuantity: qty,
        loadable: qty,
        ...(cargoRows.length === 1 ? { cargoRows: nextCargoRows } : {}),
      });
      return;
    }
    nextLegs.forEach((leg) => {
      if (String(leg.passageType) !== '2') return;
      updateRow('portLegs', leg.id, { loadQty: qty, dischargeQty: qty });
    });
  };

  const selectPortCargo = (legId, cargoId, side) => {
    const normalized = normalizeCargoId(cargoId);
    const fromOptions = cargoOptions.find((item) => String(item.id) === normalized);
    const cargoRow = (form.cargoRows || []).find(
      (row) => normalizeCargoId(row.cargoId) === normalized,
    );
    // Multiple Main Cargo rows: Qty (MT) = sum of all Cargo (MT); else selected cargo MT
    let mtSum = 0;
    let mtCount = 0;
    for (const row of form.cargoRows || []) {
      const raw = String(row.cargoMt ?? '').trim();
      if (!raw) continue;
      const n = Number(raw.replace(/,/g, ''));
      if (!Number.isFinite(n)) continue;
      mtSum += n;
      mtCount += 1;
    }
    const combinedMt = mtCount > 0 ? String(Math.round(mtSum * 100) / 100) : '';
    const formQty = String(form.cargoQuantity || '').trim();
    const singleMt = cargoRow?.cargoMt || fromOptions?.mt || formQty || '';
    const mt = normalized
      ? (mtCount > 1 ? combinedMt : (singleMt || combinedMt || formQty))
      : '';
    if (side === 'load') {
      patchLeg(legId, {
        lpCargoId: normalized,
        ...(mt ? { loadQty: mt } : {}),
      });
      return;
    }
    patchLeg(legId, {
      dpCargoId: normalized,
      ...(mt ? { dischargeQty: mt } : {}),
    });
  };

  return (
    <>
    <CollapsiblePanel title="Port Details" defaultOpen>
      <div className={styles.portLaytimeStack}>
        <div className={`${styles.portLaytimeBlock} ${styles.portLaytimeLp}`}>
          <div className={styles.portLaytimeTitle}>Load Port (LP)</div>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th className={styles.bunkerGradeCell}>Bunker Grade</th>
                  <th className={styles.portNameCell}>LP</th>
                  <th className={styles.cargoSelectCell}>Cargo</th>
                  <th>Cost</th>
                  <th className={styles.qtyCell}>Qty (MT)</th>
                  <th className={styles.thStack}><span>Rate</span><span>{rateUnitLabel}</span></th>
                  <th>Terms</th>
                  <th className={styles.thStack}><span>Total</span><span>Portstay Days</span></th>
                  <th className={styles.thStack}><span>Idle</span><span>Days</span></th>
                  <th className={styles.secaCol}>SECA?</th>
                </tr>
              </thead>
              <tbody>
                {ladenLegs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className={styles.hintText}>No laden legs — LP applies when L/B is Laden.</td>
                  </tr>
                ) : null}
                {ladenLegs.map((leg) => (
                  <tr key={`lp-${leg.id}`}>
                    <td className={styles.bunkerGradeCell}>
                      <BunkerGradeSelect
                        value={leg.lpBunkerGrades}
                        disabled={readOnly}
                        onChange={(grades) => patchLeg(leg.id, { lpBunkerGrades: grades })}
                      />
                    </td>
                    <td
                      className={styles.portNameCell}
                      title={leg.fromPortName || leg.fromPortId || ''}
                    >
                      <span className={styles.portNameText}>
                        {shortPortName(leg.fromPortName || leg.fromPortId)}
                      </span>
                    </td>
                    <td className={styles.cargoSelectCell}>
                      <select
                        value={resolveCargoSelectValue(leg.lpCargoId, cargoOptions)}
                        disabled={readOnly || !cargoOptions.length}
                        onChange={(e) => selectPortCargo(leg.id, e.target.value, 'load')}
                        title={cargoOptions.find((item) => String(item.id) === normalizeCargoId(leg.lpCargoId))?.label || ''}
                      >
                        <option value="">— Select —</option>
                        {cargoOptions.map((item) => (
                          <option key={`lp-${leg.id}-${item.id}`} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.loadPortCost}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { loadPortCost: value })}
                      />
                    </td>
                    <td className={styles.qtyCell}>
                      <div className={styles.qtyWithCalc}>
                        <DecimalInput
                          value={leg.loadQty}
                          readOnly={readOnly}
                          onChange={(value) => patchLeg(leg.id, { loadQty: value })}
                        />
                        {!readOnly ? (
                          <button
                            type="button"
                            className={styles.qtyCalcBtn}
                            title="Cargo Loadable Calculation"
                            aria-label="Cargo Loadable Calculation"
                            onClick={() => openLoadableForLeg(leg, 'lp')}
                          >
                            <LoadableCalcIcon />
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.loadPortRate}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { loadPortRate: value })}
                      />
                    </td>
                    <td>
                      <select
                        value={leg.loadPortTerms || '1'}
                        disabled={readOnly}
                        onChange={(e) => patchLeg(leg.id, { loadPortTerms: e.target.value })}
                      >
                        {LAYTIME_TERM_OPTIONS.map((option) => (
                          <option key={option.value || 'blank'} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <DecimalInput
                        value={displayWorkDays(leg, 'load')}
                        readOnly={readOnly || String(leg.loadPortTerms) !== '4'}
                        placeholder="0.000"
                        maxDecimals={3}
                        onChange={(value) => patchLeg(leg.id, { loadPortWorkDays: value })}
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.loadPortIdleDays}
                        readOnly={readOnly}
                        placeholder="0.000"
                        maxDecimals={3}
                        onChange={(value) => patchLeg(leg.id, { loadPortIdleDays: value })}
                        onBlur={(e) => {
                          if (readOnly) return;
                          commitIdleDays(patchLeg, leg.id, 'loadPortIdleDays', e.target.value);
                        }}
                      />
                    </td>
                    <td className={styles.secaCol}>
                      <input
                        type="checkbox"
                        className={styles.secaCheck}
                        checked={!!leg.chkLpSeca}
                        disabled={readOnly}
                        onChange={(e) => patchLeg(leg.id, { chkLpSeca: e.target.checked })}
                        title="Use SECA in-port consumption rates"
                        aria-label="LP SECA"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${styles.portLaytimeBlock} ${styles.portLaytimeDp}`}>
          <div className={styles.portLaytimeTitle}>Discharge Port (DP)</div>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th className={styles.bunkerGradeCell}>Bunker Grade</th>
                  <th className={styles.portNameCell}>DP</th>
                  <th className={styles.cargoSelectCell}>Cargo</th>
                  <th>Cost</th>
                  <th className={styles.qtyCell}>Qty (MT)</th>
                  <th className={styles.thStack}><span>Rate</span><span>{rateUnitLabel}</span></th>
                  <th>Terms</th>
                  <th className={styles.thStack}><span>Total</span><span>Portstay Days</span></th>
                  <th className={styles.thStack}><span>Idle</span><span>Days</span></th>
                  <th className={styles.secaCol}>SECA?</th>
                </tr>
              </thead>
              <tbody>
                {ladenLegs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className={styles.hintText}>No laden legs — DP applies when L/B is Laden.</td>
                  </tr>
                ) : null}
                {ladenLegs.map((leg) => (
                  <tr key={`dp-${leg.id}`}>
                    <td className={styles.bunkerGradeCell}>
                      <BunkerGradeSelect
                        value={leg.dpBunkerGrades}
                        disabled={readOnly}
                        onChange={(grades) => patchLeg(leg.id, { dpBunkerGrades: grades })}
                      />
                    </td>
                    <td
                      className={styles.portNameCell}
                      title={leg.toPortName || leg.toPortId || ''}
                    >
                      <span className={styles.portNameText}>
                        {shortPortName(leg.toPortName || leg.toPortId)}
                      </span>
                    </td>
                    <td className={styles.cargoSelectCell}>
                      <select
                        value={resolveCargoSelectValue(leg.dpCargoId, cargoOptions)}
                        disabled={readOnly || !cargoOptions.length}
                        onChange={(e) => selectPortCargo(leg.id, e.target.value, 'disc')}
                        title={cargoOptions.find((item) => String(item.id) === normalizeCargoId(leg.dpCargoId))?.label || ''}
                      >
                        <option value="">— Select —</option>
                        {cargoOptions.map((item) => (
                          <option key={`dp-${leg.id}-${item.id}`} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.discPortCost}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { discPortCost: value })}
                      />
                    </td>
                    <td className={styles.qtyCell}>
                      <div className={styles.qtyWithCalc}>
                        <DecimalInput
                          value={leg.dischargeQty}
                          readOnly={readOnly}
                          onChange={(value) => patchLeg(leg.id, { dischargeQty: value })}
                        />
                        {!readOnly ? (
                          <button
                            type="button"
                            className={styles.qtyCalcBtn}
                            title="Cargo Loadable Calculation"
                            aria-label="Cargo Loadable Calculation"
                            onClick={() => openLoadableForLeg(leg, 'dp')}
                          >
                            <LoadableCalcIcon />
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.discPortRate}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { discPortRate: value })}
                      />
                    </td>
                    <td>
                      <select
                        value={leg.discPortTerms || '1'}
                        disabled={readOnly}
                        onChange={(e) => patchLeg(leg.id, { discPortTerms: e.target.value })}
                      >
                        {LAYTIME_TERM_OPTIONS.map((option) => (
                          <option key={option.value || 'blank-dp'} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <DecimalInput
                        value={displayWorkDays(leg, 'disc')}
                        readOnly={readOnly || String(leg.discPortTerms) !== '4'}
                        placeholder="0.000"
                        maxDecimals={3}
                        onChange={(value) => patchLeg(leg.id, { discPortWorkDays: value })}
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.discPortIdleDays}
                        readOnly={readOnly}
                        placeholder="0.000"
                        maxDecimals={3}
                        onChange={(value) => patchLeg(leg.id, { discPortIdleDays: value })}
                        onBlur={(e) => {
                          if (readOnly) return;
                          commitIdleDays(patchLeg, leg.id, 'discPortIdleDays', e.target.value);
                        }}
                      />
                    </td>
                    <td className={styles.secaCol}>
                      <input
                        type="checkbox"
                        className={styles.secaCheck}
                        checked={!!leg.chkDpSeca}
                        disabled={readOnly}
                        onChange={(e) => patchLeg(leg.id, { chkDpSeca: e.target.checked })}
                        title="Use SECA in-port consumption rates"
                        aria-label="DP SECA"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${styles.portLaytimeBlock} ${styles.portLaytimeTp}`}>
          <div className={styles.portLaytimeTitle}>Transit / Bunkering Port (TP/BP)</div>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th className={styles.bunkerGradeCell}>Bunker Grade</th>
                  <th className={styles.portNameCell}>TP/BP</th>
                  <th>Cost</th>
                  <th>Idle Days</th>
                  <th className={styles.thStack}><span>Charterer&apos;s Account</span><span>(Days)</span></th>
                  <th className={styles.secaCol}>SECA?</th>
                  <th>Region</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg) => (
                  <tr key={`tp-${leg.id}`}>
                    <td className={styles.bunkerGradeCell}>
                      <BunkerGradeSelect
                        value={leg.tpBunkerGrades}
                        disabled={readOnly}
                        onChange={(grades) => patchLeg(leg.id, { tpBunkerGrades: grades })}
                      />
                    </td>
                    <td
                      className={styles.portNameCell}
                      title={leg.toPortName || leg.toPortId || ''}
                    >
                      <span className={styles.portNameText}>
                        {shortPortName(leg.toPortName || leg.toPortId)}
                      </span>
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.transitPortCost}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { transitPortCost: value })}
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.transitIdleDays}
                        readOnly={readOnly}
                        placeholder="0.000"
                        maxDecimals={3}
                        onChange={(value) => patchLeg(leg.id, { transitIdleDays: value })}
                        onBlur={(e) => {
                          if (readOnly) return;
                          commitIdleDays(patchLeg, leg.id, 'transitIdleDays', e.target.value);
                        }}
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.chartererAccountDays}
                        readOnly={readOnly}
                        placeholder="0.000"
                        maxDecimals={3}
                        onChange={(value) => patchLeg(leg.id, { chartererAccountDays: value })}
                        onBlur={(e) => {
                          if (readOnly) return;
                          commitIdleDays(patchLeg, leg.id, 'chartererAccountDays', e.target.value);
                        }}
                      />
                    </td>
                    <td className={styles.secaCol}>
                      <input
                        type="checkbox"
                        className={styles.secaCheck}
                        checked={!!leg.chkTpSeca}
                        disabled={readOnly}
                        onChange={(e) => patchLeg(leg.id, { chkTpSeca: e.target.checked })}
                        title="Use SECA in-port consumption rates"
                        aria-label="TP SECA"
                      />
                    </td>
                    <td>
                      <select
                        value={leg.portFunction || ''}
                        disabled={readOnly}
                        onChange={(e) => patchLeg(leg.id, { portFunction: e.target.value })}
                      >
                        {PORT_FUNCTION_OPTIONS.map((option) => (
                          <option key={option.value || 'blank-pf'} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </CollapsiblePanel>

    <CargoLoadableModal
      open={loadableOpen}
      onClose={() => setLoadableOpen(false)}
      form={form}
      context={loadableCtx}
      showStowage={!isTanker}
      onApply={applyLoadableQty}
    />
    </>
  );
}

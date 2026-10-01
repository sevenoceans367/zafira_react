import React, { useMemo } from 'react';
import CountryMultiSelect from '../../masters/port-cost-type/CountryMultiSelect.jsx';
import {
  LAYTIME_TERM_OPTIONS,
  PORT_BUNKER_GRADE_OPTIONS,
  PORT_FUNCTION_OPTIONS,
  normalizeCargoId,
} from '../../sopf/estimateDetail.constants.js';
import { formatIdleDays, getLaytimeRateUnitLabel } from '../../sopf/estimateCalculations.js';
import { sanitizeDecimalInput } from '../../sopf/estimateInputSanitize.js';
import CollapsiblePanel from '../../sopf/CollapsiblePanel.jsx';
import WorksheetSelect from './WorksheetSelect.jsx';
import styles from './CostSheetEstimatePage.module.css';

const BUNKER_GRADE_LOOKUP = PORT_BUNKER_GRADE_OPTIONS.map((option) => ({
  id: option.value,
  name: option.label,
}));

function shortPortName(name) {
  if (!name) return '—';
  const part = String(name).split(' / ')[0]?.trim();
  return part || name;
}

function vendorSelectOptions(owners = []) {
  return (owners || []).map((vendor) => ({
    key: vendor.id,
    // PHP selVendor option value is vendor CODE.
    value: vendor.code || vendor.id,
    label: vendor.name,
  }));
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
}) {
  const legs = form.portLegs || [];
  const estimateType = Number(form.estimateType) || 2;
  const rateUnitLabel = getLaytimeRateUnitLabel(estimateType);
  const cargoOptions = useMemo(
    () => buildCargoOptions(form.cargoRows, lookups.cargos),
    [form.cargoRows, lookups.cargos],
  );

  // L/B: Laden (2) → LP + DP; Ballast stays off LP/DP.
  // TP/BP is independent of L/B and always lists every leg.
  const ladenLegs = useMemo(
    () => legs.filter((leg) => String(leg.passageType) === '2'),
    [legs],
  );

  if (!legs.length) {
    return (
      <CollapsiblePanel title="Port Details" defaultOpen round className={styles.roundSection}>
        <p className={styles.hintText}>Add a passage leg to configure load, discharge, and transit port details.</p>
      </CollapsiblePanel>
    );
  }

  const patchLeg = (legId, patch) => {
    updateRow('portLegs', legId, patch);
  };

  const selectPortCargo = (legId, cargoId, side) => {
    const normalized = normalizeCargoId(cargoId);
    const fromOptions = cargoOptions.find((item) => String(item.id) === normalized);
    const cargoRow = (form.cargoRows || []).find(
      (row) => normalizeCargoId(row.cargoId) === normalized,
    );
    const mt = normalized
      ? (cargoRow?.cargoMt || fromOptions?.mt || '')
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
    <CollapsiblePanel title="Port Details" defaultOpen round className={styles.roundSection}>
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
                  <th>Qty (MT)</th>
                  <th className={styles.thStack}><span>Rate</span><span>{rateUnitLabel}</span></th>
                  <th className={styles.termsSelectCell}>Terms</th>
                  <th className={styles.thStack}><span>Total</span><span>Portstay Days</span></th>
                  <th className={styles.thStack}><span>Idle</span><span>Days</span></th>
                  <th className={styles.secaCol}>SECA?</th>
                  <th className={styles.vendorSelectCell}>Port Cost Vendor</th>
                </tr>
              </thead>
              <tbody>
                {ladenLegs.length === 0 ? (
                  <tr>
                    <td colSpan={11} className={styles.hintText}>No laden legs — LP applies when L/B is Laden.</td>
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
                      <WorksheetSelect
                        value={resolveCargoSelectValue(leg.lpCargoId, cargoOptions)}
                        disabled={readOnly || !cargoOptions.length}
                        ariaLabel="Load port cargo"
                        options={cargoOptions.map((item) => ({ value: item.id, label: item.label }))}
                        onChange={(value) => selectPortCargo(leg.id, value, 'load')}
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.loadPortCost}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { loadPortCost: value })}
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.loadQty}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { loadQty: value })}
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.loadPortRate}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { loadPortRate: value })}
                      />
                    </td>
                    <td className={styles.termsSelectCell}>
                      <WorksheetSelect
                        value={leg.loadPortTerms || '1'}
                        disabled={readOnly}
                        options={LAYTIME_TERM_OPTIONS}
                        onChange={(value) => patchLeg(leg.id, { loadPortTerms: value })}
                      />
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
                    <td className={styles.vendorSelectCell}>
                      <WorksheetSelect
                        value={leg.lpPortVendorId || ''}
                        disabled={readOnly}
                        options={vendorSelectOptions(lookups.owners)}
                        onChange={(value) => patchLeg(leg.id, { lpPortVendorId: value })}
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
                  <th>Qty (MT)</th>
                  <th className={styles.thStack}><span>Rate</span><span>{rateUnitLabel}</span></th>
                  <th className={styles.termsSelectCell}>Terms</th>
                  <th className={styles.thStack}><span>Total</span><span>Portstay Days</span></th>
                  <th className={styles.thStack}><span>Idle</span><span>Days</span></th>
                  <th className={styles.secaCol}>SECA?</th>
                  <th className={styles.vendorSelectCell}>Port Cost Vendor</th>
                </tr>
              </thead>
              <tbody>
                {ladenLegs.length === 0 ? (
                  <tr>
                    <td colSpan={11} className={styles.hintText}>No laden legs — DP applies when L/B is Laden.</td>
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
                      <WorksheetSelect
                        value={resolveCargoSelectValue(leg.dpCargoId, cargoOptions)}
                        disabled={readOnly || !cargoOptions.length}
                        ariaLabel="Discharge port cargo"
                        options={cargoOptions.map((item) => ({ value: item.id, label: item.label }))}
                        onChange={(value) => selectPortCargo(leg.id, value, 'disc')}
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.discPortCost}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { discPortCost: value })}
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.dischargeQty}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { dischargeQty: value })}
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.discPortRate}
                        readOnly={readOnly}
                        onChange={(value) => patchLeg(leg.id, { discPortRate: value })}
                      />
                    </td>
                    <td className={styles.termsSelectCell}>
                      <WorksheetSelect
                        value={leg.discPortTerms || '1'}
                        disabled={readOnly}
                        options={LAYTIME_TERM_OPTIONS}
                        onChange={(value) => patchLeg(leg.id, { discPortTerms: value })}
                      />
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
                    <td className={styles.vendorSelectCell}>
                      <WorksheetSelect
                        value={leg.dpPortVendorId || ''}
                        disabled={readOnly}
                        options={vendorSelectOptions(lookups.owners)}
                        onChange={(value) => patchLeg(leg.id, { dpPortVendorId: value })}
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
                  <th className={styles.regionSelectCell}>Region</th>
                  <th className={styles.vendorSelectCell}>Vendor</th>
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
                    <td className={styles.regionSelectCell}>
                      <WorksheetSelect
                        value={leg.portFunction || ''}
                        disabled={readOnly}
                        options={PORT_FUNCTION_OPTIONS}
                        onChange={(value) => patchLeg(leg.id, { portFunction: value })}
                      />
                    </td>
                    <td className={styles.vendorSelectCell}>
                      <WorksheetSelect
                        value={leg.tpPortVendorId || ''}
                        disabled={readOnly}
                        options={vendorSelectOptions(lookups.owners)}
                        onChange={(value) => patchLeg(leg.id, { tpPortVendorId: value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </CollapsiblePanel>
  );
}

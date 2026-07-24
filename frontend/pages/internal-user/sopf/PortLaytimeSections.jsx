import React, { useMemo } from 'react';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import {
  LAYTIME_TERM_OPTIONS,
  PORT_BUNKER_GRADE_OPTIONS,
  PORT_FUNCTION_OPTIONS,
} from './estimateDetail.constants.js';
import { calcLaytimeWorkingDays, formatDays } from './estimateCalculations.js';
import { sanitizeDecimalInput } from './estimateInputSanitize.js';
import CollapsiblePanel from './CollapsiblePanel.jsx';
import styles from './UpdateEstimatePage.module.css';

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
    const cargoId = String(row.cargoId || '').trim();
    if (!cargoId || cargoId === '0' || seen.has(cargoId)) continue;
    seen.add(cargoId);
    fromSelected.push({
      id: cargoId,
      label: cargoName(cargoId, row.cargoName),
      mt: row.cargoMt || '',
    });
  }

  return fromSelected;
}

function displayWorkDays(leg, side) {
  const terms = side === 'load' ? leg.loadPortTerms : leg.discPortTerms;
  const qty = side === 'load' ? leg.loadQty : leg.dischargeQty;
  const rate = side === 'load' ? leg.loadPortRate : leg.discPortRate;
  const stored = side === 'load' ? leg.loadPortWorkDays : leg.discPortWorkDays;
  // DAP (terms 4): manual entry — keep typed decimals as-is
  if (String(terms) === '4') return stored || '';
  const computed = calcLaytimeWorkingDays(qty, rate, terms);
  return computed ? formatDays(computed) : (stored || '');
}

function DecimalInput({
  value,
  readOnly,
  placeholder = '0.00',
  maxDecimals = 2,
  onChange,
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
      {...rest}
    />
  );
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
  const cargoOptions = useMemo(
    () => buildCargoOptions(form.cargoRows, lookups.cargos),
    [form.cargoRows, lookups.cargos],
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

  const selectPortCargo = (legId, cargoId, side) => {
    const fromOptions = cargoOptions.find((item) => String(item.id) === String(cargoId));
    const cargoRow = (form.cargoRows || []).find(
      (row) => String(row.cargoId) === String(cargoId),
    );
    const mt = cargoId
      ? (cargoRow?.cargoMt || fromOptions?.mt || '')
      : '';
    if (side === 'load') {
      patchLeg(legId, {
        lpCargoId: cargoId || '',
        ...(mt ? { loadQty: mt } : {}),
      });
      return;
    }
    patchLeg(legId, {
      dpCargoId: cargoId || '',
      ...(mt ? { dischargeQty: mt } : {}),
    });
  };

  return (
    <CollapsiblePanel title="Port Details" defaultOpen>
      <div className={styles.portLaytimeStack}>
        <div className={`${styles.portLaytimeBlock} ${styles.portLaytimeLp}`}>
          <div className={styles.portLaytimeTitle}>Load Port (LP)</div>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Bunker Grade</th>
                  <th>LP</th>
                  <th>Cargo</th>
                  <th>Cost</th>
                  <th>Qty (MT)</th>
                  <th className={styles.thStack}><span>Rate</span><span>(MT/Day)</span></th>
                  <th>Terms</th>
                  <th className={styles.thStack}><span>Total</span><span>Portstay Days</span></th>
                  <th className={styles.thStack}><span>Idle</span><span>Days</span></th>
                  <th className={styles.secaCol}>SECA?</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg) => (
                  <tr key={`lp-${leg.id}`}>
                    <td className={styles.bunkerGradeCell}>
                      <BunkerGradeSelect
                        value={leg.lpBunkerGrades}
                        disabled={readOnly}
                        onChange={(grades) => patchLeg(leg.id, { lpBunkerGrades: grades })}
                      />
                    </td>
                    <td className={styles.portNameCell}>{shortPortName(leg.fromPortName || leg.fromPortId)}</td>
                    <td className={styles.cargoSelectCell}>
                      <select
                        value={leg.lpCargoId || ''}
                        disabled={readOnly || !cargoOptions.length}
                        onChange={(e) => selectPortCargo(leg.id, e.target.value, 'load')}
                        title={cargoOptions.find((item) => String(item.id) === String(leg.lpCargoId))?.label || ''}
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
                  <th>Bunker Grade</th>
                  <th>DP</th>
                  <th>Cargo</th>
                  <th>Cost</th>
                  <th>Qty (MT)</th>
                  <th className={styles.thStack}><span>Rate</span><span>(MT/Day)</span></th>
                  <th>Terms</th>
                  <th className={styles.thStack}><span>Total</span><span>Portstay Days</span></th>
                  <th className={styles.thStack}><span>Idle</span><span>Days</span></th>
                  <th className={styles.secaCol}>SECA?</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg) => (
                  <tr key={`dp-${leg.id}`}>
                    <td className={styles.bunkerGradeCell}>
                      <BunkerGradeSelect
                        value={leg.dpBunkerGrades}
                        disabled={readOnly}
                        onChange={(grades) => patchLeg(leg.id, { dpBunkerGrades: grades })}
                      />
                    </td>
                    <td className={styles.portNameCell}>{shortPortName(leg.toPortName || leg.toPortId)}</td>
                    <td className={styles.cargoSelectCell}>
                      <select
                        value={leg.dpCargoId || ''}
                        disabled={readOnly || !cargoOptions.length}
                        onChange={(e) => selectPortCargo(leg.id, e.target.value, 'disc')}
                        title={cargoOptions.find((item) => String(item.id) === String(leg.dpCargoId))?.label || ''}
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
                  <th>Bunker Grade</th>
                  <th>TP/BP</th>
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
                    <td className={styles.portNameCell}>{shortPortName(leg.toPortName || leg.toPortId)}</td>
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
                      />
                    </td>
                    <td>
                      <DecimalInput
                        value={leg.chartererAccountDays}
                        readOnly={readOnly}
                        placeholder="0.000"
                        maxDecimals={3}
                        onChange={(value) => patchLeg(leg.id, { chartererAccountDays: value })}
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
  );
}

import React, { useMemo } from 'react';
import CountryMultiSelect from '../masters/port-cost-type/CountryMultiSelect.jsx';
import {
  LAYTIME_TERM_OPTIONS,
  PORT_BUNKER_GRADE_OPTIONS,
  PORT_FUNCTION_OPTIONS,
} from './estimateDetail.constants.js';
import { calcLaytimeWorkingDays } from './estimateCalculations.js';
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
  const cargoName = (id) => (
    cargos.find((item) => String(item.id) === String(id))?.name || id || 'Cargo'
  );
  return cargoRows
    .filter((row) => row.cargoId)
    .map((row) => ({
      id: row.id,
      cargoId: row.cargoId,
      label: cargoName(row.cargoId),
      mt: row.cargoMt || '',
    }));
}

function displayWorkDays(leg, side) {
  const terms = side === 'load' ? leg.loadPortTerms : leg.discPortTerms;
  const qty = side === 'load' ? leg.loadQty : leg.dischargeQty;
  const rate = side === 'load' ? leg.loadPortRate : leg.discPortRate;
  const stored = side === 'load' ? leg.loadPortWorkDays : leg.discPortWorkDays;
  if (String(terms) === '4') return stored || '';
  if (stored) return stored;
  const computed = calcLaytimeWorkingDays(qty, rate, terms);
  return computed ? String(computed) : '';
}

function BunkerGradeSelect({ value, disabled, onChange }) {
  return (
    <CountryMultiSelect
      options={BUNKER_GRADE_LOOKUP}
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      placeholder="Grades…"
      searchPlaceholder="Search grade…"
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
      <CollapsiblePanel title="Port Laytime & Bunker Grades" defaultOpen>
        <p className={styles.hintText}>Add a passage leg to configure load, discharge, and transit port details.</p>
      </CollapsiblePanel>
    );
  }

  const patchLeg = (legId, patch) => {
    updateRow('portLegs', legId, patch);
  };

  const applyCargoToQty = (legId, cargoRowId, side) => {
    const cargo = cargoOptions.find((item) => item.id === cargoRowId);
    if (!cargo?.mt) return;
    patchLeg(legId, side === 'load' ? { loadQty: cargo.mt } : { dischargeQty: cargo.mt });
  };

  return (
    <CollapsiblePanel title="Port Laytime & Bunker Grades" defaultOpen>
      <div className={styles.portLaytimeStack}>
        <div className={styles.portLaytimeBlock}>
          <div className={styles.portLaytimeTitle}>Load Port (LP)</div>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Bunker Grade</th>
                  <th>LP</th>
                  <th>Cargo</th>
                  <th>Cost ($)</th>
                  <th>Qty (MT)</th>
                  <th>Rate (MT/Day)</th>
                  <th>Terms</th>
                  <th>Total Portstay Days</th>
                  <th>Idle Days</th>
                  <th>SECA?</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg) => (
                  <tr key={`lp-${leg.id}`}>
                    <td>
                      <BunkerGradeSelect
                        value={leg.lpBunkerGrades}
                        disabled={readOnly}
                        onChange={(grades) => patchLeg(leg.id, { lpBunkerGrades: grades })}
                      />
                    </td>
                    <td className={styles.portNameCell}>{shortPortName(leg.fromPortName || leg.fromPortId)}</td>
                    <td>
                      <select
                        value=""
                        disabled={readOnly || !cargoOptions.length}
                        onChange={(e) => applyCargoToQty(leg.id, e.target.value, 'load')}
                      >
                        <option value="">— Select cargo —</option>
                        {cargoOptions.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={leg.loadPortCost || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { loadPortCost: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={leg.loadQty || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { loadQty: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={leg.loadPortRate || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { loadPortRate: e.target.value })}
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
                      <input
                        value={displayWorkDays(leg, 'load')}
                        readOnly={readOnly || String(leg.loadPortTerms) !== '4'}
                        onChange={(e) => patchLeg(leg.id, { loadPortWorkDays: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={leg.loadPortIdleDays || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { loadPortIdleDays: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!leg.chkLpSeca}
                        disabled={readOnly}
                        onChange={(e) => patchLeg(leg.id, { chkLpSeca: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.portLaytimeBlock}>
          <div className={styles.portLaytimeTitle}>Discharge Port (DP)</div>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Bunker Grade</th>
                  <th>DP</th>
                  <th>Cargo</th>
                  <th>Cost ($)</th>
                  <th>Qty (MT)</th>
                  <th>Rate (MT/Day)</th>
                  <th>Terms</th>
                  <th>Total Portstay Days</th>
                  <th>Idle Days</th>
                  <th>SECA?</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg) => (
                  <tr key={`dp-${leg.id}`}>
                    <td>
                      <BunkerGradeSelect
                        value={leg.dpBunkerGrades}
                        disabled={readOnly}
                        onChange={(grades) => patchLeg(leg.id, { dpBunkerGrades: grades })}
                      />
                    </td>
                    <td className={styles.portNameCell}>{shortPortName(leg.toPortName || leg.toPortId)}</td>
                    <td>
                      <select
                        value=""
                        disabled={readOnly || !cargoOptions.length}
                        onChange={(e) => applyCargoToQty(leg.id, e.target.value, 'disc')}
                      >
                        <option value="">— Select cargo —</option>
                        {cargoOptions.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={leg.discPortCost || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { discPortCost: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={leg.dischargeQty || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { dischargeQty: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={leg.discPortRate || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { discPortRate: e.target.value })}
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
                      <input
                        value={displayWorkDays(leg, 'disc')}
                        readOnly={readOnly || String(leg.discPortTerms) !== '4'}
                        onChange={(e) => patchLeg(leg.id, { discPortWorkDays: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={leg.discPortIdleDays || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { discPortIdleDays: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!leg.chkDpSeca}
                        disabled={readOnly}
                        onChange={(e) => patchLeg(leg.id, { chkDpSeca: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.portLaytimeBlock}>
          <div className={styles.portLaytimeTitle}>Transit / Bunkering Port (TP/BP)</div>
          <div className={styles.tableWrap}>
            <table className={styles.portTable}>
              <thead>
                <tr>
                  <th>Bunker Grade</th>
                  <th>TP/BP</th>
                  <th>Cost ($)</th>
                  <th>Idle Days</th>
                  <th>Charterer&apos;s Account (Days)</th>
                  <th>SECA?</th>
                  <th>Port Function</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg) => (
                  <tr key={`tp-${leg.id}`}>
                    <td>
                      <BunkerGradeSelect
                        value={leg.tpBunkerGrades}
                        disabled={readOnly}
                        onChange={(grades) => patchLeg(leg.id, { tpBunkerGrades: grades })}
                      />
                    </td>
                    <td className={styles.portNameCell}>{shortPortName(leg.toPortName || leg.toPortId)}</td>
                    <td>
                      <input
                        value={leg.transitPortCost || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { transitPortCost: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={leg.transitIdleDays || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { transitIdleDays: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={leg.chartererAccountDays || ''}
                        readOnly={readOnly}
                        placeholder="0.00"
                        onChange={(e) => patchLeg(leg.id, { chartererAccountDays: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!leg.chkTpSeca}
                        disabled={readOnly}
                        onChange={(e) => patchLeg(leg.id, { chkTpSeca: e.target.checked })}
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

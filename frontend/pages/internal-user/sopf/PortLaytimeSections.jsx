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

function buildCargoOptions(cargoRows = [], cargos = [], extraIds = []) {
  const cargoName = (id, fallback = '') => (
    cargos.find((item) => String(item.id) === String(id))?.name
    || fallback
    || id
    || 'Cargo'
  );

  // PHP targetSelectLp/Dp: options = cargos chosen in Cargo Name (selCName)
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

  // Keep persisted LP/DP selections visible even if not in current Cargo Name list
  for (const rawId of extraIds || []) {
    const cargoId = String(rawId || '').trim();
    if (!cargoId || cargoId === '0' || seen.has(cargoId)) continue;
    seen.add(cargoId);
    fromSelected.push({
      id: cargoId,
      label: cargoName(cargoId),
      mt: '',
    });
  }

  if (fromSelected.length) return fromSelected;

  // Fallback: full lookup list so the dropdown is never empty before Cargo Name is set
  return (cargos || [])
    .filter((item) => item.id)
    .map((item) => ({
      id: String(item.id),
      label: item.name || String(item.id),
      mt: '',
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
  const cargoOptions = useMemo(() => {
    const persistedIds = (form.portLegs || []).flatMap((leg) => [leg.lpCargoId, leg.dpCargoId]);
    return buildCargoOptions(form.cargoRows, lookups.cargos, persistedIds);
  }, [form.cargoRows, form.portLegs, lookups.cargos]);

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
                  <th>Charterer&apos;s Account (Days)</th>
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

import React from 'react';
import { RowAddButton, RowDelButton } from '@bainbridge/shared-ui';
import { EstimateTrashIcon } from './RowRemoveButton.jsx';
import {
  ADCOM_COMM_TYPE,
  BROKERAGE_COMM_TYPE,
  createEmptyCargoCommissionRow,
  createEmptyCargoRow,
  defaultCargoCommissions,
} from './estimateDetail.constants.js';
import { sanitizeDecimalInput } from './estimateInputSanitize.js';
import WorksheetSelect from '../ops/voyage-financials/WorksheetSelect.jsx';
import styles from './UpdateEstimatePage.module.css';

function vendorOptions(lookups, selected) {
  const options = [...(lookups.owners || [])];
  const current = selected != null ? String(selected) : '';
  if (current && !options.some((v) => String(v.code || v.id) === current)) {
    options.unshift({ id: current, code: current, name: current });
  }
  return [
    { id: '', name: '— Select —' },
    ...options.map((v) => ({ id: String(v.code || v.id || ''), name: v.name })),
  ];
}

export default function CargoCommissionBlock({
  commissions,
  readOnly = false,
  editable = true,
  lookups = { owners: [] },
  SelectField = WorksheetSelect,
  onChange,
  className = '',
}) {
  const rows = Array.isArray(commissions) && commissions.length
    ? commissions
    : defaultCargoCommissions();

  const patchRow = (id, patch) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    onChange([...rows, createEmptyCargoCommissionRow(BROKERAGE_COMM_TYPE)]);
  };

  const removeRow = (id) => {
    const next = rows.filter((row) => row.id !== id);
    onChange(next.length ? next : defaultCargoCommissions());
  };

  return (
    <div className={`${styles.cargoCommWrap} ${className}`.trim()}>
      <div className={styles.cargoCommTitle}>Commission</div>
      <div className={styles.cargoCommTableWrap}>
        <table className={`${styles.portTable} ${styles.flushGrid} ${styles.cargoCommTable}`}>
          <thead>
            <tr>
              <th className={styles.cargoCommTypeCol}>Type</th>
              <th style={{ width: 110 }}>Percentage (%)</th>
              <th style={{ width: 120 }}>Freight Comm.</th>
              <th style={{ width: 130 }}>Demurrage Comm.</th>
              <th className={styles.cargoCommVendorCol}>Vendor</th>
              {editable ? <th className={styles.stickyAct} /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={styles.cargoCommTypeCol}>
                  <input
                    value={row.commType || ADCOM_COMM_TYPE}
                    readOnly={readOnly}
                    onChange={(e) => patchRow(row.id, { commType: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={row.percent || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    inputMode="decimal"
                    autoComplete="off"
                    onChange={(e) => patchRow(row.id, {
                      percent: sanitizeDecimalInput(e.target.value),
                    })}
                  />
                </td>
                <td>
                  <input value={row.amount || ''} readOnly placeholder="0.00" />
                </td>
                <td>
                  <input
                    value={row.demmAmt || ''}
                    readOnly={readOnly}
                    placeholder="0.00"
                    inputMode="decimal"
                    autoComplete="off"
                    onChange={(e) => patchRow(row.id, {
                      demmAmt: sanitizeDecimalInput(e.target.value),
                    })}
                  />
                </td>
                <td className={styles.cargoCommVendorCol}>
                  <SelectField
                    ariaLabel="Vendor"
                    placeholder="— Select —"
                    value={String(row.vendorId || '')}
                    disabled={readOnly}
                    options={vendorOptions(lookups, row.vendorId)}
                    onChange={(value) => patchRow(row.id, { vendorId: value })}
                  />
                </td>
                {editable ? (
                  <td className={styles.stickyAct}>
                    <div className={styles.khakiRowActions}>
                      <RowAddButton title="Add" onClick={addRow} />
                      <RowDelButton
                        title="Remove"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                      >
                        <EstimateTrashIcon />
                      </RowDelButton>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SingleCargoCommission({
  form,
  readOnly = false,
  editable = true,
  lookups = { owners: [] },
  applyPatch,
  onRecalc,
  SelectField = WorksheetSelect,
}) {
  const row = (form.cargoRows && form.cargoRows[0]) || createEmptyCargoRow(1);
  const commissions = row.commissions?.length ? row.commissions : defaultCargoCommissions();

  const setCommissions = (next) => {
    const rest = (form.cargoRows || []).slice(1);
    const rows = [{ ...row, commissions: next }, ...rest];
    if (onRecalc) onRecalc('cargoRows', rows);
    else applyPatch({ cargoRows: rows });
  };

  return (
    <CargoCommissionBlock
      className={styles.cargoCommStandalone}
      commissions={commissions}
      readOnly={readOnly}
      editable={editable}
      lookups={lookups}
      SelectField={SelectField}
      onChange={setCommissions}
    />
  );
}

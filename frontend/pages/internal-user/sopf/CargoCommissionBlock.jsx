import React from 'react';
import { RowAddButton, RowDelButton } from '@bainbridge/shared-ui';
import { EstimateTrashIcon } from './RowRemoveButton.jsx';
import {
  BROKERAGE_COMM_TYPE,
  createEmptyCargoCommissionRow,
  createEmptyCargoRow,
  defaultPercentForCommType,
  ensureStandardCargoCommissions,
  isAdcomCommission,
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
  const rows = ensureStandardCargoCommissions(commissions);
  const brokerageCount = rows.filter((row) => !isAdcomCommission(row.commType)).length;

  const patchRow = (id, patch) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const setCommType = (id, commType) => {
    const row = rows.find((item) => item.id === id);
    const current = String(row?.percent ?? '').trim();
    const prevDefault = defaultPercentForCommType(row?.commType);
    const patch = { commType };
    if (!current || current === prevDefault) {
      patch.percent = defaultPercentForCommType(commType);
    }
    patchRow(id, patch);
  };

  const addRow = () => {
    onChange([...rows, createEmptyCargoCommissionRow(BROKERAGE_COMM_TYPE)]);
  };

  const removeRow = (id) => {
    const target = rows.find((row) => row.id === id);
    if (!target || isAdcomCommission(target.commType) || brokerageCount <= 1) return;
    onChange(ensureStandardCargoCommissions(rows.filter((row) => row.id !== id)));
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
              <th className={styles.cargoCommVendorCol}>Customer</th>
              {editable ? <th className={styles.stickyAct} /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={styles.cargoCommTypeCol}>
                  <input
                    aria-label="Type"
                    value={row.commType || ''}
                    readOnly={readOnly}
                    onChange={(e) => setCommType(row.id, e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={row.percent || defaultPercentForCommType(row.commType)}
                    readOnly={readOnly}
                    placeholder={isAdcomCommission(row.commType) ? '3.75%' : '1.25%'}
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
                    ariaLabel="Customer"
                    placeholder="— Select —"
                    value={String(row.vendorId || '')}
                    disabled={readOnly}
                    options={vendorOptions(lookups, row.vendorId)}
                    onChange={(value) => patchRow(row.id, { vendorId: value })}
                  />
                </td>
                {editable ? (
                  <td className={styles.stickyAct}>
                    {isAdcomCommission(row.commType) ? null : (
                      <div className={styles.khakiRowActions}>
                        <RowAddButton title="Add brokerage commission" onClick={addRow} />
                        <RowDelButton
                          title="Remove"
                          onClick={() => removeRow(row.id)}
                          disabled={brokerageCount <= 1}
                        >
                          <EstimateTrashIcon />
                        </RowDelButton>
                      </div>
                    )}
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
  const commissions = ensureStandardCargoCommissions(row.commissions);

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

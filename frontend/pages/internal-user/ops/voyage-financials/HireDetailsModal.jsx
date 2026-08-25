import React from 'react';
import { createPortal } from 'react-dom';
import { Button, DmyDateInput } from '@bainbridge/shared-ui';
import {
  createEmptyDeliveryBunkerRow,
  createEmptyHireRow,
  createEmptyOffHireRow,
} from '../../sopf/estimateDetail.constants.js';
import { diffDays } from '../../sopf/estimateCalculations.js';
import { sanitizeFieldDecimal } from '../../sopf/estimateInputSanitize.js';
import RowRemoveButton from '../../sopf/RowRemoveButton.jsx';
import styles from './HireDetailsModal.module.css';

function newOffBunker() {
  return {
    id: `offb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    bunkerGradeId: '',
    qty: '',
    price: '',
    amount: '',
    calc: true,
  };
}

/**
 * PHP updatecost_sheet_tci #compose-modal_TC — Hire Details.
 * Layout: hire table + delivery → left summary + right bunkers/off-hire.
 */
export default function HireDetailsModal({
  open,
  onClose,
  form,
  readOnly = false,
  lookups = {},
  applyPatch,
}) {
  if (!open) return null;

  const hireRows = (form.hireRows || []).length
    ? form.hireRows
    : [createEmptyHireRow()];
  const deliveryBunkerRows = (form.deliveryBunkerRows || []).length
    ? form.deliveryBunkerRows
    : [createEmptyDeliveryBunkerRow('DEL')];
  const redeliveryBunkerRows = (form.redeliveryBunkerRows || []).length
    ? form.redeliveryBunkerRows
    : [createEmptyDeliveryBunkerRow('REDEL')];
  const offHireRows = (form.offHireRows || []).length
    ? form.offHireRows
    : [createEmptyOffHireRow()];

  const vendorOptions = lookups.owners || [];
  const bunkerGrades = lookups.bunkerGrades || [];

  const deliveryTotal = deliveryBunkerRows.reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );
  const redeliveryTotal = redeliveryBunkerRows.reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );
  const bunkerOnOwner = offHireRows.reduce((sum, row) => (
    sum + (row.bunkers || []).reduce(
      (bSum, b) => (b.calc === false ? bSum : bSum + (Number(b.amount) || 0)),
      0,
    )
  ), 0);

  const patchHireRow = (id, patch) => {
    const next = hireRows.map((row) => {
      if (row.id !== id) return row;
      const merged = { ...row, ...patch };
      if (
        Object.prototype.hasOwnProperty.call(patch, 'hireFrom')
        || Object.prototype.hasOwnProperty.call(patch, 'hireTo')
      ) {
        const from = merged.hireFrom || '';
        const to = merged.hireTo || '';
        if (from && to) {
          const days = diffDays(from, to);
          merged.hireDays = days > 0 ? days.toFixed(4) : '';
        }
      }
      if (
        Object.prototype.hasOwnProperty.call(patch, 'hireRate')
        || Object.prototype.hasOwnProperty.call(patch, 'hireDays')
        || Object.prototype.hasOwnProperty.call(patch, 'hireFrom')
        || Object.prototype.hasOwnProperty.call(patch, 'hireTo')
      ) {
        const days = Number(merged.hireDays) || 0;
        const rate = Number(merged.hireRate) || 0;
        merged.hireAmt = days > 0 && rate > 0 ? (days * rate).toFixed(2) : '';
      }
      return merged;
    });

    const first = next[0];
    const formPatch = { hireRows: next };
    if (first && Object.prototype.hasOwnProperty.call(patch, 'hireRate')) {
      formPatch.hireRate = first.hireRate || '';
      formPatch._hireRateCleared = !first.hireRate;
    }
    applyPatch(formPatch);
  };

  const patchBunkerList = (key, rows, id, patch) => {
    const next = rows.map((row) => {
      if (row.id !== id) return row;
      const merged = { ...row, ...patch };
      if (
        Object.prototype.hasOwnProperty.call(patch, 'qty')
        || Object.prototype.hasOwnProperty.call(patch, 'price')
      ) {
        const qty = Number(merged.qty) || 0;
        const price = Number(merged.price) || 0;
        merged.amount = qty > 0 && price > 0 ? (qty * price).toFixed(2) : '';
      }
      return merged;
    });
    applyPatch({ [key]: next });
  };

  const patchOffHireRow = (id, patch) => {
    const next = offHireRows.map((row) => {
      if (row.id !== id) return row;
      const merged = { ...row, ...patch };
      if (
        Object.prototype.hasOwnProperty.call(patch, 'from')
        || Object.prototype.hasOwnProperty.call(patch, 'to')
      ) {
        const from = merged.from || '';
        const to = merged.to || '';
        if (from && to) {
          const days = diffDays(from, to);
          merged.days = days > 0 ? days.toFixed(4) : '';
        }
      }
      if (
        Object.prototype.hasOwnProperty.call(patch, 'days')
        || Object.prototype.hasOwnProperty.call(patch, 'rate')
        || Object.prototype.hasOwnProperty.call(patch, 'from')
        || Object.prototype.hasOwnProperty.call(patch, 'to')
      ) {
        const days = Number(merged.days) || 0;
        const rate = Number(merged.rate) || 0;
        merged.amount = days > 0 && rate > 0 ? (days * rate).toFixed(2) : '';
      }
      return merged;
    });
    applyPatch({ offHireRows: next });
  };

  const patchOffHireBunker = (offId, bunkerId, patch) => {
    const next = offHireRows.map((row) => {
      if (row.id !== offId) return row;
      const bunkers = (row.bunkers || []).map((b) => {
        if (b.id !== bunkerId) return b;
        const merged = { ...b, ...patch };
        if (
          Object.prototype.hasOwnProperty.call(patch, 'qty')
          || Object.prototype.hasOwnProperty.call(patch, 'price')
        ) {
          const qty = Number(merged.qty) || 0;
          const price = Number(merged.price) || 0;
          merged.amount = qty > 0 && price > 0 ? (qty * price).toFixed(2) : '';
        }
        return merged;
      });
      return { ...row, bunkers };
    });
    applyPatch({ offHireRows: next });
  };

  const content = (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="hire-details-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 id="hire-details-title">Hire Details</h3>
          <Button variant="close" label="Close" onClick={onClose} />
        </div>

        <div className={styles.body}>
          {/* Top: Hire rows */}
          <div className={styles.tableWrap}>
            <strong className={styles.sectionTitle}>Hire Details</strong>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th>Hire From</th>
                  <th>Hire To</th>
                  <th>Hire Days</th>
                  <th>Hire/Day (USD)</th>
                  <th>Hire Amt (USD)</th>
                </tr>
              </thead>
              <tbody>
                {hireRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {!readOnly ? (
                        <RowRemoveButton
                          onClick={() => applyPatch({
                            hireRows: hireRows.length > 1
                              ? hireRows.filter((r) => r.id !== row.id)
                              : [createEmptyHireRow()],
                          })}
                        />
                      ) : null}
                    </td>
                    <td>
                      {readOnly ? (
                        <input value={row.hireFrom || ''} readOnly />
                      ) : (
                        <DmyDateInput
                          id={`hireFrom_${row.id}`}
                          enableTime
                          value={row.hireFrom || ''}
                          onChange={(value) => patchHireRow(row.id, { hireFrom: value })}
                        />
                      )}
                    </td>
                    <td>
                      {readOnly ? (
                        <input value={row.hireTo || ''} readOnly />
                      ) : (
                        <DmyDateInput
                          id={`hireTo_${row.id}`}
                          enableTime
                          value={row.hireTo || ''}
                          onChange={(value) => patchHireRow(row.id, { hireTo: value })}
                        />
                      )}
                    </td>
                    <td><input value={row.hireDays || ''} readOnly placeholder="0.0000" /></td>
                    <td>
                      <input
                        value={row.hireRate || ''}
                        readOnly={readOnly}
                        inputMode="decimal"
                        placeholder="0.00"
                        onChange={(e) => {
                          patchHireRow(row.id, {
                            hireRate: sanitizeFieldDecimal('hireRate', e.target.value),
                          });
                        }}
                      />
                    </td>
                    <td><input value={row.hireAmt || ''} readOnly placeholder="0.00" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!readOnly ? (
              <div className={styles.addRow}>
                <button
                  type="button"
                  className={styles.addHireBtn}
                  onClick={() => applyPatch({ hireRows: [...hireRows, createEmptyHireRow()] })}
                >
                  Add Hire
                </button>
              </div>
            ) : null}
          </div>

          {/* Delivery / Re-Delivery */}
          <div className={styles.deliveryGrid}>
            <div className={styles.deliveryBlock}>
              <strong>Delivery</strong>
              <textarea
                rows={2}
                placeholder="Delivery ..."
                value={form.tcDeliveryRange || ''}
                readOnly={readOnly}
                onChange={(e) => applyPatch({ tcDeliveryRange: e.target.value })}
              />
              {readOnly ? (
                <input value={form.tcDeliveryDate || ''} readOnly />
              ) : (
                <DmyDateInput
                  id="tcDeliveryDate"
                  enableTime
                  value={form.tcDeliveryDate || ''}
                  onChange={(value) => applyPatch({ tcDeliveryDate: value })}
                />
              )}
            </div>
            <div className={styles.deliveryBlock}>
              <strong>Re-Delivery</strong>
              <textarea
                rows={2}
                placeholder="Re-Delivery ..."
                value={form.tcRedeliveryRange || ''}
                readOnly={readOnly}
                onChange={(e) => applyPatch({ tcRedeliveryRange: e.target.value })}
              />
              {readOnly ? (
                <input value={form.tcRedeliveryDate || ''} readOnly />
              ) : (
                <DmyDateInput
                  id="tcRedeliveryDate"
                  enableTime
                  value={form.tcRedeliveryDate || ''}
                  onChange={(value) => applyPatch({ tcRedeliveryDate: value })}
                />
              )}
            </div>
          </div>

          {/* Bottom: left summary + right bunkers/off-hire (PHP col-md-5 / col-md-7) */}
          <div className={styles.mainSplit}>
            <div className={styles.summaryPanel}>
              <div className={styles.summaryRow}>
                <span>CP Date</span>
                {readOnly ? (
                  <input value={form.tcCpDate || ''} readOnly />
                ) : (
                  <DmyDateInput
                    id="tcCpDate"
                    value={form.tcCpDate || ''}
                    onChange={(value) => applyPatch({ tcCpDate: value })}
                  />
                )}
              </div>
              <div className={styles.summaryRow}>
                <span>Vendor Name</span>
                <select
                  value={form.dtcVendorId || ''}
                  disabled={readOnly}
                  onChange={(e) => applyPatch({ dtcVendorId: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {vendorOptions.map((vendor) => (
                    <option key={vendor.id} value={vendor.code || vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.summaryRow}>
                <span>Total Voyage Days</span>
                <input value={form.totalHireDays || form.totalDays || ''} readOnly placeholder="0.00" />
              </div>
              <div className={styles.summaryRow}>
                <span>Hireage (USD)</span>
                <input value={form.hireAmt || ''} readOnly placeholder="0.00" />
              </div>
              <div className={styles.summaryRow}>
                <span>Ballast Bonus (USD)</span>
                <input
                  value={form.ballastBonus || ''}
                  readOnly={readOnly}
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(e) => applyPatch({
                    ballastBonus: sanitizeFieldDecimal('ballastBonus', e.target.value),
                  })}
                />
              </div>
              <div className={styles.summaryRow}>
                <span>Gross Hire-age (USD)</span>
                <input value={form.grossHireargeAmt || ''} readOnly placeholder="0.00" />
              </div>
              <div className={styles.summaryRow}>
                <span>Add Comm (%)</span>
                <div className={styles.pair}>
                  <input
                    value={form.hireagePercent || ''}
                    readOnly={readOnly}
                    inputMode="decimal"
                    placeholder="%"
                    onChange={(e) => {
                      const value = sanitizeFieldDecimal('hireagePercent', e.target.value);
                      applyPatch({ hireagePercent: value });
                    }}
                  />
                  <input value={form.hireagePercentAmt || ''} readOnly placeholder="0.00" />
                </div>
              </div>
              <div className={styles.summaryRow}>
                <span>Brokerage (%)</span>
                <div className={styles.pair}>
                  <input
                    value={form.hireageBroPercent || ''}
                    readOnly={readOnly}
                    inputMode="decimal"
                    placeholder="%"
                    onChange={(e) => applyPatch({
                      hireageBroPercent: sanitizeFieldDecimal('hireageBroPercent', e.target.value),
                    })}
                  />
                  <input value={form.hireageBroPercentAmt || ''} readOnly placeholder="0.00" />
                </div>
              </div>
              <div className={styles.summaryRow}>
                <span>Brokerage Vendor</span>
                <select
                  value={form.brokerageVendorId || ''}
                  disabled={readOnly}
                  onChange={(e) => applyPatch({ brokerageVendorId: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {vendorOptions.map((vendor) => (
                    <option key={vendor.id} value={vendor.code || vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.summaryRow}>
                <span>Nett Hire-age (USD)</span>
                <input value={form.nettHireargeAmt || ''} readOnly placeholder="0.00" />
              </div>
              <div className={styles.summaryRow}>
                <span>CVE (Per Month)</span>
                <div className={styles.pair}>
                  <input value={form.cvePerMonth || ''} readOnly placeholder="0.00" />
                  <input value={form.hireageCveAmt || form.cveAmt || ''} readOnly placeholder="0.00" />
                </div>
              </div>
              <div className={styles.summaryRow}>
                <span>CVE Off Hire (Per Month)</span>
                <div className={styles.pair}>
                  <input
                    value={form.offHireCve || ''}
                    readOnly={readOnly}
                    inputMode="decimal"
                    placeholder="0.00"
                    onChange={(e) => applyPatch({
                      offHireCve: sanitizeFieldDecimal('offHireCve', e.target.value),
                    })}
                  />
                  <input value={form.offHireCveAmt || ''} readOnly placeholder="0.00" />
                </div>
              </div>
              <div className={styles.summaryRow}>
                <span>Bunker on Owner&apos;s Account</span>
                <input
                  value={bunkerOnOwner ? bunkerOnOwner.toFixed(2) : (form.bunkerOnOwnerAmt || '')}
                  readOnly
                  placeholder="0.00"
                />
              </div>
              <div className={styles.summaryRow}>
                <span>Off Hire</span>
                <input
                  value={form.lessOffHire || form.totalOffHireAmt || ''}
                  readOnly
                  placeholder="0.00"
                />
              </div>
              <div className={styles.summaryRow}>
                <span>ILOHC</span>
                <input value={form.ilohcForTcDet || ''} readOnly placeholder="0.00" />
              </div>
              <div className={styles.summaryRow}>
                <span>Final Hire-age</span>
                <input
                  value={form.netHireage || form.finalHireargeAmt || ''}
                  readOnly
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className={styles.rightPanel}>
              {/* Delivery Bunkers */}
              <div className={styles.rightBlock}>
                <strong className={styles.sectionTitle}>Delivery Bunkers</strong>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }} />
                      <th>Bunker Grade</th>
                      <th>Qty(MT)</th>
                      <th>Bunker Date</th>
                      <th>Price USD/MT</th>
                      <th>Amount(USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryBunkerRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {!readOnly ? (
                            <RowRemoveButton
                              onClick={() => applyPatch({
                                deliveryBunkerRows: deliveryBunkerRows.length > 1
                                  ? deliveryBunkerRows.filter((r) => r.id !== row.id)
                                  : [createEmptyDeliveryBunkerRow('DEL')],
                              })}
                            />
                          ) : null}
                        </td>
                        <td>
                          <select
                            value={row.bunkerGradeId || ''}
                            disabled={readOnly}
                            onChange={(e) => patchBunkerList(
                              'deliveryBunkerRows',
                              deliveryBunkerRows,
                              row.id,
                              { bunkerGradeId: e.target.value },
                            )}
                          >
                            <option value="">— Select —</option>
                            {bunkerGrades.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={row.qty || ''}
                            readOnly={readOnly}
                            placeholder="0.00"
                            onChange={(e) => patchBunkerList(
                              'deliveryBunkerRows',
                              deliveryBunkerRows,
                              row.id,
                              { qty: sanitizeFieldDecimal('qty', e.target.value) },
                            )}
                          />
                        </td>
                        <td>
                          {readOnly ? (
                            <input value={row.bunkerDate || ''} readOnly />
                          ) : (
                            <DmyDateInput
                              id={`delBunDate_${row.id}`}
                              value={row.bunkerDate || ''}
                              onChange={(value) => patchBunkerList(
                                'deliveryBunkerRows',
                                deliveryBunkerRows,
                                row.id,
                                { bunkerDate: value },
                              )}
                            />
                          )}
                        </td>
                        <td>
                          <input
                            value={row.price || ''}
                            readOnly={readOnly}
                            placeholder="0.00"
                            onChange={(e) => patchBunkerList(
                              'deliveryBunkerRows',
                              deliveryBunkerRows,
                              row.id,
                              { price: sanitizeFieldDecimal('price', e.target.value) },
                            )}
                          />
                        </td>
                        <td><input value={row.amount || ''} readOnly placeholder="0.00" /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>
                        {!readOnly ? (
                          <button
                            type="button"
                            className={styles.addHireBtn}
                            onClick={() => applyPatch({
                              deliveryBunkerRows: [
                                ...deliveryBunkerRows,
                                createEmptyDeliveryBunkerRow('DEL'),
                              ],
                            })}
                          >
                            Add
                          </button>
                        ) : null}
                      </td>
                      <td colSpan={3} />
                      <td>
                        <input
                          value={deliveryTotal ? deliveryTotal.toFixed(2) : ''}
                          readOnly
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Re-Delivery Bunkers */}
              <div className={styles.rightBlock}>
                <strong className={styles.sectionTitle}>Re-Delivery Bunkers</strong>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }} />
                      <th>Bunker Grade</th>
                      <th>Qty(MT)</th>
                      <th>Bunker Date</th>
                      <th>Price USD/MT</th>
                      <th>Amount(USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redeliveryBunkerRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {!readOnly ? (
                            <RowRemoveButton
                              onClick={() => applyPatch({
                                redeliveryBunkerRows: redeliveryBunkerRows.length > 1
                                  ? redeliveryBunkerRows.filter((r) => r.id !== row.id)
                                  : [createEmptyDeliveryBunkerRow('REDEL')],
                              })}
                            />
                          ) : null}
                        </td>
                        <td>
                          <select
                            value={row.bunkerGradeId || ''}
                            disabled={readOnly}
                            onChange={(e) => patchBunkerList(
                              'redeliveryBunkerRows',
                              redeliveryBunkerRows,
                              row.id,
                              { bunkerGradeId: e.target.value },
                            )}
                          >
                            <option value="">— Select —</option>
                            {bunkerGrades.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={row.qty || ''}
                            readOnly={readOnly}
                            placeholder="0.00"
                            onChange={(e) => patchBunkerList(
                              'redeliveryBunkerRows',
                              redeliveryBunkerRows,
                              row.id,
                              { qty: sanitizeFieldDecimal('qty', e.target.value) },
                            )}
                          />
                        </td>
                        <td>
                          {readOnly ? (
                            <input value={row.bunkerDate || ''} readOnly />
                          ) : (
                            <DmyDateInput
                              id={`redelBunDate_${row.id}`}
                              value={row.bunkerDate || ''}
                              onChange={(value) => patchBunkerList(
                                'redeliveryBunkerRows',
                                redeliveryBunkerRows,
                                row.id,
                                { bunkerDate: value },
                              )}
                            />
                          )}
                        </td>
                        <td>
                          <input
                            value={row.price || ''}
                            readOnly={readOnly}
                            placeholder="0.00"
                            onChange={(e) => patchBunkerList(
                              'redeliveryBunkerRows',
                              redeliveryBunkerRows,
                              row.id,
                              { price: sanitizeFieldDecimal('price', e.target.value) },
                            )}
                          />
                        </td>
                        <td><input value={row.amount || ''} readOnly placeholder="0.00" /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>
                        {!readOnly ? (
                          <button
                            type="button"
                            className={styles.addHireBtn}
                            onClick={() => applyPatch({
                              redeliveryBunkerRows: [
                                ...redeliveryBunkerRows,
                                createEmptyDeliveryBunkerRow('REDEL'),
                              ],
                            })}
                          >
                            Add
                          </button>
                        ) : null}
                      </td>
                      <td colSpan={3} />
                      <td>
                        <input
                          value={redeliveryTotal ? redeliveryTotal.toFixed(2) : ''}
                          readOnly
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Off Hire */}
              <div className={styles.rightBlock}>
                <strong className={styles.sectionTitle}>Off Hire</strong>
                {offHireRows.map((row) => (
                  <div key={row.id} className={styles.offHireBlock}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ width: 28 }} />
                          <th>Off Hire Reason</th>
                          <th>Off Hire From</th>
                          <th>Off Hire To</th>
                          <th>Off Hire Days</th>
                          <th>Off Hire Rate/Day(USD)</th>
                          <th>Off Hire</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            {!readOnly ? (
                              <RowRemoveButton
                                onClick={() => applyPatch({
                                  offHireRows: offHireRows.length > 1
                                    ? offHireRows.filter((r) => r.id !== row.id)
                                    : [createEmptyOffHireRow()],
                                })}
                              />
                            ) : null}
                          </td>
                          <td>
                            <textarea
                              rows={2}
                              value={row.reason || ''}
                              readOnly={readOnly}
                              placeholder="Off Hire Reason"
                              onChange={(e) => patchOffHireRow(row.id, { reason: e.target.value })}
                            />
                          </td>
                          <td>
                            {readOnly ? (
                              <input value={row.from || ''} readOnly />
                            ) : (
                              <DmyDateInput
                                id={`offFrom_${row.id}`}
                                enableTime
                                value={row.from || ''}
                                onChange={(value) => patchOffHireRow(row.id, { from: value })}
                              />
                            )}
                          </td>
                          <td>
                            {readOnly ? (
                              <input value={row.to || ''} readOnly />
                            ) : (
                              <DmyDateInput
                                id={`offTo_${row.id}`}
                                enableTime
                                value={row.to || ''}
                                onChange={(value) => patchOffHireRow(row.id, { to: value })}
                              />
                            )}
                          </td>
                          <td>
                            <input
                              value={row.days || ''}
                              readOnly={readOnly}
                              placeholder="0.0000"
                              onChange={(e) => patchOffHireRow(row.id, {
                                days: sanitizeFieldDecimal('hireDays', e.target.value),
                              })}
                            />
                          </td>
                          <td>
                            <input
                              value={row.rate || ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => patchOffHireRow(row.id, {
                                rate: sanitizeFieldDecimal('hireRate', e.target.value),
                              })}
                            />
                          </td>
                          <td><input value={row.amount || ''} readOnly placeholder="0.00" /></td>
                        </tr>
                      </tbody>
                    </table>

                    <table className={styles.table} style={{ marginTop: 6 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 28 }} />
                          <th>Bunker Grade</th>
                          <th>Qty(MT)</th>
                          <th>Price(USD)</th>
                          <th>Amount(USD)</th>
                          <th>On Owner&apos;s Account</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(row.bunkers || []).map((b) => (
                          <tr key={b.id}>
                            <td>
                              {!readOnly ? (
                                <RowRemoveButton
                                  onClick={() => {
                                    const bunkers = (row.bunkers || []).length > 1
                                      ? row.bunkers.filter((x) => x.id !== b.id)
                                      : [newOffBunker()];
                                    patchOffHireRow(row.id, { bunkers });
                                  }}
                                />
                              ) : null}
                            </td>
                            <td>
                              <select
                                value={b.bunkerGradeId || ''}
                                disabled={readOnly}
                                onChange={(e) => patchOffHireBunker(row.id, b.id, {
                                  bunkerGradeId: e.target.value,
                                })}
                              >
                                <option value="">— Select —</option>
                                {bunkerGrades.map((g) => (
                                  <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                value={b.qty || ''}
                                readOnly={readOnly}
                                placeholder="0.00"
                                onChange={(e) => patchOffHireBunker(row.id, b.id, {
                                  qty: sanitizeFieldDecimal('qty', e.target.value),
                                })}
                              />
                            </td>
                            <td>
                              <input
                                value={b.price || ''}
                                readOnly={readOnly}
                                placeholder="0.00"
                                onChange={(e) => patchOffHireBunker(row.id, b.id, {
                                  price: sanitizeFieldDecimal('price', e.target.value),
                                })}
                              />
                            </td>
                            <td><input value={b.amount || ''} readOnly placeholder="0.00" /></td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={b.calc !== false}
                                disabled={readOnly}
                                onChange={(e) => patchOffHireBunker(row.id, b.id, {
                                  calc: e.target.checked,
                                })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!readOnly ? (
                      <div className={styles.addRow}>
                        <button
                          type="button"
                          className={styles.addHireBtn}
                          onClick={() => patchOffHireRow(row.id, {
                            bunkers: [...(row.bunkers || []), newOffBunker()],
                          })}
                        >
                          Add Bunkers
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {!readOnly ? (
                  <div className={styles.addRow}>
                    <button
                      type="button"
                      className={styles.addHireBtn}
                      onClick={() => applyPatch({
                        offHireRows: [...offHireRows, createEmptyOffHireRow()],
                      })}
                    >
                      Add Off-Hire
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="primary" label="Close" onClick={onClose} />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

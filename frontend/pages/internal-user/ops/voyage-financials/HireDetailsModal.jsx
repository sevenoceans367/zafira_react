import React from 'react';
import { createPortal } from 'react-dom';
import { DmyDateInput } from '@bainbridge/shared-ui';
import WorksheetSelect from './WorksheetSelect.jsx';
import {
  createEmptyDeliveryBunkerRow,
  createEmptyHireRow,
  createEmptyOffHireRow,
} from '../../sopf/estimateDetail.constants.js';
import { diffDays } from '../../sopf/estimateCalculations.js';
import { sanitizeFieldDecimal } from '../../sopf/estimateInputSanitize.js';
import styles from './HireDetailsModal.module.css';

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16" />
      <path d="M6 7V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function Field({ label, children, hero = false }) {
  return (
    <div className={hero ? `${styles.field} ${styles.hero}` : styles.field}>
      <label>{label}</label>
      {children}
    </div>
  );
}

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

  const offHireDayTotal = offHireRows.reduce((sum, row) => sum + (Number(row.days) || 0), 0);
  const offHireAmtTotal = offHireRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const vendors = vendorOptions.map((vendor) => ({
    value: vendor.code || vendor.id,
    label: vendor.name,
  }));
  const grades = bunkerGrades.map((grade) => ({ value: grade.id, label: grade.name }));

  const bunkerCards = [
    {
      pill: 'Delivery',
      key: 'deliveryBunkerRows',
      rows: deliveryBunkerRows,
      identity: 'DEL',
      total: deliveryTotal,
    },
    {
      pill: 'Redelivery',
      key: 'redeliveryBunkerRows',
      rows: redeliveryBunkerRows,
      identity: 'REDEL',
      total: redeliveryTotal,
    },
  ];

  const content = (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hire-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headLeft}>
            <span className={styles.headIcon}><DocIcon /></span>
            <h3 id="hire-details-title">TC-in Hire</h3>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body}>
          <section>
            <strong className={styles.sectionTitle}><span>1</span>Hire Details</strong>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 64 }} />
                    <th>Hire From</th>
                    <th>Hire To</th>
                    <th>Hire Days</th>
                    <th>Hire/Day</th>
                    <th>Hire Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {hireRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {!readOnly ? (
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.iconAdd}
                              title="Add hire period"
                              onClick={() => applyPatch({ hireRows: [...hireRows, createEmptyHireRow()] })}
                            >
                              <PlusIcon />
                            </button>
                            <button
                              type="button"
                              className={styles.iconDel}
                              title="Remove"
                              onClick={() => applyPatch({
                                hireRows: hireRows.length > 1
                                  ? hireRows.filter((item) => item.id !== row.id)
                                  : [createEmptyHireRow()],
                              })}
                            >
                              <TrashIcon />
                            </button>
                          </div>
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
                          onChange={(e) => patchHireRow(row.id, {
                            hireRate: sanitizeFieldDecimal('hireRate', e.target.value),
                          })}
                        />
                      </td>
                      <td><input value={row.hireAmt || ''} readOnly placeholder="0.00" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <strong className={styles.sectionTitle}><span>2</span>Delivery</strong>
            <div className={styles.delGrid}>
              <div className={styles.delRow}>
                <Field label="Del Port/Region">
                  <textarea
                    rows={1}
                    placeholder="Delivery port / region"
                    value={form.tcDeliveryRange || ''}
                    readOnly={readOnly}
                    onChange={(e) => applyPatch({ tcDeliveryRange: e.target.value })}
                  />
                </Field>
                <div className={styles.dateSlot}>
                  <Field label="Del Date">
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
                  </Field>
                </div>
              </div>
              <div className={styles.delRow}>
                <Field label="Re-Del Port/Region">
                  <textarea
                    rows={1}
                    placeholder="Re-delivery port / region"
                    value={form.tcRedeliveryRange || ''}
                    readOnly={readOnly}
                    onChange={(e) => applyPatch({ tcRedeliveryRange: e.target.value })}
                  />
                </Field>
                <div className={styles.dateSlot}>
                  <Field label="Redel Date">
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
                  </Field>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className={styles.splitTitles}>
              <strong className={styles.sectionTitle}><span>3</span>Hireage</strong>
              <div />
              <strong className={styles.sectionTitle}><span>4</span>Bunkers</strong>
            </div>
            <div className={styles.split}>
              <div className={styles.hireage}>
                <div className={styles.grid3}>
                  <Field label="CP Date">
                    {readOnly ? (
                      <input value={form.tcCpDate || ''} readOnly />
                    ) : (
                      <DmyDateInput
                        id="tcCpDate"
                        value={form.tcCpDate || ''}
                        onChange={(value) => applyPatch({ tcCpDate: value })}
                      />
                    )}
                  </Field>
                  <Field label="Customer Name">
                    <WorksheetSelect
                      value={form.dtcVendorId || ''}
                      disabled={readOnly}
                      options={vendors}
                      onChange={(value) => applyPatch({ dtcVendorId: value })}
                    />
                  </Field>
                  <Field label="Total Voy Days">
                    <input value={form.totalHireDays || form.totalDays || ''} readOnly placeholder="0.00" />
                  </Field>
                </div>

                <div className={styles.grid3}>
                  <Field label="Hireage">
                    <input value={form.hireAmt || ''} readOnly placeholder="0.00" />
                  </Field>
                  <Field label="Ballast Bonus">
                    <input
                      value={form.ballastBonus || ''}
                      readOnly={readOnly}
                      inputMode="decimal"
                      placeholder="0.00"
                      onChange={(e) => applyPatch({
                        ballastBonus: sanitizeFieldDecimal('ballastBonus', e.target.value),
                      })}
                    />
                  </Field>
                  <Field label="Gross Hireage">
                    <input value={form.grossHireargeAmt || ''} readOnly placeholder="0.00" />
                  </Field>
                </div>

                <div className={styles.grid3}>
                  <div className={styles.pctField}>
                    <label>Add Comm</label>
                    <div className={styles.pctInput}>
                      <input
                        value={form.hireagePercent || ''}
                        readOnly={readOnly}
                        inputMode="decimal"
                        placeholder="0.00"
                        onChange={(e) => applyPatch({
                          hireagePercent: sanitizeFieldDecimal('hireagePercent', e.target.value),
                        })}
                      />
                      <em>%</em>
                    </div>
                    <div className={styles.eq}>= <b>${form.hireagePercentAmt || '0.00'}</b></div>
                  </div>
                  <div className={styles.pctField}>
                    <label>Brokerage</label>
                    <div className={styles.pctInput}>
                      <input
                        value={form.hireageBroPercent || ''}
                        readOnly={readOnly}
                        inputMode="decimal"
                        placeholder="0.00"
                        onChange={(e) => applyPatch({
                          hireageBroPercent: sanitizeFieldDecimal('hireageBroPercent', e.target.value),
                        })}
                      />
                      <em>%</em>
                    </div>
                    <div className={styles.eq}>= <b>${form.hireageBroPercentAmt || '0.00'}</b></div>
                  </div>
                  <Field label="Broker">
                    <WorksheetSelect
                      value={form.brokerageVendorId || ''}
                      disabled={readOnly}
                      options={vendors}
                      onChange={(value) => applyPatch({ brokerageVendorId: value })}
                    />
                  </Field>
                </div>

                <Field label="Net Hireage" hero>
                  <input value={form.nettHireargeAmt || ''} readOnly placeholder="0.00" />
                </Field>

                <div className={styles.grid2}>
                  <Field label="CVE (Per Month)">
                    <div className={styles.cveRow}>
                      <input value={form.cvePerMonth || ''} readOnly placeholder="0.00" />
                      <div className={styles.eq}>= <b>${form.hireageCveAmt || form.cveAmt || '0.00'}</b></div>
                    </div>
                  </Field>
                  <Field label="CVE Off Hire (Per Month)">
                    <div className={styles.cveRow}>
                      <input
                        value={form.offHireCve || ''}
                        readOnly={readOnly}
                        inputMode="decimal"
                        placeholder="0.00"
                        onChange={(e) => applyPatch({
                          offHireCve: sanitizeFieldDecimal('offHireCve', e.target.value),
                        })}
                      />
                      <div className={styles.eq}>= <b>${form.offHireCveAmt || '0.00'}</b></div>
                    </div>
                  </Field>
                </div>

                <div className={styles.grid3}>
                  <Field label="Bunker on Owner's Account">
                    <input value={bunkerOnOwner ? bunkerOnOwner.toFixed(2) : (form.bunkerOnOwnerAmt || '')} readOnly placeholder="0.00" />
                  </Field>
                  <Field label="Off Hire">
                    <input value={form.lessOffHire || form.totalOffHireAmt || ''} readOnly placeholder="0.00" />
                  </Field>
                  <Field label="ILOHC">
                    <input value={form.ilohcForTcDet || ''} readOnly placeholder="0.00" />
                  </Field>
                </div>

                <Field label="Final Hireage" hero>
                  <input value={form.netHireage || form.finalHireargeAmt || ''} readOnly placeholder="0.00" />
                </Field>
              </div>

              <div className={styles.divider} />

              <div className={styles.bunkerSide}>
                {bunkerCards.map((card) => (
                  <div key={card.key} className={styles.khaki}>
                    <div className={styles.khakiHead}>
                      Bunkers On <span className={styles.pill}>{card.pill}</span>
                    </div>
                    <div className={styles.tableWrap} style={{ border: 'none', borderRadius: 0 }}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Grade</th>
                            <th>Qty (MT)</th>
                            <th>Date</th>
                            <th>Price</th>
                            <th>Amount</th>
                            <th style={{ width: 64 }} />
                          </tr>
                        </thead>
                        <tbody>
                          {card.rows.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <WorksheetSelect
                                  value={row.bunkerGradeId || ''}
                                  disabled={readOnly}
                                  options={grades}
                                  onChange={(value) => patchBunkerList(card.key, card.rows, row.id, { bunkerGradeId: value })}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.qty || ''}
                                  readOnly={readOnly}
                                  placeholder="0.00"
                                  onChange={(e) => patchBunkerList(card.key, card.rows, row.id, {
                                    qty: sanitizeFieldDecimal('qty', e.target.value),
                                  })}
                                />
                              </td>
                              <td>
                                {readOnly ? (
                                  <input value={row.bunkerDate || ''} readOnly />
                                ) : (
                                  <DmyDateInput
                                    id={`${card.identity}_${row.id}`}
                                    value={row.bunkerDate || ''}
                                    onChange={(value) => patchBunkerList(card.key, card.rows, row.id, { bunkerDate: value })}
                                  />
                                )}
                              </td>
                              <td>
                                <input
                                  value={row.price || ''}
                                  readOnly={readOnly}
                                  placeholder="0.00"
                                  onChange={(e) => patchBunkerList(card.key, card.rows, row.id, {
                                    price: sanitizeFieldDecimal('price', e.target.value),
                                  })}
                                />
                              </td>
                              <td><input value={row.amount || ''} readOnly placeholder="0.00" /></td>
                              <td>
                                {!readOnly ? (
                                  <div className={styles.rowActions}>
                                    <button
                                      type="button"
                                      className={styles.iconAdd}
                                      title="Add row"
                                      onClick={() => applyPatch({
                                        [card.key]: [...card.rows, createEmptyDeliveryBunkerRow(card.identity)],
                                      })}
                                    >
                                      <PlusIcon />
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.iconDel}
                                      title="Remove"
                                      onClick={() => applyPatch({
                                        [card.key]: card.rows.length > 1
                                          ? card.rows.filter((item) => item.id !== row.id)
                                          : [createEmptyDeliveryBunkerRow(card.identity)],
                                      })}
                                    >
                                      <TrashIcon />
                                    </button>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.khakiTotal}>Total <b>{card.total ? card.total.toFixed(2) : '0.00'}</b></div>
                  </div>
                ))}

                <strong className={styles.sectionTitle} style={{ marginTop: 4 }}><span>5</span>Off Hire</strong>
                <div className={styles.navyCard}>
                  <div className={styles.reasonHead}>
                    <div>Reason</div>
                    <div>From</div>
                    <div>To</div>
                    <div>Days</div>
                    <div>Hire Rate/Day($)</div>
                    <div>Amount</div>
                    <div />
                  </div>
                  {offHireRows.map((row) => (
                    <div key={row.id} className={styles.offBlock}>
                      <div className={styles.reasonRow}>
                        <textarea
                          rows={1}
                          value={row.reason || ''}
                          readOnly={readOnly}
                          placeholder="Description"
                          onChange={(e) => patchOffHireRow(row.id, { reason: e.target.value })}
                        />
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
                        <input
                          value={row.days || ''}
                          readOnly={readOnly}
                          placeholder="0.00"
                          onChange={(e) => patchOffHireRow(row.id, {
                            days: sanitizeFieldDecimal('hireDays', e.target.value),
                          })}
                        />
                        <input
                          value={row.rate || ''}
                          readOnly={readOnly}
                          placeholder="0.00"
                          onChange={(e) => patchOffHireRow(row.id, {
                            rate: sanitizeFieldDecimal('hireRate', e.target.value),
                          })}
                        />
                        <input value={row.amount || ''} readOnly placeholder="0.00" />
                        {!readOnly ? (
                          <button
                            type="button"
                            className={styles.iconDel}
                            title="Remove"
                            onClick={() => applyPatch({
                              offHireRows: offHireRows.length > 1
                                ? offHireRows.filter((item) => item.id !== row.id)
                                : [createEmptyOffHireRow()],
                            })}
                          >
                            <TrashIcon />
                          </button>
                        ) : <span />}
                      </div>

                      <div className={styles.nested}>
                        <div className={styles.nbHead}>
                          <div>Grade</div>
                          <div>Qty (MT)</div>
                          <div>Price</div>
                          <div>Amount</div>
                          <div />
                        </div>
                        {(row.bunkers || []).map((bunker) => (
                          <div key={bunker.id} className={styles.nbRow}>
                            <WorksheetSelect
                              value={bunker.bunkerGradeId || ''}
                              disabled={readOnly}
                              options={grades}
                              onChange={(value) => patchOffHireBunker(row.id, bunker.id, { bunkerGradeId: value })}
                            />
                            <input
                              value={bunker.qty || ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => patchOffHireBunker(row.id, bunker.id, {
                                qty: sanitizeFieldDecimal('qty', e.target.value),
                              })}
                            />
                            <input
                              value={bunker.price || ''}
                              readOnly={readOnly}
                              placeholder="0.00"
                              onChange={(e) => patchOffHireBunker(row.id, bunker.id, {
                                price: sanitizeFieldDecimal('price', e.target.value),
                              })}
                            />
                            <input value={bunker.amount || ''} readOnly placeholder="0.00" />
                            <div className={styles.rowActions}>
                              <input
                                type="checkbox"
                                className={styles.ownerChk}
                                checked={bunker.calc !== false}
                                disabled={readOnly}
                                title="On owner's account"
                                onChange={(e) => patchOffHireBunker(row.id, bunker.id, { calc: e.target.checked })}
                              />
                              {!readOnly ? (
                                <button
                                  type="button"
                                  className={styles.iconDel}
                                  title="Remove"
                                  onClick={() => {
                                    const bunkers = (row.bunkers || []).length > 1
                                      ? row.bunkers.filter((item) => item.id !== bunker.id)
                                      : [newOffBunker()];
                                    patchOffHireRow(row.id, { bunkers });
                                  }}
                                >
                                  <TrashIcon />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          className={styles.dashedAdd}
                          onClick={() => patchOffHireRow(row.id, {
                            bunkers: [...(row.bunkers || []), newOffBunker()],
                          })}
                        >
                          <PlusIcon />
                          Add Bunkers
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {!readOnly ? (
                    <button
                      type="button"
                      className={styles.dashedAdd}
                      onClick={() => applyPatch({ offHireRows: [...offHireRows, createEmptyOffHireRow()] })}
                    >
                      <PlusIcon />
                      Add Reason
                    </button>
                  ) : null}
                  <div className={styles.navyTotal}>
                    Total <b>{offHireDayTotal ? offHireDayTotal.toFixed(2) : '0'} days / {offHireAmtTotal ? offHireAmtTotal.toFixed(2) : '0.00'}</b>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnNavy} onClick={onClose}>
            <CheckIcon />
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

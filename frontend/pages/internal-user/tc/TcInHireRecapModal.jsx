import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CardSelect, DmyDateInput, RowAddButton, RowActions, RowDelButton } from '@bainbridge/shared-ui';
import { daysBetween, hasDateValue } from '../../../services/tcEstimates.js';
import {
  EMPTY_TC_IN_BUNKER,
  EMPTY_TC_IN_EXPENSE,
  EMPTY_TC_IN_HIRE,
  EMPTY_TC_IN_OFF,
  EMPTY_TC_IN_PERIOD,
  EMPTY_TC_IN_PRE_EXP,
  bunkerAmount,
  buildTcInRecapDraft,
  calcTcInFinalHireage,
  calcTcInGrossHireExpense,
  hasSavedTcInRecap,
  resolveHireRow,
  syncPeriodOneToLegacy,
} from './tcInRecapCalcs.js';
import styles from './TcPages.module.css';

const OWNER_COST_OPTIONS = [
  'Agency Fee', 'Port Dues', 'ILOHC', 'Insurance', 'Superintendence',
  'Off-Hire', 'Victualling', 'Communication', 'Drydocking', "Owner's P&I", 'Other',
];

function Accordion({ title, icon, defaultOpen = false, children }) {
  return (
    <details className={styles.tcinAccord} defaultOpen={defaultOpen}>
      <summary className={styles.tcinAccordSummary}>
        <span className={styles.tcinAccordChev} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
        {icon ? <span className={styles.tcinAccordIcon} aria-hidden="true">{icon}</span> : null}
        <span>{title}</span>
      </summary>
      <div className={styles.tcinAccordBody}>{children}</div>
    </details>
  );
}

function Field({ label, children, wide }) {
  return (
    <div className={`${styles.field} ${wide ? styles.tcinFieldWide : ''}`.trim()}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TcInHireRecapModal({
  open,
  value,
  detail,
  lookups,
  onClose,
  onApply,
  readOnly = false,
}) {
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDraft(buildTcInRecapDraft(detail || {}, value || null));
  }, [open, value, detail]);

  const grossCalc = useMemo(() => calcTcInGrossHireExpense(draft || {}), [draft]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !draft) return null;

  const period = draft.periods?.[0] || { ...EMPTY_TC_IN_PERIOD };
  const terms = period.terms || EMPTY_TC_IN_PERIOD.terms;
  const isEdit = hasSavedTcInRecap(value);
  const title = readOnly
    ? 'View TC In Hire Recap'
    : (isEdit ? 'Edit TC In Hire Recap' : 'Add TC In Hire Recap');

  const patch = (fields) => setDraft((prev) => syncPeriodOneToLegacy({ ...prev, ...fields }));

  const patchIdentifiers = (fields) => setDraft((prev) => ({
    ...prev,
    identifiers: { ...(prev.identifiers || {}), ...fields },
  }));

  const patchCp = (fields) => setDraft((prev) => ({
    ...prev,
    cp: { ...(prev.cp || {}), ...fields },
  }));

  const patchTerms = (fields) => setDraft((prev) => {
    const periods = [...(prev.periods || [{ ...EMPTY_TC_IN_PERIOD }])];
    const p0 = { ...(periods[0] || { ...EMPTY_TC_IN_PERIOD }) };
    p0.terms = { ...(p0.terms || {}), ...fields };
    periods[0] = p0;
    return syncPeriodOneToLegacy({ ...prev, terms: p0.terms, periods });
  });

  const patchHire = (index, fields) => setDraft((prev) => {
    const periods = [...(prev.periods || [{ ...EMPTY_TC_IN_PERIOD }])];
    const p0 = { ...(periods[0] || { ...EMPTY_TC_IN_PERIOD }) };
    const hires = [...(p0.hires || [])];
    hires[index] = resolveHireRow({ ...hires[index], ...fields });
    p0.hires = hires;
    periods[0] = p0;
    return syncPeriodOneToLegacy({ ...prev, periods, hires });
  });

  const patchOff = (index, fields) => setDraft((prev) => {
    const periods = [...(prev.periods || [{ ...EMPTY_TC_IN_PERIOD }])];
    const p0 = { ...(periods[0] || { ...EMPTY_TC_IN_PERIOD }) };
    const rows = [...(p0.offHires || [])];
    const next = { ...rows[index], ...fields };
    let days = Number(next.days) || 0;
    if (hasDateValue(next.from) && hasDateValue(next.to)) {
      days = daysBetween(next.to, next.from) || days;
    }
    next.days = days ? String(Number(days.toFixed(4))) : '';
    next.amount = (days * (Number(next.hireRate) || 0)).toFixed(2);
    rows[index] = next;
    p0.offHires = rows;
    periods[0] = p0;
    return syncPeriodOneToLegacy({ ...prev, periods, offHires: rows });
  });

  const updateOffBunkers = (offIndex, mutator) => setDraft((prev) => {
    const periods = [...(prev.periods || [{ ...EMPTY_TC_IN_PERIOD }])];
    const p0 = { ...(periods[0] || { ...EMPTY_TC_IN_PERIOD }) };
    const rows = [...(p0.offHires || [])];
    const row = { ...rows[offIndex] };
    const bunkers = mutator([...(row.bunkers || [])]);
    row.bunkers = bunkers;
    rows[offIndex] = row;
    p0.offHires = rows;
    periods[0] = p0;
    return syncPeriodOneToLegacy({ ...prev, periods, offHires: rows });
  });

  const patchOffBunker = (offIndex, bunkerIndex, fields) => updateOffBunkers(offIndex, (bunkers) => {
    const next = { ...bunkers[bunkerIndex], ...fields };
    next.amount = bunkerAmount(next);
    bunkers[bunkerIndex] = next;
    return bunkers;
  });

  const addOffBunkers = (offIndex) => updateOffBunkers(offIndex, (bunkers) => (
    [...bunkers, { ...EMPTY_TC_IN_BUNKER }]
  ));

  const removeOffBunker = (offIndex, bunkerIndex) => updateOffBunkers(offIndex, (bunkers) => (
    bunkers.length > 1
      ? bunkers.filter((_, i) => i !== bunkerIndex)
      : []
  ));

  const copyDeliveryToRedelivery = (deliveryRows = [], reDelDate = '') => (
    (deliveryRows.length ? deliveryRows : [{ ...EMPTY_TC_IN_BUNKER }]).map((row) => ({
      ...EMPTY_TC_IN_BUNKER,
      bunkerId: row.bunkerId || '',
      qty: row.qty || '',
      price: row.price || '',
      amount: bunkerAmount({ ...row, price: row.price }),
      bunkerDate: reDelDate || row.bunkerDate || '',
    }))
  );

  const patchBunker = (side, index, fields) => {
    const key = side === 'del' ? 'deliveryBunkers' : 'redeliveryBunkers';
    setDraft((prev) => {
      const rows = [...(prev[key] || [])];
      const next = { ...rows[index], ...fields };
      next.amount = bunkerAmount(next);
      rows[index] = next;
      if (side === 'del') {
        const reDelDate = (prev.hires || [])[(prev.hires || []).length - 1]?.redeliveryDate || '';
        return {
          ...prev,
          deliveryBunkers: rows,
          redeliveryBunkers: copyDeliveryToRedelivery(rows, reDelDate).map((r, i) => ({
            ...r,
            price: prev.redeliveryBunkers?.[i]?.price || r.price,
            amount: bunkerAmount({
              ...r,
              price: prev.redeliveryBunkers?.[i]?.price || r.price,
            }),
          })),
        };
      }
      return { ...prev, [key]: rows };
    });
  };

  const patchVp = (fields) => setDraft((prev) => ({
    ...prev,
    vesselParticulars: { ...(prev.vesselParticulars || {}), ...fields },
  }));

  const patchVoyage = (fields) => setDraft((prev) => ({
    ...prev,
    voyageTerms: { ...(prev.voyageTerms || {}), ...fields },
  }));

  const handleApply = () => {
    const synced = syncPeriodOneToLegacy(draft);
    const final = calcTcInFinalHireage(synced);
    const gross = calcTcInGrossHireExpense(synced);
    onApply({
      ...synced,
      ...final,
      finalHireage: final.finalHireage,
      offHireCveAmt: final.offHireCveAmt,
      lessOffHire: final.lessOffHire,
      grossHireExpense: gross.grossHireExpense,
      netHireExpense: gross.netHireExpense,
      recapVersion: 1,
    });
  };

  const ro = readOnly ? styles.inputReadonly : undefined;

  return createPortal(
    <div
      className={`${styles.modalBackdrop} ${styles.tcinRecapBackdrop}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tc-in-hire-recap-title"
    >
      <div className={`${styles.modal} ${styles.tcInRecapModal}`}>
        <div className={styles.thdHead}>
          <div className={styles.thdTitleWrap}>
            <div className={styles.thdTitleIco} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h13" />
                <path d="M12 4l4 4-4 4" />
                <path d="M21 16H8" />
                <path d="M12 20l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <div id="tc-in-hire-recap-title" className={styles.thdTitle}>{title}</div>
              <div className={styles.thdSubtitle}>
                Charter-in leg of this sub-charter — pre-filled from the TC Out recap
              </div>
            </div>
          </div>
          <button type="button" className={styles.thdClose} title="Close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className={`${styles.tcinRecapBody} ${readOnly ? styles.viewModeLock : ''}`.trim()}>
          <div className={styles.tcinRecapLhs}>
            <Accordion title="Recap Identifiers" defaultOpen>
              <div className={styles.tcinDenseFlex}>
                <Field label="Contract Type">
                  <input className={styles.inputReadonly} readOnly value="TC In" />
                </Field>
                <Field label="Business Type">
                  <input className={styles.inputReadonly} readOnly value={draft.identifiers?.businessType || ''} />
                </Field>
                <Field label="Vessel">
                  <input
                    value={draft.identifiers?.vessel || ''}
                    onChange={(e) => patchIdentifiers({ vessel: e.target.value })}
                    readOnly={readOnly}
                    className={ro}
                  />
                </Field>
                <Field label="Vessel Type">
                  <input className={styles.inputReadonly} readOnly value={draft.identifiers?.vesselType || ''} />
                </Field>
                <Field label="CP Date">
                  <DmyDateInput
                    value={draft.identifiers?.cpDate || ''}
                    onChange={(v) => {
                      patchIdentifiers({ cpDate: v });
                      patch({ cpDate: v });
                    }}
                    disabled={readOnly}
                  />
                </Field>
                <Field label="TC No.">
                  <input
                    value={draft.identifiers?.tcNo || ''}
                    onChange={(e) => {
                      patchIdentifiers({ tcNo: e.target.value });
                      patch({ contractRef: e.target.value });
                    }}
                    readOnly={readOnly}
                    className={ro}
                  />
                </Field>
                <Field label="Est No.">
                  <input
                    value={draft.identifiers?.estNo || ''}
                    onChange={(e) => patchIdentifiers({ estNo: e.target.value })}
                    readOnly={readOnly}
                    className={ro}
                  />
                </Field>
                <Field label="Chartering Team">
                  <CardSelect
                    options={lookups?.charteringTeams || []}
                    value={draft.identifiers?.charteringTeam || ''}
                    onChange={(v) => patchIdentifiers({ charteringTeam: v })}
                    placeholder="Select"
                    ariaLabel="Chartering Team"
                  />
                </Field>
                <Field label="Chartering PIC">
                  <CardSelect
                    options={lookups?.charteringPics || []}
                    value={draft.identifiers?.charteringPic || ''}
                    onChange={(v) => patchIdentifiers({
                      charteringPic: v,
                      ...(draft.identifiers?.opsPic ? {} : { opsPic: v }),
                    })}
                    placeholder="Select"
                    ariaLabel="Chartering PIC"
                  />
                </Field>
                <Field label="Ops PIC">
                  <CardSelect
                    options={lookups?.charteringPics || []}
                    value={draft.identifiers?.opsPic || ''}
                    onChange={(v) => patchIdentifiers({ opsPic: v })}
                    placeholder="Select"
                    ariaLabel="Ops PIC"
                  />
                </Field>
              </div>
            </Accordion>

            <Accordion title="CP Information">
              <div className={styles.tcinCpInfoGrid}>
                <Field label="CP Type">
                  <CardSelect
                    options={lookups?.cpTypes || []}
                    value={draft.cp?.cpType || ''}
                    onChange={(v) => patchCp({ cpType: v })}
                    placeholder="Select CP type"
                    ariaLabel="CP Type"
                  />
                </Field>
                <Field label="Law / Arbitration">
                  <CardSelect
                    options={lookups?.lawArbitration || []}
                    value={draft.cp?.lawArbit || ''}
                    onChange={(v) => patchCp({ lawArbit: v })}
                    placeholder="Select"
                    ariaLabel="Law arbitration"
                  />
                </Field>
                <Field label="Head Owners">
                  <CardSelect
                    options={lookups?.vendors || lookups?.charterers || []}
                    value={draft.cp?.headOwners || ''}
                    onChange={(v) => {
                      patchCp({ headOwners: v });
                      const match = (lookups?.vendors || lookups?.charterers || [])
                        .find((opt) => String(opt.id) === String(v) || String(opt.name) === String(v));
                      if (match?.address) patchCp({ address: match.address });
                    }}
                    placeholder="Select head owner"
                    ariaLabel="Head owners"
                  />
                </Field>
                <Field label="Address">
                  <input
                    value={draft.cp?.address || ''}
                    readOnly
                    className={styles.inputReadonly}
                    placeholder=""
                  />
                </Field>
              </div>
            </Accordion>

            <Accordion title="TC Details" defaultOpen>
              <div className={`${styles.tcinSecCard} ${styles.tcinSecLight}`}>
                <span className={`${styles.tcinSecTab} ${styles.tcinSecTabLight}`}>TC Terms</span>
                <div className={styles.tcinTermsFlex}>
                  <Field label="Laycan From/To" wide>
                    <input
                      value={terms.laycan || ''}
                      onChange={(e) => patchTerms({ laycan: e.target.value })}
                      placeholder="Select laycan range"
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="Hire Currency">
                    {(lookups?.currencies || []).length ? (
                      <CardSelect
                        options={lookups.currencies}
                        value={terms.hireCurrency || 'USD'}
                        onChange={(v) => patchTerms({ hireCurrency: v })}
                        placeholder="Select"
                        ariaLabel="Hire Currency"
                      />
                    ) : (
                      <select
                        value={terms.hireCurrency || 'USD'}
                        onChange={(e) => patchTerms({ hireCurrency: e.target.value })}
                        disabled={readOnly}
                      >
                        {['USD', 'EUR', 'CNY', 'SGD', 'AED'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="X-rate to USD">
                    <input value={terms.xrate || ''} onChange={(e) => patchTerms({ xrate: e.target.value })} readOnly={readOnly} className={ro} />
                  </Field>
                  <Field label="Del Port/Range">
                    <input value={terms.delPort || ''} onChange={(e) => patchTerms({ delPort: e.target.value })} readOnly={readOnly} className={ro} />
                  </Field>
                  <Field label="Re-Del Port/Range">
                    <input value={terms.reDelPort || ''} onChange={(e) => patchTerms({ reDelPort: e.target.value })} readOnly={readOnly} className={ro} />
                  </Field>
                  <Field label="CVE/Month ($)">
                    <input value={terms.cveMonth || ''} onChange={(e) => patchTerms({ cveMonth: e.target.value })} readOnly={readOnly} className={ro} />
                  </Field>
                  <Field label="ILOHC">
                    <input value={terms.ilohc || ''} onChange={(e) => patchTerms({ ilohc: e.target.value })} readOnly={readOnly} className={ro} />
                  </Field>
                  <Field label="Ballast Bonus">
                    <input value={terms.ballastBonus || ''} onChange={(e) => patchTerms({ ballastBonus: e.target.value })} readOnly={readOnly} className={ro} />
                  </Field>
                  <Field label="AD Comm (%)">
                    <input value={terms.adComm || ''} onChange={(e) => patchTerms({ adComm: e.target.value })} readOnly={readOnly} className={ro} />
                  </Field>
                  <Field label="Brokerage (%)">
                    <input value={terms.brokerage || ''} onChange={(e) => patchTerms({ brokerage: e.target.value })} readOnly={readOnly} className={ro} />
                  </Field>
                  <Field label="Brokerage Paid By">
                    <select
                      value={terms.brokeragePaidBy || ''}
                      onChange={(e) => patchTerms({ brokeragePaidBy: e.target.value })}
                      disabled={readOnly}
                    >
                      <option value="">Select</option>
                      <option value="Owner">Owner</option>
                      <option value="Charterer">Charterer</option>
                    </select>
                  </Field>
                </div>
              </div>

              <div className={`${styles.tcinSecCard} ${styles.tcinSecMid}`}>
                <span className={`${styles.tcinSecTab} ${styles.tcinSecTabMid}`}>Trip Schedule</span>
                <div className={styles.miniTableWrap}>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr>
                        <th>Delivery Date (From)</th>
                        <th>Redelivery Date (To)</th>
                        <th>Days</th>
                        <th>Hire ($/day)</th>
                        <th>Hire Payable ($)</th>
                        <th style={{ width: 72 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(period.hires || []).map((row, index) => {
                        const resolved = resolveHireRow(row);
                        return (
                          <tr key={`tcin-hire-${index}`}>
                            <td>
                              <DmyDateInput
                                enableTime
                                value={row.deliveryDate}
                                onChange={(v) => patchHire(index, { deliveryDate: v })}
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <DmyDateInput
                                enableTime
                                value={row.redeliveryDate}
                                onChange={(v) => patchHire(index, { redeliveryDate: v })}
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <input
                                value={resolved.voyageDays}
                                onChange={(e) => patchHire(index, { voyageDays: e.target.value })}
                                readOnly={readOnly}
                                className={ro}
                              />
                            </td>
                            <td>
                              <input
                                value={row.dailyHire}
                                onChange={(e) => patchHire(index, { dailyHire: e.target.value })}
                                readOnly={readOnly}
                                className={ro}
                              />
                            </td>
                            <td><input className={styles.inputReadonly} readOnly value={resolved.hireage} /></td>
                            <td>
                              {!readOnly ? (
                                <RowActions>
                                  <RowAddButton
                                    title="Add a new trip"
                                    onClick={() => setDraft((prev) => {
                                      const periods = [...(prev.periods || [])];
                                      const p0 = { ...periods[0] };
                                      p0.hires = [...(p0.hires || []), { ...EMPTY_TC_IN_HIRE }];
                                      periods[0] = p0;
                                      return syncPeriodOneToLegacy({ ...prev, periods, hires: p0.hires });
                                    })}
                                  />
                                  <RowDelButton
                                    title="Delete row"
                                    onClick={() => setDraft((prev) => {
                                      const periods = [...(prev.periods || [])];
                                      const p0 = { ...periods[0] };
                                      const hires = (p0.hires || []).length > 1
                                        ? p0.hires.filter((_, i) => i !== index)
                                        : [{ ...EMPTY_TC_IN_HIRE }];
                                      p0.hires = hires;
                                      periods[0] = p0;
                                      return syncPeriodOneToLegacy({ ...prev, periods, hires });
                                    })}
                                  />
                                </RowActions>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className={styles.tcinTotalRow}>
                  <span>Total</span>
                  <span>{grossCalc.tripDays} days</span>
                  <span>${money(grossCalc.tripHireAmt)}</span>
                </div>
              </div>

              <div className={`${styles.tcinSecCard} ${styles.tcinSecNavy}`}>
                <span className={`${styles.tcinSecTab} ${styles.tcinSecTabNavy}`}>Off Hire</span>
                <div className={styles.miniTableWrap}>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr>
                        <th>Reason</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Days</th>
                        <th>Rate/Day</th>
                        <th>Credit Amount</th>
                        <th style={{ width: 72 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(period.offHires || []).map((row, index) => {
                        const showBunkers = (row.bunkers || []).length > 0;
                        return (
                          <React.Fragment key={`tcin-off-${index}`}>
                            <tr>
                              <td>
                                <input
                                  value={row.reason}
                                  onChange={(e) => patchOff(index, { reason: e.target.value })}
                                  placeholder="Description"
                                  readOnly={readOnly}
                                  className={ro}
                                />
                              </td>
                              <td><DmyDateInput enableTime value={row.from} onChange={(v) => patchOff(index, { from: v })} disabled={readOnly} /></td>
                              <td><DmyDateInput enableTime value={row.to} onChange={(v) => patchOff(index, { to: v })} disabled={readOnly} /></td>
                              <td>
                                <input value={row.days} onChange={(e) => patchOff(index, { days: e.target.value })} readOnly={readOnly} className={ro} />
                              </td>
                              <td>
                                <input value={row.hireRate} onChange={(e) => patchOff(index, { hireRate: e.target.value })} readOnly={readOnly} className={ro} />
                              </td>
                              <td><input className={styles.inputReadonly} readOnly value={row.amount} /></td>
                              <td>
                                {!readOnly ? (
                                  <RowActions>
                                    <RowAddButton
                                      title="Add another off-hire reason"
                                      onClick={() => setDraft((prev) => {
                                        const periods = [...(prev.periods || [])];
                                        const p0 = { ...periods[0] };
                                        const lastRate = p0.offHires?.[p0.offHires.length - 1]?.hireRate
                                          || p0.hires?.[0]?.dailyHire
                                          || '';
                                        p0.offHires = [...(p0.offHires || []), { ...EMPTY_TC_IN_OFF, hireRate: lastRate }];
                                        periods[0] = p0;
                                        return syncPeriodOneToLegacy({ ...prev, periods, offHires: p0.offHires });
                                      })}
                                    />
                                    <RowDelButton
                                      title="Delete this off-hire item"
                                      onClick={() => setDraft((prev) => {
                                        const periods = [...(prev.periods || [])];
                                        const p0 = { ...periods[0] };
                                        const offHires = (p0.offHires || []).length > 1
                                          ? p0.offHires.filter((_, i) => i !== index)
                                          : [{ ...EMPTY_TC_IN_OFF }];
                                        p0.offHires = offHires;
                                        periods[0] = p0;
                                        return syncPeriodOneToLegacy({ ...prev, periods, offHires });
                                      })}
                                    />
                                  </RowActions>
                                ) : null}
                              </td>
                            </tr>
                            <tr className={styles.tcinOffBunkerRow}>
                              <td colSpan={7}>
                                <div className={styles.tcinOffBunkers}>
                                  {showBunkers ? (
                                    <div className={styles.tcinOffBunkersInner}>
                                      <table className={styles.miniTable}>
                                        <thead>
                                          <tr>
                                            <th style={{ width: 110 }}>Grade</th>
                                            <th>Qty (MT)</th>
                                            <th>Price (/MT)</th>
                                            <th>Amount</th>
                                            <th style={{ width: 44 }} />
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(row.bunkers || []).map((bunker, bIndex) => (
                                            <tr key={`tcin-ohb-${index}-${bIndex}`}>
                                              <td>
                                                <select
                                                  value={bunker.bunkerId != null ? String(bunker.bunkerId) : ''}
                                                  onChange={(e) => patchOffBunker(index, bIndex, { bunkerId: e.target.value })}
                                                  disabled={readOnly}
                                                >
                                                  <option value="">Select</option>
                                                  {(lookups?.bunkers || []).map((opt) => (
                                                    <option key={String(opt.id)} value={String(opt.id)}>{opt.name}</option>
                                                  ))}
                                                </select>
                                              </td>
                                              <td>
                                                <input
                                                  value={bunker.qty || ''}
                                                  onChange={(e) => patchOffBunker(index, bIndex, { qty: e.target.value })}
                                                  readOnly={readOnly}
                                                  className={ro}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  value={bunker.price || ''}
                                                  onChange={(e) => patchOffBunker(index, bIndex, { price: e.target.value })}
                                                  readOnly={readOnly}
                                                  className={ro}
                                                />
                                              </td>
                                              <td>
                                                <input className={styles.inputReadonly} readOnly value={bunker.amount || ''} />
                                              </td>
                                              <td>
                                                {!readOnly ? (
                                                  <RowDelButton
                                                    title="Delete bunker row"
                                                    onClick={() => removeOffBunker(index, bIndex)}
                                                  />
                                                ) : null}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : null}
                                  {!readOnly ? (
                                    <button
                                      type="button"
                                      className={styles.tcinOffAddBunkers}
                                      onClick={() => addOffBunkers(index)}
                                    >
                                      + Add Bunkers
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className={styles.tcinTotalRow}>
                  <span>Total</span>
                  <span>
                    {`${(period.offHires || []).reduce((s, r) => s + (Number(r.days) || 0), 0).toFixed(1)} days`}
                  </span>
                </div>
              </div>

              {!readOnly ? (
                <button
                  type="button"
                  className={styles.thdAddBtn}
                  onClick={() => setDraft((prev) => ({
                    ...prev,
                    periods: [...(prev.periods || []), {
                      ...EMPTY_TC_IN_PERIOD,
                      terms: { ...EMPTY_TC_IN_PERIOD.terms },
                      hires: [{ ...EMPTY_TC_IN_HIRE }],
                      offHires: [{ ...EMPTY_TC_IN_OFF }],
                    }],
                  }))}
                >
                  + Add Period (Extension)
                </button>
              ) : null}

              {(draft.periods || []).length > 1 ? (
                <div className={styles.tcinExtNote}>
                  {(draft.periods || []).slice(1).map((_, i) => (
                    <div key={`ext-${i}`} className={`${styles.tcinSecCard} ${styles.tcinSecLight}`}>
                      <span className={`${styles.tcinSecTab} ${styles.tcinSecTabLight}`}>Period {i + 2}</span>
                      <p className={styles.thdStepSub}>
                        Extension period (structural). Headline hire calcs use Period 1 only.
                      </p>
                      {!readOnly ? (
                        <button
                          type="button"
                          className={styles.thdRemoveBtn}
                          onClick={() => setDraft((prev) => ({
                            ...prev,
                            periods: prev.periods.filter((_, idx) => idx !== i + 1),
                          }))}
                        >
                          Remove Period {i + 2}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </Accordion>

            <Accordion title="TC Expenses">
              <div className={`${styles.tcinSecCard} ${styles.tcinSecNavy}`}>
                <span className={`${styles.tcinSecTab} ${styles.tcinSecTabNavy}`}>TC Expenses</span>
                <div className={styles.miniTableWrap}>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr>
                        <th>Expense Desc.</th>
                        <th>Account</th>
                        <th>Notes</th>
                        <th>Add to Total</th>
                        <th>Expense Amt</th>
                        <th>Customer</th>
                        <th style={{ width: 72 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.expenses || []).map((row, index) => (
                        <tr key={`tcin-exp-${index}`}>
                          <td>
                            <select
                              value={row.description || ''}
                              onChange={(e) => setDraft((prev) => {
                                const expenses = [...(prev.expenses || [])];
                                expenses[index] = { ...expenses[index], description: e.target.value };
                                return { ...prev, expenses };
                              })}
                              disabled={readOnly}
                            >
                              <option value="">Select from</option>
                              {OWNER_COST_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </td>
                          <td>
                            <select
                              value={row.account || ''}
                              onChange={(e) => setDraft((prev) => {
                                const expenses = [...(prev.expenses || [])];
                                const account = e.target.value;
                                expenses[index] = {
                                  ...expenses[index],
                                  account,
                                  addToTotal: account === 'Owner' ? expenses[index].addToTotal : false,
                                };
                                return { ...prev, expenses };
                              })}
                              disabled={readOnly}
                            >
                              <option value="">Select</option>
                              <option value="Owner">Owner</option>
                              <option value="Charterer">Charterer</option>
                            </select>
                          </td>
                          <td>
                            <input
                              value={row.notes || ''}
                              onChange={(e) => setDraft((prev) => {
                                const expenses = [...(prev.expenses || [])];
                                expenses[index] = { ...expenses[index], notes: e.target.value };
                                return { ...prev, expenses };
                              })}
                              readOnly={readOnly}
                              className={ro}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(row.addToTotal)}
                              disabled={readOnly || row.account !== 'Owner'}
                              onChange={(e) => setDraft((prev) => {
                                const expenses = [...(prev.expenses || [])];
                                expenses[index] = { ...expenses[index], addToTotal: e.target.checked };
                                return { ...prev, expenses };
                              })}
                            />
                          </td>
                          <td>
                            <input
                              value={row.amount || ''}
                              onChange={(e) => setDraft((prev) => {
                                const expenses = [...(prev.expenses || [])];
                                expenses[index] = { ...expenses[index], amount: e.target.value };
                                return { ...prev, expenses };
                              })}
                              readOnly={readOnly}
                              className={ro}
                            />
                          </td>
                          <td>
                            <CardSelect
                              options={lookups?.vendors || []}
                              value={row.customer || ''}
                              onChange={(v) => setDraft((prev) => {
                                const expenses = [...(prev.expenses || [])];
                                expenses[index] = { ...expenses[index], customer: v };
                                return { ...prev, expenses };
                              })}
                              placeholder="Select"
                              ariaLabel="Customer"
                            />
                          </td>
                          <td>
                            {!readOnly ? (
                              <RowActions>
                                <RowAddButton
                                  title="Add expense"
                                  onClick={() => setDraft((prev) => ({
                                    ...prev,
                                    expenses: [...(prev.expenses || []), { ...EMPTY_TC_IN_EXPENSE }],
                                  }))}
                                />
                                <RowDelButton
                                  title="Delete row"
                                  onClick={() => setDraft((prev) => ({
                                    ...prev,
                                    expenses: prev.expenses.length > 1
                                      ? prev.expenses.filter((_, i) => i !== index)
                                      : [{ ...EMPTY_TC_IN_EXPENSE }],
                                  }))}
                                />
                              </RowActions>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.tcinTotalRow}>
                  <span>Total Expenses</span>
                  <span>${money(grossCalc.tcExpensesTotal)}</span>
                </div>
              </div>
            </Accordion>

            <Accordion title="Vessel Particulars">
              <div className={styles.subBlockLabel}>Primary Data</div>
              <div className={styles.tcinDenseGrid}>
                {[
                  ['masterName', "Master's Name"],
                  ['vesselCode', 'Vessel Code'],
                  ['imoNo', 'IMO Number'],
                  ['yearBuild', 'Year Built'],
                  ['flag', 'Flag'],
                  ['summerDwt', 'Summer DWT (MT)'],
                  ['summerDraft', 'Summer Draft (M)'],
                  ['loa', 'LOA (M)'],
                  ['extremeBreadth', 'Extreme Breadth (M)'],
                  ['grt', 'GRT'],
                  ['nrt', 'NRT'],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      value={draft.vesselParticulars?.[key] || ''}
                      onChange={(e) => patchVp({ [key]: e.target.value })}
                      readOnly={readOnly || key !== 'masterName'}
                      className={key !== 'masterName' || readOnly ? styles.inputReadonly : undefined}
                    />
                  </Field>
                ))}
              </div>
              <div className={styles.subBlockLabel}>Tanker Particulars</div>
              <div className={styles.tcinDenseGrid}>
                {[
                  ['cargoTkCap', 'Cargo Tank Capacity (CBM)'],
                  ['noOfGrades', 'No. of Grades (Double V/V Seg)'],
                  ['noOfCargoPump', 'No. of Cargo Pump (Main)'],
                  ['sbtCap', 'Total SBT Capacity (CBM)'],
                  ['cargoPpCap', 'Cargo Pump Main Cap (CBM/HR)'],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input className={styles.inputReadonly} readOnly value={draft.vesselParticulars?.[key] || ''} />
                  </Field>
                ))}
              </div>
            </Accordion>

            <Accordion title="Pre-TC Details">
              <div className={`${styles.tcinSecCard} ${styles.tcinSecLight}`}>
                <span className={`${styles.tcinSecTab} ${styles.tcinSecTabLight}`}>Itinerary</span>
                <div className={styles.tcinDenseGrid}>
                  <Field label="From">
                    <input
                      value={draft.preTc?.itinerary?.from?.place || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            from: { ...prev.preTc?.itinerary?.from, place: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="Date/Time">
                    <input
                      value={draft.preTc?.itinerary?.from?.dateTime || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            from: { ...prev.preTc?.itinerary?.from, dateTime: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="Notes">
                    <input
                      value={draft.preTc?.itinerary?.from?.notes || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            from: { ...prev.preTc?.itinerary?.from, notes: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="To">
                    <input
                      value={draft.preTc?.itinerary?.to?.place || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            to: { ...prev.preTc?.itinerary?.to, place: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="Date/Time">
                    <input
                      value={draft.preTc?.itinerary?.to?.dateTime || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            to: { ...prev.preTc?.itinerary?.to, dateTime: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                  <Field label="Notes">
                    <input
                      value={draft.preTc?.itinerary?.to?.notes || ''}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        preTc: {
                          ...prev.preTc,
                          itinerary: {
                            ...prev.preTc?.itinerary,
                            to: { ...prev.preTc?.itinerary?.to, notes: e.target.value },
                          },
                        },
                      }))}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                </div>
              </div>
              <div className={`${styles.tcinSecCard} ${styles.tcinSecNavy}`}>
                <span className={`${styles.tcinSecTab} ${styles.tcinSecTabNavy}`}>Expenses</span>
                <div className={styles.miniTableWrap}>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr>
                        <th>Owner/Charterer</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Notes</th>
                        <th style={{ width: 72 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.preTc?.expenses || []).map((row, index) => (
                        <tr key={`tcin-pre-${index}`}>
                          <td>
                            <select
                              value={row.ownerCharterer || ''}
                              onChange={(e) => setDraft((prev) => {
                                const expenses = [...(prev.preTc?.expenses || [])];
                                expenses[index] = { ...expenses[index], ownerCharterer: e.target.value };
                                return { ...prev, preTc: { ...prev.preTc, expenses } };
                              })}
                              disabled={readOnly}
                            >
                              <option value="">Select</option>
                              <option value="Owner">Owner</option>
                              <option value="Charterer">Charterer</option>
                            </select>
                          </td>
                          <td>
                            {(lookups?.ownerRelatedCosts || []).length ? (
                              <CardSelect
                                options={lookups.ownerRelatedCosts}
                                value={row.description || ''}
                                onChange={(v) => setDraft((prev) => {
                                  const expenses = [...(prev.preTc?.expenses || [])];
                                  expenses[index] = { ...expenses[index], description: v };
                                  return { ...prev, preTc: { ...prev.preTc, expenses } };
                                })}
                                placeholder="Select from list"
                                ariaLabel="Pre-TC expense description"
                              />
                            ) : (
                              <select
                                value={row.description || ''}
                                onChange={(e) => setDraft((prev) => {
                                  const expenses = [...(prev.preTc?.expenses || [])];
                                  expenses[index] = { ...expenses[index], description: e.target.value };
                                  return { ...prev, preTc: { ...prev.preTc, expenses } };
                                })}
                                disabled={readOnly}
                              >
                                <option value="">Select from list</option>
                                <option value="Agency Fee">Agency Fee</option>
                                <option value="Survey Cost">Survey Cost</option>
                              </select>
                            )}
                          </td>
                          <td>
                            <input
                              value={row.amount || ''}
                              onChange={(e) => setDraft((prev) => {
                                const expenses = [...(prev.preTc?.expenses || [])];
                                expenses[index] = { ...expenses[index], amount: e.target.value };
                                return { ...prev, preTc: { ...prev.preTc, expenses } };
                              })}
                              readOnly={readOnly}
                              className={ro}
                            />
                          </td>
                          <td>
                            <input
                              value={row.notes || ''}
                              onChange={(e) => setDraft((prev) => {
                                const expenses = [...(prev.preTc?.expenses || [])];
                                expenses[index] = { ...expenses[index], notes: e.target.value };
                                return { ...prev, preTc: { ...prev.preTc, expenses } };
                              })}
                              readOnly={readOnly}
                              className={ro}
                            />
                          </td>
                          <td>
                            {!readOnly ? (
                              <RowActions>
                                <RowAddButton
                                  title="Add expense"
                                  onClick={() => setDraft((prev) => ({
                                    ...prev,
                                    preTc: {
                                      ...prev.preTc,
                                      expenses: [...(prev.preTc?.expenses || []), { ...EMPTY_TC_IN_PRE_EXP }],
                                    },
                                  }))}
                                />
                                <RowDelButton
                                  title="Delete row"
                                  onClick={() => setDraft((prev) => ({
                                    ...prev,
                                    preTc: {
                                      ...prev.preTc,
                                      expenses: prev.preTc.expenses.length > 1
                                        ? prev.preTc.expenses.filter((_, i) => i !== index)
                                        : [{ ...EMPTY_TC_IN_PRE_EXP }],
                                    },
                                  }))}
                                />
                              </RowActions>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.tcinTotalRow}>
                  <span>Total</span>
                  <span>${money(grossCalc.preTcTotal)}</span>
                </div>
              </div>
            </Accordion>

            <Accordion title="Bunkers">
              <div className={styles.tcinBunkerStack}>
                <div className={`${styles.tcinSecCard} ${styles.tcinSecMustard}`}>
                  <span className={`${styles.tcinSecTab} ${styles.tcinSecTabMustard}`}>
                    Bunkers on <span className={styles.tcinDirChip}>Delivery</span>
                  </span>
                  <BunkerTable
                    rows={draft.deliveryBunkers || []}
                    bunkers={lookups?.bunkers}
                    readOnly={readOnly}
                    qtyLocked={false}
                    onChange={(i, f) => patchBunker('del', i, f)}
                    onAdd={() => setDraft((prev) => {
                      const deliveryBunkers = [...(prev.deliveryBunkers || []), { ...EMPTY_TC_IN_BUNKER }];
                      const reDelDate = (prev.hires || [])[(prev.hires || []).length - 1]?.redeliveryDate || '';
                      return {
                        ...prev,
                        deliveryBunkers,
                        redeliveryBunkers: copyDeliveryToRedelivery(deliveryBunkers, reDelDate),
                      };
                    })}
                    onRemove={(i) => setDraft((prev) => {
                      const deliveryBunkers = prev.deliveryBunkers.length > 1
                        ? prev.deliveryBunkers.filter((_, idx) => idx !== i)
                        : [{ ...EMPTY_TC_IN_BUNKER }];
                      const reDelDate = (prev.hires || [])[(prev.hires || []).length - 1]?.redeliveryDate || '';
                      return {
                        ...prev,
                        deliveryBunkers,
                        redeliveryBunkers: copyDeliveryToRedelivery(deliveryBunkers, reDelDate),
                      };
                    })}
                  />
                </div>
                <div className={`${styles.tcinSecCard} ${styles.tcinSecMustard}`}>
                  <span className={`${styles.tcinSecTab} ${styles.tcinSecTabMustard}`}>
                    Bunkers on <span className={styles.tcinDirChip}>Redelivery</span>
                  </span>
                  <BunkerTable
                    rows={draft.redeliveryBunkers || []}
                    bunkers={lookups?.bunkers}
                    readOnly={readOnly}
                    qtyLocked
                    onChange={(i, f) => patchBunker('redel', i, f)}
                    onAdd={null}
                    onRemove={null}
                  />
                </div>
              </div>
            </Accordion>

            <Accordion title="TC Terms for Voyage">
              <div className={styles.subBlockLabel}>Sea Passage</div>
              <div className={styles.tcinDenseGrid}>
                {[
                  ['windForce', 'Wind Force'],
                  ['speedLaden', 'Speed (L) (KTS)'],
                  ['speedBallast', 'Speed (B) (KTS)'],
                  ['cpSpeed', 'CP Speed'],
                  ['foConsLaden', 'FO Cons (L) (MT/DAY)'],
                  ['doConsLaden', 'DO Cons (L) (MT/DAY)'],
                  ['foConsBallast', 'FO Cons (B) (MT/DAY)'],
                  ['doConsBallast', 'DO Cons (B) (MT/DAY)'],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      value={draft.voyageTerms?.[key] || ''}
                      onChange={(e) => patchVoyage({ [key]: e.target.value })}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                ))}
              </div>
              <div className={styles.subBlockLabel}>Port</div>
              <div className={styles.tcinDenseGrid}>
                {[
                  ['foConsLdg', 'FO Cons Ldg (MT/day)'],
                  ['doConsLdg', 'DO Cons Ldg (MT/day)'],
                  ['foConsDisch', 'FO Cons Disch (MT/day)'],
                  ['doConsDisch', 'DO Cons Disch (MT/day)'],
                  ['foConsIdle', 'FO Cons Idle (MT/day)'],
                  ['doConsIdle', 'DO Cons Idle (MT/day)'],
                  ['loadRate', 'Load Rate (MT/day)'],
                  ['dischRate', 'Disch Rate (MT/day)'],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      value={draft.voyageTerms?.[key] || ''}
                      onChange={(e) => patchVoyage({ [key]: e.target.value })}
                      readOnly={readOnly}
                      className={ro}
                    />
                  </Field>
                ))}
              </div>
            </Accordion>

            <Accordion title="Additional Info & Documents">
              <div className={styles.tcinDenseGrid}>
                <Field label="More Info" wide>
                  <input
                    value={draft.additionalInfo || ''}
                    onChange={(e) => patch({ additionalInfo: e.target.value })}
                    placeholder="Description"
                    readOnly={readOnly}
                    className={ro}
                  />
                </Field>
              </div>
              <div className={styles.tcinDropzone}>
                <div className={styles.tcinDropzoneText}>
                  <b>Drag & drop files here</b>, or browse
                  {!readOnly ? (
                    <label className={styles.tcinFileLabel}>
                      <input
                        type="file"
                        multiple
                        hidden
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          setDraft((prev) => ({
                            ...prev,
                            documents: [
                              ...(prev.documents || []),
                              ...files.map((f) => ({ name: f.name, size: f.size })),
                            ],
                          }));
                          e.target.value = '';
                        }}
                      />
                      Browse
                    </label>
                  ) : null}
                </div>
                {(draft.documents || []).length ? (
                  <ul className={styles.tcinDocList}>
                    {draft.documents.map((doc, i) => (
                      <li key={`${doc.name}-${i}`}>
                        <span>{doc.name}</span>
                        {!readOnly ? (
                          <button
                            type="button"
                            className={styles.thdRemoveBtn}
                            onClick={() => setDraft((prev) => ({
                              ...prev,
                              documents: prev.documents.filter((_, idx) => idx !== i),
                            }))}
                          >
                            Remove
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Accordion>
          </div>

          <aside className={styles.tcinRecapRhs}>
            <details className={styles.tcinResBlock} open>
              <summary className={styles.tcinResHead}>
                <span>Hire Expense</span>
                <svg className={styles.tcinResChev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </summary>
              <div className={styles.tcinResBody}>
                <div className={`${styles.tcinResRow} ${styles.tcinResAccent}`}>
                  <span className={styles.tcinResLabel}>Total Hire Payable</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.totalHirePayable)}</span>
                </div>
                <div className={styles.tcinResRow}>
                  <span className={styles.tcinResLabel}>Less Off-Hire</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.lessOffHire)}</span>
                </div>
                <div className={styles.tcinResRow}>
                  <span className={styles.tcinResLabel}>Net TC Days</span>
                  <span className={styles.tcinResVal}>{grossCalc.netTcDays}</span>
                </div>
                <div className={styles.tcinResRow}>
                  <span className={styles.tcinResLabel}>Net Hire/Day</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.netHirePerDay)}</span>
                </div>
                <div className={`${styles.tcinResRow} ${styles.tcinResOrange}`}>
                  <span className={styles.tcinResLabel}>Net Hire Expense</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.netHireExpense)}</span>
                </div>
              </div>
            </details>
            <details className={styles.tcinResBlock} open>
              <summary className={styles.tcinResHead}>
                <span>Pre-TC Expenses</span>
                <svg className={styles.tcinResChev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </summary>
              <div className={styles.tcinResBody}>
                <div className={`${styles.tcinResRow} ${styles.tcinResOrange}`}>
                  <span className={styles.tcinResLabel}>Total Pre-TC Expenses</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.preTcTotal)}</span>
                </div>
              </div>
            </details>
            <details className={styles.tcinResBlock} open>
              <summary className={styles.tcinResHead}>
                <span>TC Expenses</span>
                <svg className={styles.tcinResChev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </summary>
              <div className={styles.tcinResBody}>
                <div className={`${styles.tcinResRow} ${styles.tcinResOrange}`}>
                  <span className={styles.tcinResLabel}>Total TC Expenses</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.tcExpensesTotal)}</span>
                </div>
              </div>
            </details>
            <details className={styles.tcinResBlock} open>
              <summary className={styles.tcinResHead}>
                <span>Gross Hire Expense</span>
                <svg className={styles.tcinResChev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </summary>
              <div className={styles.tcinResBody}>
                <div className={`${styles.tcinResRow} ${styles.tcinResAccent}`}>
                  <span className={styles.tcinResLabel}>Gross Hire Expense (Net Hire + Pre-TC + TC Exp.)</span>
                  <span className={styles.tcinResVal}>{money(grossCalc.grossHireExpense)}</span>
                </div>
              </div>
            </details>
          </aside>
        </div>

        <div className={`${styles.thdFooter} ${styles.viewModeAllow}`}>
          <button type="button" className={styles.thdCloseBtn} onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly ? (
            <button type="button" className={styles.thdApplyBtn} onClick={handleApply}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <path d="M17 21v-8H7v8" />
                <path d="M7 3v5h8" />
              </svg>
              Save TC In Hire Recap
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BunkerTable({
  rows,
  bunkers,
  onChange,
  onAdd,
  onRemove,
  readOnly = false,
  qtyLocked = false,
}) {
  return (
    <>
      <div className={styles.miniTableWrap}>
        <table className={styles.miniTable}>
          <thead>
            <tr>
              <th>Bunker Grade</th>
              <th>Qty (MT)</th>
              <th>Price (/MT)</th>
              <th>Bunker Date</th>
              <th>Amount</th>
              {!qtyLocked ? <th style={{ width: 72 }} /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`tcin-bunker-${index}`}>
                <td>
                  <select
                    value={row.bunkerId != null ? String(row.bunkerId) : ''}
                    onChange={(e) => onChange(index, { bunkerId: e.target.value })}
                    disabled={readOnly || qtyLocked}
                  >
                    <option value="">Select</option>
                    {(bunkers || []).map((opt) => (
                      <option key={String(opt.id)} value={String(opt.id)}>{opt.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={row.qty || ''}
                    onChange={(e) => onChange(index, { qty: e.target.value })}
                    placeholder="0.00"
                    readOnly={readOnly || qtyLocked}
                    className={(readOnly || qtyLocked) ? styles.inputReadonly : undefined}
                    title={qtyLocked ? 'Mirrors Delivery quantity — only Redelivery price is editable' : undefined}
                  />
                </td>
                <td>
                  <input
                    value={row.price || ''}
                    onChange={(e) => onChange(index, { price: e.target.value })}
                    placeholder="0.00"
                    readOnly={readOnly}
                    className={readOnly ? styles.inputReadonly : undefined}
                  />
                </td>
                <td>
                  <DmyDateInput
                    value={row.bunkerDate || ''}
                    onChange={(v) => onChange(index, { bunkerDate: v })}
                    disabled={readOnly}
                  />
                </td>
                <td><input className={styles.inputReadonly} readOnly value={row.amount || ''} placeholder="0.00" /></td>
                {!qtyLocked ? (
                  <td>
                    {!readOnly && (onAdd || onRemove) ? (
                      <RowActions>
                        {onAdd ? (
                          <RowAddButton title="Add bunker row" onClick={onAdd} />
                        ) : null}
                        {onRemove ? (
                          <RowDelButton title="Delete row" onClick={() => onRemove(index)} />
                        ) : null}
                      </RowActions>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export {
  EMPTY_TC_IN_BUNKER,
  EMPTY_TC_IN_HIRE,
  EMPTY_TC_IN_OFF,
  calcTcInFinalHireage,
  calcTcInGrossHireExpense,
  buildTcInRecapDraft,
};

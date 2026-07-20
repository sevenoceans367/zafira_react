import React, { useEffect, useMemo, useState } from 'react';
import { Button, CardSelect, DmyDateInput } from '@bainbridge/shared-ui';
import { daysBetween } from '../../../services/tcEstimates.js';
import styles from './TcPages.module.css';

const EMPTY_HIRE = {
  deliveryDate: '',
  redeliveryDate: '',
  voyageDays: '',
  dailyHire: '',
  hireage: '',
  ballastBonus: '',
  grossHireage: '',
  addCommPct: '',
  addCommAmt: '',
  addCommVendor: '',
  brokerCommPct: '',
  brokerCommAmt: '',
  brokerVendor: '',
  nettHireage: '',
  cveMonth: '',
  cveAmt: '',
  randomId: '',
};

const EMPTY_BUNKER = { bunkerId: '', qty: '', price: '', amount: '', bunkerDate: '' };
const EMPTY_OFF = { reason: '', from: '', to: '', days: '', hireRate: '', amount: '' };

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function resolveHireRow(row) {
  let voyageDays = num(row.voyageDays);
  // Match PHP: always recompute voyage days from delivery/redelivery when both set.
  if (row.deliveryDate && row.redeliveryDate) {
    voyageDays = daysBetween(row.redeliveryDate, row.deliveryDate);
  }
  const dailyHire = num(row.dailyHire);
  const hireage = dailyHire * voyageDays;
  const ballastBonus = num(row.ballastBonus);
  const grossHireage = hireage + ballastBonus;
  const addCommPct = num(row.addCommPct);
  const brokerCommPct = num(row.brokerCommPct);
  const addCommAmt = (grossHireage * addCommPct) / 100;
  const brokerCommAmt = (hireage * brokerCommPct) / 100;
  const nettHireage = grossHireage - addCommAmt - brokerCommAmt;
  const cveMonth = num(row.cveMonth);
  const cveAmt = ((cveMonth * 12) / 365) * voyageDays;
  return {
    ...row,
    voyageDays: voyageDays ? String(Number(voyageDays.toFixed(4))) : '',
    hireage: hireage.toFixed(2),
    grossHireage: grossHireage.toFixed(2),
    addCommAmt: addCommAmt.toFixed(2),
    brokerCommAmt: brokerCommAmt.toFixed(2),
    nettHireage: nettHireage.toFixed(2),
    cveAmt: cveAmt.toFixed(2),
  };
}

function bunkerAmount(row) {
  return (num(row.qty) * num(row.price)).toFixed(2);
}

export function calcTcInFinalHireage(tcIn = {}) {
  const hires = (tcIn.hires || []).map(resolveHireRow);
  const delTotal = (tcIn.deliveryBunkers || []).reduce((s, r) => s + num(r.qty) * num(r.price), 0);
  const reDelTotal = (tcIn.redeliveryBunkers || []).reduce((s, r) => s + num(r.qty) * num(r.price), 0);
  let offHireDays = 0;
  let offHireAmt = 0;
  let ownerBunker = num(tcIn.bunkerOnOwner);
  const offHires = (tcIn.offHires || []).map((row) => {
    let days = num(row.days);
    const hasFrom = row.from != null && String(row.from).trim() !== '';
    if (hasFrom && row.to) {
      days = daysBetween(row.to, row.from);
    }
    const amount = days * num(row.hireRate);
    if (hasFrom) offHireDays += days;
    offHireAmt += amount;
    // PHP sums off-hire bunkers with ChkOFFHireCal checked into owners bunker / less off-hire.
    if (!tcIn.bunkerOnOwner && Array.isArray(row.bunkers)) {
      for (const bunker of row.bunkers) {
        if (bunker.onOwner || bunker.calc) {
          ownerBunker += (num(bunker.qty) * num(bunker.price)) || num(bunker.amount);
        }
      }
    }
    return {
      ...row,
      days: days ? String(Number(days.toFixed(4))) : '',
      amount: amount.toFixed(2),
    };
  });
  const offHireCveMonth = num(tcIn.offHireCveMonth);
  const offHireCveAmt = ((offHireCveMonth * 12) / 365) * offHireDays;
  const lessOffHire = offHireAmt + offHireCveAmt + ownerBunker;
  const nettPlusCve = hires.reduce((s, r) => s + num(r.nettHireage) + num(r.cveAmt), 0);
  const finalHireage = nettPlusCve
    + num(tcIn.awrpCost)
    + delTotal
    - reDelTotal
    - lessOffHire
    + num(tcIn.ilohc);
  return {
    hires,
    deliveryBunkers: (tcIn.deliveryBunkers || []).map((r) => ({ ...r, amount: bunkerAmount(r) })),
    redeliveryBunkers: (tcIn.redeliveryBunkers || []).map((r) => ({ ...r, amount: bunkerAmount(r) })),
    offHires,
    bunkerOnOwner: ownerBunker ? ownerBunker.toFixed(2) : (tcIn.bunkerOnOwner || ''),
    offHireCveAmt: offHireCveAmt.toFixed(2),
    lessOffHire: lessOffHire.toFixed(2),
    finalHireage: finalHireage.toFixed(2),
  };
}

export default function TcInExpensesModal({
  open,
  value,
  detail,
  lookups,
  onClose,
  onApply,
  readOnly = false,
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const calc = useMemo(() => calcTcInFinalHireage(draft || {}), [draft]);

  if (!open || !draft) return null;

  const patch = (patchValue) => setDraft((prev) => ({ ...prev, ...patchValue }));

  const patchHire = (index, fields) => {
    setDraft((prev) => {
      const hires = [...(prev.hires || [])];
      hires[index] = resolveHireRow({ ...hires[index], ...fields });
      return { ...prev, hires };
    });
  };

  const patchBunker = (side, index, fields) => {
    const key = side === 'del' ? 'deliveryBunkers' : 'redeliveryBunkers';
    setDraft((prev) => {
      const rows = [...(prev[key] || [])];
      const next = { ...rows[index], ...fields };
      next.amount = bunkerAmount(next);
      rows[index] = next;
      return { ...prev, [key]: rows };
    });
  };

  const patchOff = (index, fields) => {
    setDraft((prev) => {
      const rows = [...(prev.offHires || [])];
      let days = num(fields.days ?? rows[index].days);
      const from = fields.from ?? rows[index].from;
      const to = fields.to ?? rows[index].to;
      if (from && to) {
        const diff = daysBetween(to, from);
        if (diff) days = diff;
      }
      const hireRate = fields.hireRate ?? rows[index].hireRate;
      rows[index] = {
        ...rows[index],
        ...fields,
        days: days ? String(Number(days.toFixed(4))) : '',
        amount: (days * num(hireRate)).toFixed(2),
      };
      return { ...prev, offHires: rows };
    });
  };

  const handleApply = () => {
    onApply({
      ...draft,
      ...calc,
      finalHireage: calc.finalHireage,
      offHireCveAmt: calc.offHireCveAmt,
      lessOffHire: calc.lessOffHire,
    });
  };

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div className={`${styles.modal} ${styles.tcInModal}`}>
        <div className={styles.modalHeader}>
          <h3>{readOnly ? 'View TC Hire Details' : 'TC Hire Details'}</h3>
          <Button variant="outline" label="Close" onClick={onClose} />
        </div>

        <div className={readOnly ? styles.viewModeLock : undefined}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>Vessel</label>
            <input className={styles.inputReadonly} readOnly value={detail?.vesselName || ''} />
          </div>
          <div className={styles.field}>
            <label>CP Date</label>
            <DmyDateInput value={draft.cpDate || ''} onChange={(v) => patch({ cpDate: v })} />
          </div>
          <div className={styles.field}>
            <label>Contract Ref.</label>
            <input value={draft.contractRef || ''} onChange={(e) => patch({ contractRef: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label>Port/Region of Delivery</label>
            <input value={draft.deliveryPort || ''} onChange={(e) => patch({ deliveryPort: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label>Port/Region of Re-Delivery</label>
            <input value={draft.redeliveryPort || ''} onChange={(e) => patch({ redeliveryPort: e.target.value })} />
          </div>
        </div>

        <h4 className={styles.subsectionTitle}>Hire Periods</h4>
        {(draft.hires || []).map((row, index) => {
          const resolved = calc.hires[index] || resolveHireRow(row);
          return (
            <div key={`tc-in-hire-${index}`} className={styles.tcInHireBlock}>
              <div className={styles.tcInHireToolbar}>
                <strong>Trip / Period {index + 1}</strong>
                <button
                  type="button"
                  className={styles.linkBtnDanger}
                  onClick={() => setDraft((prev) => ({
                    ...prev,
                    hires: prev.hires.length > 1
                      ? prev.hires.filter((_, i) => i !== index)
                      : [{ ...EMPTY_HIRE }],
                  }))}
                >
                  Remove
                </button>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Date of Delivery</label>
                  <DmyDateInput enableTime value={row.deliveryDate} onChange={(v) => patchHire(index, { deliveryDate: v })} />
                </div>
                <div className={styles.field}>
                  <label>Date of Re-Delivery</label>
                  <DmyDateInput enableTime value={row.redeliveryDate} onChange={(v) => patchHire(index, { redeliveryDate: v })} />
                </div>
                <div className={styles.field}>
                  <label>Total Voyage Days</label>
                  <input className={styles.inputReadonly} readOnly value={resolved.voyageDays} />
                </div>
                <div className={styles.field}>
                  <label>Daily Hire (USD/Day)</label>
                  <input value={row.dailyHire} onChange={(e) => patchHire(index, { dailyHire: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Hireage (USD)</label>
                  <input className={styles.inputReadonly} readOnly value={resolved.hireage} />
                </div>
                <div className={styles.field}>
                  <label>Ballast Bonus (USD)</label>
                  <input value={row.ballastBonus} onChange={(e) => patchHire(index, { ballastBonus: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Gross Hire-age (USD)</label>
                  <input className={styles.inputReadonly} readOnly value={resolved.grossHireage} />
                </div>
                <div className={styles.field}>
                  <label>Add Comm (%)</label>
                  <div className={styles.pairFields}>
                    <input value={row.addCommPct} onChange={(e) => patchHire(index, { addCommPct: e.target.value })} />
                    <input className={styles.inputReadonly} readOnly value={resolved.addCommAmt} />
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Add Comm Vendor</label>
                  <CardSelect
                    options={lookups?.vendors || []}
                    value={row.addCommVendor}
                    onChange={(v) => patchHire(index, { addCommVendor: v })}
                    placeholder="Select vendor"
                    ariaLabel="Add commission vendor"
                  />
                </div>
                <div className={styles.field}>
                  <label>Owners side Brokerage (%)</label>
                  <div className={styles.pairFields}>
                    <input value={row.brokerCommPct} onChange={(e) => patchHire(index, { brokerCommPct: e.target.value })} />
                    <input className={styles.inputReadonly} readOnly value={resolved.brokerCommAmt} />
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Broker</label>
                  <CardSelect
                    options={lookups?.vendors || []}
                    value={row.brokerVendor}
                    onChange={(v) => patchHire(index, { brokerVendor: v })}
                    placeholder="Select broker"
                    ariaLabel="Broker vendor"
                  />
                </div>
                <div className={styles.field}>
                  <label>Nett Hire-age (USD)</label>
                  <input className={styles.inputReadonly} readOnly value={resolved.nettHireage} />
                </div>
                <div className={styles.field}>
                  <label>CVE (Per Month)</label>
                  <div className={styles.pairFields}>
                    <input value={row.cveMonth} onChange={(e) => patchHire(index, { cveMonth: e.target.value })} />
                    <input className={styles.inputReadonly} readOnly value={resolved.cveAmt} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <Button
          variant="outline"
          label="Add New Trip/Period"
          onClick={() => setDraft((prev) => ({
            ...prev,
            hires: [...(prev.hires || []), {
              ...EMPTY_HIRE,
              dailyHire: detail?.hireFixPer || '',
              addCommPct: detail?.addComm || '',
            }],
          }))}
        />

        <div className={styles.fixtureLayout} style={{ marginTop: 16 }}>
          <div>
            <h4 className={styles.subsectionTitle}>Delivery Bunkers</h4>
            <BunkerRows
              rows={draft.deliveryBunkers || []}
              bunkers={lookups?.bunkers}
              onChange={(i, f) => patchBunker('del', i, f)}
              onAdd={() => setDraft((prev) => ({
                ...prev,
                deliveryBunkers: [...(prev.deliveryBunkers || []), { ...EMPTY_BUNKER }],
              }))}
              onRemove={(i) => setDraft((prev) => ({
                ...prev,
                deliveryBunkers: prev.deliveryBunkers.length > 1
                  ? prev.deliveryBunkers.filter((_, idx) => idx !== i)
                  : [{ ...EMPTY_BUNKER }],
              }))}
            />
          </div>
          <div>
            <h4 className={styles.subsectionTitle}>Redelivery Bunkers</h4>
            <BunkerRows
              rows={draft.redeliveryBunkers || []}
              bunkers={lookups?.bunkers}
              onChange={(i, f) => patchBunker('redel', i, f)}
              onAdd={() => setDraft((prev) => ({
                ...prev,
                redeliveryBunkers: [...(prev.redeliveryBunkers || []), { ...EMPTY_BUNKER }],
              }))}
              onRemove={(i) => setDraft((prev) => ({
                ...prev,
                redeliveryBunkers: prev.redeliveryBunkers.length > 1
                  ? prev.redeliveryBunkers.filter((_, idx) => idx !== i)
                  : [{ ...EMPTY_BUNKER }],
              }))}
            />
          </div>
        </div>

        <h4 className={styles.subsectionTitle}>Off Hire</h4>
        <table className={styles.rowTable}>
          <thead>
            <tr>
              <th />
              <th>Reason</th>
              <th>From</th>
              <th>To</th>
              <th>Days</th>
              <th>Rate/Day</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(draft.offHires || []).map((row, index) => (
              <tr key={`tc-in-off-${index}`}>
                <td>
                  <button
                    type="button"
                    className={styles.linkBtnDanger}
                    onClick={() => setDraft((prev) => ({
                      ...prev,
                      offHires: prev.offHires.length > 1
                        ? prev.offHires.filter((_, i) => i !== index)
                        : [{ ...EMPTY_OFF }],
                    }))}
                  >
                    ×
                  </button>
                </td>
                <td><textarea rows={2} value={row.reason} onChange={(e) => patchOff(index, { reason: e.target.value })} /></td>
                <td><DmyDateInput enableTime value={row.from} onChange={(v) => patchOff(index, { from: v })} /></td>
                <td><DmyDateInput enableTime value={row.to} onChange={(v) => patchOff(index, { to: v })} /></td>
                <td><input value={row.days} onChange={(e) => patchOff(index, { days: e.target.value })} /></td>
                <td><input value={row.hireRate} onChange={(e) => patchOff(index, { hireRate: e.target.value })} /></td>
                <td><input className={styles.inputReadonly} readOnly value={row.amount} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button
          variant="outline"
          label="Add Off-Hire"
          onClick={() => setDraft((prev) => ({
            ...prev,
            offHires: [...(prev.offHires || []), { ...EMPTY_OFF }],
          }))}
        />

        <div className={styles.formGrid} style={{ marginTop: 16 }}>
          <div className={styles.field}>
            <label>CVE Off Hire (Per Month)</label>
            <div className={styles.pairFields}>
              <input value={draft.offHireCveMonth || ''} onChange={(e) => patch({ offHireCveMonth: e.target.value })} />
              <input className={styles.inputReadonly} readOnly value={calc.offHireCveAmt} />
            </div>
          </div>
          <div className={styles.field}>
            <label>Bunker on Owner&apos;s Account</label>
            <input value={draft.bunkerOnOwner || ''} onChange={(e) => patch({ bunkerOnOwner: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label>Off Hire</label>
            <input className={styles.inputReadonly} readOnly value={calc.lessOffHire} />
          </div>
          <div className={styles.field}>
            <label>ILOHC</label>
            <input value={draft.ilohc || ''} onChange={(e) => patch({ ilohc: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label>AWRP & Other Costs</label>
            <input value={draft.awrpCost || ''} onChange={(e) => patch({ awrpCost: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label>Final Hire-age</label>
            <input className={styles.inputReadonly} readOnly value={calc.finalHireage} />
          </div>
          <div className={styles.field}>
            <label>Vendor</label>
            <CardSelect
              options={lookups?.vendors || []}
              value={draft.finalVendor || ''}
              onChange={(v) => patch({ finalVendor: v })}
              placeholder="Select vendor"
              ariaLabel="Final hireage vendor"
            />
          </div>
        </div>
        </div>

        <div className={styles.formActions}>
          {!readOnly ? <Button label="Apply" onClick={handleApply} /> : null}
          <Button variant="outline" label="Close" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

function BunkerRows({ rows, bunkers, onChange, onAdd, onRemove }) {
  return (
    <>
      <table className={styles.rowTable}>
        <thead>
          <tr>
            <th />
            <th>Bunker Grade</th>
            <th>Qty</th>
            <th>Date</th>
            <th>Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`tc-in-bunker-${index}`}>
              <td>
                <button type="button" className={styles.linkBtnDanger} onClick={() => onRemove(index)}>×</button>
              </td>
              <td>
                <select
                  value={row.bunkerId != null ? String(row.bunkerId) : ''}
                  onChange={(e) => onChange(index, { bunkerId: e.target.value })}
                >
                  <option value="">Select</option>
                  {(bunkers || []).map((opt) => (
                    <option key={String(opt.id)} value={String(opt.id)}>{opt.name}</option>
                  ))}
                  {row.bunkerId != null
                    && String(row.bunkerId).trim() !== ''
                    && !(bunkers || []).some((opt) => String(opt.id) === String(row.bunkerId))
                    ? (
                      <option value={String(row.bunkerId)}>{`Grade #${row.bunkerId}`}</option>
                    )
                    : null}
                </select>
              </td>
              <td><input value={row.qty || ''} onChange={(e) => onChange(index, { qty: e.target.value })} /></td>
              <td><DmyDateInput value={row.bunkerDate || ''} onChange={(v) => onChange(index, { bunkerDate: v })} /></td>
              <td><input value={row.price || ''} onChange={(e) => onChange(index, { price: e.target.value })} /></td>
              <td><input className={styles.inputReadonly} readOnly value={row.amount || ''} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button variant="outline" label="Add" onClick={onAdd} />
    </>
  );
}

export { EMPTY_HIRE as EMPTY_TC_IN_HIRE, EMPTY_BUNKER as EMPTY_TC_IN_BUNKER, EMPTY_OFF as EMPTY_TC_IN_OFF };

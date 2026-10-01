import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  allocateConsumedCost,
  buildBunkerFifo,
  fifoGrandTotal,
  formatFifoMoney,
} from './bunkerFifo.js';
import styles from './BunkerFifoModal.module.css';

function defaultAlloc(grade) {
  return { mode: 'percent', owner: '100' };
}

function complementValue(mode, owner, consumed) {
  const ownerNum = Number(String(owner ?? '').replace(/,/g, '')) || 0;
  if (mode === 'qty') {
    const left = Math.max(0, (Number(consumed) || 0) - ownerNum);
    return left.toFixed(2);
  }
  return String(Math.max(0, 100 - ownerNum));
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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

export default function BunkerFifoModal({
  open,
  onClose,
  form,
  resolveGradeName,
  consumedByGrade,
  priceByGrade,
  summaryRows = [],
  vendorName,
  readOnly = false,
  subtitle = '',
  onApply,
}) {
  const ledger = useMemo(
    () => buildBunkerFifo({
      form,
      resolveGradeName,
      consumedByGrade,
      priceByGrade,
      summaryRows,
      vendorName,
    }),
    [form, resolveGradeName, consumedByGrade, priceByGrade, summaryRows, vendorName],
  );
  const total = fifoGrandTotal(ledger);
  const [alloc, setAlloc] = useState(() => ({ ...(form.bunkerFifoAlloc || {}) }));

  if (!open) return null;

  const setMode = (grade, mode) => {
    setAlloc((prev) => ({
      ...prev,
      [grade]: { ...(prev[grade] || defaultAlloc(grade)), mode },
    }));
  };
  const setOwner = (grade, owner) => {
    setAlloc((prev) => ({
      ...prev,
      [grade]: { ...(prev[grade] || defaultAlloc(grade)), owner },
    }));
  };

  const layers = ledger.flatMap((grade) => grade.layers.map((layer, index) => ({ ...layer, key: `${grade.grade}-${index}` })));
  const subLine = [subtitle, 'FIFO costing, stem detail and Owner/Charterer cost allocation'].filter(Boolean).join(' · ');

  const content = (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bunker-fifo-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headLeft}>
            <span className={styles.headIcon}><ReceiptIcon /></span>
            <div>
              <h3 id="bunker-fifo-title">Bunkers — Full Cost Calculations</h3>
              {subLine ? <p className={styles.sub}>{subLine}</p> : null}
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body}>
          <section>
            <h4><span>1</span>Stem Details</h4>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Grade</th>
                    <th>Source</th>
                    <th>Delivery Date</th>
                    <th>Port</th>
                    <th>Vendor</th>
                    <th>Quantity (MT)</th>
                    <th>Price (MT)</th>
                    <th>Additional Cost</th>
                    <th>Booking Qty (Min/Max)</th>
                    <th>Payment Terms</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {layers.length ? layers.map((layer) => (
                    <tr key={layer.key} className={layer.carried ? styles.carried : ''}>
                      <td className={layer.carried ? '' : styles.gradeStrong}>{layer.grade}</td>
                      <td>
                        {layer.source}
                        {layer.carried ? <span className={styles.badge}>Carried Forward</span> : null}
                      </td>
                      <td>—</td>
                      <td>{layer.port || '—'}</td>
                      <td>{layer.vendor || '—'}</td>
                      <td>{Number(layer.qty).toFixed(2)}</td>
                      <td>{Number(layer.price).toFixed(2)}</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>{formatFifoMoney(layer.qty * layer.price)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={11}>No bunker quantities on this worksheet yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className={styles.note}>
              Opening B/F is this voyage’s arrival ROB, carried at the grade’s reference price.
              Stems are the Bunkers → Stemmed rows, consumed oldest first.
            </p>
          </section>

          <section>
            <h4><span>2</span>FIFO Stock Ledger</h4>
            {ledger.map((grade) => {
              const remainPrice = grade.remainingQty > 0 ? grade.remainingCost / grade.remainingQty : 0;
              return (
                <div key={grade.grade} className={styles.ledger}>
                  <div className={styles.ledgerHead}>{grade.grade}</div>
                  <div className={styles.steps}>
                    <div>
                      <span>Available</span>
                      <b>{grade.available.toFixed(2)} MT</b>
                      <small>{grade.availableNote || '—'}</small>
                    </div>
                    <div className={styles.consumed}>
                      <span>Consumed (FIFO)</span>
                      <b>{grade.consumed.toFixed(2)} MT</b>
                      <small>
                        {grade.consumedNote
                          ? `${grade.consumedNote} = $${formatFifoMoney(grade.consumedCost)}`
                          : '—'}
                      </small>
                    </div>
                    <div className={styles.remaining}>
                      <span>Remaining</span>
                      <b>{grade.remainingQty.toFixed(2)} MT</b>
                      <small>
                        {grade.remainingQty > 0
                          ? `@ ${remainPrice.toFixed(2)} = $${formatFifoMoney(grade.remainingCost)} → carries to next voyage`
                          : 'carries to next voyage'}
                      </small>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className={styles.note}>
              This FIFO-layered cost (${formatFifoMoney(total)}) is the figure to use for invoicing.
              The accordion Amount column is consumed × one reference price and can differ slightly.
            </p>
          </section>

          <section>
            <h4><span>3</span>Cost Allocation — Owner / Charterer</h4>
            {ledger.map((grade) => {
              const row = alloc[grade.grade] || defaultAlloc(grade.grade);
              const split = allocateConsumedCost(grade.consumedCost, row.mode, row.owner, grade.consumed);
              const unit = row.mode === 'qty' ? 'MT' : '%';
              const chartererInput = complementValue(row.mode, row.owner, grade.consumed);
              return (
                <div key={grade.grade} className={styles.alloc}>
                  <div className={styles.allocHead}>
                    <div>
                      <b>{grade.grade}</b>
                      <small>Consumed cost: ${formatFifoMoney(grade.consumedCost)}</small>
                    </div>
                    <div className={styles.toggle}>
                      <button type="button" className={row.mode !== 'qty' ? styles.on : ''} onClick={() => setMode(grade.grade, 'percent')}>By %</button>
                      <button type="button" className={row.mode === 'qty' ? styles.on : ''} onClick={() => setMode(grade.grade, 'qty')}>By Quantity</button>
                    </div>
                  </div>
                  <div className={styles.parties}>
                    <div className={styles.party}>
                      <span className={styles.partyLabel}><i className={styles.dotOwner} />Owner</span>
                      <div className={styles.inputRow}>
                        <input
                          value={row.owner}
                          readOnly={readOnly}
                          inputMode="decimal"
                          onChange={(e) => setOwner(grade.grade, e.target.value)}
                        />
                        <em>{unit}</em>
                      </div>
                      <strong>${formatFifoMoney(split.owner)}</strong>
                    </div>
                    <div className={styles.party}>
                      <span className={styles.partyLabel}><i className={styles.dotCharterer} />Charterer</span>
                      <div className={styles.inputRow}>
                        <input value={chartererInput} readOnly />
                        <em>{unit}</em>
                      </div>
                      <strong>${formatFifoMoney(split.charterer)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnOutline} onClick={onClose}>
            <CloseIcon />
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnNavy}
            disabled={readOnly}
            onClick={() => {
              onApply?.({ alloc, fifoTotal: total });
              onClose();
            }}
          >
            <CheckIcon />
            Apply Allocation
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

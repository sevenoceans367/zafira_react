import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DmyDateInput, RowAddButton, RowDelButton } from '@bainbridge/shared-ui';
import { HScrollButtons } from '../../sopf/ScrollableTable.jsx';
import {
  buildBunkerFifo,
  fifoGrandTotal,
} from './bunkerFifo.js';
import WorksheetSelect from './WorksheetSelect.jsx';
import styles from './BunkerFifoModal.module.css';

function DropletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3c-3 4-6 7.5-6 11a6 6 0 0 0 12 0c0-3.5-3-7-6-11z" />
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

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function ChartererChipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}

function num(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyTip(value) {
  const n = num(value);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildPortCards(form) {
  const ports = [];
  const seen = new Set();
  for (const leg of form.portLegs || []) {
    const candidates = [
      {
        id: leg.fromPortId,
        name: leg.fromPortName,
        sosp: leg.fromDeparture || leg.fromArrival || '',
        sospField: 'fromDeparture',
        robFo: leg.fromRobFoDeparture || leg.fromRobFoArrival || '',
        robDo: leg.fromRobDoDeparture || leg.fromRobDoArrival || '',
      },
      {
        id: leg.toPortId,
        name: leg.toPortName,
        sosp: leg.toDeparture || leg.toArrival || '',
        sospField: 'toDeparture',
        robFo: leg.toRobFoDeparture || leg.toRobFoArrival || '',
        robDo: leg.toRobDoDeparture || leg.toRobDoArrival || '',
      },
    ];
    for (const port of candidates) {
      if (!port.id || seen.has(String(port.id))) continue;
      seen.add(String(port.id));
      ports.push({
        id: String(port.id),
        name: port.name || String(port.id),
        legId: leg.id,
        sosp: port.sosp,
        sospField: port.sospField,
        robFo: port.robFo,
        robDo: port.robDo,
      });
    }
  }
  return ports;
}

function KhakiActions({ onAdd, onRemove, readOnly }) {
  if (readOnly) return null;
  return (
    <div className="rowActions">
      <RowAddButton title="Add row" onClick={onAdd} />
      <RowDelButton title="Delete row" onClick={onRemove} />
    </div>
  );
}

function StemScrollShell({ children }) {
  const wrapRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateScroll = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const overflow = max > 4;
    setCanLeft(overflow && el.scrollLeft > 2);
    setCanRight(overflow && el.scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    updateScroll();
    el.addEventListener('scroll', updateScroll, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateScroll) : null;
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    window.addEventListener('resize', updateScroll);
    return () => {
      el.removeEventListener('scroll', updateScroll);
      observer?.disconnect();
      window.removeEventListener('resize', updateScroll);
    };
  }, [updateScroll, children]);

  const scrollByDir = (dir) => {
    const el = wrapRef.current;
    if (!el) return;
    const amount = Math.max(280, Math.round(el.clientWidth * 0.45));
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  return (
    <>
      <div className={styles.subLabelRow}>
        <div className={styles.subLabel}>Stemmed</div>
        <HScrollButtons canLeft={canLeft} canRight={canRight} onScroll={scrollByDir} />
      </div>
      <div className={styles.stemScroll} ref={wrapRef} data-ops-hscroll>
        {children}
      </div>
    </>
  );
}

function VoyageResultsChart({
  title,
  grades,
  getConsumed,
  getRob,
  formatTip,
}) {
  const max = Math.max(
    1,
    ...grades.flatMap((g) => [getConsumed(g), getRob(g)]),
  );
  const barH = (value) => `${Math.max(4, Math.round((value / max) * 132))}px`;
  const colors = {
    VLSFO: { consumed: '#BF6C35', rob: '#D5A07C' },
    LSMGO: { consumed: '#E1952F', rob: '#EBC060' },
  };
  const fallback = { consumed: '#BF6C35', rob: '#D5A07C' };

  return (
    <div className={styles.vrChart}>
      <div className={styles.vrChartTitle}>{title}</div>
      <div className={styles.vrBars}>
        {grades.map((g) => {
          const consumed = getConsumed(g);
          const rob = getRob(g);
          return (
            <div key={g} className={styles.vrGroup}>
              <div className={styles.vrBarPair}>
                <div
                  className={styles.vrBarCol}
                  data-tip={`${g} · Consumed: ${formatTip(consumed)}`}
                >
                  <div className={styles.vrBar} style={{ height: barH(consumed), background: (colors[g] || fallback).consumed }} />
                </div>
                <div
                  className={styles.vrBarCol}
                  data-tip={`${g} · ROB: ${formatTip(rob)}`}
                >
                  <div className={styles.vrBar} style={{ height: barH(rob), background: (colors[g] || fallback).rob }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.vrLabelsRow}>
        {grades.map((g) => (
          <div key={g} className={styles.vrGroupLabel}>{g}</div>
        ))}
      </div>
    </div>
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
  bunkerGrades = [],
  vendors = [],
  voyageNo = '',
  vesselName = '',
  charterer = '',
  readOnly = false,
  onApply,
  onUpdateStem,
  onUpdatePortLeg,
  onAddStem,
  onRemoveStem,
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
  const ports = useMemo(() => buildPortCards(form), [form]);
  const stems = useMemo(
    () => (form.bunkerRows || []).filter((row) => String(row.identify || '').toUpperCase() === 'SUPPLY'),
    [form.bunkerRows],
  );
  const chartGrades = ['VLSFO', 'LSMGO'].filter((g) => ledger.some((row) => row.grade === g));
  const gradesForChart = chartGrades.length ? chartGrades : ['VLSFO', 'LSMGO'];

  const gradeById = (id) => resolveGradeName?.(id) || '';
  const passagePorts = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const port of ports) {
      if (seen.has(port.id)) continue;
      seen.add(port.id);
      list.push({ id: port.id, name: port.name });
    }
    return list;
  }, [ports]);

  if (!open) return null;

  const content = (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bunker-mgmt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headLeft}>
            <span className={styles.headIcon}><DropletIcon /></span>
            <div>
              <h3 id="bunker-mgmt-title">Bunker Management</h3>
              <div className={styles.idRow}>
                <span className={styles.voyId}>
                  {voyageNo ? (
                    <button
                      type="button"
                      className={styles.voyLink}
                      title="Open this voyage's worksheet"
                      onClick={onClose}
                    >
                      {`VOY ${voyageNo}`}
                    </button>
                  ) : (
                    <span className={styles.voyLinkMuted}>VOY —</span>
                  )}
                  {vesselName ? (
                    <>
                      <span className={styles.vcSep}>·</span>
                      {vesselName}
                    </>
                  ) : null}
                </span>
                <span className={styles.chartererChip}>
                  <ChartererChipIcon />
                  Charterer: <b>{charterer || '—'}</b>
                </span>
              </div>
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body}>
          <section>
            <div className={styles.sectionTitle}>Port Rotation</div>
            {ports.length ? ports.map((port, index) => {
              const portStems = stems.filter((row) => String(row.portId) === String(port.id));
              const hasStems = portStems.length > 0;
              return (
                <div key={port.id} className={styles.portCard}>
                  <div className={styles.portHeader}>
                    <span className={styles.portName}>
                      <span className={styles.msn}>{index + 1}</span>
                      {port.name}
                    </span>
                    <div className={styles.sospField}>
                      <label>SOSP</label>
                      {readOnly ? (
                        <input
                          className={styles.roInput}
                          value={port.sosp || ''}
                          readOnly
                          placeholder="dd-mm-yyyy HH:MM"
                        />
                      ) : (
                        <DmyDateInput
                          id={`bunker-sosp-${port.id}`}
                          enableTime
                          value={port.sosp || ''}
                          onChange={(value) => onUpdatePortLeg?.(port.legId, { [port.sospField]: value })}
                        />
                      )}
                    </div>
                  </div>
                  <div className={styles.portBody}>
                    <div className={styles.portSplit}>
                      <div className={styles.robCol}>
                        <div className={styles.subLabel}>ROBs at SOSP</div>
                        <div className={styles.robTableWrap}>
                          <table className={styles.bgTable}>
                            <thead>
                              <tr>
                                <th>Grade</th>
                                <th>Qty (MT)</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td><span className={`${styles.gradeChip} ${styles.gVlsfo}`}>VLSFO</span></td>
                                <td><input className={styles.roInput} value={port.robFo || '0.00'} readOnly /></td>
                              </tr>
                              <tr>
                                <td><span className={`${styles.gradeChip} ${styles.gLsmgo}`}>LSMGO</span></td>
                                <td><input className={styles.roInput} value={port.robDo || '0.00'} readOnly /></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className={styles.stemCol}>
                        {hasStems ? (
                          <StemScrollShell>
                              <table className={styles.stemTable}>
                                <colgroup>
                                  {!readOnly ? <col style={{ width: 52 }} /> : null}
                                  <col style={{ width: 118 }} />
                                  <col style={{ width: 122 }} />
                                  <col style={{ width: 92 }} />
                                  <col style={{ width: 104 }} />
                                  <col style={{ width: 112 }} />
                                  <col style={{ width: 100 }} />
                                  <col style={{ width: 112 }} />
                                  <col style={{ width: 122 }} />
                                  <col style={{ width: 112 }} />
                                  <col style={{ width: 112 }} />
                                  <col style={{ width: 104 }} />
                                  <col style={{ width: 104 }} />
                                  <col style={{ width: 92 }} />
                                  <col style={{ width: 140 }} />
                                </colgroup>
                                <thead>
                                  <tr>
                                    {!readOnly ? <th /> : null}
                                    <th>Grade</th>
                                    <th>Port</th>
                                    <th>Qty(MT)</th>
                                    <th>Price ($/MT)</th>
                                    <th>Amount</th>
                                    <th>Addl Cost</th>
                                    <th>Total Cost</th>
                                    <th>Supplier</th>
                                    <th>Booking Date</th>
                                    <th>Del Date</th>
                                    <th>Booking Qty Min(MT)</th>
                                    <th>Booking Qty Max(MT)</th>
                                    <th>Terms(Days)</th>
                                    <th>Remarks</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {portStems.map((row) => {
                                    const gradeLabel = gradeById(row.bunkerGradeId);
                                    const amount = num(row.qty) * num(row.price);
                                    const totalCost = amount + num(row.addlCost);
                                    return (
                                      <tr key={row.id}>
                                        {!readOnly ? (
                                          <td>
                                            <KhakiActions
                                              onAdd={() => onAddStem?.()}
                                              onRemove={() => onRemoveStem?.(row.id)}
                                            />
                                          </td>
                                        ) : null}
                                        <td>
                                          <WorksheetSelect
                                            value={row.bunkerGradeId || ''}
                                            gradeLabel={gradeLabel}
                                            disabled={readOnly}
                                            options={bunkerGrades.map((g) => ({ value: g.id, label: g.name }))}
                                            onChange={(value) => onUpdateStem?.(row.id, { bunkerGradeId: value })}
                                          />
                                        </td>
                                        <td>
                                          <WorksheetSelect
                                            value={passagePorts.some((p) => p.id === String(row.portId || '')) ? (row.portId || '') : ''}
                                            disabled={readOnly || !passagePorts.length}
                                            placeholder={passagePorts.length ? '— Select —' : 'Select ports in Passage & Ports'}
                                            options={passagePorts.map((p) => ({ value: p.id, label: p.name }))}
                                            onChange={(portId) => {
                                              const match = passagePorts.find((p) => String(p.id) === String(portId));
                                              onUpdateStem?.(row.id, {
                                                portId: match ? String(match.id) : '',
                                                portName: match?.name || '',
                                              });
                                            }}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.cellInput}
                                            value={row.qty || ''}
                                            readOnly={readOnly}
                                            onChange={(e) => onUpdateStem?.(row.id, { qty: e.target.value })}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.cellInput}
                                            value={row.price || ''}
                                            readOnly={readOnly}
                                            onChange={(e) => onUpdateStem?.(row.id, { price: e.target.value })}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.roInput}
                                            value={row.cost || amount.toFixed(2)}
                                            readOnly
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.cellInput}
                                            value={row.addlCost || ''}
                                            readOnly={readOnly}
                                            onChange={(e) => onUpdateStem?.(row.id, { addlCost: e.target.value })}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.roInput}
                                            value={row.totalCost || totalCost.toFixed(2)}
                                            readOnly
                                          />
                                        </td>
                                        <td>
                                          <WorksheetSelect
                                            value={row.vendorId || ''}
                                            disabled={readOnly}
                                            options={vendors.map((vendor) => ({
                                              value: vendor.code || vendor.id,
                                              label: vendor.name,
                                            }))}
                                            onChange={(value) => onUpdateStem?.(row.id, { vendorId: value })}
                                          />
                                        </td>
                                        <td className={styles.dateCell}>
                                          {readOnly ? (
                                            <input value={row.bookingDate || ''} readOnly />
                                          ) : (
                                            <DmyDateInput
                                              id={`stem-booking-${row.id}`}
                                              value={row.bookingDate || ''}
                                              onChange={(value) => onUpdateStem?.(row.id, { bookingDate: value })}
                                            />
                                          )}
                                        </td>
                                        <td className={styles.dateCell}>
                                          {readOnly ? (
                                            <input value={row.deliveryDate || ''} readOnly />
                                          ) : (
                                            <DmyDateInput
                                              id={`stem-del-${row.id}`}
                                              value={row.deliveryDate || ''}
                                              onChange={(value) => onUpdateStem?.(row.id, { deliveryDate: value })}
                                            />
                                          )}
                                        </td>
                                        <td>
                                          <input
                                            className={styles.cellInput}
                                            value={row.bookingQtyMin || ''}
                                            readOnly={readOnly}
                                            onChange={(e) => onUpdateStem?.(row.id, { bookingQtyMin: e.target.value })}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.cellInput}
                                            value={row.bookingQtyMax || ''}
                                            readOnly={readOnly}
                                            onChange={(e) => onUpdateStem?.(row.id, { bookingQtyMax: e.target.value })}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.cellInput}
                                            value={row.termsDays || ''}
                                            readOnly={readOnly}
                                            onChange={(e) => onUpdateStem?.(row.id, { termsDays: e.target.value })}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            className={styles.cellInput}
                                            value={row.remarks || ''}
                                            readOnly={readOnly}
                                            placeholder="Text"
                                            onChange={(e) => onUpdateStem?.(row.id, { remarks: e.target.value })}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                          </StemScrollShell>
                        ) : (
                          <div className={styles.portEmptyNote} aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className={styles.portEmptyNote}>
                <InfoIcon />
                No ports on this voyage yet. Add passage legs to see Port Rotation.
              </div>
            )}
          </section>

          <section>
            <div className={styles.sectionTitle}>Voyage Results</div>
            <div className={styles.vrSectionCard}>
              <div className={styles.vrSectionHead}>Consumptions & ROBs</div>
              <div className={styles.vrSectionBody}>
                <div className={styles.voyageResults}>
                  <VoyageResultsChart
                    title="QTY (MT)"
                    grades={gradesForChart}
                    getConsumed={(g) => num(ledger.find((row) => row.grade === g)?.consumed)}
                    getRob={(g) => num(ledger.find((row) => row.grade === g)?.remainingQty)}
                    formatTip={(v) => `${v.toFixed(2)} MT`}
                  />
                  <VoyageResultsChart
                    title="Value ($)"
                    grades={gradesForChart}
                    getConsumed={(g) => num(ledger.find((row) => row.grade === g)?.consumedCost)}
                    getRob={(g) => num(ledger.find((row) => row.grade === g)?.remainingCost)}
                    formatTip={formatMoneyTip}
                  />
                </div>
              </div>
            </div>
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
              onApply?.({ fifoTotal: total });
              onClose();
            }}
          >
            <CheckIcon />
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

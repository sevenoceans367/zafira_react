import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import { portLines } from './OpsVcGlanceUi.jsx';
import styles from './OpsVoyageStatusModal.module.css';

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2 7 4-14 2 7h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function AnchorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v13" />
      <path d="M8 10h8" />
      <path d="M5 14a7 7 0 0 0 14 0" />
    </svg>
  );
}

function PdaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
    </svg>
  );
}

function BunkerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2s6 6.9 6 11.2A6 6 0 0 1 6 13.2C6 8.9 12 2 12 2z" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h9l5 5v13H6z" />
      <path d="M15 3v5h5" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );
}

function TickDone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function TickPending() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="#3B82F6" strokeWidth="2.2" strokeDasharray="3 3.2" />
    </svg>
  );
}

function stripPortPrefix(line) {
  return String(line || '')
    .replace(/^(LP|DP|Del|Re-?Del|Load|Discharge)\s*[–—:-]\s*/i, '')
    .trim();
}

function detectKind(line, index, total) {
  const raw = String(line || '');
  if (/^LP\b/i.test(raw) || /\(LP\)/i.test(raw)) return 'LP';
  if (/^DP\b/i.test(raw) || /\(DP\)/i.test(raw)) return 'DP';
  if (/^Del\b/i.test(raw)) return 'Del';
  if (/^Re-?Del\b/i.test(raw)) return 'Re-Del';
  if (index === 0) return total > 1 ? 'LP' : 'Port';
  if (index === total - 1) return 'DP';
  return `P${index + 1}`;
}

export function buildVoyageStatusPorts(row, mode = 'vc') {
  if (mode === 'tc') {
    const ports = [];
    if (row?.delPort) ports.push({ kind: 'Del', name: String(row.delPort).trim() });
    if (row?.reDelPort) ports.push({ kind: 'Re-Del', name: String(row.reDelPort).trim() });
    if (ports.length) return ports;
  }
  const lines = portLines(row?.ports);
  if (!lines.length) return [];
  return lines.map((line, index) => ({
    kind: detectKind(line, index, lines.length),
    name: stripPortPrefix(line) || line,
  }));
}

export function VoyageStatusIcon() {
  return <PulseIcon />;
}

/**
 * Icon button next to Voy No. / TC No. Opens Voyage Status when worksheets exist.
 */
export function VoyageStatusButton({ enabled, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`${styles.trigger} ${enabled ? '' : styles.triggerDisabled} ${className}`.trim()}
      title={enabled ? 'Voyage Status' : 'No worksheet yet — Voyage Status unavailable'}
      disabled={!enabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (enabled) onClick?.();
      }}
    >
      <PulseIcon />
    </button>
  );
}

function buildLinks(row, mode, pageContext) {
  const comId = encodeURIComponent(row?.comId || '');
  const page = pageContext ?? 1;
  if (mode === 'tc') {
    const base = '/internal-user/vc/ops-tc';
    return {
      cashflow: appPath(`${base}/payment-grid?comid=${comId}&page=${page}`),
      demurrage: appPath(`${base}/payment-grid?comid=${comId}&page=${page}`),
      broker: appPath(`${base}/payment-grid?comid=${comId}&page=${page}`),
      pdaFda: appPath(`${base}/checklist?comid=${comId}&page=${page}`),
      bunker: appPath(`${base}/payment-grid?comid=${comId}&page=${page}`),
    };
  }
  const base = '/internal-user/vc/ops';
  return {
    cashflow: appPath(`${base}/soa-report?comid=${comId}&page=${page}`),
    demurrage: appPath(`${base}/soa-report?comid=${comId}&page=${page}`),
    broker: appPath(`${base}/payment-grid?comid=${comId}&page=${page}`),
    pdaFda: appPath(`${base}/pda-fda?comid=${comId}&page=${page}`),
    bunker: appPath(`${base}/bunker?comid=${comId}&page=${page}`),
  };
}

export default function OpsVoyageStatusModal({
  open,
  onClose,
  row = null,
  mode = 'vc',
  pageContext = 1,
}) {
  const ports = useMemo(() => buildVoyageStatusPorts(row, mode), [row, mode]);
  const [activePort, setActivePort] = useState(0);
  const links = useMemo(() => buildLinks(row, mode, pageContext), [row, mode, pageContext]);

  useEffect(() => {
    setActivePort(0);
  }, [row?.comId, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !row) return null;

  const voyLabel = mode === 'tc'
    ? [row.tcNo, row.message].filter(Boolean).join(' / ')
    : [row.voyageNo, row.message].filter(Boolean).join(' / ');
  const subtitle = [voyLabel, row.vesselName].filter(Boolean).join(' — ') || 'Voyage Status';
  const start = ports[0];
  const end = ports.length > 1 ? ports[ports.length - 1] : null;
  const progress = ports.length > 1 ? 55 : 0;
  const active = ports[activePort] || start;

  const checklist = [
    { key: 'freight', label: 'Freight Invoice Sent', to: links.cashflow, done: false },
    { key: 'demurrage', label: 'Demurrage Invoice Sent', to: links.demurrage, done: false },
    { key: 'broker', label: 'Broker Payment Done', to: links.broker, done: false },
  ];

  const node = (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Voyage Status" onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.titleWrap}>
            <div className={styles.titleIco}><PulseIcon /></div>
            <div>
              <div className={styles.title}>Voyage Status</div>
              <div className={styles.subtitle}>{subtitle}</div>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body}>
          <section className={`${styles.block} ${styles.accentOrange}`}>
            <div className={styles.blockHead}>
              <div className={styles.blockIco}><AnchorIcon /></div>
              <div className={styles.blockTitle}>Port Rotation</div>
            </div>
            <div className={styles.blockBody}>
              {start ? (
                <>
                  <div className={styles.route}>
                    <div className={styles.routePt}>
                      <span className={styles.dot} />
                      <span className={styles.lbl}>{start.name} ({start.kind})</span>
                    </div>
                    {end ? (
                      <>
                        <div className={styles.routeLine}>
                          <div className={styles.routeFill} style={{ width: `${progress}%` }} />
                          <div className={styles.here} style={{ left: `${progress}%` }}>
                            <span className={styles.pin} />
                            <span className={styles.tag}>You Are Here</span>
                          </div>
                        </div>
                        <div className={styles.routePt}>
                          <span className={styles.dot} />
                          <span className={styles.lbl}>{end.name} ({end.kind})</span>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className={styles.noon}>
                    Position per Noon Report — unavailable (no live AIS / noon-report feed yet)
                  </div>
                  {ports.length > 1 ? (
                    <div className={styles.portTabs}>
                      {ports.map((port, index) => (
                        <button
                          key={`${port.kind}-${port.name}`}
                          type="button"
                          className={`${styles.portTab} ${index === activePort ? styles.portTabActive : ''}`}
                          onClick={() => setActivePort(index)}
                        >
                          {port.kind}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {active ? (
                    <div className={styles.plist}>
                      <div className={styles.prow}>
                        <span className={styles.nm}>Port</span>
                        <span className={styles.dt}>{active.name}</span>
                      </div>
                      <div className={styles.prow}>
                        <span className={styles.nm}>Port Report</span>
                        <span className={styles.dt}>Not yet available</span>
                      </div>
                      <div className={styles.prow}>
                        <span className={styles.nm}>Laytime</span>
                        <span className={styles.dt}>Not yet commenced</span>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.empty}>No LP / DP ports on this voyage yet.</div>
              )}
            </div>
          </section>

          <section className={`${styles.block} ${styles.accentBlue}`}>
            <div className={styles.blockHead}>
              <div className={styles.blockIco}><PdaIcon /></div>
              <div className={styles.blockTitle}>PDA / FDA</div>
            </div>
            <div className={styles.blockBody}>
              <div className={styles.plist}>
                {(ports.length ? ports : [{ kind: 'Port', name: 'Voyage' }]).map((port) => (
                  <Link
                    key={`pda-${port.kind}-${port.name}`}
                    className={styles.prowLink}
                    to={links.pdaFda}
                    onClick={onClose}
                  >
                    <span className={styles.nm}>{port.name} ({port.kind}) — PDA/FDA</span>
                    <span className={styles.dt}>Open</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className={`${styles.block} ${styles.accentGreen}`}>
            <div className={styles.blockHead}>
              <div className={styles.blockIco}><BunkerIcon /></div>
              <div className={styles.blockTitle}>Bunkers</div>
            </div>
            <div className={styles.blockBody}>
              <div className={styles.plist}>
                <Link className={styles.prowLink} to={links.bunker} onClick={onClose}>
                  <span className={styles.nm}>Bunker Management</span>
                  <span className={styles.dt}>Open</span>
                </Link>
                <div className={styles.prow}>
                  <span className={styles.nm}>Stem status</span>
                  <span className={styles.dt}>Pending confirmation</span>
                </div>
              </div>
            </div>
          </section>

          <section className={`${styles.block} ${styles.accentPurple}`}>
            <div className={styles.blockHead}>
              <div className={styles.blockIco}><InvoiceIcon /></div>
              <div className={styles.blockTitle}>Payables / Receivables</div>
            </div>
            <div className={styles.blockBody}>
              <div className={styles.plist}>
                {checklist.map((item) => (
                  <Link
                    key={item.key}
                    className={styles.check}
                    to={item.to}
                    onClick={onClose}
                  >
                    <span className={`${styles.tick} ${item.done ? styles.tickDone : styles.tickPending}`}>
                      {item.done ? <TickDone /> : <TickPending />}
                    </span>
                    <span className={styles.checkNm}>{item.label}</span>
                    <span className={`${styles.st} ${item.done ? styles.stDone : styles.stPending}`}>
                      {item.done ? 'Done' : 'Pending'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

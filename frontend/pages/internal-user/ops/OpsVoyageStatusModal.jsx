import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchVoyageStatus } from '../../../services/opsVc.js';
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

function IdentifiersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="3.5" width="12" height="17" rx="2" />
      <path d="M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" />
      <path d="M9 12.5l2 2 4-4.5" />
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

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" />
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

function liveValue(value) {
  if (value == null) return '';
  const text = String(value).trim();
  return text === '' || text === '—' ? '' : text;
}

function displayValue(value, fallback = '—') {
  return liveValue(value) || fallback;
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
      pdaFda: appPath(`${base}/checklist?comid=${comId}&page=${page}`),
      bunker: appPath(`${base}/payment-grid?comid=${comId}&page=${page}`),
      cashflow: appPath(`${base}/payment-grid?comid=${comId}&page=${page}`),
    };
  }
  const base = '/internal-user/vc/ops';
  return {
    pdaFda: appPath(`${base}/pda-fda?comid=${comId}&page=${page}`),
    bunker: appPath(`${base}/bunker?comid=${comId}&page=${page}`),
    cashflow: appPath(`${base}/soa-report?comid=${comId}&page=${page}`),
    payment: appPath(`${base}/payment-grid?comid=${comId}&page=${page}`),
  };
}

function portTabLabel(port) {
  if (!port) return 'Port';
  if (port.kind === 'LP' || port.kind === 'DP') return `${port.kind} – ${port.name}`;
  return `${port.kind} – ${port.name}`;
}

function StatusChip({ tone = 'grey', children }) {
  return (
    <span className={`${styles.statusChip} ${styles[`chip${tone.charAt(0).toUpperCase()}${tone.slice(1)}`] || ''}`}>
      {children}
    </span>
  );
}

function DisplayField({ label, value, wide = false }) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <label>{label}</label>
      <div className={styles.disp}>{displayValue(value)}</div>
    </div>
  );
}

function ReadonlyField({ label, value, wide = false }) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <label>{label}</label>
      <input type="text" readOnly value={displayValue(value)} />
    </div>
  );
}

function CheckField({ label, checked = false }) {
  return (
    <label className={styles.chk}>
      <input type="checkbox" checked={checked} readOnly disabled />
      <span>{label}</span>
    </label>
  );
}

function StatusRow({ name, chip, chipTone = 'grey', remarks, remarksMuted = false }) {
  return (
    <div className={styles.srow}>
      <span className={styles.srowNm}>{name}</span>
      <StatusChip tone={chipTone}>{chip}</StatusChip>
      <span className={`${styles.remarks} ${remarksMuted ? styles.remarksMuted : ''}`}>{remarks}</span>
    </div>
  );
}

function PortPanel({ port }) {
  const isLoad = port?.kind === 'LP' || port?.kind === 'Del' || port?.kind === 'Load';
  return (
    <div className={styles.portPanel}>
      <div className={styles.subhead}>Port</div>
      <div className={styles.fieldgrid}>
        <ReadonlyField label="Cargo" value={port?.cargo} />
        <ReadonlyField label="Qty (MT)" value={port?.qty} />
        <ReadonlyField label="Laycan (From To)" value={port?.laycan} wide />
        <ReadonlyField label="Shipper" value={port?.shipper} />
        <ReadonlyField label="Agent" value={port?.agent} />
        <ReadonlyField label="Draft Restriction (M)" value={port?.draftRestriction} />
        <ReadonlyField label="Cargo Rate" value={port?.cargoRate} />
      </div>

      <div className={styles.subhead}>Port Activity</div>
      <div className={styles.fieldgrid}>
        <ReadonlyField label="Arr Draft" value={port?.arrDraft} />
        <ReadonlyField label="Dep Draft" value={port?.depDraft} />
        <ReadonlyField label="ETA" value={port?.eta} />
        <ReadonlyField label="ETB" value={port?.etb} />
      </div>
      <div className={`${styles.fieldgrid} ${styles.fieldgridSpaced}`}>
        <ReadonlyField label="Arrived" value={port?.arrived} />
        <ReadonlyField label="NOR" value={port?.nor} />
        <ReadonlyField label="Commenced" value={port?.commenced} />
        <ReadonlyField label="Completed" value={port?.completed} />
        <ReadonlyField label="Sailed" value={port?.sailed} />
      </div>

      <div className={styles.subhead}>{`Cargo Work – ${isLoad ? 'Loading' : 'Discharge'}`}</div>
      <div className={styles.cwRow}>
        <ReadonlyField label="Date" value={port?.cwDate} />
        <ReadonlyField label="Total Qty (MT)" value={port?.cwTotalQty} />
        <ReadonlyField label="LDD So Far (MT)" value={port?.cwLddSoFar} />
        <ReadonlyField label="Balance (MT)" value={port?.cwBalance} />
        <ReadonlyField label="ETC" value={port?.cwEtc} />
        <div className={styles.field}>
          <label>Status</label>
          <div className={styles.chipWrap}>
            <StatusChip tone={port?.cwStatusTone || 'grey'}>{port?.cwStatus || '—'}</StatusChip>
          </div>
        </div>
      </div>

      <div className={styles.subhead}>Laytime</div>
      <div className={`${styles.laytimeNote} ${port?.laytimeMuted ? styles.laytimeMuted : ''}`}>
        {port?.laytimeNote || 'Not yet commenced'}
      </div>
    </div>
  );
}

function buildPortDetails(port, row, index) {
  const isLoad = port.kind === 'LP' || port.kind === 'Del';
  return {
    ...port,
    cargo: row?.materialName || row?.cargo,
    qty: row?.cargoQty,
    shipper: row?.charterer,
    agent: row?.lastPortAgent,
    laycan: '',
    draftRestriction: '',
    cargoRate: '',
    arrDraft: '',
    depDraft: '',
    eta: '',
    etb: '',
    arrived: '',
    nor: '',
    commenced: '',
    completed: '',
    sailed: '',
    cwDate: '',
    cwTotalQty: row?.cargoQty,
    cwLddSoFar: isLoad ? '' : '0',
    cwBalance: isLoad ? '0' : row?.cargoQty,
    cwEtc: '',
    cwStatus: index === 0 ? 'Pending' : 'Pending',
    cwStatusTone: 'amber',
    laytimeNote: index === 0 ? 'Not yet commenced' : 'Not yet commenced',
    laytimeMuted: true,
    pdaStatus: 'PDA Rcvd',
    pdaRemarks: 'FDA pending',
  };
}

function buildIdentifiers(row, mode, apiIdentifiers = null) {
  const voyLabel = mode === 'tc'
    ? [row?.tcNo, row?.message].filter(Boolean).join(' / ')
    : [row?.voyageNo, row?.message].filter(Boolean).join(' / ');
  const fallback = {
    vesselName: row?.vesselName,
    voyage: voyLabel,
    cpDate: row?.cpDate,
    charterer: row?.charterer,
    owner: row?.owner || row?.ownerName,
    broker: row?.broker || row?.brokerName,
    lastPortAgent: row?.lastPortAgent || row?.portAgent,
    charterersPi: row?.charterersPi || '—',
    statutoryCerts: Boolean(row?.statutoryCerts),
    insuranceDesk: Boolean(row?.insuranceDesk),
    charterersPiIdentified: Boolean(row?.charterersPiIdentified),
    masterSignedCargo: Boolean(row?.masterSignedCargo),
  };
  if (!apiIdentifiers) return fallback;
  return {
    ...fallback,
    ...apiIdentifiers,
    statutoryCerts: Boolean(apiIdentifiers.statutoryCerts),
    insuranceDesk: Boolean(apiIdentifiers.insuranceDesk),
    charterersPiIdentified: Boolean(apiIdentifiers.charterersPiIdentified),
    masterSignedCargo: Boolean(apiIdentifiers.masterSignedCargo),
    charterersPi: apiIdentifiers.charterersPi || fallback.charterersPi,
  };
}

function mergePortDetails(basePorts, apiPorts, row) {
  return basePorts.map((port, index) => {
    const apiPort = apiPorts?.find((item) => (
      item.kind === port.kind && item.name === port.name
    )) || apiPorts?.[index];
    const merged = {
      ...buildPortDetails(port, row, index),
      ...(apiPort || {}),
    };
    return merged;
  });
}

function buildFinancialRows(links, apiFinancials) {
  const fallback = [
    { name: 'Freight Invoice', chip: 'Draft', tone: 'grey', remarks: 'Awaiting voyage completion', linkKey: 'cashflow' },
    { name: 'Demurrage Invoice', chip: 'Draft', tone: 'grey', remarks: 'Awaiting SOF from DP', linkKey: 'cashflow' },
    { divider: true },
    { name: 'Brokerage', chip: 'Draft', tone: 'grey', remarks: 'Awaiting freight settlement', linkKey: 'payment' },
    { name: 'Bunkers', chip: 'Hold', tone: 'amber', remarks: 'Invoice under review', linkKey: 'bunker' },
    { name: 'Hire', chip: 'Draft', tone: 'grey', remarks: '—', remarksMuted: true, linkKey: 'payment' },
  ];
  const rows = apiFinancials?.length ? apiFinancials : fallback;
  return rows.map((item) => (
    item.divider
      ? item
      : { ...item, link: links[item.linkKey] || links.payment }
  ));
}

export default function OpsVoyageStatusModal({
  open,
  onClose,
  row = null,
  mode = 'vc',
  pageContext = 1,
}) {
  const [voyageData, setVoyageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const ports = useMemo(() => buildVoyageStatusPorts(row, mode), [row, mode]);
  const links = useMemo(() => buildLinks(row, mode, pageContext), [row, mode, pageContext]);
  const portDetails = useMemo(
    () => mergePortDetails(ports, voyageData?.ports, row),
    [ports, voyageData?.ports, row],
  );
  const identifiers = useMemo(
    () => buildIdentifiers(row, mode, voyageData?.identifiers),
    [row, mode, voyageData?.identifiers],
  );
  const [activePort, setActivePort] = useState(0);

  useEffect(() => {
    setActivePort(0);
  }, [row?.comId, open]);

  useEffect(() => {
    if (!open || !row?.comId) {
      setVoyageData(null);
      setFetchError('');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError('');
      try {
        const data = await fetchVoyageStatus(row.comId, { mode, page: pageContext });
        if (!cancelled) setVoyageData(data);
      } catch (err) {
        if (!cancelled) {
          setVoyageData(null);
          setFetchError(err.message || 'Failed to load voyage status.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, row?.comId, mode, pageContext]);

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
  const start = portDetails[0];
  const end = portDetails.length > 1 ? portDetails[portDetails.length - 1] : null;
  const progress = voyageData?.route?.progressPercent ?? (portDetails.length > 1 ? 0 : 0);
  const active = portDetails[activePort] || start;
  const noonText = voyageData?.route?.noonReport
    || row?.noonReport
    || 'Position per Noon Report — unavailable (no live AIS / noon-report feed yet)';

  const bunkerRows = voyageData?.bunkers?.bunkerGrades?.length
    ? voyageData.bunkers.bunkerGrades
    : row?.bunkerGrades?.length
      ? row.bunkerGrades
      : [
        {
          grade: 'VLSFO',
          date: '—',
          shipFig: '—',
          rcptFig: '—',
          supplier: '—',
          barge: '—',
          price: '—',
          remarks: 'Pending confirmation',
          muted: true,
        },
      ];

  const bunkersStemmed = voyageData?.bunkers?.bunkersStemmed ?? Boolean(row?.bunkersStemmed);
  const financialRows = buildFinancialRows(links, voyageData?.financials);
  const pdaLinkBase = links.pdaFda;

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
          {loading ? <LoadingOverlay show={loading} fullScreen={false} /> : null}
          {fetchError ? <div className={styles.fetchError}>{fetchError}</div> : null}
          <section className={`${styles.block} ${styles.accentNavy}`}>
            <div className={styles.blockHead}>
              <div className={styles.blockIco}><IdentifiersIcon /></div>
              <div className={styles.blockTitle}>Voyage Identifiers &amp; Checks</div>
            </div>
            <div className={styles.blockBody}>
              <div className={styles.fieldgrid}>
                <DisplayField label="Vessel Name" value={identifiers.vesselName} />
                <DisplayField label="Voyage" value={identifiers.voyage} />
                <DisplayField label="CP Date" value={identifiers.cpDate} />
                <DisplayField label="Charterer" value={identifiers.charterer} />
                <DisplayField label="Owner" value={identifiers.owner} />
                <DisplayField label="Broker" value={identifiers.broker} />
              </div>
              <div className={`${styles.fieldgrid} ${styles.fieldgridAgent}`}>
                <DisplayField label="Last Port Agent" value={identifiers.lastPortAgent} />
              </div>
              <div className={styles.checks}>
                <CheckField label="Statutory Certs in Place" checked={identifiers.statutoryCerts} />
                <CheckField label="Insurance Desk Informed" checked={identifiers.insuranceDesk} />
                <CheckField label="Charterers P&I Identified" checked={identifiers.charterersPiIdentified} />
                <div className={styles.chkSelect}>
                  <span>Charterers&apos; P&amp;I</span>
                  <select disabled value={identifiers.charterersPi}>
                    <option>{identifiers.charterersPi}</option>
                  </select>
                </div>
              </div>
              <div className={`${styles.checks} ${styles.checksSecondary}`}>
                <CheckField label="Master Signed Cargo Declaration" checked={identifiers.masterSignedCargo} />
              </div>
            </div>
          </section>

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
                  <div className={styles.noon}>{noonText}</div>
                  {portDetails.length > 0 ? (
                    <>
                      <div className={styles.portTabs}>
                        {portDetails.map((port, index) => (
                          <button
                            key={`${port.kind}-${port.name}`}
                            type="button"
                            className={`${styles.portTab} ${index === activePort ? styles.portTabActive : ''}`}
                            onClick={() => setActivePort(index)}
                          >
                            {portTabLabel(port)}
                          </button>
                        ))}
                      </div>
                      {active ? <PortPanel port={active} /> : null}
                    </>
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
                {(portDetails.length ? portDetails : [{ kind: 'Port', name: 'Voyage' }]).map((port, index) => (
                  <Link
                    key={`pda-${port.kind}-${port.name}`}
                    className={styles.srowLink}
                    to={`${pdaLinkBase}${pdaLinkBase.includes('?') ? '&' : '?'}tab=${index}`}
                    onClick={onClose}
                  >
                    <StatusRow
                      name={portTabLabel(port)}
                      chip={port.pdaStatus || 'Pending'}
                      chipTone={port.pdaTone || 'amber'}
                      remarks={port.pdaRemarks || '—'}
                    />
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
              <div className={`${styles.checks} ${styles.checksFlush}`}>
                <CheckField label="Voy Bunkers Stemmed" checked={bunkersStemmed} />
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Grade</th>
                      <th>Date</th>
                      <th>Ship Fig (MT)</th>
                      <th>Rcpt Fig (MT)</th>
                      <th>Supplier</th>
                      <th>Barge Name</th>
                      <th>Price</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bunkerRows.map((item, index) => (
                      <tr key={`${item.grade}-${index}`}>
                        <td className={item.muted ? styles.muted : undefined}>{item.grade}</td>
                        <td className={item.muted ? styles.muted : undefined}>{item.date}</td>
                        <td className={item.muted ? styles.muted : undefined}>{item.shipFig}</td>
                        <td className={item.muted ? styles.muted : undefined}>{item.rcptFig}</td>
                        <td className={item.muted ? styles.muted : undefined}>{item.supplier}</td>
                        <td className={item.muted ? styles.muted : undefined}>{item.barge}</td>
                        <td className={item.muted ? styles.muted : undefined}>{item.price}</td>
                        <td className={item.muted ? styles.muted : undefined}>{item.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.tableNote}>
                <InfoIcon />
                Figures are populated automatically from the vessel&apos;s Port Message and are read-only here.
              </div>
            </div>
          </section>

          <section className={`${styles.block} ${styles.accentPurple}`}>
            <div className={styles.blockHead}>
              <div className={styles.blockIco}><InvoiceIcon /></div>
              <div className={styles.blockTitle}>Financials</div>
            </div>
            <div className={styles.blockBody}>
              <div className={styles.plist}>
                {financialRows.map((item, index) => (
                  item.divider ? (
                    <div key={`div-${index}`} className={styles.divider} />
                  ) : (
                    <Link
                      key={item.name}
                      className={styles.srowLink}
                      to={item.link}
                      onClick={onClose}
                    >
                      <StatusRow
                        name={item.name}
                        chip={item.chip}
                        chipTone={item.tone}
                        remarks={item.remarks}
                        remarksMuted={item.remarksMuted}
                      />
                    </Link>
                  )
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

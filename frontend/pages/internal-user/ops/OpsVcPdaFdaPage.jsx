import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchOpsPdaFda, reviewOpsPdaFda } from '../../../services/opsVc.js';
import OpsVcBackHeaderActions from './OpsVcBackHeaderActions.jsx';
import { PortTabLabel } from './portTabLabel.jsx';
import { COST_CATEGORIES, groupLinesByCategory } from '../../agent/agentCostCategories.js';
import styles from './OpsVcPdaFdaPage.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

const CAT_DOT = {
  navy: styles.dotNavy,
  orange: styles.dotOrange,
  teal: styles.dotTeal,
  blue: styles.dotBlue,
  amber: styles.dotAmber,
  grey: styles.dotGrey,
};

function PortTypeIcon({ portType }) {
  if (String(portType || '').startsWith('DP')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22V9" />
        <path d="M18 15l-6-6-6 6" />
        <path d="M4 4h16" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v13" />
      <path d="M6 9l6 6 6-6" />
      <path d="M4 20h16" />
    </svg>
  );
}

function fmtMoney(n) {
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtUsd(n) {
  return `USD ${fmtMoney(n)}`;
}

function signedUsd(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}USD ${fmtMoney(Math.abs(v))}`;
}

function signedNum(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${fmtMoney(Math.abs(v))}`;
}

function StatusChip({ status }) {
  const label = {
    notstarted: 'Not Started',
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
  }[status] || status;

  const className = {
    notstarted: styles.chipNotstarted,
    draft: styles.chipDraft,
    submitted: styles.chipSubmitted,
    approved: styles.chipApproved,
  }[status] || styles.chipNotstarted;

  return (
    <span className={`${styles.chip} ${className}`}>
      {status === 'approved' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" />
        </svg>
      ) : status === 'submitted' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
      {label}
    </span>
  );
}

function KindIcon({ kind }) {
  return (
    <span className={styles.kindIco} aria-hidden>
      {kind === 'fda' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
          <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
          <path d="M8.5 13.5l2 2 4-4.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2.5h8l5 5v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15.5a2 2 0 0 1 2-2z" />
          <path d="M14 2.5v4a1 1 0 0 0 1 1h4" />
          <path d="M8 13h5" />
          <path d="M8 16.5h8" />
        </svg>
      )}
    </span>
  );
}

function categoryTotals(lines, field) {
  const grouped = groupLinesByCategory(lines);
  const byKey = Object.fromEntries(
    COST_CATEGORIES.map((cat) => {
      const bucket = grouped.find((g) => g.key === cat.key);
      const total = (bucket?.lines || []).reduce((sum, line) => sum + (Number(line[field]) || 0), 0);
      return [cat.key, total];
    }),
  );
  return COST_CATEGORIES.map((cat) => ({
    ...cat,
    value: byKey[cat.key] || 0,
  }));
}

export default function OpsVcPdaFdaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';
  const tabParam = Number(searchParams.get('tab') || searchParams.get('tabs') || 0);

  const [form, setForm] = useState(null);
  const [activeKey, setActiveKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [breakdown, setBreakdown] = useState(null);
  const [ccyMode, setCcyMode] = useState('usd');
  const [officeRemarks, setOfficeRemarks] = useState('');

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  const agencyLetterHref = useMemo(
    () => appPath(`/internal-user/vc/ops/agency-letter?comid=${encodeURIComponent(comId)}&page=${page}`),
    [comId, page],
  );

  const worksheetHref = useMemo(() => {
    if (!comId) return backHref;
    const sheet = form?.costSheetId;
    if (sheet) {
      return appPath(`/internal-user/vc/ops/cost-sheet?comid=${encodeURIComponent(comId)}&cost_sheet_id=${encodeURIComponent(sheet)}&page=${page}`);
    }
    return backHref;
  }, [backHref, comId, form?.costSheetId, page]);

  useEffect(() => {
    if (!comId) {
      setError('COMID is required.');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchOpsPdaFda(comId);
        if (cancelled) return;
        setForm(data);
        const preferred = data.ports?.[Math.max(0, tabParam)]?.key
          || data.ports?.[0]?.key
          || '';
        setActiveKey(preferred);
      } catch (err) {
        if (!cancelled) {
          setForm(null);
          setError(err.message || 'Failed to load PDA/FDA.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [comId, tabParam]);

  const activePort = form?.ports?.find((port) => port.key === activeKey) || null;

  useEffect(() => {
    setOfficeRemarks(activePort?.header?.operatorRemarks || '');
  }, [activePort?.key, activePort?.header?.operatorRemarks]);

  const selectTab = (port, index) => {
    setActiveKey(port.key);
    setBreakdown(null);
    const next = new URLSearchParams(searchParams);
    next.set('tab', String(index));
    setSearchParams(next, { replace: true });
  };

  const openBreakdown = (kind) => {
    setCcyMode('usd');
    setOfficeRemarks(activePort?.header?.operatorRemarks || '');
    setBreakdown({ kind, portKey: activePort?.key });
  };

  const closeBreakdown = () => setBreakdown(null);

  const runReview = async (action, mode) => {
    if (!activePort?.genAgencyId) return;
    let remarks = officeRemarks;
    if (action === 'query') {
      const note = window.prompt('Query note for the agent:', remarks || '');
      if (note == null) return;
      remarks = note.trim();
      if (!remarks) {
        setError('Please enter a query note for the agent.');
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const data = await reviewOpsPdaFda({
        comId,
        genAgencyId: activePort.genAgencyId,
        action,
        mode,
        operatorRemarks: remarks,
      });
      setForm(data);
      const refreshed = data.ports?.find((p) => p.key === activePort.key);
      if (refreshed) setOfficeRemarks(refreshed.header?.operatorRemarks || '');
      if (action === 'approve') closeBreakdown();
    } catch (err) {
      setError(err.message || 'Failed to update review.');
    } finally {
      setBusy(false);
    }
  };

  const saveRemarks = async () => {
    if (!activePort?.genAgencyId) return;
    setBusy(true);
    setError('');
    try {
      const data = await reviewOpsPdaFda({
        comId,
        genAgencyId: activePort.genAgencyId,
        action: 'remarks',
        mode: breakdown?.kind || 'pda',
        operatorRemarks: officeRemarks,
      });
      setForm(data);
    } catch (err) {
      setError(err.message || 'Failed to save office remarks.');
    } finally {
      setBusy(false);
    }
  };

  const localCcy = (activePort?.localCurrency || 'USD').toUpperCase();
  const hasLocalCcy = localCcy && localCcy !== 'USD';
  const showUsd = ccyMode === 'usd' || !hasLocalCcy;

  const pdaCats = useMemo(
    () => categoryTotals(activePort?.lines || [], showUsd ? 'estimatedUsd' : 'estimatedLc'),
    [activePort?.lines, showUsd],
  );
  const fdaEstCats = useMemo(
    () => categoryTotals(activePort?.lines || [], showUsd ? 'estimatedUsd' : 'estimatedLc'),
    [activePort?.lines, showUsd],
  );
  const fdaActCats = useMemo(
    () => categoryTotals(activePort?.lines || [], showUsd ? 'actualUsd' : 'actualLc'),
    [activePort?.lines, showUsd],
  );

  const portLabel = (port) => {
    const name = String(port.portName || port.portId || '—').trim();
    const short = name.includes('/') ? name.split('/')[0].trim() || name : name;
    const type = port.portType || '';
    return type ? `${type} – ${short}` : short;
  };

  return (
    <>
      <OpsVcBackHeaderActions backHref={backHref} disabled={loading || busy} />

      <div className={`zafira-page ${styles.page}`}>
        {loading ? <LoadingOverlay show={loading} fullScreen={false} /> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        <p className={styles.subtitle}>
          Port disbursement accounts submitted by each port&apos;s nominated agent through the Agent Portal.
        </p>

        {!loading && form ? (
          <div className={styles.vstrip}>
            <div className={styles.vsRow}>
              <div className={styles.vsItem}>
                <label>Vessel</label>
                <div className={styles.idValue}>{form.vesselName || '—'}</div>
              </div>
              <div className={styles.vsItem}>
                <label>Voy No.</label>
                <div className={styles.idValue}>{form.voyageNo || form.nomId || '—'}</div>
              </div>
              <div className={styles.vsItem}>
                <label>Worksheet No.</label>
                {form.costSheetId ? (
                  <Link className={`${styles.idValue} ${styles.idLink}`} to={worksheetHref} title="Open voyage worksheet">
                    {form.worksheetName || `Sheet ${form.costSheetId}`}
                  </Link>
                ) : (
                  <div className={styles.idValue}>{form.worksheetName || '—'}</div>
                )}
              </div>
              <div className={styles.vsItem}>
                <label>Port Rotation</label>
                <div className={`${styles.idValue} ${styles.portsRow}`}>
                  {(form.ports || []).length ? (
                    form.ports.map((port, index) => (
                      <React.Fragment key={port.key}>
                        {index > 0 ? <span className={styles.locArrow}>&rarr;</span> : null}
                        <span className={styles.locChip}>{portLabel(port)}</span>
                      </React.Fragment>
                    ))
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && form && !form.ports?.length ? (
          <div className={styles.empty}>
            No load/discharge ports found on the cost sheet
            {form.costSheetId ? ` (sheet ${form.costSheetId}` : ''}
            {form.legsCount != null ? `, ${form.legsCount} leg(s)` : ''}
            {form.costSheetId ? ')' : ''}.
            {' '}
            Confirm the port rotation, then
            {' '}
            <Link to={agencyLetterHref}>Generate Voyage Letters</Link>
            {' '}
            to nominate agents.
          </div>
        ) : null}

        {form?.ports?.length ? (
          <>
            <div className={styles.portTabs}>
              {form.ports.map((port, index) => (
                <button
                  key={port.key}
                  type="button"
                  className={port.key === activeKey ? `${styles.portTab} ${styles.portTabActive}` : styles.portTab}
                  onClick={() => selectTab(port, index)}
                >
                  <span className={styles.ptIco}>
                    <PortTypeIcon portType={port.portType} />
                  </span>
                  <PortTabLabel label={port.tabLabel || portLabel(port)} />
                </button>
              ))}
            </div>

            {activePort ? (
              !activePort.nominated ? (
                <div className={styles.empty}>
                  No nominated agent for this port.
                  {' '}
                  Nominate via
                  {' '}
                  <Link to={agencyLetterHref}>Generate Voyage Letters</Link>
                  .
                </div>
              ) : (
                <>
                  <div className={styles.vstrip}>
                    <div className={styles.vsRowPort}>
                      <div className={styles.vsItem}>
                        <label>Voyage No.</label>
                        <div className={styles.val}>{activePort.voyageNo || form.voyageNo || '—'}</div>
                      </div>
                      <div className={styles.vsItem}>
                        <label>Vessel</label>
                        <div className={styles.val}>{activePort.vesselName || form.vesselName || '—'}</div>
                      </div>
                      <div className={styles.vsItem}>
                        <label>Port</label>
                        <div className={styles.val}>{activePort.portName || '—'}</div>
                      </div>
                      <div className={styles.vsItem}>
                        <label>Agent</label>
                        <div className={styles.val}>{activePort.agentName || '—'}</div>
                      </div>
                      <div className={styles.vsItem}>
                        <label>Date</label>
                        <div className={styles.val}>{activePort.date || '—'}</div>
                      </div>
                    </div>
                    <div className={styles.vsRow2}>
                      <div className={styles.vsItem}>
                        <label>Country</label>
                        <div className={styles.val}>{activePort.country || '—'}</div>
                      </div>
                      <div className={styles.vsItem}>
                        <label>Currency</label>
                        <div className={styles.val}>{activePort.localCurrency || 'USD'}</div>
                      </div>
                      <div className={styles.vsItem}>
                        <label>X-Rate to USD</label>
                        <div className={styles.val}>
                          {Number(activePort.exchangeRate || 1).toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryTop}>
                      <div className={styles.summaryLeft}>
                        <KindIcon kind="pda" />
                        <span className={styles.summaryKind}>PDA</span>
                        <StatusChip status={activePort.pda?.status} />
                        <span className={styles.summaryMeta}>{activePort.pda?.meta}</span>
                      </div>
                      <div className={styles.summaryActions}>
                        {activePort.pda?.canViewBreakdown ? (
                          <button type="button" className={styles.btnOutline} onClick={() => openBreakdown('pda')}>
                            View Breakdown
                          </button>
                        ) : null}
                        {activePort.pda?.canReview ? (
                          <>
                            <button
                              type="button"
                              className={styles.btnOutline}
                              disabled={busy}
                              title="Send back to the agent with a question"
                              onClick={() => runReview('query', 'pda')}
                            >
                              Query
                            </button>
                            <button
                              type="button"
                              className={styles.btnApprove}
                              disabled={busy}
                              title="Approve this PDA"
                              onClick={() => runReview('approve', 'pda')}
                            >
                              Approve
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {activePort.pda?.status !== 'notstarted' ? (
                      <div className={styles.figRow}>
                        <div>
                          <div className={styles.figLabel}>Estimated (Proforma)</div>
                          <div className={styles.figValue}>{fmtUsd(activePort.pda?.estimatedUsd)}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryTop}>
                      <div className={styles.summaryLeft}>
                        <KindIcon kind="fda" />
                        <span className={styles.summaryKind}>FDA</span>
                        <StatusChip status={activePort.fda?.status} />
                        <span className={styles.summaryMeta}>{activePort.fda?.meta}</span>
                      </div>
                      <div className={styles.summaryActions}>
                        {activePort.fda?.canViewBreakdown ? (
                          <button type="button" className={styles.btnOutline} onClick={() => openBreakdown('fda')}>
                            View Breakdown
                          </button>
                        ) : null}
                        {activePort.fda?.canReview ? (
                          <>
                            <button
                              type="button"
                              className={styles.btnOutline}
                              disabled={busy}
                              onClick={() => runReview('query', 'fda')}
                            >
                              Query
                            </button>
                            <button
                              type="button"
                              className={styles.btnApprove}
                              disabled={busy}
                              onClick={() => runReview('approve', 'fda')}
                            >
                              Approve
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {activePort.fda?.status !== 'notstarted' ? (
                      <div className={styles.figRow}>
                        <div>
                          <div className={styles.figLabel}>Estimated</div>
                          <div className={styles.figValue}>{fmtUsd(activePort.fda?.estimatedUsd)}</div>
                        </div>
                        <div>
                          <div className={styles.figLabel}>Actual</div>
                          <div className={styles.figValue}>{fmtUsd(activePort.fda?.actualUsd)}</div>
                        </div>
                        <div>
                          <div className={styles.figLabel}>Variance</div>
                          <div className={`${styles.figValue} ${Number(activePort.fda?.varianceUsd) > 0 ? styles.figNeg : Number(activePort.fda?.varianceUsd) < 0 ? styles.figPos : ''}`}>
                            {signedUsd(activePort.fda?.varianceUsd)}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              )
            ) : null}
          </>
        ) : null}

        {breakdown && activePort ? (
          <div className={styles.overlay} role="dialog" aria-modal="true" onClick={closeBreakdown}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHead}>
                <div className={styles.modalTitleWrap}>
                  <div className={styles.modalTitleIco}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v18" />
                      <path d="M16.5 7.5c0-2-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.3 9 2 9 6.3 0 2-2 3.2-4.5 3.2s-4.5-1-4.5-3" />
                    </svg>
                  </div>
                  <div>
                    <div className={styles.modalTitle}>
                      {breakdown.kind === 'fda' ? 'FDA' : 'PDA'}
                      {' '}
                      — Breakdown
                    </div>
                    <div className={styles.modalSubtitle}>
                      {form.voyageNo || form.nomId}
                      {' / '}
                      {form.vesselName}
                      {' — '}
                      {activePort.portType}
                      {' · '}
                      {activePort.portName}
                      {' — '}
                      {activePort.agentName}
                    </div>
                  </div>
                </div>
                <button type="button" className={styles.closeX} onClick={closeBreakdown} aria-label="Close">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className={styles.modalBody}>
                {hasLocalCcy ? (
                  <div className={styles.ccyToggleWrap}>
                    <span className={styles.ccyLabel}>Show In</span>
                    <div className={styles.segToggle}>
                      <button
                        type="button"
                        className={ccyMode === 'usd' ? styles.segBtnActive : styles.segBtn}
                        onClick={() => setCcyMode('usd')}
                      >
                        USD
                      </button>
                      <button
                        type="button"
                        className={ccyMode === 'local' ? styles.segBtnActive : styles.segBtn}
                        onClick={() => setCcyMode('local')}
                      >
                        {localCcy}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.usdOnlyNote}>
                    No local currency registered for this port — figures are USD only.
                  </div>
                )}

                {breakdown.kind === 'pda' ? (
                  <table className={styles.catTable}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th className={styles.num}>
                          Estimated (
                          {showUsd ? 'USD' : localCcy}
                          )
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdaCats.map((cat) => (
                        <tr key={cat.key}>
                          <td>
                            <span className={styles.catName}>
                              <span className={`${styles.catDot} ${CAT_DOT[cat.color] || CAT_DOT.grey}`} />
                              {cat.title}
                            </span>
                          </td>
                          <td className={styles.num}>{fmtMoney(cat.value)}</td>
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td>
                          Total Estimated (
                          {showUsd ? 'USD' : localCcy}
                          )
                        </td>
                        <td className={styles.num}>
                          {fmtMoney(showUsd ? activePort.pda?.estimatedUsd : activePort.pda?.estimatedLc)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <table className={styles.catTable}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th className={styles.num}>Estimated</th>
                        <th className={styles.num}>Actual</th>
                        <th className={styles.num}>Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fdaEstCats.map((cat, index) => {
                        const act = fdaActCats[index]?.value || 0;
                        const variance = act - cat.value;
                        return (
                          <tr key={cat.key}>
                            <td>
                              <span className={styles.catName}>
                                <span className={`${styles.catDot} ${CAT_DOT[cat.color] || CAT_DOT.grey}`} />
                                {cat.title}
                              </span>
                            </td>
                            <td className={styles.num}>{fmtMoney(cat.value)}</td>
                            <td className={styles.num}>{fmtMoney(act)}</td>
                            <td className={`${styles.num} ${variance > 0 ? styles.varNeg : ''}`}>
                              {signedNum(variance)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className={styles.totalRow}>
                        <td>
                          Total (
                          {showUsd ? 'USD' : localCcy}
                          )
                        </td>
                        <td className={styles.num}>
                          {fmtMoney(showUsd ? activePort.fda?.estimatedUsd : activePort.fda?.estimatedLc)}
                        </td>
                        <td className={styles.num}>
                          {fmtMoney(showUsd ? activePort.fda?.actualUsd : activePort.fda?.actualLc)}
                        </td>
                        <td className={`${styles.num} ${(showUsd ? activePort.fda?.varianceUsd : activePort.fda?.varianceLc) > 0 ? styles.varNeg : ''}`}>
                          {signedNum(showUsd ? activePort.fda?.varianceUsd : activePort.fda?.varianceLc)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}

                <div className={styles.remarksGrid}>
                  <div className={styles.remarksBox}>
                    <div className={styles.remarksLabel}>Agent Remarks</div>
                    <div className={styles.remarksText}>
                      {activePort.header?.agentRemarks || '—'}
                    </div>
                  </div>
                  <div className={styles.remarksEditable}>
                    <div className={styles.remarksLabel}>Office Remarks</div>
                    <textarea
                      value={officeRemarks}
                      onChange={(e) => setOfficeRemarks(e.target.value)}
                      placeholder="Add a note for the agent or finance team..."
                    />
                  </div>
                </div>

                <div className={styles.metaGrid}>
                  <div>
                    <div className={styles.metaLabel}>Bank Details</div>
                    <div className={styles.metaValue}>{activePort.header?.bankDetails || '—'}</div>
                  </div>
                  <div>
                    <div className={styles.metaLabel}>Prepared By (Agent)</div>
                    <div className={styles.metaValue}>{activePort.header?.preparedBy || '—'}</div>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.btnOutline} disabled={busy} onClick={saveRemarks}>
                    Save Remarks
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

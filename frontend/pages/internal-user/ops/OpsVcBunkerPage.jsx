import React, { useEffect, useMemo, useState } from 'react';
import useTimedFlash from '../../../hooks/useTimedFlash.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CardSelect,
  DmyDateInput,
  Field,
  LoadingOverlay,
  TextInput,
  useAlert,
  useConfirm,
} from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { fetchBunkerForm, saveBunker } from '../../../services/opsVc.js';
import OpsVcBunkerHeaderActions from './OpsVcBunkerHeaderActions.jsx';
import { recomputeBunkerForm } from './bunkerCalculations.js';
import styles from './OpsVcBunkerPage.module.css';

const BACK_PATHS = {
  1: '/internal-user/vc/ops/in-ops-glance',
  2: '/internal-user/vc/ops/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops/in-ops-glance?tab=history',
};

const FLASH = {
  0: { type: 'success', text: 'Bunker added/updated successfully.' },
};

function emptyBunkerRow() {
  return {
    bunkerId: '',
    robSosp: '',
    qtyStemmed: '',
    supplyPrice: '',
    addCost: '',
    effectivePrice: '',
    stemmedValue: '',
    remarks: '',
    accountOf: '',
  };
}

function mapBunkerRow(row = {}) {
  return {
    bunkerId: row.bunkerId != null ? String(row.bunkerId) : '',
    robSosp: row.robSosp ?? '',
    qtyStemmed: row.qtyStemmed ?? '',
    supplyPrice: row.supplyPrice ?? '',
    addCost: row.addCost ?? '',
    effectivePrice: row.effectivePrice ?? '',
    stemmedValue: row.stemmedValue ?? '',
    remarks: row.remarks || '',
    accountOf: row.accountOf || '',
  };
}

function mapPrevRow(row = {}) {
  return {
    bunkerId: row.bunkerId != null ? String(row.bunkerId) : '',
    name: row.name || '',
    qty: row.qty ?? '',
    value: row.value ?? '',
    calDesc: row.calDesc || '',
  };
}

function draftFromForm(data) {
  const foGrades = data.lookups?.foGrades || [];
  const doGrades = data.lookups?.doGrades || [];
  const previousFo = (data.previousFo || []).length
    ? data.previousFo.map(mapPrevRow)
    : foGrades.map((g) => mapPrevRow({ bunkerId: g.id, name: g.name }));
  const previousDo = (data.previousDo || []).length
    ? data.previousDo.map(mapPrevRow)
    : doGrades.map((g) => mapPrevRow({ bunkerId: g.id, name: g.name }));

  return recomputeBunkerForm({
    previousFo: previousFo.length ? previousFo : [mapPrevRow()],
    previousDo: previousDo.length ? previousDo : [mapPrevRow()],
    ports: (data.ports || []).map((port) => ({
      key: port.key,
      portId: port.portId,
      randomId: port.randomId,
      portName: port.portName || '',
      comSlaveId: port.comSlaveId || '',
      sospDate: port.sospDate || '',
      foRows: (port.foRows?.length ? port.foRows : [emptyBunkerRow()]).map(mapBunkerRow),
      doRows: (port.doRows?.length ? port.doRows : [emptyBunkerRow()]).map(mapBunkerRow),
    })),
    sospResults: data.sospResults || { fo: [], do: [] },
    consumedCharterer: data.consumedCharterer || { fo: [], do: [] },
    consumedOwner: data.consumedOwner || { fo: [], do: [] },
    lookups: data.lookups || { foGrades: [], doGrades: [], accountOfOptions: [] },
  });
}

function rowFilled(row) {
  return Boolean(
    String(row.bunkerId || '').trim()
    && String(row.robSosp || '').trim()
    && String(row.qtyStemmed || '').trim()
    && String(row.supplyPrice || '').trim()
    && String(row.effectivePrice || '').trim()
    && String(row.accountOf || '').trim(),
  );
}

function aggregateConsumed(rows) {
  let qty = 0;
  let value = 0;
  let hasQty = false;
  let hasValue = false;
  for (const row of rows || []) {
    const q = Number(String(row.qty ?? '').replace(/,/g, ''));
    const v = Number(String(row.value ?? '').replace(/,/g, ''));
    if (Number.isFinite(q)) {
      qty += q;
      hasQty = true;
    }
    if (Number.isFinite(v)) {
      value += v;
      hasValue = true;
    }
  }
  return {
    qty: hasQty ? `${qty.toFixed(2)} MT` : '— MT',
    usd: hasValue ? `${value.toFixed(2)} USD` : '— USD',
  };
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SectionInfoBar({ children }) {
  return (
    <div className={styles.sectionInfoBar}>
      <InfoIcon />
      <span>{children}</span>
    </div>
  );
}

function ConsumedWidget({ variant, title, subtitle, foRows, doRows }) {
  const fo = aggregateConsumed(foRows);
  const doAgg = aggregateConsumed(doRows);
  const widgetClass = variant === 'owner' ? styles.bunkWidgetOwner : styles.bunkWidgetCharterer;

  return (
    <div className={`${styles.bunkWidget} ${widgetClass}`}>
      <div className={styles.bunkWidgetHead}>
        <div className={styles.bunkWidgetIco}>
          {variant === 'owner' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v4" />
              <path d="M8 5l2 2" />
              <path d="M16 5l-2 2" />
              <path d="M3.5 10 12 13.5 20.5 10" />
              <path d="M3.5 10v6.2a2 2 0 0 0 1.2 1.8L11 20.5v-7" />
              <path d="M20.5 10v6.2a2 2 0 0 1-1.2 1.8L13 20.5v-7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 21c1.6 1.2 3.4 1.2 5 0 1.6 1.2 3.4 1.2 5 0 1.6 1.2 3.4 1.2 5 0 1.6 1.2 3.4 1.2 5 0" />
              <path d="M4 18l1-8h14l1 8" />
              <path d="M12 10V4h4l2 4" />
              <path d="M9 4h3" />
            </svg>
          )}
        </div>
        <div>
          <div className={styles.bunkWidgetTitle}>{title}</div>
          <div className={styles.bunkWidgetSub}>{subtitle}</div>
        </div>
      </div>
      <div className={styles.bunkWidgetBody}>
        <div className={styles.bunkWidgetRow}>
          <span className={styles.bunkWidgetGrade}>Fuel Oil</span>
          <span className={styles.bunkWidgetVals}>
            <div className={styles.bunkWidgetQty}>{fo.qty}</div>
            <div className={styles.bunkWidgetUsd}>{fo.usd}</div>
          </span>
        </div>
        <div className={styles.bunkWidgetRow}>
          <span className={styles.bunkWidgetGrade}>DO/MGO</span>
          <span className={styles.bunkWidgetVals}>
            <div className={styles.bunkWidgetQty}>{doAgg.qty}</div>
            <div className={styles.bunkWidgetUsd}>{doAgg.usd}</div>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * PHP bunker_calculation.php — Ops VC Bunker Calculations (voyage-level, not port tabs).
 */
export default function OpsVcBunkerPage() {
  const confirm = useConfirm();
  const alert = useAlert();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';
  const prevComIdParam = searchParams.get('prevComId') || searchParams.get('prevcomid') || '';
  const flashMsg = searchParams.get('msg');
  const flash = useTimedFlash(flashMsg != null && flashMsg !== '' ? FLASH[Number(flashMsg)] : null);
  const [form, setForm] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openPorts, setOpenPorts] = useState(() => new Set());

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  const workingSheetId = form?.costSheetId || '';
  const worksheetHref = workingSheetId
    ? appPath(`/internal-user/vc/ops/cost-sheet?comid=${encodeURIComponent(comId)}&cost_sheet_id=${encodeURIComponent(workingSheetId)}&page=${encodeURIComponent(page)}`)
    : null;

  const lookups = draft?.lookups || form?.lookups || {
    foGrades: [],
    doGrades: [],
    accountOfOptions: [],
  };
  const accountOptions = (lookups.accountOfOptions?.length
    ? lookups.accountOfOptions
    : [
      { id: 'Owner', name: 'Owner' },
      { id: 'Charterer', name: 'Charterer' },
    ]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBunkerForm(comId, prevComIdParam || undefined);
      setForm(data);
      setDraft(draftFromForm(data));
      setOpenPorts(new Set());
    } catch (err) {
      setForm(null);
      setDraft(null);
      setError(err.message || 'Failed to load Bunker Calculations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!comId) {
      setError('COMID is required.');
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comId, prevComIdParam]);

  const patchDraft = (patch) => {
    setDraft((current) => recomputeBunkerForm({ ...current, ...patch }));
  };

  const patchPrevious = (side, index, patch) => {
    const key = side === 'fo' ? 'previousFo' : 'previousDo';
    const rows = [...(draft[key] || [])];
    rows[index] = { ...rows[index], ...patch };
    patchDraft({ [key]: rows });
  };

  const patchPort = (portIndex, patch) => {
    const ports = [...(draft.ports || [])];
    ports[portIndex] = { ...ports[portIndex], ...patch };
    patchDraft({ ports });
  };

  const patchPortRow = (portIndex, side, rowIndex, patch) => {
    const field = side === 'fo' ? 'foRows' : 'doRows';
    const ports = [...(draft.ports || [])];
    const rows = [...(ports[portIndex][field] || [])];
    rows[rowIndex] = { ...rows[rowIndex], ...patch };
    ports[portIndex] = { ...ports[portIndex], [field]: rows };
    patchDraft({ ports });
  };

  const addPortRow = async (portIndex, side) => {
    const field = side === 'fo' ? 'foRows' : 'doRows';
    const rows = draft.ports[portIndex][field] || [];
    const last = rows[rows.length - 1];
    if (last && !rowFilled(last)) {
      await alert({
        title: 'Missing Information',
        message: 'Please fill in missing data from previous sections for results.',
      });
      return;
    }
    const ports = [...draft.ports];
    ports[portIndex] = {
      ...ports[portIndex],
      [field]: [...rows, emptyBunkerRow()],
    };
    patchDraft({ ports });
  };

  const removePortRow = (portIndex, side, rowIndex) => {
    const field = side === 'fo' ? 'foRows' : 'doRows';
    const ports = [...(draft.ports || [])];
    const rows = [...(ports[portIndex][field] || [])];
    if (rows.length <= 1) return;
    rows.splice(rowIndex, 1);
    ports[portIndex] = { ...ports[portIndex], [field]: rows };
    patchDraft({ ports });
  };

  const togglePort = (key) => {
    setOpenPorts((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handlePrevVoyageChange = (value) => {
    const next = {
      comid: comId,
      page,
    };
    if (value) next.prevComId = String(value);
    setSearchParams(next);
  };

  const handleSubmit = async (status) => {
    if (!draft) return;

    for (const port of draft.ports || []) {
      if (!String(port.sospDate || '').trim()) {
        await alert({
          title: 'Alert',
          message: `Please enter SOSP Date/Time for port ${port.portName || ''}.`,
        });
        return;
      }
    }

    const ok = await confirm({
      title: 'Confirmation',
      message: 'Are you sure you have checked each entry ?',
      confirmLabel: status === 1 ? 'Submit' : 'Save',
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const result = await saveBunker({
        comId,
        page,
        status,
        prevComId: prevComIdParam || form?.prevComId || '',
        previousFo: draft.previousFo,
        previousDo: draft.previousDo,
        ports: draft.ports,
        sospResults: draft.sospResults,
        consumedCharterer: draft.consumedCharterer,
        consumedOwner: draft.consumedOwner,
      });

      if (result.closed || status === 1) {
        navigate(`${backHref}?msg=3`);
        return;
      }

      setSearchParams({
        comid: comId,
        page,
        ...(prevComIdParam ? { prevComId: prevComIdParam } : {}),
        msg: String(result.msg ?? 0),
      });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to save Bunker Calculations.');
    } finally {
      setSaving(false);
    }
  };

  const lastPortName = draft?.ports?.length
    ? draft.ports[draft.ports.length - 1].portName
    : '';

  const renderPrevTableBody = (side) => {
    const rows = side === 'fo' ? draft.previousFo : draft.previousDo;
    const title = side === 'fo' ? 'Fuel Oil' : 'DO/MGO';

    return (
      <>
        <tr className={styles.grpRow}>
          <td colSpan={4}>{title}</td>
        </tr>
        {(rows || []).map((row, index) => (
          <tr key={`${side}-prev-${row.bunkerId || index}`}>
            <td className={styles.gradeName}>{row.name || '—'}</td>
            <td>
              <TextInput
                className={styles.cfInp}
                value={row.qty}
                onChange={(e) => patchPrevious(side, index, { qty: e.target.value })}
                placeholder="0.00"
              />
            </td>
            <td>
              <TextInput
                className={styles.cfInp}
                value={row.value}
                onChange={(e) => patchPrevious(side, index, { value: e.target.value })}
                placeholder="0.00"
              />
            </td>
            <td>
              <TextInput
                className={styles.cfInp}
                value={row.calDesc}
                onChange={(e) => patchPrevious(side, index, { calDesc: e.target.value })}
                placeholder="Qty1*price1,Qty2*price2"
              />
            </td>
          </tr>
        ))}
        {!rows?.length ? (
          <tr className={styles.cfEmptyRow}>
            <td colSpan={4}>No previous {title} rows.</td>
          </tr>
        ) : null}
      </>
    );
  };

  const renderPortGradeTable = (portIndex, side) => {
    const port = draft.ports[portIndex];
    const field = side === 'fo' ? 'foRows' : 'doRows';
    const rows = (port[field]?.length ? port[field] : [emptyBunkerRow()]);
    const gradeOptions = side === 'fo' ? (lookups.foGrades || []) : (lookups.doGrades || []);
    const title = side === 'fo' ? 'Fuel Oil' : 'DO/MGO';

    return (
      <div className={styles.bunkGradeGroup}>
        <div className={styles.bunkGradeLabel}>{title}</div>
        <div className={styles.bunkTableWrap}>
          <table className={styles.bunkTable}>
            <thead>
              <tr>
                <th>Bunker Grade</th>
                <th>ROB SOSP(MT)</th>
                <th>Qty Stemmed(MT)</th>
                <th>Supply Price(Cost/MT)</th>
                <th>Add. Costs(USD)</th>
                <th>Effective Price(Cost/MT)</th>
                <th>Stemmed Value(USD)</th>
                <th>Remarks</th>
                <th>On Account Of</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${port.key}-${side}-${rowIndex}`}>
                  <td>
                    <CardSelect
                      value={row.bunkerId}
                      options={gradeOptions}
                      onChange={(v) => patchPortRow(portIndex, side, rowIndex, { bunkerId: String(v || '') })}
                      placeholder="Select type"
                      align="start"
                      ariaLabel={`${title} grade`}
                    />
                  </td>
                  <td>
                    <TextInput
                      value={row.robSosp}
                      onChange={(e) => patchPortRow(portIndex, side, rowIndex, { robSosp: e.target.value })}
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <TextInput
                      value={row.qtyStemmed}
                      onChange={(e) => patchPortRow(portIndex, side, rowIndex, { qtyStemmed: e.target.value })}
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <TextInput
                      value={row.supplyPrice}
                      onChange={(e) => patchPortRow(portIndex, side, rowIndex, { supplyPrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <TextInput
                      value={row.addCost}
                      onChange={(e) => patchPortRow(portIndex, side, rowIndex, { addCost: e.target.value })}
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <TextInput value={row.effectivePrice} disabled placeholder="0.00" />
                  </td>
                  <td>
                    <TextInput value={row.stemmedValue} disabled placeholder="0.00" />
                  </td>
                  <td>
                    <TextInput
                      value={row.remarks}
                      onChange={(e) => patchPortRow(portIndex, side, rowIndex, { remarks: e.target.value })}
                      placeholder="Description"
                    />
                  </td>
                  <td>
                    <CardSelect
                      value={row.accountOf}
                      options={accountOptions}
                      onChange={(v) => patchPortRow(portIndex, side, rowIndex, { accountOf: String(v || '') })}
                      placeholder="Select"
                      align="start"
                      ariaLabel="On Account Of"
                    />
                  </td>
                  <td className={styles.deleteCell}>
                    <button
                      type="button"
                      className={styles.circleBtn}
                      title="Remove row"
                      disabled={rows.length <= 1}
                      onClick={() => removePortRow(portIndex, side, rowIndex)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                        <path d="M18 6 6 18" />
                        <path d="M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className={styles.addRowBtn}
          onClick={() => addPortRow(portIndex, side)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add
        </button>
      </div>
    );
  };

  const renderResultRows = (rows, kind, side) => {
    if (!(rows || []).length) {
      return (
        <tr className={styles.cfEmptyRow}>
          <td colSpan={3}>—</td>
        </tr>
      );
    }
    return rows.map((row, i) => (
      <tr key={`res-${side}-${row.bunkerId || i}`}>
        <td className={styles.gradeName}>{row.name || '—'}</td>
        {kind === 'sosp' ? (
          <>
            <td><TextInput value={row.value} disabled placeholder="0.00" className={styles.cfInp} /></td>
            <td><TextInput value={row.calDesc} disabled placeholder="Qty1*price1" className={styles.cfInp} /></td>
          </>
        ) : (
          <>
            <td><TextInput value={row.qty} disabled placeholder="0.00" className={styles.cfInp} /></td>
            <td><TextInput value={row.value} disabled placeholder="0.00" className={styles.cfInp} /></td>
          </>
        )}
      </tr>
    ));
  };

  const voyLabelParts = [form?.voyageNo, form?.vesselName].filter(Boolean);

  return (
    <>
      <OpsVcBunkerHeaderActions backHref={backHref} disabled={loading || saving} />

      <div className={`zafira-page ${styles.page}`}>
        {(loading || saving) ? (
          <LoadingOverlay active label={saving ? 'Saving Bunkers…' : 'Loading Bunkers…'} />
        ) : null}
        {flash ? (
          <div className={flash.type === 'error' ? styles.error : styles.flashSuccess}>{flash.text}</div>
        ) : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        {draft ? (
          <>
            <div className={styles.wsheetBar}>
              <div className={styles.wsheetBarLeft}>
                <InfoIcon />
                <span>
                  Live bunker metrics for this voyage are calculated on the Voyage Worksheet — use this page to review and manually adjust individual bunker calculations.
                </span>
              </div>
              {worksheetHref ? (
                <Link to={worksheetHref} className={styles.wsheetLink} title="Opens the Voyage Worksheet where these figures are calculated live">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                  </svg>
                  Open Voyage Worksheet
                </Link>
              ) : null}
            </div>

            <div className={styles.voyIdRow}>
              {voyLabelParts.length ? (
                <div className={styles.voyChip}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="5" r="2.2" />
                    <path d="M12 7.2V21" />
                    <path d="M8 10h8" />
                    <path d="M4 13a8 8 0 0 0 16 0" />
                  </svg>
                  {form.voyageNo || '—'}
                  {form.vesselName ? (
                    <>
                      <span className={styles.vcSep}>·</span>
                      {form.vesselName}
                    </>
                  ) : null}
                </div>
              ) : null}
              <div className={styles.chartererChip}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M3 12h18" />
                </svg>
                Charterer: <b>{form.charterer || '—'}</b>
              </div>
            </div>

            <div className={styles.bunkLayout}>
              <div className={styles.bunkMain}>
                <div className={styles.cfSection}>
                  <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadNavy}`}>
                    <div className={styles.cfSectionTitleWrap}>
                      <div className={`${styles.sectionIco} ${styles.sectionIcoNavy}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M3 12a9 9 0 1 0 3-6.7" />
                          <path d="M3 4v5h5" />
                          <path d="M12 8v4l3 2" />
                        </svg>
                      </div>
                      <div>
                        <div className={styles.cfSectionTitle}>Last Port Bunker SOSP Details</div>
                        <div className={styles.cfSectionSub}>Reference figures carried over from the vessel&apos;s last port call</div>
                      </div>
                    </div>
                    {(form?.prevVoyageOptions || []).length ? (
                      <Field label="Previous Voyage" className={styles.prevVoyageField}>
                        <CardSelect
                          value={prevComIdParam || form?.prevComId || ''}
                          options={(form.prevVoyageOptions || []).map((opt) => ({
                            id: String(opt.id),
                            name: opt.name || String(opt.id),
                          }))}
                          onChange={handlePrevVoyageChange}
                          align="end"
                          ariaLabel="Previous voyage"
                        />
                      </Field>
                    ) : null}
                  </div>
                  <SectionInfoBar>
                    Shown for comparison against the current voyage&apos;s stemmed figures below — adjust only if the last-port record itself needs correcting.
                  </SectionInfoBar>
                  <div className={styles.bunkBody}>
                    <div className={styles.bunkTableWrap}>
                      <table className={styles.cfTable}>
                        <thead>
                          <tr>
                            <th>Bunker Grade</th>
                            <th>Qty(MT)</th>
                            <th>Bunker Value (USD)</th>
                            <th>
                              <div className={styles.thMain}>Last Bunker</div>
                              <div className={styles.thSub}>(Qty x Price) In, 2nd Last…</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {renderPrevTableBody('fo')}
                          {renderPrevTableBody('do')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className={styles.cfSection}>
                  <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadOrange}`}>
                    <div className={styles.cfSectionTitleWrap}>
                      <div className={`${styles.sectionIco} ${styles.sectionIcoOrange}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M4 22V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v17" />
                          <path d="M4 12h10" />
                          <path d="M14 8h2.5L19 10.5V19a1.5 1.5 0 0 1-3 0v-4h-2" />
                          <path d="M2 22h14" />
                        </svg>
                      </div>
                      <div>
                        <div className={styles.cfSectionTitle}>Current Voyage Bunker Details</div>
                        <div className={styles.cfSectionSub}>Bunker figures recorded at each port call this voyage</div>
                      </div>
                    </div>
                  </div>
                  <SectionInfoBar>
                    Select a port to expand its Fuel Oil and DO/MGO figures and adjust them individually — the rest stay collapsed to keep this list manageable.
                  </SectionInfoBar>
                  <div className={styles.bunkBody}>
                    {(draft.ports || []).map((port, portIndex) => {
                      const isOpen = openPorts.has(port.key);
                      return (
                        <div
                          key={port.key || portIndex}
                          className={`${styles.bunkPortAcc} ${isOpen ? styles.bunkPortAccOpen : ''}`}
                        >
                          <div
                            className={styles.bunkPortHead}
                            role="button"
                            tabIndex={0}
                            onClick={() => togglePort(port.key)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                togglePort(port.key);
                              }
                            }}
                          >
                            <div className={styles.bunkPortHeadLeft}>
                              <span className={styles.bunkPortChevron}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </span>
                              <span className={styles.portChip}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <circle cx="12" cy="5" r="2.2" />
                                  <path d="M12 7.2V21" />
                                  <path d="M8 10h8" />
                                  <path d="M4 13a8 8 0 0 0 16 0" />
                                </svg>
                                Port: {port.portName || '—'}
                              </span>
                            </div>
                            <div
                              className={styles.bunkPortSosp}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              role="presentation"
                            >
                              <label htmlFor={`bunker-sosp-${port.key}`}>SOSP (Date/Time)</label>
                              <div className={styles.bunkPortSospField} id={`bunker-sosp-${port.key}`}>
                                <DmyDateInput
                                  enableTime
                                  value={port.sospDate}
                                  onChange={(v) => patchPort(portIndex, { sospDate: v })}
                                />
                              </div>
                            </div>
                          </div>
                          {isOpen ? (
                            <div className={styles.bunkPortBody}>
                              {renderPortGradeTable(portIndex, 'fo')}
                              {renderPortGradeTable(portIndex, 'do')}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {!draft.ports?.length ? (
                      <p className={styles.cfEmptyRow}>No ports found on the cost sheet for bunker entry.</p>
                    ) : null}
                  </div>
                </div>

                <div className={styles.cfSection}>
                  <div className={`${styles.cfSectionHead} ${styles.cfSectionHeadTeal}`}>
                    <div className={styles.cfSectionTitleWrap}>
                      <div className={`${styles.sectionIco} ${styles.sectionIcoTeal}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="4" y="2" width="16" height="20" rx="2" />
                          <path d="M8 6h8" />
                          <path d="M8 11h1" />
                          <path d="M12 11h1" />
                          <path d="M16 11h1" />
                        </svg>
                      </div>
                      <div>
                        <div className={styles.cfSectionTitle}>Current Voyage Bunker Results</div>
                        <div className={styles.cfSectionSub}>
                          SOSP value computed at the last port
                          {lastPortName ? ` — ${String(lastPortName).toUpperCase()}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                  <SectionInfoBar>
                    Automatically computed from the SOSP details above once figures are entered — read-only.
                  </SectionInfoBar>
                  <div className={styles.bunkBody}>
                    <div className={styles.bunkTableWrap}>
                      <table className={styles.cfTable}>
                        <thead>
                          <tr>
                            <th>Bunker Grade</th>
                            <th>Total Value(USD)</th>
                            <th>Bunker Calculation Desc</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className={styles.grpRow}>
                            <td colSpan={3}>Fuel Oil</td>
                          </tr>
                          {renderResultRows(draft.sospResults?.fo, 'sosp', 'fo')}
                          <tr className={styles.grpRow}>
                            <td colSpan={3}>DO/MGO</td>
                          </tr>
                          {renderResultRows(draft.sospResults?.do, 'sosp', 'do')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.bunkSide}>
                <ConsumedWidget
                  variant="charterer"
                  title="Consumed on Charterer's Account"
                  subtitle="Qty & value used against charterer"
                  foRows={draft.consumedCharterer?.fo}
                  doRows={draft.consumedCharterer?.do}
                />
                <ConsumedWidget
                  variant="owner"
                  title="Consumed on Owner's Account"
                  subtitle="Qty & value used against owner"
                  foRows={draft.consumedOwner?.fo}
                  doRows={draft.consumedOwner?.do}
                />
                <div className={styles.sideActions}>
                  <button
                    type="button"
                    className={styles.btnSaveOutline}
                    onClick={() => handleSubmit(0)}
                    disabled={saving || loading}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <path d="M17 21v-8H7v8" />
                      <path d="M7 3v5h8" />
                    </svg>
                    Save
                  </button>
                  <button
                    type="button"
                    className={styles.btnSubmitClose}
                    onClick={() => handleSubmit(1)}
                    disabled={saving || loading}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {!loading && !draft && !error ? (
          <div className={styles.empty}>No bunker form data available.</div>
        ) : null}
      </div>
    </>
  );
}

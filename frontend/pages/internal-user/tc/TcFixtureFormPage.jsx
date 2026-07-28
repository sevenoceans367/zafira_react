import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, CardSelect, DmyDateInput, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import {
  createTcEstimate,
  downloadTcEstimatePdf,
  fetchTcEstimate,
  fetchTcLookups,
  updateTcEstimate,
} from '../../../services/tcEstimates.js';
import { fetchVesselEstimatePrefill } from '../../../services/estimateDetail.js';
import VesselSearchSelect from '../sopf/VesselSearchSelect.jsx';
import TcFormHeaderActions from './TcFormHeaderActions.jsx';
import styles from './TcPages.module.css';

const EMPTY_BUNKER = { bunkerId: '', qty: '', price: '', amount: '', bunkerDate: '' };

function emptyForm(businessTypeId = '2') {
  return {
    businessTypeId,
    fixtureType: '1',
    vesselImoId: '',
    vesselName: '',
    vesselType: '',
    flag: '',
    tcDate: '',
    tcNo: '',
    cpDate: '',
    cpType: '',
    charterer: '',
    charOperation: '',
    charteringTeam: '7',
    charteringPic1: '',
    charteringPic2: '',
    lawArbit: '',
    charOperAdd: '',
    buildYard: '',
    yearBuild: '',
    flag1: '',
    portOfReg: '',
    imoNo: '',
    classId: '',
    lastSpSurvey: '',
    lastDd: '',
    ownersPi: '',
    mastersName: '',
    callSign: '',
    inmarsatTel: '',
    inmarsatMail: '',
    loa1: '',
    breadth: '',
    summerDwt: '',
    summerDraft: '',
    tpc1: '',
    grossTonn: '',
    netTonn: '',
    cargoTankCap: '',
    noOfGrades: '',
    cargoPumpCap: '',
    totalSbtCap: '',
    suezGrt: '',
    suezNrt: '',
    panamaNrt: '',
    grainCap: '',
    baleCap: '',
    cranes: '',
    grabs: '',
    keelTopMast: '',
    waterlineTopMast: '',
    delRangePort: '',
    durFixPer: '',
    tripTc: '',
    period: '',
    noOfTrip: '',
    delDate: '',
    reDelDate: '',
    durOptPer: '',
    commOptPer: '',
    laycanFrom: '',
    laycanTo: '',
    laycanNarr: '',
    reDelRange: '',
    hireFixPer: '',
    exchangeCurrency: 'USD',
    exchangeRate: '1',
    hireOptPer: '',
    fuelSpecs: '',
    cveMonth: '',
    supercargoMeals: '',
    holdCleanInter: '',
    ilohcUsd: '',
    ilohcRemarks: '',
    broCommPayable: '',
    addComm: '',
    brokerComm: '',
    ownersBankDet: '',
    docCreatBy: '',
    additInform: '',
    windForce: '',
    speedLaden: '',
    speedBallast: '',
    cpSpeed: '',
    foConsLaden: '',
    doConsLaden: '',
    foConsBallast: '',
    doConsBallast: '',
    foConsLdg: '',
    doConsLdg: '',
    foConsDisch: '',
    doConsDisch: '',
    foConsIdle: '',
    doConsIdle: '',
    loadRate: '',
    dischRate: '',
    balticRoute: '',
    balticDate: '',
    balticRate: '',
    periodId: '',
    dwtSummerCp: '',
    dwtTropicalCp: '',
    grainCapCp: '',
    baleCapCp: '',
    sfCp: '',
    loadableCp: '',
    grtNrtCp: '',
    loaCp: '',
    gearCp: '',
    builtYearCp: '',
    beamCp: '',
    tpcCp: '',
    bFullSpeedCp: '',
    bEcoSpeed1Cp: '',
    bEcoSpeed2Cp: '',
    lFullSpeedCp: '',
    lEcoSpeed1Cp: '',
    lEcoSpeed2Cp: '',
    foConsumptions: [],
    doConsumptions: [],
    deliveryBunkers: [{ ...EMPTY_BUNKER }],
    redeliveryBunkers: [{ ...EMPTY_BUNKER }],
  };
}

const FIXTURE_TABS = [
  { id: 'fixture', label: 'TC Fixture Note' },
  { id: 'commercial', label: 'Commercial Parameters' },
  { id: 'tcpTerms', label: 'TC/CP Terms' },
];

function ConsCell({ value }) {
  return (
    <td>
      <input value={value || ''} readOnly className={styles.inputReadonly} />
    </td>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <div className={`${styles.field} ${className}`.trim()}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder = '',
  type = 'text',
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={readOnly ? styles.inputReadonly : undefined}
      />
    </Field>
  );
}

function DateField({ label, value, onChange, enableTime = false, className = '' }) {
  return (
    <Field label={label} className={className}>
      <DmyDateInput
        value={value || ''}
        onChange={onChange}
        enableTime={enableTime}
      />
    </Field>
  );
}

function bunkerAmount(qty, price) {
  const q = Number(qty);
  const p = Number(price);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return '';
  return (q * p).toFixed(2);
}

function sumBunkerAmounts(rows = []) {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0).toFixed(2);
}

function applyVesselPrefill(prev, prefill, vesselMeta = {}) {
  if (!prefill && !vesselMeta.id) return prev;
  return {
    ...prev,
    vesselImoId: String(prefill?.vesselImoId || vesselMeta.id || prev.vesselImoId),
    vesselName: prefill?.vesselName || vesselMeta.name || prev.vesselName,
    vesselType: prefill?.vesselType || prev.vesselType,
    flag: prefill?.flag || prev.flag,
    flag1: prefill?.flag || prev.flag1,
    imoNo: prefill?.imoNo || prev.imoNo,
    summerDwt: prefill?.dwtSummer || prev.summerDwt,
    dwtSummerCp: prefill?.dwtSummer || prev.dwtSummerCp,
    loa1: prefill?.loa || prev.loa1,
    breadth: prefill?.beam || prev.breadth,
    yearBuild: prefill?.builtYear || prev.yearBuild,
    grainCap: prefill?.grainCap || prev.grainCap,
    baleCap: prefill?.baleCap || prev.baleCap,
    grossTonn: prefill?.gnrt || prev.grossTonn,
    netTonn: prefill?.nrt || prev.netTonn,
    tpc1: prefill?.tpc || prev.tpc1,
    businessTypeId: prefill?.businessTypeId || vesselMeta.businessTypeId || prev.businessTypeId,
    bFullSpeedCp: prefill?.bFullSpeed || prev.bFullSpeedCp,
    lFullSpeedCp: prefill?.lFullSpeed || prev.lFullSpeedCp,
  };
}

/** Mirrors php/updatetcestimate.php — TC Fixture Note update/edit form.
 *  mode=view mirrors php/viewtcfixturenote.php (Ops read-only). */
export default function TcFixtureFormPage({
  mode = 'add',
  overrideTcOutId,
  backHref,
}) {
  const navigate = useNavigate();
  const { tcOutId: paramTcOutId } = useParams();
  const tcOutId = overrideTcOutId || paramTcOutId;
  const [searchParams] = useSearchParams();
  const [lookups, setLookups] = useState(null);
  const [form, setForm] = useState(() => emptyForm(searchParams.get('selBType') || '2'));
  const [loading, setLoading] = useState(mode !== 'add');
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('fixture');

  const readOnly = mode === 'view';
  const listHref = backHref || appPath('/internal-user/vc/tc');
  const isDry = String(form.businessTypeId) === '3';

  const title = mode === 'add'
    ? 'Add TC Fixture Note'
    : mode === 'view'
      ? 'View TC Fixture Note'
      : 'Update TC Fixture Note';

  const dailyHireUsd = useMemo(() => {
    const hire = Number(form.hireFixPer) || 0;
    const rate = Number(form.exchangeRate);
    const exchange = Number.isFinite(rate) && rate !== 0 ? rate : 1;
    return (hire * exchange).toFixed(2);
  }, [form.exchangeRate, form.hireFixPer]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchTcLookups();
        if (!cancelled) setLookups(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load lookups.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (mode === 'add' || !tcOutId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const detail = await fetchTcEstimate(tcOutId);
        if (cancelled) return;
        setForm({
          ...emptyForm(detail.businessTypeId || '2'),
          ...detail,
          fixtureType: detail.fixtureType || '1',
          deliveryBunkers: detail.deliveryBunkers?.length ? detail.deliveryBunkers : [{ ...EMPTY_BUNKER }],
          redeliveryBunkers: detail.redeliveryBunkers?.length ? detail.redeliveryBunkers : [{ ...EMPTY_BUNKER }],
          foConsumptions: detail.foConsumptions || [],
          doConsumptions: detail.doConsumptions || [],
        });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load fixture note.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, tcOutId]);

  const setField = (key, value) => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateBunker = (kind, index, key, value) => {
    if (readOnly) return;
    setForm((prev) => {
      const rows = [...(prev[kind] || [])];
      const next = { ...rows[index], [key]: value };
      if (key === 'qty' || key === 'price') {
        next.amount = bunkerAmount(key === 'qty' ? value : next.qty, key === 'price' ? value : next.price);
      }
      rows[index] = next;
      return { ...prev, [kind]: rows };
    });
  };

  const addBunker = (kind) => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, [kind]: [...(prev[kind] || []), { ...EMPTY_BUNKER }] }));
  };

  const removeBunker = (kind, index) => {
    if (readOnly) return;
    setForm((prev) => {
      const rows = [...(prev[kind] || [])];
      rows.splice(index, 1);
      return { ...prev, [kind]: rows.length ? rows : [{ ...EMPTY_BUNKER }] };
    });
  };

  const handleSelectVessel = async (vessel) => {
    if (readOnly) return;
    if (!vessel) {
      setForm((prev) => ({
        ...prev,
        vesselImoId: '',
        vesselName: '',
        vesselType: '',
        flag: '',
      }));
      return;
    }
    setForm((prev) => applyVesselPrefill(prev, null, {
      id: vessel.id || vessel.vesselImoId,
      name: vessel.name || vessel.vesselName,
      businessTypeId: vessel.businessTypeId,
    }));
    try {
      const prefill = await fetchVesselEstimatePrefill(vessel.id || vessel.vesselImoId);
      if (prefill) {
        setForm((prev) => applyVesselPrefill(prev, prefill, {
          id: vessel.id || vessel.vesselImoId,
          name: vessel.name || vessel.vesselName,
        }));
      }
    } catch {
      // Keep basic vessel identity if prefill fails.
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (readOnly) return;
    if (!form.vesselImoId) {
      setError('Vessel is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, fixtureType: form.fixtureType || '1' };
      if (mode === 'add') {
        const created = await createTcEstimate(payload);
        navigate(appPath(`/internal-user/vc/tc/${created.tcOutId}/edit?msg=0`));
      } else {
        await updateTcEstimate(tcOutId, payload);
        navigate(appPath('/internal-user/vc/tc?msg=0'));
      }
    } catch (err) {
      setError(err.message || 'Failed to save fixture note.');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (mode === 'add' || !tcOutId || pdfLoading) return;
    setPdfLoading(true);
    setError('');
    try {
      await downloadTcEstimatePdf(tcOutId);
    } catch (err) {
      setError(err.message || 'Failed to generate TC fixture PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const renderBunkerTable = (kind, label) => (
    <div className={styles.bunkerBlock}>
      <strong>{label}</strong>
      <table className={styles.rowTable}>
        <thead>
          <tr>
            <th>#</th>
            <th>Bunker Grade</th>
            <th>Qty (MT)</th>
            <th>Bunker Date</th>
            <th>Price USD/MT</th>
            <th>Amount (USD)</th>
          </tr>
        </thead>
        <tbody>
          {(form[kind] || []).map((row, index) => (
            <tr key={`${kind}-${index}`}>
              <td>
                {!readOnly ? (
                  <button type="button" className={`${styles.linkBtn} ${styles.linkBtnDanger}`} onClick={() => removeBunker(kind, index)}>
                    ×
                  </button>
                ) : (
                  index + 1
                )}
              </td>
              <td>
                <select
                  value={row.bunkerId != null ? String(row.bunkerId) : ''}
                  onChange={(e) => updateBunker(kind, index, 'bunkerId', e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">Select</option>
                  {(lookups?.bunkers || []).map((opt) => (
                    <option key={String(opt.id)} value={String(opt.id)}>{opt.name}</option>
                  ))}
                  {row.bunkerId != null
                    && String(row.bunkerId).trim() !== ''
                    && !(lookups?.bunkers || []).some((opt) => String(opt.id) === String(row.bunkerId))
                    ? (
                      <option value={String(row.bunkerId)}>{`Grade #${row.bunkerId}`}</option>
                    )
                    : null}
                </select>
              </td>
              <td>
                <input
                  value={row.qty || ''}
                  onChange={(e) => updateBunker(kind, index, 'qty', e.target.value)}
                  placeholder="0.00"
                  readOnly={readOnly}
                  className={readOnly ? styles.inputReadonly : undefined}
                />
              </td>
              <td>
                <DmyDateInput
                  value={row.bunkerDate || ''}
                  onChange={(value) => updateBunker(kind, index, 'bunkerDate', value)}
                  disabled={readOnly}
                />
              </td>
              <td>
                <input
                  value={row.price || ''}
                  onChange={(e) => updateBunker(kind, index, 'price', e.target.value)}
                  placeholder="0.00"
                  readOnly={readOnly}
                  className={readOnly ? styles.inputReadonly : undefined}
                />
              </td>
              <td>
                <input value={row.amount || ''} readOnly className={styles.inputReadonly} placeholder="0.00" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.bunkerFooter}>
        {!readOnly ? <Button variant="outline" label="Add" onClick={() => addBunker(kind)} /> : null}
        <span className={styles.muted}>Total: {sumBunkerAmounts(form[kind])}</span>
      </div>
    </div>
  );

  const renderAtSeaTable = (rows, title) => (
    <div className={styles.consBlock}>
      <h4 className={styles.consTitle}>{title}</h4>
      <div className={styles.consTableWrap}>
        <table className={styles.consTable}>
          <thead>
            <tr>
              <th rowSpan={2}>Bunker</th>
              <th colSpan={4}>Full Speed</th>
              <th colSpan={4}>Service Speed</th>
              <th colSpan={4}>Most Eco Speed</th>
            </tr>
            <tr>
              <th>SECA (Ballast)</th>
              <th>SECA (Laden)</th>
              <th>NON-SECA (Ballast)</th>
              <th>NON-SECA (Laden)</th>
              <th>SECA (Ballast)</th>
              <th>SECA (Laden)</th>
              <th>NON-SECA (Ballast)</th>
              <th>NON-SECA (Laden)</th>
              <th>SECA (Ballast)</th>
              <th>SECA (Laden)</th>
              <th>NON-SECA (Ballast)</th>
              <th>NON-SECA (Laden)</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).length ? (rows || []).map((row, index) => (
              <tr key={`${title}-${row.bunkerId || index}`}>
                <td>{row.bunkerName || `Grade #${row.bunkerId || '—'}`}</td>
                <ConsCell value={row.balSecaFs} />
                <ConsCell value={row.ladSecaFs} />
                <ConsCell value={row.balNonSecaFs} />
                <ConsCell value={row.ladNonSecaFs} />
                <ConsCell value={row.balSecaSs} />
                <ConsCell value={row.ladSecaSs} />
                <ConsCell value={row.balNonSecaSs} />
                <ConsCell value={row.ladNonSecaSs} />
                <ConsCell value={row.balSecaMes} />
                <ConsCell value={row.ladSecaMes} />
                <ConsCell value={row.balNonSecaMes} />
                <ConsCell value={row.ladNonSecaMes} />
              </tr>
            )) : (
              <tr>
                <td colSpan={13} className={styles.center}>No records</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInPortTable = (rows, title) => (
    <div className={styles.consBlock}>
      <h4 className={styles.consTitle}>{title}</h4>
      <div className={styles.consTableWrap}>
        <table className={styles.consTable}>
          <thead>
            <tr>
              <th rowSpan={2}>Bunker</th>
              <th colSpan={2}>Working</th>
              <th colSpan={2}>Idle</th>
              <th colSpan={2}>Others</th>
            </tr>
            <tr>
              <th>SECA</th>
              <th>NON-SECA</th>
              <th>SECA</th>
              <th>NON-SECA</th>
              <th>SECA</th>
              <th>NON-SECA</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).length ? (rows || []).map((row, index) => (
              <tr key={`${title}-${row.bunkerId || index}`}>
                <td>{row.bunkerName || `Grade #${row.bunkerId || '—'}`}</td>
                <ConsCell value={row.inPortSecaWorking} />
                <ConsCell value={row.inPortNonSecaWorking} />
                <ConsCell value={row.inPortSecaIdle} />
                <ConsCell value={row.inPortNonSecaIdle} />
                <ConsCell value={row.inPortSecaOther} />
                <ConsCell value={row.inPortNonSecaOther} />
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className={styles.center}>No records</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className={`zafira-page ${styles.page}`}>
      <TcFormHeaderActions
        listHref={listHref}
        disabled={saving || loading}
        onGeneratePdf={mode !== 'add' ? handleGeneratePdf : undefined}
        pdfLoading={pdfLoading}
      />
      {loading ? <LoadingOverlay active label="Loading fixture note…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      <h3 className={styles.title}>{title}</h3>

      <form onSubmit={handleSubmit}>
        <fieldset disabled={readOnly} className={styles.viewFieldset}>
        <div className={styles.headerBar}>
          <div className={styles.headerItem}>
            <strong>Fixture Type:</strong> TC Out
            <input type="hidden" value={form.fixtureType || '1'} readOnly />
          </div>
          <Field label="Period Contract">
            <CardSelect
              options={lookups?.periodContracts || []}
              value={form.periodId}
              onChange={(v) => setField('periodId', v)}
              placeholder="Select period contract"
              ariaLabel="Period contract"
            />
          </Field>
          <Field label="Vessel">
            {readOnly ? (
              <input
                value={form.vesselName || ''}
                readOnly
                className={styles.inputReadonly}
              />
            ) : (
              <VesselSearchSelect
                value={form.vesselImoId}
                label={form.vesselName}
                onSelect={handleSelectVessel}
              />
            )}
          </Field>
          <TextInput label="Vessel Type" value={form.vesselType} readOnly />
          <TextInput label="Flag" value={form.flag} readOnly />
          <DateField label="Date" value={form.tcDate} onChange={(v) => setField('tcDate', v)} />
          <TextInput label="TC No." value={form.tcNo} onChange={(v) => setField('tcNo', v)} readOnly={mode === 'edit' || readOnly} />
        </div>
        </fieldset>

        <div className={styles.tabs} role="tablist" aria-label="Fixture note tabs">
          {FIXTURE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <fieldset disabled={readOnly} className={styles.viewFieldset}>
        {activeTab === 'fixture' ? (
        <div className={styles.fixtureLayout}>
          <div className={styles.fixtureLeft}>
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>CP / Parties</h4>
              <div className={styles.formGrid}>
                <DateField label="CP Date" value={form.cpDate} onChange={(v) => setField('cpDate', v)} />
                <Field label="CP Type">
                  <CardSelect
                    options={lookups?.cpTypes || []}
                    value={form.cpType}
                    onChange={(v) => setField('cpType', v)}
                    placeholder="Select CP type"
                    ariaLabel="CP type"
                  />
                </Field>
                <Field label="Charterers">
                  <CardSelect
                    options={lookups?.charterers || []}
                    value={form.charterer}
                    onChange={(v) => setField('charterer', v)}
                    placeholder="Select charterer"
                    ariaLabel="Charterer"
                  />
                </Field>
                <Field label="Charterers Operations">
                  <CardSelect
                    options={lookups?.vendors || []}
                    value={form.charOperation}
                    onChange={(v) => setField('charOperation', v)}
                    placeholder="Select"
                    ariaLabel="Charterers operations"
                  />
                </Field>
                <Field label="Chartering Team">
                  <CardSelect
                    options={lookups?.charteringTeams || []}
                    value={form.charteringTeam}
                    onChange={(v) => setField('charteringTeam', v)}
                    placeholder="Select chartering team"
                    ariaLabel="Chartering team"
                  />
                </Field>
                <Field label="Chartering PIC 1">
                  <CardSelect
                    options={lookups?.charteringPics || []}
                    value={form.charteringPic1}
                    onChange={(v) => setField('charteringPic1', v)}
                    placeholder="Select PIC 1"
                    ariaLabel="Chartering PIC 1"
                  />
                </Field>
                <Field label="Chartering PIC 2">
                  <CardSelect
                    options={lookups?.charteringPics || []}
                    value={form.charteringPic2}
                    onChange={(v) => setField('charteringPic2', v)}
                    placeholder="Select PIC 2"
                    ariaLabel="Chartering PIC 2"
                  />
                </Field>
                <Field label="Law / Arbitration">
                  <CardSelect
                    options={lookups?.lawArbitration || []}
                    value={form.lawArbit}
                    onChange={(v) => setField('lawArbit', v)}
                    placeholder="Select"
                    ariaLabel="Law arbitration"
                  />
                </Field>
                <Field label="Address" className={styles.fullWidth}>
                  <textarea
                    value={form.charOperAdd || ''}
                    onChange={(e) => setField('charOperAdd', e.target.value)}
                    readOnly
                    className={styles.inputReadonly}
                    placeholder="Address"
                  />
                </Field>
              </div>
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                Vessel Details{form.vesselName ? `: ${form.vesselName}` : ''}
              </h4>
              <div className={styles.formGrid}>
                <TextInput label="Build Yard" value={form.buildYard} readOnly />
                <TextInput label="Year Built" value={form.yearBuild} readOnly />
                <TextInput label="Flag" value={form.flag1} readOnly />
                <TextInput label="Port of Registry" value={form.portOfReg} readOnly />
                <TextInput label="IMO No." value={form.imoNo} readOnly />
                <TextInput label="Class ID" value={form.classId} readOnly />
                <TextInput label="Last Special Survey" value={form.lastSpSurvey} readOnly />
                <TextInput label="Last DD" value={form.lastDd} readOnly />
                <TextInput label="Owners P&I" value={form.ownersPi} readOnly />
                <TextInput label="Master's Name" value={form.mastersName} onChange={(v) => setField('mastersName', v)} />
                <TextInput label="Call Sign" value={form.callSign} readOnly />
                <TextInput label="Inmarsat Tel" value={form.inmarsatTel} readOnly />
                <TextInput label="Inmarsat Email" value={form.inmarsatMail} readOnly />
                <TextInput label="LOA" value={form.loa1} readOnly />
                <TextInput label="Breadth" value={form.breadth} readOnly />
                <TextInput label="Summer DWT" value={form.summerDwt} readOnly />
                <TextInput label="Summer Draft" value={form.summerDraft} readOnly />
                <TextInput label="TPC" value={form.tpc1} readOnly />
                <TextInput label="Gross Tonnage" value={form.grossTonn} readOnly />
                <TextInput label="Net Tonnage" value={form.netTonn} readOnly />
                <TextInput label="Suez GRT" value={form.suezGrt} readOnly />
                <TextInput label="Suez NRT" value={form.suezNrt} readOnly />
                <TextInput label="Panama NRT" value={form.panamaNrt} readOnly />
                <TextInput label="Grain Cap" value={form.grainCap} readOnly />
                <TextInput label="Bale Cap" value={form.baleCap} readOnly />
                <TextInput label="Cranes" value={form.cranes} readOnly />
                <TextInput label="Grabs" value={form.grabs} readOnly />
                <TextInput label="Keel to Top of Mast" value={form.keelTopMast} readOnly />
                <TextInput label="Waterline to Top of Mast" value={form.waterlineTopMast} readOnly />
                {!isDry ? (
                  <>
                    <TextInput label="Cargo Tank Cap" value={form.cargoTankCap} readOnly />
                    <TextInput label="No. of Grades" value={form.noOfGrades} readOnly />
                    <TextInput label="Cargo Pump Cap" value={form.cargoPumpCap} readOnly />
                    <TextInput label="Total SBT Cap" value={form.totalSbtCap} readOnly />
                  </>
                ) : null}
              </div>
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Delivery / Hire Terms</h4>
              <div className={styles.formGrid}>
                <TextInput label="Delivery Range / Port" value={form.delRangePort} onChange={(v) => setField('delRangePort', v)} />
                <TextInput label="Trip TC" value={form.tripTc} onChange={(v) => setField('tripTc', v)} />
                <TextInput label="Period" value={form.period} onChange={(v) => setField('period', v)} />
                <TextInput label="No. of Trips" value={form.noOfTrip} onChange={(v) => setField('noOfTrip', v)} />
                <DateField label="Delivery Date" value={form.delDate} onChange={(v) => setField('delDate', v)} enableTime />
                <DateField label="Redelivery Date" value={form.reDelDate} onChange={(v) => setField('reDelDate', v)} enableTime />
                <TextInput label="Duration Optional Period" value={form.durOptPer} onChange={(v) => setField('durOptPer', v)} />
                <TextInput label="Commencement Optional Period" value={form.commOptPer} onChange={(v) => setField('commOptPer', v)} />
                <DateField label="Laycan From" value={form.laycanFrom} onChange={(v) => setField('laycanFrom', v)} enableTime />
                <DateField label="Laycan To" value={form.laycanTo} onChange={(v) => setField('laycanTo', v)} enableTime />
                <TextInput label="Laycan Narrowing" value={form.laycanNarr} onChange={(v) => setField('laycanNarr', v)} />
                <TextInput label="Redelivery Range" value={form.reDelRange} onChange={(v) => setField('reDelRange', v)} />
                <Field label="Hire PDPR Currency">
                  <CardSelect
                    options={lookups?.currencies || []}
                    value={form.exchangeCurrency}
                    onChange={(v) => setField('exchangeCurrency', v)}
                    placeholder="Currency"
                    ariaLabel="Currency"
                  />
                </Field>
                <TextInput label="Exchange Rate To USD" value={form.exchangeRate} onChange={(v) => setField('exchangeRate', v)} />
                <TextInput label={`Hire Fixed Period PDPR (${form.exchangeCurrency || 'USD'})`} value={form.hireFixPer} onChange={(v) => setField('hireFixPer', v)} />
                <TextInput label="Hire Fixed Period PDPR (USD)" value={dailyHireUsd} readOnly />
                <TextInput label="Hire Optional Period" value={form.hireOptPer} onChange={(v) => setField('hireOptPer', v)} />
                <TextInput label="Fuel Specs" value={form.fuelSpecs} onChange={(v) => setField('fuelSpecs', v)} />
                <TextInput label="CVE/Month (USD)" value={form.cveMonth} onChange={(v) => setField('cveMonth', v)} />
                {isDry ? (
                  <>
                    <TextInput label="Supercargo and meals (USD)" value={form.supercargoMeals} onChange={(v) => setField('supercargoMeals', v)} />
                    <TextInput label="Hold Cleaning Intermediate (USD)" value={form.holdCleanInter} onChange={(v) => setField('holdCleanInter', v)} />
                    <TextInput label="ILOHC (USD)" value={form.ilohcUsd} onChange={(v) => setField('ilohcUsd', v)} />
                    <TextInput label="ILOHC - Remarks from CP" value={form.ilohcRemarks} onChange={(v) => setField('ilohcRemarks', v)} />
                  </>
                ) : null}
                <Field label="Brokerage Comm. payable by">
                  <CardSelect
                    options={lookups?.payableBy || []}
                    value={form.broCommPayable}
                    onChange={(v) => setField('broCommPayable', v)}
                    placeholder="Select"
                    ariaLabel="Payable by"
                  />
                </Field>
                <TextInput label="Add. Comm %" value={form.addComm} onChange={(v) => setField('addComm', v)} />
                <TextInput label="Broker's Comm. %" value={form.brokerComm} onChange={(v) => setField('brokerComm', v)} />
                <Field label="Owner's Banking Details">
                  <CardSelect
                    options={lookups?.bankingDetails || []}
                    value={form.ownersBankDet}
                    onChange={(v) => setField('ownersBankDet', v)}
                    placeholder="Select banking details"
                    ariaLabel="Banking details"
                  />
                </Field>
                <TextInput label="Document created by" value={form.docCreatBy} readOnly />
                <Field label="Additional Information" className={styles.fullWidth}>
                  <textarea value={form.additInform || ''} onChange={(e) => setField('additInform', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          <div className={styles.fixtureRight}>
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Bunker Details</h4>
              {renderBunkerTable('deliveryBunkers', 'Delivery')}
              {renderBunkerTable('redeliveryBunkers', 'Re-Delivery')}
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Baltic Route Details</h4>
              <div className={styles.formGrid}>
                <Field label="Baltic Route">
                  <CardSelect
                    options={lookups?.balticRoutes || []}
                    value={form.balticRoute}
                    onChange={(v) => setField('balticRoute', v)}
                    placeholder="Select route"
                    ariaLabel="Baltic route"
                  />
                </Field>
                <DateField label="Baltic Route Date" value={form.balticDate} onChange={(v) => setField('balticDate', v)} />
                <TextInput label="Baltic Route Value" value={form.balticRate} onChange={(v) => setField('balticRate', v)} />
              </div>
            </div>
          </div>
        </div>
        ) : null}

        {activeTab === 'commercial' ? (
          <div className={styles.tabPanel}>
            <div className={styles.section}>
              <div className={styles.formGrid}>
                <TextInput label="DWT (Summer)" value={form.dwtSummerCp} readOnly />
                <TextInput label="DWT (Tropical)" value={form.dwtTropicalCp} readOnly />
                <TextInput label="Grain Cap (CBM)" value={form.grainCapCp} readOnly />
                <TextInput label="Bale Cap (CBM)" value={form.baleCapCp} readOnly />
                <TextInput label="SF (ft3/lt)" value={form.sfCp} readOnly />
                <TextInput label="Loadable (MT)" value={form.loadableCp} readOnly />
                <TextInput label="GRT/NRT" value={form.grtNrtCp} readOnly />
                <TextInput label="LOA" value={form.loaCp} readOnly />
                <TextInput label="Gear" value={form.gearCp} readOnly />
                <TextInput label="Built Year" value={form.builtYearCp} readOnly />
                <TextInput label="B.E.A.M. (m)" value={form.beamCp} readOnly />
                <TextInput label="TPC" value={form.tpcCp} readOnly />
              </div>
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Speed Data</h4>
              <div className={styles.consTableWrap}>
                <table className={styles.consTable}>
                  <thead>
                    <tr>
                      <th>Speed Data</th>
                      <th>Full Speed</th>
                      <th>Service Speed</th>
                      <th>Most Eco Speed</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Ballast Speed (Knots)</td>
                      <ConsCell value={form.bFullSpeedCp} />
                      <ConsCell value={form.bEcoSpeed1Cp} />
                      <ConsCell value={form.bEcoSpeed2Cp} />
                    </tr>
                    <tr>
                      <td>Laden Speed (Knots)</td>
                      <ConsCell value={form.lFullSpeedCp} />
                      <ConsCell value={form.lEcoSpeed1Cp} />
                      <ConsCell value={form.lEcoSpeed2Cp} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {renderAtSeaTable(form.foConsumptions, 'FO Consp/day(MT) - At Sea')}
            {renderAtSeaTable(form.doConsumptions, 'DO Consp/day(MT) - At Sea')}
            {renderInPortTable(form.foConsumptions, 'FO Consp/day(MT)- In Port')}
            {renderInPortTable(form.doConsumptions, 'DO Consp/day(MT)- In Port')}
          </div>
        ) : null}

        {activeTab === 'tcpTerms' ? (
        <div className={styles.tabPanel}>
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>TC/CP Terms : Sea Passage</h4>
          <div className={styles.formGrid}>
            <TextInput label="Wind Force" value={form.windForce} onChange={(v) => setField('windForce', v)} />
            <TextInput label="Speed Laden (Kts)" value={form.speedLaden} onChange={(v) => setField('speedLaden', v)} />
            <TextInput label="Speed Ballast (Kts)" value={form.speedBallast} onChange={(v) => setField('speedBallast', v)} />
            <TextInput label="CP Speed" value={form.cpSpeed} onChange={(v) => setField('cpSpeed', v)} />
            <TextInput label="FO Cons Laden (MT/Day)" value={form.foConsLaden} onChange={(v) => setField('foConsLaden', v)} />
            <TextInput label="DO Cons Laden (MT/Day)" value={form.doConsLaden} onChange={(v) => setField('doConsLaden', v)} />
            <TextInput label="FO Cons Ballast (MT/Day)" value={form.foConsBallast} onChange={(v) => setField('foConsBallast', v)} />
            <TextInput label="DO Cons Ballast (MT/Day)" value={form.doConsBallast} onChange={(v) => setField('doConsBallast', v)} />
          </div>
          <h4 className={styles.sectionTitle}>TC/CP Terms : Port</h4>
          <div className={styles.formGrid}>
            <TextInput label="FO Cons Ldg (MT/Day)" value={form.foConsLdg} onChange={(v) => setField('foConsLdg', v)} />
            <TextInput label="DO Cons Ldg (MT/Day)" value={form.doConsLdg} onChange={(v) => setField('doConsLdg', v)} />
            <TextInput label="FO Cons Disch (MT/Day)" value={form.foConsDisch} onChange={(v) => setField('foConsDisch', v)} />
            <TextInput label="DO Cons Disch (MT/Day)" value={form.doConsDisch} onChange={(v) => setField('doConsDisch', v)} />
            <TextInput label="FO Cons Idle (MT/Day)" value={form.foConsIdle} onChange={(v) => setField('foConsIdle', v)} />
            <TextInput label="DO Cons Idle (MT/Day)" value={form.doConsIdle} onChange={(v) => setField('doConsIdle', v)} />
            <TextInput label="Load Rate (MT/Day)" value={form.loadRate} onChange={(v) => setField('loadRate', v)} />
            <TextInput label="Disch Rate (MT/Day)" value={form.dischRate} onChange={(v) => setField('dischRate', v)} />
          </div>
        </div>
        </div>
        ) : null}
        </fieldset>

        <div className={styles.formActions}>
          {!readOnly ? (
            <Button type="submit" label={saving ? 'Saving…' : 'Submit'} disabled={saving} />
          ) : null}
          {mode === 'edit' ? (
            <Button
              variant="outline"
              label="Calculate"
              href={appPath(`/internal-user/vc/tc/${tcOutId}/calculate`)}
              disabled={saving}
            />
          ) : null}
          <Button variant="outline" label="Back" href={listHref} disabled={saving} />
        </div>
      </form>
    </div>
  );
}

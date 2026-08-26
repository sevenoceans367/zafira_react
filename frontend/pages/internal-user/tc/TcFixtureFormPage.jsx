import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, CardSelect, DmyDateInput, LoadingOverlay } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import { useTcModule } from '../../../hooks/useTcModule.js';
import {
  createTcEstimate,
  downloadTcEstimatePdf,
  fetchPeriodTcInDetails,
  fetchTcBusinessTypes,
  fetchTcEstimate,
  fetchTcLookups,
  saveTcCalculation,
  updateTcEstimate,
} from '../../../services/tcEstimates.js';
import { fetchVesselEstimatePrefill } from '../../../services/estimateDetail.js';
import saveIcon from '../../../assets/Save.png';
import VesselSearchSelect from '../sopf/VesselSearchSelect.jsx';
import CollapsiblePanel from '../sopf/CollapsiblePanel.jsx';
import TcFormHeaderActions from './TcFormHeaderActions.jsx';
import TcInExpensesModal, {
  EMPTY_TC_IN_BUNKER,
  EMPTY_TC_IN_HIRE,
  EMPTY_TC_IN_OFF,
} from './TcInExpensesModal.jsx';
import styles from './TcPages.module.css';

function CancelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const EMPTY_BUNKER = { bunkerId: '', qty: '', price: '', amount: '', bunkerDate: '' };
const EMPTY_ITIN_EXP = { expenseType: '', description: '', amount: '', notes: '' };
const EMPTY_ITINERARY = {
  from: { place: '', date: '', notes: '' },
  to: { place: '', date: '', notes: '' },
};

function emptyTcIn(detail = {}, calc = {}) {
  return {
    cpDate: calc.tcCpDate || detail.cpDate || '',
    contractRef: calc.tcCpNumber || detail.tcNo || '',
    deliveryPort: calc.tcDeliveryPort || detail.delRangePort || '',
    redeliveryPort: calc.tcRedeliveryPort || detail.reDelRange || '',
    hires: [{
      ...EMPTY_TC_IN_HIRE,
      deliveryDate: detail.delDate || '',
      redeliveryDate: detail.reDelDate || '',
      dailyHire: detail.hireFixPer || '',
      addCommPct: detail.addComm || '',
    }],
    deliveryBunkers: [{ ...EMPTY_TC_IN_BUNKER }],
    redeliveryBunkers: [{ ...EMPTY_TC_IN_BUNKER }],
    offHires: [{ ...EMPTY_TC_IN_OFF }],
    offHireCveMonth: calc.tcOffHireCveMonth || '',
    bunkerOnOwner: calc.tcBunkerOnOwner || '',
    ilohc: calc.tcIlohc || detail.ilohcUsd || '',
    awrpCost: calc.awrpCost || '',
    finalVendor: calc.tcFinalVendor || '',
    finalHireage: calc.tcFinalHireage || '0.00',
  };
}

function hasSavedTcInHires(tcIn) {
  return Boolean(tcIn?.hires?.some((row) => (
    (row.dailyHire != null && String(row.dailyHire).trim() !== '')
    || (row.deliveryDate != null && String(row.deliveryDate).trim() !== '')
    || (row.hireage != null && String(row.hireage).trim() !== '' && Number(row.hireage) !== 0)
  )));
}

function applyPeriodTcIn(baseTcIn, periodData) {
  if (!periodData) return baseTcIn;
  const hires = (periodData.hires || []).map((row) => ({ ...EMPTY_TC_IN_HIRE, ...row }));
  const deliveryBunkers = (periodData.deliveryBunkers || []).map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }));
  const redeliveryBunkers = (periodData.redeliveryBunkers || []).map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }));
  const offHires = (periodData.offHires || []).map((row) => ({ ...EMPTY_TC_IN_OFF, ...row }));
  return {
    ...baseTcIn,
    hires: hires.length ? hires : baseTcIn.hires,
    deliveryBunkers: deliveryBunkers.length ? deliveryBunkers : baseTcIn.deliveryBunkers,
    redeliveryBunkers: redeliveryBunkers.length ? redeliveryBunkers : baseTcIn.redeliveryBunkers,
    offHires: offHires.length ? offHires : baseTcIn.offHires,
    bunkerOnOwner: periodData.bunkerOnOwner || baseTcIn.bunkerOnOwner || '',
  };
}

function normalizeCapexFields(detail = {}) {
  const calc = detail.calc || {};
  return {
    itinerary: {
      from: { ...EMPTY_ITINERARY.from, ...(detail.itinerary?.from || {}) },
      to: { ...EMPTY_ITINERARY.to, ...(detail.itinerary?.to || {}) },
    },
    itineraryExpenses: detail.itineraryExpenses?.length
      ? detail.itineraryExpenses.map((row) => ({ ...EMPTY_ITIN_EXP, ...row }))
      : [{ ...EMPTY_ITIN_EXP }],
    hirePeriods: detail.hirePeriods || [],
    otherIncome: detail.otherIncome || [],
    otherExpenses: detail.otherExpenses || [],
    offHires: detail.offHires || [],
    tcInExpenses: detail.tcInExpenses
      ? {
          ...emptyTcIn(detail, calc),
          ...detail.tcInExpenses,
          hires: detail.tcInExpenses.hires?.length
            ? detail.tcInExpenses.hires.map((row) => ({ ...EMPTY_TC_IN_HIRE, ...row }))
            : emptyTcIn(detail, calc).hires,
          deliveryBunkers: detail.tcInExpenses.deliveryBunkers?.length
            ? detail.tcInExpenses.deliveryBunkers.map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }))
            : [{ ...EMPTY_TC_IN_BUNKER }],
          redeliveryBunkers: detail.tcInExpenses.redeliveryBunkers?.length
            ? detail.tcInExpenses.redeliveryBunkers.map((row) => ({ ...EMPTY_TC_IN_BUNKER, ...row }))
            : [{ ...EMPTY_TC_IN_BUNKER }],
          offHires: detail.tcInExpenses.offHires?.length
            ? detail.tcInExpenses.offHires.map((row) => ({ ...EMPTY_TC_IN_OFF, ...row }))
            : [{ ...EMPTY_TC_IN_OFF }],
        }
      : emptyTcIn(detail, calc),
  };
}

function updateRow(list, index, patch) {
  const next = [...list];
  next[index] = { ...next[index], ...patch };
  return next;
}

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
    attachmentName: '',
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
    calc: null,
    itinerary: {
      from: { ...EMPTY_ITINERARY.from },
      to: { ...EMPTY_ITINERARY.to },
    },
    itineraryExpenses: [{ ...EMPTY_ITIN_EXP }],
    hirePeriods: [],
    otherIncome: [],
    otherExpenses: [],
    offHires: [],
    tcInExpenses: emptyTcIn(),
  };
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
  className = '',
}) {
  return (
    <Field label={label} className={className}>
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

function isSubCharterBusinessType(businessTypes, businessTypeId) {
  const match = (businessTypes || []).find((opt) => String(opt.id) === String(businessTypeId));
  const label = String(match?.name || match?.label || '').toLowerCase();
  return /in\s*\/?\s*out|sub[\s-]?charter/.test(label);
}

function formatResult(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
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

/** TC Recap add/edit/view form (Spot-style LHS accordion + RHS results). */
export default function TcFixtureFormPage({
  mode = 'add',
  overrideTcOutId,
  backHref,
}) {
  const navigate = useNavigate();
  const { tcPath } = useTcModule();
  const { tcOutId: paramTcOutId } = useParams();
  const tcOutId = overrideTcOutId || paramTcOutId;
  const [searchParams] = useSearchParams();
  const [lookups, setLookups] = useState(null);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [form, setForm] = useState(() => ({
    ...emptyForm(searchParams.get('selBType') || '2'),
    periodId: searchParams.get('periodId') || searchParams.get('periodid') || '',
  }));
  const [loading, setLoading] = useState(mode !== 'add');
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [tcInOpen, setTcInOpen] = useState(false);

  const returnToRaw = searchParams.get('returnTo') || '';
  const returnTo = (() => {
    if (!returnToRaw) return '';
    try {
      const decoded = decodeURIComponent(returnToRaw);
      if (decoded.startsWith('/internal-user/')) return appPath(decoded);
    } catch {
      /* ignore bad returnTo */
    }
    return '';
  })();

  const readOnly = mode === 'view';
  const listHref = backHref || returnTo || tcPath();
  const isDry = String(form.businessTypeId) === '3';
  const showSubCharter = isSubCharterBusinessType(businessTypes, form.businessTypeId)
    || Boolean(form.periodId);

  const itineraryExpenseTotal = useMemo(
    () => (form.itineraryExpenses || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [form.itineraryExpenses],
  );

  const dailyHireUsd = useMemo(() => {
    const hire = Number(form.hireFixPer) || 0;
    const days = Number(form.durFixPer) || 0;
    const rate = Number(form.exchangeRate);
    const exchange = Number.isFinite(rate) && rate !== 0 ? rate : 1;
    if (days > 0) return (hire * days * exchange).toFixed(2);
    return (hire * exchange).toFixed(2);
  }, [form.durFixPer, form.exchangeRate, form.hireFixPer]);

  const tcResults = useMemo(() => {
    const calc = form.calc || {};
    const totalRev = Number(calc.totalRev) || 0;
    const lessOffHire = Number(calc.lessOffHire) || 0;
    const nettTcRev = Number(calc.nettHireInvoice ?? calc.nettRev) || Math.max(totalRev - lessOffHire, 0);
    const totalExp = Number(calc.totalExp) || itineraryExpenseTotal;
    const profit = Number(calc.voyageEarn) || (totalRev - totalExp);
    const profitAdjPreTc = profit - itineraryExpenseTotal;
    return {
      totalRev: formatResult(calc.totalRev ?? totalRev),
      lessOffHire: formatResult(calc.lessOffHire ?? lessOffHire),
      nettTcRev: formatResult(nettTcRev),
      refCharterers: formatResult(calc.refCharterers),
      refOwners: formatResult(calc.refOwners),
      totalExp: formatResult(calc.totalExp ?? totalExp),
      profit: formatResult(calc.voyageEarn ?? profit),
      profitAdjPreTc: formatResult(profitAdjPreTc),
    };
  }, [form.calc, itineraryExpenseTotal]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, types] = await Promise.all([
          fetchTcLookups(),
          fetchTcBusinessTypes(form.businessTypeId),
        ]);
        if (cancelled) return;
        setLookups(data);
        setBusinessTypes(types?.businessTypes || types || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load lookups.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load lookups once on mount
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
          calc: detail.calc || null,
          ...normalizeCapexFields(detail),
        });
        if (detail?.periodId && !hasSavedTcInHires(detail.tcInExpenses)) {
          try {
            const periodTcIn = await fetchPeriodTcInDetails(detail.periodId);
            if (!cancelled && periodTcIn) {
              setForm((prev) => ({
                ...prev,
                tcInExpenses: applyPeriodTcIn(prev.tcInExpenses, periodTcIn),
              }));
            }
          } catch {
            // Keep fixture-seeded TC In if period lookup fails.
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load TC Recap.');
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
      let savedId = tcOutId;
      if (mode === 'add') {
        const created = await createTcEstimate(payload);
        savedId = created.tcOutId;
      } else {
        await updateTcEstimate(tcOutId, payload);
      }

      // Capex/itinerary/tcIn persist only via calculate endpoint — merge existing calc children.
      let existing = null;
      try {
        existing = await fetchTcEstimate(savedId);
      } catch {
        existing = null;
      }
      await saveTcCalculation(savedId, {
        calc: {
          ...(existing?.calc || form.calc || {}),
          tcCpDate: form.tcInExpenses?.cpDate || '',
          tcCpNumber: form.tcInExpenses?.contractRef || form.tcNo || '',
          tcDeliveryPort: form.tcInExpenses?.deliveryPort || form.delRangePort || '',
          tcRedeliveryPort: form.tcInExpenses?.redeliveryPort || form.reDelRange || '',
          tcFinalVendor: form.tcInExpenses?.finalVendor || '',
          tcOffHireCveMonth: form.tcInExpenses?.offHireCveMonth || '',
          tcBunkerOnOwner: form.tcInExpenses?.bunkerOnOwner || '',
          tcIlohc: form.tcInExpenses?.ilohc || '',
          awrpCost: form.tcInExpenses?.awrpCost || '',
        },
        hirePeriods: form.hirePeriods?.length ? form.hirePeriods : (existing?.hirePeriods || []),
        otherIncome: form.otherIncome?.length ? form.otherIncome : (existing?.otherIncome || []),
        otherExpenses: form.otherExpenses?.length ? form.otherExpenses : (existing?.otherExpenses || []),
        offHires: form.offHires?.length ? form.offHires : (existing?.offHires || []),
        itinerary: form.itinerary,
        itineraryExpenses: form.itineraryExpenses,
        tcInExpenses: form.tcInExpenses,
      });

      if (mode === 'add') {
        if (returnTo) {
          navigate(returnTo, { replace: true });
        } else {
          navigate(`${tcPath(`${savedId}/edit`)}?msg=0`);
        }
      } else {
        navigate(returnTo || `${tcPath()}?msg=0`);
      }
    } catch (err) {
      setError(err.message || 'Failed to save TC Recap.');
    } finally {
      setSaving(false);
    }
  };

  const patchItinerary = (side, key, value) => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      itinerary: {
        ...prev.itinerary,
        [side]: { ...prev.itinerary[side], [key]: value },
      },
    }));
  };

  const patchItinExpense = (index, patch) => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      itineraryExpenses: updateRow(prev.itineraryExpenses || [], index, patch),
    }));
  };

  const addItinExpense = () => {
    if (readOnly) return;
    setForm((prev) => ({
      ...prev,
      itineraryExpenses: [...(prev.itineraryExpenses || []), { ...EMPTY_ITIN_EXP }],
    }));
  };

  const removeItinExpense = (index) => {
    if (readOnly) return;
    setForm((prev) => {
      const rows = [...(prev.itineraryExpenses || [])];
      rows.splice(index, 1);
      return { ...prev, itineraryExpenses: rows.length ? rows : [{ ...EMPTY_ITIN_EXP }] };
    });
  };

  const handlePeriodChange = async (periodId) => {
    if (readOnly) return;
    setForm((prev) => ({ ...prev, periodId }));
    if (!periodId || hasSavedTcInHires(form.tcInExpenses)) return;
    try {
      const periodTcIn = await fetchPeriodTcInDetails(periodId);
      if (periodTcIn) {
        setForm((prev) => ({
          ...prev,
          periodId,
          tcInExpenses: applyPeriodTcIn(prev.tcInExpenses, periodTcIn),
        }));
      }
    } catch {
      // Ignore period TC In seed failures.
    }
  };

  const handleGeneratePdf = async () => {
    if (mode === 'add' || !tcOutId || pdfLoading) return;
    setPdfLoading(true);
    setError('');
    try {
      await downloadTcEstimatePdf(tcOutId);
    } catch (err) {
      setError(err.message || 'Failed to generate TC Recap PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const renderBunkerTable = (kind, label) => (
    <div className={styles.bunkerBlock}>
      <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst}`}>{label}</div>
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

  const businessTypeOptions = (Array.isArray(businessTypes) ? businessTypes : []).map((opt) => ({
    id: String(opt.id),
    name: opt.name || opt.label || String(opt.id),
  }));

  return (
    <div className={`zafira-page ${styles.page}`}>
      <TcFormHeaderActions
        listHref={listHref}
        disabled={saving || loading}
        onGeneratePdf={mode !== 'add' ? handleGeneratePdf : undefined}
        pdfLoading={pdfLoading}
        showTcInRecap={showSubCharter && !readOnly}
        onTcInRecap={() => setTcInOpen(true)}
      />
      {loading ? <LoadingOverlay active label="Loading TC Recap…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <form onSubmit={handleSubmit}>
          <div className={`${styles.estLayout} ${readOnly ? styles.viewModeLock : ''}`.trim()}>
            <div className={styles.estLhs}>
              <CollapsiblePanel title="Recap Identifiers" defaultOpen>
                <div className={`${styles.denseGrid} ${styles.dense7}`}>
                  <Field label="Business Type">
                    <CardSelect
                      options={businessTypeOptions}
                      value={form.businessTypeId}
                      onChange={(v) => setField('businessTypeId', v)}
                      placeholder="Select business type"
                      ariaLabel="Business type"
                    />
                    {showSubCharter ? (
                      <div className={styles.subCharterBadge} aria-live="polite">
                        Sub-Charter
                      </div>
                    ) : null}
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
                  <DateField label="CP Date" value={form.cpDate} onChange={(v) => setField('cpDate', v)} />
                  <TextInput
                    label="TC No."
                    value={form.tcNo}
                    onChange={(v) => setField('tcNo', v)}
                    readOnly={mode === 'edit' || readOnly}
                  />
                  <TextInput label="Est No." value={mode === 'add' ? 'Auto' : (form.tcNo || '')} readOnly />
                  <Field label="Chartering Team">
                    <CardSelect
                      options={lookups?.charteringTeams || []}
                      value={form.charteringTeam}
                      onChange={(v) => setField('charteringTeam', v)}
                      placeholder="Select chartering team"
                      ariaLabel="Chartering team"
                    />
                  </Field>
                  <Field label="Chartering PIC">
                    <CardSelect
                      options={lookups?.charteringPics || []}
                      value={form.charteringPic1}
                      onChange={(v) => setField('charteringPic1', v)}
                      placeholder="Select PIC"
                      ariaLabel="Chartering PIC"
                    />
                  </Field>
                  <Field label="Ops PIC">
                    <CardSelect
                      options={lookups?.vendors || []}
                      value={form.charOperation}
                      onChange={(v) => setField('charOperation', v)}
                      placeholder="Select"
                      ariaLabel="Ops PIC"
                    />
                  </Field>
                  <Field label="Link Period CTT">
                    <CardSelect
                      options={lookups?.periodContracts || []}
                      value={form.periodId}
                      onChange={handlePeriodChange}
                      placeholder="Select contract"
                      ariaLabel="Period contract"
                    />
                  </Field>
                </div>
                <input type="hidden" value={form.fixtureType || '1'} readOnly />
              </CollapsiblePanel>

              <CollapsiblePanel title="CP Information" defaultOpen={false}>
                <div className={styles.denseGrid}>
                  <Field label="CP Type">
                    <CardSelect
                      options={lookups?.cpTypes || []}
                      value={form.cpType}
                      onChange={(v) => setField('cpType', v)}
                      placeholder="Select CP type"
                      ariaLabel="CP type"
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
                  <Field label="Charterers">
                    <CardSelect
                      options={lookups?.charterers || []}
                      value={form.charterer}
                      onChange={(v) => setField('charterer', v)}
                      placeholder="Select charterer"
                      ariaLabel="Charterer"
                    />
                  </Field>
                  <Field label="Charterers' Address" className={styles.span2}>
                    <input
                      value={form.charOperAdd || ''}
                      onChange={(e) => setField('charOperAdd', e.target.value)}
                      readOnly
                      className={styles.inputReadonly}
                      placeholder="Display from master data"
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
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel title="Vessel Particulars" defaultOpen={false}>
                <div className={`${styles.denseGrid} ${styles.dense9}`}>
                  <TextInput label="Master's Name" value={form.mastersName} onChange={(v) => setField('mastersName', v)} />
                  <TextInput label="Build Yard" value={form.buildYard} readOnly />
                  <TextInput label="Year Built" value={form.yearBuild} readOnly />
                  <TextInput label="Flag" value={form.flag1 || form.flag} readOnly />
                  <TextInput label="Port of Registry" value={form.portOfReg} readOnly />
                  <TextInput label="IMO No." value={form.imoNo} readOnly />
                  <TextInput label="Class ID" value={form.classId} readOnly />
                  <TextInput label="Last Special Survey" value={form.lastSpSurvey} readOnly />
                  <TextInput label="Last DD" value={form.lastDd} readOnly />
                  <TextInput label="Owners P&I" value={form.ownersPi} readOnly />
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
              </CollapsiblePanel>

              <CollapsiblePanel title="TC Details" defaultOpen>
                <div className={styles.denseGrid}>
                  <Field label="Laycan From/To" className={styles.span2}>
                    <div className={styles.dateRangePair}>
                      <DmyDateInput
                        value={form.laycanFrom || ''}
                        onChange={(v) => setField('laycanFrom', v)}
                        enableTime
                        disabled={readOnly}
                      />
                      <DmyDateInput
                        value={form.laycanTo || ''}
                        onChange={(v) => setField('laycanTo', v)}
                        enableTime
                        disabled={readOnly}
                      />
                    </div>
                  </Field>
                  <Field label="Hire Currency">
                    <CardSelect
                      options={lookups?.currencies || []}
                      value={form.exchangeCurrency}
                      onChange={(v) => setField('exchangeCurrency', v)}
                      placeholder="Currency"
                      ariaLabel="Hire currency"
                    />
                  </Field>
                  <TextInput label="X-rate to USD" value={form.exchangeRate} onChange={(v) => setField('exchangeRate', v)} />
                  <TextInput label="Del Port/Range" value={form.delRangePort} onChange={(v) => setField('delRangePort', v)} />
                  <TextInput label="Re-Del Port/Range" value={form.reDelRange} onChange={(v) => setField('reDelRange', v)} />
                  <TextInput label="CVE/Month ($)" value={form.cveMonth} onChange={(v) => setField('cveMonth', v)} />
                  <TextInput label="ILOHC" value={form.ilohcUsd} onChange={(v) => setField('ilohcUsd', v)} />
                  <TextInput label="AD Comm (%)" value={form.addComm} onChange={(v) => setField('addComm', v)} />
                  <TextInput label="Brokerage (%)" value={form.brokerComm} onChange={(v) => setField('brokerComm', v)} />
                  <Field label="Brokerage Paid By">
                    <CardSelect
                      options={lookups?.payableBy || []}
                      value={form.broCommPayable}
                      onChange={(v) => setField('broCommPayable', v)}
                      placeholder="Select"
                      ariaLabel="Brokerage paid by"
                    />
                  </Field>
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel title="Trip Details" defaultOpen>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst}`}>Trip Schedule</div>
                <div className={styles.miniTableWrap}>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr>
                        <th>Del Date (From)</th>
                        <th>Del Date (To)</th>
                        <th>Days</th>
                        <th>Hire ($/day)</th>
                        <th>Hire Amt ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <DmyDateInput
                            value={form.delDate || ''}
                            onChange={(v) => setField('delDate', v)}
                            enableTime
                            disabled={readOnly}
                          />
                        </td>
                        <td>
                          <DmyDateInput
                            value={form.reDelDate || ''}
                            onChange={(v) => setField('reDelDate', v)}
                            enableTime
                            disabled={readOnly}
                          />
                        </td>
                        <td>
                          <input
                            value={form.durFixPer || ''}
                            onChange={(e) => setField('durFixPer', e.target.value)}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input
                            value={form.hireFixPer || ''}
                            onChange={(e) => setField('hireFixPer', e.target.value)}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                            placeholder="0.00"
                          />
                        </td>
                        <td>
                          <input value={dailyHireUsd} readOnly className={styles.inputReadonly} placeholder="0.00" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className={styles.subBlockLabel}>Additional Trip Fields</div>
                <div className={styles.denseGrid}>
                  <TextInput label="Trip TC" value={form.tripTc} onChange={(v) => setField('tripTc', v)} />
                  <TextInput label="Period" value={form.period} onChange={(v) => setField('period', v)} />
                  <TextInput label="No. of Trips" value={form.noOfTrip} onChange={(v) => setField('noOfTrip', v)} />
                  <TextInput label="Duration Optional Period" value={form.durOptPer} onChange={(v) => setField('durOptPer', v)} />
                  <TextInput label="Commencement Optional Period" value={form.commOptPer} onChange={(v) => setField('commOptPer', v)} />
                  <TextInput label="Hire Optional Period" value={form.hireOptPer} onChange={(v) => setField('hireOptPer', v)} />
                  <TextInput label="Fuel Specs" value={form.fuelSpecs} onChange={(v) => setField('fuelSpecs', v)} />
                  {isDry ? (
                    <>
                      <TextInput label="Supercargo and meals (USD)" value={form.supercargoMeals} onChange={(v) => setField('supercargoMeals', v)} />
                      <TextInput label="Hold Cleaning Intermediate (USD)" value={form.holdCleanInter} onChange={(v) => setField('holdCleanInter', v)} />
                      <TextInput label="ILOHC - Remarks from CP" value={form.ilohcRemarks} onChange={(v) => setField('ilohcRemarks', v)} />
                    </>
                  ) : null}
                  <TextInput label="Laycan Narrowing" value={form.laycanNarr} onChange={(v) => setField('laycanNarr', v)} />
                  <DateField label="Date" value={form.tcDate} onChange={(v) => setField('tcDate', v)} />
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel title="Bunkers" defaultOpen={false}>
                {renderBunkerTable('deliveryBunkers', 'Bunker Grades → Delivery')}
                {renderBunkerTable('redeliveryBunkers', 'Bunker Grades → Re-Delivery')}
              </CollapsiblePanel>

              <CollapsiblePanel title="TC Terms for Voyage" defaultOpen={false}>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst}`}>Sea Passage</div>
                <div className={styles.denseGrid}>
                  <TextInput label="Wind Force" value={form.windForce} onChange={(v) => setField('windForce', v)} />
                  <TextInput label="Speed Laden (kts)" value={form.speedLaden} onChange={(v) => setField('speedLaden', v)} />
                  <TextInput label="Speed Ballast (kts)" value={form.speedBallast} onChange={(v) => setField('speedBallast', v)} />
                  <TextInput label="CP Speed" value={form.cpSpeed} onChange={(v) => setField('cpSpeed', v)} />
                  <TextInput label="FO Cons Laden (MT/day)" value={form.foConsLaden} onChange={(v) => setField('foConsLaden', v)} />
                  <TextInput label="DO Cons Laden (MT/day)" value={form.doConsLaden} onChange={(v) => setField('doConsLaden', v)} />
                  <TextInput label="FO Cons Ballast (MT/day)" value={form.foConsBallast} onChange={(v) => setField('foConsBallast', v)} />
                  <TextInput label="DO Cons Ballast (MT/day)" value={form.doConsBallast} onChange={(v) => setField('doConsBallast', v)} />
                </div>
                <div className={styles.subBlockLabel}>Port</div>
                <div className={styles.denseGrid}>
                  <TextInput label="FO Cons Ldg (MT/day)" value={form.foConsLdg} onChange={(v) => setField('foConsLdg', v)} />
                  <TextInput label="DO Cons Ldg (MT/day)" value={form.doConsLdg} onChange={(v) => setField('doConsLdg', v)} />
                  <TextInput label="FO Cons Disch (MT/day)" value={form.foConsDisch} onChange={(v) => setField('foConsDisch', v)} />
                  <TextInput label="DO Cons Disch (MT/day)" value={form.doConsDisch} onChange={(v) => setField('doConsDisch', v)} />
                  <TextInput label="FO Cons Idle (MT/day)" value={form.foConsIdle} onChange={(v) => setField('foConsIdle', v)} />
                  <TextInput label="DO Cons Idle (MT/day)" value={form.doConsIdle} onChange={(v) => setField('doConsIdle', v)} />
                  <TextInput label="Load Rate (MT/day)" value={form.loadRate} onChange={(v) => setField('loadRate', v)} />
                  <TextInput label="Disch Rate (MT/day)" value={form.dischRate} onChange={(v) => setField('dischRate', v)} />
                  <Field label="Owner's Banking Details">
                    <CardSelect
                      options={lookups?.bankingDetails || []}
                      value={form.ownersBankDet}
                      onChange={(v) => setField('ownersBankDet', v)}
                      placeholder="Select banking details"
                      ariaLabel="Banking details"
                    />
                  </Field>
                  <TextInput label="Document Created By" value={form.docCreatBy} readOnly />
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel title="TC Expenses" defaultOpen={false}>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst}`}>TC Expense</div>
                <div className={`${styles.tcInButtonRow} ${styles.viewModeAllow}`}>
                  <button
                    type="button"
                    className={`${styles.addRowBtn} ${showSubCharter ? styles.addRowBtnSubCharter : ''}`}
                    onClick={() => setTcInOpen(true)}
                  >
                    {showSubCharter ? '+ Add Sub-Charter Expense' : '+ TC In Expenses'}
                  </button>
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel title="Pre-TC Details" defaultOpen={false}>
                <div className={`${styles.subBlockLabel} ${styles.subBlockLabelFirst}`}>Itinerary</div>
                <div className={styles.miniTableWrap}>
                <table className={styles.miniTable}>
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>Date</th>
                      <th>Notes</th>
                      <th>To</th>
                      <th>Date</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <input
                          value={form.itinerary?.from?.place || ''}
                          onChange={(e) => patchItinerary('from', 'place', e.target.value)}
                          readOnly={readOnly}
                          className={readOnly ? styles.inputReadonly : undefined}
                        />
                      </td>
                      <td>
                        <DmyDateInput
                          value={form.itinerary?.from?.date || ''}
                          onChange={(v) => patchItinerary('from', 'date', v)}
                          disabled={readOnly}
                        />
                      </td>
                      <td>
                        <input
                          value={form.itinerary?.from?.notes || ''}
                          onChange={(e) => patchItinerary('from', 'notes', e.target.value)}
                          readOnly={readOnly}
                          className={readOnly ? styles.inputReadonly : undefined}
                        />
                      </td>
                      <td>
                        <input
                          value={form.itinerary?.to?.place || ''}
                          onChange={(e) => patchItinerary('to', 'place', e.target.value)}
                          readOnly={readOnly}
                          className={readOnly ? styles.inputReadonly : undefined}
                        />
                      </td>
                      <td>
                        <DmyDateInput
                          value={form.itinerary?.to?.date || ''}
                          onChange={(v) => patchItinerary('to', 'date', v)}
                          disabled={readOnly}
                        />
                      </td>
                      <td>
                        <input
                          value={form.itinerary?.to?.notes || ''}
                          onChange={(e) => patchItinerary('to', 'notes', e.target.value)}
                          readOnly={readOnly}
                          className={readOnly ? styles.inputReadonly : undefined}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>

                <div className={styles.subBlockLabel}>Expenses</div>
                <div className={styles.miniTableWrap}>
                <table className={styles.miniTable}>
                  <thead>
                    <tr>
                      <th />
                      <th>Expense Type</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(form.itineraryExpenses || []).map((row, index) => (
                      <tr key={`itin-exp-${index}`}>
                        <td>
                          {!readOnly ? (
                            <button
                              type="button"
                              className={`${styles.linkBtn} ${styles.linkBtnDanger}`}
                              onClick={() => removeItinExpense(index)}
                            >
                              ×
                            </button>
                          ) : (
                            index + 1
                          )}
                        </td>
                        <td>
                          <input
                            value={row.expenseType || ''}
                            onChange={(e) => patchItinExpense(index, { expenseType: e.target.value })}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                          />
                        </td>
                        <td>
                          <input
                            value={row.description || ''}
                            onChange={(e) => patchItinExpense(index, { description: e.target.value })}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                          />
                        </td>
                        <td>
                          <input
                            value={row.amount || ''}
                            onChange={(e) => patchItinExpense(index, { amount: e.target.value })}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                          />
                        </td>
                        <td>
                          <input
                            value={row.notes || ''}
                            onChange={(e) => patchItinExpense(index, { notes: e.target.value })}
                            readOnly={readOnly}
                            className={readOnly ? styles.inputReadonly : undefined}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Total (USD)</td>
                      <td>{itineraryExpenseTotal.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
                </div>

                {!readOnly ? (
                  <Button variant="outline" label="Add Expense" onClick={addItinExpense} />
                ) : null}
              </CollapsiblePanel>

              <CollapsiblePanel title="Additional Info and Documents" defaultOpen={false}>
                <div className={styles.denseGrid}>
                  <Field label="Addnl Info" className={styles.span2}>
                    <input
                      value={form.additInform || ''}
                      onChange={(e) => setField('additInform', e.target.value)}
                      placeholder="Description"
                      readOnly={readOnly}
                      className={readOnly ? styles.inputReadonly : undefined}
                    />
                  </Field>
                </div>
                <label className={`${styles.dropzone} ${readOnly ? styles.inputReadonly : ''}`.trim()}>
                  <div className={styles.dropzoneIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 16V4" />
                      <path d="M6 10l6-6 6 6" />
                      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                    </svg>
                  </div>
                  <div className={styles.dropzoneText}>
                    <b>Drag &amp; drop files here</b>, or click to browse
                    {form.attachmentName ? <span className={styles.dropzoneFile}> — {form.attachmentName}</span> : null}
                  </div>
                  {!readOnly ? (
                    <input
                      type="file"
                      className={styles.dropzoneInput}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        setField('attachmentName', file?.name || '');
                      }}
                    />
                  ) : null}
                </label>
              </CollapsiblePanel>
            </div>

            <aside className={styles.estRhs}>
              <div className={styles.resultsBlock}>
                <div className={styles.resultsHead}>TC Revenue</div>
                <div className={styles.resultsBody}>
                  <div className={`${styles.resRow} ${styles.resRowAccent}`}>
                    <span className={styles.resRowLabel}>Total TC Rev</span>
                    <span className={styles.resRowVal}>{tcResults.totalRev}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Less Off Hire (Incl. Bunkers)</span>
                    <span className={styles.resRowVal}>{tcResults.lessOffHire}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Nett TC Rev</span>
                    <span className={styles.resRowVal}>{tcResults.nettTcRev}</span>
                  </div>
                </div>
              </div>

              <div className={styles.resultsBlock}>
                <div className={styles.resultsHead}>TC Expenses</div>
                <div className={styles.resultsBody}>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Ref Charterers</span>
                    <span className={styles.resRowVal}>{tcResults.refCharterers}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Ref Owners</span>
                    <span className={styles.resRowVal}>{tcResults.refOwners}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Total Exp (Incl. Pre TC)</span>
                    <span className={styles.resRowVal}>{tcResults.totalExp}</span>
                  </div>
                </div>
              </div>

              <div className={styles.resultsBlock}>
                <div className={styles.resultsHead}>TC P&amp;L</div>
                <div className={styles.resultsBody}>
                  <div className={`${styles.resRow} ${styles.resRowAccent}`}>
                    <span className={styles.resRowLabel}>Profit</span>
                    <span className={styles.resRowVal}>{tcResults.profit}</span>
                  </div>
                  <div className={styles.resRow}>
                    <span className={styles.resRowLabel}>Profit (Adj. Pre TC)</span>
                    <span className={styles.resRowVal}>{tcResults.profitAdjPreTc}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className={`${styles.formFooter} ${styles.viewModeAllow}`}>
            <Link
              to={listHref}
              className={styles.btnCancel}
              onClick={(e) => {
                if (saving) e.preventDefault();
              }}
            >
              <CancelIcon />
              Cancel
            </Link>
            {mode === 'edit' ? (
              <Link
                to={tcPath(`${tcOutId}/calculate`)}
                className={styles.btnCalculate}
                aria-disabled={saving || undefined}
              >
                Calculate
              </Link>
            ) : null}
            {!readOnly ? (
              <button type="submit" className={styles.btnSave} disabled={saving}>
                <img src={saveIcon} alt="" className={styles.btnSaveIcon} />
                {saving ? 'Saving…' : 'Save'}
              </button>
            ) : null}
          </div>
      </form>

      <TcInExpensesModal
        open={tcInOpen}
        value={form.tcInExpenses}
        detail={form}
        lookups={lookups}
        readOnly={readOnly}
        onClose={() => setTcInOpen(false)}
        onApply={(next) => {
          setForm((prev) => ({ ...prev, tcInExpenses: next }));
          setTcInOpen(false);
        }}
      />
    </div>
  );
}

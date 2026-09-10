import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DmyDateInput, LoadingOverlay, useAlert, useConfirm } from '@bainbridge/shared-ui';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import { fetchCommercialParameters } from '../../../services/commercialParameters.js';
import { useCoaModule } from '../../../hooks/useCoaModule.js';
import { useCargoReletModule } from '../../../hooks/useCargoReletModule.js';
import { isCargoReletPath } from '../../../constants/cargoReletModule.js';
import {
  createCargoRelet,
  fetchCargoRelet,
  fetchCoa,
  fetchCoaLookups,
  fetchNextCargoReletNo,
  fetchRunningCoas,
  updateCargoRelet,
} from '../../../services/coas.js';
import {
  createStandaloneCargoRelet,
  fetchNextStandaloneCargoReletNo,
  fetchStandaloneCargoRelet,
  updateStandaloneCargoRelet,
} from '../../../services/cargoRelets.js';
import PortSearchSelect from '../period-contract/PortSearchSelect.jsx';
import VesselSearchSelect from '../sopf/VesselSearchSelect.jsx';
import { fetchVesselEstimatePrefill } from '../../../services/estimateDetail.js';
import { calcCargoIntake, calcCargoReletTotals } from './cargoReletTotals.js';
import {
  focusCargoReletValidationField,
  validateCargoReletForm,
} from './cargoReletValidation.js';
import CoaCardSelect from './CoaCardSelect.jsx';
import CoaFormHeaderActions from './CoaFormHeaderActions.jsx';
import styles from './CargoReletFormPage.module.css';

const ESTIMATE_TAB = { id: 'estimate', label: 'Cargo Relet: Estimate' };
const MIRROR_ROW_KEYS = {
  partiesIn: 'partiesOut',
  loadPortsIn: 'loadPortsOut',
  dischargePortsIn: 'dischargePortsOut',
};

const FREIGHT_MIRROR = {
  bafUsd: 'bafUsdOut',
  addCom: 'addComOut',
  brokerage: 'brokerageOut',
  demRate: 'demRateOut',
};

const STANDALONE_LIVE_KEYS = new Set([
  'cargoQty',
  'freightUsd',
  'bafUsd',
  'contractFoPrice',
  'addCom',
  'brokerage',
  'freightUsdOut',
  'bafUsdOut',
  'currentFoPrice',
  'addComOut',
  'brokerageOut',
]);

async function nextReletNo({ standalone, businessTypeId, coaId }) {
  const params = { selBType: businessTypeId || '2', businessTypeId: businessTypeId || '2' };
  if (coaId) params.coaId = coaId;
  const data = standalone
    ? await fetchNextStandaloneCargoReletNo(params)
    : await fetchNextCargoReletNo(params);
  return data?.reletNo || `${String(businessTypeId) === '3' ? 'D' : String(businessTypeId) === '1' ? 'G' : 'T'}1`;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ReletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}

function CircleDeleteButton({ onClick, title = 'Remove' }) {
  return (
    <button
      type="button"
      className={`${styles.circleBtn} ${styles.circleBtnDel}`}
      title={title}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M18 6 6 18" />
        <path d="M6 6l12 12" />
      </svg>
    </button>
  );
}

function PendingFileRow({ file, onRemove }) {
  const href = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(href), [href]);
  return (
    <div className={styles.fileRow}>
      <a
        className={styles.fileName}
        href={href}
        download={file.name}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        {file.name}
      </a>
      <span className={styles.filePending}>(pending)</span>
      <CircleDeleteButton onClick={onRemove} />
    </div>
  );
}

function EstimateCardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10.01" />
      <line x1="12" y1="10" x2="12" y2="10.01" />
      <line x1="16" y1="10" x2="16" y2="10.01" />
      <line x1="8" y1="14" x2="8" y2="14.01" />
      <line x1="12" y1="14" x2="12" y2="14.01" />
      <line x1="16" y1="14" x2="16" y2="14.01" />
      <line x1="8" y1="18" x2="8" y2="18.01" />
      <line x1="12" y1="18" x2="12" y2="18.01" />
      <line x1="16" y1="18" x2="16" y2="18.01" />
    </svg>
  );
}

function PanelArrow({ down = true }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {down ? (
        <>
          <path d="M12 5v14" />
          <path d="M19 12l-7 7-7-7" />
        </>
      ) : (
        <>
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </>
      )}
    </svg>
  );
}

function todayDmy() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getFullYear()}`;
}

function partyRow() {
  return { charterer: '', owner: '', broker: '' };
}

function portRow() {
  return { portId: '', portName: '', comments: '' };
}

function emptyCommercial() {
  return {
    capType: '1',
    dwtSummer: '',
    grainCap: '',
    baleCap: '',
    stowageFactor: '',
    loadable: '',
    gnrt: '',
    loa: '',
    builtYear: '',
    beam: '',
    tpc: '',
    ballastFullSpeed: '',
    ballastServiceSpeed: '',
    ballastEcoSpeed: '',
    ladenFullSpeed: '',
    ladenServiceSpeed: '',
    ladenEcoSpeed: '',
    foBallastFull: '',
    foBallastService: '',
    foBallastEco: '',
    foLadenFull: '',
    foLadenService: '',
    foLadenEco: '',
    foPortIdle: '',
    foPortWorking: '',
    doBallastFull: '',
    doBallastService: '',
    doBallastEco: '',
    doLadenFull: '',
    doLadenService: '',
    doLadenEco: '',
    doPortIdle: '',
    doPortWorking: '',
    summerDwtMt: '',
    summerDwtLt: '',
    summerDraftM: '',
    summerDraftFt: '',
    tpiMt: '',
    tpiLt: '',
    tpcMt: '',
    tpcLt: '',
    constantsMt: '',
    constantsLt: '',
    grainCapCbm: '',
    grainCapCft: '',
  };
}

function emptyForm(businessTypeId = '2', coaId = '') {
  return {
    coaId,
    coaIdentity: '',
    openCargoId: '',
    updateStatus: '1',
    vesselImoId: '',
    vesselName: '',
    cargoId: '',
    transDate: todayDmy(),
    reletNo: '',
    reletName: '',
    vesselType: '',
    cargoQty: '',
    currency: 'USD',
    cargoPlanDetails: '',
    cargoName: '',
    freightUsd: '',
    bafUsd: '',
    freightFrom: '',
    freightTo: '',
    addCom: '',
    brokerage: '',
    demRate: '',
    desRate: '',
    contractFoPrice: '',
    currentFoPrice: '',
    freightUsdOut: '',
    bafUsdOut: '',
    freightFromOut: '',
    freightToOut: '',
    addComOut: '',
    brokerageOut: '',
    demRateOut: '',
    desRateOut: '',
    paymentClause: '',
    bunkerClause: '',
    paymentClauseOut: '',
    bunkerClauseOut: '',
    freightAmt: '',
    bunkerSurchargeAmt: '',
    demmurageAmt: '',
    despatchAmt: '',
    addCommAmt: '',
    brokerageAmt: '',
    totalAmt: '',
    profit: '',
    bunkerDiff: '',
    effectiveFrt: '',
    effectiveFrtOut: '',
    freightAmtOut: '',
    bunkerSurchargeAmtOut: '',
    demmurageAmtOut: '',
    despatchAmtOut: '',
    addCommAmtOut: '',
    brokerageAmtOut: '',
    totalAmtOut: '',
    attachmentName: '',
    coaRef: '',
    loadportAgent: '',
    loadportRemarks: '',
    disportAgent: '',
    disportRemarks: '',
    notices: '',
    dA: '',
    extraInsurance: '',
    minTerm: '',
    spclComments: '',
    nomProc: '',
    coaRefOut: '',
    loadportAgentOut: '',
    loadportRemarksOut: '',
    disportAgentOut: '',
    disportRemarksOut: '',
    noticesOut: '',
    dAOut: '',
    extraInsuranceOut: '',
    minTermOut: '',
    spclCommentsOut: '',
    nomProcOut: '',
    plannedCargoQty: '',
    shipperCp: '',
    chartererCp: '',
    ownerCp: '',
    receiverCp: '',
    cargoCp: '',
    toleranceCp: '',
    baseFreightCp: '',
    planningTypeCp: '',
    coaDateCp: '',
    basinCp: '',
    bunkerHedgeCp: '',
    loadPortCp: '',
    loadPortCpName: '',
    dischargePortCp: '',
    dischargePortCpName: '',
    laycanStartCp: '',
    laycanFinishCp: '',
    cargoReletVoyageCp: '',
    nomClauseCp: '',
    remarksCp: '',
    allowedDraftM: '',
    bunkerRobMt: '',
    cargoIntakeMt: '',
    sfCbmMt: '',
    sfCbftMt: '',
    cargoLoadableMt: '',
    businessTypeId,
    partiesIn: [partyRow()],
    partiesOut: [partyRow()],
    loadPortsIn: [portRow()],
    dischargePortsIn: [portRow()],
    loadPortsOut: [portRow()],
    dischargePortsOut: [portRow()],
    ...emptyCommercial(),
  };
}

function withPortRows(rows) {
  return (rows?.length ? rows : [portRow()]).map((row) => ({
    portId: row.portId || '',
    portName: row.portName || '',
    comments: row.comments || '',
  }));
}

function mapVesselCommercial(data) {
  if (!data) return {};
  const speed = data.speed || {};
  const main = data.main || {};
  const vessel = data.vessel || {};
  const atSea = data.bunkersAtSea || [];
  const inPort = data.bunkersInPort || [];
  const fo = atSea[0] || {};
  const diesel = atSea[1] || {};
  const foPort = inPort[0] || {};
  const doPort = inPort[1] || {};
  return {
    vesselType: vessel.type || '',
    dwtSummer: main.dwt || vessel.dwt || '',
    tpc: main.tpc || vessel.tpc || '',
    ballastFullSpeed: speed.ballastFull || '',
    ballastServiceSpeed: speed.ballastService || '',
    ballastEcoSpeed: speed.ballastEco || '',
    ladenFullSpeed: speed.ladenFull || '',
    ladenServiceSpeed: speed.ladenService || '',
    ladenEcoSpeed: speed.ladenEco || '',
    foBallastFull: fo.ballastFull || '',
    foBallastService: fo.ballastService || '',
    foBallastEco: fo.ballastEco || '',
    foLadenFull: fo.ladenFull || '',
    foLadenService: fo.ladenService || '',
    foLadenEco: fo.ladenEco || '',
    foPortIdle: foPort.idleBallast || foPort.idleLaden || '',
    foPortWorking: foPort.workingLp || foPort.workingDp || '',
    doBallastFull: diesel.ballastFull || '',
    doBallastService: diesel.ballastService || '',
    doBallastEco: diesel.ballastEco || '',
    doLadenFull: diesel.ladenFull || '',
    doLadenService: diesel.ladenService || '',
    doLadenEco: diesel.ladenEco || '',
    doPortIdle: doPort.idleBallast || doPort.idleLaden || '',
    doPortWorking: doPort.workingLp || doPort.workingDp || '',
    summerDwtMt: main.dwt || vessel.dwt || '',
    summerDraftM: main.draft || vessel.draft || '',
    tpcMt: main.tpc || vessel.tpc || '',
  };
}

function Field({ id, label, children, wide = false, className = '', required = false }) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ''} ${className}`.trim()}>
      <label htmlFor={id}>
        {label}
        {required ? <span className={styles.requiredMark}> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function MetaField({ id, label, children, grow = false, className = '' }) {
  return (
    <div className={`${styles.metaField} ${grow ? styles.metaFieldGrow : ''} ${className}`.trim()}>
      <label className={styles.metaLabel} htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export default function CargoReletFormPage({ mode = 'edit' }) {
  const { fcaId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { coaPath } = useCoaModule();
  const { cargoReletPath } = useCargoReletModule();
  const standalone = isCargoReletPath(pathname);
  const alert = useAlert();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const isAdd = mode === 'add' || !fcaId;
  const viewOnly = searchParams.get('view') === '1';
  const fromRunning = searchParams.get('from') === 'running';
  const lockedCoaId = searchParams.get('coaId') || '';
  const [tab, setTab] = useState(ESTIMATE_TAB.id);
  const [lookups, setLookups] = useState(null);
  const [coaOptions, setCoaOptions] = useState([]);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [form, setForm] = useState(() => emptyForm(
    searchParams.get('selBType') || '2',
    lockedCoaId,
  ));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dropActive, setDropActive] = useState(false);
  const attachInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const bType = searchParams.get('selBType') || '2';
        const queryCoaId = searchParams.get('coaId') || '';
        const [lookupData, types, coas] = await Promise.all([
          fetchCoaLookups(),
          fetchVcBusinessTypes(bType),
          fetchRunningCoas({ selBType: bType, status: '1', page: 1, pageSize: 200 }),
        ]);
        if (cancelled) return;
        setLookups(lookupData);
        setBusinessTypes(types);
        setCoaOptions((coas.records || []).map((row) => ({
          id: String(row.coaId),
          name: `${row.coaIdentity} / ${row.coaNo}`,
        })));

        if (!isAdd) {
          const detail = standalone
            ? await fetchStandaloneCargoRelet(fcaId)
            : await fetchCargoRelet(fcaId);
          if (cancelled) return;
          if (!detail) throw new Error('Cargo relet not found.');
          const loaded = {
            ...emptyForm(detail.businessTypeId),
            ...detail,
            partiesIn: detail.partiesIn?.length ? detail.partiesIn : [partyRow()],
            partiesOut: detail.partiesOut?.length ? detail.partiesOut : [partyRow()],
            loadPortsIn: withPortRows(detail.loadPortsIn),
            dischargePortsIn: withPortRows(detail.dischargePortsIn),
            loadPortsOut: withPortRows(detail.loadPortsOut),
            dischargePortsOut: withPortRows(detail.dischargePortsOut),
          };
          setForm({
            ...loaded,
            ...calcCargoReletTotals(loaded, { standalone }),
          });
          return;
        }

        const next = emptyForm(bType, queryCoaId);
        if (standalone) {
          next.reletNo = await nextReletNo({
            standalone: true,
            businessTypeId: bType,
          });
          next.reletName = next.reletNo;
        }
        const replicateFrom = searchParams.get('replicateFrom') || '';
        if (replicateFrom) {
          const source = standalone
            ? await fetchStandaloneCargoRelet(replicateFrom)
            : await fetchCargoRelet(replicateFrom);
          if (cancelled) return;
          if (source) {
            const sequentialNo = await nextReletNo({
              standalone,
              businessTypeId: source.businessTypeId || bType,
              coaId: !standalone ? (queryCoaId || source.coaId || '') : '',
            });
            Object.assign(next, {
              ...source,
              fcaId: undefined,
              reletNo: sequentialNo,
              reletName: sequentialNo,
              updateStatus: '1',
              partiesIn: source.partiesIn?.length ? source.partiesIn : [partyRow()],
              partiesOut: source.partiesOut?.length ? source.partiesOut : [partyRow()],
              loadPortsIn: withPortRows(source.loadPortsIn),
              dischargePortsIn: withPortRows(source.dischargePortsIn),
              loadPortsOut: withPortRows(source.loadPortsOut),
              dischargePortsOut: withPortRows(source.dischargePortsOut),
            });
            if (!standalone && queryCoaId) {
              next.coaId = queryCoaId;
            }
          }
        } else if (queryCoaId) {
          try {
            const coa = await fetchCoa(queryCoaId);
            if (cancelled) return;
            next.coaId = queryCoaId;
            next.coaIdentity = coa?.coaIdentity || '';
            next.currency = coa?.currency || 'USD';
            next.bafUsd = coa?.bafAmt || '';
            next.contractFoPrice = coa?.foPrice || '';
            next.coaDateCp = coa?.coaDate || '';
          } catch {
            next.coaId = queryCoaId;
          }
          if (!next.reletNo) {
            next.reletNo = await nextReletNo({
              standalone: false,
              businessTypeId: bType,
              coaId: queryCoaId,
            });
            next.reletName = next.reletNo;
          }
        }
        if (cancelled) return;
        setForm(standalone ? { ...next, ...calcCargoReletTotals(next, { standalone: true }) } : next);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load cargo relet form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fcaId, isAdd, searchParams, standalone]);

  const cargoOptions = useMemo(() => {
    const typeId = String(form.businessTypeId || '');
    return (lookups?.cargos || [])
      .filter((item) => {
        const itemType = String(item.materialTypeId || '');
        return !itemType || itemType === typeId;
      })
      .map((item) => ({ id: String(item.id), name: item.name }))
      .filter((item) => item.id && item.name);
  }, [form.businessTypeId, lookups]);

  const cargoSelectOptions = useMemo(() => {
    const selectedId = String(form.cargoId || '');
    if (!selectedId || cargoOptions.some((item) => item.id === selectedId)) return cargoOptions;
    return [
      { id: selectedId, name: form.cargoName || selectedId },
      ...cargoOptions,
    ];
  }, [cargoOptions, form.cargoId, form.cargoName]);

  const vendors = useMemo(() => {
    const map = new Map();
    for (const list of [lookups?.charterers, lookups?.owners, lookups?.brokers]) {
      for (const item of list || []) map.set(item.id, item);
    }
    return [...map.values()];
  }, [lookups]);

  const cargoTypeLabel = useMemo(() => {
    if (standalone) {
      const cargos = lookups?.cargos || [];
      const match = cargos.find((item) => {
        const name = String(item.name || '').toLowerCase();
        const typed = String(form.cargoName || '').toLowerCase().trim();
        return typed && (name === typed || name.startsWith(typed) || typed.startsWith(name));
      });
      return match?.name || form.cargoName || '—';
    }
    return businessTypes.find((item) => String(item.id) === String(form.businessTypeId))?.name || '';
  }, [businessTypes, form.businessTypeId, form.cargoName, lookups, standalone]);

  const businessTypeLabel = useMemo(
    () => businessTypes.find((item) => String(item.id) === String(form.businessTypeId))?.name || '—',
    [businessTypes, form.businessTypeId],
  );

  const currency = form.currency || 'USD';
  const opsListHref = `${coaPath('in-ops')}?selBType=${form.businessTypeId || '2'}&tradeType=relet`;
  const listHref = standalone
    ? `${cargoReletPath}?selBType=${form.businessTypeId || '2'}`
    : fromRunning
      ? `${coaPath('running')}?selBType=${form.businessTypeId || '2'}`
      : opsListHref;

  const applyCalc = useCallback((current) => ({
    ...current,
    ...calcCargoReletTotals(current, { standalone }),
  }), [standalone]);

  const patch = (key, value) => setForm((prev) => {
    const next = { ...prev, [key]: value };
    if (standalone && FREIGHT_MIRROR[key]) {
      next[FREIGHT_MIRROR[key]] = value;
    }
    if (standalone && (STANDALONE_LIVE_KEYS.has(key) || FREIGHT_MIRROR[key])) return applyCalc(next);
    return next;
  });

  const addPendingFiles = (fileList) => {
    const next = Array.from(fileList || []);
    if (!next.length) return;
    setPendingFiles((prev) => [...prev, ...next]);
  };

  const removePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const name = pendingFiles[0]?.name || '';
    setForm((prev) => (prev.attachmentName === name ? prev : { ...prev, attachmentName: name }));
  }, [pendingFiles]);

  const recalculate = () => {
    setForm((prev) => applyCalc(prev));
  };

  const handleVesselSelect = async (vessel) => {
    if (!vessel) {
      setForm((prev) => ({
        ...prev,
        vesselImoId: '',
        vesselName: '',
        vesselType: '',
        ...emptyCommercial(),
      }));
      return;
    }

    const displayName = vessel.vesselName || vessel.name || '';
    let vesselImoId = vessel.id ? String(vessel.id) : '';
    let vesselType = vessel.vesselType || '';
    try {
      const prefill = await fetchVesselEstimatePrefill(vessel.id);
      if (prefill) {
        vesselImoId = prefill.vesselImoId || vesselImoId;
        vesselType = prefill.vesselType || vesselType;
      }
    } catch {
      // Keep the AIS search row if commercial prefill is unavailable.
    }

    try {
      const data = await fetchCommercialParameters(vesselImoId);
      setForm((prev) => ({
        ...prev,
        ...mapVesselCommercial(data),
        vesselImoId,
        vesselName: displayName,
        vesselType: vesselType || data?.vessel?.type || '',
      }));
    } catch {
      setForm((prev) => ({
        ...prev,
        vesselImoId,
        vesselName: displayName,
        vesselType,
      }));
    }
  };

  const handleCargoChange = (value) => {
    const cargo = cargoOptions.find((item) => item.id === value);
    setForm((prev) => ({
      ...prev,
      cargoId: value,
      cargoName: cargo?.name || '',
    }));
  };

  const persist = async (updateStatus) => {
    if (viewOnly) return;
    const validation = validateCargoReletForm(form, { requireCoa: !standalone, requireCargo: standalone });
    if (validation) {
      setError(validation.message);
      if (validation.tab && validation.tab !== tab) setTab(validation.tab);
      await alert({
        title: 'Validation',
        message: validation.message,
        confirmLabel: 'OK',
      });
      focusCargoReletValidationField(validation.fieldId);
      return;
    }

    const confirmed = await confirm({
      title: 'Confirmation',
      message: updateStatus === '2'
        ? 'Are you sure you want to send this estimate to ops?'
        : 'Are you sure you have checked each entry?',
      confirmLabel: 'OK',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    const reletNo = form.reletNo.trim();
    setSaving(true);
    setError('');
    try {
      const totals = calcCargoReletTotals(form, { standalone });
      const payload = { ...form, ...totals, reletNo, updateStatus, standalone };
      if (standalone) {
        if (isAdd) await createStandaloneCargoRelet(payload);
        else await updateStandaloneCargoRelet(fcaId, payload);
        navigate(`${cargoReletPath}?selBType=${form.businessTypeId}&msg=0`);
      } else {
        if (isAdd) await createCargoRelet(payload);
        else await updateCargoRelet(fcaId, payload);
        navigate(fromRunning
          ? `${coaPath('running')}?selBType=${form.businessTypeId}&msg=0`
          : `${coaPath('in-ops')}?selBType=${form.businessTypeId}&tradeType=relet`);
      }
    } catch (err) {
      setError(err.message || 'Failed to save cargo relet.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (viewOnly) return;
    await persist('1');
  };

  const updateRows = (key, index, patchRow) => {
    setForm((prev) => {
      const rows = [...(prev[key] || [])];
      rows[index] = { ...rows[index], ...patchRow };
      const next = { ...prev, [key]: rows };
      if (standalone && MIRROR_ROW_KEYS[key]) {
        const mirrorKey = MIRROR_ROW_KEYS[key];
        const factory = key.startsWith('parties') ? partyRow : portRow;
        const mirrorRows = [...(prev[mirrorKey] || [])];
        while (mirrorRows.length <= index) mirrorRows.push(factory());
        // Cargo IN Charterer/Owner flip to Owner/Charterer on Cargo OUT
        let mirrorPatch = patchRow;
        if (key === 'partiesIn') {
          mirrorPatch = {};
          if (Object.prototype.hasOwnProperty.call(patchRow, 'charterer')) {
            mirrorPatch.owner = patchRow.charterer;
          }
          if (Object.prototype.hasOwnProperty.call(patchRow, 'owner')) {
            mirrorPatch.charterer = patchRow.owner;
          }
          if (Object.prototype.hasOwnProperty.call(patchRow, 'broker')) {
            mirrorPatch.broker = patchRow.broker;
          }
        }
        mirrorRows[index] = { ...mirrorRows[index], ...mirrorPatch };
        next[mirrorKey] = mirrorRows;
      }
      return next;
    });
  };

  const addTableRow = (key) => {
    const factory = key.startsWith('parties') ? partyRow : portRow;
    setForm((prev) => {
      const next = { ...prev, [key]: [...(prev[key] || []), factory()] };
      if (standalone && MIRROR_ROW_KEYS[key]) {
        const mirrorKey = MIRROR_ROW_KEYS[key];
        next[mirrorKey] = [...(prev[mirrorKey] || []), factory()];
      }
      return next;
    });
  };

  const removeTableRow = (key, index) => {
    setForm((prev) => {
      if ((prev[key] || []).length <= 1) return prev;
      const next = { ...prev, [key]: prev[key].filter((_, i) => i !== index) };
      if (standalone && MIRROR_ROW_KEYS[key]) {
        const mirrorKey = MIRROR_ROW_KEYS[key];
        if ((prev[mirrorKey] || []).length > 1) {
          next[mirrorKey] = prev[mirrorKey].filter((_, i) => i !== index);
        }
      }
      return next;
    });
  };

  const renderPartyTable = (key) => (
    <div>
      <div className={styles.blockTitle}>Parties/Entities</div>
      <table className={styles.nestedTable}>
        <thead>
          <tr>
            <th style={{ width: 26 }}>#</th>
            <th>Charterer</th>
            <th>Owner</th>
            <th>Broker</th>
            <th style={{ width: 30 }} />
          </tr>
        </thead>
        <tbody>
          {(form[key] || []).map((row, index) => (
            <tr key={`${key}-${index}`}>
              <td>{index + 1}</td>
              {['charterer', 'owner', 'broker'].map((field) => (
                <td key={field} data-relet-field-wrap>
                  <CoaCardSelect
                    id={`${key}-${index}-${field}`}
                    label={field}
                    value={row[field]}
                    options={
                      lookups?.[field === 'broker' ? 'brokers' : field === 'owner' ? 'owners' : 'charterers'] || []
                    }
                    onChange={(value) => updateRows(key, index, { [field]: value })}
                  />
                </td>
              ))}
              <td>
                <button
                  type="button"
                  className={styles.actionIcon}
                  title="Remove row"
                  disabled={(form[key] || []).length <= 1}
                  onClick={() => removeTableRow(key, index)}
                >
                  <i className="bi bi-x-lg" aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.addRow}>
        <button
          type="button"
          className={styles.dashedAdd}
          onClick={() => addTableRow(key)}
        >
          <PlusIcon />
          Add
        </button>
      </div>
    </div>
  );

  const renderPortTable = (key, heading) => (
    <div>
      <div className={styles.blockTitle}>{heading}</div>
      <table className={styles.nestedTable}>
        <thead>
          <tr>
            <th style={{ width: 26 }}>#</th>
            <th>{heading === 'Dis Port' ? 'Dis Port' : 'Load Port'}</th>
            <th className={styles.remarksCol}>Comments</th>
            <th style={{ width: 30 }} />
          </tr>
        </thead>
        <tbody>
          {(form[key] || []).map((row, index) => (
            <tr key={`${key}-${index}`}>
              <td>{index + 1}</td>
              <td data-relet-field-wrap>
                <PortSearchSelect
                  id={`${key}-${index}-port`}
                  value={row.portId}
                  label={row.portName}
                  onChange={(portId, portName) => updateRows(key, index, { portId, portName })}
                />
              </td>
              <td className={styles.remarksCol} data-relet-field-wrap>
                <input
                  id={`${key}-${index}-comments`}
                  value={row.comments}
                  placeholder="Comments"
                  onChange={(event) => updateRows(key, index, { comments: event.target.value })}
                />
              </td>
              <td>
                <button
                  type="button"
                  className={styles.actionIcon}
                  title="Remove row"
                  disabled={(form[key] || []).length <= 1}
                  onClick={() => removeTableRow(key, index)}
                >
                  <i className="bi bi-x-lg" aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.addRow}>
        <button
          type="button"
          className={styles.dashedAdd}
          onClick={() => addTableRow(key)}
        >
          <PlusIcon />
          Add
        </button>
      </div>
    </div>
  );

  const renderFreight = (side) => {
    const out = side === 'out';
    if (standalone) {
      const rateId = out ? 'freightUsdOut' : 'freightUsd';
      const bafId = out ? 'bafUsdOut' : 'bafUsd';
      const addId = out ? 'addComOut' : 'addCom';
      const brokId = out ? 'brokerageOut' : 'brokerage';
      const demId = out ? 'demRateOut' : 'demRate';
      return (
        <div>
          <div className={styles.blockTitle}>Freight Financials</div>
          <div className={styles.fieldGrid}>
            <Field id={rateId} label={out ? 'Relet Frt ($/MT)' : 'Base Frt ($/MT)'}>
              <input id={rateId} value={form[rateId]} placeholder="0.00" onChange={(event) => patch(rateId, event.target.value)} />
            </Field>
            <Field id={bafId} label="BAF">
              <input id={bafId} value={form[bafId]} placeholder="0.00" onChange={(event) => patch(bafId, event.target.value)} />
            </Field>
            {out ? (
              <Field id="currentFoPrice" label="Relet FO ($/MT)">
                <input id="currentFoPrice" value={form.currentFoPrice} placeholder="0.00" onChange={(event) => patch('currentFoPrice', event.target.value)} />
              </Field>
            ) : (
              <Field id="contractFoPrice" label="Contract FO ($/MT)">
                <input id="contractFoPrice" value={form.contractFoPrice} placeholder="0.00" onChange={(event) => patch('contractFoPrice', event.target.value)} />
              </Field>
            )}
            <Field id={addId} label="Add Comm (%)">
              <input id={addId} value={form[addId]} placeholder="0.00" onChange={(event) => patch(addId, event.target.value)} />
            </Field>
            <Field id={brokId} label="Brokerage (%)">
              <input id={brokId} value={form[brokId]} placeholder="0.00" onChange={(event) => patch(brokId, event.target.value)} />
            </Field>
            <Field id={demId} label={out ? 'Demurrage (Disponent)' : 'Demurrage (Cgo Charterer)'}>
              <input id={demId} value={form[demId]} placeholder="0.00" onChange={(event) => patch(demId, event.target.value)} />
            </Field>
          </div>
        </div>
      );
    }

    const rateId = out ? 'freightUsdOut' : 'freightUsd';
    const bafId = out ? 'bafUsdOut' : 'bafUsd';
    const fromId = out ? 'freightFromOut' : 'freightFrom';
    const toId = out ? 'freightToOut' : 'freightTo';
    const addId = out ? 'addComOut' : 'addCom';
    const brokId = out ? 'brokerageOut' : 'brokerage';
    const demId = out ? 'demRateOut' : 'demRate';
    const desId = out ? 'desRateOut' : 'desRate';
    return (
      <div>
        <div className={styles.blockTitle}>Freight</div>
        <div className={styles.fieldGrid}>
          <Field id={rateId} label={`Frt Rate (${currency}/MT)`}>
            <input
              id={rateId}
              value={form[rateId]}
              placeholder="0.00"
              onChange={(event) => patch(rateId, event.target.value)}
              onBlur={recalculate}
            />
          </Field>
          <Field id={bafId} label="BAF">
            <input id={bafId} value={form[bafId]} placeholder="0.00" onChange={(event) => patch(bafId, event.target.value)} onBlur={recalculate} />
          </Field>
          <Field id={fromId} label="Frt Applicable From">
            <DmyDateInput id={fromId} value={form[fromId]} onChange={(value) => patch(fromId, value)} />
          </Field>
          <Field id={toId} label="Frt Applicable To">
            <DmyDateInput id={toId} value={form[toId]} onChange={(value) => patch(toId, value)} />
          </Field>
          <Field id={addId} label="Add Comm (%)">
            <input id={addId} value={form[addId]} placeholder="0.00" onChange={(event) => patch(addId, event.target.value)} onBlur={recalculate} />
          </Field>
          <Field id={brokId} label="Brokerage (%)">
            <input id={brokId} value={form[brokId]} placeholder="0.00" onChange={(event) => patch(brokId, event.target.value)} onBlur={recalculate} />
          </Field>
          <Field id={demId} label={`Demurrage Rate (${currency}/Day)`}>
            <input id={demId} value={form[demId]} placeholder="0.00" onChange={(event) => patch(demId, event.target.value)} />
          </Field>
          <Field id={desId} label={`Despatch Rate (${currency}/Day)`}>
            <input id={desId} value={form[desId]} placeholder="0.00" onChange={(event) => patch(desId, event.target.value)} />
          </Field>
          {!out ? (
            <>
              <Field id="contractFoPrice" label={`Contract FO Price (${currency}/MT)`}>
                <input id="contractFoPrice" className={styles.readonly} readOnly value={form.contractFoPrice} placeholder="0.00" />
              </Field>
              <Field id="currentFoPrice" label={`Current FO Price (${currency}/MT)`}>
                <input id="currentFoPrice" value={form.currentFoPrice} placeholder="0.00" onChange={(event) => patch('currentFoPrice', event.target.value)} onBlur={recalculate} />
              </Field>
            </>
          ) : null}
          <Field id={out ? 'paymentClauseOut' : 'paymentClause'} label="Payment Clause" wide>
            <textarea id={out ? 'paymentClauseOut' : 'paymentClause'} value={form[out ? 'paymentClauseOut' : 'paymentClause']} onChange={(event) => patch(out ? 'paymentClauseOut' : 'paymentClause', event.target.value)} />
          </Field>
          <Field id={out ? 'bunkerClauseOut' : 'bunkerClause'} label="Bunker Clause" wide>
            <textarea id={out ? 'bunkerClauseOut' : 'bunkerClause'} value={form[out ? 'bunkerClauseOut' : 'bunkerClause']} onChange={(event) => patch(out ? 'bunkerClauseOut' : 'bunkerClause', event.target.value)} />
          </Field>
        </div>
      </div>
    );
  };

  const renderResult = (side) => {
    const out = side === 'out';
    if (standalone) {
      const profitNegative = Number(form.profit) < 0;
      return (
        <div>
          <div className={styles.blockTitleRow}>
            <span className={styles.blockTitle}>Results</span>
            <span className={styles.calcNote}>= (Relet FO − Contract FO) × BAF</span>
          </div>
          <div className={styles.resultStrip}>
            <div className={styles.fieldGrid}>
              <Field id={out ? 'bunkerDiffOut' : 'bunkerDiff'} label="Bunker Diff ($/MT)">
                <input className={styles.readonly} readOnly value={form.bunkerDiff || '0.00'} />
              </Field>
              <Field id={out ? 'bunkerSurchargeAmtOut' : 'bunkerSurchargeAmt'} label="Bnkr Surcharge ($/MT)">
                <input className={styles.readonly} readOnly value={form[out ? 'bunkerSurchargeAmtOut' : 'bunkerSurchargeAmt'] || '0.00'} />
              </Field>
              <Field id={out ? 'effectiveFrtOut' : 'effectiveFrt'} label="Effective Frt ($/MT)">
                <input className={styles.readonly} readOnly value={form[out ? 'effectiveFrtOut' : 'effectiveFrt'] || '0.00'} />
              </Field>
              <Field id={out ? 'freightAmtOut' : 'freightAmt'} label={out ? 'Gross Exp' : 'Gross Rev'}>
                <input className={styles.readonly} readOnly value={form[out ? 'freightAmtOut' : 'freightAmt'] || '0.00'} />
              </Field>
              {out ? (
                <>
                  <Field id="addCommAmtOut" label="Add Comm">
                    <input className={styles.readonly} readOnly value={form.addCommAmtOut || '0.00'} />
                  </Field>
                  <Field id="brokerageAmtOut" label="Brokerage">
                    <input className={styles.readonly} readOnly value={form.brokerageAmtOut || '0.00'} />
                  </Field>
                </>
              ) : (
                <>
                  <Field id="addCommAmt" label="Total Comm">
                    <input className={styles.readonly} readOnly value={form.addCommAmt || '0.00'} />
                  </Field>
                  <Field id="totalAmt" label="Net Rev">
                    <input className={styles.readonly} readOnly value={form.totalAmt || '0.00'} />
                  </Field>
                </>
              )}
            </div>
            {out ? (
              <div className={styles.profitField}>
                <Field id="totalAmtOut" label="Net Exp">
                  <input className={styles.readonly} readOnly value={form.totalAmtOut || '0.00'} />
                </Field>
              </div>
            ) : (
              <div className={styles.profitField}>
                <Field id="profit" label="Profit/Loss">
                  <input
                    className={`${styles.readonly} ${profitNegative ? styles.profitNegative : styles.profitPositive}`}
                    readOnly
                    value={form.profit || '0.00'}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className={styles.blockTitle}>Result</div>
        <div className={styles.resultStrip}>
          <div className={styles.fieldGrid}>
            <Field id={out ? 'freightAmtOut' : 'freightAmt'} label={`Freight (${currency})`}>
              <input className={styles.readonly} readOnly value={form[out ? 'freightAmtOut' : 'freightAmt']} placeholder="0.00" />
            </Field>
            <Field id={out ? 'bunkerSurchargeAmtOut' : 'bunkerSurchargeAmt'} label={`Bunker Surcharge (${currency})`}>
              <input className={styles.readonly} readOnly value={form[out ? 'bunkerSurchargeAmtOut' : 'bunkerSurchargeAmt']} placeholder="0.00" />
            </Field>
            <Field id={out ? 'demmurageAmtOut' : 'demmurageAmt'} label={`Demurrage (${currency})`}>
              <input value={form[out ? 'demmurageAmtOut' : 'demmurageAmt']} placeholder="0.00" onChange={(event) => patch(out ? 'demmurageAmtOut' : 'demmurageAmt', event.target.value)} onBlur={recalculate} />
            </Field>
            <Field id={out ? 'despatchAmtOut' : 'despatchAmt'} label={`Despatch (${currency})`}>
              <input value={form[out ? 'despatchAmtOut' : 'despatchAmt']} placeholder="0.00" onChange={(event) => patch(out ? 'despatchAmtOut' : 'despatchAmt', event.target.value)} onBlur={recalculate} />
            </Field>
            <Field id={out ? 'addCommAmtOut' : 'addCommAmt'} label={`Add Comm (${currency})`}>
              <input className={styles.readonly} readOnly value={form[out ? 'addCommAmtOut' : 'addCommAmt']} placeholder="0.00" />
            </Field>
            <Field id={out ? 'brokerageAmtOut' : 'brokerageAmt'} label={`Brokerage (${currency})`}>
              <input className={styles.readonly} readOnly value={form[out ? 'brokerageAmtOut' : 'brokerageAmt']} placeholder="0.00" />
            </Field>
            <Field id={out ? 'totalAmtOut' : 'totalAmt'} label={`Total (${currency})`}>
              <input className={styles.readonly} readOnly value={form[out ? 'totalAmtOut' : 'totalAmt']} placeholder="0.00" />
            </Field>
            {!out ? (
              <Field id="profit" label={`Profit (${currency})`}>
                <input className={styles.readonly} readOnly value={form.profit} placeholder="0.00" />
              </Field>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderNotes = (side) => {
    const out = side === 'out';
    if (standalone) {
      const paymentId = out ? 'paymentClauseOut' : 'paymentClause';
      const bunkerId = out ? 'bunkerClauseOut' : 'bunkerClause';
      return (
        <div>
          <div className={styles.blockTitle}>Notes &amp; Documents</div>
          <div className={styles.fieldGrid}>
            <Field id={paymentId} label="Payment Clause">
              <textarea id={paymentId} placeholder="Payment clause..." value={form[paymentId]} onChange={(event) => patch(paymentId, event.target.value)} />
            </Field>
            <Field id={bunkerId} label="Bunker Clause">
              <textarea id={bunkerId} placeholder="Bunker clause..." value={form[bunkerId]} onChange={(event) => patch(bunkerId, event.target.value)} />
            </Field>
          </div>
          {out ? (
            <>
              <div className={`${styles.fieldGrid} ${styles.notesGap}`}>
                <Field id="loadportAgentOut" label="LP Agents">
                  <CoaCardSelect label="LP Agents" value={form.loadportAgentOut} options={vendors} onChange={(value) => patch('loadportAgentOut', value)} />
                </Field>
                <Field id="disportAgentOut" label="DP Agents">
                  <CoaCardSelect label="DP Agents" value={form.disportAgentOut} options={vendors} onChange={(value) => patch('disportAgentOut', value)} />
                </Field>
              </div>
              <div className={`${styles.fieldGrid} ${styles.notesGap}`}>
                <Field id="extraInsuranceOut" label="Extra Insurance">
                  <textarea value={form.extraInsuranceOut} onChange={(event) => patch('extraInsuranceOut', event.target.value)} />
                </Field>
                <Field id="minTermOut" label="Main Terms">
                  <textarea value={form.minTermOut} onChange={(event) => patch('minTermOut', event.target.value)} />
                </Field>
              </div>
              <div className={styles.docsSection}>
                <div className={`${styles.docsSectionHead} ${styles.docsSectionHeadGrey}`}>
                  <div className={styles.docsSectionTitleWrap}>
                    <div className={`${styles.sectionIco} ${styles.sectionIcoNavy}`} style={{ width: 28, height: 28 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </div>
                    <div className={styles.docsSectionTitle}>Attachments</div>
                    {pendingFiles.length ? <div className={styles.docsCount}>{pendingFiles.length}</div> : null}
                  </div>
                </div>
                <div className={styles.docsSectionBody}>
                  <input
                    ref={attachInputRef}
                    className={styles.hiddenFileInput}
                    type="file"
                    multiple
                    onChange={(event) => {
                      addPendingFiles(event.target.files);
                      event.target.value = '';
                    }}
                  />
                  <div
                    className={dropActive ? `${styles.dropzone} ${styles.dropzoneActive}` : styles.dropzone}
                    role="button"
                    tabIndex={0}
                    onClick={() => attachInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        attachInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropActive(true);
                    }}
                    onDragLeave={() => setDropActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDropActive(false);
                      addPendingFiles(e.dataTransfer?.files);
                    }}
                  >
                    <div className={styles.dropzoneIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 16V4" />
                        <path d="M6 10l6-6 6 6" />
                        <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                      </svg>
                    </div>
                    <div className={styles.dropzoneText}>
                      <b>Drag &amp; drop files here</b>, or click to browse
                    </div>
                  </div>

                  {pendingFiles.length ? (
                    <div className={styles.fileList}>
                      {pendingFiles.map((file, index) => (
                        <PendingFileRow
                          key={`pending-${file.name}-${index}`}
                          file={file}
                          onRemove={() => removePendingFile(index)}
                        />
                      ))}
                    </div>
                  ) : form.attachmentName ? (
                    <div className={styles.fileList}>
                      <div className={styles.fileRow}>
                        <span className={styles.fileName}>{form.attachmentName}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      );
    }

    const s = out ? 'Out' : '';
    return (
      <>
        <div className={styles.blockTitle}>Various Notes</div>
        <div className={styles.fieldGrid}>
          <Field id={`coaRef${s}`} label="COA ref if applicable" wide>
            <textarea value={form[`coaRef${s}`]} onChange={(event) => patch(`coaRef${s}`, event.target.value)} />
          </Field>
          <Field id={`loadportAgent${s}`} label="Load Port Agents">
            <CoaCardSelect label="Load Port Agents" value={form[`loadportAgent${s}`]} options={vendors} onChange={(value) => patch(`loadportAgent${s}`, value)} />
          </Field>
          <Field id={`loadportRemarks${s}`} label="Remark">
            <textarea value={form[`loadportRemarks${s}`]} onChange={(event) => patch(`loadportRemarks${s}`, event.target.value)} />
          </Field>
          <Field id={`disportAgent${s}`} label="Dis Port Agents">
            <CoaCardSelect label="Dis Port Agents" value={form[`disportAgent${s}`]} options={vendors} onChange={(value) => patch(`disportAgent${s}`, value)} />
          </Field>
          <Field id={`disportRemarks${s}`} label="Remark">
            <textarea value={form[`disportRemarks${s}`]} onChange={(event) => patch(`disportRemarks${s}`, event.target.value)} />
          </Field>
          <Field id={`notices${s}`} label="Notices" wide>
            <textarea value={form[`notices${s}`]} onChange={(event) => patch(`notices${s}`, event.target.value)} />
          </Field>
          <Field id={`dA${s}`} label="D/A" wide>
            <textarea value={form[`dA${s}`]} onChange={(event) => patch(`dA${s}`, event.target.value)} />
          </Field>
          <Field id={`extraInsurance${s}`} label="Extra Insurance" wide>
            <textarea value={form[`extraInsurance${s}`]} onChange={(event) => patch(`extraInsurance${s}`, event.target.value)} />
          </Field>
          <Field id={`minTerm${s}`} label="Main Terms" wide>
            <textarea value={form[`minTerm${s}`]} onChange={(event) => patch(`minTerm${s}`, event.target.value)} />
          </Field>
          <Field id={`spclComments${s}`} label="Special Comments" wide>
            <textarea value={form[`spclComments${s}`]} onChange={(event) => patch(`spclComments${s}`, event.target.value)} />
          </Field>
          <Field id={`nomProc${s}`} label="Nomination Proc" wide>
            <textarea value={form[`nomProc${s}`]} onChange={(event) => patch(`nomProc${s}`, event.target.value)} />
          </Field>
        </div>
      </>
    );
  };

  const renderTwinPanels = () => (
    <div className={styles.twinGrid}>
      <div className={`${styles.panel} ${styles.panelIn}`}>
        <div className={styles.panelHead}>
          <div className={styles.panelHeadMain}>
            <PanelArrow down />
            Cargo IN
          </div>
          {standalone ? <div className={styles.panelHeadSub}>Cargo lift — revenue leg</div> : null}
        </div>
        <div className={styles.panelBody}>
          {renderPartyTable('partiesIn')}
          {renderPortTable('loadPortsIn', 'Load Port')}
          {renderPortTable('dischargePortsIn', 'Dis Port')}
          {renderFreight('in')}
          {renderResult('in')}
          {renderNotes('in')}
        </div>
      </div>
      <div className={`${styles.panel} ${styles.panelOut}`}>
        <div className={styles.panelHead}>
          <div className={styles.panelHeadMain}>
            <PanelArrow down={false} />
            Cargo OUT
          </div>
          {standalone ? <div className={styles.panelHeadSub}>Sub-charter to relet owner — expense leg</div> : null}
        </div>
        <div className={styles.panelBody}>
          {renderPartyTable('partiesOut')}
          {renderPortTable('loadPortsOut', 'Load Port')}
          {renderPortTable('dischargePortsOut', 'Dis Port')}
          {renderFreight('out')}
          {renderResult('out')}
          {renderNotes('out')}
        </div>
      </div>
    </div>
  );

  const renderStandaloneEstimateBody = () => (
    <>
      <div className={styles.estimateTopRow}>
        <Field id="cargoName" label="Cargo Name" className={styles.cargoSelectField} required>
          <CoaCardSelect
            id="cargoName"
            label="Cargo Name"
            value={form.cargoId}
            options={cargoSelectOptions}
            placeholder="Required"
            onChange={handleCargoChange}
          />
        </Field>
        <Field id="cargoQty" label="Cargo Qty (MT)">
          <input
            id="cargoQty"
            value={form.cargoQty}
            placeholder="0.00"
            onChange={(event) => patch('cargoQty', event.target.value)}
          />
        </Field>
      </div>
      {renderTwinPanels()}
    </>
  );

  if (loading) {
    return (
      <div className={`zafira-page ${styles.page}${standalone ? ` ${styles.standalone}` : ''}`}>
        <LoadingOverlay show label="Loading cargo relet…" />
      </div>
    );
  }

  return (
    <div className={`zafira-page ${styles.page}${standalone ? ` ${styles.standalone}` : ''}`}>
      <CoaFormHeaderActions
        listHref={listHref}
        disabled={saving}
        currencyChip={standalone ? currency : null}
      />
      {saving ? <LoadingOverlay show fullScreen={false} label="Saving cargo relet…" /> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <form onSubmit={handleSave} className={viewOnly ? styles.viewOnly : undefined}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadIcon}>
              <ReletIcon />
            </div>
            <span className={styles.cardTitle}>Cargo Relet Details</span>
          </div>
          <div className={styles.gridFields}>
            <MetaField id="fixtureType" label="Fixture Type">
              <div className={styles.metaValue}>
                {standalone ? 'Cargo Relet (Standalone)' : 'Cargo Relet'}
              </div>
            </MetaField>
            {standalone ? (
              <>
                <MetaField id="reletNo" label="Relet No.">
                  {isAdd ? (
                    <input
                      id="reletNo"
                      value={form.reletNo}
                      placeholder="Required"
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((prev) => ({ ...prev, reletNo: value, reletName: value }));
                      }}
                    />
                  ) : (
                    <input id="reletNo" className={styles.readonly} readOnly value={form.reletNo} />
                  )}
                </MetaField>
                <MetaField id="businessTypeId" label="Business Type">
                  <div className={styles.metaValue}>{businessTypeLabel}</div>
                </MetaField>
              </>
            ) : (
              <MetaField id="coaId" label="COA ID" grow>
                {lockedCoaId ? (
                  <input id="coaId" className={styles.readonly} readOnly value={form.coaIdentity || lockedCoaId} />
                ) : (
                  <CoaCardSelect
                    id="coaId"
                    label="COA"
                    value={form.coaId}
                    options={coaOptions}
                    placeholder="Select COA..."
                    onChange={(value) => patch('coaId', value)}
                  />
                )}
              </MetaField>
            )}
            <MetaField id="vesselImoId" label="Vessel" grow={!standalone} className={styles.vesselField}>
              <div id="vesselImoId" className={styles.vesselSearch}>
                <VesselSearchSelect
                  value={form.vesselImoId}
                  label={form.vesselName}
                  onSelect={handleVesselSelect}
                />
              </div>
            </MetaField>
            <MetaField id="vesselType" label="Vessel Type">
              <input id="vesselType" className={styles.readonly} readOnly value={form.vesselType} placeholder="—" />
            </MetaField>
            <MetaField id="transDate" label="Date">
              <DmyDateInput id="transDate" value={form.transDate} onChange={(value) => patch('transDate', value)} />
            </MetaField>
            {!standalone ? (
              <>
                <MetaField id="reletNo" label="Cargo Relet No.">
                  <input
                    id="reletNo"
                    value={form.reletNo}
                    placeholder="Required"
                    onChange={(event) => patch('reletNo', event.target.value)}
                  />
                </MetaField>
                <MetaField id="reletName" label="Cargo Relet Sheet Name" grow>
                  <input
                    id="reletName"
                    value={form.reletName}
                    placeholder="e.g. RLT-1041 Working Sheet"
                    onChange={(event) => patch('reletName', event.target.value)}
                  />
                </MetaField>
              </>
            ) : null}
          </div>
        </div>

        {standalone ? (
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadIcon}>
                <EstimateCardIcon />
              </div>
              <span className={styles.cardTitle}>Estimate</span>
            </div>
            {renderStandaloneEstimateBody()}
          </div>
        ) : (
          <div className={styles.tabPanelCard}>
            <div role="tabpanel" aria-label={ESTIMATE_TAB.label}>
              <>
                  <div className={styles.cargoStrip}>
                    <div className={styles.cargoStripBlock}>
                      <span className={styles.cargoStripLabel}>Cargo Type</span>
                      <div className={styles.cargoStripValue}>{cargoTypeLabel || '—'}</div>
                    </div>
                    <div className={`${styles.cargoStripBlock} ${styles.cargoStripBlockWide}`}>
                      <span className={styles.cargoStripLabel}>Planned Cargo</span>
                      <div className={styles.plannedCargoBox}>
                        {form.cargoPlanDetails || 'Cargo Planning Details...'}
                      </div>
                    </div>
                  </div>

                  <div className={styles.cargoSearchRow}>
                    <Field id="cargoName" label="Cargo">
                      <input className={styles.readonly} readOnly value={form.cargoName || '—'} />
                    </Field>
                    <Field id="cargoQty" label="Cargo Qty (MT)">
                      <input
                        id="cargoQty"
                        value={form.cargoQty}
                        placeholder="0.00"
                        onChange={(event) => patch('cargoQty', event.target.value)}
                        onBlur={recalculate}
                      />
                    </Field>
                  </div>

                  {renderTwinPanels()}
              </>
            </div>
          </div>
        )}
        {viewOnly ? null : (
        <div className={styles.formFooter}>
          {!standalone ? (
            <button type="button" className={styles.btnNavy} onClick={recalculate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              Run
            </button>
          ) : null}
          <button type="submit" className={styles.btnOutline} disabled={saving}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
              <path d="M17 21v-8H7v8" />
              <path d="M7 3v5h8" />
            </svg>
            Save
          </button>
          <button
            type="button"
            className={standalone ? styles.btnNavy : styles.btnOrange}
            disabled={saving || form.fixed}
            onClick={() => persist('2')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4Z" />
            </svg>
            {standalone ? 'Send to Ops' : 'Submit for Review'}
          </button>
        </div>
        )}
      </form>
    </div>
  );
}

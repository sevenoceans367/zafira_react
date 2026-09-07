import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  fetchRunningCoas,
  updateCargoRelet,
} from '../../../services/coas.js';
import {
  createStandaloneCargoRelet,
  fetchStandaloneCargoRelet,
  updateStandaloneCargoRelet,
} from '../../../services/cargoRelets.js';
import PortSearchSelect from '../period-contract/PortSearchSelect.jsx';
import { calcCargoIntake, calcCargoReletTotals } from './cargoReletTotals.js';
import {
  focusCargoReletValidationField,
  validateCargoReletForm,
} from './cargoReletValidation.js';
import CoaCardSelect from './CoaCardSelect.jsx';
import CoaFormHeaderActions from './CoaFormHeaderActions.jsx';
import styles from './CargoReletFormPage.module.css';

const ALL_TABS = [
  { id: 'estimate', label: 'Cargo Relet: Estimate' },
  { id: 'commercial', label: 'Commercial Parameters' },
  { id: 'planned', label: 'Planned Cargo/Intake' },
];

const NEW_RELET_TABS = ALL_TABS.filter((item) => item.id === 'estimate');

const MIRROR_ROW_KEYS = {
  partiesIn: 'partiesOut',
  loadPortsIn: 'loadPortsOut',
  dischargePortsIn: 'dischargePortsOut',
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

function generateStandaloneReletNo() {
  const stamp = String(Date.now()).slice(-6);
  return `RLT-${stamp}`;
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

function TabIcon({ id }) {
  if (id === 'commercial') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }
  if (id === 'planned') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v18" />
        <path d="M16.5 7.5c0-2-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.3 9 2 9 6.3 0 2-2 3.2-4.5 3.2s-4.5-1-4.5-3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2 7 4-14 2 7h6" />
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

function Field({ id, label, children, wide = false }) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function MetaField({ id, label, children, grow = false }) {
  return (
    <div className={`${styles.metaField} ${grow ? styles.metaFieldGrow : ''}`}>
      <label className={styles.metaLabel} htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function SpeedInput({ id, value, onChange, readOnly = true }) {
  return (
    <input
      id={id}
      value={value || ''}
      readOnly={readOnly}
      className={readOnly ? styles.readonly : undefined}
      placeholder="0.00"
      onChange={(event) => onChange?.(event.target.value)}
    />
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
  const fromRunning = searchParams.get('from') === 'running';
  const lockedCoaId = searchParams.get('coaId') || '';
  const tabs = isAdd ? NEW_RELET_TABS : ALL_TABS;
  const [tab, setTab] = useState('estimate');
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
  const [attachNote, setAttachNote] = useState('No documents attached yet');

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
          setForm({
            ...emptyForm(detail.businessTypeId),
            ...detail,
            partiesIn: detail.partiesIn?.length ? detail.partiesIn : [partyRow()],
            partiesOut: detail.partiesOut?.length ? detail.partiesOut : [partyRow()],
            loadPortsIn: withPortRows(detail.loadPortsIn),
            dischargePortsIn: withPortRows(detail.dischargePortsIn),
            loadPortsOut: withPortRows(detail.loadPortsOut),
            dischargePortsOut: withPortRows(detail.dischargePortsOut),
          });
          return;
        }

        const next = emptyForm(bType, queryCoaId);
        if (standalone) {
          next.reletNo = generateStandaloneReletNo();
          next.reletName = next.reletNo;
        }
        const replicateFrom = searchParams.get('replicateFrom') || '';
        if (replicateFrom) {
          const source = standalone
            ? await fetchStandaloneCargoRelet(replicateFrom)
            : await fetchCargoRelet(replicateFrom);
          if (cancelled) return;
          if (source) {
            Object.assign(next, {
              ...source,
              fcaId: undefined,
              reletNo: standalone ? next.reletNo : '',
              reletName: standalone ? next.reletNo : (source.reletName || ''),
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

  const vessels = useMemo(
    () => (lookups?.vessels || []).filter(
      (item) => !item.businessTypeId || item.businessTypeId === form.businessTypeId,
    ),
    [form.businessTypeId, lookups],
  );

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
      return match?.name || (form.cargoName ? '—' : '—');
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
    if (standalone && STANDALONE_LIVE_KEYS.has(key)) return applyCalc(next);
    return next;
  });

  const recalculate = () => {
    setForm((prev) => applyCalc(prev));
  };

  const handleVesselChange = async (value) => {
    if (!value) {
      setForm((prev) => ({
        ...prev,
        vesselImoId: '',
        vesselType: '',
        ...emptyCommercial(),
      }));
      return;
    }
    try {
      const data = await fetchCommercialParameters(value);
      setForm((prev) => ({
        ...prev,
        vesselImoId: value,
        ...mapVesselCommercial(data),
      }));
    } catch {
      setForm((prev) => ({ ...prev, vesselImoId: value }));
    }
  };

  const persist = async (updateStatus) => {
    const validation = validateCargoReletForm(form, { requireCoa: !standalone });
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
      const totals = calcCargoReletTotals(form);
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
              <div className={`${styles.field} ${styles.attachField}`}>
                <label htmlFor="relet-attach">Attachments</label>
                <div className={styles.dropzone}>
                  <div className={styles.dzText}>Drag &amp; drop files here, or <b>browse</b></div>
                  <div className={styles.dzSub}>{attachNote}</div>
                  <label className={styles.attachBtn} htmlFor="relet-attach">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    Attach
                    <input
                      id="relet-attach"
                      type="file"
                      multiple
                      hidden
                      onChange={(event) => {
                        const count = event.target.files?.length || 0;
                        const note = count
                          ? `${count} file${count === 1 ? '' : 's'} selected (not uploaded yet)`
                          : 'No documents attached yet';
                        setAttachNote(note);
                        patch('attachmentName', event.target.files?.[0]?.name || '');
                      }}
                    />
                  </label>
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
        <Field id="cargoName" label="Cargo">
          <input
            id="cargoName"
            list="standalone-cargo-datalist"
            value={form.cargoName}
            placeholder="Enter cargo..."
            onChange={(event) => patch('cargoName', event.target.value)}
          />
          <datalist id="standalone-cargo-datalist">
            {(lookups?.cargos || []).slice(0, 40).map((cargo) => (
              <option key={cargo.id} value={cargo.name} />
            ))}
          </datalist>
          <span className={styles.fieldHint}>Manually entered — no master COA to pull from.</span>
        </Field>
        <Field id="cargoType" label="Cargo Type">
          <input id="cargoType" className={styles.readonly} readOnly value={cargoTypeLabel || '—'} />
          <span className={styles.fieldHint}>Product genre, linked to the cargo master.</span>
        </Field>
        <Field id="cargoQty" label="Cargo Qty (MT)">
          <input
            id="cargoQty"
            value={form.cargoQty}
            placeholder="0.00"
            onChange={(event) => patch('cargoQty', event.target.value)}
          />
        </Field>
        <Field id="cargoPlanDetails" label="Planned Cargo" wide>
          <input
            id="cargoPlanDetails"
            value={form.cargoPlanDetails}
            placeholder="Planning details..."
            onChange={(event) => patch('cargoPlanDetails', event.target.value)}
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

      <form onSubmit={handleSave}>
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
                  <input id="reletNo" className={styles.readonly} readOnly value={form.reletNo} />
                  <span className={styles.fieldHint}>No COA nomination ID — standalone relets number their own sequence.</span>
                </MetaField>
                <MetaField id="businessTypeId" label="Business Type">
                  <div className={styles.metaValue}>{businessTypeLabel}</div>
                  <span className={styles.fieldHint}>Pulled from the Running Cargo Relets screen&apos;s Tankers/Dry Cargo selection.</span>
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
            <MetaField id="vesselImoId" label="Vessel" grow={!standalone}>
              <CoaCardSelect
                id="vesselImoId"
                label="Vessel"
                value={form.vesselImoId}
                options={vessels}
                onChange={handleVesselChange}
              />
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

        {standalone && isAdd ? (
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
          <>
            <div className={styles.statusTabs} role="tablist" aria-label="Cargo relet sections">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={`${styles.tabButton} ${tab === item.id ? styles.tabButtonActive : ''}`}
                  onClick={() => setTab(item.id)}
                >
                  <TabIcon id={item.id} />
                  {item.label}
                </button>
              ))}
            </div>

            <div className={styles.tabPanelCard}>
              {tab === 'estimate' ? (
                <div role="tabpanel">
                  {standalone ? renderStandaloneEstimateBody() : (
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
                        {!isAdd ? (
                          <button type="button" className={styles.btnNavySm} onClick={() => setTab('planned')}>
                            Search Cargo
                          </button>
                        ) : null}
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
                  )}
                </div>
              ) : null}

          {tab === 'commercial' && !isAdd ? (
            <div role="tabpanel">
              <div className={styles.paramGrid}>
                <Field id="dwtSummer" label="DWT (Summer)">
                  <input id="dwtSummer" className={styles.readonly} readOnly value={form.dwtSummer} placeholder="0.00" />
                </Field>
                <Field id="grainCap" label="Grain Cap. (CBM)">
                  <input id="grainCap" className={styles.readonly} readOnly value={form.grainCap} />
                </Field>
                <Field id="baleCap" label="Bale Cap. (CBM)">
                  <input id="baleCap" className={styles.readonly} readOnly value={form.baleCap} disabled={form.capType !== '2'} />
                </Field>
                <Field id="stowageFactor" label="SF (ft3/lt)">
                  <input id="stowageFactor" value={form.stowageFactor} onChange={(event) => patch('stowageFactor', event.target.value)} />
                </Field>
                <Field id="loadable" label="Loadable (MT)">
                  <input id="loadable" className={styles.readonly} readOnly value={form.loadable} />
                </Field>
                <Field id="gnrt" label="GRT">
                  <input id="gnrt" className={styles.readonly} readOnly value={form.gnrt} />
                </Field>
                <Field id="loa" label="LOA">
                  <input id="loa" className={styles.readonly} readOnly value={form.loa} />
                </Field>
                <Field id="builtYear" label="Built Year">
                  <input id="builtYear" className={styles.readonly} readOnly value={form.builtYear} />
                </Field>
                <Field id="beam" label="BEAM (m)">
                  <input id="beam" className={styles.readonly} readOnly value={form.beam} />
                </Field>
                <Field id="tpc" label="TPC">
                  <input id="tpc" className={styles.readonly} readOnly value={form.tpc} />
                </Field>
              </div>

              <div className={styles.sectionAccent}>Speed Data</div>
              <table className={styles.speedTable}>
                <thead>
                  <tr>
                    <th />
                    <th>Full Speed</th>
                    <th>Service Speed</th>
                    <th>Most Eco Speed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.rowLabel}>Ballast Speed (Knots)</td>
                    <td><SpeedInput id="ballastFullSpeed" value={form.ballastFullSpeed} /></td>
                    <td><SpeedInput id="ballastServiceSpeed" value={form.ballastServiceSpeed} /></td>
                    <td><SpeedInput id="ballastEcoSpeed" value={form.ballastEcoSpeed} /></td>
                  </tr>
                  <tr>
                    <td className={styles.rowLabel}>Laden Speed (Knots)</td>
                    <td><SpeedInput id="ladenFullSpeed" value={form.ladenFullSpeed} /></td>
                    <td><SpeedInput id="ladenServiceSpeed" value={form.ladenServiceSpeed} /></td>
                    <td><SpeedInput id="ladenEcoSpeed" value={form.ladenEcoSpeed} /></td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.sectionAccent}>FO Consumption MT/Day</div>
              <table className={styles.consumeTable}>
                <thead>
                  <tr>
                    <th />
                    <th>Full Speed</th>
                    <th>Service Speed</th>
                    <th>Most Eco Speed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.rowLabel}>Ballast Passage</td>
                    <td><SpeedInput id="foBallastFull" value={form.foBallastFull} /></td>
                    <td><SpeedInput id="foBallastService" value={form.foBallastService} /></td>
                    <td><SpeedInput id="foBallastEco" value={form.foBallastEco} /></td>
                  </tr>
                  <tr>
                    <td className={styles.rowLabel}>Laden Passage</td>
                    <td><SpeedInput id="foLadenFull" value={form.foLadenFull} /></td>
                    <td><SpeedInput id="foLadenService" value={form.foLadenService} /></td>
                    <td><SpeedInput id="foLadenEco" value={form.foLadenEco} /></td>
                  </tr>
                  <tr>
                    <td className={styles.rowLabel}>In Port</td>
                    <td><SpeedInput id="foPortIdle" value={form.foPortIdle} /></td>
                    <td><SpeedInput id="foPortWorking" value={form.foPortWorking} /></td>
                    <td />
                  </tr>
                </tbody>
              </table>

              <div className={styles.sectionAccent}>DO Consumption per MT/Day</div>
              <table className={styles.consumeTable}>
                <thead>
                  <tr>
                    <th />
                    <th>Full Speed</th>
                    <th>Service Speed</th>
                    <th>Most Eco Speed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.rowLabel}>Ballast Passage</td>
                    <td><SpeedInput id="doBallastFull" value={form.doBallastFull} /></td>
                    <td><SpeedInput id="doBallastService" value={form.doBallastService} /></td>
                    <td><SpeedInput id="doBallastEco" value={form.doBallastEco} /></td>
                  </tr>
                  <tr>
                    <td className={styles.rowLabel}>Laden Passage</td>
                    <td><SpeedInput id="doLadenFull" value={form.doLadenFull} /></td>
                    <td><SpeedInput id="doLadenService" value={form.doLadenService} /></td>
                    <td><SpeedInput id="doLadenEco" value={form.doLadenEco} /></td>
                  </tr>
                  <tr>
                    <td className={styles.rowLabel}>In Port</td>
                    <td><SpeedInput id="doPortIdle" value={form.doPortIdle} /></td>
                    <td><SpeedInput id="doPortWorking" value={form.doPortWorking} /></td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === 'planned' && !isAdd ? (
            <div role="tabpanel">
              <div className={styles.blockTitle}>Planned Cargo</div>
              <div className={styles.plannedGrid}>
                <Field id="openCargoId" label="CP ID">
                  <input id="openCargoId" className={styles.readonly} readOnly value={form.openCargoId} placeholder="Cargo ID" />
                </Field>
                <Field id="shipperCp" label="Shipper">
                  <CoaCardSelect label="Shipper" value={form.shipperCp} options={vendors} onChange={(value) => patch('shipperCp', value)} />
                </Field>
                <Field id="chartererCp" label="Charterer">
                  <CoaCardSelect label="Charterer" value={form.chartererCp} options={lookups?.charterers || []} onChange={(value) => patch('chartererCp', value)} />
                </Field>
                <Field id="ownerCp" label="Owner">
                  <CoaCardSelect label="Owner" value={form.ownerCp} options={lookups?.owners || []} onChange={(value) => patch('ownerCp', value)} />
                </Field>
                <Field id="receiverCp" label="Receiver">
                  <CoaCardSelect label="Receiver" value={form.receiverCp} options={vendors} onChange={(value) => patch('receiverCp', value)} />
                </Field>
                <Field id="cargoCp" label="Cargo">
                  <CoaCardSelect
                    label="Cargo"
                    value={form.cargoCp}
                    options={lookups?.cargos || []}
                    onChange={(value) => {
                      const cargo = (lookups?.cargos || []).find((item) => item.id === value);
                      setForm((prev) => ({ ...prev, cargoCp: value, cargoName: cargo?.name || '' }));
                    }}
                  />
                </Field>
                <Field id="plannedCargoQty" label="Cargo Stem Size (MT)">
                  <input
                    id="plannedCargoQty"
                    className={styles.readonly}
                    readOnly
                    value={form.plannedCargoQty}
                  />
                </Field>
                <Field id="toleranceCp" label="Tolerance (+/- %)">
                  <input id="toleranceCp" className={styles.readonly} readOnly value={form.toleranceCp} />
                </Field>
                <Field id="baseFreightCp" label={`Base Freight (${currency}/MT)`}>
                  <input
                    id="baseFreightCp"
                    className={styles.readonly}
                    readOnly
                    value={form.baseFreightCp || form.freightUsd}
                  />
                </Field>
                <Field id="coaDateCp" label="COA date">
                  <input id="coaDateCp" className={styles.readonly} readOnly value={form.coaDateCp} placeholder="dd-mm-yyyy" />
                </Field>
                <Field id="loadPortCp" label="Load Port">
                  <PortSearchSelect
                    value={form.loadPortCp}
                    label={form.loadPortCpName}
                    onChange={(portId, portName) => setForm((prev) => ({ ...prev, loadPortCp: portId, loadPortCpName: portName }))}
                  />
                </Field>
                <Field id="dischargePortCp" label="Discharge Port">
                  <PortSearchSelect
                    value={form.dischargePortCp}
                    label={form.dischargePortCpName}
                    onChange={(portId, portName) => setForm((prev) => ({ ...prev, dischargePortCp: portId, dischargePortCpName: portName }))}
                  />
                </Field>
                <Field id="laycanStartCp" label="LayCan Start Date">
                  <input id="laycanStartCp" className={styles.readonly} readOnly value={form.laycanStartCp} />
                </Field>
                <Field id="laycanFinishCp" label="LayCan Finish Date">
                  <input id="laycanFinishCp" className={styles.readonly} readOnly value={form.laycanFinishCp} />
                </Field>
                <Field id="nomClauseCp" label="Nom Clause">
                  <input id="nomClauseCp" className={styles.readonly} readOnly value={form.nomClauseCp} />
                </Field>
                <Field id="remarksCp" label="Remarks" wide>
                  <textarea id="remarksCp" className={styles.readonly} readOnly value={form.remarksCp} />
                </Field>
              </div>

              <div className={styles.blockTitle}>Cargo Intake Calculations</div>
              <div className={styles.plannedGrid}>
                <Field id="summerDwtMt" label="Summer DWT (MT)">
                  <input id="summerDwtMt" className={styles.readonly} readOnly value={form.summerDwtMt} />
                </Field>
                <Field id="summerDwtLt" label="Summer DWT (LT)">
                  <input id="summerDwtLt" className={styles.readonly} readOnly value={form.summerDwtLt} />
                </Field>
                <Field id="summerDraftM" label="Summer Draft (M)">
                  <input id="summerDraftM" className={styles.readonly} readOnly value={form.summerDraftM} />
                </Field>
                <Field id="summerDraftFt" label="Summer Draft (FT)">
                  <input id="summerDraftFt" className={styles.readonly} readOnly value={form.summerDraftFt} />
                </Field>
                <Field id="tpcMt" label="TPC (MT)">
                  <input id="tpcMt" className={styles.readonly} readOnly value={form.tpcMt} />
                </Field>
                <Field id="constantsMt" label="Constants (MT)">
                  <input id="constantsMt" className={styles.readonly} readOnly value={form.constantsMt} />
                </Field>
                <Field id="grainCapCbm" label="Grain Cap (CBM)">
                  <input id="grainCapCbm" className={styles.readonly} readOnly value={form.grainCapCbm} />
                </Field>
              </div>

              <div className={styles.blockTitle}>Basis Max Draft in Port</div>
              <div className={styles.plannedGrid}>
                <Field id="allowedDraftM" label="Allowed Draft (M)">
                  <input
                    id="allowedDraftM"
                    value={form.allowedDraftM}
                    placeholder="0.00"
                    onChange={(event) => {
                      const allowedDraftM = event.target.value;
                      setForm((prev) => applyCalc({
                        ...prev,
                        allowedDraftM,
                        ...calcCargoIntake({ ...prev, allowedDraftM }),
                      }));
                    }}
                  />
                </Field>
                <Field id="bunkerRobMt" label="Bunker ROB (MT)">
                  <input
                    id="bunkerRobMt"
                    value={form.bunkerRobMt}
                    placeholder="0.00"
                    onChange={(event) => {
                      const bunkerRobMt = event.target.value;
                      setForm((prev) => applyCalc({
                        ...prev,
                        bunkerRobMt,
                        ...calcCargoIntake({ ...prev, bunkerRobMt }),
                      }));
                    }}
                  />
                </Field>
                <Field id="cargoIntakeMt" label="Cargo Intake (MT)">
                  <input id="cargoIntakeMt" className={styles.readonly} readOnly value={form.cargoIntakeMt} />
                </Field>
                <Field id="sfCbmMt" label="SF (CBM/MT)">
                  <input id="sfCbmMt" className={styles.readonly} readOnly value={form.sfCbmMt} />
                </Field>
                <Field id="cargoLoadableMt" label="Cargo Loadable (MT)">
                  <input id="cargoLoadableMt" className={styles.readonly} readOnly value={form.cargoLoadableMt} />
                </Field>
              </div>
            </div>
          ) : null}
            </div>
          </>
        )}

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
      </form>
    </div>
  );
}

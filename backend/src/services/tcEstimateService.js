import { isDbConfigured } from '../config.js';
import {
  dbCreateTcEstimate,
  dbDeleteTcEstimate,
  dbGetPeriodTcInDetails,
  dbGetTcCompareEstimates,
  dbGetTcDecisionChartDetails,
  dbGetTcEstimate,
  dbGetTcLookups,
  dbListTcDecisionCharts,
  dbListTcEstimates,
  dbSaveTcCalculation,
  dbSubmitTcDecisionChart,
  dbSendTcEstimatesToOps,
  dbUpdateTcEstimate,
} from './tcEstimateDb.js';
import {
  TC_BUSINESS_TYPES,
  calcTcTotals,
  dailyGrossHire,
  mapTcDetail,
  mapTcListRow,
  computeTcListStats,
} from './tcEstimateMappers.js';

const MOCK_LOOKUPS = {
  fixtureTypes: [{ id: '1', name: 'Time Charter Out' }],
  cpTypes: [{ id: '1', name: 'NYPE' }, { id: '2', name: 'ASBATIME' }],
  charterers: [{ id: 'C001', name: 'Steel Corp ( C001 )' }],
  vendors: [{ id: 'V001', name: 'Owner Co ( V001 )' }],
  lawArbitration: [{ id: '1', name: 'English Law / London' }],
  charteringTeams: [{ id: '7', name: 'Zafira' }],
  charteringPics: [
    { id: '101', name: 'Christos Matarangas' },
  ],
  bunkers: [
    { id: '1', name: 'VLSFO' },
    { id: '2', name: 'MGO' },
  ],
  expenseTypes: [{ id: '1', name: 'Port Charges' }],
  balticRoutes: [{ id: '1', name: 'C5' }],
  periodContracts: [{ id: '10', name: 'PC-2026-01' }],
  vessels: [
    { id: '100', name: 'Atlantic Star', businessTypeId: '3' },
    { id: '101', name: 'Pacific Glory', businessTypeId: '2' },
  ],
  bankingDetails: [
    { id: '1', name: 'Main Bank - Chase' },
    { id: '2', name: 'Ops Bank - HSBC' },
  ],
  payableBy: [
    { id: 'Charterer', name: 'Charterer' },
    { id: 'Operator', name: 'Operator' },
    { id: 'N/A', name: 'N/A' },
  ],
  currencies: [
    { id: 'USD', name: 'USD' },
    { id: 'EURO', name: 'EURO' },
  ],
};

let mockSeq = 2002;
let mockCompareSeq = 1;
let mockStore = [
  {
    TCOUTID: 2001,
    MODULEID: '1',
    MCOMPANYID: '1',
    ESTIMATE_TYPE: '3',
    FIXTURE_TYPE: '1',
    VESSEL_IMO_ID: '100',
    VESSEL_TYPE: 'Capesize',
    FLAG: 'Liberia',
    TC_DATE: '2026-01-10',
    TC_NO: 'TC-OUT-001',
    CP_DATE1: '2026-01-15',
    SEL_CP_TYPE: '1',
    SEL_CHARTERER: 'C001',
    SEL_CHAR_OPER: 'V001',
    LAW_ARBITRA: '1',
    CHAR_OPER_ADD: '',
    BUILD_YARD: 'Hyundai',
    BUILT_YEAR1: '2015',
    FLAG_1: 'Liberia',
    PORT_OF_REG: 'Monrovia',
    IMO_NO: '9123456',
    CLASS_ID: 'LR',
    LAST_SP_SURVEY: '2025-06-01',
    LAST_DD: '2024-06-01',
    OWNERS_PI: 'UK P&I',
    MASTERS_NAME: 'Capt. Smith',
    CALL_SIGN: 'A8AB',
    INMARSAT_TEL: '',
    INMARSAT_MAIL: '',
    LOA1: '292',
    BREADTH: '45',
    SUMMER_DWT: '180000',
    SUMMER_DRAFT: '18.2',
    TPC1: '100',
    GROSS_TONN: '90000',
    NET_TONN: '55000',
    CARGO_TANK_CAP: '',
    NO_OF_GRADES: '',
    CARGO_PUMP_CAP: '',
    TOTAL_SBT_CAP: '',
    SUEZ_GRT: '',
    SUEZ_NRT: '',
    PANAMA_NRT: '',
    GRAIN_CAP1: '200000',
    BALE_CAP1: '190000',
    CRANES: '4x30t',
    GRABS: '4',
    KEEL_TOP_MAST: '',
    WTR_TOP_MAST_FB: '',
    DEL_RANGE_PORT: 'Singapore',
    DUR_FIX_PER: '1',
    TRIP_TC: '1',
    PERIOD: '30',
    NO_OF_TRIP: '1',
    DEL_DATE: '2026-02-01',
    RE_DEL_DATE: '2026-03-03',
    DUR_OPT_PER: '',
    COMM_OPT_PER: '',
    LAYCAN_FROM: '2026-01-28',
    LAYCAN_TO: '2026-02-05',
    LAYCAN_NARR: '',
    RE_DEL_RANGE: 'Rotterdam',
    HIRE_FIX_PER: '15000',
    EXCHANGE_CURRENCY: 'USD',
    EXCHANGE_RATE: '1',
    HIRE_OPT_PER: '',
    FUEL_SPECS: 'ISO 8217',
    CVE_MONTH: '1000',
    SUP_CARGO_MEAL: '',
    HOLD_CLEAN_INTER: '',
    ILOHC_USD: '',
    ILOHC_REMARKS: '',
    BRO_COMM_PAYABLE: 'Owners',
    ADD_COMM: '1.25',
    BROKER_COMM: '1.25',
    OWNERS_BANK_DET: '',
    DOC_CREAT_BY: '',
    ADDIT_INFORM: '',
    DWT_SUMMER_CP: '180000',
    DWT_TROPICAL_CP: '',
    GRAIN_CAP_CP: '',
    BALE_CAP_CP: '',
    SF_CP: '',
    LOADABLE_CP: '',
    GRT_NRT_CP: '',
    LOA_CP: '',
    GEAR_CP: '',
    BUILT_YEAR_CP: '2015',
    BEAM_CP: '',
    TPC_CP: '',
    B_FULL_SPEED_CP: '14',
    L_FULL_SPEED_CP: '13.5',
    WIND_FORCE_TCCP: '4',
    SPD_LADEN_TCCP: '13.5',
    SPD_BLST_TCCP: '14',
    CP_SPD_TCCP: '13.5',
    FO_CONS_LDN_TCCP: '35',
    DO_CONS_LDN_TCCP: '2',
    FO_CONS_BLST_TCCP: '32',
    DO_CONS_BLST_TCCP: '2',
    LODE_RATE_TCCP: '',
    DISH_RATE_TCCP: '',
    BALTIC_ROUTE: '1',
    BALTIC_DATE: '2026-01-10',
    BALTIC_RATE: '12.5',
    PERIODID: '10',
    COMID: '',
    SHEET_NO: null,
    FIXED: null,
    VESSEL_NAME: 'Atlantic Star',
    BUSINESSTYPEID: '3',
    deliveryBunkers: [
      { bunkerId: '1', qty: '500', price: '450', amount: '225000', bunkerDate: '01-02-2026', identity: 'DEL' },
    ],
    redeliveryBunkers: [
      { bunkerId: '1', qty: '400', price: '460', amount: '184000', bunkerDate: '03-03-2026', identity: 'REDEL' },
    ],
    calc: {
      tripTc: '1',
      period: '30',
      noOfTrip: '1',
      cpDate: '15-01-2026',
      cpType: '1',
      charterers: 'C001',
      delDate: '01-02-2026',
      reDelDate: '03-03-2026',
      delHfoMt: '500',
      delHfoUsd: '450',
      delMgoMt: '50',
      delMgoUsd: '700',
      reDelHfoMt: '400',
      reDelHfoUsd: '460',
      reDelMgoMt: '40',
      reDelMgoUsd: '710',
      tcDays: '30',
      utilisationDays: '30',
      dailyGrossHire: '15000',
      addCommPct: '1.25',
      brokerCommPct: '1.25',
      lessOffHire: '0',
      cve: '1000',
      otherIncome: '0',
      totalExp: '25000',
      exchangeCurrency: 'USD',
      exchangeRate: '1',
      tcDeliveryPort: 'Singapore',
      tcRedeliveryPort: 'Rotterdam',
      tcCpNumber: 'TC-OUT-001',
      ...calcTcTotals({
        tcDays: 30,
        dailyGrossHire: 15000,
        addCommPct: 1.25,
        brokerCommPct: 1.25,
        lessOffHire: 0,
        cve: 1000,
        otherIncome: 0,
        totalExp: 25000,
        delHfoMt: 500,
        delHfoUsd: 450,
        delMgoMt: 50,
        delMgoUsd: 700,
        reDelHfoMt: 400,
        reDelHfoUsd: 460,
        reDelMgoMt: 40,
        reDelMgoUsd: 710,
      }),
    },
    otherIncome: [],
    otherExpenses: [{ expenseTypeId: '1', description: 'Port Charges', addToTotal: true, amount: '25000' }],
    offHires: [],
    hirePeriods: [],
    itinerary: { from: {}, to: {} },
    itineraryExpenses: [],
  },
];

let mockDecisionCharts = [];

function toListRow(item, index) {
  return mapTcListRow({
    TCOUTID: item.TCOUTID,
    VESSEL_TYPE: item.VESSEL_TYPE,
    EXCHANGE_RATE: item.EXCHANGE_RATE,
    COMID: item.COMID,
    VESSEL_NAME: item.VESSEL_NAME,
    TC_DAYS_EST: item.calc?.tcDays,
    TOTAL_REV_EST: item.calc?.totalRev,
    TC_NO: item.TC_NO,
    CP_DATE1: item.CP_DATE1,
    DWT_SUMMER_CP: item.DWT_SUMMER_CP,
    DEL_RANGE_PORT: item.DEL_RANGE_PORT,
    RE_DEL_RANGE: item.RE_DEL_RANGE,
    HIRE_FIX_PER: item.HIRE_FIX_PER,
  }, index);
}

function toDetail(item) {
  return mapTcDetail(item, {
    vesselName: item.VESSEL_NAME || '',
    deliveryBunkers: item.deliveryBunkers || [],
    redeliveryBunkers: item.redeliveryBunkers || [],
    calc: item.calc || null,
    otherIncome: item.otherIncome || [],
    otherExpenses: item.otherExpenses || [],
    offHires: item.offHires || [],
    hirePeriods: item.hirePeriods || [],
    itinerary: item.itinerary || { from: {}, to: {} },
    itineraryExpenses: item.itineraryExpenses || [],
    tcInExpenses: item.tcInExpenses || null,
  });
}

function parseDmy(value) {
  if (!value) return null;
  const parts = String(value).split(/[-/]/);
  if (parts.length !== 3) return null;
  if (parts[0].length === 4) return parts.join('-');
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export function getTcBusinessTypes(selectedId = '2') {
  return TC_BUSINESS_TYPES.map((type) => ({
    ...type,
    selected: type.id === String(selectedId || '2'),
  }));
}

export async function getTcLookups() {
  if (isDbConfigured()) return dbGetTcLookups();
  return MOCK_LOOKUPS;
}

export async function listTcEstimates(params = {}) {
  if (isDbConfigured()) return dbListTcEstimates(params);

  const selBType = String(params.selBType || '2');
  const search = String(params.search || '').toLowerCase();
  const from = parseDmy(params.periodFrom);
  const to = parseDmy(params.periodTo);
  let rows = mockStore.filter((row) => String(row.BUSINESSTYPEID || row.ESTIMATE_TYPE) === selBType
    && row.SHEET_NO == null);

  if (from) {
    rows = rows.filter((row) => String(row.CP_DATE1 || '') >= from);
  }
  if (to) {
    rows = rows.filter((row) => String(row.CP_DATE1 || '') <= to);
  }
  if (search) {
    rows = rows.filter((row) => [
      row.VESSEL_NAME,
      row.TC_NO,
      row.DEL_RANGE_PORT,
      row.RE_DEL_RANGE,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }

  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 10));
  const offset = (page - 1) * pageSize;
  const pageRows = rows.slice(offset, offset + pageSize);
  return {
    businessType: selBType,
    records: pageRows.map((row, index) => toListRow(row, offset + index)),
    recordsTotal: rows.length,
    page,
    pageSize,
    stats: computeTcListStats(rows.map((row) => ({
      COMID: row.COMID,
      TOTAL_REV_EST: row.calc?.totalRev,
    }))),
  };
}

export async function getPeriodTcInDetails(periodId) {
  if (!periodId) return null;
  if (!isDbConfigured()) {
    return {
      periodId: String(periodId),
      hires: [],
      deliveryBunkers: [],
      redeliveryBunkers: [],
      offHires: [],
      bunkerOnOwner: '',
    };
  }
  return dbGetPeriodTcInDetails(periodId);
}

export async function getTcEstimate(tcOutId) {
  if (isDbConfigured()) return dbGetTcEstimate(tcOutId);
  const item = mockStore.find((row) => String(row.TCOUTID) === String(tcOutId));
  return item ? toDetail(item) : null;
}

export async function createTcEstimate(body = {}) {
  if (isDbConfigured()) return dbCreateTcEstimate(body);

  const vessel = MOCK_LOOKUPS.vessels.find((v) => String(v.id) === String(body.vesselImoId));
  const id = mockSeq;
  mockSeq += 1;
  const item = {
    TCOUTID: id,
    MODULEID: '1',
    MCOMPANYID: '1',
    ESTIMATE_TYPE: body.businessTypeId || '2',
    BUSINESSTYPEID: vessel?.businessTypeId || body.businessTypeId || '2',
    VESSEL_NAME: vessel?.name || 'Vessel',
    FIXTURE_TYPE: body.fixtureType || '',
    VESSEL_IMO_ID: body.vesselImoId || '',
    VESSEL_TYPE: body.vesselType || '',
    FLAG: body.flag || '',
    TC_DATE: parseDmy(body.tcDate) || '1970-01-01',
    TC_NO: body.tcNo || `TC-${id}`,
    CP_DATE1: parseDmy(body.cpDate) || '1970-01-01',
    SEL_CP_TYPE: body.cpType || '',
    SEL_CHARTERER: body.charterer || '',
    SEL_CHAR_OPER: body.charOperation || '',
    LAW_ARBITRA: body.lawArbit || '',
    CHAR_OPER_ADD: body.charOperAdd || '',
    BUILD_YARD: body.buildYard || '',
    BUILT_YEAR1: body.yearBuild || '',
    FLAG_1: body.flag1 || '',
    PORT_OF_REG: body.portOfReg || '',
    IMO_NO: body.imoNo || '',
    CLASS_ID: body.classId || '',
    LAST_SP_SURVEY: parseDmy(body.lastSpSurvey) || '1970-01-01',
    LAST_DD: parseDmy(body.lastDd) || '1970-01-01',
    OWNERS_PI: body.ownersPi || '',
    MASTERS_NAME: body.mastersName || '',
    CALL_SIGN: body.callSign || '',
    INMARSAT_TEL: body.inmarsatTel || '',
    INMARSAT_MAIL: body.inmarsatMail || '',
    LOA1: body.loa1 || '',
    BREADTH: body.breadth || '',
    SUMMER_DWT: body.summerDwt || '',
    SUMMER_DRAFT: body.summerDraft || '',
    TPC1: body.tpc1 || '',
    GROSS_TONN: body.grossTonn || '',
    NET_TONN: body.netTonn || '',
    CARGO_TANK_CAP: body.cargoTankCap || '',
    NO_OF_GRADES: body.noOfGrades || '',
    CARGO_PUMP_CAP: body.cargoPumpCap || '',
    TOTAL_SBT_CAP: body.totalSbtCap || '',
    SUEZ_GRT: body.suezGrt || '',
    SUEZ_NRT: body.suezNrt || '',
    PANAMA_NRT: body.panamaNrt || '',
    GRAIN_CAP1: body.grainCap || '',
    BALE_CAP1: body.baleCap || '',
    CRANES: body.cranes || '',
    GRABS: body.grabs || '',
    KEEL_TOP_MAST: body.keelTopMast || '',
    WTR_TOP_MAST_FB: body.waterlineTopMast || '',
    DEL_RANGE_PORT: body.delRangePort || '',
    DUR_FIX_PER: body.durFixPer || '',
    TRIP_TC: body.tripTc || '',
    PERIOD: body.period || '',
    NO_OF_TRIP: body.noOfTrip || '',
    DEL_DATE: parseDmy(body.delDate) || '1970-01-01',
    RE_DEL_DATE: parseDmy(body.reDelDate) || '1970-01-01',
    DUR_OPT_PER: body.durOptPer || '',
    COMM_OPT_PER: body.commOptPer || '',
    LAYCAN_FROM: parseDmy(body.laycanFrom) || '1970-01-01',
    LAYCAN_TO: parseDmy(body.laycanTo) || '1970-01-01',
    LAYCAN_NARR: body.laycanNarr || '',
    RE_DEL_RANGE: body.reDelRange || '',
    HIRE_FIX_PER: body.hireFixPer || '0',
    EXCHANGE_CURRENCY: body.exchangeCurrency || 'USD',
    EXCHANGE_RATE: body.exchangeRate || '1',
    HIRE_OPT_PER: body.hireOptPer || '',
    FUEL_SPECS: body.fuelSpecs || '',
    CVE_MONTH: body.cveMonth || '',
    SUP_CARGO_MEAL: body.supercargoMeals || '',
    HOLD_CLEAN_INTER: body.holdCleanInter || '',
    ILOHC_USD: body.ilohcUsd || '',
    ILOHC_REMARKS: body.ilohcRemarks || '',
    BRO_COMM_PAYABLE: body.broCommPayable || '',
    ADD_COMM: body.addComm || '',
    BROKER_COMM: body.brokerComm || '',
    OWNERS_BANK_DET: body.ownersBankDet || '',
    DOC_CREAT_BY: body.docCreatBy || '',
    ADDIT_INFORM: body.additInform || '',
    DWT_SUMMER_CP: body.dwtSummerCp || body.summerDwt || '',
    DWT_TROPICAL_CP: body.dwtTropicalCp || '',
    GRAIN_CAP_CP: body.grainCapCp || '',
    BALE_CAP_CP: body.baleCapCp || '',
    SF_CP: body.sfCp || '',
    LOADABLE_CP: body.loadableCp || '',
    GRT_NRT_CP: body.grtNrtCp || '',
    LOA_CP: body.loaCp || '',
    GEAR_CP: body.gearCp || '',
    BUILT_YEAR_CP: body.builtYearCp || '',
    BEAM_CP: body.beamCp || '',
    TPC_CP: body.tpcCp || '',
    B_FULL_SPEED_CP: body.bFullSpeedCp || '',
    L_FULL_SPEED_CP: body.lFullSpeedCp || '',
    WIND_FORCE_TCCP: body.windForce || '',
    SPD_LADEN_TCCP: body.speedLaden || '',
    SPD_BLST_TCCP: body.speedBallast || '',
    CP_SPD_TCCP: body.cpSpeed || '',
    FO_CONS_LDN_TCCP: body.foConsLaden || '',
    DO_CONS_LDN_TCCP: body.doConsLaden || '',
    FO_CONS_BLST_TCCP: body.foConsBallast || '',
    DO_CONS_BLST_TCCP: body.doConsBallast || '',
    LODE_RATE_TCCP: body.loadRate || '',
    DISH_RATE_TCCP: body.dischRate || '',
    BALTIC_ROUTE: body.balticRoute || '',
    BALTIC_DATE: parseDmy(body.balticDate) || '1970-01-01',
    BALTIC_RATE: body.balticRate || '',
    PERIODID: body.periodId || '',
    COMID: '',
    SHEET_NO: null,
    FIXED: null,
    deliveryBunkers: body.deliveryBunkers || [],
    redeliveryBunkers: body.redeliveryBunkers || [],
    calc: null,
    otherIncome: [],
    otherExpenses: [],
    offHires: [],
  };
  mockStore = [item, ...mockStore];
  return { msg: 0, tcOutId: id };
}

export async function updateTcEstimate(tcOutId, body = {}) {
  if (isDbConfigured()) return dbUpdateTcEstimate(tcOutId, body);
  const index = mockStore.findIndex((row) => String(row.TCOUTID) === String(tcOutId));
  if (index < 0) return null;
  const current = mockStore[index];
  const vessel = MOCK_LOOKUPS.vessels.find((v) => String(v.id) === String(body.vesselImoId || current.VESSEL_IMO_ID));
  mockStore[index] = {
    ...current,
    ESTIMATE_TYPE: body.businessTypeId || current.ESTIMATE_TYPE,
    BUSINESSTYPEID: vessel?.businessTypeId || body.businessTypeId || current.BUSINESSTYPEID,
    VESSEL_NAME: vessel?.name || body.vesselName || current.VESSEL_NAME,
    FIXTURE_TYPE: body.fixtureType ?? current.FIXTURE_TYPE,
    VESSEL_IMO_ID: body.vesselImoId ?? current.VESSEL_IMO_ID,
    VESSEL_TYPE: body.vesselType ?? current.VESSEL_TYPE,
    FLAG: body.flag ?? current.FLAG,
    TC_DATE: parseDmy(body.tcDate) || current.TC_DATE,
    TC_NO: body.tcNo ?? current.TC_NO,
    CP_DATE1: parseDmy(body.cpDate) || current.CP_DATE1,
    SEL_CP_TYPE: body.cpType ?? current.SEL_CP_TYPE,
    SEL_CHARTERER: body.charterer ?? current.SEL_CHARTERER,
    SEL_CHAR_OPER: body.charOperation ?? current.SEL_CHAR_OPER,
    LAW_ARBITRA: body.lawArbit ?? current.LAW_ARBITRA,
    CHAR_OPER_ADD: body.charOperAdd ?? current.CHAR_OPER_ADD,
    BUILD_YARD: body.buildYard ?? current.BUILD_YARD,
    BUILT_YEAR1: body.yearBuild ?? current.BUILT_YEAR1,
    FLAG_1: body.flag1 ?? current.FLAG_1,
    PORT_OF_REG: body.portOfReg ?? current.PORT_OF_REG,
    IMO_NO: body.imoNo ?? current.IMO_NO,
    CLASS_ID: body.classId ?? current.CLASS_ID,
    LAST_SP_SURVEY: parseDmy(body.lastSpSurvey) || current.LAST_SP_SURVEY,
    LAST_DD: parseDmy(body.lastDd) || current.LAST_DD,
    OWNERS_PI: body.ownersPi ?? current.OWNERS_PI,
    MASTERS_NAME: body.mastersName ?? current.MASTERS_NAME,
    CALL_SIGN: body.callSign ?? current.CALL_SIGN,
    INMARSAT_TEL: body.inmarsatTel ?? current.INMARSAT_TEL,
    INMARSAT_MAIL: body.inmarsatMail ?? current.INMARSAT_MAIL,
    LOA1: body.loa1 ?? current.LOA1,
    BREADTH: body.breadth ?? current.BREADTH,
    SUMMER_DWT: body.summerDwt ?? current.SUMMER_DWT,
    SUMMER_DRAFT: body.summerDraft ?? current.SUMMER_DRAFT,
    TPC1: body.tpc1 ?? current.TPC1,
    GROSS_TONN: body.grossTonn ?? current.GROSS_TONN,
    NET_TONN: body.netTonn ?? current.NET_TONN,
    CARGO_TANK_CAP: body.cargoTankCap ?? current.CARGO_TANK_CAP,
    NO_OF_GRADES: body.noOfGrades ?? current.NO_OF_GRADES,
    CARGO_PUMP_CAP: body.cargoPumpCap ?? current.CARGO_PUMP_CAP,
    TOTAL_SBT_CAP: body.totalSbtCap ?? current.TOTAL_SBT_CAP,
    SUEZ_GRT: body.suezGrt ?? current.SUEZ_GRT,
    SUEZ_NRT: body.suezNrt ?? current.SUEZ_NRT,
    PANAMA_NRT: body.panamaNrt ?? current.PANAMA_NRT,
    GRAIN_CAP1: body.grainCap ?? current.GRAIN_CAP1,
    BALE_CAP1: body.baleCap ?? current.BALE_CAP1,
    CRANES: body.cranes ?? current.CRANES,
    GRABS: body.grabs ?? current.GRABS,
    KEEL_TOP_MAST: body.keelTopMast ?? current.KEEL_TOP_MAST,
    WTR_TOP_MAST_FB: body.waterlineTopMast ?? current.WTR_TOP_MAST_FB,
    DEL_RANGE_PORT: body.delRangePort ?? current.DEL_RANGE_PORT,
    RE_DEL_RANGE: body.reDelRange ?? current.RE_DEL_RANGE,
    HIRE_FIX_PER: body.hireFixPer ?? current.HIRE_FIX_PER,
    EXCHANGE_CURRENCY: body.exchangeCurrency ?? current.EXCHANGE_CURRENCY,
    EXCHANGE_RATE: body.exchangeRate ?? current.EXCHANGE_RATE,
    HIRE_OPT_PER: body.hireOptPer ?? current.HIRE_OPT_PER,
    FUEL_SPECS: body.fuelSpecs ?? current.FUEL_SPECS,
    ADD_COMM: body.addComm ?? current.ADD_COMM,
    BROKER_COMM: body.brokerComm ?? current.BROKER_COMM,
    BRO_COMM_PAYABLE: body.broCommPayable ?? current.BRO_COMM_PAYABLE,
    OWNERS_BANK_DET: body.ownersBankDet ?? current.OWNERS_BANK_DET,
    DOC_CREAT_BY: body.docCreatBy ?? current.DOC_CREAT_BY,
    ADDIT_INFORM: body.additInform ?? current.ADDIT_INFORM,
    SUP_CARGO_MEAL: body.supercargoMeals ?? current.SUP_CARGO_MEAL,
    HOLD_CLEAN_INTER: body.holdCleanInter ?? current.HOLD_CLEAN_INTER,
    ILOHC_USD: body.ilohcUsd ?? current.ILOHC_USD,
    ILOHC_REMARKS: body.ilohcRemarks ?? current.ILOHC_REMARKS,
    DWT_SUMMER_CP: body.dwtSummerCp ?? body.summerDwt ?? current.DWT_SUMMER_CP,
    TRIP_TC: body.tripTc ?? current.TRIP_TC,
    PERIOD: body.period ?? current.PERIOD,
    NO_OF_TRIP: body.noOfTrip ?? current.NO_OF_TRIP,
    DEL_DATE: parseDmy(body.delDate) || current.DEL_DATE,
    RE_DEL_DATE: parseDmy(body.reDelDate) || current.RE_DEL_DATE,
    DUR_OPT_PER: body.durOptPer ?? current.DUR_OPT_PER,
    COMM_OPT_PER: body.commOptPer ?? current.COMM_OPT_PER,
    LAYCAN_FROM: parseDmy(body.laycanFrom) || current.LAYCAN_FROM,
    LAYCAN_TO: parseDmy(body.laycanTo) || current.LAYCAN_TO,
    LAYCAN_NARR: body.laycanNarr ?? current.LAYCAN_NARR,
    CVE_MONTH: body.cveMonth ?? current.CVE_MONTH,
    WIND_FORCE_TCCP: body.windForce ?? current.WIND_FORCE_TCCP,
    SPD_LADEN_TCCP: body.speedLaden ?? current.SPD_LADEN_TCCP,
    SPD_BLST_TCCP: body.speedBallast ?? current.SPD_BLST_TCCP,
    CP_SPD_TCCP: body.cpSpeed ?? current.CP_SPD_TCCP,
    FO_CONS_LDN_TCCP: body.foConsLaden ?? current.FO_CONS_LDN_TCCP,
    DO_CONS_LDN_TCCP: body.doConsLaden ?? current.DO_CONS_LDN_TCCP,
    FO_CONS_BLST_TCCP: body.foConsBallast ?? current.FO_CONS_BLST_TCCP,
    DO_CONS_BLST_TCCP: body.doConsBallast ?? current.DO_CONS_BLST_TCCP,
    FO_CONS_LDN2_TCCP: body.foConsLdg ?? current.FO_CONS_LDN2_TCCP,
    DO_CONS_LDN2_TCCP: body.doConsLdg ?? current.DO_CONS_LDN2_TCCP,
    FO_CONS_DISH_TCCP: body.foConsDisch ?? current.FO_CONS_DISH_TCCP,
    DO_CONS_DISH_TCCP: body.doConsDisch ?? current.DO_CONS_DISH_TCCP,
    FO_CONS_IDLE_TCCP: body.foConsIdle ?? current.FO_CONS_IDLE_TCCP,
    DO_CONS_IDLE_TCCP: body.doConsIdle ?? current.DO_CONS_IDLE_TCCP,
    LODE_RATE_TCCP: body.loadRate ?? current.LODE_RATE_TCCP,
    DISH_RATE_TCCP: body.dischRate ?? current.DISH_RATE_TCCP,
    BALTIC_ROUTE: body.balticRoute ?? current.BALTIC_ROUTE,
    BALTIC_DATE: parseDmy(body.balticDate) || current.BALTIC_DATE,
    BALTIC_RATE: body.balticRate ?? current.BALTIC_RATE,
    PERIODID: body.periodId ?? current.PERIODID,
    deliveryBunkers: body.deliveryBunkers ?? current.deliveryBunkers,
    redeliveryBunkers: body.redeliveryBunkers ?? current.redeliveryBunkers,
  };
  return { msg: 0, tcOutId: Number(tcOutId) };
}

export async function saveTcCalculation(tcOutId, body = {}) {
  if (isDbConfigured()) return dbSaveTcCalculation(tcOutId, body);
  const item = mockStore.find((row) => String(row.TCOUTID) === String(tcOutId));
  if (!item) return null;
  const calcInput = { ...(body.calc || body) };
  if (!calcInput.dailyGrossHire) {
    calcInput.dailyGrossHire = dailyGrossHire(item.HIRE_FIX_PER, item.EXCHANGE_RATE);
  }
  if (calcInput.addCommPct == null || calcInput.addCommPct === '') {
    calcInput.addCommPct = item.ADD_COMM || '0';
  }
  if (calcInput.brokerCommPct == null || calcInput.brokerCommPct === '') {
    calcInput.brokerCommPct = item.BROKER_COMM || '0';
  }
  if (!calcInput.hirePeriods?.length && body.hirePeriods?.length) {
    calcInput.hirePeriods = body.hirePeriods;
  }
  if (!calcInput.offHires?.length && body.offHires?.length) {
    calcInput.offHires = body.offHires;
  }
  const totals = calcTcTotals(calcInput);
  item.calc = { ...calcInput, ...totals };
  item.otherIncome = body.otherIncome || [];
  item.otherExpenses = body.otherExpenses || [];
  item.offHires = body.offHires || [];
  item.hirePeriods = body.hirePeriods || totals.hirePeriods || [];
  item.itinerary = body.itinerary || { from: {}, to: {} };
  item.itineraryExpenses = body.itineraryExpenses || [];
  item.tcInExpenses = body.tcInExpenses || null;
  return { msg: 0, tcOutId: Number(tcOutId), calc: item.calc };
}

export async function deleteTcEstimate(tcOutId) {
  if (isDbConfigured()) return dbDeleteTcEstimate(tcOutId);
  const exists = mockStore.some((row) => String(row.TCOUTID) === String(tcOutId));
  if (!exists) return null;
  mockStore = mockStore.filter((row) => String(row.TCOUTID) !== String(tcOutId));
  return { msg: 2 };
}

export async function getTcCompareEstimates(ids) {
  if (isDbConfigured()) return dbGetTcCompareEstimates(ids);
  const idList = (Array.isArray(ids) ? ids : String(ids).split(',')).map(String);
  const selected = mockStore.filter((row) => idList.includes(String(row.TCOUTID)));
  return {
    count: selected.length,
    fixtures: selected.map((row, index) => ({ ...toListRow(row, index), remarks: '' })),
  };
}

export async function getTcDecisionChartDetails(message) {
  if (isDbConfigured()) return dbGetTcDecisionChartDetails(message);
  const chart = mockDecisionCharts.find((row) => String(row.message) === String(message));
  if (!chart) return null;
  const details = await getTcCompareEstimates(chart.candidates.map((candidate) => candidate.tcOutId));
  const candidates = new Map(chart.candidates.map((candidate) => [String(candidate.tcOutId), candidate]));
  return {
    message: chart.message,
    fixtures: details.fixtures.map((fixture) => ({
      ...fixture,
      status: fixture.sentToDecisionChart ? 'Finalised' : 'Not Fixed',
      remarks: candidates.get(String(fixture.tcOutId))?.remarks || '',
      isFinal: String(fixture.tcOutId) === String(chart.finalId),
    })),
  };
}

export async function submitTcDecisionChart(payload = {}) {
  if (isDbConfigured()) return dbSubmitTcDecisionChart(payload);
  const finalId = payload.finalId;
  const candidates = payload.candidates || [];
  if (!finalId) {
    const error = new Error('Final selection is required.');
    error.status = 400;
    throw error;
  }
  if (!candidates.length) {
    const error = new Error('At least one candidate is required.');
    error.status = 400;
    throw error;
  }
  const messageNo = String(mockCompareSeq).padStart(3, '0');
  mockCompareSeq += 1;
  const yearSuffix = String(new Date().getFullYear()).slice(-2);
  const message = `${yearSuffix}-${messageNo}`;
  const finalItem = mockStore.find((row) => String(row.TCOUTID) === String(finalId));
  if (finalItem) finalItem.COMID = String(9000 + mockCompareSeq);
  mockDecisionCharts = [
    {
      index: 1,
      message,
      messageNo,
      tcOutId: Number(finalId),
      tcNo: finalItem?.TC_NO || '',
      vesselName: finalItem?.VESSEL_NAME || '',
      ports: `${finalItem?.DEL_RANGE_PORT || ''}/${finalItem?.RE_DEL_RANGE || ''}`,
      addOnDate: new Date().toLocaleDateString('en-GB').split('/').join('-'),
      addedBy: 'Internal User',
      finalId,
      candidates,
    },
    ...mockDecisionCharts,
  ];
  return { msg: 0, message, messageNo };
}

/** Send fixture(s) straight into TC Ops (logged-in user as operator). */
export async function sendTcEstimatesToOps(tcOutIds = []) {
  if (isDbConfigured()) return dbSendTcEstimatesToOps(tcOutIds);

  const ids = [...new Set(
    (Array.isArray(tcOutIds) ? tcOutIds : [tcOutIds])
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  )];
  if (!ids.length) {
    const error = new Error('Please select at least one Fixture');
    error.status = 400;
    throw error;
  }

  const fixtures = [];
  for (const tcOutId of ids) {
    const item = mockStore.find((row) => String(row.TCOUTID) === String(tcOutId));
    if (!item) {
      const error = new Error(`Fixture ${tcOutId} was not found.`);
      error.status = 404;
      throw error;
    }
    if (item.FIXED === 1 || item.FIXED === '1' || (item.COMID != null && String(item.COMID).trim() !== '')) {
      const error = new Error(`Fixture ${tcOutId} was already sent to Ops.`);
      error.status = 400;
      throw error;
    }

    const messageNo = String(mockCompareSeq).padStart(3, '0');
    mockCompareSeq += 1;
    const yearSuffix = String(new Date().getFullYear()).slice(-2);
    const message = `${yearSuffix}-${messageNo}`;
    const comId = String(9000 + mockCompareSeq);
    item.COMID = comId;
    item.FIXED = 1;

    mockDecisionCharts = [
      {
        index: 1,
        message,
        messageNo,
        tcOutId: Number(tcOutId),
        tcNo: item.TC_NO || '',
        vesselName: item.VESSEL_NAME || '',
        ports: `${item.DEL_RANGE_PORT || ''}/${item.RE_DEL_RANGE || ''}`,
        addOnDate: new Date().toLocaleDateString('en-GB').split('/').join('-'),
        addedBy: 'Internal User',
        finalId: tcOutId,
        candidates: [{ tcOutId, remarks: '' }],
      },
      ...mockDecisionCharts,
    ];
    fixtures.push({ tcOutId, comId, message, messageNo });
  }

  return { msg: 0, fixtures };
}

export async function listTcDecisionCharts(params = {}) {
  if (isDbConfigured()) return dbListTcDecisionCharts(params);
  const search = String(params.search || '').toLowerCase();
  let rows = [...mockDecisionCharts];
  if (search) {
    rows = rows.filter((row) => [
      row.message,
      row.messageNo,
      row.tcNo,
      row.vesselName,
      row.ports,
      row.addOnDate,
      row.addedBy,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 10));
  const offset = (page - 1) * pageSize;
  return {
    records: rows.slice(offset, offset + pageSize).map((row, index) => ({
      ...row,
      index: offset + index + 1,
    })),
    recordsTotal: rows.length,
    page,
    pageSize,
  };
}

/** Exposed for unit tests. */
export function __resetTcMockStoreForTests() {
  mockSeq = 2002;
  mockCompareSeq = 1;
  mockDecisionCharts = [];
  const seed = mockStore.find((row) => Number(row.TCOUTID) === 2001);
  if (seed) {
    seed.COMID = '';
    seed.TC_NO = 'TC-OUT-001';
    seed.HIRE_FIX_PER = '15000';
    mockStore = [seed];
  }
}

export { calcTcTotals, dailyGrossHire, TC_BUSINESS_TYPES };

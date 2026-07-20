import { appContext } from '../config.js';
import { getPool } from '../db.js';
import {
  formatDateDMY,
  formatDateTimeDMY,
  mapCalcRow,
  mapTcDetail,
  mapTcListRow,
  nullIfEmpty,
  parsePeriodDate,
  toDbDate,
  calcTcTotals,
} from './tcEstimateMappers.js';

const MODULE_ID = process.env.VC_MODULE_ID || process.env.MODULE_ID || appContext.moduleId;
const COMPANY_ID = process.env.COMPANY_ID || appContext.companyId;
const USER_ID = process.env.USER_ID || appContext.userId;

function masterPayload(body = {}) {
  return {
    ESTIMATE_TYPE: nullIfEmpty(body.businessTypeId) || '3',
    FIXTURE_TYPE: nullIfEmpty(body.fixtureType),
    VESSEL_IMO_ID: nullIfEmpty(body.vesselImoId),
    VESSEL_TYPE: nullIfEmpty(body.vesselType),
    FLAG: nullIfEmpty(body.flag),
    TC_DATE: toDbDate(body.tcDate),
    TC_NO: nullIfEmpty(body.tcNo),
    CP_DATE1: toDbDate(body.cpDate),
    SEL_CP_TYPE: nullIfEmpty(body.cpType),
    SEL_CHARTERER: nullIfEmpty(body.charterer),
    SEL_CHAR_OPER: nullIfEmpty(body.charOperation),
    CHARTERING_PIC: nullIfEmpty(body.charteringTeam) || '7',
    CHARTERING_PIC_1: nullIfEmpty(body.charteringPic1),
    CHARTERING_PIC_2: nullIfEmpty(body.charteringPic2),
    LAW_ARBITRA: nullIfEmpty(body.lawArbit),
    CHAR_OPER_ADD: nullIfEmpty(body.charOperAdd),
    BUILD_YARD: nullIfEmpty(body.buildYard),
    BUILT_YEAR1: nullIfEmpty(body.yearBuild),
    FLAG_1: nullIfEmpty(body.flag1),
    PORT_OF_REG: nullIfEmpty(body.portOfReg),
    IMO_NO: nullIfEmpty(body.imoNo),
    CLASS_ID: nullIfEmpty(body.classId),
    LAST_SP_SURVEY: toDbDate(body.lastSpSurvey),
    LAST_DD: toDbDate(body.lastDd),
    OWNERS_PI: nullIfEmpty(body.ownersPi),
    MASTERS_NAME: nullIfEmpty(body.mastersName),
    CALL_SIGN: nullIfEmpty(body.callSign),
    INMARSAT_TEL: nullIfEmpty(body.inmarsatTel),
    INMARSAT_MAIL: nullIfEmpty(body.inmarsatMail),
    LOA1: nullIfEmpty(body.loa1),
    BREADTH: nullIfEmpty(body.breadth),
    SUMMER_DWT: nullIfEmpty(body.summerDwt),
    SUMMER_DRAFT: nullIfEmpty(body.summerDraft),
    TPC1: nullIfEmpty(body.tpc1),
    GROSS_TONN: nullIfEmpty(body.grossTonn),
    NET_TONN: nullIfEmpty(body.netTonn),
    CARGO_TANK_CAP: nullIfEmpty(body.cargoTankCap),
    NO_OF_GRADES: nullIfEmpty(body.noOfGrades),
    CARGO_PUMP_CAP: nullIfEmpty(body.cargoPumpCap),
    TOTAL_SBT_CAP: nullIfEmpty(body.totalSbtCap),
    SUEZ_GRT: nullIfEmpty(body.suezGrt),
    SUEZ_NRT: nullIfEmpty(body.suezNrt),
    PANAMA_NRT: nullIfEmpty(body.panamaNrt),
    GRAIN_CAP1: nullIfEmpty(body.grainCap),
    BALE_CAP1: nullIfEmpty(body.baleCap),
    CRANES: nullIfEmpty(body.cranes),
    GRABS: nullIfEmpty(body.grabs),
    KEEL_TOP_MAST: nullIfEmpty(body.keelTopMast),
    WTR_TOP_MAST_FB: nullIfEmpty(body.waterlineTopMast),
    DEL_RANGE_PORT: nullIfEmpty(body.delRangePort),
    DUR_FIX_PER: nullIfEmpty(body.durFixPer),
    TRIP_TC: nullIfEmpty(body.tripTc),
    PERIOD: nullIfEmpty(body.period),
    NO_OF_TRIP: nullIfEmpty(body.noOfTrip),
    DEL_DATE: toDbDate(body.delDate, true),
    RE_DEL_DATE: toDbDate(body.reDelDate, true),
    DUR_OPT_PER: nullIfEmpty(body.durOptPer),
    COMM_OPT_PER: nullIfEmpty(body.commOptPer),
    LAYCAN_FROM: toDbDate(body.laycanFrom, true),
    LAYCAN_TO: toDbDate(body.laycanTo, true),
    LAYCAN_NARR: nullIfEmpty(body.laycanNarr),
    RE_DEL_RANGE: nullIfEmpty(body.reDelRange),
    HIRE_FIX_PER: nullIfEmpty(body.hireFixPer),
    EXCHANGE_CURRENCY: nullIfEmpty(body.exchangeCurrency) || 'USD',
    EXCHANGE_RATE: nullIfEmpty(body.exchangeRate) || '1',
    HIRE_OPT_PER: nullIfEmpty(body.hireOptPer),
    FUEL_SPECS: nullIfEmpty(body.fuelSpecs),
    CVE_MONTH: nullIfEmpty(body.cveMonth),
    SUP_CARGO_MEAL: nullIfEmpty(body.supercargoMeals),
    HOLD_CLEAN_INTER: nullIfEmpty(body.holdCleanInter),
    ILOHC_USD: nullIfEmpty(body.ilohcUsd),
    ILOHC_REMARKS: nullIfEmpty(body.ilohcRemarks),
    BRO_COMM_PAYABLE: nullIfEmpty(body.broCommPayable),
    ADD_COMM: nullIfEmpty(body.addComm),
    BROKER_COMM: nullIfEmpty(body.brokerComm),
    OWNERS_BANK_DET: nullIfEmpty(body.ownersBankDet),
    DOC_CREAT_BY: nullIfEmpty(body.docCreatBy),
    ADDIT_INFORM: nullIfEmpty(body.additInform),
    DWT_SUMMER_CP: nullIfEmpty(body.dwtSummerCp),
    DWT_TROPICAL_CP: nullIfEmpty(body.dwtTropicalCp),
    GRAIN_CAP_CP: nullIfEmpty(body.grainCapCp),
    BALE_CAP_CP: nullIfEmpty(body.baleCapCp),
    SF_CP: nullIfEmpty(body.sfCp),
    LOADABLE_CP: nullIfEmpty(body.loadableCp),
    GRT_NRT_CP: nullIfEmpty(body.grtNrtCp),
    LOA_CP: nullIfEmpty(body.loaCp),
    GEAR_CP: nullIfEmpty(body.gearCp),
    BUILT_YEAR_CP: nullIfEmpty(body.builtYearCp),
    BEAM_CP: nullIfEmpty(body.beamCp),
    TPC_CP: nullIfEmpty(body.tpcCp),
    B_FULL_SPEED_CP: nullIfEmpty(body.bFullSpeedCp),
    L_FULL_SPEED_CP: nullIfEmpty(body.lFullSpeedCp),
    WIND_FORCE_TCCP: nullIfEmpty(body.windForce),
    SPD_LADEN_TCCP: nullIfEmpty(body.speedLaden),
    SPD_BLST_TCCP: nullIfEmpty(body.speedBallast),
    CP_SPD_TCCP: nullIfEmpty(body.cpSpeed),
    FO_CONS_LDN_TCCP: nullIfEmpty(body.foConsLaden),
    DO_CONS_LDN_TCCP: nullIfEmpty(body.doConsLaden),
    FO_CONS_BLST_TCCP: nullIfEmpty(body.foConsBallast),
    DO_CONS_BLST_TCCP: nullIfEmpty(body.doConsBallast),
    FO_CONS_LDN2_TCCP: nullIfEmpty(body.foConsLdg),
    DO_CONS_LDN2_TCCP: nullIfEmpty(body.doConsLdg),
    FO_CONS_DISH_TCCP: nullIfEmpty(body.foConsDisch),
    DO_CONS_DISH_TCCP: nullIfEmpty(body.doConsDisch),
    FO_CONS_IDLE_TCCP: nullIfEmpty(body.foConsIdle),
    DO_CONS_IDLE_TCCP: nullIfEmpty(body.doConsIdle),
    LODE_RATE_TCCP: nullIfEmpty(body.loadRate),
    DISH_RATE_TCCP: nullIfEmpty(body.dischRate),
    BALTIC_ROUTE: nullIfEmpty(body.balticRoute),
    BALTIC_DATE: toDbDate(body.balticDate),
    BALTIC_RATE: nullIfEmpty(body.balticRate),
    PERIODID: nullIfEmpty(body.periodId),
  };
}

function bunkerIdentity(row = {}) {
  return String(row.IDENTITY ?? row.IDENTIFY ?? row.identity ?? '').trim().toUpperCase();
}

function mapBunkerRow(row) {
  return {
    bunkerId: row.BUNKERID != null ? String(row.BUNKERID) : '',
    amount: row.AMOUNT != null ? String(row.AMOUNT) : '',
    bunkerDate: formatDateDMY(row.BUNKER_DATE),
    qty: row.QTY != null ? String(row.QTY) : '',
    price: row.PRICE != null ? String(row.PRICE) : '',
    identity: bunkerIdentity(row),
  };
}

async function replaceMasterBunkers(connection, tcOutId, deliveryBunkers = [], redeliveryBunkers = []) {
  await connection.query('DELETE FROM chartering_estimate_tc_slave4 WHERE TCOUTID = ?', [tcOutId]);
  const rows = [
    ...deliveryBunkers.map((row) => ({ ...row, identity: 'DEL' })),
    ...redeliveryBunkers.map((row) => ({ ...row, identity: 'REDEL' })),
  ];
  for (const row of rows) {
    if (!row.bunkerId && !row.qty) continue;
    await connection.query(
      `INSERT INTO chartering_estimate_tc_slave4
       (TCOUTID, BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tcOutId,
        nullIfEmpty(row.bunkerId),
        nullIfEmpty(row.amount),
        toDbDate(row.bunkerDate),
        nullIfEmpty(row.qty),
        nullIfEmpty(row.price),
        row.identity,
      ],
    );
  }
}

async function loadMasterBunkers(pool, tcOutId) {
  const [rows] = await pool.query(
    `SELECT BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY
     FROM chartering_estimate_tc_slave4 WHERE TCOUTID = ?`,
    [tcOutId],
  );
  return {
    deliveryBunkers: rows.filter((r) => bunkerIdentity(r) === 'DEL').map(mapBunkerRow),
    redeliveryBunkers: rows.filter((r) => bunkerIdentity(r) === 'REDEL').map(mapBunkerRow),
  };
}

function strCons(value) {
  return value != null && String(value).trim() !== '' ? String(value) : '';
}

function mapTcSlave6Row(row) {
  return {
    bunkerId: row.BUNKERID != null ? String(row.BUNKERID) : '',
    bunkerName: row.BUNKER_NAME || '',
    balSecaFs: strCons(row.FO_BALAST_ATSEA_SECA_CONSP_FS),
    ladSecaFs: strCons(row.FO_LADEN_ATSEA_SECA_CONSP_FS),
    balNonSecaFs: strCons(row.FO_BALAST_ATSEA_NONSECA_CONSP_FS),
    ladNonSecaFs: strCons(row.FO_LADEN_ATSEA_NONSECA_CONSP_FS),
    balSecaSs: strCons(row.FO_BALAST_ATSEA_SECA_CONSP_SS),
    ladSecaSs: strCons(row.FO_LADEN_ATSEA_SECA_CONSP_SS),
    balNonSecaSs: strCons(row.FO_BALAST_ATSEA_NONSECA_CONSP_SS),
    ladNonSecaSs: strCons(row.FO_LADEN_ATSEA_NONSECA_CONSP_SS),
    balSecaMes: strCons(row.FO_BALAST_ATSEA_SECA_CONSP_MES),
    ladSecaMes: strCons(row.FO_LADEN_ATSEA_SECA_CONSP_MES),
    balNonSecaMes: strCons(row.FO_BALAST_ATSEA_NONSECA_CONSP_MES),
    ladNonSecaMes: strCons(row.FO_LADEN_ATSEA_NONSECA_CONSP_MES),
    inPortSecaWorking: strCons(row.FO_INPORT_SECA_CONSP_WORKING),
    inPortNonSecaWorking: strCons(row.FO_INPORT_NONSECA_CONSP_WORKING),
    inPortSecaIdle: strCons(row.FO_INPORT_SECA_CONSP_IDLE),
    inPortNonSecaIdle: strCons(row.FO_INPORT_NONSECA_CONSP_IDLE),
    inPortSecaOther: strCons(row.FO_INPORT_SECA_CONSP_OTHER),
    inPortNonSecaOther: strCons(row.FO_INPORT_NONSECA_CONSP_OTHER),
  };
}

/** PHP chartering_estimate_tc_slave6 — FO/DO commercial consumption for fixture note tab 2. */
async function loadTcSlave6Consumptions(pool, tcOutId) {
  try {
    const [rows] = await pool.query(
      `SELECT s6.*, bg.NAME AS BUNKER_NAME
       FROM chartering_estimate_tc_slave6 s6
       LEFT JOIN bunker_grade_master bg ON bg.BUNKERGRADEID = s6.BUNKERID
       WHERE s6.TCOUTID = ?`,
      [tcOutId],
    );
    const mapped = rows.map(mapTcSlave6Row);
    return {
      foConsumptions: rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => String(row.IDENTIFY || '').toUpperCase() === 'FO')
        .map(({ index }) => mapped[index]),
      doConsumptions: rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => String(row.IDENTIFY || '').toUpperCase() === 'DO')
        .map(({ index }) => mapped[index]),
    };
  } catch {
    return { foConsumptions: [], doConsumptions: [] };
  }
}

async function loadCalcExtras(pool, slave1Id) {
  if (!slave1Id) {
    return {
      otherIncome: [],
      otherExpenses: [],
      offHires: [],
      calcBunkersDel: [],
      calcBunkersRedel: [],
      hirePeriods: [],
      itinerary: { from: {}, to: {} },
      itineraryExpenses: [],
      tcInExpenses: null,
    };
  }
  const [incomeRows] = await pool.query(
    `SELECT DESCRIPTION, OTHER_AMT FROM chartering_estimate_tc_slave2
     WHERE TC_SLAVE1ID = ? AND STATUS = 1`,
    [slave1Id],
  );
  const [expenseRows] = await pool.query(
    `SELECT EXPENSETYPEID, DESCRIPTION, CHK_ADDTTL, OTHER_AMT FROM chartering_estimate_tc_slave2
     WHERE TC_SLAVE1ID = ? AND STATUS = 2`,
    [slave1Id],
  );
  const [offHireRows] = await pool.query(
    `SELECT OFF_REASON, OFF_FROM, OFF_TO, OFF_DAYS, HIRE_RATE, OFF_HIRE
     FROM chartering_estimate_tc_slave3 WHERE TC_SLAVE1ID = ?`,
    [slave1Id],
  );
  const [bunkerRows] = await pool.query(
    `SELECT BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY
     FROM chartering_estimate_tc_slave5 WHERE TC_SLAVE1ID = ?`,
    [slave1Id],
  );

  let hirePeriods = [];
  try {
    const [periodRows] = await pool.query(
      `SELECT DEL_DATE, RE_DEL_DATE, HIRE_DAYS, HIRE_RATE, HIRE_AMT, RANDOMID
       FROM chartering_estimate_tc_slave8 WHERE TC_SLAVE1ID = ?`,
      [slave1Id],
    );
    hirePeriods = periodRows.map((r) => ({
      delDate: formatDateTimeDMY(r.DEL_DATE),
      reDelDate: formatDateTimeDMY(r.RE_DEL_DATE),
      days: r.HIRE_DAYS != null ? String(r.HIRE_DAYS) : '',
      hireRate: r.HIRE_RATE != null ? String(r.HIRE_RATE) : '',
      amount: r.HIRE_AMT != null ? String(r.HIRE_AMT) : '',
      randomId: r.RANDOMID != null ? String(r.RANDOMID) : '',
    }));
  } catch {
    hirePeriods = [];
  }

  let itinerary = { from: {}, to: {} };
  try {
    const [itinRows] = await pool.query(
      `SELECT ITINERARYTYPE, ITINERARYFROMTO, ITINERARYDATE, ITINERARYNOTES
       FROM chartering_estimate_tc_slave9 WHERE TC_SLAVE1ID = ?`,
      [slave1Id],
    );
    for (const row of itinRows) {
      const mapped = {
        place: row.ITINERARYFROMTO ?? '',
        date: formatDateDMY(row.ITINERARYDATE),
        notes: row.ITINERARYNOTES ?? '',
      };
      if (String(row.ITINERARYTYPE).toUpperCase() === 'TO') itinerary.to = mapped;
      else itinerary.from = mapped;
    }
  } catch {
    itinerary = { from: {}, to: {} };
  }

  let itineraryExpenses = [];
  try {
    const [expRows] = await pool.query(
      `SELECT EXPENSETYPE, EXPENSEDESC, EXPENSEAMOUNT, EXPENSENOTES
       FROM chartering_estimate_tc_slave10 WHERE TC_SLAVE1ID = ?`,
      [slave1Id],
    );
    itineraryExpenses = expRows.map((r) => ({
      expenseType: r.EXPENSETYPE ?? '',
      description: r.EXPENSEDESC ?? '',
      amount: r.EXPENSEAMOUNT != null ? String(r.EXPENSEAMOUNT) : '',
      notes: r.EXPENSENOTES ?? '',
    }));
  } catch {
    itineraryExpenses = [];
  }

  let tcInExpenses = null;
  try {
    const [tcInHires] = await pool.query(
      `SELECT RANDOMID, TC_DELIVERY_DATE, TC_REDELIVERY_DATE, TC_RATE, TD_DAYS, HIERAGE,
              BALLAST_BONUS, GROSS_HIERAGE, ADD_COMM, ADD_COMM_AMT, ADD_COMM_VENDOR,
              BROKERAGE_COMM, BROKERAGE_COMM_AMT, BRO_COMM_VENDOR, NET_HIERAGE, CVE_MONTH, CVE_AMOUNT
       FROM chartering_tc_estimate_slave2 WHERE TC_SLAVE1ID = ?`,
      [slave1Id],
    );
    const [tcInBunkerRows] = await pool.query(
      `SELECT BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTIFY
       FROM chartering_tc_estimate_slave3 WHERE TC_SLAVE1ID = ?`,
      [slave1Id],
    ).catch(() => [[]]);
    const [tcInOffRows] = await pool.query(
      `SELECT OFFHIRE_REASON, OFF_HIRE_FROM, OFF_HIRE_TO, OFF_HIRE_DAYS, OFF_HIRE_RATE, OF_HIRE_AMT, RANDOMID
       FROM chartering_tc_estimate_slave4 WHERE TC_SLAVE1ID = ?`,
      [slave1Id],
    ).catch(() => [[]]);

    if (tcInHires.length || tcInBunkerRows.length || tcInOffRows.length) {
      tcInExpenses = {
        hires: tcInHires.map((r) => ({
          randomId: r.RANDOMID != null ? String(r.RANDOMID) : '',
          deliveryDate: formatDateTimeDMY(r.TC_DELIVERY_DATE),
          redeliveryDate: formatDateTimeDMY(r.TC_REDELIVERY_DATE),
          voyageDays: r.TD_DAYS != null ? String(r.TD_DAYS) : '',
          dailyHire: r.TC_RATE != null ? String(r.TC_RATE) : '',
          hireage: r.HIERAGE != null ? String(r.HIERAGE) : '',
          ballastBonus: r.BALLAST_BONUS != null ? String(r.BALLAST_BONUS) : '',
          grossHireage: r.GROSS_HIERAGE != null ? String(r.GROSS_HIERAGE) : '',
          addCommPct: r.ADD_COMM != null ? String(r.ADD_COMM) : '',
          addCommAmt: r.ADD_COMM_AMT != null ? String(r.ADD_COMM_AMT) : '',
          addCommVendor: r.ADD_COMM_VENDOR != null ? String(r.ADD_COMM_VENDOR) : '',
          brokerCommPct: r.BROKERAGE_COMM != null ? String(r.BROKERAGE_COMM) : '',
          brokerCommAmt: r.BROKERAGE_COMM_AMT != null ? String(r.BROKERAGE_COMM_AMT) : '',
          brokerVendor: r.BRO_COMM_VENDOR != null ? String(r.BRO_COMM_VENDOR) : '',
          nettHireage: r.NET_HIERAGE != null ? String(r.NET_HIERAGE) : '',
          cveMonth: r.CVE_MONTH != null ? String(r.CVE_MONTH) : '',
          cveAmt: r.CVE_AMOUNT != null ? String(r.CVE_AMOUNT) : '',
        })),
        deliveryBunkers: tcInBunkerRows.filter((r) => bunkerIdentity(r) === 'DEL').map(mapBunkerRow),
        redeliveryBunkers: tcInBunkerRows.filter((r) => bunkerIdentity(r) === 'REDEL').map(mapBunkerRow),
        offHires: tcInOffRows.map((r) => ({
          reason: r.OFFHIRE_REASON ?? '',
          from: formatDateTimeDMY(r.OFF_HIRE_FROM),
          to: formatDateTimeDMY(r.OFF_HIRE_TO),
          days: r.OFF_HIRE_DAYS != null ? String(r.OFF_HIRE_DAYS) : '',
          hireRate: r.OFF_HIRE_RATE != null ? String(r.OFF_HIRE_RATE) : '',
          amount: r.OF_HIRE_AMT != null ? String(r.OF_HIRE_AMT) : '',
          randomId: r.RANDOMID != null ? String(r.RANDOMID) : '',
        })),
      };
    }
  } catch {
    tcInExpenses = null;
  }

  return {
    otherIncome: incomeRows.map((r) => ({
      description: r.DESCRIPTION ?? '',
      amount: r.OTHER_AMT != null ? String(r.OTHER_AMT) : '',
    })),
    otherExpenses: expenseRows.map((r) => ({
      expenseTypeId: r.EXPENSETYPEID != null ? String(r.EXPENSETYPEID) : '',
      description: r.DESCRIPTION ?? '',
      addToTotal: Number(r.CHK_ADDTTL || 0) === 1,
      amount: r.OTHER_AMT != null ? String(r.OTHER_AMT) : '',
    })),
    offHires: offHireRows.map((r) => ({
      reason: r.OFF_REASON ?? '',
      from: formatDateTimeDMY(r.OFF_FROM) || formatDateDMY(r.OFF_FROM),
      to: formatDateTimeDMY(r.OFF_TO) || formatDateDMY(r.OFF_TO),
      days: r.OFF_DAYS != null ? String(r.OFF_DAYS) : '',
      hireRate: r.HIRE_RATE != null ? String(r.HIRE_RATE) : '',
      amount: r.OFF_HIRE != null ? String(r.OFF_HIRE) : '',
    })),
    calcBunkersDel: bunkerRows.filter((r) => bunkerIdentity(r) === 'DEL').map(mapBunkerRow),
    calcBunkersRedel: bunkerRows.filter((r) => bunkerIdentity(r) === 'REDEL').map(mapBunkerRow),
    hirePeriods,
    itinerary,
    itineraryExpenses,
    tcInExpenses,
  };
}

export async function dbGetTcLookups() {
  const pool = getPool();
  const [[fixtureTypes], [cpTypes], [charterers], [vendors], [lawArbit], [bunkers], [expenseTypes], [routes], [periods], [vessels], [charteringPics]] = await Promise.all([
    pool.query(`SELECT FIXTURETYPEID AS id, FIXTURE_TYPE AS name FROM fixture_type_master
      WHERE MODULEID = ? AND MCOMPANYID = ? ORDER BY FIXTURE_TYPE`, [MODULE_ID, COMPANY_ID]).catch(() => [[]]),
    // PHP getContractTypeList(): contract_type_master.CONTRACTTYPEID
    pool.query(`SELECT CONTRACTTYPEID AS id, CONTRACT_TYPE AS name FROM contract_type_master
      WHERE STATUS = 1 ORDER BY CONTRACT_TYPE`).catch(() => [[]]),
    // PHP getVendorListNewUpdate(): vendor CODE is stored in SEL_CHARTERER
    pool.query(`SELECT CODE AS id, CONCAT(NAME, ' ( ', CODE, ' )') AS name
      FROM vendor_master WHERE STATUS = 1 AND MCOMPANYID = ?
      ORDER BY NAME LIMIT 1000`, [COMPANY_ID]).catch(() => [[]]),
    // PHP getVendorListNewForCOA('7,11,10,12') for Charterers Operations (SEL_CHAR_OPER)
    pool.query(`SELECT CODE AS id, CONCAT(NAME, ' ( ', CODE, ' )') AS name
      FROM vendor_master
      WHERE STATUS = 1 AND MCOMPANYID = ? AND VENDOR_TYPEID IN (7, 11, 10, 12)
      ORDER BY NAME LIMIT 1000`, [COMPANY_ID]).catch(() => [[]]),
    // PHP getLawArbitrationList(): lawarbitration_master_list.LAWARBITRA_ID
    pool.query(`SELECT LAWARBITRA_ID AS id, LAW_ARBITRATION AS name FROM lawarbitration_master_list
      WHERE STATUS = 1 ORDER BY LAW_ARBITRATION`).catch(() => [[]]),
    pool.query(`SELECT BUNKERGRADEID AS id, NAME AS name FROM bunker_grade_master
      WHERE STATUS = 1 ORDER BY NAME`).catch(() => [[]]),
    pool.query(`SELECT EXPENSETYPEID AS id, EXPENSE_TYPE AS name FROM expense_type_master
      WHERE MODULEID = ? AND MCOMPANYID = ? ORDER BY EXPENSE_TYPE`, [MODULE_ID, COMPANY_ID]).catch(() => [[]]),
    pool.query(`SELECT ROUTEID AS id, ROUTE_NAME AS name FROM baltic_route_master
      WHERE MODULEID = ? AND MCOMPANYID = ? ORDER BY ROUTE_NAME`, [MODULE_ID, COMPANY_ID]).catch(() => [[]]),
    pool.query(`SELECT PERIODID AS id, PERIOD_CONTRACT AS name FROM period_contract_master
      WHERE MODULEID = ? AND MCOMPANYID = ? ORDER BY PERIODID DESC LIMIT 200`, [MODULE_ID, COMPANY_ID]).catch(() => [[]]),
    pool.query(`SELECT VESSEL_IMO_ID AS id, VESSEL_NAME AS name, BUSINESSTYPEID AS businessTypeId
      FROM vessel_imo_master WHERE MODULEID = ? AND MCOMPANYID = ? AND STATUS = 1
      ORDER BY VESSEL_NAME LIMIT 500`, [MODULE_ID, COMPANY_ID]).catch(() => [[]]),
    pool.query(`SELECT LOGINID AS id, CONTACT_PERSON AS name
      FROM login
      WHERE STATUS = 1 AND USER_TYPE IN ('internal_user', 'mgmt_user') AND LOGINID != 126
      ORDER BY CONTACT_PERSON`).catch(() => [[]]),
  ]);

  let bankingDetails = [];
  try {
    const [banks] = await pool.query(
      `SELECT BD_ID AS id, CONCAT(NAME, ' - ', BANK) AS name
       FROM banking_details WHERE STATUS = 1 ORDER BY NAME`,
    );
    bankingDetails = banks.map((r) => ({ id: String(r.id), name: r.name }));
  } catch {
    bankingDetails = [];
  }

  return {
    fixtureTypes: fixtureTypes.map((r) => ({ id: String(r.id), name: r.name })),
    cpTypes: cpTypes.map((r) => ({ id: String(r.id), name: r.name })),
    charterers: charterers.map((r) => ({ id: String(r.id), name: r.name })),
    vendors: vendors.map((r) => ({ id: String(r.id), name: r.name })),
    lawArbitration: lawArbit.map((r) => ({ id: String(r.id), name: r.name })),
    bunkers: bunkers.map((r) => ({ id: String(r.id), name: r.name })),
    expenseTypes: expenseTypes.map((r) => ({ id: String(r.id), name: r.name })),
    balticRoutes: routes.map((r) => ({ id: String(r.id), name: r.name })),
    periodContracts: periods.map((r) => ({ id: String(r.id), name: r.name })),
    charteringTeams: [{ id: '7', name: 'Zafira' }],
    charteringPics: charteringPics.map((r) => ({ id: String(r.id), name: r.name })),
    vessels: vessels.map((r) => ({
      id: String(r.id),
      name: r.name,
      businessTypeId: r.businessTypeId != null ? String(r.businessTypeId) : '',
    })),
    bankingDetails,
    payableBy: [
      { id: 'Charterer', name: 'Charterer' },
      { id: 'Operator', name: 'Operator' },
      { id: 'N/A', name: 'N/A' },
    ],
    currencies: [
      { id: 'USD', name: 'USD' },
      { id: 'EURO', name: 'EURO' },
      { id: 'GBP', name: 'GBP' },
      { id: 'JPY', name: 'JPY' },
    ],
  };
}

export async function dbListTcEstimates({
  selBType = '3',
  periodFrom = '',
  periodTo = '',
  search = '',
  page = 1,
  pageSize = 10,
} = {}) {
  const pool = getPool();
  const params = [COMPANY_ID, selBType || '3'];
  let where = `
    chartering_estimate_tc_master.MCOMPANYID = ?
    AND vessel_imo_master.BUSINESSTYPEID = ?
    AND chartering_estimate_tc_master.SHEET_NO IS NULL
    AND chartering_estimate_tc_master.FIXED IS NULL
  `;

  const fromDate = parsePeriodDate(periodFrom);
  const toDate = parsePeriodDate(periodTo);
  if (fromDate) {
    where += ' AND DATE(chartering_estimate_tc_master.CP_DATE1) >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    where += ' AND DATE(chartering_estimate_tc_master.CP_DATE1) <= ?';
    params.push(toDate);
  }
  if (search) {
    where += ` AND (
      vessel_imo_master.VESSEL_NAME LIKE ?
      OR chartering_estimate_tc_master.TC_NO LIKE ?
      OR chartering_estimate_tc_master.DEL_RANGE_PORT LIKE ?
      OR chartering_estimate_tc_master.RE_DEL_RANGE LIKE ?
    )`;
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const countSql = `
    SELECT COUNT(*) AS total
    FROM chartering_estimate_tc_master
    INNER JOIN vessel_imo_master
      ON vessel_imo_master.VESSEL_IMO_ID = chartering_estimate_tc_master.VESSEL_IMO_ID
    WHERE ${where}
  `;
  const [[countRow]] = await pool.query(countSql, params);
  const recordsTotal = Number(countRow?.total || 0);
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Math.min(100, Number(pageSize) || 10));
  const offset = (safePage - 1) * safeSize;

  const listSql = `
    SELECT TCOUTID,
           chartering_estimate_tc_master.VESSEL_TYPE,
           chartering_estimate_tc_master.EXCHANGE_RATE,
           chartering_estimate_tc_master.COMID,
           vessel_imo_master.VESSEL_NAME,
           (SELECT SUM(TC_DAYS_EST) FROM chartering_tc_estimate_slave1
            WHERE chartering_tc_estimate_slave1.TCOUTID = chartering_estimate_tc_master.TCOUTID) AS TC_DAYS_EST,
           (SELECT SUM(TOTAL_REV_EST) FROM chartering_tc_estimate_slave1
            WHERE chartering_tc_estimate_slave1.TCOUTID = chartering_estimate_tc_master.TCOUTID) AS TOTAL_REV_EST,
           TC_NO, CP_DATE1, DWT_SUMMER_CP, DEL_RANGE_PORT, RE_DEL_RANGE, HIRE_FIX_PER
    FROM chartering_estimate_tc_master
    INNER JOIN vessel_imo_master
      ON vessel_imo_master.VESSEL_IMO_ID = chartering_estimate_tc_master.VESSEL_IMO_ID
    WHERE ${where}
    ORDER BY TCOUTID DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(listSql, [...params, safeSize, offset]);
  return {
    businessType: String(selBType || '3'),
    records: rows.map((row, index) => mapTcListRow(row, offset + index)),
    recordsTotal,
    page: safePage,
    pageSize: safeSize,
  };
}

/**
 * Period-contract TC In seed (php/options.php?id=103 / loadPeriodDetails).
 * Used when calculate page has PERIODID but no saved chartering_tc_estimate_slave2 rows.
 */
export async function dbGetPeriodTcInDetails(periodId) {
  const pool = getPool();
  const id = String(periodId || '').trim();
  if (!id) return null;

  const [[period]] = await pool.query(
    `SELECT PERIODID, ADD_COMM, VESSEL_IMO_ID
     FROM period_contract_master WHERE PERIODID = ? LIMIT 1`,
    [id],
  ).catch(() => [[null]]);
  if (!period) return null;

  const isBlankDt = (value) => {
    if (!value) return true;
    const str = String(value);
    return str.startsWith('0000-00-00') || str.startsWith('1970-01-01');
  };

  const [hireRows] = await pool.query(
    `SELECT HIRE_FROM, HIRE_TO, HIRE_RATE, HIRE_DAYS
     FROM period_contract_master_slave4 WHERE PERIODID = ? ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  ).catch(() => [[]]);

  const [bunkerRows] = await pool.query(
    `SELECT BUNKERGRADEID, BUNKER_DATE, BUNKER_QTY, BUNKER_AMT, BUNKER_PRICE, IDENTITY
     FROM period_contract_master_slave1 WHERE PERIODID = ? ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  ).catch(() => [[]]);

  const [offHireRows] = await pool.query(
    `SELECT PERIOD_SLAVEID, OFF_HIRE_REASON, OFF_HIRE_FROM, OFF_HIRE_TO,
            OFF_HIRE_DAYS, OFF_HIRE_RATE, OFF_HIRE_AMT
     FROM period_contract_master_slave2 WHERE PERIODID = ? ORDER BY PERIOD_SLAVEID ASC`,
    [id],
  ).catch(() => [[]]);

  const offHires = [];
  let bunkerOnOwner = 0;
  for (const row of offHireRows) {
    const [bunkers] = await pool.query(
      `SELECT BUNKERGRADEID, BUNKER_QTY, BUNKER_PRICE, BUNKER_AMT, CHK_OWNER_ACCOUNT
       FROM period_contract_master_slave21
       WHERE PERIODID = ? AND PERIOD_SLAVEID = ?`,
      [id, row.PERIOD_SLAVEID],
    ).catch(() => [[]]);
    const mappedBunkers = bunkers.map((b) => {
      const qty = Number(b.BUNKER_QTY) || 0;
      const price = Number(b.BUNKER_PRICE) || 0;
      const amount = Number(b.BUNKER_AMT) || qty * price;
      const onOwner = String(b.CHK_OWNER_ACCOUNT) === '1';
      if (onOwner) bunkerOnOwner += amount;
      return {
        bunkerId: b.BUNKERGRADEID != null ? String(b.BUNKERGRADEID) : '',
        qty: b.BUNKER_QTY != null ? String(b.BUNKER_QTY) : '',
        price: b.BUNKER_PRICE != null ? String(b.BUNKER_PRICE) : '',
        amount: amount ? amount.toFixed(2) : '',
        onOwner,
      };
    });
    offHires.push({
      reason: row.OFF_HIRE_REASON || '',
      from: isBlankDt(row.OFF_HIRE_FROM) ? '' : formatDateTimeDMY(row.OFF_HIRE_FROM),
      to: isBlankDt(row.OFF_HIRE_TO) ? '' : formatDateTimeDMY(row.OFF_HIRE_TO),
      days: row.OFF_HIRE_DAYS != null ? String(row.OFF_HIRE_DAYS) : '',
      hireRate: row.OFF_HIRE_RATE != null ? String(row.OFF_HIRE_RATE) : '',
      amount: row.OFF_HIRE_AMT != null ? String(row.OFF_HIRE_AMT) : '',
      bunkers: mappedBunkers,
    });
  }

  const mapBunker = (row) => ({
    bunkerId: row.BUNKERGRADEID != null ? String(row.BUNKERGRADEID) : '',
    bunkerDate: isBlankDt(row.BUNKER_DATE) ? '' : formatDateDMY(row.BUNKER_DATE),
    qty: row.BUNKER_QTY != null ? String(row.BUNKER_QTY) : '',
    price: row.BUNKER_PRICE != null ? String(row.BUNKER_PRICE) : '',
    amount: row.BUNKER_AMT != null ? String(row.BUNKER_AMT) : '',
  });

  const addComm = period.ADD_COMM != null ? String(period.ADD_COMM) : '';
  const hires = hireRows.map((row) => ({
    deliveryDate: isBlankDt(row.HIRE_FROM) ? '' : formatDateTimeDMY(row.HIRE_FROM),
    redeliveryDate: isBlankDt(row.HIRE_TO) ? '' : formatDateTimeDMY(row.HIRE_TO),
    voyageDays: row.HIRE_DAYS != null ? String(row.HIRE_DAYS) : '',
    dailyHire: row.HIRE_RATE != null ? String(row.HIRE_RATE) : '',
    addCommPct: addComm,
  }));

  return {
    periodId: id,
    hires: hires.length ? hires : [],
    deliveryBunkers: bunkerRows.filter((r) => String(r.IDENTITY || '').toUpperCase() === 'DEL').map(mapBunker),
    redeliveryBunkers: bunkerRows.filter((r) => String(r.IDENTITY || '').toUpperCase() === 'REDEL').map(mapBunker),
    offHires,
    bunkerOnOwner: bunkerOnOwner ? bunkerOnOwner.toFixed(2) : '',
  };
}

export async function dbGetTcEstimate(tcOutId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT * FROM chartering_estimate_tc_master
     WHERE MODULEID = ? AND MCOMPANYID = ? AND TCOUTID = ? LIMIT 1`,
    [MODULE_ID, COMPANY_ID, tcOutId],
  );
  if (!rows[0]) return null;

  let vesselName = '';
  if (rows[0].VESSEL_IMO_ID) {
    try {
      const [[vessel]] = await pool.query(
        `SELECT VESSEL_NAME FROM vessel_imo_master WHERE VESSEL_IMO_ID = ? LIMIT 1`,
        [rows[0].VESSEL_IMO_ID],
      );
      vesselName = vessel?.VESSEL_NAME || '';
    } catch {
      vesselName = '';
    }
  }

  const bunkers = await loadMasterBunkers(pool, tcOutId);
  const consumptions = await loadTcSlave6Consumptions(pool, tcOutId);
  const [calcRows] = await pool.query(
    `SELECT * FROM chartering_tc_estimate_slave1 WHERE TCOUTID = ? ORDER BY TC_SLAVE1ID DESC LIMIT 1`,
    [tcOutId],
  );
  const calc = mapCalcRow(calcRows[0] || null);
  const extras = await loadCalcExtras(pool, calcRows[0]?.TC_SLAVE1ID);
  // Fixture note always uses slave4. Calc page uses slave5 when present (PHP $num != 0), else slave4.
  return mapTcDetail(rows[0], {
    vesselName,
    deliveryBunkers: bunkers.deliveryBunkers,
    redeliveryBunkers: bunkers.redeliveryBunkers,
    foConsumptions: consumptions.foConsumptions,
    doConsumptions: consumptions.doConsumptions,
    calc: {
      ...calc,
      deliveryBunkers: extras.calcBunkersDel,
      redeliveryBunkers: extras.calcBunkersRedel,
      ilohcAmt: calc.ilohcAmt || (rows[0].ILOHC_USD != null ? String(rows[0].ILOHC_USD) : ''),
      cveMonth: calc.cveMonth || (rows[0].CVE_MONTH != null ? String(rows[0].CVE_MONTH) : ''),
    },
    otherIncome: extras.otherIncome,
    otherExpenses: extras.otherExpenses,
    offHires: extras.offHires,
    hirePeriods: extras.hirePeriods,
    itinerary: extras.itinerary,
    itineraryExpenses: extras.itineraryExpenses,
    tcInExpenses: extras.tcInExpenses
      ? {
          ...extras.tcInExpenses,
          cpDate: calc.tcCpDate || formatDateDMY(rows[0].CP_DATE1),
          contractRef: calc.tcCpNumber || rows[0].TC_NO || '',
          deliveryPort: calc.tcDeliveryPort || rows[0].DEL_RANGE_PORT || '',
          redeliveryPort: calc.tcRedeliveryPort || rows[0].RE_DEL_RANGE || '',
          offHireCveMonth: calc.tcOffHireCveMonth || '',
          offHireCveAmt: calc.tcOffHireCveAmt || '',
          bunkerOnOwner: calc.tcBunkerOnOwner || '',
          lessOffHire: calc.tcLessOffHire || '',
          ilohc: calc.tcIlohc || '',
          awrpCost: calc.awrpCost || '',
          finalHireage: calc.tcFinalHireage || '',
          finalVendor: calc.tcFinalVendor || '',
        }
      : null,
  });
}

export async function dbCreateTcEstimate(body = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const payload = masterPayload(body);
    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const [result] = await connection.query(
      `INSERT INTO chartering_estimate_tc_master
       (MODULEID, MCOMPANYID, UPDATE_ON_DATE, ${columns.join(', ')})
       VALUES (?, ?, NOW(), ${columns.map(() => '?').join(', ')})`,
      [MODULE_ID, COMPANY_ID, ...values],
    );
    const tcOutId = result.insertId;
    await replaceMasterBunkers(
      connection,
      tcOutId,
      body.deliveryBunkers || [],
      body.redeliveryBunkers || [],
    );
    await connection.commit();
    return { msg: 0, tcOutId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbUpdateTcEstimate(tcOutId, body = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query(
      `SELECT TCOUTID FROM chartering_estimate_tc_master
       WHERE MODULEID = ? AND MCOMPANYID = ? AND TCOUTID = ? LIMIT 1`,
      [MODULE_ID, COMPANY_ID, tcOutId],
    );
    if (!existing[0]) {
      await connection.rollback();
      return null;
    }
    const payload = masterPayload(body);
    const sets = Object.keys(payload).map((col) => `${col} = ?`).join(', ');
    await connection.query(
      `UPDATE chartering_estimate_tc_master
       SET ${sets}, UPDATE_ON_DATE = NOW()
       WHERE TCOUTID = ? AND MODULEID = ? AND MCOMPANYID = ?`,
      [...Object.values(payload), tcOutId, MODULE_ID, COMPANY_ID],
    );
    await replaceMasterBunkers(
      connection,
      tcOutId,
      body.deliveryBunkers || [],
      body.redeliveryBunkers || [],
    );
    await connection.commit();
    return { msg: 0, tcOutId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function replaceCalcChildren(connection, slave1Id, body = {}) {
  await connection.query('DELETE FROM chartering_estimate_tc_slave2 WHERE TC_SLAVE1ID = ?', [slave1Id]);
  await connection.query('DELETE FROM chartering_estimate_tc_slave3 WHERE TC_SLAVE1ID = ?', [slave1Id]);
  await connection.query('DELETE FROM chartering_estimate_tc_slave5 WHERE TC_SLAVE1ID = ?', [slave1Id]);
  await connection.query('DELETE FROM chartering_estimate_tc_slave8 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
  await connection.query('DELETE FROM chartering_estimate_tc_slave9 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
  await connection.query('DELETE FROM chartering_estimate_tc_slave10 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
  await connection.query('DELETE FROM chartering_tc_estimate_slave2 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
  await connection.query('DELETE FROM chartering_tc_estimate_slave3 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
  await connection.query('DELETE FROM chartering_tc_estimate_slave4 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
  await connection.query('DELETE FROM chartering_tc_estimate_slave5 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});

  for (const row of body.otherIncome || []) {
    if (!row.amount && !row.description) continue;
    await connection.query(
      `INSERT INTO chartering_estimate_tc_slave2
       (TC_SLAVE1ID, DESCRIPTION, OTHER_AMT, STATUS) VALUES (?, ?, ?, 1)`,
      [slave1Id, nullIfEmpty(row.description), nullIfEmpty(row.amount)],
    );
  }
  for (const row of body.otherExpenses || []) {
    if (!row.amount && !row.description) continue;
    await connection.query(
      `INSERT INTO chartering_estimate_tc_slave2
       (TC_SLAVE1ID, EXPENSETYPEID, DESCRIPTION, CHK_ADDTTL, OTHER_AMT, STATUS)
       VALUES (?, ?, ?, ?, ?, 2)`,
      [
        slave1Id,
        nullIfEmpty(row.expenseTypeId),
        nullIfEmpty(row.description),
        row.addToTotal ? 1 : 0,
        nullIfEmpty(row.amount),
      ],
    );
  }
  for (const row of body.offHires || []) {
    if (!row.reason && !row.amount && !row.from && !row.to) continue;
    await connection.query(
      `INSERT INTO chartering_estimate_tc_slave3
       (TC_SLAVE1ID, OFF_REASON, OFF_FROM, OFF_TO, OFF_DAYS, HIRE_RATE, OFF_HIRE)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        slave1Id,
        nullIfEmpty(row.reason),
        toDbDate(row.from, true),
        toDbDate(row.to, true),
        nullIfEmpty(row.days),
        nullIfEmpty(row.hireRate),
        nullIfEmpty(row.amount),
      ],
    );
  }

  const calcBunkers = [
    ...(body.calc?.deliveryBunkers || body.deliveryBunkers || []).map((r) => ({ ...r, identity: 'DEL' })),
    ...(body.calc?.redeliveryBunkers || body.redeliveryBunkers || []).map((r) => ({ ...r, identity: 'REDEL' })),
  ];
  for (const row of calcBunkers) {
    if (!row.bunkerId && !row.qty) continue;
    const amount = row.amount != null && row.amount !== ''
      ? row.amount
      : String((Number(row.qty) || 0) * (Number(row.price) || 0));
    await connection.query(
      `INSERT INTO chartering_estimate_tc_slave5
       (TC_SLAVE1ID, BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTITY)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        slave1Id,
        nullIfEmpty(row.bunkerId),
        nullIfEmpty(amount),
        toDbDate(row.bunkerDate),
        nullIfEmpty(row.qty),
        nullIfEmpty(row.price),
        row.identity,
      ],
    );
  }

  const hirePeriods = body.hirePeriods || body.calc?.hirePeriods || [];
  for (const row of hirePeriods) {
    if (!row.delDate && !row.reDelDate && !row.hireRate) continue;
    try {
      await connection.query(
        `INSERT INTO chartering_estimate_tc_slave8
         (TC_SLAVE1ID, DEL_DATE, RE_DEL_DATE, HIRE_DAYS, HIRE_RATE, HIRE_AMT, RANDOMID)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          slave1Id,
          toDbDate(row.delDate, true),
          toDbDate(row.reDelDate, true),
          nullIfEmpty(row.days),
          nullIfEmpty(row.hireRate),
          nullIfEmpty(row.amount),
          nullIfEmpty(row.randomId) || String(Math.floor(10000 + Math.random() * 90000)),
        ],
      );
    } catch {
      break;
    }
  }

  const itinerary = body.itinerary || {};
  for (const [type, key] of [['FROM', 'from'], ['TO', 'to']]) {
    const row = itinerary[key] || {};
    if (!row.place && !row.date && !row.notes) continue;
    try {
      await connection.query(
        `INSERT INTO chartering_estimate_tc_slave9
         (TC_SLAVE1ID, ITINERARYTYPE, ITINERARYFROMTO, ITINERARYDATE, ITINERARYNOTES)
         VALUES (?, ?, ?, ?, ?)`,
        [
          slave1Id,
          type,
          nullIfEmpty(row.place),
          toDbDate(row.date),
          nullIfEmpty(row.notes),
        ],
      );
    } catch {
      break;
    }
  }

  for (const row of body.itineraryExpenses || []) {
    if (!row.amount && !row.description && !row.expenseType) continue;
    try {
      await connection.query(
        `INSERT INTO chartering_estimate_tc_slave10
         (TC_SLAVE1ID, EXPENSETYPE, EXPENSEDESC, EXPENSEAMOUNT, EXPENSENOTES)
         VALUES (?, ?, ?, ?, ?)`,
        [
          slave1Id,
          nullIfEmpty(row.expenseType),
          nullIfEmpty(row.description),
          nullIfEmpty(row.amount),
          nullIfEmpty(row.notes),
        ],
      );
    } catch {
      break;
    }
  }

  const tcIn = body.tcInExpenses || {};
  for (const row of tcIn.hires || []) {
    if (!row.deliveryDate && !row.redeliveryDate && !row.dailyHire) continue;
    try {
      await connection.query(
        `INSERT INTO chartering_tc_estimate_slave2
         (TC_SLAVE1ID, RANDOMID, TC_DELIVERY_DATE, TC_REDELIVERY_DATE, TC_RATE, TD_DAYS,
          HIERAGE, BALLAST_BONUS, GROSS_HIERAGE, ADD_COMM, ADD_COMM_AMT, ADD_COMM_VENDOR,
          BROKERAGE_COMM, BROKERAGE_COMM_AMT, BRO_COMM_VENDOR, NET_HIERAGE, CVE_MONTH, CVE_AMOUNT)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          slave1Id,
          nullIfEmpty(row.randomId) || String(Math.floor(10000 + Math.random() * 90000)),
          toDbDate(row.deliveryDate, true),
          toDbDate(row.redeliveryDate, true),
          nullIfEmpty(row.dailyHire),
          nullIfEmpty(row.voyageDays),
          nullIfEmpty(row.hireage),
          nullIfEmpty(row.ballastBonus),
          nullIfEmpty(row.grossHireage),
          nullIfEmpty(row.addCommPct),
          nullIfEmpty(row.addCommAmt),
          nullIfEmpty(row.addCommVendor),
          nullIfEmpty(row.brokerCommPct),
          nullIfEmpty(row.brokerCommAmt),
          nullIfEmpty(row.brokerVendor),
          nullIfEmpty(row.nettHireage),
          nullIfEmpty(row.cveMonth),
          nullIfEmpty(row.cveAmt),
        ],
      );
    } catch {
      break;
    }
  }

  const tcInBunkers = [
    ...(tcIn.deliveryBunkers || []).map((r) => ({ ...r, identity: 'DEL' })),
    ...(tcIn.redeliveryBunkers || []).map((r) => ({ ...r, identity: 'REDEL' })),
  ];
  for (const row of tcInBunkers) {
    if (!row.bunkerId && !row.qty) continue;
    try {
      await connection.query(
        `INSERT INTO chartering_tc_estimate_slave3
         (TC_SLAVE1ID, BUNKERID, AMOUNT, BUNKER_DATE, QTY, PRICE, IDENTIFY)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          slave1Id,
          nullIfEmpty(row.bunkerId),
          nullIfEmpty(row.amount || String((Number(row.qty) || 0) * (Number(row.price) || 0))),
          toDbDate(row.bunkerDate),
          nullIfEmpty(row.qty),
          nullIfEmpty(row.price),
          row.identity,
        ],
      );
    } catch {
      break;
    }
  }

  for (const row of tcIn.offHires || []) {
    if (!row.reason && !row.from && !row.to && !row.amount) continue;
    try {
      await connection.query(
        `INSERT INTO chartering_tc_estimate_slave4
         (TC_SLAVE1ID, OFFHIRE_REASON, OFF_HIRE_FROM, OFF_HIRE_TO, OFF_HIRE_DAYS, OFF_HIRE_RATE, OF_HIRE_AMT, RANDOMID)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          slave1Id,
          nullIfEmpty(row.reason),
          toDbDate(row.from, true),
          toDbDate(row.to, true),
          nullIfEmpty(row.days),
          nullIfEmpty(row.hireRate),
          nullIfEmpty(row.amount),
          nullIfEmpty(row.randomId) || String(Math.floor(10000 + Math.random() * 90000)),
        ],
      );
    } catch {
      break;
    }
  }
}

export async function dbSaveTcCalculation(tcOutId, body = {}) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [masters] = await connection.query(
      `SELECT TCOUTID, HIRE_FIX_PER, EXCHANGE_RATE, ADD_COMM, BROKER_COMM
       FROM chartering_estimate_tc_master
       WHERE MODULEID = ? AND MCOMPANYID = ? AND TCOUTID = ? LIMIT 1`,
      [MODULE_ID, COMPANY_ID, tcOutId],
    );
    if (!masters[0]) {
      await connection.rollback();
      return null;
    }

    const calcInput = { ...(body.calc || body) };
    if (!calcInput.dailyGrossHire) {
      const rate = Number(masters[0].EXCHANGE_RATE);
      const exchange = Number.isFinite(rate) && rate !== 0 ? rate : 1;
      calcInput.dailyGrossHire = String(Number(masters[0].HIRE_FIX_PER || 0) * exchange);
    }
    if (calcInput.addCommPct == null || calcInput.addCommPct === '') {
      calcInput.addCommPct = masters[0].ADD_COMM != null ? String(masters[0].ADD_COMM) : '0';
    }
    if (calcInput.brokerCommPct == null || calcInput.brokerCommPct === '') {
      calcInput.brokerCommPct = masters[0].BROKER_COMM != null ? String(masters[0].BROKER_COMM) : '0';
    }
    if (!calcInput.hirePeriods?.length && body.hirePeriods?.length) {
      calcInput.hirePeriods = body.hirePeriods;
    }
    if (!calcInput.offHires?.length && body.offHires?.length) {
      calcInput.offHires = body.offHires;
    }
    if (calcInput.otherIncome == null && Array.isArray(body.otherIncome)) {
      calcInput.otherIncome = body.otherIncome.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    }
    if (calcInput.totalExp == null && Array.isArray(body.otherExpenses)) {
      calcInput.totalExp = body.otherExpenses
        .filter((row) => row.addToTotal !== false)
        .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    }
    const totals = calcTcTotals(calcInput);
    const merged = { ...calcInput, ...totals };
    const firstPeriod = (merged.hirePeriods || [])[0] || {};

    const [existing] = await connection.query(
      `SELECT TC_SLAVE1ID FROM chartering_tc_estimate_slave1 WHERE TCOUTID = ? LIMIT 1`,
      [tcOutId],
    );

    let slave1Id = existing[0]?.TC_SLAVE1ID;
    const fields = {
      TRIP_TC_EST: nullIfEmpty(merged.tripTc),
      PERIOD_TC_EST: nullIfEmpty(merged.period),
      NO_OF_TRIP_EST: nullIfEmpty(merged.noOfTrip),
      CP_DATE_EST: toDbDate(merged.cpDate),
      CP_TYPE_EST: nullIfEmpty(merged.cpType),
      CHARTERERS_EST: nullIfEmpty(merged.charterers),
      DEL_DATE_EST: toDbDate(firstPeriod.delDate || merged.delDate, true),
      REDEL_DATE_EST: toDbDate(firstPeriod.reDelDate || merged.reDelDate, true),
      DEL_HFO_MT_EST: nullIfEmpty(merged.delHfoMt),
      DEL_HFO_USD_EST: nullIfEmpty(merged.delHfoUsd),
      DEL_MGO_MT_EST: nullIfEmpty(merged.delMgoMt),
      DEL_MGO_USD_EST: nullIfEmpty(merged.delMgoUsd),
      REDEL_HFO_MT_EST: nullIfEmpty(merged.reDelHfoMt),
      REDEL_HFO_USD_EST: nullIfEmpty(merged.reDelHfoUsd),
      REDEL_MGO_MT_EST: nullIfEmpty(merged.reDelMgoMt),
      REDEL_MGO_USD_EST: nullIfEmpty(merged.reDelMgoUsd),
      DEL_HFO_AMT: nullIfEmpty(merged.delHfoAmt),
      DEL_MDO_AMT: nullIfEmpty(merged.delMdoAmt),
      REDEL_HFO_AMT: nullIfEmpty(merged.reDelHfoAmt),
      REDEL_MDO_AMT: nullIfEmpty(merged.reDelMdoAmt),
      BUNKER_DIFF_AMT: nullIfEmpty(merged.bunkerDiffAmt),
      TC_DAYS_EST: nullIfEmpty(merged.tcDays),
      UTILISATION_DAY_EST: nullIfEmpty(merged.utilisationDays),
      DAILY_GROSS_HIRE_EST: nullIfEmpty(merged.dailyGrossHire),
      ADD_COMM_EST: nullIfEmpty(merged.addCommPct),
      ADD_COMM_CAL_EST: nullIfEmpty(merged.addCommAmt),
      BROKER_COMM_EST: nullIfEmpty(merged.brokerCommPct),
      BROKER_COMM_CAL_EST: nullIfEmpty(merged.brokerCommAmt),
      NETT_HIRE_EST: nullIfEmpty(merged.nettHire),
      NETT_REV_EST: nullIfEmpty(merged.nettRev),
      LESS_OFF_HIRE_EST: nullIfEmpty(merged.lessOffHire),
      CVE_EST: nullIfEmpty(merged.cve),
      CVE_MONTH: nullIfEmpty(merged.cveMonth),
      OTHER_INCOME_EST: nullIfEmpty(merged.otherIncome),
      TOTAL_REV_EST: nullIfEmpty(merged.totalRev),
      TOTAL_EXP_EST: nullIfEmpty(merged.totalExp),
      VOYAGE_EARN_EST: nullIfEmpty(merged.voyageEarn),
      PROFIT_PER_DAY_EST: nullIfEmpty(merged.profitPerDay),
      EXCHANGE_CURRENCY: nullIfEmpty(merged.exchangeCurrency) || 'USD',
      EXCHANGE_RATE: nullIfEmpty(merged.exchangeRate) || '1',
      TC_PORT_DELIVERY: nullIfEmpty(merged.tcDeliveryPort),
      TC_PORT_REDELIVERY: nullIfEmpty(merged.tcRedeliveryPort),
      TC_CP_NUMBER: nullIfEmpty(merged.tcCpNumber),
      TC_CP_DATE: toDbDate(merged.tcCpDate || body.tcInExpenses?.cpDate),
      BALLAST_BONUS_AMT: nullIfEmpty(merged.ballastBonus),
      NET_HIRE_AMT: nullIfEmpty(merged.nettHireInvoice),
      TC_FINAL_HIERAGE: nullIfEmpty(merged.tcFinalHireage || body.tcInExpenses?.finalHireage),
      TC_FINAL_HIERAGE_VENDOR: nullIfEmpty(merged.tcFinalVendor || body.tcInExpenses?.finalVendor),
      TC_CVE_MONTH_OFFHIRE: nullIfEmpty(merged.tcOffHireCveMonth || body.tcInExpenses?.offHireCveMonth),
      TC_CVE_AMOUNT_OFFHIRE: nullIfEmpty(merged.tcOffHireCveAmt || body.tcInExpenses?.offHireCveAmt),
      TC_BUNKERS_ON_OWNER: nullIfEmpty(merged.tcBunkerOnOwner || body.tcInExpenses?.bunkerOnOwner),
      TC_OFF_HIRE: nullIfEmpty(merged.tcLessOffHire || body.tcInExpenses?.lessOffHire),
      TXT_ILOHC_TC: nullIfEmpty(merged.tcIlohc || body.tcInExpenses?.ilohc),
      AWRPCOST: nullIfEmpty(merged.awrpCost || body.tcInExpenses?.awrpCost),
    };

    const optionalCalcCols = new Set([
      'CVE_MONTH',
      'BALLAST_BONUS_AMT',
      'NET_HIRE_AMT',
      'TC_FINAL_HIERAGE',
      'TC_FINAL_HIERAGE_VENDOR',
      'TC_CVE_MONTH_OFFHIRE',
      'TC_CVE_AMOUNT_OFFHIRE',
      'TC_BUNKERS_ON_OWNER',
      'TC_OFF_HIRE',
      'TXT_ILOHC_TC',
      'AWRPCOST',
      'TC_CP_DATE',
    ]);
    async function upsertSlave1(fieldMap) {
      const cols = Object.keys(fieldMap);
      try {
        if (!slave1Id) {
          const [insertResult] = await connection.query(
            `INSERT INTO chartering_tc_estimate_slave1
             (TCOUTID, UPDATE_ON_DATE, ${cols.join(', ')})
             VALUES (?, NOW(), ${cols.map(() => '?').join(', ')})`,
            [tcOutId, ...Object.values(fieldMap)],
          );
          slave1Id = insertResult.insertId;
        } else {
          const sets = cols.map((col) => `${col} = ?`).join(', ');
          await connection.query(
            `UPDATE chartering_tc_estimate_slave1
             SET ${sets}, UPDATE_ON_DATE = NOW()
             WHERE TC_SLAVE1ID = ? AND TCOUTID = ?`,
            [...Object.values(fieldMap), slave1Id, tcOutId],
          );
        }
      } catch (error) {
        const msg = String(error?.message || '');
        const unknown = msg.match(/Unknown column '([^']+)'/i);
        if (unknown && optionalCalcCols.has(unknown[1]) && fieldMap[unknown[1]] !== undefined) {
          const next = { ...fieldMap };
          delete next[unknown[1]];
          return upsertSlave1(next);
        }
        throw error;
      }
    }

    await upsertSlave1(fields);

    await replaceCalcChildren(connection, slave1Id, {
      ...body,
      hirePeriods: body.hirePeriods || merged.hirePeriods,
      calc: {
        ...(body.calc || {}),
        deliveryBunkers: body.calc?.deliveryBunkers || body.deliveryBunkers,
        redeliveryBunkers: body.calc?.redeliveryBunkers || body.redeliveryBunkers,
        hirePeriods: body.hirePeriods || merged.hirePeriods,
      },
    });
    await connection.commit();
    return { msg: 0, tcOutId, slave1Id, calc: merged };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbDeleteTcEstimate(tcOutId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [masters] = await connection.query(
      `SELECT TCOUTID FROM chartering_estimate_tc_master
       WHERE MODULEID = ? AND MCOMPANYID = ? AND TCOUTID = ? LIMIT 1`,
      [MODULE_ID, COMPANY_ID, tcOutId],
    );
    if (!masters[0]) {
      await connection.rollback();
      return null;
    }

    const [calcRows] = await connection.query(
      `SELECT TC_SLAVE1ID FROM chartering_tc_estimate_slave1 WHERE TCOUTID = ?`,
      [tcOutId],
    );
    for (const row of calcRows) {
      const slave1Id = row.TC_SLAVE1ID;
      await connection.query('DELETE FROM chartering_estimate_tc_slave2 WHERE TC_SLAVE1ID = ?', [slave1Id]);
      await connection.query('DELETE FROM chartering_estimate_tc_slave3 WHERE TC_SLAVE1ID = ?', [slave1Id]);
      await connection.query('DELETE FROM chartering_estimate_tc_slave5 WHERE TC_SLAVE1ID = ?', [slave1Id]);
      await connection.query('DELETE FROM chartering_estimate_tc_slave8 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
      await connection.query('DELETE FROM chartering_estimate_tc_slave9 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
      await connection.query('DELETE FROM chartering_estimate_tc_slave10 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
      await connection.query('DELETE FROM chartering_tc_estimate_slave2 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
      await connection.query('DELETE FROM chartering_tc_estimate_slave3 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
      await connection.query('DELETE FROM chartering_tc_estimate_slave4 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
      await connection.query('DELETE FROM chartering_tc_estimate_slave5 WHERE TC_SLAVE1ID = ?', [slave1Id]).catch(() => {});
    }

    await connection.query('DELETE FROM chartering_tc_estimate_slave1 WHERE TCOUTID = ?', [tcOutId]);
    await connection.query('DELETE FROM chartering_estimate_tc_slave1 WHERE TCOUTID = ?', [tcOutId]).catch(() => {});
    await connection.query('DELETE FROM chartering_estimate_tc_slave2 WHERE TCOUTID = ?', [tcOutId]).catch(() => {});
    await connection.query('DELETE FROM chartering_estimate_tc_slave3 WHERE TCOUTID = ?', [tcOutId]).catch(() => {});
    await connection.query('DELETE FROM chartering_estimate_tc_slave4 WHERE TCOUTID = ?', [tcOutId]);
    await connection.query('DELETE FROM chartering_estimate_tc_slave5 WHERE TCOUTID = ?', [tcOutId]).catch(() => {});
    await connection.query('DELETE FROM chartering_estimate_tc_slave6 WHERE TCOUTID = ?', [tcOutId]).catch(() => {});
    await connection.query('DELETE FROM chartering_estimate_tc_master WHERE TCOUTID = ?', [tcOutId]);
    await connection.commit();
    return { msg: 2 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbGetTcCompareEstimates(ids = []) {
  const idList = (Array.isArray(ids) ? ids : String(ids).split(','))
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (!idList.length) return { count: 0, fixtures: [] };

  const pool = getPool();
  const placeholders = idList.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT TCOUTID,
            vessel_imo_master.VESSEL_NAME,
            chartering_estimate_tc_master.VESSEL_TYPE,
            chartering_estimate_tc_master.EXCHANGE_RATE,
            (SELECT SUM(TC_DAYS_EST) FROM chartering_tc_estimate_slave1
             WHERE chartering_tc_estimate_slave1.TCOUTID = chartering_estimate_tc_master.TCOUTID) AS TC_DAYS_EST,
            (SELECT SUM(TOTAL_REV_EST) FROM chartering_tc_estimate_slave1
             WHERE chartering_tc_estimate_slave1.TCOUTID = chartering_estimate_tc_master.TCOUTID) AS TOTAL_REV_EST,
            TC_NO, CP_DATE1, DWT_SUMMER_CP, DEL_RANGE_PORT, RE_DEL_RANGE, HIRE_FIX_PER, COMID, FIXED
     FROM chartering_estimate_tc_master
     INNER JOIN vessel_imo_master
       ON vessel_imo_master.VESSEL_IMO_ID = chartering_estimate_tc_master.VESSEL_IMO_ID
     WHERE MODULEID = ? AND chartering_estimate_tc_master.MCOMPANYID = ?
       AND TCOUTID IN (${placeholders})
     ORDER BY TCOUTID DESC`,
    [MODULE_ID, COMPANY_ID, ...idList],
  );

  return {
    count: rows.length,
    fixtures: rows.map((row, index) => ({
      ...mapTcListRow(row, index),
      status: Number(row.FIXED) === 1 ? 'Finalised' : 'Not Fixed',
      remarks: '',
    })),
  };
}

export async function dbGetTcDecisionChartDetails(message) {
  const chartMessage = String(message || '').trim();
  if (!chartMessage) {
    const error = new Error('Decision chart is required.');
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const [compareRows] = await pool.query(
    `SELECT TCOUTID, FINAL_ID, REMARKS
     FROM chartering_estimate_tc_compare
     WHERE MODULEID = ? AND MCOMPANYID = ? AND MESSAGE = ?
     ORDER BY COMID`,
    [MODULE_ID, COMPANY_ID, chartMessage],
  );
  if (!compareRows.length) return null;

  const details = await dbGetTcCompareEstimates(compareRows.map((row) => row.TCOUTID));
  const compareById = new Map(compareRows.map((row) => [String(row.TCOUTID), row]));
  return {
    message: chartMessage,
    fixtures: details.fixtures.map((fixture) => {
      const comparison = compareById.get(String(fixture.tcOutId)) || {};
      return {
        ...fixture,
        remarks: comparison.REMARKS ?? '',
        isFinal: String(comparison.FINAL_ID || '') === String(fixture.tcOutId),
      };
    }),
  };
}

async function nextMessageNo(connection) {
  const year = new Date().getFullYear();
  const [[row]] = await connection.query(
    `SELECT MAX(MESSAGE_NO) AS MESSAGE_NO
     FROM chartering_estimate_tc_compare
     WHERE YEAR(ADD_ON_DATE) = ?`,
    [year],
  );
  let next = row?.MESSAGE_NO != null ? Number(row.MESSAGE_NO) + 1 : 1;
  if (!Number.isFinite(next) || next < 1) next = 1;
  return String(next).padStart(3, '0');
}

export async function dbSubmitTcDecisionChart({ finalId, candidates = [] } = {}) {
  if (!finalId) {
    const error = new Error('Final selection is required.');
    error.status = 400;
    throw error;
  }
  const rows = Array.isArray(candidates) ? candidates : [];
  if (!rows.length) {
    const error = new Error('At least one candidate is required.');
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const messageNo = await nextMessageNo(connection);
    const yearSuffix = String(new Date().getFullYear()).slice(-2);
    const message = `${yearSuffix}-${messageNo}`;

    for (const candidate of rows) {
      const tcOutId = candidate.tcOutId || candidate.id;
      const isFinal = String(tcOutId) === String(finalId);
      await connection.query(
        `INSERT INTO chartering_estimate_tc_compare
         (TCOUTID, FINAL_ID, MESSAGE_NO, USERID, REMARKS, ADD_ON_DATE, MESSAGE, MODULEID, MCOMPANYID)
         VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [
          tcOutId,
          isFinal ? finalId : '',
          messageNo,
          USER_ID,
          nullIfEmpty(candidate.remarks) || '',
          message,
          MODULE_ID,
          COMPANY_ID,
        ],
      );
      if (isFinal) {
        const [[comRow]] = await connection.query(
          `SELECT MAX(COMID) AS MAX
           FROM chartering_estimate_tc_compare
           WHERE MESSAGE = ? AND FINAL_ID != ''`,
          [message],
        );
        await connection.query(
          `UPDATE chartering_estimate_tc_master SET COMID = ? WHERE TCOUTID = ?`,
          [comRow.MAX, tcOutId],
        );
      }
    }

    await connection.commit();
    return { msg: 0, message, messageNo };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function dbListTcDecisionCharts({ page = 1, pageSize = 10, search = '' } = {}) {
  const pool = getPool();
  const params = [MODULE_ID, COMPANY_ID];
  let where = `MODULEID = ? AND MCOMPANYID = ? AND FINAL_ID != ''`;
  if (search) {
    where += ` AND (
      MESSAGE LIKE ?
      OR MESSAGE_NO LIKE ?
      OR TC_NO LIKE ?
      OR VESSEL_NAME LIKE ?
      OR CONTACT_PERSON LIKE ?
      OR DEL_RANGE_PORT LIKE ?
      OR ADD_ON_DATE LIKE ?
    )`;
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like, like);
  }

  const baseFrom = `
    FROM (
      SELECT
        c.COMID,
        c.MESSAGE,
        c.MESSAGE_NO,
        c.USERID,
        c.ADD_ON_DATE,
        c.TCOUTID AS TCOUTIDD,
        c.MCOMPANYID,
        c.MODULEID,
        c.FINAL_ID,
        (SELECT CONTACT_PERSON FROM login WHERE login.LOGINID = c.USERID LIMIT 1) AS CONTACT_PERSON,
        (SELECT CONCAT(IFNULL(m.DEL_RANGE_PORT, ''), ' / ', IFNULL(m.RE_DEL_RANGE, ''))
         FROM chartering_estimate_tc_master m
         WHERE m.TCOUTID = c.TCOUTID
         LIMIT 1) AS DEL_RANGE_PORT,
        (SELECT m.TC_NO FROM chartering_estimate_tc_master m WHERE m.TCOUTID = c.TCOUTID LIMIT 1) AS TC_NO,
        (SELECT v.VESSEL_NAME
         FROM vessel_imo_master v
         INNER JOIN chartering_estimate_tc_master m ON m.VESSEL_IMO_ID = v.VESSEL_IMO_ID
         WHERE m.TCOUTID = c.TCOUTID
         LIMIT 1) AS VESSEL_NAME
      FROM chartering_estimate_tc_compare c
    ) AS chartList
  `;

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total ${baseFrom} WHERE ${where}`,
    params,
  );
  const recordsTotal = Number(countRow?.total || 0);
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Math.min(100, Number(pageSize) || 10));
  const offset = (safePage - 1) * safeSize;

  const [rows] = await pool.query(
    `SELECT MESSAGE, MESSAGE_NO, ADD_ON_DATE, FINAL_ID, TCOUTIDD, TC_NO, VESSEL_NAME,
            DEL_RANGE_PORT, CONTACT_PERSON
     ${baseFrom}
     WHERE ${where}
     ORDER BY ADD_ON_DATE DESC, COMID DESC
     LIMIT ? OFFSET ?`,
    [...params, safeSize, offset],
  );

  const records = rows.map((row, index) => ({
    index: offset + index + 1,
    message: row.MESSAGE ?? '',
    messageNo: row.MESSAGE_NO != null ? String(row.MESSAGE_NO) : '',
    tcOutId: row.TCOUTIDD ?? row.FINAL_ID,
    tcNo: row.TC_NO ?? '',
    vesselName: row.VESSEL_NAME ?? '',
    ports: row.DEL_RANGE_PORT ?? '/',
    addOnDate: formatDateDMY(row.ADD_ON_DATE),
    addedBy: row.CONTACT_PERSON || '',
    finalId: row.FINAL_ID,
  }));

  return { records, recordsTotal, page: safePage, pageSize: safeSize };
}

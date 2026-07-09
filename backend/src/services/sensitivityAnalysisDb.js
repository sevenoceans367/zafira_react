import { getPool } from '../db.js';
import { ESTIMATE_TYPE_LABELS } from './estimateListMappers.js';

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function portLabel(name) {
  return String(name ?? '').split('/')[0] || '';
}

async function fetchColumn(pool, id) {
  const [masterRows] = await pool.query(
    `SELECT m.*, v.VESSEL_NAME
     FROM freight_cost_estimete_master m
     LEFT JOIN vessel_imo_master v ON v.VESSEL_IMO_ID = m.VESSEL_IMO_ID
     WHERE m.FCAID = ?`,
    [id],
  );
  if (!masterRows.length) return null;
  const master = masterRows[0];

  const [[brokerage]] = await pool.query(
    `SELECT SUM(BROKAGE_AMT) AS BROKAGE_AMT, SUM(BROKAGE_PERCENT) AS BROKAGE_PERCENT
     FROM freight_cost_estimete_slave4 WHERE FCAID = ?`,
    [id],
  );

  const [[otherIncome]] = await pool.query(
    `SELECT SUM(RAW_AMOUNT) AS OTHERINCOMEAMT
     FROM freight_cost_estimete_slave3
     WHERE FCAID = ? AND IDENTIFY = 'OTHERINCOME'`,
    [id],
  );

  const [[operationalCost]] = await pool.query(
    `SELECT SUM(RAW_AMOUNT) AS OPERATIONALCOST
     FROM freight_cost_estimete_slave3
     WHERE FCAID = ? AND IDENTIFY = 'ORC'`,
    [id],
  );

  const [[ilohc]] = await pool.query(
    `SELECT RAW_AMOUNT FROM freight_cost_estimete_slave3
     WHERE FCAID = ? AND IDENTIFY = 'ORC' AND IDENTY_ID = 12`,
    [id],
  );

  const [loadPortRows] = await pool.query(
    `SELECT a.LOAD_PORT_COST, b.PortName, a.FROM_PORT
     FROM freight_cost_estimete_slave1 a
     LEFT JOIN port_master b ON b.PortId = a.FROM_PORT
     WHERE a.FCAID = ?`,
    [id],
  );

  const [discPortRows] = await pool.query(
    `SELECT a.DISC_PORT_COST, b.PortName, a.TO_PORT
     FROM freight_cost_estimete_slave1 a
     LEFT JOIN port_master b ON b.PortId = a.TO_PORT
     WHERE a.FCAID = ?`,
    [id],
  );

  const [transitPortRows] = await pool.query(
    `SELECT a.TRANSIT_PORT_COST, b.PortName, a.FROM_PORT
     FROM freight_cost_estimete_slave1 a
     LEFT JOIN port_master b ON b.PortId = a.FROM_PORT
     WHERE a.FCAID = ? AND a.CHK_MAND = 'TP'`,
    [id],
  );

  const [bunkeringPortRows] = await pool.query(
    `SELECT a.TRANSIT_PORT_COST, b.PortName, a.FROM_PORT
     FROM freight_cost_estimete_slave1 a
     LEFT JOIN port_master b ON b.PortId = a.FROM_PORT
     WHERE a.FCAID = ? AND a.CHK_MAND = 'BP'`,
    [id],
  );

  const [bunkerRows] = await pool.query(
    `SELECT b.NAME, SUM(a.EST_MT) AS EST_MT, SUM(a.EST_PRICE) AS EST_PRICE, SUM(a.EST_COST) AS EST_COST
     FROM freight_cost_estimete_slave2 a
     LEFT JOIN bunker_grade_master b ON b.BUNKERGRADEID = a.BUNKERGRADEID
     WHERE a.FCAID = ?
     GROUP BY a.BUNKERGRADEID, b.NAME
     ORDER BY a.BUNKERGRADEID`,
    [id],
  );

  const [[hireRow]] = await pool.query(
    `SELECT HIRE_RATE FROM freight_cost_estimete_slave17 WHERE FCAID = ? LIMIT 1`,
    [id],
  );

  const [freightAdjustmentRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave12 WHERE FCAID = ?`,
    [id],
  );

  const loadPorts = loadPortRows
    .filter((row) => num(row.LOAD_PORT_COST) !== 0)
    .map((row, index) => ({
      key: `lp-${index + 1}`,
      portId: String(row.FROM_PORT ?? ''),
      portName: portLabel(row.PortName),
      cost: num(row.LOAD_PORT_COST),
    }));

  const discPorts = discPortRows
    .filter((row) => num(row.DISC_PORT_COST) !== 0)
    .map((row, index) => ({
      key: `dp-${index + 1}`,
      portId: String(row.TO_PORT ?? ''),
      portName: portLabel(row.PortName),
      cost: num(row.DISC_PORT_COST),
    }));

  const transitPorts = transitPortRows
    .filter((row) => num(row.TRANSIT_PORT_COST) !== 0)
    .map((row, index) => ({
      key: `tp-${index + 1}`,
      portId: String(row.FROM_PORT ?? ''),
      portName: portLabel(row.PortName),
      cost: num(row.TRANSIT_PORT_COST),
    }));

  const bunkeringPorts = bunkeringPortRows
    .filter((row) => num(row.TRANSIT_PORT_COST) !== 0)
    .map((row, index) => ({
      key: `bp-${index + 1}`,
      portId: String(row.FROM_PORT ?? ''),
      portName: portLabel(row.PortName),
      cost: num(row.TRANSIT_PORT_COST),
    }));

  const bunkerExpenses = bunkerRows.map((row) => ({
    grade: row.NAME || 'Bunker',
    estMt: num(row.EST_MT),
    estPrice: num(row.EST_PRICE),
    estCost: num(row.EST_COST),
  }));

  const freightAdjustments = freightAdjustmentRows.length
    ? freightAdjustmentRows.map((row, index) => ({
      key: `fa-${index + 1}`,
      recordId: row.FCA_SLAVE12ID ?? row.FCA_SLAVE12_ID ?? row.SLAVE12ID ?? null,
      minCargoQty: num(row.MIN_CARGO_QTY),
      minFlatRate: num(row.MIN_FLAT_RATE),
      minWSRate: num(row.MIN_WS),
      minAmt: num(row.MIN_AMOUNT),
      overageQty: num(row.OVE_CARGO_QTY),
      overageFlatRate: num(row.OVE_FLAT_RATE),
      overageWSRate: num(row.OVE_WS),
      overageAmt: num(row.OVE_AMOUNT),
    }))
    : [{
      key: 'fa-1',
      minCargoQty: 0,
      minFlatRate: 0,
      minWSRate: 0,
      minAmt: 0,
      overageQty: 0,
      overageFlatRate: 0,
      overageWSRate: 0,
      overageAmt: 0,
    }];

  return {
    id: String(id),
    vesselName: master.VESSEL_NAME || '',
    voyageNo: master.VOYAGE_NO || '',
    cargoType: ESTIMATE_TYPE_LABELS[Number(master.ESTIMATE_TYPE)] || '',
    estimateType: Number(master.ESTIMATE_TYPE || 0),
    chkLumpSum: Boolean(Number(master.CHK_LUMPSUM)),
    freight: num(master.FREIGHT_GROSS),
    qty: num(master.BL_QTY_FREIGHT),
    lumpsumAmt: num(master.LUMPSUMAMT),
    freightAdjustments,
    loadPorts,
    discPorts,
    transitPorts,
    bunkeringPorts,
    bunkerExpenses,
    hire: {
      rate: num(hireRow?.HIRE_RATE),
      ballastBonus: num(master.BALLAST_BONUS),
      hierageAddCommPercent: num(master.HIREAGE_PERCENT),
      hierageBrokeragePercent: num(master.HIERAGE_BROKER_PERCENT),
      cvePerMonth: num(master.CVE_AMT),
      totalDays: num(master.TOTAL_DAYS),
      ilohcCost: num(ilohc?.RAW_AMOUNT),
    },
    brokeragePer: num(brokerage?.BROKAGE_PERCENT),
    brokerageAmt: num(brokerage?.BROKAGE_AMT),
    addCommPer: num(master.ADDRESS_COMMISSION_PER),
    addressCommAmt: num(master.ADDRESS_COMMISSION_AMT),
    otherIncome: num(otherIncome?.OTHERINCOMEAMT),
    operationalCost: num(operationalCost?.OPERATIONALCOST),
  };
}

export async function dbGetSensitivityAnalysis(ids) {
  const pool = getPool();
  const columns = [];

  for (const id of ids.map(String)) {
    const column = await fetchColumn(pool, id);
    if (column) columns.push(column);
  }

  const bunkerGrades = [...new Set(
    columns.flatMap((column) => column.bunkerExpenses.map((item) => item.grade)),
  )];

  return { columns, bunkerGrades };
}

export async function dbUpdateSensitivityEstimate(id, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const columnId = String(id);
    const {
      freight,
      qty,
      lumpsumAmt,
      chkLumpSum,
      freightAdjustments = [],
      loadPorts = [],
      discPorts = [],
      transitPorts = [],
      bunkeringPorts = [],
      bunkerExpenses = [],
      hire = {},
      computed = {},
    } = payload;

    const grossFreight = num(computed.grossFreight);
    const totalPreightAdj = chkLumpSum ? num(lumpsumAmt) : grossFreight;

    await connection.query(
      `UPDATE freight_cost_estimete_master
       SET FREIGHT_GROSS = ?,
           BL_QTY_FREIGHT = ?,
           LUMPSUMAMT = ?,
           CHK_LUMPSUM = ?,
           TOTAL_PREIGHT_ADJ = ?,
           FINAL_HIERAGE_AMOUNT = ?
       WHERE FCAID = ?`,
      [
        num(freight),
        num(qty),
        num(lumpsumAmt),
        chkLumpSum ? 1 : 0,
        totalPreightAdj,
        num(computed.estimatedHire),
        columnId,
      ],
    );

    for (const adjustment of freightAdjustments) {
      if (!adjustment.recordId) continue;
      await connection.query(
        `UPDATE freight_cost_estimete_slave12
         SET MIN_CARGO_QTY = ?, MIN_FLAT_RATE = ?, MIN_WS = ?, MIN_AMOUNT = ?,
             OVE_CARGO_QTY = ?, OVE_FLAT_RATE = ?, OVE_WS = ?, OVE_AMOUNT = ?
         WHERE FCA_SLAVE12ID = ?`,
        [
          num(adjustment.minCargoQty),
          num(adjustment.minFlatRate),
          num(adjustment.minWSRate),
          num(adjustment.minAmt),
          num(adjustment.overageQty),
          num(adjustment.overageFlatRate),
          num(adjustment.overageWSRate),
          num(adjustment.overageAmt),
          adjustment.recordId,
        ],
      );
    }

    for (const port of loadPorts) {
      if (!port.portId) continue;
      await connection.query(
        `UPDATE freight_cost_estimete_slave1
         SET LOAD_PORT_COST = ?
         WHERE FCAID = ? AND FROM_PORT = ?`,
        [num(port.cost), columnId, port.portId],
      );
    }

    for (const port of discPorts) {
      if (!port.portId) continue;
      await connection.query(
        `UPDATE freight_cost_estimete_slave1
         SET DISC_PORT_COST = ?
         WHERE FCAID = ? AND TO_PORT = ?`,
        [num(port.cost), columnId, port.portId],
      );
    }

    for (const port of transitPorts) {
      if (!port.portId) continue;
      await connection.query(
        `UPDATE freight_cost_estimete_slave1
         SET TRANSIT_PORT_COST = ?
         WHERE FCAID = ? AND FROM_PORT = ? AND CHK_MAND = 'TP'`,
        [num(port.cost), columnId, port.portId],
      );
    }

    for (const port of bunkeringPorts) {
      if (!port.portId) continue;
      await connection.query(
        `UPDATE freight_cost_estimete_slave1
         SET TRANSIT_PORT_COST = ?
         WHERE FCAID = ? AND FROM_PORT = ? AND CHK_MAND = 'BP'`,
        [num(port.cost), columnId, port.portId],
      );
    }

    for (const bunker of bunkerExpenses) {
      await connection.query(
        `UPDATE freight_cost_estimete_slave2 a
         INNER JOIN bunker_grade_master b ON b.BUNKERGRADEID = a.BUNKERGRADEID
         SET a.EST_PRICE = ?, a.EST_COST = ?
         WHERE a.FCAID = ? AND b.NAME = ?`,
        [num(bunker.estPrice), num(bunker.estCost), columnId, bunker.grade],
      );
    }

    await connection.query(
      `UPDATE freight_cost_estimete_slave17
       SET HIRE_RATE = ?
       WHERE FCAID = ?`,
      [num(hire.rate), columnId],
    );

    await connection.commit();
    return { success: true, id: columnId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

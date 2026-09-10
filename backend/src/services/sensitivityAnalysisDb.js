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

  const [hireRows] = await pool.query(
    `SELECT HIRE_RATE, HIRE_DAYS, HIRE_AMT FROM freight_cost_estimete_slave17 WHERE FCAID = ?`,
    [id],
  );

  const [[deliveryRow]] = await pool.query(
    `SELECT COALESCE(SUM(AMOUNT), 0) AS DELIVERY_TOTAL
     FROM freight_cost_estimete_slave13
     WHERE FCAID = ? AND IDENTITY = 'DEL'`,
    [id],
  );

  const [[redeliveryRow]] = await pool.query(
    `SELECT COALESCE(SUM(AMOUNT), 0) AS REDELIVERY_TOTAL
     FROM freight_cost_estimete_slave13
     WHERE FCAID = ? AND IDENTITY = 'REDEL'`,
    [id],
  );

  const [freightAdjustmentRows] = await pool.query(
    `SELECT * FROM freight_cost_estimete_slave12 WHERE FCAID = ?`,
    [id],
  );

  // Hire / Day: same fallback chain as estimate sheet (slave17 → DAILY_VESSEL_OPERATION_EXP).
  const hireRateFromRows = hireRows
    .map((row) => row.HIRE_RATE)
    .find((value) => value != null && String(value).trim() !== '');
  const hireRate = hireRateFromRows != null && String(hireRateFromRows).trim() !== ''
    ? num(hireRateFromRows)
    : num(master.DAILY_VESSEL_OPERATION_EXP);
  const hireDaysFromRows = hireRows.reduce((sum, row) => sum + num(row.HIRE_DAYS), 0);
  const totalDays = num(master.TOTAL_DAYS);
  const hireDays = hireDaysFromRows > 0 ? hireDaysFromRows : totalDays;

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

  const chkLumpSum = Boolean(Number(master.CHK_LUMPSUM));
  const lumpsumAmt = num(master.LUMPSUMAMT);
  const lumpsumQty = num(master.WS_QTY);
  // Dry estimates store Freight/MT on CARGO_RATE/MARKET_RATE and qty on QUANTITY.
  // FREIGHT_GROSS / TOTAL_PREIGHT_ADJ are the computed totals (Revenue Gross Freight).
  const qty = num(master.QUANTITY) || num(master.BL_QTY_FREIGHT) || lumpsumQty;
  const storedGrossFreight = num(master.FREIGHT_GROSS)
    || num(master.TOTAL_PREIGHT_ADJ)
    || num(master.REVENUES_FREIGHT);
  const cargoRate = num(master.CARGO_RATE) || num(master.MARKET_RATE);
  const freight = cargoRate || (qty > 0 && storedGrossFreight > 0
    ? storedGrossFreight / qty
    : 0);
  // Lumpsum deals store cargo qty on master.WS_QTY; seed Min Cargo Qty when slave12 is empty.
  if (chkLumpSum && lumpsumQty) {
    freightAdjustments.forEach((item) => {
      if (!num(item.minCargoQty)) item.minCargoQty = lumpsumQty;
    });
  }
  if (chkLumpSum && lumpsumAmt) {
    freightAdjustments.forEach((item) => {
      const adjQty = num(item.minCargoQty) || lumpsumQty;
      const flat = num(item.minFlatRate);
      if (adjQty && flat && !num(item.minWSRate)) {
        item.minWSRate = (lumpsumAmt * 100) / (adjQty * flat);
        item.overageWSRate = item.minWSRate;
      }
    });
  }

  return {
    id: String(id),
    vesselName: master.VESSEL_NAME || '',
    voyageNo: master.VOYAGE_NO || '',
    estimateNo: Number(master.ESTIMATE_NO) > 0 ? Number(master.ESTIMATE_NO) : 1,
    cargoType: ESTIMATE_TYPE_LABELS[Number(master.ESTIMATE_TYPE)] || '',
    estimateType: Number(master.ESTIMATE_TYPE || 0),
    chkLumpSum,
    sentToOps: Number(master.FIXED) === 1,
    freight,
    qty,
    storedGrossFreight,
    lumpsumAmt,
    lumpsumQty,
    freightAdjustments,
    loadPorts,
    discPorts,
    transitPorts,
    bunkeringPorts,
    bunkerExpenses,
    hire: {
      rate: hireRate,
      ballastBonus: num(master.BALLAST_BONUS),
      hierageAddCommPercent: num(master.HIREAGE_PERCENT),
      hierageBrokeragePercent: num(master.HIERAGE_BROKER_PERCENT),
      cvePerMonth: num(master.CVE_AMT),
      hireDays,
      totalDays,
      deliveryTotal: num(deliveryRow?.DELIVERY_TOTAL),
      redeliveryTotal: num(redeliveryRow?.REDELIVERY_TOTAL),
      lessOffHire: num(master.LESS_OFF_HIRE),
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
  )].filter((grade) => /vlsfo|lsmgo/i.test(String(grade || '')));

  // Always expose VLSFO + LSMGO so empty grades still render as dashes.
  for (const required of ['VLSFO', 'LSMGO']) {
    if (!bunkerGrades.some((grade) => new RegExp(required, 'i').test(grade))) {
      bunkerGrades.push(required);
    }
  }

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

    const grossFreight = num(computed.grossFreight)
      || (chkLumpSum ? num(lumpsumAmt) : num(freight) * num(qty));
    const totalPreightAdj = chkLumpSum ? num(lumpsumAmt) : grossFreight;

    const profitLoss = num(computed.profitLoss);
    const nettDailyProfit = num(computed.nettDailyProfit);

    // Tanker grid Cargo uses WS_QTY (lumpsum) or slave12 TOTAL_QTY / Min+Ove.
    // Prefer adjustment Min qty for lumpsum WS_QTY; dry keeps column.qty first.
    const tankerCargoQty = freightAdjustments.reduce(
      (sum, item) => sum + num(item.minCargoQty) + num(item.overageQty),
      0,
    );
    const lumpsumQtyToSave = chkLumpSum
      ? (num(freightAdjustments[0]?.minCargoQty ?? payload.lumpsumQty)
        || num(payload.lumpsumQty)
        || num(qty)
        || null)
      : null;
    const masterCargoQty = chkLumpSum
      ? (lumpsumQtyToSave || tankerCargoQty || num(qty))
      : (num(qty) || tankerCargoQty);

    // Hire/Day lives on DAILY_VESSEL_OPERATION_EXP (master) and HIRE_RATE (slave17).
    // Grid TCE/P&L read DAILY_EARNING and PROFIT_LOSS — keep those in sync on save.
    await connection.query(
      `UPDATE freight_cost_estimete_master
       SET FREIGHT_GROSS = ?,
           CARGO_RATE = ?,
           QUANTITY = ?,
           BL_QTY_FREIGHT = ?,
           TANK_QUANTITY = ?,
           LUMPSUMAMT = ?,
           CHK_LUMPSUM = ?,
           ${lumpsumQtyToSave != null ? 'WS_QTY = ?,' : ''}
           TOTAL_PREIGHT_ADJ = ?,
           REVENUES_FREIGHT = ?,
           DAILY_VESSEL_OPERATION_EXP = ?,
           FINAL_HIERAGE_AMOUNT = ?,
           PROFIT_LOSS = ?,
           DAILY_EARNING = ?,
           NET_DAILY_EARNING = ?
       WHERE FCAID = ?`,
      [
        grossFreight,
        num(freight),
        masterCargoQty,
        masterCargoQty,
        masterCargoQty,
        num(lumpsumAmt),
        chkLumpSum ? 1 : 0,
        ...(lumpsumQtyToSave != null ? [lumpsumQtyToSave] : []),
        totalPreightAdj,
        grossFreight,
        num(hire.rate),
        num(computed.estimatedHire ?? computed.netHireage),
        profitLoss,
        nettDailyProfit,
        nettDailyProfit,
        columnId,
      ],
    );

    for (const adjustment of freightAdjustments) {
      if (!adjustment.recordId) continue;
      const minQty = num(adjustment.minCargoQty);
      const oveQty = num(adjustment.overageQty);
      const totalQty = minQty + oveQty;
      const totalAmount = num(adjustment.minAmt) + num(adjustment.overageAmt);
      await connection.query(
        `UPDATE freight_cost_estimete_slave12
         SET MIN_CARGO_QTY = ?, MIN_FLAT_RATE = ?, MIN_WS = ?, MIN_AMOUNT = ?,
             OVE_CARGO_QTY = ?, OVE_FLAT_RATE = ?, OVE_WS = ?, OVE_AMOUNT = ?,
             TOTAL_QTY = ?, TOTAL_AMOUNT = ?
         WHERE FCA_SLAVE12ID = ?`,
        [
          minQty,
          num(adjustment.minFlatRate),
          num(adjustment.minWSRate),
          num(adjustment.minAmt),
          oveQty,
          num(adjustment.overageFlatRate),
          num(adjustment.overageWSRate),
          num(adjustment.overageAmt),
          totalQty,
          totalAmount,
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
         SET a.EST_MT = ?, a.EST_PRICE = ?, a.EST_COST = ?
         WHERE a.FCAID = ? AND b.NAME = ?`,
        [num(bunker.estMt), num(bunker.estPrice), num(bunker.estCost), columnId, bunker.grade],
      );
    }

    // Keep dry freight-qty rows (slave7) aligned with Qty (MT) so the list Cargo column matches.
    const [slave7Rows] = await connection.query(
      `SELECT FCA_SLAVE7ID AS id, QUANTITY AS quantity
       FROM freight_cost_estimete_slave7
       WHERE FCAID = ?`,
      [columnId],
    );
    if (slave7Rows.length === 1) {
      await connection.query(
        `UPDATE freight_cost_estimete_slave7
         SET QUANTITY = ?
         WHERE FCA_SLAVE7ID = ?`,
        [num(qty), slave7Rows[0].id],
      );
    } else if (slave7Rows.length > 1) {
      const oldSum = slave7Rows.reduce((sum, row) => sum + num(row.quantity), 0);
      for (const row of slave7Rows) {
        const nextQty = oldSum > 0
          ? (num(qty) * num(row.quantity)) / oldSum
          : 0;
        await connection.query(
          `UPDATE freight_cost_estimete_slave7
           SET QUANTITY = ?
           WHERE FCA_SLAVE7ID = ?`,
          [nextQty, row.id],
        );
      }
      if (oldSum <= 0) {
        await connection.query(
          `UPDATE freight_cost_estimete_slave7
           SET QUANTITY = ?
           WHERE FCA_SLAVE7ID = ?`,
          [num(qty), slave7Rows[0].id],
        );
      }
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

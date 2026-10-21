const EXTRA_FIELD_COLUMNS = [
  { field: 'charterer', columns: ['CHARTERER', 'SEL_CHARTERER'] },
  { field: 'charteringTeam', columns: ['CHARTERING_TEAM'] },
  { field: 'charteringPic', columns: ['CHARTERING_PIC_1'] },
  { field: 'opsPic', columns: ['OPS_PIC', 'SEL_CHAR_OPER'] },
  { field: 'recapStatus', columns: ['RECAP_STATUS'] },
  { field: 'cpType', columns: ['CP_TYPE', 'SEL_CP_TYPE'] },
  { field: 'lawArbit', columns: ['LAW_ARBIT', 'LAW_ARBITRA'] },
  { field: 'charterersAddress', columns: ['CHARTERERS_ADDRESS', 'CHARTERERS_ADD'] },
];

function pickMasterValue(master, columns) {
  for (const column of columns) {
    if (!Object.prototype.hasOwnProperty.call(master, column)) continue;
    if (master[column] == null) continue;
    const value = String(master[column]).trim();
    if (value !== '') return value;
  }
  for (const column of columns) {
    if (!Object.prototype.hasOwnProperty.call(master, column)) continue;
    return master[column] == null ? '' : String(master[column]);
  }
  return '';
}

export function mapPeriodExtraFields(master = {}) {
  const extra = {};
  for (const item of EXTRA_FIELD_COLUMNS) {
    extra[item.field] = pickMasterValue(master, item.columns);
  }
  return extra;
}

export async function applyPeriodExtraFields(connection, payload, periodId) {
  let columns = [];
  try {
    const [rows] = await connection.query(
      `SELECT COLUMN_NAME AS name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'period_contract_master'`,
    );
    columns = rows || [];
  } catch {
    return;
  }

  const have = new Set(columns.map((row) => row.name));
  const sets = [];
  const values = [];

  for (const item of EXTRA_FIELD_COLUMNS) {
    const column = item.columns.find((name) => have.has(name));
    if (!column) continue;
    const raw = payload[item.field];
    sets.push(`${column} = ?`);
    values.push(raw == null || String(raw).trim() === '' ? null : String(raw).trim());
  }

  if (!sets.length) return;

  await connection.query(
    `UPDATE period_contract_master SET ${sets.join(', ')} WHERE PERIODID = ?`,
    [...values, periodId],
  );
}

const EXTRA_FIELD_COLUMNS = [
  { field: 'charterer', columns: ['CHARTERER', 'SEL_CHARTERER'], ddl: 'VARCHAR(50) NULL' },
  { field: 'charteringTeam', columns: ['CHARTERING_PIC', 'CHARTERING_TEAM'], ddl: 'VARCHAR(50) NULL' },
  { field: 'charteringPic', columns: ['CHARTERING_PIC_1'], ddl: 'VARCHAR(50) NULL' },
  { field: 'opsPic', columns: ['CHARTERING_PIC_2', 'OPS_PIC'], ddl: 'VARCHAR(50) NULL' },
  { field: 'recapStatus', columns: ['RECAP_STATUS'], ddl: 'VARCHAR(50) NULL' },
  { field: 'cpType', columns: ['CP_TYPE', 'SEL_CP_TYPE'], ddl: 'VARCHAR(50) NULL' },
  { field: 'lawArbit', columns: ['LAW_ARBIT', 'LAW_ARBITRA'], ddl: 'VARCHAR(50) NULL' },
  { field: 'charterersAddress', columns: ['CHARTERERS_ADDRESS', 'CHARTERERS_ADD'], ddl: 'VARCHAR(500) NULL' },
];

function rowColumnName(row) {
  return String(
    row?.Field ?? row?.FIELD ?? row?.name ?? row?.NAME ?? row?.COLUMN_NAME ?? '',
  ).trim();
}

function actualColumn(have, candidates = []) {
  for (const candidate of candidates) {
    const match = have.find((name) => name.toUpperCase() === String(candidate).toUpperCase());
    if (match) return match;
  }
  return '';
}

function pickMasterValue(master, columns) {
  const keyMap = {};
  for (const key of Object.keys(master || {})) {
    keyMap[key.toUpperCase()] = key;
  }
  for (const column of columns) {
    const actual = keyMap[String(column).toUpperCase()];
    if (!actual) continue;
    if (master[actual] == null) continue;
    const value = String(master[actual]).trim();
    if (value !== '' && value !== '0') return value;
  }
  for (const column of columns) {
    const actual = keyMap[String(column).toUpperCase()];
    if (!actual) continue;
    return master[actual] == null ? '' : String(master[actual]);
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

async function listMasterColumns(connection) {
  const [rows] = await connection.query('SHOW COLUMNS FROM period_contract_master');
  return (rows || []).map(rowColumnName).filter(Boolean);
}

async function ensureExtraColumns(connection, have) {
  const names = [...have];
  for (const item of EXTRA_FIELD_COLUMNS) {
    if (actualColumn(names, item.columns)) continue;
    const column = item.columns[0];
    try {
      await connection.query(
        `ALTER TABLE period_contract_master ADD COLUMN ${column} ${item.ddl}`,
      );
      names.push(column);
    } catch (error) {
      console.error(`Could not add period_contract_master.${column}:`, error.message || error);
    }
  }
  return names;
}

export async function ensureOffHireVendorColumn(connection) {
  try {
    const [rows] = await connection.query(
      "SHOW COLUMNS FROM period_contract_master_slave2 LIKE 'VENDOR'",
    );
    if (rows?.length) return true;
    await connection.query(
      'ALTER TABLE period_contract_master_slave2 ADD COLUMN VENDOR VARCHAR(50) NULL',
    );
    return true;
  } catch (error) {
    console.error('Could not add period_contract_master_slave2.VENDOR:', error.message || error);
    return false;
  }
}

export async function applyPeriodExtraFields(connection, payload, periodId) {
  let have = [];
  try {
    have = await listMasterColumns(connection);
    have = await ensureExtraColumns(connection, have);
  } catch (error) {
    console.error('Period extra fields schema check failed:', error.message || error);
    try {
      have = await listMasterColumns(connection);
    } catch {
      return;
    }
  }

  const sets = [];
  const values = [];

  for (const item of EXTRA_FIELD_COLUMNS) {
    const column = actualColumn(have, item.columns);
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

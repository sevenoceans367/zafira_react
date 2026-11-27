import { getPool } from '../db.js';

const ID = 'laytime_negotiation';
const VERSION = 1;
const LOCK_NAME = 'zafira_laytime_negotiation_mig_v1';
const COLLATION = 'utf8mb4_unicode_ci';

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS laytime_negotiation (
  NEGO_ID BIGINT NOT NULL AUTO_INCREMENT,
  LAYTIME_ID BIGINT NOT NULL,
  ENTITY_TYPE VARCHAR(16) NOT NULL,
  VENDOR_ID BIGINT DEFAULT NULL,
  DIALOGUE_DATE DATETIME NOT NULL,
  REASON TEXT NOT NULL,
  AGREED_AMOUNT DECIMAL(18,2) DEFAULT NULL,
  CURRENCY_CODE CHAR(3) NOT NULL DEFAULT 'USD',
  STATUS VARCHAR(16) NOT NULL DEFAULT 'ON_HOLD',
  NOTES TEXT,
  SORT_ORDER INT NOT NULL DEFAULT 0,
  CREATED_BY INT NOT NULL,
  CREATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_BY INT DEFAULT NULL,
  UPDATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (NEGO_ID),
  INDEX IDX_NEGO_LAYTIME (LAYTIME_ID, SORT_ORDER),
  CONSTRAINT FK_NEGO_LAYTIME FOREIGN KEY (LAYTIME_ID)
    REFERENCES laytime_master (LAYTIME_ID) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

// Name, type, nullability, default, extra. Text columns inherit the table collation.
const COLUMNS = [
  ['NEGO_ID', 'bigint', 'NO', null, 'auto_increment'],
  ['LAYTIME_ID', 'bigint', 'NO', null, ''],
  ['ENTITY_TYPE', 'varchar(16)', 'NO', null, ''],
  ['VENDOR_ID', 'bigint', 'YES', null, ''],
  ['DIALOGUE_DATE', 'datetime', 'NO', null, ''],
  ['REASON', 'text', 'NO', null, ''],
  ['AGREED_AMOUNT', 'decimal(18,2)', 'YES', null, ''],
  ['CURRENCY_CODE', 'char(3)', 'NO', 'USD', ''],
  ['STATUS', 'varchar(16)', 'NO', 'ON_HOLD', ''],
  ['NOTES', 'text', 'YES', null, ''],
  ['SORT_ORDER', 'int', 'NO', '0', ''],
  ['CREATED_BY', 'int', 'NO', null, ''],
  ['CREATED_AT', 'datetime', 'NO', 'current_timestamp', ''],
  ['UPDATED_BY', 'int', 'YES', null, ''],
  ['UPDATED_AT', 'datetime', 'NO', 'current_timestamp', 'on update current_timestamp'],
];

let state = 'pending';
export function getLaytimeNegotiationMigrationState() {
  return state;
}

function requireSchema(condition, detail) {
  if (!condition) throw new Error(`Incompatible Laytime negotiation schema: ${detail}`);
}

function normalizeType(type) {
  return type.toLowerCase().replace(/^(bigint|int)\(\d+\)/, '$1');
}

function normalizeDefault(value) {
  if (value == null || value === 'NULL') return null;
  if (/^current_timestamp(?:\(\))?$/i.test(value)) return 'current_timestamp';
  return String(value).replace(/^'(.*)'$/, '$1');
}

async function verifyDependencies(conn) {
  const [[parent]] = await conn.query(`SELECT c.COLUMN_TYPE, c.COLUMN_KEY, c.IS_NULLABLE, t.ENGINE
    FROM information_schema.COLUMNS c JOIN information_schema.TABLES t
      ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
    WHERE c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = 'laytime_master' AND c.COLUMN_NAME = 'LAYTIME_ID'`);
  requireSchema(parent && normalizeType(parent.COLUMN_TYPE) === 'bigint' && parent.COLUMN_KEY === 'PRI'
    && parent.IS_NULLABLE === 'NO' && parent.ENGINE === 'InnoDB', 'laytime_master.LAYTIME_ID must be a signed InnoDB BIGINT primary key');

}

async function verifyTable(conn) {
  const [[table]] = await conn.query(`SELECT ENGINE, TABLE_COLLATION FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [ID]);
  requireSchema(table?.ENGINE === 'InnoDB' && table.TABLE_COLLATION === COLLATION, 'table engine or collation');

  const [columns] = await conn.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`, [ID]);
  requireSchema(columns.length === COLUMNS.length, 'column count');
  for (const [index, [name, type, nullable, defaultValue, extra]] of COLUMNS.entries()) {
    const col = columns[index];
    const collation = /^(?:var)?char|^text$/.test(type) ? COLLATION : null;
    const actualExtra = col.EXTRA.toLowerCase().replaceAll('default_generated', '').replaceAll('()', '').trim();
    requireSchema(col.COLUMN_NAME === name && normalizeType(col.COLUMN_TYPE) === type
      && col.IS_NULLABLE === nullable && normalizeDefault(col.COLUMN_DEFAULT) === defaultValue
      && actualExtra === extra && col.COLLATION_NAME === collation, `column ${name}`);
  }

  const [indexes] = await conn.query(`SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SUB_PART, INDEX_TYPE, COLLATION
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ORDER BY INDEX_NAME, SEQ_IN_INDEX`, [ID]);
  const expectedIndexes = [
    ['IDX_NEGO_LAYTIME', 'LAYTIME_ID', 1], ['IDX_NEGO_LAYTIME', 'SORT_ORDER', 1], ['PRIMARY', 'NEGO_ID', 0],
  ];
  requireSchema(indexes.length === expectedIndexes.length && indexes.every((row, index) => {
    const [name, column, nonUnique] = expectedIndexes[index];
    return row.INDEX_NAME === name && row.COLUMN_NAME === column && Number(row.NON_UNIQUE) === nonUnique
      && row.SUB_PART == null && row.INDEX_TYPE === 'BTREE' && row.COLLATION === 'A';
  }), 'primary key or port ordering index');

  const [constraints] = await conn.query(`SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [ID]);
  requireSchema(constraints.length === 2 && constraints.some((row) => row.CONSTRAINT_NAME === 'PRIMARY' && row.CONSTRAINT_TYPE === 'PRIMARY KEY')
    && constraints.some((row) => row.CONSTRAINT_NAME === 'FK_NEGO_LAYTIME' && row.CONSTRAINT_TYPE === 'FOREIGN KEY'), 'table constraints');

  const [foreignKeys] = await conn.query(`SELECT k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
      k.REFERENCED_TABLE_SCHEMA = DATABASE() AS same_schema, r.UPDATE_RULE, r.DELETE_RULE
    FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.TABLE_NAME = k.TABLE_NAME AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
    WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ? AND k.CONSTRAINT_NAME = 'FK_NEGO_LAYTIME'`, [ID]);
  const [fk] = foreignKeys;
  requireSchema(foreignKeys.length === 1 && fk.COLUMN_NAME === 'LAYTIME_ID' && Number(fk.same_schema) === 1
    && fk.REFERENCED_TABLE_NAME === 'laytime_master' && fk.REFERENCED_COLUMN_NAME === 'LAYTIME_ID'
    && fk.UPDATE_RULE === 'RESTRICT' && fk.DELETE_RULE === 'RESTRICT', 'Laytime foreign key');
}

export async function runLaytimeNegotiationMigration(pool = getPool()) {
  state = 'pending';
  let conn;
  let locked = false;
  let detail;
  try {
    conn = await pool.getConnection();
    const [[lock]] = await conn.query('SELECT GET_LOCK(?, 30) AS got', [LOCK_NAME]);
    locked = Number(lock?.got) === 1;
    if (!locked) throw new Error('Could not acquire Laytime negotiation migration lock');

    // The preceding TC migration owns creation of the shared ledger.
    const readVersion = async () => {
      const [[row]] = await conn.query('SELECT version FROM zafira_schema_migrations WHERE id = ?', [ID]);
      return row ? Number(row.version) : null;
    };
    const version = await readVersion();
    requireSchema(version == null || version === VERSION, 'unexpected migration version');
    await verifyDependencies(conn);
    if (version == null) await conn.query(CREATE_TABLE);
    await verifyTable(conn);
    if (version == null) {
      await conn.query('INSERT INTO zafira_schema_migrations (id, version, notes) VALUES (?, ?, ?)',
        [ID, VERSION, 'Persistent Laytime negotiation dialogues']);
    }
    requireSchema(await readVersion() === VERSION, 'migration ledger version');
  } catch (error) {
    detail = error.message;
  } finally {
    if (locked) {
      try {
        const [[unlock]] = await conn.query('SELECT RELEASE_LOCK(?) AS released', [LOCK_NAME]);
        if (Number(unlock?.released) !== 1) throw new Error('Failed to release Laytime negotiation migration lock');
      } catch (error) {
        detail ??= error.message;
        conn.destroy();
        conn = null;
      }
    }
    conn?.release();
  }
  state = detail ? 'failed' : 'ready';
  return { ok: state === 'ready', state, detail };
}

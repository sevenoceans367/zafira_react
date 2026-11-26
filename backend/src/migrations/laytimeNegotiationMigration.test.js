import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runLaytimeNegotiationMigration } from './laytimeNegotiationMigration.js';

function schemaFixture() {
  const column = (name, type, { nullable = false, value = null, extra = '' } = {}) => ({
    COLUMN_NAME: name, COLUMN_TYPE: type, IS_NULLABLE: nullable ? 'YES' : 'NO',
    COLUMN_DEFAULT: value, EXTRA: extra, COLLATION_NAME: /char|text/.test(type) ? 'utf8mb4_unicode_ci' : null,
  });
  const columns = [
    column('NEGO_ID', 'bigint(20)', { extra: 'auto_increment' }), column('LAYTIME_ID', 'bigint(20)'),
    column('ENTITY_TYPE', 'varchar(16)'), column('VENDOR_ID', 'bigint(20)', { nullable: true }),
    column('DIALOGUE_DATE', 'datetime'), column('REASON', 'text'), column('AGREED_AMOUNT', 'decimal(18,2)', { nullable: true }),
    column('CURRENCY_CODE', 'char(3)', { value: 'USD' }), column('STATUS', 'varchar(16)', { value: 'ON_HOLD' }),
    column('NOTES', 'text', { nullable: true }), column('SORT_ORDER', 'int(11)', { value: '0' }), column('CREATED_BY', 'int(11)'),
    column('CREATED_AT', 'datetime', { value: 'CURRENT_TIMESTAMP' }), column('UPDATED_BY', 'int(11)', { nullable: true }),
    column('UPDATED_AT', 'datetime', { value: 'CURRENT_TIMESTAMP', extra: 'on update CURRENT_TIMESTAMP' }),
  ];
  const index = (name, col, unique) => ({ INDEX_NAME: name, COLUMN_NAME: col, NON_UNIQUE: unique ? 0 : 1,
    SUB_PART: null, INDEX_TYPE: 'BTREE', COLLATION: 'A' });
  return {
    parent: { COLUMN_TYPE: 'bigint(20)', COLUMN_KEY: 'PRI', IS_NULLABLE: 'NO', ENGINE: 'InnoDB' },
    vendor: { COLUMN_TYPE: 'int(11)' },
    table: { ENGINE: 'InnoDB', TABLE_COLLATION: 'utf8mb4_unicode_ci' },
    columns,
    indexes: [index('IDX_NEGO_LAYTIME', 'LAYTIME_ID', false), index('IDX_NEGO_LAYTIME', 'SORT_ORDER', false), index('PRIMARY', 'NEGO_ID', true)],
    constraints: [
      { CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' },
      { CONSTRAINT_NAME: 'FK_NEGO_LAYTIME', CONSTRAINT_TYPE: 'FOREIGN KEY' },
    ],
    foreignKey: { COLUMN_NAME: 'LAYTIME_ID', REFERENCED_TABLE_NAME: 'laytime_master', REFERENCED_COLUMN_NAME: 'LAYTIME_ID',
      same_schema: 1, UPDATE_RULE: 'RESTRICT', DELETE_RULE: 'RESTRICT' },
  };
}

function fakePool({ schema = schemaFixture(), version = null, got = 1, released = 1 } = {}) {
  let exists = version != null;
  const sessions = [];
  const pool = { sessions, async getConnection() {
    const session = { queries: [], closed: false, destroyed: false,
      release() { this.closed = true; }, destroy() { this.destroyed = true; },
      async query(sql) {
        this.queries.push(sql);
        if (sql.includes('GET_LOCK')) return [[{ got }]];
        if (sql.includes('RELEASE_LOCK')) return [[{ released }]];
        if (sql.startsWith('SELECT version')) return [version == null ? [] : [{ version }]];
        if (sql.startsWith('INSERT INTO zafira_schema_migrations')) { version = 1; return []; }
        if (sql.startsWith('CREATE TABLE')) { exists = true; return []; }
        if (sql.includes("c.TABLE_NAME = 'laytime_master'")) return [[schema.parent]];
        if (sql.includes("TABLE_NAME = 'vendor_master'")) return [[schema.vendor]];
        if (sql.includes('information_schema.KEY_COLUMN_USAGE')) return [[schema.foreignKey]];
        if (sql.includes('information_schema.TABLE_CONSTRAINTS')) return [schema.constraints];
        if (sql.includes('information_schema.STATISTICS')) return [schema.indexes];
        if (sql.includes('information_schema.COLUMNS')) return [schema.columns];
        if (sql.includes('information_schema.TABLES')) return [exists ? [schema.table] : []];
        throw new Error(`Unexpected query ${sql}`);
      },
    };
    sessions.push(session);
    return session;
  } };
  return pool;
}

test('creates the table and stamps the existing ledger only once under the dedicated lock', async () => {
  const pool = fakePool();
  assert.equal((await runLaytimeNegotiationMigration(pool)).ok, true);
  assert.equal((await runLaytimeNegotiationMigration(pool)).ok, true);
  const [first, repeated] = pool.sessions;
  for (const { queries, closed } of pool.sessions) {
    assert.match(queries[0], /GET_LOCK/);
    assert.match(queries.at(-1), /RELEASE_LOCK/);
    assert.equal(closed, true);
  }
  assert.equal(first.queries.filter((sql) => sql.startsWith('CREATE TABLE')).length, 1);
  assert.equal(first.queries.filter((sql) => sql.startsWith('INSERT INTO')).length, 1);
  assert.equal(repeated.queries.every((sql) => sql.startsWith('SELECT')), true);
});

test('fails closed even with a ledger entry when an existing schema is incompatible', async () => {
  for (const [mutate, error] of [
    [(s) => { s.table.ENGINE = 'MyISAM'; }, /engine/],
    [(s) => { s.columns[6].COLUMN_TYPE = 'decimal(18,3)'; }, /AGREED_AMOUNT/],
    [(s) => { s.columns[14].EXTRA = ''; }, /UPDATED_AT/],
    [(s) => { s.indexes[1].COLUMN_NAME = 'ENTITY_TYPE'; }, /index/],
    [(s) => { s.indexes[2].COLUMN_NAME = 'LAYTIME_ID'; }, /primary key/],
    [(s) => { s.foreignKey.DELETE_RULE = 'CASCADE'; }, /foreign key/],
    [(s) => { s.foreignKey.same_schema = 0; }, /foreign key/],
  ]) {
    const schema = schemaFixture();
    mutate(schema);
    const pool = fakePool({ schema, version: 1 });
    const result = await runLaytimeNegotiationMigration(pool);
    assert.equal(result.state, 'failed');
    assert.match(result.detail, error);
    assert.equal(pool.sessions[0].queries.every((sql) => sql.startsWith('SELECT')), true);
  }
});

test('checks parent and vendor types before DDL and handles missing or unreleased locks', async () => {
  const schema = schemaFixture();
  schema.parent.COLUMN_TYPE = 'bigint(20) unsigned';
  const invalidParent = fakePool({ schema });
  assert.match((await runLaytimeNegotiationMigration(invalidParent)).detail, /laytime_master/);
  assert.equal(invalidParent.sessions[0].queries.every((sql) => sql.startsWith('SELECT')), true);
  schema.parent.COLUMN_TYPE = 'bigint(20)';
  schema.vendor.COLUMN_TYPE = 'bigint(20) unsigned';
  assert.match((await runLaytimeNegotiationMigration(fakePool({ schema }))).detail, /vendor_master/);

  const busy = fakePool({ got: 0 });
  assert.equal((await runLaytimeNegotiationMigration(busy)).state, 'failed');
  assert.equal(busy.sessions[0].queries.length, 1);
  const broken = fakePool({ released: 0 });
  assert.equal((await runLaytimeNegotiationMigration(broken)).state, 'failed');
  assert.equal(broken.sessions[0].destroyed, true);
  assert.equal(broken.sessions[0].closed, false);
});

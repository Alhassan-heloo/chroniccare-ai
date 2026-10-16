import assert from "node:assert/strict";
import test from "node:test";
import { readEnvironment } from "../src/config/env.js";
import { checkDatabase, createDatabasePool } from "../src/db/pool.js";
import { applyMigrations, loadMigrations } from "../src/db/migrations.js";

test("versioned migration files load deterministically", async () => {
  const migrations = await loadMigrations();
  assert(migrations.length >= 1);
  assert.equal(migrations[0]?.name, "001_backend_foundation.sql");
  assert.deepEqual(migrations.map((migration) => migration.version),
    migrations.map((migration) => migration.version).toSorted());
  assert.equal(new Set(migrations.map((migration) => migration.version)).size, migrations.length);
  for (const migration of migrations) assert.match(migration.checksum, /^[a-f0-9]{64}$/);
  assert.match(migrations[0]?.sql ?? "", /CREATE SCHEMA chroniccare/);
});

test("real PostgreSQL: connectivity, migrations, idempotence, checksums, rollback", {
  skip: process.env.TEST_DATABASE_URL ? false : "TEST_DATABASE_URL is not configured; no real database integration claimed.",
}, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert(databaseUrl);
  // Guard against accidentally migrating an application or production database.
  assert.match(new URL(databaseUrl).pathname, /_test$/,
    "Integration tests require a dedicated database whose name ends in _test.");
  const config = readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl });
  const pool = createDatabasePool(config);
  try {
    await checkDatabase(pool);
    const tables = await pool.query<{ tablename: string }>(`SELECT tablename FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      AND NOT (schemaname = 'chroniccare' AND tablename IN ('users', 'sessions'))
      AND NOT (schemaname = 'public' AND tablename = 'chroniccare_schema_migrations')`);
    assert.equal(tables.rows.length, 0, "Use a dedicated test database with only known migration-owned tables.");
    const migrations = await loadMigrations();
    await applyMigrations(pool, migrations);
    assert.deepEqual(await applyMigrations(pool, migrations), []);
    const schema = await pool.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = 'chroniccare'");
    assert.equal(schema.rowCount, 1);
    const changed = migrations.map((migration) => ({ ...migration, checksum: "changed" }));
    await assert.rejects(() => applyMigrations(pool, changed), /missing or changed/);
    await assert.rejects(() => applyMigrations(pool, [...migrations, {
      version: "999", name: "999_rollback_probe.sql", checksum: "test-only",
      sql: "CREATE TABLE chroniccare.rollback_probe (id integer); SELECT missing_column_for_rollback_test;",
    }]));
    const rolledBack = await pool.query<{ table_name: string | null }>("SELECT to_regclass('chroniccare.rollback_probe')::text AS table_name");
    assert.equal(rolledBack.rows[0]?.table_name, null);
    assert.deepEqual(await applyMigrations(pool, migrations), []);
  } finally { await pool.end(); }
});

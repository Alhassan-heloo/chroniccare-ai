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
  const templateIdentity = migrations.find((migration) => migration.name === "006_habit_template_identity.sql");
  assert(templateIdentity);
  assert.match(templateIdentity.sql, /template_key/);
  assert.match(templateIdentity.sql, /habits_patient_template_key_unique/);
  assert.match(templateIdentity.sql, /ranked\.position = 1/);
  const doctorRelationships = migrations.find((migration) => migration.name === "007_doctor_patient_relationships.sql");
  assert(doctorRelationships);
  assert.match(doctorRelationships.sql, /doctor_patient_relationships/);
  assert.match(doctorRelationships.sql, /validate_doctor_patient_roles/);
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
      AND NOT (schemaname = 'chroniccare' AND tablename IN ('users', 'sessions', 'measurements', 'medications', 'medication_schedules', 'medication_dose_logs', 'habits', 'habit_progress', 'doctor_patient_relationships', 'doctor_connection_codes', 'account_tokens', 'notifications', 'browser_registrations'))
      AND NOT (schemaname = 'public' AND tablename = 'chroniccare_schema_migrations')`);
    assert.equal(tables.rows.length, 0, "Use a dedicated test database with only known migration-owned tables.");
    const migrations = await loadMigrations();
    await applyMigrations(pool, migrations);
    assert.deepEqual(await applyMigrations(pool, migrations), []);
    const schema = await pool.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = 'chroniccare'");
    assert.equal(schema.rowCount, 1);
    const templateColumn = await pool.query<{ is_nullable: string }>(`SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='chroniccare' AND table_name='habits' AND column_name='template_key'`);
    assert.equal(templateColumn.rows[0]?.is_nullable, "YES", "Existing custom habits remain compatible through a nullable identity.");
    const templateIndex = await pool.query(`SELECT 1 FROM pg_indexes
      WHERE schemaname='chroniccare' AND indexname='habits_patient_template_key_unique'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%WHERE (template_key IS NOT NULL)%'`);
    assert.equal(templateIndex.rowCount, 1);
    const doctorTable = await pool.query(`SELECT 1 FROM information_schema.tables
      WHERE table_schema='chroniccare' AND table_name='doctor_patient_relationships'`);
    assert.equal(doctorTable.rowCount, 1);
    const doctorTrigger = await pool.query(`SELECT DISTINCT trigger_name FROM information_schema.triggers
      WHERE event_object_schema='chroniccare' AND event_object_table='doctor_patient_relationships'
      AND trigger_name='doctor_patient_relationship_roles'`);
    assert.equal(doctorTrigger.rowCount, 1);
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

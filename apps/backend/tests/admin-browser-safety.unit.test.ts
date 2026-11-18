// Pure in-memory checks. No pg.Client/Pool is created and no network is used.
import test from "node:test";
import assert from "node:assert/strict";
import type pg from "pg";
import { assertIdentity, assertSnapshot, fixtureIds, guardClient, snapshotOf, validateConfig,
  type Baseline, type Identity, type SafetyConfig, type Snapshot } from "./support/admin-browser-safety.js";

const runId = "2026-11-11-safety-unit-fixture";
const config: SafetyConfig = { databaseUrl: "postgres://fixture@127.0.0.1/phase2c_test",
  applicationDatabaseUrls: ["postgres://fixture@localhost/chroniccare"], sslMode: "disable", runId,
  fixtures: (["admin", "doctor", "patient"] as const).map(role => ({ name: role + " " + runId,
    email: runId + "." + role + "@admin-browser.example.test", role })) };
const identity: Identity = { name: "phase2c_test", oid: 4000, address: "127.0.0.1", port: 5432, started: "unit-test-start" };
const doctor = { ...config.fixtures[1]!, id: "00000000-0000-4000-8000-000000000001" };

test("configuration refuses application database aliases and URL overrides", () => {
  assert.equal(validateConfig(config), "phase2c_test");
  assert.throws(() => validateConfig({ ...config, applicationDatabaseUrls: ["postgres://other@another-host/phase2c_test"] }), /APPLICATION_DATABASE_REJECTED/);
  assert.throws(() => validateConfig({ ...config, databaseUrl: config.databaseUrl + "?options=anything" }), /DATABASE_URL_OPTIONS_NOT_ALLOWED/);
  assert.throws(() => validateConfig({ ...config, applicationDatabaseUrls: [] }), /APPLICATION_TARGET_REQUIRED/);
});
test("identity pins database OID, server endpoint and PostgreSQL process lifetime", () => {
  for (const changed of [{ oid: 2 }, { address: "127.0.0.2" }, { port: 1 }, { name: "chroniccare" }, { started: "restarted" }]) {
    assert.throws(() => assertIdentity({ ...identity, ...changed }, identity), /DATABASE_IDENTITY_CHANGED/);
  }
});
test("fixture ownership requires exact run email/name/role and excludes original IDs", () => {
  assert.deepEqual(fixtureIds([doctor], config, ["original"]), [doctor.id]);
  assert.throws(() => fixtureIds([doctor], config, [doctor.id]), /UNOWNED_FIXTURE_ACCOUNT/);
  assert.throws(() => fixtureIds([{ ...doctor, role: "admin" }], config, []), /UNOWNED_FIXTURE_ACCOUNT/);
  assert.throws(() => fixtureIds([{ ...doctor, name: "unrelated" }], config, []), /UNOWNED_FIXTURE_ACCOUNT/);
  assert.throws(() => fixtureIds([{ ...doctor, email: "another@example.test" }], config, []), /UNOWNED_FIXTURE_ACCOUNT/);
});
test("snapshot comparison rejects changes, missing rows and new tables without disclosing rows", () => {
  const expected = { users: { count: 5, hash: "private-original-hash" } };
  const changedSnapshots: Snapshot[] = [{ users: { count: 4, hash: "different" } }, {}, { ...expected, extra: { count: 1, hash: "new" } }];
  for (const changed of changedSnapshots) {
    assert.throws(() => assertSnapshot(changed, expected), error => error instanceof Error && error.message === "PROTECTED_DATA_CHANGED_TRANSACTION_REFUSED");
  }
});

class MemoryConnection {
  state = { original: "original-row:1" as string | null, push: "push-disabled:1", fixtures: [] as typeof doctor[] };
  pending: typeof this.state | undefined;
  calls: string[] = [];
  destroyed = false;
  wrongIdentity = false;
  get current() { return this.pending ?? this.state; }
  async query(sql: string) {
    this.calls.push(sql);
    const result = (rows: unknown[] = []) => ({ rows, rowCount: rows.length, fields: [], oid: 0, command: "TEST" });
    if (sql.includes("current_database() AS name")) return result([{ ...identity, ...(this.wrongIdentity ? { oid: 1 } : {}) }]);
    if (sql === "BEGIN READ WRITE") { this.pending = structuredClone(this.state); return result(); }
    if (sql === "COMMIT") { this.state = this.current; this.pending = undefined; return result(); }
    if (sql === "ROLLBACK") { this.pending = undefined; return result(); }
    if (sql.includes("pg_advisory_xact_lock")) return result();
    if (sql.includes("FROM pg_tables")) return result([
      { schema: "chroniccare", name: "push_control" }, { schema: "chroniccare", name: "sessions" },
      { schema: "chroniccare", name: "users" }, { schema: "public", name: "chroniccare_schema_migrations" },
    ]);
    if (sql.startsWith("SELECT id,name,email,role")) return result(this.current.fixtures);
    if (sql.includes("AS digest")) {
      if (sql.includes('FROM "chroniccare"."users"')) return result(this.current.original ? [{ digest: this.current.original }] : []);
      if (sql.includes('FROM "chroniccare"."push_control"')) return result([{ digest: this.current.push }]);
      if (sql.includes('FROM "public".')) return result([{ digest: "migration-ledger:1" }]);
      return result();
    }
    if (sql.startsWith("UPDATE chroniccare.users")) { this.current.original = "original-row:2"; return result(); }
    if (sql.startsWith("UPDATE chroniccare.push_control")) { this.current.push = "push-disabled:2"; return result(); }
    if (sql.startsWith("INSERT INTO chroniccare.users")) { this.current.fixtures.push(doctor); return result(); }
    if (sql.startsWith("DELETE FROM chroniccare.users")) {
      this.current.fixtures = [];
      if (sql === "DELETE FROM chroniccare.users") this.current.original = null;
      return result();
    }
    throw new Error("Unexpected in-memory query");
  }
  release(error?: Error) { if (error) { this.destroyed = true; this.pending = undefined; } }
  asClient() { return this as unknown as pg.PoolClient; }
}
async function guarded(memory = new MemoryConnection()) {
  const baseline: Baseline = { identity, originalUserIds: ["original"], snapshot: await snapshotOf(memory.asClient()) };
  const faults: string[] = [];
  const client = guardClient(memory.asClient(), config, baseline, code => faults.push(code));
  memory.calls = [];
  return { memory, client, faults };
}
test("implicit mutation of an original row is rolled back before any COMMIT", async () => {
  const { memory, client, faults } = await guarded();
  await assert.rejects(client.query("UPDATE chroniccare.users SET name=$1", ["changed"]), /PROTECTED_DATA_CHANGED/);
  assert.equal(memory.state.original, "original-row:1"); assert(!memory.calls.includes("COMMIT"));
  assert(memory.calls.includes("ROLLBACK")); assert.equal(faults.length, 1);
});
test("explicit transaction cannot commit a no-op update that changed original xmin", async () => {
  const { memory, client } = await guarded();
  await client.query("BEGIN"); await client.query("UPDATE chroniccare.users SET name=name");
  await assert.rejects(client.query("COMMIT"), /PROTECTED_DATA_CHANGED/);
  assert.equal(memory.state.original, "original-row:1"); assert(!memory.calls.includes("COMMIT"));
});
test("a broad delete cannot commit even if it also removes this run's fixtures", async () => {
  const { memory, client } = await guarded();
  await client.query("INSERT INTO chroniccare.users VALUES($1)", [doctor.id]);
  await assert.rejects(client.query("DELETE FROM chroniccare.users"), /PROTECTED_DATA_CHANGED/);
  assert.equal(memory.state.original, "original-row:1"); assert.equal(memory.state.fixtures[0]?.id, doctor.id);
  assert.equal(memory.calls.filter(sql => sql === "COMMIT").length, 1);
});
test("touching push_control cannot commit, even when the enabled value remains false", async () => {
  const { memory, client } = await guarded();
  await assert.rejects(client.query("UPDATE chroniccare.push_control SET enabled=false"), /PROTECTED_DATA_CHANGED/);
  assert.equal(memory.state.push, "push-disabled:1"); assert(!memory.calls.includes("COMMIT"));
});
test("validated current-run insert commits with original rows intact", async () => {
  const { memory, client, faults } = await guarded();
  await client.query("INSERT INTO chroniccare.users VALUES($1)", [doctor.id]);
  assert.equal(memory.state.fixtures[0]?.id, doctor.id); assert.equal(memory.state.original, "original-row:1");
  assert.equal(memory.calls.filter(sql => sql === "COMMIT").length, 1); assert.deepEqual(faults, []);
});
test("explicit cleanup of owned fixtures commits without altering original rows", async () => {
  const { memory, client } = await guarded();
  await client.query("INSERT INTO chroniccare.users VALUES($1)", [doctor.id]);
  await client.query("BEGIN"); await client.query("DELETE FROM chroniccare.users WHERE id=ANY($1::uuid[])", [[doctor.id]]); await client.query("COMMIT");
  assert.deepEqual(memory.state.fixtures, []); assert.equal(memory.state.original, "original-row:1");
});
test("wrong connection identity is refused before BEGIN or application SQL", async () => {
  const { memory, client } = await guarded(); memory.wrongIdentity = true;
  await assert.rejects(client.query("INSERT INTO chroniccare.users VALUES($1)", [doctor.id]), /DATABASE_IDENTITY_CHANGED/);
  assert(!memory.calls.some(sql => sql.startsWith("BEGIN") || sql.startsWith("INSERT")));
});
test("multiple statements, DDL and alternate commit commands are refused", async () => {
  for (const sql of ["SELECT 1; DELETE FROM chroniccare.users", "ALTER TABLE chroniccare.users ADD bad text", "END", "PREPARE TRANSACTION 'x'"]) {
    const { memory, client } = await guarded(); await assert.rejects(client.query(sql), /SQL_REFUSED/); assert.equal(memory.calls.length, 0);
  }
});
test("releasing an unfinished transaction destroys it instead of returning it to the pool", async () => {
  const { memory, client } = await guarded(); await client.query("BEGIN");
  await client.query("INSERT INTO chroniccare.users VALUES($1)", [doctor.id]); client.release();
  assert(memory.destroyed); assert.deepEqual(memory.state.fixtures, []); assert(!memory.calls.includes("COMMIT"));
});

// Test infrastructure only. Importing this file never connects to PostgreSQL.
import pg from "pg";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadMigrations } from "../../src/db/migrations.js";

export class SafetyError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "SafetyError"; }
}
function requireSafe(condition: unknown, code: string): asserts condition {
  if (!condition) throw new SafetyError(code);
}
export interface Fixture { email: string; name: string; role: "admin" | "doctor" | "patient" }
export interface SafetyConfig {
  databaseUrl: string;
  applicationDatabaseUrls: string[];
  sslMode: "disable" | "verify-full";
  caFile?: string;
  runId: string;
  fixtures: Fixture[];
}
export interface Identity { name: string; oid: number; address: string; port: number; started: string }
export interface Snapshot { [table: string]: { count: number; hash: string } }
export interface Baseline { identity: Identity; originalUserIds: string[]; snapshot: Snapshot }
type RawClient = Pick<pg.PoolClient, "query" | "release">;
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';

export function validateConfig(config: SafetyConfig) {
  const target = new URL(config.databaseUrl);
  requireSafe(["postgres:", "postgresql:"].includes(target.protocol), "INVALID_TEST_PROTOCOL");
  requireSafe(target.hostname && target.username, "EXPLICIT_TEST_HOST_AND_LOGIN_REQUIRED");
  const name = decodeURIComponent(target.pathname.slice(1));
  requireSafe(name.endsWith("_test") && name.length > 5, "TEST_DATABASE_NAME_REQUIRED");
  requireSafe(!target.hash && !target.search, "DATABASE_URL_OPTIONS_NOT_ALLOWED");
  requireSafe(config.applicationDatabaseUrls.length > 0, "APPLICATION_TARGET_REQUIRED");
  for (const value of config.applicationDatabaseUrls) {
    requireSafe(name !== decodeURIComponent(new URL(value).pathname.slice(1)), "APPLICATION_DATABASE_REJECTED");
  }
  requireSafe(/^[a-zA-Z0-9-]{20,100}$/.test(config.runId), "INVALID_RUN_ID");
  requireSafe(config.fixtures.length === 3 && config.fixtures.map(f => f.role).sort().join(",") === "admin,doctor,patient", "THREE_FIXTURE_ROLES_REQUIRED");
  requireSafe(new Set(config.fixtures.map(f => f.email)).size === 3, "UNIQUE_FIXTURE_EMAILS_REQUIRED");
  for (const fixture of config.fixtures) requireSafe(
    fixture.email.includes(config.runId.toLowerCase()) && fixture.email.endsWith("@admin-browser.example.test") &&
    fixture.name.includes(config.runId) && fixture.name.length <= 100, "FIXTURE_RUN_ID_REQUIRED");
  requireSafe(["disable", "verify-full"].includes(config.sslMode), "INVALID_TLS_MODE");
  return name;
}

async function connectionOptions(config: SafetyConfig): Promise<pg.PoolConfig> {
  validateConfig(config);
  return { connectionString: config.databaseUrl, ssl: config.sslMode === "verify-full"
    ? { rejectUnauthorized: true, ...(config.caFile ? { ca: await readFile(config.caFile, "utf8") } : {}) } : false,
    connectionTimeoutMillis: 5000, statement_timeout: 5000, lock_timeout: 2000,
    // A raw connection cannot write by accident. Only guarded transactions opt in.
    options: "-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=2000",
    application_name: "admin-browser-" + config.runId, max: 4 };
}

export async function identityOf(client: Pick<pg.Client, "query">, config: SafetyConfig): Promise<Identity> {
  const name = validateConfig(config);
  const identity = (await client.query<Identity>(`SELECT current_database() AS name,
    (SELECT oid::int FROM pg_database WHERE datname=current_database()) AS oid,
    inet_server_addr()::text AS address, inet_server_port() AS port,
    pg_postmaster_start_time()::text AS started`)).rows[0];
  requireSafe(identity?.name === name && identity.address && identity.port && identity.oid, "WRONG_DATABASE_CONNECTION");
  return identity;
}
export function assertIdentity(actual: Identity, expected: Identity) {
  requireSafe(JSON.stringify(actual) === JSON.stringify(expected), "DATABASE_IDENTITY_CHANGED");
}

async function tablesOf(client: Pick<pg.Client, "query">): Promise<string[]> {
  const rows = (await client.query<{ schema: string; name: string }>(`SELECT schemaname AS schema,tablename AS name FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog','information_schema') AND schemaname NOT LIKE 'pg_%'
    ORDER BY schemaname,tablename`)).rows;
  requireSafe(rows.some(t => t.schema === "chroniccare" && t.name === "users"), "USERS_TABLE_REQUIRED");
  requireSafe(rows.some(t => t.name === "chroniccare_schema_migrations"), "MIGRATION_LEDGER_REQUIRED");
  return rows.map(t => quote(t.schema) + "." + quote(t.name));
}

export function fixtureIds(rows: { id: string; name: string; email: string; role: string }[], config: SafetyConfig, baselineIds: string[]) {
  return rows.map(row => {
    const fixture = config.fixtures.find(f => f.email === row.email);
    requireSafe(fixture && fixture.name === row.name && fixture.role === row.role && !baselineIds.includes(row.id), "UNOWNED_FIXTURE_ACCOUNT");
    return row.id;
  });
}
export async function ownedIds(client: Pick<pg.Client, "query">, config: SafetyConfig, baseline: Baseline) {
  return fixtureIds((await client.query<{ id: string; name: string; email: string; role: string }>(
    "SELECT id,name,email,role FROM chroniccare.users WHERE email=ANY($1::text[])", [config.fixtures.map(f => f.email)])).rows, config, baseline.originalUserIds);
}

export async function snapshotOf(client: Pick<pg.Client, "query">, excludedUserIds: string[] = []): Promise<Snapshot> {
  const snapshot: Snapshot = {};
  for (const table of await tablesOf(client)) {
    // Only users and sessions may be created/changed by this Admin scenario.
    // Every other table, including account_tokens and push_control, is immutable.
    const column = table === '"chroniccare"."users"' ? "id" : table === '"chroniccare"."sessions"' ? "user_id" : undefined;
    const rows = (await client.query<{ digest: string }>(`SELECT md5(row_to_json(t)::text)||':'||t.xmin::text AS digest FROM ${table} t
      ${column ? `WHERE NOT(t.${quote(column)}=ANY($1::uuid[]))` : ""} ORDER BY digest`, column ? [excludedUserIds] : [])).rows;
    snapshot[table] = { count: rows.length, hash: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
  }
  return snapshot;
}
export function assertSnapshot(actual: Snapshot, expected: Snapshot) {
  requireSafe(JSON.stringify(actual) === JSON.stringify(expected), "PROTECTED_DATA_CHANGED_TRANSACTION_REFUSED");
}
export async function assertPreserved(client: Pick<pg.Client, "query">, config: SafetyConfig, baseline: Baseline) {
  assertIdentity(await identityOf(client, config), baseline.identity);
  assertSnapshot(await snapshotOf(client, await ownedIds(client, config, baseline)), baseline.snapshot);
}

export async function inspect(config: SafetyConfig, migrationsDirectory: string) {
  const client = new pg.Client(await connectionOptions(config));
  client.on("error", () => undefined); // Driver errors must never print connection details.
  try {
    await client.connect(); await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity = await identityOf(client, config);
    const users = (await client.query<{ id: string; role: string; email: string }>("SELECT id,role,email FROM chroniccare.users ORDER BY id")).rows;
    requireSafe(!users.some(u => u.role === "admin"), "EXISTING_ADMIN_BOOTSTRAP_NOT_SAFE");
    requireSafe(!users.some(u => config.fixtures.some(f => f.email === u.email)), "FIXTURE_EMAIL_COLLISION");
    const others = (await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND pid<>pg_backend_pid()`)).rows[0];
    requireSafe(others?.count === 0, "CONCURRENT_DATABASE_CONNECTIONS_REFUSED");
    const foreign = (await client.query<{ count: number }>("SELECT count(*)::int AS count FROM pg_foreign_table")).rows[0];
    requireSafe(foreign?.count === 0, "FOREIGN_TABLES_REFUSED");
    const links = (await client.query<{ count: number }>("SELECT count(*)::int AS count FROM pg_extension WHERE extname IN ('dblink','postgres_fdw')")).rows[0];
    requireSafe(links?.count === 0, "CROSS_DATABASE_EXTENSIONS_REFUSED");
    const unsupported = (await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%'
      AND (c.relkind='S' OR c.relrowsecurity)`)).rows[0];
    requireSafe(unsupported?.count === 0, "SEQUENCES_OR_RLS_REQUIRE_REVIEW");
    const source = await loadMigrations(pathToFileURL(migrationsDirectory + "/"));
    const ledger = (await client.query<{ version: string; name: string; checksum: string }>("SELECT version,name,checksum FROM public.chroniccare_schema_migrations ORDER BY version")).rows;
    requireSafe(source.length === ledger.length && source.every((s, i) => {
      const applied = ledger[i]; return applied?.version === s.version && applied.name === s.name && applied.checksum === s.checksum;
    }), "MIGRATIONS_NOT_CURRENT_NO_AUTOMATIC_MIGRATION");
    const baseline: Baseline = { identity, originalUserIds: users.map(u => u.id), snapshot: await snapshotOf(client) };
    await client.query("ROLLBACK");
    return { baseline, summary: { existingAccounts: users.length, admins: 0,
      protectedTables: Object.keys(baseline.snapshot).length, migrationsVerified: ledger.length, migrationsRun: false } };
  } finally { await client.end(); }
}

// Minimal adapter, not a mock: every statement reaches a real pg client and all
// original stores, SQL constraints, transactions, sessions and RBAC remain active.
export function guardClient(raw: RawClient, config: SafetyConfig, baseline: Baseline, onFault: (code: string) => void) {
  let active = false, released = false;
  const lockKey = createHash("sha256").update(config.runId).digest().readInt32BE(0);
  async function rollback() { const result = await raw.query("ROLLBACK"); active = false; return result; }
  async function begin() {
    assertIdentity(await identityOf(raw, config), baseline.identity);
    const result = await raw.query("BEGIN READ WRITE"); active = true;
    await raw.query("SELECT pg_advisory_xact_lock(20261111,$1::int)", [lockKey]);
    await assertPreserved(raw, config, baseline);
    return result;
  }
  async function commit() {
    await assertPreserved(raw, config, baseline); // BEFORE COMMIT, including implicit transactions.
    const result = await raw.query("COMMIT"); active = false; return result;
  }
  return {
    async query(text: string, values?: unknown[]): Promise<pg.QueryResult> {
      requireSafe(!released, "RELEASED_CLIENT_REJECTED");
      try {
        requireSafe(typeof text === "string" && !text.includes(";"), "MULTI_STATEMENT_SQL_REFUSED");
        const command = text.trim().toUpperCase();
        if (command === "ROLLBACK") return await rollback();
        if (command === "BEGIN") { requireSafe(!active, "NESTED_TRANSACTION_REFUSED"); return await begin(); }
        if (command === "COMMIT") { requireSafe(active, "COMMIT_WITHOUT_TRANSACTION"); return await commit(); }
        requireSafe(/^(SELECT|INSERT|UPDATE|DELETE|WITH)\b/.test(command), "UNSUPPORTED_SQL_REFUSED");
        const implicit = !active;
        if (implicit) await begin();
        const result = await raw.query(text, values);
        if (implicit) await commit();
        return result;
      } catch (error) {
        if (active) await rollback().catch(() => undefined);
        if (error instanceof SafetyError) onFault(error.code);
        throw error;
      }
    },
    release() {
      released = true;
      // Destroying an uncommitted connection rolls it back; never return it dirty.
      raw.release(active ? new Error("UNCOMMITTED_TEST_TRANSACTION") : undefined);
    },
  };
}

export async function guardedPool(config: SafetyConfig, baseline: Baseline, onFault: (code: string) => void = () => undefined) {
  const rawPool = new pg.Pool(await connectionOptions(config));
  let faulted = false;
  const fault = (code: string) => { faulted = true; onFault(code); };
  rawPool.on("error", () => fault("DATABASE_POOL_CONNECTION_LOST"));
  async function connect() {
    requireSafe(!faulted, "FAULTED_POOL_REFUSES_FURTHER_WORK");
    const raw = await rawPool.connect();
    try { assertIdentity(await identityOf(raw, config), baseline.identity); }
    catch (error) { raw.release(true); fault("CONNECTION_IDENTITY_REJECTED"); throw error; }
    return guardClient(raw, config, baseline, fault);
  }
  // Only this checked surface is passed to the application; rawPool stays private.
  const surface = {
    connect,
    async query(text: string, values?: unknown[]) {
      const client = await connect();
      try { return await client.query(text, values); } finally { client.release(); }
    },
    async end() { await rawPool.end(); },
  };
  return surface as unknown as pg.Pool;
}

export async function audit(config: SafetyConfig, baseline: Baseline, afterCleanup = false) {
  const client = new pg.Client(await connectionOptions(config));
  client.on("error", () => undefined);
  try {
    await client.connect(); await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await assertPreserved(client, config, baseline);
    if (afterCleanup) requireSafe((await ownedIds(client, config, baseline)).length === 0, "FIXTURE_ACCOUNTS_NOT_CLEANED");
    await client.query("ROLLBACK");
  } finally { await client.end(); }
}

export async function cleanup(config: SafetyConfig, baseline: Baseline) {
  const pool = await guardedPool(config, baseline);
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Resolve only registered run emails, validate their exact role/name/ID, then
      // delete by IDs. All other tables must still match baseline before COMMIT.
      const ids = await ownedIds(client, config, baseline);
      if (ids.length) await client.query("DELETE FROM chroniccare.users WHERE id=ANY($1::uuid[])", [ids]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } finally { await pool.end(); }
  await audit(config, baseline, true);
}

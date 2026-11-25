import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type pg from "pg";

export interface Migration { version: string; name: string; sql: string; checksum: string }

export async function loadMigrations(directory = new URL("../../migrations/", import.meta.url)): Promise<Migration[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const versions = new Set<string>();
  const migrations: Migration[] = [];
  for (const name of names) {
    if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(name)) throw new Error("Invalid migration filename.");
    const version = name.slice(0, 3);
    if (versions.has(version)) throw new Error("Duplicate migration version.");
    versions.add(version);
    const sql = await readFile(new URL(name, directory), "utf8");
    // Windows Git checkouts may use CRLF; both platforms must produce the same hash.
    const checksum = createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
    migrations.push({ version, name, sql, checksum });
  }
  return migrations;
}

export async function applyMigrations(
  pool: pg.Pool,
  suppliedMigrations?: Migration[],
  expectedPending?: Pick<Migration, "version" | "checksum">,
): Promise<string[]> {
  const migrations = suppliedMigrations ?? await loadMigrations();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize migrations across processes; all pending SQL and the ledger commit together.
    await client.query("SELECT pg_advisory_xact_lock(20261015, 1)");
    if (!expectedPending) {
      await client.query(`CREATE TABLE IF NOT EXISTS public.chroniccare_schema_migrations (
        version text PRIMARY KEY,
        name text NOT NULL,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    }
    const existing = await client.query<{ version: string; name: string; checksum: string }>(
      "SELECT version, name, checksum FROM public.chroniccare_schema_migrations ORDER BY version",
    );
    for (const applied of existing.rows) {
      const source = migrations.find((migration) => migration.version === applied.version);
      if (!source || source.name !== applied.name || source.checksum !== applied.checksum) {
        throw new Error("Applied migration is missing or changed; restore it and add a new migration instead.");
      }
    }
    const appliedVersions = new Set(existing.rows.map((row) => row.version));
    const latest = existing.rows.at(-1)?.version;
    const pending = migrations.filter((migration) => !appliedVersions.has(migration.version));
    if (expectedPending && (pending.length !== 1 || pending[0]?.version !== expectedPending.version ||
        pending[0].checksum !== expectedPending.checksum)) {
      throw new Error("Expected exactly the authorized pending migration and checksum.");
    }
    if (latest && pending.some((migration) => migration.version < latest)) {
      throw new Error("New migrations must follow the latest applied version.");
    }
    for (const migration of pending) {
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO public.chroniccare_schema_migrations (version, name, checksum) VALUES ($1, $2, $3)",
        [migration.version, migration.name, migration.checksum],
      );
    }
    await client.query("COMMIT");
    return pending.map((migration) => migration.name);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

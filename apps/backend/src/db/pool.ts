import { readFileSync } from "node:fs";
import pg from "pg";
import type { Environment } from "../config/env.js";

export function createDatabasePool(config: Environment): pg.Pool {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl === "verify-full"
      ? { rejectUnauthorized: true, ...(config.databaseSslCaFile
        ? { ca: readFileSync(config.databaseSslCaFile, "utf8") } : {}) }
      : false,
    max: 10,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    query_timeout: 5000,
    statement_timeout: 5000,
    lock_timeout: 5000,
    application_name: "chroniccare-backend",
  });
  // Never log raw driver errors: they may contain connection details.
  pool.on("error", () => console.error("PostgreSQL idle connection failed."));
  return pool;
}

export async function checkDatabase(pool: Pick<pg.Pool, "query">): Promise<void> {
  // Readiness must validate columns used by login/session queries, not only connectivity.
  await pool.query("SELECT must_change_password,disabled FROM chroniccare.users LIMIT 0");
}

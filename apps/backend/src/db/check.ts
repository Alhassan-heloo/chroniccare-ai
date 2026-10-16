import { readEnvironment } from "../config/env.js";
import { checkDatabase, createDatabasePool } from "./pool.js";

async function main() {
  const pool = createDatabasePool(readEnvironment());
  try { await checkDatabase(pool); console.log("PostgreSQL connection verified."); }
  finally { await pool.end(); }
}

main().catch(() => {
  console.error("Database connection failed. Check PostgreSQL, DATABASE_URL, and TLS settings.");
  process.exitCode = 1;
});

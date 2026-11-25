import { readEnvironment } from "../config/env.js";
import { createMigrationPool } from "./migration-pool.js";
import { applyMigrations } from "./migrations.js";

async function main() {
  const pool = createMigrationPool(readEnvironment());
  try {
    const applied = await applyMigrations(pool);
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database migrations are up to date.");
  } finally { await pool.end(); }
}

main().catch(() => {
  console.error("Migration failed. Check connectivity, permissions, and unchanged migration history; verify the ledger before retrying.");
  process.exitCode = 1;
});

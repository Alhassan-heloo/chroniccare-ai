import { readEnvironment } from "../config/env.js";
import { createDatabasePool } from "../db/pool.js";
import { credentials, hashPassword } from "./security.js";
import { postgresAuthStore } from "./store.js";

// Local operator command only. Never accepts passwords as command-line arguments.
async function provision() {
  const [role, email, name, ...extra] = process.argv.slice(2);
  const password = process.env.AUTH_PROVISION_PASSWORD;
  delete process.env.AUTH_PROVISION_PASSWORD;
  if ((role !== "admin" && role !== "doctor") || extra.length) {
    throw new Error("Invalid provisioning arguments.");
  }
  const input = credentials({ email, name, password }, true);
  const hash = await hashPassword(input.password);
  const pool = createDatabasePool(readEnvironment());
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(20261015, 2)");
      if (role === "admin") {
        const existing = await client.query("SELECT 1 FROM chroniccare.users WHERE role='admin' LIMIT 1");
        if (existing.rowCount) throw new Error("An initial administrator already exists.");
      }
      // Use the same transaction for the existence guard and insertion.
      const store = postgresAuthStore(client);
      await store.createUser(input.name, input.email, hash, role);
      await client.query("COMMIT");
      console.log("Account provisioned successfully. No existing account was changed.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  } finally { await pool.end(); }
}

provision().catch(() => {
  console.error("Provisioning failed. Check arguments, password policy, migration status, duplicate email, and initial admin status.");
  process.exitCode = 1;
});

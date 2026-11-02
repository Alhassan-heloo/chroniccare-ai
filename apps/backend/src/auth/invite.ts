import { readEnvironment } from "../config/env.js";
import { createDatabasePool } from "../db/pool.js";
import { accountService } from "./accounts.js";
import { configuredEmail } from "./email.js";
async function invite() {
  const config = readEnvironment();
  const origin = process.env.APP_PUBLIC_ORIGIN;
  if (!origin || (config.nodeEnv === "production" && !origin.startsWith("https://"))) throw new Error("Invalid public origin.");
  const pool = createDatabasePool(config);
  try {
    await accountService(pool, { publicOrigin: origin, firstAdminEmail: process.env.FIRST_ADMIN_EMAIL, email: configuredEmail() }).inviteAdmin();
    console.log("Admin invitation accepted by the configured email provider (or an unexpired invitation is already active).");
  } finally { await pool.end(); }
}
invite().catch(() => { console.error("Invitation failed. Check trusted Admin email, email provider, database and setup status. No account was created."); process.exitCode = 1; });

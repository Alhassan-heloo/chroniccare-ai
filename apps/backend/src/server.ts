import { createApp } from "./app.js";
import { readEnvironment } from "./config/env.js";
import { checkDatabase, createDatabasePool } from "./db/pool.js";
import { postgresAuthStore } from "./auth/store.js";
import { postgresMeasurementStore } from "./measurements/store.js";
import { postgresMedicationStore } from "./medications/store.js";
import { postgresHabitStore } from "./habits/store.js";
import { postgresDoctorStore } from "./doctor/store.js";
import { postgresAdminStore } from "./admin/store.js";
import { initializeBootstrap } from "./auth/bootstrap.js";
import { postgresConnectionStore } from "./connections/store.js";
import { accountService } from "./auth/accounts.js";
import { configuredEmail } from "./auth/email.js";
import { isIP } from "node:net";

async function start() {
  const config = readEnvironment();
  const publicOrigin = process.env.APP_PUBLIC_ORIGIN ?? config.corsOrigins[0]!;
  if (config.nodeEnv === "production" && (!publicOrigin.startsWith("https://") || config.corsOrigins.some(origin => !origin.startsWith("https://")))) throw new Error("Production requires HTTPS application origins.");
  const trustedProxy = process.env.TRUST_PROXY_IP;
  if (trustedProxy && !isIP(trustedProxy)) throw new Error("TRUST_PROXY_IP must identify one trusted reverse proxy.");
  const email = configuredEmail();
  const pool = createDatabasePool(config);
  let bootstrap;
  try { bootstrap = config.nodeEnv === "production" && process.env.FIRST_ADMIN_EMAIL && !process.env.BOOTSTRAP_SECRET
    ? undefined : await initializeBootstrap(pool, config.nodeEnv, process.env.BOOTSTRAP_SECRET); }
  catch (error) { await pool.end(); throw error; }
  const app = createApp({
    corsOrigins: config.corsOrigins,
    checkDatabase: () => checkDatabase(pool),
    authStore: postgresAuthStore(pool),
    measurementStore: postgresMeasurementStore(pool),
    medicationStore: postgresMedicationStore(pool),
    habitStore: postgresHabitStore(pool),
    doctorStore: postgresDoctorStore(pool),
    adminStore: postgresAdminStore(pool),
    bootstrap,
    connectionStore: postgresConnectionStore(pool),
    cookies: { secure: config.nodeEnv === "production", trustedProxy },
    accountService: accountService(pool, { publicOrigin, firstAdminEmail: process.env.FIRST_ADMIN_EMAIL, email,
      reportDeliveryFailure: () => console.error("Account email delivery failed. No credentials logged."),
    }),
  });
  const server = app.listen(config.port, config.host, () => {
    console.log(`ChronicCare API listening on http://${config.host}:${config.port}`);
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.on("error", () => {
    console.error("Unable to start HTTP server. Check HOST and PORT.");
    void pool.end().finally(() => { process.exitCode = 1; });
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      console.error("Shutdown timed out.");
      process.exit(1);
    }, 10000);
    deadline.unref();
    server.close(() => {
      void pool.end().then(() => { clearTimeout(deadline); }, () => {
        console.error("Database shutdown failed.");
        process.exitCode = 1;
      });
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  // Liveness stays available during database outages; readiness must return 503.
  try { await checkDatabase(pool); console.log("PostgreSQL connection verified."); }
  catch { console.warn("PostgreSQL unavailable. API is live but not ready; check /api/health/ready."); }
}

start().catch(() => {
  console.error("Backend configuration/startup failed. Check environment variables and TLS configuration.");
  process.exitCode = 1;
});

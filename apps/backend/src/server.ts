import { createApp } from "./app.js";
import { readEnvironment } from "./config/env.js";
import { checkDatabase, createDatabasePool } from "./db/pool.js";
import { postgresAuthStore } from "./auth/store.js";
import { postgresMeasurementStore } from "./measurements/store.js";
import { postgresMedicationStore } from "./medications/store.js";

async function start() {
  const config = readEnvironment();
  const pool = createDatabasePool(config);
  const app = createApp({ corsOrigins: config.corsOrigins, checkDatabase: () => checkDatabase(pool), authStore: postgresAuthStore(pool), measurementStore: postgresMeasurementStore(pool), medicationStore: postgresMedicationStore(pool) });
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

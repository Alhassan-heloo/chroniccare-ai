// Isolated process entry for the Admin browser test. No migrations, provider
// configuration, push-control updates, worker startup or credential provisioning.
import { createServer } from "node:http";
import { createApp } from "../../src/app.js";
import { checkDatabase } from "../../src/db/pool.js";
import { initializeBootstrap } from "../../src/auth/bootstrap.js";
import { accountService } from "../../src/auth/accounts.js";
import { postgresAuthStore } from "../../src/auth/store.js";
import { postgresAdminStore } from "../../src/admin/store.js";
import { postgresDoctorStore } from "../../src/doctor/store.js";
import { postgresMeasurementStore } from "../../src/measurements/store.js";
import { postgresMedicationStore } from "../../src/medications/store.js";
import { postgresHabitStore } from "../../src/habits/store.js";
import { postgresConnectionStore } from "../../src/connections/store.js";
import { postgresNotificationStore } from "../../src/notifications/store.js";
import { postgresRegistrationStore } from "../../src/notifications/registrations.js";
import { guardedPool, type Baseline, type SafetyConfig } from "./admin-browser-safety.js";
import { createRestartDrain } from "./admin-browser-restart-drain.js";

interface Start { type: "start"; config: SafetyConfig; baseline: Baseline; setupSecret: string; origin: string; port: number }
async function start(message: Start) {
  if (message.type !== "start" || !process.send || process.env.NODE_ENV !== "test" || process.env.CC_ADMIN_BROWSER_WRITES !== "approved") throw new Error("EXPLICIT_TEST_PROCESS_REQUIRED");
  const { config, baseline, origin, port } = message;
  if (origin !== "http://127.0.0.1:5195" || port !== 3315) throw new Error("LOOPBACK_TEST_ORIGIN_REQUIRED");
  const pool = await guardedPool(config, baseline, code => process.send?.({ type: "safety-failure", code }));
  try {
    await checkDatabase(pool);
    const bootstrap = await initializeBootstrap(pool, "test", message.setupSecret);
    const restartDrain = createRestartDrain();
    const app = createApp({ corsOrigins: [origin], checkDatabase: () => checkDatabase(pool),
      authStore: postgresAuthStore(pool), adminStore: postgresAdminStore(pool), doctorStore: postgresDoctorStore(pool),
      measurementStore: postgresMeasurementStore(pool), medicationStore: postgresMedicationStore(pool), habitStore: postgresHabitStore(pool),
      connectionStore: postgresConnectionStore(pool), notificationStore: postgresNotificationStore(pool),
      registrationStore: postgresRegistrationStore(pool), pushPool: pool, bootstrap, cookies: { secure: false },
      accountService: accountService(pool, { publicOrigin: origin }),
      reportError: () => { restartDrain.reportUnexpectedError(); console.error("API request failed."); },
    });
    let nextSetupRequest = 0;
    const server = createServer((request, response) => {
      restartDrain.track(response);
      if (request.method === "GET" && request.url === "/api/setup") {
        const requestId = ++nextSetupRequest;
        const browser = request.headers.origin === origin;
        const observe = (event: "received" | "finish" | "close") => process.send?.({
          type: "setup-http-observation", requestId, browser, event, at: Date.now(),
          status: response.headersSent ? response.statusCode : null, finished: response.writableFinished,
        });
        observe("received");
        response.once("finish", () => observe("finish"));
        response.once("close", () => observe("close"));
      }
      app(request, response);
    });
    server.listen(port, "127.0.0.1", () => process.send?.({ type: "ready" }));
    server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
    let stopping = false;
    const shutdown = () => {
      if (stopping) return; stopping = true;
      server.close(() => { void pool.end().finally(() => { process.disconnect?.(); }); });
      server.closeAllConnections();
    };
    process.on("message", (command: unknown) => {
      if (!command || typeof command !== "object" || !("type" in command)) return;
      if (command.type === "arm-restart-drain") {
        try {
          if (stopping) throw new Error("BACKEND_ALREADY_STOPPING");
          restartDrain.arm();
          process.send?.({ type: "restart-drain-armed" });
        } catch { process.send?.({ type: "restart-drain-failed", code: "BACKEND_NOT_IDLE_AT_RESTART_BOUNDARY" }); }
      }
      if (command.type === "drain-for-restart" && !stopping) {
        stopping = true;
        // Unlike emergency teardown, this path lets responses and checked-out
        // guarded PostgreSQL clients finish before acknowledging the restart.
        server.close(error => {
          void (async () => {
            try {
              if (error) throw error;
              await pool.end();
              restartDrain.assertDrained();
              process.send?.({ type: "restart-drained" }, () => { if (process.connected) process.disconnect?.(); });
            } catch {
              process.exitCode = 1;
              process.send?.({ type: "restart-drain-failed", code: "BACKEND_RESTART_DRAIN_NOT_PROVEN" }, () => { if (process.connected) process.disconnect?.(); });
            }
          })();
        });
      }
    });
    process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown); process.once("disconnect", shutdown);
    server.once("error", () => { process.send?.({ type: "startup-failed" }); shutdown(); process.exitCode = 1; });
  } catch { await pool.end(); throw new Error("GUARDED_BACKEND_STARTUP_FAILED"); }
}

if (process.send) process.once("message", message => {
  void start(message as Start).catch(() => { process.send?.({ type: "startup-failed" }); process.exitCode = 1; process.disconnect?.(); });
});

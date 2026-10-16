import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { once } from "node:events";
import express from "express";
import { createApp } from "../src/app.js";
import { errorHandler } from "../src/middleware/errors.js";

async function serve(t: TestContext, app: ReturnType<typeof express>) {
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

test("application initializes without a database and serves secure liveness", async (t) => {
  let checks = 0;
  const app = createApp({ corsOrigins: ["http://localhost:5173"], checkDatabase: async () => { checks++; } });
  assert.equal(checks, 0);
  const url = await serve(t, app);
  const response = await fetch(`${url}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "chroniccare-api" });
  assert.equal(checks, 0);
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("readiness performs its database check and reports success", async (t) => {
  let checks = 0;
  const url = await serve(t, createApp({ corsOrigins: [], checkDatabase: async () => { checks++; } }));
  const response = await fetch(`${url}/api/health/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", database: "up" });
  assert.equal(checks, 1);
});

test("database outage returns 503 without leaking driver details; liveness still works", async (t) => {
  const url = await serve(t, createApp({ corsOrigins: [], checkDatabase: async () => {
    throw new Error("postgresql://private:secret@internal/patients");
  } }));
  const response = await fetch(`${url}/api/health/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable", database: "down" });
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
});

test("CORS permits configured origins and rejects others", async (t) => {
  const url = await serve(t, createApp({ corsOrigins: ["http://localhost:5173"], checkDatabase: async () => {} }));
  const allowed = await fetch(`${url}/api/health`, { headers: { Origin: "http://localhost:5173" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(allowed.headers.get("access-control-allow-credentials"), null);
  const denied = await fetch(`${url}/api/health`, { headers: { Origin: "https://untrusted.example" } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
  const preflight = await fetch(`${url}/api/health`, { method: "OPTIONS", headers: {
    Origin: "http://localhost:5173", "Access-Control-Request-Method": "GET",
  } });
  assert.equal(preflight.status, 204);
});

test("patient endpoints do not exist and unknown routes use a JSON 404", async (t) => {
  const url = await serve(t, createApp({ corsOrigins: [], checkDatabase: async () => {} }));
  for (const path of ["/api/measurements", "/api/users", "/api/auth/login", "/api/ai/chat", "/missing"]) {
    const response = await fetch(`${url}${path}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: { code: "NOT_FOUND", message: "API route not found." } });
  }
});

test("malformed JSON and oversized requests have safe explicit errors", async (t) => {
  const url = await serve(t, createApp({ corsOrigins: [], checkDatabase: async () => {} }));
  const malformed = await fetch(`${url}/api/unused`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: '{"broken":',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } });
  const large = await fetch(`${url}/api/unused`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: "x".repeat(33000) }),
  });
  assert.equal(large.status, 413);
});

test("central error handler does not expose unexpected exception contents", async (t) => {
  let reports = 0;
  const app = express();
  app.get("/failure", () => { throw new Error("secret-internal-details"); });
  app.use(errorHandler(() => { reports++; }));
  const url = await serve(t, app);
  const response = await fetch(`${url}/failure`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  assert.equal(reports, 1);
});

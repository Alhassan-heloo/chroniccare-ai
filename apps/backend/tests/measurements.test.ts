import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { postgresAuthStore, type User } from "../src/auth/store.js";
import { hashPassword, tokenHash } from "../src/auth/security.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";
import { postgresMeasurementStore } from "../src/measurements/store.js";
import { measurementId, validateMeasurement, type Measurement } from "../src/measurements/validation.js";

test("measurement validation preserves existing technical bounds, types and explicit dates", () => {
  assert.deepEqual(validateMeasurement({ kind: "bloodPressure", systolic: 120, diastolic: 80 }).input, { kind: "bloodPressure", systolic: 120, diastolic: 80 });
  assert.deepEqual(validateMeasurement({ kind: "glucose", value: 87.125 }).input, { kind: "glucose", value: 87.125 });
  for (const input of [null, [], {}, { kind: "other", value: 10 }, { kind: "glucose", value: "98" },
    ...[0, -1, Infinity, NaN, 1500.1].map(value => ({ kind: "glucose", value })),
    { kind: "bloodPressure", systolic: 401, diastolic: 80 }, { kind: "bloodPressure", systolic: 400, diastolic: 301 },
    { kind: "bloodPressure", systolic: 120.5, diastolic: 80 }, { kind: "bloodPressure", systolic: 80, diastolic: 80 },
    { kind: "bloodPressure", systolic: 120 }, { kind: "glucose", value: 98, patientId: randomUUID() },
    { kind: "glucose", value: 98, isExample: true }, { kind: "glucose", value: 98, unit: "mmol/L" },
    { kind: "glucose", value: 98, systolic: 120 }]) assert.throws(() => validateMeasurement(input));
  const historical = { kind: "glucose", value: 98, recordedAt: "2026-01-02T12:34:56.789+02:00" };
  assert.equal(validateMeasurement(historical, true).recordedAt, "2026-01-02T10:34:56.789Z");
  assert.throws(() => validateMeasurement(historical), "Updates cannot change recordedAt");
  for (const recordedAt of [null, "", "2026-01-02", "2026-02-30T12:00:00Z", "2026-01-01T24:00:00Z", "2026-01-02T12:00:00", "0000-01-01T12:00:00Z", "2026-01-02T12:00:00.123456Z"]) {
    assert.throws(() => validateMeasurement({ kind: "glucose", value: 98, recordedAt }, true));
  }
  assert.equal(measurementId(randomUUID()).length, 36);
  assert.throws(() => measurementId("' OR 1=1 --"));
});

test("real PostgreSQL measurements: durable CRUD, authentication, patient isolation, roles and constraints", {
  skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL is not configured; PostgreSQL measurements not verified.",
}, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  const target = new URL(databaseUrl);
  assert(target.pathname.endsWith("_test"), "A dedicated test database is required.");
  if (process.env.DATABASE_URL) {
    const application = new URL(process.env.DATABASE_URL);
    assert(target.host !== application.host || target.pathname !== application.pathname, "Test and application databases must be separate.");
  }
  const pool = createDatabasePool(readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
  const auth = postgresAuthStore(pool), store = postgresMeasurementStore(pool);
  const emails = Array.from({ length: 4 }, () => `${randomUUID()}@measurements.example.test`);
  const password = "Test-only-measurement-Password42!";
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  let base = "";
  const stop = async () => {
    if (!server) return;
    const current = server; server = undefined;
    await new Promise<void>((resolve) => { current.close(() => resolve()); current.closeAllConnections(); });
  };
  const start = async () => {
    server = createApp({ corsOrigins: ["http://localhost:5173"], authStore: auth, measurementStore: store, checkDatabase: async () => { await pool.query("SELECT 1"); }, reportError: () => {} }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address(); assert(address && typeof address !== "string"); base = `http://127.0.0.1:${address.port}`;
  };
  const request = (path: string, method = "GET", body?: unknown, token?: string) => fetch(base + path, {
    method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const login = async (email: string) => {
    const response = await request("/api/auth/login", "POST", { email, password }); assert.equal(response.status, 200);
    const result = await response.json() as { token: string }; assert(/^[a-f0-9]{64}$/.test(result.token)); return result.token;
  };
  const read = async (id: string, token: string) => {
    const response = await request(`/api/measurements/${id}`, "GET", undefined, token); assert.equal(response.status, 200);
    return (await response.json() as { measurement: Measurement }).measurement;
  };
  try {
    await applyMigrations(pool); assert.deepEqual(await applyMigrations(pool), []);
    await start();
    assert.equal((await request("/api/health")).status, 200); assert.equal((await request("/api/health/ready")).status, 200);
    for (const email of emails.slice(0, 2)) {
      const response = await request("/api/auth/register", "POST", { name: "Measurement test patient", email, password });
      assert.equal(response.status, 201); assert.equal((await response.json() as { user: User }).user.role, "patient");
    }
    let tokenA = await login(emails[0]!), tokenB = await login(emails[1]!);
    assert.equal((await request("/api/auth/me", "GET", undefined, tokenA)).status, 200);
    for (const [method, path, body] of [
      ["GET", "/api/measurements", undefined], ["GET", `/api/measurements/${randomUUID()}`, undefined],
      ["POST", "/api/measurements", { kind: "glucose", value: 98 }], ["PUT", `/api/measurements/${randomUUID()}`, { kind: "glucose", value: 98 }],
      ["DELETE", `/api/measurements/${randomUUID()}`, undefined],
    ] as const) assert.equal((await request(path, method, body)).status, 401);
    const input = { kind: "bloodPressure", systolic: 135, diastolic: 85, recordedAt: "2026-01-02T12:34:56.789+02:00" };
    const created = await request("/api/measurements", "POST", input, tokenA); assert.equal(created.status, 201);
    const reading = (await created.json() as { measurement: Measurement }).measurement;
    assert.equal(reading.recordedAt, "2026-01-02T10:34:56.789Z"); assert.equal(reading.isExample, false);
    assert.equal(created.headers.get("location"), `/api/measurements/${reading.id}`);
    assert.deepEqual(await read(reading.id, tokenA), reading);
    const patient = await auth.findAccount(emails[0]!); assert(patient);
    const row = (await pool.query<{ patient_id: string; recorded_at: Date }>("SELECT patient_id,recorded_at FROM chroniccare.measurements WHERE id=$1", [reading.id])).rows[0];
    assert.equal(row?.patient_id, patient.id); assert.equal(row?.recorded_at.toISOString(), reading.recordedAt);
    for (const method of ["GET", "PUT", "DELETE"]) assert.equal((await request(`/api/measurements/${reading.id}`, method, method === "PUT" ? { kind: "glucose", value: 99 } : undefined, tokenB)).status, 404);
    assert.deepEqual((await (await request("/api/measurements", "GET", undefined, tokenB)).json() as { measurements: Measurement[] }).measurements, []);
    const update = await request(`/api/measurements/${reading.id}`, "PUT", { kind: "glucose", value: 87.125 }, tokenA); assert.equal(update.status, 200);
    const updated = (await update.json() as { measurement: Measurement }).measurement;
    assert.equal(updated.kind, "glucose"); assert.equal(updated.recordedAt, reading.recordedAt);
    assert.equal(updated.kind === "glucose" && updated.value, 87.125);
    const normalized = (await pool.query<{ systolic: number | null; diastolic: number | null }>("SELECT systolic,diastolic FROM chroniccare.measurements WHERE id=$1", [reading.id])).rows[0];
    assert.deepEqual(normalized, { systolic: null, diastolic: null });
    for (const bad of [{ kind: "glucose", value: 0 }, { kind: "bloodPressure", systolic: 80, diastolic: 120 }, { kind: "glucose", value: 98, patient_id: patient.id }, { kind: "glucose", value: 98, recordedAt: "not-date" }]) {
      assert.equal((await request("/api/measurements", "POST", bad, tokenA)).status, 400);
    }
    assert.equal((await request(`/api/measurements/${reading.id}`, "PUT", { kind: "glucose", value: 99, recordedAt: reading.recordedAt }, tokenA)).status, 400);
    assert.equal((await request("/api/measurements/not-a-uuid", "DELETE", undefined, tokenA)).status, 400);
    assert.equal((await request(`/api/measurements/${randomUUID()}`, "DELETE", undefined, tokenA)).status, 404);
    assert.equal((await request("/api/auth/logout", "POST", {}, tokenA)).status, 204);
    assert.equal((await request("/api/measurements", "GET", undefined, tokenA)).status, 401);
    await stop(); await start(); // A fresh Express instance reads committed PostgreSQL data.
    tokenA = await login(emails[0]!); assert.deepEqual(await read(reading.id, tokenA), updated);
    for (const [index, role] of [[2, "doctor"], [3, "admin"]] as const) {
      await auth.createUser(role, emails[index]!, await hashPassword(password), role);
      const token = await login(emails[index]!);
      for (const method of ["GET", "POST", "PUT", "DELETE"]) {
        const path = method === "PUT" || method === "DELETE" ? `/api/measurements/${reading.id}` : "/api/measurements";
        assert.equal((await request(path, method, ["POST", "PUT"].includes(method) ? { kind: "glucose", value: 98 } : undefined, token)).status, 403);
      }
    }
    await pool.query("UPDATE chroniccare.sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [tokenHash(tokenB)]);
    assert.equal((await request("/api/measurements", "GET", undefined, tokenB)).status, 401);
    tokenB = await login(emails[1]!); assert.equal((await request(`/api/measurements/${reading.id}`, "DELETE", undefined, tokenB)).status, 404);
    await assert.rejects(()=>pool.query("INSERT INTO chroniccare.measurements(id,patient_id,kind) VALUES($1,$2,'glucose')",[randomUUID(),patient.id]));
    await assert.rejects(()=>pool.query("INSERT INTO chroniccare.measurements(id,patient_id,kind,value) VALUES($1,$2,'glucose',1501)",[randomUUID(),patient.id]));
    const preflight = await fetch(base + `/api/measurements/${reading.id}`, { method: "OPTIONS", headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "authorization,content-type" } });
    assert.equal(preflight.status, 204); assert((preflight.headers.get("access-control-allow-methods") ?? "").includes("PUT"));
    assert.equal((await request(`/api/measurements/${reading.id}`, "DELETE", undefined, tokenA)).status, 204);
    assert.equal((await request(`/api/measurements/${reading.id}`, "GET", undefined, tokenA)).status, 404);
  } finally {
    await stop();
    try {
      await pool.query("DELETE FROM chroniccare.measurements WHERE patient_id IN (SELECT id FROM chroniccare.users WHERE email=ANY($1::text[]))", [emails]);
      await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]);
    } finally { await pool.end(); }
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { postgresAuthStore, type User } from "../src/auth/store.js";
import { hashPassword } from "../src/auth/security.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";
import { postgresMedicationStore } from "../src/medications/store.js";
import { medicationDate, medicationId, medicationTime, validateDoseAction, validateMedication, type Medication } from "../src/medications/validation.js";

test("medication validation enforces text, one-to-six unique times and calendar dates", () => {
  assert.deepEqual(validateMedication({ name: "  Example medicine  ", dosage: " prescribed ", notes: " note ", doses: [{ time: "20:00" }, { time: "08:00" }] }),
    { name: "Example medicine", dosage: "prescribed", notes: "note", doses: [{ time: "08:00" }, { time: "20:00" }] });
  for (const input of [null, [], {}, { name: "A", dosage: "x", notes: "", doses: [{ time: "08:00" }] },
    { name: "Valid", dosage: "", notes: "", doses: [{ time: "08:00" }] }, { name: "Valid", dosage: "x", notes: "", doses: [] },
    { name: "Valid", dosage: "x", notes: "", doses: [{ time: "08:00" }, { time: "08:00" }] },
    { name: "Valid", dosage: "x", notes: "", doses: [{ time: "24:00" }] },
    { name: "Valid", dosage: "x", notes: "", doses: Array.from({ length: 7 }, (_, index) => ({ time: `0${index}:00` })) },
    { name: "Valid", dosage: "x", notes: "", doses: [{ time: "08:00", takenOn: "2026-01-01" }] },
    { name: "Valid", dosage: "x", notes: "", doses: [{ time: "08:00" }], patientId: randomUUID() }]) assert.throws(() => validateMedication(input));
  assert.deepEqual(validateDoseAction({ date: "2026-02-28", taken: true }), { date: "2026-02-28", taken: true });
  for (const input of [{ date: "2026-02-29", taken: true }, { date: "2026-01-01", taken: 1 }, { date: "2026-01-01", taken: true, patientId: randomUUID() }]) assert.throws(() => validateDoseAction(input));
  assert.equal(medicationDate("2024-02-29"), "2024-02-29"); assert.throws(() => medicationDate("2024-02-30"));
  assert.equal(medicationTime("23:59"), "23:59"); assert.throws(() => medicationTime("23:60"));
  assert.equal(medicationId(randomUUID()).length, 36); assert.throws(() => medicationId("not-a-uuid"));
});

test("real PostgreSQL medications: schedules, daily logs, durable CRUD, authorization and isolation", {
  skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL is not configured; PostgreSQL medications not verified.",
}, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  const target = new URL(databaseUrl); assert(target.pathname.endsWith("_test"), "A dedicated test database is required.");
  if (process.env.DATABASE_URL) { const application = new URL(process.env.DATABASE_URL); assert(target.host !== application.host || target.pathname !== application.pathname); }
  const pool = createDatabasePool(readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
  const auth = postgresAuthStore(pool), store = postgresMedicationStore(pool);
  const emails = Array.from({ length: 4 }, () => `${randomUUID()}@medications.example.test`), password = "Test-only-medication-Password42!";
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined, base = "";
  const stop = async () => { if (!server) return; const current = server; server = undefined; await new Promise<void>(resolve => { current.close(() => resolve()); current.closeAllConnections(); }); };
  const start = async () => { server = createApp({ corsOrigins: ["http://localhost:5173"], authStore: auth, medicationStore: store, checkDatabase: async () => { await pool.query("SELECT 1"); }, reportError: () => {} }).listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string"); base = `http://127.0.0.1:${address.port}`; };
  const request = (path: string, method = "GET", body?: unknown, token?: string) => fetch(base + path, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const login = async (email: string) => { const response = await request("/api/auth/login", "POST", { email, password }); assert.equal(response.status, 200); return (await response.json() as { token: string }).token; };
  const day = "2026-10-29", nextDay = "2026-10-30";
  const get = async (id: string, token: string, date = day) => { const response = await request(`/api/medications/${id}?date=${date}`, "GET", undefined, token); assert.equal(response.status, 200); return (await response.json() as { medication: Medication }).medication; };
  try {
    await applyMigrations(pool); assert.deepEqual(await applyMigrations(pool), []); await start();
    for (const email of emails.slice(0, 2)) { const response = await request("/api/auth/register", "POST", { name: "Medication patient", email, password }); assert.equal(response.status, 201); assert.equal((await response.json() as { user: User }).user.role, "patient"); }
    let tokenA = await login(emails[0]!); const tokenB = await login(emails[1]!);
    for (const [method, path, body] of [["GET", `/api/medications?date=${day}`, undefined], ["POST", `/api/medications?date=${day}`, { name: "Test medicine", dosage: "As prescribed", notes: "", doses: [{ time: "08:00" }] }], ["PUT", `/api/medications/${randomUUID()}?date=${day}`, {}], ["DELETE", `/api/medications/${randomUUID()}`, undefined], ["PUT", `/api/medications/${randomUUID()}/doses/08%3A00`, { date: day, taken: true }]] as const) assert.equal((await request(path, method, body)).status, 401);
    const input = { name: "  Test medicine  ", dosage: " As prescribed ", notes: " Patient note ", doses: [{ time: "20:00" }, { time: "08:00" }] };
    const createdResponse = await request(`/api/medications?date=${day}`, "POST", input, tokenA); assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json() as { medication: Medication }).medication;
    assert.equal(created.name, "Test medicine"); assert.deepEqual(created.doses, [{ time: "08:00", takenOn: null }, { time: "20:00", takenOn: null }]);
    assert.equal(createdResponse.headers.get("location"), `/api/medications/${created.id}`); assert.deepEqual(await get(created.id, tokenA), created);
    const account = await auth.findAccount(emails[0]!); assert(account);
    const ownership = await pool.query("SELECT patient_id FROM chroniccare.medications WHERE id=$1", [created.id]); assert.equal(ownership.rows[0]?.patient_id, account.id);
    assert.equal((await request(`/api/medications/${created.id}/doses/08%3A00`, "PUT", { date: day, taken: true }, tokenA)).status, 204);
    assert.equal((await request(`/api/medications/${created.id}/doses/08%3A00`, "PUT", { date: day, taken: true }, tokenA)).status, 204);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.medication_dose_logs WHERE medication_id=$1 AND scheduled_time='08:00' AND taken_on=$2", [created.id, day])).rowCount, 1);
    assert.equal((await get(created.id, tokenA)).doses[0]?.takenOn, day); assert.equal((await get(created.id, tokenA, nextDay)).doses[0]?.takenOn, null);
    assert.equal((await request(`/api/medications/${created.id}/doses/20%3A00`, "PUT", { date: day, taken: true }, tokenA)).status, 204);
    const update = await request(`/api/medications/${created.id}?date=${day}`, "PUT", { name: "Updated medicine", dosage: "Updated directions", notes: "", doses: [{ time: "08:00" }, { time: "21:00" }] }, tokenA); assert.equal(update.status, 200);
    const updated = (await update.json() as { medication: Medication }).medication;
    assert.deepEqual(updated.doses, [{ time: "08:00", takenOn: day }, { time: "21:00", takenOn: null }]);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.medication_dose_logs WHERE medication_id=$1 AND scheduled_time='20:00'", [created.id])).rowCount, 0, "Removed schedules cascade their dose history");
    assert.equal((await request(`/api/medications/${created.id}/doses/08%3A00`, "PUT", { date: day, taken: false }, tokenA)).status, 204);
    assert.equal((await get(created.id, tokenA)).doses[0]?.takenOn, null);
    for (const bad of [{ ...input, doses: [{ time: "08:00" }, { time: "08:00" }] }, { ...input, doses: [] }, { ...input, patientId: account.id }, { ...input, notes: "x".repeat(401) }]) assert.equal((await request(`/api/medications?date=${day}`, "POST", bad, tokenA)).status, 400);
    assert.equal((await request("/api/medications", "GET", undefined, tokenA)).status, 400);
    assert.equal((await request(`/api/medications/${created.id}/doses/25%3A00`, "PUT", { date: day, taken: true }, tokenA)).status, 400);
    assert.equal((await request(`/api/medications/${created.id}/doses/21%3A00`, "PUT", { date: "2026-02-30", taken: true }, tokenA)).status, 400);
    for (const method of ["GET", "PUT", "DELETE"] as const) { const path = method === "GET" || method === "PUT" ? `/api/medications/${created.id}?date=${day}` : `/api/medications/${created.id}`; assert.equal((await request(path, method, method === "PUT" ? input : undefined, tokenB)).status, 404); }
    assert.equal((await request(`/api/medications/${created.id}/doses/08%3A00`, "PUT", { date: day, taken: true }, tokenB)).status, 404);
    assert.deepEqual((await (await request(`/api/medications?date=${day}`, "GET", undefined, tokenB)).json() as { medications: Medication[] }).medications, []);
    await stop(); await start(); tokenA = await login(emails[0]!); assert.equal((await get(created.id, tokenA)).name, "Updated medicine");
    for (const [index, role] of [[2, "doctor"], [3, "admin"]] as const) { await auth.createUser(role, emails[index]!, await hashPassword(password), role); const token = await login(emails[index]!); for (const method of ["GET", "POST", "PUT", "DELETE"]) { const path = method === "PUT" || method === "DELETE" ? `/api/medications/${created.id}${method === "PUT" ? `?date=${day}` : ""}` : `/api/medications?date=${day}`; assert.equal((await request(path, method, ["POST", "PUT"].includes(method) ? input : undefined, token)).status, 403); } }
    await assert.rejects(() => pool.query("INSERT INTO chroniccare.medications(id,patient_id,name,dosage,notes) VALUES($1,$2,'A','x','')", [randomUUID(), account.id]));
    assert.equal((await request(`/api/medications/${created.id}`, "DELETE", undefined, tokenA)).status, 204); assert.equal((await request(`/api/medications/${created.id}?date=${day}`, "GET", undefined, tokenA)).status, 404);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.medication_schedules WHERE medication_id=$1", [created.id])).rowCount, 0);
  } finally {
    await stop();
    try { await pool.query("DELETE FROM chroniccare.medications WHERE patient_id IN(SELECT id FROM chroniccare.users WHERE email=ANY($1::text[]))", [emails]); await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]); }
    finally { await pool.end(); }
  }
});

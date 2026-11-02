import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { hashPassword, tokenHash } from "../src/auth/security.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { postgresConnectionStore } from "../src/connections/store.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";
import { postgresDoctorStore } from "../src/doctor/store.js";
import { postgresMeasurementStore } from "../src/measurements/store.js";
import { postgresMedicationStore } from "../src/medications/store.js";
import { postgresHabitStore } from "../src/habits/store.js";

test("PostgreSQL patient connections: consent, legacy data, expiry, races, isolation, revocation and restart", {
  skip: !process.env.TEST_DATABASE_URL && "Dedicated PostgreSQL test database required.",
}, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  assert(new URL(databaseUrl).pathname.endsWith("_test"));
  if (process.env.DATABASE_URL) assert.notEqual(new URL(databaseUrl).pathname, new URL(process.env.DATABASE_URL).pathname);
  const pool = createDatabasePool(readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
  const auth = postgresAuthStore(pool), connections = postgresConnectionStore(pool);
  const emails = Array.from({ length: 5 }, () => randomUUID() + "@connections.example.test");
  const password = "Connection-test-password42!";
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  let base = "";
  const stop = async () => { if (server) { const current = server; server = undefined; await new Promise<void>(resolve => { current.close(() => resolve()); current.closeAllConnections(); }); } };
  const start = async () => {
    server = createApp({ corsOrigins: [], checkDatabase: async () => {}, authStore: auth, connectionStore: connections,
      doctorStore: postgresDoctorStore(pool), measurementStore: postgresMeasurementStore(pool),
      medicationStore: postgresMedicationStore(pool), habitStore: postgresHabitStore(pool),
    }).listen(0, "127.0.0.1");
    await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}/api`;
  };
  const request = (path: string, token?: string, body?: unknown, method = body ? "POST" : "GET") => fetch(base + path + (path.startsWith("/doctor/patients/") ? "?date=2026-11-01" : ""), {
    method, headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const generate = async (token: string) => {
    const response = await request("/connections/codes", token, undefined, "POST"); assert.equal(response.status, 201);
    return await response.json() as { code: string; expiresAt: string };
  };
  try {
    await applyMigrations(pool);
    const hash = await hashPassword(password);
    const roles = ["admin", "doctor", "doctor", "patient", "patient"] as const;
    const users = [];
    for (const [index, role] of roles.entries()) users.push(await auth.createUser("Connection " + role + index, emails[index]!, hash, role));
    const [admin, d1, d2, p1, p2] = users; assert(admin && d1 && d2 && p1 && p2);
    // Existing relationships remain unchanged and are not retrospectively labelled consented.
    await pool.query("INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id) VALUES($1,$2)", [d2.id, p2.id]);
    await start();
    const tokens: string[] = [];
    for (const user of users) { const response = await request("/auth/login", undefined, { email: user.email, password }); assert.equal(response.status, 200); tokens.push((await response.json() as { token: string }).token); }
    const [a, dt1, dt2, pt1, pt2] = tokens; assert(a && dt1 && dt2 && pt1 && pt2);
    assert.equal((await request("/connections/doctors")).status, 401);
    assert.equal((await request("/connections/codes", pt1, undefined, "POST")).status, 403);
    assert.equal((await request("/connections/codes", a, undefined, "POST")).status, 403);
    assert.equal((await request("/connections/doctors", dt1)).status, 403);
    assert.equal((await request(`/doctor/patients/${p1.id}`, a)).status, 403);
    const legacy = await (await request("/connections/doctors", pt2)).json() as { doctors: { approvedAt: string | null }[] };
    assert.equal(legacy.doctors[0]!.approvedAt, null);
    const code = await generate(dt1);
    assert.equal(code.code.length, 32);
    assert(Date.parse(code.expiresAt) - Date.now() <= 600_000);
    const stored = await pool.query("SELECT * FROM chroniccare.doctor_connection_codes WHERE code_hash=$1", [tokenHash(code.code)]);
    assert.equal(stored.rowCount, 1); assert(!JSON.stringify(stored.rows).includes(code.code));
    assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 404);
    const preview = await request("/connections/preview", pt1, { code: code.code }); assert.equal(preview.status, 200);
    assert.equal((await preview.json() as { doctor: { id: string } }).doctor.id, d1.id);
    assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 404);
    assert.equal((await request("/connections/approve", dt1, { code: code.code })).status, 403);
    assert.equal((await request("/connections/approve", pt1, { code: code.code, patientId: p2.id })).status, 400);
    assert.equal((await request("/connections/approve", pt1, { code: code.code })).status, 204);
    assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 200);
    assert.equal((await request(`/doctor/patients/${p1.id}`, dt2)).status, 404);
    assert.equal((await request(`/doctor/patients/${p2.id}`, dt1)).status, 404);
    assert.equal((await request("/connections/approve", pt2, { code: code.code })).status, 404);
    const duplicate = await generate(dt1);
    assert.equal((await request("/connections/approve", pt1, { code: duplicate.code })).status, 204);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1 AND patient_id=$2", [d1.id, p1.id])).rowCount, 1);
    const expired = await generate(dt1);
    await pool.query("UPDATE chroniccare.doctor_connection_codes SET created_at=now()-interval '20 minutes',expires_at=now()-interval '10 minutes' WHERE code_hash=$1", [tokenHash(expired.code)]);
    assert.equal((await request("/connections/preview", pt1, { code: expired.code })).status, 404);
    assert.equal((await request("/connections/approve", pt1, { code: expired.code })).status, 404);
    await stop(); await start();
    assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 200);
    assert.equal((await request(`/connections/doctors/${d1.id}`, pt2, undefined, "DELETE")).status, 204);
    assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 200);
    assert.equal((await request(`/connections/doctors/${d1.id}`, pt1, undefined, "DELETE")).status, 204);
    assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 404);
    assert.equal((await request("/connections/approve", pt1, { code: code.code })).status, 404);
    const raceCode = await generate(dt1);
    const race = await Promise.all([request("/connections/approve", pt1, { code: raceCode.code }), request("/connections/approve", pt2, { code: raceCode.code })]);
    assert.deepEqual(race.map(response => response.status).sort(), [204, 404]);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1", [d1.id])).rowCount, 1);
    for (let attempt = 0; attempt < 21; attempt++) await request("/connections/preview", pt1, { code: "A".repeat(32) });
    assert.equal((await request("/connections/preview", pt1, { code: "A".repeat(32) })).status, 429);
    assert.equal((await request("/auth/logout", pt1, undefined, "POST")).status, 204);
    assert.equal((await request("/connections/doctors", pt1)).status, 401);
  } finally {
    await stop();
    try { await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]); }
    finally { await pool.end(); }
  }
});

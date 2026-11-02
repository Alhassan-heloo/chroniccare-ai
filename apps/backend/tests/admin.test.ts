import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { postgresAdminStore } from "../src/admin/store.js";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/security.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";
import { postgresDoctorStore } from "../src/doctor/store.js";
import { postgresHabitStore } from "../src/habits/store.js";
import { postgresMeasurementStore } from "../src/measurements/store.js";
import { postgresMedicationStore } from "../src/medications/store.js";

test("real PostgreSQL Admin workflow: Doctor creation, RBAC, login and persistence", {
  skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL is not configured; PostgreSQL Admin workflow not verified.",
}, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  const target = new URL(databaseUrl);
  assert(target.pathname.endsWith("_test"), "A dedicated test database is required.");
  if (process.env.DATABASE_URL) {
    const application = new URL(process.env.DATABASE_URL);
    assert(target.host !== application.host || target.pathname !== application.pathname,
      "Test and application databases must be separate.");
  }
  const pool = createDatabasePool(readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
  const auth = postgresAuthStore(pool), admin = postgresAdminStore(pool), doctors = postgresDoctorStore(pool);
  const measurements = postgresMeasurementStore(pool), medications = postgresMedicationStore(pool), habits = postgresHabitStore(pool);
  const password = "Test-only-Admin-Doctor42!";
  const emails = Array.from({ length: 4 }, () => randomUUID() + "@admin.example.test");
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  let base = "";
  const stop = async () => {
    if (!server) return;
    const current = server; server = undefined;
    await new Promise<void>(resolve => { current.close(() => resolve()); current.closeAllConnections(); });
  };
  const start = async () => {
    server = createApp({
      corsOrigins: ["http://localhost:5173"], authStore: auth, adminStore: admin, doctorStore: doctors,
      measurementStore: measurements, medicationStore: medications, habitStore: habits,
      checkDatabase: async () => { await pool.query("SELECT 1"); }, reportError: () => {},
    }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address(); assert(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  };
  const request = (path: string, method = "GET", token?: string, body?: unknown) => fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const login = async (email: string) => {
    const response = await request("/api/auth/login", "POST", undefined, { email, password });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string; user: { role: string } });
  };
  try {
    await applyMigrations(pool);
    const passwordHash = await hashPassword(password);
    const adminUser = await auth.createUser("Admin Test", emails[0]!, passwordHash, "admin");
    const patient = await auth.createUser("Patient Test", emails[1]!, passwordHash, "patient");
    const existingDoctor = await auth.createUser("Existing Doctor", emails[2]!, passwordHash, "doctor");
    await start();
    const adminSession = await login(adminUser.email);
    const patientSession = await login(patient.email);
    const doctorSession = await login(existingDoctor.email);

    assert.equal((await request("/api/admin/doctors")).status, 401);
    assert.equal((await request("/api/admin/doctors", "GET", patientSession.token)).status, 403);
    assert.equal((await request("/api/admin/doctors", "GET", doctorSession.token)).status, 403);
    const initial = await request("/api/admin/doctors", "GET", adminSession.token);
    assert.equal(initial.status, 200);
    assert((await initial.json() as { doctors: { id: string }[] }).doctors.some(doctor => doctor.id === existingDoctor.id));

    const input = { name: "New Doctor", email: emails[3]!, password };
    const created = await request("/api/admin/doctors", "POST", adminSession.token, input);
    assert.equal(created.status, 201);
    const body = await created.json() as { doctor: { id: string; name: string; email: string; role: string; password_hash?: string } };
    assert.deepEqual({ name: body.doctor.name, email: body.doctor.email, role: body.doctor.role },
      { name: input.name, email: input.email, role: "doctor" });
    assert.equal(body.doctor.password_hash, undefined);
    const stored = await auth.findAccount(input.email);
    assert(stored); assert.match(stored.password_hash, /^\$argon2id\$/); assert.notEqual(stored.password_hash, password);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1", [body.doctor.id])).rowCount, 0);

    assert.equal((await request("/api/admin/doctors", "POST", adminSession.token, input)).status, 409);
    for (const invalid of [
      { ...input, name: "" }, { ...input, email: "invalid" }, { ...input, password: "short" },
      { ...input, email: randomUUID() + "@admin.example.test", role: "admin" },
    ]) assert.equal((await request("/api/admin/doctors", "POST", adminSession.token, invalid)).status, 400);
    assert.equal((await request("/api/auth/register", "POST", undefined,
      { ...input, email: randomUUID() + "@admin.example.test", role: "doctor" })).status, 400);

    const newDoctorSession = await login(input.email);
    assert.equal(newDoctorSession.user.role, "doctor");
    assert.equal((await request("/api/admin/doctors", "GET", newDoctorSession.token)).status, 403);
    const patientList = await request("/api/doctor/patients", "GET", newDoctorSession.token);
    assert.equal(patientList.status, 200);
    assert.deepEqual((await patientList.json() as { patients: unknown[] }).patients, []);

    await stop(); await start();
    const persistedDoctorSession = await login(input.email);
    assert.equal(persistedDoctorSession.user.role, "doctor");
    const persistedAdminSession = await login(adminUser.email);
    const persisted = await request("/api/admin/doctors", "GET", persistedAdminSession.token);
    assert((await persisted.json() as { doctors: { id: string }[] }).doctors.some(doctor => doctor.id === body.doctor.id));
  } finally {
    await stop();
    try { await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]); }
    finally { await pool.end(); }
  }
});

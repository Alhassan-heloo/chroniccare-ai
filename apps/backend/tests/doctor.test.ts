import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/security.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";
import { postgresDoctorStore } from "../src/doctor/store.js";
import { doctorPatientId } from "../src/doctor/validation.js";
import { postgresHabitStore } from "../src/habits/store.js";
import { postgresMeasurementStore } from "../src/measurements/store.js";
import { postgresMedicationStore } from "../src/medications/store.js";

test("doctor patient identifiers accept UUIDs and reject untrusted paths", () => {
  assert.equal(doctorPatientId(randomUUID()).length, 36);
  for (const value of ["", "all", "' OR 1=1 --", "00000000-0000-0000-0000-00000000000z"]) {
    assert.throws(() => doctorPatientId(value));
  }
});

test("real PostgreSQL doctor workflow: assigned-patient read access, roles and isolation", {
  skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL is not configured; PostgreSQL doctor workflow not verified.",
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
  const auth = postgresAuthStore(pool);
  const doctors = postgresDoctorStore(pool);
  const measurements = postgresMeasurementStore(pool);
  const medications = postgresMedicationStore(pool);
  const habits = postgresHabitStore(pool);
  const password = "Test-only-doctor-Password42!";
  const emails = Array.from({ length: 5 }, () => randomUUID() + "@doctor.example.test");
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  let base = "";
  const stop = async () => {
    if (!server) return;
    const current = server; server = undefined;
    await new Promise<void>(resolve => { current.close(() => resolve()); current.closeAllConnections(); });
  };
  const start = async () => {
    server = createApp({
      corsOrigins: ["http://localhost:5173"], authStore: auth, doctorStore: doctors,
      measurementStore: measurements, medicationStore: medications, habitStore: habits,
      checkDatabase: async () => { await pool.query("SELECT 1"); }, reportError: () => {},
    }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address(); assert(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  };
  const request = (path: string, method = "GET", token?: string) => fetch(base + path, {
    method, headers: token ? { Authorization: "Bearer " + token } : undefined,
  });
  const login = async (email: string) => {
    const response = await fetch(base + "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  let patientAId = "", patientBId = "";
  try {
    await applyMigrations(pool); assert.deepEqual(await applyMigrations(pool), []);
    const passwordHash = await hashPassword(password);
    const doctorA = await auth.createUser("Doctor A", emails[0]!, passwordHash, "doctor");
    const doctorB = await auth.createUser("Doctor B", emails[1]!, passwordHash, "doctor");
    const patientA = await auth.createUser("Patient A", emails[2]!, passwordHash, "patient"); patientAId = patientA.id;
    const patientB = await auth.createUser("Patient B", emails[3]!, passwordHash, "patient"); patientBId = patientB.id;
    await auth.createUser("Admin", emails[4]!, passwordHash, "admin");
    await pool.query("INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id) VALUES($1,$2)",
      [doctorA.id, patientA.id]);
    const day = "2026-10-31";
    const pressure = await measurements.create(patientA.id, {
      input: { kind: "bloodPressure", systolic: 132, diastolic: 84 }, recordedAt: "2026-10-31T08:30:00.000Z",
    });
    const medication = await medications.create(patientA.id,
      { name: "Recorded medicine", dosage: "Recorded dosage", notes: "", doses: [{ time: "08:00" }] }, day);
    assert(await medications.setDose(patientA.id, medication.id, "08:00", { date: day, taken: true }));
    const habit = await habits.create(patientA.id, { title: "Recorded habit", unit: "minutes", target: 20 }, day);
    assert(await habits.setProgress(patientA.id, habit.id, { date: day, value: 10 }));
    await measurements.create(patientB.id, {
      input: { kind: "glucose", value: 99 }, recordedAt: "2026-10-31T09:00:00.000Z",
    });
    await start();
    let doctorAToken = await login(emails[0]!);
    const doctorBToken = await login(emails[1]!);
    const patientToken = await login(emails[2]!);
    const adminToken = await login(emails[4]!);

    assert.equal((await request("/api/doctor/patients")).status, 401);
    for (const token of [patientToken, adminToken]) {
      assert.equal((await request("/api/doctor/patients", "GET", token)).status, 403);
    }
    const listResponse = await request("/api/doctor/patients", "GET", doctorAToken);
    assert.equal(listResponse.status, 200);
    const listed = (await listResponse.json() as { patients: { id: string; name: string; email?: string }[] }).patients;
    assert.deepEqual(listed, [{ id: patientA.id, name: "Patient A" }]);
    assert.equal(listed[0]?.email, undefined, "The doctor list exposes only the minimum patient identity.");
    const doctorBList = await (await request("/api/doctor/patients", "GET", doctorBToken)).json() as { patients: unknown[] };
    assert.deepEqual(doctorBList.patients, []);

    const overviewResponse = await request(`/api/doctor/patients/${patientA.id}?date=${day}`, "GET", doctorAToken);
    assert.equal(overviewResponse.status, 200);
    const overview = await overviewResponse.json() as {
      patient: { id: string; name: string; email?: string }; date: string;
      measurements: { id: string; recordedAt: string }[];
      medications: { id: string; doses: { time: string; takenOn: string | null }[] }[];
      habits: { id: string; progress: number; recordedOn: string }[];
    };
    assert.deepEqual(overview.patient, { id: patientA.id, name: "Patient A" });
    assert.equal(overview.patient.email, undefined);
    assert.equal(overview.date, day);
    assert.equal(overview.measurements[0]?.id, pressure.id);
    assert.equal(overview.measurements[0]?.recordedAt, "2026-10-31T08:30:00.000Z");
    assert.deepEqual(overview.medications[0]?.doses, [{ time: "08:00", takenOn: day }]);
    assert.equal(overview.habits[0]?.id, habit.id);
    assert.equal(overview.habits[0]?.progress, 10);
    assert.equal(overview.habits[0]?.recordedOn, day);

    assert.equal((await request(`/api/doctor/patients/${patientB.id}?date=${day}`, "GET", doctorAToken)).status, 404);
    assert.equal((await request(`/api/doctor/patients/${patientA.id}?date=${day}`, "GET", doctorBToken)).status, 404);
    assert.equal((await request(`/api/doctor/patients/not-a-uuid?date=${day}`, "GET", doctorAToken)).status, 400);
    assert.equal((await request(`/api/doctor/patients/${patientA.id}?date=2026-02-30`, "GET", doctorAToken)).status, 400);
    for (const method of ["POST", "PUT", "DELETE"]) {
      assert.equal((await request("/api/doctor/patients", method, doctorAToken)).status, 404,
        "The first doctor workflow is read-only.");
    }
    await assert.rejects(() => pool.query(
      "INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id) VALUES($1,$2)", [patientA.id, patientB.id]));
    await assert.rejects(() => pool.query(
      "INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id) VALUES($1,$2)", [doctorA.id, doctorB.id]));

    await stop(); await start(); doctorAToken = await login(emails[0]!);
    assert.equal((await request(`/api/doctor/patients/${patientA.id}?date=${day}`, "GET", doctorAToken)).status, 200,
      "The authorized relationship and patient record persist after an Express restart.");
  } finally {
    await stop();
    try {
      const patients = [patientAId, patientBId].filter(Boolean);
      if (patients.length) {
        await pool.query("DELETE FROM chroniccare.measurements WHERE patient_id=ANY($1::uuid[])", [patients]);
        await pool.query("DELETE FROM chroniccare.medications WHERE patient_id=ANY($1::uuid[])", [patients]);
        await pool.query("DELETE FROM chroniccare.habits WHERE patient_id=ANY($1::uuid[])", [patients]);
      }
      await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]);
    } finally { await pool.end(); }
  }
});

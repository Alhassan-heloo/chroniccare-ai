import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { postgresAdminStore } from "../src/admin/store.js";
import { createApp } from "../src/app.js";
import { hashPassword, tokenHash } from "../src/auth/security.js";
import { accountService } from "../src/auth/accounts.js";
import type { EmailMessage } from "../src/auth/email.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";
import { postgresDoctorStore } from "../src/doctor/store.js";
import { postgresHabitStore } from "../src/habits/store.js";
import { postgresMeasurementStore } from "../src/measurements/store.js";
import { postgresMedicationStore } from "../src/medications/store.js";

test("real PostgreSQL Doctor invitations: delivery, activation, expiry, single use, identity, RBAC and existing login", {
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
  const emails = Array.from({ length: 7 }, () => randomUUID() + "@admin.example.test");
  const messages: EmailMessage[] = [];
  let deliveryFails = false;
  const delivery = { async send(message: EmailMessage) { if (deliveryFails) throw new Error("Test delivery failure"); messages.push(message); } };
  const service = accountService(pool, { publicOrigin: "http://localhost:5173", email: delivery });
  const tokenFrom = (index: number) => { const token = messages[index]?.text.match(/#token=([a-f0-9]{64})/)?.[1]; assert(token); return token; };
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  let base = "";
  const stop = async () => {
    if (!server) return;
    const current = server; server = undefined;
    await new Promise<void>(resolve => { current.close(() => resolve()); current.closeAllConnections(); });
  };
  const start = async (emailAvailable = true) => {
    server = createApp({
      corsOrigins: ["http://localhost:5173"], authStore: auth, adminStore: admin, doctorStore: doctors,
      measurementStore: measurements, medicationStore: medications, habitStore: habits,
      accountService: emailAvailable ? service : accountService(pool, { publicOrigin: "http://localhost:5173" }),
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
    assert.equal((await request("/api/admin/invitations")).status,401);
    for(const session of [patientSession,doctorSession])assert.equal((await request("/api/admin/invitations","GET",session.token)).status,403);
    const initial = await request("/api/admin/doctors", "GET", adminSession.token);
    assert.equal(initial.status, 200);
    assert((await initial.json() as { doctors: { id: string }[] }).doctors.some(doctor => doctor.id === existingDoctor.id));

    const input = { name: "New Doctor", email: emails[3]! };
    assert.equal((await request("/api/admin/doctors", "POST", undefined, input)).status, 401);
    for (const token of [patientSession.token, doctorSession.token]) assert.equal((await request("/api/admin/doctors", "POST", token, input)).status, 403);
    const created = await request("/api/admin/doctors", "POST", adminSession.token, input);
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), { invitation: input });
    assert.equal(messages.length, 1); assert.equal(messages[0]!.to, input.email);
    const activation = tokenFrom(0);
    assert.equal(await auth.findAccount(input.email), undefined, "Invitation cannot sign in before activation");
    assert.equal((await request("/api/auth/login", "POST", undefined, { email: input.email, password })).status, 401);
    const tokenRow = (await pool.query("SELECT token_hash,expires_at,consumed_at,delivered,invited_name,user_id FROM chroniccare.account_tokens WHERE email=$1", [input.email])).rows[0];
    assert(tokenRow.token_hash === tokenHash(activation) && tokenRow.token_hash !== activation);
    assert.equal(tokenRow.delivered, true); assert.equal(tokenRow.consumed_at, null); assert.equal(tokenRow.user_id, null);
    assert.equal(tokenRow.invited_name, input.name); assert(tokenRow.expires_at > new Date());
    const ledger=await (await request("/api/admin/invitations","GET",adminSession.token)).json() as {invitations:{email:string;issuedAt:string;status:string;accountStatus:string;token_hash?:string}[]};
    const invited=ledger.invitations.find(item=>item.email===input.email)!;
    assert.equal(invited.status,"pending");assert.equal(invited.accountStatus,"not-created");assert.equal(invited.token_hash,undefined);
    assert(Number.isFinite(Date.parse(invited.issuedAt)));assert(!JSON.stringify(ledger).includes(activation));
    assert.equal((await request("/api/admin/doctors", "POST", adminSession.token, input)).status, 409);
    assert.equal(messages.length, 1);
    for (const invalid of [
      { ...input, name: "" }, { ...input, email: "invalid" }, { ...input, password: "short" },
      { ...input, email: randomUUID() + "@admin.example.test", role: "admin" },
    ]) assert.equal((await request("/api/admin/doctors", "POST", adminSession.token, invalid)).status, 400);
    assert.equal((await request("/api/auth/register", "POST", undefined,
      { ...input, email: randomUUID() + "@admin.example.test", role: "doctor" })).status, 400);
    const activate = (body: unknown) => request("/api/accounts/activate-doctor", "POST", undefined, body);
    assert.equal((await activate({ token: "0".repeat(64), password })).status, 400);
    for (const extra of [{ email: patient.email }, { userId: patient.id }, { role: "admin" }, { name: "Changed" }]) {
      assert.equal((await activate({ token: activation, password, ...extra })).status, 400);
    }
    assert.equal((await request("/api/accounts/reset-password", "POST", undefined, { token: activation, password })).status, 400);
    const results = await Promise.all([activate({ token: activation, password }), activate({ token: activation, password })]);
    assert.deepEqual(results.map(r => r.status).sort(), [204, 400]);
    assert.equal((await activate({ token: activation, password })).status, 400);
    const stored = await auth.findAccount(input.email); assert(stored);
    assert.equal(stored.name, input.name); assert.equal(stored.role, "doctor"); assert.match(stored.password_hash, /^\$argon2id\$/);
    assert((await pool.query("SELECT consumed_at FROM chroniccare.account_tokens WHERE token_hash=$1", [tokenHash(activation)])).rows[0].consumed_at);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1", [stored.id])).rowCount, 0);
    assert.equal((await auth.findAccount(patient.email))!.password_hash, passwordHash, "Other account credentials unchanged");
    const newDoctorSession = await login(input.email);
    assert.equal(newDoctorSession.user.role, "doctor");
    const activated=(await admin.listInvitations!()).find(item=>item.email===input.email)!;
    assert.equal(activated.status,"closed");assert.equal(activated.accountStatus,"active");assert(activated.consumedAt);
    assert.equal((await request("/api/admin/doctors", "GET", newDoctorSession.token)).status, 403);
    const patientList = await request("/api/doctor/patients", "GET", newDoctorSession.token);
    assert.equal(patientList.status, 200);
    assert.deepEqual((await patientList.json() as { patients: unknown[] }).patients, []);

    await stop(); await start();
    const persistedDoctorSession = await login(input.email);
    assert.equal(persistedDoctorSession.user.role, "doctor");
    const persistedAdminSession = await login(adminUser.email);
    const persisted = await request("/api/admin/doctors", "GET", persistedAdminSession.token);
    assert((await persisted.json() as { doctors: { id: string }[] }).doctors.some(doctor => doctor.id === stored.id));
    // Expiry and reissue: old links stay unusable; identity comes only from the invitation.
    const expiredInput = { name: "Expiry Fixture", email: emails[4]! };
    await service.inviteDoctor(expiredInput); const expired = tokenFrom(1);
    await pool.query("UPDATE chroniccare.account_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1", [tokenHash(expired)]);
    assert.equal((await admin.listInvitations!()).find(item=>item.email===expiredInput.email)!.status,"expired");
    await assert.rejects(service.redeem("doctor_activation", { token: expired, password }));
    assert.equal(await auth.findAccount(expiredInput.email), undefined);
    await service.inviteDoctor(expiredInput); const replacement = tokenFrom(2);
    assert(replacement !== expired); await assert.rejects(service.redeem("doctor_activation", { token: expired, password }));
    // A patient registering the invited email cannot be promoted or have their password replaced.
    const claimed = await auth.createUser("Patient keeps role", expiredInput.email, passwordHash, "patient");
    await assert.rejects(service.redeem("doctor_activation", { token: replacement, password: "Different-Doctor-Password42!" }));
    assert.equal((await auth.findAccount(claimed.email))!.role, "patient");
    assert.equal((await auth.findAccount(claimed.email))!.password_hash, passwordHash);
    deliveryFails = true;
    const failedInput = { name: "Failure Fixture", email: emails[5]! };
    const failure = await request("/api/admin/doctors", "POST", persistedAdminSession.token, failedInput);
    assert.equal(failure.status, 503); assert.equal((await failure.json() as {error:{code:string}}).error.code, "EMAIL_DELIVERY_FAILED");
    assert.equal(await auth.findAccount(failedInput.email), undefined);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.account_tokens WHERE email=$1", [failedInput.email])).rowCount, 0);
    await stop(); await start(false);
    assert.equal((await request("/api/admin/doctors", "POST", persistedAdminSession.token, {name:"Missing transport",email:emails[6]})).status, 503);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.account_tokens WHERE email=$1", [emails[6]])).rowCount, 0);
    assert.equal(await auth.findAccount(emails[6]!), undefined);
  } finally {
    await stop();
    try { await pool.query("DELETE FROM chroniccare.account_tokens WHERE email=ANY($1::text[])", [emails]); await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]); }
    finally { await pool.end(); }
  }
});

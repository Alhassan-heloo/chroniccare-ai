import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { accountService } from "../src/auth/accounts.js";
import type { EmailMessage } from "../src/auth/email.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { hashPassword, tokenHash } from "../src/auth/security.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";
import { postgresAdminStore } from "../src/admin/store.js";
import { postgresDoctorStore } from "../src/doctor/store.js";
import { postgresHabitStore } from "../src/habits/store.js";
import { postgresMedicationStore } from "../src/medications/store.js";
import { postgresMeasurementStore } from "../src/measurements/store.js";
import { postgresConnectionStore } from "../src/connections/store.js";
import { configuredEmail } from "../src/auth/email.js";

test("email transport refuses missing credentials and checks provider acknowledgement", async t => {
  assert.equal(configuredEmail({}), undefined);
  assert.throws(() => configuredEmail({ EMAIL_PROVIDER: "resend" }));
  let rejected = true;
  const mocked = t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-only-key");
    const body = JSON.parse(String(init?.body)) as { to: string[] };
    assert.deepEqual(body.to, ["recipient@example.test"]);
    return rejected ? new Response("{}", { status: 503 }) : Response.json({ id: "test-provider-ack" });
  });
  const delivery = configuredEmail({ EMAIL_PROVIDER: "resend", EMAIL_API_KEY: "test-only-key", EMAIL_FROM: "clinic@example.test" })!;
  await assert.rejects(delivery.send({ to: "recipient@example.test", subject: "test", text: "test" }));
  rejected = false; await delivery.send({ to: "recipient@example.test", subject: "test", text: "test" });
  mocked.mock.restore();
});

test("secure Cookie mode trusts only the configured proxy and protects its cookie namespace", async t => {
  const app = createApp({ corsOrigins: ["https://clinic.example"], cookies: { secure: true, trustedProxy: "127.0.0.1" },
    checkDatabase: async () => {}, authStore: {
      async createUser() { throw new Error("unused"); }, async findAccount() { return undefined; }, async createSession() {},
      async sessionUser() { return undefined; }, async deleteSession() {},
    },
  });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/auth/csrf`;
  assert.equal((await fetch(base)).status, 400);
  const secure = await fetch(base, { headers: { "X-Forwarded-Proto": "https", Origin: "https://clinic.example" } });
  assert.equal(secure.status, 200);
  assert(secure.headers.getSetCookie().some(value => value.startsWith("__Host-cc_csrf=") && value.includes("Secure") && value.includes("HttpOnly") && value.includes("SameSite=Lax") && value.includes("Path=/") && !value.includes("Domain=")));
});

test("PostgreSQL account foundation: trusted invitations, cookies, CSRF, expiry, resets and medical authorization", {
  skip: !process.env.TEST_DATABASE_URL && "Dedicated PostgreSQL test database required.",
}, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  assert(new URL(databaseUrl).pathname.endsWith("_test"));
  if (process.env.DATABASE_URL) assert.notEqual(new URL(databaseUrl).pathname, new URL(process.env.DATABASE_URL).pathname);
  const pool = createDatabasePool(readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
  const emails = Array.from({ length: 4 }, () => randomUUID() + "@foundation.example.test");
  const password = "Foundation-test-password42!", newPassword = "New-unique-password43!";
  const messages: EmailMessage[] = [];
  const origin = "http://localhost:5173";
  const service = accountService(pool, { publicOrigin: origin, firstAdminEmail: emails[0], email: { async send(message) { messages.push(message); } } });
  const auth = postgresAuthStore(pool);
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined, base = "";
  const stop = async () => { if (server) { const current = server; server = undefined; await new Promise<void>(resolve => { current.close(() => resolve()); current.closeAllConnections(); }); } };
  const start = async (secure = false) => {
    server = createApp({ corsOrigins: [origin], checkDatabase: async () => {}, authStore: auth,
      cookies: { secure }, accountService: service, adminStore: postgresAdminStore(pool), doctorStore: postgresDoctorStore(pool),
      measurementStore: postgresMeasurementStore(pool), medicationStore: postgresMedicationStore(pool), habitStore: postgresHabitStore(pool), connectionStore: postgresConnectionStore(pool),
    }).listen(0, "127.0.0.1");
    await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string"); base = `http://127.0.0.1:${address.port}/api`;
  };
  let cookieHeader = "", csrf = "";
  const capture = (response: Response) => {
    const jar = new Map(cookieHeader.split("; ").filter(Boolean).map(item => item.split("=") as [string, string]));
    for (const value of response.headers.getSetCookie()) { const [key, val] = value.split(";")[0]!.split("="); jar.set(key!, val!); }
    cookieHeader = [...jar].map(([key, value]) => key + "=" + value).join("; ");
  };
  const browserRequest = async (path: string, body?: unknown, method = body ? "POST" : "GET", headers: Record<string, string> = {}) => {
    const response = await fetch(base + path, { method, headers: { Origin: origin, ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}), ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    capture(response); return response;
  };
  const tokenFrom = (message: EmailMessage) => { const match = message.text.match(/#token=([a-f0-9]{64})/); assert(match); return match[1]!; };
  try {
    await applyMigrations(pool);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.users WHERE role='admin'")).rowCount, 0, "No unrelated Admin can exist in the fresh test database.");
    await assert.rejects(accountService(pool, { publicOrigin: origin, firstAdminEmail: emails[0] }).inviteAdmin());
    await service.inviteAdmin(); assert.equal(messages.length, 1); assert.equal(messages[0]!.to, emails[0]);
    await service.inviteAdmin(); assert.equal(messages.length, 1, "Operator retries do not spam an active invitation.");
    const activation = tokenFrom(messages[0]!);
    await assert.rejects(service.redeem("password_reset", { token: activation, password }), "Activation tokens cannot reset a password.");
    const record = await pool.query("SELECT * FROM chroniccare.account_tokens WHERE token_hash=$1", [tokenHash(activation)]);
    assert.equal(record.rowCount, 1); assert(!JSON.stringify(record.rows).includes(activation));
    await start();
    assert.equal((await browserRequest("/auth/login", { email: emails[0], password })).status, 403, "Login CSRF is protected too.");
    const csrfResponse = await browserRequest("/auth/csrf"); csrf = (await csrfResponse.json() as { csrfToken: string }).csrfToken;
    assert.equal((await browserRequest("/auth/register", { name: "Squatter", email: emails[0], password })).status, 400, "The pre-authorized Admin address is reserved from public registration.");
    assert.equal((await browserRequest("/accounts/activate-admin", { token: activation, name: "Admin", password, email: emails[1] })).status, 400);
    assert.equal((await browserRequest("/accounts/activate-admin", { token: "0".repeat(64), name: "Admin", password })).status, 400);
    const results = await Promise.all([browserRequest("/accounts/activate-admin", { token: activation, name: "Admin", password }), browserRequest("/accounts/activate-admin", { token: activation, name: "Admin", password })]);
    assert.deepEqual(results.map(response => response.status).sort(), [204, 400]);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.users WHERE role='admin'")).rowCount, 1);
    await assert.rejects(service.inviteAdmin());
    const login = await browserRequest("/auth/login", { email: emails[0], password }); assert.equal(login.status, 200);
    const loginBody = await login.json() as { user: { id: string }; token?: string };
    assert.equal(loginBody.token, undefined, "Browser responses never expose a session credential.");
    assert(login.headers.getSetCookie().some(value => /cc_session=.*HttpOnly/i.test(value) && /SameSite=Lax/i.test(value)));
    assert.equal((await browserRequest("/auth/me")).status, 200);
    const oldCookie = cookieHeader;
    const doctorResponse = await browserRequest("/admin/doctors", { name: "Doctor", email: emails[1] }); assert.equal(doctorResponse.status, 201);
    assert.equal((await browserRequest("/accounts/activate-doctor", { token: tokenFrom(messages[1]!), password })).status, 204);
    assert.equal((await browserRequest("/admin/doctors", { name: "Injected", email: emails[2], password }, "POST", { Origin: "https://evil.example" })).status, 403);
    assert.equal((await browserRequest("/admin/doctors", { name: "Injected", email: emails[2], password }, "POST", { "X-CSRF-Token": "wrong" })).status, 403);
    assert.equal((await browserRequest("/admin/doctors", { name: "Injected", email: emails[2], password }, "POST", { "X-CSRF-Token": "é".repeat(64) })).status, 403);
    assert.equal((await browserRequest("/doctor/patients")).status, 403);
    await stop(); await start(); assert.equal((await browserRequest("/auth/me")).status, 200, "Cookie session persists across restart.");
    assert.equal((await browserRequest("/auth/login", { email: emails[1], password })).status, 200);
    assert.equal((await fetch(base + "/auth/me", { headers: { Origin: origin, Cookie: oldCookie } })).status, 401, "Account switch revokes old browser session.");
    assert.equal((await browserRequest("/admin/doctors")).status, 403);
    assert.deepEqual(await (await browserRequest("/doctor/patients")).json(), { patients: [] });
    assert.equal((await browserRequest("/auth/logout", undefined, "POST")).status, 204);
    assert.equal((await browserRequest("/auth/me")).status, 401);
    assert.equal((await browserRequest("/auth/register", { name: "Patient", email: emails[2], password, role: "admin" })).status, 400);
    assert.equal((await browserRequest("/auth/register", { name: "Patient", email: emails[2], password })).status, 201);
    assert.equal((await browserRequest("/auth/login", { email: emails[2], password })).status, 200);
    const patient = await auth.findAccount(emails[2]!); assert(patient);
    await pool.query("UPDATE chroniccare.sessions SET last_seen_at=now()-interval '31 minutes' WHERE user_id=$1", [patient.id]);
    assert.equal((await browserRequest("/auth/me")).status, 401);
    await browserRequest("/auth/login", { email: emails[2], password });
    await pool.query("UPDATE chroniccare.sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1", [patient.id]);
    assert.equal((await browserRequest("/auth/me")).status, 401);
    await browserRequest("/auth/login", { email: emails[2], password });
    await pool.query("UPDATE chroniccare.sessions SET created_at=now()-interval '9 hours',expires_at=now()+interval '1 hour',last_seen_at=now() WHERE user_id=$1", [patient.id]);
    assert.equal((await browserRequest("/auth/me")).status, 401, "Absolute expiry cannot be extended by activity or a future expires_at.");
    await browserRequest("/auth/login", { email: emails[2], password });
    const existingCookie = cookieHeader;
    const unknown = await browserRequest("/accounts/forgot-password", { email: emails[3] });
    const known = await browserRequest("/accounts/forgot-password", { email: emails[2] });
    assert.equal(unknown.status, 202); assert.equal(known.status, 202); assert.deepEqual(await unknown.json(), await known.json());
    assert.equal(messages.length, 3); const resetToken = tokenFrom(messages[2]!);
    await pool.query("UPDATE chroniccare.account_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [tokenHash(resetToken)]);
    assert.equal((await browserRequest("/accounts/reset-password", { token: resetToken, password: newPassword })).status, 400);
    await pool.query("UPDATE chroniccare.account_tokens SET created_at=now()-interval '3 minutes' WHERE token_hash=$1", [tokenHash(resetToken)]);
    await service.forgot({ email: emails[2] }); const usableReset = tokenFrom(messages[3]!);
    await service.redeem("password_reset", { token: usableReset, password: newPassword });
    await assert.rejects(service.redeem("password_reset", { token: usableReset, password: password }));
    assert.equal((await fetch(base + "/auth/me", { headers: { Origin: origin, Cookie: existingCookie } })).status, 401);
    await assert.rejects(auth.createSession(tokenHash("e".repeat(64)), patient.id, new Date(Date.now() + 60000), patient.password_hash), "A pre-reset credential cannot establish a session after reset.");
    assert.equal((await browserRequest("/auth/login", { email: emails[2], password })).status, 401);
    assert.equal((await browserRequest("/auth/login", { email: emails[2], password: newPassword })).status, 200);
    await stop(); await start(true); assert.equal((await fetch(base + "/auth/csrf")).status, 400, "Production-style secure mode rejects plain HTTP.");
    // Current hashes remain Argon2id; no other patient data is touched.
    assert.match((await auth.findAccount(emails[2]!))!.password_hash, /^\$argon2id\$/);
    assert(await hashPassword("Still-Argon2id-validation!") !== password);
  } finally {
    await stop();
    try { await pool.query("DELETE FROM chroniccare.account_tokens WHERE email=ANY($1::text[])", [emails]); await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]); }
    finally { await pool.end(); }
  }
});

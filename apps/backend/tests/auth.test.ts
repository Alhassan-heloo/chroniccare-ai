import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import type { Account, AuthStore, User } from "../src/auth/store.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { requireAuth, requireRoles } from "../src/auth/middleware.js";
import { credentials, hashPassword, tokenHash } from "../src/auth/security.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";
import { errorHandler } from "../src/middleware/errors.js";

function memoryStore() {
  const accounts: Account[] = [];
  const sessions = new Map<string, { userId: string; expiresAt: Date }>();
  const store: AuthStore = {
    async createUser(name, email, password_hash, role) {
      if (accounts.some((a) => a.email === email)) throw Object.assign(new Error(), { code: "23505" });
      const account = { id: randomUUID(), name, email, password_hash, role };
      accounts.push(account);
      return { id: account.id, name, email, role };
    },
    async findAccount(email) { return accounts.find((a) => a.email === email); },
    async createSession(hash, userId, expiresAt) { sessions.set(hash, { userId, expiresAt }); },
    async sessionUser(hash) {
      const session = sessions.get(hash);
      const a = session && session.expiresAt > new Date() && accounts.find((a) => a.id === session.userId);
      return a ? { id: a.id, name: a.name, email: a.email, role: a.role } : undefined;
    },
    async deleteSession(hash) { sessions.delete(hash); },
  };
  return { store, accounts, sessions };
}

async function exercise(t: TestContext, store: AuthStore) {
  const app = createApp({ corsOrigins: ["http://localhost:5173"], checkDatabase: async () => {}, authStore: store });
  // Test-only probes precede the terminal 404; no role data endpoints are shipped.
  const express = (await import("express")).default;
  const wrapper = express();
  for (const role of ["patient", "doctor", "admin"] as const) {
    wrapper.get(`/role/${role}`, requireAuth(store), requireRoles(role), (_req, res) => { res.json({ ok: true }); });
  }
  wrapper.use(app);
  wrapper.use(errorHandler());
  const server = wrapper.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }));
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const email = `${randomUUID()}@example.test`;
  const input = { name: "مستخدم Test", email, password: "Demo-Only-Strong-Password42!" };
  const request = (path: string, body?: unknown, token?: string) => fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal((await request("/api/auth/me")).status, 401);
  assert.equal((await request("/api/auth/logout", {})).status, 401);
  for (const role of ["admin", "doctor", "patient"]) {
    assert.equal((await request("/api/auth/register", { ...input, role })).status, 400);
  }
  assert.equal((await request("/api/auth/register", { ...input, password: "short" })).status, 400);
  assert.equal((await request("/api/auth/register", { ...input, email: "not-email" })).status, 400);
  const registered = await request("/api/auth/register", input);
  assert.equal(registered.status, 201);
  const registeredBody = await registered.json() as { user: User };
  assert.equal(registeredBody.user.role, "patient");
  assert.equal(JSON.stringify(registeredBody).includes("password"), false);
  const account = await store.findAccount(email);
  assert(account);
  assert.match(account.password_hash, /^\$argon2id\$/);
  assert.notEqual(account.password_hash, input.password);
  assert.equal((await request("/api/auth/register", { ...input, email: email.toUpperCase() })).status, 409);
  for (const login of [{ email, password: "Wrong-Password123!" }, { email: "unknown@example.test", password: input.password }]) {
    const response = await request("/api/auth/login", login);
    assert.equal(response.status, 401);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "INVALID_CREDENTIALS");
  }
  const login = await request("/api/auth/login", { email: email.toUpperCase(), password: input.password });
  assert.equal(login.status, 200);
  const session = await login.json() as { token: string; expiresAt: string };
  assert.match(session.token, /^[a-f0-9]{64}$/);
  assert(new Date(session.expiresAt) > new Date());
  assert.equal((await request("/api/auth/me", undefined, session.token)).status, 200);
  assert.equal(await store.sessionUser(session.token), undefined, "Raw tokens must never be stored as session keys");
  assert.equal((await fetch(base + "/api/auth/me", { method: "PATCH", headers: {
    Authorization: `Bearer ${session.token}`, "Content-Type": "application/json",
  }, body: JSON.stringify({ role: "admin" }) })).status, 404);
  for (const role of ["patient", "doctor", "admin"] as const) {
    assert.equal((await request(`/role/${role}`, undefined, session.token)).status, role === "patient" ? 200 : 403);
  }
  assert.equal((await request("/api/auth/me", undefined, "invalid")).status, 401);
  assert.equal((await request("/api/auth/me", undefined, "0".repeat(64))).status, 401);
  const expired = "e".repeat(64);
  await store.createSession(tokenHash(expired), account.id, new Date(Date.now() - 10000));
  assert.equal((await request("/api/auth/me", undefined, expired)).status, 401);
  assert.equal((await request("/api/auth/logout", {}, session.token)).status, 204);
  assert.equal((await request("/api/auth/me", undefined, session.token)).status, 401);
  assert.equal(await store.sessionUser(tokenHash(session.token)), undefined);
  for (const role of ["doctor", "admin"] as const) {
    const user = await store.createUser(role, `${randomUUID()}@example.test`, await hashPassword(input.password), role);
    const roleLogin = await request("/api/auth/login", { email: user.email, password: input.password });
    assert.equal(roleLogin.status, 200);
    const { token } = await roleLogin.json() as { token: string };
    for (const required of ["patient", "doctor", "admin"] as const) {
      assert.equal((await request(`/role/${required}`, undefined, token)).status, required === role ? 200 : 403);
    }
  }
  // Shared login/registration limiter includes failed validation attempts.
  for (let i = 0; i < 21; i++) {
    const response = await request("/api/auth/login", {});
    if (i === 20) assert.equal(response.status, 429);
  }
  const preflight = await fetch(base + "/api/auth/login", { method: "OPTIONS", headers: {
    Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization,content-type",
  } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /Authorization/);
}

test("authentication HTTP regression: credentials, sessions, validation, role isolation, escalation, rate limiting", async (t) => {
  const { store, sessions } = memoryStore();
  await exercise(t, store);
  for (const key of sessions.keys()) assert.match(key, /^[a-f0-9]{64}$/);
});

test("credential validation rejects unexpected fields and does not trim passwords", () => {
  assert.throws(() => credentials(null));
  assert.throws(() => credentials({ email: "a@b.test", password: "long-password123", isAdmin: true }));
  const password = "  long password  ";
  assert.equal(credentials({ email: " A@B.test ", password }).password, password);
  assert.equal(credentials({ email: " A@B.test ", password }).email, "a@b.test");
});

test("PostgreSQL authentication integration (isolated transaction, rolled back)", {
  skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL not configured; no PostgreSQL auth integration claimed.",
}, async (t) => {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  assert.match(new URL(databaseUrl).pathname, /_test$/);
  const pool = createDatabasePool(readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
  try {
    await applyMigrations(pool);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Unique conflicts would abort a PostgreSQL transaction: keep each operation in a savepoint.
      const baseStore = postgresAuthStore(client);
      const store: AuthStore = { ...baseStore, async createUser(...args: Parameters<AuthStore["createUser"]>) {
        await client.query("SAVEPOINT create_account");
        try { const user = await baseStore.createUser(...args); await client.query("RELEASE SAVEPOINT create_account"); return user; }
        catch (error) { await client.query("ROLLBACK TO SAVEPOINT create_account"); throw error; }
      } };
      await exercise(t, store);
    } finally { await client.query("ROLLBACK"); client.release(); }
  } finally { await pool.end(); }
});

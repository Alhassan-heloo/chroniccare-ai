import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { bootstrapService, initializeBootstrap } from "../src/auth/bootstrap.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";

test("PostgreSQL bootstrap: secret, validation, atomic creation, lockout, sessions and restart", {
  skip: !process.env.TEST_DATABASE_URL && "Dedicated PostgreSQL test database is required.",
}, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  assert(new URL(databaseUrl).pathname.endsWith("_test"));
  if (process.env.DATABASE_URL) assert.notEqual(new URL(databaseUrl).pathname, new URL(process.env.DATABASE_URL).pathname);
  const pool = createDatabasePool(readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
  const email = randomUUID() + "@bootstrap.example.test", otherEmail = randomUUID() + "@bootstrap.example.test";
  const secret = randomUUID() + randomUUID(), password = "Test-only-bootstrap42!";
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  try {
    await applyMigrations(pool);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.users WHERE role='admin'")).rowCount, 0,
      "Fresh test state required; never remove unrelated Admin accounts.");
    await assert.rejects(initializeBootstrap(pool, "production"));
    const service = bootstrapService(pool, secret);
    const auth = postgresAuthStore(pool);
    server = createApp({ corsOrigins: [], checkDatabase: async () => {}, authStore: auth, bootstrap: service }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address(); assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const post = (path: string, body: unknown, token?: string) => fetch(base + path, {
      method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body),
    });
    assert.deepEqual(await (await fetch(base + "/setup")).json(), { available: true });
    const input = { name: "First Admin", email, password, setupCode: secret };
    assert.equal((await post("/setup", { ...input, setupCode: "wrong" })).status, 403);
    assert.equal((await post("/setup", { ...input, role: "admin" })).status, 400);
    assert.equal((await post("/setup", { ...input, password: "short" })).status, 400);
    const results = await Promise.all([post("/setup", input), post("/setup", { ...input, email: otherEmail })]);
    assert.deepEqual(results.map(result => result.status).sort(), [201, 404]);
    const success = await results.find(result => result.status === 201)!.json() as { user: { email: string; role: string } };
    assert.equal(success.user.role, "admin"); assert.equal("password_hash" in success.user, false);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.users WHERE role='admin'")).rowCount, 1);
    assert.deepEqual(await (await fetch(base + "/setup")).json(), { available: false });
    assert.equal((await post("/setup", input)).status, 404);
    await post("/setup", input);
    assert.equal((await post("/setup", input)).status, 429);
    assert.equal(await initializeBootstrap(pool, "production"), undefined);
    const login = await post("/auth/login", { email: success.user.email, password });
    assert.equal(login.status, 200);
    const session = await login.json() as { token: string };
    await pool.query("UPDATE chroniccare.sessions SET expires_at=now()-interval '1 second' WHERE user_id=(SELECT id FROM chroniccare.users WHERE email=$1)", [success.user.email]);
    assert.equal((await fetch(base + "/auth/me", { headers: { Authorization: "Bearer " + session.token } })).status, 401);
    // A separate app instance cannot reactivate a consumed setup code.
    assert.equal(await bootstrapService(pool, secret).available(), false);
  } finally {
    if (server) await new Promise<void>(resolve => { server!.close(() => resolve()); server!.closeAllConnections(); });
    await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [[email, otherEmail]]);
    await pool.end();
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { postgresAuthStore, type User } from "../src/auth/store.js";
import { newToken, tokenHash } from "../src/auth/security.js";
import { postgresRegistrationStore, registrationContext } from "../src/notifications/registrations.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";

test("real PostgreSQL browser registrations: ownership, CSRF, validation, races, session revocation", {
  skip: !process.env.TEST_DATABASE_URL && "Separate test database required",
}, async () => {
  const url = process.env.TEST_DATABASE_URL!;
  assert(new URL(url).pathname.endsWith("_test"));
  assert.notEqual(new URL(url).pathname, new URL(process.env.DATABASE_URL!).pathname);
  const pool = createDatabasePool(readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: url }));
  const auth = postgresAuthStore(pool), store = postgresRegistrationStore(pool);
  const emails = Array.from({ length: 3 }, () => `${randomUUID()}@push-test.example.test`);
  const origin = "http://localhost:5173", csrf = "a".repeat(64), fid = "c" + "A".repeat(21);
  const server = createApp({ corsOrigins: [origin], authStore: auth, registrationStore: store, checkDatabase: async () => {} }).listen(0, "127.0.0.1");
  await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/notifications/browser-registration`;
  const req = (token: string, method = "GET", body?: unknown, validCsrf = true) => fetch(base, { method,
    headers: { Origin: origin, Cookie: `cc_session=${token}; cc_csrf=${csrf}`, "X-CSRF-Token": validCsrf ? csrf : "wrong", "Content-Type": "application/json" },
    ...(["PUT", "DELETE"].includes(method) ? { body: JSON.stringify(body && typeof body === "object" && !Array.isArray(body) ? { context: registrationContext(tokenHash(token)), ...body } : body === undefined ? { context: registrationContext(tokenHash(token)) } : body) } : {}) });
  try {
    await applyMigrations(pool);
    const users: User[] = [], tokens = [newToken(), newToken(), newToken()];
    for (const [i, role] of (["patient", "doctor", "admin"] as const).entries()) {
      const u = await auth.createUser("Push test", emails[i]!, "not-a-login-password", role); users.push(u);
      await auth.createSession(tokenHash(tokens[i]!), u.id, new Date(Date.now() + 3600000));
    }
    const [a, b, c] = tokens as [string, string, string];
    assert.equal((await req("")).status, 401);
    assert.deepEqual(await (await req(a)).json(), { registered: false, context: registrationContext(tokenHash(a)) });
    assert.equal((await req(a, "PUT", { fid }, false)).status, 403);
    for (const body of [{ fid: "bad" }, { fid: "g" + "A".repeat(21) }, { fid, userId: users[1]!.id }, [], null])
      assert.equal((await req(a, "PUT", body)).status, 400);
    const writes = await Promise.all([req(a, "PUT", { fid }), req(a, "PUT", { fid })]);
    assert(writes.every(r => r.status === 204));
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.browser_registrations WHERE fid=$1", [fid])).rowCount, 1);
    assert.equal((await req(b, "PUT", { fid })).status, 409);
    assert.equal((await req(c, "PUT", { fid })).status, 409);
    assert.deepEqual(await (await req(b)).json(), { registered: false, context: registrationContext(tokenHash(b)) });
    assert.equal((await req(b, "PUT", { fid, context: registrationContext(tokenHash(a)) })).status, 409);
    assert.equal((await req(b, "DELETE")).status, 204);
    assert.equal(await store.status(users[0]!.id, tokenHash(a)), true);
    assert.equal((await req(a, "DELETE", { userId: users[1]!.id })).status, 400);
    const rotated = "d" + "C".repeat(21);
    assert.equal((await req(a, "PUT", { fid: rotated })).status, 204);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.browser_registrations WHERE fid=$1", [fid])).rowCount, 0);
    assert.equal((await req(a, "DELETE")).status, 204);
    assert.equal((await req(a, "DELETE")).status, 204);
    assert.equal((await req(b, "PUT", { fid })).status, 204);
    await auth.deleteSession(tokenHash(b));
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.browser_registrations WHERE fid=$1", [fid])).rowCount, 0);
    assert.equal((await req(b, "PUT", { fid })).status, 401);
    assert.equal((await req(c, "PUT", { fid })).status, 204);
    // Persistence comes from PostgreSQL, not the JS store instance.
    assert.equal(await postgresRegistrationStore(pool).status(users[2]!.id, tokenHash(c)), true);
    await pool.query("UPDATE chroniccare.sessions SET last_seen_at=now()-interval '1 hour' WHERE token_hash=$1", [tokenHash(c)]);
    assert.equal((await req(c)).status, 401);
    await assert.rejects(() => store.put(users[2]!.id, tokenHash(c), fid));
    assert.equal((await req(a, "PUT", { fid })).status, 204, "An expired binding cannot block a fresh opt-in.");
  } finally {
    await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
    try { await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]); } finally { await pool.end(); }
  }
});

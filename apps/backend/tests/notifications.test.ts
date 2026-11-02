import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { hashPassword } from "../src/auth/security.js";
import { postgresConnectionStore } from "../src/connections/store.js";
import { postgresNotificationStore } from "../src/notifications/store.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";

test("real PostgreSQL notifications: transactional events, ownership, read status, RBAC and persistence", {
  skip: !process.env.TEST_DATABASE_URL && "Dedicated PostgreSQL test database is required.",
}, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  assert(new URL(databaseUrl).pathname.endsWith("_test"));
  if (process.env.DATABASE_URL) assert.notEqual(new URL(databaseUrl).pathname, new URL(process.env.DATABASE_URL).pathname);
  const pool = createDatabasePool(readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
  const auth = postgresAuthStore(pool), store = postgresNotificationStore(pool), connections = postgresConnectionStore(pool);
  const emails = Array.from({ length: 4 }, () => randomUUID() + "@notifications.example.test");
  const password = "Test-only-notification-password42!", origin = "http://localhost:5173", csrf = "a".repeat(64);
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined, base = "";
  const stop = async () => { if (server) { const current = server; server = undefined; await new Promise<void>(resolve => { current.close(() => resolve()); current.closeAllConnections(); }); } };
  const start = async () => {
    server = createApp({ corsOrigins: [origin], checkDatabase: async () => {}, authStore: auth, notificationStore: store, connectionStore: connections }).listen(0, "127.0.0.1");
    await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string"); base = `http://127.0.0.1:${address.port}/api`;
  };
  const request = (path: string, cookie = "", method = "GET", body?: unknown, extra: Record<string, string> = {}) => fetch(base + path, {
    method, headers: { Origin: origin, Cookie: `${cookie}${cookie ? "; " : ""}cc_csrf=${csrf}`, "X-CSRF-Token": csrf,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const login = async (email: string) => {
    const response = await request("/auth/login", "", "POST", { email, password }); assert.equal(response.status, 200);
    return response.headers.getSetCookie().find(value => value.startsWith("cc_session="))!.split(";")[0]!;
  };
  try {
    await applyMigrations(pool);
    const hash = await hashPassword(password);
    const d = await auth.createUser("Doctor", emails[0]!, hash, "doctor"), p = await auth.createUser("Patient One", emails[1]!, hash, "patient");
    const p2 = await auth.createUser("Patient Two", emails[2]!, hash, "patient"), a = await auth.createUser("Admin", emails[3]!, hash, "admin");
    await start(); const dc = await login(d.email), pc = await login(p.email), p2c = await login(p2.email), ac = await login(a.email);
    assert.equal((await request("/notifications")).status, 401);
    assert.deepEqual(await (await request("/notifications", pc)).json(), { notifications: [] });
    assert.deepEqual(await (await request("/notifications/unread-count", pc)).json(), { unreadCount: 0 });
    const code = await connections.generate(d.id);
    assert.equal(await store.unreadCount(d.id), 0, "Code generation/preview cannot create notifications or grant access.");
    assert.equal((await request("/connections/approve", pc, "POST", { code: code.code })).status, 204);
    assert.equal(await store.unreadCount(d.id), 1); assert.equal(await store.unreadCount(p.id), 1); assert.equal(await store.unreadCount(p2.id), 0); assert.equal(await store.unreadCount(a.id), 0);
    const notifications = await store.list(p.id); assert.equal(notifications[0]!.type, "connection_approved");
    const id = notifications[0]!.id;
    const visible = await (await request("/notifications", pc)).json() as { notifications: Record<string, unknown>[] };
    assert.deepEqual(Object.keys(visible.notifications[0]!).sort(), ["createdAt", "id", "readAt", "type"]);
    assert.equal((await request(`/notifications/${id}/read`, p2c, "PUT")).status, 404);
    assert.equal((await request(`/notifications/${id}/read`, dc, "PUT")).status, 404);
    assert.equal((await request(`/notifications/${id}/read`, ac, "PUT")).status, 404, "Admin has no ownership bypass.");
    assert.equal((await request(`/notifications/${id}/read`, pc, "PUT", {}, { "X-CSRF-Token": "wrong" })).status, 403);
    assert.equal((await request(`/notifications/${id}/read`, pc, "PUT", { userId: p2.id })).status, 400);
    assert.equal((await request("/notifications?userId=" + p2.id, pc)).status, 400);
    assert.equal((await request(`/notifications/${id}/read`, pc, "PUT")).status, 200);
    const readAt = (await store.list(p.id))[0]!.readAt; assert(readAt);
    assert.equal((await request(`/notifications/${id}/read`, pc, "PUT")).status, 200); assert.equal((await store.list(p.id))[0]!.readAt, readAt);
    assert.equal(await store.unreadCount(p.id), 0); assert.equal(await store.unreadCount(d.id), 1);
    const duplicate = await connections.generate(d.id); await connections.approve(p.id, duplicate.code);
    assert.equal((await store.list(p.id)).length, 1, "Repeated approval of an already-approved relationship creates no duplicate event.");
    const client = await pool.connect();
    try { await client.query("BEGIN"); await client.query("DELETE FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1 AND patient_id=$2", [d.id,p.id]); await client.query("ROLLBACK"); }
    finally { client.release(); }
    assert.equal((await store.list(p.id)).length, 1, "A rolled-back relationship action cannot leave an event.");
    await connections.revoke(p.id, d.id); await connections.revoke(p.id, d.id);
    assert.equal((await store.list(p.id)).length, 2); assert.equal((await store.list(d.id)).length, 2);
    assert.equal(await store.unreadCount(p.id), 1);
    await pool.query("INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id) VALUES($1,$2)", [d.id, p2.id]);
    assert.equal((await store.list(p2.id)).length, 0, "Legacy operator relationships do not fabricate approval events.");
    await stop(); await start();
    assert.equal((await request("/notifications/unread-count", pc)).status, 200); assert.equal(await store.unreadCount(p.id), 1);
    assert((await store.list(p.id)).some(item => item.readAt === readAt));
    assert.equal((await request("/notifications", dc)).status, 200); assert.equal((await request("/notifications", ac)).status, 200);
    await pool.query("DELETE FROM chroniccare.users WHERE id=$1", [p2.id]);
    assert.equal((await store.list(d.id)).length, 2, "Account cleanup cascades must not fabricate revoked events.");
  } finally {
    await stop(); try { await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]); }
    finally { await pool.end(); }
  }
});

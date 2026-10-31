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
import { postgresHabitStore } from "../src/habits/store.js";
import { habitDate, habitId, validateHabit, validateProgress, type Habit } from "../src/habits/validation.js";

test("habit validation enforces existing units, bounds, exact fields and calendar dates", () => {
  assert.deepEqual(validateHabit({ title: "  Morning walk  ", unit: "minutes", target: 30 }),
    { title: "Morning walk", unit: "minutes", target: 30 });
  assert.deepEqual(validateHabit({ title: "  Morning walk  ", unit: "minutes", target: 30, templateKey: "walking" }, true),
    { title: "Morning walk", unit: "minutes", target: 30, templateKey: "walking" });
  assert.throws(() => validateHabit({ title: "Morning walk", unit: "minutes", target: 30, templateKey: "walking" }));
  assert.throws(() => validateHabit({ title: "Morning walk", unit: "minutes", target: 30, templateKey: "diagnosis" }, true));
  assert.deepEqual(validateProgress({ date: "2024-02-29", value: 0 }), { date: "2024-02-29", value: 0 });
  assert.deepEqual(validateProgress({ date: "2026-10-31", value: 100000 }), { date: "2026-10-31", value: 100000 });
  for (const input of [null, [], {}, { title: "A", unit: "minutes", target: 1 },
    { title: "Valid", unit: "hours", target: 1 }, { title: "Valid", unit: "steps", target: 0 },
    { title: "Valid", unit: "steps", target: 1.5 }, { title: "Valid", unit: "steps", target: 100001 },
    { title: "Valid", unit: "steps", target: 1, patientId: randomUUID() }]) assert.throws(() => validateHabit(input));
  for (const input of [{ date: "2026-02-29", value: 0 }, { date: "2026-10-31", value: -1 },
    { date: "2026-10-31", value: 1.5 }, { date: "2026-10-31", value: 100001 },
    { date: "2026-10-31", value: 1, patientId: randomUUID() }]) assert.throws(() => validateProgress(input));
  assert.equal(habitDate("2024-02-29"), "2024-02-29");
  assert.throws(() => habitDate("2024-02-30"));
  assert.equal(habitId(randomUUID()).length, 36);
  assert.throws(() => habitId("' OR 1=1 --"));
});

test("real PostgreSQL habits: daily progress, unit rules, durable CRUD, authorization and isolation", {
  skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL is not configured; PostgreSQL habits not verified.",
}, async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  const target = new URL(databaseUrl);
  assert(target.pathname.endsWith("_test"), "A dedicated test database is required.");
  if (process.env.DATABASE_URL) {
    const application = new URL(process.env.DATABASE_URL);
    assert(target.host !== application.host || target.pathname !== application.pathname, "Test and application databases must be separate.");
  }
  const pool = createDatabasePool(readEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
  const auth = postgresAuthStore(pool), store = postgresHabitStore(pool);
  const emails = Array.from({ length: 4 }, () => randomUUID() + "@habits.example.test");
  const password = "Test-only-habit-Password42!";
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined, base = "";
  const stop = async () => {
    if (!server) return;
    const current = server; server = undefined;
    await new Promise<void>(resolve => { current.close(() => resolve()); current.closeAllConnections(); });
  };
  const start = async () => {
    server = createApp({ corsOrigins: ["http://localhost:5173"], authStore: auth, habitStore: store,
      checkDatabase: async () => { await pool.query("SELECT 1"); }, reportError: () => {} }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address(); assert(address && typeof address !== "string");
    base = "http://127.0.0.1:" + address.port;
  };
  const request = (path: string, method = "GET", body?: unknown, token?: string) => fetch(base + path, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const login = async (email: string) => {
    const response = await request("/api/auth/login", "POST", { email, password });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  const day = "2026-10-31", nextDay = "2026-11-01";
  const get = async (id: string, token: string, date = day) => {
    const response = await request("/api/habits/" + id + "?date=" + date, "GET", undefined, token);
    assert.equal(response.status, 200);
    return (await response.json() as { habit: Habit }).habit;
  };
  try {
    await applyMigrations(pool);
    assert.deepEqual(await applyMigrations(pool), []);
    await start();
    for (const email of emails.slice(0, 2)) {
      const response = await request("/api/auth/register", "POST", { name: "Habit patient", email, password });
      assert.equal(response.status, 201);
      assert.equal((await response.json() as { user: User }).user.role, "patient");
    }
    let tokenA = await login(emails[0]!);
    const tokenB = await login(emails[1]!);
    for (const [method, path, body] of [
      ["GET", "/api/habits?date=" + day, undefined],
      ["POST", "/api/habits?date=" + day, { title: "Walk", unit: "minutes", target: 30 }],
      ["PUT", "/api/habits/" + randomUUID() + "?date=" + day, { title: "Walk", unit: "minutes", target: 30 }],
      ["DELETE", "/api/habits/" + randomUUID(), undefined],
      ["PUT", "/api/habits/" + randomUUID() + "/progress", { date: day, value: 1 }],
    ] as const) assert.equal((await request(path, method, body)).status, 401);

    const create = await request("/api/habits?date=" + day, "POST",
      { title: "  Morning walk  ", unit: "minutes", target: 30 }, tokenA);
    assert.equal(create.status, 201);
    const created = (await create.json() as { habit: Habit }).habit;
    assert.deepEqual(created, { id: created.id, title: "Morning walk", unit: "minutes", target: 30, templateKey: null, progress: 0, recordedOn: day });
    assert.equal(create.headers.get("location"), "/api/habits/" + created.id);
    const account = await auth.findAccount(emails[0]!); assert(account);
    assert.equal((await pool.query("SELECT patient_id FROM chroniccare.habits WHERE id=$1", [created.id])).rows[0]?.patient_id, account.id);
    assert.deepEqual(await get(created.id, tokenA), created);

    const templateCreate = await request("/api/habits?date=" + day, "POST",
      { title: "Daily walking", unit: "minutes", target: 20, templateKey: "walking" }, tokenA);
    assert.equal(templateCreate.status, 201);
    const templated = (await templateCreate.json() as { habit: Habit }).habit;
    assert.equal(templated.templateKey, "walking");
    assert.equal(templated.progress, 0);
    const renamedTemplate = await request("/api/habits/" + templated.id + "?date=" + day, "PUT",
      { title: "My own walking name", unit: "minutes", target: 25 }, tokenA);
    assert.equal(renamedTemplate.status, 200);
    assert.equal((await renamedTemplate.json() as { habit: Habit }).habit.templateKey, "walking",
      "Patient-editable titles must not change stable template identity.");
    assert.equal((await request("/api/habits?date=" + day, "POST",
      { title: "Another name", unit: "minutes", target: 10, templateKey: "walking" }, tokenA)).status, 409);
    assert.equal((await request("/api/habits/" + templated.id + "?date=" + day, "PUT",
      { title: "Blocked identity change", unit: "minutes", target: 10, templateKey: "water" }, tokenA)).status, 400);
    const otherPatientTemplate = await request("/api/habits?date=" + day, "POST",
      { title: "Daily walking", unit: "minutes", target: 15, templateKey: "walking" }, tokenB);
    assert.equal(otherPatientTemplate.status, 201, "Template identity is unique per patient, not globally.");

    assert.equal((await request("/api/habits/" + created.id + "/progress", "PUT", { date: day, value: 45 }, tokenA)).status, 204,
      "Progress above the target remains valid.");
    assert.equal((await request("/api/habits/" + created.id + "/progress", "PUT", { date: day, value: 50 }, tokenA)).status, 204);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.habit_progress WHERE habit_id=$1 AND recorded_on=$2", [created.id, day])).rowCount, 1);
    assert.equal((await get(created.id, tokenA)).progress, 50);
    assert.equal((await get(created.id, tokenA, nextDay)).progress, 0);

    const targetUpdate = await request("/api/habits/" + created.id + "?date=" + day, "PUT",
      { title: "Morning walk", unit: "minutes", target: 60 }, tokenA);
    assert.equal(targetUpdate.status, 200);
    assert.equal((await targetUpdate.json() as { habit: Habit }).habit.progress, 50, "Changing the target preserves progress.");
    const unitUpdate = await request("/api/habits/" + created.id + "?date=" + day, "PUT",
      { title: "Morning water", unit: "cups", target: 8 }, tokenA);
    assert.equal(unitUpdate.status, 200);
    assert.equal((await unitUpdate.json() as { habit: Habit }).habit.progress, 0, "Changing the unit resets progress.");
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.habit_progress WHERE habit_id=$1", [created.id])).rowCount, 0,
      "Unit-dependent historical values are invalidated.");
    assert.equal((await request("/api/habits/" + created.id + "/progress", "PUT", { date: day, value: 0 }, tokenA)).status, 204);
    assert.equal((await get(created.id, tokenA)).progress, 0);

    for (const bad of [{ title: "A", unit: "cups", target: 1 }, { title: "Valid", unit: "hours", target: 1 },
      { title: "Valid", unit: "cups", target: 0 }, { title: "Valid", unit: "cups", target: 1, patientId: account.id }]) {
      assert.equal((await request("/api/habits?date=" + day, "POST", bad, tokenA)).status, 400);
    }
    assert.equal((await request("/api/habits", "GET", undefined, tokenA)).status, 400);
    for (const bad of [{ date: "2026-02-30", value: 1 }, { date: day, value: -1 }, { date: day, value: 1.5 },
      { date: day, value: 100001 }, { date: day, value: 1, patientId: account.id }]) {
      assert.equal((await request("/api/habits/" + created.id + "/progress", "PUT", bad, tokenA)).status, 400);
    }

    for (const method of ["GET", "PUT", "DELETE"] as const) {
      const path: string = "/api/habits/" + created.id + (method === "DELETE" ? "" : "?date=" + day);
      assert.equal((await request(path, method,
        method === "PUT" ? { title: "Stolen", unit: "times", target: 1 } : undefined, tokenB)).status, 404);
    }
    assert.equal((await request("/api/habits/" + created.id + "/progress", "PUT", { date: day, value: 2 }, tokenB)).status, 404);
    const patientBHabits = (await (await request("/api/habits?date=" + day, "GET", undefined, tokenB)).json() as { habits: Habit[] }).habits;
    assert.equal(patientBHabits.length, 1);
    assert.equal(patientBHabits[0]?.templateKey, "walking");
    assert(!patientBHabits.some(habit => habit.id === created.id));

    await stop();
    await start();
    tokenA = await login(emails[0]!);
    assert.equal((await get(created.id, tokenA)).title, "Morning water");
    for (const [index, role] of [[2, "doctor"], [3, "admin"]] as const) {
      await auth.createUser(role, emails[index]!, await hashPassword(password), role);
      const token = await login(emails[index]!);
      for (const method of ["GET", "POST", "PUT", "DELETE"]) {
        const path: string = method === "PUT" || method === "DELETE" ? "/api/habits/" + created.id + (method === "PUT" ? "?date=" + day : "") : "/api/habits?date=" + day;
        assert.equal((await request(path, method,
          ["POST", "PUT"].includes(method) ? { title: "Valid", unit: "steps", target: 1 } : undefined, token)).status, 403);
      }
    }
    await assert.rejects(() => pool.query(
      "INSERT INTO chroniccare.habits(id,patient_id,title,unit,target) VALUES($1,$2,'A','steps',1)", [randomUUID(), account.id]));
    await assert.rejects(() => pool.query(
      "INSERT INTO chroniccare.habits(id,patient_id,title,unit,target,template_key) VALUES($1,$2,'Valid','steps',1,'unsupported')", [randomUUID(), account.id]));
    assert.equal((await request("/api/habits/" + created.id, "DELETE", undefined, tokenA)).status, 204);
    assert.equal((await request("/api/habits/" + created.id + "?date=" + day, "GET", undefined, tokenA)).status, 404);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.habit_progress WHERE habit_id=$1", [created.id])).rowCount, 0);
  } finally {
    await stop();
    try {
      await pool.query("DELETE FROM chroniccare.habits WHERE patient_id IN(SELECT id FROM chroniccare.users WHERE email=ANY($1::text[]))", [emails]);
      await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]);
    } finally {
      await pool.end();
    }
  }
});

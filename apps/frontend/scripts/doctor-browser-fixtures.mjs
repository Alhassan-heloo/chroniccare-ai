import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const backend = resolve(root, "../backend");
const load = file => import(pathToFileURL(resolve(backend, "dist", file)).href);
const databaseName = url => decodeURIComponent(url.pathname.slice(1));

export async function doctorBrowserFixtures({ frontendPort, backendPort, emails, password }) {
  const env = parseEnv(await readFile(resolve(backend, ".env"), "utf8"));
  const databaseUrl = process.env.TEST_DATABASE_URL || env.TEST_DATABASE_URL;
  assert(databaseUrl, "A dedicated TEST_DATABASE_URL is required.");
  const target = new URL(databaseUrl);
  const name = databaseName(target);
  const developmentUrls = [env.DATABASE_URL, process.env.DATABASE_URL].filter(Boolean);
  assert(developmentUrls.length && developmentUrls.every(url => databaseName(new URL(url)) !== name),
    "The test database name must differ from every configured application database name.");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && name.endsWith("_test") && !target.search,
    "Use a loopback PostgreSQL database ending in _test, without connection overrides.");

  const { createApp } = await load("app.js");
  const { readEnvironment } = await load("config/env.js");
  const { createDatabasePool } = await load("db/pool.js");
  const { applyMigrations } = await load("db/migrations.js");
  const { accountService } = await load("auth/accounts.js");
  const { hashPassword } = await load("auth/security.js");
  const pool = createDatabasePool(readEnvironment({ NODE_ENV: "test", DATABASE_URL: databaseUrl }));
  const base = `http://127.0.0.1:${frontendPort}`;
  const api = `http://127.0.0.1:${backendPort}/api`;
  const mail = new Map();
  const options = {
    corsOrigins: [base],
    checkDatabase: async () => { await pool.query("SELECT 1"); },
    accountService: accountService(pool, {
      publicOrigin: base,
      email: { async send(message) { mail.set(message.to, message.text); } },
    }),
  };
  for (const [key, path, factory] of [
    ["authStore", "auth/store.js", "postgresAuthStore"],
    ["adminStore", "admin/store.js", "postgresAdminStore"],
    ["doctorStore", "doctor/store.js", "postgresDoctorStore"],
    ["connectionStore", "connections/store.js", "postgresConnectionStore"],
    ["notificationStore", "notifications/store.js", "postgresNotificationStore"],
    ["registrationStore", "notifications/registrations.js", "postgresRegistrationStore"],
    ["measurementStore", "measurements/store.js", "postgresMeasurementStore"],
    ["medicationStore", "medications/store.js", "postgresMedicationStore"],
    ["habitStore", "habits/store.js", "postgresHabitStore"],
  ]) options[key] = (await load(path))[factory](pool);

  let server, vite, fixturesMayExist = false;
  async function startBackend() {
    const instance = createApp(options).listen(backendPort, "127.0.0.1");
    await once(instance, "listening");
    server = instance;
  }
  async function stopBackend() {
    if (!server) return;
    const instance = server;
    server = undefined;
    await new Promise(resolveClose => {
      instance.close(resolveClose);
      instance.closeAllConnections();
    });
  }
  async function start(adminEmail) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      const { rows: [actual] } = await client.query(`SELECT current_database() AS name,
        to_regclass('chroniccare.users') IS NOT NULL AS has_users,
        EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) AS in_use`);
      assert(actual.name === name && !actual.in_use, "The test database must be isolated and unused.");
      if (actual.has_users) {
        const existing = await client.query("SELECT 1 FROM chroniccare.users LIMIT 1");
        assert.equal(existing.rowCount, 0, "Use an empty test database. Existing accounts are preserved.");
      }
    } finally {
      try { await client.query("ROLLBACK"); } finally { client.release(); }
    }
    await startBackend();
    process.env.VITE_API_URL = api;
    for (const key of ["API_KEY", "PROJECT_ID", "APP_ID", "MESSAGING_SENDER_ID", "VAPID_KEY"]) {
      process.env[`VITE_FIREBASE_${key}`] = "";
    }
    vite = await createServer({ root, cacheDir: resolve(root, "node_modules/.vite-doctor-browser", String(frontendPort)), logLevel: "error",
      server: { host: "127.0.0.1", port: frontendPort, strictPort: true } });
    await vite.listen();
    await applyMigrations(pool);
    fixturesMayExist = true;
    await options.authStore.createUser("Doctor integration admin", adminEmail, await hashPassword(password), "admin");
    return login(adminEmail, "admin");
  }
  function request(path, { token, body, method = body ? "POST" : "GET" } = {}) {
    return fetch(api + path, {
      method,
      headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function login(email, role) {
    const response = await request("/auth/login", { body: { email, password } });
    assert.equal(response.status, 200, "Fixture login must succeed.");
    const result = await response.json();
    assert.equal(result.user.role, role);
    assert(result.token, "Fixture login must return a server session.");
    return result.token;
  }
  async function inviteDoctor(adminToken, email, name) {
    const invitation = await request("/admin/doctors", { token: adminToken, body: { name, email } });
    assert.equal(invitation.status, 201, "The name-and-email invitation must be accepted.");
    const link = mail.get(email)?.split("\n").find(line => line.startsWith(base + "/activate-doctor#"));
    assert(link, "The test email transport must receive a Doctor activation link.");
    const token = new URLSearchParams(new URL(link).hash.slice(1)).get("token");
    assert(token && /^[a-f0-9]{64}$/.test(token), "The invitation must contain an activation token.");
    const activation = await request("/accounts/activate-doctor", { body: { token, password } });
    assert.equal(activation.status, 204, "Doctor activation must set the fixture password.");
    mail.delete(email);
  }
  async function close() {
    try {
      await stopBackend();
      if (vite) await vite.close();
      if (fixturesMayExist) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const { rows } = await client.query("SELECT id FROM chroniccare.users WHERE role='patient' AND email=ANY($1::text[])", [emails]);
          const patientIds = rows.map(row => row.id);
          for (const table of ["measurements", "medications", "habits"]) {
            await client.query(`DELETE FROM chroniccare.${table} WHERE patient_id=ANY($1::uuid[])`, [patientIds]);
          }
          await client.query("DELETE FROM chroniccare.account_tokens WHERE email=ANY($1::text[])", [emails]);
          await client.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally { client.release(); }
      }
    } finally { await pool.end(); }
  }
  return { api, base, pool, start, startBackend, stopBackend, request, login, inviteDoctor, close };
}

export async function changePreferences(page, { language, theme }) {
  await page.getByRole("button", { name: /^(Language & appearance|اللغة والمظهر)$/ }).click();
  const dialog = page.getByRole("dialog");
  if (language && await page.locator("html").getAttribute("lang") !== language) {
    await dialog.getByRole("button", { name: /^(Switch to Arabic|Switch to English)$/ }).click();
    await page.waitForFunction(lang => document.documentElement.lang === lang &&
      document.documentElement.dir === (lang === "ar" ? "rtl" : "ltr"), language);
  }
  if (theme) await dialog.getByRole("combobox", { name: /^(Theme mode|نمط المظهر)$/ }).selectOption(theme);
  if (theme && theme !== "system") {
    await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
  }
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
}

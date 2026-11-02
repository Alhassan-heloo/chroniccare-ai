// Real Edge + Express + separate PostgreSQL test database. Only own test users are removed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)), backend = resolve(root, "../backend");
const require = createRequire(import.meta.url), backendRequire = createRequire(resolve(backend, "package.json"));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright"), { Client } = backendRequire("pg");
const env = parseEnv(await readFile(resolve(backend, ".env"), "utf8"));
const databaseUrl = process.env.TEST_DATABASE_URL || env.TEST_DATABASE_URL;
assert(databaseUrl && new URL(databaseUrl).pathname.endsWith("_test"));
assert.notEqual(new URL(databaseUrl).pathname, new URL(env.DATABASE_URL).pathname);
const base = "http://127.0.0.1:5196", api = "http://127.0.0.1:3316/api";
const output = resolve(root, "artifacts/patient-connections"); await mkdir(output, { recursive: true });
const emails = Array.from({ length: 5 }, () => randomUUID() + "@connection-browser.example.test");
const password = randomBytes(24).toString("hex"), secret = randomBytes(32).toString("hex");
const db = new Client({ connectionString: databaseUrl });
const services = [], report = { checks: [], errors: [], screenshots: [] };
let browser, stage = "startup";
async function start(args, cwd, environment, port) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...environment }, stdio: "ignore" });
  const service = { child, done: once(child, "exit") }; services.push(service);
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null) throw new Error("Test service failed to start.");
    try { await fetch(`http://127.0.0.1:${port}`); return service; } catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  throw new Error("Test service start timed out.");
}
async function stop(service) { if (service.child.exitCode === null) { service.child.kill(); await service.done; } }
async function request(path, token, body, method = body ? "POST" : "GET") {
  return fetch(api + path + (path.startsWith("/doctor/patients/") ? "?date=2026-11-01" : ""), { method, headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function loginApi(email) { const response = await request("/auth/login", null, { email, password }); assert.equal(response.status, 200); return (await response.json()).token; }
async function login(page, email, role) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('.auth-card button[type="submit"]').click();
  await page.waitForURL(url => url.pathname.startsWith("/" + role + "/"));
}
async function openPage(email, role, path) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => { localStorage.setItem("cc-language", "en"); localStorage.setItem("cc-theme", "dark"); });
  const page = await context.newPage(); page.setDefaultTimeout(20_000);
  page.on("pageerror", error => report.errors.push(error.message));
  await page.goto(base + path); await page.waitForURL("**/login?returnTo=*"); await login(page, email, role); return page;
}
async function generate(page) {
  await page.getByRole("button", { name: "Generate connection code", exact: true }).click();
  const input = page.locator('input[readonly]'); await input.waitFor(); return input.inputValue();
}
async function approve(page, code, name) {
  await page.locator('input[autocomplete="off"]').fill(code);
  await page.getByRole("button", { name: "Review Doctor", exact: true }).click();
  await page.getByRole("heading", { name, exact: true }).waitFor();
  await page.getByRole("button", { name: "Approve connection", exact: true }).click();
  await page.getByText("Connection approved.", { exact: true }).waitFor();
}
try {
  await db.connect();
  // Versioned migrations are applied only to TEST_DATABASE_URL.
  const migration = spawn(process.execPath, ["dist/db/migrate.js"], { cwd: backend, env: { ...process.env, ...env, NODE_ENV: "test", DATABASE_URL: databaseUrl }, stdio: "ignore" });
  assert.equal((await once(migration, "exit"))[0], 0);
  assert.equal((await db.query("SELECT 1 FROM chroniccare.users WHERE role='admin'")).rowCount, 0, "No unrelated Admin may exist in this dedicated test database.");
  let service = await start(["dist/server.js"], backend, { ...env, NODE_ENV: "test", DATABASE_URL: databaseUrl, BOOTSTRAP_SECRET: secret, HOST: "127.0.0.1", PORT: "3316", CORS_ORIGINS: base }, 3316);
  assert.equal((await request("/setup", null, { setupCode: secret, name: "Connection Admin", email: emails[0], password })).status, 201);
  const adminToken = await loginApi(emails[0]);
  for (let n = 1; n <= 2; n++) assert.equal((await request("/admin/doctors", adminToken, { name: "Doctor " + n, email: emails[n], password })).status, 201);
  for (let n = 3; n <= 4; n++) assert.equal((await request("/auth/register", null, { name: "Patient " + n, email: emails[n], password })).status, 201);
  await start(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5196", "--strictPort"], root, { VITE_API_URL: api }, 5196);
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const doctor = await openPage(emails[1], "doctor", "/doctor/connect");
  const doctor2 = await openPage(emails[2], "doctor", "/doctor/connect");
  const patient = await openPage(emails[3], "patient", "/patient/doctors");
  const patient2 = await openPage(emails[4], "patient", "/patient/doctors");
  const dt1 = await loginApi(emails[1]), dt2 = await loginApi(emails[2]);
  const accounts = (await db.query("SELECT id,email FROM chroniccare.users WHERE email=ANY($1::text[])", [emails])).rows;
  const p1 = accounts.find(user => user.email === emails[3]), p2 = accounts.find(user => user.email === emails[4]);
  stage = "explicit-consent";
  const code = await generate(doctor);
  assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 404);
  await patient.locator('input[autocomplete="off"]').fill(code);
  await patient.getByRole("button", { name: "Review Doctor", exact: true }).click();
  await patient.getByRole("heading", { name: "Doctor 1", exact: true }).waitFor();
  assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 404);
  await patient.getByRole("button", { name: "Approve connection", exact: true }).click();
  await patient.getByText("Connection approved.", { exact: true }).waitFor();
  assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 200);
  assert.equal((await request(`/doctor/patients/${p1.id}`, dt2)).status, 404);
  assert.equal((await request(`/doctor/patients/${p2.id}`, dt1)).status, 404);
  await patient2.locator('input[autocomplete="off"]').fill(code);
  await patient2.getByRole("button", { name: "Review Doctor", exact: true }).click();
  await patient2.getByText("The code is invalid, expired, or already used.", { exact: true }).waitFor();
  stage = "expiry-and-second-pair";
  const expired = await generate(doctor2);
  await db.query("UPDATE chroniccare.doctor_connection_codes SET created_at=now()-interval '20 minutes',expires_at=now()-interval '10 minutes' WHERE code_hash=$1", [createHash("sha256").update(expired).digest("hex")]);
  await patient2.locator('input[autocomplete="off"]').fill(expired);
  await patient2.getByRole("button", { name: "Review Doctor", exact: true }).click();
  await patient2.getByText("The code is invalid, expired, or already used.", { exact: true }).waitFor();
  await doctor2.reload(); await login(doctor2, emails[2], "doctor");
  await approve(patient2, await generate(doctor2), "Doctor 2");
  assert.equal((await request(`/doctor/patients/${p2.id}`, dt2)).status, 200);
  stage = "responsive-and-keyboard";
  await patient.locator('input[autocomplete="off"]').focus(); await patient.keyboard.press("Tab");
  assert(await patient.getByRole("button", { name: "Review Doctor", exact: true }).evaluate(element => element === document.activeElement));
  for (const width of [1440, 768, 390, 320]) {
    await patient.setViewportSize({ width, height: 900 });
    assert(await patient.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await patient.locator(".language-toggle").click();
  await patient.waitForFunction(() => document.documentElement.lang === "ar" && document.documentElement.dir === "rtl");
  await patient.locator(".theme-select").selectOption("light");
  await patient.emulateMedia({ reducedMotion: "reduce" });
  const screenshot = resolve(output, "my-doctors-320-ar-light.png"); await patient.screenshot({ path: screenshot, fullPage: true }); report.screenshots.push(screenshot);
  await patient.locator(".language-toggle").click(); await patient.locator(".theme-select").selectOption("dark");
  stage = "refresh-restart-revoke";
  await patient.reload(); await login(patient, emails[3], "patient");
  await patient.getByRole("heading", { name: "Doctor 1", exact: true }).waitFor();
  await stop(service); services.splice(services.indexOf(service), 1);
  service = await start(["dist/server.js"], backend, { ...env, NODE_ENV: "test", DATABASE_URL: databaseUrl, HOST: "127.0.0.1", PORT: "3316", CORS_ORIGINS: base }, 3316);
  assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 200);
  await patient.getByRole("button", { name: "Revoke access", exact: true }).click();
  await patient.getByText("Access revoked.", { exact: true }).waitFor();
  await patient.getByText("No doctors currently have access to your records.", { exact: true }).waitFor();
  assert.equal((await request(`/doctor/patients/${p1.id}`, dt1)).status, 404);
  await doctor.goto(base + `/doctor/patients/${p1.id}`); await login(doctor, emails[1], "doctor");
  await doctor.locator(".ui-feedback-error").waitFor();
  await patient.locator(".session-bar button").click(); await patient.waitForURL("**/login?returnTo=*");
  await login(patient, emails[4], "patient");
  await patient.getByRole("heading", { name: "Doctor 2", exact: true }).waitFor();
  assert.equal(await patient.getByRole("heading", { name: "Doctor 1", exact: true }).count(), 0);
  report.checks = ["Admin creates two Doctors", "two Patient accounts", "Doctor code generation", "preview grants no access", "explicit Patient approval", "reuse rejected", "expired code rejected", "second independent pair", "cross-Doctor and cross-Patient isolation", "keyboard navigation", "1440/768/390/320 layouts", "Arabic/English RTL/LTR and light/dark", "reduced motion", "refresh and shared-login return", "PostgreSQL persistence after restart", "revocation and direct record URL denial", "logout/login account isolation"];
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({ status: "PASS", checks: report.checks.length, output }));
} catch (error) {
  report.errors.push({ stage, message: String(error.message).replaceAll(password, "[password]").replaceAll(secret, "[secret]") });
  console.error("Connection browser test failed at " + stage + ": " + error.name); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const service of services.reverse()) await stop(service);
  try { await db.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]); } finally { await db.end(); }
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}

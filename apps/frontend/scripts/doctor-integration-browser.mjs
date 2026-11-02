// Real Express + dedicated PostgreSQL test database. No application database writes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const backend = resolve(root, "../backend");
const require = createRequire(import.meta.url);
const backendRequire = createRequire(resolve(backend, "package.json"));
const chromium = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright").chromium;
const { Client } = backendRequire("pg");
const env = parseEnv(await readFile(resolve(backend, ".env"), "utf8"));
const databaseUrl = process.env.TEST_DATABASE_URL || env.TEST_DATABASE_URL;
assert(databaseUrl && new URL(databaseUrl).pathname.endsWith("_test"), "A dedicated test database is required");
const target = new URL(databaseUrl), application = new URL(process.env.DATABASE_URL || env.DATABASE_URL);
assert(target.host !== application.host || target.pathname !== application.pathname, "Application and test databases must differ");

const base = "http://127.0.0.1:5194", api = "http://127.0.0.1:3314/api";
const output = resolve(root, "artifacts/doctor-foundation");
await mkdir(output, { recursive: true });
const report = { checks: [], screenshots: [], errors: [], expectedFailures: [], serviceLogs: [] };
const password = randomBytes(24).toString("hex");
const emails = {
  doctorA: randomUUID() + "@doctor-browser.example.test",
  doctorB: randomUUID() + "@doctor-browser.example.test",
  patientA: randomUUID() + "@doctor-browser.example.test",
  patientB: randomUUID() + "@doctor-browser.example.test",
};
const db = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 });
const services = [];
let browser, page, stage = "setup", expectedFailure = false;

async function start(args, cwd, environment, port) {
  const probe = createServer();
  await new Promise((yes, no) => { probe.once("error", no); probe.listen(port, "127.0.0.1", yes); });
  await new Promise(yes => probe.close(yes));
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...environment }, stdio: ["ignore", "pipe", "pipe"] });
  services.push({ child, stopped: once(child, "exit") });
  for (const [stream, label] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) {
    stream.on("data", chunk => { if (report.serviceLogs.length < 40) report.serviceLogs.push({ port, label, message: String(chunk).replace(/postgres(?:ql)?:\/\/\S+/gi, "[database-url]").slice(0, 500) }); });
  }
  for (let attempt = 0; attempt < 120; attempt++) {
    try { await fetch("http://127.0.0.1:" + port); return; } catch { await new Promise(yes => setTimeout(yes, 250)); }
  }
  throw new Error("Test service did not start");
}

async function run(args, environment = {}) {
  const child = spawn(process.execPath, args, { cwd: backend, env: { ...process.env, ...env, ...environment }, stdio: ["ignore", "pipe", "pipe"] });
  const stderr = [];
  child.stderr.on("data", chunk => stderr.push(String(chunk).replace(/postgres(?:ql)?:\/\/\S+/gi, "[database-url]")));
  const code = (await once(child, "exit"))[0];
  assert.equal(code, 0, stderr.join("").slice(0, 800));
}

async function apiRequest(path, { token, method = "GET", body } = {}) {
  return fetch(api + path, {
    method,
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function loginApi(email) {
  const response = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
  assert.equal(response.status, 200);
  return (await response.json()).token;
}

async function loginPage(page, email) {
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[autocomplete=current-password]").fill(password);
  const loginResponse = page.waitForResponse(response => response.url() === api + "/auth/login");
  await page.locator(".auth-card button[type=submit]").click();
  assert.equal((await loginResponse).status(), 200, "Browser login must be acknowledged by Express");
  await page.waitForURL(url => url.origin === base && url.pathname.startsWith("/doctor/"));
}

async function navigate(page, path) {
  await page.evaluate(async path => { const module = await import("/src/app/router.tsx"); await module.router.navigate(path); }, path);
  await page.waitForURL(base + path);
  await page.locator("h1").waitFor();
}

async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal overflow");
  const path = resolve(output, name + ".png");
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
}

try {
  await db.connect();
  await run(["dist/db/migrate.js"], { NODE_ENV: "test", DATABASE_URL: databaseUrl });
  for (const [key, name] of [["doctorA", "Doctor One"], ["doctorB", "Doctor Two"]]) {
    await run(["dist/auth/provision.js", "doctor", emails[key], name], { NODE_ENV: "test", DATABASE_URL: databaseUrl, AUTH_PROVISION_PASSWORD: password });
  }
  await start(["dist/server.js"], backend, { ...env, NODE_ENV: "test", DATABASE_URL: databaseUrl, HOST: "127.0.0.1", PORT: "3314", CORS_ORIGINS: base }, 3314);
  assert.equal((await fetch(api + "/health/ready")).status, 200);

  for (const [key, name] of [["patientA", "Patient Visible"], ["patientB", "Patient Hidden"]]) {
    const response = await apiRequest("/auth/register", { method: "POST", body: { name, email: emails[key], password } });
    assert.equal(response.status, 201);
  }
  const [doctorAToken, doctorBToken, patientAToken, patientBToken] = await Promise.all([
    loginApi(emails.doctorA), loginApi(emails.doctorB), loginApi(emails.patientA), loginApi(emails.patientB),
  ]);
  const users = await db.query("SELECT id,email FROM chroniccare.users WHERE email=ANY($1::text[])", [Object.values(emails)]);
  const id = key => users.rows.find(row => row.email === emails[key]).id;
  await db.query("INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id) VALUES($1,$2)", [id("doctorA"), id("patientA")]);

  const local = new Date();
  const today = local.getFullYear() + "-" + String(local.getMonth() + 1).padStart(2, "0") + "-" + String(local.getDate()).padStart(2, "0");
  let response = await apiRequest("/measurements", { token: patientAToken, method: "POST", body: { kind: "bloodPressure", systolic: 128, diastolic: 82, recordedAt: new Date().toISOString() } });
  assert.equal(response.status, 201);
  response = await apiRequest("/medications?date=" + today, { token: patientAToken, method: "POST", body: { name: "Visible medicine", dosage: "10 mg", notes: "", doses: [{ time: "08:00" }] } });
  assert.equal(response.status, 201); const medication = (await response.json()).medication;
  assert.equal((await apiRequest(`/medications/${medication.id}/doses/08%3A00`, { token: patientAToken, method: "PUT", body: { date: today, taken: true } })).status, 204);
  response = await apiRequest("/habits?date=" + today, { token: patientAToken, method: "POST", body: { title: "Visible walking", unit: "minutes", target: 20 } });
  assert.equal(response.status, 201); const habit = (await response.json()).habit;
  assert.equal((await apiRequest(`/habits/${habit.id}/progress`, { token: patientAToken, method: "PUT", body: { date: today, value: 10 } })).status, 204);
  assert.equal((await apiRequest("/measurements", { token: patientBToken, method: "POST", body: { kind: "glucose", value: 91, recordedAt: new Date().toISOString() } })).status, 201);

  stage = "api-security";
  assert.equal((await apiRequest("/doctor/patients")).status, 401);
  assert.equal((await apiRequest("/doctor/patients", { token: patientAToken })).status, 403);
  const listed = await (await apiRequest("/doctor/patients", { token: doctorAToken })).json();
  assert.deepEqual(listed.patients, [{ id: id("patientA"), name: "Patient Visible" }]);
  assert.equal(JSON.stringify(listed).includes(emails.patientA), false);
  assert.deepEqual((await (await apiRequest("/doctor/patients", { token: doctorBToken })).json()).patients, []);
  assert.equal((await apiRequest(`/doctor/patients/${id("patientB")}?date=${today}`, { token: doctorAToken })).status, 404);
  assert.equal((await apiRequest(`/doctor/patients/${id("patientA")}?date=${today}`, { token: doctorBToken })).status, 404);
  assert.equal((await apiRequest("/doctor/patients", { token: doctorAToken, method: "POST", body: {} })).status, 404);

  await start(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5194", "--strictPort"], root, { VITE_API_URL: api }, 5194);
  browser = await chromium.launch({ channel: "msedge", headless: true });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: "no-preference" });
  await context.addInitScript(() => { localStorage.setItem("cc-language", "en"); localStorage.setItem("cc-theme", "dark"); localStorage.setItem("cc-public-motion", "paused"); });
  page = await context.newPage(); page.setDefaultTimeout(90_000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) {
      if (expectedFailure && /Failed to load resource.*503/.test(message.text())) report.expectedFailures.push({ stage, message: message.text() });
      else report.errors.push(message.text());
    }
  });

  stage = "protected-route"; await page.goto(base + "/doctor/patients"); await page.waitForURL("**/login?returnTo=*");
  stage = "doctor-login"; await loginPage(page, emails.doctorA);
  stage = "doctor-dashboard-data";
  await navigate(page, "/doctor/dashboard");
  await page.locator(".doctor-summary-card strong").getByText("1", { exact: true }).waitFor();
  assert.equal(await page.locator('a[href="/patient/measurements"]').count(), 0);
  await navigate(page, "/doctor/patients");
  assert.equal(await page.getByRole("heading", { name: "Patient Visible", exact: true }).count(), 1);
  assert.equal(await page.getByText("Patient Hidden", { exact: true }).count(), 0);
  assert.equal((await page.locator("main").textContent()).includes("@doctor-browser"), false);
  const open = page.getByRole("link", { name: "View record" }); await open.focus(); assert(await open.evaluate(element => element === document.activeElement)); await page.keyboard.press("Enter");
  await page.waitForURL(`**/doctor/patients/${id("patientA")}`);
  await page.getByText("128/82 mmHg", { exact: true }).waitFor();
  await page.getByText("Visible medicine", { exact: true }).waitFor();
  await page.getByText("Visible walking", { exact: true }).waitFor();
  assert((await page.locator("main").textContent()).includes("1 of 1 doses taken today"));
  assert((await page.locator("main").textContent()).includes("0 of 1 habits completed today"));
  assert.equal(await page.locator("main form, main input, main select, main textarea").count(), 0);
  await shot(page, "doctor-record-primary-1440-en-dark");

  stage = "api-failure"; expectedFailure = true;
  await page.route(api + "/doctor/patients/**", route => route.fulfill({ status: 503, json: { error: { code: "TEST_UNAVAILABLE" } } }));
  await page.evaluate(async () => { const module = await import("/src/lib/query/queryClient.ts"); await module.queryClient.invalidateQueries({ queryKey: ["doctor", "patient"] }); });
  await page.locator("main [role=alert]").waitFor();
  assert.equal(await page.getByText("128/82 mmHg", { exact: true }).count(), 0);
  await page.unroute(api + "/doctor/patients/**"); expectedFailure = false;
  await page.getByRole("button", { name: "Try again" }).click(); await page.getByText("128/82 mmHg", { exact: true }).waitFor();

  stage = "logout-login-persistence";
  await page.locator(".session-bar button").click(); await page.waitForURL("**/login?returnTo=*"); await loginPage(page, emails.doctorA);
  await navigate(page, `/doctor/patients/${id("patientA")}`); await page.getByText("128/82 mmHg", { exact: true }).waitFor();

  stage = "responsive-i18n-themes";
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 960 : 844 });
    for (const language of ["ar", "en"]) {
      if (await page.locator("html").getAttribute("lang") !== language) { await page.locator(".language-toggle").click(); await page.waitForFunction(language => document.documentElement.lang === language, language); }
      for (const theme of ["light", "dark"]) { await page.locator(".theme-select").selectOption(theme); await shot(page, `doctor-record-${width}-${language}-${theme}`); }
    }
  }
  await page.locator(".theme-select").selectOption("system");
  for (const colorScheme of ["dark", "light"]) { await page.emulateMedia({ colorScheme }); await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, colorScheme); }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);

  stage = "second-doctor-empty";
  await page.locator(".session-bar button").click(); await page.waitForURL("**/login?returnTo=*"); await page.goto(base + "/login"); await loginPage(page, emails.doctorB); await navigate(page, "/doctor/patients");
  await page.getByText("No patients are currently assigned to your account.", { exact: true }).waitFor();
  assert.equal(await page.getByText("Patient Visible", { exact: true }).count(), 0);
  await context.close();
  assert.deepEqual(report.errors, []);
  report.checks = [
    "doctor-only authenticated routes", "operator-managed relationship persistence", "minimum patient identity without email",
    "assigned-patient list and unassigned-doctor empty state", "cross-doctor and cross-patient isolation", "read-only record without mutation controls",
    "real measurements, today's medication doses, and today's habit progress", "no write endpoint for doctor workflow", "API failure replaces stale record and retry recovers",
    "logout/login persistence", "keyboard record navigation", "Arabic/English and RTL/LTR", "light/dark/system themes and reduced motion", "1440/768/390/320 responsive layouts",
  ];
  console.log(JSON.stringify({ status: "PASS", checks: report.checks.length, screenshots: report.screenshots.length, output }));
} catch (error) {
  if (page) {
    try { const path = resolve(output, "failure.png"); await page.screenshot({ path, fullPage: true }); report.screenshots.push(path); } catch {}
  }
  let debug = String(error.message).replaceAll(password, "[password]");
  for (const email of Object.values(emails)) debug = debug.replaceAll(email, "[email]");
  report.debug = debug.slice(0, 1200);
  report.failureStage = stage;
  report.errors.push(error.code === "ERR_ASSERTION" ? error.message : `Integration verification failed (${error.name}); no credentials logged.`);
  console.error(report.errors.at(-1)); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const service of services.reverse()) { service.child.kill(); await service.stopped; }
  try {
    const testUsers = await db.query("SELECT id FROM chroniccare.users WHERE email=ANY($1::text[])", [Object.values(emails)]);
    const patientIds = testUsers.rows.map(row => row.id);
    if (patientIds.length) {
      await db.query("DELETE FROM chroniccare.measurements WHERE patient_id=ANY($1::uuid[])", [patientIds]);
      await db.query("DELETE FROM chroniccare.medications WHERE patient_id=ANY($1::uuid[])", [patientIds]);
      await db.query("DELETE FROM chroniccare.habits WHERE patient_id=ANY($1::uuid[])", [patientIds]);
    }
    await db.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [Object.values(emails)]);
  } catch (error) {
    report.errors.push(`Test cleanup failed (${error.name}); no credentials logged.`); process.exitCode = 1;
  } finally { await db.end(); }
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}

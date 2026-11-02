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

const root = fileURLToPath(new URL("..", import.meta.url)), backend = resolve(root, "../backend");
const require = createRequire(import.meta.url), backendRequire = createRequire(resolve(backend, "package.json"));
const chromium = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright").chromium, { Client } = backendRequire("pg");
const env = parseEnv(await readFile(resolve(backend, ".env"), "utf8"));
const databaseUrl = process.env.TEST_DATABASE_URL || env.TEST_DATABASE_URL;
assert(databaseUrl && new URL(databaseUrl).pathname.endsWith("_test"), "A dedicated test database is required");
const target = new URL(databaseUrl), application = new URL(process.env.DATABASE_URL || env.DATABASE_URL);
assert(target.host !== application.host || target.pathname !== application.pathname, "Application and test databases must differ");

const base = "http://127.0.0.1:5195", api = "http://127.0.0.1:3315/api", output = resolve(root, "artifacts/admin-foundation");
await mkdir(output, { recursive: true });
const report = { checks: [], screenshots: [], errors: [], expectedFailures: [], serviceLogs: [] };
const adminEmail = randomUUID() + "@admin-browser.example.test";
const doctorEmail = randomUUID() + "@admin-browser.example.test";
const failedEmail = randomUUID() + "@admin-browser.example.test";
const patientEmail = randomUUID() + "@admin-browser.example.test";
const password = randomBytes(24).toString("hex"), db = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 });
const setupSecret = randomBytes(32).toString("hex");
const services = [];
let browser, page, stage = "setup", expectedFailure = false;

async function start(args, cwd, environment, port) {
  const probe = createServer();
  await new Promise((yes, no) => { probe.once("error", no); probe.listen(port, "127.0.0.1", yes); });
  await new Promise(yes => probe.close(yes));
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...environment }, stdio: ["ignore", "pipe", "pipe"] });
  const service = { child, stopped: once(child, "exit") }; services.push(service);
  for (const [stream, label] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) stream.on("data", chunk => {
    if (report.serviceLogs.length < 40) report.serviceLogs.push({ port, label, message: String(chunk).replace(/postgres(?:ql)?:\/\/\S+/gi, "[database-url]").slice(0, 500) });
  });
  for (let attempt = 0; attempt < 120; attempt++) {
    try { await fetch("http://127.0.0.1:" + port); return service; } catch { await new Promise(yes => setTimeout(yes, 250)); }
  }
  throw new Error("Test service did not start");
}

async function stop(service) {
  if (!service || service.child.exitCode !== null) return;
  service.child.kill(); await service.stopped;
}

async function run(args, environment = {}) {
  const child = spawn(process.execPath, args, { cwd: backend, env: { ...process.env, ...env, ...environment }, stdio: ["ignore", "pipe", "pipe"] });
  const stderr = []; child.stderr.on("data", chunk => stderr.push(String(chunk).replace(/postgres(?:ql)?:\/\/\S+/gi, "[database-url]")));
  assert.equal((await once(child, "exit"))[0], 0, stderr.join("").slice(0, 800));
}

async function apiRequest(path, { token, method = "GET", body } = {}) {
  return fetch(api + path, { method, headers: { ...(token ? { Authorization: "Bearer " + token } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

async function loginApi(email) {
  const response = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
  assert.equal(response.status, 200); return (await response.json()).token;
}

async function loginPage(email, role) {
  await page.locator("input[type=email]").fill(email); await page.locator("input[autocomplete=current-password]").fill(password);
  const response = page.waitForResponse(result => result.url() === api + "/auth/login");
  await page.locator(".auth-card button[type=submit]").click(); assert.equal((await response).status(), 200);
  await page.waitForURL(url => url.origin === base && url.pathname.startsWith(`/${role}/`));
}

async function shot(name) {
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const path = resolve(output, name + ".png"); await page.screenshot({ path, fullPage: true }); report.screenshots.push(path);
}

try {
  await db.connect();
  await run(["dist/db/migrate.js"], { NODE_ENV: "test", DATABASE_URL: databaseUrl });
  await db.query("DELETE FROM chroniccare.users WHERE email LIKE '%@admin-browser.example.test'");
  assert.equal((await db.query("SELECT 1 FROM chroniccare.users WHERE role='admin'")).rowCount, 0, "The dedicated test database must not contain an unrelated Admin account");
  let backendService = await start(["dist/server.js"], backend,
    { ...env, NODE_ENV: "test", BOOTSTRAP_SECRET: setupSecret, DATABASE_URL: databaseUrl, HOST: "127.0.0.1", PORT: "3315", CORS_ORIGINS: base }, 3315);
  assert.equal((await fetch(api + "/health/ready")).status, 200);
  await start(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5195", "--strictPort"], root, { VITE_API_URL: api }, 5195);
  browser = await chromium.launch({ channel: "msedge", headless: true }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
  await context.addInitScript(() => { localStorage.setItem("cc-language", "en"); localStorage.setItem("cc-theme", "dark"); localStorage.setItem("cc-public-motion", "paused"); });
  page = await context.newPage(); page.setDefaultTimeout(30_000);
  page.on("pageerror", error => report.errors.push(error.message));
  stage = "browser-bootstrap";
  await page.goto(base + "/login");
  await page.getByRole("link", { name: "First-time Admin setup" }).click();
  await page.locator('input[autocomplete="off"]').fill(setupSecret);
  await page.locator('input[autocomplete="name"]').fill("Initial Admin");
  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[autocomplete="new-password"]').first().fill(password);
  await page.locator('input[autocomplete="new-password"]').last().fill(password);
  const setupResponse = page.waitForResponse(response => response.url() === api + "/setup" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create Admin", exact: true }).click();
  assert.equal((await setupResponse).status(), 201);
  await page.waitForURL("**/login?setup=1");
  assert.deepEqual(await (await apiRequest("/setup")).json(), { available: false });
  await page.goto(base + "/setup"); await page.getByText("Initial setup is closed. Sign in with your existing account.", { exact: true }).waitFor();
  assert.equal(await page.locator("form").count(), 0);
  await page.goto(base + "/register");
  await page.locator('input[autocomplete="name"]').fill("Patient Test");
  await page.locator('input[type="email"]').fill(patientEmail);
  await page.locator('input[autocomplete="new-password"]').first().fill(password);
  await page.locator('input[autocomplete="new-password"]').last().fill(password);
  await page.locator('.auth-card button[type="submit"]').click();
  await page.waitForURL("**/login?registered=1");
  const patientToken = await loginApi(patientEmail), adminToken = await loginApi(adminEmail);
  assert.equal((await apiRequest("/admin/doctors")).status, 401);
  assert.equal((await apiRequest("/admin/doctors", { token: patientToken })).status, 403);
  assert.equal((await apiRequest("/admin/doctors", { token: adminToken, method: "POST", body: {
    name: "Injected", email: randomUUID() + "@admin-browser.example.test", password, role: "admin",
  } })).status, 400);
  assert.equal((await apiRequest("/auth/register", { method: "POST", body: {
    name: "Escalation", email: randomUUID() + "@admin-browser.example.test", password, role: "doctor",
  } })).status, 400);
  const initialDoctors = (await (await apiRequest("/admin/doctors", { token: adminToken })).json()).doctors;

  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) {
      if ((expectedFailure && /Failed to load resource.*(409|503)/.test(message.text())) ||
          (stage === "expired-session-and-patient-login" && /Failed to load resource.*401/.test(message.text()))) report.expectedFailures.push({ stage, message: message.text() });
      else report.errors.push(message.text());
    }
  });

  await page.route(api + "/admin/doctors", async route => {
    if (route.request().method() === "GET") {
      await new Promise(resolve => setTimeout(resolve, 500));
      return route.fulfill({ status: 200, json: { doctors: [] } });
    }
    return route.continue();
  });
  stage = "protected-route"; await page.goto(base + "/admin/dashboard"); await page.waitForURL("**/login?returnTo=*");
  stage = "admin-login"; await loginPage(adminEmail, "admin"); await page.locator(".admin-page").waitFor(); await page.locator(".ui-feedback-loading").waitFor();
  await page.getByText("No Doctor accounts exist yet.", { exact: true }).waitFor();
  await page.unroute(api + "/admin/doctors");
  await page.evaluate(async () => { const module = await import("/src/lib/query/queryClient.ts"); await module.queryClient.invalidateQueries({ queryKey: ["admin", "doctors"] }); });
  await page.waitForFunction(count => document.querySelectorAll(".admin-doctor-card").length === count, initialDoctors.length);
  assert.equal(await page.locator('a[href^="/patient/"]').count(), 0); assert.equal(await page.locator('a[href^="/doctor/"]').count(), 0);
  assert.equal(await page.locator(".admin-doctor-card").count(), initialDoctors.length);

  stage = "client-validation";
  await page.locator(".admin-create-card input[autocomplete=name]").fill("Doctor Browser");
  await page.locator(".admin-create-card input[type=email]").fill("invalid");
  await page.locator("#admin-doctor-password").fill("short");
  await page.locator(".admin-create-card input[autocomplete=new-password]").last().fill("different");
  await page.locator(".admin-create-card button[type=submit]").click();
  assert.equal(await page.locator('.admin-create-card input[aria-invalid="true"]').count(), 3);

  stage = "create-doctor";
  await page.locator(".admin-create-card input[type=email]").fill(doctorEmail);
  await page.locator("#admin-doctor-password").fill(password);
  await page.locator(".admin-create-card input[autocomplete=new-password]").last().fill(password);
  const createdResponse = page.waitForResponse(response => response.url() === api + "/admin/doctors" && response.request().method() === "POST");
  await page.locator(".admin-create-card button[type=submit]").click(); assert.equal((await createdResponse).status(), 201);
  await page.getByText("Doctor Browser", { exact: true }).waitFor(); await page.locator(".ui-feedback-success").waitFor();
  assert.equal((await page.locator("main").textContent()).includes(password), false);
  assert.equal(await page.locator(".admin-doctor-card").count(), initialDoctors.length + 1);
  const createdAccount = await db.query("SELECT id,role,password_hash FROM chroniccare.users WHERE email=$1", [doctorEmail]);
  assert.equal(createdAccount.rows[0].role, "doctor"); assert.match(createdAccount.rows[0].password_hash, /^\$argon2id\$/);
  assert.equal((await db.query("SELECT 1 FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1", [createdAccount.rows[0].id])).rowCount, 0);
  await shot("admin-doctors-1280-en-dark");

  stage = "duplicate-email"; expectedFailure = true;
  await page.locator(".admin-create-card input[autocomplete=name]").fill("Duplicate Doctor");
  await page.locator(".admin-create-card input[type=email]").fill(doctorEmail);
  await page.locator("#admin-doctor-password").fill(password);
  await page.locator(".admin-create-card input[autocomplete=new-password]").last().fill(password);
  const duplicateResponse = page.waitForResponse(response => response.url() === api + "/admin/doctors" && response.request().method() === "POST");
  await page.locator(".admin-create-card button[type=submit]").click(); assert.equal((await duplicateResponse).status(), 409);
  await page.getByText("An account with this email already exists.", { exact: true }).waitFor(); expectedFailure = false;
  assert.equal((await db.query("SELECT 1 FROM chroniccare.users WHERE email=$1", [doctorEmail])).rowCount, 1);

  stage = "failed-create-no-false-success"; expectedFailure = true;
  await page.locator(".admin-create-card input[type=email]").fill(failedEmail);
  await page.route(api + "/admin/doctors", route => route.request().method() === "POST"
    ? route.fulfill({ status: 503, json: { error: { code: "TEST_UNAVAILABLE" } } }) : route.continue());
  const failedResponse = page.waitForResponse(response => response.url() === api + "/admin/doctors" && response.status() === 503);
  await page.locator(".admin-create-card button[type=submit]").click(); await failedResponse;
  await page.getByText("The Doctor account could not be created. No false success was saved.", { exact: true }).waitFor();
  assert.equal((await db.query("SELECT 1 FROM chroniccare.users WHERE email=$1", [failedEmail])).rowCount, 0);
  await page.unroute(api + "/admin/doctors"); expectedFailure = false;

  stage = "responsive-arabic";
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator(".language-toggle").click();
  await page.waitForFunction(() => document.documentElement.lang === "ar" && document.documentElement.dir === "rtl");
  await page.locator(".theme-select").selectOption("light"); await shot("admin-doctors-390-ar-light");
  await page.locator(".theme-select").selectOption("system");
  for (const colorScheme of ["dark", "light"]) { await page.emulateMedia({ colorScheme }); await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, colorScheme); }
  await page.emulateMedia({ reducedMotion: "reduce" }); assert(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
  const nameInput = page.locator(".admin-create-card input[autocomplete=name]"); await nameInput.focus(); assert(await nameInput.evaluate(element => element === document.activeElement));

  stage = "doctor-login";
  await page.locator(".session-bar button").click(); await page.waitForURL("**/login?returnTo=*"); await page.goto(base + "/login"); await loginPage(doctorEmail, "doctor");
  await page.locator(".doctor-page").waitFor();
  const doctorToken = await loginApi(doctorEmail);
  assert.equal((await apiRequest("/admin/doctors", { token: doctorToken })).status, 403);
  assert.deepEqual((await (await apiRequest("/doctor/patients", { token: doctorToken })).json()).patients, []);

  stage = "backend-restart-persistence";
  await stop(backendService); services.splice(services.indexOf(backendService), 1);
  backendService = await start(["dist/server.js"], backend,
    { ...env, NODE_ENV: "test", DATABASE_URL: databaseUrl, HOST: "127.0.0.1", PORT: "3315", CORS_ORIGINS: base }, 3315);
  const persistedDoctorToken = await loginApi(doctorEmail);
  assert.deepEqual((await (await apiRequest("/doctor/patients", { token: persistedDoctorToken })).json()).patients, []);
  const persistedAdminToken = await loginApi(adminEmail);
  assert((await (await apiRequest("/admin/doctors", { token: persistedAdminToken })).json()).doctors.some(doctor => doctor.email === doctorEmail));

  stage = "expired-session-and-patient-login";
  await db.query("UPDATE chroniccare.sessions SET expires_at=now()-interval '1 second' WHERE user_id=(SELECT id FROM chroniccare.users WHERE email=$1)", [doctorEmail]);
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await page.waitForURL("**/login?returnTo=*");
  assert.equal(await page.evaluate(async () => {
    const module = await import("/src/lib/query/queryClient.ts"); return module.queryClient.getQueryCache().getAll().length;
  }), 0);
  await loginPage(patientEmail, "patient");
  await page.locator(".session-bar button").click(); await page.waitForURL("**/login?returnTo=*");
  assert.equal(await page.evaluate(async () => {
    const module = await import("/src/lib/query/queryClient.ts"); return module.queryClient.getQueryCache().getAll().length;
  }), 0);

  await context.close(); assert.deepEqual(report.errors, []);
  report.checks = [
    "browser bootstrap creates the first Admin and then closes", "Admin-only Doctor list and creation", "server-fixed Doctor role",
    "shared Argon2id hashing without password disclosure", "duplicate and invalid input handling", "Patient and Doctor role rejection",
    "public registration cannot request privileged roles", "Doctor shared-login redirect", "new Doctor has no patient relationships or access",
    "API failure produces no false success", "account and role persistence after backend restart", "keyboard focus",
    "Arabic/English RTL/LTR responsive UI", "light/dark/system and reduced-motion support",
    "Patient browser registration and login", "expired session and logout clear protected caches",
  ];
  console.log(JSON.stringify({ status: "PASS", checks: report.checks.length, screenshots: report.screenshots.length, output }));
} catch (error) {
  if (page) { try { const path = resolve(output, "failure.png"); await page.screenshot({ path, fullPage: true }); report.screenshots.push(path); } catch {} }
  let debug = String(error.message).replaceAll(password, "[password]").replaceAll(adminEmail, "[email]").replaceAll(doctorEmail, "[email]");
  report.debug = debug.slice(0, 1200); report.failureStage = stage;
  report.errors.push(error.code === "ERR_ASSERTION" ? error.message : `Integration verification failed (${error.name}); no credentials logged.`);
  console.error(report.errors.at(-1)); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const service of services.reverse()) await stop(service);
  try { await db.query("DELETE FROM chroniccare.users WHERE email LIKE '%@admin-browser.example.test'"); }
  catch (error) { report.errors.push(`Test cleanup failed (${error.name}); no credentials logged.`); process.exitCode = 1; }
  finally { await db.end(); }
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}

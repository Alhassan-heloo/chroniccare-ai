// Real Express, PostgreSQL and Edge. Email is captured by an injected TEST transport;
// no real mailbox or third-party delivery is claimed by this verification.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("..", import.meta.url)), backend = resolve(root, "../backend");
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const moduleAt = path => import(pathToFileURL(resolve(backend, "dist", path)).href);
const { createApp } = await moduleAt("app.js"), { readEnvironment } = await moduleAt("config/env.js");
const { createDatabasePool } = await moduleAt("db/pool.js"), { applyMigrations } = await moduleAt("db/migrations.js");
const { accountService } = await moduleAt("auth/accounts.js");
const env = parseEnv(await readFile(resolve(backend, ".env"), "utf8"));
const databaseUrl = process.env.TEST_DATABASE_URL || env.TEST_DATABASE_URL;
assert(databaseUrl && new URL(databaseUrl).pathname.endsWith("_test"));
assert.notEqual(new URL(databaseUrl).pathname, new URL(env.DATABASE_URL).pathname);
const pool = createDatabasePool(readEnvironment({ ...env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
const emails = Array.from({ length: 3 }, () => randomUUID() + "@account-browser.example.test");
const password = randomBytes(24).toString("hex"), nextPassword = randomBytes(24).toString("hex");
const base = "http://127.0.0.1:5197", api = "http://127.0.0.1:3317/api";
const output = resolve(root, "artifacts/account-foundation"); await mkdir(output, { recursive: true });
const messages = [], report = { checks: [], errors: [], screenshots: [], diagnostics: [], emailTransport: "Injected test capture; no real provider or inbox delivery" };
const service = accountService(pool, { publicOrigin: base, firstAdminEmail: emails[0], email: { async send(message) { messages.push(message); } } });
let server, vite, viteDone, browser, stage = "startup";
async function startBackend() {
  const options = { corsOrigins: [base], cookies: { secure: false }, checkDatabase: async () => { await pool.query("SELECT 1"); }, accountService: service };
  for (const [name, path, factory] of [
    ["authStore", "auth/store.js", "postgresAuthStore"], ["adminStore", "admin/store.js", "postgresAdminStore"],
    ["doctorStore", "doctor/store.js", "postgresDoctorStore"], ["measurementStore", "measurements/store.js", "postgresMeasurementStore"],
    ["medicationStore", "medications/store.js", "postgresMedicationStore"], ["habitStore", "habits/store.js", "postgresHabitStore"],
    ["connectionStore", "connections/store.js", "postgresConnectionStore"],
  ]) options[name] = (await moduleAt(path))[factory](pool);
  server = createApp(options).listen(3317, "127.0.0.1"); await once(server, "listening");
}
async function stopBackend() { if (server) { const current = server; server = undefined; await new Promise(resolve => { current.close(resolve); current.closeAllConnections(); }); } }
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => { localStorage.setItem("cc-language", "en"); localStorage.setItem("cc-theme", "dark"); });
  const page = await context.newPage(); page.setDefaultTimeout(20_000); page.on("pageerror", error => report.errors.push(error.message)); return page;
}
async function login(page, email, role, pass = password) {
  await page.locator('input[autocomplete="current-password"]').waitFor();
  await page.locator('input[type="email"]').fill(email); await page.locator('input[autocomplete="current-password"]').fill(pass);
  const response = page.waitForResponse(response => response.url() === api + "/auth/login" && response.request().method() === "POST");
  await page.locator('.auth-card button[type="submit"]').click();
  const result = await response;
  report.diagnostics.push({ stage, loginStatus: result.status(), ...(result.ok() ? {} : { error: (await result.json()).error?.code }) });
  try { await page.waitForURL(url => url.pathname.startsWith(`/${role}/`)); }
  catch (error) { report.diagnostics.push({ stage, path: new URL(page.url()).pathname, alerts: await page.locator('[role="alert"]').allTextContents() }); throw error; }
}
async function logout(page) { await page.locator(".session-bar button").click(); await page.waitForURL("**/login?returnTo=*"); }
async function apiOn(page, path, body, method) {
  return page.evaluate(async ({ path, body, method }) => {
    const { apiRequest } = await import("/src/auth/api.ts");
    return apiRequest(path, { ...(body ? { body } : {}), ...(method ? { method } : {}) });
  }, { path, body, method });
}
const link = message => { const match = message.text.match(/http[^\s]+#token=[a-f0-9]{64}/); assert(match); return match[0]; };
try {
  await applyMigrations(pool); assert.equal((await pool.query("SELECT 1 FROM chroniccare.users WHERE role='admin'")).rowCount, 0);
  await startBackend(); await service.inviteAdmin(); assert.equal(messages[0].to, emails[0]);
  vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5197", "--strictPort"], { cwd: root, env: { ...process.env, VITE_API_URL: api }, stdio: "ignore" }); viteDone = once(vite, "exit");
  for (let n = 0; n < 100; n++) { try { await fetch(base); break; } catch { await new Promise(resolve => setTimeout(resolve, 200)); } }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const admin = await newPage(); stage = "trusted-admin-activation";
  await admin.goto(link(messages[0])); await admin.locator('input[autocomplete="name"]').fill("Clinic Admin");
  assert.equal(new URL(admin.url()).hash, "", "Link token is removed from the address bar.");
  await admin.locator('input[autocomplete="new-password"]').first().fill(password); await admin.locator('input[autocomplete="new-password"]').last().fill(password);
  await admin.locator('button[type="submit"]').click(); await admin.getByText("Saved successfully. Sign in with your password.", { exact: true }).waitFor();
  await admin.getByRole("link", { name: "Sign in", exact: true }).last().click(); await login(admin, emails[0], "admin");
  stage = "admin-cookie-and-doctor-creation";
  const cookies = await admin.context().cookies(api); const sessionCookie = cookies.find(cookie => cookie.name === "cc_session");
  assert(sessionCookie?.httpOnly && sessionCookie.sameSite === "Lax"); assert(!(await admin.evaluate(() => document.cookie)).includes("cc_session"));
  await admin.reload(); await admin.locator(".admin-page").waitFor(); assert(new URL(admin.url()).pathname.startsWith("/admin/"));
  await admin.locator(".admin-open-create").click();
  await admin.locator('.admin-create-card input[autocomplete="name"]').fill("Invited Doctor");
  await admin.locator('.admin-create-card input[type="email"]').fill(emails[1]);
  assert.equal(await admin.locator('.admin-create-card input[type="password"]').count(), 0);
  await admin.locator('.admin-create-card button[type="submit"]').click(); await admin.locator('.admin-create-card .ui-feedback-success').waitFor();
  const doctorMail = messages.find(message => message.to === emails[1]); assert(doctorMail);
  const doctorLink = link(doctorMail), doctor = await newPage();
  await doctor.goto(doctorLink); await doctor.locator('#recovery-password').waitFor();
  assert.equal(new URL(doctor.url()).hash, "");
  await doctor.locator('input[autocomplete="new-password"]').first().fill(password); await doctor.locator('input[autocomplete="new-password"]').last().fill(password);
  await doctor.locator('button[type="submit"]').click(); await doctor.locator('.ui-feedback-success').waitFor();
  // A same-tab fragment navigation must reset the previous success state.
  await doctor.goto(doctorLink); await doctor.locator('#recovery-password').waitFor();
  await doctor.locator('input[autocomplete="new-password"]').first().fill(password); await doctor.locator('input[autocomplete="new-password"]').last().fill(password);
  await doctor.locator('button[type="submit"]').click(); await doctor.locator('.ui-feedback-error').waitFor();
  await doctor.goto(base + "/login"); await login(doctor, emails[1], "doctor");
  assert.deepEqual(await apiOn(doctor, "/doctor/patients"), { patients: [] });
  stage = "patient-registration-refresh-and-health";
  const patient = await newPage(); await patient.goto(base + "/register");
  await patient.locator('input[autocomplete="name"]').fill("Clinic Patient"); await patient.locator('input[type="email"]').fill(emails[2]);
  await patient.locator('input[autocomplete="new-password"]').first().fill(password); await patient.locator('input[autocomplete="new-password"]').last().fill(password);
  stage = "patient-registration-submit";
  await patient.locator('.auth-card button[type="submit"]').click(); await patient.waitForURL("**/login?registered=1");
  stage = "patient-login"; await login(patient, emails[2], "patient");
  stage = "patient-refresh"; await patient.reload(); await patient.waitForURL("**/patient/dashboard"); await patient.locator(".session-bar").waitFor();
  // Exact existing API schema is exercised by the backend health regressions;
  // here all five real Patient screens must load under the persistent Cookie.
  for (const path of ["measurements", "medications", "habits", "reports", "dashboard"]) {
    stage = "patient-page-" + path;
    await patient.goto(base + "/patient/" + path); await patient.locator(".session-bar").waitFor(); assert.equal(new URL(patient.url()).pathname, "/patient/" + path);
  }
  stage = "medical-consent-and-revocation";
  await doctor.goto(base + "/doctor/connect"); await doctor.getByRole("button", { name: "Generate connection code", exact: true }).click();
  const codeInput = doctor.locator('input[readonly]'); await codeInput.waitFor(); const code = await codeInput.inputValue();
  await patient.goto(base + "/patient/doctors"); await patient.locator('input[autocomplete="off"]').fill(code);
  await patient.getByRole("button", { name: "Review Doctor", exact: true }).click(); await patient.getByRole("heading", { name: "Invited Doctor", exact: true }).waitFor();
  await patient.getByRole("button", { name: "Approve connection", exact: true }).click(); await patient.getByText("Connection approved.", { exact: true }).waitFor();
  const patientId = (await pool.query("SELECT id FROM chroniccare.users WHERE email=$1", [emails[2]])).rows[0].id;
  await doctor.goto(base + `/doctor/patients/${patientId}`); await doctor.locator(".doctor-record").waitFor();
  await stopBackend(); await startBackend(); await patient.reload(); await patient.getByRole("heading", { name: "Invited Doctor", exact: true }).waitFor();
  await patient.getByRole("button", { name: "Revoke access", exact: true }).click(); await patient.getByText("Access revoked.", { exact: true }).waitFor();
  await doctor.reload(); await doctor.locator(".ui-feedback-error").waitFor();
  stage = "cross-tab-account-switch";
  const sibling = await patient.context().newPage(); await sibling.goto(base + "/patient/dashboard"); await sibling.locator(".session-bar").waitFor();
  await logout(patient); await sibling.waitForURL("**/login?returnTo=*");
  assert.equal(await sibling.evaluate(async () => (await import("/src/lib/query/queryClient.ts")).queryClient.getQueryCache().getAll().length), 0);
  await login(patient, emails[1], "doctor"); await sibling.waitForURL("**/doctor/dashboard");
  assert.equal(await sibling.evaluate(async () => (await import("/src/lib/query/queryClient.ts")).queryClient.getQueryCache().getAll().filter(query => query.queryKey[0] === "patient").length), 0);
  await logout(patient); await login(patient, emails[2], "patient"); await sibling.close();
  stage = "password-reset";
  const previousPatient = await newPage(); await previousPatient.goto(base + "/login"); await login(previousPatient, emails[2], "patient");
  const oldSession = await previousPatient.context().cookies(api);
  await logout(patient); await patient.getByRole("link", { name: "Forgot password?", exact: true }).click();
  await patient.locator('input[type="email"]').fill(emails[2]); await patient.locator('button[type="submit"]').click(); await patient.locator(".ui-feedback-success").waitFor();
  const resetMessage = messages.find(message => message.to === emails[2]); assert(resetMessage);
  await patient.goto(link(resetMessage)); await patient.locator('input[autocomplete="new-password"]').first().fill(nextPassword); await patient.locator('input[autocomplete="new-password"]').last().fill(nextPassword);
  await patient.locator('button[type="submit"]').click(); await patient.getByText("Saved successfully. Sign in with your password.", { exact: true }).waitFor();
  const stale = await browser.newContext(); await stale.addCookies(oldSession); assert.equal((await stale.request.get(api + "/auth/me")).status(), 401); await stale.close();
  await patient.getByRole("link", { name: "Sign in", exact: true }).last().click(); await login(patient, emails[2], "patient", nextPassword);
  stage = "expiry-logout-and-cache-isolation";
  await pool.query("UPDATE chroniccare.sessions SET last_seen_at=now()-interval '31 minutes' WHERE user_id=$1", [patientId]);
  await patient.evaluate(() => dispatchEvent(new Event("focus"))); await patient.waitForURL("**/login?returnTo=*");
  assert.equal(await patient.evaluate(async () => (await import("/src/lib/query/queryClient.ts")).queryClient.getQueryCache().getAll().length), 0);
  await login(patient, emails[1], "doctor"); await patient.goto(base + "/admin/dashboard"); await patient.waitForURL("**/doctor/dashboard");
  await logout(patient); await patient.reload(); await patient.waitForURL("**/login?returnTo=*");
  assert.equal((await patient.context().cookies(api)).filter(cookie => cookie.name === "cc_session" && cookie.value).length, 0);
  stage = "arabic-mobile-and-privacy";
  await patient.goto(base + "/forgot-password"); await patient.setViewportSize({ width: 390, height: 844 }); await patient.locator(".language-toggle").click(); await patient.locator(".theme-select").selectOption("light");
  await patient.waitForFunction(() => document.documentElement.dataset.theme === "light");
  await patient.emulateMedia({ reducedMotion: "reduce" });
  assert(await patient.evaluate(() => document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= innerWidth + 1));
  const capture = resolve(output, "forgot-password-ar-light.png"); await patient.screenshot({ path: capture, fullPage: true, animations: "disabled" }); report.screenshots.push(capture);
  for (const page of [admin, doctor, patient]) assert(await page.evaluate(() => !Object.keys(localStorage).some(key => /token|password|session/i.test(key))));
  report.checks = ["operator-preauthorized Admin invitation", "Admin activation from captured test email", "fragment removed from URL", "Admin creates Doctor in browser", "shared Login for all roles", "HttpOnly SameSite Cookie and no JS session credential", "refresh persistence", "backend restart persistence", "five Patient screens", "Doctor starts without patient access", "explicit patient approval", "revocation blocks direct record", "cross-tab logout/account switching clears caches", "forgot/reset browser workflow", "old sessions rejected", "server idle expiry", "protected cache cleared", "role route guard", "logout survives refresh", "Arabic mobile light and English desktop dark", "no auth credentials in localStorage"];
  assert.deepEqual(report.errors, []); console.log(JSON.stringify({ status: "PASS", checks: report.checks.length, output }));
} catch (error) { report.errors.push({ stage, type: error.name, message: String(error.message).replaceAll(password, "[password]").replaceAll(nextPassword, "[password]").replace(/#token=[a-f0-9]+/g, "#token=[redacted]") }); console.error("Account browser test failed at " + stage + " (" + error.name + ")"); process.exitCode = 1; }
finally {
  if (browser) await browser.close(); if (vite && vite.exitCode === null) { vite.kill(); await viteDone; } await stopBackend();
  try { await pool.query("DELETE FROM chroniccare.account_tokens WHERE email=ANY($1::text[])", [emails]); await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]); } finally { await pool.end(); }
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}

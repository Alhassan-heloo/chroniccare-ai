// Real Express + isolated PostgreSQL + Edge. No production data, LLM or push calls.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)), backend = resolve(root, "../backend");
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const loadModule = file => import(pathToFileURL(resolve(backend, "dist", file)).href);
const { createApp } = await loadModule("app.js"), { readEnvironment } = await loadModule("config/env.js");
const { createDatabasePool } = await loadModule("db/pool.js"), { applyMigrations } = await loadModule("db/migrations.js");
const { hashPassword } = await loadModule("auth/security.js");
const env = parseEnv(await readFile(resolve(backend, ".env"), "utf8")), databaseUrl = process.env.TEST_DATABASE_URL || env.TEST_DATABASE_URL;
assert(databaseUrl && new URL(databaseUrl).pathname.endsWith("_test")); assert.notEqual(new URL(databaseUrl).pathname, new URL(env.DATABASE_URL).pathname);
const pool = createDatabasePool(readEnvironment({ ...env, NODE_ENV: "test", DATABASE_URL: databaseUrl }));
const base = "http://127.0.0.1:5193", api = "http://127.0.0.1:3313/api", password = randomBytes(24).toString("hex");
const emails = Array.from({ length: 4 }, () => randomUUID() + "@notifications-browser.example.test");
const output = resolve(root, "artifacts/notifications"); await mkdir(output, { recursive: true });
const report = { checks: [], errors: [], screenshots: [] };
const options = { corsOrigins: [base], checkDatabase: async () => { await pool.query("SELECT 1"); } };
options.registrationStore = (await loadModule("notifications/registrations.js")).postgresRegistrationStore(pool);
options.pushPool = pool;
for (const [key, file, factory] of [["authStore","auth/store.js","postgresAuthStore"], ["notificationStore","notifications/store.js","postgresNotificationStore"], ["connectionStore","connections/store.js","postgresConnectionStore"], ["doctorStore","doctor/store.js","postgresDoctorStore"], ["measurementStore","measurements/store.js","postgresMeasurementStore"], ["medicationStore","medications/store.js","postgresMedicationStore"], ["habitStore","habits/store.js","postgresHabitStore"], ["adminStore","admin/store.js","postgresAdminStore"]]) options[key] = (await loadModule(file))[factory](pool);
let server, vite, viteDone, browser, stage = "startup";
async function start() { server = createApp(options).listen(3313, "127.0.0.1"); await once(server, "listening"); }
async function stop() { if (server) { const current = server; server = undefined; await new Promise(resolve => { current.close(resolve); current.closeAllConnections(); }); } }
async function loginPage(email, role, path) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await context.addInitScript(() => { localStorage.setItem("cc-language", "en"); localStorage.setItem("cc-theme", "dark"); });
  const page = await context.newPage(); page.setDefaultTimeout(20_000); page.on("pageerror", error => report.errors.push(error.message));
  await page.goto(base + path); await page.locator('input[autocomplete="current-password"]').waitFor();
  await page.locator('input[type="email"]').fill(email); await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('.auth-card button[type="submit"]').click(); await page.waitForURL(url => url.pathname.startsWith(`/${role}/`)); return page;
}
try {
  await applyMigrations(pool);
  const hash = await hashPassword(password), users = [];
  for (const [index, role] of ["patient", "patient", "doctor", "admin"].entries()) users.push(await options.authStore.createUser("Notification fixture " + index, emails[index], hash, role));
  await start();
  vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5193", "--strictPort"], { cwd: root, env: { ...process.env, VITE_API_URL: api }, stdio: "ignore" }); viteDone = once(vite, "exit");
  for (let n = 0; n < 100; n++) { try { await fetch(base); break; } catch { await new Promise(resolve => setTimeout(resolve, 150)); } }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const patient = await loginPage(emails[0], "patient", "/patient/doctors");
  stage = "empty-and-event";
  await patient.locator(".notification-bell").click(); await patient.getByText("No notifications yet.", { exact: true }).waitFor();
  await patient.getByText("Browser notifications are not configured. In-app notifications still work.", { exact: true }).waitFor();
  assert.equal(await patient.getByRole("button", { name: "Enable for this session", exact: true }).isDisabled(), true);
  assert.equal(await patient.evaluate(() => Notification.permission), "default");
  // Mock only the external browser/Firebase adapter; persistence is the real API.
  await patient.route("**/src/lib/notifications/browser.ts*", route => route.fulfill({ contentType: "application/javascript", body:
    'export const browserAvailability=()=>null; export async function upgradePushWorker(){} export async function registerBrowser(){window.pushOptIns=(window.pushOptIns||0)+1; await new Promise(r=>setTimeout(r,100)); return "cBBBBBBBBBBBBBBBBBBBBB";} export async function unregisterBrowser(){}' }));
  await patient.reload(); await patient.locator(".notification-bell").click();
  assert.equal(await patient.evaluate(() => window.pushOptIns || 0), 0);
  await patient.getByRole("button", { name: "Enable for this session", exact: true }).click();
  await patient.getByText("Registration confirmed for this session.", { exact: true }).waitFor();
  assert.equal(await patient.evaluate(() => window.pushOptIns), 1);
  assert.equal((await pool.query("SELECT 1 FROM chroniccare.browser_registrations WHERE user_id=$1", [users[0].id])).rowCount, 1);
  await patient.getByRole("button", { name: "Disable for this session", exact: true }).click();
  await patient.getByText("Not registered for this session.", { exact: true }).waitFor();
  assert.equal((await pool.query("SELECT 1 FROM chroniccare.browser_registrations WHERE user_id=$1", [users[0].id])).rowCount, 0);
  await patient.getByRole("button", { name: "Close", exact: true }).click();
  const code = await options.connectionStore.generate(users[2].id);
  await patient.locator('input[autocomplete="off"]').fill(code.code); await patient.getByRole("button", { name: "Review Doctor", exact: true }).click();
  await patient.getByRole("button", { name: "Approve connection", exact: true }).click(); await patient.getByText("Connection approved.", { exact: true }).waitFor();
  await patient.locator(".notification-badge").waitFor(); assert.equal(await patient.locator(".notification-badge").textContent(), "1");
  await patient.locator(".notification-bell").click(); await patient.locator(".notification-center .is-unread").waitFor();
  assert.equal(await patient.locator(".notification-center li").count(), 1);
  assert(!(await patient.locator(".notification-center").textContent()).includes(users[2].name));
  stage = "failed-and-confirmed-read";
  await patient.route(api + "/notifications/*/read", route => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE" } } }));
  await patient.getByRole("button", { name: "Mark as read", exact: true }).click(); await patient.getByText("Read status could not be confirmed. Try again.", { exact: true }).waitFor();
  assert.equal(await options.notificationStore.unreadCount(users[0].id), 1);
  await patient.unroute(api + "/notifications/*/read"); await patient.getByRole("button", { name: "Mark as read", exact: true }).click();
  await patient.locator(".notification-center .is-read").waitFor(); assert.equal(await options.notificationStore.unreadCount(users[0].id), 0);
  assert.equal(await patient.locator(".notification-badge").count(), 0);
  stage = "revoke-and-persistence";
  await patient.getByRole("button", { name: "Close", exact: true }).click();
  await patient.getByRole("button", { name: "Revoke access", exact: true }).click(); await patient.getByText("Access revoked.", { exact: true }).waitFor();
  await patient.locator(".notification-badge").waitFor(); await stop(); await start(); await patient.reload();
  await patient.locator(".notification-bell").click(); await patient.locator(".notification-center .is-unread").waitFor();
  assert.equal(await patient.locator(".notification-center li").count(), 2);
  stage = "isolation-and-roles";
  const second = await loginPage(emails[1], "patient", "/patient/doctors"); await second.locator(".notification-bell").click(); await second.getByText("No notifications yet.", { exact: true }).waitFor();
  const doctor = await loginPage(emails[2], "doctor", "/doctor/dashboard"); await doctor.locator(".notification-bell").click(); await doctor.locator(".notification-center .is-unread").first().waitFor(); assert.equal(await doctor.locator(".notification-center li").count(), 2);
  const admin = await loginPage(emails[3], "admin", "/admin/dashboard"); await admin.locator(".notification-bell").click(); await admin.getByText("No notifications yet.", { exact: true }).waitFor();
  stage = "arabic-mobile";
  await patient.getByRole("button", { name: "Close", exact: true }).click(); await patient.setViewportSize({ width: 390, height: 844 });
  await patient.locator(".language-toggle").click(); await patient.locator(".theme-select").selectOption("light");
  await patient.locator(".notification-bell").click(); await patient.waitForFunction(() => document.documentElement.dir === "rtl" && document.documentElement.dataset.theme === "light");
  assert(await patient.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const screenshot = resolve(output, "notifications-390-ar-light.png"); await patient.screenshot({ path: screenshot, fullPage: true, animations: "disabled" }); report.screenshots.push(screenshot);
  await patient.keyboard.press("Escape"); await patient.waitForFunction(() => !document.querySelector("dialog[open]"));
  report.checks = ["real authenticated PostgreSQL list/count", "empty account without fixtures", "approval creates private notifications", "connection mutation updates badge", "failed write has no false read", "read confirmation updates count", "revocation event", "refresh/backend restart persistence", "two Patient isolation", "Doctor own events", "Admin has no automatic notifications", "Arabic RTL/light mobile and English/dark desktop", "Escape closes dialog"];
  report.checks.push("missing Firebase configuration disables opt-in without permission prompt", "browser deregistration control persists through real API");
  stage="push-worker";
  const { configurePush, dispatchOne }=await loadModule("notifications/push.js");
  const { tokenHash }=await loadModule("auth/security.js");
  const session=(await patient.context().cookies(api)).find(c=>c.name==="cc_session").value;
  await options.registrationStore.put(users[0].id,tokenHash(session),"c"+"W".repeat(21));
  await configurePush(pool,true);
  const newDelivery=async()=>{
    const n=await pool.query("INSERT INTO chroniccare.notifications(user_id,type) VALUES($1,'connection_revoked') RETURNING id",[users[0].id]);
    const j=await pool.query("SELECT id FROM chroniccare.push_jobs WHERE notification_id=$1",[n.rows[0].id]);
    await dispatchOne(pool,{send:async()=>"sent"}); return j.rows[0].id;
  };
  await patient.evaluate(async api=>{
    const r=await navigator.serviceWorker.register('/cc-fcm/sw.js?api='+encodeURIComponent(api)+'&lang=en',{scope:'/cc-fcm/'});
    if(!r.active) await new Promise(resolve=>{const w=r.installing||r.waiting;w.addEventListener('statechange',()=>{if(w.state==='activated')resolve();});});
  },api);
  const worker=patient.context().serviceWorkers().find(w=>w.url().includes('/cc-fcm/sw.js'));
  assert(worker);
  await worker.evaluate(()=>{ self.shown=[]; self.refreshes=0; self.registration.showNotification=async(title,options)=>{self.shown.push({title,options});}; self.clients.matchAll=async()=>[{url:self.location.origin+'/patient/dashboard',visibilityState:'visible',postMessage:()=>{self.refreshes++;}}]; });
  const foreground=await newDelivery(); await worker.evaluate(id=>receive({data:{deliveryId:id}}),foreground);
  assert.deepEqual(await worker.evaluate(()=>[self.shown.length,self.refreshes]),[0,1]);
  await worker.evaluate(()=>{self.clients.matchAll=async()=>[];});
  const background=await newDelivery(); await worker.evaluate(id=>receive({data:{deliveryId:id}}),background);
  await worker.evaluate(id=>receive({data:{deliveryId:id}}),background);
  assert.equal(await worker.evaluate(()=>self.shown.length),1);
  assert.equal(await worker.evaluate(()=>self.shown[0].options.body),'You have a new account notification. Sign in to view it.');
  const revoked=await newDelivery(); await options.registrationStore.remove(users[0].id,tokenHash(session));
  await worker.evaluate(id=>receive({data:{deliveryId:id}}),revoked);
  assert.equal(await worker.evaluate(()=>self.shown.length),1);
  await configurePush(pool,false);
  report.checks.push("real service worker foreground refresh without OS duplicate", "background generic preview and persistent duplicate suppression", "delayed push after deregistration fails closed against real API");
  assert.deepEqual(report.errors, []); console.log(JSON.stringify({ status: "PASS", checks: report.checks.length, output }));
} catch (error) { report.errors.push({ stage, message: String(error.message).replaceAll(password, "[password]") }); console.error(stage + ": " + error.name); process.exitCode = 1; }
finally {
  if (browser) await browser.close(); if (vite && vite.exitCode === null) { vite.kill(); await viteDone; } await stop();
  try { await pool.query("UPDATE chroniccare.push_control SET enabled=false"); await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]); } finally { await pool.end(); }
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}

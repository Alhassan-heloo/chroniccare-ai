// Real Edge + Express + separate PostgreSQL test database. Only own test users are removed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { changePreferences, doctorBrowserFixtures } from "./doctor-browser-fixtures.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const output = resolve(root, "artifacts/patient-connections"); await mkdir(output, { recursive: true });
const emails = Array.from({ length: 5 }, () => randomUUID() + "@connection-browser.example.test");
const password = randomBytes(24).toString("hex");
const fixtures = await doctorBrowserFixtures({ frontendPort: 5196, backendPort: 3316, emails, password });
const { base, pool: db } = fixtures;
const report = { checks: [], errors: [], screenshots: [] };
let browser, stage = "startup";
const record = (id, token) => fixtures.request(`/doctor/patients/${id}?date=2026-11-01`, { token });
async function login(page, email, role) {
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
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
  if (!await page.locator(".manual-connection").evaluate(element=>element.open)) await page.locator(".manual-connection > summary").click();
  await page.getByRole("button", { name: "Generate connection code", exact: true }).click();
  const input = codeField(page);
  await input.waitFor();
  const code = await input.inputValue();
  assert(/^[A-Za-z0-9_-]{32}$/.test(code), "The complete connection code must be displayed.");
  return code;
}
const codeField = page => page.getByRole("textbox", { name: "Connection code", exact: true });
const invalidCode = page => page.getByRole("main").getByRole("alert")
  .getByText("The code is invalid, expired, or already used.", { exact: true });
async function approve(page, code, name) {
  await codeField(page).fill(code);
  await page.getByRole("button", { name: "Review Doctor", exact: true }).click();
  await page.getByRole("heading", { name, exact: true }).waitFor();
  await page.getByRole("button", { name: "Approve connection", exact: true }).click();
  await page.getByRole("main").getByText("Connection approved.", { exact: true }).waitFor();
}
try {
  const adminToken = await fixtures.start(emails[0]);
  for (let n = 1; n <= 2; n++) await fixtures.inviteDoctor(adminToken, emails[n], "Doctor " + n);
  for (let n = 3; n <= 4; n++) {
    assert.equal((await fixtures.request("/auth/register", { body: { name: "Patient " + n, email: emails[n], password } })).status, 201);
  }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const doctor = await openPage(emails[1], "doctor", "/doctor/connect");
  const doctor2 = await openPage(emails[2], "doctor", "/doctor/connect");
  const patient = await openPage(emails[3], "patient", "/patient/doctors");
  const patient2 = await openPage(emails[4], "patient", "/patient/doctors");
  const dt1 = await fixtures.login(emails[1], "doctor"), dt2 = await fixtures.login(emails[2], "doctor");
  const accounts = (await db.query("SELECT id,email FROM chroniccare.users WHERE email=ANY($1::text[])", [emails])).rows;
  const p1 = accounts.find(user => user.email === emails[3]), p2 = accounts.find(user => user.email === emails[4]);
  stage = "explicit-consent";
  const code = await generate(doctor);
  assert.equal((await record(p1.id, dt1)).status, 404);
  await codeField(patient).fill(code);
  await patient.getByRole("button", { name: "Review Doctor", exact: true }).click();
  await patient.getByRole("heading", { name: "Doctor 1", exact: true }).waitFor();
  assert.equal((await record(p1.id, dt1)).status, 404);
  await patient.getByRole("button", { name: "Approve connection", exact: true }).click();
  await patient.getByRole("main").getByText("Connection approved.", { exact: true }).waitFor();
  assert.equal((await record(p1.id, dt1)).status, 200);
  assert.equal((await record(p1.id, dt2)).status, 404);
  assert.equal((await record(p2.id, dt1)).status, 404);
  await codeField(patient2).fill(code);
  await patient2.getByRole("button", { name: "Review Doctor", exact: true }).click();
  await invalidCode(patient2).waitFor();
  stage = "expiry-and-second-pair";
  const expired = await generate(doctor2);
  await db.query("UPDATE chroniccare.doctor_connection_codes SET created_at=now()-interval '20 minutes',expires_at=now()-interval '10 minutes' WHERE code_hash=$1", [createHash("sha256").update(expired).digest("hex")]);
  await codeField(patient2).fill(expired);
  await patient2.getByRole("button", { name: "Review Doctor", exact: true }).click();
  await invalidCode(patient2).waitFor();
  await doctor2.reload();
  await approve(patient2, await generate(doctor2), "Doctor 2");
  assert.equal((await record(p2.id, dt2)).status, 200);
  stage = "responsive-and-keyboard";
  await codeField(patient).focus(); await patient.keyboard.press("Tab");
  assert(await patient.getByRole("button", { name: "Review Doctor", exact: true }).evaluate(element => element === document.activeElement));
  for (const width of [1440, 768, 390, 320]) {
    await patient.setViewportSize({ width, height: 900 });
    assert(await patient.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await changePreferences(patient, { language: "ar", theme: "light" });
  await patient.getByRole("heading", { name: "أطبائي", exact: true }).waitFor();
  await patient.emulateMedia({ reducedMotion: "reduce" });
  const screenshot = resolve(output, "my-doctors-320-ar-light.png"); await patient.screenshot({ path: screenshot, fullPage: true }); report.screenshots.push(screenshot);
  await changePreferences(patient, { language: "en", theme: "dark" });
  stage = "refresh-restart-revoke";
  await patient.reload();
  await patient.getByRole("heading", { name: "Doctor 1", exact: true }).waitFor();
  await fixtures.stopBackend();
  await fixtures.startBackend();
  assert.equal((await record(p1.id, dt1)).status, 200);
  await patient.getByRole("button", { name: "Revoke access", exact: true }).click();
  await patient.getByRole("dialog", { name: "Revoke access" }).getByRole("button", { name: "Revoke access", exact: true }).click();
  await patient.getByRole("main").getByText("Access revoked.", { exact: true }).waitFor();
  await patient.getByText("No doctors currently have access to your records.", { exact: true }).waitFor();
  assert.equal((await record(p1.id, dt1)).status, 404);
  await doctor.goto(base + `/doctor/patients/${p1.id}`);
  await doctor.getByRole("main").getByRole("alert").getByText("This record is unavailable or no authorized relationship exists.").waitFor();
  await patient.getByRole("button", { name: "Sign out", exact: true }).click(); await patient.waitForURL("**/login?returnTo=*");
  await login(patient, emails[4], "patient");
  await patient.getByRole("heading", { name: "Doctor 2", exact: true }).waitFor();
  assert.equal(await patient.getByRole("heading", { name: "Doctor 1", exact: true }).count(), 0);
  report.checks = ["Admin invites two Doctors who activate their accounts", "two Patient accounts", "Doctor code generation", "preview grants no access", "explicit Patient approval", "reuse rejected", "expired code rejected", "second independent pair", "cross-Doctor and cross-Patient isolation", "keyboard navigation", "1440/768/390/320 layouts", "Arabic/English RTL/LTR and light/dark", "reduced motion", "refresh and shared-login return", "PostgreSQL persistence after restart", "revocation and direct record URL denial", "logout/login account isolation"];
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({ status: "PASS", checks: report.checks.length, output }));
} catch (error) {
  let message = String(error.message).replaceAll(password, "[password]");
  for (const email of emails) message = message.replaceAll(email, "[email]");
  report.errors.push({ stage, message });
  console.error("Connection browser test failed at " + stage + ": " + error.name); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await fixtures.close();
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}

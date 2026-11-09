// Real Express + dedicated PostgreSQL test database. No application database writes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { changePreferences, doctorBrowserFixtures } from "./doctor-browser-fixtures.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const chromium = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright").chromium;
const output = resolve(root, "artifacts/doctor-foundation");
await mkdir(output, { recursive: true });
const report = { checks: [], screenshots: [], errors: [], expectedFailures: [] };
const password = randomBytes(24).toString("hex");
const emails = {
  admin: randomUUID() + "@doctor-browser.example.test",
  doctorA: randomUUID() + "@doctor-browser.example.test",
  doctorB: randomUUID() + "@doctor-browser.example.test",
  patientA: randomUUID() + "@doctor-browser.example.test",
  patientB: randomUUID() + "@doctor-browser.example.test",
};
const fixtures = await doctorBrowserFixtures({
  frontendPort: 5194, backendPort: 3314, emails: Object.values(emails), password,
});
const { base, api, pool: db, request: apiRequest } = fixtures;
let browser, page, stage = "setup", expectedFailure = false;

async function loginPage(page, email) {
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[autocomplete=current-password]").fill(password);
  const loginResponse = page.waitForResponse(response => response.url() === api + "/auth/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  assert.equal((await loginResponse).status(), 200, "Browser login must be acknowledged by Express");
  await page.waitForURL(url => url.origin === base && url.pathname.startsWith("/doctor/"));
}

async function navigate(page, path) {
  await page.goto(base + path);
  await page.waitForURL(base + path);
  await page.getByRole("main").getByRole("heading", { level: 1 }).waitFor();
}

async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal overflow");
  const path = resolve(output, name + ".png");
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
}

try {
  const adminToken = await fixtures.start(emails.admin);
  for (const [key, name] of [["doctorA", "Doctor One"], ["doctorB", "Doctor Two"]]) {
    await fixtures.inviteDoctor(adminToken, emails[key], name);
  }
  assert.equal((await fetch(api + "/health/ready")).status, 200);

  for (const [key, name] of [["patientA", "Patient Visible"], ["patientB", "Patient Hidden"]]) {
    const response = await apiRequest("/auth/register", { method: "POST", body: { name, email: emails[key], password } });
    assert.equal(response.status, 201);
  }
  const [doctorAToken, doctorBToken, patientAToken, patientBToken] = await Promise.all([
    fixtures.login(emails.doctorA, "doctor"), fixtures.login(emails.doctorB, "doctor"),
    fixtures.login(emails.patientA, "patient"), fixtures.login(emails.patientB, "patient"),
  ]);
  const users = await db.query("SELECT id,email FROM chroniccare.users WHERE email=ANY($1::text[])", [Object.values(emails)]);
  const id = key => users.rows.find(row => row.email === emails[key]).id;

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
  assert.equal((await apiRequest("/doctor/patients", { token: adminToken })).status, 403);
  const recordPath = `/doctor/patients/${id("patientA")}?date=${today}`;
  assert.equal((await apiRequest(recordPath, { token: doctorAToken })).status, 404);
  const codeResponse = await apiRequest("/connections/codes", { token: doctorAToken, method: "POST" });
  assert.equal(codeResponse.status, 201);
  const { code } = await codeResponse.json();
  assert.equal((await apiRequest("/connections/approve", { token: patientAToken, body: { code } })).status, 204);
  const recordResponse = await apiRequest(recordPath, { token: doctorAToken });
  assert.equal(recordResponse.status, 200);
  const record = await recordResponse.json();
  assert.deepEqual(record.measurements.map(({ systolic, diastolic }) => [systolic, diastolic]), [[128, 82]]);
  assert.equal(record.medications[0].doses[0].takenOn, today);
  assert.equal(record.habits[0].progress, 10);
  const listed = await (await apiRequest("/doctor/patients", { token: doctorAToken })).json();
  assert.deepEqual(listed.patients, [{ id: id("patientA"), name: "Patient Visible" }]);
  assert.equal(JSON.stringify(listed).includes(emails.patientA), false);
  assert.deepEqual((await (await apiRequest("/doctor/patients", { token: doctorBToken })).json()).patients, []);
  assert.equal((await apiRequest(`/doctor/patients/${id("patientB")}?date=${today}`, { token: doctorAToken })).status, 404);
  assert.equal((await apiRequest(`/doctor/patients/${id("patientA")}?date=${today}`, { token: doctorBToken })).status, 404);
  assert.equal((await apiRequest("/doctor/patients", { token: doctorAToken, method: "POST", body: {} })).status, 404);

  browser = await chromium.launch({ channel: "msedge", headless: true });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: "no-preference" });
  await context.addInitScript(() => { localStorage.setItem("cc-language", "en"); localStorage.setItem("cc-theme", "dark"); localStorage.setItem("cc-public-motion", "paused"); });
  page = await context.newPage(); page.setDefaultTimeout(20_000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) {
      const text = message.text();
      const guestProbe = message.location().url === api + "/auth/me" && /Failed to load resource.*401/.test(text) &&
        ["protected-route", "logout-login-persistence", "second-doctor-empty"].includes(stage);
      if (guestProbe || (expectedFailure && /Failed to load resource.*503/.test(text))) report.expectedFailures.push({ stage, message: text });
      else report.errors.push(text);
    }
  });

  stage = "protected-route"; await page.goto(base + "/doctor/patients"); await page.waitForURL("**/login?returnTo=*");
  stage = "doctor-login"; await loginPage(page, emails.doctorA);
  stage = "doctor-dashboard-data";
  await navigate(page, "/doctor/dashboard");
  const main = page.getByRole("main");
  await main.getByRole("heading", { name: "Doctor dashboard", exact: true }).waitFor();
  await main.getByRole("region", { name: "My patients", exact: true }).getByText("1", { exact: true }).waitFor();
  assert.equal(await page.locator('a[href="/patient/measurements"]').count(), 0);
  await navigate(page, "/doctor/patients");
  await page.getByRole("heading", { name: "Patient Visible", exact: true }).waitFor();
  assert.equal(await page.getByText("Patient Hidden", { exact: true }).count(), 0);
  assert.equal((await page.locator("main").textContent()).includes("@doctor-browser"), false);
  const open = page.getByRole("link", { name: "View record" }); await open.focus(); assert(await open.evaluate(element => element === document.activeElement)); await page.keyboard.press("Enter");
  await page.waitForURL(`**/doctor/patients/${id("patientA")}`);
  const pressure = main.getByRole("region", { name: "Recorded measurements" }).getByText(/128\/82\s*mmHg/).first();
  await pressure.waitFor();
  await page.getByText("Visible medicine", { exact: true }).waitFor();
  await page.getByText("Visible walking", { exact: true }).waitFor();
  assert((await page.locator("main").textContent()).includes("1 of 1 doses taken today"));
  assert((await page.locator("main").textContent()).includes("0 of 1 habits completed today"));
  assert.equal(await page.locator("main form, main input, main select, main textarea").count(), 0);
  await shot(page, "doctor-record-primary-1440-en-dark");

  stage = "api-failure"; expectedFailure = true;
  await page.route(api + "/doctor/patients/**", route => route.fulfill({ status: 503, json: { error: { code: "TEST_UNAVAILABLE" } } }));
  await page.reload();
  await main.getByRole("alert").getByText("This record is unavailable or no authorized relationship exists.").waitFor();
  assert.equal(await pressure.count(), 0);
  await page.unroute(api + "/doctor/patients/**"); expectedFailure = false;
  await page.getByRole("button", { name: "Try again" }).click(); await pressure.waitFor();

  stage = "logout-login-persistence";
  await page.getByRole("button", { name: "Sign out", exact: true }).click(); await page.waitForURL("**/login?returnTo=*"); await loginPage(page, emails.doctorA);
  await navigate(page, `/doctor/patients/${id("patientA")}`); await pressure.waitFor();

  stage = "responsive-i18n-themes";
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 960 : 844 });
    for (const language of ["ar", "en"]) {
      for (const theme of ["light", "dark"]) {
        await changePreferences(page, { language, theme });
        await main.getByRole("heading", { name: language === "ar" ? "القياسات المسجلة" : "Recorded measurements", exact: true }).waitFor();
        await shot(page, `doctor-record-${width}-${language}-${theme}`);
      }
    }
  }
  await changePreferences(page, { theme: "system" });
  for (const colorScheme of ["dark", "light"]) { await page.emulateMedia({ colorScheme }); await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, colorScheme); }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);

  stage = "second-doctor-empty";
  await page.getByRole("button", { name: "Sign out", exact: true }).click(); await page.waitForURL("**/login?returnTo=*"); await page.goto(base + "/login"); await loginPage(page, emails.doctorB); await navigate(page, "/doctor/patients");
  await page.getByText("No patients are currently assigned to your account.", { exact: true }).waitFor();
  assert.equal(await page.getByText("Patient Visible", { exact: true }).count(), 0);
  assert.equal((await apiRequest(`/connections/doctors/${id("doctorA")}`, { token: patientAToken, method: "DELETE" })).status, 204);
  assert.equal((await apiRequest(recordPath, { token: doctorAToken })).status, 404);
  await context.close();
  assert.deepEqual(report.errors, []);
  report.checks = [
    "doctor-only authenticated routes", "invitation and account activation", "consent and revocation enforce 404/200/404", "minimum patient identity without email",
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
  report.errors.push(`Integration verification failed at ${stage} (${error.name}).`);
  console.error(report.errors.at(-1)); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  try {
    await fixtures.close();
  } catch (error) {
    report.errors.push(`Test cleanup failed (${error.name}); no credentials logged.`); process.exitCode = 1;
  }
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}

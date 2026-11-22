// Real Express + dedicated PostgreSQL test database. No application database writes.
// Read-only safety check: npm.cmd run test:admin-integration -- --preflight
// After approval: npm.cmd run test:admin-integration -- --allow-test-db-writes
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBrowserDiagnostics } from "./admin-browser-diagnostics.mjs";
import { createLoginNavigationObservation, observeSetupCompletion, prewarmVite, probeFrontendLogin, waitForLoginReadiness } from "./admin-browser-bootstrap.mjs";
import { closeDoctorPageForRestart, seedApplicationPreferences } from "./admin-browser-restart.mjs";

const root = fileURLToPath(new URL("..", import.meta.url)), backend = resolve(root, "../backend");
const require = createRequire(import.meta.url), backendRequire = createRequire(resolve(backend, "package.json"));
const argon2 = backendRequire("argon2");
const env = parseEnv(await readFile(resolve(backend, ".env"), "utf8"));
function databaseTarget(value) {
  try { return new URL(value); } catch { throw new Error("Invalid database URL; connection details withheld"); }
}
const databaseUrl = process.env.TEST_DATABASE_URL || env.TEST_DATABASE_URL;
assert(databaseUrl && databaseTarget(databaseUrl).pathname.endsWith("_test"), "A dedicated test database is required");
const target = databaseTarget(databaseUrl);
const applicationDatabaseUrls = [...new Set([env.DATABASE_URL, process.env.DATABASE_URL].filter(Boolean))];
assert(["postgres:", "postgresql:"].includes(target.protocol), "A PostgreSQL test database is required");
// Reject matching database names even through different host aliases or ports.
assert(applicationDatabaseUrls.length, "Application database identity is required");
for (const value of applicationDatabaseUrls) assert(decodeURIComponent(target.pathname) !== decodeURIComponent(databaseTarget(value).pathname), "Application and test database names must differ");

const preflightOnly = process.argv.includes("--preflight");
assert(process.argv.slice(2).every(argument => argument === "--preflight" || argument === "--allow-test-db-writes"), "Unknown test argument");
assert(preflightOnly || process.argv.includes("--allow-test-db-writes"), "Run --preflight and obtain approval before using --allow-test-db-writes");
const runId = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID();
const base = "http://127.0.0.1:5195", api = "http://127.0.0.1:3315/api", output = resolve(root, "artifacts/admin-foundation", runId);
// Compile the test entry and its actual application dependencies, preserving dist.
const buildRoot = resolve(backend, "node_modules/.cache/admin-browser", runId), dist = resolve(buildRoot, "dist");
const report = { runId, checks: [], screenshots: [], errors: [], expectedFailures: [], serviceLogs: [], preservation: {} };
const adminEmail = runId.toLowerCase() + ".admin@admin-browser.example.test";
const doctorEmail = runId.toLowerCase() + ".doctor@admin-browser.example.test";
const failedEmail = runId.toLowerCase() + ".failed@admin-browser.example.test";
const patientEmail = runId.toLowerCase() + ".patient@admin-browser.example.test";
const adminName = "Admin " + runId, doctorName = "Doctor " + runId, patientName = "Patient " + runId;
const duplicateName = "Duplicate " + runId;
const password = randomBytes(24).toString("hex"), doctorPassword = randomBytes(24).toString("hex");
const testEmails = [adminEmail, doctorEmail, failedEmail, patientEmail];
const sslMode = process.env.DATABASE_SSL || env.DATABASE_SSL || "disable";
assert(["disable", "verify-full"].includes(sslMode), "Invalid database TLS mode");
assert(![...target.searchParams.keys()].some(key => key.toLowerCase().startsWith("ssl")), "Configure TLS using DATABASE_SSL");
const caFile = process.env.DATABASE_SSL_CA_FILE || env.DATABASE_SSL_CA_FILE;
const safetyConfig = { databaseUrl, applicationDatabaseUrls, sslMode, ...(caFile ? { caFile } : {}), runId,
  fixtures: [{ email: adminEmail, name: adminName, role: "admin" }, { email: doctorEmail, name: doctorName, role: "doctor" },
    { email: patientEmail, name: patientName, role: "patient" }] };
const setupSecret = randomBytes(32).toString("hex");
const secrets = new Set([password, doctorPassword, setupSecret, ...testEmails,
  ...Object.entries({ ...env, ...process.env }).filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL/i.test(key)).map(([, value]) => value).filter(Boolean)]);
function redact(value) {
  let text = String(value).replace(/postgres(?:ql)?:\/\/\S+/gi, "[database-url]");
  for (const secret of secrets) text = text.replaceAll(secret, "[redacted]");
  return text;
}
// Do not inherit database/provider secrets or NODE_OPTIONS into child processes.
const childEnvironment = Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "COMSPEC", "PATHEXT", "SystemDrive", "HOME"]
  .filter(key => process.env[key]).map(key => [key, process.env[key]]));
const backendEnvironment = { NODE_ENV: "test", CC_ADMIN_BROWSER_WRITES: "approved" };
const services = [];
const setupTrace = report.setupTrace = { playwright: [], chromium: [], backend: [] };
report.setupTransitions = [];
const setupRequestObjects = new WeakMap();
let nextSetupObject = 0, nextSetupSession = 0;
let browser, page, db, safety, baseline, stage = "setup", cleanupAllowed = false, outputCreated = false, temporaryPassword;
let diagnostics;

function recordBrowserDiagnostics() {
  if (!diagnostics || report.consoleDiagnostics) return;
  const { consoleDiagnostics, networkFailures, pageErrors, restartSnapshots, restartApiRequests } = diagnostics.report();
  report.consoleDiagnostics = consoleDiagnostics;
  report.networkFailures = networkFailures;
  report.pageErrors = pageErrors;
  report.restartSnapshots = restartSnapshots;
  report.restartApiRequests = restartApiRequests;
  report.bootstrapNetworkErrors = networkFailures.filter(entry =>
    (entry.requestStage === "browser-bootstrap" || entry.failureStage === "browser-bootstrap" || entry.responseStage === "browser-bootstrap") && !entry.verifiedStep);
  if (report.bootstrapNetworkErrors.length) report.errors.push("Unverified network failures during browser-bootstrap. See bootstrapNetworkErrors.");
  for (const entry of consoleDiagnostics) {
    if (entry.expected) report.expectedFailures.push(entry);
    else report.errors.push(`Unexpected browser ${entry.type} during ${entry.stage}. See consoleDiagnostics.`);
  }
}

async function preflight() {
  stage = "fresh-backend-and-safety-build";
  await run([resolve(backend, "node_modules/typescript/bin/tsc"), "-p", "tests/tsconfig.admin-browser.json", "--outDir", dist]);
  safety = await import(pathToFileURL(resolve(dist, "tests/support/admin-browser-safety.js")).href);
  stage = "read-only-preflight";
  const inspected = await safety.inspect(safetyConfig, resolve(backend, "migrations"));
  baseline = inspected.baseline;
  report.databaseIsolation = { dedicatedTestName: true, differsFromApplicationName: true, everyConnectionChecked: true, ...inspected.summary };
  report.preservation.before = true;
}

async function start(args, cwd, environment, port, initialize, readinessProbe) {
  const probe = createServer();
  await new Promise((yes, no) => { probe.once("error", no); probe.listen(port, "127.0.0.1", yes); });
  await new Promise(yes => probe.close(yes));
  const child = spawn(process.execPath, args, { cwd, env: { ...childEnvironment, ...environment }, stdio: ["ignore", "pipe", "pipe", ...(initialize ? ["ipc"] : [])] });
  const service = { child, stopped: once(child, "exit") }; services.push(service);
  void service.stopped.catch(() => undefined); // The shutdown path still awaits and reports spawn errors.
  let ready = !initialize, failed = false;
  child.on("message", message => {
    if (message.type === "ready") ready = true;
    if (message.type === "setup-http-observation") {
      const { requestId, browser, event, at, status, finished } = message;
      setupTrace.backend.push({ pid: child.pid, requestId, browser, event, at, status, finished });
    }
    if (["startup-failed", "safety-failure"].includes(message.type)) {
      failed = true; report.errors.push(`Guarded backend rejected work (${message.type}; ${/^[A-Z_]+$/.test(message.code) ? message.code : "no private details"}).`);
      child.kill();
    }
  });
  if (initialize) child.send(initialize);
  // Store stream metadata only; driver/browser output can contain original data.
  for (const [stream, label] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) stream.on("data", () => {
    if (report.serviceLogs.length < 40) report.serviceLogs.push({ port, label, message: "Service output withheld for privacy" });
  });
  for (let attempt = 0; attempt < 120; attempt++) {
    assert.equal(failed, false, "Guarded backend startup or preservation check failed");
    assert.equal(child.exitCode, null, "Test service exited before becoming ready");
    try {
      if (ready) {
        const signal = AbortSignal.timeout(1000);
        if (readinessProbe) { if (await readinessProbe(signal)) return service; }
        else { await fetch("http://127.0.0.1:" + port, { signal }); return service; }
      }
    } catch { /* The service may still be starting. */ }
    await new Promise(yes => setTimeout(yes, 250));
  }
  throw new Error("Test service did not start");
}

async function stop(service) {
  if (!service || service.child.exitCode !== null) return;
  service.child.kill(); await service.stopped;
}

function backendRestartCommand(service, type, expectedReply) {
  const { child } = service;
  return new Promise((resolve, reject) => {
    let acknowledged = false, settled = false;
    const waitForExit = expectedReply === "restart-drained";
    const timer = setTimeout(() => complete(new Error("Backend restart acknowledgement or exit timed out")), 5000);
    function complete(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("message", receive);
      child.off("exit", exited);
      if (error) reject(error); else resolve();
    }
    function exited(code) {
      if (waitForExit && acknowledged && code === 0) complete();
      else complete(new Error("Backend exited without a successful restart acknowledgement"));
    }
    function receive(message) {
      if (message.type === expectedReply) {
        acknowledged = true;
        if (!waitForExit) complete();
      }
      if (message.type === "restart-drain-failed") {
        report.errors.push(`Isolated backend could not prove quiescence during ${type}.`);
        complete(new Error("Backend restart drain refused"));
      }
    }
    child.on("message", receive);
    child.once("exit", exited);
    if (!child.connected) { exited(); return; }
    child.send({ type }, error => { if (error) complete(new Error("Backend restart IPC failed")); });
  });
}

async function run(args, environment = {}) {
  const child = spawn(process.execPath, args, { cwd: backend, env: { ...childEnvironment, ...environment }, stdio: ["ignore", "pipe", "pipe"] });
  const diagnostics = [];
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => diagnostics.push(redact(chunk)));
  assert.equal((await once(child, "exit"))[0], 0, diagnostics.join("").slice(0, 800));
}

async function apiRequest(path, { token, method = "GET", body } = {}) {
  return fetch(api + path, { method, headers: { ...(token ? { Authorization: "Bearer " + token } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

async function loginApi(email, credential = password) {
  const response = await apiRequest("/auth/login", { method: "POST", body: { email, password: credential } });
  assert.equal(response.status, 200);
  const { token } = await response.json(); assert.equal(typeof token, "string"); secrets.add(token); return token;
}

async function loginPage(email, role, credential = password) {
  await page.locator("input[type=email]").fill(email); await page.locator("input[autocomplete=current-password]").fill(credential);
  const response = page.waitForResponse(result => result.url() === api + "/auth/login");
  await page.locator(".auth-card button[type=submit]").click(); assert.equal((await response).status(), 200);
  await page.waitForURL(url => url.origin === base && url.pathname.startsWith(`/${role}/`));
}

async function shot(name) {
  assert.equal(new URL(page.url()).pathname, "/admin/dashboard", "Screenshots require the expected Admin view");
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const path = resolve(output, name + ".png"); await page.screenshot({ path, fullPage: true,
    mask: [page.locator(".admin-doctor-card"), page.locator(".admin-create-card code"), page.locator('input[type="password"]'), page.locator('input[autocomplete="off"]')] }); report.screenshots.push(path);
}

function observeSetupRequest(request, scope, event, detail = {}) {
  if (request.method() !== "GET" || request.url() !== api + "/setup") return;
  if (!setupRequestObjects.has(request)) setupRequestObjects.set(request, ++nextSetupObject);
  setupTrace.playwright.push({ objectId: setupRequestObjects.get(request), trackerId: diagnostics.requestIdentity(request),
    scope, event, at: Date.now(), stage, ...detail });
}

async function observeSetupChromium(context, targetPage) {
  const cdp = await context.newCDPSession(targetPage);
  const session = ++nextSetupSession;
  const observed = new Set();
  const record = (id, event, detail = {}) => {
    setupTrace.chromium.push({ session, id, event, at: Date.now(), stage, ...detail });
  };
  cdp.on("Network.requestWillBeSent", event => {
    if (event.request.method !== "GET" || event.request.url !== api + "/setup") return;
    observed.add(event.requestId);
    record(event.requestId, "requestWillBeSent", { browserAt: Math.round(event.wallTime * 1000) });
  });
  cdp.on("Network.responseReceived", event => {
    if (observed.has(event.requestId)) record(event.requestId, "responseReceived", { status: event.response.status });
  });
  cdp.on("Network.loadingFinished", event => {
    if (observed.has(event.requestId)) record(event.requestId, "loadingFinished");
  });
  cdp.on("Network.loadingFailed", event => {
    if (observed.has(event.requestId)) record(event.requestId, "loadingFailed", { canceled: event.canceled === true,
      code: /^net::ERR_[A-Z_]+$/.test(event.errorText) ? event.errorText : null });
  });
  await cdp.send("Network.enable");
}

async function openTestPage(context, { monitorConsole = false } = {}) {
  const targetPage = await context.newPage();
  targetPage.setDefaultTimeout(30_000);
  targetPage.on("request", diagnostics.onRequest);
  targetPage.on("response", diagnostics.onResponse);
  targetPage.on("requestfinished", diagnostics.onRequestFinished);
  targetPage.on("requestfailed", diagnostics.onRequestFailed);
  targetPage.on("pageerror", error => {
    report.errors.push(`Unexpected browser runtime error during ${stage}. See pageErrors.`);
    diagnostics.onPageError(error, targetPage.url());
  });
  if (monitorConsole) targetPage.on("console", diagnostics.onConsole);
  targetPage.on("request", request => observeSetupRequest(request, "page", "request"));
  targetPage.on("response", response => observeSetupRequest(response.request(), "page", "response", { status: response.status() }));
  targetPage.on("requestfinished", request => observeSetupRequest(request, "page", "requestfinished"));
  targetPage.on("requestfailed", request => observeSetupRequest(request, "page", "requestfailed"));
  await observeSetupChromium(context, targetPage);
  return targetPage;
}

async function waitForSetupTransition(name, action, waitForUi = () => waitForLoginForm(30_000)) {
  const result = { name, stage, method: "GET", path: "/api/setup", uiReady: false, outcome: "incomplete" };
  report.setupTransitions.push(result);
  const observed = observeSetupCompletion();
  const start = request => {
    if (request.method() === "GET" && request.url() === api + "/setup" && request.frame() === page.mainFrame()) {
      observed.start(request, diagnostics.requestIdentity(request), stage);
    }
  };
  const response = value => observed.event(value.request(), "response", value.status());
  const finished = request => observed.event(request, "requestfinished");
  const failed = request => observed.event(request, "requestfailed");
  const listeners = [["request", start], ["response", response], ["requestfinished", finished], ["requestfailed", failed]];
  for (const [event, handler] of listeners) page.on(event, handler);
  try {
    await action();
    await waitForUi();
    result.uiReady = true;
    const deadline = performance.now() + 5000;
    while (observed.state() === "pending" && performance.now() < deadline) await delay(25);
    const state = observed.state();
    result.outcome = state === "pending" ? "timeout" : state;
    assert.equal(result.outcome, "finished", "GET /api/setup must finish before the next navigation");
  } finally {
    result.requests = observed.snapshot();
    for (const [event, handler] of listeners) page.off(event, handler);
  }
}

async function waitForLoginForm(timeout, additionalElements = []) {
  const form = page.locator(".auth-card form");
  const submit = form.locator('button[type="submit"]');
  await Promise.all([form, form.locator('input[autocomplete="username"]'),
    form.locator('input[autocomplete="current-password"]'), submit, ...additionalElements]
    .map(locator => locator.waitFor({ state: "visible", timeout })));
  assert(await submit.isEnabled(), "Login submit must be enabled");
}

async function verifyInitialLoginPage(context) {
  const loginUrl = base + "/login";
  const observation = createLoginNavigationObservation();
  const isLoginDocument = request => request.isNavigationRequest() && request.url() === loginUrl;
  const isPageResource = request => !["fetch", "xhr"].includes(request.resourceType());
  const requested = request => { if (isLoginDocument(request)) observation.requestDocument(); };
  const responded = response => {
    if (isLoginDocument(response.request())) observation.receiveDocument(response.status());
    else if (response.status() >= 400 && isPageResource(response.request())) observation.failResource();
  };
  const requestFailed = request => {
    if (isLoginDocument(request)) observation.failDocument(request.failure()?.errorText);
    else if (isPageResource(request)) observation.failResource();
  };
  const domReady = () => { if (page.url() === loginUrl) observation.domReady(); };
  const loaded = () => { if (page.url() === loginUrl) observation.loaded(); };
  const listeners = [["request", requested], ["response", responded], ["requestfailed", requestFailed],
    ["domcontentloaded", domReady], ["load", loaded], ["pageerror", observation.javascriptError]];
  for (const [event, handler] of listeners) page.on(event, handler);
  try {
    assert(!(await context.cookies(api)).some(cookie => cookie.name === "cc_session"), "Initial login navigation must be anonymous");
    const verifyAnonymousSession = diagnostics.beginAuthDenial("initial-login-navigation");
    const navigationStarted = performance.now();
    await waitForLoginReadiness({
      navigate: options => page.goto(loginUrl, options),
      async waitForUi(timeout) {
        const setupLink = page.getByRole("link", { name: "First-time Admin setup", exact: true });
        await waitForLoginForm(timeout, [setupLink]);
        assert.equal(page.url(), loginUrl);
      },
      observation,
    });
    report.loginUiReadyMs = Math.round(performance.now() - navigationStarted);
    await verifyAnonymousSession();
  } finally {
    report.loginNavigation = observation.snapshot();
    for (const [event, handler] of listeners) page.off(event, handler);
  }
}

async function verifyBrowser() {
  const chromium = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright").chromium;
  await mkdir(output, { recursive: true }); outputCreated = true;
  await safety.audit(safetyConfig, baseline); cleanupAllowed = true;
  db = await safety.guardedPool(safetyConfig, baseline, code => report.errors.push(`Parent safety guard: ${code}`));
  const initialize = { type: "start", config: safetyConfig, baseline, setupSecret, origin: base, port: 3315 };
  const backendEntry = resolve(dist, "tests/support/admin-browser-server.js");
  let backendService = await start([backendEntry], backend, backendEnvironment, 3315, initialize);
  assert.equal((await fetch(api + "/health/ready")).status, 200);
  stage = "frontend-startup";
  await start(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5195", "--strictPort"], root, { VITE_API_URL: api }, 5195, undefined, async signal => {
    report.frontendProbe = await probeFrontendLogin(fetch, base + "/login", signal);
    return report.frontendProbe.outcome === "html-shell-ready";
  });
  stage = "vite-prewarm";
  report.prewarm = await prewarmVite(base);
  assert(report.prewarm.ready, "Vite prewarm failed");
  browser = await chromium.launch({ channel: "msedge", headless: true }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
  await context.addInitScript(seedApplicationPreferences, new URL(base).origin);
  diagnostics = createBrowserDiagnostics({ base, api, getStage: () => stage });
  context.on("requestfinished", diagnostics.onContextRequestFinished);
  context.on("requestfailed", diagnostics.onContextRequestFailed);
  context.on("request", request => observeSetupRequest(request, "context", "request"));
  context.on("response", response => observeSetupRequest(response.request(), "context", "response", { status: response.status() }));
  context.on("requestfinished", request => observeSetupRequest(request, "context", "requestfinished"));
  context.on("requestfailed", request => observeSetupRequest(request, "context", "requestfailed"));
  stage = "browser-bootstrap";
  page = await openTestPage(context, { monitorConsole: true });
  await verifyInitialLoginPage(context);
  await page.getByRole("link", { name: "First-time Admin setup" }).click();
  await page.locator('input[autocomplete="off"]').fill(setupSecret);
  await page.locator('input[autocomplete="name"]').fill(adminName);
  await page.locator('input[type="email"]').fill(adminEmail);
  await page.locator('input[autocomplete="new-password"]').first().fill(password);
  await page.locator('input[autocomplete="new-password"]').last().fill(password);
  await waitForSetupTransition("after-admin-creation", async () => {
    const setupResponse = page.waitForResponse(response => response.url() === api + "/setup" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Create Admin", exact: true }).click();
    assert.equal((await setupResponse).status(), 201);
    await page.waitForURL("**/login?setup=1");
  });
  assert.deepEqual(await (await apiRequest("/setup")).json(), { available: false });
  assert(!(await context.cookies(api)).some(cookie => cookie.name === "cc_session"), "Bootstrap must not open an authenticated browser session");
  const verifyClosedSetupSession = diagnostics.beginAuthDenial("closed-setup-navigation");
  await waitForSetupTransition("closed-setup-before-registration", async () => {
    await page.goto(base + "/setup");
  }, async () => {
    await page.getByText("Initial setup is closed. Sign in with your existing account.", { exact: true }).waitFor();
    assert.equal(await page.locator("form").count(), 0);
    await verifyClosedSetupSession();
  });
  const verifyRegisterSession = diagnostics.beginAuthDenial("anonymous-registration-navigation");
  await page.goto(base + "/register");
  await page.locator('input[autocomplete="name"]').fill(patientName);
  await verifyRegisterSession();
  await page.locator('input[type="email"]').fill(patientEmail);
  await page.locator('input[autocomplete="new-password"]').first().fill(password);
  await page.locator('input[autocomplete="new-password"]').last().fill(password);
  await page.locator('.auth-card button[type="submit"]').click();
  await page.waitForURL("**/login?registered=1");
  const patientToken = await loginApi(patientEmail), adminToken = await loginApi(adminEmail);
  const adminId = (await (await apiRequest("/auth/me", { token: adminToken })).json()).user.id;
  const fixtureHeaders = { "Access-Control-Allow-Origin": base, "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": "X-Account-ID", "X-Account-ID": adminId };
  assert.equal((await apiRequest("/admin/doctors")).status, 401);
  assert.equal((await apiRequest("/admin/doctors", { token: patientToken })).status, 403);
  for (const path of ["/admin/doctors", "/admin/doctors/direct"]) {
    assert.equal((await apiRequest(path, { method: "POST", body: { name: "Rejected", email: failedEmail } })).status, 401);
    assert.equal((await apiRequest(path, { token: patientToken, method: "POST", body: { name: "Rejected", email: failedEmail } })).status, 403);
    assert.equal((await apiRequest(path, { token: adminToken, method: "POST", body: {
      name: "Injected", email: failedEmail, password, role: "admin",
    } })).status, 400);
  }
  for (const input of [{ name: " ", email: failedEmail }, { name: "Rejected", email: "invalid" }]) {
    assert.equal((await apiRequest("/admin/doctors/direct", { token: adminToken, method: "POST", body: input })).status, 400);
  }
  assert.equal((await apiRequest("/auth/register", { method: "POST", body: {
    name: "Escalation", email: failedEmail, password, role: "doctor",
  } })).status, 400);
  const initialDoctors = (await (await apiRequest("/admin/doctors", { token: adminToken })).json()).doctors;

  const releaseDoctorList = Promise.withResolvers();
  await page.route(api + "/admin/doctors", async route => {
    if (route.request().method() === "GET") {
      await releaseDoctorList.promise;
      return route.fulfill({ status: 200, headers: fixtureHeaders, json: { doctors: [] } });
    }
    return route.continue();
  });
  try {
    stage = "protected-route";
    assert(!(await context.cookies(api)).some(cookie => cookie.name === "cc_session"), "Protected navigation must start without a session cookie");
    const verifyAnonymousNavigation = diagnostics.beginAuthDenial("anonymous-protected-navigation");
    await page.goto(base + "/admin/dashboard"); await page.waitForURL("**/login?returnTo=*");
    await verifyAnonymousNavigation();
    stage = "admin-login";
    await loginPage(adminEmail, "admin");
    await page.locator(".admin-list-section .ui-feedback-loading").waitFor();
  } finally {
    releaseDoctorList.resolve();
  }
  await page.getByText("No Doctor accounts exist yet.", { exact: true }).waitFor();
  await page.unroute(api + "/admin/doctors");
  await page.evaluate(async () => { const module = await import("/src/lib/query/queryClient.ts"); await module.queryClient.invalidateQueries({ queryKey: ["admin", "doctors"] }); });
  await page.waitForFunction(count => document.querySelectorAll(".admin-doctor-card").length === count, initialDoctors.length);
  assert.equal(await page.locator('a[href^="/patient/"]').count(), 0); assert.equal(await page.locator('a[href^="/doctor/"]').count(), 0);
  assert.equal(await page.locator(".admin-doctor-card").count(), initialDoctors.length);
  for (const path of ["/doctor/patients", "/measurements"]) assert.equal((await apiRequest(path, { token: adminToken })).status, 403);
  await page.goto(base + "/doctor/dashboard"); await page.waitForURL("**/admin/dashboard"); await page.locator(".admin-page").waitFor();

  stage = "client-validation";
  await page.locator(".admin-open-create").click();
  await page.locator(".admin-create-card").waitFor({ state: "visible" });
  assert.equal(await page.locator(".admin-create-card input[type=password]").count(), 0);
  let invalidSubmissions = 0;
  const countInvalid = request => { if (request.method() === "POST" && request.url().startsWith(api + "/admin/doctors")) invalidSubmissions++; };
  page.on("request", countInvalid);
  await page.locator(".admin-create-card button[type=submit]").click();
  await page.locator('.admin-create-card input[autocomplete=name][aria-invalid="true"]').waitFor();
  assert.equal(await page.locator('.admin-create-card input[aria-invalid="true"]').count(), 2);
  await page.locator(".admin-create-card input[autocomplete=name]").fill(doctorName);
  await page.locator(".admin-create-card input[type=email]").fill("invalid");
  await page.locator('.admin-create-card input[type=email][aria-invalid="false"]').waitFor();
  await page.locator(".admin-create-card button[type=submit]").click();
  await page.waitForFunction(() => document.activeElement?.matches('.admin-create-card input[type=email][aria-invalid="true"]'));
  assert.equal(await page.locator('.admin-create-card input[aria-invalid="true"]').count(), 1);
  assert.equal(await page.locator('.admin-create-card input[type=email]').getAttribute("aria-invalid"), "true");
  assert.equal(await page.locator('.admin-create-card input[type=email]').evaluate(element => element === document.activeElement), true);
  assert.equal(invalidSubmissions, 0); page.off("request", countInvalid);

  stage = "create-doctor";
  await page.locator(".admin-create-card input[type=email]").fill(doctorEmail);
  const createdResponse = page.waitForResponse(response => response.url() === api + "/admin/doctors/direct" && response.request().method() === "POST");
  await page.locator(".admin-create-card button[type=submit]").click();
  const createdResult = await createdResponse; assert.equal(createdResult.status(), 201);
  const createdBody = await createdResult.json();
  temporaryPassword = createdBody.temporaryPassword;
  assert.equal(typeof temporaryPassword, "string"); secrets.add(temporaryPassword);
  assert(temporaryPassword.length >= 32 && temporaryPassword.length <= 128, "Backend must generate a strong temporary password");
  assert.equal(createdResult.headers()["cache-control"], "no-store");
  assert.deepEqual(createdResult.request().postDataJSON(), { name: doctorName, email: doctorEmail });
  assert.equal(createdBody.doctor.role, "doctor");
  await page.locator(".temporary-credential input").waitFor();
  assert((await page.locator(".temporary-credential input").inputValue()) === temporaryPassword, "Displayed temporary password must match the response");
  assert.equal(await page.locator(".temporary-credential input").getAttribute("type"), "password", "Temporary credential is masked by default");
  await page.getByText(doctorName, { exact: true }).waitFor(); await page.locator(".admin-create-card .ui-feedback-success").first().waitFor();
  assert.equal((await page.locator("main").textContent()).includes(password), false);
  assert.equal(await page.locator(".admin-doctor-card").count(), initialDoctors.length + 1);
  const createdAccount = await db.query("SELECT id,role,password_hash,must_change_password FROM chroniccare.users WHERE email=$1", [doctorEmail]);
  assert.equal(createdAccount.rowCount, 1); assert.equal(createdAccount.rows[0].id, createdBody.doctor.id);
  assert.equal(createdAccount.rows[0].role, "doctor"); assert.match(createdAccount.rows[0].password_hash, /^\$argon2id\$/);
  assert.equal(createdAccount.rows[0].must_change_password, true);
  assert(await argon2.verify(createdAccount.rows[0].password_hash, temporaryPassword), "Stored hash must verify the generated password");
  const doctorList = await (await apiRequest("/admin/doctors", { token: adminToken })).json();
  assert(!JSON.stringify(doctorList).includes(temporaryPassword), "Doctor list must not disclose the temporary password");
  assert(!JSON.stringify(doctorList).includes(createdAccount.rows[0].password_hash), "Doctor list must not disclose password hashes");
  assert.equal((await db.query("SELECT 1 FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1", [createdAccount.rows[0].id])).rowCount, 0);
  await page.locator("dialog[open] .dialog-heading button").click();
  await page.locator(".admin-open-create").click(); await page.locator(".admin-create-card").waitFor({ state: "visible" });
  assert.equal(await page.locator(".temporary-credential input").count(), 0);
  assert.equal((await page.locator("body").textContent()).includes(temporaryPassword), false);
  assert.equal(await page.evaluate(value => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(item => item.includes(value)), temporaryPassword), false);
  await page.locator("dialog[open] .dialog-heading button").click();
  await shot("admin-doctors-1280-en-dark");

  stage = "duplicate-email";
  await page.locator(".admin-open-create").click();
  await page.locator(".admin-create-card input[autocomplete=name]").fill(duplicateName);
  await page.locator(".admin-create-card input[type=email]").fill(doctorEmail);
  const duplicateResponse = page.waitForResponse(response => response.url() === api + "/admin/doctors/direct" && response.request().method() === "POST");
  await page.locator(".admin-create-card button[type=submit]").click();
  const duplicateResult = await duplicateResponse;
  assert.equal(duplicateResult.status(), 409);
  await page.getByText("An account with this email already exists.", { exact: true }).waitFor();
  assert.equal((await db.query("SELECT 1 FROM chroniccare.users WHERE email=$1", [doctorEmail])).rowCount, 1);
  assert.equal(await page.locator(".admin-create-card .ui-feedback-success").count(), 0);
  assert.equal(await page.locator(".admin-doctor-card").count(), initialDoctors.length + 1);
  diagnostics.verifyFailure(duplicateResult, "duplicate-email");

  stage = "failed-create-no-false-success";
  await page.locator(".admin-create-card input[type=email]").fill(failedEmail);
  await page.route(api + "/admin/doctors/direct", route => route.request().method() === "POST"
    ? route.fulfill({ status: 503, headers: fixtureHeaders, json: { error: { code: "TEST_UNAVAILABLE" } } }) : route.continue());
  const failedResponse = page.waitForResponse(response => response.url() === api + "/admin/doctors/direct" && response.request().method() === "POST" && response.status() === 503);
  await page.locator(".admin-create-card button[type=submit]").click();
  const failedResult = await failedResponse;
  await page.getByText("The Doctor account could not be created. No false success was saved.", { exact: true }).waitFor();
  assert.equal((await db.query("SELECT 1 FROM chroniccare.users WHERE email=$1", [failedEmail])).rowCount, 0);
  assert.equal(await page.locator(".admin-create-card .ui-feedback-success").count(), 0);
  assert.equal(await page.locator(".admin-doctor-card").count(), initialDoctors.length + 1);
  diagnostics.verifyFailure(failedResult, "failed-create-no-false-success");
  await page.unroute(api + "/admin/doctors/direct");

  stage = "invitation-remains-separate";
  await page.getByRole("button", { name: "Email activation invitation", exact: true }).first().click();
  const invitationResponse = page.waitForResponse(response => response.url() === api + "/admin/doctors" && response.request().method() === "POST");
  await page.locator(".admin-create-card button[type=submit]").click();
  const invitationResult = await invitationResponse;
  assert.equal(invitationResult.status(), 503);
  assert.deepEqual(invitationResult.request().postDataJSON(), { name: duplicateName, email: failedEmail });
  assert.equal((await invitationResult.json()).error.code, "EMAIL_UNAVAILABLE");
  await page.getByText("Email delivery is not configured. Contact the clinic administrator.", { exact: true }).waitFor();
  assert.equal(await page.locator(".admin-create-card .ui-feedback-success").count(), 0);
  assert.equal((await db.query("SELECT 1 FROM chroniccare.users WHERE email=$1", [failedEmail])).rowCount, 0);
  diagnostics.verifyFailure(invitationResult, "invitation-remains-separate");
  await page.locator(".admin-create-card").getByRole("button", { name: "Create with a temporary password", exact: true }).click();
  await page.locator("dialog[open] .dialog-heading button").click();

  stage = "responsive-arabic";
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator(".header-preferences-button").click();
  await page.locator("dialog[open] .language-toggle").click();
  await page.waitForFunction(() => document.documentElement.lang === "ar" && document.documentElement.dir === "rtl");
  await page.locator("dialog[open] .theme-select").selectOption("light");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
  await page.locator("dialog[open] .dialog-heading button").click(); await shot("admin-doctors-390-ar-light");
  await page.locator(".header-preferences-button").click(); await page.locator("dialog[open] .theme-select").selectOption("system");
  for (const colorScheme of ["dark", "light"]) { await page.emulateMedia({ colorScheme }); await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, colorScheme); }
  await page.locator("dialog[open] .dialog-heading button").click();
  await page.emulateMedia({ reducedMotion: "reduce" }); assert(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
  await page.locator(".admin-open-create").click(); await page.locator(".admin-create-card").waitFor({ state: "visible" });
  const nameInput = page.locator(".admin-create-card input[autocomplete=name]"); await nameInput.focus(); assert(await nameInput.evaluate(element => element === document.activeElement));
  await shot("admin-create-390-ar-system");
  await page.locator("dialog[open] .dialog-heading button").click();
  await page.locator(".header-preferences-button").click(); await page.locator("dialog[open] .language-toggle").click();
  await page.waitForFunction(() => document.documentElement.lang === "en" && document.documentElement.dir === "ltr");
  await page.locator("dialog[open] .dialog-heading button").click();
  await page.setViewportSize({ width: 1280, height: 900 });

  stage = "temporary-doctor-login";
  await waitForSetupTransition("after-admin-logout", async () => {
    const adminLogout = page.waitForResponse(response => response.url() === api + "/auth/logout" && response.request().method() === "POST");
    await page.locator(".session-bar button").click(); await page.waitForURL("**/login?returnTo=*");
    assert.equal((await adminLogout).status(), 204);
  });
  assert(!(await context.cookies(api)).some(cookie => cookie.name === "cc_session"), "Login navigation must follow session-cookie removal");
  const verifySignedOutNavigation = diagnostics.beginAuthDenial("signed-out-login-navigation");
  await waitForSetupTransition("signed-out-login-before-doctor-login", async () => {
    await page.goto(base + "/login");
    await verifySignedOutNavigation();
  });
  await loginPage(doctorEmail, "doctor", temporaryPassword);
  await page.getByRole("heading", { name: "Change your temporary password before continuing", exact: true }).waitFor();
  assert.equal(await page.locator(".doctor-page").count(), 0);
  const temporaryToken = await loginApi(doctorEmail, temporaryPassword);
  const temporaryIdentity = await (await apiRequest("/auth/me", { token: temporaryToken })).json();
  assert.equal(temporaryIdentity.user.mustChangePassword, true);
  for (const path of ["/doctor/patients", "/admin/doctors", "/measurements"]) {
    const denied = await apiRequest(path, { token: temporaryToken });
    assert.equal(denied.status, 403); assert.equal((await denied.json()).error.code, "PASSWORD_CHANGE_REQUIRED");
  }

  stage = "forced-password-change";
  const changeForm = page.locator("form").filter({ has: page.locator('input[autocomplete="current-password"]') });
  await changeForm.locator('input[autocomplete="current-password"]').fill(temporaryPassword);
  await changeForm.locator('input[autocomplete="new-password"]').first().fill(doctorPassword);
  await changeForm.locator('input[autocomplete="new-password"]').last().fill(doctorPassword + "mismatch");
  let invalidChanges = 0;
  const countChange = request => { if (request.url() === api + "/auth/change-password") invalidChanges++; };
  page.on("request", countChange);
  await changeForm.locator('button[type="submit"]').click();
  await changeForm.getByText("Check your current password and use matching new passwords of at least 12 characters.", { exact: true }).waitFor();
  assert.equal(invalidChanges, 0); page.off("request", countChange);
  assert.equal((await apiRequest("/auth/change-password", { token: temporaryToken, method: "POST", body: {
    currentPassword: temporaryPassword, password: temporaryPassword,
  } })).status, 400);
  assert.equal((await apiRequest("/auth/change-password", { token: temporaryToken, method: "POST", body: {
    currentPassword: password, password: doctorPassword,
  } })).status, 401);
  assert.equal((await db.query("SELECT must_change_password FROM chroniccare.users WHERE email=$1", [doctorEmail])).rows[0].must_change_password, true);
  await changeForm.locator('input[autocomplete="new-password"]').last().fill(doctorPassword);
  const verifyRevokedLogout = diagnostics.beginAuthDenial("logout-after-password-change");
  const changedResponse = page.waitForResponse(response => response.url() === api + "/auth/change-password" && response.request().method() === "POST");
  await changeForm.locator('button[type="submit"]').click(); assert.equal((await changedResponse).status(), 204);
  await page.waitForURL("**/login?returnTo=*");
  const updated = (await db.query("SELECT password_hash,must_change_password FROM chroniccare.users WHERE email=$1", [doctorEmail])).rows[0];
  assert.equal(updated.must_change_password, false);
  assert(await argon2.verify(updated.password_hash, doctorPassword), "New password must be hashed and persisted");
  assert.equal((await db.query("SELECT 1 FROM chroniccare.sessions WHERE user_id=$1", [createdAccount.rows[0].id])).rowCount, 0);
  assert.equal((await apiRequest("/auth/me", { token: temporaryToken })).status, 401);
  assert.equal((await apiRequest("/auth/login", { method: "POST", body: { email: doctorEmail, password: temporaryPassword } })).status, 401);
  assert(!(await context.cookies(api)).some(cookie => cookie.name === "cc_session"), "Password change must remove the session cookie");
  await verifyRevokedLogout();

  stage = "doctor-login";
  await loginPage(doctorEmail, "doctor", doctorPassword);
  await page.locator(".doctor-page").waitFor();
  assert.equal(await page.locator('input[autocomplete="new-password"]').count(), 0);
  const doctorToken = await loginApi(doctorEmail, doctorPassword);
  assert.equal((await (await apiRequest("/auth/me", { token: doctorToken })).json()).user.mustChangePassword, false);
  assert.equal((await apiRequest("/admin/doctors", { token: doctorToken })).status, 403);
  assert.equal((await apiRequest("/admin/doctors/direct", { token: doctorToken, method: "POST", body: { name: "Rejected", email: failedEmail } })).status, 403);
  assert.equal((await apiRequest("/measurements", { token: doctorToken })).status, 403);
  assert.deepEqual((await (await apiRequest("/doctor/patients", { token: doctorToken })).json()).patients, []);
  await page.goto(base + "/admin/dashboard"); await page.waitForURL("**/doctor/dashboard"); await page.locator(".doctor-page").waitFor();
  assert.equal(await page.locator(".admin-page").count(), 0);

  stage = "backend-restart-persistence";
  report.backendRestart = { armed: false, drained: false };
  const assertBrowserIdle = () => assert.equal(diagnostics.pendingApiRequests(), 0, "Browser API requests must settle before closing the page");
  await closeDoctorPageForRestart({ page, context, api,
    async waitForIdle() {
      diagnostics.captureRestartSnapshot("before-page-close");
      const idleDeadline = Date.now() + 5000;
      while (diagnostics.pendingApiRequests() > 0 && Date.now() < idleDeadline) await delay(25);
      if (diagnostics.pendingApiRequests() > 0) diagnostics.captureRestartSnapshot("wait-timeout");
      assertBrowserIdle();
    },
    assertIdle: assertBrowserIdle,
    async armBackend() {
      await backendRestartCommand(backendService, "arm-restart-drain", "restart-drain-armed");
      report.backendRestart.armed = true;
    },
    async drainBackend() {
      diagnostics.captureRestartSnapshot("after-page-close");
      await backendRestartCommand(backendService, "drain-for-restart", "restart-drained");
      report.backendRestart.drained = true;
    },
  });
  diagnostics.endRestartObservation();
  services.splice(services.indexOf(backendService), 1);
  backendService = await start([backendEntry], backend, backendEnvironment, 3315, { ...initialize, setupSecret: "" });
  assert.equal((await fetch(api + "/health/ready")).status, 200);
  report.backendRestart.restarted = true;
  const persistedDoctorToken = await loginApi(doctorEmail, doctorPassword);
  assert.deepEqual((await (await apiRequest("/doctor/patients", { token: persistedDoctorToken })).json()).patients, []);
  const persistedAdminToken = await loginApi(adminEmail);
  assert((await (await apiRequest("/admin/doctors", { token: persistedAdminToken })).json()).doctors.some(doctor => doctor.email === doctorEmail));
  assert.deepEqual(await (await apiRequest("/setup")).json(), { available: false });
  report.backendRestart.accountsPersisted = true;
  page = await openTestPage(context, { monitorConsole: true });
  const [patientsAfterRestart, notificationsAfterRestart] = await Promise.all([
    page.waitForResponse(response => response.url() === api + "/doctor/patients" && response.request().method() === "GET"),
    page.waitForResponse(response => response.url() === api + "/notifications/unread-count" && response.request().method() === "GET"),
    page.goto(base + "/doctor/dashboard"),
  ]);
  assert.equal(patientsAfterRestart.status(), 200);
  assert.deepEqual((await patientsAfterRestart.json()).patients, []);
  assert.equal(notificationsAfterRestart.status(), 200);
  assert(Number.isInteger((await notificationsAfterRestart.json()).unreadCount));
  await page.locator(".doctor-page .clinical-roster").waitFor();
  report.backendRestart.browserSessionPersisted = true;

  stage = "expired-session-and-patient-login";
  assert((await safety.ownedIds(db, safetyConfig, baseline)).includes(createdAccount.rows[0].id));
  await db.query("UPDATE chroniccare.sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1", [createdAccount.rows[0].id]);
  const verifyExpiredFocus = diagnostics.beginAuthDenial("expired-session-focus");
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await page.waitForURL("**/login?returnTo=*");
  assert.equal(await page.evaluate(async () => {
    const module = await import("/src/lib/query/queryClient.ts"); return module.queryClient.getQueryCache().getAll().length;
  }), 0);
  await verifyExpiredFocus();
  await loginPage(patientEmail, "patient");
  await page.locator(".session-bar button").click(); await page.waitForURL("**/login?returnTo=*");
  assert.equal(await page.evaluate(async () => {
    const module = await import("/src/lib/query/queryClient.ts"); return module.queryClient.getQueryCache().getAll().length;
  }), 0);

  await context.close();
  recordBrowserDiagnostics();
  assert.deepEqual(report.errors, []);
  report.checks = [
    "browser bootstrap creates the first Admin and then closes", "Admin-only Doctor list and creation", "server-fixed Doctor role",
    "generated temporary password displayed once and excluded from storage, lists and screenshots", "Argon2id verifies temporary and replacement passwords",
    "client and server input validation", "duplicate and invalid input handling", "Patient and Doctor role rejection",
    "public registration cannot request privileged roles", "Doctor shared-login redirect", "new Doctor has no patient relationships or access",
    "API failure produces no false success", "account and role persistence after backend restart", "keyboard focus",
    "Arabic/English RTL/LTR responsive UI", "light/dark/system and reduced-motion support",
    "Patient browser registration and login", "expired session and logout clear protected caches",
    "temporary Doctor cannot access protected APIs or dashboard", "forced password change validates and returns to login",
    "password change revokes all existing sessions and invalidates the temporary password", "new password and browser session survive backend restart",
    "invitation uses its separate endpoint and reports unavailable email without creating an account",
  ];
  report.status = "PASS";
}

try {
  await preflight();
  if (preflightOnly) {
    console.log(JSON.stringify({ status: "PREFLIGHT_PASS", ...report.databaseIsolation, migrationsRun: false, dataChanged: false }));
  } else await verifyBrowser();
} catch (error) {
  // An unexpected view may show original records outside the known masks.
  report.failureLocation = error.stack?.match(/admin-integration-browser\.mjs:\d+:\d+/)?.[0];
  report.failureStage = stage; report.status = "FAIL";
  report.errors.push(`Integration verification failed (${error.name}; ${/^[A-Z_]+$/.test(error.code) ? error.code : "no private details"}).`);
  console.error(report.errors.at(-1)); process.exitCode = 1;
} finally {
  try { if (browser) await browser.close(); }
  catch { report.status = "FAIL"; report.errors.push("Browser shutdown failed."); process.exitCode = 1; }
  recordBrowserDiagnostics();
  for (const service of services.reverse()) {
    try { await stop(service); }
    catch { report.status = "FAIL"; report.errors.push("Test service shutdown failed."); process.exitCode = 1; }
  }
  try {
    await db?.end();
    if (cleanupAllowed) {
      report.cleanup = "Not attempted until original-data preservation is verified";
      await safety.audit(safetyConfig, baseline); report.preservation.afterTest = true;
      await safety.cleanup(safetyConfig, baseline); report.preservation.afterCleanup = true;
      report.cleanup = "Validated current-run user IDs only; original rows and all other tables unchanged";
    }
  }
  catch (error) { report.status = "FAIL"; report.errors.push(`Preservation verification or exact-ID cleanup failed (${error.name}); no private details logged.`); process.exitCode = 1; }
  if (report.errors.length) { report.status = "FAIL"; process.exitCode = 1; }
  if (outputCreated) await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  if (report.status === "PASS") console.log(JSON.stringify({ status: "PASS", checks: report.checks.length, screenshots: report.screenshots.length, output }));
}

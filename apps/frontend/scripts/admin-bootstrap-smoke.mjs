// Standalone login diagnostic. Run from any directory with Node and Playwright installed.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { loginStartupTimeout, prewarmVite, probeFrontendLogin } from "./admin-browser-bootstrap.mjs";
import { seedApplicationPreferences } from "./admin-browser-restart.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const origin = "http://127.0.0.1:5195";
const loginUrl = origin + "/login";
const mockOrigin = "http://127.0.0.1:1";
const output = resolve(root, "artifacts/admin-bootstrap-smoke", new Date().toISOString().replace(/[:.]/g, "-"), "report.json");
const report = { status: "FAIL", stage: "vite-startup", budgetMs: loginStartupTimeout, vite: [],
  document: {}, events: {}, chromium: {}, apiMocks: [], blocked: [], console: [], pageErrors: [] };
const fixtures = new Map([
  ["/api/auth/me", { status: 401, json: { error: { code: "UNAUTHENTICATED" } } }],
  ["/api/setup", { status: 200, json: { available: true } }],
]);
const safeTransports = new Set(["net::ERR_ABORTED", "net::ERR_BLOCKED_BY_CLIENT", "net::ERR_CONNECTION_REFUSED",
  "net::ERR_CONNECTION_RESET", "net::ERR_EMPTY_RESPONSE", "net::ERR_FAILED", "net::ERR_TIMED_OUT"]);
const transport = value => safeTransports.has(value) ? value : "withheld";
const exceptionTypes = new Set(["Error", "SecurityError", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "AbortError"]);
const resourceTypes = new Set(["document", "script", "stylesheet", "font", "image", "xhr", "fetch"]);
let vite, browser, navigationStarted, phaseStarted = performance.now();
const since = start => Math.round(performance.now() - start);
const elapsed = () => since(navigationStarted);
const assets = new Map();
const cdpDocuments = new Map();

function safePath(value) {
  try {
    const url = new URL(value);
    if (url.origin === mockOrigin && fixtures.has(url.pathname)) return url.pathname;
    if (url.origin !== origin) return "[nonlocal]";
    if (["/login", "/@vite/client", "/@react-refresh", "/favicon.svg", "/fonts/cairo/Cairo-Variable.ttf"].includes(url.pathname)) return url.pathname;
    if (/^\/(?:src|node_modules\/\.vite\/deps)\/[a-z0-9_./-]+\.(?:[cm]?[jt]sx?|css)$/i.test(url.pathname)) return url.pathname;
  } catch { /* Some browser messages have no source URL. */ }
  return "[withheld]";
}

async function startVite() {
  // Refuse to attach to a previously running server on the integration port.
  const portCheck = createServer();
  await new Promise((yes, no) => { portCheck.once("error", no); portCheck.listen(5195, "127.0.0.1", yes); });
  await new Promise(yes => portCheck.close(yes));
  const env = Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE",
    "APPDATA", "LOCALAPPDATA", "COMSPEC", "PATHEXT", "SystemDrive", "HOME"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5195", "--strictPort"],
    { cwd: root, env: { ...env, VITE_API_URL: mockOrigin + "/api" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let spawnFailed = false;
  vite.on("error", () => { spawnFailed = true; });
  for (const stream of ["stdout", "stderr"]) {
    createInterface({ input: vite[stream] }).on("line", line => {
      if (!line.trim()) return;
      const category = /internal server error|failed to (?:resolve|load|transform)|pre-transform error/i.test(line) ? "transform-or-load-error"
        : /optimiz|re-optim/i.test(line) ? "dependency-optimizer"
        : /ready in/i.test(line) ? "server-ready"
        : /Local:/.test(line) ? "loopback-listener"
        : /warn/i.test(line) ? "warning" : "output-withheld";
      if (report.vite.length < 120) report.vite.push({ ms: since(phaseStarted), stream, category });
    });
  }
  for (let attempt = 0; attempt < 120; attempt++) {
    if (spawnFailed || vite.exitCode !== null) throw new Error("Vite exited before startup");
    report.viteProbe = await probeFrontendLogin(fetch, loginUrl, AbortSignal.timeout(1000));
    if (report.viteProbe.outcome === "html-shell-ready") return;
    await delay(250);
  }
  throw new Error("Vite readiness probe failed");
}

async function isolateNetwork(context) {
  await context.routeWebSocket("**/*", socket => {
    if (new URL(socket.url()).host === new URL(origin).host) socket.connectToServer();
    else { report.blocked.push({ kind: "websocket", path: "[nonlocal]" }); return socket.close(); }
  });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    const fixture = fixtures.get(url.pathname);
    if (url.origin === mockOrigin && fixture && request.method() === "GET" && !url.search) {
      report.apiMocks.push({ path: url.pathname, status: fixture.status, ms: elapsed() });
      await route.fulfill({ ...fixture, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" } });
    } else if (url.origin === origin && request.method() === "GET" && !/^\/api(?:\/|$)/.test(url.pathname)) {
      await route.continue();
    } else {
      report.blocked.push({ kind: resourceTypes.has(request.resourceType()) ? request.resourceType() : "other", path: safePath(request.url()) });
      await route.abort("blockedbyclient");
    }
  });
}

function observePage(page) {
  let documentRequest;
  const recordOf = request => request === documentRequest ? report.document : assets.get(request);
  page.on("request", request => {
    if (request.isNavigationRequest() && request.url() === loginUrl && !documentRequest) {
      documentRequest = request;
      report.document.requestMs = elapsed();
    } else if (["script", "stylesheet"].includes(request.resourceType()) || safePath(request.url()).endsWith(".css")) {
      assets.set(request, { path: safePath(request.url()), kind: request.resourceType(), requestMs: elapsed() });
    }
  });
  page.on("response", response => {
    const entry = recordOf(response.request());
    if (entry) Object.assign(entry, { responseMs: elapsed(), status: response.status() });
  });
  page.on("requestfinished", request => {
    const entry = recordOf(request);
    if (entry) entry.finishedMs = elapsed();
  });
  page.on("requestfailed", request => {
    const entry = recordOf(request);
    if (entry) Object.assign(entry, { failedMs: elapsed(), failure: transport(request.failure()?.errorText) });
  });
  page.on("domcontentloaded", () => { if (page.url() === loginUrl) report.events.domContentLoadedMs = elapsed(); });
  page.on("load", () => { if (page.url() === loginUrl) report.events.loadMs = elapsed(); });
  page.on("console", message => {
    if (!["error", "warning"].includes(message.type())) return;
    const location = message.location();
    const unauthenticated = safePath(location.url) === "/api/auth/me" && /\b401\b/.test(message.text());
    report.console.push({ ms: elapsed(), type: message.type(), path: safePath(location.url), line: location.lineNumber,
      category: unauthenticated ? "http-401-auth-me" : "message-withheld" });
  });
  page.on("pageerror", error => {
    const frame = error.stack?.match(/http:\/\/127\.0\.0\.1:5195\/[^\s)]+?(?=:\d+:\d+(?:\)|\s|$))/)?.[0];
    report.pageErrors.push({ ms: elapsed(), type: exceptionTypes.has(error.name) ? error.name : "withheld",
      path: safePath(frame), document: safePath(page.url()) });
  });
}

async function observeChromium(context, page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.setLifecycleEventsEnabled", { enabled: true });
  let loader;
  cdp.on("Network.requestWillBeSent", event => {
    if (event.type !== "Document" || event.request.url !== loginUrl) return;
    loader = event.loaderId;
    cdpDocuments.set(event.requestId, { requestMs: elapsed() });
  });
  cdp.on("Network.responseReceived", event => {
    const entry = cdpDocuments.get(event.requestId);
    if (entry) Object.assign(entry, { responseMs: elapsed(), status: event.response.status });
  });
  cdp.on("Network.loadingFinished", event => {
    const entry = cdpDocuments.get(event.requestId);
    if (entry) Object.assign(entry, { finishedMs: elapsed(), encodedBytes: event.encodedDataLength });
  });
  cdp.on("Network.loadingFailed", event => {
    const entry = cdpDocuments.get(event.requestId);
    if (entry) Object.assign(entry, { failedMs: elapsed(), failure: transport(event.errorText) });
  });
  cdp.on("Page.lifecycleEvent", event => {
    if (loader && event.loaderId === loader && ["DOMContentLoaded", "load"].includes(event.name)) {
      report.chromium[event.name + "Ms"] = elapsed();
    }
  });
  return cdp;
}

async function observeLogin(page, cdp) {
  navigationStarted = performance.now();
  report.navigationStartedAt = new Date().toISOString();
  const remaining = () => {
    const ms = loginStartupTimeout - Math.ceil(performance.now() - navigationStarted);
    if (ms <= 0) throw new Error("Navigation budget exhausted");
    return ms;
  };
  try {
    report.stage = "document-commit";
    const response = await page.goto(loginUrl, { waitUntil: "commit", timeout: remaining() });
    report.events.commitMs = elapsed();
    assert.equal(response?.status(), 200);
    report.stage = "domcontentloaded";
    await page.waitForLoadState("domcontentloaded", { timeout: remaining() });
    report.events.domContentLoadedVerifiedMs = elapsed();
    report.stage = "login-ui";
    const form = page.locator(".auth-card form");
    const submit = form.locator('button[type="submit"]');
    await Promise.all([form, form.locator('input[autocomplete="username"]'), form.locator('input[autocomplete="current-password"]'),
      submit, page.getByRole("link", { name: "First-time Admin setup", exact: true })]
      .map(locator => locator.waitFor({ state: "visible", timeout: remaining() })));
    assert(await submit.isEnabled({ timeout: remaining() }));
    assert.equal(page.url(), loginUrl);
    report.events.loginUiReadyMs = elapsed();
    // Observe load within the original budget without making it a pass requirement.
    if (report.events.loadMs === undefined) {
      try { await page.waitForLoadState("load", { timeout: remaining() }); }
      catch { report.events.loadWaitIncomplete = true; }
    }
  } finally {
    // Read-only snapshot after the timed assertions. A blocked renderer may not respond.
    const sample = cdp.send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true })
      .then(value => value.result?.value, () => undefined);
    const readyState = await Promise.race([sample, delay(400)]);
    report.document.readyState = ["loading", "interactive", "complete"].includes(readyState) ? readyState : "unavailable";
  }
}

try {
  await startVite();
  report.stage = "vite-prewarm";
  report.prewarm = await prewarmVite(origin);
  assert(report.prewarm.ready, "Vite prewarm failed");
  report.stage = "browser-startup";
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
  browser = await chromium.launch({ channel: "msedge", headless: true });
  report.chromium.version = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference", serviceWorkers: "block" });
  await isolateNetwork(context);
  await context.addInitScript(seedApplicationPreferences, origin);
  const page = await context.newPage();
  observePage(page);
  const cdp = await observeChromium(context, page);
  await observeLogin(page, cdp);
  report.stage = "browser-errors";
  assert(report.apiMocks.some(entry => entry.path === "/api/auth/me") && report.apiMocks.some(entry => entry.path === "/api/setup"));
  const mockDenials = report.apiMocks.filter(entry => entry.path === "/api/auth/me");
  const denialMessages = report.console.filter(entry => entry.category === "http-401-auth-me" && entry.type === "error");
  // Preserve all messages and recognize only the exact stubbed anonymous operation.
  assert(denialMessages.length <= mockDenials.length && report.console.every(entry => denialMessages.includes(entry)));
  assert.equal(report.pageErrors.length + report.blocked.length, 0);
  assert([...assets.values()].every(entry => entry.failedMs === undefined && (entry.status ?? 0) < 400));
  report.status = "PASS";
  report.stage = "complete";
} catch (error) {
  report.failure = error.name === "TimeoutError" ? "TimeoutError" : error.name === "AssertionError" ? "AssertionError" : "DiagnosticError";
} finally {
  report.document.htmlBodyComplete = report.document.finishedMs !== undefined ||
    [...cdpDocuments.values()].some(entry => entry.finishedMs !== undefined);
  report.chromium.documents = [...cdpDocuments.values()];
  report.assets = [...assets.values()];
  try { await browser?.close(); } catch { report.status = "FAIL"; report.shutdown = "browser-close-failed"; }
  if (vite?.pid && vite.exitCode === null && vite.signalCode === null) {
    const closed = once(vite, "exit").then(() => true, () => false);
    vite.kill();
    if (!await Promise.race([closed, delay(3000, false)])) { report.status = "FAIL"; report.shutdown = "vite-close-unverified"; }
  }
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, stage: report.stage, output }));
  process.exitCode = report.status === "PASS" ? 0 : 1;
}

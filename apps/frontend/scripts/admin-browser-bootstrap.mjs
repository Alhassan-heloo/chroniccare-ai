// @ts-check

export const loginStartupTimeout = 30_000;
/** @template {object} Request */
export function observeSetupCompletion() {
  /** @type {Map<Request, {requestId: number | null, stage: string, lastEvent: string, status?: number}>} */
  const requests = new Map();
  return {
    /** @param {Request} request @param {number | null} requestId @param {string} stage */
    start(request, requestId, stage) {
      if (!requests.has(request)) requests.set(request, { requestId, stage, lastEvent: "request" });
    },
    /** @param {Request} request @param {"response" | "requestfinished" | "requestfailed"} event @param {number} [status] */
    event(request, event, status) {
      const entry = requests.get(request);
      if (!entry || entry.lastEvent === "requestfinished" || entry.lastEvent === "requestfailed") return;
      entry.lastEvent = event;
      if (status !== undefined) entry.status = status;
    },
    snapshot() { return Array.from(requests.values(), entry => ({ ...entry })); },
    state() {
      const entries = [...requests.values()];
      if (entries.some(entry => entry.lastEvent === "requestfailed" || (entry.status !== undefined && entry.status !== 200))) return "failed";
      return entries.length && entries.every(entry => entry.lastEvent === "requestfinished" && entry.status === 200) ? "finished" : "pending";
    },
  };
}
const connectErrors = new Set(["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN"]);
const browserConnectErrors = new Set(["net::ERR_CONNECTION_REFUSED", "net::ERR_ADDRESS_UNREACHABLE", "net::ERR_NAME_NOT_RESOLVED"]);
const documentErrors = new Set([...browserConnectErrors, "net::ERR_ABORTED", "net::ERR_CONNECTION_RESET", "net::ERR_EMPTY_RESPONSE", "net::ERR_TIMED_OUT", "net::ERR_FAILED"]);
const prewarmPaths = ["/@vite/client", "/src/main.tsx", "/src/styles/globals.css",
  "/src/app/providers/AppProviders.tsx", "/src/app/router.tsx"];

/** @param {string} origin */
export async function prewarmVite(origin) {
  const started = performance.now();
  const signal = AbortSignal.timeout(loginStartupTimeout);
  const requests = await Promise.all(prewarmPaths.map(async path => {
    const requestStarted = performance.now();
    /** @type {{path: string, status?: number, transformedModule?: boolean, failure?: string, durationMs?: number}} */
    const entry = { path };
    try {
      const response = await fetch(origin + path, { redirect: "error", signal });
      entry.status = response.status;
      await response.arrayBuffer();
      entry.transformedModule = /(?:java|ecma)script/i.test(response.headers.get("content-type") ?? "");
    } catch {
      entry.failure = signal.aborted ? "timeout" : "request-failed";
    } finally {
      entry.durationMs = Math.round(performance.now() - requestStarted);
    }
    return entry;
  }));
  return { requests, durationMs: Math.round(performance.now() - started),
    ready: requests.every(entry => entry.status === 200 && entry.transformedModule && !entry.failure) };
}

/** @param {typeof fetch} fetchDocument @param {string} loginUrl @param {AbortSignal} signal */
export async function probeFrontendLogin(fetchDocument, loginUrl, signal) {
  let response;
  try { response = await fetchDocument(loginUrl, { signal, redirect: "manual" }); }
  catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
    return { outcome: typeof code === "string" && connectErrors.has(code) ? "connection-failed" : "no-http-response", status: null };
  }
  if (response.status !== 200 || !/^text\/html\b/i.test(response.headers.get("content-type") ?? "")) {
    await response.body?.cancel().catch(() => undefined);
    return { outcome: "unexpected-http-response", status: response.status };
  }
  try {
    const html = await response.text();
    return { outcome: html.includes('id="root"') && html.includes('src="/src/main.tsx"') ? "html-shell-ready" : "unexpected-html-shell", status: response.status };
  } catch { return { outcome: "incomplete-html-response", status: response.status }; }
}

export function createLoginNavigationObservation() {
  let documentRequested = false, domContentLoaded = false, loadObserved = false, navigationReturned = false, uiReady = false;
  /** @type {number | null} */
  let documentStatus = null;
  /** @type {string | null} */
  let documentFailure = null;
  let resourceFailures = 0, javascriptErrors = 0;
  return {
    requestDocument() { documentRequested = true; },
    /** @param {number} status */
    receiveDocument(status) { documentStatus = status; },
    /** @param {string | null | undefined} code */
    failDocument(code) { documentFailure = code && documentErrors.has(code) ? code : "unclassified"; },
    domReady() { domContentLoaded = true; },
    loaded() { loadObserved = true; },
    failResource() { resourceFailures++; },
    javascriptError() { javascriptErrors++; },
    markNavigationReturned() { navigationReturned = true; },
    markUiReady() { uiReady = true; },
    snapshot() {
      let progress;
      if (documentStatus === null) progress = documentFailure && browserConnectErrors.has(documentFailure) ? "frontend-connection-failed" : "no-document-response";
      else if (!domContentLoaded) progress = "document-received-before-domcontentloaded";
      else if (!loadObserved) progress = "domcontentloaded-before-load";
      else progress = "load-observed";
      return { waitUntil: "domcontentloaded", progress, documentRequested, documentStatus, documentFailure, domContentLoaded,
        loadObserved, navigationReturned, uiReady, resourceFailures, javascriptErrors };
    },
  };
}

/** @param {{ navigate(options: {waitUntil: "domcontentloaded", timeout: number}): Promise<{status(): number} | null>,
 * waitForUi(timeout: number): Promise<void>, observation: ReturnType<typeof createLoginNavigationObservation>, now?: () => number }} options */
export async function waitForLoginReadiness({ navigate, waitForUi, observation, now = () => performance.now() }) {
  const deadline = now() + loginStartupTimeout;
  const remaining = () => {
    const timeout = Math.ceil(deadline - now());
    if (timeout <= 0) throw new Error("Login UI startup budget exhausted");
    return timeout;
  };
  const response = await navigate({ waitUntil: "domcontentloaded", timeout: remaining() });
  observation.markNavigationReturned();
  if (!response || response.status() !== 200) throw new Error("Login navigation did not return HTTP 200");
  await waitForUi(remaining());
  observation.markUiReady();
}

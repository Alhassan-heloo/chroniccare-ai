// @ts-check
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

/** @typedef {{ url(): string, method(): string, resourceType(): string, failure?(): { errorText: string } | null }} BrowserRequest */
/** @typedef {{ url(): string, status(): number, request(): BrowserRequest }} BrowserResponse */
/** @typedef {BrowserResponse & { json(): Promise<unknown> }} AuthResponse */
/** @typedef {{ type(): string, text(): string, location(): { url: string } }} BrowserMessage */
/** @typedef {{ requestId: number, requestStage: string | null, path: string | null, method: string | null, resourceType: string | null, authStep: keyof typeof authSteps | null }} RequestDetails */
/** @typedef {{ step: keyof typeof authSteps, pending: Set<BrowserRequest>, responses: Map<BrowserRequest, AuthResponse>, passwordChanged: boolean, prematureLogout: boolean }} AuthCheck */
/** @typedef {{ stage: string, elapsedMs: number, removedFromPending: boolean | null }} TerminalObservation */
/** @typedef {{ request: RequestDetails, startObserved: boolean, responseReceived: boolean, requestfinished: { page: TerminalObservation | null, context: TerminalObservation | null }, requestfailed: { page: TerminalObservation | null, context: TerminalObservation | null } }} ApiLifecycle */
/** @typedef {"before-page-close" | "after-page-close" | "wait-timeout"} RestartCheckpoint */

const apiPaths = new Set([
  "/api/setup", "/api/health/ready", "/api/auth/csrf", "/api/auth/login", "/api/auth/logout", "/api/auth/me",
  "/api/auth/register", "/api/auth/change-password", "/api/admin/doctors", "/api/admin/doctors/direct",
  "/api/doctor/patients", "/api/measurements", "/api/medications", "/api/habits", "/api/notifications",
  "/api/notifications/browser-registration", "/api/notifications/unread-count",
]);
const frontendPaths = new Set(["/", "/login", "/register", "/setup", "/admin/dashboard", "/doctor/dashboard", "/patient/dashboard", "/favicon.ico", "/favicon.svg", "/src/main.tsx", "/@vite/client", "/fonts/cairo/Cairo-Variable.ttf"]);
const frontendErrorSources = new Set(["/@vite/client", "/src/main.tsx", "/src/auth/AuthProvider.tsx", "/src/auth/RouteAccess.tsx", "/src/auth/api.ts"]);
const exceptionNames = new Set(["Error", "DOMException", "SecurityError", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "AbortError", "InvalidStateError", "QuotaExceededError"]);
const methods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const resourceTypes = new Set(["document", "stylesheet", "image", "media", "font", "script", "texttrack", "xhr", "fetch", "eventsource", "websocket", "manifest", "other", "ping", "preflight"]);
const transportCodes = new Set(["net::ERR_ABORTED", "net::ERR_CONNECTION_REFUSED", "net::ERR_CONNECTION_RESET", "net::ERR_EMPTY_RESPONSE", "net::ERR_FAILED", "net::ERR_TIMED_OUT"]);
const verifiedSteps = {
  "duplicate-email": { path: "/api/admin/doctors/direct", status: 409 },
  "failed-create-no-false-success": { path: "/api/admin/doctors/direct", status: 503 },
  "invitation-remains-separate": { path: "/api/admin/doctors", status: 503 },
};
const authSteps = {
  "initial-login-navigation": { stage: "browser-bootstrap", path: "/api/auth/me", method: "GET" },
  "closed-setup-navigation": { stage: "browser-bootstrap", path: "/api/auth/me", method: "GET" },
  "anonymous-registration-navigation": { stage: "browser-bootstrap", path: "/api/auth/me", method: "GET" },
  "anonymous-protected-navigation": { stage: "protected-route", path: "/api/auth/me", method: "GET" },
  "signed-out-login-navigation": { stage: "temporary-doctor-login", path: "/api/auth/me", method: "GET" },
  "logout-after-password-change": { stage: "forced-password-change", path: "/api/auth/logout", method: "POST" },
  "expired-session-focus": { stage: "expired-session-and-patient-login", path: "/api/auth/me", method: "GET" },
};

/** @param {string} raw */
function parseUrl(raw) {
  try { return new URL(raw); } catch { return null; }
}

/** @param {string} raw */
function fingerprint(raw) {
  // Keep the exact URL (including the query) significant for matching without retaining it in diagnostics.
  return raw ? createHash("sha256").update(raw).digest("hex") : null;
}

/** @param {{ base: string, api: string, getStage: () => string }} options */
export function createBrowserDiagnostics({ base, api, getStage }) {
  const apiOrigin = new URL(api).origin;
  const frontendOrigin = new URL(base).origin;

  /** @param {string} raw */
  function safePath(raw) {
    const url = parseUrl(raw);
    if (!url) return null;
    if (url.origin === apiOrigin && apiPaths.has(url.pathname)) return url.pathname;
    if (url.origin === frontendOrigin && frontendPaths.has(url.pathname)) return url.pathname;
    return null;
  }

  let nextRequestId = 0;
  /** @type {WeakMap<BrowserRequest, ReturnType<typeof requestDetails>>} */
  const requests = new WeakMap();
  /** @type {WeakMap<BrowserResponse, ReturnType<typeof responseDetails>>} */
  const observedFailures = new WeakMap();
  /** @type {Map<number, keyof typeof verifiedSteps | keyof typeof authSteps>} */
  const verified = new Map();
  /** @type {AuthCheck | null} */
  let authCheck = null;
  const startedAuthSteps = new Set();
  /** @type {Set<BrowserRequest>} */
  const pendingApi = new Set();
  /** @type {WeakMap<BrowserRequest, ApiLifecycle>} */
  const apiLifecycle = new WeakMap();
  /** @type {Set<BrowserRequest>} */
  const restartRequests = new Set();
  let observingRestart = false;
  /** @type {ReturnType<typeof restartSnapshot>[]} */
  const restartSnapshots = [];
  /** @type {ReturnType<typeof pageErrorDetails>[]} */
  const pageErrors = [];
  const startedAt = performance.now();
  /** @type {ReturnType<typeof responseDetails>[]} */
  const httpFailures = [];
  /** @type {ReturnType<typeof failedRequestDetails>[]} */
  const requestFailures = [];
  /** @type {ReturnType<typeof consoleDetails>[]} */
  const consoleEntries = [];

  /** @param {BrowserRequest} request @returns {RequestDetails} */
  function requestDetails(request) {
    const method = request.method();
    const resourceType = request.resourceType();
    return { requestId: ++nextRequestId, requestStage: getStage(), path: safePath(request.url()),
      method: methods.has(method) ? method : null, resourceType: resourceTypes.has(resourceType) ? resourceType : null,
      authStep: authCheck?.step ?? null };
  }

  /** @param {BrowserRequest} request */
  function lifecycleFor(request) {
    if (parseUrl(request.url())?.origin !== apiOrigin) return null;
    let lifecycle = apiLifecycle.get(request);
    if (!lifecycle) {
      const known = requests.get(request);
      lifecycle = { request: known ?? { ...requestDetails(request), requestStage: null, authStep: null },
        startObserved: !!known?.requestStage, responseReceived: false,
        requestfinished: { page: null, context: null }, requestfailed: { page: null, context: null } };
      apiLifecycle.set(request, lifecycle);
    }
    if (observingRestart) restartRequests.add(request);
    return lifecycle;
  }

  /** @param {BrowserRequest} request @param {"requestfinished" | "requestfailed"} event @param {"page" | "context"} scope @param {boolean | null} removedFromPending */
  function observeTerminal(request, event, scope, removedFromPending) {
    const lifecycle = lifecycleFor(request);
    // Preserve the first observation for each scope, including its original delete result.
    if (lifecycle && !lifecycle[event][scope]) {
      lifecycle[event][scope] = { stage: getStage(), elapsedMs: Math.round(performance.now() - startedAt), removedFromPending };
    }
  }

  /** @param {BrowserRequest} request */
  function lifecycleReport(request) {
    const lifecycle = apiLifecycle.get(request);
    return lifecycle ? { ...structuredClone(lifecycle), pending: pendingApi.has(request) } : null;
  }

  /** @param {RestartCheckpoint} checkpoint */
  function restartSnapshot(checkpoint) {
    for (const request of pendingApi) restartRequests.add(request);
    return { checkpoint, stage: getStage(), elapsedMs: Math.round(performance.now() - startedAt),
      pendingCount: pendingApi.size, requests: Array.from(pendingApi, lifecycleReport).filter(entry => entry !== null) };
  }

  /** @param {string} raw */
  function documentDetails(raw) {
    if (raw === "about:blank") return { kind: "about-blank", path: null };
    const url = parseUrl(raw);
    if (url?.origin === frontendOrigin) return { kind: "frontend", path: safePath(raw) };
    if (url?.origin === apiOrigin) return { kind: "api", path: safePath(raw) };
    return { kind: url ? "other" : "unknown", path: null };
  }

  /** @param {Error} error @param {string} documentUrl */
  function pageErrorDetails(error, documentUrl) {
    let location = null;
    for (const frame of (error.stack ?? "").split(/\r?\n/)) {
      if (!/^\s+at\s/.test(frame)) continue;
      const match = /(?:^|[\s(])((?:https?:\/\/|about:blank)[^\s()]*|<anonymous>):(\d+):(\d+)\)?$/.exec(frame);
      if (!match?.[1]) continue;
      const [, raw, lineText, columnText] = match;
      const line = Number(lineText), column = Number(columnText);
      if (!raw || !Number.isSafeInteger(line) || !Number.isSafeInteger(column)) continue;
      const url = parseUrl(raw);
      const source = raw === "<anonymous>" ? { kind: "anonymous", path: null } : documentDetails(raw);
      const sourcePath = url?.origin === frontendOrigin && frontendErrorSources.has(url.pathname) ? url.pathname : source.path;
      location = { source: source.kind, path: sourcePath, line, column };
      break;
    }
    return { stage: getStage(), elapsedMs: Math.round(performance.now() - startedAt),
      exceptionType: exceptionNames.has(error.name) ? error.name : null,
      observedDocument: documentDetails(documentUrl), location };
  }

  /** @param {BrowserRequest} request */
  function onRequest(request) {
    if (requests.has(request)) return;
    requests.set(request, requestDetails(request));
    if (parseUrl(request.url())?.origin === apiOrigin) pendingApi.add(request);
    lifecycleFor(request);
    if (authCheck) {
      const rule = authSteps[authCheck.step];
      if (request.url() === apiOrigin + rule.path && request.method() === rule.method && request.resourceType() === "fetch") {
        authCheck.pending.add(request);
        if (authCheck.step === "logout-after-password-change" && !authCheck.passwordChanged) authCheck.prematureLogout = true;
      }
    }
  }

  /** @param {BrowserRequest} request */
  function observedRequest(request) {
    const details = requests.get(request);
    if (details) return details;
    const lateDetails = { ...requestDetails(request), requestStage: null, authStep: null };
    requests.set(request, lateDetails);
    return lateDetails;
  }

  /** @param {BrowserResponse} response */
  function responseDetails(response) {
    return { event: "http-response", ...observedRequest(response.request()), status: response.status(),
      responseStage: getStage(), key: fingerprint(response.url()) };
  }

  /** @param {BrowserRequest} request */
  function failedRequestDetails(request) {
    const code = request.failure?.()?.errorText ?? "";
    return { event: "request-failed", ...observedRequest(request), failureStage: getStage(), status: null,
      transportCode: transportCodes.has(code) ? code : null };
  }

  /** @param {BrowserMessage} message */
  function consoleDetails(message) {
    const raw = message.location().url;
    // Only Chromium's HTTP resource diagnostic supports URL-and-status matching.
    const status = /^Failed to load resource: the server responded with a status of ([45]\d\d)(?: \([^\r\n]*\))?$/.exec(message.text());
    return { type: message.type() === "warning" ? "warning" : "error", stage: getStage(), sourcePath: safePath(raw),
      reportedStatus: status ? Number(status[1]) : null, key: status ? fingerprint(raw) : null, authStep: authCheck?.step ?? null };
  }

  return {
    onRequest,
    /** @param {BrowserRequest} request */
    requestIdentity(request) { return requests.get(request)?.requestId ?? null; },
    /** @param {BrowserRequest} request */
    onRequestFinished(request) { observeTerminal(request, "requestfinished", "page", pendingApi.delete(request)); },
    /** @param {BrowserRequest} request */
    onContextRequestFinished(request) { observeTerminal(request, "requestfinished", "context", null); },
    /** @param {BrowserRequest} request */
    onContextRequestFailed(request) { observeTerminal(request, "requestfailed", "context", null); },
    pendingApiRequests() { return pendingApi.size; },
    /** @param {RestartCheckpoint} checkpoint */
    captureRestartSnapshot(checkpoint) {
      if (checkpoint === "before-page-close") observingRestart = true;
      restartSnapshots.push(restartSnapshot(checkpoint));
    },
    endRestartObservation() { observingRestart = false; },
    /** @param {Error} error @param {string} documentUrl */
    onPageError(error, documentUrl) { pageErrors.push(pageErrorDetails(error, documentUrl)); },
    /** @param {AuthResponse} response */
    onResponse(response) {
      const lifecycle = lifecycleFor(response.request());
      if (lifecycle) lifecycle.responseReceived = true;
      if (authCheck?.pending.has(response.request())) authCheck.responses.set(response.request(), response);
      const status = response.status();
      if (authCheck?.step === "logout-after-password-change" && status === 204 && response.url() === apiOrigin + "/api/auth/change-password" &&
          response.request().method() === "POST" && requests.get(response.request())?.authStep === authCheck.step) authCheck.passwordChanged = true;
      if (!Number.isInteger(status) || status < 400 || status > 599 || observedFailures.has(response)) return;
      const details = responseDetails(response);
      observedFailures.set(response, details);
      httpFailures.push(details);
    },
    /** @param {BrowserRequest} request */
    onRequestFailed(request) {
      const duplicate = !!apiLifecycle.get(request)?.requestfailed.page;
      observeTerminal(request, "requestfailed", "page", pendingApi.delete(request));
      if (!duplicate) requestFailures.push(failedRequestDetails(request));
    },
    /** @param {BrowserMessage} message */
    onConsole(message) {
      if (message.type() === "error" || message.type() === "warning") consoleEntries.push(consoleDetails(message));
    },
    /** @param {keyof typeof authSteps} step */
    beginAuthDenial(step) {
      const rule = authSteps[step];
      if (authCheck || startedAuthSteps.has(step) || getStage() !== rule.stage) throw new Error("Invalid auth denial operation");
      startedAuthSteps.add(step);
      /** @type {AuthCheck} */
      const operation = { step, pending: new Set(), responses: new Map(), passwordChanged: false, prematureLogout: false };
      authCheck = operation;
      return async () => {
        if (authCheck !== operation || getStage() !== rule.stage) throw new Error("Auth denial operation is no longer active");
        try {
          const deadline = Date.now() + 5000;
          while ((operation.pending.size === 0 || operation.pending.size !== operation.responses.size) && Date.now() < deadline) await delay(25);
          if (operation.pending.size === 0 || operation.pending.size !== operation.responses.size) throw new Error("Auth denial responses were not all observed");
          if (step === "logout-after-password-change" && (!operation.passwordChanged || operation.prematureLogout)) throw new Error("Logout denial must follow a successful password change");
          const verifiedIds = [];
          for (const response of operation.responses.values()) {
            const observed = observedFailures.get(response);
            // Only check the error code in memory. Never put response bodies in the report.
            if (!observed || response.status() !== 401 || !isUnauthenticated(await response.json())) throw new Error("Auth denial must return 401 UNAUTHENTICATED");
            verifiedIds.push(observed.requestId);
          }
          if (operation.pending.size !== verifiedIds.length) throw new Error("Additional auth requests appeared during verification");
          for (const id of verifiedIds) verified.set(id, step);
        } finally { authCheck = null; }
      };
    },
    /** Call only after the scenario's assertions for this exact response have passed.
     * @param {BrowserResponse} response
     * @param {keyof typeof verifiedSteps} step
     */
    verifyFailure(response, step) {
      const expected = verifiedSteps[step];
      const observed = observedFailures.get(response);
      if (!observed || !expected || getStage() !== step || observed.requestStage !== step ||
          response.url() !== apiOrigin + expected.path || response.request().method() !== "POST" || response.status() !== expected.status) {
        throw new Error("Browser failure could not be verified against the scenario response");
      }
      verified.set(observed.requestId, step);
    },
    report() {
      const consoleDiagnostics = consoleEntries.map(({ key, ...entry }) => {
        const candidates = key ? httpFailures.filter(response => response.key === key && response.status === entry.reportedStatus && (!entry.authStep || response.authStep === entry.authStep)) : [];
        const matchingMessages = key ? consoleEntries.filter(message => message.key === key && message.reportedStatus === entry.reportedStatus && (!entry.authStep || message.authStep === entry.authStep)) : [];
        const response = candidates.length === 1 && matchingMessages.length === 1 ? candidates[0] : undefined;
        // A duplicate group may prove the operation, never an individual Console-to-request pairing.
        const groupStep = entry.authStep && candidates.length > 1 && candidates.length === matchingMessages.length &&
          matchingMessages.every(message => message.type === "error") &&
          candidates.every(candidate => verified.get(candidate.requestId) === entry.authStep) ? entry.authStep : null;
        const verifiedStep = entry.type === "error" ? (response && response.authStep === entry.authStep ? verified.get(response.requestId) ?? null : groupStep) : null;
        const details = response ?? (groupStep ? candidates[0] : undefined);
        return { ...entry, status: details?.status ?? entry.reportedStatus, path: details?.path ?? null,
          method: details?.method ?? null, resourceType: details?.resourceType ?? null, requestId: response?.requestId ?? null,
          requestStage: response?.requestStage ?? null, verifiedStep, expected: verifiedStep !== null,
          correlation: response ? "unique-url-and-http-status" : groupStep ? "verified-operation-group" : candidates.length ? "ambiguous" : "unmatched",
          candidateRequestIds: candidates.map(candidate => candidate.requestId) };
      });
      const networkFailures = httpFailures.map(({ key: _key, ...response }) => ({ ...response, verifiedStep: verified.get(response.requestId) ?? null }));
      return { consoleDiagnostics, networkFailures: [...networkFailures, ...requestFailures], pageErrors,
        restartSnapshots, restartApiRequests: Array.from(restartRequests, lifecycleReport).filter(entry => entry !== null) };
    },
  };
}

/** @param {unknown} body */
function isUnauthenticated(body) {
  return !!body && typeof body === "object" && "error" in body && !!body.error &&
    typeof body.error === "object" && "code" in body.error && body.error.code === "UNAUTHENTICATED";
}

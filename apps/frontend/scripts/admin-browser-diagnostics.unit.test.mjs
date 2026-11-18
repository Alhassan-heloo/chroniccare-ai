// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserDiagnostics } from "./admin-browser-diagnostics.mjs";

const base = "http://127.0.0.1:5195";
const api = "http://127.0.0.1:3315/api";

/** @param {string} stage */
function recorder(stage) {
  return createBrowserDiagnostics({ base, api, getStage: () => stage });
}

/** @param {string} url @param {number} status */
function response(url, status, method = "GET", resourceType = "fetch", code = "UNAUTHENTICATED") {
  const request = { url: () => url, method: () => method, resourceType: () => resourceType };
  return { url: () => url, status: () => status, request: () => request, json: async () => ({ error: { code, message: "private-body" } }) };
}

/** @param {string} url @param {number} status */
function httpMessage(url, status) {
  return { type: () => "error", text: () => `Failed to load resource: the server responded with a status of ${status} ()`, location: () => ({ url }) };
}

test("links a unique HTTP console error even when the response arrives later", () => {
  let stage = "protected-route";
  const diagnostics = createBrowserDiagnostics({ base, api, getStage: () => stage });
  const url = api + "/auth/me?probe=private";
  const denied = response(url, 401);
  diagnostics.onRequest(denied.request());
  stage = "temporary-doctor-login";
  diagnostics.onConsole(httpMessage(url, 401));
  diagnostics.onResponse(denied);
  const { consoleDiagnostics: [entry], networkFailures: [network] } = diagnostics.report();
  assert(entry && network);
  assert.equal(entry.correlation, "unique-url-and-http-status");
  assert.equal(entry.stage, "temporary-doctor-login");
  assert.equal(entry.requestStage, "protected-route");
  assert.equal(entry.path, "/api/auth/me");
  assert.equal(entry.status, 401);
  assert.equal(entry.resourceType, "fetch");
  assert.equal(entry.requestId, network.requestId);
  assert.equal(entry.expected, false);
});

test("requires the exact observed response and a completed scenario check", () => {
  const diagnostics = recorder("duplicate-email");
  const url = api + "/admin/doctors/direct";
  const duplicate = response(url, 409, "POST", "xhr");
  diagnostics.onRequest(duplicate.request());
  diagnostics.onResponse(duplicate);
  diagnostics.onConsole(httpMessage(url, 409));
  assert.equal(diagnostics.report().consoleDiagnostics[0]?.expected, false);
  assert.throws(() => diagnostics.verifyFailure(response(url, 409, "POST"), "duplicate-email"));
  assert.throws(() => diagnostics.verifyFailure(duplicate, "failed-create-no-false-success"));
  diagnostics.verifyFailure(duplicate, "duplicate-email");
  assert.equal(diagnostics.report().consoleDiagnostics[0]?.expected, true);
  assert.equal(diagnostics.report().consoleDiagnostics[0]?.verifiedStep, "duplicate-email");
});

test("does not associate repeated requests or repeated messages by order", () => {
  for (const duplicateRequest of [true, false]) {
    const diagnostics = recorder("duplicate-email");
    const url = api + "/admin/doctors/direct";
    const duplicate = response(url, 409, "POST");
    diagnostics.onRequest(duplicate.request());
    diagnostics.onResponse(duplicate);
    diagnostics.verifyFailure(duplicate, "duplicate-email");
    diagnostics.onConsole(httpMessage(url, 409));
    if (duplicateRequest) diagnostics.onResponse(response(url, 409, "POST"));
    else diagnostics.onConsole(httpMessage(url, 409));
    for (const entry of diagnostics.report().consoleDiagnostics) {
      assert.equal(entry.correlation, "ambiguous");
      assert.equal(entry.requestId, null);
      assert.equal(entry.expected, false);
    }
  }
});

test("same redacted path with different queries does not count as evidence", () => {
  const diagnostics = recorder("protected-route");
  const url = api + "/auth/me";
  diagnostics.onResponse(response(url + "?probe=one", 401));
  diagnostics.onConsole(httpMessage(url + "?probe=two", 401));
  const entry = diagnostics.report().consoleDiagnostics[0];
  assert.equal(entry?.correlation, "unmatched");
  assert.equal(entry?.requestId, null);
  assert.equal(entry?.expected, false);
});

test("withholds raw messages, credentials, queries and unknown path segments", () => {
  const diagnostics = recorder("temporary-doctor-login");
  const url = api + "/private/secret-user?token=secret-query#secret-fragment";
  diagnostics.onResponse(response(url, 403, "secret-method", "secret-type"));
  diagnostics.onConsole(httpMessage(url, 403));
  diagnostics.onConsole({ type: () => "warning", text: () => "401 secret-password secret-cookie", location: () => ({ url }) });
  const report = diagnostics.report();
  assert.doesNotMatch(JSON.stringify(report), /secret-|\bkey\b|127\.0\.0\.1/);
  assert.equal(report.consoleDiagnostics[0]?.status, 403);
  assert.equal(report.consoleDiagnostics[0]?.path, null);
  assert.equal(report.consoleDiagnostics[0]?.expected, false);
  assert.equal(report.consoleDiagnostics[1]?.type, "warning");
  assert.equal(report.consoleDiagnostics[1]?.correlation, "unmatched");
  assert.equal(report.consoleDiagnostics[1]?.reportedStatus, null);
});

test("records request failures independently without inventing HTTP status", () => {
  const diagnostics = recorder("protected-route");
  const request = response(api + "/auth/me", 0).request();
  diagnostics.onRequest(request);
  diagnostics.onRequestFailed(request);
  const failure = diagnostics.report().networkFailures[0];
  assert.equal(failure?.event, "request-failed");
  assert.equal(failure?.path, "/api/auth/me");
  assert.equal(failure?.status, null);
  assert.equal(failure?.resourceType, "fetch");
});

test("verifies repeated anonymous denials as a group without pairing individual messages", async () => {
  const diagnostics = recorder("protected-route");
  const url = api + "/auth/me";
  // A prior response to the same URL cannot justify the new operation.
  diagnostics.onResponse(response(url, 401));
  const verify = diagnostics.beginAuthDenial("anonymous-protected-navigation");
  for (let index = 0; index < 2; index++) {
    const denied = response(url, 401);
    diagnostics.onRequest(denied.request());
    diagnostics.onResponse(denied);
    diagnostics.onConsole(httpMessage(url, 401));
  }
  assert(diagnostics.report().consoleDiagnostics.every(entry => !entry.expected));
  await verify();
  const report = diagnostics.report();
  for (const entry of report.consoleDiagnostics) {
    assert.equal(entry.correlation, "verified-operation-group");
    assert.equal(entry.requestId, null);
    assert.equal(entry.candidateRequestIds.length, 2);
    assert.equal(entry.verifiedStep, "anonymous-protected-navigation");
  }
  assert.doesNotMatch(JSON.stringify(report), /private-body/);
});

test("does not excuse denials when any scoped response has the wrong error code", async () => {
  const diagnostics = recorder("protected-route");
  const url = api + "/auth/me";
  const verify = diagnostics.beginAuthDenial("anonymous-protected-navigation");
  for (const code of ["UNAUTHENTICATED", "INVALID_CREDENTIALS"]) {
    const denied = response(url, 401, "GET", "fetch", code);
    diagnostics.onRequest(denied.request());
    diagnostics.onResponse(denied);
    diagnostics.onConsole(httpMessage(url, 401));
  }
  await assert.rejects(verify(), /401 UNAUTHENTICATED/);
  assert(diagnostics.report().consoleDiagnostics.every(entry => !entry.expected));
});

test("bootstrap only verifies denials observed in each explicit anonymous navigation", async () => {
  const diagnostics = recorder("browser-bootstrap");
  const url = api + "/auth/me";
  for (const step of ["initial-login-navigation", "closed-setup-navigation", "anonymous-registration-navigation"]) {
    const verify = diagnostics.beginAuthDenial(/** @type {"initial-login-navigation" | "closed-setup-navigation" | "anonymous-registration-navigation"} */ (step));
    const denied = response(url, 401);
    diagnostics.onRequest(denied.request());
    diagnostics.onResponse(denied);
    diagnostics.onConsole(httpMessage(url, 401));
    await verify();
  }
  diagnostics.onConsole(httpMessage(url, 401));
  const entries = diagnostics.report().consoleDiagnostics;
  assert.deepEqual(entries.map(entry => entry.expected), [true, true, true, false]);
});

test("requires a matching operation and message count even after a denial is verified", async () => {
  const diagnostics = recorder("forced-password-change");
  const url = api + "/auth/logout";
  const verify = diagnostics.beginAuthDenial("logout-after-password-change");
  const changed = response(api + "/auth/change-password", 204, "POST");
  diagnostics.onRequest(changed.request());
  diagnostics.onResponse(changed);
  const denied = response(url, 401, "POST");
  diagnostics.onRequest(denied.request());
  diagnostics.onResponse(denied);
  diagnostics.onConsole(httpMessage(url, 401));
  diagnostics.onConsole(httpMessage(url, 401));
  await verify();
  diagnostics.onConsole(httpMessage(url, 401));
  assert(diagnostics.report().consoleDiagnostics.every(entry => !entry.expected));
});

test("refuses to excuse a logout request that preceded the password-change response", async () => {
  const diagnostics = recorder("forced-password-change");
  const verify = diagnostics.beginAuthDenial("logout-after-password-change");
  const denied = response(api + "/auth/logout", 401, "POST");
  diagnostics.onRequest(denied.request());
  diagnostics.onResponse(denied);
  diagnostics.onConsole(httpMessage(denied.url(), 401));
  const changed = response(api + "/auth/change-password", 204, "POST");
  diagnostics.onRequest(changed.request());
  diagnostics.onResponse(changed);
  await assert.rejects(verify(), /must follow a successful password change/);
  assert.equal(diagnostics.report().consoleDiagnostics[0]?.expected, false);
});

test("tracks API request settlement and records only allowlisted transport codes", () => {
  const diagnostics = recorder("backend-restart-persistence");
  const completed = response(api + "/doctor/patients", 200).request();
  const cancelled = { ...response(api + "/notifications/unread-count", 0).request(), failure: () => ({ errorText: "net::ERR_ABORTED" }) };
  const unknown = { ...response(base + "/private", 0).request(), failure: () => ({ errorText: "private-error" }) };
  for (const request of [completed, cancelled, unknown]) diagnostics.onRequest(request);
  assert.equal(diagnostics.pendingApiRequests(), 2);
  diagnostics.onRequestFinished(completed);
  diagnostics.onRequestFailed(cancelled);
  diagnostics.onRequestFailed(unknown);
  assert.equal(diagnostics.pendingApiRequests(), 0);
  const report = diagnostics.report();
  assert.match(JSON.stringify(report), /net::ERR_ABORTED/);
  assert.doesNotMatch(JSON.stringify(report), /private-error/);
});

test("snapshots retain request identity and response state when an API request finishes normally", () => {
  const diagnostics = recorder("backend-restart-persistence");
  const successful = response(api + "/doctor/patients", 200);
  const request = successful.request();
  diagnostics.onRequest(request);
  diagnostics.captureRestartSnapshot("before-page-close");
  diagnostics.onResponse(successful);
  diagnostics.captureRestartSnapshot("after-page-close");
  diagnostics.onContextRequestFinished(request);
  assert.equal(diagnostics.pendingApiRequests(), 1);
  diagnostics.onRequestFinished(request);
  const { restartSnapshots, restartApiRequests } = diagnostics.report();
  const before = restartSnapshots[0]?.requests[0];
  const after = restartSnapshots[1]?.requests[0];
  const settled = restartApiRequests[0];
  assert(before && after && settled);
  assert.equal(before.request.requestId, after.request.requestId);
  assert.equal(after.request.requestId, settled.request.requestId);
  assert.equal(settled.request.path, "/api/doctor/patients");
  assert.equal(settled.request.method, "GET");
  assert.equal(settled.request.resourceType, "fetch");
  assert.equal(before.responseReceived, false);
  assert.equal(after.responseReceived, true);
  assert.equal(after.requestfinished.page, null);
  assert.equal(settled.requestfinished.context?.removedFromPending, null);
  assert.equal(settled.requestfinished.page?.removedFromPending, true);
  assert.equal(settled.pending, false);
});

test("records cancellation once across Page and BrowserContext while preserving the first deletion result", () => {
  const diagnostics = recorder("backend-restart-persistence");
  const request = { ...response(api + "/notifications/unread-count", 0).request(), failure: () => ({ errorText: "net::ERR_ABORTED" }) };
  diagnostics.onRequest(request);
  diagnostics.captureRestartSnapshot("before-page-close");
  diagnostics.onContextRequestFailed(request);
  diagnostics.onContextRequestFailed(request);
  assert.equal(diagnostics.pendingApiRequests(), 1);
  diagnostics.onRequestFailed(request);
  diagnostics.onRequestFailed(request);
  const report = diagnostics.report();
  const settled = report.restartApiRequests[0];
  assert(settled);
  assert.equal(report.restartApiRequests.length, 1);
  assert.equal(report.networkFailures.length, 1);
  assert.equal(settled.requestfailed.page?.removedFromPending, true);
  assert.equal(settled.requestfailed.context?.removedFromPending, null);
  assert.equal(settled.responseReceived, false);
  assert.equal(settled.pending, false);
});

test("timeout distinguishes a missing terminal event from a context-only event and a failed deletion", () => {
  const diagnostics = recorder("backend-restart-persistence");
  const missing = response(api + "/auth/me", 200).request();
  const contextOnly = response(api + "/doctor/patients", 200).request();
  const unmatchedEnd = response(api + "/doctor/patients", 200).request();
  diagnostics.onRequest(missing);
  diagnostics.onRequest(contextOnly);
  diagnostics.captureRestartSnapshot("before-page-close");
  diagnostics.captureRestartSnapshot("after-page-close");
  diagnostics.onContextRequestFinished(contextOnly);
  diagnostics.onRequestFinished(unmatchedEnd);
  diagnostics.captureRestartSnapshot("wait-timeout");
  diagnostics.endRestartObservation();
  const { restartSnapshots, restartApiRequests } = diagnostics.report();
  const timeout = restartSnapshots[2];
  assert.equal(timeout?.pendingCount, 2);
  assert.equal(timeout?.requests[0]?.requestfinished.context, null);
  assert.equal(timeout?.requests[0]?.requestfinished.page, null);
  assert.equal(timeout?.requests[1]?.requestfinished.context?.removedFromPending, null);
  assert.equal(timeout?.requests[1]?.requestfinished.page, null);
  const unmatched = restartApiRequests.find(entry => !entry.startObserved);
  assert.equal(unmatched?.requestfinished.page?.removedFromPending, false);
  assert.notEqual(unmatched?.request.requestId, timeout?.requests[1]?.request.requestId);
  diagnostics.onRequestFinished(contextOnly);
  assert.equal(diagnostics.report().restartSnapshots[2]?.pendingCount, 2);
  assert.equal(diagnostics.report().restartApiRequests[1]?.requestfinished.page?.removedFromPending, true);
});

test("sanitizes restart snapshots, exception types, stack locations and observed documents", () => {
  const diagnostics = recorder("backend-restart-persistence");
  diagnostics.onRequest(response(api + "/private-user-id?token=private-query#private-fragment", 200).request());
  diagnostics.captureRestartSnapshot("before-page-close");
  const security = new Error("private-message");
  security.name = "SecurityError";
  security.stack = `SecurityError: private-message\n    at privateFunction (${base}/src/main.tsx?token=private-query:15:9)`;
  diagnostics.onPageError(security, "about:blank");
  const unknown = new Error("private-message");
  unknown.name = "private-name";
  unknown.stack = "Error: private-message\n    at privateFunction (https://private-host/private-path?token=private-query:9:2)";
  diagnostics.onPageError(unknown, base + "/login?returnTo=private-path");
  const report = diagnostics.report();
  assert.equal(report.restartSnapshots[0]?.requests[0]?.request.path, null);
  assert.equal(report.pageErrors[0]?.exceptionType, "SecurityError");
  assert.deepEqual(report.pageErrors[0]?.observedDocument, { kind: "about-blank", path: null });
  assert.deepEqual(report.pageErrors[0]?.location, { source: "frontend", path: "/src/main.tsx", line: 15, column: 9 });
  assert.equal(report.pageErrors[1]?.exceptionType, null);
  assert.deepEqual(report.pageErrors[1]?.observedDocument, { kind: "frontend", path: "/login" });
  assert.deepEqual(report.pageErrors[1]?.location, { source: "other", path: null, line: 9, column: 2 });
  assert.doesNotMatch(JSON.stringify(report), /private-|privateFunction|127\.0\.0\.1/);
});

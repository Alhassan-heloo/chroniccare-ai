// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { createLoginNavigationObservation, loginStartupTimeout, observeSetupCompletion, probeFrontendLogin, waitForLoginReadiness } from "./admin-browser-bootstrap.mjs";

test("setup waits for each exact request to finish after its response", () => {
  const observed = observeSetupCompletion();
  const first = {}, second = {};
  assert.equal(observed.state(), "pending");
  observed.start(first, 10, "browser-bootstrap");
  observed.start(second, 11, "browser-bootstrap");
  observed.event(first, "response", 200);
  observed.event(second, "response", 200);
  observed.event(first, "requestfinished");
  observed.event({}, "requestfinished");
  assert.equal(observed.state(), "pending");
  observed.event(second, "requestfinished");
  assert.equal(observed.state(), "finished");
});

test("setup preserves the failed request's stage and terminal event", () => {
  const observed = observeSetupCompletion();
  const request = {};
  observed.start(request, 12, "temporary-doctor-login");
  observed.event(request, "response", 200);
  observed.event(request, "requestfailed");
  observed.event(request, "requestfinished");
  assert.equal(observed.state(), "failed");
  assert.deepEqual(observed.snapshot(), [{ requestId: 12, stage: "temporary-doctor-login", lastEvent: "requestfailed", status: 200 }]);
});

const loginUrl = "http://127.0.0.1:5195/login";
const signal = new AbortController().signal;
const html = { headers: { "Content-Type": "text/html; charset=utf-8" } };

test("the frontend probe checks the login HTML shell and rejects misleading HTTP responses", async () => {
  const available = await probeFrontendLogin(async (url, options) => {
    assert.equal(url, loginUrl);
    assert.equal(options?.redirect, "manual");
    return new Response('<div id="root"></div><script type="module" src="/src/main.tsx"></script>', html);
  }, loginUrl, signal);
  assert.deepEqual(available, { outcome: "html-shell-ready", status: 200 });
  assert.equal((await probeFrontendLogin(async () => new Response("{}"), loginUrl, signal)).outcome, "unexpected-http-response");
  assert.equal((await probeFrontendLogin(async () => new Response("<h1>Other document</h1>", html), loginUrl, signal)).outcome, "unexpected-html-shell");
  assert.equal((await probeFrontendLogin(async () => new Response("Unavailable", { status: 503 }), loginUrl, signal)).outcome, "unexpected-http-response");
});

test("the probe distinguishes a connection refusal from an unclassified lack of HTTP response", async () => {
  const refused = await probeFrontendLogin(async () => {
    throw new Error("sensitive-transport-text", { cause: { code: "ECONNREFUSED" } });
  }, loginUrl, signal);
  assert.deepEqual(refused, { outcome: "connection-failed", status: null });
  const missing = await probeFrontendLogin(async () => { throw new Error("sensitive-transport-text"); }, loginUrl, signal);
  assert.deepEqual(missing, { outcome: "no-http-response", status: null });
});

test("navigation observations distinguish document, DOM, load and resource failures", () => {
  const state = createLoginNavigationObservation();
  state.requestDocument();
  assert.equal(state.snapshot().progress, "no-document-response");
  state.failDocument("net::ERR_CONNECTION_REFUSED");
  assert.equal(state.snapshot().progress, "frontend-connection-failed");
  state.receiveDocument(200);
  assert.equal(state.snapshot().progress, "document-received-before-domcontentloaded");
  state.domReady();
  state.failResource();
  state.javascriptError();
  assert.equal(state.snapshot().progress, "domcontentloaded-before-load");
  assert.equal(state.snapshot().resourceFailures, 1);
  assert.equal(state.snapshot().javascriptErrors, 1);
  state.loaded();
  assert.equal(state.snapshot().progress, "load-observed");
  assert.equal(state.snapshot().uiReady, false);
});

test("a ready login UI does not require load and navigation and UI share the original budget", async () => {
  let now = 0;
  const observation = createLoginNavigationObservation();
  await waitForLoginReadiness({ observation, now: () => now,
    async navigate(options) {
      assert.deepEqual(options, { waitUntil: "domcontentloaded", timeout: loginStartupTimeout });
      now += 1250;
      observation.receiveDocument(200);
      observation.domReady();
      return { status: () => 200 };
    },
    async waitForUi(timeout) { assert.equal(timeout, loginStartupTimeout - 1250); },
  });
  assert.equal(observation.snapshot().uiReady, true);
  assert.equal(observation.snapshot().loadObserved, false);
});

test("a bad document or missing React UI still rejects the readiness check", async () => {
  const observation = createLoginNavigationObservation();
  await assert.rejects(waitForLoginReadiness({ observation, navigate: async () => ({ status: () => 503 }),
    waitForUi: async () => assert.fail("UI must not be accepted after a bad document") }), /did not return HTTP 200/);
  const failure = new Error("Login form did not render");
  await assert.rejects(waitForLoginReadiness({ observation, navigate: async () => ({ status: () => 200 }),
    waitForUi: async () => { throw failure; } }), error => error === failure);
  assert.equal(observation.snapshot().uiReady, false);
});

test("the UI wait cannot extend an exhausted startup budget", async () => {
  let now = 0;
  await assert.rejects(waitForLoginReadiness({ observation: createLoginNavigationObservation(), now: () => now,
    async navigate() { now = loginStartupTimeout; return { status: () => 200 }; },
    waitForUi: async () => assert.fail("No UI time remains"),
  }), /startup budget exhausted/);
});

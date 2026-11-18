import assert from "node:assert/strict";
import { once } from "node:events";
import test, { type TestContext } from "node:test";
import { createApp, type AppOptions } from "../src/app.js";
import type { AuthStore } from "../src/auth/store.js";
import { readTrustedProxy } from "../src/config/proxy.js";

const renderEnvironment = { RENDER: "true", RENDER_SERVICE_TYPE: "web", TRUST_RENDER_PROXY: "true" };
const origin = "https://clinic.example";
const auth: AuthStore = {
  async createUser() { throw new Error("No account writes expected."); },
  async findAccount() { return undefined; },
  async createSession() { throw new Error("No session writes expected."); },
  async sessionUser() { return undefined; },
  async deleteSession() { throw new Error("No session writes expected."); },
};

async function serve(t: TestContext, options: Partial<AppOptions> = {}) {
  const app = createApp({ corsOrigins: [origin], checkDatabase: async () => {}, authStore: auth,
    cookies: { secure: true, trustedProxy: readTrustedProxy(renderEnvironment) }, ...options });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  await once(server, "listening");
  const address = server.address(); assert(address && typeof address !== "string");
  return { app, base: `http://127.0.0.1:${address.port}` };
}

test("proxy configuration is opt-in, Render-only and preserves exact-IP deployments", () => {
  assert.equal(readTrustedProxy({}), undefined);
  assert.equal(readTrustedProxy({ RENDER: "true", RENDER_SERVICE_TYPE: "web" }), undefined);
  assert.equal(readTrustedProxy({ TRUST_RENDER_PROXY: "false" }), undefined);
  for (const ip of ["127.0.0.1", "192.0.2.9", "::1"]) {
    assert.equal(readTrustedProxy({ TRUST_PROXY_IP: ip }), ip);
    assert.equal(readTrustedProxy({ TRUST_PROXY_IP: ip, TRUST_RENDER_PROXY: "false" }), ip);
  }
  assert.equal(readTrustedProxy(renderEnvironment), 1);
  for (const env of [
    { TRUST_PROXY_IP: "true" }, { TRUST_PROXY_IP: "1" }, { TRUST_PROXY_IP: "10.0.0.0/8" },
    { TRUST_PROXY_IP: "127.0.0.1,192.0.2.1" }, { TRUST_RENDER_PROXY: "1" },
    { TRUST_RENDER_PROXY: "true" }, { ...renderEnvironment, RENDER: "false" },
    { ...renderEnvironment, RENDER_SERVICE_TYPE: "pserv" },
    { ...renderEnvironment, TRUST_PROXY_IP: "127.0.0.1" },
  ]) assert.throws(() => readTrustedProxy(env));
});

test("untrusted forwarding cannot satisfy production HTTPS", async t => {
  for (const cookies of [{ secure: true }, { secure: true, trustedProxy: "192.0.2.9" }]) {
    const { base } = await serve(t, { cookies });
    const response = await fetch(base + "/api/auth/csrf", { headers: {
      "X-Forwarded-Proto": "https", "X-Forwarded-For": "127.0.0.1", Forwarded: "proto=https", Origin: origin,
    } });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "HTTPS_REQUIRED");
    assert.deepEqual(response.headers.getSetCookie(), []);
  }
});

test("legacy exact-IP HTTPS forwarding continues to issue secure cookies", async t => {
  const { base } = await serve(t, { cookies: { secure: true, trustedProxy: readTrustedProxy({ TRUST_PROXY_IP: "127.0.0.1" }) } });
  assert.equal((await fetch(base + "/api/auth/csrf")).status, 400);
  assert.equal((await fetch(base + "/api/auth/csrf", { headers: { "X-Forwarded-Proto": "https" } })).status, 200);
});

test("Render ingress accepts one HTTPS protocol, preserves secure cookies, CORS and CSRF", async t => {
  const { app, base } = await serve(t);
  const trust = app.get("trust proxy fn") as (ip: string, hop: number) => boolean;
  assert.equal(app.get("trust proxy"), 1);
  assert.equal(trust("192.0.2.9", 0), true);
  assert.equal(trust("192.0.2.9", 1), false, "Upstream forwarded addresses are not trusted proxies.");
  for (const proto of [undefined, "http", "https, http", "http, https", "https, https"]) {
    const response = await fetch(base + "/api/auth/csrf", { headers: proto ? { "X-Forwarded-Proto": proto } : {} });
    assert.equal(response.status, 400);
    assert.deepEqual(response.headers.getSetCookie(), []);
  }
  const response = await fetch(base + "/api/auth/csrf", { headers: { "X-Forwarded-Proto": "https", Origin: origin } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  const cookie = response.headers.getSetCookie()[0]!;
  assert.match(cookie, /^__Host-cc_csrf=/);
  for (const attribute of ["Secure", "HttpOnly", "SameSite=Lax", "Path=/"]) assert(cookie.includes(attribute));
  assert(!cookie.includes("Domain="));
  const { csrfToken } = await response.json() as { csrfToken: string };
  const headers = { "X-Forwarded-Proto": "https", Origin: origin, Cookie: cookie.split(";")[0]! };
  const missingCsrf = await fetch(base + "/api/auth/logout", { method: "POST", headers });
  assert.equal(missingCsrf.status, 403);
  assert.equal((await missingCsrf.json() as { error: { code: string } }).error.code, "CSRF_INVALID");
  assert.equal((await fetch(base + "/api/auth/logout", { method: "POST", headers: { ...headers, "X-CSRF-Token": csrfToken } })).status, 401,
    "Valid CSRF still requires authentication.");
  assert.equal((await fetch(base + "/api/auth/csrf", { headers: { ...headers, Origin: "https://untrusted.example" } })).status, 403);
});

test("Render hop limit preserves rate limits despite spoofed leftmost forwarding addresses", async t => {
  const { base } = await serve(t);
  const register = (prefix: number, nearest = "198.51.100.25") => fetch(base + "/api/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https",
      "X-Forwarded-For": `192.0.2.${prefix}, ${nearest}` }, body: "{}",
  });
  for (let i = 1; i <= 20; i++) assert.equal((await register(i)).status, 400);
  const limited = await register(21);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json() as { error: { code: string } }).error.code, "RATE_LIMITED");
  assert.equal((await register(22, "198.51.100.26")).status, 400, "A different nearest untrusted address has a separate quota.");
});

test("production HTTP GET readiness alone checks the database and returns 200 without cookies", async t => {
  let checks = 0;
  const { base } = await serve(t, { cookies: { secure: true }, checkDatabase: async () => { checks++; } });
  const response = await fetch(base + "/api/health/ready");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", database: "up" });
  assert.equal(checks, 1);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(response.headers.getSetCookie(), []);
  for (const path of ["/api/health", "/api/auth/csrf", "/api/health/ready/extra", "/api/health/ready/"]) {
    assert.equal((await fetch(base + path)).status, 400);
  }
  for (const method of ["HEAD", "POST", "PUT", "DELETE"]) {
    assert.equal((await fetch(base + "/api/health/ready", { method })).status, 400);
  }
  assert.equal(checks, 1, "Other paths and methods never reach the readiness database check.");
});

test("production HTTP readiness returns sanitized 503 when the database is unavailable", async t => {
  let checks = 0;
  const { base } = await serve(t, { checkDatabase: async () => { checks++; throw new Error("private database details"); } });
  for (const headers of [new Headers(), new Headers({ "X-Forwarded-Proto": "https" })]) {
    const response = await fetch(base + "/api/health/ready", { headers });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unavailable", database: "down" });
    assert.deepEqual(response.headers.getSetCookie(), []);
  }
  assert.equal(checks, 2);
});

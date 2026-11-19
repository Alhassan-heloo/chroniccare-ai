import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import { createApp } from "../src/app.js";
import { requireFrontendBuild } from "../src/frontend.js";

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "chroniccare-built-ui-"));
  // This exact temporary directory is created/owned by this test, never user data.
  t.after(async () => {
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert(basename(directory).startsWith("chroniccare-built-ui-"));
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(join(directory, "assets")); await mkdir(join(directory, "api"));
  await writeFile(join(directory, "index.html"), '<!doctype html><html><body><div id="root">Built React shell</div><script src="/assets/app-hash.js"></script></body></html>');
  await writeFile(join(directory, "assets/app-hash.js"), "window.built=true;");
  await writeFile(join(directory, "api/blocked.json"), '{"mustNotServe":true}');
  await writeFile(join(directory, ".env"), "PRIVATE=must-not-serve");
  let down = false, checks = 0;
  const app = createApp({ corsOrigins: ["https://clinic.example"], frontendDirectory: directory,
    cookies: { secure: true, trustedProxy: "127.0.0.1" },
    checkDatabase: async () => { checks++; if (down) throw new Error("private database details"); } });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  await once(server, "listening");
  const address = server.address(); assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers); headers.set("X-Forwarded-Proto", "https");
    return fetch(base + path, { ...options, headers });
  };
  return { directory, base, request, outage: () => { down = true; }, checks: () => checks };
}

test("only an existing built index can enable frontend serving", () => {
  assert.throws(() => requireFrontendBuild(join(tmpdir(), "missing-chroniccare-build-directory")), /Built frontend index.html is missing/);
});

test("built static files and React deep links work with the existing HTTPS/CSP policy", async t => {
  const { base, request } = await fixture(t);
  for (const path of ["/", "/login", "/patient/dashboard", "/doctor/patients/record-id", "/admin/dashboard", "/patient/measurements?day=2026-11-19"]) {
    const response = await request(path, { headers: { Accept: "text/html" } });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type")!, /text\/html/);
    assert((await response.text()).includes("Built React shell"));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(response.headers.getSetCookie(), []);
    const scriptPolicy = response.headers.get("content-security-policy")!.split(";").find(value => value.trim().startsWith("script-src"));
    assert.equal(scriptPolicy?.trim(), "script-src 'self'");
  }
  const asset = await request("/assets/app-hash.js");
  assert.equal(asset.status, 200); assert.match(asset.headers.get("content-type")!, /javascript/);
  assert.equal(await asset.text(), "window.built=true;");
  const head = await request("/patient/dashboard", { method: "HEAD" });
  assert.equal(head.status, 200); assert.equal(await head.text(), "");
  assert.equal((await fetch(base + "/login")).status, 400, "Production HTML still requires HTTPS.");
});

test("API JSON404s cannot become frontend files or SPA HTML", async t => {
  const { request } = await fixture(t);
  for (const path of ["/api", "/api/missing", "/api/blocked.json", "/api/patient/dashboard", "/API/missing", "/%61pi/blocked.json"]) {
    const response = await request(path, { headers: { Accept: "text/html" } });
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get("content-type")!, /application\/json/);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "NOT_FOUND");
  }
});

test("missing assets, source/private paths, non-HTML requests and writes never get the SPA shell", async t => {
  const { request } = await fixture(t);
  for (const path of ["/assets/missing.js", "/assets/missing", "/cc-fcm/missing.js", "/src/main.tsx", "/node_modules/package", "/artifacts/private", "/.env", "/%2eenv", "/%2e%2e%2fbackend/.env"]) {
    const response = await request(path, { headers: { Accept: "text/html" } });
    assert.equal(response.status, 404, path);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "NOT_FOUND");
  }
  assert.equal((await request("/patient/dashboard", { headers: { Accept: "application/json" } })).status, 404);
  assert.equal((await request("/patient/dashboard", { method: "POST" })).status, 404);
});

test("existing readiness retains internal HTTP200/503 and its database check with frontend enabled", async t => {
  const { base, request, outage, checks } = await fixture(t);
  assert.deepEqual(await (await fetch(base + "/api/health/ready")).json(), { status: "ok", database: "up" });
  assert.equal(checks(), 1); outage();
  const unavailable = await fetch(base + "/api/health/ready");
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { status: "unavailable", database: "down" });
  assert.equal(checks(), 2);
  assert.equal((await request("/api/health")).status, 200);
});

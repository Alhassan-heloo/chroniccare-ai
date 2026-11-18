import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { once } from "node:events";
import express from "express";
import { createApp } from "../src/app.js";
import { errorHandler } from "../src/middleware/errors.js";
import { gzipSync } from "node:zlib";
import type { AuthStore } from "../src/auth/store.js";
import { tokenHash } from "../src/auth/security.js";
import { registrationContext } from "../src/notifications/registrations.js";

async function serve(t: TestContext, app: ReturnType<typeof express>) {
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

test("application initializes without a database and serves secure liveness", async (t) => {
  let checks = 0;
  const app = createApp({ corsOrigins: ["http://localhost:5173"], checkDatabase: async () => { checks++; } });
  assert.equal(checks, 0);
  const url = await serve(t, app);
  const response = await fetch(`${url}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "chroniccare-api" });
  assert.equal(checks, 0);
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("readiness performs its database check and reports success", async (t) => {
  let checks = 0;
  const url = await serve(t, createApp({ corsOrigins: [], checkDatabase: async () => { checks++; } }));
  const response = await fetch(`${url}/api/health/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", database: "up" });
  assert.equal(checks, 1);
});

test("database outage returns 503 without leaking driver details; liveness still works", async (t) => {
  const url = await serve(t, createApp({ corsOrigins: [], checkDatabase: async () => {
    throw new Error("postgresql://private:secret@internal/patients");
  } }));
  const response = await fetch(`${url}/api/health/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable", database: "down" });
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
});

test("CORS permits configured origins and rejects others", async (t) => {
  const url = await serve(t, createApp({ corsOrigins: ["http://localhost:5173"], checkDatabase: async () => {} }));
  const allowed = await fetch(`${url}/api/health`, { headers: { Origin: "http://localhost:5173" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
  const denied = await fetch(`${url}/api/health`, { headers: { Origin: "https://untrusted.example" } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
  const preflight = await fetch(`${url}/api/health`, { method: "OPTIONS", headers: {
    Origin: "http://localhost:5173", "Access-Control-Request-Method": "GET",
  } });
  assert.equal(preflight.status, 204);
});

test("unconfigured feature routes and unknown routes use a JSON 404", async (t) => {
  const url = await serve(t, createApp({ corsOrigins: [], checkDatabase: async () => {} }));
  for (const path of ["/api/measurements", "/api/medications", "/api/habits", "/api/users", "/api/auth/login", "/api/ai/chat", "/missing"]) {
    const response = await fetch(`${url}${path}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: { code: "NOT_FOUND", message: "API route not found." } });
  }
});

test("malformed JSON and oversized requests have safe explicit errors", async (t) => {
  const url = await serve(t, createApp({ corsOrigins: [], checkDatabase: async () => {} }));
  const malformed = await fetch(`${url}/api/unused`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: '{"broken":',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } });
  const large = await fetch(`${url}/api/unused`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: "x".repeat(33000) }),
  });
  assert.equal(large.status, 413);
});

test("central error handler does not expose unexpected exception contents", async (t) => {
  let reports = 0;
  const app = express();
  app.get("/failure", () => { throw new Error("secret-internal-details"); });
  app.use(errorHandler(() => { reports++; }));
  const url = await serve(t, app);
  const response = await fetch(`${url}/failure`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  assert.equal(reports, 1);
});

test("compressed JSON including trailing bytes is rejected without terminating the API", async(t)=>{
  const url=await serve(t,createApp({corsOrigins:[],checkDatabase:async()=>{}}));
  const compressed=gzipSync(JSON.stringify({value:"test"}));
  for(const body of [compressed,Buffer.concat([compressed,Buffer.from("invalid trailing bytes")])]) {
    const response=await fetch(url+"/api/unused",{method:"POST",headers:{"Content-Type":"application/json","Content-Encoding":"gzip"},body});
    assert.equal(response.status,415);
    assert.equal((await response.json() as {error:{code:string}}).error.code,"UNSUPPORTED_ENCODING");
    assert.equal((await fetch(url+"/api/health")).status,200);
  }
});

test("notification and FID HTTP contracts survive parser update (in-memory stores, no account writes)",async(t)=>{
  const token="a".repeat(64), csrf="b".repeat(64), hash=tokenHash(token);
  const user={id:"fixture-user",name:"Fixture",email:"fixture@example.test",role:"patient" as const};
  const unexpected=async()=>{throw new Error("Account writes are forbidden in this test");};
  const auth:AuthStore={createUser:unexpected,findAccount:unexpected,createSession:unexpected,deleteSession:unexpected,sessionUser:async value=>value===hash?user:undefined};
  let registered=false,read=false;
  const notification={id:"01234567-1234-1234-1234-0123456789ab",type:"connection_approved" as const,createdAt:new Date().toISOString(),readAt:null as string|null};
  const owned=(u:string,s?:string)=>{assert.equal(u,user.id);if(s!==undefined)assert.equal(s,hash);};
  const url=await serve(t,createApp({corsOrigins:["http://localhost:5173"],checkDatabase:async()=>{},authStore:auth,
    notificationStore:{list:async u=>{owned(u);return [notification];},unreadCount:async u=>{owned(u);return read?0:1;},read:async(u,id)=>{owned(u);if(id!==notification.id)return undefined;read=true;return {...notification,readAt:new Date().toISOString()};}},
    registrationStore:{status:async(u,s)=>{owned(u,s);return registered;},put:async(u,s,fid)=>{owned(u,s);assert.equal(fid,"c"+"A".repeat(21));registered=true;},remove:async(u,s)=>{owned(u,s);registered=false;}}}));
  const call=(path:string,method="GET",body?:unknown,csrfValid=true)=>fetch(url+"/api/notifications"+path,{method,
    headers:{Origin:"http://localhost:5173",Cookie:`cc_session=${token}; cc_csrf=${csrf}`,"X-CSRF-Token":csrfValid?csrf:"invalid","Content-Type":"application/json"},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.equal((await fetch(url+"/api/notifications")).status,401);
  assert.deepEqual(await(await call("/unread-count")).json(),{unreadCount:1});
  assert.equal((await call(`/${notification.id}/read`,"PUT",{})).status,200);
  assert.deepEqual(await(await call("/unread-count")).json(),{unreadCount:0});
  const body={fid:"c"+"A".repeat(21),context:registrationContext(hash)};
  assert.equal((await call("/browser-registration","PUT",body,false)).status,403);
  assert.equal((await call("/browser-registration","PUT",{...body,userId:"other"})).status,400);
  assert.equal((await call("/browser-registration","PUT",body)).status,204);
  assert.equal((await(await call("/browser-registration")).json() as {registered:boolean}).registered,true);
  assert.equal((await call("/browser-registration","DELETE",{context:body.context})).status,204);
  assert.equal(registered,false);
});

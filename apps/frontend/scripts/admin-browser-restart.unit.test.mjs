// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { closeDoctorPageForRestart, seedApplicationPreferences } from "./admin-browser-restart.mjs";

const app = "http://127.0.0.1:5195";
const api = "http://127.0.0.1:3315/api";
const initScript = `(${seedApplicationPreferences.toString()})(applicationOrigin)`;

test("the serialized initializer does not access storage on blank or foreign documents", () => {
  for (const origin of ["null", "https://example.test"]) {
    let storageReads = 0;
    runInNewContext(initScript, { location: { origin }, applicationOrigin: app,
      get localStorage() { storageReads++; return { setItem() { assert.fail("Storage write outside the application origin"); } }; } });
    assert.equal(storageReads, 0);
  }
});

test("the initializer seeds the application document and propagates its storage exceptions", () => {
  const values = new Map();
  runInNewContext(initScript, { location: { origin: app }, applicationOrigin: app,
    localStorage: { setItem: values.set.bind(values) } });
  assert.deepEqual([...values], [["cc-language", "en"], ["cc-theme", "dark"], ["cc-public-motion", "paused"]]);
  const securityError = new Error("Storage access denied");
  securityError.name = "SecurityError";
  assert.throws(() => runInNewContext(initScript, { location: { origin: app }, applicationOrigin: app,
    localStorage: { setItem() { throw securityError; } } }), error => error === securityError);
});

function restartFixture() {
  const calls = /** @type {string[]} */ ([]);
  const options = {
    api,
    page: { async close() { calls.push("close-page"); } },
    context: { async cookies() { calls.push("read-same-context"); return [{ name: "cc_session", value: "synthetic-session" }]; } },
    async waitForIdle() { calls.push("browser-idle"); },
    assertIdle() { calls.push("recheck-browser-idle"); },
    async armBackend() { calls.push("arm-backend"); },
    async drainBackend() { calls.push("drain-backend"); },
  };
  return { options, calls };
}

test("closes only the page after both idle checks and verifies the same context cookie before drain", async () => {
  const { options, calls } = restartFixture();
  await closeDoctorPageForRestart(options);
  assert.deepEqual(calls, ["read-same-context", "browser-idle", "arm-backend", "recheck-browser-idle", "close-page", "read-same-context", "drain-backend"]);
});

test("a pending request or failed backend arming leaves the page open", async () => {
  for (const step of ["waitForIdle", "armBackend", "assertIdle"]) {
    const { options, calls } = restartFixture();
    const failure = new Error("Drain could not be proven");
    const fail = () => { throw failure; };
    if (step === "waitForIdle") options.waitForIdle = async () => fail();
    else if (step === "armBackend") options.armBackend = async () => fail();
    else options.assertIdle = fail;
    await assert.rejects(closeDoctorPageForRestart(options), error => error === failure);
    assert(!calls.includes("close-page"));
    assert(!calls.includes("drain-backend"));
  }
});

test("loss of the original cookie prevents restart without printing the cookie", async () => {
  const { options, calls } = restartFixture();
  options.context.cookies = async () => calls.includes("close-page") ? [] : [{ name: "cc_session", value: "synthetic-session" }];
  await assert.rejects(closeDoctorPageForRestart(options), /Closing the page changed the doctor session cookie/);
  assert(!calls.includes("drain-backend"));
});

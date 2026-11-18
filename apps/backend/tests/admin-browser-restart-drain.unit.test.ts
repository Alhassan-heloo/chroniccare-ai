import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createRestartDrain } from "./support/admin-browser-restart-drain.js";

function response() { return Object.assign(new EventEmitter(), { writableFinished: false }); }

test("refuses to arm while a server response is still active", () => {
  const drain = createRestartDrain();
  const active = response();
  drain.track(active);
  assert.throws(() => drain.arm(), /BACKEND_NOT_IDLE/);
  active.writableFinished = true;
  active.emit("finish");
  drain.arm();
  drain.assertDrained();
});

test("a response admitted after arming must finish, and finish plus close settle it once", () => {
  const drain = createRestartDrain();
  drain.arm();
  const admitted = response();
  drain.track(admitted);
  assert.throws(() => drain.assertDrained(), /DRAIN_NOT_PROVEN/);
  admitted.writableFinished = true;
  admitted.emit("finish");
  admitted.emit("close");
  drain.assertDrained();
});

test("a client disconnect while armed is not evidence that a handler finished", () => {
  const drain = createRestartDrain();
  drain.arm();
  const cancelled = response();
  drain.track(cancelled);
  cancelled.emit("close");
  assert.throws(() => drain.assertDrained(), /DRAIN_NOT_PROVEN/);
});

test("unexpected backend work errors prevent acknowledgement during restart", () => {
  const drain = createRestartDrain();
  drain.arm();
  drain.reportUnexpectedError();
  assert.throws(() => drain.assertDrained(), /DRAIN_NOT_PROVEN/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readEnvironment } from "../src/config/env.js";

const base = { DATABASE_URL: "postgresql://example:unused@localhost:5432/chroniccare_test" };

test("environment has local defaults and accepts explicit configuration", () => {
  const config = readEnvironment(base);
  assert.equal(config.port, 3001);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.databaseSsl, "disable");
  assert.deepEqual(config.corsOrigins, ["http://localhost:5173", "http://127.0.0.1:5173"]);
  assert.equal(readEnvironment({ ...base, PORT: "4100" }).port, 4100);
});

test("invalid environment is rejected without exposing credentials", () => {
  const secretUrl = "postgresql://example:must-not-leak@localhost:5432/chroniccare?sslmode=no-verify";
  for (const env of [
    {}, { DATABASE_URL: "https://invalid.example/db" },
    { ...base, PORT: "0" }, { ...base, PORT: "3001.5" },
    { ...base, NODE_ENV: "staging" }, { ...base, HOST: "" },
    { ...base, CORS_ORIGINS: "*" }, { ...base, CORS_ORIGINS: "https://example.com/path" },
    { ...base, DATABASE_SSL: "no-verify" },
    { ...base, DATABASE_SSL_CA_FILE: "ca.pem" },
    { ...base, NODE_ENV: "production" }, { DATABASE_URL: secretUrl },
  ]) {
    assert.throws(() => readEnvironment(env), (error: unknown) =>
      error instanceof Error && !error.message.includes("must-not-leak"));
  }
  assert.equal(readEnvironment({ ...base, NODE_ENV: "production", DATABASE_SSL: "verify-full" }).databaseSsl, "verify-full");
});

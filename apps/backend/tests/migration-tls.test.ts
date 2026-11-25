import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, chmod, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createSecureContext, TLSSocket } from "node:tls";
import test from "node:test";
import type { Environment } from "../src/config/env.js";
import {
  MigrationDiagnosticError, migrationConnectionFailure, migrationQueryFailure, parseMigrationLogin, requireDiagnosticCredential,
} from "../src/db/migration-diagnostics.js";
import { createMigrationPool } from "../src/db/migration-pool.js";
import { applyMigrations } from "../src/db/migrations.js";
import { createDatabasePool } from "../src/db/pool.js";

const pgBin = process.env.MIGRATION_TLS_PG_BIN;
const openssl = process.env.MIGRATION_TLS_OPENSSL;
const owner = "tls_migration_test";
const password = "local-fixture-only";
const directoryPrefix = "chroniccare-migration-tls-";

test("migration URL validation decodes credentials once and rejects unsafe input before connecting", () => {
  const expected = {host:"127.0.0.1",port:5432,database:"fixture",user:"fixture"};
  const synthetic = "postgresql://fixture:sample space%2B@127.0.0.1/fixture";
  const require = createRequire(import.meta.url);
  const legacy: {parse(value: string): {password: string}} = require("pg-connection-string");
  assert.notEqual(legacy.parse(synthetic).password, "sample space+");
  assert.deepEqual(parseMigrationLogin(synthetic, expected), {...expected,password:"sample space+"});
  assert.equal(parseMigrationLogin(synthetic.replace("sample space%2B", "%25%2F%3F%40%3A"),expected).password, "%/?@:");
  for (const [value, reason] of [
    [undefined, "missing-url-input"],
    ["", "missing-url-input"],
    ["   ", "missing-url-input"],
    [synthetic + "\t", "url-control-character"],
    [synthetic + "\r\n", "url-control-character"],
    [synthetic + "\u0000", "url-control-character"],
    [`"${synthetic}"`, "unexpected-url-wrapper"],
    ["psql " + synthetic, "unexpected-url-wrapper"],
    ["$env:DATABASE_URL=" + synthetic, "unexpected-url-wrapper"],
    ["this is not a URI", "malformed-url"],
    [synthetic.replace("%2B", "%ZZ"), "invalid-credential-encoding"],
    [synthetic+"?sslmode=disable", "target-or-url-options-rejected"],
    [synthetic.replace("127.0.0.1", "127.0.0.2"), "target-or-url-options-rejected"],
  ] as const) {
    assert.throws(() => parseMigrationLogin(value,expected), {stage:"connection-url-validation",reason});
  }
});

test("credential transfer rejects missing or truncated Node input without logging input details", () => {
  const fixture = "synthetic-ع-😀";
  assert.equal(requireDiagnosticCredential(fixture, String(fixture.length)), fixture);
  for (const [source, length] of [[undefined,"1"], ["","1"], [fixture,undefined], [fixture,"01"],
    [fixture,String(fixture.length+1)]] as const) {
    assert.throws(() => requireDiagnosticCredential(source,length), {
      stage:"credential-transfer", reason:"credential-transfer-failed", message:"credential-transfer: credential-transfer-failed",
    });
  }
});

test("diagnostic classification keeps only known stages and reasons", () => {
  const fake = "fixture private connection text";
  const dns = migrationConnectionFailure(Object.assign(new Error(fake),{code:"ENOTFOUND"}),"tcp-connection");
  assert.deepEqual([dns.stage,dns.reason], ["dns-resolution","lookup-failed"]);
  const timeout = migrationConnectionFailure(new Error("Connection terminated due to connection timeout", {
    cause:new MigrationDiagnosticError("tls-handshake","connection-failed-at-last-observed-stage"),
  }),"tcp-connection");
  assert.deepEqual([timeout.stage,timeout.reason], ["tls-handshake","connection-timeout"]);
  const signature = migrationConnectionFailure(new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match"),
    "scram-sha-256-plus-verification");
  assert.equal(signature.reason,"server-signature-mismatch");
  for (const [code, stage, reason] of [
    ["42704","read-only-transaction-initialization","object-or-setting-missing"],
    ["42P01","migration-ledger-verification","relation-missing"],
    ["42703","schema-checks","column-missing"],
    ["55P03","lock-checks","lock-unavailable"],
  ] as const) {
    const result = migrationQueryFailure(Object.assign(new Error(fake),{code}),stage);
    assert.deepEqual([result.stage,result.reason],[stage,reason]);
    assert(!result.message.includes(fake));
    assert.equal(result.cause,undefined);
  }
});

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") reject(new Error("Expected a loopback TCP address."));
      else resolve(address.port);
    });
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

const localEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^PG/i.test(name)));
const run = (file: string, args: string[], stdio: "pipe" | "ignore" = "pipe") => execFileSync(file, args, {
  env: localEnv, timeout: 25_000, windowsHide: true, stdio,
});

function fixtureMigration(version: string, sql: string) {
  return { version, name: `${version}_fixture.sql`, sql, checksum: createHash("sha256").update(sql).digest("hex") };
}

test("migration TLS against isolated PostgreSQL", {
  skip: !pgBin || !openssl ? "Set MIGRATION_TLS_PG_BIN and MIGRATION_TLS_OPENSSL to run the isolated test." : false,
  timeout: 90_000,
}, async (t) => {
  assert(pgBin && openssl);
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(join(parent, directoryPrefix));
  const data = join(directory, "data");
  const key = join(data, "server.key");
  const cert = join(data, "server.crt");
  const wrongCa = join(directory, "different.crt");
  const pwfile = join(directory, "fixture-password");
  const binary = (name: string) => join(pgBin, process.platform === "win32" ? `${name}.exe` : name);
  let startAttempted = false;
  let closePool = () => Promise.resolve();
  t.after(async () => {
    await closePool();
    if (startAttempted && spawnSync(binary("pg_ctl"), ["-D", data, "status"], {
      env: localEnv, timeout: 5_000, windowsHide: true, stdio: "ignore",
    }).status === 0) {
      run(binary("pg_ctl"), ["-D", data, "-m", "fast", "-w", "-t", "10", "stop"], "ignore");
    }
    const resolved = await realpath(directory);
    assert.equal(dirname(resolved), parent);
    assert(basename(resolved).startsWith(directoryPrefix));
    await rm(resolved, { recursive: true, force: true });
  });

  await writeFile(pwfile, `${password}\n`, { mode: 0o600 });
  run(binary("initdb"), ["-D", data, "-U", owner, "--auth=scram-sha-256", `--pwfile=${pwfile}`, "--locale=C", "--encoding=UTF8", "--no-sync"]);
  for (const [privateKey, certificate] of [[key, cert], [join(directory, "different.key"), wrongCa]] as const) {
    run(openssl, ["req", "-x509", "-nodes", "-newkey", "rsa:2048", "-days", "1", "-subj", "/CN=chroniccare-isolated",
      "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", privateKey, "-out", certificate]);
  }
  if (process.platform !== "win32") await chmod(key, 0o600);
  const reserve = createServer();
  const port = await listen(reserve);
  await close(reserve);
  await appendFile(join(data, "postgresql.conf"), `\nlisten_addresses='127.0.0.1,::1'\nport=${port}\nssl=on\n`);
  await writeFile(join(data, "pg_hba.conf"), [
    "hostssl all tls_trust_test 127.0.0.1/32 trust",
    "hostssl all tls_password_test 127.0.0.1/32 password",
    "hostssl all tls_md5_test 127.0.0.1/32 md5",
    "hostssl all all 127.0.0.1/32 scram-sha-256",
    "hostssl all all ::1/128 scram-sha-256",
    "",
  ].join("\n"));
  startAttempted = true;
  // On Windows postgres can inherit pg_ctl's output handles and keep a pipe open.
  run(binary("pg_ctl"), ["-D", data, "-l", join(directory, "postgres.log"), "-w", "-t", "12", "start"], "ignore");

  const config = (user = owner, host = "127.0.0.1", ca = cert, serverPort = port): Environment => ({
    nodeEnv: "production", host: "127.0.0.1", port: 3001, corsOrigins: [],
    databaseUrl: `postgresql://${user}:${password}@${host}:${serverPort}/postgres`, databaseSsl: "verify-full", databaseSslCaFile: ca,
  });
  const pool = createMigrationPool(config());
  closePool = () => pool.end();
  await pool.query(`CREATE ROLE tls_trust_test LOGIN;
    CREATE ROLE tls_password_test LOGIN PASSWORD '${password}';
    CREATE ROLE tls_encoded_test LOGIN PASSWORD 'sample space+';
    SET password_encryption = 'md5';
    CREATE ROLE tls_md5_test LOGIN PASSWORD '${password}'; RESET password_encryption;`);

  await t.test("verified certificate and SCRAM-PLUS allow a query", async () => {
    assert.equal((await pool.query("SELECT 1 AS result")).rows[0]?.result, 1);
  });

  for (const [name, options, expected] of [
    ["rejects an untrusted certificate", config(owner, "127.0.0.1", wrongCa),
      {stage:"certificate-hostname-verification",reason:"certificate-verification-failed"}],
    ["rejects a hostname mismatch with a trusted certificate", config(owner, "localhost"),
      {stage:"certificate-hostname-verification",reason:"hostname-mismatch"}],
    ["rejects TLS trust authentication without channel binding", config("tls_trust_test"),
      {stage:"authentication",reason:"ready-without-verified-channel-binding"}],
    ["rejects cleartext-password authentication over TLS", config("tls_password_test"),
      {stage:"authentication",reason:"cleartext-fallback-rejected"}],
    ["rejects MD5-password authentication over TLS", config("tls_md5_test"),
      {stage:"authentication",reason:"md5-fallback-rejected"}],
    ["classifies credentials rejected by PostgreSQL", {...config(),databaseUrl:config().databaseUrl.replace(password,"fixture-invalid")},
      {stage:"authentication",reason:"credentials-or-role-rejected"}],
  ] as const) {
    await t.test(name, async () => {
      const candidate = createMigrationPool(options);
      try {
        await assert.rejects(candidate.query("SELECT 1"), expected);
      } finally { await candidate.end(); }
    });
  }

  await t.test("refuses plain SCRAM before sending a SASL reply", async () => {
    const secureContext = createSecureContext({ key: await readFile(key), cert: await readFile(cert) });
    let offered = false;
    let replied = false;
    const server = createServer(raw => {
      raw.once("data", request => {
        if (!request.equals(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]))) { raw.destroy(); return; }
        raw.write("S");
        const socket = new TLSSocket(raw, { isServer: true, secureContext });
        socket.on("error", () => socket.destroy());
        socket.once("data", () => {
          offered = true;
          const mechanisms = Buffer.from("SCRAM-SHA-256\0\0");
          const reply = Buffer.alloc(9);
          reply.write("R");
          reply.writeInt32BE(8 + mechanisms.length, 1);
          reply.writeInt32BE(10, 5);
          socket.on("data", () => { replied = true; socket.destroy(); });
          socket.write(Buffer.concat([reply, mechanisms]));
        });
      });
    });
    const candidate = createMigrationPool(config(owner, "127.0.0.1", cert, await listen(server)));
    try {
      await assert.rejects(candidate.query("SELECT 1"), {stage:"scram-sha-256-plus-verification",reason:"scram-plus-not-offered"});
      assert(offered);
      assert(!replied);
    } finally {
      await candidate.end();
      await close(server);
    }
  });

  await t.test("the ordinary application pool still accepts an authorized TLS connection", async () => {
    const ordinary = createDatabasePool(config("tls_trust_test"));
    try { assert.equal((await ordinary.query("SELECT 1 AS result")).rows[0]?.result, 1); }
    finally { await ordinary.end(); }
  });

  await t.test("distinguishes a refused TCP connection from TLS negotiation refusal", async () => {
    const raw = createServer(socket => {socket.once("data", () => socket.end("N"));});
    const localPort = await listen(raw);
    const noTls = createMigrationPool(config(owner,"127.0.0.1",cert,localPort));
    try { await assert.rejects(noTls.query("SELECT 1"), {stage:"tls-handshake",reason:"tls-not-offered"}); }
    finally { await noTls.end(); await close(raw); }
    const refused = createMigrationPool(config(owner,"127.0.0.1",cert,localPort));
    try { await assert.rejects(refused.query("SELECT 1"), {stage:"tcp-connection",reason:"connection-refused"}); }
    finally { await refused.end(); }
  });

  await t.test("structured login fixes encoded password and forces read-only before the first query", async () => {
    const login = parseMigrationLogin(`postgresql://tls_encoded_test:sample space%2B@127.0.0.1:${port}/postgres`,
      {host:"127.0.0.1",port,database:"postgres",user:"tls_encoded_test"});
    const diagnostic = createMigrationPool({...config(),databaseUrl:""}, {login,readOnly:true});
    try {
      const result = await diagnostic.query("SELECT current_setting('transaction_read_only') AS current, current_setting('default_transaction_read_only') AS default");
      assert.deepEqual(result.rows, [{current:"on",default:"on"}]);
      await assert.rejects(diagnostic.query("CREATE TABLE public.diagnostic_only_probe(id integer)"),{code:"25006"});
      assert.equal((await diagnostic.query("SELECT to_regclass('public.diagnostic_only_probe') AS table_name")).rows[0]?.table_name,null);
    } finally { await diagnostic.end(); }
  });

  await t.test("scoped runner rejects a missing ledger and preserves hash, locks and rollback", async () => {
    const first = fixtureMigration("001", "CREATE TABLE public.scope_fixture(id integer PRIMARY KEY)");
    const second = fixtureMigration("002", "ALTER TABLE public.scope_fixture ADD COLUMN done boolean NOT NULL DEFAULT false");
    const failing = fixtureMigration("002", `${second.sql}; SELECT 1 / 0`);
    await assert.rejects(applyMigrations(pool, [first], first), /does not exist/);
    assert.equal((await pool.query("SELECT to_regclass('public.chroniccare_schema_migrations') AS ledger")).rows[0]?.ledger, null);
    assert.deepEqual(await applyMigrations(pool, [first]), [first.name]);
    await assert.rejects(applyMigrations(pool, [first, second], failing), /authorized pending/);
    await assert.rejects(applyMigrations(pool, [first, failing], failing), /division by zero/);
    const rolledBack = await pool.query("SELECT count(*)::int AS count FROM pg_attribute WHERE attrelid='public.scope_fixture'::regclass AND attname='done'");
    assert.equal(rolledBack.rows[0]?.count, 0);
    const results = await Promise.allSettled([
      applyMigrations(pool, [first, second], second), applyMigrations(pool, [first, second], second),
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const ledger = await pool.query("SELECT checksum FROM public.chroniccare_schema_migrations WHERE version='002'");
    assert.deepEqual(ledger.rows, [{ checksum: second.checksum }]);
  });
});

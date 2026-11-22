import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { postgresAdminStore } from "../src/admin/store.js";
import { createApp } from "../src/app.js";
import { hashPassword, newToken, tokenHash } from "../src/auth/security.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { postgresConnectionStore } from "../src/connections/store.js";
import { applyMigrations } from "../src/db/migrations.js";
import { doctorReadTransaction } from "../src/doctor/read-transaction.js";
import { postgresDoctorStore } from "../src/doctor/store.js";
import { HttpError } from "../src/middleware/errors.js";

async function blockedPid(pool: pg.Pool, application: string, blocker: number, queryText: string, count = 1) {
  const deadline = performance.now() + 650;
  do {
    const { rows } = await pool.query<{ pid: number }>(`SELECT pid FROM pg_stat_activity
      WHERE application_name=$1 AND $2=ANY(pg_blocking_pids(pid)) AND position($3 in query)>0`, [application, blocker, queryText]);
    if (rows.length >= count) return rows[0]!.pid;
    await delay(10);
  } while (performance.now() < deadline);
  assert.fail("Expected a PostgreSQL lock wait: " + queryText);
}

function httpError(code: string) {
  return (error: unknown) => error instanceof HttpError && error.status === 503 && error.code === code;
}

test("PostgreSQL doctor read transaction ordering and cleanup", { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const target = new URL(process.env.TEST_DATABASE_URL!);
  assert(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) && target.pathname.endsWith("_test") && !target.search);
  if (process.env.DATABASE_URL) assert.notEqual(target.pathname, new URL(process.env.DATABASE_URL).pathname);
  const run = randomUUID();
  const application = "doctor-lock-" + run;
  const pool = new pg.Pool({ connectionString: target.href, application_name: application, max: 3, connectionTimeoutMillis: 1000 });
  const control = new pg.Pool({ connectionString: target.href, application_name: "doctor-lock-control", connectionTimeoutMillis: 1000 });
  const auth = postgresAuthStore(pool);
  const doctors = postgresDoctorStore(pool);
  const connections = postgresConnectionStore(pool);
  const admins = postgresAdminStore(pool);
  const transaction = doctorReadTransaction(pool);
  const emails = ["doctor", "patient", "admin"].map(role => `${role}-${run}@example.test`);
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  let patientId = "";
  const day = "2026-11-22";

  async function holding(sql: string, parameters: string[], action: (client: pg.PoolClient, pid: number) => Promise<void>) {
    const client = await control.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql, parameters);
      const result = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      await action(client, result.rows[0]!.pid);
    } finally {
      try { await client.query("ROLLBACK"); } finally { client.release(); }
    }
  }

  try {
    await applyMigrations(control);
    const passwordHash = await hashPassword(newToken());
    const doctor = await auth.createUser("Synthetic doctor", emails[0]!, passwordHash, "doctor");
    const patient = await auth.createUser("Synthetic patient", emails[1]!, passwordHash, "patient");
    const admin = await auth.createUser("Synthetic admin", emails[2]!, passwordHash, "admin");
    patientId = patient.id;
    const tokens = [newToken(), newToken(), newToken()] as const;
    async function createSession(token: string, id: string) {
      await auth.createSession(tokenHash(token), id, new Date(Date.now() + 3600_000));
    }
    await createSession(tokens[0], doctor.id);
    await createSession(tokens[1], patient.id);
    await createSession(tokens[2], admin.id);
    // Do not make a 750 ms application lock budget depend on launching a new Windows backend.
    const warmClients = await Promise.all([...Array.from({ length: 3 }, () => pool.connect()),
      ...Array.from({ length: 2 }, () => control.connect())]);
    for (const client of warmClients) client.release();
    await control.query(`INSERT INTO chroniccare.measurements(id,patient_id,kind,value,recorded_at)
      VALUES ($1,$2,'glucose',97,clock_timestamp())`, [randomUUID(), patient.id]);

    const pair = [doctor.id, patient.id];
    const deleteRelationship = "DELETE FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1 AND patient_id=$2";
    async function approve() {
      await control.query(`INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id,patient_approved_at)
        VALUES($1,$2,clock_timestamp()) ON CONFLICT DO NOTHING`, pair);
    }
    await approve();
    server = createApp({ corsOrigins: [], checkDatabase: async () => {}, authStore: auth,
      doctorStore: doctors, connectionStore: connections, adminStore: admins }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    function request(path: string, token: string, method = "GET") {
      return fetch(base + path, { method, headers: { Authorization: "Bearer " + token } });
    }
    const read = () => request(`/doctor/patients/${patient.id}?date=${day}`, tokens[0]);
    async function responseCode(response: Response, status: number, code: string) {
      assert.equal(response.status, status);
      const body = await response.json() as { error: { code: string } };
      assert.deepEqual(Object.keys(body), ["error"], "No partial patient data");
      assert.equal(body.error.code, code);
    }
    async function clean() {
      assert.equal(pool.waitingCount, 0);
      assert.equal(pool.idleCount, pool.totalCount);
      const result = await control.query(`SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND xact_start IS NOT NULL`, [application]);
      assert.equal(result.rowCount, 0);
    }
    const blockMeasurements = "LOCK TABLE chroniccare.measurements IN ACCESS EXCLUSIVE MODE";
    assert.equal((await read()).status, 200);

    await t.test("committed revocation wins over a waiting read", async () => {
      await holding(deleteRelationship, pair, async (client, pid) => {
        const pending = read();
        await blockedPid(control, application, pid, "FOR SHARE OF relationship");
        await client.query("COMMIT");
        await responseCode(await pending, 404, "DOCTOR_PATIENT_NOT_FOUND");
      });
      await clean();
      await approve();
    });

    await t.test("revocation rollback lets the waiting read succeed", async () => {
      await holding(deleteRelationship, pair, async (client, pid) => {
        const pending = read();
        await blockedPid(control, application, pid, "FOR SHARE OF relationship");
        await client.query("ROLLBACK");
        assert.equal((await pending).status, 200);
      });
      await clean();
    });

    await t.test("revocation waits for an authorized read", async () => {
      let pending: Promise<Response> | undefined;
      let removal: Promise<void> | undefined;
      try {
        await holding(blockMeasurements, [], async (client, pid) => {
          pending = read();
          const readPid = await blockedPid(control, application, pid, "FROM chroniccare.measurements");
          removal = connections.revoke(patient.id, doctor.id);
          await blockedPid(control, application, readPid, "DELETE FROM chroniccare.doctor_patient_relationships");
          await client.query("COMMIT");
          assert.equal((await pending).status, 200);
          await removal;
        });
        await responseCode(await read(), 404, "DOCTOR_PATIENT_NOT_FOUND");
        await clean();
      } finally {
        await Promise.allSettled([pending, removal]);
        await approve();
      }
    });

    await t.test("administrator disable waits for the read and old sessions lose access", async () => {
      let pending: Promise<Response> | undefined;
      let disabling: Promise<boolean> | undefined;
      try {
        await holding(blockMeasurements, [], async (client, pid) => {
          pending = read();
          const readPid = await blockedPid(control, application, pid, "FROM chroniccare.measurements");
          disabling = admins.disableDoctor!(doctor.id);
          await blockedPid(control, application, readPid, "SET disabled=true");
          await client.query("COMMIT");
          assert.equal((await pending).status, 200);
          assert.equal(await disabling, true);
        });
        await responseCode(await read(), 401, "UNAUTHENTICATED");
        assert.equal(await doctors.getPatientActivity(doctor.id, patient.id, day), undefined);
        assert.deepEqual(await doctors.listPatients(doctor.id), []);
      } finally {
        await Promise.allSettled([pending, disabling]);
        await control.query("UPDATE chroniccare.users SET disabled=false WHERE id=$1", [doctor.id]);
        await control.query("DELETE FROM chroniccare.sessions WHERE token_hash=$1", [tokenHash(tokens[0])]);
        await createSession(tokens[0], doctor.id);
      }
      await clean();
    });

    await t.test("disable committed before the account lock denies an already authenticated read", async () => {
      try {
        await holding("UPDATE chroniccare.users SET disabled=true WHERE id=$1", [doctor.id], async (client, pid) => {
          const pending = read();
          await blockedPid(control, application, pid, "FROM chroniccare.users doctor");
          await client.query("COMMIT");
          await responseCode(await pending, 404, "DOCTOR_PATIENT_NOT_FOUND");
        });
        await responseCode(await read(), 401, "UNAUTHENTICATED");
      } finally {
        await control.query("UPDATE chroniccare.users SET disabled=false WHERE id=$1", [doctor.id]);
      }
      await clean();
    });

    await t.test("lock timeout is temporary and rolls back partial work", async () => {
      await holding("LOCK TABLE chroniccare.medications IN ACCESS EXCLUSIVE MODE", [], async () => {
        await responseCode(await read(), 503, "DOCTOR_READ_BUSY");
        await clean();
      });
      assert.equal((await read()).status, 200);
    });

    await t.test("database cancellation after retrieving measurements returns no partial record", async () => {
      await holding("LOCK TABLE chroniccare.medications IN ACCESS EXCLUSIVE MODE", [], async (_client, pid) => {
        const pending = read();
        const readPid = await blockedPid(control, application, pid, "FROM chroniccare.medications");
        const result = await control.query<{ canceled: boolean }>("SELECT pg_cancel_backend($1) AS canceled", [readPid]);
        assert.equal(result.rows[0]!.canceled, true);
        await responseCode(await pending, 503, "DOCTOR_READ_TIMEOUT");
      });
      await clean();
      assert.equal((await read()).status, 200);
    });

    await t.test("a failed database connection is discarded before the next read", async () => {
      await holding("LOCK TABLE chroniccare.medications IN ACCESS EXCLUSIVE MODE", [], async (_client, pid) => {
        const pending = read();
        const readPid = await blockedPid(control, application, pid, "FROM chroniccare.medications");
        const result = await control.query<{ terminated: boolean }>("SELECT pg_terminate_backend($1,500) AS terminated", [readPid]);
        assert.equal(result.rows[0]!.terminated, true);
        await responseCode(await pending, 503, "DOCTOR_READ_UNAVAILABLE");
        assert.equal((await control.query("SELECT 1 FROM pg_stat_activity WHERE pid=$1", [readPid])).rowCount, 0);
      });
      await clean();
      assert.equal((await read()).status, 200);
    });

    await t.test("deadlock SQLSTATE is temporary and the client can be reused", async () => {
      await assert.rejects(() => transaction(db => db.query("DO $$ BEGIN RAISE EXCEPTION 'test' USING ERRCODE='40P01'; END $$")),
        httpError("DOCTOR_READ_UNAVAILABLE"));
      await clean();
    });

    await t.test("total deadline spans multiple statements and retains pool capacity after cleanup", async () => {
      const start = performance.now();
      await assert.rejects(() => transaction(async db => {
        await db.query("SELECT pg_sleep(2.15)");
        await db.query("SELECT pg_sleep(2.15)");
      }), httpError("DOCTOR_READ_TIMEOUT"));
      assert(performance.now() - start < 6000);
      await clean();
      assert.equal((await read()).status, 200);
    });

    await t.test("read admission leaves a spare connection in a three-client pool", async () => {
      await holding(blockMeasurements, [], async (client, pid) => {
        const reads = [doctors.getPatientRecord(doctor.id, patient.id, day), doctors.getPatientRecord(doctor.id, patient.id, day)];
        await blockedPid(control, application, pid, "FROM chroniccare.measurements", 2);
        await assert.rejects(() => doctors.getPatientRecord(doctor.id, patient.id, day), httpError("DOCTOR_READ_BUSY"));
        assert.equal((await pool.query("SELECT 1")).rowCount, 1);
        await client.query("COMMIT");
        assert((await Promise.all(reads)).every(Boolean));
      });
      await clean();
    });
  } finally {
    if (server) await new Promise<void>(resolve => { server!.close(() => resolve()); server!.closeAllConnections(); });
    try {
      if (patientId) await control.query("DELETE FROM chroniccare.measurements WHERE patient_id=$1", [patientId]);
      await control.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])", [emails]);
    } finally {
      await Promise.all([pool.end(), control.end()]);
    }
  }
});

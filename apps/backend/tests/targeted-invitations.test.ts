import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { hashPassword, tokenHash, newToken } from "../src/auth/security.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { postgresConnectionStore } from "../src/connections/store.js";
import { postgresDoctorStore } from "../src/doctor/store.js";
import { postgresMeasurementStore } from "../src/measurements/store.js";
import { postgresMedicationStore } from "../src/medications/store.js";
import { postgresHabitStore } from "../src/habits/store.js";
import { readEnvironment } from "../src/config/env.js";
import { createDatabasePool } from "../src/db/pool.js";
import { applyMigrations } from "../src/db/migrations.js";

test("PostgreSQL targeted invitations: intended account, consent, rejection, concurrency and revocation", { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = process.env.TEST_DATABASE_URL!;
  const target = new URL(url);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && target.pathname.endsWith("_test") && !target.search,
    "Use an isolated loopback PostgreSQL database ending in _test, without connection overrides.");
  if (process.env.DATABASE_URL) assert.notEqual(target.pathname, new URL(process.env.DATABASE_URL).pathname);
  const pool = createDatabasePool(readEnvironment({ NODE_ENV: "test", DATABASE_URL: url }));
  const auth = postgresAuthStore(pool), store = postgresConnectionStore(pool);
  const emails = Array.from({length:4},()=>randomUUID()+"@targeted-invitation.example.test");
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  try {
    await applyMigrations(pool);
    const password = await hashPassword(newToken());
    const users = await Promise.all((["doctor","patient","patient","admin"] as const).map((role,i)=>auth.createUser("Synthetic "+role,emails[i]!,password,role)));
    const [doctor,patient,other,admin] = users; assert(doctor && patient && other && admin);
    const tokens = users.map(()=>newToken());
    await Promise.all(users.map((user,i)=>auth.createSession(tokenHash(tokens[i]!),user.id,new Date(Date.now()+3600000))));
    const [dt,pt,ot,at]=tokens;
    server=createApp({corsOrigins:[],checkDatabase:async()=>{},authStore:auth,connectionStore:store,doctorStore:postgresDoctorStore(pool),measurementStore:postgresMeasurementStore(pool),medicationStore:postgresMedicationStore(pool),habitStore:postgresHabitStore(pool)}).listen(0,"127.0.0.1");
    await once(server,"listening");const address=server.address();assert(address && typeof address!=="string");
    const base=`http://127.0.0.1:${address.port}/api`;
    const request=(path:string,token?:string,body?:unknown,method=body?"POST":"GET")=>fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const issue=async(email:string)=>{
      const response=await request("/connections/invitations",dt,{email});assert.equal(response.status,201);assert.equal(response.headers.get("cache-control"),"no-store");
      const result=await response.json() as {token:string;expiresAt:string};assert.deepEqual(Object.keys(result).sort(),["expiresAt","token"]);assert.match(result.token,/^[A-Za-z0-9_-]{32}$/);assert(Date.parse(result.expiresAt)-Date.now()<=600000);return result;
    };
    const preview=(token:string,account=pt)=>request("/connections/invitations/preview",account,{token});
    const approve=(token:string,account=pt)=>request("/connections/invitations/approve",account,{token});
    const reject=(token:string,account=pt)=>request("/connections/invitations/reject",account,{token});
    const assertError = async (response: Response, status: number, code: string) => {
      assert.equal(response.status, status);
      const body = await response.json() as { error: { code: string }; doctor?: unknown };
      assert.equal(body.error.code, code);
      assert.equal(body.doctor, undefined);
    };
    const state = async (token: string) => {
      const result = await pool.query<{ consumed_at: Date | null; rejected: boolean }>(
        "SELECT consumed_at,rejected FROM chroniccare.patient_invitations WHERE token_hash=$1", [tokenHash(token)],
      );
      assert(result.rows[0]);
      return result.rows[0];
    };
    const relationshipCount = async () => (await pool.query(
      "SELECT 1 FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1 AND patient_id=$2", [doctor.id, patient.id],
    )).rowCount;
    const record=()=>request(`/doctor/patients/${patient.id}?date=2026-11-18`,dt);

    await t.test("only the intended authenticated patient can reject; retries and replay cannot grant consent", async () => {
      const { token } = await issue(patient.email);
      const missing = await issue(randomUUID() + "@missing.example.test");
      assert.equal((await request("/connections/invitations/reject", undefined, { token })).status, 401);
      assert.equal((await reject(token, dt)).status, 403);
      assert.equal((await reject(token, at)).status, 403);
      await assertError(await reject(token, ot), 403, "INVITATION_ACCOUNT_MISMATCH");
      await assertError(await reject(missing.token), 403, "INVITATION_ACCOUNT_MISMATCH");
      await assertError(await reject("_".repeat(32)), 404, "INVITATION_INVALID");
      await assertError(await reject("malformed"), 400, "INVALID_INPUT");
      await assertError(await request("/connections/invitations/reject", pt, { token, patientId: other.id }), 400, "INVALID_INPUT");
      assert.deepEqual(await state(token), { consumed_at: null, rejected: false });
      assert.equal((await preview(token)).status, 200);

      const retries = await Promise.all([reject(token), reject(token)]);
      assert.deepEqual(retries.map(response => response.status), [204, 204]);
      const rejected = await state(token);
      assert(rejected.consumed_at instanceof Date);
      assert.equal(rejected.rejected, true);
      assert.equal((await reject(token)).status, 204);
      assert.deepEqual(await state(token), rejected, "Retries preserve the original consumption time");
      await assertError(await reject(token, ot), 403, "INVITATION_ACCOUNT_MISMATCH");
      await assertError(await preview(token), 409, "INVITATION_REJECTED");
      await assertError(await approve(token), 409, "INVITATION_REJECTED");
      assert.equal(await relationshipCount(), 0);
      assert.equal((await record()).status, 404);
    });

    await t.test("concurrent approval and rejection allow exactly one decision", async () => {
      const { token } = await issue(patient.email);
      const [approval, rejection] = await Promise.all([approve(token), reject(token)]);
      assert.deepEqual([approval.status, rejection.status].sort(), [204, 409]);
      const winner = await state(token);
      assert(winner.consumed_at instanceof Date);
      if (approval.status === 204) {
        await assertError(rejection, 409, "INVITATION_USED");
        assert.equal(winner.rejected, false);
        assert.equal(await relationshipCount(), 1);
        assert.equal((await record()).status, 200);
      } else {
        await assertError(approval, 409, "INVITATION_REJECTED");
        assert.equal(winner.rejected, true);
        assert.equal(await relationshipCount(), 0);
        assert.equal((await record()).status, 404);
      }
      assert.equal((await request(`/connections/doctors/${doctor.id}`, pt, undefined, "DELETE")).status, 204);
      assert.equal((await approve(token)).status, 409, "The settled invitation cannot restore access");
    });

    assert.equal((await request("/connections/invitations",undefined,{email:patient.email})).status,401);
    assert.equal((await request("/connections/invitations",pt,{email:patient.email})).status,403);
    assert.equal((await request("/connections/invitations",at,{email:patient.email})).status,403);
    assert.equal((await request("/connections/invitations",dt,{email:patient.email,patientId:other.id})).status,400);
    const invitation=await issue(patient.email.toUpperCase());
    const missing=await issue(randomUUID()+"@missing.example.test");
    const roleMismatch=await issue(doctor.email);
    const relationship = (await pool.query<{created_at: Date}>(`INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id)
      VALUES($1,$2) RETURNING created_at`, [doctor.id,patient.id])).rows[0]!;
    const stored=await pool.query("SELECT * FROM chroniccare.patient_invitations WHERE token_hash=$1",[tokenHash(invitation.token)]);
    assert.equal(stored.rows[0].patient_id,patient.id);assert(!JSON.stringify(stored.rows).includes(invitation.token));
    assert.equal((await record()).status,404);
    const wrong=await preview(invitation.token,ot);assert.equal(wrong.status,403);assert(!(await wrong.text()).includes(doctor.name));
    assert.equal((await preview(missing.token)).status,403);assert.equal((await preview(roleMismatch.token)).status,403);
    assert.equal((await preview(invitation.token,dt)).status,403);
    const review=await preview(invitation.token);assert.equal(review.status,200);assert.deepEqual(await review.json(),{doctor:{id:doctor.id,name:doctor.name}});
    assert.equal((await record()).status,404,"Preview and cancellation without confirmation do not grant access");
    assert.equal((await approve(invitation.token,ot)).status,403);
    const race=await Promise.all([approve(invitation.token),approve(invitation.token)]);
    assert.deepEqual(race.map(response=>response.status).sort(),[204,409]);
    assert.equal((await record()).status,200);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1 AND patient_id=$2",[doctor.id,patient.id])).rowCount,1);
    const approved = (await pool.query<{created_at: Date; patient_approved_at: Date}>(`SELECT created_at,patient_approved_at
      FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1 AND patient_id=$2`, [doctor.id,patient.id])).rows[0]!;
    assert.deepEqual(approved.created_at, relationship.created_at);
    assert(approved.patient_approved_at instanceof Date);
    assert.equal((await preview(invitation.token)).status,409);assert.equal((await approve(invitation.token)).status,409);
    await t.test("rejection cannot revoke earlier consent", async () => {
      await assertError(await reject(invitation.token), 409, "INVITATION_USED");
      const fresh = await issue(patient.email);
      assert.equal((await reject(fresh.token)).status, 204);
      const current = await pool.query(`SELECT created_at,patient_approved_at FROM chroniccare.doctor_patient_relationships
        WHERE doctor_id=$1 AND patient_id=$2`, [doctor.id, patient.id]);
      assert.deepEqual(current.rows, [approved]);
      assert.equal((await record()).status, 200);
    });
    assert.equal((await request(`/connections/doctors/${doctor.id}`,pt,undefined,"DELETE")).status,204);
    assert.equal((await approve(invitation.token)).status,409);assert.equal((await record()).status,404,"Used invitation never restores revoked access");
    const expired=await issue(patient.email);
    await pool.query("UPDATE chroniccare.patient_invitations SET created_at=now()-interval '20 minutes',expires_at=now()-interval '10 minutes' WHERE token_hash=$1",[tokenHash(expired.token)]);
    assert.equal((await preview(expired.token)).status,404);assert.equal((await approve(expired.token)).status,404);
    await assertError(await reject(expired.token), 404, "INVITATION_INVALID");
    assert.deepEqual(await state(expired.token), { consumed_at: null, rejected: false });
    const disabled=await issue(patient.email);await pool.query("UPDATE chroniccare.users SET disabled=true WHERE id=$1",[doctor.id]);
    assert.equal((await preview(disabled.token)).status,404);assert.equal((await approve(disabled.token)).status,404);
    await assertError(await reject(disabled.token), 404, "INVITATION_INVALID");
  } finally {
    if(server)await new Promise<void>(resolve=>{server!.close(()=>resolve());server!.closeAllConnections();});
    try{await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])",[emails]);}finally{await pool.end();}
  }
});

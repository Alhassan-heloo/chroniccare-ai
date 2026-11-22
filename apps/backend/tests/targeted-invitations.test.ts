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

test("targeted invitations: neutral issuance, intended account, consent, expiry, concurrency, reuse and revocation", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = process.env.TEST_DATABASE_URL!;
  assert(new URL(url).pathname.endsWith("_test"));
  assert.notEqual(new URL(url).pathname, new URL(process.env.DATABASE_URL!).pathname);
  const pool = createDatabasePool(readEnvironment({...process.env,NODE_ENV:"test",DATABASE_URL:url}));
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
    const record=()=>request(`/doctor/patients/${patient.id}?date=2026-11-18`,dt);
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
    assert.equal((await request(`/connections/doctors/${doctor.id}`,pt,undefined,"DELETE")).status,204);
    assert.equal((await approve(invitation.token)).status,409);assert.equal((await record()).status,404,"Used invitation never restores revoked access");
    const expired=await issue(patient.email);
    await pool.query("UPDATE chroniccare.patient_invitations SET created_at=now()-interval '20 minutes',expires_at=now()-interval '10 minutes' WHERE token_hash=$1",[tokenHash(expired.token)]);
    assert.equal((await preview(expired.token)).status,404);assert.equal((await approve(expired.token)).status,404);
    const disabled=await issue(patient.email);await pool.query("UPDATE chroniccare.users SET disabled=true WHERE id=$1",[doctor.id]);
    assert.equal((await preview(disabled.token)).status,404);assert.equal((await approve(disabled.token)).status,404);
  } finally {
    if(server)await new Promise<void>(resolve=>{server!.close(()=>resolve());server!.closeAllConnections();});
    try{await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])",[emails]);}finally{await pool.end();}
  }
});

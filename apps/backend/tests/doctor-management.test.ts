import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {once} from "node:events";
import {createApp} from "../src/app.js";
import {createDatabasePool} from "../src/db/pool.js";
import {readEnvironment} from "../src/config/env.js";
import {applyMigrations} from "../src/db/migrations.js";
import {postgresAuthStore} from "../src/auth/store.js";
import {postgresAdminStore} from "../src/admin/store.js";
import {hashPassword,newToken,tokenHash} from "../src/auth/security.js";
test("doctor deletion: Admin only, all dependencies preserved, disable revokes access",{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=process.env.TEST_DATABASE_URL!;assert(new URL(url).pathname.endsWith("_test"));assert.notEqual(new URL(url).pathname,new URL(process.env.DATABASE_URL!).pathname);
 const pool=createDatabasePool(readEnvironment({...process.env,NODE_ENV:"test",DATABASE_URL:url}));
 const auth=postgresAuthStore(pool),store=postgresAdminStore(pool),emails=Array.from({length:5},()=>randomUUID()+"@doctor-delete.example.test");
 let server:ReturnType<ReturnType<typeof createApp>["listen"]>|undefined;
 try {
 await applyMigrations(pool);const password=newToken(),hash=await hashPassword(password);
 const users=[];for(const [i,role] of (["admin","patient","doctor","doctor","doctor"] as const).entries()) users.push(await auth.createUser("Deletion fixture",emails[i]!,hash,role));
 const [admin,patient,empty,linked,sessionDoctor]=users;assert(admin&&patient&&empty&&linked&&sessionDoctor);
 const at=newToken(),pt=newToken(),dt=newToken();for(const [token,user] of [[at,admin],[pt,patient],[dt,sessionDoctor]] as const) await auth.createSession(tokenHash(token),user.id,new Date(Date.now()+3600000));
 server=createApp({corsOrigins:["http://localhost:5173"],authStore:auth,adminStore:store,checkDatabase:async()=>{}}).listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert(address&&typeof address!=="string");
 const req=(id:string,token:string,disable=false)=>fetch(`http://127.0.0.1:${address.port}/api/admin/doctors/${id}${disable?"/disable":""}`,{method:disable?"POST":"DELETE",headers:{Authorization:`Bearer ${token}`}});
 assert.equal((await req(empty.id,"")).status,401);assert.equal((await req(empty.id,pt)).status,403);assert.equal((await req(empty.id,dt)).status,403);
 assert.equal((await req(patient.id,at)).status,404);assert.equal((await req("bad",at)).status,400);
 assert.equal((await req(empty.id,at)).status,204);assert.equal((await req(empty.id,at)).status,404);
 await pool.query("INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id) VALUES($1,$2)",[linked.id,patient.id]);
 assert.equal((await req(linked.id,at)).status,409);
 assert.equal((await pool.query("SELECT 1 FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1",[linked.id])).rowCount,1);
 // Sessions alone also block cascade deletion, and disabling is a separate action.
 assert.equal((await req(sessionDoctor.id,at)).status,409);
 assert.equal((await req(linked.id,pt,true)).status,403);
 assert.equal((await req(linked.id,at,true)).status,204);assert.equal((await req(sessionDoctor.id,at,true)).status,204);
 assert.equal(await auth.sessionUser(tokenHash(dt)),undefined);assert.equal(await auth.findAccount(sessionDoctor.email),undefined);
 await assert.rejects(()=>auth.createSession(tokenHash(newToken()),sessionDoctor.id,new Date(Date.now()+3600000),hash));
 const login=await fetch(`http://127.0.0.1:${address.port}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:sessionDoctor.email,password})});assert.equal(login.status,401);
 assert.equal((await pool.query("SELECT 1 FROM chroniccare.doctor_patient_relationships WHERE doctor_id=$1",[linked.id])).rowCount,1);
 assert.equal((await pool.query("SELECT 1 FROM chroniccare.users WHERE id=$1",[patient.id])).rowCount,1);
 assert.equal((await store.listDoctors()).find(d=>d.id===linked.id)?.disabled,true);
 // A non-clinical FK is checked too, even when its schema allows CASCADE.
 await pool.query("INSERT INTO chroniccare.doctor_connection_codes(code_hash,doctor_id) VALUES($1,$2)",[tokenHash(newToken()),sessionDoctor.id]);
 assert.equal((await req(sessionDoctor.id,at)).status,409);
 } finally {
 if(server)await new Promise<void>(resolve=>{server!.close(()=>resolve());server!.closeAllConnections();});
 await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])",[emails]);await pool.end();
 }
});

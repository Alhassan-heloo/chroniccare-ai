import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {randomUUID} from "node:crypto";
import {createApp} from "../src/app.js";
import {postgresAuthStore} from "../src/auth/store.js";
import {createDatabasePool,checkDatabase} from "../src/db/pool.js";
import {readEnvironment} from "../src/config/env.js";
import {applyMigrations} from "../src/db/migrations.js";
import {hashPassword,newToken,tokenHash} from "../src/auth/security.js";
test("authenticated me: reproduce missing 016 column, restore schema, login and restore all roles",{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=process.env.TEST_DATABASE_URL!;assert(new URL(url).pathname.endsWith("_test"));assert.notEqual(new URL(url).pathname,new URL(process.env.DATABASE_URL!).pathname);
 const pool=createDatabasePool(readEnvironment({...process.env,NODE_ENV:"test",DATABASE_URL:url}));
 await applyMigrations(pool);const client=await pool.connect();
 let server:ReturnType<ReturnType<typeof createApp>["listen"]>|undefined;
 try {
 await client.query("BEGIN");const store=postgresAuthStore(client),password=newToken(),hash=await hashPassword(password);
 const doctor=await store.createUser("Schema fixture",randomUUID()+"@schema.example.test",hash,"doctor");
 const token=newToken();await store.createSession(tokenHash(token),doctor.id,new Date(Date.now()+3600000));
 server=createApp({corsOrigins:["http://localhost:5173"],authStore:store,checkDatabase:()=>checkDatabase(client),reportError:()=>{}}).listen(0,"127.0.0.1");await once(server,"listening");const addr=server.address();assert(addr&&typeof addr!=="string");const base=`http://127.0.0.1:${addr.port}/api`;
 const me=(cookie?:string)=>fetch(base+"/auth/me",{headers:cookie?{Cookie:cookie}:{}});
 await client.query("SAVEPOINT schema_015");await client.query("ALTER TABLE chroniccare.users DROP COLUMN disabled");
 assert.equal((await me()).status,401);
 assert.equal((await me(`cc_session=${token}`)).status,500);
 await client.query("ROLLBACK TO SAVEPOINT schema_015");
 await client.query("SAVEPOINT capture_exception");await client.query("ALTER TABLE chroniccare.users DROP COLUMN disabled");
 await assert.rejects(()=>store.sessionUser(tokenHash(token)),(e:unknown)=>{const error=e as {code:string;message:string};assert.equal(error.code,"42703");assert.equal(error.message,"column u.disabled does not exist");return true;});
 await client.query("ROLLBACK TO SAVEPOINT capture_exception");
 await client.query("SAVEPOINT readiness_schema");await client.query("ALTER TABLE chroniccare.users DROP COLUMN disabled");
 assert.equal((await fetch(base+"/health/ready")).status,503);
 await client.query("ROLLBACK TO SAVEPOINT readiness_schema");
 assert.equal((await fetch(base+"/health/ready")).status,200);
 assert.equal((await me(`cc_session=${token}`)).status,200);
 for(const role of ["patient","doctor","admin"] as const){
 const user=await store.createUser("Role fixture",randomUUID()+"@schema.example.test",hash,role);
 const login=await fetch(base+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:user.email,password})});assert.equal(login.status,200);
 const cookie=login.headers.get("set-cookie")!.split(";")[0]!;
 const restored=await me(cookie);assert.equal(restored.status,200);assert.equal((await restored.json() as {user:{role:string}}).user.role,role);
 }
 }finally{if(server)await new Promise<void>(resolve=>{server!.close(()=>resolve());server!.closeAllConnections();});await client.query("ROLLBACK");client.release();await pool.end();}
});

import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {once} from "node:events";
import {createApp} from "../src/app.js";
import {createDatabasePool} from "../src/db/pool.js";
import {readEnvironment} from "../src/config/env.js";
import {applyMigrations} from "../src/db/migrations.js";
import {postgresAuthStore} from "../src/auth/store.js";
import {accountService} from "../src/auth/accounts.js";
import {hashPassword,verifyPassword,newToken,tokenHash} from "../src/auth/security.js";
import {postgresAdminStore} from "../src/admin/store.js";
test("direct doctor: admin only, validation, unique email, forced password change and session revocation",{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=process.env.TEST_DATABASE_URL!;assert(new URL(url).pathname.endsWith("_test"));assert.notEqual(new URL(url).pathname,new URL(process.env.DATABASE_URL!).pathname);
 const pool=createDatabasePool(readEnvironment({...process.env,NODE_ENV:"test",DATABASE_URL:url}));
 const auth=postgresAuthStore(pool), accounts=accountService(pool,{publicOrigin:"http://localhost:5173"});
 const emails=[0,1,2].map(()=>randomUUID()+"@direct-doctor.example.test");let server:ReturnType<ReturnType<typeof createApp>["listen"]>|undefined;
 try{await applyMigrations(pool);
 const admin=await auth.createUser("Admin fixture",emails[0]!,await hashPassword(newToken()),"admin"),patient=await auth.createUser("Patient fixture",emails[1]!,await hashPassword(newToken()),"patient");
 const at=newToken(),pt=newToken();await auth.createSession(tokenHash(at),admin.id,new Date(Date.now()+3600000));await auth.createSession(tokenHash(pt),patient.id,new Date(Date.now()+3600000));
 server=createApp({corsOrigins:["http://localhost:5173"],authStore:auth,adminStore:postgresAdminStore(pool),accountService:accounts,checkDatabase:async()=>{}}).listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert(address&&typeof address!=="string");
 const request=async(path:string,token:string,body?:unknown)=>fetch(`http://127.0.0.1:${address.port}/api${path}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
 const input={name:"Doctor fixture",email:emails[2]!};
 assert.equal((await request("/admin/doctors/direct",pt,input)).status,403);
 assert.equal((await request("/admin/doctors/direct",at,{...input,role:"admin"})).status,400);
 const result=await request("/admin/doctors/direct",at,input);assert.equal(result.status,201);assert.equal(result.headers.get("cache-control"),"no-store");
 const created=await result.json() as {temporaryPassword:string};assert(created.temporaryPassword.length>=32);const account=await auth.findAccount(input.email);assert(account?.mustChangePassword);assert(await verifyPassword(account.password_hash,created.temporaryPassword));
 assert.equal((await request("/admin/doctors/direct",at,input)).status,409);
 const login=await request("/auth/login","",{email:input.email,password:created.temporaryPassword});assert.equal(login.status,200);const signed=await login.json() as {token:string;user:{mustChangePassword?:boolean}};assert.equal(signed.user.mustChangePassword,true);
 assert.equal((await request("/admin/doctors",signed.token)).status,403);
 assert.equal((await request("/auth/me",signed.token)).status,200);
 assert.equal((await request("/auth/change-password",signed.token,{currentPassword:created.temporaryPassword,password:created.temporaryPassword})).status,400);
 const password="New-Doctor-password!"+newToken();assert.equal((await request("/auth/change-password",signed.token,{currentPassword:created.temporaryPassword,password})).status,204);
 assert.equal(await auth.sessionUser(tokenHash(signed.token)),undefined);assert.equal((await auth.findAccount(input.email))?.mustChangePassword,false);
 assert.equal((await request("/auth/login","",{email:input.email,password:created.temporaryPassword})).status,401);
 const next=await request("/auth/login","",{email:input.email,password});assert.equal(next.status,200);assert.equal((await next.json() as {user:{mustChangePassword?:boolean}}).user.mustChangePassword,undefined);
 }finally{if(server)await new Promise<void>(resolve=>{server!.close(()=>resolve());server!.closeAllConnections();});await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])",[emails]);await pool.end();}
});


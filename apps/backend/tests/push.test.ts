import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, generateKeyPairSync } from "node:crypto";
import { mkdtemp,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { createDatabasePool } from "../src/db/pool.js";
import { readEnvironment } from "../src/config/env.js";
import { applyMigrations } from "../src/db/migrations.js";
import { postgresAuthStore } from "../src/auth/store.js";
import { newToken,tokenHash } from "../src/auth/security.js";
import { postgresRegistrationStore } from "../src/notifications/registrations.js";
import { postgresNotificationStore } from "../src/notifications/store.js";
import { configurePush,dispatchOne,type PushProvider } from "../src/notifications/push.js";
import { configuredPush } from "../src/notifications/firebase.js";

test("HTTP v1 uses FID and opaque data only; configuration, failures and invalid FIDs",async()=>{
  assert.equal(await configuredPush({}),undefined);
  await assert.rejects(()=>configuredPush({FCM_ENABLED:"true"}));
  const dir=await mkdtemp(join(tmpdir(),"cc-push-"));
  try {
    const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
    const file=join(dir,"test-key.json");
    await writeFile(file,JSON.stringify({type:"service_account",client_email:"test@example.test",private_key:privateKey.export({format:"pem",type:"pkcs8"})}));
    let status=200, code="UNREGISTERED", fail=false, calls=0;
    const provider=await configuredPush({FCM_ENABLED:"true",FCM_PROJECT_ID:"test-project",GOOGLE_APPLICATION_CREDENTIALS:file},async(url,opts)=>{
      if (String(url).includes("oauth2")) return Response.json({access_token:"test-only",expires_in:3600});
      calls++; if(fail) throw new Error("simulated timeout");
      assert.equal(url,"https://fcm.googleapis.com/v1/projects/test-project/messages:send");
      const body=JSON.parse(String(opts?.body));
      assert.deepEqual(body,{message:{fid:"c"+"A".repeat(21),data:{deliveryId:"opaque"},webpush:{headers:{TTL:"60",Urgency:"normal"}}}});
      return Response.json(status===200?{name:"mock-message"}:{error:{details:[{errorCode:code}]}},{status});
    });
    assert(provider); assert.equal(await provider.send("c"+"A".repeat(21),"opaque"),"sent");
    status=404; assert.equal(await provider.send("c"+"A".repeat(21),"opaque"),"invalid");
    status=500; code="INTERNAL"; assert.equal(await provider.send("c"+"A".repeat(21),"opaque"),"retry");
    status=403; assert.equal(await provider.send("c"+"A".repeat(21),"opaque"),"permanent");
    fail=true; assert.equal(await provider.send("c"+"A".repeat(21),"opaque"),"retry"); assert.equal(calls,5);
  } finally { await rm(dir,{recursive:true}); }
});

test("PostgreSQL push: commit, no backfill, leases, retries, eligibility, receipt isolation",{skip:!process.env.TEST_DATABASE_URL && "Separate test DB required"},async()=>{
  const url=process.env.TEST_DATABASE_URL!; assert(new URL(url).pathname.endsWith("_test")); assert.notEqual(new URL(url).pathname,new URL(process.env.DATABASE_URL!).pathname);
  const pool=createDatabasePool(readEnvironment({...process.env,NODE_ENV:"test",DATABASE_URL:url}));
  const emails=[randomUUID()+"@push-delivery.example.test",randomUUID()+"@push-delivery.example.test"];
  const auth=postgresAuthStore(pool), regs=postgresRegistrationStore(pool), token=newToken(), otherToken=newToken();
  let server:ReturnType<ReturnType<typeof createApp>["listen"]>|undefined;
  try {
    await applyMigrations(pool); await configurePush(pool,false);
    const user=await auth.createUser("Push fixture",emails[0]!,"not-a-password","patient"), other=await auth.createUser("Other fixture",emails[1]!,"not-a-password","doctor");
    await auth.createSession(tokenHash(token),user.id,new Date(Date.now()+3600000)); await auth.createSession(tokenHash(otherToken),other.id,new Date(Date.now()+3600000));
    const fid="c"+"D".repeat(21); await regs.put(user.id,tokenHash(token),fid);
    const event=async()=> (await pool.query<{id:string}>("INSERT INTO chroniccare.notifications(user_id,type) VALUES($1,'connection_approved') RETURNING id",[user.id])).rows[0]!.id;
    const job=async(n:string)=>(await pool.query<{id:string;state:string;attempts:number}>("SELECT id,state,attempts FROM chroniccare.push_jobs WHERE notification_id=$1",[n])).rows[0]!;
    const old=await event(); await configurePush(pool,true); assert.equal(await job(old),undefined);
    const tx=await pool.connect(); await tx.query("BEGIN");
    await tx.query("INSERT INTO chroniccare.notifications(user_id,type) VALUES($1,'connection_revoked')",[user.id]);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.push_jobs WHERE session_hash=$1",[tokenHash(token)])).rowCount,0);
    await tx.query("ROLLBACK"); tx.release();
    let sent=0; const success:PushProvider={send:async(f,id)=>{assert.equal(f,fid);assert.match(id,/^[a-f0-9-]{36}$/);sent++;return "sent";}};
    const first=await event(); await Promise.all([dispatchOne(pool,success),dispatchOne(pool,success)]);
    assert.equal(sent,1); assert.equal((await job(first)).state,"sent"); await dispatchOne(pool,success); assert.equal(sent,1);
    server=createApp({
      corsOrigins:["http://localhost:5173"], checkDatabase:async()=>{},
      authStore:auth, notificationStore:postgresNotificationStore(pool), pushPool:pool,
    }).listen(0,"127.0.0.1");
    await once(server,"listening"); const address=server.address(); assert(address&&typeof address!=="string");
    const receipt=async(id:string,t:string)=>fetch(`http://127.0.0.1:${address.port}/api/notifications/push-receipt/${id}`,{headers:{Cookie:`cc_session=${t}`}});
    const firstId=(await job(first)).id;
    const lastSeen = async (sessionToken: string) => (await pool.query<{ last_seen_at: string }>(
      "SELECT last_seen_at::text FROM chroniccare.sessions WHERE token_hash=$1", [tokenHash(sessionToken)],
    )).rows[0]!.last_seen_at;
    assert.equal((await receipt(firstId,"")).status,401);
    const otherLastSeen = await lastSeen(otherToken);
    assert.equal((await receipt(firstId,otherToken)).status,404);
    assert.equal(await lastSeen(otherToken), otherLastSeen, "Rejected receipts must not refresh another session.");
    const before = await lastSeen(token);
    const accepted = await receipt(firstId,token);
    assert.equal(accepted.status,200);
    assert.deepEqual(await accepted.json(), { eligible: true });
    assert.equal(await lastSeen(token), before, "Accepted receipts must not refresh a session.");
    assert.equal((await receipt("-".repeat(36),token)).status,404);
    await pool.query("UPDATE chroniccare.users SET must_change_password=true WHERE id=$1", [user.id]);
    assert.equal((await receipt(firstId,token)).status,404);
    assert.equal(await lastSeen(token), before);
    await pool.query("UPDATE chroniccare.users SET must_change_password=false, disabled=true WHERE id=$1", [user.id]);
    assert.equal((await receipt(firstId,token)).status,404);
    assert.equal(await lastSeen(token), before);
    await pool.query("UPDATE chroniccare.users SET disabled=false WHERE id=$1", [user.id]);
    const failed=await event(); const retry:PushProvider={send:async()=>"retry"};
    for(let i=0;i<4;i++){await pool.query("UPDATE chroniccare.push_jobs SET due_at=now() WHERE notification_id=$1",[failed]);await dispatchOne(pool,retry);}
    assert.equal((await job(failed)).state,"failed"); assert.equal((await job(failed)).attempts,4);
    const revoked=await event(); await regs.remove(user.id,tokenHash(token)); await dispatchOne(pool,success); assert.equal((await job(revoked)).state,"skipped");
    assert.equal((await receipt(firstId,token)).status,404);
    await regs.put(user.id,tokenHash(token),fid);
    const expired=await event();
    const expiredId=(await job(expired)).id;
    assert.equal((await receipt(expiredId,token)).status,200);
    await pool.query("UPDATE chroniccare.sessions SET last_seen_at=now()-interval '1 hour' WHERE token_hash=$1",[tokenHash(token)]);
    const idleLastSeen = await lastSeen(token);
    assert.equal((await receipt(expiredId,token)).status,404);
    assert.equal(await lastSeen(token), idleLastSeen, "Push must not revive an idle session.");
    await dispatchOne(pool,success); assert.equal((await job(expired)).state,"skipped");
    await pool.query("UPDATE chroniccare.sessions SET last_seen_at=now() WHERE token_hash=$1",[tokenHash(token)]);
    const invalid=await event(); await dispatchOne(pool,{send:async()=>"invalid"}); assert.equal(await regs.status(user.id,tokenHash(token)),false); assert.equal((await job(invalid)).state,"failed");
    await regs.put(user.id,tokenHash(token),fid); const restart=await event();
    await pool.query("UPDATE chroniccare.push_jobs SET lease=$2,lease_until=now()-interval '1 minute',attempts=1 WHERE notification_id=$1",[restart,randomUUID()]);
    await dispatchOne(pool,success); assert.equal((await job(restart)).state,"sent");
    const delayed=await event(); await configurePush(pool,false); await configurePush(pool,true); await dispatchOne(pool,success); assert.equal((await job(delayed)).state,"skipped");
    const logout=await event(); await auth.deleteSession(tokenHash(token)); await dispatchOne(pool,success);
    assert.equal((await job(logout)).state,"skipped"); assert.equal((await receipt(firstId,token)).status,404);
    assert.equal((await pool.query("SELECT 1 FROM chroniccare.notifications WHERE user_id=$1",[user.id])).rowCount,9);
  } finally {
    if(server) await new Promise<void>(resolve=>{server!.close(()=>resolve());server!.closeAllConnections();});
    await configurePush(pool,false); try{await pool.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])",[emails]);}finally{await pool.end();}
  }
});

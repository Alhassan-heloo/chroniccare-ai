import type pg from "pg";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { cookie, cookieName } from "../auth/cookies.js";
import { tokenHash } from "../auth/security.js";
import { HttpError } from "../middleware/errors.js";

export type PushResult = "sent" | "invalid" | "retry" | "permanent";
export interface PushProvider { send(fid: string, deliveryId: string): Promise<PushResult> }
// Never renew idle sessions from background push traffic.
const eligibility = `FROM chroniccare.push_jobs j JOIN chroniccare.notifications n ON n.id=j.notification_id
 JOIN chroniccare.browser_registrations r ON r.fid=j.fid AND r.user_id=n.user_id
 AND r.session_hash=j.session_hash AND r.created_at=j.registration_created_at
 JOIN chroniccare.sessions s ON s.token_hash=r.session_hash AND s.user_id=r.user_id
 JOIN chroniccare.users u ON u.id=s.user_id JOIN chroniccare.push_control c ON c.enabled
 WHERE j.id=$1 AND j.created_at>=c.enabled_at AND j.created_at>clock_timestamp()-interval '5 minutes'
 AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-
 CASE WHEN u.role='admin' THEN interval '15 minutes' ELSE interval '30 minutes' END
 AND s.created_at>clock_timestamp()-CASE WHEN u.role='admin' THEN interval '4 hours' ELSE interval '8 hours' END`;

export async function configurePush(pool: Pick<pg.Pool,"query">, enabled: boolean) {
  await pool.query(`UPDATE chroniccare.push_control SET enabled_at=CASE WHEN $1 AND NOT enabled THEN clock_timestamp() ELSE enabled_at END, enabled=$1`, [enabled]);
}
export async function dispatchOne(pool: pg.Pool, provider: PushProvider) {
  const lease = randomUUID();
  const claimed = await pool.query<{id:string}>(`UPDATE chroniccare.push_jobs SET attempts=attempts+1,lease=$1,lease_until=clock_timestamp()+interval '60 seconds'
    WHERE id=(SELECT id FROM chroniccare.push_jobs WHERE state='pending' AND due_at<=clock_timestamp()
    AND (lease_until IS NULL OR lease_until<clock_timestamp()) AND attempts<4 ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`, [lease]);
  const id = claimed.rows[0]?.id;
  if (!id) {
    await pool.query("UPDATE chroniccare.push_jobs SET state='failed' WHERE state='pending' AND attempts>=4 AND lease_until<clock_timestamp()");
    return false;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const job = await client.query<{attempts:number}>("SELECT attempts FROM chroniccare.push_jobs WHERE id=$1 AND lease=$2 FOR UPDATE", [id,lease]);
    if (!job.rowCount) { await client.query("ROLLBACK"); return true; }
    // Locks serialize an in-flight send with registration revocation/session deletion.
    const eligible = await client.query<{fid:string}>(`SELECT r.fid ${eligibility} FOR SHARE OF r,s`, [id]);
    let result: PushResult | "skipped" = "skipped";
    if (eligible.rows[0]) {
      try { result = await provider.send(eligible.rows[0].fid,id); } catch { result = "retry"; }
      if (result === "invalid") await client.query("DELETE FROM chroniccare.browser_registrations WHERE fid=$1 AND session_hash=(SELECT session_hash FROM chroniccare.push_jobs WHERE id=$2)", [eligible.rows[0].fid,id]);
    }
    const state = result === "sent" ? "sent" : result === "skipped" ? "skipped" : result === "retry" && job.rows[0]!.attempts < 4 ? "pending" : "failed";
    await client.query(`UPDATE chroniccare.push_jobs SET state=$2,lease=NULL,lease_until=NULL,
      due_at=clock_timestamp()+($3::int*interval '30 seconds') WHERE id=$1`, [id,state,2 ** job.rows[0]!.attempts]);
    await client.query("COMMIT"); return true;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export function startPushWorker(pool: pg.Pool, provider: PushProvider) {
  let running: Promise<unknown> | undefined, stopped=false;
  const tick = () => { if (!running && !stopped) running=dispatchOne(pool,provider).catch(() => {
    console.error("Push dispatch unavailable. No payload or credentials logged.");
  }).finally(() => { running=undefined; }); };
  const timer=setInterval(tick,2000); timer.unref(); tick();
  return async () => { stopped=true; clearInterval(timer); await running; };
}
export function pushReceiptRoutes(pool: pg.Pool) {
  const router=Router();
  router.use(rateLimit({windowMs:60000,limit:60,legacyHeaders:false,standardHeaders:"draft-8"}));
  router.get("/:id",async(req,res)=>{
    const token=cookie(req,cookieName(res.locals.secureCookies===true));
    if (!token) throw new HttpError(401,"UNAUTHENTICATED","Authentication required.");
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id as string)) throw new HttpError(404,"NOT_FOUND","Not found.");
    const row=await pool.query(`SELECT 1 ${eligibility} AND j.session_hash=$2 AND j.state IN ('pending','sent')`,[req.params.id,tokenHash(token)]);
    if (!row.rowCount) throw new HttpError(404,"NOT_FOUND","Not found.");
    res.json({eligible:true});
  }); return router;
}

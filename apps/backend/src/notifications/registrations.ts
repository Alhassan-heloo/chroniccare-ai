import type pg from "pg";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth, type AuthLocals } from "../auth/middleware.js";
import type { AuthStore } from "../auth/store.js";
import { HttpError } from "../middleware/errors.js";
import { tokenHash } from "../auth/security.js";
export const registrationContext = (session: string) => tokenHash("browser-registration:" + session);

export function postgresRegistrationStore(pool: Pick<pg.Pool, "query">) {
  return {
    async put(user: string, session: string, fid: string) {
      // The unique FID cannot be moved to another account/session by claiming it.
      // The session FK serializes registration with logout and login replacement.
      try {
        // Expired sessions are ineligible even before the normal session cleanup.
        // Release their FID so a fresh explicit opt-in is not permanently blocked.
        await pool.query(`DELETE FROM chroniccare.browser_registrations r USING chroniccare.sessions s,chroniccare.users u
          WHERE r.fid=$1 AND r.session_hash=s.token_hash AND u.id=s.user_id AND (
          s.expires_at<=clock_timestamp() OR s.last_seen_at<=clock_timestamp()-
          CASE WHEN u.role='admin' THEN interval '15 minutes' ELSE interval '30 minutes' END OR
          s.created_at<=clock_timestamp()-CASE WHEN u.role='admin' THEN interval '4 hours' ELSE interval '8 hours' END)`, [fid]);
        const result = await pool.query(`INSERT INTO chroniccare.browser_registrations(fid,user_id,session_hash)
          SELECT $3,u.id,s.token_hash FROM chroniccare.sessions s JOIN chroniccare.users u ON u.id=s.user_id
          WHERE u.id=$1 AND s.token_hash=$2 AND s.expires_at>clock_timestamp()
          AND s.last_seen_at>clock_timestamp()-CASE WHEN u.role='admin' THEN interval '15 minutes' ELSE interval '30 minutes' END
          AND s.created_at>clock_timestamp()-CASE WHEN u.role='admin' THEN interval '4 hours' ELSE interval '8 hours' END
          ON CONFLICT(session_hash) DO UPDATE SET fid=EXCLUDED.fid,updated_at=clock_timestamp()
          WHERE browser_registrations.user_id=$1 AND browser_registrations.session_hash=$2
          RETURNING fid`, [user, session, fid]);
        if (!result.rowCount) throw new HttpError(409, "REGISTRATION_CONFLICT", "Registration could not be confirmed.");
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && ["23505", "23503"].includes(String(error.code)))
          throw new HttpError(409, "REGISTRATION_CONFLICT", "Registration could not be confirmed.");
        throw error;
      }
    },
    async status(user: string, session: string) {
      return !!(await pool.query("SELECT 1 FROM chroniccare.browser_registrations WHERE user_id=$1 AND session_hash=$2", [user, session])).rowCount;
    },
    async remove(user: string, session: string) {
      await pool.query("DELETE FROM chroniccare.browser_registrations WHERE user_id=$1 AND session_hash=$2", [user, session]);
    },
  };
}
export type RegistrationStore = ReturnType<typeof postgresRegistrationStore>;
export function registrationRoutes(auth: AuthStore, store: RegistrationStore) {
  const router = Router();
  router.use(requireAuth(auth));
  router.use(rateLimit({ windowMs: 60000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false,
    keyGenerator: (_req, res) => (res.locals as AuthLocals).sessionHash,
    message: { error: { code: "RATE_LIMITED", message: "Try again later." } } }));
  router.use((req, _res, next) => {
    if (Object.keys(req.query).length) throw new HttpError(400, "INVALID_INPUT", "Query fields are not supported.");
    next();
  });
  router.get("/", async (_req, res) => {
    const { user, sessionHash } = res.locals as AuthLocals;
    res.json({ registered: await store.status(user.id, sessionHash), context: registrationContext(sessionHash) });
  });
  router.put("/", async (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || Object.keys(body).length !== 2 || typeof body.fid !== "string" || !/^[cdef][A-Za-z0-9_-]{21}$/.test(body.fid))
      throw new HttpError(400, "INVALID_INPUT", "Provide a valid Firebase installation identifier only.");
    const { user, sessionHash } = res.locals as AuthLocals;
    if (body.context !== registrationContext(sessionHash)) throw new HttpError(409, "SESSION_CHANGED", "Refresh registration status.");
    await store.put(user.id, sessionHash, body.fid); res.status(204).end();
  });
  router.delete("/", async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length !== 1)
      throw new HttpError(400, "INVALID_INPUT", "Body fields are not supported.");
    const { user, sessionHash } = res.locals as AuthLocals;
    if (req.body.context !== registrationContext(sessionHash)) throw new HttpError(409, "SESSION_CHANGED", "Refresh registration status.");
    await store.remove(user.id, sessionHash); res.status(204).end();
  });
  return router;
}

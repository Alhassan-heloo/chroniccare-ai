import type pg from "pg";
import { HttpError } from "../middleware/errors.js";
import { credentials, hashPassword, newToken, tokenHash } from "./security.js";
import { postgresAuthStore } from "./store.js";
import type { EmailDelivery } from "./email.js";

export interface AccountConfig { publicOrigin: string; firstAdminEmail?: string; email?: EmailDelivery; reportDeliveryFailure?: () => void }
type Purpose = "admin_activation" | "password_reset";
const invalid = () => new HttpError(400, "INVALID_ACCOUNT_LINK", "This link is invalid, expired, or already used.");
export function accountService(pool: pg.Pool, config: AccountConfig) {
  const origin = new URL(config.publicOrigin);
  if (origin.origin !== config.publicOrigin || !["http:", "https:"].includes(origin.protocol)) throw new Error("Invalid public application origin.");
  const adminEmail = config.firstAdminEmail?.trim().toLowerCase();
  if (adminEmail) credentials({ name: "Admin", email: adminEmail, password: "Validation-only-credential!" }, true);
  async function issue(purpose: Purpose, email: string, userId?: string) {
    if (!config.email) throw new HttpError(503, "EMAIL_UNAVAILABLE", "Email delivery is not configured.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [purpose + ":" + email]);
      if (purpose === "admin_activation") {
        await client.query("SELECT pg_advisory_xact_lock(20261015, 2)");
        if ((await client.query("SELECT 1 FROM chroniccare.users WHERE role='admin'")).rowCount) throw new HttpError(409, "SETUP_CLOSED", "An Admin already exists.");
        if ((await client.query("SELECT 1 FROM chroniccare.users WHERE email=$1", [email])).rowCount) throw new Error("Pre-authorized Admin address already belongs to an account.");
      }
      const recent = await client.query(`SELECT 1 FROM chroniccare.account_tokens WHERE purpose=$1 AND email=$2
        AND delivered AND consumed_at IS NULL AND created_at>now()-interval '2 minutes'`, [purpose, email]);
      if (recent.rowCount) { await client.query("COMMIT"); return; }
      const token = newToken();
      await client.query(`UPDATE chroniccare.account_tokens SET consumed_at=now() WHERE email=$1 AND purpose=$2 AND consumed_at IS NULL`, [email, purpose]);
      await client.query(`INSERT INTO chroniccare.account_tokens(token_hash,purpose,email,user_id,expires_at)
        VALUES($1,$2,$3,$4,now()+interval '20 minutes')`, [tokenHash(token), purpose, email, userId ?? null]);
      const path = purpose === "admin_activation" ? "/activate-admin" : "/reset-password";
      await config.email.send({ to: email, subject: purpose === "admin_activation" ? "ChronicCare AI — Activate Admin / تفعيل المدير" : "ChronicCare AI — Reset password / إعادة تعيين كلمة المرور",
        text: `ChronicCare AI\n${config.publicOrigin}${path}#token=${token}\nExpires in 20 minutes. Single use.\nصالح لعشرين دقيقة ولمرة واحدة. تجاهل الرسالة إذا لم تطلبها.`,
      });
      await client.query("UPDATE chroniccare.account_tokens SET delivered=true WHERE token_hash=$1", [tokenHash(token)]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  return {
    reservedAdminEmail: adminEmail,
    async inviteAdmin() {
      if (!adminEmail) throw new Error("FIRST_ADMIN_EMAIL must be pre-authorized by the operator.");
      await issue("admin_activation", adminEmail);
    },
    async forgot(body: unknown) {
      if (!config.email) throw new HttpError(503, "EMAIL_UNAVAILABLE", "Email delivery is not configured.");
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "email")) throw new HttpError(400, "INVALID_INPUT", "Invalid input.");
      const email = credentials({ ...(body as object), password: "Validation-only-credential!" }).email;
      const user = await postgresAuthStore(pool).findAccount(email);
      if (user) {
        try { await issue("password_reset", email, user.id); }
        catch { config.reportDeliveryFailure?.(); }
      }
      // Acknowledges the request only, never asserts account existence or mail delivery.
    },
    async redeem(purpose: Purpose, body: unknown) {
      if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid();
      const { token, password, name, ...extra } = body as Record<string, unknown>;
      if (Object.keys(extra).length || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) ||
          (purpose === "password_reset" && name !== undefined)) throw invalid();
      const input = credentials({ email: "validation@example.test", password, ...(purpose === "admin_activation" ? { name } : {}) }, purpose === "admin_activation");
      const hash = await hashPassword(input.password);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (purpose === "admin_activation") {
          await client.query("SELECT pg_advisory_xact_lock(20261015, 2)");
          if (!adminEmail || (await client.query("SELECT 1 FROM chroniccare.users WHERE role='admin'")).rowCount) throw invalid();
        } else {
          const candidate = await client.query<{ email: string }>("SELECT email FROM chroniccare.account_tokens WHERE token_hash=$1 AND purpose=$2", [tokenHash(token), purpose]);
          if (!candidate.rows[0]) throw invalid();
          await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [purpose + ":" + candidate.rows[0].email]);
        }
        const result = await client.query<{ email: string; user_id: string | null }>(`SELECT email,user_id FROM chroniccare.account_tokens
          WHERE token_hash=$1 AND purpose=$2 AND delivered AND consumed_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE`, [tokenHash(token), purpose]);
        const record = result.rows[0]; if (!record) throw invalid();
        const consumed = await client.query(`UPDATE chroniccare.account_tokens SET consumed_at=clock_timestamp()
          WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp()`, [tokenHash(token)]);
        if (!consumed.rowCount) throw invalid();
        if (purpose === "admin_activation") {
          if (record.email !== adminEmail) throw invalid();
          try { await postgresAuthStore(client).createUser(input.name, record.email, hash, "admin"); }
          catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "23505") throw invalid();
            throw error;
          }
        } else {
          if (!record.user_id) throw invalid();
          await client.query("SELECT id FROM chroniccare.users WHERE id=$1 FOR UPDATE", [record.user_id]);
          await client.query("UPDATE chroniccare.users SET password_hash=$1 WHERE id=$2", [hash, record.user_id]);
          await client.query("DELETE FROM chroniccare.sessions WHERE user_id=$1", [record.user_id]);
          await client.query("UPDATE chroniccare.account_tokens SET consumed_at=now() WHERE user_id=$1 AND purpose='password_reset' AND consumed_at IS NULL", [record.user_id]);
        }
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
  };
}
export type AccountService = ReturnType<typeof accountService>;

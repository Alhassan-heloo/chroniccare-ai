import { randomBytes } from "node:crypto";
import type pg from "pg";
import { tokenHash } from "../auth/security.js";
import { HttpError } from "../middleware/errors.js";

export interface ConnectedDoctor { id: string; name: string; email: string; approvedAt: string | null }
const invalid = () => new HttpError(404, "CONNECTION_CODE_INVALID", "Code is invalid, expired, or already used.");
export function connectionCode(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "INVALID_INPUT", "Invalid input.");
  const data = body as Record<string, unknown>;
  if (Object.keys(data).length !== 1 || typeof data.code !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(data.code)) {
    throw new HttpError(400, "INVALID_INPUT", "Provide only the connection code.");
  }
  return data.code;
}
export function invitationInput(body: unknown, field: "email" | "token") {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "INVALID_INPUT", "Invalid input.");
  const data = body as Record<string, unknown>;
  const value = typeof data[field] === "string" ? data[field].trim() : "";
  if (Object.keys(data).length !== 1 || (field === "token" ? !/^[A-Za-z0-9_-]{32}$/.test(value) : value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
    throw new HttpError(400, "INVALID_INPUT", "Provide the required invitation field.");
  }
  return field === "email" ? value.toLowerCase() : value;
}
const invalidInvitation = () => new HttpError(404, "INVITATION_INVALID", "Invitation unavailable. Request a new link.");
export function postgresConnectionStore(pool: pg.Pool) {
  return {
    async invite(doctorId: string, email: string) {
      const token = randomBytes(24).toString("base64url");
      // Always issue the same opaque result, including when no eligible account exists.
      const result = await pool.query<{ expiresAt: Date }>(`INSERT INTO chroniccare.patient_invitations(token_hash,doctor_id,patient_id)
        VALUES($1,$2,(SELECT id FROM chroniccare.users WHERE email=$3 AND role='patient' AND NOT disabled))
        RETURNING expires_at AS "expiresAt"`, [tokenHash(token), doctorId, email]);
      return { token, expiresAt: result.rows[0]!.expiresAt.toISOString() };
    },
    async previewInvitation(patientId: string, token: string) {
      const result = await pool.query<{ patientId: string | null; consumed: Date | null; id: string; name: string }>(`SELECT c.patient_id AS "patientId",c.consumed_at AS consumed,d.id,d.name
        FROM chroniccare.patient_invitations c JOIN chroniccare.users d ON d.id=c.doctor_id AND d.role='doctor' AND NOT d.disabled AND NOT d.must_change_password
        WHERE c.token_hash=$1 AND c.expires_at>clock_timestamp()`, [tokenHash(token)]);
      const invitation = result.rows[0];
      if (!invitation) throw invalidInvitation();
      if (invitation.patientId !== patientId) throw new HttpError(403, "INVITATION_ACCOUNT_MISMATCH", "Sign in with the intended patient account.");
      if (invitation.consumed) throw new HttpError(409, "INVITATION_USED", "Already used. Check My Doctors or request a new link.");
      return { id: invitation.id, name: invitation.name };
    },
    async approveInvitation(patientId: string, token: string) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["connections:" + patientId]);
        const result = await client.query<{ doctor_id: string; patient_id: string | null; consumed_at: Date | null }>(`SELECT c.doctor_id,c.patient_id,c.consumed_at
          FROM chroniccare.patient_invitations c JOIN chroniccare.users d ON d.id=c.doctor_id AND d.role='doctor' AND NOT d.disabled AND NOT d.must_change_password
          WHERE c.token_hash=$1 AND c.expires_at>clock_timestamp() FOR UPDATE OF c FOR SHARE OF d`, [tokenHash(token)]);
        const invitation = result.rows[0];
        if (!invitation) throw invalidInvitation();
        if (invitation.patient_id !== patientId) throw new HttpError(403, "INVITATION_ACCOUNT_MISMATCH", "Sign in with the intended patient account.");
        if (invitation.consumed_at) throw new HttpError(409, "INVITATION_USED", "Already used. Check My Doctors or request a new link.");
        const patient = await client.query("SELECT id FROM chroniccare.users WHERE id=$1 AND role='patient' AND NOT disabled FOR SHARE", [patientId]);
        if (!patient.rowCount) throw invalidInvitation();
        const consumed = await client.query(`UPDATE chroniccare.patient_invitations SET consumed_at=clock_timestamp()
          WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp()`, [tokenHash(token)]);
        if (!consumed.rowCount) throw invalidInvitation();
        await client.query(`INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id,patient_approved_at)
          VALUES($1,$2,clock_timestamp()) ON CONFLICT(doctor_id,patient_id)
          DO UPDATE SET patient_approved_at=COALESCE(chroniccare.doctor_patient_relationships.patient_approved_at,EXCLUDED.patient_approved_at)`, [invitation.doctor_id, patientId]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async generate(doctorId: string) {
      const code = randomBytes(24).toString("base64url");
      const row = await pool.query<{ expiresAt: Date }>(`INSERT INTO chroniccare.doctor_connection_codes(code_hash,doctor_id)
        VALUES($1,$2) RETURNING expires_at AS "expiresAt"`, [tokenHash(code), doctorId]);
      return { code, expiresAt: row.rows[0]!.expiresAt.toISOString() };
    },
    async preview(code: string) {
      const row = await pool.query<{ id: string; name: string; email: string }>(`SELECT u.id,u.name,u.email
        FROM chroniccare.doctor_connection_codes c JOIN chroniccare.users u ON u.id=c.doctor_id AND u.role='doctor' AND NOT u.disabled AND NOT u.must_change_password
        WHERE c.code_hash=$1 AND c.consumed_at IS NULL AND c.expires_at>clock_timestamp()`, [tokenHash(code)]);
      if (!row.rows[0]) throw invalid();
      return row.rows[0];
    },
    async approve(patientId: string, code: string) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["connections:" + patientId]);
      const row = await client.query<{ doctor_id: string }>(`SELECT c.doctor_id FROM chroniccare.doctor_connection_codes c
        JOIN chroniccare.users d ON d.id=c.doctor_id AND d.role='doctor' AND NOT d.disabled AND NOT d.must_change_password
        WHERE c.code_hash=$1 AND c.consumed_at IS NULL AND c.expires_at>clock_timestamp() FOR UPDATE OF c FOR SHARE OF d`, [tokenHash(code)]);
        if (!row.rows[0]) throw invalid();
      const patient = await client.query("SELECT id FROM chroniccare.users WHERE id=$1 AND role='patient' AND NOT disabled FOR SHARE", [patientId]);
      if (!patient.rowCount) throw invalid();
        // Check expiry again after any lock wait; the same code can succeed only once.
        const consumed = await client.query(`UPDATE chroniccare.doctor_connection_codes SET consumed_at=clock_timestamp()
          WHERE code_hash=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp()`, [tokenHash(code)]);
        if (!consumed.rowCount) throw invalid();
        await client.query(`INSERT INTO chroniccare.doctor_patient_relationships(doctor_id,patient_id,patient_approved_at)
          VALUES($1,$2,clock_timestamp()) ON CONFLICT(doctor_id,patient_id)
          DO UPDATE SET patient_approved_at=COALESCE(chroniccare.doctor_patient_relationships.patient_approved_at,EXCLUDED.patient_approved_at)`, [row.rows[0].doctor_id, patientId]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async list(patientId: string) {
      const rows = await pool.query<{ id: string; name: string; email: string; approvedAt: Date | null }>(`SELECT u.id,u.name,u.email,r.patient_approved_at AS "approvedAt"
        FROM chroniccare.doctor_patient_relationships r JOIN chroniccare.users u ON u.id=r.doctor_id AND u.role='doctor'
        WHERE r.patient_id=$1 ORDER BY lower(u.name),u.id`, [patientId]);
      return rows.rows.map(row => ({ ...row, approvedAt: row.approvedAt?.toISOString() ?? null }));
    },
    async revoke(patientId: string, doctorId: string) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["connections:" + patientId]);
        await client.query("DELETE FROM chroniccare.doctor_patient_relationships WHERE patient_id=$1 AND doctor_id=$2", [patientId, doctorId]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
  };
}
export type ConnectionStore = ReturnType<typeof postgresConnectionStore>;

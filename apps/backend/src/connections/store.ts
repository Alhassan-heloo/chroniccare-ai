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
export function postgresConnectionStore(pool: pg.Pool) {
  return {
    async generate(doctorId: string) {
      const code = randomBytes(24).toString("base64url");
      const row = await pool.query<{ expiresAt: Date }>(`INSERT INTO chroniccare.doctor_connection_codes(code_hash,doctor_id)
        VALUES($1,$2) RETURNING expires_at AS "expiresAt"`, [tokenHash(code), doctorId]);
      return { code, expiresAt: row.rows[0]!.expiresAt.toISOString() };
    },
    async preview(code: string) {
      const row = await pool.query<{ id: string; name: string; email: string }>(`SELECT u.id,u.name,u.email
        FROM chroniccare.doctor_connection_codes c JOIN chroniccare.users u ON u.id=c.doctor_id AND u.role='doctor'
        WHERE c.code_hash=$1 AND c.consumed_at IS NULL AND c.expires_at>clock_timestamp()`, [tokenHash(code)]);
      if (!row.rows[0]) throw invalid();
      return row.rows[0];
    },
    async approve(patientId: string, code: string) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["connections:" + patientId]);
        const row = await client.query<{ doctor_id: string }>(`SELECT doctor_id FROM chroniccare.doctor_connection_codes
          WHERE code_hash=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE`, [tokenHash(code)]);
        if (!row.rows[0]) throw invalid();
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

import { randomUUID } from "node:crypto";
import type pg from "pg";

export interface AdminDoctor {
  id: string;
  name: string;
  email: string;
  role: "doctor";
  disabled?: boolean;
}

export interface AdminStore {
  listInvitations?(): Promise<AdminInvitation[]>;
  deleteDoctor?(id: string): Promise<string>;
  disableDoctor?(id: string): Promise<boolean>;
  listDoctors(): Promise<AdminDoctor[]>;
  createDoctor(name: string, email: string, passwordHash: string): Promise<AdminDoctor>;
}

export interface AdminInvitation {
  name: string;
  email: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  delivered: boolean;
  status: "pending" | "expired" | "closed" | "undelivered";
  accountStatus: "active" | "disabled" | "password-change" | "not-created";
}

export function postgresAdminStore(pool: Pick<pg.Pool, "query">): AdminStore {
  return {
    async listInvitations() {
      return (await pool.query<AdminInvitation>(`SELECT t.invited_name AS name,t.email,t.created_at AS "issuedAt",
        t.expires_at AS "expiresAt",t.consumed_at AS "consumedAt",t.delivered,
        CASE WHEN t.consumed_at IS NOT NULL THEN 'closed' WHEN NOT t.delivered THEN 'undelivered'
          WHEN t.expires_at<=clock_timestamp() THEN 'expired' ELSE 'pending' END AS status,
        CASE WHEN u.id IS NULL THEN 'not-created' WHEN u.disabled THEN 'disabled'
          WHEN u.must_change_password THEN 'password-change' ELSE 'active' END AS "accountStatus"
        FROM chroniccare.account_tokens t LEFT JOIN chroniccare.users u ON u.email=t.email AND u.role='doctor'
        WHERE t.purpose='doctor_activation' ORDER BY t.created_at DESC,t.email`)).rows;
    },
    async deleteDoctor(id) {
      return (await pool.query<{result:string}>("SELECT chroniccare.delete_unreferenced_doctor($1) AS result",[id])).rows[0]!.result;
    },
    async disableDoctor(id) {
      const result=await pool.query(`WITH changed AS (UPDATE chroniccare.users SET disabled=true WHERE id=$1 AND role='doctor' RETURNING id),
      revoked AS (DELETE FROM chroniccare.sessions WHERE user_id IN (SELECT id FROM changed)) SELECT id FROM changed`,[id]);
      return !!result.rowCount;
    },
    async listDoctors() {
      return (await pool.query<AdminDoctor>(`SELECT id,name,email,role,disabled
        FROM chroniccare.users WHERE role='doctor' ORDER BY lower(name),id`)).rows;
    },
    async createDoctor(name, email, passwordHash) {
      return (await pool.query<AdminDoctor>(`INSERT INTO chroniccare.users(id,name,email,password_hash,role)
        VALUES($1,$2,$3,$4,'doctor') RETURNING id,name,email,role`,
      [randomUUID(), name, email, passwordHash])).rows[0]!;
    },
  };
}

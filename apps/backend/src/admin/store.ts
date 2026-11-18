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
  deleteDoctor?(id: string): Promise<string>;
  disableDoctor?(id: string): Promise<boolean>;
  listDoctors(): Promise<AdminDoctor[]>;
  createDoctor(name: string, email: string, passwordHash: string): Promise<AdminDoctor>;
}

export function postgresAdminStore(pool: Pick<pg.Pool, "query">): AdminStore {
  return {
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

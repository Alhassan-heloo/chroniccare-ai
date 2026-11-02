import { randomUUID } from "node:crypto";
import type pg from "pg";

export interface AdminDoctor {
  id: string;
  name: string;
  email: string;
  role: "doctor";
}

export interface AdminStore {
  listDoctors(): Promise<AdminDoctor[]>;
  createDoctor(name: string, email: string, passwordHash: string): Promise<AdminDoctor>;
}

export function postgresAdminStore(pool: Pick<pg.Pool, "query">): AdminStore {
  return {
    async listDoctors() {
      return (await pool.query<AdminDoctor>(`SELECT id,name,email,role
        FROM chroniccare.users WHERE role='doctor' ORDER BY lower(name),id`)).rows;
    },
    async createDoctor(name, email, passwordHash) {
      return (await pool.query<AdminDoctor>(`INSERT INTO chroniccare.users(id,name,email,password_hash,role)
        VALUES($1,$2,$3,$4,'doctor') RETURNING id,name,email,role`,
      [randomUUID(), name, email, passwordHash])).rows[0]!;
    },
  };
}

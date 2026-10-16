import { randomUUID } from "node:crypto";
import type pg from "pg";

export type Role = "patient" | "doctor" | "admin";
export interface User { id: string; name: string; email: string; role: Role }
export interface Account extends User { password_hash: string }
export interface AuthStore {
  createUser(name: string, email: string, passwordHash: string, role: Role): Promise<User>;
  findAccount(email: string): Promise<Account | undefined>;
  createSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void>;
  sessionUser(tokenHash: string): Promise<User | undefined>;
  deleteSession(tokenHash: string): Promise<void>;
}

export function postgresAuthStore(pool: Pick<pg.Pool, "query">): AuthStore {
  return {
    async createUser(name, email, passwordHash, role) {
      const result = await pool.query<User>(`INSERT INTO chroniccare.users (id,name,email,password_hash,role)
        VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,role`, [randomUUID(), name, email, passwordHash, role]);
      return result.rows[0]!;
    },
    async findAccount(email) {
      return (await pool.query<Account>(
        "SELECT id,name,email,role,password_hash FROM chroniccare.users WHERE email=$1", [email])).rows[0];
    },
    async createSession(tokenHash, userId, expiresAt) {
      await pool.query("INSERT INTO chroniccare.sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)",
        [tokenHash, userId, expiresAt]);
    },
    async sessionUser(tokenHash) {
      return (await pool.query<User>(`SELECT u.id,u.name,u.email,u.role FROM chroniccare.sessions s
        JOIN chroniccare.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [tokenHash])).rows[0];
    },
    async deleteSession(tokenHash) { await pool.query("DELETE FROM chroniccare.sessions WHERE token_hash=$1", [tokenHash]); },
  };
}

import { randomUUID } from "node:crypto";
import type pg from "pg";
import { HttpError } from "../middleware/errors.js";

export type Role = "patient" | "doctor" | "admin";
export interface User { id: string; name: string; email: string; role: Role; mustChangePassword?: boolean }
export interface Account extends User { password_hash: string }
export interface AuthStore {
  createUser(name: string, email: string, passwordHash: string, role: Role): Promise<User>;
  findAccount(email: string): Promise<Account | undefined>;
  createSession(tokenHash: string, userId: string, expiresAt: Date, credentialHash?: string): Promise<void>;
  sessionUser(tokenHash: string): Promise<User | undefined>;
  changePassword?(userId: string, previousHash: string, hash: string): Promise<void>;
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
        `SELECT id,name,email,role,password_hash,must_change_password AS "mustChangePassword" FROM chroniccare.users WHERE email=$1 AND NOT disabled`, [email])).rows[0];
    },
    async createSession(tokenHash, userId, expiresAt, credentialHash) {
      const result = await pool.query(`WITH account AS (
        SELECT id,password_hash FROM chroniccare.users WHERE id=$2 AND NOT disabled FOR UPDATE
      ) INSERT INTO chroniccare.sessions(token_hash,user_id,expires_at)
        SELECT $1,id,$3 FROM account WHERE $4::text IS NULL OR password_hash=$4`,
        [tokenHash, userId, expiresAt, credentialHash ?? null]);
      if (!result.rowCount) throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    },
    async sessionUser(tokenHash) {
      return (await pool.query<User>(`UPDATE chroniccare.sessions s SET last_seen_at=clock_timestamp()
        FROM chroniccare.users u WHERE u.id=s.user_id AND NOT u.disabled AND s.token_hash=$1
        AND s.expires_at>clock_timestamp() AND s.last_seen_at>clock_timestamp()-
          CASE WHEN u.role='admin' THEN interval '15 minutes' ELSE interval '30 minutes' END
        AND s.created_at>clock_timestamp()-CASE WHEN u.role='admin' THEN interval '4 hours' ELSE interval '8 hours' END
        RETURNING u.id,u.name,u.email,u.role,u.must_change_password AS "mustChangePassword"`, [tokenHash])).rows[0];
    },
    async changePassword(userId, previousHash, hash) {
 const result=await pool.query(`WITH changed AS (UPDATE chroniccare.users SET password_hash=$3,must_change_password=false WHERE id=$1 AND password_hash=$2 RETURNING id), revoked AS (DELETE FROM chroniccare.sessions WHERE user_id IN (SELECT id FROM changed)) SELECT id FROM changed`,[userId,previousHash,hash]);
 if(!result.rowCount) throw new HttpError(409,"SESSION_CHANGED","Sign in again.");
 },
    async deleteSession(tokenHash) { await pool.query("DELETE FROM chroniccare.sessions WHERE token_hash=$1", [tokenHash]); },
  };
}

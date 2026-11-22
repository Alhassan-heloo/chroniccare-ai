import type pg from "pg";
import type { QueryExecutor } from "../db/pool.js";
import { HttpError } from "../middleware/errors.js";

const deadlineMs = 4000;
const unavailable = () => new HttpError(503, "DOCTOR_READ_UNAVAILABLE", "Patient data is temporarily unavailable.");
const busy = () => new HttpError(503, "DOCTOR_READ_BUSY", "Patient data is temporarily busy.");
const timedOut = () => new HttpError(503, "DOCTOR_READ_TIMEOUT", "Patient data read timed out.");

function readError(error: unknown): unknown {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "55P03") return busy();
  if (code === "57014" || code === "25P04" || (error instanceof Error && error.message === "Query read timeout")) return timedOut();
  if (code === "40P01" || code === "40001" || /^(08|57P)/.test(code) ||
      ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"].includes(code) ||
      (error instanceof Error && /^(Connection terminated|Client .* is not queryable)/.test(error.message))) return unavailable();
  return error;
}

export function doctorReadTransaction(pool: pg.Pool) {
  // Leave capacity for session checks and writers in the shared pool.
  const limit = Math.max(1, (pool.options?.max ?? 10) - 1);
  let active = 0;

  return async function read<T>(operation: (db: QueryExecutor) => Promise<T>): Promise<T> {
    if (active >= limit) throw busy();
    active++;
    try {
      const client = await pool.connect().catch(() => { throw unavailable(); });
      let discard = false;
      const onError = () => { discard = true; };
      client.on("error", onError);

      const deadline = performance.now() + deadlineMs;
      function remaining() {
        const ms = Math.ceil(deadline - performance.now());
        if (ms <= 0) throw timedOut();
        return ms;
      }
      const db: QueryExecutor = {
        query<Row extends pg.QueryResultRow>(text: string, values?: unknown[]) {
          // The driver's remaining budget also covers servers without transaction_timeout.
          const config = { text, values, query_timeout: remaining() };
          return client.query<Row>(config);
        },
      };
      try {
        await db.query("BEGIN ISOLATION LEVEL READ COMMITTED");
        await db.query(
          "SELECT set_config('lock_timeout','750ms',true), set_config('statement_timeout','4s',true),"
          + " CASE WHEN current_setting('transaction_timeout',true) IS NOT NULL"
          + " THEN set_config('transaction_timeout',$1,true) END",
          [remaining() + "ms"],
        );
        const result = await operation(db);
        await db.query("COMMIT");
        return result;
      } catch (error) {
        try {
          const rollback = { text: "ROLLBACK", query_timeout: 500 };
          await client.query(rollback);
        } catch {
          discard = true;
        }
        throw readError(error);
      } finally {
        client.removeListener("error", onError);
        client.release(discard);
      }
    } finally {
      active--;
    }
  };
}

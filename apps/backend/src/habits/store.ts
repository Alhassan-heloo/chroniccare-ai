import { randomUUID } from "node:crypto";
import type { PoolClient, Pool } from "pg";
import type { Habit, HabitInput, ProgressInput } from "./validation.js";

interface Row { id: string; title: string; unit: Habit["unit"]; target: number; progress: number; recorded_on: string }
export interface HabitStore {
  list(patientId: string, date: string): Promise<Habit[]>;
  get(patientId: string, id: string, date: string): Promise<Habit | undefined>;
  create(patientId: string, input: HabitInput, date: string): Promise<Habit>;
  update(patientId: string, id: string, input: HabitInput, date: string): Promise<Habit | undefined>;
  delete(patientId: string, id: string): Promise<boolean>;
  setProgress(patientId: string, id: string, input: ProgressInput): Promise<boolean>;
}
function habit(row: Row): Habit {
  return { id: row.id, title: row.title, unit: row.unit, target: row.target, progress: row.progress, recordedOn: row.recorded_on };
}
async function read(client: Pool | PoolClient, patientId: string, date: string, id?: string): Promise<Habit[]> {
  const sql = "SELECT h.id,h.title,h.unit,h.target,COALESCE(p.value,0) AS progress,"
    + "to_char($2::date,'YYYY-MM-DD') AS recorded_on FROM chroniccare.habits h "
    + "LEFT JOIN chroniccare.habit_progress p ON p.habit_id=h.id AND p.recorded_on=$2::date "
    + "WHERE h.patient_id=$1 " + (id ? "AND h.id=$3 " : "") + "ORDER BY h.created_at,h.id";
  const result = await client.query<Row>(sql, id ? [patientId, date, id] : [patientId, date]);
  return result.rows.map(habit);
}
export function postgresHabitStore(pool: Pool): HabitStore {
  return {
    async list(patientId, date) { return read(pool, patientId, date); },
    async get(patientId, id, date) { return (await read(pool, patientId, date, id))[0]; },
    async create(patientId, input, date) {
      const id = randomUUID();
      await pool.query("INSERT INTO chroniccare.habits(id,patient_id,title,unit,target) VALUES($1,$2,$3,$4,$5)",
        [id, patientId, input.title, input.unit, input.target]);
      const result = (await read(pool, patientId, date, id))[0];
      if (!result) throw new Error("Habit insert returned no row.");
      return result;
    },
    async update(patientId, id, input, date) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const owned = await client.query<{ unit: Habit["unit"] }>(
          "SELECT unit FROM chroniccare.habits WHERE patient_id=$1 AND id=$2 FOR UPDATE", [patientId, id]);
        const previous = owned.rows[0];
        if (!previous) { await client.query("ROLLBACK"); return undefined; }
        await client.query("UPDATE chroniccare.habits SET title=$3,unit=$4,target=$5,updated_at=clock_timestamp() WHERE patient_id=$1 AND id=$2",
          [patientId, id, input.title, input.unit, input.target]);
        if (previous.unit !== input.unit) {
          await client.query("DELETE FROM chroniccare.habit_progress WHERE habit_id=$1", [id]);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return (await read(pool, patientId, date, id))[0];
    },
    async delete(patientId, id) {
      return (await pool.query("DELETE FROM chroniccare.habits WHERE patient_id=$1 AND id=$2", [patientId, id])).rowCount === 1;
    },
    async setProgress(patientId, id, input) {
      const result = await pool.query(
        "INSERT INTO chroniccare.habit_progress(habit_id,recorded_on,value) "
        + "SELECT h.id,$3::date,$4 FROM chroniccare.habits h WHERE h.patient_id=$1 AND h.id=$2 "
        + "ON CONFLICT(habit_id,recorded_on) DO UPDATE SET value=EXCLUDED.value,updated_at=clock_timestamp() RETURNING habit_id",
        [patientId, id, input.date, input.value]);
      return result.rowCount === 1;
    },
  };
}

import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { DoseAction, Medication, MedicationInput } from "./validation.js";

interface Row {
  id: string;
  name: string;
  dosage: string;
  notes: string;
  scheduled_time: string;
  taken_on: string | null;
}
export interface MedicationStore {
  list(patientId: string, date: string): Promise<Medication[]>;
  get(patientId: string, id: string, date: string): Promise<Medication | undefined>;
  create(patientId: string, input: MedicationInput, date: string): Promise<Medication>;
  update(patientId: string, id: string, input: MedicationInput, date: string): Promise<Medication | undefined>;
  delete(patientId: string, id: string): Promise<boolean>;
  setDose(patientId: string, id: string, time: string, action: DoseAction): Promise<boolean>;
}

function medications(rows: Row[]): Medication[] {
  const grouped = new Map<string, Medication>();
  for (const row of rows) {
    let item = grouped.get(row.id);
    if (!item) {
      item = { id: row.id, name: row.name, dosage: row.dosage, notes: row.notes, doses: [] };
      grouped.set(row.id, item);
    }
    item.doses.push({ time: row.scheduled_time, takenOn: row.taken_on });
  }
  return [...grouped.values()];
}

export function postgresMedicationStore(pool: Pick<pg.Pool, "query" | "connect">): MedicationStore {
  const select = async (patientId: string, date: string, id?: string) => {
    const filter = id ? "AND m.id=$3" : "";
    const rows = await pool.query<Row>(`SELECT m.id,m.name,m.dosage,m.notes,
      to_char(s.scheduled_time,'HH24:MI') AS scheduled_time,
      CASE WHEN l.taken_on IS NULL THEN NULL ELSE to_char(l.taken_on,'YYYY-MM-DD') END AS taken_on
      FROM chroniccare.medications m
      JOIN chroniccare.medication_schedules s ON s.medication_id=m.id
      LEFT JOIN chroniccare.medication_dose_logs l ON l.medication_id=s.medication_id
        AND l.scheduled_time=s.scheduled_time AND l.taken_on=$2::date
      WHERE m.patient_id=$1 ${filter}
      ORDER BY m.created_at,m.id,s.scheduled_time`, id ? [patientId, date, id] : [patientId, date]);
    return medications(rows.rows);
  };
  return {
    list: select,
    async get(patientId, id, date) { return (await select(patientId, date, id))[0]; },
    async create(patientId, input, date) {
      const id = randomUUID(), client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`INSERT INTO chroniccare.medications(id,patient_id,name,dosage,notes)
          VALUES($1,$2,$3,$4,$5)`, [id, patientId, input.name, input.dosage, input.notes]);
        await client.query(`INSERT INTO chroniccare.medication_schedules(medication_id,scheduled_time)
          SELECT $1,unnest($2::time[])`, [id, input.doses.map(dose => dose.time)]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
      const result = (await select(patientId, date, id))[0];
      if (!result) throw new Error("Medication insert returned no row.");
      return result;
    },
    async update(patientId, id, input, date) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const owned = await client.query("SELECT id FROM chroniccare.medications WHERE patient_id=$1 AND id=$2 FOR UPDATE", [patientId, id]);
        if (!owned.rowCount) { await client.query("ROLLBACK"); return undefined; }
        await client.query(`UPDATE chroniccare.medications SET name=$3,dosage=$4,notes=$5,updated_at=clock_timestamp()
          WHERE patient_id=$1 AND id=$2`, [patientId, id, input.name, input.dosage, input.notes]);
        const times = input.doses.map(dose => dose.time);
        await client.query("DELETE FROM chroniccare.medication_schedules WHERE medication_id=$1 AND NOT(scheduled_time=ANY($2::time[]))", [id, times]);
        await client.query(`INSERT INTO chroniccare.medication_schedules(medication_id,scheduled_time)
          SELECT $1,unnest($2::time[]) ON CONFLICT DO NOTHING`, [id, times]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
      return (await select(patientId, date, id))[0];
    },
    async delete(patientId, id) {
      return (await pool.query("DELETE FROM chroniccare.medications WHERE patient_id=$1 AND id=$2", [patientId, id])).rowCount === 1;
    },
    async setDose(patientId, id, time, action) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const owned = await client.query(`SELECT 1 FROM chroniccare.medications m
          JOIN chroniccare.medication_schedules s ON s.medication_id=m.id
          WHERE m.patient_id=$1 AND m.id=$2 AND s.scheduled_time=$3::time FOR UPDATE OF m,s`, [patientId, id, time]);
        if (!owned.rowCount) { await client.query("ROLLBACK"); return false; }
        if (action.taken) {
          await client.query(`INSERT INTO chroniccare.medication_dose_logs(medication_id,scheduled_time,taken_on)
            VALUES($1,$2::time,$3::date) ON CONFLICT DO NOTHING`, [id, time, action.date]);
        } else {
          await client.query(`DELETE FROM chroniccare.medication_dose_logs
            WHERE medication_id=$1 AND scheduled_time=$2::time AND taken_on=$3::date`, [id, time, action.date]);
        }
        await client.query("COMMIT");
        return true;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
  };
}

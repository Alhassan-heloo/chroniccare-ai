import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { QueryExecutor } from "../db/pool.js";
import type { Measurement, MeasurementInput, ValidatedMeasurement } from "./validation.js";

interface Row { id: string; kind: string; systolic: number | null; diastolic: number | null; value: number | null; recorded_at: Date }
export interface MeasurementStore {
  list(patientId: string): Promise<Measurement[]>;
  get(patientId: string, id: string): Promise<Measurement | undefined>;
  create(patientId: string, reading: ValidatedMeasurement): Promise<Measurement>;
  update(patientId: string, id: string, input: MeasurementInput): Promise<Measurement | undefined>;
  delete(patientId: string, id: string): Promise<boolean>;
}
const columns = "id,kind,systolic,diastolic,value,recorded_at";
function reading(row: Row): Measurement {
  const common = { id: row.id, recordedAt: row.recorded_at.toISOString(), isExample: false as const };
  if (row.kind === "bloodPressure" && row.systolic !== null && row.diastolic !== null) return { ...common, kind: "bloodPressure", systolic: row.systolic, diastolic: row.diastolic };
  if (row.kind === "glucose" && row.value !== null) return { ...common, kind: "glucose", value: row.value };
  throw new Error("Invalid stored measurement.");
}
function values(input: MeasurementInput) {
  return input.kind === "bloodPressure" ? [input.systolic, input.diastolic, null] : [null, null, input.value];
}

export async function readPatientMeasurements(db: QueryExecutor, patientId: string): Promise<Measurement[]> {
  const result = await db.query<Row>(`SELECT ${columns} FROM chroniccare.measurements WHERE patient_id=$1 ORDER BY recorded_at DESC, created_at DESC, id`, [patientId]);
  return result.rows.map(reading);
}

// Every operation scopes ownership in SQL itself, never through a client-supplied ID.
export function postgresMeasurementStore(pool: Pick<pg.Pool, "query">): MeasurementStore {
  return {
    list: patientId => readPatientMeasurements(pool, patientId),
    async get(patientId, id) {
      const row = (await pool.query<Row>(`SELECT ${columns} FROM chroniccare.measurements WHERE patient_id=$1 AND id=$2`, [patientId, id])).rows[0];
      return row ? reading(row) : undefined;
    },
    async create(patientId, { input, recordedAt }) {
      const row = (await pool.query<Row>(`INSERT INTO chroniccare.measurements (id,patient_id,kind,systolic,diastolic,value,recorded_at)
        VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,clock_timestamp())) RETURNING ${columns}`,
      [randomUUID(), patientId, input.kind, ...values(input), recordedAt ?? null])).rows[0];
      if (!row) throw new Error("Measurement insert returned no row.");
      return reading(row);
    },
    async update(patientId, id, input) {
      const row = (await pool.query<Row>(`UPDATE chroniccare.measurements SET kind=$3,systolic=$4,diastolic=$5,value=$6,updated_at=clock_timestamp()
        WHERE patient_id=$1 AND id=$2 RETURNING ${columns}`, [patientId, id, input.kind, ...values(input)])).rows[0];
      return row ? reading(row) : undefined;
    },
    async delete(patientId, id) {
      return (await pool.query("DELETE FROM chroniccare.measurements WHERE patient_id=$1 AND id=$2", [patientId, id])).rowCount === 1;
    },
  };
}

import type pg from "pg";
import type { QueryExecutor } from "../db/pool.js";
import { readPatientHabits, type HabitStore } from "../habits/store.js";
import { readPatientMeasurements, type MeasurementStore } from "../measurements/store.js";
import { readPatientMedications, type MedicationStore } from "../medications/store.js";
import { doctorReadTransaction } from "./read-transaction.js";
import { doctorRecordDate } from "./validation.js";

export interface DoctorPatient {
  id: string;
  name: string;
}

interface DoctorRecord {
  patient: DoctorPatient;
  date: string;
  measurements: Awaited<ReturnType<MeasurementStore["list"]>>;
  medications: Awaited<ReturnType<MedicationStore["list"]>>;
  habits: Awaited<ReturnType<HabitStore["list"]>>;
}

export interface DoctorStore {
  listPatients(doctorId: string): Promise<DoctorPatient[]>;
  getPatientRecord(doctorId: string, patientId: string, date: unknown): Promise<DoctorRecord | undefined>;
  getPatientActivity(doctorId: string, patientId: string, date: unknown): Promise<CareActivity[] | undefined>;
}

export interface CareActivity {
  id: string;
  kind: "dose" | "habit";
  title: string;
  day: string;
  recordedAt: string;
  scheduledTime: string | null;
  value: number | null;
  unit: string | null;
}

const eligibleDoctor = "doctor.role='doctor' AND NOT doctor.disabled AND NOT doctor.must_change_password";
const approvedPatients = `SELECT patient.id,patient.name
  FROM chroniccare.doctor_patient_relationships relationship
  JOIN chroniccare.users doctor ON doctor.id=relationship.doctor_id AND ${eligibleDoctor}
  JOIN chroniccare.users patient ON patient.id=relationship.patient_id AND patient.role='patient' AND NOT patient.disabled
  WHERE relationship.doctor_id=$1 AND relationship.patient_approved_at IS NOT NULL`;

async function readActivity(db: QueryExecutor, patientId: string, date: string) {
  const result = await db.query<CareActivity>(`SELECT 'dose:'||m.id||':'||l.taken_on||':'||l.scheduled_time AS id,
    'dose' AS kind,m.name AS title,to_char(l.taken_on,'YYYY-MM-DD') AS day,
    l.created_at AS "recordedAt",to_char(l.scheduled_time,'HH24:MI') AS "scheduledTime",NULL::integer AS value,NULL::text AS unit
    FROM chroniccare.medication_dose_logs l JOIN chroniccare.medications m ON m.id=l.medication_id
    WHERE m.patient_id=$1 AND l.taken_on BETWEEN $2::date-13 AND $2::date
    UNION ALL
    SELECT 'habit:'||h.id||':'||p.recorded_on,'habit',h.title,to_char(p.recorded_on,'YYYY-MM-DD'),
    p.updated_at,NULL,p.value,h.unit FROM chroniccare.habit_progress p JOIN chroniccare.habits h ON h.id=p.habit_id
    WHERE h.patient_id=$1 AND p.recorded_on BETWEEN $2::date-13 AND $2::date
    ORDER BY "recordedAt" DESC,id`, [patientId, date]);
  return result.rows;
}

export function postgresDoctorStore(pool: pg.Pool): DoctorStore {
  const transaction = doctorReadTransaction(pool);

  function readAuthorized<T>(doctorId: string, patientId: string, read: (db: QueryExecutor, patient: DoctorPatient) => Promise<T>) {
    return transaction(async db => {
      // Keep the doctor eligible until the read commits, then lock the approved relationship.
      const doctor = await db.query(`SELECT id FROM chroniccare.users doctor WHERE id=$1 AND ${eligibleDoctor} FOR SHARE`, [doctorId]);
      if (!doctor.rowCount) return undefined;
      const { rows: [patient] } = await db.query<DoctorPatient>(
        `${approvedPatients} AND relationship.patient_id=$2 FOR SHARE OF relationship`, [doctorId, patientId],
      );
      if (!patient) return undefined;
      return read(db, patient);
    });
  }

  return {
    async listPatients(doctorId) {
      return (await pool.query<DoctorPatient>(`${approvedPatients} ORDER BY lower(patient.name),patient.id`, [doctorId])).rows;
    },
    getPatientRecord(doctorId, patientId, requestedDate) {
      return readAuthorized(doctorId, patientId, async (db, patient) => {
        const date = doctorRecordDate(requestedDate);
        const measurements = await readPatientMeasurements(db, patient.id);
        const medications = await readPatientMedications(db, patient.id, date);
        const habits = await readPatientHabits(db, patient.id, date);
        return { patient, date, measurements, medications, habits };
      });
    },
    getPatientActivity(doctorId, patientId, requestedDate) {
      return readAuthorized(doctorId, patientId, (db, patient) => readActivity(db, patient.id, doctorRecordDate(requestedDate)));
    },
  };
}

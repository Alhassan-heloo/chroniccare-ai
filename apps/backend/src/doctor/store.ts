import type pg from "pg";

export interface DoctorPatient {
  id: string;
  name: string;
}

export interface DoctorStore {
  activity?(patientId: string, date: string): Promise<CareActivity[]>;
  listPatients(doctorId: string): Promise<DoctorPatient[]>;
  getPatient(doctorId: string, patientId: string): Promise<DoctorPatient | undefined>;
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

const select = `SELECT patient.id,patient.name
  FROM chroniccare.doctor_patient_relationships relationship
  JOIN chroniccare.users doctor ON doctor.id=relationship.doctor_id AND doctor.role='doctor'
  JOIN chroniccare.users patient ON patient.id=relationship.patient_id AND patient.role='patient'
  WHERE relationship.doctor_id=$1`;

export function postgresDoctorStore(pool: Pick<pg.Pool, "query">): DoctorStore {
  return {
    async activity(patientId, date) {
      const result = await pool.query<CareActivity>(`SELECT 'dose:'||m.id||':'||l.taken_on||':'||l.scheduled_time AS id,
        'dose' AS kind,m.name AS title,to_char(l.taken_on,'YYYY-MM-DD') AS day,
        l.created_at AS "recordedAt",to_char(l.scheduled_time,'HH24:MI') AS "scheduledTime",NULL::integer AS value,NULL::text AS unit
        FROM chroniccare.medication_dose_logs l JOIN chroniccare.medications m ON m.id=l.medication_id
        WHERE m.patient_id=$1 AND l.taken_on BETWEEN $2::date-13 AND $2::date
        UNION ALL
        SELECT 'habit:'||h.id||':'||p.recorded_on,'habit',h.title,to_char(p.recorded_on,'YYYY-MM-DD'),
        p.updated_at,NULL,p.value,h.unit FROM chroniccare.habit_progress p JOIN chroniccare.habits h ON h.id=p.habit_id
        WHERE h.patient_id=$1 AND p.recorded_on BETWEEN $2::date-13 AND $2::date
        ORDER BY "recordedAt" DESC,id`, [patientId,date]);
      return result.rows;
    },
    async listPatients(doctorId) {
      return (await pool.query<DoctorPatient>(`${select} ORDER BY lower(patient.name),patient.id`, [doctorId])).rows;
    },
    async getPatient(doctorId, patientId) {
      return (await pool.query<DoctorPatient>(`${select} AND relationship.patient_id=$2`, [doctorId, patientId])).rows[0];
    },
  };
}

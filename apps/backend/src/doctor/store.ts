import type pg from "pg";

export interface DoctorPatient {
  id: string;
  name: string;
}

export interface DoctorStore {
  listPatients(doctorId: string): Promise<DoctorPatient[]>;
  getPatient(doctorId: string, patientId: string): Promise<DoctorPatient | undefined>;
}

const select = `SELECT patient.id,patient.name
  FROM chroniccare.doctor_patient_relationships relationship
  JOIN chroniccare.users doctor ON doctor.id=relationship.doctor_id AND doctor.role='doctor'
  JOIN chroniccare.users patient ON patient.id=relationship.patient_id AND patient.role='patient'
  WHERE relationship.doctor_id=$1`;

export function postgresDoctorStore(pool: Pick<pg.Pool, "query">): DoctorStore {
  return {
    async listPatients(doctorId) {
      return (await pool.query<DoctorPatient>(`${select} ORDER BY lower(patient.name),patient.id`, [doctorId])).rows;
    },
    async getPatient(doctorId, patientId) {
      return (await pool.query<DoctorPatient>(`${select} AND relationship.patient_id=$2`, [doctorId, patientId])).rows[0];
    },
  };
}

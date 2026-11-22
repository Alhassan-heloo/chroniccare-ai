export const queryKeys = {
  adminDoctors: ["admin", "doctors"] as const,
  doctorPatients: ["doctor", "patients"] as const,
  doctorPatientScope: (doctorId: string, patientId: string) => ["doctor", "patient", doctorId, patientId] as const,
  doctorPatientDenial: (doctorId: string, patientId: string) => ["doctor", "patient-denial", doctorId, patientId] as const,
  reports: ["patient", "reports"] as const,
  dashboard: ["patient", "dashboard"] as const,
  measurements: ["patient", "measurements"] as const,
  medications: ["patient", "medications"] as const,
  habits: ["patient", "habits"] as const,
  notifications: ["notifications"] as const,
};

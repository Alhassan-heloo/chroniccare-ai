export const queryKeys = {
  adminDoctors: ["admin", "doctors"] as const,
  doctorPatients: ["doctor", "patients"] as const,
  doctorPatient: (patientId: string) => ["doctor", "patients", patientId] as const,
  reports: ["patient", "reports"] as const,
  dashboard: ["patient", "dashboard"] as const,
  measurements: ["patient", "measurements"] as const,
  medications: ["patient", "medications"] as const,
  habits: ["patient", "habits"] as const,
  notifications: ["patient", "notifications"] as const,
};

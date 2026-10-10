import type { PatientDashboard } from "@/lib/types/dashboard";
export const patientDashboardPlaceholder: Omit<
  PatientDashboard,
  "medication" | "habits" | "bloodPressure" | "glucose" | "weekly"
> = {
  patient: {
    id: "demo-patient",
    name: "محمد",
    email: "mohammad@example.com",
    role: "patient",
    conditions: ["السكري", "ارتفاع ضغط الدم"],
  },
  reminder: {
    id: "glucose-reminder",
    title: "قياس السكر",
    description: "اليوم، الساعة 10 مساءً",
    level: "info",
    read: false,
  },
};

export const demoWeeklyMeasurements = [
  { systolic: 122, diastolic: 78, glucose: 102 },
  { systolic: 118, diastolic: 76, glucose: 96 },
  { systolic: 124, diastolic: 80, glucose: 104 },
  { systolic: 120, diastolic: 78, glucose: 100 },
  { systolic: 119, diastolic: 77, glucose: 98 },
  { systolic: 122, diastolic: 79, glucose: 102 },
  { systolic: 120, diastolic: 80, glucose: 98 },
] as const;

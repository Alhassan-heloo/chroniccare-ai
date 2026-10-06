import type { PatientDashboard } from "@/lib/types/dashboard";
export const patientDashboardPlaceholder: Omit<PatientDashboard, "medication"> =
  {
    patient: {
      id: "demo-patient",
      name: "محمد",
      email: "mohammad@example.com",
      role: "patient",
      conditions: ["السكري", "ارتفاع ضغط الدم"],
    },
    bloodPressure: { systolic: 120, diastolic: 80, isExample: true },
    glucose: { value: 98, isExample: true },
    steps: 4500,
    stepGoal: 10000,
    habits: [
      {
        id: "walk",
        title: "المشي لمدة 20 دقيقة",
        description: "خطوة صغيرة لصحة أفضل",
        completed: false,
        kind: "walk",
      },
      {
        id: "water",
        title: "شرب الماء",
        description: "6 من 8 أكواب اليوم",
        completed: false,
        kind: "water",
      },
    ],
    reminder: {
      id: "glucose-reminder",
      title: "قياس السكر",
      description: "اليوم، الساعة 10 مساءً",
      level: "info",
      read: false,
    },
    weekly: [
      { day: "الأحد", systolic: 122, diastolic: 78, glucose: 102 },
      { day: "الإثنين", systolic: 118, diastolic: 76, glucose: 96 },
      { day: "الثلاثاء", systolic: 124, diastolic: 80, glucose: 104 },
      { day: "الأربعاء", systolic: 120, diastolic: 78, glucose: 100 },
      { day: "الخميس", systolic: 119, diastolic: 77, glucose: 98 },
      { day: "الجمعة", systolic: 122, diastolic: 79, glucose: 102 },
      { day: "السبت", systolic: 120, diastolic: 80, glucose: 98 },
    ],
  };

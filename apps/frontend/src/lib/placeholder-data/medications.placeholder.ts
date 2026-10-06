import type { Medication } from "@/lib/types/medication";
import { localDateKey } from "@/lib/utils/measurementFilters";
export function createMedicationPlaceholders(): Medication[] {
  const today = localDateKey(new Date().toISOString());
  return [
    {
      id: "demo-pressure",
      name: "دواء الضغط (مثال)",
      dosage: "حسب الوصفة المسجلة",
      notes: "بيانات توضيحية فقط، وليست وصفة علاجية.",
      doses: [
        { time: "08:00", takenOn: today },
        { time: "20:00", takenOn: null },
      ],
    },
    {
      id: "demo-glucose",
      name: "دواء السكري (مثال)",
      dosage: "حسب الوصفة المسجلة",
      notes: "",
      doses: [{ time: "09:00", takenOn: today }],
    },
  ];
}

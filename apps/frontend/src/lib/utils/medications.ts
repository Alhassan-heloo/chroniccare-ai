import type { Medication, MedicationSummary } from "@/lib/types/medication";
import { localDateKey } from "./measurementFilters";
export function todayKey() {
  return localDateKey(new Date().toISOString());
}
export function summarizeMedications(
  items: Medication[],
  day = todayKey(),
): MedicationSummary {
  const doses = items
    .flatMap((item) =>
      item.doses.map((dose) => ({
        ...dose,
        medicationId: item.id,
        name: item.name,
      })),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  const pending = doses.find((dose) => dose.takenOn !== day);
  return {
    id: "daily-medications",
    name: pending
      ? pending.name
      : doses.length
        ? "اكتملت جرعات اليوم"
        : "لا توجد أدوية مسجلة",
    time: pending?.time ?? "",
    taken: doses.filter((dose) => dose.takenOn === day).length,
    total: doses.length,
    nextDose: pending
      ? { medicationId: pending.medicationId, time: pending.time }
      : null,
  };
}

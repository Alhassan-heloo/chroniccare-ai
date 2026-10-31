import { useQuery } from "@tanstack/react-query";
import { getPatientReport } from "@/lib/api/reports";
import { queryKeys } from "@/lib/query/queryKeys";
import type { ReportPeriod } from "@/lib/types/report";
import { useMeasurementSource } from "@/hooks/useMeasurementSource";
import { useMedicationSource } from "@/hooks/useMedicationSource";
import { useHabitSource } from "@/hooks/useHabitSource";
export function usePatientReport(period: ReportPeriod) {
  const measurements = useMeasurementSource();
  const medications = useMedicationSource();
  const habits = useHabitSource();
  return useQuery({
    queryKey: [...queryKeys.reports, period, ...measurements.scope],
    enabled: measurements.enabled && medications.enabled && habits.enabled,
    queryFn: async ({ signal }) => {
      const [readings, medicationItems, habitItems] = await Promise.all([
        measurements.source.list(signal),
        medications.source.list(signal),
        habits.source.list(signal),
      ]);
      return getPatientReport(period, readings, medicationItems, habitItems);
    },
    refetchInterval: 60_000,
  });
}

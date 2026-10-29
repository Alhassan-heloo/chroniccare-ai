import { useQuery } from "@tanstack/react-query";
import { getPatientReport } from "@/lib/api/reports";
import { queryKeys } from "@/lib/query/queryKeys";
import type { ReportPeriod } from "@/lib/types/report";
import { useMeasurementSource } from "@/hooks/useMeasurementSource";
import { useMedicationSource } from "@/hooks/useMedicationSource";
export function usePatientReport(period: ReportPeriod) {
  const measurements = useMeasurementSource();
  const medications = useMedicationSource();
  return useQuery({
    queryKey: [...queryKeys.reports, period, ...measurements.scope],
    enabled: measurements.enabled && medications.enabled,
    queryFn: async ({ signal }) => {
      const [readings, medicationItems] = await Promise.all([measurements.source.list(signal), medications.source.list(signal)]);
      return getPatientReport(period, readings, medicationItems);
    },
    refetchInterval: 60_000,
  });
}

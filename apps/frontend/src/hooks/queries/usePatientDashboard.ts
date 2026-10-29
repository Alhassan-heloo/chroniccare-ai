import { useQuery } from "@tanstack/react-query";
import { getPatientDashboard } from "@/lib/api/patient";
import { queryKeys } from "@/lib/query/queryKeys";
import { useMeasurementSource } from "@/hooks/useMeasurementSource";
import { useMedicationSource } from "@/hooks/useMedicationSource";
export function usePatientDashboard() {
  const measurements = useMeasurementSource();
  const medications = useMedicationSource();
  return useQuery({
    queryKey: [...queryKeys.dashboard, ...measurements.scope],
    enabled: measurements.enabled && medications.enabled,
    refetchInterval: 60_000,
    queryFn: async ({ signal }) => {
      const [readings, medicationItems] = await Promise.all([measurements.source.list(signal), medications.source.list(signal)]);
      const data = await getPatientDashboard(readings, medicationItems);
      return !measurements.demo && measurements.user ? { ...data, patient: { ...measurements.user, conditions: [] } } : data;
    },
  });
}
export function useMeasurements() {
  const { source, scope, enabled } = useMeasurementSource();
  return useQuery({ queryKey: [...queryKeys.measurements, ...scope], enabled, queryFn: ({ signal }) => source.list(signal) });
}

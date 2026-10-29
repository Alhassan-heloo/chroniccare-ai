import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import { useMedicationSource } from "@/hooks/useMedicationSource";
export function useMedications() {
  const { source, scope, enabled } = useMedicationSource();
  return useQuery({
    queryKey: [...queryKeys.medications, ...scope],
    enabled,
    queryFn: ({ signal }) => source.list(signal),
    refetchInterval: 60_000,
  });
}

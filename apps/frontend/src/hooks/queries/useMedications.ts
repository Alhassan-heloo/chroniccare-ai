import { useQuery } from "@tanstack/react-query";
import { getMedications } from "@/lib/api/medications";
import { queryKeys } from "@/lib/query/queryKeys";
export function useMedications() {
  return useQuery({
    queryKey: queryKeys.medications,
    queryFn: getMedications,
    refetchInterval: 60_000,
  });
}

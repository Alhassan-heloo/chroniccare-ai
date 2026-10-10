import { useQuery } from "@tanstack/react-query";
import { getPatientReport } from "@/lib/api/reports";
import { queryKeys } from "@/lib/query/queryKeys";
import type { ReportPeriod } from "@/lib/types/report";
export function usePatientReport(period: ReportPeriod) {
  return useQuery({
    queryKey: [...queryKeys.reports, period],
    queryFn: () => getPatientReport(period),
    refetchInterval: 60_000,
  });
}

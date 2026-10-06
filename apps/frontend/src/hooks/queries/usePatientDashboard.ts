import { useQuery } from "@tanstack/react-query";
import { getPatientDashboard, getMeasurements } from "@/lib/api/patient";
import { queryKeys } from "@/lib/query/queryKeys";
export const usePatientDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboard,
    refetchInterval: 60_000,
    queryFn: getPatientDashboard,
  });
export const useMeasurements = () =>
  useQuery({ queryKey: queryKeys.measurements, queryFn: getMeasurements });

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/context";
import { getDoctorPatient, getDoctorPatients } from "@/lib/api/doctor";
import { queryKeys } from "@/lib/query/queryKeys";

export function useDoctorPatients() {
  const { request, user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.doctorPatients, user?.id ?? "signed-out"],
    enabled: user?.role === "doctor",
    queryFn: ({ signal }) => getDoctorPatients(request, signal),
    refetchOnWindowFocus: true,
    staleTime: 0,
    refetchInterval: 15_000,
  });
}

export function useDoctorPatient(patientId: string | undefined) {
  const { request, user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.doctorPatient(patientId ?? "missing"), user?.id ?? "signed-out"],
    enabled: user?.role === "doctor" && Boolean(patientId),
    queryFn: ({ signal }) => getDoctorPatient(request, patientId!, signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
}

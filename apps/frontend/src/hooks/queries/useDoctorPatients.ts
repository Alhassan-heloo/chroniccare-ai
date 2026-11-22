import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthError } from "@/auth/api";
import { useAuth } from "@/auth/context";
import { getDoctorActivity, getDoctorPatient, getDoctorPatients } from "@/lib/api/doctor";
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

function isAccessDenied(error: unknown) {
  return error instanceof AuthError && ["DOCTOR_PATIENT_NOT_FOUND", "FORBIDDEN", "PASSWORD_CHANGE_REQUIRED"].includes(error.code);
}

export function useDoctorPatient(patientId: string | undefined) {
  const { request, user } = useAuth();
  const client = useQueryClient();
  const doctorId = user?.id ?? "signed-out";
  const scope = queryKeys.doctorPatientScope(doctorId, patientId ?? "missing");
  const denialKey = queryKeys.doctorPatientDenial(doctorId, patientId ?? "missing");
  const { data: denied } = useQuery<boolean>({ queryKey: denialKey, queryFn: skipToken, initialData: false, staleTime: Infinity });
  const enabled = user?.role === "doctor" && Boolean(patientId) && !denied;
  const retry = (attempt: number, error: unknown) => !isAccessDenied(error) && attempt < 1;

  async function protectedRead<T>(signal: AbortSignal, read: () => Promise<T>): Promise<T> {
    function requireCurrentRead() {
      if (signal.aborted || client.getQueryData(denialKey)) throw new AuthError("DOCTOR_PATIENT_NOT_FOUND");
    }
    requireCurrentRead();
    let data: T;
    try {
      data = await read();
    } catch (error) {
      if (!signal.aborted && isAccessDenied(error)) {
        client.setQueryData(denialKey, true);
        // Removing a TanStack query cancels its retryer and aborts the consumed signal.
        // The denial lives outside the removed scope so an observer cannot revive either request.
        client.removeQueries({ queryKey: scope });
        void client.invalidateQueries({ queryKey: [...queryKeys.doctorPatients, doctorId], exact: true });
      }
      throw error;
    }
    requireCurrentRead();
    return data;
  }

  const record = useQuery({
    queryKey: [...scope, "record"],
    enabled,
    queryFn: ({ signal }) => protectedRead(signal, () => getDoctorPatient(request, patientId!, signal)),
    retry,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
  const date = record.isFetchedAfterMount && !record.isError ? record.data?.date : undefined;
  const activity = useQuery({
    queryKey: [...scope, "activity", date ?? "missing"],
    enabled: enabled && Boolean(date),
    queryFn: ({ signal }) => protectedRead(signal, () => getDoctorActivity(request, patientId!, date!, signal)),
    retry,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  });
  function checkAgain() {
    if (denied) client.setQueryData(denialKey, false);
    else void record.refetch();
  }
  return { record, activity, denied, checkAgain };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/context";
import { createAdminDoctor, getAdminDoctors } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/queryKeys";

export function useAdminDoctors() {
  const { request, user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.adminDoctors, user?.id ?? "signed-out"],
    enabled: user?.role === "admin",
    queryFn: ({ signal }) => getAdminDoctors(request, signal),
  });
}

export function useCreateDoctor() {
  const { request } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createAdminDoctor>[1]) => createAdminDoctor(request, input),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: queryKeys.adminDoctors }); },
  });
}

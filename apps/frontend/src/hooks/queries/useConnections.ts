import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/context";
import { connectionApi } from "@/lib/api/connections";

export function useConnections() {
  const { request, user } = useAuth();
  const client = useQueryClient();
  const key = ["patient", "doctors", user?.id ?? "signed-out"];
  const list = useQuery({ queryKey: key, enabled: user?.role === "patient",
    queryFn: ({ signal }) => connectionApi.list(request, signal), refetchOnWindowFocus: true, staleTime: 0 });
  const changed = () => client.invalidateQueries({ queryKey: key });
  const generate = useMutation({ mutationFn: () => connectionApi.generate(request), retry: 0 });
  const preview = useMutation({ mutationFn: (code: string) => connectionApi.preview(request, code), retry: 0 });
  const approve = useMutation({ mutationFn: (code: string) => connectionApi.approve(request, code), onSuccess: changed, retry: 0 });
  const revoke = useMutation({ mutationFn: (id: string) => connectionApi.revoke(request, id), onSuccess: changed, retry: 0 });
  return { list, generate, preview, approve, revoke };
}

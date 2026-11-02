import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/context";
import { getNotifications, getUnreadCount, markNotificationRead } from "@/lib/api/notifications";
import { queryKeys } from "@/lib/query/queryKeys";
export function useNotifications(open: boolean) {
  const { user, request } = useAuth();
  const client = useQueryClient();
  const key = [...queryKeys.notifications, user?.id ?? "signed-out"];
  const count = useQuery({ queryKey: [...key, "count"], enabled: !!user,
    queryFn: ({ signal }) => getUnreadCount(request, signal), refetchInterval: 30000, refetchOnWindowFocus: true });
  const list = useQuery({ queryKey: [...key, "list"], enabled: !!user && open,
    queryFn: ({ signal }) => getNotifications(request, signal), staleTime: 0,
    refetchInterval: open ? 30000 : false, refetchOnWindowFocus: true });
  const read = useMutation({ mutationFn: (id: string) => markNotificationRead(request, id), retry: 0,
    onSuccess: () => client.invalidateQueries({ queryKey: key }) });
  return { count, list, read };
}

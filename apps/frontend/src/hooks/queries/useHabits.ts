import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import { useHabitSource } from "@/hooks/useHabitSource";
export function useHabits() {
  const { source, scope, enabled } = useHabitSource();
  return useQuery({
    queryKey: [...queryKeys.habits, ...scope],
    enabled,
    queryFn: ({ signal }) => source.list(signal),
    refetchInterval: 60000,
  });
}

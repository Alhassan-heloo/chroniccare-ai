import { useQuery } from "@tanstack/react-query";
import { getHabits } from "@/lib/api/habits";
import { queryKeys } from "@/lib/query/queryKeys";
export function useHabits() {
  return useQuery({
    queryKey: queryKeys.habits,
    queryFn: getHabits,
    refetchInterval: 60000,
  });
}

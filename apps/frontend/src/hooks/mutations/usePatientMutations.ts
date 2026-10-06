import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toggleHabit } from "@/lib/api/patient";
import { queryKeys } from "@/lib/query/queryKeys";
export function useToggleHabit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: toggleHabit,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.dashboard }),
    onError: () => toast.error("تعذر تحديث المهمة"),
  });
}

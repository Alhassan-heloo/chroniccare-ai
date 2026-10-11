import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addHabit,
  updateHabit,
  deleteHabit,
  setHabitProgress,
} from "@/lib/api/habits";
import { queryKeys } from "@/lib/query/queryKeys";
function useFeedback(message: string) {
  const client = useQueryClient();
  return {
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.reports }),
        client.invalidateQueries({ queryKey: queryKeys.habits }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
      toast.success(message);
    },
    onError: () => toast.error("تعذر تحديث العادة. حاول مرة أخرى."),
  };
}
export function useAddHabit() {
  return useMutation({
    mutationFn: addHabit,
    ...useFeedback("تمت إضافة العادة"),
  });
}
export function useUpdateHabit() {
  return useMutation({
    mutationFn: updateHabit,
    ...useFeedback("تم تعديل العادة"),
  });
}
export function useDeleteHabit() {
  return useMutation({
    mutationFn: deleteHabit,
    ...useFeedback("تم حذف العادة"),
  });
}
export function useSetHabitProgress() {
  return useMutation({
    mutationFn: setHabitProgress,
    ...useFeedback("تم تحديث تقدم اليوم"),
  });
}

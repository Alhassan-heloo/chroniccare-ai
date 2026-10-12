import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addHabit,
  updateHabit,
  deleteHabit,
  setHabitProgress,
} from "@/lib/api/habits";
import { queryKeys } from "@/lib/query/queryKeys";
import { useI18n } from "@/i18n/context";
import type { TranslationKey } from "@/i18n/catalog";
function useFeedback(message: TranslationKey) {
  const { t } = useI18n();
  const client = useQueryClient();
  return {
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.reports }),
        client.invalidateQueries({ queryKey: queryKeys.habits }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
      toast.success(t(message));
    },
    onError: () => toast.error(t("habits.ui.failed")),
  };
}
export function useAddHabit() {
  return useMutation({
    mutationFn: addHabit,
    ...useFeedback("habits.ui.added"),
  });
}
export function useUpdateHabit() {
  return useMutation({
    mutationFn: updateHabit,
    ...useFeedback("habits.ui.updated"),
  });
}
export function useDeleteHabit() {
  return useMutation({
    mutationFn: deleteHabit,
    ...useFeedback("habits.ui.deleted"),
  });
}
export function useSetHabitProgress() {
  return useMutation({
    mutationFn: setHabitProgress,
    ...useFeedback("habits.ui.progressUpdated"),
  });
}

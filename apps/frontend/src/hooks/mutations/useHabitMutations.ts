import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useHabitSource } from "@/hooks/useHabitSource";
import { AuthError } from "@/auth/api";
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
    onError: (error: Error) => {
      if (!(error instanceof AuthError && ["SESSION_CHANGED", "UNAUTHENTICATED"].includes(error.code))) {
        toast.error(t("habits.ui.failed"));
      }
    },
  };
}
export function useAddHabit() {
  const { source } = useHabitSource();
  return useMutation({
    mutationFn: source.create,
    ...useFeedback("habits.ui.added"),
  });
}
export function useUpdateHabit() {
  const { source } = useHabitSource();
  return useMutation({
    mutationFn: source.update,
    ...useFeedback("habits.ui.updated"),
  });
}
export function useDeleteHabit() {
  const { source } = useHabitSource();
  return useMutation({
    mutationFn: source.delete,
    ...useFeedback("habits.ui.deleted"),
  });
}
export function useSetHabitProgress() {
  const { source } = useHabitSource();
  return useMutation({
    mutationFn: source.setProgress,
    ...useFeedback("habits.ui.progressUpdated"),
  });
}

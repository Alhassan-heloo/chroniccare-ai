import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMeasurementSource } from "@/hooks/useMeasurementSource";
import { AuthError } from "@/auth/api";
import { queryKeys } from "@/lib/query/queryKeys";
import { useI18n } from "@/i18n/context";
import type { TranslationKey } from "@/i18n/catalog";
function useMeasurementFeedback(successMessage: TranslationKey) {
  const { t } = useI18n();
  const client = useQueryClient();
  return {
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.reports }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
        client.invalidateQueries({ queryKey: queryKeys.measurements }),
      ]);
      toast.success(t(successMessage));
    },
    onError: (error: Error) => {
      if (!(error instanceof AuthError && ["SESSION_CHANGED", "UNAUTHENTICATED"].includes(error.code))) toast.error(t("measurements.ui.failed"));
    },
  };
}
export function useAddMeasurement() {
  const { source, demo } = useMeasurementSource();
  return useMutation({
    mutationFn: source.create,
    ...useMeasurementFeedback(demo ? "measurements.ui.saved" : "measurements.persistence.saved"),
  });
}
export function useUpdateMeasurement() {
  const { source } = useMeasurementSource();
  return useMutation({
    mutationFn: source.update,
    ...useMeasurementFeedback("measurements.ui.updated"),
  });
}
export function useDeleteMeasurement() {
  const { source } = useMeasurementSource();
  return useMutation({
    mutationFn: source.delete,
    ...useMeasurementFeedback("measurements.ui.deleted"),
  });
}

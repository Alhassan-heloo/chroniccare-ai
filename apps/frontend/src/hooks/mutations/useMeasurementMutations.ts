import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMeasurementSource } from "@/hooks/useMeasurementSource";
import { AuthError } from "@/auth/api";
import { queryKeys } from "@/lib/query/queryKeys";
import { useI18n } from "@/i18n/context";
import type { TranslationKey } from "@/i18n/catalog";
import {announceSavedReading} from "@/hooks/useSavedReading";
function useMeasurementFeedback(successMessage: TranslationKey) {
  const { t } = useI18n();
  const client = useQueryClient();
  return {
    onSuccess: async (result: unknown) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.reports }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
        client.invalidateQueries({ queryKey: queryKeys.measurements }),
      ]);
      if (successMessage==="measurements.persistence.saved" && result && typeof result==="object" && "id" in result && typeof result.id==="string") announceSavedReading(result.id);
      toast.success(t(successMessage));
    },
    onError: (error: Error) => {
      if (!(error instanceof AuthError && ["SESSION_CHANGED", "UNAUTHENTICATED"].includes(error.code))) toast.error(t("measurements.ui.failed"));
    },
  };
}
export function useAddMeasurement() {
  const { source } = useMeasurementSource();
  return useMutation({
    mutationFn: source.create,
    ...useMeasurementFeedback("measurements.persistence.saved"),
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

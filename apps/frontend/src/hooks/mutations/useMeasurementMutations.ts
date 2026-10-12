import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from "@/lib/api/patient";
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
    onError: () => toast.error(t("measurements.ui.failed")),
  };
}
export function useAddMeasurement() {
  return useMutation({
    mutationFn: addMeasurement,
    ...useMeasurementFeedback("measurements.ui.saved"),
  });
}
export function useUpdateMeasurement() {
  return useMutation({
    mutationFn: updateMeasurement,
    ...useMeasurementFeedback("measurements.ui.updated"),
  });
}
export function useDeleteMeasurement() {
  return useMutation({
    mutationFn: deleteMeasurement,
    ...useMeasurementFeedback("measurements.ui.deleted"),
  });
}

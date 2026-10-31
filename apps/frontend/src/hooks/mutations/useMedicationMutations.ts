import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMedicationSource } from "@/hooks/useMedicationSource";
import { AuthError } from "@/auth/api";
import { queryKeys } from "@/lib/query/queryKeys";
import { useI18n } from "@/i18n/context";
import type { TranslationKey } from "@/i18n/catalog";
function useMedicationFeedback(message: TranslationKey) {
  const client = useQueryClient();
  const { t } = useI18n();
  return {
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.reports }),
        client.invalidateQueries({ queryKey: queryKeys.medications }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
      toast.success(t(message));
    },
    onError: (error: Error) => {
      if (!(error instanceof AuthError && ["SESSION_CHANGED", "UNAUTHENTICATED"].includes(error.code))) toast.error(t("medications.persistence.failed"));
    },
  };
}
export function useAddMedication() {
  const { source } = useMedicationSource();
  return useMutation({
    mutationFn: source.create,
    ...useMedicationFeedback("medications.persistence.added"),
  });
}
export function useUpdateMedication() {
  const { source } = useMedicationSource();
  return useMutation({
    mutationFn: source.update,
    ...useMedicationFeedback("medications.persistence.updated"),
  });
}
export function useDeleteMedication() {
  const { source } = useMedicationSource();
  return useMutation({
    mutationFn: source.delete,
    ...useMedicationFeedback("medications.persistence.deleted"),
  });
}
export function useSetDoseTaken() {
  const { source } = useMedicationSource();
  return useMutation({
    mutationFn: source.setDoseTaken,
    ...useMedicationFeedback("medications.persistence.doseUpdated"),
  });
}

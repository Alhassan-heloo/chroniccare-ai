import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addMedication,
  updateMedication,
  deleteMedication,
  setDoseTaken,
} from "@/lib/api/medications";
import { queryKeys } from "@/lib/query/queryKeys";
function useMedicationFeedback(message: string) {
  const client = useQueryClient();
  return {
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.reports }),
        client.invalidateQueries({ queryKey: queryKeys.medications }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
      toast.success(message);
    },
    onError: () => toast.error("تعذر تحديث الدواء. حاول مرة أخرى."),
  };
}
export function useAddMedication() {
  return useMutation({
    mutationFn: addMedication,
    ...useMedicationFeedback("تمت إضافة الدواء مؤقتًا"),
  });
}
export function useUpdateMedication() {
  return useMutation({
    mutationFn: updateMedication,
    ...useMedicationFeedback("تم تعديل الدواء"),
  });
}
export function useDeleteMedication() {
  return useMutation({
    mutationFn: deleteMedication,
    ...useMedicationFeedback("تم حذف الدواء ومواعيده"),
  });
}
export function useSetDoseTaken() {
  return useMutation({
    mutationFn: setDoseTaken,
    ...useMedicationFeedback("تم تحديث سجل تناول الجرعة"),
  });
}

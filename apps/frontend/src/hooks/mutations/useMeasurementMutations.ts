import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from "@/lib/api/patient";
import { queryKeys } from "@/lib/query/queryKeys";
function useMeasurementFeedback(successMessage: string) {
  const client = useQueryClient();
  return {
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
        client.invalidateQueries({ queryKey: queryKeys.measurements }),
      ]);
      toast.success(successMessage);
    },
    onError: () => toast.error("تعذر تنفيذ العملية. حاول مرة أخرى."),
  };
}
export function useAddMeasurement() {
  return useMutation({
    mutationFn: addMeasurement,
    ...useMeasurementFeedback("تم حفظ القراءة مؤقتًا"),
  });
}
export function useUpdateMeasurement() {
  return useMutation({
    mutationFn: updateMeasurement,
    ...useMeasurementFeedback("تم تعديل القراءة"),
  });
}
export function useDeleteMeasurement() {
  return useMutation({
    mutationFn: deleteMeasurement,
    ...useMeasurementFeedback("تم حذف القراءة"),
  });
}

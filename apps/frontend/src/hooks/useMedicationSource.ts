import { useMemo } from "react";
import { useAuth } from "@/auth/context";
import { addMedication, deleteMedication, getMedications, setDoseTaken, updateMedication } from "@/lib/api/medications";
import { authenticatedMedications, type MedicationSource } from "@/lib/api/persistentMedications";

const demoMedications: MedicationSource = { list: getMedications, create: addMedication, update: updateMedication, delete: deleteMedication, setDoseTaken };
export function useMedicationSource() {
  const { demo, user, request } = useAuth();
  const source = useMemo(() => demo ? demoMedications : authenticatedMedications(request), [demo, request]);
  return { source, scope: demo ? [] : ["account", user?.id ?? "signed-out"], enabled: demo || user?.role === "patient", demo };
}

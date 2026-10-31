import { useMemo } from "react";
import { useAuth } from "@/auth/context";
import { authenticatedMedications } from "@/lib/api/persistentMedications";

export function useMedicationSource() {
  const { user, request } = useAuth();
  const source = useMemo(() => authenticatedMedications(request), [request]);
  return { source, scope: ["account", user?.id ?? "signed-out"], enabled: user?.role === "patient" };
}

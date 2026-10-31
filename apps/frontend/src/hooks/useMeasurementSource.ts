import { useMemo } from "react";
import { useAuth } from "@/auth/context";
import { authenticatedMeasurements } from "@/lib/api/measurements";

export function useMeasurementSource() {
  const { user, request } = useAuth();
  const source = useMemo(() => authenticatedMeasurements(request), [request]);
  return { source, scope: ["account", user?.id ?? "signed-out"], enabled: user?.role === "patient", user };
}

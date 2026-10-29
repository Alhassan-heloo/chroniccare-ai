import { useMemo } from "react";
import { useAuth } from "@/auth/context";
import { authenticatedMeasurements, type MeasurementSource } from "@/lib/api/measurements";
import { getMeasurements, addMeasurement, updateMeasurement, deleteMeasurement } from "@/lib/api/patient";

const demoMeasurements: MeasurementSource = { list: getMeasurements, create: addMeasurement, update: updateMeasurement, delete: deleteMeasurement };
export function useMeasurementSource() {
  const { demo, user, request } = useAuth();
  const source = useMemo(() => demo ? demoMeasurements : authenticatedMeasurements(request), [demo, request]);
  return { source, scope: demo ? [] : ["account", user?.id ?? "signed-out"], enabled: demo || user?.role === "patient", demo, user };
}

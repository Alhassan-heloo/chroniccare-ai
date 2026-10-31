import { useMemo } from "react";
import { useAuth } from "@/auth/context";
import { authenticatedHabits } from "@/lib/api/persistentHabits";

export function useHabitSource() {
  const { user, request } = useAuth();
  const source = useMemo(() => authenticatedHabits(request), [request]);
  return {
    source,
    scope: ["account", user?.id ?? "signed-out"],
    enabled: user?.role === "patient",
  };
}

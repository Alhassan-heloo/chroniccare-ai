import type { WeeklyPoint } from "@/lib/types/dashboard";
import { PrecisionHealthChart } from "./PrecisionHealthChart";
export function TrendChart({ data, kind, compact = false }: { data: WeeklyPoint[]; kind: "pressure" | "glucose"; compact?: boolean }) {
  return <PrecisionHealthChart data={data} kind={kind} compact={compact} />;
}

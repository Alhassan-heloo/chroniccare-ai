import type { WeeklyPoint } from "@/lib/types/dashboard";
import { TrendChart } from "./TrendChart";
export function BloodPressureChart({ data }: { data: WeeklyPoint[] }) {
  return <TrendChart data={data} kind="pressure" />;
}

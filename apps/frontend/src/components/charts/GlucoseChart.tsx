import type { WeeklyPoint } from "@/lib/types/dashboard";
import { TrendChart } from "./TrendChart";
export function GlucoseChart({ data }: { data: WeeklyPoint[] }) {
  return <TrendChart data={data} kind="glucose" />;
}

import type { ReportPoint } from "@/lib/types/report";
import { PrecisionHealthChart } from "./PrecisionHealthChart";
export default function ReportChart({ points, kind }: { points: ReportPoint[]; kind: "pressure" | "glucose" }) {
  return <PrecisionHealthChart data={points} kind={kind} />;
}

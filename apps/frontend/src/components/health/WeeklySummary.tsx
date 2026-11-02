import { useState, type ReactNode } from "react";
import type { WeeklyPoint } from "@/lib/types/dashboard";
import { TrendChart } from "@/components/charts/TrendChart";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
export function WeeklySummary({ data, readouts }: { data: WeeklyPoint[]; readouts?: ReactNode }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<"pressure" | "glucose">("pressure");
  return <section className="weekly-section health-canvas glass" data-kind={kind} data-i18n="declarative"><div className="section-heading"><h2>{t("patient.overview.weekly")}</h2><div className="segmented" role="group" aria-label={t("patient.overview.chartType")}><Button variant="ghost" aria-pressed={kind === "pressure"} onClick={() => setKind("pressure")}>{t("measurements.bloodPressure")}</Button><Button variant="ghost" aria-pressed={kind === "glucose"} onClick={() => setKind("glucose")}>{t("measurements.bloodGlucose")}</Button></div></div>{readouts}<TrendChart data={data} kind={kind} /></section>;
}

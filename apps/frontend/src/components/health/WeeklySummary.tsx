import { useState } from "react";
import type { WeeklyPoint } from "@/lib/types/dashboard";
import { BloodPressureChart } from "@/components/charts/BloodPressureChart";
import { GlucoseChart } from "@/components/charts/GlucoseChart";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
export function WeeklySummary({ data }: { data: WeeklyPoint[] }) {
  const { t, formatNumber, formatDate, formatUnit } = useI18n();
  const [kind, setKind] = useState<"pressure" | "glucose">("pressure");
  const visible = data.filter((point) =>
    kind === "pressure"
      ? point.systolic !== undefined
      : point.glucose !== undefined,
  );
  const includesExamples = visible.some((point) => point.isExample);
  return (
    <Card className="weekly-section" data-i18n="declarative">
      <div className="section-heading">
        <div>
          <h2>{t("patient.overview.weekly")}</h2>
          <p>
            {t("patient.overview.readings")}
            {includesExamples ? ` · ${t("patient.overview.includesExamples")}` : ""}
          </p>
        </div>
        <div className="segmented" role="group" aria-label={t("patient.overview.chartType")}>
          <Button
            variant="ghost"
            aria-pressed={kind === "pressure"}
            onClick={() => setKind("pressure")}
          >
            {t("measurements.bloodPressure")}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={kind === "glucose"}
            onClick={() => setKind("glucose")}
          >
            {t("common.chart.glucose")}
          </Button>
        </div>
      </div>
      {!visible.length ? (
        <p className="empty-state">{t("patient.overview.weeklyEmpty")}</p>
      ) : kind === "pressure" ? (
        <BloodPressureChart data={data} />
      ) : (
        <GlucoseChart data={data} />
      )}
      {visible.length > 0 && <div className="chart-legend">
        {kind === "pressure" ? (
          <>
            <span>
              <i /> {t("common.chart.systolic")}
            </span>
            <span>
              <i className="blue" /> {t("common.chart.diastolic")}
            </span>
            <span>{formatUnit("mmHg")}</span>
          </>
        ) : (
          <span>
            <i /> {t("measurements.bloodGlucose")} · {formatUnit("mg/dL")}
          </span>
        )}
      </div>}
      {visible.length > 0 && <details className="chart-data">
        <summary>{t("patient.overview.textReadings")}</summary>
        <ul>
          {visible.map((point) => (
            <li key={point.day}>
              {formatDate(`${point.day}T12:00:00`, { day: "numeric", month: "short" })}:{" "}
              <bdi>
                {kind === "pressure"
                  ? `${formatNumber(point.systolic ?? 0)}/${formatNumber(point.diastolic ?? 0)} ${formatUnit("mmHg")}`
                  : `${formatNumber(point.glucose ?? 0)} ${formatUnit("mg/dL")}`}
              </bdi>
              {point.isExample ? ` · ${t("patient.overview.example")}` : ""}
            </li>
          ))}
        </ul>
      </details>}
    </Card>
  );
}

import { demoWeeklyMeasurements } from "@/lib/placeholder-data/patientDashboard.placeholder";
import { useI18n } from "@/i18n/context";

/** Static illustration sourced from the same seven-day examples, never an assessment. */
export function PreviewTrend() {
  const { t, formatNumber, formatUnit } = useI18n();
  const points = demoWeeklyMeasurements.map((point, index) => `${24 + index * 94},${158 - (point.systolic - 100) * 3.5}`).join(" ");
  return <figure className="product-trend">
    <figcaption><span>{t("public.previewWeek")}</span><bdi>{formatUnit("mmHg")}</bdi></figcaption>
    <svg viewBox="0 0 612 180" aria-hidden="true" focusable="false">
      <path className="product-grid" d="M24 32H588M24 95H588M24 158H588" />
      <polyline points={points} className="product-line" />
      {demoWeeklyMeasurements.map((point, index) => <circle key={index} cx={24 + index * 94} cy={158 - (point.systolic - 100) * 3.5} r="4" />)}
    </svg>
    <span className="sr-only">{t("common.chart.systolic")}: {demoWeeklyMeasurements.map(point => formatNumber(point.systolic)).join(" / ")} {formatUnit("mmHg")}. {t("patient.overview.example")}</span>
    <div className="product-trend-values" aria-hidden="true">{demoWeeklyMeasurements.map((point, index) => <span key={index}>{formatNumber(point.systolic)}</span>)}</div>
  </figure>;
}

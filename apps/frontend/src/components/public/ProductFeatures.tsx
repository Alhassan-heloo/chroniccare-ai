import { Activity, Bot, ChartNoAxesCombined, Droplet, Footprints, HeartPulse, Pill } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { PreviewTrend } from "./PreviewTrend";
import { demoWeeklyMeasurements } from "@/lib/placeholder-data/patientDashboard.placeholder";

export function ProductFeatures() {
  const { t, formatNumber, formatUnit, formatHabitUnit } = useI18n();
  const latest = demoWeeklyMeasurements[6];
  return <div className="bento-grid">
    <article className="bento-block bento-measurements">
      <span className="product-icon"><Activity aria-hidden="true" /></span>
      <h3>{t("public.next.readings")}</h3><p>{t("public.measurementsBody")}</p>
      <div className="bento-vitals">
        <div><HeartPulse size={20} aria-hidden="true" /><span>{t("measurements.bloodPressure")}</span><strong><bdi>{formatNumber(latest.systolic)} / {formatNumber(latest.diastolic)}</bdi></strong><small>{formatUnit("mmHg")}</small></div>
        <div><Droplet size={20} aria-hidden="true" /><span>{t("measurements.bloodGlucose")}</span><strong>{formatNumber(latest.glucose)}</strong><small>{formatUnit("mg/dL")}</small></div>
      </div>
      <span className="product-status">{t("patient.overview.example")}</span>
    </article>
    <article className="bento-block bento-trends"><h3>{t("public.next.trends")}</h3><p>{t("public.next.trendsBody")}</p><PreviewTrend /></article>
    <article className="bento-block bento-habits"><span className="product-icon"><Footprints aria-hidden="true" /></span><h3>{t("public.next.habit")}</h3><p>{t("public.next.habitBody")}</p><div className="bento-habit-visual"><span className="product-progress-heading">{t("habits.ui.progress", { value: formatNumber(4500), target: formatNumber(10000), unit: formatHabitUnit("steps", 10000) })}</span><div className="product-progress" aria-hidden="true"><span /></div></div></article>
    <article className="bento-block bento-medication"><span className="product-icon"><Pill aria-hidden="true" /></span><h3>{t("public.next.medication")}</h3><p>{t("public.next.medicationBody")}</p><div className="bento-schedule" aria-hidden="true"><i /><span /><i /><span /><i /></div></article>
    <article className="bento-block bento-reports"><span className="product-icon"><ChartNoAxesCombined aria-hidden="true" /></span><h3>{t("public.next.reports")}</h3><p>{t("public.next.reportsBody")}</p><span className="bento-report-period">{t("public.next.period")}</span></article>
    <article className="bento-block bento-assistant"><span className="product-icon"><Bot aria-hidden="true" /></span><h3>{t("public.next.ai")}</h3><p>{t("public.next.aiBody")}</p><a className="bento-assistant-link" href="#assistant-preview">{t("public.next.aiStatus")} <span aria-hidden="true">↗</span></a></article>
  </div>;
}

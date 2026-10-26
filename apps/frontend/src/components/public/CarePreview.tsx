import { Activity, Check, Droplet, HeartPulse, LayoutDashboard, Pill, ChartNoAxesCombined, Bot } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { PreviewTrend } from "./PreviewTrend";
import { demoWeeklyMeasurements } from "@/lib/placeholder-data/patientDashboard.placeholder";

/** A static, clearly labelled product illustration, never a patient assessment. */
export function CarePreview() {
  const { t, formatNumber, formatUnit } = useI18n();
  const latest = demoWeeklyMeasurements[6];
  return <div className="care-preview product-window">
    <aside className="product-rail" aria-hidden="true">
      <span className="product-wordmark"><HeartPulse size={25} /><b dir="ltr">ChronicCare AI</b></span>
      <span className="selected"><LayoutDashboard size={18} />{t("patient.workspace.overview")}</span>
      <span><Activity size={18} />{t("measurements.title")}</span><span><Pill size={18} />{t("medications.title")}</span><span><Check size={18} />{t("habits.title")}</span><span><ChartNoAxesCombined size={18} />{t("reports.title")}</span><span><Bot size={18} />{t("common.navigation.assistant")}</span>
      <small>{t("public.previewNote")}</small>
    </aside>
    <div className="product-workspace">
      <div className="product-toolbar"><span>{t("public.next.workspace")} / <strong>{t("patient.workspace.overview")}</strong></span><span className="product-status">{t("patient.overview.example")}</span></div>
      <div className="product-heading"><div><span className="eyebrow">{t("public.previewCaption")}</span><h3>{t("public.previewTitle")}</h3></div><span>{t("public.next.period")}</span></div>
      <div className="product-content">
        <div className="product-measurements">
          <div className="product-reading"><span><HeartPulse size={19} aria-hidden="true" />{t("measurements.bloodPressure")}</span><strong><bdi>{formatNumber(latest.systolic)} / {formatNumber(latest.diastolic)}</bdi></strong><small>{formatUnit("mmHg")}</small></div>
          <div className="product-reading"><span><Droplet size={19} aria-hidden="true" />{t("measurements.bloodGlucose")}</span><strong>{formatNumber(latest.glucose)}</strong><small>{formatUnit("mg/dL")}</small></div>
        </div>
        <div className="product-chart-panel"><PreviewTrend /><span className="product-chart-note">{t("public.previewIllustration")}</span></div>
        <div className="product-routine"><div><Check size={19} aria-hidden="true" /><h4>{t("public.previewRoutine")}</h4></div><p>{t("public.previewRoutineCaption")}</p><div className="product-progress-heading"><span>{t("patient.metric.walking")}</span><bdi>{formatNumber(4500)} / {formatNumber(10000)}</bdi></div><div className="product-progress" aria-hidden="true"><span /></div><div className="product-routine-note"><Pill size={18} aria-hidden="true" /><span>{t("public.next.medicationBody")}</span></div><div className="product-routine-note"><Bot size={18} aria-hidden="true" /><span>{t("patient.overview.assistantUnavailable")}</span></div></div>
      </div>
    </div>
  </div>;
}

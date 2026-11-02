import { lazy, Suspense, useState } from "react";
import { HeartPulse, Droplet, Pill, Footprints, Plus, CalendarDays, ArrowUpRight, FileChartColumn, Info, Activity } from "lucide-react";
import { Link } from "react-router";
import { usePatientDashboard } from "@/hooks/queries/usePatientDashboard";
import { useDashboardActions } from "@/context/DashboardContext";
import { HealthMetricCard } from "@/components/health/HealthMetricCard";
import { MedicationCard } from "@/components/health/MedicationCard";
import { HabitCard } from "@/components/health/HabitCard";
import { AlertCard } from "@/components/health/AlertCard";
import { AssistantCard } from "@/components/health/AssistantCard";
import { LivingPulse, SignatureArtwork } from "@/components/public/living/ui";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { useI18n } from "@/i18n/context";
import { progressToday } from "@/lib/utils/habits";

const TrendChart = lazy(() => import("@/components/charts/TrendChart").then(module => ({ default: module.TrendChart })));

export default function DashboardPage() {
  const { t, formatDate, formatNumber, formatUnit } = useI18n();
  const { data, isPending, isError, refetch } = usePatientDashboard();
  const { openMeasurement } = useDashboardActions();
  const [kind, setKind] = useState<"pressure" | "glucose">("pressure");
  if (isPending) return <Feedback kind="loading">{t("patient.dashboard.loading")}</Feedback>;
  if (isError) return <Feedback kind="error" action={<Button onClick={() => void refetch()}>{t("common.actions.retry")}</Button>}>{t("patient.dashboard.error")}</Feedback>;
  const completed = data.habits.filter(habit => progressToday(habit) >= habit.target).length;
  const dosesPercent = data.medication.total ? Math.round(data.medication.taken / data.medication.total * 100) : 0;
  const habitsPercent = data.habits.length ? Math.round(completed / data.habits.length * 100) : 0;
  const otherKind = kind === "pressure" ? "glucose" : "pressure";
  const hasOther = data.weekly.some(point => otherKind === "glucose" ? point.glucose !== undefined : point.systolic !== undefined);

  return <div className="command-center stack" data-i18n="declarative">
    <header className="command-heading flex flex-wrap items-center justify-between gap-4">
      <div className="command-welcome"><span className="eyebrow"><CalendarDays size={15} aria-hidden="true" />{formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</span><h1>{t("patient.dashboard.welcome", { name: `\u2068${data.patient.name}\u2069` })}</h1><p>{t("evolution.overview")}</p></div>
      <div className="command-actions flex flex-wrap items-center gap-3"><Link className="btn btn-secondary" to="/patient/reports"><FileChartColumn size={18} aria-hidden="true" />{t("reports.title")}</Link><Button className="add-reading" onClick={openMeasurement}><Plus size={18} aria-hidden="true" />{t("measurements.add")}</Button></div>
    </header>
    <section className="command-canvas health-canvas glass" data-kind={kind} aria-labelledby="health-canvas-heading">
      <SignatureArtwork /><LivingPulse cue={kind} />
      <div className="canvas-heading flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="dashboard-feature-icon"><Activity size={20} aria-hidden="true" /></span><div><h2 id="health-canvas-heading">{t("evolution.healthCanvas")}</h2><p>{t("patient.workspace.sevenDays")}</p></div></div><div className="segmented" role="group" aria-label={t("patient.overview.chartType")}><Button variant="ghost" aria-pressed={kind === "pressure"} onClick={() => setKind("pressure")}>{t("measurements.bloodPressure")}</Button><Button variant="ghost" aria-pressed={kind === "glucose"} onClick={() => setKind("glucose")}>{t("measurements.bloodGlucose")}</Button></div></div>
      <div className="command-canvas-grid">
        <aside className="canvas-latest" aria-labelledby="latest-heading"><div className="canvas-latest-heading"><h3 id="latest-heading">{t("evolution.latest")}</h3><Link to="/patient/measurements" aria-label={t("patient.workspace.records")}><ArrowUpRight size={20} aria-hidden="true" /></Link></div>
          <div className="canvas-readings">
            <HealthMetricCard label={t("measurements.bloodPressure")} value={data.bloodPressure ? `${formatNumber(data.bloodPressure.systolic)}/${formatNumber(data.bloodPressure.diastolic)}` : "—"} unit={formatUnit("mmHg")} icon={HeartPulse} tone="info" status={data.bloodPressure ? t(data.bloodPressure.isExample ? "patient.overview.example" : "patient.overview.recorded") : t("common.state.noData")} />
            <HealthMetricCard label={t("measurements.bloodGlucose")} value={data.glucose ? formatNumber(data.glucose.value) : "—"} unit={formatUnit("mg/dL")} icon={Droplet} tone="info" status={data.glucose ? t(data.glucose.isExample ? "patient.overview.example" : "patient.overview.recorded") : t("common.state.noData")} />
          </div>
          <p className="canvas-series-note">{t("patient.living.seriesNote")}</p>
          {hasOther && <div className="canvas-mini"><span>{t(otherKind === "glucose" ? "measurements.bloodGlucose" : "measurements.bloodPressure")} · {formatUnit(otherKind === "glucose" ? "mg/dL" : "mmHg")}</span><Suspense fallback={null}><TrendChart data={data.weekly} kind={otherKind} compact /></Suspense></div>}
        </aside>
        <div className="canvas-trend"><Suspense fallback={<div className="chart-loading" role="status">{t("patient.overview.weeklyLoading")}</div>}><TrendChart data={data.weekly} kind={kind} /></Suspense></div>
      </div>
      <footer className="canvas-footer flex flex-wrap items-center justify-between gap-3"><span><i aria-hidden="true" />{t("evolution.noChange")}</span><Link to="/patient/measurements">{t("patient.workspace.records")}<ArrowUpRight size={16} aria-hidden="true" /></Link></footer>
    </section>
    <section className="daily-workspace" aria-labelledby="daily-care-heading"><div className="daily-heading flex flex-wrap items-center justify-between gap-3"><div><h2 id="daily-care-heading">{t("evolution.dailyCare")}</h2><p>{t("patient.overview.tasks")}</p></div><span className="daily-progress-label">{t("habits.ui.completedSummary", { completed: formatNumber(completed), total: formatNumber(data.habits.length) })}</span></div>
      <div className="daily-care-grid">
        <section className="daily-medication" aria-labelledby="medication-heading"><div className="dashboard-panel-heading"><span className="dashboard-feature-icon"><Pill size={20} aria-hidden="true" /></span><h2 id="medication-heading">{t("common.navigation.medications")}</h2><Link to="/patient/medications" aria-label={t("common.navigation.medications")}><ArrowUpRight size={18} aria-hidden="true" /></Link></div><MedicationCard medication={data.medication} /><div className="care-progress"><span>{t("medications.dosesTaken")}</span><bdi>{formatNumber(data.medication.taken)}/{formatNumber(data.medication.total)}</bdi><progress value={dosesPercent} max={100} aria-label={t("patient.metric.progress", { label: t("common.navigation.medications") })} /></div></section>
        <section className="daily-habits" aria-labelledby="habits-heading"><div className="dashboard-panel-heading"><span className="dashboard-feature-icon"><Footprints size={20} aria-hidden="true" /></span><h2 id="habits-heading">{t("patient.workspace.routine")}</h2><Link to="/patient/habits" aria-label={t("common.navigation.habits")}><ArrowUpRight size={18} aria-hidden="true" /></Link></div><div>{data.habits.map(habit => <HabitCard key={habit.id} habit={habit} />)}{!data.habits.length && <p className="empty-state">{t("habits.empty")}</p>}</div><div className="care-progress"><span>{t("habits.ui.achievement")}</span><bdi>{formatNumber(completed)}/{formatNumber(data.habits.length)}</bdi><progress value={habitsPercent} max={100} aria-label={t("habits.ui.completedLabel")} /></div></section>
      </div>
    </section>
    <div className="command-support-grid"><Link className="command-report" to="/patient/reports"><FileChartColumn size={24} aria-hidden="true" /><span><strong>{t("reports.title")}</strong><small>{t("patient.clinical.reportBody")}</small></span><ArrowUpRight size={20} aria-hidden="true" /></Link><AssistantCard compact /></div>
    {data.reminder && <section className="command-reminder"><AlertCard notification={data.reminder} onAction={openMeasurement} /></section>}
    <p className="dashboard-disclosure"><Info size={16} aria-hidden="true" /><span>{t("measurements.persistence.dashboardNotice")}</span></p>
  </div>;
}

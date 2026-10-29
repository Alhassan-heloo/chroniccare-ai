import { lazy, Suspense } from "react";
import { HeartPulse, Droplet, Pill, Footprints, Plus, CalendarDays, ArrowUpRight, FileChartColumn, Info } from "lucide-react";
import { Link } from "react-router";
import { usePatientDashboard } from "@/hooks/queries/usePatientDashboard";
import { useDashboardActions } from "@/context/DashboardContext";
import { HealthMetricCard } from "@/components/health/HealthMetricCard";
import { MedicationCard } from "@/components/health/MedicationCard";
import { HabitCard } from "@/components/health/HabitCard";
import { AlertCard } from "@/components/health/AlertCard";
import { AssistantCard } from "@/components/health/AssistantCard";
import { SignatureArtwork } from "@/components/public/living/ui";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Feedback } from "@/components/ui/Feedback";
import { useI18n } from "@/i18n/context";

const WeeklySummary = lazy(() => import("@/components/health/WeeklySummary").then(module => ({ default: module.WeeklySummary })));

export default function DashboardPage() {
  const { t, formatDate, formatNumber, formatUnit } = useI18n();
  const { data, isPending, isError, refetch } = usePatientDashboard();
  const { openMeasurement } = useDashboardActions();
  if (isPending) return <div data-i18n="declarative"><Feedback kind="loading">{t("patient.dashboard.loading")}</Feedback></div>;
  if (isError) return <div data-i18n="declarative"><Feedback kind="error" action={<Button onClick={() => void refetch()}>{t("common.actions.retry")}</Button>}>{t("patient.dashboard.error")}</Feedback></div>;
  const steps = data.habits.filter(h => h.unit === "steps").reduce((sum, h) => sum + h.progress, 0);
  const stepGoal = data.habits.filter(h => h.unit === "steps").reduce((sum, h) => sum + h.target, 0);
  const dosesPercent = data.medication.total ? Math.round(data.medication.taken / data.medication.total * 100) : 0;
  const stepsPercent = stepGoal ? Math.min(100, Math.round(steps / stepGoal * 100)) : 0;

  // Latest readings remain distinct from the chart's existing daily averages.
  const readouts = <section className="dashboard-readouts" aria-labelledby="readings-heading" data-i18n="declarative">
    <div className="dashboard-readouts-heading"><h3 id="readings-heading">{t("patient.clinical.latest")}</h3><Link to="/patient/measurements">{t("patient.workspace.records")}<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    <div className="dashboard-metrics">
      <HealthMetricCard label={t("measurements.bloodPressure")} value={data.bloodPressure ? `${formatNumber(data.bloodPressure.systolic)}/${formatNumber(data.bloodPressure.diastolic)}` : "—"} unit={data.bloodPressure ? formatUnit("mmHg") : t("patient.overview.noReading")} icon={HeartPulse} tone="info" status={data.bloodPressure ? t(data.bloodPressure.isExample ? "patient.overview.example" : "patient.overview.recorded") : t("common.state.noData")} />
      <HealthMetricCard label={t("measurements.bloodGlucose")} value={data.glucose ? formatNumber(data.glucose.value) : "—"} unit={data.glucose ? formatUnit("mg/dL") : t("patient.overview.noReading")} icon={Droplet} tone="info" status={data.glucose ? t(data.glucose.isExample ? "patient.overview.example" : "patient.overview.recorded") : t("common.state.noData")} />
    </div>
    <p className="dashboard-series-note">{t("patient.living.seriesNote")}</p>
  </section>;

  return <div className="dashboard-content living-dashboard-content">
    <div className="dashboard-welcome">
      <SignatureArtwork />
      <div data-i18n="declarative"><span className="eyebrow">{t("common.layout.space")}</span><h1>{t("patient.dashboard.welcome", { name: `\u2068${data.patient.name}\u2069` })}</h1><p>{t("patient.living.welcomeBody")}</p></div>
      <div className="dashboard-date" data-i18n="declarative"><strong>{t("patient.clinical.today")}</strong><span><CalendarDays size={16} aria-hidden="true" />{formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</span></div>
    </div>
    <div className="dashboard-canvas-actions" data-i18n="declarative"><span className="eyebrow"><i aria-hidden="true" />{t("patient.workspace.sevenDays")}</span><Button className="add-reading" onClick={openMeasurement}><Plus size={19} aria-hidden="true" />{t("measurements.add")}</Button></div>
    <div className="dashboard-living-grid">
      <div className="dashboard-primary">
        <Suspense fallback={<Card className="dashboard-canvas-loading glass">{readouts}<p data-i18n="declarative" role="status">{t("patient.overview.weeklyLoading")}</p></Card>}><WeeklySummary data={data.weekly} readouts={readouts} /></Suspense>
      </div>
      <aside className="dashboard-routine" aria-labelledby="today-heading">
        <h2 id="today-heading" className="sr-only" data-i18n="declarative">{t("patient.overview.tasks")}</h2>
        <section className="dashboard-medication glass" aria-labelledby="medication-heading">
          <div className="dashboard-panel-heading" data-i18n="declarative"><span className="dashboard-feature-icon"><Pill size={20} aria-hidden="true" /></span><h2 id="medication-heading">{t("public.living.medication")}</h2></div>
          <MedicationCard medication={data.medication} />
          <div className="dashboard-routine-progress" data-i18n="declarative"><span>{t("medications.dosesTaken")}</span><strong dir="ltr">{`${formatNumber(data.medication.taken)}/${formatNumber(data.medication.total)}`}</strong><progress value={dosesPercent} max={100} aria-label={t("patient.metric.progress", { label: t("common.navigation.medications") })} /></div>
        </section>
        <section className="dashboard-habits glass" aria-labelledby="habits-heading">
          <div className="dashboard-panel-heading" data-i18n="declarative"><span className="dashboard-feature-icon"><Footprints size={20} aria-hidden="true" /></span><h2 id="habits-heading">{t("patient.workspace.routine")}</h2></div>
          {data.habits.map(habit => <HabitCard key={habit.id} habit={habit} />)}
          {!data.habits.length && <p className="dashboard-empty" data-i18n="declarative">{t("habits.empty")}</p>}
          <div className="dashboard-routine-progress" data-i18n="declarative"><span>{t("patient.overview.activity")}</span><strong>{formatNumber(steps)}</strong><small>{t("patient.overview.steps", { goal: formatNumber(stepGoal) })}</small><progress value={stepsPercent} max={100} aria-label={t("patient.metric.progress", { label: t("patient.overview.activity") })} /></div>
        </section>
        <section className="dashboard-reminder glass" aria-label={t("common.layout.notifications")}><AlertCard notification={data.reminder} onAction={openMeasurement} /></section>
      </aside>
      <div className="dashboard-support">
        <Link className="dashboard-report glass" to="/patient/reports" data-i18n="declarative"><span className="dashboard-feature-icon"><FileChartColumn size={22} aria-hidden="true" /></span><span><strong>{t("reports.title")}</strong><span>{t("patient.clinical.reportBody")}</span></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
        <AssistantCard compact />
      </div>
    </div>
    <p className="dashboard-disclosure" data-i18n="declarative"><Info size={18} aria-hidden="true" /><span>{t("patient.living.disclosure")}</span></p>
  </div>;
}

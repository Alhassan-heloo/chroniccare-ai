import { lazy, Suspense } from "react";
import { HeartPulse, Droplet, Pill, Footprints, Plus, CalendarDays, ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { usePatientDashboard } from "@/hooks/queries/usePatientDashboard";
import { useDashboardActions } from "@/context/DashboardContext";
import { HealthMetricCard } from "@/components/health/HealthMetricCard";
import { MedicationCard } from "@/components/health/MedicationCard";
import { HabitCard } from "@/components/health/HabitCard";
import { AlertCard } from "@/components/health/AlertCard";
import { AssistantCard } from "@/components/health/AssistantCard";
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
  return <div className="dashboard-content clinical-dashboard">
    <div className="clinical-day-heading"><div className="clinical-day-label" data-i18n="declarative"><span className="clinical-kicker">{t("patient.clinical.today")}</span><span className="date-label"><CalendarDays size={16} aria-hidden="true" />{formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</span></div><div className="welcome"><div><h1 data-i18n="declarative">{t("patient.dashboard.welcome", { name: `\u2068${data.patient.name}\u2069` })}</h1><p data-i18n="declarative">{t("patient.clinical.subtitle")}</p></div><Button className="add-reading" onClick={openMeasurement} data-i18n="declarative"><Plus size={20} aria-hidden="true" />{t("measurements.add")}</Button></div></div>
    <div className="clinical-day-grid">
      <section className="clinical-today" aria-labelledby="today-heading">
        <div className="clinical-panel-heading" data-i18n="declarative"><div><span className="clinical-kicker">{t("patient.overview.tasks")}</span><h2 id="today-heading">{t("patient.clinical.plan")}</h2><p>{t("patient.clinical.planBody")}</p></div><span className="clinical-section-number" aria-hidden="true">{formatNumber(1, { minimumIntegerDigits: 2 })}</span></div>
        <div className="clinical-routine-overview" data-i18n="declarative" aria-label={t("patient.clinical.progress")}>
          <div><span><Pill size={17} aria-hidden="true" />{t("medications.dosesTaken")}</span><strong dir="ltr">{`${formatNumber(data.medication.taken)}/${formatNumber(data.medication.total)}`}</strong><progress value={dosesPercent} max={100} aria-label={t("patient.metric.progress", { label: t("common.navigation.medications") })} /></div>
          <div><span><Footprints size={17} aria-hidden="true" />{t("patient.overview.activity")}</span><strong>{formatNumber(steps)}</strong><small>{t("patient.overview.steps", { goal: formatNumber(stepGoal) })}</small><progress value={stepsPercent} max={100} aria-label={t("patient.metric.progress", { label: t("patient.overview.activity") })} /></div>
        </div>
        <div className="clinical-task-list"><MedicationCard medication={data.medication} /><AlertCard notification={data.reminder} onAction={openMeasurement} />{data.habits.map(habit => <HabitCard key={habit.id} habit={habit} />)}</div>
      </section>
      <section className="clinical-readings" aria-labelledby="readings-heading" data-i18n="declarative">
        <div className="clinical-panel-heading"><div><span className="clinical-kicker">{t("patient.clinical.record")}</span><h2 id="readings-heading">{t("patient.clinical.latest")}</h2><p>{t("patient.workspace.vitalsCaption")}</p></div><span className="clinical-section-number" aria-hidden="true">{formatNumber(2, { minimumIntegerDigits: 2 })}</span></div>
        <div className="clinical-reading-list">
          <HealthMetricCard label={t("measurements.bloodPressure")} value={data.bloodPressure ? `${formatNumber(data.bloodPressure.systolic)}/${formatNumber(data.bloodPressure.diastolic)}` : "—"} unit={data.bloodPressure ? formatUnit("mmHg") : t("patient.overview.noReading")} icon={HeartPulse} tone="info" status={data.bloodPressure ? t(data.bloodPressure.isExample ? "patient.overview.example" : "patient.overview.recorded") : t("common.state.noData")} />
          <HealthMetricCard label={t("measurements.bloodGlucose")} value={data.glucose ? formatNumber(data.glucose.value) : "—"} unit={data.glucose ? formatUnit("mg/dL") : t("patient.overview.noReading")} icon={Droplet} tone="info" status={data.glucose ? t(data.glucose.isExample ? "patient.overview.example" : "patient.overview.recorded") : t("common.state.noData")} />
        </div>
        <Link className="clinical-record-link" to="/patient/measurements">{t("patient.workspace.records")}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        <p className="clinical-readings-note">{t("patient.overview.demo")}</p>
      </section>
    </div>
    <section className="clinical-history" aria-labelledby="review-heading">
      <div className="clinical-review-heading" data-i18n="declarative"><span className="clinical-section-number" aria-hidden="true">{formatNumber(3, { minimumIntegerDigits: 2 })}</span><div><h2 id="review-heading">{t("patient.clinical.review")}</h2><p>{t("patient.clinical.reviewBody")}</p></div></div>
      <div className="clinical-review-grid"><Suspense fallback={<Card className="empty-state" data-i18n="declarative">{t("patient.overview.weeklyLoading")}</Card>}><WeeklySummary data={data.weekly} /></Suspense><aside className="clinical-support"><Link className="clinical-report-link" to="/patient/reports" data-i18n="declarative"><ChartReportIcon /><span className="clinical-kicker">{t("patient.workspace.sevenDays")}</span><strong>{t("reports.title")}<ArrowUpRight size={18} aria-hidden="true" /></strong><p>{t("patient.clinical.reportBody")}</p></Link><AssistantCard /></aside></div>
    </section>
    <p className="demo-note" data-i18n="declarative">{t("patient.overview.demo")}</p>
  </div>;
}

function ChartReportIcon() {
  return <span className="clinical-report-icon" aria-hidden="true"><CalendarDays size={25} /></span>;
}

import { lazy, Suspense, useState } from "react";
import { HeartPulse, Droplet, Pill, Footprints, Plus, ArrowUpRight, FileChartColumn, Info, Activity } from "lucide-react";
import { Link } from "react-router";
import { usePatientDashboard } from "@/hooks/queries/usePatientDashboard";
import { useDashboardActions } from "@/context/DashboardContext";
import { HealthMetricCard } from "@/components/health/HealthMetricCard";
import { PatientPageHeader } from "@/components/layout/PatientPageHeader";
import { recordPressurePath } from "@/components/layout/navigation";
import { MedicationCard } from "@/components/health/MedicationCard";
import { AlertCard } from "@/components/health/AlertCard";
import { AssistantCard } from "@/components/health/AssistantCard";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { useI18n } from "@/i18n/context";
import { progressToday } from "@/lib/utils/habits";
import { PatientWeek,PatientShortcuts } from "@/components/health/PatientWeek";
import cuff from "../../../homepage-hybrid/cuff.jpg";
import {useSavedReading} from "@/hooks/useSavedReading";

const TrendChart = lazy(() => import("@/components/charts/TrendChart").then(module => ({ default: module.TrendChart })));

export default function DashboardPage() {
  const { t, formatNumber, formatUnit, formatHabitUnit } = useI18n();
  const { data, isPending, isError, refetch } = usePatientDashboard();
  const { openMeasurement } = useDashboardActions();
  const [kind, setKind] = useState<"pressure" | "glucose">("pressure");
  const savedId=useSavedReading();
  if (isPending) return <Feedback kind="loading">{t("patient.dashboard.loading")}</Feedback>;
  if (isError) return <Feedback kind="error" action={<Button onClick={() => void refetch()}>{t("common.actions.retry")}</Button>}>{t("patient.dashboard.error")}</Feedback>;
  const completed = data.habits.filter(habit => progressToday(habit) >= habit.target).length;
  const { bloodPressure, glucose } = data;

  return <div className="command-center stack" data-i18n="declarative">
    <PatientPageHeader
      className="command-welcome"
      title={t("patient.dashboard.welcome", { name: `\u2068${data.patient.name}\u2069` })}
      description={<><span>{t("finalExperience.overview")}</span><img className="patient-welcome-image" src={cuff} alt="" width="128" height="88" decoding="async" /></>}
      action={
        <Link className="btn btn-primary patient-record-action dashboard-record-pressure" to={recordPressurePath}>
          <Plus size={18} aria-hidden="true" />{t(data.readings.length?"measurements.dayLog.recordPressure":"graduation.firstReading")}
        </Link>
      }
    />
    <div className="patient-at-a-glance">
    <section className="canvas-latest" aria-labelledby="latest-heading">
      <div className="canvas-latest-heading">
        <h2 id="latest-heading">{t("evolution.latest")}</h2>
        <Link className="dashboard-measurement-history" to="/patient/measurements">
          {t("patient.workspace.records")}<ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {!data.readings.length && <div className="first-reading-prompt"><HeartPulse size={36} aria-hidden="true" /><Link className="btn btn-secondary" to={recordPressurePath}>{t("graduation.firstReading")}</Link></div>}
      <div className="canvas-readings patient-reading-surface">
        <HealthMetricCard
          saved={data.readings.find(item=>item.kind==="bloodPressure")?.id===savedId}
          label={t("measurements.bloodPressure")}
          value={bloodPressure ? `${formatNumber(bloodPressure.systolic)}/${formatNumber(bloodPressure.diastolic)}` : "—"}
          unit={bloodPressure ? t("measurements.dayLog.pressureUnit") : ""}
          recordedAt={bloodPressure?.recordedAt}
          icon={HeartPulse}
          tone="info"
          status={!bloodPressure ? t("patient.overview.noReading") : bloodPressure.isExample ? t("patient.overview.example") : undefined}
        />
        <HealthMetricCard
          saved={data.readings.find(item=>item.kind==="glucose")?.id===savedId}
          label={t("measurements.bloodGlucose")}
          value={glucose ? formatNumber(glucose.value) : "—"}
          unit={glucose ? formatUnit("mg/dL") : ""}
          recordedAt={glucose?.recordedAt}
          icon={Droplet}
          tone="info"
          status={!glucose ? t("patient.overview.noReading") : glucose.isExample ? t("patient.overview.example") : undefined}
        />
      </div>
    </section>

    <section className="today-summary" aria-labelledby="daily-care-heading">
      <h2 id="daily-care-heading">{t("finalExperience.today")}</h2>
      <div className="today-medication"><div className="today-section-heading"><Pill size={19} aria-hidden="true" /><Link to="/patient/medications">{t("common.navigation.medications")}<ArrowUpRight size={16} aria-hidden="true" /></Link><bdi>{formatNumber(data.medication.taken)}/{formatNumber(data.medication.total)}</bdi></div><MedicationCard medication={data.medication} /></div>
      <div className="today-habits"><div className="today-section-heading"><Footprints size={19} aria-hidden="true" /><Link to="/patient/habits">{t("finalExperience.habits")}<ArrowUpRight size={16} aria-hidden="true" /></Link><bdi>{formatNumber(completed)}/{formatNumber(data.habits.length)}</bdi></div>
      {data.habits.length ? <ul>{data.habits.slice(0,3).map(habit => <li key={habit.id}><bdi>{habit.title}</bdi><span>{t("habits.ui.progress", { value: formatNumber(progressToday(habit)), target: formatNumber(habit.target), unit: formatHabitUnit(habit.unit,habit.target) })}</span><progress value={Math.min(progressToday(habit),habit.target)} max={habit.target} aria-label={habit.title} /></li>)}</ul> : <Link className="today-empty" to="/patient/habits">{t("finalExperience.noHabits")}</Link>}
      </div>
    </section>
    </div>
    <PatientWeek readings={data.readings} />
    <section className="command-canvas health-canvas" data-kind={kind} aria-labelledby="health-canvas-heading">
      <div className="canvas-heading flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="dashboard-feature-icon"><Activity size={20} aria-hidden="true" /></span><div><h2 id="health-canvas-heading">{t("evolution.healthCanvas")}</h2><p>{t("patient.workspace.sevenDays")}</p></div></div><div className="segmented" role="group" aria-label={t("patient.overview.chartType")}><Button variant="ghost" aria-pressed={kind === "pressure"} onClick={() => setKind("pressure")}>{t("measurements.bloodPressure")}</Button><Button variant="ghost" aria-pressed={kind === "glucose"} onClick={() => setKind("glucose")}>{t("measurements.bloodGlucose")}</Button></div></div>
      <div className="command-canvas-grid">
        <div className="canvas-trend"><Suspense fallback={<div className="chart-loading" role="status">{t("patient.overview.weeklyLoading")}</div>}><TrendChart data={data.weekly} kind={kind} /></Suspense></div>
      </div>
      <footer className="canvas-footer flex flex-wrap items-center justify-between gap-3">
        <p className="canvas-series-note">{t("patient.living.seriesNote")}</p>
        <Link to="/patient/reports"><FileChartColumn size={18} aria-hidden="true" />{t("reports.title")}</Link>
      </footer>
    </section>
    <PatientShortcuts />
    <div className="command-support-grid"><Link className="command-report" to="/patient/reports"><FileChartColumn size={24} aria-hidden="true" /><span><strong>{t("reports.title")}</strong><small>{t("patient.clinical.reportBody")}</small></span><ArrowUpRight size={20} aria-hidden="true" /></Link><AssistantCard compact /></div>
    {data.reminder && <section className="command-reminder"><AlertCard notification={data.reminder} onAction={openMeasurement} /></section>}
    <p className="dashboard-disclosure"><Info size={16} aria-hidden="true" /><span>{t("measurements.persistence.dashboardNotice")}</span></p>
  </div>;
}

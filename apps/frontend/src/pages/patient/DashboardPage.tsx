import { lazy, Suspense } from "react";
import {
  HeartPulse,
  Droplet,
  Pill,
  Footprints,
  Plus,
  CalendarDays,
} from "lucide-react";
import { usePatientDashboard } from "@/hooks/queries/usePatientDashboard";
import { useDashboardActions } from "@/context/DashboardContext";
import { HealthMetricCard } from "@/components/health/HealthMetricCard";
import { MedicationCard } from "@/components/health/MedicationCard";
import { HabitCard } from "@/components/health/HabitCard";
import { AlertCard } from "@/components/health/AlertCard";
import { AssistantCard } from "@/components/health/AssistantCard";
const WeeklySummary = lazy(() =>
  import("@/components/health/WeeklySummary").then((module) => ({
    default: module.WeeklySummary,
  })),
);
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useI18n } from "@/i18n/context";
export default function DashboardPage() {
  const { t, formatDate, formatNumber, formatUnit } = useI18n();
  const { data, isPending, isError, refetch } = usePatientDashboard();
  const { openMeasurement } = useDashboardActions();
  if (isPending) return <p role="status" data-i18n="declarative">{t("patient.dashboard.loading")}</p>;
  if (isError)
    return (
      <div role="alert" data-i18n="declarative">
        {t("patient.dashboard.error")}{" "}
        <Button onClick={() => void refetch()}>{t("common.actions.retry")}</Button>
      </div>
    );
  const steps = data.habits
    .filter((h) => h.unit === "steps")
    .reduce((sum, h) => sum + h.progress, 0);
  const stepGoal = data.habits
    .filter((h) => h.unit === "steps")
    .reduce((sum, h) => sum + h.target, 0);
  return (
    <div className="dashboard-content">
      <div className="welcome">
        <div>
          <span className="eyebrow" data-i18n="declarative">{t("patient.overview.eyebrow")}</span>
          <h1>
            <span data-i18n="declarative">{t("patient.dashboard.welcome", { name: data.patient.name })}</span> <span className="wave">☀</span>
          </h1>
          <p data-i18n="declarative">{t("patient.dashboard.summary")}</p>
        </div>
        <div className="date-label">
          <CalendarDays size={18} />
          {formatDate(new Date(), {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
      </div>
      <section className="metrics-grid" aria-label={t("patient.overview.metrics")} data-i18n="declarative">
        <HealthMetricCard
          label={t("measurements.bloodPressure")}
          value={
            data.bloodPressure
              ? `${formatNumber(data.bloodPressure.systolic)}/${formatNumber(data.bloodPressure.diastolic)}`
              : "—"
          }
          unit={data.bloodPressure ? formatUnit("mmHg") : t("patient.overview.noReading")}
          icon={HeartPulse}
          tone="danger"
          status={
            data.bloodPressure
              ? data.bloodPressure.isExample
                ? t("patient.overview.example")
                : t("patient.overview.recorded")
              : t("common.state.noData")
          }
        />
        <HealthMetricCard
          label={t("measurements.bloodGlucose")}
          value={data.glucose ? formatNumber(data.glucose.value) : "—"}
          unit={data.glucose ? formatUnit("mg/dL") : t("patient.overview.noReading")}
          icon={Droplet}
          tone="info"
          status={
            data.glucose
              ? data.glucose.isExample
                ? t("patient.overview.example")
                : t("patient.overview.recorded")
              : t("common.state.noData")
          }
        />
        <HealthMetricCard
          label={t("common.navigation.medications")}
          value={`${formatNumber(data.medication.taken)}/${formatNumber(data.medication.total)}`}
          unit={t("medications.dosesTaken")}
          icon={Pill}
          tone="warning"
          progress={
            data.medication.total
              ? Math.round(
                  (data.medication.taken / data.medication.total) * 100,
                )
              : 0
          }
        />
        <HealthMetricCard
          label={t("patient.overview.activity")}
          value={formatNumber(steps)}
          unit={t("patient.overview.steps", { goal: formatNumber(stepGoal) })}
          icon={Footprints}
          tone="success"
          progress={
            stepGoal ? Math.min(100, Math.round((steps / stepGoal) * 100)) : 0
          }
        />
      </section>
      <Button className="add-reading" onClick={openMeasurement} data-i18n="declarative">
        <Plus size={24} /> {t("measurements.add")}
      </Button>
      <div className="daily-grid">
        <Card className="tasks-section">
          <div className="section-heading" data-i18n="declarative">
            <div>
              <h2>{t("patient.overview.tasks")}</h2>
              <p>{t("patient.overview.routine")}</p>
            </div>
            <span className="count-label">{t("patient.overview.today")}</span>
          </div>
          <MedicationCard medication={data.medication} />
          <AlertCard notification={data.reminder} onAction={openMeasurement} />
          {data.habits.map((habit) => (
            <HabitCard key={habit.id} habit={habit} />
          ))}
        </Card>
        <AssistantCard />
      </div>
      <Suspense
        fallback={
          <Card className="empty-state" data-i18n="declarative">{t("patient.overview.weeklyLoading")}</Card>
        }
      >
        <WeeklySummary data={data.weekly} />
      </Suspense>
      <p className="demo-note" data-i18n="declarative">
        {t("patient.overview.demo")}
      </p>
    </div>
  );
}

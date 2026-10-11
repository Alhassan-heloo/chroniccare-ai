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
  const { locale, formatNumber } = useI18n();
  const { data, isPending, isError, refetch } = usePatientDashboard();
  const { openMeasurement } = useDashboardActions();
  if (isPending) return <p role="status">جارٍ تحميل ملخص صحتك…</p>;
  if (isError)
    return (
      <div role="alert">
        تعذر تحميل البيانات{" "}
        <Button onClick={() => void refetch()}>إعادة المحاولة</Button>
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
          <span className="eyebrow">كل يوم، خطوة لصحة أفضل</span>
          <h1>
            مرحبًا {data.patient.name} <span className="wave">☀</span>
          </h1>
          <p>هذا ملخص صحتك اليوم</p>
        </div>
        <div className="date-label">
          <CalendarDays size={18} />
          {new Intl.DateTimeFormat(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(new Date())}
        </div>
      </div>
      <section className="metrics-grid" aria-label="ملخص القياسات اليومية">
        <HealthMetricCard
          label="ضغط الدم"
          value={
            data.bloodPressure
              ? `${data.bloodPressure.systolic}/${data.bloodPressure.diastolic}`
              : "—"
          }
          unit={data.bloodPressure ? "mmHg" : "لا توجد قراءة مسجلة"}
          icon={HeartPulse}
          tone="danger"
          status={
            data.bloodPressure
              ? data.bloodPressure.isExample
                ? "بيانات مثال"
                : "قراءة مسجلة"
              : "لا توجد بيانات"
          }
        />
        <HealthMetricCard
          label="سكر الدم"
          value={data.glucose ? String(data.glucose.value) : "—"}
          unit={data.glucose ? "mg/dL" : "لا توجد قراءة مسجلة"}
          icon={Droplet}
          tone="info"
          status={
            data.glucose
              ? data.glucose.isExample
                ? "بيانات مثال"
                : "قراءة مسجلة"
              : "لا توجد بيانات"
          }
        />
        <HealthMetricCard
          label="الأدوية"
          value={`${data.medication.taken}/${data.medication.total}`}
          unit="جرعات تم تناولها"
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
          label="النشاط"
          value={formatNumber(steps)}
          unit={`خطوة من ${formatNumber(stepGoal)}`}
          icon={Footprints}
          tone="success"
          progress={
            stepGoal ? Math.min(100, Math.round((steps / stepGoal) * 100)) : 0
          }
        />
      </section>
      <Button className="add-reading" onClick={openMeasurement}>
        <Plus size={24} /> إضافة قراءة جديدة
      </Button>
      <div className="daily-grid">
        <Card className="tasks-section">
          <div className="section-heading">
            <div>
              <h2>ماذا علي أن أفعل اليوم؟</h2>
              <p>روتين بسيط يصنع فرقًا</p>
            </div>
            <span className="count-label">مهام اليوم</span>
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
          <Card className="empty-state">جارٍ تحميل الملخص الأسبوعي…</Card>
        }
      >
        <WeeklySummary data={data.weekly} />
      </Suspense>
      <p className="demo-note">
        هذه نسخة تجريبية ببيانات توضيحية مميزة بوسم «بيانات مثال». لا تخضع
        القراءات لتقييم طبي.
      </p>
    </div>
  );
}

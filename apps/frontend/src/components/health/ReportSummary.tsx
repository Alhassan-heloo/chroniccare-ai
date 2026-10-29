import { Card } from "@/components/ui/Card";
import type { PatientReport } from "@/lib/types/report";
import { useI18n } from "@/i18n/context";
import { HeartPulse, Droplet, Pill, Footprints } from "lucide-react";
export function ReportSummary({ data }: { data: PatientReport }) {
  const { t, formatNumber, formatUnit } = useI18n();
  const numberOrDash = (value: number | null) => value === null ? "—" : formatNumber(value);
  return (
    <section className="report-summary" aria-label={t("ملخص التقرير")} data-i18n="declarative">
      <Card className="report-stat report-period-stat glass" data-kind="pressure">
        <div className="report-stat-heading"><span className="dashboard-feature-icon" aria-hidden="true"><HeartPulse size={20} /></span><h2>{t("متوسط ضغط الدم")}</h2></div>
        <strong>
          <bdi dir="ltr">
            {data.pressure.count
              ? `${numberOrDash(data.pressure.systolic)}/${numberOrDash(data.pressure.diastolic)}`
              : "—"}
          </bdi>
        </strong>
        <p><bdi>{formatUnit("mmHg")}</bdi> · {t("reports.count", { count: formatNumber(data.pressure.count) })}</p>
      </Card>
      <Card className="report-stat report-period-stat glass" data-kind="glucose">
        <div className="report-stat-heading"><span className="dashboard-feature-icon" aria-hidden="true"><Droplet size={20} /></span><h2>{t("متوسط سكر الدم")}</h2></div>
        <strong>
          <bdi>{numberOrDash(data.glucose.average)}</bdi>
        </strong>
        <p><bdi>{formatUnit("mg/dL")}</bdi> · {t("reports.count", { count: formatNumber(data.glucose.count) })}</p>
      </Card>
      <Card className="report-stat report-today-stat glass" data-kind="medication">
        <div className="report-stat-heading"><span className="dashboard-feature-icon" aria-hidden="true"><Pill size={20} /></span><h2>{t("جرعات اليوم")}</h2></div>
        <strong>
          <bdi dir="ltr">
            {formatNumber(data.medicationToday.taken)}/{formatNumber(data.medicationToday.total)}
          </bdi>
        </strong>
        <p>{t("جرعات تم تسجيل تناولها اليوم فقط")}</p>
      </Card>
      <Card className="report-stat report-today-stat glass" data-kind="habits">
        <div className="report-stat-heading"><span className="dashboard-feature-icon" aria-hidden="true"><Footprints size={20} /></span><h2>{t("عادات اليوم")}</h2></div>
        <strong>
          <bdi dir="ltr">
            {formatNumber(data.habitsToday.completed)}/{formatNumber(data.habitsToday.total)}
          </bdi>
        </strong>
        <p>{t("عادات حققت هدف اليوم فقط")}</p>
      </Card>
    </section>
  );
}

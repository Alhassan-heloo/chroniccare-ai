import { lazy, Suspense, useState } from "react";
import { HeartPulse, Droplet, FileChartColumn, Info, CalendarDays } from "lucide-react";
import { usePatientReport } from "@/hooks/queries/usePatientReport";
import type { ReportPeriod } from "@/lib/types/report";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ReportSummary } from "@/components/health/ReportSummary";
import { useI18n } from "@/i18n/context";
import { SignatureArtwork, LivingPulse } from "@/components/public/living/ui";
import {
  measurementLabel,
  measurementValue,
} from "@/lib/utils/measurementFilters";
const ReportChart = lazy(() => import("@/components/charts/ReportChart"));
const periods: { value: ReportPeriod; label: string }[] = [
  { value: 7, label: "أسبوع" },
  { value: 30, label: "شهر" },
  { value: 90, label: "3 أشهر" },
];
export default function ReportsPage() {
  const { locale, t, formatNumber } = useI18n();
  const [period, setPeriod] = useState<ReportPeriod>(7);
  const { data, isPending, isError, refetch } = usePatientReport(period);
  return (
    <div className="stack reports-page" data-i18n="declarative">
      <div className="reports-heading dashboard-welcome">
        <SignatureArtwork />
        <div>
          <span className="eyebrow">{t("متابعتك، بصورة أوضح")}</span>
          <h1>{t("reports.title")}</h1>
          <p>{t("ملخص وصفي للقراءات المسجلة خلال الفترة المختارة.")}</p>
        </div>
      </div>
      <div className="reports-toolbar dashboard-canvas-actions">
        <p className="report-range" role="status"><CalendarDays size={17} aria-hidden="true" /><span>{data && t("reports.range", { from: `\u2068${data.from}\u2069`, to: `\u2068${data.to}\u2069`, count: formatNumber(data.measurements.length) })}</span></p>
        <div className="report-periods segmented" role="group" aria-label={t("reports.period")}>
          {periods.map((item) => (
            <Button
              key={item.value}
              variant={period === item.value ? "primary" : "secondary"}
              aria-pressed={period === item.value}
              onClick={() => setPeriod(item.value)}
            >
              {t(item.label)}
            </Button>
          ))}
        </div>
      </div>
      {isPending ? (
        <Card className="empty-state glass" role="status">
          {t("جارٍ تحميل التقرير…")}
        </Card>
      ) : isError || !data ? (
        <Card className="empty-state glass" role="alert">
          <p>{t("تعذر تحميل التقرير.")}</p>
          <Button onClick={() => void refetch()}>{t("common.actions.retry")}</Button>
        </Card>
      ) : (
        <>
          <div className="report-workbench"><ReportSummary data={data} /><div className="report-body">
          <p className="report-today-note">
            <Info size={17} aria-hidden="true" /><span>{t("الأدوية والعادات تعرضان حالة اليوم فقط من البيانات التجريبية الحالية؛ لا يتوفر سجل تاريخي لحساب الالتزام خلال الفترة.")}</span>
          </p>
          <div className="report-charts">
            {(["pressure", "glucose"] as const).map((kind) => (
              <Card key={kind} className="report-chart-panel health-canvas glass" data-kind={kind}>
                <LivingPulse cue={`${period}:${kind}`} />
                <div className="dashboard-panel-heading"><span className="dashboard-feature-icon" aria-hidden="true">{kind === "pressure" ? <HeartPulse size={20} /> : <Droplet size={20} />}</span><div>
                  <h2>{t(kind === "pressure" ? "اتجاه ضغط الدم" : "اتجاه سكر الدم")}</h2>
                  <p>{t("متوسط القراءات لكل يوم مسجل، دون ملء الأيام المفقودة.")}</p>
                </div></div>
                {(
                  kind === "pressure" ? data.pressure.count : data.glucose.count
                ) ? (
                  <Suspense fallback={<p role="status">{t("reports.loadingChart")}</p>}>
                    <ReportChart points={data.points} kind={kind} />
                  </Suspense>
                ) : (
                  <p className="empty-state">
                    {t("لا توجد قراءات من هذا النوع خلال الفترة.")}
                  </p>
                )}
              </Card>
            ))}
          </div>
          <Card className="report-readings glass">
            <div className="dashboard-panel-heading"><span className="dashboard-feature-icon" aria-hidden="true"><FileChartColumn size={20} /></span><h2>{t("أحدث القياسات خلال الفترة")}</h2></div>
            {data.measurements.length ? (
              <ul>
                {data.measurements.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <div className="report-reading-copy"><span>{t(measurementLabel(item))}</span>
                    {item.isExample && <small>{t("measurements.ui.example")}</small>}</div>
                    <strong>
                      <bdi>{measurementValue(item)}</bdi>{" "}
                      <small>
                        {item.kind === "bloodPressure" ? "mmHg" : "mg/dL"}
                      </small>
                    </strong>
                    <time dateTime={item.recordedAt}>
                      {new Date(item.recordedAt).toLocaleString(locale)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">
                {t("لا توجد قياسات مسجلة خلال الفترة. أضف قراءة من صفحة صحتي لتظهر هنا.")}
              </p>
            )}
          </Card>
          </div></div>
        </>
      )}
      <p className="dashboard-disclosure"><Info size={18} aria-hidden="true" /><span>{t("أمثلة تجريبية لآخر 7 أيام، وليست قراءات مريض حقيقية. البيانات مؤقتة.")}{" "}{t("reports.window", { days: formatNumber(period) })}{" "}{t("reports.assessmentNotice")}</span></p>
    </div>
  );
}

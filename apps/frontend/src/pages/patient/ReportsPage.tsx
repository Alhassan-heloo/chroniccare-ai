import { lazy, Suspense, useState } from "react";
import { usePatientReport } from "@/hooks/queries/usePatientReport";
import type { ReportPeriod } from "@/lib/types/report";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ReportSummary } from "@/components/health/ReportSummary";
import { useI18n } from "@/i18n/context";
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
    <div className="stack reports-page">
      <div className="section-heading measurements-heading">
        <div>
          <span className="eyebrow">متابعتك، بصورة أوضح</span>
          <h1>تقاريري</h1>
          <p>ملخص وصفي للقراءات المسجلة خلال الفترة المختارة.</p>
        </div>
        <div className="report-periods" role="group" aria-label="فترة التقرير">
          {periods.map((item) => (
            <Button
              key={item.value}
              variant={period === item.value ? "primary" : "secondary"}
              aria-pressed={period === item.value}
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      <p className="measurements-notice">
        أمثلة تجريبية لآخر 7 أيام، وليست قراءات مريض حقيقية. البيانات مؤقتة.
        <span data-i18n="declarative">{t("reports.window", { days: formatNumber(period) })}</span>{" "}لا يتضمن التقرير
        تقييمًا طبيًا.
      </p>
      {isPending ? (
        <Card className="empty-state" role="status">
          جارٍ تحميل التقرير…
        </Card>
      ) : isError || !data ? (
        <Card className="empty-state" role="alert">
          <p>تعذر تحميل التقرير.</p>
          <Button onClick={() => void refetch()}>إعادة المحاولة</Button>
        </Card>
      ) : (
        <>
          <p className="muted" role="status" data-i18n="declarative">
            {t("reports.range", { from: `\u2068${data.from}\u2069`, to: `\u2068${data.to}\u2069`, count: formatNumber(data.measurements.length) })}
          </p>
          <div className="report-workbench"><ReportSummary data={data} /><div className="report-body">
          <p className="measurements-notice">
            الأدوية والعادات تعرضان حالة اليوم فقط من البيانات التجريبية
            الحالية؛ لا يتوفر سجل تاريخي لحساب الالتزام خلال الفترة.
          </p>
          <div className="report-charts">
            {(["pressure", "glucose"] as const).map((kind) => (
              <Card key={kind}>
                <h2>
                  {kind === "pressure" ? "اتجاه ضغط الدم" : "اتجاه سكر الدم"}
                </h2>
                <p className="muted">
                  متوسط القراءات لكل يوم مسجل، دون ملء الأيام المفقودة.
                </p>
                {(
                  kind === "pressure" ? data.pressure.count : data.glucose.count
                ) ? (
                  <Suspense fallback={<p role="status">جارٍ تحميل المخطط…</p>}>
                    <ReportChart points={data.points} kind={kind} />
                  </Suspense>
                ) : (
                  <p className="empty-state">
                    لا توجد قراءات من هذا النوع خلال الفترة.
                  </p>
                )}
              </Card>
            ))}
          </div>
          <Card className="report-readings">
            <h2>أحدث القياسات خلال الفترة</h2>
            {data.measurements.length ? (
              <ul>
                {data.measurements.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <span>{measurementLabel(item)}</span>
                    {item.isExample && <small>بيانات مثال</small>}
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
                لا توجد قياسات مسجلة خلال الفترة. أضف قراءة من صفحة صحتي لتظهر
                هنا.
              </p>
            )}
          </Card>
          </div></div>
        </>
      )}
    </div>
  );
}

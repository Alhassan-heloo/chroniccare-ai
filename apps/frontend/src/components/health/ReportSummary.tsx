import { Card } from "@/components/ui/Card";
import type { PatientReport } from "@/lib/types/report";
export function ReportSummary({ data }: { data: PatientReport }) {
  return (
    <section className="report-summary" aria-label="ملخص التقرير">
      <Card>
        <h2>متوسط ضغط الدم</h2>
        <strong>
          <bdi>
            {data.pressure.count
              ? `${data.pressure.systolic}/${data.pressure.diastolic}`
              : "—"}
          </bdi>
        </strong>
        <p>mmHg · {data.pressure.count} قراءات خلال الفترة</p>
      </Card>
      <Card>
        <h2>متوسط سكر الدم</h2>
        <strong>
          <bdi>{data.glucose.average ?? "—"}</bdi>
        </strong>
        <p>mg/dL · {data.glucose.count} قراءات خلال الفترة</p>
      </Card>
      <Card>
        <h2>جرعات اليوم</h2>
        <strong>
          <bdi>
            {data.medicationToday.taken}/{data.medicationToday.total}
          </bdi>
        </strong>
        <p>جرعات تم تسجيل تناولها اليوم فقط</p>
      </Card>
      <Card>
        <h2>عادات اليوم</h2>
        <strong>
          <bdi>
            {data.habitsToday.completed}/{data.habitsToday.total}
          </bdi>
        </strong>
        <p>عادات حققت هدف اليوم فقط</p>
      </Card>
    </section>
  );
}

import { useState } from "react";
import type { WeeklyPoint } from "@/lib/types/dashboard";
import { BloodPressureChart } from "@/components/charts/BloodPressureChart";
import { GlucoseChart } from "@/components/charts/GlucoseChart";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
export function WeeklySummary({ data }: { data: WeeklyPoint[] }) {
  const [kind, setKind] = useState<"pressure" | "glucose">("pressure");
  const visible = data.filter((point) =>
    kind === "pressure"
      ? point.systolic !== undefined
      : point.glucose !== undefined,
  );
  const includesExamples = visible.some((point) => point.isExample);
  return (
    <Card className="weekly-section">
      <div className="section-heading">
        <div>
          <h2>صحتك خلال الأسبوع</h2>
          <p>
            نظرة على قراءاتك
            {includesExamples ? " · يتضمن بيانات مثال" : ""}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="نوع مخطط الملخص">
          <Button
            variant="ghost"
            aria-pressed={kind === "pressure"}
            onClick={() => setKind("pressure")}
          >
            ضغط الدم
          </Button>
          <Button
            variant="ghost"
            aria-pressed={kind === "glucose"}
            onClick={() => setKind("glucose")}
          >
            السكر
          </Button>
        </div>
      </div>
      {!visible.length ? (
        <p className="empty-state">لا توجد قراءات من هذا النوع خلال آخر 7 أيام.</p>
      ) : kind === "pressure" ? (
        <BloodPressureChart data={data} />
      ) : (
        <GlucoseChart data={data} />
      )}
      {visible.length > 0 && <div className="chart-legend">
        {kind === "pressure" ? (
          <>
            <span>
              <i /> الانقباضي
            </span>
            <span>
              <i className="blue" /> الانبساطي
            </span>
            <span>mmHg</span>
          </>
        ) : (
          <span>
            <i /> سكر الدم · mg/dL
          </span>
        )}
      </div>}
      {visible.length > 0 && <details className="chart-data">
        <summary>عرض القراءات كنص</summary>
        <ul>
          {visible.map((point) => (
            <li key={point.day}>
              {point.day}:{" "}
              <bdi>
                {kind === "pressure"
                  ? `${point.systolic}/${point.diastolic} mmHg`
                  : `${point.glucose} mg/dL`}
              </bdi>
              {point.isExample ? " · بيانات مثال" : ""}
            </li>
          ))}
        </ul>
      </details>}
    </Card>
  );
}

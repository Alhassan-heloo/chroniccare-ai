import { useState } from "react";
import type { WeeklyPoint } from "@/lib/types/dashboard";
import { BloodPressureChart } from "@/components/charts/BloodPressureChart";
import { GlucoseChart } from "@/components/charts/GlucoseChart";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
export function WeeklySummary({ data }: { data: WeeklyPoint[] }) {
  const [kind, setKind] = useState<"pressure" | "glucose">("pressure");
  return (
    <Card className="weekly-section">
      <div className="section-heading">
        <div>
          <h2>صحتك خلال الأسبوع</h2>
          <p>نظرة على قراءاتك · بيانات توضيحية</p>
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
      {kind === "pressure" ? (
        <BloodPressureChart data={data} />
      ) : (
        <GlucoseChart data={data} />
      )}
      <div className="chart-legend">
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
      </div>
      <details className="chart-data">
        <summary>عرض القراءات كنص</summary>
        <ul>
          {data.map((point) => (
            <li key={point.day}>
              {point.day}:{" "}
              <bdi>
                {kind === "pressure"
                  ? `${point.systolic}/${point.diastolic} mmHg`
                  : `${point.glucose} mg/dL`}
              </bdi>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

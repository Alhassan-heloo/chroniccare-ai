import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { WeeklyPoint } from "@/lib/types/dashboard";
export function TrendChart({
  data,
  kind,
}: {
  data: WeeklyPoint[];
  kind: "pressure" | "glucose";
}) {
  return (
    <div
      className="chart"
      dir="ltr"
      role="img"
      aria-label={
        kind === "pressure"
          ? "اتجاه قراءات الضغط المسجلة خلال آخر 7 أيام، بوحدة mmHg"
          : "اتجاه قراءات السكر المسجلة خلال آخر 7 أيام، بوحدة mg/dL"
      }
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 12, left: -22, bottom: 0 }}
          accessibilityLayer
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              direction: "rtl",
              borderColor: "var(--border)",
            }}
          />
          <Line
            type="monotone"
            dataKey={kind === "pressure" ? "systolic" : "glucose"}
            name={kind === "pressure" ? "الانقباضي" : "السكر"}
            stroke="var(--primary)"
            strokeWidth={3}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          {kind === "pressure" && (
            <Line
              type="monotone"
              dataKey="diastolic"
              name="الانبساطي"
              stroke="var(--info)"
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

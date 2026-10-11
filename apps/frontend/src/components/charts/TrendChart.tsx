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
import { useI18n } from "@/i18n/context";
export function TrendChart({
  data,
  kind,
}: {
  data: WeeklyPoint[];
  kind: "pressure" | "glucose";
}) {
  const { t, direction, formatNumber, formatDate } = useI18n();
  return (
    <div
      className="chart"
      data-i18n="declarative"
      dir="ltr"
      role="img"
      aria-label={
        kind === "pressure"
          ? t("common.chart.pressureDescription")
          : t("common.chart.glucoseDescription")
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
            tickFormatter={(day: string) => formatDate(`${day}T12:00:00`, { day: "numeric", month: "short" })}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(value: number) => formatNumber(value)}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
          />
          <Tooltip
            labelFormatter={(day) => formatDate(`${String(day)}T12:00:00`, { day: "numeric", month: "short" })}
            formatter={(value) => typeof value === "number" ? formatNumber(value) : String(value)}
            contentStyle={{
              borderRadius: 12,
              direction,
              background: "var(--surface)", color: "var(--text)",
              borderColor: "var(--border)",
            }}
          />
          <Line
            type="monotone"
            dataKey={kind === "pressure" ? "systolic" : "glucose"}
            name={t(kind === "pressure" ? "common.chart.systolic" : "common.chart.glucose")}
            stroke="var(--primary)"
            strokeWidth={3}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          {kind === "pressure" && (
            <Line
              type="monotone"
              dataKey="diastolic"
              name={t("common.chart.diastolic")}
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

import { useId } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n/context";
import type { WeeklyPoint } from "@/lib/types/dashboard";
import { buildChartSeries } from "@/lib/utils/chartSeries";

export function PrecisionHealthChart({ data: points, kind, compact = false }: {
  data: readonly WeeklyPoint[];
  kind: "pressure" | "glucose";
  compact?: boolean;
}) {
  const { t, direction, formatNumber, formatDate, formatUnit } = useI18n();
  const id = useId().replace(/:/g, "");
  const pressure = kind === "pressure";
  const mainKey = pressure ? "systolic" : "glucose";
  const recorded = points.filter(point => point[mainKey] !== undefined);
  const data = buildChartSeries(points);
  const unit = formatUnit(pressure ? "mmHg" : "mg/dL");
  const label = t(pressure ? "measurements.bloodPressure" : "measurements.bloodGlucose");
  const primaryLabel = t(pressure ? "common.chart.systolic" : "measurements.bloodGlucose");
  const secondaryLabel = t("common.chart.diastolic");
  const dayLabel = (timestamp: number, full = false) => formatDate(new Date(timestamp), full ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  if (!recorded.length || !data.length) return <div className="precision-empty empty-state" data-i18n="declarative"><p>{t("reports.noReadings")}</p><small>{unit}</small></div>;
  const values = recorded.flatMap(point => pressure ? [point.systolic, point.diastolic] : [point.glucose]).filter((value): value is number => value !== undefined);
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max(5, (high - low) * .18);
  const first = data[0]!.timestamp, last = data.at(-1)!.timestamp;
  const oneDay = first === last;
  const formatValue = (value: number | undefined) => value === undefined ? "—" : formatNumber(value);
  return <div className={`precision-chart${compact ? " precision-compact" : ""}`} data-kind={kind} data-recorded-days={recorded.length} data-i18n="declarative">
    {!compact && <div className="precision-key"><span><i />{primaryLabel}</span>{pressure && <span><i className="precision-secondary" />{secondaryLabel}</span>}<bdi className="precision-unit">{unit}</bdi></div>}
    <div className="chart precision-plot" dir="ltr" role="img" aria-label={t("reports.chartDescription", { kind: label, days: formatNumber(recorded.length), unit })}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={compact ? { top: 8, right: 6, bottom: 8, left: 6 } : { top: 16, right: 18, bottom: 4, left: 0 }} accessibilityLayer>
          <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--glucose)" stopOpacity=".16" /><stop offset="100%" stopColor="var(--glucose)" stopOpacity=".01" /></linearGradient></defs>
          {!compact && <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="2 6" />}
          <XAxis dataKey="timestamp" type="number" scale="time" domain={oneDay ? [first - 43_200_000, first + 43_200_000] : [first, last]} ticks={oneDay ? [first] : undefined} hide={compact} tickFormatter={value => dayLabel(Number(value))} tick={{ fill: "var(--muted)", fontSize: "var(--text-xxs)" }} axisLine={false} tickLine={false} minTickGap={42} tickMargin={12} height={40} />
          <YAxis hide={compact} width={42} domain={[Math.max(0, Math.floor(low - padding)), Math.ceil(high + padding)]} tickCount={4} tickFormatter={value => formatNumber(Number(value))} tick={{ fill: "var(--muted)", fontSize: "var(--text-xxs)" }} tickLine={false} axisLine={false} tickMargin={8} />
          {!compact && <Tooltip cursor={{ stroke: "var(--border)", strokeDasharray: "3 5" }} allowEscapeViewBox={{ x: false, y: false }} wrapperStyle={{ maxWidth: "calc(100vw - 48px)", outline: "none" }} content={({ active, payload, label: timestamp }) => active && payload?.length ? <div className="precision-tooltip" dir={direction}><time>{dayLabel(Number(timestamp), true)}</time>{payload.filter(entry => typeof entry.value === "number" && entry.dataKey !== "area").map(entry => <div key={String(entry.dataKey)}><span>{entry.dataKey === "diastolic" ? secondaryLabel : primaryLabel}</span><bdi>{formatNumber(Number(entry.value))} <small>{unit}</small></bdi></div>)}</div> : null} />}
          {!pressure && <Area type="linear" dataKey="glucose" fill={`url(#${id}-fill)`} stroke="none" legendType="none" tooltipType="none" connectNulls={false} isAnimationActive={false} />}
          <Line type="linear" dataKey={mainKey} name={primaryLabel} stroke={pressure ? "var(--pressure)" : "var(--glucose)"} strokeWidth={compact ? 2 : 2.5} connectNulls={false} dot={compact && !oneDay ? false : { r: 3, strokeWidth: 2, fill: "var(--surface)" }} activeDot={compact ? false : { r: 6, strokeWidth: 3, stroke: "var(--surface)", fill: pressure ? "var(--pressure)" : "var(--glucose)" }} isAnimationActive={false} />
          {pressure && <Line type="linear" dataKey="diastolic" name={secondaryLabel} stroke="var(--pressure-secondary)" strokeWidth={2} strokeDasharray="5 4" connectNulls={false} dot={compact && !oneDay ? false : { r: 2.5, strokeWidth: 2, fill: "var(--surface)" }} activeDot={compact ? false : { r: 5, strokeWidth: 3, stroke: "var(--surface)", fill: "var(--pressure-secondary)" }} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    {!compact && <><div className="precision-chart-caption"><span>{oneDay ? t("evolution.chartSingle") : t("evolution.chartDays", { count: formatNumber(recorded.length) })}</span></div>
      <details className="precision-values"><summary>{t("evolution.chartValues")}</summary><p className="precision-axis-note">{t("evolution.chartAxis")}</p><ul>{recorded.map(point => <li key={point.day}><time dateTime={point.day}>{formatDate(`${point.day}T12:00:00`, { day: "numeric", month: "short" })}</time><span>{primaryLabel} <bdi>{formatValue(point[mainKey])} {unit}</bdi></span>{pressure && <span>{secondaryLabel} <bdi>{formatValue(point.diastolic)} {unit}</bdi></span>}</li>)}</ul></details></>}
    {compact && <span className="sr-only">{recorded.map(point => `${point.day}: ${pressure ? `${formatValue(point.systolic)}/${formatValue(point.diastolic)}` : formatValue(point.glucose)} ${unit}`).join("; ")}</span>}
  </div>;
}

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { ReportPoint } from "@/lib/types/report";
import { useI18n } from "@/i18n/context";
export default function ReportChart({
  points,
  kind,
}: {
  points: ReportPoint[];
  kind: "pressure" | "glucose";
}) {
  const { t, locale, language, formatNumber, formatUnit } = useI18n();
  const formatValue = (value: number | undefined) => value === undefined ? "—" : formatNumber(value);
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", calendar: "gregory" });
  const axisFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", calendar: "gregory" });
  const pressure = kind === "pressure";
  const unit = formatUnit(pressure ? "mmHg" : "mg/dL");
  const data = points
    .filter((point) =>
      pressure ? point.systolic !== undefined : point.glucose !== undefined,
    )
    .map((point) => ({
      ...point,
      timestamp: new Date(`${point.day}T00:00:00`).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
  const first = data[0];
  if (!first) return <p className="empty-state" data-i18n="declarative">{t("reports.noReadings")}</p>;
  const singleDay =
    data.length === 1 ? (
      <section className="report-single-day" aria-label={t("متوسطات يوم واحد")}>
        <p className="report-day-date">
          <time dateTime={first.day}>
            {dateFormatter.format(first.timestamp)}
          </time>
          <span>{t("متوسط اليوم")}</span>
        </p>
        <dl className="report-single-values">
          <div>
            <dt>{t(pressure ? "measurements.ui.systolic" : "measurements.bloodGlucose")}</dt>
            <dd>
              <bdi>
                {formatValue(pressure ? first.systolic : first.glucose)}
              </bdi>
              <small>{unit}</small>
            </dd>
          </div>
          {pressure && (
            <div>
              <dt>{t("measurements.ui.diastolic")}</dt>
              <dd>
                <bdi>{formatValue(first.diastolic)}</bdi>
                <small>{unit}</small>
              </dd>
            </div>
          )}
        </dl>
        <p className="report-single-note">
          {t("تتوفر بيانات يوم واحد فقط؛ تظهر نقاط المتوسط أدناه، ويظهر خط الاتجاه عند تسجيل يوم آخر.")}
        </p>
      </section>
    ) : null;
  // Pad the measured range without introducing clinical thresholds.
  const values = data
    .flatMap((point) =>
      pressure ? [point.systolic, point.diastolic] : [point.glucose],
    )
    .filter((value): value is number => value !== undefined);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max(5, (maximum - minimum) * 0.15);
  const ticks = data
    .filter(
      (_, index) =>
        index === 0 ||
        index === data.length - 1 ||
        index % Math.ceil(data.length / 5) === 0,
    )
    .map((point) => point.timestamp);
  return (
    <div className="report-trend" data-i18n="declarative">
      {singleDay}
      <div className="report-chart-key" aria-label={t("مفتاح المخطط")}>
        <span>
          <i aria-hidden="true" />
          {t(pressure ? "common.chart.systolic" : "measurements.bloodGlucose")}
        </span>
        {pressure && (
          <span>
            <i className="report-key-secondary" aria-hidden="true" />
            {t("common.chart.diastolic")}
          </span>
        )}
        <bdi className="report-chart-unit">{unit}</bdi>
      </div>
      <div
        className="chart"
        dir="ltr"
        role="img"
        aria-label={t("reports.chartDescription", { kind: t(pressure ? "measurements.bloodPressure" : "measurements.bloodGlucose"), days: formatNumber(data.length), unit })}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart
            data={data}
            margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={
                data.length === 1
                  ? [first.timestamp - 43_200_000, first.timestamp + 43_200_000]
                  : ["dataMin", "dataMax"]
              }
              ticks={ticks}
              tickFormatter={(value) => axisFormatter.format(Number(value))}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              width={44}
              tickFormatter={(value) => formatNumber(Number(value))}
              domain={[
                Math.max(0, Math.floor(minimum - padding)),
                Math.ceil(maximum + padding),
              ]}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, name) => [typeof value === "number" ? formatNumber(value) : String(value ?? "—"), name ?? ""]}
              labelFormatter={(value) => dateFormatter.format(Number(value))}
              contentStyle={{
                direction: language === "ar" ? "rtl" : "ltr", background: "var(--surface)", color: "var(--text)",
                borderRadius: 12,
                borderColor: "var(--border)",
              }}
            />
            <Line
              type="linear"
              dataKey={pressure ? "systolic" : "glucose"}
              name={t(pressure ? "الانقباضي (mmHg)" : "سكر الدم (mg/dL)")}
              stroke="var(--primary)"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
            {pressure && (
              <Line
                type="linear"
                dataKey="diastolic"
                name={t("الانبساطي (mmHg)")}
                stroke="var(--info)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="report-chart-note">
        {t("المحور الرأسي يتكيف مع القيم لعرض الفروق. الخط يربط الأيام المسجلة فقط، ولا يمثل قراءات للأيام المفقودة.")}
      </p>
      <details className="report-day-details">
        <summary>{t("عرض متوسطات الأيام")} ({formatNumber(data.length)})</summary>
        <ul>
          {data.map((point) => (
            <li key={point.day}>
              <time dateTime={point.day}>
                {dateFormatter.format(point.timestamp)}
              </time>
              <span>
                {pressure ? `${t("common.chart.systolic")} / ${t("common.chart.diastolic")}` : t("measurements.bloodGlucose")}:{" "}
                <bdi>
                  {pressure
                    ? `${formatValue(point.systolic)} / ${formatValue(point.diastolic)}`
                    : formatValue(point.glucose)}{" "}
                  {unit}
                </bdi>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

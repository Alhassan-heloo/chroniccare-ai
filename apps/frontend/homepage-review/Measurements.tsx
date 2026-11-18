import { useState } from 'react';

const dates = ['٩ نوفمبر', '١٠ نوفمبر', '١١ نوفمبر', '١٢ نوفمبر', '١٣ نوفمبر', '١٤ نوفمبر', '١٥ نوفمبر'];
const formatNumber = new Intl.NumberFormat('ar', { numberingSystem: 'arab', useGrouping: false }).format;

const example = {
  pressure: {
    label: 'ضغط الدم',
    unit: 'ملم زئبق',
    time: '٨:١٥',
    scale: [60, 150],
    ticks: [140, 120, 100, 80, 60],
    series: [
      { label: 'الانقباضي', values: [132, 128, 133, 125, 127, 122, 124] },
      { label: 'الانبساطي', values: [84, 80, 83, 77, 80, 76, 79] },
    ],
  },
  glucose: {
    label: 'سكر الدم',
    unit: 'ملغم/دل',
    time: '٧:٤٥',
    scale: [85, 145],
    ticks: [140, 125, 110, 95],
    series: [{ label: 'قبل الإفطار', values: [121, 117, 126, 115, 111, 114, 108] }],
  },
} as const;

type Metric = keyof typeof example;
const metricKeys = ['pressure', 'glucose'] as const;
const width = 1000;
const height = 220;

function plotX(index: number) {
  return width - 8 - index * (width - 16) / (dates.length - 1);
}

function Trend({ metric }: { metric: Metric }) {
  const { label, unit, scale, ticks, series } = example[metric];
  const position = (value: number) => 12 + (scale[1] - value) / (scale[1] - scale[0]) * (height - 24);
  const percentage = (value: number) => `${position(value) / height * 100}%`;

  return <figure className="trend">
    <figcaption className="sr-only">{label} خلال سبعة أيام، الوحدة {unit}. القراءات التفصيلية متاحة بعد الرسم.</figcaption>
    <div className="plot-grid" aria-hidden="true">
      <div className="plot-labels" dir="rtl">
        {series.map(({ label: seriesLabel, values }, index) => <span className={index === 0 ? 'first-series' : 'second-series'} key={seriesLabel} style={{ top: percentage(values[6]) }}>{seriesLabel}</span>)}
      </div>
      <div className="plot">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" focusable="false">
          {ticks.map(tick => <line className="grid-line" key={tick} x1="0" x2={width} y1={position(tick)} y2={position(tick)} />)}
          {series.map(({ label: seriesLabel, values }, index) => <g className={index === 0 ? 'first-series' : 'second-series'} key={seriesLabel}>
            <polyline points={values.map((value, i) => `${plotX(i)},${position(value)}`).join(' ')} />
          </g>)}
        </svg>
        {series.map(({ label: seriesLabel, values }, seriesIndex) => values.map((value, index) => <i
          className={`chart-point ${seriesIndex === 0 ? 'first-series' : 'second-series'}${index === 6 ? ' final-point' : ''}`}
          key={`${seriesLabel}-${index}`}
          style={{ left: `${plotX(index) / width * 100}%`, top: percentage(value) }}
        />))}
      </div>
      <div className="plot-ticks">{ticks.map(tick => <span key={tick} style={{ top: percentage(tick) }}>{formatNumber(tick)}</span>)}</div>
      <div className="plot-dates" dir="rtl"><span>{dates[0]}</span><span>{dates[3]}</span><span>{dates[6]}</span></div>
    </div>
  </figure>;
}

function ReadingTable({ metric }: { metric: Metric }) {
  const { label, unit, series } = example[metric];

  return <details className="reading-details">
    <summary>عرض القراءات يومًا بيوم</summary>
    <table>
      <caption>{label} ({unit})</caption>
      <thead><tr><th scope="col">التاريخ</th>{series.map(item => <th key={item.label} scope="col">{item.label}</th>)}</tr></thead>
      <tbody>{dates.map((date, index) => <tr key={date}>
        <th scope="row">{date}</th>
        {series.map(item => <td key={item.label}>{formatNumber(item.values[index]!)}</td>)}
      </tr>)}</tbody>
    </table>
  </details>;
}

export default function Measurements() {
  const [metric, setMetric] = useState<Metric>('pressure');
  const { label, unit, time, series } = example[metric];
  const value = series.map(item => formatNumber(item.values[6])).join('/');

  return <section className="measurements" id="measurements" tabIndex={-1} aria-labelledby="measurements-title">
    <div className="wrap">
      <header className="measurement-intro">
        <h2 id="measurements-title">أسبوع من القياسات.</h2>
        <p>سجّل القراءة ووقت أخذها، ثم ارجع إليها لترى كيف تغيّرت على مدار الأسبوع.</p>
      </header>
      <div className="measurement-toolbar">
        <fieldset className="metric-choices">
          <legend className="sr-only">نوع القياس في المثال</legend>
          {metricKeys.map(key => <label key={key}>
            <input className="sr-only" type="radio" name="example-metric" value={key} checked={metric === key} onChange={() => setMetric(key)} />
            <span>{example[key].label}</span>
          </label>)}
        </fieldset>
        <p className="example-note">بيانات افتراضية</p>
      </div>
      <div className="latest" aria-live="polite">
        <p className="latest-title">آخر قراءة <span className="sr-only">لـ{label}</span></p>
        <p className="latest-value"><bdi dir="ltr">{value}</bdi> <span>{unit}</span></p>
        <p className="latest-time">{dates[6]}، <bdi>{time}</bdi> صباحًا</p>
      </div>
      <Trend metric={metric} />
      <ReadingTable metric={metric} />
    </div>
  </section>;
}

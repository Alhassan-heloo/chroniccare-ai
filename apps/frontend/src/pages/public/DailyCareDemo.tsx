import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { CalendarDays, Check, CheckCircle2, Clock, HeartPulse, Pill, Sun } from "lucide-react";
import { useI18n } from "@/i18n/context";

const readings = [
  { systolic: 132, diastolic: 84, time: "07:30" },
  { systolic: 126, diastolic: 82, time: "07:50" },
  { systolic: 124, diastolic: 80, time: "07:40" },
] as const;
const latestReading = readings[2];
const doseTime = "20:00";
const scenes = [
  { id: "morning", icon: Sun },
  { id: "evening", icon: Pill },
  { id: "visit", icon: CalendarDays },
] as const;

const copy = {
  ar: {
    title: "يوم مع",
    intro: "اختر لحظة من اليوم لتجرّب كيف تتابع قياساتك وجرعاتك وتراجع سجلّك.",
    sample: "بيانات توضيحية فقط",
    sceneLabel: "لحظات من يومك",
    scenes: ["قياس الصبح", "جرعة المساء", "قبل الموعد"],
    morningTitle: "قراءة ضغط الدم",
    today: "اليوم",
    chartTitle: "الضغط الانقباضي خلال ثلاثة أيام",
    chartHint: "اختر نقطة لعرض القراءة الكاملة.",
    days: ["قبل يومين", "أمس", "اليوم"],
    trend: "تراجع الضغط الانقباضي في هذه القراءات التوضيحية من {first} إلى {last} ملم زئبق.",
    doseTitle: "موعد جرعتك المسائية",
    dose: "دواء توضيحي",
    scheduled: "مجدولة",
    doseDetail: "جرعة واحدة حسب الجدول التوضيحي.",
    take: "سجّل الجرعة كمأخوذة",
    taken: "تم تسجيل الجرعة كمأخوذة.",
    done: "تم أخذ الجرعة",
    visitTitle: "سجلّك قبل الموعد",
    visitDetail: "راجع آخر قراءتين وما سجلته في روتينك اليومي.",
    activity: "الروتين اليومي",
    walk: "مشي",
    minutes: "دقيقة",
  },
  en: {
    title: "A day with",
    intro: "Choose a moment in the day to explore readings, medication, and a record you can review.",
    sample: "Example data only",
    sceneLabel: "Moments in your day",
    scenes: ["Morning measurement", "Evening dose", "Before the visit"],
    morningTitle: "Blood pressure reading",
    today: "Today",
    chartTitle: "Systolic pressure over three days",
    chartHint: "Select a point to see the full reading.",
    days: ["Two days ago", "Yesterday", "Today"],
    trend: "In these example readings, systolic pressure fell from {first} to {last} mmHg.",
    doseTitle: "Your evening dose",
    dose: "Example medication",
    scheduled: "Scheduled",
    doseDetail: "One dose on the example schedule.",
    take: "Mark dose as taken",
    taken: "Dose marked as taken.",
    done: "Dose taken",
    visitTitle: "Your record before the visit",
    visitDetail: "Review your latest readings and the activity you recorded in your daily routine.",
    activity: "Daily routine",
    walk: "Walk",
    minutes: "min",
  },
};

export function PressureValue({ reading = latestReading }: { reading?: (typeof readings)[number] }) {
  const { formatNumber } = useI18n();
  return (
    <bdi className="clinical-pressure" dir="ltr">
      <span>{formatNumber(reading.systolic)}/{formatNumber(reading.diastolic)}</span>
      <small>mmHg</small>
    </bdi>
  );
}

export function MorningReadingTime() {
  return <time dateTime={latestReading.time} dir="ltr">{latestReading.time}</time>;
}

function ReadingTrend() {
  const { language, formatNumber } = useI18n();
  const [point, setPoint] = useState(readings.length - 1);
  const c = copy[language];
  const selectedReading = readings[point] ?? latestReading;
  const summary = c.trend
    .replace("{first}", formatNumber(readings[0].systolic))
    .replace("{last}", formatNumber(latestReading.systolic));
  const heights = readings.map(reading => 32 + (132 - reading.systolic) * 5);

  return (
    <div className="clinical-trend">
      <h4>{c.chartTitle}</h4>
      <p>{c.chartHint}</p>
      <div className="clinical-plot" role="group" aria-label={c.chartTitle} dir="ltr">
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="clinical-plot-area" d={`M50 ${heights[0]} L150 ${heights[1]} L250 ${heights[2]} V100 H50 Z`} />
          <path className="clinical-plot-line" vectorEffect="non-scaling-stroke" d={`M50 ${heights[0]} L150 ${heights[1]} L250 ${heights[2]}`} />
        </svg>
        {readings.map((reading, index) => (
          <button
            key={reading.time}
            type="button"
            className="clinical-chart-point"
            style={{ "--point-y": `${heights[index]}%` } as CSSProperties}
            aria-label={`${c.days[index]}، ${formatNumber(reading.systolic)}/${formatNumber(reading.diastolic)} mmHg، ${reading.time}`}
            aria-pressed={point === index}
            onClick={() => setPoint(index)}
            onFocus={() => setPoint(index)}
          >
            <span className="clinical-point-track" aria-hidden="true"><span className="clinical-point-mark" /></span>
            <span className="clinical-point-day" dir="auto">{c.days[index]}</span>
          </button>
        ))}
      </div>
      <div className="clinical-point-readout" role="status">
        <strong>{c.days[point]}</strong>
        <PressureValue reading={selectedReading} />
        <time dateTime={selectedReading.time} dir="ltr">{selectedReading.time}</time>
      </div>
      <p className="clinical-trend-summary">{summary}</p>
    </div>
  );
}

export function DailyCareDemo({ active, onSceneChange }: { active: number; onSceneChange: (index: number) => void }) {
  const { language, direction, formatNumber } = useI18n();
  const [taken, setTaken] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const c = copy[language];

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    const forward = direction === "rtl" ? -1 : 1;
    switch (event.key) {
      case "ArrowRight": next = index + forward; break;
      case "ArrowLeft": next = index - forward; break;
      case "Home": next = 0; break;
      case "End": next = scenes.length - 1; break;
      default: return;
    }
    event.preventDefault();
    tabs.current[(next + scenes.length) % scenes.length]?.focus();
  }

  return (
    <section className="clinical-demo" id="product-preview" aria-labelledby="clinical-demo-title" tabIndex={-1}>
      <div className="clinical-demo-heading">
        <h2 id="clinical-demo-title">{c.title} <bdi dir="ltr">ChronicCare AI</bdi></h2>
        <p>{c.intro}</p>
      </div>
      <div className="clinical-panel">
        <div className="clinical-panel-bar">
          <div className="clinical-tabs" role="tablist" aria-label={c.sceneLabel}>
            {scenes.map(({ id, icon: Icon }, index) => (
              <button
                key={id}
                ref={node => { tabs.current[index] = node; }}
                type="button"
                id={`clinical-tab-${id}`}
                role="tab"
                aria-selected={active === index}
                aria-controls={`clinical-scene-${id}`}
                tabIndex={active === index ? 0 : -1}
                onKeyDown={event => moveTab(event, index)}
                onClick={() => onSceneChange(index)}
              >
                <Icon size={20} aria-hidden="true" />{c.scenes[index]}
              </button>
            ))}
          </div>
          <p className="clinical-sample">{c.sample}</p>
        </div>

        <div className="clinical-scene" role="tabpanel" id="clinical-scene-morning" aria-labelledby="clinical-tab-morning" hidden={active !== 0} tabIndex={0}>
          <div className="clinical-scene-content clinical-morning">
            <div className="clinical-today">
              <HeartPulse size={28} aria-hidden="true" />
              <h3>{c.morningTitle}</h3>
              <PressureValue reading={latestReading} />
              <p className="clinical-time"><Clock size={17} aria-hidden="true" />{c.today}<MorningReadingTime /></p>
            </div>
            <ReadingTrend />
          </div>
        </div>

        <div className="clinical-scene" role="tabpanel" id="clinical-scene-evening" aria-labelledby="clinical-tab-evening" hidden={active !== 1} tabIndex={0}>
          <div className="clinical-scene-content clinical-evening">
            <div>
              <Pill className="clinical-scene-icon" size={28} aria-hidden="true" />
              <h3>{c.doseTitle}</h3>
              <p>{c.doseDetail}</p>
            </div>
            <div className="clinical-dose">
              <div className="clinical-dose-heading">
                <strong>{c.dose}</strong>
                <time dateTime={doseTime} dir="ltr">{doseTime}</time>
              </div>
              {!taken && <span className="clinical-dose-state">{c.scheduled}</span>}
              <button type="button" className="clinical-action" aria-disabled={taken} onClick={() => { if (!taken) setTaken(true); }}>
                <Check size={20} aria-hidden="true" />{c.take}
              </button>
              <div className="clinical-confirmation" role="status">
                {taken && <p><CheckCircle2 size={20} aria-hidden="true" />{c.taken}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="clinical-scene" role="tabpanel" id="clinical-scene-visit" aria-labelledby="clinical-tab-visit" hidden={active !== 2} tabIndex={0}>
          <div className="clinical-scene-content clinical-visit-scene">
            <div>
              <CalendarDays className="clinical-scene-icon" size={28} aria-hidden="true" />
              <h3>{c.visitTitle}</h3>
              <p>{c.visitDetail}</p>
            </div>
            <dl className="clinical-record">
              <div className="clinical-record-readings">
                <dt><HeartPulse size={19} aria-hidden="true" />{c.morningTitle}</dt>
                <dd>
                  {([2, 1] as const).map(index => (
                    <span key={index}><span>{c.days[index]}</span><PressureValue reading={readings[index]} /></span>
                  ))}
                </dd>
              </div>
              <div><dt><Pill size={19} aria-hidden="true" />{c.scenes[1]}</dt><dd>{taken ? c.done : c.scheduled} <time dateTime={doseTime} dir="ltr">{doseTime}</time></dd></div>
              <div><dt><CheckCircle2 size={19} aria-hidden="true" />{c.activity}</dt><dd>{c.walk} <bdi>{formatNumber(20)} {c.minutes}</bdi></dd></div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

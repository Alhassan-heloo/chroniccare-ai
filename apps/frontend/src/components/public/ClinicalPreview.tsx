import { useId, useRef, useState } from "react";
import { Activity, ArrowUpRight, Bot, ChartNoAxesCombined, Check, Droplet, Footprints, HeartPulse, Pill } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { demoWeeklyMeasurements } from "@/lib/placeholder-data/patientDashboard.placeholder";
import { PreviewTrend } from "./PreviewTrend";
import { AssistantPreview } from "./AssistantPreview";

/** Public illustration uses the existing seven-day examples, not a second patient store. */
export function ClinicalRecordPreview() {
  const { t, formatNumber, formatUnit } = useI18n();
  const [day, setDay] = useState(6);
  const reading = demoWeeklyMeasurements[day] ?? demoWeeklyMeasurements[6];
  return <section id="product-preview" className="clinical-record-preview" aria-labelledby="record-title">
    <div className="record-caption"><span><Activity size={18} aria-hidden="true" />{t("public.clinical.record")}</span><span className="clinical-sample"><i />{t("public.clinical.sample")}</span></div>
    <div className="record-layout">
      <div className="record-intro"><span className="clinical-kicker">{t("public.clinical.week")}</span><h2 id="record-title">{t("public.next.readings")}</h2><p>{t("public.clinical.recordBody")}</p></div>
      <div className="record-explorer">
        <div className="record-days" role="group" aria-label={t("public.clinical.week")}>
          {demoWeeklyMeasurements.map((_, index) => <button type="button" key={index} aria-label={t("public.clinical.day", { day: formatNumber(index + 1) })} aria-pressed={day === index} onClick={() => setDay(index)}><span>{formatNumber(index + 1, { minimumIntegerDigits: 2 })}</span><i aria-hidden="true" /></button>)}
        </div>
        <div className="record-reading-values" aria-live="polite" aria-atomic="true"><span className="sr-only">{t("public.clinical.selectedDay", { day: formatNumber(day + 1) })}</span>
          <div><span><HeartPulse size={19} aria-hidden="true" />{t("measurements.bloodPressure")}</span><strong><bdi>{formatNumber(reading.systolic)}<small> / {formatNumber(reading.diastolic)}</small></bdi></strong><span>{formatUnit("mmHg")}</span></div>
          <div><span><Droplet size={19} aria-hidden="true" />{t("measurements.bloodGlucose")}</span><strong>{formatNumber(reading.glucose)}</strong><span>{formatUnit("mg/dL")}</span></div>
          <div className="record-spark"><PreviewTrend /></div>
        </div>
      </div>
    </div>
    <div className="record-footnote"><span>{t("public.clinical.safety")}</span><span>{t("public.next.period")}</span></div>
  </section>;
}

const tools = [
  { label: "measurements.bloodPressure", title: "public.next.trends", body: "public.measurementsBody", icon: HeartPulse },
  { label: "medications.title", title: "public.next.medication", body: "public.next.medicationBody", icon: Pill },
  { label: "habits.title", title: "public.next.habit", body: "public.next.habitBody", icon: Footprints },
  { label: "reports.title", title: "public.next.reports", body: "public.next.reportsBody", icon: ChartNoAxesCombined },
  { label: "common.navigation.assistant", title: "public.next.aiTitle", body: "public.next.aiBody", icon: Bot },
] as const;

/** Disclosure tabs describe existing capabilities; no pretend mutation controls. */
export function ClinicalTools({ onExplore, initialSelection = 0 }: { onExplore: () => void; initialSelection?: 0 | 4 }) {
  const { t, direction, formatNumber } = useI18n();
  const [selected, setSelected] = useState<number>(initialSelection);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const tool = tools[selected] ?? tools[0];
  const Icon = tool.icon;
  return <div id="assistant-preview" className="clinical-tools">
    <div className="clinical-tool-list" role="tablist" aria-label={t("public.navFeatures")}>
      {tools.map((item, index) => <button type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} ref={element => { buttons.current[index] = element; }} key={item.label} onClick={() => setSelected(index)} onKeyDown={event => {
        if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const forward = event.key === "ArrowDown" || event.key === (direction === "rtl" ? "ArrowLeft" : "ArrowRight");
        const next = event.key === "Home" ? 0 : event.key === "End" ? tools.length - 1 : (index + (forward ? 1 : -1) + tools.length) % tools.length;
        setSelected(next); buttons.current[next]?.focus();
      }}><span>{formatNumber(index + 1, { minimumIntegerDigits: 2 })}</span><item.icon size={20} aria-hidden="true" /><strong>{t(item.label)}</strong><ArrowUpRight size={18} aria-hidden="true" /></button>)}
    </div>
    <section id={`${id}-panel`} role="tabpanel" tabIndex={0} aria-labelledby={`${id}-tab-${selected}`} className="clinical-tool-detail">
      <div className="clinical-detail-copy" key={selected}><span className="clinical-feature-icon"><Icon size={26} aria-hidden="true" /></span><h3>{t(tool.title)}</h3><p>{t(tool.body)}</p>
        {selected === 4 ? <AssistantPreview /> : <>
          {selected === 0 || selected === 3 ? <PreviewTrend /> : <div className="clinical-routine-demo"><span><Check size={20} aria-hidden="true" />{t(selected === 1 ? "public.clinical.routine" : "public.next.habit")}</span><p>{t(selected === 1 ? "public.routineBody" : "habits.ui.advice")}</p></div>}
          <button type="button" className="clinical-text-link" onClick={onExplore}>{t("public.clinical.next")}<ArrowUpRight size={18} aria-hidden="true" /></button>
        </>}
      </div>
    </section>
  </div>;
}

import { useI18n } from "@/i18n/context";
import { localDateKey } from "@/lib/utils/measurementFilters";

/** The homepage reading caption's name → exact value/unit → actual time grouping. */
export function ReadingValue({value,unit,recordedAt}:{value:string;unit:string;recordedAt?:string}) {
  const {t,formatDate,formatTime}=useI18n();
  return <><div className="metric-reading"><bdi className="metric-number" dir="ltr">{value}</bdi>{unit && <span className="metric-unit patient-reading-unit"><bdi>{unit}</bdi></span>}</div>
    {recordedAt && <time className="metric-time patient-reading-time" dateTime={recordedAt}><span className="reading-day-label">{t(localDateKey(recordedAt)===localDateKey(new Date().toISOString())?"finalExperience.todayReading":"finalExperience.earlierReading")}</span><bdi>{formatDate(recordedAt,{day:"numeric",month:"long",year:"numeric"})}</bdi><bdi>{formatTime(recordedAt)}</bdi></time>}</>;
}

import {useState} from "react";
import type {UseQueryResult} from "@tanstack/react-query";
import {HeartPulse,Pill,Footprints,ChevronDown} from "lucide-react";
import {useI18n} from "@/i18n/context";
import type {CareActivity} from "@/lib/api/doctor";
import type {DoctorPatientRecord} from "@/lib/types/doctor";
import {localDateKey,measurementValue} from "@/lib/utils/measurementFilters";
import {summarizeReport} from "@/lib/utils/reports";
import {Button} from "@/components/ui/Button";
import {Feedback} from "@/components/ui/Feedback";

export function PatientActivity({record,activity}:{record:DoctorPatientRecord;activity:UseQueryResult<CareActivity[], unknown>}) {
 const {t,formatDate,formatDateTime,formatNumber,formatHabitUnit}=useI18n();
 const [filter,setFilter]=useState<"all"|"measurement"|"dose"|"habit">("all");
 const start=new Date(record.date+"T12:00:00");start.setDate(start.getDate()-13);const from=localDateKey(start.toISOString());
 const readings=record.measurements.filter(item=>{const key=localDateKey(item.recordedAt);return key>=from&&key<=record.date;}).map(item=>({id:item.id,kind:"measurement" as const,title:t(item.kind==="bloodPressure"?"measurements.bloodPressure":"measurements.bloodGlucose"),day:localDateKey(item.recordedAt),recordedAt:item.recordedAt,detail:measurementValue(item)+" "+(item.kind==="bloodPressure"?"mmHg":"mg/dL"),scheduledTime:null}));
 const care=(activity.isError?[]:activity.data??[]).map(item=>({...item,detail:item.kind==="dose"?t("graduation.doseEvent"):t("graduation.habitEvent")+": "+formatNumber(item.value!)+" "+formatHabitUnit(item.unit!,item.value!)}));
 const events=[...readings,...care].filter(item=>filter==="all"||item.kind===filter).sort((a,b)=>b.day.localeCompare(a.day)||b.recordedAt.localeCompare(a.recordedAt));
 const groups=new Map<string,typeof events>();for(const item of events){groups.set(item.day,[...(groups.get(item.day)??[]),item]);}
 return <section className="patient-activity" aria-labelledby="patient-activity-title"><h2 id="patient-activity-title">{t("graduation.activity")}</h2><p>{t("graduation.activityHint")}</p><div className="activity-filters segmented" role="group" aria-label={t("graduation.activity")}>{(["all","measurement","dose","habit"] as const).map(value=><Button key={value} variant="ghost" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{t(value==="all"?"graduation.all":value==="measurement"?"graduation.readings":value==="dose"?"graduation.doses":"graduation.habits")}</Button>)}</div>
 {activity.isPending&&<Feedback kind="loading">{t("doctor.loadingRecord")}</Feedback>}{activity.isError&&<Feedback kind="error" action={<Button variant="secondary" onClick={()=>void activity.refetch()}>{t("common.actions.retry")}</Button>}>{t("graduation.loadFailed")}</Feedback>}
 {!events.length&&!activity.isPending&&!activity.isError&&<p>{t("graduation.noActivity")}</p>}
 {[...groups.entries()].map(([day,items])=><div key={day} className="activity-day"><h3><time dateTime={day}>{formatDate(day+"T12:00:00",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</time></h3><ol>{items.map(item=>{const Icon=item.kind==="measurement"?HeartPulse:item.kind==="dose"?Pill:Footprints;return <li key={item.id}><Icon size={20} aria-hidden="true" /><details><summary><span><strong><bdi>{item.title}</bdi></strong><time dateTime={item.recordedAt}>{formatDateTime(item.recordedAt)}</time></span><ChevronDown size={17} aria-hidden="true" /></summary><div className="activity-detail"><p><bdi>{item.detail}</bdi></p>{item.scheduledTime&&<p>{t("graduation.scheduled")}: <bdi>{item.scheduledTime}</bdi></p>}<p>{t("graduation.activityDay")}: <bdi>{day}</bdi></p>{item.kind==="measurement"&&<p>{t("graduation.measurementDetails")}</p>}</div></details></li>;})}</ol></div>)}
 </section>;
}

export function PatientPeriodComparison({record}:{record:DoctorPatientRecord}){
 const {t,formatNumber,formatDate}=useI18n();const now=new Date();const previous=new Date(now);previous.setDate(previous.getDate()-7);previous.setHours(23,59,59,999);
 const periods=[summarizeReport(record.measurements,7,now),summarizeReport(record.measurements,7,previous)];
 const date=(value:string)=>formatDate(value+"T12:00:00",{day:"numeric",month:"short",year:"numeric"});
 return <section className="patient-period-comparison" aria-labelledby="period-comparison-title"><h2 id="period-comparison-title">{t("graduation.compare")}</h2><p>{t("graduation.compareHint")}</p><div className="comparison-periods">{periods.map(period=><section key={period.from}><h3><time dateTime={period.from}>{date(period.from)}</time> — <time dateTime={period.to}>{date(period.to)}</time></h3><p>{t("graduation.readingCount",{count:formatNumber(period.measurements.length)})}</p><dl><div><dt>{t("graduation.pressureMean")}</dt><dd>{period.pressure.count?<bdi dir="ltr">{formatNumber(period.pressure.systolic!)}/{formatNumber(period.pressure.diastolic!)} mmHg</bdi>:t("graduation.missing")}</dd><small>{t("graduation.readingCount",{count:formatNumber(period.pressure.count)})}</small></div><div><dt>{t("graduation.glucoseMean")}</dt><dd>{period.glucose.count?<bdi dir="ltr">{formatNumber(period.glucose.average!)} mg/dL</bdi>:t("graduation.missing")}</dd><small>{t("graduation.readingCount",{count:formatNumber(period.glucose.count)})}</small></div></dl></section>)}</div></section>;
}

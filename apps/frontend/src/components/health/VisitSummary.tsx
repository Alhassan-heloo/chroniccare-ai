import {Printer} from "lucide-react";
import {useAuth} from "@/auth/context";
import {useI18n} from "@/i18n/context";
import {Button} from "@/components/ui/Button";
import type {PatientReport} from "@/lib/types/report";
import {measurementValue} from "@/lib/utils/measurementFilters";

export function VisitSummary({data}:{data:PatientReport}) {
 const {user}=useAuth();const {t,formatNumber,formatDateTime,formatDate}=useI18n();
 const date=(value:string)=>formatDate(value+"T12:00:00",{day:"numeric",month:"long",year:"numeric"});
 return <article className="visit-summary" aria-labelledby="visit-summary-title"><header><div><h2 id="visit-summary-title">{t("graduation.visit")}</h2><p>{t("graduation.visitHint")}</p></div><Button className="print-summary" variant="secondary" onClick={()=>window.print()}><Printer size={18} aria-hidden="true" />{t("graduation.print")}</Button></header>
 <dl className="visit-facts"><div><dt>{t("graduation.patient")}</dt><dd><bdi>{user?.name ?? "—"}</bdi></dd></div><div><dt>{t("graduation.range")}</dt><dd>{date(data.from)} — {date(data.to)}</dd></div><div><dt>{t("graduation.count")}</dt><dd>{formatNumber(data.measurements.length)}</dd></div><div><dt>{t("graduation.generated")}</dt><dd>{formatDateTime(new Date().toISOString())}</dd></div></dl>
 <dl className="visit-means"><div><dt>{t("graduation.pressureMean")}</dt><dd>{data.pressure.count?<bdi dir="ltr">{formatNumber(data.pressure.systolic!)}/{formatNumber(data.pressure.diastolic!)} mmHg</bdi>:t("graduation.missing")}</dd><small>{t("graduation.readingCount",{count:formatNumber(data.pressure.count)})}</small></div><div><dt>{t("graduation.glucoseMean")}</dt><dd>{data.glucose.count?<bdi dir="ltr">{formatNumber(data.glucose.average!)} mg/dL</bdi>:t("graduation.missing")}</dd><small>{t("graduation.readingCount",{count:formatNumber(data.glucose.count)})}</small></div></dl>
 <p>{t("graduation.todayOnly")}</p><p>{t("doctor.dosesSummary",{taken:formatNumber(data.medicationToday.taken),total:formatNumber(data.medicationToday.total)})} · {t("doctor.habitsSummary",{completed:formatNumber(data.habitsToday.completed),total:formatNumber(data.habitsToday.total)})}</p>
 <h3>{t("graduation.readings")}</h3>{data.measurements.length?<ul className="visit-reading-list">{data.measurements.map(item=><li key={item.id}><span>{t(item.kind==="bloodPressure"?"measurements.bloodPressure":"measurements.bloodGlucose")}{item.isExample&&<small> · {t("graduation.example")}</small>}</span><bdi dir="ltr">{measurementValue(item)} {item.kind==="bloodPressure"?"mmHg":"mg/dL"}</bdi><time dateTime={item.recordedAt}>{formatDateTime(item.recordedAt)}</time></li>)}</ul>:<p>{t("graduation.missing")}</p>}
 </article>;
}

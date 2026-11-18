import {useState} from "react";
import {Link} from "react-router";
import {ArrowUpRight,Activity,FileChartColumn} from "lucide-react";
import {useI18n} from "@/i18n/context";
import type {Measurement} from "@/lib/types/measurement";
import {localDateKey} from "@/lib/utils/measurementFilters";

export function PatientWeek({readings}:{readings:Measurement[]}) {
  const {t,formatNumber,formatDate}=useI18n();
  const [selected,setSelected]=useState("");
  const days=Array.from({length:7},(_,index)=>{const day=new Date();day.setHours(12,0,0,0);day.setDate(day.getDate()-6+index);const key=localDateKey(day.toISOString());return {key,date:day.toISOString(),count:readings.filter(item=>localDateKey(item.recordedAt)===key).length};});
  return <section className="patient-week" aria-labelledby="patient-week-title"><header><div><h2 id="patient-week-title">{t("graduation.week")}</h2><p>{t("graduation.weekHint")}</p></div><Activity className="week-pulse" size={36} aria-hidden="true" /></header><div className="week-days">{days.map(day=><Link key={day.key} data-day={day.key} aria-current={selected===day.key?"date":undefined} onClick={()=>setSelected(day.key)} to={`/patient/measurements?day=${day.key}`}><time dateTime={day.key}><strong>{formatDate(day.date,{weekday:"short"})}</strong><span>{formatDate(day.date,{day:"numeric",month:"short"})}</span></time><span>{day.count?t("graduation.readingCount",{count:formatNumber(day.count)}):t("graduation.noReadings")}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div></section>;
}

export function PatientShortcuts(){
 const {t}=useI18n();
 return <section className="patient-shortcuts" aria-labelledby="patient-shortcuts-title"><h2 id="patient-shortcuts-title">{t("graduation.shortcuts")}</h2><nav aria-labelledby="patient-shortcuts-title"><Link className="btn btn-secondary" to="/patient/measurements"><Activity size={18} aria-hidden="true" />{t("patient.workspace.records")}</Link><Link className="btn btn-secondary" to="/patient/reports?visit=1"><FileChartColumn size={18} aria-hidden="true" />{t("graduation.visit")}</Link></nav></section>;
}

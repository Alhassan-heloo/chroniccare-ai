// Adapted from approved Living 3.3. Preview state never writes to patient stores.
import { useId, useState } from 'react';
import { ArrowDownLeft, ArrowDownRight, Bot, Check, ChevronDown, Droplets, FileChartColumn, Footprints, Pill, Plus, Undo2, type LucideIcon } from 'lucide-react';
import type { Copy } from './presentation';
import { reportSummary, type Locale, type Reading } from './model';
import { Button, ContextHelp, Sample, ValueArrival } from './ui';

export interface RoutineProps {
  c:Copy;l:Locale;doses:boolean[];onDose:(index:number)=>void;
  water:number;onWater:()=>void;steps:number;onSteps:()=>void;
  canUndoWater:boolean;onUndoWater:()=>void;canUndoSteps:boolean;onUndoSteps:()=>void;
}
export function MedicationPanel({c,l,doses,onDose,id}:Pick<RoutineProps,'c'|'l'|'doses'|'onDose'>&{id?:string}) {
  return <section id={id} className="medication-panel glass">
    <div className="panel-heading"><span className="panel-icon"><Pill size={20} aria-hidden="true"/></span><h2>{c.medication}</h2><Sample c={c}/></div>
    <p className="panel-note">{c.medicationNote}</p>
    <div className="dose-timeline">{doses.map((taken,i)=><div className={`dose-row ${taken?'dose-taken':''}`} key={i}>
      <time className="dose-time" dir="ltr">{l.time(i?20:8)}</time>
      <div><strong>{c.medicationName}</strong><span className="dose-status">{taken?c.doseRecorded:c.dosePending}</span></div>
      <Button className="dose-action" variant="secondary" aria-pressed={taken} onClick={()=>onDose(i)}>{taken?<Check size={15} aria-hidden="true"/>:<Plus size={15} aria-hidden="true"/>}{taken?c.undoDose:c.recordDose}</Button>
    </div>)}</div>
    <div className="dose-adherence"><p className="dose-summary" role="status">{l.message("public.living.doses",{taken:l.n(doses.filter(Boolean).length),total:l.n(doses.length)})}</p><progress value={doses.filter(Boolean).length} max={doses.length} aria-label={c.medication}/></div>
  </section>;
}
function HabitLine({c,l,title,Icon,value,target,unit,action,onAdd,canUndo,onUndo,className}:{c:Copy;l:Locale;title:string;Icon:LucideIcon;value:number;target:number;unit:'cups'|'steps';action:string;onAdd:()=>void;canUndo:boolean;onUndo:()=>void;className:string}) {
  const sentence=l.message("public.living.progress",{value:l.n(value),target:l.n(target),unit:l.unit(unit,target)});
  return <div className="habit-line">
    <div className="habit-overview"><span className="habit-ring" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={target} aria-valuenow={value} aria-valuetext={sentence}><svg className="ring-drawing" viewBox="0 0 64 64" aria-hidden="true"><circle className="ring-track" cx="32" cy="32" r="27"/><circle className="ring-value" cx="32" cy="32" r="27" pathLength={100} strokeDasharray={100} strokeDashoffset={100-value/target*100}/></svg><Icon size={20} aria-hidden="true"/></span><div><div className="habit-name"><strong>{title}</strong></div><p className="habit-sentence" role="status" aria-atomic="true"><ValueArrival value={sentence}/></p></div></div>
    <div className="habit-actions"><Button className={className} variant="quiet" disabled={value>=target} onClick={onAdd}><Plus size={15} aria-hidden="true"/>{action}</Button><Button className="habit-undo" variant="quiet" disabled={!canUndo} onClick={onUndo} aria-label={l.message("public.living.undoHabit",{habit:title})}><Undo2 size={15} aria-hidden="true"/>{c.undo}</Button></div>
  </div>;
}
export function HabitsPanel({c,l,water,onWater,steps,onSteps,canUndoWater,onUndoWater,canUndoSteps,onUndoSteps,id}:Pick<RoutineProps,'c'|'l'|'water'|'onWater'|'steps'|'onSteps'|'canUndoWater'|'onUndoWater'|'canUndoSteps'|'onUndoSteps'>&{id?:string}) {
  return <section id={id} className="habits-panel glass"><div className="panel-heading"><span className="panel-icon aqua"><Footprints size={20} aria-hidden="true"/></span><h2>{c.habits}</h2><ContextHelp label={c.habitGoals}>{c.goalNote}</ContextHelp></div>
    <HabitLine c={c} l={l} title={c.water} Icon={Droplets} value={water} target={8} unit="cups" action={c.addCup} onAdd={onWater} canUndo={canUndoWater} onUndo={onUndoWater} className="water-action"/>
    <HabitLine c={c} l={l} title={c.walking} Icon={Footprints} value={steps} target={10000} unit="steps" action={c.addSteps} onAdd={onSteps} canUndo={canUndoSteps} onUndo={onUndoSteps} className="steps-action"/>
  </section>;
}
export function ReportPanel({c,l,readings,initialPeriod=7,compact=false}:{c:Copy;l:Locale;readings:Reading[];initialPeriod?:number;compact?:boolean}) {
  const [period,setPeriod]=useState(initialPeriod),[expanded,setExpanded]=useState(!compact),id=useId(),summary=reportSummary(readings,period);
  const first=summary.selected[0],last=summary.selected.at(-1);
  return <div className="report-panel"><div className="report-toolbar"><div><span className="overline"><FileChartColumn size={16} aria-hidden="true"/>{c.reports}</span><h3>{l.message("public.living.readingCount",{count:l.n(summary.count)})}</h3></div><label htmlFor={id}>{c.period}<select id={id} value={period} onChange={event=>setPeriod(Number(event.target.value))}><option value={3}>{c.threeDays}</option><option value={7}>{c.sevenDays}</option></select></label></div>
    {first&&last&&<p className="report-dateline">{l.message("public.living.dateRange",{from:l.date(first.date),to:l.date(last.date)})}</p>}
    <div className="report-averages"><div><span>{c.avgPressure}</span><strong dir="ltr"><ValueArrival value={l.n(summary.systolic)}/><small>mmHg</small></strong></div><div><span>{c.avgGlucose}</span><strong dir="ltr"><ValueArrival value={l.n(summary.glucose)}/><small>mg/dL</small></strong></div></div>
    <div className="report-context"><p className="panel-note">{c.descriptive}</p><ContextHelp label={c.averageHelpTitle}>{c.averageHelp}</ContextHelp></div>
    <details className="report-details" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary><span>{expanded?c.hideLedger:c.viewLedger}</span><ChevronDown size={16} aria-hidden="true"/></summary><div className="report-ledger" role="region" aria-label={c.reportRecordLabel}>{summary.selected.map(row=><div className="ledger-row" key={row.id}><time dateTime={row.date}>{l.date(row.date)}</time><bdi>{l.n(row.systolic)}/{l.n(row.diastolic)} <small>mmHg</small></bdi><bdi>{l.n(row.glucose)} <small>mg/dL</small></bdi></div>)}</div></details><Sample c={c}/>
  </div>;
}
export function AssistantPanel({c,id='assistant-preview'}:{c:Copy;id?:string}) {
  const [question,setQuestion]=useState('one'),selectId=useId();
  return <details id={id} className="assistant-panel glass"><summary><span className="assistant-symbol"><Bot size={23} aria-hidden="true"/></span><span><strong>{c.assistant}</strong><small>{c.assistantStatus}</small></span><span className="assistant-expand">{c.expandAssistant}</span><ChevronDown size={19} aria-hidden="true"/></summary><div className="assistant-body"><p>{c.assistantBody}</p><label htmlFor={selectId}>{c.question}<select id={selectId} value={question} onChange={event=>setQuestion(event.target.value)}><option value="one">{c.questionOne}</option><option value="two">{c.questionTwo}</option></select></label><blockquote>{question==='one'?c.questionOne:c.questionTwo}</blockquote><p className="no-response">{c.noResponse}</p></div></details>;
}
export function SceneArrow({rtl}:{rtl:boolean}) {const Icon=rtl?ArrowDownLeft:ArrowDownRight;return <Icon className="scene-arrow" size={52} strokeWidth={1} aria-hidden="true"/>;}

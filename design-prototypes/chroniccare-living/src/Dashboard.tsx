import { Activity, Bot, FileChartColumn, Plus, SlidersHorizontal } from 'lucide-react';
import { HealthCanvas, type CanvasProps } from './HealthCanvas';
import { AssistantPanel, HabitsPanel, MedicationPanel, ReportLink, type RoutineProps } from './Panels';
import { Button } from './ui';
import { scrollToSection, useActiveSection } from './useActiveSection';

const sections=['canvas','dashboard-routine'] as const;

export function Dashboard({c,l,readings,kind,onKind,doses,onDose,water,onWater,steps,onSteps,canUndoWater,onUndoWater,canUndoSteps,onUndoSteps,onAdd,onReport}:CanvasProps&RoutineProps&{onAdd:()=>void;onReport:()=>void}) {
  const area=useActiveSection(sections)??'canvas';
  const latest=readings[readings.length-1];
  const section=scrollToSection;
  return <div className="dashboard-experience">
    <nav className="workspace-dock glass" aria-label={c.navigation}><button type="button" className={area==='canvas'?'active':''} aria-current={area==='canvas'?'location':undefined} aria-label={c.canvasNav} title={c.canvasNav} onClick={()=>section('canvas')}><Activity aria-hidden="true"/><span>{c.canvasShort}</span></button><button type="button" className={area==='dashboard-routine'?'active':''} aria-current={area==='dashboard-routine'?'location':undefined} aria-label={c.routineNav} title={c.routineNav} onClick={()=>section('dashboard-routine')}><SlidersHorizontal aria-hidden="true"/><span>{c.routineShort}</span></button><button type="button" aria-label={c.reportNav} title={c.reportNav} onClick={onReport}><FileChartColumn aria-hidden="true"/><span>{c.reportsShort}</span></button><button type="button" className="dock-add" aria-label={c.add} onClick={onAdd}><Plus aria-hidden="true"/><span>{c.addShort}</span></button></nav>
    <div className="workspace-heading"><div><span className="eyebrow">{c.workspaceLabel}</span><h1 tabIndex={-1}>{c.welcome}</h1><p>{c.welcomeBody}</p></div><div className="workspace-date"><strong className="today-label">{c.today}</strong>{latest&&<time dateTime={latest.date}>{l.fullDate(latest.date)}</time>}<span>{c.profile}</span></div></div>
    <div id="canvas" className="canvas-actions"><span><span className="precision-dot"/>{c.week}</span><Button className="add-reading" onClick={onAdd}><Plus size={18} aria-hidden="true"/>{c.add}</Button></div>
    <div className="adaptive-canvas"><div className="primary-workspace"><HealthCanvas c={c} l={l} readings={readings} kind={kind} onKind={onKind}/></div><aside id="dashboard-routine" className="daily-orbit" aria-label={c.routineNav}><MedicationPanel c={c} l={l} doses={doses} onDose={onDose}/><HabitsPanel c={c} l={l} water={water} onWater={onWater} steps={steps} onSteps={onSteps} canUndoWater={canUndoWater} onUndoWater={onUndoWater} canUndoSteps={canUndoSteps} onUndoSteps={onUndoSteps}/></aside><div className="workspace-bottom"><ReportLink c={c} onClick={onReport}/><AssistantPanel c={c} id="workspace-assistant"/></div></div>
    <div className="workspace-disclosure"><Bot size={18} aria-hidden="true"/><span>{c.temporary}</span></div>
    <p className="workspace-footnote">{c.fictional}</p>
  </div>;
}

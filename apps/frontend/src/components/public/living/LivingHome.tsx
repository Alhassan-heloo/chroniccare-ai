// Adapted from approved Living 3.3. Preview state never writes to patient stores.
import { ArrowDown, Bot, FileChartColumn, Footprints, HeartPulse, MoveDown, Pill } from 'lucide-react';
import { HealthCanvas, type CanvasProps } from './HealthCanvas';
import { AssistantPanel, HabitsPanel, MedicationPanel, ReportPanel, SceneArrow, type RoutineProps } from './Panels';
import { Arrow, Button, ReadingSignature, SectionMarker, SignatureArtwork, StoryBridge, ValueArrival } from './ui';
import { type Language } from './model';
import { scrollToSection, useActiveSection } from './useActiveSection';

const sections=['weekly-scene','medication-scene','habits-scene','report-scene','assistant-scene'] as const;

export function LivingHome({c,l,readings,kind,onKind,language,onDashboard,onAccount,...routine}:CanvasProps&RoutineProps&{language:Language;onDashboard:()=>void;onAccount:()=>void}) {
  const active=useActiveSection(sections);
  const values=readings.map(row=>kind==='pressure'?row.systolic:row.glucose);
  // A zero baseline represents small differences honestly; this is display scale only.
  const ceiling=Math.max(20,Math.ceil(Math.max(...values)/20)*20);
  const index=[
    {id:'weekly-scene',label:c.canvasShort,name:c.canvas,Icon:HeartPulse,tone:'pressure'},
    {id:'medication-scene',label:c.medicationShort,name:c.medication,Icon:Pill,tone:'medication'},
    {id:'habits-scene',label:c.habitsShort,name:c.habits,Icon:Footprints,tone:'habits'},
    {id:'report-scene',label:c.reports,name:c.reports,Icon:FileChartColumn,tone:'reports'},
    {id:'assistant-scene',label:c.assistantShort,name:c.assistant,Icon:Bot,tone:'assistant'},
  ];
  const explore=scrollToSection;
  return <div className="home-experience">
    <section className="immersive-intro" aria-labelledby="home-title">
      <SignatureArtwork/>
      <div className="intro-copy"><ReadingSignature/><span className="eyebrow"><span className="tiny-line"/>{c.heroLabel}</span><h1 id="home-title" tabIndex={-1}>{c.heroTitle}{' '}<span>{c.heroAccent}</span></h1><p>{c.productSummary}</p></div>
      <nav className="experience-index" aria-label={c.explore}>{index.map(({id,label,name,Icon,tone})=><button type="button" className={`tone-${tone}`} key={id} aria-label={name} aria-current={active===id?'location':undefined} aria-controls={id} onClick={()=>explore(id)}><Icon size={17} aria-hidden="true"/>{label}</button>)}</nav>
      <div className="intro-workspace" id="product-preview">
        <div className="intro-tag"><HeartPulse size={17} aria-hidden="true"/><span>{c.prototype}</span><span className="intro-tag-line"/><span className="canvas-name">{c.canvasIdentity} <b dir="ltr">3.3</b></span></div>
        <HealthCanvas c={c} l={l} readings={readings} kind={kind} onKind={onKind} compact/>
        <div className="intro-bottom"><p>{c.fictional}</p><Button className="enter-space" onClick={onDashboard}>{c.openSpace}<Arrow rtl={language==='ar'}/></Button><button type="button" className="scroll-cue" onClick={()=>explore('weekly-scene')}>{c.scroll}<MoveDown size={17} aria-hidden="true"/></button></div>
      </div>
    </section>
    <div id="story" className="story-sequence">
      <section id="weekly-scene" className="scene weekly-scene reveal tone-pressure" aria-labelledby="week-title">
        <StoryBridge/>
        <div className="scene-copy"><SectionMarker label={c.weeklyLabel} icon={HeartPulse}/><h2 id="week-title">{c.weeklyTitle}</h2><p>{c.weeklyBody}</p><SceneArrow rtl={language==='ar'}/></div>
        <div className="week-lens glass"><div className="week-lens-heading"><span>{l.message("public.living.dayCount",{count:l.n(readings.length)})}</span><div className="measurement-switch" role="group" aria-label={c.chooseType}><button type="button" aria-pressed={kind==='pressure'} onClick={()=>onKind('pressure')}>{c.pressure}</button><button type="button" aria-pressed={kind==='glucose'} onClick={()=>onKind('glucose')}>{c.glucose}</button></div></div>
          <div className="week-scale"><span>{c.zeroBaseline}</span><bdi>{l.n(0)} — {l.n(ceiling)} {kind==='pressure'?'mmHg':'mg/dL'}</bdi></div>
          <div className="week-ribbon" dir="ltr">{readings.map((row,i)=><div className="week-column" key={row.id}><span className="week-column-value"><ValueArrival value={l.n(values[i]??0)}/></span><div className="week-bar-track"><span style={{transform:`scaleY(${(values[i]??0)/ceiling})`}}/></div><span>{l.date(row.date)}</span></div>)}</div>
          <div className="week-lens-footer"><span>{kind==='pressure'?c.systolic:c.glucose}</span><bdi>{kind==='pressure'?'mmHg':'mg/dL'}</bdi><span>{c.sample}</span></div>
        </div>
      </section>
      <section id="workflow" className="scene routine-scene reveal tone-habits" aria-labelledby="routine-title">
        <StoryBridge/>
        <div className="scene-copy"><SectionMarker label={c.routineLabel} icon={Footprints}/><h2 id="routine-title">{c.routineTitle}</h2><p>{c.routineBody}</p></div>
        <div className="routine-composition"><div className="routine-item"><MedicationPanel id="medication-scene" c={c} l={l} {...routine}/></div><div className="routine-item"><HabitsPanel id="habits-scene" c={c} l={l} {...routine}/></div></div>
      </section>
      <section id="report-scene" className="scene reports-scene reveal tone-reports" aria-labelledby="report-title">
        <StoryBridge/>
        <div className="scene-copy"><SectionMarker label={c.reportsLabel} icon={FileChartColumn}/><h2 id="report-title">{c.reportsTitle}</h2><p>{c.reportsBody}</p><Button variant="secondary" onClick={onDashboard}>{c.openSpace}<Arrow rtl={language==='ar'}/></Button></div><div className="report-sheet glass"><span className="sheet-binding" aria-hidden="true"/><ReportPanel c={c} l={l} readings={readings} compact/></div>
      </section>
      <section id="assistant-scene" className="scene assistant-scene reveal tone-assistant" aria-labelledby="assistant-title">
        <StoryBridge/>
        <div className="scene-copy"><SectionMarker label={c.assistantLabel} icon={Bot}/><h2 id="assistant-title">{c.assistantTitle}</h2><p>{c.assistantBody}</p></div><div className="assistant-composition"><AssistantPanel c={c}/><span className="assistant-annotation"><ArrowDown size={16} aria-hidden="true"/>{c.noResponse}</span></div>
      </section>
    </div>
    <section className="closing-line reveal"><ReadingSignature/><div><span className="eyebrow"><bdi>ChronicCare AI</bdi> / {c.interfaceLabel}</span><h2>{c.closingTitle}</h2><p>{c.closingBody}</p></div><div className="closing-actions"><Button onClick={onDashboard}>{c.openSpace}<Arrow rtl={language==='ar'}/></Button><Button variant="quiet" onClick={onAccount}>{c.accessTitle}</Button></div></section>
  </div>;
}

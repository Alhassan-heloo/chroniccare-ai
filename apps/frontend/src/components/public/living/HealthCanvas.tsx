// Adapted from approved Living 3.3. Preview state never writes to patient stores.
import { useId, useRef, useState } from 'react';
import { Activity, Droplet, HeartPulse, MoveHorizontal } from 'lucide-react';
import type { Copy } from './presentation';
import { type Kind, type Locale, type Reading } from './model';
import { ContextHelp, LivingPulse, Sample, ValueArrival } from './ui';
import { useCanvasLight } from './useLivingMotion';

export interface CanvasProps {c:Copy;l:Locale;readings:Reading[];kind:Kind;onKind:(kind:Kind)=>void}
function curve(points:{x:number;y:number}[]) {return points.map((point,index)=>{const previous=points[index-1];return !previous?`M${point.x},${point.y}`:`C${(previous.x+point.x)/2},${previous.y} ${(previous.x+point.x)/2},${point.y} ${point.x},${point.y}`;}).join(' ');}

export function HealthCanvas(props:{compact?:boolean}&CanvasProps) {
  const latest=props.readings.at(-1);
  // An added demo reading returns focus to the latest day; preferences do not reset selection.
  return <InteractiveCanvas key={latest?`${latest.systolic}/${latest.diastolic}/${latest.glucose}`:'empty'} {...props}/>;
}
function InteractiveCanvas({c,l,readings,kind,onKind,compact=false}:{compact?:boolean}&CanvasProps) {
  const [selected,setSelected]=useState(6);
  const canvasRef=useCanvasLight();
  const id=useId().replace(/:/g,''),refs=useRef<(HTMLButtonElement|null)[]>([]);
  const index=Math.min(selected,readings.length-1),active=readings[index],latest=readings[readings.length-1];
  if(!active||!latest)return null;
  const values=readings.flatMap(row=>kind==='pressure'?[row.systolic,row.diastolic]:[row.glucose]);
  const low=Math.floor((Math.min(...values)-10)/10)*10,high=Math.ceil((Math.max(...values)+10)/10)*10;
  const y=(value:number)=>235-(value-low)/(high-low)*210;
  const x=(position:number)=>40+position*920/Math.max(1,readings.length-1);
  const points=readings.map((row,i)=>({x:x(i),y:y(kind==='pressure'?row.systolic:row.glucose)}));
  const mainPath=curve(points),other=curve(readings.map((row,i)=>({x:x(i),y:y(row.diastolic)})));
  const selectedPoint=points[index]??{x:960,y:100};
  const valueText=kind==='pressure'?`${l.n(active.systolic)} / ${l.n(active.diastolic)}`:l.n(active.glucose);
  const latestValue=kind==='pressure'?l.n(latest.glucose):`${l.n(latest.systolic)} / ${l.n(latest.diastolic)}`;
  return <section ref={canvasRef} className={`health-canvas glass ${compact?'compact-canvas':''}`} data-kind={kind} aria-label={c.canvas}>
    <div className="canvas-light" aria-hidden="true"/>
    <LivingPulse cue={kind}/>
    <header className="canvas-heading"><div className="canvas-title"><span className="overline"><Activity size={15} aria-hidden="true"/>{c.canvas}</span><p>{c.canvasCaption}</p></div><div className="canvas-tools"><div className="measurement-switch" role="group" aria-label={c.chooseType}><button type="button" aria-pressed={kind==='pressure'} onClick={()=>onKind('pressure')}><HeartPulse size={17} aria-hidden="true"/>{c.pressure}</button><button type="button" aria-pressed={kind==='glucose'} onClick={()=>onKind('glucose')}><Droplet size={17} aria-hidden="true"/>{c.glucose}</button></div><ContextHelp label={c.readingHelpTitle}>{c.readingHelp}</ContextHelp></div></header>
    <div className="canvas-readout"><div className="selected-reading" aria-live="polite" aria-atomic="true"><span className="metric-kind">{kind==='pressure'?<HeartPulse size={17} aria-hidden="true"/>:<Droplet size={17} aria-hidden="true"/>}{kind==='pressure'?c.pressure:c.glucose}</span><strong className="reading-value" dir="ltr"><ValueArrival value={valueText}/><small>{kind==='pressure'?'mmHg':'mg/dL'}</small></strong><span>{c.current} <span className="reading-date">/ {l.date(active.date)}</span></span></div><div className="latest-glucose"><span className="metric-kind">{kind==='pressure'?<Droplet size={17} aria-hidden="true"/>:<HeartPulse size={17} aria-hidden="true"/>}{kind==='pressure'?c.glucose:c.pressure}</span><strong dir="ltr"><ValueArrival value={latestValue}/><small>{kind==='pressure'?'mg/dL':'mmHg'}</small></strong><span className="mini-label">{c.latest}<span className="reading-date"> / {l.date(latest.date)}</span></span></div><div className="canvas-provenance"><span className="canvas-window">{l.message("public.living.dayCount",{count:l.n(readings.length)})}</span><Sample c={c}/></div></div>
    <div className="chart-frame" dir="ltr">
      <div className="chart-scale" aria-hidden="true"><span>{l.n(high)}</span><span>{l.n((low+high)/2)}</span><span>{l.n(low)}</span></div>
      <div className="chart-plot" onPointerMove={event=>{if(event.pointerType==='touch')return;const rect=event.currentTarget.getBoundingClientRect();setSelected(Math.max(0,Math.min(readings.length-1,Math.round(((event.clientX-rect.left)/rect.width*1000-40)/920*(readings.length-1)))));}}>
        <svg viewBox="0 0 1000 260" preserveAspectRatio="none" role="img" aria-label={c.chart}>
          <defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--line)" stopOpacity=".2"/><stop offset="100%" stopColor="var(--line)" stopOpacity="0"/></linearGradient><linearGradient id={`${id}-lens`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--line)" stopOpacity=".005"/><stop offset=".5" stopColor="var(--line)" stopOpacity=".085"/><stop offset="1" stopColor="var(--line)" stopOpacity=".01"/></linearGradient></defs>
          <rect className="chart-focus-lens" x="0" y="14" width="78" height="232" rx="16" fill={`url(#${id}-lens)`} style={{transform:`translateX(${selectedPoint.x-39}px)`}}/>
          <path className="chart-day-grid" d={points.map(point=>`M${point.x} 25V235`).join('')}/>
          <path className="chart-grid" d="M40 25H960M40 130H960M40 235H960"/>
          <g className="chart-series"><path className="chart-area" d={`${mainPath}L960,260L40,260Z`} style={{d:`path('${mainPath}L960,260L40,260Z')`}} fill={`url(#${id}-area)`}/><path className="chart-line main-line" d={mainPath} style={{d:`path('${mainPath}')`}} pathLength={1} vectorEffect="non-scaling-stroke"/><path className="chart-line secondary-line" d={other} style={{d:`path('${other}')`,opacity:kind==='pressure'?1:0}} vectorEffect="non-scaling-stroke"/></g>
          <path className="chart-cursor" d="M0 15V250" style={{transform:`translateX(${selectedPoint.x}px)`}}/>
        </svg>
        <div className="chart-tooltip" style={{left:`${Math.max(17,Math.min(83,selectedPoint.x/10))}%`}} aria-hidden="true"><span>{kind==='pressure'?c.pressure:c.glucose} · {l.date(active.date)}</span><strong>{valueText} <small>{kind==='pressure'?'mmHg':'mg/dL'}</small></strong></div>
        {points.map((point,i)=><button type="button" className={`chart-point ${i===index?'selected':''}`} key={readings[i]?.id??i} ref={element=>{refs.current[i]=element;}} style={{left:`${point.x/10}%`,top:`${point.y/260*100}%`}} aria-pressed={index===i} aria-label={l.message("public.living.point",{date:l.date(readings[i]?.date??active.date),value:kind==='pressure'?`${l.n(readings[i]?.systolic??0)}/${l.n(readings[i]?.diastolic??0)} mmHg`:`${l.n(readings[i]?.glucose??0)} mg/dL`})} tabIndex={index===i?0:-1} onClick={()=>setSelected(i)} onFocus={()=>setSelected(i)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?readings.length-1:(i+(event.key==='ArrowRight'?1:-1)+readings.length)%readings.length;setSelected(next);refs.current[next]?.focus();}}><span/></button>)}
      </div>
    </div>
    <div className="chart-dates" dir="ltr">{readings.map((row,i)=><span key={row.id} className={`${i===0||i===3||i===readings.length-1?'key-date':''} ${i===index?'date-selected':''}`}>{l.date(row.date)}</span>)}</div>
    <label className="chart-range"><span><MoveHorizontal size={15} aria-hidden="true"/>{c.selectReading}</span><input type="range" min={0} max={readings.length-1} step={1} value={index} dir="ltr" onChange={event=>setSelected(Number(event.target.value))}/></label>
    <div className="canvas-footer"><div className="chart-legend"><span><i/>{kind==='pressure'?c.systolic:c.glucose}</span>{kind==='pressure'&&<span><i className="secondary-dot"/>{c.diastolic}</span>}</div></div>
    <details className="reading-table"><summary>{c.textReadings}</summary><table><caption className="sr-only">{c.chart}</caption><thead><tr><th scope="col">{c.day}</th><th scope="col">{c.pressure}</th><th scope="col">{c.glucose}</th></tr></thead><tbody>{readings.map(row=><tr key={row.id}><td><time dateTime={row.date}>{l.date(row.date)}</time></td><td><bdi>{l.n(row.systolic)}/{l.n(row.diastolic)}</bdi><small> mmHg</small></td><td><bdi>{l.n(row.glucose)}</bdi><small> mg/dL</small></td></tr>)}</tbody></table></details>
  </section>;
}

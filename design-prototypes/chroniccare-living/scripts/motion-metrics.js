// Opt-in production diagnostics, never bundled into the normal application.
// All counters are scoped to the SAME explicit window. No synthetic UI actions.
import {clsMaximum,frameSummary,insideWindow,percentile,round} from './motion-statistics.mjs';
const supported=PerformanceObserver.supportedEntryTypes,observers=[];
let sample=null,raf=0,last=0;
const collect=(key,entry)=>{if(sample&&insideWindow(entry,sample.start,sample.end))sample[key].push(entry);};
function observe(type,key,extra={}){
  if(!supported.includes(type))return;
  const observer=new PerformanceObserver(list=>list.getEntries().forEach(entry=>collect(key,entry)));
  observer.observe({type,buffered:true,...extra});observers.push({observer,key});
}
observe('longtask','tasks');observe('long-animation-frame','loafs');observe('layout-shift','shifts');
observe('event','events',{durationThreshold:16});
const mutationObserver=new MutationObserver(records=>{if(sample&&sample.end===Infinity)sample.mutations+=records.length;});
const tick=time=>{if(sample&&sample.end===Infinity){if(last)sample.frames.push(time-last);last=time;raf=requestAnimationFrame(tick);}};
const inputs=event=>{
  if(!sample||sample.end!==Infinity||event.target instanceof Element&&event.target.closest('#motion-audit'))return;
  const name=event.type==='keydown'?'key:'+event.key:event.type;sample.inputs[name]=(sample.inputs[name]??0)+1;
};
for(const event of ['click','pointermove','keydown','scroll'])addEventListener(event,inputs,{passive:true,capture:true});
addEventListener('visibilitychange',()=>{if(sample&&sample.end===Infinity)sample.visibility.push({time:performance.now(),state:document.visibilityState});});
function snapshot(){
  const main=document.querySelector('main');
  return {viewport:[innerWidth,innerHeight],language:document.documentElement.lang,direction:document.documentElement.dir,theme:document.documentElement.dataset.theme,
    motion:document.querySelector('.living-app')?.dataset.motion??null,ambient:document.querySelector('.living-app')?.dataset.ambient??null,
    route:location.hash,scrollY,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainTransform:main?getComputedStyle(main).transform:null,
    mainElements:main?.querySelectorAll('*').length??0,readings:document.querySelectorAll('.reading-table tbody tr').length,
    habitValues:[...document.querySelectorAll('.habit-ring')].map(node=>node.getAttribute('aria-valuenow')),
    cairo:document.fonts.check('16px Cairo'),fonts:document.fonts.status};
}
function loafData(entry){
  return {startTime:round(entry.startTime),duration:round(entry.duration),blockingDuration:round(entry.blockingDuration),
    renderPhaseMs:round(entry.renderStart?entry.startTime+entry.duration-entry.renderStart:0),
    scripts:entry.scripts.map(script=>({invoker:script.invoker,invokerType:script.invokerType,sourceURL:script.sourceURL,sourceFunctionName:script.sourceFunctionName,
      sourceCharPosition:script.sourceCharPosition,duration:round(script.duration),forcedStyleAndLayoutDuration:round(script.forcedStyleAndLayoutDuration)}))};
}
function mount(){
  const panel=document.createElement('aside');panel.id='motion-audit';panel.dir='ltr';
  panel.style.cssText='position:fixed;bottom:0;left:0;z-index:1000;background:#0b1320;color:white;border:1px solid #69e1d7;padding:6px;font:12px monospace;box-sizing:border-box;width:320px;max-width:100vw;height:180px';
  const label=document.createElement('input'),button=document.createElement('button'),output=document.createElement('output');
  label.id='motion-audit-label';label.setAttribute('aria-label','Performance sample label');label.value='manual';label.style.cssText='display:block;width:100%;font:inherit';
  button.textContent='Start performance sample';button.style.cssText='background:#69e1d7;color:#082c30;width:100%;white-space:nowrap;min-height:44px;padding:8px;font:inherit';
  output.id='motion-audit-result';output.dataset.status='idle';output.style.cssText='display:block;max-height:90px;overflow:auto;white-space:pre-wrap';
  button.onclick=()=>{
    if(!sample||sample.end!==Infinity){
      observers.forEach(({observer})=>observer.takeRecords());
      const before=snapshot();
      sample={label:label.value,before,start:performance.now(),end:Infinity,frames:[],tasks:[],loafs:[],shifts:[],events:[],inputs:{},mutations:0,visibility:[]};
      last=0;mutationObserver.observe(document.getElementById('root')??document.body,{subtree:true,childList:true,characterData:true,attributes:true});
      raf=requestAnimationFrame(tick);button.textContent='Finish performance sample';output.dataset.status='running';output.textContent='Sampling';
    } else {
      sample.end=performance.now();cancelAnimationFrame(raf);sample.mutations+=mutationObserver.takeRecords().length;mutationObserver.disconnect();
      observers.forEach(({observer,key})=>observer.takeRecords().forEach(entry=>collect(key,entry)));
      button.disabled=true;
      // Flush buffered records AFTER the measured window, without counting the diagnostic controls.
      setTimeout(()=>{
        const duration=sample.end-sample.start,events=sample.events.filter(entry=>entry.interactionId&&!(entry.target instanceof Element&&entry.target.closest('#motion-audit')));
        const forced=sample.loafs.flatMap(entry=>entry.scripts).reduce((sum,script)=>sum+script.forcedStyleAndLayoutDuration,0);
        output.textContent=JSON.stringify({label:sample.label,userAgent:navigator.userAgent,timeOrigin:performance.timeOrigin,startTime:round(sample.start),endTime:round(sample.end),
          viewport:[innerWidth,innerHeight],devicePixelRatio,screen:[screen.width,screen.height],visibility:document.visibilityState,visibilityChanges:sample.visibility,
          sampleMs:round(duration),...frameSummary(sample.frames,duration),clsMaxSession:round(clsMaximum(sample.shifts),6),
          longTaskCount:sample.tasks.length,maxLongTaskMs:round(Math.max(0,...sample.tasks.map(entry=>entry.duration))),
          longTaskTotalMs:round(sample.tasks.reduce((sum,entry)=>sum+entry.duration,0)),loafCount:sample.loafs.length,
          forcedStyleAndLayoutMs:round(forced),loafBlockingTotalMs:round(sample.loafs.reduce((sum,entry)=>sum+entry.blockingDuration,0)),
          loafs:sample.loafs.map(loafData),eventCount:events.length,eventP95Ms:round(percentile(events.map(entry=>entry.duration),.95)),
          processingP95Ms:round(percentile(events.map(entry=>entry.processingEnd-entry.processingStart),.95)),
          inputs:sample.inputs,domMutationRecords:sample.mutations,before:sample.before,after:snapshot(),supported},null,2);
        output.dataset.status='complete';button.disabled=false;button.textContent='Start performance sample';
      },180);
    }
  };
  panel.append(label,button,output);document.body.append(panel);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
addEventListener('pagehide',()=>{cancelAnimationFrame(raf);mutationObserver.disconnect();observers.forEach(({observer})=>observer.disconnect());});

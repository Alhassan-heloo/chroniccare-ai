// Post-process saved evidence only; never runs a browser or changes the app.
import {readFile,writeFile} from 'node:fs/promises';
import {comparableSampleDuration,percentile,round} from './motion-statistics.mjs';
const directory=new URL('../artifacts/living-3.2.1/',import.meta.url);
const load=async path=>JSON.parse(await readFile(new URL(path,directory),'utf8'));
const comparison=await load('edge-comparison/comparison.json'),mobileRepeat=await load('edge-comparison-mobile/comparison.json'),summary=[];
const comparable=[...comparison.results.filter(row=>row.width===1440),...mobileRepeat.results];
if(comparable.some(row=>!comparableSampleDuration(row.sampleMs)))throw Error('Report contains a non-comparable sample window');
for(const width of [1440,390])for(const variant of ['baseline','current']){
  const group=comparable.filter(row=>row.width===width&&row.variant===variant);
  summary.push({width,variant,repetitions:group.length,medianFrameMs:round(percentile(group.map(row=>row.frameMedianMs),.5)),medianP95Ms:round(percentile(group.map(row=>row.frameP95Ms),.5)),p95RangeMs:[Math.min(...group.map(row=>row.frameP95Ms)),Math.max(...group.map(row=>row.frameP95Ms))],totalGapsOver50ms:group.reduce((sum,row)=>sum+row.frameGapsOver50ms,0),medianCpuMs:round(percentile(group.map(row=>row.cpu.TaskDurationMs),.5)),medianStyleMs:round(percentile(group.map(row=>row.cpu.RecalcStyleDurationMs),.5)),maxCLS:Math.max(...group.map(row=>row.clsMaxSession)),windowRangeMs:[Math.min(...group.map(row=>row.sampleMs)),Math.max(...group.map(row=>row.sampleMs))]});
}
const traces=[];
for(const version of ['edge','edge-after'])for(const scenario of ['scroll','canvas-pulse','dashboard'])for(const mode of ['running','paused']){
  const {traceEvents}=await load(`${version}/trace-${scenario}-${mode}.json`);
  const main=traceEvents.find(event=>event.name==='thread_name'&&event.args.name==='CrRendererMain');
  const events=traceEvents.filter(event=>event.pid===main.pid&&event.tid===main.tid),totals={};
  for(const name of ['RunTask','FunctionCall','Layout','UpdateLayoutTree','Paint']){
    const rows=events.filter(event=>event.name===name&&event.ph==='X'&&typeof event.dur==='number');
    totals[name]={count:rows.length,totalMs:round(rows.reduce((sum,row)=>sum+row.dur,0)/1000),maxMs:round(Math.max(0,...rows.map(row=>row.dur))/1000)};
  }
  traces.push({version,scenario,mode,rendererMainThread:main.args.name,totals,styleElementVisits:events.filter(event=>event.name==='UpdateLayoutTree').reduce((sum,event)=>sum+(event.args.elementCount??0),0)});
}
const result={comparison:summary,traces,baselineBenchmark:await load('edge/summary.json'),verification:await load('edge-after/verification.json'),timingControlRepeat:await load('edge-control-repeat/control-check.json'),excludedSamples:comparison.results.filter(row=>!comparableSampleDuration(row.sampleMs)).map(row=>({label:row.label,source:'edge-comparison/'+row.label+'.json',sampleMs:row.sampleMs,classification:'NON_COMPARABLE_WINDOW',reason:'Original raw PASS predates temporal validation; retained unmodified, excluded from the report. Full mobile batch repeated.'})),notes:['Comparison: 5 paired, alternating-order trials per viewport, Motion On in both variants. Warmups excluded.','Desktop comparison uses edge-comparison. Mobile uses a complete repeat in edge-comparison-mobile after the original mobile trial 5 baseline contained an unexplained ~40-minute timing gap. Original evidence is retained, not pooled.','Median P95 = median of five within-window P95 values, NOT pooled-frame P95.','CPU deltas bracket the same measurement window; include the common sampler/automation overhead, not GPU time.','Trace diagnostics are separate single runs with extra overhead; nested event durations overlap. Do not sum event categories.','Original baseline suite completed all 100 app samples but exited with an error for the plain control page favicon.ico; see edge/resource-check.json. Corrected in diagnostic server only; subsequent probe and paired comparison passed.','Mobile baseline canvas sweeps were outside the viewport (recorded pointermove=1); mobile results describe tab and keyboard-range workload, not touch or a pointer stress test.','No runnable Living 3.1 snapshot exists: no controlled 3.1-versus-3.2 claim.']};
await writeFile(new URL('report-data.json',directory),JSON.stringify(result,null,2));
console.log(JSON.stringify({comparison:summary,verificationCases:result.verification.cases.length,interactions:result.verification.interactions.status,story:result.verification.story.status,errors:result.verification.errors},null,2));

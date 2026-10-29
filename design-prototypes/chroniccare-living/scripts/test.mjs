import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {clsMaximum,comparableSampleDuration,frameSummary,insideWindow,percentile} from './motion-statistics.mjs';

assert.equal(percentile([], .95),null);
assert.equal(percentile([30,10,20,40],.5),25);
assert(Math.abs(percentile(Array.from({length:100},(_,i)=>i),.95)-94.05)<.0001);
assert.equal(frameSummary([16,17,60],1000).frameGapsOver50ms,1);
assert.equal(frameSummary([16,17,60],1000).longFramesPerSecond,1);
assert.equal(clsMaximum([{startTime:0,value:.01},{startTime:500,value:.02},{startTime:1600,value:.04},{startTime:1700,value:1,hadRecentInput:true}]),.04);
assert.equal(clsMaximum([{startTime:0,value:.01},{startTime:1000,value:.02}]),.02);
assert.equal(insideWindow({startTime:99},100,200),false);
assert.equal(insideWindow({startTime:100},100,200),true);
assert.equal(insideWindow({startTime:200},100,200),false);
assert.equal([10,100,150,250].filter(startTime=>insideWindow({startTime},100,200)).length,2,'Prior and subsequent trials never enter this window');
for(const duration of [3900,4000,6000])assert(comparableSampleDuration(duration));
for(const duration of [NaN,Infinity,0,3899,6001,2403528.3])assert(!comparableSampleDuration(duration),'Interrupted/invalid durations must never enter a 4s comparison');

async function load(name){const source=await readFile(new URL(`../src/${name}.ts`,import.meta.url),'utf8');const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});return import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));}
const {seedReadings,applyReading,validReading,reportSummary,createLocale,message}=await load('model');
const {copy}=await load('content');
const {focusScrollDelta}=await load('focusGeometry');
// Exercise the real hook's initial OS preference in both modes, without a test-only app flag.
const motionSource=await readFile(new URL('../src/useLivingMotion.ts',import.meta.url),'utf8');
const motionOutput=ts.transpileModule(motionSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"]react['"]/g,`from '${import.meta.resolve('react')}'`);
const {useReducedMotion}=await import('data:text/javascript;base64,'+Buffer.from(motionOutput).toString('base64'));
const originalMatchMedia=globalThis.matchMedia;
try {
  for(const matches of [false,true]){
    globalThis.matchMedia=query=>({matches:query==='(prefers-reduced-motion: reduce)'&&matches});
    function MotionProbe(){return createElement('output',null,useReducedMotion()?'reduced':'running');}
    assert.equal(renderToStaticMarkup(createElement(MotionProbe)),`<output>${matches?'reduced':'running'}</output>`);
  }
} finally {if(originalMatchMedia===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=originalMatchMedia;}
const styles=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
assert(/@keyframes route-arrival\{from\{opacity:[^}]+\}to\{opacity:1\}\}/.test(styles),'Route arrival must not transform fixed descendants');
assert(/@media\(prefers-reduced-motion:reduce\).*animation:none!important;transition:none!important/.test(styles),'OS reduced motion must disable drawing, atmosphere and value transitions');
assert(styles.includes('.route-content{animation:none}'),'No stacked route and content entrance or transformed dock ancestor');
assert(styles.includes('.living-app[data-motion=paused] .motion-enter{opacity:1;transform:none}'),'Pause reveals all story beats, including unseen ones');
assert(styles.includes('.motion-enter:focus-within{opacity:1;transform:none;transition:none}'),'Keyboard focus never waits for a reveal');
assert(styles.includes('.living-app[data-ambient=rest] .aurora{animation-play-state:paused}'),'Offscreen atmosphere rests');
for(const token of ['feedback','control','surface','data','story','signature'])assert(styles.includes(`--motion-${token}:`),`Motion token: ${token}`);
const canvasSource=await readFile(new URL('../src/HealthCanvas.tsx',import.meta.url),'utf8');
assert(canvasSource.includes('<LivingPulse cue={kind}/>'),'Pointer selection must not restart the transfer signature at each point');
assert(motionSource.includes('observer.unobserve(entry.target)'),'Story beats are one-shot rather than replayed on every scroll');
assert(motionSource.includes("document.removeEventListener('visibilitychange',ambient)"),'Ambient listener cleanup');
assert(motionSource.includes("light.style.setProperty('--light-x'"),'Pointer coordinates stay on the isolated light layer');
assert(motionSource.includes("light.style.removeProperty('--light-x'"),'Pointer cleanup resets the light layer');
assert(!motionSource.includes("node.style.setProperty('--light-"),'Pointer motion must not invalidate the full chart subtree');
const uiSource=await readFile(new URL('../src/ui.tsx',import.meta.url),'utf8');
const living33=styles.split('/* Living 3.3')[1];
assert(living33&&!living33.includes('@keyframes')&&!living33.includes('animation:'),'The 3.3 finish adds no new animation loop');
assert(uiSource.includes('className="signature-artwork"')&&uiSource.includes('aria-hidden="true"'),'Signature artwork is decorative SVG, never a medical plot');
assert(living33.includes('max-inline-size:100%;white-space:normal;overflow-wrap:normal;word-break:normal'),'Large readings wrap between values, never through their digits');
assert(canvasSource.includes('const latestValue=')&&canvasSource.includes('`${l.n(latest.systolic)} / ${l.n(latest.diastolic)}`'),'The adjacent pressure pair has safe, readable wrapping opportunities');
assert(living33.includes('.canvas-actions .add-reading{display:none}'),'The persistent mobile dock remains the single add-reading action');
assert(Math.abs(focusScrollDelta(621.5,740.1,155,638.4)-101.7)<.001,'Move an obscured card above the dock');
assert.equal(focusScrollDelta(60,104,155,638),-95,'Reveal focus below the sticky header');
assert.equal(focusScrollDelta(200,244,155,638),0,'Never scroll an already visible target');
assert.equal(focusScrollDelta(200,900,155,638),45,'Align an oversized target without oscillation');
assert.equal(focusScrollDelta(155,638,155,638),0,'Stable at the exact safe boundaries');
assert.deepEqual(Object.keys(copy.ar).sort(),Object.keys(copy.en).sort());
for(const key of Object.keys(copy.ar)){
 const placeholders=value=>[...value.matchAll(/\{\{(\w+)\}\}/g)].map(match=>match[1]).sort();
 assert.deepEqual(placeholders(copy.ar[key]),placeholders(copy.en[key]),key);
 for(const value of [copy.ar[key],copy.en[key]])assert(!/[{}]/.test(value.replace(/\{\{\w+\}\}/g,'')),`Malformed placeholder: ${key}`);
}
const rows=seedReadings(new Date('2026-10-22T09:00:00Z')),original=structuredClone(rows);
assert.equal(rows.length,7);assert.equal(new Set(rows.map(row=>row.date)).size,7);
assert.deepEqual(rows.map(row=>row.systolic),[122,118,124,120,119,122,120]);
assert.deepEqual(rows.map(row=>row.diastolic),[78,76,80,78,77,79,80]);
assert.deepEqual(rows.map(row=>row.glucose),[102,96,104,100,98,102,98]);
const pressure={kind:'pressure',systolic:126,diastolic:82,glucose:0};
assert(validReading(pressure));assert(!validReading({...pressure,systolic:80,diastolic:90}));
assert(!validReading({...pressure,systolic:NaN}));assert(!validReading({...pressure,systolic:1.5}));
assert(!validReading({kind:'glucose',systolic:0,diastolic:0,glucose:-1}));
const next=applyReading(rows,pressure);assert.equal(next.length,7);assert.equal(next.at(-1).systolic,126);assert.equal(next.at(-1).glucose,98);assert.deepEqual(rows,original);assert.deepEqual(next.slice(0,6),rows.slice(0,6));
const glucose=applyReading(next,{kind:'glucose',systolic:0,diastolic:0,glucose:111});assert.equal(glucose.at(-1).systolic,126);assert.equal(glucose.at(-1).glucose,111);
assert.equal(applyReading(rows,{...pressure,diastolic:200}),rows);
assert.equal(reportSummary(rows,3).count,3);assert.equal(reportSummary(rows,7).count,7);assert.equal(reportSummary(rows,3).systolic,361/3);assert.equal(reportSummary([],7).count,0);
const en=createLocale('en'),ar=createLocale('ar');
assert.equal(message(copy.en.progress,{value:en.n(4500),target:en.n(10000),unit:en.unit('steps',10000)}),'4,500 of 10,000 steps');
assert.equal(message(copy.ar.progress,{value:ar.n(6),target:ar.n(8),unit:ar.unit('cups',8)}),'6 من 8 أكواب');
assert.equal(en.unit('cups',1),'cup');assert.equal(en.unit('steps',2),'steps');assert.equal(ar.unit('cups',2),'كوبان');
assert(ar.date(rows[0].date));assert(en.fullDate(rows[0].date));assert(!message(copy.en.doses,{taken:1,total:2}).includes('{{'));
assert.equal(message(copy.en.undoHabit,{habit:copy.en.water}),'Undo the last update: Drink water');
assert.equal(message(copy.ar.undoHabit,{habit:copy.ar.walking}),'التراجع عن آخر تحديث: المشي');
for(const catalog of [copy.ar,copy.en]){assert(!message(catalog.dateRange,{from:'A',to:'B'}).includes('{{'));assert(Object.values(catalog).every(value=>value.trim().length>0));}
console.log(`PASS: ${Object.keys(copy.ar).length} bilingual keys, placeholder parity, demo data, validation, immutable local updates, summaries, localized progress, 5 focus-geometry regressions, both OS-motion initial states and CSS motion safety.`);

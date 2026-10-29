// Small visual review pass; the complete regression matrix remains browser.mjs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=fileURLToPath(new URL('..',import.meta.url)),before=process.argv.includes('--before');
const output=resolve(root,before?'../chroniccare-living-2.0-reference-20261023/before-screenshots':'artifacts/review');
const base='http://127.0.0.1:5205',report={cases:[],background:[],errors:[]};
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const lang of ['ar','en'])for(const theme of ['dark','light']) {
    const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
    await context.addInitScript(({lang,theme})=>{localStorage.setItem('cc-living-language',lang);localStorage.setItem('cc-living-theme',theme);},{lang,theme});
    const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
    for(const screen of ['home','dashboard']) {
      await page.goto(`${base}/#${screen}`);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready);
      const name=`${lang}-${theme}-1440-${screen}`;
      await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});
      await page.screenshot({path:resolve(output,name+'-viewport.png')});
      report.cases.push(name);
      if(lang==='ar'&&screen==='home') {
        const sample=async()=>{
          const capture=await page.screenshot();
          return page.evaluate(async encoded=>{const image=new Image();image.src='data:image/png;base64,'+encoded;await image.decode();const canvas=document.createElement('canvas');canvas.width=8;canvas.height=960;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,8,960,0,0,8,960);const bytes=ctx.getImageData(4,0,1,960).data;let maxStep=0;for(let y=1;y<960;y++)for(let c=0;c<3;c++)maxStep=Math.max(maxStep,Math.abs(bytes[y*4+c]-bytes[(y-1)*4+c]));return {colors:Array.from({length:15},(_,i)=>[...bytes.slice(i*64*4,i*64*4+3)]),maxStep};},capture.toString('base64'));
        };
        const first=await sample();
        await page.evaluate(()=>window.scrollTo({top:480,behavior:'instant'}));
        await page.screenshot({path:resolve(output,`${lang}-${theme}-background-scroll.png`)});
        const second=await sample(),geometry=await page.locator('.atmosphere').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,height:r.height,position:getComputedStyle(el).position};});
        assert.deepEqual(first.colors,second.colors,'The ambient viewport background should not jump when scrolling');
        assert(first.maxStep<=3&&second.maxStep<=3,'No abrupt bands in the unobstructed background gutter');
        report.background.push({theme,geometry,unchangedOnScroll:true,maxAdjacentChannelStep:Math.max(first.maxStep,second.maxStep)});
      }
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
  console.log(JSON.stringify({status:'PASS',before,cases:report.cases.length,background:report.background,output}));
} finally {await browser.close();await writeFile(resolve(output,'review.json'),JSON.stringify(report,null,2));}

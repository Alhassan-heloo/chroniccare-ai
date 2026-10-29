// Local production profiler. Nothing here is bundled or loaded at the normal URL.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const prototypeRoot=fileURLToPath(new URL('../',import.meta.url));
const baseline=resolve(prototypeRoot,process.env.LIVING_BASELINE_DIRECTORY||'artifacts/living-3.2.1/baseline-dist');
if(!baseline.startsWith(prototypeRoot))throw new Error('The profiling baseline must stay inside this prototype.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png'};
const metrics=await readFile(new URL('./motion-metrics.js',import.meta.url),'utf8');
const statistics=await readFile(new URL('./motion-statistics.mjs',import.meta.url),'utf8');
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/__motion-metrics.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(metrics);return;}
    if(url.pathname==='/motion-statistics.mjs'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(statistics);return;}
    if(url.searchParams.get('motion-control')==='1'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="/favicon.svg"><title>Motion timing control</title><script type="module" src="/__motion-metrics.js"></script></head><body><h1>Plain-page timing control</h1><p>No React, CSS animations, or application code. Same observer and frame sampler.</p></body></html>');return;
    }
    const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);res.end();return;}
    // Optional frozen production snapshot for paired before/after trials only.
    // Normal requests still use dist; hashed baseline assets are fallback-only.
    let body;
    if(extname(path)==='.html'&&url.searchParams.get('baseline')==='1')body=await readFile(resolve(baseline,'index.html'));
    else try{body=await readFile(path);}catch(error){if(!url.pathname.startsWith('/assets/'))throw error;body=await readFile(resolve(baseline,'.'+url.pathname));}
    if(extname(path)==='.html'&&url.searchParams.get('motion-audit')==='1')body=Buffer.from(body.toString().replace('<head>','<head><script type="module" src="/__motion-metrics.js"></script>'));
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(5206,'127.0.0.1',()=>console.log('Production + opt-in motion audit: http://127.0.0.1:5206/?motion-audit=1'));

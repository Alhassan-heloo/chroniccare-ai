import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const directory=await mkdtemp(join(tmpdir(),'chroniccare-api-base-'));
const originalFetch=globalThis.fetch;
const globals=Object.fromEntries(['window','location','document','navigator'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
try{
 for(const [name,env,expected] of [
  ['production default',{PROD:true},'/api'],
  ['explicit same-origin',{PROD:true,VITE_API_URL:'/api'},'/api'],
  ['development default',{PROD:false},'http://localhost:3001/api'],
  ['development override',{PROD:false,VITE_API_URL:'http://127.0.0.1:3305/api/'},'http://127.0.0.1:3305/api'],
 ]){
  const file=join(directory,name.replaceAll(' ','-')+'.mjs');
  await build({absWorkingDir:root,stdin:{contents:'export {apiBaseUrl} from "./src/lib/api/baseUrl"; export {apiClient} from "./src/lib/api/client"; export {authRequest} from "./src/auth/api"; export {upgradePushWorker} from "./src/lib/notifications/browser";',resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:file,tsconfig:join(root,'tsconfig.app.json'),define:{'import.meta.env':JSON.stringify({BASE_URL:'/',...env})},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},logLevel:'error'});
  const scope='https://clinic.example/cc-fcm/';let registration,requestUrl;
  Object.defineProperties(globalThis,{
   window:{value:{isSecureContext:true,location:new URL("https://clinic.example/patient/dashboard")},configurable:true},location:{value:new URL('https://clinic.example/patient/dashboard'),configurable:true},
   document:{value:{documentElement:{lang:'ar'}},configurable:true},navigator:{value:{serviceWorker:{getRegistration:async()=>({scope,active:{scriptURL:scope+'sw.js?api=old'}}),register:async(url,options)=>{registration={url,options};}}},configurable:true},
  });
  globalThis.fetch=async(url,options)=>{requestUrl=url;assert.equal(options.credentials,'include');return Response.json({});};
  const module=await import(pathToFileURL(file).href);
  assert.equal(module.apiBaseUrl,expected);assert.equal(module.apiClient.defaults.baseURL,expected);
  await module.authRequest('me');assert.equal(requestUrl,expected+'/auth/me');
  await module.upgradePushWorker();const worker=new URL(registration.url);
  assert.equal(worker.searchParams.get('api'),new URL(expected,'https://clinic.example').href);
  assert.equal(registration.options.scope,scope);
  console.log('PASS: '+name+' — auth, Axios and absolute push-worker API URL');
 }
}finally{
 globalThis.fetch=originalFetch;
 for(const [key,descriptor] of Object.entries(globals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
 assert.equal(dirname(directory),resolve(tmpdir()));assert(basename(directory).startsWith('chroniccare-api-base-'));
 await rm(directory,{recursive:true,force:true});
}

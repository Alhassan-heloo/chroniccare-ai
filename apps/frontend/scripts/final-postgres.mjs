// Starts a fresh loopback-only PostgreSQL cluster; never uses or changes an existing database.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root=fileURLToPath(new URL('..',import.meta.url));
const home=resolve(root,'artifacts/final-experience/postgres');
const data=resolve(home,'data'),configFile=resolve(home,'connection.json');
const bin=process.env.PG_BIN||'C:/Program Files/PostgreSQL/18/bin';
const exists=path=>access(path).then(()=>true,()=>false);
const run=(command,args)=>{
  const result=spawnSync(resolve(bin,command+'.exe'),args,{windowsHide:true,stdio:'ignore',timeout:30000});
  if(result.error || result.status!==0)throw new Error(command+' failed. See local PostgreSQL log; connection details withheld.');
};
await mkdir(home,{recursive:true});
if(process.argv.includes('--stop')){
  const config=JSON.parse(await readFile(configFile,'utf8'));
  if(config.owner!=='chroniccare-graduation-demo' || config.data!==data)throw Error('Refusing to stop an unowned cluster.');
  run('pg_ctl',['-D',data,'-m','fast','-w','stop']);console.log('Stopped the isolated graduation PostgreSQL cluster.');
}else{
  let config;
  if(await exists(configFile)){
    config=JSON.parse(await readFile(configFile,'utf8'));
    if(config.owner!=='chroniccare-graduation-demo'||config.data!==data)throw Error('Unexpected cluster ownership.');
  }else{
    if(await exists(resolve(data,'PG_VERSION')))throw Error('Existing cluster has no ownership record; preserved.');
    const password=randomBytes(32).toString('hex');const pwfile=resolve(home,'initial-password.txt');await writeFile(pwfile,password);
    try{run('initdb',['-D',data,'-U','chroniccare_demo','--auth=scram-sha-256','--pwfile='+pwfile,'--encoding=UTF8','--locale=C']);}finally{await unlink(pwfile);}
    config={owner:'chroniccare-graduation-demo',data,databaseUrl:`postgresql://chroniccare_demo:${password}@127.0.0.1:5547/chroniccare_graduation_test`};
    await writeFile(configFile,JSON.stringify(config,null,2));
  }
  const status=spawnSync(resolve(bin,'pg_ctl.exe'),['-D',data,'status'],{windowsHide:true,stdio:'ignore'});
  if(status.status!==0)run('pg_ctl',['-D',data,'-l',resolve(home,'postgres.log'),'-o','-h 127.0.0.1 -p 5547','-w','start']);
  const childArgs=process.argv.slice(2);
  const databaseName=childArgs.length ? `chroniccare_graduation_run_${Date.now()}_test` : 'chroniccare_graduation_test';
  const runUrl=new URL(config.databaseUrl);runUrl.pathname='/'+databaseName;
  const {Client}=createRequire(resolve(root,'../backend/package.json'))('pg');const url=new URL(config.databaseUrl);url.pathname='/postgres';
  const client=new Client({connectionString:url.href,connectionTimeoutMillis:5000});await client.connect();
  try{const result=await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[databaseName]);if(!result.rowCount)await client.query(`CREATE DATABASE "${databaseName}"`);}finally{await client.end();}
  console.log('Ready: isolated PostgreSQL on loopback port 5547. Credentials remain in ignored local artifacts.');
  if(process.argv.length>2){
    const cwd=process.env.FINAL_TEST_CWD||root;
    const result=spawnSync(process.execPath,childArgs,{cwd,windowsHide:true,stdio:'inherit',env:{...process.env,TEST_DATABASE_URL:runUrl.href}});
    process.exitCode=result.status??1;
  }
}

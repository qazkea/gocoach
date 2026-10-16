import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const alive=pid=>{if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch{return false;}};
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
async function bounded(promise,ms,message) {
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}
 finally{clearTimeout(timer);}
}
const mode=process.argv[2]||'timeout';
const dir=await mkdtemp(join(tmpdir(),'fixture-check-'));
const recordFile=join(dir,'record.json');
let record,child,completion,injectionTimer,injectionStopped=false;
const readRecord=async()=>{try{return JSON.parse(await readFile(recordFile,'utf8'));}catch{return undefined;}};
console.log('FIXTURE_RECORD '+recordFile);
try{
 child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','-c','tests/fixtures/failure.config.ts'],{
  stdio:'inherit',env:{...process.env,FIXTURE_RECORD:recordFile,FIXTURE_FAILURE:mode,NODE_OPTIONS:'--import='+pathToFileURL(resolve('tests/fixtures/redirect-fork.mjs')).href}
 });
 // Resolve errors as data so cleanup can await this same completion, including failed spawn.
 completion=new Promise(resolve=>{child.once('exit',(code,signal)=>resolve({code,signal}));child.once('error',error=>{if(!child.pid)resolve({error});});});
 let finished=completion;
 if(mode==='outer-deadline') {
  // Shorten only after the ownership record exists and its fixture child is alive.
  const injection=new Promise((_,reject)=>{
   injectionTimer=setInterval(async()=>{
    const observed=await readRecord();
    if(!injectionStopped&&observed&&alive(observed.pid)) {
     injectionStopped=true;record=observed;
     clearInterval(injectionTimer);
     injectionTimer=setTimeout(()=>reject(Error('injected outer deadline')),1000);
    }
   },50);
  });
  finished=Promise.race([completion,injection]);
 }
 let result;
 try{result=await bounded(finished,45000,'outer deadline');}
 catch(error){if(mode!=='outer-deadline'||error.message!=='injected outer deadline')throw error;}
 if(mode==='outer-deadline')assert.equal(result,undefined,'must interrupt the live nested run, not its ordinary exit');
 else {
  if(result.error)throw result.error;
  assert.notEqual(result.code,0,'nested startup failure is expected');
  record=await readRecord();assert.ok(record,'fixture ownership record missing');
  const state={...record,alive:alive(record.pid),tempExists:await exists(record.dir)};
  console.log(JSON.stringify(state));
  assert.equal(state.alive,false,'fixture child leaked');
  assert.equal(state.tempExists,false,'fixture temp directory leaked');
 }
}finally{
 injectionStopped=true;clearInterval(injectionTimer);clearTimeout(injectionTimer);
 // Retain the record directory until both our outer child and recorded resources are reaped.
 if(child) {
  if(alive(child.pid))child.kill('SIGKILL');
  if(completion)await bounded(completion,5000,'outer child cleanup timeout');
 }
 record=await readRecord()??record;
 if(record) {
  if(alive(record.pid))process.kill(record.pid,'SIGKILL');
  const deadline=Date.now()+5000;
  while(alive(record.pid)&&Date.now()<deadline)await delay(25);
  assert.equal(alive(record.pid),false,'recorded fixture child cleanup timeout');
  await rm(record.dir,{recursive:true,force:true});
 }
 await rm(dir,{recursive:true,force:true});
}
console.log('PASS: expected nested failure cleaned resources'+(mode==='outer-deadline'?' after outer deadline':''));

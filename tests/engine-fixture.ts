import {test as base,expect} from '@playwright/test';
import {fork,execFileSync,type ChildProcess} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stopOwnedChild,waitForListening} from './process-cleanup';
import {compileBrokenInput} from './windows-input-probe.mjs';
export const test=base.extend<{engineScenario:string;engineServer:{url:string;observed:()=>Promise<any[]>;pids:()=>Promise<number[]>;advanceClock:(milliseconds:number)=>Promise<void>}}>({
 engineScenario:['normal',{option:true}],
 engineServer:async({engineScenario},use)=>{
  let dir:string|undefined, child:ChildProcess|undefined;
  try{
   dir=await mkdtemp(join(tmpdir(),'go-engine-test-'));const observe=join(dir,'queries.jsonl');
   const native=process.platform==='win32'&&['broken-input','slow-version'].includes(engineScenario);
   let adapter=native?compileBrokenInput(dir):join(dir,'scripted-engine.mjs');
   if(!native)await writeFile(adapter,await readFile(resolve('tests/scripted-engine.mjs'),'utf8'));
   let config:string|undefined=engineScenario==='bad-config'?join(dir,'missing-config.json'):undefined;
   if(engineScenario==='slow-version') {
    if(!native) {
     adapter=join(dir,'slow-version.mjs');
     await writeFile(adapter,'#!/usr/bin/env node\n'+await readFile(resolve('tests/scripted-engine.mjs'),'utf8'),{mode:0o700});
    }
    config=join(dir,'local.json');
    await writeFile(config,JSON.stringify({executable:adapter,model:join(dir,'synthetic-model'),dataDir:dir,homeDataDir:dir}));
   }
   const clock=join(dir,'clock');await writeFile(clock,'0');
   child=fork(resolve('.server/index.js'),['--port','0'],{silent:true,...(engineScenario==='evidence-clock'?{execArgv:['--import',pathToFileURL(resolve('tests/fixtures/evidence-clock.mjs')).href]}:{}),env:{...process.env,EVIDENCE_CLOCK_FILE:clock,GO_COACH_CONFIG:config,GO_COACH_TEST_ENGINE:config||engineScenario==='unconfigured'?undefined:adapter,ENGINE_OBSERVE:observe,ENGINE_SCENARIO:engineScenario}});
   const url=await waitForListening(child);
   await use({url,advanceClock:async milliseconds=>{await writeFile(clock,String(milliseconds));},pids:async()=>{try{return (await readFile(observe+'.pids','utf8')).trim().split('\n').map(Number);}catch{return [];}},observed:async()=>{try{return (await readFile(observe,'utf8')).trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{return [];}}});
  }finally{
   try{
    let cleanupError:unknown;
    try{await stopOwnedChild(child);}catch(e){cleanupError=e;}
    let pids:number[]=[];try{pids=(await readFile(join(dir!,'queries.jsonl.pids'),'utf8')).trim().split('\n').map(Number);}catch{}
    // Historical Windows PIDs can already belong to another parallel fixture.
    // Every adapter now has a unique absolute path inside this invocation's dir.
    const alive=()=>{
     if(process.platform==='win32'){
      const rows=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true})) as {ProcessId:number;CommandLine:string|null}[];
      return rows.filter(p=>pids.includes(p.ProcessId)&&p.CommandLine?.toLowerCase().includes(dir!.toLowerCase())).map(p=>p.ProcessId);
     }
     return pids.filter(pid=>{try{process.kill(pid,0);return true;}catch{return false;}});
    };
    const leaked=alive();
    // Even a failed assertion must not strand this invocation's own adapters.
    for(const pid of leaked){try{process.kill(pid,'SIGKILL');}catch{}}
    await expect.poll(alive,{message:'failed tests must also reap every owned engine PID'}).toEqual([]);
    expect(leaked,'own engine PIDs must exit with the server').toEqual([]);
    expect(child?.signalCode??null,'server must finish graceful shutdown, not rely on fixture SIGKILL').toBeNull();
    if(cleanupError)throw cleanupError;
   }finally{if(dir)await rm(dir,{recursive:true,force:true});}
  }
 },
});
export {expect};

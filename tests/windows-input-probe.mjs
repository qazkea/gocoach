// Platform injection probe only; the browser test remains the product regression.
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
export function compileBrokenInput(dir) {
 const framework='C:/Windows/Microsoft.NET/Framework64/v4.0.30319';
 const exe=join(dir,'broken-input.exe');
 execFileSync(join(framework,'csc.exe'),['/nologo','/target:exe','/out:'+exe,'/reference:'+join(framework,'System.Web.Extensions.dll'),resolve('tests/windows-broken-input.cs')],{windowsHide:true,timeout:10000});
 return exe;
}
if(process.argv[1]===resolve('tests/windows-input-probe.mjs')) {
 const dir=await mkdtemp(join(tmpdir(),'go-input-probe-'));let child;
 try {
  child=spawn(compileBrokenInput(dir),[],{env:{...process.env,ENGINE_OBSERVE:join(dir,'queries')},stdio:['pipe','pipe','pipe'],shell:false});
  const error=new Promise(resolve=>child.stdin.once('error',resolve));
  child.stderr.on('data',data=>process.stderr.write(data));
  const first=once(child.stdout,'data',{signal:AbortSignal.timeout(5000)});
  child.stdin.write('{"id":"first","moves":[],"initialStones":[],"initialPlayer":"B"}\n');
  const [reply]=await first;
  assert.equal(JSON.parse(reply.toString()).noResults,true);
  child.stdin.write('{"id":"second","moves":[],"initialStones":[],"initialPlayer":"B"}\n');
  let timer;
  const failure=await Promise.race([error,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('No real stdin error within 2s')),2000);})]).finally(()=>clearTimeout(timer));
  process.kill(child.pid,0);
  console.log(JSON.stringify({code:failure.code,message:failure.message,pid:child.pid,alive:true}));
  assert.equal(failure.code,'EPIPE');
 } finally {
  if(child&&child.exitCode===null){const exit=once(child,'exit');child.kill('SIGKILL');await exit;}
  await rm(dir,{recursive:true,force:true});
  console.log('Owned child exited; temporary directory removed');
 }
}

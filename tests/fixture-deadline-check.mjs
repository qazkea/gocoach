// Independent observer: retain ownership records even if the checked script loses them.
import {spawn} from 'node:child_process';
import {readFile,rm,access} from 'node:fs/promises';
import {dirname} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const alive=pid=>{if(!pid)return false;try{process.kill(pid,0);return true;}catch{return false;}};
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
const child=spawn(process.execPath,['tests/fixture-resource-check.mjs','outer-deadline'],{stdio:['ignore','pipe','pipe']});
let output='',recordFile,record;
child.stdout.on('data',data=>{output+=data;process.stdout.write(data);recordFile=output.match(/FIXTURE_RECORD (.+)\r?\n/)?.[1].trim();});
child.stderr.pipe(process.stderr);
const exit=new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
let timer;
try {
 const deadline=Date.now()+10000;
 while(!record&&Date.now()<deadline) {
  if(recordFile)try{record=JSON.parse(await readFile(recordFile,'utf8'));}catch{}
  if(!record)await delay(25);
 }
 assert.ok(record,'nested fixture must write its ownership record before the injected deadline');
 assert.equal(alive(record.pid),true,'fault must interrupt a live fixture child');
 const code=await Promise.race([exit,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('deadline checker did not exit')),15000);})]);
 const remaining={outerAlive:alive(child.pid),fixtureAlive:alive(record.pid),fixtureDir:await exists(record.dir),recordDir:await exists(dirname(recordFile))};
 console.log(JSON.stringify({code,...remaining}));
 assert.deepEqual(remaining,{outerAlive:false,fixtureAlive:false,fixtureDir:false,recordDir:false});
 assert.equal(code,0);
 console.log('PASS: outer deadline independently verified');
} finally {
 clearTimeout(timer);
 if(alive(child.pid)){child.kill('SIGKILL');await exit;}
 if(record&&alive(record.pid)) {
  process.kill(record.pid,'SIGKILL');
  const deadline=Date.now()+5000;
  while(alive(record.pid)&&Date.now()<deadline)await delay(25);
  assert.equal(alive(record.pid),false,'observer cleanup failed');
 }
 if(record)await rm(record.dir,{recursive:true,force:true});
 if(recordFile)await rm(dirname(recordFile),{recursive:true,force:true});
}

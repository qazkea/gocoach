import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'fixture-check-'));
let record;
try{
 const file=join(dir,'record.json');
 const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','-c','tests/fixtures/failure.config.ts'],{
  stdio:'inherit',env:{...process.env,FIXTURE_RECORD:file,FIXTURE_FAILURE:process.argv[2]||'timeout',NODE_OPTIONS:'--import='+pathToFileURL(resolve('tests/fixtures/redirect-fork.mjs')).href}
 });
 const code=await new Promise((res,rej)=>{const t=setTimeout(()=>{child.kill();rej(Error('outer deadline'));},45000);child.once('exit',c=>{clearTimeout(t);res(c);});});
 assert.notEqual(code,0,'nested startup failure is expected');
 record=JSON.parse(await readFile(file,'utf8'));
 let alive=false;try{process.kill(record.pid,0);alive=true;}catch{}
 let exists=true;try{await access(record.dir);}catch{exists=false;}
 console.log(JSON.stringify({...record,alive,tempExists:exists}));
 assert.equal(alive,false,'fixture child leaked');
 assert.equal(exists,false,'fixture temp directory leaked');
 console.log('PASS: expected nested failure cleaned resources');
}finally{
 // Only resources recorded by this invocation, including RED cleanup.
 if(record){try{process.kill(record.pid);}catch{}await rm(record.dir,{recursive:true,force:true});}
 await rm(dir,{recursive:true,force:true});
}

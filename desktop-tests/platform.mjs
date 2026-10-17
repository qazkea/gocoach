// External test-only OS adapter entry. Continue into the unchanged real
// bootstrap after adapting Node's public engine-child signal interface.
import {readFileSync,appendFileSync} from 'node:fs';
import {ChildProcess} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const control=process.env.DESKTOP_OS_CONTROL;
const record=value=>appendFileSync(control+'.events',JSON.stringify({...value,pid:process.pid})+'\n');
record({action:'adapter',utility:!!process.parentPort});
const kill=ChildProcess.prototype.kill;
ChildProcess.prototype.kill=function(signal) {
 let fault;
 try {fault=JSON.parse(readFileSync(control,'utf8'));} catch {}
 if(fault?.mode==='deny-kill'&&this.pid===fault.engine.ProcessId&&this.spawnfile?.toLowerCase()===fault.engine.ExecutablePath.toLowerCase()) {
  record({action:'os-kill-refused',target:this.pid,signal});
  return false;
 }
 return kill.call(this,signal);
};
await import(pathToFileURL(process.env.DESKTOP_BRIDGE_ENTRY).href);

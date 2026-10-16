import type {ChildProcess} from 'node:child_process';

const exited=(child:ChildProcess)=>child.exitCode!==null||child.signalCode!==null;

// Only accepts a ChildProcess owned by the caller; never searches ports/processes.
export async function stopOwnedChild(child?:ChildProcess):Promise<void> {
 if(!child||!child.pid||exited(child))return;
 await new Promise<void>((resolve,reject)=>{
  const finish=()=>{clearTimeout(kill);clearTimeout(deadline);child.removeListener('exit',finish);resolve();};
  const kill=setTimeout(()=>child.kill('SIGKILL'),4000);
  const deadline=setTimeout(()=>{child.removeListener('exit',finish);reject(Error(`own child ${child.pid} cleanup timeout`));},8000);
  child.once('exit',finish);
  if(child.connected){try{child.send('close',()=>{});}catch{}}
 });
}

export function waitForListening(child:ChildProcess):Promise<string> {
 return new Promise((resolve,reject)=>{
  let diagnostics='';
  const clean=()=>{clearTimeout(timer);child.stdout?.removeListener('data',data);child.stderr?.removeListener('data',stderr);child.removeListener('exit',exit);child.removeListener('error',error);};
  const error=(e:Error)=>{clean();reject(e);};
  const exit=()=>error(Error(diagnostics||'server exited before listening'));
  const stderr=(d:Buffer)=>{diagnostics=(diagnostics+d).slice(-8192);};
  let output='';
  const data=(d:Buffer)=>{output=(output+d).slice(-8192);const m=output.match(/LISTENING (http:\/\/127\.0\.0\.1:\d+)/);if(m){clean();resolve(m[1]);}};
  const timer=setTimeout(()=>error(Error(diagnostics||'server startup timeout')),20000);
  child.stdout?.on('data',data);child.stderr?.on('data',stderr);child.once('exit',exit);child.once('error',error);
  if(exited(child))exit();
 });
}

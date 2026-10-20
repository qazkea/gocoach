import {spawn, execFile, type ChildProcess} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {resolve, basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {result, type Position} from './position';
import type {EngineResult} from '../src/engine';
type Pending={position:Position; resolve:(r:EngineResult)=>void; reject:(e:Error)=>void; cancelled:boolean; sent:boolean; timer?:NodeJS.Timeout; status:(s:string)=>void};
export class KataGo {
 isCurrentSession(session:string):boolean {return this.ready&&!this.closing&&!!this.child&&this.child.exitCode===null&&this.child.signalCode===null&&session===this.serviceInstance+':'+this.generation;}
 private sessionListeners=new Set<(session:string|null)=>void>();
 private publishedSession:string|null=null;
 observeSession(listener:(session:string|null)=>void):()=>void {
  this.sessionListeners.add(listener);
  listener(this.currentSession());
  return ()=>{this.sessionListeners.delete(listener);};
 }
 private currentSession():string|null {
  const session=this.serviceInstance+':'+this.generation;
  return this.isCurrentSession(session)?session:null;
 }
 private publishSession() {
  const session=this.currentSession();
  if(session===this.publishedSession)return;
  this.publishedSession=session;
  for(const listener of this.sessionListeners)listener(session);
 }
 private child?:ChildProcess;
 private pending=new Map<string,Pending>();
 private acknowledgements=new Map<string,{target:string;timer:NodeJS.Timeout}>();
 private ready=false;
 private generation=0;
 private readonly serviceInstance=randomUUID();
 private startup?:NodeJS.Timeout;
 private starting=false;
 private engine='';
 private model='';
 private closing=false;
 private stopping?:Promise<void>;
 analyze(position:Position, signal:AbortSignal, status:(s:string)=>void):Promise<EngineResult> {
  if(this.closing) return Promise.reject(Error('服务正在退出'));
  if(new Set([...this.pending.keys(),...Array.from(this.acknowledgements.values(),a=>a.target)]).size>=4) return Promise.reject(Error('busy：最多4个未收尾请求，请稍后重试'));
  const id=randomUUID();
  return new Promise((resolve,reject)=>{
   const entry:Pending={position,resolve,reject,cancelled:false,sent:false,status};
   const abort=()=>{
    entry.cancelled=true;
    // Keep the query deadline on a sent cancellation tombstone: a broken
    // engine must not permanently fill all four slots by never finishing.
    reject(Error('已取消'));
    if(entry.sent) this.terminate(id);
    else this.pending.delete(id);
   };
   signal.addEventListener('abort',abort,{once:true});
   entry.resolve=r=>{signal.removeEventListener('abort',abort);resolve(r);};
   entry.reject=e=>{signal.removeEventListener('abort',abort);reject(e);};
   this.pending.set(id,entry);
   if(signal.aborted) {abort();return;}
   if(this.ready) this.submit(id,entry);
   else {status('引擎加载中（启动上限600秒）');if(!this.starting) void this.start();}
  });
 }
 private terminate(target:string) {
  const id=randomUUID();
  const timer=setTimeout(()=>{this.fail(Error('引擎终止确认超时'));},30000);
  this.acknowledgements.set(id,{target,timer});
  this.send({id,action:'terminate',terminateId:target});
 }
 private send(value:unknown) {this.child?.stdin?.write(JSON.stringify(value)+'\n');}
 private submit(id:string,p:Pending) {
  if(p.cancelled) return;
  p.sent=true; p.status('分析中（查询上限30秒）');
  p.timer=setTimeout(()=>{this.fail(Error('引擎查询超时'));},30000);
  this.send({id,...p.position.query});
 }
 private async start() {
  this.starting=true;
  try {if(this.child||this.stopping)await this.stopChild();} catch {this.fail(Error('旧引擎尚未回收'));return;}
  if(this.closing) {this.starting=false;return;}
  const started=performance.now();
  const generation=++this.generation;this.publishSession();
  this.startup=setTimeout(()=>{this.fail(Error('引擎启动超时'));},600000);
  try {
   let executable:string, args:string[];
   if(process.env.GO_COACH_TEST_ENGINE) {
    const adapter=resolve(process.env.GO_COACH_TEST_ENGINE);
    if(/\.exe$/i.test(adapter)) {executable=adapter;args=[];}
    else if(/\.(?:mjs|cjs|js)$/i.test(adapter)) {executable=process.execPath;args=[adapter];}
    else throw Error('测试引擎仅支持本地 Node 脚本或 exe');
    this.engine='可控测试引擎（非真实 KataGo）';this.model='scripted-jsonl';
   } else {
    if(!process.env.GO_COACH_CONFIG) throw Error('未配置本地引擎：请由操作员设置 GO_COACH_CONFIG');
    const c=JSON.parse(await readFile(process.env.GO_COACH_CONFIG,'utf8')) as {executable:string;model:string;dataDir:string;homeDataDir:string;recordSyntheticEvidence?:boolean};
    for(const key of ['executable','model','dataDir','homeDataDir'] as const) if(typeof c[key]!=='string' || /[\r\n]/.test(c[key])) throw Error('本地引擎配置无效');
    if(generation!==this.generation || this.closing) return;
    const checking=promisify(execFile)(c.executable,['version'],{timeout:10000,maxBuffer:65536,windowsHide:true});
    // Version and analysis never overlap: both occupy the same owned child slot.
    const versionChild=checking.child;this.child=versionChild;
    let version;
    try {version=await checking;}
    finally {
     if(this.child===versionChild && (!versionChild.pid || versionChild.exitCode!==null || versionChild.signalCode!==null)) this.child=undefined;
    }
    if(generation!==this.generation || this.closing) return;
    if(!version.stdout.includes('KataGo v1.18.1') || !version.stdout.includes('Using OpenCL backend')) throw Error('仅支持已授权 KataGo v1.18.1 OpenCL');
    this.engine='KataGo v1.18.1 OpenCL';this.model=basename(c.model);
    await mkdir(c.dataDir,{recursive:true});
    const config=resolve(c.dataDir,'analysis-web.cfg');
    await writeFile(config,`homeDataDir = ${c.homeDataDir.replaceAll('\\','/')}\nlogDir = ${resolve(c.dataDir,'engine-logs').replaceAll('\\','/')}\nlogToStderr = true\nlogAllRequests = ${c.recordSyntheticEvidence===true}\nlogAllResponses = ${c.recordSyntheticEvidence===true}\nlogErrorsAndWarnings = true\nwarnUnusedFields = true\nreportAnalysisWinratesAs = BLACK\nnumAnalysisThreads = 1\nnumSearchThreadsPerAnalysisThread = 2\nnnMaxBatchSize = 2\nnnCacheSizePowerOfTwo = 18\nmaxVisits = 100\nmaxTime = 2\nanalysisPVLen = 15\n`);
    executable=c.executable;args=['analysis','-config',config,'-model',c.model,'-quit-without-waiting'];
   }
   if(generation!==this.generation || this.closing) return;
   const child=spawn(executable,args,{windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false});
   this.child=child;
   if(!process.env.GO_COACH_TEST_ENGINE)console.log(`ENGINE pid=${child.pid} generation=${generation}`);
   let out=Buffer.alloc(0), stderr='';
   child.stdout.on('data',(data:Buffer)=>{
    if(generation!==this.generation) return;
    out=Buffer.concat([out,data]);
    while(out.includes(10)) {
     const i=out.indexOf(10); const line=out.subarray(0,i);out=out.subarray(i+1);
     if(line.length>2*1024*1024) {this.fail(Error('引擎响应超限'));return;}
     try {this.receive(JSON.parse(line.toString('utf8')));} catch {this.fail(Error('引擎 JSON 协议无效'));return;}
    }
    if(out.length>2*1024*1024) {this.fail(Error('引擎响应超限'));}
   });
   child.stderr.on('data',(data:Buffer)=>{
    if(generation!==this.generation) return;
    stderr+=data.toString('utf8');
    const lines=stderr.split('\n');stderr=lines.pop()!.slice(-8192);
    for(const line of lines) {
     if(/\bwarning\b|\berror\b/i.test(line)) {this.fail(Error('引擎 warning/error，本次分析未完成'));return;}
     if(line.includes('Started, ready to begin handling requests')) {
      clearTimeout(this.startup);this.ready=true;this.starting=false;this.publishSession();
      if(!process.env.GO_COACH_TEST_ENGINE)console.log(`ENGINE ready seconds=${((performance.now()-started)/1000).toFixed(3)}`);
      for(const [id,p] of this.pending) this.submit(id,p);
     }
    }
   });
   child.on('error',()=>{if(generation===this.generation) this.fail(Error('无法启动本地引擎'));});
   child.stdin.on('error',()=>{if(generation===this.generation) this.fail(Error('引擎输入已关闭'));});
   child.on('exit',()=>{if(generation===this.generation) {this.child=undefined;this.fail(Error('引擎已退出，分析未完成'));}});
  } catch(e) {if(generation===this.generation) this.fail(e instanceof Error?e:Error('引擎启动失败'));}
 }
 private receive(v:Record<string,unknown>) {
  const p=this.pending.get(v.id as string);
  if(!p) {
   // terminate acknowledgements have their own ids, never analysis results.
   const acknowledgement=this.acknowledgements.get(v.id as string);
   if(v.action==='terminate' && acknowledgement && acknowledgement.target===v.terminateId) {clearTimeout(acknowledgement.timer);this.acknowledgements.delete(v.id as string);return;}
   throw Error('未知响应身份');
  }
  if(p.cancelled) {
   if(v.isDuringSearch===false || v.error!==undefined || v.noResults===true) {clearTimeout(p.timer);this.pending.delete(v.id as string);}
   return;
  }
  if(v.warning!==undefined) {
   p.cancelled=true;
   p.reject(Error('引擎 warning/error，本次分析未完成'));
   this.terminate(v.id as string);
   return;
  }
  if(v.isDuringSearch===true && v.error===undefined) return;
  clearTimeout(p.timer);this.pending.delete(v.id as string);
  try {
   if(v.noResults===true) throw Error('noResults：引擎没有结果');
   if(v.isDuringSearch!==false && v.warning===undefined && v.error===undefined) throw Error('引擎最终响应身份不符');
   p.resolve({...result(v,p.position,this.engine,this.model),engineSession:this.serviceInstance+':'+this.generation});
  } catch(e) {p.reject(e instanceof Error?e:Error('引擎响应无效'));}
 }
 private fail(error:Error) {
  clearTimeout(this.startup);this.ready=false;this.starting=false;this.publishSession();
  for(const p of this.pending.values()) {clearTimeout(p.timer);p.reject(error);}
  this.pending.clear();
  for(const a of this.acknowledgements.values()) clearTimeout(a.timer);
  this.acknowledgements.clear();
  // Fatal failures share one generation-invalidating reaper, including stdin errors.
  void this.stopChild().catch(()=>{});
 }
 private stopChild():Promise<void> {
  if(this.stopping) return this.stopping;
  const child=this.child;this.generation++;this.publishSession();
  if(!child || !child.pid || child.exitCode!==null || child.signalCode!==null) {
   this.child=undefined;return Promise.resolve();
  }
  const stopped=new Promise<void>((resolve,reject)=>{
   const finish=()=>{clearTimeout(kill);clearTimeout(deadline);child.removeListener('exit',finish);resolve();};
   const kill=setTimeout(()=>{child.kill('SIGKILL');},3000);
   const deadline=setTimeout(()=>{
    child.removeListener('exit',finish);
    reject(Error('自有引擎未能在关闭期限内退出'));
   },6000);
   child.once('exit',finish);
   try {child.stdin?.end();} catch {}
  });
  this.stopping=stopped.then(()=>{
   if(this.child===child)this.child=undefined;
   this.stopping=undefined;
  },error=>{this.stopping=undefined;throw error;});
  // If the OS refuses cleanup retain the child. A later close/retry can reap
  // again, but start() must successfully finish that reaper before replacing it.
  return this.stopping;
 }
 async close() {this.closing=true;this.fail(Error('服务退出'));await this.stopChild();}
}

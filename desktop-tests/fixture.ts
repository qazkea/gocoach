import {test as base, expect, _electron, type ElectronApplication, type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

export const packaged=resolve('desktop-release/win-unpacked/Go Coach.exe');
const framework=join(process.env.SystemRoot??'C:/Windows','Microsoft.NET/Framework64/v4.0.30319');
export function processes() : {ProcessId:number;ParentProcessId:number;ExecutablePath:string;CreationDate:string;CommandLine:string}[] {
 const out=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine,@{n='CreationDate';e={$_.CreationDate.ToString('o')}} | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true});
 return JSON.parse(out);
}
// Windows retains historical PPIDs after a parent exits. A reused PID alone is not ownership.
export function ownedProcesses(snapshot:ReturnType<typeof processes>,rootPid:number) {
 const root=snapshot.find(p=>p.ProcessId===rootPid);if(!root)return [];
 const owned=new Map([[rootPid,root]]);
 for(let i=0;i<snapshot.length;i++) {
  let changed=false;
  for(const p of snapshot) {
   const parent=owned.get(p.ParentProcessId);
   if(!owned.has(p.ProcessId)&&parent&&Date.parse(p.CreationDate)>=Date.parse(parent.CreationDate)) {owned.set(p.ProcessId,p);changed=true;}
  }
  if(!changed)break;
 }
 return [...owned.values()];
}
export type Run={app:ElectronApplication;page:Page;child:ReturnType<ElectronApplication['process']>;pids:number[];close:()=>Promise<void>};
type Desktop={dir:string;userData:string;operator:string;engine:string;observe:string;evidence:string;launch:(options?:{exe?:string;userData?:string})=>Promise<Run>;observed:()=>Promise<any[]>;select:(run:Run,path?:string,approve?:number)=>Promise<{messages:any[];errors:string[]}>};
export const test=base.extend<{desktop:Desktop;engineScenario:string}>({
 engineScenario:['normal',{option:true}],
 desktop:async({engineScenario},use,testInfo)=>{
  const dir=await mkdtemp(join(tmpdir(),'go-desktop-sol-'));
  const evidence=join(process.env.DESKTOP_EVIDENCE_DIR??'D:/code/tmp/go-coach-notes/desktop/implementer-sol',testInfo.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g,'_').slice(0,70));
  await mkdir(evidence,{recursive:true});
  const userData=join(dir,'user-data'), observe=join(dir,'engine.jsonl'), engine=join(dir,'synthetic-engine.exe'),operator=join(dir,'operator.json');
  execFileSync(join(framework,'csc.exe'),['/nologo','/target:exe','/out:'+engine,'/reference:'+join(framework,'System.Web.Extensions.dll'),resolve('desktop-tests/engine.cs')],{windowsHide:true,timeout:10000});
  await mkdir(join(dir,'home')); await mkdir(join(dir,'web-data'));
  await writeFile(join(dir,'model.bin'),'synthetic model');
  await writeFile(operator,JSON.stringify({executable:engine,model:join(dir,'model.bin'),dataDir:join(dir,'web-data'),homeDataDir:join(dir,'home'),recordSyntheticEvidence:true}));
  const runs:Run[]=[];
  const observed=async()=>{try{return (await readFile(observe,'utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch{return [];}};
  const launch:Desktop['launch']=async(options={})=>{
   // A product launch has no external Node/npm/Vite on PATH; only the test host needs Node.
   const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^path$/i.test(key)));
   const app=await _electron.launch({executablePath:options.exe??packaged,cwd:tmpdir(),args:[`--user-data-dir=${options.userData??userData}`],env:{...env,PATH:`${process.env.SystemRoot};${process.env.SystemRoot}/System32`,GO_COACH_CONFIG:operator,GO_COACH_TEST_ENGINE:engine,ENGINE_OBSERVE:observe,ENGINE_SCENARIO:engineScenario}});
   const child=app.process();
   child.stdout?.on('data',d=>void writeFile(join(evidence,`app-${child.pid}.stdout`),d,{flag:'a'}));
   child.stderr?.on('data',d=>void writeFile(join(evidence,`app-${child.pid}.stderr`),d,{flag:'a'}));
   const identities=new Map<number,string>();
   const run:Run={app,child,page:undefined as unknown as Page,pids:[],close:async()=>{
    const owned=ownedProcesses(processes(),child.pid!);
    for(const p of owned)identities.set(p.ProcessId,p.CreationDate);
    run.pids=[...identities.keys()].filter(pid=>pid!==child.pid);
    await writeFile(join(evidence,`ownership-before-close-${child.pid}.json`),JSON.stringify(owned,null,2));
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0]?.close());
    await expect.poll(()=>child.exitCode,{timeout:15000,message:'native window close must finish the real application'}).not.toBeNull();
    expect(child.exitCode).toBe(0);
    await expect.poll(()=>processes().filter(p=>identities.get(p.ProcessId)===p.CreationDate).map(p=>p.ProcessId),{message:'owned Electron children must exit with the window'}).toEqual([]);
   }};
   runs.push(run);
   run.page=await app.firstWindow();
   await expect(run.page.getByRole('heading',{name:'围棋赛后复盘',exact:true})).toBeVisible();
   const owned=ownedProcesses(processes(),child.pid!);
   for(const p of owned)identities.set(p.ProcessId,p.CreationDate);
   run.pids=owned.filter(p=>p.ProcessId!==child.pid).map(p=>p.ProcessId);
   await writeFile(join(evidence,`ownership-${child.pid}.json`),JSON.stringify(owned,null,2));
   return run;
  };
  const select:Desktop['select']=async(run,path,approve=1)=>{
   const previous=run.page.url();
   const result=await run.app.evaluate(async({Menu,dialog,BrowserWindow},{path,approve})=>{
   const messages:any[]=[], errors:string[]=[];
   const item=Menu.getApplicationMenu()?.items.find(i=>i.label==='引擎')?.submenu?.items.find(i=>i.label==='选择本地配置…');
   if(!item)throw Error('缺少中文原生选择配置菜单');
   return new Promise<{messages:any[];errors:string[]}>(resolve=>{
    const finish=()=>setImmediate(()=>resolve({messages,errors}));
    dialog.showOpenDialog=async()=>{if(!path)finish();return {canceled:!path,filePaths:path?[path]:[]};};
    dialog.showMessageBox=(async(...args:any[])=>{messages.push(args.at(-1));finish();return {response:approve,checkboxChecked:false};}) as typeof dialog.showMessageBox;
    dialog.showErrorBox=(_title,content)=>{errors.push(content);finish();};
    item.click(item,BrowserWindow.getAllWindows()[0],{} as any);
   });
   },{path,approve});
   if(result.messages.length&&approve===1&&!result.errors.length){
    await run.page.waitForURL(url=>url.href!==previous);
    await expect(run.page.getByRole('heading',{name:'围棋赛后复盘',exact:true})).toBeVisible();
   }
   return result;
  };
  let failure:unknown;
  try {await use({dir,userData,engine,operator,observe,evidence,launch,observed,select});}
  finally {
   try {
    for(const run of runs) {
     if(run.child.exitCode===null) {
      try {await run.close();} catch(e){failure=e;await run.app.close().catch(()=>{});}
     }
    }
    const log=await observed();
    await writeFile(join(evidence,'engine-io.json'),JSON.stringify(log,null,2));
    const enginePids=log.filter(q=>q.action==='launch').map(q=>q.pid);
    const survivors=processes().filter(p=>enginePids.includes(p.ProcessId)&&p.ExecutablePath?.toLowerCase()===engine.toLowerCase());
    for(const p of survivors)process.kill(p.ProcessId,'SIGKILL'); // Failure-only cleanup, confirmed invocation-owned executable.
    await writeFile(join(evidence,'exit.json'),JSON.stringify({apps:runs.map(r=>({pid:r.child.pid,code:r.child.exitCode,signal:r.child.signalCode,children:r.pids})),enginePids,survivors},null,2));
    expect(survivors,'product must reap the engine; fixture cleanup is not a passing exit').toEqual([]);
    if(failure)throw failure;
   } finally {await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
  }
 }
});
export {expect};
export async function upload(page:Page) {
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'synthetic.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Chinese]KM[7.5]PB[private-name]C[private-comment];B[ba];W[aa];B[ab];W[])')});
}

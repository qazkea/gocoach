import {test,expect,upload,processes,ownedProcesses,type Run} from './fixture';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

// Native dialog responses and window close are platform I/O, not lifecycle replacements.
function requestClose(run:Run,response:number) {
 return run.app.evaluate(({dialog,BrowserWindow},response)=>new Promise<{options?:any;error?:string}>(resolve=>{
  dialog.showMessageBox=(async(...args:any[])=>{console.log('NATIVE_SHUTDOWN_PROMPT');resolve({options:args.at(-1)});return {response,checkboxChecked:false};}) as typeof dialog.showMessageBox;
  dialog.showErrorBox=(title,message)=>resolve({error:`${title}: ${message}`});
  BrowserWindow.getAllWindows()[0].close();
 }),response).catch(error=>({options:undefined,error:String(error)}));
}
async function exitUnconfirmed(run:Run) {
 const final=await requestClose(run,1);
 expect(final.options?.buttons).toEqual(['保留窗口','退出应用（引擎回收未确认）']);
 await expect.poll(()=>run.child.exitCode,{timeout:15000}).toBe(1);
}

test.describe('关闭超时',()=>{
 test.use({engineScenario:'shutdown-gate'});
 test('已确认 utility 被外部 OS 暂停时显示十秒超时，恢复后不重复弹框且允许明确退出',async({desktop})=>{
  const controller=join(desktop.dir,'owned-process-control.exe');
  execFileSync(join(process.env.SystemRoot??'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:exe','/out:'+controller,resolve('desktop-tests/process.cs')],{windowsHide:true});
  const run=await desktop.launch();await desktop.select(run,desktop.operator);await upload(run.page);
  await expect.poll(async()=>(await desktop.observed()).filter(q=>q.moves).length).toBe(1);
  const owned=ownedProcesses(processes(),run.child.pid!);
  const bridge=owned.find(p=>p.CommandLine?.includes('node.mojom.NodeService'));
  expect(bridge).toBeTruthy();
  let suspended=false;
  const control=(action:string)=>{
   const current=processes().find(p=>p.ProcessId===bridge!.ProcessId&&p.CreationDate===bridge!.CreationDate&&p.ParentProcessId===bridge!.ParentProcessId);
   expect(current,'OS scheduling fault requires the same owned identity and parent').toBeTruthy();
   return execFileSync(controller,[action,String(current!.ProcessId),String(Date.parse(current!.CreationDate)),current!.ExecutablePath],{encoding:'utf8',windowsHide:true});
  };
  let native='';run.child.stdout?.on('data',data=>native+=data.toString());
  try {
   const prompt=requestClose(run,0);
   await expect.poll(async()=>(await desktop.observed()).some(q=>q.action==='stdin-closed')).toBe(true);
   const suspension=control('suspend');suspended=true;
   await writeFile(join(desktop.evidence,'timeout-ownership.json'),JSON.stringify({owned,suspension,io:await desktop.observed()},null,2));
   const shown=await prompt;
   await writeFile(join(desktop.evidence,'timeout-dialog.json'),JSON.stringify(shown,null,2));
   expect(shown.error).toBeUndefined();
   expect(shown.options).toMatchObject({defaultId:0,cancelId:0});
   expect(shown.options.message).toContain('关闭超时（超过10秒）');
   expect(shown.options.message).not.toContain('明确报告关闭失败');
   expect(run.child.exitCode).toBeNull();
   await run.page.screenshot({path:join(desktop.evidence,'timeout-preserved.png'),fullPage:true});
   await writeFile(desktop.observe+'.release','external adapter can finish after OS scheduling resumes');
   control('resume');suspended=false;
   await expect.poll(()=>processes().some(p=>p.ProcessId===bridge!.ProcessId&&p.CreationDate===bridge!.CreationDate)).toBe(false);
   await run.page.waitForTimeout(200);
   expect(native.match(/NATIVE_SHUTDOWN_PROMPT/g)).toHaveLength(1);
   await exitUnconfirmed(run);
   await expect.poll(()=>processes().filter(p=>owned.some(o=>p.ProcessId===o.ProcessId&&p.CreationDate===o.CreationDate)).map(p=>p.ProcessId)).toEqual([]);
  } finally {
   await writeFile(desktop.observe+'.release','failure-only external adapter release');
   if(suspended)control('resume');
   if(run.child.exitCode===null) {
    await run.app.evaluate(({app})=>app.exit(1)).catch(()=>{});
    await expect.poll(()=>run.child.exitCode).not.toBeNull();
   }
  }
 });
});

test.describe('明确关闭失败',()=>{
 test.use({engineScenario:'shutdown-gate'});
 test('平台拒绝确认引擎终止时显示明确 close 失败，不退化为超时且默认保留窗口',async({desktop})=>{
  const control=join(desktop.dir,'os-control.json');
  const run=await desktop.launch();
  // Adapt only Electron's native process creation I/O. Its ESM export and
  // Playwright's CJS export may be different objects; no product is imported.
  const installed=await run.app.evaluate(async(_electron,{adapter,control})=>{
   const vm=process.getBuiltinModule('vm');
   const {utilityProcess}=await vm.runInThisContext('import("electron")',{importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER}) as typeof import('electron');
   const fork=utilityProcess.fork;
   const adapted:typeof fork=(path,args,options)=>{
    console.log('PLATFORM_FORK '+JSON.stringify({path,adapter,control}));
    return fork(adapter,args,{...options,env:{...options?.env,DESKTOP_OS_CONTROL:control,DESKTOP_BRIDGE_ENTRY:path}});
   };
   utilityProcess.fork=adapted;
   return utilityProcess.fork===adapted;
  },{adapter:resolve('desktop-tests/platform.mjs'),control});
  expect(installed).toBe(true);
  await desktop.select(run,desktop.operator);await upload(run.page);
  await expect.poll(async()=>(await desktop.observed()).filter(q=>q.moves).length).toBe(1);
  const owned=ownedProcesses(processes(),run.child.pid!);
  const engine=owned.find(p=>p.ExecutablePath?.toLowerCase()===desktop.engine.toLowerCase());
  expect(engine,'OS refusal must target only the confirmed owned engine child').toBeTruthy();
  await writeFile(control,JSON.stringify({mode:'deny-kill',engine}));
  await writeFile(join(desktop.evidence,'close-error-ownership.json'),JSON.stringify(owned,null,2));
  try {
   const shown=await requestClose(run,0);
   await writeFile(join(desktop.evidence,'close-error-dialog.json'),JSON.stringify(shown,null,2));
   const events=await readFile(control+'.events','utf8');
   await writeFile(join(desktop.evidence,'platform-events.jsonl'),events);
   expect(events).toContain('os-kill-refused');
   expect(shown.error).toBeUndefined();
   expect(shown.options).toMatchObject({defaultId:0,cancelId:0});
   expect(shown.options.message).toContain('明确报告关闭失败');
   expect(shown.options.message).toContain('自有引擎未能在关闭期限内退出');
   expect(shown.options.message).not.toContain('超过10秒');
   expect(shown.options.detail).toContain('不能确认引擎回收');
   expect(run.child.exitCode).toBeNull();
   await expect(run.page.getByRole('heading',{name:'围棋赛后复盘',exact:true})).toBeVisible();
   await run.page.screenshot({path:join(desktop.evidence,'close-error-preserved.png'),fullPage:true});
   await writeFile(desktop.observe+'.release','release the external adapter, not a product recovery claim');
   await exitUnconfirmed(run);
   await expect.poll(()=>processes().filter(p=>owned.some(o=>p.ProcessId===o.ProcessId&&p.CreationDate===o.CreationDate)).map(p=>p.ProcessId)).toEqual([]);
  } finally {
   await writeFile(desktop.observe+'.release','failure-only external adapter release');
   if(run.child.exitCode===null) {
    // Failure-only cleanup of this test-owned application; never a passing exit.
    await run.app.evaluate(({app})=>app.exit(1)).catch(()=>{});
    await expect.poll(()=>run.child.exitCode).not.toBeNull();
   }
  }
 });
});

test.describe('回收途中 utility 异常',()=>{
 test.use({engineScenario:'shutdown-gate'});
 for(const fault of ['nonzero','zero-without-ack'])test(`外部引擎已收到 EOF 后 utility ${fault}，默认保留窗口且只允许明确非零退出`,async({desktop})=>{
  const run=await desktop.launch();await desktop.select(run,desktop.operator);await upload(run.page);
  await expect.poll(async()=>(await desktop.observed()).filter(q=>q.moves).length).toBe(1);
  const owned=ownedProcesses(processes(),run.child.pid!);
  const bridge=owned.find(p=>p.CommandLine?.includes('node.mojom.NodeService'));
  expect(bridge,'only an invocation-owned utility may receive the controlled OS fault').toBeTruthy();
  const prompt=requestClose(run,0);
  await expect.poll(async()=>(await desktop.observed()).some(q=>q.action==='stdin-closed'),{message:'external adapter must witness graceful shutdown before the OS fault'}).toBe(true);
  const current=processes().find(p=>p.ProcessId===bridge!.ProcessId&&p.CreationDate===bridge!.CreationDate);
  expect(current,'PID and creation time must still identify the owned utility').toBeTruthy();
  await writeFile(join(desktop.evidence,'shutdown-fault-ownership.json'),JSON.stringify({owned,current,io:await desktop.observed()},null,2));
  if(fault==='nonzero')process.kill(current!.ProcessId,'SIGKILL');
  else {
   const controller=join(desktop.dir,'owned-process-control.exe');
   execFileSync(join(process.env.SystemRoot??'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:exe','/out:'+controller,resolve('desktop-tests/process.cs')],{windowsHide:true});
   execFileSync(controller,['exit-zero',String(current!.ProcessId),String(Date.parse(current!.CreationDate)),current!.ExecutablePath],{windowsHide:true});
  }
  const shown=await prompt;
  if(shown.error)await expect.poll(()=>run.child.exitCode).not.toBeNull();
  await writeFile(join(desktop.evidence,'shutdown-fault-dialog.json'),JSON.stringify(shown,null,2));
  expect(shown.error).toBeUndefined();
  expect(shown.options).toMatchObject({type:'warning',defaultId:0,cancelId:0,buttons:['保留窗口','退出应用（引擎回收未确认）']});
  expect(shown.options.message).toContain(fault==='nonzero'?'异常退出':'缺少关闭确认');
  expect(shown.options.detail).toContain('不能确认引擎回收');
  expect(run.child.exitCode).toBeNull();
  await expect(run.page.getByRole('heading',{name:'围棋赛后复盘',exact:true})).toBeVisible();
  await run.page.screenshot({path:join(desktop.evidence,'shutdown-failure-preserved.png'),fullPage:true});
  await exitUnconfirmed(run);
  await expect.poll(()=>processes().filter(p=>owned.some(o=>p.ProcessId===o.ProcessId&&p.CreationDate===o.CreationDate)).map(p=>p.ProcessId)).toEqual([]);
 });
});

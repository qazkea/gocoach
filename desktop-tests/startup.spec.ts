import {test,expect,packaged,processes,ownedProcesses,upload} from './fixture';
import {createServer,request} from 'node:http';
import {_electron} from '@playwright/test';
import {cp,rm,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {execFileSync,type ChildProcess} from 'node:child_process';
import type {ElectronApplication} from '@playwright/test';
import {tmpdir} from 'node:os';

async function cleanup(app:ElectronApplication,child:ChildProcess) {
 if(child.exitCode!==null)return;
 const timer=setTimeout(()=>{if(child.exitCode===null)execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});},4000);
 try {await app.close();} finally {clearTimeout(timer);}
}

test('首次文档未加载完成时配置菜单和选择均禁用，就绪后可真实启用配置',async({desktop})=>{
 let release!:()=>void;
 const gate=new Promise<void>(resolve=>release=resolve);
 let held=false,forwarded=false;
 let probe:{enabled:boolean;opened:number;loading:boolean}|undefined;
 const proxy=createServer(async(req,res)=>{
  if(!held&&req.headers['sec-fetch-dest']==='document') {held=true;await gate;forwarded=true;}
  if(res.destroyed)return;
  const upstream=request(req.url!,{method:req.method,headers:req.headers},response=>{
   res.writeHead(response.statusCode!,response.headers);response.pipe(res);
  });
  upstream.on('error',()=>{if(!res.destroyed){res.writeHead(502);res.end();}});
  req.pipe(upstream);
 });
 await new Promise<void>(resolve=>proxy.listen(0,'127.0.0.1',resolve));
 const address=proxy.address();if(!address||typeof address==='string')throw Error('missing network adapter');
 try {
  const run=await desktop.launch({args:[`--proxy-server=http://127.0.0.1:${address.port}`,'--proxy-bypass-list=<-loopback>'],beforeWindow:async app=>{
   try {
    await expect.poll(()=>held,{message:'the external network adapter must receive and hold the FIRST document'}).toBe(true);
    probe=await app.evaluate(({Menu,dialog,BrowserWindow})=>{
     const window=BrowserWindow.getAllWindows()[0];
     const item=Menu.getApplicationMenu()!.items.find(i=>i.label==='引擎')!.submenu!.items.find(i=>i.label==='选择本地配置…')!;
     let opened=0;
     dialog.showOpenDialog=async()=>{opened++;return {canceled:true,filePaths:[]};};
     const loading=window.webContents.isLoadingMainFrame();
     // Invoke the native menu action too: disabled styling alone must not be the guard.
     item.click(item,window,{} as any);
     return {enabled:item.enabled,opened,loading};
    });
    await writeFile(join(desktop.evidence,'first-document-held.json'),JSON.stringify({held,forwarded,probe},null,2));
    expect(forwarded,'no document response was released before the native action').toBe(false);
    expect(probe.loading,'RED is valid only while loadURL is still pending').toBe(true);
   } finally {release();}
  }});
  expect(probe).toMatchObject({enabled:false,opened:0});
  await expect.poll(()=>run.app.evaluate(({Menu})=>Menu.getApplicationMenu()!.items[0].submenu!.items[1].enabled)).toBe(true);
  await desktop.select(run,desktop.operator);await upload(run.page);
  await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
  await run.page.screenshot({path:join(desktop.evidence,'ready-and-configured.png'),fullPage:true});
  await run.close();
 } finally {release();proxy.closeAllConnections();await new Promise<void>(resolve=>proxy.close(()=>resolve()));}
});

test('启动阶段立即原生退出，不遗留本实例 Electron 子进程',async({desktop})=>{
 const app=await _electron.launch({executablePath:packaged,cwd:tmpdir(),args:[`--user-data-dir=${desktop.userData}`]});
 const child=app.process(),output:string[]=[];
 child.stdout?.on('data',d=>output.push(d.toString()));
 try {
  const owned=ownedProcesses(processes(),child.pid!);
  const identities=new Map(owned.map(p=>[p.ProcessId,p.CreationDate]));
  await writeFile(join(desktop.evidence,'early-ownership.json'),JSON.stringify(owned,null,2));
  await app.evaluate(({app,dialog})=>{
   dialog.showErrorBox=(title,message)=>console.log('NATIVE_ERROR '+JSON.stringify({title,message}));
   setImmediate(()=>app.quit());
  });
  await expect.poll(()=>child.exitCode,{timeout:15000}).toBe(0);
  await writeFile(join(desktop.evidence,'early-output.txt'),output.join(''));
  expect(output.join('')).not.toContain('NATIVE_ERROR');
  await expect.poll(()=>processes().filter(p=>identities.get(p.ProcessId)===p.CreationDate).map(p=>p.ProcessId)).toEqual([]);
 } finally {await cleanup(app,child);}
});

test('破损包的桥提前退出有中文启动错误，明确非零退出而不无限重启',async({desktop})=>{
 const broken=join(desktop.dir,'broken-package');await cp(dirname(packaged),broken,{recursive:true});
 await rm(join(broken,'resources/app/.server/index.js'));
 const app=await _electron.launch({executablePath:join(broken,'Go Coach.exe'),cwd:tmpdir(),args:[`--user-data-dir=${desktop.userData}`]});
 const child=app.process();
 try {
  const error=await app.evaluate(({dialog})=>new Promise<any>(resolve=>{
   dialog.showMessageBox=(async(...args:any[])=>{resolve(args.at(-1));return {response:1,checkboxChecked:false};}) as typeof dialog.showMessageBox;
   dialog.showErrorBox=(title,message)=>resolve({title,message});
  }));
  expect(error.title).toMatch(/启动失败|本地服务退出/);
  expect(error.message).toMatch(/本地服务异常退出/);
  expect(error).toMatchObject({defaultId:0,cancelId:0});
  expect(error.buttons[1]).toBe('退出应用（引擎回收未确认）');
  await expect.poll(()=>child.exitCode,{timeout:15000}).toBe(1);
  await writeFile(join(desktop.evidence,'startup-error.json'),JSON.stringify({error,exitCode:child.exitCode},null,2));
 } finally {await cleanup(app,child);}
});

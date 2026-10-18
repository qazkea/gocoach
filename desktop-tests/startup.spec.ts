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

test('破损包默认保留可见安全错误窗口，再次原生退出可明确结束',async({desktop})=>{
 const broken=join(desktop.dir,'broken-retained');await cp(dirname(packaged),broken,{recursive:true});
 await rm(join(broken,'resources/app/.server/index.js'));
 const app=await _electron.launch({executablePath:join(broken,'Go Coach.exe'),cwd:tmpdir(),args:[`--user-data-dir=${desktop.userData}`]});
 const child=app.process();
 try {
  const first=await app.evaluate(({dialog})=>new Promise<any>(resolve=>{
   dialog.showMessageBox=(async(...args:any[])=>{resolve(args.at(-1));return {response:0,checkboxChecked:false};}) as typeof dialog.showMessageBox;
  }));
  expect(first).toMatchObject({title:'启动失败，退出未完成',defaultId:0,cancelId:0});
  expect(first.message).toContain('本地服务异常退出');
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.isVisible())),{timeout:5000}).toBe(true);
  const page=await app.firstWindow();
  await expect(page.getByRole('heading',{name:'启动失败',exact:true})).toBeVisible();
  await expect(page.locator('body')).toHaveText('启动失败启动失败，无法确认引擎回收，可用文件→退出或关闭窗口重新选择');
  expect(page.url()).toMatch(/^data:text\/html/);
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toBe("default-src 'none'");
  expect(await page.locator('script, a, iframe').count()).toBe(0);
  expect(await page.evaluate(()=>({node:typeof (window as any).require,process:typeof (window as any).process}))).toEqual({node:'undefined',process:'undefined'});
  const security=await app.evaluate(({BrowserWindow,Menu})=>{
   const w=BrowserWindow.getAllWindows()[0],p=(w.webContents as any).getLastWebPreferences();
   return {node:p.nodeIntegration,isolation:p.contextIsolation,sandbox:p.sandbox,webSecurity:p.webSecurity,exit:Menu.getApplicationMenu()!.items.find(i=>i.label==='文件')!.submenu!.items.find(i=>i.label==='退出')!.enabled};
  });
  expect(security).toEqual({node:false,isolation:true,sandbox:true,webSecurity:true,exit:true});
  const blocked=await page.evaluate(()=>new Promise(resolve=>{
   document.addEventListener('securitypolicyviolation',event=>resolve({directive:event.effectiveDirective,ran:document.body.getAttribute('data-unsafe')}),{once:true});
   const script=document.createElement('script');script.textContent="document.body.setAttribute('data-unsafe','ran')";document.body.append(script);
  }));
  expect(blocked).toEqual({directive:'script-src-elem',ran:null});
  const original=page.url();
  await page.evaluate(()=>{window.open('https://example.com');location.href='https://example.com';});
  await page.waitForTimeout(500);
  expect(page.url()).toBe(original);
  await page.reload(); // Native cancellation leaves Playwright's pending-navigation bookkeeping.
  await expect(page.getByRole('heading',{name:'启动失败',exact:true})).toBeVisible();
  expect(app.windows()).toHaveLength(1);
  const owned=ownedProcesses(processes(),child.pid!);
  expect(owned.filter(p=>p.CommandLine?.includes('--utility-sub-type=node.mojom.NodeService'))).toEqual([]);
  const identities=new Map(owned.map(p=>[p.ProcessId,p.CreationDate]));
  await page.screenshot({path:join(desktop.evidence,'retained-startup-error.png')});
  const second=await app.evaluate(({dialog,Menu,BrowserWindow})=>new Promise<any>(resolve=>{
   dialog.showMessageBox=(async(...args:any[])=>{resolve(args.at(-1));return {response:1,checkboxChecked:false};}) as typeof dialog.showMessageBox;
   const item=Menu.getApplicationMenu()!.items.find(i=>i.label==='文件')!.submenu!.items.find(i=>i.label==='退出')!;
   item.click(item,BrowserWindow.getAllWindows()[0],{} as any);
  }));
  expect(second.title).toBe('退出未完成');
  await expect.poll(()=>child.exitCode,{timeout:15000}).toBe(1);
  await expect.poll(()=>processes().filter(p=>identities.get(p.ProcessId)===p.CreationDate)).toEqual([]);
  await writeFile(join(desktop.evidence,'retained-startup.json'),JSON.stringify({first,second,security,owned,exitCode:child.exitCode,survivors:[]},null,2));
 } finally {
  if(child.exitCode===null)await app.evaluate(({dialog})=>{dialog.showMessageBox=(async()=>({response:1,checkboxChecked:false})) as typeof dialog.showMessageBox;}).catch(()=>{});
  await cleanup(app,child);
 }
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

import {test,expect,packaged,upload,ownedProcesses,processes} from './fixture';
import {join,dirname,resolve} from 'node:path';
import {readFile,writeFile,readdir,cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import type {ElectronApplication,Page} from '@playwright/test';

async function status(app:ElectronApplication) {return app.evaluate(({Menu})=>Menu.getApplicationMenu()?.items.find(i=>i.label==='讲解')?.submenu?.items[0].label);}
async function click(app:ElectronApplication,label='配置 DeepSeek Key…') {
 await app.evaluate(({Menu,BrowserWindow},label)=>{const i=Menu.getApplicationMenu()!.items.find(i=>i.label==='讲解')!.submenu!.items.find(i=>i.label===label)!;i.click(i,BrowserWindow.getAllWindows()[0],{} as any);},label);
}
async function configure(app:ElectronApplication) {const opened=app.waitForEvent('window');await click(app);const page=await opened;await page.getByLabel('DeepSeek Key',{exact:true}).waitFor();return page;}
async function submit(page:Page,key:string) {await page.getByLabel('DeepSeek Key',{exact:true}).fill(key);await page.getByRole('button',{name:'保存',exact:true}).click();}
const secret='synthetic-boundary-08A-Z17';

test('格式拒绝、取消及专用窗口单例不破坏本地复盘',async({desktop})=>{
 const run=await desktop.launch(),page=await configure(run.app);
 await click(run.app);expect(run.app.windows()).toHaveLength(2);
 for(const key of ['', 'a b', 'a\tb','中文','x'.repeat(513)]) {
  await submit(page,key);await expect(page.getByRole('alert')).toContainText('请输入');
  await expect(page.getByLabel('DeepSeek Key',{exact:true})).toHaveValue('');
  expect(await status(run.app)).toBe('未配置');
 }
 await submit(page,'  '+secret+'  ');await expect.poll(()=>page.isClosed()).toBe(true);
 const record=await readFile(join(desktop.userData,'go-coach/credentials.json'),'utf8');
 const next=await configure(run.app);await next.getByLabel('DeepSeek Key',{exact:true}).fill('discard-only');
 await next.getByRole('button',{name:'取消',exact:true}).click();await expect.poll(()=>next.isClosed()).toBe(true);
 expect(await readFile(join(desktop.userData,'go-coach/credentials.json'),'utf8')).toBe(record);
 await expect(run.page.getByRole('heading',{name:'围棋赛后复盘',exact:true})).toBeVisible();
 await run.close();
});

test('main通过真实IPC拒绝非字符串、内部控制符及超长输入',async({desktop})=>{
 const run=await desktop.launch(),page=await configure(run.app);
 for(const input of [null,{},['key'],'a\nb','a\rb','a\u0000b','x'.repeat(513),'\t \n']) {
  expect(await page.evaluate(value=>(window as any).secretAPI.submitKey(value),input)).toBe('invalid');
 }
 expect(await status(run.app)).toBe('未配置');
 await page.getByRole('button',{name:'取消',exact:true}).click();await expect.poll(()=>page.isClosed()).toBe(true);await run.close();
});

test('真实IPC拒绝其他窗口、iframe、query/hash身份；CSP隔离网络与脚本',async({desktop})=>{
 const run=await desktop.launch();let page=await configure(run.app);const url=page.url();
 const preferences=await run.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({url:w.webContents.getURL(),preferences:(w.webContents as any).getLastWebPreferences()})));
 const prefs=preferences.find(p=>p.url===url)!.preferences;
 expect(prefs.sandbox).toBe(true);expect(prefs.contextIsolation).toBe(true);expect(prefs.nodeIntegration).toBe(false);expect(prefs.webSecurity).toBe(true);
 expect(preferences.find(p=>p.url===run.page.url())!.preferences.preload).toBeUndefined();
 expect(await page.evaluate(()=>Object.keys((window as any).secretAPI).sort())).toEqual(['cancel','submitKey']);
 const violations=await page.evaluate(async()=>{
  const seen:string[]=[];document.addEventListener('securitypolicyviolation',e=>seen.push(e.effectiveDirective));
  const s=document.createElement('script');s.textContent="document.body.dataset.bad='yes'";document.body.append(s);
  const frame=document.createElement('iframe');frame.src=location.href;document.body.append(frame);
  await fetch('https://invalid.invalid/no-network').catch(()=>{});
  window.open('https://invalid.invalid/no-window');
  await new Promise(r=>setTimeout(r,150));return {seen,bad:document.body.dataset.bad};
 });
 expect(violations.seen).toEqual(expect.arrayContaining(['script-src-elem','frame-src','connect-src']));expect(violations.bad).toBeUndefined();
 expect(run.app.windows()).toHaveLength(2);
 for(const suffix of ['?forged=1','#forged']) {
  await page.evaluate(({url,suffix})=>history.replaceState({},'',url+suffix),{url,suffix}).catch(()=>{});
  await expect.poll(()=>page.isClosed()).toBe(true);
  expect(await status(run.app)).toBe('未配置');
  page=await configure(run.app);
 }
 // External malicious BrowserWindow is an IPC client; no product renderer gets new capabilities.
 const opened=run.app.waitForEvent('window');
 await run.app.evaluate(async({app,BrowserWindow},url)=>{
  const hostile=new BrowserWindow({show:false,webPreferences:{preload:app.getAppPath()+'/desktop/credentials/preload.cjs',nodeIntegration:false,nodeIntegrationInSubFrames:true,contextIsolation:true,sandbox:false}});
  await hostile.loadURL(url);
 },url);
 const hostile=await opened;await hostile.waitForLoadState();
 expect(await hostile.evaluate(()=> (window as any).secretAPI.submitKey('synthetic-hostile'))).toBe('denied');
 await hostile.evaluate(()=>{const frame=document.createElement('iframe');frame.src='about:blank';document.body.append(frame);});
 // Product CSP blocks iframe creation here; exercise senderFrame guard in external unrestricted document.
 const hostileId=await run.app.evaluate(({BrowserWindow},url)=>Math.max(...BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL()===url).map(w=>w.webContents.id)),url);
 await run.app.evaluate(async({BrowserWindow},id)=>{await BrowserWindow.getAllWindows().find(w=>w.webContents.id===id)!.loadURL('data:text/html,<iframe src="data:text/html,ipc-client"></iframe>');},hostileId);
 await expect.poll(()=>hostile.frames().length).toBe(2);
 const frame=hostile.frames().find(f=>f!==hostile.mainFrame())!;
 expect(await frame.evaluate(()=> (window as any).secretAPI.submitKey('synthetic-iframe'))).toBe('denied');
 await hostile.close();
 expect(await status(run.app)).toBe('未配置');
 await page.getByRole('button',{name:'取消',exact:true}).click();await run.close();
});

test('safeStorage故障和Windows写拒绝保留旧密文，坏密文恢复明确停用',async({desktop})=>{
 let run=await desktop.launch(),page=await configure(run.app);
 await submit(page,secret);await expect.poll(()=>page.isClosed()).toBe(true);
 const file=join(desktop.userData,'go-coach/credentials.json'),record=await readFile(file,'utf8');
 for(const mode of ['unavailable','encrypt','decrypt','reencrypt']) {
  // OS API seam only; product validation, encryption orchestration and IPC run unchanged.
  await run.app.evaluate(({safeStorage},mode)=>{
   const os=safeStorage as any;
   os.__original??={available:os.isAsyncEncryptionAvailable.bind(os),encrypt:os.encryptStringAsync.bind(os),decrypt:os.decryptStringAsync.bind(os)};
   os.isAsyncEncryptionAvailable=async()=>mode!=='unavailable';
   os.encryptStringAsync=mode==='encrypt'?async()=>{throw Error('synthetic-native-failure');}:os.__original.encrypt;
   os.__hints=0;
   os.decryptStringAsync=mode==='decrypt'?async()=>{throw Error('synthetic-native-failure');}:mode==='reencrypt'?async(cipher:Buffer)=>{const decoded=await os.__original.decrypt(cipher);os.__hints++;return {...decoded,shouldReEncrypt:true};}:os.__original.decrypt;
  },mode);
  page=await configure(run.app);await submit(page,'synthetic-failure-attempt');
  await expect(page.getByRole('alert')).toContainText('密钥不可用');expect(await readFile(file,'utf8')).toBe(record);
  if(mode==='reencrypt')expect(await run.app.evaluate(({safeStorage})=>(safeStorage as any).__hints)).toBe(1);
  await page.getByRole('button',{name:'取消',exact:true}).click();await expect.poll(()=>page.isClosed()).toBe(true);
 }
 await run.close();run=await desktop.launch();expect(await status(run.app)).toBe('本机已保存，尚未启用在线讲解');
 const directory=join(desktop.userData,'go-coach');
 const sid=execFileSync('powershell.exe',['-NoProfile','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8'}).trim();
 try {
  execFileSync('icacls.exe',[directory,'/deny',`*${sid}:(WD,AD)`],{windowsHide:true});
  page=await configure(run.app);await submit(page,'synthetic-write-refused');await expect(page.getByRole('alert')).toContainText('密钥不可用');
  expect(await readFile(file,'utf8')).toBe(record);
 } finally {execFileSync('icacls.exe',[directory,'/remove:d','*'+sid],{windowsHide:true});}
 await page.getByRole('button',{name:'取消',exact:true}).click();await run.close();
 await writeFile(file,'{"version":1,"ciphertext":"broken!"}');
 run=await desktop.launch();expect(await status(run.app)).toBe('密钥不可用，请重新配置');
 expect(await readdir(directory)).not.toContain('credentials.tmp');await run.close();
});

test('恢复拒绝超限、未知字段和无法解密的规范base64；删除失败不谎报成功',async({desktop})=>{
 let run=await desktop.launch(),page=await configure(run.app);
 await submit(page,secret);await expect.poll(()=>page.isClosed()).toBe(true);
 const file=join(desktop.userData,'go-coach/credentials.json'),record=await readFile(file,'utf8');
 const sid=execFileSync('powershell.exe',['-NoProfile','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8'}).trim();
 try {
  execFileSync('icacls.exe',[file,'/deny',`*${sid}:(D)`],{windowsHide:true});
  await run.app.evaluate(({dialog})=>{dialog.showMessageBox=(async()=>({response:1,checkboxChecked:false})) as typeof dialog.showMessageBox;});
  await click(run.app,'删除已保存Key…');await expect.poll(()=>status(run.app)).toBe('密钥不可用，请重新配置');
 } finally {execFileSync('icacls.exe',[file,'/remove:d','*'+sid],{windowsHide:true});}
 expect(await readFile(file,'utf8')).toBe(record);
 await run.close();
 for(const corrupted of ['x'.repeat(16385),JSON.stringify({...JSON.parse(record),extra:true}),'{"version":1,"ciphertext":"AA=="}']) {
  await writeFile(file,corrupted);run=await desktop.launch();expect(await status(run.app)).toBe('密钥不可用，请重新配置');await run.close();
 }
});

test('在途加密取消和主退出使晚到结果失效，main拒绝重复提交',async({desktop})=>{
 const run=await desktop.launch();
 await run.app.evaluate(({safeStorage})=>{
  const original=safeStorage.encryptStringAsync.bind(safeStorage);
  safeStorage.encryptStringAsync=async value=>{await new Promise(r=>setTimeout(r,600));return original(value);};
 });
 let page=await configure(run.app);
 // Two actual renderer IPC calls, not a fabricated ipcMain event.
 const repeated=await page.evaluate(()=>{void (window as any).secretAPI.submitKey('synthetic-delayed').catch(()=>{});return (window as any).secretAPI.submitKey('synthetic-reentry');});
 expect(repeated).toBe('busy');
 await expect.poll(()=>page.isClosed()).toBe(true);
 const file=join(desktop.userData,'go-coach/credentials.json'),record=await readFile(file,'utf8');
 page=await configure(run.app);await submit(page,'synthetic-cancelled-late');
 await page.getByRole('button',{name:'取消',exact:true}).click();await expect.poll(()=>page.isClosed()).toBe(true);
 await new Promise(r=>setTimeout(r,900));expect(await readFile(file,'utf8')).toBe(record);
 page=await configure(run.app);await submit(page,'synthetic-quit-late');
 await run.app.evaluate(({Menu,BrowserWindow})=>{const item=Menu.getApplicationMenu()!.items[1].submenu!.items[0];item.click(item,BrowserWindow.getAllWindows()[0],{} as any);});
 await expect.poll(()=>run.child.exitCode,{timeout:15000}).toBe(0);
 expect(await readFile(file,'utf8')).toBe(record);
});

test('密码窗与引擎选择互斥，主窗关闭仍经utility确认回收且秘密不进入消息或HTTP',async({desktop})=>{
 const copy=join(desktop.dir,'observed-package');await cp(dirname(packaged),copy,{recursive:true});
 const application=join(copy,'resources/app');
 await cp(resolve('desktop-tests/credentials-platform.mjs'),join(application,'desktop/credentials-platform.mjs'));
 const manifest=JSON.parse(await readFile(join(application,'package.json'),'utf8'));
 manifest.main='desktop/credentials-platform.mjs';await writeFile(join(application,'package.json'),JSON.stringify(manifest));
 const observation=join(desktop.dir,'utility-messages.jsonl');
 const run=await desktop.launch({exe:join(copy,'Go Coach.exe'),args:['--credential-observe='+observation]});
 await desktop.select(run,desktop.operator);await upload(run.page);
 await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 const requests:string[]=[];run.page.on('request',request=>requests.push(request.url()+' '+(request.postData()??'')));
 const page=await configure(run.app);
 const blocked=await run.app.evaluate(({Menu,dialog,BrowserWindow})=>{
  let opened=0;dialog.showOpenDialog=async()=>{opened++;return {canceled:true,filePaths:[]};};
  const item=Menu.getApplicationMenu()!.items[0].submenu!.items[1];item.click(item,BrowserWindow.getAllWindows()[0],{} as any);
  return {opened,enabled:item.enabled};
 });
 expect(blocked).toEqual({opened:0,enabled:false});
 await submit(page,secret);await expect.poll(()=>page.isClosed()).toBe(true);
 const again=await configure(run.app);await again.getByLabel('DeepSeek Key',{exact:true}).fill('synthetic-unsaved-on-close');
 const owned=ownedProcesses(processes(),run.child.pid!);
 await run.app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url)!.close(),run.page.url());
 await expect.poll(()=>run.child.exitCode,{timeout:15000}).toBe(0);
 await expect.poll(()=>processes().filter(p=>owned.some(o=>p.ProcessId===o.ProcessId&&p.CreationDate===o.CreationDate))).toEqual([]);
 const messages=await readFile(observation,'utf8');expect(messages).not.toContain(secret);expect(messages).not.toContain('synthetic-unsaved-on-close');
 expect(messages).toContain('"direction":"to-utility","message":"close"');expect(messages).toContain('"type":"closed"');
 expect(JSON.stringify(requests)).not.toContain(secret);
 expect(requests.every(url=>url.startsWith('http://127.0.0.1:'))).toBe(true);
 await writeFile(join(desktop.evidence,'utility-observations.jsonl'),messages);
 await writeFile(join(desktop.evidence,'secret-window-main-close.json'),JSON.stringify({exitCode:run.child.exitCode,owned,survivors:[],requests},null,2));
});

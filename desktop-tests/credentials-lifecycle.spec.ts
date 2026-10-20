import {test,expect,packaged,upload,processes,ownedProcesses} from './fixture';
import {join,dirname,resolve} from 'node:path';
import {cp,readFile,writeFile,readdir} from 'node:fs/promises';

async function configure(run:any) {
 const opened=run.app.waitForEvent('window');
 await run.app.evaluate(({Menu,BrowserWindow}:any)=>{const i=Menu.getApplicationMenu().items.find((i:any)=>i.label==='讲解').submenu.items[1];i.click(i,BrowserWindow.getAllWindows()[0],{});});
 const page=await opened;await page.getByLabel('DeepSeek Key',{exact:true}).waitFor();return page;
}
async function submit(page:any,key='synthetic-lifecycle-only') {await page.getByLabel('DeepSeek Key',{exact:true}).fill(key);await page.getByRole('button',{name:'保存',exact:true}).click();}
async function status(run:any) {return run.app.evaluate(({Menu}:any)=>Menu.getApplicationMenu().items.find((i:any)=>i.label==='讲解').submenu.items[0].label);}
async function observedPackage(desktop:any,mode?:string) {
 const copy=join(desktop.dir,'observed');await cp(dirname(packaged),copy,{recursive:true});
 const root=join(copy,'resources/app');await cp(resolve('desktop-tests/credentials-platform.mjs'),join(root,'desktop/credentials-platform.mjs'));
 const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));manifest.main=mode?'desktop/credential-delay-platform.mjs':'desktop/credentials-platform.mjs';
 if(mode)await cp(resolve('desktop-tests/credential-delay-platform.mjs'),join(root,'desktop/credential-delay-platform.mjs'));
 await writeFile(join(root,'package.json'),JSON.stringify(manifest));
 return {exe:join(copy,'Go Coach.exe'),args:['--credential-observe='+join(desktop.evidence,'utility.jsonl'),'--credential-delay='+mode,'--release='+join(desktop.dir,'release'),'--reached='+join(desktop.dir,'reached')]};
}
test('OS加密永不返回仍经真实引擎关闭确认退出',async({desktop})=>{
 const run=await desktop.launch(await observedPackage(desktop));await desktop.select(run,desktop.operator);await upload(run.page);
 await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 await run.app.evaluate(({safeStorage}:any)=>{safeStorage.encryptStringAsync=()=>new Promise(()=>{});});
 const page=await configure(run);await submit(page);
 const owned=ownedProcesses(processes(),run.child.pid!);
 await run.app.evaluate(({BrowserWindow}:any,url:string)=>BrowserWindow.getAllWindows().find((w:any)=>w.webContents.getURL()===url).close(),run.page.url());
 await expect.poll(()=>run.child.exitCode,{timeout:5000}).toBe(0);
 await expect.poll(()=>processes().filter(p=>owned.some(o=>o.ProcessId===p.ProcessId&&o.CreationDate===p.CreationDate))).toEqual([]);
 const messages=await readFile(join(desktop.evidence,'utility.jsonl'),'utf8');expect(messages).toContain('"message":"close"');expect(messages).toContain('"type":"closed"');
 expect(await readdir(join(desktop.userData,'go-coach'))).not.toContain('credentials.json');
});

test('取消旧OS操作后可新保存且旧回调不释放新busy或覆盖密文',async({desktop})=>{
 const run=await desktop.launch();
 await run.app.evaluate(({safeStorage}:any)=>{const original=safeStorage.encryptStringAsync.bind(safeStorage);safeStorage.__gates=[];safeStorage.__completed=0;safeStorage.encryptStringAsync=async(value:string)=>{await new Promise(r=>safeStorage.__gates.push(r));const cipher=await original(value);safeStorage.__completed++;return cipher;};});
 let page=await configure(run);await submit(page,'synthetic-old');
 await expect.poll(()=>run.app.evaluate(({safeStorage}:any)=>safeStorage.__gates.length)).toBe(1);
 await page.getByRole('button',{name:'取消',exact:true}).click();
 page=await configure(run);await submit(page,'synthetic-new');
 await expect.poll(()=>run.app.evaluate(({safeStorage}:any)=>safeStorage.__gates.length)).toBe(2);
 await run.app.evaluate(({safeStorage}:any)=>safeStorage.__gates[0]());
 await expect.poll(()=>run.app.evaluate(({safeStorage}:any)=>safeStorage.__completed)).toBe(1);
 expect(await page.evaluate(()=>(window as any).secretAPI.submitKey('synthetic-reentry'))).toBe('busy');
 await run.app.evaluate(({safeStorage}:any)=>safeStorage.__gates[1]());
 await expect.poll(()=>page.isClosed()).toBe(true);expect(await status(run)).toBe('本机已保存，尚未启用在线讲解');
 const record=await readFile(join(desktop.userData,'go-coach/credentials.json'),'utf8');await run.close();
 const next=await desktop.launch();expect(await status(next)).toBe('本机已保存，尚未启用在线讲解');expect(await readFile(join(desktop.userData,'go-coach/credentials.json'),'utf8')).toBe(record);await next.close();
});

for(const mode of ['available','decrypt','read'])test(`恢复${mode}挂起10秒后可本地复盘并明确停用`,async({desktop})=>{
 const seed=await desktop.launch();const page=await configure(seed);await submit(page);await expect.poll(()=>page.isClosed()).toBe(true);await seed.close();
 const options=await observedPackage(desktop,mode);options.args.push('--fail');const start=Date.now();const run=await desktop.launch(options);
 expect(Date.now()-start).toBeGreaterThanOrEqual(9500);expect(Date.now()-start).toBeLessThan(16000);
 expect(await status(run)).toBe('密钥不可用，请重新配置');await upload(run.page);await expect(run.page.getByRole('region',{name:'棋谱回放'})).toBeVisible();
 const replacement=await configure(run);await submit(replacement,'synthetic-after-restore-timeout');await expect.poll(()=>replacement.isClosed()).toBe(true);
 const record=await readFile(join(desktop.userData,'go-coach/credentials.json'),'utf8');
 await writeFile(join(desktop.dir,'release'),'release');await new Promise(r=>setTimeout(r,400));
 expect(await status(run)).toBe('本机已保存，尚未启用在线讲解');expect(await readFile(join(desktop.userData,'go-coach/credentials.json'),'utf8')).toBe(record);await run.close();
});

for(const mode of ['writeFile','sync','rename'])for(const behavior of ['cancel','failure','quit'])test(`${mode}阶段${behavior}不交错写入也不阻塞引擎回收`,async({desktop})=>{
 const seed=await desktop.launch(),first=await configure(seed);await submit(first);await expect.poll(()=>first.isClosed()).toBe(true);await seed.close();
 const file=join(desktop.userData,'go-coach/credentials.json'),old=await readFile(file,'utf8');
 const options=await observedPackage(desktop,mode);if(behavior==='failure')options.args.push('--fail');
 const run=await desktop.launch(options);await desktop.select(run,desktop.operator);await upload(run.page);await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 const page=await configure(run);await submit(page,'synthetic-late-write');
 await expect.poll(()=>readFile(join(desktop.dir,'reached'),'utf8').catch(()=>'')).toBe('reached');
 if(behavior==='quit') {
  const owned=ownedProcesses(processes(),run.child.pid!);
  await run.app.evaluate(({BrowserWindow}:any,url:string)=>BrowserWindow.getAllWindows().find((w:any)=>w.webContents.getURL()===url).close(),run.page.url());
  await expect.poll(()=>run.child.exitCode,{timeout:5000}).toBe(0);
  await expect.poll(()=>processes().filter(p=>owned.some(o=>o.ProcessId===p.ProcessId&&o.CreationDate===p.CreationDate))).toEqual([]);
  const messages=await readFile(join(desktop.evidence,'utility.jsonl'),'utf8');expect(messages).toContain('"message":"close"');expect(messages).toContain('"type":"closed"');expect(await readFile(file,'utf8')).toBe(old);
 } else {
  if(behavior==='cancel') {
   await page.getByRole('button',{name:'取消',exact:true}).click();
   await expect.poll(()=>status(run)).toContain('请等待或重启');
   const enabled=await run.app.evaluate(({Menu}:any)=>Menu.getApplicationMenu().items.find((i:any)=>i.label==='讲解').submenu.items.slice(1).map((i:any)=>i.enabled));expect(enabled).toEqual([false,false]);
  } else {
   // Real deadline, without replacing clocks. A pending write retains exclusion.
   await expect(page.getByRole('alert')).toContainText('密钥不可用',{timeout:12000});
   expect(await status(run)).toContain('请等待或重启');
   expect(await page.evaluate(()=>(window as any).secretAPI.submitKey('synthetic-reentry'))).toBe('busy');
  }
  await writeFile(join(desktop.dir,'release'),'release');
  await expect.poll(()=>status(run)).toBe('密钥不可用，请重新配置');
  if(mode!=='rename'||behavior==='failure')expect(await readFile(file,'utf8')).toBe(old);
  else expect(await readFile(file,'utf8')).not.toBe(old); // Already-dispatched rename cannot be retracted.
  await expect.poll(async()=>(await readdir(join(desktop.userData,'go-coach'))).filter(n=>n.endsWith('.tmp'))).toEqual([]);
  if(!page.isClosed())await page.getByRole('button',{name:'取消',exact:true}).click();await run.close();
 }
});

test('保存OS超时可见并允许新操作，晚旧回调不覆盖新密文',async({desktop})=>{
 const run=await desktop.launch();
 await run.app.evaluate(({safeStorage}:any)=>{const original=safeStorage.encryptStringAsync.bind(safeStorage);let first=true;safeStorage.encryptStringAsync=async(value:string)=>{if(first){first=false;await new Promise(r=>safeStorage.__release=r);}return original(value);};});
 const page=await configure(run);await submit(page,'synthetic-timeout-old');await expect(page.getByRole('alert')).toContainText('密钥不可用',{timeout:12000});
 await submit(page,'synthetic-timeout-new');await expect.poll(()=>page.isClosed()).toBe(true);
 const file=join(desktop.userData,'go-coach/credentials.json'),record=await readFile(file,'utf8');await run.app.evaluate(({safeStorage}:any)=>safeStorage.__release());await new Promise(r=>setTimeout(r,400));
 expect(await status(run)).toBe('本机已保存，尚未启用在线讲解');expect(await readFile(file,'utf8')).toBe(record);await run.close();
});

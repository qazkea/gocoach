import {test,expect} from './fixture';
import {join} from 'node:path';
import {readFile,readdir,writeFile} from 'node:fs/promises';

async function inspect(directory:string,secrets:string[]) {
 const files:string[]=[];
 for(const item of await readdir(directory,{withFileTypes:true})) {
  const file=join(directory,item.name);
  if(item.isDirectory())files.push(...await inspect(file,secrets));
  else if(item.isFile()) {const bytes=await readFile(file);for(const key of secrets) {expect(bytes.includes(Buffer.from(key))).toBe(false);expect(bytes.includes(Buffer.from(key,'utf16le'))).toBe(false);}files.push(file);}
 }
 return files;
}

async function status(app:any) {
 return app.evaluate(({Menu}:any)=>Menu.getApplicationMenu()?.items.find((i:any)=>i.label==='讲解')?.submenu?.items[0].label);
}
async function configure(run:any) {
 const opened=run.app.waitForEvent('window');
 await run.app.evaluate(({Menu,BrowserWindow}:any)=>{
  const item=Menu.getApplicationMenu()?.items.find((i:any)=>i.label==='讲解')?.submenu?.items.find((i:any)=>i.label==='配置 DeepSeek Key…');
  if(!item)throw Error('缺少独立密码窗菜单');
  item.click(item,BrowserWindow.getAllWindows()[0],{});
 });
 const page=await opened;await page.getByLabel('DeepSeek Key',{exact:true}).waitFor();return page;
}

test('本机合成Key实际OS加密保存、重启恢复、替换与默认取消删除',async({desktop})=>{
 let run=await desktop.launch();
 const requests:string[]=[];
 const watch=(page:any)=>page.on('request',(request:any)=>requests.push(request.url()+' '+(request.postData()??'')));
 run.app.on('window',watch);watch(run.page);
 expect(await status(run.app)).toBe('未配置');
 const secret='synthetic-08A-only-A5';
 let password=await configure(run);
 expect(await password.getByLabel('DeepSeek Key',{exact:true}).getAttribute('type')).toBe('password');
 await password.getByLabel('DeepSeek Key',{exact:true}).fill(secret);
 await password.getByRole('button',{name:'保存',exact:true}).click();
 await expect.poll(()=>status(run.app)).toBe('本机已保存，尚未启用在线讲解');
 await expect.poll(()=>password.isClosed()).toBe(true);
 expect(await run.page.evaluate(()=>typeof (globalThis as any).secretAPI)).toBe('undefined');
 const record=await readFile(join(desktop.userData,'go-coach/credentials.json'),'utf8');
 expect(record).not.toContain(secret);
 await writeFile(join(desktop.evidence,'ciphertext-record.json'),record);
 await run.close();run=await desktop.launch();run.app.on('window',watch);watch(run.page);
 expect(await status(run.app)).toBe('本机已保存，尚未启用在线讲解');
 password=await configure(run);
 await expect(password.getByLabel('DeepSeek Key',{exact:true})).toHaveValue('');
 await password.screenshot({path:join(desktop.evidence,'password.png')});
 await expect(password.getByText('本机加密不能防止同一 Windows 用户下的恶意程序。')).toBeInViewport({ratio:1});
 await password.getByLabel('DeepSeek Key',{exact:true}).fill('synthetic-08A-only-replacement');
 await password.getByRole('button',{name:'保存',exact:true}).click();
 await expect.poll(()=>password.isClosed()).toBe(true);
 expect(await readFile(join(desktop.userData,'go-coach/credentials.json'),'utf8')).not.toBe(record);
 const retained=join(desktop.userData,'go-coach/future-unknown-costs.txt');
 await writeFile(retained,'synthetic retained history');
 for(const response of [0,1]) {
  const options=await run.app.evaluate(async({Menu,dialog,BrowserWindow}:any,response:number)=>{
   let observed:any;dialog.showMessageBox=async(...args:any[])=>{observed=args.at(-1);return {response};};
   const item=Menu.getApplicationMenu().items.find((i:any)=>i.label==='讲解').submenu.items.find((i:any)=>i.label==='删除已保存Key…');
   await item.click(item,BrowserWindow.getAllWindows()[0],{});return observed;
  },response);
  expect(options.defaultId).toBe(0);expect(options.cancelId).toBe(0);
  await expect.poll(()=>status(run.app)).toBe(response?'未配置':'本机已保存，尚未启用在线讲解');
 }
 await run.close();
 expect(await readFile(retained,'utf8')).toBe('synthetic retained history');
 const secrets=[secret,'synthetic-08A-only-replacement'];
 const files=await inspect(desktop.dir,secrets);
 const logs=await inspect(desktop.evidence,secrets);
 for(const key of secrets) {
  expect(JSON.stringify(requests)).not.toContain(key);
  expect(JSON.stringify(await desktop.observed())).not.toContain(key);
 }
 expect(requests.filter(url=>/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:'))).toEqual([]);
 await writeFile(join(desktop.evidence,'plaintext-check.json'),JSON.stringify({files,logs,httpRequests:requests.length,plainTextMatches:0,scope:'owned isolated profile and test directory, observed renderer HTTP and synthetic engine I/O; not OS memory'},null,2));
});

import {test,expect,packaged,processes,ownedProcesses} from './fixture';
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

test('破损包的桥提前退出有中文启动错误并正常关闭，不无限重启',async({desktop})=>{
 const broken=join(desktop.dir,'broken-package');await cp(dirname(packaged),broken,{recursive:true});
 await rm(join(broken,'resources/app/.server/index.js'));
 const app=await _electron.launch({executablePath:join(broken,'Go Coach.exe'),cwd:tmpdir(),args:[`--user-data-dir=${desktop.userData}`]});
 const child=app.process();
 try {
  const error=await app.evaluate(({dialog})=>new Promise<{title:string;message:string}>(resolve=>{
   dialog.showErrorBox=(title,message)=>resolve({title,message});
  }));
  expect(error.title).toMatch(/启动失败|本地服务退出/);
  expect(error.message).toMatch(/本地服务/);
  await expect.poll(()=>child.exitCode,{timeout:15000}).toBe(0);
  await writeFile(join(desktop.evidence,'startup-error.json'),JSON.stringify({error,exitCode:child.exitCode},null,2));
 } finally {await cleanup(app,child);}
});

import {test, expect, _electron} from '@playwright/test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
test('打包桌面从异 cwd 启动未配置回放窗口并正常关闭', async()=>{
 const data=await mkdtemp(join(tmpdir(),'go-coach-desktop-'));
 let app:Awaited<ReturnType<typeof _electron.launch>>|undefined;
 let child:import('node:child_process').ChildProcess|undefined;
 try {
  app=await _electron.launch({executablePath:resolve('desktop-release/win-unpacked/Go Coach.exe'),cwd:tmpdir(),args:[`--user-data-dir=${data}`]});
  child=app.process();
  const page=await app.firstWindow();
  await expect(page.getByRole('heading',{name:'围棋赛后复盘',exact:true})).toBeVisible();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  await new Promise<void>(r=>child!.exitCode!==null?r():child!.once('exit',()=>r()));
  expect(child.exitCode).toBe(0);
 } finally {if(app&&child?.exitCode===null)await app.close();await rm(data,{recursive:true,force:true});}
});

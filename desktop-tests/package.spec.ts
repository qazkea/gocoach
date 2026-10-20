import {test,expect,packaged,upload} from './fixture';
import {cp,mkdir,readdir,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname,join} from 'node:path';

test('完整目录移动至中文空格只读位置，从异 cwd 运行并扫描，无源代码或模型随包',async({desktop})=>{
 const moved=join(desktop.dir,'移动 中文 免安装目录');
 await mkdir(moved);
 await cp(dirname(packaged),moved,{recursive:true});
 const sid=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true}).trim();
 try {
  execFileSync('icacls.exe',[moved,'/deny',`*${sid}:(OI)(CI)(WD,AD)`],{windowsHide:true});
  await expect(writeFile(join(moved,'must-not-write.txt'),'probe')).rejects.toThrow();
  expect((await readdir(join(moved,'resources/app'))).sort()).toEqual(['.server','desktop','dist','package.json']);
  expect((await readdir(join(moved,'resources/app/desktop'))).sort()).toEqual(['bootstrap.mjs','config.mjs','credentials','credentials.mjs','main.mjs']);
  expect((await readdir(join(moved,'resources/app/desktop/credentials'))).sort()).toEqual(['form.js','index.html','preload.cjs','style.css']);
  const run=await desktop.launch({exe:join(moved,'Go Coach.exe')});
  await desktop.select(run,desktop.operator);await upload(run.page);
  await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
  await run.page.screenshot({path:join(desktop.evidence,'moved-package.png'),fullPage:true});
  await run.close();
  expect(await readdir(moved)).not.toContain('must-not-write.txt');
 } finally {
  execFileSync('icacls.exe',[moved,'/remove:d','*'+sid,'/T','/C'],{windowsHide:true});
  await rm(moved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
});

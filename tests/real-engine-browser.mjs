// Explicit operator-run synthetic acceptance, not part of the controlled suite.
// GO_COACH_CONFIG and GO_COACH_EVIDENCE must point outside the repository.
import {chromium,expect} from '@playwright/test';
import {fork} from 'node:child_process';
import {stopOwnedChild,waitForListening} from './process-cleanup.ts';
import {mkdir,writeFile,appendFile,readFile,readdir,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
if(!process.env.GO_COACH_CONFIG||!process.env.GO_COACH_EVIDENCE)throw Error('Set GO_COACH_CONFIG and GO_COACH_EVIDENCE');
const evidence=resolve(process.env.GO_COACH_EVIDENCE);await mkdir(evidence,{recursive:true});
const config=JSON.parse(await readFile(process.env.GO_COACH_CONFIG,'utf8'));
const child=fork(resolve('.server/index.js'),['--production','--port','0'],{silent:true,env:{...process.env,GO_COACH_TEST_ENGINE:''}});
const writes=[], enginePids=new Set();let stdout='';
child.stdout.on('data',d=>{writes.push(appendFile(join(evidence,'server.stdout.log'),d));stdout+=d;for(const m of stdout.matchAll(/ENGINE pid=(\d+)/g))enginePids.add(Number(m[1]));});
child.stderr.on('data',d=>writes.push(appendFile(join(evidence,'server.stderr.log'),d)));
let browser;const records=[];let failure;
try {
 const url=await waitForListening(child);
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1100}});
 // Chromium does not retain bodies consumed through the streaming reader.
 // Capture real browser requests here; opt-in KataGo logs retain raw responses.
 page.on('request',request=>{if(request.url().endsWith('/api/analyze'))writes.push(appendFile(join(evidence,'http-inputs.jsonl'),request.postData()+'\n'));});
 const panel=()=>page.getByRole('region',{name:'本地引擎分析'});
 async function capture(name,action){
  const start=performance.now();await action();
  await expect(panel().locator('p[aria-live]')).toHaveText(/分析完成|分析失败/,{timeout:640000});
  const text=await panel().innerText();const seconds=(performance.now()-start)/1000;
  records.push({name,seconds,text});console.log(name+': '+seconds.toFixed(3)+'s '+await panel().locator('p[aria-live]').innerText());
  await page.screenshot({path:join(evidence,name+'.png'),fullPage:true});
  await writeFile(join(evidence,'summary.json'),JSON.stringify(records,null,2));
  if(text.includes('分析失败'))throw Error(name+': '+text);
  await expect(panel()).toContainText('KataGo v1.18.1 OpenCL');
 }
 async function upload(sgf,end=true){
  await page.goto(url);
  await page.getByLabel('导入后自动整局扫描').uncheck();
  await page.getByLabel('选择 SGF 文件').setInputFiles({name:'synthetic.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(sgf)});
  if(end)await page.getByRole('button',{name:'末尾',exact:true}).click();
 }
 const ordinary='(;FF[4]RU[Chinese]KM[7.5];B[ba];W[aa];B[qq];W[rr])';
 await upload(ordinary,false);
 await page.getByRole('button',{name:'下一手',exact:true}).click();await page.getByRole('button',{name:'下一手',exact:true}).click();
 await capture('original-1',()=>page.getByRole('button',{name:'打开本地真实引擎分析'}).click());
 const engineLogs=await readdir(join(config.dataDir,'engine-logs'));
 expect(engineLogs.length).toBeGreaterThan(0);
 await capture('original-2',()=>panel().getByRole('button',{name:'重新分析当前局面'}).click());
 await capture('branch-1-white-turn',()=>panel().getByRole('button',{name:'dd 空',exact:true}).click());
 await capture('branch-2-white-turn',()=>panel().getByRole('button',{name:'重新分析当前局面'}).click());
 await capture('both-colors-ab',()=>panel().getByRole('button',{name:'ab 空',exact:true}).click());
 await capture('undo',()=>panel().getByRole('button',{name:'引擎变化撤回'}).click());
 await capture('replace-with-ss',()=>panel().getByRole('button',{name:'ss 空',exact:true}).click());
 await expect(panel().getByRole('button',{name:'引擎变化重走'})).toBeDisabled();
 await panel().getByRole('button',{name:'关闭本地引擎面板'}).click();
 await page.getByRole('button',{name:'末尾',exact:true}).click();await expect(page.getByRole('img',{name:'dd 空',exact:true})).toBeVisible();
 for(const [name,sgf] of [
  ['japanese-white','(;FF[4]RU[Japanese]KM[6.5];B[dd])'],
  ['chinese-ha2','(;FF[4]RU[Chinese]KM[0.5]HA[2]AB[dd][pp]PL[W])'],
  ['japanese-ha2','(;FF[4]RU[Japanese]KM[0.5]HA[2]AB[dd][pp]PL[W])'],
  ['ha0-setup','(;FF[4]RU[Chinese]KM[7.5]HA[0]AB[ba]AW[aa]PL[B])'],
 ]) {await upload(sgf,name==='japanese-white');await capture(name,()=>page.getByRole('button',{name:'打开本地真实引擎分析'}).click());}
 // Hand-worked ko: B hi captures W hh; all surrounding strings have liberties.
 // Original history forbids W hh; the identical setup has no claimed prior board.
 await upload('(;FF[4]RU[Chinese]KM[7.5];B[gh];W[hh];B[hg];W[gi];B[ih];W[ii];B[ss];W[hj];B[hi])');
 await capture('ko-with-history',()=>page.getByRole('button',{name:'打开本地真实引擎分析'}).click());
 const originalBoard=await panel().getByLabel('引擎变化棋盘').getByRole('button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
 await panel().getByRole('button',{name:'hh 空',exact:true}).click();await expect(panel().getByRole('alert')).toContainText('简单劫');
 await upload('(;FF[4]RU[Chinese]KM[7.5]HA[0]PL[W]AB[gh][hg][ih][ss][hi]AW[gi][ii][hj])',false);
 await capture('ko-same-board-setup',()=>page.getByRole('button',{name:'打开本地真实引擎分析'}).click());
 expect(await panel().getByLabel('引擎变化棋盘').getByRole('button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')))).toEqual(originalBoard);
 await capture('setup-recapture',()=>panel().getByRole('button',{name:'hh 空',exact:true}).click());
 await expect(panel().getByRole('button',{name:'hi 空',exact:true})).toBeVisible();
 await Promise.all(writes);
 expect((await readFile(join(evidence,'http-inputs.jsonl'),'utf8')).trim().split('\n')).toHaveLength(records.length);
} catch(e){failure=e;console.error(e);}
finally{
 try{await browser?.close();}catch(e){failure??=e;}
 try{await stopOwnedChild(child);}catch(e){failure??=e;}
 const code=child.exitCode;
 const remaining=[...enginePids].filter(pid=>{try{process.kill(pid,0);return true;}catch{return false;}});
 if(remaining.length){failure??=Error('own engines survived server shutdown: '+remaining);for(const pid of remaining){try{process.kill(pid,'SIGKILL');}catch{}}}
 try{for(const file of await readdir(join(config.dataDir,'engine-logs')))await copyFile(join(config.dataDir,'engine-logs',file),join(evidence,file));}catch{}
 await Promise.all(writes);await writeFile(join(evidence,'exit.json'),JSON.stringify({serverPid:child.pid,enginePids:[...enginePids],remaining,code,success:!failure},null,2));
}
if(failure)process.exitCode=1;

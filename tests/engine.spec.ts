import {test, expect} from './engine-fixture';
import type {Page} from '@playwright/test';
test('双方分支撤回重走替换未来及pass保留精确前缀，原谱未变',async({page,engineServer})=>{
 await open(page,engineServer.url);
 await expect(panel(page)).toContainText('分析完成');
 for(const p of ['ba','aa','dd','ab']) {await panel(page).getByRole('button',{name:p+' 空',exact:true}).click();await expect(panel(page)).toContainText('分析完成');}
 await expect(panel(page)).toContainText('变化 4 手；轮黑');
 await panel(page).getByRole('button',{name:'引擎变化撤回'}).click();await expect(panel(page)).toContainText('分析完成');
 await panel(page).getByRole('button',{name:'引擎变化重走'}).click();await expect(panel(page)).toContainText('分析完成');
 await panel(page).getByRole('button',{name:'引擎变化撤回'}).click();await expect(panel(page)).toContainText('分析完成');
 await panel(page).getByRole('button',{name:'ss 空',exact:true}).click();await expect(panel(page)).toContainText('分析完成');
 await expect(panel(page).getByRole('button',{name:'引擎变化重走'})).toBeDisabled();
 await panel(page).getByRole('button',{name:'引擎变化 Pass'}).click();await expect(panel(page)).toContainText('分析完成');
 const queries=(await engineServer.observed()).filter(q=>!q.action);
 expect(queries.at(-1).moves).toEqual([['B','B19'],['W','A19'],['B','D16'],['W','T1'],['B','pass']]);
 await panel(page).getByRole('button',{name:'关闭本地引擎面板'}).click();
 await page.getByRole('button',{name:'末尾',exact:true}).click();
 await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('第 4 / 4 手：W ss');
 await expect(page.getByRole('img',{name:'dd 空',exact:true})).toBeVisible();
});
test('分析严格条件拒绝但保留回放，HA0和两规则HA2白轮显式补偿',async({page,engineServer})=>{
 for(const [extra,km,message] of [['AB[dd]','7.5','HA 未记录'],['HA[2]AB[dd]','7.5','矛盾'],['HA[2]AB[dd][pp]PL[B]','7.5','矛盾'],['','7.25','半整数'],['','400.5','半整数']]) {
  await open(page,engineServer.url,`(;FF[4]RU[Chinese]KM[${km}]${extra})`);
  await expect(panel(page)).toContainText(message);
  await expect(page.getByRole('region',{name:'棋谱回放'})).toBeVisible();
 }
 expect(await engineServer.observed()).toEqual([]);
 for(const [ru,setup,bonus] of [['Chinese','HA[0]AB[aa]AW[ba]','0'],['Chinese','HA[2]AB[dd][pp]','N'],['Japanese','HA[2]AB[dd][pp]','0']]) {
  await open(page,engineServer.url,`(;FF[4]RU[${ru}]KM[6.5]${setup}PL[W])`);
  await expect(panel(page)).toContainText('分析完成');
  await expect(panel(page)).toContainText('黑方胜率：60.00%');
  expect((await engineServer.observed()).at(-1)).toMatchObject({initialPlayer:'W',whiteHandicapBonus:bonus});
 }
});
test('同源安全拒绝跨域令牌未知字段超限非法历史且不启动引擎，源码不作静态根',async({page,engineServer})=>{
 await page.goto(engineServer.url);
 const outcomes=await page.evaluate(async()=>{
  const {token}=await fetch('/api/token').then(r=>r.json());
  const base={initialStones:[],initialPlayer:'B',RU:'Chinese',KM:7.5,moves:[]};
  const statuses=[];
  for(const [data,auth] of [[base,false],[{...base,action:'terminate_all'},true],[{...base,PB:'private'},true],[{...base,moves:Array(2000).fill(['B','pass'])},true],[{...base,moves:[['B','aa'],['W','aa']]},true],[{...base,KM:'7.5]PB[injected'},true]]) {
   statuses.push((await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{'X-CSRF-Token':token}:{})},body:JSON.stringify(data)})).status);
  }
  statuses.push((await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:' '.repeat(65537)})).status);
  const files=[];
  for(const path of ['/server/katago.ts','/.scratch/go-coach/spec.md','/package.json','/@fs/D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl/local.cfg'])files.push((await fetch(path)).status);
  return {statuses,files};
 });
 expect(outcomes.statuses.every(s=>s>=400)).toBeTruthy();
 expect(outcomes.files.every(s=>s>=400)).toBeTruthy();
 const cross=await page.request.post(engineServer.url+'/api/analyze',{headers:{Origin:'http://evil.example','Content-Type':'application/json'},data:{}});
 expect(cross.status()).toBe(403);
 const host=await page.request.get(engineServer.url+'/api/token',{headers:{Host:'evil.example'}});expect(host.status()).toBe(403);
 expect(await engineServer.observed()).toEqual([]);
});
for(const scenario of ['invalidPV','invalidMove','invalidNumber','wrongTurn','wrongPlayer','wrongId','wrongAck','noResults','warning','oversized','many','longPV']) test.describe(scenario,()=>{
 test.use({engineScenario:scenario});
 test('不可靠输出整次拒绝且保留棋盘，不伪造候选',async({page,engineServer})=>{
  await open(page,engineServer.url);
  await expect(panel(page)).toContainText('分析失败');
  if(scenario==='longPV')await expect(panel(page)).toContainText('PV 无效或超限');
  await expect(panel(page).getByLabel('引擎结果')).toHaveCount(0);
  await expect(panel(page).getByRole('button',{name:'dd 空',exact:true})).toBeVisible();
 });
});
for(const scenario of ['broken-input','uncooperative'])test.describe(scenario+' shutdown',()=>{
 test.use({engineScenario:scenario});
 test('服务退出等待正在进行的旧进程回收',async({page,engineServer})=>{
  await open(page,engineServer.url);
  await expect(panel(page)).toContainText('noResults');
  await panel(page).getByRole('button',{name:'重新分析当前局面'}).click();
  await expect(panel(page)).toContainText(scenario==='broken-input'?'引擎输入已关闭':'warning/error');
  const old=(await engineServer.observed()).find(q=>q.action==='held-open').pid;
  expect(()=>process.kill(old,0)).not.toThrow();
  // Fixture now closes the server during its 3s grace period and checks every owned PID.
 });
});
test.describe('slow-version',()=>{
 test.use({engineScenario:'slow-version'});
 test('浏览器启动的迟缓版本进程也由服务退出等待回收',async({page,engineServer})=>{
  await open(page,engineServer.url,'(;FF[4]RU[Chinese]KM[7.5])');
  await expect(panel(page)).toContainText('引擎加载中');
  await expect.poll(async()=>(await engineServer.observed()).some(q=>q.action==='version-held-open')).toBe(true);
  const version=(await engineServer.observed()).find(q=>q.action==='version-held-open').pid;
  expect(await engineServer.pids()).toEqual([version]);
  expect(()=>process.kill(version,0)).not.toThrow();
  // Fixture requests server shutdown while version is still alive, and checks its PID.
 });
});
test.describe('pv16',()=>{
 test.use({engineScenario:'pv16'});
 test('首着加15后续的合法16着PV可以显示',async({page,engineServer})=>{
  await open(page,engineServer.url,'(;FF[4]RU[Chinese]KM[7.5])');
  await expect(panel(page)).toContainText('分析完成');
  await expect(panel(page)).toContainText('ke');
 });
});
test.describe('missingPV',()=>{
 test.use({engineScenario:'missingPV'});
 test('合法缺PV保留候选明确缺失',async({page,engineServer})=>{
  await open(page,engineServer.url);
  await expect(panel(page)).toContainText('缺少 PV，不补齐');
  await expect(panel(page)).toContainText('实际 visits：101');
 });
});
for(const scenario of ['late','late-error']) test.describe(scenario,()=>{
 test.use({engineScenario:scenario});
 test('取消先失效，旧成功失败不覆盖新分支，其他标签页请求仍完成',async({page,context,engineServer})=>{
  await open(page,engineServer.url);
  await expect(panel(page)).toContainText('分析中（查询');
  await panel(page).getByRole('button',{name:'dd 空',exact:true}).click();
  await expect(panel(page).getByRole('button',{name:'dd 黑',exact:true})).toBeVisible();
  await expect(panel(page)).toContainText('候选 pp (Q4)');
  const second=await context.newPage();await open(second,engineServer.url);
  await expect(panel(second)).toContainText('候选 dd (D16)');
  // The scripted process emits the old final reply after 1000 ms; observe it via elapsed UI polling.
  await page.waitForTimeout(1100);
  await expect(panel(page)).toContainText('候选 pp (Q4)');
  await expect(panel(page)).not.toContainText('分析失败');
  expect((await engineServer.observed()).filter(q=>q.action==='terminate')).toHaveLength(1);
  await second.close();
 });
});
test.describe('loading',()=>{
 test.use({engineScenario:'loading'});
 test('启动加载与就绪分析分开显示，令牌读取不启动引擎',async({page,engineServer})=>{
  await page.goto(engineServer.url);await page.evaluate(()=>fetch('/api/token'));
  expect(await engineServer.observed()).toEqual([]);
  await open(page,engineServer.url);
  await expect(panel(page)).toContainText('引擎加载中');
  await expect(panel(page)).toContainText('分析完成');
 });
});
for(const scenario of ['broken-input','uncooperative'])test.describe(scenario,()=>{
 test.use({engineScenario:scenario});
 test(scenario==='broken-input'?'真实输入管道失败后先回收旧PID再重试新代次':'致命stderr后不合作进程必须先被回收再启动新代次',async({page,engineServer})=>{
  await open(page,engineServer.url,'(;FF[4]RU[Chinese]KM[7.5])');
  await expect(panel(page)).toContainText('noResults');
  const old=(await engineServer.observed()).find(q=>q.action==='held-open').pid;
  expect(()=>process.kill(old,0)).not.toThrow();
  await panel(page).getByRole('button',{name:'重新分析当前局面'}).click();
  if(scenario==='broken-input')await expect(panel(page)).toContainText('引擎输入已关闭');
  else await expect(panel(page)).toContainText('warning/error');
  const start=Date.now();
  await panel(page).getByRole('button',{name:'重新分析当前局面'}).click();
  // A live, uncooperative old process must not be replaced immediately.
  await page.waitForTimeout(500);
  expect(()=>process.kill(old,0)).not.toThrow();
  expect(await engineServer.pids()).toEqual([old]);
  await expect(panel(page)).not.toContainText('分析完成');
  await expect(panel(page)).toContainText('分析完成',{timeout:7000});
  const generations=await engineServer.pids();
  expect(generations).toHaveLength(2);
  expect(generations[0]).toBe(old);
  expect(generations[1]).not.toBe(old);
  expect(()=>process.kill(generations[1],0)).not.toThrow();
  expect(Date.now()-start).toBeGreaterThan(2000);
  expect(()=>process.kill(old,0)).toThrow();
 });
});
test.describe('crash',()=>{
 test.use({engineScenario:'crash'});
 test('进程退出明确失败并可显式重试新代次',async({page,engineServer})=>{
  await open(page,engineServer.url);await expect(panel(page)).toContainText('引擎已退出');
  await panel(page).getByRole('button',{name:'重新分析当前局面'}).click();
  await expect(panel(page)).toContainText('分析完成');
 });
});
test.describe('warning-late',()=>{
 test.use({engineScenario:'warning-late'});
 test('warning后仍收尾旧查询，不让其最终响应破坏重试',async({page,engineServer})=>{
  await open(page,engineServer.url);await expect(panel(page)).toContainText('warning/error');
  await panel(page).getByRole('button',{name:'重新分析当前局面'}).click();
  await expect(panel(page)).toContainText('分析完成');
 });
});
test.describe('busy',()=>{
 test.use({engineScenario:'busy'});
 test('取消墓碑计入四请求上限，未收尾超时重启后可重试',async({page,engineServer})=>{
  test.setTimeout(45000);
  await open(page,engineServer.url);
  await expect(panel(page)).toContainText('分析中（查询');
  for(const p of ['aa','ba','ab']){await panel(page).getByRole('button',{name:p+' 空',exact:true}).click();await expect(panel(page)).toContainText('分析中（查询');}
  await panel(page).getByRole('button',{name:'ss 空',exact:true}).click();
  await expect(panel(page)).toContainText('busy');
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(4);
  // Real configured deadline, not fake timers or a private unit seam.
  await page.waitForTimeout(31000);
  await panel(page).getByRole('button',{name:'重新分析当前局面'}).click();
  await expect(panel(page)).toContainText('分析中（查询');
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(5);
 });
});
test.describe('ko',()=>{
 test.use({engineScenario:'ko'});
 test('同盘不同完整历史影响候选合法性，长循环只报未支持',async({page,engineServer})=>{
  const moves=';B[gh];W[hh];B[hg];W[gi];B[ih];W[ii];B[ss];W[hj];B[hi]';
  await open(page,engineServer.url,'(;FF[4]RU[Chinese]KM[7.5]'+moves+')',true);
  await expect(panel(page)).toContainText('简单劫');
  await open(page,engineServer.url,'(;FF[4]RU[Chinese]KM[7.5]'+moves+';W[];B[])',true);
  await expect(panel(page)).toContainText('暂不支持该循环规则');
  await open(page,engineServer.url,'(;FF[4]RU[Chinese]KM[7.5]HA[0]PL[W]AB[gh][hg][ih][ss][hi]AW[gi][ii][hj])');
  await expect(panel(page)).toContainText('分析完成');await expect(panel(page)).toContainText('hh (H12)');
  const queries=(await engineServer.observed()).filter(q=>!q.action);
  expect(queries[0].moves).toEqual([['B','G12'],['W','H12'],['B','H13'],['W','G11'],['B','J12'],['W','J11'],['B','T1'],['W','H10'],['B','H11']]);
  expect(queries[2].moves).toEqual([]);
 });
});
test.describe('noAck',()=>{
 test.use({engineScenario:'noAck'});
 test('未确认的终止协议也有资源上限',async({page,engineServer})=>{
  await open(page,engineServer.url);await expect(panel(page)).toContainText('分析中（查询');
  for(const p of ['aa','ba','ab']){await panel(page).getByRole('button',{name:p+' 空',exact:true}).click();await expect(panel(page)).toContainText('分析中（查询');}
  await panel(page).getByRole('button',{name:'ss 空',exact:true}).click();
  await expect(panel(page)).toContainText('busy');
 });
});
test.describe('waiting',()=>{
 test.use({engineScenario:'waiting'});
 test('盘面先更新清旧估值再等待；回放步换文件与关闭均取消',async({page,engineServer})=>{
  await open(page,engineServer.url);await expect(panel(page)).toContainText('分析完成');
  await panel(page).getByRole('button',{name:'dd 空',exact:true}).click();
  await expect(panel(page).getByRole('button',{name:'dd 黑',exact:true})).toBeVisible();
  await expect(panel(page)).not.toContainText('实际 visits');
  await expect(panel(page)).toContainText('分析中（查询');
  await page.getByRole('button',{name:'下一手',exact:true}).click();
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole('button',{name:'打开本地真实引擎分析'}).click();await expect(panel(page)).toContainText('分析中（查询');
  await page.getByLabel('选择 SGF 文件').setInputFiles({name:'new.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Japanese]KM[6.5];B[pp])')});
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole('button',{name:'打开本地真实引擎分析'}).click();await expect(panel(page)).toContainText('分析中（查询');
  await panel(page).getByRole('button',{name:'关闭本地引擎面板'}).click();await expect(panel(page)).toHaveCount(0);
  await page.waitForTimeout(1000);await expect(panel(page)).toHaveCount(0);
  expect((await engineServer.observed()).filter(q=>q.action==='terminate')).toHaveLength(3);
 });
});
const panel=(page:Page)=>page.getByRole('region',{name:'本地引擎分析'});
async function open(page:Page,url:string,sgf='(;FF[4]RU[Chinese]KM[7.5];B[ba];W[aa];B[ab];W[ss])',end=false) {
 await page.goto(url);
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'synthetic.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(sgf)});
 if(end)await page.getByRole('button',{name:'末尾',exact:true}).click();
 await page.getByRole('button',{name:'打开本地真实引擎分析'}).click();
}
test.describe('duplicate',()=>{
 test.use({engineScenario:'duplicate'});
 test('重复候选不是两个有效候选，整次拒绝',async({page,engineServer})=>{
  await open(page,engineServer.url);
  await expect(panel(page)).toContainText('分析失败');
  await expect(panel(page).getByLabel('引擎结果')).toHaveCount(0);
 });
});
test('非示例谱显式打开本地引擎后展示黑方估值与分析条件', async ({page,engineServer}) => {
 await page.goto(engineServer.url);
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'synthetic.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Chinese]KM[7.5]PB[private-name]C[private-comment];B[dd];W[pp])')});
 await page.getByRole('button',{name:'打开本地真实引擎分析'}).click();
 const panel=page.getByRole('region',{name:'本地引擎分析'});
 await expect(panel).toContainText('黑方视角');
 await expect(panel).toContainText('实际 visits：101');
 await expect(panel).toContainText('候选 1 项');
 await expect(panel).toContainText('dd (D16)');
});
test('必要历史和官方显式计算profile经进程出口传递且无身份字段', async ({page,engineServer}) => {
 await page.goto(engineServer.url);
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'private.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Japanese]KM[6.5]PB[private-name]C[private-comment];B[ba];W[aa];B[ab];W[ss])')});
 await page.getByRole('button',{name:'下一手',exact:true}).click();
 await page.getByRole('button',{name:'下一手',exact:true}).click();
 await page.getByRole('button',{name:'打开本地真实引擎分析'}).click();
 await expect(page.getByRole('region',{name:'本地引擎分析'})).toContainText('分析完成');
 const queries=await engineServer.observed();
 expect(queries).toHaveLength(1);
 expect(queries[0]).toMatchObject({initialStones:[],initialPlayer:'B',moves:[['B','B19'],['W','A19']],komi:6.5,whiteHandicapBonus:'0',rules:{ko:'SIMPLE',scoring:'TERRITORY',tax:'SEKI',suicide:false,hasButton:false,friendlyPassOk:true,whiteHandicapBonus:'0'},maxVisits:100,includeOwnership:false});
 expect(JSON.stringify(queries)).not.toContain('private');
});

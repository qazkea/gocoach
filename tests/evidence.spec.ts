import {test,expect} from './engine-fixture';
import type {Page} from '@playwright/test';
import {evidenceClient,initial} from './evidence-http';
import type {EngineInput} from '../src/engine';
import {fork} from 'node:child_process';
import {resolve} from 'node:path';
import {waitForListening,stopOwnedChild} from './process-cleanup';
const review=(page:Page)=>page.getByRole('region',{name:'整局复盘',exact:true});
const details=(page:Page)=>page.getByRole('region',{name:'本手讲解依据',exact:true});
async function upload(page:Page) {
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'synthetic.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Chinese]KM[7.5];B[ba];W[aa];B[ab];W[])')});
}
test('按需本地依据：初盘、黑提子己链三气、白pass与回看不分析',async({page,engineServer})=>{
 await page.goto(engineServer.url);await upload(page);
 await expect(review(page)).toContainText('完成：5 / 5');
 await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
 await expect(details(page)).toContainText('初盘，没有实际上一手');
 for(const step of [3,4,3]) {
  await review(page).getByRole('button',{name:`定位第 ${step} 手`,exact:true}).click();
  await expect(details(page)).toHaveCount(0);
  await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
  if(step===3){
   await expect(details(page)).toContainText('实际落子：黑 ab (A18)');
   await expect(details(page)).toContainText('实际提子：1；aa (A19)');
   await expect(details(page)).toContainText('己链气：3；bb (B18)、aa (A19)、ac (A17)');
   await expect(details(page)).toContainText('实战落子前的候选（黑）');
   await expect(details(page)).toContainText('实战落子后的候选（白）');
  }else{
   await expect(details(page)).toContainText('实际落子：白 pass');
   await expect(details(page)).toContainText('实际提子：0');
   await expect(details(page)).toContainText('Pass 无新落子己链');
  }
  await expect(details(page)).toContainText('没有发给DeepSeek');
 }
 expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(5);
});

test('同一手已展示依据在外部引擎死亡时立即清除，不再查询',async({page,engineServer})=>{
 await page.goto(engineServer.url);await upload(page);
 await expect(review(page)).toContainText('完成：5 / 5');
 await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
 await expect(details(page)).toContainText('初盘，没有实际上一手');
 process.kill((await engineServer.pids()).at(-1)!);
 await expect(details(page)).toHaveCount(0);
 await expect(review(page)).toContainText('讲解依据已过期，请重新导入棋谱分析');
 expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(5);
});

test('公开HTTP拒绝伪造数值、错历史、错误前缀、规则贴目混用与安全请求',async({request,engineServer})=>{
 const api=await evidenceClient(request,engineServer.url);
 const a=(await api.analyze(initial)).result;
 const repeated=(await api.analyze(initial)).result;
 expect(a.evidenceId).toMatch(/^[0-9a-f]{64}$/);expect(a.evidenceId).not.toBe(repeated.evidenceId);
 const p:EngineInput={...initial,moves:[['B','pass']]};
 const b=(await api.analyze(p)).result;
 const good={position:p,afterId:b.evidenceId,beforeId:a.evidenceId};
 const response=await api.resolve(good);expect(response.status()).toBe(200);
 expect(response.headers()['cache-control']).toBe('no-store');
 expect((await response.json()).actual).toEqual({color:'B',move:'pass',captured:[],liberties:null});
 for(const data of [{...good,root:{winrate:1}},{...good,PV:['aa']},{...good,position:{...p,KM:0.5}},{...good,position:{...p,HA:0}},{...good,position:initial},{...good,beforeId:b.evidenceId},{position:initial,afterId:a.evidenceId,beforeId:b.evidenceId},{...good,afterId:'invalid'}])expect((await api.resolve(data)).status()).toBe(400);
 for(const data of [{position:p,beforeId:a.evidenceId},{...good,afterId:'a'.repeat(64)},{position:p,afterId:b.evidenceId}])expect((await api.resolve(data)).status()).toBe(410);
 const twoPass:EngineInput={...initial,moves:[['B','pass'],['W','pass']]};
 const c=(await api.analyze(twoPass)).result;
 expect((await api.resolve({position:initial,afterId:c.evidenceId})).status()).toBe(400);
 expect((await api.resolve({position:twoPass,afterId:c.evidenceId,beforeId:a.evidenceId})).status()).toBe(400);
 const japanese:EngineInput={initialStones:[['B','pp'],['B','dd']],initialPlayer:'W',RU:'Japanese',KM:0.5,HA:2,moves:[]};
 const j=(await api.analyze(japanese)).result;
 const jnext:EngineInput={...japanese,moves:[['W','pass']]};const j2=(await api.analyze(jnext)).result;
 const normalized=await api.resolve({position:{...jnext,initialStones:[['B','dd'],['B','pp']]},afterId:j2.evidenceId,beforeId:j.evidenceId});
 expect(normalized.status()).toBe(200);expect((await normalized.json()).after.bonus).toBe('0');
 const chinese=(await api.analyze({...japanese,RU:'Chinese'})).result;
 expect(chinese.bonus).toBe('N');
 expect((await api.resolve({position:jnext,afterId:j2.evidenceId,beforeId:chinese.evidenceId})).status()).toBe(400);
 for(const extra of [{Origin:'http://evil.example'},{Host:'evil.example'},{'X-CSRF-Token':'wrong'},{'Content-Type':'text/plain'}] as Record<string,string>[] )expect((await api.post('/api/review-evidence',good,extra)).status()).toBe(403);
 expect((await api.post('/api/review-evidence',' '.repeat(65537))).status()).toBe(400);
 expect((await request.get(engineServer.url+'/api/review-evidence')).status()).toBe(404);
 expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(7);
});

test.describe('引擎会话即时失效',()=>{
 test.use({engineScenario:'review-restart'});
 test('死亡到新成功前旧ID已410，新旧不能拼接，UI过期无隐式取证',async({page,request,engineServer})=>{
  await page.goto(engineServer.url);await upload(page);
  await expect(review(page)).toContainText('失败，已暂停：1 / 5');
  await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
  await expect(review(page)).toContainText('讲解依据已过期，请重新导入棋谱分析');
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(2);
  const api=await evidenceClient(request,engineServer.url);
  const old=(await api.analyze(initial)).result;
  const pid=(await engineServer.pids()).at(-1)!;process.kill(pid);
  await expect.poll(async()=>(await api.resolve({position:initial,afterId:old.evidenceId})).status()).toBe(410);
  const next:EngineInput={...initial,moves:[['B','pass']]};
  const fresh=(await api.analyze(next)).result;
  expect((await api.resolve({position:next,afterId:fresh.evidenceId,beforeId:old.evidenceId})).status()).toBe(410);
  const freshBefore=(await api.analyze(initial)).result;
  expect((await api.resolve({position:next,afterId:fresh.evidenceId,beforeId:freshBefore.evidenceId})).status()).toBe(200);
 });
});

test('另一服务实例不接受旧引用，不启动引擎或读取配置',async({request,engineServer})=>{
 const api=await evidenceClient(request,engineServer.url);const old=(await api.analyze(initial)).result.evidenceId;
 const child=fork(resolve('.server/index.js'),['--port','0','--production'],{silent:true,env:{...process.env,GO_COACH_CONFIG:undefined,GO_COACH_TEST_ENGINE:undefined}});
 try{
  const url=await waitForListening(child);const other=await evidenceClient(request,url);
  expect((await other.resolve({position:initial,afterId:old})).status()).toBe(410);
 }finally{await stopOwnedChild(child);expect(child.exitCode).toBe(0);expect(child.signalCode).toBeNull();}
});

test.describe('有界候选依据',()=>{
 test.use({engineScenario:'review-candidates'});
 test('服务仅返回前十合法候选，保留原总数',async({page,request,engineServer})=>{
  await page.goto(engineServer.url);
  await page.getByLabel('选择 SGF 文件').setInputFiles({name:'empty.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Chinese]KM[7.5])')});
  await expect(review(page)).toContainText('完成：1 / 1');
  await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
  await expect(details(page)).toContainText('候选总数 12；显示前 10 项');
  await expect(details(page).getByRole('listitem')).toHaveCount(10);
  const api=await evidenceClient(request,engineServer.url);const a=(await api.analyze(initial)).result;
  const dto=await (await api.resolve({position:initial,afterId:a.evidenceId})).json();
  expect(dto.after.candidates).toHaveLength(10);expect(dto.after.candidateCount).toBe(12);
  expect(dto.limitations).toEqual(['引擎估值固定 BLACK 视角；100 visits / 2秒低预算会波动。','估值不是原因，PV不是必然结局。','无ownership；气数不是活棋证明。']);
 });
});

test.describe('实际执棋方signed下降',()=>{
 test.use({engineScenario:'review-values'});
 test('前后候选来自各自帧，白方改善保留负数，不叫最优损失',async({page,engineServer})=>{
  await page.goto(engineServer.url);await upload(page);
  await expect(review(page)).toContainText('完成：5 / 5');
  for(const step of [1,2]){
   await review(page).getByRole('button',{name:`定位第 ${step} 手`,exact:true}).click();
   await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
   await expect(details(page)).toContainText(step===1?'黑手：胜率下降 15.00 百分点；目差下降 4.00 目':'白手：胜率下降 -15.00 百分点；目差下降 -4.00 目');
   await expect(details(page)).toContainText(step===1?'黑方胜率：60.00%':'黑方胜率：30.00%');
   await expect(details(page)).toContainText('黑方胜率：45.00%');
   await expect(details(page)).toContainText('不是最优手损失或因果证明');
  }
 });
});

test.describe('无效最终结果不签发',()=>{
 test.use({engineScenario:'invalidNumber'});
 test('HTTP无result引用，UI不提供可用依据入口',async({page,request,engineServer})=>{
  await page.goto(engineServer.url);await upload(page);
  await expect(review(page)).toContainText('失败，已暂停：0 / 5');
  await expect(review(page).getByRole('button',{name:'查看本手讲解依据'})).toBeDisabled();
  const api=await evidenceClient(request,engineServer.url);const failure=await api.analyze(initial);
  expect(failure).toEqual({error:'引擎数值无效'});
  expect((await api.resolve({position:initial,afterId:'0'.repeat(64)})).status()).toBe(410);
 });
});

test.describe('取消不签发可用引用',()=>{
 test.use({engineScenario:'waiting'});
 test('暂停未完成分析仍无依据，不自动补跑',async({page,engineServer})=>{
  await page.goto(engineServer.url);await upload(page);
  await expect.poll(async()=>(await engineServer.observed()).filter(q=>!q.action).length).toBe(1);
  await review(page).getByRole('button',{name:'暂停扫描',exact:true}).click();
  await page.waitForTimeout(1000);
  await expect(review(page)).toContainText('已暂停：0 / 5');
  await expect(review(page).getByRole('button',{name:'查看本手讲解依据'})).toBeDisabled();
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(1);
  expect((await engineServer.observed()).filter(q=>q.action==='terminate')).toHaveLength(1);
 });
});

test.describe('单调TTL',()=>{
 test.use({engineScenario:'evidence-clock'});
 test('签发2小时过期，读取不延期；UI不回退客户端数值',async({page,request,engineServer})=>{
  await page.goto(engineServer.url);await upload(page);
  await expect(review(page)).toContainText('完成：5 / 5');
  const api=await evidenceClient(request,engineServer.url);const id=(await api.analyze(initial)).result.evidenceId;
  await engineServer.advanceClock(7190000);
  expect((await api.resolve({position:initial,afterId:id})).status()).toBe(200);
  await engineServer.advanceClock(7200001);
  expect((await api.resolve({position:initial,afterId:id})).status()).toBe(410);
  await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
  await expect(review(page)).toContainText('讲解依据已过期，请重新导入棋谱分析');
  await expect(details(page)).toHaveCount(0);
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(6);
 });
});

test('真实HTTP响应延迟时切手及换谱取消，旧依据不覆盖当前选择',async({page,engineServer})=>{
 await page.goto(engineServer.url);await upload(page);
 await expect(review(page)).toContainText('完成：5 / 5');
 for(const replace of [false,true]){
  let release!:()=>void,arrived!:()=>void;
  const gate=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>arrived=r);
  let first=true;
  await page.route('**/api/review-evidence',async route=>{
   if(!first){await route.continue();return;}first=false;
   const response=await route.fetch();arrived();await gate;
   await route.fulfill({response}).catch(()=>{}); // Actual service response, only platform delivery delayed.
  });
  await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
  await seen;
  await expect(review(page)).toContainText('正在读取本地依据');
  if(replace){
   await page.getByLabel('选择 SGF 文件').setInputFiles({name:'new.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Japanese]KM[0.5];B[])')});
   await expect(review(page)).toContainText('完成：2 / 2');
  }else await review(page).getByRole('button',{name:'定位第 3 手',exact:true}).click();
  await expect(details(page)).toHaveCount(0);
  await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
  await expect(details(page)).toContainText(replace?'初盘，没有实际上一手':'实际落子：黑 ab');
  release();await page.waitForTimeout(100);
  await expect(details(page)).toContainText(replace?'贴目：0.5':'实际落子：黑 ab');
  await page.unroute('**/api/review-evidence');
 }
 expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(7);
});

test('生产2000条容量，读取提升LRU但重分析不复用引用',async({request,engineServer})=>{
 test.setTimeout(120000);
 const api=await evidenceClient(request,engineServer.url);
 const first=(await api.analyze(initial)).result.evidenceId;
 const second=(await api.analyze(initial)).result.evidenceId;
 for(let n=2;n<2000;n++)expect((await api.analyze(initial)).result.evidenceId).toMatch(/^[0-9a-f]{64}$/);
 expect((await api.resolve({position:initial,afterId:first})).status()).toBe(200);
 const last=(await api.analyze(initial)).result.evidenceId;
 expect((await api.resolve({position:initial,afterId:second})).status()).toBe(410);
 expect((await api.resolve({position:initial,afterId:first})).status()).toBe(200);
 expect((await api.resolve({position:initial,afterId:last})).status()).toBe(200);
 expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(2001);
});

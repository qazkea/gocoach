import {reveal} from './workspace-ui';
import {test,expect} from './engine-fixture';
import type {Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const review=(page:Page)=>page.getByRole('region',{name:'整局复盘'});
async function upload(page:Page,sgf='(;FF[4]RU[Chinese]KM[7.5]PB[private-name]C[private-comment];B[ba];W[aa];B[ab];W[])') {
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'private.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(sgf)});
 await reveal(page,'分析详情与逐手定位');
}
test.describe('独立手算估值',()=>{
 test.use({engineScenario:'review-values'});
 test('BLACK走势键盘定位，黑白实际执棋方百分点符号和回看缓存',async({page,engineServer})=>{
  await page.goto(engineServer.url);await upload(page,'(;FF[4]RU[Japanese]KM[6.5];B[ba];W[aa])');
  await expect(review(page)).toContainText('完成：3 / 3');
  const first=review(page).getByRole('button',{name:'定位第 1 手',exact:true});
  await first.focus();await first.press('Enter');
  await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('第 1 / 2 手：B ba');
  await expect(review(page)).toContainText('黑方胜率：45.00%');
  await expect(review(page)).toContainText('黑方目差：-1.50');
  await expect(review(page)).toContainText('黑手：胜率下降 15.00 百分点；目差下降 4.00 目');
  await expect(review(page)).toContainText('第 1 手后，轮白的下一手候选');
  await review(page).getByRole('button',{name:'定位第 2 手',exact:true}).click();
  await expect(review(page)).toContainText('白手：胜率下降 -15.00 百分点；目差下降 -4.00 目');
  await expect(review(page)).toContainText('不是严格最优手损失');
  await review(page).getByRole('button',{name:'定位第 0 手',exact:true}).click();
  await expect(review(page)).toContainText('初盘没有上一手变化');
  await expect(review(page)).toContainText('DeepSeek中文讲解尚未接入/未启用');
  await expect(review(page)).toContainText('实际 visits：101');
  await expect(review(page)).toContainText('假设 PV');
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(3);
  await first.click();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   if(process.env.FULL_GAME_SCREENSHOTS){
    await mkdir(process.env.FULL_GAME_SCREENSHOTS,{recursive:true});
    await page.screenshot({path:`${process.env.FULL_GAME_SCREENSHOTS}/review-${width}.png`,fullPage:true});
   }
  }
 });
});
test.describe('队列',()=>{
 test.use({engineScenario:'waiting'});
 test('切手仅重排下一项及前帧，暂停显式恢复并保留已完成局面',async({page,engineServer})=>{
  await page.goto(engineServer.url);await upload(page);
  await expect.poll(async()=>(await engineServer.observed()).filter(q=>!q.action).length).toBe(1);
  for(const n of [2,1,4])await review(page).getByRole('button',{name:`定位第 ${n} 手`,exact:true}).click();
  await expect.poll(async()=>(await engineServer.observed()).filter(q=>!q.action).map(q=>q.moves.length)).toEqual([0,4,3]);
  expect((await engineServer.observed()).filter(q=>q.action)).toEqual([]);
  await review(page).getByRole('button',{name:'暂停扫描',exact:true}).click();
  await expect(review(page)).toContainText('已暂停：2 / 5');
  await expect(review(page).getByRole('img',{name:'黑方胜率走势'}).locator('circle')).toHaveCount(2);
  await expect(review(page).getByRole('img',{name:'黑方胜率走势'}).locator('line')).toHaveCount(0);
  await expect(review(page)).not.toContainText('胜率下降 0.00');
  await page.waitForTimeout(1000);
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(3);
  await review(page).getByRole('button',{name:'继续扫描',exact:true}).click();
  await expect(review(page)).toContainText('完成：5 / 5');
  expect((await engineServer.observed()).filter(q=>!q.action).map(q=>q.moves.length)).toEqual([0,4,3,3,1,2]);
 });
});
test.describe('会话重启',()=>{
 test.use({engineScenario:'review-restart'});
 test('部分失败暂停，显式重试新进程清除旧成功而非拼接走势',async({page,engineServer})=>{
  await page.goto(engineServer.url);await upload(page,'(;FF[4]RU[Chinese]KM[7.5];B[ba];W[aa])');
  await expect(review(page)).toContainText('失败，已暂停：1 / 3');
  await expect(review(page)).toContainText('失败局面：第 1 手后');
  await page.waitForTimeout(1000);
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(2);
  await review(page).getByRole('button',{name:'重试失败局面并继续'}).click();
  await expect(review(page)).toContainText('引擎会话改变，旧成功已清除，重新扫描');
  await review(page).getByRole('button',{name:'定位第 1 手',exact:true}).click();
  await expect(review(page)).toContainText('前后局面尚未齐全，不计算差值');
  await expect(review(page)).toContainText('完成：3 / 3');
  expect((await engineServer.observed()).filter(q=>!q.action).map(q=>q.moves.length)).toEqual([0,1,1,0,2]);
  expect(await engineServer.pids()).toHaveLength(2);
 });
});
test.describe('候选有界',()=>{
 test.use({engineScenario:'review-candidates'});
 test('仅保留并显示前十候选，准确声明总数与丢弃数',async({page,engineServer})=>{
  await page.goto(engineServer.url);await upload(page,'(;FF[4]RU[Chinese]KM[7.5])');
  await expect(review(page)).toContainText('完成：1 / 1');
  await expect(review(page)).toContainText('候选总数 12；保留/显示 10；丢弃 2');
  await expect(review(page).getByLabel('逐手引擎结果').getByRole('listitem')).toHaveCount(10);
  await expect(review(page)).not.toContainText('la (M19)');
 });
});
for(const scenario of ['late','late-error'])test.describe('换谱 '+scenario,()=>{
 test.use({engineScenario:scenario});
 test('换谱取消自有扫描，迟到结果不污染新谱且别的标签独立完成',async({page,context,engineServer})=>{
  await page.goto(engineServer.url);await upload(page);
  await expect.poll(async()=>(await engineServer.observed()).filter(q=>!q.action).length).toBe(1);
  await upload(page,'(;FF[4]RU[Japanese]KM[6.5];B[pp])');
  await expect(review(page)).toContainText('完成：2 / 2');
  await review(page).getByRole('button',{name:'定位第 1 手',exact:true}).click();
  await expect(review(page)).toContainText('贴目：6.5');
  const second=await context.newPage();await second.goto(engineServer.url);await upload(second,'(;FF[4]RU[Chinese]KM[0.5])');
  await expect(review(second)).toContainText('完成：1 / 1');
  await expect(review(second)).toContainText('贴目：0.5');
  await page.waitForTimeout(1100);
  await expect(review(page)).toContainText('完成：2 / 2');
  await expect(review(page)).not.toContainText('失败');
  expect((await engineServer.observed()).filter(q=>q.action==='terminate')).toHaveLength(1);
  expect((await engineServer.observed()).filter(q=>!q.action).map(q=>q.komi)).toEqual([7.5,6.5,6.5,0.5]);
  await second.close();
 });
});
test('自动扫描保留不同规则贴目让子与初始方，非法条件暂停且不启引擎',async({page,engineServer})=>{
 await page.goto(engineServer.url);
 for(const [extra,km,message] of [['AB[dd]','7.5','HA 未记录'],['HA[2]AB[dd]','7.5','矛盾'],['HA[2]AB[dd][pp]PL[B]','7.5','矛盾'],['','7.25','半整数']]){
  await upload(page,`(;FF[4]RU[Chinese]KM[${km}]${extra};${extra.includes('HA[2]')&&!extra.includes('PL[B]')?'W':'B'}[])`);
  await expect(review(page)).toContainText('失败，已暂停：0 / 2');
  await expect(review(page)).toContainText(message);
  await expect(page.getByRole('region',{name:'棋谱回放'})).toBeVisible();
 }
 expect(await engineServer.observed()).toEqual([]);
 for(const [ru,setup,bonus] of [['Chinese','HA[0]AB[aa]AW[ba]','0'],['Chinese','HA[2]AB[dd][pp]','N'],['Japanese','HA[2]AB[dd][pp]','0']]){
  await upload(page,`(;FF[4]RU[${ru}]KM[0.5]${setup}PL[W];W[])`);
  await expect(review(page)).toContainText('完成：2 / 2');
  const pair=(await engineServer.observed()).slice(-2);
  expect(pair.map(q=>q.moves)).toEqual([[],[['W','pass']]]);
  for(const q of pair)expect(q).toMatchObject({initialPlayer:'W',komi:0.5,whiteHandicapBonus:bonus});
 }
});
test.describe('手动分支竞争',()=>{
 test.use({engineScenario:'busy'});
 test('四个未收尾手动请求占满时自动队列明确busy暂停不反复提交',async({page,engineServer})=>{
  await page.goto(engineServer.url);await page.getByLabel('导入后自动整局扫描').uncheck();await upload(page);
  expect(await engineServer.observed()).toEqual([]);
  await page.getByRole('button',{name:'自由试下'}).click();
  const manual=page.getByRole('region',{name:'本地引擎分析'});
  await expect(manual).toContainText('分析中（查询');
  for(const point of ['aa','ba','ab']){
   await manual.getByRole('button',{name:point+' 空',exact:true}).click();await expect(manual).toContainText('分析中（查询');
  }
  await page.getByLabel('导入后自动整局扫描').check();
  await expect(review(page)).toContainText('失败，已暂停：0 / 5');
  await expect(review(page)).toContainText('busy');
  await page.waitForTimeout(500);
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(4);
  await expect(manual).toContainText('变化 3 手');
  await page.getByRole('button',{name:'末尾',exact:true}).click();
  await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('第 4 / 4 手：W pass');
 });
});
test.describe('扫描与分支并存',()=>{
 test.use({engineScenario:'waiting'});
 test('手动变化不混入原谱扫描，双方独立完成并可返回原谱',async({page,engineServer})=>{
  await page.goto(engineServer.url);await upload(page,'(;FF[4]RU[Chinese]KM[7.5];B[ba])');
  await expect(review(page)).toContainText('分析中（查询');
  await page.getByRole('button',{name:'自由试下'}).click();
  const manual=page.getByRole('region',{name:'本地引擎分析'});
  await expect(manual).toContainText('分析完成');
  await manual.getByRole('button',{name:'ss 空',exact:true}).click();
  await expect(manual).toContainText('分析完成');
  await expect(review(page)).toContainText('完成：2 / 2');
  const histories=(await engineServer.observed()).filter(q=>!q.action).map(q=>q.moves);
  expect(histories).toHaveLength(4);
  expect(histories.filter(m=>m.length===0)).toHaveLength(2);
  expect(histories).toContainEqual([['B','B19']]);expect(histories).toContainEqual([['B','T1']]);
  await page.getByRole('button',{name:'末尾',exact:true}).click();
  await expect(page.getByLabel('19 路棋盘').getByRole('img',{name:'ss 空',exact:true})).toBeVisible();
 });
});
for(const scenario of ['unconfigured','bad-config'])test.describe(scenario,()=>{
 test.use({engineScenario:scenario});
 test('能力只读不启动进程，配置缺失或错误保留回放不循环失败',async({page,engineServer})=>{
  await page.goto(engineServer.url);
  const capability=await page.evaluate(()=>fetch('/api/engine-capability').then(r=>r.json()));
  expect(capability).toEqual({configured:scenario!=='unconfigured'});
  expect(await engineServer.pids()).toEqual([]);
  const cross=await page.request.get(engineServer.url+'/api/engine-capability',{headers:{Origin:'http://evil.example'}});
  expect(cross.status()).toBe(403);
  const requests:string[]=[];page.on('request',r=>{if(r.url().endsWith('/api/analyze'))requests.push(r.url());});
  await upload(page);
  await expect(review(page)).toContainText(scenario==='unconfigured'?'未配置本地引擎':'失败，已暂停');
  await page.getByRole('button',{name:'末尾',exact:true}).click();
  await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('第 4 / 4 手');
  await page.waitForTimeout(400);
  expect(requests).toHaveLength(scenario==='unconfigured'?0:1);
  expect(await engineServer.pids()).toEqual([]);
 });
});
test.describe('容量边界（不扫描全部2000局面）',()=>{
 test.use({engineScenario:'waiting'});
 test('2000局面可定位且队列单在途，超限上传拒绝并取消旧请求',async({page,engineServer})=>{
  await page.goto(engineServer.url);
  const moves=Array.from({length:1999},(_,i)=>`;${i%2?'W':'B'}[]`).join('');
  await upload(page,`(;FF[4]RU[Chinese]KM[7.5]${moves})`);
  await expect(review(page).getByLabel('逐手局面').getByRole('listitem')).toHaveCount(2000);
  await expect.poll(async()=>(await engineServer.observed()).filter(q=>!q.action).length).toBe(1);
  await review(page).getByRole('button',{name:'暂停扫描',exact:true}).click();
  await review(page).getByRole('button',{name:'定位第 1999 手',exact:true}).click();
  await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('第 1999 / 1999 手：B pass');
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(1);
  await page.getByLabel('选择 SGF 文件').setInputFiles({name:'oversize.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(`(;FF[4]RU[Chinese]KM[7.5]${moves};W[])`)});
  await expect(page.getByRole('alert')).toContainText('2000');
  await expect(review(page)).toHaveCount(0);
 });
});
test.describe('同会话失败恢复',()=>{
 test.use({engineScenario:'review-retry'});
 test('失败不计成功，同进程重试仅补失败及未完成局面',async({page,engineServer})=>{
  await page.goto(engineServer.url);await upload(page,'(;FF[4]RU[Chinese]KM[7.5];B[ba];W[aa])');
  await expect(review(page)).toContainText('失败，已暂停：1 / 3');
  await expect(review(page)).toContainText('noResults');
  await review(page).getByRole('button',{name:'定位第 1 手',exact:true}).click();
  await expect(review(page)).toContainText('前后局面尚未齐全，不计算差值');
  await review(page).getByRole('button',{name:'重试失败局面并继续'}).click();
  await expect(review(page)).toContainText('完成：3 / 3');
  await expect(review(page)).not.toContainText('引擎会话改变');
  expect((await engineServer.observed()).filter(q=>!q.action).map(q=>q.moves.length)).toEqual([0,1,1,2]);
  expect(await engineServer.pids()).toHaveLength(1);
 });
});
test('默认扫描初末全部局面，逐前缀保留提子与pass，不发送身份',async({page,engineServer})=>{
 const requests:any[]=[];
 page.on('request',r=>{if(r.url()===engineServer.url+'/api/analyze')requests.push(r.postDataJSON());});
 await page.goto(engineServer.url);
 const outbound:{url:string;method:string;body:string|null}[]=[];
 page.on('request',r=>outbound.push({url:r.url(),method:r.method(),body:r.postData()}));
 await upload(page);
 await expect(review(page)).toContainText('完成：5 / 5');
 for(const r of outbound){
  expect(new URL(r.url).origin).toBe(engineServer.url);
  expect(['/api/engine-capability','/api/token','/api/analyze']).toContain(new URL(r.url).pathname);
  expect(r.method).toBe(r.url.endsWith('/api/analyze')?'POST':'GET');
  if(r.method==='GET')expect(r.body).toBeNull();
 }
 expect(outbound.filter(r=>r.url.endsWith('/api/analyze'))).toHaveLength(5);
 expect(requests.map(r=>r.moves)).toEqual([[],[['B','ba']],[['B','ba'],['W','aa']],[['B','ba'],['W','aa'],['B','ab']],[['B','ba'],['W','aa'],['B','ab'],['W','pass']]]);
 for(const r of requests)expect(Object.keys(r).sort()).toEqual(['KM','RU','initialPlayer','initialStones','moves']);
 expect(JSON.stringify(requests)).not.toMatch(/private/);
 expect((await engineServer.observed()).map(q=>q.moves)).toEqual([[],[['B','B19']],[['B','B19'],['W','A19']],[['B','B19'],['W','A19'],['B','A18']],[['B','B19'],['W','A19'],['B','A18'],['W','pass']]]);
 await page.getByRole('button',{name:'末尾',exact:true}).click();
 await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('黑提子：1');
});

import {test,expect} from './engine-fixture';
import type {Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {reveal} from './workspace-ui';
async function upload(page:Page,url:string){
 page.on('pageerror',e=>console.error(e));
 await page.goto(url);
 await page.getByLabel('导入后自动整局扫描').uncheck();
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'synthetic.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Chinese]KM[7.5];B[ba];W[aa];B[ss];W[qq])')});
}
test('同起点对照在落子前同屏标记实战与推荐，不落两子',async({page,engineServer})=>{
 await upload(page,engineServer.url);
 await page.getByLabel('导入后自动整局扫描').check();
 await expect(page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 await page.getByRole('button',{name:'下一手',exact:true}).click();
 await page.getByRole('button',{name:'同起点对照',exact:true}).click();
 await expect(page.getByText('第 1 手落子前对照 · 黑行棋', {exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'ba 空',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'dd 空 · A 推荐',exact:true})).toBeVisible();
 await expect(page.getByText('S 实战 ba；A 推荐 dd', {exact:true})).toBeVisible();
 await expect(page.locator('.board:visible')).toHaveCount(1);
});
test('推荐PV从落子前独立展开，逐手查看且返回原谱原手',async({page,engineServer})=>{
 await upload(page,engineServer.url);
 await page.getByLabel('导入后自动整局扫描').check();
 await expect(page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 await page.getByRole('button',{name:'下一手',exact:true}).click();
 await page.getByRole('button',{name:'同起点对照',exact:true}).click();
 await page.getByRole('button',{name:'dd 空 · A 推荐',exact:true}).click();
 await expect(page.getByText('推荐变化 · 第 1 / 2 手', {exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'dd 黑',exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'ba 空',exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'aa 空',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'变化下一手',exact:true}).click();
 await expect(page.getByText('推荐变化 · 第 2 / 2 手', {exact:true})).toBeVisible();
 await page.getByRole('button',{name:'返回原谱',exact:true}).click();
 await expect(page.getByRole('img',{name:'ba 黑',exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'dd 空',exact:true})).toBeVisible();
});
test('自由试下从当前对照局面开始，撤回改下并返回进入前原谱手',async({page,engineServer})=>{
 await upload(page,engineServer.url);
 await page.getByRole('button',{name:'下一手',exact:true}).click();
 await page.getByRole('button',{name:'同起点对照',exact:true}).click();
 await page.getByRole('button',{name:'自由试下',exact:true}).click();
 const panel=page.getByRole('region',{name:'本地引擎分析',exact:true});
 await expect(panel).toContainText('分析完成');
 await panel.getByRole('button',{name:'cc 空',exact:true}).click();
 await expect(panel).toContainText('分析完成');
 await expect(panel.getByRole('button',{name:'ba 空',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'引擎变化撤回',exact:true}).click();
 await expect(panel).toContainText('分析完成');
 await panel.getByRole('button',{name:'dd 空',exact:true}).click();
 await expect(panel.getByRole('button',{name:'引擎变化重走',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'返回原谱',exact:true}).click();
 await expect(page.getByRole('img',{name:'ba 黑',exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'dd 空',exact:true})).toBeVisible();
});
test('双栏与窄窗标签保留试下及草稿，输入方向键不回放',async({page,engineServer})=>{
 await page.setViewportSize({width:1280,height:900});
 await upload(page,engineServer.url);
 const draft=page.getByRole('textbox',{name:'复盘草稿'});
 await draft.fill('想比较这一手');
 await draft.press('ArrowRight');
 await expect(page.getByRole('region',{name:'棋谱回放',exact:true})).toContainText('第 0 / 4 手');
 await page.getByRole('button',{name:'自由试下',exact:true}).click();
 await page.getByRole('button',{name:'cc 空',exact:true}).click();
 await page.setViewportSize({width:920,height:720});
 await page.getByRole('tab',{name:'教练',exact:true}).click();
 await expect(draft).toHaveValue('想比较这一手');
 await expect(page.locator('.board:visible')).toHaveCount(0);
 await page.getByRole('tab',{name:'棋盘',exact:true}).click();
 await expect(page.getByRole('button',{name:'cc 黑',exact:true})).toBeVisible();
 await expect(page.locator('.board:visible')).toHaveCount(1);
});
test.describe('对照有效期',()=>{
 test.use({engineScenario:'evidence-clock'});
 test('过期分析不作为推荐或PV复活，不自动补分析',async({page,engineServer})=>{
  await upload(page,engineServer.url);
  await page.getByLabel('导入后自动整局扫描').check();
  await expect(page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
  await engineServer.advanceClock(7200001);
  await page.getByRole('button',{name:'下一手',exact:true}).click();
  await page.getByRole('button',{name:'同起点对照',exact:true}).click();
  await expect(page.getByRole('button',{name:'查看推荐变化',exact:true})).toBeDisabled();
  await expect(page.getByRole('region',{name:'主棋盘',exact:true})).toContainText('讲解依据已过期');
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(5);
 });
});
test.describe('缺少候选',()=>{
 test.use({engineScenario:'emptyCandidates'});
 test('外部无候选被真实协议拒绝，失败可见且不补造A',async({page,engineServer})=>{
  await upload(page,engineServer.url);
  await page.getByLabel('导入后自动整局扫描').check();
  await expect(page.getByRole('region',{name:'整局复盘'})).toContainText('noResults：引擎没有候选结果');
  await page.getByRole('button',{name:'下一手',exact:true}).click();
  await page.getByRole('button',{name:'同起点对照',exact:true}).click();
  await expect(page.getByRole('region',{name:'主棋盘'})).toContainText('尚无可用分析');
  await expect(page.getByRole('button',{name:'查看推荐变化',exact:true})).toBeDisabled();
 });
});
test.describe('缺PV',()=>{
 test.use({engineScenario:'missingPV'});
 test('推荐仍标记但不编造PV，用户可自行试下',async({page,engineServer})=>{
  await upload(page,engineServer.url);await page.getByLabel('导入后自动整局扫描').check();
  await expect(page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
  await page.getByRole('button',{name:'下一手',exact:true}).click();
  await page.getByRole('button',{name:'同起点对照',exact:true}).click();
  await expect(page.getByRole('region',{name:'主棋盘'})).toContainText('缺少 PV，不补齐');
  await expect(page.getByRole('button',{name:'查看推荐变化',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'自由试下',exact:true}).click();
  await page.getByRole('button',{name:'dd 空',exact:true}).click();
  await expect(page.getByRole('region',{name:'本地引擎分析',exact:true})).toContainText('自由试下');
 });
});
for(const same of [true,false])test(same?'同点合并S/A标记不伪造第二落点':'双方Pass用文字，不伪造棋盘坐标',async({page,engineServer})=>{
 await page.goto(engineServer.url);
 const sgf=same?'(;FF[4]RU[Chinese]KM[7.5];B[dd])':'(;FF[4]RU[Chinese]KM[7.5]HA[0]AB[dd][dp]AW[pp][pd];B[])';
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'synthetic.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(sgf)});
 await expect(page.getByRole('region',{name:'整局复盘'})).toContainText('完成：2 / 2');
 await page.getByRole('button',{name:'下一手',exact:true}).click();
 await page.getByRole('button',{name:'同起点对照',exact:true}).click();
 await expect(page.getByRole('region',{name:'主棋盘'})).toContainText('实战与推荐相同');
 if(same){await expect(page.getByRole('button',{name:'dd 空 · S/A 推荐',exact:true})).toBeVisible();await expect(page.locator('.board-annotation')).toHaveCount(1);}
 else{await expect(page.getByText('S 实战 pass；A 推荐 pass',{exact:true})).toBeVisible();await expect(page.locator('.board-annotation')).toHaveCount(0);}
});
test('真实应用尺寸与模式截图，详情开合不重扫且无横向溢出',async({page,engineServer})=>{
 await upload(page,engineServer.url);await page.getByLabel('导入后自动整局扫描').check();
 await expect(page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 await page.getByRole('button',{name:'下一手',exact:true}).click();
 const dir=process.env.WORKSPACE_SCREENSHOTS;
 if(dir)await mkdir(dir,{recursive:true});
 const shot=async(name:string)=>{if(dir)await page.screenshot({path:`${dir}/${name}.png`});};
 for(const [width,height] of [[1440,900],[1280,900],[920,720],[390,844]]){
  await page.setViewportSize({width,height});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await expect(page.locator('.board:visible')).toHaveCount(1);
  await page.locator('#board-area').evaluate(el=>el.scrollTop=0);
  if(width>=1100){
   const trend=await page.getByRole('img',{name:'黑方胜率走势'}).boundingBox();
   expect(trend!.y+trend!.height).toBeLessThanOrEqual(height);
   const input=await page.getByRole('textbox',{name:'复盘草稿'}).boundingBox();
   expect(input!.y+input!.height).toBeLessThanOrEqual(height);
  }
  await shot(`workspace-${width}x${height}`);
  if(width<1100){await page.getByRole('tab',{name:'教练',exact:true}).click();await shot(`coach-${width}x${height}`);await page.getByRole('tab',{name:'棋盘',exact:true}).click();}
 }
 await page.setViewportSize({width:1440,height:900});
 await page.getByRole('button',{name:'同起点对照',exact:true}).click();
 await expect(page.getByRole('button',{name:'dd 空 · A 推荐',exact:true})).toBeVisible();
 await page.locator('#board-area').evaluate(el=>el.scrollTop=0);await shot('comparison');
 await page.getByRole('button',{name:'查看推荐变化',exact:true}).click();
 await page.locator('#board-area').evaluate(el=>el.scrollTop=0);await shot('pv');
 await page.getByRole('button',{name:'自由试下',exact:true}).click();
 await expect(page.getByRole('region',{name:'本地引擎分析'})).toContainText('分析完成');
 await page.getByRole('button',{name:'cc 空',exact:true}).click();
 await expect(page.getByRole('region',{name:'本地引擎分析'})).toContainText('分析完成');
 await page.locator('#board-area').evaluate(el=>el.scrollTop=0);await shot('trial');
 await reveal(page,'试下分析详情');
 await page.getByRole('button',{name:'查看试下讲解依据',exact:true}).click();
 await expect(page.getByRole('region',{name:'试下讲解依据'})).toBeVisible();
 await page.getByText('试下分析详情',{exact:true}).focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
 await expect(page.getByText('试下分析详情',{exact:true})).toBeFocused();await shot('details-focus');
 await page.getByText('试下分析详情',{exact:true}).click();
 await page.getByRole('button',{name:'返回原谱',exact:true}).click();
 expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(7);
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'invalid.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('broken')});
 await expect(page.getByRole('alert')).toContainText('导入失败');await shot('import-error');
});
test('白方对照沿完整前缀展开，不把实战白手或未来混入',async({page,engineServer})=>{
 await upload(page,engineServer.url);await page.getByLabel('导入后自动整局扫描').check();
 await expect(page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 for(let n=0;n<2;n++)await page.getByRole('button',{name:'下一手',exact:true}).click();
 await page.getByRole('button',{name:'同起点对照',exact:true}).click();
 await expect(page.getByText('第 2 手落子前对照 · 白行棋',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'dd 空 · A 推荐',exact:true}).click();
 await expect(page.getByRole('img',{name:'ba 黑',exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'dd 白',exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'aa 空',exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'ss 空',exact:true})).toBeVisible();
 process.kill((await engineServer.pids()).at(-1)!);
 await expect(page.getByRole('region',{name:'主棋盘'})).toContainText('推荐分析已失效');
});
test('真实对照核验响应迟到不切回旧手或覆盖新的试下',async({page,engineServer})=>{
 await upload(page,engineServer.url);await page.getByLabel('导入后自动整局扫描').check();
 await expect(page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 let release!:()=>void,arrive!:()=>void;
 const gate=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>arrive=r);
 await page.route('**/api/review-evidence',async route=>{const response=await route.fetch();arrive();await gate;await route.fulfill({response}).catch(()=>{});});
 try{
  await page.getByRole('button',{name:'下一手',exact:true}).click();
  await page.getByRole('button',{name:'同起点对照',exact:true}).click();await seen;
  await page.getByRole('button',{name:'下一手',exact:true}).click();
  await page.getByRole('button',{name:'自由试下',exact:true}).click();
  await page.getByRole('button',{name:'cc 空',exact:true}).click();
  release();await expect(page.getByRole('region',{name:'本地引擎分析'})).toContainText('分析完成');
  await expect(page.getByRole('button',{name:'cc 黑',exact:true})).toBeVisible();
  await expect(page.locator('.board-annotation')).toHaveCount(0);
  await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('第 2 / 4 手');
 }finally{release();}
});
test('低矮窗口和放大字体仍能内部滚动到回放与输入，标签保留状态',async({page,engineServer})=>{
 await upload(page,engineServer.url);
 for(const [width,height] of [[1280,600],[920,480]]){
  await page.setViewportSize({width,height});
  await page.addStyleTag({content:':root{font-size:20px}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole('button',{name:'下一手',exact:true}).click();
  if(width<1100)await page.getByRole('tab',{name:'教练',exact:true}).click();
  const draft=page.getByRole('textbox',{name:'复盘草稿'});await draft.fill('低矮窗口草稿');
  const box=await draft.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(height);
  await draft.press('ArrowLeft');
  if(width<1100)await page.getByRole('tab',{name:'棋盘',exact:true}).click();
 }
 await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('第 2 / 4 手');
});
test('正常复盘与本地试下共用唯一可见主盘',async({page,engineServer})=>{
 await upload(page,engineServer.url);
 await expect(page.locator('.board:visible')).toHaveCount(1);
 await page.getByRole('button',{name:'自由试下'}).click();
 await expect(page.getByRole('region',{name:'本地引擎分析',exact:true})).toContainText('分析完成');
 await expect(page.locator('.board:visible')).toHaveCount(1);
});

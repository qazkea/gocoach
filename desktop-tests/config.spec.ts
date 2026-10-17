import {test,expect,upload} from './fixture';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';

test('原生菜单选择并默认取消确认后才启用配置，真实桌面完成五局面扫描',async({desktop})=>{
 const run=await desktop.launch();
 const result=await desktop.select(run,desktop.operator);
 expect(result.errors).toEqual([]);
 expect(result.messages).toHaveLength(1);
 expect(result.messages[0]).toMatchObject({defaultId:0,cancelId:0});
 expect(result.messages[0].detail).toContain(desktop.engine);
 await upload(run.page);
 await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 const review=run.page.getByRole('region',{name:'整局复盘'});
 for(let step=0;step<=4;step++) {
  await review.getByRole('button',{name:`定位第 ${step} 手`,exact:true}).click();
  await expect(review).toContainText('实际 visits：101；黑方胜率：60.00%；黑方目差：2.50');
  await expect(review).toContainText('候选 dd (D16)');
  await expect(review).toContainText('假设 PV：dd (D16) → pass');
  await expect(review).toContainText(`第 ${step} 手后，轮${step%2?'白':'黑'}的下一手候选`);
 }
 const io=await desktop.observed();
 expect(io.filter(q=>q.moves).map(q=>q.moves)).toEqual([[],[['B','B19']],[['B','B19'],['W','A19']],[['B','B19'],['W','A19'],['B','A18']],[['B','B19'],['W','A19'],['B','A18'],['W','pass']]]);
 const cfg=io.find(q=>q.action==='config');
 expect(cfg.path.toLowerCase()).toContain(desktop.userData.toLowerCase());
 expect(cfg.path).not.toContain('web-data');
 expect(cfg.text).toContain('logAllRequests = false');
 expect(cfg.text).toContain('logAllResponses = false');
 expect(JSON.parse(await readFile(desktop.operator,'utf8')).recordSyntheticEvidence).toBe(true);
 await expect(run.page.getByRole('region',{name:'棋谱回放'})).toContainText('第 4 / 4 手');
 await expect(run.page.getByRole('region',{name:'棋谱回放'})).toContainText('黑提子：1');
 await expect(run.page.getByLabel('19 路棋盘', {exact:true})).toBeVisible();
 await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('DeepSeek中文讲解尚未接入/未启用');
 await run.page.screenshot({path:join(desktop.evidence,'scan-and-board.png'),fullPage:true});
 await run.close();
});

test('取消与坏配置保留当前有效配置和复盘，有效更换明确清空',async({desktop})=>{
 const run=await desktop.launch();
 expect(await desktop.select(run)).toEqual({messages:[],errors:[]});
 const declined=await desktop.select(run,desktop.operator,0);
 expect(declined.messages[0]).toMatchObject({defaultId:0,cancelId:0});
 await upload(run.page);
 await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('未配置本地引擎');
 expect((await desktop.observed()).filter(q=>q.action==='launch')).toEqual([]);
 await desktop.select(run,desktop.operator);
 await upload(run.page);
 await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 const url=run.page.url(),original=await readFile(desktop.operator,'utf8');
 const base=JSON.parse(original);
 const invalid=[
  '{broken',
  ' '.repeat(65537),
  JSON.stringify({...base,executable:'relative.exe'}),
  JSON.stringify({...base,model:join(desktop.dir,'missing-model')}),
  JSON.stringify({...base,homeDataDir:base.model}),
  JSON.stringify({...base,dataDir:base.dataDir+'\ninvalid'}),
  'null'
 ];
 for(let i=0;i<invalid.length;i++) {
  const path=join(desktop.dir,`bad-${i}.json`);await writeFile(path,invalid[i]);
  const result=await desktop.select(run,path);
  expect(result.messages).toEqual([]);expect(result.errors).toHaveLength(1);
  expect(run.page.url()).toBe(url);
  await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 }
 expect((await desktop.select(run)).errors).toEqual([]);
 await desktop.select(run,desktop.operator,0);
 expect(run.page.url()).toBe(url);
 await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 const accepted=await desktop.select(run,desktop.operator);
 expect(accepted.messages[0].detail).toContain('清空当前复盘');
 expect(run.page.url()).not.toBe(url);
 await expect(run.page.getByRole('region',{name:'棋谱回放'})).toHaveCount(0);
 expect(await readFile(desktop.operator,'utf8')).toBe(original);
 await run.close();
});

test('配置内容变更不被同路径静默信任，重新确认才恢复扫描',async({desktop})=>{
 const first=await desktop.launch();await desktop.select(first,desktop.operator);await first.close();
 await writeFile(desktop.operator,(await readFile(desktop.operator,'utf8'))+'\n');
 const second=await desktop.launch();await upload(second.page);
 await expect(second.page.getByRole('region',{name:'整局复盘'})).toContainText('未配置本地引擎');
 expect((await desktop.observed()).filter(q=>q.action==='launch')).toEqual([]);
 expect(await second.app.evaluate(({Menu})=>Menu.getApplicationMenu()!.items[0].submenu!.items[0].label)).toContain('配置已变更或失效');
 await desktop.select(second,desktop.operator,0);
 await expect(second.page.getByRole('region',{name:'整局复盘'})).toContainText('未配置本地引擎');
 await desktop.select(second,desktop.operator);await upload(second.page);
 await expect(second.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 await second.close();
});

for(const missing of ['operator','model','executable'] as const) test(`恢复时 ${missing} 路径失效仍可回放而不运行引擎`,async({desktop})=>{
 const first=await desktop.launch();await desktop.select(first,desktop.operator);await first.close();
 const config=JSON.parse(await readFile(desktop.operator,'utf8'));
 await rm(missing==='operator'?desktop.operator:config[missing]);
 const second=await desktop.launch();await upload(second.page);
 await expect(second.page.getByRole('region',{name:'整局复盘'})).toContainText('未配置本地引擎');
 await second.page.getByRole('button',{name:'末尾',exact:true}).click();
 await expect(second.page.getByRole('region',{name:'棋谱回放'})).toContainText('第 4 / 4 手');
 expect((await desktop.observed()).filter(q=>q.action==='launch')).toEqual([]);
 await second.close();
});

test('重启桌面自动恢复批准的配置引用，无需再次选择',async({desktop})=>{
 const first=await desktop.launch();
 await desktop.select(first,desktop.operator);
 await first.close();
 const second=await desktop.launch();
 await upload(second.page);
 await expect(second.page.getByRole('region',{name:'整局复盘'})).toContainText('完成：5 / 5');
 await second.close();
});

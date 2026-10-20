import {test,expect,upload} from './fixture';
import {join} from 'node:path';
test('桌面本地依据双方事实与失效提示，无外发，正常关窗',async({desktop})=>{
 const run=await desktop.launch();await desktop.select(run,desktop.operator);
 const {page}=run;
 const outbound:string[]=[];page.on('request',r=>outbound.push(r.url()));
 await upload(page);
 const review=page.getByRole('region',{name:'整局复盘',exact:true});
 const details=page.getByRole('region',{name:'本手讲解依据',exact:true});
 await expect(review).toContainText('完成：5 / 5');
 await review.getByRole('button',{name:'查看本手讲解依据'}).click();
 await expect(details).toContainText('初盘，没有实际上一手');
 for(const step of [3,4]){
  await review.getByRole('button',{name:`定位第 ${step} 手`,exact:true}).click();
  await expect(details).toHaveCount(0);
  await review.getByRole('button',{name:'查看本手讲解依据'}).click();
  await expect(details).toContainText(step===3?'实际落子：黑 ab (A18)':'实际落子：白 pass');
  await expect(details).toContainText(step===3?'实际提子：1；aa (A19)':'实际提子：0');
  await expect(details).toContainText(step===3?'己链气：3':'Pass 无新落子己链');
  await expect(details).toContainText(`实战落子前的候选（${step===3?'黑':'白'}）`);
  await expect(details).toContainText(`实战落子后的候选（${step===3?'白':'黑'}）`);
  await expect(details).toContainText('没有发给DeepSeek');
  await page.screenshot({path:join(desktop.evidence,`evidence-${step}.png`),fullPage:true});
 }
 const queries=(await desktop.observed()).filter(q=>q.moves);
 expect(queries).toHaveLength(5);
 const launch=(await desktop.observed()).filter(q=>q.action==='launch'&&q.args[0]==='analysis').at(-1);
 expect(launch).toBeTruthy();process.kill(launch.pid); // External process failure; no internal session/store mutation.
 // Remain on the displayed pass: invalidation must not depend on navigation or a new query.
 await expect(review).toContainText('讲解依据已过期，请重新导入棋谱分析');
 await expect(details).toHaveCount(0);
 expect((await desktop.observed()).filter(q=>q.moves)).toHaveLength(5);
 for(const url of outbound){
  expect(new URL(url).origin).toBe(new URL(page.url()).origin);
  expect(['/api/engine-capability','/api/token','/api/analyze','/api/review-evidence','/api/engine-session-watch']).toContain(new URL(url).pathname);
 }
 await page.screenshot({path:join(desktop.evidence,'expired.png'),fullPage:true});
 await run.close();
});

test('桌面同手在途成功依据遇到死亡与手动面板重启不能复活',async({desktop})=>{
 const run=await desktop.launch();await desktop.select(run,desktop.operator);
 const {page}=run;await upload(page);
 const review=page.getByRole('region',{name:'整局复盘',exact:true});
 const details=page.getByRole('region',{name:'本手讲解依据',exact:true});
 await expect(review).toContainText('完成：5 / 5');
 let release!:()=>void,arrived!:()=>void;const gate=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>arrived=r);
 await page.route('**/api/review-evidence',async route=>{
  const response=await route.fetch();expect(response.status()).toBe(200);arrived();await gate;
  await route.fulfill({response}).catch(()=>{});
 });
 try{
  await review.getByRole('button',{name:'查看本手讲解依据'}).click();await seen;
  const launch=(await desktop.observed()).filter(q=>q.action==='launch'&&q.args[0]==='analysis').at(-1);
  expect(launch).toBeTruthy();process.kill(launch.pid);
  await expect(review).toContainText('讲解依据已过期');
  release();await page.waitForTimeout(200);await expect(details).toHaveCount(0);
  await page.unroute('**/api/review-evidence');
  await page.getByRole('button',{name:'打开本地真实引擎分析',exact:true}).click();
  await expect(page.getByRole('region',{name:'本地引擎分析',exact:true})).toContainText('分析完成');
  await review.getByRole('button',{name:'查看本手讲解依据'}).click();
  await expect(review).toContainText('讲解依据已过期');await expect(details).toHaveCount(0);
  expect((await desktop.observed()).filter(q=>q.moves)).toHaveLength(6);
  await page.screenshot({path:join(desktop.evidence,'late-response-restart.png'),fullPage:true});
 }finally{release();}
 await run.close();
});

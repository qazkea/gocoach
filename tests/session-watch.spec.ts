import {test,expect} from './engine-fixture';
import {evidenceClient,initial} from './evidence-http';
import {fork} from 'node:child_process';
import {resolve} from 'node:path';
import {waitForListening,stopOwnedChild} from './process-cleanup';
import type {Page} from '@playwright/test';
const review=(page:Page)=>page.getByRole('region',{name:'整局复盘',exact:true});
const details=(page:Page)=>page.getByRole('region',{name:'本手讲解依据',exact:true});
async function prepare(page:Page,url:string){
 await page.goto(url);
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'synthetic.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Chinese]KM[7.5];B[ba];W[aa];B[ab];W[])')});
 await expect(review(page)).toContainText('完成：5 / 5');
}
async function watch(url:string){
 const {token}=await (await fetch(url+'/api/token')).json();
 const controller=new AbortController();
 const response=await fetch(url+'/api/engine-session-watch',{method:'POST',headers:{Origin:url,'Content-Type':'application/json','X-CSRF-Token':token},body:'{}',signal:controller.signal});
 return {response,controller};
}
test('watch公开安全、严格空对象、16连接及释放，无引擎启动',async({request,engineServer})=>{
 const api=await evidenceClient(request,engineServer.url);
 for(const body of [null,[],1,'bad',{engineSession:'forged'},{x:1}])expect((await api.post('/api/engine-session-watch',body)).status()).toBe(400);
 for(const extra of [{Origin:'http://evil.example'},{Host:'evil.example'},{'X-CSRF-Token':'wrong'},{'Content-Type':'text/plain'}] as Record<string,string>[])expect((await api.post('/api/engine-session-watch',{},extra)).status()).toBe(403);
 expect((await api.post('/api/engine-session-watch',' '.repeat(65537))).status()).toBe(400);
 expect((await request.get(engineServer.url+'/api/engine-session-watch')).status()).toBe(404);
 const opened:Awaited<ReturnType<typeof watch>>[]=[];
 try{
  for(let i=0;i<16;i++){
   const item=await watch(engineServer.url);opened.push(item);
   expect(item.response.status).toBe(200);expect(item.response.headers.get('cache-control')).toBe('no-store');
   const reader=item.response.body!.getReader();
   expect(new TextDecoder().decode((await reader.read()).value)).toBe('{"engineSession":null}\n');reader.releaseLock();
  }
  expect((await api.post('/api/engine-session-watch',{})).status()).toBe(429);
  opened.pop()!.controller.abort();
  await expect.poll(async()=>{const item=await watch(engineServer.url);const status=item.response.status;item.controller.abort();return status;}).toBe(200);
  expect(await engineServer.pids()).toEqual([]);expect(await engineServer.observed()).toEqual([]);
 }finally{for(const item of opened)item.controller.abort();}
});
test('未配置服务关闭时结束观察连接',async()=>{
 const child=fork(resolve('.server/index.js'),['--port','0','--production'],{silent:true,env:{...process.env,GO_COACH_CONFIG:undefined,GO_COACH_TEST_ENGINE:undefined}});
 let item:Awaited<ReturnType<typeof watch>>|undefined;
 try{
  const url=await waitForListening(child);item=await watch(url);
  const reader=item.response.body!.getReader();expect(new TextDecoder().decode((await reader.read()).value)).toBe('{"engineSession":null}\n');
  await stopOwnedChild(child);
  expect((await reader.read()).done).toBe(true);expect(child.exitCode).toBe(0);
 }finally{item?.controller.abort();await stopOwnedChild(child);}
});
test('watch在真实分析ready及外部死亡后推送身份，不额外分析',async({request,engineServer})=>{
 const item=await watch(engineServer.url),reader=item.response.body!.getReader();
 try{
  expect(new TextDecoder().decode((await reader.read()).value)).toBe('{"engineSession":null}\n');
  const api=await evidenceClient(request,engineServer.url);const first=(await api.analyze(initial)).result;
  expect(JSON.parse(new TextDecoder().decode((await reader.read()).value)).engineSession).toBe(first.engineSession);
  process.kill((await engineServer.pids()).at(-1)!);
  expect(JSON.parse(new TextDecoder().decode((await reader.read()).value)).engineSession).toBeNull();
  const next=(await api.analyze(initial)).result;
  expect(JSON.parse(new TextDecoder().decode((await reader.read()).value)).engineSession).toBe(next.engineSession);
  expect(next.engineSession).not.toBe(first.engineSession);
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(2);
 }finally{item.controller.abort();reader.releaseLock();}
});
test('同手已生成成功HTTP延迟交付，watch失效后旧响应不得复活',async({page,engineServer})=>{
 let watchCount=0;page.on('request',r=>{if(r.url().endsWith('/api/engine-session-watch'))watchCount++;});
 await prepare(page,engineServer.url);expect(watchCount).toBe(0);
 let release!:()=>void,arrived!:()=>void;const gate=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>arrived=r);
 await page.route('**/api/review-evidence',async route=>{const response=await route.fetch();expect(response.status()).toBe(200);arrived();await gate;await route.fulfill({response}).catch(()=>{});});
 try{
  await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();await seen;
  process.kill((await engineServer.pids()).at(-1)!);
  await expect(review(page)).toContainText('讲解依据已过期');release();
  await page.waitForTimeout(200);await expect(details(page)).toHaveCount(0);await expect(review(page)).toContainText('讲解依据已过期');
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(5);
 }finally{release();}
});
test('别的手动面板重启引擎后，同手旧refs不恢复且再看不分析',async({page,engineServer})=>{
 await prepare(page,engineServer.url);
 await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();await expect(details(page)).toBeVisible();
 process.kill((await engineServer.pids()).at(-1)!);
 await expect(review(page)).toContainText('讲解依据已过期');
 await page.getByRole('button',{name:'打开本地真实引擎分析',exact:true}).click();
 await expect(page.getByRole('region',{name:'本地引擎分析',exact:true})).toContainText('分析完成');
 await expect(details(page)).toHaveCount(0);
 await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
 await expect(review(page)).toContainText('讲解依据已过期');await expect(details(page)).toHaveCount(0);
 expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(6);
});
test('已展示同手详情在浏览器网络断线时清除并可见失联',async({page,context,engineServer})=>{
 await prepare(page,engineServer.url);
 await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();await expect(details(page)).toBeVisible();
 await context.setOffline(true);
 try{
  await expect(details(page)).toHaveCount(0);
  await expect(review(page)).toContainText(/失联|network|Network/);
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(5);
 }finally{await context.setOffline(false);}
});
for(const failure of ['null','bad-frame','tail','disconnect','timeout'] as const){
 test(`观察${failure}可见失败且不请求依据或引擎`,async({page,engineServer})=>{
  await prepare(page,engineServer.url);let evidenceRequests=0;
  page.on('request',r=>{if(r.url().endsWith('/api/review-evidence'))evidenceRequests++;});
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);
  await page.route('**/api/engine-session-watch',async route=>{
   if(failure==='disconnect'){await route.abort('connectionreset');return;}
   if(failure==='timeout')await gate;
   await route.fulfill({status:200,contentType:'application/x-ndjson',body:failure==='null'?'{"engineSession":null}\n':failure==='tail'?'{"engineSession":':'not json\n'}).catch(()=>{});
  });
  try{
   await review(page).getByRole('button',{name:'查看本手讲解依据'}).click();
   await expect(review(page)).toContainText(failure==='null'?'讲解依据已过期':failure==='timeout'?'引擎会话观察未就绪':failure==='bad-frame'?'引擎会话观察协议无效':failure==='tail'?'引擎会话观察失联':'Failed to fetch',{timeout:15000});
   await expect(details(page)).toHaveCount(0);expect(evidenceRequests).toBe(0);expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(5);
  }finally{release();}
 });
}

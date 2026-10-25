import {test,expect} from './engine-fixture';
import type {Page,Route} from '@playwright/test';
import {evidenceClient,initial} from './evidence-http';
// Delay only delivery of an actual service response; never fabricate evidence.
async function holdResponse(page:Page,path:string,matches:(route:Route)=>boolean=()=>true){
 let release!:()=>void,arrive!:()=>void,finish!:()=>void;
 const gate=new Promise<void>(r=>release=r),seen=new Promise<void>(r=>arrive=r),done=new Promise<void>(r=>finish=r);
 let held=false;
 const handler=async(route:Route)=>{
  if(held||!matches(route)){await route.continue();return;}
  held=true;
  try{const response=await route.fetch();arrive();await gate;await route.fulfill({response}).catch(()=>{});}finally{finish();}
 };
 await page.route(path,handler);
 return {seen,release:async()=>{release();await done;await page.unroute(path,handler);}};
}
const panel=(page:Page)=>page.getByRole('region',{name:'本地引擎分析',exact:true});
const details=(page:Page)=>page.getByRole('region',{name:'试下讲解依据',exact:true});
const view=(page:Page)=>panel(page).getByRole('button',{name:'查看试下讲解依据',exact:true});
async function open(page:Page,url:string,origin=2){
 await page.goto(url);
 await page.getByLabel('导入后自动整局扫描').uncheck();
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'synthetic.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Chinese]KM[7.5];B[ba];W[aa];B[ss];W[qq])')});
 for(let n=0;n<origin;n++)await page.getByRole('button',{name:'下一手',exact:true}).click();
 await page.getByRole('button',{name:'打开本地真实引擎分析'}).click();
 await expect(panel(page)).toContainText('分析完成');
}
async function play(page:Page,point:string){
 await panel(page).getByRole('button',{name:point==='pass'?'引擎变化 Pass':point+' 空',exact:true}).click();
 await expect(panel(page)).toContainText('分析完成');
}
test('非零起点试下提子与Pass使用真实依据，不含原谱未来且查看不补分析',async({page,engineServer})=>{
 await open(page,engineServer.url);
 await expect(panel(page)).toContainText('当前为试下起点，落子后可查看试下依据');
 await expect(view(page)).toHaveCount(0);
 await play(page,'ab');await view(page).click();
 await expect(details(page)).toContainText('原谱起点：第 2 手；变化第 1 手');
 await expect(details(page)).toContainText('试下落子：黑 ab (A18)');
 await expect(details(page)).toContainText('试下提子：1；aa (A19)');
 await expect(details(page)).toContainText('己链气：3；bb (B18)、aa (A19)、ac (A17)');
 await expect(details(page)).toContainText('试下落子前的候选（黑）');
 await expect(details(page)).toContainText('试下落子后的候选（白）');
 await play(page,'pass');await expect(details(page)).toHaveCount(0);await view(page).click();
 await expect(details(page)).toContainText('试下落子：白 pass');
 await expect(details(page)).toContainText('Pass 无新落子己链');
 const queries=(await engineServer.observed()).filter(q=>!q.action);
 expect(queries).toHaveLength(3);
 expect(queries.at(-1).moves).toEqual([['B','B19'],['W','A19'],['B','A18'],['W','pass']]);
});

test('取消的前驱成功不入缓存，同手不同路径不配对，重走与重分析清旧详情',async({page,engineServer})=>{
 await open(page,engineServer.url,0);
 await play(page,'ab');await play(page,'pass');
 await view(page).click();await expect(details(page)).toContainText('试下落子：白 pass');
 await panel(page).getByRole('button',{name:'回到原局',exact:true}).click();
 await expect(details(page)).toHaveCount(0);await expect(panel(page)).toContainText('分析完成');
 const held=await holdResponse(page,'**/api/analyze',r=>r.request().postDataJSON().moves.length===1);
 try{
  await panel(page).getByRole('button',{name:'ba 空',exact:true}).click();await held.seen;
  await play(page,'pass');await held.release();
  await expect(view(page)).toBeDisabled();
  await expect(panel(page)).toContainText('当前所需前后分析尚未齐全，不自动补跑引擎');
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(6);
 }finally{await held.release();}
 await panel(page).getByRole('button',{name:'引擎变化撤回',exact:true}).click();await expect(panel(page)).toContainText('分析完成');
 await panel(page).getByRole('button',{name:'引擎变化重走',exact:true}).click();await expect(panel(page)).toContainText('分析完成');
 await view(page).click();await expect(details(page)).toContainText('试下落子：白 pass');
 const requests:unknown[]=[];page.on('request',r=>{if(r.url().endsWith('/api/review-evidence'))requests.push(r.postDataJSON());});
 await panel(page).getByRole('button',{name:'重新分析当前局面'}).click();
 await expect(details(page)).toHaveCount(0);await expect(panel(page)).toContainText('分析完成');
 await view(page).click();await expect(details(page)).toContainText('变化第 2 手');
 await panel(page).getByRole('button',{name:'引擎变化撤回',exact:true}).click();await expect(details(page)).toHaveCount(0);
 await expect(panel(page)).toContainText('分析完成');await play(page,'cc');
 await expect(panel(page).getByRole('button',{name:'引擎变化重走',exact:true})).toBeDisabled();
 await view(page).click();await expect(details(page)).toContainText('试下落子：白 cc');
 expect(requests).toHaveLength(2);
 expect((requests[1] as any).position.moves).toEqual([['B','ba'],['W','cc']]);
});

test.describe('真实依据HTTP交付延迟',()=>{
 test.use({engineScenario:'evidence-clock'});
 for(const expired of [false,true])for(const change of ['branch','upload','close'])test(`${expired?'失败':'成功'}迟到不会覆盖${change}后的新详情`,async({page,engineServer})=>{
  await open(page,engineServer.url);await play(page,'ab');
  if(expired)await engineServer.advanceClock(7200001);
  const held=await holdResponse(page,'**/api/review-evidence');
  try{
   await view(page).click();await held.seen;
   if(change==='branch'){
    await panel(page).getByRole('button',{name:'引擎变化撤回',exact:true}).click();
   }else if(change==='upload'){
    await page.getByLabel('选择 SGF 文件').setInputFiles({name:'new.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Japanese]KM[0.5];B[pp])')});
    await expect(panel(page)).toHaveCount(0);
    await page.getByRole('button',{name:'打开本地真实引擎分析'}).click();
   }else{
    await panel(page).getByRole('button',{name:'关闭本地引擎面板'}).click();await expect(panel(page)).toHaveCount(0);
    await page.getByRole('button',{name:'打开本地真实引擎分析'}).click();
   }
   await expect(details(page)).toHaveCount(0);await expect(panel(page)).toContainText('分析完成');
   await play(page,'cc');await view(page).click();
   await expect(details(page)).toContainText('试下落子：黑 cc');
   await held.release();
   await expect(details(page)).toContainText('试下落子：黑 cc');
   await expect(panel(page)).not.toContainText('讲解依据已过期');
   if(change==='upload')await expect(details(page)).toContainText('贴目：0.5');
  }finally{await held.release();}
 });
});

test('试下已展示详情随引擎会话死亡清除且旧引用不复活',async({page,engineServer})=>{
 await open(page,engineServer.url);await play(page,'ab');await view(page).click();
 await expect(details(page)).toContainText('试下提子：1');
 process.kill((await engineServer.pids()).at(-1)!);
 await expect(details(page)).toHaveCount(0);await expect(panel(page)).toContainText('讲解依据已过期');
 await view(page).click();await expect(panel(page)).toContainText('讲解依据已过期');
 expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(2);
 await panel(page).getByRole('button',{name:'重新分析当前局面'}).click();await expect(panel(page)).toContainText('分析完成');
 await expect(view(page)).toBeDisabled();await expect(details(page)).toHaveCount(0);
});
test.describe('试下TTL',()=>{
 test.use({engineScenario:'evidence-clock'});
 test('过期读取不回退客户端数值或补查',async({page,engineServer})=>{
  await open(page,engineServer.url);await play(page,'ab');
  await engineServer.advanceClock(7200001);await view(page).click();
  await expect(panel(page)).toContainText('讲解依据已过期');await expect(details(page)).toHaveCount(0);
  expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(2);
 });
});

test('同盘不同有序历史的引用由真实HTTP拒绝',async({request,engineServer})=>{
 const api=await evidenceClient(request,engineServer.url);
 const first={...initial,moves:[['B','aa'],['W','ss'],['B','bb'],['W','rr']] as typeof initial.moves};
 const other={...initial,moves:[['B','bb'],['W','rr'],['B','aa'],['W','ss']] as typeof initial.moves};
 const before=(await api.analyze(first)).result;
 const wrong=(await api.analyze(other)).result;
 const position={...first,moves:[...first.moves,['B','pass']] as typeof initial.moves};
 const after=(await api.analyze(position)).result;
 expect((await api.resolve({position,beforeId:wrong.evidenceId,afterId:after.evidenceId})).status()).toBe(400);
 expect((await api.resolve({position,beforeId:before.evidenceId,afterId:after.evidenceId})).status()).toBe(200);
});

test('64条成功身份上限，最旧成功被淘汰且相同身份替换不占额外槽位',async({page,engineServer})=>{
 test.setTimeout(120000);
 await open(page,engineServer.url,0);
 for(let n=0;n<3;n++){
  await panel(page).getByRole('button',{name:'重新分析当前局面'}).click();await expect(panel(page)).toContainText('分析完成');
 }
 for(let n=0;n<63;n++)await play(page,'pass');
 // Revisit step 1 while the origin is still one of exactly 64 unique identities.
 for(let n=0;n<62;n++){
  await panel(page).getByRole('button',{name:'引擎变化撤回',exact:true}).click();await expect(panel(page)).toContainText('分析完成');
 }
 await expect(view(page)).toBeEnabled();await view(page).click();await expect(details(page)).toContainText('变化第 1 手');
 // Step 1 was refreshed, but origin remains the oldest write. A new branch evicts it.
 await play(page,'aa');
 await panel(page).getByRole('button',{name:'引擎变化撤回',exact:true}).click();await expect(panel(page)).toContainText('分析完成');
 await expect(view(page)).toBeDisabled();await expect(details(page)).toHaveCount(0);
 expect((await engineServer.observed()).filter(q=>!q.action)).toHaveLength(131);
});

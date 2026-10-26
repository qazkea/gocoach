import {test, expect, type Page} from '@playwright/test';
const variation = (page: Page) => page.getByRole('region', {name:'变化探索'});
async function enter(page: Page, file = 'manual-finished.sgf') {
 await page.goto('/');
 await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/' + file);
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await page.getByRole('button',{name:'探索连续变化'}).click();
}
async function play(page: Page, point: string) {
 await variation(page).getByRole('button',{name:point + ' 空',exact:true}).click();
}
test('变化出口只请求同源公开示例资源，不发送私密棋谱字段', async ({page,baseURL}) => {
 const origin=new URL(baseURL!).origin;
 const requests: {url:string; method:string; body:string|null}[] = [];
 const unexpectedSockets: string[] = [];
 page.on('websocket', socket => {
  if (new URL(socket.url()).origin!==origin.replace('http:','ws:')) unexpectedSockets.push(socket.url());
  socket.on('framesent', frame => {if (String(frame.payload) !== '{"type":"ping"}') unexpectedSockets.push(String(frame.payload));});
 });
 await page.goto('/');
 const allowed = ['corner-a.json','variations/corner-a/start.json','variations/corner-a/dd.json','variations/corner-a/dd-ab.json'].map(p => origin+'/analysis/' + p);
 await page.route('**/*', route => {
  const r = route.request();
  if(r.url()===origin+'/api/engine-capability'&&r.method()==='GET'&&r.postData()===null)return route.continue();
  requests.push({url:r.url(),method:r.method(),body:r.postData()});
  return allowed.includes(r.url()) ? route.continue() : route.abort();
 });
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'私人文件.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]GM[1]SZ[19]CA[UTF-8]RU[Chinese]KM[7.5]RE[W+R]PB[私人名字]PW[私人对手]C[私人评论];B[ba];W[aa];B[ab];W[ss])')});
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await page.getByRole('button',{name:'探索连续变化'}).click();
 await expect(variation(page)).toContainText('当前唯一气');
 await play(page,'dd'); await expect(variation(page)).toContainText('当前唯一气');
 await play(page,'ab'); await expect(variation(page)).toContainText('当前两气');
 expect(requests).toEqual(allowed.map(url => ({url,method:'GET',body:null})));
 expect(unexpectedSockets).toEqual([]);
});
test('乱序旧成功和失败不覆盖换应对、撤回重走、模式及文件切换', async ({page}) => {
 for (const destination of ['branch','redo','mode','file']) {
  for (const fail of [false,true]) {
   let release!: () => void;
   let arrived!: () => void;
   const gate = new Promise<void>(resolve => {release=resolve;});
   const started = new Promise<void>(resolve => {arrived=resolve;});
   let first = true;
   await page.route('**/analysis/variations/corner-a/dd-ab.json', async route => {
    if (!first) return route.continue();
    first = false; arrived(); await gate;
    if (fail) await route.fulfill({status:503,body:'old failure'});
    else await route.continue();
   });
   await enter(page); await play(page,'dd'); await play(page,'ab'); await started;
   await expect(variation(page)).toContainText('变化分析中');
   if (destination === 'file') {
    await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-two-corners.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
    await page.getByRole('button',{name:'进入核验教学局面'}).click();
    await page.getByRole('button',{name:'探索连续变化'}).click();
   } else if (destination === 'mode') {
    await page.getByRole('button',{name:'切回实战'}).click();
    await page.getByRole('button',{name:'探索连续变化'}).click();
   } else {
    await page.getByRole('button',{name:'撤回一手'}).click();
    await expect(variation(page)).toContainText('当前唯一气 ab');
    if (destination === 'redo') await page.getByRole('button',{name:'重走一手'}).click();
    else {await play(page,'ss'); await play(page,'ab');}
   }
   const expected = destination === 'file' ? '暂无已核验示例分析' : destination === 'mode' ? '当前唯一气 ab' : destination === 'redo' ? '当前两气 bb、ac' : '黑 ab 提走白 aa';
   await expect(variation(page)).toContainText(expected);
   const response = page.waitForResponse('**/analysis/variations/corner-a/dd-ab.json');
   release(); await response;
   await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
   await expect(variation(page)).toContainText(expected);
   await expect(variation(page)).not.toContainText('分析失败');
   if (destination !== 'redo') await expect(variation(page)).not.toContainText('当前两气');
   await expect(variation(page).getByRole('button',{name:destination === 'branch' ? 'aa 空' : 'aa 白',exact:true})).toBeVisible();
   await page.unroute('**/analysis/variations/corner-a/dd-ab.json');
  }
 }
});
test('未核验变化和B示例可继续行棋但不沿用起点结论', async ({page}) => {
 await enter(page); await play(page,'ab');
 await expect(variation(page)).toContainText('提走白 aa');
 await play(page,'pp');
 await expect(variation(page)).toContainText('暂无已核验示例分析');
 await expect(variation(page)).not.toContainText('提走白 aa');
 await expect(variation(page).locator('[data-mark]')).toHaveCount(0);
 await expect(variation(page).getByRole('button',{name:'pp 白',exact:true})).toBeVisible();
 await enter(page,'manual-two-corners.sgf');
 await expect(variation(page)).toContainText('暂无已核验示例分析');
 await play(page,'ab'); await play(page,'dd');
 await expect(variation(page)).toContainText('变化 2 手；轮黑');
 await expect(variation(page)).toContainText('暂无已核验示例分析');
 await expect(variation(page)).toContainText('黑提子：1');
});
test('错身份缺失或矛盾证据均拒绝，不显示服务任意文案', async ({page}) => {
 const valid = {context:{example:'corner-a',origin:2,rules:'Chinese',komi:7.5,sequence:['B dd','W ab']},evidence:{kind:'chain',color:'W',stones:['aa','ab'],liberties:['bb','ac']}};
 for (const data of [
  {...valid,context:{...valid.context,example:'corners-b'}},
  {...valid,context:{...valid.context,origin:4}},
  {...valid,context:{...valid.context,rules:'Japanese'}},
  {...valid,context:{...valid.context,komi:6.5}},
  {...valid,context:{...valid.context,sequence:['B dd','W ss']}},
  {...valid,evidence:null},
  {...valid,evidence:{...valid.evidence,stones:['aa']}},
  {...valid,evidence:{...valid.evidence,liberties:['ab']}},
  {...valid,evidence:{...valid.evidence,color:'B'}},
 ]) {
  await page.route('**/analysis/variations/corner-a/dd-ab.json', route => route.fulfill({json:{...data,text:'伪造的全局活棋'}}));
  await enter(page); await play(page,'dd'); await play(page,'ab');
  await expect(variation(page)).toContainText('证据不足或变化身份不符');
  await expect(variation(page)).not.toContainText('伪造的全局活棋');
  await expect(variation(page)).not.toContainText('当前两气');
  await expect(variation(page).getByRole('button',{name:'ab 白',exact:true})).toBeVisible();
  await page.unroute('**/analysis/variations/corner-a/dd-ab.json');
 }
 await page.route('**/analysis/variations/corner-a/ab.json', route => route.fulfill({json:{context:{...valid.context,sequence:['B ab']},evidence:{kind:'capture',move:'ab',captured:[]}}}));
 await enter(page); await play(page,'ab');
 await expect(variation(page)).toContainText('证据不足');
 await expect(variation(page)).toContainText('黑提子：1');
});
test('原局前缀与变化最多2000帧，超限后仍可撤回换着', async ({page}) => {
 test.setTimeout(180000);
 await enter(page);
 const pass = page.getByRole('button',{name:'Pass',exact:true});
 // A origin includes initial board and two actual moves: 3 + 1997 = 2000.
 for (let n = 0; n < 1997; n++) await pass.click();
 await expect(variation(page)).toContainText('变化 1997 手；轮白');
 await pass.click();
 await expect(variation(page)).toContainText('最多保留 2000 帧');
 await expect(variation(page)).toContainText('变化 1997 手；轮白');
 await page.getByRole('button',{name:'撤回一手'}).click();
 await play(page,'dd');
 await expect(variation(page)).toContainText('变化 1997 手；轮白');
 await expect(variation(page).getByRole('button',{name:'dd 黑',exact:true})).toBeVisible();
});
test('占点自杀与真实九手劫拒绝，不推进轮次或有效分析', async ({page}) => {
 const requests: string[] = [];
 await page.route('**/analysis/variations/**', route => {requests.push(route.request().url()); return route.continue();});
 await enter(page);
 await expect(variation(page)).toContainText('当前唯一气 ab');
 const count = requests.length;
 await variation(page).getByRole('button',{name:'ba 黑',exact:true}).click();
 await expect(variation(page)).toContainText('占点');
 await expect(variation(page)).toContainText('变化 0 手；轮黑');
 expect(requests).toHaveLength(count);
 await play(page,'ab');
 await expect(variation(page)).toContainText('提走白 aa');
 await play(page,'aa');
 await expect(variation(page)).toContainText('自杀');
 await expect(variation(page)).toContainText('变化 1 手；轮白');
 await page.getByRole('button',{name:'回到变化起点'}).click();
 for (const point of ['gh','hh','hg','gi','ih','ii','ss','hj','hi']) await play(page,point);
 await expect(variation(page)).toContainText('变化 9 手；轮白');
 await expect(variation(page)).toContainText('黑提子：1');
 await expect(variation(page).getByRole('button',{name:'hh 空',exact:true})).toBeVisible();
 await play(page,'hh');
 await expect(variation(page)).toContainText('简单劫');
 await expect(variation(page)).toContainText('变化 9 手；轮白');
 await expect(variation(page).getByRole('button',{name:'hi 黑',exact:true})).toBeVisible();
 // Two passes make this non-immediate history repetition, not a simple ko.
 await page.getByRole('button',{name:'Pass',exact:true}).click();
 await page.getByRole('button',{name:'Pass',exact:true}).click();
 await play(page,'hh');
 await expect(variation(page)).toContainText('暂不支持该循环规则');
 await expect(variation(page)).toContainText('变化 11 手；轮白');
});
test('新变化立即更新棋盘清旧证据，等待失败保留变化并可重试', async ({page}) => {
 let release!: () => void;
 const gate = new Promise<void>(resolve => {release = resolve;});
 await page.route('**/analysis/variations/corner-a/dd-ab.json', async route => {await gate; await route.fulfill({status:503,body:'unavailable'});});
 await enter(page); await play(page,'dd');
 await expect(variation(page)).toContainText('当前唯一气 ab');
 await play(page,'ab');
 await expect(variation(page).getByRole('button',{name:'ab 白',exact:true})).toBeVisible();
 await expect(variation(page)).toContainText('变化分析中');
 await expect(variation(page)).not.toContainText('当前唯一气');
 await expect(variation(page).locator('[data-mark]')).toHaveCount(0);
 release();
 await expect(variation(page)).toContainText('变化分析失败');
 await expect(variation(page)).toContainText('变化 2 手；轮黑');
 await page.unroute('**/analysis/variations/corner-a/dd-ab.json');
 await page.getByRole('button',{name:'重试当前变化'}).click();
 await expect(variation(page)).toContainText('当前两气 bb、ac');
});
test('两种白应对对应当前链气或提子证据，不捏造估值', async ({page}) => {
 await enter(page);
 await expect(variation(page)).toContainText('白 aa 当前唯一气 ab');
 await play(page,'dd');
 await expect(variation(page)).toContainText('白 aa 当前唯一气 ab');
 await play(page,'ab');
 await expect(variation(page)).toContainText('白 aa、ab 当前两气 bb、ac');
 await expect(variation(page)).not.toContainText('当前唯一气');
 await page.getByRole('button',{name:'撤回一手'}).click();
 await play(page,'ss');
 await expect(variation(page)).toContainText('白 aa 当前唯一气 ab');
 await play(page,'ab');
 await expect(variation(page)).toContainText('黑 ab 提走白 aa 一子');
 await expect(variation(page).getByRole('button',{name:'aa 空',exact:true})).toBeVisible();
 await expect(variation(page)).toContainText('不展示估值');
 await expect(variation(page)).toContainText('黑方视角');
 await expect(variation(page)).toContainText('Chinese；贴目：7.5');
});
test('pass撤回重走与替换应对不保留放弃的未来', async ({page}) => {
 await enter(page); await play(page,'dd');
 await page.getByRole('button',{name:'Pass',exact:true}).click();
 await expect(variation(page)).toContainText('变化 2 手；轮黑；最近落子：W pass');
 await page.getByRole('button',{name:'撤回一手'}).click();
 await expect(variation(page)).toContainText('变化 1 手；轮白');
 await page.getByRole('button',{name:'重走一手'}).click();
 await expect(variation(page)).toContainText('W pass');
 await page.getByRole('button',{name:'撤回一手'}).click();
 await play(page,'ab');
 await expect(page.getByRole('button',{name:'重走一手'})).toBeDisabled();
 await page.getByRole('button',{name:'回到变化起点'}).click();
 await expect(variation(page)).toContainText('变化 0 手；轮黑');
 await play(page,'ab');
 await expect(variation(page)).toContainText('黑提子：1');
 await expect(variation(page).getByRole('button',{name:'dd 空',exact:true})).toBeVisible();
});
test('连续双方变化与实战明确区分，切回后原谱未变', async ({page}) => {
 await enter(page);
 await play(page,'dd'); await play(page,'ab');
 await expect(variation(page)).toContainText('变化 2 手；轮黑');
 await expect(variation(page)).toContainText('假设变化，不代表实战必然发生');
 for (const name of ['dd 黑','ab 白','aa 白']) await expect(variation(page).getByRole('button',{name,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'切回实战'}).click();
 await expect(variation(page)).toHaveCount(0);
 await page.getByRole('button',{name:'末尾',exact:true}).click();
 await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('第 4 / 4 手：W ss');
 await expect(page.getByRole('img',{name:'dd 空',exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'aa 空',exact:true})).toBeVisible();
});

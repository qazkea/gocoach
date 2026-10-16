import {test, expect, type Page} from '@playwright/test';
const header = ';FF[4]GM[1]SZ[19]CA[UTF-8]RU[Chinese]KM[7.5]RE[W+R]';
const a = `(${header};B[ba];W[aa];B[ab];W[ss])`;
const b = `(${header};B[ba];W[aa];B[sr];W[ss];B[ab];W[cc];B[rs];W[tt])`;
async function upload(page: Page, sgf = a) {
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'example.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(sgf)});
}
const lesson = (page: Page) => page.getByRole('region', {name:'局面教学'});
async function enter(page: Page, sgf = a) {
 await page.goto('/'); await upload(page, sgf);
 await page.getByRole('button', {name:'进入核验教学局面'}).click();
}
test('答案后非法试下不篡改证据，合法另试不冒充推荐', async ({page}) => {
 await enter(page);
 await lesson(page).getByRole('button',{name:'直接看答案'}).click();
 await lesson(page).getByRole('button',{name:'ba 黑',exact:true}).click();
 await expect(lesson(page)).toContainText('占点');
 await expect(lesson(page)).toContainText('模式：本课教学推荐');
 await expect(lesson(page).getByRole('button',{name:'ab 黑',exact:true})).toHaveAttribute('data-mark','推荐');
 await lesson(page).getByRole('button',{name:'dd 空',exact:true}).click();
 await expect(lesson(page)).toContainText('模式：一手试下结果');
 await expect(lesson(page)).not.toContainText('黑 ab 后提走');
 await expect(lesson(page).getByRole('button',{name:'aa 白',exact:true})).toBeVisible();
});
test('换文件或离开再进入局面时，迟到成功和失败不覆盖当前教学', async ({page}) => {
 for (const switchFile of [true,false]) {
  let release!: () => void;
  let arrived!: () => void;
  const gate = new Promise<void>(resolve => {release=resolve;});
  const started = new Promise<void>(resolve => {arrived=resolve;});
  let first = true;
  await page.route('**/analysis/corner-a.json', async route => {
   if (!first) return route.continue();
   first=false; arrived(); await gate;
   await route.fulfill(switchFile ? {json:{position:'corner-a',teaching:'ab',engine:'ab',evidence:[{move:'ab',target:'aa',liberties:['ab'],captured:['aa']}]}} : {status:503,body:'late error'});
  });
  await enter(page); await started;
  await expect(lesson(page)).toContainText('分析中');
  if (switchFile) await upload(page,b);
  else await page.getByRole('button',{name:'下一手',exact:true}).click();
  await expect(lesson(page)).toHaveCount(0);
  await page.getByRole('button',{name:'进入核验教学局面'}).click();
  await lesson(page).getByRole('button',{name:'直接看答案'}).click();
  const oldResponse = page.waitForResponse('**/analysis/corner-a.json');
  release(); await oldResponse;
  await lesson(page).getByRole('button',{name:'查看模拟引擎首选'}).click();
  await expect(lesson(page)).toContainText(switchFile ? '模拟引擎首选：rs' : '模拟引擎首选：ab');
  await expect(lesson(page)).not.toContainText('分析失败');
  await expect(lesson(page).getByRole('button',{name:switchFile ? 'ss 空' : 'aa 空',exact:true})).toBeVisible();
  await page.unroute('**/analysis/corner-a.json');
 }
});
test('请求仅含公开示例ID，名字注释不影响匹配也不外发', async ({page}) => {
 await page.goto('/');
 const outbound: {url:string;method:string;body:string|null}[] = [];
 await page.route('**/*',route => {
  const r = route.request(); outbound.push({url:r.url(),method:r.method(),body:r.postData()});
  return r.url() === 'http://127.0.0.1:5173/analysis/corner-a.json' ? route.continue() : route.abort();
 });
 await upload(page,a.replace('RE[W+R]','RE[W+R]PB[私人名字]PW[私人对手]C[私人说明]'));
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await lesson(page).getByRole('button',{name:'直接看答案'}).click();
 await expect(lesson(page)).toContainText('两类推荐相同');
 expect(outbound).toEqual([{url:'http://127.0.0.1:5173/analysis/corner-a.json',method:'GET',body:null}]);
});
test('分析请求失败明确未完成并可重试', async ({page}) => {
 await page.route('**/analysis/corner-a.json',route => route.fulfill({status:503,body:'unavailable'}));
 await enter(page);
 await expect(lesson(page)).toContainText('分析失败');
 await expect(lesson(page).getByRole('button',{name:'直接看答案'})).toHaveCount(0);
 await page.unroute('**/analysis/corner-a.json');
 await lesson(page).getByRole('button',{name:'重试分析'}).click();
 await lesson(page).getByRole('button',{name:'直接看答案'}).click();
 await expect(lesson(page).getByRole('button',{name:'aa 空',exact:true})).toBeVisible();
});
test('比较右下推荐时标记证据目标与落点，并说明手算来源', async ({page}) => {
 await enter(page,b);
 await expect(lesson(page)).toContainText('合成样例 B');
 await expect(lesson(page)).toContainText('手工核验');
 await lesson(page).getByRole('button',{name:'直接看答案'}).click();
 await lesson(page).getByRole('button',{name:'查看模拟引擎首选'}).click();
 await expect(lesson(page).getByRole('button',{name:'ss 空',exact:true})).toHaveAttribute('data-mark','目标');
 await expect(lesson(page).getByRole('button',{name:'rs 黑',exact:true})).toHaveAttribute('data-mark','推荐');
 await expect(lesson(page)).toContainText('sr');
});
test('不匹配的规则贴目初盘与序列仅回放，不请求示例分析', async ({page}) => {
 const requests: string[] = [];
 await page.route('**/analysis/**', route => {requests.push(route.request().url()); return route.abort();});
 await page.goto('/');
 for (const sgf of [a.replace('Chinese','Japanese'),a.replace('7.5','6.5'),a.replace(';B[ba]','AB[dd];B[ba]'),a.replace('W[ss]','W[rr]'),a.replace(';W[ss]',''),a.replace(';B[ba];W[aa];B[ab];W[ss]','PL[W];W[ba];B[aa];W[ab];B[ss]')]) {
  await upload(page,sgf);
  await expect(page.getByText('当前没有对应示例分析；仍可回放。')).toBeVisible();
  await expect(page.getByRole('button',{name:'进入核验教学局面'})).toHaveCount(0);
  await page.getByRole('button',{name:'末尾',exact:true}).click();
  await expect(page.getByRole('region',{name:'棋谱回放'})).toBeVisible();
 }
 expect(requests).toEqual([]);
});
test('缺失或冲突的分析证据不呈现答案', async ({page}) => {
 const valid = {position:'corner-a',teaching:'ab',engine:'ab',evidence:[{move:'ab',target:'aa',liberties:['ab'],captured:['aa']}]};
 for (const data of [
  {...valid,evidence:[]}, {...valid,position:'corners-b'}, {...valid,teaching:'ba'},
  {...valid,engine:'dd'}, {...valid,evidence:[{move:'ab',target:'ba',liberties:['ab'],captured:['ba']}]},
  {...valid,evidence:[{move:'ab',target:'aa',liberties:['ac'],captured:['aa']}]},
  {...valid,evidence:[{move:'ab',target:'aa',liberties:['ab'],captured:[]}]}, null,
 ]) {
  await page.route('**/analysis/corner-a.json', route => route.fulfill({json:data}));
  // Selection now validates on upload, before any lesson is offered.
  await page.goto('/'); await upload(page);
  await expect(page.getByRole('region',{name:'教学精选'})).toContainText('证据不足');
  await expect(page.getByRole('button',{name:'直接看答案'})).toHaveCount(0);
  await page.unroute('**/analysis/corner-a.json');
 }
});
test('B两种提子推荐与实战可切换，不把预设排序当更优证明', async ({page}) => {
 await page.goto('/');
 await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-two-corners.sgf');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await expect(lesson(page)).toContainText('第 4 手后');
 for (const name of ['aa 白','ss 白','ba 黑','sr 黑']) await expect(lesson(page).getByRole('button',{name,exact:true})).toBeVisible();
 await lesson(page).getByRole('button',{name:'直接看答案'}).click();
 await expect(lesson(page)).toContainText('本课教学推荐：ab');
 await expect(lesson(page)).toContainText('模拟引擎首选：rs');
 await expect(lesson(page)).toContainText('不证明 rs 全局更优');
 await expect(lesson(page).getByRole('button',{name:'aa 空',exact:true})).toBeVisible();
 await expect(lesson(page).getByRole('button',{name:'ss 白',exact:true})).toBeVisible();
 await lesson(page).getByRole('button',{name:'查看模拟引擎首选'}).click();
 await expect(lesson(page)).toContainText('白 ss');
 await expect(lesson(page)).toContainText('唯一气 rs');
 for (const name of ['aa 白','ss 空','rs 黑','sr 黑']) await expect(lesson(page).getByRole('button',{name,exact:true})).toBeVisible();
 await expect(lesson(page)).toContainText('黑提子：1');
 await lesson(page).getByRole('button',{name:'查看实战落子'}).click();
 await expect(lesson(page).getByRole('button',{name:'aa 空',exact:true})).toBeVisible();
 await expect(lesson(page).getByRole('button',{name:'ss 白',exact:true})).toBeVisible();
 await lesson(page).getByRole('button',{name:'查看本课教学推荐'}).click();
 await expect(lesson(page)).toContainText('模式：本课教学推荐');
});
test('A直接答案如实展示同一推荐和提子证据', async ({page}) => {
 await enter(page);
 await lesson(page).getByRole('button',{name:'直接看答案'}).click();
 await expect(lesson(page)).toContainText('实战落子：ab');
 await expect(lesson(page)).toContainText('本课教学推荐：ab');
 await expect(lesson(page)).toContainText('模拟引擎首选：ab');
 await expect(lesson(page)).toContainText('两类推荐相同');
 await expect(lesson(page)).toContainText('白 aa');
 await expect(lesson(page).getByRole('button',{name:'ab 黑',exact:true})).toHaveAttribute('data-mark','推荐');
 await expect(lesson(page).getByRole('button',{name:'aa 空',exact:true})).toBeVisible();
 await expect(lesson(page)).toContainText('预设数据，非真实引擎或在线AI');
});
test('提示后继续，非法占点与其他合法着反馈，键盘完成目标', async ({page}) => {
 await enter(page);
 await lesson(page).getByRole('button', {name:'请求提示'}).click();
 await expect(lesson(page)).toContainText('紧邻的空点');
 await expect(lesson(page)).toContainText('ba');
 await expect(lesson(page).getByRole('button',{name:'aa 白',exact:true})).toHaveAttribute('data-mark','目标');
 await expect(lesson(page).getByRole('button',{name:'ab 空',exact:true})).toHaveAttribute('data-mark','气');
 await lesson(page).getByRole('button',{name:'ba 黑',exact:true}).click();
 await expect(lesson(page)).toContainText('占点');
 await lesson(page).getByRole('button',{name:'dd 空',exact:true}).click();
 await expect(lesson(page)).toContainText('仍保留 ab');
 await expect(lesson(page)).toContainText('不等于全局坏棋');
 await expect(lesson(page).getByRole('button',{name:'dd 黑',exact:true})).toBeVisible();
 await lesson(page).getByRole('button',{name:'重新试下'}).click();
 await expect(lesson(page).getByRole('button',{name:'dd 空',exact:true})).toBeVisible();
 await lesson(page).getByRole('button',{name:'ab 空',exact:true}).focus();
 await page.keyboard.press('Enter');
 await expect(lesson(page)).toContainText('达到本课目标');
});
test('A等待分析后先试下提子，原实战不变', async ({page}) => {
 let release!: () => void;
 const gate = new Promise<void>(resolve => {release = resolve;});
 await page.route('**/analysis/corner-a.json', async route => {await gate; await route.continue();});
 await enter(page);
 await expect(lesson(page)).toContainText('分析中');
 await expect(lesson(page).getByRole('button', {name:'ab 空',exact:true})).toHaveCount(0);
 release();
 await expect(lesson(page)).toContainText('第 2 手后');
 await expect(lesson(page)).toContainText('轮黑');
 await lesson(page).getByRole('button', {name:'ab 空',exact:true}).click();
 await expect(lesson(page).getByRole('button', {name:'aa 空',exact:true})).toBeVisible();
 await expect(lesson(page).getByRole('button', {name:'ab 黑',exact:true})).toBeVisible();
 await expect(lesson(page)).toContainText('黑提子：1');
 await expect(lesson(page)).toContainText('达到本课目标');
 await page.getByRole('button',{name:'下一手',exact:true}).click();
 await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('第 3 / 4 手：B ab');
 await expect(page.getByRole('img',{name:'aa 空',exact:true})).toBeVisible();
});

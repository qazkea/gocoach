import {test, expect} from '@playwright/test';
const c = '(;FF[4]GM[1]SZ[19]CA[UTF-8]RU[Chinese]KM[7.5]RE[B+R]AB[ba][gh][gj][lm][nm][ml][qs][rr][sq]AW[aa][mm][ss]PL[W];W[ab];B[gi];W[dd];B[mn];W[ee];B[rs];W[ff];B[sr];W[pp])';
const context = {source:'mixed-c',rules:'Chinese',komi:7.5,handicap:0,initialPlayer:'W',black:['ba','gh','gj','lm','nm','ml','qs','rr','sq'],white:['aa','mm','ss'],moves:['W ab','B gi','W dd','B mn','W ee','B rs','W ff','B sr','W pp']};
const rescue = {id:'rescue',step:0,player:'W',kind:'rescue',teaching:'ab',engine:'ab',evidence:[{move:'ab',targets:[{stones:['aa'],liberties:['ab']}],captured:[],afterLiberties:['bb','ac']}]};
test('白先危险棋子经真实证据精选，提示试下解除一气而不称活棋', async ({page}) => {
 await page.route('**/analysis/mixed-c.json', route => route.fulfill({json:{context,candidates:[rescue]}}));
 await page.goto('/');
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'c.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(c)});
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 1 个');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 const lesson = page.getByRole('region',{name:'局面教学'});
 await expect(lesson).toContainText('危险棋子'); await expect(lesson).toContainText('轮白');
 await lesson.getByRole('button',{name:'请求提示'}).click();
 await expect(lesson.getByRole('button',{name:'aa 白',exact:true})).toHaveAttribute('data-mark','目标');
 await lesson.getByRole('button',{name:'ab 空',exact:true}).click();
 await expect(lesson).toContainText('解除当前一气');
 await lesson.getByRole('button',{name:'直接看答案'}).click();
 await expect(lesson).toContainText('bb、ac');
 await lesson.getByRole('button',{name:'探索连续变化'}).click();
 await expect(page.getByRole('region',{name:'变化探索'})).toContainText('暂无已核验示例分析');
});
const connect = {id:'connect',step:1,player:'B',kind:'connect',teaching:'gi',engine:'gi',evidence:[{move:'gi',targets:[{stones:['gh'],liberties:['fh','hh','gg','gi']},{stones:['gj'],liberties:['fj','hj','gi','gk']}],captured:[],afterLiberties:['fh','hh','gg','fi','hi','fj','hj','gk']}]};
const capture = {id:'capture',step:3,player:'B',kind:'capture',teaching:'mn',engine:'mn',evidence:[{move:'mn',targets:[{stones:['mm'],liberties:['mn']}],captured:['mm']}]};
test('乱序复杂最大损失不优先，去重精选三题并逐课重置', async ({page}) => {
 const complex = {id:'complex',step:5,player:'B',kind:'force',loss:999,teaching:'rs',engine:'rs',evidence:[{move:'rs',targets:[{stones:['ss'],liberties:['rs','sr']}],captured:['ss'],third:'sr'}]};
 await page.route('**/analysis/mixed-c.json', route => route.fulfill({json:{context,candidates:[complex,connect,capture,{...rescue,id:'duplicate'},rescue]}}));
 await page.goto('/'); await page.getByLabel('选择 SGF 文件').setInputFiles({name:'c.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(c)});
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 const selection = page.getByRole('region',{name:'教学精选'});
 await expect(selection).toContainText('精选 3 个');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 const lesson = page.getByRole('region',{name:'局面教学'});
 await expect(lesson).toContainText('危险棋子');
 await page.getByRole('button',{name:'请求提示'}).click(); await page.getByRole('button',{name:'直接看答案'}).click();
 await page.getByRole('button',{name:'下一个精选'}).click();
 await expect(lesson).toContainText('吃子'); await expect(lesson).not.toContainText('原局面提示');
 await expect(lesson).not.toContainText('实战落子：');
 await page.getByRole('button',{name:'直接看答案'}).click(); await expect(lesson).toContainText('提走白 mm');
 await page.getByRole('button',{name:'探索连续变化'}).click();
 await expect(page.getByRole('region',{name:'变化探索'})).toContainText('暂无已核验示例分析');
 await page.getByRole('button',{name:'下一个精选'}).click();
 await expect(page.getByRole('region',{name:'变化探索'})).toHaveCount(0);
 await expect(lesson).toContainText('连接');
 await page.getByRole('button',{name:'直接看答案'}).click(); await expect(lesson).toContainText('八气');
 await expect(lesson.getByRole('button',{name:'gi 黑',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'末尾',exact:true}).click();
 await expect(page.getByRole('region',{name:'棋谱回放'})).toContainText('第 9 / 9 手：W pp');
 await expect(page.getByRole('img',{name:'mm 空',exact:true})).toBeVisible();
});
test('D真实文件三手内强制提子核验所有合法应手含pass，不冒充通用死活', async ({page}) => {
 await page.goto('/'); await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-force.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 1 个');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await page.getByRole('button',{name:'直接看答案'}).click();
 const lesson=page.getByRole('region',{name:'局面教学'});
 await expect(lesson).toContainText('所有全盘合法应手及pass');
 await expect(lesson).toContainText('固定第三手 ab');
 await expect(lesson).toContainText('不是通用死活');
 await expect(lesson.getByRole('button',{name:'aa 白',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'查看模拟引擎首选'}).click();
 await expect(lesson).toContainText('固定第三手 ba');
 await page.getByRole('button',{name:'探索连续变化'}).click();
 const variation=page.getByRole('region',{name:'变化探索'});
 await expect(variation).toContainText('暂无已核验示例分析');
 for (const point of ['ba','ss','ab']) await variation.getByRole('button',{name:point+' 空',exact:true}).click();
 await expect(variation.getByRole('button',{name:'aa 空',exact:true})).toBeVisible();
 await expect(variation).toContainText('黑提子：1');
});
test('空候选与缺证据和超范围分别解释，不凑数且保留回放', async ({page}) => {
 await page.goto('/');
 for (const [candidates,message] of [
  [[], '候选为空'],
  [[{...rescue,evidence:[]}], '证据不足'],
  [[{...rescue,kind:'global'}], '不支持的教学类别'],
  [Array(33).fill(rescue), '超过32条上限'],
 ] as const) {
  await page.route('**/analysis/mixed-c.json',route=>route.fulfill({json:{context,candidates}}));
  await page.getByLabel('选择 SGF 文件').setInputFiles({name:'c.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(c)});
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
  await expect(page.getByRole('region',{name:'教学精选'})).toContainText(message);
  await expect(page.getByRole('button',{name:'进入核验教学局面'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'棋谱回放'})).toBeVisible();
  await page.unroute('**/analysis/mixed-c.json');
 }
});
test('C真实文件提供混合四类输入，精选按证明复杂度而非资源顺序', async ({page}) => {
 await page.goto('/'); await page.getByLabel('选择 SGF 文件').setInputFiles({name:'c.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(c)});
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 3 个');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await expect(page.getByRole('region',{name:'局面教学'})).toContainText('危险棋子');
 await page.getByRole('button',{name:'下一个精选'}).click();
 await expect(page.getByRole('region',{name:'局面教学'})).toContainText('吃子');
 await page.getByRole('button',{name:'下一个精选'}).click();
 await expect(page.getByRole('region',{name:'局面教学'})).toContainText('连接');
});
test('等待中进入，候选定位非零步后自动进入当前精选且可重试网络失败', async ({page}) => {
 let release!:()=>void; const gate=new Promise<void>(r=>release=r);
 await page.route('**/analysis/mixed-c.json',async route=>{await gate; await route.fulfill({json:{context,candidates:[capture]}});});
 await page.goto('/'); await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('分析中');
 await page.getByRole('button',{name:'进入核验教学局面'}).click(); release();
 await expect(page.getByRole('region',{name:'局面教学'})).toContainText('第 3 手后');
 await page.unroute('**/analysis/mixed-c.json');
 await page.route('**/analysis/mixed-c.json',route=>route.fulfill({status:503,body:'unavailable'}));
 await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('分析失败');
 await expect(page.getByRole('region',{name:'棋谱回放'})).toBeVisible();
 await page.unroute('**/analysis/mixed-c.json');
 await page.getByRole('button',{name:'重试分析'}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 3 个');
});
test('目标链和子数越界显式拒绝，不能靠复杂大目标凑题', async ({page}) => {
 await page.goto('/');
 for (const targets of [
  [...connect.evidence[0].targets, {stones:['lm'],liberties:[]}],
  [{stones:['aa','ab','ac','ad','ae','af','ag'],liberties:['ah']}],
 ]) {
  await page.route('**/analysis/mixed-c.json',route=>route.fulfill({json:{context,candidates:[{...connect,evidence:[{...connect.evidence[0],targets}]}]}}));
  await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
  await expect(page.getByRole('region',{name:'教学精选'})).toContainText('最多2链/6子');
  await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 0 个');
  await page.unroute('**/analysis/mixed-c.json');
 }
});
test('四类伪证据或不能完成目标的推荐均不入选', async ({page}) => {
 const force={id:'force',step:5,player:'B',kind:'force',teaching:'rs',engine:'rs',evidence:[{move:'rs',targets:[{stones:['ss'],liberties:['rs','sr']}],captured:['ss'],third:'sr'}]};
 await page.goto('/');
 for (const candidate of [
  {...rescue,evidence:[{...rescue.evidence[0],afterLiberties:['bb']}]},
  {...rescue,teaching:'dd',engine:'dd',evidence:[{...rescue.evidence[0],move:'dd'}]},
  {...connect,evidence:[{...connect.evidence[0],targets:[connect.evidence[0].targets[0],connect.evidence[0].targets[0]]}]},
  {...capture,evidence:[{...capture.evidence[0],captured:[]}]},
  {...force,evidence:[{...force.evidence[0],third:'dd'}]},
  {...force,teaching:'dd',engine:'dd',evidence:[{...force.evidence[0],move:'dd'}]},
  {...force,evidence:[{...force.evidence[0],targets:[{stones:['qs'],liberties:['ps','rs','qr']}]}]},
 ]) {
  await page.route('**/analysis/mixed-c.json',route=>route.fulfill({json:{context,candidates:[candidate]}}));
  await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
  await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 0 个');
  await expect(page.getByRole('button',{name:'直接看答案'})).toHaveCount(0);
  await page.unroute('**/analysis/mixed-c.json');
 }
 // A genuine single forced candidate is still reachable, not filtered by category.
 await page.route('**/analysis/mixed-c.json',route=>route.fulfill({json:{context,candidates:[force]}}));
 await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 1 个');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await page.getByRole('button',{name:'直接看答案'}).click();
 await expect(page.getByRole('region',{name:'局面教学'})).toContainText('固定第三手 sr');
});
test('候选响应绑定完整源身份，不接受错setup规则贴目轮次或未来实战', async ({page}) => {
 await page.goto('/');
 for (const bad of [
  {...context,source:'force-d'}, {...context,rules:'Japanese'}, {...context,komi:6.5},
  {...context,handicap:2}, {...context,initialPlayer:'B'}, {...context,black:context.black.slice(1)},
  {...context,white:['aa','mm']}, {...context,moves:context.moves.slice(0,-1)},
  {...context,moves:[...context.moves.slice(0,-1),'W qq']},
 ]) {
  await page.route('**/analysis/mixed-c.json',route=>route.fulfill({json:{context:bad,candidates:[rescue],text:'伪造全局结论'}}));
  await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
  const selection=page.getByRole('region',{name:'教学精选'});
  await expect(selection).toContainText('证据不足或局面不符');
  await expect(selection).not.toContainText('精选 1 个'); await expect(selection).not.toContainText('伪造全局结论');
  await expect(page.getByRole('region',{name:'棋谱回放'})).toBeVisible();
  await page.unroute('**/analysis/mixed-c.json');
 }
});
test('强制证明预算耗尽说明未完整核验，重复目标不凑数', async ({page}) => {
 const dContext={source:'force-d',rules:'Chinese',komi:7.5,handicap:0,initialPlayer:'B',black:['ca','bb','ac'],white:['aa'],moves:['B ba','W ss','B ab','W rr']};
 const force={id:'force',step:0,player:'B',kind:'force',teaching:'ba',engine:'ab',evidence:[{move:'ba',targets:[{stones:['aa'],liberties:['ba','ab']}],captured:['aa'],third:'ab'},{move:'ab',targets:[{stones:['aa'],liberties:['ba','ab']}],captured:['aa'],third:'ba'}]};
 await page.route('**/analysis/force-d.json',route=>route.fulfill({json:{context:dContext,candidates:Array.from({length:4},(_,i)=>({...force,id:'duplicate'+i}))}}));
 await page.goto('/'); await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-force.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 const selection=page.getByRole('region',{name:'教学精选'});
 await expect(selection).toContainText('精选 1 个');
 await expect(selection).toContainText('4096次落子验证预算耗尽');
 await expect(selection).toContainText('部分候选未完整核验');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await page.getByRole('button',{name:'直接看答案'}).click();
 await expect(page.getByRole('region',{name:'局面教学'})).toContainText('固定第三手 ab');
});
test('C/D公开源出口不含私密信息，改动真实setup的反例是未知谱而非套题', async ({page}) => {
 await page.goto('/');
 const origin=new URL(page.url()).origin;
 const outbound:{url:string;method:string;body:string|null}[]=[];
 const allowed=[origin+'/analysis/mixed-c.json',origin+'/analysis/force-d.json'];
 await page.route('**/*',route=>{const r=route.request(); if(r.url()===origin+'/api/engine-capability'&&r.method()==='GET'&&r.postData()===null)return route.continue(); outbound.push({url:r.url(),method:r.method(),body:r.postData()}); return allowed.includes(r.url()) ? route.continue() : route.abort();});
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'私人名字.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(c.replace('RE[B+R]','RE[B+R]PB[私人昵称]PW[私人对手]C[私人评论]'))});
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 3 个');
 await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-force.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 1 个');
 // Removing ac allows W ab to escape after B ba. It is not the verified source.
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'counterexample.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]GM[1]SZ[19]CA[UTF-8]RU[Chinese]KM[7.5]AB[ca][bb]AW[aa]PL[B];B[ba];W[ss];B[ab];W[rr])')});
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByText('当前没有对应示例分析；仍可回放。')).toBeVisible();
 await expect(page.getByRole('region',{name:'局面教学'})).toHaveCount(0);
 expect(outbound).toEqual(allowed.map(url=>({url,method:'GET',body:null})));
});
test('一条pass变化能提不代表强制：对方延伸原链可逃则拒绝', async ({page}) => {
 // C step0: W bb, B pass, W ca captures ba; but B ca legally extends to da/cb.
 const falseForce={id:'pv-only',step:0,player:'W',kind:'force',teaching:'bb',engine:'bb',evidence:[{move:'bb',targets:[{stones:['ba'],liberties:['ca','bb']}],captured:['ba'],third:'ca'}]};
 await page.route('**/analysis/mixed-c.json',route=>route.fulfill({json:{context,candidates:[falseForce]}}));
 await page.goto('/'); await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 0 个');
 await expect(page.getByRole('button',{name:'直接看答案'})).toHaveCount(0);
});
test('C旧成功失败均不覆盖D队列或当前课，返回上一课清空试下提示答案', async ({page}) => {
 for (const fail of [false,true]) {
  let release!:()=>void; const gate=new Promise<void>(r=>release=r);
  await page.route('**/analysis/mixed-c.json',async route=>{await gate; await route.fulfill(fail ? {status:503,body:'old failure'} : {json:{context,candidates:[rescue,capture,connect]}});});
  await page.goto('/'); await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
  await expect(page.getByRole('region',{name:'教学精选'})).toContainText('分析中');
  await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-force.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
  await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 1 个');
  await page.getByRole('button',{name:'进入核验教学局面'}).click();
  await page.getByRole('button',{name:'直接看答案'}).click();
  const response=page.waitForResponse('**/analysis/mixed-c.json'); release(); await response;
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 1 个');
  await expect(page.getByRole('region',{name:'教学精选'})).not.toContainText('分析失败');
  await expect(page.getByRole('region',{name:'局面教学'})).toContainText('固定第三手 ab');
  await page.unroute('**/analysis/mixed-c.json');
 }
 await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await page.getByRole('button',{name:'请求提示'}).click(); await page.getByRole('button',{name:'直接看答案'}).click();
 await page.getByRole('button',{name:'下一个精选'}).click(); await page.getByRole('button',{name:'上一个精选'}).click();
 const lesson=page.getByRole('region',{name:'局面教学'});
 await expect(lesson).not.toContainText('原局面提示'); await expect(lesson).not.toContainText('实战落子：');
 await expect(lesson.getByRole('button',{name:'ab 空',exact:true})).toBeVisible();
});
test('两类推荐合计目标不能超过两链，不把每条推荐各自合规当整题合规', async ({page}) => {
 // At C step1 ll joins lm/ml; its liberties are kl/lk/km/ln/nl/mk.
 const tooMany={...connect,engine:'ll',evidence:[...connect.evidence,{move:'ll',targets:[{stones:['lm'],liberties:['km','ll','ln']},{stones:['ml'],liberties:['ll','nl','mk']}],captured:[],afterLiberties:['kl','lk','km','ln','nl','mk']}]};
 await page.route('**/analysis/mixed-c.json',route=>route.fulfill({json:{context,candidates:[tooMany]}}));
 await page.goto('/'); await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 0 个');
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('最多2链/6子');
});
test('同ID同步不同目标的合法课往返时清空答案提示试下及变化', async ({page}) => {
 const other = {...connect,teaching:'ll',engine:'ll',evidence:[{move:'ll',targets:[{stones:['lm'],liberties:['km','ll','ln']},{stones:['ml'],liberties:['ll','nl','mk']}],captured:[],afterLiberties:['kl','lk','km','ln','nl','mk']}]};
 await page.route('**/analysis/mixed-c.json',route=>route.fulfill({json:{context,candidates:[connect,other]}}));
 await page.goto('/'); await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 2 个');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 const lesson=page.getByRole('region',{name:'局面教学'});
 const initial = async (target:string) => {
  await expect(lesson).toContainText('目标黑 '+target);
  await expect(lesson).toContainText('模式：先试下一手');
  await expect(lesson).not.toContainText('原局面提示');
  await expect(lesson).not.toContainText('实战落子：');
  await expect(lesson).not.toContainText('达到本课目标');
  for (const point of ['gi','ll','dd']) await expect(lesson.getByRole('button',{name:point+' 空',exact:true})).toBeVisible();
  await expect(lesson.locator('[data-mark]')).toHaveCount(0);
  await expect(page.getByRole('region',{name:'变化探索'})).toHaveCount(0);
 };
 await initial('gh、gj');
 for (const action of ['答案','试下','变化']) {
  await lesson.getByRole('button',{name:'请求提示'}).click();
  await lesson.getByRole('button',{name:'直接看答案'}).click();
  if (action === '试下') await lesson.getByRole('button',{name:'dd 空',exact:true}).click();
  if (action === '变化') await lesson.getByRole('button',{name:'探索连续变化'}).click();
  await page.getByRole('button',{name:'下一个精选'}).click();
  await initial('lm、ml');
  await lesson.getByRole('button',{name:'请求提示'}).click();
  await expect(lesson.getByRole('button',{name:'lm 黑',exact:true})).toHaveAttribute('data-mark','目标');
  await lesson.getByRole('button',{name:'直接看答案'}).click();
  await expect(lesson.getByRole('button',{name:'ll 黑',exact:true})).toBeVisible();
  if (action === '试下') await lesson.getByRole('button',{name:'dd 空',exact:true}).click();
  if (action === '变化') await lesson.getByRole('button',{name:'探索连续变化'}).click();
  await page.getByRole('button',{name:'上一个精选'}).click();
  await initial('gh、gj');
 }
});
test('连接课偏离目标的合法试下分别说明两条棋链的实际气', async ({page}) => {
 await page.goto('/'); await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-mixed.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await page.getByRole('button',{name:'下一个精选'}).click();
 await page.getByRole('button',{name:'下一个精选'}).click();
 const lesson=page.getByRole('region',{name:'局面教学'});
 await lesson.getByRole('button',{name:'dd 空',exact:true}).click();
 await expect(lesson.getByRole('button',{name:'dd 黑',exact:true})).toBeVisible();
 for (const point of ['gh','gj']) await expect(lesson.getByRole('button',{name:point+' 黑',exact:true})).toBeVisible();
 for (const point of ['fh','hh','gg','gi','fj','hj','gk']) await expect(lesson.getByRole('button',{name:point+' 空',exact:true})).toBeVisible();
 const feedback=lesson.locator('p[aria-live="polite"]').filter({hasText:'未达到本课目标'});
 // Independent four-neighbor facts, not a snapshot or application-generated expected value.
 await expect(feedback).toContainText(/黑 gh[^；。]*fh、hh、gg、gi/);
 await expect(feedback).toContainText(/黑 gj[^；。]*fj、hj、gi、gk/);
 await expect(feedback).not.toContainText('黑 gh、gj');
 await expect(feedback).toContainText('不等于全局坏棋');
 await expect(feedback).not.toContainText('已掌握');
});
test('上传A即分析并精选一个目标，数量时长只是目标', async ({page}) => {
 await page.goto('/');
 await page.getByLabel('选择 SGF 文件').setInputFiles('tests/fixtures/manual-finished.sgf');
 await page.getByRole('button',{name:'预设教学入口',exact:true}).click();
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('精选 1 个');
 await expect(page.getByRole('region',{name:'教学精选'})).toContainText('10–15 分钟');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await page.getByRole('button',{name:'直接看答案'}).click();
 await expect(page.getByRole('region',{name:'局面教学'})).toContainText('提走白 aa');
});

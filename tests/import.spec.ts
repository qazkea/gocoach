import {test,expect} from "@playwright/test";
async function upload(page: import('@playwright/test').Page, sgf: string | Buffer) {
 await page.getByLabel("选择 SGF 文件").setInputFiles({name:"fixture.sgf",mimeType:"application/x-go-sgf",buffer:typeof sgf === "string" ? Buffer.from(sgf) : sgf});
}
const header = ";FF[4]GM[1]SZ[19]CA[UTF-8]RU[Chinese]KM[7.5]";
test("提子与俘虏随导航还原", async ({page}) => {
 await page.goto("/");
 await upload(page, `(${header};B[ba];W[aa];B[ab])`);
 await page.getByRole("button", {name:"末尾",exact:true}).click();
 await expect(page.getByRole("img", {name:"aa 空",exact:true})).toBeVisible();
 await expect(page.getByText("黑提子：1；白提子：0", {exact:true})).toBeVisible();
 await page.getByRole("button", {name:"上一手",exact:true}).click();
 await expect(page.getByRole("img", {name:"aa 白",exact:true})).toBeVisible();
 await expect(page.getByText("黑提子：0；白提子：0", {exact:true})).toBeVisible();
});
test("基础合法性拒绝占点自杀及未知规则", async ({page}) => {
 await page.goto("/");
 for (const [sgf, message] of [
  [`(${header};B[aa];W[aa])`, "占点"],
  [`(${header};B[ba];W[ss];B[ab];W[aa])`, "自杀"],
  [`(${header.replace("Chinese", "unknown")};B[dd])`, "规则"],
  [`(${header};W[dd])`, "行棋方"],
 ]) {
  await upload(page, sgf);
  await expect(page.getByRole("alert")).toContainText(message);
  await expect(page.getByRole("region", {name:"棋谱回放"})).toHaveCount(0);
 }
});
test("初始setup矩形清空与让子不自动摆放", async ({page}) => {
 await page.goto("/");
 await upload(page, `(${header}HA[2]AB[aa:bb];AE[aa]AW[cc]PL[W];C[注释];W[dd];B[ee])`);
 await expect(page.getByRole("img", {name:"aa 空",exact:true})).toBeVisible();
 for (const point of ["ab", "ba", "bb"]) await expect(page.getByRole("img", {name:point+" 黑",exact:true})).toBeVisible();
 await expect(page.getByRole("img", {name:"cc 白",exact:true})).toBeVisible();
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region", {name:"棋谱信息"})).toContainText("让子记录：2");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await page.getByRole("button", {name:"末尾",exact:true}).click();
 await expect(page.getByText("第 2 / 2 手：B ee",{exact:true})).toBeVisible();
 await upload(page, `(${header}HA[2];W[dd])`);
 await expect(page.getByRole("img", {name:"dd 空",exact:true})).toBeVisible();
 await expect(page.getByRole("img", {name:"pd 空",exact:true})).toBeVisible();
 await page.getByRole("button", {name:"末尾",exact:true}).click();
 await expect(page.getByRole("img", {name:"dd 白",exact:true})).toBeVisible();
});
test("拒绝不可靠setup与例外而不静默跳过", async ({page}) => {
 await page.goto("/");
 for (const setup of ["AB[aa:bb]AW[bb]", "AB[aa][aa]", "AB[tt]", "AB[bb:aa]", "AB[aa:bb:cc]", "PL[X]", "HA[-1]", "HA[1]", "HA[2.5]", "AB[aa]AW[ab][ba]"]) {
  await upload(page, `(${header}${setup};B[dd])`);
  await expect(page.getByRole("alert")).toContainText("导入失败");
 }
 await upload(page, `(${header};B[dd]KO[])`);
 await expect(page.getByRole("alert")).toContainText("KO");
});
test("pass计步简单劫拒绝长循环只报不支持", async ({page}) => {
 await page.goto("/");
 const ko = "AB[ab][ba][cb]AW[bb][ac][cc][bd]";
 for (const rule of ["Chinese", "Japanese"]) {
  const root = header.replace("Chinese", rule);
  await upload(page, `(${root}${ko};B[bc];W[bb])`);
  await expect(page.getByRole("alert")).toContainText("简单劫");
  await upload(page, `(${root}${ko};B[bc];W[];B[tt];W[bb])`);
  await expect(page.getByRole("alert")).toContainText("暂不支持该循环规则");
  await upload(page, `(${root}${ko};B[bc];W[];C[不是一手];B[tt])`);
  await page.getByRole("button", {name:"末尾",exact:true}).click();
  await expect(page.getByText("第 3 / 3 手：B pass",{exact:true})).toBeVisible();
  await expect(page.getByRole("img", {name:"bb 空",exact:true})).toBeVisible();
  await expect(page.getByRole("img", {name:"bc 黑",exact:true})).toBeVisible();
  await expect(page.getByText("黑提子：1；白提子：0",{exact:true})).toBeVisible();
 }
});
test("先解码GBK尾字节再处理SGF转义且Latin1不变1252", async ({page}) => {
 await page.goto("/");
 const gbk = Buffer.concat([Buffer.from(`(${header.replace("UTF-8", "GBK")}PB[`), Buffer.from([0x81, 0x5c]), Buffer.from("])")]);
 await upload(page, gbk);
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region", {name:"棋谱信息"})).toContainText("乗");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 const latin = Buffer.concat([Buffer.from(`(${header.replace("CA[UTF-8]", "")}PB[`), Buffer.from([0x80, 0xe9]), Buffer.from("];B[dd])")]);
 await upload(page, latin);
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region", {name:"棋谱信息"})).toContainText("\u0080é");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await upload(page, `(${header}PB[甲\\]乙\\\\丙\\\n丁];B[dd])`);
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region", {name:"棋谱信息"})).toContainText("甲]乙\\丙丁");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 for (const bytes of [Buffer.from(`(${header.replace("UTF-8", "UTF-16")};B[dd])`), Buffer.concat([Buffer.from(`(${header}PB[`), Buffer.from([0xff]), Buffer.from("];B[dd])")]), Buffer.concat([Buffer.from(`(${header.replace("UTF-8", "GBK")}PB[`), Buffer.from([0x81, 0x30]), Buffer.from("];B[dd])")])]) {
  await upload(page, bytes);
  await expect(page.getByRole("alert")).toContainText("编码");
 }
});
test("严格属性位置与支持边界且信息节点可在落子前", async ({page}) => {
 await page.goto("/");
 for (const body of [";B[dd]AP[tool:1]", ";B[dd]ST[0]", ";B[dd]C[a][b]", ";B[dd]XX[x]", ";B[dd];W[pp]RU[Japanese]", ";B[dd];W[pp]KM[6.5]"]) {
  await upload(page, `(${header}${body})`);
  await expect(page.getByRole("alert")).toContainText("导入失败");
  await expect(page.getByRole("region",{name:"棋谱回放"})).toHaveCount(0);
 }
 await upload(page, "(;FF[4]GM[1]SZ[19];RU[Chinese]KM[7.5]PB[甲];C[说明];B[dd])");
 await expect(page.getByRole("status")).toContainText("导入成功");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("未记录（不推断胜负或结束）");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
});
test("输入体积和节点上限明确反馈并可重传", async ({page}) => {
 await page.goto("/");
 await upload(page, `(${header}C[${"x".repeat(1024 * 1024)}])`);
 await expect(page.getByRole("alert")).toContainText("1 MiB");
 await upload(page, `(${header}${";C[x]".repeat(2000)})`);
 await expect(page.getByRole("alert")).toContainText("2000");
 await upload(page, `(${header};B[dd])`);
 await expect(page.getByRole("status")).toContainText("导入成功");
});
test("界面说明有限支持且键盘可导航", async ({page}) => {
 await page.goto("/");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByText(/仅基础回放校验/)).toBeVisible();
 await expect(page.getByText(/1 MiB/)).toBeVisible();
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await upload(page, `(${header};B[dd];W[pp])`);
 const replay = page.getByRole("region",{name:"棋谱回放"});
 await replay.focus();
 await page.keyboard.press("ArrowRight");
 await expect(page.getByRole("img",{name:"dd 黑",exact:true})).toBeVisible();
 await page.keyboard.press("End");
 await expect(page.getByRole("img",{name:"pp 白",exact:true})).toBeVisible();
 await page.keyboard.press("ArrowLeft");
 await expect(page.getByRole("img",{name:"pp 空",exact:true})).toBeVisible();
 await page.keyboard.press("Home");
 await expect(page.getByRole("img",{name:"dd 空",exact:true})).toBeVisible();
});
test("迟到文件读取成功或失败不污染新棋局且无文件外发", async ({page,baseURL}) => {
 const origin=new URL(baseURL!).origin;
 const outbound: string[] = [];
 let loaded = false;
 await page.route("**/*", route => {
  const request = route.request();
  const capability=request.url()===origin+"/api/engine-capability" && request.method()==="GET" && request.postData()===null;
  if ((loaded&&!capability) || new URL(request.url()).origin!==origin || request.method() !== "GET" || request.postData()) {
   outbound.push(request.url());
   return route.abort();
  }
  return route.continue();
 });
 page.on("websocket", socket => {
  if (new URL(socket.url()).origin!==origin.replace("http:","ws:")) outbound.push(socket.url());
  socket.on("framesent", frame => {
   if (String(frame.payload) !== '{"type":"ping"}') outbound.push(String(frame.payload));
  });
 });
 await page.goto("/");
 loaded = true;
 await page.evaluate(() => {
  const original = File.prototype.arrayBuffer;
  File.prototype.arrayBuffer = function () {
   if (!this.name.startsWith("slow")) return original.call(this);
   return new Promise<ArrayBuffer>((resolve, reject) => {
    (window as unknown as {release: () => Promise<void>}).release = async () => {
     if (this.name === "slow-error.sgf") reject(Error("读取失败"));
     else resolve(await original.call(this));
    };
   });
  };
 });
 for (const name of ["slow.sgf", "slow-error.sgf"]) {
  await page.getByLabel("选择 SGF 文件").setInputFiles({name,mimeType:"application/x-go-sgf",buffer:Buffer.from(`(${header}PB[旧私人昵称];B[aa])`)});
  await expect(page.getByRole("status")).toContainText("正在本地读取");
  await upload(page, `(${header}PB[新私人昵称];B[dd])`);
  await expect(page.getByRole("status")).toContainText("导入成功");
  await page.evaluate(async () => {
   await (window as unknown as {release: () => Promise<void>}).release();
   await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
 await page.getByText('说明与棋谱信息',{exact:true}).click();
  await expect(page.getByRole("region", {name:"棋谱信息"})).toContainText("新私人昵称");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", {name:"末尾",exact:true}).click();
  await expect(page.getByRole("img", {name:"dd 黑",exact:true})).toBeVisible();
  await expect(page.getByRole("img", {name:"aa 空",exact:true})).toBeVisible();
 }
 expect(outbound).toEqual([]);
});
test("多子提取先于自身气检查且可在历史空点重下", async ({page}) => {
 await page.goto("/");
 await upload(page, `(${header}AB[ca][bb]AW[aa][ba];B[ab];W[aa];B[ss])`);
 await page.getByRole("button",{name:"下一手",exact:true}).click();
 await expect(page.getByRole("img",{name:"aa 空",exact:true})).toBeVisible();
 await expect(page.getByRole("img",{name:"ba 空",exact:true})).toBeVisible();
 await expect(page.getByRole("img",{name:"ab 黑",exact:true})).toBeVisible();
 await expect(page.getByText("黑提子：2；白提子：0",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"下一手",exact:true}).click();
 await expect(page.getByRole("img",{name:"aa 白",exact:true})).toBeVisible();
 await upload(page, `(${header}PL[W]AW[ab][ba][cb]AB[bb][ac][cc][bd];W[bc])`);
 await page.getByRole("button",{name:"末尾",exact:true}).click();
 await expect(page.getByRole("img",{name:"bb 空",exact:true})).toBeVisible();
 await expect(page.getByRole("img",{name:"bc 白",exact:true})).toBeVisible();
 await expect(page.getByText("黑提子：0；白提子：1",{exact:true})).toBeVisible();
});
test("三处劫六手形成非立即全盘重复只拒绝支持范围", async ({page}) => {
 await page.goto("/");
 const setup = "AB[ab][ba][cb][hb][gc][ic][hd][mb][na][ob]AW[bb][ac][cc][bd][gb][ha][ib][nb][mc][oc][nd]";
 await upload(page, `(${header}${setup};B[bc];W[hc];B[nc];W[bb];B[hb])`);
 await expect(page.getByRole("status")).toContainText("导入成功");
 await upload(page, `(${header}${setup};B[bc];W[hc];B[nc];W[bb];B[hb];W[nb])`);
 await expect(page.getByRole("alert")).toContainText("暂不支持该循环规则");
});
test("拒绝坏数值与根属性值而非导入成功", async ({page}) => {
 await page.goto("/");
 for (const sgf of [
  `(${header.replace("KM[7.5]", "KM[.5]")};B[dd])`,
  `(${header.replace("KM[7.5]", "KM[5.]")};B[dd])`,
  `(${header}ST[9];B[dd])`,
  `(${header}AP[broken];B[dd])`,
 ]) {
  await upload(page, sgf);
  await expect(page.getByRole("alert")).toContainText("导入失败");
 }
});
test("FF4拒绝一格压缩矩形和错误转义类型", async ({page}) => {
 await page.goto("/");
 for (const sgf of [
  `(${header}AB[aa:aa];B[dd])`,
  `(${header}AP[tool\\:version];B[dd])`,
  `(${header};B[\\d\\d])`,
 ]) {
  await upload(page, sgf);
  await expect(page.getByRole("alert")).toContainText("导入失败");
 }
});
test("完整合成赛后样例四手提子与最终记录", async ({page}) => {
 await page.goto("/");
 await page.getByLabel("选择 SGF 文件").setInputFiles("tests/fixtures/manual-finished.sgf");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("W+R");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await page.getByRole("button",{name:"末尾",exact:true}).click();
 await expect(page.getByText("第 4 / 4 手：W ss",{exact:true})).toBeVisible();
 for (const name of ["aa 空", "ba 黑", "ab 黑", "ss 白"]) {
  await expect(page.getByRole("img",{name,exact:true})).toBeVisible();
 }
 await expect(page.getByText("黑提子：1；白提子：0",{exact:true})).toBeVisible();
});
const simple="(;FF[4]GM[1]SZ[19]CA[UTF-8]RU[Japanese]KM[6.5]RE[B+R];B[dd];W[pp])";
test("上传后按实际落子前后浏览",async({page})=>{
 await page.goto("/");
 await page.getByLabel("选择 SGF 文件").setInputFiles({name:"simple.sgf",mimeType:"application/x-go-sgf",buffer:Buffer.from(simple)});
 await expect(page.getByRole("status")).toContainText("导入成功");
 await expect(page.getByRole("img",{name:"dd 空"})).toBeVisible();
 await page.getByRole("button",{name:"下一手",exact:true}).click();
 await expect(page.getByRole("img",{name:"dd 黑"})).toBeVisible();
 await expect(page.getByRole("img",{name:"pp 空"})).toBeVisible();
 await page.getByRole("button",{name:"末尾",exact:true}).click();
 await expect(page.getByRole("img",{name:"pp 白"})).toBeVisible();
 await page.getByRole("button",{name:"上一手",exact:true}).click();
 await expect(page.getByRole("img",{name:"pp 空"})).toBeVisible();
 await page.getByRole("button",{name:"起始",exact:true}).click();
 await expect(page.getByRole("img",{name:"dd 空"})).toBeVisible();
});
test("结果与元数据保留且编码正确",async({page})=>{
 await page.goto("/");
 const sgf=simple.replace("RU[Japanese]","PB[棋手甲]RU[Japanese]");
 await page.getByLabel("选择 SGF 文件").setInputFiles({name:"utf8.sgf",mimeType:"application/x-go-sgf",buffer:Buffer.from(sgf)});
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("棋手甲");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("Japanese");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("6.5");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("B+R");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 const latin=simple.replace("CA[UTF-8]","PB[André]");
 await page.getByLabel("选择 SGF 文件").setInputFiles({name:"latin.sgf",mimeType:"application/x-go-sgf",buffer:Buffer.from(latin,"latin1")});
 await page.getByText('说明与棋谱信息',{exact:true}).click();
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("André");
 await page.getByText('说明与棋谱信息',{exact:true}).click();
});
test("拒绝无法可靠还原的结构和元数据",async({page})=>{
 await page.goto("/");
 const invalid=[simple.replace("SZ[19]","SZ[13]"),simple.replace("KM[6.5]","KM[no]"),simple.replace("FF[4]","FF[3]"),simple.replace("GM[1]","GM[2]"),simple.replace(";B[dd]",";B[dd]W[qq]"),simple.replace(";B[dd]",";B[dd][ee]"),simple.replace(";B[dd]",";B[dd]B[ee]"),simple.replace(";W[pp]",";AB[pp]"),simple+simple,simple.slice(0,-1)+"(;B[qq])(;B[rr]))"];
 for(const sgf of invalid){
  await page.getByLabel("选择 SGF 文件").setInputFiles({name:"invalid.sgf",mimeType:"application/x-go-sgf",buffer:Buffer.from(sgf)});
  await expect(page.getByRole("alert")).toContainText("导入失败");
  await expect(page.getByRole("region",{name:"棋谱回放"})).toHaveCount(0);
 }
});
test("缺少必要元数据明确要求补齐",async({page})=>{
 await page.goto("/");
 for(const field of ["RU[Japanese]","KM[6.5]"]){
  await page.getByLabel("选择 SGF 文件").setInputFiles({name:"missing.sgf",mimeType:"application/x-go-sgf",buffer:Buffer.from(simple.replace(field,""))});
  await expect(page.getByRole("alert")).toContainText("补齐");
  await expect(page.getByRole("region",{name:"棋谱回放"})).toHaveCount(0);
 }
});
test("损坏语法拒绝且重新上传恢复",async({page})=>{
 await page.goto("/");
 await page.getByLabel("选择 SGF 文件").setInputFiles({name:"broken.sgf",mimeType:"application/x-go-sgf",buffer:Buffer.from(simple.slice(0,-1))});
 await expect(page.getByRole("alert")).toContainText("导入失败");
 await expect(page.getByRole("region",{name:"棋谱回放"})).toHaveCount(0);
 await page.getByLabel("选择 SGF 文件").setInputFiles({name:"valid.sgf",mimeType:"application/x-go-sgf",buffer:Buffer.from(simple)});
 await expect(page.getByRole("status")).toContainText("导入成功");
 await page.getByRole("button",{name:"末尾",exact:true}).click();
 await expect(page.getByRole("img",{name:"pp 白"})).toBeVisible();
});

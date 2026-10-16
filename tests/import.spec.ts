import {test,expect} from "@playwright/test";
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
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("棋手甲");
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("Japanese");
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("6.5");
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("B+R");
 const latin=simple.replace("CA[UTF-8]","PB[André]");
 await page.getByLabel("选择 SGF 文件").setInputFiles({name:"latin.sgf",mimeType:"application/x-go-sgf",buffer:Buffer.from(latin,"latin1")});
 await expect(page.getByRole("region",{name:"棋谱信息"})).toContainText("André");
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

import {test, expect} from './engine-fixture';
import {mkdir} from 'node:fs/promises';

test('可控引擎棋盘黑白焦点预览不分析不改状态，落子与pass撤回重走保留最近手', async ({page,engineServer}) => {
 await page.goto(engineServer.url);
 await page.getByLabel('导入后自动整局扫描').uncheck();
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'visual.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from('(;FF[4]RU[Chinese]KM[7.5];B[dd];W[pp])')});
 await page.getByRole('button',{name:'打开本地真实引擎分析'}).click();
 const panel = page.getByRole('region',{name:'本地引擎分析'});
 await expect(panel).toContainText('分析完成');
 let requests=0;
 page.on('request',r=>{if(r.url().includes('/api/'))requests++;});
 for (const [point,color,count] of [['aa','B',0],['ss','W',1]] as const) {
  const cell=panel.getByRole('button',{name:point+' 空',exact:true});
  const before=await panel.innerText();
  const queries=await engineServer.observed();
  const beforeRequests=requests;
  await cell.hover();
  await expect(cell.locator('.preview.'+color)).toHaveCSS('opacity','0.42');
  await cell.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
  await expect(cell).toBeFocused();
  await expect(cell).toHaveCSS('outline-style','solid');
  await expect(panel).toContainText(`变化 ${count} 手`);
  expect(await panel.innerText()).toBe(before);
  expect(requests).toBe(beforeRequests);
  expect(await engineServer.observed()).toEqual(queries);
  if(process.env.BOARD_SCREENSHOTS) {
   await mkdir(process.env.BOARD_SCREENSHOTS,{recursive:true});
   await page.mouse.move(0,0);
   await panel.screenshot({path:`${process.env.BOARD_SCREENSHOTS}/controlled-engine-${color}-preview.png`});
  }
  await cell.press('Enter');
  await expect(panel).toContainText('分析完成');
  await expect(panel.getByRole('button',{name:point+' '+(color==='B'?'黑':'白'),exact:true})).toHaveAttribute('data-last-move','');
 }
 await panel.getByRole('button',{name:'引擎变化 Pass',exact:true}).click();
 await expect(panel.locator('[data-last-move]')).toHaveCount(0);
 await panel.getByRole('button',{name:'引擎变化撤回',exact:true}).click();
 await expect(panel.getByRole('button',{name:'ss 白',exact:true})).toHaveAttribute('data-last-move','');
 await panel.getByRole('button',{name:'引擎变化重走',exact:true}).click();
 await expect(panel.locator('[data-last-move]')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'棋谱回放'}).getByRole('img',{name:'aa 空',exact:true})).toBeVisible();
});

import {test, expect, type Page, type Locator} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
async function capture(region: Locator, name: string) {
 const dir = process.env.BOARD_SCREENSHOTS;
 if (!dir) return;
 await mkdir(dir, {recursive:true});
 await region.page().mouse.move(0,0);
 await region.screenshot({path:`${dir}/${name}.png`});
}
const header = ';FF[4]GM[1]SZ[19]CA[UTF-8]RU[Chinese]KM[7.5]RE[W+R]';
async function upload(page: Page, moves = ';B[aa];W[ss];B[jj];W[]') {
 await page.goto('/');
 await page.getByLabel('选择 SGF 文件').setInputFiles({name:'visual.sgf',mimeType:'application/x-go-sgf',buffer:Buffer.from(`(${header}${moves})`)});
}
test('教学重试预览保持原执棋方，标记不遮棋子，变化预览随双方交替', async ({page}) => {
 await upload(page, ';B[ba];W[aa];B[ab];W[ss]');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 const lesson = page.getByRole('region',{name:'局面教学'});
 await expect(lesson).toContainText('半透明棋子仅为试下预览，不代表合法落子');
 const point = lesson.getByRole('button',{name:'dd 空',exact:true});
 let requests = 0;
 page.on('request', r => {if(r.url().includes('/analysis/') || r.url().includes('/api/')) requests++;});
 await lesson.getByRole('button',{name:'请求提示'}).click();
 await expect(lesson.getByRole('button',{name:'aa 白',exact:true})).toHaveAttribute('data-mark','目标');
 await expect(lesson.getByRole('button',{name:'ab 空',exact:true})).toHaveAttribute('data-mark','气');
 await capture(lesson, 'teaching-hint');
 await point.hover();
 await expect(point.locator('.preview.B')).toHaveCSS('opacity','0.42');
 await expect(point).toHaveAttribute('aria-label','dd 空');
 await point.focus();
 await page.keyboard.press('Tab');
 await page.keyboard.press('Shift+Tab');
 await expect(point).toBeFocused();
 await expect(point).toHaveCSS('outline-style','solid');
 expect(requests).toBe(0);
 await capture(lesson, 'teaching-focus-preview');
 await point.press('Enter');
 await expect(lesson.getByRole('button',{name:'dd 黑',exact:true})).toBeVisible();
 const next = lesson.getByRole('button',{name:'ee 空',exact:true});
 await next.hover();
 await expect(next.locator('.preview.B')).toHaveCSS('opacity','0.42');
 await next.click();
 await expect(lesson.getByRole('button',{name:'ee 黑',exact:true})).toHaveAttribute('data-last-move','');
 await expect(lesson.getByRole('button',{name:'dd 空',exact:true})).toBeVisible();
 await lesson.getByRole('button',{name:'直接看答案'}).click();
 await expect(lesson.getByRole('button',{name:'aa 空',exact:true})).toHaveAttribute('data-mark','目标');
 await expect(lesson.getByRole('button',{name:'ab 黑',exact:true})).toHaveAttribute('data-mark','推荐');
 await capture(lesson, 'teaching-capture-recommendation');
 await lesson.getByRole('button',{name:'探索连续变化'}).click();
 const variation = page.getByRole('region',{name:'变化探索'});
 await variation.getByRole('button',{name:'dd 空',exact:true}).click();
 const white = variation.getByRole('button',{name:'ss 空',exact:true});
 await white.hover();
 await expect(white.locator('.preview.W')).toHaveCSS('opacity','0.42');
 await white.focus();
 await page.keyboard.press('Shift+Tab');
 await page.keyboard.press('Tab');
 await capture(variation, 'continuous-preview');
 await white.click();
 await expect(variation.getByRole('button',{name:'ss 白',exact:true}).locator('.last-move')).toBeVisible();
 await variation.getByRole('button',{name:'Pass',exact:true}).click();
 await expect(variation.locator('[data-last-move]')).toHaveCount(0);
 await variation.getByRole('button',{name:'撤回一手'}).click();
 await expect(variation.getByRole('button',{name:'ss 白',exact:true}).locator('.last-move')).toBeVisible();
 await expect(page.getByRole('region',{name:'棋谱回放'}).getByRole('img',{name:'dd 空',exact:true})).toBeVisible();
});
test('390窄屏四角与中心交叉点几何吻合且点击无偏移', async ({page}) => {
 await page.setViewportSize({width:390,height:844});
 await upload(page, ';B[ba];W[aa];B[ab];W[ss]');
 await page.getByRole('button',{name:'进入核验教学局面'}).click();
 await page.getByRole('button',{name:'探索连续变化'}).click();
 const region = page.getByRole('region',{name:'变化探索'});
 const board = region.getByLabel('变化棋盘',{exact:true});
 const box = (await board.boundingBox())!;
 expect(Math.abs(box.width-box.height)).toBeLessThan(1);
 expect(box.x).toBeGreaterThanOrEqual(0);
 expect(box.x+box.width).toBeLessThanOrEqual(390);
 const coordinate = (await board.locator('svg text').first().boundingBox())!;
 expect(coordinate.height).toBeGreaterThanOrEqual(9);
 // Compare rendered line endpoints to rendered HTML centers, not CSS constants.
 const grid = await board.locator('svg').evaluate(svg => {
  const lines = svg.querySelectorAll('line');
  const first = lines[0].getBoundingClientRect(), last = lines[36].getBoundingClientRect();
  return {left:first.left,right:first.right,top:first.top,bottom:last.top};
 });
 for (const [p,x,y,color] of [['aa',grid.left,grid.top,'白'],['sa',grid.right,grid.top,'空'],['as',grid.left,grid.bottom,'空'],['ss',grid.right,grid.bottom,'空'],['jj',(grid.left+grid.right)/2,(grid.top+grid.bottom)/2,'空']] as const) {
  const cell = region.getByRole('button',{name:`${p} ${color}`,exact:true});
  const b = (await cell.boundingBox())!;
  expect(Math.abs(b.x+b.width/2-x)).toBeLessThan(1);
  expect(Math.abs(b.y+b.height/2-y)).toBeLessThan(1);
  expect(b.x).toBeGreaterThan(box.x);
  expect(b.x+b.width).toBeLessThan(box.x+box.width);
 }
 for (const p of ['aa','sa','as','ss','jj']) {
  await region.getByRole('button',{name:`${p} ${p==='aa'?'白':'空'}`,exact:true}).click();
  if(p==='aa') await expect(region.getByRole('alert')).toBeVisible();
  else await expect(region.getByRole('button',{name:`${p} ${p==='as'||p==='jj'?'白':'黑'}`,exact:true})).toHaveAttribute('data-last-move','');
 }
 await capture(board, 'narrow-390');
});
test('回放绘制连续网格圆形棋子，最近一手跟随帧而非pass', async ({page}) => {
 await upload(page);
 const board = page.getByLabel('19 路棋盘', {exact:true});
 const dimensions=(await board.boundingBox())!;
 expect(dimensions.width).toBeGreaterThanOrEqual(600);
 expect(dimensions.width).toBeLessThanOrEqual(640);
 await board.getByRole('img',{name:'aa 空',exact:true}).click();
 await expect(board.getByRole('img',{name:'aa 空',exact:true})).toBeVisible();
 await expect(board.getByRole('button')).toHaveCount(0);
 await expect(board).not.toContainText('+');
 await expect(board.locator('svg line')).toHaveCount(38);
 await expect(board.locator('svg circle')).toHaveCount(9);
 await expect(board.locator('[data-last-move]')).toHaveCount(0);
 await page.getByRole('button',{name:'下一手',exact:true}).click();
 const stone = board.getByRole('img',{name:'aa 黑',exact:true});
 await expect(stone.locator('.stone')).toHaveCSS('border-radius','50%');
 await expect(stone.locator('.last-move')).toBeVisible();
 await page.getByRole('button',{name:'末尾',exact:true}).click();
 await expect(board.locator('[data-last-move]')).toHaveCount(0);
 await page.getByRole('button',{name:'上一手',exact:true}).click();
 await expect(board.getByRole('img',{name:'jj 黑',exact:true}).locator('.last-move')).toBeVisible();
 await expect(board.locator('.preview')).toHaveCount(0);
 await capture(board, 'replay-desktop');
 await upload(page, ';B[dd];W[pd];B[dp];W[pp];B[jj];W[jd];B[dj];W[pj];B[jp];W[]');
 await page.getByRole('button',{name:'末尾',exact:true}).click();
 await capture(page.getByLabel('19 路棋盘',{exact:true}), 'comparison-board-desktop');
 await capture(page.locator('main'), 'comparison-page-desktop');
});

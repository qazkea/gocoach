import {test,expect,upload} from './fixture';
import {createServer} from 'node:http';

test('拒绝异 origin 导航重定向、新窗、权限及下载，不削弱 HTTP 同源保护',async({desktop})=>{
 let hits=0;
 const hostile=createServer((_req,res)=>{hits++;res.end('must not load');});
 await new Promise<void>(resolve=>hostile.listen(0,'127.0.0.1',resolve));
 const address=hostile.address();if(!address||typeof address==='string')throw Error('missing test listener');
 const other=`http://127.0.0.1:${address.port}`;
 try {
  const run=await desktop.launch(),page=run.page,origin=page.url();
  await page.evaluate(url=>{const link=document.createElement('a');link.href=url;link.textContent='external navigation probe';document.body.append(link);},other);
  await page.getByRole('link',{name:'external navigation probe'}).click({noWaitAfter:true});
  await page.waitForTimeout(200);
  expect(page.url()).toBe(origin);expect(hits).toBe(0);
  await page.reload(); // Clear Playwright's pending-navigation bookkeeping after native cancellation.
  await page.evaluate(url=>{window.open(url);const frame=document.createElement('iframe');frame.src=url;document.body.append(frame);},other);
  await page.waitForTimeout(200);
  expect(run.app.windows()).toHaveLength(1);expect(hits).toBe(0);
  // Synthetic HTTP redirect is a platform-network fault, not a mocked business endpoint.
  await page.route('**/desktop-redirect-probe',route=>route.fulfill({status:302,headers:{Location:other}}));
  await page.evaluate(()=>{const link=document.createElement('a');link.href='/desktop-redirect-probe';link.textContent='redirect probe';document.body.append(link);});
  await page.getByRole('link',{name:'redirect probe',exact:true}).click({noWaitAfter:true});
  await page.waitForTimeout(300);
  expect(page.url()).toBe(origin);expect(hits).toBe(0);
  await page.reload();
  const permission=await page.evaluate(()=>new Promise(resolve=>navigator.geolocation.getCurrentPosition(()=>resolve('allowed'),error=>resolve(error.code))));
  expect(permission).toBe(1);
  let downloads=0;page.on('download',()=>downloads++);
  await page.evaluate(()=>{const link=document.createElement('a');link.href='/index.html';link.download='blocked.html';document.body.append(link);link.click();});
  await page.waitForTimeout(300);expect(downloads).toBe(0);
  expect((await page.request.get(origin+'api/engine-capability',{headers:{Origin:other}})).status()).toBe(403);
  expect((await page.request.post(origin+'api/analyze',{data:{}})).status()).toBe(403);
  expect((await page.request.get(origin+'desktop/main.mjs')).status()).toBe(404);
  expect((await page.request.get(origin+'.scratch/go-coach/14-design.md')).status()).toBe(404);
  await run.close();
 } finally {await new Promise<void>(resolve=>hostile.close(()=>resolve()));}
});

test('真实生产窗口禁 Node 与内联脚本，CSP 保留棋盘与走势样式属性',async({desktop})=>{
 const run=await desktop.launch(),page=run.page;
 const response=await page.request.get(page.url());
 const csp=response.headers()['content-security-policy'];
 expect(csp).toContain("script-src 'self'");
 expect(csp).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/);
 expect(csp).toContain("style-src-attr 'unsafe-inline'");
 expect(await page.evaluate(()=>({require:typeof (globalThis as any).require,process:typeof (globalThis as any).process,Buffer:typeof (globalThis as any).Buffer}))).toEqual({require:'undefined',process:'undefined',Buffer:'undefined'});
 const blocked=await page.evaluate(()=>new Promise(resolve=>{
  document.addEventListener('securitypolicyviolation',event=>resolve({directive:event.effectiveDirective,ran:document.body.getAttribute('data-unsafe-script')}),{once:true});
  const script=document.createElement('script');script.textContent="document.body.setAttribute('data-unsafe-script','ran')";document.body.append(script);
 }));
 expect(blocked).toEqual({directive:'script-src-elem',ran:null});
 await desktop.select(run,desktop.operator);await upload(page);
 const review=page.getByRole('region',{name:'整局复盘'});
 await expect(review).toContainText('完成：5 / 5');
 const board=page.getByLabel('19 路棋盘',{exact:true});
 await expect(board).toBeVisible();
 expect(await board.locator('.board-points').evaluate(el=>getComputedStyle(el).display)).toBe('grid');
 expect(await review.getByLabel('逐手局面').evaluate(el=>getComputedStyle(el).maxHeight)).toBe('220px');
 await expect(review.getByRole('img',{name:'黑方胜率走势'}).locator('circle')).toHaveCount(5);
 await run.close();
});

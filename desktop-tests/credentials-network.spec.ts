import {test,expect} from './fixture';
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

test('离线密码配置不尝试Chromium后台外网下载（拒绝型本地代理）',async({desktop})=>{
 const attempts:string[]=[];
 const proxy=createServer((req,res)=>{attempts.push(req.method+' '+req.url);res.writeHead(502);res.end();});
 proxy.on('connect',(req,socket)=>{attempts.push('CONNECT '+req.url);socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');});
 await new Promise<void>(resolve=>proxy.listen(0,'127.0.0.1',resolve));
 const address=proxy.address();if(!address||typeof address==='string')throw Error('missing local denying proxy');
 try {
  const run=await desktop.launch({args:[`--proxy-server=http://127.0.0.1:${address.port}`]});
  const opened=run.app.waitForEvent('window');
  await run.app.evaluate(({Menu,BrowserWindow})=>{const item=Menu.getApplicationMenu()!.items.find(i=>i.label==='讲解')!.submenu!.items[1];item.click(item,BrowserWindow.getAllWindows()[0],{} as any);});
  const page=await opened;await page.getByLabel('DeepSeek Key',{exact:true}).fill('synthetic-network-08A');
  await page.getByRole('button',{name:'保存',exact:true}).click();await expect.poll(()=>page.isClosed()).toBe(true);
  await run.page.waitForTimeout(1000);
  await run.close();
  await writeFile(join(desktop.evidence,'denied-background-requests.json'),JSON.stringify(attempts,null,2));
  expect(attempts).toEqual([]);
 } finally {proxy.closeAllConnections();await new Promise<void>(resolve=>proxy.close(()=>resolve()));}
});

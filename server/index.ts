import {createServer, type IncomingMessage} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {KataGo} from './katago';
import {position} from './position';
import {Evidence,EvidenceExpired} from './evidence';
const production=process.argv.includes('--production');
const portIndex=process.argv.indexOf('--port');
const port=portIndex<0?5173:Number(process.argv[portIndex+1]);
if(!Number.isInteger(port)||port<0||port>65535) throw Error('无效端口');
const token=randomBytes(32).toString('hex');
const engine=new KataGo();
const evidence=new Evidence(session=>engine.isCurrentSession(session));
let vite:import('vite').ViteDevServer|undefined;
let origin='';
const watchers=new Set<()=>void>();
async function body(req:IncomingMessage) {
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of req) {size+=chunk.length;if(size>65536) throw Error('请求超过64KiB');chunks.push(chunk);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
const server=createServer(async(req,res)=>{
 if(production)res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'");
 const json=(status:number,value:unknown)=>{if(!res.destroyed&&!res.writableEnded) {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}};
 if(req.headers.host!==origin.slice(7) || (req.headers.origin!==undefined&&req.headers.origin!==origin) || req.headers['sec-fetch-site']==='cross-site') {json(403,{error:'来源拒绝'});return;}
 const pathname=new URL(req.url??'/',origin).pathname;
 if(pathname.startsWith('/api/')) {
  if(pathname==='/api/engine-capability'&&req.method==='GET') {json(200,{configured:!!(process.env.GO_COACH_CONFIG||process.env.GO_COACH_TEST_ENGINE)});return;}
  if(pathname==='/api/token'&&req.method==='GET') {json(200,{token});return;}
  if(!['/api/analyze','/api/review-evidence','/api/engine-session-watch'].includes(pathname)||req.method!=='POST') {json(404,{error:'不存在'});return;}
  if(req.headers.origin!==origin || req.headers['x-csrf-token']!==token || req.headers['content-type']!=='application/json') {json(403,{error:'需要同源 JSON 与 CSRF 令牌'});return;}
  try {
   if(pathname==='/api/engine-session-watch'){
    const value=await body(req);
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length)throw Error('观察请求必须为空对象');
    if(res.destroyed)return;
    if(watchers.size>=16){json(429,{error:'会话观察连接已满'});return;}
    res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    let unsubscribe=()=>{};
    const end=()=>{unsubscribe();watchers.delete(end);res.end();};
    watchers.add(end);res.once('close',end);
    unsubscribe=engine.observeSession(engineSession=>{
     if(!res.destroyed&&!res.writableEnded&&!res.write(JSON.stringify({engineSession})+'\n'))end();
    });
    if(res.destroyed||res.writableEnded){unsubscribe();watchers.delete(end);}
    return;
   }
   if(pathname==='/api/review-evidence'){json(200,evidence.buildReview(await body(req)));return;}
   const p=position(await body(req));
   if(res.destroyed) return;
   res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   const abort=new AbortController();
   const disconnect=()=>{if(!res.writableEnded) abort.abort();};
   res.once('close',disconnect);
   const send=(value:unknown)=>{if(!res.destroyed&&!res.writableEnded) res.write(JSON.stringify(value)+'\n');};
   try {
    const result=await engine.analyze(p,abort.signal,status=>send({status}));
    if(!abort.signal.aborted&&!res.destroyed)send({result:{...result,evidenceId:evidence.issue(p,result)}});
   }
   catch(e) {send({error:e instanceof Error?e.message:'分析失败'});}
   finally {res.removeListener('close',disconnect);res.end();}
  } catch(e) {json(e instanceof EvidenceExpired?410:400,{error:e instanceof Error?e.message:'输入无效'});}
  return;
 }
 if(req.method!=='GET'&&req.method!=='HEAD') {json(405,{error:'方法拒绝'});return;}
 if(vite) {
  // Vite transforms browser sources, but is not a general workspace file server.
  const browserFiles=['main.tsx','replay.ts','teaching.ts','TeachingPanel.tsx','variation.ts','variationAnalysis.ts','VariationPanel.tsx','engine.ts','EnginePanel.tsx','FullGameReview.tsx','ReviewEvidence.tsx','evidence.ts','analyze.ts','GoBoard.tsx','style.css'];
  const allowed=pathname==='/'||pathname==='/index.html'||pathname==='/@vite/client'||pathname==='/node_modules/vite/dist/client/env.mjs'||browserFiles.some(f=>pathname==='/src/'+f)||/^\/node_modules\/\.vite\/deps\/[a-zA-Z0-9_.-]+\.(js|map)$/.test(pathname)||/^\/analysis\/(?:variations\/corner-a\/)?[a-zA-Z0-9-]+\.json$/.test(pathname);
  if(!allowed) {json(404,{error:'不存在'});return;}
  vite.middlewares(req,res,()=>json(404,{error:'不存在'}));return;
 }
 try {
  const root=resolve(process.env.GO_COACH_STATIC_ROOT??'dist');const path=resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(root+sep)) throw Error('越界');
  const data=await readFile(path);
  const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'};
  res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 } catch {json(404,{error:'不存在'});}
});
server.on('upgrade',(req,socket)=>{
 if(req.headers.host!==origin.slice(7)||req.headers.origin!==origin) socket.destroy();
});
await new Promise<void>(resolve=>server.listen(port,'127.0.0.1',resolve));
const address=server.address();
if(!address||typeof address==='string')throw Error('监听失败');
origin=`http://127.0.0.1:${address.port}`;
if(!production) vite=await (await import('vite')).createServer({server:{middlewareMode:true,hmr:{server,host:'127.0.0.1',clientPort:address.port},fs:{strict:true}},appType:'spa'});
console.log('LISTENING '+origin);
let closing:Promise<void>|undefined;
export function close():Promise<void>{return closing??=(async()=>{evidence.clear();for(const end of watchers)end();server.close();server.closeAllConnections();await engine.close();await vite?.close();})();}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
// Parent test harness requests graceful shutdown via IPC, never an HTTP action.
process.on('message',m=>{if(m==='close') void close().then(()=>process.disconnect?.());});

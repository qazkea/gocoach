import {app, BrowserWindow, dialog, ipcMain, safeStorage, session} from 'electron';
import {open, mkdir, rename, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

const unavailable='密钥不可用，请重新配置';
const saved='本机已保存，尚未启用在线讲解';
const waiting='密钥操作尚未完成，请等待或重启应用';
const limit=16*1024;
function keyValue(value) {
 if(typeof value!=='string')return;
 const key=value.trim();
 if(/^[\x21-\x7e]{1,512}$/.test(key))return key;
}
// Main owns the entire credential lifetime. No key getter or utility capability.
export function createCredentials({parent, canOpen, changed}) {
 const directory=join(app.getPath('userData'),'go-coach');
 const file=join(directory,'credentials.json');
 const assets=join(app.getAppPath(),'desktop/credentials');
 const url=pathToFileURL(join(assets,'index.html')).href;
 const allowed=new Set(['index.html','form.js','style.css'].map(name=>pathToFileURL(join(assets,name)).href));
 const isolated=session.fromPartition('credentials-'+randomUUID());
 isolated.setSpellCheckerLanguages([]);
 isolated.setSpellCheckerEnabled(false);
 isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!allowed.has(details.url)}));
 isolated.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 isolated.setPermissionCheckHandler(()=>false);
 isolated.on('will-download',event=>event.preventDefault());
 let window, epoch=0, operation, closing=false, state='未配置';
 const notify=()=>changed();
 const active=()=>!!window&&!window.isDestroyed();
 const valid=op=>operation===op&&!op.invalid&&!closing&&op.epoch===epoch;
 const check=op=>{if(!valid(op))throw Error('invalid credential operation');};
 function cancel(op,result='cancelled') {
  if(!op||op.invalid)return;
  op.invalid=true;clearTimeout(op.timer);
  // Release a read-only restore handle without awaiting a stuck read/OS call.
  void op.closeRead?.();
  // A submitted filesystem mutation cannot be cancelled. Keep its exclusion lock
  // until its own finally settles, but never hold up main's engine shutdown.
  if(op.writing)state=waiting;
  else if(operation===op)operation=undefined;
  op.finish(result);notify();
 }
 const invalidate=()=>{epoch++;cancel(operation);const previous=window;window=undefined;if(previous&&!previous.isDestroyed())previous.destroy();notify();};
 function perform(work,waitingForConfirmation=false) {
  const op={epoch,invalid:false,writing:false};operation=op;
  const result=new Promise(resolve=>{op.finish=resolve;});
  op.startDeadline=()=>{op.timer=setTimeout(()=>{if(valid(op)){state=unavailable;cancel(op,'unavailable');}},10000);};
  if(!waitingForConfirmation)op.startDeadline();
  notify();
  void (async()=>{
   try {
    const next=await work(op);check(op);
    if(next)state=next;
    op.finish(next===saved?'saved':'cancelled');
   } catch {
    if(valid(op)){state=unavailable;op.finish('unavailable');}
   } finally {
    clearTimeout(op.timer);
    if(operation===op){operation=undefined;if(op.invalid&&op.writing)state=unavailable;notify();}
   }
  })();
  return result;
 }
 const authorized=event=>{
  try {return !closing&&active()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame?.url===url&&window.webContents.getURL()===url;}
  catch {return false;} // A disposed native frame is a denial, never a raw IPC error.
 };
 const available=async()=>process.platform==='win32'&&await safeStorage.isAsyncEncryptionAvailable();
 async function encrypted(key,op) {
  if(!await available())throw Error();check(op);
  const cipher=await safeStorage.encryptStringAsync(key);check(op);
  if(!Buffer.isBuffer(cipher)||!cipher.length)throw Error();
  const decoded=await safeStorage.decryptStringAsync(cipher);check(op);
  // A migration request is deliberately disabled, not retried in a decrypt loop.
  if(decoded.result!==key||decoded.shouldReEncrypt!==false)throw Error();
  const record=JSON.stringify({version:1,ciphertext:cipher.toString('base64')});
  if(Buffer.byteLength(record)>limit)throw Error();
  return record;
 }
 async function persist(record,op) {
  check(op);op.writing=true;
  await mkdir(directory,{recursive:true});check(op);
  const temporary=join(directory,'credentials-'+randomUUID()+'.tmp');
  let handle;
  try {
   handle=await open(temporary,'wx',0o600);check(op);
   await handle.writeFile(record,'utf8');check(op);
   await handle.sync();check(op);
   await handle.close();handle=undefined;check(op);
   // After dispatch, rename may commit even if cancellation/timeout wins.
   await rename(temporary,file);check(op);
  } finally {
   await handle?.close().catch(()=>{});
   await unlink(temporary).catch(()=>{});
  }
 }
 async function restore() {return perform(async op=>{
  let handle;
  try {
   if(!await available())throw Error();check(op);
   try {handle=await open(file,'r');}catch(error){if(error.code==='ENOENT')return;throw error;}
   op.closeRead=()=>handle?.close().catch(()=>{});check(op);
   const info=await handle.stat();check(op);if(info.size>limit)throw Error();
   const buffer=Buffer.alloc(limit+1);let count=0;
   while(count<buffer.length){const {bytesRead}=await handle.read(buffer,count,buffer.length-count,null);check(op);if(!bytesRead)break;count+=bytesRead;}
   if(count>limit)throw Error();
   await handle.close();handle=undefined;check(op);
   const record=JSON.parse(buffer.subarray(0,count).toString('utf8'));
   if(!record||Array.isArray(record)||Object.keys(record).sort().join(',')!=='ciphertext,version'||record.version!==1||typeof record.ciphertext!=='string'||!record.ciphertext.length)throw Error();
   const cipher=Buffer.from(record.ciphertext,'base64');
   if(cipher.toString('base64')!==record.ciphertext)throw Error();
   const decoded=await safeStorage.decryptStringAsync(cipher);check(op);
   if(!keyValue(decoded.result)||decoded.result!==keyValue(decoded.result)||decoded.shouldReEncrypt!==false)throw Error();
   return saved;
  } finally {await handle?.close().catch(()=>{});}
 });}
 ipcMain.handle('credentials:submit',async(event,value)=>{
  if(!authorized(event))return 'denied';
  if(operation)return 'busy';
  let key=keyValue(value);value=undefined;
  if(!key)return 'invalid';
  const captured=epoch;
  const result=await perform(async op=>{
   try {
    const record=await encrypted(key,op);key=undefined;check(op);
    await persist(record,op);check(op);
    return saved;
   } finally {key=undefined;}
  });
  if(result==='saved'&&captured===epoch&&!closing)invalidate();
  return result;
 });
 ipcMain.handle('credentials:cancel',event=>{if(!authorized(event))return 'denied';invalidate();return 'cancelled';});
 function show() {
  if(closing||!canOpen())return;
  if(active()){window.focus();return;}
  if(operation)return;
  epoch++;
  window=new BrowserWindow({width:540,height:400,resizable:false,parent:parent(),title:'配置 DeepSeek Key',webPreferences:{session:isolated,preload:join(assets,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,spellcheck:false}});
  const current=window, contents=current.webContents;
  current.setMenu(null);
  current.on('closed',()=>{if(window===current)invalidate();});
  for(const name of ['will-navigate','will-redirect','will-frame-navigate'])contents.on(name,event=>event.preventDefault());
  contents.on('will-attach-webview',event=>event.preventDefault());
  contents.setWindowOpenHandler(()=>({action:'deny'}));
  contents.on('did-start-navigation',(_event,target,_inPlace,isMainFrame)=>{if(isMainFrame&&target!==url&&window===current)invalidate();});
  void current.loadURL(url).catch(()=>{if(window===current){state=unavailable;invalidate();}});
  notify();
 }
 async function remove() {
  if(closing||operation||active()||!canOpen())return;
  await perform(async op=>{
   const answer=await dialog.showMessageBox(parent(),{type:'warning',title:'删除已保存Key',message:'仅删除本机凭据，不删除授权历史、预算账本或未知费用。',buttons:['取消','删除'],defaultId:0,cancelId:0,noLink:true});
   check(op);if(answer.response!==1)return;
   op.startDeadline();op.writing=true;
   try {await unlink(file);}catch(error){if(error.code!=='ENOENT')throw error;}
   check(op);return '未配置';
  },true);
 }
 return {
  restore,show,remove,
  get engaged(){return active()||!!operation;},
  get label(){return state;},
  get items(){return [{label:state,enabled:false},{label:'配置 DeepSeek Key…',enabled:!closing&&!operation&&canOpen(),click:show},{label:'删除已保存Key…',enabled:!closing&&!operation&&!active()&&canOpen(),click:remove}];},
  suspend(){closing=true;invalidate();},
  resume(){closing=false;notify();}
 };
}

import {app, BrowserWindow, dialog, ipcMain, safeStorage, session} from 'electron';
import {open, mkdir, rename, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

const unavailable='密钥不可用，请重新配置';
const saved='本机已保存，尚未启用在线讲解';
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
 let window, epoch=0, busy=false, closing=false, pending=Promise.resolve(), state='未配置';
 const notify=()=>changed();
 const active=()=>!!window&&!window.isDestroyed();
 const invalidate=()=>{epoch++;if(active())window.destroy();window=undefined;notify();};
 const authorized=event=>{
  try {return !closing&&active()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame?.url===url&&window.webContents.getURL()===url;}
  catch {return false;} // A disposed native frame is a denial, never a raw IPC error.
 };
 const available=async()=>process.platform==='win32'&&await safeStorage.isAsyncEncryptionAvailable();
 async function encrypted(key) {
  if(!await available())throw Error();
  const cipher=await safeStorage.encryptStringAsync(key);
  if(!Buffer.isBuffer(cipher)||!cipher.length)throw Error();
  const decoded=await safeStorage.decryptStringAsync(cipher);
  // A migration request is deliberately disabled, not retried in a decrypt loop.
  if(decoded.result!==key||decoded.shouldReEncrypt!==false)throw Error();
  const record=JSON.stringify({version:1,ciphertext:cipher.toString('base64')});
  if(Buffer.byteLength(record)>limit)throw Error();
  return record;
 }
 async function persist(record) {
  await mkdir(directory,{recursive:true});
  const temporary=join(directory,'credentials-'+randomUUID()+'.tmp');
  let handle;
  try {
   handle=await open(temporary,'wx',0o600);
   await handle.writeFile(record,'utf8');await handle.sync();await handle.close();handle=undefined;
   await rename(temporary,file);
  } finally {
   await handle?.close().catch(()=>{});
   await unlink(temporary).catch(()=>{});
  }
 }
 async function restore() {
  let handle;
  try {
   if(!await available())throw Error();
   try {handle=await open(file,'r');}catch(error){if(error.code==='ENOENT')return;throw error;}
   if((await handle.stat()).size>limit)throw Error();
   const buffer=Buffer.alloc(limit+1);let count=0;
   while(count<buffer.length){const {bytesRead}=await handle.read(buffer,count,buffer.length-count,null);if(!bytesRead)break;count+=bytesRead;}
   if(count>limit)throw Error();
   const record=JSON.parse(buffer.subarray(0,count).toString('utf8'));
   if(!record||Array.isArray(record)||Object.keys(record).sort().join(',')!=='ciphertext,version'||record.version!==1||typeof record.ciphertext!=='string'||!record.ciphertext.length)throw Error();
   const cipher=Buffer.from(record.ciphertext,'base64');
   if(cipher.toString('base64')!==record.ciphertext)throw Error();
   const decoded=await safeStorage.decryptStringAsync(cipher);
   if(!keyValue(decoded.result)||decoded.result!==keyValue(decoded.result)||decoded.shouldReEncrypt!==false)throw Error();
   state=saved;
  } catch {state=unavailable;}
  finally {await handle?.close().catch(()=>{});notify();}
 }
 ipcMain.handle('credentials:submit',async(event,value)=>{
  if(!authorized(event))return 'denied';
  if(busy)return 'busy';
  let key=keyValue(value);value=undefined;
  if(!key)return 'invalid';
  const captured=epoch;busy=true;notify();
  pending=(async()=>{
   try {
    const record=await encrypted(key);key=undefined;
    if(closing||captured!==epoch||!active())return 'cancelled';
    // Once persistence starts it may finish; quit waits for this bounded operation.
    await persist(record);state=saved;
    if(closing||captured!==epoch||!active())return 'cancelled';
    return 'saved';
   } catch {state=unavailable;return 'unavailable';}
   finally {key=undefined;busy=false;notify();}
  })();
  const result=await pending;
  if(result==='saved')invalidate();
  return result;
 });
 ipcMain.handle('credentials:cancel',event=>{if(!authorized(event))return 'denied';invalidate();return 'cancelled';});
 function show() {
  if(closing||!canOpen())return;
  if(active()){window.focus();return;}
  if(busy)return;
  epoch++;
  window=new BrowserWindow({width:540,height:400,resizable:false,parent:parent(),title:'配置 DeepSeek Key',webPreferences:{session:isolated,preload:join(assets,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,spellcheck:false}});
  const current=window, contents=current.webContents;
  current.setMenu(null);
  current.on('closed',()=>{if(window===current){epoch++;window=undefined;notify();}});
  for(const name of ['will-navigate','will-redirect','will-frame-navigate'])contents.on(name,event=>event.preventDefault());
  contents.on('will-attach-webview',event=>event.preventDefault());
  contents.setWindowOpenHandler(()=>({action:'deny'}));
  contents.on('did-start-navigation',(_event,target,_inPlace,isMainFrame)=>{if(isMainFrame&&target!==url&&window===current)invalidate();});
  void current.loadURL(url).catch(()=>{if(window===current){state=unavailable;invalidate();}});
  notify();
 }
 async function remove() {
  if(closing||busy||active()||!canOpen())return;
  busy=true;notify();
  pending=(async()=>{
   try {
    const answer=await dialog.showMessageBox(parent(),{type:'warning',title:'删除已保存Key',message:'仅删除本机凭据，不删除授权历史、预算账本或未知费用。',buttons:['取消','删除'],defaultId:0,cancelId:0,noLink:true});
    if(answer.response!==1||closing)return;
    try {await unlink(file);}catch(error){if(error.code!=='ENOENT')throw error;}
    state='未配置';
   } catch {state=unavailable;}
   finally {busy=false;notify();}
  })();
  await pending;
 }
 return {
  restore,show,remove,
  get engaged(){return active()||busy;},
  get label(){return state;},
  get items(){return [{label:state,enabled:false},{label:'配置 DeepSeek Key…',enabled:!closing&&!busy&&canOpen(),click:show},{label:'删除已保存Key…',enabled:!closing&&!busy&&!active()&&canOpen(),click:remove}];},
  async suspend(){closing=true;invalidate();await pending;},
  resume(){closing=false;notify();}
 };
}

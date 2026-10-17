import {app, BrowserWindow, Menu, dialog, utilityProcess} from 'electron';
import {join} from 'node:path';
import {readOperator,prepareOperator,restoreOperator,rememberOperator} from './config.mjs';
let child, window, origin='', approved, notice='', selecting=false, exiting=false, quitting;
let exited=Promise.resolve();
async function stop() {
 if(!child)return;
 child.postMessage('close');
 let timer;
 try {await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('本地服务关闭超过10秒，无法确认引擎已回收')),10000);})]);}
 finally {clearTimeout(timer);}
 child=undefined;
}
async function quit() {
 if(quitting)return quitting;
 quitting=(async()=>{
  try {await stop();exiting=true;app.quit();}
  catch(error){dialog.showErrorBox('退出失败',error.message);quitting=undefined;}
 })();
 return quitting;
}
app.on('before-quit',event=>{if(!exiting){event.preventDefault();void quit();}});
app.on('window-all-closed',()=>void quit());

async function choose() {
 if(selecting||quitting)return;
 selecting=true;
 try {
  const selected=await dialog.showOpenDialog(window,{title:'选择已有本地引擎配置',filters:[{name:'JSON 配置',extensions:['json']}],properties:['openFile']});
  if(selected.canceled||selected.filePaths.length!==1)return;
  const candidate=await readOperator(selected.filePaths[0]);
  const confirmation=await dialog.showMessageBox(window,{type:'warning',title:'允许运行本地引擎？',message:'只信任你了解来源的本地配置',detail:`将运行：${candidate.config.executable}\n模型：${candidate.config.model}\n更换配置会停止自有引擎、重启本地服务并清空当前复盘。原配置不修改。`,buttons:['取消','信任并使用'],defaultId:0,cancelId:0,noLink:true});
  if(confirmation.response!==1||quitting)return;
  const runtime=await prepareOperator(candidate,app.getPath('userData'));
  await stop();
  if(quitting)return;
  await start(runtime);
  approved=candidate;notice='';
  menu();
  await rememberOperator(candidate,app.getPath('userData'));
 } catch(error){if(!quitting)dialog.showErrorBox('本地配置未启用',error.message);}
 finally {selecting=false;}
}
function menu() {
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'引擎',submenu:[{label:notice||(approved?'已配置本地引擎':'未配置本地引擎（仍可回放）'),enabled:false},{label:'选择本地配置…',click:()=>choose()}]},
  {label:'文件',submenu:[{label:'退出',click:()=>quit()}]}
 ]));
}
function createWindow() {
 window=new BrowserWindow({width:1280,height:900,title:'围棋赛后复盘教练',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 window.on('close',event=>{if(!exiting){event.preventDefault();void quit();}});
 const contents=window.webContents;
 const permitted=url=>{try{return !!origin&&new URL(url).origin===origin;}catch{return false;}};
 contents.on('will-navigate',(event,url)=>{if(!permitted(url))event.preventDefault();});
 contents.on('will-redirect',(event,url)=>{if(!permitted(url))event.preventDefault();});
 contents.on('will-frame-navigate',event=>{if(!permitted(event.url))event.preventDefault();});
 contents.setWindowOpenHandler(()=>({action:'deny'}));
 contents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 contents.session.setPermissionCheckHandler(()=>false);
 contents.session.on('will-download',event=>event.preventDefault());
}
async function start(config='') {
 if(quitting)return;
 const root=app.getAppPath();
 const owned=utilityProcess.fork(join(root,'desktop/bootstrap.mjs'),['--production','--port','0'],{
  cwd:app.getPath('userData'),stdio:'pipe',env:{...process.env,GO_COACH_CONFIG:config,GO_COACH_TEST_ENGINE:'',GO_COACH_STATIC_ROOT:join(root,'dist')}
 });
 child=owned;
 exited=new Promise(resolve=>owned.once('exit',code=>{resolve();if(!quitting&&code!==0)dialog.showErrorBox('本地服务退出','本地服务异常退出，请退出后重新启动。');}));
 const address=await new Promise((resolve,reject)=>{
  let buffer='',settled=false;
  const clean=()=>{clearTimeout(timer);owned.stdout.removeListener('data',data);owned.removeListener('exit',exit);};
  const finish=(error,value)=>{if(settled)return;settled=true;clean();error?reject(error):resolve(value);};
  const exit=()=>finish(Error('本地服务启动失败'));
  const data=chunk=>{
   buffer=(buffer+chunk).slice(-8192);
   const lines=buffer.split(/\r?\n/);buffer=lines.pop();
   for(const line of lines) {
    const match=/^LISTENING (http:\/\/127\.0\.0\.1:([0-9]{1,5}))$/.exec(line);
    if(match&&Number(match[2])>0&&Number(match[2])<=65535)finish(undefined,match[1]);
   }
  };
  const timer=setTimeout(()=>finish(Error('本地服务启动超过15秒')),15000);
  owned.once('exit',exit);
  owned.stderr.on('data',data=>process.stderr.write(data));
  owned.stdout.on('data',data);
 });
 if(quitting)return;
 origin=address;
 if(!window)createWindow();
 menu();
 await window.loadURL(origin);
}
app.whenReady().then(async()=>{
 const restored=await restoreOperator(app.getPath('userData'));
 approved=restored.approved;notice=restored.notice??'';
 await start(approved?await prepareOperator(approved,app.getPath('userData')):'');
}).catch(error=>{if(!quitting)dialog.showErrorBox('启动失败',error.message);void quit();});

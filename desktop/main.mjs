import {app, BrowserWindow, Menu, dialog, utilityProcess} from 'electron';
import {join} from 'node:path';
let child, window, exiting=false, quitting;
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
async function start() {
 const root=app.getAppPath();
 child=utilityProcess.fork(join(root,'desktop/bootstrap.mjs'),['--production','--port','0'],{
  cwd:app.getPath('userData'),stdio:'pipe',env:{...process.env,GO_COACH_CONFIG:'',GO_COACH_TEST_ENGINE:'',GO_COACH_STATIC_ROOT:join(root,'dist')}
 });
 const owned=child;
 exited=new Promise(resolve=>owned.once('exit',code=>{resolve();if(!quitting&&code!==0)dialog.showErrorBox('本地服务退出','本地服务异常退出，请退出后重新启动。');}));
 const origin=await new Promise((resolve,reject)=>{
  let buffer='';const timer=setTimeout(()=>reject(Error('本地服务启动超过15秒')),15000);
  owned.once('exit',()=>{clearTimeout(timer);reject(Error('本地服务启动失败'));});
  owned.stderr.on('data',data=>process.stderr.write(data));
  owned.stdout.on('data',data=>{
   process.stdout.write(data);buffer=(buffer+data).slice(-8192);
   for(const line of buffer.split(/\r?\n/)) {
    const match=/^LISTENING (http:\/\/127\.0\.0\.1:([0-9]{1,5}))$/.exec(line);
    if(match&&Number(match[2])>0&&Number(match[2])<=65535){clearTimeout(timer);resolve(match[1]);}
   }
  });
 });
 if(quitting)return;
 window=new BrowserWindow({width:1280,height:900,title:'围棋赛后复盘教练',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 window.on('close',event=>{if(!exiting){event.preventDefault();void quit();}});
 const contents=window.webContents;
 const permitted=url=>{try{return new URL(url).origin===origin;}catch{return false;}};
 contents.on('will-navigate',(event,url)=>{if(!permitted(url))event.preventDefault();});
 contents.on('will-redirect',(event,url)=>{if(!permitted(url))event.preventDefault();});
 contents.setWindowOpenHandler(()=>({action:'deny'}));
 contents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 contents.session.setPermissionCheckHandler(()=>false);
 contents.session.on('will-download',event=>event.preventDefault());
 Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'引擎',submenu:[{label:'未配置本地引擎（仍可回放）',enabled:false}]},{label:'文件',submenu:[{label:'退出',click:()=>void quit()}]}]));
 await window.loadURL(origin);
}
app.whenReady().then(start).catch(error=>{dialog.showErrorBox('启动失败',error.message);void quit();});

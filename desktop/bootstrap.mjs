// Register before import: closing during bridge startup must not lose the request.
let requested=false;
let bridge;
let stopping;
function close() {
 requested=true;
 if(!bridge || stopping)return;
 stopping=bridge.close().then(()=>process.exit(0),error=>{
  console.error('桥关闭失败',error);process.exitCode=1;
  process.parentPort.postMessage({error:'本地引擎未能确认退出'});
 });
}
process.parentPort.on('message',event=>{if(event.data==='close')close();});
try {bridge=await import('../.server/index.js');if(requested)close();}
catch(error){console.error(error);process.exit(1);}

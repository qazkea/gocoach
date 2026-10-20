// External platform completion gates only; no product state access.
import {safeStorage} from 'electron';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
const mode=process.argv.find(a=>a.startsWith('--credential-delay='))?.split('=')[1];
for(const [name,method] of [['available','isAsyncEncryptionAvailable'],['decrypt','decryptStringAsync']])if(mode===name){
 const original=safeStorage[method].bind(safeStorage);let first=true;
 safeStorage[method]=async(...args)=>{if(first){first=false;while(true){try{await fs.access(process.argv.find(a=>a.startsWith('--release=')).slice(10));break;}catch{await new Promise(r=>setTimeout(r,25));}}if(process.argv.includes('--fail'))throw Error('external OS failure');}return original(...args);};
}
if(['writeFile','sync','rename','read'].includes(mode)) {
 const original=fs.open.bind(fs),rename=fs.rename.bind(fs);
 const gate=async()=>{while(true){try {await fs.access(process.argv.find(a=>a.startsWith('--release=' )).slice(10));break;}catch {await new Promise(r=>setTimeout(r,25));}};if(process.argv.includes('--fail'))throw Error('external IO failure');};
 const mark=()=>fs.writeFile(process.argv.find(a=>a.startsWith('--reached=')).slice(10),'reached');
 fs.open=async(...args)=>{const handle=await original(...args);if(String(args[0]).includes('credentials-')&&String(args[0]).endsWith('.tmp')&&['writeFile','sync'].includes(mode)||String(args[0]).endsWith('credentials.json')&&mode==='read') {const method=handle[mode].bind(handle);handle[mode]=async(...values)=>{await mark();await gate();return method(...values);};}return handle;};
 fs.rename=async(...args)=>{if(mode==='rename'&&/credentials-[^/\\]+\.tmp$/.test(String(args[0]))){await mark();await gate();}return rename(...args);};
 syncBuiltinESMExports();
}
await import('./credentials-platform.mjs');

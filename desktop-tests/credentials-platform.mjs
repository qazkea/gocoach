// External observation-only Electron utility boundary. Never included in product files.
import {utilityProcess} from 'electron';
import {appendFileSync} from 'node:fs';
const output=process.argv.find(arg=>arg.startsWith('--credential-observe=')).slice('--credential-observe='.length);
const record=event=>appendFileSync(output,JSON.stringify(event)+'\n');
const fork=utilityProcess.fork.bind(utilityProcess);
utilityProcess.fork=(modulePath,args,options)=>{
 record({direction:'fork',args});
 const child=fork(modulePath,args,options),post=child.postMessage.bind(child);
 child.postMessage=(message,...rest)=>{record({direction:'to-utility',message});return post(message,...rest);};
 child.on('message',message=>record({direction:'from-utility',message}));
 return child;
};
await import('./main.mjs');

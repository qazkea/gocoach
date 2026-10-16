// Platform fault injection only: replace the fixture's executable, never product HTTP.
import cp from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';
const fork=cp.fork;
cp.fork=function(path,args,options){
 if(String(path).endsWith('index.js')&&['nofork','spawn-error'].includes(process.env.FIXTURE_FAILURE)){
  writeFileSync(process.env.FIXTURE_RECORD,JSON.stringify({pid:null,dir:dirname(options.env.ENGINE_OBSERVE)}));
  if(process.env.FIXTURE_FAILURE==='nofork')throw Error('deliberate synchronous fork failure');
  return fork(path,args,{...options,execPath:'Z:/does-not-exist/node.exe'});
 }
 return fork(String(path).endsWith('index.js')?fileURLToPath(new URL('./delayed-server.mjs',import.meta.url)):path,args,options);
};
syncBuiltinESMExports();

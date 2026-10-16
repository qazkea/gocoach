import {writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
writeFileSync(process.env.FIXTURE_RECORD,JSON.stringify({pid:process.pid,dir:dirname(process.env.ENGINE_OBSERVE)}));
if(process.env.FIXTURE_FAILURE==='exit')process.exit(1);
if(process.env.FIXTURE_FAILURE==='disconnect')process.disconnect();
process.on('message',m=>{if(m==='close')process.exit(0);});
setInterval(()=>{},1000);

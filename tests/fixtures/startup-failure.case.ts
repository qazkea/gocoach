import {test} from '../engine-fixture';
test('expected startup failure',async({engineServer})=>{throw Error('must not reach use: '+engineServer.url);});

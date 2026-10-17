import readline from 'node:readline';
import {appendFileSync,existsSync,writeFileSync,closeSync} from 'node:fs';
const scenario=process.env.ENGINE_SCENARIO;
if(process.env.ENGINE_OBSERVE)appendFileSync(process.env.ENGINE_OBSERVE+'.pids',process.pid+'\n');
if(scenario==='slow-version'&&process.argv[2]==='version') {
 appendFileSync(process.env.ENGINE_OBSERVE,JSON.stringify({action:'version-held-open',pid:process.pid})+'\n');
 await new Promise(()=>setInterval(()=>{},1000)); // Deliberately never claims a valid KataGo version.
}
const send=v=>process.stdout.write(JSON.stringify(v)+'\n');
const timers=new Set();
const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);};
later(()=>process.stderr.write('Started, ready to begin handling requests\n'),scenario==='loading'?800:0);
let count=0, broken=false;
readline.createInterface({input:process.stdin}).on('line',line=>{
 const q=JSON.parse(line);
 if(process.env.ENGINE_OBSERVE) appendFileSync(process.env.ENGINE_OBSERVE,line+'\n');
 if(q.action==='terminate'&&scenario==='noAck') {send({id:q.terminateId,isDuringSearch:false,noResults:true});return;}
 if(q.action==='terminate') {send(q);if(scenario!=='late'&&scenario!=='late-error'&&scenario!=='busy'&&scenario!=='warning-late'&&scenario!=='warning'&&scenario!=='waiting') send({id:q.terminateId,isDuringSearch:false,noResults:true});return;}
 if(broken){process.stderr.write('error: deliberate fatal failure\n');return;}
 const number=++count;
 if((scenario==='broken-input'||scenario==='uncooperative')&&!existsSync(process.env.ENGINE_OBSERVE+'.broken')) {
  writeFileSync(process.env.ENGINE_OBSERVE+'.broken','1');
  // POSIX adapter; Windows uses windows-broken-input.cs to close the actual
  // inherited handle without Node retaining another read endpoint.
  if(scenario==='broken-input'){process.stdin._handle.close();closeSync(0);}
  setInterval(()=>{},1000); // Deliberately survive EOF; only our owner may reap us.
  appendFileSync(process.env.ENGINE_OBSERVE,JSON.stringify({action:'held-open',pid:process.pid})+'\n');
  send({id:q.id,isDuringSearch:false,noResults:true});
  broken=true;
  return;
 }
 if(((scenario==='review-restart'&&q.moves.length===1)||scenario==='crash')&&!existsSync(process.env.ENGINE_OBSERVE+'.crashed')) {writeFileSync(process.env.ENGINE_OBSERVE+'.crashed','1');process.exit(1);}
 const currentPlayer=q.moves.length%2 ? (q.initialPlayer==='B'?'W':'B') : q.initialPlayer;
 const used=[...q.initialStones,...q.moves].map(x=>x[1]);
 const move=['D16','Q4','D4','Q16','pass'].find(x=>!used.includes(x))??'pass';
 const rootInfo={currentPlayer,visits:101,winrate:0.6,scoreLead:2.5};
 if(scenario==='review-values')Object.assign(rootInfo,[{winrate:0.60,scoreLead:2.5},{winrate:0.45,scoreLead:-1.5},{winrate:0.30,scoreLead:-5.5}][q.moves.length]??{winrate:0.30,scoreLead:-5.5});
 const candidate={move,visits:100,winrate:0.6,scoreLead:2.5,pv:[move,'pass']};
 const reply={id:q.id,turnNumber:q.moves.length,isDuringSearch:false,rootInfo,moveInfos:[candidate]};
 if(scenario==='ko'){candidate.move='H12';candidate.pv=['H12','pass'];}
 if(scenario==='missingPV')delete candidate.pv;
 if(scenario==='invalidPV')candidate.pv=[move,move];
 if(scenario==='invalidMove')candidate.move='I19';
 if(scenario==='invalidNumber')candidate.winrate=1.2;
 if(scenario==='wrongTurn')reply.turnNumber++;
 if(scenario==='wrongPlayer')rootInfo.currentPlayer=currentPlayer==='B'?'W':'B';
 if(scenario==='wrongId')reply.id='unknown-id';
 if(scenario==='wrongAck'){send({id:'unknown-ack',action:'terminate',terminateId:q.id});return;}
 if(scenario==='review-retry'&&q.moves.length===1&&!existsSync(process.env.ENGINE_OBSERVE+'.failed')) {
  writeFileSync(process.env.ENGINE_OBSERVE+'.failed','1');send({id:q.id,isDuringSearch:false,noResults:true});return;
 }
 if(scenario==='noResults') {send({id:q.id,isDuringSearch:false,noResults:true,turnNumber:q.moves.length});return;}
 if(scenario==='warning-late') {
  if(number===1){send({id:q.id,warning:'converted rules'});later(()=>send(reply),700);}else later(()=>send(reply),1000);
  return;
 }
 if(scenario==='warning') {send({id:q.id,warning:'unknown field'});later(()=>send(reply),100);return;}
 if(scenario==='duplicate')reply.moveInfos.push({...candidate});
 if(scenario==='oversized') {process.stdout.write('x'.repeat(2*1024*1024+1)+'\n');return;}
 if(scenario==='many')reply.moveInfos=Array(363).fill(candidate);
 if(scenario==='review-candidates')reply.moveInfos=['A19','B19','C19','D19','E19','F19','G19','H19','J19','K19','L19','M19'].map(move=>({move,visits:10,winrate:0.5,scoreLead:0}));
 // Hand-worked empty-board sequence: distinct points; K/L chains retain outside liberties.
 // v1.18.1 analysisPVLen excludes the first move (searchresults.cpp appendPVForMove).
 if(scenario==='pv16'||scenario==='longPV')candidate.pv=['D16','Q4','D4','Q16','K10','L10','K11','L11','K12','L12','K13','L13','K14','L14','K15','L15',...(scenario==='longPV'?['K16']:[])];
 if(scenario==='busy'||scenario==='noAck')return;
 if((scenario==='late'||scenario==='late-error')&&number===1) {later(()=>send(scenario==='late-error'?{id:q.id,error:'old failure'}:reply),1000);return;}
 later(()=>send(reply),scenario==='waiting'||scenario==='review-restart'?800:0);
}).on('close',()=>{for(const t of timers)clearTimeout(t);});

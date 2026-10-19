import {randomBytes} from 'node:crypto';
import {engineInput,sgfPoint,type EngineInput,type EngineResult} from '../src/engine';
import {groupAt} from '../src/replay';
import type {EvidenceAnalysis,ReviewEvidence} from '../src/evidence';
import {position,type Position} from './position';
const expired='讲解依据已过期，请重新导入棋谱分析';
export class EvidenceExpired extends Error {constructor(){super(expired);}}
type Payload={input:EngineInput;analysis:EvidenceAnalysis};
type Entry={payload:string;bytes:number;issued:number;session:string};
const identity=(input:EngineInput)=>JSON.stringify(input);
function conditions(a:EvidenceAnalysis) {
 return JSON.stringify([a.engineSession,a.engine,a.model,a.profile,a.komi,a.bonus,a.budget]);
}
// Retain only canonical input and bounded analysis, never the quadratic replay frames.
// The byte ceiling measures serialized UTF-8 payload, not total JavaScript heap/RSS.
export class Evidence {
 private entries=new Map<string,Entry>();
 private bytes=0;
 constructor(private readonly current:(session:string)=>boolean) {}
 clear(){this.entries.clear();this.bytes=0;}
 private remove(id:string){const e=this.entries.get(id);if(e){this.bytes-=e.bytes;this.entries.delete(id);}}
 private prune(){
  const now=performance.now();
  for(const [id,e] of this.entries)if(now-e.issued>=2*60*60*1000||!this.current(e.session))this.remove(id);
 }
 issue(p:Position,result:EngineResult):string {
  this.prune();
  if(!this.current(result.engineSession))throw new EvidenceExpired();
  const analysis:EvidenceAnalysis={...result,candidates:result.candidates.slice(0,10),candidateCount:result.candidates.length,budget:{version:1,maxVisits:100,maxTime:2}};
  const payload=JSON.stringify({input:engineInput(p.replay,p.input.moves.length),analysis} satisfies Payload);
  const bytes=Buffer.byteLength(payload);
  if(bytes>64*1024*1024)throw Error('单条讲解依据超过容量');
  while(this.entries.size>=2000||this.bytes+bytes>64*1024*1024)this.remove(this.entries.keys().next().value!);
  const id=randomBytes(32).toString('hex');
  this.entries.set(id,{payload,bytes,issued:performance.now(),session:result.engineSession});this.bytes+=bytes;
  return id;
 }
 private get(id:unknown):Payload {
  if(id===undefined)throw new EvidenceExpired();
  if(typeof id!=='string'||!/^[0-9a-f]{64}$/.test(id))throw Error('依据引用格式无效');
  const e=this.entries.get(id);if(!e)throw new EvidenceExpired();
  this.entries.delete(id);this.entries.set(id,e);
  return JSON.parse(e.payload) as Payload;
 }
 buildReview(value:unknown):ReviewEvidence {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('输入必须为对象');
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(k=>!['position','afterId','beforeId'].includes(k)))throw Error('未知字段');
  const p=position(v.position),input=engineInput(p.replay,p.input.moves.length);
  this.prune();
  const after=this.get(v.afterId);
  if(identity(input)!==identity(after.input))throw Error('期望局面与依据不匹配');
  const step=input.moves.length;
  let before:Payload|undefined;
  if(step===0){if(v.beforeId!==undefined)throw Error('初盘不得含上一手依据');}
  else{
   before=this.get(v.beforeId);
   if(identity(before.input)!==identity({...input,moves:input.moves.slice(0,-1)})||conditions(before.analysis)!==conditions(after.analysis))throw Error('前后依据历史或分析条件不匹配');
  }
  const frame=p.replay.frames[step];
  const move=input.moves.at(-1);
  const actual=move?{color:move[0],move:move[1],
   captured:p.replay.frames[step-1].board.flatMap((s,i)=>s&&s!==move[0]&&!frame.board[i]?[sgfPoint(i)]:[]),
   liberties:move[1]==='pass'?null:groupAt(frame,move[1]).liberties}:null;
  const sign=move?.[0]==='B'?1:-1;
  return {version:1,limitations:['引擎估值固定 BLACK 视角；100 visits / 2秒低预算会波动。','估值不是原因，PV不是必然结局。','无ownership；气数不是活棋证明。'],step,nextPlayer:frame.nextPlayer,initialStones:input.initialStones.length,actual,before:before?.analysis??null,after:after.analysis,
   decline:before?{winratePoints:sign*(before.analysis.root.winrate-after.analysis.root.winrate)*100,scoreLead:sign*(before.analysis.root.scoreLead-after.analysis.root.scoreLead)}:null};
 }
}

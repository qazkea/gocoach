import {importReplay, tryMove, type Replay} from '../src/replay';
import {gtp, sgf, type EngineInput, type EngineResult, type Estimate} from '../src/engine';
function object(value:unknown):Record<string,unknown> {
 if(!value || typeof value !== 'object' || Array.isArray(value)) throw Error('输入必须为对象');
 return value as Record<string,unknown>;
}
export function position(value:unknown) {
 const v=object(value);
 if(Object.keys(v).some(k=>!['initialStones','initialPlayer','RU','KM','HA','moves'].includes(k))) throw Error('未知字段');
 if(!['Chinese','Japanese'].includes(v.RU as string)) throw Error('不支持的规则');
 if(typeof v.KM !== 'number' || !Number.isFinite(v.KM) || Math.abs(v.KM)>400 || !Number.isInteger(v.KM*2)) throw Error('KM 必须为 [-400,400] 半整数');
 if(v.initialPlayer !== 'B' && v.initialPlayer !== 'W') throw Error('初始轮次无效');
 if(!Array.isArray(v.initialStones) || v.initialStones.length>361 || !Array.isArray(v.moves) || v.moves.length>1999) throw Error('最多2000帧或初盘超限');
 for(const [list,pass] of [[v.initialStones,false],[v.moves,true]] as const) {
  for(const pair of list) if(!Array.isArray(pair) || pair.length!==2 || !['B','W'].includes(pair[0]) || typeof pair[1]!=='string' || !(/^[a-s]{2}$/.test(pair[1]) || pass && pair[1]==='pass')) throw Error('落子结构或坐标无效');
 }
 if(v.HA !== undefined && (typeof v.HA !== 'number' || !Number.isInteger(v.HA) || v.HA<0 || v.HA===1 || v.HA>361)) throw Error('HA 无效');
 const input=v as unknown as EngineInput;
 if(input.HA===undefined && input.initialStones.length) throw Error('初盘非空但 HA 未记录，不能猜测让子补偿；仍可回放');
 if((input.HA??0)>=2 && (input.initialStones.length!==input.HA || input.initialStones.some(s=>s[0]!=='B') || input.initialPlayer!=='W')) throw Error('HA 与纯黑初盘数量或白先矛盾');
 const setups=['B','W'].map(c=>{const points=input.initialStones.filter(s=>s[0]===c); return points.length ? 'A'+c+points.map(s=>'['+s[1]+']').join('') : '';}).join('');
 const text=`(;FF[4]RU[${input.RU}]KM[${input.KM}]${input.HA===undefined?'':`HA[${input.HA}]`}PL[${input.initialPlayer}]${setups}${input.moves.map(([c,p])=>`;${c}[${p==='pass'?'':p}]`).join('')})`;
 const replay=importReplay(new TextEncoder().encode(text).buffer);
 const bonus=input.RU==='Chinese' && (input.HA??0)>=2 ? 'N' : '0';
 const rules={ko:'SIMPLE',scoring:input.RU==='Chinese'?'AREA':'TERRITORY',tax:input.RU==='Chinese'?'NONE':'SEKI',suicide:false,hasButton:false,whiteHandicapBonus:bonus,friendlyPassOk:true};
 return {input,replay,bonus,profile:JSON.stringify(rules),query:{initialStones:input.initialStones.map(([c,p])=>[c,gtp(p)]),initialPlayer:input.initialPlayer,rules,whiteHandicapBonus:bonus,komi:input.KM,boardXSize:19,boardYSize:19,moves:input.moves.map(([c,p])=>[c,gtp(p)]),maxVisits:100,includeOwnership:false}};
}
export type Position=ReturnType<typeof position>;
function estimate(value:unknown):Estimate {
 const v=object(value);
 if(typeof v.visits!=='number' || !Number.isSafeInteger(v.visits) || v.visits<0 || typeof v.winrate!=='number' || !Number.isFinite(v.winrate) || v.winrate<0 || v.winrate>1 || typeof v.scoreLead!=='number' || !Number.isFinite(v.scoreLead)) throw Error('引擎数值无效');
 return {visits:v.visits,winrate:v.winrate,scoreLead:v.scoreLead};
}
export function result(value:unknown, p:Position, engine:string, model:string):Omit<EngineResult,'engineSession'> {
 const v=object(value);
 if(v.warning!==undefined || v.error!==undefined) throw Error('引擎 warning/error，本次分析未完成');
 const root=object(v.rootInfo);
 if(v.turnNumber!==p.input.moves.length || root.currentPlayer!==p.replay.frames.at(-1)!.nextPlayer) throw Error('引擎身份或轮次不符');
 if(!Array.isArray(v.moveInfos) || v.moveInfos.length>362) throw Error('引擎候选数量无效');
 if(!v.moveInfos.length) throw Error('noResults：引擎没有候选结果');
 const seen=new Set<string>();
 const candidates=v.moveInfos.map(raw=>{
  const m=object(raw); const e=estimate(m);
  if(typeof m.move!=='string') throw Error('引擎坐标无效');
  const move=sgf(m.move);
  if(seen.has(move)) throw Error('引擎候选重复');
  seen.add(move);
  tryMove(p.replay,p.replay.frames.length-1,move==='pass'?'':move);
  let pv:string[]|undefined;
  if(m.pv!==undefined) {
   if(!Array.isArray(m.pv) || m.pv.length>16 || m.pv.some(x=>typeof x!=='string')) throw Error('引擎 PV 无效或超限');
   pv=m.pv.map(x=>sgf(x));
   if(pv.length && pv[0]!==move) throw Error('引擎 PV 首着不符');
   let history:Replay=p.replay;
   for(const point of pv) history={...history,frames:[...history.frames,tryMove(history,history.frames.length-1,point==='pass'?'':point)]};
  }
  return {...e,move,...(pv ? {pv} : {})};
 });
 return {engine,model,profile:p.profile,komi:p.input.KM,bonus:p.bonus,root:estimate(root),candidates};
}

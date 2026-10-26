import {GoBoard} from "./GoBoard";
import {useEffect,useRef,useState} from 'react';
import type {Replay} from './replay';
import {engineInput,gtp} from './engine';
import type {AnalyzedResult} from './evidence';
import {ReviewEvidence,useReviewEvidence} from './ReviewEvidence';
import {analyze} from './analyze';
import {startVariation,extendVariation,seekVariation,type Variation} from './variation';
// Mounted per original selection, not per tab or detail disclosure.
export function WorkspaceBoard({game,step,before,prior}:{game:Replay;step:number;before?:AnalyzedResult;prior?:AnalyzedResult}) {
 const [compare,setCompare]=useState(false);
 const [pv,setPV]=useState<Variation>();
 const [trial,setTrial]=useState<Variation>();
 const [error,setError]=useState('');
 const verification=useReviewEvidence({game,step:Math.max(0,step-1),after:before,before:prior,enabled:compare&&!trial});
 const candidate=compare&&verification.data?verification.data.after.candidates[0]:undefined;
 const actual=game.frames[step].move.slice(2);
 const displayed=pv??startVariation(game,compare?step-1:step);
 const frame=displayed.replay.frames[displayed.cursor];
 function follow(){
  if(!candidate?.pv?.length)return;
  void verification.load(value=>{
   const fresh=value.after.candidates[0];
   if(!fresh?.pv?.length)return;
   try{
    let variation=startVariation(game,step-1);
    for(const point of fresh.pv)variation=extendVariation(variation,point==='pass'?'':point);
    setPV(seekVariation(variation,variation.origin+1));setError('');
   }catch(e){setError('推荐变化不可用：'+(e as Error).message);}
  });
 }
 function original(){verification.cancel();setPV(undefined);setTrial(undefined);setCompare(false);setError('');}
 if(trial)return <EnginePanel game={trial.replay} step={trial.cursor} onClose={original} derivedOrigin={!!pv} source={pv?`原谱第 ${step} 手的落子前推荐变化，第 ${pv.cursor-pv.origin} 手后转为自由试下`:compare?`原谱第 ${step} 手落子前转为自由试下`:`原谱第 ${step} 手后转为自由试下`}/>;
 const annotations:Record<string,string>={};
 if(pv){
  for(let n=pv.origin+1;n<=pv.cursor;n++){
   const move=pv.replay.frames[n].move.slice(2);
   if(move!=='pass'&&frame.board[(move.charCodeAt(1)-97)*19+move.charCodeAt(0)-97])annotations[move]=String(n-pv.origin);
  }
 }else if(compare){
  if(actual!=='pass')annotations[actual]='S';
  if(candidate&&candidate.move!=='pass')annotations[candidate.move]=candidate.move===actual?'S/A':'A';
 }
 return <section aria-label="主棋盘" data-mode={compare?'comparison':'replay'}>
  <div className="position-bar">
   <strong>{pv?`推荐变化 · 第 ${pv.cursor-pv.origin} / ${pv.replay.frames.length-1-pv.origin} 手`:compare?`第 ${step} 手落子前对照 · ${frame.nextPlayer==='B'?'黑':'白'}行棋`:`原谱 · 第 ${step} 手 · 轮${frame.nextPlayer==='B'?'黑':'白'}`}</strong>
   {(compare||pv)&&<button onClick={original}>返回原谱</button>}
  </div>
  {compare&&verification.status&&<p role="status">{verification.status}</p>}
  {compare&&!pv&&<div className="comparison"><p>S 实战 {actual}；A 推荐 {candidate?.move??'尚无可用分析'}</p>
   {verification.data&&!candidate&&<p>本局面分析未返回候选，不补造推荐。</p>}
   <p>{candidate?.move===actual?'实战与推荐相同。':'S / A 仅为落点标记，不是同时落两子。'}{candidate&&!candidate.pv?.length?'缺少 PV，不补齐。':''}</p>
   <button disabled={!candidate?.pv?.length} onClick={follow}>查看推荐变化</button>
  </div>}
  {pv&&<p>假设变化，不是必然结局。最近落子：{frame.move}{!verification.data?'；推荐分析已失效，仅保留已展开的假设棋序。':''}</p>}
  {error&&<p role="alert">{error}</p>}
  <div className="board-wrap"><GoBoard frame={frame} label="19 路棋盘" annotations={annotations} onAnnotation={compare&&!pv&&candidate?.pv?.length?follow:undefined}/></div>
  <div className="board-actions">
   {pv?<><button disabled={pv.cursor===pv.origin} onClick={()=>setPV(seekVariation(pv,pv.cursor-1))}>变化上一手</button><button disabled={pv.cursor===pv.replay.frames.length-1} onClick={()=>setPV(seekVariation(pv,pv.cursor+1))}>变化下一手</button></>:<button disabled={!step} onClick={()=>{verification.cancel();setCompare(v=>!v);}}>同起点对照</button>}
   <button onClick={()=>{verification.cancel();setTrial(startVariation(displayed.replay,displayed.cursor));}}>自由试下</button>
  </div>
 </section>;
}

export function EnginePanel({game,step,onClose,source,derivedOrigin}:{game:Replay;step:number;onClose:()=>void;source?:string;derivedOrigin?:boolean}) {
 const [current,setCurrent]=useState(()=>startVariation(game,step));
 const [result,setResult]=useState<AnalyzedResult>();
 // Oldest successful write is evicted; replacing an identity refreshes its order.
 // This cache belongs only to this mounted panel, never to the original game.
 const analyses=useRef(new Map<string,AnalyzedResult>());
 const identity=JSON.stringify(engineInput(current.replay,current.cursor));
 const before=current.cursor>current.origin?analyses.current.get(JSON.stringify(engineInput(current.replay,current.cursor-1))):undefined;
 const [status,setStatus]=useState('等待本机服务…');
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setResult(undefined);setStatus('等待本机服务…');
  void analyze(current.replay,current.cursor,controller.signal,status=>{if(active)setStatus(status);})
   .then(result=>{if(active&&!controller.signal.aborted){
    analyses.current.delete(identity);analyses.current.set(identity,result);
    if(analyses.current.size>64)analyses.current.delete(analyses.current.keys().next().value!);
    setResult(result);setStatus('分析完成');
   }})
   .catch(e=>{if(active){setResult(undefined);setStatus('分析失败：'+e.message);}});
  return()=>{active=false;controller.abort();};
 },[current,retry,identity]);
 function change(v:Variation){setResult(undefined);setStatus('等待本机服务…');setError('');setCurrent(v);}
 function play(point:string){try{change(extendVariation(current,point));}catch(e){setError((e as Error).message);}}
 const frame=current.replay.frames[current.cursor];
 const coordinate=(p:string)=>p==='pass'?'pass':`${p} (${gtp(p)})`;
 return <section className="engine-workspace" aria-label="本地引擎分析">
  <div className="position-bar"><strong>自由试下</strong><button onClick={onClose}>返回原谱</button></div>
  <div className="board-wrap"><GoBoard frame={frame} label="引擎变化棋盘" onPlay={play} /></div>
  {source&&<p>{source}；原谱未改写。</p>}
  <p>原局第 {current.origin} 手；变化 {current.cursor-current.origin} 手；轮{frame.nextPlayer==='B'?'黑':'白'}；最近落子：{frame.move}。保留完整已知前缀，不编造初盘前历史。</p>
  <p aria-live="polite">{status}</p>
  <button onClick={()=>{setResult(undefined);setStatus('等待本机服务…');setRetry(n=>n+1);}}>重新分析当前局面</button>
  <button onClick={()=>play('')}>引擎变化 Pass</button>
  <button disabled={current.cursor===current.origin} onClick={()=>change(seekVariation(current,current.cursor-1))}>引擎变化撤回</button>
  <button disabled={current.cursor===current.replay.frames.length-1} onClick={()=>change(seekVariation(current,current.cursor+1))}>引擎变化重走</button>
  <button onClick={()=>change(startVariation(game,step))}>回到试下起点</button>
  {error&&<p role="alert">{error}</p>}
  <details className="analysis-details"><summary>试下分析详情</summary>
  <p>只向同机回环服务发送必要棋局，无外发；不发送名字、评论或完整 SGF。</p>
  <p>固定黑方视角（BLACK）：正目差表示黑领先。候选不是全部合法手或最强证明；估值不是原因，PV 是假设变化，不是必然结局。与预设示例教学分开。</p>
  <p>规则记录：{game.rules}；贴目：{game.komi}；HA：{game.handicap}。仅近似计算 profile，不代表完整国家规则或野狐认证。</p>
  <p>请求预算：100 visits / maxTime 2秒；分析线程1，搜索线程2，batch2/cache18，PV最多16着（首着＋最多15着后续），无ownership。</p>
  {result&&<div aria-label="引擎结果">
   <p>{result.engine}；模型：{result.model}</p>
   <p>计算 profile：{result.profile}；贴目：{result.komi}；whiteHandicapBonus：{result.bonus}</p>
   <p>实际 visits：{result.root.visits}；黑方胜率：{(result.root.winrate*100).toFixed(2)}%；黑方目差：{result.root.scoreLead.toFixed(2)}</p>
   <p>候选 {result.candidates.length} 项；显示前 {Math.min(10,result.candidates.length)} 项；未展示 {Math.max(0,result.candidates.length-10)} 项。</p>
   <ol>{result.candidates.slice(0,10).map((c,i)=><li key={i}>候选 {coordinate(c.move)}；visits {c.visits}；黑方胜率 {(c.winrate*100).toFixed(2)}%；黑方目差 {c.scoreLead.toFixed(2)}；PV：{c.pv?.length?c.pv.map(coordinate).join(' → '):'缺少 PV，不补齐'}</li>)}</ol>
  </div>}
  {current.cursor===current.origin?<p>当前为试下起点，落子后可查看试下依据。</p>:<ReviewEvidence
   key={JSON.stringify([identity,before?.evidenceId,result?.evidenceId])}
   game={current.replay} step={current.cursor} before={before} after={result} variationOrigin={current.origin} variationSource={source} derivedOrigin={derivedOrigin}
  />}
  </details>
 </section>;
}

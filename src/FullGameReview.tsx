import {useEffect,useRef,useState} from 'react';
import type {Replay} from './replay';
import {gtp,type EngineResult} from './engine';
import {analyze} from './analyze';
type CachedResult=EngineResult&{candidateCount:number};
export function FullGameReview({game,step,onStep,autoScan}:{game:Replay;step:number;onStep:(n:number)=>void;autoScan:boolean}) {
 const identity=useRef<Pick<EngineResult,'engineSession'|'profile'|'komi'|'bonus'>|undefined>(undefined);
 const [sessionNotice,setSessionNotice]=useState('');
 const cache=useRef<(CachedResult|undefined)[]>(Array(game.frames.length));
 const [results,setResults]=useState(cache.current);
 const [status,setStatus]=useState(autoScan?'等待扫描':'未开始');
 const [running,setRunning]=useState(autoScan);
 const [inFlight,setInFlight]=useState<number>();
 const [failure,setFailure]=useState<{index:number;message:string}>();
 const selected=useRef(step);selected.current=step;
 const retryIndex=useRef<number|undefined>(undefined);
 const epoch=useRef(0);
 const request=useRef<AbortController|undefined>(undefined);
 useEffect(()=>{setRunning(autoScan);if(!autoScan)setStatus('已暂停');},[autoScan]);
 useEffect(()=>{
  if(!running)return;
  const id=++epoch.current,controller=new AbortController();request.current=controller;
  const active=()=>id===epoch.current;
  let index=selected.current;
  setFailure(undefined);setStatus('检查本地引擎配置');
  void (async()=>{
   const response=await fetch('/api/engine-capability',{signal:controller.signal});
   if(!response.ok)throw Error('无法查询本地引擎配置');
   const capability=await response.json();
   if(!active())return;
   if(!capability.configured){setStatus('未配置本地引擎，仍可回放');setRunning(false);return;}
   while(active()){
    const preferred=[retryIndex.current,selected.current,selected.current-1];
    retryIndex.current=undefined;
    index=preferred.find((n):n is number=>n!==undefined&&n>=0&&!cache.current[n])??cache.current.findIndex(r=>!r);
    if(index<0){setStatus('完成');setRunning(false);return;}
    setInFlight(index);setStatus('扫描中');
    const result=await analyze(game,index,controller.signal,s=>{if(active())setStatus(s);});
    if(!active())return;
    const old=identity.current;
    if(old&&(old.engineSession!==result.engineSession||old.profile!==result.profile||old.komi!==result.komi||old.bonus!==result.bonus)){
     cache.current=Array(game.frames.length);
     setSessionNotice('引擎会话改变，旧成功已清除，重新扫描');
    }
    identity.current={engineSession:result.engineSession,profile:result.profile,komi:result.komi,bonus:result.bonus};
    cache.current=[...cache.current];cache.current[index]={...result,candidates:result.candidates.slice(0,10),candidateCount:result.candidates.length};
    setResults(cache.current);setInFlight(undefined);
   }
  })().catch(e=>{if(active()){retryIndex.current=index;setFailure({index,message:e.message});setStatus('失败，已暂停');setRunning(false);}});
  return()=>{epoch.current++;controller.abort();setInFlight(undefined);};
 },[game,running]);
 function pause(){epoch.current++;request.current?.abort();setRunning(false);setStatus('已暂停');setInFlight(undefined);}
 const successCount=results.filter(Boolean).length;
 const current=results[step],previous=results[step-1];
 const sign=game.frames[step].move[0]==='B'?1:-1;
 const coordinate=(p:string)=>p==='pass'?'pass':`${p} (${gtp(p)})`;
 return <section className="full-game" aria-label="整局复盘"><h2>整局复盘</h2>
  <p aria-live="polite">{status}：{successCount} / {game.frames.length}</p>
  {running?<button onClick={pause}>暂停扫描</button>:<button disabled={successCount===game.frames.length} onClick={()=>setRunning(true)}>{failure?'重试失败局面并继续':'继续扫描'}</button>}
  {sessionNotice&&<p>{sessionNotice}</p>}
  {failure&&<p>失败局面：第 {failure.index} 手后；{failure.message}。等待用户重试，不自动重启。</p>}
  <p>固定黑方视角（BLACK）：胜率0–100%，正目差表示黑领先。未知区段不连接。</p>
  <svg viewBox="0 0 600 120" role="img" aria-label="黑方胜率走势" style={{width:'100%',maxWidth:600}}>
   {results.map((r,i)=>{if(!r)return null;const x=10+i*580/Math.max(1,game.frames.length-1),y=110-r.root.winrate*100;return <g key={i}>{i>0&&results[i-1]&&<line x1={10+(i-1)*580/Math.max(1,game.frames.length-1)} y1={110-results[i-1]!.root.winrate*100} x2={x} y2={y} stroke="currentColor"/>}<circle cx={x} cy={y} r={3}/></g>;})}
  </svg>
  <ol aria-label="逐手局面" style={{maxHeight:220,overflow:'auto'}}>{game.frames.map((_,i)=><li key={i}><button aria-label={`定位第 ${i} 手`} aria-current={i===step?'step':undefined} onClick={()=>onStep(i)}>第 {i} 手</button> {results[i]?`成功；黑胜率 ${(results[i]!.root.winrate*100).toFixed(2)}%；目差 ${results[i]!.root.scoreLead.toFixed(2)}`:inFlight===i?'分析中':failure?.index===i?'失败':'待处理'}</li>)}</ol>
  <p>行棋前后估值变化 P[k−1]→P[k]，不是严格最优手损失或因果证明；100 visits / 2秒低预算会波动，不自动判恶手或教学价值。</p>
  <p>{step===0?'初盘没有上一手变化':current&&previous?`${sign===1?'黑':'白'}手：胜率下降 ${(sign*(previous.root.winrate-current.root.winrate)*100).toFixed(2)} 百分点；目差下降 ${(sign*(previous.root.scoreLead-current.root.scoreLead)).toFixed(2)} 目`:'前后局面尚未齐全，不计算差值'}</p>
  {current&&<div aria-label="逐手引擎结果">
   <p>第 {step} 手后，轮{game.frames[step].nextPlayer==='B'?'黑':'白'}的下一手候选（不是本手落子前推荐）</p>
   <p>{current.engine}；模型：{current.model}；计算 profile：{current.profile}；贴目：{current.komi}；whiteHandicapBonus：{current.bonus}</p>
   <p>实际 visits：{current.root.visits}；黑方胜率：{(current.root.winrate*100).toFixed(2)}%；黑方目差：{current.root.scoreLead.toFixed(2)}</p>
   <p>候选总数 {current.candidateCount}；保留/显示 {current.candidates.length}；丢弃 {current.candidateCount-current.candidates.length}。仅当前上传内存缓存，最多2000局面；不跨标签或持久化。</p>
   <ol>{current.candidates.map((c,i)=><li key={i}>候选 {coordinate(c.move)}；visits {c.visits}；黑方胜率 {(c.winrate*100).toFixed(2)}%；黑方目差 {c.scoreLead.toFixed(2)}；假设 PV：{c.pv?.length?c.pv.map(coordinate).join(' → '):'缺少 PV，不补齐'}</li>)}</ol>
  </div>}
  <p>DeepSeek中文讲解尚未接入/未启用；后续需配置与外发/费用授权。本地估值不是中文原因，PV不是必然结局。</p>
 </section>;
}

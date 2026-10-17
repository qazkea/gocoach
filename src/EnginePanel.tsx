import {GoBoard} from "./GoBoard";
import {useEffect,useState} from 'react';
import type {Replay} from './replay';
import {gtp,type EngineResult} from './engine';
import {analyze} from './analyze';
import {startVariation,extendVariation,seekVariation,type Variation} from './variation';
export function EngineEntry({game,step}:{game:Replay;step:number}) {
 const [open,setOpen]=useState(false);
 return open?<EnginePanel game={game} step={step} onClose={()=>setOpen(false)}/>:<button onClick={()=>setOpen(true)}>打开本地真实引擎分析</button>;
}
function EnginePanel({game,step,onClose}:{game:Replay;step:number;onClose:()=>void}) {
 const [current,setCurrent]=useState(()=>startVariation(game,step));
 const [result,setResult]=useState<EngineResult>();
 const [status,setStatus]=useState('等待本机服务…');
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setResult(undefined);setStatus('等待本机服务…');
  void analyze(current.replay,current.cursor,controller.signal,status=>{if(active)setStatus(status);})
   .then(result=>{if(active){setResult(result);setStatus('分析完成');}})
   .catch(e=>{if(active){setResult(undefined);setStatus('分析失败：'+e.message);}});
  return()=>{active=false;controller.abort();};
 },[current,retry]);
 function change(v:Variation){setResult(undefined);setStatus('等待本机服务…');setError('');setCurrent(v);}
 function play(point:string){try{change(extendVariation(current,point));}catch(e){setError((e as Error).message);}}
 const frame=current.replay.frames[current.cursor];
 const coordinate=(p:string)=>p==='pass'?'pass':`${p} (${gtp(p)})`;
 return <section aria-label="本地引擎分析">
  <h2>本地真实引擎分析</h2>
  <p>只向同机回环服务发送必要棋局，无外发；不发送名字、评论或完整 SGF。</p>
  <p>固定黑方视角（BLACK）：正目差表示黑领先。候选不是全部合法手或最强证明；估值不是原因，PV 是假设变化，不是必然结局。与预设示例教学分开。</p>
  <p>规则记录：{game.rules}；贴目：{game.komi}；HA：{game.handicap}。仅近似计算 profile，不代表完整国家规则或野狐认证。</p>
  <p>请求预算：100 visits / maxTime 2秒；分析线程1，搜索线程2，batch2/cache18，PV最多16着（首着＋最多15着后续），无ownership。</p>
  <p>原局第 {current.origin} 手；变化 {current.cursor-current.origin} 手；轮{frame.nextPlayer==='B'?'黑':'白'}；最近落子：{frame.move}。保留完整已知前缀，不编造初盘前历史。</p>
  <p aria-live="polite">{status}</p>
  <button onClick={()=>{setResult(undefined);setStatus('等待本机服务…');setRetry(n=>n+1);}}>重新分析当前局面</button>
  <button onClick={()=>play('')}>引擎变化 Pass</button>
  <button disabled={current.cursor===current.origin} onClick={()=>change(seekVariation(current,current.cursor-1))}>引擎变化撤回</button>
  <button disabled={current.cursor===current.replay.frames.length-1} onClick={()=>change(seekVariation(current,current.cursor+1))}>引擎变化重走</button>
  <button onClick={()=>change(startVariation(game,step))}>回到原局</button>
  <button onClick={onClose}>关闭本地引擎面板</button>
  {error&&<p role="alert">{error}</p>}
  {result&&<div aria-label="引擎结果">
   <p>{result.engine}；模型：{result.model}</p>
   <p>计算 profile：{result.profile}；贴目：{result.komi}；whiteHandicapBonus：{result.bonus}</p>
   <p>实际 visits：{result.root.visits}；黑方胜率：{(result.root.winrate*100).toFixed(2)}%；黑方目差：{result.root.scoreLead.toFixed(2)}</p>
   <p>候选 {result.candidates.length} 项；显示前 {Math.min(10,result.candidates.length)} 项；未展示 {Math.max(0,result.candidates.length-10)} 项。</p>
   <ol>{result.candidates.slice(0,10).map((c,i)=><li key={i}>候选 {coordinate(c.move)}；visits {c.visits}；黑方胜率 {(c.winrate*100).toFixed(2)}%；黑方目差 {c.scoreLead.toFixed(2)}；PV：{c.pv?.length?c.pv.map(coordinate).join(' → '):'缺少 PV，不补齐'}</li>)}</ol>
  </div>}
  <GoBoard frame={frame} label="引擎变化棋盘" onPlay={play} />
 </section>;
}

import {useEffect,useRef,useState} from 'react';
import {engineInput,gtp} from './engine';
import type {Replay} from './replay';
import type {AnalyzedResult,EvidenceAnalysis,ReviewEvidence as EvidenceDTO} from './evidence';
const color=(c:string)=>c==='B'?'黑':'白';
const coordinate=(p:string)=>p==='pass'?'pass':`${p} (${gtp(p)})`;
function Analysis({title,value}:{title:string;value:EvidenceAnalysis}) {
 return <div><h4>{title}</h4>
  <p>{value.engine}；模型：{value.model}；profile：{value.profile}；贴目：{value.komi}；whiteHandicapBonus：{value.bonus}</p>
  <p>黑方胜率：{(value.root.winrate*100).toFixed(2)}%；黑方目差：{value.root.scoreLead.toFixed(2)}；实际 visits：{value.root.visits}</p>
  <p>候选总数 {value.candidateCount}；显示前 {value.candidates.length} 项；请求预算 {value.budget.maxVisits} visits / {value.budget.maxTime}秒</p>
  <ol>{value.candidates.map(c=><li key={c.move}>{coordinate(c.move)}；visits {c.visits}；黑方胜率 {(c.winrate*100).toFixed(2)}%；黑方目差 {c.scoreLead.toFixed(2)}；假设 PV：{c.pv?.length?c.pv.map(coordinate).join(' → '):'缺少，不补齐'}</li>)}</ol>
 </div>;
}
// Parent keys this request lifetime by selection and evidence identities. Unmount
// aborts I/O and guards late resolutions without retaining stale detail on render.
export function ReviewEvidence({game,step,after,before}:{game:Replay;step:number;after?:AnalyzedResult;before?:AnalyzedResult}) {
 const [data,setData]=useState<EvidenceDTO>();
 const [status,setStatus]=useState('');
 const request=useRef<AbortController|undefined>(undefined);
 useEffect(()=>()=>request.current?.abort(),[]);
 const ready=!!after&&(step===0||!!before&&before.engineSession===after.engineSession&&before.profile===after.profile&&before.komi===after.komi&&before.bonus===after.bonus&&before.engine===after.engine&&before.model===after.model);
 async function load(){
  request.current?.abort();const controller=new AbortController();request.current=controller;
  setData(undefined);setStatus('正在读取本地依据…');
  try{
   const auth=await fetch('/api/token',{signal:controller.signal}).then(r=>r.json());
   const response=await fetch('/api/review-evidence',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':auth.token},body:JSON.stringify({position:engineInput(game,step),afterId:after!.evidenceId,...(step?{beforeId:before!.evidenceId}:{})}),signal:controller.signal});
   const value=await response.json();
   if(!response.ok)throw Error(value.error??'读取依据失败');
   if(!controller.signal.aborted){setData(value);setStatus('');}
  }catch(e){if(!controller.signal.aborted)setStatus((e as Error).message);}
 }
 return <div>
  <button disabled={!ready||status==='正在读取本地依据…'} onClick={()=>void load()}>查看本手讲解依据</button>
  {!ready&&<p>当前所需前后分析尚未齐全，不自动补跑引擎。</p>}
  {status&&<p role="status">{status}</p>}
  {data&&<section aria-label="本手讲解依据"><h3>本地讲解依据 · 第 {data.step} 手</h3>
   <p>可复算棋盘事实；DeepSeek未启用，没有发给DeepSeek，不是中文策略讲解。</p>
   {data.actual?<><p>实际落子：{color(data.actual.color)} {coordinate(data.actual.move)}</p>
    <p>实际提子：{data.actual.captured.length}；{data.actual.captured.map(coordinate).join('、')||'无'}</p>
    <p>{data.actual.liberties?`己链气：${data.actual.liberties.length}；${data.actual.liberties.map(coordinate).join('、')}`:'Pass 无新落子己链'}</p></>:<p>初盘，没有实际上一手；初始棋子 {data.initialStones}；轮{color(data.nextPlayer)}</p>}
   <p>{data.limitations.join(' ')}</p>
   {data.before&&<Analysis title={`实战落子前的候选（${color(data.actual!.color)}）`} value={data.before}/>}
   <Analysis title={`${data.actual?'实战落子后':'初盘下一手'}的候选（${color(data.nextPlayer)}）`} value={data.after}/>
   {data.decline&&<p>{color(data.actual!.color)}手：胜率下降 {data.decline.winratePoints.toFixed(2)} 百分点；目差下降 {data.decline.scoreLead.toFixed(2)} 目。保留正负，不是最优手损失或因果证明。</p>}
  </section>}
 </div>;
}

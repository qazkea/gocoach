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
export function useReviewEvidence({game,step,after,before,enabled=false}:{game:Replay;step:number;after?:AnalyzedResult;before?:AnalyzedResult;enabled?:boolean}) {
 const [data,setData]=useState<EvidenceDTO>();
 const [status,setStatus]=useState('');
 const request=useRef<AbortController|undefined>(undefined);
 const epoch=useRef(0);
 useEffect(()=>()=>{epoch.current++;request.current?.abort();},[]);
 const ready=!!after&&(step===0||!!before&&before.engineSession===after.engineSession&&before.profile===after.profile&&before.komi===after.komi&&before.bonus===after.bonus&&before.engine===after.engine&&before.model===after.model);
 // Deliver one verified DTO without waiting for the long-lived session watch.
 async function load(onVerified?:(value:EvidenceDTO)=>void){
  request.current?.abort();const controller=new AbortController();request.current=controller;
  const attempt=++epoch.current;
  const current=()=>attempt===epoch.current&&!controller.signal.aborted;
  const fail=(message:string)=>{
   if(!current())return;
   epoch.current++;controller.abort();setData(undefined);setStatus(message);
  };
  // A browser offline event can precede rejection of an idle streaming read.
  const offline=()=>fail('引擎会话观察失联，请重试');
  window.addEventListener('offline',offline);
  controller.signal.addEventListener('abort',()=>window.removeEventListener('offline',offline),{once:true});
  setData(undefined);setStatus('正在读取本地依据…');
  let confirmed=false;
  const deadline=setTimeout(()=>fail(confirmed?'本地依据核验超时，请重试':'引擎会话观察未就绪，请重试'),10000);
  controller.signal.addEventListener('abort',()=>clearTimeout(deadline),{once:true});
  try{
   const auth=await fetch('/api/token',{signal:controller.signal}).then(r=>r.json());
   const headers={'Content-Type':'application/json','X-CSRF-Token':auth.token};
   const query=async()=>{
    try{
     const response=await fetch('/api/review-evidence',{method:'POST',headers,body:JSON.stringify({position:engineInput(game,step),afterId:after!.evidenceId,...(step?{beforeId:before!.evidenceId}:{})}),signal:controller.signal});
     const value=await response.json();
     if(!response.ok)throw Error(value.error??'读取依据失败');
     if(current()&&confirmed){clearTimeout(deadline);setData(value);setStatus('');onVerified?.(value);}
    }catch(e){fail((e as Error).message);}
   };
   const response=await fetch('/api/engine-session-watch',{method:'POST',headers,body:'{}',signal:controller.signal});
   if(!response.ok||!response.body||!response.headers.get('content-type')?.startsWith('application/x-ndjson'))throw Error('引擎会话观察失联，请重试');
   const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
   let buffer='';
   try{
    while(current()){
     const part=await reader.read();
     if(!current())break;
     if(part.done)throw Error('引擎会话观察失联，请重试');
     buffer+=decoder.decode(part.value,{stream:true});
     if(buffer.length>65536)throw Error('引擎会话观察协议无效，请重试');
     let i:number;
     while((i=buffer.indexOf('\n'))>=0&&current()){
      const line=buffer.slice(0,i);buffer=buffer.slice(i+1);
      let value;
      try{value=JSON.parse(line);}catch{throw Error('引擎会话观察协议无效，请重试');}
      if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!('engineSession' in value)||(value.engineSession!==null&&typeof value.engineSession!=='string'))throw Error('引擎会话观察协议无效，请重试');
      if(value.engineSession!==after!.engineSession){fail('讲解依据已过期，请重新导入棋谱分析');break;}
      if(!confirmed){confirmed=true;void query();}
     }
    }
   }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }catch(e){fail((e as Error).message);}
  finally{clearTimeout(deadline);}
 }
 useEffect(()=>{
  if(!enabled)return;
  setData(undefined);setStatus('');
  if(ready)void load();
  return()=>{epoch.current++;request.current?.abort();};
 },[enabled,game,step,after?.evidenceId,before?.evidenceId]);
 function cancel(){epoch.current++;request.current?.abort();setData(undefined);setStatus('');}
 return {data,status,ready,load,cancel};
}
export function ReviewEvidence({game,step,after,before,variationOrigin,variationSource,derivedOrigin}:{game:Replay;step:number;after?:AnalyzedResult;before?:AnalyzedResult;variationOrigin?:number;variationSource?:string;derivedOrigin?:boolean}) {
 const variation=variationOrigin!==undefined;
 const label=variation?'试下讲解依据':'本手讲解依据';
 const moveLabel=variation?'试下':'实际';
 const candidateLabel=variation?'试下':'实战';
 const {data,status,ready,load}=useReviewEvidence({game,step,after,before});
 return <div>
  <button disabled={!ready||status==='正在读取本地依据…'} onClick={()=>void load()}>查看{label}</button>
  {!ready&&<p>当前所需前后分析尚未齐全，不自动补跑引擎。</p>}
  {status&&<p role="status">{status}</p>}
  {data&&<section aria-label={label}><h3>本地讲解依据 · 第 {data.step} 手</h3>
   {variationSource&&<p>进入路径：{variationSource}。下列起点手数为当前规范历史长度，推荐分支不等于原谱同手。</p>}
   {variation&&<p>{derivedOrigin?'规范历史起点':'原谱起点'}：第 {variationOrigin} 手；变化第 {step-variationOrigin} 手。试下来源由本地面板标记，服务仅核验分析局面与引用。</p>}
   <p>可复算棋盘事实；DeepSeek未启用，没有发给DeepSeek，不是中文策略讲解。</p>
   {data.actual?<><p>{moveLabel}落子：{color(data.actual.color)} {coordinate(data.actual.move)}</p>
    <p>{moveLabel}提子：{data.actual.captured.length}；{data.actual.captured.map(coordinate).join('、')||'无'}</p>
    <p>{data.actual.liberties?`己链气：${data.actual.liberties.length}；${data.actual.liberties.map(coordinate).join('、')}`:'Pass 无新落子己链'}</p></>:<p>初盘，没有实际上一手；初始棋子 {data.initialStones}；轮{color(data.nextPlayer)}</p>}
   <p>{data.limitations.join(' ')}</p>
   {data.before&&<Analysis title={`${candidateLabel}落子前的候选（${color(data.actual!.color)}）`} value={data.before}/>}
   <Analysis title={`${data.actual?`${candidateLabel}落子后`:'初盘下一手'}的候选（${color(data.nextPlayer)}）`} value={data.after}/>
   {data.decline&&<p>{color(data.actual!.color)}手：胜率下降 {data.decline.winratePoints.toFixed(2)} 百分点；目差下降 {data.decline.scoreLead.toFixed(2)} 目。保留正负，不是最优手损失或因果证明。</p>}
  </section>}
 </div>;
}

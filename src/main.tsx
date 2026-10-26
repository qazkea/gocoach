import {useRef,useState,type ChangeEvent,type KeyboardEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {importReplay,MAX_FILE_BYTES,type Replay} from './replay';
import {Course} from './TeachingPanel';
import {WorkspaceBoard} from './EnginePanel';
import {FullGameReview} from './FullGameReview';
import './style.css';

function App(){
 const [game,setGame]=useState<Replay>();
 const [step,setStep]=useState(0);
 const [autoScan,setAutoScan]=useState(true);
 const [status,setStatus]=useState('请选择已结束对局的完整 19 路 SGF');
 const [error,setError]=useState('');
 const [tab,setTab]=useState('board');
 const [teaching,setTeaching]=useState(false);
 const [draft,setDraft]=useState('');
 const request=useRef(0);
 const frame=game?.frames[step];
 async function upload(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value='';
  const id=++request.current;
  setGame(undefined);setStep(0);setError('');setTeaching(false);setTab('board');
  setStatus(file?'正在本地读取…':'请选择 SGF 文件');
  if(!file)return;
  try{
   if(file.size>MAX_FILE_BYTES)throw Error('文件超过 1 MiB 上限');
   const bytes=await file.arrayBuffer();if(id!==request.current)return;
   setGame(importReplay(bytes));setStatus('导入成功');
  }catch(cause){
   if(id!==request.current)return;
   setStatus('');setError('导入失败：'+(cause instanceof Error?cause.message:'无法读取文件，请重新上传'));
  }
 }
 function navigate(event:KeyboardEvent<HTMLElement>){
  if(!game||(event.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]'))return;
  const destination:Record<string,number>={ArrowLeft:step-1,ArrowRight:step+1,Home:0,End:game.frames.length-1};
  if(Object.hasOwn(destination,event.key)){
   event.preventDefault();setStep(Math.max(0,Math.min(game.frames.length-1,destination[event.key])));
  }
 }
 return <main className="app">
  <header className="app-header"><h1>围棋赛后复盘</h1><span className="brand">Go Coach</span>
   <label className="upload">选择 SGF 文件 <input type="file" accept=".sgf" onChange={upload}/></label>
   <label className="scan-choice"><input type="checkbox" checked={autoScan} onChange={e=>setAutoScan(e.target.checked)}/>导入后自动整局扫描</label>
   {game&&<button className="teaching-entry" aria-pressed={teaching} onClick={()=>setTeaching(v=>!v)}>{teaching?'返回正常复盘':'预设教学入口'}</button>}
   <details className="app-info"><summary>说明与棋谱信息</summary><div className="info-content">
    <p>仅用于已结束对局。文件在本机浏览器读取；默认导入后自动整局扫描，将必要棋局发送到同机回环服务；可关闭自动扫描仅回放或手动分析，无外发；不提供实时辅助、账号连接或自动同步。</p>
    <p>仅基础回放校验：Chinese / Japanese 的占点、提子、自杀与简单劫；不计分、不裁判终局或长周期争议，不代表完整规则支持。</p>
    <p>支持单谱单线 FF[4]、19 路、明确 RU 与 KM；UTF-8 / GBK / Latin1（无 CA 时为 Latin1）。最多 1 MiB、2000 节点。初始 setup 可用；分支、途中 setup、规则例外及未支持属性会拒绝。尚未验证野狐兼容。</p>
    <p>桌面引擎与凭据设置请使用窗口原生菜单；普通页面不读取 Key。</p>
    {game&&<section aria-label="棋谱信息"><p>黑方：{game.black}；白方：{game.white}</p><p>规则记录：{game.rules}；贴目：{game.komi}；结果记录：{game.result}；编码：{game.encoding}；让子记录：{game.handicap}</p><p>结果来自文件，不自动判断真实对局是否结束或计算胜负。让子数不自动摆子，初始局面以 setup 记录为准。</p></section>}
   </div></details>
  </header>
  <div className="import-status"><p role="status">{status}</p>{error&&<p role="alert">{error}</p>}<span>赛后学习 · 本机复盘</span></div>
  <div className="workspace-tabs" role="tablist" aria-label="工作区"><button role="tab" aria-selected={tab==='board'} aria-controls="board-area" onClick={()=>setTab('board')}>棋盘</button><button role="tab" aria-selected={tab==='coach'} aria-controls="coach-area" onClick={()=>setTab('coach')}>教练</button></div>
  <div className="workspace" data-tab={tab}>
   <div id="board-area" className="board-area">
    {game&&frame?<>
     <FullGameReview key={'review:'+request.current} game={game} step={step} onStep={setStep} autoScan={autoScan}>
      {analysis=><>
       {teaching?<Course key={request.current} game={game} step={step} onStep={setStep} fallback={<WorkspaceBoard key={step} game={game} step={step} before={analysis.previous} prior={analysis.prior}/>}/>:<WorkspaceBoard key={request.current+':'+step} game={game} step={step} before={analysis.previous} prior={analysis.prior}/>}
       <section className="replay" aria-label="棋谱回放" tabIndex={0} onKeyDown={navigate}>
        <nav aria-label="回放导航">{([['起始',0],['上一手',step-1],['下一手',step+1],['末尾',game.frames.length-1]] as const).map(([label,n])=><button key={label} disabled={n===step||n<0||n>=game.frames.length} onClick={()=>setStep(n)}>{label}</button>)}</nav>
        <p>第 {step} / {game.frames.length-1} 手：{frame.move}</p><p>黑提子：{frame.blackCaptures}；白提子：{frame.whiteCaptures}</p>
        <small>聚焦此处：左右键回放，Home / End 到首尾。SGF 坐标 aa 左上，ss 右下。</small>
       </section>
      </>}
     </FullGameReview>
    </>:<section className="empty-board"><h2>从一盘已经结束的棋开始</h2><p>选择完整的 19 路 SGF。导入后可回放、比较落点，或在主棋盘试下。</p><p>没有配置引擎也能回放；关闭自动扫描即可只看原谱。</p></section>}
   </div>
   <aside id="coach-area" className="coach-area" aria-label="复盘教练">
    <div className="coach-heading"><h2>这一盘的复盘对话</h2><span>{game?`原谱第 ${step} 手`:'尚未导入'}</span></div>
    <div className="coach-reading"><h3>在线教练尚未启用</h3><p>这里还没有 AI 回复，也不会自动发送问题。切手、查看推荐和试下都只用于本地复盘。</p><p>可以先在棋盘核对实战与推荐，展开真实本地分析的候选与依据。引擎估值不是原因，一条变化也不是必然结局。</p><p>预设教学有独立入口，仅适用于已核验的合成样例，不代表在线教练。</p></div>
    <div className="composer"><label htmlFor="draft">复盘草稿</label><textarea id="draft" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="记下想讨论的问题…"/><small>仅本次窗口内编辑，不保存、不发送。</small></div>
   </aside>
  </div>
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);

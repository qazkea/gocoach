import {useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {importReplay, type Replay} from "./replay";
import "./style.css";
function App(){
 const [game,setGame]=useState<Replay>();
 const [step,setStep]=useState(0);
 const [status,setStatus]=useState("请选择已结束对局的完整 19 路 SGF");
 const [error,setError]=useState("");
 const request=useRef(0);
 const frame=game?.frames[step];
 return <main><h1>围棋赛后复盘</h1><p>仅用于已结束对局。文件仅在本机浏览器读取，不上传；不提供实时辅助、账号连接或自动同步。</p>
 <label>选择 SGF 文件 <input type="file" accept=".sgf" onChange={async e=>{
   const file=e.target.files?.[0]; const id=++request.current;
   setGame(undefined);setStep(0);setError("");
   if(!file)return;
   setStatus("正在本地读取…");
   try {const result=importReplay(await file.arrayBuffer());if(id!==request.current)return;setGame(result);setStatus("导入成功");}
   catch (cause) {if(id!==request.current)return;setStatus("");setError("导入失败："+(cause instanceof Error?cause.message:"无法读取文件，请重新上传"));}
 }}/></label>
 <p role="status">{status}</p>{error&&<p role="alert">{error}</p>}
 {game&&<section aria-label="棋谱信息"><p>黑方：{game.black}；白方：{game.white}</p><p>规则记录：{game.rules}；贴目：{game.komi}；结果记录：{game.result}；编码：{game.encoding}</p><p>结果来自文件，不自动判断真实对局是否结束或计算胜负。</p></section>}
 {game&&frame&&<section aria-label="棋谱回放"><p>第 {step} / {game.frames.length-1} 手：{frame.move}</p>
 <nav aria-label="回放导航">{[["起始",0],["上一手",step-1],["下一手",step+1],["末尾",game.frames.length-1]].map(([label,n])=><button key={label} disabled={n===step||Number(n)<0||Number(n)>=game.frames.length} onClick={()=>setStep(Number(n))}>{label}</button>)}</nav>
 <div className="board" aria-label="19 路棋盘">{frame.board.map((stone,i)=>{const point=String.fromCharCode(97+i%19)+String.fromCharCode(97+Math.floor(i/19));return <span key={i} role="img" aria-label={point+" "+(stone==="B"?"黑":stone==="W"?"白":"空")} className={"point "+(stone??"")}>{stone?"●":"+"}</span>})}</div>
 </section>}</main>;
}
createRoot(document.getElementById("root")!).render(<App/>);

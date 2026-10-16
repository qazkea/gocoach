import {useEffect, useState} from "react";
import {analyze, attempt, evidenceText, type Example, type Analysis} from "./teaching";
import {type Frame, type Replay} from "./replay";
type TeachingMode = "initial" | "trial" | "actual" | "teaching" | "engine";
const modeLabels: Record<TeachingMode, string> = {
 initial: "先试下一手",
 trial: "一手试下结果（不继续行棋）",
 actual: "实战落子",
 teaching: "本课教学推荐",
 engine: "模拟引擎首选",
};
export function Teaching({game, example}: {game: Replay; example: Example}) {
 const [state, setState] = useState("分析中…");
 const [retry, setRetry] = useState(0);
 const [trial, setTrial] = useState<Frame>();
 const [feedback, setFeedback] = useState("");
 const [hint, setHint] = useState(false);
 const [analysis, setAnalysis] = useState<Analysis>();
 const [answer, setAnswer] = useState(false);
 const [mode, setMode] = useState<TeachingMode>("initial");
 const [selected, setSelected] = useState("");
 useEffect(() => {
  let active = true;
  analyze(game, example).then(result => {if (active) {setAnalysis(result); setState("准备就绪");}}, error => {if (active) setState(error.message);});
  return () => {active = false;};
 }, [game, example.id, example.step, retry]);
 const frame = trial ?? game.frames[example.step];
 function play(point: string, mode: Exclude<TeachingMode, "initial">) {
  try {
   const result = attempt(game, example.step, point);
   setTrial(result.frame); setFeedback(result.feedback); setMode(mode); setSelected(point);
   setAnswer(mode !== "trial");
  }
  catch(error) {setFeedback(error instanceof Error ? error.message : "试下失败");}
 }
 return <section aria-label="局面教学">
  <h2>局面教学</h2>
  <p>示例分析：预设数据，非真实引擎或在线AI</p>
  <p>来源：自制合成样例 {example.id === "corner-a" ? "A" : "B"}，非野狐对局。手工核验角部邻点、唯一气和提子；不推导全局优劣。</p>
  <p aria-live="polite">{state}</p>
  {state !== "准备就绪" && state !== "分析中…" && <button onClick={() => {setState("分析中…"); setRetry(n => n + 1);}}>重试分析</button>}
  {state === "准备就绪" && <>
   <p>第 {example.step} 手后，轮黑；模式：{modeLabels[mode]}</p>
   <p>每次点击都从原局面重新试一手，不在结果盘继续行棋。坐标 aa 左上、ss 右下，先列后行。</p>
   <p>目标：提走左上角白 aa。黑提子：{frame.blackCaptures}；白提子：{frame.whiteCaptures}</p>
   <button onClick={() => setHint(true)}>请求提示</button>
   <button onClick={() => {setAnswer(true); play(analysis!.teaching, "teaching");}}>直接看答案</button>
   {answer && <div>
    <p>实战落子：{game.frames[example.step + 1].move.slice(2)}；本课教学推荐：{analysis!.teaching}；模拟引擎首选：{analysis!.engine}</p>
    <p>{analysis!.teaching === analysis!.engine ? "两类推荐相同。" : "两类推荐不同：课堂先讲左上角，故选 ab；预设排序不证明 rs 全局更优，也未证明 ab 更简单。"}</p>
    <p>{evidenceText(analysis!, selected)}{selected === "rs" ? "右下 ss 仅邻 sr（黑）和 rs。" : "左上 aa 仅邻 ba（黑）和 ab。"}</p>
    <p>红框：证据目标（提子后为空）；绿框：推荐落点。比较均从原局面开始，不是连续变化。</p>
    <button onClick={() => play(game.frames[example.step + 1].move.slice(2), "actual")}>查看实战落子</button>
    <button onClick={() => play(analysis!.teaching, "teaching")}>查看本课教学推荐</button>
    <button onClick={() => play(analysis!.engine, "engine")}>查看模拟引擎首选</button>
   </div>}
   <button onClick={() => {setTrial(undefined); setFeedback(""); setAnswer(false); setMode("initial"); setSelected("");}}>重新试下</button>
   {hint && <p>原局面提示：气是紧邻的空点。白 aa 仅邻 ba 与 ab；ba 为黑，唯一气是 ab。标记：红框目标，蓝框气。</p>}
   <p aria-live="polite">{feedback}</p>
   <div className="board" aria-label="教学试下棋盘">
    {frame.board.map((stone, i) => {
     const point = String.fromCharCode(97 + i % 19) + String.fromCharCode(97 + Math.floor(i / 19));
     return <button key={i} title={point} data-coordinate={point} data-mark={answer && analysis?.evidence.some(e => e.move === selected && e.target === point) ? "目标" : answer && point === selected ? "推荐" : hint && !trial ? (point === "aa" ? "目标" : point === "ab" ? "气" : undefined) : undefined} className={"point " + (stone ?? "")} aria-label={point + " " + (stone === "B" ? "黑" : stone === "W" ? "白" : "空")} onClick={() => play(point, "trial")}>{stone ? "●" : "+"}</button>;
    })}
   </div>
  </>}
 </section>;
}

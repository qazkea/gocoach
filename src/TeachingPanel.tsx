import {GoBoard} from "./GoBoard";
import {useEffect, useState} from "react";
import {VariationPanel} from "./VariationPanel";
import {matchExample, analyze, attempt, evidenceText, goalText, hintText, targetPoints, libertyPoints, type Lesson, type Selection} from "./teaching";
import {type Frame, type Replay} from "./replay";
type TeachingMode = "initial" | "trial" | "actual" | "teaching" | "engine";
const modeLabels: Record<TeachingMode, string> = {
 initial: "先试下一手",
 trial: "一手试下结果（不继续行棋）",
 actual: "实战落子",
 teaching: "本课教学推荐",
 engine: "模拟引擎首选",
};
type AnalysisState = {status:"loading"} | {status:"ready"; selection:Selection} | {status:"error"; message:string};
export function Course({game, step, onStep}: {game: Replay; step: number; onStep: (step:number) => void}) {
 const example = matchExample(game);
 const [state, setState] = useState<AnalysisState>({status:"loading"});
 const result = state.status === "ready" ? state.selection : undefined;
 const message = state.status === "loading" ? "分析中…" : state.status === "error" ? state.message : `精选 ${state.selection.lessons.length} 个。${state.selection.notice}`;
 const [index, setIndex] = useState(0);
 const [request, setRequest] = useState(0);
 const [opened, setOpened] = useState(false);
 useEffect(() => {
  if (!example) return;
  let active = true;
  setState({status:"loading"});
  analyze(game, example).then(value => {if (active) {setIndex(0); setState({status:"ready",selection:value});}}, error => {if (active) setState({status:"error",message:error.message});});
  return () => {active = false;};
 }, [game, request]);
 useEffect(() => {
  // Honor an entry made while loading, but never pull a user back from replay.
  if (opened && step === example?.step && result?.lessons[0]) onStep(result.lessons[0].step);
 }, [result]);
 if (!example) return <p>当前没有对应示例分析；仍可回放。</p>;
 const current = result?.lessons[index];
 const visible = opened && step === (current?.step ?? example.step);
 return <section aria-label="教学精选">
  <p>每盘目标 1–3 个，约 10–15 分钟；不是保证，不凑数量。</p>
  <p aria-live="polite">{message}</p>
  {!visible && state.status === "error" && <button onClick={() => setRequest(n=>n+1)}>重试分析</button>}
  {(!result || current) && <button onClick={() => {if (opened && !visible && !result) setRequest(n => n + 1); setOpened(true); onStep(current?.step ?? example.step);}}>进入核验教学局面</button>}
  {result && result.lessons.length > 1 && <nav aria-label="精选导航"><span>第 {index + 1} / {result.lessons.length} 个精选</span><button disabled={index === 0} onClick={() => {setIndex(index-1); setOpened(true); onStep(result.lessons[index-1].step);}}>上一个精选</button><button disabled={index === result.lessons.length-1} onClick={() => {setIndex(index+1); setOpened(true); onStep(result.lessons[index+1].step);}}>下一个精选</button></nav>}
  {visible && (current ? <Teaching key={request + ':' + index + ':' + step} game={game} analysis={current} /> : <section aria-label="局面教学"><p>{message}</p>{state.status === "error" && <button onClick={() => setRequest(n => n + 1)}>重试分析</button>}</section>)}
 </section>;
}
function Teaching({game, analysis}: {game: Replay; analysis: Lesson}) {
 const example = analysis;
 const [exploring, setExploring] = useState(false);
 const [trial, setTrial] = useState<Frame>();
 const [feedback, setFeedback] = useState("");
 const [hint, setHint] = useState(false);
 const [answer, setAnswer] = useState(false);
 const [mode, setMode] = useState<TeachingMode>("initial");
 const [selected, setSelected] = useState("");
 const frame = trial ?? game.frames[example.step];
 function play(point: string, mode: Exclude<TeachingMode, "initial">) {
  try {
   const result = attempt(game, analysis, point);
   setTrial(result.frame); setFeedback(result.feedback); setMode(mode); setSelected(point);
   setAnswer(mode !== "trial");
  }
  catch(error) {setFeedback(error instanceof Error ? error.message : "试下失败");}
 }
 if (exploring) return <VariationPanel game={game} example={example} onExit={() => {setExploring(false); setTrial(game.frames[example.step + 1]); setMode("actual"); setAnswer(false); setHint(false); setFeedback("");}} />;
 return <section aria-label="局面教学">
  <h2>局面教学</h2>
  <p>示例分析：预设数据，非真实引擎或在线AI</p>
  <p>来源：自制合成样例 {example.id === "corner-a" ? "A" : example.id === "corners-b" ? "B" : "C/D"}，非野狐对局。手工核验原目标、气和有限落子证据；不推导全局优劣。</p>
  <p aria-live="polite">准备就绪</p>
   <p>第 {example.step} 手后，轮{game.frames[example.step].nextPlayer === "B" ? "黑" : "白"}；模式：{modeLabels[mode]}</p>
   <p>每次点击都从原局面重新试一手，不在结果盘继续行棋。坐标 aa 左上、ss 右下，先列后行。</p>
   <p>目标：{goalText(analysis)}。黑提子：{frame.blackCaptures}；白提子：{frame.whiteCaptures}</p>
   <button onClick={() => setExploring(true)}>探索连续变化</button>
   <button onClick={() => setHint(true)}>请求提示</button>
   <button onClick={() => {setAnswer(true); play(analysis!.teaching, "teaching");}}>直接看答案</button>
   {answer && <div>
    <p>实战落子：{game.frames[example.step + 1].move.slice(2)}；本课教学推荐：{analysis!.teaching}；模拟引擎首选：{analysis!.engine}</p>
    <p>{analysis!.teaching === analysis!.engine ? "两类推荐相同。" : `两类推荐不同：预设排序不证明 ${analysis.engine} 全局更优，也未证明 ${analysis.teaching} 更简单。`}</p>
    <p>{evidenceText(analysis, selected)}</p>
    <p>红框：证据目标（提子后为空）；绿框：推荐落点。比较均从原局面开始，不是连续变化。</p>
    <button onClick={() => play(game.frames[example.step + 1].move.slice(2), "actual")}>查看实战落子</button>
    <button onClick={() => play(analysis!.teaching, "teaching")}>查看本课教学推荐</button>
    <button onClick={() => play(analysis!.engine, "engine")}>查看模拟引擎首选</button>
   </div>}
   <button onClick={() => {setTrial(undefined); setFeedback(""); setAnswer(false); setMode("initial"); setSelected("");}}>重新试下</button>
   {hint && <p>原局面提示：{hintText(analysis)}标记：红框目标，蓝框气。</p>}
   <p aria-live="polite">{feedback}</p>
   <GoBoard frame={frame} label="教学试下棋盘" previewPlayer={game.frames[example.step].nextPlayer} onPlay={point => play(point, "trial")} mark={point => answer && analysis.evidence.some(e => e.move === selected && e.targets.some(t => t.stones.includes(point))) ? "目标" : answer && point === selected ? "推荐" : hint && !trial ? (targetPoints(analysis).includes(point) ? "目标" : libertyPoints(analysis).includes(point) ? "气" : undefined) : undefined} />
 </section>;
}

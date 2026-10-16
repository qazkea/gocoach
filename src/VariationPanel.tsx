import {useEffect, useState} from "react";
import {analyzeVariation, type VariationAnalysis} from "./variationAnalysis";
type AnalysisState = VariationAnalysis | {kind:"loading"} | {kind:"error"; message:string};
import {type Replay} from "./replay";
import {type Example} from "./teaching";
import {extendVariation, seekVariation, startVariation, type Variation} from "./variation";

export function VariationPanel({game, example, onExit}: {game: Replay; example: Example; onExit: () => void}) {
 const [current, setCurrent] = useState(() => startVariation(game, example.step));
 const [error, setError] = useState("");
 const [retry, setRetry] = useState(0);
 const [analysis, setAnalysis] = useState<AnalysisState>({kind:"loading"});
 useEffect(() => {
  let active = true;
  setAnalysis({kind:"loading"});
  analyzeVariation(game, example, current).then(result => {if (active) setAnalysis(result);}, cause => {if (active) setAnalysis({kind:"error", message:cause.message});});
  return () => {active = false;};
 }, [game, example.id, example.step, current, retry]);
 function change(next: Variation) {
  setAnalysis({kind:"loading"}); setCurrent(next); setError("");
 }
 const frame = current.replay.frames[current.cursor];
 function play(point: string) {
  try {change(extendVariation(current, point));}
  catch (cause) {setError(cause instanceof Error ? cause.message : "试下失败");}
 }
 return <section aria-label="变化探索">
  <h2>变化探索</h2>
  <p>假设变化，不代表实战必然发生</p>
  <p>预设局部证据，非真实引擎或在线AI。不展示估值：无真实胜率或目差；后续数值统一黑方视角。</p>
  <p>规则：{game.rules}；贴目：{game.komi}；原局第 {current.origin} 手后开始；完整已知历史保留。</p>
  <p aria-live="polite">{analysis.kind === "loading" ? "变化分析中…" : analysis.kind === "error" ? analysis.message : analysis.kind === "missing" ? "该分支暂无已核验示例分析" : analysis.text}</p>
  <p>变化 {current.cursor - current.origin} 手；轮{frame.nextPlayer === "B" ? "黑" : "白"}；最近落子：{frame.move}</p>
  <p>黑提子：{frame.blackCaptures}；白提子：{frame.whiteCaptures}</p>
  {analysis.kind === "error" && <button onClick={() => {setAnalysis({kind:"loading"}); setRetry(n => n + 1);}}>重试当前变化</button>}
  <button onClick={() => play("")}>Pass</button>
  <button disabled={current.cursor === current.origin} onClick={() => {change(seekVariation(current, current.cursor - 1));}}>撤回一手</button>
  <button disabled={current.cursor === current.replay.frames.length - 1} onClick={() => {change(seekVariation(current, current.cursor + 1));}}>重走一手</button>
  <button onClick={() => {change(seekVariation(current, current.origin));}}>回到变化起点</button>
  <button onClick={onExit}>切回实战</button>
  {error && <p role="alert">{error}</p>}
  <div className="board" aria-label="变化棋盘">
   {frame.board.map((stone, i) => {
    const point = String.fromCharCode(97 + i % 19) + String.fromCharCode(97 + Math.floor(i / 19));
    return <button key={i} data-mark={analysis.kind === "ready" ? analysis.targets.includes(point) ? "目标" : analysis.liberties.includes(point) ? "气" : undefined : undefined} className={"point " + (stone ?? "")} aria-label={point + " " + (stone === "B" ? "黑" : stone === "W" ? "白" : "空")} onClick={() => play(point)}>{stone ? "●" : "+"}</button>;
   })}
  </div>
 </section>;
}

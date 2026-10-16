import {groupAt, type Replay} from "./replay";
import {matchExample, type Example} from "./teaching";
import {type Variation} from "./variation";

export type VariationAnalysis = {kind:"ready"; text:string; targets:string[]; liberties:string[]} | {kind:"missing"};
const sequences: Record<string, string> = {
 "":"start", "B dd":"dd", "B dd,W ab":"dd-ab", "B dd,W ss":"dd-ss", "B dd,W ss,B ab":"dd-ss-ab", "B ab":"ab",
};
function object(value: unknown): value is Record<string, unknown> {
 return !!value && typeof value === "object" && !Array.isArray(value);
}
function points(value: unknown, expected: string[]): boolean {
 return Array.isArray(value) && value.length === expected.length && new Set(value).size === value.length && expected.every(p => value.includes(p));
}
// Public resource IDs encode only independently verified synthetic sequences.
// The exact original game match binds setup, turns, full original history and rules.
export async function analyzeVariation(game: Replay, example: Example, current: Variation): Promise<VariationAnalysis> {
 const matched = matchExample(game);
 if (!matched || matched.id !== example.id || !Number.isInteger(example.step) || example.step < 0 || example.step + 1 >= game.frames.length || (example.id === "corner-a" && matched.step !== example.step) || current.origin !== example.step) throw Error("局面身份不符");
 const sequence = current.replay.frames.slice(current.origin + 1, current.cursor + 1).map(f => f.move);
 const id = sequences[sequence.join(",")];
 if (example.id !== "corner-a" || !id) return {kind:"missing"};
 let response: Response;
 try {
  response = await fetch(`/analysis/variations/${example.id}/${id}.json`);
  if (!response.ok) throw Error();
 } catch {throw Error("变化分析失败，当前棋盘保留，可重试。");}
 try {
  const data: unknown = await response.json();
  if (!object(data) || !object(data.context) || !object(data.evidence)) throw Error();
  const context = data.context;
  if (context.example !== matched.id || context.origin !== current.origin || context.rules !== game.rules || context.komi !== Number(game.komi) || !Array.isArray(context.sequence) || JSON.stringify(context.sequence) !== JSON.stringify(sequence)) throw Error();
  const frame = current.replay.frames[current.cursor];
  const e = data.evidence;
  if (id === "ab" || id === "dd-ss-ab") {
   const before = current.replay.frames[current.cursor - 1];
   const target = groupAt(before, "aa");
   const captured = before.board.flatMap((stone, i) => stone === "W" && frame.board[i] === null ? [String.fromCharCode(97 + i % 19) + String.fromCharCode(97 + Math.floor(i / 19))] : []);
   if (e.kind !== "capture" || e.move !== "ab" || !points(e.captured, ["aa"]) || !points(captured, ["aa"]) || target.color !== "W" || !points(target.stones, ["aa"]) || !points(target.liberties, ["ab"]) || frame.board[19] !== "B" || frame.blackCaptures !== before.blackCaptures + 1) throw Error();
   return {kind:"ready", text:"黑 ab 提走白 aa 一子；这是当前假设变化的局部结果，不是必然实战。", targets:["aa"], liberties:[]};
  }
  const stones = id === "dd-ab" ? ["aa", "ab"] : ["aa"];
  const liberties = id === "dd-ab" ? ["bb", "ac"] : ["ab"];
  const group = groupAt(frame, "aa");
  if (e.kind !== "chain" || e.color !== "W" || !points(e.stones, stones) || !points(e.liberties, liberties) || group.color !== "W" || !points(group.stones, stones) || !points(group.liberties, liberties)) throw Error();
  return {kind:"ready", text:id === "dd-ab" ? "白 aa、ab 当前两气 bb、ac；仅描述当前棋链，不判定全局活棋。" : "白 aa 当前唯一气 ab；仅描述当前棋链，不判断全局优劣。", targets:stones, liberties};
 } catch {throw Error("证据不足或变化身份不符，分析未完成。");}
}

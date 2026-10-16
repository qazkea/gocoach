import {groupAt, tryMove, type Frame, type Replay} from "./replay";

export interface Example {id: string; step: number}
export interface Evidence {move: string; target: string; liberties: string[]; captured: string[]}
export interface Analysis {teaching: string; engine: string; evidence: Evidence[]}

export function matchExample(game: Replay): Example | undefined {
 if (game.rules !== "Chinese" || Number(game.komi) !== 7.5 || !["未记录", "0"].includes(game.handicap) || game.frames[0].nextPlayer !== "B" || game.frames[0].board.some(Boolean)) return;
 const moves = game.frames.slice(1).map(f => f.move).join(",");
 if (moves === "B ba,W aa,B sr,W ss,B ab,W cc,B rs,W pass") return {id:"corners-b",step:4};
 if (moves === "B ba,W aa,B ab,W ss") return {id:"corner-a",step:2};
}

// Only a public example ID leaves the browser, never the uploaded record.
export async function analyze(game: Replay, example: Example): Promise<Analysis> {
 let response: Response;
 try {
  response = await fetch("/analysis/" + example.id + ".json");
  if (!response.ok) throw Error();
 } catch {throw Error("分析失败，未完成教学；可离开局面后重新进入重试。");}
 try {
  const data: unknown = await response.json();
  return validate(game, example, data);
 } catch {throw Error("证据不足或局面不符，教学未完成，不提供答案。");}
}
function record(value: unknown): value is Record<string, unknown> {
 return !!value && typeof value === "object" && !Array.isArray(value);
}
function samePoints(value: unknown, expected: string[]): value is string[] {
 return Array.isArray(value) && value.length === expected.length && new Set(value).size === value.length && expected.every(p => value.includes(p));
}
function validate(game: Replay, example: Example, data: unknown): Analysis {
 const matched = matchExample(game);
 if (!matched || matched.id !== example.id || matched.step !== example.step || !record(data) || data.position !== example.id) throw Error();
 // This course supports these two hand-verified local choices only, not arbitrary claims.
 const expectedEngine = example.id === "corner-a" ? "ab" : "rs";
 if (data.teaching !== "ab" || data.engine !== expectedEngine || !Array.isArray(data.evidence)) throw Error();
 const moves = [...new Set(["ab", expectedEngine])];
 if (data.evidence.length !== moves.length) throw Error();
 const before = game.frames[example.step];
 const evidence: Evidence[] = [];
 for (const move of moves) {
  const entries = data.evidence.filter(e => record(e) && e.move === move);
  if (entries.length !== 1) throw Error();
  const entry: unknown = entries[0];
  const target = move === "ab" ? "aa" : "ss";
  if (!record(entry) || entry.target !== target) throw Error();
  const group = groupAt(before, target);
  if (group.color !== "W" || !samePoints(group.stones, [target]) || !samePoints(group.liberties, [move]) || !samePoints(entry.liberties, group.liberties)) throw Error();
  const after = tryMove(game, example.step, move);
  const captured = before.board.flatMap((stone, i) => stone === "W" && after.board[i] === null
   ? [String.fromCharCode(97 + i % 19) + String.fromCharCode(97 + Math.floor(i / 19))] : []);
  if (!samePoints(captured, [target]) || !samePoints(entry.captured, captured) || after.blackCaptures !== before.blackCaptures + 1) throw Error();
  evidence.push({move,target,liberties:[...group.liberties],captured});
 }
 return {teaching:"ab",engine:expectedEngine,evidence};
}
export function evidenceText(analysis: Analysis, move: string): string {
 const e = analysis.evidence.find(e => e.move === move);
 if (!e) return "";
 return `白 ${e.target} 唯一气 ${e.liberties.join("、")}；黑 ${e.move} 后提走白 ${e.captured.join("、")} 一子。`;
}
export function attempt(game: Replay, step: number, point: string): {frame: Frame; feedback: string} {
 const frame = tryMove(game, step, point);
 const feedback = frame.board[0] === null
  ? "达到本课目标：提走白 aa 一子。这不代表已掌握或全局最优。"
  : (point === "rs" && game.frames[step].board[360] === "W" ? "提走白 ss 一子；" : "") + "白 aa 仍保留 ab 这口气；这不等于全局坏棋。";
 return {frame,feedback};
}

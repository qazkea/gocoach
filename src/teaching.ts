import {IllegalMoveError, groupAt, tryMove, type Frame, type Replay} from "./replay";

export interface Example {id: string; step: number}
type Kind = "capture" | "rescue" | "connect" | "force";
type Target = {stones:string[]; liberties:string[]; neighbors:string[]};
export interface Evidence {move:string; targets:Target[]; captured:string[]; afterLiberties:string[]; color:"B"|"W"; third?:string}
export interface Lesson extends Example {lessonId:string; kind:Kind; teaching:string; engine:string; evidence:Evidence[]}
export interface Selection {lessons:Lesson[]; notice:string}
const sources = [
 {id:"force-d",step:0,black:["ca","bb","ac"],white:["aa"],player:"B",moves:"B ba,W ss,B ab,W rr"},
 {id:"corner-a",step:2,black:[],white:[],player:"B",moves:"B ba,W aa,B ab,W ss"},
 {id:"corners-b",step:4,black:[],white:[],player:"B",moves:"B ba,W aa,B sr,W ss,B ab,W cc,B rs,W pass"},
 {id:"mixed-c",step:0,black:["ba","gh","gj","lm","nm","ml","qs","rr","sq"],white:["aa","mm","ss"],player:"W",moves:"W ab,B gi,W dd,B mn,W ee,B rs,W ff,B sr,W pp"},
];
const coord = (i:number) => String.fromCharCode(97+i%19)+String.fromCharCode(97+Math.floor(i/19));
const colorName = (color:string) => color === "B" ? "黑" : "白";
function stones(frame:Frame, color:"B"|"W") {return frame.board.flatMap((s,i) => s === color ? [coord(i)] : []);}
function record(value:unknown): value is Record<string,unknown> {return !!value && typeof value === "object" && !Array.isArray(value);}
function same(value:unknown, expected:string[]): value is string[] {return Array.isArray(value) && value.length === expected.length && new Set(value).size === value.length && expected.every(p => value.includes(p));}
export function matchExample(game:Replay): Example|undefined {
 if (game.rules !== "Chinese" || Number(game.komi) !== 7.5 || !["未记录","0"].includes(game.handicap)) return;
 const source = sources.find(s => s.player === game.frames[0].nextPlayer && same(stones(game.frames[0],"B"),s.black) && same(stones(game.frames[0],"W"),s.white) && game.frames.slice(1).map(f=>f.move).join(",") === s.moves);
 return source && {id:source.id,step:source.step};
}
function contextMatches(game:Replay, id:string, c:unknown) {
 return record(c) && c.source === id && c.rules === game.rules && c.komi === Number(game.komi) && c.handicap === Number(game.handicap === "未记录" ? 0 : game.handicap) && c.initialPlayer === game.frames[0].nextPlayer && same(c.black,stones(game.frames[0],"B")) && same(c.white,stones(game.frames[0],"W")) && JSON.stringify(c.moves) === JSON.stringify(game.frames.slice(1).map(f=>f.move));
}
// Legacy A/B resources are normalized into the same candidate/evidence pipeline.
function legacy(example:Example, data:Record<string,unknown>) {
 if (!["corner-a","corners-b"].includes(example.id)) throw Error();
 const engine = example.id === "corner-a" ? "ab" : "rs";
 if (data.position !== example.id || data.teaching !== "ab" || data.engine !== engine || !Array.isArray(data.evidence)) throw Error();
 const moves = [...new Set(["ab",engine])];
 if (data.evidence.length !== moves.length) throw Error();
 return {id:example.id,step:example.step,player:"B",kind:"capture",teaching:"ab",engine,evidence:moves.map(move => {
  const e = (data.evidence as unknown[]).find(e => record(e) && e.move === move);
  const target = move === "ab" ? "aa" : "ss";
  if (!record(e) || e.target !== target) throw Error();
  return {move,targets:[{stones:[target],liberties:e.liberties}],captured:e.captured};
 })};
}
// Only a matched public source ID leaves the browser, never record contents.
export async function analyze(game:Replay, example:Example): Promise<Selection> {
 if (matchExample(game)?.id !== example.id) throw Error("局面身份不符");
 let response:Response;
 try {response = await fetch(`/analysis/${example.id}.json`); if (!response.ok) throw Error();}
 catch {throw Error("分析失败，未完成教学；可重试分析。");}
 let candidates:unknown[];
 try {
  const data:unknown = await response.json();
  if (!record(data)) throw Error();
  if ("candidates" in data) {
   if (!contextMatches(game,example.id,data.context) || !Array.isArray(data.candidates)) throw Error();
   candidates = data.candidates;
  } else candidates = [legacy(example,data)];
 } catch {throw Error("证据不足或局面不符，教学未完成，不提供答案。");}
 if (candidates.length > 32) return {lessons:[],notice:"候选超过32条上限，拒绝本次分析；仍可回放。"};
 const lessons:Lesson[] = [];
 const budget = {remaining:4096};
 const notices = new Set<string>();
 for (const candidate of candidates) {
  try {lessons.push(validate(game,example.id,candidate,budget));}
  catch (cause) {if (cause instanceof IncompleteProof) notices.add(cause.message);}
 }
 const complexity = (lesson:Lesson) => [lesson.kind === "force" ? 3 : 1, ...targetSize(lesson.evidence)];
 lessons.sort((a,b) => {
  const x=complexity(a), y=complexity(b);
  return x[0]-y[0] || x[1]-y[1] || x[2]-y[2] || a.step-b.step || a.lessonId.localeCompare(b.lessonId);
 });
 const seen = new Set<string>();
 const selected = lessons.filter(lesson => {
  const key = lesson.step + ':' + targetPoints(lesson).sort().join(',');
  if (seen.has(key)) return false;
  seen.add(key); return true;
 }).slice(0,3);
 return {lessons:selected,notice:[...notices].join(' ') + (!candidates.length ? "没有合适局面：候选为空；仍可回放。" : !lessons.length ? "证据不足或超出支持范围，没有适合局面；仍可回放。" : "")};
}
class IncompleteProof extends Error {}
function targetSize(evidence:Evidence[]) {
 const chains = new Set(evidence.flatMap(e=>e.targets.map(t=>[...t.stones].sort().join(','))));
 const stones = new Set(evidence.flatMap(e=>e.targets.flatMap(t=>t.stones)));
 return [chains.size,stones.size];
}
function prove(game:Replay, step:number, first:Frame, third:string, target:string[], enemy:"B"|"W", budget:{remaining:number}) {
 const prefix = game.frames.slice(0,step+1);
 const firstGame = {...game,frames:[...prefix,first]};
 const move = (replay:Replay, point:string) => {
  if (budget.remaining-- <= 0) throw new IncompleteProof("4096次落子验证预算耗尽，部分候选未完整核验。");
  try {return tryMove(replay,replay.frames.length-1,point);}
  catch (cause) {
   if (cause instanceof IllegalMoveError) throw cause;
   throw new IncompleteProof("遇到未支持规则或未知循环，无法完整核验，保留结论。");
  }
 };
 for (const point of [...first.board.flatMap((s,i)=>s === null ? [coord(i)] : []),""]) {
  let reply:Frame;
  try {reply = move(firstGame,point);} catch (cause) {if (cause instanceof IllegalMoveError) continue; throw cause;}
  const final = move({...game,frames:[...prefix,first,reply]},third);
  if (target.some(p=>groupAt(final,p).color === enemy)) throw Error();
 }
}
function validate(game:Replay, source:string, data:unknown, budget:{remaining:number}): Lesson {
 if (record(data) && !["capture","rescue","connect","force"].includes(String(data.kind))) throw new IncompleteProof("不支持的教学类别，超出有限范围，保留结论。");
 if (!record(data) || typeof data.id !== "string" || !Number.isInteger(data.step) || typeof data.step !== "number" || data.step < 0 || data.step + 1 >= game.frames.length || typeof data.teaching !== "string" || typeof data.engine !== "string" || !Array.isArray(data.evidence) || !["capture","rescue","connect","force"].includes(String(data.kind))) throw Error();
 const before = game.frames[data.step];
 if (data.player !== before.nextPlayer) throw Error();
 const kind = data.kind as Kind;
 const moves = [...new Set([data.teaching,data.engine])];
 if (data.evidence.length !== moves.length) throw Error();
 const evidence:Evidence[] = moves.map(move => {
  const entries = (data.evidence as unknown[]).filter(e => record(e) && e.move === move);
  const entry = entries[0];
  if (entries.length !== 1 || !record(entry) || !Array.isArray(entry.targets)) throw Error();
  if (entry.targets.length > 2 || entry.targets.reduce((n,t)=>n + (record(t) && Array.isArray(t.stones) ? t.stones.length : 0),0) > 6) throw new IncompleteProof("超出有限范围：每题最多2链/6子，拒绝该候选。");
  if (entry.targets.length !== (kind === "connect" ? 2 : 1)) throw Error();
  const targets = entry.targets.map(t => {
   if (!record(t) || !Array.isArray(t.stones) || typeof t.stones[0] !== "string") throw Error();
   const actual = groupAt(before,t.stones[0]);
   if (!actual.color || !same(t.stones,actual.stones) || !same(t.liberties,actual.liberties)) throw Error();
   if ((kind === "rescue" || kind === "connect") !== (actual.color === before.nextPlayer)) throw Error();
   return {stones:actual.stones,liberties:actual.liberties,neighbors:actual.neighbors};
  });
  const originalStones = targets.flatMap(t=>t.stones);
  if (originalStones.length > 6 || new Set(originalStones).size !== originalStones.length || ((kind === "rescue" || kind === "capture") && targets[0].liberties.length !== 1)) throw Error();
  if (kind === "force" && budget.remaining-- <= 0) throw new IncompleteProof("4096次落子验证预算耗尽，部分候选未完整核验。");
  const after = tryMove(game,data.step as number,move);
  const enemy = before.nextPlayer === "B" ? "W" : "B";
  const captured = stones(before,enemy).filter(p => !stones(after,enemy).includes(p));
  if ((kind !== "force" && !same(entry.captured,captured)) || (before.nextPlayer === "B" ? after.blackCaptures-before.blackCaptures : after.whiteCaptures-before.whiteCaptures) !== captured.length) throw Error();
  let afterLiberties:string[] = [];
  if (kind === "capture") {if (!same(captured,targets[0].stones)) throw Error();}
  else if (kind === "force") {
   if (typeof entry.third !== "string" || !/^[a-s]{2}$/.test(entry.third) || captured.length || !same(entry.captured,originalStones)) throw Error();
   prove(game,data.step as number,after,entry.third,originalStones,enemy,budget);
  } else {
   const group = groupAt(after,targets[0].stones[0]);
   if (group.color !== before.nextPlayer || !originalStones.every(p=>group.stones.includes(p)) || group.liberties.length < 2 || !same(entry.afterLiberties,group.liberties)) throw Error();
   afterLiberties = group.liberties;
  }
  return {move,targets,captured:kind === "force" ? originalStones : captured,afterLiberties,color:kind === "rescue" || kind === "connect" ? before.nextPlayer : enemy,third:typeof entry.third === "string" ? entry.third : undefined};
 });
 const [chainCount,stoneCount] = targetSize(evidence);
 if (chainCount > 2 || stoneCount > 6) throw new IncompleteProof("超出有限范围：每题最多2链/6子，拒绝该候选。");
 return {id:source,step:data.step,lessonId:data.id,kind,teaching:data.teaching,engine:data.engine,evidence};
}
export function targetPoints(lesson:Lesson,move=lesson.teaching) {return lesson.evidence.find(e=>e.move === move)!.targets.flatMap(t=>t.stones);}
export function libertyPoints(lesson:Lesson) {return lesson.evidence[0].targets.flatMap(t=>t.liberties);}
export function goalText(lesson:Lesson) {
 const e = lesson.evidence[0];
 return `${lesson.kind === "force" ? "简单死活有限子类：三手内强制提净" : lesson.kind === "capture" ? "吃子：提走" : lesson.kind === "connect" ? "连接：连通两条己链，至少两气，目标" : "危险棋子：解除当前一气，保护"}${colorName(e.color)} ${targetPoints(lesson).join("、")}`;
}
export function hintText(lesson:Lesson) {
 return `气是紧邻的空点。${colorName(lesson.evidence[0].color)} ${targetPoints(lesson).join("、")} 当前气 ${libertyPoints(lesson).join("、")}；原目标外邻 ${lesson.evidence[0].targets.flatMap(t=>t.neighbors).join("、")}。`;
}
export function evidenceText(lesson:Lesson,move:string) {
 const e = lesson.evidence.find(e=>e.move === move);
 if (!e) return "";
 if (lesson.kind === "force") return `已核验首手 ${move} 后所有全盘合法应手及pass，固定第三手 ${e.third} 均提净原目标 ${e.captured.join("、")}；这是有限强制提子，不是通用死活证明。首手盘尚未提净，不把单条PV当必然。`;
 return lesson.kind === "capture" ? `${colorName(e.color)} ${e.targets.flatMap(t=>t.stones).join("、")} 唯一气 ${e.targets.flatMap(t=>t.liberties).join("、")}；${colorName(e.color === "B" ? "W":"B")} ${move} 后提走${colorName(e.color)} ${e.captured.join("、")} ${e.captured.length === 1 ? "一" : e.captured.length}子。原目标外邻 ${e.targets.flatMap(t=>t.neighbors).join("、")}。` : `${lesson.kind === "connect" ? "两条己链已连通" : "解除当前一气"}；当前棋链${e.afterLiberties.length === 8 ? "八气" : e.afterLiberties.length + "气"} ${e.afterLiberties.join("、")}，不判定活棋或永远安全。`;
}
export function attempt(game:Replay, lesson:Lesson, point:string): {frame:Frame;feedback:string} {
 const frame = tryMove(game,lesson.step,point === "pass" ? "" : point);
 const targets = targetPoints(lesson);
 const group = groupAt(frame,targets[0]);
 const reached = lesson.kind === "force" ? false : lesson.kind === "capture" ? targets.every(p=>groupAt(frame,p).color !== lesson.evidence[0].color) : group.color === lesson.evidence[0].color && targets.every(p=>group.stones.includes(p)) && group.liberties.length >= 2;
 if (lesson.kind === "force") return {frame,feedback:lesson.evidence.some(e=>e.move === point) ? "这是已核验强制提子的首手，尚未提净；查看答案核对全部合法应手与第三手。" : "这手没有对应强制提子证明，保留结论。"};
 return {frame,feedback:reached ? `达到本课目标：${goalText(lesson)}。这不代表已掌握或全局最优。` : `${colorName(lesson.evidence[0].color)} ${targets.join("、")} 仍保留 ${group.liberties.join("、")} 这口气；未达到本课目标，这不等于全局坏棋。`};
}

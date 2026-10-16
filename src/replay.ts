export const MAX_FILE_BYTES = 1024 * 1024;
const MAX_NODES = 2000;
export type Stone = "B" | "W" | null;
export interface Frame {
 board: Stone[];
 move: string;
 blackCaptures: number;
 whiteCaptures: number;
}
export interface Replay {
 frames: Frame[];
 rules: string;
 komi: string;
 result: string;
 black: string;
 white: string;
 encoding: string;
 handicap: string;
}
type Node = Record<string, string[]>;

// Strict single-sequence reader: never repairs syntax or discards a second tree.
function parse(text: string): Node[] {
 let i = 0;
 const whitespace = () => {
  while (i < text.length && /\s/.test(text[i])) i++;
 };
 const take = (c: string) => {
  whitespace();
  if (text[i++] !== c) throw Error("SGF 语法不完整");
 };
 take("(");
 const nodes: Node[] = [];
 whitespace();
 while (text[i] === ";") {
  i++;
  const node: Node = {};
  whitespace();
  while (i < text.length && /[A-Z]/.test(text[i])) {
   let key = "";
   while (i < text.length && /[A-Z]/.test(text[i])) key += text[i++];
   if (Object.hasOwn(node, key)) throw Error("重复 SGF 属性");
   const values: string[] = [];
   whitespace();
   while (text[i] === "[") {
    i++;
    let value = "";
    while (i < text.length && text[i] !== "]") {
     let c = text[i++];
     if (c === "\\") {
      if (i === text.length) throw Error("SGF 转义不完整");
      if (["B", "W", "AB", "AW", "AE", "PL", "HA", "KM", "FF", "GM", "SZ", "ST", "TM"].includes(key)) {
       throw Error(`属性 ${key} 不支持文本转义`);
      }
      c = text[i++];
      if (key === "AP" && c === ":") throw Error("暂不支持 AP 字段内冒号");
      if (c === "\r" || c === "\n") {
       if ((c === "\r" && text[i] === "\n") || (c === "\n" && text[i] === "\r")) i++;
       continue;
      }
     }
     value += c;
    }
    if (text[i++] !== "]") throw Error("SGF 属性未闭合");
    values.push(value);
    whitespace();
   }
   if (!values.length) throw Error("SGF 属性缺值");
   node[key] = values;
  }
  nodes.push(node);
  if (nodes.length > MAX_NODES) throw Error("最多支持 2000 个节点（含注释/setup）");
  whitespace();
 }
 if (!nodes.length) throw Error("没有棋谱节点");
 if (text[i] === "(") throw Error("暂不支持分支棋谱，请导出单线实战");
 take(")");
 whitespace();
 if (i !== text.length) throw Error("暂不支持多谱或尾随内容");
 return nodes;
}
function neighbors(p: number): number[] {
 return [p % 19 > 0 ? p - 1 : -1, p % 19 < 18 ? p + 1 : -1, p >= 19 ? p - 19 : -1, p < 342 ? p + 19 : -1].filter(n => n >= 0);
}
function chain(board: Stone[], start: number) {
 const stones = new Set<number>([start]);
 let hasLiberty = false;
 for (const p of stones) {
  for (const n of neighbors(p)) {
   if (board[n] === null) hasLiberty = true;
   else if (board[n] === board[start]) stones.add(n);
  }
 }
 return {stones, hasLiberty};
}
export function importReplay(bytes: ArrayBuffer): Replay {
 if (bytes.byteLength > MAX_FILE_BYTES) throw Error("文件超过 1 MiB 上限");
 // Decode each supported candidate BEFORE SGF escape parsing. Accept only the
 // candidate selected by its own root CA; absent CA selects true Latin1 only.
 // This avoids interpreting a GBK trail byte 0x5c as an SGF backslash.
 let nodes: Node[] | undefined;
 let encoding = "";
 let failure = "不支持的字符编码或编码与文件字节不符";
 for (const candidate of ["ISO-8859-1", "UTF-8", "GBK"]) {
  try {
   const text = candidate === "ISO-8859-1"
    ? Array.from(new Uint8Array(bytes), b => String.fromCharCode(b)).join("")
    : new TextDecoder(candidate, {fatal: true}).decode(bytes);
   const parsed = parse(text);
   const declared = parsed[0].CA?.[0] ?? "ISO-8859-1";
   const normalized = declared.toUpperCase() === "LATIN1" ? "ISO-8859-1" : declared.toUpperCase();
   if (normalized === candidate) {
    nodes = parsed;
    encoding = declared;
    break;
   }
  } catch (cause) {
   if (cause instanceof Error) failure = "编码或 SGF 错误：" + cause.message;
  }
 }
 if (!nodes) throw Error(failure);
 const root = nodes[0];
 if (root.FF?.[0] !== "4") throw Error("仅支持明确 FF[4] 的 SGF");
 if (root.GM && root.GM[0] !== "1") throw Error("仅支持围棋 GM[1]");
 if (root.SZ && root.SZ[0] !== "19") throw Error("仅支持 19 路棋盘");
 if (root.ST && !/^[0-3]$/.test(root.ST[0])) throw Error("ST 必须为 0—3");
 if (root.AP && !/^[^:]+:[^:]*$/.test(root.AP[0])) throw Error("AP 需为 应用名:版本；暂不支持字段内冒号");
 const infoKeys = new Set("RU KM HA RE PB PW BR WR BT WT GN GC DT EV RO PC SO US AN ON TM OT".split(" "));
 const infoNodes = nodes.filter(n => Object.keys(n).some(k => infoKeys.has(k)));
 if (infoNodes.length > 1) throw Error("同一路径出现多个棋局信息节点");
 const info = infoNodes[0];
 if (!info?.RU?.[0] || !info?.KM?.[0]) throw Error("规则 RU 或贴目 KM 未确定，请补齐后重新上传");
 if (!/^[+-]?\d+(?:\.\d+)?$/.test(info.KM[0]) || !Number.isFinite(Number(info.KM[0]))) {
  throw Error("贴目 KM 必须是有效数字");
 }
 if (!["Chinese", "Japanese"].includes(info.RU[0])) throw Error("暂不支持该规则记录；仅支持 Chinese / Japanese 基础回放校验");
 if (info.HA && (!/^\d+$/.test(info.HA[0]) || Number(info.HA[0]) === 1 || Number(info.HA[0]) > 361)) throw Error("让子 HA 必须为 0 或 2—361 的整数");
 let moved = false;
 const rootKeys = ["FF", "GM", "SZ", "CA", "AP", "ST"];
 const supported = new Set([...infoKeys, ...rootKeys, "B", "W", "PL", "AB", "AW", "AE", "C", "N"]);
 for (const [index, node] of nodes.entries()) {
  for (const key of Object.keys(node)) {
   if (!supported.has(key)) throw Error(`暂不支持属性 ${key}，未导入棋局`);
   if (!["AB", "AW", "AE"].includes(key) && node[key].length !== 1) throw Error("单值属性含多个值");
   if (index > 0 && rootKeys.includes(key)) throw Error("根属性出现在非根节点");
  }
  if (node.PL && !["B", "W"].includes(node.PL[0])) throw Error("PL 行棋方必须是 B 或 W");
  if (node.B && node.W) throw Error("同节点不能同时有黑白落子");
  if (node.AB || node.AW || node.AE || node.PL) {
   if (moved) throw Error("暂不支持途中 setup 或 PL，请提供完整单线实战");
   if (node.B || node.W) throw Error("setup 与落子不能在同节点");
  }
  if (node.B || node.W) moved = true;
 }
 const board: Stone[] = Array(361).fill(null);
 let next: "B" | "W" = Number(info.HA?.[0] ?? 0) >= 2 ? "W" : "B";
 for (const node of nodes) {
  if (node.B || node.W) break;
  const occupied = new Set<number>();
  for (const key of ["AB", "AW", "AE"]) {
   for (const value of node[key] ?? []) {
    if (!/^[a-s]{2}(?::[a-s]{2})?$/.test(value)) throw Error("setup 坐标越界或格式错误");
    const [start, end = start] = value.split(":");
    if (value.includes(":") && start === end) throw Error("一格 setup 矩形须写为单点");
    if (start[0] > end[0] || start[1] > end[1]) throw Error("setup 矩形方向错误");
    for (let y = start.charCodeAt(1); y <= end.charCodeAt(1); y++) {
     for (let x = start.charCodeAt(0); x <= end.charCodeAt(0); x++) {
      const p = (y - 97) * 19 + x - 97;
      if (occupied.has(p)) throw Error("setup 点重复或交叠");
      occupied.add(p);
      board[p] = key === "AB" ? "B" : key === "AW" ? "W" : null;
     }
    }
   }
  }
  if (node.PL) next = node.PL[0] as "B" | "W";
 }
 for (let p = 0; p < 361; p++) {
  if (board[p] && !chain(board, p).hasLiberty) throw Error("初始 setup 存在无气棋子");
 }
 const frames: Frame[] = [{board: [...board], move: "起始", blackCaptures: 0, whiteCaptures: 0}];
 const positionKey = () => board.map(s => s ?? ".").join("");
 const positions = [positionKey()];
 const seen = new Set(positions);
 let blackCaptures = 0;
 let whiteCaptures = 0;
 for (const node of nodes) {
  const color = node.B ? "B" : node.W ? "W" : undefined;
  if (!color) continue;
  if (color !== next) throw Error("行棋方不符合交替落子记录");
  next = color === "B" ? "W" : "B";
  const point = node[color][0];
  if (point === "" || point === "tt") {
   frames.push({board: [...board], move: color + " pass", blackCaptures, whiteCaptures});
   positions.push(positionKey());
   continue;
  }
  if (!/^[a-s]{2}$/.test(point)) throw Error("不支持的落点");
  const p = (point.charCodeAt(1) - 97) * 19 + point.charCodeAt(0) - 97;
  if (board[p]) throw Error("非法落子：占点");
  board[p] = color;
  for (const n of neighbors(p)) {
   if (board[n] && board[n] !== color) {
    const group = chain(board, n);
    if (!group.hasLiberty) {
     for (const captured of group.stones) board[captured] = null;
     if (color === "B") blackCaptures += group.stones.size;
     else whiteCaptures += group.stones.size;
    }
   }
  }
  if (!chain(board, p).hasLiberty) throw Error("非法落子：自杀");
  const position = positionKey();
  if (positions.length >= 2 && position === positions[positions.length - 2]) throw Error("非法落子：简单劫立即回提");
  if (seen.has(position)) throw Error("暂不支持该循环规则：落子形成非立即历史盘面重复，不裁定合法性或无胜负");
  seen.add(position);
  positions.push(position);
  frames.push({board: [...board], move: color+" "+point, blackCaptures, whiteCaptures});
 }
 return {
  frames,
  handicap: info.HA?.[0] ?? "未记录",
  rules: info.RU[0],
  komi: info.KM[0],
  result: info.RE?.[0] ?? "未记录（不推断胜负或结束）",
  black: info.PB?.[0] ?? "未记录",
  white: info.PW?.[0] ?? "未记录",
  encoding,
 };
}

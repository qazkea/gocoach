export type Stone = "B" | "W" | null;
export interface Frame { board: Stone[]; move: string; blackCaptures: number; whiteCaptures: number }
export interface Replay { frames: Frame[]; rules: string; komi: string; result: string; black: string; white: string; encoding: string }
type Node = Record<string,string[]>;

// Strict single-sequence reader: never repairs syntax or discards a second tree.
function parse(text:string):Node[]{
 let i=0;
 const whitespace=()=>{while(/\s/.test(text[i]??"")&&i<text.length)i++;};
 const take=(c:string)=>{whitespace();if(text[i++]!==c)throw Error("SGF 语法不完整");};
 take("(");const nodes:Node[]=[];whitespace();
 while(text[i]===";"){
  i++;const node:Node={};whitespace();
  while(/[A-Z]/.test(text[i]??"")&&i<text.length){
   let key="";while(/[A-Z]/.test(text[i]??"")&&i<text.length)key+=text[i++];
   if(Object.hasOwn(node,key))throw Error("重复 SGF 属性");
   const values:string[]=[];whitespace();
   while(text[i]==="["){
    i++;let value="";
    while(i<text.length&&text[i]!=="]"){
     let c=text[i++];
     if(c==="\\"){
      if(i===text.length)throw Error("SGF 转义不完整");
      c=text[i++];
      if(c==="\r"||c==="\n"){if((c==="\r"&&text[i]==="\n")||(c==="\n"&&text[i]==="\r"))i++;continue;}
     }
     value+=c;
    }
    if(text[i++]!=="]")throw Error("SGF 属性未闭合");values.push(value);whitespace();
   }
   if(!values.length)throw Error("SGF 属性缺值");node[key]=values;
  }
  nodes.push(node);whitespace();
 }
 if(!nodes.length)throw Error("没有棋谱节点");
 if(text[i]==="(")throw Error("暂不支持分支棋谱，请导出单线实战");
 take(")");whitespace();if(i!==text.length)throw Error("暂不支持多谱或尾随内容");return nodes;
}
export function importReplay(bytes: ArrayBuffer): Replay {
 // Latin1 preserves every byte, so CA can be read without guessing an encoding.
 const raw=Array.from(new Uint8Array(bytes),b=>String.fromCharCode(b)).join("");
 const rawNodes=parse(raw);
 const encoding=rawNodes[0].CA?.[0]??"ISO-8859-1";
 let text=raw;
 if(!/^(ISO-8859-1|latin1)$/i.test(encoding)){
  if(!/^(UTF-8|GBK)$/i.test(encoding))throw Error("不支持的字符编码");
  try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}
  catch{throw Error("编码与文件字节不符");}
 }
 const nodes=parse(text);
 const root=nodes[0];
 if(root.FF?.[0]!=="4")throw Error("仅支持明确 FF[4] 的 SGF");
 if(root.GM&&root.GM[0]!=="1")throw Error("仅支持围棋 GM[1]");
 if(root.SZ&&root.SZ[0]!=="19")throw Error("仅支持 19 路棋盘");
 const infoKeys=new Set("RU KM HA RE PB PW BR WR BT WT GN GC DT EV RO PC SO US AN ON TM OT".split(" "));
 const infoNodes=nodes.filter(n=>Object.keys(n).some(k=>infoKeys.has(k)));
 if(infoNodes.length>1)throw Error("同一路径出现多个棋局信息节点");
 const info=infoNodes[0];
 if(!info?.RU?.[0]||!info?.KM?.[0])throw Error("规则 RU 或贴目 KM 未确定，请补齐后重新上传");
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(info.KM[0])||!Number.isFinite(Number(info.KM[0])))throw Error("贴目 KM 必须是有效数字");
 let moved=false;
 for(const [index,node] of nodes.entries()){
  for(const key of Object.keys(node)){
   if((infoKeys.has(key)||["FF","GM","SZ","CA","B","W","PL"].includes(key))&&node[key].length!==1)throw Error("单值属性含多个值");
   if(index>0&&["FF","GM","SZ","CA"].includes(key))throw Error("根属性出现在非根节点");
  }
  if(node.B&&node.W)throw Error("同节点不能同时有黑白落子");
  if(node.AB||node.AW||node.AE||node.PL){
   if(moved)throw Error("暂不支持途中 setup 或 PL，请提供完整单线实战");
   if(node.B||node.W)throw Error("setup 与落子不能在同节点");
  }
  if(node.B||node.W)moved=true;
 }
 const board: Stone[] = Array(361).fill(null);
 const frames: Frame[] = [{board: [...board], move: "起始", blackCaptures: 0, whiteCaptures: 0}];
 for (const node of nodes) {
  const color=node.B?"B":node.W?"W":undefined;
  if(!color)continue;
  const point=node[color][0];
  if(!/^[a-s]{2}$/.test(point))throw Error("不支持的落点");
  board[(point.charCodeAt(1)-97)*19+point.charCodeAt(0)-97] = color;
  frames.push({board: [...board], move: color+" "+point, blackCaptures: 0, whiteCaptures: 0});
 }
 return {frames,rules:info.RU[0],komi:info.KM[0],result:info.RE?.[0]??"未记录（不推断胜负或结束）",black:info.PB?.[0]??"未记录",white:info.PW?.[0]??"未记录",encoding};
}

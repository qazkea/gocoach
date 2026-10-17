import type {Replay} from './replay';
export type Color = 'B' | 'W';
export interface EngineInput {
 initialStones: [Color,string][];
 initialPlayer: Color;
 RU: string;
 KM: number;
 HA?: number;
 moves: [Color,string][];
}
export interface Estimate {visits:number; winrate:number; scoreLead:number}
export interface EngineResult {
 engineSession:string;
 engine:string; model:string; profile:string; komi:number; bonus:string;
 root:Estimate; candidates:(Estimate & {move:string; pv?:string[]})[];
}
export const sgfPoint = (i:number) => String.fromCharCode(97+i%19,97+Math.floor(i/19));
export function engineInput(game:Replay, step:number):EngineInput {
 return {
  initialStones:game.frames[0].board.flatMap((s,i)=>s ? [[s,sgfPoint(i)] as [Color,string]] : []),
  initialPlayer:game.frames[0].nextPlayer, RU:game.rules, KM:Number(game.komi),
  ...(game.handicap === '未记录' ? {} : {HA:Number(game.handicap)}),
  moves:game.frames.slice(1,step+1).map(f=>[f.move[0] as Color,f.move.slice(2)]),
 };
}
export function gtp(point:string):string {
 return point === 'pass' ? 'pass' : 'ABCDEFGHJKLMNOPQRST'[point.charCodeAt(0)-97]+(19-(point.charCodeAt(1)-97));
}
export function sgf(point:string):string {
 if(point === 'pass') return 'pass';
 if(!/^[A-HJ-T](?:[1-9]|1[0-9])$/.test(point)) throw Error('引擎坐标无效');
 return String.fromCharCode(97+'ABCDEFGHJKLMNOPQRST'.indexOf(point[0]),97+19-Number(point.slice(1)));
}

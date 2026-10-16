import {tryMove, type Replay} from "./replay";

// The derived replay contains the entire known prefix, never the actual future.
export interface Variation {replay: Replay; origin: number; cursor: number}
export function startVariation(game: Replay, step: number): Variation {
 return {replay:{...game, frames:game.frames.slice(0, step + 1)}, origin:step, cursor:step};
}
export function seekVariation(current: Variation, cursor: number): Variation {
 return {...current, cursor:Math.max(current.origin, Math.min(current.replay.frames.length - 1, cursor))};
}
export function extendVariation(current: Variation, point: string): Variation {
 if (current.cursor + 1 >= 2000) throw Error("原局前缀与变化最多保留 2000 帧，请先撤回。");
 const frame = tryMove(current.replay, current.cursor, point);
 return {...current, replay:{...current.replay, frames:[...current.replay.frames.slice(0, current.cursor + 1), frame]}, cursor:current.cursor + 1};
}

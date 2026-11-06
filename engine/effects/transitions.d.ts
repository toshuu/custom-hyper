/**
 * M7 — Transition blends. Each maps progress 0..1 over two full-size
 * scene renders (A outgoing, B incoming). Standard Canvas2D only.
 */
import type { CtxLike, EffectParams, TempSurface } from './types.js';
export interface TransitionDraw {
    ctx: CtxLike;
    width: number;
    height: number;
    a: unknown;
    b: unknown;
    createTemp: (w: number, h: number) => TempSurface;
}
export interface TransitionDef {
    describe: string;
    defaults: EffectParams;
    apply: (t: TransitionDraw, progress: number, params: EffectParams) => void;
}
export declare const none: TransitionDef;
export declare const fade: TransitionDef;
export declare const slide: TransitionDef;
export declare const pushCut: TransitionDef;
export declare const swap: TransitionDef;
export declare const wipe: TransitionDef;
export declare const flip: TransitionDef;
export declare const bookFlip: TransitionDef;
export declare const clockWipe: TransitionDef;
export declare const iris: TransitionDef;
export declare const zoomBlur: TransitionDef;
export declare const dreamyZoom: TransitionDef;
export declare const filmBurn: TransitionDef;
export declare const linearBlur: TransitionDef;
export declare const zoomInOut: TransitionDef;
export declare const crossZoom: TransitionDef;
export declare const dissolve: TransitionDef;
export declare const ripple: TransitionDef;
export declare const crosswarp: TransitionDef;
//# sourceMappingURL=transitions.d.ts.map
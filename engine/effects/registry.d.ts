import type { EffectContext, EffectDef, EffectParams, Rect } from './types.js';
import type { TransitionDef, TransitionDraw } from './transitions.js';
export declare const EFFECTS: Record<string, EffectDef>;
export declare const TRANSITIONS: Record<string, TransitionDef>;
export declare const transitionNames: () => string[];
/** Blend pre-rendered A/B scenes at eased progress. Throws on unknown types. */
export declare const applyTransitionByName: (t: TransitionDraw, name: string, progress: number, rawParams?: EffectParams) => void;
export declare const effectNames: () => string[];
/** Apply one named effect with merged defaults. Throws on unknown names. */
export declare const applyEffectByName: (ecx: EffectContext, name: string, rawParams?: EffectParams, region?: Rect) => void;
export interface EffectDescriptor {
    type: string;
    params?: EffectParams;
    disabled?: boolean;
}
/** Descriptor form (matches core Effect): honors disabled, passes region. */
export declare const applyEffect: (ecx: EffectContext, effect: EffectDescriptor, region?: Rect) => void;
//# sourceMappingURL=registry.d.ts.map
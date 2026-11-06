/**
 * M1 — Easing functions (all 18 reference members).
 * Edge/clamping behavior preserved; Easing.spring bridges to spring.ts.
 */
import type { EasingFunction, SpringConfig } from './types.js';
export interface SpringEasingConfig extends SpringConfig {
    allowTail?: boolean;
    durationRestThreshold?: number;
}
export declare const Easing: {
    step0: (n: number) => number;
    step1: (n: number) => number;
    linear: (t: number) => number;
    ease: (x: number) => number;
    quad: (t: number) => number;
    cubic: (t: number) => number;
    poly: (n: number) => EasingFunction;
    sin: (t: number) => number;
    circle: (t: number) => number;
    exp: (t: number) => number;
    elastic: (bounciness?: number) => EasingFunction;
    back: (s?: number) => EasingFunction;
    spring: (config?: SpringEasingConfig) => EasingFunction;
    bounce: (t: number) => number;
    bezier: (mX1: number, mY1: number, mX2: number, mY2: number) => ((x: number) => number);
    in: (fn: EasingFunction) => EasingFunction;
    out: (fn: EasingFunction) => EasingFunction;
    inOut: (fn: EasingFunction) => EasingFunction;
};
//# sourceMappingURL=easing.d.ts.map
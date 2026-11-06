/**
 * M3 — Declarative animation bindings (JSON-compatible).
 * Lets scene-graph numeric props vary with the node's LOCAL frame while
 * staying plain data (no functions), so plans remain serializable for the
 * future AI planner. Evaluated by the compositor via resolveAnimNumber().
 */
import type { RgbaColor } from '../renderer/types.js';
import type { InterpolateColorsOptions } from './colors.js';
import type { InterpolateOptions, SpringConfig } from './types.js';
export interface InterpolateBinding {
    binding: 'interpolate';
    inputRange: number[];
    outputRange: number[];
    options?: InterpolateOptions;
}
export interface SpringBinding {
    binding: 'spring';
    config?: SpringConfig;
    from?: number;
    to?: number;
    durationInFrames?: number;
    durationRestThreshold?: number;
    delay?: number;
    reverse?: boolean;
}
/**
 * Keyframes binding: explicit frame->value stops, compiled to the same
 * multi-stop interpolate the engine already proves. First-class so the AI
 * authors motion systems (not single tweens): keys must be finite, frames
 * strictly increasing (compiler helpers enforce this loudly).
 */
export interface KeyframesBinding {
    binding: 'keyframes';
    frames: number[];
    values: number[];
    options?: InterpolateOptions;
}
export type AnimNumber = number | InterpolateBinding | SpringBinding | KeyframesBinding;
export declare const isAnimBinding: (value: AnimNumber) => value is InterpolateBinding | SpringBinding | KeyframesBinding;
/**
 * Declarative color animation (JSON-compatible): same keyframe model as
 * numbers, resolved through the strict `interpolateColors` grammar.
 * Lets fills breathe/pulse (e.g. glow color over frames) while plans
 * stay plain data. Gradient stops are NOT animatable — cross-fade whole
 * fills via node opacity instead.
 */
export interface ColorBinding {
    binding: 'color';
    inputRange: number[];
    colorStops: string[];
    options?: InterpolateColorsOptions;
}
export type AnimColor = string | RgbaColor | ColorBinding;
export declare const isColorBinding: (value: unknown) => value is ColorBinding;
/** Pure in (value, frame, fps) → CSS color string. */
export declare const resolveAnimColor: (value: AnimColor, frame: number) => string;
/** Pure in (value, frame, fps). Frame is the node's LOCAL frame. */
export declare const resolveAnimNumber: (value: AnimNumber, frame: number, fps: number) => number;
//# sourceMappingURL=bindings.d.ts.map
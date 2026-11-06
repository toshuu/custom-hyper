/**
 * M1 — Color parsing + interpolateColors().
 * Grammar mirrors the reference implementation (probed 2026-09-22):
 *   legacy (comma-separated, strict): rgb(n,n,n), rgba(n,n,n,a),
 *     hsl(h,s%,l%), hsla(h,s%,l%,a) — no % in rgb, no units on hsl hue,
 *     no % alpha in rgba, no space syntax for rgb/hsl.
 *   modern (space-separated + optional /alpha): hwb, lab, lch, oklab, oklch.
 *   hex3/4/6/8, CSS named colors.
 * Channels are 8-bit ints at parse (rgb comma values truncated+clamped,
 * alpha quantized Math.round(a*255)/255); derived spaces interpolate as
 * floats and round at output. Output: deterministic "rgba(r, g, b, a)".
 */
import type { EasingFunction } from './types.js';
export interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
}
export declare const rgb01ToLab: (r: number, g: number, b: number) => [number, number, number];
export declare const rgb01ToOklab: (r: number, g: number, b: number) => [number, number, number];
/** Parse a CSS color string into RGBA (r/g/b 0-255, a 0-1). */
export declare const processColor: (color: string) => Rgba;
export interface InterpolateColorsOptions {
    easing?: EasingFunction;
    posterize?: number;
}
export declare const interpolateColors: (input: number, inputRange: readonly number[], outputRange: readonly string[], options?: InterpolateColorsOptions) => string;
//# sourceMappingURL=colors.d.ts.map
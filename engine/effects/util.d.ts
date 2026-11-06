/**
 * M6 — Shared pixel/noise/blur utilities. All deterministic; no wall-clock.
 */
import type { EffectContext } from './types.js';
export type Pixels = {
    data: Uint8ClampedArray<ArrayBufferLike>;
    width: number;
    height: number;
};
export declare const clamp01: (v: number) => number;
export declare const clamp255: (v: number) => number;
export declare const lerp: (a: number, b: number, t: number) => number;
export declare const num: (params: Record<string, unknown>, key: string, fallback: number) => number;
export declare const str: (params: Record<string, unknown>, key: string, fallback: string) => string;
export declare const bool: (params: Record<string, unknown>, key: string, fallback: boolean) => boolean;
export declare const hexToRgb: (hex: string) => [number, number, number];
export declare const luma: (r: number, g: number, b: number) => number;
export declare const getPixels: (ecx: EffectContext) => Pixels;
export declare const putPixels: (ecx: EffectContext, px: Pixels) => void;
export declare const blankPixels: (ecx: EffectContext) => Pixels;
/**
 * Backend-accelerated gaussian blur via standard Canvas2D ctx.filter.
 * Falls back to the portable JS sliding-window box blur when unsupported.
 * Deterministic per backend build; radius capped at 100.
 */
export declare const nativeBlur: (ecx: EffectContext, radius: number) => Pixels;
/** Native blur of arbitrary pixels: upload → filter-draw → read back. */
export declare const nativeBlurPixels: (ecx: EffectContext, px: Pixels, radius: number) => Pixels;
/** Portable fallback: 3× sliding-window box blur (deterministic, slower). */
export declare const blurPixels: (src: Pixels, radius: number) => Pixels;
/** 3x3 convolution (edge-clamped), alpha preserved unless includeAlpha. */
export declare const convolve3: (src: Pixels, kernel: readonly number[], divisor?: number, bias?: number) => Pixels;
/** Deterministic integer-lattice hash → [0,1). */
export declare const hash2: (x: number, y: number, seed: number) => number;
/** Value noise with seeded lattice. */
export declare const valueNoise: (x: number, y: number, seed: number) => number;
/** Fractal noise (octaves of value noise, lacunarity 2, gain 0.5). */
export declare const fbm: (x: number, y: number, seed: number, octaves: number) => number;
export declare const makeRng: (seed: number | string) => (() => number);
/** Bilinear sample of RGBA data (clamped edges). Returns [r,g,b,a]. */
export declare const sampleBilinear: (data: Uint8ClampedArray, w: number, h: number, x: number, y: number) => [number, number, number, number];
/** Nearest sample (fast path for distortion previews/tests). */
export declare const sampleNearest: (data: Uint8ClampedArray, w: number, h: number, x: number, y: number) => [number, number, number, number];
//# sourceMappingURL=util.d.ts.map
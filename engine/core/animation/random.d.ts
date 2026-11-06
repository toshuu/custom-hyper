/**
 * M1 — Deterministic seeded random.
 * Same contract as the reference: number|string|null seed → [0, 1).
 * Identical (seed, call-order) inputs → identical outputs across renders.
 */
import type { RandomSeed } from './types.js';
export declare const random: (seed: RandomSeed) => number;
/**
 * Sequential deterministic stream (effects/noise use this; same algorithm
 * as random(), exposed as a generator for per-pixel consumption).
 */
export declare const createSeededRng: (seed: number | string) => (() => number);
//# sourceMappingURL=random.d.ts.map
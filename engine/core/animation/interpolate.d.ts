/**
 * M1 — interpolate(): deterministic multi-stop value mapping.
 *
 * Supports scalar numbers, unit-bearing strings ("10px", "45deg", "50%"),
 * multi-component transform strings, numeric tuples, and discrete strings.
 * Extrapolation: extend (default) | clamp | wrap | identity.
 */
import type { InterpolateOptions } from './types.js';
export declare function interpolate(input: number, inputRange: readonly number[], outputRange: readonly number[], options?: InterpolateOptions): number;
export declare function interpolate(input: number, inputRange: readonly number[], outputRange: readonly string[], options?: InterpolateOptions): string;
export declare function interpolate(input: number, inputRange: readonly number[], outputRange: readonly number[][], options?: InterpolateOptions): number[];
//# sourceMappingURL=interpolate.d.ts.map
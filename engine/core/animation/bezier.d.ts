/**
 * M1 — Cubic Bézier timing functions.
 * Strategy (matches reference behavior): sample table → Newton-Raphson
 * where slope is usable → binary subdivision fallback.
 */
/** Cubic Bézier easing: maps x∈[0,1] through the curve to y. */
export declare const bezier: (mX1: number, mY1: number, mX2: number, mY2: number) => ((x: number) => number);
//# sourceMappingURL=bezier.d.ts.map
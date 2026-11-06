/**
 * Baked path morphs (MorphSVG technique, engine-honest form).
 *
 * The engine never tweens path data at render time: `bakeMorph()` runs
 * OFFLINE (plan build) and emits one `d` per local frame; the compositor
 * just indexes `frames[localFrame]`. Deterministic, JSON-serializable,
 * O(1) per frame. Same command structure required (M/L/C/Z absolute) —
 * anything else throws loudly instead of producing a twisted morph.
 */
/**
 * Bake `frameCount` path strings lerping from `fromD` to `toD`.
 * Both must share the exact command sequence (op per op, count per
 * count). Frame 0 === fromD exactly, last === toD exactly.
 */
export declare const bakeMorph: (fromD: string, toD: string, frameCount: number) => string[];
//# sourceMappingURL=morph.d.ts.map
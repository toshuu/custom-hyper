/**
 * M1 — Deterministic seeded random.
 * Same contract as the reference: number|string|null seed → [0, 1).
 * Identical (seed, call-order) inputs → identical outputs across renders.
 */
const MULBERRY_OFFSET = 0x6d2b79f5;
const mulberry32 = (a) => {
    let t = (a + MULBERRY_OFFSET) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hashString = (value) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return hash;
};
export const random = (seed) => {
    if (seed === null) {
        return Math.random();
    }
    if (typeof seed === 'string') {
        return mulberry32(hashString(seed));
    }
    if (typeof seed === 'number') {
        if (!Number.isFinite(seed)) {
            throw new Error('random() seed must be a finite number');
        }
        return mulberry32(seed * 1e10);
    }
    throw new Error('random() seed must be a number, string, or null');
};
/**
 * Sequential deterministic stream (effects/noise use this; same algorithm
 * as random(), exposed as a generator for per-pixel consumption).
 */
export const createSeededRng = (seed) => {
    let state;
    if (typeof seed === 'string') {
        state = hashString(seed);
    }
    else {
        if (!Number.isFinite(seed)) {
            throw new Error('createSeededRng() seed must be finite');
        }
        state = Math.floor(seed * 1e10);
    }
    return () => {
        state = (state + MULBERRY_OFFSET) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
//# sourceMappingURL=random.js.map
/**
 * Baked path morphs (MorphSVG technique, engine-honest form).
 *
 * The engine never tweens path data at render time: `bakeMorph()` runs
 * OFFLINE (plan build) and emits one `d` per local frame; the compositor
 * just indexes `frames[localFrame]`. Deterministic, JSON-serializable,
 * O(1) per frame. Same command structure required (M/L/C/Z absolute) —
 * anything else throws loudly instead of producing a twisted morph.
 */
const PARAMS = { M: 2, L: 2, C: 6, Z: 0 };
const parsePath = (d, what) => {
    const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
    const cmds = [];
    let cur = null;
    let nums = [];
    const flush = () => {
        if (cur === null) {
            return;
        }
        const upper = cur.toUpperCase();
        if (!(upper in PARAMS)) {
            throw new Error(`bakeMorph supports M/L/C/Z only (got "${cur}" in ${what})`);
        }
        if (cur !== upper) {
            throw new Error(`bakeMorph needs absolute commands (got relative "${cur}" in ${what})`);
        }
        const need = PARAMS[upper];
        if (need === 0) {
            if (nums.length > 0) {
                throw new Error(`bakeMorph: Z takes no params (in ${what})`);
            }
            cmds.push({ op: upper, nums: [] });
        }
        else {
            if (nums.length === 0 || nums.length % need !== 0) {
                throw new Error(`bakeMorph: bad param count for ${upper} (in ${what})`);
            }
            for (let i = 0; i < nums.length; i += need) {
                cmds.push({ op: upper, nums: nums.slice(i, i + need) });
            }
        }
        nums = [];
    };
    for (const t of tokens) {
        if (/[A-Za-z]/.test(t)) {
            flush();
            cur = t;
        }
        else if (cur === null) {
            throw new Error(`bakeMorph: path must start with a command (in ${what})`);
        }
        else {
            const v = Number(t);
            if (!Number.isFinite(v)) {
                throw new Error(`bakeMorph: bad number "${t}" (in ${what})`);
            }
            nums.push(v);
        }
    }
    flush();
    if (cmds.length === 0) {
        throw new Error(`bakeMorph: empty path (in ${what})`);
    }
    return cmds;
};
const fmt = (v) => {
    const r = Math.round(v * 1000) / 1000;
    return Number.isInteger(r) ? String(r) : String(r);
};
/**
 * Bake `frameCount` path strings lerping from `fromD` to `toD`.
 * Both must share the exact command sequence (op per op, count per
 * count). Frame 0 === fromD exactly, last === toD exactly.
 */
export const bakeMorph = (fromD, toD, frameCount) => {
    if (!Number.isInteger(frameCount) || frameCount < 2) {
        throw new Error(`bakeMorph needs integer frameCount >= 2 (got ${String(frameCount)})`);
    }
    const a = parsePath(fromD, 'fromD');
    const b = parsePath(toD, 'toD');
    if (a.length !== b.length) {
        throw new Error(`bakeMorph: command counts differ (${a.length} vs ${b.length})`);
    }
    for (let i = 0; i < a.length; i += 1) {
        if (a[i].op !== b[i].op || a[i].nums.length !== b[i].nums.length) {
            throw new Error(`bakeMorph: structure differs at command ${i} (${a[i].op} vs ${b[i].op})`);
        }
    }
    const out = [];
    for (let f = 0; f < frameCount; f += 1) {
        const t = f / (frameCount - 1);
        let d = '';
        for (let i = 0; i < a.length; i += 1) {
            d += a[i].op;
            const parts = a[i].nums.map((v, k) => fmt(v + (b[i].nums[k] - v) * t));
            d += parts.join(' ');
        }
        out.push(d);
    }
    return out;
};
//# sourceMappingURL=morph.js.map
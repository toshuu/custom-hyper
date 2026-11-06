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
import { interpolate } from './interpolate.js';
const NAMED_COLORS = {
    aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff',
    aquamarine: '#7fffd4', azure: '#f0ffff', beige: '#f5f5dc',
    bisque: '#ffe4c4', black: '#000000', blanchedalmond: '#ffebcd',
    blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a',
    burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00',
    chocolate: '#d2691e', coral: '#ff7f50', cornflowerblue: '#6495ed',
    cornsilk: '#fff8dc', crimson: '#dc143c', cyan: '#00ffff',
    darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
    darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9',
    darkkhaki: '#bdb76b', darkmagenta: '#8b008b', darkolivegreen: '#556b2f',
    darkorange: '#ff8c00', darkorchid: '#9932cc', darkred: '#8b0000',
    darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b',
    darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1',
    darkviolet: '#9400d3', deeppink: '#ff1493', deepskyblue: '#00bfff',
    dimgray: '#696969', dimgrey: '#696969', dodgerblue: '#1e90ff',
    firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
    fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff',
    gold: '#ffd700', goldenrod: '#daa520', gray: '#808080',
    green: '#008000', greenyellow: '#adff2f', grey: '#808080',
    honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c',
    indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c',
    lavender: '#e6e6fa', lavenderblush: '#fff0f5', lawngreen: '#7cfc00',
    lemonchiffon: '#fffacd', lightblue: '#add8e6', lightcoral: '#f08080',
    lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
    lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1',
    lightsalmon: '#ffa07a', lightseagreen: '#20b2aa', lightskyblue: '#87cefa',
    lightslategray: '#778899', lightslategrey: '#778899', lightsteelblue: '#b0c4de',
    lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32',
    linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000',
    mediumaquamarine: '#66cdaa', mediumblue: '#0000cd', mediumorchid: '#ba55d3',
    mediumpurple: '#9370db', mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee',
    mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585',
    midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1',
    moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080',
    oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23',
    orange: '#ffa500', orangered: '#ff4500', orchid: '#da70d6',
    palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee',
    palevioletred: '#db7093', papayawhip: '#ffefd5', peachpuff: '#ffdab9',
    peru: '#cd853f', pink: '#ffc0cb', plum: '#dda0dd',
    powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399',
    red: '#ff0000', rosybrown: '#bc8f8f', royalblue: '#4169e1',
    saddlebrown: '#8b4513', salmon: '#fa8072', sandybrown: '#f4a460',
    seagreen: '#2e8b57', seashell: '#fff5ee', sienna: '#a0522d',
    silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd',
    slategray: '#708090', slategrey: '#708090', snow: '#fffafa',
    springgreen: '#00ff7f', steelblue: '#4682b4', tan: '#d2b48c',
    teal: '#008080', thistle: '#d8bfd8', tomato: '#ff6347',
    turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3',
    white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00',
    yellowgreen: '#9acd32', transparent: '#00000000',
};
const invalid = (original) => new Error(`invalid color string ${original} provided`);
const clamp255 = (v) => Math.min(255, Math.max(0, v));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const quantizeAlpha = (a) => Math.round(clamp01(a) * 255) / 255;
const parseDecimalAlpha = (raw, original) => {
    const v = raw.trim();
    if (v === '' || v.endsWith('%') || /[a-zA-Z]/.test(v)) {
        throw invalid(original);
    }
    const n = Number(v);
    if (!Number.isFinite(n)) {
        throw invalid(original);
    }
    return quantizeAlpha(n);
};
/** Slash-alpha for modern space syntax: decimal or %. */
const parseSlashAlpha = (raw, original) => {
    const v = raw.trim().toLowerCase();
    if (v === 'none') {
        return 0;
    }
    if (v.endsWith('%')) {
        const n = Number(v.slice(0, -1));
        if (!Number.isFinite(n)) {
            throw invalid(original);
        }
        return quantizeAlpha(n / 100);
    }
    if (/[a-zA-Z]/.test(v)) {
        throw invalid(original);
    }
    const n = Number(v);
    if (!Number.isFinite(n)) {
        throw invalid(original);
    }
    return quantizeAlpha(n);
};
const parsePlainNumber = (raw, original) => {
    const v = raw.trim();
    if (v === '' || v.toLowerCase() === 'none') {
        return 0;
    }
    if (/[a-zA-Z%]/.test(v)) {
        throw invalid(original);
    }
    const n = Number(v);
    if (!Number.isFinite(n)) {
        throw invalid(original);
    }
    return n;
};
const parsePercent01 = (raw, original) => {
    const v = raw.trim();
    if (!v.endsWith('%')) {
        throw invalid(original);
    }
    const n = Number(v.slice(0, -1));
    if (!Number.isFinite(n)) {
        throw invalid(original);
    }
    return n / 100;
};
const hexToRgba = (hex, original) => {
    let h = hex.replace('#', '');
    if (h.length === 3 || h.length === 4) {
        h = h.split('').map((c) => c + c).join('');
    }
    if (h.length !== 6 && h.length !== 8) {
        throw invalid(original);
    }
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(h)) {
        throw invalid(original);
    }
    return {
        r: Number.parseInt(h.slice(0, 2), 16),
        g: Number.parseInt(h.slice(2, 4), 16),
        b: Number.parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
};
/* ---------- sRGB / linear helpers ---------- */
const srgbToLinear = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const linearToSrgb = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const hueToRgbChannel = (p, q, t) => {
    let u = t;
    if (u < 0) {
        u += 1;
    }
    if (u > 1) {
        u -= 1;
    }
    if (u < 1 / 6) {
        return p + (q - p) * 6 * u;
    }
    if (u < 1 / 2) {
        return q;
    }
    if (u < 2 / 3) {
        return p + (q - p) * (2 / 3 - u) * 6;
    }
    return p;
};
const hslToRgb01 = (h, s, l) => {
    const hue = (((h % 360) + 360) % 360) / 360;
    if (s === 0) {
        return [l, l, l];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
        hueToRgbChannel(p, q, hue + 1 / 3),
        hueToRgbChannel(p, q, hue),
        hueToRgbChannel(p, q, hue - 1 / 3),
    ];
};
const hwbToRgb01 = (h, w, b) => {
    const whiteness = clamp01(w);
    const blackness = clamp01(b);
    if (whiteness + blackness >= 1) {
        const gray = whiteness / (whiteness + blackness);
        return [gray, gray, gray];
    }
    const [r, g, bl] = hslToRgb01(h, 1, 0.5);
    const factor = 1 - whiteness - blackness;
    return [r * factor + whiteness, g * factor + whiteness, bl * factor + whiteness];
};
const labToXyz = (l, a, b) => {
    const fy = (l + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;
    const eps = 216 / 24389;
    const kappa = 24389 / 27;
    const xr = fx ** 3 > eps ? fx ** 3 : (116 * fx - 16) / kappa;
    const yr = l > kappa * eps ? ((l + 16) / 116) ** 3 : l / kappa;
    const zr = fz ** 3 > eps ? fz ** 3 : (116 * fz - 16) / kappa;
    return [xr * 0.95047, yr, zr * 1.08883];
};
const xyzToLinearRgb = (x, y, z) => [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
];
const linearRgbToXyz = (r, g, b) => [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
];
const xyzToLab = (x, y, z) => {
    const f = (t) => {
        const eps = 216 / 24389;
        const kappa = 24389 / 27;
        return t > eps ? Math.cbrt(t) : (kappa * t + 16) / 116;
    };
    const fx = f(x / 0.95047);
    const fy = f(y);
    const fz = f(z / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
export const rgb01ToLab = (r, g, b) => {
    const [x, y, z] = linearRgbToXyz(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
    return xyzToLab(x, y, z);
};
const labToRgb01 = (l, a, b) => {
    const [x, y, z] = labToXyz(l, a, b);
    const [lr, lg, lb] = xyzToLinearRgb(x, y, z);
    return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
};
const linearRgbToOklab = (r, g, b) => {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);
    return [
        0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    ];
};
const oklabToLinearRgb = (l, a, b) => {
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = l - 0.0894841775 * a - 1.291485548 * b;
    const l3 = l_ ** 3;
    const m3 = m_ ** 3;
    const s3 = s_ ** 3;
    return [
        4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
        -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
        -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
    ];
};
export const rgb01ToOklab = (r, g, b) => linearRgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
const oklabToRgb01 = (l, a, b) => {
    const [lr, lg, lb] = oklabToLinearRgb(l, a, b);
    return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
};
const parseAngleNumber = (raw, original) => {
    const v = raw.trim().toLowerCase();
    if (v === 'none') {
        return 0;
    }
    const m = /^(-?(?:\d+\.?\d*|\.\d+))([a-z]*)$/.exec(v);
    if (!m) {
        throw invalid(original);
    }
    const n = Number(m[1]);
    const unit = m[2] ?? '';
    if (unit === '' || unit === 'deg') {
        return n;
    }
    if (unit === 'rad') {
        return (n * 180) / Math.PI;
    }
    if (unit === 'grad') {
        return n * 0.9;
    }
    if (unit === 'turn') {
        return n * 360;
    }
    throw invalid(original);
};
/** Split modern space syntax: "a b c" or "a b c / alpha". */
const splitModern = (body, original) => {
    const [front, slash] = body.split('/');
    if (slash !== undefined && body.split('/').length > 2) {
        throw invalid(original);
    }
    const comps = front.trim().split(/\s+/).filter((p) => p !== '');
    if (slash === undefined) {
        return { comps, alpha: 1 };
    }
    if (slash.trim() === '') {
        throw invalid(original);
    }
    return { comps, alpha: parseSlashAlpha(slash, original) };
};
/** Parse a CSS color string into RGBA (r/g/b 0-255, a 0-1). */
export const processColor = (color) => {
    const original = color;
    const input = color.trim();
    const lower = input.toLowerCase();
    if (NAMED_COLORS[lower] !== undefined) {
        return hexToRgba(NAMED_COLORS[lower].toLowerCase(), original);
    }
    if (lower.startsWith('#')) {
        return hexToRgba(lower, original);
    }
    const fnMatch = lower.match(/^([a-z]+)\((.*)\)$/s);
    if (!fnMatch) {
        throw invalid(original);
    }
    const fn = fnMatch[1];
    const body = fnMatch[2].trim();
    if (fn === 'rgb' || fn === 'rgba') {
        const parts = body.split(',').map((p) => p.trim());
        const want = fn === 'rgb' ? 3 : 4;
        if (parts.length !== want || parts.some((p) => p === '')) {
            throw invalid(original);
        }
        const channels = parts.slice(0, 3).map((p) => {
            if (/[%a-zA-Z]/.test(p)) {
                throw invalid(original);
            }
            const n = Number(p);
            if (!Number.isFinite(n)) {
                throw invalid(original);
            }
            return clamp255(Math.trunc(n));
        });
        const a = fn === 'rgba' ? parseDecimalAlpha(parts[3], original) : 1;
        return { r: channels[0], g: channels[1], b: channels[2], a };
    }
    if (fn === 'hsl' || fn === 'hsla') {
        const parts = body.split(',').map((p) => p.trim());
        const want = fn === 'hsl' ? 3 : 4;
        if (parts.length !== want || parts.some((p) => p === '')) {
            throw invalid(original);
        }
        const h = parsePlainNumber(parts[0], original);
        const s = parsePercent01(parts[1], original);
        const l = parsePercent01(parts[2], original);
        const a = fn === 'hsla' ? parseDecimalAlpha(parts[3], original) : 1;
        const [r, g, b] = hslToRgb01(h, s, l);
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a };
    }
    if (fn === 'hwb') {
        const { comps, alpha } = splitModern(body, original);
        if (comps.length !== 3) {
            throw invalid(original);
        }
        const h = parseAngleNumber(comps[0], original);
        const w = parsePercent01(comps[1], original);
        const bl = parsePercent01(comps[2], original);
        const [r, g, b] = hwbToRgb01(h, w, bl);
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: alpha };
    }
    if (fn === 'lab' || fn === 'oklab') {
        const { comps, alpha } = splitModern(body, original);
        if (comps.length !== 3) {
            throw invalid(original);
        }
        const lRaw = comps[0].trim();
        let l;
        if (fn === 'lab') {
            l = lRaw.endsWith('%') ? parsePercent01(lRaw, original) * 100 : parsePlainNumber(lRaw, original);
        }
        else {
            l = lRaw.endsWith('%') ? parsePercent01(lRaw, original) : parsePlainNumber(lRaw, original);
        }
        const a = parsePlainNumber(comps[1], original);
        const b = parsePlainNumber(comps[2], original);
        const [r, g, bl] = fn === 'lab' ? labToRgb01(l, a, b) : oklabToRgb01(l, a, b);
        return {
            r: Math.round(clamp01(r) * 255),
            g: Math.round(clamp01(g) * 255),
            b: Math.round(clamp01(bl) * 255),
            a: alpha,
        };
    }
    if (fn === 'lch' || fn === 'oklch') {
        const { comps, alpha } = splitModern(body, original);
        if (comps.length !== 3) {
            throw invalid(original);
        }
        const lRaw = comps[0].trim();
        let l;
        let c;
        if (fn === 'lch') {
            l = lRaw.endsWith('%') ? parsePercent01(lRaw, original) * 100 : parsePlainNumber(lRaw, original);
            c = parsePlainNumber(comps[1], original);
        }
        else {
            l = lRaw.endsWith('%') ? parsePercent01(lRaw, original) : parsePlainNumber(lRaw, original);
            const cRaw = comps[1].trim();
            c = cRaw.endsWith('%') ? parsePercent01(cRaw, original) : parsePlainNumber(cRaw, original);
        }
        const hDeg = parseAngleNumber(comps[2], original);
        const hRad = (hDeg * Math.PI) / 180;
        const a = c * Math.cos(hRad);
        const b = c * Math.sin(hRad);
        const [r, g, bl] = fn === 'lch' ? labToRgb01(l, a, b) : oklabToRgb01(l, a, b);
        return {
            r: Math.round(clamp01(r) * 255),
            g: Math.round(clamp01(g) * 255),
            b: Math.round(clamp01(bl) * 255),
            a: alpha,
        };
    }
    throw invalid(original);
};
/**
 * Map a value across color stops → deterministic "rgba(r, g, b, a)".
 * Channels interpolate with clamped ends; RGB rounded, alpha 3 decimals.
 */
/**
 * M10 — Parsed-color cache. `processColor` is pure in its input string,
 * so identical stops share one parse. Bounded (cleared when full); only
 * successful parses are cached, so loud errors fire exactly as before.
 * Cached records are never mutated (channels are only read below).
 */
const COLOR_CACHE = new Map();
const COLOR_CACHE_LIMIT = 2000;
const cachedColor = (color) => {
    const hit = COLOR_CACHE.get(color);
    if (hit !== undefined) {
        return hit;
    }
    const parsed = processColor(color);
    if (COLOR_CACHE.size >= COLOR_CACHE_LIMIT) {
        COLOR_CACHE.clear();
    }
    COLOR_CACHE.set(color, parsed);
    return parsed;
};
export const interpolateColors = (input, inputRange, outputRange, options) => {
    if (inputRange.length !== outputRange.length) {
        throw new Error('inputRange and outputRange must have the same length');
    }
    const parsed = outputRange.map(cachedColor);
    const channel = (pick) => parsed.map(pick);
    const opts = {
        easing: options?.easing,
        posterize: options?.posterize,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    };
    const r = Math.round(interpolate(input, inputRange, channel((c) => c.r), opts));
    const g = Math.round(interpolate(input, inputRange, channel((c) => c.g), opts));
    const b = Math.round(interpolate(input, inputRange, channel((c) => c.b), opts));
    const a = interpolate(input, inputRange, channel((c) => c.a), opts);
    return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
};
//# sourceMappingURL=colors.js.map
/**
 * M4 — Font registration + canvas text measurement for Skia.
 * Fonts must be registered BEFORE measuring/drawing (no implicit fallback
 * timing — keeps renders deterministic). System fonts loadable on demand.
 */
import { GlobalFonts, createCanvas } from '@napi-rs/canvas';
const registered = new Map();
let systemFontsLoaded = false;
const GF = GlobalFonts;
export const registerFontFile = (path, family, opts) => {
    GF.registerFromPath(path, family);
    registered.set(`${family}::${path}`, { family, path, ...opts });
};
export const registerFontBuffer = (data, family, opts) => {
    GF.register(data, family);
    registered.set(`${family}::buffer`, { family, ...opts });
};
export const ensureSystemFonts = () => {
    if (!systemFontsLoaded) {
        GF.loadSystemFonts();
        systemFontsLoaded = true;
    }
};
export const listFontFamilies = () => GF.getFamilies().map((f) => (typeof f === 'string' ? f : (f.alias ?? f.family)));
export const registeredFonts = () => [...registered.values()];
/** CSS font shorthand the canvas backend resolves (Pango/fontconfig). */
export const fontStringFor = (style) => {
    const weight = style.fontWeight === undefined ? '400' : String(style.fontWeight);
    const fontStyle = style.fontStyle ?? 'normal';
    return `${fontStyle} ${weight} ${style.fontSize}px "${style.fontFamily}"`;
};
const scratch = createCanvas(8, 8);
const scratchCtx = scratch.getContext('2d');
const applyMeasurerState = (ctx, style) => {
    ctx.font = fontStringFor(style);
    // Measure the BASE advance (letterSpacing excluded): layout adds
    // `letterSpacing` per grapheme itself (advanceOf), and drawing applies
    // canvas letterSpacing once. Measuring with spacing set would count it
    // twice (wrap too early, centered lines shifted left).
    try {
        ctx.letterSpacing = '0px';
    }
    catch {
        // Unsupported — measurement stays consistent with drawing (both ignore it).
    }
};
const measureCache = new Map();
const MEASURE_CACHE_LIMIT = 20000;
/** Backend measurer: consistent with drawText by construction. */
export const createSkiaMeasurer = () => ({
    measure: (text, style) => {
        const key = `${fontStringFor(style)}|${style.letterSpacing ?? 0}|${text}`;
        const cached = measureCache.get(key);
        if (cached !== undefined) {
            return { width: cached };
        }
        applyMeasurerState(scratchCtx, style);
        const width = scratchCtx.measureText(text).width;
        if (measureCache.size >= MEASURE_CACHE_LIMIT) {
            measureCache.clear();
        }
        measureCache.set(key, width);
        return { width };
    },
});
/** Whether the backend honors letterSpacing (probe, not assumption). */
export const probeLetterSpacingSupport = () => {
    const ctx = scratch.getContext('2d');
    ctx.font = '400 32px sans-serif';
    const base = ctx.measureText('hello').width;
    try {
        ctx.letterSpacing = '10px';
    }
    catch {
        return false;
    }
    const spaced = ctx.measureText('hello').width;
    try {
        ctx.letterSpacing = '0px';
    }
    catch {
        // ignore
    }
    return spaced - base > 40;
};
//# sourceMappingURL=fonts.js.map
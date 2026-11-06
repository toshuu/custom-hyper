/**
 * M6 — Modular effect registry. No giant switch: name → def.
 * Unknown names throw (staged/D-deferred effects fail loudly, never silent).
 */
import { barrelDistortion, cornerPin, displacement, fisheye, linearProgressivePixelate, mirror, noiseDisplacement, pixelDissolve, pixelate, radialProgressivePixelate, ripple, scale, skew, tear, tile, translate, tvSignalOff, wave, waves, } from './fx-distort.js';
import { chromaticAberration, dropShadow, glow, lightTrail, linearProgressiveBlur, motionBlur, radialProgressiveBlur, regionBlur, blur, vignette, zoomBlur, } from './fx-blur.js';
import { brightness, colorKey, contrast, duotone, exposure, gradientMap, grayscale, hue, invert, levels, lut, saturation, shadowsHighlights, thermalVision, tint, vibrance, whiteBalance, } from './fx-color.js';
import { lightLeak, linearGradient, shine } from './fx-light.js';
import { burlap, checkerboard, contourLines, dotGrid, evolve, film, flannel, grain, gridlines, halftone, halftoneLinearGradient, lines, liquidContours, noise, paper, rings, scanlines, speckle, starburst, venetianBlinds, whiteNoise, zigzag, } from './fx-noise.js';
import { emboss, outline, roughenEdges } from './fx-stylize.js';
import { bookFlip, clockWipe, crossZoom, crosswarp, dissolve, dreamyZoom, fade, filmBurn, flip, iris, linearBlur, none, pushCut, ripple as rippleTransition, slide, swap, wipe, zoomBlur as zoomBlurTransition, zoomInOut, } from './transitions.js';
export const EFFECTS = {
    // color
    brightness,
    contrast,
    exposure,
    saturation,
    vibrance,
    hue,
    tint,
    grayscale,
    duotone,
    invert,
    levels,
    'white-balance': whiteBalance,
    'shadows-highlights': shadowsHighlights,
    'thermal-vision': thermalVision,
    'color-key': colorKey,
    lut,
    'gradient-map': gradientMap,
    'linear-gradient-tint': gradientMap,
    // blur / light
    blur,
    'region-blur': regionBlur,
    'linear-progressive-blur': linearProgressiveBlur,
    'radial-progressive-blur': radialProgressiveBlur,
    'zoom-blur': zoomBlur,
    'motion-blur': motionBlur,
    'light-trail': lightTrail,
    'drop-shadow': dropShadow,
    glow,
    'chromatic-aberration': chromaticAberration,
    vignette,
    shine,
    'light-leak': lightLeak,
    'linear-gradient': linearGradient,
    // noise / grain / pattern / stylized overlays
    noise,
    'white-noise': whiteNoise,
    film,
    'film-grain': film,
    grain,
    speckle,
    paper,
    halftone,
    'halftone-linear-gradient': halftoneLinearGradient,
    scanlines,
    gridlines,
    'dot-grid': dotGrid,
    checkerboard,
    lines,
    rings,
    zigzag,
    starburst,
    'venetian-blinds': venetianBlinds,
    'contour-lines': contourLines,
    'liquid-contours': liquidContours,
    burlap,
    flannel,
    evolve,
    // geometric / distortion
    translate,
    scale,
    skew,
    mirror,
    tile,
    'pattern-tile': tile,
    fisheye,
    'barrel-distortion': barrelDistortion,
    wave,
    waves,
    ripple,
    displacement,
    'noise-displacement': noiseDisplacement,
    'corner-pin': cornerPin,
    pixelate,
    'linear-progressive-pixelate': linearProgressivePixelate,
    'radial-progressive-pixelate': radialProgressivePixelate,
    'pixel-dissolve': pixelDissolve,
    tear,
    'tv-signal-off': tvSignalOff,
    // stylize
    outline,
    emboss,
    'roughen-edges': roughenEdges,
};
export const TRANSITIONS = {
    none,
    fade,
    slide,
    wipe,
    flip,
    'clock-wipe': clockWipe,
    'book-flip': bookFlip,
    iris,
    'zoom-blur': zoomBlurTransition,
    'dreamy-zoom': dreamyZoom,
    'film-burn': filmBurn,
    'linear-blur': linearBlur,
    'zoom-in-out': zoomInOut,
    dissolve,
    ripple: rippleTransition,
    crosswarp,
    'cross-zoom': crossZoom,
    swap,
    'push-cut': pushCut,
};
export const transitionNames = () => Object.keys(TRANSITIONS).sort();
/** Blend pre-rendered A/B scenes at eased progress. Throws on unknown types. */
export const applyTransitionByName = (t, name, progress, rawParams) => {
    const def = TRANSITIONS[name];
    if (!def) {
        throw new Error(`Unknown transition "${name}". Known: ${transitionNames().join(', ')}`);
    }
    if (!Number.isFinite(progress)) {
        throw new Error('Transition progress must be finite');
    }
    def.apply(t, Math.min(1, Math.max(0, progress)), { ...def.defaults, ...(rawParams ?? {}) });
};
export const effectNames = () => Object.keys(EFFECTS).sort();
const clipped = (ecx, region, fn) => {
    // Pixel ops (get/putImageData) ignore clip paths, so enforce regions by
    // snapshotting and restoring everything outside the rect. Works for both
    // pixel and draw-based effects.
    const rx = Math.max(0, Math.floor(region.x));
    const ry = Math.max(0, Math.floor(region.y));
    const rw = Math.min(ecx.width - rx, Math.ceil(region.width));
    const rh = Math.min(ecx.height - ry, Math.ceil(region.height));
    if (rw <= 0 || rh <= 0) {
        return;
    }
    const before = ecx.ctx.getImageData(0, 0, ecx.width, ecx.height);
    const snapshot = new Uint8ClampedArray(before.data);
    fn();
    const after = ecx.ctx.getImageData(0, 0, ecx.width, ecx.height);
    const ad = after.data;
    for (let y = 0; y < ecx.height; y += 1) {
        if (y >= ry && y < ry + rh) {
            continue; // inside: keep effect output (row fully inside only if full-width)
        }
        for (let x = 0; x < ecx.width; x += 1) {
            const i = (y * ecx.width + x) * 4;
            ad[i] = snapshot[i];
            ad[i + 1] = snapshot[i + 1];
            ad[i + 2] = snapshot[i + 2];
            ad[i + 3] = snapshot[i + 3];
        }
    }
    // Partial rows: restore pixels left/right of the rect.
    for (let y = ry; y < ry + rh; y += 1) {
        for (let x = 0; x < rx; x += 1) {
            const i = (y * ecx.width + x) * 4;
            ad[i] = snapshot[i];
            ad[i + 1] = snapshot[i + 1];
            ad[i + 2] = snapshot[i + 2];
            ad[i + 3] = snapshot[i + 3];
        }
        for (let x = rx + rw; x < ecx.width; x += 1) {
            const i = (y * ecx.width + x) * 4;
            ad[i] = snapshot[i];
            ad[i + 1] = snapshot[i + 1];
            ad[i + 2] = snapshot[i + 2];
            ad[i + 3] = snapshot[i + 3];
        }
    }
    ecx.ctx.putImageData(after, 0, 0);
};
/** Apply one named effect with merged defaults. Throws on unknown names. */
export const applyEffectByName = (ecx, name, rawParams, region) => {
    const def = EFFECTS[name];
    if (!def) {
        const known = effectNames().join(', ');
        throw new Error(`Unknown effect "${name}". Known: ${known}`);
    }
    const params = { ...def.defaults, ...(rawParams ?? {}) };
    if (region) {
        clipped(ecx, region, () => def.apply(ecx, params));
        return;
    }
    def.apply(ecx, params);
};
/** Descriptor form (matches core Effect): honors disabled, passes region. */
export const applyEffect = (ecx, effect, region) => {
    if (effect.disabled === true) {
        return;
    }
    applyEffectByName(ecx, effect.type, effect.params, region);
};
//# sourceMappingURL=registry.js.map
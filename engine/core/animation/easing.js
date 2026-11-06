/**
 * M1 — Easing functions (all 18 reference members).
 * Edge/clamping behavior preserved; Easing.spring bridges to spring.ts.
 */
import { bezier } from './bezier.js';
import { measureSpring, spring } from './spring.js';
const clampUnit = (t) => Math.min(1, Math.max(0, t));
const step0 = (n) => (n > 0 ? 1 : 0);
const step1 = (n) => (n >= 1 ? 1 : 0);
const linear = (t) => t;
const ease = bezier(0.42, 0, 1, 1);
const quad = (t) => t * t;
const cubic = (t) => t * t * t;
const poly = (n) => ((t) => t ** n);
const sin = (t) => 1 - Math.cos((t * Math.PI) / 2);
const circle = (t) => {
    const u = clampUnit(t);
    return 1 - Math.sqrt(1 - u * u);
};
const exp = (t) => 2 ** (10 * (t - 1));
const elastic = (bounciness = 1) => ((t) => {
    const p = bounciness * Math.PI;
    return 1 - Math.cos((t * Math.PI) / 2) ** 3 * Math.cos(t * p);
});
const back = (s = 1.70158) => ((t) => t * t * ((s + 1) * t - s));
const bounce = (t) => {
    const u = clampUnit(t);
    if (u < 1 / 2.75) {
        return 7.5625 * u * u;
    }
    if (u < 2 / 2.75) {
        const v = u - 1.5 / 2.75;
        return 7.5625 * v * v + 0.75;
    }
    if (u < 2.5 / 2.75) {
        const v = u - 2.25 / 2.75;
        return 7.5625 * v * v + 0.9375;
    }
    const v = u - 2.625 / 2.75;
    return 7.5625 * v * v + 0.984375;
};
const springEasing = (config) => {
    const allowTail = config?.allowTail ?? false;
    const fn = ((t) => {
        if (t <= 0) {
            return 0;
        }
        if (!allowTail && t >= 1) {
            return 1;
        }
        if (allowTail) {
            const natural = measureSpring({
                fps: 30,
                config,
                threshold: config?.durationRestThreshold,
            });
            return spring({ fps: 30, frame: t * natural, config });
        }
        return spring({ fps: 30, frame: t * 30, config, durationInFrames: 30 });
    });
    fn.remotionShouldExtendRight =
        allowTail;
    return fn;
};
const inModifier = (fn) => fn;
const outModifier = (fn) => ((t) => 1 - fn(1 - t));
const inOutModifier = (fn) => ((t) => t < 0.5 ? fn(t * 2) / 2 : 1 - fn((1 - t) * 2) / 2);
export const Easing = {
    step0,
    step1,
    linear,
    ease,
    quad,
    cubic,
    poly,
    sin,
    circle,
    exp,
    elastic,
    back,
    spring: springEasing,
    bounce,
    bezier,
    in: inModifier,
    out: outModifier,
    inOut: inOutModifier,
};
//# sourceMappingURL=easing.js.map
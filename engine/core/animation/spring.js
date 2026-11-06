/**
 * M1 — Spring physics (damped harmonic oscillator, analytic integrator).
 * Matches reference behavior including defaults and edge cases:
 * defaults {damping:10, mass:1, stiffness:100, overshootClamping:false}.
 * Note: the critical-damping branch is also used for over-damped (zeta>=1),
 * mirroring the reference — do NOT "fix" this; parity comes first.
 */
import { interpolate } from './interpolate.js';
export const DEFAULT_SPRING_CONFIG = {
    damping: 10,
    mass: 1,
    stiffness: 100,
    overshootClamping: false,
};
export const DEFAULT_SPRING_THRESHOLD = 0.005;
export const resolveSpringConfig = (config) => ({
    damping: config?.damping ?? DEFAULT_SPRING_CONFIG.damping,
    mass: config?.mass ?? DEFAULT_SPRING_CONFIG.mass,
    stiffness: config?.stiffness ?? DEFAULT_SPRING_CONFIG.stiffness,
    overshootClamping: config?.overshootClamping ?? DEFAULT_SPRING_CONFIG.overshootClamping,
});
const advance = ({ state, now, toValue, config }) => {
    const deltaTime = Math.min(now - state.lastTimestamp, 64);
    const t = deltaTime / 1000;
    const c = config.damping;
    const m = config.mass;
    const k = config.stiffness;
    if (c <= 0) {
        throw new Error('Spring damping must be greater than 0');
    }
    const v0 = -state.velocity;
    const x0 = toValue - state.current;
    const zeta = c / (2 * Math.sqrt(k * m));
    const omega0 = Math.sqrt(k / m);
    state.lastTimestamp = now;
    if (zeta < 1) {
        const omega1 = omega0 * Math.sqrt(1 - zeta * zeta);
        const sin1 = Math.sin(omega1 * t);
        const cos1 = Math.cos(omega1 * t);
        const envelope = Math.exp(-zeta * omega0 * t);
        const frag1 = envelope * (sin1 * ((v0 + zeta * omega0 * x0) / omega1) + x0 * cos1);
        state.current = toValue - frag1;
        state.velocity =
            zeta * omega0 * frag1 -
                envelope * (cos1 * (v0 + zeta * omega0 * x0) - omega1 * x0 * sin1);
        return;
    }
    // zeta >= 1: critical branch (also used for over-damped, per reference).
    const envelope = Math.exp(-omega0 * t);
    state.current = toValue - envelope * (x0 + (v0 + omega0 * x0) * t);
    state.velocity =
        envelope * (v0 * (t * omega0 - 1) + t * x0 * omega0 * omega0);
};
const springCache = new Map();
const springCalculation = (frame, fps, config) => {
    const cacheKey = [frame, fps, config.damping, config.mass, config.stiffness].join(',');
    const cached = springCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    const state = { current: 0, velocity: 0, lastTimestamp: 0 };
    const clamped = Math.max(0, frame);
    const fullFrames = Math.floor(clamped);
    for (let f = 0; f <= fullFrames; f += 1) {
        advance({ state, now: (f / fps) * 1000, toValue: 1, config });
    }
    const remainder = clamped % 1;
    if (remainder > 0) {
        advance({
            state,
            now: ((fullFrames + remainder) / fps) * 1000,
            toValue: 1,
            config,
        });
    }
    springCache.set(cacheKey, state.current);
    return state.current;
};
const measureCache = new Map();
/** Frames until the spring settles within `threshold` (and stays 20 frames). */
export const measureSpring = ({ fps, config, threshold = DEFAULT_SPRING_THRESHOLD, }) => {
    if (threshold === 0) {
        return Infinity;
    }
    if (threshold === 1) {
        return 0;
    }
    if (!Number.isFinite(threshold) || Number.isNaN(threshold) || threshold < 0) {
        throw new Error('measureSpring threshold must be in (0, 1)');
    }
    const resolved = resolveSpringConfig(config);
    const cacheKey = [fps, resolved.damping, resolved.mass, resolved.stiffness, threshold].join(',');
    const cached = measureCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    let frame = 0;
    let animation = springCalculation(frame, fps, resolved);
    while (Math.abs(animation - 1) >= threshold) {
        frame += 1;
        animation = springCalculation(frame, fps, resolved);
    }
    let finishedFrame = frame;
    for (let i = 0; i < 20; i += 1) {
        frame += 1;
        animation = springCalculation(frame, fps, resolved);
        if (Math.abs(animation - 1) >= threshold) {
            i = 0;
            finishedFrame = frame + 1;
        }
    }
    measureCache.set(cacheKey, finishedFrame);
    return finishedFrame;
};
/**
 * Spring value for a frame. Pure in (frame, fps, config, from/to, …).
 * Supports delay, reverse, durationInFrames time-stretch, overshootClamping.
 */
export const spring = ({ frame, fps, config, from = 0, to = 1, durationInFrames, durationRestThreshold, delay = 0, reverse = false, }) => {
    const resolved = resolveSpringConfig(config);
    const threshold = durationRestThreshold ?? DEFAULT_SPRING_THRESHOLD;
    const needsNatural = reverse || durationInFrames !== undefined;
    const naturalDuration = needsNatural
        ? measureSpring({ fps, config: resolved, threshold })
        : undefined;
    const passedFrame = frame;
    const reverseProcessed = reverse
        ? (durationInFrames ?? naturalDuration) - passedFrame
        : passedFrame;
    const delayProcessed = reverseProcessed + (reverse ? delay : -delay);
    if (durationInFrames !== undefined && delayProcessed > durationInFrames) {
        return to;
    }
    const durationProcessed = durationInFrames === undefined
        ? delayProcessed
        : delayProcessed / (durationInFrames / naturalDuration);
    const value = springCalculation(durationProcessed, fps, resolved);
    const clamped = resolved.overshootClamping
        ? to >= from
            ? Math.min(value, to)
            : Math.max(value, to)
        : value;
    if (from === 0 && to === 1) {
        return clamped;
    }
    return interpolate(clamped, [0, 1], [from, to]);
};
//# sourceMappingURL=spring.js.map
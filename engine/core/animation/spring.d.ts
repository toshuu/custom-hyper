/**
 * M1 — Spring physics (damped harmonic oscillator, analytic integrator).
 * Matches reference behavior including defaults and edge cases:
 * defaults {damping:10, mass:1, stiffness:100, overshootClamping:false}.
 * Note: the critical-damping branch is also used for over-damped (zeta>=1),
 * mirroring the reference — do NOT "fix" this; parity comes first.
 */
import type { ResolvedSpringConfig, SpringConfig, SpringOptions } from './types.js';
export declare const DEFAULT_SPRING_CONFIG: ResolvedSpringConfig;
export declare const DEFAULT_SPRING_THRESHOLD = 0.005;
export declare const resolveSpringConfig: (config?: SpringConfig) => ResolvedSpringConfig;
/** Frames until the spring settles within `threshold` (and stays 20 frames). */
export declare const measureSpring: ({ fps, config, threshold, }: {
    fps: number;
    config?: SpringConfig;
    threshold?: number;
}) => number;
/**
 * Spring value for a frame. Pure in (frame, fps, config, from/to, …).
 * Supports delay, reverse, durationInFrames time-stretch, overshootClamping.
 */
export declare const spring: ({ frame, fps, config, from, to, durationInFrames, durationRestThreshold, delay, reverse, }: SpringOptions) => number;
//# sourceMappingURL=spring.d.ts.map
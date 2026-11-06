/**
 * M1 — Shared animation types.
 * Remotion-compatible semantics, X80-owned implementation.
 */
export type ExtrapolateType = 'extend' | 'identity' | 'clamp' | 'wrap';
export type InterpolateOutputMode = 'linear' | 'perceptual-scale';
/** Easing maps unit input [0,1] (possibly outside under extend) to unit output. */
export type EasingFunction = ((input: number) => number) & {
    readonly remotionShouldExtendRight?: boolean;
};
export interface InterpolateOptions {
    easing?: EasingFunction | readonly EasingFunction[];
    extrapolateLeft?: ExtrapolateType;
    extrapolateRight?: ExtrapolateType;
    /** 'perceptual-scale' squares magnitudes so scale ramps feel linear. */
    output?: InterpolateOutputMode;
    /** Quantize input first: floor(input / posterize) * posterize. */
    posterize?: number;
}
export interface SpringConfig {
    damping?: number;
    mass?: number;
    stiffness?: number;
    overshootClamping?: boolean;
}
export interface ResolvedSpringConfig {
    damping: number;
    mass: number;
    stiffness: number;
    overshootClamping: boolean;
}
export interface SpringOptions {
    frame: number;
    fps: number;
    config?: SpringConfig;
    from?: number;
    to?: number;
    durationInFrames?: number;
    durationRestThreshold?: number;
    delay?: number;
    reverse?: boolean;
}
export type RandomSeed = number | string | null;
//# sourceMappingURL=types.d.ts.map
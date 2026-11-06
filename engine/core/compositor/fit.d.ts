/**
 * M5 — Object-fit math (pure). Maps an intrinsic asset box into a node box.
 * All rects in px; dx/dy relative to the node-box origin (top-left).
 */
export type FitMode = 'cover' | 'contain' | 'fill' | 'none';
export interface FitRect {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
}
export declare const computeFit: (srcW: number, srcH: number, dstW: number, dstH: number, fit: FitMode) => FitRect;
/**
 * Frame-accurate media mapping: leaf-local frame → source frame index.
 * All media-time trims in SECONDS; playbackRate scales local time.
 */
export interface MediaSample {
    /** Seconds into the source where playback starts (before trims). */
    startFrom?: number;
    trimBefore?: number;
    trimAfter?: number;
    playbackRate?: number;
    /** true = wrap; 'pingpong' = forward-backward (no jump cuts on short clips). */
    loop?: boolean | 'pingpong';
}
export declare const mediaFrameIndexAt: (localFrame: number, fps: number, sourceFps: number, sourceDurationSec: number, opts?: MediaSample) => number;
//# sourceMappingURL=fit.d.ts.map
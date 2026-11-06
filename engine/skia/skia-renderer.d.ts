/**
 * M3 — Skia backend for the agnostic Renderer interface.
 * Implemented on @napi-rs/canvas (Skia). No timeline/animation logic here:
 * all frame math happens in @x80/core's compositor; this file only turns
 * draw calls into pixels.
 *
 * Conventions (documented, M4 may refine text):
 * - setTransform COMPOSES onto the current transform: T · A · R · S · A⁻¹
 *   (callers bracket with save/restore).
 * - Circle geometry: bounding box (0,0,2r,2r), center (r,r).
 * - Text y = TOP of the em box (textBaseline 'top'); 'justify' → 'left'.
 */
import type { ColorInput, DrawImageOptions, DrawRectOptions, DrawRoundedRectOptions, DrawTextOptions, FrameBuffer, Renderer, Surface, TransitionApplier, TransitionSpec } from '../../core/index.js';
export declare class SkiaRenderer implements Renderer {
    readonly name = "skia (@napi-rs/canvas)";
    private readonly states;
    private stateOf;
    createSurface(width: number, height: number): Surface;
    destroySurface(surface: Surface): void;
    clear(surface: Surface, color?: ColorInput): void;
    save(surface: Surface): void;
    restore(surface: Surface): void;
    setOpacity(surface: Surface, opacity: number): void;
    setBlendMode(surface: Surface, blendMode: string): void;
    setFilter(surface: Surface, filter: string | undefined): void;
    setTransform(surface: Surface, transform: {
        translateX?: number;
        translateY?: number;
        scaleX?: number;
        scaleY?: number;
        rotation?: number;
        skewX?: number;
        skewY?: number;
        anchorX?: number;
        anchorY?: number;
    }): void;
    clipRect(surface: Surface, rect: {
        x: number;
        y: number;
        width: number;
        height: number;
        radius?: number | [number, number, number, number];
    }): void;
    drawRect(surface: Surface, x: number, y: number, width: number, height: number, opts?: DrawRectOptions): void;
    drawRoundedRect(surface: Surface, x: number, y: number, width: number, height: number, opts: DrawRoundedRectOptions): void;
    drawCircle(surface: Surface, cx: number, cy: number, radius: number, opts?: DrawRectOptions): void;
    drawPath(surface: Surface, d: string, opts?: DrawRectOptions): void;
    drawImage(surface: Surface, image: unknown, opts: DrawImageOptions): void;
    drawText(surface: Surface, text: string, x: number, y: number, opts: DrawTextOptions): void;
    drawVideoFrame(): void;
    applyEffect(surface: Surface, effect: {
        type: string;
        params?: Record<string, unknown>;
        disabled?: boolean;
    }, region?: {
        x: number;
        y: number;
        width: number;
        height: number;
    }): void;
    applyTransition(target: Surface, a: Surface, b: Surface, spec: TransitionSpec): void;
    composite(target: Surface, source: Surface, opts?: {
        x?: number;
        y?: number;
        opacity?: number;
        blendMode?: string;
    }): void;
    readPixels(surface: Surface): FrameBuffer;
    /**
     * CSS `backdrop-filter: blur()` equivalent: blurs already-painted pixels
     * inside `region` (surface units, clamped). Gaussian bleed is sampled
     * from outside the region so edges don't darken; the write-back is
     * clipped to the (optionally rounded) region. Runs on the native
     * `ctx.filter` fast path. Radius 0 is a no-op; negative/non-finite
     * radii throw.
     */
    blurRegion(surface: Surface, region: {
        x: number;
        y: number;
        width: number;
        height: number;
    }, radius: number, cornerRadius?: number | [number, number, number, number]): void;
    /** M3 helper: PNG-encode a surface (test/CLI use, not part of the interface). */
    encodePng(surface: Surface): Promise<Buffer>;
}
/** RenderFrameOptions.transitionApplier wiring for this backend. */
export declare const skiaTransitionApplier: (renderer: SkiaRenderer) => TransitionApplier;
//# sourceMappingURL=skia-renderer.d.ts.map
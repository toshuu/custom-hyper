/**
 * M0 — Renderer backend abstraction.
 * Timeline/animation code must NEVER know which backend produces pixels.
 * Backends: Skia (first) | GPU | Vello | Pixi | browser fallback.
 */
export interface RgbaColor {
    r: number;
    g: number;
    b: number;
    a: number;
}
export type ColorInput = string | RgbaColor;
/**
 * Declarative linear gradient fill (CSS `linear-gradient(angle, stops)`
 * semantics, JSON-serializable). `angle` is CSS degrees clockwise from up:
 * 90 = left→right, 180 = top→bottom (default). Offsets must ascend in
 * [0, 1]; backends resolve the gradient over the shape's own bounding box.
 */
export interface GradientStop {
    offset: number;
    color: string;
}
export interface LinearGradientFill {
    kind: 'linear';
    angle?: number;
    stops: GradientStop[];
}
/**
 * Declarative radial gradient (CSS `radial-gradient()` essentials,
 * JSON-serializable). Center as bbox fractions (default 0.5, 0.5);
 * radii as fractions of half the bbox diagonal (default inner 0,
 * outer 1 = edge-to-corner coverage, the ambient-glow workhorse).
 */
export interface RadialGradientFill {
    kind: 'radial';
    cx?: number;
    cy?: number;
    inner?: number;
    outer?: number;
    stops: GradientStop[];
}
/**
 * Declarative conic gradient (CSS `conic-gradient(from angle)`
 * essentials). Angle is CSS degrees clockwise from up; center as
 * bbox fractions (default 0.5, 0.5). Staged if the backend lacks
 * `createConicGradient`.
 */
export interface ConicGradientFill {
    kind: 'conic';
    angle?: number;
    cx?: number;
    cy?: number;
    stops: GradientStop[];
}
export type GradientFill = LinearGradientFill | RadialGradientFill | ConicGradientFill;
/** Any paint a shape or text run accepts: flat color or gradient. */
export type FillInput = ColorInput | GradientFill;
export interface Surface {
    readonly width: number;
    readonly height: number;
    readonly backend: string;
    /** Opaque native handle (canvas, texture, …). */
    readonly handle: unknown;
}
export interface FrameBuffer {
    readonly width: number;
    readonly height: number;
    /** Packed RGBA bytes, row-major, width*height*4. */
    readonly data: Uint8ClampedArray;
}
export interface DrawRectOptions {
    fill?: FillInput;
    stroke?: ColorInput;
    strokeWidth?: number;
    /** Canvas-style drop shadow (color/blur/offset); fill AND stroke cast it. */
    shadow?: TextShadowSpec;
}
export interface DrawRoundedRectOptions extends DrawRectOptions {
    radius: number | [number, number, number, number];
}
export interface DrawImageOptions {
    /** Source rect (crop) in source pixels. */
    sx?: number;
    sy?: number;
    sw?: number;
    sh?: number;
    /** Dest rect on the surface. */
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    opacity?: number;
}
export interface TextShadowSpec {
    color: ColorInput;
    blur?: number;
    offsetX?: number;
    offsetY?: number;
}
export interface DrawTextOptions {
    fontFamily: string;
    fontSize: number;
    fontWeight?: number | string;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    letterSpacing?: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    fill?: FillInput;
    stroke?: ColorInput;
    strokeWidth?: number;
    maxWidth?: number;
    shadow?: TextShadowSpec;
}
export interface Renderer {
    readonly name: string;
    createSurface(width: number, height: number): Surface;
    destroySurface(surface: Surface): void;
    clear(surface: Surface, color?: ColorInput): void;
    save(surface: Surface): void;
    restore(surface: Surface): void;
    setOpacity(surface: Surface, opacity: number): void;
    /** Optional; compositor uses it only when a node sets a non-default blendMode. */
    setBlendMode?(surface: Surface, blendMode: string): void;
    /**
     * Optional; compositor uses it only when a node sets `filter`.
     * Takes a CSS filter string (e.g. `"blur(35px) brightness(1.1)"`) or
     * `undefined` to clear. Scoped by the caller's save/restore.
     */
    setFilter?(surface: Surface, filter: string | undefined): void;
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
    drawVideoFrame(surface: Surface, videoFrame: unknown, opts: DrawImageOptions): void;
    /** Run one named effect over a region; params validated by effects package. */
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
    /**
     * Optional; compositor uses it only when a node sets `backdropBlur`.
     * Blurs already-painted pixels inside `region` (clamped to the surface),
     * optionally clipped to a rounded rect. Coordinates are in the caller's
     * current transform space — pass surface-space values under a
     * translation-only (or identity) transform.
     */
    blurRegion?(surface: Surface, region: {
        x: number;
        y: number;
        width: number;
        height: number;
    }, radius: number, cornerRadius?: number | [number, number, number, number]): void;
    composite(target: Surface, source: Surface, opts?: {
        x?: number;
        y?: number;
        opacity?: number;
        blendMode?: string;
    }): void;
    readPixels(surface: Surface): FrameBuffer;
}
//# sourceMappingURL=types.d.ts.map
/**
 * M6 — Effect contracts. Backend-agnostic standard-Canvas2D surface:
 * works with Skia (@napi-rs/canvas), browsers, or OffscreenCanvas.
 * Regions (when given) are composition-space px rects.
 */
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface GradientLike {
    addColorStop(offset: number, color: string): void;
}
export interface ImageDataLike {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}
/** Minimal structural Canvas2D context (implemented by the backend adapter). */
export interface CtxLike {
    getImageData(sx: number, sy: number, sw: number, sh: number): ImageDataLike;
    putImageData(img: ImageDataLike, dx: number, dy: number): void;
    createImageData(w: number, h: number): ImageDataLike;
    drawImage(img: unknown, ...args: number[]): void;
    save(): void;
    restore(): void;
    beginPath(): void;
    rect(x: number, y: number, w: number, h: number): void;
    clip(): void;
    arc(x: number, y: number, r: number, a0: number, a1: number): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    fill(): void;
    stroke(): void;
    translate(x: number, y: number): void;
    scale(x: number, y: number): void;
    rotate(a: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    createLinearGradient(x0: number, y0: number, x1: number, y1: number): GradientLike;
    createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): GradientLike;
    globalAlpha: number;
    globalCompositeOperation: string;
    fillStyle: string | GradientLike;
    strokeStyle: string | GradientLike;
    lineWidth: number;
    /** Standard Canvas2D blur (Skia C++ when available); may throw if unsupported. */
    filter: string;
}
export interface CanvasLike {
    width: number;
    height: number;
    getContext(kind: '2d'): CtxLike;
}
export interface TempSurface {
    canvas: CanvasLike;
    ctx: CtxLike;
}
export interface EffectContext {
    canvas: CanvasLike;
    ctx: CtxLike;
    width: number;
    height: number;
    createTemp: (w: number, h: number) => TempSurface;
}
export type EffectParams = Record<string, unknown>;
export interface EffectDef {
    /** Human description (docs generation). */
    describe: string;
    /** Defaults merged under user params (deep-merged one level for objects). */
    defaults: EffectParams;
    apply: (ecx: EffectContext, params: EffectParams, region?: Rect) => void;
}
//# sourceMappingURL=types.d.ts.map
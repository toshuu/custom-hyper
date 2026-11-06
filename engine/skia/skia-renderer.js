/**
 * M3 — Skia backend for the agnostic Renderer interface.
 * Implemented on @napi-rs/canvas (Skia). No timeline/animation logic here:
 * all frame math happens in the core compositor; this file only turns
 * draw calls into pixels.
 *
 * Conventions (documented, M4 may refine text):
 * - setTransform COMPOSES onto the current transform: T · A · R · S · A⁻¹
 *   (callers bracket with save/restore).
 * - Circle geometry: bounding box (0,0,2r,2r), center (r,r).
 * - Text y = TOP of the em box (textBaseline 'top'); 'justify' → 'left'.
 */
import { Path2D, createCanvas } from '@napi-rs/canvas';
import { applyEffect as applyFxEffect, applyTransitionByName } from '../effects/index.js';
/** Adapt napi canvas to the backend-agnostic effect surface. */
const adaptCtx = (ctx) => ({
    getImageData: (sx, sy, sw, sh) => ctx.getImageData(sx, sy, sw, sh),
    putImageData: (img, dx, dy) => ctx.putImageData(img, dx, dy),
    createImageData: (w, h) => ctx.createImageData(w, h),
    drawImage: (img, ...args) => ctx.drawImage(img, ...args),
    save: () => ctx.save(),
    restore: () => ctx.restore(),
    beginPath: () => ctx.beginPath(),
    rect: (x, y, w, h) => ctx.rect(x, y, w, h),
    clip: () => ctx.clip(),
    arc: (x, y, r, a0, a1) => ctx.arc(x, y, r, a0, a1),
    moveTo: (x, y) => ctx.moveTo(x, y),
    lineTo: (x, y) => ctx.lineTo(x, y),
    fill: () => ctx.fill(),
    stroke: () => ctx.stroke(),
    translate: (x, y) => ctx.translate(x, y),
    scale: (x, y) => ctx.scale(x, y),
    rotate: (a) => ctx.rotate(a),
    fillRect: (x, y, w, h) => ctx.fillRect(x, y, w, h),
    createLinearGradient: (x0, y0, x1, y1) => ctx.createLinearGradient(x0, y0, x1, y1),
    createRadialGradient: (x0, y0, r0, x1, y1, r1) => ctx.createRadialGradient(x0, y0, r0, x1, y1, r1),
    get globalAlpha() {
        return ctx.globalAlpha;
    },
    set globalAlpha(v) {
        ctx.globalAlpha = v;
    },
    get globalCompositeOperation() {
        return ctx.globalCompositeOperation;
    },
    set globalCompositeOperation(v) {
        ctx.globalCompositeOperation = v;
    },
    get fillStyle() {
        return String(ctx.fillStyle);
    },
    set fillStyle(v) {
        ctx.fillStyle = v;
    },
    get strokeStyle() {
        return String(ctx.strokeStyle);
    },
    set strokeStyle(v) {
        ctx.strokeStyle = v;
    },
    get lineWidth() {
        return ctx.lineWidth;
    },
    set lineWidth(v) {
        ctx.lineWidth = v;
    },
    get filter() {
        return ctx.filter;
    },
    set filter(v) {
        ctx.filter = v;
    },
});
const adaptCanvas = (canvas) => 
// Keep the NATIVE handle: drawImage targets need it, and it
// structurally satisfies width/height/getContext.
canvas;
const makeTemp = (w, h) => {
    const canvas = createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    return { canvas: canvas, ctx: adaptCtx(canvas.getContext('2d')) };
};
const colorToCss = (color) => {
    if (typeof color === 'string') {
        return color;
    }
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
};
const isGradientFill = (fill) => typeof fill === 'object' && fill !== null && 'kind' in fill;
const validateStops = (stops) => {
    if (!Array.isArray(stops) || stops.length < 2) {
        throw new Error(`Gradient fill needs at least 2 stops (got ${String(stops?.length)})`);
    }
    let prev = -Infinity;
    for (const stop of stops) {
        if (!Number.isFinite(stop.offset) || stop.offset < 0 || stop.offset > 1) {
            throw new Error(`Gradient stop offset must be in [0, 1] (got ${String(stop.offset)})`);
        }
        if (stop.offset < prev) {
            throw new Error('Gradient stop offsets must ascend');
        }
        prev = stop.offset;
        if (typeof stop.color !== 'string' || stop.color.length === 0) {
            throw new Error('Gradient stop needs a non-empty color string');
        }
    }
    return stops;
};
/** CSS linear-gradient(angle) endpoints over a box (angle: deg clockwise from up). */
const linearEndpoints = (angle, box) => {
    const t = (angle * Math.PI) / 180;
    const dx = Math.sin(t);
    const dy = -Math.cos(t);
    const len = Math.abs(box.width * dx) + Math.abs(box.height * dy);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    return [cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2];
};
/**
 * Resolve a declarative fill to canvas state. Gradients resolve over the
 * shape's own bounding box. Throws loudly on bad specs (fewer than 2
 * stops, offsets outside [0, 1] or out of order, non-finite geometry).
 */
const resolveFillStyle = (ctx, fill, box) => {
    if (!isGradientFill(fill)) {
        return colorToCss(fill);
    }
    const stops = validateStops(fill.stops);
    if (fill.kind === 'linear') {
        const angle = fill.angle ?? 180;
        if (!Number.isFinite(angle)) {
            throw new Error(`Gradient fill needs a finite angle (got ${String(angle)})`);
        }
        const [x0, y0, x1, y1] = linearEndpoints(angle, box);
        const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
        for (const stop of stops) {
            gradient.addColorStop(stop.offset, stop.color);
        }
        return gradient;
    }
    if (fill.kind === 'radial') {
        const cxF = fill.cx ?? 0.5;
        const cyF = fill.cy ?? 0.5;
        const innerF = fill.inner ?? 0;
        const outerF = fill.outer ?? 1;
        for (const [name, v] of [['cx', cxF], ['cy', cyF], ['inner', innerF], ['outer', outerF]]) {
            if (!Number.isFinite(v)) {
                throw new Error(`Radial gradient needs finite ${name} (got ${String(v)})`);
            }
        }
        if (innerF < 0 || outerF <= 0 || innerF >= outerF) {
            throw new Error(`Radial gradient needs 0 <= inner < outer (got ${innerF}, ${outerF})`);
        }
        const half = Math.hypot(box.width, box.height) / 2;
        const gradient = ctx.createRadialGradient(box.x + cxF * box.width, box.y + cyF * box.height, innerF * half, box.x + cxF * box.width, box.y + cyF * box.height, outerF * half);
        for (const stop of stops) {
            gradient.addColorStop(stop.offset, stop.color);
        }
        return gradient;
    }
    const cxF = fill.cx ?? 0.5;
    const cyF = fill.cy ?? 0.5;
    const angle = fill.angle ?? 0;
    for (const [name, v] of [['cx', cxF], ['cy', cyF], ['angle', angle]]) {
        if (!Number.isFinite(v)) {
            throw new Error(`Conic gradient needs finite ${name} (got ${String(v)})`);
        }
    }
    const createConic = ctx.createConicGradient;
    if (typeof createConic !== 'function') {
        throw new Error('Conic gradient fill is staged (backend lacks createConicGradient)');
    }
    // CSS from-angle (clockwise from up) → canvas start angle (clockwise from east).
    const gradient = createConic.call(ctx, ((angle - 90) * Math.PI) / 180, box.x + cxF * box.width, box.y + cyF * box.height);
    for (const stop of stops) {
        gradient.addColorStop(stop.offset, stop.color);
    }
    return gradient;
};
const applyShadow = (ctx, shadow) => {
    if (shadow === undefined) {
        return;
    }
    ctx.shadowColor = colorToCss(shadow.color);
    ctx.shadowBlur = shadow.blur ?? 0;
    ctx.shadowOffsetX = shadow.offsetX ?? 0;
    ctx.shadowOffsetY = shadow.offsetY ?? 0;
};
const resetShadow = (ctx) => {
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
};
const applyFillStroke = (ctx, opts, box, fillPath) => {
    if (opts?.fill !== undefined) {
        ctx.fillStyle = resolveFillStyle(ctx, opts.fill, box);
        applyShadow(ctx, opts.shadow);
        fillPath();
        ctx.fill();
        resetShadow(ctx);
    }
    if (opts?.stroke !== undefined) {
        ctx.strokeStyle = colorToCss(opts.stroke);
        ctx.lineWidth = opts.strokeWidth ?? 1;
        applyShadow(ctx, opts.shadow);
        fillPath();
        ctx.stroke();
        resetShadow(ctx);
    }
};
const roundedRectPath = (ctx, x, y, w, h, radius) => {
    const [tl, tr, br, bl] = typeof radius === 'number'
        ? [radius, radius, radius, radius]
        : radius;
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
};
export class SkiaRenderer {
    name = 'skia (@napi-rs/canvas)';
    states = new WeakMap();
    stateOf(surface) {
        const state = this.states.get(surface);
        if (!state) {
            throw new Error('Unknown surface (create it with this renderer)');
        }
        return state;
    }
    createSurface(width, height) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const surface = {
            width,
            height,
            backend: this.name,
            handle: canvas,
        };
        this.states.set(surface, { canvas, ctx, alphaStack: [] });
        return surface;
    }
    destroySurface(surface) {
        this.states.delete(surface);
    }
    clear(surface, color = '#00000000') {
        const { ctx } = this.stateOf(surface);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = colorToCss(color);
        ctx.fillRect(0, 0, surface.width, surface.height);
        ctx.restore();
    }
    save(surface) {
        const state = this.stateOf(surface);
        state.alphaStack.push(state.ctx.globalAlpha);
        state.ctx.save();
    }
    restore(surface) {
        const state = this.stateOf(surface);
        state.ctx.restore();
        state.alphaStack.pop();
    }
    setOpacity(surface, opacity) {
        const state = this.stateOf(surface);
        const base = state.alphaStack.length > 0
            ? state.alphaStack[state.alphaStack.length - 1]
            : 1;
        state.ctx.globalAlpha = base * opacity;
    }
    setBlendMode(surface, blendMode) {
        this.stateOf(surface).ctx.globalCompositeOperation = blendMode;
    }
    setFilter(surface, filter) {
        this.stateOf(surface).ctx.filter = (filter ?? 'none');
    }
    setTransform(surface, transform) {
        const { ctx } = this.stateOf(surface);
        const tx = transform.translateX ?? 0;
        const ty = transform.translateY ?? 0;
        const sx = transform.scaleX ?? 1;
        const sy = transform.scaleY ?? 1;
        const deg = transform.rotation ?? 0;
        const kx = transform.skewX ?? 0;
        const ky = transform.skewY ?? 0;
        const ax = transform.anchorX ?? 0;
        const ay = transform.anchorY ?? 0;
        ctx.translate(tx, ty);
        if (ax !== 0 || ay !== 0) {
            ctx.translate(ax, ay);
        }
        if (deg !== 0) {
            ctx.rotate((deg * Math.PI) / 180);
        }
        if (kx !== 0 || ky !== 0) {
            ctx.transform(1, Math.tan((ky * Math.PI) / 180), Math.tan((kx * Math.PI) / 180), 1, 0, 0);
        }
        if (sx !== 1 || sy !== 1) {
            ctx.scale(sx, sy);
        }
        if (ax !== 0 || ay !== 0) {
            ctx.translate(-ax, -ay);
        }
    }
    clipRect(surface, rect) {
        const { ctx } = this.stateOf(surface);
        ctx.beginPath();
        if (rect.radius === undefined) {
            ctx.rect(rect.x, rect.y, rect.width, rect.height);
        }
        else {
            roundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, rect.radius);
        }
        ctx.clip();
    }
    drawRect(surface, x, y, width, height, opts) {
        const { ctx } = this.stateOf(surface);
        applyFillStroke(ctx, opts, { x, y, width, height }, () => {
            ctx.beginPath();
            ctx.rect(x, y, width, height);
        });
    }
    drawRoundedRect(surface, x, y, width, height, opts) {
        const { ctx } = this.stateOf(surface);
        applyFillStroke(ctx, opts, { x, y, width, height }, () => {
            ctx.beginPath();
            roundedRectPath(ctx, x, y, width, height, opts.radius);
        });
    }
    drawCircle(surface, cx, cy, radius, opts) {
        const { ctx } = this.stateOf(surface);
        applyFillStroke(ctx, opts, { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }, () => {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        });
    }
    drawPath(surface, d, opts) {
        const { ctx } = this.stateOf(surface);
        const path = new Path2D(d);
        if (opts?.fill !== undefined) {
            if (isGradientFill(opts.fill)) {
                throw new Error('Gradient fill on path nodes is staged (no bbox without rasterizing)');
            }
            ctx.fillStyle = colorToCss(opts.fill);
            applyShadow(ctx, opts.shadow);
            ctx.fill(path);
            resetShadow(ctx);
        }
        if (opts?.stroke !== undefined) {
            ctx.strokeStyle = colorToCss(opts.stroke);
            ctx.lineWidth = opts.strokeWidth ?? 1;
            applyShadow(ctx, opts.shadow);
            ctx.stroke(path);
            resetShadow(ctx);
        }
    }
    drawImage(surface, image, opts) {
        const { ctx } = this.stateOf(surface);
        const img = image;
        if (opts.sx !== undefined &&
            opts.sy !== undefined &&
            opts.sw !== undefined &&
            opts.sh !== undefined) {
            ctx.drawImage(img, opts.sx, opts.sy, opts.sw, opts.sh, opts.dx, opts.dy, opts.dw, opts.dh);
        }
        else {
            ctx.drawImage(img, opts.dx, opts.dy, opts.dw, opts.dh);
        }
    }
    drawText(surface, text, x, y, opts) {
        const { ctx } = this.stateOf(surface);
        const weight = opts.fontWeight === undefined ? '400' : String(opts.fontWeight);
        const style = opts.fontStyle ?? 'normal';
        ctx.font = `${style} ${weight} ${opts.fontSize}px "${opts.fontFamily}", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign =
            opts.textAlign === 'center' || opts.textAlign === 'right' ? opts.textAlign : 'left';
        if (opts.shadow !== undefined) {
            ctx.shadowColor = colorToCss(opts.shadow.color);
            ctx.shadowBlur = opts.shadow.blur ?? 0;
            ctx.shadowOffsetX = opts.shadow.offsetX ?? 0;
            ctx.shadowOffsetY = opts.shadow.offsetY ?? 0;
        }
        try {
            ctx.letterSpacing =
                `${opts.letterSpacing ?? 0}px`;
        }
        catch {
            // letterSpacing unsupported — non-fatal in M3.
        }
        if (opts.fill !== undefined) {
            if (isGradientFill(opts.fill)) {
                // backgroundClip:text equivalent: gradient over the run's own box.
                const w = Math.max(1, ctx.measureText(text).width);
                ctx.fillStyle = resolveFillStyle(ctx, opts.fill, {
                    x,
                    y,
                    width: w,
                    height: opts.fontSize,
                });
            }
            else {
                ctx.fillStyle = colorToCss(opts.fill);
            }
            ctx.fillText(text, x, y, opts.maxWidth);
        }
        if (opts.stroke !== undefined) {
            ctx.strokeStyle = colorToCss(opts.stroke);
            ctx.lineWidth = opts.strokeWidth ?? 1;
            ctx.strokeText(text, x, y, opts.maxWidth);
        }
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
    drawVideoFrame() {
        throw new Error('Video frame drawing arrives in M5');
    }
    applyEffect(surface, effect, region) {
        const state = this.stateOf(surface);
        const ecx = {
            canvas: adaptCanvas(state.canvas),
            ctx: adaptCtx(state.ctx),
            width: surface.width,
            height: surface.height,
            createTemp: makeTemp,
        };
        applyFxEffect(ecx, effect, region);
    }
    applyTransition(target, a, b, spec) {
        const t = this.stateOf(target);
        const sa = this.states.get(a);
        const sb = this.states.get(b);
        if (!sa || !sb) {
            throw new Error('Transition sources must be surfaces from this renderer');
        }
        applyTransitionByName({
            ctx: adaptCtx(t.ctx),
            width: target.width,
            height: target.height,
            a: sa.canvas,
            b: sb.canvas,
            createTemp: makeTemp,
        }, spec.type, spec.progress, spec.params);
    }
    composite(target, source, opts) {
        const t = this.stateOf(target);
        const s = this.states.get(source);
        if (!s) {
            throw new Error('composite source must be a surface from this renderer');
        }
        t.ctx.save();
        try {
            t.ctx.globalAlpha = opts?.opacity ?? 1;
            if (opts?.blendMode) {
                t.ctx.globalCompositeOperation = opts.blendMode;
            }
            t.ctx.drawImage(s.canvas, opts?.x ?? 0, opts?.y ?? 0);
        }
        finally {
            t.ctx.restore();
        }
    }
    readPixels(surface) {
        const state = this.stateOf(surface);
        const data = state.ctx.getImageData(0, 0, surface.width, surface.height).data;
        return { width: surface.width, height: surface.height, data };
    }
    /**
     * CSS `backdrop-filter: blur()` equivalent: blurs already-painted pixels
     * inside `region` (surface units, clamped). Gaussian bleed is sampled
     * from outside the region so edges don't darken; the write-back is
     * clipped to the (optionally rounded) region. Runs on the native
     * `ctx.filter` fast path. Radius 0 is a no-op; negative/non-finite
     * radii throw.
     */
    blurRegion(surface, region, radius, cornerRadius) {
        if (!Number.isFinite(radius) || radius < 0) {
            throw new Error(`blurRegion radius must be a finite number >= 0 (got ${String(radius)})`);
        }
        if (radius === 0) {
            return;
        }
        for (const [k, v] of Object.entries(region)) {
            if (!Number.isFinite(v)) {
                throw new Error(`blurRegion region.${k} must be finite (got ${String(v)})`);
            }
        }
        const r = Math.min(100, radius);
        const state = this.stateOf(surface);
        const x0 = Math.max(0, Math.floor(region.x));
        const y0 = Math.max(0, Math.floor(region.y));
        const x1 = Math.min(surface.width, Math.ceil(region.x + region.width));
        const y1 = Math.min(surface.height, Math.ceil(region.y + region.height));
        if (x1 <= x0 || y1 <= y0) {
            return;
        }
        const bleed = Math.ceil(r * 3);
        const sx = Math.max(0, x0 - bleed);
        const sy = Math.max(0, y0 - bleed);
        const sx1 = Math.min(surface.width, x1 + bleed);
        const sy1 = Math.min(surface.height, y1 + bleed);
        const snap = createCanvas(sx1 - sx, sy1 - sy);
        const snapCtx = snap.getContext('2d');
        snapCtx.drawImage(state.canvas, sx, sy, sx1 - sx, sy1 - sy, 0, 0, sx1 - sx, sy1 - sy);
        const { ctx } = state;
        ctx.save();
        try {
            ctx.beginPath();
            if (cornerRadius === undefined || cornerRadius === 0) {
                ctx.rect(region.x, region.y, region.width, region.height);
            }
            else {
                roundedRectPath(ctx, region.x, region.y, region.width, region.height, cornerRadius);
            }
            ctx.clip();
            try {
                ctx.filter = `blur(${r}px)`;
            }
            catch {
                // No native filter: fall back to an unblurred write-back rather
                // than failing the frame (still deterministic).
            }
            ctx.drawImage(snap, sx, sy);
            try {
                ctx.filter = 'none';
            }
            catch {
                // ignore
            }
        }
        finally {
            ctx.restore();
        }
    }
    /** M3 helper: PNG-encode a surface (test/CLI use, not part of the interface). */
    async encodePng(surface) {
        const state = this.stateOf(surface);
        return state.canvas.encode('png');
    }
}
/** RenderFrameOptions.transitionApplier wiring for this backend. */
export const skiaTransitionApplier = (renderer) => (target, a, b, spec) => renderer.applyTransition(target, a, b, spec);
//# sourceMappingURL=skia-renderer.js.map

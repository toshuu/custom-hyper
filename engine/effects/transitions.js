import { clamp01, hash2, num, str } from './util.js';
const dirVec = (direction) => {
    switch (direction) {
        case 'left':
            return [-1, 0];
        case 'right':
            return [1, 0];
        case 'up':
            return [0, -1];
        case 'down':
            return [0, 1];
        default:
            throw new Error(`direction must be left|right|up|down (got "${direction}")`);
    }
};
const drawFull = (ctx, img, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, 0, 0);
    ctx.restore();
};
const maskedB = (t, mask) => {
    drawFull(t.ctx, t.a, 1);
    const temp = t.createTemp(t.width, t.height);
    temp.ctx.drawImage(t.b, 0, 0);
    temp.ctx.save();
    temp.ctx.globalCompositeOperation = 'destination-in';
    mask(temp.ctx);
    temp.ctx.restore();
    t.ctx.drawImage(temp.canvas, 0, 0);
};
const tempOf = (t, img) => {
    const temp = t.createTemp(t.width, t.height);
    temp.ctx.drawImage(img, 0, 0);
    return temp;
};
export const none = {
    describe: 'Hard cut at p>=1.',
    defaults: {},
    apply: (t, p) => drawFull(t.ctx, p < 1 ? t.a : t.b, 1),
};
export const fade = {
    describe: 'Crossfade.',
    defaults: {},
    apply: (t, p) => {
        drawFull(t.ctx, t.a, 1);
        drawFull(t.ctx, t.b, clamp01(p));
    },
};
export const slide = {
    describe: 'B slides over static A. direction left|right|up|down.',
    defaults: { direction: 'left' },
    apply: (t, p, params) => {
        const [dx, dy] = dirVec(str(params, 'direction', 'left'));
        drawFull(t.ctx, t.a, 1);
        t.ctx.save();
        t.ctx.translate(-dx * (1 - p) * t.width, -dy * (1 - p) * t.height);
        t.ctx.drawImage(t.b, 0, 0);
        t.ctx.restore();
    },
};
export const pushCut = {
    describe: 'A pushes out as B pushes in (same vector).',
    defaults: { direction: 'left' },
    apply: (t, p, params) => {
        const [dx, dy] = dirVec(str(params, 'direction', 'left'));
        t.ctx.save();
        t.ctx.translate(dx * p * t.width, dy * p * t.height);
        t.ctx.drawImage(t.a, 0, 0);
        t.ctx.restore();
        t.ctx.save();
        t.ctx.translate(-dx * (1 - p) * t.width, -dy * (1 - p) * t.height);
        t.ctx.drawImage(t.b, 0, 0);
        t.ctx.restore();
    },
};
export const swap = {
    describe: 'A exits toward direction while B enters from the opposite side.',
    defaults: { direction: 'left' },
    apply: (t, p, params) => {
        const [dx, dy] = dirVec(str(params, 'direction', 'left'));
        t.ctx.save();
        t.ctx.translate(dx * p * t.width, dy * p * t.height);
        t.ctx.drawImage(t.a, 0, 0);
        t.ctx.restore();
        t.ctx.save();
        t.ctx.translate(dx * (1 - p) * t.width, dy * (1 - p) * t.height);
        t.ctx.drawImage(t.b, 0, 0);
        t.ctx.restore();
    },
};
export const wipe = {
    describe: 'B revealed by a moving edge. softness 0..1 feather.',
    defaults: { direction: 'left', softness: 0 },
    apply: (t, p, params) => {
        const dir = str(params, 'direction', 'left');
        const soft = clamp01(num(params, 'softness', 0));
        const W = t.width;
        const H = t.height;
        maskedB(t, (ctx) => {
            if (soft <= 0) {
                ctx.fillStyle = '#fff';
                if (dir === 'left') {
                    ctx.fillRect(0, 0, W * p, H);
                }
                else if (dir === 'right') {
                    ctx.fillRect(W * (1 - p), 0, W * p, H);
                }
                else if (dir === 'up') {
                    ctx.fillRect(0, 0, W, H * p);
                }
                else if (dir === 'down') {
                    ctx.fillRect(0, H * (1 - p), W, H * p);
                }
                else {
                    throw new Error(`direction must be left|right|up|down (got "${dir}")`);
                }
                return;
            }
            const band = soft * (dir === 'left' || dir === 'right' ? W : H);
            const white = (x, y, w, h) => {
                ctx.fillStyle = '#fff';
                ctx.fillRect(x, y, w, h);
            };
            // Settled (fully revealed) area first, then the feather band at the edge.
            if (dir === 'left') {
                const e = W * p;
                white(0, 0, Math.max(0, e - band), H);
                const grad = ctx.createLinearGradient(e - band, 0, e, 0);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,1)');
                ctx.fillStyle = grad;
                ctx.fillRect(Math.max(0, e - band), 0, Math.min(band, e), H);
            }
            else if (dir === 'right') {
                const e = W * (1 - p);
                white(e + band, 0, Math.max(0, W - e - band), H);
                const grad = ctx.createLinearGradient(e + band, 0, e, 0);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,1)');
                ctx.fillStyle = grad;
                ctx.fillRect(e, 0, Math.min(band, W - e), H);
            }
            else if (dir === 'up') {
                const e = H * p;
                white(0, 0, W, Math.max(0, e - band));
                const grad = ctx.createLinearGradient(0, e - band, 0, e);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,1)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, Math.max(0, e - band), W, Math.min(band, e));
            }
            else if (dir === 'down') {
                const e = H * (1 - p);
                white(0, e + band, W, Math.max(0, H - e - band));
                const grad = ctx.createLinearGradient(0, e + band, 0, e);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,1)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, e, W, Math.min(band, H - e));
            }
            else {
                throw new Error(`direction must be left|right|up|down (got "${dir}")`);
            }
            return;
        });
    },
};
export const flip = {
    describe: 'Squash swap about center. axis x|y.',
    defaults: { axis: 'x' },
    apply: (t, p, params) => {
        const axis = str(params, 'axis', 'x');
        if (axis !== 'x' && axis !== 'y') {
            throw new Error('flip axis must be x|y');
        }
        const cx = t.width / 2;
        const cy = t.height / 2;
        const draw = (img, s) => {
            t.ctx.save();
            t.ctx.translate(cx, cy);
            if (axis === 'x') {
                t.ctx.scale(Math.max(0.001, s), 1);
            }
            else {
                t.ctx.scale(1, Math.max(0.001, s));
            }
            t.ctx.translate(-cx, -cy);
            t.ctx.drawImage(img, 0, 0);
            t.ctx.restore();
        };
        if (p < 0.5) {
            draw(t.a, 1 - 2 * p);
        }
        else {
            draw(t.b, 2 * p - 1);
        }
    },
};
export const bookFlip = {
    describe: 'Flip with a traveling shade. axis x|y, shade 0..1.',
    defaults: { axis: 'x', shade: 0.4 },
    apply: (t, p, params) => {
        flip.apply(t, p, params);
        const shade = clamp01(num(params, 'shade', 0.4)) * Math.sin(Math.PI * clamp01(p));
        if (shade > 0) {
            t.ctx.save();
            t.ctx.globalAlpha = shade;
            t.ctx.fillStyle = '#000000';
            t.ctx.fillRect(0, 0, t.width, t.height);
            t.ctx.restore();
        }
    },
};
export const clockWipe = {
    describe: 'Radial sweep reveal. startAngle degrees (default -90 = top).',
    defaults: { startAngle: -90 },
    apply: (t, p, params) => {
        const start = ((num(params, 'startAngle', -90) * Math.PI) / 180);
        drawFull(t.ctx, t.a, 1);
        if (p <= 0) {
            return;
        }
        if (p >= 1) {
            // A full-circle arc path is empty per spec — fast path instead.
            drawFull(t.ctx, t.b, 1);
            return;
        }
        const cx = t.width / 2;
        const cy = t.height / 2;
        const R = Math.sqrt(cx * cx + cy * cy);
        const temp = tempOf(t, t.b);
        temp.ctx.save();
        temp.ctx.globalCompositeOperation = 'destination-in';
        temp.ctx.beginPath();
        temp.ctx.moveTo(cx, cy);
        temp.ctx.arc(cx, cy, R, start, start + p * Math.PI * 2);
        temp.ctx.fill();
        temp.ctx.restore();
        t.ctx.drawImage(temp.canvas, 0, 0);
    },
};
export const iris = {
    describe: 'Circular reveal. shape circle (others staged).',
    defaults: { shape: 'circle' },
    apply: (t, p, params) => {
        const shape = str(params, 'shape', 'circle');
        if (shape !== 'circle') {
            throw new Error('iris shape must be circle (others staged)');
        }
        drawFull(t.ctx, t.a, 1);
        if (p <= 0) {
            return;
        }
        const cx = t.width / 2;
        const cy = t.height / 2;
        const R = Math.sqrt(cx * cx + cy * cy) * clamp01(p);
        const temp = tempOf(t, t.b);
        temp.ctx.save();
        temp.ctx.globalCompositeOperation = 'destination-in';
        temp.ctx.beginPath();
        temp.ctx.arc(cx, cy, R, 0, Math.PI * 2);
        temp.ctx.fill();
        temp.ctx.restore();
        t.ctx.drawImage(temp.canvas, 0, 0);
    },
};
const drawScaled = (t, img, scale, alpha, blurPx) => {
    const cx = t.width / 2;
    const cy = t.height / 2;
    t.ctx.save();
    t.ctx.globalAlpha = clamp01(alpha);
    try {
        t.ctx.filter = blurPx > 0.5 ? `blur(${blurPx.toFixed(1)}px)` : 'none';
    }
    catch {
        // filter unsupported — unblurred fallback
    }
    t.ctx.translate(cx, cy);
    t.ctx.scale(scale, scale);
    t.ctx.translate(-cx, -cy);
    t.ctx.drawImage(img, 0, 0);
    try {
        t.ctx.filter = 'none';
    }
    catch {
        // ignore
    }
    t.ctx.restore();
};
export const zoomBlur = {
    describe: 'A zooms+blurs out as B fades in. strength 0..1.',
    defaults: { strength: 0.5 },
    apply: (t, p, params) => {
        const s = clamp01(num(params, 'strength', 0.5));
        drawScaled(t, t.a, 1 + p * s, 1, p * s * 24);
        drawFull(t.ctx, t.b, p);
    },
};
export const dreamyZoom = {
    describe: 'B lands from a soft zoom over A. strength 0..1.',
    defaults: { strength: 0.5 },
    apply: (t, p, params) => {
        const s = clamp01(num(params, 'strength', 0.5));
        drawFull(t.ctx, t.a, 1);
        drawScaled(t, t.b, 1 + s * (1 - p), p, (1 - p) * s * 24);
    },
};
export const filmBurn = {
    describe: 'Hot flash through the cut. intensity 0..1, color.',
    defaults: { intensity: 0.8, color: '#ffd9a0' },
    apply: (t, p, params) => {
        drawFull(t.ctx, t.a, 1 - p);
        drawFull(t.ctx, t.b, p);
        const flash = clamp01(num(params, 'intensity', 0.8)) * Math.sin(Math.PI * clamp01(p));
        if (flash > 0) {
            const c = params.color;
            t.ctx.save();
            t.ctx.globalAlpha = flash;
            t.ctx.fillStyle = typeof c === 'string' ? c : '#ffd9a0';
            t.ctx.fillRect(0, 0, t.width, t.height);
            t.ctx.restore();
        }
    },
};
export const linearBlur = {
    describe: 'Blur sweep: B arrives blurred behind a moving sharp edge.',
    defaults: { direction: 'left', maxBlur: 16 },
    apply: (t, p, params) => {
        const dir = str(params, 'direction', 'left');
        const maxBlur = num(params, 'maxBlur', 16);
        if (p <= 0) {
            drawFull(t.ctx, t.a, 1);
            return;
        }
        if (p >= 1) {
            drawFull(t.ctx, t.b, 1);
            return;
        }
        drawFull(t.ctx, t.a, 1 - p);
        const W = t.width;
        const H = t.height;
        // Blurred B on a temp (filter applies on draw).
        const soft = t.createTemp(W, H);
        try {
            soft.ctx.filter = `blur(${Math.max(0.1, maxBlur * (1 - p)).toFixed(1)}px)`;
        }
        catch {
            // ignore
        }
        soft.ctx.drawImage(t.b, 0, 0);
        try {
            soft.ctx.filter = 'none';
        }
        catch {
            // ignore
        }
        // Mask the blurred B to the leading band, sharp B to settled area.
        const band = 0.2 * (dir === 'left' || dir === 'right' ? W : H);
        const bandRect = (() => {
            if (dir === 'left') {
                return [Math.max(0, W * p - band), 0, Math.min(band, W * p), H];
            }
            if (dir === 'right') {
                const x0 = W * (1 - p);
                return [x0, 0, Math.min(band, W - x0), H];
            }
            if (dir === 'up') {
                return [0, Math.max(0, H * p - band), W, Math.min(band, H * p)];
            }
            if (dir === 'down') {
                const y0 = H * (1 - p);
                return [0, y0, W, Math.min(band, H - y0)];
            }
            throw new Error(`direction must be left|right|up|down (got "${dir}")`);
        })();
        soft.ctx.save();
        soft.ctx.globalCompositeOperation = 'destination-in';
        soft.ctx.fillStyle = '#fff';
        soft.ctx.fillRect(...bandRect);
        soft.ctx.restore();
        // Sharp B in the settled area (behind the band).
        const sharpT = t.createTemp(W, H);
        sharpT.ctx.drawImage(t.b, 0, 0);
        sharpT.ctx.save();
        sharpT.ctx.globalCompositeOperation = 'destination-in';
        sharpT.ctx.fillStyle = '#fff';
        if (dir === 'left') {
            sharpT.ctx.fillRect(0, 0, Math.max(0, W * p - band), H);
        }
        else if (dir === 'right') {
            sharpT.ctx.fillRect(Math.min(W, W * (1 - p) + band), 0, W, H);
        }
        else if (dir === 'up') {
            sharpT.ctx.fillRect(0, 0, W, Math.max(0, H * p - band));
        }
        else {
            sharpT.ctx.fillRect(0, Math.min(H, H * (1 - p) + band), W, H);
        }
        sharpT.ctx.restore();
        t.ctx.drawImage(sharpT.canvas, 0, 0);
        t.ctx.drawImage(soft.canvas, 0, 0);
    },
};
export const zoomInOut = {
    describe: 'A shrinks out, then B grows in (split at p=0.5).',
    defaults: {},
    apply: (t, p) => {
        if (p < 0.5) {
            const q = p * 2;
            drawScaled(t, t.a, 1 - 0.3 * q, 1 - q, 0);
        }
        else {
            const q = (p - 0.5) * 2;
            drawScaled(t, t.b, 1.3 - 0.3 * q, q, 0);
        }
    },
};
export const crossZoom = {
    describe: 'Simultaneous zoom out/in crossfade. strength 0..1.',
    defaults: { strength: 0.4 },
    apply: (t, p, params) => {
        const s = clamp01(num(params, 'strength', 0.4));
        drawScaled(t, t.a, 1 + p * s, 1 - p, 0);
        drawScaled(t, t.b, 1 + s * (1 - p), p, 0);
    },
};
export const dissolve = {
    describe: 'Seeded stochastic mix. seed int.',
    defaults: { seed: 7 },
    apply: (t, p, params) => {
        const seed = num(params, 'seed', 7);
        drawFull(t.ctx, t.a, 1);
        if (p <= 0) {
            return;
        }
        if (p >= 1) {
            drawFull(t.ctx, t.b, 1);
            return;
        }
        const bTemp = tempOf(t, t.b);
        const bd = bTemp.ctx.getImageData(0, 0, t.width, t.height).data;
        const main = t.ctx.getImageData(0, 0, t.width, t.height);
        const md = main.data;
        for (let y = 0; y < t.height; y += 1) {
            for (let x = 0; x < t.width; x += 1) {
                if (hash2(x, y, seed) < p) {
                    const i = (y * t.width + x) * 4;
                    md[i] = bd[i];
                    md[i + 1] = bd[i + 1];
                    md[i + 2] = bd[i + 2];
                    md[i + 3] = bd[i + 3];
                }
            }
        }
        t.ctx.putImageData(main, 0, 0);
    },
};
export const ripple = {
    describe: 'Crossfade with a traveling sine ripple. amplitude, wavelength, phase.',
    defaults: { amplitude: 12, wavelength: 64, phase: 0 },
    apply: (t, p, params) => {
        crossfadeToMain(t, p);
        const amp = num(params, 'amplitude', 12) * Math.sin(Math.PI * clamp01(p));
        if (amp === 0) {
            return;
        }
        const len = Math.max(1, num(params, 'wavelength', 64));
        const phase = num(params, 'phase', 0);
        remapMain(t, (x, y) => [x + amp * Math.sin((y / len) * Math.PI * 2 + phase), y]);
    },
};
export const crosswarp = {
    describe: 'Crossfade with a barrel pulse. amount -1..1.',
    defaults: { amount: 0.4 },
    apply: (t, p, params) => {
        crossfadeToMain(t, p);
        const amount = Math.max(-1, Math.min(1, num(params, 'amount', 0.4))) * Math.sin(Math.PI * clamp01(p));
        if (amount === 0) {
            return;
        }
        const cx = t.width / 2;
        const cy = t.height / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
        remapMain(t, (x, y) => {
            const nx = (x - cx) / maxDist;
            const ny = (y - cy) / maxDist;
            const dist = Math.sqrt(nx * nx + ny * ny);
            const f = 1 + amount * dist * dist;
            return [cx + nx * f * maxDist, cy + ny * f * maxDist];
        });
    },
};
const crossfadeToMain = (t, p) => {
    drawFull(t.ctx, t.a, 1 - p);
    drawFull(t.ctx, t.b, p);
};
const remapMain = (t, map) => {
    const src = t.ctx.getImageData(0, 0, t.width, t.height);
    const { data } = src;
    const out = new Uint8ClampedArray(data.length);
    for (let y = 0; y < t.height; y += 1) {
        for (let x = 0; x < t.width; x += 1) {
            const [sx, sy] = map(x, y);
            const xi = Math.min(t.width - 1, Math.max(0, Math.round(sx)));
            const yi = Math.min(t.height - 1, Math.max(0, Math.round(sy)));
            const si = (yi * t.width + xi) * 4;
            const o = (y * t.width + x) * 4;
            out[o] = data[si];
            out[o + 1] = data[si + 1];
            out[o + 2] = data[si + 2];
            out[o + 3] = data[si + 3];
        }
    }
    const img = t.ctx.createImageData(t.width, t.height);
    img.data.set(out);
    t.ctx.putImageData(img, 0, 0);
};
//# sourceMappingURL=transitions.js.map
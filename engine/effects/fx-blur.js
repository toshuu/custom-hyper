import { blankPixels, nativeBlur, nativeBlurPixels, clamp01, getPixels, hexToRgb, num, putPixels, str, } from './util.js';
export const blur = {
    describe: 'Separable gaussian blur. radius px (0 = no-op).',
    defaults: { radius: 8 },
    apply: (ecx, p) => {
        const radius = num(p, 'radius', 8);
        if (radius <= 0) {
            return;
        }
        putPixels(ecx, nativeBlur(ecx, radius));
    },
};
const maskedBlur = (ecx, radius, mask) => {
    if (radius <= 0) {
        return;
    }
    const src = getPixels(ecx);
    const blurred = nativeBlur(ecx, radius);
    const { data } = src;
    const bd = blurred.data;
    for (let y = 0; y < ecx.height; y += 1) {
        for (let x = 0; x < ecx.width; x += 1) {
            const m = clamp01(mask(x, y));
            if (m <= 0) {
                continue;
            }
            const i = (y * ecx.width + x) * 4;
            for (let c = 0; c < 4; c += 1) {
                data[i + c] = data[i + c] * (1 - m) + bd[i + c] * m;
            }
        }
    }
    putPixels(ecx, src);
};
export const regionBlur = {
    describe: 'Blur inside a composition-space rect {x,y,width,height,radius}.',
    defaults: { x: 0, y: 0, width: 100, height: 100, radius: 12 },
    apply: (ecx, p) => {
        const rx = num(p, 'x', 0);
        const ry = num(p, 'y', 0);
        const rw = num(p, 'width', 100);
        const rh = num(p, 'height', 100);
        maskedBlur(ecx, num(p, 'radius', 12), (x, y) => x >= rx && x < rx + rw && y >= ry && y < ry + rh ? 1 : 0);
    },
};
export const linearProgressiveBlur = {
    describe: 'Blur ramps along an axis. direction vertical|horizontal, start/end 0..1 fractions, maxRadius.',
    defaults: { direction: 'vertical', start: 0.4, end: 1, maxRadius: 24 },
    apply: (ecx, p) => {
        const dir = str(p, 'direction', 'vertical');
        const start = clamp01(num(p, 'start', 0.4));
        const end = clamp01(num(p, 'end', 1));
        const maxRadius = num(p, 'maxRadius', 24);
        if (dir !== 'vertical' && dir !== 'horizontal') {
            throw new Error('linearProgressiveBlur direction must be vertical|horizontal');
        }
        // 4 stacked zones approximate the ramp (deterministic, bounded cost).
        const zones = 4;
        for (let z = 0; z < zones; z += 1) {
            const t0 = start + ((end - start) * z) / zones;
            const t1 = start + ((end - start) * (z + 1)) / zones;
            const radius = (maxRadius * (z + 1)) / zones;
            maskedBlur(ecx, radius, (x, y) => {
                const t = dir === 'vertical' ? y / ecx.height : x / ecx.width;
                if (t < t0 || t >= t1) {
                    return 0;
                }
                // Feather zone edges.
                const span = (t1 - t0) || 1;
                return Math.min(1, Math.min((t - t0) / (span * 0.25), (t1 - t) / (span * 0.25) + 1));
            });
        }
    },
};
export const radialProgressiveBlur = {
    describe: 'Sharp inside innerRadius, blurred outside outerRadius (3 zones).',
    defaults: { centerX: 0.5, centerY: 0.5, innerRadius: 0.2, outerRadius: 0.6, maxRadius: 24 },
    apply: (ecx, p) => {
        const cx = num(p, 'centerX', 0.5) * ecx.width;
        const cy = num(p, 'centerY', 0.5) * ecx.height;
        const diag = Math.sqrt(ecx.width ** 2 + ecx.height ** 2);
        const inner = num(p, 'innerRadius', 0.2) * diag;
        const outer = num(p, 'outerRadius', 0.6) * diag;
        const maxRadius = num(p, 'maxRadius', 24);
        const dist = (x, y) => Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        maskedBlur(ecx, maxRadius * 0.5, (x, y) => {
            const d = dist(x, y);
            if (d <= inner || d >= outer) {
                return d >= outer ? 1 : 0;
            }
            return (d - inner) / (outer - inner || 1);
        });
        maskedBlur(ecx, maxRadius, (x, y) => (dist(x, y) >= outer ? 1 : 0));
    },
};
export const zoomBlur = {
    describe: 'Radial zoom streaks. strength 0..1, steps internal.',
    defaults: { centerX: 0.5, centerY: 0.5, strength: 0.5 },
    apply: (ecx, p) => {
        const strength = clamp01(num(p, 'strength', 0.5));
        if (strength <= 0) {
            return;
        }
        const cx = num(p, 'centerX', 0.5) * ecx.width;
        const cy = num(p, 'centerY', 0.5) * ecx.height;
        const src = getPixels(ecx);
        const temp = ecx.createTemp(ecx.width, ecx.height);
        const img = temp.ctx.createImageData(ecx.width, ecx.height);
        img.data.set(src.data);
        temp.ctx.putImageData(img, 0, 0);
        const blank = blankPixels(ecx);
        putPixels(ecx, blank);
        const steps = 10;
        ecx.ctx.save();
        ecx.ctx.globalAlpha = 1 / steps;
        for (let s = 0; s < steps; s += 1) {
            const k = 1 + (strength * 0.25 * s) / steps;
            ecx.ctx.save();
            ecx.ctx.translate(cx, cy);
            ecx.ctx.scale(k, k);
            ecx.ctx.translate(-cx, -cy);
            ecx.ctx.drawImage(temp.canvas, 0, 0);
            ecx.ctx.restore();
        }
        ecx.ctx.restore();
    },
};
export const motionBlur = {
    describe: 'Directional streaks. angle degrees, distance px.',
    defaults: { angle: 0, distance: 16 },
    apply: (ecx, p) => {
        const distance = num(p, 'distance', 16);
        if (distance <= 0) {
            return;
        }
        const rad = (num(p, 'angle', 0) * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const src = getPixels(ecx);
        const temp = ecx.createTemp(ecx.width, ecx.height);
        const img = temp.ctx.createImageData(ecx.width, ecx.height);
        img.data.set(src.data);
        temp.ctx.putImageData(img, 0, 0);
        putPixels(ecx, blankPixels(ecx));
        const steps = 8;
        ecx.ctx.save();
        ecx.ctx.globalAlpha = 1 / steps;
        for (let s = 0; s < steps; s += 1) {
            const k = ((s / (steps - 1) || 0) - 0.5) * distance;
            ecx.ctx.drawImage(temp.canvas, dx * k, dy * k);
        }
        ecx.ctx.restore();
    },
};
export const lightTrail = motionBlur;
const silhouetteBlurred = (ecx, color, radius) => {
    const src = getPixels(ecx);
    const temp = ecx.createTemp(ecx.width, ecx.height);
    const img = temp.ctx.createImageData(ecx.width, ecx.height);
    const d = img.data;
    for (let i = 0; i < src.data.length; i += 4) {
        const a = src.data[i + 3];
        d[i] = color[0];
        d[i + 1] = color[1];
        d[i + 2] = color[2];
        d[i + 3] = a;
    }
    temp.ctx.putImageData(img, 0, 0);
    if (radius > 0) {
        const blurred = nativeBlurPixels(ecx, { data: d.slice(), width: ecx.width, height: ecx.height }, radius);
        const img2 = temp.ctx.createImageData(ecx.width, ecx.height);
        img2.data.set(blurred.data);
        temp.ctx.putImageData(img2, 0, 0);
    }
    return temp;
};
export const dropShadow = {
    describe: 'Shadow under opaque content. offsetX/Y, blur, color, opacity.',
    defaults: { offsetX: 0, offsetY: 8, blur: 12, color: '#000000', opacity: 0.5 },
    apply: (ecx, p) => {
        const ox = num(p, 'offsetX', 0);
        const oy = num(p, 'offsetY', 8);
        const color = hexToRgb(str(p, 'color', '#000000'));
        const opacity = clamp01(num(p, 'opacity', 0.5));
        const src = getPixels(ecx);
        const shadow = silhouetteBlurred(ecx, color, num(p, 'blur', 12));
        const sImg = shadow.ctx.getImageData(0, 0, ecx.width, ecx.height);
        const out = blankPixels(ecx);
        // shadow first (offset, scaled alpha), then original over it.
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const sx = Math.round(x - ox);
                const sy = Math.round(y - oy);
                const o = (y * ecx.width + x) * 4;
                if (sx >= 0 && sy >= 0 && sx < ecx.width && sy < ecx.height) {
                    const si = (sy * ecx.width + sx) * 4;
                    const sa = (sImg.data[si + 3] / 255) * opacity;
                    out.data[o] = sImg.data[si];
                    out.data[o + 1] = sImg.data[si + 1];
                    out.data[o + 2] = sImg.data[si + 2];
                    out.data[o + 3] = Math.round(sa * 255);
                }
            }
        }
        putPixels(ecx, out);
        ecx.ctx.save();
        ecx.ctx.globalAlpha = 1;
        const img = ecx.ctx.createImageData(ecx.width, ecx.height);
        img.data.set(src.data);
        const layer = ecx.createTemp(ecx.width, ecx.height);
        layer.ctx.putImageData(img, 0, 0);
        ecx.ctx.drawImage(layer.canvas, 0, 0);
        ecx.ctx.restore();
    },
};
export const glow = {
    describe: 'Bloom of bright areas. radius, color tint, intensity (screen).',
    defaults: { radius: 20, color: '#ffffff', intensity: 0.8 },
    apply: (ecx, p) => {
        const color = hexToRgb(str(p, 'color', '#ffffff'));
        const intensity = clamp01(num(p, 'intensity', 0.8));
        if (intensity <= 0) {
            return;
        }
        const src = getPixels(ecx);
        const bright = blankPixels(ecx);
        for (let i = 0; i < src.data.length; i += 4) {
            const l = (0.2126 * src.data[i] + 0.7152 * src.data[i + 1] + 0.0722 * src.data[i + 2]) / 255;
            const m = Math.max(0, (l - 0.5) * 2) * intensity;
            bright.data[i] = color[0] * m;
            bright.data[i + 1] = color[1] * m;
            bright.data[i + 2] = color[2] * m;
            bright.data[i + 3] = 255 * m;
        }
        const blurred = nativeBlurPixels(ecx, bright, num(p, 'radius', 20));
        const { data } = src;
        const bd = blurred.data;
        for (let i = 0; i < data.length; i += 4) {
            const a = bd[i + 3] / 255;
            // screen blend of the glow color
            data[i] = 255 - ((255 - data[i]) * (255 - bd[i] * a)) / 255;
            data[i + 1] = 255 - ((255 - data[i + 1]) * (255 - bd[i + 1] * a)) / 255;
            data[i + 2] = 255 - ((255 - data[i + 2]) * (255 - bd[i + 2] * a)) / 255;
        }
        putPixels(ecx, src);
    },
};
export const chromaticAberration = {
    describe: 'Radial (default) or linear RGB shift. maxShift px.',
    defaults: { maxShift: 4, radial: true },
    apply: (ecx, p) => {
        const maxShift = num(p, 'maxShift', 4);
        if (maxShift === 0) {
            return;
        }
        const radial = p.radial ?? true;
        if (typeof radial !== 'boolean') {
            throw new Error('chromaticAberration radial must be boolean');
        }
        const src = getPixels(ecx);
        const { data } = src;
        const out = new Uint8ClampedArray(data);
        const cx = ecx.width / 2;
        const cy = ecx.height / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                let sx;
                let sy;
                if (radial) {
                    // Shift grows with distance from center (dx/dy pre-normalized).
                    sx = maxShift * ((x - cx) / maxDist);
                    sy = maxShift * ((y - cy) / maxDist);
                }
                else {
                    sx = maxShift;
                    sy = 0;
                }
                const i = (y * ecx.width + x) * 4;
                const rx = Math.min(ecx.width - 1, Math.max(0, Math.round(x + sx)));
                const bx = Math.min(ecx.width - 1, Math.max(0, Math.round(x - sx)));
                const ry = Math.min(ecx.height - 1, Math.max(0, Math.round(y + sy)));
                const by = Math.min(ecx.height - 1, Math.max(0, Math.round(y - sy)));
                out[i] = data[(ry * ecx.width + rx) * 4];
                out[i + 2] = data[(by * ecx.width + bx) * 4 + 2];
            }
        }
        src.data.set(out);
        putPixels(ecx, src);
    },
};
export const vignette = {
    describe: 'Darken edges. strength 0..1, radius 0..1 (start of falloff).',
    defaults: { strength: 0.5, radius: 0.5 },
    apply: (ecx, p) => {
        const strength = clamp01(num(p, 'strength', 0.5));
        if (strength <= 0) {
            return;
        }
        const start = clamp01(num(p, 'radius', 0.5));
        const src = getPixels(ecx);
        const { data } = src;
        const cx = ecx.width / 2;
        const cy = ecx.height / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
                const t = clamp01((d - start) / (1 - start || 1));
                const f = 1 - strength * t * t;
                const i = (y * ecx.width + x) * 4;
                data[i] = data[i] * f;
                data[i + 1] = data[i + 1] * f;
                data[i + 2] = data[i + 2] * f;
            }
        }
        putPixels(ecx, src);
    },
};
//# sourceMappingURL=fx-blur.js.map
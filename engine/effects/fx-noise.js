import { blankPixels, clamp01, convolve3, fbm, getPixels, hexToRgb, lerp, luma, makeRng, num, putPixels, str, } from './util.js';
export const noise = {
    describe: 'Uniform monochrome grain. amount 0..1, seed int.',
    defaults: { amount: 0.2, seed: 7 },
    apply: (ecx, p) => {
        const amount = clamp01(num(p, 'amount', 0.2)) * 255;
        if (amount <= 0) {
            return;
        }
        const rng = makeRng(num(p, 'seed', 7));
        const px = getPixels(ecx);
        const { data } = px;
        for (let i = 0; i < data.length; i += 4) {
            const n = (rng() - 0.5) * 2 * amount;
            data[i] = data[i] + n;
            data[i + 1] = data[i + 1] + n;
            data[i + 2] = data[i + 2] + n;
        }
        putPixels(ecx, px);
    },
};
export const whiteNoise = {
    describe: 'Uniform RGB noise (per-channel). amount 0..1, seed int.',
    defaults: { amount: 0.2, seed: 7 },
    apply: (ecx, p) => {
        const amount = clamp01(num(p, 'amount', 0.2)) * 255;
        if (amount <= 0) {
            return;
        }
        const rng = makeRng(num(p, 'seed', 7));
        const px = getPixels(ecx);
        const { data } = px;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = data[i] + (rng() - 0.5) * 2 * amount;
            data[i + 1] = data[i + 1] + (rng() - 0.5) * 2 * amount;
            data[i + 2] = data[i + 2] + (rng() - 0.5) * 2 * amount;
        }
        putPixels(ecx, px);
    },
};
export const filmGrain = {
    describe: 'Cinematic grain (seeded fbm luminance). amount 0..1, seed, scale px.',
    defaults: { amount: 0.15, seed: 7, scale: 1.5 },
    apply: (ecx, p) => {
        const amount = clamp01(num(p, 'amount', 0.15)) * 255;
        if (amount <= 0) {
            return;
        }
        const seed = num(p, 'seed', 7);
        const scale = Math.max(0.25, num(p, 'scale', 1.5));
        const px = getPixels(ecx);
        const { data } = px;
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const n = (fbm(x / scale, y / scale, seed, 3) - 0.5) * 2 * amount;
                const i = (y * ecx.width + x) * 4;
                data[i] = data[i] + n;
                data[i + 1] = data[i + 1] + n;
                data[i + 2] = data[i + 2] + n;
            }
        }
        putPixels(ecx, px);
    },
};
export const film = filmGrain;
export const grain = filmGrain;
export const speckle = {
    describe: 'Sparse hot/dead pixels. density 0..1, seed int.',
    defaults: { density: 0.02, seed: 7 },
    apply: (ecx, p) => {
        const density = clamp01(num(p, 'density', 0.02));
        if (density <= 0) {
            return;
        }
        const rng = makeRng(num(p, 'seed', 7));
        const px = getPixels(ecx);
        const { data } = px;
        for (let i = 0; i < data.length; i += 4) {
            if (rng() < density) {
                const v = rng() < 0.5 ? 0 : 255;
                data[i] = v;
                data[i + 1] = v;
                data[i + 2] = v;
            }
        }
        putPixels(ecx, px);
    },
};
export const paper = {
    describe: 'Paper fiber: warm tint + fine grain. amount 0..1, seed.',
    defaults: { amount: 0.3, seed: 7 },
    apply: (ecx, p) => {
        const amount = clamp01(num(p, 'amount', 0.3));
        if (amount <= 0) {
            return;
        }
        const rng = makeRng(num(p, 'seed', 7));
        const px = getPixels(ecx);
        const { data } = px;
        for (let i = 0; i < data.length; i += 4) {
            const n = (rng() - 0.5) * 60 * amount;
            data[i] = data[i] * (1 - amount * 0.05) + 245 * amount * 0.05 + n;
            data[i + 1] = data[i + 1] * (1 - amount * 0.05) + 235 * amount * 0.05 + n;
            data[i + 2] = data[i + 2] * (1 - amount * 0.05) + 210 * amount * 0.05 + n;
        }
        putPixels(ecx, px);
    },
};
export const halftone = {
    describe: 'Print dots. cellSize px, angle degrees (rotation ignored < M10, documented).',
    defaults: { cellSize: 6 },
    apply: (ecx, p) => {
        const cell = Math.max(2, Math.round(num(p, 'cellSize', 6)));
        const px = getPixels(ecx);
        const { data } = px;
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const i = (y * ecx.width + x) * 4;
                const l = luma(data[i], data[i + 1], data[i + 2]) / 255;
                const cx = (x % cell) / cell - 0.5;
                const cy = (y % cell) / cell - 0.5;
                const dist = Math.sqrt(cx * cx + cy * cy);
                const radius = (1 - l) * 0.7;
                const v = dist <= radius ? 0 : 255;
                data[i] = v;
                data[i + 1] = v;
                data[i + 2] = v;
            }
        }
        putPixels(ecx, px);
    },
};
export const halftoneLinearGradient = {
    describe: 'Halftone strength ramps along vertical|horizontal axis.',
    defaults: { cellSize: 6, direction: 'vertical' },
    apply: (ecx, p) => {
        const cell = Math.max(2, Math.round(num(p, 'cellSize', 6)));
        const dir = str(p, 'direction', 'vertical');
        const px = getPixels(ecx);
        const { data } = px;
        const orig = new Uint8ClampedArray(data);
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const i = (y * ecx.width + x) * 4;
                const l = luma(orig[i], orig[i + 1], orig[i + 2]) / 255;
                const t = dir === 'horizontal' ? x / ecx.width : y / ecx.height;
                const cx = (x % cell) / cell - 0.5;
                const cy = (y % cell) / cell - 0.5;
                const dist = Math.sqrt(cx * cx + cy * cy);
                const radius = (1 - l) * 0.7 * t;
                if (dist <= radius) {
                    data[i] = 0;
                    data[i + 1] = 0;
                    data[i + 2] = 0;
                }
            }
        }
        putPixels(ecx, px);
    },
};
const overlayDraw = (ecx, draw, alpha) => {
    const temp = ecx.createTemp(ecx.width, ecx.height);
    const blank = blankPixels(ecx);
    const img = temp.ctx.createImageData(ecx.width, ecx.height);
    img.data.set(blank.data);
    temp.ctx.putImageData(img, 0, 0);
    draw(temp.ctx);
    ecx.ctx.save();
    ecx.ctx.globalAlpha = clamp01(alpha);
    ecx.ctx.drawImage(temp.canvas, 0, 0);
    ecx.ctx.restore();
};
export const scanlines = {
    describe: 'CRT rows. gap px, alpha 0..1, color.',
    defaults: { gap: 4, alpha: 0.25, color: '#000000' },
    apply: (ecx, p) => {
        const gap = Math.max(1, Math.round(num(p, 'gap', 4)));
        const [r, g, b] = hexToRgb(str(p, 'color', '#000000'));
        overlayDraw(ecx, (ctx) => {
            ctx.fillStyle = `rgba(${r},${g},${b},1)`;
            for (let y = 0; y < ecx.height; y += gap) {
                ctx.fillRect(0, y, ecx.width, 1);
            }
        }, num(p, 'alpha', 0.25));
    },
};
export const gridlines = {
    describe: 'Grid overlay. size px, color, alpha.',
    defaults: { size: 32, color: '#ffffff', alpha: 0.15 },
    apply: (ecx, p) => {
        const size = Math.max(2, Math.round(num(p, 'size', 32)));
        const [r, g, b] = hexToRgb(str(p, 'color', '#ffffff'));
        overlayDraw(ecx, (ctx) => {
            ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
            ctx.lineWidth = 1;
            for (let x = 0; x <= ecx.width; x += size) {
                ctx.beginPath();
                ctx.moveTo(x + 0.5, 0);
                ctx.lineTo(x + 0.5, ecx.height);
                ctx.stroke();
            }
            for (let y = 0; y <= ecx.height; y += size) {
                ctx.beginPath();
                ctx.moveTo(0, y + 0.5);
                ctx.lineTo(ecx.width, y + 0.5);
                ctx.stroke();
            }
        }, num(p, 'alpha', 0.15));
    },
};
export const dotGrid = {
    describe: 'Dot matrix overlay. size px, radius px, color, alpha.',
    defaults: { size: 24, radius: 2, color: '#ffffff', alpha: 0.3 },
    apply: (ecx, p) => {
        const size = Math.max(4, Math.round(num(p, 'size', 24)));
        const radius = num(p, 'radius', 2);
        const [r, g, b] = hexToRgb(str(p, 'color', '#ffffff'));
        overlayDraw(ecx, (ctx) => {
            ctx.fillStyle = `rgba(${r},${g},${b},1)`;
            for (let y = size / 2; y < ecx.height; y += size) {
                for (let x = size / 2; x < ecx.width; x += size) {
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }, num(p, 'alpha', 0.3));
    },
};
export const checkerboard = {
    describe: 'Checker overlay. size px, color, alpha.',
    defaults: { size: 32, color: '#ffffff', alpha: 0.12 },
    apply: (ecx, p) => {
        const size = Math.max(2, Math.round(num(p, 'size', 32)));
        const [r, g, b] = hexToRgb(str(p, 'color', '#ffffff'));
        overlayDraw(ecx, (ctx) => {
            ctx.fillStyle = `rgba(${r},${g},${b},1)`;
            for (let y = 0; y < ecx.height; y += size) {
                for (let x = 0; x < ecx.width; x += size) {
                    if (((x / size) | 0) % 2 === ((y / size) | 0) % 2) {
                        ctx.fillRect(x, y, size, size);
                    }
                }
            }
        }, num(p, 'alpha', 0.12));
    },
};
export const lines = {
    describe: 'Diagonal/straight line hatch. angle degrees, gap px, color, alpha.',
    defaults: { angle: 45, gap: 12, color: '#ffffff', alpha: 0.15 },
    apply: (ecx, p) => {
        const gap = Math.max(2, num(p, 'gap', 12));
        const [r, g, b] = hexToRgb(str(p, 'color', '#ffffff'));
        const rad = (num(p, 'angle', 45) * Math.PI) / 180;
        const diag = Math.sqrt(ecx.width ** 2 + ecx.height ** 2);
        overlayDraw(ecx, (ctx) => {
            ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
            ctx.lineWidth = 1;
            ctx.translate(ecx.width / 2, ecx.height / 2);
            ctx.rotate(rad);
            for (let x = -diag; x <= diag; x += gap) {
                ctx.beginPath();
                ctx.moveTo(x, -diag);
                ctx.lineTo(x, diag);
                ctx.stroke();
            }
        }, num(p, 'alpha', 0.15));
    },
};
export const rings = {
    describe: 'Concentric ring overlay. size px spacing, color, alpha.',
    defaults: { centerX: 0.5, centerY: 0.5, size: 48, color: '#ffffff', alpha: 0.2 },
    apply: (ecx, p) => {
        const size = Math.max(4, num(p, 'size', 48));
        const cx = num(p, 'centerX', 0.5) * ecx.width;
        const cy = num(p, 'centerY', 0.5) * ecx.height;
        const [r, g, b] = hexToRgb(str(p, 'color', '#ffffff'));
        const maxR = Math.sqrt(ecx.width ** 2 + ecx.height ** 2) / 2;
        overlayDraw(ecx, (ctx) => {
            ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
            ctx.lineWidth = 2;
            for (let rad = size; rad < maxR; rad += size) {
                ctx.beginPath();
                ctx.arc(cx, cy, rad, 0, Math.PI * 2);
                ctx.stroke();
            }
        }, num(p, 'alpha', 0.2));
    },
};
export const zigzag = {
    describe: 'Zigzag line overlay. size px, amplitude px, color, alpha.',
    defaults: { size: 24, amplitude: 8, color: '#ffffff', alpha: 0.2 },
    apply: (ecx, p) => {
        const size = Math.max(4, num(p, 'size', 24));
        const amp = num(p, 'amplitude', 8);
        const [r, g, b] = hexToRgb(str(p, 'color', '#ffffff'));
        overlayDraw(ecx, (ctx) => {
            ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
            ctx.lineWidth = 2;
            for (let y = 0; y < ecx.height; y += size * 2) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                for (let x = 0; x <= ecx.width; x += size) {
                    ctx.lineTo(x, y + (((x / size) | 0) % 2 === 0 ? amp : 0));
                }
                ctx.stroke();
            }
        }, num(p, 'alpha', 0.2));
    },
};
export const starburst = {
    describe: 'Ray burst overlay. rays count, color, alpha.',
    defaults: { centerX: 0.5, centerY: 0.5, rays: 24, color: '#ffffff', alpha: 0.25 },
    apply: (ecx, p) => {
        const rays = Math.max(2, Math.round(num(p, 'rays', 24)));
        const cx = num(p, 'centerX', 0.5) * ecx.width;
        const cy = num(p, 'centerY', 0.5) * ecx.height;
        const [r, g, b] = hexToRgb(str(p, 'color', '#ffffff'));
        const maxR = Math.sqrt(ecx.width ** 2 + ecx.height ** 2) / 2;
        overlayDraw(ecx, (ctx) => {
            ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
            ctx.lineWidth = 3;
            for (let i = 0; i < rays; i += 1) {
                const a = (i / rays) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
                ctx.stroke();
            }
        }, num(p, 'alpha', 0.25));
    },
};
export const venetianBlinds = {
    describe: 'Slat bands. count slats, softness 0..1, color, alpha.',
    defaults: { count: 12, softness: 0.2, color: '#000000', alpha: 0.5 },
    apply: (ecx, p) => {
        const count = Math.max(1, Math.round(num(p, 'count', 12)));
        const soft = clamp01(num(p, 'softness', 0.2));
        const [r, g, b] = hexToRgb(str(p, 'color', '#000000'));
        const band = ecx.height / count;
        overlayDraw(ecx, (ctx) => {
            for (let i = 0; i < count; i += 1) {
                const y = i * band;
                const grad = ctx.createLinearGradient(0, y, 0, y + band);
                const c = `rgba(${r},${g},${b},1)`;
                const t = `rgba(${r},${g},${b},0)`;
                grad.addColorStop(0, t);
                grad.addColorStop(soft / 2, c);
                grad.addColorStop(1 - soft / 2, c);
                grad.addColorStop(1, t);
                ctx.fillStyle = grad;
                ctx.fillRect(0, y, ecx.width, band);
            }
        }, num(p, 'alpha', 0.5));
    },
};
export const contourLines = {
    describe: 'Sobel edge iso-lines. levels count, color.',
    defaults: { levels: 5, color: '#000000' },
    apply: (ecx, p) => {
        const levels = Math.max(2, Math.round(num(p, 'levels', 5)));
        const [cr, cg, cb] = hexToRgb(str(p, 'color', '#000000'));
        const src = getPixels(ecx);
        const gray = convolve3(src, [0, 0, 0, 0, 1, 0, 0, 0, 0]);
        const gx = convolve3(gray, [-1, 0, 1, -2, 0, 2, -1, 0, 1]);
        const gy = convolve3(gray, [-1, -2, -1, 0, 0, 0, 1, 2, 1]);
        const { data } = src;
        for (let i = 0; i < data.length; i += 4) {
            const mag = Math.sqrt(gx.data[i] ** 2 + gy.data[i] ** 2) / 255;
            const band = Math.floor(mag * levels) % 2 === 1;
            if (band && mag > 0.08) {
                data[i] = cr;
                data[i + 1] = cg;
                data[i + 2] = cb;
            }
        }
        putPixels(ecx, src);
    },
};
export const liquidContours = {
    describe: 'Soft blobby iso-lines (fbm-warped contours). levels, scale, seed.',
    defaults: { levels: 5, scale: 24, seed: 7 },
    apply: (ecx, p) => {
        const levels = Math.max(2, Math.round(num(p, 'levels', 5)));
        const scale = Math.max(2, num(p, 'scale', 24));
        const seed = num(p, 'seed', 7);
        const src = getPixels(ecx);
        const { data } = src;
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const i = (y * ecx.width + x) * 4;
                const f = fbm(x / scale, y / scale, seed, 3);
                const l = luma(data[i], data[i + 1], data[i + 2]) / 255;
                const band = Math.floor((l * 0.7 + f * 0.3) * levels) % 2 === 1;
                if (band) {
                    data[i] = 0;
                    data[i + 1] = 0;
                    data[i + 2] = 0;
                }
            }
        }
        putPixels(ecx, src);
    },
};
export const burlap = {
    describe: 'Coarse weave multiply. size px, amount 0..1.',
    defaults: { size: 6, amount: 0.3 },
    apply: (ecx, p) => {
        const size = Math.max(2, num(p, 'size', 6));
        const amount = clamp01(num(p, 'amount', 0.3));
        if (amount <= 0) {
            return;
        }
        const px = getPixels(ecx);
        const { data } = px;
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const wx = 0.85 + 0.15 * Math.sin((x / size) * Math.PI * 2);
                const wy = 0.85 + 0.15 * Math.sin((y / size) * Math.PI * 2);
                const f = 1 - amount + amount * wx * wy;
                const i = (y * ecx.width + x) * 4;
                data[i] = data[i] * f;
                data[i + 1] = data[i + 1] * f;
                data[i + 2] = data[i + 2] * f;
            }
        }
        putPixels(ecx, px);
    },
};
export const flannel = {
    describe: 'Soft diagonal weave. size px, amount 0..1.',
    defaults: { size: 10, amount: 0.2 },
    apply: (ecx, p) => {
        const size = Math.max(2, num(p, 'size', 10));
        const amount = clamp01(num(p, 'amount', 0.2));
        if (amount <= 0) {
            return;
        }
        const px = getPixels(ecx);
        const { data } = px;
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const w = 0.92 + 0.08 * Math.sin(((x + y) / size) * Math.PI * 2);
                const f = 1 - amount + amount * w;
                const i = (y * ecx.width + x) * 4;
                data[i] = data[i] * f;
                data[i + 1] = data[i + 1] * f;
                data[i + 2] = data[i + 2] * f;
            }
        }
        putPixels(ecx, px);
    },
};
export const evolve = {
    describe: 'Animated-clouds field (fbm duotone). Vary seed/offset per frame for motion. scale, octaves, seed, colorA, colorB.',
    defaults: { scale: 64, octaves: 4, seed: 7, colorA: '#0b1e3a', colorB: '#e8f4ff' },
    apply: (ecx, p) => {
        const scale = Math.max(2, num(p, 'scale', 64));
        const octaves = Math.max(1, Math.round(num(p, 'octaves', 4)));
        const seed = num(p, 'seed', 7);
        const [ar, ag, ab] = hexToRgb(str(p, 'colorA', '#0b1e3a'));
        const [br, bg, bb] = hexToRgb(str(p, 'colorB', '#e8f4ff'));
        const px = blankPixels(ecx);
        const { data } = px;
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const f = fbm(x / scale, y / scale, seed, octaves);
                const i = (y * ecx.width + x) * 4;
                data[i] = lerp(ar, br, f);
                data[i + 1] = lerp(ag, bg, f);
                data[i + 2] = lerp(ab, bb, f);
                data[i + 3] = 255;
            }
        }
        putPixels(ecx, px);
    },
};
//# sourceMappingURL=fx-noise.js.map
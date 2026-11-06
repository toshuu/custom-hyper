import { clamp01, convolve3, fbm, getPixels, hexToRgb, num, putPixels, str, } from './util.js';
export const outline = {
    describe: 'Sobel edge overlay. threshold 0..1, color.',
    defaults: { threshold: 0.15, color: '#000000' },
    apply: (ecx, p) => {
        const threshold = clamp01(num(p, 'threshold', 0.15)) * 255;
        const [cr, cg, cb] = hexToRgb(str(p, 'color', '#000000'));
        const src = getPixels(ecx);
        const gx = convolve3(src, [-1, 0, 1, -2, 0, 2, -1, 0, 1]);
        const gy = convolve3(src, [-1, -2, -1, 0, 0, 0, 1, 2, 1]);
        const { data } = src;
        for (let i = 0; i < data.length; i += 4) {
            const mag = Math.sqrt(gx.data[i] ** 2 + gy.data[i] ** 2);
            if (mag >= threshold) {
                data[i] = cr;
                data[i + 1] = cg;
                data[i + 2] = cb;
            }
        }
        putPixels(ecx, src);
    },
};
export const emboss = {
    describe: 'Relief lighting. strength multiplier.',
    defaults: { strength: 1 },
    apply: (ecx, p) => {
        const strength = num(p, 'strength', 1);
        if (strength === 0) {
            return;
        }
        const out = convolve3(getPixels(ecx), [-2 * strength, -1 * strength, 0, -1 * strength, 1, 1 * strength, 0, 1 * strength, 2 * strength], 1, 128);
        putPixels(ecx, out);
    },
};
export const roughenEdges = {
    describe: 'fbm alpha erosion near edges. amount 0..1, scale px, seed.',
    defaults: { amount: 0.4, scale: 12, seed: 7 },
    apply: (ecx, p) => {
        const amount = clamp01(num(p, 'amount', 0.4));
        if (amount <= 0) {
            return;
        }
        const scale = Math.max(1, num(p, 'scale', 12));
        const seed = num(p, 'seed', 7);
        const px = getPixels(ecx);
        const { data } = px;
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const i = (y * ecx.width + x) * 4;
                const a = data[i + 3] / 255;
                if (a <= 0 || a >= 1) {
                    continue;
                }
                const n = fbm(x / scale, y / scale, seed, 3);
                const eroded = a * (1 - amount * 0.9) + (n - 0.5) * amount;
                data[i + 3] = clamp01(eroded) * 255;
            }
        }
        putPixels(ecx, px);
    },
};
//# sourceMappingURL=fx-stylize.js.map
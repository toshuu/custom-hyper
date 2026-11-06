import { blankPixels, clamp01, getPixels, hexToRgb, num, putPixels, str } from './util.js';
const screenOver = (ecx, paint, opacity) => {
    const temp = ecx.createTemp(ecx.width, ecx.height);
    const blank = blankPixels(ecx);
    const img = temp.ctx.createImageData(ecx.width, ecx.height);
    img.data.set(blank.data);
    temp.ctx.putImageData(img, 0, 0);
    paint(temp.ctx);
    const layer = temp.ctx.getImageData(0, 0, ecx.width, ecx.height);
    const src = getPixels(ecx);
    const { data } = src;
    const ld = layer.data;
    for (let i = 0; i < data.length; i += 4) {
        const a = (ld[i + 3] / 255) * opacity;
        if (a <= 0) {
            continue;
        }
        data[i] = 255 - ((255 - data[i]) * (255 - ld[i] * a)) / 255;
        data[i + 1] = 255 - ((255 - data[i + 1]) * (255 - ld[i + 1] * a)) / 255;
        data[i + 2] = 255 - ((255 - data[i + 2]) * (255 - ld[i + 2] * a)) / 255;
    }
    putPixels(ecx, src);
};
export const shine = {
    describe: 'Diagonal light band (screen). x 0..1 center, width 0..1, angle degrees, intensity.',
    defaults: { x: 0.5, width: 0.2, angle: 20, intensity: 0.7, color: '#ffffff' },
    apply: (ecx, p) => {
        const intensity = clamp01(num(p, 'intensity', 0.7));
        if (intensity <= 0) {
            return;
        }
        const cx = num(p, 'x', 0.5) * ecx.width;
        const w = Math.max(1, num(p, 'width', 0.2) * ecx.width);
        const rad = (num(p, 'angle', 20) * Math.PI) / 180;
        const [r, g, b] = hexToRgb(str(p, 'color', '#ffffff'));
        screenOver(ecx, (ctx) => {
            ctx.save();
            ctx.translate(cx, ecx.height / 2);
            ctx.rotate(rad);
            const grad = ctx.createLinearGradient(-w, 0, w, 0);
            grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
            grad.addColorStop(0.5, `rgba(${r},${g},${b},1)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(-w, -ecx.height, w * 2, ecx.height * 2);
            ctx.restore();
        }, intensity);
    },
};
export const lightLeak = {
    describe: 'Warm corner wash (screen). color, intensity 0..1, x/y 0..1 origin.',
    defaults: { color: '#ff9a3c', intensity: 0.6, x: 1, y: 0 },
    apply: (ecx, p) => {
        const intensity = clamp01(num(p, 'intensity', 0.6));
        if (intensity <= 0) {
            return;
        }
        const [r, g, b] = hexToRgb(str(p, 'color', '#ff9a3c'));
        const x = num(p, 'x', 1) * ecx.width;
        const y = num(p, 'y', 0) * ecx.height;
        const radius = Math.sqrt(ecx.width ** 2 + ecx.height ** 2) * 0.75;
        screenOver(ecx, (ctx) => {
            const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
            grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, ecx.width, ecx.height);
        }, intensity);
    },
};
export const linearGradient = {
    describe: 'Gradient wash layer. colors [c1, c2], angle degrees, opacity, blend screen|normal.',
    defaults: { colors: ['#ff9a3c', '#3c5aff'], angle: 45, opacity: 0.4, blend: 'screen' },
    apply: (ecx, p) => {
        const opacity = clamp01(num(p, 'opacity', 0.4));
        if (opacity <= 0) {
            return;
        }
        const raw = p.colors;
        if (!Array.isArray(raw) || raw.length < 2) {
            throw new Error('linearGradient needs colors: [c1, c2, ...]');
        }
        const colors = raw.map((c) => hexToRgb(String(c)));
        const rad = (num(p, 'angle', 45) * Math.PI) / 180;
        const blend = str(p, 'blend', 'screen');
        if (blend !== 'screen' && blend !== 'normal') {
            throw new Error('linearGradient blend must be screen|normal');
        }
        const cx = ecx.width / 2;
        const cy = ecx.height / 2;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const half = (Math.abs(dx) * ecx.width + Math.abs(dy) * ecx.height) / 2;
        if (blend === 'screen') {
            screenOver(ecx, (ctx) => {
                const grad = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
                colors.forEach(([r, g, b], i) => {
                    grad.addColorStop(i / (colors.length - 1), `rgba(${r},${g},${b},1)`);
                });
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, ecx.width, ecx.height);
            }, opacity);
            return;
        }
        const temp = ecx.createTemp(ecx.width, ecx.height);
        const grad = temp.ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
        colors.forEach(([r, g, b], i) => {
            grad.addColorStop(i / (colors.length - 1), `rgba(${r},${g},${b},1)`);
        });
        temp.ctx.fillStyle = grad;
        temp.ctx.fillRect(0, 0, ecx.width, ecx.height);
        ecx.ctx.save();
        ecx.ctx.globalAlpha = opacity;
        ecx.ctx.drawImage(temp.canvas, 0, 0);
        ecx.ctx.restore();
    },
};
//# sourceMappingURL=fx-light.js.map
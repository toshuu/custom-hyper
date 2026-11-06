import { blankPixels, clamp01, fbm, getPixels, makeRng, num, putPixels, sampleNearest, str, } from './util.js';
const remap = (ecx, map) => {
    const src = getPixels(ecx);
    const out = blankPixels(ecx);
    const { data } = src;
    const od = out.data;
    for (let y = 0; y < ecx.height; y += 1) {
        for (let x = 0; x < ecx.width; x += 1) {
            const [sx, sy] = map(x, y);
            const [r, g, b, a] = sampleNearest(data, ecx.width, ecx.height, sx, sy);
            const i = (y * ecx.width + x) * 4;
            od[i] = r;
            od[i + 1] = g;
            od[i + 2] = b;
            od[i + 3] = a;
        }
    }
    putPixels(ecx, out);
};
const affineDraw = (ecx, apply) => {
    const src = getPixels(ecx);
    const temp = ecx.createTemp(ecx.width, ecx.height);
    const img = temp.ctx.createImageData(ecx.width, ecx.height);
    img.data.set(src.data);
    temp.ctx.putImageData(img, 0, 0);
    putPixels(ecx, blankPixels(ecx));
    ecx.ctx.save();
    apply(ecx.ctx);
    ecx.ctx.drawImage(temp.canvas, 0, 0);
    ecx.ctx.restore();
};
export const translate = {
    describe: 'Affine shift. dx/dy px, outside fills transparent.',
    defaults: { dx: 0, dy: 0 },
    apply: (ecx, p) => {
        const dx = num(p, 'dx', 0);
        const dy = num(p, 'dy', 0);
        if (dx === 0 && dy === 0) {
            return;
        }
        affineDraw(ecx, (ctx) => ctx.translate(dx, dy));
    },
};
export const scale = {
    describe: 'Affine scale about center. sx/sy multipliers.',
    defaults: { sx: 1, sy: 1 },
    apply: (ecx, p) => {
        const sx = num(p, 'sx', 1);
        const sy = num(p, 'sy', 1);
        if (sx === 1 && sy === 1) {
            return;
        }
        if (sx <= 0 || sy <= 0) {
            throw new Error('scale sx/sy must be positive');
        }
        affineDraw(ecx, (ctx) => {
            ctx.translate(ecx.width / 2, ecx.height / 2);
            ctx.scale(sx, sy);
            ctx.translate(-ecx.width / 2, -ecx.height / 2);
        });
    },
};
export const skew = {
    describe: 'Skew in degrees. ax (x-axis), ay (y-axis).',
    defaults: { ax: 0, ay: 0 },
    apply: (ecx, p) => {
        const ax = (num(p, 'ax', 0) * Math.PI) / 180;
        const ay = (num(p, 'ay', 0) * Math.PI) / 180;
        if (ax === 0 && ay === 0) {
            return;
        }
        const src = getPixels(ecx);
        const out = blankPixels(ecx);
        const { data } = src;
        const od = out.data;
        const tanX = Math.tan(ax);
        const tanY = Math.tan(ay);
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const sx = x - (y - ecx.height / 2) * tanX;
                const sy = y - (x - ecx.width / 2) * tanY;
                const [r, g, b, a] = sampleNearest(data, ecx.width, ecx.height, sx, sy);
                const i = (y * ecx.width + x) * 4;
                od[i] = r;
                od[i + 1] = g;
                od[i + 2] = b;
                od[i + 3] = a;
            }
        }
        putPixels(ecx, out);
    },
};
export const mirror = {
    describe: 'Mirror one half. axis x|y.',
    defaults: { axis: 'x' },
    apply: (ecx, p) => {
        const axis = str(p, 'axis', 'x');
        if (axis !== 'x' && axis !== 'y') {
            throw new Error('mirror axis must be x|y');
        }
        affineDraw(ecx, (ctx) => {
            if (axis === 'x') {
                ctx.translate(ecx.width, 0);
                ctx.scale(-1, 1);
            }
            else {
                ctx.translate(0, ecx.height);
                ctx.scale(1, -1);
            }
        });
    },
};
export const tile = {
    describe: 'Repeat into cols×rows grid.',
    defaults: { cols: 2, rows: 2 },
    apply: (ecx, p) => {
        const cols = Math.max(1, Math.round(num(p, 'cols', 2)));
        const rows = Math.max(1, Math.round(num(p, 'rows', 2)));
        if (cols === 1 && rows === 1) {
            return;
        }
        const src = getPixels(ecx);
        const temp = ecx.createTemp(ecx.width, ecx.height);
        const img = temp.ctx.createImageData(ecx.width, ecx.height);
        img.data.set(src.data);
        temp.ctx.putImageData(img, 0, 0);
        putPixels(ecx, blankPixels(ecx));
        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                ecx.ctx.drawImage(temp.canvas, 0, 0, ecx.width, ecx.height, (c * ecx.width) / cols, (r * ecx.height) / rows, ecx.width / cols, ecx.height / rows);
            }
        }
    },
};
const radialMap = (ecx, fn) => {
    const cx = ecx.width / 2;
    const cy = ecx.height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
    remap(ecx, (x, y) => {
        const nx = (x - cx) / maxDist;
        const ny = (y - cy) / maxDist;
        const dist = Math.sqrt(nx * nx + ny * ny);
        const [ox, oy] = fn(nx, ny, dist);
        return [cx + ox * maxDist, cy + oy * maxDist];
    });
};
export const fisheye = {
    describe: 'Fisheye bulge. strength 0..1.',
    defaults: { strength: 0.5 },
    apply: (ecx, p) => {
        const s = clamp01(num(p, 'strength', 0.5));
        if (s <= 0) {
            return;
        }
        radialMap(ecx, (nx, ny, dist) => {
            const f = 1 - s * dist * dist;
            return [nx / (f || 1), ny / (f || 1)];
        });
    },
};
export const barrelDistortion = {
    describe: 'Barrel (+) / pincushion (−). amount −1..1.',
    defaults: { amount: 0.3 },
    apply: (ecx, p) => {
        const amount = Math.max(-1, Math.min(1, num(p, 'amount', 0.3)));
        if (amount === 0) {
            return;
        }
        radialMap(ecx, (nx, ny, dist) => {
            const f = 1 + amount * dist * dist;
            return [nx * f, ny * f];
        });
    },
};
export const wave = {
    describe: 'Sine displacement. amplitude px, wavelength px, direction x|y, phase radians.',
    defaults: { amplitude: 8, wavelength: 64, direction: 'x', phase: 0 },
    apply: (ecx, p) => {
        const amp = num(p, 'amplitude', 8);
        if (amp === 0) {
            return;
        }
        const len = Math.max(1, num(p, 'wavelength', 64));
        const dir = str(p, 'direction', 'x');
        const phase = num(p, 'phase', 0);
        if (dir !== 'x' && dir !== 'y') {
            throw new Error('wave direction must be x|y');
        }
        remap(ecx, (x, y) => {
            const s = amp * Math.sin(((dir === 'x' ? y : x) / len) * Math.PI * 2 + phase);
            return dir === 'x' ? [x + s, y] : [x, y + s];
        });
    },
};
export const waves = {
    describe: 'Two-axis sine displacement. ampX/ampY, lenX/lenY, phase.',
    defaults: { ampX: 6, ampY: 6, lenX: 64, lenY: 64, phase: 0 },
    apply: (ecx, p) => {
        const ax = num(p, 'ampX', 6);
        const ay = num(p, 'ampY', 6);
        if (ax === 0 && ay === 0) {
            return;
        }
        const lx = Math.max(1, num(p, 'lenX', 64));
        const ly = Math.max(1, num(p, 'lenY', 64));
        const phase = num(p, 'phase', 0);
        remap(ecx, (x, y) => [
            x + ax * Math.sin((y / ly) * Math.PI * 2 + phase),
            y + ay * Math.sin((x / lx) * Math.PI * 2 + phase),
        ]);
    },
};
export const ripple = {
    describe: 'Radial sine ripple. amplitude, wavelength, phase, centerX/Y 0..1.',
    defaults: { amplitude: 8, wavelength: 48, phase: 0, centerX: 0.5, centerY: 0.5 },
    apply: (ecx, p) => {
        const amp = num(p, 'amplitude', 8);
        if (amp === 0) {
            return;
        }
        const len = Math.max(1, num(p, 'wavelength', 48));
        const phase = num(p, 'phase', 0);
        const cx = num(p, 'centerX', 0.5) * ecx.width;
        const cy = num(p, 'centerY', 0.5) * ecx.height;
        remap(ecx, (x, y) => {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const s = amp * Math.sin((dist / len) * Math.PI * 2 + phase);
            return [x + (dx / dist) * s, y + (dy / dist) * s];
        });
    },
};
export const displacement = {
    describe: 'fbm vector-field remap. scale px, size px cells, seed, octaves.',
    defaults: { scale: 24, size: 48, seed: 7, octaves: 3 },
    apply: (ecx, p) => {
        const scale = num(p, 'scale', 24);
        if (scale === 0) {
            return;
        }
        const size = Math.max(2, num(p, 'size', 48));
        const seed = num(p, 'seed', 7);
        const octaves = Math.max(1, Math.round(num(p, 'octaves', 3)));
        remap(ecx, (x, y) => [
            x + (fbm(x / size, y / size, seed, octaves) - 0.5) * 2 * scale,
            y + (fbm(x / size, y / size, seed + 913, octaves) - 0.5) * 2 * scale,
        ]);
    },
};
export const noiseDisplacement = {
    describe: 'Monochrome-noise remap (alias core of displacement). scale, seed.',
    defaults: { scale: 16, seed: 7 },
    apply: (ecx, p) => {
        const scale = num(p, 'scale', 16);
        if (scale === 0) {
            return;
        }
        const seed = num(p, 'seed', 7);
        remap(ecx, (x, y) => [
            // Integer-lattice hash keeps it cheap and repeatable.
            x,
            y + (fbm(x / 32, y / 32, seed, 2) - 0.5) * 2 * scale,
        ]);
    },
};
/** Solve 3x3 linear system (homography rows). Returns null when singular. */
const solve3 = (a) => {
    const m = a.map((row) => [...row]);
    const n = 3;
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) {
                pivot = row;
            }
        }
        if (Math.abs(m[pivot][col]) < 1e-12) {
            return null;
        }
        [m[col], m[pivot]] = [m[pivot], m[col]];
        const div = m[col][col];
        for (let k = col; k <= n; k += 1) {
            m[col][k] = m[col][k] / div;
        }
        for (let row = 0; row < n; row += 1) {
            if (row !== col) {
                const factor = m[row][col];
                for (let k = col; k <= n; k += 1) {
                    m[row][k] = m[row][k] - factor * m[col][k];
                }
            }
        }
    }
    return [m[0][3], m[1][3], m[2][3]];
};
/** Inverse homography: dst corners → src rect. Corners as [x,y] fractions. */
const inverseHomography = (w, h, corners) => {
    const dst = corners.map(([fx, fy]) => [fx * w, fy * h]);
    const src = [[0, 0], [w, 0], [w, h], [0, h]];
    const rows = [];
    for (let i = 0; i < 4; i += 1) {
        const [X, Y] = src[i];
        const [x, y] = dst[i];
        rows.push([X, Y, 1, 0, 0, 0, -x * X, -x * Y, -x]);
        rows.push([0, 0, 0, X, Y, 1, -y * X, -y * Y, -y]);
    }
    // Least-squares via normal equations on first 8x8? Use direct 8-unknown solve:
    // Build 8x9 (we have 8 rows, 9 cols with last = rhs). Solve 8x8 + rhs by elimination.
    const n = 8;
    const m = rows.map((r) => [...r]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) {
                pivot = row;
            }
        }
        if (Math.abs(m[pivot][col]) < 1e-12) {
            return null;
        }
        [m[col], m[pivot]] = [m[pivot], m[col]];
        const div = m[col][col];
        for (let k = col; k <= n; k += 1) {
            m[col][k] = m[col][k] / div;
        }
        for (let row = 0; row < n; row += 1) {
            if (row !== col) {
                const factor = m[row][col];
                for (let k = col; k <= n; k += 1) {
                    m[row][k] = m[row][k] - factor * m[col][k];
                }
            }
        }
    }
    const H = m.map((row) => row[n]);
    return (x, y) => {
        // Forward H maps src→dst; invert 3x3 analytically per query is costly,
        // so solve the 2x2 linear system for (X,Y) directly.
        const h0 = H[0];
        const h1 = H[1];
        const h2 = H[2];
        const h3 = H[3];
        const h4 = H[4];
        const h5 = H[5];
        const h6 = H[6];
        const h7 = H[7];
        // x = (h0 X + h1 Y + h2)/(h6 X + h7 Y + 1)  →  linear in (X,Y)
        const a11 = h0 - x * h6;
        const a12 = h1 - x * h7;
        const b1 = x - h2;
        const a21 = h3 - y * h6;
        const a22 = h4 - y * h7;
        const b2 = y - h5;
        const det = a11 * a22 - a12 * a21;
        if (Math.abs(det) < 1e-12) {
            return [-1, -1];
        }
        return [(b1 * a22 - b2 * a12) / det, (a11 * b2 - a21 * b1) / det];
    };
};
export const cornerPin = {
    describe: 'Perspective remap to 4 corners (fractions of surface). tl/tr/br/bl [x,y]. Full-frame cost noted.',
    defaults: { tl: [0, 0], tr: [1, 0], br: [1, 1], bl: [0, 1] },
    apply: (ecx, p) => {
        const corners = [p.tl, p.tr, p.br, p.bl].map((c, i) => {
            if (!Array.isArray(c) || c.length !== 2 || c.some((n) => typeof n !== 'number')) {
                throw new Error(`cornerPin corner ${i} must be [x, y] fractions`);
            }
            return c;
        });
        const identity = corners[0][0] === 0 && corners[0][1] === 0 &&
            corners[1][0] === 1 && corners[1][1] === 0 &&
            corners[2][0] === 1 && corners[2][1] === 1 &&
            corners[3][0] === 0 && corners[3][1] === 1;
        if (identity) {
            return;
        }
        const inv = inverseHomography(ecx.width, ecx.height, corners);
        if (!inv) {
            throw new Error('cornerPin corners are degenerate (singular homography)');
        }
        remap(ecx, inv);
    },
};
export const pixelate = {
    describe: 'Block mosaic. size px.',
    defaults: { size: 12 },
    apply: (ecx, p) => {
        const size = Math.max(1, Math.round(num(p, 'size', 12)));
        if (size <= 1) {
            return;
        }
        const src = getPixels(ecx);
        const { data } = src;
        for (let by = 0; by < ecx.height; by += size) {
            for (let bx = 0; bx < ecx.width; bx += size) {
                const cx = Math.min(ecx.width - 1, bx + ((size / 2) | 0));
                const cy = Math.min(ecx.height - 1, by + ((size / 2) | 0));
                const ci = (cy * ecx.width + cx) * 4;
                const r = data[ci];
                const g = data[ci + 1];
                const b = data[ci + 2];
                const a = data[ci + 3];
                for (let y = by; y < Math.min(ecx.height, by + size); y += 1) {
                    for (let x = bx; x < ecx.width && x < bx + size; x += 1) {
                        const i = (y * ecx.width + x) * 4;
                        data[i] = r;
                        data[i + 1] = g;
                        data[i + 2] = b;
                        data[i + 3] = a;
                    }
                }
            }
        }
        putPixels(ecx, src);
    },
};
export const linearProgressivePixelate = {
    describe: 'Pixel size ramps along an axis. direction vertical|horizontal, start/end 0..1, maxSize.',
    defaults: { direction: 'vertical', start: 0.4, end: 1, maxSize: 32 },
    apply: (ecx, p) => {
        const dir = str(p, 'direction', 'vertical');
        const start = clamp01(num(p, 'start', 0.4));
        const end = clamp01(num(p, 'end', 1));
        const maxSize = Math.max(1, Math.round(num(p, 'maxSize', 32)));
        const src = getPixels(ecx);
        const { data } = src;
        const orig = new Uint8ClampedArray(data);
        const blockAt = (t) => t <= start ? 1 : Math.max(1, Math.round(1 + ((t - start) / ((end - start) || 1)) * (maxSize - 1)));
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const t = dir === 'vertical' ? y / ecx.height : x / ecx.width;
                const s = blockAt(t);
                if (s <= 1) {
                    continue;
                }
                const bx = Math.floor(x / s) * s + ((s / 2) | 0);
                const by = Math.floor(y / s) * s + ((s / 2) | 0);
                const ci = (Math.min(ecx.height - 1, by) * ecx.width + Math.min(ecx.width - 1, bx)) * 4;
                const i = (y * ecx.width + x) * 4;
                data[i] = orig[ci];
                data[i + 1] = orig[ci + 1];
                data[i + 2] = orig[ci + 2];
                data[i + 3] = orig[ci + 3];
            }
        }
        putPixels(ecx, src);
    },
};
export const radialProgressivePixelate = {
    describe: 'Pixel size grows with radius. innerRadius/outerRadius 0..1 of diagonal, maxSize.',
    defaults: { centerX: 0.5, centerY: 0.5, innerRadius: 0.2, outerRadius: 0.6, maxSize: 32 },
    apply: (ecx, p) => {
        const cx = num(p, 'centerX', 0.5) * ecx.width;
        const cy = num(p, 'centerY', 0.5) * ecx.height;
        const diag = Math.sqrt(ecx.width ** 2 + ecx.height ** 2);
        const inner = num(p, 'innerRadius', 0.2) * diag;
        const outer = num(p, 'outerRadius', 0.6) * diag;
        const maxSize = Math.max(1, Math.round(num(p, 'maxSize', 32)));
        const src = getPixels(ecx);
        const { data } = src;
        const orig = new Uint8ClampedArray(data);
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                const t = clamp01((dist - inner) / ((outer - inner) || 1));
                const s = Math.max(1, Math.round(1 + t * (maxSize - 1)));
                if (s <= 1) {
                    continue;
                }
                const bx = Math.floor(x / s) * s + ((s / 2) | 0);
                const by = Math.floor(y / s) * s + ((s / 2) | 0);
                const ci = (Math.min(ecx.height - 1, by) * ecx.width + Math.min(ecx.width - 1, bx)) * 4;
                const i = (y * ecx.width + x) * 4;
                data[i] = orig[ci];
                data[i + 1] = orig[ci + 1];
                data[i + 2] = orig[ci + 2];
                data[i + 3] = orig[ci + 3];
            }
        }
        putPixels(ecx, src);
    },
};
export const pixelDissolve = {
    describe: 'Seeded stochastic wipe to transparent. progress 0..1, seed.',
    defaults: { progress: 0.5, seed: 7 },
    apply: (ecx, p) => {
        const progress = clamp01(num(p, 'progress', 0.5));
        if (progress <= 0) {
            return;
        }
        if (progress >= 1) {
            putPixels(ecx, blankPixels(ecx));
            return;
        }
        const rng = makeRng(num(p, 'seed', 7));
        const px = getPixels(ecx);
        const { data } = px;
        for (let i = 3; i < data.length; i += 4) {
            if (rng() < progress) {
                data[i] = 0;
            }
        }
        putPixels(ecx, px);
    },
};
export const tear = {
    describe: 'Glitch slice shift. y px row, offset px, height px band.',
    defaults: { y: 0.5, offset: 40, height: 24 },
    apply: (ecx, p) => {
        const yFrac = num(p, 'y', 0.5);
        const offset = Math.round(num(p, 'offset', 40));
        const band = Math.max(1, Math.round(num(p, 'height', 24)));
        if (offset === 0) {
            return;
        }
        const y0 = Math.max(0, Math.min(ecx.height - 1, Math.round(yFrac * ecx.height)));
        const src = getPixels(ecx);
        const { data } = src;
        const orig = new Uint8ClampedArray(data);
        for (let y = y0; y < Math.min(ecx.height, y0 + band); y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const sx = Math.min(ecx.width - 1, Math.max(0, x - offset));
                const i = (y * ecx.width + x) * 4;
                const si = (y * ecx.width + sx) * 4;
                data[i] = orig[si];
                data[i + 1] = orig[si + 1];
                data[i + 2] = orig[si + 2];
                data[i + 3] = orig[si + 3];
            }
        }
        putPixels(ecx, src);
    },
};
export const tvSignalOff = {
    describe: 'Collapse to a bright line at position 0..1 + noise band.',
    defaults: { position: 0.5, seed: 7 },
    apply: (ecx, p) => {
        const pos = clamp01(num(p, 'position', 0.5));
        const rng = makeRng(num(p, 'seed', 7));
        const src = getPixels(ecx);
        const { data } = src;
        const lineY = Math.round(pos * (ecx.height - 1));
        const out = blankPixels(ecx);
        const od = out.data;
        // Average the source rows into the collapse line.
        const acc = [0, 0, 0];
        for (let y = 0; y < ecx.height; y += 1) {
            for (let x = 0; x < ecx.width; x += 1) {
                const i = (y * ecx.width + x) * 4;
                acc[0] += data[i];
                acc[1] += data[i + 1];
                acc[2] += data[i + 2];
            }
        }
        const n = ecx.width * ecx.height;
        const avg = [acc[0] / n, acc[1] / n, acc[2] / n];
        for (let x = 0; x < ecx.width; x += 1) {
            for (let dy = -2; dy <= 2; dy += 1) {
                const y = lineY + dy;
                if (y < 0 || y >= ecx.height) {
                    continue;
                }
                const i = (y * ecx.width + x) * 4;
                const nz = (rng() - 0.5) * 60;
                od[i] = clamp01((avg[0] / 255 + 0.5 + nz / 255)) * 255;
                od[i + 1] = clamp01((avg[1] / 255 + 0.5 + nz / 255)) * 255;
                od[i + 2] = clamp01((avg[2] / 255 + 0.5 + nz / 255)) * 255;
                od[i + 3] = 255;
            }
        }
        putPixels(ecx, out);
    },
};
//# sourceMappingURL=fx-distort.js.map
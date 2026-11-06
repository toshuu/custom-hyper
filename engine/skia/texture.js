/**
 * Production texture helpers: pre-rendered, seeded, zero per-frame cost.
 * The premium trick these encode: bake expensive looks (film grain) ONCE
 * into a handle, then animate cheaply (drift the tile via x/y bindings,
 * fade via opacity) instead of running per-pixel loops every frame.
 */
import { createSeededRng } from '../core/index.js';
import { createCanvas } from '@napi-rs/canvas';
/**
 * Bake a mid-gray monochrome grain tile. Composite with blendMode
 * 'overlay' at low opacity (0.05–0.12); drift x/y per frame for
 * temporal grain without any per-frame pixel work. Oversize the tile
 * vs the frame (e.g. 660x1080 for a 540x960 comp) so drifts never
 * uncover edges. Throws loudly on bad options.
 */
export const createGrainTile = (width, height, opts) => {
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        throw new Error(`Grain tile needs positive integer dims (got ${width}x${height})`);
    }
    const amount = opts?.amount ?? 0.5;
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
        throw new Error(`Grain amount must be in [0, 1] (got ${amount})`);
    }
    const cell = opts?.cell ?? 1;
    if (!Number.isInteger(cell) || cell <= 0) {
        throw new Error(`Grain cell must be a positive integer (got ${cell})`);
    }
    const rng = createSeededRng(opts?.seed ?? 7);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(width, height);
    const spread = Math.round(amount * 127);
    for (let by = 0; by < height; by += cell) {
        for (let bx = 0; bx < width; bx += cell) {
            const v = 128 + Math.round((rng() * 2 - 1) * spread);
            for (let y = by; y < Math.min(by + cell, height); y += 1) {
                for (let x = bx; x < Math.min(bx + cell, width); x += 1) {
                    const i = (y * width + x) * 4;
                    img.data[i] = v;
                    img.data[i + 1] = v;
                    img.data[i + 2] = v;
                    img.data[i + 3] = 255;
                }
            }
        }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
};
//# sourceMappingURL=texture.js.map
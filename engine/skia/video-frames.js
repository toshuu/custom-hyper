/**
 * M5 — Upload predecoded RGBA video frames to drawable canvases.
 * Decode stays in @x80/media (raw bytes); this helper turns bytes into
 * backend handles the compositor can draw. One upload per frame, cached.
 */
import { createCanvas } from '@napi-rs/canvas';
/** Upload every frame once → Canvas handles (putImageData ignores transforms). */
export const framesToCanvases = (store) => store.frames.map((rgba) => {
    const canvas = createCanvas(store.width, store.height);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(store.width, store.height);
    img.data.set(rgba);
    ctx.putImageData(img, 0, 0);
    return canvas;
});
/** Resolver over an uploaded clip: (src, index) → Canvas. */
export const clipResolver = (table) => (src, index) => {
    const clip = table[src];
    if (!clip) {
        throw new Error(`Video clip not preloaded: "${src}"`);
    }
    const frame = clip[Math.min(clip.length - 1, Math.max(0, index))];
    if (!frame) {
        throw new Error(`Video clip "${src}" has no frames`);
    }
    return frame;
};
//# sourceMappingURL=video-frames.js.map
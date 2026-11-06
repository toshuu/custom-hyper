/**
 * M5 — Object-fit math (pure). Maps an intrinsic asset box into a node box.
 * All rects in px; dx/dy relative to the node-box origin (top-left).
 */
export const computeFit = (srcW, srcH, dstW, dstH, fit) => {
    if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
        throw new Error(`computeFit needs positive boxes (got ${srcW}x${srcH} → ${dstW}x${dstH})`);
    }
    if (fit === 'fill') {
        return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: 0, dy: 0, dw: dstW, dh: dstH };
    }
    if (fit === 'none') {
        return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: 0, dy: 0, dw: srcW, dh: srcH };
    }
    if (fit === 'cover') {
        const scale = Math.max(dstW / srcW, dstH / srcH);
        const sw = dstW / scale;
        const sh = dstH / scale;
        return {
            sx: (srcW - sw) / 2,
            sy: (srcH - sh) / 2,
            sw,
            sh,
            dx: 0,
            dy: 0,
            dw: dstW,
            dh: dstH,
        };
    }
    // contain: centered letterbox.
    const scale = Math.min(dstW / srcW, dstH / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    return {
        sx: 0,
        sy: 0,
        sw: srcW,
        sh: srcH,
        dx: (dstW - dw) / 2,
        dy: (dstH - dh) / 2,
        dw,
        dh,
    };
};
export const mediaFrameIndexAt = (localFrame, fps, sourceFps, sourceDurationSec, opts) => {
    const rate = opts?.playbackRate ?? 1;
    if (!(rate > 0) || !Number.isFinite(rate)) {
        throw new Error(`playbackRate must be a positive finite number (got ${rate})`);
    }
    const start = opts?.startFrom ?? 0;
    const trimBefore = opts?.trimBefore ?? 0;
    const trimAfter = opts?.trimAfter ?? sourceDurationSec;
    let t = start + trimBefore + (localFrame / fps) * rate;
    if (opts?.loop === true) {
        const loopLen = trimAfter - trimBefore;
        if (loopLen > 0) {
            const elapsed = (localFrame / fps) * rate;
            t = start + trimBefore + (((elapsed % loopLen) + loopLen) % loopLen);
        }
    }
    else if (opts?.loop === 'pingpong') {
        // Triangle wave over 2*loopLen: forward then backward. Short clips
        // (e.g. a 27f entrance inside a 90f act) stay alive without the visible
        // jump of a wrap loop or the dead freeze of a clamp.
        const loopLen = trimAfter - trimBefore;
        if (loopLen > 0) {
            const elapsed = (localFrame / fps) * rate;
            const period = loopLen * 2;
            const cyc = (((elapsed % period) + period) % period);
            const tri = cyc <= loopLen ? cyc : period - cyc;
            t = start + trimBefore + tri;
        }
    }
    const frameCount = Math.max(1, Math.floor(sourceDurationSec * sourceFps));
    const index = Math.floor(t * sourceFps);
    return Math.min(frameCount - 1, Math.max(0, index));
};
//# sourceMappingURL=fit.js.map
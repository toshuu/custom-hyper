export interface AudioInput {
    /** Interleaved f32 PCM. */
    pcm: Float32Array;
    sampleRate: number;
    channels: number;
}
export interface RenderJob {
    width: number;
    height: number;
    fps: number;
    frameCount: number;
    /** RGBA bytes, width*height*4. Called in order 0..frameCount-1. */
    renderFrame: (frame: number) => Uint8ClampedArray | Uint8Array | Buffer;
    audio?: AudioInput;
    videoBitrate?: number;
    audioBitrate?: number;
    onProgress?: (frame: number, total: number) => void;
}
export declare const defaultVideoBitrate: (width: number, height: number, fps: number) => number;
/**
 * Render all frames through the encoders and return MP4 bytes (fastStart).
 * Deterministic for identical inputs (same encoder build/settings).
 */
export declare const renderToMp4: (job: RenderJob) => Promise<Buffer>;
//# sourceMappingURL=encode.d.ts.map
import type { Canvas } from '@napi-rs/canvas';
export interface RgbaFrameStore {
    width: number;
    height: number;
    frames: Buffer[];
}
/** Upload every frame once → Canvas handles (putImageData ignores transforms). */
export declare const framesToCanvases: (store: RgbaFrameStore) => Canvas[];
/** Resolver over an uploaded clip: (src, index) → Canvas. */
export declare const clipResolver: (table: Readonly<Record<string, Canvas[]>>) => ((src: string, index: number) => unknown);
//# sourceMappingURL=video-frames.d.ts.map
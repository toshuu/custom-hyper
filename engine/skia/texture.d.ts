import type { Canvas } from '@napi-rs/canvas';
export interface GrainTileOptions {
    /** 0..1 luminance spread around mid-gray (default 0.5). */
    amount?: number;
    /** Deterministic stream (default 7). Same inputs → same bytes. */
    seed?: number | string;
    /** Coarseness: 1 = per-pixel, 2 = 2x2 blocks, … (default 1). */
    cell?: number;
}
/**
 * Bake a mid-gray monochrome grain tile. Composite with blendMode
 * 'overlay' at low opacity (0.05–0.12); drift x/y per frame for
 * temporal grain without any per-frame pixel work. Oversize the tile
 * vs the frame (e.g. 660x1080 for a 540x960 comp) so drifts never
 * uncover edges. Throws loudly on bad options.
 */
export declare const createGrainTile: (width: number, height: number, opts?: GrainTileOptions) => Canvas;
//# sourceMappingURL=texture.d.ts.map
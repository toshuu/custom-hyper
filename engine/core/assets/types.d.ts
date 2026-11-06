/**
 * M0 — Asset lifecycle contracts.
 * Load/decode-once, cache by deterministic key, reuse across frames.
 * Pipeline: prepareAssets() → decode/load/cache → render frames.
 */
export type AssetType = 'image' | 'svg' | 'video' | 'audio' | 'font' | 'frames';
export interface AssetRef {
    /** Stable id referenced by scene nodes. */
    id: string;
    type: AssetType;
    /** URI, file path, or inline data: URI. */
    src: string;
}
export interface AssetMetadata {
    id: string;
    type: AssetType;
    src: string;
    /** Deterministic cache key: hash(type + normalized src + bytes when known). */
    cacheKey: string;
    width?: number;
    height?: number;
    durationInSeconds?: number;
    fps?: number;
    mimeType?: string;
    byteSize?: number;
}
export type AssetState = 'registered' | 'loading' | 'ready' | 'failed';
export interface AssetRecord extends AssetMetadata {
    state: AssetState;
    /** Decoded/native handle (image bitmap, font face, …). */
    handle?: unknown;
    error?: string;
}
export interface AssetStore {
    register(ref: AssetRef): AssetRecord;
    get(id: string): AssetRecord | undefined;
    /** Decode everything needed for the plan; rejects if required assets fail. */
    prepareAll(): Promise<void>;
    /** No frame may be emitted while required assets are incomplete. */
    assertReady(ids: string[]): void;
    clear(): void;
}
export interface FontRef extends AssetRef {
    type: 'font';
    fontFamily: string;
    weight?: number | string;
    style?: 'normal' | 'italic' | 'oblique';
}
export interface AudioMixRequest {
    trackId: string;
    src: string;
    /** Offset on the composition timeline, in frames. */
    fromFrame: number;
    trimBeforeFrames?: number;
    durationFrames?: number;
    volume?: number;
    fadeInFrames?: number;
    fadeOutFrames?: number;
    loop?: boolean;
}
//# sourceMappingURL=types.d.ts.map
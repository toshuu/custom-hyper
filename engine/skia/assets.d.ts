import type { Image } from '@napi-rs/canvas';
export type ImageHandle = Image;
export declare const loadImageAsset: (src: string | Buffer) => Promise<ImageHandle>;
export declare const createAssetMap: () => Map<string, unknown>;
export declare const preloadImages: (entries: Readonly<Record<string, string | Buffer>>, into?: Map<string, unknown>) => Promise<Map<string, unknown>>;
//# sourceMappingURL=assets.d.ts.map
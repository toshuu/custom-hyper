/**
 * M3 — Asset helpers for the Skia backend.
 * Decoding is async and happens ONCE before rendering; the compositor's
 * AssetResolver is a sync map lookup during frame rendering.
 */
import { loadImage } from '@napi-rs/canvas';
export const loadImageAsset = async (src) => loadImage(src);
export const createAssetMap = () => new Map();
export const preloadImages = async (entries, into = createAssetMap()) => {
    for (const [id, src] of Object.entries(entries)) {
        into.set(id, await loadImageAsset(src));
    }
    return into;
};
//# sourceMappingURL=assets.js.map
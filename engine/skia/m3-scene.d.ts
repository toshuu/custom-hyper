import type { VideoPlan } from '../../core/index.js';
export declare const M3_WIDTH = 1080;
export declare const M3_HEIGHT = 1920;
export declare const M3_FPS = 30;
export declare const M3_DURATION = 300;
export declare const M3_COLORS: {
    readonly bg: "#0e1626";
    readonly rect: "#e5484d";
    readonly rrect: "#2fa37c";
    readonly circle: "#f5a524";
    readonly mini: "#7c5cff";
    readonly text: "#ffffff";
    readonly testImage: "#ff8000";
};
/** Distinctive in-memory test image: orange field, white border, dark cross. */
export declare const makeTestImagePng: () => Promise<Buffer>;
export declare const TEST_IMAGE_ID = "test-img";
export declare const buildM3Plan: () => VideoPlan;
/** Preload all M3 assets into a sync resolver map. */
export declare const preloadM3Assets: () => Promise<Map<string, unknown>>;
//# sourceMappingURL=m3-scene.d.ts.map
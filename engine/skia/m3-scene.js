/**
 * M3 synthetic test composition: 1080x1920, 30fps, 300 frames.
 * Covers: static bg, animated rect, spring-scaled rrect, fading circle,
 * image asset, sliding text, combined transforms (group), nested
 * sequences/series-windows, and a loop. All bindings use LOCAL frames.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
export const M3_WIDTH = 1080;
export const M3_HEIGHT = 1920;
export const M3_FPS = 30;
export const M3_DURATION = 300;
export const M3_COLORS = {
    bg: '#0e1626',
    rect: '#e5484d',
    rrect: '#2fa37c',
    circle: '#f5a524',
    mini: '#7c5cff',
    text: '#ffffff',
    testImage: '#ff8000',
};
/** Distinctive in-memory test image: orange field, white border, dark cross. */
export const makeTestImagePng = async () => {
    const canvas = createCanvas(240, 240);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = M3_COLORS.testImage;
    ctx.fillRect(0, 0, 240, 240);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 232, 232);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(240, 240);
    ctx.moveTo(240, 0);
    ctx.lineTo(0, 240);
    ctx.stroke();
    return canvas.encode('png');
};
export const TEST_IMAGE_ID = 'test-img';
export const buildM3Plan = () => ({
    composition: {
        id: 'm3-synthetic',
        width: M3_WIDTH,
        height: M3_HEIGHT,
        fps: M3_FPS,
        durationInFrames: M3_DURATION,
        root: {
            id: 'root',
            type: 'container',
            children: [
                { id: 'bg', type: 'rect', width: M3_WIDTH, height: M3_HEIGHT, fill: M3_COLORS.bg },
                {
                    id: 'rectA',
                    type: 'rect',
                    width: 200,
                    height: 200,
                    fill: M3_COLORS.rect,
                    y: 400,
                    x: { binding: 'interpolate', inputRange: [0, 299], outputRange: [0, 880] },
                },
                {
                    id: 'rrectB',
                    type: 'rrect',
                    width: 320,
                    height: 180,
                    radius: 36,
                    fill: M3_COLORS.rrect,
                    x: 380,
                    y: 700,
                    anchorX: 160,
                    anchorY: 90,
                    scaleX: { binding: 'spring', from: 0.2, to: 1 },
                    scaleY: { binding: 'spring', from: 0.2, to: 1 },
                },
                {
                    id: 'groupF',
                    type: 'group',
                    x: 540,
                    y: 300,
                    rotation: { binding: 'interpolate', inputRange: [0, 299], outputRange: [0, 360] },
                    children: [
                        { id: 'mini', type: 'rect', width: 120, height: 120, fill: M3_COLORS.mini, x: -60, y: -60 },
                    ],
                },
                {
                    id: 'circleC',
                    type: 'circle',
                    radius: 90,
                    fill: M3_COLORS.circle,
                    x: 450,
                    y: 1000,
                    opacity: {
                        binding: 'interpolate',
                        inputRange: [0, 60],
                        outputRange: [0, 1],
                        options: { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                    },
                },
                {
                    id: 'imgD',
                    type: 'image',
                    src: TEST_IMAGE_ID,
                    width: 240,
                    height: 240,
                    x: 420,
                    y: 1250,
                    opacity: {
                        binding: 'interpolate',
                        inputRange: [0, 60],
                        outputRange: [0, 1],
                        options: { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                    },
                },
                {
                    id: 'textE',
                    type: 'text',
                    text: 'X80 ENGINE',
                    fontFamily: 'sans-serif',
                    fontSize: 84,
                    fill: M3_COLORS.text,
                    y: 1560,
                    x: {
                        binding: 'interpolate',
                        inputRange: [0, 60],
                        outputRange: [1080, 140],
                        options: { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                    },
                },
                {
                    id: 'pulseDot',
                    type: 'circle',
                    radius: 24,
                    fill: '#ffffff',
                    x: 100,
                    y: 1700,
                    opacity: { binding: 'interpolate', inputRange: [0, 29], outputRange: [1, 0.2] },
                },
            ],
        },
    },
    timeline: {
        kind: 'sequence',
        from: 0,
        durationInFrames: M3_DURATION,
        children: [
            { kind: 'leaf', ref: 'bg' },
            {
                kind: 'sequence',
                from: 0,
                durationInFrames: 150,
                children: [{ kind: 'leaf', ref: 'rectA' }, { kind: 'leaf', ref: 'rrectB' }, { kind: 'leaf', ref: 'groupF' }],
            },
            {
                kind: 'sequence',
                from: 90,
                durationInFrames: 210,
                children: [{ kind: 'leaf', ref: 'circleC' }],
            },
            {
                kind: 'sequence',
                from: 150,
                durationInFrames: 150,
                children: [
                    { kind: 'leaf', ref: 'imgD' },
                    { kind: 'leaf', ref: 'textE' },
                    {
                        kind: 'loop',
                        durationInFrames: 30,
                        times: 5,
                        children: [{ kind: 'leaf', ref: 'pulseDot' }],
                    },
                ],
            },
        ],
    },
    assets: [{ id: TEST_IMAGE_ID, type: 'image', src: TEST_IMAGE_ID }],
});
/** Preload all M3 assets into a sync resolver map. */
export const preloadM3Assets = async () => {
    const png = await makeTestImagePng();
    const img = await loadImage(png);
    return new Map([[TEST_IMAGE_ID, img]]);
};
//# sourceMappingURL=m3-scene.js.map
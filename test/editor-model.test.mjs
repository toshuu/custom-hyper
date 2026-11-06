import assert from 'node:assert/strict';
import {
  fontSlug, cssColor, hexColor, assetUrl, baseCss, textCss,
  shapeCss, mediaCss, scaleBox, unscaleBox, patchBody,
} from '/kaggle/working/custom-hyper/public/editor-model.js';

const palette = { bg: '#0b0d12', ink: '#ffffff', accent: '#ff5a2e' };
const baseRow = (over = {}) => ({
  board: 'beat-01', layer: 2, path: [1], x: 100, y: 200, w: 300, h: 120,
  rotation: 0, opacity: 1, ...over,
});

assert.equal(fontSlug('Bebas Neue'), 'bebas-neue');
assert.equal(fontSlug('Inter'), 'inter');
assert.equal(fontSlug(''), 'inter');
assert.equal(fontSlug('Space Grotesk'), 'space-grotesk');

assert.equal(cssColor('#ff0000', palette), '#ff0000');
assert.equal(cssColor('ink', palette), '#ffffff');
assert.equal(cssColor('bg', palette), '#0b0d12');
assert.equal(cssColor('', palette), 'transparent');
assert.equal(cssColor('missing', palette), 'transparent');
assert.equal(hexColor('accent', palette), '#ff5a2e');
assert.equal(hexColor('missing', palette, '#123456'), '#123456');

assert.equal(assetUrl('/data/assets/x.png'), '/data/assets/x.png');
assert.equal(assetUrl('../../assets/x.png'), '/data/assets/x.png');
assert.equal(assetUrl('../../images/x.png'), '/data/images/x.png');
assert.equal(assetUrl(null), null);
assert.equal(assetUrl(''), null);

const base = baseCss(baseRow({ x: 10, y: 20, w: 100, h: 50, rotation: 5, opacity: 0.8 }), 0.5);
assert.equal(base.position, 'absolute');
assert.equal(base.left, '5px');
assert.equal(base.top, '10px');
assert.equal(base.width, '50px');
assert.equal(base.height, '25px');
assert.equal(base.opacity, '0.8');
assert.equal(base.transform, 'rotate(5deg)');

const t = textCss(baseRow({ type: 'text', text: 'hi', size: 40, face: 'Bebas Neue', fill: 'ink', x: 10, y: 20, w: 100, h: 50 }), 1, palette, { body: 'Inter' });
assert.equal(t.fontSize, '40px');
assert.equal(t.fontFamily, '"Bebas Neue", sans-serif');
assert.equal(t.color, '#ffffff');
assert.equal(t.lineHeight, '1.1');
assert.equal(t.left, '10px');

const s = shapeCss(baseRow({ type: 'rrect', fill: 'accent', radius: 8, x: 0, y: 0, w: 50, h: 50 }), 2, palette);
assert.equal(s.background, '#ff5a2e');
assert.equal(s.borderRadius, '16px');
assert.equal(s.width, '100px');

const m = mediaCss(baseRow({ type: 'photo', fit: 'contain', radius: 4, srcUrl: '/data/assets/p.png' }), 1, palette);
assert.equal(m.backgroundSize, 'contain');
assert.equal(m.backgroundImage, 'url("/data/assets/p.png")');
assert.equal(m.borderRadius, '4px');

const sbox = scaleBox({ x: 50, y: 60, w: 300, h: 120 }, 0.5);
assert.deepEqual(sbox, { left: 25, top: 30, w: 150, h: 60 });
const back = unscaleBox({}, 0.5, sbox);
assert.deepEqual(back, { x: 50, y: 60, w: 300, h: 120 });
const tiny = unscaleBox({}, 1, { left: 0, top: 0, w: 4, h: 4 });
assert.equal(tiny.w, 8);
assert.equal(tiny.h, 8);

const body = patchBody(baseRow(), { x: 12, y: 34 });
assert.deepEqual(body, { board: 'beat-01', layer: 2, path: [1], patch: { x: 12, y: 34 } });

console.log('editor-model.test.mjs OK');

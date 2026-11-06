import assert from 'node:assert/strict';
import test from 'node:test';

test('local runtime exports the required renderer API', async () => {
  const core = await import('../engine/core/index.js');
  const skia = await import('../engine/skia/index.js');
  const encoding = await import('../engine/encoding/index.js');

  assert.equal(typeof core.renderFrame, 'function');
  assert.equal(typeof skia.SkiaRenderer, 'function');
  assert.equal(typeof encoding.renderToMp4, 'function');
});

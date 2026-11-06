import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('local runtime exports the required renderer API', async () => {
  const core = await import('../engine/core/index.js');
  const skia = await import('../engine/skia/index.js');
  const encoding = await import('../engine/encoding/index.js');

  assert.equal(typeof core.renderFrame, 'function');
  assert.equal(typeof skia.SkiaRenderer, 'function');
  assert.equal(typeof encoding.renderToMp4, 'function');
});

test('render source owns its font root', () => {
  const source = readFileSync('src/render.mjs', 'utf8');

  assert.match(source, /CUSTOM_HYPER_ROOT/);
  assert.doesNotMatch(source, /x80-video-engine/);
});

const sourceFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = join(dir, entry.name);
  return entry.isDirectory() ? sourceFiles(file) : (/\.(?:mjs|js)$/).test(file) ? [file] : [];
});

test('source and runtime do not reference the X80 workspace', () => {
  for (const file of [...sourceFiles('src'), ...sourceFiles('engine'), 'server.mjs']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /x80-video-engine/, file);
  }
});

test('package defines the standalone verification command', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['test:standalone'], 'node --test test/standalone-runtime.test.mjs && npm run verify && npm run smoke');
  assert.equal(pkg.engines.node, '>=22.20');
  assert.match(pkg.scripts.smoke, /render specs\/minimal-3s\.json --scale 0\.5/);
});

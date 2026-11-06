import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { patchElement, getProjectBundle } from '../src/prototype.mjs';

const APP = readFileSync(new URL('../public/app.html', import.meta.url), 'utf8');
const ED = readFileSync(new URL('../public/editor.js', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../public/editor.css', import.meta.url), 'utf8');

const callSites = APP.match(/openEditor\(/g) ?? [];
assert.equal(callSites.length, 1, `expected exactly 1 openEditor call site, got ${callSites.length}`);
assert.ok(!/document\.addEventListener\('click'[\s\S]{0,200}openEditor\(/.test(APP), 'no document-level openEditor listener');
assert.ok(/openEditor\(boardId\(i\), state\.project\.id, state\.assets/.test(APP), 'wires board id, project, assets');
assert.ok(!/getElementById\('editor/.test(ED), 'editor elements use modal scoped lookups');
assert.ok(/querySelectorAll\('\.editor-wrap'\)\.forEach/.test(ED), 'openEditor removes prior editor');
assert.ok(!/location\.reload/.test(ED), 'editor must not reload the page');
assert.ok(/pointermove/.test(ED) && /patchBody/.test(ED), 'editor drags and patches');
assert.ok(/editor-handle/.test(CSS) && /pointer-events:\s*auto/.test(CSS), 'handles receive pointer events');
assert.ok(/data-board=/.test(APP), 'boards carry board ids for thumb refresh');
assert.ok(/scene: state\.scene/.test(APP), 'editor opens from cached scene');
assert.ok(!/await loadFonts/.test(ED), 'fonts do not block editor open');

const BASE = 'http://127.0.0.1:8099';
const ID = 'december-solar-wjp4h';

const json = async (u, o = {}) => {
  const r = await fetch(u, o);
  const d = await r.json().catch(() => ({}));
  assert.ok(r.ok || d.ok !== false, `${u} ${r.status} ${JSON.stringify(d)}`);
  return d;
};

const specRun = async () => {
  const bundle = await getProjectBundle(ID);
  const rows = bundle.scene.boards.flatMap((b) => b.elements);
  const row = rows.find((e) => e.type === 'text');
  assert.ok(row, 'has editable text');
  const localX = row.x - row.parentX;
  const t0 = Date.now();
  const r1 = await patchElement(ID, {
    board: row.board,
    layer: row.layer,
    path: row.path,
    patch: { x: localX + 7 },
  });
  const ms = Date.now() - t0;
  assert.ok(ms < 400, `fast patch too slow: ${ms}ms`);
  assert.ok(r1.ok && r1.element, 'returns element');
  assert.equal(r1.stills, undefined, 'no stills in fast path');
  assert.equal(r1.element.id, row.id, 'full row id');
  assert.equal(r1.element.x, row.x + 7, 'absolute x');
  assert.equal(r1.element.type, row.type, 'full row type');
  assert.equal(r1.element.fillCss, row.fillCss, 'full row fillCss');

  const zero = await patchElement(ID, {
    board: row.board, path: row.path, patch: { opacity: 0 },
  });
  assert.equal(zero.element.opacity, 0, 'opacity 0 is preserved');

  await patchElement(ID, {
    board: row.board, layer: row.layer, path: row.path,
    patch: { x: localX, opacity: row.opacity },
  });
  const after = (await getProjectBundle(ID)).scene.boards.flatMap((b) => b.elements).find((e) => e.id === row.id);
  assert.equal(after.x, row.x, 'x restored');
  assert.equal(after.opacity, row.opacity, 'opacity restored');
  console.log(`editor-api.test.mjs spec OK (${ms}ms)`);
};

const httpRun = async () => {
  const boot = await json(`${BASE}/api/p/bootstrap`);
  let id = ID;
  let bundle = await json(`${BASE}/api/p/project/${id}`);
  let still = await json(`${BASE}/api/p/project/${id}/board/beat-01/still`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }).catch(() => null);
  if (!still?.ok) {
    for (const p of (boot.projects ?? []).slice(0, 8)) {
      const b = await json(`${BASE}/api/p/project/${p.id}`).catch(() => null);
      if (!b?.scene?.boards?.length) continue;
      const r = await json(`${BASE}/api/p/project/${p.id}/board/beat-01/still`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }).catch(() => null);
      if (r?.ok) { id = p.id; bundle = b; still = r; break; }
    }
  }
  assert.ok(bundle.ok && bundle.scene, 'bundle has scene');
  assert.ok(Array.isArray(bundle.scene.boards) && bundle.scene.boards.length, 'scene non-empty');
  assert.ok(still?.ok && still.url, 'still rendered');
  const before = (await json(`${BASE}/api/p/project/${id}`)).palette.bg;
  const pal = await json(`${BASE}/api/p/project/${id}/palette`, {
    method: 'PATCH',
    body: JSON.stringify({ palette: { bg: '#0b0d12' } }),
    headers: { 'content-type': 'application/json' },
  });
  assert.ok(pal.ok && pal.palette.bg === '#0b0d12', 'palette patched');
  await json(`${BASE}/api/p/project/${id}/palette`, {
    method: 'PATCH',
    body: JSON.stringify({ palette: { bg: before } }),
    headers: { 'content-type': 'application/json' },
  });
  console.log('editor-api.test.mjs HTTP OK');
};

await specRun();
await httpRun();

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createSkiaMeasurer } from '../../x80-video-engine/packages/renderer-skia/dist/index.js';
import { layoutText } from '../../x80-video-engine/packages/core/dist/index.js';
import { expandPlan, demoPlan } from './director.mjs';
import { generatePlan, generateBoard } from './llm.mjs';
import { renderHyper, registerFonts } from './render.mjs';
import { validateSpec } from './compile.mjs';
import { lintSpec, fixSpecContrast } from './lint.mjs';
import { assetDescriptions } from './assets.mjs';
import { videoAssetsForPlan } from './video.mjs';
import {
  getClient, listAssets, assetRelFromProject, projectPath, saveProject, saveSpec,
  saveBoards, getProject, getSpec, getBoards, savePlan, getPlan, saveCrackdown, getCrackdown,
} from './store.mjs';
import {
  defaultFrameSlots, validateImageManifest, saveImagePlan, listImagePlans, getImagePlan,
  framePlanMd, manifestTemplate,
} from './images.mjs';

const measure = createSkiaMeasurer();

const slug = (v) => String(v ?? 'film').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'film';

const FORMATS = {
  vertical: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
  landscape: { w: 1920, h: 1080 },
};

export const formats = FORMATS;

const EDITABLE_TYPES = new Set([
  'text', 'kicker', 'cta', 'stamp',
  'photo', 'image',
  'rrect', 'rect', 'circle', 'rule',
]);

const resolveColor = (v, pal) => {
  if (typeof v !== 'string') return null;
  const key = v.startsWith('@') ? v.slice(1) : v;
  return pal?.[key] ?? (v.startsWith('#') || v.startsWith('rgb') ? v : null);
};

const textStyleOf = (b, spec) => ({
  fontFamily: b.face ?? spec.faces?.body ?? 'Inter',
  fontSize: Number(b.size) || 32,
  fontWeight: b.weight ?? 400,
  fontStyle: b.italic ? 'italic' : (b.fontStyle ?? 'normal'),
  letterSpacing: Number(b.letterSpacing) || 0,
  lineHeight: Number(b.lineHeight) || 1.2,
  maxWidth: Number(b.w) || undefined,
  textAlign: b.align ?? 'left',
  textTransform: b.transform ?? b.textTransform ?? 'none',
});

const boundsOf = (b, spec) => {
  const x = Number(b.x) || 0;
  const y = Number(b.y) || 0;
  if (['text'].includes(b.type)) {
    const style = textStyleOf(b, spec);
    const laid = layoutText(String(b.text ?? ''), style, measure);
    return { x, y, w: Number(b.w) || laid.width, h: laid.height + style.fontSize * 0.18 };
  }
  if (b.type === 'kicker') {
    const style = textStyleOf({ ...b, size: Number(b.size) || 13, transform: 'uppercase' }, spec);
    const width = measure.measure(String(b.text ?? '').toUpperCase(), style).width
      + (Number(b.letterSpacing) || 2.4) * String(b.text ?? '').length;
    return { x, y, w: width, h: (Number(b.size) || 13) * 1.5 };
  }
  if (b.type === 'rrect' || b.type === 'rect') {
    return { x, y, w: Number(b.w) || 100, h: Number(b.h) || 100 };
  }
  if (b.type === 'circle') {
    const r = Number(b.r) || 40;
    return { x, y, w: r * 2, h: r * 2 };
  }
  if (b.type === 'rule') {
    return { x, y, w: Number(b.w) || 0, h: Number(b.h) || 2 };
  }
  if (['cta', 'stamp', 'photo', 'image'].includes(b.type)) {
    return { x, y, w: Number(b.w) || 0, h: Number(b.h) || 0 };
  }
  return null;
};

const assetUrlFor = (rel, spec) => {
  if (!rel) return null;
  const text = String(rel).replace(/\\/g, '/');
  const dataAt = text.indexOf('/data/');
  if (dataAt >= 0) return text.slice(dataAt);
  if (text.startsWith('data/')) return `/${text}`;
  const assetAt = text.indexOf('assets/');
  if (assetAt >= 0) return `/data/assets/${text.slice(assetAt + 7)}`;
  if (/^(https?|blob|data):/i.test(text)) return text;
  return null;
};

const rowOf = (b, { layer, li, spec, path, parent, z, editable = true }) => {
  const local = boundsOf(b, spec) ?? { x: 0, y: 0, w: 0, h: 0 };
  const circleOffset = b.type === 'circle' ? (Number(b.r) || 40) : 0;
  const x = parent.x + (local.x ?? 0) - circleOffset;
  const y = parent.y + (local.y ?? 0) - circleOffset;
  const textLike = ['text', 'kicker', 'cta', 'stamp'].includes(b.type);
  const fillCss = resolveColor(b.fill ?? 'ink', spec.palette) ?? null;
  const strokeCss = resolveColor(b.stroke ?? 'ink', spec.palette) ?? null;
  const assetPath = (value) => assetUrlFor(spec.assets?.[value] ?? value, spec);
  const defaultSize = b.type === 'kicker' ? 13 : (b.type === 'cta' || b.type === 'stamp' ? 18 : 32);
  return {
    id: `${layer}.${path.join('.') || z}`,
    board: layer,
    layer: li,
    path: path,
    parentX: parent.x,
    parentY: parent.y,
    type: b.type,
    z,
    editable,
    text: textLike ? String(b.text ?? '') : null,
    x,
    y,
    w: Math.max(1, Number(local.w) || 0),
    h: Math.max(1, Number(local.h) || 0),
    size: textLike ? (Number(b.size) || defaultSize) : (Number(b.size) || 0),
    face: textLike ? (b.face ?? spec.faces?.body ?? 'Inter') : null,
    weight: b.weight ?? 400,
    fill: b.fill ?? null,
    fillCss,
    textFill: b.textFill ?? null,
    textFillCss: resolveColor(b.textFill, spec.palette) ?? null,
    lineHeight: Number(b.lineHeight) || 1.2,
    letterSpacing: Number(b.letterSpacing) || 0,
    align: b.align ?? 'left',
    transform: b.transform ?? 'none',
    opacity: b.opacity ?? 1,
    rotation: Number(b.rotation) || 0,
    radius: Number(b.radius) || 0,
    stroke: b.stroke ?? null,
    strokeCss,
    strokeWidth: Number(b.strokeWidth) || 0,
    blur: Number(b.blur) || 0,
    src: b.src ?? null,
    srcUrl: assetPath(b.src),
    fit: b.fit ?? 'cover',
    grayscale: Number(b.grayscale) || 0,
    locked: b.locked === true,
  };
};

const walkBlocks = (blocks, layer, li, spec, out, parent = { x: 0, y: 0 }, path = [], editable = true) => {
  (blocks ?? []).forEach((b, i) => {
    const p = [...path, i];
    if (b.type === 'group') {
      walkBlocks(
        b.children ?? [], layer, li, spec, out,
        { x: parent.x + (Number(b.x) || 0), y: parent.y + (Number(b.y) || 0) },
        p,
        editable,
      );
      return;
    }
    if (!EDITABLE_TYPES.has(b.type)) return;
    out.push(rowOf(b, { layer, li, spec, path: p, parent, z: out.length, editable }));
  });
};

export const sceneFor = (spec) => {
  const canvas = {
    w: Number(spec.canvas?.w) || 1080,
    h: Number(spec.canvas?.h) || 1920,
    fps: Number(spec.canvas?.fps) || 30,
  };
  const palette = spec.palette ?? {};
  const faces = spec.faces ?? {};
  const background = { top: '#000000', bottom: '#000000', blobs: [] };
  const chrome = [];
  const boards = [];

  const layers = spec.layers ?? [];
  const groundLayer = layers.find((l) => String(l.id) === 'ground') || layers[0];

  if (groundLayer) {
    const bg = (groundLayer.blocks ?? []).find((b) => b.type === 'bg');
    if (bg) {
      if (bg.fill) {
        background.top = bg.fill;
        background.bottom = bg.fill;
      } else {
        background.top = bg.top ?? '#000000';
        background.bottom = bg.bottom ?? '#000000';
      }
    }
    const atmosphere = (groundLayer.blocks ?? []).filter((b) => b.type === 'atmosphere');
    background.blobs = atmosphere.flatMap((b) => (b.blobs ?? []).map((blob) => ({
      x: Number(blob.x) || 0,
      y: Number(blob.y) || 0,
      r: Number(blob.r) || 40,
      fill: blob.color ?? blob.fill ?? null,
      opacity: blob.opacity ?? 0.2,
      blur: Number(blob.blur) || 0,
    })));
    const circles = [];
    const collectCircles = (blocks, ox = 0, oy = 0) => {
      for (const block of blocks ?? []) {
        if (block.type === 'group') {
          collectCircles(block.children, ox + (Number(block.x) || 0), oy + (Number(block.y) || 0));
        } else if (block.type === 'circle') {
          circles.push({
            x: ox + (Number(block.x) || 0),
            y: oy + (Number(block.y) || 0),
            r: Number(block.r) || 40,
            fill: block.fill ?? null,
            opacity: block.opacity ?? 1,
            blur: Number(block.blur) || 0,
          });
        }
      }
    };
    collectCircles(groundLayer.blocks);
    background.blobs.push(...circles);
    background.blobs = background.blobs.slice(0, 16);
  }

  const chromeLayer = layers.find((l) => String(l.id) === 'chrome');
  if (chromeLayer) {
    walkBlocks(chromeLayer.blocks ?? [], 'chrome', -1, spec, chrome, { x: 0, y: 0 }, [], false);
  }
  walkBlocks(spec.chrome?.blocks ?? [], 'chrome', -1, spec, chrome, { x: 0, y: 0 }, [], false);

  layers.forEach((layer, li) => {
    if (!String(layer.id).startsWith('beat-')) return;
    const out = [];
    walkBlocks(layer.blocks ?? [], layer.id, li, spec, out, { x: 0, y: 0 }, []);
    boards.push({
      id: layer.id,
      from: Number(layer.from) || 0,
      duration: Number(layer.duration) || 0,
      elements: out,
    });
  });

  return { canvas, palette, faces, background, chrome, boards };
};

export const projectElements = (spec) => sceneFor(spec).boards.flatMap((b) => b.elements);

export const crackdownFor = (spec) => projectElements(spec).map((e) => ({
  board: e.board,
  elId: e.id,
  type: e.type,
  text: e.text || null,
  face: e.face || null,
  size: e.size || null,
  fill: e.fill,
  x: e.x,
  y: e.y,
  w: e.w,
  h: e.h,
  rotation: e.rotation,
  src: e.src,
  alt: null,
  locked: e.locked,
}));

const boardTimes = (spec) => (spec.layers ?? [])
  .filter((l) => String(l.id).startsWith('beat-'))
  .map((l) => ({ id: l.id, at: Math.round((l.from + l.duration * 0.52) * 10) / 10 }));

export const stillsFor = async (id, spec) => {
  const out = projectPath(id, 'stills');
  mkdirSync(out, { recursive: true });
  const times = boardTimes(spec);
  const res = await renderHyper(spec, {
    specDir: projectPath(id), stills: times.map((t) => t.at), out, scale: 0.5,
  });
  return times.map((t, i) => ({ board: t.id, at: t.at, url: `/data/projects/${id}/stills/${res.files[i].split('/').pop()}` }));
};

export const buildProject = async (body) => {
  const brief = String(body.brief ?? '').trim();
  if (brief.length < 8) throw new Error('Brief must be at least 8 characters');
  const formatKey = String(body.format ?? 'vertical');
  const canvas = FORMATS[formatKey];
  if (!canvas) throw new Error(`unknown format "${formatKey}"`);
  const seconds = Math.max(4, Math.min(20, Number(body.seconds) || 12));
  const seed = Number.isFinite(Number(body.seed)) && Number(body.seed) > 0
    ? Number(body.seed) >>> 0
    : (Math.floor(Math.random() * 0x7fffffff) + 1);
  const language = ['en', 'hi', 'mr'].includes(String(body.language)) ? String(body.language) : 'en';
  const client = getClient();
  const demo = body.demo === true;
  const context = [
    client.name ? `CLIENT: ${client.name}` : '',
    client.description ? `ABOUT: ${client.description}` : '',
    client.goals ? `GOALS: ${client.goals}` : '',
    `LANGUAGE: ${language}`,
    `BRIEF: ${brief}`,
  ].filter(Boolean).join('\n');

  const descriptions = new Map(assetDescriptions().map((a) => [a.name, a]));
  const assets = listAssets()
    .filter((a) => ['png', 'jpg', 'jpeg', 'webp'].includes(a.ext))
    .map((a, i) => {
      const d = descriptions.get(a.name);
      return {
        id: `a${i}`, name: a.name, rel: assetRelFromProject('', a.name),
        desc: d?.desc ?? '', tags: d?.tags ?? [], kind: d?.kind ?? '',
      };
    });
  const videos = videoAssetsForPlan().map((v) => {
    const d = descriptions.get(v.name);
    return { ...v, desc: d?.desc ?? '', tags: d?.tags ?? [], kind: 'video', segments: d?.segments ?? [] };
  });

  let plan;
  let usage = { input: 0, output: 0 };
  let provider = 'demo';
  let model = 'local-director';
  if (demo) {
    plan = demoPlan(brief, seed, language);
  } else {
    provider = String(body.provider ?? 'gemini').toLowerCase();
    const res = await generatePlan({
      brief: context, seconds, format: formatKey, language,
      provider, apiKey: body.apiKey, model: body.model, baseUrl: body.baseUrl, seed, assets,
    });
    plan = res.plan;
    usage = res.usage;
    model = res.model;
  }

  if (client.palette && Object.keys(client.palette).length) {
    plan = { ...plan, palette: { ...(plan.palette ?? {}), ...client.palette, brand: true } };
  }

  const images = listImagePlans().flatMap((p) =>
    p.frames.map((f) => ({ ...f, rel: f.url })),
  );

  const expanded = expandPlan(plan, {
    brief, canvas, duration: seconds, seed, measure, assets: [...assets, ...videos], images,
    videos,
    force: client.faces?.display ? client.faces : undefined,
  });
  expanded.spec.id = `${slug(plan.title)}-${seed.toString(36)}`;

  validateSpec(expanded.spec);
  let lint = lintSpec(expanded.spec);
  let autoFixes = [];
  if (!lint.ok) {
    const fixed = fixSpecContrast(expanded.spec);
    autoFixes = fixed.changed;
    if (autoFixes.length) lint = lintSpec(expanded.spec);
  }
  if (!lint.ok) throw new Error(`Spec lint failed: ${lint.errors.join('; ')}`);

  const id = expanded.spec.id;
  const created = new Date().toISOString();
  const meta = {
    id, brief, seconds, format: formatKey, seed, provider, model, usage, language,
    title: plan.title, mood: plan.mood, style: expanded.style,
    createdAt: created, updatedAt: created,
  };
  saveProject(id, meta);
  saveSpec(id, expanded.spec);
  saveBoards(id, expanded.plan.beats);
  savePlan(id, expanded.plan);
  saveCrackdown(id, crackdownFor(expanded.spec));
  registerFonts(expanded.spec, projectPath(id));
  const stills = await stillsFor(id, expanded.spec);
  const elements = projectElements(expanded.spec);
  return { ok: true, project: meta, spec: expanded.spec, boards: expanded.plan.beats, stills, elements, scene: sceneFor(expanded.spec), palette: expanded.spec.palette, lint, autoFixes };
};

const PATCH_KEYS = new Set([
  'text', 'x', 'y', 'w', 'h', 'size', 'face', 'weight', 'fill', 'fillCss',
  'textFill', 'textFillCss', 'lineHeight', 'letterSpacing', 'align', 'transform',
  'opacity', 'rotation', 'radius', 'stroke', 'strokeCss', 'strokeWidth', 'blur',
  'src', 'fit', 'grayscale', 'locked',
]);

export const patchElement = async (id, body) => {
  const spec = getSpec(id);
  if (!spec) throw new Error('project not found');
  let layer = Number(body.layer);
  if (!Number.isInteger(layer) || !spec.layers?.[layer]) {
    const wanted = body.board !== undefined ? String(body.board) : '';
    layer = (spec.layers ?? []).findIndex((l) => String(l.id) === wanted);
  }
  const path = Array.isArray(body.path) ? body.path.map(Number) : [];
  if (!Number.isInteger(layer) || !spec.layers[layer]) throw new Error('bad layer');
  const layerNode = spec.layers[layer];
  const boardId = String(layerNode.id ?? `beat-${String(layer + 1).padStart(2, '0')}`);
  let node = { blocks: layerNode.blocks };
  for (const i of path) {
    const next = (node.children ?? node.blocks)?.[i];
    if (!next) throw new Error('bad element path');
    node = next;
  }
  const patch = body.patch ?? {};
  const changed = {};
  if (patch.assetName) {
    const rel = assetRelFromProject('', String(patch.assetName));
    let aid = Object.entries(spec.assets ?? {}).find(([, v]) => v === rel)?.[0];
    if (!aid) {
      aid = `swap${Object.keys(spec.assets ?? {}).length}`;
      spec.assets = { ...(spec.assets ?? {}), [aid]: rel };
    }
    node.src = aid;
    changed.src = aid;
    changed.type = node.type;
  }
  if (patch.imageName) {
    const plan = getImagePlan(String(patch.imageName));
    if (!plan) throw new Error(`image plan "${patch.imageName}" not found`);
    const frame = plan.frames?.[0];
    if (!frame) throw new Error(`image plan "${patch.imageName}" has no frames`);
    const rel = frame.url;
    let aid = Object.entries(spec.assets ?? {}).find(([, v]) => v === rel)?.[0];
    if (!aid) {
      aid = `img${Object.keys(spec.assets ?? {}).length}`;
      spec.assets = { ...(spec.assets ?? {}), [aid]: rel };
    }
    node.type = 'photo';
    node.src = aid;
    node.x = Number(frame.x ?? 0);
    node.y = Number(frame.y ?? 0);
    node.w = Number(frame.w ?? node.w ?? 1080);
    node.h = Number(frame.h ?? node.h ?? 1920);
    node.fit = 'cover';
    changed.type = node.type;
    changed.src = aid;
    changed.x = node.x;
    changed.y = node.y;
    changed.w = node.w;
    changed.h = node.h;
    changed.fit = node.fit;
  }
  const isCircle = node.type === 'circle';
  for (const k of Object.keys(patch)) {
    if (!PATCH_KEYS.has(k)) continue;
    if (['assetName', 'imageName'].includes(k)) continue;
    if (isCircle && ['x', 'y', 'w', 'h'].includes(k)) continue;
    if (patch[k] !== undefined) { node[k] = patch[k]; changed[k] = patch[k]; }
  }
  if (isCircle) {
    const radius = Number(node.r) || 40;
    if (patch.w !== undefined || patch.h !== undefined) {
      const size = Math.min(Number(patch.w ?? radius * 2), Number(patch.h ?? radius * 2));
      node.r = Math.max(1, size / 2);
      changed.r = node.r;
    }
    if (patch.x !== undefined) { node.x = Number(patch.x) + node.r; changed.x = patch.x; }
    if (patch.y !== undefined) { node.y = Number(patch.y) + node.r; changed.y = patch.y; }
  }
  if (node.locked === true && patch.locked === undefined) {
    const allowed = new Set(['text', 'x', 'y', 'w', 'h', 'size', 'face', 'fill', 'rotation', 'opacity', 'src']);
    if (!Object.keys(patch).some((k) => allowed.has(k))) throw new Error('element is locked');
  }
  saveSpec(id, spec);
  saveCrackdown(id, crackdownFor(spec));
  if (body.render === true) await renderBoardStill(id, boardId);
  const meta = getProject(id);
  if (meta) saveProject(id, { ...meta, updatedAt: new Date().toISOString() });
  const full = projectElements(spec)
    .find((row) => row.layer === layer && row.path.join('.') === path.join('.'));
  return {
    ok: true, board: boardId,
    element: full ?? { id: body.id ?? `${boardId}.${path.join('.') || '0'}`, ...changed },
    palette: spec.palette,
  };
};

export const fixProjectContrast = async (id) => {
  const spec = getSpec(id);
  if (!spec) throw new Error('project not found');
  const { changed } = fixSpecContrast(spec);
  if (!changed.length) return { ok: true, changed: [], palette: spec.palette };
  validateSpec(spec);
  saveSpec(id, spec);
  saveCrackdown(id, crackdownFor(spec));
  const stills = await stillsFor(id, spec);
  return { ok: true, changed, palette: spec.palette, spec, stills, elements: projectElements(spec), scene: sceneFor(spec) };
};

export const renderBoardStill = async (id, boardId) => {
  const spec = getSpec(id);
  if (!spec) throw new Error('project not found');
  const board = (spec.layers ?? []).find((l) => String(l.id) === boardId);
  if (!board) throw new Error(`board "${boardId}" not found`);
  const at = Math.round(((Number(board.from) || 0) + (Number(board.duration) || 0) * 0.52) * 10) / 10;
  const out = projectPath(id, 'stills', 'boards');
  mkdirSync(out, { recursive: true });
  registerFonts(spec, projectPath(id));
  const res = await renderHyper(spec, {
    specDir: projectPath(id), stills: [at], out, scale: 0.5,
  });
  const file = res.files[0].split('/').pop();
  return { ok: true, board: boardId, at, url: `/data/projects/${id}/stills/boards/${file}` };
};

export const patchPalette = async (id, body) => {
  const spec = getSpec(id);
  if (!spec) throw new Error('project not found');
  const patch = body.palette ?? body.patch ?? {};
  const changed = {};
  for (const k of Object.keys(patch)) {
    if (k in (spec.palette ?? {})) { spec.palette[k] = patch[k]; changed[k] = patch[k]; }
  }
  const groundLayer = (spec.layers ?? []).find((l) => String(l.id) === 'ground') || (spec.layers ?? [])[0];
  if (groundLayer && changed.bg) {
    const bg = (groundLayer.blocks ?? []).find((b) => b.type === 'bg');
    if (bg) {
      bg.fill = changed.bg;
      if (bg.top !== undefined) bg.top = changed.bg;
      if (bg.bottom !== undefined) bg.bottom = changed.bg;
    }
  }
  saveSpec(id, spec);
  saveCrackdown(id, crackdownFor(spec));
  const meta = getProject(id);
  if (meta) saveProject(id, { ...meta, updatedAt: new Date().toISOString() });
  return { ok: true, palette: spec.palette, changed };
};

export const getProjectBundle = (id) => {
  const project = getProject(id);
  const spec = getSpec(id);
  const boards = getBoards(id);
  if (!project || !spec) throw new Error('project not found');
  return {
    ok: true, project, spec, boards, palette: spec.palette,
    elements: projectElements(spec), scene: sceneFor(spec),
    crackdown: getCrackdown(id) ?? crackdownFor(spec),
  };
};

export const plateFor = async (id, boardId) => {
  const spec = getSpec(id);
  if (!spec) throw new Error('project not found');
  const layer = (spec.layers ?? []).find((l) => l.id === boardId);
  if (!layer) throw new Error(`board "${boardId}" not found`);
  const at = Math.round((layer.from + layer.duration * 0.52) * 10) / 10;
  const out = projectPath(id, 'plates');
  mkdirSync(out, { recursive: true });
  registerFonts(spec, projectPath(id));
  const res = await renderHyper(spec, {
    specDir: projectPath(id), stills: [at], out, scale: 0.5, hideText: true,
  });
  return {
    ok: true, board: boardId, at,
    url: `/data/projects/${id}/plates/${res.files[0].split('/').pop()}`,
  };
};

export const exportSpec = (id) => {
  const spec = getSpec(id);
  if (!spec) throw new Error('project not found');
  return spec;
};

export const exportCrackdown = (id) => {
  const spec = getSpec(id);
  if (!spec) throw new Error('project not found');
  return getCrackdown(id) ?? crackdownFor(spec);
};

const boardInputsHash = (board, plan, meta) => createHash('sha256')
  .update(JSON.stringify({ board, language: meta.language, brief: meta.brief, seconds: meta.seconds, format: meta.format }))
  .digest('hex').slice(0, 16);

export const replanBoard = async (id, boardId, body = {}) => {
  const meta = getProject(id);
  const spec = getSpec(id);
  const plan = getPlan(id);
  const boards = getBoards(id);
  if (!meta || !spec || !plan || !boards) throw new Error('project not found');
  const index = boards.findIndex((b) => b.board === boardId || `beat-${String(boards.indexOf(b) + 1).padStart(2, '0')}` === boardId);
  const i = boards.findIndex((b, n) => `beat-${String(n + 1).padStart(2, '0')}` === boardId);
  const at = index >= 0 ? index : i;
  if (at < 0) throw new Error(`board "${boardId}" not found`);
  const board = boards[at];
  const hash = boardInputsHash(board, plan, meta);
  const cachePath = projectPath(id, 'plan-cache.json');
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  if (cache[boardId]?.hash === hash) {
    return { ok: true, cached: true, boards, elements: projectElements(spec), scene: sceneFor(spec), stills: await stillsFor(id, spec), palette: spec.palette };
  }
  const result = await generateBoard({
    brief: meta.brief, language: meta.language, seconds: meta.seconds,
    board, prev: boards[at - 1] ?? null, next: boards[at + 1] ?? null,
    provider: String(body.provider ?? meta.provider ?? 'gemini').toLowerCase(),
    apiKey: body.apiKey, model: body.model, baseUrl: body.baseUrl,
    seed: meta.seed + at * 97,
  });
  const nextPlan = { ...plan, beats: plan.beats.map((b, n) => (n === at ? { ...b, ...result.beat } : b)) };
  const expanded = expandPlan(nextPlan, {
    brief: meta.brief, canvas: FORMATS[meta.format], duration: meta.seconds, seed: meta.seed, measure,
    assets: [...listAssets().filter((a) => ['png', 'jpg', 'jpeg', 'webp'].includes(a.ext)).map((a, n) => {
      const d = assetDescriptions().find((x) => x.name === a.name);
      return { id: `a${n}`, name: a.name, rel: assetRelFromProject('', a.name), desc: d?.desc ?? '', tags: d?.tags ?? [], kind: d?.kind ?? '' };
    }), ...videoAssetsForPlan().map((v) => {
      const d = assetDescriptions().find((x) => x.name === v.name);
      return { ...v, kind: 'video', desc: d?.desc ?? '', tags: d?.tags ?? [], segments: d?.segments ?? [] };
    })],
    videos: videoAssetsForPlan().map((v) => {
      const d = assetDescriptions().find((x) => x.name === v.name);
      return { ...v, kind: 'video', desc: d?.desc ?? '', tags: d?.tags ?? [], segments: d?.segments ?? [] };
    }),
    images: listImagePlans().flatMap((p) => p.frames.map((f) => ({ ...f, rel: f.url }))),
    force: { ...(meta.style ?? {}) },
  });
  expanded.spec.id = id;
  applyLocks(spec, expanded.spec);
  validateSpec(expanded.spec);
  let lint = lintSpec(expanded.spec);
  let autoFixes = [];
  if (!lint.ok) {
    const fixed = fixSpecContrast(expanded.spec);
    autoFixes = fixed.changed;
    if (autoFixes.length) lint = lintSpec(expanded.spec);
  }
  if (!lint.ok) throw new Error(`Spec lint failed: ${lint.errors.join('; ')}`);
  saveSpec(id, expanded.spec);
  saveBoards(id, expanded.plan.beats);
  savePlan(id, expanded.plan);
  saveCrackdown(id, crackdownFor(expanded.spec));
  cache[boardId] = { hash, at: new Date().toISOString() };
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  const stills = await stillsFor(id, expanded.spec);
  saveProject(id, { ...meta, updatedAt: new Date().toISOString(), usage: { input: meta.usage.input + result.usage.input, output: meta.usage.output + result.usage.output } });
  return { ok: true, cached: false, boards: expanded.plan.beats, elements: projectElements(expanded.spec), scene: sceneFor(expanded.spec), stills, palette: expanded.spec.palette, lint, autoFixes };
};

const applyLocks = (oldSpec, nextSpec) => {
  const oldRows = projectElements(oldSpec).filter((e) => e.locked);
  if (!oldRows.length) return;
  const nextRows = projectElements(nextSpec);
  for (const oldRow of oldRows) {
    const match = nextRows.find((e) => e.board === oldRow.board && e.type === oldRow.type && e.text === oldRow.text)
      ?? nextRows.find((e) => e.board === oldRow.board && e.type === oldRow.type);
    if (!match) continue;
    let arr = nextSpec.layers[match.layer].blocks;
    let node = null;
    for (const i of match.path) {
      node = arr[i];
      arr = node.children ?? [];
    }
    if (!node) continue;
    const circleOffset = node.type === 'circle' ? (Number(node.r) || 40) : 0;
    node.x = oldRow.x - oldRow.parentX + circleOffset;
    node.y = oldRow.y - oldRow.parentY + circleOffset;
    for (const k of ['w', 'h', 'size', 'face', 'fill', 'rotation', 'opacity', 'src', 'locked']) {
      if (oldRow[k] !== undefined && oldRow[k] !== null) node[k] = oldRow[k];
    }
  }
};

export const rebuildProject = async (id) => {
  const meta = getProject(id);
  const spec = getSpec(id);
  const plan = getPlan(id);
  if (!meta || !spec || !plan) throw new Error('project not found');
  const expanded = expandPlan(plan, {
    brief: meta.brief, canvas: FORMATS[meta.format], duration: meta.seconds, seed: meta.seed, measure,
    assets: listAssets().filter((a) => ['png', 'jpg', 'jpeg', 'webp'].includes(a.ext)).map((a, n) => ({ id: `a${n}`, name: a.name, rel: assetRelFromProject('', a.name) })),
    videos: videoAssetsForPlan(),
    images: listImagePlans().flatMap((p) => p.frames.map((f) => ({ ...f, rel: f.url }))),
    force: { ...(meta.style ?? {}) },
  });
  expanded.spec.id = id;
  applyLocks(spec, expanded.spec);
  validateSpec(expanded.spec);
  const lint = lintSpec(expanded.spec);
  if (!lint.ok) throw new Error(`Spec lint failed: ${lint.errors.join('; ')}`);
  saveSpec(id, expanded.spec);
  saveBoards(id, expanded.plan.beats);
  savePlan(id, expanded.plan);
  saveCrackdown(id, crackdownFor(expanded.spec));
  saveProject(id, { ...meta, updatedAt: new Date().toISOString() });
  const stills = await stillsFor(id, expanded.spec);
  return { ok: true, boards: expanded.plan.beats, elements: projectElements(expanded.spec), scene: sceneFor(expanded.spec), stills, palette: expanded.spec.palette, lint };
};

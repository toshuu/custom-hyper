import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt, randomUUID } from 'node:crypto';

import { createSkiaMeasurer } from './engine/skia/index.js';
import { expandPlan, demoPlan } from './src/director.mjs';
import { generatePlan } from './src/llm.mjs';
import { registerFonts, renderHyper } from './src/render.mjs';
import { validateSpec } from './src/compile.mjs';
import {
  buildProject, patchElement, patchPalette, getProjectBundle, formats, plateFor, replanBoard,
  exportSpec, exportCrackdown, rebuildProject, renderBoardStill, fixProjectContrast,
} from './src/prototype.mjs';
import {
  getClient, saveClient, getSettings, saveSettings, listAssets, addAsset, removeAsset, DATA_ROOT, projectPath, listProjects,
} from './src/store.mjs';
import {
  defaultFrameSlots, validateImageManifest, saveImagePlan, listImagePlans, getImagePlan,
  framePlanMd, manifestTemplate,
} from './src/images.mjs';
import { assetStatus, indexAssets } from './src/assets.mjs';
import { ingestVideo, ingestVideoFile, fetchAssetUrl, normalizeImage, videoAssets, VIDEO_EXT } from './src/video.mjs';

process.on('uncaughtException', (err) => {
  console.error('[uncaught]', err?.stack ?? err);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandled]', err?.stack ?? err);
});

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ROOT, 'public');
const FONT_CACHE = join(ROOT, 'fonts', 'cache');
const SPEC_ROOT = join(ROOT, 'specs', 'direct');
const OUT_ROOT = join(ROOT, 'out', 'direct');
mkdirSync(SPEC_ROOT, { recursive: true });
mkdirSync(OUT_ROOT, { recursive: true });

const FORMATS = {
  vertical: { w: 1080, h: 1920, label: '9:16' },
  square: { w: 1080, h: 1080, label: '1:1' },
  landscape: { w: 1920, h: 1080, label: '16:9' },
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mov': 'video/quicktime', '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(data);
};

const fail = (res, status, err) => send(res, status, { ok: false, error: err instanceof Error ? err.message : String(err) });

const readJson = (req) => new Promise((resolveBody, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > 12_000_000) { reject(new Error('body too large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
    catch { reject(new Error('invalid JSON body')); }
  });
  req.on('error', reject);
});

const readRaw = (req, limit = 40_000_000) => new Promise((resolveBody, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > limit) { reject(new Error('file too large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolveBody(Buffer.concat(chunks)));
  req.on('error', reject);
});

registerFonts({}, ROOT);
const measure = createSkiaMeasurer();

const jobs = new Map();
let chain = Promise.resolve();
const enqueue = (fn) => {
  chain = chain.then(fn).catch(() => {});
  return chain;
};

const prune = () => {
  if (jobs.size <= 40) return;
  const done = [...jobs.values()].filter((j) => j.status === 'done' || j.status === 'error').sort((a, b) => a.created - b.created);
  for (const j of done.slice(0, jobs.size - 40)) jobs.delete(j.id);
};

const publicUrl = (file) => `/files/${relative(OUT_ROOT, file).split(sep).join('/')}`;

const withSettings = (body = {}) => {
  const s = getSettings();
  return {
    ...s,
    ...body,
    provider: body.provider || s.provider || 'gemini',
    model: body.model || s.model || undefined,
    apiKey: body.apiKey || s.apiKey || undefined,
    baseUrl: body.baseUrl || s.baseUrl || undefined,
    language: body.language || s.language || 'en',
  };
};

const hexColor = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : /^[0-9a-f]{6}$/i.test(s) ? `#${s.toLowerCase()}` : null;
};

const makePreview = async (body) => {
  const brief = String(body.brief ?? '').trim();
  if (brief.length < 8) throw new Error('Brief must be at least 8 characters');
  if (brief.length > 1200) throw new Error('Brief must be under 1200 characters');
  const formatKey = String(body.format ?? 'vertical');
  const fmt = FORMATS[formatKey];
  if (!fmt) throw new Error(`unknown format "${formatKey}"`);
  const seconds = Math.max(4, Math.min(20, Number(body.seconds) || 12));
  const language = ['en', 'hi', 'mr'].includes(String(body.language)) ? String(body.language) : 'en';
  const seed = Number.isFinite(Number(body.seed)) && Number(body.seed) > 0 ? Number(body.seed) >>> 0 : randomInt(1, 0x7fffffff);
  const demo = body.demo === true;
  const look = body.look === 'cinema' ? 'cinema' : 'print';
  const brand = {};
  for (const key of ['bg', 'ink', 'accent', 'accent2', 'paper']) {
    const v = hexColor(body.brand?.[key]);
    if (v) brand[key] = v;
  }

  let plan;
  let usage = { input: 0, output: 0 };
  let variation = null;
  let provider = 'demo';
  let model = 'local-director';
  if (demo) {
    plan = demoPlan(brief, seed, language);
  } else {
    provider = String(body.provider ?? 'gemini').toLowerCase();
    const result = await generatePlan({
      brief, seconds, format: `${fmt.label} ${fmt.w}x${fmt.h}`, language,
      provider, apiKey: body.apiKey, model: body.model, baseUrl: body.baseUrl, seed,
    });
    plan = result.plan;
    usage = result.usage;
    variation = result.variation;
    model = result.model;
    provider = result.provider;
  }

  plan = { ...plan, art: look };
  if (Object.keys(brand).length) plan = { ...plan, palette: { ...(plan.palette ?? {}), ...brand, brand: true } };

  const expanded = expandPlan(plan, {
    brief, canvas: fmt, duration: seconds, seed, measure, force: { look },
  });
  validateSpec(expanded.spec);
  const specPath = join(SPEC_ROOT, `${expanded.spec.id}.json`);
  writeFileSync(specPath, JSON.stringify(expanded.spec, null, 2));

  const beatLayers = expanded.spec.layers.filter((l) => String(l.id).startsWith('beat-'));
  const picks = beatLayers.slice(0, 8);
  const times = picks.map((l) => Math.round((l.from + l.duration * 0.55) * 10) / 10);
  const outDir = join(OUT_ROOT, expanded.spec.id);
  const still = await renderHyper(expanded.spec, {
    specDir: SPEC_ROOT, stills: times, out: outDir, scale: 0.5,
  });

  return {
    ok: true,
    id: expanded.spec.id,
    demo,
    look,
    provider,
    model,
    usage,
    variation,
    seed: expanded.seed,
    style: expanded.style,
    plan: expanded.plan,
    spec: expanded.spec,
    stills: still.files.map((f, i) => ({
      url: publicUrl(f), time: times[i], index: i + 1,
      headline: expanded.plan.beats[i]?.headline ?? '',
    })),
  };
};

const renderJob = (job) => enqueue(async () => {
  job.status = 'rendering';
  job.started = Date.now();
  try {
    const spec = JSON.parse(readFileSync(job.specPath, 'utf8'));
    const scale = job.scale;
    const W = Math.round(spec.canvas.w * scale);
    const H = Math.round(spec.canvas.h * scale);
    const out = join(job.outDir ?? OUT_ROOT, `${spec.id}-${W}x${H}.mp4`);
    const result = await renderHyper(spec, {
      specDir: job.specDir ?? SPEC_ROOT, scale, out,
      onProgress: (f, total) => { job.progress = Math.round((f / total) * 100); job.frame = f; job.frames = total; },
    });
    job.status = 'done';
    job.progress = 100;
    job.ms = result.ms;
    job.file = out;
    job.url = job.urlBase ? `${job.urlBase}/${out.split('/').pop()}` : publicUrl(out);
    job.width = result.width;
    job.height = result.height;
    job.frames = result.frames;
    job.bytes = result.bytes;
  } catch (err) {
    job.status = 'error';
    job.error = err instanceof Error ? err.message : String(err);
  }
  prune();
});

const serveFile = (res, file) => {
  if (!existsSync(file)) return send(res, 404, { ok: false, error: 'not found' });
  return send(res, 200, readFileSync(file), MIME[extname(file)] ?? 'application/octet-stream');
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return serveFile(res, join(PUBLIC, 'app.html'));
    }
    if (req.method === 'GET' && (url.pathname === '/direct' || url.pathname === '/direct.html')) {
      return serveFile(res, join(PUBLIC, 'index.html'));
    }
    if (req.method === 'GET' && url.pathname.startsWith('/data/')) {
      const rel = decodeURIComponent(url.pathname.slice('/data/'.length));
      const file = resolve(DATA_ROOT, rel);
      if (!file.startsWith(DATA_ROOT + sep)) return send(res, 403, { ok: false, error: 'forbidden' });
      return serveFile(res, file);
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, {
        ok: true, name: 'Custom Hyper Main Direct', version: '0.1.0',
        formats: Object.entries(FORMATS).map(([id, f]) => ({ id, ...f })),
        providers: ['gemini', 'openai', 'compatible'], demo: true,
        defaults: { gemini: 'gemini-2.0-flash', openai: 'gpt-4o-mini' },
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/settings') {
      return send(res, 200, { ok: true, settings: getSettings() });
    }
    if (req.method === 'PUT' && url.pathname === '/api/settings') {
      return send(res, 200, { ok: true, settings: saveSettings(await readJson(req)) });
    }
    if (req.method === 'GET' && url.pathname === '/api/p/bootstrap') {
      return send(res, 200, {
        ok: true, client: getClient(), assets: listAssets(), videos: videoAssets(), projects: listProjects(),
        imagePlans: listImagePlans(), settings: getSettings(), assetIndex: assetStatus(),
        formats: Object.entries(formats).map(([id, f]) => ({ id, ...f })),
      });
    }
    if (req.method === 'PUT' && url.pathname === '/api/p/client') {
      return send(res, 200, { ok: true, client: saveClient(await readJson(req)) });
    }
    if (req.method === 'GET' && url.pathname === '/api/p/assets/index') {
      return send(res, 200, { ok: true, ...assetStatus() });
    }
    if (req.method === 'POST' && url.pathname === '/api/p/assets/index') {
      return send(res, 200, await indexAssets(withSettings(await readJson(req))));
    }
    if (req.method === 'POST' && url.pathname === '/api/p/assets/chunk') {
      const id = String(url.searchParams.get('id') || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 48);
      const name = String(url.searchParams.get('name') || '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
      const index = Number(url.searchParams.get('index'));
      const total = Number(url.searchParams.get('total'));
      const mode = url.searchParams.get('mode') === 'temp' ? 'temp' : 'library';
      if (!id || !name || !Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total) {
        throw new Error('bad chunk params');
      }
      const buf = await readRaw(req, 30_000_000);
      const dir = join(DATA_ROOT, 'tmp', 'upload');
      mkdirSync(dir, { recursive: true });
      const part = join(dir, `${id}.part`);
      if (index === 0) writeFileSync(part, buf); else appendFileSync(part, buf);
      if (index < total - 1) return send(res, 200, { ok: true, done: false, chunk: index + 1, total });
      const ext = extname(name).toLowerCase();
      if (ext === '.avif') {
        rmSync(part, { force: true });
        return send(res, 400, { ok: false, error: 'AVIF is not supported: the renderer crashes on it. Export PNG, JPG or WEBP.' });
      }
      const isVideo = VIDEO_EXT.has(ext);
      let file;
      if (mode === 'temp') {
        const dest = join(DATA_ROOT, 'tmp', 'assets');
        mkdirSync(dest, { recursive: true });
        file = join(dest, name);
        renameSync(part, file);
      } else {
        const dest = join(DATA_ROOT, 'assets');
        mkdirSync(dest, { recursive: true });
        file = join(dest, name);
        renameSync(part, file);
      }
      const norm = normalizeImage(name, { temp: mode === 'temp' });
      const bytes = statSync(norm.file).size;
      const asset = {
        name: norm.name,
        url: mode === 'temp' ? `/data/tmp/assets/${encodeURIComponent(norm.name)}` : `/data/assets/${encodeURIComponent(norm.name)}`,
        bytes, ext: extname(norm.name).replace('.', ''),
      };
      const video = isVideo ? (mode === 'temp' ? ingestVideoFile(norm.file, norm.name, { temp: true }) : ingestVideo(norm.name)) : null;
      return send(res, 200, { ok: true, done: true, asset, video, mode, assets: listAssets(), videos: videoAssets() });
    }
    if (req.method === 'POST' && url.pathname === '/api/p/assets/url') {
      const body = await readJson(req);
      const out = await fetchAssetUrl(body);
      return send(res, 200, { ok: true, ...out, assets: listAssets(), videos: videoAssets() });
    }
    if (req.method === 'POST' && url.pathname === '/api/p/assets') {
      const name = url.searchParams.get('name') || `asset-${Date.now()}.png`;
      if (extname(name).toLowerCase() === '.avif') {
        return send(res, 400, { ok: false, error: 'AVIF is not supported: the renderer crashes on it. Export PNG, JPG or WEBP.' });
      }
      const buf = await readRaw(req);
      if (!buf.length) throw new Error('empty file');
      const saved = addAsset(name, buf);
      const norm = normalizeImage(saved.name);
      const ext = extname(norm.name).toLowerCase();
      const asset = { ...saved, name: norm.name, url: `/data/assets/${encodeURIComponent(norm.name)}`, bytes: statSync(norm.file).size };
      const video = VIDEO_EXT.has(ext) ? ingestVideo(norm.name) : null;
      return send(res, 200, { ok: true, asset, video, assets: listAssets() });
    }
    if (req.method === 'DELETE' && url.pathname === '/api/p/assets') {
      const name = url.searchParams.get('name') || '';
      removeAsset(name);
      return send(res, 200, { ok: true, removed: name, assets: listAssets() });
    }
    if (req.method === 'GET' && url.pathname === '/api/p/image/template') {
      const count = Math.max(1, Math.min(12, Number(url.searchParams.get('count')) || 5));
      const md = framePlanMd({
        client: getClient(), brief: url.searchParams.get('brief') ?? '', count,
        slots: defaultFrameSlots(count),
      });
      res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': 'attachment; filename="image-plan.md"' });
      return res.end(md);
    }
    if (req.method === 'GET' && url.pathname === '/api/p/image/manifest') {
      const count = Math.max(1, Math.min(12, Number(url.searchParams.get('count')) || 5));
      const tmpl = manifestTemplate(count, defaultFrameSlots(count));
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': 'attachment; filename="image-manifest.json"' });
      return res.end(JSON.stringify(tmpl, null, 2));
    }
    if (req.method === 'GET' && url.pathname === '/api/p/image/pack') {
      const count = Math.max(1, Math.min(12, Number(url.searchParams.get('count')) || 5));
      const md = framePlanMd({
        client: getClient(), brief: url.searchParams.get('brief') ?? '', count,
        slots: defaultFrameSlots(count),
      });
      const tmpl = manifestTemplate(count, defaultFrameSlots(count));
      const zip = zipFiles([
        { name: 'image-plan.md', buffer: md },
        { name: 'image-manifest.json', buffer: JSON.stringify(tmpl, null, 2) },
      ]);
      res.writeHead(200, { 'content-type': 'application/zip', 'cache-control': 'no-store', 'content-disposition': 'attachment; filename="image-pack.zip"' });
      return res.end(zip);
    }
    if (req.method === 'POST' && url.pathname === '/api/p/images') {
      const body = await readJson(req);
      if (!body.frames || !Array.isArray(body.frames) || !body.frames.length) {
        throw new Error('image: frames[] is required');
      }
      const manifest = validateImageManifest(body);
      const saved = saveImagePlan(body.name || 'image-plan', manifest.frames);
      return send(res, 200, { ok: true, imagePlan: saved, imagePlans: listImagePlans() });
    }
    if (req.method === 'GET' && url.pathname === '/api/p/images') {
      return send(res, 200, { ok: true, imagePlans: listImagePlans() });
    }
    if (req.method === 'POST' && url.pathname === '/api/p/generate') {
      return send(res, 200, await buildProject(withSettings(await readJson(req))));
    }
    if (req.method === 'POST' && /^\/api\/p\/project\/[a-z0-9-]+\/plate$/.test(url.pathname)) {
      const id = url.pathname.split('/')[4];
      const body = await readJson(req);
      return send(res, 200, await plateFor(id, String(body.board ?? '')));
    }
    if (req.method === 'POST' && /^\/api\/p\/project\/[a-z0-9-]+\/fix-contrast$/.test(url.pathname)) {
      const id = url.pathname.split('/')[4];
      return send(res, 200, await fixProjectContrast(id));
    }
    if (req.method === 'POST' && /^\/api\/p\/project\/[a-z0-9-]+\/plan-all$/.test(url.pathname)) {
      const id = url.pathname.split('/')[4];
      return send(res, 200, await rebuildProject(id));
    }
    if (req.method === 'POST' && /^\/api\/p\/project\/[a-z0-9-]+\/board\/[a-z0-9-]+\/plan$/.test(url.pathname)) {
      const parts = url.pathname.split('/');
      const id = parts[4];
      const board = parts[6];
      return send(res, 200, await replanBoard(id, board, withSettings(await readJson(req))));
    }
    if (req.method === 'GET' && /^\/api\/p\/project\/[a-z0-9-]+\/export\/(spec|crackdown)$/.test(url.pathname)) {
      const parts = url.pathname.split('/');
      const id = parts[4];
      const kind = parts[6];
      const data = kind === 'spec' ? exportSpec(id) : exportCrackdown(id);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-disposition': `attachment; filename="${id}-${kind}.json"` });
      return res.end(JSON.stringify(data, null, 2));
    }
    if (req.method === 'GET' && url.pathname.startsWith('/public/')) {
      const rel = decodeURIComponent(url.pathname.slice('/public/'.length));
      const file = join(PUBLIC, rel);
      if (!file.startsWith(PUBLIC + sep)) return send(res, 403, { ok: false, error: 'forbidden' });
      return serveFile(res, file);
    }
    if (req.method === 'GET' && url.pathname === '/fonts/index.json') {
      const index = {};
      for (const family of readdirSync(FONT_CACHE, { withFileTypes: true })) {
        if (!family.isDirectory()) continue;
        const weights = readdirSync(join(FONT_CACHE, family.name))
          .map((file) => /^(\d+)-normal\.ttf$/.exec(file)?.[1])
          .filter(Boolean)
          .map(Number)
          .sort((a, b) => a - b);
        if (weights.length) index[family.name] = weights;
      }
      return send(res, 200, index);
    }
    if (req.method === 'GET' && url.pathname.startsWith('/fonts/')) {
      const rel = decodeURIComponent(url.pathname.slice('/fonts/'.length));
      const file = join(FONT_CACHE, rel);
      if (!file.startsWith(FONT_CACHE + sep)) return send(res, 403, { ok: false, error: 'forbidden' });
      return serveFile(res, file);
    }
    if (req.method === 'POST' && /^\/api\/p\/project\/[a-z0-9-]+\/board\/[a-z0-9-]+\/still$/.test(url.pathname)) {
      const parts = url.pathname.split('/');
      const id = parts[4];
      const board = parts[6];
      return send(res, 200, await renderBoardStill(id, board));
    }
    if (req.method === 'PATCH' && url.pathname.startsWith('/api/p/project/') && url.pathname.endsWith('/palette')) {
      const id = url.pathname.slice('/api/p/project/'.length, -'/palette'.length);
      if (!/^[a-z0-9-]+$/.test(id)) throw new Error('invalid id');
      return send(res, 200, await patchPalette(id, await readJson(req)));
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/p/project/')) {
      const id = url.pathname.slice('/api/p/project/'.length);
      if (!/^[a-z0-9-]+$/.test(id)) throw new Error('invalid id');
      return send(res, 200, getProjectBundle(id));
    }
    if (req.method === 'PATCH' && url.pathname.startsWith('/api/p/project/') && url.pathname.endsWith('/element')) {
      const id = url.pathname.slice('/api/p/project/'.length, -'/element'.length);
      if (!/^[a-z0-9-]+$/.test(id)) throw new Error('invalid id');
      return send(res, 200, await patchElement(id, await readJson(req)));
    }
    if (req.method === 'POST' && url.pathname === '/api/p/render') {
      const body = await readJson(req);
      const id = String(body.id ?? '');
      if (!/^[a-z0-9-]+$/.test(id)) throw new Error('invalid id');
      const specPath = projectPath(id, 'spec.json');
      if (!existsSync(specPath)) throw new Error('spec not found');
      const scale = Number(body.scale) === 1 ? 1 : 0.5;
      const job = {
        id: randomUUID(), specId: id, specPath, scale,
        specDir: projectPath(id), outDir: projectPath(id, 'out'),
        urlBase: `/data/projects/${id}/out`,
        status: 'queued', progress: 0, created: Date.now(),
      };
      jobs.set(job.id, job);
      renderJob(job);
      return send(res, 202, { ok: true, job: job.id, id });
    }
    if (req.method === 'POST' && url.pathname === '/api/generate') {
      const body = await readJson(req);
      const preview = await makePreview(withSettings(body));
      return send(res, 200, preview);
    }
    if (req.method === 'POST' && url.pathname === '/api/render') {
      const body = await readJson(req);
      const id = String(body.id ?? '');
      if (!/^[a-z0-9-]+$/.test(id)) throw new Error('invalid id');
      const specPath = join(SPEC_ROOT, `${id}.json`);
      if (!existsSync(specPath)) throw new Error('spec not found');
      const scale = Number(body.scale) === 1 ? 1 : 0.5;
      const job = {
        id: randomUUID(), specId: id, specPath, scale,
        status: 'queued', progress: 0, created: Date.now(),
      };
      jobs.set(job.id, job);
      renderJob(job);
      return send(res, 202, { ok: true, job: job.id, id });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/job/')) {
      const id = url.pathname.slice('/api/job/'.length);
      const job = jobs.get(id);
      if (!job) return send(res, 404, { ok: false, error: 'job not found' });
      return send(res, 200, {
        ok: true, id: job.id, status: job.status, progress: job.progress,
        frame: job.frame, frames: job.frames, url: job.url, file: job.file,
        ms: job.ms, width: job.width, height: job.height, bytes: job.bytes, error: job.error,
      });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/spec/')) {
      const id = url.pathname.slice('/api/spec/'.length);
      if (!/^[a-z0-9-]+$/.test(id)) throw new Error('invalid id');
      const file = join(SPEC_ROOT, `${id}.json`);
      if (!existsSync(file)) return send(res, 404, { ok: false, error: 'spec not found' });
      return serveFile(res, file);
    }
    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      const rel = decodeURIComponent(url.pathname.slice('/files/'.length));
      const file = resolve(OUT_ROOT, rel);
      if (!file.startsWith(OUT_ROOT + sep)) return send(res, 403, { ok: false, error: 'forbidden' });
      return serveFile(res, file);
    }
    return send(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    const status = /API key|unknown provider|LLM|Gemini|brief|format|invalid/i.test(String(err?.message)) ? 400 : 500;
    return fail(res, status, err);
  }
});

const PORT = Number(process.env.PORT) || 8098;
const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`Custom Hyper Main Direct: http://${HOST}:${PORT}`);
  console.log(`specs: ${SPEC_ROOT}`);
  console.log(`out: ${OUT_ROOT}`);
});

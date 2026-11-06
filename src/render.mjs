
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderFrame } from '../../x80-video-engine/packages/core/dist/index.js';
import {
  SkiaRenderer, createGrainTile, createSkiaMeasurer, preloadImages, registerFontFile,
} from '../../x80-video-engine/packages/renderer-skia/dist/index.js';
import { renderToMp4 } from '../../x80-video-engine/packages/encoding/dist/index.js';
import { compileHyper } from './compile.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const X80_ROOT = resolve(HERE, '../../x80-video-engine');

const slug = (family) => family.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

const FAMILY_ALIAS = {
  'bebas-neue': 'Bebas Neue',
  'ibm-plex-mono': 'IBM Plex Mono',
  'space-grotesk': 'Space Grotesk',
  'rozha-one': 'Rozha One',
};

export const registerFonts = (spec, specDir) => {
  let n = 0;
  const cacheRoot = join(X80_ROOT, 'fonts', 'cache');
  const manifestPath = join(X80_ROOT, 'fonts', 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const bySlug = new Map(Object.keys(manifest).map((f) => [slug(f), f]));
  if (existsSync(cacheRoot)) {
    const dirs = readdirSync(cacheRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name).sort();
    for (const dir of dirs) {
      const family = bySlug.get(dir) ?? FAMILY_ALIAS[dir] ?? dir;
      const files = readdirSync(join(cacheRoot, dir))
        .filter((f) => /\.(ttf|otf)$/i.test(f)).sort();
      if (files.length === 0) throw new Error(`font cache empty: ${join(cacheRoot, dir)}`);
      for (const file of files) {
        registerFontFile(join(cacheRoot, dir, file), family);
        n += 1;
      }
    }
  }
  for (const f of spec.fonts ?? []) {
    if (!f || !f.family || !f.file) throw new Error('spec.fonts[] needs {family, file}');
    const file = isAbsolute(f.file) ? f.file : resolve(specDir, f.file);
    if (!existsSync(file)) throw new Error(`font file missing: ${file}`);
    registerFontFile(file, f.family);
    n += 1;
  }
  return n;
};

export const loadSpec = (specPath) => {
  const abs = resolve(specPath);
  const spec = JSON.parse(readFileSync(abs, 'utf8'));
  return { spec, specDir: dirname(abs) };
};

const assetEntries = (spec, specDir) => {
  const out = {};
  for (const [id, rel] of Object.entries(spec.assets ?? {})) {
    if (typeof rel !== 'string') throw new Error(`assets.${id} must be a path string`);
    const p = isAbsolute(rel) ? rel : resolve(specDir, rel);
    if (!existsSync(p)) throw new Error(`asset "${id}" not found: ${p}`);
    if (/\.avif$/i.test(p)) throw new Error(`asset "${id}" is AVIF; Skia crashes on it. Re-upload it; the server converts AVIF to PNG.`);
    out[id] = p;
  }
  return out;
};

export const renderHyper = async (spec, opts = {}) => {
  const specDir = opts.specDir ?? process.cwd();
  const scale = opts.scale ?? 1;
  if (!(scale > 0 && scale <= 4)) throw new Error('scale must be in (0, 4]');

  const fonts = registerFonts(spec, specDir);
  const measure = createSkiaMeasurer();
  const { plan, totalFrames, width, height } = compileHyper(spec, { scale, measure, hideText: opts.hideText === true });

  const map = await preloadImages(assetEntries(spec, specDir));
  const dims = new Map();
  for (const [id, handle] of map) {
    dims.set(id, { width: handle.width, height: handle.height });
  }
  const grainWanted = JSON.stringify(plan.composition.root).includes('"grain"');
  if (grainWanted) {
    const g = spec.grain === true ? {} : (spec.grain ?? {});
    map.set('grain', createGrainTile(width, height, {
      amount: g.amount ?? 0.5,
      seed: g.seed ?? 7,
      cell: g.cell ?? 2,
    }));
  }

  const renderer = new SkiaRenderer();
  const surface = renderer.createSurface(width, height);
  const options = {
    measureText: measure,
    resolveAsset: (src) => map.get(src),
    assetInfo: (src) => dims.get(src),
  };
  const draw = (f) => {
    renderer.clear(surface, '#000000');
    renderFrame(renderer, surface, plan, f, options);
    return Buffer.from(renderer.readPixels(surface).data);
  };

  try {
    if (Array.isArray(opts.stills) && opts.stills.length > 0) {
      const written = [];
      for (const s of opts.stills) {
        const f = Math.round(Number(s) * (plan.composition.fps ?? 30));
        if (!Number.isFinite(f) || f < 0 || f >= totalFrames) {
          throw new Error(`still frame ${String(s)} is outside 0..${totalFrames - 1}`);
        }
        draw(f);
        const file = join(opts.out ?? join(specDir, '..', 'out'), `${spec.id ?? 'hyper'}-f${f}.png`);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, surface.handle.toBuffer('image/png'));
        written.push(file);
      }
      return { ok: true, mode: 'stills', files: written, width, height, frames: totalFrames, fonts };
    }

    const out = opts.out ?? join(specDir, '..', 'out', `${spec.id ?? 'hyper'}-${width}x${height}.mp4`);
    mkdirSync(dirname(out), { recursive: true });
    const t0 = Date.now();
    const mp4 = await renderToMp4({
      width, height,
      fps: plan.composition.fps,
      frameCount: totalFrames,
      renderFrame: (f) => {
        const buf = draw(f);
        opts.onProgress?.(f, totalFrames);
        return buf;
      },
      ...(spec.bitrate ? { videoBitrate: spec.bitrate } : {}),
    });
    writeFileSync(out, mp4);
    return {
      ok: true, mode: 'mp4', file: out, bytes: mp4.length,
      width, height, frames: totalFrames, fonts, ms: Date.now() - t0,
    };
  } finally {
    renderer.destroySurface(surface);
  }
};

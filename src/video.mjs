import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { DATA_ROOT } from './store.mjs';

const ASSET_DIR = join(DATA_ROOT, 'assets');
const VIDEO_DIR = join(DATA_ROOT, 'video');
const TMP_ASSET_DIR = join(DATA_ROOT, 'tmp', 'assets');
const TMP_VIDEO_DIR = join(DATA_ROOT, 'tmp', 'video');
export const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv', '.avi']);
const OUT_MAX = 24;
const OUT_MIN = 6;

const safe = (n) => String(n ?? 'video').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 84) || 'video';
const run = (bin, args, opts = {}) => execFileSync(bin, args, { stdio: 'pipe', ...opts });

const probe = (file) => {
  const raw = run('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ]).toString();
  const data = JSON.parse(raw);
  const stream = (data.streams ?? []).find((s) => s.codec_type === 'video') ?? {};
  const duration = Number(data.format?.duration ?? stream.duration ?? 0);
  if (!(duration > 0)) throw new Error(`video: cannot read duration of ${basename(file)}`);
  return {
    duration,
    width: Number(stream.width) || 0,
    height: Number(stream.height) || 0,
    fps: Number(String(stream.r_frame_rate ?? '0/1').split('/')[0]) / Math.max(1, Number(String(stream.r_frame_rate ?? '0/1').split('/')[1] ?? 1)) || 24,
  };
};

const timesFor = (duration, count) => {
  const pad = Math.min(0.25, duration * 0.03);
  const span = Math.max(0.01, duration - pad * 2);
  if (count <= 1) return [duration / 2];
  return Array.from({ length: count }, (_, i) => Math.round((pad + (span * i) / (count - 1)) * 1000) / 1000);
};

const ingestAt = (file, name, videoRoot, temp) => {
  if (!existsSync(file)) throw new Error(`video: source not found: ${name}`);
  const info = probe(file);
  const base = safe(basename(safe(name), extname(safe(name))));
  const dir = join(videoRoot, base);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const count = Math.max(OUT_MIN, Math.min(OUT_MAX, Math.round(info.duration * 5)));
  const times = timesFor(info.duration, count);
  const frames = [];
  times.forEach((t, i) => {
    const fname = `f${String(i).padStart(2, '0')}.jpg`;
    run('ffmpeg', [
      '-loglevel', 'error', '-y', '-ss', String(t), '-i', file,
      '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '3', join(dir, fname),
    ]);
    frames.push({ file: fname, t, url: `${temp ? '/data/tmp/video' : '/data/video'}/${encodeURIComponent(base)}/${fname}` });
  });
  const cols = 4;
  const rows = Math.ceil(frames.length / cols);
  const sheet = 'sheet.png';
  run('ffmpeg', [
    '-loglevel', 'error', '-y', '-pattern_type', 'glob', '-i', join(dir, 'f*.jpg'),
    '-vf', `scale=320:-2,tile=${cols}x${rows}:padding=6:margin=6`, '-frames:v', '1', join(dir, sheet),
  ]);
  const meta = {
    version: 1,
    name: safe(name),
    base,
    duration: Math.round(info.duration * 1000) / 1000,
    width: info.width,
    height: info.height,
    fps: Math.round(info.fps * 100) / 100,
    sampleFps: Math.round((frames.length / info.duration) * 100) / 100,
    count: frames.length,
    times,
    frames,
    sheet,
    sheetUrl: `${temp ? '/data/tmp/video' : '/data/video'}/${encodeURIComponent(base)}/${sheet}`,
    temp: Boolean(temp),
    bytes: statSync(file).size,
    hash: createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 20),
    ingestedAt: new Date().toISOString(),
  };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
};

export const ingestVideo = (name) => ingestAt(join(ASSET_DIR, safe(name)), safe(name), VIDEO_DIR, false);
export const ingestVideoFile = (file, name, { temp = false } = {}) => ingestAt(file, safe(name), temp ? TMP_VIDEO_DIR : VIDEO_DIR, temp);

export const videoAssets = () => {
  const scan = (root, temp) => {
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const file = join(root, d.name, 'meta.json');
        if (!existsSync(file)) return null;
        try {
          const meta = JSON.parse(readFileSync(file, 'utf8'));
          if (!existsSync(join(root, d.name, meta.sheet ?? 'sheet.png'))) return null;
          return { ...meta, temp: Boolean(temp ?? meta.temp) };
        } catch { return null; }
      })
      .filter(Boolean);
  };
  return [...scan(VIDEO_DIR, false), ...scan(TMP_VIDEO_DIR, true)]
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

export const AVIF_ERROR = 'AVIF is not supported: the renderer (Skia) crashes on it and this image stack has no AVIF decoder. Export PNG, JPG or WEBP.';

export const normalizeImage = (name, { temp = false } = {}) => {
  const dir = temp ? TMP_ASSET_DIR : ASSET_DIR;
  const file = join(dir, safe(name));
  const ext = extname(file).toLowerCase();
  if (ext === '.avif') {
    rmSync(file, { force: true });
    throw new Error(AVIF_ERROR);
  }
  return { name: safe(name), file, converted: false };
};

const SAFE_URL = /^https?:\/\//i;
const PRIVATE_HOST = /^(localhost|127\.|0\.0\.0\.0|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

export const fetchAssetUrl = async ({ url, mode = 'library', name } = {}) => {
  const target = String(url ?? '').trim();
  if (!SAFE_URL.test(target)) throw new Error('url must start with http:// or https://');
  const u = new URL(target);
  if (PRIVATE_HOST.test(u.hostname)) throw new Error('url host is not allowed (private address)');
  const res = await fetch(target, { signal: AbortSignal.timeout(120000), redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch ${res.status}: ${String(res.statusText).slice(0, 80)}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > 200_000_000) throw new Error('file is larger than 200 MB');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 200_000_000) throw new Error('file is larger than 200 MB');
  if (!buf.length) throw new Error('empty response');
  const fromUrl = basename(u.pathname) || 'download';
  const guessed = String(name || fromUrl).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 84) || 'download';
  const ext = extname(guessed).toLowerCase() || '.bin';
  if (ext === '.avif') throw new Error(AVIF_ERROR);
  const isVideo = VIDEO_EXT.has(ext);
  const temp = mode === 'temp';
  if (temp) {
    const dir = TMP_ASSET_DIR;
    mkdirSync(dir, { recursive: true });
    const file = join(dir, guessed);
    writeFileSync(file, buf);
    const norm = normalizeImage(guessed, { temp: true });
    const rel = `/data/tmp/assets/${encodeURIComponent(norm.name)}`;
    if (isVideo) return { mode: 'temp', asset: { name: norm.name, url: rel, ext: ext.replace('.', ''), bytes: buf.length }, video: ingestVideoFile(file, norm.name, { temp: true }) };
    return { mode: 'temp', asset: { name: norm.name, url: rel, ext: extname(norm.name).replace('.', ''), bytes: buf.length }, video: null };
  }
  const safeName = guessed;
  const file = join(ASSET_DIR, safeName);
  mkdirSync(ASSET_DIR, { recursive: true });
  writeFileSync(file, buf);
  const norm = normalizeImage(safeName);
  return {
    mode: 'library',
    asset: { name: norm.name, url: `/data/assets/${encodeURIComponent(norm.name)}`, ext: extname(norm.name).replace('.', ''), bytes: statSync(norm.file).size },
    video: isVideo ? ingestVideo(norm.name) : null,
  };
};

export const videoMeta = (name) => videoAssets().find((v) => v.name === safe(name) || v.base === safe(name)) ?? null;

export const videoSheetBuffer = (name) => {
  const meta = videoMeta(name);
  if (!meta) return null;
  const file = join(VIDEO_DIR, meta.base, meta.sheet ?? 'sheet.png');
  if (!existsSync(file)) return null;
  return { meta, buf: readFileSync(file), ext: '.png' };
};

export const videoAssetsForPlan = () => videoAssets().map((v, i) => {
  const dir = v.temp ? TMP_VIDEO_DIR : VIDEO_DIR;
  return {
    id: `v${i}`,
    name: v.name,
    rel: join(dir, v.base),
    duration: v.duration,
    width: v.width,
    height: v.height,
    sampleFps: v.sampleFps,
    frames: v.frames.map((f, n) => ({ id: `v${i}f${n}`, rel: join(dir, v.base, f.file), t: f.t })),
  };
});

import { deflateRawSync } from 'node:zlib';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const IMAGE_DIR = join(ROOT, 'data', 'images');

for (const dir of [ROOT, IMAGE_DIR]) mkdirSync(dir, { recursive: true });

const FRAME_TEMPLATES = [
  { id: 'frame-01', desc: 'Opening hook image', tags: ['hook', 'opening', 'attention'] },
  { id: 'frame-02', desc: 'The problem / before', tags: ['problem', 'before', 'contrast-a'] },
  { id: 'frame-03', desc: 'The solution / product', tags: ['solution', 'product', 'contrast-b'] },
  { id: 'frame-04', desc: 'Proof / detail', tags: ['proof', 'detail', 'stat'] },
  { id: 'frame-05', desc: 'Call to action', tags: ['cta', 'action', 'end'] },
];

export const defaultFrameSlots = (count = 5) => {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const base = FRAME_TEMPLATES[i % FRAME_TEMPLATES.length];
    out.push({ ...base, id: `frame-${String(i + 1).padStart(2, '0')}` });
  }
  return out;
};

const parsePng = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 33) throw new Error('image: file is not a PNG');
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('image: bad PNG signature');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  let alpha = colorType === 4 || colorType === 6;
  let offset = 8;
  while (offset + 12 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'tRNS') alpha = true;
    if (type === 'IEND') break;
    offset += 12 + len;
  }
  return { width, height, bitDepth, colorType, alpha };
};

export const validateImageManifest = (manifest) => {
  if (!manifest || typeof manifest !== 'object') throw new Error('image: manifest is not an object');
  const frames = Array.isArray(manifest.frames) ? manifest.frames : [];
  if (!frames.length) throw new Error('image: frames[] is empty');
  const seen = new Set();
  for (const [i, f] of frames.entries()) {
    if (!f || typeof f !== 'object') throw new Error(`image: frames[${i}] is not an object`);
    const id = String(f.id ?? '').trim();
    if (!id) throw new Error(`image: frames[${i}].id is required`);
    if (seen.has(id)) throw new Error(`image: duplicate frame id "${id}"`);
    seen.add(id);
    if (!f.prompt || typeof f.prompt !== 'string' || f.prompt.trim().length < 4) {
      throw new Error(`image: frame "${id}" prompt is required (4+ chars)`);
    }
    const x = Number(f.x ?? 0);
    const y = Number(f.y ?? 0);
    const w = Number(f.w ?? 1080);
    const h = Number(f.h ?? 1920);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
      throw new Error(`image: frame "${id}" placement must be numbers`);
    }
    if (w <= 0 || h <= 0) throw new Error(`image: frame "${id}" size must be positive`);
    const dur = Number(f.duration ?? 0);
    if (!Number.isFinite(dur) || dur <= 0) throw new Error(`image: frame "${id}" duration must be > 0`);
  }
  return { ...manifest, frames };
};

const safeName = (n) => String(n ?? 'image-plan').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'image-plan';

export const saveImagePlan = (name, frames) => {
  const safe = safeName(name);
  const dir = join(IMAGE_DIR, safe);
  mkdirSync(dir, { recursive: true });
  const saved = [];
  for (const f of frames) {
    if (!f.png) throw new Error(`image: frame "${f.id}" png base64 is required`);
    const png = Buffer.from(String(f.png).replace(/^data:image\/png;base64,/, ''), 'base64');
    const info = parsePng(png);
    if (!info.alpha) throw new Error(`image: frame "${f.id}" PNG must have an alpha channel (transparent background)`);
    const file = `${safeName(f.id)}.png`;
    writeFileSync(join(dir, file), png);
    saved.push({
      id: f.id,
      prompt: String(f.prompt).trim(),
      x: Number(f.x ?? 0), y: Number(f.y ?? 0),
      w: Number(f.w ?? 1080), h: Number(f.h ?? 1920),
      duration: Number(f.duration ?? 3),
      file, bytes: png.length,
      url: `/data/images/${safe}/${encodeURIComponent(file)}`,
    });
  }
  const manifest = { name: safe, frames: saved, updatedAt: new Date().toISOString() };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
};

export const listImagePlans = () => {
  if (!existsSync(IMAGE_DIR)) return [];
  return readdirSync(IMAGE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      try {
        const m = JSON.parse(readFileSync(join(IMAGE_DIR, d.name, 'manifest.json'), 'utf8'));
        return { name: m.name ?? d.name, frames: m.frames.length, updatedAt: m.updatedAt };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
};

export const getImagePlan = (name) => {
  const safe = safeName(name);
  const file = join(IMAGE_DIR, safe, 'manifest.json');
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'), null);
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export const zipFiles = (files) => {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const now = new Date();
  const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff;
  const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const raw = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
    const data = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local, data);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, end]);
};

export const framePlanMd = ({ client = {}, brief = '', count = 5, slots = [] }) => {
  const name = client.name || 'the client';
  const palette = client.palette && Object.keys(client.palette).length
    ? Object.entries(client.palette).map(([k, v]) => `- ${k}: ${v}`).join('\n')
    : '- Use a restrained palette. One accent color. No rainbow gradients.';
  const rowsMd = slots.map((s) =>
    `| \`${s.id}\` | ${(s.tags ?? []).join(', ')} | ${s.desc ?? ''} |`).join('\n');
  const manifest = { name: 'image-plan', count, frames: slots.map((s) => ({
    id: s.id,
    prompt: '',
    x: 0, y: 0, w: 1080, h: 1920, duration: 3,
    tags: s.tags ?? [],
  })) };
  return `# Per-frame image brief for ${name}

Give this file and \`image-manifest.json\` to ChatGPT (or any image model) with this instruction:

> For each frame slot below, write one image prompt and a placement box. Return one manifest JSON file plus one PNG per frame. Keep transparent backgrounds where you want objects to float over the board.

## Hard rules
- One PNG per frame id: \`frame-01.png\`, \`frame-02.png\`, etc.
- Background: transparent PNG. No white box. No drop shadow outside the object.
- One clear subject per frame. Centered in its placement box.
- No text, no numbers, no watermark, no border inside the image (text is added by Custom Hyper).
- Export as PNG with alpha.
- Match the placement box in the manifest; do not change x/y/w/h/duration unless the brief demands it.

## Client style
${client.description || 'No client description yet.'}

## Brief
${brief || 'No brief yet.'}

## Palette
${palette}

## Frame slots
| id | tags | what to draw |
|---|---|---|
${rowsMd}

## Return
Return one manifest JSON plus one PNG per frame:

\`\`\`json
${JSON.stringify(manifest, null, 2)}
\`\`\`

Upload the manifest and all PNGs to Custom Hyper Studio.
`;
};

export const manifestTemplate = (count = 5, slots = []) => ({
  name: 'image-plan',
  count,
  frames: slots.map((s) => ({
    id: s.id,
    prompt: '',
    x: 0, y: 0, w: 1080, h: 1920, duration: 3,
    tags: s.tags ?? [],
  })),
});

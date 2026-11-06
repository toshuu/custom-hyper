import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', 'data');
export const DATA_ROOT = ROOT;
export const ASSET_DIR = join(ROOT, 'assets');
export const PROJECT_DIR = join(ROOT, 'projects');
export const IMAGE_DIR = join(ROOT, 'images');

for (const dir of [ROOT, ASSET_DIR, PROJECT_DIR, IMAGE_DIR]) mkdirSync(dir, { recursive: true });

const readJson = (file, fallback = null) => {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
};

const writeJson = (file, value) => {
  mkdirSync(resolve(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2));
};

export const getClient = () => readJson(join(ROOT, 'client.json'), {
  name: 'Acme',
  description: '',
  goals: '',
  palette: {},
  faces: {},
});

const SETTINGS_FILE = join(ROOT, 'settings.json');

export const getSettings = () => readJson(SETTINGS_FILE, {});

export const saveSettings = (input = {}) => {
  const prev = getSettings();
  const next = {
    ...prev,
    provider: String(input.provider ?? prev.provider ?? 'gemini').toLowerCase(),
    model: String(input.model ?? prev.model ?? '').trim().slice(0, 120),
    apiKey: String(input.apiKey ?? prev.apiKey ?? '').trim().slice(0, 4096),
    baseUrl: String(input.baseUrl ?? prev.baseUrl ?? '').trim().slice(0, 500),
    language: ['en', 'hi', 'mr'].includes(String(input.language)) ? String(input.language) : (prev.language ?? 'en'),
    seconds: Math.max(4, Math.min(20, Number(input.seconds) || prev.seconds || 12)),
    format: ['vertical', 'square', 'landscape'].includes(String(input.format)) ? String(input.format) : (prev.format ?? 'vertical'),
    updatedAt: new Date().toISOString(),
  };
  writeJson(SETTINGS_FILE, next);
  try { chmodSync(SETTINGS_FILE, 0o600); } catch {}
  return next;
};

export const saveClient = (client) => {
  const next = {
    name: String(client.name ?? '').trim().slice(0, 80),
    description: String(client.description ?? '').trim().slice(0, 1200),
    goals: String(client.goals ?? '').trim().slice(0, 1200),
    palette: client.palette && typeof client.palette === 'object' ? client.palette : {},
    faces: client.faces && typeof client.faces === 'object' ? client.faces : {},
    updatedAt: new Date().toISOString(),
  };
  writeJson(join(ROOT, 'client.json'), next);
  return next;
};

export const listAssets = () => readdirSync(ASSET_DIR, { withFileTypes: true })
  .filter((d) => d.isFile() && !d.name.startsWith('.'))
  .map((d) => d.name)
  .sort()
  .map((f) => {
    const full = join(ASSET_DIR, f);
    const st = statSync(full);
    return {
      name: f,
      url: `/data/assets/${encodeURIComponent(f)}`,
      bytes: st.size,
      ext: extname(f).toLowerCase().replace('.', ''),
    };
  });

export const removeAsset = (name) => {
  const safe = String(name || '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
  if (!safe) throw new Error('bad asset name');
  const file = join(ASSET_DIR, safe);
  if (!existsSync(file)) throw new Error('asset not found');
  unlinkSync(file);
  return { name: safe };
};

export const addAsset = (name, buffer) => {
  const safe = String(name || 'asset').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
  const file = join(ASSET_DIR, safe);
  writeFileSync(file, buffer);
  return { name: safe, bytes: buffer.length, url: `/data/assets/${encodeURIComponent(safe)}` };
};

export const projectPath = (id, ...rest) => join(PROJECT_DIR, id, ...rest);
export const getProject = (id) => readJson(projectPath(id, 'meta.json'), null);
export const saveProject = (id, meta) => writeJson(projectPath(id, 'meta.json'), meta);
export const saveSpec = (id, spec) => writeJson(projectPath(id, 'spec.json'), spec);
export const getSpec = (id) => readJson(projectPath(id, 'spec.json'), null);
export const saveBoards = (id, boards) => writeJson(projectPath(id, 'boards.json'), boards);
export const getBoards = (id) => readJson(projectPath(id, 'boards.json'), null);
export const savePlan = (id, plan) => writeJson(projectPath(id, 'plan.json'), plan);
export const getPlan = (id) => readJson(projectPath(id, 'plan.json'), null);
export const saveCrackdown = (id, rows) => writeJson(projectPath(id, 'crackdown.json'), rows);
export const getCrackdown = (id) => readJson(projectPath(id, 'crackdown.json'), null);

export const listProjects = () => readdirSync(PROJECT_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => getProject(d.name))
  .filter(Boolean)
  .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

export const assetRelFromProject = (id, name) => join(ASSET_DIR, name);
export const videoRelFromProject = (id, name) => `../video/${name}`;

export { readJson, writeJson, copyFileSync };

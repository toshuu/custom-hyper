#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileHyper, validateSpec } from './compile.mjs';
import { lintSpec } from './lint.mjs';
import { slideshowLint } from './slideshow-lint.mjs';
import { loadSpec, renderHyper, registerFonts } from './render.mjs';
import { demoPlan } from './director.mjs';
import { generatePlan } from './llm.mjs';
import { createSkiaMeasurer } from '../../x80-video-engine/packages/renderer-skia/dist/index.js';

const argv = process.argv.slice(2);
const cmd = argv[0];
const specArg = argv[1];
const known = new Set(['check', 'lint', 'plan', 'stills', 'render', 'verify', 'briefs', 'index']);
if (!cmd || (!specArg && !known.has(cmd)) || cmd.startsWith('--')) {
  console.error('usage: node src/cli.mjs <check|lint|plan|stills|render|verify|briefs> <spec.json|briefs.json> [options]');
  console.error('       node src/cli.mjs index [options]   # describe video assets with vision');
  process.exit(2);
}

const flag = (name, d) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d;
};

if (cmd === 'briefs') {
  const data = JSON.parse(readFileSync(resolve(specArg), 'utf8'));
  const briefs = Array.isArray(data) ? data : data.briefs;
  if (!Array.isArray(briefs) || !briefs.length) throw new Error('briefs file needs {briefs:[...]}');
  const provider = String(flag('provider', 'gemini')).toLowerCase();
  const key = flag('key', process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '');
  const demo = argv.includes('--demo') || !key;
  if (!demo && provider === 'gemini' && !process.env.GEMINI_API_KEY && !flag('key')) {
    console.log(JSON.stringify({ ok: false, error: 'No API key in env. Set GEMINI_API_KEY or OPENAI_API_KEY, or run with --demo.' }, null, 2));
    process.exit(0);
  }
  const model = flag('model', undefined);
  const limit = Number(flag('limit', briefs.length));
  const rows = [];
  for (const [i, brief] of briefs.slice(0, limit).entries()) {
    const text = String(brief.brief ?? brief.text ?? '');
    const language = brief.language ?? 'en';
    const seconds = Number(brief.seconds) || 12;
    let plan;
    let meta;
    if (demo) {
      plan = demoPlan(text, Number(brief.seed) || i + 11, language);
      meta = { provider: 'demo', model: 'local-director', usage: { input: 0, output: 0 } };
    } else {
      const res = await generatePlan({
        brief: text, seconds, format: brief.format ?? 'vertical', language,
        provider, apiKey: key, model, baseUrl: flag('baseUrl', undefined), seed: Number(brief.seed) || i + 11,
      });
      plan = res.plan;
      meta = { provider: res.provider, model: res.model, usage: res.usage };
    }
    rows.push({
      id: brief.id ?? `b${i + 1}`,
      language,
      title: plan.title,
      structure: plan.structure ?? '',
      ...meta,
      beats: plan.beats.map((b, n) => ({
        n: n + 1, kind: b.kind, headline: b.headline, body: b.body, vo: b.vo ?? '', items: b.items ?? [],
      })),
    });
  }
  console.log(JSON.stringify({ ok: true, demo, provider, count: rows.length, rows }, null, 2));
  process.exit(0);
}

const { spec, specDir } = specArg ? loadSpec(specArg) : { spec: {}, specDir: process.cwd() };
const scale = Number(flag('scale', '1'));
if (!(scale > 0 && scale <= 4)) {
  console.error(`bad --scale ${flag('scale')}`);
  process.exit(2);
}

if (cmd === 'lint') {
  const lint = lintSpec(spec);
  const show = slideshowLint(spec);
  console.log(JSON.stringify({
    ...lint,
    slideshow: { ok: show.ok, score: show.score, errors: show.errors, warnings: show.warnings, metrics: show.metrics },
  }, null, 2));
  process.exit(lint.ok && show.ok ? 0 : 1);
}

if (cmd === 'check') {
  validateSpec(spec);
  const lint = lintSpec(spec);
  if (!lint.ok) {
    console.error(JSON.stringify({ ok: false, errors: lint.errors }, null, 2));
    process.exit(1);
  }
  const fonts = registerFonts(spec, specDir);
  const measure = createSkiaMeasurer();
  const out = compileHyper(spec, { scale, measure });
  console.log(JSON.stringify({
    ok: true,
    id: spec.id,
    canvas: `${out.width}x${out.height}@${out.fps}`,
    seconds: spec.duration,
    frames: out.totalFrames,
    layers: spec.layers.length,
    fonts,
    warnings: lint.warnings,
  }, null, 2));
  process.exit(0);
}

if (cmd === 'plan') {
  const measure = createSkiaMeasurer();
  registerFonts(spec, specDir);
  const { plan, totalFrames } = compileHyper(spec, { scale, measure });
  const out = resolve(flag('out', resolve(specDir, '..', 'out', `${spec.id ?? 'hyper'}.plan.json`)));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(plan, null, 2));
  console.log(JSON.stringify({ ok: true, plan: out, frames: totalFrames }, null, 2));
  process.exit(0);
}

if (cmd === 'verify') {
  const atArg = String(flag('at', '0.5,2'));
  const run = () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'hyper-verify-'));
    execFileSync(process.execPath, [fileURLToPath(import.meta.url), 'stills', specArg, '--at', atArg, '--scale', String(scale), '--out', dir], { stdio: 'ignore' });
    return dir;
  };
  const d1 = run();
  const d2 = run();
  const names = readdirSync(d1).sort();
  const rows = names.map((name) => {
    const h = (d) => createHash('sha256').update(readFileSync(resolve(d, name))).digest('hex');
    const a = h(d1);
    const b = h(d2);
    return { frame: name, a: a.slice(0, 16), b: b.slice(0, 16), same: a === b };
  });
  const ok = rows.every((r) => r.same);
  console.log(JSON.stringify({ ok, runs: [d1, d2], rows }, null, 2));
  process.exit(ok ? 0 : 1);
}

if (cmd === 'stills') {
  const at = String(flag('at', '0.5,2,5')).split(',').map((s) => Number(s.trim()));
  if (at.some((n) => !Number.isFinite(n))) {
    console.error('bad --at; use seconds like 0.5,2,5');
    process.exit(2);
  }
  const res = await renderHyper(spec, {
    specDir,
    scale,
    stills: at,
    out: resolve(flag('out', resolve(specDir, '..', 'out'))),
  });
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

if (cmd === 'render') {
  const res = await renderHyper(spec, {
    specDir,
    scale,
    out: flag('out', undefined),
    onProgress: (f, total) => {
      if (f % 60 === 0 || f === total - 1) process.stdout.write(`\r[render] ${f + 1}/${total}`);
    },
  });
  process.stdout.write('\n');
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

if (cmd === 'index') {
  const provider = String(flag('provider', 'gemini')).toLowerCase();
  const model = flag('model', process.env.GEMINI_MODEL || 'gemini-2.0-flash');
  const apiKey = flag('key', process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '');
  const baseUrl = flag('baseUrl', '');
  const { indexAssets, assetStatus } = await import('./assets.mjs');
  if (!apiKey) {
    console.error('index needs a key: set GEMINI_API_KEY, OPENAI_API_KEY, or pass --key');
    process.exit(2);
  }
  const status = assetStatus();
  console.log(`Found ${status.unindexed.length} unindexed assets: ${status.unindexed.join(', ') || 'none'}`);
  const res = await indexAssets({ provider, model, apiKey, baseUrl, limit: 12 });
  console.log(JSON.stringify({ ok: true, processed: res.processed, indexed: res.indexed, usage: res.usage, model: res.model }, null, 2));
  if (res.processed) console.log(JSON.stringify(res.items.filter((a) => a.kind === 'video' && a.indexed), null, 2));
  process.exit(0);
}

console.error(`unknown command "${cmd}"`);
  process.exit(2);

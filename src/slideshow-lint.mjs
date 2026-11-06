// Slideshow lint: does this HyperSpec look like a reel or like slides?
// Pure JSON analysis. No render. Deterministic. Exit 1 on errors.
//   node src/slideshow-lint.mjs specs/foo.json [--json]
import fs from 'node:fs';

const HERO = new Set(['calendarFlip', 'counterRoll', 'beforeAfter', 'receipt', 'photoCam', 'cardStack', 'photo', 'image', 'sprite', 'bars', 'timeline', 'ledger', 'stamp']);
const MECH = new Set(['calendarFlip', 'counterRoll', 'beforeAfter', 'receipt', 'photoCam', 'cardStack']);
const GROUND_ONLY = new Set(['bg', 'atmosphere', 'grain', 'progress', 'space']);

const walk = (blocks, fn, depth = 0) => {
  for (const b of blocks ?? []) {
    if (!b || typeof b !== 'object') continue;
    fn(b, depth);
    if (Array.isArray(b.children)) walk(b.children, fn, depth + 1);
    if (b.child) walk([b.child], fn, depth + 1);
  }
};
const types = (blocks) => { const s = new Set(); walk(blocks, (b) => s.add(b.type)); return s; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const cv = (a) => { const m = mean(a); return m ? Math.sqrt(mean(a.map((x) => (x - m) ** 2))) / m : 0; };

export const slideshowLint = (spec) => {
  const total = spec.duration;
  const layers = (spec.layers ?? []).map((l, i) => ({ ...l, i, from: l.from ?? 0, dur: l.duration ?? total - (l.from ?? 0) }));
  const ground = layers.filter((l) => l.dur >= total * 0.85);
  const beats = layers.filter((l) => l.dur < total * 0.85 && ![...types(l.blocks)].every((t) => GROUND_ONLY.has(t)));
  const errors = [], warnings = [], m = {};

  m.beats = beats.length;
  const heroBeats = beats.filter((l) => [...types(l.blocks)].some((t) => HERO.has(t)));
  m.heroRatio = beats.length ? +(heroBeats.length / beats.length).toFixed(2) : 0;
  m.mechanicBeats = beats.filter((l) => [...types(l.blocks)].some((t) => MECH.has(t))).length;
  m.mechanicsUsed = [...new Set(beats.flatMap((l) => [...types(l.blocks)].filter((t) => MECH.has(t))))];

  if (beats.length >= 3 && m.heroRatio < 0.6) errors.push(`SLIDESHOW: only ${heroBeats.length}/${beats.length} beats have a hero visual (mechanic/photo/chart). Need >= 60%.`);
  if (beats.length >= 4 && m.mechanicBeats < 2) errors.push(`NO MECHANICS: ${m.mechanicBeats} beat(s) use a mechanic. Need >= 2 (calendarFlip, counterRoll, beforeAfter, receipt, photoCam, cardStack).`);

  const sig = beats.map((l) => [...types(l.blocks)].filter((t) => !GROUND_ONLY.has(t)).sort().join('+'));
  let rep = 0; for (let i = 1; i < sig.length; i += 1) if (sig[i] === sig[i - 1]) rep += 1;
  m.repeatedNeighbours = rep;
  if (rep > 0) warnings.push(`${rep} beat(s) reuse the exact block mix of the previous beat.`);
  if (new Set(sig).size < Math.min(beats.length, 3)) warnings.push('Fewer than 3 distinct beat compositions.');

  let tracks = 0; for (const l of [...layers, { blocks: spec.chrome?.blocks }]) walk(l.blocks, (b) => { if (b.type === 'track') tracks += 1; });
  const longBeats = beats.filter((l) => l.dur >= total * 0.4).length;
  m.persistent = tracks;
  if (beats.length >= 4 && tracks === 0) errors.push('NO CONTINUITY: no `track` element persists across beats. Add one shared element that moves between poses.');

  const durs = beats.map((l) => l.dur);
  m.beatDur = { min: +Math.min(...(durs.length ? durs : [0])).toFixed(2), max: +Math.max(...(durs.length ? durs : [0])).toFixed(2), cv: +cv(durs).toFixed(2) };
  if (beats.length >= 4 && m.beatDur.cv < 0.18) warnings.push(`UNIFORM PACING: beat lengths vary only ${Math.round(m.beatDur.cv * 100)}%. Mix 0.6-1.2 s punches with 2.5-3.5 s holds.`);

  const ins = new Set(); let blocksN = 0;
  for (const l of layers) walk(l.blocks, (b) => { blocksN += 1; if (b.motion?.in?.type) ins.add(b.motion.in.type); });
  m.entranceTypes = ins.size;
  if (beats.length >= 4 && ins.size + m.mechanicsUsed.length < 5) warnings.push('LOW MOTION VOCABULARY: fewer than 5 distinct entrances + mechanics.');

  const trs = new Set((spec.transitions ?? []).map((t) => t.type));
  m.transitionTypes = trs.size;
  if (beats.length >= 4 && trs.size < 2) warnings.push('One transition type only. Use 2+ or let a mechanic carry the cut.');

  let textBlocks = 0, textChars = 0;
  for (const l of beats) walk(l.blocks, (b) => { if (b.type === 'text') { textBlocks += 1; textChars += String(b.text ?? '').length; } });
  m.textPerBeat = beats.length ? +(textBlocks / beats.length).toFixed(1) : 0;

  let score = 100 - errors.length * 25 - warnings.length * 7;
  m.score = Math.max(0, score);
  return { ok: errors.length === 0, score: m.score, errors, warnings, metrics: m };
};

if (process.argv[1] && process.argv[1].endsWith('slideshow-lint.mjs')) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node src/slideshow-lint.mjs spec.json [--json]'); process.exit(2); }
  const r = slideshowLint(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  score ${r.score}  ${file}`);
    r.errors.forEach((e) => console.log('  ERROR ', e));
    r.warnings.forEach((w) => console.log('  warn  ', w));
    console.log('  ', JSON.stringify(r.metrics));
  }
  process.exit(r.ok ? 0 : 1);
}

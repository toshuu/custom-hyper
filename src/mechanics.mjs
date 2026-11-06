// Custom Hyper - mechanics library.
// A mechanic is a composite block: one HyperSpec block that expands to a
// small X80 node tree with baked motion. Same JSON -> same frames.
// No DOM, no network, no randomness. Only primitives blocks.mjs already uses:
// group(+clip), rect, rrect, circle, text, image, anchorX/Y, baked keyframes.
//
// Wire-up (3 lines in blocks.mjs, see docs/MECHANICS.md section 6):
//   import { MECHANICS, compileMechanic } from './mechanics.mjs';
//   case 'calendarFlip': case 'counterRoll': case 'beforeAfter':
//   case 'receipt': case 'photoCam': case 'cardStack': case 'track':
//     return compileMechanic(b, ctx, { fillOf, color, compile: compileList });

import { bake, combineMotion } from './motion.mjs';
import { easeFn } from './ease.mjs';

export const MECHANICS = ['calendarFlip', 'counterRoll', 'beforeAfter', 'receipt', 'photoCam', 'cardStack', 'track'];

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, u) => a + (b - a) * u;
const prog = (t, at, dur, ease = 'power2.out') => easeFn(ease)(clamp01((t - at) / Math.max(0.001, dur)));
const ID = { anchor: (w, h) => ({ anchorX: w / 2, anchorY: h / 2 }) };

const baseOf = (b) => ({
  x: num(b.x, 0), y: num(b.y, 0), rotation: num(b.rotation, 0), opacity: num(b.opacity, 1),
  scaleX: num(b.scale, 1), scaleY: num(b.scale, 1), blur: 0,
});
const groupProps = (b, ctx) => combineMotion(baseOf(b), b.motion, ctx);
const fine = (ctx) => ({ ...ctx, step: 1 }); // bake every frame for fast moves
const bakeF = (fn, ctx, opts = {}) => bake(fn, ctx, { step: 1, ...opts });

const needStr = (b, k) => {
  if (typeof b[k] !== 'string' || !b[k]) throw new Error(`${b.type}: "${k}" is required`);
  return b[k];
};

// ---------------------------------------------------------------- calendarFlip
// A calendar card whose year wheel scrolls from `from` to `to`.
// Use for: "back in 1956", time passing, history, deadlines, ages.
const calendarFlip = (b, ctx, H, id) => {
  const w = num(b.w, 560), h = num(b.h, 700);
  const headerH = num(b.headerH, h * 0.2);
  const winH = h - headerH;
  const rowH = num(b.rowH, 150);
  const labels = Array.isArray(b.labels) && b.labels.length > 1
    ? b.labels.map(String)
    : (() => {
        const from = num(b.from, 2000), to = num(b.to, 2024), st = Math.max(1, Math.abs(num(b.step, 1)));
        const dir = to >= from ? 1 : -1;
        const out = [];
        for (let v = from; dir > 0 ? v <= to : v >= to; v += dir * st) out.push(String(v));
        if (out[out.length - 1] !== String(to)) out.push(String(to));
        return out;
      })();
  if (labels.length > 160) throw new Error(`calendarFlip: ${labels.length} labels is too many, raise "step" (max 160)`);
  const at = num(b.at, 0.3), dur = num(b.dur, 1.7), ease = b.ease ?? 'power3.inOut';
  const last = labels.length - 1;
  const idx = (t) => last * prog(t, at, dur, ease);
  const P = ctx.pal;
  const size = num(b.size, rowH * 0.72);
  const face = b.face ?? ctx.faces.display;

  const g = { id, type: 'group', ...groupProps(b, ctx) };
  const card = { id: `${id}-card`, type: 'group', clip: { x: 0, y: 0, width: w, height: h, radius: num(b.radius, 28) }, children: [] };
  g.children = [
    { id: `${id}-sh`, type: 'rrect', width: w, height: h, radius: num(b.radius, 28), x: 0, y: 0, fill: H.fillOf(b.paper ?? 'paper', P), shadow: { color: 'rgba(0,0,0,0.35)', blur: 40, offsetX: 0, offsetY: 24 } },
    card,
  ];
  card.children.push({ id: `${id}-paper`, type: 'rect', width: w, height: h, x: 0, y: 0, fill: H.fillOf(b.paper ?? 'paper', P) });
  card.children.push({ id: `${id}-head`, type: 'rect', width: w, height: headerH, x: 0, y: 0, fill: H.fillOf(b.headerFill ?? 'accent', P) });
  if (b.label !== false) {
    card.children.push({
      id: `${id}-hl`, type: 'text', text: String(b.label ?? 'YEAR').toUpperCase(),
      fontFamily: ctx.faces.mono, fontSize: num(b.labelSize, 30), fontWeight: 700, letterSpacing: 8,
      fill: H.fillOf(b.headerInk ?? 'bg', P), x: 0, y: headerH / 2 - 18, maxWidth: w, textAlign: 'center',
    });
  }
  [0.18, 0.82].forEach((u, i) => card.children.push({ id: `${id}-ring${i}`, type: 'circle', radius: 13, x: w * u, y: 20, fill: H.fillOf('bg', P) }));

  const win = { id: `${id}-win`, type: 'group', x: 0, y: headerH, clip: { x: 0, y: 0, width: w, height: winH }, children: [] };
  const scroller = { id: `${id}-scr`, type: 'group', x: 0, y: bakeF((t) => winH / 2 - rowH / 2 - idx(t) * rowH, ctx), children: [] };
  labels.forEach((lab, i) => {
    const near = (t) => Math.abs(i - idx(t));
    const settle = (t) => (i === last ? 1 + 0.08 * Math.sin(Math.PI * clamp01((t - (at + dur)) / 0.35)) * (t > at + dur ? 1 : 0) : 1);
    scroller.children.push({
      id: `${id}-y${i}`, type: 'text', text: lab, fontFamily: face, fontSize: size, fontWeight: 800,
      fill: H.fillOf(b.ink ?? 'bg', P), x: 0, y: i * rowH, maxWidth: w, textAlign: 'center', lineHeight: 1,
      opacity: bakeF((t) => 1 - clamp01(near(t) / 2.4) * 0.82, ctx),
      scaleX: bakeF((t) => (1 - clamp01(near(t) / 2.4) * 0.28) * settle(t), ctx),
      scaleY: bakeF((t) => (1 - clamp01(near(t) / 2.4) * 0.28) * settle(t), ctx),
      anchorX: w / 2, anchorY: size / 2,
    });
  });
  win.children.push(scroller);
  const fade = (y0, dir) => ({
    id: `${id}-fd${dir}`, type: 'rect', width: w, height: winH * 0.28, x: 0, y: y0,
    fill: { kind: 'linear', angle: dir > 0 ? 90 : 270, stops: [{ offset: 0, color: H.color(b.paper ?? 'paper', P) }, { offset: 1, color: 'rgba(255,255,255,0)' }] },
  });
  win.children.push(fade(0, 1), fade(winH - winH * 0.28, -1));
  win.children.push({ id: `${id}-hi`, type: 'rect', width: w - 80, height: 4, x: 40, y: winH / 2 + rowH * 0.46, fill: H.fillOf('accent', P) });
  win.children.push({ id: `${id}-hi2`, type: 'rect', width: w - 80, height: 4, x: 40, y: winH / 2 - rowH * 0.5, fill: H.fillOf('accent', P) });
  card.children.push(win);
  return [g];
};

// ---------------------------------------------------------------- counterRoll
// Odometer. Each digit is a clipped column that rolls. Use for money, years,
// percentages, followers, "from 10 to 10,000".
const fmtInt = (n, grouping) => {
  const s = String(Math.max(0, Math.round(n)));
  if (grouping === 'none') return s;
  if (grouping === 'indian') {
    if (s.length <= 3) return s;
    const tail = s.slice(-3);
    let head = s.slice(0, -3);
    const parts = [];
    while (head.length > 2) { parts.unshift(head.slice(-2)); head = head.slice(0, -2); }
    if (head) parts.unshift(head);
    return `${parts.join(',')},${tail}`;
  }
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const counterRoll = (b, ctx, H, id) => {
  const to = num(b.to, 100), from = num(b.from, 0);
  const grouping = b.grouping ?? 'intl';
  const toStr = fmtInt(to, grouping);
  const nDig = [...toStr].filter((c) => /\d/.test(c)).length;
  const fromDigits = String(Math.max(0, Math.round(from))).padStart(nDig, '0').slice(-nDig).split('').map(Number);
  const face = b.face ?? ctx.faces.display;
  const weight = num(b.weight, 800);
  const pre0 = b.prefix ? String(b.prefix) : '';
  const suf0 = b.suffix ? String(b.suffix) : '';
  const styleAt = (sz) => ({ fontFamily: face, fontSize: sz, fontWeight: weight, fontStyle: 'normal', letterSpacing: 0, textTransform: 'none' });
  const widthAt = (sz) => {
    const st = styleAt(sz), m = (s) => ctx.measure.measure(s, st).width;
    const d = Math.max(...'0123456789'.split('').map(m)) * num(b.tracking, 1.02);
    return nDig * d + (toStr.length - nDig) * m(',') + (pre0 ? m(pre0) + sz * 0.06 : 0) + (suf0 ? m(suf0) + sz * 0.06 : 0);
  };
  let size = num(b.size, 220);
  if (num(b.w, 0) > 0) { const tw = widthAt(size); if (tw > b.w) size = Math.floor((size * b.w) / tw); }
  const style = styleAt(size);
  const mw = (s) => ctx.measure.measure(s, style).width;
  const dw = Math.max(...'0123456789'.split('').map(mw)) * num(b.tracking, 1.02);
  const commaW = mw(',') * 1.0;
  const rowH = size * num(b.lineBox, 1.08);
  const at = num(b.at, 0.3), dur = num(b.dur, 1.6), ease = b.ease ?? 'power3.out';
  const P = ctx.pal;
  const pre = pre0, suf = suf0;
  const affix = (s, key) => ({ s, w: s ? mw(s) + size * 0.06 : 0, key });
  const A = affix(pre, 'pre'), Z = affix(suf, 'suf');

  const g = { id, type: 'group', ...groupProps(b, ctx), children: [] };
  let cx = A.w;
  if (pre) {
    g.children.push({ id: `${id}-pre`, type: 'text', text: pre, ...style, fill: H.fillOf(b.prefixFill ?? b.fill ?? 'ink', P), x: 0, y: 0, lineHeight: 1 });
  }
  let di = 0;
  [...toStr].forEach((ch, ci) => {
    if (!/\d/.test(ch)) {
      g.children.push({ id: `${id}-s${ci}`, type: 'text', text: ch, ...style, fill: H.fillOf(b.fill ?? 'ink', P), x: cx, y: 0, lineHeight: 1 });
      cx += commaW; return;
    }
    const end = Number(ch), start = fromDigits[di];
    const spins = Math.min(3, di);                       // lower digits spin more
    const travel = (((end - start) % 10) + 10) % 10 + 10 * (from === to ? 0 : spins);
    const cdur = dur * (0.6 + 0.4 * (di / Math.max(1, nDig - 1)));
    const col = { id: `${id}-c${di}`, type: 'group', x: cx, y: -rowH * 0.04, clip: { x: 0, y: 0, width: dw, height: rowH * 1.04 }, children: [] };
    const stack = { id: `${id}-k${di}`, type: 'group', x: 0, y: travel === 0 ? 0 : bakeF((t) => -rowH * travel * prog(t, at, cdur, ease), ctx), children: [] };
    for (let j = 0; j <= travel; j += 1) {
      stack.children.push({
        id: `${id}-d${di}-${j}`, type: 'text', text: String((start + j) % 10), ...style,
        fill: H.fillOf(b.fill ?? 'ink', P), x: 0, y: j * rowH + rowH * 0.04, maxWidth: dw, textAlign: 'center', lineHeight: 1,
      });
    }
    col.children.push(stack);
    g.children.push(col);
    cx += dw; di += 1;
  });
  if (suf) {
    g.children.push({
      id: `${id}-suf`, type: 'text', text: suf, ...style, fontSize: num(b.suffixSize, size),
      fill: H.fillOf(b.suffixFill ?? b.fill ?? 'accent', P), x: cx + size * 0.06, y: num(b.suffixDy, 0), lineHeight: 1,
    });
  }
  return [g];
};

// ---------------------------------------------------------------- beforeAfter
// One window, a divider sweeps, the second image is revealed under it.
// Use for: before/after, old vs new, problem vs fix. One image may be used for
// both sides if "beforeLook" / "afterLook" differ.
const beforeAfter = (b, ctx, H, id) => {
  const w = num(b.w, 900), h = num(b.h, 1100);
  const before = b.before ?? b.src, after = b.after ?? b.src;
  if (!before || !after) throw new Error('beforeAfter: needs "before" and "after" (or "src") asset ids');
  const axis = b.axis === 'v' ? 'v' : 'h';
  const at = num(b.at, 0.6), dur = num(b.dur, 1.4), ease = b.ease ?? 'power2.inOut';
  const hold = num(b.hold, 0);                                 // seconds the divider rests at the start
  const P = ctx.pal;
  const p = (t) => prog(t, at + hold, dur, ease);
  const look = (o) => (o && Object.keys(o).length ? { filter: { ...(o.grayscale ? { grayscale: o.grayscale } : {}), ...(o.contrast ? { contrast: o.contrast } : {}), ...(o.brightness ? { brightness: o.brightness } : {}) } } : {});
  const img = (src, k, o) => ({ id: `${id}-${k}`, type: 'image', src, width: w, height: h, fit: 'cover', ...look(o) });

  const g = { id, type: 'group', ...groupProps(b, ctx), clip: { x: 0, y: 0, width: w, height: h, radius: num(b.radius, 24) }, children: [] };
  g.children.push(img(before, 'b', b.beforeLook ?? { grayscale: 1, contrast: 1.05, brightness: 0.8 }));
  const R = { id: `${id}-rv`, type: 'group', x: 0, y: 0, clip: { x: 0, y: 0, width: w, height: h }, children: [] };
  const A = img(after, 'a', b.afterLook ?? {});
  if (axis === 'h') { R.x = bakeF((t) => p(t) * w - w, ctx); A.x = bakeF((t) => w - p(t) * w, ctx); }
  else { R.y = bakeF((t) => p(t) * h - h, ctx); A.y = bakeF((t) => h - p(t) * h, ctx); }
  R.children.push(A);
  g.children.push(R);
  const line = axis === 'h'
    ? { id: `${id}-ln`, type: 'rect', width: 6, height: h, y: 0, x: bakeF((t) => p(t) * w - 3, ctx) }
    : { id: `${id}-ln`, type: 'rect', width: w, height: 6, x: 0, y: bakeF((t) => p(t) * h - 3, ctx) };
  line.fill = H.fillOf(b.lineFill ?? 'ink', P);
  line.opacity = bakeF((t) => (p(t) <= 0.001 || p(t) >= 0.999 ? 0 : 1), ctx);
  g.children.push(line);
  const knob = { id: `${id}-kn`, type: 'circle', radius: num(b.knob, 34), fill: H.fillOf(b.lineFill ?? 'ink', P),
    x: axis === 'h' ? bakeF((t) => p(t) * w, ctx) : w / 2, y: axis === 'h' ? h / 2 : bakeF((t) => p(t) * h, ctx),
    opacity: bakeF((t) => (p(t) <= 0.001 || p(t) >= 0.999 ? 0 : 1), ctx) };
  g.children.push(knob);
  const labels = b.labels === false ? null : (b.labels ?? ['BEFORE', 'AFTER']);
  if (labels) {
    const chip = (txt, k, x, fillTok, opFn) => {
      const cw = Math.max(150, txt.length * 22 + 52);
      return { id: `${id}-chip${k}`, type: 'group', x, y: 36, opacity: bakeF(opFn, ctx), children: [
        { id: `${id}-chip${k}-r`, type: 'rrect', width: cw, height: 56, radius: 28, x: 0, y: 0, fill: H.fillOf(fillTok, P) },
        { id: `${id}-chip${k}-t`, type: 'text', text: txt, fontFamily: ctx.faces.mono, fontSize: 24, fontWeight: 700, letterSpacing: 4, fill: H.fillOf('bg', P), x: 0, y: 14, maxWidth: cw, textAlign: 'center' },
      ] };
    };
    g.children.push(chip(String(labels[0]).toUpperCase(), 'a', 36, 'ink', (t) => 1 - clamp01(p(t) * 3)));
    g.children.push(chip(String(labels[1]).toUpperCase(), 'b', w - 36 - Math.max(150, String(labels[1]).length * 22 + 52), 'accent', (t) => clamp01((p(t) - 0.55) * 3)));
  }
  return [g];
};

// ---------------------------------------------------------------- receipt
// Thermal receipt prints out of a slot in stutter steps, then stamps.
// Paper rises out of a slot at the bottom, header first.
// Use for: prices, savings, bills, "what it really costs", itemised proof.
const receipt = (b, ctx, H, id) => {
  const w = num(b.w, 560);
  const rows = Array.isArray(b.rows) ? b.rows : [];
  if (!rows.length) throw new Error('receipt: rows:[{label,value}] required');
  const rowH = num(b.rowH, 66), padX = 40, headH = b.title === false ? 40 : 130;
  const totalH = b.total ? 150 : 40;
  const paperH = headH + rows.length * rowH + totalH + 36;
  const at = num(b.at, 0.3), dur = num(b.dur, 0.9 + rows.length * 0.28);
  const nSteps = rows.length + 2;
  const stepped = (u) => { const s = u * nSteps, k = Math.floor(Math.min(s, nSteps - 1e-6)), f = s - k; return Math.min(1, (k + easeFn('power2.out')(clamp01(f * 2.4))) / nSteps); };
  const P = ctx.pal;
  const ink = b.ink ?? 'bg';
  const g = { id, type: 'group', ...groupProps(b, ctx), children: [] };
  const win = { id: `${id}-win`, type: 'group', x: 0, y: 0, clip: { x: -30, y: 0, width: w + 60, height: paperH }, children: [] };
  const paper = { id: `${id}-p`, type: 'group', x: 0, y: bakeF((t) => paperH * (1 - stepped(clamp01((t - at) / dur))), ctx), children: [] };
  paper.children.push({ id: `${id}-pr`, type: 'rect', width: w, height: paperH, x: 0, y: 0, fill: H.fillOf(b.paper ?? 'paper', P), shadow: { color: 'rgba(0,0,0,0.3)', blur: 30, offsetX: 0, offsetY: 16 } });
  if (b.title !== false) {
    paper.children.push({ id: `${id}-tt`, type: 'text', text: String(b.title ?? 'RECEIPT').toUpperCase(), fontFamily: ctx.faces.mono, fontSize: 34, fontWeight: 700, letterSpacing: 6, fill: H.fillOf(ink, P), x: 0, y: 36, maxWidth: w, textAlign: 'center' });
    if (b.sub) paper.children.push({ id: `${id}-st`, type: 'text', text: String(b.sub), fontFamily: ctx.faces.mono, fontSize: 20, fill: H.fillOf(b.ink ?? 'bg', P), opacity: 0.62, x: 0, y: 84, maxWidth: w, textAlign: 'center' });
  }
  rows.forEach((r, i) => {
    const y = headH + i * rowH;
    paper.children.push({ id: `${id}-l${i}`, type: 'text', text: String(r.label ?? ''), fontFamily: ctx.faces.mono, fontSize: num(b.size, 28), fontWeight: 500, fill: H.fillOf(ink, P), x: padX, y, maxWidth: w * 0.6, textAlign: 'left' });
    paper.children.push({ id: `${id}-v${i}`, type: 'text', text: String(r.value ?? ''), fontFamily: ctx.faces.mono, fontSize: num(b.size, 28), fontWeight: 700, fill: H.fillOf(r.hot ? 'accent' : ink, P), x: 0, y, maxWidth: w - padX, textAlign: 'right' });
    paper.children.push({ id: `${id}-r${i}`, type: 'rect', width: w - padX * 2, height: 2, x: padX, y: y + rowH - 16, fill: H.fillOf('rgba(0,0,0,0.18)', P) });
  });
  const ty = headH + rows.length * rowH + 14;
  if (b.total) {
    paper.children.push({ id: `${id}-tr`, type: 'rect', width: w - padX * 2, height: 4, x: padX, y: ty, fill: H.fillOf(ink, P) });
    paper.children.push({ id: `${id}-tl`, type: 'text', text: String(b.total.label ?? 'TOTAL').toUpperCase(), fontFamily: ctx.faces.mono, fontSize: 34, fontWeight: 800, fill: H.fillOf(ink, P), x: padX, y: ty + 28, maxWidth: w * 0.5 });
    paper.children.push({ id: `${id}-tv`, type: 'text', text: String(b.total.value ?? ''), fontFamily: ctx.faces.display, fontSize: 64, fontWeight: 800, fill: H.fillOf(b.total.fill ?? 'accent', P), x: 0, y: ty + 12, maxWidth: w - padX, textAlign: 'right' });
  }
  const n = Math.floor(w / 22);
  for (let i = 0; i <= n; i += 1) {
    paper.children.push({ id: `${id}-z${i}`, type: 'rect', width: 15, height: 15, x: (i * w) / n - 7, y: paperH - 8, rotation: 45, anchorX: 7.5, anchorY: 7.5, fill: H.fillOf(b.edge ?? 'bg', P) });
  }
  win.children.push(paper);
  g.children.push(win);
  g.children.push({ id: `${id}-slot`, type: 'rrect', width: w + 60, height: 30, radius: 15, x: -30, y: paperH - 6, fill: H.fillOf('rgba(10,10,12,0.92)', P) });
  if (b.stamp) {
    const sw = Math.max(200, String(b.stamp).length * 34 + 56), sAt = at + dur + 0.1;
    g.children.push({ id: `${id}-stamp`, type: 'group', x: w * 0.1, y: paperH - 96, rotation: -7, anchorX: sw / 2, anchorY: 45,
      scaleX: bakeF((t) => lerp(2.4, 1, prog(t, sAt, 0.28, 'back.out')), ctx), scaleY: bakeF((t) => lerp(2.4, 1, prog(t, sAt, 0.28, 'back.out')), ctx),
      opacity: bakeF((t) => clamp01((t - sAt) / 0.08) * 0.92, ctx), children: [
        { id: `${id}-sr`, type: 'rrect', width: sw, height: 78, radius: 10, x: 0, y: 0, fill: 'rgba(0,0,0,0)', stroke: H.color(b.stampColor ?? 'accent', P), strokeWidth: 7 },
        { id: `${id}-stx`, type: 'text', text: String(b.stamp).toUpperCase(), fontFamily: ctx.faces.display, fontSize: 48, fontWeight: 800, letterSpacing: 3, fill: H.fillOf(b.stampColor ?? 'accent', P), x: 0, y: 14, maxWidth: sw, textAlign: 'center' },
      ] });
  }
  return [g];
};

// ---------------------------------------------------------------- photoCam
// A virtual camera over ONE photo. waypoints -> several distinct shots.
// Use for: turning 1-3 photos into 6-10 shots (wide, detail, detail).
const photoCam = (b, ctx, H, id) => {
  const w = num(b.w, 1080), h = num(b.h, 1920);
  const src = needStr(b, 'src');
  const shots = Array.isArray(b.shots) && b.shots.length ? b.shots : [{ fx: 0.5, fy: 0.5, zoom: 1, at: 0 }];
  const norm = shots.map((s, i) => ({ fx: num(s.fx, 0.5), fy: num(s.fy, 0.5), zoom: Math.max(1, num(s.zoom, 1)), at: i === 0 ? 0 : num(s.at, i * 1.2), dur: num(s.dur, 0.9), ease: s.ease ?? 'power3.inOut' }));
  for (let i = 1; i < norm.length; i += 1) if (norm[i].at < norm[i - 1].at) throw new Error('photoCam: shots must be in time order');
  const pose = (t) => {
    let a = norm[0], bb = norm[0], u = 0;
    for (let i = 1; i < norm.length; i += 1) {
      if (t >= norm[i].at) { a = norm[i - 1]; bb = norm[i]; u = prog(t, norm[i].at, norm[i].dur, norm[i].ease); }
      else if (i === 1) { a = bb = norm[0]; }
    }
    if (t >= norm[norm.length - 1].at) { a = norm.length > 1 ? norm[norm.length - 2] : norm[0]; bb = norm[norm.length - 1]; u = prog(t, bb.at, bb.dur, bb.ease); }
    const s = lerp(a.zoom, bb.zoom, u), fx = lerp(a.fx, bb.fx, u), fy = lerp(a.fy, bb.fy, u);
    const lim = (k) => ((s - 1) * k) / 2;
    const tx = Math.max(-lim(w), Math.min(lim(w), -s * (fx * w - w / 2)));
    const ty = Math.max(-lim(h), Math.min(lim(h), -s * (fy * h - h / 2)));
    return { s, tx, ty };
  };
  const shake = num(b.shake, 0);
  const sk = (t, ph) => shake * (Math.sin(t * 2.3 + ph) * 0.6 + Math.sin(t * 5.1 + ph * 2) * 0.4);
  const P = ctx.pal;
  const g = { id, type: 'group', ...groupProps(b, ctx), clip: { x: 0, y: 0, width: w, height: h, ...(b.radius ? { radius: b.radius } : {}) }, children: [] };
  const img = { id: `${id}-img`, type: 'image', src, width: w, height: h, fit: 'cover', ...ID.anchor(w, h),
    x: bakeF((t) => pose(t).tx + sk(t, 0), ctx), y: bakeF((t) => pose(t).ty + sk(t, 1.7), ctx),
    scaleX: bakeF((t) => pose(t).s * (shake ? 1.012 : 1), ctx), scaleY: bakeF((t) => pose(t).s * (shake ? 1.012 : 1), ctx) };
  const filter = {};
  if (b.grayscale) filter.grayscale = b.grayscale;
  if (b.contrast) filter.contrast = b.contrast;
  if (b.brightness) filter.brightness = b.brightness;
  if (Object.keys(filter).length) img.filter = filter;
  g.children.push(img);
  if (b.tint) g.children.push({ id: `${id}-tint`, type: 'rect', width: w, height: h, x: 0, y: 0, fill: H.color(b.tint.color ?? 'accent', P), opacity: num(b.tint.opacity, 0.18), blendMode: b.tint.blend ?? 'multiply' });
  if (b.vignette) g.children.push({ id: `${id}-vg`, type: 'rect', width: w, height: h, x: 0, y: 0, opacity: num(b.vignette, 0.5),
    fill: { kind: 'radial', from: { x: w / 2, y: h / 2, r: 0 }, to: { x: w / 2, y: h / 2, r: Math.hypot(w, h) / 2 }, stops: [{ offset: 0.55, color: 'rgba(0,0,0,0)' }, { offset: 1, color: 'rgba(0,0,0,1)' }] } });
  (b.callouts ?? []).forEach((c, i) => {
    const cAt = num(c.at, 1), r = num(c.r, 70), cx = num(c.x, 0.5) * w, cy = num(c.y, 0.5) * h;
    const pop = (t) => prog(t, cAt, 0.4, 'back.out');
    const cg = { id: `${id}-co${i}`, type: 'group', x: cx, y: cy, opacity: bakeF((t) => clamp01((t - cAt) / 0.12), ctx), children: [
      { id: `${id}-co${i}-r`, type: 'rrect', width: r * 2, height: r * 2, radius: r, x: -r, y: -r, fill: 'rgba(0,0,0,0)', stroke: H.color(c.color ?? 'accent', P), strokeWidth: 6,
        anchorX: r, anchorY: r, scaleX: bakeF((t) => pop(t), ctx), scaleY: bakeF((t) => pop(t), ctx) },
    ] };
    if (c.label) {
      const lw = Math.max(200, String(c.label).length * 24 + 60);
      cg.children.push({ id: `${id}-co${i}-b`, type: 'rrect', width: lw, height: 64, radius: 12, x: -lw / 2, y: r + 18, fill: H.fillOf(c.color ?? 'accent', P) });
      cg.children.push({ id: `${id}-co${i}-t`, type: 'text', text: String(c.label).toUpperCase(), fontFamily: ctx.faces.mono, fontSize: 26, fontWeight: 700, letterSpacing: 3, fill: H.fillOf('bg', P), x: -lw / 2, y: r + 18 + 17, maxWidth: lw, textAlign: 'center' });
    }
    g.children.push(cg);
  });
  return [g];
};

// ---------------------------------------------------------------- cardStack
// Cards drop in; older ones sink back (depth stack).
// Use for: lists, features, steps, "3 reasons", testimonials.
const cardStack = (b, ctx, H, id) => {
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) throw new Error('cardStack: items:[{title,sub}] required');
  const w = num(b.w, 880), h = num(b.h, 360);
  const at = num(b.at, 0.3), step = num(b.step, 0.55), lift = num(b.lift, 190), shrink = num(b.shrink, 0.04);
  const from = b.from === 'right' ? 'right' : 'below';
  const P = ctx.pal;
  const g = { id, type: 'group', ...groupProps(b, ctx), children: [] };
  items.forEach((it, i) => {
    const t0 = at + i * step;
    const enter = (t) => prog(t, t0, 0.55, 'back.out');
    const depth = (t) => { let d = 0; for (let j = i + 1; j < items.length; j += 1) d += prog(t, at + j * step, 0.5, 'power3.out'); return d; };
    const tilt = (i % 2 ? 1 : -1) * num(b.tilt, 1.2);
    const cg = { id: `${id}-c${i}`, type: 'group', ...ID.anchor(w, h),
      x: bakeF((t) => (from === 'right' ? lerp(w * 1.3, 0, enter(t)) : 0), ctx),
      y: bakeF((t) => (from === 'below' ? lerp(h * 2.2, 0, enter(t)) : 0) - depth(t) * lift, ctx),
      scaleX: bakeF((t) => 1 - depth(t) * shrink, ctx), scaleY: bakeF((t) => 1 - depth(t) * shrink, ctx),
      rotation: bakeF((t) => tilt * (1 - enter(t)) + tilt * 0.4 * depth(t), ctx),
      opacity: bakeF((t) => clamp01((t - t0) / 0.1) * (1 - clamp01((depth(t) - 2.2) / 1.2)), ctx),
      children: [] };
    const fill = it.fill ?? (i === items.length - 1 ? 'accent' : 'paper');
    const onAccent = fill === 'accent' || fill === 'accent2';
    const ink = it.ink ?? (onAccent || fill === 'paper' ? 'bg' : 'ink');
    cg.children.push({ id: `${id}-c${i}-r`, type: 'rrect', width: w, height: h, radius: num(b.radius, 36), x: 0, y: 0, fill: H.fillOf(fill, P), shadow: { color: 'rgba(0,0,0,0.38)', blur: 36, offsetX: 0, offsetY: 18 } });
    cg.children.push({ id: `${id}-c${i}-n`, type: 'text', text: String(i + 1).padStart(2, '0'), fontFamily: ctx.faces.mono, fontSize: 30, fontWeight: 700, fill: H.fillOf(ink, P), opacity: 0.55, x: 44, y: 38 });
    cg.children.push({ id: `${id}-c${i}-t`, type: 'text', text: String(it.title ?? ''), fontFamily: ctx.faces.display, fontSize: num(b.titleSize, 86), fontWeight: 800, lineHeight: 1.02, fill: H.fillOf(ink, P), x: 44, y: 96, maxWidth: w - 88 });
    if (it.sub) cg.children.push({ id: `${id}-c${i}-s`, type: 'text', text: String(it.sub), fontFamily: ctx.faces.body, fontSize: num(b.subSize, 34), lineHeight: 1.25, fill: H.fillOf(ink, P), opacity: 0.78, x: 44, y: h - 104, maxWidth: w - 88 });
    g.children.push(cg);
  });
  return [g];
};

// ---------------------------------------------------------------- track
// One persistent element that moves between poses across the whole reel.
// Put it in a LONG layer. This is the shared-element / morph primitive.
const track = (b, ctx, H, id) => {
  if (!b.child || typeof b.child !== 'object') throw new Error('track: "child" block required');
  const poses = (Array.isArray(b.poses) ? b.poses : []).map((p, i) => ({ at: num(p.at, i), x: num(p.x, 0), y: num(p.y, 0), scale: num(p.scale, 1), rotation: num(p.rotation, 0), opacity: num(p.opacity, 1), blur: num(p.blur, 0), ease: p.ease ?? 'power3.inOut', dur: p.dur }));
  if (poses.length < 2) throw new Error('track: needs >= 2 poses');
  poses.sort((a, c) => a.at - c.at);
  const at = (t) => {
    if (t <= poses[0].at) return poses[0];
    for (let i = 1; i < poses.length; i += 1) {
      const a = poses[i - 1], c = poses[i];
      if (t <= c.at) {
        const mdur = num(c.dur, c.at - a.at);             // move duration, ends exactly at c.at
        const u = easeFn(c.ease)(clamp01((t - (c.at - mdur)) / Math.max(0.001, mdur)));
        return { x: lerp(a.x, c.x, u), y: lerp(a.y, c.y, u), scale: lerp(a.scale, c.scale, u), rotation: lerp(a.rotation, c.rotation, u), opacity: lerp(a.opacity, c.opacity, u), blur: lerp(a.blur, c.blur, u) };
      }
    }
    return poses[poses.length - 1];
  };
  const g = { id, type: 'group',
    x: bakeF((t) => at(t).x, ctx), y: bakeF((t) => at(t).y, ctx), rotation: bakeF((t) => at(t).rotation, ctx),
    scaleX: bakeF((t) => at(t).scale, ctx), scaleY: bakeF((t) => at(t).scale, ctx),
    opacity: bakeF((t) => at(t).opacity, ctx), blur: bakeF((t) => at(t).blur, ctx),
    children: H.compile([b.child], ctx, id) };
  for (const k of ['x', 'y', 'rotation', 'opacity', 'blur']) if (g[k] === 0 || g[k] === 1 && k === 'opacity') delete g[k];
  if (g.scaleX === 1) { delete g.scaleX; delete g.scaleY; }
  if (b.anchor) { g.anchorX = num(b.anchor.x, 0); g.anchorY = num(b.anchor.y, 0); }
  return [g];
};

const TABLE = { calendarFlip, counterRoll, beforeAfter, receipt, photoCam, cardStack, track };

export const compileMechanic = (b, ctx, helpers) => {
  const fn = TABLE[b.type];
  if (!fn) throw new Error(`Unknown mechanic "${b.type}" (id ${ctx.uid})`);
  return fn(b, ctx, helpers, ctx.uid);
};

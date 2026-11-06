import { bake } from './motion.mjs';

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u * u * (3 - 2 * u);
const prog = (t, at, dur) => smooth(clamp01((t - at) / Math.max(0.001, dur)));
const B = (ctx, fn, step) => bake(fn, ctx, { step });

export const EXPLAIN_KINDS = ['flight', 'spiral', 'zoom', 'map', 'growth', 'compare', 'process', 'orbit', 'timeline'];

const group = (id, x, y, children, extra = {}) => ({ id, type: 'group', x, y, children, ...extra });
const rect = (id, x, y, w, h, fill, extra = {}) => ({ id, type: 'rect', x, y, width: w, height: h, fill, ...extra });
const rrect = (id, x, y, w, h, r, fill, extra = {}) => ({ id, type: 'rrect', x, y, width: w, height: h, radius: r, fill, ...extra });
const circle = (id, x, y, r, fill, extra = {}) => ({ id, type: 'circle', x, y, radius: r, fill, ...extra });
const label = (id, text, x, y, w, size, H, ctx, fill = 'ink', extra = {}) => ({
  id, type: 'text', text: String(text ?? ''), x, y, maxWidth: w,
  fontFamily: extra.face ?? ctx.faces.mono, fontSize: size, fontWeight: extra.weight ?? 700,
  letterSpacing: extra.ls ?? 1.6, lineHeight: extra.lh ?? 1.1, textAlign: extra.align ?? 'left',
  fill: H.fillOf(fill, ctx.pal), opacity: num(extra.opacity, 1), ...(extra.bake ?? {}),
});

const arrow = (id, x1, y1, x2, y2, H, ctx, fill = 'accent') => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ang = Math.atan2(dy, dx);
  const col = H.color(fill, ctx.pal);
  const head = 16;
  return group(id, x1, y1, [
    rect(`${id}-s`, 0, -2, Math.max(4, len - head), 4, col, { anchorX: 0, anchorY: 2 }),
    group(`${id}-h`, len - head, 0, [
      rect(`${id}-h1`, 0, -2, head, 4, col, { rotation: -28, anchorX: 0, anchorY: 2 }),
      rect(`${id}-h2`, 0, -2, head, 4, col, { rotation: 28, anchorX: 0, anchorY: 2 }),
    ]),
  ], { rotation: (ang * 180) / Math.PI });
};

const flight = (b, ctx, H, id) => {
  const w = num(b.w, ctx.CW);
  const h = num(b.h, ctx.H * 0.3);
  const at = num(b.at, 0.2);
  const dur = num(b.dur, 1.9);
  const A = { x: w * 0.08, y: h * 0.82 };
  const C = { x: w * 0.52, y: -h * 0.22 };
  const Z = { x: w * 0.92, y: h * 0.24 };
  const pos = (u) => ({
    x: (1 - u) * (1 - u) * A.x + 2 * (1 - u) * u * C.x + u * u * Z.x,
    y: (1 - u) * (1 - u) * A.y + 2 * (1 - u) * u * C.y + u * u * Z.y,
  });
  const nodes = [];
  const N = 26;
  for (let i = 0; i <= N; i += 1) {
    const p = pos(i / N);
    nodes.push(circle(`${id}-d${i}`, p.x, p.y, i % 4 === 0 ? 3 : 2, H.color('ink', ctx.pal), { opacity: 0.22 }));
  }
  const plane = group(`${id}-p`, 0, 0, [
    rrect(`${id}-f`, 0, -6, 68, 12, 6, H.color('ink', ctx.pal)),
    rrect(`${id}-w`, 22, -20, 12, 40, 5, H.color('accent', ctx.pal)),
    rrect(`${id}-t`, 50, -12, 10, 24, 4, H.color('accent', ctx.pal)),
    circle(`${id}-n`, 64, -1, 4, H.color('bg', ctx.pal)),
  ], {
    x: B(ctx, (t) => pos(prog(t, at, dur)).x), y: B(ctx, (t) => pos(prog(t, at, dur)).y),
    rotation: B(ctx, (t) => {
      const u = prog(t, at, dur);
      const a = pos(Math.max(0, u - 0.02));
      const c = pos(Math.min(1, u + 0.02));
      return (Math.atan2(c.y - a.y, c.x - a.x) * 180) / Math.PI;
    }),
    opacity: B(ctx, (t) => (t < at ? 0 : 1)),
  });
  nodes.push(plane);
  if (b.from) nodes.push(label(`${id}-a`, b.from, A.x - 4, A.y + 14, w * 0.34, 16, H, ctx, 'muted', { ls: 2, bake: { opacity: B(ctx, (t) => (prog(t, at, dur) > 0.06 ? 1 : 0)) } }));
  if (b.to) nodes.push(label(`${id}-b`, b.to, Z.x - w * 0.28, Z.y - 32, w * 0.3, 16, H, ctx, 'accent', { ls: 2, align: 'right', bake: { opacity: B(ctx, (t) => (prog(t, at, dur) > 0.45 ? 1 : 0)) } }));
  return nodes;
};

const spiral = (b, ctx, H, id) => {
  const w = num(b.w, ctx.CW);
  const h = num(b.h, ctx.H * 0.32);
  const at = num(b.at, 0.15);
  const dur = num(b.dur, 2);
  const maxR = Math.min(w, h) * 0.46;
  const N = num(b.turns, 64);
  const nodes = [];
  for (let i = 0; i < N; i += 1) {
    const u = i / (N - 1);
    const r = maxR * (1 - u) * 0.96 + 6;
    const a = u * Math.PI * 5.4;
    nodes.push(circle(`${id}-s${i}`, w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, lerp(5, 1.6, u), H.color(u < 0.55 ? 'accent' : 'ink', ctx.pal), {
      opacity: B(ctx, (t) => (t >= at + u * dur * 0.7 ? (0.35 + 0.55 * (1 - u)) : 0)),
    }));
  }
  nodes.push(group(`${id}-g`, 0, 0, [
    { id: `${id}-c`, type: 'circle', x: w / 2, y: h / 2, radius: Math.min(w, h) * 0.16, fill: H.color('bg', ctx.pal), stroke: H.color('accent', ctx.pal), strokeWidth: 2 },
    label(`${id}-t`, b.label ?? 'WHY', w / 2 - w * 0.16, h / 2 - 12, w * 0.32, 22, H, ctx, 'ink', { align: 'center', ls: 1.4 }),
  ]));
  return [group(`${id}-all`, 0, 0, nodes, {
    rotation: B(ctx, (t) => 12 * prog(t, at, dur)),
    scaleX: B(ctx, (t) => lerp(1.08, 0.94, prog(t, at, dur))),
    scaleY: B(ctx, (t) => lerp(1.08, 0.94, prog(t, at, dur))),
    anchorX: w / 2, anchorY: h / 2,
  })];
};

const zoom = (b, ctx, H, id) => {
  const w = num(b.w, ctx.CW);
  const h = num(b.h, ctx.H * 0.3);
  const at = num(b.at, 0.15);
  const dur = num(b.dur, 1.6);
  const nodes = [];
  for (let i = 0; i < 5; i += 1) {
    const k = i / 4;
    nodes.push(group(`${id}-r${i}`, w / 2, h / 2, [
      rrect(`${id}-rb${i}`, -w * 0.36, -h * 0.36, w * 0.72, h * 0.72, 10, 'rgba(0,0,0,0)', {
        stroke: H.color(i === 4 ? 'accent' : 'ink', ctx.pal), strokeWidth: i === 4 ? 3 : 1.4,
      }),
    ], {
      scaleX: B(ctx, (t) => { const u = ((t - at) / dur + k) % 1; return lerp(1.8, 0.24, u < 0 ? 0 : u); }),
      scaleY: B(ctx, (t) => { const u = ((t - at) / dur + k) % 1; return lerp(1.8, 0.24, u < 0 ? 0 : u); }),
      opacity: B(ctx, (t) => { const u = ((t - at) / dur + k) % 1; return t < at ? 0 : clamp01(1 - u) * 0.8; }),
    }));
  }
  nodes.push(label(`${id}-t`, b.label ?? 'GO IN', w * 0.18, h / 2 - 18, w * 0.64, 26, H, ctx, 'ink', { align: 'center', ls: 2 }));
  return nodes;
};

const mapScene = (b, ctx, H, id) => {
  const w = num(b.w, ctx.CW);
  const h = num(b.h, ctx.H * 0.3);
  const at = num(b.at, 0.2);
  const nodes = [];
  for (let i = 1; i < 6; i += 1) nodes.push(rect(`${id}-v${i}`, (w / 6) * i, 0, 1, h, H.color('ink', ctx.pal), { opacity: 0.08 }));
  for (let i = 1; i < 4; i += 1) nodes.push(rect(`${id}-h${i}`, 0, (h / 4) * i, w, 1, H.color('ink', ctx.pal), { opacity: 0.08 }));
  const A = { x: w * 0.16, y: h * 0.74 };
  const Z = { x: w * 0.8, y: h * 0.3 };
  for (let i = 0; i <= 20; i += 1) {
    const u = i / 20;
    nodes.push(circle(`${id}-r${i}`, lerp(A.x, Z.x, u), lerp(A.y, Z.y, u), 2, H.color('accent', ctx.pal), {
      opacity: B(ctx, (t) => (prog(t, at, 1.1) > u ? 0.7 : 0)),
    }));
  }
  const pin = group(`${id}-pin`, Z.x, Z.y, [
    circle(`${id}-pc`, 0, 0, 12, H.color('accent', ctx.pal)),
    { id: `${id}-pt`, type: 'rect', x: -7, y: 6, width: 14, height: 14, fill: H.color('accent', ctx.pal), rotation: 45, anchorX: 7, anchorY: 7 },
  ], {
    opacity: B(ctx, (t) => (t > at + 1 ? 1 : 0)),
    scaleX: B(ctx, (t) => (t > at + 1 ? 1 + 0.18 * Math.sin(Math.PI * clamp01((t - at - 1) / 0.35)) : 0.2)),
    scaleY: B(ctx, (t) => (t > at + 1 ? 1 + 0.18 * Math.sin(Math.PI * clamp01((t - at - 1) / 0.35)) : 0.2)),
  });
  nodes.push(pin);
  if (b.from) nodes.push(label(`${id}-a`, b.from, A.x - 6, A.y + 18, w * 0.3, 15, H, ctx, 'muted', { ls: 1.8 }));
  if (b.to) nodes.push(label(`${id}-b`, b.to, Z.x - w * 0.24, Z.y - 42, w * 0.26, 15, H, ctx, 'accent', { ls: 1.8, align: 'right' }));
  return nodes;
};

const growth = (b, ctx, H, id) => {
  const w = num(b.w, ctx.CW);
  const h = num(b.h, ctx.H * 0.3);
  const at = num(b.at, 0.2);
  const dur = num(b.dur, 1.8);
  const nodes = [
    rect(`${id}-x`, 0, h - 2, w, 2, H.color('ink', ctx.pal), { opacity: 0.35 }),
    rect(`${id}-y`, 0, 0, 2, h, H.color('ink', ctx.pal), { opacity: 0.35 }),
  ];
  const N = 24;
  for (let i = 0; i < N; i += 1) {
    const u = i / (N - 1);
    const x = u * w * 0.94;
    const y = h * (0.94 - 0.84 * Math.pow(u, 1.7));
    nodes.push(circle(`${id}-g${i}`, x, y, i === N - 1 ? 6 : 3.4, H.color(i > N * 0.7 ? 'accent' : 'ink', ctx.pal), {
      opacity: B(ctx, (t) => (t >= at + u * dur * 0.8 ? 1 : 0)),
    }));
  }
  if (b.value) nodes.push(label(`${id}-v`, b.value, w * 0.58, h * 0.02, w * 0.42, 40, H, ctx, 'accent', { align: 'right', face: ctx.faces.display }));
  if (b.label) nodes.push(label(`${id}-l`, b.label, 0, h - 26, w * 0.7, 14, H, ctx, 'muted', { ls: 1.8 }));
  return nodes;
};

const compare = (b, ctx, H, id) => {
  const w = num(b.w, ctx.CW);
  const h = num(b.h, ctx.H * 0.3);
  const at = num(b.at, 0.2);
  const baseY = h - 20;
  const cols = [
    { x: w * 0.12, w: w * 0.3, hh: h * 0.42, fill: 'ink', text: b.left ?? 'BEFORE' },
    { x: w * 0.56, w: w * 0.3, hh: h * 0.84, fill: 'accent', text: b.right ?? 'AFTER' },
  ];
  const nodes = [rect(`${id}-base`, 0, baseY, w, 2, H.color('ink', ctx.pal), { opacity: 0.3 })];
  cols.forEach((c, i) => {
    const g = group(`${id}-c${i}`, c.x, baseY, [
      rrect(`${id}-cr${i}`, 0, -c.hh, c.w, c.hh, 8, H.color(c.fill, ctx.pal)),
    ], {
      scaleY: B(ctx, (t) => prog(t, at + i * 0.12, 0.8)),
      anchorY: baseY,
      opacity: B(ctx, (t) => (t >= at + i * 0.12 ? 1 : 0)),
    });
    nodes.push(g);
    nodes.push(label(`${id}-t${i}`, c.text, c.x, baseY + 12, c.w, 14, H, ctx, 'muted', { ls: 1.8, align: i ? 'right' : 'left' }));
  });
  return nodes;
};

const process = (b, ctx, H, id) => {
  const w = num(b.w, ctx.CW);
  const h = num(b.h, ctx.H * 0.26);
  const at = num(b.at, 0.2);
  const items = Array.isArray(b.items) && b.items.length ? b.items.slice(0, 3) : ['ONE', 'TWO', 'THREE'];
  const nodes = [];
  items.forEach((t, i) => {
    const x = (w / (items.length + 1)) * (i + 1);
    const y = h / 2;
    nodes.push(circle(`${id}-n${i}`, x, y, 28, H.color(i === 0 ? 'ink' : 'bg', ctx.pal), {
      stroke: H.color(i === 0 ? 'ink' : 'accent', ctx.pal), strokeWidth: 2,
      opacity: B(ctx, (t0) => (t0 >= at + i * 0.25 ? 1 : 0)),
      scaleX: B(ctx, (t0) => lerp(0.4, 1, prog(t0, at + i * 0.25, 0.35))),
      scaleY: B(ctx, (t0) => lerp(0.4, 1, prog(t0, at + i * 0.25, 0.35))),
    }));
    nodes.push(label(`${id}-t${i}`, String(i + 1).padStart(2, '0'), x - 18, y - 12, 36, 18, H, ctx, i === 0 ? 'bg' : 'accent', { align: 'center', ls: 0 }));
    nodes.push(label(`${id}-l${i}`, String(t).toUpperCase(), x - w * 0.11, y + 40, w * 0.22, 14, H, ctx, 'ink', { align: 'center', ls: 1.6 }));
    if (i < items.length - 1) {
      const nx = (w / (items.length + 1)) * (i + 2);
      nodes.push(arrow(`${id}-a${i}`, x + 34, y, nx - 34, y, H, ctx, 'ink'));
    }
  });
  return nodes;
};

const orbit = (b, ctx, H, id) => {
  const w = num(b.w, ctx.CW);
  const h = num(b.h, ctx.H * 0.3);
  const nodes = [circle(`${id}-c`, w / 2, h / 2, 34, H.color('accent', ctx.pal))];
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2;
    nodes.push(circle(`${id}-o${i}`, w / 2 + Math.cos(a) * w * 0.34, h / 2 + Math.sin(a) * h * 0.34, 2, H.color('ink', ctx.pal), { opacity: 0.18 }));
  }
  for (let i = 0; i < 3; i += 1) {
    const phase = (i / 3) * Math.PI * 2;
    nodes.push(circle(`${id}-p${i}`, 0, 0, 7, H.color(i === 1 ? 'accent' : 'ink', ctx.pal), {
      x: B(ctx, (t) => w / 2 + Math.cos(phase + t * 0.9) * w * 0.34),
      y: B(ctx, (t) => h / 2 + Math.sin(phase + t * 0.9) * h * 0.34),
    }));
  }
  if (b.label) nodes.push(label(`${id}-l`, b.label, w * 0.3, h / 2 - 10, w * 0.4, 16, H, ctx, 'bg', { align: 'center', ls: 1.4 }));
  return nodes;
};

const timeline = (b, ctx, H, id) => {
  const w = num(b.w, ctx.CW);
  const h = num(b.h, ctx.H * 0.24);
  const at = num(b.at, 0.2);
  const years = Array.isArray(b.years) && b.years.length ? b.years.slice(0, 6) : ['1950', '1970', '1990', '2010', '2026'];
  const y = h * 0.58;
  const nodes = [rect(`${id}-ln`, 0, y, w, 2, H.color('ink', ctx.pal), { anchorX: 0, anchorY: 0, scaleX: B(ctx, (t) => prog(t, at, 1.1)), opacity: 0.5 })];
  years.forEach((yr, i) => {
    const x = (w / (years.length - 1)) * i;
    nodes.push(circle(`${id}-d${i}`, x, y, i === years.length - 1 ? 8 : 5, H.color(i === years.length - 1 ? 'accent' : 'ink', ctx.pal), {
      opacity: B(ctx, (t) => (t >= at + (i / years.length) * 1.1 ? 1 : 0)),
    }));
    nodes.push(label(`${id}-y${i}`, String(yr), x - w * 0.09, y + 18, w * 0.18, 16, H, ctx, i === years.length - 1 ? 'accent' : 'muted', { align: 'center', ls: 1.2 }));
  });
  return nodes;
};

const TABLE = { flight, spiral, zoom, map: mapScene, growth, compare, process, orbit, timeline };

export const compileExplain = (b, ctx, H) => {
  const fn = TABLE[b.kind];
  if (!fn) throw new Error(`Unknown explain kind "${b.kind}" (id ${ctx.uid})`);
  const id = ctx.uid;
  const x = num(b.x, 0);
  const y = num(b.y, 0);
  const w = num(b.w, ctx.CW);
  const nodes = fn({ ...b, w, h: num(b.h, ctx.H * 0.3) }, { ...ctx, CW: w, W: w }, H, id);
  return [group(`${id}-wrap`, x, y, nodes, { opacity: num(b.opacity, 1) })];
};

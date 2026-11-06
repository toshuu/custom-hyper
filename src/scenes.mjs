const rect = (x, y, w, h, fill, opacity = 1, radius = 0, extra = {}) => ({
  type: 'rrect', x, y, w, h, radius, fill, opacity, ...extra,
});
const circle = (cx, cy, r, fill, opacity = 1, blur = 0) => ({
  type: 'circle', x: cx - r, y: cy - r, r, fill, opacity, ...(blur ? { blur } : {}),
});
const line = (x, y, w, fill, opacity = 1, h = 4) => rect(x, y, w, h, fill, opacity, h / 2);

const tokensOf = (text) => String(text ?? '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length > 2);

const hasAny = (tokens, words) => words.some((w) => tokens.includes(w));

const zoneFor = (mode, W, H) => {
  if (mode === 'poster') return { cx: W * 0.72, cy: H * 0.64, s: 0.5 };
  if (mode === 'brutal') return { cx: W * 0.6, cy: H * 0.27, s: 0.52 };
  if (mode === 'split') return { cx: W * 0.73, cy: H * 0.64, s: 0.46 };
  if (mode === 'stack') return { cx: W * 0.73, cy: H * 0.7, s: 0.44 };
  if (mode === 'minimal') return { cx: W * 0.8, cy: H * 0.4, s: 0.38 };
  if (mode === 'quote') return { cx: W * 0.72, cy: H * 0.74, s: 0.4 };
  if (mode === 'cta') return { cx: W * 0.78, cy: H * 0.2, s: 0.3 };
  if (mode === 'rail') return { cx: W * 0.5, cy: H * 0.8, s: 0.36 };
  return { cx: W * 0.5, cy: H * 0.52, s: 0.5 };
};

const bill = ({ cx, cy, s }, p) => {
  const w = s * 0.7;
  const h = s * 1.15;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const rows = [];
  for (let i = 0; i < 6; i += 1) {
    rows.push(line(x + w * 0.12, y + h * (0.3 + i * 0.09), w * (i === 5 ? 0.4 : 0.64), 'ink', 0.32, 3));
  }
  return [
    rect(x, y, w, h, 'paper', 0.92, 6, { rotation: -4 }),
    line(x + w * 0.12, y + h * 0.16, w * 0.5, 'accent', 0.8, 6),
    ...rows,
    circle(x + w * 0.82, y + h * 0.82, s * 0.1, 'accent', 0.85),
    circle(x + w * 0.82, y + h * 0.82, s * 0.055, 'paper', 0.9),
  ];
};

const meter = ({ cx, cy, s }, p) => {
  const r = s * 0.42;
  const ticks = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    const tx = cx + Math.cos(a) * r * 0.82;
    const ty = cy + Math.sin(a) * r * 0.82;
    ticks.push(rect(tx - s * 0.006, ty - s * 0.03, s * 0.012, s * 0.06, 'ink', 0.45, s * 0.006, { rotation: (a * 180) / Math.PI + 90 }));
  }
  return [
    circle(cx, cy, r, 'paper', 0.94),
    circle(cx, cy, r * 0.76, 'bg', 0.85),
    ...ticks,
    rect(cx - s * 0.012, cy - r * 0.62, s * 0.024, r * 0.68, 'accent', 1, s * 0.012, { rotation: 28 }),
    circle(cx, cy, s * 0.045, 'ink', 0.9),
  ];
};

const sun = ({ cx, cy, s }, p) => {
  const r = s * 0.26;
  const rays = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    const d = r * 1.5;
    rays.push(rect(cx + Math.cos(a) * d - s * 0.01, cy + Math.sin(a) * d - s * 0.09, s * 0.02, s * 0.18, 'accent', 0.55, s * 0.01, { rotation: (a * 180) / Math.PI + 90 }));
  }
  return [circle(cx, cy, r, 'accent', 0.7), circle(cx, cy, r * 0.72, 'paper', 0.35), ...rays];
};

const panel = ({ cx, cy, s }, p) => {
  const w = s * 0.78;
  const h = s * 0.42;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const cells = [];
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      cells.push(rect(x + c * (w / 3) + w * 0.02, y + r * (h / 2) + h * 0.03, w / 3 - w * 0.04, h / 2 - h * 0.06, 'accent2', 0.35, 3, { stroke: 'ink', strokeWidth: 2, rotation: -8 }));
    }
  }
  return [
    rect(x - s * 0.05, y + h + s * 0.04, w + s * 0.1, s * 0.06, 'ink', 0.35, 4, { rotation: -8 }),
    ...cells,
    circle(cx + w * 0.45, cy - h * 0.45, s * 0.12, 'accent', 0.6),
  ];
};

const house = ({ cx, cy, s }, p) => {
  const w = s * 0.62;
  const h = s * 0.44;
  const x = cx - w / 2;
  const y = cy - h / 2 + s * 0.08;
  return [
    rect(x, y, w, h, 'paper', 0.8, 4),
    rect(x - s * 0.06, y - s * 0.08, w + s * 0.12, s * 0.1, 'accent', 0.8, 3, { rotation: -6 }),
    rect(x + w * 0.42, y + h * 0.3, w * 0.16, h * 0.7, 'ink', 0.55, 3),
    rect(x + w * 0.14, y + h * 0.24, w * 0.18, h * 0.24, 'accent2', 0.5, 2),
    circle(x + w * 0.82, y - s * 0.22, s * 0.1, 'accent', 0.5),
  ];
};

const person = ({ cx, cy, s }, p) => [
  circle(cx, cy - s * 0.37, s * 0.145, 'ink', 0.72),
  rect(cx - s * 0.14, cy - s * 0.225, s * 0.28, s * 0.34, 'ink', 0.6, s * 0.07),
  rect(cx - s * 0.105, cy + s * 0.095, s * 0.075, s * 0.24, 'ink', 0.58, s * 0.03, { rotation: 6 }),
  rect(cx + s * 0.03, cy + s * 0.095, s * 0.075, s * 0.24, 'ink', 0.58, s * 0.03, { rotation: -6 }),
  rect(cx - s * 0.245, cy - s * 0.12, s * 0.11, s * 0.055, 'ink', 0.55, s * 0.025, { rotation: 22 }),
  rect(cx + s * 0.135, cy - s * 0.12, s * 0.11, s * 0.055, 'ink', 0.55, s * 0.025, { rotation: -22 }),
];

const lamp = ({ cx, cy, s }, p) => [
  circle(cx, cy - s * 0.12, s * 0.18, 'accent', 0.65),
  rect(cx - s * 0.08, cy + s * 0.03, s * 0.16, s * 0.1, 'ink', 0.6, 3),
  rect(cx - s * 0.16, cy + s * 0.12, s * 0.32, s * 0.05, 'ink', 0.6, 2),
  circle(cx, cy - s * 0.12, s * 0.34, 'paper', 0.18, 24),
];

const chart = ({ cx, cy, s }, p) => {
  const bars = [0.28, 0.46, 0.62, 0.9];
  const base = cy + s * 0.3;
  const bw = s * 0.13;
  return bars.map((h, i) => rect(cx - s * 0.34 + i * bw * 1.5, base - s * h, bw, s * h, i === bars.length - 1 ? 'accent' : 'accent2', 0.55, 3));
};

const phone = ({ cx, cy, s }, p) => {
  const w = s * 0.42;
  const h = s * 0.78;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return [
    rect(x, y, w, h, 'ink', 0.75, s * 0.05),
    rect(x + w * 0.07, y + h * 0.07, w * 0.86, h * 0.86, 'paper', 0.85, s * 0.035),
    line(x + w * 0.18, y + h * 0.3, w * 0.5, 'accent', 0.8, 6),
    line(x + w * 0.18, y + h * 0.44, w * 0.64, 'ink', 0.3, 4),
    line(x + w * 0.18, y + h * 0.54, w * 0.54, 'ink', 0.3, 4),
  ];
};

const grid = ({ cx, cy, s }, p) => {
  const n = 4;
  const gap = s * 0.04;
  const cell = (s * 0.72 - gap * (n - 1)) / n;
  const x = cx - (cell * n + gap * (n - 1)) / 2;
  const y = cy - (cell * n + gap * (n - 1)) / 2;
  const out = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      out.push(rect(x + c * (cell + gap), y + r * (cell + gap), cell, cell, (r + c) % 3 === 0 ? 'accent' : 'ink', (r + c) % 3 === 0 ? 0.45 : 0.14, 3));
    }
  }
  return out;
};

const coin = ({ cx, cy, s }, p) => [
  circle(cx, cy, s * 0.38, 'accent', 0.7),
  circle(cx, cy, s * 0.3, 'paper', 0.85),
  circle(cx, cy, s * 0.22, 'accent', 0.5),
  line(cx - s * 0.1, cy - s * 0.04, s * 0.2, 'bg', 0.7, 6),
  line(cx - s * 0.1, cy + s * 0.06, s * 0.2, 'bg', 0.7, 6),
];

const battery = ({ cx, cy, s }) => {
  const w = s * 0.56;
  const h = s * 0.34;
  return [
    rect(cx - w / 2, cy - h / 2, w, h, 'ink', 0.18, 18, { stroke: 'ink', strokeWidth: 3 }),
    rect(cx + w / 2, cy - h * 0.16, s * 0.05, h * 0.32, 'ink', 0.5, 4),
    rect(cx - w / 2 + w * 0.05, cy - h * 0.36, w * 0.24, h * 0.72, 'accent', 0.85, 8),
    rect(cx - w / 2 + w * 0.32, cy - h * 0.36, w * 0.24, h * 0.72, 'accent', 0.55, 8),
    rect(cx - w / 2 + w * 0.59, cy - h * 0.36, w * 0.24, h * 0.72, 'accent', 0.3, 8),
  ];
};

const leaf = ({ cx, cy, s }) => [
  rect(cx - s * 0.3, cy - s * 0.34, s * 0.56, s * 0.66, 'accent2', 0.55, s * 0.28, { rotation: -24 }),
  rect(cx - s * 0.04, cy - s * 0.05, s * 0.05, s * 0.46, 'ink', 0.5, 2, { rotation: 30 }),
  line(cx - s * 0.26, cy + s * 0.2, s * 0.3, 'ink', 0.3, 2),
];

const clock = ({ cx, cy, s }) => [
  circle(cx, cy, s * 0.38, 'paper', 0.92),
  circle(cx, cy, s * 0.38, 'ink', 0.9),
  circle(cx, cy, s * 0.32, 'paper', 0.95),
  rect(cx - s * 0.012, cy - s * 0.24, s * 0.024, s * 0.26, 'ink', 0.85, 2),
  rect(cx - s * 0.01, cy - s * 0.02, s * 0.2, s * 0.02, 'accent', 0.9, 2, { rotation: 30 }),
];

const shield = ({ cx, cy, s }) => [
  circle(cx, cy, s * 0.36, 'accent', 0.2),
  circle(cx, cy, s * 0.36, 'accent', 0.9, 0),
  circle(cx, cy, s * 0.29, 'bg', 0.55),
  rect(cx - s * 0.18, cy - s * 0.02, s * 0.14, s * 0.04, 'ink', 0.95, 2, { rotation: 45 }),
  rect(cx - s * 0.06, cy + s * 0.02, s * 0.26, s * 0.04, 'ink', 0.95, 2, { rotation: -48 }),
];

const arrow = ({ cx, cy, s }) => [
  rect(cx - s * 0.34, cy - s * 0.03, s * 0.56, s * 0.06, 'accent', 0.95, 3),
  rect(cx + s * 0.08, cy - s * 0.03, s * 0.22, s * 0.06, 'accent', 0.95, 3, { rotation: 45 }),
  rect(cx + s * 0.08, cy - s * 0.03, s * 0.22, s * 0.06, 'accent', 0.95, 3, { rotation: -45 }),
];

const wallet = ({ cx, cy, s }) => [
  rect(cx - s * 0.34, cy - s * 0.26, s * 0.68, s * 0.52, 'paper', 0.95, 12),
  rect(cx - s * 0.34, cy + s * 0.04, s * 0.68, s * 0.22, 'accent', 0.9, 10),
  circle(cx + s * 0.2, cy + s * 0.15, s * 0.045, 'bg', 0.9),
  rect(cx - s * 0.26, cy - s * 0.18, s * 0.3, s * 0.035, 'ink', 0.25, 2),
];

const calendar = ({ cx, cy, s }) => {
  const w = s * 0.6;
  const h = s * 0.56;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const cells = [];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const hot = (r === 1 && c === 2);
      cells.push(rect(x + w * 0.1 + c * w * 0.2, y + h * 0.34 + r * h * 0.18, w * 0.1, h * 0.09, hot ? 'accent' : 'ink', hot ? 1 : 0.28, 2));
    }
  }
  return [rect(x, y, w, h, 'paper', 0.95, 10), rect(x, y, w, h * 0.22, 'accent', 0.9, 10), ...cells];
};

const key = ({ cx, cy, s }) => [
  circle(cx - s * 0.18, cy, s * 0.14, 'accent', 0.95),
  circle(cx - s * 0.18, cy, s * 0.075, 'bg', 0.9),
  rect(cx - s * 0.04, cy - s * 0.035, s * 0.4, s * 0.07, 'accent', 0.95, 3),
  rect(cx + s * 0.2, cy + s * 0.01, s * 0.05, s * 0.1, 'accent', 0.95, 2),
  rect(cx + s * 0.3, cy + s * 0.01, s * 0.05, s * 0.13, 'accent', 0.95, 2),
];

const drop = ({ cx, cy, s }) => [
  circle(cx, cy + s * 0.08, s * 0.26, 'accent', 0.75),
  rect(cx - s * 0.14, cy - s * 0.28, s * 0.28, s * 0.34, 'accent', 0.75, s * 0.14, { rotation: 45 }),
  circle(cx - s * 0.08, cy - s * 0.02, s * 0.05, 'paper', 0.65),
];

const cloud = ({ cx, cy, s }) => [
  circle(cx - s * 0.16, cy, s * 0.16, 'ink', 0.16),
  circle(cx + s * 0.02, cy - s * 0.08, s * 0.21, 'ink', 0.16),
  circle(cx + s * 0.2, cy, s * 0.14, 'ink', 0.16),
  rect(cx - s * 0.28, cy, s * 0.62, s * 0.16, 'ink', 0.16, 30),
  line(cx - s * 0.1, cy + s * 0.26, s * 0.03, 'accent', 0.8, 8),
  line(cx + s * 0.06, cy + s * 0.32, s * 0.03, 'accent', 0.5, 6),
];

const road = ({ cx, cy, s }) => {
  const dashes = [];
  for (let i = 0; i < 5; i += 1) dashes.push(rect(cx - s * 0.02, cy - s * 0.4 + i * s * 0.18, s * 0.04, s * 0.1, 'paper', 0.7, 2));
  return [
    rect(cx - s * 0.3, cy - s * 0.48, s * 0.6, s * 0.96, 'ink', 0.12, 8),
    ...dashes,
    circle(cx + s * 0.26, cy - s * 0.36, s * 0.05, 'accent', 1),
  ];
};

const box = ({ cx, cy, s }) => [
  rect(cx - s * 0.3, cy - s * 0.26, s * 0.6, s * 0.52, 'paper', 0.9, 6),
  rect(cx - s * 0.3, cy - s * 0.26, s * 0.6, s * 0.14, 'accent', 0.9, 6),
  rect(cx - s * 0.02, cy - s * 0.26, s * 0.04, s * 0.52, 'ink', 0.3, 2),
  rect(cx - s * 0.3, cy - s * 0.02, s * 0.6, s * 0.04, 'ink', 0.3, 2),
];

const factory = ({ cx, cy, s }) => {
  const body = rect(cx - s * 0.36, cy - s * 0.06, s * 0.72, s * 0.34, 'ink', 0.22, 4);
  const stacks = [0, 1, 2].map((i) => rect(cx - s * 0.3 + i * s * 0.22, cy - s * 0.3, s * 0.1, s * 0.28, 'ink', 0.28, 3));
  return [body, ...stacks, rect(cx - s * 0.3, cy + s * 0.1, s * 0.14, s * 0.16, 'accent', 0.7, 2), rect(cx - s * 0.1, cy + s * 0.1, s * 0.14, s * 0.16, 'accent', 0.5, 2)];
};

const check = ({ cx, cy, s }) => [
  circle(cx, cy, s * 0.32, 'accent', 0.92),
  rect(cx - s * 0.18, cy + s * 0.0, s * 0.12, s * 0.045, 'bg', 1, 2, { rotation: 45 }),
  rect(cx - s * 0.08, cy + s * 0.01, s * 0.3, s * 0.045, 'bg', 1, 2, { rotation: -50 }),
];

const KEYS = [
  ['meter', ['meter', 'dial', 'disc', 'electricity', 'kilowatt', 'reading', 'power']],
  ['bill', ['bill', 'receipt', 'invoice', 'ledger', 'rupee', 'rupees', 'price', 'cost', 'budget', 'saving', 'savings', 'tax', 'fee', 'fees']],
  ['panel', ['panel', 'panels', 'solar', 'roof', 'rooftop', 'slab', 'module', 'modules']],
  ['person', ['child', 'children', 'family', 'student', 'person', 'people', 'worker', 'hand', 'face', 'customer', 'buyer']],
  ['lamp', ['lamp', 'bulb', 'light', 'lights', 'study']],
  ['house', ['house', 'home', 'building', 'shop', 'office', 'school', 'apartment']],
  ['chart', ['chart', 'graph', 'growth', 'rise', 'fall', 'trend', 'percent', 'number', 'stat', 'data', 'rate']],
  ['phone', ['phone', 'screen', 'app', 'device', 'call', 'message']],
  ['coin', ['coin', 'money', 'cash', 'payment', 'profit', 'income']],
  ['sun', ['sun', 'sunlight', 'morning', 'daylight', 'shine', 'summer', 'winter']],
  ['grid', ['grid', 'system', 'network', 'map', 'plan', 'layout', 'infrastructure']],
  ['battery', ['battery', 'charge', 'storage', 'backup', 'energy']],
  ['leaf', ['leaf', 'green', 'clean', 'nature', 'carbon', 'environment']],
  ['clock', ['clock', 'time', 'hour', 'day', 'month', 'deadline', 'year']],
  ['shield', ['shield', 'safe', 'secure', 'security', 'protect', 'guarantee', 'warranty']],
  ['arrow', ['arrow', 'forward', 'next', 'direction', 'move', 'switch', 'shift']],
  ['wallet', ['wallet', 'account', 'bank', 'salary', 'budget']],
  ['calendar', ['calendar', 'date', 'december', 'january', 'schedule', 'month']],
  ['key', ['key', 'access', 'control', 'unlock', 'own', 'ownership']],
  ['drop', ['drop', 'water', 'rain', 'leak', 'liquid']],
  ['cloud', ['cloud', 'storm', 'weather', 'rain', 'sky']],
  ['road', ['road', 'street', 'route', 'path', 'city', 'drive', 'distance']],
  ['box', ['box', 'package', 'product', 'delivery', 'parcel', 'shipment']],
  ['factory', ['factory', 'plant', 'industry', 'production', 'manufacture']],
  ['check', ['check', 'done', 'ready', 'approved', 'result', 'proof']],
];

const BUILD = { meter, bill, panel, lamp, person, house, chart, phone, coin, sun, grid, battery, leaf, clock, shield, arrow, wallet, calendar, key, drop, cloud, road, box, factory, check };

const backdrop = (ctx, comp) => {
  const { W, H } = ctx;
  const out = [];
  if (comp === 'panorama') {
    out.push(circle(W * 0.72, H * 0.26, Math.min(W, H) * 0.28, 'accent', 0.16, 40));
    out.push(line(W * 0.04, H * 0.42, W * 0.92, 'accent', 0.35, 3));
  } else if (comp === 'diagram') {
    for (let i = 1; i < 6; i += 1) out.push(line(W * 0.06, H * 0.18 + i * H * 0.1, W * 0.88, 'ink', 0.07, 1));
    out.push(rect(W * 0.06, H * 0.18, W * 0.2, H * 0.1, 'accent', 0.18, 4));
    out.push(rect(W * 0.46, H * 0.38, W * 0.34, H * 0.2, 'accent2', 0.12, 4));
  } else if (comp === 'grid') {
    for (let r = 0; r < 4; r += 1) for (let c = 0; c < 4; c += 1) out.push(rect(W * 0.1 + c * W * 0.21, H * 0.22 + r * H * 0.12, W * 0.17, H * 0.09, 'ink', (r + c) % 4 === 0 ? 0.1 : 0.05, 3));
  } else {
    out.push(circle(W * 0.78, H * 0.22, Math.min(W, H) * 0.34, 'accent', 0.08, 30));
    out.push(rect(W * 0.02, H * 0.66, W * 0.96, H * 0.004, 'ink', 0.14, 0));
  }
  out.push(circle(W * 0.12, H * 0.82, Math.min(W, H) * 0.12, 'accent2', 0.06, 20));
  return out;
};

export const visualScene = (beat, ctx) => {
  const primary = tokensOf(`${beat.visual ?? ''} ${beat.headline ?? ''} ${beat.label ?? ''}`);
  const secondary = tokensOf(`${ctx.plan?.motif ?? ''} ${beat.body ?? ''} ${beat.kicker ?? ''}`);
  const key = KEYS.find(([, words]) => hasAny(primary, words))?.[0]
    ?? KEYS.find(([, words]) => hasAny(secondary, words))?.[0];
  const { W, H } = ctx;
  const comp = ctx.composition || ctx.layoutMode || 'single';
  const zone = zoneFor(ctx.layoutMode, W, H);
  const panorama = comp === 'panorama';
  if (!key) {
    if (comp === 'diagram' || comp === 'grid') return { type: 'group', x: 0, y: 0, opacity: 0.95, motion: { in: { type: 'fade', at: 0, dur: 0.9 }, out: false }, children: backdrop(ctx, comp) };
    return null;
  }
  const s = Math.min(W, H) * (panorama ? 0.72 : (zone.s ?? 0.5));
  const cx = comp === 'split' ? W * 0.73 : panorama ? W * 0.6 : zone.cx;
  const cy = panorama ? H * 0.28 : comp === 'stack' ? H * 0.64 : zone.cy;
  const children = [...backdrop(ctx, comp), ...BUILD[key]({ cx, cy, s }, ctx.style.palette)];
  return {
    type: 'group',
    x: 0,
    y: 0,
    opacity: 1,
    motion: {
      in: { type: 'rise', at: 0.02, dur: ctx.style.profile.inDur, ease: ctx.style.profile.ease, distance: 44 },
      out: false,
      loop: { type: 'float', amp: 7, period: 12, phase: 1 },
    },
    children,
  };
};

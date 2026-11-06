const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const parse = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    return [1, 3, 5].map((i) => parseInt(s[i] + s[i], 16));
  }
  if (/^#[0-9a-f]{6}$/i.test(s)) {
    return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(',').map((x) => Number(x.trim()));
    if (p.length >= 3 && p.every((n) => Number.isFinite(n))) {
      return [p[0], p[1], p[2], p.length > 3 ? clamp(p[3]) : 1];
    }
  }
  return null;
};

const resolve = (v, pal) => {
  if (typeof v !== 'string') return null;
  const token = v.startsWith('@') ? v.slice(1) : v;
  return parse(pal?.[token] ?? token);
};

const lum = (rgb) => {
  const [r, g, b] = rgb.slice(0, 3).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const over = (fg, bg) => {
  const a = (fg[3] ?? 1) * (fg[4] ?? 1);
  const base = bg ?? [0, 0, 0];
  return [0, 1, 2].map((i) => fg[i] * a + base[i] * (1 - a));
};

const ratio = (a, b) => {
  if (!a || !b) return null;
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const blockBg = (blocks, pal) => {
  for (const b of blocks ?? []) {
    if (b.type === 'bg' && typeof b.fill === 'string') {
      const c = resolve(b.fill, pal);
      if (c) return c;
    }
  }
  return resolve(pal.bg, pal);
};

const pickBg = (bgs, x, y) => {
  let found = null;
  for (const g of bgs) {
    if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) found = g.color;
  }
  return found;
};

const safeAreaOf = (canvas) => {
  const w = Number(canvas?.w) || 1080;
  const h = Number(canvas?.h) || 1920;
  const vertical = h > w;
  return {
    left: w * 0.06,
    right: w * 0.94,
    top: h * (vertical ? 0.08 : 0.06),
    bottom: h * (vertical ? 0.86 : 0.94),
  };
};

const fitEstimate = (b) => {
  if (!b.fit || typeof b.fit !== 'object') return Number(b.size) || 32;
  const maxLines = Math.max(1, Math.round(Number(b.fit.maxLines) || 4));
  const minSize = Math.max(8, Number(b.fit.minSize) || (Number(b.size) || 32) * 0.6);
  const lh = Number(b.lineHeight) || 1.2;
  const w = Number(b.w) || Number(b.width) || 0;
  const boxH = b.h === undefined ? Infinity : Number(b.h);
  let size = Number(b.size) || 32;
  for (let i = 0; i < 48; i += 1) {
    const charsPerLine = Math.max(1, Math.floor(w / Math.max(1, size * 0.52)));
    const lines = String(b.text ?? '').split('\n')
      .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    if (lines <= maxLines && lines * size * lh <= boxH) return size;
    if (size <= minSize) break;
    size = Math.max(minSize, size * 0.94);
  }
  return minSize;
};

const textBounds = (b) => {
  const size = fitEstimate(b);
  const lh = Number(b.lineHeight) || 1.2;
  const w = Number(b.w) || Number(b.width) || 0;
  const x = Number(b.x) || 0;
  const y = Number(b.y) || 0;
  if (b.type === 'cta' || b.type === 'stamp') {
    return { x, y, w: Number(b.w) || 300, h: Number(b.h) || 72 };
  }
  if (b.type === 'kicker') {
    return { x, y, w: Math.max(20, String(b.text ?? '').length * size * 0.62), h: size * 1.4 };
  }
  if (!w) return null;
  const charsPerLine = Math.max(1, Math.floor(w / Math.max(1, size * 0.52)));
  const explicit = String(b.text ?? '').split('\n');
  const lines = explicit.reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return { x, y, w, h: lines * size * lh };
};

const walk = (blocks, ctx, out) => {
  const bgs = [...(ctx.bgs ?? [])];
  const ox = Number(ctx.ox) || 0;
  const oy = Number(ctx.oy) || 0;
  for (const b of blocks ?? []) {
    if (!b || typeof b !== 'object') continue;
    const bx = ox + (Number(b.x) || 0);
    const by = oy + (Number(b.y) || 0);
    const decorative = b.blend && b.blend !== 'normal';
    if (!decorative && (b.type === 'rect' || b.type === 'rrect') && Number(b.w) >= 100 && Number(b.h) >= 100) {
      const c = resolve(b.fill, ctx.pal);
      if (c) {
        const opacity = Number.isFinite(Number(b.opacity)) ? Number(b.opacity) : 1;
        bgs.push({
          x: bx,
          y: by,
          w: Number(b.w) || 0,
          h: Number(b.h) || 0,
          color: over([c[0], c[1], c[2], (c[3] ?? 1) * opacity], ctx.bg),
        });
      }
    }
    if (b.type === 'text' || b.type === 'kicker') {
      const fg = resolve(b.fill ?? 'ink', ctx.pal);
      const bg = pickBg(bgs, bx + 2, by + 2) ?? ctx.bg;
      const r = ratio(fg, bg);
      if (r !== null) {
        const size = Number(b.size) || 32;
        const need = size >= 72 ? 3 : 4.5;
        if (r < 1.5) out.errors.push(`${ctx.where} ${b.type} "${String(b.text ?? '').slice(0, 40)}": contrast ${r.toFixed(2)} (invisible)`);
        else if (r < need) out.warnings.push(`${ctx.where} ${b.type} "${String(b.text ?? '').slice(0, 40)}": contrast ${r.toFixed(2)} < ${need}`);
      }
    }
    if (b.type === 'cta') {
      const fg = resolve(b.textFill ?? 'bg', ctx.pal);
      const bg = resolve(b.fill ?? 'ink', ctx.pal);
      const r = ratio(fg, bg);
      if (r !== null && r < 1.5) out.errors.push(`${ctx.where} cta "${String(b.text ?? '').slice(0, 40)}": contrast ${r.toFixed(2)} (invisible)`);
      else if (r !== null && r < 4.5) out.warnings.push(`${ctx.where} cta "${String(b.text ?? '').slice(0, 40)}": contrast ${r.toFixed(2)} < 4.5`);
    }
    if (['text', 'kicker', 'cta', 'stamp'].includes(b.type) && ctx.safe && (Number(b.opacity) || 1) >= 0.35) {
      const box = textBounds(b);
      const s = ctx.safe;
      if (box) {
        box.x += ox;
        box.y += oy;
        const outside = box.x < s.left - 1 || box.x + box.w > s.right + 1 || box.y < s.top - 1 || box.y + box.h > s.bottom + 1;
        if (outside) {
          out.warnings.push(`${ctx.where} ${b.type} "${String(b.text ?? '').slice(0, 40)}": outside safe area (${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.w)}x${Math.round(box.h)})`);
        }
      }
    }
    if (Array.isArray(b.children)) walk(b.children, { ...ctx, bgs, ox: bx, oy: by }, out);
  }
};

const bestFill = (bg, pal) => {
  if (!bg) return 'ink';
  const candidates = [
    ['ink', resolve(pal.ink, pal)],
    ['bg', resolve(pal.bg, pal)],
    ['#ffffff', parse('#ffffff')],
    ['#111111', parse('#111111')],
  ].filter(([, c]) => c);
  let best = candidates[0];
  let top = -1;
  for (const c of candidates) {
    const r = ratio(c[1], bg) ?? 0;
    if (r > top) { top = r; best = c; }
  }
  return best[0];
};

const fixBlocks = (blocks, ctx, changed) => {
  const bgs = [...(ctx.bgs ?? [])];
  const ox = Number(ctx.ox) || 0;
  const oy = Number(ctx.oy) || 0;
  for (const b of blocks ?? []) {
    if (!b || typeof b !== 'object') continue;
    const bx = ox + (Number(b.x) || 0);
    const by = oy + (Number(b.y) || 0);
    const decorative = b.blend && b.blend !== 'normal';
    if (!decorative && (b.type === 'rect' || b.type === 'rrect') && Number(b.w) >= 100 && Number(b.h) >= 100) {
      const c = resolve(b.fill, ctx.pal);
      if (c) {
        const opacity = Number.isFinite(Number(b.opacity)) ? Number(b.opacity) : 1;
        bgs.push({
          x: bx, y: by, w: Number(b.w) || 0, h: Number(b.h) || 0,
          color: over([c[0], c[1], c[2], (c[3] ?? 1) * opacity], ctx.bg),
        });
      }
    }
    if (b.type === 'text' || b.type === 'kicker') {
      const bg = pickBg(bgs, bx + 2, by + 2) ?? ctx.bg;
      const fg = resolve(b.fill ?? 'ink', ctx.pal);
      const r = ratio(fg, bg);
      const size = Number(b.size) || 32;
      const need = size >= 72 ? 3 : 4.5;
      if (r !== null && r < need) {
        const before = b.fill ?? 'ink';
        b.fill = bestFill(bg, ctx.pal);
        changed.push(`${ctx.where} ${b.type} "${String(b.text ?? '').slice(0, 32)}": ${before} -> ${b.fill}`);
      }
    }
    if (b.type === 'cta') {
      const fill = resolve(b.fill ?? 'ink', ctx.pal);
      const fg = resolve(b.textFill ?? 'bg', ctx.pal);
      const r = ratio(fg, fill);
      if (r !== null && r < 4.5) {
        const light = lum(fill ?? [0, 0, 0]) < 0.5;
        const before = b.textFill ?? 'bg';
        b.textFill = light ? '#ffffff' : '#111111';
        changed.push(`${ctx.where} cta "${String(b.text ?? '').slice(0, 32)}": ${before} -> ${b.textFill}`);
      }
    }
    if (Array.isArray(b.children)) fixBlocks(b.children, { ...ctx, bgs, ox: bx, oy: by }, changed);
  }
};

export const fixSpecContrast = (spec) => {
  const pal = spec.palette ?? {};
  const changed = [];
  const bg = resolve(pal.bg, pal);
  if (pal.bg && pal.ink && (ratio(resolve(pal.bg, pal), resolve(pal.ink, pal)) ?? 0) < 1.5) {
    const next = lum(bg ?? [0, 0, 0]) < 0.5 ? '#f4f1ea' : '#111111';
    changed.push(`palette ink ${pal.ink} -> ${next}`);
    spec.palette = { ...pal, ink: next };
  }
  const palette = spec.palette ?? pal;
  for (const [i, layer] of (spec.layers ?? []).entries()) {
    fixBlocks(layer.blocks, { pal: palette, bg: blockBg(layer.blocks, palette), where: `layer ${layer.id ?? i}` }, changed);
  }
  fixBlocks(spec.chrome?.blocks, { pal: palette, bg: resolve(palette.bg, palette), where: 'chrome' }, changed);
  return { spec, changed };
};

export const lintSpec = (spec) => {
  const pal = spec.palette ?? {};
  const out = { errors: [], warnings: [] };
  const bgToken = pal.bg;
  const safe = safeAreaOf(spec.canvas);
  for (const [i, layer] of (spec.layers ?? []).entries()) {
    walk(layer.blocks, { pal, bg: blockBg(layer.blocks, pal), where: `layer ${layer.id ?? i}`, safe }, out);
  }
  walk(spec.chrome?.blocks, { pal, bg: resolve(bgToken, pal), where: 'chrome' }, out);
  if (pal.bg && pal.ink) {
    const r = ratio(resolve(pal.bg, pal), resolve(pal.ink, pal));
    if (r !== null && r < 1.5) out.errors.push(`palette: ink on bg contrast ${r.toFixed(2)} (invisible)`);
  }
  return { ok: out.errors.length === 0, ...out };
};

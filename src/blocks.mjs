
import { bake, combineMotion, motionFns } from './motion.mjs';
import { easeFn } from './ease.mjs';
import { compileMechanic } from './mechanics.mjs';
import { compileExplain } from './explain.mjs';
import { layoutText } from '../engine/core/index.js';

const TAU = Math.PI * 2;
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export const color = (v, pal, fallback = '#000000') => {
  if (typeof v !== 'string') return fallback;
  if (v.startsWith('@')) return pal[v.slice(1)] ?? fallback;
  return pal[v] ?? v;
};

export const fillOf = (v, pal) => {
  if (v === undefined) return undefined;
  if (typeof v === 'string') return color(v, pal);
  if (v && v.kind === 'linear') {
    return {
      kind: 'linear',
      angle: num(v.angle, 90),
      stops: (v.stops ?? []).map((s) => ({ offset: s.offset, color: color(s.color, pal) })),
    };
  }
  if (v && v.kind === 'radial') {
    return {
      kind: 'radial',
      from: v.from, to: v.to,
      stops: (v.stops ?? []).map((s) => ({ offset: s.offset, color: color(s.color, pal) })),
    };
  }
  throw new Error('fillOf: fill must be a color token or {kind:"linear"|"radial"}');
};

const staggerIn = (motion, i, step) => {
  if (!motion || !motion.in || i === 0) return motion;
  return { ...motion, in: { ...motion.in, at: num(motion.in.at, 0) + i * num(step, 0.08) } };
};

const baseOf = (b) => ({
  x: num(b.x, 0),
  y: num(b.y, 0),
  rotation: num(b.rotation, 0),
  opacity: num(b.opacity, 1),
  scaleX: num(b.scale, 1),
  scaleY: num(b.scale, 1),
  blur: 0,
});

const motionProps = (b, ctx, extra = {}) => combineMotion({ ...baseOf(b), ...extra }, b.motion, ctx);

const textStyle = (b, ctx) => ({
  fontFamily: b.face ?? ctx.faces.body,
  fontSize: num(b.size, 32),
  fontWeight: b.weight ?? 400,
  fontStyle: b.italic ? 'italic' : (b.fontStyle ?? 'normal'),
  letterSpacing: num(b.letterSpacing, 0),
  lineHeight: num(b.lineHeight, 1.2),
  maxWidth: b.w,
  textAlign: b.align ?? 'left',
  textTransform: b.transform ?? b.textTransform ?? 'none',
});

const textNode = (id, b, ctx, extraProps = {}) => {
  const mp = motionProps(b, ctx, extraProps);
  const node = {
    id,
    type: 'text',
    text: String(b.text ?? ''),
    ...textStyle(b, ctx),
    fill: fillOf(b.fill ?? 'ink', ctx.pal),
    ...mp,
  };
  if (b.stroke) { node.stroke = color(b.stroke, ctx.pal); node.strokeWidth = num(b.strokeWidth, 2); }
  if (b.shadow) {
    node.shadow = {
      color: color(b.shadow.color ?? 'rgba(0,0,0,0.4)', ctx.pal),
      blur: num(b.shadow.blur, 12),
      offsetX: num(b.shadow.x, 0),
      offsetY: num(b.shadow.y, 4),
    };
  }
  return node;
};

const textSize = (b, ctx) => {
  const style = textStyle(b, ctx);
  return { style, width: b.w };
};

const fitTextBlock = (b, ctx) => {
  if (!b.fit || typeof b.fit !== 'object') return b;
  const style = textStyle(b, ctx);
  const w = num(b.w, ctx.W - num(b.x, 0) * 2);
  const maxLines = Math.max(1, Math.round(num(b.fit.maxLines, 4)));
  const minSize = Math.max(8, num(b.fit.minSize, style.fontSize * 0.6));
  const boxH = b.h === undefined ? Infinity : num(b.h, Infinity);
  let size = style.fontSize;
  for (let i = 0; i < 48; i += 1) {
    const laid = layoutText(String(b.text ?? ''), { ...style, fontSize: size, maxWidth: w }, ctx.measure);
    if (laid.lines.length <= maxLines && laid.height <= boxH) {
      return { ...b, size, w };
    }
    if (size <= minSize) break;
    size = Math.max(minSize, size * 0.94);
  }
  const laid = layoutText(String(b.text ?? ''), { ...style, fontSize: minSize, maxWidth: w }, ctx.measure);
  if (laid.lines.length > maxLines || laid.height > boxH) {
    throw new Error(
      `text fit overflow (id ${ctx.uid}): "${String(b.text ?? '').slice(0, 60)}" box ${Math.round(w)}x${b.h === undefined ? 'auto' : Math.round(boxH)} needs ${laid.lines.length} lines at min size ${Math.round(minSize)}`,
    );
  }
  return { ...b, size: minSize, w };
};

const measureWidth = (b, ctx, text) => {
  const s = textStyle(b, ctx);
  return ctx.measure.measure(text, {
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    fontStyle: s.fontStyle,
    letterSpacing: s.letterSpacing,
    textTransform: s.textTransform,
  }).width + s.letterSpacing * Math.max(0, String(text).length - 1);
};

const maskText = (id, b, ctx) => {
  const style = textStyle(b, ctx);
  const w = num(b.w, ctx.W - num(b.x, 0) * 2);
  const laid = layoutText(String(b.text ?? ''), { ...style, maxWidth: w }, ctx.measure);
  const h = num(b.h, laid.height + style.fontSize * 0.35);
  const outerMotion = b.motion
    ? { ...b.motion, in: b.motion.in ? { ...b.motion.in, type: 'fade' } : b.motion.in }
    : b.motion;
  const outer = {
    id,
    type: 'group',
    x: num(b.x, 0),
    y: num(b.y, 0),
    clip: { x: 0, y: 0, width: w, height: h },
    ...motionProps({ ...b, motion: outerMotion }, ctx, { x: 0, y: 0 }),
  };
  const rise = num(b.maskDistance, laid.height * 1.15);
  const m = b.motion ?? {};
  const inCfg = m.in && m.in.type === 'maskUp' ? m.in : null;
  let innerY;
  if (inCfg) {
    const at = num(inCfg.at, 0);
    const dur = Math.max(0.001, num(inCfg.dur, 0.6));
    const ease = easeFn(inCfg.ease);
    const progress = (t) => ease(Math.min(1, Math.max(0, (t - at) / dur)));
    innerY = bake((t) => rise * (1 - progress(t)), ctx);
  }
  const inner = {
    id: `${id}-t`,
    type: 'text',
    text: String(b.text ?? ''),
    ...textStyle(b, ctx),
    maxWidth: w,
    fill: fillOf(b.fill ?? 'ink', ctx.pal),
    x: 0,
    y: innerY ?? 0,
  };
  if (b.shadow) {
    inner.shadow = {
      color: color(b.shadow.color ?? 'rgba(0,0,0,0.4)', ctx.pal),
      blur: num(b.shadow.blur, 12),
      offsetX: num(b.shadow.x, 0),
      offsetY: num(b.shadow.y, 4),
    };
  }
  outer.children = [inner];
  return outer;
};

const compileList = (list, ctx, prefix) => {
  const out = [];
  (list ?? []).forEach((child, i) => {
    out.push(...compileBlock(child, { ...ctx, uid: `${prefix}.${i}` }));
  });
  return out;
};

const rectRule = (id, b, ctx) => ({
  id,
  type: 'rect',
  width: num(b.w, 100),
  height: num(b.h, 2),
  x: num(b.x, 0),
  y: num(b.y, 0),
  fill: fillOf(b.fill ?? 'ink', ctx.pal),
  anchorX: 0,
  anchorY: 0,
  ...motionProps(b, ctx),
});

export const compileBlock = (b, ctx) => {
  const id = ctx.uid;
  const P = ctx.pal;
  switch (b.type) {
    case 'group': {
      const node = {
        id,
        type: 'group',
        ...motionProps(b, ctx),
      };
      node.children = compileList(b.children, ctx, id);
      if (b.clip) node.clip = b.clip;
      return [node];
    }
    case 'bg': {
      const node = {
        id,
        type: 'rect',
        width: ctx.W,
        height: ctx.H,
        x: 0,
        y: 0,
        fill: fillOf(b.fill ?? { kind: 'linear', angle: 90, stops: [{ offset: 0, color: b.top ?? P.bg }, { offset: 1, color: b.bottom ?? P.bg }] }, P),
        ...motionProps(b, ctx, { x: 0, y: 0 }),
      };
      return [node];
    }
    case 'rect':
    case 'rrect': {
      const node = {
        id,
        type: b.radius !== undefined || b.type === 'rrect' ? 'rrect' : 'rect',
        width: num(b.w, 100),
        height: num(b.h, 100),
        x: num(b.x, 0),
        y: num(b.y, 0),
        fill: fillOf(b.fill ?? 'transparent', P),
        ...motionProps(b, ctx),
      };
      if (node.type === 'rrect') node.radius = num(b.radius, 12);
      if (b.stroke) { node.stroke = color(b.stroke, P); node.strokeWidth = num(b.strokeWidth, 2); }
      if (b.shadow) node.shadow = { color: color(b.shadow.color ?? 'rgba(0,0,0,0.25)', P), blur: num(b.shadow.blur, 20), offsetX: num(b.shadow.x, 0), offsetY: num(b.shadow.y, 10) };
      if (b.children) node.children = compileList(b.children, ctx, id);
      return [node];
    }
    case 'circle': {
      const node = {
        id,
        type: 'circle',
        radius: num(b.r, 40),
        x: num(b.x, 0),
        y: num(b.y, 0),
        fill: fillOf(b.fill ?? 'accent', P),
        ...motionProps(b, ctx),
      };
      if (b.blur) node.filter = { blur: num(b.blur, 0) };
      return [node];
    }
    case 'space':
      return [];
    case 'text': {
      if (ctx.hideText) return [];
      const fitted = fitTextBlock(b, ctx);
      if (fitted.mask || (fitted.motion?.in?.type === 'maskUp')) return [maskText(id, fitted, ctx)];
      return [textNode(id, fitted, ctx)];
    }
    case 'kicker': {
      if (ctx.hideText) return [];
      const baseY = num(b.y, 0);
      const baseX = num(b.x, 0);
      const rule = b.rule !== false;
      const size = num(b.size, 18);
      const ls = num(b.letterSpacing, 2.4);
      const label = String(b.text ?? '').toUpperCase();
      const w = measureWidth({ ...b, size, letterSpacing: ls, transform: 'uppercase', w: undefined }, ctx, label);
      const group = {
        id,
        type: 'group',
        ...motionProps(b, ctx, { x: baseX, y: baseY }),
      };
      group.children = [{
        id: `${id}-t`,
        type: 'text',
        text: label,
        fontFamily: b.face ?? ctx.faces.mono,
        fontSize: size,
        fontWeight: b.weight ?? 700,
        letterSpacing: ls,
        textTransform: 'uppercase',
        fill: fillOf(b.fill ?? 'accent', P),
        x: rule ? 0 : num(b.ruleGap, 0),
        y: rule ? size * 0.35 : 0,
      }];
      if (rule) {
        group.children.push({
          id: `${id}-r`,
          type: 'rect',
          width: w + 18,
          height: num(b.ruleH, 2),
          x: 0,
          y: 0,
          anchorX: 0,
          anchorY: 0,
          fill: fillOf(b.ruleColor ?? b.fill ?? 'accent', P),
          scaleX: 0,
        });
      }
      return [group];
    }
    case 'rule':
      return [rectRule(id, b, ctx)];
    case 'photo': {
      const w = num(b.w, 300);
      const h = num(b.h, 300);
      const group = {
        id,
        type: 'group',
        ...motionProps(b, ctx),
        clip: { x: 0, y: 0, width: w, height: h, ...(b.radius ? { radius: num(b.radius, 0) } : {}) },
      };
      const img = {
        id: `${id}-img`,
        type: 'image',
        src: b.src,
        x: 0,
        y: 0,
        width: w,
        height: h,
        fit: b.fit ?? 'cover',
      };
      const filter = {};
      if (b.grayscale) filter.grayscale = num(b.grayscale, 1);
      if (b.contrast) filter.contrast = num(b.contrast, 1);
      if (b.brightness) filter.brightness = num(b.brightness, 1);
      if (Object.keys(filter).length > 0) img.filter = filter;
      if (b.kenBurns) {
        const kb = b.kenBurns;
        img.anchorX = w / 2;
        img.anchorY = h / 2;
        const k = (t) => {
          const u = Math.min(1, Math.max(0, t / Math.max(0.001, ctx.clipDur)));
          const f = num(kb.from, 1);
          const to = num(kb.to, 1.08);
          const s = f + (to - f) * u;
          return s;
        };
        img.scaleX = bake((t) => k(t), ctx);
        img.scaleY = bake((t) => k(t), ctx);
        img.x = num(b.kbToX, 0) === 0 ? 0 : bake((t) => num(b.kbToX, 0) * (t / ctx.clipDur), ctx);
        img.y = num(b.kbToY, 0) === 0 ? 0 : bake((t) => num(b.kbToY, 0) * (t / ctx.clipDur), ctx);
      }
      group.children = [img];
      if (b.tint) {
        group.children.push({
          id: `${id}-tint`, type: 'rect', width: w, height: h, x: 0, y: 0,
          fill: color(b.tint.color ?? 'accent', P), opacity: num(b.tint.opacity, 0.18),
          blendMode: b.tint.blend ?? 'multiply',
        });
      }
      if (b.border) {
        group.children.push({
          id: `${id}-bd`, type: 'rect', width: w, height: h, x: 0, y: 0,
          fill: 'rgba(0,0,0,0)', stroke: color(b.border, P), strokeWidth: num(b.borderWidth, 2),
        });
      }
      return [group];
    }
    case 'image':
    case 'sprite': {
      const node = {
        id, type: 'image', src: b.src,
        width: num(b.w, 200), height: num(b.h, 200), fit: b.fit ?? 'cover',
        ...motionProps(b, ctx),
      };
      if (b.grayscale) node.filter = { grayscale: num(b.grayscale, 1) };
      return [node];
    }
    case 'stamp': {
      if (ctx.hideText) return [];
      const w = num(b.w, 220);
      const h = num(b.h, 120);
      const size = num(b.size, 30);
      const group = {
        id, type: 'group',
        ...motionProps(b, ctx),
      };
      group.children = [
        {
          id: `${id}-box`, type: 'rect', width: w, height: h, x: 0, y: 0,
          fill: 'rgba(0,0,0,0)', stroke: color(b.stroke ?? 'accent', P), strokeWidth: num(b.strokeWidth, 3),
        },
        {
          id: `${id}-t`, type: 'text', text: String(b.text ?? '').toUpperCase(),
          fontFamily: b.face ?? ctx.faces.mono, fontSize: size, fontWeight: 700,
          letterSpacing: num(b.letterSpacing, 1.5), textTransform: 'uppercase',
          fill: fillOf(b.fill ?? 'accent', P), textAlign: 'center',
          maxWidth: w - 16, x: 8, y: (h - size * 1.1 * String(b.text ?? '').split('\n').length) / 2,
        },
      ];
      return [group];
    }
    case 'ticker': {
      const bandH = num(b.h, 72);
      const size = num(b.size, 20);
      const sep = b.separator ?? '   •   ';
      const items = Array.isArray(b.items) ? b.items : String(b.items ?? '').split(b.split ?? '|');
      const text = items.join(sep) + sep;
      const style = {
        fontFamily: b.face ?? ctx.faces.mono, fontSize: size, fontWeight: b.weight ?? 700,
        letterSpacing: num(b.letterSpacing, 2), textTransform: 'uppercase',
      };
      const tw = ctx.measure.measure(text, style).width + style.letterSpacing * Math.max(0, text.length - 1);
      const speed = num(b.speed, 80);
      const period = Math.max(0.5, tw / speed);
      const group = {
        id, type: 'group',
        ...motionProps(b, ctx, { x: num(b.x, 0), y: num(b.y, 0) }),
        clip: { x: 0, y: 0, width: num(b.w, ctx.W), height: bandH },
      };
      if (b.fill) {
        group.children = [{ id: `${id}-bg`, type: 'rect', width: num(b.w, ctx.W), height: bandH, x: 0, y: 0, fill: fillOf(b.fill, P) }];
      } else group.children = [];
      const mfn = motionFns({ loop: { type: 'marquee', distance: tw, period, phase: 0 } }, ctx.clipDur);
      const tx = bake((t) => mfn(t).x, ctx);
      group.children.push({
        id: `${id}-a`, type: 'text', text,
        ...style, fill: fillOf(b.textFill ?? 'bg', P),
        x: tx, y: (bandH - size * 1.1) / 2,
      });
      group.children.push({
        id: `${id}-b`, type: 'text', text,
        ...style, fill: fillOf(b.textFill ?? 'bg', P),
        x: bake((t) => mfn(t).x + tw, ctx), y: (bandH - size * 1.1) / 2,
      });
      return [group];
    }
    case 'ledger': {
      const w = num(b.w, 300);
      const rowH = num(b.rowH, 54);
      const group = { id, type: 'group', ...motionProps(b, ctx, { x: num(b.x, 0), y: num(b.y, 0) }) };
      group.children = [];
      if (b.header) {
        group.children.push({
          id: `${id}-h`, type: 'text', text: String(b.header).toUpperCase(),
          fontFamily: ctx.faces.mono, fontSize: num(b.size, 13), fontWeight: 700,
          letterSpacing: 2.2, fill: fillOf('muted', P), x: 0, y: -30,
        });
      }
      (b.rows ?? []).forEach((r, i) => {
        const y = i * rowH;
        const sub = { ...ctx, uid: `${id}.r${i}`, breakpoints: [ctx.breakpoints?.[0] ?? 0] };
        const motion = staggerIn({ in: { type: 'slideUp', dur: 0.45, at: num(b.at, 0.2), distance: 18, ease: 'power2.out' }, out: false }, i, num(b.step, 0.07));
        group.children.push({
          id: `${id}-v${i}`, type: 'text', text: String(r.value ?? ''),
          fontFamily: b.face ?? ctx.faces.display, fontSize: num(b.valueSize, 34), fontWeight: 700,
          fill: fillOf(b.valueFill ?? 'ink', P), x: 0, y,
          ...combineMotion({ x: 0, y, opacity: 1, scaleX: 1, scaleY: 1, rotation: 0 }, motion, sub),
        });
        group.children.push({
          id: `${id}-l${i}`, type: 'text', text: String(r.label ?? '').toUpperCase(),
          fontFamily: ctx.faces.mono, fontSize: num(b.labelSize, 11), fontWeight: 600,
          letterSpacing: 1.6, fill: fillOf('muted', P), x: 0, y: y + num(b.valueSize, 34) * 0.55,
          maxWidth: w, textAlign: 'right',
          ...combineMotion({ x: 0, y: y + num(b.valueSize, 34) * 0.55, opacity: 1, scaleX: 1, scaleY: 1, rotation: 0 }, motion, sub),
        });
        group.children.push({
          id: `${id}-r${i}`, type: 'rect', width: w, height: 1, x: 0, y: y + rowH - 12,
          fill: color(b.ruleColor ?? 'rgba(0,0,0,0.28)', P),
          ...combineMotion({ x: 0, y: y + rowH - 12, opacity: 1, scaleX: 1, scaleY: 1, rotation: 0 }, motion, sub),
        });
      });
      return [group];
    }
    case 'bars': {
      const w = num(b.w, 600);
      const h = num(b.h, 220);
      const gap = num(b.gap, 10);
      const values = b.values ?? [];
      const bw = num(b.barW, (w - gap * (values.length - 1)) / Math.max(1, values.length));
      const max = num(b.max, Math.max(...values, 1));
      const group = { id, type: 'group', ...motionProps(b, ctx, { x: num(b.x, 0), y: num(b.y, 0) }) };
      group.children = [];
      values.forEach((v, i) => {
        const bh = Math.max(2, (v / max) * h);
        const x = i * (bw + gap);
        const motion = staggerIn({ in: { type: 'scale', dur: 0.6, at: num(b.at, 0.1), ease: 'back.out', distance: 0 }, out: false }, i, num(b.step, 0.06));
        const mp = combineMotion({ x, y: h - bh, opacity: 1, scaleX: 1, scaleY: 1, rotation: 0 }, motion, { ...ctx, uid: `${id}.b${i}` });
        group.children.push({
          id: `${id}-b${i}`, type: 'rect', width: bw, height: bh,
          fill: fillOf(Array.isArray(b.colors) ? (b.colors[i % b.colors.length]) : (b.fill ?? 'ink'), P),
          anchorX: 0, anchorY: bh,
          ...mp,
        });
      });
      if (b.axis !== false) {
        group.children.push({
          id: `${id}-axis`, type: 'rect', width: w, height: num(b.axisW, 2), x: 0, y: h,
          fill: fillOf(b.axisColor ?? 'ink', P),
        });
      }
      return [group];
    }
    case 'timeline': {
      const w = num(b.w, 800);
      const group = { id, type: 'group', ...motionProps(b, ctx, { x: num(b.x, 0), y: num(b.y, 0) }) };
      group.children = [{
        id: `${id}-line`, type: 'rect', width: w, height: 2, x: 0, y: 0,
        fill: color(b.lineColor ?? 'rgba(0,0,0,0.35)', P),
        scaleX: bake((t) => Math.min(1, Math.max(0, t / Math.max(0.001, num(b.draw, 1.2)))), ctx),
        anchorX: 0, anchorY: 0,
      }];
      (b.nodes ?? []).forEach((n, i) => {
        const x = (num(n.at, 0.5)) * w;
        group.children.push({
          id: `${id}-n${i}`, type: 'circle', radius: num(n.r, 9), x, y: 1 - num(n.r, 9),
          fill: fillOf(n.color ?? (i === (b.nodes.length - 1) ? 'accent' : 'ink'), P),
          ...combineMotion({ x, y: 1 - num(n.r, 9), opacity: 1, scaleX: 1, scaleY: 1, rotation: 0 },
            { in: { type: 'scale', dur: 0.35, at: num(b.at, 0.2) + i * num(b.step, 0.14), ease: 'back.out' }, out: false }, ctx),
        });
        group.children.push({
          id: `${id}-y${i}`, type: 'text', text: String(n.label ?? ''), fontFamily: ctx.faces.display,
          fontSize: num(b.labelSize, 34), fontWeight: 700, fill: fillOf('ink', P),
          x: x - 2, y: 22,
          ...combineMotion({ x: x - 2, y: 22, opacity: 1, scaleX: 1, scaleY: 1, rotation: 0 },
            { in: { type: 'rise', dur: 0.4, at: num(b.at, 0.2) + i * num(b.step, 0.14), distance: 14, ease: 'power2.out' }, out: false }, ctx),
        });
        if (n.sub) {
          group.children.push({
            id: `${id}-s${i}`, type: 'text', text: String(n.sub).toUpperCase(), fontFamily: ctx.faces.mono,
            fontSize: num(b.subSize, 11), letterSpacing: 1.4, fill: fillOf('muted', P),
            x: x - 2, y: 66, maxWidth: w, textAlign: 'left',
            ...combineMotion({ x: x - 2, y: 66, opacity: 0.9, scaleX: 1, scaleY: 1, rotation: 0 },
              { in: { type: 'fade', dur: 0.4, at: num(b.at, 0.2) + i * num(b.step, 0.14) + 0.08 }, out: false }, ctx),
          });
        }
      });
      return [group];
    }
    case 'cta': {
      if (ctx.hideText) return [];
      const w = num(b.w, 300);
      const h = num(b.h, 72);
      const group = { id, type: 'group', ...motionProps(b, ctx, { x: num(b.x, 0), y: num(b.y, 0) }) };
      group.children = [{
        id: `${id}-bg`, type: 'rrect', width: w, height: h, radius: h / 2, x: 0, y: 0,
        fill: fillOf(b.fill ?? 'ink', P),
      }, {
        id: `${id}-t`, type: 'text', text: String(b.text ?? ''), fontFamily: b.face ?? ctx.faces.mono,
        fontSize: num(b.size, 20), fontWeight: 700, letterSpacing: num(b.letterSpacing, 1.4),
        textTransform: 'uppercase', fill: fillOf(b.textFill ?? 'bg', P),
        x: num(b.padX, 26), y: (h - num(b.size, 20) * 1.1) / 2,
      }];
      if (b.arrow !== false) {
        group.children.push({
          id: `${id}-a`, type: 'text', text: '→', fontFamily: b.face ?? ctx.faces.body,
          fontSize: num(b.arrowSize, 26), fontWeight: 700, fill: fillOf(b.textFill ?? 'bg', P),
          x: w - num(b.padX, 26) - 18, y: (h - num(b.size, 20) * 1.1) / 2,
        });
      }
      return [group];
    }
    case 'atmosphere': {
      const blobs = b.blobs ?? [];
      return blobs.map((blob, i) => {
        const r = num(blob.r, 120);
        const motion = {
          in: { type: 'fade', dur: num(blob.fade, 1.2), at: num(blob.at, 0), ease: 'power1.out' },
          out: false,
          loop: { type: 'float', amp: num(blob.float, 12), period: num(blob.period, 9), phase: i * 1.7 },
        };
        const node = {
          id: `${id}.blob${i}`,
          type: 'circle',
          radius: r,
          fill: fillOf(blob.color ?? 'accent', P),
          opacity: num(blob.opacity, 0.5),
          filter: { blur: num(blob.blur, 80) },
          ...motionProps({ ...blob, motion }, ctx),
        };
        return node;
      });
    }
    case 'grain': {
      const node = {
        id, type: 'image', src: 'grain',
        x: 0, y: 0, width: ctx.W, height: ctx.H, fit: 'fill',
        opacity: num(b.opacity, 0.09),
        blendMode: 'overlay',
        ...motionProps(b, ctx, { x: 0, y: 0 }),
      };
      return [node];
    }
    case 'wipe': {
      const w = num(b.w, 300);
      const node = {
        id, type: 'rect', width: w, height: ctx.H * 1.3, x: num(b.x, -w), y: num(b.y, -ctx.H * 0.15),
        fill: fillOf(b.fill ?? 'accent', P), skewX: num(b.skew, -10),
        ...motionProps(b, ctx),
      };
      return [node];
    }
    case 'progress': {
      const h = num(b.h, 8);
      return [{
        id, type: 'rect', width: ctx.W, height: h, x: 0, y: ctx.H - h,
        fill: fillOf(b.fill ?? 'accent', P),
        anchorX: 0, anchorY: 0,
        scaleX: bake((t) => Math.min(1, Math.max(0, t / Math.max(0.001, ctx.totalDur))), { ...ctx, clipDur: ctx.totalDur, frameOffset: 0 }),
      }];
    }
    case 'raw':
      if (!b.node || typeof b.node !== 'object') throw new Error(`block ${id}: raw needs node`);
      return [JSON.parse(JSON.stringify(b.node))];
    case 'explain':
      return compileExplain(b, { ...ctx, uid: id }, { fillOf, color });
    case 'video': {
      const w = num(b.w, ctx.W);
      const h = num(b.h, ctx.H);
      const frames = Array.isArray(b.frames) ? b.frames.filter(Boolean) : [];
      if (!frames.length) throw new Error(`block ${id}: video needs frames`);
      const fps = Math.max(1, num(b.fps, 8));
      const start = num(b.start, 0);
      const group = {
        id, type: 'group', ...motionProps(b, ctx),
        clip: { x: 0, y: 0, width: w, height: h, ...(b.radius ? { radius: num(b.radius, 0) } : {}) },
      };
      group.children = frames.map((src, i) => {
        const from = start + i / fps;
        const to = start + (i + 1) / fps;
        const node = {
          id: `${id}-f${i}`, type: 'image', src, x: 0, y: 0, width: w, height: h, fit: b.fit ?? 'cover',
          opacity: bake((t) => (t >= from && t < to ? 1 : 0), ctx, { step: 1 }),
        };
        if (b.grayscale) node.filter = { grayscale: num(b.grayscale, 1) };
        if (b.contrast) node.filter = { ...(node.filter ?? {}), contrast: num(b.contrast, 1) };
        if (b.brightness) node.filter = { ...(node.filter ?? {}), brightness: num(b.brightness, 1) };
        return node;
      });
      if (b.tint) group.children.push({ id: `${id}-tint`, type: 'rect', width: w, height: h, x: 0, y: 0, fill: color(b.tint.color ?? 'accent', P), opacity: num(b.tint.opacity, 0.18), blendMode: b.tint.blend ?? 'multiply' });
      if (b.vignette) group.children.push({ id: `${id}-vg`, type: 'rect', width: w, height: h, x: 0, y: 0, opacity: num(b.vignette, 0.4), fill: { kind: 'radial', from: { x: w / 2, y: h / 2, r: 0 }, to: { x: w / 2, y: h / 2, r: Math.hypot(w, h) / 2 }, stops: [{ offset: 0.55, color: 'rgba(0,0,0,0)' }, { offset: 1, color: 'rgba(0,0,0,1)' }] } });
      return [group];
    }
    case 'calendarFlip':
    case 'counterRoll':
    case 'beforeAfter':
    case 'receipt':
    case 'photoCam':
    case 'cardStack':
    case 'track':
      return compileMechanic(b, { ...ctx, uid: id }, { fillOf, color, compile: compileList });
    default:
      throw new Error(`Unknown block type "${b.type}" (id ${id})`);
  }
};

export const compileBlocks = (list, ctx) => compileList(list, ctx, ctx.uid ?? 'b');

export { TAU, measureWidth, textSize };


import { bake } from './motion.mjs';
import { compileBlocks, fillOf, color } from './blocks.mjs';

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

const DEFAULT_PALETTE = {
  bg: '#101014',
  ink: '#f4f4f5',
  accent: '#ff4d3d',
  accent2: '#2f7bff',
  muted: 'rgba(244,244,245,0.55)',
  paper: '#EFE6D5',
};

const DEFAULT_FACES = { display: 'Inter', body: 'Inter', mono: 'IBM Plex Mono', serif: 'Rozha One' };

export const validateSpec = (spec) => {
  if (!spec || typeof spec !== 'object') throw new Error('spec must be an object');
  if (!spec.canvas) throw new Error('spec.canvas is required');
  const { w, h, fps = 30 } = spec.canvas;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 || w % 2 || h % 2) {
    throw new Error(`canvas must be even positive integers (got ${w}x${h})`);
  }
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error(`fps must be an integer 1..120 (got ${fps})`);
  const duration = num(spec.duration, 0);
  if (!(duration > 0)) throw new Error('spec.duration (seconds) must be > 0');
  if (!Array.isArray(spec.layers) || spec.layers.length === 0) throw new Error('spec.layers must be a non-empty array');
  const seen = new Set();
  spec.layers.forEach((l, i) => {
    if (!l || typeof l !== 'object') throw new Error(`layers[${i}] must be an object`);
    const from = num(l.from, 0);
    const dur = num(l.duration, duration - from);
    if (from < 0 || dur <= 0 || from + dur > duration + 1e-6) {
      throw new Error(`layers[${i}] range [${from}, ${from + dur}] is outside duration ${duration}`);
    }
    if (l.id !== undefined) {
      if (seen.has(l.id)) throw new Error(`duplicate layer id "${l.id}"`);
      seen.add(l.id);
    }
    if (!Array.isArray(l.blocks)) throw new Error(`layers[${i}].blocks must be an array`);
  });
  if (spec.assets !== undefined && (typeof spec.assets !== 'object' || Array.isArray(spec.assets))) {
    throw new Error('spec.assets must be an object {id: "path"}');
  }
  return true;
};

const layerOpacity = (layer, from, dur, totalDur, fps) => {
  const fadeIn = num(layer.fadeIn, 0.35);
  const fadeOut = num(layer.fadeOut, 0.35);
  const start = from;
  const end = from + dur;
  const fn = (t) => {
    if (t < start || t > end) return 0;
    const a = fadeIn > 0 ? Math.min(1, (t - start) / fadeIn) : 1;
    const b = fadeOut > 0 ? Math.min(1, (end - t) / fadeOut) : 1;
    return Math.max(0, Math.min(a, b));
  };
  return bake(fn, { fps, clipDur: totalDur, frameOffset: 0 });
};

const keyframes = (frames, values, ease = 'smooth') => ({
  binding: 'keyframes', frames, values,
  options: { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
});

const compileTransition = (tr, ctx, id) => {
  const fps = ctx.fps;
  const at = Math.round(num(tr.at, 0) * fps);
  const dur = Math.max(2, Math.round(num(tr.duration, 0.55) * fps));
  const half = Math.round(dur / 2);
  const col = color(tr.color ?? 'accent', ctx.pal);
  switch (tr.type) {
    case 'wipe': {
      const w = num(tr.w, Math.round(ctx.W * 0.38));
      const nodes = [{
        id: `${id}-a`, type: 'rect', width: w, height: Math.round(ctx.H * 1.12),
        x: keyframes([at - half, at + half], [-w * 1.5, ctx.W + w * 1.9]),
        y: -Math.round(ctx.H * 0.06), fill: col, skewX: num(tr.skew, -9),
      }];
      if (tr.edge !== false) {
        nodes.push({
          id: `${id}-b`, type: 'rect', width: Math.max(6, Math.round(w * 0.06)), height: Math.round(ctx.H * 1.12),
          x: keyframes([at - half, at + half], [-w * 1.5 + w, ctx.W + w * 1.9 + w]),
          y: -Math.round(ctx.H * 0.06), fill: color(tr.edgeColor ?? 'ink', ctx.pal), skewX: num(tr.skew, -9),
        });
      }
      return nodes;
    }
    case 'flash':
    case 'dip': {
      const peak = tr.type === 'dip' ? 0.9 : 1;
      return [{
        id: `${id}-f`, type: 'rect', width: ctx.W, height: ctx.H, x: 0, y: 0, fill: col,
        opacity: keyframes([at - half, at, at + half], [0, peak, 0]),
      }];
    }
    case 'band': {
      const bh = Math.round(ctx.H * 0.5);
      return [0, 1].map((k) => ({
        id: `${id}-k${k}`, type: 'rect', width: ctx.W, height: bh, x: 0,
        y: keyframes([at - half, at, at + half], [k === 0 ? -bh : ctx.H, k === 0 ? 0 : ctx.H - bh, k === 0 ? ctx.H : -bh]),
        fill: k === 0 ? col : color(tr.color2 ?? 'ink', ctx.pal),
      }));
    }
    case 'cut':
      return [];
    default:
      throw new Error(`Unknown transition type "${tr.type}"`);
  }
};

export const compileHyper = (spec, { scale = 1, measure, hideText = false } = {}) => {
  if (!measure || typeof measure.measure !== 'function') {
    throw new Error('compileHyper needs a TextMeasurer (createSkiaMeasurer())');
  }
  validateSpec(spec);
  const W = spec.canvas.w;
  const H = spec.canvas.h;
  const fps = num(spec.canvas.fps, 30);
  const totalDur = num(spec.duration, 0);
  const totalFrames = Math.max(1, Math.round(totalDur * fps));
  const pal = { ...DEFAULT_PALETTE, ...(spec.palette ?? {}) };
  const faces = { ...DEFAULT_FACES, ...(spec.faces ?? {}) };
  const ctx = {
    W, H, fps, pal, faces, measure, hideText,
    totalDur, totalFrames, clipDur: totalDur, frameOffset: 0, breakpoints: [],
  };

  const rootChildren = [];
  spec.layers.forEach((layer, i) => {
    const from = num(layer.from, 0);
    const dur = num(layer.duration, totalDur - from);
    const frameOffset = Math.round(from * fps);
    const breakpoints = [from, from + dur, from + num(layer.fadeIn, 0.35), from + dur - num(layer.fadeOut, 0.35)];
    const lctx = { ...ctx, clipDur: dur, frameOffset, breakpoints, uid: `L${i}` };
    const blocks = compileBlocks(layer.blocks, lctx);
    if (blocks.length === 0) return;
    const container = {
      id: `layer-${i}`,
      type: 'group',
      x: 0, y: 0,
      children: blocks,
    };
    const op = layerOpacity(layer, from, dur, totalDur, fps);
    if (op !== 1) container.opacity = op;
    if (layer.blend) container.blendMode = layer.blend;
    rootChildren.push(container);
  });

  const transitions = spec.transitions ?? [];
  if (transitions.length > 0) {
    const nodes = [];
    transitions.forEach((tr, i) => nodes.push(...compileTransition(tr, ctx, `T${i}`)));
    if (nodes.length > 0) rootChildren.push({ id: 'transitions', type: 'group', x: 0, y: 0, children: nodes });
  }

  if (spec.chrome && Array.isArray(spec.chrome.blocks) && spec.chrome.blocks.length > 0) {
    const cctx = { ...ctx, clipDur: totalDur, frameOffset: 0, uid: 'C' };
    rootChildren.push({
      id: 'chrome',
      type: 'group',
      x: 0, y: 0,
      children: compileBlocks(spec.chrome.blocks, cctx),
    });
  }

  if (spec.grain) {
    const g = spec.grain === true ? {} : spec.grain;
    rootChildren.push({
      id: 'grain',
      type: 'image',
      src: 'grain',
      width: W, height: H,
      fit: 'fill',
      opacity: num(g.opacity, 0.07),
      blendMode: 'overlay',
      x: bake((t) => (num(g.drift, 0) * t) % 7, { fps, clipDur: totalDur, frameOffset: 0 }),
      y: bake((t) => (num(g.drift, 0) * t * 0.7) % 7, { fps, clipDur: totalDur, frameOffset: 0 }),
    });
  }

  const root = {
    id: 'root',
    type: 'container',
    x: 0, y: 0,
    children: rootChildren,
  };
  if (scale !== 1) {
    root.scaleX = scale;
    root.scaleY = scale;
    root.anchorX = 0;
    root.anchorY = 0;
  }

  const plan = {
    composition: {
      id: spec.id ?? 'custom-hyper',
      width: scale === 1 ? W : Math.round(W * scale),
      height: scale === 1 ? H : Math.round(H * scale),
      fps,
      durationInFrames: totalFrames,
      root,
    },
    timeline: {
      kind: 'sequence',
      from: 0,
      durationInFrames: totalFrames,
      children: [{ kind: 'leaf', ref: 'root' }],
    },
  };

  return { plan, totalFrames, fps, width: plan.composition.width, height: plan.composition.height };
};

export { fillOf };

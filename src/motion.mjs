
import { easeFn } from './ease.mjs';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, u) => a + (b - a) * u;
const TAU = Math.PI * 2;

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

const DEF_IN = { type: 'fade', dur: 0.55, at: 0, ease: 'power2.out', distance: 44 };
const DEF_OUT = { type: 'fade', dur: 0.45, ease: 'power2.in', distance: 30 };

export const normalizeMotion = (motion) => {
  if (motion === undefined || motion === null) {
    return { in: null, out: null, loop: null, kenBurns: null, keyframes: null };
  }
  const m = motion;
  return {
    in: m.in === false ? null : { ...DEF_IN, ...(m.in ?? {}) },
    out: m.out === false ? null : { ...DEF_OUT, ...(m.out ?? {}) },
    loop: m.loop ?? null,
    kenBurns: m.kenBurns ?? null,
    keyframes: Array.isArray(m.keyframes) ? m.keyframes : null,
  };
};

const offsetFor = (type, k, distance, sign) => {
  let dx = 0;
  let dy = 0;
  let scale = 1;
  let blur = 0;
  switch (type) {
    case 'fade':
    case 'none':
      break;
    case 'rise':
    case 'maskUp':
      dy = distance * k * sign;
      break;
    case 'drop':
      dy = -distance * k * sign;
      break;
    case 'slideLeft':
      dx = distance * k * sign;
      break;
    case 'wipe':
      dx = distance * k * sign;
      break;
    case 'slideRight':
      dx = -distance * k * sign;
      break;
    case 'slideUp':
      dy = distance * k * sign;
      break;
    case 'slideDown':
      dy = -distance * k * sign;
      break;
    case 'scale':
      scale = 1 - 0.1 * k * (sign > 0 ? 1 : 1);
      break;
    case 'blurIn':
      blur = 14 * k;
      break;
    default:
      throw new Error(`Unknown motion type "${type}"`);
  }
  return { dx, dy, scale, blur };
};

export const motionFns = (motion, clipDur) => {
  const m = normalizeMotion(motion);
  const base = { x: 0, y: 0, opacity: 1, scaleX: 1, scaleY: 1, rotation: 0, blur: 0 };
  const kf = m.keyframes;

  const inP = (t) => {
    if (!m.in) return 1;
    return easeFn(m.in.ease)(clamp01((t - num(m.in.at, 0)) / Math.max(0.001, num(m.in.dur, 0.55))));
  };
  const outP = (t) => {
    if (!m.out) return 0;
    const dur = Math.max(0.001, num(m.out.dur, 0.45));
    const at = m.out.at !== undefined ? num(m.out.at, clipDur - dur) : clipDur - dur;
    return easeFn(m.out.ease)(clamp01((t - at) / dur));
  };

  return (t) => {
    if (kf && kf.length > 0) {
      const sorted = kf;
      let a = sorted[0];
      let b = sorted[sorted.length - 1];
      for (let i = 0; i < sorted.length - 1; i += 1) {
        if (t >= sorted[i].at && t <= sorted[i + 1].at) { a = sorted[i]; b = sorted[i + 1]; break; }
      }
      const span = Math.max(0.0001, b.at - a.at);
      const u = clamp01((t - a.at) / span);
      const pick = (k) => {
        const av = a[k];
        const bv = b[k];
        if (av === undefined && bv === undefined) return base[k];
        if (av === undefined) return bv;
        if (bv === undefined) return av;
        return lerp(av, bv, u);
      };
      const sa = num(a.scale, 1);
      const sb = num(b.scale, 1);
      const ra = num(a.rotation, 0);
      const rb = num(b.rotation, 0);
      const ba = num(a.blur, 0);
      const bb = num(b.blur, 0);
      return {
        x: pick('x'),
        y: pick('y'),
        opacity: clamp01(pick('opacity')),
        scaleX: lerp(sa, sb, u),
        scaleY: lerp(sa, sb, u),
        rotation: lerp(ra, rb, u),
        blur: lerp(ba, bb, u),
      };
    }

    const pi = inP(t);
    const po = outP(t);
    const oi = m.in ? offsetFor(m.in.type, 1 - pi, num(m.in.distance, 44), 1) : { dx: 0, dy: 0, scale: 1, blur: 0 };
    const oo = m.out ? offsetFor(m.out.type, po, num(m.out.distance, 30), -1) : { dx: 0, dy: 0, scale: 1, blur: 0 };

    let x = oi.dx + oo.dx;
    let y = oi.dy + oo.dy;
    let sx = oi.scale * oo.scale;
    let sy = sx;
    let rot = 0;
    let blur = oi.blur;
    let opacity = (m.in ? pi : 1) * (m.out ? 1 - po : 1);

    const lp = m.loop;
    if (lp) {
      const phase = num(lp.phase, 0);
      const amp = num(lp.amp, 10);
      const period = Math.max(0.2, num(lp.period, 4));
      const w = TAU * (t / period) + phase;
      switch (lp.type) {
        case 'float': y += amp * Math.sin(w); break;
        case 'sway': x += amp * Math.sin(w); break;
        case 'pulse': { const p = 1 + (amp / 100) * Math.sin(w); sx *= p; sy *= p; break; }
        case 'spin': rot += (360 * t) / period; break;
        case 'drift': x += num(lp.dx, amp) * (t / Math.max(0.001, clipDur)); y += num(lp.dy, 0) * (t / Math.max(0.001, clipDur)); break;
        case 'marquee': {
          const dist = num(lp.distance, 600);
          const u = ((t + phase) % period) / period;
          x += -u * dist;
          break;
        }
        default: throw new Error(`Unknown loop type "${lp.type}"`);
      }
    }

    if (m.kenBurns) {
      const k = clamp01(t / Math.max(0.001, clipDur));
      const s = num(m.kenBurns.from, 1) + (num(m.kenBurns.to, 1.08) - num(m.kenBurns.from, 1)) * k;
      sx *= s;
      sy *= s;
    }

    return { x, y, opacity, scaleX: sx, scaleY: sy, rotation: rot, blur };
  };
};

export const bake = (fn, ctx, { frameOffset = ctx.frameOffset ?? 0, step, min = 0, max = ctx.clipDur, round = false } = {}) => {
  const fps = ctx.fps;
  const s = step ?? Math.max(1, Math.round(fps / 15));
  const times = [];
  const push = (t) => {
    const c = Math.min(max, Math.max(min, t));
    if (!times.includes(c)) times.push(c);
  };
  push(min);
  push(max);
  for (let t = min; t <= max; t += s / fps) push(t);
  if (ctx.breakpoints) for (const b of ctx.breakpoints) if (b >= min && b <= max) push(b);
  times.sort((a, b) => a - b);

  const values = times.map((t) => fn(t));
  if (values.every((v) => v === values[0])) return round ? Math.round(values[0]) : values[0];

  const frames = times.map((t) => frameOffset + Math.round(t * fps));
  const keptFrames = [];
  const keptValues = [];
  for (let i = 0; i < frames.length; i += 1) {
    if (keptFrames.length > 0 && frames[i] <= keptFrames[keptFrames.length - 1]) continue;
    keptFrames.push(frames[i]);
    keptValues.push(round ? Math.round(values[i]) : Math.round(values[i] * 1000) / 1000);
  }
  return { binding: 'keyframes', frames: keptFrames, values: keptValues, options: { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } };
};

export const sampleMotion = (motion, ctx) => {
  const fn = motionFns(motion, ctx.clipDur);
  const b = (pick, round = false) => bake((t) => pick(fn(t)), ctx, { round });
  return {
    x: b((v) => v.x),
    y: b((v) => v.y),
    opacity: b((v) => v.opacity),
    scaleX: b((v) => v.scaleX),
    scaleY: b((v) => v.scaleY),
    rotation: b((v) => v.rotation),
    blur: b((v) => v.blur),
  };
};

export const combineMotion = (base, motion, ctx) => {
  const fn = motionFns(motion, ctx.clipDur);
  const b = (pick, extra = 0) => bake((t) => pick(fn(t)) + extra, ctx);
  const out = {};
  const x = b((v) => v.x, base.x ?? 0);
  const y = b((v) => v.y, base.y ?? 0);
  const rot = b((v) => v.rotation, base.rotation ?? 0);
  const op = bake((t) => (base.opacity ?? 1) * fn(t).opacity, ctx);
  const sx = bake((t) => (base.scaleX ?? 1) * fn(t).scaleX, ctx);
  const sy = bake((t) => (base.scaleY ?? 1) * fn(t).scaleY, ctx);
  const bl = b((v) => v.blur, base.blur ?? 0);
  if (x !== 0) out.x = x;
  if (y !== 0) out.y = y;
  if (rot !== 0) out.rotation = rot;
  if (op !== 1) out.opacity = op;
  if (sx !== 1) out.scaleX = sx;
  if (sy !== 1) out.scaleY = sy;
  if (bl !== 0) out.blur = bl;
  return out;
};

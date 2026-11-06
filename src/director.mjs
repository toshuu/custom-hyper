import { createHash } from 'node:crypto';
import { visualScene } from './scenes.mjs';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
const chance = (rng, p) => rng() < p;
const between = (rng, a, b) => a + rng() * (b - a);
const pad2 = (n) => String(n).padStart(2, '0');

export const hash32 = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const clean = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const clipWords = (v, n, max = 200) => clean(v, max).split(' ').slice(0, n).join(' ').trim();
const slugify = (v) => clean(v, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'film';

const parseHex = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) return '#' + s.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{6}$/i.test(s)) return '#' + s.toLowerCase();
  return null;
};

const rgbOf = (hex) => {
  const h = parseHex(hex) ?? '#000000';
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};

const hexOf = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

const mix = (a, b, t) => {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return hexOf(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};

const luminance = (hex) => {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const rgbToHsl = (hex) => {
  const [r0, g0, b0] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r0) h = (g0 - b0) / d + (g0 < b0 ? 6 : 0);
    else if (max === g0) h = (b0 - r0) / d + 2;
    else h = (r0 - g0) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
};

const hslToHex = (h, s, l) => {
  const hh = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return hexOf(f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255);
};

const shiftHue = (hex, deg, satMul = 1, lightAdd = 0) => {
  const [h, s, l] = rgbToHsl(hex);
  return hslToHex(h + deg, clamp(s * satMul, 0.2, 1), clamp(l + lightAdd, 0.08, 0.92));
};

const rgba = (hex, a) => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
};

const KINDS = new Set(['hook', 'statement', 'stat', 'list', 'quote', 'cta', 'contrast']);
const SHOTS = new Set(['evidence', 'number', 'person', 'product', 'place', 'diagram', 'text', 'action', 'contrast', 'texture']);
const LAYOUTS = ['poster', 'stack', 'split', 'rail', 'grid', 'brutal', 'minimal', 'quote'];
const COMPOSITIONS = new Set(['single', 'split', 'panorama', 'diagram', 'grid', 'stack', 'type', 'object', 'portrait']);
const REVEALS = new Set(['maskUp', 'wipe', 'scale', 'slideLeft', 'slideRight', 'slideUp', 'blurIn', 'fade', 'rise', 'cut']);
const MECHANICS = new Set(['calendarFlip', 'counterRoll', 'beforeAfter', 'receipt', 'photoCam', 'cardStack', 'track']);
const EXPLAINS = new Set(['flight', 'spiral', 'zoom', 'map', 'growth', 'compare', 'process', 'orbit', 'timeline']);
const parseParams = (v) => {
  if (!v) return {};
  if (typeof v === 'object' && !Array.isArray(v)) return v;
  try {
    const j = JSON.parse(String(v));
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch { return {}; }
};
const CAMERA = new Set(['static', 'whip-pan', 'dolly-in', 'push-in', 'tracking', 'parallax', 'handheld', 'crane']);
const TEXTURES = new Set(['clean', 'rain', 'grain', 'smoke', 'dust', 'halftone', 'scanlines']);
const LIGHTS = new Set(['natural', 'neon', 'studio', 'golden', 'overcast', 'hard', 'soft', 'night']);
const BG_VARIANTS = ['void', 'rings', 'stripes', 'grid', 'blocks', 'dots', 'orbit'];
const CHROME_VARIANTS = ['minimal', 'magazine', 'technical', 'ticker', 'none'];
const DISPLAY_FACES = ['Bebas Neue', 'Space Grotesk', 'Poppins', 'Rozha One', 'Inter', 'Manrope'];
const BODY_FACES = ['Inter', 'Manrope', 'Poppins'];

const PROFILES = {
  calm: { id: 'calm', ease: 'power3.out', inDur: 0.85, outDur: 0.55, distance: 34, stagger: 0.1, loop: 'float', trans: ['dip', 'wipe'], grain: 0.055 },
  punchy: { id: 'punchy', ease: 'back.out', inDur: 0.45, outDur: 0.35, distance: 58, stagger: 0.045, loop: 'pulse', trans: ['flash', 'band', 'wipe'], grain: 0.075 },
  float: { id: 'float', ease: 'expo.out', inDur: 0.8, outDur: 0.6, distance: 26, stagger: 0.11, loop: 'sway', trans: ['wipe', 'dip'], grain: 0.05 },
  mechanical: { id: 'mechanical', ease: 'power2.out', inDur: 0.36, outDur: 0.3, distance: 44, stagger: 0.035, loop: 'drift', trans: ['band', 'cut'], grain: 0.085 },
  sweep: { id: 'sweep', ease: 'expo.inOut', inDur: 0.7, outDur: 0.45, distance: 90, stagger: 0.08, loop: 'float', trans: ['wipe', 'band'], grain: 0.06 },
};

const typeHint = (hint) => {
  const h = clean(hint, 40).toLowerCase();
  if (h.includes('editorial') || h.includes('magazine')) return ['Rozha One', 'Bebas Neue'];
  if (h.includes('brutal') || h.includes('raw')) return ['Bebas Neue', 'Space Grotesk'];
  if (h.includes('soft') || h.includes('warm')) return ['Poppins', 'Manrope'];
  if (h.includes('technical') || h.includes('lab')) return ['Space Grotesk', 'Inter'];
  if (h.includes('luxury') || h.includes('quiet')) return ['Rozha One', 'Inter'];
  return DISPLAY_FACES;
};

export const normalizeBeat = (b, i, total, brief = '') => {
  if (!b || typeof b !== 'object') throw new Error(`beat ${i} is not an object`);
  const kindRaw = clean(b.kind, 20).toLowerCase();
  const kind = KINDS.has(kindRaw) ? kindRaw : (i === 0 ? 'hook' : i === total - 1 ? 'cta' : 'statement');
  const shotRaw = clean(b.shot, 20).toLowerCase();
  const shot = SHOTS.has(shotRaw) ? shotRaw : (kind === 'stat' ? 'number' : kind === 'quote' ? 'text' : 'evidence');
  const layoutRaw = clean(b.layout, 20).toLowerCase();
  const compRaw = clean(b.composition, 20).toLowerCase();
  const job = clean(b.job || kind, 20).toLowerCase();
  const kicker = clean(b.kicker, 40) || ({
    hook: 'THE HOOK', proof: 'THE PROOF', turn: 'THE TURN', action: 'NEXT STEP',
    stat: 'THE MEASURE', list: 'THE BREAKDOWN', quote: 'IN ONE LINE', contrast: 'BEFORE / AFTER', cta: 'NEXT STEP',
  }[job] ?? '');
  return {
    kind,
    job,
    visual: clipWords(b.visual, 12, 100),
    shot,
    layout: ['poster', 'stack', 'split', 'rail', 'grid', 'brutal', 'minimal', 'quote', 'contrast', 'cta'].includes(layoutRaw) ? layoutRaw : '',
    composition: COMPOSITIONS.has(compRaw) ? compRaw : '',
    motion: CAMERA.has(clean(b.motion, 20).toLowerCase()) ? clean(b.motion, 20).toLowerCase() : 'static',
    reveal: REVEALS.has(clean(b.reveal, 20)) ? clean(b.reveal, 20) : '',
    texture: TEXTURES.has(clean(b.texture, 20).toLowerCase()) ? clean(b.texture, 20).toLowerCase() : 'clean',
    lighting: LIGHTS.has(clean(b.lighting, 20).toLowerCase()) ? clean(b.lighting, 20).toLowerCase() : 'natural',
    transition: ['wipe', 'flash', 'dip', 'band', 'cut'].includes(clean(b.transition, 10).toLowerCase()) ? clean(b.transition, 10).toLowerCase() : '',
    elements: (Array.isArray(b.elements) ? b.elements : []).slice(0, 4).map((x) => clean(x, 40)).filter(Boolean),
    focal: clean(b.focal, 60),
    sound: clean(b.sound, 80),
    asset: clean(b.asset, 40),
    mechanic: MECHANICS.has(clean(b.mechanic, 24)) ? clean(b.mechanic, 24) : '',
    mparams: parseParams(b.mparams),
    explain: EXPLAINS.has(clean(b.explain, 24)) ? clean(b.explain, 24) : '',
    eparams: parseParams(b.eparams),
    support: clean(b.support, 140),
    dur: clamp(num(b.dur, 0), 0, 30),
    continuity: clean(b.continuity, 80),
    weight: clamp(num(b.weight, 1), 0.5, 2),
    kicker,
    headline: clipWords(b.headline || b.title || brief, 8, 80),
    body: clean(b.body, 180),
    vo: clean(b.vo, 240),
    items: (Array.isArray(b.items) ? b.items : []).slice(0, 5).map((x) => clean(x, 60)).filter(Boolean),
    stat: clean(b.stat, 18),
    label: clean(b.label, 50),
    source: clean(b.source, 50),
  };
};

export const normalizePlan = (raw, brief = '') => {
  if (!raw || typeof raw !== 'object') throw new Error('LLM plan is not an object');
  const source = Array.isArray(raw.beats) ? raw.beats : [];
  if (source.length < 3) throw new Error('LLM plan needs at least 3 beats');
  const beats = source.slice(0, 8).map((b, i) => normalizeBeat(b, i, source.length, brief));
  if (!beats[beats.length - 1].headline) beats[beats.length - 1].headline = clean(raw.cta || 'WATCH', 60);
  return {
    title: clipWords(raw.title || brief, 8, 60) || 'Untitled',
    logline: clean(raw.logline, 220),
    idea: clean(raw.idea, 220),
    audience: clean(raw.audience, 160),
    tension: clean(raw.tension, 180),
    proof: clean(raw.proof, 180),
    motif: clean(raw.motif, 80),
    mood: clean(raw.mood || 'editorial', 40),
    energy: clamp(num(raw.energy, 0.55), 0, 1),
    typography: clean(raw.typography || 'editorial', 40),
    art: clean(raw.art || '', 12).toLowerCase(),
    palette: raw.palette && typeof raw.palette === 'object' ? raw.palette : {},
    beats,
    cta: clean(raw.cta || 'WATCH', 30),
    ticker: (Array.isArray(raw.ticker) ? raw.ticker : []).slice(0, 8).map((x) => clean(x, 32)).filter(Boolean),
  };
};

const TASTE = {
  bgDark: { s: [0.08, 0.22], l: [0.045, 0.095] },
  bgLight: { s: [0.04, 0.14], l: [0.9, 0.96] },
  accent: { s: [0.58, 0.82], l: [0.46, 0.58] },
  accent2: { s: [0.4, 0.68], l: [0.44, 0.6] },
};

const tune = (hex, spec, hueShift = 0) => {
  const [h, s, l] = rgbToHsl(hex);
  return hslToHex(
    h + hueShift,
    clamp(s, spec.s[0], spec.s[1]),
    clamp(l, spec.l[0], spec.l[1]),
  );
};

const readable = (fg, bg, floor = 3) => {
  let out = fg;
  for (let i = 0; i < 10 && contrast(out, bg) < floor; i += 1) {
    out = luminance(bg) > 0.4 ? hslToHex(rgbToHsl(out)[0], rgbToHsl(out)[1], rgbToHsl(out)[2] - 0.06)
      : hslToHex(rgbToHsl(out)[0], rgbToHsl(out)[1], rgbToHsl(out)[2] + 0.06);
  }
  return out;
};

const makePalette = (input, seed) => {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const source = input && typeof input === 'object' ? input : {};
  const given = {
    bg: parseHex(source.bg), ink: parseHex(source.ink),
    accent: parseHex(source.accent), accent2: parseHex(source.accent2), paper: parseHex(source.paper),
  };
  const brand = source.brand === true || source.locked === true || Boolean(given.accent || given.bg || given.ink);
  if (brand) {
    const bg = given.bg ?? '#EDE6D8';
    const light = luminance(bg) > 0.42;
    let ink = given.ink ?? (light ? '#111111' : '#F7F3EA');
    if (contrast(bg, ink) < 4.5) ink = light ? '#0D0D0D' : '#F7F3EA';
    const accent = readable(given.accent ?? '#C8371E', bg, 3);
    const accent2 = given.accent2 ?? (light ? mix(ink, bg, 0.42) : mix(ink, bg, 0.5));
    const paper = given.paper ?? (light ? mix(bg, '#ffffff', 0.22) : mix(bg, '#ffffff', 0.07));
    return { bg, ink, accent, accent2, paper, muted: rgba(ink, 0.62), dim: rgba(ink, 0.14), brand: true };
  }
  const accentSeed = parseHex(source.accent) ?? parseHex(source.accent2);
  const baseHue = accentSeed ? rgbToHsl(accentSeed)[0] : between(rng, 0, 360);
  const bgSeed = parseHex(source.bg);
  const dark = bgSeed ? luminance(bgSeed) < 0.45 : chance(rng, 0.88);
  const mode = dark ? TASTE.bgDark : TASTE.bgLight;
  const bgHue = baseHue + between(rng, -14, 14) + 180;
  let bg = bgSeed
    ? tune(bgSeed, mode)
    : hslToHex(bgHue, between(rng, mode.s[0], mode.s[1]), between(rng, mode.l[0], mode.l[1]));
  if (contrast(bg, dark ? '#F4F1EA' : '#101014') < 7) {
    bg = hslToHex(bgHue, between(rng, mode.s[0], mode.s[1]), dark ? mode.l[0] : mode.l[1]);
  }
  let ink = dark ? '#F5F2E9' : '#121216';
  if (parseHex(source.ink) && contrast(parseHex(source.ink), bg) >= 7) ink = tune(parseHex(source.ink), { s: [0, 0.12], l: dark ? [0.9, 0.98] : [0.02, 0.1] });
  const accent = accentSeed
    ? readable(accentSeed, bg, 3.2)
    : readable(hslToHex(baseHue, between(rng, 0.72, 0.9), 0.54), bg, 3.2);
  const otherSeed = parseHex(source.accent2);
  let accent2 = otherSeed
    ? readable(otherSeed, bg, 2.6)
    : shiftHue(accent, pick(rng, [34, 46, 160, 186, 204]), 0.8, 0.02);
  if (contrast(accent, accent2) < 1.4 || contrast(accent2, bg) < 2) {
    accent2 = readable(shiftHue(accent, 150, 0.9, 0.06), bg, 3);
  }
  const paper = dark ? '#EDE6D8' : '#F3EDE2';
  return {
    bg,
    ink,
    accent,
    accent2,
    paper,
    muted: rgba(ink, 0.66),
    dim: rgba(ink, 0.12),
  };
};

const makeStyle = (plan, { seed, W, H, force = {} }) => {
  const rng = mulberry32(seed ^ hash32(plan.title + plan.mood));
  const energy = plan.energy;
  const palette = makePalette(plan.palette, seed);
  const look = force.look ?? force.art ?? plan.art;
  const print = look === 'cinema' ? false
    : look === 'print' ? true
      : (palette.brand === true && luminance(palette.bg) > 0.45) || plan.art === 'print';
  if (print && !palette.brand) {
    Object.assign(palette, {
      bg: '#EDE6D8', ink: '#111111', accent: '#B2331C', accent2: '#1D3FBF',
      paper: '#F4EFE4', muted: rgba('#111111', 0.62), dim: rgba('#111111', 0.14),
    });
  }
  const profileName = energy > 0.72 ? 'punchy' : energy < 0.3 ? 'calm' : pick(rng, ['calm', 'float', 'mechanical', 'sweep', 'punchy']);
  const profile = PROFILES[force.motion ?? (print ? 'mechanical' : profileName)];
  const hintFaces = typeHint(plan.typography);
  const PAIR = { 'Rozha One': 'Inter', 'Bebas Neue': 'Space Grotesk', Poppins: 'Manrope', 'Space Grotesk': 'Inter', Inter: 'Inter', Manrope: 'Manrope' };
  const display = force.display ?? (print ? 'Bebas Neue' : (chance(rng, 0.86) ? pick(rng, hintFaces) : pick(rng, DISPLAY_FACES)));
  const body = force.body ?? (print ? 'Space Grotesk' : PAIR[display] ?? pick(rng, BODY_FACES));
  const layout = force.layout ?? pick(rng, LAYOUTS);
  const background = force.background ?? (print ? 'grid' : pick(rng, BG_VARIANTS));
  const chrome = force.chrome ?? (print ? 'magazine' : pick(rng, CHROME_VARIANTS));
  const caseMode = force.caseMode ?? (display === 'Bebas Neue' ? 'upper' : pick(rng, ['upper', 'upper', 'none']));
  const signature = [layout, profile.id, background, chrome, display, palette.accent, caseMode, print ? 'print' : 'cinema', plan.structure ?? ''].join('|');
  return {
    seed, profile, palette, layout, background, chrome, caseMode, print,
    faces: { display, body, mono: 'IBM Plex Mono', serif: 'Rozha One' },
    signature,
    moodWord: clean(plan.mood, 22).toUpperCase(),
    margins: { W, H },
  };
};

const fallbackMeasure = {
  measure: (text, style) => ({ width: String(text).length * num(style.fontSize, 24) * 0.56 }),
};

const measureText = (measure, text, style) => {
  const m = measure?.measure ? measure : fallbackMeasure;
  const w = m.measure(String(text), style).width;
  return w + num(style.letterSpacing, 0) * Math.max(0, String(text).length - 1);
};

const wrap = (text, maxWidth, style, measure) => {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (!line || measureText(measure, next, style) <= maxWidth) line = next;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out.length ? out : [''];
};

const fitBlock = (text, { maxWidth, maxLines, maxHeight, face, weight = 700, startSize, minSize = 30, lineHeight = 0.95, letterSpacing = 0, transform = 'none' }, measure) => {
  let size = startSize;
  const shaped = transform === 'uppercase' ? String(text ?? '').toUpperCase() : String(text ?? '');
  for (let i = 0; i < 30; i += 1) {
    const style = { fontFamily: face, fontSize: size, fontWeight: weight, letterSpacing, textTransform: 'none' };
    const lines = wrap(shaped, maxWidth, style, measure);
    const fitsLines = lines.length <= maxLines;
    const fitsHeight = !maxHeight || size * lineHeight * Math.min(lines.length, maxLines) <= maxHeight;
    const cleanBreak = lines.every((line) => !/^[,.;:!?)]/.test(String(line).trim()));
    const widthFits = lines.every((line) => measureText(measure, line, style) <= maxWidth * 0.92);
    if ((fitsLines && fitsHeight && cleanBreak && widthFits) || size <= minSize) {
      return { text: lines.slice(0, maxLines).join('\n'), size, lines: Math.min(lines.length, maxLines), width: maxWidth };
    }
    size *= 0.93;
  }
  return { text, size: minSize, lines: maxLines, width: maxWidth };
};

const motionIn = (profile, type, at = 0.18, distance) => ({
  in: { type, at, dur: profile.inDur, ease: profile.ease, distance: distance ?? profile.distance },
  out: false,
});

const txt = (text, x, y, w, size, face, fill, extra = {}) => ({
  type: 'text', text: String(text), x, y, w, size, face, fill,
  lineHeight: extra.lineHeight ?? 1.1,
  ...extra,
});

const kicker = (text, x, y, fill, extra = {}) => ({
  type: 'kicker', text: String(text), x, y, size: extra.size ?? 18,
  letterSpacing: extra.letterSpacing ?? 2.0, fill, rule: extra.rule ?? true,
  ruleColor: extra.ruleColor ?? fill,
  ...(extra.motion ? { motion: extra.motion } : {}),
});

const rule = (x, y, w, fill, opacity = 1, extra = {}) => ({
  type: 'rule', x, y, w, h: extra.h ?? 1, fill, opacity,
  ...(extra.motion ? { motion: extra.motion } : {}),
});

const shapeField = (variant, style, W, H, rng) => {
  const { palette: p } = style;
  const children = [];
  if (variant === 'rings') {
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i += 1) {
      const d = between(rng, W * 0.32, W * 0.95);
      children.push({
        type: 'rrect', w: d, h: d, radius: d / 2,
        x: between(rng, -d * 0.45, W - d * 0.55),
        y: between(rng, -d * 0.4, H - d * 0.55),
        fill: 'transparent', stroke: i % 2 ? p.accent2 : p.accent,
        strokeWidth: between(rng, 1, 2.5), opacity: between(rng, 0.18, 0.45),
      });
    }
  } else if (variant === 'stripes') {
    const n = 5 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i += 1) {
      const vertical = chance(rng, 0.7);
      children.push({
        type: 'rect',
        w: vertical ? between(rng, 2, 18) : W * between(rng, 0.3, 0.9),
        h: vertical ? H * between(rng, 0.3, 1.1) : between(rng, 2, 18),
        x: vertical ? between(rng, 0, W) : between(rng, -W * 0.2, W * 0.2),
        y: vertical ? between(rng, -H * 0.1, H * 0.2) : between(rng, 0, H),
        fill: i % 3 === 0 ? p.accent : p.accent2,
        opacity: between(rng, 0.04, 0.14),
      });
    }
  } else if (variant === 'grid') {
    for (let i = 0; i < 6; i += 1) {
      children.push({ type: 'rule', x: 0, y: (H / 6) * i, w: W, h: 1, fill: p.ink, opacity: 0.055 });
    }
    for (let i = 0; i < 4; i += 1) {
      children.push({ type: 'rule', x: (W / 4) * i, y: 0, w: 1, h: H, fill: p.ink, opacity: 0.045 });
    }
  } else if (variant === 'blocks') {
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i += 1) {
      const w = between(rng, W * 0.35, W * 0.9);
      const h = between(rng, H * 0.12, H * 0.42);
      children.push({
        type: 'rrect', w, h, radius: between(rng, 8, 60),
        x: between(rng, -W * 0.2, W * 0.55), y: between(rng, -H * 0.1, H * 0.8),
        rotation: between(rng, -18, 18),
        fill: i % 2 ? p.accent : p.accent2,
        opacity: between(rng, 0.05, 0.13), blend: 'screen',
      });
    }
  } else if (variant === 'dots') {
    const cols = 4 + Math.floor(rng() * 4);
    const rows = 6 + Math.floor(rng() * 4);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (chance(rng, 0.35)) continue;
        children.push({
          type: 'circle', r: between(rng, 1.5, 4.5),
          x: (W / (cols + 1)) * (x + 1) + between(rng, -8, 8),
          y: (H / (rows + 1)) * (y + 1) + between(rng, -8, 8),
          fill: chance(rng, 0.2) ? p.accent : p.ink,
          opacity: between(rng, 0.12, 0.34),
        });
      }
    }
  } else if (variant === 'orbit') {
    children.push({
      type: 'circle', r: W * between(rng, 0.45, 0.7),
      x: between(rng, -W * 0.2, W * 0.3), y: between(rng, H * 0.2, H * 0.7),
      fill: p.accent, opacity: between(rng, 0.05, 0.1), blur: 60,
    });
    children.push({
      type: 'circle', r: W * between(rng, 0.2, 0.35),
      x: between(rng, W * 0.55, W * 0.9), y: between(rng, -H * 0.05, H * 0.25),
      fill: p.accent2, opacity: between(rng, 0.08, 0.16), blur: 30,
    });
  }
  return {
    type: 'group', x: 0, y: 0, opacity: 1,
    rotation: between(rng, -3, 3),
    motion: { in: { type: 'fade', at: 0, dur: 1.4, ease: 'power2.out' }, out: false, loop: { type: style.profile.loop === 'pulse' ? 'float' : style.profile.loop, amp: between(rng, 8, 18), period: between(rng, 9, 16), phase: between(rng, 0, 6) } },
    children,
  };
};

const groundLayer = (style, W, H, duration, rng) => {
  const p = style.palette;
  if (style.print) {
    const M = style.margins.M;
    const tick = Math.max(18, Math.round(M * 0.5));
    const marks = [
      { type: 'rect', x: 7, y: 7, w: W - 14, h: H - 14, fill: 'transparent', stroke: 'accent', strokeWidth: 3, opacity: 0.92 },
      { type: 'rule', x: M, y: H - M * 1.9, w: W - M * 2, h: 1, fill: 'ink', opacity: 0.32 },
      { type: 'rule', x: M, y: M * 1.9, w: W - M * 2, h: 1, fill: 'ink', opacity: 0.18 },
    ];
    for (let i = 1; i < 4; i += 1) {
      marks.push({ type: 'rule', x: (W / 4) * i, y: M * 1.9, w: 1, h: tick * 0.6, fill: 'ink', opacity: 0.32 });
    }
    marks.push(
      { type: 'rule', x: M * 0.5, y: M * 0.42, w: tick, h: 2, fill: 'accent', opacity: 0.9 },
      { type: 'rule', x: W - M * 0.5 - tick, y: M * 0.42, w: tick, h: 2, fill: 'accent', opacity: 0.9 },
      { type: 'rule', x: M * 0.5, y: H - M * 0.42 - 2, w: tick, h: 2, fill: 'accent', opacity: 0.9 },
      { type: 'rule', x: W - M * 0.5 - tick, y: H - M * 0.42 - 2, w: tick, h: 2, fill: 'accent', opacity: 0.9 },
    );
    return {
      id: 'ground', from: 0, duration, fadeIn: 0, fadeOut: 0,
      blocks: [
        { type: 'bg', fill: p.bg },
        { type: 'grain', opacity: 0.03, amount: 0.42, seed: style.seed % 89, cell: 2 },
        ...marks,
      ],
    };
  }
  const blobs = [];
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i += 1) {
    blobs.push({
      color: i % 2 ? p.accent2 : p.accent,
      x: between(rng, W * 0.05, W * 0.95),
      y: between(rng, H * 0.1, H * 0.9),
      r: between(rng, W * 0.2, W * 0.45),
      blur: between(rng, 70, 140),
      opacity: between(rng, 0.1, 0.24),
      float: between(rng, 8, 22),
      period: between(rng, 8, 18),
    });
  }
  return {
    id: 'ground', from: 0, duration, fadeIn: 0, fadeOut: 0,
    blocks: [
      { type: 'bg', top: mix(p.bg, p.accent, between(rng, 0.03, 0.09)), bottom: mix(p.bg, '#000000', 0.18) },
      { type: 'atmosphere', blobs },
      shapeField(style.background, style, W, H, rng),
    ],
  };
};

const bodyText = (beat, ctx) => {
  const text = beat.body || '';
  if (!text) return null;
  const fit = fitBlock(text, {
    maxWidth: ctx.CW * 0.88, maxLines: 4, face: ctx.style.faces.body,
    weight: 400, startSize: ctx.bodySize, minSize: 18, lineHeight: 1.38,
  }, ctx.measure);
  return { ...fit, size: fit.size };
};

const headlineBlock = (text, ctx, { x, y, w, fill, maxLines = 3, startSize, transform, at = 0.18, maxHeight, accentLast } = {}) => {
  const face = ctx.style.faces.display;
  const transformMode = transform ?? (ctx.style.caseMode === 'upper' ? 'uppercase' : 'none');
  const fit = fitBlock(text, {
    maxWidth: w ?? ctx.CW, maxLines, maxHeight, face, weight: 700,
    startSize: startSize ?? ctx.headSize, minSize: 30,
    lineHeight: face === 'Bebas Neue' ? 0.86 : 0.98,
    letterSpacing: face === 'Bebas Neue' ? -1 : 0,
    transform: transformMode,
  }, ctx.measure);
  const lh = face === 'Bebas Neue' ? 0.86 : 0.98;
  const lines = fit.text.split('\n');
  const h = Math.round(fit.size * lh * lines.length + fit.size * 0.4);
  if (ctx.style.print && lines.length > 1 && accentLast !== false) {
    const step = fit.size * lh;
    return {
      type: 'group', x: 0, y, opacity: 1,
      h, size: fit.size, lines: lines.length, text: fit.text, fit: true,
      children: lines.map((line, i) => txt(line, x, i * step, fit.width, fit.size, face, i === lines.length - 1 ? 'accent' : fill, {
        weight: 700, lineHeight: lh, letterSpacing: face === 'Bebas Neue' ? -1 : 0, transform: transformMode,
        mask: true, h: Math.round(step + fit.size * 0.4),
        motion: { in: { type: ctx.reveal && ctx.reveal !== 'cut' ? ctx.reveal : 'maskUp', at: at + i * 0.08, dur: ctx.style.profile.inDur, ease: ctx.style.profile.ease, distance: fit.size * 1.2 }, out: false },
      })),
    };
  }
  return {
    ...txt(fit.text, x, y, fit.width, fit.size, face, fill, {
      weight: 700,
      lineHeight: lh,
      letterSpacing: face === 'Bebas Neue' ? -1 : 0,
      transform: transformMode,
      mask: true,
      h,
      motion: { in: { type: ctx.reveal && ctx.reveal !== 'cut' ? ctx.reveal : 'maskUp', at, dur: ctx.style.profile.inDur, ease: ctx.style.profile.ease, distance: fit.size * 1.2 }, out: false },
    }),
  };
};

const indexBlock = (i, ctx, { x, y, size, align = 'right', opacity = 0.18 } = {}) => txt(
  pad2(i + 1), x, y, ctx.W * 0.22, size, ctx.style.faces.display, 'accent',
  { align, opacity, lineHeight: 0.8, motion: motionIn(ctx.style.profile, 'slideLeft', 0.05, 40) },
);

const stampBlock = (text, ctx, { x, y, w, h, rotation = -7 } = {}) => ({
  type: 'stamp', text, x, y, w: w ?? ctx.W * 0.3, h: h ?? ctx.W * 0.14,
  stroke: 'accent', fill: 'accent', size: Math.max(16, Math.round(ctx.W * 0.022)),
  rotation, motion: motionIn(ctx.style.profile, 'scale', 0.4, 0),
});

const bodyBlock = (body, x, y, w, ctx, { size, align = 'left', fill = 'ink', maxLines = 4, at = 0.3, opacity = 0.84 } = {}) => {
  if (!body) return null;
  const fit = fitBlock(body.text, {
    maxWidth: w, maxLines, face: ctx.style.faces.body, weight: 400,
    startSize: size ?? ctx.bodySize, minSize: 20, lineHeight: 1.38,
  }, ctx.measure);
  return txt(fit.text, x, y, w, fit.size, ctx.style.faces.body, fill, {
    lineHeight: 1.38, align, opacity, motion: motionIn(ctx.style.profile, 'rise', at, 22),
  });
};

const composePoster = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [];
  blocks.push(kicker(beat.kicker || `0${ctx.index + 1} / ${pad2(ctx.total)}`, M, top, 'accent', { motion: motionIn(style.profile, 'slideLeft', 0.05, 24) }));
  const pano = beat.composition === 'panorama';
  const hb = headlineBlock(beat.headline, ctx, {
    x: M, y: pano ? H * 0.56 : top + ctx.headSize * 0.45,
    w: CW * 0.88, fill: 'ink', maxHeight: pano ? bottom - H * 0.56 - 130 : undefined,
  });
  blocks.push(hb);
  const bodyY = hb.y + hb.h + 34;
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, M, bodyY, CW * 0.8, ctx, { at: 0.32 }));
  blocks.push(rule(M, bodyY - 22, CW * 0.18, 'accent', 1, { h: 3, motion: motionIn(style.profile, 'slideRight', 0.2, 30) }));
  blocks.push(indexBlock(ctx.index, ctx, { x: W - M - W * 0.2, y: top - 10, size: H * 0.11 }));
  if (ctx.index > 0 && chance(ctx.rng, 0.55)) blocks.push(stampBlock(style.moodWord || 'HYPER', ctx, { x: W - M - W * 0.32, y: ctx.bottom - W * 0.16, rotation: between(ctx.rng, -9, 9) }));
  return blocks;
};

const composeStack = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [];
  blocks.push(kicker(beat.kicker || beat.label || 'FIELD NOTE', M, top, 'accent', { motion: motionIn(style.profile, 'slideLeft', 0.05, 24) }));
  const headline = headlineBlock(beat.headline, ctx, { x: M, y: top + ctx.headSize * 0.42, w: CW * 0.92, fill: 'ink', maxLines: 3 });
  blocks.push(headline);
  let y = headline.y + headline.h + 30;
  const body = bodyText(beat, ctx);
  if (body) { blocks.push(bodyBlock(body, M, y, CW * 0.78, ctx, { at: 0.3 })); y += body.size * 1.38 * body.lines + 26; }
  const items = beat.items.length ? beat.items : [];
  if (items.length) {
    const rowH = Math.min(58, (bottom - y - 20) / items.length);
    items.slice(0, 4).forEach((item, i) => {
      const ry = y + i * rowH;
      blocks.push(txt(pad2(i + 1), M, ry, 44, 15, style.faces.mono, 'accent', { letterSpacing: 1.2, motion: motionIn(style.profile, 'rise', 0.38 + i * style.profile.stagger, 14) }));
      const fit = fitBlock(item, { maxWidth: CW * 0.72, maxLines: 1, face: style.faces.body, weight: 500, startSize: 22, minSize: 14, lineHeight: 1.1 }, ctx.measure);
      blocks.push(txt(fit.text, M + 54, ry - 3, CW * 0.72, fit.size, style.faces.body, 'ink', { motion: motionIn(style.profile, 'rise', 0.4 + i * style.profile.stagger, 14) }));
      blocks.push(rule(M, ry + rowH - 12, CW, 'muted', 0.35));
    });
  }
  if (!items.length || y < bottom - H * 0.16) {
    blocks.push(txt(pad2(ctx.index + 1), W - M - W * 0.18, bottom - H * 0.1, W * 0.18, H * 0.07, style.faces.display, 'accent', { align: 'right', opacity: 0.16, lineHeight: 0.8 }));
  }
  return blocks;
};

const composeSplit = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const vertical = H >= W;
  const leftW = vertical ? CW * 0.58 : CW * 0.55;
  const rightX = M + leftW + CW * 0.07;
  const rightW = CW - leftW - CW * 0.07;
  const blocks = [];
  blocks.push(kicker(beat.kicker || beat.label || 'THE READ', M, top, 'accent', { motion: motionIn(style.profile, 'slideLeft', 0.05, 24) }));
  blocks.push(headlineBlock(beat.headline, ctx, { x: M, y: top + ctx.headSize * 0.42, w: leftW, fill: 'ink', maxLines: 4 }));
  blocks.push(rule(rightX - 18, top + 8, 2, 'accent', 0.7, { h: bottom - top - 40, motion: motionIn(style.profile, 'scale', 0.2, 0) }));
  const body = bodyText(beat, ctx);
  let ry = top + 22;
  if (body) { blocks.push(bodyBlock(body, rightX, ry, rightW, ctx, { size: ctx.bodySize * 0.9, at: 0.28 })); ry += body.size * 1.38 * body.lines + 28; }
  if (beat.stat) {
    blocks.push(txt(beat.stat, rightX, ry, rightW, Math.min(H * 0.1, 84), style.faces.display, 'accent', { lineHeight: 0.9, motion: motionIn(style.profile, 'scale', 0.3, 0) }));
    blocks.push(txt(beat.label || 'AT A GLANCE', rightX, ry + Math.min(H * 0.1, 84) * 0.95, rightW, 14, style.faces.mono, 'muted', { letterSpacing: 1.6, transform: 'uppercase' }));
    ry += Math.min(H * 0.1, 84) * 1.1 + 22;
  }
  if (beat.items.length && ry < bottom - 120) {
    const rowH = Math.min(62, (bottom - ry - 20) / beat.items.length);
    beat.items.slice(0, 4).forEach((item, i) => {
      const yy = ry + i * rowH;
      const fit = fitBlock(item, { maxWidth: rightW - 40, maxLines: 1, face: style.faces.body, weight: 500, startSize: 22, minSize: 16, lineHeight: 1.1 }, ctx.measure);
      blocks.push(txt(fit.text, rightX, yy, rightW - 40, fit.size, style.faces.body, 'ink', { opacity: 0.9, motion: motionIn(style.profile, 'rise', 0.4 + i * 0.06, 14) }));
      blocks.push(rule(rightX, yy + rowH - 12, rightW, 'ink', 0.2));
    });
  }
  blocks.push(indexBlock(ctx.index, ctx, { x: W - M - W * 0.18, y: bottom - H * 0.09, size: H * 0.07, opacity: 0.24 }));
  return blocks;
};

const composeRail = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [];
  if (!beat.stat) return composeSplit(beat, ctx);
  const stat = beat.stat;
  const statSize = Math.min(H * 0.2, W * 0.34);
  const statFit = fitBlock(stat, {
    maxWidth: CW * 0.44, maxLines: 1, face: style.faces.display, weight: 700,
    startSize: statSize, minSize: 56, lineHeight: 0.8,
  }, ctx.measure);
  blocks.push(kicker(beat.kicker || beat.label || 'THE MEASURE', M, top, 'accent', { motion: motionIn(style.profile, 'slideLeft', 0.05, 24) }));
  blocks.push(txt(statFit.text, M - 4, top + H * 0.06, CW * 0.46, statFit.size, style.faces.display, 'accent', { lineHeight: 0.8, opacity: 0.95, motion: motionIn(style.profile, 'scale', 0.18, 0) }));
  if (beat.label) blocks.push(txt(beat.label, M, top + H * 0.06 + statFit.size * 1.04, CW * 0.42, 16, style.faces.mono, 'muted', { letterSpacing: 1.8, transform: 'uppercase' }));
  const hb = headlineBlock(beat.headline, ctx, { x: M + CW * 0.48, y: top + H * 0.06, w: CW * 0.52, fill: 'ink', maxLines: 4, startSize: ctx.headSize * 0.58 });
  blocks.push(hb);
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, M + CW * 0.48, hb.y + hb.h + 24, CW * 0.5, ctx, { size: ctx.bodySize * 0.85, maxLines: 3, at: 0.32 }));
  blocks.push(rule(M, bottom - 26, CW, 'muted', 0.3));
  return blocks;
};

const composeGrid = (beat, ctx) => {
  const { M, CW, top, bottom, H, style } = ctx;
  const blocks = [];
  blocks.push(kicker(beat.kicker || 'INDEX', M, top, 'accent', { motion: motionIn(style.profile, 'slideLeft', 0.05, 24) }));
  const hb = headlineBlock(beat.headline, ctx, { x: M, y: top + ctx.headSize * 0.42, w: CW * 0.9, fill: 'ink', maxLines: 2, startSize: ctx.headSize * 0.72 });
  blocks.push(hb);
  const items = (beat.items.length ? beat.items : [beat.body, beat.label, beat.source].filter(Boolean)).slice(0, 4);
  if (items.length < 2) return composeStack(beat, ctx);
  if (style.print) {
    const cols = items.length === 3 ? 3 : 2;
    const gap = CW * 0.04;
    const colW = (CW - gap * (cols - 1)) / cols;
    const gridTop = hb.y + hb.h + 46;
    items.forEach((item, i) => {
      const col = i % cols;
      const x = M + col * (colW + gap);
      blocks.push(rule(x, gridTop, colW, 'ink', 0.55, { h: 1 }));
      blocks.push(txt(pad2(i + 1), x, gridTop + 12, 48, 14, style.faces.mono, 'accent', { letterSpacing: 1.4 }));
      const fit = fitBlock(item, { maxWidth: colW, maxLines: 4, face: style.faces.body, weight: 500, startSize: 28, minSize: 18, lineHeight: 1.18 }, ctx.measure);
      blocks.push(txt(fit.text, x, gridTop + 46, colW, fit.size, style.faces.body, 'ink', { lineHeight: 1.18, motion: motionIn(style.profile, 'rise', 0.3 + i * 0.08, 16) }));
    });
    return blocks;
  }
  const cols = items.length === 3 ? 3 : 2;
  const gap = CW * 0.035;
  const cardW = (CW - gap * (cols - 1)) / cols;
  const gridTop = hb.y + hb.h + 40;
  const rows = Math.ceil(items.length / cols);
  const cardH = clamp((bottom - gridTop - gap * (rows - 1)) / rows, 160, Math.min(280, H * 0.24));
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = M + col * (cardW + gap);
    const y = gridTop + row * (cardH + gap);
    blocks.push({
      type: 'rrect', x, y, w: cardW, h: cardH, radius: 8,
      fill: 'paper', opacity: 0.08, stroke: 'ink', strokeWidth: 1.5,
      motion: motionIn(style.profile, 'rise', 0.3 + i * style.profile.stagger, 20),
    });
    blocks.push(txt(pad2(i + 1), x + 18, y + 16, 48, 15, style.faces.mono, 'accent', { letterSpacing: 1.4 }));
    const fit = fitBlock(item, { maxWidth: cardW - 36, maxLines: 5, face: style.faces.body, weight: 600, startSize: 30, minSize: 19, lineHeight: 1.2 }, ctx.measure);
    blocks.push(txt(fit.text, x + 18, y + 52, cardW - 36, fit.size, style.faces.body, 'ink', { lineHeight: 1.2, opacity: 0.94, motion: motionIn(style.profile, 'rise', 0.38 + i * style.profile.stagger, 14) }));
  });
  return blocks;
};

const composeQuote = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [];
  blocks.push(txt('“', M - 10, top - H * 0.06, CW * 0.3, H * 0.22, style.faces.serif, 'accent', { opacity: 0.24, lineHeight: 0.8 }));
  const quote = beat.body || beat.headline;
  const fit = fitBlock(quote, {
    maxWidth: CW * 0.9, maxLines: 5, face: style.faces.serif, weight: 400,
    startSize: Math.min(H * 0.062, W * 0.12), minSize: 28, lineHeight: 1.16,
  }, ctx.measure);
  blocks.push(txt(fit.text, M + CW * 0.05, top + H * 0.12, CW * 0.9, fit.size, style.faces.serif, 'ink', {
    lineHeight: 1.16, italic: true, motion: motionIn(style.profile, 'rise', 0.25, 26),
  }));
  blocks.push(rule(M + CW * 0.05, bottom - 86, CW * 0.18, 'accent', 1, { h: 2 }));
  const credit = beat.label || beat.kicker || beat.source;
  if (credit) blocks.push(txt(credit, M + CW * 0.05, bottom - 62, CW * 0.7, 13, style.faces.mono, 'muted', { letterSpacing: 1.8, transform: 'uppercase' }));
  return blocks;
};

const composeBrutal = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [];
  const bandTop = H * 0.52;
  blocks.push({
    type: 'rrect', x: 0, y: bandTop, w: W, h: H - bandTop, radius: 0,
    fill: 'accent', motion: motionIn(style.profile, 'slideUp', 0.12, 80),
  });
  blocks.push(kicker(beat.kicker || beat.label || 'NO FILTER', M, top, 'accent', { motion: motionIn(style.profile, 'slideLeft', 0.05, 24) }));
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, M, top + 52, CW * 0.78, ctx, { size: ctx.bodySize * 0.95, maxLines: 3, at: 0.24 }));
  blocks.push(headlineBlock(beat.headline, ctx, { x: M, y: bandTop + H * 0.07, w: CW, fill: 'bg', maxLines: 3, startSize: ctx.headSize * 0.8, at: 0.3, maxHeight: H - (bandTop + H * 0.07) - M * 1.2 }));
  blocks.push(txt(pad2(ctx.index + 1), W - M - 60, top - 4, 60, 18, style.faces.mono, 'accent', { align: 'right', letterSpacing: 1.2 }));
  return blocks;
};

const composeMinimal = (beat, ctx) => {
  const { W, M, CW, top, bottom, H, style } = ctx;
  const blocks = [];
  const centered = ['single', 'type', 'portrait'].includes(beat.composition);
  const x = centered ? M : M + CW * 0.1;
  const w = centered ? CW : CW * 0.8;
  const align = centered ? 'center' : 'left';
  blocks.push({ type: 'circle', r: 7, x: centered ? W / 2 - 7 : x, y: top + 6, fill: 'accent', motion: motionIn(style.profile, 'scale', 0.05, 0) });
  blocks.push(kicker(beat.kicker || beat.label || 'QUIET', centered ? x + CW * 0.4 : x + 22, top, 'muted', { rule: false, motion: motionIn(style.profile, 'fade', 0.08) }));
  const hb = headlineBlock(beat.headline, ctx, { x, y: top + H * 0.1, w, fill: 'ink', maxLines: 4, startSize: ctx.headSize * 0.82, at: 0.2 });
  hb.align = align;
  blocks.push(hb);
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, x + (centered ? CW * 0.09 : 0), hb.y + hb.h + 46, w * 0.82, ctx, { align, at: 0.35 }));
  blocks.push(rule(centered ? W / 2 - CW * 0.06 : x, bottom - H * 0.22, CW * 0.12, 'accent', 1, { h: 2 }));
  return blocks;
};

const composeContrast = (beat, ctx) => {
  const { M, CW, top, bottom, H, style } = ctx;
  const blocks = [];
  blocks.push(kicker(beat.kicker || 'BEFORE / AFTER', M, top, 'accent', { motion: motionIn(style.profile, 'slideLeft', 0.05, 24) }));
  const hb = headlineBlock(beat.headline, ctx, { x: M, y: top + ctx.headSize * 0.42, w: CW * 0.9, fill: 'ink', maxLines: 2, startSize: ctx.headSize * 0.66 });
  blocks.push(hb);
  const gap = CW * 0.04;
  const cardW = (CW - gap) / 2;
  const y = hb.y + hb.h + 42;
  const cardH = Math.max(220, Math.min(bottom - y - 20, H * 0.38));
  const items = [beat.items[0] || beat.body || 'THE OLD WAY', beat.items[1] || beat.label || ctx.plan?.cta || 'THE NEW WAY'];
  items.forEach((item, i) => {
    const x = M + i * (cardW + gap);
    blocks.push({
      type: 'rrect', x, y, w: cardW, h: cardH, radius: 8,
      fill: i ? 'accent' : 'paper', opacity: i ? 0.95 : 0.92,
      stroke: i ? 'accent' : 'ink', strokeWidth: 1.5,
      motion: motionIn(style.profile, 'rise', 0.28 + i * 0.1, 24),
    });
    const fit = fitBlock(item, { maxWidth: cardW - 36, maxLines: 5, face: style.faces.body, weight: 600, startSize: 31, minSize: 19, lineHeight: 1.22 }, ctx.measure);
    blocks.push(txt(fit.text, x + 18, y + 22, cardW - 36, fit.size, style.faces.body, i ? 'bg' : 'ink', { lineHeight: 1.22, motion: motionIn(style.profile, 'rise', 0.34 + i * 0.1, 16) }));
    blocks.push(txt(i ? 'AFTER' : 'BEFORE', x + 18, y + cardH - 34, cardW - 36, 14, style.faces.mono, i ? 'bg' : 'ink', { letterSpacing: 1.8, opacity: i ? 0.8 : 0.62 }));
  });
  return blocks;
};

const composeMechanicText = (beat, ctx) => {
  const { M, CW, top, bottom, style } = ctx;
  const blocks = [];
  blocks.push(kicker(beat.kicker || `0${ctx.index + 1} / ${pad2(ctx.total)}`, M, top, 'accent', { motion: motionIn(style.profile, 'slideLeft', 0.05, 24) }));
  blocks.push(headlineBlock(beat.headline, ctx, {
    x: M, y: top + ctx.headSize * 0.42, w: CW * 0.9, fill: 'ink', maxLines: 2, startSize: ctx.headSize * 0.72,
  }));
  const support = beat.support || beat.body || '';
  if (support) {
    blocks.push(txt(support, M, bottom - 42, CW * 0.82, Math.max(20, Math.round(ctx.bodySize * 0.8)), style.faces.body, 'muted', {
      opacity: 0.82, lineHeight: 1.25, motion: motionIn(style.profile, 'fade', 0.3),
    }));
  }
  return blocks;
};

const composeCta = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [];
  blocks.push(kicker(beat.kicker || 'NEXT STEP', M, top, 'accent', { motion: motionIn(style.profile, 'slideLeft', 0.05, 24) }));
  const hb = headlineBlock(beat.headline, ctx, { x: M, y: top + H * 0.14, w: CW * 0.68, fill: 'ink', maxLines: 3, startSize: ctx.headSize * 0.86 });
  blocks.push(hb);
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, M, hb.y + hb.h + 34, CW * 0.74, ctx, { maxLines: 2, at: 0.3 }));
  const cw = Math.min(CW * 0.58, W * 0.5);
  blocks.push({
    type: 'cta', text: ctx.plan.cta || 'WATCH', x: M, y: bottom - H * 0.12,
    w: cw, h: Math.max(58, H * 0.038), fill: 'accent', textFill: 'bg', face: 'Inter',
    size: Math.max(16, Math.round(W * 0.019)), arrow: true,
    motion: motionIn(style.profile, 'scale', 0.42, 0),
  });
  blocks.push(txt(style.moodWord || 'CUSTOM HYPER', W - M - CW * 0.3, bottom - H * 0.12 + 8, CW * 0.3, 11, style.faces.mono, 'muted', { align: 'right', letterSpacing: 1.6 }));
  return blocks;
};

const imageFor = (beat, ctx) => {
  const pool = (ctx.images ?? []);
  if (!pool.length) return null;
  const words = `${beat.visual ?? ''} ${beat.headline ?? ''} ${beat.kicker ?? ''} ${beat.body ?? ''} ${(beat.items ?? []).join(' ')} ${ctx.plan?.motif ?? ''}`.toLowerCase();
  const scored = pool.map((it) => {
    const tags = Array.isArray(it.tags) ? it.tags : [];
    const score = tags.reduce((n, t) => n + (words.includes(String(t).toLowerCase()) ? 1 : 0), 0);
    return { it, score };
  }).sort((a, b) => b.score - a.score);
  if (!scored[0] || scored[0].score === 0) return null;
  const it = scored[0].it;
  return {
    type: 'photo', src: it.asset, x: Number(it.x ?? 0), y: Number(it.y ?? 0),
    w: Number(it.w ?? ctx.W), h: Number(it.h ?? ctx.H), fit: 'cover',
    opacity: 0.55,
    motion: { in: { type: 'fade', at: 0, dur: 0.9, ease: 'power2.out' }, out: false },
  };
};

const assetFor = (beat, ctx, i) => {
  const pool = ctx.assets ?? [];
  if (!pool.length) return null;
  if (beat.asset) {
    const named = pool.find((a) => a.id === beat.asset);
    if (named) return named;
  }
  const words = `${beat.visual ?? ''} ${beat.headline ?? ''} ${(beat.elements ?? []).join(' ')} ${ctx.plan?.motif ?? ''}`.toLowerCase();
  const scored = pool.map((a) => {
    const text = `${a.name ?? ''} ${a.desc ?? ''} ${(a.tags ?? []).join(' ')}`.toLowerCase();
    const tokens = text.replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length > 2);
    return { a, score: tokens.reduce((n, t) => n + (words.includes(t) ? 1 : 0), 0) };
  }).sort((x, y) => y.score - x.score);
  return scored[0]?.score > 0 ? scored[0].a : null;
};

const printPhoto = (asset, beat, ctx) => {
  const { W, H, M, CW, style } = ctx;
  const pano = beat.composition === 'panorama' || ['place', 'evidence'].includes(beat.shot);
  const w = pano ? CW : CW * 0.52;
  const h = pano ? H * 0.34 : H * 0.36;
  const x = pano ? M : W - M - w;
  const y = pano ? ctx.top + H * 0.04 : ctx.top + H * 0.1;
  return {
    type: 'photo', src: asset.id, x, y, w, h, fit: 'cover',
    grayscale: 0.92, contrast: 1.12,
    tint: { color: 'accent', opacity: 0.3, blend: 'multiply' },
    border: 'ink', borderWidth: 2,
    motion: { in: { type: 'maskUp', at: 0.05, dur: 0.55, ease: 'power2.out', distance: h * 0.35 }, out: false },
  };
};

const printVisual = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const p = style.palette;
  if (beat.stat || beat.kind === 'stat') {
    const base = Math.min(H * 0.22, 300);
    const values = [0.3, 0.38, 0.45, 0.52, 0.58, 0.63, 0.7, 0.76, 0.84, 0.9, 0.96, 1];
    return {
      type: 'bars', x: M, y: bottom - base - 74, w: CW, h: base,
      values, colors: Array(12).fill('ink').map((c, i) => (i > 8 ? 'accent' : c)), gap: 6, at: 0.1, step: 0.03,
      motion: { in: { type: 'fade', at: 0, dur: 0.4 }, out: false },
    };
  }
  if (beat.items.length >= 2 || beat.shot === 'diagram') {
    return {
      type: 'bars', x: M, y: bottom - Math.min(H * 0.2, 280) - 70, w: CW * 0.46, h: Math.min(H * 0.2, 280),
      values: beat.items.map((_, i) => 0.45 + i * 0.18), colors: ['ink', 'ink', 'accent'], gap: 12, at: 0.1, step: 0.05,
      motion: { in: { type: 'fade', at: 0, dur: 0.4 }, out: false },
    };
  }
  return null;
};

const applyCamera = (block, beat, ctx) => {
  if (!block) return block;
  const base = block.motion ?? { in: { type: 'fade', at: 0, dur: 0.9, ease: 'power2.out' }, out: false };
  const reveal = beat.reveal && beat.reveal !== 'cut' ? beat.reveal : (base.in?.type ?? 'fade');
  let motion = {
    ...base,
    in: { ...(base.in ?? {}), type: reveal, at: base.in?.at ?? 0.05, dur: base.in?.dur ?? 0.85, ease: base.in?.ease ?? 'power2.out' },
  };
  if (beat.motion === 'dolly-in' || beat.motion === 'push-in') motion = { ...motion, kenBurns: { from: beat.motion === 'push-in' ? 1.14 : 1.07, to: 1 } };
  if (beat.motion === 'whip-pan') motion = { ...motion, keyframes: [{ at: 0, x: -ctx.W * 0.14, opacity: 0.3 }, { at: 0.55, x: 0, opacity: 1 }] };
  if (beat.motion === 'tracking') motion = { ...motion, keyframes: [{ at: 0, x: ctx.W * 0.05, opacity: 1 }, { at: ctx.duration, x: -ctx.W * 0.05, opacity: 1 }] };
  if (beat.motion === 'parallax') motion = { ...motion, loop: { type: 'drift', dx: ctx.W * 0.02, dy: -8, period: ctx.duration * 2, phase: 0 } };
  if (beat.motion === 'handheld') motion = { ...motion, loop: { type: 'sway', amp: 6, period: 1.8, phase: 0 } };
  if (beat.motion === 'crane') motion = { ...motion, keyframes: [{ at: 0, y: ctx.H * 0.05, opacity: 1 }, { at: ctx.duration, y: -ctx.H * 0.02, opacity: 1 }] };
  return { ...block, motion };
};

const lightingWash = (beat, ctx) => {
  const map = { neon: ['accent', 0.13], studio: ['ink', 0.09], golden: ['accent', 0.11], overcast: ['muted', 0.1], hard: ['ink', 0.07], soft: ['ink', 0.05], night: ['accent2', 0.12] };
  const spec = map[beat.lighting];
  if (!spec) return null;
  return {
    type: 'rrect', x: 0, y: 0, w: ctx.W, h: ctx.H, fill: spec[0], opacity: spec[1], blend: 'screen',
    motion: { in: { type: 'fade', at: 0, dur: 0.6 }, out: false },
  };
};

const textureBlocks = (beat, ctx) => {
  const rng = mulberry32(hash32(`${beat.texture}:${ctx.index}:${ctx.plan.title}`));
  if (beat.texture === 'rain') {
    return Array.from({ length: 14 }, () => ({
      type: 'rect', x: between(rng, 0, ctx.W), y: between(rng, -ctx.H * 0.1, ctx.H), w: between(rng, 1, 3), h: between(rng, ctx.H * 0.08, ctx.H * 0.3),
      rotation: 14, fill: 'ink', opacity: between(rng, 0.04, 0.10), blend: 'screen',
    }));
  }
  if (beat.texture === 'scanlines') {
    return Array.from({ length: 12 }, (_, i) => ({ type: 'rule', x: 0, y: (ctx.H / 12) * i, w: ctx.W, h: 1, fill: 'ink', opacity: 0.045, blend: 'screen' }));
  }
  if (beat.texture === 'halftone') {
    const out = [];
    for (let y = 0; y < 14; y += 1) for (let x = 0; x < 9; x += 1) {
      out.push({ type: 'circle', x: (ctx.W / 8) * x, y: (ctx.H / 13) * y, r: 5, fill: 'accent', opacity: 0.07, blend: 'screen' });
    }
    return out;
  }
  if (beat.texture === 'smoke' || beat.texture === 'dust') {
    return Array.from({ length: 3 }, () => ({
      type: 'circle', x: between(rng, 0, ctx.W), y: between(rng, 0, ctx.H), r: between(rng, ctx.W * 0.12, ctx.W * 0.3),
      fill: 'ink', opacity: between(rng, 0.03, 0.08), blur: between(rng, 20, 60), blend: 'screen',
    }));
  }
  if (beat.texture === 'grain') return [{ type: 'grain', opacity: 0.16 }];
  return [];
};

const mechanicBlock = (beat, ctx) => {
  const { W, H, M, CW, top } = ctx;
  const mp = beat.mparams ?? {};
  const asset = assetFor(beat, ctx, 0);
  const base = { x: num(mp.x, M), y: num(mp.y, top + H * 0.3), w: num(mp.w, CW), opacity: num(mp.opacity, 1) };
  if (beat.mechanic === 'photoCam') {
    const src = mp.src || asset?.id;
    if (!src) return null;
    return {
      type: 'photoCam', ...mp, x: 0, y: 0, w: W, h: H, src,
      shots: Array.isArray(mp.shots) && mp.shots.length ? mp.shots : [
        { fx: 0.5, fy: 0.5, zoom: 1.06 },
        { fx: 0.62, fy: 0.4, zoom: 1.7, at: Math.max(0.6, ctx.duration * 0.5), dur: 0.9 },
      ],
      vignette: num(mp.vignette, 0.3),
      tint: mp.tint ?? { color: 'bg', opacity: 0.24, blend: 'multiply' },
    };
  }
  if (beat.mechanic === 'beforeAfter') {
    const before = mp.before || asset?.id;
    const after = mp.after || asset?.id;
    if (!before && !after) return null;
    return {
      type: 'beforeAfter', ...mp, ...base, x: num(mp.x, M), y: num(mp.y, top + H * 0.3), w: num(mp.w, CW),
      h: num(mp.h, H * 0.34), before: before || after, after: after || before,
      labels: mp.labels ?? false,
    };
  }
  if (beat.mechanic === 'receipt') {
    const w = num(mp.w, Math.min(560, CW * 0.62));
    return { type: 'receipt', ...mp, x: num(mp.x, (W - w) / 2), y: num(mp.y, top + H * 0.28), w };
  }
  if (beat.mechanic === 'calendarFlip') {
    const w = num(mp.w, Math.min(560, CW * 0.62));
    return { type: 'calendarFlip', ...mp, x: num(mp.x, (W - w) / 2), y: num(mp.y, top + H * 0.28), w };
  }
  if (beat.mechanic === 'counterRoll') {
    return { type: 'counterRoll', ...mp, x: num(mp.x, M), y: num(mp.y, top + H * 0.34), w: num(mp.w, CW), size: num(mp.size, Math.round(H * 0.11)) };
  }
  if (beat.mechanic === 'cardStack') {
    return {
      type: 'cardStack', ...mp, x: num(mp.x, M), y: num(mp.y, top + H * 0.42),
      w: num(mp.w, CW), h: num(mp.h, Math.round(H * 0.16)),
      items: Array.isArray(mp.items) && mp.items.length ? mp.items : (beat.items ?? []).map((t) => ({ title: t })),
    };
  }
  return null;
};

const videoFor = (beat, ctx) => {
  const pool = ctx.videos ?? [];
  if (!pool.length) return null;
  if (beat.asset) {
    const named = pool.find((v) => v.id === beat.asset || v.name === beat.asset);
    if (named) return named;
  }
  const words = `${beat.visual ?? ''} ${beat.headline ?? ''} ${(beat.elements ?? []).join(' ')} ${ctx.plan?.motif ?? ''}`.toLowerCase();
  const scored = pool.map((v) => {
    const text = `${v.name} ${v.desc ?? ''} ${(v.tags ?? []).join(' ')} ${(v.segments ?? []).map((s) => `${s.desc} ${(s.tags ?? []).join(' ')}`).join(' ')}`.toLowerCase();
    const tokens = text.replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length > 2);
    return { v, score: tokens.reduce((n, t) => n + (words.includes(t) ? 1 : 0), 0) };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].v : null;
};

const videoBlock = (clip, beat, ctx) => {
  const { W, H, M, CW } = ctx;
  const full = beat.composition === 'panorama' || ['evidence', 'product', 'place', 'person', 'action'].includes(beat.shot);
  const w = full ? W : Math.round(CW * 0.72);
  const h = full ? H : Math.round(H * 0.3);
  return {
    type: 'video',
    frames: clip.frames.map((f) => f.id),
    fps: clip.sampleFps || 6,
    x: full ? 0 : M,
    y: full ? 0 : ctx.top + H * 0.3,
    w, h, fit: 'cover',
    radius: full ? 0 : 10,
    vignette: full ? 0.35 : 0.18,
    tint: full ? { color: 'bg', opacity: 0.24, blend: 'multiply' } : { color: 'accent', opacity: 0.12, blend: 'multiply' },
  };
};

const explainFor = (beat, ctx) => {
  const budget = ctx.explainBudget ?? { n: 0 };
  const mp = beat.eparams ?? {};
  const base = { x: num(mp.x, ctx.M), y: num(mp.y, ctx.top + ctx.H * 0.3), w: num(mp.w, ctx.CW), h: num(mp.h, ctx.H * 0.3) };
  const take = (kind, extra = {}) => {
    if (budget.n <= 0) return null;
    budget.n -= 1;
    return { type: 'explain', kind, ...base, ...extra, ...mp };
  };
  if (beat.explain) return { type: 'explain', kind: beat.explain, ...base, ...mp };
  if (beat.mechanic || beat.asset) return null;
  const text = `${beat.visual ?? ''} ${beat.headline ?? ''} ${beat.body ?? ''} ${(beat.elements ?? []).join(' ')}`.toLowerCase();
  const year = `${beat.visual ?? ''} ${beat.headline ?? ''} ${beat.body ?? ''}`.match(/\b(19\d{2}|20\d{2})\b/);
  if (year && budget.n > 0) {
    budget.n -= 1;
    const w = Math.min(560, ctx.CW * 0.62);
    return { type: 'calendarFlip', x: (ctx.W - w) / 2, y: ctx.top + ctx.H * 0.28, w, from: Number(year[1]) + 20, to: Number(year[1]), step: 2, label: 'YEAR' };
  }
  if (/\b(fly|flight|travel|journey|route|trip|plane|abroad|from .* to)\b/.test(text)) return take('flight', { from: mp.from ?? 'NOW', to: mp.to ?? 'THERE' });
  if (/\b(inside|inward|depth|core|why|layer|drill|under the)\b/.test(text)) return take('spiral', { label: mp.label ?? 'WHY' });
  if (/\b(zoom|focus|detail|closer|magnif)\b/.test(text)) return take('zoom', { label: mp.label ?? 'LOOK' });
  if (/\b(map|where|place|city|location|pin|region|across)\b/.test(text)) return take('map', { from: mp.from ?? 'HERE', to: mp.to ?? 'THERE' });
  if (/\b(grow|growth|rise|rising|up|increase|more|scale|double|triple)\b/.test(text)) return take('growth', { value: mp.value ?? beat.stat ?? '', label: mp.label ?? '' });
  if (/\b(vs|versus|compare|before|after|old|new)\b/.test(text)) return take('compare', { left: mp.left ?? beat.items?.[0] ?? 'BEFORE', right: mp.right ?? beat.items?.[1] ?? 'AFTER' });
  if (/\b(step|process|then|flow|how|first|next)\b/.test(text)) return take('process', { items: mp.items ?? beat.items ?? [] });
  if (/\b(orbit|around|system|cycle)\b/.test(text)) return take('orbit', { label: mp.label ?? '' });
  if (/\b(year|timeline|history|era|decade)\b/.test(text)) return take('timeline', {});
  return null;
};

const visualBlock = (i, ctx, beat) => {
  const { W, H, style, rng } = ctx;
  const p = style.palette;
  const clip = videoFor(beat, ctx);
  if (clip) return videoBlock(clip, beat, ctx);
  const explain = explainFor(beat, ctx);
  if (explain) return explain;
  if (beat.mechanic) {
    const mechanic = mechanicBlock(beat, ctx);
    if (mechanic) return mechanic;
  }
  const asset = assetFor(beat, ctx, i);
  if (style.print) {
    if (asset) return printPhoto(asset, beat, ctx);
    return printVisual(beat, ctx);
  }
  const motion = { in: { type: 'fade', at: 0, dur: 1.1, ease: 'power2.out' }, out: false };
  const image = imageFor(beat, ctx);
  if (image) return image;
  if (asset) {
    const tint = { color: chance(rng, 0.5) ? 'accent' : 'accent2', opacity: between(rng, 0.1, 0.2), blend: 'multiply' };
    const fullBleed = beat.composition === 'panorama'
      || (beat.composition !== 'object' && ['evidence', 'product', 'place', 'person', 'action'].includes(beat.shot));
    if (fullBleed) {
      return {
        type: 'photo', src: asset.id, x: 0, y: 0, w: W, h: H, fit: 'cover',
        opacity: between(rng, 0.78, 0.92), grayscale: 0.18,
        tint, motion,
      };
    }
    const w = between(rng, W * 0.46, W * 0.8);
    const h = between(rng, H * 0.24, H * 0.48);
    const align = chance(rng, 0.5);
    return {
      type: 'photo', src: asset.id,
      x: align ? between(rng, W * 0.04, W - w - W * 0.04) : between(rng, -w * 0.18, W - w * 0.6),
      y: between(rng, ctx.top, Math.max(ctx.top, ctx.bottom - h)),
      w, h, fit: 'cover', radius: between(rng, 4, W * 0.03),
      opacity: between(rng, 0.9, 1), grayscale: 0.1,
      tint, motion,
    };
  }
  const scene = visualScene(beat, ctx);
  if (scene) return scene;
  const side = chance(rng, 0.5) ? 1 : -1;
  const size = between(rng, W * 0.5, W * 0.92);
  const x = side > 0 ? between(rng, W * 0.35, W * 0.7) : between(rng, -size * 0.5, W * 0.1);
  const y = between(rng, H * 0.08, H * 0.55);
  return {
    type: 'group', x: 0, y: 0, opacity: 1, motion,
    children: [
      {
        type: 'rrect', x, y, w: size, h: size * between(rng, 0.55, 1.2),
        radius: between(rng, 0, size * 0.5), rotation: between(rng, -24, 24),
        fill: chance(rng, 0.5) ? 'accent' : 'accent2',
        opacity: between(rng, 0.14, 0.3), blend: 'screen',
      },
      {
        type: 'circle', x: between(rng, 0, W), y: between(rng, H * 0.1, H * 0.8),
        r: between(rng, W * 0.08, W * 0.22), fill: p.paper,
        opacity: between(rng, 0.05, 0.12), blur: between(rng, 2, 18),
      },
    ],
  };
};

const printMeta = (text, x, y, ctx, { align = 'left', fill = 'muted', w, size, opacity = 0.9 } = {}) => txt(
  String(text ?? '').toUpperCase(), x, y, w ?? ctx.CW, size ?? Math.max(11, Math.round(ctx.W * 0.011)),
  ctx.style.faces.mono, fill, { align, letterSpacing: 1.8, opacity },
);

const printKicker = (beat, ctx, fallback) => kicker(
  (beat.kicker || beat.label || fallback || `CUT ${pad2(ctx.index + 1)}`).toUpperCase(),
  ctx.M, ctx.top, 'accent',
  { size: Math.max(12, Math.round(ctx.W * 0.0125)), letterSpacing: 3, motion: motionIn(ctx.style.profile, 'slideLeft', 0.04, 18) },
);

const composePrintPoster = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [
    printKicker(beat, ctx, 'THE RECORD'),
    printMeta(`${pad2(ctx.index + 1)} / ${pad2(ctx.total)}`, W - M - CW * 0.3, top, ctx, { align: 'right', fill: 'ink', w: CW * 0.3 }),
  ];
  const hb = headlineBlock(beat.headline, ctx, {
    x: M, y: top + H * 0.075, w: CW * 0.96, fill: 'ink', maxLines: 4, startSize: ctx.headSize * 1.04,
  });
  blocks.push(hb);
  const ry = hb.y + hb.h + 26;
  blocks.push(rule(M, ry, Math.max(56, CW * 0.1), 'accent', 1, { h: 6, motion: motionIn(style.profile, 'slideRight', 0.2, 24) }));
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, M, ry + 34, CW * 0.72, ctx, { size: Math.round(ctx.bodySize * 0.92), at: 0.3 }));
  const calloutY = Math.max(ry + 140, top + H * 0.5);
  if (calloutY < bottom - H * 0.28) {
    blocks.push({
      type: 'stamp', text: clipWords(beat.label || ctx.plan.motif || 'A SHORT RECORD', 3, 20),
      x: W - M - CW * 0.36, y: calloutY, w: CW * 0.36, h: H * 0.058,
      stroke: 'accent', fill: 'accent', size: Math.max(12, Math.round(W * 0.0115)), rotation: -5,
      motion: motionIn(style.profile, 'scale', 0.45, 0),
    });
  }
  const infoY = bottom - H * 0.17;
  blocks.push(rule(M, infoY - 22, CW, 'ink', 0.3));
  const cols = [
    ['SUBJECT', clipWords(ctx.plan.title, 3, 30)],
    ['CUT', `${pad2(ctx.index + 1)} OF ${pad2(ctx.total)}`],
    ['RECORD', clipWords(beat.source || ctx.plan.motif || ctx.plan.mood, 3, 26)],
  ];
  cols.forEach(([k, v], i) => {
    const x = M + i * (CW / 3);
    blocks.push(printMeta(k, x, infoY, ctx, { w: CW / 3 - 12, opacity: 0.55 }));
    blocks.push(txt(String(v).toUpperCase(), x, infoY + 22, CW / 3 - 12, 13, style.faces.mono, 'ink', { letterSpacing: 1.6, opacity: 0.9 }));
  });
  const stampY = bottom - H * 0.09;
  blocks.push({ type: 'rect', x: M, y: stampY, w: CW * 0.3, h: H * 0.042, fill: 'transparent', stroke: 'accent', strokeWidth: 1, opacity: 0.75 });
  blocks.push(printMeta('CUSTOM HYPER / 30 FPS', M + 10, stampY + H * 0.014, ctx, { w: CW * 0.28, fill: 'accent', opacity: 0.9 }));
  return blocks;
};

const composePrintStack = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [
    printKicker(beat, ctx, 'FIELD NOTE'),
    printMeta(`${pad2(ctx.index + 1)} / ${pad2(ctx.total)}`, W - M - CW * 0.3, top, ctx, { align: 'right', fill: 'ink', w: CW * 0.3 }),
  ];
  const hb = headlineBlock(beat.headline, ctx, { x: M, y: top + H * 0.065, w: CW, fill: 'ink', maxLines: 3, startSize: ctx.headSize });
  blocks.push(hb);
  let y = hb.y + hb.h + 38;
  const body = bodyText(beat, ctx);
  if (body) {
    blocks.push(bodyBlock(body, M, y, CW * 0.68, ctx, { size: Math.round(ctx.bodySize * 0.92), at: 0.28 }));
    y += body.size * 1.38 * body.lines + 34;
  }
  if (beat.items.length && y < bottom - 150) {
    const rowH = Math.min(76, (bottom - y - 16) / beat.items.length);
    beat.items.slice(0, 4).forEach((item, i) => {
      const ry = y + i * rowH;
      blocks.push(printMeta(pad2(i + 1), M, ry, ctx, { w: 52, fill: 'accent' }));
      const fit = fitBlock(item, {
        maxWidth: CW - 84, maxLines: 1, face: style.faces.display, weight: 700,
        startSize: Math.min(48, rowH * 0.66), minSize: 20, lineHeight: 1, transform: 'uppercase',
      }, ctx.measure);
      blocks.push(txt(fit.text, M + 72, ry - 8, CW - 84, fit.size, style.faces.display, 'ink', {
        lineHeight: 1, motion: motionIn(style.profile, 'rise', 0.36 + i * 0.06, 16),
      }));
      blocks.push(rule(M, ry + rowH - 14, CW, 'ink', 0.26));
    });
  } else if (beat.stat) {
    blocks.push(txt(beat.stat, M, y, CW, Math.min(H * 0.16, 280), style.faces.display, 'accent', { lineHeight: 0.8 }));
  }
  return blocks;
};

const composePrintSplit = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const splitX = M + CW * 0.58;
  const rightW = CW * 0.34;
  const blocks = [printKicker(beat, ctx, 'THE READ')];
  const hb = headlineBlock(beat.headline, ctx, { x: M, y: top + H * 0.065, w: CW * 0.54, fill: 'ink', maxLines: 4, startSize: ctx.headSize * 0.95 });
  blocks.push(hb);
  blocks.push(rule(splitX + 8, top + 12, 2, 'ink', 0.45, { h: bottom - top - 24 }));
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, splitX + 34, top + 26, rightW, ctx, { size: Math.round(ctx.bodySize * 0.8), maxLines: 5, at: 0.26 }));
  if (beat.stat) {
    const numSize = Math.min(H * 0.11, 150);
    blocks.push(txt(beat.stat, splitX + 34, bottom - H * 0.2, rightW, numSize, style.faces.display, 'accent', {
      lineHeight: 0.8, motion: motionIn(style.profile, 'scale', 0.3, 0),
    }));
    blocks.push(printMeta(beat.label || 'MEASURE', splitX + 34, bottom - H * 0.2 + numSize * 0.84, ctx, { w: rightW }));
  }
  return blocks;
};

const composePrintRail = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [printKicker(beat, ctx, 'THE MEASURE')];
  const raw = String(beat.stat || beat.items[0] || '01').trim();
  const statNum = raw.match(/[₹$€£]?\s?\d[\d,.]*/)?.[0]?.trim() ?? raw;
  const unit = raw.replace(statNum, '').trim().replace(/^[-\s]+/, '') || beat.label || '';
  const leftW = CW * 0.44;
  const numFit = fitBlock(statNum, {
    maxWidth: leftW, maxLines: 1, face: style.faces.display, weight: 700,
    startSize: Math.min(H * 0.24, W * 0.5), minSize: 64, lineHeight: 0.8,
  }, ctx.measure);
  blocks.push(txt(numFit.text, M, top + H * 0.05, leftW, numFit.size, style.faces.display, 'accent', {
    lineHeight: 0.8, motion: motionIn(style.profile, 'slideUp', 0.12, 40),
  }));
  if (unit) blocks.push(printMeta(unit, M, top + H * 0.05 + numFit.size * 0.88, ctx, { w: leftW }));
  blocks.push(rule(M + CW * 0.485, top + 10, 2, 'ink', 0.4, { h: bottom - top - 30 }));
  const hx = M + CW * 0.51;
  const hw = CW * 0.47;
  const hb = headlineBlock(beat.headline, ctx, { x: hx, y: top + H * 0.05, w: hw, fill: 'ink', maxLines: 3, startSize: ctx.headSize * 0.6 });
  blocks.push(hb);
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, hx, hb.y + hb.h + 26, hw, ctx, { size: Math.round(ctx.bodySize * 0.76), maxLines: 4, at: 0.3 }));
  blocks.push(rule(M, bottom - 26, CW, 'ink', 0.24));
  return blocks;
};

const composePrintGrid = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [printKicker(beat, ctx, 'INDEX')];
  const hb = headlineBlock(beat.headline, ctx, { x: M, y: top + H * 0.06, w: CW, fill: 'ink', maxLines: 2, startSize: ctx.headSize * 0.82 });
  blocks.push(hb);
  const items = (beat.items.length ? beat.items : [beat.body, beat.label, beat.source].filter(Boolean)).slice(0, 4);
  const cols = items.length === 3 ? 3 : 2;
  const gap = CW * 0.035;
  const colW = (CW - gap * (cols - 1)) / cols;
  const gridTop = hb.y + hb.h + 44;
  const rows = Math.ceil(items.length / cols);
  const rowH = Math.max(120, (bottom - gridTop - 20) / rows);
  items.forEach((item, i) => {
    const x = M + (i % cols) * (colW + gap);
    const y = gridTop + Math.floor(i / cols) * rowH;
    blocks.push(rule(x, y, colW, 'ink', 0.6, { h: 2 }));
    blocks.push(printMeta(pad2(i + 1), x, y + 12, ctx, { w: 44, fill: 'accent' }));
    const fit = fitBlock(item, {
      maxWidth: colW, maxLines: 3, face: style.faces.display, weight: 700,
      startSize: Math.min(54, rowH * 0.3), minSize: 22, lineHeight: 1.02, transform: 'uppercase',
    }, ctx.measure);
    blocks.push(txt(fit.text, x, y + 40, colW, fit.size, style.faces.display, 'ink', {
      lineHeight: 1.02, transform: 'uppercase', motion: motionIn(style.profile, 'rise', 0.3 + i * 0.07, 18),
    }));
  });
  return blocks;
};

const composePrintQuote = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [printKicker(beat, ctx, 'IN ONE LINE')];
  const quote = beat.body || beat.headline;
  const fit = fitBlock(quote, {
    maxWidth: CW * 0.94, maxLines: 5, face: style.faces.serif, weight: 400,
    startSize: Math.min(H * 0.072, W * 0.13), minSize: 34, lineHeight: 1.1,
  }, ctx.measure);
  blocks.push(txt('“', M - 8, top + H * 0.02, CW * 0.3, H * 0.18, style.faces.serif, 'accent', { opacity: 0.22, lineHeight: 0.8 }));
  blocks.push(txt(fit.text, M, top + H * 0.18, CW * 0.94, fit.size, style.faces.serif, 'ink', {
    lineHeight: 1.1, italic: true, motion: motionIn(style.profile, 'rise', 0.2, 26),
  }));
  blocks.push(rule(M, bottom - H * 0.16, Math.max(56, CW * 0.1), 'accent', 1, { h: 4 }));
  const credit = beat.label || beat.source || beat.kicker;
  if (credit) blocks.push(printMeta(credit, M, bottom - H * 0.12, ctx, { w: CW * 0.7 }));
  return blocks;
};

const composePrintBrutal = (beat, ctx) => {
  const { W, H, M, CW, top, style } = ctx;
  const bandTop = H * 0.56;
  const blocks = [
    { type: 'rrect', x: 0, y: bandTop, w: W, h: H - bandTop, radius: 0, fill: 'accent', motion: motionIn(style.profile, 'slideUp', 0.1, 70) },
    printKicker(beat, ctx, 'NO FILTER'),
    printMeta(`${pad2(ctx.index + 1)} / ${pad2(ctx.total)}`, W - M - CW * 0.3, top, ctx, { align: 'right', fill: 'ink', w: CW * 0.3 }),
    {
      type: 'rect', x: W - M - CW * 0.36, y: top + H * 0.02, w: CW * 0.36, h: H * 0.3,
      fill: 'transparent', stroke: 'ink', strokeWidth: 2, opacity: 0.34,
    },
  ];
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, M, top + 50, CW * 0.5, ctx, { size: Math.round(ctx.bodySize * 0.9), maxLines: 3, at: 0.24 }));
  if (beat.visual) blocks.push(printMeta(beat.visual, W - M - CW * 0.36, top + H * 0.02 + H * 0.3 + 12, ctx, { w: CW * 0.36 }));
  blocks.push(headlineBlock(beat.headline, ctx, {
    x: M, y: bandTop + H * 0.07, w: CW, fill: 'bg', maxLines: 3,
    startSize: ctx.headSize * 0.86, at: 0.3, maxHeight: H - (bandTop + H * 0.07) - M * 1.1, accentLast: false,
  }));
  return blocks;
};

const composePrintMinimal = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [printKicker(beat, ctx, 'QUIET')];
  const hb = headlineBlock(beat.headline, ctx, { x: M, y: top + H * 0.14, w: CW * 0.9, fill: 'ink', maxLines: 4, startSize: ctx.headSize * 1.02 });
  blocks.push(hb);
  blocks.push(rule(M, hb.y + hb.h + 30, Math.max(56, CW * 0.1), 'accent', 1, { h: 5 }));
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, M, hb.y + hb.h + 66, CW * 0.62, ctx, { size: Math.round(ctx.bodySize * 0.9), maxLines: 3, at: 0.34 }));
  blocks.push(printMeta(beat.source || `END / ${pad2(ctx.index + 1)}`, M, bottom - Math.max(84, H * 0.074), ctx));
  return blocks;
};

const composePrintContrast = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [printKicker(beat, ctx, 'BEFORE / AFTER')];
  const hb = headlineBlock(beat.headline, ctx, { x: M, y: top + H * 0.06, w: CW, fill: 'ink', maxLines: 2, startSize: ctx.headSize * 0.72 });
  blocks.push(hb);
  const gap = CW * 0.035;
  const cardW = (CW - gap) / 2;
  const y = hb.y + hb.h + 40;
  const cardH = Math.max(260, Math.min(bottom - y - 10, H * 0.42));
  const items = [beat.items[0] || beat.body || 'BEFORE', beat.items[1] || beat.label || 'AFTER'];
  const years = `${ctx.plan.title} ${ctx.plan.logline} ${beat.body}`.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  items.forEach((item, i) => {
    const x = M + i * (cardW + gap);
    blocks.push({
      type: 'rrect', x, y, w: cardW, h: cardH, radius: 2,
      fill: i ? 'accent' : 'transparent', stroke: i ? 'accent' : 'ink', strokeWidth: 2,
      motion: motionIn(style.profile, 'rise', 0.24 + i * 0.08, 26),
    });
    blocks.push(txt(i ? 'AFTER' : 'BEFORE', x + 20, y + 18, cardW - 40, 13, style.faces.mono,
      i ? 'bg' : 'ink', { letterSpacing: 2, opacity: i ? 0.9 : 0.65 }));
    if (years.length >= 2) {
      blocks.push(txt(years[i], x + 20, y + 42, cardW - 40, Math.min(72, cardH * 0.2), style.faces.display,
        i ? 'bg' : 'ink', { lineHeight: 0.9, opacity: i ? 0.92 : 0.9 }));
    }
    const fit = fitBlock(item, {
      maxWidth: cardW - 40, maxLines: 4, face: style.faces.body, weight: 500,
      startSize: 22, minSize: 15, lineHeight: 1.25,
    }, ctx.measure);
    blocks.push(txt(fit.text, x + 20, y + cardH - 36 - fit.size * 1.25 * fit.lines, cardW - 40, fit.size,
      style.faces.body, i ? 'bg' : 'ink', { lineHeight: 1.25, opacity: i ? 0.95 : 0.85 }));
  });
  return blocks;
};

const composePrintCta = (beat, ctx) => {
  const { W, H, M, CW, top, bottom, style } = ctx;
  const blocks = [printKicker(beat, ctx, 'NEXT STEP')];
  const hb = headlineBlock(beat.headline, ctx, { x: M, y: top + H * 0.1, w: CW * 0.94, fill: 'ink', maxLines: 3, startSize: ctx.headSize });
  blocks.push(hb);
  const body = bodyText(beat, ctx);
  if (body) blocks.push(bodyBlock(body, M, hb.y + hb.h + 34, CW * 0.68, ctx, { size: Math.round(ctx.bodySize * 0.9), maxLines: 2, at: 0.3 }));
  blocks.push(rule(M, bottom - H * 0.26, CW, 'ink', 0.3));
  blocks.push(printMeta(`${ctx.plan.title} / ${pad2(ctx.index + 1)} OF ${pad2(ctx.total)}`, M, bottom - H * 0.26 + 14, ctx, { opacity: 0.65 }));
  blocks.push({
    type: 'cta', text: ctx.plan.cta || 'WATCH', x: M, y: bottom - H * 0.14,
    w: Math.min(CW * 0.62, W * 0.56), h: Math.max(64, H * 0.04), fill: 'accent', textFill: 'bg',
    face: style.faces.mono, size: Math.max(15, Math.round(W * 0.015)), arrow: true, letterSpacing: 2,
    motion: motionIn(style.profile, 'scale', 0.4, 0),
  });
  blocks.push(printMeta('CUSTOM HYPER / 30 FPS', W - M - CW * 0.4, bottom - H * 0.14 + 20, ctx, { align: 'right', w: CW * 0.4 }));
  return blocks;
};

const LAYOUT_BY_KIND = {
  hook: ['poster', 'brutal', 'minimal', 'split'],
  statement: ['stack', 'split', 'poster', 'minimal'],
  stat: ['rail', 'split', 'brutal'],
  list: ['grid', 'stack', 'split'],
  quote: ['quote', 'minimal', 'poster'],
  contrast: ['contrast', 'split'],
  cta: ['cta', 'brutal'],
};

const LAYOUT_BY_SHOT = {
  evidence: ['split', 'poster', 'rail'],
  number: ['rail', 'brutal', 'split'],
  person: ['poster', 'split', 'minimal'],
  product: ['poster', 'split', 'minimal'],
  place: ['poster', 'minimal', 'split'],
  diagram: ['grid', 'stack', 'rail'],
  text: ['quote', 'minimal', 'poster'],
  action: ['brutal', 'stack', 'split'],
  contrast: ['contrast', 'split'],
  texture: ['minimal', 'poster', 'stack'],
};

const chooseLayout = (beat, ctx, previous) => {
  if (ctx.forceLayout) return ctx.forceLayout;
  if (beat.mechanic && beat.mechanic !== 'none') return 'mech';
  if (beat.kind === 'cta') return 'cta';
  const fixed = beat.kind === 'hook' ? (ctx.style.print ? ['poster', 'minimal'] : ['poster', 'brutal', 'minimal'])
    : beat.kind === 'quote' ? LAYOUT_BY_KIND.quote
      : null;
  const base = fixed ?? LAYOUT_BY_SHOT[beat.shot] ?? LAYOUT_BY_KIND[beat.kind] ?? LAYOUTS;
  const fits = (x) => x !== 'rail' || beat.stat;
  if (beat.layout && base.includes(beat.layout) && beat.layout !== previous && fits(beat.layout)) return beat.layout;
  let pool = base.filter((x) => x !== previous);
  if (ctx.style.print) pool = pool.filter((x) => x !== 'brutal');
  if (!beat.stat) pool = pool.filter((x) => x !== 'rail');
  if (beat.items.length < 2) pool = pool.filter((x) => x !== 'grid');
  if (beat.items.length < 1 && !beat.body) pool = pool.filter((x) => x !== 'contrast');
  if (beat.kind === 'quote') pool = pool.filter((x) => x !== 'brutal');
  if (beat.composition === 'diagram' && pool.includes('grid')) return 'grid';
  if (beat.composition === 'type' && pool.includes('quote')) return 'quote';
  if (beat.composition === 'panorama' && pool.includes('poster')) return 'poster';
  const seeded = pool.length ? pool : base;
  return pick(ctx.rng, seeded);
};

const composeBeat = (beat, ctx) => {
  const { W, H, M, top, style } = ctx;
  const rng = ctx.rng;
  const kind = beat.kind;
  const mode = chooseLayout(beat, ctx, ctx.previousLayout);
  const PRINT_MAP = {
    poster: composePrintPoster, stack: composePrintStack, split: composePrintSplit, rail: composePrintRail,
    grid: composePrintGrid, quote: composePrintQuote, brutal: composePrintBrutal, minimal: composePrintMinimal,
    contrast: composePrintContrast, cta: composePrintCta, mech: composeMechanicText,
  };
  const map = { poster: composePoster, stack: composeStack, split: composeSplit, rail: composeRail, grid: composeGrid, quote: composeQuote, brutal: composeBrutal, minimal: composeMinimal, contrast: composeContrast, cta: composeCta, mech: composeMechanicText };
  const fn = style.print ? (PRINT_MAP[mode] ?? composePrintPoster) : (map[mode] ?? composePoster);
  const blocks = fn(beat, ctx);
  if (style.print) {
    const hay = `${beat.stat ?? ''} ${beat.visual ?? ''} ${beat.headline ?? ''} ${beat.body ?? ''} ${beat.label ?? ''}`;
    const ghostRaw = beat.stat || hay.match(/\b(1[89]\d{2}|20\d{2})\b/)?.[0]
      || String(ctx.plan.proof ?? '').match(/\b(1[89]\d{2}|20\d{2})\b/)?.[0]
      || pad2(ctx.index + 1);
    const ghost = (String(ghostRaw).match(/\d[\d,.]*/)?.[0] ?? pad2(ctx.index + 1)).replace(/[.,]$/, '').replace(/,/g, '');
    const ghostSize = Math.round(H * 0.235 * (ghost.length > 3 ? 3 / ghost.length : 1));
    blocks.unshift(txt(ghost, W - M - W * 0.52, top + H * 0.008, W * 0.52, ghostSize, style.faces.display, 'ink', {
      align: 'right', opacity: 0.07, lineHeight: 0.8, transform: 'none',
      motion: { in: { type: 'fade', at: 0, dur: 0.5 }, out: false },
    }));
    return { mode, blocks };
  }
  if (chance(rng, 0.5)) {
    const d = between(rng, W * 0.08, W * 0.2);
    blocks.unshift({
      type: 'circle', r: d, x: between(rng, -d * 0.3, W - d * 0.7), y: between(rng, ctx.top, ctx.bottom),
      fill: chance(rng, 0.5) ? 'accent' : 'accent2', opacity: between(rng, 0.1, 0.22), blur: between(rng, 0, 30),
      motion: { in: { type: 'fade', at: 0, dur: 0.8 }, out: false, loop: { type: 'float', amp: between(rng, 6, 16), period: between(rng, 8, 14), phase: between(rng, 0, 5) } },
    });
  }
  return { mode, blocks };
};

const printChrome = (plan, style, W, H, totalBeats) => {
  const p = style.palette;
  const M = style.margins.M;
  const CW = W - M * 2;
  const size = Math.max(10, Math.round(W * 0.0102));
  const y = Math.round(M * 0.66);
  const capY = Math.round(H - M * 0.82);
  const ticker = clipWords((plan.ticker.length ? plan.ticker : [plan.mood, plan.title])
    .slice(0, 4).join('   •   ').toUpperCase(), 9, 54);
  return {
    blocks: [
      txt('A FILM BY CUSTOM HYPER', M, y, CW * 0.34, size, style.faces.mono, p.ink, { letterSpacing: 2.4, opacity: 0.72, weight: 600 }),
      txt(clipWords(plan.title, 5, 34).toUpperCase(), M + CW * 0.3, y, CW * 0.4, size, style.faces.mono, p.ink, { align: 'center', letterSpacing: 2.4, weight: 700 }),
      txt(`${style.moodWord || 'THE RECORD'} / ${pad2(totalBeats)}`, W - M - CW * 0.3, y, CW * 0.3, size, style.faces.mono, p.ink, { align: 'right', letterSpacing: 2, opacity: 0.66 }),
      rule(M, Math.round(M * 1.28), CW, p.ink, 0.32),
      rule(M, capY - 13, CW, p.ink, 0.34),
      txt(ticker, M, capY, CW * 0.62, size, style.faces.mono, p.ink, { letterSpacing: 1.8, opacity: 0.62 }),
      txt(`${pad2(totalBeats)} CUTS / 30 FPS`, W - M - CW * 0.3, capY, CW * 0.3, size, style.faces.mono, p.ink, { align: 'right', letterSpacing: 1.8, opacity: 0.7 }),
      { type: 'rect', x: M, y: capY + size * 2.1, w: CW * 0.28, h: 4, fill: 'accent' },
      { type: 'rect', x: W - M - CW * 0.28, y: capY + size * 2.1, w: CW * 0.28, h: 4, fill: 'accent', opacity: 0.55 },
      { type: 'progress', h: 3, fill: p.accent },
    ],
  };
};

const chromeLayer = (plan, style, W, H, duration, totalBeats) => {
  if (style.print) return printChrome(plan, style, W, H, totalBeats);
  const p = style.palette;
  const M = style.margins.M;
  const blocks = [];
  if (style.chrome === 'none') {
    blocks.push({ type: 'progress', h: 4, fill: 'accent' });
    return { blocks };
  }
  const title = clipWords(plan.title, 5, 34).toUpperCase();
  blocks.push(txt(title, M, M * 0.62, W * 0.62, Math.max(10, Math.round(W * 0.011)), style.faces.mono, 'ink', { letterSpacing: 2.2, weight: 700 }));
  if (style.chrome === 'magazine' || style.chrome === 'technical') {
    blocks.push(txt(`${pad2(totalBeats)} FRAMES`, W - M - W * 0.2, M * 0.62, W * 0.2, Math.max(9, Math.round(W * 0.009)), style.faces.mono, 'muted', { align: 'right', letterSpacing: 1.6 }));
  }
  blocks.push(rule(M, M * 1.25, W - M * 2, 'ink', 0.22));
  if (style.chrome === 'technical') {
    blocks.push(txt('SKIA / 30 FPS', M, H - M * 0.6, W * 0.4, Math.max(9, Math.round(W * 0.009)), style.faces.mono, 'muted', { letterSpacing: 1.4 }));
  }
  if (style.chrome === 'ticker' || style.chrome === 'magazine') {
    const items = plan.ticker.length ? plan.ticker : [plan.mood, plan.title, 'CUSTOM HYPER'];
    blocks.push({
      type: 'ticker', x: 0, y: H - Math.max(44, H * 0.028), w: W, h: Math.max(44, H * 0.028),
      fill: style.print ? 'accent' : (style.chrome === 'magazine' ? 'ink' : 'accent'),
      textFill: 'bg',
      size: Math.max(12, Math.round(W * 0.012)), speed: between(mulberry32(style.seed), 40, 70),
      items: items.slice(0, 6),
    });
  }
  if (style.chrome !== 'ticker' && style.chrome !== 'magazine') {
    blocks.push(txt(style.moodWord || 'CUSTOM HYPER', M, H - M * 0.78, W * 0.5, Math.max(9, Math.round(W * 0.009)), style.faces.mono, 'muted', { letterSpacing: 1.4 }));
  }
  if (style.chrome !== 'minimal' || chance(mulberry32(style.seed ^ 3), 0.5)) {
    blocks.push({ type: 'progress', h: Math.max(4, Math.round(H * 0.0035)), fill: 'accent' });
  }
  return { blocks };
};

const motionLayer = (style, W, H, duration, rng) => {
  const p = style.palette;
  const blocks = [];
  if (style.print) {
    blocks.push({ type: 'progress', h: 4, fill: 'accent' });
    return { id: 'motion', from: 0, duration, fadeIn: 0, fadeOut: 0, blocks };
  }
  const dots = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < dots; i += 1) {
    blocks.push({
      type: 'circle',
      r: between(rng, 2.5, 6),
      x: between(rng, W * 0.08, W * 0.92),
      y: between(rng, H * 0.12, H * 0.86),
      fill: chance(rng, 0.45) ? 'accent' : 'ink',
      opacity: between(rng, 0.18, 0.45),
      motion: {
        in: { type: 'fade', at: 0, dur: 1.2 },
        out: false,
        loop: { type: chance(rng, 0.5) ? 'float' : 'sway', amp: between(rng, 6, 22), period: between(rng, 5, 13), phase: between(rng, 0, 6) },
      },
    });
  }
  blocks.push({
    type: 'rule', x: 0, y: 0, w: W, h: 1, fill: 'accent', opacity: 0.22,
    motion: { in: { type: 'fade', at: 0, dur: 1 }, out: false, loop: { type: 'drift', dx: 0, dy: H * 0.72, period: 1 } },
  });
  blocks.push({
    type: 'group', x: W * 0.88, y: H * 0.12, opacity: 0.5,
    motion: { in: { type: 'fade', at: 0, dur: 1 }, out: false, loop: { type: 'spin', period: between(rng, 12, 22), phase: 0 } },
    children: [
      { type: 'rule', x: -18, y: 0, w: 36, h: 1, fill: 'accent', opacity: 0.7 },
      { type: 'rule', x: 0, y: -18, w: 1, h: 36, fill: 'accent', opacity: 0.7 },
    ],
  });
  blocks.push(txt('LIVE', W * 0.84, H * 0.155, W * 0.1, Math.max(8, Math.round(W * 0.008)), style.faces.mono, 'accent', {
    letterSpacing: 1.6, opacity: 0.65,
    motion: { in: { type: 'fade', at: 0.2, dur: 0.6 }, out: false, loop: { type: 'pulse', amp: 18, period: 1.8, phase: 0 } },
  }));
  blocks.push(txt(style.moodWord || 'HYPER', W * 0.06, H * 0.93, W * 0.4, Math.max(8, Math.round(W * 0.008)), style.faces.mono, 'muted', {
    letterSpacing: 1.4, opacity: 0.5,
    motion: { in: { type: 'fade', at: 0.1, dur: 0.8 }, out: false, loop: { type: 'sway', amp: 8, period: 11, phase: 1 } },
  }));
  return { id: 'motion', from: 0, duration, fadeIn: 0.4, fadeOut: 0.4, blocks };
};

const anchorLayer = (style, W, H, duration, beats, rng) => {
  if (!beats.length || !chance(rng, 0.65)) return null;
  const n = beats.length;
  const keyframes = beats.map((b, i) => ({
    at: Math.max(0, b.from + b.duration * 0.5),
    x: i % 2 ? W * 0.82 : W * 0.14,
    y: H * 0.18 + (H * 0.6 * i) / Math.max(1, n - 1),
    opacity: 0.9,
    scale: 1,
  }));
  return {
    id: 'anchor', from: 0, duration, fadeIn: 0.3, fadeOut: 0.3,
    blocks: [{
      type: 'group', x: 0, y: 0,
      motion: { in: false, out: false, keyframes },
      children: [
        { type: 'circle', r: 9, x: 0, y: 0, fill: 'accent', opacity: 0.9 },
        { type: 'circle', r: 22, x: 0, y: 0, fill: 'transparent', stroke: 'accent', strokeWidth: 1, opacity: 0.5 },
      ],
    }],
  };
};

const transitionsFor = (style, N, slot, duration, beats = [], bounds = []) => {
  const out = [];
  const rng = mulberry32(style.seed ^ 0xabc);
  const count = Math.min(N - 1, 2 + Math.floor(rng() * 3));
  const pool = [];
  for (let i = 1; i < N; i += 1) if (chance(rng, 0.75)) pool.push(i);
  while (pool.length < Math.min(2, N - 1)) {
    const i = 1 + Math.floor(rng() * (N - 1));
    if (!pool.includes(i)) pool.push(i);
  }
  const indexes = pool.slice(0, count).sort((a, b) => a - b);
  indexes.forEach((i, k) => {
    const type = beats[i]?.transition || style.profile.trans[k % style.profile.trans.length];
    if (type === 'cut') return;
    out.push({
      type,
      at: clamp(bounds[i] ?? i * slot, 0.2, duration - 0.3),
      duration: type === 'flash' ? between(rng, 0.22, 0.38) : between(rng, 0.42, 0.72),
      color: chance(rng, 0.6) ? 'accent' : 'accent2',
      ...(type === 'wipe' ? { skew: between(rng, -14, 14), edge: chance(rng, 0.5) } : {}),
      ...(type === 'band' ? { color2: 'ink' } : {}),
    });
  });
  return out;
};

export const expandPlan = (rawPlan, opts = {}) => {
  const plan = normalizePlan(rawPlan, opts.brief ?? '');
  const W = opts.canvas?.w ?? 1080;
  const H = opts.canvas?.h ?? 1920;
  const duration = clamp(num(opts.duration, 12), 4, 30);
  const seed = (num(opts.seed, 0) || (Math.floor(Math.random() * 0x7fffffff) + 1)) >>> 0;
  const style = makeStyle(plan, { seed, W, H, force: opts.force });
  const M = Math.round(clamp(Math.min(W, H) * 0.06, 36, 92));
  style.margins = { M };
  const CW = W - M * 2;
  const rng = mulberry32(seed ^ 0x51ed270b);
  const N = plan.beats.length;
  const slot = duration / N;
  const weights = plan.beats.map((b) => clamp(num(b.weight, 1), 0.5, 2));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || N;
  const bounds = [0];
  let acc = 0;
  for (const w of weights) { acc += w; bounds.push(duration * acc / totalWeight); }
  bounds[N] = duration;
  const overlap = clamp(slot * 0.22, 0.24, 0.9);
  const imageAssets = Object.fromEntries((opts.images ?? []).map((s, i) => [`img${i}`, s.url]));
  const imageCtx = (opts.images ?? []).map((s, i) => ({ ...s, asset: `img${i}` }));
  const videoFrameAssets = Object.fromEntries((opts.videos ?? []).flatMap((v) => v.frames.map((f) => [f.id, f.rel])));
  const videoCtx = (opts.videos ?? []).map((v) => ({ ...v, asset: v.id }));
  const layers = [groundLayer(style, W, H, duration, rng), motionLayer(style, W, H, duration, rng)];
  const headSize = Math.round(clamp(
    Math.min(W * (H >= W ? (style.print ? 0.2 : 0.18) : 0.1), H * (H >= W ? (style.print ? 0.11 : 0.095) : 0.17)),
    style.print ? 92 : 58,
    style.print ? 264 : 230,
  ));
  const bodySize = Math.round(clamp(Math.min(W, H) * 0.034, 24, 40));
  const top = M + Math.max(42, H * 0.055);
  const bottom = H - M - (style.chrome === 'ticker' || style.chrome === 'magazine' ? Math.max(54, H * 0.04) : Math.max(30, H * 0.02));
  const beats = [];
  const explainBudget = { n: 2 };
  let previousLayout = null;
  plan.beats.forEach((beat, i) => {
    const from = i === 0 ? 0 : Math.max(0, bounds[i] - overlap);
    const to = i === N - 1 ? duration : Math.min(duration, bounds[i + 1]);
    const dur = Math.max(0.8, to - from);
    const ctx = {
      W, H, M, CW, top, bottom, style, measure: opts.measure,
      headSize, bodySize, index: i, total: N, rng: mulberry32(seed ^ (i * 2654435761)), plan,
      forceLayout: opts.force?.layout,
      duration: dur,
      assets: (opts.assets ?? []).filter((a) => a.kind !== 'video'),
      videos: videoCtx,
      images: imageCtx,
      explainBudget,
      previousLayout,
    };
    const composed = composeBeat(beat, ctx);
    previousLayout = composed.mode;
    const rawVisual = visualBlock(i, { ...ctx, layoutMode: composed.mode }, beat);
    const visual = applyCamera(rawVisual, beat, ctx);
    if (visual) composed.blocks.unshift(visual);
    if (['photo', 'video'].includes(visual?.type) && visual.w >= W * 0.98 && visual.h >= H * 0.98) {
      composed.blocks.splice(1, 0, {
        type: 'rect', x: 0, y: 0, w: W, h: H, fill: 'bg', opacity: 0.34,
        motion: { in: { type: 'fade', at: 0, dur: 0.3 }, out: false },
      });
    }
    const wash = lightingWash(beat, { ...ctx, index: i });
    if (wash) composed.blocks.splice(visual ? 1 : 0, 0, wash);
    composed.blocks.push(...textureBlocks(beat, { ...ctx, index: i }));
    layers.push({
      id: `beat-${pad2(i + 1)}`,
      from, duration: dur,
      fadeIn: i === 0 ? 0.18 : Math.min(overlap * 0.95, 0.45),
      fadeOut: i === N - 1 ? 0.35 : Math.min(overlap * 0.95, 0.55),
      blocks: composed.blocks,
    });
    beats.push({ ...beat, mode: composed.mode, layout: composed.mode, from, duration: dur });
  });
  const anchor = anchorLayer(style, W, H, duration, beats, mulberry32(seed ^ 0x51ee));
  if (anchor) layers.push(anchor);
  const transitions = transitionsFor(style, N, slot, duration, beats, bounds);
  const chrome = chromeLayer(plan, style, W, H, duration, N);
  const id = `${slugify(plan.title)}-${seed.toString(36)}-${style.layout}`;
  const spec = {
    id,
    canvas: { w: W, h: H, fps: 30 },
    duration,
    palette: {
      bg: style.palette.bg, ink: style.palette.ink, accent: style.palette.accent,
      accent2: style.palette.accent2, muted: style.palette.muted, paper: style.palette.paper,
    },
    faces: style.faces,
    ...((opts.assets?.length || opts.images?.length || opts.videos?.length) ? {
      assets: {
        ...Object.fromEntries((opts.assets ?? []).filter((a) => a.kind !== 'video').map((a) => [a.id, a.rel])),
        ...imageAssets,
        ...videoFrameAssets,
      },
    } : {}),
    grain: { opacity: style.profile.grain, amount: 0.45, seed: seed % 97, cell: 2, drift: 2 },
    layers,
    transitions,
    chrome,
  };
  return {
    spec,
    seed,
    style: {
      signature: style.signature,
      layout: style.layout,
      motion: style.profile.id,
      background: style.background,
      chrome: style.chrome,
      display: style.faces.display,
      body: style.faces.body,
      palette: spec.palette,
      mood: plan.mood,
    },
    plan: { ...plan, beats },
  };
};

const DEMO_STOP = new Set([
  'the', 'and', 'for', 'with', 'about', 'from', 'this', 'that', 'then', 'show', 'reel', 'second', 'seconds',
  'launch', 'into', 'your', 'their', 'video', 'film', 'one', 'two', 'make', 'create', 'build', 'please',
  'will', 'have', 'been', 'they', 'them', 'what', 'when', 'where', 'why', 'how', 'who', 'its', 'our',
  'than', 'ones', 'theyre', 'into', 'over', 'under', 'more', 'most', 'very', 'just',
]);

const DEMO_STYLE_WORDS = new Set([
  'cold', 'warm', 'confident', 'dark', 'elegant', 'strange', 'direct', 'human', 'angry', 'controlled',
  'grainy', 'intimate', 'quiet', 'loud', 'bright', 'minimal', 'editorial', 'brutal', 'cinematic',
  'corporate', 'playful', 'serious', 'clean', 'raw', 'soft', 'technical', 'premium', 'luxury', 'fast', 'slow',
  'factual', 'moody', 'personal', 'simple', 'bold', 'honest', 'modern', 'retro', 'vintage', 'energetic', 'calm', 'tone',
]);

const demoStrip = (s) => clean(s, 600)
  .replace(/^(?:please\s+)?(?:make|create|build|produce|write|do)\s+(?:me\s+)?/i, '')
  .replace(/^(?:a|an|the)?\s*\d*\s*(?:second|seconds|sec|s)?\s*(?:short\s+)?(?:film|reel|video|spot|edit)\s+(?:about|on|for|of|showing)\s+/i, '')
  .replace(/^(?:a|an)\s+/i, '')
  .replace(new RegExp(`\\b(?:${[...DEMO_STYLE_WORDS].join('|')})\\b`, 'gi'), '')
  .replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1')
  .replace(/(?:,\s*){2,}/g, ', ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

const demoSentences = (text) => clean(text, 600)
  .split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length > 1);

const demoSubject = (sentences) => {
  const first = String(sentences[0] ?? '').replace(/[.,;:!?]+$/, '').trim();
  const head = first.split(' ').slice(0, 3).join(' ');
  const proper = (first.match(/\b[A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,}){0,2}\b/g) ?? [])
    .filter((w) => !/^(A|An|The|This|That|These|Those|It|They|We|You|I)$/.test(w));
  const leading = proper.find((w) => head.includes(w));
  if (leading) return clipWords(leading.toUpperCase(), 4, 44);
  const words = first.split(' ').filter(Boolean).map((w) => w.replace(/[.,;:!?]+/g, ''));
  while (words.length > 1 && /^(why|how|what|when|where|who)$/i.test(words[0])) words.shift();
  const cut = words.slice(0, 4);
  while (cut.length > 1 && /^(in|at|on|for|of|to|with|and|the|a|an|than)$/i.test(cut[cut.length - 1])) cut.pop();
  return clipWords(cut.join(' ').toUpperCase(), 4, 48) || 'THE SUBJECT';
};

const demoFacts = (text) => clean(text, 600)
  .match(/[₹$€£]?\s?\d[\d,.]*(?:\s?%|\s?(?:billion|million|thousand|crore|lakh|years?|months?|days?|hours?|minutes?|seconds?|steps?|people|km|kg|litres?|liters?|rupees?|dollars?))?/gi)
  ?.map((value) => {
    const label = value.replace(/[^a-zA-Z%]/g, '').replace(/^[a-z]/, (c) => c).toUpperCase();
    return { value: value.trim(), label: label.slice(0, 14) || 'ON RECORD' };
  }).slice(0, 3) ?? [];

const demoKeywords = (text, subject) => {
  const seen = new Set();
  return clean(text, 600).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !DEMO_STOP.has(w) && !DEMO_STYLE_WORDS.has(w))
    .filter((w) => (seen.has(w) ? false : (seen.add(w), true)))
    .filter((w) => !subject.toLowerCase().includes(w))
    .slice(0, 5).map((w) => w.toUpperCase());
};

const demoPhrases = (text) => clean(text, 700).split(/[,;:—–]|\.\s+|\.$/)
  .map((s) => s.trim()).filter((s) => s.split(' ').length > 2)
  .map((s) => clipWords(s, 6, 56)).slice(0, 6);

const parseStoryboardBrief = (raw) => {
  if (!/\bboard\s*0?1\b/i.test(raw)) return null;
  const parts = raw.split(/(?:^|\n)\s*[*•-]?\s*Board\s*0?\d+\b[^\n]*/i)
    .filter((x) => /visual\s*:/i.test(x));
  if (parts.length < 2) return null;
  const field = (chunk, names) => {
    for (const line of chunk.split('\n')) {
      const m = line.match(/^\s*[*•-]?\s*([A-Za-z /]+?)\s*:\s*(.+)$/);
      if (m && names.includes(m[1].trim().toLowerCase())) return clean(m[2], 400);
    }
    return '';
  };
  const cameraOf = (v) => {
    const t = v.toLowerCase();
    if (t.includes('whip')) return 'whip-pan';
    if (t.includes('dolly')) return 'dolly-in';
    if (t.includes('tracking') || t.includes('follow')) return 'tracking';
    if (t.includes('crane')) return 'crane';
    if (t.includes('handheld') || t.includes('shaky')) return 'handheld';
    if (t.includes('static') || t.includes('lock-off')) return 'static';
    if (t.includes('parallax')) return 'parallax';
    return 'push-in';
  };
  const lightOf = (v) => {
    const t = v.toLowerCase();
    if (t.includes('neon') || t.includes('night')) return 'neon';
    if (t.includes('studio') || t.includes('white')) return 'studio';
    if (t.includes('golden')) return 'golden';
    if (t.includes('overcast') || t.includes('grey')) return 'overcast';
    if (t.includes('hard') || t.includes('contrast')) return 'hard';
    return 'soft';
  };
  const textureOf = (v) => {
    const t = v.toLowerCase();
    if (t.includes('rain')) return 'rain';
    if (t.includes('smoke') || t.includes('exhaust') || t.includes('fume')) return 'smoke';
    if (t.includes('grain')) return 'grain';
    if (t.includes('dust')) return 'dust';
    if (t.includes('halftone')) return 'halftone';
    if (t.includes('scan')) return 'scanlines';
    return 'clean';
  };
  const reveals = ['maskUp', 'wipe', 'scale', 'slideLeft', 'blurIn', 'rise'];
  return parts.slice(0, 8).map((chunk, i) => {
    const meta = chunk.split('\n')[0] ?? '';
    const visualRaw = field(chunk, ['visual']);
    const motionRaw = field(chunk, ['motion', 'camera', 'shot']);
    const textRaw = field(chunk, ['text/audio', 'text', 'text overlay', 'headline', 'display text']);
    const audioRaw = field(chunk, ['audio', 'sound']);
    const quoted = textRaw.match(/["“”]([^"“”]{3,90})["“”]/)?.[1]
      || textRaw.match(/:\s*([^.!?]{3,90})/)?.[1] || '';
    const headline = clipWords((quoted || textRaw).replace(/^\s*(?:text(?: overlay)?|display text)\s*[:—-]?\s*/i, '').replace(/[.!]+$/, ''), 7, 70).toUpperCase()
      || (i === 0 ? 'THE HOOK' : i === parts.length - 1 ? 'NEXT STEP' : 'THE TURN');
    const visual = clipWords(visualRaw.replace(/^(?:extreme |medium |wide |clean |sudden )?(?:close-up|shot|cut|frame)\s+(?:of\s+)?/i, ''), 12, 110);
    const elements = clipWords(visual, 10).split(/[,.;—-]|\s+and\s+|\s+with\s+/i)
      .map((x) => clean(x, 32)).filter((x) => x.split(/\s+/).length >= 1).slice(0, 4);
    const stat = chunk.match(/\b(\d[\d,.]*\s*(?:%|km|kwh|kw|w|hours?|hrs?|minutes?|mins?|months?|years?|x))\b/i)?.[1] ?? '';
    const job = i === 0 ? 'hook' : i === parts.length - 1 ? 'action' : (stat ? 'proof' : 'turn');
    const kind = i === 0 ? 'hook' : i === parts.length - 1 ? 'cta' : (stat ? 'stat' : 'statement');
    return {
      kind, job, visual: visual || `frame ${i + 1}`,
      shot: stat ? 'number' : i === 0 ? 'evidence' : (visualRaw.toLowerCase().includes('rider') || visualRaw.toLowerCase().includes('person') ? 'person' : 'product'),
      composition: i === 0 ? 'panorama' : (stat ? 'split' : 'single'),
      layout: i === 0 ? 'brutal' : i === parts.length - 1 ? 'cta' : (stat ? 'rail' : 'poster'),
      motion: cameraOf(`${motionRaw} ${visualRaw}`), reveal: reveals[i % reveals.length],
      lighting: lightOf(visualRaw), texture: textureOf(`${visualRaw} ${audioRaw}`),
      transition: i === 0 ? 'wipe' : (i % 2 ? 'flash' : 'dip'),
      elements, focal: elements[0] ?? visual, sound: clean(audioRaw, 70),
      weight: job === 'hook' ? 1 : job === 'proof' ? 1.2 : job === 'turn' ? 1.3 : 0.9,
      kicker: meta.replace(/^[*•-\s]+/, '').split('|')[0].trim().slice(0, 36) || job.toUpperCase(),
      headline, body: clipWords(visual, 16, 170),
      vo: clean(textRaw.replace(/["“”]/g, ''), 180),
      items: elements.slice(0, 3), stat, label: stat ? 'ON RECORD' : '', source: '',
    };
  });
};

export const demoPlan = (brief, seed = 7, language = 'en') => {
  const storyboard = parseStoryboardBrief(String(brief ?? '').slice(0, 4000));
  const raw = clean(brief, 1400);
  if (storyboard) {
    const subject = clean(storyboard[0]?.elements?.[0] || storyboard[0]?.headline || 'the subject', 60);
    return {
      title: clipWords(subject, 6, 60), logline: clipWords(storyboard.map((b) => b.visual).join('. '), 30, 220),
      idea: clipWords(storyboard[1]?.body || storyboard[0]?.body, 30, 220),
      audience: 'the viewer who stops for the first frame', tension: clipWords(storyboard[0]?.body, 24, 180),
      proof: storyboard.find((b) => b.stat)?.stat ?? '', motif: subject, mood: 'cinematic',
      energy: 0.8, typography: 'brutal', art: 'cinema', palette: {}, structure: 'user-storyboard', language,
      beats: storyboard, cta: clipWords(storyboard[storyboard.length - 1]?.headline, 5, 28),
      ticker: [...new Set(storyboard.flatMap((b) => b.elements))].slice(0, 4),
    };
  }
  const sentences = demoSentences(raw)
    .map((s) => s.replace(/^(?:please\s+)?(?:make|create|build|produce|write|do)\s+(?:me\s+)?/i, '')
      .replace(/^(?:a|an|the)?\s*\d*\s*(?:second|seconds|sec|s)?\s*(?:short\s+)?(?:film|reel|video|spot|edit)\s+(?:about|on|for|of|showing)\s+/i, '')
      .trim())
    .filter(Boolean);
  const text = demoStrip(raw);
  const subject = demoSubject(sentences.map((s) => demoStrip(s)));
  const facts = demoFacts(text);
  const phrases = demoPhrases(text);
  const keywords = demoKeywords(text, subject);
  const copy = sentences.filter((s) => s.split(/\s+/).length >= 4
    && demoStrip(s).split(/\s+/).filter((w) => !DEMO_STOP.has(w.toLowerCase()) && !DEMO_STYLE_WORDS.has(w.toLowerCase())).length >= 2);
  const bodyAt = (i) => clipWords(copy[i % Math.max(1, copy.length)] ?? text, 18, 170).replace(/[.,;:]+$/, '');
  const hookBody = copy[1] && copy[0]?.toUpperCase() === subject ? bodyAt(1) : bodyAt(0);
  const cleanLine = (v) => clipWords(String(v ?? '')
    .replace(/^(why|how|what|when|where|who)\s+/i, '')
    .replace(/\s+(than|and|but|of|with|to|from|in)$/i, '')
    .replace(/[.,;:!?]+$/, ''), 6, 58).toUpperCase();
  const lineAt = (i) => cleanLine(phrases[i % Math.max(1, phrases.length)] ?? subject) || subject;
  const listItems = phrases.slice(0, 3).map((p) => clipWords(cleanLine(p), 4, 34))
    .filter((p) => p && p !== subject && !/^(they|we|it|this|that|there)\b/i.test(p));
  const items = keywords.length >= 3 ? keywords.slice(0, 3) : (listItems.length >= 2 ? listItems : [subject]);
  const action = (text.match(/\b(book|visit|try|buy|order|call|join|start|save|share|apply|explore|see|plan)\b/i)?.[1] ?? 'see').toUpperCase();
  const kinds = ['hook'];
  if (facts.length) kinds.push('statement', 'stat', 'list');
  else if (copy.length >= 2) kinds.push('statement', 'quote');
  else kinds.push('quote');
  kinds.push('cta');
  const beats = kinds.map((kind, index) => {
    if (kind === 'hook') return { kind, kicker: 'THE SUBJECT', headline: subject, body: hookBody, vo: sentences[0] ?? hookBody };
    if (kind === 'statement') return { kind, kicker: 'THE RECORD', headline: lineAt(0), body: bodyAt(1) };
    if (kind === 'stat') {
      const fact = facts[0] ?? facts[1];
      return { kind, kicker: 'THE MEASURE', headline: lineAt(1), stat: fact?.value ?? '', label: fact?.label ?? 'ON RECORD', body: bodyAt(1) };
    }
    if (kind === 'list') return { kind, kicker: 'THE BREAKDOWN', headline: lineAt(1) || subject, items: items.length >= 2 ? items : [subject] };
    if (kind === 'quote') return { kind, kicker: 'IN ONE LINE', headline: lineAt(1), body: bodyAt(0), label: subject };
    return { kind, kicker: 'NEXT STEP', headline: `${action} ${subject}`.slice(0, 58), body: bodyAt(0), vo: `${action} ${subject}` };
  });
  return {
    title: subject,
    logline: clipWords(sentences[0] ?? text, 24, 180),
    idea: clipWords(sentences[0] ?? text, 30, 220),
    audience: 'the viewer who stops for the first frame',
    tension: clipWords(sentences[1] ?? text, 24, 180),
    proof: facts[0]?.value ?? '',
    motif: clipWords(phrases[0] ?? subject, 4, 40),
    mood: 'editorial',
    energy: 0.5,
    typography: 'editorial',
    art: 'print',
    palette: {},
    structure: 'brief-facts',
    language,
    beats,
    cta: `${action} ${subject}`.slice(0, 28),
    ticker: [...new Set([...keywords.slice(0, 3), subject])].slice(0, 4),
  };
};

const fontSlug = (family) => String(family ?? 'Inter')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '') || 'inter';

const cssColor = (value, palette = {}) => {
  if (value == null) return 'transparent';
  const v = String(value).trim();
  if (!v) return 'transparent';
  if (v === 'transparent') return 'transparent';
  if (v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl')) return v;
  return palette[v] ?? 'transparent';
};

const hexColor = (value, palette = {}, fallback = '#ffffff') => {
  const c = cssColor(value, palette);
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (!m) return fallback;
  if (m[1].length === 3) return `#${m[1].split('').map((x) => x + x).join('')}`;
  return c;
};

const assetUrl = (rel) => {
  if (!rel) return null;
  const text = String(rel);
  if (text.startsWith('/')) return text;
  const assetAt = text.indexOf('assets/');
  const imageAt = text.indexOf('images/');
  if (assetAt >= 0) return `/data/assets/${text.slice(assetAt + 7)}`;
  if (imageAt >= 0) return `/data/images/${text.slice(imageAt + 7)}`;
  return null;
};

const baseCss = (row, scale) => {
  const s = Number(scale) || 1;
  const x = Number(row.x ?? 0);
  const y = Number(row.y ?? 0);
  const w = Number(row.w ?? 0);
  const h = Number(row.h ?? 0);
  const rotation = Number(row.rotation ?? 0);
  return {
    position: 'absolute',
    left: `${x * s}px`,
    top: `${y * s}px`,
    width: `${Math.max(1, w * s)}px`,
    height: `${Math.max(1, h * s)}px`,
    transform: rotation ? `rotate(${rotation}deg)` : 'none',
    transformOrigin: 'center center',
    opacity: String(row.opacity ?? 1),
    boxSizing: 'border-box',
    userSelect: 'none',
  };
};

const textCss = (row, scale, palette = {}, faces = {}) => {
  const s = Number(scale) || 1;
  const face = row.face || faces?.body || 'Inter';
  return {
    ...baseCss(row, s),
    fontFamily: `"${face}", sans-serif`,
    fontSize: `${Math.max(2, Number(row.size ?? 32) * s)}px`,
    fontWeight: String(row.weight ?? 400),
    color: cssColor(row.textFill ?? row.fill ?? 'ink', palette),
    lineHeight: String(Number(row.lineHeight ?? 1.1)),
    letterSpacing: `${Number(row.letterSpacing ?? 0) * s}px`,
    textAlign: row.align ?? 'left',
    textTransform: row.transform ?? 'none',
    whiteSpace: 'pre-wrap',
    overflow: 'visible',
  };
};

const shapeCss = (row, scale, palette = {}) => {
  const s = Number(scale) || 1;
  return {
    ...baseCss(row, s),
    background: cssColor(row.fill, palette),
    border: row.strokeWidth && row.stroke
      ? `${Math.max(1, Number(row.strokeWidth) * s)}px solid ${cssColor(row.stroke, palette)}`
      : 'none',
    borderRadius: `${Number(row.radius ?? 0) * s}px`,
    filter: row.blur ? `blur(${Number(row.blur) * s}px)` : 'none',
  };
};

const mediaCss = (row, scale, palette = {}) => {
  const s = Number(scale) || 1;
  return {
    ...baseCss(row, s),
    background: 'transparent',
    backgroundImage: row.srcUrl ? `url("${row.srcUrl}")` : 'none',
    backgroundSize: row.fit === 'contain' ? 'contain' : 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    borderRadius: `${Number(row.radius ?? 0) * s}px`,
    filter: row.grayscale ? `grayscale(${Math.min(1, Number(row.grayscale))})` : 'none',
    color: cssColor(row.textFill ?? row.fill ?? 'ink', palette),
  };
};

const scaleBox = (row, scale) => {
  const s = Number(scale) || 1;
  return {
    left: Number(row.x ?? 0) * s,
    top: Number(row.y ?? 0) * s,
    w: Math.max(1, Number(row.w ?? 0)) * s,
    h: Math.max(1, Number(row.h ?? 0)) * s,
  };
};

const unscaleBox = (row, scale, box) => {
  const s = Number(scale) || 1;
  return {
    x: Math.round(Number(box.left || 0) / s),
    y: Math.round(Number(box.top || 0) / s),
    w: Math.max(8, Math.round(Number(box.w || 0) / s)),
    h: Math.max(8, Math.round(Number(box.h || 0) / s)),
  };
};

const patchBody = (row, patch) => ({
  board: row.board,
  layer: row.layer,
  path: row.path,
  patch,
});

let fontIndex = null;
const loadedFonts = new Set();

const loadFonts = async (faces = {}) => {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  const families = [...new Set(Object.values(faces).filter(Boolean))];
  if (!fontIndex) {
    fontIndex = await fetch('/fonts/index.json')
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}));
  }
  await Promise.all(families.flatMap((family) => {
    const weights = fontIndex[fontSlug(family)] ?? [400];
    return weights.map(async (weight) => {
      const key = `${family}:${weight}`;
      if (loadedFonts.has(key)) return;
      const url = `/fonts/${fontSlug(family)}/${weight}-normal.ttf`;
      try {
        const face = new FontFace(family, `url("${url}")`, { weight: String(weight) });
        await face.load();
        document.fonts.add(face);
        loadedFonts.add(key);
      } catch (err) {
        console.warn(`font unavailable: ${family} ${weight}`, err?.message ?? err);
      }
    });
  }));
  if (document.fonts?.ready) await document.fonts.ready;
};

export {
  fontSlug, cssColor, hexColor, assetUrl, baseCss, textCss,
  shapeCss, mediaCss, scaleBox, unscaleBox, patchBody, loadFonts,
};

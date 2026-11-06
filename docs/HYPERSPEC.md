# HyperSpec 0.1

The authoring contract. A planner (human or LLM) writes one JSON file. The engine compiles it and renders it. No other input is required.

Rule: the planner picks names, text, numbers, and block types. The planner does not pick pixels per frame, does not call tools, and does not iterate on output.

## Top level

```json
{
  "id": "signal-16s",
  "canvas": { "w": 1080, "h": 1920, "fps": 30 },
  "duration": 16,
  "palette": { "bg": "#0B0D12", "ink": "#F2F3F7", "accent": "#FF4D2E", "accent2": "#4C7DFF", "muted": "rgba(242,243,247,0.58)", "paper": "#EFE6D5" },
  "faces": { "display": "Bebas Neue", "body": "Inter", "mono": "IBM Plex Mono", "serif": "Rozha One" },
  "assets": { "hero": "../assets/hero.webp" },
  "grain": { "opacity": 0.08, "amount": 0.5, "seed": 7, "cell": 2, "drift": 3 },
  "fonts": [{ "family": "My Face", "file": "fonts/MyFace.ttf" }],
  "layers": [],
  "transitions": [],
  "chrome": { "blocks": [] }
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Output file prefix. |
| `canvas.w/h` | even int | Required. H.264 needs even dimensions. |
| `canvas.fps` | int 1..120 | Default 30. |
| `duration` | seconds | Required. Float allowed. |
| `palette` | object | Color tokens used by blocks. |
| `faces` | object | Default font per role: `display`, `body`, `mono`, `serif`. |
| `assets` | `{id: path}` | Paths are relative to the spec file. |
| `grain` | bool/object | Film grain overlay. Deterministic seed. |
| `fonts` | array | Extra local font files. The X80 font cache loads first. |
| `layers` | array | Paint order: first = bottom. Required. |
| `transitions` | array | Wipes and flashes above layers, below chrome. |
| `chrome` | object | Persistent layer above transitions. Same block list. |

## Layer

```json
{
  "id": "act-2",
  "from": 4.4,
  "duration": 6.2,
  "fadeIn": 0.5,
  "fadeOut": 0.7,
  "blend": "source-over",
  "blocks": []
}
```

- `from` and `duration` are seconds on the global timeline.
- Layers may overlap. Overlap is the intended crossfade.
- `fadeIn`/`fadeOut` default to 0.35 s. Set `0` for a hard in/out.
- Blocks inside a layer use local time: local 0 = `layer.from`.

## Block contract

Every block accepts:

| Field | Type | Notes |
|---|---|---|
| `type` | string | Required. Unknown types throw. |
| `x`, `y` | number | Position. Default 0. |
| `rotation` | degrees | Default 0. |
| `scale` | number | Uniform scale. Default 1. |
| `opacity` | 0..1 | Default 1. |
| `motion` | object | See Motion. |
| `children` | block[] | Only for `group`, `rrect`, `rect`. |

### Block types

| Type | Key fields | Output |
|---|---|---|
| `bg` | `fill` or `top`/`bottom` | Full-canvas background. |
| `group` | `children`, `clip` | Local coordinate group. |
| `rect` / `rrect` | `w`,`h`,`radius`,`fill`,`stroke`,`shadow` | Shape. `rrect` adds rounded corners. |
| `circle` | `r`,`fill`,`blur` | Disc, optional blur filter. |
| `rule` | `w`,`h`,`fill` | Hairline or bar. |
| `text` | `text`,`size`,`face`,`weight`,`fill`,`w`,`h`,`align`,`lineHeight`,`letterSpacing`,`transform`,`italic`,`shadow`,`mask`,`fit` | Text. `\n` allowed. `mask:true` enables reveal. `fit:{maxLines,minSize}` shrinks to fit `w`/`h` or throws. |
| `kicker` | `text`,`size`,`letterSpacing`,`fill`,`rule`,`ruleColor` | Upper-case label with an optional rule. |
| `photo` | `src`,`w`,`h`,`radius`,`rotation`,`grayscale`,`contrast`,`brightness`,`border`,`kenBurns`,`tint` | Clipped image well. |
| `image` | `src`,`w`,`h`,`fit` | Raw image node. |
| `sprite` | `src`,`w`,`h`,`fit` | Alias for `image`. Keeps older sprite specs valid. |
| `photo` / `image` | `src`,`w`,`h`,`fit`,`x`,`y` | Clipped image well or raw image node. `src` is an `assets` id. Per-frame images from the image plan are placed here. |
| `stamp` | `text`,`w`,`h`,`stroke`,`rotation` | Bordered stamp. |
| `ticker` | `items`,`w`,`h`,`speed`,`fill`,`textFill` | Seamless marquee band. |
| `ledger` | `rows:[{value,label}]`,`header`,`rowH`,`step` | Numeric list. Staggered. |
| `bars` | `values`,`w`,`h`,`colors`,`gap`,`at`,`step` | Bar chart. Grows with `back.out`. |
| `timeline` | `nodes:[{at,label,sub,color}]`,`draw` | Dated timeline. |
| `cta` | `text`,`w`,`h`,`fill`,`textFill`,`arrow` | Pill button. |
| `atmosphere` | `blobs:[{color,x,y,r,blur,opacity,float,period}]` | Blurred color field. |
| `progress` | `h`,`fill` | Full-reel progress bar. |
| `wipe` | `w`,`fill`,`skew` | Moving color band. |
| `grain` | `opacity` | Grain overlay block. |
| `raw` | `node` | Escape hatch. Must be a valid X80 scene node. |

### Text fit

`fit` is opt-in. Without it, text uses `size` as written.

```json
{ "type": "text", "text": "A QUIET ELECTRIC SCOOTER", "w": 760, "h": 420, "size": 150,
  "fit": { "maxLines": 2, "minSize": 40 } }
```

The compiler tries the written size first. If the laid text exceeds `maxLines` or `h`, it shrinks by 6% steps until it fits or reaches `minSize`. If it still does not fit, compile fails with `text fit overflow`. Lint uses the same estimate so the safe-area warning reflects the fitted size.

### Per-frame images

ChatGPT can return one transparent PNG per frame plus a manifest:

```json
{ "name": "image-plan", "frames": [
  { "id": "frame-01", "prompt": "solar panel on rooftop, golden hour", "x": 0, "y": 0, "w": 1080, "h": 1920, "duration": 3, "tags": ["hook", "opening"] },
  { "id": "frame-02", "prompt": "old broken panel, dull", "x": 0, "y": 0, "w": 1080, "h": 1920, "duration": 3, "tags": ["problem", "before"] }
] }
```

Download `image-plan.md` + `image-manifest.json` from `/api/p/image/pack`, give both to the image model, then upload the manifest and PNGs to `/api/p/images`. The director matches frame tags to beat keywords and places each PNG as a `photo` block at its `x/y/w/h`. Boards without a matching image fall back to procedural art.

## Motion

`motion` is optional. If omitted, the block is static. If present, these fields apply:

```json
"motion": {
  "in":  { "type": "maskUp", "at": 0.3, "dur": 0.8, "ease": "power3.out", "distance": 44 },
  "out": { "type": "fade", "dur": 0.5, "ease": "power2.in" },
  "loop": { "type": "float", "amp": 16, "period": 9, "phase": 0 },
  "kenBurns": { "from": 1.0, "to": 1.09 },
  "keyframes": [{ "at": 0, "x": 0, "opacity": 0 }, { "at": 0.6, "x": 40, "opacity": 1 }]
}
```

Set `"in": false` or `"out": false` to disable one side. Defaults when `motion` exists: `in` = fade 0.55 s, `out` = fade 0.45 s.

### `in` / `out` types

`fade`, `rise`, `drop`, `slideLeft`, `slideRight`, `slideUp`, `slideDown`, `scale`, `blurIn`, `maskUp`, `none`.

### Loop types

`float`, `sway`, `pulse`, `spin`, `drift`, `marquee`.

- `float`/`sway`: `amp`, `period`, `phase`.
- `pulse`: `amp` is percent.
- `drift`: `dx`, `dy`.
- `marquee`: `distance`, `period`, `phase`.

### Easings

`linear`, `smooth`, `in`, `out`, `inOut`, `power1.*`, `power2.*`, `power3.*`, `expo.out`, `expo.inOut`, `back.out`, `back.inOut`, `elastic.out`, `bounce.out`, `circ.out`.

Use `power2.out` or `power3.out` for entrances, `back.out` for stamps and buttons, `power2.in` for exits. Do not use `linear` for entrances.

### Keyframes

`keyframes` is an array of `{at, x, y, opacity, scale, rotation, blur}`. `at` is local seconds. Values are offsets from the block base, except `opacity` and `scale`, which are multipliers. When present, keyframes replace `in`/`out`/`loop` for those props.

## Transitions

```json
"transitions": [
  { "type": "wipe",  "at": 4.9, "duration": 0.85, "color": "accent", "skew": -9 },
  { "type": "flash", "at": 0.12, "duration": 0.35, "color": "accent" }
]
```

Types: `wipe`, `flash`, `dip`, `band`, `cut`. `at` is global seconds.

## Color rules

A color value is one of:

- Palette token: `bg`, `ink`, `accent`, `accent2`, `muted`, `paper`.
- Any CSS color string `#rrggbb`, `rgba(...)`, `transparent`.
- Gradient object: `{ "kind": "linear", "angle": 90, "stops": [{ "offset": 0, "color": "ink" }] }`.

## Determinism rules

1. Time is integer frames. All motion is baked to keyframe data.
2. No `Date.now`, no random without a seed, no network at render.
3. Same assets, same fonts, same spec -> same plan -> same pixels (verified).
4. MP4 bytes can differ slightly because the H.264 encoder is multi-threaded. Frame pixels do not differ.
5. A missing asset, font, layer, or block throws. No silent fallback.

## Authoring checklist

1. Pick canvas, duration, palette, faces.
2. Make a continuous ground layer for the full duration.
3. Add 3-5 content layers. Overlap them by 0.5-1.2 s.
4. Give every content layer at least one eased entrance.
5. Put one ambient mover in the ground layer (atmosphere float or drift).
6. Add persistent chrome: masthead, rule, ticker, progress.
7. Add 2-3 transitions at the layer hand-offs.
8. Keep one idea per beat. Do not fill every pixel.

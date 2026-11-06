# Mechanics catalog

A **mechanic** is one HyperSpec block that expands to a small scene tree with baked motion.
The planner picks the mechanic and fills params. It never invents layout or pixels.
Same JSON -> same frames. No DOM, no network, no random, no vision.

Source: `src/mechanics.mjs`. Lint: `src/slideshow-lint.mjs`. Demo: `specs/mechanics-demo.json`.

## 1. Idea -> mechanic table (the planner reads this)

| The beat is about... | Mechanic | One-line reason |
|---|---|---|
| time passing, "back in 1956", age, history | `calendarFlip` | the viewer *feels* the years go by |
| a number that matters (money, followers, %) | `counterRoll` | the number is earned, not announced |
| before / after, old vs new, problem vs fix | `beforeAfter` | the change is shown on the same frame |
| price, bill, saving, cost breakdown | `receipt` | proof you can read, with a stamp payoff |
| a photo, product, place, person | `photoCam` | 1 photo becomes 3-4 shots |
| 2-4 reasons, features, steps | `cardStack` | items arrive one by one, depth builds |
| a thing that must stay on screen across beats | `track` | continuity, the anti-slideshow primitive |

If no row fits, use `text` + `photo`/`bars`/`timeline`/`ledger` and say why in the plan.

## 2. Params

All mechanics accept the common block fields: `x`, `y`, `rotation`, `scale`, `opacity`, `motion`.
Times are **layer-local seconds**. Colors are palette tokens or CSS colors.

### calendarFlip
Calendar card with a scrolling year wheel.
`from`, `to` (numbers) or `labels:[...]` (any strings: months, ages, "Day 1"). `step` (default 1; raise it for long ranges, max 160 labels).
`w` 560, `h` 700, `rowH` 150, `size`, `label` ("YEAR", or `false`), `at` 0.3, `dur` 1.7, `ease` power3.inOut, `paper`, `headerFill`, `ink`.
Lands with a small pop on the final label. Put the caption (what happened that year) in a separate `text` block that enters at `at + dur`.

### counterRoll
Odometer. Lower digits spin more, leading digits stop first.
`from`, `to` (integers), `prefix`, `suffix`, `grouping` (`intl` | `indian` | `none`), `size` 220, **`w`** (auto-shrinks to fit), `fill`, `suffixFill`, `at`, `dur` 1.6, `ease` power3.out.
Rolls always count upward through the digit wheel. It is a visual, not arithmetic: `from` > `to` still ends on `to`.

### beforeAfter
A divider sweeps; the second image is revealed underneath.
`before`, `after` (asset ids; one `src` may be used for both), `w`, `h`, `axis` (`h`|`v`), `at`, `dur` 1.4, `hold`, `labels` (default BEFORE/AFTER or `false`), `beforeLook`/`afterLook` `{grayscale, contrast, brightness}`.
Default `beforeLook` is desaturated and dim. Pass `{}` to disable.

### receipt
Paper rises out of a slot, in stutter steps, header first, then stamps.
`rows:[{label,value,hot?}]`, `title`, `sub`, `total:{label,value,fill}`, `stamp`, `stampColor`, `w` 560, `rowH`, `at`, `dur`, `paper`, `edge` (color of the zigzag edge, set to your background).
Use real numbers from the brief. Never invent figures.

### photoCam
Virtual camera over one image.
`src`, `w`, `h`, `shots:[{fx,fy,zoom,at,dur,ease}]` (`fx,fy` = focus point 0..1 in the photo, `zoom` >= 1, shot 0 is the start pose), `shake` (px, 0-4), `vignette` (0-1), `tint`, `grayscale/contrast/brightness`, `callouts:[{at,x,y,r,label,color}]`.
Callouts are in **screen** space (0..1 of the window), not photo space. The camera is clamped so no edge ever shows.
Rule: >= 2 shots per photo. Zoom into a different detail each time.

### cardStack
`items:[{title,sub,fill,ink}]`, `w`, `h`, `at`, `step` 0.55, `lift` 190 (how much older cards peek out), `shrink` 0.04, `from` (`below`|`right`), `tilt`.
The last card defaults to accent fill. Keep titles to 1-3 words, subs to one line.

### track
Persistent shared element. Put it in a **long layer**.
`child` (any one block), `poses:[{at,x,y,scale,rotation,opacity,blur,ease,dur}]`, optional `anchor:{x,y}`.
Each pose after the first moves from the previous pose and **arrives at `at`**; `dur` sets how long the move takes (default = the whole gap). Hold a position by repeating the same pose.
Park poses at beat boundaries so the element travels *through* the cut.

## 3. Pacing rules (enforced by `slideshow-lint`)
- >= 60% of beats have a hero visual (mechanic, photo, chart).
- >= 2 mechanics in any reel of 4+ beats.
- >= 1 `track` in any reel of 4+ beats.
- Beat lengths vary (CV >= 18%): 0.6-1.2 s punches next to 2.5-3.5 s holds.
- >= 5 distinct entrances + mechanics. >= 2 transition types.
- No two neighbouring beats with the same block mix.

## 4. Determinism contract
- Every curve is `bake()`d to integer-frame keyframes (every frame for mechanics).
- No `Date`, no `Math.random`, no network, no fonts outside the registered set.
- Text never changes inside one node. Anything that changes value (years, digits) is a stack of nodes moved inside a clipped group. Pixels are therefore identical across runs.
- Fail loud: bad params throw (`calendarFlip: 400 labels is too many`).

## 5. Known limits (honest list)
- Node count: `calendarFlip` is ~1 text node per label and `counterRoll` ~10 per travelled digit. A 70-year calendar bakes ~250 KB of plan JSON. Fine for render, avoid 160 labels on slow machines.
- Gradient fades in `calendarFlip` blend paper -> transparent-white. If the paper color is very saturated, a faint halo may show. Check once on a still.
- `photoCam` is a 2D camera. No depth parallax (needs a depth map, which is a vision step; out of scope by rule).
- `beforeAfter` uses two nested clip groups. If your Skia group clip does not follow the parent's baked translation, see section 7.
- Not yet verified on the real X80 renderer. Verified: structure, baked values, and a 2D preview of every mechanic.

## 6. Wire-up (blocks.mjs)

```js
// top of src/blocks.mjs
import { MECHANICS, compileMechanic } from './mechanics.mjs';

// inside compileBlock's switch, before `default:`
case 'calendarFlip': case 'counterRoll': case 'beforeAfter':
case 'receipt': case 'photoCam': case 'cardStack': case 'track':
  return compileMechanic(b, ctx, { fillOf, color, compile: compileList });
```
Then:
```bash
node src/cli.mjs check specs/mechanics-demo.json
node src/cli.mjs stills specs/mechanics-demo.json --at 0.4,1.6,2.8,4.4,5.8,8.0,9.6,11.0,12.2,13.5
node src/slideshow-lint.mjs specs/mechanics-demo.json
```
Add `slideshowLint` to `cli.mjs lint` so every Direct spec is scored.

## 7. If a still looks wrong (first-render checklist)
1. `beforeAfter` reveal shows the wrong side -> clip does not move with the group. Replace `R` with a rect-mask `raw` node, or draw `after` last and animate a `before` cover rect instead.
2. Digits clipped at the top or bottom -> raise `lineBox` (default 1.08) to 1.15.
3. Text baseline off in `calendarFlip` -> adjust `rowH` or `size`.
4. Gradient halo -> set `paper` explicitly and replace the fade stops with `rgba(<paper>,0)`.

## 8. Engine bug found while reading (fix this first)
`src/motion.mjs` `motionFns`: the `keyframes` branch computes `u` but never uses it. `pick()` returns `a`'s value, so `motion.keyframes` is a **step function**, not an interpolation. Mechanics avoid it (they bake directly), but any spec using `motion.keyframes` jumps. Fix:

```js
const pick = (k) => {
  const av = a[k], bv = b[k];
  if (av === undefined && bv === undefined) return base[k];
  if (av === undefined) return bv;
  if (bv === undefined) return av;
  return av + (bv - av) * u;
};
// and scale:
scaleX: lerp(num(a.scale, 1), num(b.scale, 1), u), scaleY: same
```

## 9. Next mechanics (in order)
`mapZoom` (pin drop, region zoom), `chatThread` (message bubbles), `screenshotZoom` (UI highlight), `tickerWall` (social proof), `bubbleChart`, `flipClock`, `priceTag`, `splitCompare`, `listCheck`, `quoteReveal`.
Each follows the same recipe: pure function of local time -> nodes, baked every frame, one clipped group per moving window.

# Custom Hyper - GRAND LIVING DOC

Last updated: 2026-11-01
Place at: `docs/GRAND_LIVING.md`. Complements `docs/LIVING.md` (engine state). This file = where we are going and in what order.

Read order for any agent: `LIVING.md` -> this file -> `AGENTS.md` -> `HYPERSPEC.md`. Then take the first unchecked task in section 9. Update both living docs after every task.

---

## 1. One-line product

An agency OS for digital marketing: pick a client, drop assets, write one prompt, get a storyboarded, fully editable Instagram reel/post/story, rendered deterministically by Custom Hyper. No Chrome, no per-frame LLM.

Users = agency management (us). Not end clients.

## 2. Scope rule

Build a **working prototype**, not the whole system. But every prototype choice must fit the full design (section 4-6). If a shortcut would be thrown away later, do not take it.

**Prototype cut (decided 2026-10-29):**
- One client only. No switcher, no CRUD, no metrics. Store description, goals, and optional design DNA in local data.
- Assets: drag and drop into the current project. Local storage. No watcher, no contact sheet, no vision indexer.
- Sound: not built. Keep the data slot only.
- Focus: script quality, on-screen text, fonts, planning, best way to show the idea, stitching, and element control.
- Storage is temporary local files behind `src/store.mjs`. Replace it later without changing callers.
- Image sources: procedural Skia first. Then per-frame image plan upload plus template MD and manifest JSON downloads. Image API and web search come after the prototype gate.

**Prototype done when** (single run, no manual JSON edits):
1. Enter one client profile: name, description, goals, optional palette/faces.
2. Drop 3 images into the current project.
3. Prompt: "15 s reel, launch of X". Get 5 rough boards.
4. Click "Plan all". Every board gets a real plan.
5. Edit one text and move one element. See the change in a still.
6. Render MP4. No clipped text, no invisible text, at least one visual per board.

## 3. Field-test findings (must fix first)

Source: user test of Main Direct and Main (agent) on 2026-10-29.

| # | Finding | Root-cause hypothesis | Fix (section) |
|---|---|---|---|
| F1 | Text cut off: last wrapped word half visible | Mask/clip height or box height computed from fewer lines than rendered; no fit step | 7.1 |
| F2 | Colors followed brief (b/w, orange/green) | Works. Keep `director.mjs` palette logic. | keep |
| F3 | Scripts read inhuman | Beat schema invites copy-speak; no style guide, no examples, no banned list | 7.3 |
| F4 | Zero visuals | Only text blocks emitted; no image source | 7.4 |
| F5 | Main (agent) worse than Direct: white bg, text invisible (fg = bg) | Agent hand-writes HyperSpec with no contrast guard and no mandatory lint | 7.2, 7.5 |

Assume F1, F3, F4, F5 apply to both Main and Direct until proven otherwise. Reproduce each before fixing. Add a fixture spec per bug under `specs/regress/`.

### 3.1 Firsthand confirmation (2026-10-29)

F1 root cause is in `src/blocks.mjs:102` `maskText`:
- It counts lines only by `\n`, not by real wrap. `const lines = String(b.text).split('\n').length`.
- The clip height uses that count. Skia wraps the text to `maxWidth` and draws more lines.
- Result: clip cuts the last wrapped line in half. Direct uses `mask: true` for every headline, so the bug is common.

F5 root cause is in the agent flow:
- `AGENTS.md` asks for stills, but `check` has no contrast test.
- A spec can set `fill: "#ffffff"` on a white `bg` and still pass.
- No template forces palette tokens. The agent can invent raw hex.

F3 root cause is in `src/llm.mjs`:
- `SYSTEM` has a short banned list, but no voice, no examples, no self-check.
- The schema gives equal weight to `headline` and `body`, so the model writes paragraphs in both.
- On-screen text is not separated from voiceover.

F4 root cause:
- `director.mjs` emits only text, shapes, and atmosphere. No image source is chosen.
- `assets` is never passed to the board planner.

## 4. Layered architecture

```
[ Dashboard UI ]      clients, assets, prompt, storyboard, crackdown editor
[ Product services ]  store, indexer, planner (LLM1), board planner (LLM2), morph, wrap, packager
[ Director ]          beats/plan -> HyperSpec (src/director.mjs). Deterministic code.
[ Engine ]            HyperSpec -> compile -> Skia -> H.264 (exists)
```

Rules:
- Engine knows nothing about clients or LLMs. JSON in, MP4 out.
- LLMs only appear in: asset indexing, rough plan, per-board plan, (optional) image generation. Never at render.
- Every LLM output is schema-validated. One repair pass max. Then fail loud.
- The **Board** is the unit of planning, editing, and caching.

## 5. Data model (JSON files first, behind a store interface)

Storage decision (was open): local folder, JSON files. Wrap in `src/store.mjs` (`get/put/list`) so S3/SQLite can replace it later without touching callers.

Prototype layout (one client):

```
data/
  client.json               name, description, goals[], designDNA?
  assets/                   dropped user files
  images/                  per-frame image PNGs + manifests (section 7.4)
  projects/<projectId>/
    brief.json              prompt, format, seconds, language
    rough.json              LLM1 output
    boards/<n>.json         board plan (LLM2) + status
    crackdown.json          canonical element table (section 6.7)
    crackdown.md            readable view, generated from json
    hyperspec.json          compiled output
    out/                    stills, mp4
```

Full layout (after prototype):

```
data/clients/<clientId>/
  client.json               name, description, goals[], designRefs[], designDNA?
  refs/                     dropped design reference images
  assets/                   user files (images, videos)
  assets.index.json         one entry per asset (below)
  images/                  per-frame image PNGs + manifests (section 7.4)
  projects/<projectId>/     same as prototype
```

`assets.index.json` entry:

```json
{ "id":"a_01", "file":"assets/shoe.jpg", "hash":"sha256...", "kind":"image",
  "desc":"white sneaker on orange backdrop, studio", "tags":["product","shoe"],
  "palette":["#F26B1D","#FFFFFF"], "w":2000,"h":2000,"transparent":false,
  "segments":[{"from":0,"to":3.2,"desc":"..."}], "indexedAt":"..." }
```

Key = content hash, not filename. Changed file => reindex.

## 6. The pipeline (product flow)

### 6.1 Client onboarding
- Step 1: name, description, design refs (drag/drop images, website links).
- Step 2: current goals/pain points.
- Design DNA (optional, best-effort): from ref images + fetched site CSS/colors, derive `palette`, `faces`, mood words. Store in `client.json`. Director uses it as default theme.

### 6.2 Asset library + background indexer (post-prototype)
Prototype skips this section. Drop files into `data/assets/`. Use filename, dimensions, and local palette only. No vision calls.

- Cheap Node watcher/scan on every load: list files, hash, compare to index, queue unindexed.
- **Images**: batch up to ~12 into one numbered contact-sheet collage -> one vision-LLM call -> per-image desc/tags. Number labels on cells so the answer maps back.
- **Videos**: ffmpeg frame grid with timestamps burned in -> one vision call -> overall desc + **segments** (time ranges with meaning). ffmpeg here is fine (indexing, not render).
- Also compute locally (free): dimensions, dominant palette, transparency, duration.
- Never block the UI. Show per-asset status: pending / indexed / failed.

### 6.3 New prompt -> LLM1 (rough plan)
Input: client description, goals, prompt, `assets.index.json` (desc+tags only, not binaries), format, seconds, language.
Output (schema): `boards[]` each with `idea`, `seconds`, `suggestedAssetTags`, `voiceover?`, plus `audioNeeds` (tts / music / none) and overall `angle`.
Board count is computed in code from seconds and pacing (about 3-5 s per board for reels), LLM may adjust within +-1.

### 6.4 Board UI, per-board planning (LLM2)
- Rectangular storyboard cards. Each has **Plan** button. Also **Plan all**.
- Prototype: LLM1 already returns the on-screen text and visual intent for every board. Code expands it. **Plan** on one card makes one LLM2 call to rewrite that board only. **Plan all** uses the LLM1 boards, so it costs no extra call.
- LLM2 per board gets: rough idea, neighbor boards' ideas, matching assets (picked locally by tag, then top-N passed), style DNA, script guide (7.3).
- Output: exact on-screen text (separate from voiceover), font roles, layout mode, asset ids, plus creative fields: `motion`, `reveal`, `lighting`, `texture`, `transition`, `elements`, `focal`, `sound`. Code then expands to blocks via `director.mjs`.
- Caching: key = hash(board inputs). Unchanged board = no new LLM call.

### 6.5 Morph pass (transitions via shared elements)
- Code pass after all boards planned. For each pair (A,B): choose an **anchor** element: last prominent element of A that can become first prominent element of B (same asset, same shape/color, or a mask shape).
- Implement as: anchor persists as a layer spanning both boards; keyframes interpolate x/y/scale/rotation/color across the handoff. Uses existing track model (layers overlap). Fallback = current transitions (wipe/flash/dip/band).
- Scoring is deterministic (rules), not LLM. Optionally LLM hints, never required.

### 6.6 Wrap pass
- Global texture (grain, vignette), persistent chrome (progress, ticker, masthead), background music slot (placeholder until audio phase).

### 6.7 Crackdown (element-level control)
- After compile, a JS pass walks the board scene and writes `crackdown.json`: one row per element.

```json
{ "board":2, "elId":"b2.title", "type":"text", "text":"...", "face":"display",
  "size":96, "fill":"ink", "x":80, "y":420, "w":920, "rotation":0,
  "src":null, "alt":null, "locked":false }
```

- `crackdown.md` is a human/agent-readable render of the same data. **JSON is canonical.** MD is generated, never parsed back.
- Editor ops per element: move, resize, rotate, edit text/font/size/color, swap asset, delete, add. Per board: re-plan, duplicate, reorder, delete.
- Edits patch `crackdown.json` -> recompile -> re-render still. Fast, no LLM.
- `locked:true` elements survive re-plan of that board.
- Stable element ids are required (`b<board>.<role>`), so edits survive recompile.

### 6.8 Package
- Render MP4, export stills, spec JSON, crackdown, and index snapshot into `out/`. One zip. Ship.

## 7. Foundation fixes (do before any product UI)

### 7.1 Text fit (fixes F1)
Implement `fitText` in compile, used by `text`, `kicker`, `cta`, `stamp`, `ledger`:
1. Measure with the same registered Skia font used at draw time. Never estimate.
2. Wrap by words to box `w`. Count real lines.
3. Box height = lines x size x lineHeight (+ descender pad). Clip/mask uses **this** height, not a one-line height.
4. If it overflows the allowed height: shrink size stepwise down to `minSize` (default 60% of requested). Still overflows: **throw** with block id, text, box. No silent clip.
5. Safe area (reel/story): 6% left/right, 8% top, 14% bottom (platform UI). Lint warns if text leaves it.
6. Add an optional `fit: {maxLines, minSize}` field on `text` and document it in HYPERSPEC.
7. Words must never split mid-word unless one word is wider than `w`; then shrink.
Tests: 6-word headline in narrow box, long single word, `\n` input, `maskUp` on 3 lines, Devanagari text.

### 7.2 Contrast guard (fixes F5 part 1)
- Resolve every text fill against the effective background behind it (nearest `bg`/rect/photo-tint, composite alpha).
- Require WCAG ratio >= 4.5 (3.0 for text >= 72px). Fail `check` if lower.
- Director auto-picks `ink` or `bg` by luminance when LLM/palette gives low contrast. Agent-authored specs get an error, not a silent change.
- Add palette sanity: `ink` != `bg`, `accent` readable on `bg`.

### 7.3 Script writing guide (fixes F3)
Create `prompts/script-style.md`, injected into every LLM1/LLM2 call (cacheable system block). Contents:
- Separate **voiceover** (spoken, natural) from **on-screen text** (fragments, big, <= 7 words/card).
- Write the way a sharp person talks to one friend. Contractions OK. Concrete nouns, numbers, verbs.
- Hook in first 1.5 s: a claim, a question, or a surprising number. Never "Introducing...", "Welcome to...".
- One idea per board. Last board = one clear action.
- Banned: unlock, elevate, seamless, game-changer, revolutionize, in today's fast-paced world, dive into, journey, leverage, "not just X but Y", em-dash pileups, triple-adjective lists.
- Reading speed: on-screen words <= ~3 per second of board time.
- Language param (en/hi/mr): write natively, not translated. Match script (Devanagari) and use short everyday words.
- Include 6-8 good/bad pairs from real agency copy. Include a **self-check list** the model runs silently before answering.
- Response schema forbids prose around JSON.
- Also test other models; Gemini flash-class output often needs the examples more than the rules.

### 7.4 Visual system (fixes F4)
Image sources, in build order. All resolve to local files before render. Render never touches the network.

| Src | What | Notes |
|---|---|---|
| A. Procedural | Seeded Skia art: duotone shapes, halftone, grain, geometric collage, big-type posters, icon glyphs | Free, offline, deterministic. Build first so no video is ever visual-less. New blocks: `shape`, `halftone`, `collage`, `glyph`. |
| B. Client assets | Dropped files, picked by tag from index | Already supported by `photo`/`image`. |
| C. Per-frame images (upload) | User supplies one transparent PNG per frame + manifest | See below. |
| D. Per-frame images (API) | Image model generates PNGs per frame, cached by prompt hash | Optional, behind a key. |
| E. Web image search | Fetched at author time, cached with source URL + license note | See caveat. |

Prototype order: A, then C. A removes the empty-video problem. C gives the user the template PNG and the ChatGPT reference MD. D and E wait for the prototype gate.
Do not scrape the Brave image page. It breaks and it violates the terms. Use the official Brave Search API when E starts.

**Per-frame image contract** (`images/<name>/` + `manifest.json`):
```json
{ "sheet":"mascot.png", "cell":512, "cols":4, "rows":4,
  "items":[{"id":"wave","col":0,"row":0,"tags":["greeting","hand"],"desc":"character waving"}] }
```
- New block `photo`/`image`: `{type:"photo", src, x, y, w, h, fit}`. Placed per frame from the manifest. Fail loud on unknown id.
- Validator: dimensions = cell x cols/rows, PNG has alpha, no empty cells unless listed.
- Director picks per-frame images by tag match against board plan, falls back to procedural (A).

**Downloads in the UI (Direct and later dashboard):**
1. **Template sheet PNG**: grid with labeled cells (id slots), guide lines, transparent background.
2. **Reference MD** for ChatGPT: explains the grid, cell size, transparent background requirement, style (from client design DNA), a table of the slots to fill (ids + tags + what to draw, generated from the current brief/client), consistency rules (same line weight, palette from `palette`), and the manifest JSON to return alongside the PNG.
3. Upload box accepts PNG + JSON, runs the validator, shows a preview grid.
Give the user both files in one click (zip) plus individual buttons.

**Print look (Direct, built 2026-10-30):** The reference is a HyperFrames-style editorial reel: warm paper, black condensed caps, one red accent, micro mono chrome, duotone photos, charts, year cards, stamps.
- Implemented in `src/director.mjs` as a separate print branch. `look=print` selects it; `look=cinema` keeps the older dark layouts.
- Core parts: paper ground with thin red frame and corner ticks, ruled header, bottom caption strip with page ticks and progress, ghost numeral, data strip, rotated red stamp.
- Type: Bebas Neue display, per-line two-tone headlines (last line red), Space Grotesk body, IBM Plex Mono chrome. One red accent only.
- Data frames: 12-bar black-to-red chart, year cards, timeline, ledger, stat rail.
- Brand lock: user accent, paper, and ink are kept. Only lightness moves for contrast. No hue shift.
- Direct shows a contact sheet: one still per beat, timecode and headline captions.
- Not built: photo/stock imagery, halftone block, real morph between print frames.

**Web search caveat (E):** Scraping Brave's image page is brittle and often breaks its terms. Prefer the official Brave Search API image endpoint (key, free tier). Rules: author-time only; store `source` and `license` in a sidecar; prefer permissive licenses; show attribution warning in UI; background removal as a separate local step (try an ONNX model), never assume transparency; user can reject any result. Build this last of the image options.

### 7.5 Main (agent) hardening (fixes F5)
- `AGENTS.md` update: agent must run `check` (now includes fit + contrast) and `stills` at 3 times, **look at them**, before `render`.
- Add `node src/cli.mjs lint <spec>`: contrast, fit, safe area, empty layers, no-visual boards, linear entrances, tiny text (< 36px at 1080w). Exit code non-zero on error.
- Agent must start from a template spec in `specs/` and change content, not invent structure. Provide 3 templates: product promo, text poster, stats/ledger.
- Ban white-on-white by construction: templates reference palette tokens only, never raw hex for text.
- Agent reads `prompts/script-style.md` before writing copy.
- Do not trust agent success claims. Require pasted command output (see update rules).

## 8. Design principles for the dashboard

- UI references are in `docs/ui-refs/` (`margin-overview.jpg`, `margin-job.jpg`, `margin-leakage.jpg`). Read them before any UI task.
- Reference language: off-white canvas, near-black sidebar, orange brand accent, pink heatmaps, 14-18px rounded cards, thin borders, dense data, small mono labels, one strong number per card. Calm and precise, not neon.
- Prototype UI: one light page. Left: client profile and asset drop. Centre: brief, seconds, format, generate. Right: board strip and element editor. Keep the same card and spacing language as the references.
- Stack: keep it dependency-light. Plain ES modules + a small component layer, or Vite/React if the references demand it. Decide once, record in section 11. Prototype default: plain ES modules in `public/`, served by `server.mjs`.
- Top bar: client switcher (add/edit/remove). Left nav: Assets, Projects. Main: board strip + crackdown editor + preview pane.
- Preview = deterministic stills from the engine (fast, scale 0.5), not a live DOM. Show a still per board; re-render only the changed board.
- Long jobs: job queue with progress polling (exists). Extend to indexing and per-board stills.
- Keys: browser holds API keys per session; server forwards, never writes or logs.

## 9. Build sequence (follow strictly)

Each task: do, run its test, paste evidence in `LIVING.md` sec 6, tick the box.

### P0 - Foundation (no product UI until all done)
- [x] Repro F1 and F5 as fixtures in `specs/regress/`
- [x] 7.1 mask clip height uses real `layoutText` wrap (F1)
- [x] 7.1 `fit` field, shrink-to-fit, overflow throw; update `HYPERSPEC.md`; fixtures f6-f9
- [x] 7.2 contrast guard in `check`; palette check
- [x] `lint` command (7.5); fit-aware safe area, tiny text, low opacity
- [x] 7.3 `prompts/script-style.md`; wired into `llm.mjs`; `vo` field added
- [ ] 7.3 compare 3 briefs with a real key
- [x] Visual planning schema: plan `idea/audience/tension/proof/motif`, beat `job/visual/shot/weight`; quality gate with one repair
- [x] Director uses `shot` for layout, `visual`/`motif` for asset and image match, `weight` for timing
- [x] Fix stale section 10 of `LIVING.md` (real files: `src/director.mjs`, `src/llm.mjs`)
- [ ] 3 template specs; update `AGENTS.md`
**Gate:** the 3 regress fixtures pass; a Direct run on 3 different briefs shows no clipped or low-contrast text.

### P1 - Visuals
- [x] Procedural blocks (A) + director uses them when a board has no asset
- [x] `photo`/`image` block, manifest validator
- [x] Template PNG + reference MD generator, download buttons, zip
- [x] Image plan upload UI + preview
- [ ] Director visual-per-board rule (lint error if a board has none)
- [ ] D (image API) behind a key, cache by prompt hash
- [ ] E (Brave API, author-time, licensed sidecar), background-removal step
**Gate:** every board in a test reel has a visual with zero API keys.

### P2 - Prototype app shell (single client, local)
- [x] `src/store.mjs` + `data/` layout (sec 5)
- [x] One client form: name, description, goals, palette, faces
- [x] Drag-drop assets into `data/assets/`; show thumbnails (dimensions not shown)
- [x] Brief form: prompt, seconds, format, provider, key, language en/hi/mr
**Gate:** client and assets survive a server restart. No indexer, no switcher.

### P3 - Storyboards + script
- [~] LLM1 rough plan + board count logic built (sec 6.3); visual fields added; not tested with a real key
- [x] Board cards and stills work; Plan all rebuilds from the saved plan; per-board Plan uses LLM2
- [x] Plan quality gate: visual, shot, weight, proof, no banned copy; one repair pass
- [~] Script guide wired into `llm.mjs`; `vo` field kept. Not tested with a real key.
- [x] Director picks a visual per board: asset, image, or procedural
**Gate:** prototype steps 3-4. Read all 5 scripts. No corporate filler.

### P4 - Control + stitch + render
- [x] Stable element ids in editor output
- [~] `crackdown.json` generator and export work; `crackdown.md` view not built
- [x] Editor: live DOM stage, text/font/size/color/opacity/align, shape fill/stroke/radius, media swap, lock, rotate, palette; one-row patch
- [ ] Morph anchor pass, fallback to existing transitions
- [ ] Wrap pass: grain, chrome, progress
- [x] Render MP4 and stills work; spec and crackdown export work
- [x] Print look for Direct: brand lock, topic lock, ten editorial layouts, two-tone type, caption chrome, data frames
- [x] Contact-sheet preview: one still per beat with timecode and headline
- [x] Quality gate fix: require a number only when the brief gives one
- [ ] Photo/stock plates in Direct (main gap vs the reference sheet)
- [ ] Real-key visual test on print and cinema looks
**Gate:** prototype steps 5-6. Print gate: every frame reads as one system; no clipped type; one red accent.

### P5+ - After the prototype gate
Only start when the prototype gate passes. Full order:
- [ ] Store + client CRUD + switcher + design DNA
- [ ] Asset indexer: contact sheet, vision call, video segments
- [ ] Image API per-frame images (D), Brave API search (E)
- [ ] Packager zip, cost meter
- [ ] Audio: TTS voiceover, music, beat cuts
- [ ] Lite upload surface
- [ ] Video clip blocks (X80 media packages)

### P6 - Ship (old full list, keep for reference)
- [ ] Packager zip
- [ ] Cost meter (tokens in/out, per project)
- [ ] Audio: TTS voiceover track, music slot, beat-aligned cuts
- [ ] Lite upload surface (JSON + assets, no LLM)
- [ ] Video clip blocks (X80 media packages)

## 10. Agent tips

1. Read before write. Never rebuild finished work. Check section 1 of `LIVING.md` first.
2. Smallest vertical slice first. Get one board to a still before building the editor around it.
3. Always look at stills. Passing `check` does not mean it looks right. Render at 3 times: start, middle, end.
4. Use palette tokens for text, never raw hex.
5. Prefer code over LLM. If a rule can be a function, make it a function.
6. Every LLM call: system prompt cached, JSON schema, no history, one repair, then fail with a clear error.
7. Never put images, video, or binaries in prompts except the contact sheet for indexing.
8. Keep ids stable. Edits, caching, and morph all depend on it.
9. Cache on spec hash + frame hashes, never on MP4 bytes.
10. Font fallback is silent in Skia: register every face, view a still.
11. Do not edit shared X80 packages without checking X80 Studio/Lite still work.
12. Keep `LIVING.md` < 300 lines; push detail to topic docs. Keep this file as the plan.
13. Do not claim success without a command, path, or screenshot.
14. If a decision is not in this file, make the simplest reversible choice and log it in section 11.

## 11. Decisions log

- 2026-10-29: JSON-file store behind `store.mjs` (asset storage question closed for prototype).
- 2026-10-29: Crackdown JSON canonical; MD generated.
- 2026-10-29: Per-frame image MD + manifest JSON downloads required in Direct UI.
- 2026-10-29: Web image search via official API at author time only; no render-time network.
- 2026-10-29: Prototype is single-client, local files, no indexer, no audio, no switcher.
- 2026-11-01: API key, provider, model, language, seconds, and format live in `data/settings.json` (mode 0600). Browser storage is not used because it is per-port.
- 2026-11-01: Beat plan now carries creative fields. The director renders camera move, reveal, light wash, texture, and per-boundary transition. `elements` drives asset matching, not separate drawn layers yet.
- 2026-11-01: Asset meaning is tracked in `data/assets.index.json` plus generated `data/assets.md`. Indexing is one vision call per batch. Missing and stale files are flagged. Re-index is manual.
- 2026-11-01: Plan defects are repaired in code before validation. Board rewrite gets one JSON retry. Contrast errors are auto-fixed on build and replan.
- 2026-10-29: Prototype UI stack = plain ES modules in `public/`, served by `server.mjs`. No build step.
- 2026-10-29: UI language follows `docs/ui-refs/` (Margin): off-white, near-black sidebar, orange accent, pink data heat, dense rounded cards.
- 2026-10-29: Brave image page scraping rejected. Use the official Brave Search API if E is built.
- 2026-10-29: Editor scope for prototype = form fields plus drag on a still overlay. Full canvas handles later.
- Open: Audio source. Design DNA depth. Pricing table for cost meter.

## 12. Risks

- LLM copy quality is the biggest product risk. Invest in examples and a regression brief set.
- Morph logic can look gimmicky; keep deterministic scoring and a plain-transition fallback.
- Indexer cost grows with library size; hash cache and batching are mandatory.
- Licensing of scraped or generated imagery: store source and license, surface in UI.
- Editor needs stable ids; retrofit is painful, so do it in P5 start.
- 1080p renders are about 4x proxy cost; edit with proxy, render full only on ship.

## 13. Session log

### 2026-10-29 - Grand plan written
- Captured field-test findings F1-F5 and the full product vision.
- Defined data model, pipeline, fixes, and phase order. No code changed.

### 2026-10-29 - P0 started
- F1 fixed: `maskText` uses `layoutText` for real lines and clip height. Fixture renders all 5 lines.
- F5 fixed: `src/lint.mjs` catches contrast 1.00. `check` fails on error. New `lint` command.
- F3 started: `prompts/script-style.md` wired into `llm.mjs`. Plan now has `vo`.
- Evidence in `LIVING.md` section 6.

### 2026-10-29 - Prototype scoped by opencode
- Read the 3 UI references. Recorded the Margin visual language in section 8.
- Cut scope to one client, local files, no indexer, no audio, no switcher.
- Confirmed F1 root cause in `src/blocks.mjs:102` `maskText`: clip height counts `\n` only, not real wrap.
- Confirmed F5 root cause: no contrast check in `check`; agent can use raw hex.
- Reordered build: P0 foundation, P1 visuals, P2 shell, P3 boards, P4 control and render.

### 2026-10-29 - Visual editor, fit, image plan
- Rebuilt the portal editor with a real stage, drag/resize/rotate, inspector, locks, and asset/image swap.
- Added per-frame image template MD, manifest JSON, zip, upload, and preview.
- Added `fit` and fit-aware safe-area lint, with f6-f9 fixtures and inspected stills.
- Added Plan all and spec/crackdown export. Real-key board and script tests still open.

### 2026-10-29 - Director fit regen and end-to-end demo
- `src/director.mjs` `fitBlock` now uses real `layoutText` and rejects punctuation-start lines; regenerated six-second reel at seed 633442571: board 3 headline `LATENIGHT,\nWITHOUT\nTHE NOISE` y=247 h=491, body y=740, no overlap. Still f87 inspected OK.
- End-to-end demo verified: generate -> 5 boards/5 stills, plate OK, `plan-all` OK, element patch lock survives rebuild, render path verified.

### 2026-10-30 - Direct print reels

- Rebuilt the Direct look as an editorial print system: paper, red frame, ruled header, caption strip, data strip, ghost numeral, ten layouts. `look=cinema` keeps the old branch.
- Added two-tone per-line headlines, dense 12-bar charts, year cards, rotated stamps. Headline lines are separate mask blocks so each line can hold a color.
- Brand palette is locked end to end: UI pickers -> `/api/generate` -> `makePalette`. Hue never shifts; lightness lifts only for contrast.
- Topic fidelity: local director builds from the brief's subject, copy, and numbers. LLM prompt has TOPIC LOCK and temperature 0.62. Quality gate no longer demands a number when the brief has none.
- Direct now renders one still per beat and shows a 4-column contact sheet with timecode and headline. `lint` now follows group offsets.
- Evidence: 3 briefs, 0 errors and 0 warnings; 4-beat API run returns 4 captioned stills; MP4 540x960, 360 frames, 12.000 s. Real-key test still open.
- Open: photo plates, halftone block, morph between print frames.

### 2026-10-30 - Live DOM storyboard editor (worker scope)

- `src/prototype.mjs`: `projectElements`/`sceneFor` normalize all editable blocks and flatten groups into absolute child rows (`id`, `parentX`, `parentY`, `z`, `editable`); `patchElement` is partial/fast (element only, no stills unless `render: true`); added `renderBoardStill` and `patchPalette`; `applyLocks` restores absolute `x`/`y` on re-plan.
- `server.mjs`: `GET /public/*`, `GET /fonts/*` (X80 font cache), `POST .../board/:id/still`, `PATCH .../palette`; `.ttf` MIME.
- `public/editor-model.js` (new): pure CSS/font/asset helpers, no DOM, unit-tested.
- `public/editor.js` + `public/editor.css` (new) + `public/app.html`: editor opens from project scene, no plate image; live DOM stage with drag/resize/rotate/inline text/font/size/color/lock/asset swap; one PATCH returns one element, no stills, no full refresh; one thumbnail refreshes via board still.
- Verified: fast patch ~11 ms, all new routes 200, fonts 200; `test/editor-model.test.mjs` and `test/editor-api.test.mjs` pass.

### 2026-10-30 - Leader review: editor repaired

- Rebuilt the editor stage so it opens from the project scene, fits the viewport, and renders background, blobs, chrome, text, shapes, photos, images, and sprites as DOM nodes.
- Drag, resize, rotate, inline text, inspector, palette, keyboard nudge, and asset drop now work. One edit sends one row patch; one thumbnail refreshes after idle.
- Fixed the worker handoff: patch body shape, null media URLs, circle center coordinates, unique ids, group offsets, chrome source, still time, palette bg, and missing still fonts.
- Added a font index so the browser loads only real weights. Tests pass; visual check pending leader.

### 2026-10-30 - Visual thinking added to planning

- Plan schema now carries `idea`, `audience`, `tension`, `proof`, `motif`. Each beat carries `job`, `visual`, `shot`, `weight`.
- System prompt now gives a 9-step planning method. Visual comes before copy. Visual must be concrete and filmable.
- `validatePlanQuality` fails a weak plan and uses the existing one-repair pass. Rules: visual per beat, valid shot and weight, proof, short hook, no banned words.
- Director maps `shot` to layout, matches assets and images by `visual` and `motif`, and uses `weight` for beat timing.
- Synthetic 12 s roof test: 0 lint errors; timing is weighted. Real-key test still open.

### 2026-10-30 - Main Direct art direction and frame planning

- One LLM call now art-directs every beat. New beat fields: `composition` (single/split/panorama/diagram/grid/stack/type/object/portrait), `layout`, `asset`. Schema, prompt, and quality gate enforce them. No extra call; one repair pass unchanged.
- Assets are passed to the plan call as ids and names. The director uses the named asset or none. The old arbitrary `pool[i % pool.length]` fallback is gone.
- Palette is curated locally: neutral bg, off-white ink, one accent clamped in saturation and lightness. Raw neon palettes are rejected before render.
- `src/scenes.mjs` now builds 25 semantic scenes (meter, bill, panel, house, person, chart, battery, calendar, shield, key, and more) with a background field, composition zones, and motion. No vision model.
- Layout fixes: CTA always uses the CTA layout; rail requires a stat; grid requires items; stats shrink to one line; headline uses weight 700 and word-based fit, so mid-word breaks stop; photo frames get a scrim; split shows list items; minimal centers single/type beats.
- Verified: `verify` ok; `check signal-16s` ok; `lint` demo spec 0 errors; 12 s MP4 540x960, 360 frames, 2.78 MB, 15.3 s. Stills inspected for the old blue/green plan, a synthetic 4-beat plan, and a no-key demo. Real-key test still open.

### 2026-11-01 - Creative plan, repair, and asset index

- Settings persist server-side and survive port changes. Studio and Direct load and save them.
- Added creative beat fields and rendering, local storyboard parsing, deterministic plan repair, board JSON retry, contrast autofix, and a UI fix button.
- Added asset vision index with `assets.index.json` and `assets.md`, missing and stale flags, and prompt injection.
- Studio upload appends one asset cell. Studio presets fill client and brief.
- Open: visual inspection of new stills, full MP4 render, per-element drawing, sound, auto re-index, regression tests.

# Custom Hyper - Living Document

Last updated: 2026-11-01
Status: Core, Direct, and the Studio prototype portal work. Lite not built.

This file is the source of truth for engine state. Read it before any work. Update it after any work. Product vision and build order live in `docs/GRAND_LIVING.md`.
## 0. Resume here

If access is lost, a fresh agent can continue from this file alone.

1. Read this file, then `docs/GRAND_LIVING.md`, then `AGENTS.md`, then `HOW_TO_USE.md`.
2. Run `node src/cli.mjs verify specs/minimal-3s.json --at 1.5`.
3. Run `node src/cli.mjs check specs/signal-16s.json`.
4. Read `docs/HYPERSPEC.md` before editing the spec format.
5. Pick the first unchecked task in `GRAND_LIVING.md` section 9. Do not rebuild finished work.
## 1. What works now

| Area | State | Evidence |
|---|---|---|
| JSON compiler | Works | `src/compile.mjs`, `node src/cli.mjs check` |
| Block library | 23 types incl. `photo`/`image` | `src/blocks.mjs` |
| Transitions | 5 types: wipe, flash, dip, band, cut | `src/compile.mjs` |
| Motion | 12 named easings, baked keyframes | `src/ease.mjs`, `src/motion.mjs` |
| Renderer | Skia, no browser | `src/render.mjs` |
| MP4 | In-process H.264 | `engine/encoding`, ffprobe verified |
| Stills | PNG, deterministic | `verify` passes across two processes |
| Fonts | 25 owned face files | `fonts/cache`, includes Bebas Neue |
| Demo | 16 s vertical, 6 layers | `specs/signal-16s.json` |
| Proxy MP4 | 540x960, 480 frames, 16.000 s | `out/signal-16s-540.mp4` |
| Agent flow | Documented and runnable via opencode | `AGENTS.md`, `HOW_TO_USE.md` |
| Main Direct UI | Web UI at `/direct`, one LLM call, local expansion, job queue | `server.mjs`, `public/index.html`, `src/director.mjs`, `src/llm.mjs` |
| Direct render | MP4 queue, progress poll, file download | `POST /api/generate`, `POST /api/render`, `GET /api/job/:id` |
| Direct contact sheet | One still per beat (up to 8), 4-column grid, timecode and headline captions | `server.mjs` `makePreview`, `public/index.html` |
| Print design system | Paper field, red frame, corner ticks, header rule, footer band, data strip, ghost numeral, duotone photo | `src/director.mjs` `composePrint*`, `printChrome`, `groundLayer` |
| Brand palette lock | Exact accent, bg, and ink are kept; lightness lifts only for contrast | `src/director.mjs` `makePalette` |
| Direct look + brand UI | Accent/paper/ink pickers, print or cinema look, saved in the tab | `public/index.html`, `server.mjs` `makePreview` |
| Demo topic fidelity | Subject, brief sentences, and real numbers only. No invented stats | `src/director.mjs` `demoPlan` |
| Local preview | No API key, same director | `demo=true` on `/api/generate` |
| Text fit | Mask clip height uses the real Skia wrap; `fit:{maxLines,minSize}` shrinks or throws | `src/blocks.mjs` `maskText`/`fitTextBlock`, `specs/regress/f6-f9` |
| Lint | Contrast, fit-aware safe area, tiny text, low opacity | `src/lint.mjs`, `node src/cli.mjs lint` |
| Script guide | Voice, banned list, examples, self-check | `prompts/script-style.md`, `src/llm.mjs` |
| Visual planning | Plan requires idea, audience, tension, proof, motif; each beat has visual, shot, weight; quality gate with one repair | `src/llm.mjs` `validatePlanQuality`, `src/director.mjs` |
| Separate voice | Plan has `vo` field, on-screen text stays short | `src/director.mjs` `normalizePlan` |
| Studio portal | One client, asset drop, brief, boards, edit, MP4 at `/` | `public/app.html`, `src/prototype.mjs` |
| Local store | `data/client.json`, `data/assets/`, `data/projects/<id>/` | `src/store.mjs` |
| Visual per board | Uploaded asset as tinted bed, else procedural shapes | `src/director.mjs` `visualBlock` |
| Visual editor | Live DOM stage from scene: background, blobs, chrome, text, shapes, media; drag/resize/rotate, inline text, locks | `public/editor.js`, `public/editor.css`, `public/editor-model.js` |
| Element edit | Text, face, size, color, opacity, align, shape fill/stroke/radius, asset swap; one row only, no stills | `PATCH /api/p/project/:id/element` |
| Board refresh | One thumbnail after idle; palette edit restyles the stage without reload | `POST .../board/:id/still`, `PATCH .../palette` |
| Image plan | Per-frame MD, manifest JSON, PNG+JSON upload, preview | `src/images.mjs`, `/api/p/image/*`, `/api/p/images` |
| Plan all | Rebuild all boards from the saved plan, keep locks | `POST /api/p/project/:id/plan-all`, `src/prototype.mjs` `rebuildProject` |
| Export | Spec JSON and crackdown JSON | `GET /api/p/project/:id/export/spec|crackdown` |
| Local settings | Key, provider, model, language, seconds, format persist in `data/settings.json` (mode 0600); server uses them as fallback | `src/store.mjs`, `GET/PUT /api/settings` |
| Studio presets | 5 example chips fill client, palette, face, brief, length, format, language | `public/app.html` `PRESETS` |
| Creative plan | `motion`, `reveal`, `lighting`, `texture`, `transition`, `elements`, `focal`, `sound`; director renders moves, reveals, light and texture; local storyboard parser | `src/director.mjs`, `src/llm.mjs` |
| Auto repair | Plan defects fixed in code; board JSON retry; contrast auto-fix on build/replan plus `POST .../fix-contrast` | `src/llm.mjs`, `src/lint.mjs` |
| Asset index | `data/assets.index.json` + `.md`, batch vision, stale and missing flags; `sprite` aliases `image` | `src/assets.mjs`, `src/blocks.mjs` |
| Mechanics | 7 composites: calendarFlip, counterRoll, beforeAfter, receipt, photoCam, cardStack, track; planner picks one per beat | `src/mechanics.mjs`, `src/director.mjs`, `docs/MECHANICS.md` |
| Video assets | Upload or URL, library or temp; ffmpeg samples 6-24 frames plus a contact sheet; vision returns desc, tags and 2-5 segments; `video` block plays the frames | `src/video.mjs`, `src/assets.mjs`, `src/blocks.mjs`, `docs/VIDEO.md` |
| Explain scenes | 9 drawn devices: flight, spiral, zoom, map, growth, compare, process, orbit, timeline; auto-picked from the beat text, plus year to calendarFlip | `src/explain.mjs`, `src/director.mjs`, `docs/EXPLAIN.md` |
| Portable agent kit | Canonical agent contract, capability manifest, recipes, review command, GitHub render workflow | `AGENTS.md`, `docs/AGENT_API.md`, `agent/capabilities.json` |
## 2. What does not work yet

- No Lite upload surface.
- No audio or video clips.
- No image generation or stock image search.
- No HTML/HyperFrames import.
- Lint covers contrast, fit-aware safe area, tiny text, and low opacity. No empty-layer or no-visual check.
- MP4 bytes are not stable across runs. Pixels are stable. See section 6.
- BUG F3 open: script guide is wired, but no real-key before/after test on 3 briefs yet.
- No real per-frame art yet. Only the labeled template is tested. No browser automation test of the editor (hard rule: no Chrome).
## 3. Surfaces and names

| Name | Meaning | Status |
|---|---|---|
| **Custom Hyper** | The engine and CLI in this folder. JSON in, MP4 out. | Works |
| **Custom Hyper Main** | LLM authoring. Entry A is opencode with this repo. Entry B is Main Direct. | Agent entry works |
| **Custom Hyper Main Direct** | Web UI for Main. User supplies an LLM API key. One compact call, local expansion. | Works |
| **Custom Hyper Lite** | Upload JSON and assets. No LLM, no API key. Same compiler. | Not built |
| **X80 Studio** | Old full product at `../x80-video-engine/`. | Works, untouched |
| **X80 Lite** | Old no-API upload page. | Works, untouched |

Rules:

1. "Main" means LLM authoring. "Direct" means the web UI form of Main. "Lite" means no API.
2. Do not merge old X80 entry points with Custom Hyper.
3. Do not promise MP4 byte determinism. Promise frame determinism.
## 4. Repo map

```
custom-hyper/
  AGENTS.md              agent operating rules
  HOW_TO_USE.md          user guide
  README.md              short overview
  docs/
    LIVING.md            this file
    HYPERSPEC.md         JSON contract
    PHILOSOPHY.md        design rules
    NAMING.md            product names
  public/
    app.html             Studio prototype portal
    index.html           Main Direct UI
  src/
    cli.mjs              check | lint | plan | stills | render | verify
    compile.mjs          HyperSpec -> X80 VideoPlan
    blocks.mjs           block library
    motion.mjs           motion sampler and bake
    ease.mjs             easing table
    render.mjs           fonts, assets, PNG, MP4
    director.mjs         plan -> HyperSpec, visual per board
    llm.mjs              one compact LLM call
    lint.mjs             contrast guard
    store.mjs            local client, assets, projects
    prototype.mjs        build, edit, stills for the portal
    index.mjs            public exports
  data/                  local portal data (disposable)
  specs/
    signal-16s.json      main demo
    minimal-3s.json      smoke and determinism fixture
  assets/                demo images
  out/                   plans, stills, MP4
```
## 5. Commands

```bash
node src/cli.mjs check  specs/signal-16s.json
node src/cli.mjs plan   specs/signal-16s.json
node src/cli.mjs stills specs/signal-16s.json --at 0.8,7.2,14.2
node src/cli.mjs verify specs/signal-16s.json --at 0.8,7.2,14.2
node src/cli.mjs render specs/signal-16s.json --scale 0.5
```

`--scale 0.5` renders a 540x960 proxy from the 1080x1920 spec. Stills stay full size unless `--scale` is given.
## 6. Verified evidence

- `verify` on `signal-16s.json` at 0.8, 7.2, 14.2 s: `ok: true`, equal SHA-256 in two child processes.
- ffprobe on `out/signal-16s-540.mp4`: h264, 540x960, 30/1 fps, 480 frames, 16.000 s.
- Render time: 29.0 s for 480 frames at 540x960, including font boot and encode.
- Direct UI: `POST /api/generate` returns style signature and one still per beat. `POST /api/render` queue reaches `done`. ffprobe: 300 frames, 10.000 s at 0.5 scale.
- Direct LLM path tested with mock OpenAI-compatible server: one call, plan expansion, stills render.
- Six full-size stills and three decoded MP4 frames inspected. Layout, type, and motion are coherent.
- MP4 bytes differ across runs. Tested software, realtime, CBR, and L1T1 settings; all were unstable. The encoder is multi-threaded. This is documented, not hidden.
- 2026-10-29 recovery: `verify minimal-3s` equal SHA-256; `check signal-16s` -> 1080x1920@30, 480 frames, 25 fonts.
- 2026-10-29 recovery: Direct demo `/api/generate` -> 3 stills. `/api/render` -> 300 frames in 7.4 s. ffprobe: h264, 540x960, 30/1, 10.000 s.
- 2026-10-29 F1: `specs/regress/f1-text-wrap.json` showed the last wrapped line cut in half. After the `layoutText` fix, all 5 lines render.
- 2026-10-29 F5: `specs/regress/f5-invisible.json` fails `lint` and `check` with contrast 1.00.
- 2026-10-29 lint: `signal-16s`, `minimal-3s`, and all Direct specs pass with 0 errors. Remaining warnings are accent kickers below 4.5.
- 2026-10-29 Studio: demo flow saved client, uploaded `panel.png`, generated 5 boards and 5 stills, edited `beat-01` headline, rerendered its still, and produced a 540x960 MP4 of 360 frames in 15.3 s.
- 2026-10-29 Studio: lint rejected decorative blend shapes as text backgrounds. Fixed in `src/lint.mjs`; only normal-blend rects count as backing cards.
- 2026-10-29 fit: `check specs/regress/f6-fit-narrow.json` -> `ok: true`, 0 warnings, 240x53 text box. `f8-fit-devanagari.json` and `f9-fit-maskup.json` -> `ok: true`, 0 warnings. Stills at 1.5 s inspected: 2 lines, 2 Devanagari lines, 3 mask-up lines, no clipping.
- 2026-10-29 fit overflow: `check specs/regress/f7-fit-overflow.json` fails loud with `Error: text fit overflow (id L1.0): "UNBREAKABLE" box 120x120 needs 5 lines at min size 100`.
- 2026-10-29 plan-all: `POST /api/p/project/a-quiet-electric-scooter-rr/plan-all` -> `True 5 19 5 None` (ok, boards, elements, stills, error).
- 2026-10-29 editor API: patch x/y/lock -> ok, 5 stills; image plan swap -> `True image a0 5 None`. UI script `node --check` clean; `/` serves it; `bootstrap` -> `True 3 1 Acme`.
- 2026-10-30 Direct print: three demo briefs rendered to stills. Print specs pass `lint` with 0 errors and 0 warnings. Brand run keeps `#983b1f` accent and `#ede6d8` paper.
- 2026-10-30 Direct print MP4: `out/direct/print-check.mp4`, h264 540x960, 30/1 fps, 360 frames, 12.000 s, 2.83 MB, 11.5 s render.
- 2026-10-30 Direct API: `/direct` 200 with brand pickers; `POST /api/generate` returns `look: print`, brand accent unchanged, beats from the brief only.
- 2026-10-30 contact sheet: 4 beats -> 4 stills with index, time, headline. `/direct` 200; caption CSS present.
- 2026-10-30 print type: two-tone headlines, caption strip, 12-bar chart, year cards, rotated stamp. Lint follows group offsets. 3 briefs: 0 errors, 0 warnings.
- 2026-11-01 settings: keys persist in `data/settings.json`; restart on port 8097 returned the same values. `/` and `/direct` scripts pass `node --check`.
- 2026-11-01 creative: 4-board scooter brief produced 4 boards and 4 stills with per-beat motion, reveal, light, texture. `fixSpecContrast` cleared f5. `repairPlan` fixed grid/rail. Vision indexed 3 assets in one call.
- 2026-11-01 tests: `editor-model` pass; `editor-api` pass on 8099; `check specs/test-storyboard.json` ok.
- 2026-11-01 mechanics merge: `check specs/mechanics-demo.json` ok (7 layers, 25 fonts); 10 stills render; slideshow lint PASS score 100; 4 synthetic planner beats render calendarFlip, counterRoll, cardStack; `minimal-3s` and `signal-16s` still check ok.
- 2026-11-01 remote: server ran with `HOST=0.0.0.0` on 8098; `/` and `/direct` 200; the localtunnel URL served the Studio page and `/api/p/bootstrap` 200. The earlier `127.0.0.1`-only start was invisible to the browser.
- 2026-11-01 video: 3 s 720x1280 test clip ingested to 15 frames at 5/s plus a 1310x2302 contact sheet; `check` and 3 stills on a spec with one `video` beat pass; frames differ across 0.2 s, 1.0 s, 2.2 s.
- 2026-11-01 tunnel: localtunnel dropped twice (408). Moved to a Cloudflare quick tunnel. `https://<random>.trycloudflare.com`, `/direct`, and `/api/p/bootstrap` all returned 200.
- 2026-11-01 explain: 4 beats with explicit flight, spiral, growth, zoom render `check` ok; 4 stills inspected; 8 layers, 25 fonts.
- 2026-11-01 server: no OOM and no crash stack in `out/server.log` (19 GB free). Process was killed externally. Added `scripts/serve.sh` loop; killing the node child produced a new PID and `/` 200 within 4 s. Uploads over 40 MB now chunk at 8 MB; 12 MB single via tunnel 200, 3-chunk 12 MB `done:true`.
## 7. Architecture

```
HyperSpec JSON
  -> validate
  -> compile blocks to X80 scene nodes
  -> bake motion to keyframes
  -> Skia surface per frame
  -> WebCodecs H.264
  -> MP4
```

No DOM, CSS, Chrome, network, or LLM at render time. Local runtime: `engine/core`, `engine/skia`, `engine/effects`, and `engine/encoding`.
## 8. Decisions locked

1. Track-based composition, not act-based. Layers overlap and live across beats.
2. JSON is the source of truth. Motion is baked at compile time.
3. Fail loud. Missing asset, font, layer, or block throws.
4. Old X80 products keep their names, paths, and ports.
5. Frame determinism is the promise. MP4 bytes may vary.
6. Main Direct must make one compact LLM call, not a chat loop.
7. No per-frame LLM calls, no vision loop, no "try until good".
## 9. Roadmap

Engine phases 1-3 are done: core, agent flow, Direct UI. The Studio prototype portal is built for P3/P4 core flow. Lite is not built.

The active roadmap is the prototype build in `docs/GRAND_LIVING.md` section 9:

1. P0 - done: F1, F5, F3 guide, fit, fit-aware safe-area lint, visual planning schema and quality gate. Open: 3 template specs, real-key script and visual test.
2. P1 - done: procedural visuals, per-frame image plan, validator, MD + manifest + zip, upload UI. Open: real per-frame art, no-visual lint.
3. P2 - done: client store, asset drop, brief form, language, palette/faces.
4. P3 - done: demo boards, stills, visual per board, Plan all, per-board Plan, visual thinking fields. Open: real LLM boards.
5. P4 - done: visual editor, locks, asset/image swap, crackdown, spec export, MP4. Direct print quality pass done (brand lock, topic lock, editorial layouts). Open: morph anchor, wrap pass, real-key visual test.

Do not start P5+ (full dashboard, indexer, audio, Lite) before the prototype gate.
## 10. LLM and image plan

The token plan and the image plan moved to `docs/GRAND_LIVING.md`:
- Token plan: section 6.3, 6.4, and 10.
- Visual system: section 7.4.
- Prototype cut: section 2.

Keep the core rules:
- One compact call per brief. One repair pass. No chat loop.
- No images or binaries to the LLM, except the asset indexer contact sheet (post-prototype).
- No network at render time.
- Procedural Skia art first. Per-frame image plan upload next. Image API and Brave API after the prototype gate.
- Do not scrape the Brave image page. Use the official Brave Search API.
## 11. Risks and limits

- Encoder byte variance breaks naive content-hash caching of MP4 files. Cache on spec hash plus frame hashes instead.
- Large specs can get slow. 1080p full render is about 4x the proxy cost.
- Font fallback is silent in Skia. Register every face the spec names and test stills.
- LLM output can be plausible but invalid. Always validate before render.
- Old X80 packages are shared. Do not edit them without checking both products.
- Native Skia and WebCodecs packages need compatible npm binaries during installation.
## 12. Session log
### 2026-10-29 - Core v0.1
- Built engine, 22 blocks, 5 transitions, 25 fonts, 2 specs. 16 s 540x960 demo in 29.0 s.
- Verified still determinism; MP4 bytes vary. Fixed Bebas Neue registration by scanning the whole font cache.
### 2026-10-29 - Docs and surfaces
- Added `LIVING.md`, `HOW_TO_USE.md`, `AGENTS.md`; defined Main/Direct/Lite; wrote token and image plans.
### 2026-10-29 - Engine restored after link loss
- `@x80/effects` missing, `@x80/core` zero-byte. Restored symlinks; `verify`, `check`, stills, 10 s MP4 ok.
### 2026-10-29 - Main Direct UI built
- Built `server.mjs`, `public/index.html`, `src/director.mjs`, `src/llm.mjs`; no key storage.
- Director: style DNA, 9 layouts. LLM: Gemini/OpenAI/compatible, JSON schema, one repair pass. Fixed stills seconds and band sweep.
### 2026-10-29 - Grand vision and prototype scope
- Copied `GRAND_LIVING.md`, read the 3 UI references, recorded Margin language, and cut the prototype to one client, local files, no indexer/audio/switcher.
- Confirmed F1 (`maskText` line count) and F5 (no contrast test). Next: P0.
### 2026-10-29 - P0 start: F1, F5, script guide
- F1: `maskText` uses `layoutText` for real lines and clip height. Added `src/lint.mjs` and the `lint` command; f1/f5 fixtures.
- Added `prompts/script-style.md`, wired to `llm.mjs`, plan carries `vo`. `verify` and `check` pass.
## 13. Update rules

After every change:

1. Update section 1 or 2 if capability changed.
2. Add evidence to section 6.
3. Tick or add roadmap items in section 9.
4. Add one line to section 13 with date and result.
5. Keep this file under 300 lines. Move detail to topic docs.
6. Do not claim success without a command, path, or screenshot.
### 2026-10-29 - Workspace links restored
- `@x80/effects` missing, `@x80/core` zero-byte. Restored 8 symlinks; `verify` equal hashes, `check` ok.
### 2026-10-29 - Studio prototype portal built
- Added `src/store.mjs`, `src/prototype.mjs`, portal routes, and `public/app.html` (Margin layout, `/` portal, `/direct` moved).
- Procedural visual per board: uploaded image as tinted bed, else seeded shapes. Lint ignores decorative blend shapes.
- Verified: 5 boards, 5 stills, headline edit, one-board still rerender, 360-frame 540x960 MP4 in 15.3 s.
### 2026-10-29 - Visual editor and sprite kit
- Rebuilt `public/app.html`: plate plus DOM text overlays, drag/resize/rotate, inline edit, face/color/size, lock, asset and sprite swap, board nav.
- Added sprite kit UI (PNG, MD, zip, upload, preview) and `POST /api/p/project/:id/plan-all` -> `rebuildProject` with locks.
- Added fit-aware safe-area estimate in `src/lint.mjs`; fitted text no longer gives false warnings.
- Added `specs/regress/f6-f9`; updated `docs/HYPERSPEC.md` for `fit` and `sprite`.
- Open: real-key script and board tests; browser-level editor test blocked by the no-Chrome rule.
### 2026-10-30 - Live DOM editor and leader repair
- `src/prototype.mjs` patches one element without stills; board still and palette routes; `server.mjs` serves `/public/*` and fonts.
- `public/editor.js|css`, `editor-model.js`, `app.html`: DOM stage, drag/resize/rotate, inline text, inspector, locks, 800 ms refresh. Fixed patch body, media URLs, geometry, group offsets, fonts. `test/editor-model.test.mjs` passes.
### 2026-10-30 - Visual planning layer
- `src/llm.mjs`: plan now requires `idea`, `audience`, `tension`, `proof`, `motif`; each beat requires `job`, `visual`, `shot`, `weight`. Added the 9-step planning method and visual rules to `SYSTEM`.
- `validatePlanQuality` rejects plans with no visual, bad shot, bad weight, no proof, long hook, or banned words. It runs inside `generatePlan`; the existing one-repair pass fixes it or fails loud.
- `src/director.mjs`: `shot` drives layout choice; `visual` and `motif` drive image and asset matching; `weight` drives beat timing.
- Verified with a synthetic 12 s roof brief: timing hook 2.22 s, proof 3.19 s, turn 3.42 s, CTA 2.53 s; spec lint passes with 0 errors. Real-key test still open.
### 2026-10-30 - Direct print reel quality
- Added a print design system for Main Direct: paper ground, red frame, corner ticks, ruled header, caption strip, data strip, ghost numeral, chart and duotone blocks. Ten print layouts replace the cinema set when `look=print`. Two-tone headlines color the last line red.
- Brand colors are now locked. `makePalette` keeps the given accent hue and paper, and lifts lightness only to reach contrast. Direct UI sends accent, paper, and ink; server merges them with `brand: true`.
- Fixed topic drift in the local director. `demoPlan` now takes the subject, copy, and numbers from the brief. It no longer invents stats or uses template slogans. LLM prompt has a TOPIC LOCK block and a lower temperature of 0.62.
- Fixed overlap with the real mask height; stat collisions with a two-column rail and numeric-only stat. Three briefs render, lint 0/0. MP4: 540x960, 360 frames, 12.000 s.
- Two-tone print headlines (red last line), slim caption chrome with page ticks, dense 12-bar chart, year cards, rotated red stamp, and an 8-shot contact-sheet preview in Direct. Lint now follows group offsets.
- Fixed a false reject: the quality gate required a number on every brief. It now requires one only when the brief gives a real number. Duration words like "10 second" are ignored. Test: no-fact brief passes, brief with 4,200 and no stat fails.
### 2026-11-01 - Creative planning and asset index
- Added creative beat fields and rendering, plan repair, board JSON retry, contrast autofix, asset vision index, and a storyboard parser. Upload appends one cell only.
### 2026-11-01 - Local settings and Studio presets
- Added `data/settings.json` store and `GET/PUT /api/settings`; the server falls back to the saved key, provider, and model. Studio and Direct autosave and prefill on load.
- Added 5 Studio example chips. One click fills client, palette, display face, brief, length, format, and language.
### 2026-11-01 - Claude mechanics merge
- Merged 7 mechanic blocks, slideshow lint, motion-direction prompt, and the mechanics demo. Fixed `motion.mjs` keyframe interpolation. Planner beats carry `mechanic`, `mparams`, `support`, `dur`; director gives them a dedicated text layout. Receipt stamp and sub-label fixed. Backup: `stable-nov-1-custom-hyper.zip`.
- Docs: `HOW_TO_USE.md` now covers remote access (bind `0.0.0.0`, localtunnel, password = public IP). `127.0.0.1` alone does not work from a browser outside the container.
### 2026-11-01 - Video assets
- Added `src/video.mjs`: ffprobe, 6-24 sampled frames, contact sheet, metadata. Upload accepts mp4/mov/webm/m4v/mkv/avi. Vision index returns desc, tags, and 2-5 time segments per clip in the same call as images. Added a `video` block and planner/director matching. Docs: `docs/VIDEO.md`.
- Added visual explanations (`src/explain.mjs`) and URL fetch in library and temp modes (`POST /api/p/assets/url`). Docs: `docs/EXPLAIN.md`.
### 2026-11-01 - AVIF crash and devtunnel auth
- Root cause of the 8098 deaths: AVIF assets segfault Skia (`exit 139`). ffmpeg here has no AVIF demuxer and sharp is absent, so AVIF cannot be converted. Upload now rejects `.avif` with a 400 and a clear message; `render.mjs` throws before preload; the phantom index row is gone.
- Direct UI now aborts every API call after 180 s, so a dead server shows an error instead of a stuck "one LLM call".
- Devtunnel (`*.devtunnels.ms`) returns 302 to GitHub auth for `/public/editor.css`, which the browser reports as a bad MIME type. Use the cloudflared URL. Cloudflare serves `text/css` with 200.
- Verified: real Gemini plan returns in 3.2 s, 4 beats, 4274 in / 824 out; local and cloudflared CSS `text/css` 200.
### 2026-11-06 - Standalone runtime
- Vendored the core compositor, Skia renderer, deterministic effects, and in-process encoder into `engine/`. Added owned `fonts/`, native npm dependencies, and a no-X80-path test.
- `npm run test:standalone` passed: deterministic still hashes matched and proxy stills rendered without the X80 workspace.
### 2026-11-06 - Portable agent kit
- Added a platform-neutral authoring contract for OpenCode, ChatGPT workspaces, GitHub agents, and terminal agents. Added `agent/capabilities.json`, recipes, `npm run agent:review`, and a generic GitHub `Render Spec` workflow.
- Verified: agent review on `minimal-3s`, standalone checks, deterministic still hashes, and proxy MP4 render all pass.

### 2026-11-06 - Spotify Every Mood photo-led reel
- Rebuilt `specs/spotify-every-mood.json` to remove all vector people. The reel now uses 8 real Pexels photo assets, cropped to 1080x1920 PNGs during GitHub Actions preparation, plus 3 generated abstract mood-cover PNGs.
- Added photoCam camera moves, varied scene treatments, a persistent playback marker, playlist-card reveal, and a Ning Store CTA. Silent output; no voiceover, music, or SFX.
- Workflow `Render Spec` downloads and prepares assets before validation/render; the delivery artifact includes MP4, review stills, contact sheet, compiled plan, metadata, and photo-source credits. Current full-resolution run: https://github.com/toshuu/custom-hyper/actions/runs/42247139336

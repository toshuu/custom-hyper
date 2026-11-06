# Custom Hyper

Deterministic, browser-free motion compositor. JSON in, MP4 out.

Start here: [`HOW_TO_USE.md`](HOW_TO_USE.md). Status and handoff: [`docs/LIVING.md`](docs/LIVING.md). Agent rules: [`AGENTS.md`](AGENTS.md).

Custom Hyper takes the HyperFrames composition model (continuous clips, overlapping tracks, dense layers, GSAP-grade motion) and runs it on the X80 philosophy:

- No Chrome. No DOM. No CSS engine.
- No Vision LLM. No agent loop. No retries.
- One JSON file compiles to a frame-pure scene graph.
- Same JSON + same assets + same fonts -> same frames (verified by SHA-256).
- The MP4 bitstream can differ by a few bytes because the H.264 encoder is multi-threaded. Pixels do not differ.
- Skia pixels and in-process H.264. No FFmpeg CLI, no network at render time.

## Naming (read this first)

| Product | Folder | Meaning |
|---|---|---|
| **X80 Studio** | `../x80-video-engine/` (`studio/server.mjs`, port 8099) | Old full engine + full Studio. Remotion-like surface, optional prompt/API authoring. |
| **X80 Lite** | `../x80-video-engine/studio/public/lite.html` + `POST /upload` | Old no-API upload page. JSON + sprite sheet -> MP4. |
| **Custom Hyper** | this folder | New engine. Deterministic HyperFrames-style layered timeline on the X80 Skia core. |
| **Custom Hyper Main** | `AGENTS.md` + `src/cli.mjs` | LLM authoring. Tell opencode to make the video. Works now. |
| **Custom Hyper Main Direct** | `server.mjs` + `public/index.html`, port 8098 (`/direct`) | Web UI for Main. User supplies an LLM API key. Local preview needs no key. |
| **Custom Hyper Studio** | `server.mjs` + `public/app.html`, port 8098 (`/`) | Prototype portal. One local client, asset drop, brief, boards, element edit, MP4. |
| **Custom Hyper Lite** | not built | Planned upload surface. No API key. |

The old folders are untouched. Do not mix the surfaces. Main Direct and Lite will share this engine and differ only at the authoring and upload entry points.

## Quickstart

```bash
node src/cli.mjs check  specs/signal-16s.json
node src/cli.mjs stills specs/signal-16s.json --at 1,4,8,12,15
node src/cli.mjs plan   specs/signal-16s.json
node src/cli.mjs verify specs/minimal-3s.json --at 1.5
node src/cli.mjs render specs/signal-16s.json --scale 0.5
```

Output goes to `out/`. `--scale 0.5` renders a 540x960 proxy from the same 1080x1920 spec. Stills keep the full canvas.

Prototype portal:

```bash
node server.mjs
# open http://127.0.0.1:8098/
```

The portal keeps one client and its work in `data/`. Probes and storyboards in `data/projects/<id>/`. No build step.

## Measured (this machine, Node 20.19)

- `signal-16s.json`: 1080x1920, 30 fps, 16 s, 480 frames, 6 layers.
- 6 full-size stills: 6.1 s total (~1 s per still, includes font boot).
- 540x960 MP4, 480 frames: 29.0 s, 3.66 MB, H.264, exactly 16.000 s.
- Same spec rendered twice in two processes -> identical SHA-256 for the same still frame.
- Two MP4 renders are visually identical, but not byte-identical. This is an encoder limit, not a scene limit.

## Architecture

```
HyperSpec JSON
  -> validate (fail loud)
  -> compile blocks to X80 scene nodes
  -> bake all motion to keyframes (plain data)
  -> Skia surface per frame
  -> WebCodecs H.264 -> MP4
```

Reused engine packages: `@x80/core`, `@x80/renderer-skia`, `@x80/encoding`, `@x80/font-fetch` cache. No new npm dependencies.

## Why this is not a slideshow

X80 was act-based: one block per beat, cut after cut. Custom Hyper is track-based:

- Layers overlap in time. Crossfades are real, not cuts.
- Every layer can carry ambient motion (float, drift, marquee, spin) for its full life.
- Persistent chrome (masthead, rules, ticker, progress) spans the whole film.
- Wipes and flashes are composited clips, not act boundaries.
- Motion defaults are eased (`power3.out`, `back.out`), never linear.

## Read next

- `HOW_TO_USE.md` - render the demo, use the agent, review stills.
- `docs/LIVING.md` - what works, what is next, decisions, session log.
- `docs/HYPERSPEC.md` - full JSON contract, every block and motion field.
- `docs/PHILOSOPHY.md` - how X80 rules map to Custom Hyper.
- `docs/NAMING.md` - product and version names.

## Limits (v0.1)

- Images only. No video clips, no sprite sheets, no audio yet.
- No HTML/HyperFrames import yet. The JSON model is native.
- Transitions are color wipes/flashes/dips/bands. No clip-template transitions yet.
- No taste lint yet. Validation is contract-only.

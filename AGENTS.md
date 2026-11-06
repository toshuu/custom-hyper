# Custom Hyper - Agent Instructions

Read `docs/LIVING.md` first. It is the engine handoff source of truth. Then read `docs/GRAND_LIVING.md` for the product vision and build order. Read `HOW_TO_USE.md` for the user-facing flow.

Current build: the prototype portal in `docs/GRAND_LIVING.md` section 9. Reserved areas: `server.mjs` routes, `public/app.html`, `src/store.mjs`, `src/prototype.mjs`, `data/`. Do not build post-prototype features yet.

## What this project is

Custom Hyper is a deterministic, browser-free video engine. JSON in, Skia frames, in-process H.264 MP4 out. No Chrome, no DOM, no vision model, no agent loop at render time.

Old products at `../x80-video-engine/` are separate. Do not change their entry points or merge them with this project.

## When the user asks for a video

1. Read `docs/HYPERSPEC.md` and the closest spec in `specs/`.
2. Write one spec at `specs/<slug>.json`. Use the existing palette, faces, and blocks.
3. Run `node src/cli.mjs check specs/<slug>.json`.
4. Run `node src/cli.mjs stills specs/<slug>.json --at <3-4 key times>`.
5. Inspect the stills. Fix clipping, contrast, empty space, and weak hierarchy. Repeat once.
6. Run `node src/cli.mjs render specs/<slug>.json --scale 0.5`.
7. Verify with `ffprobe`. Report path, size, duration, and frame count.
8. Update `docs/LIVING.md`: evidence, roadmap, session log.

Use `--scale 0.5` for review and default delivery. Use scale 1 only when the user asks for full size.

## Commands

```bash
node src/cli.mjs check  specs/<slug>.json
node src/cli.mjs lint   specs/<slug>.json
node src/cli.mjs plan   specs/<slug>.json
node src/cli.mjs stills specs/<slug>.json --at 1,4,8
node src/cli.mjs verify specs/minimal-3s.json --at 1.5
node src/cli.mjs render specs/<slug>.json --scale 0.5
node server.mjs   # portal at http://127.0.0.1:8098/
```

Portal data lives in `data/`: `client.json`, `assets/`, `projects/<id>/`. It is local and disposable. Do not treat it as source.

## Hard rules

- Do not use Chrome, Puppeteer, HTML, or CSS.
- Do not call an LLM, image API, or network at render time.
- Do not edit `../x80-video-engine/` products. Shared packages are read-only unless the user approves.
- Do not promise byte-identical MP4 files. Promise identical frames. The H.264 encoder is multi-threaded.
- Do not delete files. Ask first.
- Do not add code comments unless the user asks.
- Keep one spec per video. Put assets in `assets/`.
- Fail loud. Do not add silent fallbacks.
- Update `docs/LIVING.md` after every change. A fresh agent must be able to resume from it.

## Output contract

A finished job reports:

- Spec path
- MP4 path
- Width, height, fps, frame count, duration
- Render time
- Any known limit

## Product names

- **Custom Hyper** - engine and CLI
- **Custom Hyper Main** - LLM authoring, agent entry through opencode
- **Custom Hyper Main Direct** - planned web UI, user API key
- **Custom Hyper Lite** - planned upload surface, no API

Do not invent new names. See `docs/NAMING.md`.

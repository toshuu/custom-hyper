# Agent API

This is the portable contract for OpenCode, ChatGPT workspaces, GitHub agents,
Claude Code, and any shell-capable agent. `AGENTS.md` is the canonical rule set.

## Read Order

1. `AGENTS.md`
2. `agent/capabilities.json`
3. `docs/HYPERSPEC.md`
4. `docs/VIDEO_RECIPES.md`
5. The closest working spec in `specs/`

## Request Contract

Before writing JSON, state: audience, objective, format, duration, style,
evidence or facts, assets, and call to action. Ask one question only if a
missing value changes the video. Otherwise use a clear default and state it.

## Authoring Loop

1. Choose a recipe and closest reference spec.
2. Write `specs/<slug>.json`. Keep one idea per beat.
3. Run `node src/cli.mjs lint specs/<slug>.json`.
4. Run `node src/cli.mjs check specs/<slug>.json`.
5. Render 3-5 key stills: `node src/cli.mjs stills specs/<slug>.json --at 1,4,8 --scale 0.5`.
6. Fix clipping, contrast, empty space, weak hierarchy, or slideshow rhythm.
7. Render: `node src/cli.mjs render specs/<slug>.json --scale 0.5`.
8. Run `ffprobe` and report spec path, MP4 path, size, dimensions, fps, frame
   count, duration, render time, and known limit.

## Quality Rules

- Use a continuous ground layer, 3-5 overlapping content layers, and persistent
  chrome where it improves orientation.
- Use motion to reveal meaning, not to decorate every element.
- Use real facts only. Do not invent statistics or quotes.
- Keep display copy short. Use `fit` for constrained text.
- Use `lint` and `check` as hard gates. Warnings need a conscious choice.

## Commands

```bash
npm run agent:review -- specs/<slug>.json --at 1,4,8
node src/cli.mjs plan specs/<slug>.json
node src/cli.mjs verify specs/<slug>.json --at 1.5
```

`agent:review` runs lint, check, and review stills. It is the default review
gate. Rendering never uses a browser, network, vision model, or LLM.

## GitHub Workflow

Run **Render Spec** manually and set `spec` to a repository-relative JSON path,
for example `specs/my-video.json`. The workflow rejects absolute and parent
paths. It uploads review stills, proxy MP4, compiled plan, and probe metadata.

# Philosophy: X80 rules applied to HyperFrames

Custom Hyper is not a Remotion clone. It is the X80 contract with the HyperFrames composition model.

## The rule set (from X80)

| Rule | X80 | Custom Hyper |
|---|---|---|
| Input | One ReelSpec JSON | One HyperSpec JSON |
| Renderer | Skia (`@napi-rs/canvas`) | Same Skia packages |
| Browser | None | None |
| Source of truth | JSON, compiled | JSON, compiled |
| Agent at render | None | None |
| Vision LLM | Not needed | Not needed |
| Determinism | Same JSON -> same frames | Same JSON -> same frames |
| Failure mode | Throw loud | Throw loud |
| Encoding | In-process H.264 | In-process H.264 |

## The lesson that changed the base

X80 was act-based. Each act was self-contained. The compiler stitched acts with cuts. That model produces slideshow rhythm, because nothing lives across a cut and nothing moves without a reason.

HyperFrames was track-based. Clips overlap. Backgrounds, tickers, and chrome stay alive across beats. Motion is continuous, not per-slide.

Custom Hyper copies the track model, not the act model:

- One continuous timeline.
- Layers overlap in time.
- Ambient motion spans the whole reel.
- Persistent chrome lives in its own layer.
- Transitions are clips, not boundaries.

## Why this is still deterministic

The HyperFrames browser model uses `gsap.timeline().seek(frame)`. It is deterministic in principle, but it needs a DOM, CSS layout, and Chrome.

Custom Hyper removes the DOM. It compiles the same idea to a scene graph:

1. Validate the JSON.
2. Compile each block to X80 scene nodes.
3. Bake every motion curve to keyframe data at compile time.
4. Render each frame with Skia.
5. Encode with WebCodecs.

No layout engine. No CSS cascade. No font fallback surprise. No browser version drift.

## Speed is a design constraint

- Skia draws directly to a surface. No screenshot, no compositor process.
- Motion is pre-baked. The render loop only evaluates numeric keyframes.
- Assets decode once. Frames reuse handles.
- Encoding is in-process. No temp PNG sequence, no FFmpeg spawn.

Measured: 480 frames at 540x960 in 29.0 s, including font boot and encode.

Frame determinism is verified across two processes by SHA-256. MP4 bytes are not stable because the bundled H.264 encoder is multi-threaded. Same frames, near-identical bitstream.

## What "deterministic" excludes

- No per-frame LLM calls.
- No visual diff loop.
- No "try again until it looks good".
- No runtime theme inference.

Taste lives in the spec and in the block library. The engine executes.

## What comes next

1. **Custom Hyper Main Direct**: web UI, one compact LLM call, local expansion.
2. **Custom Hyper Lite**: upload JSON + assets, no API key.
3. Procedural image blocks: seeded Skia art, no image API.
4. Audio mix and beat-aligned cuts.
5. Video clips and sprite sheets (reuse X80 media packages).
6. Taste lint: empty layers, linear entrances, tiny text, theme contrast.
7. HTML/HyperFrames import as a compiler front-end (still no Chrome at render).

Full status and order: `docs/LIVING.md`.

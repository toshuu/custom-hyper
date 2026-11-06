# Standalone Runtime Design

## Intent

Make Custom Hyper a standalone, deterministic video engine. It must not
import files from `../x80-video-engine`. It keeps the current browser-free
Skia render and in-process H.264 MP4 path.

## Goals

- One repository contains the runtime, fonts, source, and tests.
- Rendering uses no Chrome, DOM, network, vision model, or LLM.
- Existing HyperSpec commands keep their behavior.
- Native dependencies install from the public npm registry.
- Tests prove no path references the old X80 workspace.

## Non-goals

- Do not copy X80 Studio, X80 UI, Remotion-style APIs, or planner code.
- Do not redesign HyperSpec or change visual output by intent.
- Do not add features during the migration.

## Constraints

- Frame pixels must remain deterministic.
- MP4 byte output can vary because the H.264 encoder is multi-threaded.
- Missing assets or fonts must fail with a clear error.

## Approaches

1. Internal runtime: copy only core, Skia renderer, effects, encoder, and
   required fonts into this repository. Rewrite package imports to local
   imports. This gives a standalone repository while keeping the proven
   renderer. Selected.
2. Shared X80 packages: less copy work, but Custom Hyper remains coupled to
   X80. Rejected.
3. New renderer: highest control but delays a working standalone engine and
   risks regression. Rejected.

## Design

`engine/core` owns timeline resolution, animation, text layout, scene nodes,
and frame composition. `engine/skia` owns native Skia surfaces, font loading,
image loading, texture, and deterministic effects. `engine/encoding` owns
in-process H.264 MP4 encoding. `fonts` owns the current required font cache
and manifest. Custom Hyper source imports only `engine/*` modules.

`package.json` lists public runtime dependencies and build/test tools. A
reproducible install builds the internal engine packages before tests run.

## Verification

- Search source and runtime files for `x80-video-engine`; find no import or
  runtime path reference.
- Install and build from Custom Hyper only.
- Run the existing deterministic still verification.
- Render the existing proxy MP4 smoke fixture.
- Run the existing editor tests.

## Remaining Builder Calls

The migration preserves the existing engine behavior first. Capability work
(new blocks, cache, render throughput, and benchmarks) follows as a separate
approved phase after the standalone baseline is proven.

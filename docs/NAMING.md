# Naming

Use these names in all future work. Do not say "the engine" without a product name.

## Products

| Name | Status | Folder | Entry point |
|---|---|---|---|
| **X80 Studio** | Old full product. Works. | `../x80-video-engine/` | `studio/server.mjs`, `http://127.0.0.1:8099/` |
| **X80 Lite** | Old no-API product. Works. | `../x80-video-engine/studio/public/lite.html` | `POST /upload` |
| **Custom Hyper** | Engine and CLI. Works. | `custom-hyper/` | `src/cli.mjs` |
| **Custom Hyper Main** | LLM authoring layer. Agent entry works through opencode. | `custom-hyper/` | `AGENTS.md`, `HOW_TO_USE.md`, `src/cli.mjs` |
| **Custom Hyper Main Direct** | Web UI for Main. User supplies an LLM API key. | Not built. Name reserved. | Planned `server.mjs` |
| **Custom Hyper Lite** | Upload JSON and assets. No LLM, no API key. | Not built. Name reserved. | Planned upload page |

## Meaning of the names

- **Custom Hyper** is the engine. It compiles JSON and renders frames.
- **Main** means LLM authoring. The LLM writes the story or beat plan. The engine renders.
- **Direct** means the web UI form of Main. No terminal.
- **Lite** means no LLM and no API key. The user brings JSON and assets.

Main has two entries:

1. **Agent entry**: opencode reads this repo and runs the CLI. Works now.
2. **Direct entry**: browser UI with an API key. Not built.

Both entries must produce the same HyperSpec and use the same engine.

## Rules

1. X80 Studio and X80 Lite are old products. Do not rename their folders. Do not merge their entry points.
2. Custom Hyper lives in its own top-level folder, not inside X80.
3. Do not call the old `/api/lite/*` routes "Lite". It is not the product.
4. Shared code is package code (`@x80/core`, `@x80/renderer-skia`, `@x80/encoding`). Shared packages do not make the products the same.
5. If a doc says only "the engine", change it to a product name.
6. Do not promise byte-identical MP4 files. The promise is identical frames.

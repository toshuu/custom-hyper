# Custom Hyper Workspace Instructions

Use this repository to author deterministic videos. Read `AGENTS.md` first.
Then read `docs/AGENT_API.md`, `docs/HYPERSPEC.md`, and the closest spec in
`specs/`.

Use this loop: make a creative brief, write one spec, run `lint`, run `check`,
render review stills, fix defects, render a proxy MP4, then report output.

Use only the local Custom Hyper runtime. Do not use Chrome, X80, external APIs,
vision, or an LLM at render time.

For GitHub Actions, run the `Render Spec` workflow with a repository-relative
spec path. Artifacts contain review PNGs, the MP4, plan JSON, and metadata.

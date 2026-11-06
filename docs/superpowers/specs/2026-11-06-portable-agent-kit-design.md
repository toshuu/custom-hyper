# Portable Agent Kit Design

## Intent

Enable any shell-capable AI workspace to plan, validate, review, and render
Custom Hyper videos without product-specific engine knowledge.

## Goals

- One canonical authoring workflow for OpenCode, ChatGPT workspaces, GitHub,
  and terminals.
- Machine-readable capabilities and quality requirements.
- Reusable planning and visual direction recipes.
- A generic GitHub Action renders a selected spec and uploads review frames,
  MP4, plan, and metadata.
- Rendering remains deterministic, standalone, browser-free, and offline.

## Non-goals

- Do not add hosted APIs, new render-time AI calls, browser automation, or a
  platform-specific SDK.
- Do not claim arbitrary live-action, audio, or generative-image capability.

## Design

`AGENTS.md` becomes the canonical agent contract. GitHub and ChatGPT adapters
only point to it. `docs/AGENT_API.md` defines the input, output, command, and
review protocol. `agent/capabilities.json` exposes supported canvas formats,
blocks, motion, transitions, constraints, and quality gates.

`docs/VIDEO_RECIPES.md` provides deterministic planning recipes for common
video goals. Agents start from the closest working spec, select a recipe,
write a JSON spec, run lint/check/stills, fix visible defects, then render.

The GitHub workflow accepts a repository-relative spec path, validates it,
renders review stills and a proxy MP4, probes the output, and uploads all
artifacts. It uses Node 22.20 and only Custom Hyper dependencies.

## Quality Rules

- Every request gets a stated audience, objective, format, duration, style,
  evidence, and call to action before the spec is written.
- Use one idea per beat, overlapping layers, persistent chrome, motion, and
  transitions only where they clarify a change.
- Render review stills before MP4. Fix clip, contrast, empty space, and weak
  hierarchy before final rendering.
- Validate with `lint` and `check`; fail on errors.

## Verification

- Tests assert the capability manifest and platform adapters link to the
  canonical contract.
- Tests assert the GitHub workflow uses setup-node 22.20, accepts a spec
  input, and has no X80 dependency.
- Run `npm test`, `npm run test:standalone`, and workflow YAML checks.

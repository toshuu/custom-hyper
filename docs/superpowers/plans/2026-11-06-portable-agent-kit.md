# Portable Agent Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give any shell-capable AI workspace one reliable Custom Hyper authoring and render workflow.

**Architecture:** Keep `AGENTS.md` canonical. Add small platform adapters, machine-readable capability metadata, planning recipes, and a generic artifact-producing GitHub workflow.

**Tech Stack:** Markdown, JSON, GitHub Actions, Node.js 22.20.

**Spec:** `docs/superpowers/specs/2026-11-06-portable-agent-kit-design.md`

## Global Constraints

- No Chrome, DOM, network, vision model, or LLM at render time.
- No dependency on `x80-video-engine`.
- Render errors fail loud.
- Do not promise unsupported audio, live video generation, or generative images.

## Review Focus

- A fresh workspace agent can discover one reading order and complete one render.
- GitHub workflow path input cannot escape the repository.
- Review artifacts include stills, MP4, compiled plan, and probe metadata.
- Documentation does not direct agents to X80-owned fonts or setup.
- Capability metadata matches documented engine limits.

### Task 1: Canonical Agent Contract

**Files:** `AGENTS.md`, `CHATGPT.md`, `.github/copilot-instructions.md`, `docs/AGENT_API.md`, `agent/capabilities.json`.

- [ ] Add a platform-neutral agent reading order, authoring loop, output report, and hard limits.
- [ ] Add thin GitHub and ChatGPT adapters that point to `AGENTS.md`.
- [ ] Add machine-readable supported blocks, motion, transitions, formats, and quality gates.
- [ ] Add contract tests and run them.

### Task 2: Planning Guidance

**Files:** `docs/VIDEO_RECIPES.md`, `HOW_TO_USE.md`, `README.md`, `docs/HYPERSPEC.md`, `docs/NAMING.md`.

- [ ] Add five reusable planning recipes and a pre-spec creative brief.
- [ ] Correct stale standalone, Direct, font, video, and lint documentation.
- [ ] Link the portable agent kit from the entry documents.
- [ ] Run contract tests.

### Task 3: Generic GitHub Rendering

**Files:** `.github/workflows/render-spec.yml`, `test/standalone-runtime.test.mjs`.

- [ ] Add tests for Node 22.20, spec input, repository path guard, and artifact output.
- [ ] Add a manual generic render workflow using `npm ci`, validate, stills, proxy MP4, plan, ffprobe, and artifacts.
- [ ] Run tests and standalone render smoke verification.

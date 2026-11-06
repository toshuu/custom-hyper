# Standalone Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Custom Hyper install, test, and render without the X80 workspace.

**Architecture:** Vendor the proven JavaScript runtime into `engine/`, retaining only core composition, Skia drawing, deterministic effects, and in-process MP4 encoding. Custom Hyper source imports the local runtime. Fonts become owned files under `fonts/`.

**Tech Stack:** Node.js 20+, ECMAScript modules, `@napi-rs/canvas`, `@napi-rs/webcodecs`, Mediabunny, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-06-standalone-runtime-design.md`

## Global Constraints

- No import or runtime path may reference `../x80-video-engine`.
- Render uses no Chrome, DOM, network, vision model, or LLM.
- Frame pixels remain deterministic; MP4 byte output is not guaranteed deterministic.
- Missing assets and fonts fail loudly.
- Do not copy X80 Studio, UI, planner, or Remotion-style APIs.

## Review Focus

- Clean clone: install and smoke render work when the X80 sibling directory does not exist.
- Required display faces: every font used by shipped specs loads from Custom Hyper-owned files.
- Native dependency: supported Linux WebCodecs package resolves at runtime.
- Effect imports: Skia renderer uses local effects, not an undeclared `@x80/effects` package.
- Future regression: source and runtime search rejects old workspace paths.

---

## File Structure

- `engine/core/`: vendored frame composition, timeline, animation, and text layout.
- `engine/effects/`: vendored deterministic effect and transition functions.
- `engine/skia/`: vendored native Skia surface, fonts, image, texture, and frame adapters.
- `engine/encoding/`: vendored in-process H.264 MP4 encoder.
- `fonts/`: font manifest and required font files.
- `src/`: Custom Hyper compiler and surfaces, updated to local runtime imports.
- `test/standalone-runtime.test.mjs`: dependency and render ownership checks.
- `package.json`: public npm runtime dependencies and build/test scripts.

### Task 1: Vendor the Runtime

**Files:**
- Create: `engine/core/**`, `engine/effects/**`, `engine/skia/**`, `engine/encoding/**`
- Modify: vendored JavaScript module import paths
- Test: `test/standalone-runtime.test.mjs`

**Interfaces:**
- Consumes: current `@x80/core`, `@x80/effects`, `@x80/renderer-skia`, and `@x80/encoding` public exports.
- Produces: `engine/core/index.js`, `engine/effects/index.js`, `engine/skia/index.js`, `engine/encoding/index.js` with the same exports Custom Hyper currently uses.

- [ ] **Step 1: Write a failing local-runtime import test**

```js
test('local runtime exports the required renderer API', async () => {
  const core = await import('../engine/core/index.js');
  const skia = await import('../engine/skia/index.js');
  const encoding = await import('../engine/encoding/index.js');
  assert.equal(typeof core.renderFrame, 'function');
  assert.equal(typeof skia.SkiaRenderer, 'function');
  assert.equal(typeof encoding.renderToMp4, 'function');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/standalone-runtime.test.mjs`
Expected: FAIL because local runtime modules do not exist.

- [ ] **Step 3: Copy only the four required X80 runtime distributions into `engine/`**

Retain JavaScript distribution files. Rewrite all internal `@x80/core` and `@x80/effects` imports to relative local module paths. Do not copy TypeScript source, Studio, UI, planner, media, or font-fetch packages.

- [ ] **Step 4: Run the local-runtime import test**

Run: `node --test test/standalone-runtime.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine test/standalone-runtime.test.mjs
git commit -m "feat: vendor standalone render runtime"
```

### Task 2: Own Runtime Dependencies and Fonts

**Files:**
- Create: `fonts/manifest.json`, `fonts/cache/**`
- Modify: `package.json`, `src/render.mjs`
- Test: `test/standalone-runtime.test.mjs`

**Interfaces:**
- Consumes: local `engine/skia/index.js` font registration APIs and existing `registerFonts(spec, specDir)` API.
- Produces: `registerFonts()` reads only `custom-hyper/fonts` and explicit spec files.

- [ ] **Step 1: Add failing ownership assertions**

```js
test('render source owns its font root', () => {
  const source = readFileSync('src/render.mjs', 'utf8');
  assert.match(source, /CUSTOM_HYPER_ROOT/);
  assert.doesNotMatch(source, /x80-video-engine/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/standalone-runtime.test.mjs`
Expected: FAIL because font resolution uses the X80 root.

- [ ] **Step 3: Add public native dependencies and owned font files**

Add `@napi-rs/canvas`, `@napi-rs/webcodecs`, Linux WebCodecs support, and Mediabunny with their current proven versions. Copy the manifest and only the font directories named by shipped specs. Resolve the runtime font root from Custom Hyper's repository path.

- [ ] **Step 4: Run font and local-runtime tests**

Run: `node --test test/standalone-runtime.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json fonts src/render.mjs test/standalone-runtime.test.mjs
git commit -m "feat: own standalone dependencies and fonts"
```

### Task 3: Switch Custom Hyper to the Local Runtime

**Files:**
- Modify: `src/render.mjs`, `src/blocks.mjs`, `src/prototype.mjs`, `src/cli.mjs`, `src/ease.mjs`, `server.mjs`
- Test: `test/standalone-runtime.test.mjs`, `test/editor-model.test.mjs`, `test/editor-api.test.mjs`

**Interfaces:**
- Consumes: exports created in Tasks 1 and 2.
- Produces: all Custom Hyper runtime imports resolve inside this repository.

- [ ] **Step 1: Add a failing forbidden-path test**

```js
test('source and runtime do not reference the X80 workspace', () => {
  const files = sourceFiles();
  for (const file of files) assert.doesNotMatch(readFileSync(file, 'utf8'), /x80-video-engine/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/standalone-runtime.test.mjs`
Expected: FAIL and list the current import owners.

- [ ] **Step 3: Replace every direct X80 import and font-cache path**

Use local `engine/*` imports. Preserve exported APIs and error behavior. Remove `X80_ROOT` from `src/render.mjs`.

- [ ] **Step 4: Run source tests**

Run: `node --test test/standalone-runtime.test.mjs test/editor-model.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src server.mjs test
git commit -m "refactor: use local Custom Hyper runtime"
```

### Task 4: Prove Standalone Rendering

**Files:**
- Modify: `package.json`, `README.md`, `docs/LIVING.md`, `.gitignore`
- Test: existing CLI verification fixtures

**Interfaces:**
- Consumes: local runtime, fonts, and HyperSpec fixtures.
- Produces: `npm run verify`, `npm run smoke`, and `npm test` work from Custom Hyper alone.

- [ ] **Step 1: Add a clean-environment smoke script**

Add `test:standalone` that asserts no old workspace references, runs `verify` on `specs/minimal-3s.json`, and renders a proxy MP4 smoke fixture.

- [ ] **Step 2: Verify without the X80 sibling path**

Run from a temporary copy of Custom Hyper that has no `../x80-video-engine` directory: `npm ci && npm run test:standalone`.
Expected: exit code 0; deterministic still verification reports equal hashes; proxy MP4 exists.

- [ ] **Step 3: Run full project verification**

Run: `npm test && npm run verify && npm run smoke`
Expected: all tests pass and smoke renders create PNG/MP4 output.

- [ ] **Step 4: Document installation and results**

Update README and `docs/LIVING.md` to remove X80 setup instructions, state the standalone runtime boundary, and record command evidence. Add generated output folders to `.gitignore` if new commands create them.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json README.md docs/LIVING.md .gitignore test
git commit -m "docs: verify standalone Custom Hyper runtime"
```

## Self-Review

- Spec coverage: Tasks 1-3 implement the local runtime, local imports, and local fonts. Task 4 proves a clean-clone install and render path.
- Step scan: each task has a failing test, a focused change, a command-level pass check, and a commit.
- Type consistency: existing JavaScript public exports remain unchanged; Custom Hyper callers only change module location.
- Review focus: clean clone, fonts, native dependency, effects import, and forbidden workspace path each have a named test or verification step.
- Proportion: the plan defines module boundaries and checks without transcribing vendored implementation code.

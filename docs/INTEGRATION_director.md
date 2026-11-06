# Director integration (planner -> mechanics)

1. Add to the beat schema in `src/llm.mjs` (both `STRING` schema ~line 264 and the prompt JSON ~line 422):
   `mechanic` (enum: calendarFlip|counterRoll|beforeAfter|receipt|photoCam|cardStack|none), `mparams` (object), `support` (string), `dur` (number seconds).
2. Append `prompts/motion-direction.md` to the system prompt next to `script-style.md`.
3. In `src/director.mjs` `visualBlock`: when `beat.mechanic !== 'none'`, emit
   `{ type: beat.mechanic, ...defaultsFor(beat.mechanic, canvas), ...beat.mparams }` as the hero **instead of** the procedural shapes, then place `support` as one text block.
4. Beat length: use `beat.dur` and the 0.5-2 `weight`; do not equalise.
5. Add one `track` block in the ground layer (poses at beat boundaries).
6. Gate: run `slideshowLint` after build. On error, feed `errors` back for the existing single repair pass.
7. Per-mechanic default positions (1080x1920): calendarFlip x260 y520; counterRoll x90 y720 w900; beforeAfter x90 y360 w900 h1000; receipt x260 y330; cardStack x100 y420; photoCam full-bleed.

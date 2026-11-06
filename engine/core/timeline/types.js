/**
 * M0 — Timeline contracts.
 *
 * Frame-pure deterministic timing: every visual is a pure function of
 * (VideoPlan, frame, fps, assets, engineVersion). No wall-clock sources.
 *
 * Mirrors Remotion semantics (Composition / Sequence / Series / Loop /
 * Freeze / Still) with a JSON-compatible data model instead of React.
 */
export const timeInSeconds = (frame, fps) => frame / fps;
export const frameFromSeconds = (seconds, fps) => Math.round(seconds * fps);
//# sourceMappingURL=types.js.map
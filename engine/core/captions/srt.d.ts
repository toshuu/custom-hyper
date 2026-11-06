/**
 * M8 — SRT ingest/emit (pure, deterministic).
 * Reference-compatible with `@remotion/captions` parse/serialize
 * (probed from the installed copy; never a runtime dep).
 */
import type { Caption } from './types.js';
/** Parse `.srt` subtitle text into word/line captions (confidence 1). */
export declare const parseSrt: (input: {
    input: string;
}) => {
    captions: Caption[];
};
/** Serialize caption lines back to `.srt` (pageBreakAfter forces cue splits). */
export declare const serializeSrt: (input: {
    lines: Caption[][];
}) => string;
//# sourceMappingURL=srt.d.ts.map
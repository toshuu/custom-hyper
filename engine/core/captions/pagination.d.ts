/**
 * M8 — Caption pagination (pure, deterministic).
 * X80-owned implementation with reference-compatible semantics
 * (`@remotion/captions` TikTok pagination + max-chars segments probed
 * from the installed copy; never a runtime dep).
 */
import type { Caption, CreateTikTokStyleCaptionsInput, EnsureMaxCharactersPerLineInput, TikTokPage, TikTokToken } from './types.js';
/**
 * Group word-timed captions into TikTok-style pages. A new page starts
 * when the next token begins with a space AND (the current page already
 * exceeds combineMs OR a silence gap was observed), or on pageBreakAfter.
 */
export declare const createTikTokStyleCaptions: (input: CreateTikTokStyleCaptionsInput) => {
    pages: TikTokPage[];
};
/** End of a page on the media clock (startMs + durationMs). */
export declare const pageEndMs: (page: TikTokPage) => number;
/**
 * Split word captions into line segments of at most maxCharsPerLine
 * characters (reference-compatible, incl. orphan prevention: with <4
 * words left and a half-full line, break early so no orphan word).
 */
export declare const ensureMaxCharactersPerLine: (input: EnsureMaxCharactersPerLineInput) => {
    segments: Caption[][];
};
/**
 * Render a page's tokens as multi-line display text with hard breaks at
 * segment boundaries (layoutText splits on \n, so this reuses M4 wrapping).
 */
export declare const pageDisplayText: (page: TikTokPage, maxCharsPerLine: number | undefined) => string;
/** Index of the page visible at timeMs, or -1 when no page is active. */
export declare const activePageIndexAt: (pages: TikTokPage[], timeMs: number) => number;
/** Index of the last token started at timeMs within a page (-1 = none yet). */
export declare const activeTokenIndexAt: (page: TikTokPage, timeMs: number) => number;
/** 0..1 progress of a token at timeMs (clamped; 0 before, 1 after). */
export declare const tokenProgressAt: (token: TikTokToken, timeMs: number) => number;
//# sourceMappingURL=pagination.d.ts.map
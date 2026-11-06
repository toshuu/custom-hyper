/**
 * M8 — Word/phrase highlight + reveal state (pure, deterministic).
 * Given a page and a media-clock time, answers: which tokens are
 * spoken / active / upcoming, which are visible under a reveal mode,
 * and how many chars of the active token a typewriter shows.
 */
import type { CaptionReveal, TikTokPage, TikTokToken, TokenState } from './types.js';
/** Per-token state at timeMs: spoken past, currently active, or upcoming. */
export declare const tokenStatesAt: (page: TikTokPage, timeMs: number) => TokenState[];
/**
 * Token indices visible under a reveal mode. `none` shows everything
 * (dim vs highlighted by color only); the reveal modes hide the future.
 */
export declare const visibleTokenIndices: (page: TikTokPage, timeMs: number, reveal: CaptionReveal) => number[];
/**
 * Chars of the active token a typewriter shows at timeMs, proportional
 * to the token's spoken progress (rounded, at least the first grapheme
 * once started, all chars once the token ends).
 */
export declare const typewriterCharsForToken: (token: TikTokToken, tokenText: string, timeMs: number) => number;
/** Media-clock ms for a compositor frame (integer frame + fps only). */
export declare const captionTimeMsAtFrame: (frame: number, fps: number) => number;
/** Per-token entrance opacity (1 when enterFadeMs is 0/undefined). */
export declare const tokenEnterOpacity: (token: TikTokToken, timeMs: number, enterFadeMs: number | undefined) => number;
/** Page-level exit opacity (1 when exitFadeMs is 0/undefined). */
export declare const pageExitOpacity: (pageEndMsValue: number, timeMs: number, exitFadeMs: number | undefined) => number;
//# sourceMappingURL=highlight.d.ts.map
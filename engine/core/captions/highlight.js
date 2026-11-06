/**
 * M8 — Word/phrase highlight + reveal state (pure, deterministic).
 * Given a page and a media-clock time, answers: which tokens are
 * spoken / active / upcoming, which are visible under a reveal mode,
 * and how many chars of the active token a typewriter shows.
 */
import { activeTokenIndexAt, tokenProgressAt } from './pagination.js';
/** Per-token state at timeMs: spoken past, currently active, or upcoming. */
export const tokenStatesAt = (page, timeMs) => {
    if (!Number.isFinite(timeMs)) {
        throw new Error('timeMs must be finite');
    }
    const active = activeTokenIndexAt(page, timeMs);
    return page.tokens.map((token, i) => {
        if (i < active) {
            return 'spoken';
        }
        if (i === active) {
            return timeMs < token.toMs ? 'active' : 'spoken';
        }
        return 'upcoming';
    });
};
/**
 * Token indices visible under a reveal mode. `none` shows everything
 * (dim vs highlighted by color only); the reveal modes hide the future.
 */
export const visibleTokenIndices = (page, timeMs, reveal) => {
    if (!Number.isFinite(timeMs)) {
        throw new Error('timeMs must be finite');
    }
    switch (reveal) {
        case 'none':
            return page.tokens.map((_, i) => i);
        case 'word-reveal':
        case 'line-reveal':
        case 'typewriter': {
            const active = activeTokenIndexAt(page, timeMs);
            if (active < 0) {
                return [];
            }
            return page.tokens.map((_, i) => i).filter((i) => i <= active);
        }
        default:
            throw new Error(`Unknown caption reveal: ${reveal}`);
    }
};
/**
 * Chars of the active token a typewriter shows at timeMs, proportional
 * to the token's spoken progress (rounded, at least the first grapheme
 * once started, all chars once the token ends).
 */
export const typewriterCharsForToken = (token, tokenText, timeMs) => {
    const graphs = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(tokenText)].map((s) => s.segment);
    if (timeMs < token.fromMs) {
        return 0;
    }
    if (timeMs >= token.toMs) {
        return graphs.length;
    }
    const progress = tokenProgressAt(token, timeMs);
    return Math.max(1, Math.round(progress * graphs.length));
};
/** Media-clock ms for a compositor frame (integer frame + fps only). */
export const captionTimeMsAtFrame = (frame, fps) => {
    if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0) {
        throw new Error('captionTimeMsAtFrame needs a finite frame and positive fps');
    }
    return (frame * 1000) / fps;
};
/** Per-token entrance opacity (1 when enterFadeMs is 0/undefined). */
export const tokenEnterOpacity = (token, timeMs, enterFadeMs) => {
    if (enterFadeMs === undefined || enterFadeMs <= 0) {
        return 1;
    }
    if (!Number.isFinite(enterFadeMs)) {
        throw new Error('enterFadeMs must be finite');
    }
    if (timeMs <= token.fromMs) {
        return 0;
    }
    return Math.min(1, (timeMs - token.fromMs) / enterFadeMs);
};
/** Page-level exit opacity (1 when exitFadeMs is 0/undefined). */
export const pageExitOpacity = (pageEndMsValue, timeMs, exitFadeMs) => {
    if (exitFadeMs === undefined || exitFadeMs <= 0) {
        return 1;
    }
    if (!Number.isFinite(exitFadeMs)) {
        throw new Error('exitFadeMs must be finite');
    }
    if (timeMs >= pageEndMsValue) {
        return 0;
    }
    return Math.min(1, (pageEndMsValue - timeMs) / exitFadeMs);
};
//# sourceMappingURL=highlight.js.map
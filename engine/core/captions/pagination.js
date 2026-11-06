/**
 * M8 — Caption pagination (pure, deterministic).
 * X80-owned implementation with reference-compatible semantics
 * (`@remotion/captions` TikTok pagination + max-chars segments probed
 * from the installed copy; never a runtime dep).
 */
import { assertCaptions } from './types.js';
/**
 * Group word-timed captions into TikTok-style pages. A new page starts
 * when the next token begins with a space AND (the current page already
 * exceeds combineMs OR a silence gap was observed), or on pageBreakAfter.
 */
export const createTikTokStyleCaptions = (input) => {
    const { captions, combineTokensWithinMilliseconds, breakOnSilenceAfterMilliseconds, } = input;
    assertCaptions(captions);
    if (!Number.isFinite(combineTokensWithinMilliseconds) || combineTokensWithinMilliseconds <= 0) {
        throw new Error('combineTokensWithinMilliseconds must be a positive finite number');
    }
    if (breakOnSilenceAfterMilliseconds !== undefined &&
        (!Number.isFinite(breakOnSilenceAfterMilliseconds) ||
            breakOnSilenceAfterMilliseconds < 0)) {
        throw new Error('breakOnSilenceAfterMilliseconds must be a non-negative finite number');
    }
    const pages = [];
    let currentText = '';
    let currentTokens = [];
    let currentFrom = 0;
    let currentTo = 0;
    const flush = () => {
        const text = currentText.endsWith('\n') ? currentText.slice(0, -1) : currentText;
        pages.push({
            text: text.trimStart(),
            startMs: currentFrom,
            tokens: currentTokens,
            durationMs: Infinity,
        });
        if (pages.length > 1) {
            const prev = pages[pages.length - 2];
            prev.durationMs = currentFrom - prev.startMs;
        }
    };
    captions.forEach((item, index) => {
        const { text } = item;
        const exceedsDuration = currentTo - currentFrom > combineTokensWithinMilliseconds;
        const shouldBreakOnSilence = breakOnSilenceAfterMilliseconds !== undefined &&
            currentText !== '' &&
            item.startMs - currentTo >= breakOnSilenceAfterMilliseconds;
        if (text.startsWith(' ') && (exceedsDuration || shouldBreakOnSilence)) {
            if (currentText !== '') {
                flush();
            }
            currentText = text.trimStart();
            currentTokens = [
                {
                    text: text.trimStart(),
                    fromMs: item.startMs,
                    toMs: item.endMs,
                    ...(item.pageBreakAfter ? { pageBreakAfter: true } : {}),
                },
            ].filter((t) => t.text !== '');
            currentFrom = item.startMs;
            currentTo = item.endMs;
        }
        else {
            if (currentText === '') {
                currentFrom = item.startMs;
            }
            currentText += text;
            currentText = currentText.trimStart();
            if (text.trim() !== '') {
                currentTokens.push({
                    text: currentTokens.length === 0 ? currentText.trimStart() : text,
                    fromMs: item.startMs,
                    toMs: item.endMs,
                    ...(item.pageBreakAfter ? { pageBreakAfter: true } : {}),
                });
            }
            currentTo = item.endMs;
        }
        if (item.pageBreakAfter === true && currentText !== '') {
            flush();
            currentText = '';
            currentTokens = [];
        }
        if (index === captions.length - 1 && currentText !== '') {
            flush();
            const last = pages[pages.length - 1];
            last.durationMs = currentTo - last.startMs;
        }
    });
    const lastPage = pages[pages.length - 1];
    if (lastPage !== undefined && lastPage.durationMs === Infinity) {
        lastPage.durationMs = currentTo - lastPage.startMs;
    }
    return { pages };
};
/** End of a page on the media clock (startMs + durationMs). */
export const pageEndMs = (page) => page.startMs + page.durationMs;
/**
 * Split word captions into line segments of at most maxCharsPerLine
 * characters (reference-compatible, incl. orphan prevention: with <4
 * words left and a half-full line, break early so no orphan word).
 */
export const ensureMaxCharactersPerLine = (input) => {
    const { captions, maxCharsPerLine } = input;
    assertCaptions(captions);
    if (!Number.isFinite(maxCharsPerLine) || maxCharsPerLine <= 0) {
        throw new Error('maxCharsPerLine must be a positive finite number');
    }
    const split = [];
    for (const w of captions) {
        const words = w.text.split(' ').filter(Boolean);
        for (let j = 0; j < words.length; j++) {
            const word = words[j];
            split.push({
                text: j === 0 ? ` ${word}` : word,
                startMs: w.startMs,
                endMs: w.endMs,
                confidence: w.confidence,
                timestampMs: w.timestampMs,
                ...(j === words.length - 1 && w.pageBreakAfter === true
                    ? { pageBreakAfter: true }
                    : {}),
            });
        }
    }
    const segments = [];
    let current = [];
    for (let i = 0; i < split.length; i++) {
        const w = split[i];
        const remaining = split.slice(i + 1);
        const filled = current.map((s) => s.text.length).reduce((a, b) => a + b, 0);
        const preventOrphanWord = remaining.length < 4 && remaining.length > 1 && filled > maxCharsPerLine / 2;
        if (filled + w.text.length > maxCharsPerLine || preventOrphanWord) {
            segments.push(current);
            current = [];
        }
        current.push(w);
        if (w.pageBreakAfter === true && i < split.length - 1) {
            segments.push(current);
            current = [];
        }
    }
    if (current.length > 0) {
        segments.push(current);
    }
    return { segments };
};
/**
 * Render a page's tokens as multi-line display text with hard breaks at
 * segment boundaries (layoutText splits on \n, so this reuses M4 wrapping).
 */
export const pageDisplayText = (page, maxCharsPerLine) => {
    if (maxCharsPerLine === undefined) {
        return page.text;
    }
    if (!Number.isFinite(maxCharsPerLine) || maxCharsPerLine <= 0) {
        throw new Error('maxCharsPerLine must be a positive finite number');
    }
    const asCaptions = page.tokens.map((t) => ({
        text: t.text,
        startMs: t.fromMs,
        endMs: t.toMs,
        timestampMs: null,
        confidence: null,
        ...(t.pageBreakAfter === true ? { pageBreakAfter: true } : {}),
    }));
    const { segments } = ensureMaxCharactersPerLine({ captions: asCaptions, maxCharsPerLine });
    return segments.map((seg) => seg.map((c) => c.text).join('').trimStart()).join('\n');
};
/** Index of the page visible at timeMs, or -1 when no page is active. */
export const activePageIndexAt = (pages, timeMs) => {
    if (!Number.isFinite(timeMs)) {
        throw new Error('timeMs must be finite');
    }
    for (let i = pages.length - 1; i >= 0; i--) {
        const page = pages[i];
        if (timeMs >= page.startMs && timeMs < page.startMs + page.durationMs) {
            return i;
        }
    }
    return -1;
};
/** Index of the last token started at timeMs within a page (-1 = none yet). */
export const activeTokenIndexAt = (page, timeMs) => {
    if (!Number.isFinite(timeMs)) {
        throw new Error('timeMs must be finite');
    }
    let active = -1;
    page.tokens.forEach((token, i) => {
        if (timeMs >= token.fromMs) {
            active = i;
        }
    });
    return active;
};
/** 0..1 progress of a token at timeMs (clamped; 0 before, 1 after). */
export const tokenProgressAt = (token, timeMs) => {
    if (!Number.isFinite(timeMs)) {
        throw new Error('timeMs must be finite');
    }
    if (timeMs <= token.fromMs) {
        return 0;
    }
    if (timeMs >= token.toMs) {
        return 1;
    }
    const span = token.toMs - token.fromMs;
    if (span <= 0) {
        return 1;
    }
    return (timeMs - token.fromMs) / span;
};
//# sourceMappingURL=pagination.js.map
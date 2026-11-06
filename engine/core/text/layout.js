/**
 * M4 — Deterministic text layout (pure; measurement injected).
 * - explicit \n always breaks; other breaks are greedy word wraps
 * - overlong words hard-break by grapheme
 * - letterSpacing widens every grapheme advance (BEFORE shaping-neutral split:
 *   measurement of whole runs stays backend-shaped; spacing is additive).
 *   CONTRACT: backend measurers must report the BASE advance with letterSpacing
 *   excluded (see Skia measurer). Layout adds `letterSpacing` per grapheme;
 *   drawing applies the backend spacing once. If a backend measured WITH
 *   spacing, every spaced run would count it twice (early wraps, shifted
 *   centering).
 * - align offsets are relative to maxWidth (or longest line when unbounded)
 */
export const DEFAULT_LINE_HEIGHT = 1.2;
export const applyTextTransform = (text, transform) => {
    if (transform === 'uppercase') {
        return text.toUpperCase();
    }
    if (transform === 'lowercase') {
        return text.toLowerCase();
    }
    return text;
};
const graphemesOf = (text) => {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return [...segmenter.segment(text)].map((s) => s.segment);
};
const advanceOf = (run, graphemeCount, style, measure) => {
    if (run === '') {
        return 0;
    }
    const spacing = style.letterSpacing ?? 0;
    return measure.measure(run, style).width + spacing * graphemeCount;
};
const splitWords = (paragraph) => paragraph.split(/(\s+)/).filter((p) => p !== '');
const wrapParagraph = (paragraph, style, measure, maxWidth) => {
    const out = [];
    let current = '';
    let currentWidth = 0;
    let currentGraphs = 0;
    const push = () => {
        if (current !== '') {
            // Trailing wrap whitespace collapses (browser parity).
            const trimmed = current.replace(/\s+$/, '');
            if (trimmed !== '') {
                out.push({
                    text: trimmed,
                    width: advanceOf(trimmed, graphemesOf(trimmed).length, style, measure),
                });
            }
            current = '';
            currentWidth = 0;
            currentGraphs = 0;
        }
    };
    const hardBreakWord = (word) => {
        let piece = '';
        let pieceWidth = 0;
        let pieceGraphs = 0;
        for (const g of graphemesOf(word)) {
            const w = advanceOf(g, 1, style, measure);
            if (maxWidth !== undefined && piece !== '' && pieceWidth + w > maxWidth) {
                out.push({ text: piece, width: pieceWidth });
                piece = '';
                pieceWidth = 0;
                pieceGraphs = 0;
            }
            piece += g;
            pieceWidth += w;
            pieceGraphs += 1;
        }
        current = piece;
        currentWidth = pieceWidth;
        currentGraphs = pieceGraphs;
    };
    for (const token of splitWords(paragraph)) {
        if (/^\s+$/.test(token)) {
            if (maxWidth === undefined) {
                current += token;
                currentGraphs += graphemesOf(token).length;
                currentWidth = advanceOf(current, currentGraphs, style, measure);
                continue;
            }
            const trial = current + token;
            const trialWidth = advanceOf(trial, currentGraphs + graphemesOf(token).length, style, measure);
            if (trialWidth <= maxWidth) {
                current = trial;
                currentWidth = trialWidth;
                currentGraphs += graphemesOf(token).length;
            }
            else {
                push();
            }
            continue;
        }
        const graphs = graphemesOf(token).length;
        const wordWidth = advanceOf(token, graphs, style, measure);
        if (maxWidth !== undefined && wordWidth > maxWidth && current === '') {
            hardBreakWord(token);
            continue;
        }
        const trial = current === '' || /\s$/.test(current) ? current + token : `${current} ${token}`;
        const trialGraphs = current === '' ? graphs : currentGraphs + (/\s$/.test(current) ? 0 : 1) + graphs;
        const trialWidth = current === ''
            ? wordWidth
            : advanceOf(trial, trialGraphs, style, measure);
        if (maxWidth !== undefined && trialWidth > maxWidth && current !== '') {
            push();
            if (wordWidth > maxWidth) {
                hardBreakWord(token);
            }
            else {
                current = token;
                currentWidth = wordWidth;
                currentGraphs = graphs;
            }
        }
        else {
            current = trial;
            currentWidth = trialWidth;
            currentGraphs = trialGraphs;
        }
    }
    push();
    if (out.length === 0) {
        return [{ text: '', width: 0 }];
    }
    return out;
};
/**
 * Lay out text into positioned lines. Pure in (text, style, measure).
 * x offsets honor textAlign against (maxWidth ?? longest line).
 * Justify distributes leftover space across inter-word gaps of every line
 * except each paragraph's last line (exposed as gapExtra for word drawing).
 */
export const layoutText = (text, style, measure) => {
    const transformed = applyTextTransform(text, style.textTransform);
    const lineHeightPx = style.fontSize * (style.lineHeight ?? DEFAULT_LINE_HEIGHT);
    const align = style.textAlign ?? 'left';
    const wrapped = [];
    const paragraphs = transformed.split('\n');
    paragraphs.forEach((paragraph, pIndex) => {
        const lines = wrapParagraph(paragraph, style, measure, style.maxWidth);
        lines.forEach((line, lIndex) => {
            wrapped.push({ ...line, lastOfParagraph: lIndex === lines.length - 1 });
        });
        void pIndex;
    });
    const longest = Math.max(0, ...wrapped.map((l) => l.width));
    const blockWidth = style.maxWidth ?? longest;
    const lines = wrapped.map((line, index) => {
        let x = 0;
        let gapExtra = 0;
        if (align === 'center') {
            x = (blockWidth - line.width) / 2;
        }
        else if (align === 'right') {
            x = blockWidth - line.width;
        }
        else if (align === 'justify' && !line.lastOfParagraph) {
            const gaps = line.text.split(/(\s+)/).filter((t) => /^\s+$/.test(t)).length;
            if (gaps > 0) {
                gapExtra = (blockWidth - line.width) / gaps;
            }
        }
        return { text: line.text, x, y: index * lineHeightPx, width: line.width, gapExtra };
    });
    return {
        lines,
        width: style.maxWidth ?? longest,
        height: lines.length * lineHeightPx,
        lineHeightPx,
    };
};
/** Word boxes for highlighting/kinetic use (M8 reuses this). */
export const layoutWords = (laid, style, measure) => {
    const out = [];
    laid.lines.forEach((line, lineIndex) => {
        let x = line.x;
        const extra = line.gapExtra ?? 0;
        const tokens = line.text.split(/(\s+)/).filter((t) => t !== '');
        for (const token of tokens) {
            if (/^\s+$/.test(token)) {
                x += advanceOf(token, graphemesOf(token).length, style, measure) + extra;
                continue;
            }
            const w = advanceOf(token, graphemesOf(token).length, style, measure);
            out.push({ word: token, line: lineIndex, x, y: line.y, width: w });
            x += w;
        }
    });
    return out;
};
/** Grapheme boxes for character-level animation (M8 reuses this). */
export const layoutChars = (laid, style, measure) => {
    const out = [];
    const words = layoutWords(laid, style, measure);
    words.forEach((word, wordIndex) => {
        let x = word.x;
        for (const g of graphemesOf(word.word)) {
            const w = advanceOf(g, 1, style, measure);
            out.push({ ch: g, wordIndex, line: word.line, x, y: word.y, width: w });
            x += w;
        }
    });
    return out;
};
//# sourceMappingURL=layout.js.map
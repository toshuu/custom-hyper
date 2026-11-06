/**
 * M4 — Text contracts: style, measurement abstraction, laid-out lines.
 * Layout is pure; measurement is injected (backend-specific) so the same
 * algorithms run on Skia, browser, or future GPU backends.
 */
export interface TextStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight?: number | string;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    /** Extra advance per grapheme, in px. */
    letterSpacing?: number;
    /** Line height as a multiplier of fontSize (default 1.2). */
    lineHeight?: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    textTransform?: 'none' | 'uppercase' | 'lowercase';
    maxWidth?: number;
}
export interface TextLineMetrics {
    width: number;
}
export interface TextMeasurer {
    measure(text: string, style: TextStyle): TextLineMetrics;
}
export interface LaidLine {
    /** Line text after wrapping (no trailing newline). */
    text: string;
    /** x offset of the line start relative to the text origin. */
    x: number;
    /** y offset of the line TOP relative to the text origin. */
    y: number;
    width: number;
    /** Extra px distributed per inter-word gap (justify only). */
    gapExtra?: number;
}
export interface LaidText {
    lines: LaidLine[];
    /** Max line width. */
    width: number;
    /** lines.length * fontSize * lineHeight. */
    height: number;
    lineHeightPx: number;
}
export interface LaidWord {
    word: string;
    line: number;
    x: number;
    y: number;
    width: number;
}
export interface LaidChar {
    ch: string;
    wordIndex: number;
    line: number;
    x: number;
    y: number;
    width: number;
}
//# sourceMappingURL=types.d.ts.map
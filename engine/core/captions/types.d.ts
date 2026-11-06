/**
 * M8 — Caption contracts (JSON-compatible, pure data).
 * No transcription here: the engine receives timestamped caption JSON
 * (e.g. Whisper output) and renders it. Compatible with the
 * `@remotion/captions` Caption shape (reference, tests only).
 */
export interface Caption {
    text: string;
    startMs: number;
    endMs: number;
    timestampMs?: number | null;
    confidence?: number | null;
    pageBreakAfter?: boolean;
}
export interface TikTokToken {
    text: string;
    fromMs: number;
    toMs: number;
    pageBreakAfter?: boolean;
}
export interface TikTokPage {
    text: string;
    startMs: number;
    tokens: TikTokToken[];
    durationMs: number;
}
export interface CreateTikTokStyleCaptionsInput {
    captions: Caption[];
    combineTokensWithinMilliseconds: number;
    breakOnSilenceAfterMilliseconds?: number;
}
export interface EnsureMaxCharactersPerLineInput {
    captions: Caption[];
    maxCharsPerLine: number;
}
export type CaptionHighlightMode = 'word' | 'phrase' | 'none';
export type CaptionReveal = 'none' | 'word-reveal' | 'line-reveal' | 'typewriter';
export type TokenState = 'spoken' | 'active' | 'upcoming';
/** Loud validation shared by pagination/highlight/render paths. */
export declare const assertCaption: (caption: Caption, index: number) => void;
export declare const assertCaptions: (captions: Caption[]) => void;
//# sourceMappingURL=types.d.ts.map
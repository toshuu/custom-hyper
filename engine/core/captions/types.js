/**
 * M8 — Caption contracts (JSON-compatible, pure data).
 * No transcription here: the engine receives timestamped caption JSON
 * (e.g. Whisper output) and renders it. Compatible with the
 * `@remotion/captions` Caption shape (reference, tests only).
 */
/** Loud validation shared by pagination/highlight/render paths. */
export const assertCaption = (caption, index) => {
    if (typeof caption.text !== 'string') {
        throw new Error(`Caption #${index} needs a string text`);
    }
    if (!Number.isFinite(caption.startMs) || !Number.isFinite(caption.endMs)) {
        throw new Error(`Caption #${index} needs finite startMs/endMs`);
    }
    if (caption.endMs < caption.startMs) {
        throw new Error(`Caption #${index} has endMs < startMs`);
    }
};
export const assertCaptions = (captions) => {
    if (!Array.isArray(captions)) {
        throw new Error('captions must be an array');
    }
    captions.forEach(assertCaption);
};
//# sourceMappingURL=types.js.map
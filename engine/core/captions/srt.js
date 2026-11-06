/**
 * M8 — SRT ingest/emit (pure, deterministic).
 * Reference-compatible with `@remotion/captions` parse/serialize
 * (probed from the installed copy; never a runtime dep).
 */
import { assertCaptions } from './types.js';
const toSeconds = (time) => {
    const [first, second, third] = time.split(':');
    if (first === undefined || second === undefined || third === undefined) {
        throw new Error(`Invalid timestamp: ${time}`);
    }
    const [seconds, millis] = third.trim().split(/[,.]/);
    if (seconds === undefined || millis === undefined) {
        throw new Error(`Invalid timestamp: ${time}`);
    }
    return (parseInt(first, 10) * 3600 +
        parseInt(second, 10) * 60 +
        parseInt(seconds, 10) +
        parseInt(millis, 10) / 1000);
};
/** Parse `.srt` subtitle text into word/line captions (confidence 1). */
export const parseSrt = (input) => {
    if (typeof input.input !== 'string') {
        throw new Error('parseSrt needs { input: string }');
    }
    const lines = input.input
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n');
    const captions = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];
        if (/^\s*\d+\s*$/.test(line) && nextLine !== undefined && nextLine.includes(' --> ')) {
            const parts = nextLine.split(' --> ');
            const start = toSeconds(parts[0].trim());
            const end = toSeconds(parts[1].trim());
            captions.push({
                text: '',
                startMs: start * 1000,
                endMs: end * 1000,
                confidence: 1,
                timestampMs: ((start + end) / 2) * 1000,
            });
        }
        else if (line.includes(' --> ')) {
            continue;
        }
        else if (line.trim() === '') {
            if (captions.length > 0) {
                const last = captions[captions.length - 1];
                last.text = last.text.trim();
            }
        }
        else if (captions.length > 0) {
            captions[captions.length - 1].text += `${line}\n`;
        }
    }
    return {
        captions: captions.map((caption) => ({ ...caption, text: caption.text.trimEnd() })),
    };
};
const pad2 = (n) => String(n).padStart(2, '0');
const pad3 = (n) => String(n).padStart(3, '0');
const formatSingleSrtTimestamp = (timestamp) => {
    if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new Error('SRT timestamps must be non-negative finite numbers');
    }
    const hours = Math.floor(timestamp / 3600000);
    const minutes = Math.floor((timestamp % 3600000) / 60000);
    const seconds = Math.floor((timestamp % 60000) / 1000);
    const milliseconds = Math.floor(timestamp % 1000);
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(milliseconds)}`;
};
/** Serialize caption lines back to `.srt` (pageBreakAfter forces cue splits). */
export const serializeSrt = (input) => {
    if (!Array.isArray(input.lines)) {
        throw new Error('serializeSrt needs { lines: Caption[][] }');
    }
    for (const line of input.lines) {
        assertCaptions(line);
    }
    const cues = [];
    for (const line of input.lines) {
        let current = [];
        for (const caption of line) {
            current.push(caption);
            if (caption.pageBreakAfter === true) {
                cues.push(current);
                current = [];
            }
        }
        if (current.length > 0) {
            cues.push(current);
        }
    }
    return cues
        .map((cue, index) => {
        const first = cue[0];
        const last = cue[cue.length - 1];
        return [
            index + 1,
            `${formatSingleSrtTimestamp(first.startMs)} --> ${formatSingleSrtTimestamp(last.endMs)}`,
            cue.map((caption) => caption.text).join(''),
        ].join('\n');
    })
        .join('\n\n');
};
//# sourceMappingURL=srt.js.map
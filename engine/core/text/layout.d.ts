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
import type { LaidChar, LaidText, LaidWord, TextMeasurer, TextStyle } from './types.js';
export declare const DEFAULT_LINE_HEIGHT = 1.2;
export declare const applyTextTransform: (text: string, transform: TextStyle["textTransform"]) => string;
/**
 * Lay out text into positioned lines. Pure in (text, style, measure).
 * x offsets honor textAlign against (maxWidth ?? longest line).
 * Justify distributes leftover space across inter-word gaps of every line
 * except each paragraph's last line (exposed as gapExtra for word drawing).
 */
export declare const layoutText: (text: string, style: TextStyle, measure: TextMeasurer) => LaidText;
/** Word boxes for highlighting/kinetic use (M8 reuses this). */
export declare const layoutWords: (laid: LaidText, style: TextStyle, measure: TextMeasurer) => LaidWord[];
/** Grapheme boxes for character-level animation (M8 reuses this). */
export declare const layoutChars: (laid: LaidText, style: TextStyle, measure: TextMeasurer) => LaidChar[];
//# sourceMappingURL=layout.d.ts.map
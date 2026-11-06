/**
 * M4 — Font registration + canvas text measurement for Skia.
 * Fonts must be registered BEFORE measuring/drawing (no implicit fallback
 * timing — keeps renders deterministic). System fonts loadable on demand.
 */
import type { TextMeasurer, TextStyle } from '../../core/index.js';
export interface RegisteredFont {
    family: string;
    path?: string;
    weight?: number | string;
    style?: string;
}
export declare const registerFontFile: (path: string, family: string, opts?: {
    weight?: number | string;
    style?: string;
}) => void;
export declare const registerFontBuffer: (data: Buffer, family: string, opts?: {
    weight?: number | string;
    style?: string;
}) => void;
export declare const ensureSystemFonts: () => void;
export declare const listFontFamilies: () => string[];
export declare const registeredFonts: () => RegisteredFont[];
/** CSS font shorthand the canvas backend resolves (Pango/fontconfig). */
export declare const fontStringFor: (style: TextStyle) => string;
/** Backend measurer: consistent with drawText by construction. */
export declare const createSkiaMeasurer: () => TextMeasurer;
/** Whether the backend honors letterSpacing (probe, not assumption). */
export declare const probeLetterSpacingSupport: () => boolean;
//# sourceMappingURL=fonts.d.ts.map